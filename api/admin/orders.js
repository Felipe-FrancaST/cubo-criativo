/**
 * Admin: lista pedidos + itens + perfil do cliente
 * Route: /api/admin/orders
 *
 * Env vars:
 * - ADMIN_EMAILS="email1@...;email2@..."
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { supabaseAdmin } from "../_supabase.js";
import { requireAdmin } from "./_admin.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const sb = supabaseAdmin();

    const { data: orders, error: ordersErr } = await sb
      .from("orders")
      .select(
        "id,user_id,status,total,currency,payment_provider,provider_payment_id,customer_email,customer_name,customer_phone,created_at,production_status,shipping_tracking"
      )
      .order("created_at", { ascending: false })
      .limit(300);

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
    const attemptNew = await sb
      .from("order_items")
      .select("order_id,product_name,qty,unit_price_cents,scale,product_image_url")
      .in("order_id", orderIds);
    if (attemptNew?.error) {
      const attemptOld = await sb
        .from("order_items")
        .select("order_id,name,qty,unit_price,scale,img")
        .in("order_id", orderIds);
      items = attemptOld?.data || [];
      itemsErr = attemptOld?.error || null;
    } else {
      items = attemptNew?.data || [];
      itemsErr = null;
    }

    if (itemsErr) return res.status(500).json({ error: itemsErr.message || "Failed to load order items" });
    if (profErr) return res.status(500).json({ error: profErr.message || "Failed to load profiles" });

    const itemsByOrder = new Map();
    (items || []).forEach((it) => {
      const k = it.order_id;
      if (!itemsByOrder.has(k)) itemsByOrder.set(k, []);
      // normaliza
      itemsByOrder.get(k).push({
        order_id: it.order_id,
        name: it.product_name || it.name,
        qty: it.qty,
        scale: it.scale,
        img: it.product_image_url || it.img,
        // para o painel admin, manter um preço em BRL se existir
        unit_price: typeof it.unit_price === "number" ? it.unit_price : (typeof it.unit_price_cents === "number" ? it.unit_price_cents / 100 : null),
      });
    });

    const profileById = new Map();
    (profiles || []).forEach((p) => profileById.set(p.id, p));

    const merged = list.map((o) => ({
      ...o,
      profile: o.user_id ? profileById.get(o.user_id) || null : null,
      order_items: itemsByOrder.get(o.id) || [],
    }));

    return res.status(200).json({ orders: merged });
  } catch (e) {
    console.error("admin/orders error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
