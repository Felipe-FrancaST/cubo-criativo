import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";
import brand from "../data/config.js";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function trackUrl(code) {
  const c = String(code || "").trim();
  if (!c) return "";
  // Correios (funciona para a maioria dos envios no BR)
  return `https://www2.correios.com.br/sistemas/rastreamento/default.cfm?objeto=${encodeURIComponent(c)}`;
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
}

export default function OrdersModal({ open, onClose }) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token || "";
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [cancelModal, setCancelModal] = React.useState({
    open: false,
    order: null,
    // full: reembolso integral (status recebido)
    // partial: reembolso 50% (status != recebido)
    // info: apenas informativo
    mode: "full",
    // confirm | processing | success | info
    step: "confirm",
    busy: false,
    msg: "",
  });


  const statusUI = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid") {
      return {
        label: "Pago",
        cls: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
      };
    }
    if (s === "failed" || s === "canceled" || s === "cancelled" || s === "rejected") {
      return {
        label: "Falhou",
        cls: "bg-red-500/15 text-red-200 ring-red-500/30",
      };
    }
    return {
      label: "Pendente",
      cls: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
    };
  };

  const prodUI = (status) => {
    const s = String(status || "recebido").toLowerCase();
    if (s === "em_producao") {
      return { label: "Em produção", cls: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/30" };
    }
    if (s === "pronto") {
      return { label: "Pronto", cls: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30" };
    }
    if (s === "enviado") {
      return { label: "Enviado", cls: "bg-amber-500/15 text-amber-200 ring-amber-400/30" };
    }
    if (s === "entregue") {
      return { label: "Entregue", cls: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" };
    }
    if (s === "cancelado") {
      return { label: "Cancelado", cls: "bg-red-500/15 text-red-200 ring-red-500/30" };
    }
    if (s === "reembolsado") {
      return { label: "Reembolsado", cls: "bg-teal-500/15 text-teal-200 ring-teal-400/30" };
    }
    return { label: "Recebido", cls: "bg-white/5 text-slate-200 ring-white/15" };
  };


  function closeCancel() {
    setCancelModal({ open: false, order: null, mode: "full", step: "confirm", busy: false, msg: "" });
  }

  async function openCancel(order) {
    const prod = String(order?.production_status || "recebido").toLowerCase();
    if (prod === "reembolsado") {
      setCancelModal({
        open: true,
        order,
        mode: "info",
        step: "info",
        busy: false,
        msg: "Este pedido já foi reembolsado.",
      });
      return;
    }
    if (prod === "cancelado") {
      setCancelModal({
        open: true,
        order,
        mode: "info",
        step: "info",
        busy: false,
        msg: "Este pedido já está cancelado.",
      });
      return;
    }

    // Se for "Recebido": cancela imediatamente e mostra mensagem de reembolso integral
    if (prod === "recebido") {
      setCancelModal({ open: true, order, mode: "full", step: "processing", busy: true, msg: "" });
      await doCancel(order, { confirm: true, mode: "full" });
      return;
    }

    // Qualquer outro status: informa que já está em produção e pede confirmação
    setCancelModal({
      open: true,
      order,
      mode: "partial",
      step: "confirm",
      busy: false,
      msg: "",
    });
  }

  async function doCancel(order, opts = {}) {
    if (!order?.id) return;
    const mode = opts?.mode === "partial" ? "partial" : "full";
    const confirm = !!opts?.confirm;
    setCancelModal((s) => ({ ...s, busy: true, msg: "" }));
    try {
      const resp = await fetch("/api/cancel-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id, confirm, refund_mode: mode }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data?.error || "Não foi possível cancelar.";
        setCancelModal((s) => ({ ...s, busy: false, msg, step: s.step || "confirm" }));
        return;
      }
      // atualiza lista local
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, production_status: data?.order?.production_status || "cancelado", status: data?.order?.status || o.status } : o))
      );

      const successMsg =
        mode === "full"
          ? "Pedido cancelado. Seu reembolso será processado de forma integral."
          : "Pedido cancelado. Como o pedido já está em produção, o reembolso será de 50% do valor para cobrir custos do processo.";

      setCancelModal((s) => ({
        ...s,
        busy: false,
        step: "success",
        msg: successMsg,
        order: s.order
          ? {
              ...s.order,
              production_status: data?.order?.production_status || "cancelado",
              status: data?.order?.status || s.order.status,
            }
          : s.order,
      }));
    } catch (e) {
      console.error(e);
      setCancelModal((s) => ({ ...s, busy: false, msg: "Erro ao cancelar. Tente novamente." }));
    }
  }

  const fetchOrders = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    // 1) Carrega pedidos (sem join) para evitar erro de relationship no schema cache
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("id, status, total, payment_provider, provider_payment_id, created_at, production_status, shipping_tracking")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      setLoading(false);
      setError(ordersErr?.message || "Não foi possível carregar seus pedidos.");
      return;
    }

    const list = Array.isArray(ordersData) ? ordersData : [];
    if (list.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // 2) Carrega itens em batch
    const ids = list.map((o) => o.id);
    let itemsData = [];
    let itemsErr = null;

    // Primeiro tenta schema novo (snapshot em cents)
    const attemptNew = await supabase
      .from("order_items")
      .select("order_id, product_id, product_name, qty, unit_price_cents, scale, product_image_url")
      .in("order_id", ids);

    if (attemptNew?.error) {
      // Fallback para schema antigo
      const attemptOld = await supabase
        .from("order_items")
        .select("order_id, product_id, name, qty, unit_price, scale, img")
        .in("order_id", ids);

      itemsData = attemptOld?.data || [];
      itemsErr = attemptOld?.error || null;
    } else {
      itemsData = attemptNew?.data || [];
      itemsErr = null;
    }

    if (itemsErr) {
      setLoading(false);
      setError(itemsErr?.message || "Não foi possível carregar seus pedidos.");
      return;
    }

    const byOrder = new Map();
    (itemsData || []).forEach((it) => {
      const k = it.order_id;
      if (!byOrder.has(k)) byOrder.set(k, []);
      // Normaliza campos entre schema novo e antigo
      byOrder.get(k).push({
        order_id: it.order_id,
        product_id: it.product_id || null,
        name: it.product_name || it.name || null,
        qty: it.qty,
        scale: it.scale,
        img: it.product_image_url || it.img || null,
      });
    });

    let merged = list.map((o) => ({
      ...o,
      order_items: byOrder.get(o.id) || [],
    }));

    // 3) Preenche nome/imagem a partir da tabela products (para pedidos antigos)
    try {
      const missing = [];
      merged.forEach((o) => {
        (o.order_items || []).forEach((it) => {
          if ((!it.name || !it.img) && it.product_id) missing.push(String(it.product_id));
        });
      });

      const uniq = Array.from(new Set(missing)).slice(0, 100);
      if (uniq.length) {
        const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
        const uuids = uniq.filter(isUuid);
        const slugs = uniq.filter((x) => !isUuid(x));

        const results = [];
        if (uuids.length) {
          const r1 = await supabase
            .from("products")
            .select("id,name,image_url,images,slug")
            .in("id", uuids);
          if (!r1.error) results.push(...(r1.data || []));
        }
        if (slugs.length) {
          const r2 = await supabase
            .from("products")
            .select("id,name,image_url,images,slug")
            .in("slug", slugs);
          if (!r2.error) results.push(...(r2.data || []));
        }

        const byIdOrSlug = new Map();
        results.forEach((p) => {
          if (p?.id) byIdOrSlug.set(String(p.id), p);
          if (p?.slug) byIdOrSlug.set(String(p.slug), p);
        });

        merged = merged.map((o) => ({
          ...o,
          order_items: (o.order_items || []).map((it) => {
            if (it.name && it.img) return it;
            const p = it.product_id ? byIdOrSlug.get(String(it.product_id)) : null;
            if (!p) return it;
            const img = it.img || p.image_url || (Array.isArray(p.images) ? p.images[0] : null);
            return {
              ...it,
              name: it.name || p.name,
              img,
            };
          }),
        }));
      }
    } catch {
      // ignore
    }

    setOrders(merged);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    if (!open || !user) return;
    let cancel = false;

    async function run() {
      try {
        await fetchOrders();
      } catch {
        // ignore
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [open, user, fetchOrders]);
  return (
    <>
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">Meus pedidos</h3>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={fetchOrders}
                className="rounded-lg px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5"
                disabled={loading}
                title="Atualizar"
              >
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/5"
              aria-label="Fechar"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {!user && (
          <p className="mt-4 text-slate-300">Faça login para ver seus pedidos.</p>
        )}

        {user && (
          <div className="mt-4">
            {loading && <p className="text-slate-300">Carregando…</p>}
            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {!loading && !error && orders.length === 0 && (
              <p className="text-slate-400">Você ainda não tem pedidos.</p>
            )}

            <div className="space-y-3">
              
{orders.map((o) => (
  <div key={o.id} className="rounded-2xl bg-slate-900 ring-1 ring-white/10 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-slate-400">
          {new Date(o.created_at).toLocaleString("pt-BR")}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${statusUI(o.status).cls}`}
          >
            {statusUI(o.status).label}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${prodUI(o.production_status).cls}`}
            title="Status de produção/envio"
          >
            {prodUI(o.production_status).label}
          </span>
          {o.shipping_tracking ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ring-white/15 bg-white/5 text-slate-200">
                Rastreio: {String(o.shipping_tracking)}
              </span>
              <button
                onClick={() => {
                  const ok = copyToClipboard(o.shipping_tracking);
                  if (!ok) return;
                }}
                className="text-xs rounded-full px-2 py-1 ring-1 ring-white/15 hover:bg-white/5 text-slate-200"
                title="Copiar código"
              >
                Copiar
              </button>
              <a
                href={trackUrl(o.shipping_tracking)}
                target="_blank"
                rel="noreferrer"
                className="text-xs rounded-full px-2 py-1 bg-emerald-400 text-black font-semibold hover:bg-emerald-300"
                title="Abrir rastreio"
              >
                Rastrear
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs text-slate-400">Valor</p>
        <p className="text-lg font-semibold">{fmtBRL(Number(o.total))}</p>
      </div>
    </div>

    {Array.isArray(o.order_items) && o.order_items.length > 0 && (
  <div className="mt-4 rounded-xl bg-white/5 ring-1 ring-white/10">
    <ul className="divide-y divide-white/10">
      {o.order_items.map((it, idx) => (
        <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-center gap-3 min-w-0">
            {it.img ? (
              <img
                src={it.img}
                alt={it.name || "Produto"}
                className="h-10 w-10 rounded-md object-cover ring-1 ring-white/10 bg-slate-800"
                loading="lazy"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-slate-800 ring-1 ring-white/10 grid place-items-center text-slate-400">
                <span className="material-icons text-base">image</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{it.name || "Produto"}</p>
              {it.scale ? (
                <p className="text-xs text-slate-400 truncate">Escala: {it.scale}</p>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-slate-300 shrink-0">{Number(it.qty) || 1}x</p>
        </li>
      ))}
    </ul>
  </div>
)}

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        onClick={() => openCancel(o)}
        className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 text-slate-100"
      >
        Cancelar pedido
      </button>
    </div>
  </div>
))}
            </div>
          </div>
        )}
      </div>
    </Modal>

    <Modal open={cancelModal.open} onClose={cancelModal.busy ? undefined : closeCancel} title="Cancelar pedido">
      <div className="w-full max-w-lg">
        {cancelModal.order ? (
          <div className="text-sm text-slate-200">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="font-semibold break-all">{String(cancelModal.order.id)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${prodUI(cancelModal.order.production_status).cls}`}>
                {prodUI(cancelModal.order.production_status).label}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${statusUI(cancelModal.order.status).cls}`}>
                {statusUI(cancelModal.order.status).label}
              </span>
            </div>

            {/* Conteúdo */}
            {cancelModal.step === "processing" ? (
              <div className="mt-4 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-3">
                <p className="text-slate-200">Cancelando pedido…</p>
              </div>
            ) : null}

            {cancelModal.step === "confirm" && cancelModal.mode === "partial" ? (
              <div className="mt-4 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 px-3 py-3">
                <p className="font-semibold text-amber-200">Atenção</p>
                <p className="mt-1 text-slate-200">
                  Este pedido já está em produção. Se desejar continuar, o reembolso será somente da metade do valor para suprir os custos do processo.
                </p>
              </div>
            ) : null}

            {(cancelModal.step === "success" || cancelModal.step === "info") && cancelModal.msg ? (
              <div className="mt-4 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/30 px-3 py-3">
                <p className="text-slate-100">{cancelModal.msg}</p>
              </div>
            ) : null}

            {cancelModal.msg && cancelModal.step !== "success" && cancelModal.step !== "info" ? (
              <p className="mt-3 text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
                {cancelModal.msg}
              </p>
            ) : null}

            {/* Ações */}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeCancel}
                className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 text-slate-100"
                disabled={cancelModal.busy}
              >
                {cancelModal.step === "success" || cancelModal.step === "info" ? "Fechar" : "Voltar"}
              </button>

              {cancelModal.step === "confirm" && cancelModal.mode === "partial" ? (
                <button
                  onClick={() => doCancel(cancelModal.order, { confirm: true, mode: "partial" })}
                  className="text-sm rounded-xl px-3 py-2 bg-red-500 text-white font-semibold hover:bg-red-400"
                  disabled={cancelModal.busy}
                >
                  {cancelModal.busy ? "Processando…" : "Prosseguir com o Cancelamento"}
                </button>
              ) : null}

              {cancelModal.step === "success" ? (
                <button
                  onClick={closeCancel}
                  className="text-sm rounded-xl px-3 py-2 bg-emerald-400 text-black font-semibold hover:bg-emerald-300"
                >
                  OK
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-slate-300">Pedido não encontrado.</p>
        )}
      </div>
    </Modal>
    </>
  );
}
