import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

function assertReady() {
  if (!fs.existsSync(DIST)) {
    throw new Error("[prerender] dist/ não encontrado. Rode 'vite build' antes.");
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const message =
      "[prerender] Variáveis faltando: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (use .env ou variáveis no deploy).";
    if (process.env.VERCEL) throw new Error(message);
    console.warn(`${message} Pré-renderização ignorada apenas neste build local.`);
    return false;
  }
  return true;
}

function slugifySafe(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function truncate(s, n = 155) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.toUpperCase() === "EMPTY") return "";
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + "…";
}

function normalizeDescription(v) {
  if (v === null || v === undefined) return "";
  const s = String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.toUpperCase() === "EMPTY") return "";
  return s;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

async function fetchProducts() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/products`);
  endpoint.searchParams.set(
    "select",
    [
      "id",
      "slug",
      "name",
      "description",
      "price_cents",
      "currency",
      "stock",
      "active",
      "image_url",
      "category",
      "tags",
      "created_at",
      "updated_at",
    ].join(",")
  );
  endpoint.searchParams.set("active", "eq.true");
  endpoint.searchParams.set("order", "created_at.desc");

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: "application/json",
  };

  let res = await fetch(endpoint, { headers });

  // Compatibilidade com bancos que ainda não possuam a coluna updated_at.
  if (!res.ok && res.status === 400) {
    endpoint.searchParams.set(
      "select",
      [
        "id",
        "slug",
        "name",
        "description",
        "price_cents",
        "currency",
        "stock",
        "active",
        "image_url",
        "category",
        "tags",
        "created_at",
      ].join(",")
    );
    res = await fetch(endpoint, { headers });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[prerender] Falha ao buscar produtos: ${res.status} ${res.statusText} ${txt}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function buildProductJsonLd({ origin, p, urlPath }) {
  const price = Number.isFinite(Number(p?.price_cents)) ? Number(p.price_cents) / 100 : 0;
  const inStock = p?.stock === null || p?.stock === undefined ? true : Number(p.stock) > 0;
  const imageRaw = p?.image_url ? String(p.image_url) : "";
  const image = imageRaw
    ? (/^https?:\/\//i.test(imageRaw) ? imageRaw : `${origin}${imageRaw.startsWith("/") ? imageRaw : `/${imageRaw}`}`)
    : undefined;
  const category = p?.category || (Array.isArray(p?.tags) && p.tags[0]) || "Miniatura";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: String(p?.name || "Produto"),
    description: String(p?.description || "Miniatura em resina e pintura artística."),
    image: image ? [image] : undefined,
    sku: String(p?.id || ""),
    category,
    brand: { "@type": "Brand", name: "Cubo Criativo" },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: price.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${origin}${urlPath}`,
    },
  };
}

function injectMeta(baseHtml, { title, description, canonicalUrl, image, jsonLd }) {
  let html = baseHtml;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // description: substitui o bloco inteiro (funciona mesmo se for multiline)
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?content="[\s\S]*?"\s*\/>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );

  const upserts = [
    { sel: /<meta\s+property="og:title"[\s\S]*?\/>/i, tag: `<meta property="og:title" content="${escapeHtml(title)}" />` },
    {
      sel: /<meta\s+property="og:description"[\s\S]*?\/>/i,
      tag: `<meta property="og:description" content="${escapeHtml(description)}" />`,
    },
    { sel: /<meta\s+property="og:image"[\s\S]*?\/>/i, tag: `<meta property="og:image" content="${escapeHtml(image)}" />` },
    { sel: /<meta\s+name="twitter:title"[\s\S]*?\/>/i, tag: `<meta name="twitter:title" content="${escapeHtml(title)}" />` },
    {
      sel: /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
      tag: `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    },
    { sel: /<meta\s+name="twitter:image"[\s\S]*?\/>/i, tag: `<meta name="twitter:image" content="${escapeHtml(image)}" />` },
  ];
  for (const u of upserts) {
    if (html.match(u.sel)) html = html.replace(u.sel, u.tag);
    else html = html.replace("</head>", `  ${u.tag}\n</head>`);
  }

  if (html.match(/<link\s+rel="canonical"[\s\S]*?\/>/i)) {
    html = html.replace(
      /<link\s+rel="canonical"[\s\S]*?href="[\s\S]*?"\s*\/>/i,
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
    );
  } else {
    html = html.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n</head>`);
  }

  if (jsonLd) {
    // IMPORTANT: JSON-LD dentro de <script type="application/ld+json"> NÃO deve ser HTML-escaped.
    // Se escapar aspas (&quot;), o Google acusa erro de sintaxe.
    // Para evitar quebrar o HTML (ex: fechar </script>), escapamos apenas caracteres perigosos como '<'.
    const jsonText = JSON.stringify(jsonLd)
      .replace(/</g, "\\u003c")
      .replace(/-->/g, "--\\u003e")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    const script = `<script type="application/ld+json">${jsonText}</script>`;
    html = html.replace("</head>", `  ${script}\n</head>`);
  }

  return html;
}

async function main() {
  if (!assertReady()) return;
  const baseHtml = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

  const origin = "https://www.cubocriativo3d.com.br";
  const products = await fetchProducts();

  let rendered = 0;
  for (const row of products) {
    const slug = row?.slug ? String(row.slug) : slugifySafe(row?.name);
    if (!slug) continue;

    const urlPath = `/p/${slug}`;
    const title = `${String(row?.name || "Produto")} | Cubo Criativo`;
    const description =
      truncate(normalizeDescription(row?.description), 155) ||
      "Miniatura em resina com pintura artística. Peça colecionável com envio para todo o Brasil.";
    const imageRaw = row?.image_url ? String(row.image_url) : "/images/logo.png";
    const image = /^https?:\/\//i.test(imageRaw) ? imageRaw : `${origin}${imageRaw.startsWith("/") ? imageRaw : `/${imageRaw}`}`;
    const canonicalUrl = `${origin}${urlPath}`;

    const jsonLd = buildProductJsonLd({ origin, p: row, urlPath });
    const html = injectMeta(baseHtml, { title, description, canonicalUrl, image, jsonLd });

    writeFile(path.join(DIST, "p", slug, "index.html"), html);
    rendered++;
  }

  console.log(`[prerender] páginas de produto geradas: ${rendered}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
