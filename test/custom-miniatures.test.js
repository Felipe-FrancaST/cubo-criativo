import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  CUSTOM_BUCKET, validateCustomFiles, resolveCustomPrice, evaluateCustomCoupon,
} from '../server/customMiniatures.js'

const file = (type='image/png', size=512) => ({ name:'reference.png', type, size })

test('não autoriza pedido sem imagens e limita tipo, tamanho e quantidade', () => {
  assert.match(validateCustomFiles([]), /Envie entre 1 e 6/)
  assert.equal(validateCustomFiles([file()]), '')
  assert.match(validateCustomFiles(Array.from({length:7}, () => file())), /1 e 6/)
  assert.match(validateCustomFiles([file('application/pdf')]), /JPG/)
  assert.match(validateCustomFiles([file('image/png', 10 * 1024 * 1024 + 1)]), /10 MB/)
  assert.match(validateCustomFiles([file('image/jpeg', 0)]), /10 MB/)
})

test('preços em centavos diferenciam busto e miniatura, sem usar valor do cliente', () => {
  const config = { bust_price_cents: 20000, miniature_price_cents: 25000 }
  assert.equal(resolveCustomPrice(config, 'busto'), 20000)
  assert.equal(resolveCustomPrice(config, 'miniatura'), 25000)
  assert.equal(resolveCustomPrice(config, 'invalido'), 0)
  assert.equal(resolveCustomPrice({ bust_price_cents: -5 }, 'busto'), 0)
})

function fakeDb({ coupon, profile={cpf:'12345678901'}, redemptions=[], matchedProfiles=[] }={}) {
  return {
    from(table) {
      const result = table === 'coupons' ? { data:coupon || null } :
        table === 'profiles' ? { data:profile } :
        table === 'coupon_redemptions' ? { data:redemptions } : { data:null }
      const chain = {
        select(){return chain}, eq(){return chain}, in(){return {...chain, then(resolve){return Promise.resolve({data:matchedProfiles}).then(resolve)}}},
        maybeSingle(){return Promise.resolve(result)},
        then(resolve){return Promise.resolve(result).then(resolve)},
      }
      return chain
    }
  }
}

const baseCoupon = {
  code:'ARTE10', discount_type:'percent', discount_value:10,
  active:true, used_count:0, max_uses:20, applies_to:'both', min_order_value:0,
}

test('calcula cupom com banco em vez de aceitar desconto do navegador', async () => {
  const answer = await evaluateCustomCoupon(fakeDb({coupon:baseCoupon}), {
    code:'arte10',user:{id:'u1'},baseCents:20000,
  })
  assert.equal(answer.code,'ARTE10')
  assert.equal(answer.discountCents,2000)
})

test('não aplica cupons de frete ou produtos específicos às personalizadas', async () => {
  await assert.rejects(evaluateCustomCoupon(fakeDb({coupon:{...baseCoupon, discount_type:'shipping_reduced'}}),
    {code:'ARTE10',user:{id:'u1'},baseCents:20000}), /não é válido/)
  await assert.rejects(evaluateCustomCoupon(fakeDb({coupon:{...baseCoupon, product_ids:['produto-especifico']}}),
    {code:'ARTE10',user:{id:'u1'},baseCents:20000}), /não é válido/)
})

test('storage e tabelas privadas são criados pela migração SQL', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261112_custom_miniatures.sql',import.meta.url),'utf8')
  assert.equal(CUSTOM_BUCKET, 'custom-miniature-references')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.custom_miniature_requests/)
  assert.match(sql, /ALTER TABLE public\.custom_miniature_requests ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /'custom-miniature-references',\s*false/)
  assert.match(sql, /20000/)
})
