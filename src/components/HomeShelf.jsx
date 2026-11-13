import ProductCard from './ProductCard.jsx'

export default function HomeShelf({ id, eyebrow, title, description, products, loading = false, error = '', emptyMessage, actionLabel, onAction, addToCart, buyNow, openGallery, onRequireLogin }) {
  const items = Array.isArray(products) ? products : []
  return (
    <section id={id} className="editorial-section editorial-product-section">
      <header className="editorial-section-heading">
        <div className="editorial-section-heading-copy">
          <p className="editorial-kicker"><span className="editorial-dot" />{eyebrow}</p>
          <h2>{title}</h2>
          {description && <p className="editorial-section-description">{description}</p>}
        </div>
        {onAction && <button type="button" className="editorial-text-action" onClick={onAction}>{actionLabel}<span className="material-icons" aria-hidden="true">arrow_forward</span></button>}
      </header>
      {loading && !error ? (
        <div className="storefront-product-grid editorial-shelf-grid" aria-label="Carregando produtos">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="storefront-skeleton" key={index} aria-hidden="true"><div className="storefront-skeleton-image"/><div className="storefront-skeleton-body"><div className="storefront-skeleton-line short"/><div className="storefront-skeleton-line"/><div className="storefront-skeleton-line medium"/><div className="storefront-skeleton-action"/></div></div>
          ))}
        </div>
      ) : error ? (
        <p className="editorial-empty" role="alert">{error}</p>
      ) : items.length === 0 ? (
        <p className="editorial-empty">{emptyMessage || 'Nenhum produto disponível no momento.'}</p>
      ) : (
        <div className="storefront-product-grid editorial-shelf-grid">
          {items.map((p) => <ProductCard key={p.id} p={p} storefrontContext="home" addToCart={addToCart} buyNow={buyNow} openGallery={openGallery} onRequireLogin={onRequireLogin}/>)}
        </div>
      )}
    </section>
  )
}
