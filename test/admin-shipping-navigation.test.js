import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const adminFile = new URL('../src/pages/AdminOrdersPage.jsx', import.meta.url)
const content = readFileSync(adminFile, 'utf8')

function declaredSectionSet(name) {
  const match = content.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`))
  assert.ok(match, `Lista ${name} precisa existir na verificação de acesso`)
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map(([, value]) => value))
}

test('Frete SuperFrete permanece na lista de seções conhecidas e gerenciáveis', () => {
  const known = declaredSectionSet('knownSections')
  const business = declaredSectionSet('businessSections')
  assert.ok(known.has('shipping'), 'Sem isso o painel redireciona imediatamente para o Dashboard')
  assert.ok(business.has('shipping'), 'A gestão de frete deve exigir nível gerente ou superior')
})

test('O item do menu e a página de frete usam a mesma chave de navegação', () => {
  assert.match(content, /\['shipping',\s*'local_shipping',\s*'Frete SuperFrete',\s*canManageBusiness\]/)
  assert.match(content, /section === 'shipping' && canManageBusiness && \(/)
  assert.match(content, /<AdminShippingSection accessToken=\{accessToken\} \/>/)
  assert.ok(existsSync(new URL('../src/pages/admin/shipping/AdminShippingSection.jsx', import.meta.url)))
})
