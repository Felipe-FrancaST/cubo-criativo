import { SectionTitle } from '../orders/AdminOrdersComponents.jsx'
import { shortId } from '../orders/adminOrdersUtils.js'
export default function AdminProductionSection({ admin }) {
  const { setDetails, filteredOrders } = admin
  return (
    <div className="space-y-4">
      <SectionTitle
        icon="view_kanban"
        title="Kanban de produção"
        subtitle="Pedidos pagos organizados por estágio operacional."
      />
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {[
          ['recebido', 'Recebidos'],
          ['editavel', 'Editáveis'],
          ['em_producao', 'Em produção'],
          ['pronto', 'Prontos para envio'],
        ].map(([key, label]) => {
          const rows = filteredOrders
            .filter(
              (o) =>
                String(o.status || '').toLowerCase() === 'paid' &&
                String(o.production_status || '').toLowerCase() === key
            )
            .slice(0, 20)
          return (
            <div
              key={key}
              className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">{label}</div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                  {rows.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {rows.length ? (
                  rows.map((o) => (
                    <button
                      key={o.id}
                      onClick={() =>
                        setDetails({
                          open: true,
                          orderId: o.id,
                        })
                      }
                      className="w-full text-left rounded-xl bg-black/20 ring-1 ring-white/10 p-3 hover:bg-black/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {o.customer_name ||
                              o.profile?.full_name ||
                              shortId(o.id)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {shortId(o.id)} • {o.days_open || 0} dia(s)
                          </div>
                        </div>
                        {o.is_overdue ? (
                          <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-500/30">
                            Atrasado
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    Nenhum pedido nesta coluna.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
