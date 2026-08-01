import React from "react";
import { badgeBase, emailAuditBadge, fmtDate, prodStatusBadge, statusBadge, timelineEventMeta } from "./adminOrdersUtils.js";

export function TimelineList({ events, compact = false }) {
  const list = Array.isArray(events) ? events : [];
  if (!list.length) {
    return <div className="text-sm text-slate-500">Nenhum evento salvo ainda.</div>;
  }
  return (
    <div className="space-y-3">
      {list.map((event, idx) => {
        const meta = timelineEventMeta(event);
        return (
          <div key={event?.id || `${event?.event_type || 'event'}-${idx}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ${meta.cls}`}>
                <span className="material-icons text-[18px]">{meta.icon}</span>
              </div>
              {idx < list.length - 1 ? <div className="mt-2 h-full w-px bg-white/6" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white">{event?.title || 'Atualização'}</div>
                {event?.synthetic ? (
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-white/10">
                    resumo
                  </span>
                ) : null}
              </div>
              {event?.description ? <div className="mt-1 text-sm text-slate-300">{event.description}</div> : null}
              <div className={`mt-1 ${compact ? 'text-[11px]' : 'text-xs'} text-slate-500`}>
                {fmtDate(event?.created_at)}{event?.actor_label ? ` • ${event.actor_label}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-[26px] bg-gradient-to-br from-white/[0.06] to-white/[0.02] ring-1 ring-white/10 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="material-icons text-slate-200/90">{icon}</span>
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          {subtitle ? <div className="text-sm text-slate-400">{subtitle}</div> : null}
        </div>
      </div>
      {right ? <div className="w-full sm:w-auto sm:shrink-0">{right}</div> : null}
    </div>
  );
}

export function SidebarItem({ active, icon, children, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ring-1 shadow-[0_10px_28px_rgba(0,0,0,0.12)]",
        active ? "bg-gradient-to-r from-cyan-400/20 to-teal-300/10 ring-cyan-300/20" : "bg-transparent ring-white/10 hover:bg-white/[0.05] hover:-translate-y-0.5",
      ].join(" ")}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="material-icons text-[18px] text-slate-200/90">{icon}</span>
        <span className="text-sm text-slate-100 truncate">{children}</span>
      </span>
      {badge ? <span className={`${badgeBase} bg-white/4 text-slate-200 ring-white/10`}>{badge}</span> : null}
    </button>
  );
}

export function DetailRow({ label, value, action }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/10">
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{value || "—"}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function OrderBadgeCluster({ order }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(() => {
        const b = statusBadge(order?.status);
        return <span className={`${badgeBase} ${b.cls}`}>💳 {b.label}</span>;
      })()}
      {(() => {
        const b = prodStatusBadge(order?.production_status);
        return <span className={`${badgeBase} ${b.cls}`}>🏭 {b.label}</span>;
      })()}
      {order?.order_type ? (
        <span className={`${badgeBase} bg-white/4 text-slate-200 ring-white/10`}>
          {String(order.order_type).toLowerCase() === "vip" ? "VIP" : "Loja"}
        </span>
      ) : null}
      {order?.refund_requested ? (
        <span className={`${badgeBase} bg-red-500/10 text-red-200 ring-red-500/30`}>Reembolso solicitado</span>
      ) : null}
      {(() => {
        const b = emailAuditBadge(order?.last_email_status);
        return <span className={`${badgeBase} ${b.cls}`}>✉️ {b.label}</span>;
      })()}
    </div>
  );
}
