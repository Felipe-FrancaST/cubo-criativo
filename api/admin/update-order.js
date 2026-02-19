/**
 * Admin: atualiza campos operacionais do pedido
 * Route: /api/admin/update-order
 *
 * Body: { order_id, production_status, shipping_tracking }
 */

import { supabaseAdmin } from "../_supabase.js";
import { requireAdmin } from "./_admin.js";

export const config = { runtime: "nodejs" };

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

const ALLOWED_PROD_STATUS = new Set([
  "recebido",
  "em_producao",
  "pronto",
  "enviado",
  "entregue",
  "cancelado",
]);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const body = safeBody(req);
    const order_id = String(body.order_id || "").trim();
    if (!order_id) return res.status(400).json({ error: "Missing order_id" });

    const next = {};
    if (body.production_status !== undefined) {
      const ps = String(body.production_status || "").trim().toLowerCase();
      if (!ALLOWED_PROD_STATUS.has(ps)) {
        return res.status(400).json({ error: "Invalid production_status" });
      }
      next.production_status = ps;
    }

    if (body.shipping_tracking !== undefined) {
      const tr = String(body.shipping_tracking || "").trim();
      next.shipping_tracking = tr || null;
    }

    if (Object.keys(next).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from("orders").update(next).eq("id", order_id);
    if (error) return res.status(500).json({ error: error.message || "Update failed" });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("admin/update-order error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
