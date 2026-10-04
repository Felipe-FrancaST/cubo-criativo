import React from 'react'
import Modal from '../components/Modal.jsx'
import VipGalleryModal from '../components/vip-area/VipGalleryModal.jsx'
import { trackEvent } from '../lib/analytics.js'
import { copyText } from '../lib/clipboard.js'
import { fmtBRL } from '../lib/pricing.js'
import { getAffiliateCheckoutContext } from '../lib/affiliate.js'

const planName = (plan) =>
  plan?.short_name || plan?.name || plan?.title || 'Plano VIP'
const planPrice = (plan) =>
  Math.max(
    0,
    Number(plan?.price_brl ?? Number(plan?.price_cents || 0) / 100) || 0
  )
const count = (value) => Math.max(0, Math.floor(Number(value) || 0))
const plural = (value, singular, pluralName = `${singular}s`) =>
  `${count(value)} ${count(value) === 1 ? singular : pluralName}`
const paidStatus = (status) =>
  ['paid', 'approved'].includes(String(status || '').toLowerCase())
const pendingStatus = (status) =>
  ['pending', 'in_process'].includes(String(status || '').toLowerCase())
function statusLabel(status) {
  if (paidStatus(status)) return 'Pagamento confirmado'
  if (
    ['failed', 'rejected', 'cancelled'].includes(
      String(status || '').toLowerCase()
    )
  )
    return 'Pagamento não aprovado'
  return 'Aguardando pagamento'
}

