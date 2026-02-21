import { getUserFromAuthHeader, supabaseAdmin } from './_supabase.js';
import { calcCouponDiscount } from './_couponGame.js';

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Faça login para usar cupom.' });
    const body = safeBody(req);
    const code = String(body.code || '').trim().toUpperCase();
    const subtotal = Number(body.subtotal || 0);
    if (!code) return res.status(400).json({ error: 'Informe o cupom.' });
    const sb = supabaseAdmin();
    const { data: coupon, error } = await sb.from('coupons').select('*').eq('code', code).maybeSingle();
    if (error) throw error;
    if (!coupon) return res.status(404).json({ error: 'Cupom não encontrado.' });
    if (coupon.user_id && coupon.user_id !== user.id) return res.status(403).json({ error: 'Esse cupom pertence a outra conta.' });
    const result = calcCouponDiscount({ subtotal, coupon });
    if (!result.valid) {
      if (result.reason === 'minimo') return res.status(400).json({ error: `Pedido mínimo para este cupom: R$ ${Number(result.min_order_value).toFixed(2).replace('.', ',')}` });
      return res.status(400).json({ error: 'Cupom inválido, expirado ou já usado.' });
    }
    return res.status(200).json({ ok: true, coupon: { code: coupon.code, label: coupon.label }, ...result });
  } catch (e) {
    console.error('coupon-validate', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
