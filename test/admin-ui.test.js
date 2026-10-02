import test, { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { register } from 'node:module'
register(new URL('../scripts/jsx-loader.mjs', import.meta.url))

let dom,
  React,
  render,
  fireEvent,
  cleanup,
  waitFor,
  NewOrder,
  AdminPage,
  Modal,
  AuthProvider
let authClient
let createCalls = 0
const client = {
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Cliente teste',
  email: 'cliente@example.com',
  cpf: '52998224725',
  address_line1: 'Rua de teste',
  address_number: '100',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  zip: '01001000',
}
const product = {
  id: 'p1',
  name: 'Miniatura teste',
  price: 90,
  price_cents: 9000,
  original_price_cents: 12000,
  promo: true,
  default_variant: '32mm',
  variants: [
    { label: '32mm', price_cents: 12000 },
    { label: '75mm', price_cents: 24000 },
  ],
}
const order = {
  id: '00000000-0000-4000-8000-000000000001',
  status: 'paid',
  order_type: 'store',
  total: 90,
  production_status: 'recebido',
  created_at: new Date().toISOString(),
  customer_name: client.full_name,
  customer_email: client.email,
  profile: client,
  order_items: [],
}
const requests = []
const vipItems = [
  {
    id: 'mini-1',
    title: 'Guerreiro teste',
    cycle_key: '2026-10',
    item_type: 'miniature',
  },
]
function response(value, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}
const mockFetch = async (input, options = {}) => {
  const url = new URL(String(input), 'http://localhost')
  const action = url.searchParams.get('action')
  requests.push({ url, options })
  if (url.pathname === '/api/vip-plans') return response({ plans: [] })
  if (url.hostname === 'viacep.com.br')
    return response({
      logradouro: client.address_line1,
      bairro: client.neighborhood,
      localidade: client.city,
      uf: 'SP',
    })
  if (action === 'orders')
    return response({
      orders: [order],
      pagination: { page: 1, page_size: 25, total_count: 1, total_pages: 1 },
      summary: { total: 1, paid: 1, revenue: 90 },
    })
  if (action === 'manual-order-products')
    return response({ products: [product] })
  if (action === 'clients') return response({ clients: [client] })
  if (action === 'vip-control')
    return response({
      active_cycle_key: '2026-10',
      library: vipItems,
      cycles: [
        {
          cycle_key: '2026-10',
          is_active: true,
          items: vipItems,
          items_count: 1,
          miniatures_count: 1,
          boss_count: 0,
        },
      ],
      vip_summary: { activeSubscribers: 1, byCycle: [] },
    })
  if (action === 'vip-save-cycle')
    return response({ ok: true, option_ids: ['copy-1'] })
  if (action === 'manual-order-create') {
    createCalls += 1
    await new Promise((resolve) => setTimeout(resolve, 30))
    const body = JSON.parse(options.body)
    return response({
      ok: true,
      order: { id: 'new-order', order_number: '12345678', total: 90 },
      account: { email: body.customer.email, existing: true },
      payment_link: 'http://localhost/pagamento-pedido?demo=true',
      email: { skipped: true },
    })
  }
  if (action === 'update-order')
    return response({ error: 'Falha simulada de atualização' }, 500)
  if (action === 'vip-voting') return response({ polls: [] })
  if (action === 'vip-voting-image-library') return response({ items: [] })
  throw new Error(`Unmocked request: ${url.pathname}`)
}
const originalFetch = globalThis.fetch
const originals = new Map()
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/admin',
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
  globalThis.fetch = mockFetch
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  React = (await import('react')).default
  ;({ render, fireEvent, cleanup, waitFor } =
    await import('@testing-library/react'))
  const { configure } = await import('@testing-library/dom')
  configure({ getElementError: (message) => new Error(message) })
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.invalid'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
  const { supabase } = await import('../src/lib/supabaseClient.js')
  authClient = supabase.auth
  supabase.rest.fetch = mockFetch
  supabase.auth.getSession = async () => ({
    data: { session: null },
    error: null,
  })
  supabase.auth.onAuthStateChange = () => ({
    data: { subscription: { unsubscribe() {} } },
  })
  ;({ AuthProvider } = await import('../src/auth/AuthProvider.jsx'))
  NewOrder = (await import('../src/pages/admin/orders/NewManualOrderModal.jsx'))
    .default
  AdminPage = (await import('../src/pages/AdminOrdersPage.jsx')).default
  Modal = (await import('../src/components/Modal.jsx')).default
})
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  createCalls = 0
  requests.length = 0
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
function renderAdmin() {
  return render(
    h(
      AuthProvider,
      null,
      h(AdminPage, {
        user: { id: 'admin', email: 'admin@example.com' },
        accessToken: 'test-token',
        isAdmin: true,
        adminLevel: 3,
      })
    )
  )
}

