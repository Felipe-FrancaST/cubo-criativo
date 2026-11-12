import React from 'react'
import { downloadAdminReferences } from '../lib/customReferenceDownloads.js'

export const customPieceTitle = kind => kind === 'busto' ? 'Busto personalizado' : 'Miniatura personalizada'

export default function CustomReferenceGallery({ request, admin = false, accessToken = '', orderId = '' }) {
  const [downloading, setDownloading] = React.useState(false)
  const [downloadError, setDownloadError] = React.useState('')
  if (!request) return null
  const images = (request.image_urls || []).filter(Boolean)

  async function downloadAll() {
    if (!accessToken || downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadAdminReferences({ token: accessToken, orderId: orderId || request.order_id, requestId: request.id })
    } catch (error) {
      setDownloadError(error.message || 'Falha no download das imagens.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4" aria-label="Referências da personalização">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-white"><span className="material-icons text-cyan-300">view_in_ar</span> {customPieceTitle(request.kind)}</div>
          <p className="mt-1 text-xs text-slate-400">Projeto sob encomenda · {request.image_paths?.length || images.length} imagem(ns) de referência</p>
        </div>
        {admin ? (
          <button type="button" disabled={!(request.image_paths?.length || images.length) || downloading || !accessToken}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
            onClick={downloadAll}>
            <span className="material-icons text-base">download</span>
            {downloading ? 'Preparando ZIP…' : 'Baixar imagens (.zip)'}
          </button>
        ) : null}
      </div>
      {request.notes ? <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-sm text-slate-200">{request.notes}</p> : null}
      {images.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, index) => (
            <a key={`${index}-${url}`} href={url} target="_blank" rel="noreferrer" title={`Abrir imagem ${index + 1}`}
              className="group relative aspect-square overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10 hover:ring-cyan-300/50">
              <img src={url} loading="lazy" alt={`Referência ${index + 1} de ${customPieceTitle(request.kind).toLowerCase()}`} className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{index + 1}</span>
            </a>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-amber-100">Imagens indisponíveis no momento. Atualize o pedido para renovar os links.</p>}
      {downloadError ? <p className="mt-3 text-xs text-rose-200" role="alert">{downloadError}</p> : null}
    </section>
  )
}
