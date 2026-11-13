// src/components/CarrosselPromo.jsx
import * as React from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function CarrosselPromo({
  /**
   * Se `images` for passado, o componente usa exatamente esse array.
   * Caso contrário, carrega automaticamente do Supabase (tabela `site_carousel_images`).
   */
  images,
  interval = 3500,
  fit = "contain", // "cover" | "contain"
  className = "",
  onActivate,
}) {
  const [remoteSlides, setRemoteSlides] = React.useState([]);
  const [loadingRemote, setLoadingRemote] = React.useState(false);
  const [remoteErr, setRemoteErr] = React.useState("");

  // Carrega do Supabase quando não receber `images` por props
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (Array.isArray(images)) return;
      setLoadingRemote(true);
      setRemoteErr("");
      try {
        const { data, error } = await supabase
          .from("site_carousel_images")
          .select("id,image_url,alt,link_url,sort_order,active")
          .eq("active", true)
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (cancelled) return;
        setRemoteSlides(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        setRemoteErr(e?.message || "Erro ao carregar imagens");
        setRemoteSlides([]);
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [images]);

  // Fonte final: props > Supabase > fallback local
  const shouldHoldForRemote = !Array.isArray(images) && loadingRemote && remoteSlides.length === 0;

  const slides = React.useMemo(() => {
    if (Array.isArray(images) && images.length) {
      return images.map((src, idx) => ({
        id: String(idx),
        image_url: src,
        alt: `promo ${idx + 1}`,
        link_url: null,
      }));
    }
    if (remoteSlides.length) return remoteSlides;
    if (shouldHoldForRemote) return [];
    // fallback: mantém o layout ok caso o banco ainda não esteja populado
    return [
      { id: "local-1", image_url: "/images/promo.jpg", alt: "promo 1", link_url: null },
      { id: "local-2", image_url: "/images/promo1.jpg", alt: "promo 2", link_url: null },
      { id: "local-3", image_url: "/images/promo2.jpg", alt: "promo 3", link_url: null },
    ];
  }, [images, remoteSlides, shouldHoldForRemote]);

  // evita manipular DOM fora do React (onError) e permite fallback por slide
  const [failedMap, setFailedMap] = React.useState(() => ({}));
  // Cada imagem pode ter uma proporção diferente. Ajustar o quadro ao slide
  // evita cortar a arte e também evita barras vazias exageradas.
  const [slideRatios, setSlideRatios] = React.useState(() => ({}));

  const [i, setI] = React.useState(0);
  const activeSlide = slides[i] || slides[0];
  const activeRatio = slideRatios[String(activeSlide?.id ?? i)] || 16 / 9;
  const [isHovering, setIsHovering] = React.useState(false);
  const timerRef = React.useRef(null);

  // garante índice válido quando a quantidade de slides muda
  React.useEffect(() => {
    if (i >= slides.length) setI(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const next = React.useCallback(() => {
    if (slides.length <= 1) return;
    setI((p) => (p + 1) % slides.length);
  }, [slides.length]);
  const prev = React.useCallback(() => {
    if (slides.length <= 1) return;
    setI((p) => (p - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // reduz movimento (acessibilidade)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // autoplay
  React.useEffect(() => {
    clearInterval(timerRef.current);
    if (slides.length <= 1 || isHovering || prefersReducedMotion) return undefined;
    timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [next, interval, slides.length, isHovering, prefersReducedMotion]);

  // swipe (touch)
  const touchStartX = React.useRef(0);
  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 30) return; // ignore toques curtos
    if (dx < 0) next();
    else prev();
  };

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Carrossel de promoções"
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); next(); return; }
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); return; }
        if ((e.key === "Enter" || e.key === " ") && typeof onActivate === "function") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={`relative w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-[#0f141b] ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {remoteErr && !Array.isArray(images) && (
        <div className="absolute z-10 left-3 top-3 right-3 rounded-2xl bg-rose-500/15 ring-1 ring-rose-400/30 px-3 py-2 text-xs text-rose-100">
          Não foi possível carregar o carrossel. ({remoteErr})
        </div>
      )}
      {loadingRemote && !Array.isArray(images) && !shouldHoldForRemote && (
        <div className="absolute z-10 left-3 top-3 rounded-full bg-[#020b10]/70 ring-1 ring-white/15 px-3 py-1 text-xs text-slate-200">
          Carregando…
        </div>
      )}

      {/* Proporção responsiva: sem altura fixa nem corte da imagem. */}
      <div className="carousel-promo-viewport relative" style={{ aspectRatio: activeRatio }}>
        {shouldHoldForRemote && (
          <div className="absolute inset-0 grid place-items-center p-3" aria-hidden="true">
            <div className="h-full w-full rounded-[1.25rem] bg-white/[0.04] ring-1 ring-white/10 animate-pulse" />
          </div>
        )}
        {/* imagens empilhadas com fade */}
        {slides.map((s, idx) => {
          const active = idx === i;
          const slideKey = String(s?.id ?? idx);
          const failed = !!failedMap[slideKey];
          return (
            <div
              key={slideKey}
              className={`absolute inset-0 grid place-items-center transition-opacity ${
                prefersReducedMotion ? "" : "duration-500"
              } ${active ? "opacity-100" : "opacity-0"} ${active ? "" : "pointer-events-none"}`}
              aria-hidden={!active}
            >
              {/*
                IMPORTANTE (bug fix): o HomePage já envolve o carrossel em um container clicável
                que navega via SPA. Um <a href> aqui dentro causava navegação dupla (SPA + reload)
                e gerava "bugadinha"/flicker no clique.
              */}
              <div className="block w-full h-full">
                {!failed ? (
                  <img
                    src={s?.image_url}
                    alt={s?.alt || `promo ${idx + 1}`}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "auto"}
                    decoding="async"
                    style={{
                      maxHeight: "100%",
                      maxWidth: "100%",
                      width: "100%",
                      height: "100%",
                      objectFit: fit,
                      display: "block",
                    }}
                    onLoad={(event) => {
                      const { naturalWidth, naturalHeight } = event.currentTarget;
                      if (!naturalWidth || !naturalHeight) return;
                      // Limites mantêm um carrossel confortável em telas estreitas;
                      // object-fit: contain garante a imagem toda mesmo fora deles.
                      const ratio = Math.min(3.5, Math.max(1, naturalWidth / naturalHeight));
                      setSlideRatios((current) => current[slideKey] === ratio
                        ? current
                        : { ...current, [slideKey]: ratio });
                    }}
                    onError={() =>
                      setFailedMap((m) => ({
                        ...m,
                        [slideKey]: true,
                      }))
                    }
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-slate-300 text-xs px-4 text-center">
                    Imagem não encontrada
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="carousel-promo-controls" aria-label="Navegação do carrossel">
          <button
            type="button"
            aria-label="Imagem anterior"
            onClick={(event) => { event.stopPropagation(); prev(); }}
            className="carousel-promo-control"
          >
            <span className="material-icons" aria-hidden="true">chevron_left</span>
          </button>
          <div className="carousel-promo-dots" aria-label="Selecionar imagem">
            {slides.map((_, idx) => (
              <button
                type="button"
                key={idx}
                onClick={(event) => { event.stopPropagation(); setI(idx); }}
                aria-label={`Ir para imagem ${idx + 1} de ${slides.length}`}
                aria-current={idx === i ? "true" : undefined}
                className={`carousel-promo-dot ${idx === i ? "is-active" : ""}`}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Próxima imagem"
            onClick={(event) => { event.stopPropagation(); next(); }}
            className="carousel-promo-control"
          >
            <span className="material-icons" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
