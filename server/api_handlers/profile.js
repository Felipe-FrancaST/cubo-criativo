/**
 * Vercel Serverless Function
 * Route: /api/profile
 *
 * GET  -> retorna o profile do usuário autenticado
 * POST -> upsert do profile do usuário autenticado
 *
 * Env vars:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 */
import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";
import { rateLimit } from '../rateLimit.js';

export const config = { runtime: "nodejs" };

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }

  const chunks = [];
  await new Promise((resolve) => {
    req.on("data", (c) => chunks.push(c));
    req.on("end", resolve);
    req.on("error", resolve);
  });
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch { return {}; }
}

const ALLOWED = new Set([
  "full_name",
  "phone",
  "address_line1",
  "address_number",
  "address_line2",
  "neighborhood",
  "city",
  "state",
  "zip",
  "cpf",
  "birthdate",
  "has_second_address",
  "address2_line1",
  "address2_number",
  "address2_line2",
  "address2_neighborhood",
  "address2_city",
  "address2_state",
  "address2_zip",
]);

async function getActiveCycleKey(sb) {
  try {
    const { data, error } = await sb
      .from("vip_cycle_control")
      .select("active_cycle_key")
      .eq("id", "default")
      .maybeSingle();
    if (error) return "";
    return String(data?.active_cycle_key || "").trim();
  } catch {
    return "";
  }
}


async function getLastVipAccountCycleKey(sb, userId) {
  try {
    const { data, error } = await sb
      .from("orders")
      .select("created_at")
      .eq("user_id", userId)
      .eq("order_type", "vip")
      .in("status", ["paid", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return "";
    return String(data?.created_at || "").slice(0, 7);
  } catch {
    return "";
  }
}

async function loadProfileCompat(sb, userId) {
  const selectWithCycleKey = "full_name, phone, cpf, birthdate, address_line1, address_number, address_line2, neighborhood, city, state, zip, vip_until, vip_plan, vip_cycle_key, has_second_address, address2_line1, address2_number, address2_line2, address2_neighborhood, address2_city, address2_state, address2_zip";
  const selectWithoutCycleKey = "full_name, phone, cpf, birthdate, address_line1, address_number, address_line2, neighborhood, city, state, zip, vip_until, vip_plan, has_second_address, address2_line1, address2_number, address2_line2, address2_neighborhood, address2_city, address2_state, address2_zip";

  let resp = await sb.from("profiles").select(selectWithCycleKey).eq("id", userId).maybeSingle();
  if (!resp?.error) return { profile: resp.data || {}, missingVipCycleKeyColumn: false };

  const msg = String(resp.error?.message || "");
  if (!/vip_cycle_key|column|schema cache/i.test(msg)) throw new Error(resp.error.message || "Failed to load profile");

  resp = await sb.from("profiles").select(selectWithoutCycleKey).eq("id", userId).maybeSingle();
  if (resp?.error) throw new Error(resp.error.message || "Failed to load profile");

  const profile = { ...(resp.data || {}) };
  const vipUntil = profile?.vip_until ? new Date(String(profile.vip_until)) : null;
  if (vipUntil && Number.isFinite(vipUntil.getTime()) && vipUntil > new Date()) {
    profile.vip_cycle_key = await getLastVipAccountCycleKey(sb, userId);
  } else {
    profile.vip_cycle_key = "";
  }
  return { profile, missingVipCycleKeyColumn: true };
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:profile', limit: 30, windowMs: 60000 })) return;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const sb = supabaseAdmin();

    if (req.method === "GET") {
      const { profile, missingVipCycleKeyColumn } = await loadProfileCompat(sb, user.id);
      return res.status(200).json({ profile: profile || {}, schema_compat: { missing_vip_cycle_key_column: !!missingVipCycleKeyColumn } });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const incoming = body?.profile && typeof body.profile === "object" ? body.profile : body;

      const payload = { id: user.id };
      for (const [k, v] of Object.entries(incoming || {})) {
        if (!ALLOWED.has(k)) continue;
        const val = typeof v === "string" ? v.trim() : v;
        // Permite null para limpar campos (ex: segundo endereço)
        if (val === "" || val === undefined) continue;
        payload[k] = val;
      }

      const { error } = await sb.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) return res.status(500).json({ error: error.message || "Failed to save profile" });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}