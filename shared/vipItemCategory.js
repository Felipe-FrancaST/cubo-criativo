// A categoria de apresentação é independente da vaga usada pelo plano.
// Construções são armazenadas como boss para preservar as validações do Supabase.
export function vipItemCategory(item) {
  if (item?.display_type === 'construction' || item?.item_type === 'construction') return 'construction'
  return String(item?.item_type || '').toLowerCase() === 'boss' ? 'boss' : 'miniature'
}

export function vipItemLabel(item) {
  return { miniature: 'Miniatura', boss: 'Boss', construction: 'Construção' }[vipItemCategory(item)]
}

export function vipItemStorage(category) {
  if (!['miniature', 'boss', 'construction'].includes(category)) throw new Error('Categoria inválida.')
  return { item_type: category === 'construction' ? 'boss' : category, display_type: category === 'construction' ? 'construction' : null }
}
