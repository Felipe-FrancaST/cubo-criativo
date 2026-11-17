import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSellerCoupon } from '../server/sellerCoupons.js';
import {
  normalizeSellerCouponScope,
  couponAllowsCategory,
  sellerCouponScopeLabel,
  SELLER_COUPON_SCOPES,
} from '../shared/sellerCouponScope.js';

const paths = {
  admin: new URL('../api/admin.js', import.meta.url),
  ui: new URL('../src/pages/admin/affiliates/AdminAffiliatesSection.jsx', import.meta.url),
  custom: new URL('../server/customMiniatures.js', import.meta.url),
  pix: new URL('../server/api_handlers/create-pix-payment.js', import.meta.url),
  card: new URL('../server/api_handlers/create-checkout-session.js', import.meta.url),
  coupons: new URL('../server/api_handlers/coupons.js', import.meta.url),
  sql: new URL('../supabase/migrations/20261117_affiliate_coupon_scopes.sql', import.meta.url),
  normalizer: new URL('../server/sellerCoupons.js', import.meta.url),
};
const text = (name) => fs.readFileSync(paths[name], 'utf8');

test('Tudo cobre produtos, personalizadas e assinatura', () => {
  assert.equal(normalizeSellerCouponScope('all'), 'both');
  for (const category of ['shop','custom','vip']) {
    assert.equal(couponAllowsCategory('both', category), true);
  }
  assert.match(sellerCouponScopeLabel('both'), /Tudo/);
});

test('todos os sete escopos têm categorias esperadas', () => {
  const expected = {
    both: ['shop','custom','vip'],
    shop_only: ['shop'],
    custom_only: ['custom'],
    vip: ['vip'],
    products: ['shop','custom'],
    shop_vip: ['shop','vip'],
    custom_vip: ['custom','vip'],
  };
  assert.equal(Object.keys(SELLER_COUPON_SCOPES).length, Object.keys(expected).length);
  for (const [value, categories] of Object.entries(expected)) {
    for (const category of ['shop','custom','vip']) {
      assert.equal(couponAllowsCategory(value, category), categories.includes(category), `${value}/${category}`);
    }
  }
});

test('cupons existentes continuam com seus comportamentos legados', () => {
  assert.equal(normalizeSellerCouponScope(undefined), 'products');
  assert.equal(couponAllowsCategory('products', 'custom'), true);
  assert.equal(couponAllowsCategory('products', 'vip'), false);
  assert.equal(couponAllowsCategory('vip', 'custom'), false);
  assert.throws(() => normalizeSellerCouponScope('unexpected', { strict: true }));
});

test('frontend administra criação e edição, com status, escopo e preços', () => {
  const ui = text('ui');
  for (const fragment of ['startCouponEdit', 'editingCouponCode', 'original_code', 'Editar cupom', 'Salvar alterações do cupom', 'SELLER_COUPON_SCOPES', 'discount_value', 'setCoupon']) {
    assert.ok(ui.includes(fragment), `UI missing ${fragment}`);
  }
  assert.ok(ui.includes("applies_to: 'both'"), 'novo cupom deve iniciar com Tudo');
});

test('backend edita sem zerar histórico e exige vendedor original', () => {
  const code = text('admin');
  for (const fragment of ["originalCode", ".eq('code', originalCode)", ".eq('affiliate_id', affiliateId)", "const { used_count: _used", "payload.max_uses < Number(existing.used_count", "affiliate_coupon_claims", "coupon_redemptions"]) {
    assert.ok(code.includes(fragment), `API missing ${fragment}`);
  }
  assert.ok(code.includes('normalizeSellerCoupon'));
  assert.ok(text('normalizer').includes('normalizeSellerCouponScope'));
});

test('validação acontece em todos os checkouts e SQL permite novos escopos', () => {
  for (const name of ['custom', 'pix', 'card', 'coupons']) {
    assert.ok(text(name).includes('couponAllowsCategory'), name);
  }
  const sql = text('sql');
  for (const value of ['shop_only','custom_only','shop_vip','custom_vip','both','products','vip']) {
    assert.ok(sql.includes(`'${value}'`), value);
  }
});

test('normalização de criação e atualização não mistura restrições com Tudo', () => {
  const base = { code:'PROMO10', label:'Desconto da Ana', discount_type:'percent', discount_value:10, max_uses:100 };
  const all = normalizeSellerCoupon({ ...base, applies_to:'both', product_ids:['prod-1'], vip_plan_ids:['vip-1'] }, 'seller-1');
  assert.deepEqual(all.product_ids, []);
  assert.deepEqual(all.vip_plan_ids, []);
  assert.equal(all.applies_to, 'both');
  assert.equal(all.source, 'affiliate');
  assert.equal(all.used_count, 0);

  const custom = normalizeSellerCoupon({ ...base, applies_to:'custom_only', product_ids:['prod-1'] }, 'seller-1');
  assert.equal(custom.applies_to, 'custom_only');
  assert.deepEqual(custom.product_ids, []);

  const product = normalizeSellerCoupon({ ...base, applies_to:'shop_only', product_ids:['prod-1','prod-1'] }, 'seller-1');
  assert.deepEqual(product.product_ids, ['prod-1']);

  const vip = normalizeSellerCoupon({ ...base, applies_to:'vip', vip_plan_ids:['vip-1'] }, 'seller-1');
  assert.deepEqual(vip.vip_plan_ids, ['vip-1']);
  assert.deepEqual(vip.product_ids, []);
});

test('normalizador rejeita desconto inválido, escopo desconhecido e limite inválido', () => {
  const base = { code:'ANA20', label:'Ana', discount_type:'percent', discount_value:20, max_uses:100 };
  assert.throws(() => normalizeSellerCoupon({...base, discount_value:120}, 'seller'), /desconto válido/);
  assert.throws(() => normalizeSellerCoupon({...base, max_uses:0}, 'seller'), /Limite de usos/);
  assert.throws(() => normalizeSellerCoupon({...base, applies_to:'qualquer'}, 'seller'), /Selecione onde/);
  assert.throws(() => normalizeSellerCoupon({...base, expires_at:'2026-13-99'}, 'seller'), /Data de validade/);
});
