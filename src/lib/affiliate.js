const STORAGE_KEY = 'cc_affiliate_attribution';
const VISITOR_KEY = 'cc_affiliate_visitor_id';

function read() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function getAffiliateAttribution() { return read(); }
export function getAffiliateVisitorId() {
  const key = VISITOR_KEY;
  const getCookie = () => {
    try {
      const pair = document.cookie.split('; ').find(value => value.startsWith(`${key}=`));
      return pair ? decodeURIComponent(pair.slice(key.length + 1)) : '';
    } catch { return ''; }
  };
  try {
    let id = localStorage.getItem(key) || getCookie();
    if (!id) id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem(key, id); } catch {}
    try { document.cookie = `${key}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch {}
    return id;
  } catch {
    let id = getCookie();
    if (!id) id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { document.cookie = `${key}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch {}
    return id;
  }
}

export function saveAffiliateAttribution(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {})); } catch {}
}
export function getAffiliateCheckoutContext() {
  const a = read() || {};
  const expires = Date.parse(a.expires_at || '');
  const valid = Number.isFinite(expires) && expires > Date.now();
  return { affiliate_slug: valid ? String(a.slug || '').trim() : '', visitor_id: getAffiliateVisitorId() };
}
