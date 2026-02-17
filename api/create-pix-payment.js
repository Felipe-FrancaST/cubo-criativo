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

// Aceita: 1234.56, "1234,56", "R$ 1.234,56", "1.234,56", etc.
function parseMoneyBRL(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? Number(v.toFixed(2)) : fallback;
  const s0 = String(v).trim();
  if (!s0) return fallback;
  // remove moeda e espaços
  let s = s0
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/BRL/gi, "")
    .replace(/\u00A0/g, "");

  // Se tiver vírgula, assume decimal pt-BR
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // mantém só números e ponto
  s = s.replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
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

    // Em sandbox, o Mercado Pago exige test users/emails.
    // Mantemos a regra aqui para facilitar o teste.
    let payerEmail = String(body.email || user.email || "").trim();
    if (!payerEmail) return res.status(400).json({ error: "Missing payer email" });

    if (mode === "test") {
      // Use um comprador de teste (criado no painel) OU emails aceitos no ambiente de teste.
      payerEmail = payerEmail || "test@testuser.com";
    }

    const items = Array.isArray(body.items) ? body.items : [];

    // 1) Cria pedido no Supabase
    const sb = supabaseAdmin();
    const orderId = crypto.randomUUID();

    // Snapshot de dados do cliente (para email/produção)
    let profile = null;
    try {
      const { data } = await sb
        .from("profiles")
        .select("full_name, phone, address_line1, address_line2, neighborhood, city, state, zip")
        .eq("id", user.id)
        .maybeSingle();
      profile = data || null;
    } catch {
      profile = null;
    }

    const customerEmail = payerEmail || null;
    const customerName = String(body.name || profile?.full_name || "").trim() || null;
    const customerPhone = String(body.phone || profile?.phone || "").trim() || null;

    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: amount,
      payment_provider: "mercado_pago",
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
    });
    if (orderErr) {
      console.error("supabase order insert error", orderErr);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    // Normaliza itens vindos do front (suporta variações de keys)
    const pick = (...vals) => {
      for (const v of vals) {
        if (v === 0) return 0;
        if (v === false) return false;
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (s) return v;
      }
      return undefined;
    };

    const toInt = (v, fallback = 0) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.trunc(n));
    };

    const toMoney = (v, fallback = 0) => parseMoneyBRL(v, fallback);

    const normalizeImg = (src) => {
      const s = String(src || "").trim();
      if (!s) return "";
      if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
      return s.startsWith("/") ? s : `/${s}`;
    };

    // Salva itens do pedido no Supabase
    // Preferimos "order_items" com snapshot (nome/imagem/escala) para garantir
    // que a aba Pedidos e os emails sempre tenham o que mostrar, mesmo se o produto mudar depois.

    const normalizedItems = items
      .map((it) => {
        const qty = toInt(pick(it?.qty, it?.quantity, it?.quantidade, it?.qtd), 1) || 1;
        const unit = toMoney(
          pick(it?.price, it?.unitPrice, it?.unit_price, it?.valor, it?.preco, it?.unit, it?.amount),
          0
        );
        const productId = String(pick(it?.id, it?.product_id, it?.sku, it?.productId) || "").trim();
        const name = String(pick(it?.name, it?.nome, it?.title) || "").trim();
        const scale = String(pick(it?.scale, it?.escala, it?.variant, it?.variantLabel) || "").trim();
        const img = normalizeImg(pick(it?.img, it?.image, it?.imagem, it?.thumbnail, it?.thumb) || "");
        return {
          product_id: productId || null,
          qty,
          unit_price_cents: Math.round((Number(unit) || 0) * 100),
          product_name: name || null,
          product_image_url: img || null,
          scale: scale || null,
        };
      })
      .filter((it) => (Number(it.qty) || 0) > 0);

    // Enriquecimento pelo catálogo no banco (products)
    const idsToFetch = Array.from(new Set(normalizedItems.map((it) => it.product_id).filter(Boolean)));
    let productsById = new Map();
    if (idsToFetch.length) {
      try {
        const { data: prodRows } = await sb
          .from("products")
          .select("id, name, image_url")
          .in("id", idsToFetch);

        for (const p of Array.isArray(prodRows) ? prodRows : []) {
          if (p?.id) productsById.set(String(p.id), p);
        }
      } catch {
        // ignore
      }
    }

    const orderItems = normalizedItems.map((it) => {
      const p = it.product_id ? productsById.get(String(it.product_id)) : null;
      return {
        order_id: orderId,
        product_id: it.product_id,
        qty: it.qty,
        unit_price_cents: it.unit_price_cents,
        // snapshots
        product_name: it.product_name || (p?.name ? String(p.name) : null),
        product_image_url: it.product_image_url || (p?.image_url ? normalizeImg(p.image_url) : null),
        scale: it.scale,
      };
    });

    if (orderItems.length) {
      // Tentativa 1: inserção completa (com snapshots)
      let { error: itemsErr } = await sb.from("order_items").insert(orderItems);

      // Se o schema ainda não tem as colunas snapshot, tenta de novo só com o básico
      if (itemsErr && /column .* does not exist/i.test(String(itemsErr.message || ""))) {
        const basic = orderItems.map(({ order_id, product_id, qty, unit_price_cents }) => ({
          order_id,
          product_id,
          qty,
          unit_price_cents,
        }));
        const retryBasic = await sb.from("order_items").insert(basic);
        itemsErr = retryBasic.error;
      }

      // Se o banco exigir id uuid sem default, tenta novamente com id gerado
      if (itemsErr && /null value in column\s+"id"/i.test(String(itemsErr.message || ""))) {
        const withId = orderItems.map((it) => ({ id: crypto.randomUUID(), ...it }));
        const retry = await sb.from("order_items").insert(withId);
        itemsErr = retry.error;
      }

      if (itemsErr) console.error("supabase order_items insert error", itemsErr);
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
          payer_email: payerEmail,
          customer_name: customerName || "",
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
