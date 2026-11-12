/** Detecta erro de cadastro sem confundir restrições do cupom com CPF ausente. */
export function needsProfileCompletion(error) {
  if (error?.code === 'profile_incomplete') return true
  const message = String(error?.message || error || '').toLowerCase()
  if (!message || /(?:já|ja) (?:foi )?(?:utilizado|usado)|outro cpf|pertence a outro/.test(message)) return false
  return /(?:complet(?:e|ar|o|ar seus).*?(?:perfil|cadastro|cpf|dados)|perfil incompleto|cadastro incompleto|cpf obrigat[oó]rio|cpf inv[aá]lido|informe (?:seu |o )?cpf|sem cpf)/i.test(message)
}
