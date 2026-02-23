import React from 'react';
import { trackEvent } from '../lib/analytics.js';

const ICONS = ['🐉','🧙','⚔️','🛡️','🧪','💎'];
const MAX_ERRORS = 7;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildDeck() { return shuffle([...ICONS, ...ICONS]).map((icon, i) => ({ id: `${icon}-${i}`, icon, matched: false })); }
function calcScore({ errors, won }) {
  if (!won) return Math.max(0, 1000 - errors * 250);
  if (errors === 0) return 1000;
  return Math.max(100, 1000 - errors * 200);
}
function nextWeeklyResetUTC(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return next;
}

function nextDailyResetUTC(now = new Date()) {
  const d = new Date(now);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export default function CupomGamePage({ onGoHome, accessToken }) {
  const [status, setStatus] = React.useState({ loading: true, can_play: false, weekly_reward: null, coupon: null, played: false });
  const [deck, setDeck] = React.useState(() => buildDeck());
  const [flipped, setFlipped] = React.useState([]);
  const [busy] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const [startAt, setStartAt] = React.useState(null);
  const [finished, setFinished] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState('');
  const [copyCouponMsg, setCopyCouponMsg] = React.useState('');
  const [nowMs, setNowMs] = React.useState(Date.now());

  async function loadStatus() {
    if (!accessToken) {
      setStatus({ loading: false, can_play: false, weekly_reward: null, coupon: null, played: false, error: 'Faça login para jogar e receber cupom.' });
      return;
    }
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch('/api/coupons?action=game-status', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar jogo');
      setStatus({ loading: false, ...data });
      if (data?.session?.won) setResultMsg('Você já venceu neste período ✅');
    } catch (e) {
      setStatus({ loading: false, can_play: false, weekly_reward: null, coupon: null, played: false, error: String(e?.message || e) });
    }
  }

  React.useEffect(() => { loadStatus(); }, [accessToken]);
  React.useEffect(() => { const t = window.setInterval(() => setNowMs(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const isVip = Boolean(status?.vip?.isVip);
  const nextReset = isVip ? nextDailyResetUTC(new Date(nowMs)) : nextWeeklyResetUTC(new Date(nowMs));
  const countdown = formatCountdown(nextReset.getTime() - nowMs);

  React.useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    if (deck[a]?.icon === deck[b]?.icon) {
      setDeck((prev) => prev.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true } : c)));
      setFlipped([]);
      return;
    }
    const t = setTimeout(() => {
      setFlipped([]);
      setErrors((prev) => {
        const next = prev + 1;
        if (next >= MAX_ERRORS && !finished) {
          setFinished(true);
          const duration_ms = startAt ? (Date.now() - startAt) : 0;
          const score = calcScore({ errors: next, won: false });
          completeGame({ won: false, score, attempts, duration_ms, errors: next });
          setResultMsg(`Fim de jogo: você atingiu ${MAX_ERRORS} erros.`);
        }
        return next;
      });
    }, 650);
    return () => clearTimeout(t);
  }, [flipped, deck, attempts, startAt, finished]);

  React.useEffect(() => {
    if (!startAt || finished) return;
    const allMatched = deck.length > 0 && deck.every((c) => c.matched);
    if (!allMatched) return;
    setFinished(true);
    const duration_ms = Date.now() - startAt;
    const score = calcScore({ errors, won: true });
    completeGame({ won: true, score, attempts, duration_ms, errors });
  }, [deck, attempts, errors, startAt, finished]);

  async function completeGame(payload) {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/coupons?action=game-complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar resultado');
      if (data?.coupon?.code) {
        const extra = data?.coupon?.label?.includes('20%') ? ' 🎉 Cupom especial perfeito!' : '';
        setResultMsg(`Parabéns! Seu cupom: ${data.coupon.code}${extra}`);
        trackEvent('memory_game_win', { coupon_code: data.coupon.code, attempts: payload.attempts, errors: payload.errors });
      } else if (data?.already_played) setResultMsg('Você já jogou neste período.');
      else setResultMsg(payload?.won ? `Vitória registrada. Volte ${isVip ? 'amanhã' : 'na próxima semana'}!` : `Partida registrada. Volte ${isVip ? 'amanhã' : 'na próxima semana'}!`);
      await loadStatus();
    } catch (e) {
      setResultMsg(String(e?.message || e));
    }
  }

  function onCardClick(idx) {
    if (!status.can_play || busy || finished) return;
    const card = deck[idx];
    if (!card || card.matched) return;
    if (flipped.includes(idx) || flipped.length >= 2) return;
    if (!startAt) setStartAt(Date.now());
    setFlipped((prev) => [...prev, idx]);
    if (flipped.length === 1) setAttempts((n) => n + 1);
  }

  const reveal = (idx) => flipped.includes(idx) || deck[idx]?.matched;

  async function copyCouponCode(code) {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(String(code));
      setCopyCouponMsg('Cupom copiado!');
    } catch {
      setCopyCouponMsg('Não foi possível copiar automaticamente.');
    } finally {
      window.clearTimeout(copyCouponCode._t);
      copyCouponCode._t = window.setTimeout(() => setCopyCouponMsg(''), 2200);
    }
  }

  return (
    <main className="flex-1">
      <section className="mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8" style={{ maxWidth: 'var(--container-max, 1200px)' }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Cubo Game</h1>
            <p className="text-sm text-slate-400 mt-1">Jogo da memória com cupom geek 🎴</p>
          </div>
          <button onClick={onGoHome} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5">Voltar</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <aside className="order-1 lg:order-2 space-y-4">
            <div className="rounded-2xl p-4 ring-1 ring-emerald-400/20 bg-emerald-500/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-200/80">Cupom da semana</p>
                  <p className="mt-1 font-extrabold text-lg text-emerald-100">{status.weekly_reward?.label || 'Carregando...'}</p>
                  <p className="mt-2 text-sm text-emerald-100/90">Partida perfeita (0 erros) libera cupom especial de 20% OFF.</p>
                </div>
                <span className="material-icons text-emerald-200">workspace_premium</span>
              </div>
              {status.coupon?.code ? (
                <div className="mt-3 rounded-xl px-3 py-2 bg-black/20 ring-1 ring-emerald-300/20 text-sm text-emerald-100">
                  <div className="flex items-center justify-between gap-2">
                    <span>Seu cupom gerado: <b>{status.coupon.code}</b></span>
                    <button
                      type="button"
                      onClick={() => copyCouponCode(status.coupon.code)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-emerald-400/15 ring-1 ring-emerald-300/30 hover:bg-emerald-400/20"
                    >
                      Copiar
                    </button>
                  </div>
                  {copyCouponMsg ? <p className="mt-2 text-xs text-emerald-200/90">{copyCouponMsg}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
              <h2 className="font-semibold text-slate-100">Como funciona</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>• Vire 2 cartas por vez e encontre os pares.</li>
                <li>• Você pode errar no máximo <b>{MAX_ERRORS} vezes</b>.</li>
                <li>• {isVip ? 'VIP: 1 partida por dia.' : '1 partida por semana por conta.'}</li>
                {isVip ? (<li className="text-emerald-200">• Agora você é VIP poderá jogar todo dia.</li>) : null}
                <li>• O cupom gerado aparece aqui em cima e pode ser usado no carrinho.</li>
              </ul>
            </div>

            <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2">
                  <p className="text-xs text-slate-400">Tentativas</p>
                  <p className="font-bold text-lg">{attempts}</p>
                </div>
                <div className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2">
                  <p className="text-xs text-slate-400">Erros</p>
                  <p className="font-bold text-lg">{errors}/{MAX_ERRORS}</p>
                </div>
              </div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Status</span><span className="text-right">{status.loading ? 'Carregando…' : status.can_play ? 'Pode jogar' : (isVip ? 'Já jogou hoje' : 'Já jogou esta semana')}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Próxima rodada</span><span className="text-right font-medium">{countdown}</span></div>
              {resultMsg ? <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-slate-100">{resultMsg}</div> : null}
              {status.error ? <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/20 px-3 py-2 text-rose-200">{status.error}</div> : null}
            </div>
          </aside>

          <div className="order-2 lg:order-1 rounded-2xl p-3 sm:p-5 ring-1 ring-white/10 bg-slate-900/50">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
              {deck.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => onCardClick(idx)}
                  disabled={!status.can_play || busy || finished || card.matched}
                  className={`aspect-square rounded-xl sm:rounded-2xl text-2xl sm:text-3xl grid place-items-center ring-1 transition active:scale-[0.98] ${reveal(idx) ? 'bg-white/10 ring-white/20' : 'bg-gradient-to-br from-fuchsia-500/15 to-teal-500/15 ring-white/10 hover:bg-white/10'}`}
                  aria-label={reveal(idx) ? `Carta ${card.icon}` : 'Carta fechada'}
                >
                  <span>{reveal(idx) ? card.icon : '❓'}</span>
                </button>
              ))}
            </div>
            {!status.can_play && !status.loading ? (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button onClick={loadStatus} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5">Atualizar status</button>
                <button onClick={() => { setDeck(buildDeck()); setFlipped([]); setAttempts(0); setErrors(0); setStartAt(null); setFinished(false); setResultMsg(''); }} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5">Treinar tabuleiro</button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
