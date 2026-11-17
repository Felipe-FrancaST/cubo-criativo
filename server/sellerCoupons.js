import { normalizeSellerCouponScope } from '../shared/sellerCouponScope.js'

export function normalizeSellerCoupon(body, affiliateId) {
  const code = String(body?.code || '').trim().toUpperCase().replace(/\s+/g, '-')
  if (!/^[A-Z0-9_-]{3,50}$/.test(code)) throw new Error('O código precisa ter de 3 a 50 caracteres (letras, números, - ou _).')
  const discountType = String(body.discount_type || 'percent')
  if (!['percent', 'fixed_min'].includes(discountType)) throw new Error('Tipo de desconto inválido.')
  const value = Number(body.discount_value)
  if (!Number.isFinite(value) || value <= 0 || (discountType === 'percent' && value > 100)) {
    throw new Error('Informe um desconto válido (percentual de até 100%).')
  }
  const limit = Number(body.max_uses ?? 100)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new Error('Limite de usos inválido.')
  const minimum = Number(body.min_order_value ?? 0)
  if (!Number.isFinite(minimum) || minimum < 0) throw new Error('Valor mínimo do pedido inválido.')
  const appliesTo = normalizeSellerCouponScope(body.applies_to || 'both', { strict: true })
  const isAll = appliesTo === 'both'
  const productIds = isAll || !['shop_only', 'products', 'shop_vip'].includes(appliesTo)
    ? [] : Array.isArray(body.product_ids) ? [...new Set(body.product_ids.map(String).filter(Boolean))] : []
  const vipPlanIds = isAll || !['vip', 'shop_vip', 'custom_vip'].includes(appliesTo)
    ? [] : Array.isArray(body.vip_plan_ids) ? [...new Set(body.vip_plan_ids.map(String).filter(Boolean))] : []
  const expiration = String(body.expires_at || '').trim()
  let expiresAt = null
  if (expiration) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(expiration)
      ? new Date(`${expiration}T23:59:59-03:00`) : new Date(expiration)
    if (!Number.isFinite(parsed.getTime())) throw new Error('Data de validade inválida.')
    expiresAt = parsed.toISOString()
  }
  return {
    code, affiliate_id: affiliateId,
    label: String(body.label || code).trim().slice(0, 160),
    discount_type: discountType, discount_value: value,
    min_order_value: minimum,
    expires_at: expiresAt, active: body.active !== false,
    max_uses: limit, used_count: 0, source: 'affiliate',
    applies_to: appliesTo,
    product_ids: productIds,
    vip_plan_ids: vipPlanIds,
  }
}

