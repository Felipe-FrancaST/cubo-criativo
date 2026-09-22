const STORAGE_KEY = 'cc_affiliate_attribution';
const VISITOR_KEY = 'cc_affiliate_visitor_id';

function read() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function getAffiliateAttribution() { return read(); }
export function getAffiliateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) { id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(VISITOR_KEY, id); }
    return id;
  } catch { return ''; }
}
export function saveAffiliateAttribution(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {})); } catch {}
}
export function getAffiliateCheckoutContext() {
  const a = read() || {};
  return { affiliate_slug: String(a.slug || '').trim(), visitor_id: getAffiliateVisitorId() };
}
