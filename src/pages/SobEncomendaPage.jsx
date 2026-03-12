import React from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function SobEncomendaPage({
  items,
  loading = false,
  error = "",
  addToCart,
  buyNow,
  openGallery,
  onGoCatalogo,
  onRequireLogin,
}) {
  return (
    <main className="flex-1">
      <section
        className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14" >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Sob encomenda</h1>
            <p className="mt-1 text-sm text-slate-400">
              {/* texto removido */}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoCatalogo}
              className="container-cc rounded-xl px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/4"
            >
              Ver catálogo completo
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/4">
            <p className="font-bold">Como funciona</p>
            <ul className="mt-2 text-sm text-slate-300 space-y-1">
              <li>• Você compra pelo site (ou fecha no WhatsApp).</li>
              <li>• Produção e acabamento no estúdio.</li>
              <li>• Envio com rastreio para todo o Brasil.</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/4">
            <p className="font-bold">Prazos</p>
            <p className="mt-2 text-sm text-slate-300">
              O prazo varia conforme fila de produção, complexidade e pintura. Em geral:
            </p>
            <p className="mt-2 text-sm text-slate-200 font-semibold">15–30 dias úteis</p>
          </div>
          <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/4">
            <p className="font-bold">Dúvidas?</p>
            <p className="mt-2 text-sm text-slate-300">
              Fale com a gente no WhatsApp e enviamos detalhes, fotos e prazos atualizados.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
            Não foi possível carregar os produtos. {error}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {loading &&
              Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-[320px] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-[#07161d]/60"
                >
                  <div className="aspect-[4/5] bg-[#0c2430]/68 animate-pulse" />
                  <div className="p-4">
                    <div className="h-4 bg-[#0c2430]/68 rounded animate-pulse" />
                    <div className="mt-3 h-9 bg-[#0c2430]/68 rounded animate-pulse" />
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="h-10 bg-[#0c2430]/68 rounded animate-pulse" />
                      <div className="h-10 bg-[#0c2430]/68 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}

            {!loading &&
              (items || []).map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  addToCart={addToCart}
                  buyNow={buyNow}
                  openGallery={openGallery}
                  onRequireLogin={onRequireLogin}
                />
              ))}

            {!loading && (items || []).length === 0 && (
              <div className="col-span-full text-center text-slate-400 text-sm">
                Nenhum item sob encomenda no momento.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
