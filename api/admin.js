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


const UPGRADE_ORDER_TYPES = new Set(["vip_upgrade", "vip-upgrade", "upgrade_vip", "upgrade"]);
const normalizeOrderType = (value) => String(value || "").trim().toLowerCase();
const isUpgradeOrderType = (value) => UPGRADE_ORDER_TYPES.has(normalizeOrderType(value));

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


function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

function formatProdStatusPt(status) {
  const s = String(status || '').toLowerCase();
  return ({
    editavel: 'Editável',
    recebido: 'Recebido',
    em_producao: 'Em produção',
    pronto: 'Pronto',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    reembolsado: 'Reembolsado',
  })[s] || (s || 'Atualizado');
}

function synthesizeOrderTimeline(order) {
  if (!order) return [];
  const events = [];
  const createdAt = order.created_at || null;
  if (createdAt) {
    events.push({
      id: `seed-created-${order.id}`,
      order_id: order.id,
      event_type: 'order_created',
      title: 'Pedido criado',
      description: 'Pedido registrado no sistema.',
      actor_label: 'Sistema',
      created_at: createdAt,
      metadata: { status: order.status || null, production_status: order.production_status || null },
      synthetic: true,
    });
  }
  if (String(order.status || '').toLowerCase() === 'paid') {
    events.push({
      id: `seed-paid-${order.id}`,
      order_id: order.id,
      event_type: 'payment_confirmed',
      title: 'Pagamento confirmado',
      description: 'Pagamento aprovado para este pedido.',
      actor_label: 'Sistema',
      created_at: order.paid_at || order.updated_at || createdAt,
      metadata: { payment_provider: order.payment_provider || null },
      synthetic: true,
    });
  }
  if (order.production_status && !['recebido','editavel'].includes(String(order.production_status).toLowerCase())) {
    events.push({
      id: `seed-prod-${order.id}-${order.production_status}`,
      order_id: order.id,
      event_type: 'production_status',
      title: `Status: ${formatProdStatusPt(order.production_status)}`,
      description: 'Último status de produção salvo no pedido.',
      actor_label: 'Sistema',
      created_at: order.updated_at || createdAt,
      metadata: { production_status: order.production_status },
      synthetic: true,
    });
  }
  if (order.shipping_tracking || order.tracking_code) {
    const tracking = order.shipping_tracking || order.tracking_code;
    events.push({
      id: `seed-track-${order.id}`,
      order_id: order.id,
      event_type: 'tracking_updated',
      title: 'Rastreio disponível',
      description: `Código informado: ${tracking}`,
      actor_label: 'Sistema',
      created_at: order.updated_at || createdAt,
      metadata: { tracking_code: tracking, tracking_url: order.tracking_url || null },
      synthetic: true,
    });
  }
  return events.filter(Boolean).sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
}

