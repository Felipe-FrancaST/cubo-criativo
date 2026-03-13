export const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
};

export const toDateInputValue = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
};

export const startOfDay = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const endOfDay = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const daysBetween = (fromIso, to = new Date()) => {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
};

export const badgeBase = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1";
export const statusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return { label: "Pago", cls: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30" };
  if (["failed", "canceled", "cancelled", "rejected"].includes(s))
    return { label: "Falhou", cls: "bg-red-500/15 text-red-200 ring-red-500/30" };
  return { label: "Pendente", cls: "bg-cyan-400/15 text-cyan-200 ring-amber-400/30" };
};

export const prodStatusBadge = (s) => {
  const v = String(s || "recebido").toLowerCase();
  switch (v) {
    case "editavel":
      return { label: "Editável", cls: "bg-violet-500/15 text-violet-100 ring-violet-400/30" };
    case "recebido":
      return { label: "Recebido", cls: "bg-slate-500/15 text-slate-200 ring-white/15" };
    case "em_producao":
      return { label: "Em produção", cls: "bg-cyan-600/15 text-indigo-200 ring-indigo-400/30" };
    case "pronto":
      return { label: "Pronto", cls: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30" };
    case "enviado":
      return { label: "Enviado", cls: "bg-cyan-500/15 text-cyan-200 ring-amber-400/30" };
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

export const emailAuditBadge = (status) => {
  const v = String(status || '').toLowerCase();
  if (v === 'sent') return { label: 'E-mail enviado', cls: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30' };
  if (v === 'failed') return { label: 'Falha no e-mail', cls: 'bg-red-500/15 text-red-200 ring-red-500/30' };
  if (v === 'skipped') return { label: 'E-mail pulado', cls: 'bg-cyan-500/15 text-cyan-200 ring-amber-400/30' };
  return { label: 'Sem histórico', cls: 'bg-white/4 text-slate-300 ring-white/10' };
};

export const timelineEventMeta = (event) => {
  const type = String(event?.event_type || '').toLowerCase();
  if (type === 'order_created') return { icon: 'receipt_long', cls: 'bg-slate-500/15 text-slate-200 ring-white/10' };
  if (type === 'payment_confirmed') return { icon: 'payments', cls: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30' };
  if (type === 'production_status') return { icon: 'precision_manufacturing', cls: 'bg-cyan-600/15 text-indigo-200 ring-indigo-400/30' };
  if (type === 'tracking_updated') return { icon: 'local_shipping', cls: 'bg-cyan-500/15 text-cyan-200 ring-amber-400/30' };
  return { icon: 'history', cls: 'bg-white/4 text-slate-200 ring-white/10' };
};

export function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
}

export function fmtAddress(p) {
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

export function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

export function shortId(id) {
  const v = String(id || "");
  if (v.length <= 8) return v;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function exportCsv(rows) {
  const header = [
    "created_at",
    "order_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "total",
    "status",
    "production_status",
    "shipping_tracking",
    "order_type",
    "items",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  (rows || []).forEach((o) => {
    const items = (o.order_items || [])
      .map((it) => `${it.qty || 1}x ${it.name || "Item"}${it.scale ? ` (${it.scale})` : ""}`)
      .join(" | ");
    const line = [
      o.created_at,
      o.id,
      o.customer_name || o.profile?.full_name || "",
      o.customer_email || "",
      o.customer_phone || o.profile?.phone || "",
      o.total,
      o.status,
      o.production_status,
      o.shipping_tracking,
      o.order_type,
      items,
    ].map(esc);
    lines.push(line.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin_pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
