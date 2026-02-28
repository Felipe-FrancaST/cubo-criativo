import React from "react";
import { isAdminEmail } from "../lib/admin.js";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const prodStatusLabel = (s) => {
  const v = String(s || "recebido").toLowerCase();
  switch (v) {
    case "editavel":
      return { label: "Editável", cls: "bg-violet-500/15 text-violet-100 ring-violet-400/30" };
    case "recebido":
      return { label: "Recebido", cls: "bg-slate-500/15 text-slate-200 ring-white/15" };
    case "em_producao":
      return { label: "Em produção", cls: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/30" };
    case "pronto":
      return { label: "Pronto", cls: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30" };
    case "enviado":
      return { label: "Enviado", cls: "bg-amber-500/15 text-amber-200 ring-amber-400/30" };
    case "entregue":
      return { label: "Entregue", cls: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" };
    case "cancelado":
      return { label: "Cancelado", cls: "bg-red-500/15 text-red-200 ring-red-500/30" };
    case "reembolsado":
      return { label: "Reembolsado", cls: "bg-teal-500/15 text-teal-200 ring-teal-400/30" };
    default:
      return { label: v, cls: "bg-slate-500/15 text-slate-200 ring-white/15" };
  }
};

const payStatusUI = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "paid") {
    return { label: "Pago", cls: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30" };
  }
  if (s === "failed" || s === "canceled" || s === "cancelled" || s === "rejected") {
    return { label: "Falhou", cls: "bg-red-500/15 text-red-200 ring-red-500/30" };
  }
  return { label: "Pendente", cls: "bg-amber-400/15 text-amber-200 ring-amber-400/30" };
};

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
}

function fmtAddress(p) {
  if (!p) return "";
  const parts = [
    p.address_line1,
    p.address_line2,
    p.neighborhood,
    [p.city, p.state].filter(Boolean).join(" - "),
    p.zip,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return parts.join("\n");
}

export default function AdminOrdersPage({ user, accessToken, onNavigateHome, onRequireLogin }) {
  const [tab, setTab] = React.useState("orders");
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [filterPay, setFilterPay] = React.useState("all");
  const [filterProd, setFilterProd] = React.useState("all");
  const [toast, setToast] = React.useState("");
  const [statusActionModal, setStatusActionModal] = React.useState({ open: false, orderId: null, patch: null, fields: {} });

  const [vipPolls, setVipPolls] = React.useState([]);
  const [vipPollsLoading, setVipPollsLoading] = React.useState(false);
  const [vipPollsError, setVipPollsError] = React.useState("");

  const isAdmin = isAdminEmail(user?.email || "");

  const closeStatusActionModal = () => setStatusActionModal({ open: false, orderId: null, patch: null, fields: {} });

  const submitStatusActionModal = async () => {
    const data = statusActionModal;
    if (!data?.orderId || !data?.patch) return;
    const extra = {};
    if (String(data.patch.production_status || '').toLowerCase() === 'em_producao') {
      const eta = String(data.fields.production_eta || '').trim();
      if (!eta) return showToast('⚠️ Informe a estimativa de produção.');
      extra.production_eta = eta;
    }
    if (String(data.patch.production_status || '').toLowerCase() === 'enviado') {
      const tr = String(data.fields.shipping_tracking || '').trim();
      if (tr) extra.shipping_tracking = tr;
    }
    closeStatusActionModal();
    await updateOrder(data.orderId, { ...data.patch, ...extra });
  };

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 1800);
  };

  const fetchOrders = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/admin/orders", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar pedidos.");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e?.message || "Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchVipVoting = React.useCallback(async () => {
    if (!accessToken) return;
    setVipPollsLoading(true);
    setVipPollsError("");
    try {
      const resp = await fetch("/api/admin/vip-voting", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível carregar a votação VIP.");
      setVipPolls(Array.isArray(data.polls) ? data.polls : []);
    } catch (e) {
      setVipPollsError(e?.message || "Erro ao carregar votação VIP.");
    } finally {
      setVipPollsLoading(false);
    }
  }, [accessToken]);

    React.useEffect(() => {
    if (!user) onRequireLogin?.('Faça login como admin para ver pedidos.');
  }, [user]);

