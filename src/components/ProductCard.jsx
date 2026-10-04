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
import Modal from './Modal.jsx'

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
  const [imgError, setImgError] = React.useState(false)
  const [addedFlash, setAddedFlash] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const flashTimer = React.useRef(null)
  React.useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  React.useEffect(() => setImgError(false), [p.img])
  React.useEffect(() => {
    setDetailsOpen(false)
    setAddedFlash(false)
    window.clearTimeout(flashTimer.current)
  }, [p.id])

  const pricing = getVariantPricingCents(p, defaultIndex, defaultIndex)
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
    <>
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
          {p.slug ? (
            <a
              className="product-card-details"
              href={`/p/${p.slug}`}
              onClick={openProduct}
              aria-label={`Ver descrição de ${p.nome}`}
              title="Descrição e opções da peça"
            >
              <span className="material-icons" aria-hidden="true">
                info_outline
              </span>
              <span className="product-card-details-label">Detalhes</span>
            </a>
          ) : (
            <button
              type="button"
              className="product-card-details"
              onClick={() => setDetailsOpen(true)}
              aria-label={`Ver descrição de ${p.nome}`}
              title="Descrição da peça"
            >
              <span className="material-icons" aria-hidden="true">
                info_outline
              </span>
              <span className="product-card-details-label">Detalhes</span>
            </button>
          )}
        </div>
        <div className="product-card-main">
          <h3 title={p.nome} className="product-card-title">
            {p.nome}
          </h3>
          <div className="product-card-prices">
            <strong className={pricing.showStrike ? 'is-discounted' : ''}>
              {fmtBRL(currentPrice)}
            </strong>
            {pricing.showStrike && originalPrice > currentPrice && (
              <del>{fmtBRL(originalPrice)}</del>
            )}
          </div>
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
                </button>
                <button
                  type="button"
                  className="product-card-buy"
                  onClick={() =>
                    buyNow?.(p, { escala, unitPrice: currentPrice })
                  }
                >
                  Comprar
                </button>
              </>
            )}
          </div>
        </div>
      </article>
      {!p.slug && detailsOpen && (
        <Modal
          open
          onClose={() => setDetailsOpen(false)}
          title={p.nome || 'Descrição da peça'}
          maxWidth="max-w-md"
          zIndexClass="z-[220]"
        >
          <div className="product-card-description">
            <p>
              {p.descricao ||
                p.description ||
                'A descrição desta peça ainda não foi disponibilizada.'}
            </p>
            <dl>
              <div>
                <dt>Valor</dt>
                <dd>{fmtBRL(currentPrice)}</dd>
              </div>
              {escala && (
                <div>
                  <dt>Opção padrão</dt>
                  <dd>{escala}</dd>
                </div>
              )}
              {p._typeLabel && (
                <div>
                  <dt>Tipo</dt>
                  <dd>{p._typeLabel}</dd>
                </div>
              )}
              {p._availabilityLabel && (
                <div>
                  <dt>Disponibilidade</dt>
                  <dd>{p._availabilityLabel}</dd>
                </div>
              )}
              {p._leadTimeLabel && (
                <div>
                  <dt>Prazo</dt>
                  <dd>{p._leadTimeLabel}</dd>
                </div>
              )}
            </dl>
          </div>
        </Modal>
      )}
    </>
  )
}
