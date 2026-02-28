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
import { getUserFromAuthHeader, supabaseAdmin } from "../server/supabase.js";
import { z, safeJsonBody, validateBody } from "../server/validate.js";

export const config = { runtime: "nodejs" };

const BodySchema = z
  .object({
    profile: z.record(z.any()).optional(),
  })
  .passthrough();

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
]);

export default async function handler(req, res) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const sb = supabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await sb
        .from("profiles")
        .select(
          "full_name, phone, cpf, birthdate, address_line1, address_number, address_line2, neighborhood, city, state, zip, vip_until, vip_plan"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message || "Failed to load profile" });
      return res.status(200).json({ profile: data || {} });
    }

    if (req.method === "POST") {
      const bodyRaw = safeJsonBody(req);
      const v = validateBody(BodySchema, bodyRaw);
      if (!v.ok) return res.status(v.status).json({ error: v.error, details: v.details });
      const body = v.data;
      const incoming = body?.profile && typeof body.profile === "object" ? body.profile : body;

      const payload = { id: user.id };
      for (const [k, v] of Object.entries(incoming || {})) {
        if (!ALLOWED.has(k)) continue;
        const val = typeof v === "string" ? v.trim() : v;
        if (val === "" || val === null || val === undefined) continue;
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
