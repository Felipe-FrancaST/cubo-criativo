import React from "react";
import CarrosselPromo from "../components/CarrosselPromo.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { supabase } from "../lib/supabaseClient";

const FALLBACK_BANNER = {
  image_url: "",
  mobile_image_url: "",
};

function resolveBannerImage(banner, isMobile) {
  if (isMobile && banner?.mobile_image_url) return banner.mobile_image_url;
  return banner?.image_url || "";
}

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
  const [banner, setBanner] = React.useState(FALLBACK_BANNER);
  const [bannerLoading, setBannerLoading] = React.useState(true);
  const [bannerImageLoaded, setBannerImageLoaded] = React.useState(false);
  const [isMobileBanner, setIsMobileBanner] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobileBanner(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBannerLoading(true);
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("home_banners")
.select("id,image_url,mobile_image_url")
          .eq("is_active", true)
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .or(`ends_at.is.null,ends_at.gte.${now}`)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!alive) return;

        if (data) {
          setBanner({
            ...FALLBACK_BANNER,
            ...data,
          });
        } else {
          setBanner(FALLBACK_BANNER);
        }
      } catch (e) {
        console.warn("Não foi possível carregar banner da home:", e?.message || e);
        if (alive) setBanner(FALLBACK_BANNER);
      } finally {
        if (alive) setBannerLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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
    return () => {
      alive = false;
    };
  }, []);

  const bannerImage = resolveBannerImage(banner, isMobileBanner);

  React.useEffect(() => {
    setBannerImageLoaded(false);
  }, [bannerImage]);

  return (
    <main className="flex-1">
      {/* BANNER GEEK */}
      <section className="container-cc px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] ring-1 ring-white/10 bg-slate-950 shadow-2xl">
          <div className="relative aspect-[16/9] w-full sm:aspect-[16/7] lg:aspect-[16/6] bg-[radial-gradient(circle_at_center,_rgba(196,153,74,0.16),_rgba(22,18,14,0.96)_68%)]">
            {bannerImage ? (
              <>
                <img
                  src={bannerImage}
                  alt="Banner da loja Cubo Criativo"
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${bannerImageLoaded ? "scale-100 blur-0 opacity-100" : "scale-[1.03] blur-xl opacity-70"}`}
                  loading="eager"
                  onLoad={() => setBannerImageLoaded(true)}
                  onError={() => setBannerImageLoaded(true)}
                />
                {!bannerImageLoaded ? (
                  <div className="pointer-events-none absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,_rgba(196,153,74,0.18),_rgba(24,18,16,1)_72%)]" />
            )}

            {(bannerLoading || (bannerImage && !bannerImageLoaded)) ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400/10 via-amber-300/80 to-red-400/10" />
            ) : null}
          </div>
        </div>
      </section>

      {/* HERO / PROMO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/35 via-fuchsia-500/15 to-indigo-500/10" />
        <div className="container-cc grid lg:grid-cols-2 items-center gap-10 px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="text-center lg:text-left lg:pr-6">
            <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-slate-200">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Loja online • Miniaturas e Action Figures
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

          </div>

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
              >
                <CarrosselPromo itens={featured} openGallery={openGallery} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="destaques" className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <p className="text-teal-300 font-semibold text-sm">Só esta semana</p>
            <h2 className="text-2xl sm:text-3xl font-black">Destaques da loja</h2>
          </div>
          <button onClick={onGoCatalogo} className="text-sm underline decoration-dotted text-slate-300 hover:text-white">
            Ver tudo
          </button>
        </div>

        {loadingProducts ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 animate-pulse h-72" />
            ))}
          </div>
        ) : productsError ? (
          <div className="rounded-2xl p-5 ring-1 ring-red-400/20 bg-red-500/10 text-red-100">
            {productsError}
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-white/5 text-slate-300">
            Nenhum destaque no momento.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                addToCart={addToCart}
                buyNow={buyNow}
                openGallery={openGallery}
                onRequireLogin={onRequireLogin}
              />
            ))}
          </div>
        )}
      </section>

      <section className="container-cc px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
        <div className="rounded-3xl ring-1 ring-white/10 bg-white/5 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <p className="text-fuchsia-300 font-semibold text-sm">Em estoque</p>
              <h2 className="text-2xl sm:text-3xl font-black">Pronta entrega</h2>
            </div>
            <button onClick={onGoEstoque} className="text-sm underline decoration-dotted text-slate-300 hover:text-white">
              Ver estoque completo
            </button>
          </div>

          {prontaEntregaPreview.length === 0 ? (
            <div className="text-slate-300">Sem itens de pronta entrega por enquanto.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {prontaEntregaPreview.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  addToCart={addToCart}
                  buyNow={buyNow}
                  openGallery={openGallery}
                  onRequireLogin={onRequireLogin}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container-cc px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
        <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <p className="text-indigo-300 font-semibold text-sm">Galeria de heróis, monstros e classes</p>
            <h2 className="text-2xl sm:text-3xl font-black">Miniaturas RPG</h2>
          </div>
          <button onClick={onGoSobEncomenda} className="text-sm underline decoration-dotted text-slate-300 hover:text-white">
            Ver catálogo RPG
          </button>
        </div>

        {rpgPreview.length === 0 ? (
          <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-white/5 text-slate-300">
            Ainda estamos preparando os destaques de RPG.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {rpgPreview.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                addToCart={addToCart}
                buyNow={buyNow}
                openGallery={openGallery}
                onRequireLogin={onRequireLogin}
              />
            ))}
          </div>
        )}
      </section>

      <section className="container-cc px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-3xl ring-1 ring-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-black p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <p className="text-amber-300 font-semibold text-sm">Quem já comprou</p>
              <h2 className="text-2xl sm:text-3xl font-black">Avaliações e comentários</h2>
            </div>
          </div>

          {loadingDepoimentos ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 animate-pulse h-40" />
              ))}
            </div>
          ) : depoimentos.length === 0 ? (
            <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-white/5 text-slate-300">
              Ainda não há avaliações públicas aprovadas.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {depoimentos.map((d) => {
                const author = [d.display_name, d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state]
                  .filter(Boolean)
                  .join(" • ");
                const stars = Math.max(1, Math.min(5, Number(d.rating) || 5));
                return (
                  <article key={d.id} className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5">
                    <div className="flex items-center gap-1 text-amber-300" aria-label={`${stars} estrelas`}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx}>{idx < stars ? "★" : "☆"}</span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-200">
                      “{d.comment || "Compra aprovada."}”
                    </p>
                    <p className="mt-4 text-xs text-slate-400">{author || "Cliente verificado"}</p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="container-cc px-4 sm:px-6 lg:px-8 pb-14">
        <div className="rounded-3xl p-5 sm:p-7 ring-1 ring-white/10 bg-gradient-to-r from-teal-500/15 via-fuchsia-500/10 to-indigo-500/15">
          <div className="grid lg:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-emerald-300 font-semibold text-sm">Precisa de ajuda?</p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black">Tire dúvidas antes de comprar</h3>
              <p className="mt-3 text-slate-300">
                Veja prazos, trocas, política de envio e formas de pagamento.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <button onClick={onGoFaq} className="rounded-xl px-5 py-3 bg-white text-black font-bold">
                Abrir FAQ
              </button>
              <button onClick={onGoPoliticas} className="rounded-xl px-5 py-3 ring-1 ring-white/20 hover:bg-white/5">
                Ver políticas
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
