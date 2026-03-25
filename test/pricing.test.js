import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPromoToVariantCents,
  centsToBRL,
  fmtBRL,
  getVariantPricingCents,
  isPromoActive,
  percentOffCents,
} from '../src/lib/pricing.js'

test('detecta promoção ativa corretamente', () => {
  assert.equal(
    isPromoActive({
      promo: true,
      originalPriceCents: 10000,
      priceCents: 8000,
    }),
    true
  )

  assert.equal(
    isPromoActive({
      promo: true,
      originalPriceCents: 10000,
      priceCents: 10000,
    }),
    false
  )
})

test('aplica desconto proporcional na variante', () => {
  const product = {
    promo: true,
    originalPriceCents: 10000,
    priceCents: 7500,
  }

  assert.equal(applyPromoToVariantCents(product, 20000), 15000)
})

test('retorna os preços da variante com strike quando houver promoção', () => {
  const product = {
    promo: true,
    originalPriceCents: 10000,
    priceCents: 8000,
    variants: [
      { label: 'P', priceCents: 12000 },
      { label: 'M', priceCents: 15000 },
    ],
  }

  assert.deepEqual(getVariantPricingCents(product, 1), {
    hasVariants: true,
    sel: { label: 'M', priceCents: 15000 },
    selIndex: 1,
    baseVariantCents: 15000,
    currentCents: 12000,
    originalCents: 15000,
    showStrike: true,
  })
})

test('converte e formata valores em BRL', () => {
  assert.equal(centsToBRL(12345), 123.45)
  assert.match(fmtBRL(123.45), /123,45/)
})

test('calcula percentual de desconto em centavos', () => {
  assert.equal(percentOffCents(10000, 7500), 25)
  assert.equal(percentOffCents(10000, 10000), 0)
})
