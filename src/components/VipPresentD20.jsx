import React from "react";

const FACE_STORIES = {
  1: { title: "Mímica do azar", text: "O dado quase caiu da mesa. Ainda assim, ele voltou para a sua mão pedindo revanche.", aura: "from-rose-500/25 via-orange-400/10 to-transparent" },
  2: { title: "Passo cauteloso", text: "Nem toda vitória chega correndo. Às vezes ela só pede que você continue.", aura: "from-amber-500/25 via-yellow-300/10 to-transparent" },
  3: { title: "Faísca baixa", text: "Pouca sorte, mas o bastante para acender uma ideia nova.", aura: "from-amber-400/25 via-emerald-300/10 to-transparent" },
  4: { title: "Rolagem firme", text: "Nada espetacular. Nada perdido. É o tipo de resultado que constrói consistência.", aura: "from-cyan-500/25 via-sky-300/10 to-transparent" },
  5: { title: "Vento favorável", text: "O dado ainda gira bonito. Hoje a sorte está aprendendo seu nome.", aura: "from-sky-500/25 via-cyan-300/10 to-transparent" },
  6: { title: "Boa trilha", text: "Não é milagre. É caminho aberto.", aura: "from-teal-500/25 via-emerald-300/10 to-transparent" },
  7: { title: "Sinal promissor", text: "Tem chance boa vindo por perto. Vale insistir em algo que você quer.", aura: "from-emerald-500/25 via-lime-300/10 to-transparent" },
  8: { title: "Ritmo forte", text: "O dado encontrou cadência. Você também.", aura: "from-emerald-500/25 via-teal-300/10 to-transparent" },
  9: { title: "Sorte em marcha", text: "Um resultado sólido, limpo, sem truque. O tipo que dá gosto de ver.", aura: "from-violet-500/25 via-sky-300/10 to-transparent" },
  10: { title: "Metade lendária", text: "A mesa aprovou. O universo também não reclamou.", aura: "from-fuchsia-500/25 via-violet-300/10 to-transparent" },
  11: { title: "Portal aberto", text: "Passou da metade. Agora o dado já começou a sorrir de volta.", aura: "from-violet-500/25 via-fuchsia-300/10 to-transparent" },
  12: { title: "Golpe bonito", text: "Tem resultado que cai redondo. Esse caiu brilhando.", aura: "from-indigo-500/25 via-violet-300/10 to-transparent" },
  13: { title: "Sorte afiada", text: "Hoje a sua rolagem anda com lâmina curta e precisão limpa.", aura: "from-indigo-500/25 via-sky-300/10 to-transparent" },
  14: { title: "Mesa em silêncio", text: "Aquele momento em que todo mundo olha o dado e entende que veio coisa boa.", aura: "from-cyan-500/25 via-indigo-300/10 to-transparent" },
  15: { title: "Crítico quase lá", text: "O tipo de rolagem que já merece comemoração antes mesmo da próxima rodada.", aura: "from-emerald-500/25 via-cyan-300/10 to-transparent" },
  16: { title: "Presente raro", text: "A sorte resolveu caprichar. Não discuta com ela.", aura: "from-amber-400/25 via-violet-300/10 to-transparent" },
  17: { title: "Aplauso da sorte", text: "A rolagem bateu forte na mesa. Daquelas que mudam o humor da noite.", aura: "from-amber-400/25 via-fuchsia-300/10 to-transparent" },
  18: { title: "Luz nas faces", text: "Pouco faltou para o impossível. Ainda assim, já veio grande.", aura: "from-fuchsia-500/25 via-amber-300/10 to-transparent" },
  19: { title: "Quase lendário", text: "Uma rolagem dessas não pede desculpa. Ela entra, vence e senta no melhor lugar.", aura: "from-violet-500/30 via-amber-300/15 to-transparent" },
  20: { title: "Crítico natural", text: "O presente veio dourado. Tem dias em que o d20 decide te tratar como lenda.", aura: "from-amber-400/35 via-yellow-200/20 to-transparent" },
};

