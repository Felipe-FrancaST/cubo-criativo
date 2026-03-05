import React from "react";

// Rota "inteligente" para evitar qualquer flash:
// - VIP -> /area-vip
// - não VIP -> /planos-vip
// Usa cache local (vip_until_cache) para redirecionar instantaneamente.

function isVipCached() {
  try {
    const raw = String(window?.localStorage?.getItem("vip_until_cache") || "");
    if (!raw) return false;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) && d > new Date();
  } catch {
    return false;
  }
}

export default function VipRedirectPage({ user, accessToken, onNavigate, onOpenAuth }) {
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    // Se já temos cache válido, corta 100% o flash.
    if (accessToken && isVipCached()) {
      onNavigate?.("/area-vip");
      return;
    }

    let alive = true;

    (async () => {
      try {
        // Se não está logado, manda para planos (lá ele faz login para assinar).
        if (!accessToken) {
          if (alive) onNavigate?.("/planos-vip");
          return;
        }

        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        const p = data?.profile || null;
        const vipUntil = p?.vip_until ? String(p.vip_until) : "";
        const isVip = vipUntil && new Date(vipUntil) > new Date();

        // Atualiza cache local para próximos refresh.
        try {
          if (vipUntil) window.localStorage.setItem("vip_until_cache", vipUntil);
        } catch {}

        if (!alive) return;
        onNavigate?.(isVip ? "/area-vip" : "/planos-vip");
      } catch {
        if (!alive) return;
        onNavigate?.("/planos-vip");
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [accessToken, onNavigate]);

  // UI neutra (quase nunca aparece)
  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <div className="container-cc rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 text-center">
        <div className="text-sm text-slate-200 font-semibold">
          {checking ? "Carregando…" : "Redirecionando…"}
        </div>
        {!accessToken ? (
          <button
            className="mt-4 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-100"
            onClick={() => onOpenAuth?.()}
          >
            Entrar
          </button>
        ) : null}
      </div>
    </main>
  );
}
