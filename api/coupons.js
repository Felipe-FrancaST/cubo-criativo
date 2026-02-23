import { getUserFromAuthHeader, supabaseAdmin } from '../server/supabase.js';
import { getGamePeriodInfo, makeCouponCode, calcCouponDiscount } from '../server/couponGame.js';

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}


function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

async function getUserCpf(sb, userId) {
  const { data } = await sb.from("profiles").select("cpf").eq("id", userId).maybeSingle();
  return normalizeCpf(data?.cpf);
}

async function couponAlreadyUsedByCpf(sb, { couponCode, cpf }) {
  const normalized = normalizeCpf(cpf);
  if (!couponCode || !normalized) return false;
  const { data: reds } = await sb.from("coupon_redemptions").select("user_id").eq("coupon_code", couponCode);
  const ids = [...new Set((reds || []).map((r) => r.user_id).filter(Boolean))];
  if (!ids.length) return false;
  const { data: profs } = await sb.from("profiles").select("id,cpf").in("id", ids);
  return (profs || []).some((p) => normalizeCpf(p.cpf) === normalized);
}

async function ensureCouponCpfAllowed(sb, { coupon, currentUser }) {
  const currentCpf = await getUserCpf(sb, currentUser.id);
  if (!currentCpf) return { ok: false, status: 400, error: "Complete seu CPF no perfil para usar cupom." };

  if (coupon.user_id) {
    const ownerCpf = await getUserCpf(sb, coupon.user_id);
    if (ownerCpf && ownerCpf !== currentCpf) {
      return { ok: false, status: 403, error: "Esse cupom pertence a outro CPF." };
    }
  }

  const alreadyUsedByCpf = await couponAlreadyUsedByCpf(sb, { couponCode: coupon.code, cpf: currentCpf });
  if (alreadyUsedByCpf) {
    return { ok: false, status: 400, error: "Este cupom já foi utilizado por este CPF." };
  }

  return { ok: true, currentCpf };
}

async function getVipInfo(sb, userId) {
  const { data } = await sb.from('profiles').select('vip_until,vip_plan').eq('id', userId).maybeSingle();
  const until = data?.vip_until ? new Date(data.vip_until) : null;
  const isVip = Boolean(until && until.getTime() > Date.now());
  return { isVip, vip_until: data?.vip_until || null, vip_plan: data?.vip_plan || null };
}

async function handleGameStatus(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Faça login para jogar.' });
  const sb = supabaseAdmin();
  const vip = await getVipInfo(sb, user.id);
  const period = getGamePeriodInfo({ isVip: vip.isVip });

  const { data: session } = await sb
    .from('coupon_game_sessions')
    .select('id, won, coupon_code, played_at, period_key, week_key')
    .eq('user_id', user.id)
    .eq('period_key', period.period_key)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let coupon = null;
  if (session?.coupon_code) {
    const { data } = await sb
      .from('coupons')
      .select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses')
      .eq('code', session.coupon_code)
      .maybeSingle();
    coupon = data || null;
  }

  return res.status(200).json({
    can_play: !session,
    played: !!session,
    session: session || null,
    weekly_reward: period.weekly_reward,
    period_key: period.period_key,
    vip,
    coupon,
  });
}

