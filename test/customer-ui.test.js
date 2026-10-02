import test, { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { register } from 'node:module'
register(new URL('../scripts/jsx-loader.mjs', import.meta.url))

let dom, React, render, fireEvent, waitFor, cleanup, act
let AuthProvider,
  VipArea,
  Game,
  Gallery,
  Menu,
  Cart,
  useMobileViewport,
  copyText
let authClient
let selectionSaves = 0
let gameSaves = 0
let completed = false
let failGameSave = false
let savedSelection = null
let gamePayload
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'cliente@example.com',
}
const items = [
  {
    id: 'm1',
    title: 'Dragão da floresta',
    image_url: '/dragon.webp',
    item_type: 'miniature',
    active: true,
  },
  {
    id: 'm2',
    title: 'Mago arcano',
    image_url: '/mage.webp',
    item_type: 'miniature',
    active: true,
  },
  {
    id: 'm3',
    title: 'Guerreiro',
    image_url: '/warrior.webp',
    item_type: 'miniature',
    active: true,
  },
  {
    id: 'b1',
    title: 'Boss gigante',
    image_url: '/boss.webp',
    item_type: 'boss',
    active: true,
  },
]
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
async function mockFetch(input, options = {}) {
  const url = new URL(String(input), 'http://localhost')
  const action = url.searchParams.get('action')
  if (action === 'game-status')
    return response({
      can_play: !completed,
      played: completed,
      session: completed ? { won: true } : null,
      vip: { isVip: false },
      weekly_reward: { label: '5% de desconto' },
      coupon: completed ? { code: 'CUBO20', label: '20% de desconto' } : null,
    })
  if (action === 'game-complete') {
    gameSaves += 1
    gamePayload = JSON.parse(options.body)
    await new Promise((resolve) => setTimeout(resolve, 25))
    if (failGameSave) return response({ error: 'Conexão interrompida' }, 503)
    completed = true
    return response({ coupon: { code: 'CUBO20', label: '20% de desconto' } })
  }
  if (action === 'vip-cycle')
    return response({ active_cycle_key: '2026-10', items })
  if (url.pathname === '/api/vip-plans')
    return response({
      plans: [
        {
          id: 'cubo_l1',
          name: 'Cubo Level 1',
          short_name: 'Level 1',
          miniatures_count: 2,
          boss_count: 0,
          items_per_month: 2,
          price_cents: 10000,
          sort_order: 1,
        },
      ],
    })
  if (url.pathname === '/api/profile')
    return response({
      profile: {
        vip_until: '2030-10-01T00:00:00Z',
        vip_plan: 'cubo_l1',
        vip_cycle_key: '2026-10',
      },
    })
  if (url.pathname.endsWith('/orders'))
    return response([
      {
        id: 'o1',
        production_status: 'editavel',
        created_at: '2026-10-01T00:00:00Z',
      },
    ])
  if (url.pathname.endsWith('/vip_mini_selections')) {
    if (options.method === 'POST') {
      selectionSaves += 1
      savedSelection = JSON.parse(options.body)
      await new Promise((resolve) => setTimeout(resolve, 30))
      return response(null)
    }
    return response(savedSelection)
  }
  if (url.pathname.endsWith('/vip_theme_polls')) return response(null)
  if (url.pathname.endsWith('/vip_mini_options'))
    return response({
      ...items[0],
      gallery_images: ['/dragon.webp', '/dragon-back.webp'],
    })
  throw new Error(`Requisição sem simulação: ${url.pathname} ${action || ''}`)
}
const originalFetch = globalThis.fetch
const originals = new Map()
const originalRandom = Math.random
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/area-vip',
    pretendToBeVisual: true,
  })
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Node',
    'Event',
    'KeyboardEvent',
    'MutationObserver',
    'localStorage',
    'sessionStorage',
  ]) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: dom.window[name],
    })
  }
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
  window.scrollTo = () => {}
  HTMLElement.prototype.scrollIntoView = () => {}
  globalThis.fetch = mockFetch
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  React = (await import('react')).default
  ;({ render, fireEvent, waitFor, cleanup, act } =
    await import('@testing-library/react'))
  const { configure } = await import('@testing-library/dom')
  configure({ getElementError: (message) => new Error(message) })
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
  const { supabase } = await import('../src/lib/supabaseClient.js')
  authClient = supabase.auth
  supabase.rest.fetch = mockFetch
  supabase.auth.getSession = async () => ({
    data: { session: { user, access_token: 'test-token' } },
    error: null,
  })
  supabase.auth.onAuthStateChange = () => ({
    data: { subscription: { unsubscribe() {} } },
  })
  ;({ AuthProvider } = await import('../src/auth/AuthProvider.jsx'))
  VipArea = (await import('../src/components/VipAreaModal.jsx')).default
  Game = (await import('../src/pages/CupomGamePage.jsx')).default
  Gallery = (await import('../src/components/vip-area/VipGalleryModal.jsx'))
    .default
  Menu = (await import('../src/components/MenuDrawer.jsx')).default
  Cart = (await import('../src/components/CartDrawer.jsx')).default
  useMobileViewport = (await import('../src/lib/useMobileViewport.js')).default
  ;({ copyText } = await import('../src/lib/clipboard.js'))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  selectionSaves = 0
  gameSaves = 0
  completed = false
  failGameSave = false
  savedSelection = null
  Math.random = originalRandom
  delete window.visualViewport
  delete navigator.clipboard
  delete document.execCommand
})
after(async () => {
  await authClient?.stopAutoRefresh()
  authClient?.broadcastChannel?.close()
  dom?.window.close()
  globalThis.fetch = originalFetch
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})
const h = (...args) => React.createElement(...args)
function renderVip() {
  return render(
    h(
      AuthProvider,
      null,
      h(VipArea, {
        isOpen: true,
        asPage: true,
        onClose() {},
        onRequireLogin() {},
      })
    )
  )
}
async function playPerfect(view) {
  await waitFor(() =>
    assert.equal(
      view.getByRole('button', { name: /Iniciar partida/ }).disabled,
      false
    )
  )
  fireEvent.click(view.getByRole('button', { name: /Iniciar partida/ }))
  const cards = view.getAllByRole('button', { name: /^Carta / })
  for (let i = 0; i < 6; i += 1) {
    fireEvent.click(cards[i])
    fireEvent.click(cards[i + 6])
    if (i === 0) {
      fireEvent.click(cards[1])
      assert.equal(cards[1].getAttribute('aria-pressed'), 'false')
    }
    await waitFor(() =>
      assert.equal(
        cards[i].getAttribute('aria-label').includes('par encontrado'),
        true
      )
    )
  }
}

