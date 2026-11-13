/** Cotações SuperFrete: somente no servidor, sempre sobre caixas reais. */
const SMALL = { length: 13, width: 11, height: 10, weight: 0.3 };
const BIG_MINI = { length: 20, width: 20, height: 20, weight: 1 };
const FIGURES = {
  10: { length: 20, width: 20, height: 20, weight: 1 },
  12: { length: 20, width: 20, height: 20, weight: 1 },
  15: { length: 20, width: 20, height: 20, weight: 2 },
  20: { length: 30, width: 20, height: 20, weight: 2 },
};
const BUST = { length: 20, width: 20, height: 20, weight: 1 };
export const DEFAULT_SHIPPING = Object.freeze({
  origin_zip: '47803604', services: '1,2,17', mini_fee_cents: 500, other_fee_cents: 1000,
  enabled: true,
});

export const SHIPPING_PACKAGES = Object.freeze({
  miniature_small: SMALL, miniature_large: BIG_MINI,
  action_10: FIGURES[10], action_12: FIGURES[12], action_15: FIGURES[15], action_20: FIGURES[20],
  bust: BUST,
  vip_1: { length: 20, width: 20, height: 20, weight: 0.3 },
  vip_2_3: { length: 30, width: 20, height: 20, weight: 1 },
});

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100);
export const normalizeZip = value => String(value || '').replace(/\D/g, '');
export function vipLevel(plan) {
  const text = [plan?.name, plan?.short_name, plan?.slug, plan?.id].filter(Boolean).join(' ').toLowerCase();
  const match = text.match(/(?:n[ií]vel|level|plano|tier)[- _]*([123])\b|cubo[_ -]*l([123])\b|\bl([123])\b/);
  if (match) return Number(match[1] || match[2] || match[3]);
  const sorted = Number(plan?.sort_order);
  if ([1, 2, 3].includes(sorted)) return sorted;
  if ([0, 1, 2].includes(sorted) && text.includes('cubo')) return sorted + 1;
  throw new Error('O nível da assinatura não está identificado. Configure o nível do plano.');
}
export function packShipment({ type, items = [], kind = '', plan = null, settings = DEFAULT_SHIPPING }) {
  const boxes = { ...SHIPPING_PACKAGES, ...(settings.packages || {}) };
  if (type === 'custom') {
    if (!['busto', 'miniatura'].includes(kind)) throw new Error('Personalização inválida.');
    return { parcels: [{ ...(kind === 'busto' ? boxes.bust : boxes.miniature_small), category: kind === 'busto' ? 'busto' : 'miniatura' }], feeCategory: kind === 'busto' ? 'other' : 'other' };
  }
  if (type === 'vip') {
    const level = vipLevel(plan);
    return { parcels: [{ ...(level === 1 ? boxes.vip_1 : boxes.vip_2_3), category: `assinatura-${level}` }], feeCategory: 'other' };
  }
  if (type !== 'shop' || !Array.isArray(items) || !items.length) throw new Error('Produtos inválidos para o frete.');
  let miniCount = 0;
  const parcels = [];
  for (const item of items) {
    const qty = Number(item.qty);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100) throw new Error('Quantidade inválida para cotação.');
    const rawScale = String(item.scale || '').toLowerCase().replace(/\s+/g, '');
    const rawName = String(item.name || '').toLowerCase();
    const category = String(item.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const isMini = /32\s*mm/.test(`${item.scale || ''} ${rawName}`) || rawScale === '32mm' || /miniatura\s*(rpg|avulsa)/i.test(rawName)
      || ['rpg', 'miniatura rpg', 'miniaturas rpg', 'miniaturas'].includes(category);
    if (isMini) { miniCount += qty; continue; }
    const scaleMatch = rawScale.match(/^(10|12|15|20)(?:cm)?$/) || String(item.scale || '').match(/\b(10|12|15|20)\s*cm\b/i)
      || rawName.match(/\b(10|12|15|20)\s*cm\b/i);
    if (!scaleMatch) throw new Error(`Não foi possível identificar a escala de "${item.name || 'produto'}" para cotar o frete.`);
    const box = boxes[`action_${scaleMatch[1]}`];
    for (let i = 0; i < qty; i++) parcels.push({ ...box, category: `action-${scaleMatch[1]}` });
  }
  while (miniCount >= 10) { parcels.push({ ...boxes.miniature_large, category: 'miniaturas-3-10', quantity: 10 }); miniCount -= 10; }
  if (miniCount >= 3) parcels.push({ ...boxes.miniature_large, category: 'miniaturas-3-10', quantity: miniCount });
  else if (miniCount) parcels.push({ ...boxes.miniature_small, category: 'miniaturas-1-2', quantity: miniCount });
  if (parcels.length > 40) throw new Error('O pedido possui caixas demais para cotação automática. Entre em contato com a loja.');
  return { parcels, feeCategory: parcels.some(p => p.category.startsWith('action-')) ? 'other' : 'mini' };
}

export async function loadShippingSettings(sb) {
  const { data, error } = await sb.from('shipping_settings').select('*').eq('id', 'default').maybeSingle();
  if (error) throw new Error('Configure o frete: execute a migração SQL SuperFrete.');
  if (!data) throw new Error('Configuração de frete não encontrada.');
  return { ...DEFAULT_SHIPPING, ...data };
}

function extractPriceCents(raw) {
  if (typeof raw === 'number') return roundMoney(raw);
  const s = String(raw || '').replace(/R\$|\s/g, '');
  if (!s) return NaN;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return roundMoney(normalized);
}

