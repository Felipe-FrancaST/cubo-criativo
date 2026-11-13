/** Regras de embalagens por escala. As regras são editadas no painel, não no checkout. */
export const DEFAULT_SCALE_RULES = Object.freeze([
  { id: 'action_10cm', kind: 'action', scale: '10 cm', package_key: 'action_10' },
  { id: 'action_12cm', kind: 'action', scale: '12 cm', package_key: 'action_12' },
  { id: 'action_15cm', kind: 'action', scale: '15 cm', package_key: 'action_15' },
  { id: 'action_20cm', kind: 'action', scale: '20 cm', package_key: 'action_20' },
  { id: 'miniature_32mm', kind: 'miniature', scale: '32 mm', small_package_key: 'miniature_small', large_package_key: 'miniature_large', small_limit: 2, large_limit: 10 },
]);

export function normalizedScale(value) {
  const match = String(value ?? '').trim().replace(',', '.').match(/^(\d+(?:\.\d{1,2})?)\s*(cm|mm)$/i);
  if (!match) return '';
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0 || number > 300) return '';
  return `${number} ${match[2].toLowerCase()}`;
}

export function validateScaleRules(rules, packages) {
  if (!Array.isArray(rules) || rules.length > 80) throw new Error('A lista de escalas deve ter até 80 itens.');
  const ids = new Set(), uniques = new Set();
  return rules.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Escala ${index + 1} inválida.`);
    const id = String(raw.id || '').trim();
    if (!/^[a-z][a-z0-9_]{2,55}$/.test(id) || ids.has(id)) throw new Error('Identificador de escala inválido ou repetido.');
    ids.add(id);
    const kind = String(raw.kind);
    if (!['action', 'miniature'].includes(kind)) throw new Error('Escolha action figure ou miniatura RPG.');
    const scale = normalizedScale(raw.scale);
    if (!scale) throw new Error(`Informe o tamanho da escala ${index + 1} em cm ou mm, por exemplo 25 cm ou 28 mm.`);
    if ((kind === 'action' && !scale.endsWith('cm')) || (kind === 'miniature' && !scale.endsWith('mm'))) {
      throw new Error('Action figures devem usar cm; miniaturas RPG devem usar mm.');
    }
    const unique = `${kind}:${scale}`;
    if (uniques.has(unique)) throw new Error(`A escala ${scale} já está cadastrada nessa categoria.`);
    uniques.add(unique);
    if (kind === 'action') {
      const package_key = String(raw.package_key || '');
      if (!Object.hasOwn(packages, package_key)) throw new Error(`Selecione uma caixa existente para ${scale}.`);
      return { id, kind, scale, package_key };
    }
    const small_package_key = String(raw.small_package_key || '');
    const large_package_key = String(raw.large_package_key || '');
    if (!Object.hasOwn(packages, small_package_key) || !Object.hasOwn(packages, large_package_key)) {
      throw new Error(`Selecione caixas válidas para miniaturas ${scale}.`);
    }
    const small_limit = Number(raw.small_limit), large_limit = Number(raw.large_limit);
    if (!Number.isInteger(small_limit) || small_limit < 1 || small_limit > 20 || !Number.isInteger(large_limit) || large_limit <= small_limit || large_limit > 100) {
      throw new Error(`Informe quantidades válidas por caixa para miniaturas ${scale}.`);
    }
    return { id, kind, scale, small_package_key, large_package_key, small_limit, large_limit };
  });
}
