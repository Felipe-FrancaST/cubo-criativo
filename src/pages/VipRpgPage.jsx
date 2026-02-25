import React from 'react';
import { trackEvent } from '../lib/analytics.js';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

export default function VipRpgPage({ user, accessToken, onOpenAuth, onOpenSettings, onOpenVipArea, onGoHome }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [pix, setPix] = React.useState(null);
  const [pendingStart, setPendingStart] = React.useState(null); // 'pix' | 'card'
  const [pixChecking, setPixChecking] = React.useState(false);
  const [pixStatus, setPixStatus] = React.useState('');
  const [vipProfile, setVipProfile] = React.useState(null);
  const [vipLoading, setVipLoading] = React.useState(false);
  const [plans, setPlans] = React.useState([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState('CUBO_L1_RPG');

  const vipUntil = vipProfile?.vip_until || null;
  const isVip = Boolean(vipUntil && new Date(vipUntil) > new Date());

  function pixStatusPtLabel(v) {
    const st = String(v || '').toLowerCase();
    if (!st || st === 'pending' || st === 'in_process') return 'Pendente';
    if (st === 'paid' || st === 'approved') return 'Pago';
    if (st === 'rejected' || st === 'failed' || st === 'cancelled') return 'Recusado';
    return st.replaceAll('_', ' ');
  }


  React.useEffect(() => {
    let alive = true;
    async function loadVipProfile() {
      if (!accessToken) { if (alive) setVipProfile(null); return; }
      try {
        setVipLoading(true);
        const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setVipProfile(data?.profile || null);
      } catch {
        if (alive) setVipProfile(null);
      } finally {
        if (alive) setVipLoading(false);
      }
    }
    loadVipProfile();
    return () => { alive = false; };
  }, [accessToken, ok]);

  async function ensureProfileComplete() {
    const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    const p = data?.profile || {};
    const hasCpf = String(p.cpf || '').trim().length >= 11;
    const hasAddr = String(p.address_line1 || '').trim() && String(p.address_number || '').trim() && String(p.city || '').trim() && String(p.state || '').trim() && String(p.zip || '').trim();
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
        trackEvent('vip_pix_paid_confirmed', { plan_id: 'CUBO_L1_RPG' });
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
  React.useEffect(() => {
    const onSaved = async () => {
      if (!pendingStart) return;
      const method = pendingStart;
      setPendingStart(null);
      if (method === 'pix') startPix();
      else startCard();
    };
    window.addEventListener('profile:saved', onSaved);
    return () => window.removeEventListener('profile:saved', onSaved);
  }, [pendingStart]);



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
    return () => { stopped = true; clearInterval(t); };
  }, [pix?.order_id, accessToken]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/vip-plans');
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setPlans(Array.isArray(data?.plans) ? data.plans : []);
      } catch { if (alive) setPlans([]); }
    })();
    return () => { alive = false; };
  }, []);

  async function startPix(planId = "CUBO_L1_RPG") {
    setError('');
    setOk('');
    setPix(null);
    if (!accessToken) {
      onOpenAuth?.();
      return;
    }
    if (!(await ensureProfileComplete())) {
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
      trackEvent('vip_pix_created', { plan_id: 'CUBO_L1_RPG' });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function startCard(planId = "CUBO_L1_RPG") {
    setError('');
    setOk('');
    if (!accessToken) {
      onOpenAuth?.();
      return;
    }
    if (!(await ensureProfileComplete())) {
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
    }
  }

  return (
    <main className="flex-1">
      <section className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" style={{ maxWidth: 'var(--container-max, 980px)' }}>
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 bg-gradient-to-br from-slate-900/60 via-slate-950/50 to-black/60 backdrop-blur p-6 sm:p-10">
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(56,189,248,0.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(167,139,250,0.30), transparent 45%), radial-gradient(circle at 50% 90%, rgba(34,197,94,0.18), transparent 55%)' }} />

          <div className="relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Assinatura VIP</Badge>
                  <Badge>RPG • Resina Premium</Badge>
                  <Badge>32mm</Badge>
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Cubo Level 1 — RPG</h1>
                <p className="mt-3 text-slate-300 max-w-2xl">
                  O plano para quem joga de verdade: miniaturas mensais, escolha do trio do mês e acesso diário ao Cubo Game.
                </p>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-sm">Mensal</div>
                <div className="text-4xl font-black">R$ 40<span className="text-lg font-bold text-slate-300">,00</span></div>
                <div className="text-xs text-slate-400 mt-1">VIP válido por 30 dias após confirmação do pagamento</div>
              </div>
            </div>

            {isVip ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/25 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>👑 VIP ativo</Badge>
                    {vipUntil ? <Badge>Válido até {new Date(vipUntil).toLocaleDateString('pt-BR')}</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-100">Você já é VIP</h2>
                  <p className="mt-2 text-sm sm:text-base text-emerald-50/80">Seu plano Cubo Level 1 — RPG está ativo. Acesse a Área VIP para escolher suas miniaturas do mês e acompanhar o status da produção/envio.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                    <p className="text-sm font-extrabold">Benefícios ativos</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-200">
                      <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span><b>3 miniaturas 32mm</b> em resina premium por ciclo</span></li>
                      <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span><b>Escolha 3 de 6</b> opções na Área VIP</span></li>
                      <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span><b>Cubo Game diário</b> enquanto o VIP estiver ativo</span></li>
                      <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span>Acompanhamento de status do mês na Área VIP</span></li>
                    </ul>
                  </div>
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                    <p className="text-sm font-extrabold">Próximos passos</p>
                    <p className="mt-2 text-sm text-slate-300">Abra sua Área VIP para selecionar suas miniaturas deste mês. Se sua assinatura estiver perto de vencer, você pode renovar antecipadamente.</p>
                    <div className="mt-4 space-y-3">
                      <button onClick={() => onOpenVipArea?.()} className="w-full rounded-xl px-4 py-3 font-extrabold bg-violet-400 text-black ring-4 ring-violet-400/20 hover:bg-violet-300">Acessar Área VIP</button>
                      <button
                        type="button"
                        onClick={() => { setError(''); setOk('Renovação antecipada em breve. Se quiser, posso liberar esta opção agora.'); }}
                        className="w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/5"
                      >
                        Renovar antecipadamente (em breve)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-sm font-extrabold">O que você recebe</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span><b>3 miniaturas</b> por mês (32mm) — bem detalhadas</span></li>
                  <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span><b>Resina premium</b> + acabamento cuidadoso</span></li>
                  <li className="flex gap-2"><span className="text-emerald-300">✓</span> <span>Você <b>escolhe 3</b> entre 6 opções do mês (na Área VIP)</span></li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-sm font-extrabold">Benefícios VIP</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li className="flex gap-2"><span className="text-violet-300">★</span> <span><b>Cubo Game todo dia</b> (em vez de 1x por semana)</span></li>
                  <li className="flex gap-2"><span className="text-violet-300">★</span> <span>Acesso à <b>Área VIP</b> no perfil</span></li>
                  <li className="flex gap-2"><span className="text-violet-300">★</span> <span>Mais chances de cupons e bônus (quando estiverem ativos)</span></li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-sm font-extrabold">Assinar agora</p>
                <p className="mt-2 text-sm text-slate-300">
                  Você precisa estar logado e com CPF/endereço preenchidos para garantir o envio.
                </p>

                {error ? (
                  <div className="mt-3 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 p-3 text-sm text-rose-100">{error}</div>
                ) : null}
                {ok ? (
                  <div className="mt-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3 text-sm text-emerald-100">{ok}</div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    {(plans.length ? plans : [{ id: 'CUBO_L1_RPG', name: 'Cubo Level 1 — RPG', price_brl: 40, miniatures_count: 3, boss_count: 0 }, { id: 'CUBO_L2_RPG', name: 'Cubo Level 2 — RPG', price_brl: 69.9, miniatures_count: 4, boss_count: 1 }]).map((pl) => (
                      <button key={pl.id} type="button" onClick={() => setSelectedPlanId(pl.id)} className={`text-left rounded-xl p-3 ring-1 ${selectedPlanId===pl.id ? 'ring-teal-300 bg-teal-400/10' : 'ring-white/10 bg-white/5 hover:bg-white/10'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold">{pl.name || pl.id}</div>
                            <div className="text-xs text-slate-300">{Number(pl.miniatures_count||0)} miniaturas{Number(pl.boss_count||0)?` + ${Number(pl.boss_count)} boss`:''}</div>
                          </div>
                          <div className="font-extrabold">R$ {Number(pl.price_brl||0).toFixed(2).replace('.', ',')}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                  <button
                    disabled={busy}
                    onClick={() => startCard(selectedPlanId)}
                    className="rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20 disabled:opacity-60"
                  >
                    Assinar com cartão
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => startPix(selectedPlanId)}
                    className="rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-60"
                  >
                    Assinar com Pix
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
                          className="rounded-xl px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/5"
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
                            className="w-full rounded-xl bg-slate-900 ring-1 ring-white/10 px-3 py-2 text-xs text-slate-200"
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
                            className={`rounded-xl px-3 py-2 text-xs font-extrabold ring-1 disabled:opacity-60 ${['paid','approved'].includes(String(pixStatus||'').toLowerCase()) ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-300/30' : 'bg-white/10 ring-white/15 hover:bg-white/15'}` }
                          >
                            {pixChecking ? 'Verificando...' : (['paid','approved'].includes(String(pixStatus||'').toLowerCase()) ? 'Pago ✓' : 'Já paguei')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 text-xs text-slate-400">
                  Após o pagamento, seu perfil será marcado como VIP e você poderá escolher as 3 miniaturas do mês.
                </div>

              </div>
            </div>

            )}

            <div className="mt-8 flex flex-wrap gap-2">
              <button onClick={onGoHome} className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Voltar</button>
              {user ? (
                <button onClick={() => onOpenVipArea?.()} className="rounded-xl px-4 py-2 text-sm ring-1 ring-violet-400/25 bg-violet-500/10 hover:bg-violet-500/15">Abrir Área VIP</button>
              ) : (
                <button onClick={onOpenAuth} className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Entrar para assinar</button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
