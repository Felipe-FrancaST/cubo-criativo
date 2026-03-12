import React from "react";
import CarrosselPromo from "../components/CarrosselPromo.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { supabase } from "../lib/supabaseClient";

const FALLBACK_BANNER = {
  eyebrow: "Loja Geek",
  title: "Action figures, miniaturas e peças épicas para sua coleção",
  description:
    "Destaques em resina, pintura premium e promoções para quem curte RPG, fantasia e cultura geek.",
  image_url: "/images/banner-geek-home.svg",
  mobile_image_url: "",
  cta_primary_label: "Explorar catálogo",
  cta_secondary_label: "Ver promoções",
  badge_text: "Destaque da semana",
  overlay_strength: 72,
};

function resolveBannerImage(banner, isMobile) {
  if (isMobile && banner?.mobile_image_url) return banner.mobile_image_url;
  return banner?.image_url || FALLBACK_BANNER.image_url;
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
          .select(
            "id,eyebrow,title,description,image_url,mobile_image_url,cta_primary_label,cta_secondary_label,badge_text,overlay_strength"
          )
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
            overlay_strength: Number.isFinite(Number(data?.overlay_strength))
              ? Math.max(0, Math.min(95, Number(data.overlay_strength)))
              : FALLBACK_BANNER.overlay_strength,
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
  const overlayOpacity = Math.max(0.45, Number(banner?.overlay_strength || 72) / 100);

  return (
    <main className="flex-1">
      {/* BANNER GEEK */}
      <section className="container-cc px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-[28px] ring-1 ring-white/10 bg-slate-950 shadow-2xl">
          <div className="absolute inset-0">
            <img
              src={bannerImage}
              alt={banner?.title || "Banner da loja Cubo Criativo"}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30 sm:to-transparent"
            style={{ opacity: overlayOpacity }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent" />

          <div className="relative min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 flex items-end">
            <div className="max-w-[560px]">
              <div className="flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200 ring-1 ring-cyan-300/20 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                  {banner?.eyebrow || FALLBACK_BANNER.eyebrow}
                </p>
                {banner?.badge_text ? (
                  <span className="inline-flex items-center rounded-full bg-fuchsia-500/20 px-3 py-1 text-[11px] font-semibold text-fuchsia-100 ring-1 ring-fuchsia-300/20 backdrop-blur">
                    {banner.badge_text}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                {banner?.title || FALLBACK_BANNER.title}
              </h2>

              <p className="mt-3 max-w-[46ch] text-sm leading-6 text-slate-200 sm:text-base">
                {banner?.description || FALLBACK_BANNER.description}
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={onGoCatalogo}
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 ring-4 ring-cyan-400/20"
                >
                  {banner?.cta_primary_label || FALLBACK_BANNER.cta_primary_label}
                </button>
                <button
                  onClick={onGoPromocoes}
                  className="rounded-xl border border-white/15 bg-black/25 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  {banner?.cta_secondary_label || FALLBACK_BANNER.cta_secondary_label}
                </button>
              </div>
            </div>
          </div>

          {bannerLoading ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-400/10 via-cyan-300/80 to-fuchsia-400/10" />
          ) : null}
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
