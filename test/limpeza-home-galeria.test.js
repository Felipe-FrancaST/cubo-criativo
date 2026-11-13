import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const home = read('src/pages/HomePage.jsx')
const detail = read('src/pages/ProductPage.jsx')
const carousel = read('src/components/CarrosselPromo.jsx')
const editorialCSS = read('src/styles/editorial.css')
const gallery = read('src/components/GalleryLightbox.jsx')
const galleryCSS = read('src/components/gallery-lightbox.css')
const app = read('src/App.jsx')

test('home retira apenas os três atalhos, mantendo as vitrines e os outros acessos', () => {
  assert.doesNotMatch(home, /className="editorial-shortcuts"/)
  assert.doesNotMatch(home, /Uma seleção especial para sua coleção|Descubra peças disponíveis em nosso estoque|Heróis, criaturas e personagens que ganham vida na mesa/)
  assert.match(home, /<HomeShelf id="destaques"/)
  assert.match(home, /title="Miniaturas RPG"/)
  assert.match(home, /onGoCustomMiniatures/)
})

test('detalhe do produto elimina quadros redundantes, preservando a seleção de escala', () => {
  assert.doesNotMatch(detail, /product-quick-grid|product-quick-item/)
  assert.match(detail, /Escolha a escala/)
  assert.match(detail, /<ScaleSelectionModal/)
  assert.match(detail, /openGallery\?\.\(product, activeImageIndex\)/)
})

test('carrossel não tem seta decorativa e mostra no máximo sete indicadores sem quebra', () => {
  assert.doesNotMatch(carousel, /carousel-promo-cta|carousel-promo-see-product/)
  assert.match(carousel, /Math\.min\(7, count\)/)
  assert.match(carousel, /visibleDots\.map/)
  assert.match(editorialCSS, /\.carousel-promo-dots \{[^}]*flex-wrap: nowrap/)
  assert.match(editorialCSS, /\.carousel-promo-dot \{[^}]*width: 20px/)
  assert.match(carousel, /onClick=\{next\}/)
  assert.match(carousel, /onClick=\{prev\}/)
})

test('galeria no corpo da página abre centralizada por portal, fora do estilo bottom sheet', () => {
  assert.match(app, /<GalleryLightbox/)
  assert.match(gallery, /createPortal\(/)
  assert.match(gallery, /document\.body/)
  assert.match(galleryCSS, /\.cc-gallery-lightbox \{[^}]*place-items: center/)
  assert.match(galleryCSS, /\.cc-gallery-panel \{[^}]*position: relative/)
})

test('galeria contém zoom, gesto de pinça, navegação e teclado', () => {
  for (const action of ['onWheel', 'onPointerDown', 'onPointerMove', 'onDoubleClick', 'pinchDistance', 'cc-gallery-zoom-value', "event.key === 'Escape'", "event.key === 'ArrowRight'"]) {
    assert.ok(gallery.includes(action), action)
  }
  assert.match(galleryCSS, /\.cc-gallery-photo \{[^}]*object-fit: contain/)
  assert.match(gallery, /className="cc-gallery-close"/)
})
