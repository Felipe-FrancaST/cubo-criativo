# Cubo Criativo — ajustes de vendedores e afiliados

Este pacote parte da versão `cubo-criativo-afiliados-vendedores-comissoes-saques.zip` e mantém as áreas de pedidos comuns, personalizados, vendedores e administração.

## Instalação (obrigatória)

1. Faça backup do Supabase e do projeto em produção.
2. Confirme que a migração anterior `supabase/migrations/20261112_affiliates_withdrawals.sql` foi aplicada.
3. Execute no **SQL Editor do Supabase** a NOVA migração:
   `supabase/migrations/20261112_affiliate_link_coupons_and_secure_withdrawal.sql`
4. Publique a nova versão COMPLETA do site, incluindo os arquivos `api/` e `server/` (não apenas o frontend).
5. Não publique arquivos `.env` com chaves secretas. Preserve as variáveis de ambiente configuradas na hospedagem (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, além das já usadas pelo site).
6. Teste os passos abaixo no ambiente de teste do Mercado Pago, sem realizar Pix reais para testes desnecessários.

Se a migração nova não for executada, salvar o cupom após login e a atribuição persistente vinculada à conta não funcionarão.

## O que mudou

- **Solicitação de saque:** modal visual de confirmação, mostrando valor, titular e chave Pix, com campo obrigatório para **senha da conta**. O endpoint valida essa senha pelo Supabase Auth em uma sessão descartável, sem armazená-la. Há limite adicional de tentativas. A reserva de comissões continua acontecendo exclusivamente pela função transacional existente `affiliate_request_withdrawal`.
- **Administração:** “Marcar saque executado” e “Recusar” usam confirmações visuais; pagamento Pix é efetuado por fora do site, e a confirmação atualiza o histórico.
- **Área do vendedor:** o cupom ativo aparece junto ao link de divulgação, com botão para copiar. A aba “Meus cupons” também oferece cópia de cada código.
- **Atribuição por link:** o Pix do carrinho agora envia o ID da visita registrada (já utilizado no checkout por cartão). O servidor exige visita válida e registra a comissão após pagamento confirmado, com prioridade para cupom de outro vendedor caso tenha sido aplicado. Ao fazer login após visitar o link, cria-se também um vínculo de indicação autenticado, para evitar perda da comissão ao comprar em outro dispositivo durante o período de atribuição.
- **Cupom do link:** o backend identifica um cupom de vendedor ativo, não expirado e não esgotado. Ao abrir o link, aparece um aviso solicitando login ou criação de conta. Com login, o cupom é salvo para a conta em `affiliate_coupon_claims` e listado na seção “Meus cupons” do carrinho, sem modificar o proprietário do cupom global compartilhado. O botão do aviso abre diretamente a lista de cupons.
- **Proteção:** visitantes não podem atribuir livremente uma comissão enviando apenas uma slug; a visita é validada no banco e não permite autoindicação.

## Como testar

1. No admin, verifique que o vendedor está ativo, possui link `/v/slug` e cupom ativo não esgotado; confira a comissão configurada.
2. Em uma aba anônima, abra o link do vendedor. Deve surgir o aviso **“Faça login ou crie sua conta para garantir o seu cupom.”**.
3. Faça login ou crie uma conta de comprador DIFERENTE da conta do vendedor. Confira o aviso de cupom salvo e abra “Meus cupons” pelo botão no aviso.
4. Adicione um produto ao carrinho, **não aplique o cupom**, pague no ambiente de teste via Pix. A compra deve aparecer como atribuída ao vendedor depois de aprovada pelo Mercado Pago; o vínculo é por link.
5. Repita com outro comprador, usando o checkout com cartão. Atribuição por link deve funcionar sem precisar aplicar o cupom.
6. Repita com cupom vinculado a outro vendedor; o vendedor do **cupom aplicado** deve receber a comissão.
7. Teste a aba do vendedor: cupom em destaque, botão de copiar, número de acessos e comissões pendentes/confirmadas.
8. Cadastre chave Pix e titular; abra “Solicitar saque”. Confira a janela estilizada. Teste uma senha incorreta: o sistema deve impedir o saque. Teste com senha correta e saldo disponível: a solicitação deverá ser criada apenas uma vez.
9. No admin, abra a confirmação estilizada de “Marcar saque executado”, verifique titular, chave e valor. Conclua somente após transferir o Pix. Confira o histórico do vendedor.
10. Para contas criadas apenas com Google, será necessário definir uma senha pelo fluxo de recuperação de acesso antes de solicitar saque.

## Validação local

- Testes específicos de afiliados e indicação: `node --test test/affiliate-link-fixes.test.js test/affiliates-revision.test.js`.
- Arquivos alterados analisados quanto a erros de sintaxe JS/JSX.
- A integração real e o build completo exigem dependências npm e credenciais/configuração do ambiente de publicação; estes testes não simulam a confirmação de pagamentos reais.
