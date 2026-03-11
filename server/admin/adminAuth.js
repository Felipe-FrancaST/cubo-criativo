import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";

async function queryAdminRowByUserId(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return { ok: true, isAdmin: false };

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || "");
      if (/relation|does not exist|not exist/i.test(msg)) {
        return { ok: false, status: 503, error: "Tabela public.admins não encontrada." };
      }
      return { ok: false, status: 500, error: error.message || "Falha ao validar admin." };
    }

    return { ok: true, isAdmin: Boolean(data?.user_id) };
  } catch (error) {
    return { ok: false, status: 500, error: error?.message || "Falha ao validar admin." };
  }
}

export async function isUserAdmin(user) {
  const userId = String(user?.id || "").trim();
  if (!userId) return { ok: true, isAdmin: false };
  return queryAdminRowByUserId(userId);
}

export async function getAdminAuth(req) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return { ok: false, status: 401, error: "Unauthorized", isAdmin: false, user: null };

  const adminCheck = await isUserAdmin(user);
  if (!adminCheck.ok) {
    return { ok: false, status: adminCheck.status || 500, error: adminCheck.error || "Falha ao validar admin.", isAdmin: false, user };
  }

  return {
    ok: Boolean(adminCheck.isAdmin),
    status: adminCheck.isAdmin ? 200 : 403,
    error: adminCheck.isAdmin ? null : "Forbidden",
    isAdmin: Boolean(adminCheck.isAdmin),
    user,
  };
}

export async function requireAdmin(req) {
  const auth = await getAdminAuth(req);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  return { ok: true, user: auth.user };
}
