// ZIP sem bibliotecas externas: arquivos de imagem já comprimidos são armazenados
// sem recompressão, preservando cada byte original.
const utf8 = new TextEncoder()

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let i = 0; i < 8; i += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}

function safeName(name, index) {
  const original = String(name || '').split(/[\\/]/).pop() || ''
  const sanitized = original.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 100)
  return `${String(index + 1).padStart(2, '0')}-${sanitized || 'referencia.png'}`
}

export async function buildReferenceZip(files, { fetchFile = fetch } = {}) {
  if (!Array.isArray(files) || !files.length || files.length > 6) throw new Error('Imagens indisponíveis para download.')
  const chunks = []
  const central = []
  let offset = 0
  let totalBytes = 0
  for (const [index, file] of files.entries()) {
    if (!/^https:\/\//.test(String(file?.url || ''))) throw new Error('Link da imagem inválido.')
    const result = await fetchFile(file.url, { cache: 'no-store' })
    if (!result.ok) throw new Error(`Não foi possível baixar a referência ${index + 1}. Atualize a página e tente novamente.`)
    const content = new Uint8Array(await result.arrayBuffer())
    totalBytes += content.length
    if (!content.length || totalBytes > 65 * 1024 * 1024) throw new Error('Tamanho das imagens excede o limite permitido.')
    const name = utf8.encode(safeName(file.name, index))
    const checksum = crc32(content)
    const local = new Uint8Array(30 + name.length)
    const l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true)
    l.setUint16(4, 20, true)
    l.setUint16(6, 0x0800, true) // nomes UTF-8
    l.setUint16(8, 0, true) // STORE: imagens sem recompressão
    l.setUint32(14, checksum, true)
    l.setUint32(18, content.length, true)
    l.setUint32(22, content.length, true)
    l.setUint16(26, name.length, true)
    local.set(name, 30)
    chunks.push(local, content)

    const dir = new Uint8Array(46 + name.length)
    const d = new DataView(dir.buffer)
    d.setUint32(0, 0x02014b50, true)
    d.setUint16(4, 20, true)
    d.setUint16(6, 20, true)
    d.setUint16(8, 0x0800, true)
    d.setUint16(10, 0, true)
    d.setUint32(16, checksum, true)
    d.setUint32(20, content.length, true)
    d.setUint32(24, content.length, true)
    d.setUint16(28, name.length, true)
    d.setUint32(42, offset, true)
    dir.set(name, 46)
    central.push(dir)
    offset += local.length + content.length
  }
  const directorySize = central.reduce((size, part) => size + part.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, files.length, true)
  e.setUint16(10, files.length, true)
  e.setUint32(12, directorySize, true)
  e.setUint32(16, offset, true)
  return new Blob([...chunks, ...central, end], { type: 'application/zip' })
}

export async function downloadAdminReferences({ token, orderId, requestId }) {
  const params = new URLSearchParams({ api_action: 'custom-miniatures', op: 'admin-downloads' })
  if (orderId) params.set('order_id', orderId)
  else if (requestId) params.set('request_id', requestId)
  else throw new Error('Pedido inválido para download.')
  const response = await fetch(`/api/core?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Não foi possível preparar o download.')
  const archive = await buildReferenceZip(result.files || [])
  const href = URL.createObjectURL(archive)
  try {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `cubo-referencias-${String(orderId || requestId).slice(0, 8)}.zip`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 15000)
  }
}
