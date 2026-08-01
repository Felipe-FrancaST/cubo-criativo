import React from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { buildCustomerOrderPath, buildPublicReviewName, clampReviewRating, extractReviewProductRefs, normalizeReviewComment, reviewVisibilityLabel } from '../lib/reviews.js';

const fmtBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function loadOrderItems(orderId) {
  const modern = await supabase
    .from('order_items')
    .select('order_id,product_id,product_name,qty,scale,product_image_url')
    .eq('order_id', orderId);
  if (!modern.error) {
    return (modern.data || []).map((item) => ({
      ...item,
      name: item.product_name || 'Produto',
      img: item.product_image_url || '',
      slug: '',
    }));
  }
  const legacy = await supabase
    .from('order_items')
    .select('order_id,product_id,name,qty,scale,img')
    .eq('order_id', orderId);
  if (legacy.error) throw legacy.error;
  return legacy.data || [];
}

async function enrichItems(items) {
  const keys = Array.from(new Set((items || []).map((item) => String(item?.product_id || '').trim()).filter(Boolean)));
  if (!keys.length) return items;
  const uuidKeys = keys.filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  const slugKeys = keys.filter((value) => !uuidKeys.includes(value));
  const products = [];
  if (uuidKeys.length) {
    const response = await supabase.from('products').select('id,name,slug,image_url,images').in('id', uuidKeys);
    if (!response.error) products.push(...(response.data || []));
  }
  if (slugKeys.length) {
    const response = await supabase.from('products').select('id,name,slug,image_url,images').in('slug', slugKeys);
    if (!response.error) products.push(...(response.data || []));
  }
  const byKey = new Map();
  products.forEach((product) => {
    if (product?.id) byKey.set(String(product.id), product);
    if (product?.slug) byKey.set(String(product.slug), product);
  });
  return (items || []).map((item) => {
    const product = byKey.get(String(item?.product_id || ''));
    if (!product) return item;
    return {
      ...item,
      name: item.name || product.name,
      slug: product.slug || item.slug || '',
      img: item.img || product.image_url || (Array.isArray(product.images) ? product.images[0] : '') || '',
    };
  });
}

