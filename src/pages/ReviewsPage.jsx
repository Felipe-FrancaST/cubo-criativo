import React from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function ReviewsPage({ onGoHome }) {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [ratingFilter, setRatingFilter] = React.useState('all');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const response = await supabase
          .from('customer_reviews_public')
          .select('id,rating,comment,display_name,city,state,product_names,product_slugs,featured,created_at,approved_at')
          .order('featured', { ascending: false })
          .order('approved_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(100);
        if (response.error) throw response.error;
        if (alive) setReviews(response.data || []);
      } catch (e) {
        if (alive) setError(e?.message || 'Não foi possível carregar as avaliações.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = ratingFilter === 'all' ? reviews : reviews.filter((review) => Number(review.rating) === Number(ratingFilter));
  const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0;

  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-bold text-cyan-300">Clientes verificados</p><h1 className="mt-2 text-3xl sm:text-4xl font-black">Avaliações da Cubo Criativo</h1><p className="mt-3 max-w-2xl text-slate-300">Somente avaliações vinculadas a pedidos entregues e aprovadas pela equipe aparecem aqui.</p></div>
          <div className="flex flex-wrap gap-3"><div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"><p className="text-xs text-slate-400">Média</p><p className="text-xl font-black text-amber-300">{average ? average.toFixed(1).replace('.', ',') : '—'} ★</p></div><div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"><p className="text-xs text-slate-400">Publicadas</p><p className="text-xl font-black">{reviews.length}</p></div></div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">{['all',5,4,3,2,1].map((value) => <button key={value} onClick={() => setRatingFilter(String(value))} className={`rounded-full px-3 py-2 text-sm ring-1 ${String(ratingFilter) === String(value) ? 'bg-amber-400 text-black ring-amber-300' : 'bg-white/5 text-slate-200 ring-white/10'}`}>{value === 'all' ? 'Todas' : `${value} estrelas`}</button>)}</div>

        {loading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-3xl bg-white/5 ring-1 ring-white/10" />)}</div> : null}
        {error ? <div className="mt-8 rounded-2xl bg-red-500/10 px-4 py-3 text-red-200 ring-1 ring-red-400/30">{error}</div> : null}
        {!loading && !error && !filtered.length ? <div className="mt-8 rounded-2xl bg-white/5 p-6 text-slate-300 ring-1 ring-white/10">Nenhuma avaliação encontrada neste filtro.</div> : null}
        {!loading && filtered.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((review) => {
          const location = [review.city, review.state].filter(Boolean).join('/');
          return <article key={review.id} className={`rounded-[26px] p-5 ring-1 ${review.featured ? 'bg-amber-400/[.07] ring-amber-300/25' : 'bg-white/[.04] ring-white/10'}`}>
            <div className="flex items-center justify-between gap-3"><div className="text-amber-300" aria-label={`${review.rating} estrelas`}>{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}</div>{review.featured ? <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/20">Destaque</span> : null}</div>
            <p className="mt-4 text-sm leading-7 text-slate-200">“{review.comment}”</p>
            {Array.isArray(review.product_names) && review.product_names.length ? <div className="mt-4 flex flex-wrap gap-2">{review.product_names.slice(0, 3).map((name, index) => {
              const productSlug = Array.isArray(review.product_slugs) && review.product_slugs.length === review.product_names.length ? review.product_slugs[index] : '';
              return productSlug ? <a key={`${name}-${productSlug}`} href={`/p/${encodeURIComponent(productSlug)}`} className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 ring-1 ring-cyan-300/20 hover:bg-cyan-400/15">{name}</a> : <span key={`${name}-${index}`} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-cyan-100 ring-1 ring-white/10">{name}</span>;
            })}</div> : null}
            <p className="mt-4 text-xs text-slate-400">{review.display_name || 'Cliente verificado'}{location ? ` • ${location}` : ''}</p>
          </article>;
        })}</div> : null}

        <button type="button" onClick={onGoHome} className="mt-8 rounded-xl px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/5">Voltar ao início</button>
      </section>
    </main>
  );
}