async function handleGameComplete(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Faça login para jogar.' });
  const sb = supabaseAdmin();
  const body = safeBody(req);
  const won = !!body.won;
  const score = Number(body.score || 0);
  const attempts = Number(body.attempts || 0);
  const duration_ms = Number(body.duration_ms || 0);
  const vip = await getVipInfo(sb, user.id);
  const period = getGamePeriodInfo({ isVip: vip.isVip });

  const { data: existing } = await sb
    .from('coupon_game_sessions')
    .select('id, coupon_code, won')
    .eq('user_id', user.id)
    .eq('period_key', period.period_key)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ already_played: true, session: existing, weekly_reward: period.weekly_reward, period_key: period.period_key, vip });
  }

  let couponRow = null;
  let couponCode = null;
  if (won) {
    const perfectGame = score >= 1000;
    const reward = perfectGame
      ? { label: '20% OFF (Cubo Game Perfeito)', type: 'percent', percent_off: 20, min_order_value: 0 }
      : period.weekly_reward;
    for (let i = 0; i < 5; i++) {
      couponCode = makeCouponCode();
      const expires = new Date();
      expires.setUTCDate(expires.getUTCDate() + 3);
      const ins = await sb.from('coupons').insert({
        code: couponCode,
        user_id: user.id,
        label: reward.label,
        discount_type: reward.type,
        discount_value: reward.percent_off ?? reward.amount_off ?? 0,
        min_order_value: reward.min_order_value ?? 0,
        expires_at: expires.toISOString(),
        active: true,
        max_uses: 1,
        used_count: 0,
        source: perfectGame ? 'memory_game_perfect' : 'memory_game',
        week_key: period.week_key,
      }).select('*').maybeSingle();
      if (!ins.error && ins.data) { couponRow = ins.data; break; }
    }
    if (!couponRow) throw new Error('Não foi possível gerar cupom');
  }

  const { data: session, error: sessErr } = await sb.from('coupon_game_sessions').insert({
    user_id: user.id,
    week_key: period.week_key,
    period_key: period.period_key,
    won,
    score,
    attempts,
    duration_ms,
    coupon_code: couponCode,
    reward_type: period.weekly_reward.type,
    reward_label: period.weekly_reward.label,
  }).select('*').single();
  if (sessErr) throw sessErr;

  return res.status(200).json({
    ok: true,
    session,
    weekly_reward: period.weekly_reward,
    period_key: period.period_key,
    vip,
    coupon: couponRow ? {
      code: couponRow.code,
      label: couponRow.label,
      discount_type: couponRow.discount_type,
      discount_value: couponRow.discount_value,
      min_order_value: couponRow.min_order_value,
      expires_at: couponRow.expires_at,
    } : null,
  });
}

async function handleValidate(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Faça login para usar cupom.' });
  const body = safeBody(req);
  const code = String(body.code || '').trim().toUpperCase();
  const subtotal = Number(body.subtotal || 0);
  if (!code) return res.status(400).json({ error: 'Informe o cupom.' });

  const sb = supabaseAdmin();
  const { data: coupon, error } = await sb.from('coupons').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!coupon) return res.status(404).json({ error: 'Cupom não encontrado.' });
    const cpfGate = await ensureCouponCpfAllowed(sb, { coupon, currentUser: user });
  if (!cpfGate.ok) return res.status(cpfGate.status).json({ error: cpfGate.error });

  const result = calcCouponDiscount({ subtotal, coupon });
  if (!result.valid) {
    if (result.reason === 'minimo') {
      return res.status(400).json({ error: `Pedido mínimo para este cupom: R$ ${Number(result.min_order_value).toFixed(2).replace('.', ',')}` });
    }
    return res.status(400).json({ error: 'Cupom inválido, expirado ou já usado.' });
  }

  return res.status(200).json({ ok: true, coupon: { code: coupon.code, label: coupon.label }, ...result });
}


async function handleMyCoupons(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Faça login para ver seus cupons.' });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('coupons')
    .select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses,source,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  const rows = (data || []).filter((c) => {
    const exp = c?.expires_at ? new Date(c.expires_at).getTime() : 0;
    return !Number.isFinite(exp) || exp > (now - 3 * 24 * 60 * 60 * 1000);
  });
  return res.status(200).json({ coupons: rows });
}

export default async function handler(req, res) {
  try {
    const action = String(req.query?.action || '').toLowerCase();
    if (!action) return res.status(400).json({ error: 'Ação não informada.' });

    if (action === 'game-status') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      return await handleGameStatus(req, res);
    }
    if (action === 'game-complete') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      return await handleGameComplete(req, res);
    }
    if (action === 'validate') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      return await handleValidate(req, res);
    }
    if (action === 'my-coupons') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      return await handleMyCoupons(req, res);
    }

    return res.status(404).json({ error: 'Ação inválida.' });
  } catch (e) {
    console.error('coupons api', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