export default function ReviewPage({ orderId = '', onRequireLogin, onGoHome }) {
  const { user } = useAuth();
  const [order, setOrder] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [review, setReview] = React.useState(null);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    if (!user || !orderId) return undefined;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await supabase
          .from('orders')
          .select('id,user_id,status,total,created_at,production_status,order_type')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (response.error) throw response.error;
        if (!response.data) throw new Error('Pedido não encontrado nesta conta.');
        const loadedItems = await enrichItems(await loadOrderItems(orderId));
        const reviewResponse = await supabase
          .from('customer_reviews')
          .select('id,order_id,rating,comment,approved,featured,created_at,updated_at')
          .eq('order_id', orderId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (reviewResponse.error && !/customer_reviews/i.test(String(reviewResponse.error.message || ''))) throw reviewResponse.error;
        if (!alive) return;
        setOrder(response.data);
        setItems(loadedItems);
        const existing = reviewResponse.data || null;
        setReview(existing);
        setRating(clampReviewRating(existing?.rating || 5));
        setComment(String(existing?.comment || ''));
      } catch (e) {
        if (alive) setError(e?.message || 'Não foi possível carregar a área de avaliação.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user, orderId]);

  async function submitReview() {
    if (!user || !order?.id) return;
    const safeComment = normalizeReviewComment(comment);
    if (safeComment.length < 8) {
      setError('Escreva um comentário com pelo menos 8 caracteres.');
      return;
    }
    if (String(order.production_status || '').toLowerCase() !== 'entregue') {
      setError('A avaliação é liberada quando o pedido estiver marcado como entregue.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const profileResponse = await supabase.from('profiles').select('full_name,city,state').eq('id', user.id).maybeSingle();
      const profile = profileResponse.data || {};
      const refs = extractReviewProductRefs(items);
      const payload = {
        order_id: order.id,
        user_id: user.id,
        rating: clampReviewRating(rating),
        comment: safeComment,
        display_name: buildPublicReviewName(profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name),
        city: String(profile.city || '').slice(0, 60) || null,
        state: String(profile.state || '').slice(0, 2).toUpperCase() || null,
        order_total: Number(order.total) || null,
        product_ids: refs.productIds.length ? refs.productIds : null,
        product_slugs: refs.productSlugs.length ? refs.productSlugs : null,
        product_names: refs.productNames.length ? refs.productNames : null,
        approved: false,
        featured: false,
        approved_at: null,
      };
      const response = await supabase
        .from('customer_reviews')
        .upsert(payload, { onConflict: 'order_id' })
        .select('id,order_id,rating,comment,approved,featured,created_at,updated_at')
        .single();
      if (response.error) throw response.error;
      setReview(response.data);
      setSuccess('Pedido avaliado com sucesso.');
    } catch (e) {
      const message = String(e?.message || 'Não foi possível enviar a avaliação.');
      setError(message.includes('customer_reviews') ? 'Execute o arquivo SQL_AVALIACOES.sql no Supabase antes de usar esta área.' : message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!orderId) {
    return <main className="flex-1"><section className="container-cc px-4 py-12"><div className="mx-auto max-w-xl rounded-3xl bg-white/5 p-6 ring-1 ring-white/10"><h1 className="text-2xl font-black">Pedido não informado</h1><p className="mt-2 text-slate-300">Abra o link de avaliação recebido por e-mail ou acesse Meus pedidos.</p><a href="/meus-pedidos" className="mt-5 inline-flex rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black">Abrir meus pedidos</a></div></section></main>;
  }

  if (!user) {
    return (
      <main className="flex-1"><section className="container-cc px-4 py-12"><div className="mx-auto max-w-xl rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Avaliação verificada</p>
        <h1 className="mt-2 text-2xl font-black">Entre na conta usada na compra</h1>
        <p className="mt-3 text-slate-300">Isso garante que somente o cliente responsável pelo pedido possa avaliá-lo.</p>
        <button onClick={() => onRequireLogin?.('Faça login para avaliar o pedido.')} className="mt-5 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black">Entrar para avaliar</button>
      </div></section></main>
    );
  }

  const delivered = String(order?.production_status || '').toLowerCase() === 'entregue';
  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Compra verificada</p><h1 className="mt-2 text-3xl font-black">Avaliar pedido</h1></div>
            <a href={buildCustomerOrderPath(orderId)} className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/5">Ver pedido</a>
          </div>

          {loading ? <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 text-slate-300">Carregando pedido…</div> : null}
          {error ? <div className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-red-200 ring-1 ring-red-400/30">{error}</div> : null}
          {success ? <div className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-emerald-100 ring-1 ring-emerald-400/30">{success}</div> : null}

          {!loading && order ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]">
              <div className="rounded-[28px] bg-white/[.04] p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-400">Pedido</p><p className="font-bold">#{String(order.id).slice(0, 8)}</p></div><div className="text-right"><p className="text-xs text-slate-400">Total</p><p className="font-bold">{fmtBRL(order.total)}</p></div></div>
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={`${item.product_id || item.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                      {item.img ? <img src={item.img} alt={item.name || 'Produto'} className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/5"><span className="material-icons text-slate-500">inventory_2</span></div>}
                      <div className="min-w-0"><p className="font-semibold text-white">{item.name || 'Produto'}</p><p className="mt-1 text-xs text-slate-400">Quantidade: {Number(item.qty) || 1}{item.scale ? ` • Escala: ${item.scale}` : ''}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(30,41,59,.88),rgba(2,6,23,.95))] p-5 ring-1 ring-white/10">
                {review ? <div className="mb-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-400/25">{reviewVisibilityLabel(review)}</div> : null}
                {!delivered ? <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/25">A avaliação será liberada depois que o pedido for marcado como entregue.</div> : null}
                <label className="block"><span className="text-sm font-semibold">Sua nota</span><div className="mt-3 flex gap-1">{[1,2,3,4,5].map((value) => <button key={value} type="button" disabled={!delivered || submitting} onClick={() => setRating(value)} className={`text-3xl ${value <= rating ? 'text-amber-300' : 'text-slate-600'}`} aria-label={`${value} estrelas`}>★</button>)}</div></label>
                <label className="mt-5 block"><span className="text-sm font-semibold">Conte como foi sua experiência</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={!delivered || submitting} maxLength={500} rows={6} className="mt-2 w-full rounded-2xl bg-black/25 px-4 py-3 text-slate-100 ring-1 ring-white/10 outline-none focus:ring-amber-300/40" placeholder="Fale sobre acabamento, qualidade, prazo, embalagem e atendimento." /><span className="mt-1 block text-right text-xs text-slate-500">{comment.length}/500</span></label>
                <button onClick={submitReview} disabled={!delivered || submitting} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Enviando…' : review ? 'Salvar nova versão' : 'Enviar avaliação'}</button>
              </div>
            </div>
          ) : null}

          <button type="button" onClick={onGoHome} className="mt-6 text-sm text-slate-400 underline underline-offset-4 hover:text-white">Voltar ao site</button>
        </div>
      </section>
    </main>
  );
}
