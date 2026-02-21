import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export function assertSupabaseEnv() {
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_ANON_KEY) throw new Error("Missing SUPABASE_ANON_KEY");
}

export function supabaseAdmin() {
  assertSupabaseEnv();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getUserFromAuthHeader(req) {
  assertSupabaseEnv();
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  if (!auth || !String(auth).toLowerCase().startsWith("bearer ")) return null;
  const jwt = String(auth).slice(7).trim();
  if (!jwt) return null;

  // Usa o anon key com o JWT do usuário para validar e obter o user
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data?.user || null;
}
