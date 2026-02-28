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
import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";
import { calcCouponDiscount } from "../server/couponGame.js";
import { getVipPlanById, listVipPlans, vipPlanDisplayName } from "../server/vipPlans.js";
import { z, safeJsonBody, validateBody } from "../server/validate.js";

export const config = { runtime: "nodejs" };

const BodySchema = z
  .object({
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
    vip_plan_id: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

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

    const mpToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!mpToken) {
      return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });
    }

    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return res.status(401).json({ error: "Faça login para pagar." });
    }

    
    // Valida profile antes de permitir pagamento (dados obrigatórios no checkout)
    const sb = supabaseAdmin();
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name, phone, cpf, birthdate, address_line1, address_number, neighborhood, city, state, zip")
      .eq("id", user.id)
      .maybeSingle();

    const requiredFields = [
      "full_name",
      "phone",
      "cpf",
      "birthdate",
      "address_line1",
      "address_number",
      "neighborhood",
      "city",
      "state",
      "zip",
    ];
    const missing = requiredFields.filter((k) => !String(profile?.[k] || "").trim());
    if (missing.length) {
      return res.status(400).json({
        error: "Profile incomplete",
        code: "profile_incomplete",
        missing,
      });
    }

    const bodyRaw = safeJsonBody(req);
    const v = validateBody(BodySchema, bodyRaw);
    if (!v.ok) return res.status(v.status).json({ error: v.error, details: v.details });
    const body = v.data;
    let vipPlanId = String(body.vip_plan_id || '').trim();
    let items = Array.isArray(body.items) ? body.items : [];
    const couponCode = String(body.coupon_code || "").trim().toUpperCase();

    const modeParam = String(getQueryParam(req, 'mode') || '').trim().toLowerCase();
    const modeBody = String(body.mode || '').trim().toLowerCase();
    const isVipUpgrade = (modeParam === 'vip_upgrade' || modeBody === 'vip_upgrade');
    const vipUpgradeToPlanId = String(body?.to_plan_id || body?.toPlanId || '').trim();

    // Upgrade VIP via Checkout Pro (cartão/pix no MP) — cobra apenas a diferença
    if (isVipUpgrade) {
      if (!vipUpgradeToPlanId) return res.status(400).json({ error: 'Plano de destino inválido.' });
      // precisa estar com VIP ativo
      const { data: prof } = await sb.from('profiles').select('vip_until,vip_plan').eq('id', user.id).maybeSingle();
      const vipUntilTs = prof?.vip_until ? new Date(prof.vip_until).getTime() : 0;
      if (!vipUntilTs || vipUntilTs <= Date.now()) return res.status(403).json({ error: 'Você precisa estar com VIP ativo para fazer upgrade.' });

      const plans = await listVipPlans(sb);
      const ordered = [...(plans || [])].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));

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
      const toPlan = ordered.find((p) => String(p?.id) === String(vipUpgradeToPlanId));
      if (!toPlan) return res.status(400).json({ error: 'Plano de destino não encontrado.' });

      const fromPrice = Number(currentPlan?.price_brl || 0);
      const toPrice = Number(toPlan?.price_brl || 0);
      const diff = Number((toPrice - fromPrice).toFixed(2));
      if (!Number.isFinite(diff) || diff <= 0) return res.status(400).json({ error: 'Este upgrade não está disponível.' });

      // Força o checkout para o plano de destino, mas cobrando apenas a diferença
      vipPlanId = String(toPlan.id);
      // sobrescreve itens para evitar cobrar a mensalidade cheia
      items = [{ id: 'VIP_UPGRADE', name: `Upgrade VIP ${vipPlanDisplayName(currentPlan)} → ${vipPlanDisplayName(toPlan)}`, qty: 1, price: diff }];
    }

    if (items.length === 0 && !vipPlanId) {
      return res.status(400).json({ error: "Carrinho vazio" });
    }

    // Assinatura VIP: força item/preço e não aceita cupom
    let vipPlan = null;
    if (vipPlanId) {
      vipPlan = await getVipPlanById(sb, vipPlanId);
      if (!vipPlan) return res.status(400).json({ error: 'Plano VIP inválido.' });
    }
    const effectiveItems = isVipUpgrade
      ? items
      : vipPlanId
        ? [{ id: vipPlan.id, name: `${vipPlanDisplayName(vipPlan)} (mensalidade)`, qty: 1, price: Number(vipPlan.price_brl || 0), scale: vipPlan.scale || '32mm', img: '' }]
        : items;

    // Total no servidor
    let total = 0;
    const cleanItems = [];
    for (const it of effectiveItems) {
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

    let finalTotal = Number(total.toFixed(2));
    let couponApplied = null;
    if (couponCode && !vipPlanId) {
      const { data: coupon } = await sb.from("coupons").select("*").eq("code", couponCode).maybeSingle();
      if (!coupon) return res.status(400).json({ error: "Cupom não encontrado." });
      const cpfGate = await ensureCouponCpfAllowed(sb, { coupon, currentUser: user });
      if (!cpfGate.ok) return res.status(cpfGate.status).json({ error: cpfGate.error });
      const calc = calcCouponDiscount({ subtotal: total, coupon });
      if (!calc.valid) return res.status(400).json({ error: "Cupom inválido, expirado ou já usado." });
      finalTotal = calc.final_total;
      couponApplied = { code: coupon.code, discount: calc.discount, label: coupon.label || coupon.code };
    }

    finalTotal = Number(Number(finalTotal).toFixed(2));
    if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
      return res.status(400).json({ error: "O desconto deixou o valor do pedido inválido para pagamento." });
    }

    const base = getBaseUrl(req);
    const orderId = crypto.randomUUID();

    // 1) Cria pedido no Supabase
    const { error: orderErr } = await sb.from("orders").insert({
      id: orderId,
      user_id: user.id,
      status: "pending",
      currency: "BRL",
      total: finalTotal,
      payment_provider: "mercadopago",
      production_status: isVipUpgrade ? 'upgrade' : (vipPlanId ? 'editavel' : 'recebido'),
      order_type: isVipUpgrade ? 'vip_upgrade' : (vipPlanId ? 'vip' : 'shop'),
      vip_plan_id: vipPlanId || null,
      customer_email: user.email || null,
    });

    if (orderErr) {
      console.error("supabase order insert error", orderErr);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    const orderItems = effectiveItems
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

    if (couponApplied) {
      const { data: curr } = await sb.from("coupons").select("used_count").eq("code", couponApplied.code).maybeSingle();
      const nextUsed = (Number(curr?.used_count) || 0) + 1;
      const upd = await sb.from("coupons").update({ used_count: nextUsed }).eq("code", couponApplied.code).eq("user_id", user.id);
      if (upd?.error) console.error("coupon use update error", upd.error);
      const red = await sb.from("coupon_redemptions").insert({ coupon_code: couponApplied.code, user_id: user.id, order_id: orderId, discount_amount: couponApplied.discount });
      if (red?.error) console.error("coupon redemption insert error", red.error);
    }

    // 2) Cria preferência no Mercado Pago
    const prefBody = {
      items: couponApplied && couponApplied.discount > 0 ? [...cleanItems, { title: `Desconto (${couponApplied.code})`, quantity: 1, unit_price: Number((-couponApplied.discount).toFixed(2)), currency_id: "BRL" }] : cleanItems,
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
        order_type: isVipUpgrade ? 'vip_upgrade' : (vipPlanId ? 'vip' : 'shop'),
        vip_plan_id: vipPlanId || null,
        coupon_code: couponApplied?.code || null,
        coupon_discount: couponApplied?.discount || 0,
        items_json: JSON.stringify(
          effectiveItems.map((i) => ({
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