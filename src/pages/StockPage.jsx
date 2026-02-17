import React from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function StockPage({ items, loading = false, error = "", addToCart, buyNow, openViewer, openGallery }) {
  return (
    <main className="flex-1">
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Em estoque</h1>
            <p className="mt-1 text-sm text-slate-400">Peças prontas para envio.</p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">{loading ? "carregando…" : `${items.length} item(ns)`}</span>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
            {loading &&
              Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-[320px] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60"
                >
                  <div className="aspect-[4/5] bg-slate-800/60 animate-pulse" />
                  <div className="p-4">
                    <div className="h-4 bg-slate-800/60 rounded animate-pulse" />
                    <div className="mt-3 h-9 bg-slate-800/60 rounded animate-pulse" />
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                      <div className="h-10 bg-slate-800/60 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}

            {!loading &&
              items.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  addToCart={addToCart}
                  buyNow={buyNow}
                  openViewer={openViewer}
                  openGallery={openGallery}
                />
              ))}

            {!loading && items.length === 0 && (
              <div className="col-span-full text-center text-slate-400 text-sm">
                Nenhum item em estoque no momento.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
