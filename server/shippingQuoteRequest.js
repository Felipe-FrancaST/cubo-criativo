import { normalizeZip } from './shipping.js'

/** Validação de entrada pública antes de consultar dados e SuperFrete. */
export function validateShippingQuoteRequest({ type = 'shop', authenticated = false, destinationZip, items }) {
  if (!authenticated && type !== 'shop') {
    return { ok: false, status: 401, error: 'Entre na sua conta para calcular esse tipo de envio.' }
  }
  const normalizedZip = normalizeZip(destinationZip)
  if (destinationZip !== undefined && !/^\d{8}$/.test(normalizedZip)) {
    return { ok: false, status: 400, error: 'Informe um CEP de entrega válido com 8 números.' }
  }
  if (type === 'shop') {
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
      return { ok: false, status: 400, error: 'O carrinho deve conter entre 1 e 40 itens para cotação.' }
    }
    if (items.some(item => !Number.isInteger(Number(item?.qty)) || Number(item.qty) < 1 || Number(item.qty) > 100)) {
      return { ok: false, status: 400, error: 'Informe quantidades válidas entre 1 e 100 unidades por item.' }
    }
  }
  return { ok: true, destinationZip: normalizedZip }
}
