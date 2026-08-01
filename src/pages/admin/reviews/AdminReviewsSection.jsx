import React from 'react';
import { supabase } from '../../../lib/supabaseClient.js';

const fmtDate = (value) => {
  try { return value ? new Date(value).toLocaleString('pt-BR') : '—'; } catch { return '—'; }
};

export default function AdminReviewsSection({ onToast }) {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState('pending');
  const [search, setSearch] = React.useState('');
  const [busyId, setBusyId] = React.useState('');

  const loadReviews = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await supabase
        .from('customer_reviews')
        .select('id,order_id,user_id,rating,comment,display_name,city,state,approved,featured,product_names,product_slugs,order_total,created_at,updated_at,approved_at')
        .order('created_at', { ascending: false })
        .limit(300);
      if (response.error) throw response.error;
      const rows = response.data || [];
      setReviews(rows);
    } catch (e) {
      const message = String(e?.message || 'Não foi possível carregar as avaliações.');
      setError(message.includes('customer_reviews') ? 'Execute o arquivo SQL_AVALIACOES.sql no Supabase para ativar a moderação.' : message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadReviews(); }, [loadReviews]);

  const metrics = React.useMemo(() => ({
    total: reviews.length,
    pending: reviews.filter((review) => !review.approved).length,
    published: reviews.filter((review) => review.approved).length,
    featured: reviews.filter((review) => review.approved && review.featured).length,
  }), [reviews]);

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((review) => {
      if (filter === 'pending' && review.approved) return false;
      if (filter === 'published' && !review.approved) return false;
      if (filter === 'featured' && !(review.approved && review.featured)) return false;
      if (!term) return true;
      const haystack = [review.display_name, review.comment, review.order_id, ...(review.product_names || [])].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [reviews, filter, search]);

  async function updateReview(review, patch, successMessage) {
    if (!review?.id) return;
    setBusyId(review.id);
    setError('');
    try {
      const nextPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(nextPatch, 'approved')) {
        nextPatch.approved_at = nextPatch.approved ? new Date().toISOString() : null;
        if (!nextPatch.approved) nextPatch.featured = false;
      }
      const response = await supabase
        .from('customer_reviews')
        .update(nextPatch)
        .eq('id', review.id)
        .select('id,order_id,user_id,rating,comment,display_name,city,state,approved,featured,product_names,product_slugs,order_total,created_at,updated_at,approved_at')
        .single();
      if (response.error) throw response.error;
      setReviews((current) => current.map((item) => item.id === review.id ? response.data : item));
      onToast?.(successMessage);
    } catch (e) {
      setError(e?.message || 'Não foi possível atualizar a avaliação.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteReview(review) {
    if (!review?.id || !window.confirm('Excluir esta avaliação permanentemente?')) return;
    setBusyId(review.id);
    try {
      const response = await supabase.from('customer_reviews').delete().eq('id', review.id);
      if (response.error) throw response.error;
      setReviews((current) => current.filter((item) => item.id !== review.id));
      onToast?.('Avaliação excluída.');
    } catch (e) {
      setError(e?.message || 'Não foi possível excluir a avaliação.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-gradient-to-br from-white/[.06] to-white/[.025] p-4 ring-1 ring-white/10 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Moderação</p><h2 className="mt-2 text-2xl font-black text-white">Avaliações dos clientes</h2><p className="mt-1 text-sm text-slate-400">Aprove, oculte, destaque ou exclua avaliações antes que apareçam no site.</p></div>
          <button onClick={loadReviews} disabled={loading} className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50">{loading ? 'Atualizando…' : 'Atualizar avaliações'}</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
          ['Total', metrics.total], ['Pendentes', metrics.pending], ['Publicadas', metrics.published], ['Destaques', metrics.featured],
        ].map(([label, value]) => <div key={label} className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>)}</div>
      </div>

      <div className="rounded-[24px] bg-white/[.035] p-4 ring-1 ring-white/10">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, pedido, produto ou comentário…" className="w-full rounded-2xl bg-black/20 px-4 py-3 text-slate-100 ring-1 ring-white/10" />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl bg-[#08131d] px-4 py-3 text-slate-100 ring-1 ring-white/10">
            <option value="all">Todas</option><option value="pending">Pendentes</option><option value="published">Publicadas</option><option value="featured">Destaques</option>
          </select>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-red-200 ring-1 ring-red-400/30">{error}</div> : null}
      {!loading && !visible.length ? <div className="rounded-2xl bg-white/[.035] p-6 text-slate-300 ring-1 ring-white/10">Nenhuma avaliação encontrada neste filtro.</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map((review) => {
          const busy = busyId === review.id;
          const location = [review.city, review.state].filter(Boolean).join('/');
          return (
            <article key={review.id} className={`rounded-[28px] p-5 ring-1 ${review.approved ? 'bg-emerald-500/[.045] ring-emerald-400/20' : 'bg-amber-500/[.045] ring-amber-400/20'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="text-amber-300">{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}</div><p className="mt-2 font-bold text-white">{review.display_name || 'Cliente verificado'}</p><p className="mt-1 text-xs text-slate-400">{location || 'Local não informado'} • {fmtDate(review.created_at)}</p></div>
                <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${review.approved ? 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/20' : 'bg-amber-400/10 text-amber-100 ring-amber-300/20'}`}>{review.approved ? 'Publicada' : 'Pendente'}</span>{review.featured ? <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-300/20">Destaque</span> : null}</div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">“{review.comment}”</p>
              {Array.isArray(review.product_names) && review.product_names.length ? <div className="mt-4 flex flex-wrap gap-2">{review.product_names.slice(0, 5).map((name) => <span key={name} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">{name}</span>)}</div> : null}
              <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p>Pedido: <b className="text-slate-200">#{String(review.order_id || '').slice(0, 8)}</b></p><p>Atualizada: <b className="text-slate-200">{fmtDate(review.updated_at)}</b></p></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => updateReview(review, { approved: !review.approved }, review.approved ? 'Avaliação ocultada.' : 'Avaliação publicada.')} className={`rounded-xl px-3 py-2 text-sm font-semibold ${review.approved ? 'bg-white/5 text-slate-100 ring-1 ring-white/10' : 'bg-emerald-400 text-black'}`}>{review.approved ? 'Ocultar do site' : 'Aprovar e publicar'}</button>
                <button disabled={busy || !review.approved} onClick={() => updateReview(review, { featured: !review.featured }, review.featured ? 'Destaque removido.' : 'Avaliação destacada.')} className="rounded-xl px-3 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-400/10 disabled:opacity-40">{review.featured ? 'Remover destaque' : 'Destacar'}</button>
                <button disabled={busy} onClick={() => deleteReview(review)} className="rounded-xl px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/20 hover:bg-red-500/10">Excluir</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
