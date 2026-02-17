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
import { supabaseAdmin } from "./_supabase.js";
import { renderOwnerOrderEmail, renderCustomerOrderEmail, buildAddressFromProfile } from "./_emailTemplates.js";

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

    // Tenta localizar o pedido criado no checkout
    const orderId = session?.client_reference_id || session?.metadata?.order_id || null;

    // Atualiza o pedido no Supabase (best-effort)
    if (orderId) {
      try {
        const sb = supabaseAdmin();
        await sb
          .from("orders")
          .update({
            status: "paid",
            payment_provider: "stripe",
            provider_payment_id: sessionId,
            customer_email: session?.customer_details?.email || session?.customer_email || null,
            customer_name: session?.customer_details?.name || null,
            customer_phone: session?.customer_details?.phone || null,
          })
          .eq("id", orderId);
      } catch (e) {
        console.error("supabase update order error", e);
      }
    }

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

    
    const brandName = String(process.env.BRAND_NAME || "Cubo Criativo").trim();
    const supportEmail = String(process.env.SUPPORT_EMAIL || "").trim();
    const whatsapp = String(process.env.WHATSAPP || "").trim();

    const sb = supabaseAdmin();
    const { data: orderRow } = orderId
      ? await sb
          .from("orders")
          .select("id, user_id, total, created_at, customer_email, customer_name, customer_phone")
          .eq("id", orderId)
          .maybeSingle()
      : { data: null };

    const userId = orderRow?.user_id || session?.metadata?.user_id || null;

    const { data: profile } = userId
      ? await sb
          .from("profiles")
          .select("full_name, phone, address_line1, address_line2, neighborhood, city, state, zip")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };

    const total = Number(orderRow?.total ?? amountTotal ?? 0) || 0;
    const createdAt = orderRow?.created_at || new Date().toISOString();

    const customerNameFinal = orderRow?.customer_name || profile?.full_name || customerName || "";
    const customerEmailFinal = orderRow?.customer_email || customerEmail || "";
    const customerPhoneFinal = orderRow?.customer_phone || profile?.phone || phone || "";

    const addressFromProfile = buildAddressFromProfile(profile);
    const addressFinal = addressFromProfile || address;

    const itemsForEmail = (items || []).map((li) => {
      const qty = Number(li?.quantity) || 1;
      const lineTotal = Number(li?.amount_total ?? 0) / 100;
      const unit = qty ? lineTotal / qty : lineTotal;
      return {
        name: li?.description || "Item",
        qty,
        unit_price: Number(unit.toFixed(2)),
        img: "",
      };
    });

    const paymentMethod = "Cartão (Stripe)";

    const ownerEmail = renderOwnerOrderEmail({
      brandName,
      orderId: orderId || sessionId,
      orderStatus: "paid",
      createdAt,
      paymentMethod,
      total,
      customer: {
        name: customerNameFinal,
        email: customerEmailFinal,
        phone: customerPhoneFinal,
        address: addressFinal,
      },
      items: itemsForEmail,
    });

    const customerEmailTpl = renderCustomerOrderEmail({
      brandName,
      orderId: orderId || sessionId,
      createdAt,
      paymentMethod,
      total,
      customer: {
        name: customerNameFinal,
        email: customerEmailFinal,
        phone: customerPhoneFinal,
        address: addressFinal,
      },
      items: itemsForEmail,
      supportEmail,
      whatsapp,
    });

const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    const to = String(process.env.ORDER_EMAIL_TO || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();

    if (!apiKey || !to || !from) {
      // Acknowledge, but warn in logs
      console.warn("Missing resend env vars (RESEND_API_KEY/ORDER_EMAIL_TO/RESEND_FROM). Skipping email.");
      return res.status(200).send("ok");
    }

    const ownerResp = await sendResendEmail({ apiKey, from, to, subject: ownerEmail.subject, html: ownerEmail.html });

    if (!ownerResp.ok) {
      return res.status(200).json({ ok: true, email: "error_owner", details: ownerResp.data });
    }

    // Email para o cliente (best-effort)
    let customerResp = { ok: true };
    if (customerEmailFinal) {
      customerResp = await sendResendEmail({ apiKey, from, to: customerEmailFinal, subject: customerEmailTpl.subject, html: customerEmailTpl.html });
    }
    if (!ownerResp.ok) {
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
