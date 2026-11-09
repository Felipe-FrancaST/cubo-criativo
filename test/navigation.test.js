import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SPA_HISTORY_STATE_KEY,
  currentClientPath,
  isSpaHistoryEntry,
  navigateClient,
  readProductReturnState,
  saveProductReturnState,
} from '../src/lib/navigation.js'
import { readFile } from 'node:fs/promises'

function makeSessionStorage() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

function installWindow(path = '/catalogo?tipo=rpg') {
  const origin = 'https://www.cubocriativo3d.com.br'
  const updateLocation = (next) => {
    const url = new URL(next, origin)
    fakeWindow.location = {
      origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    }
  }
  const fakeWindow = {
    location: null,
    scrollY: 420,
    pageYOffset: 420,
    sessionStorage: makeSessionStorage(),
    history: {
      state: null,
      pushState(state, _title, next) {
        this.state = state
        updateLocation(next)
      },
      replaceState(state, _title, next) {
        this.state = state
        updateLocation(next)
      },
    },
    dispatchEvent() {},
  }
  updateLocation(path)
  globalThis.window = fakeWindow
  return fakeWindow
}

test('navegação de produto permanece na SPA e guarda a posição de retorno', () => {
  const fakeWindow = installWindow()
  saveProductReturnState('/p/ranger-do-norte')
  navigateClient('/p/ranger-do-norte')

  assert.equal(currentClientPath(), '/p/ranger-do-norte')
  assert.equal(fakeWindow.history.state[SPA_HISTORY_STATE_KEY], true)
  assert.equal(isSpaHistoryEntry(), true)

  const saved = readProductReturnState()
  assert.equal(saved.path, '/catalogo?tipo=rpg')
  assert.equal(saved.targetPath, '/p/ranger-do-norte')
  assert.equal(saved.scrollY, 420)

  delete globalThis.window
})

test('código trata chunks antigos e evita restaurar documento antigo no botão voltar', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const card = await readFile(
    new URL('../src/components/ProductCard.jsx', import.meta.url),
    'utf8'
  )
  const lazyHelper = await readFile(
    new URL('../src/lib/lazyWithReload.js', import.meta.url),
    'utf8'
  )
  const indexHtml = await readFile(
    new URL('../index.html', import.meta.url),
    'utf8'
  )

  assert.match(
    card,
    /event\.preventDefault\(\)[\s\S]*navigateClient\(`\/p\/\$\{encodeURIComponent\(p\.slug\)\}`\)/
  )
  assert.match(app, /restoreProductScroll\(restore\)/)
  assert.match(
    app,
    /navigate\(returnState\.path,\s*\{\s*replace:\s*true,\s*preserveScroll:\s*true,?\s*\},?\s*\)/
  )
  assert.match(
    app,
    /lazyWithReload\(\(\) => import\(['"]\.\/pages\/HomePage\.jsx['"]\)\)/
  )
  assert.match(lazyHelper, /failed to fetch dynamically imported module/i)
  assert.match(lazyHelper, /window\.location\.reload\(\)/)
  assert.match(indexHtml, /id="stale-build-recovery"/)
  assert.match(indexHtml, /cc_refresh/)
})

test('Vercel não mantém HTML de produto em cache após um novo deploy', async () => {
  const config = JSON.parse(
    await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
  )
  const productRule = (config.headers || []).find(
    (item) => item.source === '/p/(.*)'
  )
  const assetsRule = (config.headers || []).find(
    (item) => item.source === '/assets/(.*)'
  )

  assert.ok(
    productRule?.headers?.some(
      (header) =>
        header.key === 'Cache-Control' && /no-store/i.test(header.value)
    )
  )
  assert.ok(
    assetsRule?.headers?.some(
      (header) =>
        header.key === 'Cache-Control' && /immutable/i.test(header.value)
    )
  )
})

test('retorno guarda o produto, sua posição na tela e filtros da listagem', () => {
  const fakeWindow = installWindow('/catalogo?tipo=rpg&q=mago&tag=Arcano')
  const anchor = {
    dataset: { productId: '42' },
    getBoundingClientRect: () => ({ top: 160 }),
  }
  globalThis.document = { querySelectorAll: () => [anchor] }
  try {
    saveProductReturnState('/p/mago', anchor)
    const state = readProductReturnState()
    assert.equal(state.productId, '42')
    assert.equal(state.anchorOffset, 160)
    assert.equal(state.scrollY, fakeWindow.scrollY)
    assert.equal(state.path, '/catalogo?tipo=rpg&q=mago&tag=Arcano')
  } finally {
    delete globalThis.window
    delete globalThis.document
  }
})

test('restauração aguarda o card aparecer e interrompe ao usuário interagir', async () => {
  const { restoreProductScroll } =
    await import('../src/lib/restoreProductScroll.js')
  const listeners = new Map()
  const positions = []
  let nextFrame
  let anchor = null
  globalThis.window = {
    scrollY: 0,
    scrollTo: ({ top }) => {
      positions.push(top)
      globalThis.window.scrollY = top
    },
    addEventListener: (key, cb) => listeners.set(key, cb),
    removeEventListener: (key) => listeners.delete(key),
  }
  globalThis.document = { querySelectorAll: () => (anchor ? [anchor] : []) }
  globalThis.requestAnimationFrame = (cb) => {
    nextFrame = cb
    return 1
  }
  globalThis.cancelAnimationFrame = () => {
    nextFrame = null
  }
  try {
    restoreProductScroll({ scrollY: 900, productId: '42', anchorOffset: 150 })
    nextFrame()
    assert.equal(positions.at(-1), 900)
    anchor = {
      dataset: { productId: '42' },
      getBoundingClientRect: () => ({ top: 250 }),
    }
    nextFrame()
    assert.equal(positions.at(-1), 1000)
    listeners.get('touchstart')()
    assert.equal(nextFrame, null)
    assert.equal(listeners.size, 0)
  } finally {
    delete globalThis.window
    delete globalThis.document
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  }
})
