import React from "react";
import { supabase } from "../lib/supabaseClient";

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
  authToken,
  userEmail,
  onRequireLogin,,
  onOpenOrders,
}) {
  // Pix state
  const [pix, setPix] = React.useState(null);
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixStatus, setPixStatus] = React.useState(null); // null | pending | paid | failed
  const [pixStatusLoading, setPixStatusLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // fecha modal Pix ao fechar o carrinho
  React.useEffect(() => {
    if (!open) {
      setPixOpen(false);
      setPix(null);
      setPixLoading(false);
      setPixStatus(null);
      setPixStatusLoading(false);
    }
  }, [open]);

  async function handlePix() {
    try {
      if (pixLoading || cart.length === 0 || !(subtotal > 0)) return;

      if (!authToken) {
        onRequireLogin?.();
        alert("Faça login para gerar o Pix.");
        return;
      }

      const payerEmail = String(userEmail || "").trim() ||
        window.prompt(
          "Digite seu e-mail para receber o comprovante (para testes, use: test@testuser.com)"
        );
      if (!payerEmail) return;

      setPixLoading(true);

      const res = await fetch("/api/create-pix-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          origin: window.location.origin,
          amount: Number(Number(subtotal).toFixed(2)),
          email: payerEmail.trim(),
          name: "Cliente",
          items: cart.map((i) => ({
            name: i.nome,
            qty: i.qty,
            price: i.unitPrice,
            scale: i.escala || "",
            img: i.img || "",
            id: i.id,
          })),
          description: "Pagamento via Pix",
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (!data?.qr_code && !data?.qr_code_base64) {
        throw new Error("Pix gerado, mas sem QR Code retornado.");
      }

      setPix(data);
      setPixStatus("pending");
      setPixOpen(true);
    } catch (e) {
      alert("Não foi possível gerar o Pix: " + (e?.message || String(e)));
    } finally {
      setPixLoading(false);
      setPixStatus(null);
      setPixStatusLoading(false);
    }
  }


  async function checkPixPaymentStatus({ silent = false } = {}) {
    if (!pix?.order_id) return;
    try {
      if (!silent) setPixStatusLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("id", pix.order_id)
        .single();

      if (error) throw error;
      const s = String(data?.status || "").toLowerCase();
      if (s) setPixStatus(s);
      return s;
    } catch (e) {
      if (!silent) alert(e?.message || "Não foi possível verificar o status do pagamento.");
      return null;
    } finally {
      if (!silent) setPixStatusLoading(false);
    }
  }

  // Polling automático do status do Pix enquanto o modal estiver aberto
  React.useEffect(() => {
    if (!pixOpen || !pix?.order_id) return;

    let alive = true;

    // primeira checagem
    checkPixPaymentStatus({ silent: true });

    const t = setInterval(async () => {
      if (!alive) return;
      const s = await checkPixPaymentStatus({ silent: true });
      if (s === "paid") {
        clearInterval(t);
      }
    }, 5000);

    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixOpen, pix?.order_id]);
  function copyPix() {
    const code = pix?.qr_code || "";
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => alert("Código Pix copiado!"))
      .catch(() => alert("Não foi possível copiar. Copie manualmente."));
  }

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

          <button
            onClick={handlePix}
            disabled={pixLoading || cart.length === 0 || !(subtotal > 0)}
            className={`w-full rounded-lg px-4 py-3 font-semibold transition ${
              pixLoading || cart.length === 0 || !(subtotal > 0)
                ? "bg-slate-700/50 text-slate-300 cursor-not-allowed"
                : "bg-sky-500 hover:bg-sky-400 text-black"
            }`}
          >
            {pixLoading ? "Gerando Pix…" : "Pagar com Pix"}
          </button>

          <a
            href={`https://wa.me/${brand.whatsapp}?text=${waMsg}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center rounded-lg px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            Finalizar pelo WhatsApp
          </a>
        </div>

        {pixOpen && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 ring-1 ring-white/10 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">Pague com Pix</h4>
                <button
                  onClick={() => setPixOpen(false)}
                  className="rounded-lg p-2 ring-1 ring-white/15"
                  title="Fechar"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>

              {pix?.qr_code_base64 ? (
                <img
                  className="w-full rounded-lg mt-3 bg-white p-2"
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR Code Pix"
                />
              ) : (
                <p className="text-sm text-slate-300 mt-3">
                  QR Code indisponível. Use o código copia-e-cola abaixo.
                </p>
              )}


              <div className="mt-3 rounded-lg ring-1 ring-white/10 bg-slate-800/30 p-3">
                <p className="text-xs text-slate-400">Pedido</p>
                <p className="font-mono text-xs text-slate-200 break-all">{pix?.order_id || "—"}</p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    Status:{" "}
                    <span className="text-slate-200">
                      {pixStatus === "paid"
                        ? "pago ✅"
                        : pixStatus === "failed"
                          ? "falhou"
                          : "aguardando pagamento"}
                    </span>
                  </div>

                  <button
                    onClick={() => checkPixPaymentStatus()}
                    disabled={pixStatusLoading}
                    className="rounded-md px-2 py-1 text-xs bg-white/10 ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-60"
                    title="Verificar agora"
                  >
                    {pixStatusLoading ? "Verificando..." : "Verificar"}
                  </button>
                </div>

                {pixStatus === "paid" ? (
                  <p className="mt-2 text-xs text-emerald-300">
                    Pagamento confirmado! Você já pode ver em <b>Meus pedidos</b>.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Após pagar, a confirmação pode levar alguns instantes (atualiza automaticamente).
                  </p>
                )}
              </div>

              <button
                className="w-full mt-3 rounded-lg px-4 py-3 bg-white/10 ring-1 ring-white/15 text-white"
                onClick={copyPix}
                disabled={!pix?.qr_code}
                title={!pix?.qr_code ? "Código Pix não disponível" : ""}
              >
                Copiar código Pix
              </button>

              {pix?.qr_code && (
                <div className="mt-3">
                  <p className="text-xs text-slate-400 mb-2">Copia e cola:</p>
                  <textarea
                    readOnly
                    value={pix.qr_code}
                    className="w-full h-24 text-xs rounded-lg bg-slate-800/60 ring-1 ring-white/10 p-2 text-slate-200"
                  />
                </div>
              )}

              {pix?.ticket_url && (
                <a
                  href={pix.ticket_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center mt-3 rounded-lg px-4 py-3 bg-white/10 ring-1 ring-white/15 text-white"
                >
                  Abrir link do Pix
                </a>
              )}


              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPixOpen(false);
                    onClose?.();
                    onOpenOrders?.();
                  }}
                  className="rounded-lg px-4 py-3 bg-white/10 ring-1 ring-white/15 text-white hover:bg-white/15"
                >
                  Ver meus pedidos
                </button>

                <button
                  onClick={() => setPixOpen(false)}
                  className="rounded-lg px-4 py-3 bg-white/10 ring-1 ring-white/15 text-white hover:bg-white/15"
                >
                  Continuar comprando
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-3">
                Se a confirmação não aparecer, clique em <b>Verificar</b> ou confira em <b>Meus pedidos</b>.
              </p>

            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
