import React from 'react'
import ConfirmationDialog from '../../../components/ConfirmationDialog.jsx'
import { pixKeyTypeLabel } from '../../../../shared/pixKey.js'
const fmt = (n) =>
  Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
const siteOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const emptyForm = {
  user_id: '',
  slug: '',
  commission_type: 'percent',
  commission_value: 10,
  attribution_days: 30,
  active: true,
  create_coupon: false,
  initial_coupon: { code: '', label: '', discount_type: 'percent', discount_value: 10, applies_to: 'products', max_uses: 100 },
}
const emptyCoupon = {
  affiliate_id: '',
  code: '',
  label: '',
  discount_type: 'percent',
  discount_value: 10,
  min_order_value: 0,
  expires_at: '',
  max_uses: 100,
  applies_to: 'products',
  product_ids: [],
  vip_plan_ids: [],
}
export default function AdminAffiliatesSection({ accessToken }) {
  const [data, setData] = React.useState({
    affiliates: [],
    profiles: [],
    products: [],
    vip_plans: [],
    coupons: [],
    withdrawals: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState(emptyForm)
  const [editing, setEditing] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [coupon, setCoupon] = React.useState(emptyCoupon)
  const [couponBusy, setCouponBusy] = React.useState(false)
  const [showCoupon, setShowCoupon] = React.useState(false)
  const [settlement, setSettlement] = React.useState(null)
  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState('')
  const [settlementBusy, setSettlementBusy] = React.useState(false)
  const [settlementError, setSettlementError] = React.useState('')
  const load = React.useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin?action=affiliates', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(
          json.error || 'Não foi possível carregar os vendedores.'
        )
      setData({
        affiliates: json.affiliates || [],
        profiles: json.profiles || [],
        products: json.products || [],
        vip_plans: json.vip_plans || [],
        coupons: json.coupons || [],
        withdrawals: json.withdrawals || [],
      })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [accessToken])
  React.useEffect(() => {
    load()
  }, [load])
  const resetForm = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(false)
  }
  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }
  const edit = (affiliate) => {
    setEditing(affiliate.id)
    setShowForm(true)
    setError('')
    setForm({
      user_id: affiliate.user_id,
      slug: affiliate.slug,
      commission_type: affiliate.commission_type || 'percent',
      commission_value: affiliate.commission_value || 0,
      attribution_days: affiliate.attribution_days || 30,
      active: affiliate.active !== false,
      create_coupon: false,
      initial_coupon: emptyForm.initial_coupon,
    })
  }
  async function save() {
    if (!form.user_id) return setError('Selecione um cliente.')
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin?action=save-affiliate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...form,
          initial_coupon: !editing && form.create_coupon ? form.initial_coupon : null,
          id: editing,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(json.error || 'Erro ao salvar vendedor.')
      resetForm()
      await load()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }
  async function saveCoupon() {
    if (!coupon.affiliate_id || !coupon.code)
      return setError('Informe o vendedor e o código do cupom.')
    setCouponBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin?action=save-affiliate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(coupon),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar cupom.')
      setCoupon(emptyCoupon)
      setShowCoupon(false)
      await load()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCouponBusy(false)
    }
  }
  async function deleteAffiliate() {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const response = await fetch('/api/admin?action=delete-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Não foi possível excluir o vendedor.')
      if (editing === deleteTarget.id) resetForm()
      setDeleteTarget(null)
      await load()
    } catch (error) { setDeleteError(error.message || 'Falha ao remover vendedor.') }
    finally { setDeleteBusy(false) }
  }
  async function settleWithdrawal() {
    if (!settlement || settlementBusy) return
    const { withdrawal, action } = settlement
    setSettlementBusy(true)
    setSettlementError('')
    setError('')
    try {
      const response = await fetch('/api/admin?action=settle-affiliate-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: withdrawal.id, status: action }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Não foi possível processar o saque.')
      setSettlement(null)
      await load()
    } catch (error) { setSettlementError(error.message || 'Não foi possível processar o saque.') }
    finally { setSettlementBusy(false) }
  }
  const pendingWithdrawals = data.withdrawals.filter(w => w.status === 'requested')
  const activeAffiliates = data.affiliates.filter((a) => a.active).length
  const totals = data.affiliates.reduce(
    (acc, a) => ({
      visits: acc.visits + Number(a.stats?.visits || 0),
      revenue: acc.revenue + Number(a.stats?.revenue || 0),
      commission: acc.commission + Number(a.stats?.commission || 0),
      pending: acc.pending + Number(a.stats?.pending || 0),
    }),
    {
      visits: 0,
      revenue: 0,
      commission: 0,
      pending: 0,
    }
  )
  const availableProfiles = data.profiles.filter(
    (p) =>
      !data.affiliates.some((a) => String(a.user_id) === String(p.id)) ||
      String(p.id) === String(form.user_id)
  )
  return (
    <div className="space-y-5">
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Remover vendedor?"
        description="O link e os cupons serão desativados. As comissões e os saques anteriores permanecerão no histórico."
        tone="red"
        confirmLabel="Remover vendedor"
        busy={deleteBusy}
        onClose={() => { if (!deleteBusy) setDeleteTarget(null) }}
        onConfirm={deleteAffiliate}
      >
        {deleteTarget && <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-semibold text-white">{deleteTarget.profile?.full_name || deleteTarget.slug}</p>}
        {deleteError && <p role="alert" className="mt-3 text-sm text-rose-200">{deleteError}</p>}
      </ConfirmationDialog>
      <ConfirmationDialog open={Boolean(settlement)} title={settlement?.action === 'paid' ? 'Confirmar saque executado' : 'Recusar solicitação de saque'} description={settlement?.action === 'paid' ? 'Confirme somente após concluir a transferência Pix. Esta ação ficará registrada no histórico financeiro.' : 'O saldo reservado voltará a ficar disponível para o vendedor.'} tone={settlement?.action === 'paid' ? 'green' : 'red'} confirmLabel={settlement?.action === 'paid' ? 'Confirmar pagamento' : 'Confirmar recusa'} busy={settlementBusy} onClose={() => { if (!settlementBusy) setSettlement(null) }} onConfirm={settleWithdrawal}>
        {settlement && <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div><p className="text-xs uppercase tracking-wider text-slate-400">Valor</p><p className="mt-1 text-2xl font-black text-emerald-200">{fmt(settlement.withdrawal.amount)}</p></div>
          <div><p className="text-xs text-slate-400">Titular</p><p className="font-bold text-white">{settlement.withdrawal.holder_name}</p></div>
          <div><p className="text-xs text-slate-400">Chave Pix</p><p className="text-xs font-bold text-cyan-200">{pixKeyTypeLabel(settlement.withdrawal.pix_key_type)}</p><p className="break-all font-mono text-sm text-cyan-200">{settlement.withdrawal.pix_key}</p></div>
        </div>}
        {settlementError && <p role="alert" className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-200">{settlementError}</p>}
      </ConfirmationDialog>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">
            Vendedores e comissões
          </h2>
          <p className="text-sm text-slate-400">
            Crie vendedores, controle links, cupons, vendas e pagamentos de
            comissão.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-xl px-3 py-2 text-slate-200 ring-1 ring-white/10"
          >
            Atualizar
          </button>
          <button
            onClick={startCreate}
            className="rounded-xl bg-cyan-300 px-4 py-2 font-black text-black"
          >
            + Novo vendedor
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-100 ring-1 ring-rose-400/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ['Vendedores ativos', activeAffiliates],
          ['Acessos', totals.visits],
          ['Vendas atribuídas', fmt(totals.revenue)],
          ['Comissões', fmt(totals.commission)],
          ['Pendentes', fmt(totals.pending)],
          ['Saques solicitados', pendingWithdrawals.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-lg font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className={`rounded-3xl border p-5 ${pendingWithdrawals.length ? 'border-amber-300/35 bg-amber-400/[.08]' : 'border-white/10 bg-white/[.03]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-lg font-black text-white"><span className="material-icons text-amber-300">payments</span> Solicitações de saque</h3><p className="mt-1 text-sm text-slate-400">{pendingWithdrawals.length ? `${pendingWithdrawals.length} solicitações aguardando transferência Pix.` : 'Nenhuma solicitação de saque pendente.'}</p></div>
          {pendingWithdrawals.length > 0 && <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-black">Ação necessária · {pendingWithdrawals.length}</span>}
        </div>
        {pendingWithdrawals.length > 0 && <div className="mt-4 space-y-3">{pendingWithdrawals.map(w => <div key={w.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#081c27] p-4">
          <div className="min-w-0"><div className="font-black text-white">{w.affiliate_name} <span className="ml-2 text-emerald-300">{fmt(w.amount)}</span></div><p className="mt-1 text-sm text-slate-200">Titular: <b>{w.holder_name}</b></p><p className="break-all text-sm text-cyan-200">Chave Pix ({pixKeyTypeLabel(w.pix_key_type)}): {w.pix_key}</p><p className="mt-1 text-xs text-slate-500">Solicitado em {new Date(w.requested_at).toLocaleString('pt-BR')}</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => navigator.clipboard?.writeText(w.pix_key)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white">Copiar Pix</button><button onClick={() => { setSettlementError(''); setSettlement({ withdrawal: w, action: 'paid' }) }} className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-black">Marcar saque executado</button><button onClick={() => { setSettlementError(''); setSettlement({ withdrawal: w, action: 'rejected' }) }} className="rounded-xl border border-rose-300/25 px-3 py-2 text-xs font-bold text-rose-200">Recusar</button></div>
        </div>)}</div>}
        {data.withdrawals.some(w=>w.status !== 'requested') && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Histórico de saques processados</summary><div className="mt-3 space-y-2">{data.withdrawals.filter(w=>w.status !== 'requested').map(w=><div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-4 py-3 text-sm"><div><b className="text-white">{w.affiliate_name}</b><span className="ml-3 text-slate-400">{new Date(w.requested_at).toLocaleDateString('pt-BR')}</span></div><div className="flex gap-3"><span className="font-bold text-white">{fmt(w.amount)}</span><span className={w.status === 'paid' ? 'text-emerald-300' : 'text-rose-300'}>{w.status === 'paid' ? 'Executado' : 'Recusado'}</span></div></div>)}</div></details>}
      </div>

      {showForm && (
        <div className="rounded-2xl bg-white/[.04] p-5 ring-1 ring-cyan-400/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black text-white">
                {editing ? 'Editar vendedor' : 'Novo vendedor comissionado'}
              </h3>
              <p className="text-xs text-slate-500">
                O vendedor precisa ser um cliente já cadastrado.
              </p>
            </div>
            <button onClick={resetForm} className="text-slate-400">
              Fechar
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-300 lg:col-span-2">
              Cliente
              <select
                value={form.user_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    user_id: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              >
                <option value="">Selecione um cliente</option>
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.id}
                    {p.phone ? ` — ${p.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Slug do link
              <input
                value={form.slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slug: e.target.value,
                  })
                }
                placeholder="joao"
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              />
              <span className="text-[11px] text-slate-500">
                /v/{form.slug || 'joao'}
              </span>
            </label>
            <label className="text-sm text-slate-300">
              Validade
              <input
                type="number"
                min="1"
                max="365"
                value={form.attribution_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    attribution_days: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              />
              <span className="text-[11px] text-slate-500">
                dias de atribuição
              </span>
            </label>
            <label className="text-sm text-slate-300">
              Comissão
              <select
                value={form.commission_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    commission_type: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Valor
              <input
                type="number"
                min="0"
                step=".01"
                value={form.commission_value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    commission_value: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({
                    ...form,
                    active: e.target.checked,
                  })
                }
              />{' '}
              Vendedor ativo
            </label>
          </div>
          <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-slate-400">
            A comissão é calculada sobre o valor total antes do desconto. Se
            link e cupom forem de vendedores diferentes, o vendedor do cupom
            recebe a comissão. Renovação VIP não gera nova comissão.
          </div>
          {!editing && <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/[.05] p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-white"><input type="checkbox" checked={form.create_coupon} onChange={e=>setForm({...form, create_coupon:e.target.checked})}/> Criar cupom exclusivo junto com o vendedor</label>
            {form.create_coupon && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-slate-300">Código do cupom<input value={form.initial_coupon.code} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,code:e.target.value.toUpperCase()}})} placeholder="VENDEDORA10" className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"/></label>
              <label className="text-xs font-semibold text-slate-300">Descrição<input value={form.initial_coupon.label} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,label:e.target.value}})} placeholder="Cupom da vendedora" className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"/></label>
              <label className="text-xs font-semibold text-slate-300">Tipo de desconto<select value={form.initial_coupon.discount_type} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,discount_type:e.target.value}})} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"><option value="percent">Porcentagem (%)</option><option value="fixed_min">Valor fixo (R$)</option></select></label>
              <label className="text-xs font-semibold text-slate-300">Valor do desconto<input type="number" min="0.01" max={form.initial_coupon.discount_type === 'percent' ? 100 : undefined} step=".01" value={form.initial_coupon.discount_value} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,discount_value:e.target.value}})} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"/></label>
              <label className="text-xs font-semibold text-slate-300">Onde funciona<select value={form.initial_coupon.applies_to} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,applies_to:e.target.value}})} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"><option value="products">Produtos e personalizadas</option><option value="vip">VIP</option><option value="both">Produtos + VIP</option></select></label>
              <label className="text-xs font-semibold text-slate-300">Limite de usos<input type="number" min="1" value={form.initial_coupon.max_uses} onChange={e=>setForm({...form,initial_coupon:{...form.initial_coupon,max_uses:e.target.value}})} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-white ring-1 ring-white/10"/></label>
              <div className="col-span-full text-xs text-slate-400">Se este cupom for utilizado em uma compra elegível, a comissão será atribuída automaticamente a este vendedor, mesmo que o visitante tenha acessado o link de outro vendedor.</div>
            </div>}
          </div>}
          <div className="mt-4 flex gap-2">
            <button
              disabled={saving || !form.user_id || !form.slug}
              onClick={save}
              className="rounded-xl bg-emerald-400 px-5 py-2 font-black text-black disabled:opacity-50"
            >
              {saving
                ? 'Salvando…'
                : editing
                  ? 'Salvar alterações'
                  : 'Criar vendedor'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl px-5 py-2 text-slate-200 ring-1 ring-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white">Vendedores cadastrados</h3>
            <p className="text-xs text-slate-500">
              Clique em editar para alterar comissão, link ou ativação.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-slate-400">Carregando…</div>
        ) : data.affiliates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
            Nenhum vendedor criado. Clique em{' '}
            <b className="text-cyan-300">+ Novo vendedor</b>.
          </div>
        ) : (
          <div className="space-y-3">
            {data.affiliates.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">
                      {a.profile?.full_name || a.user_id}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span
                        className={
                          a.active
                            ? 'rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300'
                            : 'rounded-full bg-slate-500/10 px-2 py-1 text-slate-400'
                        }
                      >
                        {a.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-cyan-300">
                        /v/{a.slug}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">
                        {a.commission_type === 'fixed'
                          ? fmt(a.commission_value)
                          : `${a.commission_value}%`}{' '}
                        comissão
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigator.clipboard?.writeText(
                          `${siteOrigin}/v/${a.slug}`
                        )
                      }
                      className="rounded-xl px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10"
                    >
                      Copiar link
                    </button>
                    <button onClick={() => { setCoupon({...emptyCoupon, affiliate_id: a.id}); setShowCoupon(true); }} className="rounded-xl border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-200">Criar cupom</button>
                    <button
                      onClick={() => edit(a)}
                      className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10"
                    >
                      Editar
                    </button>
                    <button onClick={() => { setDeleteError(''); setDeleteTarget(a) }} className="rounded-xl border border-rose-300/20 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-400/10">Excluir</button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-7">
                  {[
                    ['Acessos', a.stats?.visits || 0],
                    ['Visitantes', a.stats?.unique_visitors || 0],
                    ['Pedidos', a.stats?.orders || 0],
                    ['Vendas', fmt(a.stats?.revenue)],
                    ['Comissão', fmt(a.stats?.commission)],
                    ['Pendente', fmt(a.stats?.pending)],
                    ['Paga', fmt(a.stats?.paid)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white/[.03] p-3">
                      <div className="text-[10px] uppercase text-slate-500">
                        {label}
                      </div>
                      <div className="mt-1 font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>
                {(a.commissions || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {a.commissions.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[.02] p-3 text-xs text-slate-300"
                      >
                        <span>
                          Pedido {String(c.order_id).slice(0, 8)}… · base{' '}
                          {fmt(c.commission_base)} · comissão{' '}
                          {fmt(c.commission_value)}
                        </span>
                        <span className="flex items-center gap-2">
                          <b>{c.status}</b>
                          {c.withdrawal_id && <span className="text-cyan-200">Saque solicitado</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-white">Cupons dos vendedores</h3>
            <p className="text-xs text-slate-500">
              O vendedor associado ao cupom vence qualquer vendedor atribuído
              pelo link.
            </p>
          </div>
          <button
            onClick={() => setShowCoupon((v) => !v)}
            className="rounded-xl bg-cyan-300 px-4 py-2 font-black text-black"
          >
            {showCoupon ? 'Fechar' : '+ Novo cupom'}
          </button>
        </div>
        {showCoupon && (
          <div className="mt-4 rounded-xl bg-black/20 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-300">
                Vendedor
                <select
                  value={coupon.affiliate_id}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      affiliate_id: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                >
                  <option value="">Selecione</option>
                  {data.affiliates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.profile?.full_name || a.slug}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Código
                <input
                  value={coupon.code}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="JOAO10"
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
              <label className="text-sm text-slate-300">
                Descrição
                <input
                  value={coupon.label}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      label: e.target.value,
                    })
                  }
                  placeholder="Cupom do João"
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
              <label className="text-sm text-slate-300">
                Desconto
                <select
                  value={coupon.discount_type}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      discount_type: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed_min">Valor fixo (R$)</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={coupon.discount_value}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      discount_value: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
              <label className="text-sm text-slate-300">
                Aplicação
                <select
                  value={coupon.applies_to}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      applies_to: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                >
                  <option value="products">Produtos</option>
                  <option value="vip">Assinatura VIP</option>
                  <option value="both">Produtos + VIP</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Mínimo
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={coupon.min_order_value}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      min_order_value: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
              <label className="text-sm text-slate-300">
                Limite de usos
                <input
                  type="number"
                  min="1"
                  value={coupon.max_uses}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      max_uses: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
              <label className="text-sm text-slate-300">
                Expiração
                <input
                  type="date"
                  value={coupon.expires_at}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      expires_at: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                />
              </label>
            </div>
            {coupon.applies_to !== 'vip' && (
              <label className="mt-3 block text-sm text-slate-300">
                Produtos específicos (opcional)
                <select
                  multiple
                  value={coupon.product_ids}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      product_ids: Array.from(e.target.selectedOptions).map(
                        (o) => o.value
                      ),
                    })
                  }
                  className="mt-1 min-h-24 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                >
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {coupon.applies_to !== 'products' && (
              <label className="mt-3 block text-sm text-slate-300">
                Planos VIP específicos (opcional)
                <select
                  multiple
                  value={coupon.vip_plan_ids}
                  onChange={(e) =>
                    setCoupon({
                      ...coupon,
                      vip_plan_ids: Array.from(e.target.selectedOptions).map(
                        (o) => o.value
                      ),
                    })
                  }
                  className="mt-1 min-h-24 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                >
                  {data.vip_plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.short_name || p.id} — {fmt(p.price_brl)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              disabled={couponBusy || !coupon.affiliate_id || !coupon.code}
              onClick={saveCoupon}
              className="mt-4 rounded-xl bg-emerald-400 px-5 py-2 font-black text-black disabled:opacity-50"
            >
              {couponBusy ? 'Salvando…' : 'Criar cupom'}
            </button>
          </div>
        )}
        {data.coupons.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.coupons.map((c) => (
              <div
                key={c.code}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 p-3 text-sm"
              >
                <div>
                  <b className="text-white">{c.code}</b>
                  <span className="ml-2 text-slate-400">{c.label}</span>
                  <div className="text-xs text-slate-500">
                    {c.affiliate_name || 'Vendedor'} ·{' '}
                    {c.discount_type === 'percent'
                      ? `${c.discount_value}%`
                      : fmt(c.discount_value)}{' '}
                    · {c.applies_to}
                  </div>
                </div>
                <span
                  className={c.active ? 'text-emerald-300' : 'text-slate-500'}
                >
                  {c.active ? 'Ativo' : 'Inativo'} · {c.used_count || 0}/
                  {c.max_uses || '∞'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
