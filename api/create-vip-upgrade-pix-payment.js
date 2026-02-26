/**
 * Vercel Serverless Function
 * Route: /api/create-vip-upgrade-pix-payment
 *
 * Cria um pagamento Pix apenas da DIFERENÇA entre o plano atual e o próximo plano.
 *
 * Env vars:
 * - MP_ACCESS_TOKEN
 * - MP_MODE (opcional)
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import crypto from 'crypto';
import { getUserFromAuthHeader, supabaseAdmin } from '../server/supabase.js';
import { listVipPlans } from '../server/vipPlans.js';

export const config = { runtime: 'nodejs' };

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function getBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findPlanByProfileValue(plans, profilePlan) {
  const q = normalizeText(profilePlan);
  if (!q) return null;
  return (plans || []).find((p) => {
    const candidates = [p?.id, p?.slug, p?.name, p?.short_name, p?.title].map(normalizeText);
    return candidates.some((c) => c && (c === q || q.includes(c) || c.includes(q)));
  }) || null;
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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

    const token = String(process.env.MP_ACCESS_TOKEN || '').trim();
    if (!token) return res.status(500).json({ error: 'Missing MP_ACCESS_TOKEN' });

    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para continuar.' });

    const sb = supabaseAdmin();
    const origin = String(process.env.APP_URL || '').trim() || getBaseUrl(req);

    const body = safeBody(req);
    const toPlanId = String(body?.to_plan_id || '').trim();
    if (!toPlanId) return res.status(400).json({ error: 'Plano de destino inválido.' });

    // Checa VIP ativo e pega plano atual
    const { data: prof } = await sb.from('profiles').select('vip_until,vip_plan,full_name,phone,cpf,birthdate,address_line1,address_number,neighborhood,city,state,zip').eq('id', user.id).maybeSingle();
    const vipUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
    if (!vipUntil || vipUntil <= Date.now()) {
      return res.status(403).json({ error: 'Você precisa estar com VIP ativo para fazer upgrade.' });
    }

    // Exige dados completos (mesma regra da assinatura)
    const requiredFields = ['full_name','phone','cpf','birthdate','address_line1','address_number','neighborhood','city','state','zip'];
    const missing = requiredFields.filter((k) => !String(prof?.[k] || '').trim());
    if (missing.length) {
      return res.status(400).json({ error: 'Profile incomplete', code: 'profile_incomplete', missing });
    }

    const plans = await listVipPlans(sb);
    const ordered = [...plans].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));

    // Preferência: plano atual pela assinatura ativa, se existir
    let currentPlanId = null;
    try {
      const { data: sub } = await sb
        .from('vip_subscriptions')
        .select('plan_id,ends_at,status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub?.plan_id) currentPlanId = String(sub.plan_id);
    } catch {}

    let currentPlan = (currentPlanId ? ordered.find((p) => String(p?.id) === currentPlanId) : null) || findPlanByProfileValue(ordered, prof?.vip_plan) || ordered[0];
    const toPlan = ordered.find((p) => String(p?.id) === String(toPlanId));
    if (!toPlan) return res.status(400).json({ error: 'Plano de destino não encontrado.' });

    const fromPrice = Number(currentPlan?.price_brl || 0);
    const toPrice = Number(toPlan?.price_brl || 0);
    const diff = Number((toPrice - fromPrice).toFixed(2));
    if (!Number.isFinite(diff) || diff <= 0) {
      return res.status(400).json({ error: 'Este upgrade não está disponível.' });
    }

    const orderId = crypto.randomUUID();

    // Cria order
    const { error: orderErr } = await sb.from('orders').insert({
      id: orderId,
      user_id: user.id,
      status: 'pending',
      currency: 'BRL',
      total: diff,
      payment_provider: 'mercado_pago',
      production_status: 'upgrade',
      order_type: 'vip_upgrade',
      vip_plan_id: toPlan.id,
      customer_email: String(user.email || '').trim(),
      customer_name: prof?.full_name || null,
      customer_phone: prof?.phone || null,
    });
    if (orderErr) {
      console.error('order insert error', orderErr);
      return res.status(500).json({ error: 'Não foi possível criar o pedido de upgrade.' });
    }

    const idempotencyKey = crypto.randomUUID();
    const paymentResp = await mpFetch(token, 'https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        transaction_amount: diff,
        description: `Upgrade VIP ${String(currentPlan?.short_name || currentPlan?.name || 'VIP')} → ${String(toPlan?.short_name || toPlan?.name || 'VIP')}`.slice(0, 120),
        payment_method_id: 'pix',
        payer: { email: String(user.email || '').trim() },
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          user_id: user.id,
          order_type: 'vip_upgrade',
          vip_plan_id: toPlan.id,
          vip_upgrade_from: currentPlan?.id || null,
          vip_upgrade_to: toPlan.id,
        },
        notification_url: `${origin}/api/mp-webhook`,
      }),
    });

    if (!paymentResp.ok) {
      console.error('mp create upgrade payment error', paymentResp.data);
      await sb.from('orders').update({ status: 'failed' }).eq('id', orderId);
      return res.status(paymentResp.status || 500).json({ error: 'Mercado Pago error' });
    }

    const payment = paymentResp.data || {};
    const tx = payment.point_of_interaction?.transaction_data || {};
    await sb.from('orders').update({ provider_payment_id: String(payment.id || '') }).eq('id', orderId);

    return res.status(200).json({
      order_id: orderId,
      id: String(payment.id || ''),
      status: payment.status,
      qr_code: tx.qr_code || null,
      qr_code_base64: tx.qr_code_base64 || null,
      ticket_url: tx.ticket_url || null,
    });
  } catch (e) {
    console.error('create-vip-upgrade-pix-payment error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
