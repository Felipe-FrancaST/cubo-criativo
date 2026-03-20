import crypto from 'crypto';
import { supabaseAdmin } from '../server/supabase.js';
import { buildControlNumber, buildManualPaymentLink, verifyManualOrderSignature } from '../server/manualOrder.js';
import { rateLimit } from '../server/rateLimit.js';

export const config = { runtime: 'nodejs' };

function getBaseUrl(req) {
  const site = String(process.env.SITE_URL || process.env.APP_URL || '').trim();
  if (site) return site.replace(/\/$/, '');
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

async function readJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function mpFetch(token, url, opts = {}) {
  const resp = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

function mapOrderStatus(mpStatus) {
  const s = String(mpStatus || '').toLowerCase();
  if (['approved','authorized'].includes(s)) return 'paid';
  if (['pending','in_process','in_mediation'].includes(s)) return 'pending';
  if (['rejected','cancelled','refunded','charged_back'].includes(s)) return 'failed';
  return 'pending';
}

async function loadManualOrder({ orderId, sig }) {
  if (!orderId) throw new Error('Pedido inválido.');
  if (!verifyManualOrderSignature(orderId, sig)) {
    const err = new Error('Link de pagamento inválido.');
    err.status = 403;
    throw err;
  }
  const sb = supabaseAdmin();
  const { data: order, error } = await sb.from('orders').select('id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,order_type').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order) {
    const err = new Error('Pedido não encontrado.');
    err.status = 404;
    throw err;
  }
  const { data: items } = await sb.from('order_items').select('id,product_id,name,qty,scale,unit_price').eq('order_id', orderId).order('id');
  return { sb, order, items: Array.isArray(items) ? items : [] };
}

function serializePublic(order, items, baseUrl) {
  return {
    order_id: order.id,
    order_number: buildControlNumber(order.id),
    status: order.status,
    production_status: order.production_status,
    total: Number(order.total || 0),
    customer_name: order.customer_name || '',
    customer_email: order.customer_email || '',
    payment_link: buildManualPaymentLink({ baseUrl, orderId: order.id }),
    items: (items || []).map((it) => ({
      id: it.id,
      name: it.name || 'Item',
      qty: Number(it.qty || 1),
      scale: it.scale || '',
      unit_price: Number(it.unit_price || 0),
    })),
  };
}

async function handleGet(req, res) {
  try {
    const orderId = String(req.query?.order || '').trim();
    const sig = String(req.query?.sig || '').trim();
    const { order, items } = await loadManualOrder({ orderId, sig });
    if (String(order.status || '').toLowerCase() === 'paid' && String(order.production_status || '').toLowerCase() !== 'recebido') {
      await supabaseAdmin().from('orders').update({ production_status: 'recebido' }).eq('id', order.id);
      order.production_status = 'recebido';
    }
    return res.status(200).json({ ok: true, order: serializePublic(order, items, getBaseUrl(req)), account_email: order.customer_email || '', account_password_hint: 'CPF do cliente' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}

async function createPixPayment(req, res) {
  const body = await readJsonBody(req);
  const orderId = String(body.order || '').trim();
  const sig = String(body.sig || '').trim();
  const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token) return res.status(500).json({ error: 'Missing MP_ACCESS_TOKEN' });
  try {
    const { sb, order, items } = await loadManualOrder({ orderId, sig });
    if (String(order.status || '').toLowerCase() === 'paid') {
      return res.status(200).json({ ok: true, already_paid: true, status: 'paid' });
    }
    const paymentResp = await mpFetch(token, 'https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        transaction_amount: Number(order.total || 0),
        description: `Pedido Cubo Criativo #${buildControlNumber(order.id)}`.slice(0, 120),
        payment_method_id: 'pix',
        payer: { email: String(order.customer_email || '').trim() },
        external_reference: order.id,
        metadata: {
          order_id: order.id,
          order_type: order.order_type || 'shop',
          source: 'admin_manual_order',
        },
        notification_url: `${getBaseUrl(req)}/api/mp-webhook`,
      }),
    });
    if (!paymentResp.ok) return res.status(paymentResp.status || 500).json({ error: paymentResp.data || { message: 'Mercado Pago error' } });
    const mp = paymentResp.data || {};
    const tx = mp.point_of_interaction?.transaction_data || {};
    await sb.from('orders').update({ status: mapOrderStatus(mp.status), payment_provider: 'mercado_pago', provider_payment_id: String(mp.id || '') }).eq('id', order.id);
    return res.status(200).json({ ok: true, order: serializePublic(order, items, getBaseUrl(req)), provider_payment_id: String(mp.id || ''), qr_code: tx.qr_code || null, qr_code_base64: tx.qr_code_base64 || null, ticket_url: tx.ticket_url || null, status: mapOrderStatus(mp.status) });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}

async function createCardCheckout(req, res) {
  const body = await readJsonBody(req);
  const orderId = String(body.order || '').trim();
  const sig = String(body.sig || '').trim();
  const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token) return res.status(500).json({ error: 'Missing MP_ACCESS_TOKEN' });
  try {
    const { sb, order, items } = await loadManualOrder({ orderId, sig });
    if (String(order.status || '').toLowerCase() === 'paid') {
      return res.status(200).json({ ok: true, already_paid: true, status: 'paid' });
    }
    const baseUrl = getBaseUrl(req);
    const prefResp = await mpFetch(token, 'https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          id: order.id,
          title: `Pedido Cubo Criativo #${buildControlNumber(order.id)}`,
          quantity: 1,
          unit_price: Number(order.total || 0),
          currency_id: 'BRL',
        }],
        payer: { email: String(order.customer_email || '').trim(), name: String(order.customer_name || '').trim() || undefined },
        external_reference: order.id,
        notification_url: `${baseUrl}/api/mp-webhook`,
        back_urls: {
          success: `${baseUrl}/pagamento-pedido?order=${encodeURIComponent(order.id)}&sig=${encodeURIComponent(sig)}&payment=success`,
          pending: `${baseUrl}/pagamento-pedido?order=${encodeURIComponent(order.id)}&sig=${encodeURIComponent(sig)}&payment=pending`,
          failure: `${baseUrl}/pagamento-pedido?order=${encodeURIComponent(order.id)}&sig=${encodeURIComponent(sig)}&payment=cancel`,
        },
        auto_return: 'approved',
        metadata: {
          order_id: order.id,
          order_type: order.order_type || 'shop',
          source: 'admin_manual_order',
        },
      }),
    });
    if (!prefResp.ok) return res.status(prefResp.status || 500).json({ error: prefResp.data || { message: 'Mercado Pago error' } });
    const pref = prefResp.data || {};
    await sb.from('orders').update({ status: 'pending', payment_provider: 'mercado_pago', provider_payment_id: String(pref.id || '') }).eq('id', order.id);
    return res.status(200).json({ ok: true, init_point: pref.init_point || pref.sandbox_init_point || null, order: serializePublic(order, items, baseUrl) });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}

