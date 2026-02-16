/**
 * Vercel Serverless Function
 * Route: /api/create-checkout-session
 *
 * Mercado Pago Checkout Pro (redirect).
 * Cria pedido no Supabase e cria uma preferência no Mercado Pago.
 *
 * Env vars (Vercel):
 * - MP_ACCESS_TOKEN=APP_USR_...
 * - SITE_URL=https://seu-site.vercel.app (recomendado)
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
  // Prioriza SITE_URL para evitar inconsistências de domínio em produção
  const site = String(process.env.SITE_URL || "").trim();
  if (site) return site.replace(/\/$/, "");

  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function sanitizeItemName(name) {
  const s = String(name || "Item").trim();
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

async function mpCreatePreference({ accessToken, body }) {
  const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const mpToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!mpToken) {
      return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });
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

    // Total no servidor
    let total = 0;
    const cleanItems = [];
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const unit = Number(it.price) || 0;
      if (qty <= 0 || unit <= 0) continue;
      total += qty * unit;

      cleanItems.push({
        id: String(it.id || ""),
        title: sanitizeItemName(`${it.name || it.nome || "Item"}${it.scale ? ` (${it.scale})` : ""}`),
        quantity: qty,
        unit_price: Number(unit.toFixed(2)),
        currency_id: "BRL",
        picture_url: it.img ? String(it.img) : undefined,
      });
    }

    if (!(total > 0) || cleanItems.length === 0) {
      return res.status(400).json({ error: "Total/itens inválidos" });
    }

    const base = getBaseUrl(req);
    const orderId = crypto.randomUUID();

    // 1) Cria pedido no Supabase
    const sb = supabaseAdmin();
    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: Number(total.toFixed(2)),
      payment_provider: "mercadopago",
      customer_email: user.email || null,
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

    // 2) Cria preferência no Mercado Pago
    const prefBody = {
      items: cleanItems,
      payer: { email: user.email || undefined },
      external_reference: orderId,
      notification_url: `${base}/api/mp-webhook`,
      back_urls: {
        success: `${base}/?payment=success&provider=mercadopago&order_id=${orderId}`,
        pending: `${base}/?payment=pending&provider=mercadopago&order_id=${orderId}`,
        failure: `${base}/?payment=cancel&provider=mercadopago&order_id=${orderId}`,
      },
      auto_return: "approved",
      statement_descriptor: "CUBOCRIATIVO",
      metadata: {
        order_id: orderId,
        user_id: user.id,
        items_json: JSON.stringify(
          items.map((i) => ({
            name: i.name || i.nome,
            qty: i.qty,
            price: i.price,
            scale: i.scale || i.escala,
          }))
        ),
      },
    };

    const mpResp = await mpCreatePreference({ accessToken: mpToken, body: prefBody });
    if (!mpResp.ok) {
      console.error("mercadopago preference error", mpResp.data);
      await sb.from("orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(500).json({ error: "Mercado Pago error", details: mpResp.data });
    }

    const url = mpResp.data?.init_point;
    const prefId = mpResp.data?.id;

    if (prefId) {
      await sb.from("orders").update({ provider_payment_id: String(prefId) }).eq("id", orderId);
    }

    if (!url) {
      await sb.from("orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(500).json({ error: "Preferência sem URL" });
    }

    return res.status(200).json({ url, order_id: orderId });
  } catch (err) {
    console.error("create-checkout-session error", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
