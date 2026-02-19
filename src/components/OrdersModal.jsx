import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

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
    return { label: "Recebido", cls: "bg-white/5 text-slate-200 ring-white/15" };
  };

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
    ) : (
      <p className="mt-4 text-sm text-slate-400">Itens não disponíveis.</p>
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