async function loadOrderEvents(sb, orderIds) {
  if (!orderIds?.length) return { byOrder: new Map(), tableAvailable: false };
  let resp = await sb
    .from('order_events')
    .select('id,order_id,event_type,title,description,actor_label,metadata,created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (resp?.error) {
    const msg = String(resp.error.message || '');
    if (/relation|does not exist|not exist/i.test(msg)) {
      return { byOrder: new Map(), tableAvailable: false };
    }
    if (/actor_label|metadata|column/i.test(msg)) {
      resp = await sb
        .from('order_events')
        .select('id,order_id,event_type,title,description,created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      if (resp?.error) {
        return { byOrder: new Map(), tableAvailable: true, error: resp.error };
      }
    } else {
      return { byOrder: new Map(), tableAvailable: true, error: resp.error };
    }
  }

  const byOrder = new Map();
  (resp?.data || []).forEach((row) => {
    const key = String(row.order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push({
      id: row.id,
      order_id: row.order_id,
      event_type: row.event_type || '',
      title: row.title || 'Atualização',
      description: row.description || '',
      actor_label: row.actor_label || 'Sistema',
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      created_at: row.created_at || null,
    });
  });

  return { byOrder, tableAvailable: true, error: null };
}

async function fetchOrderForAdmin(sb, orderId) {
  const fullSelect = "id,user_id,order_type,vip_plan_id,status,production_status,shipping_tracking,tracking_code,tracking_url,customer_email,customer_name,created_at,updated_at,payment_provider,total,last_email_type,last_email_status,last_email_sent_at,last_email_error";
  const legacySelect = "id,user_id,order_type,vip_plan_id,status,production_status,shipping_tracking,tracking_code,tracking_url,customer_email,customer_name,created_at,updated_at,payment_provider,total";
  let resp = await sb.from('orders').select(fullSelect).eq('id', orderId).maybeSingle();
  if (resp?.error && /last_email_|column/i.test(String(resp.error.message || ''))) {
    resp = await sb.from('orders').select(legacySelect).eq('id', orderId).maybeSingle();
  }
  return resp;
}

async function recordOrderEvent(sb, payload) {
  const orderId = String(payload?.order_id || '').trim();
  if (!orderId) return { skipped: true };

  const row = {
    order_id: orderId,
    event_type: String(payload?.event_type || 'order_updated').trim(),
    title: String(payload?.title || 'Atualização do pedido').trim(),
    description: String(payload?.description || '').trim() || null,
    actor_label: String(payload?.actor_label || 'Admin').trim(),
    metadata: payload?.metadata || {},
  };

  let resp = await sb.from('order_events').insert(row);
  if (resp?.error) {
    const msg = String(resp.error.message || '');
    if (/relation|does not exist|not exist/i.test(msg)) return { skipped: true, missingTable: true };
    if (/actor_label|metadata|column/i.test(msg)) {
      const fallback = { ...row };
      delete fallback.actor_label;
      delete fallback.metadata;
      resp = await sb.from('order_events').insert(fallback);
      if (!resp?.error) return { ok: true, fallback: true };
    }
  }

  return resp?.error ? { ok: false, error: resp.error } : { ok: true };
}

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

async function updateOrderEmailAudit(sb, orderId, patch = {}) {
  if (!orderId || !patch || typeof patch !== 'object') return { skipped: true };
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v;
  }
  if (!Object.keys(clean).length) return { skipped: true };

  let resp = await sb.from('orders').update(clean).eq('id', orderId);
  if (resp?.error && /column/i.test(String(resp.error.message || ''))) {
    const retry = { ...clean };
    for (const key of ['last_email_type', 'last_email_status', 'last_email_sent_at', 'last_email_error']) {
      if (new RegExp(key, 'i').test(String(resp.error.message || ''))) delete retry[key];
    }
    if (!Object.keys(retry).length) return { skipped: true, missingColumns: true };
    resp = await sb.from('orders').update(retry).eq('id', orderId);
  }
  return resp?.error ? { ok: false, error: resp.error } : { ok: true };
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

async function loadOrderEmailContext(sb, order) {
  const out = { items: [], vipSelection: null };
  if (!order?.id) return out;

  try {
    const { data: itemsNew } = await sb
      .from("order_items")
      .select("order_id,product_name,qty,unit_price_cents,scale,product_image_url")
      .eq("order_id", order.id);

    if (Array.isArray(itemsNew) && itemsNew.length) {
      out.items = itemsNew.map((it) => ({
        name: it.product_name,
        qty: it.qty,
        scale: it.scale,
        img: it.product_image_url || null,
        unit_price: typeof it.unit_price_cents === 'number' ? it.unit_price_cents / 100 : null,
      }));
    } else {
      const { data: itemsOld } = await sb
        .from("order_items")
        .select("order_id,name,qty,unit_price,scale,img")
        .eq("order_id", order.id);
      out.items = (itemsOld || []).map((it) => ({
        name: it.name,
        qty: it.qty,
        scale: it.scale,
        img: it.img || null,
        unit_price: typeof it.unit_price === 'number' ? it.unit_price : null,
      }));
    }
  } catch (e) {
    console.error('loadOrderEmailContext items error', e);
  }

  if (String(order?.order_type || '').toLowerCase() === 'vip' && order?.user_id && order?.created_at) {
    const cycleKey = String(order.created_at || '').slice(0, 7);
    if (cycleKey) {
      try {
        const [{ data: sel }, { data: opts }] = await Promise.all([
          sb
            .from('vip_mini_selections')
            .select('user_id,cycle_key,selected_option_ids,updated_at')
            .eq('user_id', order.user_id)
            .eq('cycle_key', cycleKey)
            .maybeSingle(),
          sb.from('vip_mini_options').select('id,title,image_url'),
        ]);
        const optById = new Map((opts || []).map((o) => [String(o.id), o]));
        const selectedIds = Array.isArray(sel?.selected_option_ids) ? sel.selected_option_ids : [];
        out.vipSelection = sel
          ? {
              cycle_key: sel.cycle_key,
              updated_at: sel.updated_at || null,
              selected_options: selectedIds
                .map((id) => optById.get(String(id)))
                .filter(Boolean)
                .map((o) => ({ id: o.id, title: o.title, image_url: o.image_url || null })),
            }
          : null;
      } catch (e) {
        console.error('loadOrderEmailContext vipSelection error', e);
      }
    }
  }

  return out;
}

async function notifyStatus({ sb, order, nextStatus, shipping_tracking, production_eta, cancelled_by }) {
  const to = await resolveCustomerEmail(sb, order);
  if (!to) {
    await updateOrderEmailAudit(sb, order?.id, {
      last_email_type: 'order_status',
      last_email_status: 'skipped',
      last_email_error: 'Cliente sem e-mail válido para notificação.',
    });
    return { ok: false, skipped: true, reason: 'missing_email' };
  }

  const shortId = String(order.id || "").slice(0, 8);
  const baseUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const reviewLink = baseUrl ? `${baseUrl}/#/conta` : "";

  const brandName = process.env.BRAND_NAME || "Cubo Criativo";
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM || "";
  const whatsapp = process.env.WHATSAPP_NUMBER || process.env.SUPPORT_WHATSAPP || "";

  const emailContext = await loadOrderEmailContext(sb, order);

  const mail = renderOrderStatusEmail({
    brandName,
    orderId: order?.id,
    customerName: order?.customer_name,
    nextStatus,
    shippingTracking: shipping_tracking || order?.shipping_tracking || order?.tracking_code || "",
    trackingUrl: order?.tracking_url || "",
    productionEta: production_eta || order?.production_eta || "",
    cancelledBy: cancelled_by || "",
    reviewLink,
    supportEmail,
    whatsapp,
    total: order?.total,
    paymentMethod: order?.payment_provider || '',
    orderType: order?.order_type || "shop",
    vipPlanId: order?.vip_plan_id || "",
    items: emailContext.items,
    vipSelection: emailContext.vipSelection,
  });

  const emailType = `order_status:${String(nextStatus || '').toLowerCase() || 'updated'}`;
  const result = await sendResendEmail({ to, subject: mail.subject || `Atualização do pedido — ${shortId}`, html: mail.html });

  if (result?.ok) {
    const stamp = new Date().toISOString();
    await updateOrderEmailAudit(sb, order?.id, {
      last_email_type: emailType,
      last_email_status: 'sent',
      last_email_sent_at: stamp,
      last_email_error: null,
    });
    await recordOrderEvent(sb, {
      order_id: order?.id,
      event_type: 'email_sent',
      title: 'E-mail enviado ao cliente',
      description: `Template ${emailType} enviado para ${to}.`,
      actor_label: 'Sistema',
      metadata: { email_type: emailType, email_to: to, provider: 'resend', resend_id: result?.data?.id || null },
    });
    return { ok: true, to, emailType, provider: result?.data || null };
  }

  const providerMessage = result?.data?.message || result?.data?.error || 'Falha ao enviar e-mail.';
  await updateOrderEmailAudit(sb, order?.id, {
    last_email_type: emailType,
    last_email_status: 'failed',
    last_email_error: providerMessage,
  });
  await recordOrderEvent(sb, {
    order_id: order?.id,
    event_type: 'email_failed',
    title: 'Falha ao enviar e-mail',
    description: providerMessage,
    actor_label: 'Sistema',
    metadata: { email_type: emailType, email_to: to, provider: 'resend' },
  });
  return { ok: false, error: providerMessage, to, emailType };
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


function applyOrderFilters(builder, filters = {}) {
  let q = builder;
  q = q.not("order_type", "in", '("vip_upgrade","vip-upgrade","upgrade_vip","upgrade")');
  const queryText = String(filters.q || "").trim();
  const pay = String(filters.pay || "all").toLowerCase();
  const prod = String(filters.prod || "all").toLowerCase();
  const type = String(filters.type || "all").toLowerCase();
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();

  if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59.999`);
  if (pay !== "all") q = q.eq("status", pay);
  if (prod !== "all") q = q.eq("production_status", prod);
  if (type !== "all") {
    if (type === "vip") q = q.eq("order_type", "vip");
    if (type === "store") q = q.neq("order_type", "vip");
  }
  if (queryText) {
    const safe = queryText.replace(/[%_,]/g, " ").trim();
    if (safe) {
      q = q.or([
        `id.ilike.%${safe}%`,
        `customer_email.ilike.%${safe}%`,
        `customer_name.ilike.%${safe}%`,
        `customer_phone.ilike.%${safe}%`,
        `shipping_tracking.ilike.%${safe}%`,
      ].join(","));
    }
  }
  return q;
}




async function handleOrders(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();
  const page = Math.max(1, Number.parseInt(String(req.query?.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(req.query?.page_size || "25"), 10) || 25));
  const filters = {
    q: req.query?.q || "",
    pay: req.query?.pay || "all",
    prod: req.query?.prod || "all",
    type: req.query?.type || "all",
    dateFrom: req.query?.date_from || "",
    dateTo: req.query?.date_to || "",
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let orders = null;
  let ordersErr = null;
  let totalCount = 0;

  const selectFull =
    "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id,refund_requested,refund_requested_at,last_email_type,last_email_status,last_email_sent_at,last_email_error";
  const selectNoEmailAudit =
    "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id,refund_requested,refund_requested_at";
  const selectLegacy =
    "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking,order_type,vip_plan_id";

  const runOrderQuery = async (selectColumns) => {
    let query = sb.from("orders").select(selectColumns, { count: "exact" });
    query = applyOrderFilters(query, filters);
    return await query.order("created_at", { ascending: false }).range(from, to);
  };

  let attemptOrders = await runOrderQuery(selectFull);
  orders = attemptOrders?.data || null;
  ordersErr = attemptOrders?.error || null;
  totalCount = Number(attemptOrders?.count || 0);

  if (ordersErr && /last_email_|column/i.test(String(ordersErr.message || ""))) {
    attemptOrders = await runOrderQuery(selectNoEmailAudit);
    orders = attemptOrders?.data || null;
    ordersErr = attemptOrders?.error || null;
    totalCount = Number(attemptOrders?.count || 0);
  }

  if (ordersErr && /refund_requested|refund_requested_at|column/i.test(String(ordersErr.message || ""))) {
    attemptOrders = await runOrderQuery(selectLegacy);
    orders = attemptOrders?.data || null;
    ordersErr = attemptOrders?.error || null;
    totalCount = Number(attemptOrders?.count || 0);
  }

  if (ordersErr) return res.status(500).json({ error: ordersErr.message || "Failed to load orders" });

  let summaryRows = [];
  const summarySelectFull = "status,total,production_status,shipping_tracking,order_type,refund_requested,created_at";
  const summarySelectLegacy = "status,total,production_status,shipping_tracking,order_type,created_at";
  const runSummaryQuery = async (selectColumns) => {
    let query = sb.from("orders").select(selectColumns);
    query = applyOrderFilters(query, filters);
    return await query.order("created_at", { ascending: false });
  };

  let summaryResp = await runSummaryQuery(summarySelectFull);
  if (summaryResp?.error && /refund_requested|column/i.test(String(summaryResp.error.message || ""))) {
    summaryResp = await runSummaryQuery(summarySelectLegacy);
  }
  summaryRows = Array.isArray(summaryResp?.data) ? summaryResp.data : [];

  const summary = (() => {
    const list = summaryRows || [];
    const total = Number(totalCount || list.length || 0);
    const paidRows = list.filter((o) => String(o?.status || "").toLowerCase() === "paid");
    const pendingRows = list.filter((o) => String(o?.status || "").toLowerCase() !== "paid");
    const revenue = paidRows.reduce((acc, o) => acc + (Number(o?.total) || 0), 0);
    const refundReq = list.filter((o) => !!o?.refund_requested).length;
    const vipCount = list.filter((o) => String(o?.order_type || "").toLowerCase() === "vip").length;
    const paidWaitingProduction = list.filter((o) => String(o?.status || '').toLowerCase() === 'paid' && ['recebido', 'editavel'].includes(String(o?.production_status || 'recebido').toLowerCase())).length;
    const readyWithoutTracking = list.filter((o) => String(o?.status || '').toLowerCase() === 'paid' && String(o?.production_status || '').toLowerCase() === 'pronto' && !String(o?.shipping_tracking || '').trim()).length;
    const shippedInTransit = list.filter((o) => String(o?.production_status || '').toLowerCase() === 'enviado').length;
    return {
      total,
      paid: paidRows.length,
      pending: pendingRows.length,
      revenue,
      refundReq,
      vipCount,
      bottlenecks: {
        paidWaitingProduction,
        readyWithoutTracking,
        shippedInTransit,
        refundRequested: refundReq,
      },
    };
  })();

  const list = Array.isArray(orders) ? orders : [];
  if (list.length === 0) {
    return res.status(200).json({
      orders: [],
      summary,
      pagination: {
        page,
        page_size: pageSize,
        total_count: Number(totalCount || 0),
        total_pages: Math.max(1, Math.ceil(Number(totalCount || 0) / pageSize)),
      },
    });
  }

  const vipOrders = list.filter((o) => normalizeOrderType(o.order_type) === "vip" && o.user_id);
  const vipUserIds = Array.from(new Set(vipOrders.map((o) => o.user_id).filter(Boolean)));

  const upgradeSelectFull = selectFull;
  const upgradeSelectNoEmailAudit = selectNoEmailAudit;
  const upgradeSelectLegacy = selectLegacy;
  let relatedUpgrades = [];
  if (vipUserIds.length) {
    const runUpgradeQuery = async (selectColumns) => {
      return await sb
        .from("orders")
        .select(selectColumns)
        .in("user_id", vipUserIds)
        .in("order_type", Array.from(UPGRADE_ORDER_TYPES))
        .order("created_at", { ascending: false });
    };
    let upgradeResp = await runUpgradeQuery(upgradeSelectFull);
    if (upgradeResp?.error && /last_email_|column/i.test(String(upgradeResp.error.message || ""))) {
      upgradeResp = await runUpgradeQuery(upgradeSelectNoEmailAudit);
    }
    if (upgradeResp?.error && /refund_requested|refund_requested_at|column/i.test(String(upgradeResp.error.message || ""))) {
      upgradeResp = await runUpgradeQuery(upgradeSelectLegacy);
    }
    relatedUpgrades = Array.isArray(upgradeResp?.data) ? upgradeResp.data : [];
  }

  const orderIds = Array.from(new Set([...list.map((o) => o.id), ...relatedUpgrades.map((o) => o.id)]));
  const userIds = Array.from(new Set([...list.map((o) => o.user_id), ...relatedUpgrades.map((o) => o.user_id)].filter(Boolean)));

  const [{ data: profiles, error: profErr }] = await Promise.all([
    userIds.length
      ? sb
          .from("profiles")
          .select("id,full_name,phone,address_line1,address_line2,neighborhood,city,state,zip")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

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

  const vipPlanIds = Array.from(new Set([...list, ...relatedUpgrades].map((o) => String(o?.vip_plan_id || '').trim()).filter(Boolean)));
  let vipPlanById = new Map();
  if (vipPlanIds.length) {
    const plansResp = await sb.from('vip_plans').select('id,name,short_name').in('id', vipPlanIds);
    if (!plansResp?.error) {
      vipPlanById = new Map((plansResp.data || []).map((row) => [String(row.id), row]));
    }
  }
  const planLabel = (planId) => {
    const key = String(planId || '').trim();
    if (!key) return 'VIP';
    const row = vipPlanById.get(key);
    return row?.short_name || row?.name || key;
  };

  const orderEventsResp = await loadOrderEvents(sb, orderIds);
  const vipPresentResp = await loadVipPresentRolls(sb, vipOrders);

  const upgradeCardsByBase = new Map();
  if (relatedUpgrades.length && vipOrders.length) {
    const vipOrdersByUser = new Map();
    vipOrders.forEach((order) => {
      const userKey = String(order.user_id || '');
      if (!userKey) return;
      if (!vipOrdersByUser.has(userKey)) vipOrdersByUser.set(userKey, []);
      vipOrdersByUser.get(userKey).push(order);
    });
    vipOrdersByUser.forEach((rows) => rows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)));

    relatedUpgrades.forEach((upgrade) => {
      const userKey = String(upgrade.user_id || '');
      const baseCandidates = vipOrdersByUser.get(userKey) || [];
      if (!baseCandidates.length) return;
      const upgradeTime = new Date(upgrade.created_at || 0).getTime();
      let baseOrder = null;
      for (const candidate of baseCandidates) {
        const candidateTime = new Date(candidate.created_at || 0).getTime();
        if (candidateTime <= upgradeTime) baseOrder = candidate;
      }
      if (!baseOrder) baseOrder = baseCandidates[baseCandidates.length - 1];
      if (!baseOrder) return;

      const upgradeId = String(upgrade.id);
      const dbEvents = orderEventsResp.byOrder.get(upgradeId) || [];
      const timeline = dbEvents.length ? dbEvents : synthesizeOrderTimeline(upgrade);
      const card = {
        ...upgrade,
        order_items: itemsByOrder.get(upgrade.id) || [],
        timeline,
        timeline_source: dbEvents.length ? 'order_events' : 'synthetic',
        plan_label: planLabel(upgrade.vip_plan_id),
      };
      const baseKey = String(baseOrder.id);
      if (!upgradeCardsByBase.has(baseKey)) upgradeCardsByBase.set(baseKey, []);
      upgradeCardsByBase.get(baseKey).push(card);
    });
    upgradeCardsByBase.forEach((rows) => rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
  }

  const merged = list.map((o) => {
    const dbEvents = orderEventsResp.byOrder.get(String(o.id)) || [];
    let timeline = dbEvents.length ? dbEvents : synthesizeOrderTimeline(o);
    const cycleKey = String(o.created_at || "").slice(0, 7);
    const relatedUpgradesForOrder = upgradeCardsByBase.get(String(o.id)) || [];
    const latestPaidUpgrade = relatedUpgradesForOrder.find((up) => String(up?.status || '').toLowerCase() === 'paid') || null;
    const upgradeTotal = relatedUpgradesForOrder
      .filter((up) => String(up?.status || '').toLowerCase() === 'paid')
      .reduce((acc, up) => acc + (Number(up?.total) || 0), 0);

    if (relatedUpgradesForOrder.length) {
      const upgradeEvents = relatedUpgradesForOrder.map((up) => ({
        id: `upgrade-${up.id}`,
        order_id: o.id,
        event_type: 'vip_upgrade',
        title: `Upgrade para ${up.plan_label}`,
        description: `${String(up.status || '').toLowerCase() === 'paid' ? 'Upgrade confirmado' : 'Upgrade em andamento'}${Number(up.total) ? ` • ${Number(up.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`,
        actor_label: 'Sistema',
        created_at: up.created_at || up.updated_at || null,
        metadata: { upgrade_order_id: up.id, to_plan_id: up.vip_plan_id, status: up.status || null },
        synthetic: true,
      }));
      timeline = [...upgradeEvents, ...timeline].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return {
      ...o,
      vip_plan_id: latestPaidUpgrade?.vip_plan_id || o.vip_plan_id,
      vip_plan_label: planLabel(latestPaidUpgrade?.vip_plan_id || o.vip_plan_id),
      profile: o.user_id ? profileById.get(o.user_id) || null : null,
      order_items: itemsByOrder.get(o.id) || [],
      vip_selection:
        normalizeOrderType(o.order_type) === "vip" && o.user_id
          ? vipSelByUserCycle.get(`${o.user_id}:${cycleKey}`) || null
          : null,
      vip_present_roll:
        normalizeOrderType(o.order_type) === "vip" && o.user_id
          ? vipPresentResp.byKey.get(`${o.user_id}:${cycleKey}`) || null
          : null,
      related_upgrades: relatedUpgradesForOrder,
      related_upgrades_count: relatedUpgradesForOrder.length,
      upgrade_total: upgradeTotal,
      effective_total: Number(o.total || 0) + upgradeTotal,
      timeline,
      timeline_source: dbEvents.length ? 'order_events' : 'synthetic',
    };
  });

  return res.status(200).json({
    orders: merged,
    summary,
    pagination: {
      page,
      page_size: pageSize,
      total_count: Number(totalCount || 0),
      total_pages: Math.max(1, Math.ceil(Number(totalCount || 0) / pageSize)),
    },
    timeline_enabled: !!orderEventsResp.tableAvailable,
    vip_present_enabled: !!vipPresentResp.tableAvailable,
  });




