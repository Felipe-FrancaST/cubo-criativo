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

export async function fetchAdminStatus(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    return {
      isAdmin: false,
      adminLevel: ADMIN_LEVEL.NONE,
      adminRole: adminLevelLabel(ADMIN_LEVEL.NONE),
      permissions: {},
    };
  }

  const resp = await fetch("/api/admin-status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.error || "Não foi possível validar acesso de admin.");
    err.status = resp.status;
    throw err;
  }

  const adminLevel = normalizeAdminLevel(data?.adminLevel);
  return {
    isAdmin: Boolean(data?.isAdmin),
    adminLevel,
    adminRole: data?.adminRole || adminLevelLabel(adminLevel),
    permissions: data?.permissions || {},
    needsLevelSetup: Boolean(data?.needsLevelSetup),
  };
}
