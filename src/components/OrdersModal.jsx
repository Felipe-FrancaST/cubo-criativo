import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";
import brand from "../data/config.js";
import { trackEvent } from "../lib/analytics.js";

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

function productOrderItemHref(it) {
  const slug = String(it?.slug || "").trim();
  if (slug) return `/p/${encodeURIComponent(slug)}`;
  const key = String(it?.product_id || "").trim();
  if (!key) return "/catalogo";
  return `/catalogo?produto=${encodeURIComponent(key)}`;
}


const CHECKOUT_SESSION_BACKUP_KEY = "cc_checkout_session_backup";

function backupCheckoutSession(session) {
  if (typeof window === "undefined") return;
  const accessToken = String(session?.access_token || "").trim();
  const refreshToken = String(session?.refresh_token || "").trim();
  if (!accessToken || !refreshToken) return;
  try {
    window.localStorage.setItem(
      CHECKOUT_SESSION_BACKUP_KEY,
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Number(session?.expires_at || 0) || 0,
        expires_in: Number(session?.expires_in || 0) || 0,
        token_type: String(session?.token_type || 'bearer') || 'bearer',
      })
    );
  } catch {}
}

function isLikelyPixPaymentId(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /^\d+$/.test(raw);
}

function productionMessage(status, hasTracking) {
  const s = String(status || "recebido").toLowerCase();
  if (s === "em_producao") return "Sua peça já entrou em produção e está sendo preparada com cuidado.";
  if (s === "pronto") return "Seu pedido foi finalizado e está em preparação para envio.";
  if (s === "enviado") return hasTracking ? "Seu pedido foi enviado. Use o código de rastreio para acompanhar a entrega." : "Seu pedido foi enviado e logo o rastreio ficará disponível.";
  if (s === "entregue") return "Seu pedido foi entregue. Esperamos que você aproveite sua peça.";
  if (s === "cancelado") return "Este pedido foi cancelado.";
  if (s === "reembolsado") return "Este pedido foi reembolsado.";
  return "Recebemos seu pedido e ele seguirá para produção assim que a etapa atual for concluída.";
}