async function loadVipPresentRolls(sb, vipOrders) {
  if (!Array.isArray(vipOrders) || !vipOrders.length) return { byKey: new Map(), tableAvailable: false };

  const userIds = Array.from(new Set(vipOrders.map((o) => String(o?.user_id || '')).filter(Boolean)));
  const cycles = Array.from(new Set(vipOrders.map((o) => String(o?.created_at || '').slice(0, 7)).filter(Boolean)));
  if (!userIds.length || !cycles.length) return { byKey: new Map(), tableAvailable: false };

  let resp = await sb
    .from('vip_present_rolls')
    .select('id,user_id,cycle_key,roll_value,reward_kind,reward_label,coupon_code,claim_status,claimed_at,created_at')
    .in('user_id', userIds)
    .in('cycle_key', cycles);

  if (resp?.error) {
    const msg = String(resp.error.message || '');
    if (/relation|does not exist|not exist/i.test(msg)) return { byKey: new Map(), tableAvailable: false };
    return { byKey: new Map(), tableAvailable: true, error: resp.error };
  }

  const couponCodes = Array.from(new Set((resp?.data || []).map((row) => String(row?.coupon_code || '').trim().toUpperCase()).filter(Boolean)));
  let couponByCode = new Map();
  if (couponCodes.length) {
    const couponResp = await sb
      .from('coupons')
      .select('code,label,discount_type,discount_value,min_order_value,expires_at,active,used_count,max_uses')
      .in('code', couponCodes);
    if (!couponResp?.error) {
      couponByCode = new Map((couponResp.data || []).map((row) => [String(row.code || '').trim().toUpperCase(), row]));
    }
  }

  const byKey = new Map();
  (resp?.data || []).forEach((row) => {
    const key = `${row.user_id}:${row.cycle_key}`;
    const couponCode = String(row?.coupon_code || '').trim().toUpperCase();
    const coupon = couponCode ? couponByCode.get(couponCode) || null : null;
    byKey.set(key, {
      ...row,
      coupon: coupon ? {
        code: coupon.code,
        label: coupon.label,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_order_value: coupon.min_order_value,
        expires_at: coupon.expires_at,
        active: coupon.active,
        used_count: coupon.used_count,
        max_uses: coupon.max_uses,
      } : null,
    });
  });

  return { byKey, tableAvailable: true, error: null };
}

