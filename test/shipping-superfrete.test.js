import assert from 'node:assert/strict'
import test from 'node:test'
import {
  packShipment, vipLevel, getShippingQuote, requireSelectedShipping, normalizeZip,
} from '../server/shipping.js'

function product(scale, qty = 1) { return { name: scale === '32mm' ? 'Miniatura RPG' : 'Action Figure', scale, qty } }
const sizes = p => [p.length,p.width,p.height,p.weight]

test('embalagem corrigida: 1 ou 2 miniaturas em 13x11x10; até 300 g', () => {
  for (const n of [1, 2]) {
    const { parcels, feeCategory } = packShipment({ type:'shop', items:[product('32 mm', n)] })
    assert.equal(parcels.length, 1)
    assert.deepEqual(sizes(parcels[0]), [13, 11, 10, .3])
    assert.equal(feeCategory, 'mini')
  }
})

test('miniaturas de 3 a 10 em caixa grande e de 11 a 12 em 2 caixas', () => {
  for (const n of [3, 10]) {
    const { parcels } = packShipment({ type:'shop', items:[product('32mm', n)] })
    assert.equal(parcels.length, 1)
    assert.deepEqual(sizes(parcels[0]), [20,20,20,1])
  }
  for (const n of [11, 12]) {
    const { parcels } = packShipment({ type:'shop', items:[product('32mm', n)] })
    assert.equal(parcels.length, 2)
    assert.deepEqual(sizes(parcels[0]), [20,20,20,1])
    assert.deepEqual(sizes(parcels[1]), [13,11,10,.3])
  }
  assert.equal(packShipment({ type:'shop',items:[product('32mm',22)] }).parcels.length,3)
})

test('figures possuem caixas separadas por unidade e escala', () => {
  const { parcels, feeCategory } = packShipment({ type:'shop', items:[product('10 cm',2),product('12 cm'),product('15 cm'),product('20 cm')] })
  assert.deepEqual(parcels.map(sizes), [[20,20,20,1],[20,20,20,1],[20,20,20,1],[20,20,20,2],[30,20,20,2]])
  assert.equal(feeCategory, 'other')
})

test('busto e miniatura personalizada são separados de action figure', () => {
  assert.deepEqual(sizes(packShipment({type:'custom',kind:'busto'}).parcels[0]),[20,20,20,1])
  assert.deepEqual(sizes(packShipment({type:'custom',kind:'miniatura'}).parcels[0]),[13,11,10,.3])
  assert.equal(packShipment({type:'custom',kind:'miniatura'}).feeCategory,'other')
})

test('assinatura por ciclo: nível 1 até 300g; níveis 2 e 3 até 1kg', () => {
  for (const [name, target] of [['Cubo L1',[20,20,20,.3]],['Cubo L2',[30,20,20,1]],['Cubo L3',[30,20,20,1]],['Nível 3',[30,20,20,1]]]) {
    const plan = { name }
    assert.ok(vipLevel(plan)>=1)
    assert.deepEqual(sizes(packShipment({type:'vip',plan}).parcels[0]),target)
  }
})

test('miniatura RPG da pronta entrega usa categoria mesmo sem variantes de escala', () => {
  const shipment = packShipment({ type:'shop',items:[{name:'Orc com machado',category:'Miniaturas RPG', qty:2, scale:''}] })
  assert.deepEqual(sizes(shipment.parcels[0]),[13,11,10,.3])
  assert.equal(shipment.feeCategory,'mini')
})

test('não presume escala inexistente nem inventa modalidade', () => {
  assert.throws(() => packShipment({ type:'shop',items:[{ name:'Produto misterioso',qty:1 }] }),/escala/)
  assert.equal(normalizeZip('47803-604'),'47803604')
})

function mockSb() { return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { origin_zip:'47803604', services:'1,2,17', mini_fee_cents:500, other_fee_cents:1000, enabled: true } }) }) }) }) } }

test('cota todos os volumes, interseção de modalidades e taxa uma vez por pedido', async () => {
  const previousFetch = globalThis.fetch
  const oldToken = process.env.SUPERFRETE_TOKEN
  const oldAgent = process.env.SUPERFRETE_USER_AGENT
  process.env.SUPERFRETE_TOKEN = 'dummy-token-for-test'
  process.env.SUPERFRETE_USER_AGENT = 'TesteCubo/1.0 (teste@example.org)'
  const calls = []
  globalThis.fetch = async (_url, options) => {
    const req = JSON.parse(options.body); calls.push(req)
    const isLarge = req.package.length === 20
    return { ok:true, json: async () => [
      { id:1,name:'PAC',price:isLarge ? 20 : 12,delivery_time:6,company:{name:'Correios'} },
      { id:2,name:'SEDEX',price:isLarge ? 30 : 18,delivery_time:3,company:{name:'Correios'} },
      { id:17,name:'Mini Envios',price:5,has_error:true },
    ] }
  }
  try {
    const sb = mockSb()
    const quote = await getShippingQuote(sb,{destinationZip:'01001000',type:'shop',items:[product('32mm',12)]})
    assert.equal(calls.length,2)
    assert.equal(quote.options.length,2)
    assert.equal(quote.options.find(x=>x.service_id==='1').price_cents,3700) // 20+12+5
    assert.equal(quote.options.find(x=>x.service_id==='2').price_cents,5300) // 30+18+5
    assert.equal(quote.options[0].fee_cents,500)
    const selected = await requireSelectedShipping(sb,{ profile:{zip:'01001-000'},serviceId:'1',expectedShippingCents:3700,type:'shop',items:[product('32mm',12)] })
    assert.equal(selected.total_cents,3700)
    await assert.rejects(requireSelectedShipping(sb,{ profile:{zip:'01001000'}, serviceId:'1',expectedShippingCents:0,type:'shop',items:[product('32mm',12)] }),/valor do frete mudou/)
  } finally {
    globalThis.fetch=previousFetch
    if(oldToken===undefined) delete process.env.SUPERFRETE_TOKEN; else process.env.SUPERFRETE_TOKEN=oldToken
    if(oldAgent===undefined) delete process.env.SUPERFRETE_USER_AGENT; else process.env.SUPERFRETE_USER_AGENT=oldAgent
  }
})
