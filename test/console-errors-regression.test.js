import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePublicBanner, readAdminBanner, DEFAULT_BANNER } from '../server/homeBannerRead.js'
import { claimAffiliateReferral } from '../server/affiliate.js'
import { getPendingAffiliateReferral, resolvePendingAffiliateReferral, saveAffiliateAttribution, getAffiliateCheckoutContext } from '../src/lib/affiliate.js'

const configured = { image_url: 'https://example.com/desktop.webp', mobile_image_url: 'https://example.com/mobile.webp' }
function bannerDb({raw, storageError, legacy, legacyError} = {}) {
  const query = { select: () => query, eq: () => query, or: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: legacy, error: legacyError }) }
  return { storage: { from: () => ({download: async () => ({ data: raw === undefined ? null : new Blob([raw]), error: storageError })}) }, from: () => query }
}
const quiet = () => {}
test('banner configurado prevalece sobre legado e padrão', async () => {
  const r = await resolvePublicBanner(() => bannerDb({raw: JSON.stringify(configured), legacy: DEFAULT_BANNER}), quiet)
  assert.deepEqual(r, {banner: configured, source: 'storage', degraded: false})
})
test('configuração ausente não é falha: usa legado ou padrão', async () => {
  const storageError = {statusCode: '404', message: 'Object not found'}
  const r = await resolvePublicBanner(() => bannerDb({storageError, legacy: {image_url: configured.image_url, mobile_image_url: null}}), quiet)
  assert.deepEqual(r, {banner: {...DEFAULT_BANNER, image_url: configured.image_url}, source: 'legacy', degraded: false})
  const d = await resolvePublicBanner(() => bannerDb({storageError, legacyError: {code: '42P01'}}), quiet)
  assert.deepEqual(d, {banner: DEFAULT_BANNER, source: 'default', degraded: false})
})
test('erro real de storage ou JSON inválido usa legado e registra diagnóstico', async () => {
  for (const failure of [{storageError: {statusCode: '503', message: 'unavailable'}}, {raw: '{broken'}, {raw: 'null'}]) {
    const events = []
    const r = await resolvePublicBanner(() => bannerDb({...failure, legacy: configured}), (...args) => events.push(args))
    assert.equal(r.source, 'legacy'); assert.equal(r.degraded, true); assert.deepEqual(r.banner, configured); assert.equal(events[0][0], 'storage')
  }
})
test('falha de servidor preserva contingência no cliente', async () => {
  const r = await resolvePublicBanner(() => { throw new Error('missing env') }, quiet)
  assert.deepEqual(r, {banner: null, source: 'client-fallback', degraded: true})
  const r2 = await resolvePublicBanner(() => bannerDb({storageError: {statusCode: 403}, legacyError: {code: '08006'}}), quiet)
  assert.deepEqual(r2, r)
})
test('admin pode reparar JSON inválido, mas falha de acesso não permite sobrescrita', async () => {
  assert.deepEqual(await readAdminBanner(bannerDb({raw: '{broken', legacy: configured})), configured)
  await assert.rejects(readAdminBanner(bannerDb({storageError: {statusCode: 403, message: 'denied'}})), error => error.statusCode === 403 && error.message === 'denied')
})

const visitor = 'visitor-123456789'
const original = {slug: 'parceira', visitor_id: visitor, expires_at: '2099-01-01T00:00:00.000Z'}
function setupBrowser() {
  const storage = new Map([['cc_affiliate_visitor_id', visitor]])
  const cookies = new Map()
  globalThis.localStorage = {getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k)}
  globalThis.location = {protocol: 'https:'}
  globalThis.document = {get cookie() { return [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') }, set cookie(value) { const [entry,...attrs] = value.split('; '); const i=entry.indexOf('='); if(attrs.includes('Max-Age=0')) cookies.delete(entry.slice(0,i)); else cookies.set(entry.slice(0,i), entry.slice(i+1)) }}
  saveAffiliateAttribution(original)
  return {storage, cookies}
}
test('indicação indisponível é removida de todos os armazenamentos sem apagar identificador de visita', () => {
  const {storage,cookies} = setupBrowser()
  assert.equal(resolvePendingAffiliateReferral(getPendingAffiliateReferral('buyer'), 'buyer', {ok:false,reason:'unavailable'}), true)
  assert.equal(getPendingAffiliateReferral('buyer'), null)
  assert.equal(storage.has('cc_affiliate_attribution'), false); assert.equal(cookies.has('cc_affiliate_attribution'), false)
  assert.equal(getAffiliateCheckoutContext().visitor_id, visitor)
})
test('resgate válido para de repetir sem perder contexto de checkout nem bloquear outra conta', () => {
  setupBrowser()
  const pending = getPendingAffiliateReferral('buyer')
  assert.equal(resolvePendingAffiliateReferral(pending,'buyer',{ok:true}),true)
  assert.equal(getPendingAffiliateReferral('buyer'),null)
  assert.equal(getAffiliateCheckoutContext().affiliate_slug,original.slug)
  assert.deepEqual(getPendingAffiliateReferral('other'),pending)
  saveAffiliateAttribution({...original, expires_at:'2099-02-01T00:00:00.000Z'})
  assert.ok(getPendingAffiliateReferral('buyer'))
})
test('falha temporária ou resposta de visita antiga não descarta indicação atual', () => {
  setupBrowser()
  const pending = getPendingAffiliateReferral('buyer')
  assert.equal(resolvePendingAffiliateReferral(pending,'buyer',{ok:false,error:'offline'}),false)
  assert.deepEqual(getPendingAffiliateReferral('buyer'),pending)
  saveAffiliateAttribution({...original, expires_at:'2099-02-01T00:00:00.000Z'})
  assert.equal(resolvePendingAffiliateReferral(pending,'buyer',{ok:false,reason:'unavailable'}),false)
  assert.ok(getPendingAffiliateReferral('buyer'))
})
test('autorreferência é recusada só para a própria conta', () => {
  setupBrowser()
  resolvePendingAffiliateReferral(getPendingAffiliateReferral('seller'),'seller',{ok:false,reason:'self_referral'})
  assert.equal(getPendingAffiliateReferral('seller'),null)
  assert.ok(getPendingAffiliateReferral('buyer'))
})
test('backend distingue vendedor indisponível de falha na consulta da atribuição', async () => {
  const query = (data,error) => {const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:async()=>({data,error})};return q}
  const req = {userId:'buyer',visitorId:visitor,slug:original.slug}
  const rejected = await claimAffiliateReferral({from:()=>query(null,null)},req)
  assert.equal(rejected.reason,'unavailable'); assert.equal(rejected.ok,false)
  await assert.rejects(claimAffiliateReferral({from:table=>table==='affiliates'?query({id:'seller',user_id:'owner'},null):query(null,new Error('db down'))},req),/db down/)
})
