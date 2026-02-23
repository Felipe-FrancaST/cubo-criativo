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

// VIP joga 1x por dia. Não-VIP joga 1x por semana.
export function getGamePeriodInfo({ isVip }) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const day_key = `${yyyy}-${mm}-${dd}`;
  const weekly_reward = getWeeklyRewardPlan(now);
  return {
    weekly_reward,
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
