// src/components/CarrosselPromo.jsx
import * as React from "react";

export default function CarrosselPromo({
  images = ["/images/prod1.jpg", "/images/prod2.jpg", "/images/prod3.jpg"],
  interval = 3500,
  fit = "cover", // "cover" | "contain"
  className = "",
}) {
  const [i, setI] = React.useState(0);
  const [isHovering, setIsHovering] = React.useState(false);
  const timerRef = React.useRef(null);

  const next = React.useCallback(
    () => setI((p) => (p + 1) % images.length),
    [images.length]
  );
  const prev = React.useCallback(
    () => setI((p) => (p - 1 + images.length) % images.length),
    [images.length]
  );

  // autoplay
  React.useEffect(() => {
    if (images.length <= 1) return;
    clearInterval(timerRef.current);
    if (!isHovering) timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [i, next, interval, images.length, isHovering]);

  // teclado
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

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
      className={`relative w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-[#0f141b] ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* altura responsiva */}
      <div className="h-[280px] sm:h-[360px] lg:h-[420px] relative">
        {/* imagens empilhadas com fade */}
        {images.map((src, idx) => {
          const active = idx === i;
          return (
            <div
              key={idx}
              className={`absolute inset-0 grid place-items-center p-3 transition-opacity ${
                prefersReducedMotion ? "" : "duration-500"
              } ${active ? "opacity-100" : "opacity-0"}`}
              aria-hidden={!active}
            >
              <img
                src={src}
                alt={`promo ${idx + 1}`}
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
                    `<div class="text-slate-300 text-xs px-4 text-center">Imagem não encontrada:<br>${src}</div>`;
                }}
              />
            </div>
          );
        })}
        {/* vinheta sutil nas bordas (deixa mais elegante/clean) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.35))]" />
      </div>

      {/* setas (aparecem mais no hover) */}
      {images.length > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={prev}
            className="group absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/35 hover:bg-black/55 ring-1 ring-white/20 opacity-80 hover:opacity-100 transition"
          >
            <span className="material-icons text-white/90">chevron_left</span>
          </button>
          <button
            aria-label="Próximo"
            onClick={next}
            className="group absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/35 hover:bg-black/55 ring-1 ring-white/20 opacity-80 hover:opacity-100 transition"
          >
            <span className="material-icons text-white/90">chevron_right</span>
          </button>
        </>
      )}

      {/* bolinhas (glass + menor) */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-6 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm ring-1 ring-white/10">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
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
