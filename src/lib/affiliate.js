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

// O marcador é somente uma otimização local; o servidor continua validando a comissão.
export function getPendingAffiliateReferral(userId) {
  const a = read() || {};
  const valid = Date.parse(a.expires_at || '') > Date.now();
  if (!valid || !a.slug || (userId && Array.isArray(a.resolved_users) && a.resolved_users.includes(userId))) return null;
  return { affiliate_slug: String(a.slug), visitor_id: a.visitor_id || getAffiliateVisitorId(), expires_at: a.expires_at };
}

export function resolvePendingAffiliateReferral(referral, userId, result) {
  const a = read();
  if (!a || !referral || a.slug !== referral.affiliate_slug ||
      a.expires_at !== referral.expires_at ||
      (a.visitor_id || getAffiliateVisitorId()) !== referral.visitor_id) return false;
  if (result.ok === true || result.reason === 'self_referral') {
    // Não apagar a atribuição usada pelo checkout nem impedir outra conta de resgatar.
    const users = Array.isArray(a.resolved_users) ? a.resolved_users : [];
    saveAffiliateAttribution({ ...a, resolved_users: [...new Set([...users, userId])] });
    return true;
  }
  if (result.ok === false && ['unavailable', 'invalid_visitor', 'expired_or_missing'].includes(result.reason)) {
    memoryAttribution = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setCookie(STORAGE_KEY, '', 0);
    return true;
  }
  return false;
}
