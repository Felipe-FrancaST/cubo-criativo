// Util simples para enriquecer itens do pedido com nome/imagem.
// O catálogo do site fica em src/data/produtos.js (local) — usamos ele
// como fallback quando o banco não armazena snapshot de nome/imagem.

import { produtos } from "../src/data/produtos.js";

const byId = new Map();
for (const p of Array.isArray(produtos) ? produtos : []) {
  if (p?.id) byId.set(String(p.id), p);
}

export function getProductInfo(productId) {
  const pid = String(productId || "").trim();
  if (!pid) return null;
  const p = byId.get(pid);
  if (!p) return null;
  return {
    id: String(p.id),
    name: String(p.nome || "").trim() || "Produto",
    img: String(p.img || "").trim(),
  };
}
