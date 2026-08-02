import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeSeasonalSettings,
  SEASONAL_INTENSITY,
  SEASONAL_THEME,
  seasonalThemeLabel,
} from '../src/lib/seasonalTheme.js';

test('normaliza os cinco temas e configurações visuais', () => {
  const settings = normalizeSeasonalSettings({
    enabled: true,
    theme: SEASONAL_THEME.SAO_JOAO,
    intensity: SEASONAL_INTENSITY.FESTIVE,
    animations_enabled: false,
  });

  assert.equal(settings.enabled, true);
  assert.equal(settings.theme, 'sao_joao');
  assert.equal(settings.intensity, 'festive');
  assert.equal(settings.animations_enabled, false);
  assert.equal(seasonalThemeLabel(SEASONAL_THEME.HALLOWEEN), 'Halloween');
});

test('decorações são públicas, mas alterações exigem proprietário', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const adminApi = await readFile(new URL('../api/admin.js', import.meta.url), 'utf8');
  const coreApi = await readFile(new URL('../api/core.js', import.meta.url), 'utf8');
  const adminPage = await readFile(new URL('../src/pages/AdminOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(app, /<SeasonalDecorations route=\{route\}/);
  assert.match(adminApi, /handleSeasonalTheme[\s\S]*requireAdmin\(req, ADMIN_LEVEL\.OWNER\)/);
  assert.match(coreApi, /'seasonal-theme': handleSeasonalTheme/);
  assert.match(adminPage, /Decorações sazonais/);
});

test('SQL cria configuração única e bloqueia escrita direta do navegador', async () => {
  const sql = await readFile(new URL('../SQL_DECORACOES_SAZONAIS.sql', import.meta.url), 'utf8');

  assert.match(sql, /create table if not exists public\.site_seasonal_theme/i);
  assert.match(sql, /check \(theme in \('christmas', 'sao_joao', 'easter', 'halloween', 'carnival'\)\)/i);
  assert.match(sql, /revoke all on table public\.site_seasonal_theme from anon, authenticated/i);
  assert.match(sql, /grant all on table public\.site_seasonal_theme to service_role/i);
});


test('decoração fica concentrada no topo e não acompanha a rolagem', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const component = await readFile(new URL('../src/components/SeasonalDecorations.jsx', import.meta.url), 'utf8');

  const overlayBlock = css.match(/\.seasonal-decorations--overlay\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(overlayBlock, /position:\s*absolute/i);
  assert.doesNotMatch(overlayBlock, /position:\s*fixed/i);
  assert.match(css, /seasonal-edge-float/);
  assert.match(component, /seasonal-emblem/);
  assert.match(component, /seasonal-particles--\$\{side\}/);
  assert.match(component, /<EdgeParticles side="left"/);
  assert.match(component, /<EdgeParticles side="right"/);
});
