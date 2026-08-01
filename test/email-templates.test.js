import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderCustomerOrderEmail,
  renderManualOrderPaymentEmail,
  renderOrderStatusEmail,
  renderPixReminderEmail,
} from '../server/emailTemplates.js';

test('confirmação de pedido usa layout padronizado e dados do cliente', () => {
  const mail = renderCustomerOrderEmail({
    brandName: 'Cubo Criativo',
    orderId: '12345678-abcd',
    createdAt: '2026-08-01T12:00:00Z',
    paymentMethod: 'Cartão de crédito',
    total: 150,
    customer: { name: 'Cliente Teste', address: 'Rua A, 10' },
    items: [{ name: 'Miniatura', qty: 1, price: 150, scale: '1/10' }],
    siteUrl: 'https://www.cubocriativo3d.com.br',
    orderUrl: 'https://www.cubocriativo3d.com.br/meus-pedidos?pedido=12345678-abcd',
  });

  assert.match(mail.subject, /Pedido confirmado — 12345678/);
  assert.match(mail.html, /Cliente Teste/);
  assert.match(mail.html, /Cartão de crédito/);
  assert.match(mail.html, /Acompanhar meu pedido/);
  assert.match(mail.html, /meus-pedidos\?pedido=12345678-abcd/);
  assert.match(mail.html, /images\/logo\.png/);
  assert.doesNotMatch(mail.html, /WhatsApp:<\/b>\s*<\/div>/);
});

test('e-mail de status exibe status, resumo, rastreio e transportadora', () => {
  const mail = renderOrderStatusEmail({
    brandName: 'Cubo Criativo',
    orderId: 'abcdefgh-1234',
    customerName: 'Maria',
    nextStatus: 'enviado',
    notificationKind: 'tracking',
    shippingTracking: 'AB123456789BR',
    shippingCarrier: 'correios',
    trackingUrl: 'https://rastreamento.correios.com.br/',
    total: 99.9,
    paymentMethod: 'Pix',
    siteUrl: 'https://www.cubocriativo3d.com.br',
  });

  assert.match(mail.subject, /Rastreio atualizado/);
  assert.match(mail.html, /AB123456789BR/);
  assert.match(mail.html, /Correios/);
  assert.match(mail.html, /Resumo do pedido/);
  assert.match(mail.html, /Acompanhar entrega/);
});

test('lembrete Pix e pedido manual usam o mesmo padrão visual', () => {
  const pix = renderPixReminderEmail({
    brandName: 'Cubo Criativo',
    orderId: 'pix12345',
    customerName: 'João',
    total: 25,
    paymentUrl: 'https://pagamento.example/pix',
    siteUrl: 'https://www.cubocriativo3d.com.br',
  });
  const manual = renderManualOrderPaymentEmail({
    brandName: 'Cubo Criativo',
    orderId: 'man12345',
    customerName: 'João',
    total: 25,
    paymentUrl: 'https://pagamento.example/manual',
    siteUrl: 'https://www.cubocriativo3d.com.br',
    items: [{ name: 'Ranger', qty: 1, price: 25 }],
  });

  for (const mail of [pix, manual]) {
    assert.match(mail.html, /Cubo Criativo/);
    assert.match(mail.html, /email-card/);
    assert.match(mail.html, /Visitar o site/);
  }
  assert.match(pix.html, /Abrir pagamento Pix/);
  assert.match(manual.html, /Pagar meu pedido/);
});

test('e-mail de entrega abre a área exata de avaliação do pedido', () => {
  const mail = renderOrderStatusEmail({
    brandName: 'Cubo Criativo',
    orderId: '11111111-2222-4333-8444-555555555555',
    customerName: 'Cliente',
    nextStatus: 'entregue',
    orderType: 'shop',
    siteUrl: 'https://www.cubocriativo3d.com.br',
    orderUrl: 'https://www.cubocriativo3d.com.br/meus-pedidos?pedido=11111111-2222-4333-8444-555555555555',
    reviewUrl: 'https://www.cubocriativo3d.com.br/avaliar-pedido?pedido=11111111-2222-4333-8444-555555555555',
  });

  assert.match(mail.html, /avaliar-pedido\?pedido=11111111-2222-4333-8444-555555555555/);
  assert.match(mail.html, />Avaliar pedido</);
  assert.match(mail.html, /meus-pedidos\?pedido=11111111-2222-4333-8444-555555555555/);
});

test('e-mail VIP usa Área VIP e avaliação dedicada nas etapas corretas', () => {
  const production = renderOrderStatusEmail({
    orderId: 'vip-order',
    nextStatus: 'em_producao',
    orderType: 'vip',
    siteUrl: 'https://www.cubocriativo3d.com.br',
    vipAreaUrl: 'https://www.cubocriativo3d.com.br/area-vip',
    reviewUrl: 'https://www.cubocriativo3d.com.br/avaliar-pedido?pedido=vip-order',
  });
  const delivered = renderOrderStatusEmail({
    orderId: 'vip-order',
    nextStatus: 'entregue',
    orderType: 'vip',
    siteUrl: 'https://www.cubocriativo3d.com.br',
    vipAreaUrl: 'https://www.cubocriativo3d.com.br/area-vip',
    reviewUrl: 'https://www.cubocriativo3d.com.br/avaliar-pedido?pedido=vip-order',
  });

  assert.match(production.html, /href="https:\/\/www\.cubocriativo3d\.com\.br\/area-vip"/);
  assert.doesNotMatch(production.html, /avaliar-pedido\?pedido=vip-order/);
  assert.match(delivered.html, /avaliar-pedido\?pedido=vip-order/);
});
