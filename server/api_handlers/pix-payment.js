import { renderVipWelcomeEmail, renderVipUpgradeEmail } from "../emailTemplates.js";
import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";
import { getVipPlanById } from "../vipPlans.js";
import { applyStockDeductionWithClaim } from "../inventory.js";
import { rateLimit } from '../rateLimit.js';
import { cleanupOrder3dModel, shouldCleanupOrder3dForStatus } from '../order3dCleanup.js';

export const config = { runtime: "nodejs" };

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

async function mpFetch(token, url) {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}


function isValidEmail(value) {
  const s = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function fetchAuthUserEmail(sb, userId) {
  try {
    if (!sb?.auth?.admin || !userId) return "";
    const resp = await sb.auth.admin.getUserById(userId);
    return String(resp?.data?.user?.email || "").trim();
  } catch (e) {
    console.error("pix-payment fetchAuthUserEmail error", e);
    return "";
  }
}

function mapOrderStatus(mpStatus) {
  if (mpStatus === "approved") return "paid";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatus)) return "failed";
  return "pending";
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  if (!apiKey || !from || !to) return { ok: false, skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return { ok: r.ok, status: r.status };
}

async function revokeVipFromOrder(sb, order, reason = "payment_failed") {
  try {
    if (!order || String(order.order_type || "").toLowerCase() !== "vip" || !order.user_id) return;
    const nowIso = new Date().toISOString();
    await sb.from("vip_subscriptions").update({ status: reason, ends_at: nowIso }).eq("order_id", order.id);
    const { data: others } = await sb
      .from("vip_subscriptions")
      .select("id,ends_at,status")
      .eq("user_id", order.user_id)
      .neq("order_id", order.id)
      .eq("status", "active");
    const hasOtherActive = Array.isArray(others) && others.some((r) => {
      const t = r?.ends_at ? new Date(r.ends_at).getTime() : 0;
      return Number.isFinite(t) && t > Date.now();
    });
    if (!hasOtherActive) {
      await sb.from("profiles").update({ vip_until: null, vip_plan: null, vip_cycle_key: null }).eq("id", order.user_id);
    }
  } catch (e) {
    console.error("pix-payment revokeVipFromOrder error", e);
  }
}


async function loadProfileVipCompat(sb, userId) {
  let resp = await sb.from("profiles").select("vip_until,vip_cycle_key").eq("id", userId).maybeSingle();
  if (!resp?.error) return resp?.data || {};
  const msg = String(resp.error?.message || "");
  if (!/vip_cycle_key|column|schema cache/i.test(msg)) return {};
  resp = await sb.from("profiles").select("vip_until").eq("id", userId).maybeSingle();
  return resp?.data || {};
}


async function isLevel3PlanId(planId) {
  const raw = String(planId || '').toLowerCase();
  return raw.includes('cubo_l3') || raw.includes('level-3') || raw.includes('level 3');
}

async function syncLevel3Selections(sb, { userId, cycleKey, savedAt } = {}) {
  if (!sb || !userId || !cycleKey) return;
  const { data: options, error } = await sb
    .from('vip_mini_options')
    .select('id')
    .eq('cycle_key', cycleKey)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const ids = Array.isArray(options) ? options.map((row) => row?.id).filter(Boolean) : [];
  if (!ids.length) return;
  const payload = {
    user_id: userId,
    cycle_key: cycleKey,
    selected_option_ids: ids,
    saved_at: savedAt || new Date().toISOString(),
  };
  const { error: upsertError } = await sb.from('vip_mini_selections').upsert(payload, { onConflict: 'user_id,cycle_key' });
  if (upsertError) throw upsertError;
}

