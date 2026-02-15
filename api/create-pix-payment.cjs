/**
 * Vercel Serverless Function
 * Route: /api/create-pix-payment
 *
 * Mercado Pago PIX (no SDK, via HTTP).
 *
 * Configure on Vercel (Project Settings -> Environment Variables):
 * - MP_ACCESS_TOKEN=APP_USR_... (test or prod)
 * Optional:
 * - MP_MODE=test   (forces payer email to test@testuser.com to avoid test-user issues)
 */

const crypto = require("crypto");

function getBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function toNumberBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(2));
}

function safeJsonParse(maybeJson) {
  try {
    return typeof maybeJson === "string" ? JSON.parse(maybeJson) : maybeJson;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({
        error:
          "Missing MP_ACCESS_TOKEN. Add it in Vercel -> Project Settings -> Environment Variables.",
      });
    }

    const body = safeJsonParse(req.body) || {};
    const amount = toNumberBRL(body.amount);
    if (!amount) return res.status(400).json({ error: "Valor inválido" });

    const base = String(body.origin || "").trim() || getBaseUrl(req);

    // Em modo de teste, o Mercado Pago costuma exigir emails específicos.
    // Pra destravar testes sem dor: force test@testuser.com.
    const mode = String(process.env.MP_MODE || "").toLowerCase();
    const emailFromBody = String(body.email || "").trim();
    const payerEmail = mode === "test" ? "test@testuser.com" : emailFromBody;
    if (!payerEmail) return res.status(400).json({ error: "Missing payer email" });

    const name = String(body.name || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    const idempotencyKey = crypto.randomUUID();

    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: body.description || "Pagamento via Pix",
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
          first_name: name.split(" ")[0] || "",
          last_name: name.split(" ").slice(1).join(" ") || "",
        },
        external_reference: body.orderId || crypto.randomUUID(),
        metadata: {
          items_json: JSON.stringify(items).slice(0, 4500),
        },
        notification_url: `${base}/api/mp-webhook`,
      }),
    });

    const data = await mpResp.json().catch(() => ({}));

    if (!mpResp.ok) {
      const msg =
        data?.message ||
        data?.error ||
        data?.cause?.[0]?.description ||
        "Erro ao criar Pix";
      return res.status(500).json({ error: msg, details: data });
    }

    const tx = data?.point_of_interaction?.transaction_data || {};

    return res.status(200).json({
      id: String(data.id),
      status: data.status,
      qr_code: tx.qr_code || null,
      qr_code_base64: tx.qr_code_base64 || null,
      ticket_url: tx.ticket_url || null,
      external_reference: data.external_reference || null,
    });
  } catch (err) {
    console.error("Pix error:", err);
    return res.status(500).json({
      error: "Pix error",
      details: err?.message || String(err),
    });
  }
};
