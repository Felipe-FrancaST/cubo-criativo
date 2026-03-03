import React from "react";
import { fmtBRL, centsToBRL, getVariantPricingCents, percentOffCents } from "../lib/pricing.js";

export default function ProductPage({ slug, product, loading, onBack, addToCart, buyNow, openGallery }) {
  const [imgError, setImgError] = React.useState(false);
  const defaultIndex = Math.max(0, product?.variants?.findIndex((v) => v.label === product.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);

  React.useEffect(() => {
    setSelIndex(defaultIndex);
  }, [defaultIndex, slug]);

  if (loading) {
    return (
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-2xl bg-slate-900/60 ring-1 ring-white/10 p-6">
            <p className="text-slate-300">Carregando produto…</p>
          </div>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-2xl bg-slate-900/60 ring-1 ring-white/10 p-6">
            <h1 className="text-xl font-black">Produto não encontrado</h1>
            <p className="mt-2 text-slate-300">O link pode estar errado ou o produto foi removido.</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 rounded-lg px-4 py-2 bg-teal-400 text-black font-semibold ring-4 ring-teal-400/20"
            >
              Voltar
            </button>
          </div>
        </section>
      </main>
    );
  }

  const outOfStock = typeof product?.stock === "number" && Number.isFinite(product.stock) && product.stock <= 0;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const pricing = getVariantPricingCents(product, selIndex, defaultIndex);
  const escala = pricing.sel?.label ?? product.escala ?? "";
  const currentPrice = centsToBRL(pricing.currentCents);
  const originalPrice = centsToBRL(pricing.originalCents);
  const off = percentOffCents(pricing.originalCents, pricing.currentCents);

  return (
    <main className="flex-1">
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg px-3 py-2 ring-1 ring-white/15 hover:bg-white/5"
          >
            ← voltar
          </button>

          <a
            href="/catalogo"
            className="text-sm text-slate-300 hover:text-slate-100 underline underline-offset-4"
          >
            ver catálogo
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl overflow-hidden bg-slate-900/60 ring-1 ring-white/10">
            <div
              role="button"
              tabIndex={0}
              className="aspect-square bg-slate-900/40 p-3 sm:p-4 grid place-items-center overflow-hidden w-full relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400/40"
              onClick={() => openGallery?.(product)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openGallery?.(product);
                }
              }}
              aria-label={`Ver fotos de ${product.nome}`}
            >
              {!imgError ? (
                <img
                  src={product.img}
                  alt={product.nome}
                  loading="eager"
                  decoding="async"
                  className="object-contain w-full h-full rounded-2xl bg-slate-950/20 ring-1 ring-white/10"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="text-slate-300 text-xs px-3 text-center">Imagem indisponível.</div>
              )}

              <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 ring-1 ring-white/20">
                ver fotos
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 ring-1 ring-white/10 p-6">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">{product.nome}</h1>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {pricing.showStrike && originalPrice > currentPrice ? (
                <>
                  <span className="text-sm text-slate-300 line-through opacity-80">{fmtBRL(originalPrice)}</span>
                  <span className="text-2xl font-black text-emerald-300">{fmtBRL(currentPrice)}</span>
                  {off > 0 ? (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400 text-black ring-4 ring-emerald-400/20">
                      -{off}%
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-2xl font-black text-slate-100">{fmtBRL(currentPrice)}</span>
              )}

              {outOfStock ? (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-300 ring-1 ring-white/10">
                  esgotado
                </span>
              ) : null}
            </div>

            {product?.descricao ? (
              <p className="mt-4 text-slate-200 leading-relaxed whitespace-pre-line">{product.descricao}</p>
            ) : (
              <p className="mt-4 text-slate-300">
                Miniatura em resina com pintura artística. Peça colecionável com envio para todo o Brasil.
              </p>
            )}

            {hasVariants ? (
              <div className="mt-5">
                <label className="text-sm text-slate-300">Escala / Preço</label>
                <select
                  className="mt-2 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-3 text-base"
                  value={selIndex}
                  onChange={(e) => setSelIndex(Number(e.target.value))}
                >
                  {product.variants.map((v, i) => (
                    <option key={v.label} value={i}>
                      {v.label} — {fmtBRL(centsToBRL(getVariantPricingCents(product, i, defaultIndex).currentCents))}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-300">Resina Premium</p>
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => addToCart?.(product, { escala, unitPrice: currentPrice })}
                className={`rounded-lg px-4 py-3 font-semibold ring-4 ring-teal-400/20 transition min-h-[44px] ${
                  outOfStock ? "bg-slate-800 text-slate-400 cursor-not-allowed ring-white/10" : "bg-teal-400 text-black"
                }`}
              >
                {outOfStock ? "Esgotado" : "Adicionar ao carrinho"}
              </button>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => buyNow?.(product, { escala, unitPrice: currentPrice })}
                className={`rounded-lg px-4 py-3 ring-1 ring-white/15 min-h-[44px] ${
                  outOfStock ? "bg-slate-800 text-slate-400 cursor-not-allowed" : "hover:bg-white/5"
                }`}
              >
                {outOfStock ? "Esgotado" : "Comprar agora"}
              </button>
            </div>

            {Array.isArray(product?.tags) && product.tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {product.tags.slice(0, 12).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-semibold px-2 py-1 rounded-full bg-black/40 ring-1 ring-white/10 text-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
