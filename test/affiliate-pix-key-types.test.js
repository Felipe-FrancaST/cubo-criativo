import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePixKey, validatePixPayout, pixKeyTypeLabel, PIX_KEY_TYPES } from '../shared/pixKey.js';

function alphaCnpj(prefix) {
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const body = [...prefix].map(char => char.charCodeAt(0) - 48);
  const check = (arr, weights) => {
    const rem = arr.reduce((a, n, i) => a + n * weights[i], 0) % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const first = check(body, weights1);
  return prefix + first + check([...body, first], weights2);
}

test('cinco tipos oficiais de chave Pix disponíveis com rótulos', () => {
  assert.deepEqual(PIX_KEY_TYPES.map(p => p.value), ['cpf', 'cnpj', 'phone', 'email', 'random']);
  assert.equal(pixKeyTypeLabel('phone'), 'Celular');
  assert.equal(pixKeyTypeLabel(null), 'Tipo não informado');
});

test('CPF com dígitos verificadores e normalização', () => {
  assert.deepEqual(validatePixKey('cpf', '529.982.247-25'), { ok: true, key: '52998224725', error: '' });
  for (const wrong of ['529.982.247-26', '111.111.111-11', '5299822472', '529a98224725']) {
    assert.equal(validatePixKey('cpf', wrong).ok, false, wrong);
  }
});

test('CNPJ numérico e alfanumérico validam os dígitos verificadores', () => {
  assert.equal(validatePixKey('cnpj', '04.252.011/0001-10').key, '04252011000110');
  assert.equal(validatePixKey('cnpj', '04.252.011/0001-10').ok, true);
  assert.equal(validatePixKey('cnpj', '04.252.011/0001-11').ok, false);
  assert.equal(validatePixKey('cnpj', '00.000.000/0000-00').ok, false);
  const alpha = alphaCnpj('12ABC34501DE');
  assert.equal(validatePixKey('cnpj', alpha).ok, true);
  assert.equal(validatePixKey('cnpj', alpha.slice(0, 12) + '00').ok, false);
});

test('celular brasileiro aceita máscara ou +55 e salva no formato internacional', () => {
  assert.equal(validatePixKey('phone', '(77) 99999-8888').key, '+5577999998888');
  assert.equal(validatePixKey('phone', '+55 (77) 99999-8888').key, '+5577999998888');
  assert.equal(validatePixKey('phone', '5577999998888').ok, true);
  assert.equal(validatePixKey('phone', '7799999888').ok, false);
  assert.equal(validatePixKey('phone', '77 89999-8888').ok, false);
  assert.equal(validatePixKey('phone', '+44 20 1234 5678').ok, false);
});

test('e-mail e chave aleatória exigem padrões específicos', () => {
  assert.equal(validatePixKey('email', '  NOME@EXEMPLO.COM.BR ').key, 'nome@exemplo.com.br');
  assert.equal(validatePixKey('email', 'nome@exemplo.com.br').ok, true);
  assert.equal(validatePixKey('email', 'nome@').ok, false);
  assert.equal(validatePixKey('email', 'abc..def@example.com').ok, false);
  assert.equal(validatePixKey('email', `a${'a'.repeat(70)}@mail.com`).ok, false);
  assert.equal(validatePixKey('random', '123e4567-e89b-12d3-a456-426614174000').ok, true);
  assert.equal(validatePixKey('random', '123e4567-e89b-12d3-a456-42661417400').ok, false);
});

test('bloqueia tipo não selecionado, tipo incompatível e titular incompleto', () => {
  assert.equal(validatePixPayout({ pix_key_type: '', pix_key: '52998224725', holder_name: 'Ana Silva' }).ok, false);
  assert.equal(validatePixPayout({ pix_key_type: 'cpf', pix_key: 'nome@email.com', holder_name: 'Ana Silva' }).ok, false);
  assert.equal(validatePixPayout({ pix_key_type: 'cpf', pix_key: '52998224725', holder_name: 'A' }).ok, false);
  assert.deepEqual(validatePixPayout({ pix_key_type: 'cpf', pix_key: '529.982.247-25', holder_name: 'Ana   Silva' }), {
    ok: true, payout: { pix_key_type: 'cpf', pix_key: '52998224725', holder_name: 'Ana Silva' },
  });
});

test('backend usa validação compartilhada e persiste o tipo no perfil e no histórico', () => {
  const backend = readFileSync(new URL('../api/affiliate.js', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8');
  const seller = readFileSync(new URL('../src/pages/SellerDashboardPage.jsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20261113_affiliate_pix_key_types.sql', import.meta.url), 'utf8');
  assert.match(backend, /validatePixPayout\(payload\)/);
  assert.match(backend, /\.upsert\(\{ affiliate_id: context\.affiliate\.id, \.\.\.payout/);
  assert.match(backend, /pix_key,pix_key_type,holder_name,updated_at/);
  assert.match(admin, /pix_key,pix_key_type,holder_name/);
  assert.match(seller, /<PixPayoutForm /);
  assert.match(seller, /!payoutProfileReady \|\| requesting/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.affiliate_request_withdrawal/);
  assert.match(migration, /v_profile\.pix_key_type IS NULL/);
  assert.match(migration, /v_profile\.pix_key_type,v_profile\.pix_key,v_profile\.holder_name/);
  assert.match(migration, /WHERE affiliate_id=p_affiliate_id AND status='confirmed' AND withdrawal_id IS NULL FOR UPDATE/);
});
