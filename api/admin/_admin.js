import { getUserFromAuthHeader } from "../_supabase.js";

function parseList(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/[;,\n]/g)
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails() {
  return parseList(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "");
}

export async function requireAdmin(req) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const email = String(user.email || "").trim().toLowerCase();
  const admins = getAdminEmails();
  if (!admins.length) {
    return { ok: false, status: 403, error: "ADMIN_EMAILS não configurado" };
  }
  if (!email || !admins.includes(email)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, user };
}
