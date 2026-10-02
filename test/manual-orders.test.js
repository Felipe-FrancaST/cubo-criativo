import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidCpf,
  parseMoney,
  validateManualCustomer,
  validateManualItems,
  getManualProductPriceCents,
} from '../shared/manualOrder.js'
import {
  escapeCsvCell,
  fmtAddress,
} from '../src/pages/admin/orders/adminOrdersUtils.js'

const customer = {
  name: 'Cliente',
  email: 'cliente@example.com',
  cpf: '529.982.247-25',
  phone: '(11) 99999-8888',
  address_line1: 'Rua de exemplo',
  address_number: '100',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  zip: '01001-000',
}

test('CPF usa dígitos verificadores e rejeita sequências repetidas', () => {
  assert.equal(isValidCpf(customer.cpf), true)
  for (const cpf of ['11111111111', '00000000000', '52998224726', '123'])
    assert.equal(isValidCpf(cpf), false)
})

test('valores aceitam decimal brasileiro sem transformar campos vazios em zero', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56)
  assert.equal(parseMoney('99,90'), 99.9)
  assert.equal(parseMoney('99.90'), 99.9)
  for (const value of ['', 'abc', '12.345.67', Infinity, '-5', '1,234'])
    assert.equal(Number.isNaN(parseMoney(value)), true)
})

test('cliente exige endereço, CPF e e-mail válidos antes do pedido', () => {
  assert.deepEqual(validateManualCustomer(customer), {})
  const errors = validateManualCustomer({
    ...customer,
    email: 'invalid',
    state: 'XX',
    address_number: '',
    cpf: '11111111111',
  })
  assert.deepEqual(Object.keys(errors).sort(), [
    'address_number',
    'cpf',
    'email',
    'state',
  ])
  assert.equal(
    validateManualCustomer(customer, 'existing').client,
    'Selecione um cliente cadastrado.'
  )
})

test('itens rejeitam quantidades fracionárias, inválidas e excessivas', () => {
  for (const qty of [0, -1, 1.5, 1000, Infinity, 'invalid'])
    assert.ok(validateManualItems([{ mode: 'product', product_id: 'p1', qty }]))
  assert.equal(
    validateManualItems([{ mode: 'product', product_id: 'p1', qty: 2 }]),
    ''
  )
  assert.ok(validateManualItems([]))
  assert.ok(validateManualItems([{ mode: 'product', product_id: '', qty: 1 }]))
})

test('frete e personalizados exigem preço e identificação', () => {
  assert.equal(
    validateManualItems([
      { mode: 'freight', carrier: 'jadlog', price: '32,90' },
    ]),
    ''
  )
  assert.ok(
    validateManualItems([{ mode: 'freight', carrier: 'invalid', price: 10 }])
  )
  assert.ok(
    validateManualItems([{ mode: 'custom', name: '', price: 10, qty: 1 }])
  )
  assert.ok(
    validateManualItems([
      { mode: 'custom', name: 'Miniatura', price: -1, qty: 1 },
    ])
  )
})

test('VIP não é misturado a produtos de loja no mesmo pedido', () => {
  const vip = { mode: 'vip', vip_plan_id: 'cubo_l1' }
  assert.equal(validateManualItems([vip]), '')
  assert.ok(
    validateManualItems([vip, { mode: 'product', product_id: 'p1', qty: 1 }])
  )
})

test('preço da escala usa promoção proporcional em centavos', () => {
  const product = {
    price_cents: 9000,
    original_price_cents: 12000,
    promo: true,
    default_variant: '32mm',
    variants: [
      { label: '32mm', price_cents: 12000 },
      { label: '75mm', price_cents: 24000 },
    ],
  }
  assert.equal(getManualProductPriceCents(product), 9000)
  assert.equal(getManualProductPriceCents(product, '75mm'), 18000)
  assert.equal(
    getManualProductPriceCents({ ...product, promo: false }, '75mm'),
    24000
  )
  assert.equal(
    getManualProductPriceCents({ price_cents: 9990, promo: false }),
    9990
  )
})

test('CSV preserva acentos, aspas e neutraliza fórmulas', () => {
  assert.equal(escapeCsvCell('São Paulo; Centro'), '"São Paulo; Centro"')
  assert.equal(escapeCsvCell('Cliente "A"'), '"Cliente ""A"""')
  assert.equal(escapeCsvCell('=HYPERLINK(123)'), '"\'=HYPERLINK(123)"')
})

test('endereço dos detalhes inclui o número', () => {
  assert.ok(fmtAddress(customer).includes('Rua de exemplo, 100'))
})
