export function isAdminEmail(email) {
  const raw =
    import.meta.env.VITE_ADMIN_EMAILS ||
    import.meta.env.VITE_ADMIN_EMAIL ||
    "";

  const admins = raw
    .split(/[\n,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const normalizedEmail = (email || "").trim().toLowerCase();
  const match = admins.includes(normalizedEmail);

  console.log("ADMIN DEBUG", {
    email,
    normalizedEmail,
    raw,
    admins,
    match,
  });

  return match;
}
