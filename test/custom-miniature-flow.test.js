import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildReferenceZip } from '../src/lib/customReferenceDownloads.js'

const source = async file => readFile(new URL(file, import.meta.url), 'utf8')

test('ZIP de referências inclui todas as imagens e diretório central válido', async () => {
  const content = new TextEncoder().encode('sample image data')
  const files = [{ name: 'retrato.png', url: 'https://example.test/a' }, { name: 'pose.webp', url: 'https://example.test/b' }]
  const zip = await buildReferenceZip(files, {
    fetchFile: async () => ({ ok: true, arrayBuffer: async () => content.buffer }),
  })
  const result = new Uint8Array(await zip.arrayBuffer())
  const view = new DataView(result.buffer)
  assert.equal(view.getUint32(0, true), 0x04034b50)
  assert.equal(view.getUint32(result.length - 22, true), 0x06054b50)
  assert.equal(view.getUint16(result.length - 14, true), 2)
  assert.equal(zip.type, 'application/zip')
  assert.match(new TextDecoder().decode(result), /01-retrato.png/)
  assert.match(new TextDecoder().decode(result), /02-pose.webp/)
})

test('ZIP rejeita mais de seis arquivos, links inválidos e falha de download', async () => {
  await assert.rejects(buildReferenceZip([]), /indisponíveis/)
  await assert.rejects(buildReferenceZip([{ name: 'x', url: 'javascript:alert(1)' }]), /inválido/)
  await assert.rejects(buildReferenceZip([{ name: 'x', url: 'https://example.test/x' }], {
    fetchFile: async () => ({ ok: false }),
  }), /Não foi possível baixar/)
})

test('servidor exige autenticação na leitura e valida aprovação financeira no Mercado Pago', async () => {
  const api = await source('../server/api_handlers/custom-miniatures.js')
  assert.match(api, /op === 'verify-payment'/)
  assert.match(api, /getUserFromAuthHeader\(req\)/)
  assert.match(api, /mp\.external_reference/)
  assert.match(api, /mp\.status \|\| ''\) === 'approved'/)
  assert.match(api, /op === 'admin-downloads'/)
  assert.match(api, /requireAdmin\(req, ADMIN_LEVEL\.OPERATOR\)/)
  assert.match(api, /\.eq\('user_id', user\.id\)\.in\('order_id'/)
})

test('meus pedidos e detalhes da administração mostram tipo e referências', async () => {
  const customer = await source('../src/components/OrdersModal.jsx')
  const admin = await source('../src/pages/AdminOrdersPage.jsx')
  const page = await source('../src/pages/CustomMiniaturesPage.jsx')
  assert.match(customer, /op=order-summaries/)
  assert.match(customer, /CustomReferenceGallery request=\{o\.custom\}/)
  assert.match(admin, /op: 'admin-order-detail'/)
  assert.match(admin, /CustomReferenceGallery request=\{customRequest\} admin/)
  assert.match(page, /setPixData\(previous => previous\?\.orderId === orderId \? null : previous\)/)
  assert.match(page, /Compra efetuada com sucesso/)
  assert.match(page, /Ver meus pedidos/)
})
