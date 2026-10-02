import React from 'react'
import Modal from '../Modal.jsx'

export default function VipGalleryModal({ item, onClose, onImageError }) {
  const [index, setIndex] = React.useState(0)
  const gesture = React.useRef(null)
  const images = [
    ...new Set(
      [item?.image_url, ...(item?.gallery_images || [])].filter(Boolean)
    ),
  ]
  React.useEffect(() => setIndex(0), [item?.id])
  const selectedIndex = Math.min(index, Math.max(0, images.length - 1))
  const move = (delta) =>
    setIndex((previous) => (previous + delta + images.length) % images.length)
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={item?.title || 'Miniatura'}
      widthClass="w-[94vw] sm:w-[600px]"
      maxWidth="max-w-[600px]"
      zIndexClass="z-[240]"
      bodyClassName="vip-gallery-body"
    >
      <div
        className="vip-gallery"
        onKeyDown={(event) => {
          if (!images.length) return
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            move(event.key === 'ArrowRight' ? 1 : -1)
          }
        }}
      >
        <div
          className="vip-gallery-stage"
          onPointerDown={(event) => {
            gesture.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerCancel={() => {
            gesture.current = null
          }}
          onPointerUp={(event) => {
            const start = gesture.current
            gesture.current = null
            if (!start || images.length < 2) return
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
              src={images[selectedIndex]}
              alt={`${item?.title}, imagem ${selectedIndex + 1} de ${images.length}`}
              onError={onImageError}
            />
          ) : (
            <p>Imagem indisponível.</p>
          )}
          {images.length > 1 && (
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
                {selectedIndex + 1}/{images.length}
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
        {item?.description && (
          <p className="vip-gallery-description">{item.description}</p>
        )}
      </div>
    </Modal>
  )
}
