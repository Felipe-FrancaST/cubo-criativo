import React from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../lib/supabaseClient";
import brand from "../data/config";
import { buildTrackingUrl, resolveTrackingCarrier, trackingCarrierLabel } from "../lib/tracking";


function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function prodUI(status) {
  const v = String(status || 'recebido').toLowerCase();
  if (v === 'recebido' || v === 'editavel') return { label: 'Recebido', cls: 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/25' };
  if (v === 'em_producao') return { label: 'Em produção', cls: 'bg-cyan-600/10 text-indigo-200 ring-indigo-400/25' };
  if (v === 'pronto') return { label: 'Pronto', cls: 'bg-sky-400/10 text-sky-200 ring-sky-400/25' };
  if (v === 'enviado') return { label: 'Enviado', cls: 'bg-cyan-500/10 text-amber-100 ring-amber-400/25' };
  if (v === 'entregue') return { label: 'Entregue', cls: 'bg-teal-500/10 text-teal-100 ring-teal-400/25' };
  if (v === 'cancelado') return { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-200 ring-rose-400/25' };
  return { label: v.replaceAll('_', ' '), cls: 'bg-white/4 text-slate-200 ring-white/10' };
}

function trackUrl(code, trackingUrl, shippingCarrier) {
  return buildTrackingUrl({ code, fallbackUrl: trackingUrl, carrier: resolveTrackingCarrier({ carrier: shippingCarrier, trackingUrl }) });
}

function emailEventLabel(type, status) {
  const t = String(type || '').toLowerCase();
  const s = String(status || '').toLowerCase();
  if (t.startsWith('order_status:')) {
    const stage = t.split(':')[1] || 'atualizado';
    return `E-mail enviado: ${stage.replaceAll('_', ' ')}`;
  }
  if (t.includes('vip') && t.includes('upgrade')) return 'E-mail de upgrade VIP';
  if (t.includes('vip')) return 'E-mail VIP';
  if (t) return `E-mail ${t}`;
  return s === 'sent' ? 'E-mail enviado' : 'Histórico atualizado';
}

function synthesizeTimeline(order) {
  const events = [];
  if (order?.created_at) {
    events.push({
      id: `${order.id}:created`,
      happened_at: order.created_at,
      event_type: 'order.created',
      title: 'Pedido criado',
      description: order?.order_type === 'vip' ? 'Seu ciclo VIP foi registrado.' : 'Recebemos seu pedido com sucesso.',
    });
  }
  if (order?.production_status) {
    events.push({
      id: `${order.id}:status:${order.production_status}`,
      happened_at: order.updated_at || order.created_at,
      event_type: 'order.status',
      title: `Status atual: ${prodUI(order.production_status).label}`,
      description: order.shipping_tracking ? `Rastreio disponível: ${order.shipping_tracking}` : 'Acompanhe as próximas atualizações por aqui.',
    });
  }
  if (order?.last_email_sent_at) {
    events.push({
      id: `${order.id}:email:${order.last_email_sent_at}`,
      happened_at: order.last_email_sent_at,
      event_type: 'email.sent',
      title: emailEventLabel(order.last_email_type, order.last_email_status),
      description: order.last_email_status === 'sent' ? 'Notificação enviada para o seu e-mail.' : (order.last_email_error || 'Houve uma tentativa de envio.'),
    });
  }
  return events.sort((a, b) => new Date(b.happened_at || 0) - new Date(a.happened_at || 0));
}

function QuickAction({ href, onClick, icon, title, text, external = false }) {
  const Comp = href ? 'a' : 'button';
  const props = href
    ? { href, ...(external ? { target: '_blank', rel: 'noreferrer' } : {}) }
    : { type: 'button', onClick };
  return (
    <Comp
      {...props}
      className="rounded-2xl bg-white/4 ring-1 ring-white/10 px-4 py-4 text-left hover:bg-white/[0.08] transition"
    >
      <div className="flex items-start gap-3">
        <span className="material-icons text-cyan-300">{icon}</span>
        <div>
          <div className="font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{text}</div>
        </div>
      </div>
    </Comp>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}


function PasswordInput({ value, onChange, autoComplete = "current-password", placeholder = "••••••••", className = "", inputClassName = "", buttonClassName = "", ...props }) {
  const [visible, setVisible] = React.useState(false);
  const resolvedInputClass = (className || inputClassName || "w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60").trim();
  const resolvedButtonClass = (buttonClassName || "absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-300 transition hover:text-white").trim();
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={resolvedInputClass}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className={resolvedButtonClass}
      >
        <span className="material-icons text-[20px]">{visible ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}

export default function AccountPage({ onClose, onGoHome }) {
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();

  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [birthdate, setBirthdate] = React.useState(""); // YYYY-MM-DD
  const [street, setStreet] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [addr2, setAddr2] = React.useState("");
  const [neighborhood, setNeighborhood] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateUF, setStateUF] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [dashboardLoading, setDashboardLoading] = React.useState(false);
  const [dashboardError, setDashboardError] = React.useState("");
  const [dashboard, setDashboard] = React.useState({ orders: [], events: [], vip: null });
  const [affiliateDashboard, setAffiliateDashboard] = React.useState(null);
  const [affiliateLoading, setAffiliateLoading] = React.useState(false);

  const fetchDashboard = React.useCallback(async () => {
    if (!user?.id) return;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const loadOrders = async () => {
        const attempts = [
          "id,status,total,payment_provider,provider_payment_id,created_at,updated_at,production_status,shipping_tracking,shipping_carrier,tracking_url,order_type,last_email_type,last_email_status,last_email_sent_at,last_email_error",
          "id,status,total,payment_provider,provider_payment_id,created_at,updated_at,production_status,shipping_tracking,shipping_carrier,order_type,last_email_type,last_email_status,last_email_sent_at,last_email_error",
          "id,status,total,payment_provider,provider_payment_id,created_at,updated_at,production_status,shipping_tracking,shipping_carrier,order_type",
          "id,status,total,payment_provider,provider_payment_id,created_at,updated_at,production_status,shipping_tracking,order_type",
        ];
        let lastError = null;
        for (const selectColumns of attempts) {
          const resp = await supabase
            .from("orders")
            .select(selectColumns)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(8);
          if (!resp.error) return resp;
          lastError = resp.error;
          if (!/column/i.test(String(resp.error.message || ""))) break;
        }
        return { data: null, error: lastError };
      };

      const [ordersResp, profileResp] = await Promise.all([
        loadOrders(),
        supabase.from("profiles").select("vip_until,vip_plan").eq("id", user.id).maybeSingle(),
      ]);

      if (ordersResp.error) throw ordersResp.error;
      const orders = Array.isArray(ordersResp.data) ? ordersResp.data : [];
      const visibleOrders = orders.filter((o) => !['vip_upgrade', 'vip-upgrade', 'upgrade_vip', 'upgrade'].includes(String(o.order_type || '').toLowerCase()));
      let timeline = [];
      try {
        const ids = visibleOrders.map((o) => o.id).slice(0, 8);
        if (ids.length) {
          const evResp = await supabase
            .from('order_events')
            .select('id,order_id,event_type,title,description,happened_at')
            .in('order_id', ids)
            .order('happened_at', { ascending: false })
            .limit(12);
          if (!evResp.error) {
            timeline = Array.isArray(evResp.data) ? evResp.data : [];
          }
        }
      } catch {}
      if (!timeline.length) {
        timeline = visibleOrders.flatMap((o) => synthesizeTimeline(o)).sort((a, b) => new Date(b.happened_at || 0) - new Date(a.happened_at || 0)).slice(0, 10);
      }
      setDashboard({
        orders: visibleOrders,
        events: timeline,
        vip: profileResp?.data || null,
      });
      try {
        setAffiliateLoading(true);
        const jwt = (await supabase.auth.getSession())?.data?.session?.access_token;
        if (jwt) {
          const ar = await fetch('/api/affiliate?action=me', { headers: { Authorization: `Bearer ${jwt}` } });
          const aj = await ar.json().catch(() => ({}));
          setAffiliateDashboard(ar.ok && aj?.affiliate ? aj : null);
        } else setAffiliateDashboard(null);
      } catch { setAffiliateDashboard(null); } finally { setAffiliateLoading(false); }
    } catch (e) {
      setDashboardError(e?.message || 'Não foi possível carregar os dados da sua conta.');
    } finally {
      setDashboardLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.id) return;
    fetchDashboard();
  }, [user?.id, fetchDashboard]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError("");
    setInfo("");

    if (!email) return setError("Informe seu e-mail.");
    if (!password) return setError("Informe sua senha.");
    if (mode === "signup") {
      if (!fullName.trim()) return setError("Informe seu nome.");
      if (!phone.trim()) return setError("Informe seu telefone.");
      if (!cpf.trim()) return setError("Informe seu CPF.");
      if (!birthdate) return setError("Informe sua data de nascimento.");
      if (!zip.trim()) return setError("Informe seu CEP.");
      if (!city.trim()) return setError("Informe sua cidade.");
      if (!stateUF.trim() || stateUF.trim().length !== 2) return setError("Informe sua UF (2 letras).");
      if (!neighborhood.trim()) return setError("Informe seu bairro.");
      if (!street.trim()) return setError("Informe sua rua.");
      if (!number.trim()) return setError("Informe o número.");
      if (!agreeTerms) return setError("Você precisa concordar com os Termos de uso e a Política de Privacidade para criar sua conta.");
    }

    try {
      setBusy(true);
      const fn = mode === "login" ? signIn : signUp;
      const { data, error: err } = await fn(
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              profile: {
                full_name: fullName.trim(),
                phone: phone.trim(),
                cpf: cpf.trim(),
                birthdate,
                address_line1: street.trim(),
                address_number: number.trim(),
                address_line2: addr2.trim(),
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: stateUF.trim(),
                zip: zip.trim(),
              },
            }
      );
      if (err) throw err;

      if (mode === "signup" && !data?.session) {
        // Email confirmation enabled
        setInfo("Conta criada! Confira seu e-mail para confirmar o cadastro e depois faça login.");
        setMode("login");
        setPassword("");
        return;
      }

      setInfo("Login realizado com sucesso.");
      onClose?.();
    } catch (e2) {
      setError(e2?.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError("");
    setInfo("");
    if (!email) return setError("Informe seu e-mail para enviar o link de recuperação.");
    try {
      setBusy(true);
      const { error: err } = await resetPassword({ email });
      if (err) throw err;
      setInfo("Enviamos um e-mail com o link para redefinir a senha.");
    } catch (e2) {
      setError(e2?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1">
      {affiliateLoading ? null : affiliateDashboard?.affiliate ? (
        <section className="container-cc px-4 sm:px-6 lg:px-8 pt-6">
          <div className="rounded-3xl bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-violet-500/10 p-5 sm:p-6 ring-1 ring-cyan-400/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Painel exclusivo</div>
                <div className="mt-1 text-2xl font-black text-white">Área do vendedor</div>
                <p className="mt-1 text-sm text-slate-400">Acompanhe seu link, acessos, vendas, comissão e cupons em um só lugar.</p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${affiliateDashboard.affiliate.active ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/20' : 'bg-rose-500/10 text-rose-200 ring-rose-400/20'}`}>{affiliateDashboard.affiliate.active ? 'Vendedor ativo' : 'Vendedor inativo'}</span>
            </div>

            <div className="mt-5 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-xs uppercase tracking-wide text-slate-500">Seu link de indicação</div>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 break-all rounded-xl bg-black/20 px-3 py-3 font-mono text-sm text-cyan-200 ring-1 ring-white/10">{window.location.origin}/v/{affiliateDashboard.affiliate.slug}</div>
                <button type="button" onClick={async ()=>{ try { await navigator.clipboard?.writeText(`${window.location.origin}/v/${affiliateDashboard.affiliate.slug}`); setInfo('Link do vendedor copiado!'); } catch {} }} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-black hover:bg-cyan-200">Copiar link</button>
              </div>
              <div className="mt-2 text-xs text-slate-500">As indicações ficam atribuídas por {affiliateDashboard.affiliate.attribution_days || 30} dias.</div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
              {[
                ['Acessos', affiliateDashboard.stats?.visits || 0],
                ['Visitantes', affiliateDashboard.stats?.unique_visitors || 0],
                ['Conversões', affiliateDashboard.stats?.converted_visitors || 0],
                ['Conversão', `${affiliateDashboard.stats?.conversion_rate || 0}%`],
                ['Pedidos', affiliateDashboard.stats?.orders || 0],
                ['Vendas', fmtBRL(affiliateDashboard.stats?.revenue || 0)],
                ['Comissão', fmtBRL(affiliateDashboard.stats?.confirmed_commission || 0)],
              ].map(([k,v])=><div key={k} className="rounded-xl bg-black/20 p-3 ring-1 ring-white/5"><div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div><div className="mt-1 font-bold text-white">{v}</div></div>)}
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div className="text-sm font-bold text-white">Comissões</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-slate-500">Pendente</div><div className="font-bold text-amber-200">{fmtBRL(affiliateDashboard.stats?.pending_commission || 0)}</div></div>
                  <div><div className="text-xs text-slate-500">Confirmada</div><div className="font-bold text-emerald-200">{fmtBRL(affiliateDashboard.stats?.confirmed_commission || 0)}</div></div>
                  <div><div className="text-xs text-slate-500">Paga</div><div className="font-bold text-cyan-200">{fmtBRL(affiliateDashboard.stats?.paid_commission || 0)}</div></div>
                </div>
                <div className="mt-4 space-y-2">
                  {(affiliateDashboard.commissions || []).slice(0,5).map((c)=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs"><span className="text-slate-300">Pedido {String(c.order_id).slice(0,8)}… · base {fmtBRL(c.commission_base)}</span><b className={c.status === 'paid' ? 'text-cyan-200' : c.status === 'confirmed' ? 'text-emerald-200' : c.status === 'cancelled' ? 'text-rose-200' : 'text-amber-200'}>{fmtBRL(c.commission_value)} · {c.status === 'paid' ? 'Paga' : c.status === 'confirmed' ? 'Confirmada' : c.status === 'cancelled' ? 'Cancelada' : 'Pendente'}</b></div>)}
                  {!(affiliateDashboard.commissions || []).length && <div className="text-xs text-slate-500">Ainda não há comissões registradas.</div>}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div className="text-sm font-bold text-white">Seus cupons</div>
                <div className="mt-2 space-y-2">
                  {(affiliateDashboard.coupons || []).map((c)=><div key={c.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2"><div><b className="text-cyan-200">{c.code}</b><div className="text-xs text-slate-500">{c.label || 'Cupom'} · {c.discount_type === 'percent' ? `${c.discount_value}%` : fmtBRL(c.discount_value)} · {c.applies_to === 'both' ? 'Produtos + VIP' : c.applies_to === 'vip' ? 'VIP' : 'Produtos'}</div></div><span className={c.active ? 'text-xs text-emerald-200' : 'text-xs text-slate-500'}>{c.active ? 'Ativo' : 'Inativo'}</span></div>)}
                  {!(affiliateDashboard.coupons || []).length && <div className="text-xs text-slate-500">Nenhum cupom vinculado a você.</div>}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <section
        className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="rounded-3xl ring-1 ring-white/10 bg-[#07161d]/40 backdrop-blur p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">Minha conta</h1>
              <p className="mt-1 text-sm text-slate-400">
                Entre para finalizar pedidos, acompanhar compras e pagar com segurança.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onGoHome && (
                <button
                  onClick={onGoHome}
                  className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4"
                >
                  Início
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>

          {user ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-300">Logado como</p>
                    <p className="mt-1 font-mono text-sm text-slate-100 break-all">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={fetchDashboard}
                      className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4"
                    >
                      Atualizar painel
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4"
                    >
                      Sair
                    </button>
                    <button
                      onClick={() => {
                        onGoHome?.();
                        onClose?.();
                      }}
                      className="rounded-xl px-3 py-2 text-sm font-semibold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
                    >
                      Voltar para a loja
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  ['Últimos pedidos', dashboard.orders.length],
                  ['Em produção', dashboard.orders.filter((o) => String(o.production_status || '').toLowerCase() === 'em_producao').length],
                  ['Com rastreio', dashboard.orders.filter((o) => !!o.shipping_tracking).length],
                  ['VIP', dashboard.vip?.vip_until && new Date(dashboard.vip.vip_until).getTime() > Date.now() ? 'Ativo' : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-2 text-2xl font-extrabold text-slate-100">{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-4">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Últimos pedidos</div>
                        <div className="mt-1 text-lg font-extrabold text-slate-100">Status atual e rastreio</div>
                      </div>
                    </div>
                    {dashboardLoading ? (
                      <div className="mt-4 text-sm text-slate-300">Carregando painel…</div>
                    ) : dashboardError ? (
                      <div className="mt-4 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/20 px-3 py-2 text-sm text-rose-200">{dashboardError}</div>
                    ) : dashboard.orders.length === 0 ? (
                      <div className="mt-4 rounded-xl bg-black/20 ring-1 ring-white/10 px-4 py-4 text-sm text-slate-300">Você ainda não tem pedidos registrados.</div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {dashboard.orders.slice(0, 5).map((order) => {
                          const status = prodUI(order.production_status);
                          return (
                            <div key={order.id} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="text-xs text-slate-400">{new Date(order.created_at).toLocaleString('pt-BR')}</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 ${status.cls}`}>{status.label}</span>
                                    {order.order_type === 'vip' ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 ring-violet-400/20 bg-violet-500/10 text-violet-100">VIP</span> : null}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-400">Valor</div>
                                  <div className="text-base font-extrabold text-slate-100">{fmtBRL(order.total)}</div>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                {order.shipping_tracking ? (
                                  <>
                                    <span className="rounded-full bg-white/4 px-3 py-1 ring-1 ring-white/10">{trackingCarrierLabel(order.shipping_carrier)} • <b>{order.shipping_tracking}</b></span>
                                    <a href={trackUrl(order.shipping_tracking, order.tracking_url, order.shipping_carrier)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-400 px-3 py-1 font-semibold text-black hover:bg-emerald-300">Rastrear</a>
                                  </>
                                ) : (
                                  <span className="text-slate-400">Sem rastreio disponível no momento.</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 ring-1 ring-white/10 p-5">
                    <div className="text-xs uppercase tracking-wide text-slate-300">Atalhos rápidos</div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <QuickAction href={`https://wa.me/${brand.whatsapp}`} external icon="support_agent" title="Suporte no WhatsApp" text="Fale com a Cubo sobre pedido, prazo, rastreio ou dúvidas." />
                      <QuickAction href="/vip" icon="workspace_premium" title="Área VIP" text="Abra sua área VIP para acompanhar ciclo, escolhas e upgrades." />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Histórico recente</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-100">Atualizações de pedido e e-mails</div>
                    <div className="mt-4 space-y-3">
                      {(dashboard.events || []).slice(0, 8).map((event) => (
                        <div key={event.id || `${event.event_type}-${event.happened_at}`} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-100">{event.title || 'Atualização'}</div>
                              <div className="mt-1 text-sm text-slate-400">{event.description || 'Seu pedido teve uma nova atualização.'}</div>
                            </div>
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">{event.happened_at ? new Date(event.happened_at).toLocaleString('pt-BR') : '—'}</div>
                          </div>
                        </div>
                      ))}
                      {!dashboardLoading && !(dashboard.events || []).length ? (
                        <div className="rounded-xl bg-black/20 ring-1 ring-white/10 px-4 py-4 text-sm text-slate-300">As próximas atualizações do seu pedido vão aparecer aqui.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setAgreeTerms(false); }}
                  className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${
                    mode === "login" ? "bg-white/6" : "hover:bg-white/4"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setAgreeTerms(false); }}
                  className={`rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 ${
                    mode === "signup" ? "bg-white/6" : "hover:bg-white/4"
                  }`}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                {mode === "signup" && (
  <div className="space-y-3">
    <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
      <p className="text-sm font-semibold text-slate-100">Dados para entrega</p>
      <p className="mt-1 text-xs text-slate-400">
        Preencha para facilitar o fechamento do pedido (você pode editar depois).
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            autoComplete="name"
            className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
            placeholder="Seu nome"
          />
        </Field>

        <Field label="Telefone (WhatsApp)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoComplete="tel"
            className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
            placeholder="(11) 99999-9999"
          />
        </Field>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="CPF">
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              type="date"
              autoComplete="bday"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="CEP">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="00000-000"
            />
          </Field>
          <Field label="UF">
            <input
              value={stateUF}
              onChange={(e) => setStateUF(e.target.value.toUpperCase())}
              type="text"
              autoComplete="address-level1"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="SP"
              maxLength={2}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              type="text"
              autoComplete="address-level2"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="Cidade"
            />
          </Field>
          <Field label="Bairro">
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              type="text"
              autoComplete="address-level3"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="Bairro"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Rua">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              type="text"
              autoComplete="address-line1"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="Rua"
            />
          </Field>
          <Field label="Número">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="address-line2"
              className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
              placeholder="123"
            />
          </Field>
        </div>

        <Field label="Complemento (opcional)">
          <input
            value={addr2}
            onChange={(e) => setAddr2(e.target.value)}
            type="text"
            autoComplete="address-line3"
            className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
            placeholder="Apartamento, bloco, etc"
          />
        </Field>
	      </div>
    </div>
  </div>
)}
                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
                    placeholder="voce@exemplo.com"
                  />
                </Field>

                <Field label="Senha">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="container-cc w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60"
                    placeholder="••••••••"
                  />
                </Field>

                {mode === "signup" && (
                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-[#07161d] text-teal-400 focus:ring-teal-400"
                    />
                    <span className="leading-6">
                      Li e concordo com os{' '}
                      <a href="/terms.html" target="_blank" rel="noreferrer" className="font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4">Termos de uso</a>{' '}
                      e com a{' '}
                      <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-medium text-cyan-300 hover:text-cyan-200 underline underline-offset-4">Política de Privacidade</a>.
                    </span>
                  </label>
                )}

                {error && (
                  <p className="container-cc text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="container-cc text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-xl px-4 py-3">
                    {info}
                  </p>
                )}

                <button
                  disabled={busy}
                  className={`w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/10 transition ${
                    busy
                      ? "bg-[#12303b]/55 text-slate-300 cursor-not-allowed"
                      : "bg-emerald-400 hover:bg-emerald-300 text-black"
                  }`}
                >
                  {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
                </button>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="hover:text-slate-200 underline underline-offset-4"
                    disabled={busy}
                  >
                    Esqueci minha senha
                  </button>
                  <span className="text-right">
                    {mode === "signup" ? "Você pode precisar confirmar o e-mail antes de entrar." : null}
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
