# Cubo Criativo — revisão do sistema de vendedores e afiliados

Atualização: 12/11/2026. Este ZIP inclui o **site completo** com as correções anteriores de miniaturas personalizadas.

## Instalação obrigatória (ordem recomendada)

1. Faça backup do banco de dados do Supabase e guarde uma cópia da versão atual do site.
2. No **SQL Editor do Supabase**, execute o arquivo:
   `supabase/migrations/20261112_affiliates_withdrawals.sql`.
   Ele deve ser executado **antes** de publicar a nova versão do código.
3. Se a migração de miniaturas personalizadas da versão anterior ainda não tiver sido executada, instale-a também conforme `MINIATURAS_PERSONALIZADAS.md`.
4. Publique o projeto atualizado (frontend e as rotas em `api/` e `server/`) no mesmo ambiente em que o site funciona hoje. Preserve todas as variáveis de ambiente existentes, especialmente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` e as variáveis públicas do frontend. **Não inclua segredos no repositório ou no frontend.**
5. Para alertas adicionais por e-mail sobre saques, mantenha as variáveis já usadas pelo site: `RESEND_API_KEY`, `RESEND_FROM` e `ORDER_EMAIL_TO`. Sem elas, o aviso continuará funcionando **no menu e no painel administrativo**, mas não será enviado e-mail.
6. Teste com duas contas distintas (cliente e vendedor) e o ambiente de testes do Mercado Pago antes de aceitar cobranças reais.

**Pré-requisito:** as tabelas existentes `affiliates`, `affiliate_visits`, `affiliate_attributions`, `affiliate_commissions`, `coupons` e `orders` precisam existir. A nova migração **complementa** o sistema de vendedores já existente; não cria do zero as tabelas legadas.

## O que mudou

### Administração → Vendedores

- Criação e edição de vendedor a partir de cliente cadastrado.
- Na **mesma criação**, opção para cadastrar um cupom exclusivo vinculado ao novo vendedor (código, descrição, tipo e valor do desconto, aplicação e limite de usos).
- Botão **Criar cupom** em cada vendedor, além da área própria de cupons.
- Botão **Excluir** desativa o cadastro, o link e os cupons; o vendedor sai da listagem. A exclusão é lógica para preservar obrigações financeiras, histórico de compras, saques e auditoria. É possível cadastrar novamente o mesmo usuário depois.
- Painel destacado **Solicitações de saque**: nome, valor, chave Pix, titular, data, botão para copiar chave e ações **Marcar saque executado** / **Recusar**.
- Alertas: contador no menu “Vendedores” atualiza periodicamente (45s) e e-mail para `ORDER_EMAIL_TO` quando Resend está configurado.
- Removido o pagamento individual e descontrolado de comissões: o registro de pagamento ocorre exclusivamente no fluxo de saque, em uma transação controlada.

### Área do vendedor

- Página dedicada: `/vendedor`; link de acesso disponível em `/conta` para contas com cadastro de vendedor.
- Link de indicação copiável e prazo de atribuição.
- Acessos, visitantes únicos, pedidos atribuídos e vendas.
- **Saldo disponível** (comissões confirmadas e ainda não reservadas), **a confirmar** (pagamento pendente), **em processamento** (solicitações de saque) e **total recebido** (comissões pagas).
- Histórico de comissões, solicitações de saque e cupons vinculados.
- Cadastro e edição de **chave Pix** e **nome do titular**; as informações são privadas e ficam salvas para saques futuros.
- **Solicitar saque** requer dados Pix completos e saldo confirmado disponível. O valor total disponível é reservado. Não é possível fazer duas solicitações pendentes ao mesmo tempo.
- Ao editar os dados Pix, solicitações antigas preservam a chave/titular originalmente informados para evitar alteração silenciosa da instrução de pagamento.

### Atribuição e confirmação de comissões

- Os links `/v/slug` registram a visita no backend. O checkout verifica se essa visita realmente existe e ainda está dentro da janela configurada; informar um slug isolado não é suficiente para criar crédito.
- Um **cupom válido vinculado ao vendedor prevalece sobre o link** de outro vendedor.
- O sistema bloqueia comissão por compra feita pelo próprio vendedor.
- Pix, cartão e **miniaturas/bustos personalizados** usam a mesma resolução de comissão.
- A atribuição é gravada no pedido e a comissão é criada **antes de iniciar a cobrança**. Se a persistência falhar, o checkout não prossegue silenciosamente sem registrar o vendedor.
- Após pagamento aprovado, o webhook confirma a comissão. Em erro de persistência, o webhook responde com falha temporária para permitir nova entrega do evento.
- Os totais do painel são calculados diretamente no banco via agregações, e não somente a partir das últimas 100 linhas.
- Um pagamento recusado ou estornado cancela sua comissão. Se ela estava reservada em saque ainda não executado, o pedido de saque é recusado automaticamente e as demais comissões do lote voltam a ficar disponíveis.
- **Pagamentos VIP:** mantém a regra anterior: sem comissão para upgrades e renovações, com comissão apenas na primeira adesão elegível.

### Segurança dos saques

- Tabelas privadas `affiliate_payout_profiles` e `affiliate_withdrawal_requests` com RLS ativada, sem acesso direto de clientes.
- As funções SQL financeiras são permitidas somente a `service_role`; os endpoints validam o usuário da sessão ou o nível administrativo antes de chamá-las.
- Reserva do saldo e finalização de saque utilizam bloqueios de banco (`FOR UPDATE`) e checagens de status, evitando saque em duplicidade.
- **Marcar saque executado não envia dinheiro**; o administrador deve **fazer o Pix no aplicativo bancário** e só então marcar o saque como executado.

## Roteiro de testes

1. Crie uma vendedora usando um cliente já cadastrado; marque “Criar cupom” e informe, por exemplo, um código único de teste e desconto de 5%.
2. Entre na conta de vendedor, abra `/vendedor`, copie o link e confirme que as estatísticas aparecem.
3. Em **outra conta e navegador**, abra o link `/v/slug` e faça uma compra de teste. Antes do pagamento, a comissão deve aparecer como **pendente**; após confirmação do Mercado Pago, como **confirmada**, e o saldo disponível deve aumentar.
4. Faça uma compra de teste aplicando o cupom da vendedora (mesmo sem entrar pelo link). Confira a comissão vinculada à mesma vendedora. Para testar conflitos, entre pelo link do vendedor A e use cupom do vendedor B: **B** deverá receber.
5. Repita com uma miniatura personalizada usando imagens e um cupom vinculado.
6. Na conta da vendedora, salve chave Pix e titular, solicite o saque. Confira que o saldo passa para **em processamento** e a solicitação aparece no menu **Admin → Vendedores**.
7. No admin, confirme a chave Pix e **somente depois de transferir o dinheiro** clique em “Marcar saque executado”. O vendedor deve ver o valor em **Total recebido**.
8. Teste a **recusa** de uma segunda solicitação; o valor deverá voltar a **saldo disponível**.
9. Teste editar os dados Pix após um saque; o saque anterior deve continuar com os dados originais.
10. Exclua o vendedor: o link deve parar de atribuir novas compras, os cupons devem ficar inativos, mas o histórico anterior deve continuar registrado.
11. Verifique os casos de reembolso e webhook de pagamento repetido no ambiente de testes.

## Verificações realizadas neste projeto

- 9 testes específicos com Node.js para slug, atribuição por visita, cupom prioritário, janela expirada, prevenção de autocomissão, criação de crédito e idempotência.
- Verificação de sintaxe de todos os arquivos JavaScript do backend (`node --check`).
- Verificação sintática dos JSX modificados com o parser TypeScript.
- A compilação completa não pôde ser executada no ambiente de edição porque os pacotes de build não estavam disponíveis e a instalação de dependências não respondeu; execute `npm ci`, `npm test` e `npm run build` na sua máquina/CI antes da publicação.

## Observações

- Não foi feita nenhuma alteração no banco de produção ou nas configurações da hospedagem automaticamente. Execute a migração e faça o deploy.
- Comissões antigas sem identificação de vendedor no pedido não podem ser atribuídas retroativamente com segurança apenas pelo nome do cliente.
- Um estorno **depois que um saque já foi executado** não desfaz automaticamente a transferência Pix; a administração precisa tratar esse ajuste financeiro manualmente.
- O contador de acessos conta visitas registradas ao link; pode incluir acessos repetidos do mesmo visitante. “Visitantes únicos” usa o identificador local do visitante.
