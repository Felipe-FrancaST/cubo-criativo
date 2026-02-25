import { renderVipWelcomeEmail } from "../server/emailTemplates.js";
import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";
import { getVipPlanById } from "../server/vipPlans.js";

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
      await sb.from("profiles").update({ vip_until: null, vip_plan: null }).eq("id", order.user_id);
    }
  } catch (e) {
    console.error("pix-payment revokeVipFromOrder error", e);
  }
}

async function applyVipFromOrder(sb, order, payment) {
  try {
    if (!order || String(order.order_type || "").toLowerCase() !== "vip") return;
    const userId = order.user_id;
    if (!userId) return;
    const planId = String(order.vip_plan_id || "CUBO_L1_RPG");

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

    const { data: prof } = await sb.from("profiles").select("vip_until").eq("id", userId).maybeSingle();
    const currentUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
    const nextUntil = Math.max(currentUntil, end.getTime());
    const vipPlan = await getVipPlanById(sb, planId);
    await sb.from("profiles").update({ vip_until: new Date(nextUntil).toISOString(), vip_plan: vipPlan?.name || "Cubo Level 1 RPG" }).eq("id", userId);

    // Envio de email de adesão com idempotência separada do email genérico
    try {
      let emailMeta = null; let alreadySent = false;
      const metaResp = await sb.from("orders").select("customer_email,customer_name,total,vip_activation_email_sent_at").eq("id", order.id).maybeSingle();
      if (metaResp?.error && /vip_activation_email_sent_at/i.test(String(metaResp.error.message||""))) {
        const fallbackMeta = await sb.from("orders").select("customer_email,customer_name,total").eq("id", order.id).maybeSingle();
        emailMeta = fallbackMeta?.data || null;
      } else {
        emailMeta = metaResp?.data || null;
        alreadySent = Boolean(metaResp?.data?.vip_activation_email_sent_at);
      }
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
        const mail = renderVipWelcomeEmail({
          brandName: process.env.BRAND_NAME || "Cubo Criativo",
          orderId: order.id,
          customerName: emailMeta?.customer_name || order.customer_name || payment?.payer?.first_name || "cliente",
          reviewLink: baseUrl ? `${baseUrl}/#/conta` : "",
          supportEmail: process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || "",
          whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || "",
          vipPlanId: planId,
          total: Number(emailMeta?.total || order.total) || undefined,
          paymentMethod: "Pix",
        });
        const sendResp = await sendResendEmail({ to, subject: mail.subject, html: mail.html });
        if (sendResp?.ok) {
          await sb.from("orders").update({ vip_activation_email_sent_at: new Date().toISOString() }).eq("id", order.id);
        }
      }
    } catch (emailErr) {
      console.error("vip welcome email (pix verify) error", emailErr);
    }
  } catch (e) {
    console.error("pix-payment applyVipFromOrder error", e);
  }
}


async function applyStockDeductionIfNeeded(sb, order) {
  try {
    if (!order?.id) return;
    if (String(order.order_type || '').toLowerCase() === 'vip') return;
    const current = await sb.from('orders').select('stock_deducted_at,status').eq('id', order.id).maybeSingle();
    if (current?.data?.stock_deducted_at) return;
    let items = [];
    const qNew = await sb.from('order_items').select('product_id,qty').eq('order_id', order.id);
    if (qNew?.error) {
      const qOld = await sb.from('order_items').select('product_id,qty').eq('order_id', order.id);
      items = qOld?.data || [];
    } else items = qNew.data || [];
    const byPid = new Map();
    for (const it of items) {
      const pid = String(it?.product_id || '').trim(); if (!pid) continue;
      byPid.set(pid, (byPid.get(pid)||0) + (Number(it?.qty)||0));
    }
    for (const [pid, qty] of byPid) {
      if (qty <= 0) continue;
      const { data: prod } = await sb.from('products').select('stock').eq('id', pid).maybeSingle();
      if (!prod || prod.stock === null || prod.stock === undefined) continue;
      const next = Math.max(0, (Number(prod.stock)||0) - qty);
      await sb.from('products').update({ stock: next }).eq('id', pid);
    }
    await sb.from('orders').update({ stock_deducted_at: new Date().toISOString() }).eq('id', order.id).is('stock_deducted_at', null);
  } catch (e) { console.error('applyStockDeductionIfNeeded error', e); }
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
    .select("id,user_id,status,total,customer_email,customer_name,payment_provider,provider_payment_id,order_type,vip_plan_id")
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

  if (newStatus === "paid") { await applyVipFromOrder(sb, order, mp); await applyStockDeductionIfNeeded(sb, order); }
  if (newStatus === "failed") await revokeVipFromOrder(sb, order, "payment_failed");

  return res.status(200).json({ ok: true, order_id: orderId, mp_status: mpStatus, status: newStatus, paid: newStatus === "paid" });
}

export default async function handler(req, res) {
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
