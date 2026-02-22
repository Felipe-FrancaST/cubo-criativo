// api/cancel-order.js
import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";

async function sendResendEmail({to,subject,html}){
  const apiKey=String(process.env.RESEND_API_KEY||"" ).trim(); const from=String(process.env.RESEND_FROM||"" ).trim();
  if(!apiKey||!from||!to) return;
  try { await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})}); } catch {}
}
function cancelEmailHtml(kind,id){
  const title = kind==="customer" ? "Você cancelou seu pedido" : "Pedido cancelado pela loja";
  const msg = kind==="customer" ? "Recebemos sua solicitação de cancelamento. Se houver pagamento, o reembolso será processado." : "A loja cancelou o seu pedido. Se houve pagamento, o reembolso será processado.";
  return `<!doctype html><html><body style=\"margin:0;background:#0b1020;color:#e2e8f0;font-family:Arial,sans-serif\"><div style=\"max-width:620px;margin:24px auto;padding:20px;border-radius:16px;background:#111827;border:1px solid rgba(255,255,255,.08)\"><h2>${title}</h2><p style=\"color:#cbd5e1\">${msg}</p><p style=\"color:#94a3b8\">Pedido #${String(id||'').slice(0,8)}</p></div></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Faça login." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const orderId = String(body.order_id || "").trim();
    if (!orderId) return res.status(400).json({ error: "Missing order_id" });

    // Para alguns status, exigimos confirmação explícita no body.
    const confirm = !!body.confirm;
    const requestedRefundMode = String(body.refund_mode || "").toLowerCase();

    const sb = supabaseAdmin();

    // Compatibilidade: alguns bancos ainda não têm refund_requested/refund_requested_at.
    // Tentamos buscar com as colunas novas; se falhar por coluna inexistente, buscamos sem elas.
    let order = null;
    let ordErr = null;

    const attemptNew = await sb
      .from("orders")
      .select("id, user_id, status, production_status, customer_email, refund_requested, refund_requested_at")
      .eq("id", orderId)
      .maybeSingle();

    order = attemptNew?.data || null;
    ordErr = attemptNew?.error || null;

    if (ordErr && /refund_requested/i.test(String(ordErr.message || ""))) {
      const attemptOld = await sb
        .from("orders")
        .select("id, user_id, status, production_status, customer_email")
        .eq("id", orderId)
        .maybeSingle();
      order = attemptOld?.data || null;
      ordErr = attemptOld?.error || null;
    }

    if (ordErr) return res.status(500).json({ error: ordErr.message || "DB error" });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
    if (order.user_id !== user.id) return res.status(403).json({ error: "Sem permissão." });

    const prod = String(order.production_status || "recebido").toLowerCase();

    // Cancelamento não é permitido após envio/entrega
    if (prod === "enviado") {
      return res.status(409).json({
        error: "Cancelamento não permitido: o pedido já foi enviado.",
        code: "not_allowed_shipped",
        production_status: prod,
      });
    }
    if (prod === "entregue") {
      return res.status(409).json({
        error: "Cancelamento não permitido: o pedido já foi entregue.",
        code: "not_allowed_delivered",
        production_status: prod,
      });
    }

    if (prod === "reembolsado") {
      return res.status(409).json({
        error: "Este pedido já foi reembolsado.",
        code: "already_refunded",
        production_status: prod,
      });
    }

    // Define modo padrão de reembolso com base no status atual
    const defaultRefundMode = prod === "recebido" ? "full" : (prod === "pronto" ? "partial30" : "partial");
    const refundMode = ["full", "partial", "partial30"].includes(requestedRefundMode)
      ? requestedRefundMode
      : defaultRefundMode;

    // Se já está cancelado (talvez cancelado pelo admin), o cliente ainda pode estar solicitando reembolso.
    if (prod === "cancelado") {
      // Se o pedido já está cancelado, marcamos como "reembolso solicitado" quando possível.
      if (order && Object.prototype.hasOwnProperty.call(order, "refund_requested") && !order.refund_requested) {
        const mark = await sb
          .from("orders")
          .update({ refund_requested: true, refund_requested_at: new Date().toISOString() })
          .eq("id", orderId);
        // Se o banco não tem as colunas, ignoramos (sem quebrar o cancelamento).
        if (mark?.error && !/refund_requested/i.test(String(mark.error.message || ""))) {
          return res.status(500).json({ error: mark.error.message || "DB error" });
        }
      }
      await sendResendEmail({ to: order.customer_email, subject: `Cancelamento recebido — Pedido ${String(orderId).slice(0,8)}`, html: cancelEmailHtml("customer", orderId) });
      return res.status(200).json({ ok: true, order: { ...order, refund_requested: true }, refund_mode: refundMode || "info" });
    }

    // Se não for recebido, só cancela com confirmação.
    if (prod !== "recebido" && !confirm) {
      return res.status(409).json({
        error:
          prod === "pronto"
            ? "Pedido já está pronto. Confirme para prosseguir com o cancelamento. O estorno será de 30% do valor."
            : "Pedido já está em produção. Confirme para prosseguir com o cancelamento.",
        code: "needs_confirmation",
        production_status: prod,
      });
    }

    const newStatus = String(order.status || "").toLowerCase() === "pending" ? "cancelled" : order.status;

    // Primeiro: tenta atualizar incluindo as colunas de reembolso.
    const attemptUpdateNew = await sb
      .from("orders")
      .update({
        production_status: "cancelado",
        status: newStatus,
        refund_requested: true,
        refund_requested_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("id, status, production_status, refund_requested, refund_requested_at")
      .maybeSingle();

    let updated = attemptUpdateNew?.data || null;
    let upErr = attemptUpdateNew?.error || null;

    // Fallback: se as colunas não existem ainda, faz update sem elas.
    if (upErr && /refund_requested/i.test(String(upErr.message || ""))) {
      const attemptUpdateOld = await sb
        .from("orders")
        .update({
          production_status: "cancelado",
          status: newStatus,
        })
        .eq("id", orderId)
        .select("id, status, production_status")
        .maybeSingle();
      updated = attemptUpdateOld?.data || null;
      upErr = attemptUpdateOld?.error || null;
    }

    if (upErr) return res.status(500).json({ error: upErr.message || "Não foi possível cancelar." });

    await sendResendEmail({ to: order.customer_email, subject: `Pedido cancelado — ${String(orderId).slice(0,8)}`, html: cancelEmailHtml("customer", orderId) });
    return res.status(200).json({ ok: true, order: updated, refund_mode: refundMode });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}
