import crypto from 'crypto';
import { supabaseAdmin } from './supabase.js';

export function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

export function buildControlNumber(orderId) {
  const hex = String(orderId || '').replace(/[^a-f0-9]/gi, '').slice(-12).padStart(12, '0');
  const num = BigInt('0x' + hex) % 90000000n + 10000000n;
  return String(num);
}

export function getManualOrderSecret() {
  return String(process.env.MANUAL_ORDER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'manual-order-secret').trim();
}

export function signManualOrder(orderId) {
  return crypto.createHmac('sha256', getManualOrderSecret()).update(String(orderId || '')).digest('hex');
}

export function verifyManualOrderSignature(orderId, sig) {
  const expected = signManualOrder(orderId);
  const got = String(sig || '').trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

export function buildManualPaymentLink({ baseUrl, orderId }) {
  const sig = signManualOrder(orderId);
  return `${String(baseUrl || '').replace(/\/$/, '')}/pagamento-pedido?order=${encodeURIComponent(orderId)}&sig=${encodeURIComponent(sig)}`;
}

export async function findAuthUserByEmail(sb, email) {
  const wanted = String(email || '').trim().toLowerCase();
  if (!wanted) return null;
  let page = 1;
  const perPage = 200;
  while (page < 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((u) => String(u?.email || '').trim().toLowerCase() === wanted);
    if (found) return found;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}



export async function loadManualOrderCustomer(sb, userId) {
  const wanted = String(userId || '').trim();
  if (!wanted) throw new Error('Cliente inválido.');
  const authResp = await sb.auth.admin.getUserById(wanted);
  if (authResp?.error || !authResp?.data?.user) throw (authResp?.error || new Error('Cliente não encontrado.'));
  const authUser = authResp.data.user;
  const { data: profile } = await sb.from('profiles').select('id,full_name,phone,cpf,address_line1,address_number,address_line2,neighborhood,city,state,zip').eq('id', wanted).maybeSingle();
  return {
    userId: wanted,
    email: String(authUser.email || '').trim().toLowerCase(),
    fullName: String(profile?.full_name || authUser.user_metadata?.full_name || '').trim(),
    phone: String(profile?.phone || '').trim(),
    cpf: normalizeCpf(profile?.cpf || ''),
    address: {
      address_line1: profile?.address_line1 || '',
      address_number: profile?.address_number || '',
      address_line2: profile?.address_line2 || '',
      neighborhood: profile?.neighborhood || '',
      city: profile?.city || '',
      state: profile?.state || '',
      zip: profile?.zip || '',
    },
  };
}

export async function updateManualOrderCustomerProfile({ userId, email, cpf, fullName, phone, address = {} }) {
  const sb = supabaseAdmin();
  const wanted = String(userId || '').trim();
  if (!wanted) throw new Error('Cliente inválido.');
  const normalizedCpf = normalizeCpf(cpf);
  const profilePayload = {
    id: wanted,
    full_name: fullName || null,
    phone: phone || null,
    cpf: normalizedCpf || null,
    address_line1: address.address_line1 || null,
    address_number: address.address_number || null,
    address_line2: address.address_line2 || null,
    neighborhood: address.neighborhood || null,
    city: address.city || null,
    state: address.state || null,
    zip: address.zip || null,
  };
  Object.keys(profilePayload).forEach((k) => profilePayload[k] == null && delete profilePayload[k]);
  const { error: profileErr } = await sb.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  if (profileErr) throw profileErr;
  if (email) {
    try {
      await sb.auth.admin.updateUserById(wanted, {
        email: String(email).trim().toLowerCase(),
        email_confirm: true,
        user_metadata: { full_name: fullName || '' },
      });
    } catch {}
  }
  return { userId: wanted, email: String(email || '').trim().toLowerCase(), password: null, existing: true };
}

export async function ensureManualOrderCustomerAccount({ email, cpf, fullName, phone, address = {} }) {
  const sb = supabaseAdmin();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedCpf = normalizeCpf(cpf);
  if (!normalizedEmail) throw new Error('E-mail obrigatório para criar a conta do cliente.');
  if (normalizedCpf.length !== 11) throw new Error('CPF inválido para criar a conta do cliente.');

  let authUser = await findAuthUserByEmail(sb, normalizedEmail);
  if (!authUser) {
    const createResp = await sb.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedCpf,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || '',
        has_password: true,
        created_by_admin_order: true,
      },
    });
    if (createResp.error) throw createResp.error;
    authUser = createResp.data?.user || null;
  } else {
    try {
      await sb.auth.admin.updateUserById(authUser.id, {
        password: normalizedCpf,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          full_name: fullName || authUser.user_metadata?.full_name || '',
          has_password: true,
          created_by_admin_order: true,
        },
      });
    } catch {}
  }

  const profilePayload = {
    id: authUser.id,
    full_name: fullName || null,
    phone: phone || null,
    cpf: normalizedCpf,
    address_line1: address.address_line1 || null,
    address_number: address.address_number || null,
    address_line2: address.address_line2 || null,
    neighborhood: address.neighborhood || null,
    city: address.city || null,
    state: address.state || null,
    zip: address.zip || null,
  };
  Object.keys(profilePayload).forEach((k) => profilePayload[k] == null && delete profilePayload[k]);
  const { error: profileErr } = await sb.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  if (profileErr) throw profileErr;

  return { userId: authUser.id, email: normalizedEmail, password: normalizedCpf };
}
