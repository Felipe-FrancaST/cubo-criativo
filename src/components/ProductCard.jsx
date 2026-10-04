import React from 'react'
import {
  fmtBRL,
  centsToBRL,
  getVariantPricingCents,
  percentOffCents,
} from '../lib/pricing.js'
import { useFavorites } from '../state/FavoritesProvider.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { navigateClient, saveProductReturnState } from '../lib/navigation.js'

export default function ProductCard({
  p,
  addToCart,
  buyNow,
  openGallery,
  onRequireLogin,
  promotion = false,
  showFavorite = true,
}) {
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const defaultIndex = Math.max(
    0,
    p.variants?.findIndex((variant) => variant.label === p.defaultVariant) ?? 0
  )
  const [selIndex, setSelIndex] = React.useState(defaultIndex)
  const [imgError, setImgError] = React.useState(false)
  const [addedFlash, setAddedFlash] = React.useState(false)
  const flashTimer = React.useRef(null)
  React.useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  React.useEffect(() => setImgError(false), [p.img])
  React.useEffect(() => setSelIndex(defaultIndex), [p.id, defaultIndex])

  const pricing = getVariantPricingCents(p, selIndex, defaultIndex)
  const currentPrice = centsToBRL(pricing.currentCents)
  const originalPrice = centsToBRL(pricing.originalCents)
  const off = percentOffCents(pricing.originalCents, pricing.currentCents)
  const escala = pricing.sel?.label ?? p.escala ?? ''
  const outOfStock =
    typeof p.stock === 'number' && Number.isFinite(p.stock) && p.stock <= 0
  const favorite = isFavorite(p.id)

  function handleAdd() {
    if (outOfStock) return
    addToCart?.(p, { escala, unitPrice: currentPrice })
    setAddedFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setAddedFlash(false), 1200)
  }
  function openProduct(event) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    saveProductReturnState(`/p/${p.slug}`)
    event.preventDefault()
    navigateClient(`/p/${p.slug}`)
  }

  return (
    <article
      id={p.id ? `product-${p.id}` : undefined}
      className={`product-card compact-product-card ${promotion ? 'promo-product-card' : ''}`}
    >
      <div className="product-card-media">
        <button
          type="button"
          className="product-card-image"
          onClick={() => openGallery?.(p)}
          aria-label={`Ver fotos de ${p.nome || 'produto'}`}
        >
          {imgError ? (
            <span className="product-card-image-fallback">
              Imagem indisponível
            </span>
          ) : (
            <img
              src={p.img}
              alt={p.nome}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          )}
        </button>
        {showFavorite && (
          <button
            type="button"
            className={`product-card-favorite ${favorite ? 'is-favorite' : ''}`}
            aria-pressed={favorite}
            aria-label={favorite ? 'Remover dos favoritos' : 'Favoritar'}
            onClick={async () => {
              const result = await toggleFavorite(p.id)
              if (!result.ok && !user)
                onRequireLogin?.('Faça login para favoritar.')
            }}
          >
            <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>
          </button>
        )}
        {(off > 0 || promotion) && (
          <span className="product-card-offer">
            {off > 0 ? `−${off}%` : 'Promoção'}
          </span>
        )}
      </div>
      <div className="product-card-main">
        {(p._availabilityLabel || p._typeLabel) && (
          <div className="product-card-meta">
            <span>{p._availabilityLabel || p._typeLabel}</span>
            {p._availabilityLabel && p._typeLabel && (
              <span className="product-card-extra">{p._typeLabel}</span>
            )}
            {p._leadTimeLabel && !p._isStock && (
              <span className="product-card-extra">{p._leadTimeLabel}</span>
            )}
          </div>
        )}
        <h3 title={p.nome} className="product-card-title">
          {p.slug ? (
            <a href={`/p/${p.slug}`} onClick={openProduct}>
              {p.nome}
            </a>
          ) : (
            p.nome
          )}
        </h3>
        <div className="product-card-prices">
          {pricing.showStrike && originalPrice > currentPrice && (
            <del>{fmtBRL(originalPrice)}</del>
          )}
          <strong className={pricing.showStrike ? 'is-discounted' : ''}>
            {fmtBRL(currentPrice)}
          </strong>
        </div>
        {pricing.hasVariants && (
          <div className="product-card-variant">
            <select
              value={selIndex}
              aria-label={`Escala de ${p.nome}`}
              onChange={(event) => setSelIndex(Number(event.target.value))}
            >
              {p.variants.map((variant, index) => (
                <option key={`${variant.label}-${index}`} value={index}>
                  {variant.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div
          className={`product-card-actions ${outOfStock ? 'is-unavailable' : ''}`}
        >
          {outOfStock ? (
            <button type="button" disabled className="product-card-buy">
              Esgotado
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`product-card-add ${addedFlash ? 'is-added' : ''}`}
                onClick={handleAdd}
                aria-label={
                  addedFlash
                    ? `${p.nome} adicionado ao carrinho`
                    : `Adicionar ${p.nome} ao carrinho`
                }
                title={addedFlash ? 'Adicionado!' : 'Adicionar ao carrinho'}
              >
                <span
                  className="material-icons product-card-add-icon"
                  aria-hidden="true"
                >
                  {addedFlash ? 'check' : 'add_shopping_cart'}
                </span>
                <span className="product-card-add-label">
                  {addedFlash ? 'Adicionado!' : 'Adicionar'}
                </span>
              </button>
              <button
                type="button"
                className="product-card-buy"
                onClick={() => buyNow?.(p, { escala, unitPrice: currentPrice })}
              >
                Comprar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
