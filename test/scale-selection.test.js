import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getScaleChoices, findChosenScale, isValidScaleChoice, requiresScaleChoice } from '../src/lib/scaleSelection.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const product = {
  id: 'mini-1', nome: 'Dragão', priceCents: 8000, originalPriceCents: 10000, promo: true,
  variants: [
    { label: '32 mm', priceCents: 10000 },
    { label: '75 mm', priceCents: 20000 },
  ], defaultVariant: '32 mm',
}

test('as escolhas mostram valores reais das escalas, incluindo a promoção', () => {
  assert.deepEqual(getScaleChoices(product), [
    { label: '32 mm', priceCents: 8000 },
    { label: '75 mm', priceCents: 16000 },
  ])
  assert.equal(findChosenScale(getScaleChoices(product), '75 mm')?.priceCents, 16000)
  assert.equal(findChosenScale(getScaleChoices(product), ''), null)
})

test('sem escala selecionada, carrinho e compra imediata devem recusar variantes', () => {
  assert.equal(requiresScaleChoice(product), true)
  assert.equal(isValidScaleChoice(product, ''), false)
  assert.equal(isValidScaleChoice(product, '75 mm'), true)
  assert.equal(isValidScaleChoice(product, '99 mm'), false)
  assert.equal(isValidScaleChoice({ priceCents: 5000 }, ''), true)
})

test('produtos sem variantes não recebem escalas inventadas', () => {
  assert.deepEqual(getScaleChoices({ priceCents: 4000 }), [])
  assert.deepEqual(getScaleChoices({ priceCents: 4000, escala: '10 cm' }), [{ label: '10 cm', priceCents: 4000 }])
  assert.deepEqual(getScaleChoices({ variants: [{ label: '32mm', priceCents: 0 }] }), [])
})

test('catálogo e página do produto exigem escolha antes de confirmar ações', () => {
  const card = read('../src/components/ProductCard.jsx')
  const detail = read('../src/pages/ProductPage.jsx')
  const modal = read('../src/components/ScaleSelectionModal.jsx')
  const app = read('../src/App.jsx')
  assert.match(app, /if \(!isValidScaleChoice\(p, escala\)\)/)
  for (const file of [card, detail]) {
    assert.match(file, /needsScale/)
    assert.match(file, /setScaleAction\(action\)/)
    assert.match(file, /<ScaleSelectionModal/)
  }
  assert.match(modal, /disabled=\{!chosen\}/)
  assert.match(modal, /onConfirm\?\.\(\{ escala: chosen.label, unitPrice: centsToBRL\(chosen.priceCents\) \}\)/)
  assert.match(modal, /role="radiogroup"/)
})

test('a página personalizada oferece etapas e navegação móvel para pagamento', () => {
  const jsx = read('../src/pages/CustomMiniaturesPage.jsx')
  const css = read('../src/pages/custom-miniatures.css')
  assert.match(jsx, /cm-mobile-steps/)
  assert.match(jsx, /cm-mobile-next/)
  assert.match(jsx, /scrollToStep\(files.length \? checkoutStepRef : imagesStepRef\)/)
  assert.match(css, /@media\(max-width:700px\)/)
  assert.match(css, /cm-types\{grid-template-columns:1fr/)
})
