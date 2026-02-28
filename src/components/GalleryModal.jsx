import React from "react";
import Modal from "./Modal";

/**
 * Props:
 * - open (bool)
 * - onClose()
 * - title (string)
 * - imgs (string[])
 * - index (number)
 * - onPrev(), onNext(), onSelect(idx)
 */
export default function GalleryModal({
  open,
  onClose,
  title,
  imgs = [],
  index = 0,
  onPrev,
  onNext,
  onSelect,
}) {
  // Mantém o card estável ao trocar de imagem:
  // - pré-carrega a próxima
  // - enquanto carrega, mantém a anterior com blur + indicador
  const [displaySrc, setDisplaySrc] = React.useState(imgs[index] || "");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const next = imgs[index] || "";
    if (!next) return;
    if (next === displaySrc) return;

    let alive = true;
    setLoading(true);

    const im = new Image();
    im.onload = () => {
      if (!alive) return;
      setDisplaySrc(next);
      setLoading(false);
    };
    im.onerror = () => {
      if (!alive) return;
      setDisplaySrc(next);
      setLoading(false);
    };
    im.src = next;

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, imgs]);

  // Quando abre outra galeria (produto diferente), sincroniza sem transição.
  React.useEffect(() => {
    if (!open) return;
    setDisplaySrc(imgs[index] || "");
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title]);

  return (
    <Modal open={open} onClose={onClose} title={`Fotos — ${title}`}>
      {open && (
        <div className="relative">
          <div className="relative w-full rounded-xl ring-1 ring-white/10 bg-slate-900/60 p-2">
            {/* Área da imagem com altura limitada (evita scrollbar no modal) */}
            <div className="relative w-full h-[55vh] max-h-[520px] min-h-[260px] grid place-items-center">
              <img
                src={displaySrc}
                alt={`${title} — ${index + 1}`}
                className={`max-h-full max-w-full w-auto h-auto object-contain rounded-md transition filter ${
                  loading ? "blur-[2px] opacity-70" : "blur-0 opacity-100"
                }`}
              />

              {loading && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex items-center gap-3 rounded-full bg-black/45 ring-1 ring-white/15 px-4 py-2">
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    <span className="text-xs text-white/90">Carregando imagem…</span>
                  </div>
                </div>
              )}
            {imgs.length > 1 && (
              <>
                <button
                  onClick={onPrev}
                  aria-label="Imagem anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
                >
                  <span className="material-icons">chevron_left</span>
                </button>
                <button
                  onClick={onNext}
                  aria-label="Próxima imagem"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
                >
                  <span className="material-icons">chevron_right</span>
                </button>
              </>
            )}
            </div>
          </div>

          {imgs.length > 1 && (
            <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {imgs.map((src, idx) => {
                const active = idx === index;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelect(idx)}
                    className={`relative rounded-lg overflow-hidden ring-1 ${
                      active ? "ring-teal-400" : "ring-white/10 hover:ring-white/20"
                    }`}
                    title={`Ver imagem ${idx + 1}`}
                  >
                    <img src={src} alt={`thumb ${idx + 1}`} className="h-16 w-full object-cover" />
                    {active && <span className="absolute inset-0 ring-2 ring-teal-400 rounded-lg pointer-events-none" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
