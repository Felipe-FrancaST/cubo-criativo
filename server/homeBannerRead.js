// Leitura pública independente das operações de upload e da autorização administrativa.
export const BUCKET = 'site-assets'
export const CONFIG_PATH = 'home-banners/config.json'
export const DEFAULT_BANNER = {
  image_url: '/images/banner_base_pc.jpg',
  mobile_image_url: '/images/banner_base.jpg',
}

export function missingStorageObject(error) {
  const status = Number(error?.statusCode || error?.status || error?.originalError?.status)
  return status === 404 || /not found|does not exist|no such (key|bucket)/i.test(String(error?.message || ''))
}

function isBannerImage(value) {
  return typeof value === 'string' && (Object.values(DEFAULT_BANNER).includes(value) || /^https:\/\//i.test(value))
}

export class InvalidBannerConfig extends Error {}

export async function readBanner(sb) {
  const { data, error } = await sb.storage.from(BUCKET).download(CONFIG_PATH)
  if (error) {
    if (missingStorageObject(error)) return null
    throw error
  }
  if (!data) return null
  // O arquivo é pequeno e contém apenas os dois endereços públicos.
  const raw = await data.text()
  let config
  try { config = JSON.parse(raw.replace(/^\uFEFF/, '')) }
  catch { throw new InvalidBannerConfig('JSON de banner inválido.') }
  if (!config || ![config.image_url, config.mobile_image_url].every(isBannerImage)) {
    throw new InvalidBannerConfig('Configuração de banner inválida.')
  }
  return { image_url: config.image_url, mobile_image_url: config.mobile_image_url }
}

export async function readLegacyBanner(sb) {
  const now = new Date().toISOString()
  const { data, error } = await sb.from('home_banners')
    .select('image_url,mobile_image_url')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  // Instalações novas podem não possuir a tabela legada.
  if (error && !['42P01', 'PGRST205'].includes(error.code)) throw error
  if (!data) return null
  return Object.fromEntries(Object.entries(DEFAULT_BANNER).map(([key, fallback]) => [key, isBannerImage(data[key]) ? data[key] : fallback]))
}

function reportBannerFailure(stage, error) {
  // Não enviar detalhes de infraestrutura ao visitante.
  console.warn(`[home-banner] ${stage}:`, error?.code || error?.statusCode || error?.name || 'unknown', error?.message || '')
}

export async function resolvePublicBanner(getClient, report = reportBannerFailure) {
  let degraded = false
  let sb
  try { sb = getClient() }
  catch (error) {
    report('client', error)
    // O frontend ainda pode consultar a tabela pública com sua própria configuração.
    return { banner: null, source: 'client-fallback', degraded: true }
  }
  try {
    const banner = await readBanner(sb)
    if (banner) return { banner, source: 'storage', degraded }
  } catch (error) {
    degraded = true
    report('storage', error)
  }
  try {
    const banner = await readLegacyBanner(sb)
    if (banner) return { banner, source: 'legacy', degraded }
  } catch (error) {
    degraded = true
    report('legacy', error)
    return { banner: null, source: 'client-fallback', degraded }
  }
  return { banner: { ...DEFAULT_BANNER }, source: 'default', degraded }
}

export async function readAdminBanner(sb) {
  try {
    const config = await readBanner(sb)
    if (config) return config
  } catch (error) {
    // Permite reparar uma configuração inválida pelo painel. Erros de acesso
    // reais continuam bloqueando a gravação para não sobrescrever dados válidos.
    if (!(error instanceof InvalidBannerConfig)) throw error
    reportBannerFailure('invalid config (admin)', error)
  }
  return await readLegacyBanner(sb) || { ...DEFAULT_BANNER }
}
