import { renderVipWelcomeEmail, renderVipUpgradeEmail } from "../server/emailTemplates.js";
import { getVipPlanById } from "../server/vipPlans.js";
import { applyStockDeductionWithClaim } from "../server/inventory.js";
/**
 * Vercel Serverless Function
 * Route: /api/mp-webhook
 *
 * Webhook do Mercado Pago.
 * - Busca o pagamento e, quando estiver APPROVED, envia email via Resend.
 * - Faz uma tentativa de idempotência marcando metadata.email_sent=1 no pagamento.
 *
 * Env vars (Vercel):
 * - MP_ACCESS_TOKEN=...
 * - RESEND_API_KEY=re_...
 * - RESEND_FROM="Sua Loja <onboarding@resend.dev>" (em teste) ou "Sua Loja <vendas@seudominio.com>" (domínio verificado)
 * - ORDER_EMAIL_TO=seuemail@...
 */

// IMPORTANT: usamos import dinâmico do Supabase para evitar crash em tempo de carga.
// Isso garante que qualquer erro (env faltando, bundling, etc.) caia no try/catch do handler
// e apareça nos logs do runtime da Vercel.

function fmtBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseEmailList(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[;,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidEmail(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  // Validação leve (suficiente para bloquear cpf/telefone/etc.)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Busca o email verdadeiro do usuário no Supabase Auth (admin API)
// Útil quando pedidos antigos ficaram com customer_email = CPF/telefone.
async function fetchAuthUserEmail(userId) {
  try {
    const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey || !userId) return null;

    const url = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
    });
    const data = await resp.json().catch(() => ({}));
    const email = String(data?.email || "").trim();
    return isValidEmail(email) ? email : null;
  } catch (e) {
    console.error("fetchAuthUserEmail error", e);
    return null;
  }
}

async function getSupabaseAdminSafe() {
  try {
    const mod = await import("../server/supabase.js");
    if (typeof mod?.supabaseAdmin !== "function") throw new Error("supabaseAdmin not found");
    return mod.supabaseAdmin();
  } catch (e) {
    console.error("supabase init error", e);
    return null;
  }
}

async function loadOrderSnapshot(sb, orderId) {
  if (!sb) return { order: null, profile: null, items: [] };
  const { data: order } = await sb
    .from("orders")
    .select(
      "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id"
    )
    .eq("id", orderId)
    .maybeSingle();

  let profile = null;
  if (order?.user_id) {
    const { data: p } = await sb
      .from("profiles")
      .select("full_name,phone,address_line1,address_line2,neighborhood,city,state,zip")
      .eq("id", order.user_id)
      .maybeSingle();
    profile = p || null;
  }

  // Itens: schema novo -> antigo
  let items = [];
  const attemptNew = await sb
    .from("order_items")
    .select("product_name,qty,unit_price_cents,scale,product_image_url")
    .eq("order_id", orderId);
  if (attemptNew?.error) {
    const attemptOld = await sb
      .from("order_items")
      .select("name,qty,unit_price,scale,img")
      .eq("order_id", orderId);
    items = (attemptOld?.data || []).map((it) => ({
      name: it.name,
      qty: Number(it.qty) || 1,
      scale: it.scale || null,
      unit_price_brl: Number(it.unit_price) || 0,
      img: it.img || null,
    }));
  } else {
    items = (attemptNew?.data || []).map((it) => ({
      name: it.product_name,
      qty: Number(it.qty) || 1,
      scale: it.scale || null,
      unit_price_brl: (Number(it.unit_price_cents) || 0) / 100,
      img: it.product_image_url || null,
    }));
  }

  return { order, profile, items };
}

async function revokeVipFromOrder(sb, { order, payment, reason = "payment_failed" }) {
  try {
    if (!sb) return;
    const orderType = String(order?.order_type || payment?.metadata?.order_type || '').trim().toLowerCase();
    if (orderType !== 'vip') return;
    const userId = order?.user_id || payment?.metadata?.user_id;
    if (!userId || !order?.id) return;
    const nowIso = new Date().toISOString();
    await sb.from('vip_subscriptions').update({ status: reason, ends_at: nowIso }).eq('order_id', order.id);
    const { data: others } = await sb.from('vip_subscriptions').select('id,ends_at,status').eq('user_id', userId).neq('order_id', order.id).eq('status','active');
    const hasOtherActive = Array.isArray(others) && others.some((r)=>{ const t = r?.ends_at ? new Date(r.ends_at).getTime() : 0; return Number.isFinite(t) && t > Date.now(); });
    if (!hasOtherActive) await sb.from('profiles').update({ vip_until: null, vip_plan: null, vip_cycle_key: null }).eq('id', userId);
  } catch (e) { console.error('revokeVipFromOrder error', e); }
}

