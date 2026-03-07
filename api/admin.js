/**
 * Admin multiplexer (Hobby plan friendly)
 *
 * This file consolidates multiple admin endpoints into a single Serverless Function
 * to stay under Vercel Hobby's function limit.
 *
 * Legacy routes kept via rewrites in vercel.json:
 * - /api/admin/orders       -> /api/admin?action=orders
 * - /api/admin/update-order -> /api/admin?action=update-order
 * - /api/admin/vip-voting   -> /api/admin?action=vip-voting
 * - /api/admin/vip-close-voting -> /api/admin?action=vip-close-voting
 * - /api/admin/vip-start-voting -> /api/admin?action=vip-start-voting
 */

import { supabaseAdmin } from "../server/supabase.js";
import { requireAdmin } from "../server/admin/adminAuth.js";
import { renderOrderStatusEmail } from "../server/emailTemplates.js";
import { rateLimit } from '../server/rateLimit.js';
import { formatRewardLabel } from '../server/couponGame.js';

export const config = { runtime: "nodejs" };

// Vercel Node runtimes may not populate req.body automatically.
// This helper reads JSON body safely from either req.body or the raw stream.
async function readJsonBody(req) {
  // If some middleware populated req.body, use it.
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (typeof req.body === "object") return req.body;
  }

  // Fallback: read the raw request stream.
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// -----------------------------
// Shared helpers (update-order)
// -----------------------------

const ALLOWED_PROD_STATUS = new Set([
  "editavel",
  "recebido",
  "em_producao",
  "pronto",
  "enviado",
  "entregue",
  "cancelado",
  "reembolsado",
]);

