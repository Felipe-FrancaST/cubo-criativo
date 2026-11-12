const STORAGE_KEY = 'cc_affiliate_attribution';
const VISITOR_KEY = 'cc_affiliate_visitor_id';
let memoryAttribution = null;
let memoryVisitorId = '';
function getCookie(key) {
  try { const p = document.cookie.split('; ').find(v => v.startsWith(`${key}=`)); return p ? decodeURIComponent(p.slice(key.length + 1)) : ''; } catch { return ''; }
}
function setCookie(key, value, seconds) {
  try { document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${seconds}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch {}
}

function read() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  try { const raw = getCookie(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return memoryAttribution;
}
export function getAffiliateAttribution() { return read(); }
export function getAffiliateVisitorId() {
  let id = '';
  try { id = localStorage.getItem(VISITOR_KEY) || ''; } catch {}
  if (!id) id = getCookie(VISITOR_KEY) || memoryVisitorId;
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) {
    id = globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now()}${Math.random().toString(36).slice(2)}`;
  }
  memoryVisitorId = id;
  try { localStorage.setItem(VISITOR_KEY, id); } catch {}
  setCookie(VISITOR_KEY, id, 365 * 86400);
  return id;
}

export function saveAffiliateAttribution(data) {
  memoryAttribution = data || {};
  const encoded = JSON.stringify(memoryAttribution);
  try { localStorage.setItem(STORAGE_KEY, encoded); } catch {}
  const expires = Date.parse(memoryAttribution.expires_at || '');
  const seconds = Number.isFinite(expires) ? Math.max(0, Math.min(365 * 86400, Math.ceil((expires - Date.now()) / 1000))) : 86400;
  setCookie(STORAGE_KEY, encoded, seconds);
}
export function getAffiliateCheckoutContext() {
  const a = read() || {};
  const expires = Date.parse(a.expires_at || '');
  const valid = Number.isFinite(expires) && expires > Date.now();
  return { affiliate_slug: valid ? String(a.slug || '').trim() : '', visitor_id: getAffiliateVisitorId() };
}

export function getPendingAffiliateReferral() {
  const a = read() || {};
  const valid = Date.parse(a.expires_at || '') > Date.now();
  if (!valid || !a.slug) return null;
  return { affiliate_slug: String(a.slug), visitor_id: getAffiliateVisitorId() };
}
