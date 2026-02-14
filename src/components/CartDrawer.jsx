import React from "react";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

/**
 * Props:
 * - open (bool)
 * - onClose()
 * - cart (array)
 * - updateQty(id, delta, escala, unitPrice)
 * - removeItem(id, escala, unitPrice)
 * - subtotal (number)
 * - brand ({ whatsapp })
 * - waMsg (string já encodeURIComponent)
 */
export default function CartDrawer({
  open,
  onClose,
  cart,
  updateQty,
  removeItem,
  subtotal,
  brand,
  waMsg,
  onPay,
  paying,
}) {
    React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[140] ${open ? "visible" : "invisible"}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full w-[92vw] sm:w-[420px] bg-slate-900 shadow-xl ring-1 ring-white/10 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <h3 className="font-bold">Seu carrinho</h3>
          <button onClick={onClose} className="rounded-lg p-2 ring-1 ring-white/15">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {cart.length === 0 && <p className="text-slate-400 text-sm">Seu carrinho está vazio.</p>}
          {cart.map((item) => (
            <div key={`${item.id}-${item.escala}-${item.unitPrice}`} className="flex gap-3 items-center rounded-lg p-3 ring-1 ring-white/10 bg-slate-800/40">
              <img src={item.img} alt={item.nome} className="h-16 w-16 object-cover rounded-md" />
              <div className="flex-1">
                <p className="font-semibold text-sm leading-tight">{item.nome}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.escala ? `Escala: ${item.escala}` : ""} {item.unitPrice ? `• ${fmtBRL(item.unitPrice)}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => updateQty(item.id, -1, item.escala, item.unitPrice)} className="rounded px-2 ring-1 ring-white/15">-</button>
                  <span className="min-w-[2ch] text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1, item.escala, item.unitPrice)} className="rounded px-2 ring-1 ring-white/15">+</button>
                </div>
              </div>
              <button onClick={() => removeItem(item.id, item.escala, item.unitPrice)} className="text-slate-400 hover:text-white">
                <span className="material-icons">delete</span>
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-semibold">{subtotal > 0 ? fmtBRL(subtotal) : "Definir preços"}</span>
          </div>

          <button
            onClick={onPay}
            disabled={paying || cart.length === 0 || !(subtotal > 0)}
            className={`w-full text-center rounded-lg px-4 py-3 font-semibold ring-1 ring-white/10 transition \
              ${paying || cart.length === 0 || !(subtotal > 0)
                ? "bg-slate-700/50 text-slate-300 cursor-not-allowed"
                : "bg-indigo-500 hover:bg-indigo-400 text-white"}`}
            title={!(subtotal > 0) ? "Defina os preços dos produtos antes de pagar." : ""}
          >
            {paying ? "Abrindo pagamento…" : "Pagar com cartão"}
          </button>

          <a
            href={`https://wa.me/${brand.whatsapp}?text=${waMsg}`}
            target="_blank"
            className="block text-center rounded-lg px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            Finalizar pelo WhatsApp
          </a>
        </div>
      </aside>
    </div>
  );
}
