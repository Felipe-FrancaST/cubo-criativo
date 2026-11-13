import React from 'react'

const money = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'})
export default function ShippingOrderDetails({ orderId, accessToken }) {
  const [shipping, setShipping] = React.useState(null)
  React.useEffect(() => {
    if (!orderId || !accessToken) return
    let cancelled = false
    setShipping(null)
    fetch(`/api/shipping?op=order&order_id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(response => response.ok ? response.json() : null)
      .then(data => { if (!cancelled) setShipping(data?.shipping || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orderId, accessToken])
  if (!shipping) return null
  return (
    <section aria-label="Detalhes do frete" className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4 text-slate-200">
      <div className="flex items-center gap-2 text-sm font-semibold text-white"><span className="material-icons text-cyan-300" aria-hidden="true">local_shipping</span> Frete SuperFrete</div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-slate-400">Modalidade:</span> {shipping.service_name}</div>
        <div><span className="text-slate-400">Transportadora:</span> {shipping.carrier}</div>
        <div><span className="text-slate-400">Valor do frete:</span> <strong>{money(shipping.total_cents)}</strong></div>
        <div><span className="text-slate-400">Volumes:</span> {shipping.parcels?.length || 0}</div>
        <div><span className="text-slate-400">CEP destino:</span> {String(shipping.destination_zip || '').replace(/^(\d{5})(\d{3})$/, '$1-$2')}</div>
        <div><span className="text-slate-400">Prazo estimado:</span> {shipping.delivery_days == null ? 'Consulte a transportadora' : `${shipping.delivery_days} dias úteis`}</div>
      </div>
      {Array.isArray(shipping.parcels) && shipping.parcels.length > 0 && <details className="mt-3 rounded-xl border border-white/10 p-3 text-xs"><summary className="cursor-pointer font-semibold">Ver caixas e medidas</summary>
        <ul className="mt-2 space-y-1">{shipping.parcels.map((p,i) => <li key={i}>Caixa {i+1}: {p.length} × {p.width} × {p.height} cm · {Number(p.weight) * 1000} g · {p.category}</li>)}</ul>
      </details>}
    </section>
  )
}
