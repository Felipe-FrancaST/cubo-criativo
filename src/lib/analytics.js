import {
  safeAnalyticsProps,
  sanitizeAnalyticsEvent,
} from './analyticsPrivacy.js'
export function trackEvent(name, props = {}) {
  try {
    if (typeof window === 'undefined') return
    if (!sanitizeAnalyticsEvent({ type: 'event', url: window.location.href }))
      return
    if (typeof window.va === 'function') {
      window.va('event', { name, data: safeAnalyticsProps(props) })
    }
  } catch {
    /* Metrics must never block customer actions. */
  }
}