async function sendResendEmail({ to, subject, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  if (!apiKey || !from || !to) return { skipped: true };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

async function resolveCustomerEmail(sb, order) {
  let email = String(order?.customer_email || "").trim();
  if (email && /@/.test(email)) return email;

  const userId = order?.user_id;
  if (!userId) return "";

  try {
    const resp = await sb.auth.admin.getUserById(userId);
    const authEmail = String(resp?.data?.user?.email || "").trim();
    if (authEmail && /@/.test(authEmail)) {
      try {
        await sb.from("orders").update({ customer_email: authEmail }).eq("id", order.id);
      } catch {}
      return authEmail;
    }
  } catch (e) {
    console.error("resolveCustomerEmail error", e);
  }

  return "";
}

async function notifyStatus({ sb, order, nextStatus, shipping_tracking, production_eta, cancelled_by }) {
  const to = await resolveCustomerEmail(sb, order);
  if (!to) return;

  const shortId = String(order.id || "").slice(0, 8);
  const baseUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const reviewLink = baseUrl ? `${baseUrl}/#/conta` : "";

  const brandName = process.env.BRAND_NAME || "Cubo Criativo";
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || "";
  const whatsapp = process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || "";

  const mail = renderOrderStatusEmail({
    brandName,
    orderId: order?.id,
    customerName: order?.customer_name,
    nextStatus,
    shippingTracking: shipping_tracking || order?.shipping_tracking || "",
    productionEta: production_eta || order?.production_eta || "",
    cancelledBy: cancelled_by || "",
    reviewLink,
    supportEmail,
    whatsapp,
    orderType: order?.order_type || "shop",
    vipPlanId: order?.vip_plan_id || "",
  });

  await sendResendEmail({ to, subject: mail.subject || `Atualização do pedido — ${shortId}`, html: mail.html });
}

// -----------------------------
// Action handlers
// -----------------------------


async function handleGetGameCoupon(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("coupon_game_settings")
    .select("id,label,discount_type,discount_value,min_order_value,active,created_at,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || "");
    if (/coupon_game_settings|relation|does not exist/i.test(msg)) {
      return res.status(500).json({
        error: "Tabela coupon_game_settings não encontrada no Supabase.",
        needs_setup: true,
      });
    }
    return res.status(500).json({ error: error.message || "Failed to load game coupon" });
  }

  return res.status(200).json({ config: data || null });
}

async function handleSaveGameCoupon(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const discount_type = String(body?.discount_type || "").trim().toLowerCase();
  const discount_value = Number(body?.discount_value || 0);
  const min_order_value = Math.max(0, Number(body?.min_order_value || 0));
  const customLabel = String(body?.label || "").trim();

  if (!["percent", "fixed_min", "shipping_reduced"].includes(discount_type)) {
    return res.status(400).json({ error: "discount_type inválido." });
  }
  if (!(discount_value > 0)) {
    return res.status(400).json({ error: "Informe um valor de desconto maior que zero." });
  }
  if (discount_type === "percent" && discount_value > 100) {
    return res.status(400).json({ error: "Porcentagem não pode ser maior que 100." });
  }

  const sb = supabaseAdmin();
  const payload = {
    label: customLabel || formatRewardLabel({ type: discount_type, discount_value, min_order_value }),
    discount_type,
    discount_value,
    min_order_value,
    active: true,
    updated_at: new Date().toISOString(),
  };

  const deactivate = await sb.from("coupon_game_settings").update({ active: false }).eq("active", true);
  if (deactivate?.error) {
    const msg = String(deactivate.error.message || "");
    if (/coupon_game_settings|relation|does not exist/i.test(msg)) {
      return res.status(500).json({
        error: "Tabela coupon_game_settings não encontrada no Supabase.",
        needs_setup: true,
      });
    }
    return res.status(500).json({ error: deactivate.error.message || "Failed to reset old config" });
  }

  const ins = await sb
    .from("coupon_game_settings")
    .insert(payload)
    .select("id,label,discount_type,discount_value,min_order_value,active,created_at,updated_at")
    .single();

  if (ins?.error) {
    const msg = String(ins.error.message || "");
    if (/coupon_game_settings|relation|does not exist/i.test(msg)) {
      return res.status(500).json({
        error: "Tabela coupon_game_settings não encontrada no Supabase.",
        needs_setup: true,
      });
    }
    return res.status(500).json({ error: ins.error.message || "Failed to save game coupon" });
  }

  return res.status(200).json({ ok: true, config: ins.data });
}


function isPaidOrderStatus(value) {
  return String(value || "").trim().toLowerCase() === "paid";
}

function sumMoney(rows, field) {
  return Number(
    (Array.isArray(rows) ? rows : []).reduce((acc, row) => acc + (Number(row?.[field]) || 0), 0).toFixed(2)
  );
}

async function selectOrdersWithCouponFallback(sb) {
  const withCouponCols = await sb
    .from("orders")
    .select("id,status,total,coupon_code,coupon_discount,created_at")
    .not("coupon_code", "is", null);

  if (!withCouponCols?.error) {
    return { rows: Array.isArray(withCouponCols.data) ? withCouponCols.data : [], hasCouponColumns: true };
  }

  const msg = String(withCouponCols?.error?.message || "");
  if (!/coupon_code|coupon_discount|column/i.test(msg)) {
    throw new Error(withCouponCols.error.message || "Failed to load coupon orders");
  }

  const legacy = await sb
    .from("coupon_redemptions")
    .select("order_id,discount_amount,coupon_code,created_at")
    .order("created_at", { ascending: false });

  if (legacy?.error) throw new Error(legacy.error.message || "Failed to load coupon redemptions");

  const orderIds = [...new Set((legacy.data || []).map((item) => item?.order_id).filter(Boolean))];
  let ordersById = new Map();
  if (orderIds.length) {
    const ordersResp = await sb
      .from("orders")
      .select("id,status,total,created_at")
      .in("id", orderIds);
    if (ordersResp?.error) {
      throw new Error(ordersResp.error.message || "Failed to load legacy coupon orders");
    }
    ordersById = new Map((ordersResp.data || []).map((row) => [String(row.id), row]));
  }

  const rows = (legacy.data || []).map((item) => {
    const order = ordersById.get(String(item?.order_id || "")) || null;
    return {
      id: order?.id || item?.order_id,
      status: order?.status || null,
      total: Number(order?.total || 0),
      coupon_code: item?.coupon_code || null,
      coupon_discount: Number(item?.discount_amount || 0),
      created_at: order?.created_at || item?.created_at || null,
    };
  });

  return { rows, hasCouponColumns: false };
}

async function selectGeneratedCouponsCount(sb) {
  const direct = await sb
    .from("coupons")
    .select("code", { count: "exact", head: true })
    .in("source", ["memory_game", "memory_game_perfect"]);

  if (!direct?.error) {
    return Number(direct.count || 0);
  }

  const msg = String(direct?.error?.message || "");
  if (!/source|column|coupons|relation|does not exist/i.test(msg)) {
    throw new Error(direct.error.message || "Failed to load generated coupons");
  }

  const bySessionCoupon = await sb
    .from("coupon_game_sessions")
    .select("coupon_code");

  if (bySessionCoupon?.error) {
    const sessionMsg = String(bySessionCoupon.error.message || "");
    if (/coupon_code|column/i.test(sessionMsg)) return 0;
    throw new Error(bySessionCoupon.error.message || "Failed to load generated coupons");
  }

  const codes = new Set(
    (bySessionCoupon.data || []).map((row) => String(row?.coupon_code || "").trim()).filter(Boolean)
  );
  return codes.size;
}


async function handleGameCouponMetrics(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();

  const sessionsResp = await sb
    .from("coupon_game_sessions")
    .select("user_id,won,played_at");

  if (sessionsResp?.error) {
    const msg = String(sessionsResp.error.message || "");
    if (/coupon_game_sessions|relation|does not exist/i.test(msg)) {
      return res.status(500).json({
        error: "Tabela coupon_game_sessions não encontrada no Supabase.",
        needs_setup: true,
      });
    }
    return res.status(500).json({ error: sessionsResp.error.message || "Failed to load game metrics" });
  }

  const sessions = Array.isArray(sessionsResp.data) ? sessionsResp.data : [];
  const uniquePlayers = new Set(
    sessions.map((row) => String(row?.user_id || "").trim()).filter(Boolean)
  );
  const wins = sessions.filter((row) => Boolean(row?.won));
  const uniqueWinners = new Set(
    wins.map((row) => String(row?.user_id || "").trim()).filter(Boolean)
  );
  let couponOrdersInfo;
  try {
    couponOrdersInfo = await selectOrdersWithCouponFallback(sb);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load coupon orders" });
  }

  const couponOrders = couponOrdersInfo.rows || [];
  const appliedOrders = couponOrders.filter((row) => String(row?.coupon_code || "").trim());
  const convertedOrders = appliedOrders.filter((row) => isPaidOrderStatus(row?.status));

  let generatedCouponsCount = 0;
  try {
    generatedCouponsCount = await selectGeneratedCouponsCount(sb);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load generated coupons" });
  }

  const revenueGenerated = sumMoney(convertedOrders, "total");
  const discountGranted = sumMoney(convertedOrders, "coupon_discount");
  const conversionRate = wins.length > 0 ? Number(((convertedOrders.length / wins.length) * 100).toFixed(1)) : 0;

  return res.status(200).json({
    metrics: {
      players_count: uniquePlayers.size,
      wins_count: wins.length,
      unique_winners_count: uniqueWinners.size,
      coupons_generated_count: generatedCouponsCount,
      coupons_applied_count: appliedOrders.length,
      purchases_with_coupon_count: convertedOrders.length,
      revenue_generated_brl: revenueGenerated,
      discount_granted_brl: discountGranted,
      coupon_conversion_rate: conversionRate,
      coupon_orders_using_fallback: !couponOrdersInfo.hasCouponColumns,
    },
  });
}


async function handleOrders(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();

  // Compatibilidade: alguns bancos ainda não têm refund_requested/refund_requested_at.
  // Tentamos buscar com as colunas novas; se falhar por coluna inexistente, buscamos sem elas.
  let orders = null;
  let ordersErr = null;

  const selectWithRefund =
    "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id,refund_requested,refund_requested_at";
  const selectLegacy =
    "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id";

  const attemptOrdersNew = await sb
    .from("orders")
    .select(selectWithRefund)
    .order("created_at", { ascending: false })
    .limit(300);

  orders = attemptOrdersNew?.data || null;
  ordersErr = attemptOrdersNew?.error || null;

  if (ordersErr && /refund_requested|refund_requested_at|column/i.test(String(ordersErr.message || ""))) {
    const attemptOrdersOld = await sb
      .from("orders")
      .select(selectLegacy)
      .order("created_at", { ascending: false })
      .limit(300);
    orders = attemptOrdersOld?.data || null;
    ordersErr = attemptOrdersOld?.error || null;
  }

  if (ordersErr) return res.status(500).json({ error: ordersErr.message || "Failed to load orders" });

  const list = Array.isArray(orders) ? orders : [];
  if (list.length === 0) return res.status(200).json({ orders: [] });

  const orderIds = list.map((o) => o.id);
  const userIds = Array.from(new Set(list.map((o) => o.user_id).filter(Boolean)));

  const [{ data: profiles, error: profErr }] = await Promise.all([
    userIds.length
      ? sb
          .from("profiles")
          .select("id,full_name,phone,address_line1,address_line2,neighborhood,city,state,zip")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Itens: tenta schema novo, depois schema antigo
  let items = [];
  let itemsErr = null;

  const attemptItemsNew = await sb
    .from("order_items")
    .select("order_id,product_name,qty,unit_price_cents,scale,product_image_url")
    .in("order_id", orderIds);

  if (attemptItemsNew?.error) {
    const attemptItemsOld = await sb
      .from("order_items")
      .select("order_id,name,qty,unit_price,scale,img")
      .in("order_id", orderIds);

    items = attemptItemsOld?.data || [];
    itemsErr = attemptItemsOld?.error || null;
  } else {
    items = attemptItemsNew?.data || [];
    itemsErr = null;
  }

  if (itemsErr) return res.status(500).json({ error: itemsErr.message || "Failed to load order items" });
  if (profErr) return res.status(500).json({ error: profErr.message || "Failed to load profiles" });

  const itemsByOrder = new Map();
  (items || []).forEach((it) => {
    const k = it.order_id;
    if (!itemsByOrder.has(k)) itemsByOrder.set(k, []);

    itemsByOrder.get(k).push({
      order_id: it.order_id,
      name: it.product_name || it.name,
      qty: it.qty,
      scale: it.scale,
      img: it.product_image_url || it.img,
      unit_price:
        typeof it.unit_price === "number"
          ? it.unit_price
          : typeof it.unit_price_cents === "number"
          ? it.unit_price_cents / 100
          : null,
    });
  });

  const profileById = new Map();
  (profiles || []).forEach((p) => profileById.set(p.id, p));

  // VIP selections: map selection to the order's cycle (YYYY-MM) so old VIP orders also show their picks.
  const vipOrders = (list || []).filter((o) => String(o.order_type || "").toLowerCase() === "vip" && o.user_id);
  const vipUserIds = Array.from(new Set(vipOrders.map((o) => o.user_id).filter(Boolean)));
  const vipCycles = Array.from(
    new Set(
      vipOrders
        .map((o) => {
          const c = String(o.created_at || "");
          return c && c.length >= 7 ? c.slice(0, 7) : null;
        })
        .filter(Boolean)
    )
  );

  const vipSelByUserCycle = new Map();
  if (vipUserIds.length && vipCycles.length) {
    const [{ data: sels }, { data: opts }] = await Promise.all([
      sb
        .from("vip_mini_selections")
        .select("user_id,cycle_key,selected_option_ids,updated_at")
        .in("user_id", vipUserIds)
        .in("cycle_key", vipCycles),
      // image_url permite mostrar as miniaturas no admin
      sb.from("vip_mini_options").select("id,title,image_url"),
    ]);

    const optById = new Map((opts || []).map((o) => [String(o.id), o]));
    (sels || []).forEach((sel) => {
      const ids = Array.isArray(sel.selected_option_ids) ? sel.selected_option_ids : [];
      const selectedOptions = ids
        .map((id) => {
          const o = optById.get(String(id));
          if (!o) return null;
          return { id: o.id, title: o.title, image_url: o.image_url || null };
        })
        .filter(Boolean);

      vipSelByUserCycle.set(`${sel.user_id}:${sel.cycle_key}`, {
        cycle_key: sel.cycle_key,
        updated_at: sel.updated_at || null,
        selected_titles: selectedOptions.map((x) => x.title).filter(Boolean),
        selected_options: selectedOptions,
      });
    });
  }

  const merged = list.map((o) => ({
    ...o,
    profile: o.user_id ? profileById.get(o.user_id) || null : null,
    order_items: itemsByOrder.get(o.id) || [],
    vip_selection:
      String(o.order_type || "").toLowerCase() === "vip" && o.user_id
        ? vipSelByUserCycle.get(`${o.user_id}:${String(o.created_at || "").slice(0, 7)}`) || null
        : null,
  }));

  return res.status(200).json({ orders: merged });
}


async function handleDeleteOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const orderId = String(body?.order_id || "").trim();
  if (!orderId) return res.status(400).json({ error: "Missing order_id" });

  const sb = supabaseAdmin();

  // Delete children first (if table exists / FK not cascade).
  try {
    await sb.from("order_items").delete().eq("order_id", orderId);
  } catch (e) {
    // ignore (table may not exist in some deployments)
  }

  const { error: delErr } = await sb.from("orders").delete().eq("id", orderId);
  if (delErr) return res.status(500).json({ error: delErr.message || "Failed to delete order" });

  return res.status(200).json({ ok: true });
}

async function handleVipVoting(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();

  const monthKey = String(req.query?.month_key || "").trim();
  const limit = Math.min(12, Math.max(1, Number(req.query?.limit || 6) || 6));

  let pollsQuery = sb
    .from("vip_theme_polls")
    // winner_option_id/closed_at are optional columns (the code is tolerant if they don't exist)
    .select("id,month_key,title,status,winner_option_id,closed_at,created_at,updated_at")
    .order("month_key", { ascending: false })
    .limit(limit);

  if (monthKey) pollsQuery = pollsQuery.eq("month_key", monthKey);

  let { data: polls, error: pollsErr } = await pollsQuery;
  if (pollsErr) {
    const msg = String(pollsErr.message || "");
    // Backward compatibility: DB may not have winner columns yet
    if (/winner_option_id|closed_at|column/i.test(msg)) {
      let fallbackQuery = sb
        .from("vip_theme_polls")
        .select("id,month_key,title,status,created_at,updated_at")
        .order("month_key", { ascending: false })
        .limit(limit);
      if (monthKey) fallbackQuery = fallbackQuery.eq("month_key", monthKey);
      const fb = await fallbackQuery;
      polls = fb.data;
      pollsErr = fb.error;
    }
  }
  if (pollsErr) return res.status(500).json({ error: pollsErr.message || "Failed to load polls" });

  const pollList = Array.isArray(polls) ? polls : [];
  if (!pollList.length) return res.status(200).json({ polls: [] });

  const pollIds = pollList.map((p) => p.id);

  const [{ data: options, error: optErr }, { data: votes, error: voteErr }] = await Promise.all([
    sb
      .from("vip_theme_options")
      .select("id,poll_id,title,description,image_url,sort_order,active,created_at")
      .in("poll_id", pollIds)
      .order("sort_order", { ascending: true }),
    sb.from("vip_theme_votes").select("poll_id,option_id").in("poll_id", pollIds),
  ]);

  if (optErr) return res.status(500).json({ error: optErr.message || "Failed to load options" });
  if (voteErr) return res.status(500).json({ error: voteErr.message || "Failed to load votes" });

  const counts = new Map();
  (votes || []).forEach((v) => {
    const k = `${v.poll_id}:${v.option_id}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const optionsByPoll = new Map();
  (options || []).forEach((o) => {
    const pid = String(o.poll_id);
    if (!optionsByPoll.has(pid)) optionsByPoll.set(pid, []);
    optionsByPoll.get(pid).push({
      ...o,
      votes: counts.get(`${o.poll_id}:${o.id}`) || 0,
    });
  });

  const result = pollList.map((p) => {
    const opts = optionsByPoll.get(String(p.id)) || [];
    const totalVotes = opts.reduce((acc, it) => acc + (Number(it.votes) || 0), 0);
    return {
      poll: p,
      total_votes: totalVotes,
      options: opts.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        image_url: o.image_url,
        sort_order: o.sort_order,
        active: o.active,
        votes: o.votes,
        pct: totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0,
      })),
    };
  });

  return res.status(200).json({ polls: result });
}

async function handleVipCloseVoting(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const poll_id = String(body.poll_id || "").trim();
  const winner_option_id = body.winner_option_id;
  if (!poll_id) return res.status(400).json({ error: "Missing poll_id" });
  if (!winner_option_id) return res.status(400).json({ error: "Missing winner_option_id" });

  const sb = supabaseAdmin();

  // Validate option belongs to poll
  const { data: opt, error: optErr } = await sb
    .from("vip_theme_options")
    .select("id,poll_id,title")
    .eq("id", winner_option_id)
    .maybeSingle();
  if (optErr) return res.status(500).json({ error: optErr.message || "Failed to validate option" });
  if (!opt || String(opt.poll_id) !== String(poll_id)) {
    return res.status(400).json({ error: "Opção inválida para esta votação." });
  }

  // Close poll + persist winner. Some projects may not yet have winner columns;
  // in that case, we still at least flip status to 'closed'.
  const patch = {
    status: "closed",
    winner_option_id,
    closed_at: new Date().toISOString(),
  };

  let upd = await sb.from("vip_theme_polls").update(patch).eq("id", poll_id);
  if (upd?.error) {
    const msg = String(upd.error.message || "");
    // Fallback if winner columns don't exist in the DB
    if (/winner_option_id|closed_at|column/i.test(msg)) {
      const upd2 = await sb.from("vip_theme_polls").update({ status: "closed" }).eq("id", poll_id);
      if (upd2?.error) return res.status(500).json({ error: upd2.error.message || "Failed to close poll" });
    } else {
      return res.status(500).json({ error: upd.error.message || "Failed to close poll" });
    }
  }

  return res.status(200).json({ ok: true, poll_id, winner_option_id, winner_title: opt.title || null });
}

async function handleVipStartVoting(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const month_key = String(body.month_key || "").trim();
  const title = String(body.title || "").trim();
  const options = Array.isArray(body.options) ? body.options : [];

  if (!month_key || !/^\d{4}-\d{2}$/.test(month_key)) {
    return res.status(400).json({ error: "month_key inválido. Use formato YYYY-MM." });
  }
  if (!title) return res.status(400).json({ error: "Título/pergunta é obrigatório." });
  if (options.length < 2) return res.status(400).json({ error: "Inclua pelo menos 2 opções." });

  const cleanOptions = options
    .map((o, idx) => ({
      title: String(o?.title || "").trim(),
      description: String(o?.description || "").trim() || null,
      image_url: String(o?.image_url || "").trim() || null,
      sort_order: Number.isFinite(Number(o?.sort_order)) ? Number(o.sort_order) : idx,
      active: o?.active === false ? false : true,
    }))
    .filter((o) => o.title);

  if (cleanOptions.length < 2) return res.status(400).json({ error: "Opções inválidas." });

  const sb = supabaseAdmin();

  // Enforce: only one open poll at a time.
  const { data: openPoll, error: openErr } = await sb
    .from("vip_theme_polls")
    .select("id,month_key,status")
    .eq("status", "open")
    .maybeSingle();
  if (openErr && !/multiple/i.test(String(openErr.message || ""))) {
    return res.status(500).json({ error: openErr.message || "Falha ao verificar votação aberta." });
  }
  if (openPoll?.id) {
    return res
      .status(400)
      .json({ error: `Já existe uma votação aberta (${openPoll.month_key}). Encerre antes de criar outra.` });
  }

  // Prevent duplicate month_key polls
  const { data: existingMonth, error: exErr } = await sb
    .from("vip_theme_polls")
    .select("id")
    .eq("month_key", month_key)
    .limit(1);
  if (exErr) return res.status(500).json({ error: exErr.message || "Falha ao validar mês." });
  if (Array.isArray(existingMonth) && existingMonth.length) {
    return res.status(400).json({ error: `Já existe votação cadastrada para ${month_key}.` });
  }

  const { data: poll, error: pollErr } = await sb
    .from("vip_theme_polls")
    .insert({ month_key, title, status: "open" })
    .select("id,month_key,title,status,created_at")
    .single();
  if (pollErr) return res.status(500).json({ error: pollErr.message || "Falha ao criar votação." });

  const optionRows = cleanOptions.map((o, idx) => ({
    poll_id: poll.id,
    title: o.title,
    description: o.description,
    image_url: o.image_url,
    sort_order: Number.isFinite(Number(o.sort_order)) ? Number(o.sort_order) : idx,
    active: o.active,
  }));

  const { error: optErr } = await sb.from("vip_theme_options").insert(optionRows);
  if (optErr) {
    // rollback poll if options insert fails
    try {
      await sb.from("vip_theme_polls").delete().eq("id", poll.id);
    } catch {}
    return res.status(500).json({ error: optErr.message || "Falha ao criar opções." });
  }

  return res.status(200).json({ ok: true, poll });
}

async function handleVipDeleteVoting(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const poll_id = String(body.poll_id || "").trim();
  if (!poll_id) return res.status(400).json({ error: "Missing poll_id" });

  const sb = supabaseAdmin();

  // Best-effort: delete children first (votes/options) then poll.
  // This works regardless of FK cascade setup.
  const delVotes = await sb.from("vip_theme_votes").delete().eq("poll_id", poll_id);
  if (delVotes?.error) return res.status(500).json({ error: delVotes.error.message || "Failed to delete votes" });

  const delOpts = await sb.from("vip_theme_options").delete().eq("poll_id", poll_id);
  if (delOpts?.error) return res.status(500).json({ error: delOpts.error.message || "Failed to delete options" });

  const delPoll = await sb.from("vip_theme_polls").delete().eq("id", poll_id);
  if (delPoll?.error) return res.status(500).json({ error: delPoll.error.message || "Failed to delete poll" });

  return res.status(200).json({ ok: true, poll_id });
}

async function handleUpdateOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const order_id = String(body.order_id || "").trim();
  if (!order_id) return res.status(400).json({ error: "Missing order_id" });

  const sb = supabaseAdmin();

  const { data: currentOrder, error: currentErr } = await sb
    .from("orders")
    .select(
      "id,user_id,order_type,vip_plan_id,status,production_status,shipping_tracking,customer_email,customer_name"
    )
    .eq("id", order_id)
    .maybeSingle();

  if (currentErr) return res.status(500).json({ error: currentErr.message || "Failed to load order" });
  if (!currentOrder) return res.status(404).json({ error: "Pedido não encontrado." });

  const next = {};
  if (body.production_status !== undefined) {
    const ps = String(body.production_status || "").trim().toLowerCase();
    if (!ALLOWED_PROD_STATUS.has(ps)) return res.status(400).json({ error: "Invalid production_status" });
    next.production_status = ps;
  }
  if (body.shipping_tracking !== undefined) {
    const tr = String(body.shipping_tracking || "").trim();
    next.shipping_tracking = tr || null;
    // Keep new columns in sync when available
    next.tracking_code = tr || null;
  }
  if (body.tracking_code !== undefined) {
    const tc = String(body.tracking_code || "").trim();
    next.tracking_code = tc || null;
  }
  if (body.tracking_url !== undefined) {
    const tu = String(body.tracking_url || "").trim();
    next.tracking_url = tu || null;
  }

  const production_eta = String(body.production_eta || "").trim();
  const cancelled_by = String(body.cancelled_by || "").trim().toLowerCase();
  if (Object.keys(next).length === 0 && !production_eta)
    return res.status(400).json({ error: "No fields to update" });

  const currentPay = String(currentOrder?.status || "").toLowerCase();
  const wantsOrderFlowChange =
    Object.prototype.hasOwnProperty.call(next, "production_status") ||
    Object.prototype.hasOwnProperty.call(next, "shipping_tracking");
  if (wantsOrderFlowChange && currentPay !== "paid") {
    return res
      .status(400)
      .json({ error: "Só é possível alterar status/rastreio de pedidos com pagamento confirmado." });
  }

  if (production_eta) next.production_eta = production_eta;

  let updateResp = await sb.from("orders").update(next).eq("id", order_id);

  // Some deployments may not have every optional column yet. If we hit a missing-column error,
  // retry the update with those optional fields removed.
  if (updateResp?.error && /column/i.test(String(updateResp.error.message || ""))) {
    const msg = String(updateResp.error.message || "");
    const retry = { ...next };

    if (/production_eta/i.test(msg)) delete retry.production_eta;
    if (/tracking_code/i.test(msg)) delete retry.tracking_code;
    if (/tracking_url/i.test(msg)) delete retry.tracking_url;

    // Only retry if we actually removed something.
    if (Object.keys(retry).length !== Object.keys(next).length) {
      updateResp = await sb.from("orders").update(retry).eq("id", order_id);
    }
  }
  if (updateResp?.error) return res.status(500).json({ error: updateResp.error.message || "Update failed" });

  if (
    ["cancelado", "reembolsado"].includes(String(next.production_status || "").toLowerCase()) &&
    String(currentOrder?.order_type || "").toLowerCase() === "vip" &&
    currentOrder?.user_id
  ) {
    try {
      const vipStatus =
        String(next.production_status || "").toLowerCase() === "reembolsado"
          ? "refunded"
          : cancelled_by === "admin"
          ? "cancelled_by_admin"
          : "cancelled";
      await sb
        .from("vip_subscriptions")
        .update({ status: vipStatus, ends_at: new Date().toISOString() })
        .eq("order_id", order_id);
      await sb.from("profiles").update({ vip_until: null, vip_plan: null }).eq("id", currentOrder.user_id);
    } catch (vipCancelErr) {
      console.error("vip cancel on admin status error", vipCancelErr);
    }
  }

  const { data: order } = await sb
    .from("orders")
    .select("id,customer_email,customer_name,production_status,shipping_tracking,order_type,vip_plan_id")
    .eq("id", order_id)
    .maybeSingle();

  if (next.production_status) {
    await notifyStatus({
      sb,
      order: { ...currentOrder, ...order, id: order_id },
      nextStatus: next.production_status,
      shipping_tracking: next.shipping_tracking ?? order?.shipping_tracking,
      production_eta,
      cancelled_by,
    });
  }

  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  
  if (!rateLimit(req, res, { key: 'api:admin', limit: 60, windowMs: 60000 })) return;
  try {
    const action = String(req.query?.action || "").trim().toLowerCase();

    if (action === "orders") return await handleOrders(req, res);
    if (action === "update-order") return await handleUpdateOrder(req, res);
    if (action === "delete-order") return await handleDeleteOrder(req, res);
    if (action === "vip-voting") return await handleVipVoting(req, res);
    if (action === "vip-close-voting") return await handleVipCloseVoting(req, res);
    if (action === "vip-start-voting") return await handleVipStartVoting(req, res);
    if (action === "vip-delete-voting") return await handleVipDeleteVoting(req, res);
    if (action === "game-coupon") return await handleGetGameCoupon(req, res);
    if (action === "save-game-coupon") return await handleSaveGameCoupon(req, res);
    if (action === "game-coupon-metrics") return await handleGameCouponMetrics(req, res);

    return res.status(404).json({ error: "Unknown admin action" });
  } catch (e) {
    console.error("api/admin error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}