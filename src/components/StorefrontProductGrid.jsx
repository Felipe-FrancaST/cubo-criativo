import React from 'react'
import ProductCard from './ProductCard.jsx'

export default function StorefrontProductGrid({
  products = [], loading = false, emptyMessage,
  addToCart, buyNow, openGallery, onRequireLogin,
  context = 'catalog',
}) {
  return (
    <div className="product-grid storefront-product-grid" aria-live="polite" aria-busy={loading}>
      {loading
        ? Array.from({ length: 8 }, (_, index) => (
            <div className="storefront-skeleton" key={index} aria-hidden="true">
              <div className="storefront-skeleton-image" />
              <div className="storefront-skeleton-body">
                <span className="storefront-skeleton-line short" />
                <span className="storefront-skeleton-line" />
                <span className="storefront-skeleton-line medium" />
                <span className="storefront-skeleton-action" />
              </div>
            </div>
          ))
        : products.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openGallery={openGallery}
              onRequireLogin={onRequireLogin}
              storefrontContext={context}
            />
          ))}
      {!loading && products.length === 0 ? (
        <div className="storefront-empty" role="status">
          <span className="storefront-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.4 4.4M8 10h6" strokeLinecap="round" />
            </svg>
          </span>
          <strong>Nenhuma peça encontrada</strong>
          <p>{emptyMessage || 'Experimente outra busca ou altere os filtros.'}</p>
        </div>
      ) : null}
    </div>
  )
}
