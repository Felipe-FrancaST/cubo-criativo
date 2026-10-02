import { fmtBRL, fmtDate, shortId } from './adminOrdersUtils.js'
import { OrderBadgeCluster } from './AdminOrdersComponents.jsx'

export default function AdminOrderMobileList({ admin }) {
  const {
    filteredOrders,
    selectedOrderIds,
    toggleOrderSelection,
    allPageSelected,
    toggleSelectAllCurrentPage,
    setDetails,
    setActionModal,
    clearOrderSearchAndFilters,
    loading,
  } = admin
  return (
    <div className="space-y-3 md:hidden" aria-busy={loading}>
      {!!filteredOrders.length && (
        <label className="flex items-center gap-3 px-1 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllCurrentPage}
          />
          Selecionar pedidos desta página
        </label>
      )}
      {filteredOrders.map((order) => (
        <article key={order.id} className="admin-surface p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={selectedOrderIds.includes(order.id)}
              onChange={() => toggleOrderSelection(order.id)}
              aria-label={`Selecionar pedido ${shortId(order.id)}`}
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setDetails({ open: true, orderId: order.id })}
                className="text-left text-sm font-semibold text-white"
              >
                Pedido {shortId(order.id)}
              </button>
              <p className="mt-1 truncate text-sm text-slate-300">
                {order.customer_name || order.profile?.full_name || 'Cliente'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {fmtDate(order.created_at)}
              </p>
            </div>
            <span className="text-sm font-semibold text-teal-100">
              {fmtBRL(order.effective_total ?? order.total)}
            </span>
          </div>
          <div className="mt-4">
            <OrderBadgeCluster order={order} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setDetails({ open: true, orderId: order.id })}
              className="admin-secondary px-2"
            >
              Detalhes
            </button>
            <button
              type="button"
              disabled={order.status !== 'paid'}
              onClick={() =>
                setActionModal({
                  open: true,
                  mode: 'status',
                  orderId: order.id,
                })
              }
              className="admin-secondary px-2"
            >
              Status
            </button>
            <button
              type="button"
              disabled={order.status !== 'paid'}
              onClick={() =>
                setActionModal({
                  open: true,
                  mode: 'tracking',
                  orderId: order.id,
                })
              }
              className="admin-secondary px-2"
            >
              Rastreio
            </button>
          </div>
        </article>
      ))}
      {!loading && !filteredOrders.length && (
        <div className="admin-surface px-5 py-10 text-center">
          <p className="text-sm text-slate-200">
            Nenhum pedido encontrado neste filtro.
          </p>
          <button
            type="button"
            onClick={clearOrderSearchAndFilters}
            className="admin-secondary mt-4"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  )
}
