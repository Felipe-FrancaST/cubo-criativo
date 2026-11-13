import PromoProductCard from '../components/PromoProductCard.jsx'

export default function PromocoesPage({
  items,
  loading = false,
  error = '',
  addToCart,
  buyNow,
  openGallery,
  onGoHome,
  onRequireLogin,
}) {
  const promos = Array.isArray(items) ? items : []
  return (
    <main className="storefront-page editorial-page editorial-offers flex-1">
      <section className="container-cc editorial-container">
        <header className="editorial-page-hero">
          <div className="editorial-page-hero-copy">
            <p className="editorial-kicker"><span className="editorial-dot" /> PREÇOS ESPECIAIS</p>
            <h1>Promoções da loja</h1>
            <p>Peças selecionadas com condições especiais para ampliar sua coleção.</p>
          </div>
          <span className="editorial-page-hero-icon material-icons" aria-hidden="true">local_offer</span>
        </header>
        <div className="editorial-results-row">
          <span className="editorial-results-count"><span className="editorial-dot" /> {loading ? 'Buscando ofertas...' : `${promos.length} ${promos.length === 1 ? 'peça disponível' : 'peças disponíveis'}`}</span>
          <button type="button" className="editorial-back" onClick={onGoHome}><span className="material-icons" aria-hidden="true">arrow_back</span> Voltar à loja</button>
        </div>
        {error && <div className="editorial-empty editorial-error" role="alert">Não foi possível carregar as promoções. {error}</div>}
        {loading && !error && (
          <div className="storefront-product-grid editorial-offers-grid" aria-label="Carregando promoções">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="storefront-skeleton" aria-hidden="true"><div className="storefront-skeleton-image"/><div className="storefront-skeleton-body"><div className="storefront-skeleton-line short"/><div className="storefront-skeleton-line"/><div className="storefront-skeleton-line medium"/><div className="storefront-skeleton-action"/></div></div>)}
          </div>
        )}
        {!loading && !error && promos.length === 0 && <div className="editorial-empty"><span className="material-icons" aria-hidden="true">sell</span><strong>Nenhuma promoção ativa agora.</strong><p>Você ainda pode encontrar peças incríveis no catálogo.</p></div>}
        {!loading && !error && promos.length > 0 && (
          <div className="storefront-product-grid editorial-offers-grid">
            {promos.map((p) => <PromoProductCard key={p.id} p={p} addToCart={addToCart} buyNow={buyNow} openGallery={openGallery} onRequireLogin={onRequireLogin} />)}
          </div>
        )}
      </section>
    </main>
  )
}
