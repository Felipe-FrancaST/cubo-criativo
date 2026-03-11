import { getAdminAuth } from "../admin/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await getAdminAuth(req);
  if (!auth.user) {
    return res.status(401).json({ isAdmin: false, user: null, error: auth.error || "Unauthorized" });
  }

  if (!auth.ok && auth.status !== 403) {
    return res.status(auth.status || 500).json({ isAdmin: false, user: { id: auth.user.id, email: auth.user.email || "" }, error: auth.error || "Falha ao validar admin." });
  }

  return res.status(200).json({
    isAdmin: Boolean(auth.isAdmin),
    user: { id: auth.user.id, email: auth.user.email || "" },
  });
}