async function deleteOrderById(sb, orderId) {
  const id = String(orderId || "").trim();
  if (!id) return { ok: false, error: "Missing order_id" };

  try {
    await sb.from("order_items").delete().eq("order_id", id);
  } catch (e) {
    // ignore (table may not exist in some deployments)
  }

  const { error: delErr } = await sb.from("orders").delete().eq("id", id);
  if (delErr) return { ok: false, error: delErr.message || "Failed to delete order" };
  return { ok: true, order_id: id };
}

async function handleDeleteOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const orderId = String(body?.order_id || "").trim();
  if (!orderId) return res.status(400).json({ error: "Missing order_id" });

  const sb = supabaseAdmin();
  const result = await deleteOrderById(sb, orderId);
  if (!result?.ok) return res.status(500).json({ error: result?.error || "Failed to delete order" });

  return res.status(200).json({ ok: true, order_id: orderId });
}

async function handleBulkDeleteOrders(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const orderIds = Array.isArray(body?.order_ids)
    ? body.order_ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (!orderIds.length) return res.status(400).json({ error: "Missing order_ids" });

  const sb = supabaseAdmin();
  const results = [];
  for (const orderId of orderIds) {
    const result = await deleteOrderById(sb, orderId);
    results.push(result);
  }

  const deleted = results.filter((r) => r?.ok).map((r) => r.order_id);
  const failed = results.filter((r) => !r?.ok).map((r, idx) => ({ order_id: orderIds[idx], error: r?.error || "Failed to delete order" }));

  return res.status(200).json({
    ok: failed.length === 0,
    deleted_count: deleted.length,
    failed_count: failed.length,
    deleted_order_ids: deleted,
    failed,
  });
}


