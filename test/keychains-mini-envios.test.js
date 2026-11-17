import test from 'node:test';
import assert from 'node:assert/strict';
import { packShipment, getShippingQuote, requireSelectedShipping, SHIPPING_PACKAGES, KEYCHAINS_PER_PARCEL } from '../server/shipping.js';

const keychain = (qty, name='Chaveiro de personagem') => ({ name, category: 'chaveiros', scale: '', qty });
const size = box => [box.length, box.width, box.height, box.weight];

test('a embalagem padrão de chaveiros respeita o Mini Envios da SuperFrete', () => {
  assert.equal(KEYCHAINS_PER_PARCEL, 20);
  assert.deepEqual(size(SHIPPING_PACKAGES.keychain_mini), [24,16,4,0.3]);
});

test('1, 20, 21, 40, 41 e 100 chaveiros são distribuídos em caixas de até 20 unidades', () => {
  for (const [n, quantities] of [[1,[1]],[20,[20]],[21,[20,1]],[40,[20,20]],[41,[20,20,1]],[100,[20,20,20,20,20]]]) {
    const packing = packShipment({ type:'shop', items:[keychain(n)] });
    assert.deepEqual(packing.parcels.map(p=>p.quantity),quantities);
    assert.ok(packing.parcels.every(p=>p.category==='chaveiros' && JSON.stringify(size(p)) === JSON.stringify([24,16,4,.3])));
    assert.equal(packing.keychainsOnly,true);
    assert.equal(packing.feeCategory,'mini');
  }
});

test('chaveiros de produtos diferentes dividem a mesma embalagem de até 20', () => {
  const shipment = packShipment({type:'shop',items:[keychain(11),keychain(12,'Chaveiro personalizado de herói')]});
  assert.deepEqual(shipment.parcels.map(p=>p.quantity),[20,3]);
});

test('o carrinho misto preserva a caixa de chaveiros e o frete das figuras', () => {
  const shipment = packShipment({type:'shop',items:[keychain(21),{name:'Figure',category:'action figures',scale:'10 cm',qty:1}]});
  assert.equal(shipment.parcels.length,3);
  assert.equal(shipment.parcels.filter(p=>p.category==='chaveiros').length,2);
  assert.equal(shipment.feeCategory,'other');
  assert.equal(shipment.keychainsOnly,false);
});

test('não gera cotação Mini Envios se a caixa exceder medidas e peso', () => {
  for (const invalid of [{weight:0.31},{height:5},{length:25},{width:17},{length:12}]) {
    assert.throws(() => packShipment({type:'shop',items:[keychain(20)],settings:{packages:{keychain_mini:{...SHIPPING_PACKAGES.keychain_mini,...invalid}}}}),/não atende ao Mini Envios/);
  }
});

function mockSb(services='1,2,3,17,31') { return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{origin_zip:'47803604',services,mini_fee_cents:500,other_fee_cents:1000,enabled:true}})})})})}; }

test('pedido exclusivo de 41 chaveiros cota Mini Envios apenas e cobra taxa fixa uma vez', async () => {
  const priorFetch=globalThis.fetch;
  const priorToken=process.env.SUPERFRETE_TOKEN;
  const priorUA=process.env.SUPERFRETE_USER_AGENT;
  process.env.SUPERFRETE_TOKEN='test-token'; process.env.SUPERFRETE_USER_AGENT='CuboTest/1.0 (dev@example.test)';
  const seen=[];
  globalThis.fetch=async(_url, options)=>{
    const payload=JSON.parse(options.body); seen.push(payload);
    return {ok:true,json:async()=>[
      {id:17,name:'Mini Envios',price:11.50,delivery_time:7,company:{name:'Correios'}},
      {id:1,name:'PAC',price:18,delivery_time:4,company:{name:'Correios'}},
    ]};
  };
  try {
    const quote=await getShippingQuote(mockSb(),{destinationZip:'01001000',type:'shop',items:[keychain(41)]});
    assert.equal(seen.length,1,'volumes com mesmas dimensões geram uma chamada consolidada');
    assert.equal(seen[0].services,'17');
    assert.deepEqual(seen[0].package,{height:4,width:16,length:24,weight:.3});
    assert.deepEqual(quote.parcels.map(p=>p.quantity),[20,20,1]);
    assert.deepEqual(quote.options.map(p=>p.service_id),['17']);
    assert.equal(quote.options[0].base_cents,3450);
    assert.equal(quote.options[0].fee_cents,500);
    assert.equal(quote.options[0].price_cents,3950);
    assert.equal(quote.options[0].parcels_count,3);
    await assert.rejects(requireSelectedShipping(mockSb(), {profile:{zip:'01001000'},serviceId:'1',expectedShippingCents:3950,type:'shop',items:[keychain(41)]}), /não está disponível/);
  } finally {
    globalThis.fetch=priorFetch;
    if(priorToken===undefined) delete process.env.SUPERFRETE_TOKEN; else process.env.SUPERFRETE_TOKEN=priorToken;
    if(priorUA===undefined) delete process.env.SUPERFRETE_USER_AGENT; else process.env.SUPERFRETE_USER_AGENT=priorUA;
  }
});

test('serviço Mini Envios deve estar habilitado nas configurações para pedido exclusivo de chaveiros',async()=>{
  await assert.rejects(getShippingQuote(mockSb('1,2,3'),{destinationZip:'01001000',type:'shop',items:[keychain(1)]}), /Mini Envios está desativado/);
});

test('Mini Envios indisponível no CEP não inventa cotação', async () => {
  const priorFetch=globalThis.fetch;
  const priorToken=process.env.SUPERFRETE_TOKEN;
  const priorUA=process.env.SUPERFRETE_USER_AGENT;
  process.env.SUPERFRETE_TOKEN='test-token'; process.env.SUPERFRETE_USER_AGENT='CuboTest/1.0 (dev@example.test)';
  globalThis.fetch=async()=>({ok:true,json:async()=>[{id:17,has_error:true,error:'not available'}, {id:1,name:'PAC',price:20}]});
  try {
    const quote=await getShippingQuote(mockSb(),{destinationZip:'01001000',type:'shop',items:[keychain(1)]});
    assert.deepEqual(quote.options,[]);
  } finally {
    globalThis.fetch=priorFetch;
    if(priorToken===undefined) delete process.env.SUPERFRETE_TOKEN; else process.env.SUPERFRETE_TOKEN=priorToken;
    if(priorUA===undefined) delete process.env.SUPERFRETE_USER_AGENT; else process.env.SUPERFRETE_USER_AGENT=priorUA;
  }
});
