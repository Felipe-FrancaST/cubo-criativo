import React from 'react'
import './shipping-selector.css'

const brl = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Cotação autenticada: o CEP é sempre obtido do perfil no servidor. */
export default function ShippingSelector({ token, request, onSelect, active = true, disabled = false, onRequireProfile }) {
  const signature = JSON.stringify(request || {})
  const [quote, setQuote] = React.useState(null)
  const [selected, setSelected] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [revision, refresh] = React.useReducer(n => n + 1, 0)

  React.useEffect(() => {
    let cancelled = false
    setSelected(''); setQuote(null); setError('')
    onSelect?.(null)
    if (!token || !active || !request) return () => { cancelled = true }
    const run = async () => {
      setBusy(true)
      try {
        const response = await fetch('/api/shipping?op=quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: signature,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (data.code === 'profile_incomplete') onRequireProfile?.()
          throw new Error(typeof data.error === 'string' ? data.error : 'Falha ao calcular o frete.')
        }
        if (!cancelled) {
          setQuote(data)
          if (!data.options?.length) setError('Nenhuma modalidade atende a esse CEP e às medidas do pedido. Consulte nossa equipe.')
        }
      } catch (e) { if (!cancelled) setError(e.message || 'Não foi possível calcular o frete.') }
      finally { if (!cancelled) setBusy(false) }
    }
    void run()
    return () => { cancelled = true }
    // O request é serializado para não refazer cotação por mero render do componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, active, signature, revision])

  const options = quote?.options || []
  return (
    <section className="shipping-selector" aria-label="Escolha o frete">
      <div className="shipping-selector-head">
        <div><span className="material-icons" aria-hidden="true">local_shipping</span><strong>Entrega do pedido</strong></div>
        {quote?.destination_zip ? <small>CEP {quote.destination_zip.slice(0,5)}-{quote.destination_zip.slice(5)}</small> : null}
      </div>
      {busy ? <div className="shipping-selector-hint" role="status"><span className="shipping-spinner" /> Consultando modalidades na SuperFrete…</div> : null}
      {!token ? <p className="shipping-selector-hint">Entre na sua conta para consultar as opções pelo CEP cadastrado.</p> : null}
      {!!error && <div className="shipping-selector-error" role="alert">{error}</div>}
      {!busy && options.map(option => (
        <button key={option.service_id} type="button" disabled={disabled}
          aria-pressed={selected === option.service_id}
          className={`shipping-option ${selected === option.service_id ? 'selected' : ''}`}
          onClick={() => { setSelected(option.service_id); onSelect?.(option) }}>
          <span className="shipping-radio" aria-hidden="true" />
          <span className="shipping-option-title"><b>{option.service_name}</b><small>{option.carrier} · {option.parcels_count} {option.parcels_count === 1 ? 'volume' : 'volumes'}{option.delivery_days !== null ? ` · até ${option.delivery_days} dias úteis estimados` : ''}</small></span>
          <strong>{brl(option.price_cents)}</strong>
        </button>
      ))}
      {!busy && !!token && <button type="button" disabled={disabled} className="shipping-refresh" onClick={() => refresh()}><span className="material-icons" aria-hidden="true">refresh</span> Recalcular frete</button>}
      {!!quote?.options?.length && <p className="shipping-selector-fineprint">O valor inclui a taxa de embalagem aplicada uma única vez ao pedido. Prazos são estimativas da transportadora.</p>}
    </section>
  )
}
