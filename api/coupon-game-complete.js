import { getUserFromAuthHeader, supabaseAdmin } from './_supabase.js';
import { getWeeklyRewardPlan, makeCouponCode } from './_couponGame.js';

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para jogar.' });
    const sb = supabaseAdmin();
    const body = safeBody(req);
    const won = !!body.won;
    const score = Number(body.score || 0);
    const attempts = Number(body.attempts || 0);
    const duration_ms = Number(body.duration_ms || 0);
    const plan = getWeeklyRewardPlan();

    const { data: existing } = await sb
      .from('coupon_game_sessions')
      .select('id, coupon_code, won')
      .eq('user_id', user.id)
      .eq('week_key', plan.week_key)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ already_played: true, session: existing, weekly_reward: plan });
    }

    let couponRow = null;
    let couponCode = null;
    if (won) {
      for (let i = 0; i < 5; i++) {
        couponCode = makeCouponCode();
        const expires = new Date();
        expires.setUTCDate(expires.getUTCDate() + 7);
        const ins = await sb.from('coupons').insert({
          code: couponCode,
          user_id: user.id,
          label: plan.label,
          discount_type: plan.type,
          discount_value: plan.percent_off ?? plan.amount_off ?? 0,
          min_order_value: plan.min_order_value ?? 0,
          expires_at: expires.toISOString(),
          active: true,
          max_uses: 1,
          used_count: 0,
          source: 'memory_game',
          week_key: plan.week_key,
        }).select('*').maybeSingle();
        if (!ins.error && ins.data) { couponRow = ins.data; break; }
      }
      if (!couponRow) throw new Error('Não foi possível gerar cupom');
    }

    const { data: session, error: sessErr } = await sb.from('coupon_game_sessions').insert({
      user_id: user.id,
      week_key: plan.week_key,
      won,
      score,
      attempts,
      duration_ms,
      coupon_code: couponCode,
      reward_type: plan.type,
      reward_label: plan.label,
    }).select('*').single();
    if (sessErr) throw sessErr;

    return res.status(200).json({
      ok: true,
      session,
      weekly_reward: plan,
      coupon: couponRow ? {
        code: couponRow.code,
        label: couponRow.label,
        discount_type: couponRow.discount_type,
        discount_value: couponRow.discount_value,
        min_order_value: couponRow.min_order_value,
        expires_at: couponRow.expires_at,
      } : null,
    });
  } catch (e) {
    console.error('coupon-game-complete', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
