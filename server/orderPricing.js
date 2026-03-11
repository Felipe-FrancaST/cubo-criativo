function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function toMoneyBRLFromCents(value) {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeScale(scale) {
  return String(scale || '').trim();
}

function firstImageForProduct(row) {
  const imageUrl = String(row?.image_url || '').trim();
  if (imageUrl) return imageUrl;
  if (Array.isArray(row?.images)) {
    const first = row.images.map((v) => String(v || '').trim()).find(Boolean);
    if (first) return first;
  }
  return '';
}

function resolveVariant(row, requestedScale = '') {
  const variants = Array.isArray(row?.variants)
    ? row.variants
        .filter(Boolean)
        .map((variant) => ({
          label: String(variant?.label || '').trim(),
          price: toMoneyBRLFromCents(variant?.price_cents),
        }))
        .filter((variant) => variant.label && variant.price > 0)
    : [];

  const requestedNorm = normalizeText(requestedScale);
  if (requestedNorm) {
    const exact = variants.find((variant) => normalizeText(variant.label) === requestedNorm);
    if (!exact) {
      return {
        ok: false,
        error: `Escala inválida para ${String(row?.name || 'o produto')}.`,
        code: 'invalid_variant',
      };
    }
    return { ok: true, scale: exact.label, price: exact.price };
  }

  const defaultNorm = normalizeText(row?.default_variant);
  const preferred = (defaultNorm && variants.find((variant) => normalizeText(variant.label) === defaultNorm)) || variants[0];
  if (preferred) return { ok: true, scale: preferred.label, price: preferred.price };

  const basePrice = toMoneyBRLFromCents(row?.price_cents);
  if (basePrice > 0) return { ok: true, scale: '', price: basePrice };

  return {
    ok: false,
    error: `Preço inválido para ${String(row?.name || 'o produto')}.`,
    code: 'invalid_price',
  };
}

export function serializeResolvedItems(items = []) {
  return JSON.stringify(
    items.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      qty: item.qty,
      unit_price: item.unit_price,
      scale: item.scale || '',
    }))
  ).slice(0, 4500);
}

export async function resolveStoreItems(sb, rawItems = []) {
  const requested = Array.isArray(rawItems) ? rawItems : [];
  if (!requested.length) {
    return { ok: false, status: 400, error: 'Carrinho vazio.' };
  }

  const normalizedItems = requested.map((item) => ({
    product_id: String(item?.id || item?.product_id || '').trim(),
    qty: toPositiveInt(item?.qty),
    requestedScale: normalizeScale(item?.scale || item?.escala || ''),
  }));

  if (normalizedItems.some((item) => !item.product_id || item.qty <= 0)) {
    return { ok: false, status: 400, error: 'Carrinho inválido.' };
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.product_id))];
  const { data: rows, error } = await sb
    .from('products')
    .select('id,name,price_cents,stock,active,image_url,images,variants,default_variant')
    .in('id', productIds);

  if (error) {
    console.error('resolveStoreItems products error', error);
    return { ok: false, status: 500, error: 'Não foi possível validar os produtos.' };
  }

  const byId = new Map((rows || []).map((row) => [String(row.id), row]));
  const aggregatedQty = new Map();
  for (const item of normalizedItems) {
    aggregatedQty.set(item.product_id, (aggregatedQty.get(item.product_id) || 0) + item.qty);
  }

  const resolvedItems = [];
  let subtotal = 0;

  for (const item of normalizedItems) {
    const row = byId.get(item.product_id);
    if (!row) {
      return { ok: false, status: 400, error: 'Um ou mais produtos não foram encontrados.' };
    }
    if (row.active === false) {
      return { ok: false, status: 400, error: `${String(row.name || 'Produto')} não está disponível.` };
    }

    const totalRequestedQty = aggregatedQty.get(item.product_id) || 0;
    if (row.stock !== null && row.stock !== undefined) {
      const stock = toPositiveInt(row.stock);
      if (stock < totalRequestedQty) {
        return {
          ok: false,
          status: 409,
          error: `${String(row.name || 'Produto')} está sem estoque suficiente.`,
          code: 'out_of_stock',
        };
      }
    }

    const variant = resolveVariant(row, item.requestedScale);
    if (!variant.ok) {
      return { ok: false, status: 400, error: variant.error, code: variant.code };
    }

    const unitPrice = Number(Number(variant.price).toFixed(2));
    if (!(unitPrice > 0)) {
      return { ok: false, status: 400, error: `Preço inválido para ${String(row.name || 'o produto')}.` };
    }

    subtotal += item.qty * unitPrice;
    resolvedItems.push({
      product_id: String(row.id),
      name: String(row.name || 'Item').trim(),
      qty: item.qty,
      scale: variant.scale || '',
      unit_price: unitPrice,
      img: firstImageForProduct(row),
    });
  }

  return {
    ok: true,
    subtotal: Number(subtotal.toFixed(2)),
    items: resolvedItems,
  };
}

export function buildVipOrderItems(vipPlan) {
  const planId = String(vipPlan?.id || '').trim();
  const name = String(vipPlan?.name || vipPlan?.short_name || 'VIP').trim();
  const unitPrice = Number(Number(vipPlan?.price_brl || 0).toFixed(2));
  return [{
    product_id: planId,
    name: `${name} (mensalidade)`,
    qty: 1,
    scale: String(vipPlan?.scale || '32mm').trim(),
    unit_price: unitPrice,
    img: '',
  }];
}

export function buildVipUpgradeOrderItems({ currentPlan, toPlan, diff }) {
  return [{
    product_id: 'VIP_UPGRADE',
    name: `Upgrade VIP ${String(currentPlan?.short_name || currentPlan?.name || 'VIP')} → ${String(toPlan?.short_name || toPlan?.name || 'VIP')}`,
    qty: 1,
    scale: '',
    unit_price: Number(Number(diff || 0).toFixed(2)),
    img: '',
  }];
}

export function buildMercadoPagoItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.product_id,
    title: String(item.name || 'Item').slice(0, 120),
    quantity: toPositiveInt(item.qty) || 1,
    unit_price: Number(Number(item.unit_price || 0).toFixed(2)),
    currency_id: 'BRL',
    picture_url: item.img ? String(item.img) : undefined,
  })).filter((item) => item.quantity > 0 && item.unit_price > 0);
}

export function buildOrderItemsForInsert(orderId, items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    order_id: orderId,
    product_id: String(item.product_id || '').trim() || null,
    name: String(item.name || 'Item').trim(),
    scale: String(item.scale || '').trim() || null,
    qty: toPositiveInt(item.qty) || 1,
    unit_price: Number(Number(item.unit_price || 0).toFixed(2)),
    img: String(item.img || '').trim() || null,
  })).filter((item) => item.qty > 0 && item.unit_price > 0 && item.product_id);
}
