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
  const configured = parseAdminEmails(envRaw);
  // Segurança: em PRODUÇÃO não usamos fallback hardcoded.
  // Em DEV (local) permitimos fallback para não travar testes sem env.
  const isDev = Boolean(import.meta?.env?.DEV);
  const fallback = isDev ? ["francafelipe448@gmail.com"] : [];
  const list = configured.length ? configured : fallback;
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return list.includes(e);
}
