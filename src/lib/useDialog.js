import { useEffect, useRef } from 'react'
import { focusFirst, handleFocusTrapKeydown } from './a11y.js'

// Only the topmost dialog owns Escape and Tab; nested dialogs keep the body locked.
const dialogs = []
let originalOverflow = ''

function topDialog() {
  // React runs child effects before parent effects on the initial mount.
  // DOM nesting, rather than effect order, determines the innermost dialog.
  return dialogs.reduce((top, candidate) => {
    if (!top) return candidate
    const currentPanel = top.panelRef.current || top.panel
    const candidatePanel = candidate.panelRef.current || candidate.panel
    if (currentPanel?.contains(candidatePanel)) return candidate
    if (candidatePanel?.contains(currentPanel)) return top
    return candidate
  }, null)
}

export default function useDialog(open, onClose, { busy = false } = {}) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  closeRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const dialog = { panelRef, panel: panelRef.current }
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    dialogs.push(dialog)
    let active = true
    queueMicrotask(() => {
      if (active && topDialog() === dialog) focusFirst(panelRef.current)
    })
    const onKey = (event) => {
      if (topDialog() !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busyRef.current) closeRef.current?.()
      } else handleFocusTrapKeydown(event, panelRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      active = false
      window.removeEventListener('keydown', onKey)
      const wasTop = topDialog() === dialog
      dialogs.splice(dialogs.indexOf(dialog), 1)
      if (!dialogs.length) document.body.style.overflow = originalOverflow
      if (wasTop)
        queueMicrotask(() => {
          const remaining = topDialog()?.panelRef.current
          if (remaining && !remaining.contains(previousFocus))
            focusFirst(remaining)
          else if (previousFocus?.isConnected)
            previousFocus.focus?.({ preventScroll: true })
        })
    }
  }, [open])
  return panelRef
}