async function updateProfileVipCompat(sb, userId, patch) {
  let resp = await sb.from("profiles").update(patch).eq("id", userId);
  if (!resp?.error) return resp;
  const msg = String(resp.error?.message || "");
  if (!/vip_cycle_key|column|schema cache/i.test(msg)) return resp;
  const safePatch = { ...patch };
  delete safePatch.vip_cycle_key;
  return await sb.from("profiles").update(safePatch).eq("id", userId);
}
async function applyVipFromOrder(sb, order, payment) {
  try {
    const orderTypeNorm = String(order?.order_type || payment?.metadata?.order_type || '').toLowerCase();
    if (!order || !['vip', 'vip_upgrade'].includes(orderTypeNorm)) return;
    const userId = order.user_id;
    if (!userId) return;
    const planId = String(order.vip_plan_id || payment?.metadata?.vip_plan_id || "CUBO_L1_RPG");
    const purchasedCycleKey = String(payment?.metadata?.vip_cycle_key || '').trim() || null;
    const vipPlan = await getVipPlanById(sb, planId);

    if (orderTypeNorm === 'vip') {
      const { data: existing } = await sb.from("vip_subscriptions").select("id").eq("order_id", order.id).maybeSingle();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (!existing?.id) {
        await sb.from("vip_subscriptions").insert({
          user_id: userId,
          plan_id: planId,
          order_id: order.id,
          starts_at: new Date().toISOString(),
          ends_at: end.toISOString(),
          status: "active",
        });
      }
      const prof = await loadProfileVipCompat(sb, userId);
      const currentUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
      const nextUntil = Math.max(currentUntil, end.getTime());
      const profilePatch = { vip_until: new Date(nextUntil).toISOString(), vip_plan: planId };
      if (purchasedCycleKey) profilePatch.vip_cycle_key = purchasedCycleKey;
      await updateProfileVipCompat(sb, userId, profilePatch);
      if (await isLevel3PlanId(planId) && purchasedCycleKey) {
        await syncLevel3Selections(sb, { userId, cycleKey: purchasedCycleKey, savedAt: new Date().toISOString() });
      }
    }

    if (orderTypeNorm === 'vip_upgrade') {
      try {
        await sb.from('vip_subscriptions').update({ plan_id: planId }).eq('user_id', userId).eq('status', 'active');
      } catch {}
      const upgradePatch = { vip_plan: planId };
      if (purchasedCycleKey) upgradePatch.vip_cycle_key = purchasedCycleKey;
      await updateProfileVipCompat(sb, userId, upgradePatch);
      if (await isLevel3PlanId(planId) && purchasedCycleKey) {
        await syncLevel3Selections(sb, { userId, cycleKey: purchasedCycleKey, savedAt: new Date().toISOString() });
      }
    }

    try {
      const metaResp = await sb.from("orders").select("customer_email,customer_name,total,customer_email_sent_at,vip_activation_email_sent_at").eq("id", order.id).maybeSingle();
      const emailMeta = metaResp?.data || null;
      const alreadySent = Boolean(emailMeta?.customer_email_sent_at) || (orderTypeNorm === 'vip' && Boolean(emailMeta?.vip_activation_email_sent_at));
      let to = String(emailMeta?.customer_email || order.customer_email || payment?.payer?.email || "").trim();
      if (!isValidEmail(to)) {
        const authEmail = await fetchAuthUserEmail(sb, userId);
        if (isValidEmail(authEmail)) {
          to = authEmail;
          try { await sb.from("orders").update({ customer_email: authEmail }).eq("id", order.id); } catch {}
        }
      }
      if (isValidEmail(to) && !alreadySent) {
        const baseUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
        const paymentMethod = String(payment?.payment_method_id || '').toLowerCase() === 'pix' ? 'Pix' : 'Mercado Pago';
        let mail;
        if (orderTypeNorm === 'vip_upgrade') {
          const fromPlanId = String(payment?.metadata?.vip_upgrade_from || '').trim();
          const fromPlan = fromPlanId ? await getVipPlanById(sb, fromPlanId) : null;
          const chargedNow = Number(emailMeta?.total || order.total || 0) || undefined;
          mail = renderVipUpgradeEmail({
            brandName: process.env.BRAND_NAME || "Cubo Criativo",
            orderId: order.id,
            customerName: emailMeta?.customer_name || order.customer_name || payment?.payer?.first_name || "cliente",
            reviewLink: baseUrl ? `${baseUrl}/#/conta` : "",
            supportEmail: process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || "",
            whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || "",
            fromPlanName: fromPlan?.name || fromPlan?.short_name || fromPlanId || 'Plano atual',
            toPlanName: vipPlan?.name || vipPlan?.short_name || planId,
            fromPlanDescription: fromPlan?.description || '',
            toPlanDescription: vipPlan?.description || '',
            amountCharged: chargedNow,
            previousPrice: Number(fromPlan?.price_brl || 0) || undefined,
            newPrice: Number(vipPlan?.price_brl || 0) || undefined,
            miniaturesCount: Number(vipPlan?.miniatures_count || 0) || undefined,
            bossCount: Number(vipPlan?.boss_count || 0) || undefined,
            scale: vipPlan?.scale || '',
            recurrenceLabel: 'Mensal',
            paymentMethod,
            upgradeHighlights: [
              fromPlan?.name && vipPlan?.name ? `Mudança de ${fromPlan.name} para ${vipPlan.name}` : null,
              Number(vipPlan?.miniatures_count || 0) ? `${Number(vipPlan.miniatures_count)} miniatura${Number(vipPlan.miniatures_count) > 1 ? 's' : ''}${vipPlan?.scale ? ` em ${vipPlan.scale}` : ''} por ciclo` : null,
              Number(vipPlan?.boss_count || 0) ? `${Number(vipPlan.boss_count)} boss incluso${Number(vipPlan.boss_count) > 1 ? 's' : ''}` : 'Escolhas liberadas pela Área VIP',
              chargedNow ? `Cobrança atual do upgrade: ${chargedNow.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : null,
            ].filter(Boolean),
          });
        } else {
          mail = renderVipWelcomeEmail({
            brandName: process.env.BRAND_NAME || "Cubo Criativo",
            orderId: order.id,
            customerName: emailMeta?.customer_name || order.customer_name || payment?.payer?.first_name || "cliente",
            reviewLink: baseUrl ? `${baseUrl}/#/conta` : "",
            supportEmail: process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || "",
            whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || "",
            vipPlanId: planId,
            planName: vipPlan?.name || vipPlan?.short_name || planId,
            planDescription: vipPlan?.description || '',
            monthlyPrice: Number(vipPlan?.price_brl || 0) || Number(emailMeta?.total || order.total) || undefined,
            miniaturesCount: Number(vipPlan?.miniatures_count || 0) || undefined,
            bossCount: Number(vipPlan?.boss_count || 0) || undefined,
            scale: vipPlan?.scale || '',
            recurrenceLabel: 'Mensal',
            benefits: [
              Number(vipPlan?.miniatures_count || 0) ? `${Number(vipPlan.miniatures_count)} miniatura${Number(vipPlan.miniatures_count) > 1 ? 's' : ''}${vipPlan?.scale ? ` em ${vipPlan.scale}` : ''}` : null,
              Number(vipPlan?.boss_count || 0) ? `${Number(vipPlan.boss_count)} boss incluso${Number(vipPlan.boss_count) > 1 ? 's' : ''}` : 'Escolha mensal de miniaturas pela Área VIP',
              'Acesso ao Cubo Game e benefícios exclusivos do clube',
            ].filter(Boolean),
            total: Number(emailMeta?.total || order.total) || undefined,
            paymentMethod,
          });
        }
        const sendResp = await sendResendEmail({ to, subject: mail.subject, html: mail.html });
        if (sendResp?.ok) {
          const payload = orderTypeNorm === 'vip'
            ? { vip_activation_email_sent_at: new Date().toISOString(), customer_email_sent_at: new Date().toISOString(), customer_email_error: null }
            : { customer_email_sent_at: new Date().toISOString(), customer_email_error: null };
          await sb.from("orders").update(payload).eq("id", order.id);
        } else {
          console.error(`vip ${orderTypeNorm} email (pix verify) resend failed`, { status: sendResp?.status, to, orderId: order.id });
          await sb.from("orders").update({ customer_email_error: `${orderTypeNorm}_resend_${sendResp?.status || 0}` }).eq("id", order.id);
        }
      }
    } catch (emailErr) {
      console.error(`vip ${orderTypeNorm} email (pix verify) error`, emailErr);
      try { await sb.from("orders").update({ customer_email_error: String(emailErr?.message || emailErr).slice(0, 500) }).eq("id", order.id); } catch {}
    }
  } catch (e) {
    console.error("pix-payment applyVipFromOrder error", e);
  }
}


async function applyStockDeductionIfNeeded(sb, order) {
  try {
    await applyStockDeductionWithClaim(sb, order);
  } catch (e) {
    console.error('applyStockDeductionIfNeeded error', e);
  }
}

async function loadUserAndOrder(req, res, purposeText) {
  const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!token) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" }), {};
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: `Faça login para ${purposeText}.` }), {};

  const body = safeBody(req);
  const orderId = String(body.order_id || "").trim();
  if (!orderId) return res.status(400).json({ error: "Missing order_id" }), {};

  const sb = supabaseAdmin();
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id,user_id,status,total,customer_email,customer_name,payment_provider,provider_payment_id,order_type,vip_plan_id,model_3d_url,model_3d_name")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return res.status(500).json({ error: "Supabase error", details: orderErr }), {};
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" }), {};
  if (order.user_id !== user.id) return res.status(403).json({ error: "Sem permissão para este pedido" }), {};

  const paymentId = String(order.provider_payment_id || "").trim();
  if (!paymentId) return res.status(400).json({ error: "Pedido sem provider_payment_id (Pix não associado)" }), {};

  return { token, user, sb, order, orderId, paymentId };
}

