import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const content = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('administração oferece chaveiros como categoria de produto', () => {
  assert.match(content('src/pages/admin/products/AdminProductsSection.jsx'), /<option value="chaveiros">Chaveiros<\/option>/);
});

test('catálogo possui filtro específico para chaveiros', () => {
  const catalog = content('src/pages/CatalogPage.jsx');
  assert.match(catalog, /category === 'chaveiros'/);
  assert.match(catalog, /\{ id: 'chaveiros', label: 'Chaveiros' \}/);
});

test('administração exibe a caixa Mini Envios e explica a capacidade', () => {
  const section = content('src/pages/admin/shipping/AdminShippingSection.jsx');
  assert.match(section, /keychain_mini: \{ length: 24, width: 16, height: 4, weight: 0\.3 \}/);
  assert.match(section, /até 20 unidades por caixa Mini Envios/);
});
