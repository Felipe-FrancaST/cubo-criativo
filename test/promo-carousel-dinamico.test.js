import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getPromotionSlides } from '../src/lib/promoCarousel.js'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('carrossel usa somente imagens de produtos marcados como promoções ativas', () => {
  const slides = getPromotionSlides([
    { id: '1', promo: true, active: true, img: 'https://cdn.example.com/foto1.webp', nome: 'Miniatura A' },
    { id: '2', promo: false, img: 'https://cdn.example.com/normal.webp' },
    { id: '3', promo: true, active: false, img: 'https://cdn.example.com/inativo.webp' },
    { id: '4', promo: true, imgs: ['https://cdn.example.com/foto4.webp'] },
    { id: '5', promo: true, img: '' },
  ])
  assert.deepEqual(slides.map((slide) => slide.id), ['1', '4'])
  assert.deepEqual(slides.map((slide) => slide.carouselImage), [
    'https://cdn.example.com/foto1.webp', 'https://cdn.example.com/foto4.webp',
  ])
})

test('sem promoções não inventa slides estáticos', () => {
  assert.deepEqual(getPromotionSlides([]), [])
  assert.deepEqual(getPromotionSlides(null), [])
  assert.deepEqual(getPromotionSlides([{ promo: false, img: '/images/promo.jpg' }]), [])
})

test('home usa a mesma lista da página promoções', () => {
  const app = read('src/App.jsx')
  const home = read('src/pages/HomePage.jsx')
  const carousel = read('src/components/CarrosselPromo.jsx')
  assert.match(app, /<HomePage[\s\S]*?promocoes=\{promocoes\}/)
  assert.match(app, /<PromocoesPage[\s\S]*?items=\{promocoes\}/)
  assert.match(home, /<CarrosselPromo[^>]*products=\{promocoes\}/)
  assert.match(carousel, /getPromotionSlides\(products\)/)
  assert.doesNotMatch(carousel, /site_carousel_images|\/images\/promo[0-9]*\.jpg/)
  assert.match(carousel, /getVariantPricingCents/)
  assert.match(carousel, /navigateClient\(path\)/)
})

test('fotos inteiras no desktop e celular, controles externos ao link de produto', () => {
  const css = read('src/styles/editorial.css')
  const carousel = read('src/components/CarrosselPromo.jsx')
  assert.match(css, /\.editorial-carousel \.carousel-promo-photo > img \{[^}]*object-fit: contain;/)
  assert.match(css, /\.carousel-promo-photo \{[^}]*aspect-ratio: 4 \/ 3/)
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.carousel-promo-photo \{ aspect-ratio: 5 \/ 4/)
  assert.match(carousel, /<\/a>\s*<\/div>\s*\{slides\.length > 1 && \(/)
  assert.match(carousel, /aria-label="Produto anterior"/)
  assert.match(carousel, /aria-label="Próximo produto"/)
})
