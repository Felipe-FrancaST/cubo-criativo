import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase.js'
import { requireAdmin, ADMIN_LEVEL } from './admin/adminAuth.js'

const BUCKET = 'site-assets'
const CONFIG_PATH = 'home-banners/config.json'
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const MAX_BANNER_BYTES = 8 * 1024 * 1024
export const DEFAULT_BANNER = {
  image_url: '/images/banner_base_pc.jpg',
  mobile_image_url: '/images/banner_base.jpg',
}

export function validBannerUrl(value, origin = process.env.SUPABASE_URL) {
  if (Object.values(DEFAULT_BANNER).includes(value)) return true
  try {
    const url = new URL(value)
    return (
      url.origin === new URL(origin).origin &&
      /^\/storage\/v1\/object\/public\/site-assets\/home-banners\/[a-f0-9-]+\.(jpg|png|webp)$/.test(
        url.pathname
      ) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
function missing(error) {
  return (
    [400, 404].includes(Number(error?.statusCode || error?.status)) ||
    /not found|does not exist/i.test(String(error?.message || ''))
  )
}
async function readBanner(sb) {
  const { data, error } = await sb.storage.from(BUCKET).download(CONFIG_PATH)
  if (error) {
    if (missing(error)) return null
    throw error
  }
  const config = JSON.parse(await data.text())
  if (
    ![config.image_url, config.mobile_image_url].every(
      (value) =>
        Object.values(DEFAULT_BANNER).includes(value) ||
        /^https:\/\//i.test(String(value))
    )
  )
    throw new Error('Configuração de banner inválida.')
  return config
}
async function ensureBucket(sb) {
  const { data, error } = await sb.storage.getBucket(BUCKET)
  if (data) {
    if (!data.public)
      throw new Error(
        'O bucket site-assets precisa ser público para exibir os banners.'
      )
    return
  }
  if (error && !missing(error)) throw error
  const created = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BANNER_BYTES,
    allowedMimeTypes: [...Object.keys(TYPES), 'application/json'],
  })
  if (
    created.error &&
    !/already exists|duplicate/i.test(created.error.message || '')
  )
    throw created.error
}
async function body(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body || {}
}
export async function handlePublicHomeBanner(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    return res.status(200).json({ banner: await readBanner(supabaseAdmin()) })
  } catch {
    return res
      .status(503)
      .json({ error: 'Não foi possível carregar o banner.' })
  }
}
export async function handleAdminHomeBanner(
  req,
  res,
  { authorize = requireAdmin, getClient = supabaseAdmin } = {}
) {
  if (!['GET', 'POST'].includes(req.method))
    return res.status(405).json({ error: 'Method not allowed' })
  const auth = await authorize(req, ADMIN_LEVEL.MANAGER)
  if (!auth.ok)
    return res.status(auth.status || 403).json({ error: auth.error })
  res.setHeader('Cache-Control', 'no-store')
  const sb = getClient()
  if (req.method === 'GET') {
    let config = await readBanner(sb)
    if (!config) {
      // Start from the same legacy image the home currently displays.
      const now = new Date().toISOString()
      const legacy = await sb
        .from('home_banners')
        .select('image_url,mobile_image_url')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      config = { ...DEFAULT_BANNER, ...(legacy.data || {}) }
    }
    return res.status(200).json({ banner: config })
  }
  const payload = await body(req)
  if (payload.operation === 'upload') {
    const extension = Object.hasOwn(TYPES, payload.contentType)
      ? TYPES[payload.contentType]
      : null
    if (
      !extension ||
      !Number.isInteger(payload.size) ||
      payload.size <= 0 ||
      payload.size > MAX_BANNER_BYTES
    )
      return res
        .status(400)
        .json({ error: 'Envie JPG, PNG ou WebP de até 8 MB.' })
    await ensureBucket(sb)
    const path = `home-banners/${randomUUID()}.${extension}`
    const result = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
    if (result.error) throw result.error
    return res.status(200).json({
      path,
      token: result.data.token,
      bucket: BUCKET,
      publicUrl: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    })
  }
  if (payload.operation !== 'save')
    return res.status(400).json({ error: 'Operação inválida.' })
  // Permit existing legacy values only if unchanged; new values must be our uploaded images.
  let previous = await readBanner(sb)
  if (!previous) {
    const now = new Date().toISOString()
    const legacy = await sb
      .from('home_banners')
      .select('image_url,mobile_image_url')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    previous = { ...DEFAULT_BANNER, ...(legacy.data || {}) }
  }
  const config = {}
  for (const key of ['image_url', 'mobile_image_url']) {
    const value = String(payload[key] || DEFAULT_BANNER[key]).trim()
    if (!validBannerUrl(value) && value !== previous[key])
      return res
        .status(400)
        .json({ error: 'Escolha uma imagem enviada pelo painel.' })
    config[key] = value
  }
  await ensureBucket(sb)
  const result = await sb.storage
    .from(BUCKET)
    .upload(CONFIG_PATH, JSON.stringify(config), {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '0',
    })
  if (result.error) throw result.error
  return res.status(200).json({ banner: config })
}