export default function VipRpgPage({
  user,
  accessToken,
  onOpenAuth,
  onRequireLogin,
  onOpenSettings,
  onOpenVipArea,
  onGoHome,
}) {
  const [plans, setPlans] = React.useState([])
  const [plansLoading, setPlansLoading] = React.useState(true)
  const [plansError, setPlansError] = React.useState('')
  const [selectedPlanId, setSelectedPlanId] = React.useState('')
  const [collection, setCollection] = React.useState([])
  const [cycle, setCycle] = React.useState('')
  const [collectionLoading, setCollectionLoading] = React.useState(true)
  const [collectionError, setCollectionError] = React.useState('')
  const [preview, setPreview] = React.useState(null)
  const [profile, setProfile] = React.useState(null)
  const [profileChecked, setProfileChecked] = React.useState(!accessToken)
  const [profileError, setProfileError] = React.useState('')
  const [profileRefresh, setProfileRefresh] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [method, setMethod] = React.useState('')
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [couponCode, setCouponCode] = React.useState('')
  const [couponInfo, setCouponInfo] = React.useState(null)
  const [couponBusy, setCouponBusy] = React.useState(false)
  const [pix, setPix] = React.useState(null)
  const [pixOpen, setPixOpen] = React.useState(false)
  const [pixStatus, setPixStatus] = React.useState('')
  const [pixChecking, setPixChecking] = React.useState(false)
  const [copyMessage, setCopyMessage] = React.useState('')
  const mounted = React.useRef(false)
  const checkoutLock = React.useRef(false)
  const verificationLock = React.useRef(false)
  const couponLock = React.useRef(false)
  const couponRequest = React.useRef(0)
  const plansRequest = React.useRef(0)
  const collectionRequest = React.useRef(0)
  const pendingStart = React.useRef(null)
  const checkoutRef = React.useRef(null)
  const verifyRef = React.useRef(null)
  const checkoutPanel = React.useRef(null)
  const accountKey = user?.id || accessToken || 'guest'
  const accountRef = React.useRef(accountKey)
  accountRef.current = accountKey
  const paymentRef = React.useRef(pix?.order_id)
  paymentRef.current = pix?.order_id

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      couponRequest.current += 1
      plansRequest.current += 1
      collectionRequest.current += 1
    }
  }, [])
  const loadPlans = React.useCallback(async () => {
    const request = ++plansRequest.current
    setPlansLoading(true)
    setPlansError('')
    try {
      const response = await fetch('/api/vip-plans')
      const data = await response.json().catch(() => ({}))
      if (!mounted.current || request !== plansRequest.current) return
      if (!response.ok)
        throw new Error('Não foi possível carregar os planos. Tente novamente.')
      const available = (Array.isArray(data.plans) ? data.plans : []).filter(
        (plan) => plan?.id && plan.active !== false
      )
      setPlans(available)
      setSelectedPlanId((previous) =>
        available.some((plan) => plan.id === previous)
          ? previous
          : available[0]?.id || ''
      )
    } catch {
      if (mounted.current && request === plansRequest.current)
        setPlansError(
          'Não foi possível carregar os planos. Confira sua conexão e tente novamente.'
        )
    } finally {
      if (mounted.current && request === plansRequest.current)
        setPlansLoading(false)
    }
  }, [])
  const loadCollection = React.useCallback(async () => {
    const request = ++collectionRequest.current
    setCollectionLoading(true)
    setCollectionError('')
    try {
      const response = await fetch('/api/core?action=vip-cycle')
      const data = await response.json().catch(() => ({}))
      if (!mounted.current || request !== collectionRequest.current) return
      if (!response.ok) throw new Error('Falha ao carregar coleção')
      setCollection(Array.isArray(data.items) ? data.items : [])
      setCycle(data.active_cycle_key || '')
    } catch {
      if (mounted.current && request === collectionRequest.current)
        setCollectionError(
          'Não foi possível carregar a coleção. Tente atualizar.'
        )
    } finally {
      if (mounted.current && request === collectionRequest.current)
        setCollectionLoading(false)
    }
  }, [])
  React.useEffect(() => {
    loadPlans()
    loadCollection()
  }, [loadPlans, loadCollection])
  React.useEffect(() => {
    const controller = new AbortController()
    setProfileError('')
    if (!accessToken) {
      setProfile(null)
      setProfileChecked(true)
      return () => controller.abort()
    }
    setProfileChecked(false)
    ;(async () => {
      try {
        const response = await fetch('/api/profile', {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = await response.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!response.ok)
          throw new Error('Não foi possível verificar sua assinatura.')
        setProfile(data.profile || null)
      } catch {
        if (!controller.signal.aborted)
          setProfileError(
            'Não foi possível verificar sua assinatura. Tente novamente.'
          )
      } finally {
        if (!controller.signal.aborted) setProfileChecked(true)
      }
    })()
    return () => controller.abort()
  }, [accessToken, profileRefresh])
  const isVip = Boolean(
    profile?.vip_until && new Date(profile.vip_until).getTime() > Date.now()
  )
  React.useEffect(() => {
    if (profileChecked && isVip) onOpenVipArea?.()
  }, [profileChecked, isVip, onOpenVipArea])
  React.useEffect(() => {
    setCouponInfo(null)
    setCouponCode('')
    setPix(null)
    setPixOpen(false)
    setError('')
    setMessage('')
    setBusy(false)
    setMethod('')
    setCouponBusy(false)
    setPixChecking(false)
    setPixStatus('')
    checkoutLock.current = false
    couponLock.current = false
    verificationLock.current = false
    pendingStart.current = null
    couponRequest.current += 1
  }, [accountKey])
  React.useEffect(() => {
    const resume = () => {
      const pending = pendingStart.current
      if (!pending || pending.accountKey !== accountRef.current) return
      pendingStart.current = null
      checkoutRef.current?.(pending.method, pending.planId)
    }
    window.addEventListener('profile:saved', resume)
    return () => window.removeEventListener('profile:saved', resume)
  }, [])

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null
  const price = planPrice(selectedPlan)
  const activeCoupon =
    couponInfo?.planId === selectedPlan?.id ? couponInfo : null
  const total = activeCoupon?.final_total ?? price
  const reusablePix = Boolean(
    pix?.planId === selectedPlan?.id &&
    pendingStatus(pixStatus) &&
    (pix.couponCode || '') === (activeCoupon?.code || '') &&
    Math.round(Number(pix.total) * 100) === Math.round(Number(total) * 100)
  )
  function choosePlan(id) {
    if (checkoutLock.current || id === selectedPlanId) return
    setSelectedPlanId(id)
    setCouponInfo(null)
    setCouponCode('')
    setError('')
    setMessage('')
    couponRequest.current += 1
  }
  async function applyCoupon() {
    if (!accessToken) {
      onRequireLogin?.('Faça login para usar seu cupom.')
      return
    }
    if (!selectedPlan || couponLock.current || checkoutLock.current) return
    const code = couponCode.trim().toUpperCase()
    if (!code) {
      setCouponInfo(null)
      return
    }
    const request = ++couponRequest.current
    const planId = selectedPlan.id
    couponLock.current = request
    setCouponBusy(true)
    setError('')
    setCouponInfo(null)
    try {
      const response = await fetch('/api/coupons?action=validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          code,
          subtotal: price,
          order_type: 'vip',
          vip_plan_id: planId,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!mounted.current || request !== couponRequest.current) return
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível aplicar este cupom.')
      setCouponInfo({
        planId,
        code: data.coupon?.code || code,
        discount: Number(data.discount) || 0,
        final_total: Number(data.final_total ?? price),
      })
    } catch (failure) {
      if (mounted.current && request === couponRequest.current)
        setError(
          failure instanceof TypeError
            ? 'Não foi possível aplicar o cupom. Confira sua conexão.'
            : failure.message
        )
    } finally {
      if (couponLock.current === request) {
        couponLock.current = false
        if (mounted.current) setCouponBusy(false)
      }
    }
  }

  async function startCheckout(paymentMethod, planId = selectedPlan?.id) {
    if (checkoutLock.current || couponLock.current || !planId) return
    if (!accessToken) {
      ;(onRequireLogin || onOpenAuth)?.('Faça login para assinar.')
      return
    }
    if (!profileChecked || profileError || isVip) return
    const operation = { accountKey, paymentMethod }
    checkoutLock.current = operation
    setBusy(true)
    setMethod(paymentMethod)
    setError('')
    setMessage('')
    const current = () => mounted.current && accountRef.current === accountKey
    try {
      const profileResponse = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const profileData = await profileResponse.json().catch(() => ({}))
      if (!current()) return
      if (!profileResponse.ok)
        throw new Error(
          'Não foi possível conferir seu cadastro. Tente novamente.'
        )
      const customer = profileData.profile || {}
      const complete =
        String(customer.cpf || '').replace(/\D/g, '').length === 11 &&
        customer.birthdate &&
        customer.address_line1 &&
        customer.address_number &&
        customer.city &&
        customer.state &&
        customer.zip
      const requestProfile = () => {
        pendingStart.current = { method: paymentMethod, planId, accountKey }
        onOpenSettings?.('profile', { autoClose: true })
        setError(
          'Complete CPF, data de nascimento e endereço para continuar. Seu plano fica selecionado.'
        )
      }
      if (!complete) {
        requestProfile()
        return
      }
      const coupon = activeCoupon?.planId === planId ? activeCoupon.code : null
      const response = await fetch(
        paymentMethod === 'pix'
          ? '/api/create-pix-payment'
          : '/api/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vip_plan_id: planId,
            ...(paymentMethod === 'pix'
              ? {
                  description: `Assinatura ${planName(plans.find((plan) => plan.id === planId))}`,
                }
              : {}),
            coupon_code: coupon,
            ...getAffiliateCheckoutContext(),
          }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!current()) return
      if (!response.ok) {
        if (data.code === 'profile_incomplete') {
          requestProfile()
          return
        }
        throw new Error(data.error || 'Não foi possível iniciar seu pagamento.')
      }
      if (paymentMethod === 'pix') {
        setPix({
          ...data,
          planId,
          couponCode: coupon || '',
          planName: planName(plans.find((plan) => plan.id === planId)),
          total:
            activeCoupon?.planId === planId
              ? activeCoupon.final_total
              : planPrice(plans.find((plan) => plan.id === planId)),
        })
        setPixStatus(String(data.status || 'pending').toLowerCase())
        setCopyMessage('')
        setPixOpen(true)
        trackEvent('vip_pix_created', { plan_id: planId })
      } else {
        if (!data.url)
          throw new Error(
            'O link de pagamento não ficou disponível. Tente novamente.'
          )
        trackEvent('vip_card_checkout_created', { plan_id: planId })
        window.location.assign(data.url)
      }
    } catch (failure) {
      if (current())
        setError(
          failure instanceof TypeError
            ? 'Não foi possível iniciar o pagamento. Confira sua conexão e tente novamente.'
            : failure.message
        )
    } finally {
      if (checkoutLock.current === operation) checkoutLock.current = false
      if (current()) {
        setBusy(false)
        setMethod('')
      }
    }
  }
  checkoutRef.current = startCheckout
  async function verifyPix() {
    if (
      !pix?.order_id ||
      !accessToken ||
      verificationLock.current ||
      paidStatus(pixStatus)
    )
      return
    const operation = { accountKey, orderId: pix.order_id }
    verificationLock.current = operation
    setPixChecking(true)
    setError('')
    try {
      const response = await fetch('/api/pix-payment?action=verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: pix.order_id }),
      })
      const data = await response.json().catch(() => ({}))
      if (
        !mounted.current ||
        accountRef.current !== accountKey ||
        paymentRef.current !== pix.order_id
      )
        return
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível verificar seu pagamento.'
        )
      const status = String(
        data.status || data.mp_status || 'pending'
      ).toLowerCase()
      setPixStatus(status)
      if (paidStatus(status)) {
        setMessage(
          'Pagamento confirmado! Sua Área VIP será liberada em instantes.'
        )
        setProfileRefresh((value) => value + 1)
        trackEvent('vip_pix_paid_confirmed', { plan_id: pix.planId })
      }
    } catch (failure) {
      if (
        mounted.current &&
        accountRef.current === accountKey &&
        paymentRef.current === pix.order_id
      )
        setError(
          failure instanceof TypeError
            ? 'Não foi possível verificar o Pix. Tente novamente.'
            : failure.message
        )
    } finally {
      if (verificationLock.current === operation) {
        verificationLock.current = false
        if (mounted.current) setPixChecking(false)
      }
    }
  }
  verifyRef.current = verifyPix
  React.useEffect(() => {
    if (!pix?.order_id || !accessToken || !pendingStatus(pixStatus)) return
    const timer = window.setInterval(() => {
      if (!document.hidden) verifyRef.current?.()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [pix?.order_id, accessToken, pixStatus])
  const canPay = Boolean(
    selectedPlan &&
    !busy &&
    !couponBusy &&
    profileChecked &&
    !profileError &&
    !isVip
  )

  if (accessToken && (!profileChecked || (isVip && onOpenVipArea)))
    return (
      <main className="customer-page vip-plans-page">
        <div className="container-cc customer-page-inner">
          <div className="account-empty" role="status">
            <span className="material-icons" aria-hidden="true">
              workspace_premium
            </span>
            <h1>
              {isVip ? 'Abrindo sua Área VIP…' : 'Verificando sua assinatura…'}
            </h1>
          </div>
        </div>
      </main>
    )

  return (
    <main className="customer-page vip-plans-page">
      <div className="container-cc customer-page-inner">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Clube Cubo Criativo</p>
            <h1>Sua coleção, todo mês</h1>
            <p className="customer-subtitle">
              Compare os planos VIP de RPG e encontre o seu ritmo de coleção.
            </p>
          </div>
          <button
            type="button"
            className="customer-secondary"
            onClick={onGoHome}
          >
            <span className="material-icons" aria-hidden="true">
              arrow_back
            </span>
            Loja
          </button>
        </header>
        <div className="vip-plan-highlights">
          <span>
            <span className="material-icons" aria-hidden="true">
              view_in_ar
            </span>
            Resina premium · 32 mm
          </span>
          <span>
            <span className="material-icons" aria-hidden="true">
              redeem
            </span>
            Presente mensal d20
          </span>
          <span>
            <span className="material-icons" aria-hidden="true">
              sports_esports
            </span>
            Cubo Game diário
          </span>
        </div>
        <div className="vip-subscription-layout">
          <section aria-labelledby="vip-plan-title">
            <div className="account-section-heading">
              <div>
                <h2 id="vip-plan-title">Escolha seu plano</h2>
                <p>Veja a quantidade de peças incluídas em cada ciclo.</p>
              </div>
            </div>
            {plansLoading ? (
              <div className="vip-plan-grid" aria-label="Carregando planos">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="vip-plan-skeleton animate-pulse"
                  />
                ))}
              </div>
            ) : plansError ? (
              <div role="alert" className="customer-alert">
                <p>{plansError}</p>
                <button
                  type="button"
                  className="customer-secondary"
                  onClick={loadPlans}
                >
                  Tentar novamente
                </button>
              </div>
            ) : !plans.length ? (
              <div className="account-empty">
                <h3>Os planos estão indisponíveis no momento</h3>
                <p>Atualize para conferir novamente.</p>
                <button
                  type="button"
                  className="customer-secondary"
                  onClick={loadPlans}
                >
                  Atualizar planos
                </button>
              </div>
            ) : (
              <div
                className="vip-plan-grid"
                role="radiogroup"
                aria-label="Planos VIP"
              >
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`vip-plan-card ${selectedPlan?.id === plan.id ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="vip-plan"
                      value={plan.id}
                      checked={selectedPlan?.id === plan.id}
                      onChange={() => choosePlan(plan.id)}
                      disabled={busy}
                      aria-label={planName(plan)}
                    />
                    <div className="vip-plan-card-heading">
                      <h3>{planName(plan)}</h3>
                      <span>
                        {selectedPlan?.id === plan.id
                          ? 'Selecionado'
                          : 'Selecionar'}
                      </span>
                    </div>
                    <p className="vip-plan-price">
                      <strong>{fmtBRL(planPrice(plan))}</strong>
                      <span>/ ciclo</span>
                    </p>
                    <ul>
                      <li>
                        <span className="material-icons" aria-hidden="true">
                          check
                        </span>
                        {plural(plan.miniatures_count, 'miniatura')}
                      </li>
                      <li>
                        <span className="material-icons" aria-hidden="true">
                          {count(plan.boss_count) ? 'check' : 'remove'}
                        </span>
                        {count(plan.boss_count)
                          ? plural(plan.boss_count, 'boss', 'bosses')
                          : 'Sem boss neste plano'}
                      </li>
                    </ul>
                    <p className="vip-plan-pieces">
                      {plural(
                        plan.items_per_month ??
                          count(plan.miniatures_count) + count(plan.boss_count),
                        'peça'
                      )}{' '}
                      por ciclo
                    </p>
                  </label>
                ))}
              </div>
            )}
            <div className="vip-shared-benefits">
              <h3>Seu clube vai além das miniaturas</h3>
              <p>
                Acesso à Área VIP, votação de temas, presente d20 do ciclo e
                partidas diárias no Cubo Game.
              </p>
            </div>
          </section>
          <aside
            className="vip-checkout customer-surface"
            ref={checkoutPanel}
            aria-labelledby="vip-checkout-title"
          >
            <p className="customer-eyebrow">Seu próximo ciclo</p>
            <h2 id="vip-checkout-title">Resumo da assinatura</h2>
            {selectedPlan ? (
              <>
                <h3>{planName(selectedPlan)}</h3>
                <p className="vip-checkout-description">
                  {plural(selectedPlan.miniatures_count, 'miniatura')}
                  {count(selectedPlan.boss_count)
                    ? ` + ${plural(selectedPlan.boss_count, 'boss', 'bosses')}`
                    : ''}
                </p>
                <form
                  className="vip-coupon-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    applyCoupon()
                  }}
                >
                  <label htmlFor="vip-coupon">Tem um cupom?</label>
                  <div>
                    <input
                      id="vip-coupon"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value.toUpperCase())
                        setCouponInfo(null)
                        couponRequest.current += 1
                      }}
                      placeholder="Código do cupom"
                      autoComplete="off"
                      disabled={busy}
                    />
                    <button
                      type="submit"
                      className="customer-secondary"
                      disabled={couponBusy || busy || !couponCode.trim()}
                    >
                      {couponBusy ? 'Aplicando…' : 'Aplicar'}
                    </button>
                  </div>
                </form>
                {activeCoupon && (
                  <div className="vip-coupon-applied" role="status">
                    <span>
                      {activeCoupon.code} · {fmtBRL(activeCoupon.discount)} de
                      desconto
                    </span>
                    <button
                      type="button"
                      aria-label="Remover cupom"
                      onClick={() => {
                        setCouponInfo(null)
                        setCouponCode('')
                      }}
                      disabled={busy}
                    >
                      <span className="material-icons" aria-hidden="true">
                        close
                      </span>
                    </button>
                  </div>
                )}
                <div className="vip-checkout-total">
                  <span>Total do ciclo</span>
                  <div>
                    {activeCoupon && <del>{fmtBRL(price)}</del>}
                    <strong>{fmtBRL(total)}</strong>
                  </div>
                </div>
                {profileError && (
                  <div className="customer-alert" role="alert">
                    <p>{profileError}</p>
                    <button
                      type="button"
                      className="customer-secondary"
                      onClick={() => setProfileRefresh((value) => value + 1)}
                    >
                      Verificar novamente
                    </button>
                  </div>
                )}
                {error && (
                  <p role="alert" className="vip-payment-message is-error">
                    {error}
                  </p>
                )}
                {message && (
                  <p role="status" className="vip-payment-message">
                    {message}
                  </p>
                )}
                <div className="vip-checkout-actions">
                  <button
                    type="button"
                    className="customer-primary"
                    disabled={!canPay}
                    onClick={() => startCheckout('card')}
                  >
                    {busy && method === 'card'
                      ? 'Preparando pagamento…'
                      : 'Assinar com cartão'}
                  </button>
                  <button
                    type="button"
                    className="customer-secondary"
                    disabled={!canPay}
                    onClick={() => {
                      if (reusablePix) setPixOpen(true)
                      else startCheckout('pix')
                    }}
                  >
                    {busy && method === 'pix'
                      ? 'Gerando Pix…'
                      : reusablePix
                        ? 'Ver Pix gerado'
                        : 'Assinar com Pix'}
                  </button>
                </div>
                <p className="vip-checkout-help">
                  Após a confirmação do pagamento, acompanhe suas escolhas e o
                  pedido na Área VIP.
                </p>
              </>
            ) : (
              <p className="vip-checkout-description">
                Selecione um plano disponível para continuar.
              </p>
            )}
          </aside>
        </div>
        <section
          className="vip-current-collection"
          aria-labelledby="vip-collection-title"
        >
          <div className="account-section-heading">
            <div>
              <h2 id="vip-collection-title">
                Conheça a coleção do ciclo
                {cycle ? ` · ${cycle.split('-').reverse().join('/')}` : ''}
              </h2>
              <p>Toque em uma peça para ver todos os detalhes.</p>
            </div>
          </div>
          {collectionError ? (
            <div className="customer-alert" role="alert">
              <p>{collectionError}</p>
              <button
                type="button"
                className="customer-secondary"
                onClick={loadCollection}
              >
                Atualizar coleção
              </button>
            </div>
          ) : collectionLoading ? (
            <p role="status" className="account-help">
              Carregando coleção…
            </p>
          ) : collection.length ? (
            <div className="vip-collection-grid">
              {collection.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setPreview(item)}
                  aria-label={`Ampliar ${item.title}`}
                >
                  <img src={item.image_url} alt={item.title} loading="lazy" />
                  <span>{item.title}</span>
                  <small>
                    {item.item_type === 'boss' ? 'Boss' : 'Miniatura'}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className="account-help">
              A coleção será exibida aqui assim que estiver disponível.
            </p>
          )}
        </section>
        <section
          className="vip-plan-questions"
          aria-labelledby="vip-questions-title"
        >
          <h2 id="vip-questions-title">Como funciona</h2>
          <details>
            <summary>Quando posso escolher minhas peças?</summary>
            <p>
              Após a confirmação do pagamento, acesse sua Área VIP. As escolhas
              seguem o plano e o ciclo liberado para sua conta.
            </p>
          </details>
          <details>
            <summary>Como acompanho minha coleção?</summary>
            <p>
              A Área VIP reúne escolhas, votação, presente do ciclo e etapas de
              produção e envio do pedido.
            </p>
          </details>
          <details>
            <summary>Como faço a renovação?</summary>
            <p>
              Quando um novo ciclo estiver disponível, consulte a opção de
              renovação na Área VIP.
            </p>
          </details>
        </section>
        <VipGalleryModal item={preview} onClose={() => setPreview(null)} />
        <Modal
          open={pixOpen}
          onClose={() => setPixOpen(false)}
          title="Pagamento Pix"
          maxWidth="max-w-md"
          zIndexClass="z-[220]"
          busy={pixChecking}
        >
          {pix && (
            <div className="vip-pix-panel">
              <p className="customer-eyebrow">{pix.planName}</p>
              <h3>{fmtBRL(pix.total)}</h3>
              <p>
                Escaneie o QR Code ou copie o código para pagar no seu banco.
              </p>
              {pix.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR Code Pix"
                />
              )}
              <label htmlFor="vip-pix-code">Código Pix</label>
              <textarea
                id="vip-pix-code"
                readOnly
                value={pix.qr_code || ''}
                rows={3}
              />
              <button
                type="button"
                className="customer-primary"
                disabled={!pix.qr_code}
                onClick={async () => {
                  const copied = await copyText(pix.qr_code)
                  if (mounted.current)
                    setCopyMessage(
                      copied
                        ? 'Código Pix copiado.'
                        : 'Selecione o código para copiar manualmente.'
                    )
                }}
              >
                Copiar código Pix
              </button>
              {copyMessage && <p role="status">{copyMessage}</p>}
              <p role="status" className="vip-pix-status">
                {statusLabel(pixStatus)}
              </p>
              {error && (
                <p role="alert" className="vip-payment-message is-error">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="customer-secondary"
                onClick={verifyPix}
                disabled={pixChecking || paidStatus(pixStatus)}
              >
                {pixChecking
                  ? 'Verificando…'
                  : paidStatus(pixStatus)
                    ? 'Pago ✓'
                    : 'Já paguei'}
              </button>
              {pix.ticket_url && (
                <a
                  href={pix.ticket_url}
                  target="_blank"
                  rel="noreferrer"
                  className="customer-text-button"
                >
                  Abrir no Mercado Pago
                </a>
              )}
            </div>
          )}
        </Modal>
      </div>
    </main>
  )
}
