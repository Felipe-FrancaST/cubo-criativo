import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoreItems } from '../server/orderPricing.js';

test('a categoria de chaveiros é obtida do cadastro no servidor, nunca do carrinho', async () => {
  const row = {
    id: 'key-01', name: 'Chaveiro de dragão', category: 'chaveiros', price_cents: 1000,
    original_price_cents: 1000, promo: false, active: true, stock: 100,
    image_url: '', images: [], variants: [], default_variant: '',
  };
  const sb = { from: table => {
    assert.equal(table, 'products');
    return { select:()=>({ in: async()=>({data:[row],error:null}) }) };
  } };
  const result = await resolveStoreItems(sb, [{ id:'key-01', qty:21, category:'action figures', scale:'' }]);
  assert.equal(result.ok,true);
  assert.equal(result.items[0].category,'chaveiros');
  assert.equal(result.items[0].qty,21);
});
