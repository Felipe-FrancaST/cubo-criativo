import * as React from "react";

export default function CarrosselPromo({
  images = ["/images/prod1", "/images/prod2.jpg", "/images/prod3.jpg", "/images/prod4.jpg"],
  interval = 3500,
}) {
  const [i, setI] = React.useState(0);
  const timer = React.useRef(null);
  const hovering = React.useRef(false);

  const next = React.useCallback(
    () => setI((p) => (p + 1) % images.length),
    [images.length]
  );
  const prev = React.useCallback(
    () => setI((p) => (p - 1 + images.length) % images.length),
    [images.length]
  );

  React.useEffect(() => {
    if (images.length <= 1) return;
    clearInterval(timer.current);
    if (!hovering.current) timer.current = setInterval(next, interval);
    return () => clearInterval(timer.current);
  }, [i, next, interval, images.length]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl ring-1 ring-white/10 bg-gradient-to-br from-slate-800 to-slate-900"
      onMouseEnter={() => { hovering.current = true; clearInterval(timer.current); }}
      onMouseLeave={() => { hovering.current = false; timer.current = setInterval(next, interval); }}
    >
      {/* Altura responsiva: 300px no mobile, 420px em telas maiores */}
      <div className="h-[300px] sm:h-[380px] lg:h-[420px]">
        {/* faixa deslizante */}
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {images.map((src, idx) => (
            <div
              key={idx}
              className="min-w-full h-full flex items-center justify-center p-3"
            >
              <img
                src={src}
                alt={`promo ${idx + 1}`}
                // Força "contain" sem depender de classes
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  width: "auto",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement.innerHTML =
                    `<div class="text-slate-300 text-xs px-4 text-center">Imagem não encontrada:<br>${src}</div>`;
                }}
              />
              <span className="absolute left-3 top-3 text-xs font-bold bg-teal-400 text-black px-2 py-1 rounded-md shadow">
                Promo
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* setas */}
      {images.length > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <button
            aria-label="Próximo"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
          >
            <span className="material-icons">chevron_right</span>
          </button>
        </>
      )}

      {/* bolinhas */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-2.5 w-2.5 rounded-full ${idx === i ? "bg-white" : "bg-white/40"}`}
              aria-label={`Ir para slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