async function fetchVipVotingImageLibrary(sb) {
  let resp = await sb
    .from("vip_theme_image_library")
    .select("id,title,image_url,sort_order,active,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (resp?.error) {
    const msg = String(resp.error.message || "");
    if (/relation|does not exist|not exist/i.test(msg)) {
      return { missingTable: true, items: [] };
    }
    return { error: resp.error };
  }

  return { items: Array.isArray(resp?.data) ? resp.data : [] };
}

async function handleVipVotingImageLibrary(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();
  const lib = await fetchVipVotingImageLibrary(sb);
  if (lib?.error) return res.status(500).json({ error: lib.error.message || "Falha ao carregar biblioteca de imagens." });
  if (lib?.missingTable) {
    return res.status(200).json({ items: [], setup_required: true, message: "Tabela vip_theme_image_library ainda não existe no Supabase." });
  }

  return res.status(200).json({ items: lib.items || [] });
}


async function fetchVipCycleControlState(sb) {
  const fallback = { active_cycle_key: null, control_available: false, setup_required: false };
  let resp = await sb
    .from("vip_cycle_control")
    .select("id,active_cycle_key,updated_at,created_at")
    .eq("id", "default")
    .maybeSingle();

  if (resp?.error) {
    const msg = String(resp.error.message || "");
    if (/relation|does not exist|not exist/i.test(msg)) {
      return { ...fallback, setup_required: true };
    }
    return { ...fallback, error: resp.error };
  }

  return {
    active_cycle_key: String(resp?.data?.active_cycle_key || "").trim() || null,
    control_available: true,
    setup_required: false,
    row: resp?.data || null,
  };
}

