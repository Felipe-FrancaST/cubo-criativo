import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const catalog = read('../src/pages/CatalogPage.jsx')
const stock = read('../src/pages/StockPage.jsx')
const grid = read('../src/components/StorefrontProductGrid.jsx')
const card = read('../src/components/ProductCard.jsx')
const css = read('../src/styles/storefront.css')
const entry = read('../src/main.jsx')

test('catálogo e pronta entrega compartilham grade responsiva isolada', () => {
  for (const page of [catalog, stock]) {
    assert.match(page, /storefront-page/)
    assert.match(page, /<StorefrontSearch/)
    assert.match(page, /<StorefrontProductGrid/)
  }
  assert.match(entry, /styles\/storefront\.css/)
  assert.match(css, /\.storefront-page \.storefront-product-grid/)
  assert.match(css, /@media \(max-width: 639px\)/)
  assert.match(css, /@media \(max-width: 359px\)/)
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/)
})

test('cards mantêm compra, favoritos e escolha de escala', () => {
  assert.match(grid, /<ProductCard/)
  assert.match(grid, /storefrontContext=\{context\}/)
  assert.match(card, /<ScaleSelectionModal/)
  assert.match(card, /needsScale/)
  assert.match(card, /toggleFavorite/)
  assert.match(card, /buyNow\?\.\(p, choice\)/)
  assert.match(card, /addToCart\?\.\(p, chosen\)/)
})

test('buscas e filtros persistem na URL e podem ser limpos', () => {
  assert.match(catalog, /params\.set\('tipo', type\)/)
  assert.match(catalog, /params\.set\('tag', selectedTag\)/)
  assert.match(catalog, /params\.set\('q', query\.trim\(\)\)/)
  assert.match(catalog, /setSelectedTag\('Todos'\)/)
  assert.match(catalog, /aria-modal="true"/)
  assert.match(stock, /url\.searchParams\.set\('q', query\.trim\(\)\)/)
  assert.match(stock, /params\.get\('product'\)/)
})

test('acessibilidade e conteúdo longo em telas pequenas', () => {
  assert.match(css, /overflow-x: clip/)
  assert.match(css, /overflow-wrap: anywhere/)
  assert.match(css, /min-width: 0/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(grid, /aria-busy=\{loading\}/)
})
