import React from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabaseClient.js';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';

const brl = (number) => Number(number || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const dateBR = (date) => date ? new Date(date).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const commissionStatus = { pending:'Aguardando pagamento', confirmed:'Confirmada', paid:'Paga', cancelled:'Cancelada' };
const withdrawalStatus = { requested:'Aguardando transferência', paid:'Saque executado', rejected:'Recusado' };
const fieldClass = 'mt-2 w-full rounded-xl border border-white/10 bg-[#071b25] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60';
function Surface({ children, className = '' }) { return <section className={`rounded-3xl border border-white/10 bg-[#091c27]/90 p-5 shadow-xl shadow-black/10 sm:p-6 ${className}`}>{children}</section>; }
function Metric({ label, value, icon, hint, emphasized }) {
  return <div className={`rounded-2xl border p-4 ${emphasized ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-white/[.035]'}`}>
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><span className="material-icons text-base text-cyan-300">{icon}</span>{label}</div>
    <div className="mt-2 break-words text-xl font-black text-white sm:text-2xl">{value}</div>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>;
}
function Pill({ children, tone = 'amber' }) { const classes = { amber:'text-amber-200 bg-amber-400/10 border-amber-300/20', green:'text-emerald-200 bg-emerald-400/10 border-emerald-300/20', red:'text-rose-200 bg-rose-400/10 border-rose-300/20', slate:'text-slate-200 bg-white/5 border-white/10' }; return <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${classes[tone] || classes.slate}`}>{children}</span>; }

export default function SellerDashboardPage({ onGoAccount, onGoHome }) {
  const { user, accountHasPassword } = useAuth();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = React.useState(false);
  const [withdrawalPassword, setWithdrawalPassword] = React.useState('');
  const [withdrawalError, setWithdrawalError] = React.useState('');
  const [editPix, setEditPix] = React.useState(false);
  const [pix, setPix] = React.useState({ pix_key:'', holder_name:'' });
  const [tab, setTab] = React.useState('commissions');

  const token = React.useCallback(async () => (await supabase.auth.getSession())?.data?.session?.access_token, []);
  const refresh = React.useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const jwt = await token();
      if (!jwt) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/affiliate?action=me', { headers: { Authorization: `Bearer ${jwt}` }, cache:'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar seu painel.');
      setData(body);
      setPix({ pix_key: body.payout_profile?.pix_key || '', holder_name: body.payout_profile?.holder_name || '' });
    } catch (e) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }, [token, user?.id]);
  React.useEffect(() => { refresh(); }, [refresh]);
  const action = async (actionName, body) => {
    const jwt = await token();
    if (!jwt) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch(`/api/affiliate?action=${actionName}`, {
      method:'POST', headers: { Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json' },
      body: JSON.stringify(body || {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível completar a operação.');
    return result;
  };
  const savePix = async () => {
    setError(''); setMessage(''); setSaving(true);
    try { await action('save-pix', pix); setEditPix(false); setMessage('Dados Pix salvos para os próximos saques.'); await refresh(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const openWithdrawal = () => {
    setError(''); setMessage(''); setWithdrawalError(''); setWithdrawalPassword('');
    if (!data?.payout_profile) { setEditPix(true); setError('Cadastre sua chave Pix e o nome do titular antes de solicitar.'); return; }
    if (!(Number(data.stats?.available_balance || 0) > 0)) return setError('Ainda não há saldo confirmado disponível para saque.');
    setWithdrawalOpen(true);
  };
  const requestWithdrawal = async () => {
    if (requesting || !withdrawalPassword.trim()) return;
    setWithdrawalError(''); setRequesting(true);
    try {
      await action('request-withdrawal', { password: withdrawalPassword });
      setWithdrawalOpen(false); setWithdrawalPassword('');
      setMessage('Solicitação de saque enviada com sucesso!');
      setTab('withdrawals'); await refresh();
    } catch (e) { setWithdrawalError(e.message || 'Não foi possível solicitar o saque.'); }
    finally { setRequesting(false); }
  };
  const copyText = async (value, label) => {
    try { await navigator.clipboard.writeText(value); setError(''); setMessage(`${label} copiado!`); }
    catch { setError('Não foi possível copiar automaticamente. Selecione o texto e copie.'); }
  };
  const copyLink = async () => {
    await copyText(`${window.location.origin}/v/${data.affiliate.slug}`, 'Link de indicação');
  };
  const affiliate = data?.affiliate;
  const stats = data?.stats || {};
  const pendingWithdrawal = (data?.withdrawals || []).some(w => w.status === 'requested');
  const activeCoupons = (data?.coupons || []).filter(c => c.active && (!c.expires_at || new Date(c.expires_at) > new Date()) && (Number(c.used_count || 0) < (Number(c.max_uses) || 1)));
  const primaryCoupon = activeCoupons[0];
  return <main className="min-h-[70vh] bg-[#06141d] text-slate-100">
    <div className="container-cc mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Cubo Criativo · Parceiros</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Minha área de vendedor</h1><p className="mt-2 max-w-xl text-sm text-slate-400">Acompanhe indicações, comissões confirmadas e solicitações de saque em um só lugar.</p></div>
        <div className="flex gap-2"><button onClick={onGoAccount} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/5">Minha conta</button><button onClick={onGoHome} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/5">Loja</button></div>
      </div>
      {error && <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>}
      {message && <div role="status" className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">{message}</div>}
      {loading && !data ? <Surface><p className="py-12 text-center text-slate-400">Carregando seu painel…</p></Surface> : !user ? <Surface><h2 className="font-bold">Entre na sua conta para acessar o painel.</h2><button onClick={onGoAccount} className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-black">Entrar</button></Surface> : !affiliate ? <Surface><h2 className="text-xl font-bold">Acesso exclusivo para vendedores</h2><p className="mt-2 text-slate-400">Seu cadastro ainda não está habilitado como vendedor. Entre em contato com a administração.</p><button onClick={onGoAccount} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 font-bold text-black">Minha conta</button></Surface> : <>
        <Surface className="relative overflow-hidden border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 via-[#091c27] to-violet-500/10">
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.17em] text-cyan-300">Seu canal de vendas</p><h2 className="mt-1 text-xl font-black">Compartilhe seu link</h2></div><Pill tone={affiliate.active ? 'green' : 'red'}>{affiliate.active ? 'Vendedor ativo' : 'Vendedor inativo'}</Pill></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="Link de indicação" readOnly value={`${window.location.origin}/v/${affiliate.slug}`} onFocus={e=>e.target.select()} className="min-w-0 flex-1 rounded-xl border border-cyan-300/20 bg-black/25 px-4 py-3 font-mono text-sm text-cyan-100"/><button onClick={copyLink} className="rounded-xl bg-cyan-300 px-6 py-3 font-black text-[#06202c] transition hover:bg-cyan-200">Copiar link</button></div>
          {primaryCoupon && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/[.07] p-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Seu cupom de vendedor</p><p className="mt-1 font-mono text-xl font-black tracking-wider text-white">{primaryCoupon.code}</p><p className="mt-1 text-xs text-slate-300">{primaryCoupon.discount_type === 'percent' ? `${primaryCoupon.discount_value}%` : brl(primaryCoupon.discount_value)} de desconto para seus clientes</p></div>
            <button type="button" onClick={() => copyText(primaryCoupon.code, 'Cupom')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-300/15 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-300/25"><span aria-hidden="true" className="material-icons text-lg">content_copy</span> Copiar cupom</button>
          </div>}
          <p className="mt-3 text-xs text-slate-400">As compras feitas após uma visita registrada ao link podem gerar comissão por {affiliate.attribution_days || 30} dias. Quando o cliente usa um cupom de vendedor, esse cupom tem prioridade na atribuição.</p>
        </Surface>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon="account_balance_wallet" label="Saldo disponível" value={brl(stats.available_balance)} hint="Comissões confirmadas, liberadas para saque" emphasized/><Metric icon="hourglass_top" label="Em processamento" value={brl(stats.reserved_balance)} hint="Saldo reservado em solicitações"/><Metric icon="schedule" label="A confirmar" value={brl(stats.pending_commission)} hint="Vendas aguardando pagamento"/><Metric icon="check_circle" label="Total recebido" value={brl(stats.paid_commission)} hint="Saques já executados"/></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon="visibility" label="Acessos pelo link" value={Number(stats.visits || 0).toLocaleString('pt-BR')}/><Metric icon="people" label="Visitantes únicos" value={Number(stats.unique_visitors || 0).toLocaleString('pt-BR')}/><Metric icon="shopping_bag" label="Pedidos atribuídos" value={Number(stats.orders || 0).toLocaleString('pt-BR')}/><Metric icon="trending_up" label="Vendas atribuídas" value={brl(stats.revenue)}/></div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Surface className="lg:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-black">Recebimento por Pix</h2><p className="mt-1 text-sm text-slate-400">Salve os dados uma vez. Você poderá editá-los quando quiser.</p></div><button onClick={()=>setEditPix(v=>!v)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-cyan-200">{editPix ? 'Fechar edição' : data.payout_profile ? 'Editar dados' : 'Cadastrar Pix'}</button></div>
            {editPix || !data.payout_profile ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-300">Chave Pix<input value={pix.pix_key} maxLength={140} onChange={e=>setPix(p=>({...p,pix_key:e.target.value}))} placeholder="CPF, e-mail, telefone ou chave aleatória" className={fieldClass}/></label><label className="text-sm text-slate-300">Nome do titular da conta<input value={pix.holder_name} maxLength={140} onChange={e=>setPix(p=>({...p,holder_name:e.target.value}))} placeholder="Nome como consta no banco" className={fieldClass}/></label><button onClick={savePix} disabled={saving || pix.pix_key.trim().length < 3 || pix.holder_name.trim().length < 3} className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-black disabled:opacity-40 sm:col-span-2">{saving ? 'Salvando…' : 'Salvar dados Pix'}</button></div> : <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Chave Pix cadastrada</p><p className="mt-1 break-all font-semibold text-white">{data.payout_profile.pix_key}</p></div><div><p className="text-xs text-slate-500">Titular</p><p className="mt-1 font-semibold text-white">{data.payout_profile.holder_name}</p></div></div>}
          </Surface>
          <Surface className="lg:col-span-2"><h2 className="text-xl font-black">Solicitar saque</h2><p className="mt-2 text-3xl font-black text-cyan-200">{brl(stats.available_balance)}</p><p className="mt-1 text-sm text-slate-400">Valor confirmado e disponível para saque.</p>{pendingWithdrawal && <div className="mt-4"><Pill>Saque anterior aguardando transferência</Pill></div>}<button disabled={!affiliate.active || pendingWithdrawal || !Number(stats.available_balance) || !data.payout_profile || requesting} onClick={openWithdrawal} className="mt-5 w-full rounded-xl bg-emerald-300 px-5 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{requesting ? 'Solicitando…' : 'Solicitar saque'}</button>{!data.payout_profile && <p className="mt-2 text-xs text-amber-200">Cadastre seus dados Pix para habilitar o botão.</p>}{!accountHasPassword && <p className="mt-2 text-xs text-amber-200">Se você criou a conta apenas com Google e não possui senha, defina uma usando a recuperação de acesso antes de solicitar saque.</p>}</Surface>
        </div>
        <Surface><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Seu histórico</h2><button onClick={refresh} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5">Atualizar dados</button></div><div className="mb-5 flex flex-wrap gap-2">{[['commissions','Comissões'],['withdrawals','Saques'],['coupons','Meus cupons']].map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab===key ? 'bg-cyan-300 text-black' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>{label}</button>)}</div>
          {tab==='commissions' && <div className="space-y-2">{(data.commissions || []).length ? data.commissions.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.03] p-4"><div><p className="font-bold text-white">Pedido #{String(c.order_id).slice(0,8).toUpperCase()}</p><p className="mt-1 text-xs text-slate-400">{dateBR(c.created_at)} · Base {brl(c.commission_base)} · Taxa {Number(c.commission_rate).toLocaleString('pt-BR')}</p></div><div className="flex flex-col items-end gap-1"><b className="text-emerald-200">{brl(c.commission_value)}</b><Pill tone={c.status==='confirmed'||c.status==='paid'?'green':c.status==='cancelled'?'red':'amber'}>{commissionStatus[c.status] || c.status}</Pill></div></div>) : <p className="py-8 text-center text-sm text-slate-400">Nenhuma comissão registrada até agora.</p>}</div>}
          {tab==='withdrawals' && <div className="space-y-2">{(data.withdrawals || []).length ? data.withdrawals.map(w=><div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.03] p-4"><div><p className="font-bold">Saque de {brl(w.amount)}</p><p className="mt-1 text-xs text-slate-400">Solicitado em {dateBR(w.requested_at)} · Pix: {w.pix_key}</p>{w.notes && <p className="mt-1 text-xs text-slate-400">{w.notes}</p>}</div><Pill tone={w.status==='paid'?'green':w.status==='rejected'?'red':'amber'}>{withdrawalStatus[w.status] || w.status}</Pill></div>) : <p className="py-8 text-center text-sm text-slate-400">Nenhum saque solicitado.</p>}</div>}
          {tab==='coupons' && <div className="grid gap-3 sm:grid-cols-2">{(data.coupons || []).length ? data.coupons.map(c=><div key={c.code} className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="flex justify-between gap-2"><b className="font-mono text-lg text-cyan-200">{c.code}</b><Pill tone={c.active?'green':'slate'}>{c.active?'Ativo':'Inativo'}</Pill></div><p className="mt-2 text-sm text-slate-300">{c.label || 'Cupom de indicação'}</p><p className="mt-2 text-xs text-slate-400">{c.discount_type==='percent'?`${c.discount_value}%` : brl(c.discount_value)} de desconto · {c.used_count || 0} usos</p><button type="button" onClick={() => copyText(c.code, 'Cupom')} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-200 ring-1 ring-cyan-300/20 hover:bg-cyan-300/20"><span aria-hidden="true" className="material-icons text-base">content_copy</span> Copiar cupom</button></div>) : <p className="py-8 text-sm text-slate-400">Nenhum cupom vinculado à sua conta.</p>}</div>}
        </Surface>
        <p className="text-xs text-slate-500">As comissões passam a disponíveis somente após a confirmação do pagamento. O status do saque pode ser acompanhado na aba Saques.</p>
      </>}
    </div>
    <ConfirmationDialog open={withdrawalOpen} title="Confirmar solicitação de saque" description="Confira os dados de recebimento e informe a senha da sua conta para autorizar a solicitação." onClose={() => { setWithdrawalOpen(false); setWithdrawalPassword(''); setWithdrawalError(''); }} onConfirm={requestWithdrawal} confirmLabel="Confirmar saque" busy={requesting} disabled={!withdrawalPassword.trim()}>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Valor do saque</p>
        <p className="mt-1 text-2xl font-black text-emerald-200">{brl(stats.available_balance)}</p>
        <p className="mt-3 break-all text-sm text-slate-300">Chave Pix: <strong className="text-white">{data?.payout_profile?.pix_key}</strong></p>
        <p className="mt-1 text-sm text-slate-300">Titular: <strong className="text-white">{data?.payout_profile?.holder_name}</strong></p>
      </div>
      <form onSubmit={event => { event.preventDefault(); requestWithdrawal(); }} className="mt-4">
        <label htmlFor="withdrawal-password" className="text-sm font-bold text-slate-200">Senha da sua conta</label>
        <input id="withdrawal-password" type="password" autoComplete="current-password" autoFocus required value={withdrawalPassword} onChange={event => setWithdrawalPassword(event.target.value)} className={fieldClass} placeholder="Digite sua senha para confirmar" />
        {withdrawalError && <p role="alert" className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-200">{withdrawalError}</p>}
      </form>
    </ConfirmationDialog>
  </main>;
}
