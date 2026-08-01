const ORIGIN = "https://www.cubocriativo3d.com.br";

const FIXED_PATHS = [
  "/",
  "/estoque",
  "/catalogo",
  "/promocoes",
  "/planos-vip",
  "/cupom",
  "/contato",
  "/sobre",
  "/faq",
  "/trocas-e-devolucoes",
  "/privacy.html",
  "/terms.html",
];

function slugifySafe(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeLastmod(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function buildSitemapXml(products = []) {
  const seen = new Set();
  const urls = FIXED_PATHS.map((path) => ({ path, lastmod: "" }));

  for (const product of products) {
    const slug = String(product?.slug || "").trim() || slugifySafe(product?.name);
    if (!slug) continue;

    const path = `/p/${encodeURIComponent(slug)}`;
    if (seen.has(path)) continue;
    seen.add(path);

    urls.push({
      path,
      lastmod: normalizeLastmod(product?.updated_at || product?.created_at),
    });
  }

  const body = urls
    .map(({ path, lastmod }) => {
      const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(`${ORIGIN}${path}`)}</loc>${lastmodTag}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
