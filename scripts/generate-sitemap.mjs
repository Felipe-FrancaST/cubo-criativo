import { writeFile } from 'node:fs/promises'
import { buildSitemapXml } from '../server/sitemapXml.js'

// Static fallback and dynamic endpoint share the same public route list.
await writeFile(
  new URL('../public/sitemap.xml', import.meta.url),
  buildSitemapXml(),
  'utf8'
)
console.log('[sitemap] XML estático sincronizado com as rotas públicas.')
