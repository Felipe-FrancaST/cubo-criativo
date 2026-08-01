export function clampReviewRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function normalizeReviewComment(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}


export function buildPublicReviewName(value) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!cleaned || cleaned.includes('@')) return 'Cliente verificado';
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export function extractReviewProductRefs(items = []) {
  const productIds = [];
  const productSlugs = [];
  const productNames = [];

  for (const item of Array.isArray(items) ? items : []) {
    const rawId = String(item?.product_id || '').trim();
    const slug = String(item?.slug || '').trim();
    const name = String(item?.product_name || item?.name || '').trim();
    if (rawId && isUuid(rawId)) productIds.push(rawId);
    else if (rawId) productSlugs.push(rawId);
    if (slug) productSlugs.push(slug);
    if (name) productNames.push(name);
  }

  return {
    productIds: Array.from(new Set(productIds)),
    productSlugs: Array.from(new Set(productSlugs)),
    productNames: Array.from(new Set(productNames)),
  };
}

export function reviewVisibilityLabel(review) {
  if (review?.approved) return review?.featured ? 'Publicada e destacada' : 'Publicada';
  return 'Aguardando aprovação';
}

export function buildCustomerOrderPath(orderId = '') {
  const id = String(orderId || '').trim();
  return id ? `/meus-pedidos?pedido=${encodeURIComponent(id)}` : '/meus-pedidos';
}

export function buildReviewPath(orderId = '') {
  const id = String(orderId || '').trim();
  return id ? `/avaliar-pedido?pedido=${encodeURIComponent(id)}` : '/avaliar-pedido';
}
