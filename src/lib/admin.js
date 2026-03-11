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

  console.log("LIB ADMIN DEBUG", {
    envRaw,
    list,
    email,
    normalizedEmail: e,
    match: !!e && list.includes(e),
  });

  if (!e) return false;
  return list.includes(e);
}