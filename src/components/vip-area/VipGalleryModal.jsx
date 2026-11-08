import React from 'react'
import Modal from '../Modal.jsx'

export default function VipGalleryModal({
  item,
  items = [],
  onItemChange,
  onClose,
  onImageError,
}) {
  const [index, setIndex] = React.useState(0)
  const gesture = React.useRef(null)
  const images = [
    ...new Set(
      [
        item?.image_url,
        ...(Array.isArray(item?.gallery_images) ? item.gallery_images : []),
      ].filter(Boolean)
    ),
  ]
  React.useEffect(() => setIndex(0), [item?.id])
  const selectedIndex = Math.min(index, Math.max(0, images.length - 1))
  const itemIndex = items.findIndex(
    (entry) => String(entry.id) === String(item?.id)
  )
  const canBrowse = items.length > 1 && itemIndex >= 0 && Boolean(onItemChange)
  const changeItem = (delta) => {
    if (!canBrowse) return
    setIndex(0)
    onItemChange(items[(itemIndex + delta + items.length) % items.length])
  }
  const move = (delta) => {
    const next = selectedIndex + delta
    if (canBrowse && (next < 0 || next >= images.length)) {
      changeItem(delta)
    } else if (images.length) {
      setIndex((next + images.length) % images.length)
    }
  }
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={item?.title || 'Miniatura'}
      widthClass="w-[94vw] sm:w-[600px]"
      maxWidth="max-w-[600px]"
      zIndexClass="z-[240]"
      bodyClassName="vip-gallery-body"
      panelClassName="vip-gallery-panel"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          event.stopPropagation()
          move(event.key === 'ArrowRight' ? 1 : -1)
        }
      }}
    >
      <div className="vip-gallery">
        <div
          className="vip-gallery-stage"
          onPointerDown={(event) => {
            if (event.target.closest('button') || event.isPrimary === false)
              return
            if (event.pointerType === 'mouse' && event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            gesture.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerCancel={() => {
            gesture.current = null
          }}
          onPointerUp={(event) => {
            const start = gesture.current
            gesture.current = null
            if (!start || (images.length < 2 && !canBrowse)) return
            const delta = event.clientX - start.x
            if (
              Math.abs(delta) > 40 &&
              Math.abs(delta) > Math.abs(event.clientY - start.y) * 1.2
            )
              move(delta < 0 ? 1 : -1)
          }}
        >
          {images.length ? (
            <img
              key={images[selectedIndex]}
              draggable={false}
              src={images[selectedIndex]}
              alt={`${item?.title}, imagem ${selectedIndex + 1} de ${images.length}`}
              onError={onImageError}
            />
          ) : (
            <p>Imagem indisponível.</p>
          )}
          {(images.length > 1 || canBrowse) && (
            <>
              <button
                type="button"
                className="vip-gallery-prev customer-icon-button"
                onClick={() => move(-1)}
                aria-label="Imagem anterior"
              >
                <span className="material-icons" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className="vip-gallery-next customer-icon-button"
                onClick={() => move(1)}
                aria-label="Próxima imagem"
              >
                <span className="material-icons" aria-hidden="true">
                  chevron_right
                </span>
              </button>
              <span className="vip-gallery-count" aria-live="polite">
                {images.length
                  ? `${selectedIndex + 1}/${images.length}`
                  : 'Sem foto'}
              </span>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div
            className="vip-gallery-thumbnails"
            aria-label="Imagens da miniatura"
          >
            {images.map((url, imageIndex) => (
              <button
                type="button"
                key={url}
                onClick={() => setIndex(imageIndex)}
                aria-label={`Ver imagem ${imageIndex + 1}`}
                aria-pressed={selectedIndex === imageIndex}
              >
                <img src={url} alt="" loading="lazy" onError={onImageError} />
              </button>
            ))}
          </div>
        )}
        {canBrowse && (
          <nav
            className="vip-gallery-navigation"
            aria-label="Navegar pela coleção"
          >
            <button
              type="button"
              className="customer-secondary"
              onClick={() => changeItem(-1)}
              aria-label="Miniatura anterior"
            >
              ← Anterior
            </button>
            <span role="status">
              Peça {itemIndex + 1} de {items.length}
            </span>
            <button
              type="button"
              className="customer-secondary"
              onClick={() => changeItem(1)}
              aria-label="Próxima miniatura"
            >
              Próxima →
            </button>
          </nav>
        )}
        {(canBrowse || images.length > 1) && (
          <p className="vip-gallery-hint">
            Use as setas ou deslize para explorar a coleção.
          </p>
        )}
        {item?.description && (
          <p className="vip-gallery-description">{item.description}</p>
        )}
      </div>
    </Modal>
  )
}
