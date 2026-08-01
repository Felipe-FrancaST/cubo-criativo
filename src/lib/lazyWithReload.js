import React from "react";

const RELOAD_KEY = "cc_stale_chunk_reload_v1";
const RELOAD_COOLDOWN_MS = 60_000;

export function isDynamicImportFailure(error) {
  const message = String(error?.message || error || "");
  return /failed to fetch dynamically imported module|failed to fetch module script|importing a module script failed|chunkloaderror|loading chunk|expected a javascript-or-wasm module script/i.test(message);
}

function canReloadNow() {
  if (typeof window === "undefined") return false;
  try {
    const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    return !lastReload || Date.now() - lastReload > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function rememberReload() {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {}
}

export function clearDynamicImportReloadGuard() {
  if (typeof window === "undefined") return;
  try {
    const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (lastReload && Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
      window.sessionStorage.removeItem(RELOAD_KEY);
    }
  } catch {}
}

/**
 * React.lazy com recuperação para deploy novo enquanto uma aba antiga continua aberta.
 * Nessa situação, o navegador pode pedir um chunk com hash antigo que já não existe.
 */
export function lazyWithReload(importer) {
  return React.lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (isDynamicImportFailure(error) && canReloadNow()) {
        rememberReload();
        window.location.reload();
        // Mantém o lazy pendente enquanto o navegador recarrega a versão atual.
        return await new Promise(() => {});
      }
      throw error;
    }
  });
}
