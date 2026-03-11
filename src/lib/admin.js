export async function fetchAdminStatus(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return { isAdmin: false };

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

  return { isAdmin: Boolean(data?.isAdmin) };
}
