const STATUS_WITH_ETA_NOTICE = new Set(['em_producao', 'pronto']);

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function clean(value) {
  return String(value || '').trim();
}

/**
 * Decide whether an order update deserves a customer email.
 * Priority: status change > tracking update > production estimate update.
 */
export function decideOrderEmailNotification({ currentOrder = {}, patch = {}, productionEta } = {}) {
  const currentStatus = norm(currentOrder.production_status || 'recebido');
  const hasStatusPatch = Object.prototype.hasOwnProperty.call(patch || {}, 'production_status');
  const nextStatus = hasStatusPatch ? norm(patch.production_status) : currentStatus;
  const statusChanged = hasStatusPatch && Boolean(nextStatus) && nextStatus !== currentStatus;

  const currentTracking = clean(currentOrder.shipping_tracking || currentOrder.tracking_code);
  const hasTrackingPatch =
    Object.prototype.hasOwnProperty.call(patch || {}, 'shipping_tracking') ||
    Object.prototype.hasOwnProperty.call(patch || {}, 'tracking_code');
  const nextTracking = hasTrackingPatch
    ? clean(patch.shipping_tracking ?? patch.tracking_code)
    : currentTracking;
  const trackingChanged = hasTrackingPatch && nextTracking !== currentTracking;
  const currentCarrier = norm(currentOrder.shipping_carrier);
  const hasCarrierPatch = Object.prototype.hasOwnProperty.call(patch || {}, 'shipping_carrier');
  const nextCarrier = hasCarrierPatch ? norm(patch.shipping_carrier) : currentCarrier;
  const carrierChanged = hasCarrierPatch && nextCarrier !== currentCarrier;

  const currentEta = clean(currentOrder.production_eta);
  const hasEtaPatch = productionEta !== undefined || Object.prototype.hasOwnProperty.call(patch || {}, 'production_eta');
  const nextEta = hasEtaPatch ? clean(productionEta ?? patch.production_eta) : currentEta;
  const etaChanged = hasEtaPatch && nextEta !== currentEta;

  if (statusChanged) {
    return {
      shouldSend: true,
      kind: 'status',
      status: nextStatus,
      statusChanged,
      trackingChanged,
      carrierChanged,
      etaChanged,
    };
  }

  if ((trackingChanged || carrierChanged) && nextTracking && nextStatus === 'enviado') {
    return {
      shouldSend: true,
      kind: 'tracking',
      status: nextStatus,
      statusChanged,
      trackingChanged,
      carrierChanged,
      etaChanged,
    };
  }

  if (etaChanged && nextEta && STATUS_WITH_ETA_NOTICE.has(nextStatus)) {
    return {
      shouldSend: true,
      kind: 'eta',
      status: nextStatus,
      statusChanged,
      trackingChanged,
      carrierChanged,
      etaChanged,
    };
  }

  return {
    shouldSend: false,
    kind: null,
    status: nextStatus || currentStatus,
    statusChanged,
    trackingChanged,
    carrierChanged,
    etaChanged,
  };
}