async function fetchVipMiniLibrary(sb) {
  let resp = await sb
    .from("vip_mini_options")
    .select("id,title,description,image_url,sort_order,active,created_at,item_type,cycle_key")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (resp?.error) {
    const msg = String(resp.error.message || "");
    if (/cycle_key|column/i.test(msg)) {
      resp = await sb
        .from("vip_mini_options")
        .select("id,title,description,image_url,sort_order,active,created_at,item_type")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (resp?.error) return { error: resp.error };
      return {
        items: (resp.data || []).map((item) => ({ ...item, cycle_key: null })),
        cycleColumnAvailable: false,
      };
    }
    return { error: resp.error };
  }

  return { items: Array.isArray(resp?.data) ? resp.data : [], cycleColumnAvailable: true };
}

function groupVipCyclesFromLibrary(items = [], activeCycleKey = null) {
  const map = new Map();
  for (const item of items) {
    const cycleKey = String(item?.cycle_key || "").trim();
    if (!cycleKey) continue;
    if (!map.has(cycleKey)) {
      map.set(cycleKey, {
        cycle_key: cycleKey,
        total_items: 0,
        miniatures_count: 0,
        boss_count: 0,
        preview_images: [],
        items: [],
        is_active: cycleKey === String(activeCycleKey || ""),
      });
    }
    const entry = map.get(cycleKey);
    entry.total_items += 1;
    if (String(item?.item_type || "miniature").toLowerCase() === "boss") entry.boss_count += 1;
    else entry.miniatures_count += 1;
    if (item?.image_url && entry.preview_images.length < 4) entry.preview_images.push(item.image_url);
    entry.items.push(item);
  }
  return Array.from(map.values()).sort((a, b) => String(b.cycle_key).localeCompare(String(a.cycle_key)));
}

async function handleVipControl(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sb = supabaseAdmin();
  const [control, library] = await Promise.all([
    fetchVipCycleControlState(sb),
    fetchVipMiniLibrary(sb),
  ]);

  if (control?.error) return res.status(500).json({ error: control.error.message || "Falha ao carregar controle VIP." });
  if (library?.error) return res.status(500).json({ error: library.error.message || "Falha ao carregar biblioteca VIP." });

  const activeCycleKey = control?.active_cycle_key || null;
  const cycles = groupVipCyclesFromLibrary(library.items || [], activeCycleKey);

  return res.status(200).json({
    active_cycle_key: activeCycleKey,
    setup_required: !!control?.setup_required,
    cycle_column_available: library.cycleColumnAvailable !== false,
    cycles,
    library: library.items || [],
  });
}

