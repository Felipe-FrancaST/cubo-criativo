// src/lib/a11y.js
// Helpers pequenos de acessibilidade (sem dependências)

export function getFocusable(container) {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];
  const nodes = Array.from(container.querySelectorAll(selectors.join(',')));
  // ignora elementos invisíveis
  return nodes.filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

export function focusFirst(container) {
  const focusables = getFocusable(container);
  if (focusables.length) {
    focusables[0].focus({ preventScroll: true });
    return true;
  }
  // fallback
  if (container && typeof container.focus === "function") {
    container.focus({ preventScroll: true });
    return true;
  }
  return false;
}

export function handleFocusTrapKeydown(e, container) {
  if (e.key !== "Tab") return;
  const focusables = getFocusable(container);
  if (!focusables.length) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }
}