async function handleGet(req, res) {
  const ctx = await loadUserAndOrder(req, res, "ver o Pix");
  if (!ctx.orderId) return;
  const { token, sb, orderId, paymentId, order } = ctx;

  const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
  if (!paymentResp.ok) return res.status(paymentResp.status || 500).json({ error: paymentResp.data || { message: "Mercado Pago error" } });
  const mp = paymentResp.data || {};
  const mpStatus = String(mp.status || "");
  const mapped = mapOrderStatus(mpStatus);
  try {
    await sb.from("orders").update({ status: mapped, payment_provider: "mercado_pago", provider_payment_id: String(mp.id || paymentId) }).eq("id", orderId);
    if (shouldCleanupOrder3dForStatus(mapped)) await cleanupOrder3dModel(sb, order).catch((e) => console.error("order 3d cleanup on pix get failed", e));
    if (mapped === "failed") await revokeVipFromOrder(sb, order, "payment_failed");
  } catch {}

  const tx = mp.point_of_interaction?.transaction_data || {};
  return res.status(200).json({ ok: true, order_id: orderId, mp_status: mpStatus, status: mapped, qr_code: tx.qr_code || null, qr_code_base64: tx.qr_code_base64 || null, ticket_url: tx.ticket_url || null });
}

async function handleVerify(req, res) {
  const ctx = await loadUserAndOrder(req, res, "verificar o Pix");
  if (!ctx.orderId) return;
  const { token, sb, orderId, paymentId, order } = ctx;

  const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
  if (!paymentResp.ok) return res.status(paymentResp.status || 500).json({ error: paymentResp.data || { message: "Mercado Pago error" } });
  const mp = paymentResp.data || {};
  const mpStatus = String(mp.status || "");
  const newStatus = mapOrderStatus(mpStatus);

  await sb.from("orders").update({
    status: newStatus,
    payment_provider: "mercado_pago",
    provider_payment_id: String(mp.id || paymentId),
    customer_email: mp?.payer?.email || order.customer_email || null,
  }).eq("id", orderId);

  if (shouldCleanupOrder3dForStatus(newStatus)) await cleanupOrder3dModel(sb, order).catch((e) => console.error("order 3d cleanup on pix verify failed", e));
  if (newStatus === "paid") { await applyVipFromOrder(sb, order, mp); await applyStockDeductionIfNeeded(sb, order); }
  if (newStatus === "failed") await revokeVipFromOrder(sb, order, "payment_failed");

  return res.status(200).json({ ok: true, order_id: orderId, mp_status: mpStatus, status: newStatus, paid: newStatus === "paid" });
}

export default async function handler(req, res) {
  
  if (!rateLimit(req, res, { key: 'api:pix-status', limit: 60, windowMs: 60000 })) return;
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = String(req.query?.action || "").toLowerCase();
    if (action === "get") return handleGet(req, res);
    if (action === "verify") return handleVerify(req, res);
    return res.status(400).json({ error: "Ação inválida. Use action=get ou action=verify." });
  } catch (e) {
    console.error("pix-payment api error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}