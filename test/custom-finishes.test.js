import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  resolveCustomPrice, CUSTOM_FINISHES, customPieceLabel,
} from '../server/customMiniatures.js'

const settings = {
  miniature_price_cents: 20000,
  miniature_unpainted_price_cents: 15000,
  bust_price_cents: 25000,
  bust_unpainted_price_cents: 17000,
}

const text = file => readFile(new URL(file, import.meta.url), 'utf8')

test('tabela de acabamento tem exatamente os dois tipos disponíveis', () => {
  assert.deepEqual(Object.keys(CUSTOM_FINISHES), ['painted', 'unpainted'])
  assert.equal(customPieceLabel('miniatura', 'unpainted'), 'Miniatura personalizada — Sem pintura')
  assert.equal(customPieceLabel('busto', 'painted'), 'Busto personalizado — Com pintura')
})

test('servidor calcula os quatro preços pela categoria e acabamento', () => {
  assert.equal(resolveCustomPrice(settings, 'miniatura', 'painted'), 20000)
  assert.equal(resolveCustomPrice(settings, 'miniatura', 'unpainted'), 15000)
  assert.equal(resolveCustomPrice(settings, 'busto', 'painted'), 25000)
  assert.equal(resolveCustomPrice(settings, 'busto', 'unpainted'), 17000)
  assert.equal(resolveCustomPrice(settings, 'miniatura'), 20000)
})

test('servidor rejeita formatos, acabamentos ou preços inválidos', () => {
  assert.equal(resolveCustomPrice(settings, 'invalido', 'painted'), 0)
  assert.equal(resolveCustomPrice(settings, 'busto', 'outra_opcao'), 0)
  assert.equal(resolveCustomPrice({ ...settings, bust_unpainted_price_cents: 0 }, 'busto', 'unpainted'), 0)
  assert.equal(resolveCustomPrice({ ...settings, bust_unpainted_price_cents: 1.5 }, 'busto', 'unpainted'), 0)
})

test('pagamento usa o acabamento registrado no prepare e recusa divergência no checkout', async () => {
  const api = await text('../server/api_handlers/custom-miniatures.js')
  assert.match(api, /kind, finish, notes, image_paths/)
  assert.match(api, /row\.finish !== finish/)
  assert.match(api, /resolveCustomPrice\(settings, kind, finish\)/)
  assert.match(api, /expected_total_cents/)
  assert.match(api, /customPieceLabel\(kind, finish\)/)
})

test('cupom, resumo e checkout preservam acabamento, e frete continua igual', async () => {
  const ui = await text('../src/pages/CustomMiniaturesPage.jsx')
  const backend = await text('../server/api_handlers/custom-miniatures.js')
  const shipping = await text('../server/shipping.js')
  assert.match(ui, /body: \{ kind, finish, coupon_code: code \}/)
  assert.match(ui, /discount\?\.finish === finish/)
  assert.match(ui, /kind, finish, payment_method: paymentMethod/)
  assert.match(backend, /kind,finish,notes,image_paths/)
  assert.match(shipping, /type === 'custom'/)
  assert.doesNotMatch(shipping, /custom.*finish/)
})

test('migração preserva preço com pintura e registra acabamento em pedidos antigos', async () => {
  const sql = await text('../supabase/migrations/20261114_custom_finishes.sql')
  assert.match(sql, /ADD COLUMN IF NOT EXISTS bust_unpainted_price_cents/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS finish text NOT NULL DEFAULT 'painted'/)
  assert.match(sql, /0\.75/)
  assert.match(sql, /finish IN \('painted', 'unpainted'\)/)
})
