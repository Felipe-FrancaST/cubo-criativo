import { createClient } from "@supabase/supabase-js";
import { getUserFromAuthHeader, supabaseAdmin } from "../supabase.js";
import { rateLimit } from '../rateLimit.js';

export const config = { runtime: "nodejs" };

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }

  const chunks = [];
  await new Promise((resolve) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', resolve);
    req.on('error', resolve);
  });
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

async function verifyPassword(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env ausente.');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data?.user || null;
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: 'api:delete-account', limit: 6, windowMs: 60_000 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para continuar.' });

    const body = await readJsonBody(req);
    const password = String(body?.password || '').trim();
    const confirm = body?.confirm === true;

    if (!confirm) return res.status(400).json({ error: 'Confirme a exclusão da conta.' });
    if (!user?.email) return res.status(400).json({ error: 'Não foi possível identificar o e-mail da conta.' });

    const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [];
    const needsPassword = !providers.length || providers.includes('email');

    if (needsPassword) {
      if (!password) return res.status(400).json({ error: 'Informe sua senha atual.' });
      const verifiedUser = await verifyPassword(String(user.email), password);
      if (!verifiedUser || verifiedUser.id !== user.id) {
        return res.status(403).json({ error: 'Senha incorreta.' });
      }
    }

    const sb = supabaseAdmin();

    const { error: delErr } = await sb.auth.admin.deleteUser(user.id, true);
    if (delErr) return res.status(500).json({ error: delErr.message || 'Não foi possível excluir a conta.' });

    // Limpeza best-effort de dados acoplados ao usuário após exclusão no Auth.
    const cleanupOps = [
      sb.from('profiles').delete().eq('id', user.id),
      sb.from('favorite_products').delete().eq('user_id', user.id),
      sb.from('coupon_redemptions').delete().eq('user_id', user.id),
      sb.from('customer_reviews').delete().eq('user_id', user.id),
      sb.from('coupon_game_sessions').delete().eq('user_id', user.id),
      sb.from('vip_present_rolls').delete().eq('user_id', user.id),
      sb.from('vip_mini_selections').delete().eq('user_id', user.id),
      sb.from('vip_theme_votes').delete().eq('user_id', user.id),
    ];
    const cleanupResults = await Promise.allSettled(cleanupOps);
    cleanupResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.error) {
        console.warn('delete-account cleanup warning:', r.value.error.message || r.value.error);
      }
      if (r.status === 'rejected') {
        console.warn('delete-account cleanup rejected:', r.reason);
      }
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e || 'Erro interno');
    const status = /invalid login credentials/i.test(msg) ? 403 : 500;
    return res.status(status).json({ error: status === 403 ? 'Senha incorreta.' : msg });
  }
}
