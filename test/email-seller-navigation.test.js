import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
import { renderCustomerOrderEmail, renderOwnerAffiliateWithdrawalEmail, renderSellerWithdrawalStatusEmail } from '../server/emailTemplates.js';

const root = new URL('../', import.meta.url);
const source = filename => fs.readFileSync(new URL(filename, root), 'utf8');

test('alerta nativo do saque não existe no código atual de vendedores', () => {
  const admin = source('src/pages/admin/affiliates/AdminAffiliatesSection.jsx');
  assert.match(admin, /<ConfirmationDialog open=\{Boolean\(settlement\)\}/);
  assert.match(admin, /setSettlement\(\{ withdrawal: w, action: 'paid' \}\)/);
  assert.doesNotMatch(admin, /window\.confirm|window\.alert/);
  const dialog = source('src/components/ConfirmationDialog.jsx');
  assert.match(dialog, /createPortal/);
  assert.match(dialog, /document\.body/);
});

test('ícone e item de menu somente quando o servidor confirma vendedor ativo', () => {
  const header = source('src/components/SiteHeader.jsx');
  const drawer = source('src/components/MenuDrawer.jsx');
  const app = source('src/App.jsx');
  const api = source('api/affiliate.js');
  assert.match(header, /user && isSeller/);
  assert.match(header, /Área do vendedor/);
  assert.match(drawer, /\{isSeller \? \(/);
  assert.match(drawer, /Minha área de vendedor/);
  assert.match(app, /\/api\/affiliate\?action=status/);
  assert.match(api, /Boolean\(context\.affiliate\?\.active\)/);
  assert.match(api, /Cache-Control', 'private, no-store/);
});

test('e-mails comerciais têm layout claro e logo em célula branca', () => {
  const mail = renderCustomerOrderEmail({ brandName: 'Cubo Criativo', orderId: '12345678', total: 200, customer: {name:'Cliente'}, items: [], siteUrl:'https://www.cubocriativo3d.com.br' });
  assert.match(mail.html, /bgcolor="#FFFFFF"/);
  assert.match(mail.html, /background:#FFFFFF!important/);
  assert.match(mail.html, /meta name="color-scheme" content="light"/);
  assert.doesNotMatch(mail.html, /background:#070b13|background:#080d18/);
});

test('novas mensagens de saque seguem padrão e não revelam chave Pix', () => {
  const requested = renderOwnerAffiliateWithdrawalEmail({ amount: 150, requestId:'aabbccdd-1111', siteUrl:'https://www.cubocriativo3d.com.br' });
  const paid = renderSellerWithdrawalStatusEmail({ amount: 150, status:'paid', siteUrl:'https://www.cubocriativo3d.com.br' });
  const rejected = renderSellerWithdrawalStatusEmail({ amount: 150, status:'rejected', siteUrl:'https://www.cubocriativo3d.com.br' });
  assert.match(requested.html, /Nova solicitação de saque/);
  assert.match(paid.html, /Seu saque foi concluído/);
  assert.match(rejected.html, /Solicitação não aprovada/);
  assert.match(requested.html, /\/admin/);
  assert.match(paid.html, /\/vendedor/);
  assert.match(paid.html, /bgcolor="#FFFFFF"/);
  assert.doesNotMatch(requested.html, /chave Pix de|Senha:/i);
});

test('13 modelos de autenticação Supabase em português, com placeholders originais', () => {
  const dir = new URL('../supabase/auth_email_templates/', import.meta.url);
  const files = readdirSync(dir).filter(file => file.endsWith('.html'));
  assert.equal(files.length, 13);
  for (const filename of files) {
    const html = readFileSync(new URL(filename,dir),'utf8');
    assert.match(html, /lang="pt-BR"/);
    assert.match(html, /bgcolor="#FFFFFF"/);
    assert.match(html, /\{\{ \.SiteURL \}\}\/images\/logo\.png/);
    assert.match(html, /Cubo Criativo/);
  }
  assert.match(readFileSync(new URL('senha_alterada.html',dir),'utf8'),/Senha alterada com sucesso/);
  assert.match(readFileSync(new URL('recuperacao_senha.html',dir),'utf8'),/\{\{ \.ConfirmationURL \}\}/);
  assert.match(readFileSync(new URL('reautenticacao.html',dir),'utf8'),/\{\{ \.Token \}\}/);
});
