import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ADMIN_LEVEL, adminLevelLabel, normalizeAdminLevel } from '../src/lib/admin.js';

test('normaliza e rotula os três níveis administrativos', () => {
  assert.equal(normalizeAdminLevel(1), ADMIN_LEVEL.OPERATOR);
  assert.equal(normalizeAdminLevel(2), ADMIN_LEVEL.MANAGER);
  assert.equal(normalizeAdminLevel(3), ADMIN_LEVEL.OWNER);
  assert.equal(adminLevelLabel(1), 'Operador');
  assert.equal(adminLevelLabel(2), 'Gerente');
  assert.equal(adminLevelLabel(3), 'Proprietário');
});

test('API exige níveis diferentes por tipo de ação', async () => {
  const source = await readFile(new URL('../api/admin.js', import.meta.url), 'utf8');
  assert.match(source, /handleManualOrderCreate[\s\S]*requireAdmin\(req, ADMIN_LEVEL\.OPERATOR\)/);
  assert.match(source, /handleClients[\s\S]*requireAdmin\(req, ADMIN_LEVEL\.MANAGER\)/);
  assert.match(source, /handleSetAdminLevel[\s\S]*requireAdmin\(req, ADMIN_LEVEL\.OWNER\)/);
  assert.match(source, /último proprietário não pode ser removido ou rebaixado/i);
});

test('SQL cria níveis, histórico e políticas de gerente', async () => {
  const sql = await readFile(new URL('../SQL_NIVEIS_ADMIN.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column admin_level smallint/i);
  assert.match(sql, /create table if not exists public\.admin_audit_logs/i);
  assert.match(sql, /current_admin_level\(\) >= 2/i);
  assert.match(sql, /current_admin_level\(\) >= 3/i);
});
