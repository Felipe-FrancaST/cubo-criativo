/**
 * Vercel Serverless Function
 * Route: /api/mp-webhook
 *
 * Webhook do Mercado Pago.
 * - Busca o pagamento e, quando estiver APPROVED, envia email via Resend.
 * - Faz uma tentativa de idempotência marcando metadata.email_sent=1 no pagamento.
 *
 * Env vars (Vercel):
 * - MP_ACCESS_TOKEN=...
 * - RESEND_API_KEY=re_...
 * - RESEND_FROM="Sua Loja <onboarding@resend.dev>" (em teste) ou "Sua Loja <vendas@seudominio.com>" (domínio verificado)
 * - ORDER_EMAIL_TO=seuemail@...
 */

import { supabaseAdmin } from "./_supabase.js";

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

async function mpFetch(token, url, opts = {}) {
  const resp = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}


function mapOrderStatus(mpStatus) {
  if (mpStatus === "approved") return "paid";
  if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded" || mpStatus === "charged_back")
    return "failed";
  return "pending";
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!token) {
      // responde 200 pra evitar retry infinito
      return res.status(200).json({ ok: true, ignored: "missing MP_ACCESS_TOKEN" });
    }

    const body = safeBody(req);
    // Formatos comuns:
    // { type: "payment", data: { id: "123" } }
    // { id: "123" }
    const paymentId = body?.data?.id || body?.id || null;

    if (!paymentId) {
      return res.status(200).json({ ok: true, ignored: "no payment id" });
    }

    const paymentResp = await mpFetch(
      token,
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`
    );

    if (!paymentResp.ok) {
      // acknowledge to avoid retries storm
      return res.status(200).json({ ok: true, ignored: "cannot fetch payment" });
    }

    const payment = paymentResp.data;
    const status = payment?.status;

    // Atualiza pedido no Supabase (best-effort)
    const orderId = payment?.external_reference || payment?.metadata?.order_id || null;
    if (orderId) {
      try {
        const sb = supabaseAdmin();
        const mapped = mapOrderStatus(status);
        await sb
          .from("orders")
          .update({
            status: mapped,
            payment_provider: "mercado_pago",
            provider_payment_id: String(payment.id || ""),
            customer_email: payment?.payer?.email || null,
            customer_name: payment?.payer?.first_name
              ? `${payment.payer.first_name || ""} ${payment.payer.last_name || ""}`.trim()
              : null,
            customer_phone: payment?.payer?.phone?.number || null,
          })
          .eq("id", orderId);

        // Se ainda não está aprovado, só atualiza e encerra (sem e-mail)
        if (mapped !== "paid") {
          return res.status(200).json({ ok: true, status, mapped });
        }
      } catch (e) {
        console.error("supabase update order error", e);
      }
    }

    // Idempotência: se já enviou, não envia de novo
    const alreadySent =
      payment?.metadata?.email_sent === 1 ||
      payment?.metadata?.email_sent === "1" ||
      payment?.metadata?.email_sent === true;

    if (alreadySent) {
      return res.status(200).json({ ok: true, status: "approved", email: "skipped" });
    }

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    const to = String(process.env.ORDER_EMAIL_TO || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();

    if (!apiKey || !to || !from) {
      // Mesmo sem email, tente marcar como enviado? Não.
      return res.status(200).json({ ok: true, status: "approved", email: "skipped (missing resend env)" });
    }

    let items = [];
    try {
      items = JSON.parse(payment?.metadata?.items_json || "[]") || [];
    } catch {
      items = [];
    }

    const itemsHtml = items
      .map((it) => {
        const name = it?.name || it?.nome || "Item";
        const qty = Number(it?.qty) || 1;
        const price = Number(it?.price) || 0;
        const total = (qty * price).toFixed(2);
        return `<li>${qty}× ${name} — R$ ${total}</li>`;
      })
      .join("");

    const payerEmail = payment?.payer?.email || "(sem email)";
    const amount = (Number(payment?.transaction_amount) || 0).toFixed(2);

    const subject = `Novo pedido Pix aprovado — R$ ${amount} — ${payerEmail}`;
    const html = `
      <h2>Novo pedido Pix aprovado ✅</h2>
      <p><b>Payment ID:</b> ${payment.id}</p>
      <p><b>Valor:</b> R$ ${amount}</p>
      <p><b>Status:</b> ${payment.status}</p>
      <p><b>Email do pagador:</b> ${payerEmail}</p>
      <p><b>Pedido:</b> ${payment.external_reference || "-"}</p>
      <h3>Itens</h3>
      <ul>${itemsHtml || "<li>(sem itens)</li>"}</ul>
    `;

    const emailResp = await sendResendEmail({ apiKey, from, to, subject, html });

    if (!emailResp.ok) {
      // acknowledge webhook anyway
      return res.status(200).json({ ok: true, email: "error", details: emailResp.data });
    }

    // Marca como enviado (best-effort)
    await mpFetch(
      token,
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          metadata: {
            ...(payment?.metadata || {}),
            email_sent: "1",
          },
        }),
      }
    );

    return res.status(200).json({ ok: true, email: "sent" });
  } catch (err) {
    console.error("mp-webhook error:", err);
    // Sempre 200 pra não gerar retry infinito
    return res.status(200).json({ ok: true, error: err?.message || String(err) });
  }
}
