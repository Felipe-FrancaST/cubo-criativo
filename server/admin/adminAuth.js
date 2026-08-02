import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";

export const ADMIN_LEVEL = Object.freeze({
  NONE: 0,
  OPERATOR: 1,
  MANAGER: 2,
  OWNER: 3,
});

export function normalizeAdminLevel(value) {
  const level = Number(value || 0);
  if (!Number.isFinite(level)) return ADMIN_LEVEL.NONE;
  return Math.max(ADMIN_LEVEL.NONE, Math.min(ADMIN_LEVEL.OWNER, Math.trunc(level)));
}

export function adminLevelLabel(value) {
  const level = normalizeAdminLevel(value);
  if (level >= ADMIN_LEVEL.OWNER) return "Proprietário";
  if (level >= ADMIN_LEVEL.MANAGER) return "Gerente";
  if (level >= ADMIN_LEVEL.OPERATOR) return "Operador";
  return "Sem acesso";
}

async function queryAdminRowByUserId(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return { ok: true, isAdmin: false, adminLevel: ADMIN_LEVEL.NONE };

  try {
    const sb = supabaseAdmin();
    let { data, error } = await sb
      .from("admins")
      .select("user_id,admin_level,created_by,created_at,updated_at")
      .eq("user_id", uid)
      .maybeSingle();

    let legacyLevelFallback = false;
    if (error && /admin_level|created_by|updated_at|column|schema cache/i.test(String(error.message || ""))) {
      const legacy = await sb.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
      data = legacy.data ? { ...legacy.data, admin_level: ADMIN_LEVEL.OWNER } : null;
      error = legacy.error;
      legacyLevelFallback = Boolean(data?.user_id);
    }

    if (error) {
      const msg = String(error.message || "");
      if (/relation|does not exist|not exist/i.test(msg)) {
        return { ok: false, status: 503, error: "Tabela public.admins não encontrada." };
      }
      return { ok: false, status: 500, error: error.message || "Falha ao validar admin." };
    }

    const adminLevel = data?.user_id
      ? Math.max(ADMIN_LEVEL.OPERATOR, normalizeAdminLevel(data?.admin_level || ADMIN_LEVEL.OPERATOR))
      : ADMIN_LEVEL.NONE;

    return {
      ok: true,
      isAdmin: Boolean(data?.user_id),
      adminLevel,
      adminRole: adminLevelLabel(adminLevel),
      adminRow: data || null,
      needsLevelSetup: legacyLevelFallback,
    };
  } catch (error) {
    return { ok: false, status: 500, error: error?.message || "Falha ao validar admin." };
  }
}

export async function isUserAdmin(user) {
  const userId = String(user?.id || "").trim();
  if (!userId) return { ok: true, isAdmin: false, adminLevel: ADMIN_LEVEL.NONE };
  return queryAdminRowByUserId(userId);
}

export async function getAdminAuth(req) {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      isAdmin: false,
      adminLevel: ADMIN_LEVEL.NONE,
      adminRole: adminLevelLabel(ADMIN_LEVEL.NONE),
      user: null,
    };
  }

  const adminCheck = await isUserAdmin(user);
  if (!adminCheck.ok) {
    return {
      ok: false,
      status: adminCheck.status || 500,
      error: adminCheck.error || "Falha ao validar admin.",
      isAdmin: false,
      adminLevel: ADMIN_LEVEL.NONE,
      adminRole: adminLevelLabel(ADMIN_LEVEL.NONE),
      user,
    };
  }

  return {
    ok: Boolean(adminCheck.isAdmin),
    status: adminCheck.isAdmin ? 200 : 403,
    error: adminCheck.isAdmin ? null : "Forbidden",
    isAdmin: Boolean(adminCheck.isAdmin),
    adminLevel: normalizeAdminLevel(adminCheck.adminLevel),
    adminRole: adminCheck.adminRole || adminLevelLabel(adminCheck.adminLevel),
    adminRow: adminCheck.adminRow || null,
    needsLevelSetup: Boolean(adminCheck.needsLevelSetup),
    user,
  };
}

export async function requireAdmin(req, minimumLevel = ADMIN_LEVEL.OPERATOR) {
  const auth = await getAdminAuth(req);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  const required = Math.max(ADMIN_LEVEL.OPERATOR, normalizeAdminLevel(minimumLevel));
  if (auth.adminLevel < required) {
    return {
      ok: false,
      status: 403,
      error: `Esta operação exige nível ${required} (${adminLevelLabel(required)}).`,
      adminLevel: auth.adminLevel,
    };
  }

  return {
    ok: true,
    user: auth.user,
    adminLevel: auth.adminLevel,
    adminRole: auth.adminRole,
    adminRow: auth.adminRow || null,
    needsLevelSetup: Boolean(auth.needsLevelSetup),
  };
}
