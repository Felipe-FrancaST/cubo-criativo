import React from "react";
import CarrosselPromo from "../components/CarrosselPromo.jsx";
import ProductCard from "../components/ProductCard.jsx";

export default function HomePage({
  brand,
  featured,
  addToCart,
  buyNow,
  openViewer,
  openGallery,
  onGoEstoque,
  onGoCatalogo,
}) {
  return (
    <main className="flex-1">
      {/* HERO / PROMO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/35 via-fuchsia-500/15 to-indigo-500/10" />
        <div
          className="mx-auto grid lg:grid-cols-2 items-center gap-10 px-4 sm:px-6 lg:px-8 py-10 sm:py-16"
          style={{ maxWidth: "var(--container-max, 1200px)" }}
        >
          <div className="text-center lg:text-left lg:pr-6">
            <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-slate-200">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Loja online • Miniaturas e Impressões 3D
            </p>

            <h1 className="mt-4 font-black leading-tight text-3xl sm:text-5xl lg:text-6xl">
              Promoções, lançamentos e
              <span className="text-teal-400"> peças em destaque</span>
            </h1>

            <p className="mt-4 text-slate-300 text-base sm:text-lg">
              {brand.slogan}. Qualidade de vitrine para colecionadores, RPG e cultura geek.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0 justify-center lg:justify-start">
              <button
                onClick={onGoEstoque}
                className="rounded-xl px-5 py-3 bg-teal-400 text-black font-bold ring-4 ring-teal-400/20 text-center"
              >
                Ver estoque pronto
              </button>
              <button
                onClick={onGoCatalogo}
                className="rounded-xl px-5 py-3 ring-1 ring-white/20 hover:bg-white/5 text-center"
              >
                Ver catálogo completo
              </button>
            </div>

            {/* Anúncios */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
                <p className="font-semibold">Envio para todo o Brasil</p>
                <p className="mt-1 text-slate-300">Embalagem reforçada + rastreio.</p>
              </div>
              <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
                <p className="font-semibold">Orçamento rápido</p>
                <p className="mt-1 text-slate-300">Finalize pelo WhatsApp ou pague no site.</p>
              </div>
            </div>
          </div>

          {/* Promoções (carrossel) */}
          <div className="relative" id="promocoes">
            <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-fuchsia-500/20 via-teal-500/15 to-indigo-500/20 ring-1 ring-white/10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-400 text-black">
                    Promoções
                  </span>
                  <span className="hidden sm:inline text-slate-300 text-sm">
                    Ofertas selecionadas
                  </span>
                </div>
                <span className="hidden sm:inline text-emerald-300 text-xs font-semibold">
                  ⚡ aproveite enquanto dura
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60">
                <CarrosselPromo
                  images={["/images/promo.jpg", "/images/promo1.jpg", "/images/promo2.jpg"]}
                  fit="cover"
                />
              </div>
            </div>
            <div className="absolute -top-3 -right-2 sm:-right-3">
              <div className="animate-pulse rounded-full px-3 py-1 text-xs font-bold bg-emerald-400 text-black ring-4 ring-emerald-400/30 shadow-lg">
                Só esta semana
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DESTAQUES */}
      <section
        id="destaques"
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Destaques</h2>
            <p className="mt-1 text-sm text-slate-400">
              Seleção do estúdio — pronta pra chamar atenção na estante.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
          {featured.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openViewer={openViewer}
              openGallery={openGallery}
            />
          ))}
        </div>
      </section>

      {/* SOBRE */}
      <section
        id="sobre"
        className="mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Sobre a {brand.name}</h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Estúdio gamer/nerd focado em impressão 3D em resina, pintura artística e modelagem sob medida.
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-300 justify-items-center lg:justify-items-start">
              <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Atendimento via WhatsApp</li>
              <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Envio para todo o Brasil</li>
              <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Qualidade de coleção</li>
            </ul>
          </div>

          <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/80">
            <h3 className="font-bold">Especificações</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• Camadas de 0,01–0,05 mm</li>
              <li>• Resina premium 12K</li>
              <li>• Suporte e pós-processo inclusos</li>
              <li>• Pintura com aerógrafo e pincel</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
