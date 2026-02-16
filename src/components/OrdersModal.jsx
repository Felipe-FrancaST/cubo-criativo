import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export default function OrdersModal({ open, onClose }) {
  const { user } = useAuth();
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

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

  const fetchOrders = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    // 1) Carrega pedidos (sem join) para evitar erro de relationship no schema cache
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select("id, status, total, payment_provider, provider_payment_id, created_at")
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
    const { data: itemsData, error: itemsErr } = await supabase
      .from("order_items")
      .select("order_id, name, qty, unit_price, scale, img")
      .in("order_id", ids);

    if (itemsErr) {
      setLoading(false);
      setError(itemsErr?.message || "Não foi possível carregar seus pedidos.");
      return;
    }

    const byOrder = new Map();
    (itemsData || []).forEach((it) => {
      const k = it.order_id;
      if (!byOrder.has(k)) byOrder.set(k, []);
      byOrder.get(k).push(it);
    });

    const merged = list.map((o) => ({
      ...o,
      order_items: byOrder.get(o.id) || [],
    }));

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

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(String(id));
    } catch {
      // ignore
    }
  };

  return (
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
                    <div>
                      <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString("pt-BR")}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`text-xs rounded-full px-2 py-1 ring-1 ${statusUI(o.status).cls}`}
                        >
                          {statusUI(o.status).label}
                        </span>
                        <span className="text-xs rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5">
                          {o.payment_provider || "—"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="text-lg font-semibold">{fmtBRL(Number(o.total))}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                    <p className="text-[11px] text-slate-400 truncate">
                      <span className="font-mono text-slate-200">{o.id}</span>
                    </p>
                    <button
                      onClick={() => copyId(o.id)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs ring-1 ring-white/10 hover:bg-white/5"
                      title="Copiar ID"
                    >
                      <span className="material-icons" style={{ fontSize: 16 }}>content_copy</span>
                    </button>
                  </div>

                  {Array.isArray(o.order_items) && o.order_items.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400 mb-2">Itens</p>
                      <ul className="space-y-2">
                        {o.order_items.map((it, idx) => {
                          const lineTotal = Number(it.unit_price) * Number(it.qty);
                          return (
                            <li key={idx} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {it.img ? (
                                  <img
                                    src={it.img}
                                    alt={it.name || "Item"}
                                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-white/5 ring-1 ring-white/10" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-200 truncate">
                                    <span className="font-semibold">{it.qty}×</span> {it.name || "Produto"}
                                  </p>
                                  {it.scale ? (
                                    <p className="text-xs text-slate-400 truncate">Escala: {it.scale}</p>
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-sm text-slate-300 shrink-0">{fmtBRL(lineTotal)}</p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
