/**
 * Validação de formato de chaves Pix para o cadastro de recebimentos.
 * Não consulta o DICT nem confirma titularidade/registro bancário.
 */
export const PIX_KEY_TYPES = Object.freeze([
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00', hint: 'Informe um CPF com 11 dígitos válidos.' },
  { value: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', hint: 'Informe um CNPJ válido (14 caracteres, inclusive alfanumérico).' },
  { value: 'phone', label: 'Celular', placeholder: '(77) 99999-9999', hint: 'Celular brasileiro com DDD. O código +55 será incluído automaticamente.' },
  { value: 'email', label: 'E-mail', placeholder: 'nome@exemplo.com.br', hint: 'Informe o endereço de e-mail cadastrado como chave Pix.' },
  { value: 'random', label: 'Chave aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'Cole a chave aleatória completa, com 36 caracteres e hífens.' },
]);

const digits = (value) => String(value || '').replace(/\D/g, '');
const keyTypes = new Set(PIX_KEY_TYPES.map((entry) => entry.value));

export function pixKeyTypeLabel(type) {
  return PIX_KEY_TYPES.find((item) => item.value === type)?.label || 'Tipo não informado';
}

function validCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (let length = 9; length < 11; length += 1) {
    let total = 0;
    for (let i = 0; i < length; i += 1) total += Number(value[i]) * (length + 1 - i);
    const remainder = (total * 10) % 11;
    if (Number(value[length]) !== (remainder === 10 ? 0 : remainder)) return false;
  }
  return true;
}

/** CNPJ com 12 caracteres alfanuméricos (ou numéricos) + 2 dígitos verificadores. */
function validCnpj(value) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const body = Array.from(value.slice(0, 12), (char) => char.charCodeAt(0) - 48);
  const checksum = (values, weights) => {
    const remainder = values.reduce((total, n, i) => total + n * weights[i], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstDigit = checksum(body, firstWeights);
  const secondDigit = checksum([...body, firstDigit], secondWeights);
  return value.endsWith(`${firstDigit}${secondDigit}`);
}

export function validatePixKey(type, input) {
  const original = String(input || '').trim();
  if (!keyTypes.has(type)) return { ok: false, key: '', error: 'Selecione o tipo de chave Pix.' };
  if (!original || /[\x00-\x1f\x7f]/.test(original)) {
    return { ok: false, key: '', error: 'Informe a chave Pix.' };
  }

  if (type === 'cpf') {
    const cpf = digits(original);
    if (!/^[\d.\-\s]+$/.test(original) || !validCpf(cpf)) return { ok: false, key: cpf, error: 'CPF inválido. Confira os 11 dígitos verificadores.' };
    return { ok: true, key: cpf, error: '' };
  }
  if (type === 'cnpj') {
    const cnpj = original.toUpperCase().replace(/[.\-/\s]/g, '');
    if (!/^[A-Z0-9.\/\-\s]+$/i.test(original) || !validCnpj(cnpj)) return { ok: false, key: cnpj, error: 'CNPJ inválido. Confira os 14 caracteres e dígitos verificadores.' };
    return { ok: true, key: cnpj, error: '' };
  }
  if (type === 'phone') {
    if (!/^\+?[\d()\-\s]+$/.test(original)) return { ok: false, key: '', error: 'Use um celular com DDD, sem letras.' };
    const phoneDigits = digits(original);
    const national = phoneDigits.length === 13 && phoneDigits.startsWith('55')
      ? phoneDigits.slice(2)
      : phoneDigits;
    if (!/^[1-9]\d9\d{8}$/.test(national) || national.length !== 11) {
      return { ok: false, key: '', error: 'Informe um celular brasileiro válido com DDD e 9 dígitos.' };
    }
    return { ok: true, key: `+55${national}`, error: '' };
  }
  if (type === 'email') {
    const email = original.toLowerCase();
    const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (email.length > 77 || !emailRegex.test(email) || email.includes('..')) {
      return { ok: false, key: email, error: 'Informe um e-mail válido (até 77 caracteres).' };
    }
    return { ok: true, key: email, error: '' };
  }
  const random = original.toLowerCase();
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(random)) {
    return { ok: false, key: random, error: 'A chave aleatória deve ter o formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.' };
  }
  return { ok: true, key: random, error: '' };
}

export function validatePixPayout(data) {
  const type = String(data?.pix_key_type || '').toLowerCase();
  const keyResult = validatePixKey(type, data?.pix_key);
  const holderName = String(data?.holder_name || '').trim().replace(/\s+/g, ' ');
  if (!keyResult.ok) return { ok: false, error: keyResult.error };
  if (holderName.length < 3 || holderName.length > 140 || /[\x00-\x1f\x7f]/.test(holderName)) {
    return { ok: false, error: 'Informe o nome completo do titular da conta (3 a 140 caracteres).' };
  }
  return { ok: true, payout: { pix_key_type: type, pix_key: keyResult.key, holder_name: holderName } };
}
