import React from "react";
import CarrosselPromo from "../components/CarrosselPromo.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { supabase } from "../lib/supabaseClient";

export default function HomePage({
  brand,
  featured,
  prontaEntregaPreview = [],
  rpgPreview = [],
  loadingProducts = false,
  productsError = "",
  addToCart,
  buyNow,
  openGallery,
  onGoEstoque,
  onGoCatalogo,
  onGoSobEncomenda,
  onGoPromocoes,
  onGoFaq,
  onGoPoliticas,
  onGoCupom,
  onRequireLogin,
}) {
  const [depoimentos, setDepoimentos] = React.useState([]);
  const [loadingDepoimentos, setLoadingDepoimentos] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingDepoimentos(true);
        const { data, error } = await supabase
          .from("customer_reviews")
          .select("id, rating, comment, display_name, city, state, created_at")
          .eq("approved", true)
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) throw error;
        if (!alive) return;
        setDepoimentos(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        console.warn("Não foi possível carregar depoimentos:", e?.message || e);
        setDepoimentos([]);
      } finally {
        if (alive) setLoadingDepoimentos(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
              Action figures e miniaturas de RPG em resina
            </h1>

            <p className="mt-4 text-slate-300 text-base sm:text-lg">
              Pintura artística e acabamento premium — <span className="text-slate-100">pronta entrega</span> e <span className="text-slate-100">sob encomenda</span>.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0 justify-center lg:justify-start">
              <button
                onClick={onGoEstoque}
                className="rounded-xl px-5 py-3 bg-teal-400 text-black font-bold ring-4 ring-teal-400/20 text-center"
              >
                Peças em estoque
              </button>
              <button
                onClick={onGoCatalogo}
                className="rounded-xl px-5 py-3 ring-1 ring-white/20 hover:bg-white/5 text-center"
              >
                Catálogo completo
              </button>
            </div>

            {onGoCupom && (
              <div className="mt-4">
                <button onClick={onGoCupom} className="w-full sm:w-auto rounded-xl px-5 py-3 bg-amber-400 text-black font-bold ring-4 ring-amber-400/20">🎴 Cubo Game</button>
              </div>
            )}

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
              <div
                role="button"
                tabIndex={0}
                onClick={onGoPromocoes}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onGoPromocoes?.();
                  }
                }}
                className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60 w-full text-left group/car cursor-pointer"
                title="Ver todas as promoções"
              >
                <div className="relative">
                  <CarrosselPromo fit="cover" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 group-hover/car:opacity-100 transition" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm text-slate-100 font-semibold drop-shadow">
                      Toque para ver todas as promoções
                    </div>

                  </div>
                </div>
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

      {/* PRONTA ENTREGA */}
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Pronta entrega</h2>
            <p className="mt-1 text-sm text-slate-400">Peças disponíveis agora — envio rápido e rastreio.</p>
          </div>
          <button
            onClick={onGoEstoque}
            className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5"
          >
            Ver tudo
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
          {!loadingProducts && !productsError && (prontaEntregaPreview || []).slice(0, 8).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openGallery={openGallery}
              onRequireLogin={onRequireLogin}
            />
          ))}
          {!loadingProducts && !productsError && (prontaEntregaPreview || []).length === 0 && (
            <div className="col-span-full text-center text-slate-400 text-sm">Sem itens em pronta entrega no momento.</div>
          )}
        </div>
      </section>

      {/* MINIATURAS RPG (SOB ENCOMENDA) */}
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Miniaturas RPG sob encomenda</h2>
            <p className="mt-1 text-sm text-slate-400">Produzidas no estúdio — prazo médio 15–30 dias úteis.</p>
          </div>
          <button
            onClick={onGoSobEncomenda}
            className="rounded-xl px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5"
          >
            Como funciona + catálogo
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
          {!loadingProducts && !productsError && (rpgPreview || []).slice(0, 8).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openGallery={openGallery}
              onRequireLogin={onRequireLogin}
            />
          ))}
          {!loadingProducts && !productsError && (rpgPreview || []).length === 0 && (
            <div className="col-span-full text-center text-slate-400 text-sm">Em breve novas miniaturas RPG.</div>
          )}
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
          {productsError && (
            <div className="col-span-full rounded-2xl p-4 ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-100 text-sm">
              Não foi possível carregar os destaques. {productsError}
            </div>
          )}

          {loadingProducts &&
            !productsError &&
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

          {!loadingProducts &&
            !productsError &&
            featured.map((p) => (
              <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openGallery={openGallery}
              onRequireLogin={onRequireLogin}
            />
          ))}

          {!loadingProducts && !productsError && featured.length === 0 && (
            <div className="col-span-full rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 text-slate-200 text-sm">
              Nenhum destaque selecionado. Para mostrar aqui, marque <b>featured = true</b> no produto (Supabase →
              tabela <b>products</b>).
            </div>
          )}
        </div>
      </section>


      {/* CONFIANÇA / INFORMAÇÕES */}
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <p className="text-xs text-slate-400">Prazo de produção</p>
            <p className="mt-1 font-bold">Sob encomenda: 3–7 dias úteis</p>
            <p className="mt-2 text-sm text-slate-300">Pode variar por complexidade, pintura e fila de produção.</p>
          </div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <p className="text-xs text-slate-400">Envio e embalagem</p>
            <p className="mt-1 font-bold">Rastreio + embalagem reforçada</p>
            <p className="mt-2 text-sm text-slate-300">Envio para todo o Brasil após confirmação de pagamento.</p>
          </div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <p className="text-xs text-slate-400">Atendimento</p>
            <p className="mt-1 font-bold">Suporte por WhatsApp e e-mail</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={onGoFaq} className="rounded-lg px-3 py-2 text-xs ring-1 ring-white/15 hover:bg-white/5">FAQ</button>
              <button onClick={onGoPoliticas} className="rounded-lg px-3 py-2 text-xs ring-1 ring-white/15 hover:bg-white/5">Políticas</button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-5 bg-gradient-to-r from-white/5 to-emerald-400/10 ring-1 ring-white/10">
          <h3 className="font-bold">Clientes escolhem a Cubo Criativo por:</h3>
          <ul className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-slate-200">
            <li className="rounded-xl bg-black/20 px-3 py-2">• Acabamento de coleção</li>
            <li className="rounded-xl bg-black/20 px-3 py-2">• Produção sob demanda</li>
            <li className="rounded-xl bg-black/20 px-3 py-2">• Atendimento rápido</li>
            <li className="rounded-xl bg-black/20 px-3 py-2">• Checkout no site + WhatsApp</li>
          </ul>
        </div>
      </section>



      {/* DEPOIMENTOS */}
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Depoimentos</h2>
            <p className="mt-1 text-sm text-slate-400">Avaliações reais de pedidos entregues.</p>
          </div>
        </div>

        {loadingDepoimentos ? (
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
                <div className="h-4 w-24 bg-slate-800/70 rounded animate-pulse" />
                <div className="mt-2 h-3 w-16 bg-slate-800/70 rounded animate-pulse" />
                <div className="mt-4 h-3 w-full bg-slate-800/70 rounded animate-pulse" />
                <div className="mt-2 h-3 w-5/6 bg-slate-800/70 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : null}

        {!loadingDepoimentos && depoimentos.length > 0 ? (
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {depoimentos.map((d) => {
              const nota = Math.max(1, Math.min(5, Number(d?.rating) || 5));
              const local = [d?.city, d?.state].filter(Boolean).join("/");
              return (
                <article key={d.id} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{d?.display_name || "Cliente"}</p>
                      {local ? <p className="text-xs text-slate-400">{local}</p> : null}
                    </div>
                    <div className="text-amber-300 text-sm" aria-label={`${nota} de 5 estrelas`}>{"★".repeat(nota)}<span className="text-slate-600">{"☆".repeat(Math.max(0, 5 - nota))}</span></div>
                  </div>
                  <p className="mt-4 text-sm text-slate-200 leading-relaxed">“{d?.comment || ""}”</p>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loadingDepoimentos && depoimentos.length === 0 ? (
          <div className="mt-6 rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 text-sm text-slate-300">
            Ainda não há avaliações publicadas. Elas aparecerão aqui quando clientes avaliarem pedidos entregues.
          </div>
        ) : null}
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
