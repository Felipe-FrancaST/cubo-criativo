import crypto from 'crypto';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

export function getVipPresentCycleKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getVipPresentReward(rollValue) {
  const value = Number(rollValue || 0);
  const mapping = {
    1: { kind: 'none', label: 'Não ganhou nada dessa vez', title: 'Ainda não foi desta vez', message: 'O presente deste ciclo escapou por pouco. No próximo mês, o dado volta para a mesa.' },
    2: { kind: 'none', label: 'Não ganhou nada dessa vez', title: 'Quase veio', message: 'Desta vez não caiu prêmio, mas sua rolagem mensal já ficou registrada para este ciclo.' },
    3: { kind: 'coupon', label: 'Cupom de 3% de desconto', title: 'Cupom liberado', message: 'Você ganhou 3% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 3, min_order_value: 0 } },
    4: { kind: 'coupon', label: 'Cupom de 5 reais de desconto', title: 'Cupom liberado', message: 'Você ganhou R$ 5 de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'fixed_min', discount_value: 5, min_order_value: 0 } },
    5: { kind: 'coupon', label: 'Cupom de 7 reais de desconto', title: 'Cupom liberado', message: 'Você ganhou R$ 7 de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'fixed_min', discount_value: 7, min_order_value: 0 } },
    6: { kind: 'coupon', label: 'Cupom de 5% de desconto', title: 'Cupom liberado', message: 'Você ganhou 5% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 5, min_order_value: 0 } },
    7: { kind: 'coupon', label: 'Cupom de 7% de desconto', title: 'Cupom liberado', message: 'Você ganhou 7% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 7, min_order_value: 0 } },
    8: { kind: 'coupon', label: 'Cupom de 10 reais de desconto', title: 'Cupom liberado', message: 'Você ganhou R$ 10 de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'fixed_min', discount_value: 10, min_order_value: 0 } },
    9: { kind: 'coupon', label: 'Cupom de 10% de desconto', title: 'Cupom liberado', message: 'Você ganhou 10% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 10, min_order_value: 0 } },
    10: { kind: 'coupon', label: 'Cupom de 10% de desconto', title: 'Cupom liberado', message: 'Você ganhou 10% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 10, min_order_value: 0 } },
    11: { kind: 'coupon', label: 'Cupom de 10% de desconto', title: 'Cupom liberado', message: 'Você ganhou 10% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 10, min_order_value: 0 } },
    12: { kind: 'coupon', label: 'Cupom de 12% de desconto', title: 'Cupom liberado', message: 'Você ganhou 12% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 12, min_order_value: 0 } },
    13: { kind: 'coupon', label: 'Cupom de 12% de desconto', title: 'Cupom liberado', message: 'Você ganhou 12% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 12, min_order_value: 0 } },
    14: { kind: 'coupon', label: 'Cupom de 15% de desconto', title: 'Cupom liberado', message: 'Você ganhou 15% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 15, min_order_value: 0 } },
    15: { kind: 'coupon', label: 'Cupom de 15% de desconto', title: 'Cupom liberado', message: 'Você ganhou 15% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 15, min_order_value: 0 } },
    16: { kind: 'coupon', label: 'Cupom de 18% de desconto', title: 'Cupom liberado', message: 'Você ganhou 18% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 18, min_order_value: 0 } },
    17: { kind: 'coupon', label: 'Cupom de 20% de desconto', title: 'Cupom liberado', message: 'Você ganhou 20% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 20, min_order_value: 0 } },
    18: { kind: 'coupon', label: 'Cupom de 25% de desconto', title: 'Cupom liberado', message: 'Você ganhou 25% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 25, min_order_value: 0 } },
    19: { kind: 'coupon', label: 'Cupom de 30% de desconto', title: 'Cupom liberado', message: 'Você ganhou 30% de desconto. O cupom já foi salvo na sua conta.', coupon: { discount_type: 'percent', discount_value: 30, min_order_value: 0 } },
    20: { kind: 'prize', label: 'Miniatura personalizada exclusiva 🎁', title: 'Parabéns, prêmio máximo!', message: 'Você tirou 20 no d20 e liberou uma miniatura personalizada exclusiva. Clique em “Solicitar meu prêmio” para abrirmos seu atendimento.' },
  };
  return mapping[value] || mapping[1];
}

export function makeVipPresentCouponCode() {
  return `VIP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function getVipPresentCouponPayload({ userId, cycleKey, rollValue, reward }) {
  if (!reward || reward.kind !== 'coupon' || !reward.coupon) return null;
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 45);
  return {
    code: makeVipPresentCouponCode(),
    user_id: userId,
    label: reward.label,
    discount_type: reward.coupon.discount_type,
    discount_value: reward.coupon.discount_value,
    min_order_value: reward.coupon.min_order_value || 0,
    expires_at: expiresAt.toISOString(),
    active: true,
    max_uses: 1,
    used_count: 0,
    source: 'vip_present_d20',
    week_key: cycleKey,
    metadata: { cycle_key: cycleKey, roll_value: rollValue, reward_kind: reward.kind },
  };
}

export function serializeVipPresentRoll(row, coupon = null) {
  if (!row) return null;
  const reward = getVipPresentReward(row.roll_value);
  return {
    id: row.id,
    cycle_key: row.cycle_key,
    roll_value: Number(row.roll_value || 0),
    reward_kind: row.reward_kind || reward.kind,
    reward_label: row.reward_label || reward.label,
    reward_title: reward.title,
    reward_message: reward.message,
    coupon_code: row.coupon_code || null,
    claim_status: row.claim_status || null,
    claimed_at: row.claimed_at || null,
    created_at: row.created_at || null,
    coupon: coupon
      ? {
          code: coupon.code,
          label: coupon.label,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          min_order_value: coupon.min_order_value,
          expires_at: coupon.expires_at,
          active: coupon.active,
          used_count: coupon.used_count,
          max_uses: coupon.max_uses,
        }
      : null,
  };
}
