import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const home = read('src/pages/HomePage.jsx')
const carousel = read('src/components/CarrosselPromo.jsx')
const css = read('src/styles/editorial.css')

test('banner VIP é o primeiro bloco da home, antes do hero e das vitrines', () => {
  const container = home.indexOf('className="container-cc editorial-container"')
  const banner = home.indexOf('className="editorial-vip-banner"', container)
  const hero = home.indexOf('className="editorial-hero-grid"', container)
  const shelf = home.indexOf('<HomeShelf id="destaques"', container)
  assert.ok(container > -1 && banner > container && hero > banner && shelf > hero)
  assert.equal((home.match(/className="editorial-vip-banner"/g) || []).length, 1)
})

test('banner respeita a largura da tela e preserva a proporção natural', () => {
  assert.match(css, /\.editorial-vip-media > img \{[^}]*width: 100%;[^}]*height: auto;[^}]*object-fit: contain/)
  assert.doesNotMatch(css, /\.editorial-vip-media\s*\{[^}]*height\s*:/)
  assert.doesNotMatch(css, /\.editorial-vip-media > img\s*\{[^}]*object-fit:\s*cover/)
  assert.match(home, /loading="eager"/)
  assert.match(home, /FALLBACK_BANNER\.mobile_image_url/)
})

test('carrossel mantém todo o slide visível e navegação sem tapar a arte', () => {
  assert.match(home, /<CarrosselPromo[^>]*fit="contain"/)
  assert.match(carousel, /className="carousel-promo-viewport relative" style=\{\{ aspectRatio: activeRatio \}\}/)
  assert.match(carousel, /naturalWidth\s*,\s*naturalHeight/)
  assert.match(carousel, /objectFit: fit/)
  assert.match(carousel, /className="carousel-promo-controls"/)
  assert.doesNotMatch(carousel, /h-\[280px\]/)
  assert.doesNotMatch(css, /\.editorial-carousel \.carousel-promo-viewport \{[^}]*height:\s*\d+px/)
})

test('banner continua clicável e controles do carrossel não navegam ao tocar', () => {
  assert.match(home, /onGoVipPlans/)
  assert.match(carousel, /event\.stopPropagation\(\); prev\(\);/)
  assert.match(carousel, /event\.stopPropagation\(\); next\(\);/)
  assert.match(carousel, /event\.stopPropagation\(\); setI\(idx\);/)
  assert.match(css, /\.carousel-promo-control:focus-visible/)
})
