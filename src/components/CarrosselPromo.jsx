import * as React from 'react'
import { getPromotionSlides } from '../lib/promoCarousel.js'
import {
  centsToBRL,
  fmtBRL,
  getVariantPricingCents,
  percentOffCents,
} from '../lib/pricing.js'
import { navigateClient, saveProductReturnState } from '../lib/navigation.js'

/**
 * Carrossel da home: alimentado pelas ofertas reais do catálogo.
 * As imagens de banners de promoções antigos não são consultadas aqui.
 */
export default function CarrosselPromo({
  products = [],
  loading = false,
  error = '',
  interval = 5000,
  className = '',
  onActivate,
}) {
  const slides = React.useMemo(() => getPromotionSlides(products), [products])
  const [i, setI] = React.useState(0)
  // Mantém os indicadores em uma única linha, mesmo com muitas ofertas.
  const visibleDots = React.useMemo(() => {
    const count = slides.length
    const start = count <= 7 ? 0 : Math.min(Math.max(i - 3, 0), count - 7)
    return Array.from({ length: Math.min(7, count) }, (_, offset) => start + offset)
  }, [slides.length, i])
  const [failedImages, setFailedImages] = React.useState({})
  const [isHovering, setIsHovering] = React.useState(false)
  const [hasFocus, setHasFocus] = React.useState(false)
  const touchStartX = React.useRef(null)
  const lastSwipeAt = React.useRef(0)
  const activeSlide = slides[i] || slides[0]

  React.useEffect(() => {
    if (i >= slides.length) setI(0)
  }, [i, slides.length])

  const next = React.useCallback(() => {
    setI((current) => slides.length ? (current + 1) % slides.length : 0)
  }, [slides.length])
  const prev = React.useCallback(() => {
    setI((current) => slides.length ? (current - 1 + slides.length) % slides.length : 0)
  }, [slides.length])

  React.useEffect(() => {
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (slides.length < 2 || isHovering || hasFocus || reducedMotion) return undefined
    const timer = window.setInterval(next, interval)
    return () => window.clearInterval(timer)
  }, [slides.length, isHovering, hasFocus, interval, next])

  function onTouchStart(event) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }
  function onTouchEnd(event) {
    if (touchStartX.current === null) return
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 40) return
    lastSwipeAt.current = Date.now()
    if (delta < 0) next()
    else prev()
  }

  function openProduct(event, product) {
    if (Date.now() - lastSwipeAt.current < 450) { event.preventDefault(); return }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (!product?.slug) {
      onActivate?.()
      return
    }
    const path = `/p/${encodeURIComponent(product.slug)}`
    saveProductReturnState(path, event.currentTarget.closest('[data-product-id]'))
    navigateClient(path)
  }

  const id = String(activeSlide?.id || activeSlide?.slug || '')
  const defaultIndex = Math.max(0, activeSlide?.variants?.findIndex(
    (variant) => variant.label === activeSlide.defaultVariant
  ) ?? 0)
  const pricing = activeSlide
    ? getVariantPricingCents(activeSlide, defaultIndex, defaultIndex)
    : null
  const off = pricing
    ? percentOffCents(pricing.originalCents, pricing.currentCents)
    : 0

  return (
    <div
      className={`carousel-promo-products ${className}`}
      role="region"
      aria-label="Produtos em promoção"
      aria-roledescription="carrossel"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false)
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') { event.preventDefault(); next() }
        if (event.key === 'ArrowLeft') { event.preventDefault(); prev() }
      }}
    >
      {loading && !slides.length ? (
        <div className="carousel-promo-loading" role="status" aria-label="Carregando produtos em promoção">
          <div className="carousel-promo-loading-image" />
          <div className="carousel-promo-loading-text" />
        </div>
      ) : error && !slides.length ? (
        <div className="carousel-promo-empty" role="status">
          Não foi possível carregar as ofertas agora.
          <button type="button" onClick={onActivate}>Ver promoções</button>
        </div>
      ) : !activeSlide ? (
        <div className="carousel-promo-empty" role="status">
          Nenhum produto com imagem está em promoção neste momento.
          <button type="button" onClick={onActivate}>Explorar promoções</button>
        </div>
      ) : (
        <>
          <div className="carousel-promo-viewport" data-product-id={activeSlide.id}>
            <a
              className="carousel-promo-product-link"
              href={activeSlide.slug ? `/p/${encodeURIComponent(activeSlide.slug)}` : '/promocoes'}
              onClick={(event) => openProduct(event, activeSlide)}
              aria-label={`Ver ${activeSlide.nome} em promoção`}
            >
              <div className="carousel-promo-photo" key={id}>
                {failedImages[id] ? (
                  <span className="carousel-promo-photo-missing">Imagem indisponível</span>
                ) : (
                  <img
                    src={activeSlide.carouselImage}
                    alt={activeSlide.nome || 'Produto em promoção'}
                    loading="eager"
                    decoding="async"
                    onError={() => setFailedImages((current) => ({ ...current, [id]: true }))}
                  />
                )}
                <span className="carousel-promo-offer-label">{off > 0 ? `${off}% OFF` : 'EM PROMOÇÃO'}</span>
              </div>
              <div className="carousel-promo-info">
                <div className="carousel-promo-info-copy">
                  <span className="carousel-promo-info-eyebrow">OFERTA DA LOJA</span>
                  <strong className="carousel-promo-product-name" title={activeSlide.nome}>
                    {activeSlide.nome}
                  </strong>
                  {pricing && (
                    <span className="carousel-promo-prices">
                      <strong>{fmtBRL(centsToBRL(pricing.currentCents))}</strong>
                      {pricing.showStrike && pricing.originalCents > pricing.currentCents ? (
                        <del>{fmtBRL(centsToBRL(pricing.originalCents))}</del>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            </a>
          </div>
          {slides.length > 1 && (
            <div className="carousel-promo-controls" aria-label="Navegação do carrossel">
              <button type="button" aria-label="Produto anterior" className="carousel-promo-control" onClick={prev}>
                <span className="material-icons" aria-hidden="true">chevron_left</span>
              </button>
              <div className="carousel-promo-dots" aria-label="Selecionar produto">
                {visibleDots.map((idx) => (
                  <button
                    type="button"
                    key={slides[idx]?.id || slides[idx]?.slug || idx}
                    onClick={() => setI(idx)}
                    aria-label={`Ver ${slides[idx]?.nome} — ${idx + 1} de ${slides.length}`}
                    aria-current={idx === i ? 'true' : undefined}
                    className={`carousel-promo-dot ${idx === i ? 'is-active' : ''}`}
                  ><span aria-hidden="true" /></button>
                ))}
              </div>
              <button type="button" aria-label="Próximo produto" className="carousel-promo-control" onClick={next}>
                <span className="material-icons" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
