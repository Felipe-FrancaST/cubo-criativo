import { ADMIN_LEVEL, adminLevelLabel, getAdminAuth } from "../admin/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await getAdminAuth(req);
  if (!auth.user) {
    return res.status(401).json({
      isAdmin: false,
      adminLevel: ADMIN_LEVEL.NONE,
      adminRole: adminLevelLabel(ADMIN_LEVEL.NONE),
      user: null,
      error: auth.error || "Unauthorized",
    });
  }

  if (!auth.ok && auth.status !== 403) {
    return res.status(auth.status || 500).json({
      isAdmin: false,
      adminLevel: ADMIN_LEVEL.NONE,
      adminRole: adminLevelLabel(ADMIN_LEVEL.NONE),
      user: { id: auth.user.id, email: auth.user.email || "" },
      error: auth.error || "Falha ao validar admin.",
    });
  }

  const level = Number(auth.adminLevel || 0);
  return res.status(200).json({
    isAdmin: Boolean(auth.isAdmin),
    adminLevel: level,
    adminRole: auth.adminRole || adminLevelLabel(level),
    needsLevelSetup: Boolean(auth.needsLevelSetup),
    permissions: {
      orders: level >= ADMIN_LEVEL.OPERATOR,
      operations: level >= ADMIN_LEVEL.OPERATOR,
      business: level >= ADMIN_LEVEL.MANAGER,
      administrators: level >= ADMIN_LEVEL.OWNER,
    },
    user: { id: auth.user.id, email: auth.user.email || "" },
  });
}
