import React from 'react';
import { trackEvent } from '../lib/analytics.js';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

export default function VipRpgPage({ user, accessToken, onOpenAuth, onOpenSettings, onGoHome }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');

  async function startPix() {
    setError('');
    setOk('');
    if (!accessToken) {
      onOpenAuth?.();
      return;
    }
    try {
      setBusy(true);
      const res = await fetch('/api/create-pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ vip_plan_id: 'CUBO_L1_RPG', description: 'Assinatura Cubo Level 1 RPG' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          onOpenSettings?.('profile');
          setError('Complete seus dados no perfil para assinar (CPF e endereço).');
          return;
        }
        throw new Error(data?.error || 'Não foi possível gerar o Pix.');
      }
      // abre o link do MP se vier, senão mostra QR
      if (data?.ticket_url) {
        window.location.href = data.ticket_url;
        return;
      }
      setOk('Pix gerado! Abra o checkout para concluir.');
      trackEvent('vip_pix_created', { plan_id: 'CUBO_L1_RPG' });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function startCard() {
    setError('');
    setOk('');
    if (!accessToken) {
      onOpenAuth?.();
      return;
    }
    try {
      setBusy(true);
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ vip_plan_id: 'CUBO_L1_RPG' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          onOpenSettings?.('profile');
          setError('Complete seus dados no perfil para assinar (CPF e endereço).');
          return;
        }
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento.');
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setOk('Checkout criado.');
      trackEvent('vip_card_checkout_created', { plan_id: 'CUBO_L1_RPG' });
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

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    disabled={busy}
                    onClick={startCard}
                    className="rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20 disabled:opacity-60"
                  >
                    Assinar com cartão
                  </button>
                  <button
                    disabled={busy}
                    onClick={startPix}
                    className="rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-60"
                  >
                    Assinar com Pix
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Após o pagamento, seu perfil será marcado como VIP e você poderá escolher as 3 miniaturas do mês.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <button onClick={onGoHome} className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Voltar</button>
              {user ? (
                <button onClick={() => onOpenSettings?.('profile')} className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5">Abrir Área VIP</button>
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
