import React from "react";
import { fmtBRL, centsToBRL, getVariantPricingCents, percentOffCents } from "../lib/pricing.js";

/**
 * Props:
 * - p (produto)
 * - addToCart(p, {escala, unitPrice})
 * - buyNow(p, {escala, unitPrice})
 * - openViewer(modelSrc, title)   (opcional)
 * - openGallery(p)                (abre galeria com as imagens do produto)
 */
export default function ProductCard({ p, addToCart, buyNow, openViewer, openGallery }) {
  const defaultIndex = Math.max(0, p.variants?.findIndex((v) => v.label === p.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [addedFlash, setAddedFlash] = React.useState(false);
    const flashT = React.useRef(null);

  React.useEffect(() => {
    return () => clearTimeout(flashT.current);
  }, []);

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const pricing = getVariantPricingCents(p, selIndex, defaultIndex);
  const escala = pricing.sel?.label ?? p.escala ?? "";
  const currentPrice = centsToBRL(pricing.currentCents);
  const originalPrice = centsToBRL(pricing.originalCents);
  const off = percentOffCents(pricing.originalCents, pricing.currentCents);

  const outOfStock = typeof p?.stock === "number" && Number.isFinite(p.stock) && p.stock <= 0;

  function handleAdd() {
    if (outOfStock) return;
    addToCart(p, { escala, unitPrice: currentPrice });
    setAddedFlash(true);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setAddedFlash(false), 900);
  }


  return (
    <article className="w-full max-w-[320px] group rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60 hover:ring-teal-400/30 transition">
      {/* Imagem -> abre galeria */}
      <button
        type="button"
        className="aspect-[4/5] bg-slate-800/60 grid place-items-center overflow-hidden w-full relative"
        onClick={() => openGallery?.(p)}
        title="Ver mais fotos"
      >
        <img
         src={p.img}
  alt={p.nome}
  loading="lazy"
  decoding="async"
  className="object-cover w-full h-full group-hover:scale-[1.02] transition"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("bg-slate-700");
            e.currentTarget.parentElement.innerHTML =
              `<div class="text-slate-300 text-xs px-3 text-center">Imagem não encontrada.<br/>Verifique a URL da imagem no Supabase (image_url).</div>`;
          }}
        />
        <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 ring-1 ring-white/20">
          ver fotos
        </span>
      </button>

      <div className="p-4">
        <h3 className="font-bold tracking-tight text-center lg:text-left">{p.nome}</h3>

        {/* Preços (promo com riscado) */}
        <div className="mt-2 flex items-center justify-center lg:justify-start gap-2">
          {pricing.showStrike && originalPrice > currentPrice ? (
            <>
              <span className="text-xs text-slate-300 line-through opacity-80">{fmtBRL(originalPrice)}</span>
              <span className="text-lg font-black text-emerald-300">{fmtBRL(currentPrice)}</span>
              {off > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400 text-black ring-4 ring-emerald-400/20">
                  -{off}%
                </span>
              )}
            </>
          ) : (
            <span className="text-lg font-extrabold text-slate-100">{fmtBRL(currentPrice)}</span>
          )}
        </div>

        {hasVariants && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">Escala / Preço</label>
            <select
              className="mt-1 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm"
              value={selIndex}
              onChange={(e) => setSelIndex(Number(e.target.value))}
            >
              {p.variants.map((v, i) => (
                <option key={v.label} value={i}>
                  {v.label} — {fmtBRL(centsToBRL(getVariantPricingCents(p, i, defaultIndex).currentCents))}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-300">Resina Premium</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`rounded-lg px-3 py-2 font-semibold ring-4 ring-teal-400/20 transition ${
              outOfStock
                ? "bg-slate-800 text-slate-400 cursor-not-allowed ring-white/10"
                : addedFlash
                  ? "bg-emerald-400 text-black"
                  : "bg-teal-400 text-black"
            }`}
            title="Adicionar ao carrinho"
          >
            {outOfStock ? "Esgotado" : addedFlash ? "Adicionado!" : "Adicionar"}
          </button>
          <button
            onClick={() => buyNow(p, { escala, unitPrice: currentPrice })}
            disabled={outOfStock}
            className={`rounded-lg px-3 py-2 ring-1 ring-white/15 ${
              outOfStock ? "bg-slate-800 text-slate-400 cursor-not-allowed" : "hover:bg-white/5"
            }`}
            title="Comprar agora"
          >
            {outOfStock ? "Esgotado" : "Comprar"}
          </button>
        </div>
            className="mt-2 w-full rounded-lg px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm"
          >
            Ver em 3D
          </button>
        )}
      </div>
    </article>
  );
}
