export const PRODUCT_RETURN_STATE_KEY = "cc_product_return_state_v1";
export const SCROLL_RESTORE_KEY = "cc_scroll_restore_v1";

export function saveProductReturnState() {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      path: `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`,
      scrollY: Number(window.scrollY || window.pageYOffset || 0) || 0,
      at: Date.now(),
    };
    window.sessionStorage.setItem(PRODUCT_RETURN_STATE_KEY, JSON.stringify(payload));
  } catch {}
}

export function readProductReturnState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PRODUCT_RETURN_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.path) return null;
    return data;
  } catch {
    return null;
  }
}

export function queueScrollRestore(path, scrollY) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SCROLL_RESTORE_KEY, JSON.stringify({ path, scrollY: Number(scrollY || 0) || 0 }));
  } catch {}
}

export function consumeScrollRestore(pathname) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.path !== pathname) return null;
    window.sessionStorage.removeItem(SCROLL_RESTORE_KEY);
    return data;
  } catch {
    return null;
  }
}
