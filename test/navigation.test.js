import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPA_HISTORY_STATE_KEY,
  currentClientPath,
  isSpaHistoryEntry,
  navigateClient,
  readProductReturnState,
  saveProductReturnState,
} from '../src/lib/navigation.js';
import { readFile } from 'node:fs/promises';

function makeSessionStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

function installWindow(path = '/catalogo?tipo=rpg') {
  const origin = 'https://www.cubocriativo3d.com.br';
  const updateLocation = (next) => {
    const url = new URL(next, origin);
    fakeWindow.location = {
      origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    };
  };
  const fakeWindow = {
    location: null,
    scrollY: 420,
    pageYOffset: 420,
    sessionStorage: makeSessionStorage(),
    history: {
      state: null,
      pushState(state, _title, next) { this.state = state; updateLocation(next); },
      replaceState(state, _title, next) { this.state = state; updateLocation(next); },
    },
    dispatchEvent() {},
  };
  updateLocation(path);
  globalThis.window = fakeWindow;
  return fakeWindow;
}

test('navegação de produto permanece na SPA e guarda a posição de retorno', () => {
  const fakeWindow = installWindow();
  saveProductReturnState('/p/ranger-do-norte');
  navigateClient('/p/ranger-do-norte');

  assert.equal(currentClientPath(), '/p/ranger-do-norte');
  assert.equal(fakeWindow.history.state[SPA_HISTORY_STATE_KEY], true);
  assert.equal(isSpaHistoryEntry(), true);

  const saved = readProductReturnState();
  assert.equal(saved.path, '/catalogo?tipo=rpg');
  assert.equal(saved.targetPath, '/p/ranger-do-norte');
  assert.equal(saved.scrollY, 420);

  delete globalThis.window;
});

test('código trata chunks antigos e evita restaurar documento antigo no botão voltar', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/components/ProductCard.jsx', import.meta.url), 'utf8');
  const lazyHelper = await readFile(new URL('../src/lib/lazyWithReload.js', import.meta.url), 'utf8');
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(card, /event\.preventDefault\(\)[\s\S]*navigateClient\(`\/p\/\$\{p\.slug\}`\)/);
  assert.match(app, /isSpaHistoryEntry\(\)[\s\S]*window\.history\.back\(\)/);
  assert.match(app, /navigate\(returnState\.path, \{ replace: true, preserveScroll: true \}\)/);
  assert.match(app, /lazyWithReload\(\(\) => import\("\.\/pages\/HomePage\.jsx"\)\)/);
  assert.match(lazyHelper, /failed to fetch dynamically imported module/i);
  assert.match(lazyHelper, /window\.location\.reload\(\)/);
  assert.match(indexHtml, /id="stale-build-recovery"/);
  assert.match(indexHtml, /cc_refresh/);
});

test('Vercel não mantém HTML de produto em cache após um novo deploy', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const productRule = (config.headers || []).find((item) => item.source === '/p/(.*)');
  const assetsRule = (config.headers || []).find((item) => item.source === '/assets/(.*)');

  assert.ok(productRule?.headers?.some((header) => header.key === 'Cache-Control' && /no-store/i.test(header.value)));
  assert.ok(assetsRule?.headers?.some((header) => header.key === 'Cache-Control' && /immutable/i.test(header.value)));
});
