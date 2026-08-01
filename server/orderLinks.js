export function normalizeSiteUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function buildOrderDetailsUrl(siteUrl, orderId = '') {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return '';
  const id = String(orderId || '').trim();
  return id ? `${base}/meus-pedidos?pedido=${encodeURIComponent(id)}` : `${base}/meus-pedidos`;
}

export function buildReviewUrl(siteUrl, orderId = '') {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return '';
  const id = String(orderId || '').trim();
  return id ? `${base}/avaliar-pedido?pedido=${encodeURIComponent(id)}` : `${base}/avaliar-pedido`;
}

export function buildVipAreaUrl(siteUrl) {
  const base = normalizeSiteUrl(siteUrl);
  return base ? `${base}/area-vip` : '';
}
