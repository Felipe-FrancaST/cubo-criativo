const PUBLIC_PATHS = new Set([
  '/',
  '/estoque',
  '/catalogo',
  '/promocoes',
  '/planos-vip',
  '/cupom',
  '/contato',
  '/sobre',
  '/faq',
  '/avaliacoes',
  '/trocas-e-devolucoes',
  '/privacy.html',
  '/terms.html',
  '/politica-de-privacidade',
  '/termos',
])
export function sanitizeAnalyticsEvent(event) {
  if (
    typeof navigator !== 'undefined' &&
    (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true)
  )
    return null
  try {
    const url = new URL(event.url)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    const path = url.pathname.replace(/\/$/, '') || '/'
    if (!PUBLIC_PATHS.has(path) && !/^\/p\/[^/]+$/.test(path)) return null
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}

export function safeAnalyticsProps(props = {}) {
  // Never forward account, payment or order identifiers or user-provided text.
  const result = {}
  for (const key of ['price', 'value', 'quantity', 'rating']) {
    if (typeof props[key] === 'number' && Number.isFinite(props[key]))
      result[key] = props[key]
  }
  const allowed = {
    location: ['menu', 'header', 'header_mobile', 'contato', 'footer'],
    page: ['privacy', 'terms'],
    platform: ['instagram', 'tiktok', 'whatsapp'],
  }
  for (const [key, values] of Object.entries(allowed)) {
    if (values.includes(props[key])) result[key] = props[key]
  }
  return result
}
