/**
 * Vercel Serverless Function
 * Route: /api/get-pix-payment
 *
 * Retorna os dados do Pix (QR / copia-e-cola / link) de um pedido existente,
 * permitindo que o cliente reabra a tela de pagamento na aba "Pedidos".
 *
 * Body: { order_id: string }
 *
 * Env vars:
 * - MP_ACCESS_TOKEN=...
 * - SUPABASE_URL=...
 * - SUPABASE_SERVICE_ROLE_KEY=...
 * - SUPABASE_ANON_KEY=...
 */

import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";

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

async function mpFetch(token, url) {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

function mapOrderStatus(mpStatus) {
  if (mpStatus === "approved") return "paid";
  if (
    mpStatus === "rejected" ||
    mpStatus === "cancelled" ||
    mpStatus === "refunded" ||
    mpStatus === "charged_back"
  )
    return "failed";
  return "pending";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!token) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Faça login para ver o Pix." });

    const body = safeBody(req);
    const orderId = String(body.order_id || "").trim();
    if (!orderId) return res.status(400).json({ error: "Missing order_id" });

    const sb = supabaseAdmin();
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("id,user_id,status,payment_provider,provider_payment_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) return res.status(500).json({ error: "Supabase error", details: orderErr });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.user_id !== user.id) return res.status(403).json({ error: "Sem permissão para este pedido" });

    const paymentId = String(order.provider_payment_id || "").trim();
    if (!paymentId) return res.status(400).json({ error: "Pedido sem provider_payment_id" });

    const paymentResp = await mpFetch(token, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`);
    if (!paymentResp.ok) {
      return res
        .status(paymentResp.status || 500)
        .json({ error: paymentResp.data || { message: "Mercado Pago error" } });
    }

    const mp = paymentResp.data || {};
    const mpStatus = String(mp.status || "");
    const mapped = mapOrderStatus(mpStatus);

    // best-effort: sincroniza status
    try {
      await sb
        .from("orders")
        .update({
          status: mapped,
          payment_provider: "mercado_pago",
          provider_payment_id: String(mp.id || paymentId),
        })
        .eq("id", orderId);
    } catch {
      // ignore
    }

    const tx = mp.point_of_interaction?.transaction_data || {};

    return res.status(200).json({
      ok: true,
      order_id: orderId,
      mp_status: mpStatus,
      status: mapped,
      qr_code: tx.qr_code || null,
      qr_code_base64: tx.qr_code_base64 || null,
      ticket_url: tx.ticket_url || null,
    });
  } catch (e) {
    console.error("get-pix-payment error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
