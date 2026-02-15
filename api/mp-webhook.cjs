/**
 * Vercel Serverless Function
 * Route: /api/mp-webhook
 *
 * Mercado Pago webhook handler.
 * - Fetches payment details and, when approved, sends an order email via Resend.
 *
 * Env vars (Vercel):
 * - MP_ACCESS_TOKEN=...
 * - RESEND_API_KEY=re_...
 * - RESEND_FROM="Sua Loja <vendas@seudominio.com>" (or onboarding@resend.dev in test)
 * - ORDER_EMAIL_TO=you@example.com
 */

function safeJsonParse(maybeJson) {
  try {
    return typeof maybeJson === "string" ? JSON.parse(maybeJson) : maybeJson;
  } catch {
    return null;
  }
}

async function sendResendEmail({ from, to, subject, html, apiKey }) {
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
  return { ok: resp.ok, data };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });
    }

    const body = safeJsonParse(req.body) || {};

    // Mercado Pago can send different formats.
    const paymentId = body?.data?.id || body?.id || null;

    if (!paymentId) {
      // still acknowledge to avoid retries storm
      return res.status(200).json({ ok: true, ignored: "no payment id" });
    }

    // Fetch payment
    const payResp = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const payment = await payResp.json().catch(() => ({}));

    if (!payResp.ok) {
      return res.status(200).json({ ok: true, ignored: "cannot fetch payment", details: payment });
    }

    // Only act on approved payments
    if (payment.status !== "approved") {
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const to = String(process.env.ORDER_EMAIL_TO || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();
    const apiKey = String(process.env.RESEND_API_KEY || "").trim();

    if (!to || !from || !apiKey) {
      return res.status(200).json({ ok: true, status: "approved", email: "skipped (missing resend env)" });
    }

    // Items stored on create-pix-payment
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
      <h3>Itens</h3>
      <ul>${itemsHtml || "<li>(sem itens)</li>"}</ul>
    `;

    const result = await sendResendEmail({ from, to, subject, html, apiKey });
    if (!result.ok) {
      // acknowledge webhook anyway to avoid infinite retries
      return res.status(200).json({ ok: true, email: "error", details: result.data });
    }

    return res.status(200).json({ ok: true, email: "sent" });
  } catch (err) {
    console.error("mp-webhook error:", err);
    // Always 200 so MP doesn't retry forever due to transient issues
    return res.status(200).json({ ok: true, error: err?.message || String(err) });
  }
};