async function handleVipSaveCycle(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const cycle_key = String(body?.cycle_key || "").trim();
  const option_ids = Array.isArray(body?.option_ids) ? body.option_ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
  const activate = !!body?.activate;

  if (!/^\d{4}-\d{2}$/.test(cycle_key)) {
    return res.status(400).json({ error: "cycle_key inválido. Use formato YYYY-MM." });
  }
  if (!option_ids.length) return res.status(400).json({ error: "Selecione pelo menos 1 item para o ciclo." });

  const sb = supabaseAdmin();
  const library = await fetchVipMiniLibrary(sb);
  if (library?.error) return res.status(500).json({ error: library.error.message || "Falha ao validar biblioteca VIP." });
  if (library.cycleColumnAvailable === false) {
    return res.status(400).json({ error: "A coluna cycle_key ainda não existe em vip_mini_options. Rode o SQL de atualização primeiro." });
  }
  const byId = new Map((library.items || []).map((item) => [String(item.id), item]));
  const missing = option_ids.find((id) => !byId.has(String(id)));
  if (missing) return res.status(400).json({ error: "Um dos itens selecionados não foi encontrado na tabela vip_mini_options." });

  const forCycle = (library.items || []).filter((item) => String(item?.cycle_key || "") === cycle_key).map((item) => String(item.id));
  const selectedSet = new Set(option_ids);
  const toClear = forCycle.filter((id) => !selectedSet.has(id));

  if (toClear.length) {
    const clearResp = await sb.from("vip_mini_options").update({ cycle_key: null }).in("id", toClear);
    if (clearResp?.error) return res.status(500).json({ error: clearResp.error.message || "Falha ao limpar itens antigos do ciclo." });
  }

  const assignResp = await sb.from("vip_mini_options").update({ cycle_key }).in("id", option_ids);
  if (assignResp?.error) return res.status(500).json({ error: assignResp.error.message || "Falha ao salvar itens do ciclo." });

  if (activate) {
    let controlResp = await sb.from("vip_cycle_control").upsert({ id: "default", active_cycle_key: cycle_key }, { onConflict: "id" });
    if (controlResp?.error) {
      const msg = String(controlResp.error.message || "");
      if (/relation|does not exist|not exist/i.test(msg)) {
        return res.status(400).json({ error: "A tabela vip_cycle_control ainda não existe no Supabase. Rode o SQL de atualização primeiro." });
      }
      return res.status(500).json({ error: controlResp.error.message || "Falha ao ativar ciclo." });
    }
  }

  return res.status(200).json({ ok: true, cycle_key, active_cycle_key: activate ? cycle_key : null });
}

async function handleVipSetActiveCycle(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const cycle_key = String(body?.cycle_key || "").trim();
  if (!/^\d{4}-\d{2}$/.test(cycle_key)) {
    return res.status(400).json({ error: "cycle_key inválido. Use formato YYYY-MM." });
  }

  const sb = supabaseAdmin();
  const library = await fetchVipMiniLibrary(sb);
  if (library?.error) return res.status(500).json({ error: library.error.message || "Falha ao validar ciclos." });
  const exists = (library.items || []).some((item) => String(item?.cycle_key || "") === cycle_key);
  if (!exists) return res.status(400).json({ error: "Esse ciclo ainda não tem itens cadastrados." });

  let resp = await sb.from("vip_cycle_control").upsert({ id: "default", active_cycle_key: cycle_key }, { onConflict: "id" });
  if (resp?.error) {
    const msg = String(resp.error.message || "");
    if (/relation|does not exist|not exist/i.test(msg)) {
      return res.status(400).json({ error: "A tabela vip_cycle_control ainda não existe no Supabase. Rode o SQL de atualização primeiro." });
    }
    return res.status(500).json({ error: resp.error.message || "Falha ao ativar ciclo." });
  }

  return res.status(200).json({ ok: true, active_cycle_key: cycle_key });
}

