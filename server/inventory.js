function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

async function readProductStock(sb, productId) {
  const { data, error } = await sb.from('products').select('id,stock').eq('id', productId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function compareAndSetStock(sb, productId, expectedStock, nextStock) {
  const { data, error } = await sb
    .from('products')
    .update({ stock: nextStock })
    .eq('id', productId)
    .eq('stock', expectedStock)
    .select('id,stock')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function decrementStockAtomically(sb, productId, qty, maxAttempts = 5) {
  const needed = toPositiveInt(qty);
  if (!productId || needed <= 0) return { ok: true, skipped: true };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const row = await readProductStock(sb, productId);
    if (!row || row.stock === null || row.stock === undefined) return { ok: true, unmanaged: true };

    const current = toPositiveInt(row.stock);
    if (current < needed) {
      return { ok: false, code: 'out_of_stock', current, needed };
    }

    const updated = await compareAndSetStock(sb, productId, current, current - needed);
    if (updated?.id) return { ok: true, previous: current, current: current - needed };
  }

  return { ok: false, code: 'concurrency_conflict' };
}

export async function incrementStockAtomically(sb, productId, qty, maxAttempts = 5) {
  const amount = toPositiveInt(qty);
  if (!productId || amount <= 0) return { ok: true, skipped: true };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const row = await readProductStock(sb, productId);
    if (!row || row.stock === null || row.stock === undefined) return { ok: true, unmanaged: true };

    const current = toPositiveInt(row.stock);
    const updated = await compareAndSetStock(sb, productId, current, current + amount);
    if (updated?.id) return { ok: true, previous: current, current: current + amount };
  }

  return { ok: false, code: 'concurrency_conflict' };
}

export async function applyStockDeductionWithClaim(sb, order) {
  if (!order?.id) return { ok: false, skipped: true, reason: 'missing_order' };
  const orderType = String(order.order_type || '').trim().toLowerCase();
  if (orderType === 'vip' || orderType === 'vip_upgrade') return { ok: true, skipped: true, reason: 'non_stock_order' };

  const claimTs = new Date().toISOString();
  const claim = await sb
    .from('orders')
    .update({ stock_deducted_at: claimTs })
    .eq('id', order.id)
    .is('stock_deducted_at', null)
    .select('id')
    .maybeSingle();

  if (claim.error) throw claim.error;
  if (!claim.data?.id) return { ok: true, skipped: true, reason: 'already_claimed' };

  const itemsResp = await sb.from('order_items').select('product_id,qty').eq('order_id', order.id);
  if (itemsResp.error) {
    await sb.from('orders').update({ stock_deducted_at: null }).eq('id', order.id).eq('stock_deducted_at', claimTs);
    throw itemsResp.error;
  }

  const byProduct = new Map();
  for (const item of itemsResp.data || []) {
    const productId = String(item?.product_id || '').trim();
    const qty = toPositiveInt(item?.qty);
    if (!productId || qty <= 0) continue;
    byProduct.set(productId, (byProduct.get(productId) || 0) + qty);
  }

  const deducted = [];
  try {
    for (const [productId, qty] of byProduct.entries()) {
      const result = await decrementStockAtomically(sb, productId, qty);
      if (!result.ok) throw new Error(`stock_${result.code || 'deduction_failed'}:${productId}`);
      if (!result.unmanaged) deducted.push([productId, qty]);
    }
    return { ok: true, deducted: deducted.length };
  } catch (error) {
    for (const [productId, qty] of deducted.reverse()) {
      try {
        await incrementStockAtomically(sb, productId, qty);
      } catch (restoreError) {
        console.error('stock restore error', restoreError);
      }
    }
    await sb.from('orders').update({ stock_deducted_at: null }).eq('id', order.id).eq('stock_deducted_at', claimTs);
    throw error;
  }
}
