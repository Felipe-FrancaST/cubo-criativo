# Correções — pedidos de miniaturas e bustos personalizados

Este pacote é **o projeto inteiro atualizado**, não um patch isolado.

## Como funciona após as correções

1. O cliente envia uma ou mais imagens e escolhe Pix ou cartão, com login obrigatório.
2. Ao gerar o Pix, o QR Code permanece visível enquanto o pagamento ainda não foi aprovado. A página verifica o pagamento automaticamente, consultando a API da loja e a confirmação do Mercado Pago.
3. Após confirmação real, o QR Code desaparece e surge **"Compra efetuada com sucesso!"**, com opção de abrir **Meus pedidos**.
4. Em **Meus pedidos**, as solicitações são identificadas como **Miniatura personalizada** ou **Busto personalizado**, com galeria de referências e descrição ao expandir os detalhes. Os pedidos são lidos pela tabela `orders`, com informações complementares associadas pelo `order_id` da personalização.
5. Na administração, tanto em **Operação > Pedidos > Detalhes** quanto em **Operação > Personalizadas > Detalhes**, aparecem o tipo da peça e as imagens. O botão **Baixar imagens (.zip)** baixa todas as referências de uma vez.

As imagens seguem privadas no Supabase Storage. A criação dos links de download é permitida apenas para operadores e gestores autenticados. O Pix só é confirmado após verificação segura, nunca apenas por um parâmetro na URL.

## Publicação

- Faça backup do site antes de substituir os arquivos.
- Substitua o código existente por este pacote e publique na sua hospedagem (Vercel, se ainda estiver utilizando essa plataforma).
- **Se você já executou** `supabase/migrations/20261112_custom_miniatures.sql` na implementação anterior, **não é necessário executar SQL novo** para estas correções.
- **Se ainda não executou**, execute a migração original no SQL Editor do Supabase antes de publicar.
- Mantenha as variáveis de ambiente do Supabase e Mercado Pago e o webhook **`/api/mp-webhook`** corretamente configurados.

## Conferência recomendada

Em ambiente de testes: criar pedido com imagens, gerar Pix, aprovar, verificar que QR Code some, abrir Meus pedidos, confirmar descrição e imagens; depois, abrir o pedido no painel administrativo e extrair todas as imagens do ZIP. Repetir para o pagamento por cartão. Testar também um pedido comum para confirmar que seu funcionamento não foi afetado.

**Verificação local realizada:** testes automatizados das alterações (9 testes aprovados), análise de sintaxe JSX/JavaScript. A compilação completa com Vite e um pagamento real não puderam ser executados aqui, pois o ambiente não concluiu a instalação das dependências nem possui acesso às suas credenciais de produção.

Detalhes técnicos adicionais: `MINIATURAS_PERSONALIZADAS.md`.
