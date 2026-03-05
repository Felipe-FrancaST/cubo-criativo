// Planos VIP são carregados do Supabase (tabela vip_plans).
// Mantemos sem valores fixos no código.
export const DEFAULT_VIP_PLANS = [];

export function getDefaultVipPlanById(id) {
  return DEFAULT_VIP_PLANS.find((p) => p.id === String(id || '').trim()) || null;
}

export async function listVipPlans(sb) {
  try {
    if (!sb) return [];
    const { data, error } = await sb.from('vip_plans').select('*').eq('active', true).order('sort_order', { ascending: true });
    if (error || !Array.isArray(data) || !data.length) return [];
    return data;
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
