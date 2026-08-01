import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerOrderPath,
  buildPublicReviewName,
  buildReviewPath,
  clampReviewRating,
  extractReviewProductRefs,
  normalizeReviewComment,
  reviewVisibilityLabel,
} from '../src/lib/reviews.js';
import { buildOrderDetailsUrl, buildReviewUrl, buildVipAreaUrl } from '../server/orderLinks.js';

test('links do cliente apontam para pedido e avaliação específicos', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  assert.equal(buildCustomerOrderPath(id), `/meus-pedidos?pedido=${id}`);
  assert.equal(buildReviewPath(id), `/avaliar-pedido?pedido=${id}`);
  assert.equal(buildOrderDetailsUrl('https://loja.test/', id), `https://loja.test/meus-pedidos?pedido=${id}`);
  assert.equal(buildReviewUrl('https://loja.test/', id), `https://loja.test/avaliar-pedido?pedido=${id}`);
  assert.equal(buildVipAreaUrl('https://loja.test/'), 'https://loja.test/area-vip');
});

test('dados de produtos da avaliação são normalizados sem duplicatas', () => {
  const refs = extractReviewProductRefs([
    { product_id: '11111111-2222-4333-8444-555555555555', slug: 'ranger', name: 'Ranger' },
    { product_id: 'ranger', slug: 'ranger', product_name: 'Ranger' },
  ]);
  assert.deepEqual(refs.productIds, ['11111111-2222-4333-8444-555555555555']);
  assert.deepEqual(refs.productSlugs, ['ranger']);
  assert.deepEqual(refs.productNames, ['Ranger']);
});

test('nota e comentário respeitam os limites', () => {
  assert.equal(clampReviewRating(9), 5);
  assert.equal(clampReviewRating(0), 1);
  assert.equal(normalizeReviewComment('  ótima   peça  '), 'ótima peça');
  assert.equal(normalizeReviewComment('a'.repeat(600)).length, 500);
});


test('nome público não expõe e-mail e reduz sobrenome', () => {
  assert.equal(buildPublicReviewName('Felipe França'), 'Felipe F.');
  assert.equal(buildPublicReviewName('cliente@example.com'), 'Cliente verificado');
  assert.equal(buildPublicReviewName('Ana'), 'Ana');
});


test('cliente vê apenas o status Avaliado, sem informação sobre moderação', async () => {
  assert.equal(reviewVisibilityLabel({ approved: false }), 'Avaliado');
  assert.equal(reviewVisibilityLabel({ approved: true, featured: true }), 'Avaliado');

  const { readFile } = await import('node:fs/promises');
  const customerFiles = [
    '../src/pages/ReviewPage.jsx',
    '../src/components/OrdersModal.jsx',
    '../src/components/ProfileSettingsModal.jsx',
  ];
  for (const relativePath of customerFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /aguardando aprovação|enviada para aprovação|depois da aprovação|depois da moderação|voltam para análise/i);
  }
});

test('SQL exige pedido entregue, moderação e exposição apenas de avaliações aprovadas', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../SQL_AVALIACOES.sql', import.meta.url), 'utf8');
  assert.match(sql, /production_status[\s\S]*entregue/i);
  assert.match(sql, /where approved = true/i);
  assert.match(sql, /grant select on public\.customer_reviews_public to anon, authenticated/i);
  assert.doesNotMatch(sql, /grant select[^;]*customer_reviews to anon/i);
});

test('rotas privadas de pedido e avaliação recebem noindex na Vercel', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = new Map((config.headers || []).map((item) => [item.source, item.headers || []]));
  for (const route of ['/meus-pedidos', '/avaliar-pedido']) {
    assert.ok(headers.has(route));
    assert.ok(headers.get(route).some((header) => header.key === 'X-Robots-Tag' && /noindex/i.test(header.value)));
  }
});
