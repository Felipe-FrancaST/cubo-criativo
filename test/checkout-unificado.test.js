import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateCustomCoupon } from '../server/customMiniatures.js'
import { needsProfileCompletion } from '../src/lib/profileCheckout.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

function couponDb(cpf) {
  const coupon = { code: 'CUBO10', active: true, applies_to: 'products', discount_type: 'percent', discount_value: 10, used_count: 0, max_uses: 100 }
  return { from(table) {
    const chain = { select() { return chain }, eq() { return chain }, maybeSingle() { return Promise.resolve({ data: table === 'coupons' ? coupon : { cpf }, error: null }) } }
    return chain
  } }
}

test('cupom personalizado indica cadastro incompleto quando CPF está ausente ou inválido', async () => {
  for (const cpf of ['', null, '123456']) {
    await assert.rejects(
      evaluateCustomCoupon(couponDb(cpf), { code: 'CUBO10', user: { id: 'cliente' }, baseCents: 20000 }),
      (error) => error.code === 'profile_incomplete' && /CPF/.test(error.message),
    )
  }
})

test('erro de cupom utilizado por CPF não aciona indevidamente edição do cadastro', () => {
  assert.equal(needsProfileCompletion({code:'profile_incomplete'}), true)
  assert.equal(needsProfileCompletion(new Error('Complete seu CPF no perfil para utilizar um cupom.')), true)
  assert.equal(needsProfileCompletion(new Error('Este cupom já foi utilizado por este CPF.')), false)
  assert.equal(needsProfileCompletion(new Error('Este cupom pertence a outro CPF.')), false)
  assert.equal(needsProfileCompletion(new Error('Cupom expirado.')), false)
})

test('miniaturas personalizadas abrem janela de perfil e reaplicam cupom após salvar', async () => {
  const source = await read('../src/pages/CustomMiniaturesPage.jsx')
  const app = await read('../src/App.jsx')
  const server = await read('../server/api_handlers/custom-miniatures.js')
  assert.match(source, /needsProfileCompletion\(err\)/)
  assert.match(source, /onRequireProfile\?\.\(\)/)
  assert.match(source, /profile:saved/)
  assert.match(source, /applyCoupon\(\{ promptForProfile: false \}\)/)
  assert.match(app, /onRequireProfile=\{\(\) => openSettings\('profile', \{ autoClose: true, overlay: true \}\)\}/)
  assert.match(server, /safeCustomError\(error\), error\?\.code/)
})

test('carrinho, assinatura, renovação e personalização usam o mesmo seletor e botão dinâmico', async () => {
  const sources = await Promise.all([
    '../src/components/CartDrawer.jsx',
    '../src/pages/VipRpgPage.jsx',
    '../src/pages/CustomMiniaturesPage.jsx',
    '../src/components/VipAreaModal.jsx',
  ].map(read))
  for (const source of sources) {
    assert.match(source, /<PaymentChoice\s/)
    assert.match(source, /<PaymentActionButton\s/)
  }
  const shared = await read('../src/components/PaymentChoice.jsx')
  assert.match(shared, /aria-pressed/)
  assert.match(shared, /payment-method|checkout-choice-group/)
  assert.match(shared, /loadingLabel/)
  assert.match(sources[0], /paymentMethod === 'pix'\) void handlePix\(\)/)
  assert.match(sources[1], /reusablePix/)
})
