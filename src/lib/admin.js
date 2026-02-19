export function parseAdminEmails(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/[;,\n]/g)
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  const list = parseAdminEmails(import.meta?.env?.VITE_ADMIN_EMAILS || import.meta?.env?.VITE_ADMIN_EMAIL);
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return list.includes(e);
}
