export async function copyText(value) {
  const text = String(value || '')
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* Some mobile browsers require the fallback below. */
  }
  if (typeof document.execCommand !== 'function') return false
  const previousFocus = document.activeElement
  const field = document.createElement('textarea')
  field.value = text
  field.style.cssText =
    'position:fixed;inset:0 auto auto -9999px;font-size:16px;'
  field.setAttribute('readonly', '')
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    field.remove()
    previousFocus?.focus?.({ preventScroll: true })
  }
}
