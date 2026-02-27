import React from "react";
import PromoProductCard from "../components/PromoProductCard.jsx";

export default function PromocoesPage({
  items,
  loading = false,
  error = "",
  addToCart,
  buyNow,
  openGallery,
  onGoHome,
}) {
  const promos = Array.isArray(items) ? items : [];

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-35 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/30 via-fuchsia-500/10 to-teal-500/15" />

        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
          style={{ maxWidth: "var(--container-max, 1200px)" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold bg-amber-400 text-black ring-4 ring-amber-400/25">
                <span className="material-icons text-[16px]">local_offer</span>
                Promoções
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
                Ofertas para chamar atenção
              </h1>
              <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl">
                Descontos especiais por tempo limitado. Toque em um item para ver fotos, escolher escala e comprar.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onGoHome}
                className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm"
              >
                <span className="material-icons align-middle text-[18px]">chevron_left</span> Voltar
              </button>
              <div className="rounded-xl px-4 py-2 bg-white/5 ring-1 ring-white/10 text-sm">
                <span className="text-slate-300">Total:</span>{" "}
                <span className="font-extrabold text-amber-300">{loading ? "…" : promos.length}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            {error && (
              <div className="rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
                Não foi possível carregar as promoções. {error}
              </div>
            )}

            {loading && !error && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-full max-w-[340px] rounded-3xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60"
                  >
                    <div className="aspect-[4/5] bg-slate-800/60 animate-pulse" />
                    <div className="p-5">
                      <div className="h-4 bg-slate-800/60 rounded animate-pulse" />
                      <div className="mt-3 h-8 bg-slate-800/60 rounded animate-pulse" />
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                        <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && promos.length === 0 && (
              <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-white/5 text-slate-200 text-sm">
                Nenhuma promoção ativa no momento.
              </div>
            )}

            {!loading && !error && promos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {promos.map((p) => (
                  <PromoProductCard
                    key={p.id}
                    p={p}
                    addToCart={addToCart}
                    buyNow={buyNow}
                    openGallery={openGallery}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
