import test from 'node:test';
import assert from 'node:assert/strict';
import { packShipment } from '../server/shipping.js';
import { validateScaleRules, DEFAULT_SCALE_RULES, normalizedScale } from '../server/shippingScaleRules.js';

const customBoxes = {
  box_action_25: { length: 32, width: 26, height: 25, weight: 2.5 },
  box_mini_28_small: { length: 14, width: 12, height: 10, weight: 0.25 },
  box_mini_28_big: { length: 25, width: 20, height: 15, weight: 0.8 },
};
const customRules = [
  ...DEFAULT_SCALE_RULES,
  { id: 'action_25cm', kind: 'action', scale: '25 cm', package_key: 'box_action_25' },
  { id: 'miniature_28mm', kind: 'miniature', scale: '28 mm', small_package_key: 'box_mini_28_small', large_package_key: 'box_mini_28_big', small_limit: 3, large_limit: 8 },
];
const settings = { packages: customBoxes, scale_rules: customRules };

test('criação de novas escalas com caixa própria valida as referências', () => {
  assert.equal(normalizedScale('25cm'), '25 cm');
  assert.equal(normalizedScale('28 mm'), '28 mm');
  assert.equal(validateScaleRules(customRules, {
    ...customBoxes,
    action_10: {}, action_12: {}, action_15: {}, action_20: {}, miniature_small: {}, miniature_large: {},
  }).length, 7);
});

test('action figure nova de 25cm gera uma caixa personalizada por peça', () => {
  const result = packShipment({ type: 'shop', items: [{ name: 'Dragão', scale: '25 cm', qty: 2 }], settings });
  assert.equal(result.parcels.length, 2);
  for (const parcel of result.parcels) assert.deepEqual([parcel.length, parcel.width, parcel.height, parcel.weight], [32,26,25,2.5]);
  assert.equal(result.feeCategory, 'other');
});

test('miniaturas 28mm agrupam em caixas configuradas e não misturam escalas', () => {
  const result = packShipment({ type: 'shop', items: [
    { name: 'Miniatura goblin', category: 'Miniaturas RPG', scale: '28 mm', qty: 10 },
    { name: 'Miniatura orc', category: 'Miniaturas RPG', scale: '32 mm', qty: 2 },
  ], settings });
  assert.equal(result.parcels.length, 3);
  assert.deepEqual(result.parcels.map(p => p.quantity), [8, 2, 2]);
  assert.equal(result.parcels[0].length, 25);
  assert.equal(result.parcels[1].length, 14);
  assert.equal(result.parcels[2].length, 13);
  assert.equal(result.feeCategory, 'mini');
});

test('não permite escalas duplicadas, caixas desconhecidas ou limites inconsistentes', () => {
  assert.throws(() => validateScaleRules([customRules[0], { ...customRules[0], id: 'action_10cm_duplicate' }], { action_10: {} }), /já está cadastrada/);
  assert.throws(() => validateScaleRules([{ id: 'action_25cm', kind: 'action', scale: '25 cm', package_key: 'desconhecida' }], {}), /caixa existente/);
  assert.throws(() => validateScaleRules([{ id: 'mini_28mm', kind: 'miniature', scale: '28 mm', small_package_key: 'a', large_package_key: 'b', small_limit: 10, large_limit: 5 }], { a: {}, b: {} }), /quantidades válidas/);
});

test('escala sem caixa cadastrada não recebe frete fictício', () => {
  assert.throws(() => packShipment({ type: 'shop', items: [{ name: 'Figure', qty: 1, scale: '35 cm' }], settings }), /Não há embalagem cadastrada/);
});

test('escala legada apenas com número mantém action figure correspondente', () => {
  const result = packShipment({ type: 'shop', items: [{ name: 'Figure', qty: 1, scale: '10' }], settings });
  assert.equal(result.parcels[0].length, 20);
});

test('a cotação não filtra Jadlog nem Loggi quando retornadas pela SuperFrete', async () => {
  const previousFetch = globalThis.fetch;
  const previousToken = process.env.SUPERFRETE_TOKEN;
  const previousAgent = process.env.SUPERFRETE_USER_AGENT;
  process.env.SUPERFRETE_TOKEN = 'test-only-token';
  process.env.SUPERFRETE_USER_AGENT = 'CuboTeste/1.0 (test@example.com)';
  const { getShippingQuote } = await import('../server/shipping.js');
  let requestedServices = '';
  globalThis.fetch = async (_url, options) => {
    requestedServices = JSON.parse(options.body).services;
    return { ok: true, json: async () => [
      { id: 3, name: 'Package', price: 18.5, delivery_time: 5, company: { name: 'Jadlog' } },
      { id: 31, name: 'Loggi Econômico', price: 22.5, delivery_time: 3, company: { name: 'Loggi' } },
      { id: 2, name: 'SEDEX', price: 30, delivery_time: 2, company: { name: 'Correios' } },
    ] };
  };
  const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
    origin_zip: '47803604', services: '1,2,3,17,31', mini_fee_cents: 500, other_fee_cents: 1000, enabled: true,
  } }) }) }) }) };
  try {
    const quote = await getShippingQuote(sb, { destinationZip: '01001000', type: 'shop', items: [{ name: 'Figure 10 cm', qty: 1, scale: '10 cm' }] });
    assert.equal(requestedServices, '1,2,3,17,31');
    assert.deepEqual(quote.options.map(o => o.carrier), ['Jadlog', 'Loggi', 'Correios']);
    assert.equal(quote.options[0].price_cents, 2850);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.SUPERFRETE_TOKEN;
    else process.env.SUPERFRETE_TOKEN = previousToken;
    if (previousAgent === undefined) delete process.env.SUPERFRETE_USER_AGENT;
    else process.env.SUPERFRETE_USER_AGENT = previousAgent;
  }
});
