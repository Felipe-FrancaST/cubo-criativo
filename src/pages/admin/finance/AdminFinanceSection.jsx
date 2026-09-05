import React from "react";
import { KpiCard, SectionTitle } from "../orders/AdminOrdersComponents.jsx";
import { fmtBRL } from "../orders/adminOrdersUtils.js";

export default function AdminFinanceSection({ admin }) {
  const { stats, financeHighlights } = admin;

  return (
    <div className="space-y-4">
      <SectionTitle
        icon="payments"
        title="Centro financeiro"
        subtitle="Receita, upgrades e visão de caixa operacional."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Faturamento total"
          value={fmtBRL(stats?.revenue || 0)}
          hint="Pedidos pagos + upgrades"
        />
        <KpiCard
          label="Receita do mês"
          value={fmtBRL(stats?.paidMonth || 0)}
          hint="Pagamentos aprovados"
        />
        <KpiCard
          label="Receita hoje"
          value={fmtBRL(stats?.paidToday || 0)}
          hint="Movimento diário"
        />
        <KpiCard
          label="Upgrades pagos"
          value={fmtBRL(stats?.upgradeRevenue || 0)}
          hint="Receita incremental VIP"
        />
        <KpiCard
          label="Frete pago"
          value={fmtBRL(financeHighlights?.shippingRevenue || 0)}
          hint="No filtro atual"
        />
        <KpiCard
          label="Entregues"
          value={financeHighlights?.deliveredCount || 0}
          hint="Pedidos pagos concluídos"
        />
      </div>

      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="text-sm font-semibold text-white">
          Resumo financeiro
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-black/20 p-4 text-slate-200 ring-1 ring-white/10">
            Ticket médio: <b>{fmtBRL(stats?.averageTicket || 0)}</b>
          </div>
          <div className="rounded-xl bg-black/20 p-4 text-slate-200 ring-1 ring-white/10">
            Reembolsos solicitados: <b>{stats?.refundReq || 0}</b>
          </div>
          <div className="rounded-xl bg-black/20 p-4 text-slate-200 ring-1 ring-white/10">
            Receita pendente:{" "}
            <b>{fmtBRL(financeHighlights?.pendingRevenue || 0)}</b>
          </div>
          <div className="rounded-xl bg-black/20 p-4 text-slate-200 ring-1 ring-white/10">
            Pedidos pagos no filtro:{" "}
            <b>{financeHighlights?.paidCount || 0}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
