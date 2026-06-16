const ORDER_3D_BUCKET = 'order-3d-models';

function extractStoragePathFromPublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Accept a raw object path too, in case an older deployment saved only the path.
  if (!/^https?:\/\//i.test(raw)) {
    const cleaned = raw.replace(/^\/+/, '');
    if (cleaned.startsWith(`${ORDER_3D_BUCKET}/`)) return cleaned.slice(ORDER_3D_BUCKET.length + 1);
    return cleaned;
  }

  try {
    const url = new URL(raw);
    const marker = `/storage/v1/object/public/${ORDER_3D_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }

    const altMarker = `/storage/v1/object/sign/${ORDER_3D_BUCKET}/`;
    const altIdx = url.pathname.indexOf(altMarker);
    if (altIdx >= 0) {
      return decodeURIComponent(url.pathname.slice(altIdx + altMarker.length));
    }
  } catch {
    // fall through
  }
  return '';
}

export async function cleanupOrder3dModel(sb, orderOrId) {
  if (!sb) return { ok: false, skipped: true, error: 'Missing Supabase client' };

  let order = null;
  if (orderOrId && typeof orderOrId === 'object') {
    order = orderOrId;
  } else {
    const orderId = String(orderOrId || '').trim();
    if (!orderId) return { ok: false, skipped: true, error: 'Missing order_id' };
    const { data, error } = await sb
      .from('orders')
      .select('id,model_3d_url,model_3d_name')
      .eq('id', orderId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message || 'Failed to load order 3D model' };
    order = data || null;
  }

  const orderId = String(order?.id || '').trim();
  const modelUrl = String(order?.model_3d_url || '').trim();
  if (!orderId || !modelUrl) return { ok: true, skipped: true };

  const objectPath = extractStoragePathFromPublicUrl(modelUrl);
  if (!objectPath) {
    await sb.from('orders').update({ model_3d_url: null, model_3d_name: null }).eq('id', orderId);
    return { ok: true, skippedStorage: true, cleared: true };
  }

  const removeResp = await sb.storage.from(ORDER_3D_BUCKET).remove([objectPath]);
  if (removeResp?.error) {
    console.error('order 3d model cleanup error', removeResp.error);
    return { ok: false, error: removeResp.error.message || 'Failed to remove 3D model from storage' };
  }

  await sb.from('orders').update({ model_3d_url: null, model_3d_name: null }).eq('id', orderId);
  return { ok: true, removed: objectPath };
}

export function shouldCleanupOrder3dForStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return ['paid', 'cancelled', 'canceled', 'cancelado', 'failed', 'refunded', 'reembolsado'].includes(s);
}
