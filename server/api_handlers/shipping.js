import { getUserFromAuthHeader, supabaseAdmin } from '../supabase.js';
import { requireAdmin, ADMIN_LEVEL } from '../admin/adminAuth.js';
import { rateLimit } from '../rateLimit.js';
import { getShippingQuote, loadShippingSettings, normalizeZip, SHIPPING_PACKAGES } from '../shipping.js';
import { validateScaleRules } from '../shippingScaleRules.js';
import { resolveStoreItems } from '../orderPricing.js';
import { getVipPlanById } from '../vipPlans.js';
import { validateShippingQuoteRequest } from '../shippingQuoteRequest.js';

function requestBody(req) { if (typeof req.body === 'object' && req.body) return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
export default async function handleShipping(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const operation = String(req.query?.op || '').toLowerCase();
    const hasAuthHeader = /^Bearer\s+\S+/i.test(String(req.headers?.authorization || req.headers?.Authorization || ''));
    // Consultar frete é público, mas consultar pedidos e alterar configurações exige login.
    const user = hasAuthHeader ? await getUserFromAuthHeader(req) : null;
    if (hasAuthHeader && !user) return res.status(401).json({ error: 'Sessão inválida. Entre na sua conta novamente.' });
    if (operation !== 'quote' && !user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
    const sb = supabaseAdmin();
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
      if (body.packages !== undefined || body.scale_rules !== undefined || body.package_labels !== undefined) {
        const existing = await loadShippingSettings(sb);
        const provided = body.packages ?? existing.packages ?? {};
        if (!provided || typeof provided !== 'object' || Array.isArray(provided) || Object.keys(provided).length > 80) throw new Error('Caixas inválidas (máximo de 80).');
        const savedPackages = {};
        for (const [key, value] of Object.entries(provided)) {
          if (!Object.hasOwn(SHIPPING_PACKAGES, key) && !/^box_[a-z0-9_]{5,55}$/.test(key)) throw new Error('Identificador de caixa inválido.');
          const box = {};
          for (const prop of ['length', 'width', 'height', 'weight']) {
            const n = Number(value?.[prop]);
            if (!Number.isFinite(n) || n <= 0 || n > (prop === 'weight' ? 30 : 100)) throw new Error(`Medida inválida para ${key}.`);
            box[prop] = n;
          }
          savedPackages[key] = box;
        }
        // As caixas padrão continuam disponíveis mesmo se ainda não tiverem sido gravadas no JSON.
        const allBoxes = { ...SHIPPING_PACKAGES, ...savedPackages };
        const rules = validateScaleRules(body.scale_rules ?? existing.scale_rules, allBoxes);
        const rawLabels = body.package_labels ?? existing.package_labels ?? {};
        if (!rawLabels || typeof rawLabels !== 'object' || Array.isArray(rawLabels)) throw new Error('Nomes das caixas inválidos.');
        const labels = {};
        for (const [key, value] of Object.entries(rawLabels)) {
          if (!(key in allBoxes)) throw new Error('Há um nome associado a uma caixa inexistente.');
          const label = String(value || '').trim();
          if (label.length > 80) throw new Error('O nome da caixa deve ter no máximo 80 caracteres.');
          if (label) labels[key] = label;
        }
        payload.packages = savedPackages;
        payload.scale_rules = rules;
        payload.package_labels = labels;
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
    // Evita abuso de credenciais SuperFrete pela rota pública. Não consome o limite
    // em renderizações ou edições do carrinho: o frontend só chama após o clique.
    if (!rateLimit(req, res, { key: user ? 'shipping:quote:logged' : 'shipping:quote:guest', limit: user ? 20 : 10, windowMs: 60000 })) return;
    const body = requestBody(req);
    const type = String(body.type || 'shop');
    const checked = validateShippingQuoteRequest({
      type, authenticated: Boolean(user), destinationZip: body.destination_zip, items: body.items,
    });
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
    const providedZip = checked.destinationZip;
    let zip = providedZip;
    if (!zip && user) {
      const { data: profile, error: profileError } = await sb.from('profiles').select('zip').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      zip = normalizeZip(profile?.zip);
    }
    if (!/^\d{8}$/.test(zip)) return res.status(400).json({ code: user ? 'profile_incomplete' : 'zip_required', error: 'Informe o CEP de entrega para calcular o frete.' });
    let items = []; let kind = ''; let plan = null;
    if (type === 'shop') {
      // Consulta os produtos do banco: preço, categoria e escala enviados pelo
      // navegador nunca definem o tamanho da embalagem nem autorizam a compra.
      const resolved = await resolveStoreItems(sb, body.items);
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
