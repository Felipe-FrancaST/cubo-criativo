import React from 'react'
import useDialog from '../lib/useDialog.js'
import StorefrontSearch from '../components/StorefrontSearch.jsx'
import StorefrontProductGrid from '../components/StorefrontProductGrid.jsx'

function readParam(name, fallback = '') {
  if (typeof window === 'undefined') return fallback
  try {
    return String(new URLSearchParams(window.location.search || '').get(name) || fallback)
  } catch {
    return fallback
  }
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function resolveCatalogType(product) {
  const category = normalizeText(product?.category)
  const typeLabel = normalizeText(product?._typeLabel)
  if (category === 'rpg' || typeLabel.includes('rpg')) return 'rpg'
  if (['action figures', 'action figure', 'action'].includes(category) || typeLabel.includes('action')) return 'action'
  return 'outros'
}

function isInternalTag(tag) {
  const s = normalizeText(tag)
  return !s || ['rpg', 'action', 'action figure', 'action figures', 'figure action'].includes(s) ||
    ['tipo:', 'classe:', 'raca:', 'prazo:'].some((prefix) => s.startsWith(prefix))
}

const types = [
  { id: 'todos', label: 'Todas as peças' },
  { id: 'action', label: 'Action figures' },
  { id: 'rpg', label: 'Miniaturas RPG' },
]

function TypeFilters({ value, onChange, className = '' }) {
  return (
    <div className={`storefront-type-filters ${className}`} role="group" aria-label="Filtrar por tipo">
      {types.map((item) => (
        <button
          key={item.id}
          type="button"
          className="storefront-type-chip"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function CatalogPage({
  items, loading = false, error = '', addToCart, buyNow, openGallery, onRequireLogin,
}) {
  const [type, setType] = React.useState(() => readParam('tipo', 'todos'))
  const [selectedTag, setSelectedTag] = React.useState(() => readParam('tag', 'Todos'))
  const [query, setQuery] = React.useState(() => readParam('q', ''))
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const filterPanelRef = useDialog(filtersOpen, () => setFiltersOpen(false))
  const [helpOpen, setHelpOpen] = React.useState(false)
  const products = Array.isArray(items) ? items : []

  React.useEffect(() => {
    const onPop = () => {
      setType(readParam('tipo', 'todos'))
      setQuery(readParam('q', ''))
      setSelectedTag(readParam('tag', 'Todos'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search || '')
      if (type !== 'todos') params.set('tipo', type)
      else params.delete('tipo')
      if (query.trim()) params.set('q', query.trim())
      else params.delete('q')
      if (selectedTag !== 'Todos') params.set('tag', selectedTag)
      else params.delete('tag')
      const search = params.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`)
    } catch { /* history may be restricted in embedded previews */ }
  }, [type, query, selectedTag])

  const tagOptions = React.useMemo(() => {
    const tags = new Set()
    products.forEach((p) => {
      if (type !== 'todos' && resolveCatalogType(p) !== type) return
      ;(p.tags || []).forEach((tag) => {
        if (!isInternalTag(tag)) tags.add(String(tag))
      })
    })
    return ['Todos', ...Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [items, type])

  React.useEffect(() => {
    if (selectedTag !== 'Todos' && !tagOptions.includes(selectedTag)) setSelectedTag('Todos')
  }, [selectedTag, tagOptions])

  const filtered = React.useMemo(() => {
    const q = normalizeText(query)
    return products.filter((p) => {
      if (type !== 'todos' && resolveCatalogType(p) !== type) return false
      if (selectedTag !== 'Todos' && !(p.tags || []).includes(selectedTag)) return false
      if (!q) return true
      return normalizeText([p.nome, p.descricao, ...(Array.isArray(p.tags) ? p.tags : [])].join(' ')).includes(q)
    })
  }, [items, type, selectedTag, query])

  const activeFilters = Number(type !== 'todos') + Number(selectedTag !== 'Todos')
  function clearFilters() {
    setType('todos')
    setSelectedTag('Todos')
  }

  const helpContent = [
    'Escolha suas peças e finalize sua compra diretamente pelo site.',
    'Os produtos do catálogo entram em produção após a confirmação do pedido.',
    'Prazo médio de 15 a 30 dias úteis, conforme acabamento, pintura e fila de produção.',
  ]

  return (
    <main className="storefront-page storefront-catalog flex-1">
      <section className="container-cc storefront-content">
        <header className="storefront-hero">
          <div className="storefront-hero-copy">
            <span className="storefront-eyebrow"><span className="storefront-eyebrow-dot" /> PEÇAS FEITAS PARA VOCÊ</span>
            <h1>Explore o catálogo</h1>
            <p>Action figures e miniaturas de RPG com os detalhes que fazem a diferença.</p>
          </div>
          <div className="storefront-hero-mark" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m40 9 28 16v30L40 71 12 55V25L40 9Z" />
              <path d="M12 25 40 41l28-16M40 41v30M26 17l28 16M26 33v16" />
            </svg>
          </div>
        </header>

        {!error ? (
          <>
            <div className="storefront-toolbar">
              <div className="storefront-search-row">
                <StorefrontSearch id="catalog-search" value={query} onChange={setQuery} placeholder="Busque sua próxima peça..." />
                <button
                  type="button"
                  className="storefront-filter-button"
                  onClick={() => setFiltersOpen(true)}
                  aria-haspopup="dialog"
                  aria-label={`Abrir filtros${activeFilters ? `, ${activeFilters} ativos` : ''}`}
                >
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 7h16M7 12h10M10 17h4" strokeLinecap="round" />
                  </svg>
                  <span>Filtros</span>
                  {activeFilters > 0 ? <span className="storefront-filter-count">{activeFilters}</span> : null}
                </button>
              </div>
              <TypeFilters value={type} onChange={setType} className="storefront-type-desktop" />
              {tagOptions.length > 1 ? (
                <div className="storefront-tag-desktop" aria-label="Filtrar por tema">
                  <span>Temas</span>
                  <div>
                    {tagOptions.map((tag) => (
                      <button key={tag} type="button" className="storefront-tag-chip" aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}>{tag}</button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <TypeFilters value={type} onChange={setType} className="storefront-type-mobile" />

            <div className="storefront-results-bar">
              <div className="storefront-results-text" aria-live="polite">
                <span className="storefront-results-dot" />
                {loading ? 'Carregando peças...' : `${filtered.length} ${filtered.length === 1 ? 'peça encontrada' : 'peças encontradas'}`}
              </div>
              {(activeFilters > 0 || query) ? (
                <button type="button" className="storefront-clear-all" onClick={() => { clearFilters(); setQuery('') }}>Limpar busca e filtros</button>
              ) : null}
            </div>

            <StorefrontProductGrid
              products={filtered} loading={loading}
              emptyMessage="Tente outro termo ou limpe os filtros para ver mais peças."
              addToCart={addToCart} buyNow={buyNow} openGallery={openGallery} onRequireLogin={onRequireLogin}
            />

            <div className="storefront-help">
              <button type="button" onClick={() => setHelpOpen((open) => !open)} aria-expanded={helpOpen} aria-controls="catalog-help-content">
                <span className="storefront-help-icon" aria-hidden="true">?</span>
                <span><strong>Como funciona o catálogo?</strong><small>Produção, prazos e dúvidas</small></span>
                <span className="storefront-help-chevron" aria-hidden="true">{helpOpen ? '−' : '+'}</span>
              </button>
              {helpOpen ? <ul id="catalog-help-content">{helpContent.map((line) => <li key={line}>{line}</li>)}</ul> : null}
            </div>

            {filtersOpen ? (
              <div className="storefront-filter-overlay" role="presentation">
                <button type="button" className="storefront-filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros" />
                <section ref={filterPanelRef} role="dialog" aria-modal="true" aria-label="Filtros do catálogo" tabIndex={-1} className="storefront-filter-panel catalog-filter-panel">
                  <div className="storefront-filter-handle" aria-hidden="true" />
                  <div className="storefront-filter-heading"><div><h2>Filtrar produtos</h2><p>Encontre as peças do seu jeito.</p></div><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros" className="storefront-filter-close">×</button></div>
                  <div className="storefront-filter-section"><h3>Tipo de peça</h3><TypeFilters value={type} onChange={setType} /></div>
                  {tagOptions.length > 1 ? <div className="storefront-filter-section"><h3>Temas e categorias</h3><div className="storefront-filter-tags">{tagOptions.map((tag) => <button key={tag} type="button" className="storefront-tag-chip" aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}>{tag}</button>)}</div></div> : null}
                  <div className="storefront-filter-footer"><button type="button" className="storefront-filter-reset" onClick={clearFilters}>Limpar</button><button type="button" className="storefront-filter-apply" onClick={() => setFiltersOpen(false)}>Ver {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</button></div>
                </section>
              </div>
            ) : null}
          </>
        ) : <div className="storefront-error" role="alert">Não foi possível carregar os produtos. {error}</div>}
      </section>
    </main>
  )
}
