import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSitemapXml } from '../server/sitemapXml.js'

test('sitemap inclui páginas públicas canônicas e exclui atalhos privados', () => {
  const xml = buildSitemapXml([])

  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/planos-vip/)
  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/privacy\.html/)
  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/terms\.html/)
  assert.doesNotMatch(xml, /<loc>[^<]*\/vip<\/loc>/)
  assert.doesNotMatch(xml, /politica-de-privacidade/)
  assert.doesNotMatch(xml, /<loc>[^<]*\/termos<\/loc>/)
})

test('sitemap usa updated_at real nos produtos e remove duplicados', () => {
  const xml = buildSitemapXml([
    {
      slug: 'miniatura-teste',
      name: 'Miniatura Teste',
      created_at: '2026-01-10T10:00:00.000Z',
      updated_at: '2026-07-31T12:30:00.000Z',
    },
    {
      slug: 'miniatura-teste',
      name: 'Miniatura Teste duplicada',
      created_at: '2026-01-10T10:00:00.000Z',
    },
  ])

  assert.equal((xml.match(/\/p\/miniatura-teste/g) || []).length, 1)
  assert.match(xml, /<lastmod>2026-07-31T12:30:00\.000Z<\/lastmod>/)
})
