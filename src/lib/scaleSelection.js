import { getVariantPricingCents } from './pricing.js'

/** As opções disponíveis sempre são derivadas dos preços carregados do catálogo. */
export function getScaleChoices(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  if (variants.length) {
    const preferred = Math.max(0, variants.findIndex(v => v.label === product.defaultVariant))
    return variants.map((variant, index) => ({
      label: String(variant.label || '').trim(),
      priceCents: getVariantPricingCents(product, index, preferred).currentCents,
    })).filter(option => option.label && Number.isFinite(option.priceCents) && option.priceCents > 0)
  }
  // Produtos sem variações não devem ganhar escalas inventadas.
  const knownScale = String(product?.escala || '').trim()
  const priceCents = Number(product?.priceCents || Math.round((product?.preco || 0) * 100))
  return knownScale && Number.isFinite(priceCents) && priceCents > 0
    ? [{ label: knownScale, priceCents }]
    : []
}

export function findChosenScale(choices, label) {
  return choices.find(choice => choice.label === label) || null
}

export function requiresScaleChoice(product) {
  return (Array.isArray(product?.variants) && product.variants.length > 0) || Boolean(String(product?.escala || '').trim())
}

export function isValidScaleChoice(product, scale) {
  return !requiresScaleChoice(product) || !!findChosenScale(getScaleChoices(product), scale)
}
