import React from 'react'
import StorefrontSearch from '../components/StorefrontSearch.jsx'
import StorefrontProductGrid from '../components/StorefrontProductGrid.jsx'

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function StockPage({
  items, loading = false, error = '', addToCart, buyNow, openGallery, onRequireLogin,
}) {
  const [query, setQuery] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    try { return String(new URLSearchParams(window.location.search || '').get('q') || '') } catch { return '' }
  })
  const products = Array.isArray(items) ? items : []

  React.useEffect(() => {
    const onPop = () => {
      setQuery(new URLSearchParams(window.location.search || '').get('q') || '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      if (query.trim()) url.searchParams.set('q', query.trim())
      else url.searchParams.delete('q')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch { /* restricted preview */ }
  }, [query])

  const filtered = React.useMemo(() => {
    const q = normalizeText(query).trim()
    if (!q) return products
    return products.filter((p) => normalizeText([p.nome, p.descricao, ...(Array.isArray(p.tags) ? p.tags : [])].join(' ')).includes(q))
  }, [items, query])

  // Deep links in order notifications: /estoque?product=<id>&open=1.
  React.useEffect(() => {
    if (typeof window === 'undefined' || loading) return undefined
    const params = new URLSearchParams(window.location.search || '')
    const productId = params.get('product')
    if (!productId) return undefined
    const product = products.find((p) => String(p.id) === productId)
    if (!product) return undefined
    const el = document.getElementById(`product-${productId}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 92
      window.scrollTo({ top, behavior: 'smooth' })
    }
    const timer = params.get('open') === '1' ? window.setTimeout(() => openGallery?.(product), 250) : null
    params.delete('product')
    params.delete('open')
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`)
    return () => { if (timer != null) window.clearTimeout(timer) }
  }, [loading, items, openGallery])

  return (
    <main className="storefront-page storefront-stock flex-1">
      <section className="container-cc storefront-content">
        <header className="storefront-hero">
          <div className="storefront-hero-copy">
            <span className="storefront-eyebrow"><span className="storefront-eyebrow-dot" /> PEÇAS DISPONÍVEIS</span>
            <h1>Pronta entrega</h1>
            <p>Miniaturas e colecionáveis já disponíveis, sem aguardar a produção.</p>
          </div>
          <div className="storefront-hero-mark" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 23 40 9l26 14v33L40 71 14 56V23Z" />
              <path d="m14 23 26 15 26-15M40 38v33M27 16l26 15M25 50l7 4" />
            </svg>
          </div>
        </header>

        {!error ? (
          <>
            <div className="storefront-toolbar storefront-stock-toolbar">
              <div className="storefront-search-row">
                <StorefrontSearch id="stock-search" value={query} onChange={setQuery} placeholder="Busque pelas peças disponíveis..." />
              </div>
            </div>
            <div className="storefront-results-bar">
              <div className="storefront-results-text" aria-live="polite">
                <span className="storefront-results-dot" />
                {loading ? 'Carregando peças...' : `${filtered.length} ${filtered.length === 1 ? 'peça disponível' : 'peças disponíveis'}`}
              </div>
              {query ? <button type="button" className="storefront-clear-all" onClick={() => setQuery('')}>Limpar busca</button> : null}
            </div>
            <StorefrontProductGrid
              products={filtered} loading={loading}
              emptyMessage={query ? 'Experimente outro nome ou limpe a busca.' : 'Em breve teremos mais peças disponíveis para envio.'}
              addToCart={addToCart} buyNow={buyNow} openGallery={openGallery} onRequireLogin={onRequireLogin}
              context="stock"
            />
          </>
        ) : <div className="storefront-error" role="alert">Não foi possível carregar as peças disponíveis. {error}</div>}
      </section>
    </main>
  )
}
