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
  userId,
  userEmail,
  onRequireLogin,
  onRequireProfile,
  onOpenOrders,
  onPaymentConfirmed
}) {
  // Pix state
  const [pix, setPix] = React.useState(null);
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixStatus, setPixStatus] = React.useState("pending");
  const [checkingPix, setCheckingPix] = React.useState(false);
  const payHandled = React.useRef(false);
  const [pixLoginMsg, setPixLoginMsg] = React.useState("");
  const [copyToast, setCopyToast] = React.useState(null); // { type: 'success'|'error', message: string }
  const copyToastTimer = React.useRef(null);

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
      setPixLoginMsg("");
      setCopyToast(null);
      if (copyToastTimer.current) {
        window.clearTimeout(copyToastTimer.current);
        copyToastTimer.current = null;
      }
      payHandled.current = false;
    }
  }, [open]);

  // enquanto o modal do Pix estiver aberto, verifica automaticamente o status do pedido
  React.useEffect(() => {
    if (!pixOpen || !pix?.order_id) return;
    let stopped = false;

    // checa já ao abrir
    checkPixStatus({ forceVerify: false });

    const t = setInterval(() => {
      if (stopped) return;
      checkPixStatus({ forceVerify: false });
    }, 6000);

    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [pixOpen, pix?.order_id]);


  async function handlePix() {
    try {
      if (pixLoading || cart.length === 0 || !(subtotal > 0)) return;

      if (!authToken) {
        onRequireLogin?.();
        setPixLoginMsg("Faça login para gerar o Pix.");
        window.clearTimeout(handlePix._t);
        handlePix._t = window.setTimeout(() => setPixLoginMsg(""), 2800);
        return;
      }

      // Antes de gerar o Pix, exigimos que o cliente complete os dados pessoais
      // (endereço + CPF + nascimento). No cadastro eles podem ficar em branco,
      // mas aqui é obrigatório para finalizar o pedido.
      const payerEmail = String(userEmail || "").trim();
      if (!payerEmail || !payerEmail.includes("@")) {
        onRequireProfile?.();
        setPixLoginMsg("Complete seu perfil (incluindo e-mail) antes de pagar.");
        window.clearTimeout(handlePix._t);
        handlePix._t = window.setTimeout(() => setPixLoginMsg(""), 3200);
        return;
      }

      // busca profile no Supabase (client) para validar campos obrigatórios
      let prof = null;
      try {
        if (userId) {
          const { data } = await supabase
            .from("profiles")
            .select("full_name, phone, cpf, birthdate, address_line1, address_number, neighborhood, city, state, zip")
            .eq("id", userId)
            .single();
          prof = data || null;
        }
      } catch {
        // ignore
      }

      const missing = [];
      const v = (x) => String(x || "").trim();
      if (!prof) {
        missing.push("perfil");
      } else {
        if (!v(prof.full_name)) missing.push("nome");
        if (!v(prof.phone)) missing.push("telefone");
        if (v(prof.cpf).replace(/\D/g, "").length !== 11) missing.push("CPF");
        if (!v(prof.birthdate)) missing.push("data de nascimento");
        if (v(prof.zip).replace(/\D/g, "").length !== 8) missing.push("CEP");
        if (!v(prof.city)) missing.push("cidade");
        if (v(prof.state).length !== 2) missing.push("UF");
        if (!v(prof.neighborhood)) missing.push("bairro");
        if (!v(prof.address_line1)) missing.push("rua");
        if (!v(prof.address_number)) missing.push("número");
      }

      if (missing.length) {
        onRequireProfile?.();
        setPixLoginMsg(`Complete seus dados antes de pagar: ${missing.join(", ")}.`);
        window.clearTimeout(handlePix._t);
        handlePix._t = window.setTimeout(() => setPixLoginMsg(""), 4500);
        return;
      }

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
      payHandled.current = false;
      setPixStatus(data?.status ? (data.status === "approved" ? "paid" : "pending") : "pending");
      setPixOpen(true);
    } catch (e) {
      alert("Não foi possível gerar o Pix: " + (e?.message || String(e)));
    } finally {
      setPixLoading(false);
      payHandled.current = false;
    }
  }


  async function checkPixStatus({ forceVerify = false } = {}) {
    try {
      if (!pix?.order_id) return;
      setCheckingPix(true);      // 1) Checa no Supabase (rápido)
      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .select("status")
        .eq("id", pix.order_id)
        .maybeSingle();

      if (!orderErr && orderRow?.status) {
        setPixStatus(orderRow.status);
        if (orderRow.status === "paid") {
          if (!payHandled.current) {
            payHandled.current = true;
            onPaymentConfirmed?.();
          }
          return;
        }
      }

      if (!forceVerify) return;

      // 2) Força verificação no Mercado Pago (caso o webhook ainda não tenha atualizado)
      const res = await fetch("/api/verify-pix-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ order_id: pix.order_id }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error?.message || payload?.error || "Não foi possível verificar o Pix.";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      if (payload?.status) setPixStatus(payload.status);
      if (payload?.paid) {
        if (!payHandled.current) {
          payHandled.current = true;
          onPaymentConfirmed?.();
        }
      }
    } catch (e) {    } finally {
      setCheckingPix(false);
    }
  }

  function copyPix() {
    const code = pix?.qr_code || "";
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopyToast({ type: "success", message: "Código Pix copiado!" });
        if (copyToastTimer.current) window.clearTimeout(copyToastTimer.current);
        copyToastTimer.current = window.setTimeout(() => setCopyToast(null), 2400);
      })
      .catch(() => {
        setCopyToast({ type: "error", message: "Não foi possível copiar. Copie manualmente." });
        if (copyToastTimer.current) window.clearTimeout(copyToastTimer.current);
        copyToastTimer.current = window.setTimeout(() => setCopyToast(null), 3200);
      });
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

          {pixLoginMsg && (
            <div className="rounded-full bg-emerald-500 text-black font-semibold px-4 py-2 shadow-lg ring-4 ring-emerald-400/30 text-center text-sm">
              {pixLoginMsg}
            </div>
          )}

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
                  onClick={() => { setPixOpen(false); payHandled.current = false; }}
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

              <button
                className="w-full mt-3 rounded-lg px-4 py-3 bg-white/10 ring-1 ring-white/15 text-white"
                onClick={copyPix}
                disabled={!pix?.qr_code}
                title={!pix?.qr_code ? "Código Pix não disponível" : ""}
              >
                Copiar código Pix
              </button>

              {copyToast && (
                <div
                  className={`mt-2 rounded-lg px-3 py-2 text-sm ring-1 flex items-start gap-2 ${
                    copyToast.type === "success"
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                      : "bg-rose-500/10 text-rose-200 ring-rose-400/20"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="material-icons text-base mt-[1px]">
                    {copyToast.type === "success" ? "check_circle" : "error_outline"}
                  </span>
                  <p className="leading-tight">{copyToast.message}</p>
                </div>
              )}

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

              {/* Ação principal */}
              <div className="mt-4">
                {/* Mensagem só quando confirmar */}
                {pixStatus === "paid" && (
                  <p className="mb-3 text-sm text-emerald-200">
                    Pagamento confirmado! Pedido finalizado ✅
                  </p>
                )}

                <button
                  className={`w-full rounded-lg px-4 py-3 font-semibold ring-1 transition disabled:opacity-50 ${
                    pixStatus === "paid"
                      ? "bg-emerald-400 text-black ring-emerald-400/30 hover:bg-emerald-300"
                      : "bg-white/10 text-white ring-white/15 hover:bg-white/15"
                  }`}
                  onClick={() => {
                    if (pixStatus === "paid") {
                      onPaymentConfirmed?.();
                      setPixOpen(false);                      onClose?.();
                      onOpenOrders?.();
                      return;
                    }
                    checkPixStatus({ forceVerify: true });
                  }}
                  disabled={checkingPix || !authToken || !pix?.order_id}
                >
                  {pixStatus === "paid"
                    ? "Pagamento confirmado ✅"
                    : checkingPix
                    ? "Verificando…"
                    : "Já paguei"}
                </button>

                {pixStatus !== "paid" && (
                  <p className="mt-2 text-xs text-slate-400">
                    A confirmação pode levar alguns instantes. Se você já pagou, toque em “Já paguei”.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}