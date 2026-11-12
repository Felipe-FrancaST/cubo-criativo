import React from 'react'
import useDialog from '../lib/useDialog.js'

/** Confirmações financeiras sem caixas de diálogo nativas do navegador. */
export default function ConfirmationDialog({ open, title, description, children, onClose, onConfirm, busy = false, confirmLabel = 'Confirmar', tone = 'green', disabled = false }) {
  const panelRef = useDialog(Boolean(open), onClose, { busy })
  if (!open) return null
  const positive = tone === 'green'
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#020b12]/85 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose?.() }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="financial-dialog-title" aria-describedby={description ? 'financial-dialog-description' : undefined} className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#0b202d] p-6 text-slate-100 shadow-2xl shadow-black/60 sm:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <span aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-2xl ${positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}><span className="material-icons">{positive ? 'verified_user' : 'info'}</span></span>
          <button type="button" aria-label="Fechar confirmação" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"><span className="material-icons">close</span></button>
        </div>
        <h2 id="financial-dialog-title" className="text-xl font-black tracking-tight text-white">{title}</h2>
        {description && <p id="financial-dialog-description" className="mt-2 text-sm leading-6 text-slate-300">{description}</p>}
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-40">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy || disabled} className={`rounded-xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${positive ? 'bg-emerald-300 text-[#05251d] hover:bg-emerald-200' : 'bg-rose-300 text-[#331017] hover:bg-rose-200'}`}>{busy ? 'Processando…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
