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
  const { data, error } = await sb.from('affiliates').select('id,user_id,slug,active,deleted_at,commission_type,commission_value,commission_base,attribution_days,recurring_vip,recurring_commission_value').eq('slug', normalized).eq('active', true).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getAffiliateById(sb, id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const { data, error } = await sb.from('affiliates').select('id,user_id,slug,active,deleted_at,commission_type,commission_value,commission_base,attribution_days,recurring_vip,recurring_commission_value').eq('id', key).is('deleted_at', null).maybeSingle();
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


// Só cupons ativos e não esgotados são oferecidos aos visitantes do link.
export async function getAffiliateWelcomeCoupon(sb, affiliateId) {
  const { data, error } = await sb.from('coupons')
    .select('code,label,discount_type,discount_value,active,used_count,max_uses,expires_at')
    .eq('affiliate_id', affiliateId).eq('active', true)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const now = Date.now();
  return (data || []).find(c =>
    (!c.expires_at || new Date(c.expires_at).getTime() > now) &&
    (Number(c.used_count || 0) < (Number(c.max_uses) || 1))
  ) || null;
}

// O vínculo entre login e visita impede que a indicação se perca ao trocar
// de navegador/dispositivo depois que o cliente entrou na sua conta.
export async function claimAffiliateReferral(sb, { userId, visitorId, slug }) {
  const affiliate = await getActiveAffiliateBySlug(sb, slug);
  if (!affiliate) return { ok: false, status: 404, error: 'Link de vendedor indisponível.' };
  if (affiliate.user_id === userId) return { ok: false, status: 403, error: 'Você não pode resgatar seu próprio link.' };
  const visitor = String(visitorId || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(visitor)) return { ok: false, status: 400, error: 'Identificador de visita inválido.' };
  const attribution = await getAffiliateAttribution(sb, { visitorId: visitor, affiliateId: affiliate.id });
  if (!attribution) return { ok: false, status: 409, error: 'A indicação expirou ou não foi registrada. Abra novamente o link do vendedor.' };
  const { data: current, error: readError } = await sb.from('affiliate_user_attributions')
    .select('last_visit_at').eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  if (!current?.last_visit_at || new Date(attribution.last_visit_at) >= new Date(current.last_visit_at)) {
    const { error } = await sb.from('affiliate_user_attributions').upsert({
      user_id: userId, affiliate_id: affiliate.id, visitor_id: visitor,
      last_visit_at: attribution.last_visit_at, expires_at: attribution.expires_at,
    }, { onConflict: 'user_id' });
    if (error) throw error;
  }
  const coupon = await getAffiliateWelcomeCoupon(sb, affiliate.id);
  if (coupon) {
    const { error } = await sb.from('affiliate_coupon_claims').upsert({
      user_id: userId, affiliate_id: affiliate.id, coupon_code: coupon.code,
    }, { onConflict: 'user_id,coupon_code', ignoreDuplicates: true });
    if (error) throw error;
  }
  return { ok: true, coupon: coupon ? { code: coupon.code, label: coupon.label, discount_type: coupon.discount_type, discount_value: coupon.discount_value } : null };
}

export async function resolveAffiliateForCheckout(sb, { affiliateSlug, visitorId, couponCode, userId }) {
  // O cupom válido tem prioridade; o vínculo é resolvido do banco, nunca do navegador.
  const code = normalizeCouponCode(couponCode);
  let coupon = null;
  if (code) {
    const result = await sb.from('coupons').select('code,affiliate_id,active').eq('code', code).maybeSingle();
    if (result.error) throw result.error;
    coupon = result.data || null;
    if (coupon?.active && coupon.affiliate_id) {
      const affiliate = await getAffiliateById(sb, coupon.affiliate_id);
      if (affiliate?.active && affiliate.user_id !== userId) {
        return { affiliate, source: 'coupon', coupon };
      }
    }
  }

  // Uma slug informada manualmente NÃO gera comissão. Exige visita real
  // registrada no servidor, dentro da janela de atribuição.
  const visitor = String(visitorId || '').trim();
  if (visitor && /^[a-zA-Z0-9_-]{8,120}$/.test(visitor)) {
    const result = await sb.from('affiliate_attributions')
      .select('affiliate_id,expires_at')
      .eq('visitor_id', visitor)
      .gt('expires_at', new Date().toISOString())
      .order('last_visit_at', { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw result.error;
    const candidate = result.data?.affiliate_id ? await getAffiliateById(sb, result.data.affiliate_id) : null;
    if (candidate?.active && candidate.user_id !== userId)
      return { affiliate: candidate, source: 'link', coupon, visitorId: visitor };
  }
  // A indicação vinculada à conta também atende pedidos em outro dispositivo
  // após o cliente autenticar-se pela primeira vez no link do vendedor.
  if (userId) {
    const result = await sb.from('affiliate_user_attributions')
      .select('affiliate_id,visitor_id,expires_at').eq('user_id', userId)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    if (result.error) throw result.error;
    const candidate = result.data?.affiliate_id ? await getAffiliateById(sb, result.data.affiliate_id) : null;
    if (candidate?.active && candidate.user_id !== userId)
      return { affiliate: candidate, source: 'link', coupon, visitorId: result.data.visitor_id };
  }
  // Nenhuma slug enviada pelo cliente cria indicação sem visita validada.
  return { affiliate: null, source: null, coupon };
}

export async function trackAffiliateVisit(sb, { slug, visitorId, landingPage = '/', referrer = '', userAgent = '' }) {
  const affiliate = await getActiveAffiliateBySlug(sb, slug);
  if (!affiliate) return { ok: false, status: 404, error: 'Vendedor não encontrado.' };
  const visitor = String(visitorId || '').trim() || crypto.randomUUID();
  const now = new Date();
  const days = Math.max(1, Number(affiliate.attribution_days || AFFILIATE_ATTRIBUTION_DAYS_DEFAULT) || AFFILIATE_ATTRIBUTION_DAYS_DEFAULT);
  const expires = new Date(now.getTime() + days * 86400000).toISOString();
  if (visitor.length > 120 || !/^[a-zA-Z0-9_-]{8,120}$/.test(visitor)) return { ok: false, status: 400, error: 'Identificador de visitante inválido.' };
  const visit = await sb.from('affiliate_visits').insert({ affiliate_id: affiliate.id, visitor_id: visitor, landing_page: String(landingPage || '/').slice(0, 500), referrer: String(referrer || '').slice(0, 1000), user_agent: String(userAgent || '').slice(0, 1000) });
  if (visit.error) throw visit.error;
  const existing = await sb.from('affiliate_attributions').select('id,first_visit_at').eq('visitor_id', visitor).eq('affiliate_id', affiliate.id).maybeSingle();
  if (existing?.data?.id) {
    const changed = await sb.from('affiliate_attributions').update({ last_visit_at: now.toISOString(), expires_at: expires }).eq('id', existing.data.id);
    if (changed.error) throw changed.error;
  } else {
    const created = await sb.from('affiliate_attributions').insert({ affiliate_id: affiliate.id, visitor_id: visitor, first_visit_at: now.toISOString(), last_visit_at: now.toISOString(), expires_at: expires });
    if (created.error) throw created.error;
  }
  const coupon = await getAffiliateWelcomeCoupon(sb, affiliate.id);
  return { ok: true, visitor_id: visitor,
    affiliate: { id: affiliate.id, slug: affiliate.slug, attribution_days: days },
    coupon: coupon ? { code: coupon.code, label: coupon.label, discount_type: coupon.discount_type, discount_value: coupon.discount_value } : null,
    expires_at: expires };
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
  if (!paid) {
    const { error } = await sb.rpc('affiliate_reverse_commission', { p_order_id: orderId });
    if (error) throw error;
    return;
  }
  // Confirmar apenas após aprovação real; chamadas repetidas são idempotentes.
  const { error } = await sb.from('affiliate_commissions').update({
    status: 'confirmed', confirmed_at: new Date().toISOString(),
  }).eq('order_id', orderId).in('status', ['pending','cancelled']).is('withdrawal_id', null);
  if (error) throw error;
}

// Recuperação para webhooks que chegaram antes do registro da comissão
// ou pedidos mais antigos que já tinham vendedor atribuído.
export async function ensureAffiliateCommissionAfterPayment(sb, order) {
  if (!order?.id) return null;
  const { data: existing, error } = await sb.from('affiliate_commissions')
    .select('id,status').eq('order_id', order.id).maybeSingle();
  if (error) throw error;
  if (existing) return existing;
  let affiliateId = order.affiliate_id;
  if (!affiliateId && order.coupon_code) {
    const { data: coupon, error: couponError } = await sb.from('coupons')
      .select('affiliate_id').eq('code', normalizeCouponCode(order.coupon_code)).maybeSingle();
    if (couponError) throw couponError;
    affiliateId = coupon?.affiliate_id || null;
  }
  if (!affiliateId) return null;
  const orderType = String(order.order_type || 'shop');
  let firstVip = true;
  if (orderType === 'vip') {
    const { count, error: ordersError } = await sb.from('orders').select('id', { count: 'exact', head: true })
      .eq('user_id', order.user_id).eq('order_type','vip').eq('status','paid').neq('id',order.id);
    if (ordersError) throw ordersError;
    firstVip = !count;
  }
  const base = Number(order.total || 0) + Number(order.coupon_discount || 0);
  const created = await maybeCreateAffiliateCommission(sb, { order, affiliateId,
    subtotal: base, orderType, isFirstVipSubscription: firstVip });
  if (created) {
    const update = await sb.from('orders').update({ affiliate_id: affiliateId,
      affiliate_source: order.affiliate_id ? order.affiliate_source : 'coupon', affiliate_commission: created.commission_value }).eq('id',order.id);
    if (update.error) throw update.error;
  }
  return created;
}


export function couponEligibleSubtotal({ coupon, total, items = [], vipPlanId = '' }) {
  const appliesTo = String(coupon?.applies_to || 'products').toLowerCase();
  if (vipPlanId) return Number(total || 0);
  const ids = Array.isArray(coupon?.product_ids) ? coupon.product_ids.map(String) : [];
  if (!ids.length) return Number(total || 0);
  return Number((items || []).filter(i => ids.includes(String(i?.id ?? i?.product_id ?? ''))).reduce((sum,i)=>sum + (Number(i?.price ?? i?.unit_price ?? 0)||0)*(Number(i?.qty ?? i?.quantity ?? 1)||1),0).toFixed(2));
}
