import React from "react";
import { fmtBRL, centsToBRL, getVariantPricingCents, percentOffCents } from "../lib/pricing.js";
import { useFavorites } from "../state/FavoritesProvider.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

/**
 * Props:
 * - p (produto)
 * - addToCart(p, {escala, unitPrice})
 * - buyNow(p, {escala, unitPrice})
 * - openGallery(p)                (abre galeria com as imagens do produto)
 */
export default function ProductCard({ p, addToCart, buyNow, openGallery, onRequireLogin }) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const defaultIndex = Math.max(0, p.variants?.findIndex((v) => v.label === p.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [imgError, setImgError] = React.useState(false);
  const [addedFlash, setAddedFlash] = React.useState(false);
  const flashT = React.useRef(null);

  React.useEffect(() => {
    return () => clearTimeout(flashT.current);
  }, []);
  React.useEffect(() => {
    setImgError(false);
  }, [p?.img]);


  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const pricing = getVariantPricingCents(p, selIndex, defaultIndex);
  const escala = pricing.sel?.label ?? p.escala ?? "";
  const currentPrice = centsToBRL(pricing.currentCents);
  const originalPrice = centsToBRL(pricing.originalCents);
  const off = percentOffCents(pricing.originalCents, pricing.currentCents);

  const outOfStock = typeof p?.stock === "number" && Number.isFinite(p.stock) && p.stock <= 0;

  const fav = isFavorite(p?.id);

  function handleAdd() {
    if (outOfStock) return;
    addToCart(p, { escala, unitPrice: currentPrice });
    setAddedFlash(true);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setAddedFlash(false), 900);
  }


  return (
    <article
      id={p?.id ? `product-${p.id}` : undefined}
      className="w-full min-w-0 group rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60 hover:ring-teal-400/30 transition"
    >
      {/* Imagem -> abre galeria */}
      <div
        role="button"
        tabIndex={0}
        className="aspect-[4/5] min-h-[220px] sm:min-h-[260px] bg-slate-800/60 grid place-items-center overflow-hidden w-full relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400/40"
        onClick={() => openGallery?.(p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openGallery?.(p);
          }
        }}
        title="Ver mais fotos"
        aria-label={`Ver fotos de ${p?.nome ?? "produto"}`}
      >
        {!imgError ? (
          <img
            src={p.img}
            alt={p.nome}
            loading="lazy"
            decoding="async"
            className="block object-cover w-full h-full group-hover:scale-[1.02] transition"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="text-slate-300 text-xs px-3 text-center">
            Imagem indisponível.<br />
            Verifique a URL da imagem no Supabase (image_url).
          </div>
        )}

        {/* Favoritar */}
        <button
          type="button"
          className={`absolute top-2 left-2 rounded-full px-2.5 py-2 text-sm ring-1 transition ${
            fav
              ? "bg-rose-500/90 text-white ring-rose-200/40"
              : "bg-black/50 text-white ring-white/20 hover:bg-black/70"
          }`}
          aria-pressed={fav}
          aria-label={fav ? "Remover dos favoritos" : "Favoritar"}
          title={fav ? "Remover dos favoritos" : "Favoritar"}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const res = await toggleFavorite(p?.id);
            if (!res.ok && !user) {
              onRequireLogin?.('Faça login para favoritar.');
            } else if (!res.ok && res.error) {
              console.warn(res.error);
            }
          }}
        >
          {fav ? "♥" : "♡"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
{(p?._availabilityLabel || p?._typeLabel) ? (
  <div className="mb-2 flex flex-wrap items-center gap-2">
    {p?._availabilityLabel ? (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15">
        {p._availabilityLabel}{p?._leadTimeLabel && !p?._isStock ? ` • ${p._leadTimeLabel}` : ""}
      </span>
    ) : null}
    {p?._typeLabel ? (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15">
        {p._typeLabel}
      </span>
    ) : null}
  </div>
) : null}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold tracking-tight text-sm sm:text-base leading-snug break-words min-w-0 flex-1">
            {p.nome}
          </h3>

          {/* Link de detalhes (SEO + compartilhamento) */}
          {p?.slug ? (
            <a
              href={`/p/${p.slug}`}
              className="text-xs font-semibold text-teal-300 hover:text-teal-200 underline underline-offset-4 shrink-0"
              aria-label={`Abrir página de ${p.nome}`}
              title="Abrir página do produto"
            >
              detalhes
            </a>
          ) : null}
        </div>

        {/* Preços (promo com riscado) */}
        <div className="mt-2 flex items-center justify-start gap-2 flex-wrap">
          {pricing.showStrike && originalPrice > currentPrice ? (
            <>
              <span className="text-xs text-slate-300 line-through opacity-80">{fmtBRL(originalPrice)}</span>
              <span className="text-base sm:text-lg font-black text-emerald-300">{fmtBRL(currentPrice)}</span>
              {off > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400 text-black ring-4 ring-emerald-400/20">
                  -{off}%
                </span>
              )}
            </>
          ) : (
            <span className="text-base sm:text-lg font-extrabold text-slate-100">{fmtBRL(currentPrice)}</span>
          )}
        </div>

        {hasVariants && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">Escala / Preço</label>
            <select
              className="mt-1 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-xs sm:text-sm"
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

        {/* Em 2 colunas no mobile, empilhar botões evita texto quebrando/overlap */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ring-4 ring-teal-400/20 transition ${
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
            className={`rounded-lg px-3 py-2 text-sm ring-1 ring-white/15 ${
              outOfStock ? "bg-slate-800 text-slate-400 cursor-not-allowed" : "hover:bg-white/5"
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
