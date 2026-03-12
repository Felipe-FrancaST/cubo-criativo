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

export default async function handler(req, res) {
  
  if (!rateLimit(req, res, { key: 'api:profile', limit: 30, windowMs: 60000 })) return;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const sb = supabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await sb
        .from("profiles")
        .select(
          "full_name, phone, cpf, birthdate, address_line1, address_number, address_line2, neighborhood, city, state, zip, vip_until, vip_plan, has_second_address, address2_line1, address2_number, address2_line2, address2_neighborhood, address2_city, address2_state, address2_zip"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message || "Failed to load profile" });
      return res.status(200).json({ profile: data || {} });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const incoming = body?.profile && typeof body.profile === "object" ? body.profile : body;

      const payload = { id: user.id };
      for (const [k, v] of Object.entries(incoming || {})) {
        if (!ALLOWED.has(k)) continue;
        const val = typeof v === "string" ? v.trim() : v;
        if (val === undefined) continue;
        payload[k] = val === "" ? null : val;
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