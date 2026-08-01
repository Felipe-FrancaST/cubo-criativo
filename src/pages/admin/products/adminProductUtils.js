export const EMPTY_PRODUCT_FORM = {
  id: "",
  name: "",
  slug: "",
  description: "",
  normalPrice: "",
  promo: false,
  promoPrice: "",
  featured: false,
  active: true,
  status: "catalogo",
  stock: "999",
  category: "action figures",
  tags: "",
  sortOrder: "1000",
  imageUrl: "",
  existingImages: [],
  variants: [],
  defaultVariantIndex: 0,
};

export function createEmptyProductForm() {
  return {
    ...EMPTY_PRODUCT_FORM,
    existingImages: [],
    variants: [],
  };
}

export function slugifyProduct(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function safeImageFileName(value = "produto.jpg") {
  const raw = String(value || "produto.jpg").split(/[\\/]/).pop() || "produto.jpg";
  const dot = raw.lastIndexOf(".");
  const extension = dot >= 0 ? raw.slice(dot + 1).toLowerCase() : "jpg";
  const base = dot >= 0 ? raw.slice(0, dot) : raw;
  const safeBase = slugifyProduct(base) || "produto";
  const safeExtension = ["jpg", "jpeg", "png", "webp", "avif"].includes(extension) ? extension : "jpg";
  return `${safeBase}.${safeExtension}`;
}

export function parseBrlToCents(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

export function centsToInput(value) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatCents(value) {
  const cents = Number(value || 0);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function splitTags(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 30);
}

export function productRowToForm(row) {
  const promo = Boolean(row?.promo);
  const normalPriceCents = Number(row?.original_price_cents || row?.price_cents || 0);
  const promoPriceCents = promo ? Number(row?.price_cents || 0) : 0;
  const variants = Array.isArray(row?.variants)
    ? row.variants
        .filter(Boolean)
        .map((variant) => ({
          label: String(variant?.label || ""),
          price: centsToInput(variant?.price_cents),
        }))
        .filter((variant) => variant.label || variant.price)
    : [];
  const savedDefaultVariant = String(row?.default_variant || "");
  const matchingDefaultIndex = variants.findIndex((variant) => variant.label === savedDefaultVariant);
  const defaultVariantIndex = variants.length ? (matchingDefaultIndex >= 0 ? matchingDefaultIndex : 0) : 0;
  const defaultVariantPrice = variants[defaultVariantIndex]?.price || "";

  return {
    id: String(row?.id || ""),
    name: String(row?.name || ""),
    slug: String(row?.slug || ""),
    description: String(row?.description || ""),
    normalPrice: defaultVariantPrice || centsToInput(normalPriceCents),
    promo,
    promoPrice: centsToInput(promoPriceCents),
    featured: Boolean(row?.featured),
    active: row?.active !== false,
    status: String(row?.status || "catalogo"),
    stock: String(Number.isFinite(Number(row?.stock)) ? Math.max(0, Math.trunc(Number(row.stock))) : 999),
    category: String(row?.category || "action figures"),
    tags: Array.isArray(row?.tags) ? row.tags.join(", ") : "",
    sortOrder: String(Number.isFinite(Number(row?.sort_order)) ? Math.trunc(Number(row.sort_order)) : 1000),
    imageUrl: String(row?.image_url || ""),
    existingImages: Array.isArray(row?.images)
      ? row.images.filter(Boolean).map(String)
      : (row?.image_url ? [String(row.image_url)] : []),
    variants,
    defaultVariantIndex,
  };
}

export function getNormalPriceCents(row) {
  return Number(row?.original_price_cents || row?.price_cents || 0);
}
