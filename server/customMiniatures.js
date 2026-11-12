import { calcCouponDiscount } from './couponGame.js';

export const CUSTOM_BUCKET = 'custom-miniature-references';
export const CUSTOM_MAX_FILES = 6;
export const CUSTOM_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CUSTOM_FORMATS = Object.freeze({
  busto: 'Busto personalizado',
  miniatura: 'Miniatura personalizada',
});
export const CUSTOM_MIMES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});
export const CUSTOM_PRODUCTION_STATES = Object.freeze([
  'aguardando_pagamento', 'recebido', 'em_analise',
  'em_producao', 'finalizado', 'enviado', 'cancelado',
]);

export function validateCustomFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > CUSTOM_MAX_FILES) {
    return 'Envie entre 1 e 6 imagens de referência.';
  }
  for (const file of files) {
    if (!Object.hasOwn(CUSTOM_MIMES, String(file?.type || '')) ||
        !Number.isInteger(file?.size) || file.size < 1 || file.size > CUSTOM_MAX_FILE_BYTES) {
      return 'Use imagens JPG, PNG ou WEBP de até 10 MB cada.';
    }
  }
  return '';
}

export function resolveCustomPrice(settings, kind) {
  if (!Object.hasOwn(CUSTOM_FORMATS, kind)) return 0;
  const cents = kind === 'busto' ? settings?.bust_price_cents : settings?.miniature_price_cents;
  return Number.isSafeInteger(cents) && cents >= 100 ? cents : 0;
}

export async function evaluateCustomCoupon(sb, { code, user, baseCents }) {
  const normalized = String(code || '').trim().toUpperCase().slice(0, 50);
  if (!normalized) return { code: null, discountCents: 0, label: '' };
  if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Cupom inválido.');
  const { data: coupon, error } = await sb.from('coupons').select('*').eq('code', normalized).maybeSingle();
  if (error) throw error;
  if (!coupon) throw new Error('Cupom não encontrado.');
  // Cupons de produto abrangentes podem valer para encomendas; cupons de
  // produtos específicos, planos VIP e frete não são aplicáveis.
  const appliesTo = String(coupon.applies_to || 'products').toLowerCase();
  if (!['products', 'both'].includes(appliesTo) ||
      (Array.isArray(coupon.product_ids) && coupon.product_ids.length) ||
      coupon.discount_type === 'shipping_reduced') {
    throw new Error('Este cupom não é válido para miniaturas personalizadas.');
  }
  const { data: profile, error: profileError } = await sb.from('profiles')
    .select('cpf').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  const cpf = String(profile?.cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    const missingCpf = new Error('Complete seu CPF no perfil para utilizar um cupom.');
    missingCpf.code = 'profile_incomplete';
    throw missingCpf;
  }
  if (coupon.user_id && String(coupon.user_id) !== String(user.id)) {
    const { data: owner, error: ownerError } = await sb.from('profiles')
      .select('cpf').eq('id', coupon.user_id).maybeSingle();
    if (ownerError) throw ownerError;
    if (owner?.cpf && String(owner.cpf).replace(/\D/g, '') !== cpf) {
      throw new Error('Este cupom pertence a outro CPF.');
    }
  }

  const { data: redemptions, error: redemptionError } = await sb
    .from('coupon_redemptions').select('user_id').eq('coupon_code', normalized);
  if (redemptionError) throw redemptionError;
  const ids = [...new Set((redemptions || []).map((row) => row.user_id).filter(Boolean))];
  if (ids.length) {
    const { data: profiles, error: profilesError } = await sb.from('profiles')
      .select('cpf').in('id', ids);
    if (profilesError) throw profilesError;
    if ((profiles || []).some((row) => String(row.cpf || '').replace(/\D/g, '') === cpf)) {
      throw new Error('Este cupom já foi utilizado por este CPF.');
    }
  }
  const discount = calcCouponDiscount({ subtotal: baseCents / 100, coupon });
  if (!discount.valid) {
    throw new Error(discount.reason === 'minimo'
      ? `Valor mínimo do cupom: R$ ${Number(discount.min_order_value).toFixed(2).replace('.', ',')}.`
      : 'Cupom inválido, expirado ou esgotado.');
  }
  return { code: normalized, discountCents: Math.round(discount.discount * 100), label: coupon.label || normalized };
}

export function safeCustomError(error) {
  if (!error) return 'Não foi possível concluir a solicitação.';
  const message = String(error.message || error);
  return message.length > 250 ? 'Não foi possível concluir a solicitação.' : message;
}
