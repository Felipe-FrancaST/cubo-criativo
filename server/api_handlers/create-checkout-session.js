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
import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";
import { calcCouponDiscount } from "../couponGame.js";
import { getVipPlanById, listVipPlans, vipPlanDisplayName } from "../vipPlans.js";
import { buildMercadoPagoItems, buildOrderItemsForInsert, buildVipOrderItems, buildVipUpgradeOrderItems, resolveStoreItems, serializeResolvedItems } from "../orderPricing.js";
import { rateLimit } from '../rateLimit.js';

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


async function getActiveVipCycleKey(sb) {
  try {
    const { data } = await sb.from('vip_cycle_control').select('active_cycle_key').eq('id', 'default').maybeSingle();
    const key = String(data?.active_cycle_key || '').trim();
    return key || null;
  } catch {
    return null;
  }
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



async function loadExistingOrderItems(sb, orderId) {
  const attemptNew = await sb
    .from("order_items")
    .select("order_id, product_id, product_name, qty, unit_price_cents, scale, product_image_url")
    .eq("order_id", orderId);

  if (!attemptNew?.error) {
    return (attemptNew.data || []).map((it) => ({
      id: it.product_id || null,
      name: it.product_name || 'Produto',
      qty: Number(it.qty || 1) || 1,
      price: Number(((Number(it.unit_price_cents || 0) || 0) / 100).toFixed(2)),
      scale: it.scale || '',
      img: it.product_image_url || '',
    }));
  }

  const attemptOld = await sb
    .from("order_items")
    .select("order_id, product_id, name, qty, unit_price, scale, img")
    .eq("order_id", orderId);

  if (attemptOld?.error) return [];

  return (attemptOld.data || []).map((it) => ({
    id: it.product_id || null,
    name: it.name || 'Produto',
    qty: Number(it.qty || 1) || 1,
    price: Number(Number(it.unit_price || 0).toFixed(2)),
    scale: it.scale || '',
    img: it.img || '',
  }));
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
  
  if (!rateLimit(req, res, { key: 'api:checkout', limit: 25, windowMs: 60000 })) return;
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

    const body = safeBody(req);
    const retryOrderId = String(body.retry_order_id || body.order_id || '').trim();
    let vipPlanId = String(body.vip_plan_id || '').trim();
    let items = Array.isArray(body.items) ? body.items : [];
    let vipUpgradeFromPlanId = '';
    let vipUpgradeToPlanMeta = '';
    const couponCode = String(body.coupon_code || "").trim().toUpperCase();

    const modeParam = String(getQueryParam(req, 'mode') || '').trim().toLowerCase();
    const modeBody = String(body.mode || '').trim().toLowerCase();
    const isVipUpgrade = (modeParam === 'vip_upgrade' || modeBody === 'vip_upgrade');
    const vipUpgradeToPlanId = String(body?.to_plan_id || body?.toPlanId || '').trim();

    if (retryOrderId) {
      const { data: existingOrder, error: existingOrderErr } = await sb
        .from("orders")
        .select("id,user_id,status,total,payment_provider,order_type,coupon_code,coupon_discount")
        .eq("id", retryOrderId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingOrderErr || !existingOrder) {
        return res.status(404).json({ error: "Pedido não encontrado." });
      }

      if (String(existingOrder.order_type || 'shop').toLowerCase() !== 'shop') {
        return res.status(400).json({ error: "Este tipo de pedido não pode ser pago novamente por aqui." });
      }

      if (String(existingOrder.status || '').toLowerCase() === 'paid') {
        return res.status(400).json({ error: "Este pedido já foi pago." });
      }

      const retryItems = await loadExistingOrderItems(sb, retryOrderId);
      if (!retryItems.length) {
        return res.status(400).json({ error: "Este pedido está sem itens para reenviar ao pagamento." });
      }

      const cleanRetryItems = buildMercadoPagoItems(retryItems);
      if (!cleanRetryItems.length) {
        return res.status(400).json({ error: "Não foi possível montar os itens do pagamento." });
      }

      const prefBody = {
        items: cleanRetryItems,
        payer: { email: user.email || undefined },
        external_reference: retryOrderId,
        notification_url: `${base}/api/mp-webhook`,
        back_urls: {
          success: `${base}/?payment=success&provider=mercadopago&order_id=${retryOrderId}`,
          pending: `${base}/?payment=pending&provider=mercadopago&order_id=${retryOrderId}`,
          failure: `${base}/?payment=cancel&provider=mercadopago&order_id=${retryOrderId}`,
        },
        auto_return: "approved",
        statement_descriptor: "CUBOCRIATIVO",
        metadata: {
          order_id: retryOrderId,
          user_id: user.id,
          order_type: 'shop',
          coupon_code: existingOrder.coupon_code || null,
          coupon_discount: Number(existingOrder.coupon_discount || 0) || 0,
          items_json: serializeResolvedItems(retryItems),
          retry_payment: true,
        },
      };

      const retryResp = await mpCreatePreference({ accessToken: mpToken, body: prefBody });
      if (!retryResp.ok) {
        console.error("mercadopago retry preference error", retryResp.data);
        return res.status(500).json({ error: "Não foi possível reabrir o pagamento.", details: retryResp.data });
      }

      const retryUrl = retryResp.data?.init_point;
      const retryPrefId = retryResp.data?.id;
      if (retryPrefId) {
        await sb.from("orders").update({ provider_payment_id: String(retryPrefId), payment_provider: 'mercadopago', status: 'pending' }).eq("id", retryOrderId);
      }

      if (!retryUrl) {
        return res.status(500).json({ error: "Preferência sem URL" });
      }

      return res.status(200).json({ url: retryUrl, order_id: retryOrderId, retried: true });
    }

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
      vipUpgradeFromPlanId = String(currentPlan?.id || '');
      vipUpgradeToPlanMeta = String(toPlan.id);
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
    let resolvedOrderItems = [];
    if (isVipUpgrade) {
      const plans = await listVipPlans(sb);
      const ordered = [...(plans || [])].sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
      const currentPlan = ordered.find((p) => String(p?.id) === vipUpgradeFromPlanId) || ordered[0];
      const toPlan = ordered.find((p) => String(p?.id) === vipUpgradeToPlanMeta);
      const fromPrice = Number(currentPlan?.price_brl || 0);
      const toPrice = Number(toPlan?.price_brl || 0);
      const diff = Number((toPrice - fromPrice).toFixed(2));
      resolvedOrderItems = buildVipUpgradeOrderItems({ currentPlan, toPlan, diff });
    } else if (vipPlanId) {
      resolvedOrderItems = buildVipOrderItems(vipPlan);
    } else {
      const resolved = await resolveStoreItems(sb, items);
      if (!resolved.ok) {
        return res.status(resolved.status || 400).json({ error: resolved.error, code: resolved.code || null });
      }
      resolvedOrderItems = resolved.items;
    }

    const cleanItems = buildMercadoPagoItems(resolvedOrderItems);
    const total = Number(resolvedOrderItems.reduce((sum, item) => sum + ((Number(item.unit_price) || 0) * (Number(item.qty) || 0)), 0).toFixed(2));
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
    const activeVipCycleKey = vipPlanId ? (await getActiveVipCycleKey(sb)) : null;

    // 1) Cria pedido no Supabase
    let orderInsert = await sb.from("orders").insert({
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
      coupon_code: couponApplied?.code || null,
      coupon_discount: couponApplied?.discount || 0,
    });

    if (orderInsert?.error && /coupon_code|coupon_discount|column/i.test(String(orderInsert.error.message || ""))) {
      orderInsert = await sb.from("orders").insert({
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
    }

    if (orderInsert?.error) {
      console.error("supabase order insert error", orderInsert.error);
      return res.status(500).json({ error: "Não foi possível criar o pedido." });
    }

    const orderItems = buildOrderItemsForInsert(orderId, resolvedOrderItems);

    if (orderItems.length) {
      const payloadNew = orderItems.map((it) => ({
        order_id: orderId,
        product_id: it.product_id,
        product_name: it.name,
        scale: it.scale,
        qty: it.qty,
        unit_price_cents: Math.round((Number(it.unit_price || 0) || 0) * 100),
        product_image_url: it.img,
      }));

      const attemptNew = await sb.from("order_items").insert(payloadNew);
      if (attemptNew?.error) {
        const payloadOld = orderItems.map((it) => ({
          order_id: orderId,
          product_id: it.product_id,
          name: it.name,
          scale: it.scale,
          qty: it.qty,
          unit_price: it.unit_price,
          img: it.img,
        }));
        const attemptOld = await sb.from("order_items").insert(payloadOld);
        if (attemptOld?.error) {
          console.error("supabase order_items insert error", attemptOld.error);
        }
      }
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
        vip_cycle_key: activeVipCycleKey || null,
        vip_upgrade_from: vipUpgradeFromPlanId || null,
        vip_upgrade_to: vipUpgradeToPlanMeta || null,
        coupon_code: couponApplied?.code || null,
        coupon_discount: couponApplied?.discount || 0,
        items_json: serializeResolvedItems(resolvedOrderItems),
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