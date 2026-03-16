import { supabaseAdmin } from '../supabase.js';

async function fetchVipCycleControlState(sb) {
  let resp = await sb
    .from('vip_cycle_control')
    .select('id,active_cycle_key')
    .eq('id', 'default')
    .maybeSingle();

  if (resp?.error) {
    const msg = String(resp.error.message || '');
    if (/relation|does not exist|not exist/i.test(msg)) {
      return { active_cycle_key: null, setup_required: true };
    }
    throw new Error(resp.error.message || 'Falha ao carregar controle do ciclo VIP.');
  }
  return {
    active_cycle_key: String(resp?.data?.active_cycle_key || '').trim() || null,
    setup_required: false,
  };
}

export default async function handleVipCycle(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sb = supabaseAdmin();
  const control = await fetchVipCycleControlState(sb);

  let query = sb
    .from('vip_mini_options')
    .select('id,title,description,image_url,gallery_images,sort_order,active,item_type,cycle_key')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const requestedCycle = String(req.query?.cycle_key || '').trim();
  const activeCycle = requestedCycle || control.active_cycle_key || null;
  if (activeCycle) query = query.eq('cycle_key', activeCycle);

  let { data, error } = await query;
  if (error) {
    const msg = String(error.message || '');
    if (/cycle_key|column/i.test(msg)) {
      const fallback = await sb
        .from('vip_mini_options')
        .select('id,title,description,image_url,gallery_images,sort_order,active,item_type')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (fallback?.error) return res.status(500).json({ error: fallback.error.message || 'Falha ao carregar opções VIP.' });
      return res.status(200).json({
        active_cycle_key: activeCycle,
        setup_required: !!control.setup_required,
        items: Array.isArray(fallback.data) ? fallback.data : [],
        cycle_filtered: false,
      });
    }
    return res.status(500).json({ error: error.message || 'Falha ao carregar opções VIP.' });
  }

  return res.status(200).json({
    active_cycle_key: activeCycle,
    setup_required: !!control.setup_required,
    items: Array.isArray(data) ? data : [],
    cycle_filtered: !!activeCycle,
  });
}
