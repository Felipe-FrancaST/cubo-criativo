import { useEffect } from 'react'

// Keep fixed panels above the software keyboard without disabling browser zoom.
export default function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    const update = () => {
      if (viewport && viewport.scale !== 1) return
      const height = viewport?.height || window.innerHeight
      const inset = Math.max(
        0,
        window.innerHeight - height - (viewport?.offsetTop || 0)
      )
      root.style.setProperty('--visible-viewport-height', `${height}px`)
      root.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    update()
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      root.style.removeProperty('--visible-viewport-height')
      root.style.removeProperty('--keyboard-inset')
    }
  }, [])
}
