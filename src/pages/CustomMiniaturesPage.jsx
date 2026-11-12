import React from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getAffiliateCheckoutContext } from '../lib/affiliate.js'
import './custom-miniatures.css'

const API = '/api/core?api_action=custom-miniatures'
const MAX_FILES = 6
const MAX_SIZE = 10 * 1024 * 1024
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const money = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
})
const types = [
  { id: 'miniatura', icon: 'smart_toy', name: 'Miniatura', subtitle: 'O personagem completo, da cabeça aos pés' },
  { id: 'busto', icon: 'face_6', name: 'Busto', subtitle: 'Retrato tridimensional, com foco nos detalhes' },
]
const statusNames = {
  draft: 'Rascunho', processing: 'Preparando pagamento', pending: 'Aguardando pagamento',
  paid: 'Pagamento confirmado', failed: 'Pagamento não concluído',
  cancelled: 'Cancelado',
}
const productionNames = {
  aguardando_pagamento: 'Aguardando pagamento', recebido: 'Pedido recebido',
  em_analise: 'Em análise', em_producao: 'Em produção',
  finalizado: 'Finalizado', enviado: 'Enviado', cancelado: 'Cancelado',
}

async function apiCall(op, { accessToken, method = 'GET', body, signal } = {}) {
  const res = await fetch(`${API}&op=${encodeURIComponent(op)}`, {
    method, signal, cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Falha ao comunicar com a loja.')
  return payload
}

function StepHeading({ number, title, sub }) {
  return (
    <div className="cm-step-title">
      <span className="cm-step-number">{String(number).padStart(2, '0')}</span>
      <div>
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
    </div>
  )
}

function StatusPill({ request }) {
  const paid = request?.payment_status === 'paid'
  return (
    <span className={`cm-status ${paid ? 'is-paid' : ''}`}>
      <span className="material-icons" aria-hidden="true">{paid ? 'check_circle' : 'schedule'}</span>
      {paid ? productionNames[request.production_status] || 'Pagamento confirmado' : statusNames[request?.payment_status] || 'Em análise'}
    </span>
  )
}

export default function CustomMiniaturesPage({ user, accessToken, onRequireLogin, onGoHome, onOpenOrders }) {
  const [settings, setSettings] = React.useState(null)
  const [configError, setConfigError] = React.useState('')
  const [kind, setKind] = React.useState('miniatura')
  const [notes, setNotes] = React.useState('')
  const [files, setFiles] = React.useState([])
  const fileRef = React.useRef(null)
  const filesRef = React.useRef([])
  const [dragActive, setDragActive] = React.useState(false)
  const [couponCode, setCouponCode] = React.useState('')
  const [discount, setDiscount] = React.useState(null)
  const [quoteBusy, setQuoteBusy] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState('pix')
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState('')
  const [pixData, setPixData] = React.useState(null)
  const [confirmedOrder, setConfirmedOrder] = React.useState('')
  const [mine, setMine] = React.useState([])
  const [mineLoading, setMineLoading] = React.useState(false)
  const [expandedRequest, setExpandedRequest] = React.useState(null)
  const [returnInfo, setReturnInfo] = React.useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('payment') ? { payment: params.get('payment'), orderId: params.get('order_id') } : null
  })

  React.useEffect(() => {
    let alive = true
    apiCall('config').then(data => {
      if (alive) setSettings(data.settings)
    }).catch(err => {
      if (alive) setConfigError(err.message)
    })
    return () => { alive = false }
  }, [])

  React.useEffect(() => {
    filesRef.current = files
  }, [files])
  React.useEffect(() => () => {
    filesRef.current.forEach(item => URL.revokeObjectURL(item.preview))
  }, [])

  const refreshMine = React.useCallback(async ({ silent = false } = {}) => {
    if (!user || !accessToken) return
    if (!silent) setMineLoading(true)
    try {
      const result = await apiCall('mine', { accessToken })
      const current = result.requests || []
      setMine(current)
      // Estado de cobrança vem sempre do servidor. A confirmação visual ocorre
      // no efeito abaixo, inclusive se a atualização chegou pelo webhook.
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setMineLoading(false)
    }
  }, [user, accessToken])

  React.useEffect(() => {
    if (user && accessToken) refreshMine()
    else setMine([])
  }, [user, accessToken, refreshMine])

  React.useEffect(() => {
    if (pixData?.orderId && mine.some(item => item.order_id === pixData.orderId && item.payment_status === 'paid')) {
      setConfirmedOrder(pixData.orderId)
      setPixData(null)
    }
  }, [mine, pixData])

  const verifyPayment = React.useCallback(async orderId => {
    if (!orderId || !user || !accessToken) return false
    const result = await apiCall('verify-payment', {
      method: 'POST', accessToken, body: { order_id: orderId },
    })
    if (result.payment_status === 'paid' || result.status === 'paid') {
      setPixData(previous => previous?.orderId === orderId ? null : previous)
      setConfirmedOrder(orderId)
      await refreshMine({ silent: true })
      return true
    }
    return false
  }, [user, accessToken, refreshMine])

  // Pix: verificação automática e contínua enquanto o QR está visível.
  // Faz a confirmação somente com dados do servidor/Mercado Pago.
  React.useEffect(() => {
    if (!pixData?.orderId || !user || !accessToken) return undefined
    const orderId = pixData.orderId
    let cancelled = false
    let checking = false
    const check = async () => {
      if (checking || cancelled) return
      checking = true
      try { await verifyPayment(orderId) } catch (err) { if (!cancelled) console.error('custom pix status', err) }
      finally { checking = false }
    }
    check()
    const timer = window.setInterval(check, 4000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [pixData?.orderId, user, accessToken, verifyPayment])

  // Retorno do cartão: a URL de sucesso não basta como prova do pagamento.
  React.useEffect(() => {
    if (!returnInfo?.orderId || !user || !accessToken || confirmedOrder === returnInfo.orderId) return undefined
    let count = 0
    let checking = false
    const check = async () => {
      if (checking) return
      checking = true
      try {
        await verifyPayment(returnInfo.orderId)
        await refreshMine({ silent: true })
      } catch (err) { console.error('custom card return status', err) }
      finally { checking = false }
      count += 1
      if (count >= 30) window.clearInterval(timer)
    }
    check()
    const timer = window.setInterval(check, 4000)
    return () => window.clearInterval(timer)
  }, [returnInfo?.orderId, user, accessToken, confirmedOrder, refreshMine, verifyPayment])

  const addFiles = React.useCallback((list) => {
    if (busy || pixData || confirmedOrder) return
    const incoming = Array.from(list || [])
    if (!incoming.length) return
    setError('')
    if (incoming.length + filesRef.current.length > MAX_FILES) {
      setError('O limite é de 6 imagens por pedido.')
      return
    }
    if (incoming.some(file => !MIME_TYPES.includes(file.type) || file.size < 1 || file.size > MAX_SIZE)) {
      setError('Selecione imagens JPG, PNG ou WEBP com até 10 MB por arquivo.')
      return
    }
    const next = incoming.map(file => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file),
    }))
    filesRef.current = [...filesRef.current, ...next]
    setFiles(filesRef.current)
  }, [busy, pixData, confirmedOrder])

  function removeFile(id) {
    const match = files.find(item => item.id === id)
    if (match) URL.revokeObjectURL(match.preview)
    const next = files.filter(item => item.id !== id)
    filesRef.current = next
    setFiles(next)
    setError('')
  }
  function resetForm() {
    filesRef.current.forEach(item => URL.revokeObjectURL(item.preview))
    filesRef.current = []
    setFiles([])
    setNotes('')
    setCouponCode('')
    setDiscount(null)
    setPixData(null)
    setConfirmedOrder('')
    setReturnInfo(null)
    const cleanUrl = new URL(window.location.href)
    for (const key of ['payment', 'provider', 'order_id']) cleanUrl.searchParams.delete(key)
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)
    setError('')
    setProgress('')
    setPaymentMethod('pix')
    refreshMine({ silent: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const price = kind === 'busto' ? settings?.bust_price_cents : settings?.miniature_price_cents
  const totalCents = Math.max(0, Number(price || 0) - Number(discount?.discount_cents || 0))
  const paymentReady = !!settings && files.length > 0 && !busy && !pixData && !confirmedOrder
  const returnedOrder = mine.find(request => request.order_id && request.order_id === returnInfo?.orderId)

  async function applyCoupon() {
    setError('')
    const code = couponCode.trim().toUpperCase()
    if (!code) { setDiscount(null); return }
    if (!user || !accessToken) { onRequireLogin?.('Faça login para aplicar o cupom.'); return }
    setQuoteBusy(true)
    try {
      const quote = await apiCall('quote', {
        method: 'POST', accessToken,
        body: { kind, coupon_code: code },
      })
      setDiscount({ ...quote, code })
    } catch (err) {
      setDiscount(null)
      setError(err.message)
    } finally {
      setQuoteBusy(false)
    }
  }

  async function startCheckout() {
    if (busy || pixData || confirmedOrder) return
    setError('')
    if (!files.length) { setError('Adicione ao menos uma imagem de referência antes de pagar.'); return }
    if (!user || !accessToken) { onRequireLogin?.('Entre ou crie sua conta para enviar o pedido personalizado.'); return }
    if (!settings) { setError('O preço ainda não foi carregado.'); return }
    if (couponCode.trim() && discount?.code !== couponCode.trim().toUpperCase()) {
      setError('Aplique o cupom ou remova o código antes de continuar.')
      return
    }
    setBusy(true)
    let requestCreated = false
    try {
      setProgress('Preparando imagens…')
      const prepared = await apiCall('prepare', {
        method: 'POST', accessToken,
        body: {
          kind, notes,
          files: files.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
        },
      })
      requestCreated = true
      for (let i = 0; i < prepared.slots.length; i += 1) {
        setProgress(`Enviando referências… ${i + 1} de ${prepared.slots.length}`)
        const slot = prepared.slots[i]
        const file = files[i].file
        const { error: uploadError } = await supabase.storage.from('custom-miniature-references')
          .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type, upsert: false })
        if (uploadError) throw new Error(`Falha ao enviar ${file.name}. Confira sua conexão e tente novamente.`)
      }
      setProgress('Validando pedido e gerando pagamento seguro…')
      const result = await apiCall('checkout', {
        method: 'POST', accessToken,
        body: {
          request_id: prepared.request_id,
          kind, payment_method: paymentMethod,
          coupon_code: discount?.code || '',
          ...getAffiliateCheckoutContext(),
          expected_total_cents: totalCents,
        },
      })
      if (paymentMethod === 'card') {
        if (!result.checkout_url) throw new Error('Link do cartão indisponível.')
        window.location.assign(result.checkout_url)
        return
      }
      if (!result.pix?.qr_code) throw new Error('Código Pix indisponível.')
      setPixData({ ...result.pix, orderId: result.order_id, amount: result.total_cents })
      await refreshMine({ silent: true })
    } catch (err) {
      if (/preço do pedido foi atualizado/i.test(err.message)) {
        try {
          const fresh = await apiCall('config')
          setSettings(fresh.settings)
          setDiscount(null)
        } catch { /* A mensagem original continua visível. */ }
      }
      setError(requestCreated
        ? `${err.message} Se as imagens já foram enviadas, confira seus pedidos antes de uma nova tentativa.`
        : err.message)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function reopenPix(request) {
    setError('')
    try {
      const response = await apiCall('reopen-pix', {
        method: 'POST', accessToken, body: { request_id: request.id },
      })
      setConfirmedOrder('')
      setPixData({ ...response.pix, orderId: response.order_id, amount: response.total_cents })
      window.setTimeout(() => document.getElementById('cm-pix-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
    } catch (err) { setError(err.message) }
  }

  const bullet = (icon, text) => (
    <div className="cm-benefit" key={text}>
      <span className="material-icons" aria-hidden="true">{icon}</span>
      {text}
    </div>
  )

  return (
    <main className="cm-page">
      <div className="cm-shell">
        <div className="cm-breadcrumb">
          <button type="button" onClick={onGoHome}>Início</button>
          <span className="material-icons" aria-hidden="true">chevron_right</span>
          <span>Miniaturas personalizadas</span>
        </div>

        <header className="cm-hero">
          <div className="cm-hero-glow" aria-hidden="true" />
          <div className="cm-hero-copy">
            <span className="cm-eyebrow"><span className="material-icons">auto_awesome</span> CRIADO PARA VOCÊ</span>
            <h1>Seu personagem.<br /><em>Uma peça única.</em></h1>
            <p>Transforme uma ideia, ilustração ou personagem favorito em uma miniatura feita sob medida. Envie suas referências e conte como você imagina cada detalhe.</p>
            <div className="cm-hero-points">
              {bullet('image', 'Referências por imagem')}
              {bullet('shield', 'Pagamento seguro')}
              {bullet('design_services', 'Projeto personalizado')}
            </div>
          </div>
          <div className="cm-hero-art" aria-hidden="true">
            <div className="cm-art-halo" />
            <span className="material-icons cm-art-icon">view_in_ar</span>
            <div className="cm-art-base"><span>SEU PROJETO • SUA HISTÓRIA</span></div>
            <div className="cm-art-tag"><span className="material-icons">stars</span> Exclusivo</div>
          </div>
        </header>

        {confirmedOrder && !returnInfo ? (
          <div className="cm-confirmation" role="status" aria-live="polite">
            <div className="cm-confirmation-icon"><span className="material-icons">check_circle</span></div>
            <div className="cm-confirmation-copy">
              <h2>Compra efetuada com sucesso!</h2>
              <p>Pagamento confirmado. Seu {kind === 'busto' ? 'busto personalizado' : 'pedido de miniatura personalizada'} foi recebido e já aparece em <strong>Meus pedidos</strong>.</p>
              <span>Pedido #{String(confirmedOrder).slice(0, 8).toUpperCase()}</span>
            </div>
            {onOpenOrders ? <button type="button" onClick={onOpenOrders}>Ver meus pedidos <span className="material-icons">arrow_forward</span></button> : null}
          </div>
        ) : null}

        {returnInfo ? (
          <div className={`cm-return ${returnedOrder?.payment_status === 'paid' || confirmedOrder === returnInfo.orderId ? 'is-confirmed' : ''}`} role="status">
            <span className="material-icons" aria-hidden="true">{returnedOrder?.payment_status === 'paid' || confirmedOrder === returnInfo.orderId ? 'verified' : 'hourglass_top'}</span>
            <div>
              <strong>{returnedOrder?.payment_status === 'paid' || confirmedOrder === returnInfo.orderId ? 'Compra efetuada com sucesso!' : returnInfo.payment === 'cancel' ? 'Pagamento não concluído' : 'Aguardando confirmação do Mercado Pago'}</strong>
              <p>{returnedOrder?.payment_status === 'paid' || confirmedOrder === returnInfo.orderId ? 'Pagamento confirmado! Seu pedido de personalização já está em Meus pedidos.' : 'O retorno do checkout não confirma a cobrança. O status será atualizado após a confirmação do Mercado Pago.'}</p>
              {(returnedOrder?.payment_status === 'paid' || confirmedOrder === returnInfo.orderId) && onOpenOrders ? (
                <button type="button" className="cm-return-orders" onClick={onOpenOrders}>Ver meus pedidos <span className="material-icons">arrow_forward</span></button>
              ) : null}
            </div>
            <button type="button" onClick={() => {
              setReturnInfo(null)
              const url = new URL(window.location.href)
              url.searchParams.delete('payment')
              url.searchParams.delete('provider')
              url.searchParams.delete('order_id')
              window.history.replaceState({}, '', `${url.pathname}${url.search}`)
            }} aria-label="Dispensar aviso"><span className="material-icons">close</span></button>
          </div>
        ) : null}

        <div className="cm-content-grid">
          <div className="cm-editor">
            <section className="cm-panel">
              <StepHeading number={1} title="Escolha o formato" sub="Que tipo de peça você deseja criar?" />
              <div className="cm-types" role="radiogroup" aria-label="Tipo de peça">
                {types.map(type => (
                  <button type="button" role="radio" aria-checked={kind === type.id}
                    key={type.id} className={`cm-type ${kind === type.id ? 'is-selected' : ''}`}
                    disabled={busy || !!pixData || !!confirmedOrder}
                    onClick={() => { setKind(type.id); setDiscount(null); setError('') }}>
                    <span className="cm-type-icon"><span className="material-icons">{type.icon}</span></span>
                    <span className="cm-type-main"><strong>{type.name}</strong><small>{type.subtitle}</small></span>
                    <span className="cm-type-check material-icons">{kind === type.id ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="cm-panel">
              <StepHeading number={2} title="Envie suas referências" sub="Imagens nos ajudam a entender seu personagem e os detalhes desejados." />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple
                className="cm-sr-only" aria-label="Selecionar referências em imagens"
                onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
              <div className={`cm-dropzone ${dragActive ? 'is-dragging' : ''}`}
                onDragOver={event => { event.preventDefault(); setDragActive(true) }}
                onDragLeave={event => { event.preventDefault(); setDragActive(false) }}
                onDrop={event => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files) }}>
                <div className="cm-upload-icon"><span className="material-icons">cloud_upload</span></div>
                <h3>Arraste suas imagens para cá</h3>
                <p>Ou escolha fotos, desenhos ou referências do seu dispositivo.</p>
                <button type="button" className="cm-upload-button" onClick={() => fileRef.current?.click()}
                  disabled={busy || !!pixData || !!confirmedOrder || files.length >= MAX_FILES}>
                  <span className="material-icons">add_photo_alternate</span> Selecionar imagens
                </button>
                <small>JPG, PNG ou WEBP · Até 10 MB cada · Máximo 6 imagens</small>
              </div>
              <div className="cm-files-topline">
                <span><span className="material-icons">collections</span> Referências selecionadas</span>
                <strong>{files.length}/{MAX_FILES}</strong>
              </div>
              {files.length ? (
                <div className="cm-file-grid">
                  {files.map((item, idx) => (
                    <div className="cm-file" key={item.id}>
                      <img src={item.preview} alt={`Referência ${idx + 1}: ${item.file.name}`} />
                      <button type="button" aria-label={`Remover ${item.file.name}`} title="Remover imagem"
                        onClick={() => removeFile(item.id)} disabled={busy || !!pixData || !!confirmedOrder}>
                        <span className="material-icons">close</span>
                      </button>
                      <span className="cm-file-number">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cm-file-empty"><span className="material-icons">info</span> Obrigatório: envie pelo menos uma imagem para liberar o pagamento.</p>
              )}
            </section>

            <section className="cm-panel">
              <StepHeading number={3} title="Conte sobre sua ideia" sub="Opcional, mas quanto mais detalhes você fornecer, melhor." />
              <label className="cm-form-label" htmlFor="custom-notes">Descrição e observações</label>
              <textarea id="custom-notes" rows={5} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}
                placeholder="Ex.: Guerreiro com espada longa, armadura escura, base rochosa, expressão determinada..." />
              <div className="cm-field-footer"><span>Inclua pose, roupas, acessórios ou qualquer detalhe importante.</span><span>{notes.length}/2000</span></div>
            </section>
          </div>

          <aside className="cm-summary-wrap" aria-label="Resumo do pedido">
            <div className="cm-summary">
              <div className="cm-summary-head">
                <span className="material-icons">receipt_long</span>
                <div><strong>Resumo do pedido</strong><small>Encomenda personalizada</small></div>
              </div>
              <div className="cm-summary-product">
                <div className="cm-summary-product-icon"><span className="material-icons">{kind === 'busto' ? 'face_6' : 'smart_toy'}</span></div>
                <div><strong>{kind === 'busto' ? 'Busto personalizado' : 'Miniatura personalizada'}</strong><small>1 peça personalizada</small></div>
              </div>
              <div className="cm-prices">
                <div><span>Valor da personalização</span><span>{settings ? money(price) : 'Carregando…'}</span></div>
                {discount?.discount_cents ? <div className="cm-discount"><span>Cupom {discount.code}</span><span>− {money(discount.discount_cents)}</span></div> : null}
              </div>
              <div className="cm-coupon">
                <label htmlFor="cm-coupon-code"><span className="material-icons">sell</span> Tem um cupom?</label>
                <div className="cm-coupon-control">
                  <input id="cm-coupon-code" value={couponCode} maxLength={50} placeholder="Código do cupom"
                    onChange={event => { setCouponCode(event.target.value.toUpperCase()); setDiscount(null) }} />
                  <button type="button" onClick={applyCoupon} disabled={!couponCode.trim() || quoteBusy || busy || !!pixData || !!confirmedOrder}>
                    {quoteBusy ? 'Verificando…' : 'Aplicar'}
                  </button>
                </div>
                {discount ? <p className="cm-coupon-success"><span className="material-icons">check_circle</span> Cupom aplicado: {discount.coupon_label || discount.code}</p> : null}
              </div>
              <div className="cm-total"><span>Total</span><strong>{settings ? money(totalCents) : '—'}</strong></div>
              <p className="cm-shipping">O valor apresentado é da personalização. Eventual frete não está incluído.</p>
              <div className="cm-payment-head">FORMA DE PAGAMENTO</div>
              <div className="cm-payments">
                <button type="button" className={paymentMethod === 'pix' ? 'is-selected' : ''}
                  aria-pressed={paymentMethod === 'pix'} disabled={busy || !!pixData || !!confirmedOrder} onClick={() => setPaymentMethod('pix')}>
                  <span className="material-icons">qr_code_2</span><span><strong>Pix</strong><small>QR Code ou copia e cola</small></span><span className="material-icons cm-radio">{paymentMethod === 'pix' ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                </button>
                <button type="button" className={paymentMethod === 'card' ? 'is-selected' : ''}
                  aria-pressed={paymentMethod === 'card'} disabled={busy || !!pixData || !!confirmedOrder} onClick={() => setPaymentMethod('card')}>
                  <span className="material-icons">credit_card</span><span><strong>Cartão</strong><small>Checkout seguro Mercado Pago</small></span><span className="material-icons cm-radio">{paymentMethod === 'card' ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                </button>
              </div>
              {error ? <div className="cm-error" role="alert"><span className="material-icons">error_outline</span><span>{error}</span></div> : null}
              {configError ? <div className="cm-error" role="alert">{configError}</div> : null}
              {pixData || confirmedOrder ? (
                <button type="button" className="cm-submit cm-submit-new" onClick={resetForm}>Criar outro pedido <span className="material-icons">add</span></button>
              ) : (
                <button type="button" className="cm-submit" onClick={startCheckout}
                  disabled={!paymentReady} aria-disabled={!paymentReady}>
                  <span className="material-icons">{busy ? 'sync' : paymentMethod === 'pix' ? 'qr_code_2' : 'lock'}</span>
                  {busy ? 'Preparando pedido…' : !files.length ? 'Adicione imagens para continuar' : !user ? 'Entrar e continuar' : paymentMethod === 'pix' ? 'Gerar Pix e finalizar' : 'Pagar com cartão'}
                  {!busy ? <span className="material-icons">arrow_forward</span> : null}
                </button>
              )}
              {!user ? <button className="cm-login-link" type="button" onClick={() => onRequireLogin?.('Entre ou crie sua conta para solicitar uma miniatura personalizada.')}>Já tem conta? Entre aqui</button> : null}
              {progress ? <div className="cm-progress" role="status"><span className="cm-spinner" />{progress}</div> : null}
              <p className="cm-security"><span className="material-icons">verified_user</span> Login protegido e pagamento processado pelo Mercado Pago.</p>
            </div>
          </aside>
        </div>

        {pixData ? (
          <section className="cm-pix" aria-labelledby="cm-pix-heading" role="status">
            <div>
              <span className="cm-eyebrow"><span className="material-icons">qr_code_2</span> PAGAMENTO PIX</span>
              <h2 id="cm-pix-heading">Seu Pix está pronto</h2>
              <p>Escaneie o QR Code ou copie o código no aplicativo do banco. O pedido será confirmado após a notificação de pagamento.</p>
              <div className="cm-pix-amount">Valor: <strong>{money(pixData.amount)}</strong></div>
            </div>
            <div className="cm-pix-code">
              {pixData.qr_code_base64 ? <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix do seu pedido" /> : null}
              <button type="button" onClick={async () => {
                try { await navigator.clipboard.writeText(pixData.qr_code); setProgress('Código Pix copiado!') }
                catch { setProgress('Não foi possível copiar. Selecione o código abaixo.') }
              }}><span className="material-icons">content_copy</span> Copiar Pix</button>
              <textarea value={pixData.qr_code} readOnly rows={2} aria-label="Código Pix copia e cola" onFocus={event => event.target.select()} />
              <button className="cm-refresh" type="button" onClick={() => verifyPayment(pixData.orderId).catch(err => setError(err.message))}>Verificar pagamento agora</button>
            </div>
          </section>
        ) : null}

        {user ? (
          <section className="cm-history">
            <div className="cm-history-head">
              <div><span className="cm-eyebrow"><span className="material-icons">history</span> ACOMPANHAMENTO</span>
                <h2>Suas encomendas personalizadas</h2><p>Consulte o andamento dos seus pedidos.</p></div>
              <button type="button" onClick={() => refreshMine()} disabled={mineLoading}><span className="material-icons">refresh</span> Atualizar</button>
            </div>
            {mineLoading && !mine.length ? <div className="cm-history-empty">Carregando suas encomendas…</div> : null}
            {!mineLoading && !mine.length ? <div className="cm-history-empty">Seus pedidos personalizados aparecerão aqui após o envio para pagamento.</div> : null}
            <div className="cm-orders">
              {mine.map(request => (
                <article className="cm-order" key={request.id}>
                  <div className="cm-order-row">
                    <span className="cm-order-preview">
                      {request.image_urls?.[0] ? <img src={request.image_urls[0]} alt="Referência do pedido" /> : <span className="material-icons">view_in_ar</span>}
                    </span>
                    <div className="cm-order-title"><strong>{request.kind === 'busto' ? 'Busto' : 'Miniatura'} personalizada</strong>
                      <small>{new Date(request.created_at).toLocaleDateString('pt-BR')} · #{String(request.id).slice(0, 8).toUpperCase()}</small>
                      <StatusPill request={request} /></div>
                    <div className="cm-order-actions"><strong>{money(request.total_cents)}</strong>
                      <button type="button" onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}>
                        {expandedRequest === request.id ? 'Ocultar' : 'Ver detalhes'} <span className="material-icons">expand_more</span>
                      </button>
                    </div>
                  </div>
                  {expandedRequest === request.id ? (
                    <div className="cm-order-detail">
                      <div><strong>Pagamento:</strong> {statusNames[request.payment_status] || request.payment_status}</div>
                      <div><strong>Produção:</strong> {productionNames[request.production_status] || request.production_status}</div>
                      <div><strong>Forma:</strong> {request.payment_method === 'pix' ? 'Pix' : 'Cartão'}</div>
                      {request.payment_method === 'pix' && request.payment_status === 'pending' ? (
                        <button className="cm-order-reopen" type="button" onClick={() => reopenPix(request)}>
                          <span className="material-icons">qr_code_2</span> Reabrir Pix pendente
                        </button>
                      ) : null}
                      {request.notes ? <p>{request.notes}</p> : null}
                      <div className="cm-order-images">{(request.image_urls || []).map((url, i) => url ? <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Referência ${i+1}`} /></a> : null)}</div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {onOpenOrders ? <button type="button" className="cm-all-orders" onClick={onOpenOrders}>Ver todos os pedidos da loja <span className="material-icons">arrow_forward</span></button> : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}
