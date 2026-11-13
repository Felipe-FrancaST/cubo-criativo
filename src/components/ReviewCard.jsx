
/** The same verified-review presentation on home and on the reviews page. */
export default function ReviewCard({ review, compact = false }) {
  const rating = Math.max(1, Math.min(5, Number(review?.rating) || 5))
  const location = [review?.city, review?.state].filter(Boolean).join('/')
  const names = Array.isArray(review?.product_names) ? review.product_names : []
  const slugs = Array.isArray(review?.product_slugs) ? review.product_slugs : []
  return (
    <article className={`editorial-review-card ${compact ? 'is-compact' : ''}`}>
      <div className="editorial-review-top">
        <span className="editorial-stars" aria-label={`${rating} de 5 estrelas`}>
          {'★'.repeat(rating)}<span aria-hidden="true">{'☆'.repeat(5 - rating)}</span>
        </span>
        {review?.featured && <span className="editorial-review-featured">Destaque</span>}
      </div>
      <p className="editorial-review-quote">“{review?.comment || 'Avaliação publicada.'}”</p>
      {names.length > 0 && (
        <div className="editorial-review-products" aria-label="Produtos avaliados">
          {names.slice(0, compact ? 2 : 3).map((name, index) => {
            const slug = slugs.length === names.length ? slugs[index] : ''
            return slug ? (
              <a key={`${name}-${index}`} href={`/p/${encodeURIComponent(slug)}`}>{name}</a>
            ) : (
              <span key={`${name}-${index}`}>{name}</span>
            )
          })}
        </div>
      )}
      <div className="editorial-review-author">
        <span className="editorial-review-avatar" aria-hidden="true">{String(review?.display_name || 'C').trim().charAt(0).toUpperCase()}</span>
        <span><strong>{review?.display_name || 'Cliente verificado'}</strong>{location && <small>{location}</small>}</span>
        <span className="editorial-verified" title="Avaliação de compra verificada" aria-label="Compra verificada"><span className="material-icons" aria-hidden="true">verified</span></span>
      </div>
    </article>
  )
}
