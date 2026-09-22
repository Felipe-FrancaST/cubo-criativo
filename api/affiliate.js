import { supabaseAdmin, getUserFromAuthHeader } from '../server/supabase.js';
import { rateLimit } from '../server/rateLimit.js';
import { normalizeAffiliateSlug, trackAffiliateVisit } from '../server/affiliate.js';

async function body(req) { if (!req.body) return {}; if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } } return req.body; }

async function handleTrack(req, res) {
  const b = await body(req);
  const sb = supabaseAdmin();
  const result = await trackAffiliateVisit(sb, { slug: normalizeAffiliateSlug(b.slug), visitorId: b.visitor_id, landingPage: b.landing_page || '/', referrer: req.headers?.referer || b.referrer || '', userAgent: req.headers?.['user-agent'] || '' });
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error });
  return res.status(200).json(result);
}

async function handleMe(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Faça login.' });
  const sb = supabaseAdmin();
  const { data: affiliate } = await sb.from('affiliates').select('*').eq('user_id', user.id).maybeSingle();
  if (!affiliate) return res.status(200).json({ affiliate: null, stats: null, commissions: [] });
  const [{ data: visits, count: visitCount }, { data: attributions }, { data: commissions }] = await Promise.all([
    sb.from('affiliate_visits').select('id,visitor_id,created_at,landing_page,referrer', { count: 'exact' }).eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(1000),
    sb.from('affiliate_attributions').select('visitor_id,converted,converted_at').eq('affiliate_id', affiliate.id),
    sb.from('affiliate_commissions').select('id,order_id,commission_base,commission_rate,commission_value,status,created_at,confirmed_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const rows = commissions || [];
  const confirmed = rows.filter((x) => x.status === 'confirmed').reduce((s, x) => s + Number(x.commission_value || 0), 0);
  const pending = rows.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.commission_value || 0), 0);
  const paid = rows.filter((x) => x.status === 'paid').reduce((s, x) => s + Number(x.commission_value || 0), 0);
  const unique = (attributions || []).length;
  const orders = rows.length;
  const revenue = rows.reduce((s, x) => s + Number(x.commission_base || 0), 0);
  return res.status(200).json({ affiliate, stats: { visits: Number(visitCount || 0), unique_visitors: unique, converted_visitors: (attributions || []).filter((x) => x.converted).length, orders, revenue, confirmed_commission: confirmed, pending_commission: pending, paid_commission: paid }, commissions: rows });
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:affiliate', limit: 60, windowMs: 60000 })) return;
  try {
    const action = String(req.query?.action || '').toLowerCase();
    if (action === 'track' && req.method === 'POST') return await handleTrack(req, res);
    if (action === 'me' && req.method === 'GET') return await handleMe(req, res);
    return res.status(404).json({ error: 'Ação inválida.' });
  } catch (e) { console.error('affiliate api', e); return res.status(500).json({ error: e?.message || String(e) }); }
}
