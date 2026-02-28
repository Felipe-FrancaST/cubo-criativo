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
import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";
import { calcCouponDiscount } from "../server/couponGame.js";
import { getVipPlanById, listVipPlans, vipPlanDisplayName } from "../server/vipPlans.js";
import { z, safeJsonBody, validateBody } from "../server/validate.js";

export const config = { runtime: "nodejs" };

const BodySchema = z
  .object({
    amount: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().positive()),
    items: z
      .array(
        z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            qty: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().positive()).optional(),
            price: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().nonnegative()).optional(),
            scale: z.string().optional(),
            img: z.string().url().optional(),
          })
          .passthrough()
      )
      .default([]),
    coupon_code: z.string().optional(),
    origin: z.string().optional(),
    email: z.string().email().optional(),
    vip_plan_id: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

function getBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getQueryParam(req, key) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url || '', `${proto}://${host}`);
    return url.searchParams.get(key);
  } catch {
    return null;
  }
}

function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findPlanByProfileValue(plans, profilePlan) {
  const q = normalizeText(profilePlan);
  if (!q) return null;
  return (plans || []).find((p) => {
    const candidates = [p?.id, p?.slug, p?.name, p?.short_name, p?.title].map(normalizeText);
    return candidates.some((c) => c && (c === q || q.includes(c) || c.includes(q)));
  }) || null;
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


function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

async function getUserCpf(sb, userId) {
  const { data } = await sb.from("profiles").select("cpf").eq("id", userId).maybeSingle();
  return normalizeCpf(data?.cpf);
}

async function couponAlreadyUsedByCpf(sb, { couponCode, cpf }) {
  const normalized = normalizeCpf(cpf);
  if (!couponCode || !normalized) return false;
  const { data: reds } = await sb.from("coupon_redemptions").select("user_id").eq("coupon_code", couponCode);
  const ids = [...new Set((reds || []).map((r) => r.user_id).filter(Boolean))];
  if (!ids.length) return false;
  const { data: profs } = await sb.from("profiles").select("id,cpf").in("id", ids);
  return (profs || []).some((p) => normalizeCpf(p.cpf) === normalized);
}

async function ensureCouponCpfAllowed(sb, { coupon, currentUser }) {
  const currentCpf = await getUserCpf(sb, currentUser.id);
  if (!currentCpf) return { ok: false, status: 400, error: "Complete seu CPF no perfil para usar cupom." };

  if (coupon.user_id) {
    const ownerCpf = await getUserCpf(sb, coupon.user_id);
    if (ownerCpf && ownerCpf !== currentCpf) {
      return { ok: false, status: 403, error: "Esse cupom pertence a outro CPF." };
    }
  }

  const alreadyUsedByCpf = await couponAlreadyUsedByCpf(sb, { couponCode: coupon.code, cpf: currentCpf });
  if (alreadyUsedByCpf) {
    return { ok: false, status: 400, error: "Este cupom já foi utilizado por este CPF." };
  }

  return { ok: true, currentCpf };
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

    const bodyRaw = safeJsonBody(req);
    const v = validateBody(BodySchema, bodyRaw);
    if (!v.ok) return res.status(v.status).json({ error: v.error, details: v.details });
    const body = v.data;

    // Compat: /api/create-vip-upgrade-pix-payment foi unificado neste endpoint para reduzir o número de Functions no plano Hobby.
    const modeParam = String(getQueryParam(req, 'mode') || '').trim().toLowerCase();
    if (modeParam === 'vip_upgrade') {
      const sb = supabaseAdmin();
      const origin = String(process.env.APP_URL || '').trim() || getBaseUrl(req);

      const toPlanId = String(body?.to_plan_id || body?.vip_plan_id || '').trim();
      if (!toPlanId) return res.status(400).json({ error: 'Plano de destino inválido.' });

      // Checa VIP ativo e pega plano atual
      const { data: prof } = await sb
        .from('profiles')
        .select('vip_until,vip_plan,full_name,phone,cpf,birthdate,address_line1,address_number,neighborhood,city,state,zip')
        .eq('id', user.id)
        .maybeSingle();
      const vipUntil = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
      if (!vipUntil || vipUntil <= Date.now()) {
        return res.status(403).json({ error: 'Você precisa estar com VIP ativo para fazer upgrade.' });
      }

      // Exige dados completos (mesma regra da assinatura)
      const requiredFields = ['full_name','phone','cpf','birthdate','address_line1','address_number','neighborhood','city','state','zip'];
      const missing = requiredFields.filter((k) => !String(prof?.[k] || '').trim());
      if (missing.length) {
        return res.status(400).json({ error: 'Profile incomplete', code: 'profile_incomplete', missing });
      }

      const plans = await listVipPlans(sb);
      const ordered = [...plans].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));

      // Preferência: plano atual pela assinatura ativa, se existir
      let currentPlanId = null;
      try {
        const { data: sub } = await sb
          .from('vip_subscriptions')
          .select('plan_id,ends_at,status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('ends_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub?.plan_id) currentPlanId = String(sub.plan_id);
      } catch {}

      const currentPlan = (currentPlanId ? ordered.find((p) => String(p?.id) === currentPlanId) : null) || findPlanByProfileValue(ordered, prof?.vip_plan) || ordered[0];
      const toPlan = ordered.find((p) => String(p?.id) === String(toPlanId));
      if (!toPlan) return res.status(400).json({ error: 'Plano de destino não encontrado.' });

      const fromPrice = Number(currentPlan?.price_brl || 0);
      const toPrice = Number(toPlan?.price_brl || 0);
      const diff = Number((toPrice - fromPrice).toFixed(2));
      if (!Number.isFinite(diff) || diff <= 0) {
        return res.status(400).json({ error: 'Este upgrade não está disponível.' });
      }

      const orderId = crypto.randomUUID();

      const { error: orderErr } = await sb.from('orders').insert({
        id: orderId,
        user_id: user.id,
        status: 'pending',
        currency: 'BRL',
        total: diff,
        payment_provider: 'mercado_pago',
        production_status: 'upgrade',
        order_type: 'vip_upgrade',
        vip_plan_id: toPlan.id,
        customer_email: String(user.email || '').trim(),
        customer_name: prof?.full_name || null,
        customer_phone: prof?.phone || null,
      });
      if (orderErr) {
        console.error('order insert error', orderErr);
        return res.status(500).json({ error: 'Não foi possível criar o pedido de upgrade.' });
      }

      const idempotencyKey = crypto.randomUUID();
      const paymentResp = await mpFetch(token, 'https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          transaction_amount: diff,
          description: `Upgrade VIP ${String(currentPlan?.short_name || currentPlan?.name || 'VIP')} → ${String(toPlan?.short_name || toPlan?.name || 'VIP')}`.slice(0, 120),
          payment_method_id: 'pix',
          payer: { email: String(user.email || '').trim() },
          external_reference: orderId,
          metadata: {
            order_id: orderId,
            user_id: user.id,
            order_type: 'vip_upgrade',
            vip_plan_id: toPlan.id,
            vip_upgrade_from: currentPlan?.id || null,
            vip_upgrade_to: toPlan.id,
          },
          notification_url: `${origin}/api/mp-webhook`,
        }),
      });

      if (!paymentResp.ok) {
        console.error('mp create upgrade payment error', paymentResp.data);
        await sb.from('orders').update({ status: 'failed' }).eq('id', orderId);
        return res.status(paymentResp.status || 500).json({ error: 'Mercado Pago error' });
      }

      const payment = paymentResp.data || {};
      const tx = payment.point_of_interaction?.transaction_data || {};
      await sb.from('orders').update({ provider_payment_id: String(payment.id || '') }).eq('id', orderId);

      return res.status(200).json({
        order_id: orderId,
        id: String(payment.id || ''),
        status: payment.status,
        qr_code: tx.qr_code || null,
        qr_code_base64: tx.qr_code_base64 || null,
        ticket_url: tx.ticket_url || null,
      });
    }

    const mode = String(process.env.MP_MODE || "production").trim().toLowerCase();

    const requestedAmount = Number(body.amount);
    const couponCode = String(body.coupon_code || "").trim().toUpperCase();
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

    const vipPlanId = String(body.vip_plan_id || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    let subtotal = 0;
    for (const it of items) {
      const qty = Number(it?.qty) || 0;
      const price = Number(it?.price) || 0;
      if (qty > 0 && price > 0) subtotal += qty * price;
    }
    subtotal = Number(subtotal.toFixed(2));

    // Assinatura VIP pode vir sem itens no body; o servidor força o valor do plano.
    if (!vipPlanId) {
      if (!Number.isFinite(subtotal) || subtotal <= 0) {
        return res.status(400).json({ error: "Não foi possível calcular o valor do pedido. Atualize o carrinho e tente novamente." });
      }
    }
    // 1) Cria pedido no Supabase
    const sb = supabaseAdmin();

    // Assinatura VIP: não aceita cupom e força o preço do plano (configurável)
    let vipPlan = null;
    if (vipPlanId) {
      vipPlan = await getVipPlanById(sb, vipPlanId);
      if (!vipPlan) return res.status(400).json({ error: 'Plano VIP inválido.' });
      subtotal = Number(Number(vipPlan.price_brl || 0).toFixed(2));
    }

    let finalAmount = subtotal;
    let couponApplied = null;
    if (couponCode && !vipPlanId) {
      const { data: coupon } = await sb.from("coupons").select("*").eq("code", couponCode).maybeSingle();
      if (!coupon) return res.status(400).json({ error: "Cupom não encontrado." });
      const cpfGate = await ensureCouponCpfAllowed(sb, { coupon, currentUser: user });
      if (!cpfGate.ok) return res.status(cpfGate.status).json({ error: cpfGate.error });
      const calc = calcCouponDiscount({ subtotal, coupon });
      if (!calc.valid) return res.status(400).json({ error: "Cupom inválido, expirado ou já usado." });
      finalAmount = calc.final_total;
      couponApplied = { code: coupon.code, discount: calc.discount, label: coupon.label || coupon.code };
    }

    finalAmount = Number(Number(finalAmount).toFixed(2));
    if (!couponCode && Number.isFinite(requestedAmount) && requestedAmount > 0 && Math.abs(Number(requestedAmount.toFixed(2)) - finalAmount) > 0.05) {
      return res.status(400).json({ error: "O carrinho foi alterado. Revise os valores e tente novamente." });
    }
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ error: "O desconto deixou o valor do pedido inválido para Pix." });
    }

    const orderId = crypto.randomUUID();

    // tenta puxar nome/telefone do profile (se existir)
    const { data: prof } = await sb
      .from("profiles")
      .select("full_name,phone,cpf")
      .eq("id", user.id)
      .maybeSingle();

    if (vipPlanId) {
      // Para assinatura VIP, exigimos dados completos (mesmo padrão do cartão)
      const { data: profFull } = await sb
        .from('profiles')
        .select('full_name, phone, cpf, birthdate, address_line1, address_number, neighborhood, city, state, zip')
        .eq('id', user.id)
        .maybeSingle();
      const requiredFields = ['full_name','phone','cpf','birthdate','address_line1','address_number','neighborhood','city','state','zip'];
      const missing = requiredFields.filter((k) => !String(profFull?.[k] || '').trim());
      if (missing.length) {
        return res.status(400).json({ error: 'Profile incomplete', code: 'profile_incomplete', missing });
      }
    }

    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: finalAmount,
      payment_provider: "mercado_pago",
      production_status: vipPlanId ? 'editavel' : 'recebido',
      order_type: vipPlanId ? 'vip' : 'shop',
      vip_plan_id: vipPlanId || null,
      // Sempre salva o email do usuário autenticado.
      customer_email: payerEmail,
      customer_name: prof?.full_name || null,
      customer_phone: prof?.phone || null,
    });
    if (orderErr) {
      console.error("supabase order insert error", orderErr);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    const cleaned = (vipPlanId ? [{ name: `${vipPlanDisplayName(vipPlan)} (mensalidade)`, qty: 1, price: Number(vipPlan?.price_brl || 0), scale: vipPlan?.scale || '32mm', img: '' }] : items)
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

    if (couponApplied) {
      const { data: curr } = await sb.from("coupons").select("used_count").eq("code", couponApplied.code).maybeSingle();
      const nextUsed = (Number(curr?.used_count) || 0) + 1;
      const upd = await sb.from("coupons").update({ used_count: nextUsed }).eq("code", couponApplied.code).eq("user_id", user.id);
      if (upd?.error) console.error("coupon use update error", upd.error);
      const red = await sb.from("coupon_redemptions").insert({ coupon_code: couponApplied.code, user_id: user.id, order_id: orderId, discount_amount: couponApplied.discount });
      if (red?.error) console.error("coupon redemption insert error", red.error);
    }

    // 2) Cria pagamento Pix
    const idempotencyKey = crypto.randomUUID();
    const paymentResp = await mpFetch(token, "https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: finalAmount,
        description: String(body.description || (vipPlanId ? 'Assinatura Cubo Level 1 RPG' : "Pagamento via Pix")).slice(0, 120),
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
        },
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          user_id: user.id,
          order_type: vipPlanId ? 'vip' : 'shop',
          vip_plan_id: vipPlanId || null,
          coupon_code: couponApplied?.code || null,
          coupon_discount: couponApplied?.discount || 0,
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
