import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleAdminHomeBanner,
  validBannerUrl,
  DEFAULT_BANNER,
} from '../server/homeBanner.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.body = value
      return this
    },
  }
}
function fakeStorage() {
  let config = { ...DEFAULT_BANNER }
  let writes = 0
  const bucket = {
    async download() {
      return { data: new Blob([JSON.stringify(config)]) }
    },
    async upload(_path, json) {
      writes++
      config = JSON.parse(json)
      return { error: null }
    },
    async createSignedUploadUrl() {
      return { data: { token: 'signed-token' } }
    },
    getPublicUrl(path) {
      return {
        data: {
          publicUrl: `https://project.supabase.co/storage/v1/object/public/site-assets/${path}`,
        },
      }
    },
  }
  return {
    get config() {
      return config
    },
    get writes() {
      return writes
    },
    client: {
      storage: {
        from: () => bucket,
        getBucket: async () => ({ data: { public: true } }),
      },
    },
  }
}
const allowed = async (_req, level) => {
  assert.equal(level, 2)
  return { ok: true }
}

test('banner bloqueia escrita de operador antes de acessar o storage', async () => {
  const res = response()
  await handleAdminHomeBanner(
    { method: 'POST', body: { operation: 'save' } },
    res,
    {
      authorize: async () => ({
        ok: false,
        status: 403,
        error: 'Acesso negado',
      }),
      getClient: () => {
        throw new Error('Não deve acessar storage')
      },
    }
  )
  assert.equal(res.statusCode, 403)
})
test('upload valida formato e tamanho antes de emitir autorização', async () => {
  for (const payload of [
    { contentType: 'image/svg+xml', size: 100 },
    { contentType: 'image/png', size: 9 * 1024 * 1024 },
    { contentType: '__proto__', size: 100 },
  ]) {
    const storage = fakeStorage()
    const res = response()
    await handleAdminHomeBanner(
      { method: 'POST', body: { operation: 'upload', ...payload } },
      res,
      { authorize: allowed, getClient: () => storage.client }
    )
    assert.equal(res.statusCode, 400)
  }
  const storage = fakeStorage()
  const res = response()
  await handleAdminHomeBanner(
    {
      method: 'POST',
      body: { operation: 'upload', contentType: 'image/webp', size: 123 },
    },
    res,
    { authorize: allowed, getClient: () => storage.client }
  )
  assert.equal(res.body.token, 'signed-token')
  assert.match(res.body.path, /^home-banners\/.*\.webp$/)
})
test('salva imagens independentes e rejeita endereço externo', async () => {
  const storage = fakeStorage()
  const res = response()
  await handleAdminHomeBanner(
    { method: 'POST', body: { operation: 'save', ...DEFAULT_BANNER } },
    res,
    { authorize: allowed, getClient: () => storage.client }
  )
  assert.equal(res.statusCode, 200)
  assert.deepEqual(storage.config, DEFAULT_BANNER)
  const rejected = response()
  await handleAdminHomeBanner(
    {
      method: 'POST',
      body: {
        operation: 'save',
        ...DEFAULT_BANNER,
        image_url: 'https://evil.example/x.png',
      },
    },
    rejected,
    { authorize: allowed, getClient: () => storage.client }
  )
  assert.equal(rejected.statusCode, 400)
  assert.equal(storage.writes, 1)
  assert.ok(
    validBannerUrl(
      'https://project.supabase.co/storage/v1/object/public/site-assets/home-banners/abc-123.png',
      'https://project.supabase.co'
    )
  )
  assert.equal(
    validBannerUrl(
      'https://evil.example/storage/v1/object/public/site-assets/home-banners/abc.png',
      'https://project.supabase.co'
    ),
    false
  )
})
