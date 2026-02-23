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
  onPaymentConfirmed,
  onPayWithCoupon
}) {
  // Pix state
  const [pix, setPix] = React.useState(null);
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixStatus, setPixStatus] = React.useState("pending");
  const [checkingPix, setCheckingPix] = React.useState(false);
  const payHandled = React.useRef(false);
  const [pixLoginMsg, setPixLoginMsg] = React.useState("");
  const [pixNotice, setPixNotice] = React.useState(null); // { type, message }
  const [copyToast, setCopyToast] = React.useState(null); // { type: 'success'|'error', message: string }
  const copyToastTimer = React.useRef(null);
  const [couponCode, setCouponCode] = React.useState('');
  const [couponInfo, setCouponInfo] = React.useState(null);
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [couponMsg, setCouponMsg] = React.useState('');
  const hasValidSubtotal = Number.isFinite(Number(subtotal)) && Number(subtotal) > 0;
  const hasCartItems = Array.isArray(cart) && cart.length > 0;
  const canCheckout = hasCartItems && hasValidSubtotal;


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


  React.useEffect(() => {
    if (!couponInfo) return;
    applyCoupon(couponInfo.code, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  React.useEffect(() => {
    if (canCheckout) return;
    if (couponInfo) setCouponInfo(null);
    if (couponMsg) setCouponMsg('');
  }, [canCheckout]);

  async function applyCoupon(codeParam, opts = {}) {
    const code = String(codeParam ?? couponCode).trim().toUpperCase();
    if (!code) {
      setCouponInfo(null);
      setCouponMsg('');
      return;
    }
    if (!authToken) {
      onRequireLogin?.();
      if (!opts.silent) setCouponMsg('Faça login para usar cupom.');
      return;
    }
    if (!canCheckout) {
      setCouponInfo(null);
      if (!opts.silent) setCouponMsg('Adicione itens válidos ao carrinho antes de aplicar cupom.');
      return;
    }
    try {
      setCouponLoading(true);
      const res = await fetch('/api/coupons?action=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code, subtotal: Number(Number(subtotal).toFixed(2)) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Cupom inválido');
      setCouponInfo({ code, discount: Number(data.discount || 0), final_total: Number(data.final_total || subtotal), label: data.label || data?.coupon?.label || code });
      setCouponCode(code);
      if (!opts.silent) setCouponMsg('Cupom aplicado!');
    } catch (e) {
      const msg = String(e?.message || e);
      if (!opts.silent) setCouponMsg(msg);
      if (shouldOpenProfileForError(msg)) {
        onRequireProfile?.();
      }
      setCouponInfo(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function shouldOpenProfileForError(message) {
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    if (/(já utilizado|ja utilizado|cupom.*utilizado|cpf.*já usou|cpf.*ja usou|já usado|ja usado)/i.test(msg)) return false;
    return /(complete seu perfil|completar perfil|perfil incompleto|cadastro incompleto|informe seu cpf|cpf obrigatório|cpf obrigatorio|cpf inválido|cpf invalido|sem cpf|perfil.*cpf)/i.test(msg);
  }

  function removeCoupon() {
    setCouponInfo(null);
    setCouponMsg('Cupom removido.');
  }

  function showPixNotice(message, type = "error", ms = 3800) {
    setPixNotice({ type, message });
    window.clearTimeout(showPixNotice._t);
    showPixNotice._t = window.setTimeout(() => setPixNotice(null), ms);
  }

  async function handlePix() {
    try {
      setPixNotice(null);
      if (pixLoading || !canCheckout) {
        showPixNotice('Não foi possível calcular o valor do pedido. Atualize o carrinho e tente novamente.', 'error', 4200);
        return;
      }

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
          amount: Number(Number((couponInfo?.final_total ?? subtotal)).toFixed(2)),
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
          coupon_code: couponInfo?.code || null,
        }),
      });

      const rawText = await res.text();
      let parsedResp = {};
      try { parsedResp = JSON.parse(rawText || '{}'); } catch {}
      if (!res.ok) {
        const errMsg = parsedResp?.error?.message || parsedResp?.error || parsedResp?.message || rawText || 'Erro ao gerar Pix';
        if (shouldOpenProfileForError(String(errMsg))) onRequireProfile?.();
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }
      const data = parsedResp && Object.keys(parsedResp).length ? parsedResp : JSON.parse(rawText || '{}');

      if (!data?.qr_code && !data?.qr_code_base64) {
        throw new Error("Pix gerado, mas sem QR Code retornado.");
      }

      setPix(data);
      payHandled.current = false;
      setPixStatus(data?.status ? (data.status === "approved" ? "paid" : "pending") : "pending");
      setPixOpen(true);
    } catch (e) {
      let msg = e?.message || String(e);
      try {
        const parsed = JSON.parse(msg);
        msg = parsed?.error || parsed?.message || msg;
      } catch {}
      if (typeof msg === "string" && msg.includes("transaction_amount must be positive")) {
        msg = "Esse cupom deixou o valor do pedido inválido para Pix. Ajuste o cupom ou adicione mais itens.";
      }
      if (typeof msg === "string" && shouldOpenProfileForError(msg)) onRequireProfile?.();
      showPixNotice(msg, "error", 5200);
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
      const res = await fetch("/api/pix-payment?action=verify", {
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
            <span className="font-semibold">{hasValidSubtotal ? fmtBRL(Number(subtotal)) : "Definir preços"}</span>
          </div>

          <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300 font-semibold">Cupom</label>
              {couponInfo ? <button onClick={removeCoupon} className="text-xs text-rose-300 hover:text-rose-200">Remover</button> : null}
            </div>
            <div className="flex gap-2">
              <input value={couponCode} onChange={(e)=>setCouponCode(e.target.value.toUpperCase())} placeholder="CUBO-XXXX" className="flex-1 rounded-lg bg-slate-900/70 ring-1 ring-white/10 px-3 py-2 text-sm" />
              <button onClick={()=>applyCoupon()} disabled={couponLoading || !canCheckout} className="rounded-lg px-3 py-2 text-sm font-semibold bg-white/10 ring-1 ring-white/15 disabled:opacity-50">{couponLoading ? '...' : 'Aplicar'}</button>
            </div>
            {couponInfo && canCheckout && (
              <div className="text-xs rounded-lg bg-emerald-500/10 ring-1 ring-emerald-400/20 p-2 text-emerald-200">
                {couponInfo.label || couponInfo.code} • desconto {fmtBRL(couponInfo.discount)} • total {fmtBRL(couponInfo.final_total)}
              </div>
            )}
            {couponMsg && <div className="text-xs text-slate-300">{couponMsg}</div>}
          </div>

          {couponInfo && canCheckout && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total com cupom</span>
              <span className="font-semibold text-emerald-300">{fmtBRL(couponInfo.final_total)}</span>
            </div>
          )}

          <button
            onClick={() => (onPayWithCoupon ? onPayWithCoupon(couponInfo) : onPay?.())}
            disabled={paying || !canCheckout}
            className={`w-full text-center rounded-lg px-4 py-3 font-semibold ring-1 ring-white/10 transition \
              ${paying || !canCheckout
                ? "bg-slate-700/50 text-slate-300 cursor-not-allowed"
                : "bg-indigo-500 hover:bg-indigo-400 text-white"}`}
            title={!canCheckout ? "Defina os preços dos produtos antes de pagar." : ""}
          >
            {paying ? "Abrindo pagamento…" : "Pagar com cartão"}
          </button>

          {pixLoginMsg && (
            <div className="rounded-full bg-emerald-500 text-black font-semibold px-4 py-2 shadow-lg ring-4 ring-emerald-400/30 text-center text-sm">
              {pixLoginMsg}
            </div>
          )}

          {pixNotice && (
            <div
              className={`rounded-xl px-3 py-2 text-sm ring-1 flex items-start gap-2 ${
                pixNotice.type === "success"
                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                  : "bg-rose-500/10 text-rose-200 ring-rose-400/20"
              }`}
              role="alert"
              aria-live="assertive"
            >
              <span className="material-icons text-base mt-[1px]">
                {pixNotice.type === "success" ? "check_circle" : "error_outline"}
              </span>
              <p className="leading-tight">{pixNotice.message}</p>
            </div>
          )}

          <button
            onClick={handlePix}
            disabled={pixLoading || !canCheckout}
            className={`w-full rounded-lg px-4 py-3 font-semibold transition ${
              pixLoading || !canCheckout
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