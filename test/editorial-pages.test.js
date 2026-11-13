import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const home = read('src/pages/HomePage.jsx')
const shelf = read('src/components/HomeShelf.jsx')
const offers = read('src/pages/PromocoesPage.jsx')
const promoCard = read('src/components/PromoProductCard.jsx')
const reviews = read('src/pages/ReviewsPage.jsx')
const reviewCard = read('src/components/ReviewCard.jsx')
const faq = read('src/pages/FAQPage.jsx')
const game = read('src/pages/CupomGamePage.jsx')
const styles = read('src/styles/editorial.css')
const app = read('src/App.jsx')

test('nova home mantém navegação e quatro vitrines importantes', () => {
  for (const token of ['onGoEstoque', 'onGoCatalogo', 'onGoPromocoes', 'onGoCustomMiniatures', 'onGoCupom', 'onGoVipPlans', 'onGoSobEncomenda', 'onGoReviews', 'onGoFaq']) {
    assert.ok(home.includes(token), token)
  }
  assert.match(home, /HomeShelf id="destaques"/)
  assert.match(home, /products=\{prontaEntregaPreview\}/)
  assert.match(home, /products=\{rpgPreview\}/)
  assert.match(home, /<CarrosselPromo/)
  assert.match(home, /<ReviewCard/)
})

test('vitrines preservam fluxo de escala, carrinho e compra com ProductCard', () => {
  assert.match(shelf, /<ProductCard/)
  for (const action of ['addToCart={addToCart}', 'buyNow={buyNow}', 'onRequireLogin={onRequireLogin}']) assert.ok(shelf.includes(action))
  assert.match(shelf, /storefrontContext="home"/)
})

test('página de promoções usa grid de cartões consistente e não altera as compras', () => {
  assert.match(offers, /storefront-product-grid editorial-offers-grid/)
  assert.match(offers, /<PromoProductCard/)
  assert.match(offers, /onRequireLogin={onRequireLogin}/)
  assert.match(promoCard, /storefrontContext="offers"/)
  assert.match(promoCard, /promotion showFavorite={false}/)
  assert.match(app, /<PromocoesPage[\s\S]*?onRequireLogin=\{/)
})

test('avaliações só mostram reviews retornadas pela API pública ou aprovadas', () => {
  assert.match(reviews, /customer_reviews_public/)
  assert.match(reviews, /\.eq\('approved', true\)/)
  assert.match(reviews, /ratingFilter === 'all'/)
  assert.match(reviews, /<ReviewCard/)
  assert.match(reviewCard, /encodeURIComponent\(slug\)/)
  assert.match(reviewCard, /Math\.min\(5/)
})

test('FAQ mantém perguntas existentes e oferece filtros acessíveis', () => {
  for (const phrase of ['cancelamento ou devolução', 'VIP renova', 'prazo de produção', 'todo o Brasil', 'frágeis', 'orçamento personalizado', 'formas de pagamento', 'acompanho meu pedido']) assert.ok(faq.includes(phrase), phrase)
  assert.match(faq, /type="search"/)
  assert.match(faq, /aria-pressed={category === item}/)
  assert.match(faq, /<details key={item.q}/)
})

test('Cubo Game preserva backend de regras, cupons e partidas', () => {
  for (const action of ['memoryGameReducer', 'game-status', 'game-complete', 'MAX_GAME_ERRORS', 'copyCoupon', 'onRequireLogin']) assert.ok(game.includes(action), action)
  assert.match(game, /editorial-game-cards/)
  assert.match(game, /aria-pressed={revealed}/)
})

test('CSS está isolado nas páginas alteradas, não muda compras nem administração', () => {
  assert.match(styles, /\.editorial-page/)
  assert.match(styles, /\.editorial-game/)
  assert.match(styles, /\.editorial-faq-search/)
  assert.match(styles, /\.editorial-review-grid/)
  assert.match(styles, /\.editorial-page \.editorial-faq-search input/)
  assert.ok(read('src/main.jsx').includes("import './styles/editorial.css'"))
})

test('estilos para mobile contemplam 320px e reduzem quebras', () => {
  assert.match(styles, /@media \(max-width: 639px\)/)
  assert.match(styles, /@media \(max-width: 359px\)/)
  assert.match(styles, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(styles, /\.editorial-game \.game-stats \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(styles, /\.editorial-faq-categories \{ flex-wrap: nowrap; overflow-x: auto/)
  assert.match(styles, /prefers-reduced-motion/)
})

test('viewport do carrossel mantém altura correta com alertas de carregamento', () => {
  assert.match(read('src/components/CarrosselPromo.jsx'), /carousel-promo-viewport/)
  assert.match(styles, /\.editorial-carousel \.carousel-promo-viewport/)
  assert.doesNotMatch(styles, /\.editorial-carousel > div:first-of-type/)
})
