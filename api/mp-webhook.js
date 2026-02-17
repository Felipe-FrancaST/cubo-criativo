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
import { renderOwnerOrderEmail, renderCustomerOrderEmail, buildAddressFromProfile } from "./_emailTemplates.js";
import { getProductInfo } from "./_catalog.js";

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

// Aceita números e strings em pt-BR ("R$ 1.234,56", "123,45").
function parseMoneyBRL(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? Number(v.toFixed(2)) : fallback;
  const s0 = String(v).trim();
  if (!s0) return fallback;
  let s = s0
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/BRL/gi, "")
    .replace(/\u00A0/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  s = s.replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Number(n.toFixed(2));
}

function isValidEmail(email) {
  const s = String(email || "").trim();
  return s.includes("@");
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

    
    // ===== Carrega dados do pedido (itens + perfil) para compor os emails
    const sb = supabaseAdmin();

    const { data: orderRow } = await sb
      .from("orders")
      .select("id, user_id, status, total, created_at, payment_provider, provider_payment_id, customer_email, customer_name, customer_phone")
      .eq("id", orderId)
      .maybeSingle();

    // Seu schema atual (print) usa: product_id, qty, unit_price_cents
    const { data: itemsData } = await sb
      .from("order_items")
      .select("product_id, qty, unit_price_cents")
      .eq("order_id", orderId);

    const userId = orderRow?.user_id || payment?.metadata?.user_id || null;

    const { data: profile } = userId
      ? await sb
          .from("profiles")
          .select("full_name, phone, address_line1, address_line2, neighborhood, city, state, zip")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };

    const siteUrl = String(process.env.SITE_URL || "").trim().replace(/\/$/, "");
    const toAbsImg = (src) => {
      const s = String(src || "").trim();
      if (!s) return "";
      if (s.startsWith("http://") || s.startsWith("https://")) return s;
      if (!siteUrl) return s;
      return s.startsWith("/") ? `${siteUrl}${s}` : `${siteUrl}/${s}`;
    };

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

    const normalizeImg = (src) => {
      const s = String(src || "").trim();
      if (!s) return "";
      if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
      return toAbsImg(s);
    };

    let items = (itemsData || []).map((it) => {
      const pid = String(it.product_id || "").trim();
      const p = getProductInfo(pid);
      return {
        name: p?.name || (pid ? `Produto (${pid})` : "Produto"),
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price_cents ?? 0) / 100,
        img: normalizeImg(p?.img || ""),
        scale: "",
      };
    });

    // Fallback: se não tiver itens no banco, tenta ler do metadata do pagamento
    if (!items.length) {
      try {
        const raw = payment?.metadata?.items_json;
        const parsed = Array.isArray(raw)
          ? raw
          : typeof raw === "object" && raw
          ? raw
          : raw
          ? JSON.parse(String(raw))
          : [];
        if (Array.isArray(parsed)) {
          items = parsed
            .map((it) => {
              const name = String(
                pick(it?.name, it?.nome, it?.title, it?.produto, it?.productName, it?.product_name) || "Item"
              ).trim();
              const qty = Number(pick(it?.qty, it?.quantity, it?.quantidade, it?.qtd) || 1) || 1;
              const unit_price = parseMoneyBRL(
                pick(it?.price, it?.unitPrice, it?.unit_price, it?.valor, it?.preco, it?.unit, it?.amount),
                0
              );
              const img = normalizeImg(
                pick(
                  it?.img,
                  it?.image,
                  it?.imagem,
                  it?.photo,
                  it?.foto,
                  it?.imageUrl,
                  it?.image_url,
                  it?.thumbnail,
                  it?.thumb
                ) || ""
              );
              const scale = String(pick(it?.scale, it?.escala, it?.variant, it?.variantLabel) || "").trim();
              return { name, qty, unit_price, img, scale };
            })
            .filter((it) => (Number(it.qty) || 0) > 0);
        }
      } catch {
        // ignore
      }
    }

    // Fallback 2: Mercado Pago às vezes traz itens em additional_info
    if (!items.length) {
      const arr = Array.isArray(payment?.additional_info?.items) ? payment.additional_info.items : [];
      if (arr.length) {
        items = arr
          .map((it) => {
            const name = String(pick(it?.title, it?.name, it?.description) || "Item").trim();
            const qty = Number(pick(it?.quantity, it?.qty) || 1) || 1;
            const unit_price = parseMoneyBRL(pick(it?.unit_price, it?.unitPrice, it?.price), 0);
            const img = normalizeImg(pick(it?.picture_url, it?.img, it?.image, it?.thumbnail) || "");
            return { name, qty, unit_price, img, scale: "" };
          })
          .filter((it) => (Number(it.qty) || 0) > 0);
      }
    }

    const payerEmail =
      orderRow?.customer_email ||
      payment?.payer?.email ||
      payment?.additional_info?.payer?.email ||
      payment?.metadata?.payer_email ||
      payment?.metadata?.customer_email ||
      "";

    const customerName =
      orderRow?.customer_name ||
      profile?.full_name ||
      (payment?.payer?.first_name
        ? `${payment.payer.first_name || ""} ${payment.payer.last_name || ""}`.trim()
        : "");

    const customerPhone = orderRow?.customer_phone || profile?.phone || payment?.payer?.phone?.number || "";

    const address = buildAddressFromProfile(profile);

    const total = Number(orderRow?.total ?? payment?.transaction_amount ?? 0) || 0;
    const createdAt = orderRow?.created_at || payment?.date_created || new Date().toISOString();

    // Forma de pagamento (Pix, cartão etc.)
    const paymentMethod = (() => {
      const pm = String(payment?.payment_method_id || payment?.payment_type_id || "mercado_pago").toLowerCase();
      if (pm === "pix") return "Pix";
      if (pm === "credit_card" || pm === "debit_card") return "Cartão";
      return pm.replaceAll("_", " ").toUpperCase();
    })();

    const brandName = String(process.env.BRAND_NAME || "Cubo Criativo").trim();
    const supportEmail = String(process.env.SUPPORT_EMAIL || "").trim();
    const whatsapp = String(process.env.WHATSAPP || "").trim();

    const ownerEmail = renderOwnerOrderEmail({
      brandName,
      orderId,
      orderStatus: "paid",
      createdAt,
      paymentMethod,
      total,
      customer: {
        name: customerName,
        email: payerEmail,
        phone: customerPhone,
        address,
      },
      items,
    });

    const customerEmail = renderCustomerOrderEmail({
      brandName,
      orderId,
      createdAt,
      paymentMethod,
      total,
      customer: {
        name: customerName,
        email: payerEmail,
        phone: customerPhone,
        address,
      },
      items,
      supportEmail,
      whatsapp,
    });

    // 1) Email de controle (para você)
    const ownerResp = await sendResendEmail({ apiKey, from, to, subject: ownerEmail.subject, html: ownerEmail.html });

    if (!ownerResp.ok) {
      // acknowledge webhook anyway
      return res.status(200).json({ ok: true, email: "error_owner", details: ownerResp.data });
    }

    // 2) Email para o cliente (best-effort)
    let customerResp = { ok: true };
    if (isValidEmail(payerEmail)) {
      customerResp = await sendResendEmail({ apiKey, from, to: payerEmail, subject: customerEmail.subject, html: customerEmail.html });
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

    return res.status(200).json({ ok: true, email: "sent", customer: customerResp.ok ? "sent" : "error" });
  } catch (err) {
    console.error("mp-webhook error:", err);
    // Sempre 200 pra não gerar retry infinito
    return res.status(200).json({ ok: true, error: err?.message || String(err) });
  }
}