export default function OrdersModal({ open, onClose, onPaymentFinalized, onRequireLogin }) {
  const { user, session } = useAuth();


  // Se abrir sem estar logado, padroniza: toast + modal de auth (e fecha este modal)
  React.useEffect(() => {
    if (open && !user) {
      onRequireLogin?.("Faça login para ver seus pedidos.");
      onClose?.();
    }
  }, [open, user]);
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

  const [payModal, setPayModal] = React.useState({
    open: false,
    order: null,
    loading: false,
    checking: false,
    pix: null, // {qr_code, qr_code_base64, ticket_url}
    status: "pending",
    msg: "",
    finalized: false,
  });

  const paidHandledRef = React.useRef(new Set());

  // Quando um Pix vira "paid", devemos:
  // - sumir QR code e mostrar finalizado
  // - fechar a aba (modal)
  // - limpar carrinho (feito no App via callback)
  const finalizePaid = React.useCallback(
    (orderId) => {
      if (!orderId) return;
      // evita duplicar (polling + realtime podem disparar juntos)
      if (paidHandledRef.current.has(orderId)) return;
      paidHandledRef.current.add(orderId);

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "paid" } : o)));
      setPayModal((s) => ({
        ...s,
        status: "paid",
        pix: null,
        msg: "",
        finalized: true,
        checking: false,
        loading: false,
      }));

      // Mostra confirmação por um curto período e então fecha + limpa carrinho
      setTimeout(() => {
        try {
          if (typeof onPaymentFinalized === "function") onPaymentFinalized(orderId);
        } catch {
          // ignore
        }
        try {
          if (typeof onClose === "function") onClose();
        } catch {
          // ignore
        }
        setPayModal((s) => ({ ...s, open: false }));
      }, 1200);
    },
    [onPaymentFinalized, onClose]
  );

  const [reviewsByOrder, setReviewsByOrder] = React.useState({});
  const [expandedOrderId, setExpandedOrderId] = React.useState(null);

  const [reviewModal, setReviewModal] = React.useState({
    open: false,
    order: null,
    rating: 5,
    comment: "",
    submitting: false,
    error: "",
    success: "",
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
      cls: "bg-cyan-400/15 text-cyan-200 ring-amber-400/30",
    };
  };

  const prodUI = (status) => {
    const s = String(status || "recebido").toLowerCase();
    if (s === "em_producao") {
      return { label: "Em produção", cls: "bg-cyan-600/15 text-indigo-200 ring-indigo-400/30" };
    }
    if (s === "pronto") {
      return { label: "Pronto", cls: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30" };
    }
    if (s === "enviado") {
      return { label: "Enviado", cls: "bg-cyan-500/15 text-cyan-200 ring-amber-400/30" };
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
    return { label: "Recebido", cls: "bg-white/4 text-slate-200 ring-white/15" };
  };


  function closeCancel() {
    setCancelModal({ open: false, order: null, mode: "full", step: "confirm", busy: false, msg: "" });
  }

  function closePay() {
    setPayModal({ open: false, order: null, loading: false, checking: false, pix: null, status: "pending", msg: "", finalized: false });
  }

  function closeReview() {
    setReviewModal({ open: false, order: null, rating: 5, comment: "", submitting: false, error: "", success: "" });
  }

  function openReview(order) {
    const existing = reviewsByOrder?.[String(order?.id || "")];
    setReviewModal({
      open: true,
      order,
      rating: Number(existing?.rating) || 5,
      comment: String(existing?.comment || ""),
      submitting: false,
      error: "",
      success: "",
    });
  }

  async function submitReview() {
    const order = reviewModal.order;
    if (!order?.id || !user?.id) return;
    const rating = Math.max(1, Math.min(5, Number(reviewModal.rating) || 5));
    const comment = String(reviewModal.comment || "").trim();
    if (comment.length < 8) {
      setReviewModal((s) => ({ ...s, error: "Escreva um comentário um pouco maior (mínimo 8 caracteres)." }));
      return;
    }

    setReviewModal((s) => ({ ...s, submitting: true, error: "", success: "" }));
    try {
      let profile = null;
      const prof = await supabase
        .from("profiles")
        .select("full_name, city, state")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof.error) profile = prof.data || null;

      const itemNames = Array.isArray(order.order_items)
        ? order.order_items.map((it) => String(it?.name || "").trim()).filter(Boolean)
        : [];

      const payload = {
        order_id: order.id,
        user_id: user.id,
        rating,
        comment,
        display_name: String(profile?.full_name || user?.user_metadata?.full_name || user?.email || "Cliente").slice(0, 80),
        city: String(profile?.city || "").slice(0, 60) || null,
        state: String(profile?.state || "").slice(0, 2).toUpperCase() || null,
        approved: true,
        order_total: Number(order.total) || null,
        product_names: itemNames.length ? itemNames : null,
      };

      const { data, error } = await supabase
        .from("customer_reviews")
        .upsert(payload, { onConflict: "order_id" })
        .select("id, order_id, rating, comment, display_name, city, state, approved, created_at")
        .single();

      if (error) throw error;

      const normalized = {
        id: data?.id,
        order_id: data?.order_id || order.id,
        rating: Number(data?.rating) || rating,
        comment: String(data?.comment || comment),
        display_name: String(data?.display_name || payload.display_name || "Cliente"),
        city: data?.city || payload.city || null,
        state: data?.state || payload.state || null,
        approved: data?.approved !== false,
        created_at: data?.created_at || new Date().toISOString(),
      };

      setReviewsByOrder((prev) => ({ ...prev, [String(order.id)]: normalized }));
      trackEvent("review_submitted", { order_id: order.id, rating });
      setReviewModal((s) => ({ ...s, submitting: false, success: "Avaliação enviada com sucesso!", error: "" }));
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || "");
      setReviewModal((s) => ({
        ...s,
        submitting: false,
        error: msg.includes("customer_reviews") ? "Ative a tabela de avaliações no Supabase (arquivo SQL incluído no projeto)." : (msg || "Não foi possível enviar sua avaliação."),
      }));
    }
  }

  async function openPay(order) {
    if (!order?.id) return;

    // Só faz sentido para pedidos pendentes via Pix
    if (String(order.status || "").toLowerCase() !== "pending") {
      setPayModal({
        open: true,
        order,
        loading: false,
        checking: false,
        pix: null,
        status: String(order.status || "pending"),
        msg: "Este pedido não está pendente.",
      });
      return;
    }

    if (!accessToken) {
      setPayModal({
        open: true,
        order,
        loading: false,
        checking: false,
        pix: null,
        status: "pending",
        msg: "Sessão expirada. Faça login novamente.",
      });
      return;
    }

    setPayModal({ open: true, order, loading: true, checking: false, pix: null, status: "pending", msg: "", finalized: false });

    try {
      const resp = await fetch("/api/pix-payment?action=get", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setPayModal((s) => ({ ...s, loading: false, msg: data?.error || "Não foi possível carregar o Pix." }));
        return;
      }

      setPayModal((s) => ({
        ...s,
        loading: false,
        pix: {
          qr_code: data?.qr_code || "",
          qr_code_base64: data?.qr_code_base64 || "",
          ticket_url: data?.ticket_url || "",
        },
        status: data?.status || "pending",
      }));

      // atualiza lista local caso o status tenha mudado
      if (data?.status) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: data.status } : o)));
      }

      // Se já chegou como pago, finaliza imediatamente.
      if (String(data?.status || "").toLowerCase() === "paid") {
        finalizePaid(order.id);
      }
    } catch (e) {
      console.error(e);
      setPayModal((s) => ({ ...s, loading: false, msg: "Erro ao carregar o Pix. Tente novamente." }));
    }
  }

  async function retryCardPayment(order) {
    if (!order?.id) return;
    if (!accessToken) {
      onRequireLogin?.("Faça login novamente para concluir o pagamento.");
      return;
    }

    try {
      backupCheckoutSession(session);
      setPayModal({
        open: true,
        order,
        loading: true,
        checking: false,
        pix: null,
        status: String(order.status || 'pending'),
        msg: '',
        finalized: false,
      });

      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ retry_order_id: order.id }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.url) {
        throw new Error(data?.error || 'Não foi possível reabrir o pagamento com cartão.');
      }

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setPayModal({
        open: true,
        order,
        loading: false,
        checking: false,
        pix: null,
        status: String(order.status || 'pending'),
        msg: e?.message || 'Não foi possível reabrir o pagamento com cartão.',
        finalized: false,
      });
    }
  }

  async function verifyPay(orderId) {
    if (!orderId || !accessToken) return;
    setPayModal((s) => ({ ...s, checking: true, msg: "" }));
    try {
      const resp = await fetch("/api/pix-payment?action=verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setPayModal((s) => ({ ...s, checking: false, msg: data?.error || "Não foi possível verificar o Pix." }));
        return;
      }
      if (data?.status) {
        setPayModal((s) => ({ ...s, checking: false, status: data.status }));
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: data.status } : o)));

        if (String(data.status).toLowerCase() === "paid") {
          finalizePaid(orderId);
        }
      } else {
        setPayModal((s) => ({ ...s, checking: false }));
      }
    } catch (e) {
      console.error(e);
      setPayModal((s) => ({ ...s, checking: false, msg: "Erro ao verificar. Tente novamente." }));
    }
  }

  // Auto-atualização do QR/status enquanto o modal do Pix estiver aberto.
  // Isso resolve o caso: gera Pix no carrinho e paga pela aba "Meus pedidos".
  React.useEffect(() => {
    if (!payModal?.open) return;
    const orderId = payModal?.order?.id;
    const st = String(payModal?.status || "pending").toLowerCase();
    if (!orderId) return;
    if (st === "paid") return;

    let alive = true;
    const tick = () => {
      if (!alive) return;
      // reusa o endpoint verify, silencioso
      verifyPay(orderId);
    };
    // primeira verificação rápida
    const t0 = setTimeout(tick, 1200);
    // e polling contínuo
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [payModal?.open, payModal?.order?.id, payModal?.status]);

  // Realtime: se o status do pedido mudar no banco (webhook, admin, etc.)
  // atualiza a tela automaticamente e aplica o comportamento de finalização.
  React.useEffect(() => {
    if (!payModal?.open) return;
    const orderId = payModal?.order?.id;
    if (!orderId) return;

    const channel = supabase
      .channel(`orders_paid_watch_${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = payload?.new || {};
          const nextStatus = String(next?.status || "").toLowerCase();
          if (nextStatus) {
            setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
            setPayModal((s) => ({ ...s, status: nextStatus }));
          }
          if (nextStatus === "paid") finalizePaid(orderId);
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [payModal?.open, payModal?.order?.id, finalizePaid]);

  async function openCancel(order) {
    const prod = String(order?.production_status || "recebido").toLowerCase();

    // Regras de cancelamento por status
    if (prod === "entregue") {
      setCancelModal({
        open: true,
        order,
        mode: "info",
        step: "info",
        busy: false,
        msg: "Este pedido já foi entregue e não pode ser cancelado.",
      });
      return;
    }

    if (prod === "enviado") {
      setCancelModal({
        open: true,
        order,
        mode: "info",
        step: "info",
        busy: false,
        msg: "Cancelamento não permitido: o pedido já foi enviado.",
      });
      return;
    }
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

    // Se for "Pronto": pede confirmação e informa estorno de 30%
    if (prod === "pronto") {
      setCancelModal({
        open: true,
        order,
        mode: "partial30",
        step: "confirm",
        busy: false,
        msg: "",
      });
      return;
    }

    // Se for "Recebido": cancela imediatamente e mostra mensagem de reembolso integral
    if (prod === "recebido") {
      setCancelModal({ open: true, order, mode: "full", step: "processing", busy: true, msg: "" });
      await doCancel(order, { confirm: true, mode: "full" });
      return;
    }

    // Qualquer outro status (ex.: em_producao): informa que já está em produção e pede confirmação
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
    const mode = opts?.mode === "partial" ? "partial" : (opts?.mode === "partial30" ? "partial30" : "full");
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

      const paymentStatusBeforeCancel = String(order?.status || "").toLowerCase();
      const hasPaidBeforeCancel = paymentStatusBeforeCancel === "paid";
      const successMsg = !hasPaidBeforeCancel
        ? "Pedido cancelado."
        : mode === "full"
          ? "Pedido cancelado. Seu reembolso será processado de forma integral."
          : mode === "partial30"
            ? "Pedido cancelado. Como o pedido já está pronto, o estorno será de 30% do valor."
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

  const ordersStats = React.useMemo(() => ({
    total: orders.length,
    pendentes: orders.filter((o) => String(o.status || '').toLowerCase() === 'pending').length,
    emProducao: orders.filter((o) => String(o.production_status || 'recebido').toLowerCase() === 'em_producao').length,
    entregues: orders.filter((o) => String(o.production_status || '').toLowerCase() === 'entregue').length,
  }), [orders]);

  const fetchOrders = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    // 1) Carrega pedidos (sem join) para evitar erro de relationship no schema cache
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("id, status, total, payment_provider, provider_payment_id, created_at, production_status, shipping_tracking, order_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      setLoading(false);
      setError(ordersErr?.message || "Não foi possível carregar seus pedidos.");
      return;
    }

    const listAll = Array.isArray(ordersData) ? ordersData : [];
    // Itens que NÃO devem aparecer em "Meus pedidos":
    // - Assinatura VIP (fica só no painel VIP)
    // - Upgrade do VIP (é um pagamento interno do VIP, não um pedido da loja)
    const hiddenTypes = new Set([
      'vip',
      'vip_upgrade',
      'vip-upgrade',
      'upgrade_vip',
      'upgrade',
    ]);
    const list = listAll.filter((o) => !hiddenTypes.has(String(o.order_type || 'shop').toLowerCase()));
    if (list.length === 0) {
      setOrders([]);
      setReviewsByOrder({});
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
        slug: null,
      });
    });

    let merged = list.map((o) => ({
      ...o,
      order_items: byOrder.get(o.id) || [],
    }));

    const missingItemsOrderIds = merged
      .filter((o) => String(o.status || '').toLowerCase() === 'paid' && (!Array.isArray(o.order_items) || o.order_items.length === 0))
      .map((o) => o.id)
      .slice(0, 8);

    if (missingItemsOrderIds.length && accessToken) {
      try {
        await Promise.all(
          missingItemsOrderIds.map((orderId) =>
            fetch('/api/repair-order-items', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ order_id: orderId }),
            }).catch(() => null)
          )
        );

        const retryNew = await supabase
          .from('order_items')
          .select('order_id, product_id, product_name, qty, unit_price_cents, scale, product_image_url')
          .in('order_id', ids);

        let retryItems = [];
        if (!retryNew?.error) {
          retryItems = retryNew.data || [];
        } else {
          const retryOld = await supabase
            .from('order_items')
            .select('order_id, product_id, name, qty, unit_price, scale, img')
            .in('order_id', ids);
          retryItems = retryOld?.data || [];
        }

        if (retryItems.length) {
          const retryByOrder = new Map();
          retryItems.forEach((it) => {
            const k = it.order_id;
            if (!retryByOrder.has(k)) retryByOrder.set(k, []);
            retryByOrder.get(k).push({
              order_id: it.order_id,
              product_id: it.product_id || null,
              name: it.product_name || it.name || null,
              qty: it.qty,
              scale: it.scale,
              img: it.product_image_url || it.img || null,
              slug: null,
            });
          });
          merged = merged.map((o) => ({ ...o, order_items: retryByOrder.get(o.id) || o.order_items || [] }));
        }
      } catch {}
    }

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
              slug: it.slug || p.slug || null,
            };
          }),
        }));
      }
    } catch {
      // ignore
    }

    setOrders(merged);
    setExpandedOrderId((current) => current || (merged[0]?.id ?? null));

    // 4) Carrega avaliações do usuário para exibir botão "Editar avaliação" e pré-preencher modal
    try {
      const { data: revs } = await supabase
        .from("customer_reviews")
        .select("id, order_id, rating, comment, display_name, city, state, approved, created_at")
        .eq("user_id", user.id)
        .in("order_id", ids);

      const map = {};
      (revs || []).forEach((r) => {
        if (r?.order_id) map[String(r.order_id)] = r;
      });
      setReviewsByOrder(map);
    } catch {
      setReviewsByOrder({});
    }

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
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">Meus pedidos</h3>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={fetchOrders}
                className="rounded-lg px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/4"
                disabled={loading}
                title="Atualizar"
              >
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/4"
              aria-label="Fechar"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div> 

        {user && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/0 ring-1 ring-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Resumo</p>
                  <p className="text-sm text-slate-300">Acompanhe produção, envio e pagamentos em um só lugar.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                  {[
                    ["Pedidos", ordersStats.total],
                    ["Pendentes", ordersStats.pendentes],
                    ["Produção", ordersStats.emProducao],
                    ["Entregues", ordersStats.entregues],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-950/70 ring-1 ring-white/10 px-3 py-2 min-w-[92px]">
                      <div className="text-[11px] text-slate-400">{label}</div>
                      <div className="text-lg font-bold leading-tight">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {loading && <p className="text-slate-300">Carregando…</p>}
            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {!loading && !error && orders.length === 0 && (
              <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-slate-300">Você ainda não tem pedidos.</div>
            )}

            <div className="space-y-3">
              
{orders.map((o) => {
  const isExpanded = expandedOrderId === o.id;
  const items = Array.isArray(o.order_items) ? o.order_items : [];
  const mainItem = items[0] || null;
  const extraItems = Math.max(0, items.length - 1);
  const totalQty = items.reduce((acc, it) => acc + (Number(it?.qty) || 1), 0);
  const paymentLabel = String(o.payment_provider || "").toLowerCase() === "mercado_pago" ? "Mercado Pago" : (o.payment_provider || "Loja");
  const createdLabel = new Date(o.created_at).toLocaleString("pt-BR");
  return (
  <div key={o.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
    <button
      type="button"
      onClick={() => setExpandedOrderId((current) => (current === o.id ? null : o.id))}
      className="w-full p-4 text-left sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Pedido #{String(o.id).slice(0, 8)}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 ring-1 ${statusUI(o.status).cls}`}>{statusUI(o.status).label}</span>
            <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 ring-1 ${prodUI(o.production_status).cls}`}>{prodUI(o.production_status).label}</span>
          </div>

          <div className="mt-4 flex min-w-0 items-center gap-3">
            <div className="flex -space-x-3">
              {items.slice(0, 3).map((it, idx) => (
                it?.img ? (
                  <img key={idx} src={it.img} alt={it.name || "Produto"} className="h-14 w-14 rounded-2xl border border-white/10 bg-slate-950 object-cover shadow-lg" loading="lazy" />
                ) : (
                  <div key={idx} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-slate-900 text-slate-500">
                    <span className="material-icons text-base">inventory_2</span>
                  </div>
                )
              ))}
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white sm:text-lg">
                {mainItem?.name || "Pedido da loja"}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {extraItems > 0 ? `+ ${extraItems} item(ns) neste pedido` : `${totalQty} item(ns) neste pedido`}
              </p>
              <p className="mt-1 text-xs text-slate-400">{createdLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="text-left lg:text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total</p>
            <p className="mt-1 text-xl font-bold text-white">{fmtBRL(Number(o.total))}</p>
          </div>
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            <span className="material-icons">expand_more</span>
          </div>
        </div>
      </div>
    </button>

    {isExpanded ? (
      <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Pedido", `#${String(o.id).slice(0, 8)}`],
            ["Pagamento", paymentLabel],
            ["Itens", `${totalQty} unidade(s)`],
            ["Criado em", createdLabel],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-100 break-words">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-cyan-400/[0.06] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
              <span className="material-icons text-lg">local_shipping</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Andamento do pedido</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{productionMessage(o.production_status, !!o.shipping_tracking)}</p>
            </div>
          </div>

          {o.shipping_tracking ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">Rastreio: {String(o.shipping_tracking)}</span>
              <button
                onClick={() => copyToClipboard(o.shipping_tracking)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/5"
              >
                Copiar rastreio
              </button>
              <a
                href={trackUrl(o.shipping_tracking)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-emerald-300"
              >
                Acompanhar entrega
              </a>
            </div>
          ) : null}
        </div>

        {items.length ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Itens do pedido</p>
                <p className="text-xs text-slate-400">Clique no produto para abrir a página dele no site.</p>
              </div>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <a
                  key={idx}
                  href={productOrderItemHref(it)}
                  className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
                  title={it.name ? `Abrir ${it.name}` : "Abrir produto"}
                >
                  {it.img ? (
                    <img
                      src={it.img}
                      alt={it.name || "Produto"}
                      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10 bg-[#0c2430]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#0c2430] ring-1 ring-white/10 text-slate-400">
                      <span className="material-icons">image</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">{it.name || "Produto"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Quantidade: {Number(it.qty) || 1}</span>
                      {it.scale ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Escala: {it.scale}</span> : null}
                    </div>
                  </div>

                  <span className="material-icons text-slate-500">chevron_right</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {String(o.status || "").toLowerCase() === "pending" &&
          String(o.payment_provider || "").toLowerCase() === "mercado_pago" &&
          o.provider_payment_id ? (
            <button
              onClick={() => (isLikelyPixPaymentId(o.provider_payment_id) ? openPay(o) : retryCardPayment(o))}
              className="rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
              title={isLikelyPixPaymentId(o.provider_payment_id) ? "Abrir pagamento Pix" : "Reabrir pagamento com cartão"}
            >
              Pagar
            </button>
          ) : null}

          {String(o.production_status || "recebido").toLowerCase() !== "entregue" ? (
            <button
              onClick={() => openCancel(o)}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/5"
            >
              Cancelar pedido
            </button>
          ) : null}

          {String(o.production_status || "").toLowerCase() === "entregue" ? (
            <button
              onClick={() => openReview(o)}
              className="rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              {reviewsByOrder?.[String(o.id)] ? "Editar avaliação" : "Avaliar pedido"}
            </button>
          ) : null}
        </div>

        {String(o.production_status || "").toLowerCase() === "entregue" && reviewsByOrder?.[String(o.id)] ? (
          <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-emerald-100">Sua avaliação</p>
              <span className="text-amber-300 text-sm">{"★".repeat(Math.max(1, Math.min(5, Number(reviewsByOrder[String(o.id)]?.rating) || 5)))}</span>
            </div>
            <p className="mt-1 text-sm text-slate-200">{reviewsByOrder[String(o.id)]?.comment}</p>
          </div>
        ) : null}
      </div>
    ) : null}
  </div>
);})}            </div>
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
              <div className="mt-4 rounded-xl bg-white/4 ring-1 ring-white/10 px-3 py-3">
                <p className="text-slate-200">Cancelando pedido…</p>
              </div>
            ) : null}

            {cancelModal.step === "confirm" && cancelModal.mode === "partial" ? (
              <div className="mt-4 rounded-xl bg-cyan-500/10 ring-1 ring-amber-400/30 px-3 py-3">
                <p className="font-semibold text-cyan-200">Atenção</p>
                <p className="mt-1 text-slate-200">
                  Este pedido já está em produção. Se desejar continuar, o reembolso será somente da metade do valor para suprir os custos do processo.
                </p>
              </div>
            ) : null}

            {cancelModal.step === "confirm" && cancelModal.mode === "partial30" ? (
              <div className="mt-4 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/30 px-3 py-3">
                <p className="font-semibold text-cyan-200">Pedido pronto</p>
                <p className="mt-1 text-slate-200">
                  Este pedido já está pronto. Tem certeza que quer cancelar? Se prosseguir, o estorno será de apenas 30% do valor.
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
                className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/4 text-slate-100"
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

              {cancelModal.step === "confirm" && cancelModal.mode === "partial30" ? (
                <button
                  onClick={() => doCancel(cancelModal.order, { confirm: true, mode: "partial30" })}
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

    <Modal open={payModal.open} onClose={payModal.loading ? undefined : closePay} title="Pagamento Pix">
      <div className="w-full max-w-lg">
        {payModal.order ? (
          <div className="text-sm text-slate-200">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="font-semibold break-all">{String(payModal.order.id)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${statusUI(payModal.status).cls}`}>
                {statusUI(payModal.status).label}
              </span>
            </div>

            {payModal.finalized ? (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-black font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="text-emerald-200 font-semibold">Pedido Finalizado</div>
                    <div className="text-emerald-200/80 text-xs">
                      Pagamento confirmado. Obrigado!
                    </div>
                  </div>
                </div>
              </div>
            ) : payModal.msg ? (
              <p className="mt-3 text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
                {payModal.msg}
              </p>
            ) : null}

            {payModal.loading ? (
              <div className="mt-4 rounded-xl bg-white/4 ring-1 ring-white/10 px-3 py-3">
                <p className="text-slate-200">Carregando Pix…</p>
              </div>
            ) : null}

            {!payModal.loading && payModal.pix ? (
              <div className="mt-4 rounded-xl bg-white/4 ring-1 ring-white/10 p-3">
                {payModal.pix.qr_code_base64 ? (
                  <div className="grid place-items-center">
                    <img
                      src={`data:image/png;base64,${payModal.pix.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="w-56 h-56 rounded-xl bg-white p-2"
                    />
                  </div>
                ) : null}

                {payModal.pix.qr_code ? (
                  <div className="mt-4">
                    <p className="text-xs text-slate-300">Pix copia e cola</p>
                    <div className="mt-1 flex gap-2">
                      <input
                        readOnly
                        value={payModal.pix.qr_code}
                        className="w-full rounded-lg bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 text-xs text-slate-200"
                      />
                      <button
                        onClick={() => copyToClipboard(payModal.pix.qr_code)}
                        className="shrink-0 rounded-lg px-3 py-2 bg-amber-400 text-black font-semibold hover:bg-cyan-400"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  {payModal.pix.ticket_url ? (
                    <a
                      href={payModal.pix.ticket_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm rounded-xl px-3 py-2 bg-emerald-400 text-black font-semibold hover:bg-emerald-300"
                    >
                      Abrir pagamento
                    </a>
                  ) : null}

                  <button
                    onClick={() => verifyPay(payModal.order.id)}
                    className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/4"
                    disabled={payModal.checking}
                  >
                    {payModal.checking ? "Verificando…" : "Verificar pagamento"}
                  </button>

                  <button
                    onClick={closePay}
                    className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/4"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-300">Pedido não encontrado.</p>
        )}
      </div>
    </Modal>

    <Modal open={reviewModal.open} onClose={reviewModal.submitting ? undefined : closeReview} title="Avaliar pedido">
      <div className="w-full max-w-lg">
        {reviewModal.order ? (
          <div className="text-sm text-slate-200">
            <p className="text-xs text-slate-400">Pedido</p>
            <p className="font-semibold break-all">{String(reviewModal.order.id)}</p>

            <div className="mt-4">
              <p className="text-xs text-slate-400">Sua nota</p>
              <div className="mt-2 flex items-center gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewModal((s) => ({ ...s, rating: n }))}
                    className={`text-2xl leading-none ${n <= (Number(reviewModal.rating) || 0) ? "text-cyan-300" : "text-slate-600"}`}
                    aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                    title={`${n} estrela${n > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-400">{Number(reviewModal.rating) || 5}/5</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-slate-400" htmlFor="review-comment">Comentário</label>
              <textarea
                id="review-comment"
                value={reviewModal.comment}
                onChange={(e) => setReviewModal((s) => ({ ...s, comment: e.target.value, error: "", success: "" }))}
                rows={4}
                maxLength={500}
                placeholder="Conte como foi sua experiência com a peça, acabamento, prazo e atendimento."
                className="mt-2 w-full rounded-xl bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 outline-none focus:ring-amber-300/40 text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500 text-right">{String(reviewModal.comment || "").length}/500</p>
            </div>

            {reviewModal.error ? (
              <p className="mt-3 text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-3 py-2">
                {reviewModal.error}
              </p>
            ) : null}

            {reviewModal.success ? (
              <p className="mt-3 text-sm text-emerald-200 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-lg px-3 py-2">
                {reviewModal.success}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeReview}
                className="text-sm rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/4 text-slate-100"
                disabled={reviewModal.submitting}
              >
                Fechar
              </button>
              <button
                onClick={submitReview}
                className="text-sm rounded-xl px-3 py-2 bg-amber-400 text-black font-semibold hover:bg-cyan-400 disabled:opacity-60"
                disabled={reviewModal.submitting}
              >
                {reviewModal.submitting ? "Enviando…" : (reviewsByOrder?.[String(reviewModal.order.id)] ? "Salvar avaliação" : "Enviar avaliação")}
              </button>
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
