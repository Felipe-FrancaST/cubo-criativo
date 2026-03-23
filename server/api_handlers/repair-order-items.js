import { getUserFromAuthHeader, supabaseAdmin } from '../supabase.js';

export const config = { runtime: 'nodejs' };

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function normalizeItems(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((it) => ({
    product_id: String(it?.product_id || '').trim() || null,
    name: String(it?.name || it?.title || 'Item').trim(),
    qty: Math.max(1, Number(it?.qty || it?.quantity || 1) || 1),
    scale: String(it?.scale || it?.escala || '').trim() || null,
    img: String(it?.img || it?.image_url || it?.picture_url || '').trim() || null,
    unit_price_brl: Number(Number(it?.unit_price || it?.price || 0).toFixed(2)),
  })).filter((it) => it.name && it.qty > 0 && it.unit_price_brl >= 0);
}

async function insertOrderItemsWithFallback(sb, orderId, items) {
  const normalized = normalizeItems(items).map((it) => ({
    ...it,
    unit_price_cents: Math.round((Number(it.unit_price_brl || 0) || 0) * 100),
  }));

  if (!normalized.length) return { inserted: 0 };

  const payloadNew = normalized.map((it) => ({
    order_id: orderId,
    product_id: it.product_id,
    product_name: it.name,
    scale: it.scale,
    qty: it.qty,
    unit_price_cents: it.unit_price_cents,
    product_image_url: it.img,
  }));

  const attemptNew = await sb.from('order_items').insert(payloadNew);
  if (!attemptNew?.error) return { inserted: payloadNew.length };

  const payloadOld = normalized.map((it) => ({
    order_id: orderId,
    product_id: it.product_id,
    name: it.name,
    scale: it.scale,
    qty: it.qty,
    unit_price: it.unit_price_brl,
    img: it.img,
  }));
  const attemptOld = await sb.from('order_items').insert(payloadOld);
  if (attemptOld?.error) throw attemptOld.error;
  return { inserted: payloadOld.length };
}

async function fetchPaymentMetadata(paymentId) {
  const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token || !paymentId) return null;
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return null;
  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const body = safeBody(req);
    const orderId = String(body?.order_id || '').trim();
    if (!orderId) return res.status(400).json({ error: 'order_id obrigatório.' });

    const sb = supabaseAdmin();
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .select('id,user_id,provider_payment_id,status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order?.id) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (String(order.user_id || '') !== String(user.id || '')) return res.status(403).json({ error: 'Acesso negado.' });

    const countNew = await sb.from('order_items').select('order_id', { count: 'exact', head: true }).eq('order_id', orderId);
    const existingCount = Number(countNew?.count || 0) || 0;
    if (existingCount > 0) return res.status(200).json({ ok: true, repaired: false, count: existingCount });

    const payment = await fetchPaymentMetadata(order.provider_payment_id);
    const rawItems = JSON.parse(payment?.metadata?.items_json || '[]');
    const items = normalizeItems(rawItems);
    if (!items.length) {
      return res.status(200).json({ ok: true, repaired: false, count: 0, reason: 'Sem itens no metadata.' });
    }

    const result = await insertOrderItemsWithFallback(sb, orderId, items);
    return res.status(200).json({ ok: true, repaired: true, count: result.inserted || items.length });
  } catch (error) {
    console.error('repair-order-items error', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
}
