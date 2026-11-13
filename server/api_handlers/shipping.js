import { getUserFromAuthHeader, supabaseAdmin } from '../supabase.js';
import { requireAdmin, ADMIN_LEVEL } from '../admin/adminAuth.js';
import { rateLimit } from '../rateLimit.js';
import { getShippingQuote, loadShippingSettings, normalizeZip, SHIPPING_PACKAGES } from '../shipping.js';
import { resolveStoreItems } from '../orderPricing.js';
import { getVipPlanById } from '../vipPlans.js';

function requestBody(req) { if (typeof req.body === 'object' && req.body) return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
export default async function handleShipping(req, res) {
  if (!rateLimit(req, res, { key: 'shipping:quote', limit: 20, windowMs: 60000 })) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Entre na sua conta para calcular o frete.' });
    const sb = supabaseAdmin();
    const operation = String(req.query?.op || '').toLowerCase();
    if (operation === 'order' && req.method === 'GET') {
      const orderId = String(req.query?.order_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return res.status(400).json({ error: 'Pedido inválido.' });
      const { data: order, error: orderError } = await sb.from('orders').select('id,user_id').eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
      if (order.user_id !== user.id) {
        const admin = await requireAdmin(req, ADMIN_LEVEL.OPERATOR);
        if (!admin.ok) return res.status(admin.status).json({ error: admin.error });
      }
      const { data: shipping, error } = await sb.from('order_shipping').select('*').eq('order_id', orderId).maybeSingle();
      if (error) throw error;
      return res.status(200).json({ shipping: shipping || null });
    }
    if (operation === 'config') {
      const admin = await requireAdmin(req, ADMIN_LEVEL.MANAGER);
      if (!admin.ok) return res.status(admin.status).json({ error: admin.error });
      if (req.method === 'GET') return res.json({ settings: await loadShippingSettings(sb) });
      const body = requestBody(req);
      const payload = {};
      for (const key of ['mini_fee_cents','other_fee_cents']) {
        if (body[key] !== undefined) {
          if (!Number.isSafeInteger(Number(body[key])) || Number(body[key]) < 0 || Number(body[key]) > 100000) throw new Error('Taxa de frete inválida.');
          payload[key] = Number(body[key]);
        }
      }
      if (body.origin_zip !== undefined) {
        if (!/^\d{8}$/.test(normalizeZip(body.origin_zip))) throw new Error('CEP de origem inválido.');
        payload.origin_zip = normalizeZip(body.origin_zip);
      }
      if (body.enabled !== undefined) payload.enabled = body.enabled === true;
      if (body.packages !== undefined) {
        if (!body.packages || typeof body.packages !== 'object' || Array.isArray(body.packages)) throw new Error('Caixas inválidas.');
        const savedPackages = {};
        for (const [key, value] of Object.entries(body.packages)) {
          if (!(key in SHIPPING_PACKAGES)) throw new Error('Categoria de caixa desconhecida.');
          const box = {};
          for (const prop of ['length', 'width', 'height', 'weight']) {
            const n = Number(value?.[prop]);
            if (!Number.isFinite(n) || n <= 0 || n > (prop === 'weight' ? 30 : 100)) throw new Error(`Medida inválida para ${key}.`);
            box[prop] = n;
          }
          savedPackages[key] = box;
        }
        payload.packages = savedPackages;
      }
      if (body.services !== undefined) {
        if (!/^\d+(,\d+)*$/.test(String(body.services))) throw new Error('Lista de serviços inválida.');
        payload.services = String(body.services);
      }
      const { error } = await sb.from('shipping_settings').update(payload).eq('id', 'default');
      if (error) throw error;
      return res.json({ settings: await loadShippingSettings(sb) });
    }
    if (req.method !== 'POST' || operation !== 'quote') return res.status(404).json({ error: 'Operação inválida.' });
    const body = requestBody(req);
    const { data: profile, error: profileError } = await sb.from('profiles').select('zip').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const zip = normalizeZip(profile?.zip);
    if (!/^\d{8}$/.test(zip)) return res.status(400).json({ code: 'profile_incomplete', error: 'Complete seu CEP no cadastro para calcular o frete.' });
    let type = String(body.type || 'shop'); let items = []; let kind = ''; let plan = null;
    if (type === 'shop') {
      const resolved = await resolveStoreItems(sb, body.items || []);
      if (!resolved.ok) return res.status(resolved.status || 400).json({ error: resolved.error });
      items = resolved.items;
    } else if (type === 'vip') {
      plan = await getVipPlanById(sb, body.vip_plan_id);
      if (!plan || plan.active === false) return res.status(400).json({ error: 'Plano indisponível.' });
    } else if (type === 'custom') {
      kind = String(body.kind || '');
    } else return res.status(400).json({ error: 'Tipo de envio inválido.' });
    const shipping = await getShippingQuote(sb, { destinationZip: zip, type, items, plan, kind });
    return res.status(200).json({ ...shipping, parcel_count: shipping.parcels.length });
  } catch (e) { return res.status(422).json({ error: e?.message || 'Não foi possível calcular o frete.' }); }
}
