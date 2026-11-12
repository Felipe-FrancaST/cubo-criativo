import { supabaseAdmin, getUserFromAuthHeader } from '../server/supabase.js';
import { rateLimit } from '../server/rateLimit.js';
import { normalizeAffiliateSlug, trackAffiliateVisit } from '../server/affiliate.js';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}
function problem(res, code, message) { return res.status(code).json({ error: message }); }
function readableError(error, fallback) {
  const message = String(error?.message || '');
  if (/affiliate_(?:payout|withdrawal|dashboard)|withdrawal_id|deleted_at|column|function|relation/i.test(message)) {
    return 'Atualização do banco de vendedores pendente. Execute a migração SQL 20261112_affiliates_withdrawals.sql.';
  }
  return message && message.length < 180 ? message : fallback;
}
async function alertOwnerAboutWithdrawal(withdrawal) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || '').trim();
  const to = String(process.env.ORDER_EMAIL_TO || '').split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
  if (!apiKey || !from || !to.length) return;
  const amount = Number(withdrawal.amount || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', headers: { Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ from, to, subject:'Nova solicitação de saque - Cubo Criativo',
      text:`Um vendedor solicitou um saque de ${amount}.\nAcesse Administração > Vendedores para verificar e executar a transferência Pix.\nSolicitação: ${withdrawal.id}` }),
  });
  if (!response.ok) throw new Error(`Falha ao enviar aviso de saque (${response.status}).`);
}

function validatePayout(payload) {
  const pix_key = String(payload.pix_key || '').trim();
  const holder_name = String(payload.holder_name || '').trim().replace(/\s+/g, ' ');
  if (pix_key.length < 3 || pix_key.length > 140 || /[\x00-\x1f]/.test(pix_key)) throw new Error('Informe uma chave Pix válida.');
  if (holder_name.length < 3 || holder_name.length > 140 || /[\x00-\x1f]/.test(holder_name)) throw new Error('Informe o nome completo do titular.');
  return { pix_key, holder_name };
}

async function handleTrack(req, res) {
  const body = parseBody(req);
  const result = await trackAffiliateVisit(supabaseAdmin(), {
    slug: normalizeAffiliateSlug(body.slug), visitorId: body.visitor_id,
    landingPage: body.landing_page || '/', referrer: req.headers?.referer || '',
    userAgent: req.headers?.['user-agent'] || '',
  });
  return result.ok ? res.status(200).json(result) : problem(res, result.status || 404, result.error);
}

async function authenticatedAffiliate(req) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return { error: 'Faça login.', status: 401 };
  const sb = supabaseAdmin();
  const result = await sb.from('affiliates').select('*').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (result.error) throw result.error;
  return { user, sb, affiliate: result.data || null };
}

async function handleMe(req, res, context) {
  const { sb, affiliate } = context;
  if (!affiliate) return res.status(200).json({ affiliate: null, stats: null, commissions: [], coupons: [], withdrawals: [], payout_profile: null });
  const [statsResp, commissionsResp, couponsResp, requestsResp, payoutResp] = await Promise.all([
    sb.rpc('affiliate_dashboard_stats', { p_affiliate_id: affiliate.id }),
    sb.from('affiliate_commissions').select('id,order_id,commission_base,commission_rate,commission_value,status,created_at,confirmed_at,paid_at,withdrawal_id')
      .eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(200),
    sb.from('coupons').select('code,label,discount_type,discount_value,applies_to,active,max_uses,used_count,expires_at')
      .eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
    sb.from('affiliate_withdrawal_requests').select('id,amount,status,requested_at,paid_at,rejected_at,notes,holder_name,pix_key')
      .eq('affiliate_id', affiliate.id).order('requested_at', { ascending: false }).limit(100),
    sb.from('affiliate_payout_profiles').select('pix_key,holder_name,updated_at').eq('affiliate_id', affiliate.id).maybeSingle(),
  ]);
  for (const response of [statsResp, commissionsResp, couponsResp, requestsResp, payoutResp]) {
    if (response.error) throw response.error;
  }
  const stats = statsResp.data || {};
  const unique = Number(stats.unique_visitors || 0);
  const converted = Number(stats.converted_visitors || 0);
  return res.status(200).json({
    affiliate, stats: { ...stats, conversion_rate: unique ? Number((converted / unique * 100).toFixed(1)) : 0 },
    commissions: commissionsResp.data || [], coupons: couponsResp.data || [],
    withdrawals: requestsResp.data || [], payout_profile: payoutResp.data || null,
  });
}

async function handleSavePix(req, res, context) {
  if (!context.affiliate?.active) return problem(res, 403, 'Vendedor inativo.');
  let payout;
  try { payout = validatePayout(parseBody(req)); }
  catch (error) { return problem(res, 400, error.message); }
  const { data, error } = await context.sb.from('affiliate_payout_profiles')
    .upsert({ affiliate_id: context.affiliate.id, ...payout, updated_at: new Date().toISOString() }, { onConflict: 'affiliate_id' })
    .select('pix_key,holder_name,updated_at').single();
  if (error) throw error;
  return res.status(200).json({ ok: true, payout_profile: data });
}

async function handleWithdrawal(req, res, context) {
  if (!context.affiliate?.active) return problem(res, 403, 'Vendedor inativo.');
  const { data, error } = await context.sb.rpc('affiliate_request_withdrawal', { p_affiliate_id: context.affiliate.id });
  if (error) return problem(res, 409, readableError(error, 'Não foi possível solicitar o saque.'));
  // Alerta no painel é persistente; o e-mail adicional é enviado quando configurado.
  try { await alertOwnerAboutWithdrawal(data); }
  catch (error) { console.error('affiliate withdrawal owner email', error); }
  return res.status(201).json({ ok: true, withdrawal: data });
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:affiliate', limit: 45, windowMs: 60000 })) return;
  try {
    const action = String(req.query?.action || '').toLowerCase();
    if (action === 'track' && req.method === 'POST') return await handleTrack(req, res);
    if (!['me', 'save-pix', 'request-withdrawal'].includes(action)) return problem(res, 404, 'Ação inválida.');
    const context = await authenticatedAffiliate(req);
    if (context.error) return problem(res, context.status, context.error);
    if (action === 'me' && req.method === 'GET') return await handleMe(req, res, context);
    if (action === 'save-pix' && req.method === 'POST') return await handleSavePix(req, res, context);
    if (action === 'request-withdrawal' && req.method === 'POST') return await handleWithdrawal(req, res, context);
    return problem(res, 405, 'Método não permitido.');
  } catch (error) {
    console.error('affiliate api', error);
    return problem(res, 500, readableError(error, 'Erro ao consultar o painel do vendedor.'));
  }
}
