export function parseAdminEmails(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(/[;,\n]/g)
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  // Prefer env-configured list, but keep a simple fallback for single-owner installs.
  // This prevents "Admin" menu from disappearing if Vercel env vars weren't applied to the client build.
  const envRaw = import.meta?.env?.VITE_ADMIN_EMAILS || import.meta?.env?.VITE_ADMIN_EMAIL;
  const configured = parseAdminEmails(envRaw);
  const fallback = ["francafelipe448@gmail.com"];
  const list = configured.length ? configured : fallback;
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return list.includes(e);
}
