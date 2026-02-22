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

function buildDeck() {
  return shuffle([...ICONS, ...ICONS]).map((icon, i) => ({ id: `${icon}-${i}`, icon, matched: false }));
}

function calcScore({ errors, won }) {
  if (!won) return Math.max(0, 1000 - errors * 250);
  if (errors === 0) return 1000;
  return Math.max(100, 1000 - errors * 200);
}


function nextWeeklyResetUTC(now = new Date()) {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0=Sun,1=Mon
  const daysUntilMonday = (8 - day) % 7 || 7;
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
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

export default function CupomGamePage({ onGoHome, user, accessToken }) {
  const [status, setStatus] = React.useState({ loading: true, can_play: false, weekly_reward: null, coupon: null, played: false });
  const [deck, setDeck] = React.useState(() => buildDeck());
  const [flipped, setFlipped] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const [startAt, setStartAt] = React.useState(null);
  const [finished, setFinished] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState('');
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
      if (data?.session?.won) setResultMsg('Você já venceu nesta semana ✅');
    } catch (e) {
      setStatus({ loading: false, can_play: false, weekly_reward: null, coupon: null, played: false, error: String(e?.message || e) });
    }
  }

  React.useEffect(() => { loadStatus(); }, [accessToken]);

  React.useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);


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
    }, 700);
    return () => clearTimeout(t);
  }, [flipped, deck, attempts, startAt, finished]);

  React.useEffect(() => {
    if (!startAt) return;
    if (finished) return;
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar resultado');
      if (data?.coupon?.code) {
        try { window.localStorage.setItem('cc_coupon_last', data.coupon.code); } catch {}
        const extra = data?.coupon?.label?.includes('20%') ? ' 🎉 Cupom especial perfeito!' : '';
        setResultMsg(`Parabéns! Seu cupom: ${data.coupon.code}${extra}`);
        trackEvent('memory_game_win', { coupon_code: data.coupon.code, attempts: payload.attempts, errors: payload.errors, score: payload.score });
      } else if (data?.already_played) {
        setResultMsg('Você já jogou nesta semana.');
      } else {
        setResultMsg(payload?.won ? 'Vitória registrada. Volte na próxima semana!' : 'Partida registrada. Volte na próxima semana!');
      }
      await loadStatus();
    } catch (e) {
      setResultMsg(String(e?.message || e));
    }
  }

  function resetBoard() {
    setDeck(buildDeck());
    setFlipped([]);
    setAttempts(0);
    setErrors(0);
    setStartAt(null);
    setFinished(false);
    setResultMsg('');
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
  const resetAt = nextWeeklyResetUTC(new Date(nowMs));
  const countdownText = formatCountdown(resetAt.getTime() - nowMs);

  return (
    <main className="flex-1">
      <section className="mx-auto px-4 sm:px-6 lg:px-8 py-10" style={{ maxWidth: 'var(--container-max, 1200px)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Cubo Game</h1>
            
          </div>
          <div className="flex gap-2">
            <button onClick={onGoHome} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5">Voltar</button>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.2fr_.8fr] gap-6">
          <div className="rounded-2xl p-4 sm:p-5 ring-1 ring-white/10 bg-slate-900/50">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {deck.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => onCardClick(idx)}
                  disabled={!status.can_play || busy || finished || card.matched}
                  className={`aspect-square rounded-xl text-2xl sm:text-3xl grid place-items-center ring-1 transition ${reveal(idx) ? 'bg-white/10 ring-white/20' : 'bg-gradient-to-br from-fuchsia-500/15 to-teal-500/15 ring-white/10 hover:bg-white/10'}`}
                  aria-label={reveal(idx) ? `Carta ${card.icon}` : 'Carta fechada'}
                >
                  <span>{reveal(idx) ? card.icon : '❓'}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
              <p className="text-xs text-slate-400">Recompensa da semana</p>
              <p className="mt-1 font-bold text-lg">{status.weekly_reward?.label || 'Carregando...'}</p>
              <p className="mt-2 text-sm text-slate-300">Se fizer partida perfeita (0 erros), o prêmio vira um cupom especial de 20% OFF.</p>
            </div>

            <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Tentativas</span><span>{attempts}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Erros</span><span>{errors}/{MAX_ERRORS}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Status</span><span>{status.loading ? 'Carregando…' : status.can_play ? 'Pode jogar' : 'Já jogou esta semana'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Próxima rodada</span><span className="text-right font-medium">{countdownText}</span></div>
              {status.coupon?.code && (
                <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-400/20 px-3 py-2 text-emerald-200">
                  Cupom desta semana: <b>{status.coupon.code}</b>
                </div>
              )}
              {resultMsg && <p className="text-slate-100">{resultMsg}</p>}
              {status.error && <p className="text-rose-200">{status.error}</p>}
              <p className="text-xs text-slate-400">A rodada semanal reinicia na virada da semana (UTC).</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
