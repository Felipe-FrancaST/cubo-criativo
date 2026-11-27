import React from 'react'
import { supabase } from '../lib/supabaseClient.js'
import './shipping-selector.css'

const brl = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const digitsOnly = value => String(value || '').replace(/\D/g, '').slice(0, 8)
const formatZip = value => {
  const digits = digitsOnly(value)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/**
 * Na personalização e renovação, preserva a cotação automática autenticada.
 * No carrinho e assinatura (manual=true), aceita CEP explícito sem login e só consulta ao clicar.
 * Uma alteração no pedido ou no CEP descarta imediatamente a cotação anterior.
 */
export default function ShippingSelector({
  token,
  userId,
  request,
  onSelect,
  active = true,
  disabled = false,
  onRequireProfile,
  manual = false,
}) {
  const signature = JSON.stringify(request || {})
  const [quote, setQuote] = React.useState(null)
  const [selected, setSelected] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [zipInput, setZipInput] = React.useState('')
  const [needsRecalculation, setNeedsRecalculation] = React.useState(false)
  const [revision, refresh] = React.useReducer(value => value + 1, 0)
  const requestRef = React.useRef(null)
  const inFlightRef = React.useRef(false)
  const generationRef = React.useRef(0)
  const quotedRef = React.useRef(false)
  const touchedZipRef = React.useRef(false)
  const zipId = React.useId()

  // Preenche o CEP cadastrado por comodidade; o visitante pode informar qualquer CEP.
  // Não substitui um CEP que o comprador já digitou.
  React.useEffect(() => {
    if (!manual || !active || !token || !userId || touchedZipRef.current) return undefined
    let cancelled = false
    void supabase.from('profiles').select('zip').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!cancelled && !touchedZipRef.current && /^\d{8}$/.test(digitsOnly(data?.zip))) {
        setZipInput(formatZip(data.zip))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [manual, active, token, userId])

  // O carrinho não cota automaticamente: nem ao abrir, nem ao mudar quantidade.
  React.useEffect(() => {
    if (!manual) return undefined
    generationRef.current += 1
    requestRef.current?.abort()
    inFlightRef.current = false
    setBusy(false)
    setQuote(null)
    setSelected('')
    setError('')
    onSelect?.(null)
    if (quotedRef.current && active) setNeedsRecalculation(true)
    if (!active) {
      quotedRef.current = false
      setNeedsRecalculation(false)
    }
    return undefined
    // O objeto do pedido é serializado para reagir apenas a mudanças reais dos itens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, active, signature, token])

  // As demais páginas continuam com o comportamento anterior.
  React.useEffect(() => {
    if (manual) return undefined
    const controller = new AbortController()
    let cancelled = false
    setSelected('')
    setQuote(null)
    setError('')
    onSelect?.(null)
    if (!token || !active || !request) return () => { cancelled = true; controller.abort() }
    const run = async () => {
      setBusy(true)
      try {
        const response = await fetch('/api/shipping?op=quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: signature,
          signal: controller.signal,
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
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') setError(e.message || 'Não foi possível calcular o frete.')
      } finally { if (!cancelled) setBusy(false) }
    }
    void run()
    return () => { cancelled = true; controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, token, active, signature, revision])

  function changeZip(value) {
    touchedZipRef.current = true
    setZipInput(formatZip(value))
    generationRef.current += 1
    requestRef.current?.abort()
    inFlightRef.current = false
    setBusy(false)
    setSelected('')
    setQuote(null)
    setError('')
    onSelect?.(null)
    if (quotedRef.current) setNeedsRecalculation(true)
  }

  async function calculateManualShipping(event) {
    event?.preventDefault()
    const zip = digitsOnly(zipInput)
    if (inFlightRef.current || busy || disabled || !active || !request) return
    if (!/^\d{8}$/.test(zip)) {
      setError('Informe um CEP válido com 8 números para calcular o frete.')
      return
    }
    generationRef.current += 1
    const generation = generationRef.current
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    inFlightRef.current = true
    setQuote(null)
    setSelected('')
    setError('')
    onSelect?.(null)
    setBusy(true)
    try {
      const response = await fetch('/api/shipping?op=quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...JSON.parse(signature), destination_zip: zip }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Muitas consultas em sequência. Aguarde um minuto antes de calcular novamente.')
        }
        throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível calcular o frete.')
      }
      if (controller.signal.aborted || generationRef.current !== generation) return
      setQuote(data)
      quotedRef.current = true
      setNeedsRecalculation(false)
      if (!data.options?.length) setError('Nenhuma modalidade atende a esse CEP e às medidas do pedido. Consulte nossa equipe.')
    } catch (e) {
      if (controller.signal.aborted || generationRef.current !== generation) return
      setError(e.message || 'Não foi possível calcular o frete.')
    } finally {
      if (generationRef.current === generation) {
        setBusy(false)
        inFlightRef.current = false
        requestRef.current = null
      }
    }
  }

  const options = quote?.options || []
  return (
    <section className="shipping-selector" aria-label="Escolha o frete">
      <div className="shipping-selector-head">
        <div><span className="material-icons" aria-hidden="true">local_shipping</span><strong>Entrega do pedido</strong></div>
        {quote?.destination_zip ? <small>CEP {formatZip(quote.destination_zip)}</small> : null}
      </div>
      {manual ? (
        <form className="shipping-manual-form" onSubmit={calculateManualShipping}>
          <label htmlFor={zipId}>CEP de entrega</label>
          <div className="shipping-manual-controls">
            <input
              id={zipId}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              maxLength={9}
              value={zipInput}
              onChange={event => changeZip(event.target.value)}
              disabled={disabled}
              aria-label="CEP para calcular o frete"
            />
            <button className="shipping-refresh shipping-calculate" type="submit" disabled={disabled || busy || !active || !request}>
              {busy ? <span className="shipping-spinner" /> : <span className="material-icons" aria-hidden="true">calculate</span>}
              {busy ? 'Calculando…' : needsRecalculation ? 'Recalcular frete' : 'Calcular frete'}
            </button>
          </div>
        </form>
      ) : null}
      {busy && !manual ? <div className="shipping-selector-hint" role="status"><span className="shipping-spinner" /> Consultando modalidades na SuperFrete…</div> : null}
      {!token && !manual ? <p className="shipping-selector-hint">Entre na sua conta para consultar as opções pelo CEP cadastrado.</p> : null}
      {manual && needsRecalculation && !busy && !quote && !error ? (
        <p className="shipping-selector-hint" role="status">{request?.type === 'vip' ? 'O plano ou CEP mudou. Clique em' : 'O carrinho ou CEP mudou. Clique em'} <strong>Calcular frete</strong> para atualizar o valor.</p>
      ) : null}
      {!!error && <div className="shipping-selector-error" role="alert">{error}</div>}
      {!busy && options.map(option => (
        <button key={option.service_id} type="button" disabled={disabled}
          aria-pressed={selected === option.service_id}
          className={`shipping-option ${selected === option.service_id ? 'selected' : ''}`}
          onClick={() => {
            setSelected(option.service_id)
            onSelect?.({ ...option, destination_zip: quote?.destination_zip, request_signature: signature })
          }}>
          <span className="shipping-radio" aria-hidden="true" />
          <span className="shipping-option-title"><b>{option.service_name}</b><small>{option.carrier} · {option.parcels_count} {option.parcels_count === 1 ? 'volume' : 'volumes'}{option.delivery_days !== null ? ` · até ${option.delivery_days} dias úteis estimados` : ''}</small></span>
          <strong>{brl(option.price_cents)}</strong>
        </button>
      ))}
      {!manual && !busy && !!token && <button type="button" disabled={disabled} className="shipping-refresh" onClick={() => refresh()}><span className="material-icons" aria-hidden="true">refresh</span> Recalcular frete</button>}
      {!!quote?.options?.length && <p className="shipping-selector-fineprint">O valor inclui a taxa de embalagem aplicada uma única vez ao pedido. Prazos são estimativas da transportadora.</p>}
    </section>
  )
}
