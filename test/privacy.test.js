import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import {
  sanitizeAnalyticsEvent,
  safeAnalyticsProps,
} from '../src/lib/analyticsPrivacy.js'
import { legalDocuments } from '../src/data/legal.js'

test('métricas removem tokens e parâmetros, sem alterar a URL original', () => {
  const event = {
    type: 'pageview',
    url: 'https://loja.test/catalogo?email=cliente@example.com#access_token=secret',
  }
  assert.equal(sanitizeAnalyticsEvent(event).url, 'https://loja.test/catalogo')
  assert.match(event.url, /access_token/)
  assert.equal(sanitizeAnalyticsEvent({ type: 'event', url: 'invalid' }), null)
})
test('métricas não enviam rotas privadas ou propriedades de identificação', () => {
  for (const path of [
    '/admin',
    '/area-vip',
    '/meus-pedidos',
    '/pagamento-pedido',
    '/redefinir-senha',
    '/v/cliente',
  ]) {
    assert.equal(
      sanitizeAnalyticsEvent({
        type: 'pageview',
        url: `https://loja.test${path}?id=secret`,
      }),
      null
    )
  }
  assert.deepEqual(
    safeAnalyticsProps({
      order_id: 'secret',
      email: 'cliente@example.com',
      rating: 5,
      location: 'menu',
      route: '/admin',
      product_name: 'private',
    }),
    { rating: 5, location: 'menu' }
  )
})
test('métricas respeitam Do Not Track', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    value: { doNotTrack: '1' },
    configurable: true,
  })
  try {
    assert.equal(
      sanitizeAnalyticsEvent({ type: 'pageview', url: 'https://loja.test/' }),
      null
    )
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous)
    else delete globalThis.navigator
  }
})
test('políticas estáticas contêm o mesmo conteúdo e links acessíveis da fonte central', async () => {
  for (const key of ['privacy', 'terms']) {
    const doc = legalDocuments[key]
    const html = await readFile(
      new URL(`../public${doc.path}`, import.meta.url),
      'utf8'
    )
    const dom = new JSDOM(html)
    assert.equal(dom.window.document.querySelectorAll('h1').length, 1)
    for (const [, paragraphs] of doc.sections)
      for (const text of paragraphs)
        assert.ok(dom.window.document.body.textContent.includes(text))
    for (const anchor of dom.window.document.querySelectorAll('a[href^="#"]'))
      assert.ok(dom.window.document.querySelector(anchor.getAttribute('href')))
    assert.ok(
      dom.window.document.querySelector(
        'a[href="mailto:cubocriativosuporte@gmail.com"]'
      )
    )
    assert.ok(
      dom.window.document.querySelector('a[href="https://wa.me/5577998472372"]')
    )
    dom.window.close()
  }
})
