export const PRODUCT_RETURN_STATE_KEY = "cc_product_return_state_v1";
export const SCROLL_RESTORE_KEY = "cc_scroll_restore_v1";
export const SPA_HISTORY_STATE_KEY = "cc_spa_navigation";

function normalizeClientPath(path) {
  if (typeof window === "undefined") return String(path || "/");
  try {
    const url = new URL(String(path || "/"), window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
  } catch {
    const value = String(path || "/");
    return value.startsWith("/") ? value : `/${value}`;
  }
}

export function currentClientPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
}

export function navigateClient(path, { replace = false, state = {} } = {}) {
  if (typeof window === "undefined") return;
  const normalized = normalizeClientPath(path);
  const nextState = {
    ...(state && typeof state === "object" ? state : {}),
    [SPA_HISTORY_STATE_KEY]: true,
  };
  const method = replace ? "replaceState" : "pushState";
  window.history[method](nextState, "", normalized);
  try {
    window.dispatchEvent(new PopStateEvent("popstate", { state: nextState }));
  } catch {
    window.dispatchEvent(new Event("popstate"));
  }
}

export function isSpaHistoryEntry() {
  if (typeof window === "undefined") return false;
  return Boolean(window.history.state?.[SPA_HISTORY_STATE_KEY]);
}

export function saveProductReturnState(targetPath = "") {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      path: currentClientPath(),
      targetPath: targetPath ? normalizeClientPath(targetPath) : "",
      scrollY: Number(window.scrollY || window.pageYOffset || 0) || 0,
      at: Date.now(),
    };
    window.sessionStorage.setItem(PRODUCT_RETURN_STATE_KEY, JSON.stringify(payload));
  } catch {}
}

export function readProductReturnState({ maxAgeMs = 2 * 60 * 60 * 1000 } = {}) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PRODUCT_RETURN_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.path) return null;
    if (data.at && Date.now() - Number(data.at) > maxAgeMs) {
      window.sessionStorage.removeItem(PRODUCT_RETURN_STATE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearProductReturnState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PRODUCT_RETURN_STATE_KEY);
  } catch {}
}

export function queueScrollRestore(path, scrollY) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SCROLL_RESTORE_KEY,
      JSON.stringify({
        path: normalizeClientPath(path),
        scrollY: Number(scrollY || 0) || 0,
      })
    );
  } catch {}
}

export function consumeScrollRestore(path = currentClientPath()) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || normalizeClientPath(data.path) !== normalizeClientPath(path)) return null;
    window.sessionStorage.removeItem(SCROLL_RESTORE_KEY);
    return data;
  } catch {
    return null;
  }
}
