import React from 'react'
import { supabase } from '../lib/supabaseClient.js'
import ReviewCard from '../components/ReviewCard.jsx'

const choices = [
  { id: 'all', label: 'Todas' },
  ...[5, 4, 3, 2, 1].map((rating) => ({ id: String(rating), label: `${rating} ★` })),
]

export default function ReviewsPage({ onGoHome }) {
  const [reviews, setReviews] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [ratingFilter, setRatingFilter] = React.useState('all')

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        let response = await supabase
          .from('customer_reviews_public')
          .select('id,rating,comment,display_name,city,state,product_names,product_slugs,featured,created_at,approved_at')
          .order('featured', { ascending: false })
          .order('approved_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(100)
        if (response.error && /customer_reviews_public/i.test(String(response.error.message || ''))) {
          response = await supabase.from('customer_reviews')
            .select('id,rating,comment,display_name,city,state,product_names,product_slugs,featured,created_at')
            .eq('approved', true)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100)
        }
        if (response.error) throw response.error
        if (alive) setReviews(response.data || [])
      } catch (e) {
        if (alive) setError(e?.message || 'Não foi possível carregar as avaliações.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = ratingFilter === 'all' ? reviews : reviews.filter((review) => Number(review.rating) === Number(ratingFilter))
  const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0
  const ratings = React.useMemo(() => [5, 4, 3, 2, 1].map((value) => ({ value, count: reviews.filter((review) => Number(review.rating) === value).length })), [reviews])

  return (
    <main className="editorial-page editorial-reviews flex-1">
      <section className="container-cc editorial-container">
        <header className="editorial-page-hero">
          <div className="editorial-page-hero-copy"><p className="editorial-kicker"><span className="editorial-dot" /> A EXPERIÊNCIA DE QUEM COMPROU</p><h1>Avaliações dos clientes</h1><p>Opiniões publicadas por quem recebeu uma peça da Cubo Criativo.</p></div>
          <span className="editorial-page-hero-icon material-icons" aria-hidden="true">reviews</span>
        </header>

        <div className="editorial-reviews-summary">
          <div className="editorial-reviews-score"><span>Nota média</span><strong>{average ? average.toFixed(1).replace('.', ',') : '—'}</strong><span className="editorial-stars" aria-label="Escala de avaliação de cinco estrelas">★★★★★</span><small>{reviews.length} {reviews.length === 1 ? 'avaliação publicada' : 'avaliações publicadas'}</small></div>
          <div className="editorial-rating-bars" aria-label="Distribuição das avaliações">
            {ratings.map(({ value, count }) => <button key={value} type="button" aria-label={`Filtrar por ${value} estrelas, ${count} avaliações`} onClick={() => setRatingFilter(String(value))} className="editorial-rating-row"><span>{value} ★</span><span className="editorial-rating-track"><span style={{width: `${reviews.length ? 100 * count / reviews.length : 0}%`}} /></span><small>{count}</small></button>)}
          </div>
          <div className="editorial-reviews-summary-note"><span className="material-icons" aria-hidden="true">verified_user</span><strong>Experiências reais</strong><p>Feedback sobre detalhes, acabamento e atendimento.</p></div>
        </div>

        <div className="editorial-filter-heading"><div><h2>O que nossos clientes dizem</h2><span>{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span></div><button type="button" className="editorial-back" onClick={onGoHome}><span className="material-icons" aria-hidden="true">arrow_back</span> Voltar</button></div>
        <div className="editorial-rating-filters" role="group" aria-label="Filtrar avaliações por nota">{choices.map((item) => <button type="button" key={item.id} className="editorial-filter-chip" aria-pressed={ratingFilter === item.id} onClick={() => setRatingFilter(item.id)}>{item.label}</button>)}</div>

        {loading && <div className="editorial-review-grid" aria-label="Carregando avaliações">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="editorial-review-skeleton" aria-hidden="true" />)}</div>}
        {error && <div className="editorial-empty editorial-error" role="alert">{error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="editorial-empty">Nenhuma avaliação encontrada para este filtro.</div>}
        {!loading && !error && filtered.length > 0 && <div className="editorial-review-grid">{filtered.map((review) => <ReviewCard key={review.id} review={review} />)}</div>}
      </section>
    </main>
  )
}
