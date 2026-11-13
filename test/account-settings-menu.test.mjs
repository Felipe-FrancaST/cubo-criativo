import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const menu = readFileSync(new URL('../src/components/MenuDrawer.jsx', import.meta.url), 'utf8')
const tabs = readFileSync(new URL('../src/components/account/AccountSettingsTabs.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('menu tem um único acesso a Configurações para usuário autenticado', () => {
  assert.equal((menu.match(/>\s*Configurações\s*<\/DrawerButton>/g) || []).length, 1)
  assert.doesNotMatch(menu, />\s*Perfil\s*<\/button>/)
  assert.doesNotMatch(menu, />\s*Ajustes\s*<\/button>/)
  assert.match(menu, /active=\{route === '\/configuracoes' \|\| route === '\/perfil'\}/)
})

test('o acesso unificado mantém as seções importantes da conta', () => {
  for (const section of ['Dados e entrega', 'Segurança', 'Favoritos', 'Cupons', 'Avaliações']) {
    assert.ok(tabs.includes(section), `${section} precisa estar disponível em Configurações`)
  }
  assert.match(app, /route === '\/configuracoes' \|\| route === '\/perfil'/)
  assert.match(menu, /onOpenSettings\?\.\('settings'\)/)
})

test('atalhos para vendedor, administração, pedidos e saída permanecem no menu', () => {
  for (const label of ['Meus pedidos', 'Minha área de vendedor', 'Admin — Painel', 'Sair']) {
    assert.ok(menu.includes(label), `acesso ${label} não deve ser removido`)
  }
})