React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  React.useEffect(() => {
    if (tab === "vip_voting") fetchVipVoting();
  }, [tab, fetchVipVoting]);

  async function updateOrder(orderId, patch) {
    try {
      const current = (orders || []).find((o) => o.id === orderId);
      const currentPay = String(current?.status || "").toLowerCase();
      const changingFlow = Object.prototype.hasOwnProperty.call(patch || {}, "production_status") || Object.prototype.hasOwnProperty.call(patch || {}, "shipping_tracking");
      if (changingFlow && currentPay !== "paid") {
        showToast("⚠️ Só pedidos pagos podem ter status/rastreio alterados.");
        return;
      }
      const finalPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(finalPatch, 'production_status')) {
        const nextStatus = String(finalPatch.production_status || '').toLowerCase();
        if (nextStatus === 'em_producao' && !finalPatch.production_eta) {
          setStatusActionModal({
            open: true,
            orderId,
            patch: finalPatch,
            fields: { production_eta: '3 a 7 dias úteis' },
          });
          return;
        }
        if (nextStatus === 'enviado' && !finalPatch.shipping_tracking) {
          setStatusActionModal({
            open: true,
            orderId,
            patch: finalPatch,
            fields: { shipping_tracking: '' },
          });
          return;
        }
        if (nextStatus === 'cancelado' && !finalPatch.cancelled_by) {
          finalPatch.cancelled_by = 'admin';
        }
      }

      const resp = await fetch("/api/admin/update-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId, ...finalPatch }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Não foi possível atualizar.");
      showToast("✅ Atualizado!");
      // atualiza localmente
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...finalPatch } : o))
      );
    } catch (e) {
      showToast(`⚠️ ${e?.message || "Falha"}`);
    }
  }

  const filtered = React.useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    return (orders || [])
      .filter((o) => {
        if (filterPay === "paid") return String(o.status || "").toLowerCase() === "paid";
        if (filterPay === "pending") return String(o.status || "").toLowerCase() !== "paid";
        return true;
      })
      .filter((o) => {
        if (filterProd === "all") return true;
        return String(o.production_status || "recebido").toLowerCase() === filterProd;
      })
      .filter((o) => {
        if (!query) return true;
        const id = String(o.id || "").toLowerCase();
        const email = String(o.customer_email || o.profile?.id || "").toLowerCase();
        const name = String(o.customer_name || o.profile?.full_name || "").toLowerCase();
        const phone = String(o.customer_phone || o.profile?.phone || "").toLowerCase();
        const tracking = String(o.shipping_tracking || "").toLowerCase();
        return id.includes(query) || email.includes(query) || name.includes(query) || phone.includes(query) || tracking.includes(query);
      });
  }, [orders, q, filterPay, filterProd]);



  const metrics = React.useMemo(() => {
    const list = filtered || [];
    return {
      total: list.length,
      pendentes: list.filter(o => String(o.status||'').toLowerCase() !== 'paid').length,
      producao: list.filter(o => String(o.production_status||'recebido').toLowerCase() === 'em_producao').length,
      enviados: list.filter(o => String(o.production_status||'recebido').toLowerCase() === 'enviado').length,
    };
  }, [filtered]);

  if (!user) {
    return (
      <main className="flex-1">
        <section className="container-cc px-4 sm:px-6 lg:px-8 py-10">
          <div className="mx-auto">
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 text-slate-200">
              Faça login para acessar o painel admin.
            </div>
          </div>
        </section>
  
      {statusActionModal.open ? (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Atualizar pedido</p>
                <h3 className="text-lg font-bold">{String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? 'Definir estimativa de produção' : 'Informar rastreio'}</h3>
              </div>
              <button onClick={closeStatusActionModal} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5" aria-label="Fechar">
                <span className="material-icons text-base">close</span>
              </button>
            </div>

            {String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Estimativa que vai no e-mail do cliente</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.production_eta || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, production_eta: e.target.value } }))}
                  placeholder="Ex.: 3 a 7 dias úteis"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Código de rastreio (opcional)</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.shipping_tracking || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, shipping_tracking: e.target.value } }))}
                  placeholder="Ex.: NB123456789BR"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={closeStatusActionModal} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5">Cancelar</button>
              <button onClick={submitStatusActionModal} className="rounded-xl px-3 py-2 text-sm bg-emerald-400 text-black font-semibold hover:bg-emerald-300">Salvar e atualizar</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex-1">
        <section className="container-cc px-4 sm:px-6 lg:px-8 py-10">
          <div className="mx-auto">
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 text-slate-200">
              Você não tem permissão para acessar esta página.
            </div>
          </div>
        </section>
  
      {statusActionModal.open ? (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Atualizar pedido</p>
                <h3 className="text-lg font-bold">{String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? 'Definir estimativa de produção' : 'Informar rastreio'}</h3>
              </div>
              <button onClick={closeStatusActionModal} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5" aria-label="Fechar">
                <span className="material-icons text-base">close</span>
              </button>
            </div>

            {String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Estimativa que vai no e-mail do cliente</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.production_eta || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, production_eta: e.target.value } }))}
                  placeholder="Ex.: 3 a 7 dias úteis"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Código de rastreio (opcional)</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.shipping_tracking || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, shipping_tracking: e.target.value } }))}
                  placeholder="Ex.: NB123456789BR"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={closeStatusActionModal} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5">Cancelar</button>
              <button onClick={submitStatusActionModal} className="rounded-xl px-3 py-2 text-sm bg-emerald-400 text-black font-semibold hover:bg-emerald-300">Salvar e atualizar</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    );
  }

  return (
    <main className="flex-1">
      {toast ? (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
          <div className="container-cc rounded-full bg-emerald-500 text-black font-semibold px-4 py-2 shadow-lg ring-4 ring-emerald-400/30">
            {toast}
          </div>
        </div>
      ) : null}

      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">Painel Admin</h1>
              <p className="mt-2 text-slate-300 text-sm">
                {tab === 'vip_voting' ? 'Acompanhe o resultado da votação VIP por mês.' : 'Atualize status de produção/envio e copie dados para produzir.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onNavigateHome}
                className="container-cc rounded-xl px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5"
              >
                Voltar
              </button>
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="container-cc rounded-xl px-4 py-2 text-sm bg-emerald-400 text-black font-semibold hover:bg-emerald-300 disabled:opacity-60"
              >
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => setTab('orders')}
              className={
                tab === 'orders'
                  ? 'rounded-full px-4 py-2 text-sm font-semibold bg-white/10 ring-1 ring-white/20'
                  : 'rounded-full px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5'
              }
            >
              Pedidos
            </button>
            <button
              onClick={() => setTab('vip_voting')}
              className={
                tab === 'vip_voting'
                  ? 'rounded-full px-4 py-2 text-sm font-semibold bg-white/10 ring-1 ring-white/20'
                  : 'rounded-full px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5'
              }
            >
              Votação VIP
            </button>
          </div>

          {tab === 'orders' ? (
            <>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Pedidos', metrics.total],
              ['Pendentes', metrics.pendentes],
              ['Em produção', metrics.producao],
              ['Enviados', metrics.enviados],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-1 text-2xl font-extrabold">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <div className="relative">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome, email, telefone, id, rastreio…"
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900 ring-1 ring-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>
            </div>
            <div>
              <select
                value={filterPay}
                onChange={(e) => setFilterPay(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 ring-1 ring-white/10 text-slate-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">Pagamento: todos</option>
                <option value="paid">Pagamento: pago</option>
                <option value="pending">Pagamento: pendente</option>
              </select>
            </div>
            <div>
              <select
                value={filterProd}
                onChange={(e) => setFilterProd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 ring-1 ring-white/10 text-slate-100 focus:outline-none"
              >
                <option value="all">Produção: todos</option>
                <option value="editavel">Editável</option>
                <option value="recebido">Recebido</option>
                <option value="em_producao">Em produção</option>
                <option value="pronto">Pronto</option>
                <option value="enviado">Enviado</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
                <option value="reembolsado">Reembolsado</option>
              </select>
            </div>
          </div>

          {error ? (
            <div className="container-cc mt-4 text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {(!loading && filtered.length === 0) ? (
              <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 text-slate-200">
                Nenhum pedido encontrado.
              </div>
            ) : null}

            {filtered.map((o) => {
              const p = o.profile;
              const customerName = o.customer_name || p?.full_name || "—";
              const customerPhone = o.customer_phone || p?.phone || "";
              const customerEmail = o.customer_email || "";
              const address = fmtAddress(p);

              const pay = payStatusUI(o.status);
              const prod = prodStatusLabel(o.production_status);
              const canEditFlow = String(o.status || '').toLowerCase() === 'paid';
              const vipSelection = o.vip_selection || null;

              return (
                <div key={o.id} className="rounded-2xl bg-slate-900/60 ring-1 ring-white/10 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString("pt-BR")}</p>
                      <p className="mt-1 font-bold text-lg truncate">{customerName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {String(o.order_type || "").toLowerCase() === "vip" ? (
                          <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ring-violet-400/30 bg-violet-500/15 text-violet-100">
                            <span className="material-icons text-[14px]">stars</span>
                            VIP
                          </span>
                        ) : null}
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${pay.cls}`}>
                          Pagamento: {pay.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ${prod.cls}`}>
                          Produção: {prod.label}
                        </span>
                        {o.shipping_tracking ? (
                          <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ring-1 ring-white/15 bg-white/5 text-slate-200">
                            Rastreio: {String(o.shipping_tracking)}
                          </span>
                        ) : null}
                      </div>

                      {(o.refund_requested && String(o.production_status || "").toLowerCase() !== "reembolsado") ? (
                        <div className="mt-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 px-3 py-2 text-sm text-amber-200">
                          <span className="font-semibold">Reembolso solicitado:</span> o cliente cancelou o pedido e pediu o reembolso.
                          {o.refund_requested_at ? (
                            <span className="text-amber-200/80"> {" "}({new Date(o.refund_requested_at).toLocaleString("pt-BR")})</span>
                          ) : null}
                        </div>
                      ) : null}

                      {String(o.order_type || '').toLowerCase() === 'vip' ? (
                        <div className="mt-3 rounded-xl bg-violet-500/10 ring-1 ring-violet-400/25 px-3 py-2 text-sm text-violet-100">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold">Miniaturas VIP escolhidas</span>
                            <span className="text-xs text-violet-200/80">{vipSelection?.cycle_key || 'ciclo atual'}</span>
                          </div>
                          {Array.isArray(vipSelection?.selected_titles) && vipSelection.selected_titles.length ? (
                            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {vipSelection.selected_titles.map((name, idx) => (
                                <li key={`${o.id}-vipsel-${idx}`} className="rounded-lg bg-black/20 ring-1 ring-white/10 px-2 py-1 text-xs">• {name}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-xs text-violet-200/80">Cliente ainda não escolheu as miniaturas deste ciclo.</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="text-xl font-extrabold">{fmtBRL(Number(o.total))}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {String(o.id).slice(0, 8)}…</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <p className="text-xs text-slate-400">Contato</p>
                      <div className="mt-2 text-sm text-slate-200 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{customerEmail || "—"}</span>
                          {customerEmail ? (
                            <button
                              onClick={() => { copyToClipboard(customerEmail); showToast("Copiado!"); }}
                              className="text-xs rounded-lg px-2 py-1 ring-1 ring-white/10 hover:bg-white/5"
                            >
                              copiar
                            </button>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{customerPhone || "—"}</span>
                          {customerPhone ? (
                            <button
                              onClick={() => { copyToClipboard(customerPhone); showToast("Copiado!"); }}
                              className="text-xs rounded-lg px-2 py-1 ring-1 ring-white/10 hover:bg-white/5"
                            >
                              copiar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <p className="text-xs text-slate-400">Endereço</p>
                      <p className="mt-2 text-sm text-slate-200 whitespace-pre-line min-h-[56px]">{address || "—"}</p>
                      {address ? (
                        <button
                          onClick={() => { copyToClipboard(address); showToast("Endereço copiado!"); }}
                          className="mt-2 text-xs rounded-lg px-2 py-1 ring-1 ring-white/10 hover:bg-white/5"
                        >
                          copiar endereço
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                      <p className="text-xs text-slate-400">Ações</p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <select
                          value={String(o.production_status || "recebido").toLowerCase()}
                          onChange={(e) => updateOrder(o.id, { production_status: e.target.value })}
                          disabled={!canEditFlow}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 ring-1 ring-white/10 text-slate-100 focus:outline-none"
                        >
                        <option value="editavel">Editável</option>
                          <option value="recebido">Recebido</option>
                          <option value="em_producao">Em produção</option>
                          <option value="pronto">Pronto</option>
                          <option value="enviado">Enviado</option>
                          <option value="entregue">Entregue</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="reembolsado">Reembolsado</option>
                        </select>

                        <input
                          defaultValue={o.shipping_tracking || ""}
                          placeholder="Código de rastreio (opcional)"
                          disabled={!canEditFlow}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 ring-1 ring-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          onBlur={(e) => updateOrder(o.id, { shipping_tracking: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">* digite e saia do campo para salvar</p>
                        {!canEditFlow ? (
                          <p className="text-xs text-amber-300/90">Pagamento pendente/falhou: alterações de status e rastreio ficam bloqueadas.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Itens */}
                  {Array.isArray(o.order_items) && o.order_items.length > 0 ? (
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
                                <p className="text-xs text-slate-400 truncate">
                                  {it.scale ? `Escala: ${it.scale} • ` : ""}{Number(it.qty) || 1}x
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs text-slate-400">Unit.</p>
                              <p className="text-sm text-slate-200">{fmtBRL(Number(it.unit_price))}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
            </>
          ) : (
            <div className="mt-6">
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Votação VIP</div>
                    <div className="mt-1 text-lg font-extrabold">Resultados</div>
                    <div className="mt-1 text-sm text-slate-300">Mostra as opções e a contagem de votos por mês.</div>
                  </div>
                  <button
                    onClick={fetchVipVoting}
                    disabled={vipPollsLoading}
                    className="container-cc rounded-xl px-4 py-2 text-sm bg-emerald-400 text-black font-semibold hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {vipPollsLoading ? 'Atualizando…' : 'Atualizar'}
                  </button>
                </div>

                {vipPollsError ? (
                  <div className="container-cc mt-4 text-sm text-red-300 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl px-4 py-3">
                    {vipPollsError}
                  </div>
                ) : null}

                {vipPollsLoading ? (
                  <div className="mt-4 text-slate-300">Carregando…</div>
                ) : vipPolls.length === 0 ? (
                  <div className="mt-4 text-slate-300">Nenhuma votação encontrada.</div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {vipPolls.map((p) => (
                      <div key={p?.poll?.id || Math.random()} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-xs text-slate-400">Mês</div>
                            <div className="text-lg font-extrabold">{p?.poll?.month_key || '—'}</div>
                            <div className="text-sm text-slate-300">{p?.poll?.title || 'Votação VIP'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Status</div>
                            <div className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/5">
                              {String(p?.poll?.status || 'open').toUpperCase()}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">Total votos: <b className="text-slate-200">{p?.total_votes ?? 0}</b></div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(p?.options || []).map((opt) => (
                            <div key={opt.id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-100 truncate">{opt.title}</div>
                                  {opt.description ? <div className="text-xs text-slate-300 mt-0.5">{opt.description}</div> : null}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs text-slate-400">Votos</div>
                                  <div className="text-sm font-bold">{opt.votes} <span className="text-slate-400">({opt.pct}%)</span></div>
                                </div>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/10">
                                <div className="h-full bg-emerald-400" style={{ width: `${opt.pct || 0}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {statusActionModal.open ? (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Atualizar pedido</p>
                <h3 className="text-lg font-bold">{String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? 'Definir estimativa de produção' : 'Informar rastreio'}</h3>
              </div>
              <button onClick={closeStatusActionModal} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5" aria-label="Fechar">
                <span className="material-icons text-base">close</span>
              </button>
            </div>

            {String(statusActionModal?.patch?.production_status || '').toLowerCase() === 'em_producao' ? (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Estimativa que vai no e-mail do cliente</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.production_eta || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, production_eta: e.target.value } }))}
                  placeholder="Ex.: 3 a 7 dias úteis"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-sm text-slate-300 block mb-2">Código de rastreio (opcional)</label>
                <input
                  autoFocus
                  value={statusActionModal.fields.shipping_tracking || ''}
                  onChange={(e) => setStatusActionModal((prev) => ({ ...prev, fields: { ...prev.fields, shipping_tracking: e.target.value } }))}
                  placeholder="Ex.: NB123456789BR"
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5 outline-none focus:ring-emerald-400/40"
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={closeStatusActionModal} className="rounded-xl px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5">Cancelar</button>
              <button onClick={submitStatusActionModal} className="rounded-xl px-3 py-2 text-sm bg-emerald-400 text-black font-semibold hover:bg-emerald-300">Salvar e atualizar</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
