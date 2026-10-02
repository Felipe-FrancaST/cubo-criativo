import * as React from 'react'
import useDialog from '../lib/useDialog.js'

/**
 * Modal genérico.
 *
 * Alguns usos (ex.: galeria) precisam de um painel menor no desktop.
 * Para isso, `widthClass` e `maxWidth` permitem controlar o tamanho do painel
 * sem duplicar componente.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  ariaLabel,
  bodyClassName = '',
  // Mantém o comportamento anterior como padrão.
  widthClass = 'w-[94vw] sm:w-[90vw] lg:w-[70vw]',
  maxWidth = 'max-w-[1100px]',
  panelClassName = '',
  zIndexClass = 'z-[150]',
  mobileLayout = 'sheet',
  busy = false,
}) {
  const showHeader = typeof title === 'string' && title.trim().length > 0
  const panelRef = useDialog(open, onClose, { busy })

  const label = ariaLabel || (showHeader ? title : 'Janela')

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} ${open ? 'visible' : 'invisible'}`}
      aria-hidden={!open}
      inert={open ? undefined : ''}
    >
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-[#020b10]/72 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={busy ? undefined : onClose}
      />
      {/* painel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-mobile-layout={mobileLayout}
        className={`app-modal-panel absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                    ${widthClass} ${maxWidth}
                    max-h-[92dvh]
                    bg-[#07161d] ring-1 ring-white/10 rounded-2xl
                    overflow-hidden flex flex-col
                    transition-transform ${open ? 'scale-100' : 'scale-95'}
                    ${panelClassName}`}
      >
        {showHeader ? (
          <div className="app-modal-header flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10">
            <h3 className="font-bold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/4"
              aria-label="Fechar"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        ) : null}
        <div
          data-modal-scroll
          className={`app-modal-body min-h-0 p-3 sm:p-4 overflow-y-auto overscroll-contain ${showHeader ? '' : 'pt-4'} ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
