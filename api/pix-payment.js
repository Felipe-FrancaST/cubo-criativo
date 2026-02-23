import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";

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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

function mapOrderStatus(mpStatus) {
  if (mpStatus === "approved") return "paid";
  if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded" || mpStatus === "charged_back") return "failed";
  return "pending";
}

async function applyVipFromOrder(sb, order) {
  try {
    if (!order || String(order.order_type || '').toLowerCase() !== 'vip') return;
    const userId = order.user_id;
    if (!userId) return;
    const planId = String(order.vip_plan_id || 'CUBO_L1_RPG');

    const { data: existing } = await sb.from('vip_subscriptions').select('id').eq('order_id', order.id).maybeSingle();
    if (existing?.id) return;

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    await sb.from('vip_subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      order_id: order.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'active',
    });

    const { data: prof } = await sb.from('profiles').select('vip_until').eq('id', userId).maybeSingle();
    const currentUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
    const nextUntil = Math.max(currentUntil, end.getTime());
    await sb.from('profiles').update({ vip_until: new Date(nextUntil).toISOString(), vip_plan: 'Cubo Level 1 RPG' }).eq('id', userId);
  } catch (e) {
    console.error('pix-payment applyVipFromOrder error', e);
  }
}

async function loadUserAndOrder(req, res, purposeText) {
  const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!token) {
    res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });
    return {};
  }
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: `Faça login para ${purposeText}.` });
    return {};
  }
  const body = safeBody(req);
  const orderId = String(body.order_id || "").trim();
  if (!orderId) {
    res.status(400).json({ error: "Missing order_id" });
    return {};
  }
  const sb = supabaseAdmin();
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id,user_id,status,payment_provider,provider_payment_id,order_type,vip_plan_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) {
    res.status(500).json({ error: "Supabase error", details: orderErr });
    return {};
  }
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return {};
  }
  if (order.user_id !== user.id) {
    res.status(403).json({ error: "Sem permissão para este pedido" });
    return {};
  }
  const paymentId = String(order.provider_payment_id || "").trim();
  if (!paymentId) {
    res.status(400).json({ error: "Pedido sem provider_payment_id (Pix não associado)" });
    return {};
  }
  return { token, user, sb, order, orderId, paymentId };
}

async function handleGet(req, res) {
  const ctx = await loadUserAndOrder(req, res, "ver o Pix");
  if (!ctx.orderId) return;
  const { token, sb, orderId, paymentId } = ctx;
  const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
  if (!paymentResp.ok) return res.status(paymentResp.status || 500).json({ error: paymentResp.data || { message: "Mercado Pago error" } });
  const mp = paymentResp.data || {};
  const mpStatus = String(mp.status || "");
  const mapped = mapOrderStatus(mpStatus);
  try {
    await sb.from("orders").update({ status: mapped, payment_provider: "mercado_pago", provider_payment_id: String(mp.id || paymentId) }).eq("id", orderId);
  } catch {}
  const tx = mp.point_of_interaction?.transaction_data || {};
  return res.status(200).json({
    ok: true,
    order_id: orderId,
    mp_status: mpStatus,
    status: mapped,
    qr_code: tx.qr_code || null,
    qr_code_base64: tx.qr_code_base64 || null,
    ticket_url: tx.ticket_url || null,
  });
}

async function handleVerify(req, res) {
  const ctx = await loadUserAndOrder(req, res, "verificar o Pix");
  if (!ctx.orderId) return;
  const { token, sb, orderId, paymentId } = ctx;
  const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
  if (!paymentResp.ok) return res.status(paymentResp.status || 500).json({ error: paymentResp.data || { message: "Mercado Pago error" } });
  const mp = paymentResp.data || {};
  const mpStatus = String(mp.status || "");
  const newStatus = mapOrderStatus(mpStatus);
  await sb.from("orders").update({
    status: newStatus,
    payment_provider: "mercado_pago",
    provider_payment_id: String(mp.id || paymentId),
    customer_email: mp?.payer?.email || null,
  }).eq("id", orderId);
  if (newStatus === "paid") await applyVipFromOrder(sb, ctx.order);
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
