import crypto from 'node:crypto';
import { getUserFromAuthHeader, supabaseAdmin } from '../supabase.js';
import { requireAdmin, ADMIN_LEVEL } from '../admin/adminAuth.js';
import { rateLimit } from '../rateLimit.js';
import {
  CUSTOM_BUCKET, CUSTOM_FORMATS, CUSTOM_MIMES, CUSTOM_PRODUCTION_STATES,
  evaluateCustomCoupon, resolveCustomPrice, safeCustomError, validateCustomFiles,
} from '../customMiniatures.js';

const REQUEST_TABLE = 'custom_miniature_requests';
const SETTINGS_TABLE = 'custom_miniature_settings';
const MAX_NOTES = 2000;

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
function pathOf(req) {
  // A operação fica no parâmetro "op" porque /api/core usa "action" para rotear.
  return String(req.query?.op || '').trim().toLowerCase();
}
function baseUrl(req) {
  const configured = String(process.env.SITE_URL || '').trim();
  if (configured && /^https:\/\//i.test(configured)) return configured.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^[\w.-]+(?::\d+)?$/.test(host)) throw new Error('SITE_URL não configurada corretamente.');
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}
function jsonError(res, status, message, code) {
  return res.status(status).json({ error: message, ...(code ? { code } : {}) });
}
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}
async function getSettings(sb) {
  const { data, error } = await sb.from(SETTINGS_TABLE)
    .select('bust_price_cents,miniature_price_cents,updated_at')
    .eq('id', 'default').single();
  if (error) throw new Error('Execute a migração SQL de miniaturas personalizadas no Supabase.');
  return data;
}
async function signedPreview(sb, rows) {
  return Promise.all(rows.map(async row => {
    const paths = Array.isArray(row.image_paths) ? row.image_paths : [];
    const { data, error } = paths.length
      ? await sb.storage.from(CUSTOM_BUCKET).createSignedUrls(paths, 3600)
      : { data: [], error: null };
    return {
      ...row,
      image_urls: error ? [] : (data || []).map(item => item.signedUrl || null),
      payment_payload: undefined, // nunca expor detalhes de pagamento em listagens
    };
  }));
}
async function verifyUploadedFiles(sb, row) {
  const paths = row.image_paths || [];
  if (!paths.length || paths.length > 6) return false;
  const prefix = `${row.user_id}/${row.id}/`;
  if (paths.some(path => !String(path).startsWith(prefix))) return false;
  const { data, error } = await sb.storage.from(CUSTOM_BUCKET)
    .list(`${row.user_id}/${row.id}`, { limit: 100 });
  if (error) throw error;
  const entries = new Map((data || []).map(item => [item.name, item]));
  return paths.every(path => {
    const file = entries.get(path.slice(prefix.length));
    if (!file || file.id === null) return false;
    const size = Number(file.metadata?.size);
    const mimetype = String(file.metadata?.mimetype || file.metadata?.contentType || '');
    return Number.isFinite(size) && size > 0 && size <= 10 * 1024 * 1024 &&
      Object.hasOwn(CUSTOM_MIMES, mimetype);
  });
}
async function createMercadoPagoPayment({ req, orderId, user, kind, method, totalCents, coupon }) {
  const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('Mercado Pago não está configurado.');
  const origin = baseUrl(req);
  const metadata = {
    order_id: orderId, order_type: 'custom_miniature', user_id: user.id,
    coupon_code: coupon.code || null,
    coupon_discount: coupon.discountCents / 100,
  };
  const common = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const title = CUSTOM_FORMATS[kind];
  let url, payload;
  if (method === 'card') {
    url = 'https://api.mercadopago.com/checkout/preferences';
    payload = {
      items: [{ id: 'custom-miniature', title, quantity: 1, unit_price: totalCents / 100, currency_id: 'BRL' }],
      payer: { email: user.email }, external_reference: orderId,
      notification_url: `${origin}/api/mp-webhook`,
      back_urls: {
        success: `${origin}/miniaturas-personalizadas?payment=success&provider=mercadopago&order_id=${orderId}`,
        pending: `${origin}/miniaturas-personalizadas?payment=pending&provider=mercadopago&order_id=${orderId}`,
        failure: `${origin}/miniaturas-personalizadas?payment=cancel&provider=mercadopago&order_id=${orderId}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'CUBOCRIATIVO', metadata,
    };
  } else {
    url = 'https://api.mercadopago.com/v1/payments';
    payload = {
      transaction_amount: totalCents / 100,
      description: `${title} - Cubo Criativo`,
      payment_method_id: 'pix', payer: { email: user.email },
      external_reference: orderId, metadata,
      notification_url: `${origin}/api/mp-webhook`,
    };
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...common, 'X-Idempotency-Key': orderId },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('custom-miniature Mercado Pago error', response.status, result);
    throw new Error('Não foi possível iniciar o pagamento. Confira suas informações ou tente novamente.');
  }
  if (method === 'card') {
    const checkoutUrl = String(result.init_point || '');
    if (!/^https:\/\/(?:www\.)?mercadopago\.com(?:\.br)?\//.test(checkoutUrl) &&
        !/^https:\/\/www\.mercadopago\.com\.(?:br|ar|mx|co)\//.test(checkoutUrl)) {
      throw new Error('O Mercado Pago não forneceu um link de pagamento válido.');
    }
    return { providerId: String(result.id || ''), checkout_url: checkoutUrl };
  }
  const tx = result.point_of_interaction?.transaction_data || {};
  if (!tx.qr_code || !result.id) throw new Error('Pix não gerou código de pagamento.');
  return {
    providerId: String(result.id),
    pix: {
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64 || '',
      ticket_url: tx.ticket_url || '',
      status: result.status || 'pending',
    },
  };
}

export default async function handleCustomMiniatures(req, res) {
  if (!rateLimit(req, res, { key: 'api:custom-miniatures', limit: 45, windowMs: 60000 })) return;
  const op = pathOf(req);
  try {
    if (req.method === 'GET' && op === 'config') {
      const settings = await getSettings(supabaseAdmin());
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ settings });
    }

    if (req.method === 'GET' && op === 'admin-list') {
      const admin = await requireAdmin(req, ADMIN_LEVEL.OPERATOR);
      if (!admin.ok) return jsonError(res, admin.status, admin.error);
      const sb = supabaseAdmin();
      const page = Math.max(1, Math.min(999, Math.trunc(Number(req.query?.page) || 1)));
      const pageSize = 25;
      const offset = (page - 1) * pageSize;
      const { data, error, count } = await sb.from(REQUEST_TABLE)
        .select('*', { count: 'exact' })
        .neq('payment_status', 'draft').neq('payment_status', 'processing')
        .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
      if (error) throw error;
      return res.status(200).json({
        requests: await signedPreview(sb, data || []),
        pagination: { page, pageSize, total: Number(count || 0),
          totalPages: Math.max(1, Math.ceil(Number(count || 0) / pageSize)) },
      });
    }

    const user = await getUserFromAuthHeader(req);
    if (!user) return jsonError(res, 401, 'Entre na sua conta para continuar.');
    const sb = supabaseAdmin();

    if (req.method === 'GET' && op === 'mine') {
      const { data, error } = await sb.from(REQUEST_TABLE).select('*')
        .eq('user_id', user.id).neq('payment_status', 'draft').neq('payment_status', 'processing')
        .order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return res.status(200).json({ requests: await signedPreview(sb, data || []) });
    }

    if (req.method !== 'POST') return jsonError(res, 405, 'Método não permitido.');
    const body = bodyOf(req);

    if (op === 'reopen-pix') {
      if (!isUuid(body.request_id)) return jsonError(res, 400, 'Pedido inválido.');
      const { data: request, error } = await sb.from(REQUEST_TABLE)
        .select('payment_status,payment_method,payment_payload,total_cents,order_id')
        .eq('id', body.request_id).eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!request || request.payment_method !== 'pix' || request.payment_status !== 'pending' ||
          !request.payment_payload?.qr_code) {
        return jsonError(res, 409, 'Não há um Pix pendente disponível para este pedido.');
      }
      return res.status(200).json({
        pix: request.payment_payload, order_id: request.order_id,
        total_cents: request.total_cents,
      });
    }

    if (op === 'save-settings') {
      const admin = await requireAdmin(req, ADMIN_LEVEL.MANAGER);
      if (!admin.ok) return jsonError(res, admin.status, admin.error);
      const bust = Number(body.bust_price_cents);
      const miniature = Number(body.miniature_price_cents);
      if (![bust, miniature].every(value => Number.isSafeInteger(value) && value >= 100 && value <= 100000000)) {
        return jsonError(res, 400, 'Informe valores válidos em centavos (mínimo R$ 1,00).');
      }
      const { data, error } = await sb.from(SETTINGS_TABLE).update({
        bust_price_cents: bust, miniature_price_cents: miniature, updated_at: new Date().toISOString(),
      }).eq('id', 'default').select('*').single();
      if (error) throw error;
      return res.status(200).json({ settings: data });
    }

    if (op === 'update-status') {
      const admin = await requireAdmin(req, ADMIN_LEVEL.OPERATOR);
      if (!admin.ok) return jsonError(res, admin.status, admin.error);
      if (!isUuid(body.id) || !CUSTOM_PRODUCTION_STATES.includes(body.production_status) || body.production_status === 'aguardando_pagamento') {
        return jsonError(res, 400, 'Atualização inválida.');
      }
      const { data: existing, error: readError } = await sb.from(REQUEST_TABLE)
        .select('order_id,payment_status').eq('id', body.id).single();
      if (readError) throw readError;
      if (existing.payment_status !== 'paid') return jsonError(res, 409, 'Só é possível iniciar a produção após a confirmação do pagamento.');
      const { error } = await sb.from(REQUEST_TABLE).update({
        production_status: body.production_status, updated_at: new Date().toISOString(),
      }).eq('id', body.id).eq('payment_status', 'paid');
      if (error) throw error;
      if (existing.order_id) {
        const { error: orderError } = await sb.from('orders').update({ production_status: body.production_status })
          .eq('id', existing.order_id);
        if (orderError) console.error('custom update order production sync', orderError);
      }
      return res.status(200).json({ ok: true });
    }

    const settings = await getSettings(sb);
    const kind = String(body.kind || '');
    const baseCents = resolveCustomPrice(settings, kind);
    if (!baseCents) return jsonError(res, 400, 'Selecione busto ou miniatura.');

    if (op === 'quote') {
      try {
        const coupon = await evaluateCustomCoupon(sb, {
          code: body.coupon_code, user, baseCents,
        });
        return res.status(200).json({
          base_cents: baseCents, discount_cents: coupon.discountCents,
          total_cents: baseCents - coupon.discountCents, coupon_label: coupon.label,
        });
      } catch (error) { return jsonError(res, 400, safeCustomError(error)); }
    }

    if (op === 'prepare') {
      const files = body.files;
      const fileError = validateCustomFiles(files);
      if (fileError) return jsonError(res, 400, fileError, 'images_required');
      const notes = String(body.notes || '').trim();
      if (notes.length > MAX_NOTES) return jsonError(res, 400, 'Descrição muito longa (até 2.000 caracteres).');
      const id = crypto.randomUUID();
      const paths = files.map(file => `${user.id}/${id}/${crypto.randomUUID()}.${CUSTOM_MIMES[file.type]}`);
      const names = files.map(file => String(file.name || 'referencia').replace(/[\u0000-\u001f]/g, '').slice(0, 120));
      const { error: insertError } = await sb.from(REQUEST_TABLE).insert({
        id, user_id: user.id, customer_email: user.email || '',
        kind, notes, image_paths: paths, image_names: names,
        payment_status: 'draft',
      });
      if (insertError) throw insertError;
      const slots = [];
      try {
        for (let i = 0; i < paths.length; i += 1) {
          const { data, error } = await sb.storage.from(CUSTOM_BUCKET).createSignedUploadUrl(paths[i]);
          if (error || !data?.token) throw error || new Error('Não foi possível preparar o envio das imagens.');
          slots.push({ path: paths[i], token: data.token });
        }
      } catch (error) {
        await sb.from(REQUEST_TABLE).delete().eq('id', id);
        throw error;
      }
      return res.status(200).json({ request_id: id, slots });
    }

    if (op === 'checkout') {
      if (!isUuid(body.request_id)) return jsonError(res, 400, 'Pedido inválido.');
      const method = String(body.payment_method || '').toLowerCase();
      if (!['pix','card'].includes(method)) return jsonError(res, 400, 'Escolha Pix ou cartão.');
      const { data: row, error: findError } = await sb.from(REQUEST_TABLE).select('*')
        .eq('id', body.request_id).eq('user_id', user.id).single();
      if (findError || !row) return jsonError(res, 404, 'Pedido não encontrado.');
      if (row.payment_status !== 'draft') return jsonError(res, 409, 'Este pedido já foi enviado para pagamento. Consulte seus pedidos.');
      if (row.kind !== kind) return jsonError(res, 400, 'Formato diferente do pedido preparado.');
      if (!(await verifyUploadedFiles(sb, row))) {
        return jsonError(res, 400, 'As imagens precisam ser enviadas e confirmadas antes do pagamento.', 'images_required');
      }
      let coupon;
      try {
        coupon = await evaluateCustomCoupon(sb, { code: body.coupon_code, user, baseCents });
      } catch (error) { return jsonError(res, 400, safeCustomError(error)); }
      const totalCents = baseCents - coupon.discountCents;
      if (totalCents < 1) return jsonError(res, 400, 'Valor final inválido.');
      // Preço sempre calculado no servidor, mas nunca cobramos um total
      // diferente do que foi confirmado pelo cliente na interface.
      if (Number(body.expected_total_cents) !== totalCents) {
        return res.status(409).json({
          error: 'O preço do pedido foi atualizado. Revise o valor e tente novamente.',
          code: 'price_changed',
        });
      }

      // Claim atômico; duas abas/requisições não criam cobranças duplicadas.
      const { data: claimed, error: claimError } = await sb.from(REQUEST_TABLE)
        .update({ payment_status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('user_id', user.id).eq('payment_status', 'draft')
        .select('id').maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return jsonError(res, 409, 'O pagamento deste pedido já está sendo processado.');

      let orderId = null;
      let gatewayInvoked = false;
      try {
        orderId = crypto.randomUUID();
        const { error: orderError } = await sb.from('orders').insert({
          id: orderId, user_id: user.id, status: 'pending', currency: 'BRL',
          total: totalCents / 100, payment_provider: 'mercadopago',
          order_type: 'shop', production_status: 'recebido',
          customer_email: user.email || null,
          coupon_code: coupon.code, coupon_discount: coupon.discountCents / 100,
        });
        if (orderError) throw orderError;

        // Best effort: permite também exibir a compra no histórico já existente.
        const { error: itemError } = await sb.from('order_items').insert({
          order_id: orderId, product_id: null, product_name: CUSTOM_FORMATS[kind],
          scale: '', qty: 1, unit_price_cents: totalCents, product_image_url: null,
        });
        if (itemError) {
          const { error: legacyItemError } = await sb.from('order_items').insert({
            order_id: orderId, product_id: null, name: CUSTOM_FORMATS[kind],
            scale: '', qty: 1, unit_price: totalCents / 100, img: null,
          });
          if (legacyItemError) console.error('custom order_items insert', itemError, legacyItemError);
        }

        // Vincula a solicitação ANTES da chamada ao Mercado Pago: o webhook
        // pode chegar antes da resposta HTTP do checkout.
        const { error: linkError } = await sb.from(REQUEST_TABLE).update({
          order_id: orderId, base_price_cents: baseCents,
          discount_cents: coupon.discountCents, total_cents: totalCents,
          coupon_code: coupon.code, payment_method: method,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id).eq('payment_status', 'processing');
        if (linkError) throw linkError;
        gatewayInvoked = true;
        const result = await createMercadoPagoPayment({
          req, orderId, user, kind, method, totalCents, coupon,
        });
        const paymentDetails = method === 'pix' ? (result.pix || {}) : {};
        const { error: customUpdateError } = await sb.from(REQUEST_TABLE).update({
          payment_status: 'pending', provider_payment_id: result.providerId,
          payment_payload: paymentDetails, updated_at: new Date().toISOString(),
        }).eq('id', row.id).eq('payment_status', 'processing');
        if (customUpdateError) throw customUpdateError;
        await sb.from('orders').update({ provider_payment_id: result.providerId }).eq('id', orderId);
        return res.status(200).json({
          ok: true, request_id: row.id, order_id: orderId,
          total_cents: totalCents, ...result,
        });
      } catch (error) {
        console.error('custom miniature checkout error', error);
        if (orderId) await sb.from('orders').update({ status: 'failed' }).eq('id', orderId);
        // Depois de iniciar a requisição ao Mercado Pago, nunca liberar novo
        // checkout automático, mesmo em erro de rede (resultado incerto).
        await sb.from(REQUEST_TABLE).update({
          payment_status: gatewayInvoked ? 'pending' : 'draft',
          ...(!gatewayInvoked ? { order_id: null } : {}),
          updated_at: new Date().toISOString(),
        }).eq('id', row.id).eq('payment_status', 'processing');
        return jsonError(res, 502, 'O pagamento não foi concluído. Confira seus pedidos antes de tentar novamente.');
      }
    }
    return jsonError(res, 404, 'Operação inválida.');
  } catch (error) {
    console.error('custom miniature api error', error);
    return jsonError(res, 500, 'Não foi possível processar a solicitação agora. Verifique a configuração e tente novamente.');
  }
}