async function handleVipDeleteCycle(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const cycle_key = String(body?.cycle_key || "").trim();
  if (!/^\d{4}-\d{2}$/.test(cycle_key)) {
    return res.status(400).json({ error: "cycle_key inválido. Use formato YYYY-MM." });
  }

  const sb = supabaseAdmin();
  const library = await fetchVipMiniLibrary(sb);
  if (library?.error) return res.status(500).json({ error: library.error.message || "Falha ao validar ciclos." });
  if (library.cycleColumnAvailable === false) {
    return res.status(400).json({ error: "A coluna cycle_key ainda não existe em vip_mini_options. Rode o SQL de atualização primeiro." });
  }

  const exists = (library.items || []).some((item) => String(item?.cycle_key || "") === cycle_key);
  if (!exists) return res.status(400).json({ error: "Esse ciclo não foi encontrado." });

  const clearResp = await sb.from("vip_mini_options").update({ cycle_key: null }).eq("cycle_key", cycle_key);
  if (clearResp?.error) return res.status(500).json({ error: clearResp.error.message || "Falha ao remover os itens do ciclo." });

  const control = await fetchVipCycleControlState(sb);
  if (String(control?.active_cycle_key || "") === cycle_key) {
    const ctrlResp = await sb.from("vip_cycle_control").upsert({ id: "default", active_cycle_key: null }, { onConflict: "id" });
    if (ctrlResp?.error) {
      const msg = String(ctrlResp.error.message || "");
      if (/relation|does not exist|not exist/i.test(msg)) {
        return res.status(400).json({ error: "A tabela vip_cycle_control ainda não existe no Supabase. Rode o SQL de atualização primeiro." });
      }
      return res.status(500).json({ error: ctrlResp.error.message || "Falha ao limpar o ciclo ativo." });
    }
  }

  return res.status(200).json({ ok: true, deleted_cycle_key: cycle_key, active_cycle_key: String(control?.active_cycle_key || "") === cycle_key ? null : control?.active_cycle_key || null });
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
      image_asset_id: String(o?.image_asset_id || "").trim() || null,
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

  const libraryIds = Array.from(new Set(cleanOptions.map((o) => String(o.image_asset_id || "").trim()).filter(Boolean)));
  let libraryById = new Map();
  if (libraryIds.length) {
    const libResp = await sb
      .from("vip_theme_image_library")
      .select("id,title,image_url,active")
      .in("id", libraryIds);
    if (libResp?.error) {
      const msg = String(libResp.error.message || "");
      if (/relation|does not exist|not exist/i.test(msg)) {
        return res.status(400).json({ error: "A tabela vip_theme_image_library ainda não existe no Supabase. Rode o SQL de atualização primeiro." });
      }
      return res.status(500).json({ error: libResp.error.message || "Falha ao carregar imagens da votação." });
    }
    libraryById = new Map((libResp.data || []).map((item) => [String(item.id), item]));
    const missingAsset = libraryIds.find((id) => !libraryById.has(String(id)));
    if (missingAsset) return res.status(400).json({ error: "Uma das imagens selecionadas não foi encontrada na biblioteca." });
  }

  const resolvedOptions = cleanOptions.map((o) => {
    const asset = o.image_asset_id ? libraryById.get(String(o.image_asset_id)) : null;
    return {
      ...o,
      image_url: String(asset?.image_url || "").trim() || null,
    };
  });

  const { data: poll, error: pollErr } = await sb
    .from("vip_theme_polls")
    .insert({ month_key, title, status: "open" })
    .select("id,month_key,title,status,created_at")
    .single();
  if (pollErr) return res.status(500).json({ error: pollErr.message || "Falha ao criar votação." });

  const optionRows = resolvedOptions.map((o, idx) => ({
    poll_id: poll.id,
    title: o.title,
    description: o.description,
    image_url: o.image_url,
    image_asset_id: o.image_asset_id,
    sort_order: Number.isFinite(Number(o.sort_order)) ? Number(o.sort_order) : idx,
    active: o.active,
  }));

  let optResp = await sb.from("vip_theme_options").insert(optionRows);
  if (optResp?.error && /image_asset_id|column/i.test(String(optResp.error.message || ""))) {
    const fallbackRows = optionRows.map(({ image_asset_id, ...rest }) => rest);
    optResp = await sb.from("vip_theme_options").insert(fallbackRows);
  }
  const optErr = optResp?.error;
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

  const { data: currentOrder, error: currentErr } = await fetchOrderForAdmin(sb, order_id);

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

  const timelineWrites = [];
  if (Object.prototype.hasOwnProperty.call(next, 'production_status') && String(next.production_status || '').toLowerCase() !== String(currentOrder.production_status || '').toLowerCase()) {
    timelineWrites.push(recordOrderEvent(sb, {
      order_id,
      event_type: 'production_status',
      title: `Status alterado para ${formatProdStatusPt(next.production_status)}`,
      description: production_eta ? `Estimativa informada: ${production_eta}` : `Novo status de produção salvo pelo admin.`,
      actor_label: 'Admin',
      metadata: {
        from_status: currentOrder.production_status || null,
        to_status: next.production_status,
        production_eta: production_eta || null,
        cancelled_by: cancelled_by || null,
      },
    }));
  }
  const nextTracking = next.shipping_tracking ?? next.tracking_code;
  const prevTracking = currentOrder.shipping_tracking || currentOrder.tracking_code || '';
  if (typeof nextTracking === 'string' && nextTracking !== prevTracking) {
    timelineWrites.push(recordOrderEvent(sb, {
      order_id,
      event_type: 'tracking_updated',
      title: nextTracking ? 'Rastreio atualizado' : 'Rastreio removido',
      description: nextTracking ? `Código informado: ${nextTracking}` : 'O código de rastreio foi removido pelo admin.',
      actor_label: 'Admin',
      metadata: {
        from_tracking: prevTracking || null,
        to_tracking: nextTracking || null,
        tracking_url: next.tracking_url || currentOrder.tracking_url || null,
      },
    }));
  }
  if (timelineWrites.length) {
    await Promise.allSettled(timelineWrites);
  }

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

  const { data: order } = await fetchOrderForAdmin(sb, order_id);

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

async function handleResendOrderEmail(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = await readJsonBody(req);
  const order_id = String(body.order_id || "").trim();
  if (!order_id) return res.status(400).json({ error: "Missing order_id" });

  const sb = supabaseAdmin();
  const { data: order, error } = await fetchOrderForAdmin(sb, order_id);

  if (error) return res.status(500).json({ error: error.message || "Failed to load order" });
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });

  const nextStatus = String(body.production_status || order.production_status || 'recebido').trim().toLowerCase();
  if (!ALLOWED_PROD_STATUS.has(nextStatus)) return res.status(400).json({ error: 'Status inválido para reenvio.' });

  const result = await notifyStatus({
    sb,
    order,
    nextStatus,
    shipping_tracking: order.shipping_tracking || order.tracking_code || '',
    production_eta: '',
    cancelled_by: '',
  });

  if (!result?.ok) {
    return res.status(500).json({ error: result?.error || 'Falha ao reenviar e-mail.' });
  }

  const { data: refreshed } = await fetchOrderForAdmin(sb, order_id);

  return res.status(200).json({ ok: true, order: refreshed || null, email: result });
}

export default async function handler(req, res) {
  
  if (!rateLimit(req, res, { key: 'api:admin', limit: 60, windowMs: 60000 })) return;
  try {
    const action = String(req.query?.action || "").trim().toLowerCase();

    if (action === "orders") return await handleOrders(req, res);
    if (action === "update-order") return await handleUpdateOrder(req, res);
    if (action === "resend-order-email") return await handleResendOrderEmail(req, res);
    if (action === "delete-order") return await handleDeleteOrder(req, res);
    if (action === "bulk-delete-orders") return await handleBulkDeleteOrders(req, res);
    if (action === "vip-control") return await handleVipControl(req, res);
    if (action === "vip-save-cycle") return await handleVipSaveCycle(req, res);
    if (action === "vip-set-active-cycle") return await handleVipSetActiveCycle(req, res);
    if (action === "vip-delete-cycle") return await handleVipDeleteCycle(req, res);
    if (action === "vip-voting") return await handleVipVoting(req, res);
    if (action === "vip-close-voting") return await handleVipCloseVoting(req, res);
    if (action === "vip-start-voting") return await handleVipStartVoting(req, res);
    if (action === "vip-voting-image-library") return await handleVipVotingImageLibrary(req, res);
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