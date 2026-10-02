// Shared by the browser and the API: amounts are calculated in integer cents.
export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const raw = String(value ?? '')
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(/\s/g, '')
  if (!raw) return NaN
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN
  return Number(normalized)
}

export function isValidCpf(value) {
  const cpf = String(value || '').replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  for (let length = 9; length <= 10; length += 1) {
    const sum = [...cpf.slice(0, length)].reduce(
      (acc, digit, index) => acc + Number(digit) * (length + 1 - index),
      0
    )
    const digit = (sum * 10) % 11
    if ((digit === 10 ? 0 : digit) !== Number(cpf[length])) return false
  }
  return true
}

const states = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(
    ' '
  )
)

export function validateManualCustomer(
  customer,
  mode = 'new',
  existingUserId = ''
) {
  const errors = {}
  if (mode === 'existing' && !existingUserId)
    errors.client = 'Selecione um cliente cadastrado.'
  if (!String(customer?.name || customer?.full_name || '').trim())
    errors.name = 'Informe o nome do cliente.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer?.email || '').trim()))
    errors.email = 'Informe um e-mail válido.'
  if (!isValidCpf(customer?.cpf)) errors.cpf = 'Informe um CPF válido.'
  const phone = String(customer?.phone || '').replace(/\D/g, '')
  if (phone && !/^\d{10,11}$/.test(phone))
    errors.phone = 'Informe o telefone com DDD.'
  for (const [field, label] of Object.entries({
    address_line1: 'a rua',
    address_number: 'o número',
    neighborhood: 'o bairro',
    city: 'a cidade',
  })) {
    if (!String(customer?.[field] || '').trim())
      errors[field] = `Informe ${label}.`
  }
  if (
    !states.has(
      String(customer?.state || '')
        .trim()
        .toUpperCase()
    )
  )
    errors.state = 'Selecione um estado válido.'
  if (!/^\d{8}$/.test(String(customer?.zip || '').replace(/\D/g, '')))
    errors.zip = 'Informe um CEP com 8 dígitos.'
  return errors
}

export function getManualProductPriceCents(product, scale = '') {
  if (!product) return 0
  const variants = Array.isArray(product.variants) ? product.variants : []
  const label = String(scale || product.default_variant || '').trim()
  const variant =
    variants.find((row) => String(row.label || '').trim() === label) ||
    variants[0]
  const current = Number(
    product.price_cents ?? Math.round(Number(product.price || 0) * 100)
  )
  const original = Number(product.original_price_cents || 0)
  let cents = variant
    ? Number(variant.price_cents ?? variant.priceCents ?? 0)
    : product.promo
      ? current || original
      : original || current
  if (variant && product.promo && current > 0 && original > current)
    cents = Math.round((cents * current) / original)
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0
}

export function validateManualItems(items) {
  if (!Array.isArray(items) || !items.length)
    return 'Adicione pelo menos um item ao pedido.'
  if (items.length > 100) return 'O pedido pode ter no máximo 100 itens.'
  const vip = items.filter((item) =>
    ['vip', 'subscription', 'assinatura_vip'].includes(item.mode || item.type)
  )
  if (vip.length && items.length !== 1)
    return 'Crie a assinatura VIP em um pedido separado.'
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const mode = item.mode || item.type
    const label = `Item ${index + 1}`
    if (
      ![
        'vip',
        'subscription',
        'assinatura_vip',
        'freight',
        'shipping',
        'frete',
      ].includes(mode)
    ) {
      const qty = Number(item.qty ?? item.quantity ?? 1)
      if (!Number.isInteger(qty) || qty < 1 || qty > 999)
        return `${label}: a quantidade deve ser um inteiro entre 1 e 999.`
    }
    if (mode === 'product' && !String(item.product_id || item.id || '').trim())
      return `${label}: selecione um produto.`
    if (['vip', 'subscription', 'assinatura_vip'].includes(mode)) {
      if (!item.vip_plan_id) return 'Selecione um plano VIP.'
    } else if (['freight', 'shipping', 'frete'].includes(mode)) {
      if (
        !['correios', 'jadlog', 'loggi'].includes(
          String(item.carrier || item.shipping_carrier || '').toLowerCase()
        )
      )
        return `${label}: selecione a transportadora.`
      if (
        !(
          parseMoney(
            item.unit_price ?? item.price ?? item.valor ?? item.shipping_price
          ) > 0
        )
      )
        return `${label}: informe um valor de frete válido.`
    } else if (mode !== 'product') {
      if (!String(item.name || item.nome || '').trim())
        return `${label}: informe o nome do produto.`
      if (!(parseMoney(item.unit_price ?? item.price ?? item.valor) > 0))
        return `${label}: informe um valor maior que zero.`
    }
  }
  return ''
}
