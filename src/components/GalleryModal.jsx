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
  return (
    <Modal open={open} onClose={onClose} title={`Fotos — ${title}`}>
      {open && (
        <div className="relative">
          <div className="relative w-full grid place-items-center rounded-xl ring-1 ring-white/10 bg-slate-900/60 p-2">
            <img
              key={index}
              src={imgs[index]}
              alt={`${title} — ${index + 1}`}
              className="max-h-[70vh] w-auto h-auto object-contain rounded-md"
              style={{ maxWidth: "100%" }}
            />
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
