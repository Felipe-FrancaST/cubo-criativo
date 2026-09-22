import crypto from 'crypto';

export const AFFILIATE_ATTRIBUTION_DAYS_DEFAULT = 30;

export function normalizeAffiliateSlug(value) {
  return String(value || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function normalizeCouponCode(value) {
  return String(value || '').trim().toUpperCase();
}

export async function getActiveAffiliateBySlug(sb, slug) {
  const normalized = normalizeAffiliateSlug(slug);
  if (!normalized) return null;
  const { data, error } = await sb.from('affiliates').select('id,user_id,slug,active,commission_type,commission_value,commission_base,attribution_days,recurring_vip,recurring_commission_value').eq('slug', normalized).eq('active', true).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getAffiliateById(sb, id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const { data, error } = await sb.from('affiliates').select('id,user_id,slug,active,commission_type,commission_value,commission_base,attribution_days,recurring_vip,recurring_commission_value').eq('id', key).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getAffiliateAttribution(sb, { visitorId, affiliateId, now = new Date() }) {
  if (!visitorId || !affiliateId) return null;
  const { data } = await sb.from('affiliate_attributions').select('id,affiliate_id,visitor_id,first_visit_at,last_visit_at,expires_at').eq('visitor_id', visitorId).eq('affiliate_id', affiliateId).maybeSingle();
  if (!data) return null;
  const expires = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expires && expires <= now.getTime()) return null;
  return data;
}

export async function resolveAffiliateForCheckout(sb, { affiliateSlug, visitorId, couponCode, orderType = 'shop', userId }) {
  const coupon = couponCode ? await sb.from('coupons').select('code,affiliate_id').eq('code', normalizeCouponCode(couponCode)).maybeSingle() : { data: null };
  const couponAffiliateId = coupon?.data?.affiliate_id || null;
  // Regra definida pelo Cubo: quando há conflito, o vendedor do cupom vence.
  if (couponAffiliateId) {
    const aff = await getAffiliateById(sb, couponAffiliateId);
    if (aff?.active) return { affiliate: aff, source: 'coupon', coupon: coupon?.data || null };
  }

  let candidate = null;
  if (affiliateSlug) candidate = await getActiveAffiliateBySlug(sb, affiliateSlug);
  if (!candidate && visitorId) {
    const { data } = await sb.from('affiliate_attributions').select('affiliate_id,expires_at').eq('visitor_id', visitorId).order('last_visit_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.affiliate_id) {
      const expires = data.expires_at ? new Date(data.expires_at).getTime() : 0;
      if (!expires || expires > Date.now()) candidate = await getAffiliateById(sb, data.affiliate_id);
    }
  }
  if (!candidate?.active) return { affiliate: null, source: null, coupon: coupon?.data || null };
  return { affiliate: candidate, source: 'link', coupon: coupon?.data || null };
}

export async function trackAffiliateVisit(sb, { slug, visitorId, landingPage = '/', referrer = '', userAgent = '' }) {
  const affiliate = await getActiveAffiliateBySlug(sb, slug);
  if (!affiliate) return { ok: false, status: 404, error: 'Vendedor não encontrado.' };
  const visitor = String(visitorId || '').trim() || crypto.randomUUID();
  const now = new Date();
  const days = Math.max(1, Number(affiliate.attribution_days || AFFILIATE_ATTRIBUTION_DAYS_DEFAULT) || AFFILIATE_ATTRIBUTION_DAYS_DEFAULT);
  const expires = new Date(now.getTime() + days * 86400000).toISOString();
  await sb.from('affiliate_visits').insert({ affiliate_id: affiliate.id, visitor_id: visitor, landing_page: String(landingPage || '/').slice(0, 500), referrer: String(referrer || '').slice(0, 1000), user_agent: String(userAgent || '').slice(0, 1000) });
  const existing = await sb.from('affiliate_attributions').select('id,first_visit_at').eq('visitor_id', visitor).eq('affiliate_id', affiliate.id).maybeSingle();
  if (existing?.data?.id) {
    await sb.from('affiliate_attributions').update({ last_visit_at: now.toISOString(), expires_at: expires }).eq('id', existing.data.id);
  } else {
    await sb.from('affiliate_attributions').insert({ affiliate_id: affiliate.id, visitor_id: visitor, first_visit_at: now.toISOString(), last_visit_at: now.toISOString(), expires_at: expires });
  }
  return { ok: true, visitor_id: visitor, affiliate: { id: affiliate.id, slug: affiliate.slug, attribution_days: days }, expires_at: expires };
}

function roundMoney(n) { return Number((Number(n) || 0).toFixed(2)); }

export async function maybeCreateAffiliateCommission(sb, { order, subtotal, affiliateId, orderType, isFirstVipSubscription }) {
  if (!affiliateId || !order?.id) return null;
  const aff = await getAffiliateById(sb, affiliateId);
  if (!aff?.active) return null;
  const type = String(orderType || order?.order_type || 'shop').toLowerCase();
  if (type === 'vip_upgrade' || type === 'upgrade' || type === 'upgrade_vip') return null;
  if (type === 'vip' && !isFirstVipSubscription) return null;
  const base = roundMoney(subtotal);
  if (!(base > 0)) return null;
  const commissionType = String(aff.commission_type || 'percent').toLowerCase();
  const rate = Number(aff.commission_value || 0);
  let value = commissionType === 'fixed' ? rate : base * (rate / 100);
  value = roundMoney(value);
  if (!(value > 0)) return null;
  const payload = { order_id: order.id, affiliate_id: aff.id, commission_base: base, commission_rate: rate, commission_value: value, status: 'pending' };
  const { data, error } = await sb.from('affiliate_commissions').upsert(payload, { onConflict: 'order_id' }).select('*').maybeSingle();
  if (error) throw error;
  return data || payload;
}

export async function finalizeAffiliateCommission(sb, orderId, paid) {
  if (!orderId) return;
  const status = paid ? 'confirmed' : 'cancelled';
  await sb.from('affiliate_commissions').update({ status, confirmed_at: paid ? new Date().toISOString() : null }).eq('order_id', orderId).in('status', paid ? ['pending','confirmed'] : ['pending','confirmed']);
}

export function couponEligibleSubtotal({ coupon, total, items = [], vipPlanId = '' }) {
  const appliesTo = String(coupon?.applies_to || 'products').toLowerCase();
  if (vipPlanId) return Number(total || 0);
  const ids = Array.isArray(coupon?.product_ids) ? coupon.product_ids.map(String) : [];
  if (!ids.length) return Number(total || 0);
  return Number((items || []).filter(i => ids.includes(String(i?.id ?? i?.product_id ?? ''))).reduce((sum,i)=>sum + (Number(i?.price ?? i?.unit_price ?? 0)||0)*(Number(i?.qty ?? i?.quantity ?? 1)||1),0).toFixed(2));
}
