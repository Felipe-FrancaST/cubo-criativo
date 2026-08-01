import React from 'react';
import Modal from '../components/Modal.jsx';
import { trackEvent } from '../lib/analytics.js';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/6 ring-1 ring-white/15 px-3 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function VipRpgPage({
  user,
  accessToken,
  onOpenAuth,
  onRequireLogin,
  onOpenSettings,
  onOpenVipArea,
  onGoHome,
}) {
  const [busy, setBusy] = React.useState(false);
  const [submittingMethod, setSubmittingMethod] = React.useState(''); // 'card' | 'pix'
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [pix, setPix] = React.useState(null);
  const [pendingStart, setPendingStart] = React.useState(null); // 'pix' | 'card'
  const [pixChecking, setPixChecking] = React.useState(false);
  const [pixStatus, setPixStatus] = React.useState('');
  const [vipProfile, setVipProfile] = React.useState(null);
  const [vipLoading, setVipLoading] = React.useState(false);
  const [vipChecked, setVipChecked] = React.useState(() => !accessToken);
  const [plans, setPlans] = React.useState([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [plansLoading, setPlansLoading] = React.useState(true);
  const [collectionItems, setCollectionItems] = React.useState([]);
  const [collectionLoading, setCollectionLoading] = React.useState(true);
  const [collectionPreviewIndex, setCollectionPreviewIndex] = React.useState(-1);


  const vipUntil = vipProfile?.vip_until || null;
  const isVip = Boolean(vipUntil && new Date(vipUntil) > new Date());

  // Cache local (reduz "flash" ao abrir /vip para quem já é VIP)
  const cachedVipUntil = React.useMemo(() => {
    try {
      return String(window?.localStorage?.getItem('vip_until_cache') || '');
    } catch {
      return '';
    }
  }, [accessToken]);

  const isVipCached = Boolean(
    accessToken &&
      cachedVipUntil &&
      (() => {
        const d = new Date(cachedVipUntil);
        return Number.isFinite(d.getTime()) && d > new Date();
      })()
  );

  // Se o usuário já é VIP, não mostramos página intermediária.
  // Ao acessar /vip, redirecionamos direto para /area-vip.
  React.useEffect(() => {
    // Se já temos cache válido, redireciona imediatamente.
    if (isVipCached) {
      onOpenVipArea?.();
      return;
    }
    if (vipLoading) return;
    if (!isVip) return;
    onOpenVipArea?.();
  }, [vipLoading, isVip, isVipCached, onOpenVipArea]);

  const visiblePlans = (Array.isArray(plans) ? plans : []).filter((p) => p?.id);
  const selectedPlan = visiblePlans.find((p) => p.id === selectedPlanId) || visiblePlans[0] || null;
  const selectedMiniaturesCount = Math.max(0, Number(selectedPlan?.miniatures_count || 0) || 0);
  const selectedBossCount = Math.max(0, Number(selectedPlan?.boss_count || 0) || 0);
  const selectedItemsPerMonth = Math.max(
    0,
    Number(selectedPlan?.items_per_month ?? (selectedMiniaturesCount + selectedBossCount)) || (selectedMiniaturesCount + selectedBossCount)
  );
  const selectedReceiveItems = React.useMemo(() => {
    if (!selectedPlan) return [];
    const items = [];

    if (selectedMiniaturesCount > 0) {
      items.push(`${pluralize(selectedMiniaturesCount, 'miniatura')} ${selectedMiniaturesCount > 1 ? 'mensais' : 'mensal'} em resina premium`);
    }

    if (selectedBossCount > 0) {
      items.push(`${pluralize(selectedBossCount, 'boss', 'bosses')} exclusivo${selectedBossCount > 1 ? 's' : ''} por mês`);
    }

    if (selectedItemsPerMonth > 0) {
      items.push(`Escolha de até ${pluralize(selectedItemsPerMonth, 'item')} por ciclo na Área VIP`);
    } else {
      items.push('Escolha na Área VIP');
    }

    items.push('Cubo Game e benefícios VIP');
    return items;
  }, [selectedPlan, selectedMiniaturesCount, selectedBossCount, selectedItemsPerMonth]);

  function pixStatusPtLabel(v) {
    const st = String(v || '').toLowerCase();
    if (!st || st === 'pending' || st === 'in_process') return 'Pendente';
    if (st === 'paid' || st === 'approved') return 'Pago';
    if (st === 'rejected' || st === 'failed' || st === 'cancelled') return 'Recusado';
    return st.replaceAll('_', ' ');
  }

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setPlansLoading(true);
        const res = await fetch('/api/vip-plans');
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        const arr = Array.isArray(data?.plans) ? data.plans : [];
        setPlans(arr);
        if (arr.length && (!selectedPlanId || !arr.find((p) => p.id === selectedPlanId))) setSelectedPlanId(arr[0]?.id || '');
      } catch {
        if (alive) setPlans([]);
      } finally {
        if (alive) setPlansLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCollectionLoading(true);
        const res = await fetch('/api/core?action=vip-cycle');
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setCollectionItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (alive) setCollectionItems([]);
      } finally {
        if (alive) setCollectionLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const activeCollectionItem = collectionPreviewIndex >= 0 ? collectionItems[collectionPreviewIndex] || null : null;

  const openCollectionPreview = React.useCallback((index) => {
    setCollectionPreviewIndex(index);
  }, []);

  const closeCollectionPreview = React.useCallback(() => {
    setCollectionPreviewIndex(-1);
  }, []);

  const moveCollectionPreview = React.useCallback((direction) => {
    setCollectionPreviewIndex((current) => {
      if (!collectionItems.length || current < 0) return -1;
      return (current + direction + collectionItems.length) % collectionItems.length;
    });
  }, [collectionItems.length]);

  React.useEffect(() => {
    if (!activeCollectionItem || collectionItems.length < 2) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveCollectionPreview(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveCollectionPreview(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCollectionItem, collectionItems.length, moveCollectionPreview]);

  React.useEffect(() => {
    let alive = true;
    async function loadVipProfile() {
      if (!accessToken) {
        if (alive) setVipProfile(null);
        if (alive) setVipChecked(true);
        return;
      }
      try {
        setVipLoading(true);
        setVipChecked(false);
        const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setVipProfile(data?.profile || null);

        // Atualiza cache local
        try {
          const until = data?.profile?.vip_until ? String(data.profile.vip_until) : '';
          if (until && new Date(until) > new Date()) window.localStorage.setItem('vip_until_cache', until);
          else window.localStorage.removeItem('vip_until_cache');
        } catch {}
      } catch {
        if (alive) setVipProfile(null);
      } finally {
        if (alive) setVipLoading(false);
        if (alive) setVipChecked(true);
      }
    }
    loadVipProfile();
    return () => {
      alive = false;
    };
  }, [accessToken, ok]);

  // IMPORTANTE: estes effects precisam ficar antes de qualquer "return" condicional
  // para evitar erro do React (hooks em ordem diferente entre renders).
  React.useEffect(() => {
    const onSaved = async () => {
      if (!pendingStart) return;
      const method = pendingStart;
      setPendingStart(null);
      if (method === 'pix') startPix(selectedPlanId);
      else startCard(selectedPlanId);
    };
    window.addEventListener('profile:saved', onSaved);
    return () => window.removeEventListener('profile:saved', onSaved);
  }, [pendingStart, selectedPlanId]);

  React.useEffect(() => {
    if (!pix?.order_id || !accessToken) return;
    let stopped = false;
    const t = setInterval(async () => {
      if (stopped) return;
      const done = await verifyVipPix(pix.order_id);
      if (done) {
        stopped = true;
        clearInterval(t);
      }
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [pix?.order_id, accessToken]);

  // Evita "flash" dos planos ao entrar em /planos-vip e já ser VIP.
  // Mostra um estado neutro até confirmar (ou redirecionar).
  if (accessToken && (isVipCached || !vipChecked || vipLoading || isVip)) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="container-cc rounded-2xl p-6 ring-1 ring-white/10 bg-white/4 text-center">
          <div className="text-sm text-slate-200 font-semibold">Abrindo Área VIP…</div>
          <div className="mt-1 text-xs text-slate-400">Verificando sua assinatura</div>
        </div>
      </main>
    );
  }

  // Enquanto carrega os planos do Supabase, mostramos um estado neutro
  // (evita tela "indisponível" antes do fetch terminar).
  if (plansLoading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="container-cc rounded-2xl p-6 ring-1 ring-white/10 bg-white/4 text-center">
          <div className="text-sm text-slate-200 font-semibold">Carregando planos VIP…</div>
          <div className="mt-1 text-xs text-slate-400">Aguarde um instante</div>
        </div>
      </main>
    );
  }

  // Se não há planos no Supabase, mostramos um estado claro (sem valores fixos).
  if (!visiblePlans.length) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="container-cc rounded-2xl p-6 ring-1 ring-white/10 bg-white/4 text-center">
          <div className="text-sm text-slate-200 font-semibold">Planos VIP indisponíveis</div>
          <div className="mt-1 text-xs text-slate-400">
            Nenhum plano ativo encontrado. Verifique a tabela <b>vip_plans</b> no Supabase.
          </div>
          <button
            className="mt-4 rounded-xl px-4 py-2 bg-white/6 hover:bg-white/8 text-slate-100"
            onClick={() => onGoHome?.()}
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  async function ensureProfileComplete() {
    const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    const p = data?.profile || {};
    const hasCpf = String(p.cpf || '').trim().length >= 11;
    const hasAddr =
      String(p.address_line1 || '').trim() &&
      String(p.address_number || '').trim() &&
      String(p.city || '').trim() &&
      String(p.state || '').trim() &&
      String(p.zip || '').trim();
    const hasBirth = String(p.birthdate || '').trim();
    return Boolean(hasCpf && hasAddr && hasBirth);
  }

  async function verifyVipPix(orderId) {
    if (!orderId) return false;
    try {
      setPixChecking(true);
      const res = await fetch('/api/pix-payment?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Não foi possível verificar o pagamento Pix.');
      const st = String(data?.status || data?.mp_status || '').toLowerCase();
      setPixStatus(st);
      if (st === 'paid' || st === 'approved') {
        setOk('Pagamento confirmado! Seu VIP será ativado em instantes.');
        setError('');
        trackEvent('vip_pix_paid_confirmed', { plan_id: selectedPlanId });
        return true;
      }
      if (st === 'failed' || st === 'rejected') {
        setError('Pagamento Pix não foi aprovado. Tente novamente.');
      }
      return false;
    } catch (e) {
      setError(String(e?.message || e));
      return false;
    } finally {
      setPixChecking(false);
    }
  }

  async function handleVipPixPaidClick() {
    if (!pix?.order_id) return;
    await verifyVipPix(pix.order_id);
  }

  async function startPix(planId) {
    setSubmittingMethod('pix');
    setError('');
    setOk('');
    setPix(null);
    if (!accessToken) {
      setSubmittingMethod('');
      onRequireLogin?.('Faça login para assinar');
      return;
    }
    if (!(await ensureProfileComplete())) {
      setSubmittingMethod('');
      setPendingStart('pix');
      onOpenSettings?.('profile', { autoClose: true });
      setError('Complete seus dados no perfil (CPF e endereço) para assinar.');
      return;
    }
    try {
      setBusy(true);
      const res = await fetch('/api/create-pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ vip_plan_id: planId, description: `Assinatura ${planId}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          setSubmittingMethod('');
          setPendingStart('pix');
          onOpenSettings?.('profile', { autoClose: true });
          setError('Complete seus dados no perfil (CPF e endereço) para assinar.');
          return;
        }
        throw new Error(data?.error || 'Não foi possível gerar o Pix.');
      }
      setPix({
        order_id: data?.order_id || '',
        payment_id: data?.id || '',
        qr_code: data?.qr_code || '',
        qr_code_base64: data?.qr_code_base64 || '',
        ticket_url: data?.ticket_url || '',
      });
      setPixStatus(String(data?.status || '').toLowerCase());
      setOk('Pix gerado! Escaneie o QR Code ou copie o código. A confirmação é automática.');
      trackEvent('vip_pix_created', { plan_id: planId });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
      setSubmittingMethod('');
    }
  }

  async function startCard(planId) {
    setSubmittingMethod('card');
    setError('');
    setOk('');
    if (!accessToken) {
      setSubmittingMethod('');
      onRequireLogin?.('Faça login para assinar');
      return;
    }
    if (!(await ensureProfileComplete())) {
      setSubmittingMethod('');
      setPendingStart('card');
      onOpenSettings?.('profile', { autoClose: true });
      setError('Complete seus dados no perfil (CPF e endereço) para assinar.');
      return;
    }
    try {
      setBusy(true);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ vip_plan_id: planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          setSubmittingMethod('');
          setPendingStart('card');
          onOpenSettings?.('profile', { autoClose: true });
          setError('Complete seus dados no perfil (CPF e endereço) para assinar.');
          return;
        }
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento.');
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setOk('Checkout criado.');
      trackEvent('vip_card_checkout_created', { plan_id: planId });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
      setSubmittingMethod('');
    }
  }

  return (
    <>
      <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 bg-gradient-to-br from-slate-900/60 via-slate-950/50 to-black/60 backdrop-blur p-6 sm:p-10">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 10%, rgba(56,189,248,0.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(167,139,250,0.30), transparent 45%), radial-gradient(circle at 50% 90%, rgba(34,197,94,0.18), transparent 55%)',
            }}
          />

          <div className="relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Assinatura VIP</Badge>
                  <Badge>RPG • Resina Premium</Badge>
                  <Badge>32mm</Badge>
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Planos VIP — RPG</h1>
                <p className="mt-3 text-slate-300 max-w-2xl">
                  Assine e escolha suas miniaturas do mês na Área VIP. Pagamento via cartão ou Pix.
                </p>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-slate-400 text-sm">Plano selecionado</div>
                <div className="text-2xl font-extrabold">{selectedPlan?.name || '—'}</div>
                <div className="text-slate-300 text-sm mt-1">{selectedPlan ? fmtBRL(selectedPlan.price_brl) : ''}</div>
              </div>
            </div>

            
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">Coleção Atual</h2>
                <span className="text-xs text-slate-400">Prévia das miniaturas disponíveis neste ciclo</span>
              </div>

              {collectionLoading ? (
                <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-300">Carregando coleção...</div>
              ) : collectionItems.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {collectionItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openCollectionPreview(index)}
                      className="group relative overflow-hidden rounded-2xl bg-white/4 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/6 hover:ring-cyan-300/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      aria-label={`Ampliar ${item.title || 'miniatura'}`}
                    >
                      <div className="relative aspect-square bg-black/20 overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.title || 'Miniatura'}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.04]"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition" />
                        <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/20 backdrop-blur">
                          <span className="material-icons text-[18px]">zoom_in</span>
                        </span>
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs sm:text-sm font-semibold line-clamp-2">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[11px] text-cyan-200/80">Toque para ampliar</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

              <div className="sm:hidden mt-4 text-center">
                <div className="text-slate-400 text-sm">Plano selecionado</div>
                <div className="text-xl font-extrabold">{selectedPlan?.name || '—'}</div>
                <div className="text-slate-300 text-sm mt-1">{selectedPlan ? fmtBRL(selectedPlan.price_brl) : ''}</div>
              </div>

{vipLoading ? (
              <div className="mt-8 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-slate-200">Carregando…</div>
            ) : isVip ? (
              <div className="mt-8 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-slate-200">
                Abrindo Área VIP…
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <p className="text-sm font-extrabold">O que você recebe</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">
                    {selectedReceiveItems.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-emerald-300">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <p className="text-sm font-extrabold">Planos</p>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {visiblePlans.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => setSelectedPlanId(pl.id)}
                        className={`text-left rounded-xl p-3 ring-1 ${
                          selectedPlanId === pl.id ? 'ring-cyan-300 bg-cyan-400/10' : 'ring-white/10 bg-white/4 hover:bg-white/6'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold">{pl.name || pl.title || pl.id}</div>
                            <div className="text-xs text-slate-300">
                              {Number(pl.miniatures_count || 0)} miniaturas
                              {Number(pl.boss_count || 0) ? ` + ${Number(pl.boss_count)} boss` : ''}
                            </div>
                          </div>
                          <div className="font-extrabold">{fmtBRL(pl.price_brl)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <p className="text-sm font-extrabold">Assinar agora</p>

                  {error ? (
                    <div className="mt-3 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 p-3 text-sm text-rose-100">{error}</div>
                  ) : null}
                  {ok ? (
                    <div className="mt-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3 text-sm text-emerald-100">{ok}</div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => startCard(selectedPlanId)}
                      className="container-cc rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20 disabled:opacity-60"
                    >
                      {submittingMethod === 'card' ? 'Aguarde' : 'Assinar com cartão'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => startPix(selectedPlanId)}
                      className="container-cc rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/4 disabled:opacity-60"
                    >
                      {submittingMethod === 'pix' ? 'Aguarde' : 'Assinar com Pix'}
                    </button>
                  </div>

                  {pix ? (
                    <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold">Pix do VIP</p>
                          <p className="mt-1 text-xs text-slate-400">Escaneie o QR Code ou copie o código abaixo.</p>
                        </div>
                        {pix.ticket_url ? (
                          <a
                            href={pix.ticket_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/4"
                          >
                            Abrir no Mercado Pago
                          </a>
                        ) : null}
                      </div>

                      {pix.qr_code_base64 ? (
                        <div className="mt-3 rounded-xl bg-white p-3 inline-flex">
                          <img alt="QR Code Pix" className="h-44 w-44" src={`data:image/png;base64,${pix.qr_code_base64}`} />
                        </div>
                      ) : null}

                      {pix.qr_code ? (
                        <div className="mt-3">
                          <div className="flex gap-2">
                            <input
                              readOnly
                              value={pix.qr_code}
                              className="w-full rounded-xl bg-[#07161d] ring-1 ring-white/10 px-3 py-2 text-xs text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(String(pix.qr_code || ''))}
                              className="rounded-xl px-3 py-2 text-xs font-semibold bg-emerald-400/15 ring-1 ring-emerald-300/30 hover:bg-emerald-400/20"
                            >
                              Copiar
                            </button>
                          </div>

                          <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                            <div className="text-xs text-slate-300">
                              Status do Pix: <b className="uppercase">{pixStatusPtLabel(pixStatus || 'pending')}</b>
                            </div>
                            <button
                              type="button"
                              onClick={handleVipPixPaidClick}
                              disabled={pixChecking}
                              className={`rounded-xl px-3 py-2 text-xs font-extrabold ring-1 disabled:opacity-60 ${
                                ['paid', 'approved'].includes(String(pixStatus || '').toLowerCase())
                                  ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-300/30'
                                  : 'bg-white/6 ring-white/15 hover:bg-white/8'
                              }`}
                            >
                              {pixChecking
                                ? 'Verificando...'
                                : ['paid', 'approved'].includes(String(pixStatus || '').toLowerCase())
                                ? 'Pago ✓'
                                : 'Já paguei'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-2">
              <button onClick={onGoHome} className="container-cc rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4">Voltar</button>
              {!user ? (
                <button onClick={onOpenAuth} className="container-cc rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/4">Entrar para assinar</button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      </main>

      <Modal
        open={Boolean(activeCollectionItem)}
        onClose={closeCollectionPreview}
        title={activeCollectionItem?.title || 'Miniatura da coleção'}
        ariaLabel="Visualização ampliada da miniatura"
        widthClass="w-[96vw] sm:w-[92vw]"
        maxWidth="max-w-5xl"
        bodyClassName="p-2 sm:p-4"
        panelClassName="bg-[#030b10]"
        zIndexClass="z-[220]"
      >
        {activeCollectionItem ? (
          <div className="relative">
            <div className="flex min-h-[55vh] max-h-[76vh] items-center justify-center overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
              <img
                src={activeCollectionItem.image_url}
                alt={activeCollectionItem.title || 'Miniatura da coleção atual'}
                className="max-h-[76vh] w-full object-contain"
              />
            </div>

            {collectionItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => moveCollectionPreview(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:left-4"
                  aria-label="Imagem anterior"
                >
                  <span className="material-icons">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveCollectionPreview(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:right-4"
                  aria-label="Próxima imagem"
                >
                  <span className="material-icons">chevron_right</span>
                </button>
              </>
            ) : null}

            <div className="mt-3 flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-100">{activeCollectionItem.title || 'Miniatura'}</div>
              <div className="text-xs text-slate-400">
                {collectionPreviewIndex + 1} de {collectionItems.length}
                {collectionItems.length > 1 ? ' • use as setas para navegar' : ''}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
