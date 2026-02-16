import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const base = "rounded-full px-2 py-1 ring-1 text-xs";
  if (s === "paid" || s === "approved") {
    return <span className={`${base} bg-emerald-500/10 ring-emerald-400/30 text-emerald-200`}>pago</span>;
  }
  if (s === "pending") {
    return <span className={`${base} bg-amber-500/10 ring-amber-400/30 text-amber-200`}>pendente</span>;
  }
  if (s === "failed" || s === "canceled" || s === "cancelled" || s === "rejected") {
    return <span className={`${base} bg-red-500/10 ring-red-400/30 text-red-200`}>falhou</span>;
  }
  return <span className={`${base} bg-white/5 ring-white/10 text-slate-200`}>{s || "—"}</span>;
}

export default function OrdersModal({ open, onClose }) {
  const { user } = useAuth();
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [tick, setTick] = React.useState(0);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // 1) busca pedidos (sem embed, para não depender de FK/relationship no PostgREST)
      const { data: ords, error: err } = await supabase
        .from("orders")
        .select("id, status, total, currency, payment_provider, provider_payment_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (err) throw err;

      const list = Array.isArray(ords) ? ords : [];
      const ids = list.map((o) => o.id).filter(Boolean);

      // 2) busca itens em batch
      let itemsByOrder = {};
      if (ids.length) {
        const { data: items, error: itemsErr } = await supabase
          .from("order_items")
          .select("order_id, name, qty, unit_price, scale")
          .in("order_id", ids);

        if (itemsErr) {
          // não bloqueia a lista de pedidos
          console.warn("order_items fetch error", itemsErr);
        } else {
          for (const it of items || []) {
            const k = it.order_id;
            if (!itemsByOrder[k]) itemsByOrder[k] = [];
            itemsByOrder[k].push(it);
          }
        }
      }

      setOrders(
        list.map((o) => ({
          ...o,
          order_items: itemsByOrder[o.id] || [],
        }))
      );
    } catch (e) {
      setError(e?.message || "Não foi possível carregar seus pedidos.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (!open || !user) return;
    let cancel = false;

    // load immediately
    load();

    // auto-refresh: a cada 8s enquanto o modal estiver aberto
    const t = setInterval(() => {
      if (!cancel) setTick((v) => v + 1);
    }, 8000);

    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [open, user, load]);

  React.useEffect(() => {
    if (!open || !user) return;
    load();
  }, [tick, open, user, load]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">Meus pedidos</h3>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={load}
                className="rounded-lg px-3 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5"
                title="Atualizar"
              >
                Atualizar
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

        {!user && <p className="mt-4 text-slate-300">Faça login para ver seus pedidos.</p>}

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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[220px]">
                      <p className="text-sm text-slate-400">Pedido</p>
                      <p className="font-mono text-xs text-slate-200 break-all">{o.id}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill status={o.status} />
                        <span className="rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5 text-xs">
                          {o.payment_provider || "—"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-400">
                        {o.created_at ? new Date(o.created_at).toLocaleString("pt-BR") : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-slate-400">Total</p>
                      <p className="font-semibold">{fmtBRL(Number(o.total))}</p>
                    </div>
                  </div>

                  {Array.isArray(o.order_items) && o.order_items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 mb-2">Itens</p>
                      <ul className="space-y-1 text-sm">
                        {o.order_items.map((it, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-2">
                            <span className="text-slate-200">
                              {Number(it.qty) || 1}× {it.name || "Item"}
                              {it.scale ? <span className="text-slate-400"> ({it.scale})</span> : null}
                            </span>
                            <span className="text-slate-300">
                              {fmtBRL(Number(it.unit_price) * (Number(it.qty) || 1))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Dica: pagamentos Pix podem levar alguns segundos para confirmar. Este painel atualiza automaticamente.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
