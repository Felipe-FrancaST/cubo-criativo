import { getUserFromAuthHeader, supabaseAdmin } from '../server/supabase.js';
import { rateLimit } from '../server/rateLimit.js';
import {
  getVipPresentCycleKey,
  getVipPresentReward,
  getVipPresentCouponPayload,
  serializeVipPresentRoll,
} from '../server/vipPresent.js';

export const config = { runtime: 'nodejs' };

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  await new Promise((resolve) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', resolve);
    req.on('error', resolve);
  });
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

async function getVipState(sb, userId) {
  const { data, error } = await sb.from('profiles').select('vip_until,vip_plan').eq('id', userId).maybeSingle();
  if (error) throw error;
  const vipUntil = data?.vip_until ? new Date(data.vip_until) : null;
  const isVip = Boolean(vipUntil && vipUntil.getTime() > Date.now());
  return { isVip, vip_until: data?.vip_until || null, vip_plan: data?.vip_plan || null };
}

async function getRollRow(sb, { userId, cycleKey }) {
  const { data, error } = await sb
    .from('vip_present_rolls')
    .select('id,user_id,cycle_key,roll_value,reward_kind,reward_label,coupon_code,claim_status,claimed_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('cycle_key', cycleKey)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '');
    if (/relation|does not exist|not exist/i.test(msg)) {
      const e = new Error('Tabela public.vip_present_rolls não encontrada. Rode o SQL da nova rolagem VIP.');
      e.status = 503;
      throw e;
    }
    throw error;
  }

  return data || null;
}

async function getCouponRow(sb, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const { data } = await sb
    .from('coupons')
    .select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses')
    .eq('code', normalized)
    .maybeSingle();
  return data || null;
}

async function handleStatus(req, res, user) {
  const sb = supabaseAdmin();
  const vip = await getVipState(sb, user.id);
  const cycleKey = getVipPresentCycleKey();
  const row = await getRollRow(sb, { userId: user.id, cycleKey }).catch((error) => {
    throw error;
  });
  const coupon = row?.coupon_code ? await getCouponRow(sb, row.coupon_code) : null;
  return res.status(200).json({
    ok: true,
    cycle_key: cycleKey,
    vip,
    can_roll: vip.isVip && !row,
    roll: serializeVipPresentRoll(row, coupon),
  });
}

async function createVipRoll(sb, { userId, cycleKey }) {
  const rollValue = Math.floor(Math.random() * 20) + 1;
  const reward = getVipPresentReward(rollValue);
  let couponCode = null;

  if (reward.kind === 'coupon') {
    let couponPayload = getVipPresentCouponPayload({ userId, cycleKey, rollValue, reward });
    let created = null;
    for (let i = 0; i < 5; i += 1) {
      let attempt = await sb.from('coupons').insert(couponPayload).select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses').maybeSingle();
      if (attempt?.error && /metadata|column/i.test(String(attempt.error.message || ''))) {
        const { metadata, ...fallbackPayload } = couponPayload;
        attempt = await sb.from('coupons').insert(fallbackPayload).select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses').maybeSingle();
      }
      if (!attempt.error && attempt.data) {
        created = attempt.data;
        couponCode = created.code;
        break;
      }
      couponPayload = getVipPresentCouponPayload({ userId, cycleKey, rollValue, reward });
    }
    if (!created) {
      const e = new Error('Não foi possível gerar o cupom do presente VIP.');
      e.status = 500;
      throw e;
    }
  }

  const insertPayload = {
    user_id: userId,
    cycle_key: cycleKey,
    roll_value: rollValue,
    reward_kind: reward.kind,
    reward_label: reward.label,
    coupon_code: couponCode,
    claim_status: reward.kind === 'prize' ? 'available' : null,
  };

  const { data, error } = await sb
    .from('vip_present_rolls')
    .insert(insertPayload)
    .select('id,user_id,cycle_key,roll_value,reward_kind,reward_label,coupon_code,claim_status,claimed_at,created_at,updated_at')
    .single();

  if (error) {
    const msg = String(error.message || '');
    if (/duplicate key|unique/i.test(msg)) {
      const existing = await getRollRow(sb, { userId, cycleKey });
      const existingCoupon = existing?.coupon_code ? await getCouponRow(sb, existing.coupon_code) : null;
      return { alreadyRolled: true, row: existing, coupon: existingCoupon };
    }
    if (/relation|does not exist|not exist/i.test(msg)) {
      const e = new Error('Tabela public.vip_present_rolls não encontrada. Rode o SQL da nova rolagem VIP.');
      e.status = 503;
      throw e;
    }
    throw error;
  }

  const coupon = couponCode ? await getCouponRow(sb, couponCode) : null;
  return { alreadyRolled: false, row: data, coupon };
}

async function handleRoll(req, res, user) {
  const sb = supabaseAdmin();
  const vip = await getVipState(sb, user.id);
  if (!vip.isVip) return res.status(403).json({ error: 'A rolagem mensal está disponível apenas para assinantes VIP ativos.' });

  const cycleKey = getVipPresentCycleKey();
  const existing = await getRollRow(sb, { userId: user.id, cycleKey });
  if (existing) {
    const coupon = existing?.coupon_code ? await getCouponRow(sb, existing.coupon_code) : null;
    return res.status(200).json({ ok: true, already_rolled: true, cycle_key: cycleKey, roll: serializeVipPresentRoll(existing, coupon) });
  }

  const created = await createVipRoll(sb, { userId: user.id, cycleKey });
  return res.status(200).json({
    ok: true,
    already_rolled: Boolean(created.alreadyRolled),
    cycle_key: cycleKey,
    roll: serializeVipPresentRoll(created.row, created.coupon),
  });
}

async function handleClaim(req, res, user) {
  const sb = supabaseAdmin();
  const vip = await getVipState(sb, user.id);
  if (!vip.isVip) return res.status(403).json({ error: 'Seu plano VIP não está ativo.' });
  const cycleKey = getVipPresentCycleKey();
  const row = await getRollRow(sb, { userId: user.id, cycleKey });
  if (!row) return res.status(404).json({ error: 'Você ainda não fez a rolagem deste ciclo.' });
  if (Number(row.roll_value) !== 20) return res.status(400).json({ error: 'A solicitação de prêmio só fica disponível quando o resultado é 20.' });
  if (row.claimed_at || ['requested', 'contacting', 'resolved'].includes(String(row.claim_status || '').toLowerCase())) {
    return res.status(200).json({ ok: true, already_requested: true, message: 'Já recebemos sua solicitação. Entraremos em contato com você, aguarde.' });
  }

  const { error } = await sb
    .from('vip_present_rolls')
    .update({ claim_status: 'requested', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) throw error;

  return res.status(200).json({ ok: true, message: 'Entraremos em contato com você, aguarde.' });
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:vip-present', limit: 40, windowMs: 60000 })) return;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para acessar o presente VIP.' });

    const action = String(req.query?.action || (req.method === 'GET' ? 'status' : '')).trim().toLowerCase();
    if (req.method === 'GET' && action === 'status') return handleStatus(req, res, user);
    if (req.method === 'POST' && action === 'roll') return handleRoll(req, res, user);
    if (req.method === 'POST' && action === 'claim') {
      await readJsonBody(req);
      return handleClaim(req, res, user);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.message || 'Falha ao processar o presente VIP.' });
  }
}
