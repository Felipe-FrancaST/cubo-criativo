/**
 * Vercel Serverless Function
 * Route: /api/create-pix-payment
 *
 * Gera um pagamento Pix no Mercado Pago e grava o pedido no Supabase.
 *
 * Env vars (Vercel):
 * - MP_ACCESS_TOKEN=...
 * - MP_MODE=test|production (opcional; default=production)
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

function toNumberBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido");
  return Number(n.toFixed(2));
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!token) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Faça login para gerar Pix." });

    const body = safeBody(req);
    const mode = String(process.env.MP_MODE || "production").trim().toLowerCase();

    const amount = toNumberBRL(body.amount);
    const origin = String(body.origin || "").trim() || getBaseUrl(req);

    // IMPORTANTÍSSIMO:
    // O sistema exige login para gerar Pix. Então SEMPRE usamos o e-mail real do usuário autenticado.
    // Isso evita que o front envie CPF/telefone no campo "email" e quebre o envio do email do cliente.
    // (Já vimos vários pedidos com customer_email inválido por causa disso.)
    let payerEmail = String(user.email || "").trim();
    if (!payerEmail) return res.status(400).json({ error: "Missing user email" });

    // Em sandbox/test, o Mercado Pago pode exigir compradores de teste.
    // Se você realmente precisar sobrescrever, envie body.email APENAS em modo test.
    if (mode === "test") {
      const override = String(body.email || "").trim();
      payerEmail = override || payerEmail || "test@testuser.com";
    }

    const items = Array.isArray(body.items) ? body.items : [];

    // 1) Cria pedido no Supabase
    const sb = supabaseAdmin();
    const orderId = crypto.randomUUID();

    // tenta puxar nome/telefone do profile (se existir)
    const { data: prof } = await sb
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle();

    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: amount,
      payment_provider: "mercado_pago",
      // Sempre salva o email do usuário autenticado.
      customer_email: payerEmail,
      customer_name: prof?.full_name || null,
      customer_phone: prof?.phone || null,
    });
    if (orderErr) {
      console.error("supabase order insert error", orderErr);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    const cleaned = items
      .filter((it) => (Number(it.qty) || 0) > 0 && (Number(it.price) || 0) > 0)
      .map((it) => {
        const name = String(it.name || it.nome || "Item").trim();
        const qty = Number(it.qty) || 1;
        const scale = String(it.scale || it.escala || "").trim();
        const img = String(it.img || it.image_url || "").trim();
        const priceBRL = Number(Number(it.price).toFixed(2));
        const priceCents = Math.round(priceBRL * 100);
        return {
          product_id: String(it.id || it.product_id || "").trim() || null,
          name,
          qty,
          scale: scale || null,
          img: img || null,
          unit_price_brl: priceBRL,
          unit_price_cents: priceCents,
        };
      });

    if (cleaned.length) {
      // Preferência: schema novo (snapshot em cents)
      const payloadNew = cleaned.map((it) => ({
        order_id: orderId,
        product_id: it.product_id,
        product_name: it.name,
        scale: it.scale,
        qty: it.qty,
        unit_price_cents: it.unit_price_cents,
        product_image_url: it.img,
      }));

      const attemptNew = await sb.from("order_items").insert(payloadNew);
      if (attemptNew?.error) {
        // Fallback: schema antigo
        const payloadOld = cleaned.map((it) => ({
          order_id: orderId,
          product_id: it.product_id,
          name: it.name,
          scale: it.scale,
          qty: it.qty,
          unit_price: it.unit_price_brl,
          img: it.img,
        }));
        const attemptOld = await sb.from("order_items").insert(payloadOld);
        if (attemptOld?.error) console.error("supabase order_items insert error", attemptOld.error);
      }
    }

    // 2) Cria pagamento Pix
    const idempotencyKey = crypto.randomUUID();
    const paymentResp = await mpFetch(token, "https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: String(body.description || "Pagamento via Pix").slice(0, 120),
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
        },
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          user_id: user.id,
          items_json: JSON.stringify(items).slice(0, 4500),
        },
        notification_url: `${origin}/api/mp-webhook`,
      }),
    });

    if (!paymentResp.ok) {
      console.error("mp create payment error", paymentResp.data);
      await sb.from("orders").update({ status: "failed" }).eq("id", orderId);
      return res.status(paymentResp.status || 500).json({
        error: paymentResp.data || { message: "Mercado Pago error" },
      });
    }

    const payment = paymentResp.data || {};
    const tx = payment.point_of_interaction?.transaction_data || {};

    // grava id do pagamento
    await sb
      .from("orders")
      .update({ provider_payment_id: String(payment.id || "") })
      .eq("id", orderId);

    return res.status(200).json({
      order_id: orderId,
      id: String(payment.id),
      status: payment.status, // normalmente "pending"
      qr_code: tx.qr_code || null,
      qr_code_base64: tx.qr_code_base64 || null,
      ticket_url: tx.ticket_url || null,
      external_reference: payment.external_reference || null,
    });
  } catch (err) {
    console.error("create-pix-payment error", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