async function sendVipActivationEmail(sb, { order, payment, forceTo } = {}) {
  try {
    if (!sb || !order?.id) return { ok: false, skipped: true, reason: 'missing_order' };
    const orderTypeNorm = String(order?.order_type || payment?.metadata?.order_type || '').trim().toLowerCase();
    const hasVipPlanId = Boolean(String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || '').trim());
    if (!(orderTypeNorm === 'vip' || hasVipPlanId)) return { ok: false, skipped: true, reason: 'not_vip' };

    let emailMeta = null; let alreadySent = false;
    const metaResp = await sb.from('orders').select('customer_email,customer_name,total,vip_activation_email_sent_at').eq('id', order.id).maybeSingle();
    if (metaResp?.error && /vip_activation_email_sent_at/i.test(String(metaResp.error.message||''))) {
      const fallbackMeta = await sb.from('orders').select('customer_email,customer_name,total').eq('id', order.id).maybeSingle();
      emailMeta = fallbackMeta?.data || null;
    } else {
      emailMeta = metaResp?.data || null;
      alreadySent = Boolean(metaResp?.data?.vip_activation_email_sent_at);
    }
    if (alreadySent) return { ok: true, skipped: true, reason: 'already_sent' };

    const userId = order?.user_id || payment?.metadata?.user_id || '';
    let to = String(forceTo || emailMeta?.customer_email || order?.customer_email || payment?.payer?.email || '').trim();
    if (!isValidEmail(to) && userId) {
      const authEmail = await fetchAuthUserEmail(userId);
      if (isValidEmail(authEmail)) {
        to = authEmail;
        try { await sb.from('orders').update({ customer_email: authEmail }).eq('id', order.id); } catch {}
      }
    }

    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || '').trim();
    const baseUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
    const planId = String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || 'CUBO_L1_RPG').trim();
    const purchasedCycleKey = String(payment?.metadata?.vip_cycle_key || '').trim() || null;
    if (!isValidEmail(to)) return { ok: false, skipped: true, reason: 'invalid_customer_email', to };
    if (!apiKey || !from) return { ok: false, skipped: true, reason: 'missing_resend_env', to };

    const vipPlan = await getVipPlanById(sb, planId);
    const mail = renderVipWelcomeEmail({
      brandName: process.env.BRAND_NAME || 'Cubo Criativo',
      orderId: order?.id,
      customerName: emailMeta?.customer_name || order?.customer_name || payment?.payer?.first_name || 'cliente',
      reviewLink: baseUrl ? `${baseUrl}/#/conta` : '',
      supportEmail: process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || '',
      whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || '',
      vipPlanId: planId,
      planName: vipPlan?.name || vipPlan?.short_name || planId,
      planDescription: vipPlan?.description || '',
      monthlyPrice: Number(vipPlan?.price_brl || 0) || Number(emailMeta?.total || order?.total) || undefined,
      miniaturesCount: Number(vipPlan?.miniatures_count || 0) || undefined,
      bossCount: Number(vipPlan?.boss_count || 0) || undefined,
      scale: vipPlan?.scale || '',
      recurrenceLabel: 'Mensal',
      benefits: [
        Number(vipPlan?.miniatures_count || 0) ? `${Number(vipPlan.miniatures_count)} miniatura${Number(vipPlan.miniatures_count) > 1 ? 's' : ''}${vipPlan?.scale ? ` em ${vipPlan.scale}` : ''}` : null,
        Number(vipPlan?.boss_count || 0) ? `${Number(vipPlan.boss_count)} boss incluso${Number(vipPlan.boss_count) > 1 ? 's' : ''}` : 'Escolha mensal de miniaturas pela Área VIP',
        'Acesso ao Cubo Game e benefícios exclusivos do clube',
      ].filter(Boolean),
      total: Number(emailMeta?.total || order?.total) || undefined,
      paymentMethod: String(payment?.payment_method_id || '').toLowerCase() === 'pix' ? 'Pix' : 'Mercado Pago',
    });
    const sendResp = await sendResendEmail({ apiKey, from, to: [to], subject: mail.subject, html: mail.html });
    if (sendResp?.ok) {
      try { await sb.from('orders').update({ vip_activation_email_sent_at: new Date().toISOString(), customer_email_sent_at: new Date().toISOString(), customer_email_error: null }).eq('id', order.id); } catch {}
      return { ...sendResp, to };
    }
    try { await sb.from('orders').update({ customer_email_error: `vip_activation_resend_${sendResp?.status || 0}:${JSON.stringify(sendResp?.data || {})}`.slice(0, 500) }).eq('id', order.id); } catch {}
    return { ...sendResp, to };
  } catch (mailErr) {
    console.error('sendVipActivationEmail error', mailErr);
    return { ok: false, status: 0, error: mailErr?.message || String(mailErr) };
  }
}