const FACE_ORIENTATIONS = {
  1: "rotateX(42deg) rotateY(-25deg) rotateZ(8deg)",
  2: "rotateX(65deg) rotateY(35deg) rotateZ(-10deg)",
  3: "rotateX(25deg) rotateY(60deg) rotateZ(12deg)",
  4: "rotateX(-18deg) rotateY(72deg) rotateZ(-14deg)",
  5: "rotateX(54deg) rotateY(110deg) rotateZ(6deg)",
  6: "rotateX(18deg) rotateY(145deg) rotateZ(-8deg)",
  7: "rotateX(-28deg) rotateY(175deg) rotateZ(10deg)",
  8: "rotateX(62deg) rotateY(205deg) rotateZ(-16deg)",
  9: "rotateX(22deg) rotateY(228deg) rotateZ(5deg)",
  10: "rotateX(-15deg) rotateY(255deg) rotateZ(-10deg)",
  11: "rotateX(48deg) rotateY(284deg) rotateZ(14deg)",
  12: "rotateX(12deg) rotateY(314deg) rotateZ(-7deg)",
  13: "rotateX(-22deg) rotateY(338deg) rotateZ(9deg)",
  14: "rotateX(58deg) rotateY(18deg) rotateZ(-11deg)",
  15: "rotateX(30deg) rotateY(92deg) rotateZ(16deg)",
  16: "rotateX(-32deg) rotateY(132deg) rotateZ(-14deg)",
  17: "rotateX(50deg) rotateY(194deg) rotateZ(11deg)",
  18: "rotateX(16deg) rotateY(266deg) rotateZ(-12deg)",
  19: "rotateX(-12deg) rotateY(322deg) rotateZ(7deg)",
  20: "rotateX(0deg) rotateY(0deg) rotateZ(0deg)",
};

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: 6 + ((i * 17) % 88),
  delay: (i % 6) * 0.08,
  duration: 0.9 + (i % 5) * 0.14,
  size: 5 + (i % 4) * 3,
}));

function storyFor(value) {
  return FACE_STORIES[value] || FACE_STORIES[10];
}

