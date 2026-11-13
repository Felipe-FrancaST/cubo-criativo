# Cubo Criativo — Chaves Pix de vendedores

## O que mudou

Em **Minha área de vendedor → Recebimento por Pix**, o vendedor escolhe o tipo de chave: **CPF, CNPJ, Celular, E-mail ou Chave aleatória**. Ao selecionar o tipo, o campo apresenta uma dica e um exemplo apropriado. O botão **Salvar dados Pix** permanece desabilitado até que a chave e o nome do titular sejam válidos.

O frontend e o backend usam a **mesma validação** (`shared/pixKey.js`):

- CPF: 11 números e dígitos verificadores conferidos.
- CNPJ: 14 caracteres (inclusive alfanuméricos, quando aplicável) e dígitos verificadores conferidos.
- Celular brasileiro: DDD + 9 dígitos, com normalização para o formato internacional `+55DD9XXXXXXXX`.
- E-mail: endereço de e-mail válido, convertido em minúsculas.
- Chave aleatória: 36 caracteres hexadecimais com hífens (formato UUID).

O nome do titular continua obrigatório. O servidor rejeita chave inválida mesmo se alguém tentar enviar dados diretamente por API. A confirmação do saque continua solicitando a senha da conta, como antes.

**A validação é sintática.** Ela não verifica no DICT se a chave está cadastrada e não confirma a titularidade bancária. Na transferência manual, confirme o nome do favorecido no aplicativo do banco antes de efetuar o Pix.

## Instalação (necessária)

1. Faça um backup do banco, se possível.
2. No **Supabase → SQL Editor**, execute **`supabase/migrations/20261113_affiliate_pix_key_types.sql`**. Execute-o após as migrações anteriores de afiliados, especialmente `20261112_affiliates_withdrawals.sql`.
3. Publique o novo projeto completo na Vercel (frontend e API).
4. Acesse **Minha área de vendedor**, selecione o tipo e salve a chave.
5. Faça um teste completo de cadastro, solicitação e aprovação de saque com dados de teste.

**Cadastros anteriores:** o tipo fica intencionalmente sem seleção até que o vendedor revise e salve novamente o cadastro Pix. Isso evita classificar incorretamente uma chave antiga. Solicitações de saque já feitas não são alteradas; seu histórico permanece salvo. Novos saques guardam uma cópia do tipo, chave e nome do titular no momento da solicitação.

## O que não mudou

As comissões, os saldos, os cupons, as regras de saques, os pagamentos Pix e cartão de clientes e o fluxo de frete permanecem iguais. O código não cria transferências bancárias automáticas.

## Verificações realizadas

Execute `node --test test/affiliate-pix-key-types.test.js`. A suíte completa usa `npm test`; neste ambiente, a versão de origem não possui todas as dependências do npm nem alguns SQL antigos esperados por testes legados. É necessário executar uma compilação integral na Vercel e testar os fluxos de saque com o Supabase configurado.
