/** Cada linha do carrinho aceita de 1 a 100 unidades; o servidor valida estoque e volumes. */
export const CART_MAX_QUANTITY = 100

export function normalizeCartQuantity(value, fallback = 1) {
  const parsed = Number(String(value ?? '').trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(CART_MAX_QUANTITY, parsed)
}

export function changeCartQuantity(current, delta) {
  return Math.min(CART_MAX_QUANTITY, Math.max(1, Number(current || 1) + Number(delta || 0)))
}