async function sendVipUpgradeEmail(sb, { order, payment, forceTo } = {}) {
  try {
    if (!sb || !order?.id) return { ok: false, skipped: true, reason: 'missing_order' };
    const orderTypeNorm = String(order?.order_type || payment?.metadata?.order_type || '').trim().toLowerCase();
    if (orderTypeNorm !== 'vip_upgrade') return { ok: false, skipped: true, reason: 'not_vip_upgrade' };

    const metaResp = await sb.from('orders').select('customer_email,customer_name,total,customer_email_sent_at').eq('id', order.id).maybeSingle();
    const emailMeta = metaResp?.data || null;
    if (emailMeta?.customer_email_sent_at) return { ok: true, skipped: true, reason: 'already_sent' };

    const userId = order?.user_id || payment?.metadata?.user_id || '';
    let to = String(forceTo || emailMeta?.customer_email || order?.customer_email || payment?.payer?.email || '').trim();
    if (!isValidEmail(to) && userId) {
      const authEmail = await fetchAuthUserEmail(userId);
      if (isValidEmail(authEmail)) {
        to = authEmail;
        try { await sb.from('orders').update({ customer_email: authEmail }).eq('id', order.id); } catch {}
      }
    }
    if (!isValidEmail(to)) return { ok: false, skipped: true, reason: 'missing_email' };

    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SUPPORT_EMAIL || '').trim();
    if (!apiKey || !from) return { ok: false, skipped: true, reason: 'missing_resend_env' };

    const toPlanId = String(order?.vip_plan_id || payment?.metadata?.vip_upgrade_to || payment?.metadata?.vip_plan_id || '').trim();
    const fromPlanId = String(payment?.metadata?.vip_upgrade_from || '').trim();
    const toPlan = await getVipPlanById(sb, toPlanId);
    let fromPlan = fromPlanId ? await getVipPlanById(sb, fromPlanId) : null;
    if (!fromPlan && userId) {
      try {
        const { data: sub } = await sb.from('vip_subscriptions').select('plan_id').eq('user_id', userId).eq('status', 'active').order('ends_at', { ascending: false }).limit(1).maybeSingle();
        if (sub?.plan_id && String(sub.plan_id) !== toPlanId) fromPlan = await getVipPlanById(sb, sub.plan_id);
      } catch {}
    }

    const baseUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
    const chargedNow = Number(emailMeta?.total || order?.total || 0) || undefined;
    const mail = renderVipUpgradeEmail({
      brandName: process.env.BRAND_NAME || 'Cubo Criativo',
      orderId: order.id,
      customerName: emailMeta?.customer_name || order?.customer_name || payment?.payer?.first_name || 'cliente',
      reviewLink: baseUrl ? `${baseUrl}/#/conta` : '',
      supportEmail: process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || '',
      whatsapp: process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || '',
      fromPlanName: fromPlan?.name || fromPlan?.short_name || fromPlanId || 'Plano atual',
      toPlanName: toPlan?.name || toPlan?.short_name || toPlanId || 'Novo plano VIP',
      fromPlanDescription: fromPlan?.description || '',
      toPlanDescription: toPlan?.description || '',
      amountCharged: chargedNow,
      previousPrice: Number(fromPlan?.price_brl || 0) || undefined,
      newPrice: Number(toPlan?.price_brl || 0) || undefined,
      miniaturesCount: Number(toPlan?.miniatures_count || 0) || undefined,
      bossCount: Number(toPlan?.boss_count || 0) || undefined,
      scale: toPlan?.scale || '',
      recurrenceLabel: 'Mensal',
      paymentMethod: String(payment?.payment_method_id || '').toLowerCase() === 'pix' ? 'Pix' : 'Mercado Pago',
      upgradeHighlights: [
        fromPlan?.name && toPlan?.name ? `Mudança de ${fromPlan.name} para ${toPlan.name}` : null,
        Number(toPlan?.miniatures_count || 0) ? `${Number(toPlan.miniatures_count)} miniatura${Number(toPlan.miniatures_count) > 1 ? 's' : ''}${toPlan?.scale ? ` em ${toPlan.scale}` : ''} por ciclo` : null,
        Number(toPlan?.boss_count || 0) ? `${Number(toPlan.boss_count)} boss incluso${Number(toPlan.boss_count) > 1 ? 's' : ''}` : 'Escolhas liberadas pela Área VIP',
        chargedNow ? `Cobrança atual do upgrade: ${chargedNow.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : null,
      ].filter(Boolean),
    });

    const sendResp = await sendResendEmail({ apiKey, from, to: [to], subject: mail.subject, html: mail.html });
    if (sendResp?.ok) {
      try { await sb.from('orders').update({ customer_email_sent_at: new Date().toISOString(), customer_email_error: null }).eq('id', order.id); } catch {}
      return { ...sendResp, to };
    }
    try { await sb.from('orders').update({ customer_email_error: `vip_upgrade_resend_${sendResp?.status || 0}:${JSON.stringify(sendResp?.data || {})}`.slice(0, 500) }).eq('id', order.id); } catch {}
    return { ...sendResp, to };
  } catch (mailErr) {
    console.error('sendVipUpgradeEmail error', mailErr);
    return { ok: false, status: 0, error: mailErr?.message || String(mailErr) };
  }
}

async function applyVipFromOrder(sb, { order, payment }) {
  try {
    if (!sb) return;
    const orderTypeNorm = String(order?.order_type || payment?.metadata?.order_type || '').trim().toLowerCase();
    const hasVipPlanId = Boolean(String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || '').trim());
    const looksVip = (orderTypeNorm === 'vip' || orderTypeNorm === 'vip_upgrade' || hasVipPlanId);
    if (!looksVip) return;
    const userId = order?.user_id || payment?.metadata?.user_id;
    if (!userId) return;
    const planId = String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || 'CUBO_L1_RPG').trim();
    const purchasedCycleKey = String(payment?.metadata?.vip_cycle_key || '').trim() || null;

    const { data: existing } = await sb.from('vip_subscriptions').select('id').eq('order_id', order.id).maybeSingle();
    const hasSubscription = Boolean(existing?.id);

    if (orderTypeNorm === 'vip') {
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (!hasSubscription) await sb.from('vip_subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        order_id: order.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'active',
      });

      const { data: prof } = await sb.from('profiles').select('vip_until,vip_cycle_key').eq('id', userId).maybeSingle();
      const currentUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
      const nextUntil = Math.max(currentUntil, end.getTime());
      const profilePatch = { vip_until: new Date(nextUntil).toISOString(), vip_plan: planId };
      if (purchasedCycleKey) profilePatch.vip_cycle_key = purchasedCycleKey;
      await sb.from('profiles').update(profilePatch).eq('id', userId);
    }

    if (orderTypeNorm === 'vip_upgrade') {
      try {
        await sb.from('vip_subscriptions').update({ plan_id: planId }).eq('user_id', userId).eq('status', 'active');
      } catch {}
      const upgradePatch = { vip_plan: planId };
      if (purchasedCycleKey) upgradePatch.vip_cycle_key = purchasedCycleKey;
      await sb.from('profiles').update(upgradePatch).eq('id', userId);
    }

    if (orderTypeNorm === 'vip') {
      await sendVipActivationEmail(sb, { order, payment });
    }

    if (orderTypeNorm === 'vip_upgrade') {
      await sendVipUpgradeEmail(sb, { order, payment });
    }
  } catch (e) {
    console.error('applyVipFromOrder error', e);
  }
}



async function consumeCouponForPaidOrder(sb, { order, payment }) {
  try {
    if (!sb || !order?.id) return;
    const couponCode = String(payment?.metadata?.coupon_code || '').trim().toUpperCase();
    const discountAmount = Number(payment?.metadata?.coupon_discount || 0);
    if (!couponCode) return;

    const existing = await sb
      .from('coupon_redemptions')
      .select('id')
      .eq('order_id', order.id)
      .eq('coupon_code', couponCode)
      .maybeSingle();
    if (existing?.data?.id) return;

    const { data: coupon } = await sb
      .from('coupons')
      .select('code,used_count,max_uses')
      .eq('code', couponCode)
      .maybeSingle();
    if (!coupon?.code) return;

    const nextUsed = (Number(coupon.used_count) || 0) + 1;
    const maxUses = Number(coupon.max_uses) || 1;
    if (nextUsed > maxUses) return;

    const red = await sb.from('coupon_redemptions').insert({
      coupon_code: couponCode,
      user_id: order.user_id || payment?.metadata?.user_id || null,
      order_id: order.id,
      discount_amount: discountAmount > 0 ? discountAmount : null,
    });
    if (red?.error) {
      console.error('coupon redemption insert error', red.error);
      return;
    }

    const upd = await sb.from('coupons').update({ used_count: nextUsed }).eq('code', couponCode);
    if (upd?.error) console.error('coupon use update error', upd.error);
  } catch (e) {
    console.error('consumeCouponForPaidOrder error', e);
  }
}

async function applyStockDeductionIfNeeded(sb, order) {
  try {
    await applyStockDeductionWithClaim(sb, order);
  } catch (e) {
    console.error('mp-webhook stock deduction error', e);
  }
}

function replyJson(res, code, payload) {
  try {
    if (typeof res?.status === "function" && typeof res?.json === "function") {
      return res.status(code).json(payload);
    }
  } catch {}
  try {
    res.statusCode = code;
    res.setHeader?.("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  } catch {}
}

function renderEmailLayout({ title, subtitle, contentHtml, badgeText }) {
  const badge = badgeText
    ? `<span style="display:inline-block;background:#34d399;color:#06101f;font-weight:700;border-radius:999px;padding:6px 10px;font-size:12px;">${escapeHtml(
        badgeText
      )}</span>`
    : "";

  return `
  <div style="background:#050a14;padding:28px 12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:680px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <div>
          <div style="color:#e2e8f0;font-weight:900;font-size:18px;letter-spacing:0.3px;">Cubo Criativo</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:2px;">${escapeHtml(subtitle || "")}</div>
        </div>
        ${badge}
      </div>

      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:18px;overflow:hidden;">
        <div style="padding:18px 18px 0 18px;">
          <h1 style="margin:0;color:#f8fafc;font-size:20px;line-height:1.2;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:18px;">
          ${contentHtml}
        </div>
      </div>

      <div style="color:#64748b;font-size:12px;margin-top:12px;">
        Este é um email automático do Cubo Criativo.
      </div>
    </div>
  </div>`;
}

function renderItemsTable(items) {
  if (!items?.length) {
    return `<div style="color:#cbd5e1;font-size:14px;">(Sem itens)</div>`;
  }

  const rows = items
    .map((it) => {
      const name = escapeHtml(it.name || "Produto");
      const qty = Number(it.qty) || 1;
      const scale = it.scale ? ` <span style="color:#94a3b8;font-size:12px;">(${escapeHtml(it.scale)})</span>` : "";
      const price = fmtBRL((Number(it.unit_price_brl) || 0) * qty);
      const img = it.img
        ? `<img src="${escapeHtml(it.img)}" alt="${name}" width="44" height="44" style="border-radius:10px;object-fit:cover;display:block;border:1px solid rgba(255,255,255,0.10);"/>`
        : `<div style="width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);"></div>`;

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:top;">${img}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:top;">
            <div style="color:#e2e8f0;font-weight:700;font-size:14px;">${name}${scale}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:3px;">Qtd: ${qty}</div>
          </td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="color:#f8fafc;font-weight:800;">${escapeHtml(price)}</div>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px;overflow:hidden;">
      <thead>
        <tr>
          <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:700;padding:10px;">Item</th>
          <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:700;padding:10px;">Descrição</th>
          <th style="text-align:right;color:#94a3b8;font-size:12px;font-weight:700;padding:10px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

async function mpFetch(token, url, opts = {}) {
  const resp = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}


function mapOrderStatus(mpStatus) {
  if (mpStatus === "approved") return "paid";
  if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded" || mpStatus === "charged_back")
    return "failed";
  return "pending";
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  try {
    // GET no navegador: não deve crashar (e MP não usa GET)
    if (req.method === "GET") {
      res.statusCode = 200;
      res.setHeader?.("Content-Type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }
    // Para qualquer método diferente de POST, apenas acknowledge
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true, ignored: "not_post" });
    }

    const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!token) {
      // responde 200 pra evitar retry infinito
      return res.status(200).json({ ok: true, ignored: "missing MP_ACCESS_TOKEN" });
    }

    const body = safeBody(req);
    // Formatos comuns:
    // { type: "payment", data: { id: "123" } }
    // { id: "123" }
    const paymentId = body?.data?.id || body?.id || null;

    if (!paymentId) {
      return res.status(200).json({ ok: true, ignored: "no payment id" });
    }

    const paymentResp = await mpFetch(
      token,
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`
    );

    if (!paymentResp.ok) {
      // acknowledge to avoid retries storm
      return res.status(200).json({ ok: true, ignored: "cannot fetch payment" });
    }

    const payment = paymentResp.data;
    const status = payment?.status;

    // Inicializa Supabase (best-effort). Se falhar, seguimos sem quebrar o webhook.
    const sb = await getSupabaseAdminSafe();

    // Atualiza pedido no Supabase (best-effort)
    const orderId = payment?.external_reference || payment?.metadata?.order_id || null;
    if (orderId) {
      try {
        if (sb) {
        const mapped = mapOrderStatus(status);
          // IMPORTANTE: não sobrescrever customer_email com NULL.
          // Alguns eventos do MP chegam sem payer.email; nesse caso mantemos o e-mail já salvo no pedido
          // (geralmente vindo do auth do Supabase).
          const updateData = {
            status: mapped,
            payment_provider: "mercado_pago",
            provider_payment_id: String(payment.id || ""),
          };

          const payerEmail = String(payment?.payer?.email || "").trim();
          if (payerEmail) updateData.customer_email = payerEmail;

          const payerName = payment?.payer?.first_name
            ? `${payment.payer.first_name || ""} ${payment.payer.last_name || ""}`.trim()
            : "";
          if (payerName) updateData.customer_name = payerName;

          const payerPhone = String(payment?.payer?.phone?.number || "").trim();
          if (payerPhone) updateData.customer_phone = payerPhone;

          await sb.from("orders").update(updateData).eq("id", orderId);

        // Se ainda não está aprovado, só atualiza e encerra (sem e-mail)
        if (mapped !== "paid") {
          if (mapped === "failed" && sb && orderId) {
            try { const snap = await loadOrderSnapshot(sb, orderId); await revokeVipFromOrder(sb, { order: snap?.order, payment, reason: 'payment_failed' }); } catch (e) { console.error('vip revoke on webhook non-paid error', e); }
          }
          return res.status(200).json({ ok: true, status, mapped });
        }
        }
      } catch (e) {
        console.error("supabase update order error", e);
      }
    }

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    const to = String(process.env.ORDER_EMAIL_TO || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();

    // Carrega snapshot do pedido (com itens e perfil), se possível.
    const { order, profile, items } = orderId && sb
      ? await loadOrderSnapshot(sb, orderId)
      : { order: null, profile: null, items: [] };

    // Se for assinatura VIP, marca VIP no perfil (best-effort)
    if (order && sb) {
      await applyVipFromOrder(sb, { order, payment });
      await consumeCouponForPaidOrder(sb, { order, payment });
      await applyStockDeductionIfNeeded(sb, order);
    }

    // Idempotência: preferimos confiar no nosso banco.
    // Se o Mercado Pago já tiver metadata.email_sent=1, mas no banco ainda não há registro de envio,
    // ainda tentamos enviar (isso resolve casos em que versões antigas marcaram email_sent sem realmente enviar).
    const alreadySent =
      payment?.metadata?.email_sent === 1 ||
      payment?.metadata?.email_sent === "1" ||
      payment?.metadata?.email_sent === true;

    const ownerAlreadyLogged = Boolean(order?.owner_email_sent_at);
    const customerAlreadyLogged = Boolean(order?.customer_email_sent_at);

    if (alreadySent && (ownerAlreadyLogged || customerAlreadyLogged)) {
      return res.status(200).json({ ok: true, status: "approved", email: "skipped" });
    }

    // Se faltar env do Resend, registra no pedido (não marca como enviado no MP)
    if (!apiKey || !to || !from) {
      if (orderId && sb) {
        const missing = [
          !apiKey ? "missing_RESEND_API_KEY" : null,
          !to ? "missing_ORDER_EMAIL_TO" : null,
          !from ? "missing_RESEND_FROM" : null,
        ].filter(Boolean);
        try {
          await sb
            .from("orders")
            .update({
              owner_email_sent_at: null,
              customer_email_sent_at: null,
              customer_email_error: missing.join(";") || "missing_resend_env",
              owner_email_error: missing.join(";") || "missing_resend_env",
            })
            .eq("id", orderId);
        } catch (e) {
          console.error("failed to write email env error", e);
        }
      }
      return res.status(200).json({ ok: true, status: "approved", email: "skipped (missing resend env)" });
    }

    // Fallback para itens via metadata (se o snapshot ainda não tiver itens)
    let fallbackItems = [];
    if (!items || items.length === 0) {
      try {
        const raw = JSON.parse(payment?.metadata?.items_json || "[]") || [];
        fallbackItems = raw.map((it) => ({
          name: it?.name || it?.nome || "Item",
          qty: Number(it?.qty) || 1,
          scale: it?.scale || it?.escala || null,
          unit_price_brl: Number(it?.price) || 0,
          img: it?.img || it?.image_url || null,
        }));
      } catch {
        fallbackItems = [];
      }
    }

    const normalizedItems = (items && items.length ? items : fallbackItems).filter(Boolean);

    const payerEmail = payment?.payer?.email || order?.customer_email || "";
    const totalBRL = ((order?.total ?? Number(payment?.transaction_amount ?? 0)) || 0);
    const orderCode = order?.id || orderId || payment?.external_reference || "-";

    let customerEmailRaw = String(order?.customer_email || payerEmail || "").trim();

    // Se o email estiver inválido (ex: CPF/telefone), tenta recuperar do Auth via user_id.
    // Isso resolve casos em que o front enviou CPF no campo email e o pedido ficou sem email válido.
    if (!isValidEmail(customerEmailRaw) && order?.user_id) {
      const authEmail = await fetchAuthUserEmail(order.user_id);
      if (authEmail) {
        customerEmailRaw = authEmail;
        // best-effort: atualiza o pedido com o email correto
        try {
          if (sb && orderId) {
            await sb.from("orders").update({ customer_email: authEmail }).eq("id", orderId);
          }
        } catch (e) {
          console.error("failed to backfill customer_email", e);
        }
      }
    }

    const customerEmailOk = isValidEmail(customerEmailRaw);
    const customerEmail = customerEmailOk ? customerEmailRaw : "";
    const orderTypeNorm = String(order?.order_type || payment?.metadata?.order_type || "").trim().toLowerCase();
    const prodStatusNorm = String(order?.production_status || "").trim().toLowerCase();
    const paymentDescNorm = String(payment?.description || "").trim().toLowerCase();
    // Blindagem extra: pedido VIP pode chegar sem snapshot completo em alguns eventos do MP.
    // Nesses casos, usamos múltiplos sinais para NÃO disparar email genérico de pedido confirmado ao cliente.
    const isVipOrder = (
      orderTypeNorm === "vip" ||
      Boolean(String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || "").trim()) ||
      prodStatusNorm === "editavel" ||
      paymentDescNorm.includes("assinatura cubo") ||
      paymentDescNorm.includes("cubo level 1")
    );
    if (isVipOrder) {
      try { console.log('[mp-webhook] VIP order detected, skipping generic customer confirmation email', { orderId, orderTypeNorm, prodStatusNorm }); } catch {}
    }
    const customerName = String(order?.customer_name || profile?.full_name || "").trim();
    const customerPhone = String(order?.customer_phone || profile?.phone || "").trim();

    const addressLines = [
      profile?.address_line1,
      profile?.address_line2,
      profile?.neighborhood,
      [profile?.city, profile?.state].filter(Boolean).join(" - "),
      profile?.zip,
    ]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    const addressText = addressLines.join("\n");

    const itemsTable = renderItemsTable(normalizedItems);

    const ownerContent = `
      <div style="display:grid;grid-template-columns:1fr;gap:12px;">
        <div style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:14px;">
          <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:6px;">Cliente</div>
          <div style="color:#f8fafc;font-size:14px;font-weight:800;">${escapeHtml(customerName || "(sem nome)")}</div>
          <div style="color:#cbd5e1;font-size:13px;margin-top:4px;">${escapeHtml(customerEmail || "(sem email)")}${customerPhone ? ` • ${escapeHtml(customerPhone)}` : ""}</div>
          ${addressText ? `<pre style="margin:10px 0 0 0;white-space:pre-wrap;color:#e2e8f0;font-size:13px;line-height:1.35;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px;">${escapeHtml(addressText)}</pre>` : ""}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <div style="flex:1;min-width:220px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px;">
            <div style="color:#94a3b8;font-size:12px;font-weight:700;">Pedido</div>
            <div style="color:#f8fafc;font-size:14px;font-weight:900;margin-top:2px;">${escapeHtml(orderCode)}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:6px;">Pagamento: Pix (Mercado Pago)</div>
          </div>
          <div style="flex:1;min-width:220px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px;text-align:right;">
            <div style="color:#94a3b8;font-size:12px;font-weight:700;">Total</div>
            <div style="color:#f8fafc;font-size:20px;font-weight:900;margin-top:2px;">${escapeHtml(fmtBRL(totalBRL))}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:6px;">Status: ${escapeHtml(order?.status || payment?.status || "approved")}</div>
          </div>
        </div>

        <div>
          <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:8px;">${isVipOrder ? 'Assinatura / detalhes' : 'Itens do pedido'}</div>
          ${isVipOrder
            ? `<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.20);border-radius:12px;padding:12px;color:#e9d5ff;font-size:13px;line-height:1.5;">
                <div style="font-weight:900;color:#f5f3ff;">Assinatura VIP • ${escapeHtml(String(order?.vip_plan_id || payment?.metadata?.vip_plan_id || 'CUBO_L1_RPG').replaceAll('_',' '))}</div>
                <div style="margin-top:6px;color:#ddd6fe;">Plano Cubo Level 1 RPG (mensalidade)</div>
                <ul style="margin:8px 0 0 18px;padding:0;">
                  <li>3 miniaturas 32mm em resina premium por mês</li>
                  <li>Cubo Game liberado diariamente</li>
                  <li>Cliente deve escolher 3 miniaturas na Área VIP</li>
                </ul>
              </div>`
            : itemsTable}
        </div>
      </div>
    `;

    const customerContent = `
      <div style="color:#cbd5e1;font-size:14px;line-height:1.5;">
        <p style="margin:0 0 10px 0;">Olá${customerName ? ` ${escapeHtml(customerName)}` : ""}! Seu pedido foi confirmado ✅</p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="color:#94a3b8;font-size:12px;font-weight:700;">Pedido</div>
              <div style="color:#f8fafc;font-size:14px;font-weight:900;">${escapeHtml(orderCode)}</div>
              <div style="color:#94a3b8;font-size:12px;margin-top:6px;">Status: ${escapeHtml(order?.production_status || "recebido")}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:#94a3b8;font-size:12px;font-weight:700;">Total</div>
              <div style="color:#f8fafc;font-size:18px;font-weight:900;">${escapeHtml(fmtBRL(totalBRL))}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:14px;">
          <div style="color:#94a3b8;font-size:12px;font-weight:700;margin-bottom:8px;">Itens</div>
          ${itemsTable}
        </div>

        <p style="margin:14px 0 0 0;color:#94a3b8;font-size:12px;">Você pode acompanhar o status em “Meus pedidos” no site.</p>
      </div>
    `;

    const ownerSubject = isVipOrder ? `Nova adesão VIP aprovada — ${escapeHtml(fmtBRL(totalBRL))} — ${customerEmail || "(sem email)"}` : `Novo pedido aprovado — ${escapeHtml(fmtBRL(totalBRL))} — ${customerEmail || "(sem email)"}`;
    const customerSubject = `Pedido confirmado — Cubo Criativo (${String(orderCode).slice(0, 8)})`;

    const ownerHtml = renderEmailLayout({
      title: isVipOrder ? "Nova adesão VIP confirmada" : "Novo pedido confirmado",
      subtitle: isVipOrder ? "Controle interno • Assinaturas" : "Controle interno • Produção",
      badgeText: isVipOrder ? "VIP PAGO" : "PAGO",
      contentHtml: ownerContent,
    });

    const customerHtml = renderEmailLayout({
      title: "Pedido confirmado",
      subtitle: "Obrigado pela compra!",
      badgeText: "CONFIRMADO",
      contentHtml: customerContent,
    });

    const ownerTo = parseEmailList(to);
    let ownerResp = { ok: false, status: 0, data: { error: "not_sent" } };
    let customerResp = { ok: true, skipped: true };
    let ownerErr = null;
    let customerErr = null;

    // Envia para você (admin) SEM depender do email do cliente
    try {
      ownerResp = await sendResendEmail({ apiKey, from, to: ownerTo, subject: ownerSubject, html: ownerHtml });
      if (!ownerResp.ok) ownerErr = `resend_${ownerResp.status}`;
    } catch (e) {
      ownerErr = e?.message || String(e);
    }

    // Envia para o cliente somente se email for válido e NÃO for assinatura VIP
    // (VIP recebe email de adesão/ativação em applyVipFromOrder)
    if (isVipOrder) {
      try {
        const vipResp = orderTypeNorm === 'vip_upgrade'
          ? await sendVipUpgradeEmail(sb, { order, payment, forceTo: customerEmailRaw })
          : await sendVipActivationEmail(sb, { order, payment, forceTo: customerEmailRaw });
        customerResp = vipResp?.ok ? { ok: true, vip: true, to: vipResp?.to } : (vipResp || { ok: false, vip: true, reason: orderTypeNorm === 'vip_upgrade' ? "vip_upgrade_failed" : "vip_activation_failed" });
        customerErr = vipResp?.ok || vipResp?.skipped ? null : (vipResp?.reason || vipResp?.error || `${orderTypeNorm === 'vip_upgrade' ? 'vip_upgrade' : 'vip_activation'}_resend_${vipResp?.status || 0}`);
      } catch (e) {
        customerResp = { ok: false, vip: true };
        customerErr = e?.message || String(e);
      }
    } else if (customerEmailOk) {
      try {
        customerResp = await sendResendEmail({ apiKey, from, to: [customerEmailRaw], subject: customerSubject, html: customerHtml });
        if (!customerResp.ok) customerErr = `resend_${customerResp.status}`;
      } catch (e) {
        customerErr = e?.message || String(e);
      }
    } else {
      customerErr = "missing_or_invalid_customer_email";
    }

    // Registra resultado no pedido (para debug)
    if (orderId && sb) {
      try {
        await sb
          .from("orders")
          .update({
            owner_email_sent_at: ownerResp.ok ? new Date().toISOString() : null,
            customer_email_sent_at: customerResp.ok ? new Date().toISOString() : null,
            customer_email_error: customerErr,
            owner_email_error: ownerErr,
          })
          .eq("id", orderId);
      } catch (e) {
        console.error("failed to write email send result", e);
      }
    }

    // Se falhou algum email, não marca idempotência no MP
    if (!ownerResp.ok || !customerResp.ok) {
      return res.status(200).json({
        ok: true,
        email: "error",
        owner: ownerResp.ok ? "sent" : ownerResp.data,
        customer: isVipOrder ? (customerResp.ok ? 'sent_vip' : (customerResp.reason || customerResp.error || customerResp.data || 'vip_error')) : (customerEmailOk ? (customerResp.ok ? 'sent' : customerResp.data) : 'skipped_invalid_email'),
      });
    }

    // Marca como enviado (best-effort)
    await mpFetch(
      token,
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          metadata: {
            ...(payment?.metadata || {}),
            email_sent: "1",
          },
        }),
      }
    );

    return res
      .status(200)
      .json({ ok: true, email: 'sent', owner: 'sent', customer: isVipOrder ? 'sent_vip' : (customerEmailOk ? 'sent' : 'skipped_invalid_email') });
  } catch (err) {
    console.error("mp-webhook error:", err);
    // Sempre 200 pra não gerar retry infinito
    return res.status(200).json({ ok: true, error: err?.message || String(err) });
  }
}
