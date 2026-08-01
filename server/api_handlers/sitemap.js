import { supabaseAdmin } from "../supabase.js";
import { buildSitemapXml } from "../sitemapXml.js";

async function fetchProducts() {
  const sb = supabaseAdmin();

  let response = await sb
    .from("products")
    .select("slug,name,created_at,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  // Compatibilidade com bancos antigos que ainda não tenham a coluna updated_at.
  if (response.error) {
    response = await sb
      .from("products")
      .select("slug,name,created_at")
      .eq("active", true)
      .order("created_at", { ascending: false });
  }

  if (response.error) throw response.error;
  return Array.isArray(response.data) ? response.data : [];
}

export default async function handleSitemap(req, res) {
  if (!req || !res) return;

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    // Mantém o sitemap institucional disponível mesmo se o banco estiver temporariamente indisponível.
    console.error("sitemap products error", error);
  }

  const xml = buildSitemapXml(products);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");

  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).send(xml);
}
