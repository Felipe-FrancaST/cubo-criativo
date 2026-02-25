import { supabaseAdmin } from "../server/supabase.js";
import { listVipPlans } from "../server/vipPlans.js";
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const plans = await listVipPlans(supabaseAdmin());
    return res.status(200).json({ plans });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
