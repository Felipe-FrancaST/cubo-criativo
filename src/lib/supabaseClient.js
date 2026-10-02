import { createClient } from '@supabase/supabase-js'

// Frontend-only keys (safe to expose)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && /^https?:\/\//.test(supabaseUrl)
)

if (!isSupabaseConfigured) {
  // Não quebra o build; apenas avisa em dev.
  // Você vai configurar na Vercel e/ou no .env local.
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Evita token no hash (melhor com HashRouter) e melhora compatibilidade com OAuth
        flowType: 'pkce',
      },
    })
  : null
