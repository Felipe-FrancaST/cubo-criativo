import React from "react";
import { fmtBRL, centsToBRL, getVariantPricingCents, percentOffCents } from "../lib/pricing.js";

/**
 * Card especial para promoções.
 * Mostra preço antigo riscado, preço atual em destaque e um selo chamativo.
 */
export default function PromoProductCard({ p, addToCart, buyNow, openGallery }) {
  const defaultIndex = Math.max(0, p.variants?.findIndex((v) => v.label === p.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [addedFlash, setAddedFlash] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const flashT = React.useRef(null);

  React.useEffect(() => () => clearTimeout(flashT.current), []);

  const pricing = getVariantPricingCents(p, selIndex, defaultIndex);
  const hasVariants = pricing.hasVariants;
  const escala = pricing.sel?.label ?? p.escala ?? "";
  const currentPrice = centsToBRL(pricing.currentCents);
  const original = centsToBRL(p.originalPriceCents ?? 0);
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
    <article className="w-full min-w-0 group rounded-3xl overflow-hidden ring-2 ring-amber-400/35 bg-gradient-to-b from-amber-500/15 via-slate-900/70 to-slate-950/80 hover:ring-amber-400/60 transition shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      {/* Imagem */}
      <button
        type="button"
        className="aspect-[4/5] bg-slate-800/60 grid place-items-center overflow-hidden w-full relative"
        onClick={() => openGallery?.(p)}
        title="Ver mais fotos"
      >
        {!imgError ? (
          <img
            src={p.img}
            alt={p.nome}
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full group-hover:scale-[1.03] transition"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full grid place-items-center bg-slate-700 text-slate-200 text-xs px-3 text-center">
            Imagem não encontrada.
            <br />
            Verifique a URL no Supabase (image_url).
          </div>
        )}
      </button>

      <div className="p-3 sm:p-5">
        <h3 className="font-extrabold tracking-tight text-sm sm:text-lg leading-snug break-words">{p.nome}</h3>

        <div className=\"mt-2 flex flex-wrap items-center gap-2\">
          <span className=\"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-amber-400 text-black ring-1 ring-amber-300/40\">
            PROMO
          </span>
          {off > 0 && (
            <span className=\"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-emerald-400 text-black ring-1 ring-emerald-300/40\">
              -{off}%
            </span>
          )}
        </div>

        {/* Preços */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {pricing.showStrike && (pricing.originalCents > pricing.currentCents) ? (
              <div className="text-xs text-slate-300">
                <span className="line-through opacity-80">{fmtBRL(centsToBRL(pricing.originalCents))}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Oferta especial</div>
            )}
            <div className="text-xl sm:text-2xl font-black text-amber-300 leading-none">{fmtBRL(currentPrice)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-slate-300">Pagamento rápido</div>
            <div className="text-[11px] text-emerald-300 font-semibold">Pix / Cartão</div>
          </div>
        </div>

        {hasVariants && (
          <div className="mt-4">
            <label className="text-xs text-slate-300 font-semibold">Escolha a escala</label>
            <select
              className="mt-1 w-full rounded-xl bg-slate-900/60 ring-1 ring-white/10 px-3 py-2 text-xs sm:text-sm"
              value={selIndex}
              onChange={(e) => setSelIndex(Number(e.target.value))}
            >
              {p.variants.map((v, i) => {
                const vPriceCents = getVariantPricingCents(p, i, defaultIndex).currentCents;
                return (
                  <option key={v.label} value={i}>
                    {v.label} — {fmtBRL(centsToBRL(vPriceCents))}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Em grid 2 colunas no mobile, empilhar botões evita overlap */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`rounded-xl px-3 py-2 text-sm font-extrabold ring-4 ring-amber-400/20 transition ${
              outOfStock
                ? "bg-slate-900 text-slate-400 cursor-not-allowed ring-white/10"
                : addedFlash
                  ? "bg-emerald-400 text-black"
                  : "bg-amber-400 text-black"
            }`}
            title="Adicionar ao carrinho"
          >
            {outOfStock ? "Esgotado" : addedFlash ? "Adicionado!" : "Adicionar"}
          </button>
          <button
            onClick={() => buyNow(p, { escala, unitPrice: currentPrice })}
            disabled={outOfStock}
            className={`rounded-xl px-3 py-2 text-sm ring-1 ring-white/15 font-semibold ${
              outOfStock ? "bg-slate-900 text-slate-400 cursor-not-allowed" : "hover:bg-white/5"
            }`}
            title="Comprar agora"
          >
            {outOfStock ? "Esgotado" : "Comprar"}
          </button>
        </div>

      </div>
    </article>
  );
}
