// Wait for lazy routes and images; stop immediately when the customer starts scrolling.
export function restoreProductScroll(state, { timeoutMs = 8000 } = {}) {
  let stopped = false
  let frame = 0
  const started = performance.now()
  const stop = () => {
    stopped = true
    cancelAnimationFrame(frame)
    for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      window.removeEventListener(name, stop)
  }
  const tick = () => {
    if (stopped) return
    const elements = state.productId
      ? document.querySelectorAll('[data-product-id]')
      : []
    const matches = Array.from(elements).filter(
      (el) => el.dataset.productId === String(state.productId)
    )
    const anchor = matches[state.productOccurrence || 0] || matches[0]
    const top =
      anchor && Number.isFinite(state.anchorOffset)
        ? window.scrollY +
          anchor.getBoundingClientRect().top -
          state.anchorOffset
        : Number(state.scrollY) || 0
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' })
    if (performance.now() - started < timeoutMs)
      frame = requestAnimationFrame(tick)
    else stop()
  }
  for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
    window.addEventListener(name, stop, { passive: true })
  frame = requestAnimationFrame(tick)
  return stop
}
