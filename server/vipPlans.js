export const DEFAULT_VIP_PLANS = [
  { id: "CUBO_L1_RPG", slug: "level-1", name: "Cubo Level 1 — RPG", short_name: "Level 1", price_brl: 40.0, miniatures_count: 3, boss_count: 0, scale: "32mm", active: true, sort_order: 1 },
  { id: "CUBO_L2_RPG", slug: "level-2", name: "Cubo Level 2 — RPG", short_name: "Level 2", price_brl: 69.9, miniatures_count: 4, boss_count: 1, scale: "32mm", active: true, sort_order: 2 },
];

export function getDefaultVipPlanById(id) {
  return DEFAULT_VIP_PLANS.find((p) => p.id === String(id || '').trim()) || null;
}

export async function listVipPlans(sb) {
  try {
    if (!sb) return DEFAULT_VIP_PLANS;
    const { data, error } = await sb.from('vip_plans').select('*').eq('active', true).order('sort_order', { ascending: true });
    if (error || !Array.isArray(data) || !data.length) return DEFAULT_VIP_PLANS;
    return data.map((r) => ({ ...getDefaultVipPlanById(r.id), ...r }));
  } catch { return DEFAULT_VIP_PLANS; }
}

export async function getVipPlanById(sb, id) {
  const planId = String(id || '').trim();
  const fallback = getDefaultVipPlanById(planId);
  try {
    if (!sb || !planId) return fallback;
    const { data, error } = await sb.from('vip_plans').select('*').eq('id', planId).maybeSingle();
    if (error || !data) return fallback;
    return { ...(fallback || {}), ...data };
  } catch { return fallback; }
}

export function vipPlanDisplayName(plan) {
  const minis = Number(plan?.miniatures_count) || 0;
  const boss = Number(plan?.boss_count) || 0;
  const extras = [minis ? `${minis} miniatura${minis>1?'s':''}` : '', boss ? `${boss} boss` : ''].filter(Boolean).join(' + ');
  return `${plan?.name || plan?.id}${extras ? ` (${extras})` : ''}`;
}
