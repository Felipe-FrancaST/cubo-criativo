/**
 * Vercel Serverless Function
 * Route: /api/stripe-webhook
 *
 * Stripe webhook (sem SDK), valida assinatura e envia email via Resend.
 *
 * Env vars (Vercel):
 * - STRIPE_SECRET_KEY=sk_...
 * - STRIPE_WEBHOOK_SECRET=whsec_...
 * - RESEND_API_KEY=re_...
 * - RESEND_FROM="Sua Loja <onboarding@resend.dev>" (teste) ou domínio verificado
 * - ORDER_EMAIL_TO=seuemail@...
 */

import crypto from "crypto";

export const config = { runtime: "nodejs" };

function safeBody(req) {
  // Precisamos do RAW body para validar assinatura.
  // No Node serverless da Vercel, o req.body às vezes já vem como objeto.
  // A forma mais confiável: ler o stream.
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseStripeSig(header) {
  // Ex: "t=1492774577,v1=5257a869e7...,v0=..."
  const parts = String(header || "").split(",");
  const out = { t: null, v1: [] };
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (!k || !v) continue;
    if (k === "t") out.t = v;
    if (k === "v1") out.v1.push(v);
  }
  return out;
}

function timingSafeEqualHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyStripeSignature({ rawBody, sigHeader, webhookSecret, toleranceSec = 300 }) {
  const { t, v1 } = parseStripeSig(sigHeader);
  if (!t || !v1.length) return { ok: false, reason: "missing signature" };

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "invalid timestamp" };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const ok = v1.some((sig) => timingSafeEqualHex(sig, expected));
  return { ok, reason: ok ? "ok" : "signature mismatch" };
}

async function stripeGet(secretKey, url) {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
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

    const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!secretKey || !webhookSecret) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
    }

    const sigHeader = req.headers["stripe-signature"];
    const rawBody = await safeBody(req);

    const ver = verifyStripeSignature({ rawBody, sigHeader, webhookSecret });
    if (!ver.ok) {
      return res.status(400).send(`Webhook signature error: ${ver.reason}`);
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    if (event?.type !== "checkout.session.completed") {
      return res.status(200).send("ok");
    }

    const session = event.data?.object;
    const sessionId = session?.id;
    if (!sessionId) return res.status(200).send("ok");

    const itemsResp = await stripeGet(
      secretKey,
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100`
    );

    const items = Array.isArray(itemsResp.data?.data) ? itemsResp.data.data : [];

    const customerEmail = session?.customer_details?.email || session?.customer_email || "(sem email)";
    const customerName = session?.customer_details?.name || "(sem nome)";
    const phone = session?.customer_details?.phone || "(sem telefone)";
    const amountTotal = ((session?.amount_total ?? 0) / 100);

    const addressObj = session?.customer_details?.address || session?.shipping_details?.address || null;
    const address = addressObj
      ? `${addressObj.line1 || ""} ${addressObj.line2 || ""}<br/>
         ${addressObj.city || ""} - ${addressObj.state || ""}<br/>
         ${addressObj.postal_code || ""} - ${addressObj.country || ""}`.trim()
      : "(não coletado)";

    const itemsHtml = items
      .map((li) => {
        const name = li?.description || "Item";
        const qty = li?.quantity || 1;
        const price = ((li?.amount_total ?? 0) / 100).toFixed(2);
        return `<li>${qty}× ${name} — R$ ${price}</li>`;
      })
      .join("");

    const subject = `Novo pedido pago — R$ ${amountTotal.toFixed(2)} — ${customerEmail}`;
    const html = `
      <h2>Novo pedido pago ✅</h2>
      <p><b>Checkout Session:</b> ${sessionId}</p>
      <p><b>Valor total:</b> R$ ${amountTotal.toFixed(2)}</p>

      <h3>Cliente</h3>
      <p>
        <b>Nome:</b> ${customerName}<br/>
        <b>Email:</b> ${customerEmail}<br/>
        <b>Telefone:</b> ${phone}
      </p>

      <h3>Endereço</h3>
      <p>${address}</p>

      <h3>Itens</h3>
      <ul>${itemsHtml || "<li>(sem itens)</li>"}</ul>
    `;

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    const to = String(process.env.ORDER_EMAIL_TO || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();

    if (!apiKey || !to || !from) {
      // Acknowledge, but warn in logs
      console.warn("Missing resend env vars (RESEND_API_KEY/ORDER_EMAIL_TO/RESEND_FROM). Skipping email.");
      return res.status(200).send("ok");
    }

    const emailResp = await sendResendEmail({ apiKey, from, to, subject, html });
    if (!emailResp.ok) {
      console.error("Resend error", emailResp.data);
      // still ack to avoid retries storm; you can check Vercel logs
      return res.status(200).send("ok");
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return res.status(500).send("error");
  }
}