test('novo pedido valida o cliente antes de liberar os itens', async () => {
  const view = render(
    h(NewOrder, { open: true, accessToken: 'test-token', onClose() {} })
  )
  await waitFor(() =>
    assert.equal(
      view.getByRole('button', { name: 'Continuar para itens' }).disabled,
      false
    )
  )
  fireEvent.click(view.getByRole('button', { name: 'Continuar para itens' }))
  assert.ok(view.getByRole('alert').textContent.includes('nome'))
  assert.equal(createCalls, 0)
})

test('pedido usa cliente existente, revisa valores e bloqueia envio duplo', async () => {
  const view = render(
    h(NewOrder, { open: true, accessToken: 'test-token', onClose() {} })
  )
  fireEvent.click(view.getByRole('button', { name: 'Cliente já cadastrado' }))
  await waitFor(() =>
    assert.ok(view.getByRole('option', { name: /Cliente teste/ }))
  )
  const clientSelect = view.container.querySelector('select')
  fireEvent.change(clientSelect, { target: { value: client.id } })
  await waitFor(() =>
    assert.equal(view.getByLabelText('Nome').value, client.full_name)
  )
  fireEvent.click(view.getByRole('button', { name: 'Continuar para itens' }))
  fireEvent.click(view.getByRole('button', { name: 'Produto cadastrado' }))
  fireEvent.change(view.getByLabelText('Produto'), {
    target: { value: product.id },
  })
  fireEvent.change(view.getByLabelText('Escala'), { target: { value: '75mm' } })
  fireEvent.click(view.getByRole('button', { name: 'Revisar pedido' }))
  assert.ok(view.getByRole('dialog').textContent.includes('180,00'))
  const submit = view.getByRole('button', { name: 'Criar e gerar link' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  await waitFor(() => assert.ok(view.getByText('Pedido criado')))
  assert.equal(createCalls, 1)
  const request = requests.find(
    (item) => item.url.searchParams.get('action') === 'manual-order-create'
  )
  assert.equal(JSON.parse(request.options.body).items[0].scale, '75mm')
})

test('detalhes de pedido abrem e fecham repetidamente sem erro de hooks', async () => {
  sessionStorage.setItem('cc_admin_section', 'orders')
  const view = renderAdmin()
  await waitFor(() =>
    assert.ok(
      view.getAllByRole('button', { name: 'Detalhes', exact: true }).length
    )
  )
  for (let index = 0; index < 2; index += 1) {
    fireEvent.click(
      view.getAllByRole('button', { name: 'Detalhes', exact: true })[0]
    )
    assert.ok(view.getByRole('dialog', { name: 'Detalhes do pedido' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    assert.equal(
      Boolean(view.queryByRole('dialog', { name: 'Detalhes do pedido' })),
      false
    )
  }
})

test('erro ao salvar status mantém o formulário aberto e permite tentar novamente', async () => {
  sessionStorage.setItem('cc_admin_section', 'orders')
  const view = renderAdmin()
  await waitFor(() =>
    assert.ok(
      view.getAllByRole('button', { name: 'Status', exact: true }).length
    )
  )
  fireEvent.click(
    view.getAllByRole('button', { name: 'Status', exact: true })[0]
  )
  const dialog = view.getByRole('dialog', { name: 'Atualizar pedido' })
  fireEvent.click(
    Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Salvar'
    )
  )
  await waitFor(() =>
    assert.ok(view.getByRole('status').textContent.includes('Falha simulada'))
  )
  assert.equal(dialog.isConnected, true)
})

test('modal aninhado fecha apenas a janela superior e mantém rolagem bloqueada', () => {
  function Example() {
    const [inner, setInner] = React.useState(true)
    return h(
      Modal,
      { open: true, title: 'Janela principal', onClose() {} },
      h(
        Modal,
        {
          open: inner,
          title: 'Janela secundária',
          onClose: () => setInner(false),
        },
        'Conteúdo'
      )
    )
  }
  const view = render(h(Example))
  assert.equal(document.body.style.overflow, 'hidden')
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(
    Boolean(view.queryByRole('dialog', { name: 'Janela secundária' })),
    false
  )
  assert.ok(view.getByRole('dialog', { name: 'Janela principal' }))
  assert.equal(document.body.style.overflow, 'hidden')
})

test('controle VIP separa áreas e duplica um ciclo como rascunho', async () => {
  sessionStorage.setItem('cc_admin_section', 'vip')
  const view = renderAdmin()
  await waitFor(() =>
    assert.ok(view.getByRole('tab', { name: /Ciclos e assinantes/ }))
  )
  fireEvent.click(view.getByRole('tab', { name: /Biblioteca/ }))
  assert.equal(
    view.getByRole('tab', { name: /Biblioteca/ }).getAttribute('aria-selected'),
    'true'
  )
  assert.ok(view.getByRole('heading', { name: 'Miniaturas cadastradas' }))
  fireEvent.click(view.getByRole('tab', { name: /Ciclos e assinantes/ }))
  fireEvent.click(view.getByRole('button', { name: 'Duplicar ativo' }))
  assert.equal(view.getByLabelText(/Ativar ao salvar/).checked, false)
  fireEvent.click(view.getByRole('button', { name: 'Salvar ciclo' }))
  await waitFor(() =>
    assert.ok(
      requests.find(
        (item) => item.url.searchParams.get('action') === 'vip-save-cycle'
      )
    )
  )
  const payload = JSON.parse(
    requests.find(
      (item) => item.url.searchParams.get('action') === 'vip-save-cycle'
    ).options.body
  )
  assert.equal(payload.duplicate, true)
  assert.equal(payload.activate, false)
  await waitFor(() =>
    assert.ok(view.getByRole('button', { name: 'Salvar ciclo' }))
  )
})

test('operador cria pedidos sem consultar áreas restritas a gerentes', async () => {
  const view = render(
    h(NewOrder, {
      open: true,
      accessToken: 'test-token',
      canManageBusiness: false,
      onClose() {},
    })
  )
  await waitFor(() =>
    assert.equal(
      view.getByRole('button', { name: 'Continuar para itens' }).disabled,
      false
    )
  )
  assert.equal(
    Boolean(view.queryByRole('button', { name: 'Cliente já cadastrado' })),
    false
  )
  assert.equal(
    requests.some(
      (item) => item.url.searchParams.get('action') === 'vip-control'
    ),
    false
  )
})

test('navegação por Tab ignora controles de etapas ocultas', () => {
  const view = render(
    h(
      Modal,
      { open: true, title: 'Revisão', onClose() {} },
      h('button', { type: 'button' }, 'Confirmar'),
      h(
        'div',
        { hidden: true },
        h('button', { type: 'button' }, 'Etapa oculta')
      )
    )
  )
  for (const button of view.container.querySelectorAll('button')) {
    Object.defineProperty(button, 'getClientRects', {
      value: () => [{ width: 20, height: 20 }],
    })
  }
  const dialog = view.getByRole('dialog', { name: 'Revisão' })
  const close = view.getByRole('button', { name: 'Fechar' })
  const confirm = view.getByRole('button', { name: 'Confirmar' })
  dialog.focus()
  fireEvent.keyDown(dialog, { key: 'Tab' })
  assert.equal(document.activeElement === close, true)
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  assert.equal(document.activeElement === confirm, true)
  fireEvent.keyDown(confirm, { key: 'Tab' })
  assert.equal(document.activeElement === close, true)
})
