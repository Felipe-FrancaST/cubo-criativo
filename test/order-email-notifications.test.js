import test from 'node:test';
import assert from 'node:assert/strict';

import { decideOrderEmailNotification } from '../server/orderEmailNotifications.js';

test('envia e-mail quando o status realmente muda', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'recebido' },
    patch: { production_status: 'em_producao' },
  });
  assert.equal(result.shouldSend, true);
  assert.equal(result.kind, 'status');
  assert.equal(result.status, 'em_producao');
});

test('não envia e-mail repetido quando o status é salvo sem alteração', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'em_producao' },
    patch: { production_status: 'em_producao' },
  });
  assert.equal(result.shouldSend, false);
});

test('envia atualização quando rastreio muda em pedido enviado', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'enviado', shipping_tracking: 'ANTIGO' },
    patch: { shipping_tracking: 'NOVO' },
  });
  assert.equal(result.shouldSend, true);
  assert.equal(result.kind, 'tracking');
});

test('envia atualização quando a previsão muda durante produção', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'em_producao', production_eta: '10 dias' },
    patch: { production_eta: '15 dias' },
    productionEta: '15 dias',
  });
  assert.equal(result.shouldSend, true);
  assert.equal(result.kind, 'eta');
});

test('não envia atualização de previsão fora de produção', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'recebido', production_eta: '' },
    patch: { production_eta: '15 dias' },
    productionEta: '15 dias',
  });
  assert.equal(result.shouldSend, false);
});

test('envia atualização quando a transportadora muda com o mesmo rastreio', () => {
  const result = decideOrderEmailNotification({
    currentOrder: { production_status: 'enviado', shipping_tracking: 'CODIGO', shipping_carrier: 'correios' },
    patch: { shipping_tracking: 'CODIGO', shipping_carrier: 'jadlog' },
  });
  assert.equal(result.shouldSend, true);
  assert.equal(result.kind, 'tracking');
  assert.equal(result.carrierChanged, true);
});
