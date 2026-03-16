import handleAdminStatus from '../server/api_handlers/admin-status.js';
import handleCancelOrder from '../server/api_handlers/cancel-order.js';
import handleCoupons from '../server/api_handlers/coupons.js';
import handleCreateCheckoutSession from '../server/api_handlers/create-checkout-session.js';
import handleCreatePixPayment from '../server/api_handlers/create-pix-payment.js';
import handleDeleteAccount from '../server/api_handlers/delete-account.js';
import handlePixPayment from '../server/api_handlers/pix-payment.js';
import handleProfile from '../server/api_handlers/profile.js';
import handleVipPlans from '../server/api_handlers/vip-plans.js';
import handleVipPresent from '../server/api_handlers/vip-present.js';
import handleVipCycle from '../server/api_handlers/vip-cycle.js';

export const config = { runtime: 'nodejs' };

const ACTIONS = {
  'admin-status': handleAdminStatus,
  'cancel-order': handleCancelOrder,
  'coupons': handleCoupons,
  'create-checkout-session': handleCreateCheckoutSession,
  'create-pix-payment': handleCreatePixPayment,
  'delete-account': handleDeleteAccount,
  'pix-payment': handlePixPayment,
  'profile': handleProfile,
  'vip-plans': handleVipPlans,
  'vip-present': handleVipPresent,
  'vip-cycle': handleVipCycle,
};

export default async function handler(req, res) {
  try {
    const action = String(req.query?.api_action || req.query?.action || '').trim().toLowerCase();
    const fn = ACTIONS[action];
    if (!fn) return res.status(404).json({ error: 'Unknown API action' });
    return await fn(req, res);
  } catch (e) {
    console.error('api/core error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
