# Cubo Criativo — Cupom, cadastro e pagamento padronizado

## Alterações

1. **Cupom em miniaturas personalizadas**: quando a validação detectar CPF ausente ou incompleto, abre automaticamente a janela existente de **Complete o seu cadastro**. O código digitado permanece no formulário. Depois de salvar o perfil, o site consulta novamente a validade do cupom. O backend retorna o código `profile_incomplete` para distinguir essa situação de cupom já utilizado ou restrito a outro CPF.
2. **Seletor de pagamento unificado**: o componente `src/components/PaymentChoice.jsx` (estilos em `src/components/payment-choice.css`) oferece cartões Pix e Cartão, com radio visual, área de pagamento segura e botão de ação dinâmico com estado de carregamento.
3. **Carrinho**: o resumo passa a destacar o total com eventual desconto. Em vez de dois botões de pagamento diferentes, o comprador seleciona a forma de pagamento e confirma com um único botão. Os processos Pix, cartão e WhatsApp anteriores continuam integrados.
4. **Assinatura VIP**: o checkout de um novo ciclo e os diálogos de renovação e upgrade utilizam o mesmo visual. Pix pendente reutilizável continua acessível, quando válido. O botão mostra progresso enquanto gera o pagamento.
5. **Miniaturas personalizadas**: a referência visual original continua sendo utilizada e foi movida para o componente compartilhado, garantindo consistência nas próximas revisões.

## Publicação

- Substitua o projeto pelo conteúdo do ZIP e faça o deploy do frontend e das funções de API.
- **Não há nova migração SQL.** Mantenha as migrações anteriores do projeto aplicadas.
- A lógica de preços, validação de cupons e confirmação de pagamentos continua no servidor; não altere as credenciais de Supabase e Mercado Pago no repositório.
- Após publicar, limpe o cache ou abra uma janela anônima para verificar que o JavaScript atualizado foi carregado.

## Testes recomendados antes de liberar pagamentos reais

1. Entrar com conta com CPF ausente; digitar um cupom válido na página de personalizadas e tocar **Aplicar**. Confirmar que o cadastro abre e o cupom permanece digitado.
2. Completar o cadastro, salvar e conferir que o cupom passa a ser validado e o valor é atualizado.
3. Conferir que cupons já usados, de outro CPF ou expirados **não** abrem o formulário de cadastro indevidamente.
4. Testar carrinho com cupom e sem cupom, usando **Pix** e **Cartão**. Confirmar que o valor total da tela corresponde ao valor gerado pelo backend.
5. Testar assinatura nova, renovação e upgrade em Pix e cartão; conferir animação durante o processamento e acompanhamento do pagamento.
6. Testar em celular, especialmente seleção de forma de pagamento e botão principal no carrinho.

## Validações realizadas neste ambiente

- 13 testes direcionados passaram (cupom, perfil, miniaturas e integração estática das telas).
- Verificação de sintaxe de seis arquivos React/JSX alterados passou usando o parser do TypeScript.
- A compilação de produção e os testes visuais/reais de pagamento **não foram concluídos**, pois as dependências npm não puderam ser instaladas integralmente neste ambiente. Execute `npm ci`, `npm run build` e teste com o Supabase/Mercado Pago configurados antes de publicar em produção.
