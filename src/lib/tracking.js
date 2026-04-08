export const TRACKING_CARRIERS = [
  { value: 'correios', label: 'Correios' },
  { value: 'jadlog', label: 'Jadlog' },
  { value: 'loggi', label: 'Loggi' },
];

export function normalizeTrackingCarrier(value) {
  const v = String(value || '').trim().toLowerCase();
  return TRACKING_CARRIERS.some((item) => item.value === v) ? v : 'correios';
}

export function trackingCarrierLabel(value) {
  const normalized = normalizeTrackingCarrier(value);
  return TRACKING_CARRIERS.find((item) => item.value === normalized)?.label || 'Correios';
}

export function inferTrackingCarrierFromUrl(url) {
  const v = String(url || '').trim().toLowerCase();
  if (v.includes('jadlog')) return 'jadlog';
  if (v.includes('loggi')) return 'loggi';
  if (v.includes('correios')) return 'correios';
  return 'correios';
}

export function resolveTrackingCarrier({ carrier, trackingUrl } = {}) {
  const explicit = String(carrier || '').trim().toLowerCase();
  if (TRACKING_CARRIERS.some((item) => item.value === explicit)) return explicit;
  return inferTrackingCarrierFromUrl(trackingUrl);
}

export function buildTrackingUrl({ code, carrier, fallbackUrl } = {}) {
  const explicit = String(fallbackUrl || '').trim();
  if (explicit) return explicit;

  const normalizedCarrier = normalizeTrackingCarrier(carrier);
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return '';

  if (normalizedCarrier === 'jadlog') return 'https://www.jadlog.com.br/siteInstitucional/tracking.jad';
  if (normalizedCarrier === 'loggi') return 'https://www.loggi.com/rastreador/';
  return 'https://rastreamento.correios.com.br/';
}
