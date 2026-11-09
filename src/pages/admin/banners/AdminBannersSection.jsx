import React from 'react'
import { supabase } from '../../../lib/supabaseClient.js'

const DEFAULTS = {
  image_url: '/images/banner_base_pc.jpg',
  mobile_image_url: '/images/banner_base.jpg',
}
const SLOTS = [
  ['image_url', 'Computador', 'Imagem horizontal. Sugestão: 1920 × 640 px.'],
  [
    'mobile_image_url',
    'Celular',
    'Proporção 16:9. Sugestão: 960 × 540 px; mantenha o conteúdo principal centralizado.',
  ],
]

export default function AdminBannersSection({ accessToken }) {
  const [draft, setDraft] = React.useState(DEFAULTS)
  const [saved, setSaved] = React.useState(DEFAULTS)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const lock = React.useRef(false)
  const alive = React.useRef(true)
  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const request = React.useCallback(
    async (data, signal) => {
      const response = await fetch('/api/admin?action=home-banner', {
        method: data ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(data ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
        signal,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(
          result.error || 'Não foi possível atualizar os banners.'
        )
      return result
    },
    [accessToken]
  )
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    request(null, controller.signal)
      .then(({ banner }) => {
        if (!controller.signal.aborted) {
          setDraft({ ...DEFAULTS, ...banner })
          setSaved({ ...DEFAULTS, ...banner })
          setError('')
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [request])
  async function upload(key, file) {
    if (!file || lock.current) return
    setMessage('')
    setError('')
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size <= 0 ||
      file.size > 8 * 1024 * 1024
    ) {
      setError('Escolha JPG, PNG ou WebP de até 8 MB.')
      return
    }
    lock.current = true
    setBusy(key)
    try {
      // Decode before uploading so renamed or corrupt files never replace a working banner.
      const bitmap = await createImageBitmap(file)
      bitmap.close()
      const target = await request({
        operation: 'upload',
        contentType: file.type,
        size: file.size,
      })
      const result = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type,
        })
      if (result.error) throw result.error
      if (alive.current) {
        setDraft((old) => ({ ...old, [key]: target.publicUrl }))
        setMessage(
          'Imagem enviada. Confira a prévia e clique em Salvar banners para publicar.'
        )
      }
    } catch (e) {
      if (alive.current)
        setError(e.message || 'Não foi possível enviar a imagem.')
    } finally {
      lock.current = false
      if (alive.current) setBusy('')
    }
  }
  async function save() {
    if (lock.current) return
    lock.current = true
    setBusy('save')
    setError('')
    setMessage('')
    try {
      const result = await request({ operation: 'save', ...draft })
      if (alive.current) {
        setSaved(result.banner)
        setDraft(result.banner)
        setMessage(
          'Banners publicados. A página inicial exibirá as novas imagens ao ser aberta ou atualizada.'
        )
      }
    } catch (e) {
      if (alive.current) setError(e.message)
    } finally {
      lock.current = false
      if (alive.current) setBusy('')
    }
  }
  const dirty = SLOTS.some(([key]) => draft[key] !== saved[key])
  return (
    <section aria-labelledby="banners-title" className="space-y-6">
      <div>
        <h2 id="banners-title" className="text-2xl font-bold">
          Banners da assinatura VIP
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Troque as imagens da página inicial. O clique continua levando aos
          planos VIP.
        </p>
      </div>
      {error && (
        <p role="alert" className="customer-alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando banners…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {SLOTS.map(([key, title, hint]) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 min-w-0"
              >
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{hint}</p>
                <div className="my-4 rounded-xl bg-black/30 overflow-hidden flex justify-center">
                  <img
                    src={draft[key] || DEFAULTS[key]}
                    alt={`Prévia do banner para ${title.toLowerCase()}`}
                    className="w-full h-64 object-contain"
                  />
                </div>
                <label className="block text-sm font-medium">
                  Escolher imagem para {title.toLowerCase()}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={Boolean(busy)}
                    onChange={(event) => {
                      upload(key, event.target.files?.[0])
                      event.target.value = ''
                    }}
                    className="block w-full mt-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:p-3 file:bg-cyan-300 file:text-slate-950"
                  />
                </label>
                {busy === key && (
                  <p role="status" className="mt-2 text-sm">
                    Enviando imagem…
                  </p>
                )}
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setDraft((old) => ({ ...old, [key]: DEFAULTS[key] }))
                    setMessage(
                      'Clique em Salvar banners para aplicar a imagem padrão.'
                    )
                  }}
                  className="mt-4 customer-secondary"
                >
                  Usar imagem padrão
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={Boolean(busy) || !dirty}
              className="customer-primary"
            >
              {busy === 'save' ? 'Salvando…' : 'Salvar banners'}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !dirty}
              onClick={() => {
                setDraft(saved)
                setMessage('Alterações descartadas.')
                setError('')
              }}
              className="customer-secondary"
            >
              Descartar alterações
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              Ver página inicial
            </a>
          </div>
        </>
      )}
    </section>
  )
}
