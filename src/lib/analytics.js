export function trackEvent(name, props = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.va === 'function') {
      window.va('event', { name, ...props });
      return;
    }
    // fallback para debug local
    if (import.meta?.env?.DEV) console.debug('[analytics]', name, props);
  } catch {}
}
