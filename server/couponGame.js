import crypto from 'crypto';

function weekKeyUTC(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeeklyRewardPlan(date = new Date()) {
  const key = weekKeyUTC(date);
  const hash = crypto.createHash('sha256').update(key).digest();
  const idx = hash[0] % 3;
  const plans = [
    { type: 'percent', label: '5% OFF', percent_off: 5, min_order_value: 0 },
    { type: 'shipping_reduced', label: 'Frete reduzido', amount_off: 12, min_order_value: 0 },
    { type: 'fixed_min', label: 'R$10 OFF acima de R$120', amount_off: 10, min_order_value: 120 },
  ];
  return { week_key: key, ...plans[idx] };
}

export function formatRewardLabel({ type, discount_value, min_order_value = 0 }) {
  const value = Number(discount_value || 0);
  const min = Number(min_order_value || 0);
  if (type === 'percent') return `${value}% OFF`;
  if (type === 'shipping_reduced') return `Frete reduzido (R$${value})`;
  if (type === 'fixed_min') {
    return min > 0 ? `R$${value} OFF acima de R$${min}` : `R$${value} OFF`;
  }
  return 'Cupom do jogo';
}

export async function getActiveGameReward(sb, date = new Date()) {
  const fallback = getWeeklyRewardPlan(date);

  try {
    const { data, error } = await sb
      .from('coupon_game_settings')
      .select('id,label,discount_type,discount_value,min_order_value,active,created_at,updated_at')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || '');
      if (/coupon_game_settings|column|relation|does not exist/i.test(msg)) {
        return { source: 'fallback', config: null, reward: fallback };
      }
      throw error;
    }

    if (!data) return { source: 'fallback', config: null, reward: fallback };

    const reward = {
      type: String(data.discount_type || 'percent'),
      label: String(data.label || '').trim() || formatRewardLabel(data),
      min_order_value: Number(data.min_order_value || 0),
    };

    if (reward.type === 'percent') reward.percent_off = Number(data.discount_value || 0);
    else reward.amount_off = Number(data.discount_value || 0);

    return { source: 'admin', config: data, reward: { ...fallback, ...reward } };
  } catch (error) {
    console.error('getActiveGameReward error', error);
    return { source: 'fallback', config: null, reward: fallback };
  }
}

// VIP joga 1x por dia. Não-VIP joga 1x por semana.
export async function getGamePeriodInfo(sb, { isVip }) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const day_key = `${yyyy}-${mm}-${dd}`;
  const activeReward = await getActiveGameReward(sb, now);
  const weekly_reward = activeReward.reward;
  return {
    weekly_reward,
    reward_source: activeReward.source,
    reward_config: activeReward.config,
    week_key: weekly_reward.week_key,
    day_key,
    period_key: isVip ? `D:${day_key}` : `W:${weekly_reward.week_key}`,
  };
}

export function makeCouponCode() {
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CUBO-${rnd}`;
}

export function calcCouponDiscount({ subtotal = 0, coupon }) {
  const sub = Number(subtotal) || 0;
  if (!(sub > 0) || !coupon || coupon.active === false) return { valid: false, reason: 'subtotal_invalido' };
  const now = Date.now();
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return { valid: false, reason: 'expirado' };
  if ((Number(coupon.used_count) || 0) >= (Number(coupon.max_uses) || 1)) return { valid: false, reason: 'usado' };
  const min = Number(coupon.min_order_value || 0);
  if (sub < min) return { valid: false, reason: 'minimo', min_order_value: min };

  let discount = 0;
  const type = String(coupon.discount_type || '');
  if (type === 'percent') discount = sub * ((Number(coupon.discount_value) || 0) / 100);
  else if (type === 'shipping_reduced') discount = Number(coupon.discount_value) || 0;
  else if (type === 'fixed_min') discount = Number(coupon.discount_value) || 0;
  discount = Math.max(0, Number(discount.toFixed(2)));
  // Nunca permitir total final zerado/negativo (Mercado Pago exige transaction_amount > 0)
  const maxDiscount = Math.max(0, Number((sub - 0.01).toFixed(2)));
  discount = Math.min(discount, maxDiscount);
  if (!(discount > 0)) return { valid: false, reason: 'sem_desconto' };
  const finalTotal = Number((sub - discount).toFixed(2));
  if (!(finalTotal > 0)) return { valid: false, reason: 'valor_final_invalido' };
  return {
    valid: true,
    discount,
    final_total: finalTotal,
    label: coupon.label || coupon.code,
    type,
    code: coupon.code,
  };
}
