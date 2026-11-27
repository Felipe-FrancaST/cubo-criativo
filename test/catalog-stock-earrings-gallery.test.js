import test from 'node:test';
import assert from 'node:assert/strict';
import { moveGalleryKey, orderGalleryItems, normalizeProductCategory, parseProductStock, productRowToForm } from '../src/pages/admin/products/adminProductUtils.js';
import { packShipment } from '../server/shipping.js';
import { resolveStoreItems } from '../server/orderPricing.js';
import { decrementStockAtomically } from '../server/inventory.js';

test('ordena imagens antigas e novas juntas, mantendo a primeira como capa', () => {
  const items = [{key:'existing:a'}, {key:'existing:b'}, {key:'new:c'}];
  const keys = moveGalleryKey(items.map(i=>i.key), 'new:c', 'existing:a');
  assert.deepEqual(orderGalleryItems(items,keys).map(i=>i.key),['new:c','existing:a','existing:b']);
  assert.deepEqual(orderGalleryItems(items.filter(i=>i.key!=='existing:a').concat({key:'new:d'}),keys).map(i=>i.key),['new:c','existing:b','new:d']);
});
test('categorias antigas e brincos são normalizados para o filtro', () => {
  for (const [input,expected] of [['Brinco','brincos'],['Chaveiro','chaveiros'],['Action','action figures'],['Miniaturas RPG','rpg']]) assert.equal(normalizeProductCategory(input),expected);
});
test('catálogo não grava estoque; pronta entrega exige quantidade inteira', () => {
  assert.equal(parseProductStock('catalogo','999'),null);
  assert.equal(parseProductStock('estoque','0'),0);
  assert.equal(parseProductStock('estoque','5'),5);
  for (const value of ['', '-1','1.5','abc']) assert.throws(()=>parseProductStock('estoque',value));
  assert.equal(productRowToForm({status:'catalogo',stock:999}).stock,'');
  assert.equal(productRowToForm({status:'estoque',stock:5}).stock,'5');
});
const accessory=(qty,category='brincos')=>({name:'Acessório',qty,category,scale:''});
test('brincos e chaveiros compartilham até 20 unidades por caixa Mini Envios', () => {
  const only=packShipment({type:'shop',items:[accessory(41)]});
  assert.deepEqual(only.parcels.map(p=>p.quantity),[20,20,1]);
  assert.equal(only.keychainsOnly,true);
  assert.equal(only.feeCategory,'mini');
  assert.ok(only.parcels.every(p=>p.length===24&&p.width===16&&p.height===4&&p.weight===.3));
  const mixed=packShipment({type:'shop',items:[accessory(12),accessory(11,'chaveiros')]});
  assert.deepEqual(mixed.parcels.map(p=>p.quantity),[20,3]);
  assert.equal(mixed.keychainsOnly,true);
});
const row={id:'p1',name:'Brinco',category:'brincos',price_cents:1000,original_price_cents:1000,active:true,variants:[]};
const mockPricing=product=>({from:()=>({select:()=>({in:async()=>({data:[product],error:null})})})});
test('checkout ignora estoque antigo do catálogo e limita pronta entrega inclusive em múltiplas linhas',async()=>{
  const cart=[{id:'p1',qty:3},{id:'p1',qty:2}];
  assert.equal((await resolveStoreItems(mockPricing({...row,status:'catalogo',stock:0}),cart)).ok,true);
  assert.equal((await resolveStoreItems(mockPricing({...row,status:'estoque',stock:4}),cart)).code,'out_of_stock');
  assert.equal((await resolveStoreItems(mockPricing({...row,status:'estoque',stock:null}),cart)).code,'out_of_stock');
  assert.equal((await resolveStoreItems(mockPricing({...row,status:'estoque',stock:5}),cart)).ok,true);
});
test('pagamento não desconta estoque de produtos de catálogo',async()=>{
  const sb={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'p1',stock:10,status:'catalogo'},error:null})})}),update:()=>{throw new Error('Não deve atualizar catálogo')}})};
  assert.deepEqual(await decrementStockAtomically(sb,'p1',3),{ok:true,unmanaged:true});
});
