export function parseAdminEmails(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/[;,\n]/g)
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  const envRaw = import.meta?.env?.VITE_ADMIN_EMAILS || import.meta?.env?.VITE_ADMIN_EMAIL;
  const list = parseAdminEmails(envRaw);
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return list.includes(e);
}
