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
  stock: "",
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

export function normalizeProductImageUrls(images, mainImageUrl = "") {
  const candidates = [mainImageUrl, ...(Array.isArray(images) ? images : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(candidates));
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
  const existingImages = normalizeProductImageUrls(row?.images, row?.image_url);

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
    status: row?.status === "estoque" ? "estoque" : "catalogo",
    stock: row?.status === "estoque" && row?.stock != null ? String(Math.max(0, Math.trunc(Number(row.stock) || 0))) : "",
    category: normalizeProductCategory(row?.category || "action figures"),
    tags: Array.isArray(row?.tags) ? row.tags.join(", ") : "",
    sortOrder: String(Number.isFinite(Number(row?.sort_order)) ? Math.trunc(Number(row.sort_order)) : 1000),
    imageUrl: existingImages[0] || "",
    existingImages,
    variants,
    defaultVariantIndex,
  };
}

export function getNormalPriceCents(row) {
  return Number(row?.original_price_cents || row?.price_cents || 0);
}

// Preserve the stored category values used by the existing storefront and shipping.
export function normalizeProductCategory(value) {
  const category = String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/^(chaveiro|chaveiros)$/.test(category)) return 'chaveiros';
  if (/^(brinco|brincos)$/.test(category)) return 'brincos';
  if (/^(action|action figures?|figure action)$/.test(category)) return 'action figures';
  if (/^(rpg|miniaturas?( rpg)?)$/.test(category)) return 'rpg';
  return 'outros';
}

export function moveGalleryKey(keys, from, to) {
  const next = [...keys];
  const source = next.indexOf(from), target = next.indexOf(to);
  if (source < 0 || target < 0 || source === target) return next;
  next.splice(source, 1);
  next.splice(target, 0, from);
  return next;
}

export function orderGalleryItems(items, keys) {
  const byKey = new Map(items.map(item => [item.key, item]));
  const ordered = [];
  for (const key of keys) {
    if (byKey.has(key)) { ordered.push(byKey.get(key)); byKey.delete(key); }
  }
  return [...ordered, ...byKey.values()];
}

export function parseProductStock(status, value) {
  if (status !== 'estoque') return null;
  const stock = Number(value);
  if (String(value ?? '').trim() === '' || !Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647) {
    throw new Error('Informe uma quantidade inteira de estoque, igual ou maior que zero.');
  }
  return stock;
}