async function quoteOneParcel({ settings, destination, parcel }) {
  const token = String(process.env.SUPERFRETE_TOKEN || '').trim();
  if (!token) throw new Error('O frete está indisponível: configure SUPERFRETE_TOKEN no servidor.');
  const userAgent = String(process.env.SUPERFRETE_USER_AGENT || '').trim();
  if (!userAgent) throw new Error('Configure SUPERFRETE_USER_AGENT no servidor, com o e-mail técnico da loja.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(`${String(process.env.SUPERFRETE_API_URL || 'https://api.superfrete.com').replace(/\/$/, '')}/api/v0/calculator`, {
      method: 'POST', signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: { postal_code: normalizeZip(settings.origin_zip) },
        to: { postal_code: destination }, services: String(settings.services || '1,2,17'),
        options: { own_hand: false, receipt: false, use_insurance_value: false },
        package: { height: parcel.height, width: parcel.width, length: parcel.length, weight: parcel.weight },
      }),
    });
  } catch { throw new Error('A SuperFrete não respondeu. Tente calcular novamente.'); }
  finally { clearTimeout(timer); }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload)) throw new Error('A SuperFrete não conseguiu calcular o frete agora.');
  const result = new Map();
  for (const row of payload) {
    const service = String(row?.id || '').trim();
    const priceCents = extractPriceCents(row?.price);
    if (!service || row?.has_error || !Number.isFinite(priceCents) || priceCents <= 0) continue;
    const days = Number(row.delivery_time);
    result.set(service, {
      service_id: service, service_name: String(row.name || `Serviço ${service}`),
      carrier: String(row.company?.name || 'SuperFrete'),
      price_cents: priceCents, delivery_days: Number.isFinite(days) && days >= 0 ? days : null,
    });
  }
  return result;
}

export async function getShippingQuote(sb, { destinationZip, type, items, kind, plan }) {
  const zip = normalizeZip(destinationZip);
  if (!/^\d{8}$/.test(zip)) throw new Error('Informe um CEP de entrega válido.');
  const settings = await loadShippingSettings(sb);
  if (settings.enabled === false) throw new Error('O frete está temporariamente indisponível.');
  if (!/^\d{8}$/.test(normalizeZip(settings.origin_zip))) throw new Error('CEP de origem do frete inválido.');
  const packing = packShipment({ type, items, kind, plan, settings });
  const unique = new Map();
  for (const p of packing.parcels) {
    const key = [p.length, p.width, p.height, p.weight].join('-');
    if (!unique.has(key)) unique.set(key, { parcel: p, count: 0 });
    unique.get(key).count++;
  }
  const quotations = await Promise.all([...unique.values()].map(async entry => ({
    ...entry, byService: await quoteOneParcel({ settings, destination: zip, parcel: entry.parcel }),
  })));
  const first = quotations[0]?.byService || new Map();
  const feeCents = packing.feeCategory === 'mini' ? Number(settings.mini_fee_cents) : Number(settings.other_fee_cents);
  const options = [];
  for (const [id, data] of first) {
    if (!quotations.every(q => q.byService.has(id))) continue;
    const baseCents = quotations.reduce((sum, q) => sum + q.byService.get(id).price_cents * q.count, 0);
    const deliveryDays = Math.max(...quotations.map(q => q.byService.get(id).delivery_days ?? 0));
    options.push({ ...data, base_cents: baseCents, fee_cents: feeCents,
      price_cents: baseCents + feeCents, delivery_days: deliveryDays, parcels_count: packing.parcels.length });
  }
  options.sort((a,b) => a.price_cents - b.price_cents);
  return { destination_zip: zip, origin_zip: normalizeZip(settings.origin_zip), parcels: packing.parcels, options };
}

export async function requireSelectedShipping(sb, { profile, serviceId, expectedShippingCents, type, items, kind, plan }) {
  const zip = normalizeZip(profile?.zip);
  if (!/^\d{8}$/.test(zip)) throw new Error('Complete o CEP no seu cadastro antes de pagar.');
  if (!String(serviceId || '').trim()) throw new Error('Calcule o frete e selecione uma modalidade antes de pagar.');
  const quote = await getShippingQuote(sb, { destinationZip: zip, type, items, kind, plan });
  const selected = quote.options.find(o => o.service_id === String(serviceId));
  if (!selected) throw new Error('A modalidade selecionada não está disponível para seu CEP e embalagem. Recalcule o frete.');
  if (!Number.isSafeInteger(Number(expectedShippingCents)) || Number(expectedShippingCents) !== selected.price_cents) throw new Error('O valor do frete mudou. Recalcule o frete e confirme o novo total antes de pagar.');
  return { ...quote, selected, total_cents: selected.price_cents };
}

export async function storeOrderShipping(sb, { orderId, userId, shipping }) {
  const { error } = await sb.from('order_shipping').insert({
    order_id: orderId, user_id: userId,
    origin_zip: shipping.origin_zip, destination_zip: shipping.destination_zip,
    carrier: shipping.selected.carrier, service_id: shipping.selected.service_id,
    service_name: shipping.selected.service_name, delivery_days: shipping.selected.delivery_days,
    base_cents: shipping.selected.base_cents, fee_cents: shipping.selected.fee_cents,
    total_cents: shipping.total_cents, parcels: shipping.parcels,
  });
  if (error) throw new Error('Falha ao registrar o frete no pedido. Verifique a migração SQL.');
}

export const shippingMpItem = shipping => ({
  id: 'frete', title: `Frete — ${shipping.selected.service_name} (${shipping.selected.carrier})`,
  quantity: 1, unit_price: shipping.total_cents / 100, currency_id: 'BRL',
});
