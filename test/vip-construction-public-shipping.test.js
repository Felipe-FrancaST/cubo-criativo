import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { vipItemStorage, vipItemCategory, vipItemLabel } from '../shared/vipItemCategory.js'
import { validateShippingQuoteRequest } from '../server/shippingQuoteRequest.js'
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Construção ocupa a mesma vaga de boss sem perder a categoria de exibição', () => {
  const construction = vipItemStorage('construction')
  const boss = vipItemStorage('boss')
  const mini = vipItemStorage('miniature')
  assert.equal(construction.item_type, boss.item_type)
  assert.equal(mini.item_type, 'miniature')
  assert.equal(vipItemCategory(construction), 'construction')
  assert.equal(vipItemLabel(construction), 'Construção')
  assert.equal(vipItemLabel(boss), 'Boss')
  assert.equal(vipItemLabel(mini), 'Miniatura')
  assert.throws(() => vipItemStorage('invalid'))
})

test('migração preserva item_type e limita a nova categoria a peças boss', () => {
  const sql = source('supabase/migrations/20261126_vip_construcoes.sql')
  assert.match(sql, /add column if not exists display_type text/)
  assert.match(sql, /display_type = 'construction'.*item_type = 'boss'/)
  assert.doesNotMatch(sql, /update public\.vip_mini_options/i)
  assert.match(source('api/admin.js'), /\.\.\.vipItemStorage\(itemType\)/)
  assert.match(source('api/admin.js'), /display_type: item\.display_type \|\| null/)
})

test('visitante pode cotar assinatura somente com CEP válido', () => {
  assert.deepEqual(validateShippingQuoteRequest({ type: 'vip', destinationZip: '47803-604' }), { ok: true, destinationZip: '47803604' })
  assert.equal(validateShippingQuoteRequest({ type: 'vip' }).status, 400)
  assert.equal(validateShippingQuoteRequest({ type: 'vip', destinationZip: '123' }).status, 400)
  assert.equal(validateShippingQuoteRequest({ type: 'custom', destinationZip: '47803604' }).status, 401)
  assert.equal(validateShippingQuoteRequest({ type: 'vip', authenticated: true }).ok, true)
})

test('assinatura usa CEP manual, invalida a cotação ao trocar plano e envia CEP ao checkout', () => {
  const page = source('src/pages/VipRpgPage.jsx')
  assert.match(page, /<ShippingSelector manual token=\{accessToken\}/)
  assert.match(page, /setSelectedPlanId\(id\)\s*setShippingSelection\(null\)/)
  assert.match(page, /quoted_destination_zip: shippingSelection\?\.destination_zip/)
  assert.match(page, /if \(!accessToken\)[\s\S]*Faça login para assinar/)
  assert.match(source('server/api_handlers/shipping.js'), /if \(!plan \|\| plan\.active === false\)/)
})

test('categoria tem filtro e rótulo distintos na área VIP e administração', () => {
  for (const file of ['src/pages/admin/vip/AdminVipSection.jsx', 'src/components/VipAreaModal.jsx']) {
    assert.match(source(file), /<option value="construction">/)
    assert.match(source(file), /vipItemLabel\(/)
  }
  assert.match(source('src/pages/VipRpgPage.jsx'), /vipItemLabel\(item\)/)
  assert.match(source('server/api_handlers/vip-cycle.js'), /item_type,display_type/)
})

test('personalizados exibem tamanhos e orientam o cliente nas observações', () => {
  const page = source('src/pages/CustomMiniaturesPage.jsx')
  assert.match(page, /32 mm a 50 mm/)
  assert.match(page, /O busto tem 10 cm/)
  assert.match(page, /Informe o tamanho desejado/)
})
