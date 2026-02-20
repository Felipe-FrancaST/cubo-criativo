// api/cancel-order.js
import { getUserFromAuthHeader, supabaseAdmin } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Faça login." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const orderId = String(body.order_id || "").trim();
    if (!orderId) return res.status(400).json({ error: "Missing order_id" });

    // Para status != "recebido", exigimos confirmação explícita no body.
    const confirm = !!body.confirm;
    const refundMode = String(body.refund_mode || "").toLowerCase();

    const sb = supabaseAdmin();

    const { data: order, error: ordErr } = await sb
      .from("orders")
      .select("id, user_id, status, production_status")
      .eq("id", orderId)
      .maybeSingle();

    if (ordErr) return res.status(500).json({ error: ordErr.message || "DB error" });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.user_id !== user.id) return res.status(403).json({ error: "Sem permissão." });

    const prod = String(order.production_status || "recebido").toLowerCase();

    if (prod === "cancelado") {
      return res.status(200).json({ ok: true, order, refund_mode: refundMode || "info" });
    }

    // Se não for recebido, só cancela com confirmação.
    if (prod !== "recebido" && !confirm) {
      return res.status(409).json({
        error: "Pedido já está em produção. Confirme para prosseguir com o cancelamento.",
        code: "needs_confirmation",
        production_status: prod,
      });
    }

    const newStatus = String(order.status || "").toLowerCase() === "pending" ? "cancelled" : order.status;

    const { data: updated, error: upErr } = await sb
      .from("orders")
      .update({ production_status: "cancelado", status: newStatus })
      .eq("id", orderId)
      .select("id, status, production_status")
      .maybeSingle();

    if (upErr) return res.status(500).json({ error: upErr.message || "Não foi possível cancelar." });

    return res.status(200).json({ ok: true, order: updated, refund_mode: refundMode || (prod === "recebido" ? "full" : "partial") });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}
