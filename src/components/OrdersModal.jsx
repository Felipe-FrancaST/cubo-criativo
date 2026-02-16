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

  React.useEffect(() => {
    if (!open || !user) return;
    let cancel = false;

    async function run() {
      try {
        setLoading(true);
        setError("");

        // 1) Carrega pedidos (sem join) para evitar erro de relationship no schema cache
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("id, status, total, payment_provider, provider_payment_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (ordersErr) throw ordersErr;

        const list = Array.isArray(ordersData) ? ordersData : [];
        if (list.length === 0) {
          if (!cancel) setOrders([]);
          return;
        }

        // 2) Carrega itens em batch
        const ids = list.map((o) => o.id);
        const { data: itemsData, error: itemsErr } = await supabase
          .from("order_items")
          .select("order_id, name, qty, unit_price, scale, img")
          .in("order_id", ids);

        if (itemsErr) throw itemsErr;

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

        if (!cancel) setOrders(merged);
      } catch (e) {
        if (!cancel) setError(e?.message || "Não foi possível carregar seus pedidos.");
      } finally {
        if (!cancel) setLoading(false);
      }
    }    run();
    return () => {
      cancel = true;
    };
  }, [open, user]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">Meus pedidos</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/5"
            aria-label="Fechar"
          >
            <span className="material-icons">close</span>
          </button>
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
                <div key={o.id} className="rounded-xl bg-slate-900 ring-1 ring-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-400">Pedido</p>
                      <p className="font-mono text-xs text-slate-200 break-all">{o.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Total</p>
                      <p className="font-semibold">{fmtBRL(Number(o.total))}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5">
                      {o.payment_provider || "—"}
                    </span>
                    <span className="rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5">
                      status: {o.status}
                    </span>
                    <span className="rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>

                  {Array.isArray(o.order_items) && o.order_items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 mb-2">Itens</p>
                      <ul className="space-y-1 text-sm">
                        {o.order_items.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2">
                            <span className="text-slate-200">
                              {it.qty}× {it.name}
                              {it.scale ? <span className="text-slate-400"> ({it.scale})</span> : null}
                            </span>
                            <span className="text-slate-300">
                              {fmtBRL(Number(it.unit_price) * Number(it.qty))}
                            </span>
                          </li>
                        ))}
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
