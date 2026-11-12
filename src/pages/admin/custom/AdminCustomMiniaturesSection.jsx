import React from 'react'

const ENDPOINT = '/api/core?api_action=custom-miniatures'
const prices = value => (Number(value || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const statuses = [
  ['recebido', 'Pedido recebido'],
  ['em_analise', 'Em análise'],
  ['em_producao', 'Em produção'],
  ['finalizado', 'Finalizado'],
  ['enviado', 'Enviado'],
  ['cancelado', 'Cancelado'],
]
const payment = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', cancelled: 'Cancelado',
}
const numberToBrlInput = cents => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')
function inputToCents(value) {
  const normalized = String(value || '').trim().replace(/\s/g, '').replace('R$', '')
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized.replace(',', '.')) * 100)
  return cents >= 100 && cents <= 100000000 ? cents : null
}

async function api(op, token, { method = 'GET', body } = {}) {
  const resp = await fetch(`${ENDPOINT}&op=${op}`, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível completar a operação.')
  return data
}

export default function AdminCustomMiniaturesSection({ accessToken, canManageBusiness }) {
  const [settings, setSettings] = React.useState(null)
  const [bustInput, setBustInput] = React.useState('200,00')
  const [miniInput, setMiniInput] = React.useState('200,00')
  const [orders, setOrders] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [changingId, setChangingId] = React.useState('')
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [filter, setFilter] = React.useState('all')
  const [search, setSearch] = React.useState('')
  const [expanded, setExpanded] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, total: 0, totalPages: 1 })

  const load = React.useCallback(async () => {
    if (!accessToken) return
    setBusy(true)
    setError('')
    try {
      const [config, list] = await Promise.all([
        api('config', accessToken), api(`admin-list&page=${page}`, accessToken),
      ])
      setSettings(config.settings)
      setBustInput(numberToBrlInput(config.settings?.bust_price_cents))
      setMiniInput(numberToBrlInput(config.settings?.miniature_price_cents))
      setOrders(list.requests || [])
      setPagination(list.pagination || { page, total: (list.requests || []).length, totalPages: 1 })
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }, [accessToken, page])

  React.useEffect(() => { load() }, [load])

  async function saveSettings(event) {
    event.preventDefault()
    if (!canManageBusiness) return
    const bust = inputToCents(bustInput)
    const miniature = inputToCents(miniInput)
    if (!bust || !miniature) { setError('Informe preços válidos, com mínimo de R$ 1,00.'); return }
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const data = await api('save-settings', accessToken, {
        method: 'POST', body: { bust_price_cents: bust, miniature_price_cents: miniature },
      })
      setSettings(data.settings)
      setBustInput(numberToBrlInput(data.settings.bust_price_cents))
      setMiniInput(numberToBrlInput(data.settings.miniature_price_cents))
      setMessage('Preços atualizados! Novos pedidos usarão os valores configurados.')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function updateStatus(request, next) {
    if (request.payment_status !== 'paid') return
    setChangingId(request.id)
    setError('')
    setMessage('')
    try {
      await api('update-status', accessToken, {
        method: 'POST', body: { id: request.id, production_status: next },
      })
      setOrders(current => current.map(item => item.id === request.id
        ? { ...item, production_status: next } : item))
      setMessage('Etapa de produção atualizada.')
    } catch (err) { setError(err.message) }
    finally { setChangingId('') }
  }

  const visible = orders.filter(item => {
    if (filter !== 'all' && item.payment_status !== filter) return false
    const needle = search.trim().toLowerCase()
    return !needle || [item.id, item.order_id, item.customer_email, item.kind, item.notes]
      .some(value => String(value || '').toLowerCase().includes(needle))
  })
  const paidOrders = orders.filter(item => item.payment_status === 'paid')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.2em] text-cyan-300 font-bold">ENCOMENDAS EXCLUSIVAS</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white">Miniaturas personalizadas</h2>
          <p className="mt-1 text-sm text-slate-400">Acompanhe referências, gerencie a produção e defina os preços.</p></div>
        <button type="button" onClick={load} disabled={busy} className="admin-secondary inline-flex gap-2 items-center">
          <span className="material-icons text-lg">refresh</span> Atualizar
        </button>
      </div>

      {error ? <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-sm text-rose-100" role="alert">{error}</div> : null}
      {message ? <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-4 text-sm text-emerald-100" role="status">{message}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/[.035] ring-1 ring-white/10 p-4"><span className="text-xs text-slate-400">Pedidos registrados</span><div className="mt-1 text-3xl font-extrabold text-white">{pagination.total}</div></div>
        <div className="rounded-2xl bg-white/[.035] ring-1 ring-white/10 p-4"><span className="text-xs text-slate-400">Pagos nesta página</span><div className="mt-1 text-3xl font-extrabold text-emerald-300">{paidOrders.length}</div></div>
        <div className="rounded-2xl bg-white/[.035] ring-1 ring-white/10 p-4"><span className="text-xs text-slate-400">Receita nesta página</span><div className="mt-1 text-2xl font-extrabold text-white">{prices(paidOrders.reduce((sum, item) => sum + Number(item.total_cents || 0), 0))}</div></div>
      </div>

      <form onSubmit={saveSettings} className="rounded-[26px] bg-gradient-to-br from-cyan-300/[.08] to-white/[.025] ring-1 ring-cyan-300/15 p-4 sm:p-6">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-200 material-icons">tune</span><div>
          <h3 className="text-lg font-bold text-white">Preços de personalização</h3>
          <p className="text-sm text-slate-400">Os valores são lidos do servidor no momento do pagamento.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">Busto · R$</span>
            <input className="w-full rounded-xl bg-[#09151e] p-3 text-white ring-1 ring-white/15 focus:outline-none focus:ring-cyan-300/50"
              value={bustInput} onChange={event => setBustInput(event.target.value)} inputMode="decimal" placeholder="200,00" disabled={!canManageBusiness || saving} /></label>
          <label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">Miniatura · R$</span>
            <input className="w-full rounded-xl bg-[#09151e] p-3 text-white ring-1 ring-white/15 focus:outline-none focus:ring-cyan-300/50"
              value={miniInput} onChange={event => setMiniInput(event.target.value)} inputMode="decimal" placeholder="200,00" disabled={!canManageBusiness || saving} /></label>
          <button className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-50" type="submit"
            disabled={!canManageBusiness || saving || !settings}>{saving ? 'Salvando…' : 'Salvar preços'}</button>
        </div>
        {!canManageBusiness ? <p className="mt-3 text-xs text-slate-400">Alterar preços exige permissão de Gerente (nível 2).</p> : null}
      </form>

      <section className="rounded-[26px] bg-white/[.025] ring-1 ring-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
          <div><h3 className="text-lg font-bold text-white">Solicitações recebidas</h3><p className="text-sm text-slate-400">Imagens restritas ao cliente e à equipe autorizada.</p></div>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Buscar pedido personalizado" placeholder="Buscar nesta página" value={search} onChange={event => setSearch(event.target.value)}
              className="min-w-[180px] flex-1 rounded-xl bg-black/20 px-3 py-2 text-sm text-white ring-1 ring-white/10" />
            <select aria-label="Filtrar pagamento" value={filter} onChange={event => setFilter(event.target.value)}
              className="rounded-xl bg-[#0b1720] px-3 py-2 text-sm text-white ring-1 ring-white/10">
              <option value="all">Todos os pagamentos</option><option value="paid">Pagos</option>
              <option value="pending">Pendentes</option><option value="failed">Falharam</option>
            </select>
          </div>
        </div>
        {busy ? <p className="py-8 text-center text-sm text-slate-400">Carregando pedidos…</p> : null}
        {!busy && !visible.length ? <p className="py-8 text-center text-sm text-slate-400">Nenhum pedido encontrado.</p> : null}
        <div className="mt-4 space-y-3">
          {visible.map(item => (
            <article key={item.id} className="overflow-hidden rounded-2xl bg-[#09151d] ring-1 ring-white/10">
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="flex items-center gap-3 md:flex-1 min-w-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {item.image_urls?.[0] ? <img className="h-full w-full object-cover" src={item.image_urls[0]} alt="Referência do cliente" /> : <span className="material-icons p-4 text-slate-400">image</span>}
                  </div>
                  <div className="min-w-0"><strong className="text-white">{item.kind === 'busto' ? 'Busto personalizado' : 'Miniatura personalizada'}</strong>
                    <p className="truncate text-xs text-slate-300">{item.customer_email}</p>
                    <p className="mt-1 text-xs text-slate-500">{date(item.created_at)} · {String(item.id).slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center md:justify-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.payment_status === 'paid' ? 'bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/20' : 'bg-amber-300/10 text-amber-100 ring-1 ring-amber-300/20'}`}>
                    {payment[item.payment_status] || item.payment_status}</span>
                  <span className="font-bold text-white">{prices(item.total_cents)}</span>
                  <button type="button" onClick={() => setExpanded(expanded === item.id ? '' : item.id)}
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/20 hover:bg-white/5">
                    {expanded === item.id ? 'Fechar' : 'Detalhes'}</button>
                </div>
              </div>
              {expanded === item.id ? (
                <div className="border-t border-white/10 p-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 text-sm text-slate-300">
                    <p><strong className="text-white">Pedido:</strong> {item.order_id || '—'}</p>
                    <p><strong className="text-white">Pagamento:</strong> {item.payment_method === 'pix' ? 'Pix' : 'Cartão'}</p>
                    <p><strong className="text-white">Preço inicial:</strong> {prices(item.base_price_cents)}</p>
                    <p><strong className="text-white">Desconto:</strong> {prices(item.discount_cents)}{item.coupon_code ? ` (${item.coupon_code})` : ''}</p>
                  </div>
                  <div><p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Imagens de referência</p>
                    <div className="flex flex-wrap gap-2">{(item.image_urls || []).map((url, index) => url ? (
                      <a key={index} href={url} target="_blank" rel="noreferrer" title={`Abrir referência ${index+1}`}>
                        <img src={url} alt={`Referência ${index+1}`} className="h-24 w-24 rounded-xl object-cover ring-1 ring-white/15 hover:ring-cyan-300/40" /></a>
                    ) : null)}</div>
                  </div>
                  <div><p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Descrição do cliente</p>
                    <p className="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm text-slate-200">{item.notes || 'Sem observações adicionais.'}</p></div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block flex-1 min-w-[180px]"><span className="mb-2 block text-xs text-slate-400">Etapa de produção</span>
                      <select value={item.production_status} onChange={event => updateStatus(item, event.target.value)}
                        disabled={changingId === item.id || item.payment_status !== 'paid'}
                        className="w-full rounded-xl bg-[#0c202b] p-3 text-sm text-white ring-1 ring-white/10 disabled:opacity-50">
                        {item.production_status === 'aguardando_pagamento' ? <option value="aguardando_pagamento">Aguardando pagamento</option> : null}
                        {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select></label>
                    <a className="rounded-xl px-4 py-3 text-sm text-cyan-200 ring-1 ring-cyan-300/20" href={`mailto:${encodeURIComponent(item.customer_email)}?subject=${encodeURIComponent('Sua miniatura personalizada - Cubo Criativo')}`}>Contatar cliente</a>
                  </div>
                  {item.payment_status !== 'paid' ? <p className="text-xs text-amber-200">O andamento só pode ser alterado após a confirmação do pagamento.</p> : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>Página {pagination.page} de {pagination.totalPages} · {pagination.total} solicitações</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg px-3 py-2 ring-1 ring-white/15 disabled:opacity-40"
              disabled={busy || page <= 1} onClick={() => { setPage(value => Math.max(1, value - 1)); setExpanded('') }}>
              Anterior
            </button>
            <button type="button" className="rounded-lg px-3 py-2 ring-1 ring-white/15 disabled:opacity-40"
              disabled={busy || page >= pagination.totalPages} onClick={() => { setPage(value => value + 1); setExpanded('') }}>
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
