import test, { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { JSDOM } from 'jsdom'
register(new URL('../scripts/jsx-loader.mjs', import.meta.url))

let dom, React, render, cleanup, fireEvent, waitFor, act
let AuthProvider,
  FavoritesProvider,
  Settings,
  Plans,
  ProductCard,
  PromoCard,
  authClient
const originalFetch = globalThis.fetch
const originals = new Map()
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'cliente@example.com',
  user_metadata: { has_password: true },
}
const baseProfile = {
  full_name: 'Cliente Cubo',
  phone: '11999999999',
  cpf: '52998224725',
  birthdate: '1990-02-10',
  address_line1: 'Rua Exemplo',
  address_number: '100',
  address_line2: 'Bloco A',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  zip: '01001000',
  has_second_address: false,
}
let profile = { ...baseProfile }
let failProfileLoad = false
let failProfileSave = false
let failCheckoutProfile = false
let couponDeferred = null
let couponMode = 'normal'
let verificationStatus = 'pending'
const requests = []
const availablePlans = [
  {
    id: 'level1',
    short_name: 'Level 1',
    miniatures_count: 3,
    boss_count: 0,
    items_per_month: 3,
    price_brl: 100,
    active: true,
  },
  {
    id: 'level2',
    short_name: 'Level 2',
    miniatures_count: 4,
    boss_count: 1,
    items_per_month: 5,
    price_brl: 200,
    active: true,
  },
]
const product = {
  id: 'mini1',
  nome: 'Dragão da floresta',
  slug: 'dragao-da-floresta',
  img: '/dragon.webp',
  priceCents: 9000,
  originalPriceCents: 12000,
  promo: true,
  stock: 4,
  defaultVariant: '32mm',
  variants: [
    { label: '32mm', priceCents: 12000 },
    { label: '75mm', priceCents: 24000 },
  ],
}
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const delay = () => new Promise((resolve) => setTimeout(resolve, 25))
async function mockFetch(input, options = {}) {
  const url = new URL(String(input), 'http://localhost')
  const method = options.method || 'GET'
  const action = url.searchParams.get('action')
  requests.push({
    url,
    method,
    body: options.body ? JSON.parse(options.body) : null,
  })
  if (url.pathname === '/api/profile') {
    if (method === 'POST') {
      await delay()
      if (failProfileSave) throw new TypeError('Network disconnected')
      profile = { ...profile, ...JSON.parse(options.body).profile }
      return response({ ok: true })
    }
    await delay()
    if (failProfileLoad || failCheckoutProfile)
      throw new TypeError('Network disconnected')
    return response({ profile })
  }
  if (url.pathname === '/api/vip-plans')
    return response({ plans: availablePlans })
  if (action === 'vip-cycle')
    return response({
      active_cycle_key: '2026-10',
      items: [
        {
          id: 'mini1',
          title: 'Dragão',
          image_url: '/dragon.webp',
          item_type: 'miniature',
        },
      ],
    })
  if (action === 'my-coupons')
    return response({
      coupons: [
        {
          code: 'CUBO20',
          label: '20% de desconto',
          expires_at: '2030-01-01T00:00:00Z',
        },
      ],
    })
  if (action === 'validate') {
    if (couponMode === 'deferred')
      return new Promise((resolve) => {
        couponDeferred = resolve
      })
    return response({
      coupon: { code: JSON.parse(options.body).code },
      discount: 100,
      final_total: couponMode === 'free' ? 0 : 100,
    })
  }
  if (url.pathname === '/api/create-pix-payment') {
    await delay()
    return response({
      order_id: `order-pix-${requests.filter((request) => request.url.pathname === '/api/create-pix-payment').length}`,
      qr_code: '000201PIXTESTE',
      status: 'pending',
    })
  }
  if (action === 'verify') {
    await delay()
    return response({ status: verificationStatus })
  }
  if (url.pathname.endsWith('/favorite_products'))
    return response(null, method === 'GET' ? 200 : 201)
  if (
    url.pathname.endsWith('/orders') ||
    url.pathname.endsWith('/customer_reviews') ||
    url.pathname.endsWith('/products')
  )
    return response([])
  if (url.hostname === 'viacep.com.br')
    return response({
      logradouro: 'Rua Exemplo',
      bairro: 'Centro',
      localidade: 'São Paulo',
      uf: 'SP',
    })
  throw new Error(`Requisição inesperada: ${url.pathname} ${action || ''}`)
}
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/configuracoes',
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
    'CustomEvent',
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
  ;({ render, cleanup, fireEvent, waitFor, act } =
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
  ;({ FavoritesProvider } = await import('../src/state/FavoritesProvider.jsx'))
  Settings = (await import('../src/components/ProfileSettingsModal.jsx'))
    .default
  Plans = (await import('../src/pages/VipRpgPage.jsx')).default
  ProductCard = (await import('../src/components/ProductCard.jsx')).default
  PromoCard = (await import('../src/components/PromoProductCard.jsx')).default
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  requests.length = 0
  profile = { ...baseProfile }
  failProfileLoad = false
  failProfileSave = false
  failCheckoutProfile = false
  couponMode = 'normal'
  verificationStatus = 'pending'
  couponDeferred = null
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
const withProviders = (element) =>
  h(AuthProvider, null, h(FavoritesProvider, null, element))
const renderSettings = (props = {}) =>
  render(
    withProviders(
      h(Settings, { open: true, mode: 'page', onClose() {}, ...props })
    )
  )
const renderPlans = (props = {}) =>
  render(h(Plans, { user, accessToken: 'test-token', onGoHome() {}, ...props }))
async function readySettings(view) {
  await waitFor(() =>
    assert.equal(
      view.getByLabelText('Nome completo').value,
      baseProfile.full_name
    )
  )
}
async function readyPlans(view) {
  await waitFor(() =>
    assert.equal(
      view.getByRole('button', { name: 'Assinar com Pix' }).disabled,
      false
    )
  )
}

test('perfil indica alterações, limpa campo opcional e bloqueia salvamento repetido', async () => {
  const view = renderSettings()
  await readySettings(view)
  assert.equal(
    view.getByRole('button', { name: 'Salvar perfil' }).disabled,
    true
  )
  fireEvent.change(view.getByLabelText('Complemento (opcional)'), {
    target: { value: '' },
  })
  assert.ok(view.getByText('Alterações não salvas'))
  const form = view.getByLabelText('Nome completo').closest('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => assert.ok(view.getByText('Dados salvos com sucesso.')))
  const saves = requests.filter(
    (request) =>
      request.url.pathname === '/api/profile' && request.method === 'POST'
  )
  assert.equal(saves.length, 1)
  assert.equal(saves[0].body.profile.address_line2, null)
  assert.equal(
    view.getByRole('button', { name: 'Salvar perfil' }).disabled,
    true
  )
})

test('falha ao carregar perfil oferece nova tentativa sem liberar gravação vazia', async () => {
  failProfileLoad = true
  const view = renderSettings()
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Carregar novamente' }))
  )
  assert.equal(
    view.getByRole('button', { name: 'Salvar perfil' }).disabled,
    true
  )
  failProfileLoad = false
  fireEvent.click(view.getByRole('button', { name: 'Carregar novamente' }))
  await readySettings(view)
  assert.equal(
    view.getByLabelText('Nome completo').closest('fieldset').disabled,
    false
  )
})

test('falha ao salvar mantém o rascunho e permite recuperar a conexão', async () => {
  const view = renderSettings()
  await readySettings(view)
  fireEvent.change(view.getByLabelText('Nome completo'), {
    target: { value: 'Cliente atualizado' },
  })
  failProfileSave = true
  fireEvent.click(view.getByRole('button', { name: 'Salvar perfil' }))
  await waitFor(() =>
    assert.equal(view.getByRole('alert').textContent.includes('conexão'), true)
  )
  assert.equal(view.getByLabelText('Nome completo').value, 'Cliente atualizado')
  assert.equal(
    view.getByRole('button', { name: 'Salvar perfil' }).disabled,
    false
  )
  failProfileSave = false
  fireEvent.click(view.getByRole('button', { name: 'Salvar perfil' }))
  await waitFor(() => assert.ok(view.getByText('Dados salvos com sucesso.')))
})

test('cadastro exigido pelo checkout pede CPF e nascimento antes de salvar', async () => {
  profile.cpf = ''
  const view = renderSettings({ required: true })
  await readySettings(view)
  fireEvent.click(view.getByRole('button', { name: 'Salvar perfil' }))
  await waitFor(() =>
    assert.equal(view.getByRole('alert').textContent.includes('CPF'), true)
  )
  assert.equal(
    requests.some(
      (request) =>
        request.method === 'POST' && request.url.pathname === '/api/profile'
    ),
    false
  )
})

test('abas da conta aceitam teclado, preservam rascunho e validam confirmação de senha', async () => {
  const view = renderSettings()
  await readySettings(view)
  fireEvent.change(view.getByLabelText('Nome completo'), {
    target: { value: 'Rascunho mantido' },
  })
  fireEvent.keyDown(view.getByRole('tab', { name: 'Dados e entrega' }), {
    key: 'ArrowRight',
  })
  assert.equal(view.getByRole('tabpanel').id, 'account-panel-security')
  fireEvent.change(view.getByLabelText('Nova senha'), {
    target: { value: 'abcdefg' },
  })
  fireEvent.change(view.getByLabelText('Confirmar nova senha'), {
    target: { value: 'diferente' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Trocar senha' }))
  assert.equal(
    view.getByRole('alert').textContent.includes('não coincidem'),
    true
  )
  fireEvent.click(view.getByRole('tab', { name: 'Dados e entrega' }))
  assert.equal(view.getByLabelText('Nome completo').value, 'Rascunho mantido')
  assert.equal(
    requests.some((request) =>
      request.url.pathname.endsWith('/vip_mini_options')
    ),
    false
  )
})

test('exclusão abre acima das configurações, exige confirmação e Escape fecha só a janela superior', async () => {
  const view = renderSettings({ mode: 'modal', initialTab: 'settings' })
  await waitFor(() => assert.ok(view.getByRole('tab', { name: 'Segurança' })))
  fireEvent.click(view.container.querySelector('.account-danger summary'))
  fireEvent.click(
    view.getByRole('button', { name: 'Solicitar exclusão da conta' })
  )
  const dialog = view.getByRole('dialog', { name: 'Excluir conta' })
  assert.equal(dialog.parentElement.className.includes('z-[260]'), true)
  assert.equal(
    view.getByRole('button', { name: 'Excluir conta permanentemente' })
      .disabled,
    true
  )
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(
    Boolean(view.queryByRole('dialog', { name: 'Excluir conta' })),
    false
  )
  assert.ok(view.getByRole('dialog', { name: 'Configurações' }))
  assert.equal(document.body.style.overflow, 'hidden')
})

test('card separa favorito da galeria e mantém preço por escala na compra', async () => {
  let galleryCalls = 0
  let purchase
  let view
  await act(async () => {
    view = render(
      withProviders(
        h(ProductCard, {
          p: product,
          openGallery: () => {
            galleryCalls += 1
          },
          buyNow: (_product, options) => {
            purchase = options
          },
          addToCart() {},
        })
      )
    )
  })
  fireEvent.click(view.getByRole('button', { name: 'Favoritar' }))
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Remover dos favoritos' }))
  )
  assert.equal(
    requests.some(
      (request) =>
        request.method === 'POST' &&
        request.url.pathname.endsWith('/favorite_products')
    ),
    true
  )
  assert.equal(galleryCalls, 0)
  fireEvent.click(
    view.getByRole('button', { name: `Ver fotos de ${product.nome}` })
  )
  assert.equal(galleryCalls, 1)
  fireEvent.change(view.getByLabelText(`Escala de ${product.nome}`), {
    target: { value: '1' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Comprar' }))
  assert.deepEqual(purchase, { escala: '75mm', unitPrice: 180 })
  assert.equal(
    view.getByRole('link', { name: product.nome }).getAttribute('href'),
    `/p/${product.slug}`
  )
})

test('card promocional mantém preço por escala ao adicionar ao carrinho', async () => {
  let cartItem
  let view
  await act(async () => {
    view = render(
      withProviders(
        h(PromoCard, {
          p: product,
          addToCart: (_product, options) => {
            cartItem = options
          },
          buyNow() {},
        })
      )
    )
  })
  fireEvent.change(view.getByLabelText(`Escala de ${product.nome}`), {
    target: { value: '1' },
  })
  fireEvent.click(
    view.getByRole('button', { name: `Adicionar ${product.nome} ao carrinho` })
  )
  assert.deepEqual(cartItem, { escala: '75mm', unitPrice: 180 })
  assert.equal(
    Boolean(view.queryByRole('button', { name: 'Favoritar' })),
    false
  )
})

test('trocar plano atualiza total e descarta resposta atrasada de cupom', async () => {
  const view = renderPlans()
  await readyPlans(view)
  couponMode = 'deferred'
  fireEvent.change(view.getByLabelText('Tem um cupom?'), {
    target: { value: 'VIPTESTE' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Aplicar' }))
  await waitFor(() => assert.equal(typeof couponDeferred, 'function'))
  fireEvent.click(view.getByRole('radio', { name: 'Level 2' }))
  await act(async () =>
    couponDeferred(
      response({ coupon: { code: 'VIPTESTE' }, discount: 100, final_total: 0 })
    )
  )
  assert.equal(view.getByRole('radio', { name: 'Level 2' }).checked, true)
  assert.equal(
    view.container
      .querySelector('.vip-checkout-total strong')
      .textContent.includes('200,00'),
    true
  )
  assert.equal(
    Boolean(view.queryByRole('button', { name: 'Remover cupom' })),
    false
  )
})

test('cupom com total zero aparece corretamente e pode ser removido', async () => {
  couponMode = 'free'
  const view = renderPlans()
  await readyPlans(view)
  fireEvent.change(view.getByLabelText('Tem um cupom?'), {
    target: { value: 'VIPTESTE' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Aplicar' }))
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Remover cupom' }))
  )
  assert.equal(
    view.container
      .querySelector('.vip-checkout-total strong')
      .textContent.replace(/\s+/g, ' ')
      .trim(),
    'R$ 0,00'
  )
  fireEvent.click(view.getByRole('button', { name: 'Remover cupom' }))
  assert.equal(
    view.container
      .querySelector('.vip-checkout-total strong')
      .textContent.includes('100,00'),
    true
  )
})

test('Pix bloqueia duplo toque desde a conferência do cadastro e recupera falha de conexão', async () => {
  const view = renderPlans()
  await readyPlans(view)
  failCheckoutProfile = true
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() =>
    assert.equal(view.getByRole('alert').textContent.includes('conexão'), true)
  )
  failCheckoutProfile = false
  const submit = view.getByRole('button', { name: 'Assinar com Pix' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  assert.equal(
    requests.filter(
      (request) => request.url.pathname === '/api/create-pix-payment'
    ).length,
    1
  )
  const verify = view.getByRole('button', { name: 'Já paguei' })
  fireEvent.click(verify)
  fireEvent.click(verify)
  await waitFor(() =>
    assert.equal(
      view.getByRole('button', { name: 'Já paguei' }).disabled,
      false
    )
  )
  assert.equal(
    requests.filter(
      (request) => request.url.searchParams.get('action') === 'verify'
    ).length,
    1
  )
})

test('Pix só reaproveita pagamento com o mesmo plano e cupom, mesmo quando o total não muda', async () => {
  const view = renderPlans()
  await readyPlans(view)
  fireEvent.click(view.getByRole('radio', { name: 'Level 2' }))
  fireEvent.change(view.getByLabelText('Tem um cupom?'), {
    target: { value: 'VIPTESTE' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Aplicar' }))
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Remover cupom' }))
  )
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(view.getByRole('button', { name: 'Ver Pix gerado' }))
  assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  assert.equal(
    requests.filter(
      (request) => request.url.pathname === '/api/create-pix-payment'
    ).length,
    1
  )
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.change(view.getByLabelText('Tem um cupom?'), {
    target: { value: 'CUBO20' },
  })
  fireEvent.click(view.getByRole('button', { name: 'Aplicar' }))
  await waitFor(() => assert.ok(view.getByText(/CUBO20 ·/)))
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  const payments = requests.filter(
    (request) => request.url.pathname === '/api/create-pix-payment'
  )
  assert.equal(payments.length, 2)
  assert.equal(payments[0].body.coupon_code, 'VIPTESTE')
  assert.equal(payments[1].body.coupon_code, 'CUBO20')
  assert.equal(
    view
      .getByRole('dialog', { name: 'Pagamento Pix' })
      .querySelector('.vip-pix-panel h3')
      .textContent.replace(/\s+/g, ' ')
      .trim(),
    'R$ 100,00'
  )
})

test('Pix com falha confirmada permite gerar outro pagamento', async () => {
  const view = renderPlans()
  await readyPlans(view)
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  verificationStatus = 'failed'
  fireEvent.click(view.getByRole('button', { name: 'Já paguei' }))
  await waitFor(() => assert.ok(view.getByText('Pagamento não aprovado')))
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  assert.equal(
    requests.filter(
      (request) => request.url.pathname === '/api/create-pix-payment'
    ).length,
    2
  )
  assert.ok(view.getByText('Aguardando pagamento'))
})

test('assinatura retoma o plano escolhido depois de completar o cadastro', async () => {
  profile.birthdate = ''
  let settingsOpened = 0
  const view = renderPlans({
    onOpenSettings: () => {
      settingsOpened += 1
    },
  })
  await readyPlans(view)
  fireEvent.click(view.getByRole('radio', { name: 'Level 2' }))
  fireEvent.click(view.getByRole('button', { name: 'Assinar com Pix' }))
  await waitFor(() => assert.equal(settingsOpened, 1))
  assert.equal(
    requests.some(
      (request) => request.url.pathname === '/api/create-pix-payment'
    ),
    false
  )
  profile.birthdate = '1990-02-10'
  fireEvent(window, new CustomEvent('profile:saved'))
  await waitFor(() =>
    assert.ok(view.getByRole('dialog', { name: 'Pagamento Pix' }))
  )
  const payment = requests.find(
    (request) => request.url.pathname === '/api/create-pix-payment'
  )
  assert.equal(payment.body.vip_plan_id, 'level2')
})

test('cache VIP antigo não redireciona uma conta sem assinatura ativa', async () => {
  localStorage.setItem('vip_until_cache', '2030-01-01T00:00:00Z')
  let opened = 0
  const view = renderPlans({
    onOpenVipArea: () => {
      opened += 1
    },
  })
  await readyPlans(view)
  assert.equal(opened, 0)
})
