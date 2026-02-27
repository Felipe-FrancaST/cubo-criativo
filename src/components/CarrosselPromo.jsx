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
  fit = "cover", // "cover" | "contain"
  className = "",
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
    // fallback: mantém o layout ok caso o banco ainda não esteja populado
    return [
      { id: "local-1", image_url: "/images/promo.jpg", alt: "promo 1", link_url: null },
      { id: "local-2", image_url: "/images/promo1.jpg", alt: "promo 2", link_url: null },
      { id: "local-3", image_url: "/images/promo2.jpg", alt: "promo 3", link_url: null },
    ];
  }, [images, remoteSlides]);

  // Destino ao tocar no carrossel
  // (forçamos Promoções para evitar qualquer redirecionamento inesperado)
  const defaultLink = "/promocoes";

  const [i, setI] = React.useState(0);
  const [isHovering, setIsHovering] = React.useState(false);
  const timerRef = React.useRef(null);

  // garante índice válido quando a quantidade de slides muda
  React.useEffect(() => {
    if (i >= slides.length) setI(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const next = React.useCallback(
    () => setI((p) => (p + 1) % slides.length),
    [slides.length]
  );
  const prev = React.useCallback(
    () => setI((p) => (p - 1 + slides.length) % slides.length),
    [slides.length]
  );

  // autoplay
  React.useEffect(() => {
    if (slides.length <= 1) return;
    clearInterval(timerRef.current);
    if (!isHovering) timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [i, next, interval, slides.length, isHovering]);

  // swipe (touch)
  const touchStartX = React.useRef(0);
  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 30) return; // ignore toques curtos
    if (dx < 0) next();
    else prev();
  };

  // reduz movimento (acessibilidade)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Carrossel de promoções"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
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
      {loadingRemote && !Array.isArray(images) && (
        <div className="absolute z-10 left-3 top-3 rounded-full bg-black/40 ring-1 ring-white/15 px-3 py-1 text-xs text-slate-200">
          Carregando…
        </div>
      )}

      {/* altura responsiva */}
      <div className="h-[280px] sm:h-[360px] lg:h-[420px] relative">
        {/* imagens empilhadas com fade */}
        {slides.map((s, idx) => {
          const active = idx === i;
          return (
            <div
              key={s?.id ?? idx}
              className={`absolute inset-0 grid place-items-center p-3 transition-opacity ${
                prefersReducedMotion ? "" : "duration-500"
              } ${active ? "opacity-100" : "opacity-0"}`}
              aria-hidden={!active}
            >
              <a
                href={defaultLink}
                className="block w-full h-full"
                aria-label="Abrir promoções"
              >
                <img
                  src={s?.image_url}
                  alt={s?.alt || `promo ${idx + 1}`}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  width: fit === "contain" ? "auto" : "100%",
                  height: fit === "contain" ? "100%" : "100%",
                  objectFit: fit,
                  display: "block",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement.innerHTML =
                    `<div class="text-slate-300 text-xs px-4 text-center">Imagem não encontrada</div>`;
                }}
                />
              </a>
            </div>
          );
        })}
        {/* vinheta sutil nas bordas (deixa mais elegante/clean) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.35))]" />
      </div>

      {/* setas (aparecem mais no hover) */}
      {slides.length > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="group absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/35 hover:bg-black/55 ring-1 ring-white/20 opacity-80 hover:opacity-100 transition"
          >
            <span className="material-icons text-white/90">chevron_left</span>
          </button>
          <button
            aria-label="Próximo"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="group absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/35 hover:bg-black/55 ring-1 ring-white/20 opacity-80 hover:opacity-100 transition"
          >
            <span className="material-icons text-white/90">chevron_right</span>
          </button>
        </>
      )}

      {/* bolinhas (glass + menor) */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-6 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm ring-1 ring-white/10">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setI(idx);
              }}
              className="relative h-2.5 w-2.5"
              aria-label={`Ir para slide ${idx + 1}`}
            >
              <span
                className={`absolute inset-0 rounded-full transition-all ${
                  idx === i ? "bg-white scale-100" : "bg-white/40 scale-75"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