test('VIP filtra nomes com acentos, limita seleção e salva uma única vez', async () => {
  const view = renderVip()
  await waitFor(() =>
    assert.ok(
      view.getByRole('button', { name: 'Selecionar Dragão da floresta' })
    )
  )
  fireEvent.change(view.getByLabelText('Buscar miniatura'), {
    target: { value: 'dragao' },
  })
  assert.equal(view.container.querySelectorAll('.vip-choice-card').length, 1)
  fireEvent.click(
    view.getByRole('button', { name: 'Selecionar Dragão da floresta' })
  )
  fireEvent.change(view.getByLabelText('Buscar miniatura'), {
    target: { value: '' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Selecionar Mago arcano' }))
  fireEvent.click(view.getByRole('button', { name: 'Selecionar Guerreiro' }))
  assert.equal(
    view.container.querySelectorAll('.vip-choice-toggle[aria-pressed="true"]')
      .length,
    2
  )
  fireEvent.click(view.getByLabelText('Só minhas escolhas'))
  assert.equal(view.container.querySelectorAll('.vip-choice-card').length, 2)
  const save = view.getByRole('button', {
    name: 'Salvar escolhas',
    exact: true,
  })
  fireEvent.click(save)
  fireEvent.click(save)
  await waitFor(() =>
    assert.equal(
      view.container
        .querySelector('.vip-selection-bar')
        .textContent.includes('Escolhas salvas'),
      true
    )
  )
  assert.equal(selectionSaves, 1)
  assert.deepEqual(savedSelection.selected_option_ids, ['m1', 'm2'])
})

test('abas VIP aceitam teclado e vinculam a aba ao painel ativo', async () => {
  const view = renderVip()
  await waitFor(() => assert.ok(view.getByRole('tab', { name: /Escolhas/ })))
  const tab = view.getByRole('tab', { name: /Escolhas/ })
  fireEvent.keyDown(tab, { key: 'ArrowRight' })
  const active = view.container.querySelector(
    '[role="tab"][aria-selected="true"]'
  )
  assert.equal(active.textContent.includes('Pedido'), true)
  assert.equal(
    view.getByRole('tabpanel').id,
    active.getAttribute('aria-controls')
  )
  assert.equal(document.activeElement === active, true)
})

test('galeria remove imagens duplicadas, navega por teclado e fecha com Escape', () => {
  function Example() {
    const [item, setItem] = React.useState({
      id: 'm1',
      title: 'Dragão',
      image_url: '/front.webp',
      gallery_images: ['/front.webp', '/back.webp'],
    })
    return h(Gallery, { item, onClose: () => setItem(null) })
  }
  const view = render(h(Example))
  assert.equal(view.getAllByRole('button', { name: /^Ver imagem / }).length, 2)
  fireEvent.click(view.getByRole('button', { name: 'Próxima imagem' }))
  assert.equal(
    view
      .getByRole('img', { name: 'Dragão, imagem 2 de 2' })
      .getAttribute('src'),
    '/back.webp'
  )
  fireEvent.keyDown(view.getByRole('button', { name: 'Imagem anterior' }), {
    key: 'ArrowLeft',
  })
  assert.ok(view.getByRole('img', { name: 'Dragão, imagem 1 de 2' }))
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(Boolean(view.queryByRole('dialog')), false)
  assert.equal(document.body.style.overflow, '')
})

test('Cubo Game inicia pelo botão, bloqueia terceiro toque e salva vitória só uma vez', async () => {
  Math.random = () => 0.999
  const view = render(
    h(
      React.StrictMode,
      null,
      h(Game, { user, accessToken: 'test-token', onGoHome() {} })
    )
  )
  assert.equal(
    view
      .getAllByRole('button', { name: /^Carta / })
      .every((card) => card.disabled),
    true
  )
  await playPerfect(view)
  await waitFor(() => assert.ok(view.getByText('CUBO20')))
  assert.equal(gameSaves, 1)
  assert.equal(gamePayload.score, 1000)
  assert.equal(gamePayload.attempts, 6)
})

test('Cubo Game conserva resultado quando o envio falha e permite reenviar', async () => {
  Math.random = () => 0.999
  failGameSave = true
  const view = render(
    h(Game, { user, accessToken: 'test-token', onGoHome() {} })
  )
  await playPerfect(view)
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Reenviar resultado' }))
  )
  assert.equal(gameSaves, 1)
  failGameSave = false
  fireEvent.click(view.getByRole('button', { name: 'Reenviar resultado' }))
  await waitFor(() => assert.ok(view.getByText('CUBO20')))
  assert.equal(gameSaves, 2)
  assert.equal(gamePayload.score, 1000)
})

test('carrinho mantém itens e checkout no mesmo painel rolável e bloqueia fundo', () => {
  let quantityArgs
  let closed = 0
  const view = render(
    h(Cart, {
      open: true,
      onClose: () => {
        closed += 1
      },
      cart: [
        {
          id: 'm1',
          nome: 'Miniatura teste',
          qty: 1,
          escala: '32mm',
          price: 90,
          unitPrice: 90,
        },
      ],
      subtotal: 90,
      brand: { whatsapp: '5511999999999' },
      updateQty: (...args) => {
        quantityArgs = args
      },
      removeItem() {},
      onPay() {},
      paying: false,
    })
  )
  const body = view.container.querySelector('.shop-drawer-body')
  assert.equal(
    body.contains(view.getByRole('button', { name: 'Pagar com cartão' })),
    true
  )
  const add = view.getByRole('button', { name: /Aumentar quantidade/ })
  assert.equal(body.contains(add), true)
  fireEvent.click(add)
  assert.equal(quantityArgs[0], 'm1')
  assert.equal(quantityArgs[1], 1)
  assert.equal(document.body.style.overflow, 'hidden')
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(closed, 1)
})

test('menu móvel fecha com Escape e só expõe controles enquanto está aberto', () => {
  function Example() {
    const [open, setOpen] = React.useState(true)
    return h(Menu, { open, onClose: () => setOpen(false), onNavigate() {} })
  }
  const view = render(h(Example))
  assert.ok(view.getByRole('dialog', { name: 'Menu' }))
  assert.equal(document.body.style.overflow, 'hidden')
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(Boolean(view.queryByRole('dialog')), false)
  assert.equal(document.body.style.overflow, '')
})

test('painéis acompanham teclado virtual sem impedir zoom do navegador', () => {
  const viewport = new window.EventTarget()
  Object.assign(viewport, {
    height: window.innerHeight,
    offsetTop: 0,
    scale: 1,
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
  function Probe() {
    useMobileViewport()
    return null
  }
  const view = render(h(Probe))
  viewport.height = window.innerHeight - 280
  act(() => viewport.dispatchEvent(new Event('resize')))
  assert.equal(
    document.documentElement.style.getPropertyValue('--keyboard-inset'),
    '280px'
  )
  viewport.scale = 2
  viewport.height = 200
  act(() => viewport.dispatchEvent(new Event('resize')))
  assert.equal(
    document.documentElement.style.getPropertyValue('--keyboard-inset'),
    '280px'
  )
  view.unmount()
  assert.equal(
    document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ''
  )
})

test('copiar cupom usa alternativa móvel e relata falha sem confirmação falsa', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error('Indisponível')
      },
    },
  })
  const view = render(h('button', null, 'Copiar'))
  view.getByRole('button').focus()
  document.execCommand = () => true
  assert.equal(await copyText('CUBO20'), true)
  assert.equal(document.activeElement === view.getByRole('button'), true)
  assert.equal(document.querySelectorAll('textarea').length, 0)
  document.execCommand = () => false
  assert.equal(await copyText('CUBO20'), false)
})
