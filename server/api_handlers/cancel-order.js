// api/cancel-order.js
import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";
import { renderOrderStatusEmail } from "../emailTemplates.js";
import { rateLimit } from '../rateLimit.js';
import { cleanupOrder3dModel } from '../order3dCleanup.js';
import { buildOrderDetailsUrl, buildReviewUrl, buildVipAreaUrl } from '../orderLinks.js';

async function sendResendEmail({ to, subject, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || '').trim();
  if (!apiKey || !from || !to) return { ok: false, skipped: true };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
  } catch (error) {
    console.error('cancel order email error', error);
    return { ok: false, error: error?.message || String(error) };
  }
}

function buildCancelEmail(kind, order) {
  const brandName = process.env.BRAND_NAME || 'Cubo Criativo';
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.ORDER_EMAIL_TO || '';
  const whatsapp = process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || '';
  const siteUrl = String(process.env.SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  return renderOrderStatusEmail({
    brandName,
    orderId: order?.id,
    customerName: order?.customer_name || '',
    nextStatus: 'cancelado',
    notificationKind: 'status',
    cancelledBy: kind === 'customer' ? 'customer' : 'admin',
    supportEmail,
    whatsapp,
    total: order?.total,
    paymentMethod: order?.payment_provider || '',
    orderType: order?.order_type || 'shop',
    vipPlanId: order?.vip_plan_id || '',
    siteUrl,
    orderUrl: buildOrderDetailsUrl(siteUrl, order?.id),
    reviewUrl: buildReviewUrl(siteUrl, order?.id),
    vipAreaUrl: buildVipAreaUrl(siteUrl),
  });
}

export default async function handler(req, res) {
  
  if (!rateLimit(req, res, { key: 'api:cancel-order', limit: 20, windowMs: 60000 })) return;
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
      .select("id, user_id, status, production_status, customer_email, customer_name, total, payment_provider, order_type, vip_plan_id, refund_requested, refund_requested_at, model_3d_url, model_3d_name")
      .eq("id", orderId)
      .maybeSingle();

    order = attemptNew?.data || null;
    ordErr = attemptNew?.error || null;

    if (ordErr && /refund_requested/i.test(String(ordErr.message || ""))) {
      const attemptOld = await sb
        .from("orders")
        .select("id, user_id, status, production_status, customer_email, customer_name, total, payment_provider, order_type, vip_plan_id")
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
      return res.status(200).json({ ok: true, order: { ...order, refund_requested: true }, refund_mode: refundMode || "info", email: { skipped: true, reason: 'already_cancelled' } });
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

    await cleanupOrder3dModel(sb, order).catch((e) => console.error('order 3d cleanup on customer cancel failed', e));

    // Se o pedido ainda não foi pago, devolve o cupom para novo uso (remove resgate e decrementa used_count)
    try {
      const payStatus = String(order.status || '').toLowerCase();
      const unpaid = ['pending', 'failed', 'cancelled', 'canceled', 'rejected'].includes(payStatus);
      if (unpaid) {
        const { data: reds } = await sb
          .from('coupon_redemptions')
          .select('coupon_code')
          .eq('order_id', orderId);

        const couponCodes = Array.from(new Set((reds || []).map((r) => String(r?.coupon_code || '').trim()).filter(Boolean)));
        if (couponCodes.length) {
          const del = await sb.from('coupon_redemptions').delete().eq('order_id', orderId);
          if (del?.error) console.error('coupon redemption rollback delete error', del.error);

          for (const code of couponCodes) {
            const { data: curr } = await sb.from('coupons').select('used_count').eq('code', code).maybeSingle();
            const nextUsed = Math.max(0, (Number(curr?.used_count) || 0) - 1);
            const upd = await sb.from('coupons').update({ used_count: nextUsed }).eq('code', code);
            if (upd?.error) console.error('coupon use rollback update error', upd.error);
          }
        }
      }
    } catch (rollbackErr) {
      console.error('coupon rollback on cancel error', rollbackErr);
    }
    const cancelMail = buildCancelEmail('customer', { ...order, id: orderId });
    const emailResult = await sendResendEmail({ to: order.customer_email || user.email, subject: cancelMail.subject, html: cancelMail.html });
    try {
      const auditPatch = emailResult?.ok
        ? {
            last_email_type: 'order_status:cancelado',
            last_email_status: 'sent',
            last_email_sent_at: new Date().toISOString(),
            last_email_error: null,
          }
        : {
            last_email_type: 'order_status:cancelado',
            last_email_status: emailResult?.skipped ? 'skipped' : 'failed',
            last_email_error: emailResult?.data?.message || emailResult?.error || null,
          };
      const audit = await sb.from('orders').update(auditPatch).eq('id', orderId);
      if (audit?.error && !/last_email_|column/i.test(String(audit.error.message || ''))) {
        console.error('cancel order email audit error', audit.error);
      }
    } catch (auditError) {
      console.error('cancel order email audit error', auditError);
    }
    return res.status(200).json({ ok: true, order: updated, refund_mode: refundMode, email: emailResult });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}