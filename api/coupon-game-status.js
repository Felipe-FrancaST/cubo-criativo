import { getUserFromAuthHeader, supabaseAdmin } from './_supabase.js';
import { getWeeklyRewardPlan } from './_couponGame.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para jogar.' });
    const sb = supabaseAdmin();
    const plan = getWeeklyRewardPlan();

    const { data: session } = await sb
      .from('coupon_game_sessions')
      .select('id, won, coupon_code, played_at, week_key')
      .eq('user_id', user.id)
      .eq('week_key', plan.week_key)
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
      weekly_reward: plan,
      coupon,
    });
  } catch (e) {
    console.error('coupon-game-status', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
