import { getUserFromAuthHeader } from "../supabase.js";

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
  // Segurança: em produção NÃO usamos fallback hardcoded.
  // Em dev (local) mantemos fallback para facilitar testes sem env.
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const fallbackAdmins = isProd ? [] : ["francafelipe448@gmail.com"];
  const allowed = admins.length ? admins : fallbackAdmins;
  if (!email || !allowed.includes(email)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, user };
}
