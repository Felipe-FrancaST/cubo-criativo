import * as React from 'react'
import { createPortal } from 'react-dom'
import './gallery-lightbox.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

/**
 * Visualizador de fotos independente do modal padrão (que vira bottom sheet no celular).
 * Centralizado em qualquer viewport, com zoom por botões, roda do mouse e gesto de pinça.
 */
export default function GalleryLightbox({ title = 'Fotos do produto', images = [], initialIndex = 0, onClose }) {
  const photos = React.useMemo(() => [...new Set(images.filter(Boolean))], [images])
  const [index, setIndex] = React.useState(clamp(initialIndex, 0, Math.max(photos.length - 1, 0)))
  const [zoom, setZoom] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [loading, setLoading] = React.useState(true)
  const [imageError, setImageError] = React.useState(false)
  const closeRef = React.useRef(null)
  const stageRef = React.useRef(null)
  const currentPointers = React.useRef(new Map())
  const gesture = React.useRef({ startX: 0, startY: 0, pinchDistance: null, pinchZoom: 1, pinched: false })
  const activeImage = photos[index]
  const imageCount = photos.length

  const changeImage = React.useCallback((delta) => {
    if (imageCount < 2) return
    setIndex((current) => (current + delta + imageCount) % imageCount)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [imageCount])

  React.useEffect(() => {
    const lastFocused = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (lastFocused?.isConnected && typeof lastFocused.focus === 'function') lastFocused.focus()
    }
  }, [])

  React.useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.() }
      if (event.key === 'ArrowRight') { event.preventDefault(); changeImage(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); changeImage(-1) }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom((v) => clamp(v + 0.5, MIN_ZOOM, MAX_ZOOM)) }
      if (event.key === '-') { event.preventDefault(); setZoom((v) => clamp(v - 0.5, MIN_ZOOM, MAX_ZOOM)) }
      if (event.key === '0') { event.preventDefault(); setZoom(1); setOffset({ x: 0, y: 0 }) }
      if (event.key === 'Tab') {
        const focusable = Array.from(document.querySelectorAll('.cc-gallery-lightbox button:not(:disabled)'))
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [changeImage, onClose])

  React.useEffect(() => {
    setLoading(true)
    setImageError(false)
    currentPointers.current.clear()
    gesture.current.pinchDistance = null
  }, [activeImage])

  React.useEffect(() => {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    const maxX = Math.max(0, bounds.width * (zoom - 1) / 2)
    const maxY = Math.max(0, bounds.height * (zoom - 1) / 2)
    setOffset((pos) => {
      const next = { x: clamp(pos.x, -maxX, maxX), y: clamp(pos.y, -maxY, maxY) }
      return next.x === pos.x && next.y === pos.y ? pos : next
    })
  }, [zoom])

  function updateZoom(delta) { setZoom((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM)) }
  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    currentPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (currentPointers.current.size === 1) {
      gesture.current = { startX: event.clientX, startY: event.clientY, pinchDistance: null, pinchZoom: zoom, pinched: false }
    }
    if (currentPointers.current.size === 2) {
      const [a, b] = [...currentPointers.current.values()]
      gesture.current.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.pinchZoom = zoom
      gesture.current.pinched = true
    }
  }
  function onPointerMove(event) {
    const previous = currentPointers.current.get(event.pointerId)
    if (!previous) return
    currentPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (currentPointers.current.size >= 2) {
      const [a, b] = [...currentPointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.pinchDistance) setZoom(clamp(gesture.current.pinchZoom * distance / gesture.current.pinchDistance, MIN_ZOOM, MAX_ZOOM))
    } else if (zoom > 1) {
      const bounds = stageRef.current?.getBoundingClientRect()
      const limitX = bounds ? bounds.width * (zoom - 1) / 2 : 0
      const limitY = bounds ? bounds.height * (zoom - 1) / 2 : 0
      setOffset((pos) => ({
        x: clamp(pos.x + event.clientX - previous.x, -limitX, limitX),
        y: clamp(pos.y + event.clientY - previous.y, -limitY, limitY),
      }))
    }
  }
  function onPointerUp(event) {
    if (!currentPointers.current.has(event.pointerId)) return
    currentPointers.current.delete(event.pointerId)
    if (!currentPointers.current.size) {
      const dx = event.clientX - gesture.current.startX
      const dy = event.clientY - gesture.current.startY
      if (zoom === 1 && !gesture.current.pinched && Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy)) {
        changeImage(dx < 0 ? 1 : -1)
      }
      gesture.current.pinchDistance = null
    }
  }
  function onWheel(event) {
    if (!event.deltaY) return
    updateZoom(event.deltaY < 0 ? 0.25 : -0.25)
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="cc-gallery-lightbox" role="presentation">
      <div className="cc-gallery-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="cc-gallery-panel" role="dialog" aria-modal="true" aria-label={`Fotos — ${title}`}>
        <header className="cc-gallery-header">
          <div className="cc-gallery-heading">
            <span className="cc-gallery-eyebrow">Galeria de fotos</span>
            <h2>{title}</h2>
          </div>
          <button type="button" ref={closeRef} className="cc-gallery-close" onClick={onClose} aria-label="Fechar galeria">
            <span className="material-icons" aria-hidden="true">close</span>
          </button>
        </header>
        <div
          ref={stageRef}
          className={`cc-gallery-stage ${zoom > 1 ? 'is-zoomed' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => { setZoom((v) => v > 1 ? 1 : 2); setOffset({ x: 0, y: 0 }) }}
          onWheel={onWheel}
          aria-label="Imagem ampliada. Use os botões para aproximar ou afastar."
        >
          {activeImage && !imageError ? (
            <img
              key={activeImage}
              src={activeImage}
              alt={`${title} — foto ${index + 1}`}
              loading="eager"
              draggable={false}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setImageError(true) }}
              className="cc-gallery-photo"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            />
          ) : <p className="cc-gallery-fallback">Imagem indisponível.</p>}
          {loading && activeImage && !imageError ? <span className="cc-gallery-loading" role="status">Carregando foto…</span> : null}
        </div>
        <footer className="cc-gallery-footer">
          <div className="cc-gallery-navigation">
            <button type="button" className="cc-gallery-action" onClick={() => changeImage(-1)} disabled={imageCount < 2} aria-label="Foto anterior">
              <span className="material-icons" aria-hidden="true">chevron_left</span>
            </button>
            <span className="cc-gallery-count" aria-live="polite">{imageCount ? `${index + 1} de ${imageCount}` : 'Sem fotos'}</span>
            <button type="button" className="cc-gallery-action" onClick={() => changeImage(1)} disabled={imageCount < 2} aria-label="Próxima foto">
              <span className="material-icons" aria-hidden="true">chevron_right</span>
            </button>
          </div>
          <div className="cc-gallery-zoom">
            <button type="button" className="cc-gallery-action" onClick={() => updateZoom(-0.5)} disabled={zoom === MIN_ZOOM} aria-label="Diminuir zoom"><span className="material-icons" aria-hidden="true">remove</span></button>
            <button type="button" className="cc-gallery-zoom-value" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }} aria-label="Restaurar zoom para 100%">{Math.round(zoom * 100)}%</button>
            <button type="button" className="cc-gallery-action" onClick={() => updateZoom(0.5)} disabled={zoom === MAX_ZOOM} aria-label="Aumentar zoom"><span className="material-icons" aria-hidden="true">add</span></button>
          </div>
        </footer>
        {imageCount > 1 ? (
          <nav className="cc-gallery-thumbs" aria-label="Todas as fotos do produto">
            {photos.map((photo, photoIndex) => (
              <button key={`${photo}-${photoIndex}`} type="button" aria-label={`Selecionar foto ${photoIndex + 1}`} aria-current={photoIndex === index ? 'true' : undefined}
                className={`cc-gallery-thumb ${photoIndex === index ? 'is-active' : ''}`}
                onClick={() => { setIndex(photoIndex); setZoom(1); setOffset({ x: 0, y: 0 }) }}>
                <img src={photo} alt="" loading="lazy" draggable={false}/>
              </button>
            ))}
          </nav>
        ) : null}
      </section>
    </div>, document.body
  )
}
