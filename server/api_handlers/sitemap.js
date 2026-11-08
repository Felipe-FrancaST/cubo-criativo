import { supabaseAdmin } from '../supabase.js'
import { buildSitemapXml } from '../sitemapXml.js'

const PAGE_SIZE = 500

// Stable ordering and pagination prevent the database row limit from truncating SEO URLs.
export async function fetchSitemapProducts(sb = supabaseAdmin()) {
  let includeUpdatedAt = true
  let products = []
  let offset = 0
  while (true) {
    const response = await sb
      .from('products')
      .select(
        includeUpdatedAt
          ? 'id,slug,name,created_at,updated_at'
          : 'id,slug,name,created_at'
      )
      .eq('active', true)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (response.error) {
      const { code, message = '' } = response.error
      if (
        includeUpdatedAt &&
        ['42703', 'PGRST204'].includes(code) &&
        /updated_at/i.test(message)
      ) {
        includeUpdatedAt = false
        products = []
        offset = 0
        continue
      }
      throw response.error
    }
    const rows = Array.isArray(response.data) ? response.data : []
    if (!rows.length) return products
    products.push(...rows)
    // Continue even after a short page: installations can have a lower API row cap.
    offset += rows.length
  }
}

export default async function handleSitemap(req, res) {
  if (!req || !res) return
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }

  let products = []
  let degraded = false
  try {
    products = await fetchSitemapProducts()
  } catch (error) {
    degraded = true
    console.error('sitemap products error', error)
  }

  const xml = buildSitemapXml(products)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  // Don't keep an incomplete sitemap cached for a day after a temporary outage.
  res.setHeader(
    'Cache-Control',
    degraded ? 'no-store' : 'public, s-maxage=900, stale-while-revalidate=86400'
  )
  if (req.method === 'HEAD') return res.status(200).end()
  return res.status(200).send(xml)
}
