import React from "react";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function percentOff(original, current) {
  if (!(original > 0) || !(current > 0) || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

/**
 * Card especial para promoções.
 * Mostra preço antigo riscado, preço atual em destaque e um selo chamativo.
 */
export default function PromoProductCard({ p, addToCart, buyNow, openViewer, openGallery }) {
  const defaultIndex = Math.max(0, p.variants?.findIndex((v) => v.label === p.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [addedFlash, setAddedFlash] = React.useState(false);
  const flashT = React.useRef(null);

  React.useEffect(() => () => clearTimeout(flashT.current), []);

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const sel = hasVariants ? p.variants[selIndex] : null;
  const currentPrice = sel?.price ?? p.preco ?? 0;
  const escala = sel?.label ?? p.escala ?? "";
  const original = p.originalPrice ?? 0;
  const off = percentOff(original, currentPrice);

  function handleAdd() {
    addToCart(p, { escala, unitPrice: currentPrice });
    setAddedFlash(true);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setAddedFlash(false), 900);
  }

  return (
    <article className="w-full max-w-[340px] group rounded-3xl overflow-hidden ring-2 ring-amber-400/35 bg-gradient-to-b from-amber-500/15 via-slate-900/70 to-slate-950/80 hover:ring-amber-400/60 transition shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      {/* Imagem */}
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
          className="object-cover w-full h-full group-hover:scale-[1.03] transition"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("bg-slate-700");
            e.currentTarget.parentElement.innerHTML =
              `<div class="text-slate-300 text-xs px-3 text-center">Imagem não encontrada.<br/>Verifique a URL no Supabase (image_url).</div>`;
          }}
        />

        {/* Selos */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-amber-400 text-black ring-4 ring-amber-400/25 shadow">
            PROMO
          </span>
          {off > 0 && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-emerald-400 text-black ring-4 ring-emerald-400/25 shadow">
              -{off}%
            </span>
          )}
        </div>

        <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/55 ring-1 ring-white/20">
          ver fotos
        </span>
      </button>

      <div className="p-5">
        <h3 className="font-extrabold tracking-tight text-center lg:text-left text-lg">{p.nome}</h3>

        {/* Preços */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {original > 0 && original > currentPrice ? (
              <div className="text-xs text-slate-300">
                <span className="line-through opacity-80">{fmtBRL(original)}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Oferta especial</div>
            )}
            <div className="text-2xl font-black text-amber-300 leading-none">{fmtBRL(currentPrice)}</div>
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
              className="mt-1 w-full rounded-xl bg-slate-900/60 ring-1 ring-white/10 px-3 py-2 text-sm"
              value={selIndex}
              onChange={(e) => setSelIndex(Number(e.target.value))}
            >
              {p.variants.map((v, i) => (
                <option key={v.label} value={i}>
                  {v.label} — {fmtBRL(v.price)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            className={`rounded-xl px-3 py-2 font-extrabold ring-4 ring-amber-400/20 ${
              addedFlash ? "bg-emerald-400 text-black" : "bg-amber-400 text-black"
            } transition`}
            title="Adicionar ao carrinho"
          >
            {addedFlash ? "Adicionado!" : "Adicionar"}
          </button>
          <button
            onClick={() => buyNow(p, { escala, unitPrice: currentPrice })}
            className="rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 font-semibold"
            title="Comprar agora"
          >
            Comprar
          </button>
        </div>

        {p.model && (
          <button
            onClick={() => openViewer?.(p.model, p.nome)}
            className="mt-2 w-full rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm"
          >
            Ver em 3D
          </button>
        )}
      </div>
    </article>
  );
}
