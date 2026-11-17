import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCartQuantity, changeCartQuantity } from '../src/lib/cartQuantity.js'
import { validateShippingQuoteRequest } from '../server/shippingQuoteRequest.js'
import { requireSelectedShipping, packShipment } from '../server/shipping.js'

const oneKeychain = [{ id: 'product-1', qty: 27, scale: '' }]

test('quantidade digitada deve permanecer entre 1 e 100, sem adicionar 1 por tecla', () => {
  assert.equal(normalizeCartQuantity('27'), 27)
  assert.equal(normalizeCartQuantity('100'), 100)
  assert.equal(normalizeCartQuantity('999'), 100)
  assert.equal(normalizeCartQuantity(''), 1)
  assert.equal(normalizeCartQuantity('', 7), 7)
  assert.equal(normalizeCartQuantity('abc', 12), 12)
  assert.equal(changeCartQuantity(27, 1), 28)
  assert.equal(changeCartQuantity(100, 1), 100)
  assert.equal(changeCartQuantity(1, -1), 1)
})

test('visitante pode consultar frete de produtos com CEP próprio e sem login', () => {
  const result = validateShippingQuoteRequest({ authenticated: false, type: 'shop', destinationZip: '47803-604', items: oneKeychain })
  assert.deepEqual(result, { ok: true, destinationZip: '47803604' })
})

test('CEP inválido e quantidades acima do limite são recusados antes de usar a SuperFrete', () => {
  assert.equal(validateShippingQuoteRequest({ type: 'shop', destinationZip: '123', items: oneKeychain }).status, 400)
  assert.equal(validateShippingQuoteRequest({ type: 'shop', destinationZip: '47803-604', items: [{ ...oneKeychain[0], qty: 101 }] }).status, 400)
  assert.equal(validateShippingQuoteRequest({ type: 'shop', destinationZip: '47803604', items: [] }).status, 400)
})

test('cotação pública não libera assinatura nem personalização', () => {
  assert.equal(validateShippingQuoteRequest({ type: 'vip', authenticated: false, destinationZip: '47803604' }).status, 401)
  assert.equal(validateShippingQuoteRequest({ type: 'custom', authenticated: false, destinationZip: '47803604' }).status, 401)
  assert.equal(validateShippingQuoteRequest({ type: 'vip', authenticated: true, destinationZip: '47803604' }).ok, true)
})

test('pedido de 27 chaveiros mantém a distribuição de 20 + 7 em Mini Envios', () => {
  const packing = packShipment({ type: 'shop', items: [{ name: 'Chaveiro', category: 'Chaveiros', qty: 27, scale: '' }] })
  assert.equal(packing.parcels.length, 2)
  assert.deepEqual(packing.parcels.map(item => item.quantity), [20, 7])
  assert.equal(packing.keychainsOnly, true)
})

test('não permite finalizar com CEP diferente daquele cotado', async () => {
  await assert.rejects(
    requireSelectedShipping(null, { profile: { zip: '47803-604' }, serviceId: '17', expectedShippingCents: 500, quotedDestinationZip: '01001-000', type: 'shop', items: [] }),
    /CEP consultado é diferente do CEP do cadastro/
  )
})
