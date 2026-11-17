// Escopos de cupons de vendedores. Os três valores legados permanecem estáveis:
// products = loja + personalizadas, vip = assinaturas, both = todas as categorias.
// Os novos códigos permitem escolher separadamente loja e personalizadas.
export const SELLER_COUPON_SCOPES = Object.freeze({
  both: { label: 'Tudo — produtos, personalizadas e assinaturas', categories: ['shop', 'custom', 'vip'] },
  shop_only: { label: 'Somente produtos da loja', categories: ['shop'] },
  custom_only: { label: 'Somente personalizadas (miniaturas e bustos)', categories: ['custom'] },
  vip: { label: 'Somente assinaturas VIP', categories: ['vip'] },
  products: { label: 'Produtos + personalizadas', categories: ['shop', 'custom'] },
  shop_vip: { label: 'Produtos + assinaturas', categories: ['shop', 'vip'] },
  custom_vip: { label: 'Personalizadas + assinaturas', categories: ['custom', 'vip'] },
})

export function normalizeSellerCouponScope(value, { strict = false } = {}) {
  const scope = String(value || '').trim().toLowerCase()
  if (scope === 'all') return 'both'
  if (Object.hasOwn(SELLER_COUPON_SCOPES, scope)) return scope
  if (strict) throw new Error('Selecione onde o cupom poderá ser utilizado.')
  return 'products' // compatibilidade com cupons antigos sem configuração
}

export function couponAllowsCategory(appliesTo, category) {
  const scope = normalizeSellerCouponScope(appliesTo)
  return SELLER_COUPON_SCOPES[scope].categories.includes(category)
}

export function sellerCouponScopeLabel(value) {
  return SELLER_COUPON_SCOPES[normalizeSellerCouponScope(value)].label
}
