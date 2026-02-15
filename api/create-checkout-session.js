/**
 * Vercel Serverless Function
 * Route: /api/create-checkout-session
 *
 * Cria uma sessão do Stripe Checkout (sem SDK) e também cria um registro de pedido no Supabase.
 *
 * Env vars (Vercel):
 * - STRIPE_SECRET_KEY=sk_...
 * - SUPABASE_URL=...
 * - SUPABASE_ANON_KEY=...
 * - SUPABASE_SERVICE_ROLE_KEY=...
 */

import crypto from "crypto";
import { getUserFromAuthHeader, supabaseAdmin } from "./_supabase.js";

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

function getBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function toCentsBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

function sanitizeLineItemName(name) {
  const s = String(name || "Item").trim();
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

async function stripeCreateCheckoutSession({ secretKey, payload }) {
  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
    if (!stripeKey) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
    }

    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return res.status(401).json({ error: "Faça login para pagar." });
    }

    const body = safeBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: "Carrinho vazio" });
    }

    // Calcula total (servidor)
    let total = 0;
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const unit = Number(it.price) || 0;
      if (qty <= 0 || unit <= 0) continue;
      total += qty * unit;
    }

    if (!(total > 0)) {
      return res.status(400).json({ error: "Total inválido" });
    }

    const base = String(body.origin || "").trim() || getBaseUrl(req);
    const orderId = crypto.randomUUID();

    // 1) Cria pedido no Supabase
    const sb = supabaseAdmin();
    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: Number(total.toFixed(2)),
      payment_provider: "stripe",
    });
    if (orderErr) {
      console.error("supabase order insert error", orderErr);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    const orderItems = items
      .filter((it) => (Number(it.qty) || 0) > 0 && (Number(it.price) || 0) > 0)
      .map((it) => ({
        order_id: orderId,
        product_id: String(it.id || ""),
        name: String(it.name || it.nome || "Item").trim(),
        scale: String(it.scale || it.escala || "").trim(),
        qty: Number(it.qty) || 1,
        unit_price: Number(Number(it.price).toFixed(2)),
        img: String(it.img || ""),
      }));

    if (orderItems.length) {
      const { error: itemsErr } = await sb.from("order_items").insert(orderItems);
      if (itemsErr) {
        console.error("supabase order_items insert error", itemsErr);
      }
    }

    // 2) Cria Stripe Checkout Session
    const payload = new URLSearchParams();
    payload.set("mode", "payment");
    payload.set("success_url", `${base}/?payment=success&provider=stripe&order_id=${orderId}`);
    payload.set("cancel_url", `${base}/?payment=cancel&provider=stripe&order_id=${orderId}`);
    payload.set("client_reference_id", orderId);
    payload.set("metadata[order_id]", orderId);
    payload.set("customer_email", user.email || "");

    // Coletas
    payload.set("phone_number_collection[enabled]", "true");
    payload.set("shipping_address_collection[allowed_countries][0]", "BR");

    // Line items
    let idx = 0;
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const unit = Number(it.price) || 0;
      if (qty <= 0 || unit <= 0) continue;

      const cents = toCentsBRL(unit);
      if (!cents) continue;

      const name = sanitizeLineItemName(`${it.name || it.nome || "Item"}${it.scale ? ` (${it.scale})` : ""}`);

      payload.set(`line_items[${idx}][quantity]`, String(qty));
      payload.set(`line_items[${idx}][price_data][currency]`, "brl");
      payload.set(`line_items[${idx}][price_data][unit_amount]`, String(cents));
      payload.set(`line_items[${idx}][price_data][product_data][name]`, name);
      idx += 1;
    }

    if (idx === 0) {
      return res.status(400).json({ error: "Itens inválidos" });
    }

    const stripeResp = await stripeCreateCheckoutSession({ secretKey: stripeKey, payload });
    if (!stripeResp.ok) {
      console.error("stripe create session error", stripeResp.data);
      // marca pedido como erro
      await sb.from("orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(500).json({ error: "Stripe error", details: stripeResp.data });
    }

    const url = stripeResp.data?.url;
    if (!url) {
      await sb.from("orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(500).json({ error: "Stripe session sem URL" });
    }

    return res.status(200).json({ url, order_id: orderId });
  } catch (err) {
    console.error("create-checkout-session error", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
