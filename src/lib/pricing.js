// src/lib/pricing.js

// Formata número (BRL) no padrão pt-BR.
export const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

// Determina se o produto está em promoção com dados completos.
export function isPromoActive(p) {
  const original = Number(p?.originalPriceCents ?? 0);
  const current = Number(p?.priceCents ?? 0);
  return !!p?.promo && original > 0 && current > 0 && current < original;
}

// Aplica o mesmo % de desconto do produto (price_cents/original_price_cents)
// em cima do preço da variante (assumindo que variants[].price_cents refletem o "preço cheio").
export function applyPromoToVariantCents(p, variantPriceCents) {
  const base = Number(variantPriceCents ?? 0);
  if (!(base > 0)) return 0;
  if (!isPromoActive(p)) return base;
  const original = Number(p.originalPriceCents);
  const current = Number(p.priceCents);
  const ratio = current / original;
  return Math.max(0, Math.round(base * ratio));
}

export function centsToBRL(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return Number((n / 100).toFixed(2));
}

export function percentOffCents(originalCents, currentCents) {
  const o = Number(originalCents);
  const c = Number(currentCents);
  if (!(o > 0) || !(c > 0) || o <= c) return 0;
  return Math.round(((o - c) / o) * 100);
}

// Retorna preços (centavos) já considerando variante selecionada.
export function getVariantPricingCents(p, selIndex = 0, defaultIndex = 0) {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const hasVariants = variants.length > 0;
  const preferredIndex = Number.isInteger(defaultIndex) ? defaultIndex : 0;
  const requestedIndex = Number.isInteger(selIndex) ? selIndex : preferredIndex;
  const safeIndex = hasVariants ? Math.min(Math.max(0, requestedIndex), variants.length - 1) : 0;
  const sel = hasVariants ? variants[safeIndex] : null;

  const baseVariantCents = hasVariants
    ? Number(sel?.priceCents ?? 0)
    : Number(p?.priceCents ?? 0);

  // preço atual: aplica promo proporcional em cima do preço da variante
  // (assumindo variants com preço cheio)
  let currentCents = hasVariants ? applyPromoToVariantCents(p, baseVariantCents) : Number(p?.priceCents ?? 0);

  // fallback: se não tem variants e promo, current já é p.priceCents
  // original (para riscar):
  const originalCents = hasVariants
    ? baseVariantCents
    : Number(p?.originalPriceCents ?? 0);

  // Se promo não está ativa, não risca.
  const showStrike = isPromoActive(p);
  return {
    hasVariants,
    sel,
    selIndex: safeIndex,
    baseVariantCents,
    currentCents,
    originalCents: showStrike ? originalCents : 0,
    showStrike,
  };
}
