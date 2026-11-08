import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSitemapXml } from '../server/sitemapXml.js'

test('sitemap inclui páginas públicas canônicas e exclui atalhos privados', () => {
  const xml = buildSitemapXml([])

  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/planos-vip/)
  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/privacy\.html/)
  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/terms\.html/)
  assert.match(xml, /https:\/\/www\.cubocriativo3d\.com\.br\/avaliacoes/)
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

test('XML estático e endpoint usam as mesmas páginas públicas', async () => {
  const { readFile } = await import('node:fs/promises')
  assert.equal(
    await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
    buildSitemapXml()
  )
})

function mockDatabase(
  rows,
  { cap = 500, missingColumn = false, error = null } = {}
) {
  const calls = []
  return {
    calls,
    from(table) {
      assert.equal(table, 'products')
      let fields
      const query = {
        select(value) {
          fields = value
          return query
        },
        eq(key, value) {
          assert.equal(key, 'active')
          assert.equal(value, true)
          return query
        },
        order(key, options) {
          assert.equal(key, 'id')
          assert.equal(options.ascending, true)
          return query
        },
        async range(start, end) {
          calls.push({ start, end, fields })
          if (error) return { error }
          if (missingColumn && fields.includes('updated_at'))
            return {
              error: {
                code: '42703',
                message: 'column products.updated_at does not exist',
              },
            }
          return {
            data: rows.slice(start, Math.min(end + 1, start + cap)),
            error: null,
          }
        },
      }
      return query
    },
  }
}

test('sitemap pagina mais de mil produtos mesmo com limite de resposta menor', async () => {
  const { fetchSitemapProducts } =
    await import('../server/api_handlers/sitemap.js')
  const rows = Array.from({ length: 1201 }, (_, id) => ({
    id,
    slug: `peca-${id}`,
  }))
  const db = mockDatabase(rows, { cap: 200 })
  assert.deepEqual(await fetchSitemapProducts(db), rows)
  assert.equal(db.calls.at(-1).start, 1201)
  assert.match(buildSitemapXml(rows), /\/p\/peca-1200/)
})

test('sitemap usa compatibilidade somente para coluna updated_at ausente', async () => {
  const { fetchSitemapProducts } =
    await import('../server/api_handlers/sitemap.js')
  const rows = [{ id: 1, slug: 'dragao', created_at: '2026-01-01' }]
  const db = mockDatabase(rows, { missingColumn: true })
  assert.deepEqual(await fetchSitemapProducts(db), rows)
  assert.equal(db.calls[1].fields.includes('updated_at'), false)
  assert.equal(db.calls[1].start, 0)
  const broken = mockDatabase([], {
    error: { code: '42501', message: 'permission denied' },
  })
  await assert.rejects(fetchSitemapProducts(broken), { code: '42501' })
  assert.equal(broken.calls.length, 1)
})