export default function VipPresentD20() {
  const [rolling, setRolling] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(20);
  const [result, setResult] = React.useState(20);
  const [flash, setFlash] = React.useState(false);
  const [burstKey, setBurstKey] = React.useState(0);
  const [settledAt, setSettledAt] = React.useState(Date.now());
  const intervalRef = React.useRef(null);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (endRef.current) window.clearTimeout(endRef.current);
    };
  }, []);

  const currentStory = storyFor(result);
  const currentTransform = FACE_ORIENTATIONS[result] || FACE_ORIENTATIONS[20];

  function rollDice() {
    if (rolling) return;
    const next = Math.floor(Math.random() * 20) + 1;

    setRolling(true);
    setFlash(false);
    setBurstKey((v) => v + 1);

    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (endRef.current) window.clearTimeout(endRef.current);

    const startedAt = performance.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const speedUp = elapsed < 1200;
      const slowZone = elapsed > 1700;
      const randomFace = Math.floor(Math.random() * 20) + 1;
      if (slowZone && Math.random() > 0.45) {
        setDisplayValue((prev) => {
          const drift = prev < next ? 1 : prev > next ? -1 : 0;
          return drift === 0 ? next : Math.min(20, Math.max(1, prev + drift));
        });
      } else {
        setDisplayValue(randomFace);
      }
      if (!speedUp && Math.random() > 0.78) setFlash((v) => !v);
    }, 88);

    endRef.current = window.setTimeout(() => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setDisplayValue(next);
      setResult(next);
      setRolling(false);
      setFlash(true);
      setSettledAt(Date.now());
      window.setTimeout(() => setFlash(false), 700);
    }, 2850);
  }

  return (
    <div className="rounded-[28px] bg-white/5 ring-1 ring-white/10 p-4 sm:p-5 overflow-hidden">
      <style>{`
        .vip-d20-stage {
          perspective: 1200px;
          perspective-origin: 50% 32%;
        }
        .vip-d20-core {
          width: min(56vw, 260px);
          height: min(56vw, 260px);
          transform-style: preserve-3d;
          transition: transform 1150ms cubic-bezier(.2,.85,.22,1), filter 500ms ease;
          will-change: transform, filter;
        }
        .vip-d20-core.is-rolling {
          animation: vip-d20-tumble 2.85s cubic-bezier(.18,.88,.18,1) forwards;
          filter: drop-shadow(0 16px 40px rgba(34,211,238,.18)) drop-shadow(0 0 28px rgba(168,85,247,.22));
        }
        .vip-d20-shell {
          transform-style: preserve-3d;
          animation: vip-d20-idle 8s ease-in-out infinite;
        }
        .vip-d20-core.is-rolling .vip-d20-shell {
          animation: none;
        }
        .vip-d20-faceNumber {
          text-shadow: 0 0 10px rgba(255,255,255,.18), 0 0 22px rgba(250,204,21,.28);
          transition: transform 220ms ease, opacity 220ms ease;
        }
        .vip-d20-faceNumber.flash {
          transform: translateZ(34px) scale(1.08);
          opacity: 1;
        }
        .vip-d20-shadow {
          animation: vip-d20-shadow-idle 5s ease-in-out infinite;
        }
        .vip-d20-core.is-rolling ~ .vip-d20-shadow {
          animation: vip-d20-shadow-roll 2.85s ease-in-out forwards;
        }
        .vip-d20-burst {
          animation: vip-d20-burst 900ms ease-out forwards;
        }
        .vip-d20-ring {
          animation: vip-d20-ring 1.4s ease-out forwards;
        }
        @keyframes vip-d20-idle {
          0%, 100% { transform: rotateX(0deg) rotateY(0deg) translateY(0); }
          50% { transform: rotateX(6deg) rotateY(12deg) translateY(-6px); }
        }
        @keyframes vip-d20-shadow-idle {
          0%, 100% { transform: scale(1); opacity: .45; }
          50% { transform: scale(.92); opacity: .35; }
        }
        @keyframes vip-d20-shadow-roll {
          0% { transform: scale(1); opacity: .35; }
          20% { transform: scale(.72); opacity: .24; }
          45% { transform: scale(1.14); opacity: .52; }
          70% { transform: scale(.86); opacity: .28; }
          100% { transform: scale(1); opacity: .42; }
        }
        @keyframes vip-d20-tumble {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0) scale(1); }
          14% { transform: rotateX(260deg) rotateY(190deg) rotateZ(145deg) translateY(-18px) scale(1.02); }
          28% { transform: rotateX(500deg) rotateY(420deg) rotateZ(280deg) translateY(-30px) scale(1.06); }
          46% { transform: rotateX(880deg) rotateY(730deg) rotateZ(520deg) translateY(-10px) scale(.98); }
          64% { transform: rotateX(1220deg) rotateY(960deg) rotateZ(700deg) translateY(-36px) scale(1.04); }
          82% { transform: rotateX(1490deg) rotateY(1190deg) rotateZ(870deg) translateY(4px) scale(.97); }
          100% { transform: var(--vip-d20-settle); }
        }
        @keyframes vip-d20-burst {
          0% { transform: translate3d(0,0,0) scale(.3); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate3d(var(--dx), var(--dy), 0) scale(1.25); opacity: 0; }
        }
        @keyframes vip-d20-ring {
          0% { transform: scale(.45); opacity: .7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vip-d20-core.is-rolling, .vip-d20-shell, .vip-d20-shadow, .vip-d20-burst, .vip-d20-ring {
            animation: none !important;
          }
          .vip-d20-core { transition: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="relative flex-1 rounded-[28px] overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(168,85,247,.28),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(34,211,238,.14),transparent_40%),linear-gradient(180deg,rgba(2,6,23,.92),rgba(2,6,23,.72))] ring-1 ring-white/10 min-h-[420px]">
          <div className={`absolute inset-x-0 top-0 h-48 bg-gradient-to-b ${currentStory.aura} pointer-events-none`} />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,.04),transparent)] opacity-70 pointer-events-none" />
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 50% 20%, rgba(255,255,255,.14) 0, transparent 42%), linear-gradient(transparent 96%, rgba(255,255,255,.06) 96%), linear-gradient(90deg, transparent 96%, rgba(255,255,255,.04) 96%)", backgroundSize: "100% 100%, 100% 34px, 34px 100%" }} />

          <div className="relative h-full flex flex-col items-center justify-between px-4 py-5 sm:px-6 sm:py-6">
            <div className="w-full flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Presente VIP</div>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-100">Role seu d20</h3>
                <p className="mt-2 max-w-md text-sm text-slate-300">Uma rolagem caprichada, com brilho e impacto, só para a área VIP. Toque no botão e veja onde a sorte decide parar.</p>
              </div>
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                <span className="material-icons text-[16px] text-amber-200">cards_star</span>
                D20 interativo
              </div>
            </div>

            <div className="vip-d20-stage relative w-full flex-1 min-h-[290px] grid place-items-center">
              <div className="absolute inset-0 pointer-events-none">
                {SPARKS.map((spark, index) => (
                  <span
                    key={`${burstKey}-${spark.id}`}
                    className={`absolute bottom-[24%] rounded-full bg-gradient-to-b from-white via-cyan-200 to-transparent ${rolling || flash ? 'vip-d20-burst' : 'opacity-0'}`}
                    style={{
                      left: `${spark.left}%`,
                      width: `${spark.size}px`,
                      height: `${spark.size * 1.8}px`,
                      animationDelay: `${spark.delay}s`,
                      animationDuration: `${spark.duration}s`,
                      ['--dx']: `${(index % 2 === 0 ? -1 : 1) * (24 + (index % 5) * 18)}px`,
                      ['--dy']: `${-120 - (index % 4) * 28}px`,
                      filter: 'blur(.2px)',
                    }}
                  />
                ))}
                <span className={`${rolling || flash ? 'vip-d20-ring' : 'opacity-0'} absolute left-1/2 top-[58%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/50`} />
                <span className={`${rolling || flash ? 'vip-d20-ring' : 'opacity-0'} absolute left-1/2 top-[58%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/35`} style={{ animationDelay: '.14s' }} />
              </div>

              <div
                className={`vip-d20-core relative ${rolling ? 'is-rolling' : ''}`}
                style={{ ['--vip-d20-settle']: `${currentTransform} translateY(0) scale(1)` }}
                aria-live="polite"
                aria-label={`Resultado atual do d20: ${rolling ? displayValue : result}`}
              >
                <div className="vip-d20-shell relative h-full w-full">
                  <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full drop-shadow-[0_30px_60px_rgba(0,0,0,.5)]">
                    <defs>
                      <linearGradient id="vipD20Front" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#9f7aea" />
                        <stop offset="42%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                      <linearGradient id="vipD20Dark" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#020617" />
                      </linearGradient>
                      <linearGradient id="vipD20Glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,.9)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>

                    <polygon points="120,18 34,82 68,196 172,196 206,82" fill="url(#vipD20Dark)" opacity="0.92" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
                    <polygon points="120,18 34,82 120,122 206,82" fill="url(#vipD20Front)" opacity="0.98" stroke="rgba(255,255,255,.18)" strokeWidth="2.2" />
                    <polygon points="34,82 68,196 120,122" fill="#1e293b" opacity="0.95" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
                    <polygon points="206,82 172,196 120,122" fill="#0f172a" opacity="0.98" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
                    <polygon points="68,196 120,222 172,196 120,122" fill="#111827" opacity="0.96" stroke="rgba(255,255,255,.12)" strokeWidth="2" />

                    <polyline points="120,18 120,122 120,222" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.6" />
                    <polyline points="34,82 120,122 206,82" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.4" />
                    <polyline points="68,196 120,122 172,196" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.4" />
                    <polyline points="34,82 68,196" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.4" />
                    <polyline points="206,82 172,196" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.4" />

                    <ellipse cx="104" cy="64" rx="54" ry="18" fill="url(#vipD20Glow)" opacity="0.18" transform="rotate(-22 104 64)" />
                  </svg>

                  <div className="absolute inset-[24%] grid place-items-center">
                    <div className="relative grid h-full w-full place-items-center rounded-[34%] border border-white/10 bg-black/10 backdrop-blur-[1px]">
                      <div className={`vip-d20-faceNumber ${flash ? 'flash' : ''} text-6xl sm:text-7xl font-black text-white`}>{rolling ? displayValue : result}</div>
                      <div className="absolute -bottom-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                        d20
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vip-d20-shadow absolute bottom-[14%] h-12 w-[46%] rounded-full bg-black/60 blur-2xl" />
            </div>

            <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Última rolagem</div>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-black text-white">{result}</span>
                  <span className="pb-1 text-xs text-slate-400">em {new Date(settledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={rollDice}
                disabled={rolling}
                className={`group inline-flex items-center justify-center gap-3 rounded-2xl px-5 py-4 font-extrabold ring-1 ring-white/10 transition ${rolling ? 'bg-slate-700/60 text-slate-300' : 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-black hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(250,204,21,.18)]'}`}
              >
                <span className="material-icons text-[20px]">casino</span>
                {rolling ? 'Rolando...' : 'Rolar d20'}
                <span className="material-icons text-[18px] transition group-hover:translate-x-0.5">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[360px] shrink-0 space-y-4">
          <div className="rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-black p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Resultado</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-100">{currentStory.title}</div>
              </div>
              <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${result >= 18 ? 'from-amber-300 to-orange-300 text-black' : result >= 12 ? 'from-violet-300 to-cyan-300 text-black' : 'from-slate-800 to-slate-700 text-white'} ring-1 ring-white/10 text-xl font-black`}>
                {result}
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{currentStory.text}</p>
            <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Leitura rápida</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-black/25 p-3 ring-1 ring-white/8">
                  <div className="text-slate-400">Faixa</div>
                  <div className="mt-1 font-extrabold text-slate-100">{result <= 5 ? 'Baixa' : result <= 14 ? 'Média' : 'Alta'}</div>
                </div>
                <div className="rounded-xl bg-black/25 p-3 ring-1 ring-white/8">
                  <div className="text-slate-400">Clima</div>
                  <div className="mt-1 font-extrabold text-slate-100">{result === 20 ? 'Lendário' : result >= 15 ? 'Excelente' : result >= 10 ? 'Promissor' : 'Instável'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-slate-200">
              <span className="material-icons text-[18px] text-cyan-200">redeem</span>
              <div className="font-bold">Aba Presente</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">Esse presente é interativo e visual. O botão está funcional e você pode rolar quantas vezes quiser dentro da área VIP.</p>
            <div className="mt-4 rounded-2xl bg-black/30 p-4 text-xs leading-5 text-slate-400 ring-1 ring-white/10">
              Dica: resultados altos recebem um brilho mais forte e uma leitura especial. Resultados baixos continuam com animação completa — porque dado bonito não tem resultado feio.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
