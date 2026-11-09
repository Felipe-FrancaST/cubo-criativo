import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTrackingUrl } from '../src/lib/tracking.js'

test('rastreamento aceita links web e bloqueia protocolos executáveis', () => {
  assert.equal(buildTrackingUrl({ fallbackUrl: 'https://rastreamento.example/pedido/123' }), 'https://rastreamento.example/pedido/123')
  for (const fallbackUrl of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com', 'invalid']) {
    assert.equal(buildTrackingUrl({ fallbackUrl, code: 'ABC123', carrier: 'correios' }), 'https://rastreamento.correios.com.br/')
  }
  assert.equal(buildTrackingUrl({ fallbackUrl: 'javascript:alert(1)' }), '')
})