async function verifyStatus(req, res) {
  const body = await readJsonBody(req);
  const orderId = String(body.order || '').trim();
  const sig = String(body.sig || '').trim();
  const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token) return res.status(500).json({ error: 'Missing MP_ACCESS_TOKEN' });
  try {
    const { sb, order, items } = await loadManualOrder({ orderId, sig });
    const paymentId = String(order.provider_payment_id || '').trim();
    if (paymentId) {
      const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
      if (paymentResp.ok) {
        const mp = paymentResp.data || {};
        const newStatus = mapOrderStatus(mp.status);
        const patch = { status: newStatus };
        if (newStatus === 'paid') patch.production_status = 'recebido';
        await sb.from('orders').update(patch).eq('id', order.id);
        order.status = newStatus;
        if (patch.production_status) order.production_status = patch.production_status;
      }
    }
    return res.status(200).json({ ok: true, status: order.status, order: serializePublic(order, items, getBaseUrl(req)), paid: String(order.status || '').toLowerCase() === 'paid', account_email: order.customer_email || '', account_password_hint: 'CPF do cliente' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:manual-order-payment', limit: 60, windowMs: 60000 })) return;
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const action = String(req.query?.action || '').trim().toLowerCase();
  if (action === 'create-pix') return createPixPayment(req, res);
  if (action === 'create-card') return createCardCheckout(req, res);
  if (action === 'status') return verifyStatus(req, res);
  return res.status(400).json({ error: 'Ação inválida.' });
}
