# Miniaturas personalizadas — Cubo Criativo

## O que foi integrado

- Página pública **`/miniaturas-personalizadas`**, com acesso pelo **menu lateral** e pela **página inicial**.
- Escolha de **busto** ou **miniatura** (ambos começam em **R$ 200,00**), upload de **1 a 6 imagens** JPG, PNG ou WEBP, até 10 MB cada, descrição opcional, pré-visualização e remoção de arquivos.
- **Não é possível pagar sem imagens**. A API comprova a existência e as propriedades dos arquivos no Storage, não confia apenas na interface.
- Login existente do Supabase obrigatório para criar pedido, aplicar cupom ou iniciar pagamento.
- **Pix** (QR Code e copia-e-cola) e **cartão** (redirecionamento ao Checkout Pro oficial do Mercado Pago), com atualização de status pelo **webhook `/api/mp-webhook` já existente**.
- Histórico de encomendas personalizadas na própria página, pré-visualizações restritas, status de pagamento e produção, e opção de **reabrir Pix pendente**.
- Painel em **Administração > Operação > Personalizadas**: lista de pedidos, pesquisa, imagens, descrição e movimentação de etapas após pagamento. Nível **Operador 1** pode acompanhar e gerenciar as etapas; nível **Gerente 2** ou superior também altera os preços de busto e miniatura, independentemente.
- Cupons existentes de **produtos gerais** ou **ambos** são aceitos (sujeitos a regras de CPF, validade, quantidade de usos e pedido mínimo). Não são aplicáveis cupons exclusivos de produto específico, VIP ou frete.
- Imagens em bucket **privado**: uploads assinados emitidos somente após autenticação, e links de visualização temporários emitidos apenas ao dono do pedido ou admin autorizado.

## Passos para ativar (obrigatórios)

1. **Faça backup** do seu projeto e do banco, se possível.
2. No **Supabase > SQL Editor**, execute o arquivo `supabase/migrations/20261112_custom_miniatures.sql`. Ele cria os preços, os pedidos e o bucket privado. Não execute migrações SQL de outros projetos.
3. Confirme na **Vercel** as variáveis que este projeto já usava: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `MP_ACCESS_TOKEN`, `SITE_URL` (URL pública HTTPS). **Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` ou `MP_ACCESS_TOKEN` no frontend ou em variáveis `VITE_`.
4. Publique o novo código na Vercel. O caminho do webhook registrado deve seguir sendo `https://SEU_DOMINIO/api/mp-webhook`.
5. Em **Administração > Personalizadas**, ajuste os dois preços, se desejar.
6. **Antes de aceitar pedidos reais**, faça um teste em ambiente controlado com usuário comum e imagens válidas: login, envio, Pix/Cartão, cupom, retorno do checkout e atualização do status no painel após webhook. Verifique os logs da Vercel, o Storage e os registros no Supabase.

## Observações importantes

- **Não foram feitas alterações diretamente no seu banco Supabase nem na Vercel**. A migração e a publicação precisam ser executadas por quem administra o ambiente.
- O projeto usa a tabela existente `orders` para que pagamentos, e-mails, cupons e webhook continuem aproveitando o sistema da loja. Informações exclusivas de personalização ficam em `custom_miniature_requests`. Para compatibilidade com os fluxos antigos, o campo `order_type` desses pedidos na tabela `orders` é `shop`; use **Administração > Personalizadas** para gerenciar a encomenda e ver as imagens.
- O preço da personalização é cobrado antes de qualquer eventual frete. Se o envio precisa ser calculado, faça-o por seu processo de atendimento antes ou depois do pedido, deixando a política clara ao cliente.
- A API revalida preço e cupom no banco no momento da cobrança. Se o valor da tela ficou desatualizado, a cobrança é interrompida e o cliente deve revisar o total.
- O Pix é reaberto enquanto está pendente. Aprovação financeira é confirmada pelo Mercado Pago via webhook, não só pelo redirecionamento do navegador.
- Por segurança, um pedido não pode ser cobrado duas vezes automaticamente. Se uma chamada ao gateway falhou depois de iniciada, confira o pagamento na conta do Mercado Pago antes de orientar nova tentativa.
- O processamento real do Mercado Pago e a integração com a infraestrutura do usuário **não puderam ser testados neste ambiente**.

## Verificações locais

- `node --test test/custom-miniatures.test.js`: testes das validações de imagens, preços, cupons e migração SQL.
- `npm ci && npm run build && npm run check`: rode no seu computador ou pipeline com Node 24 e dependências instaladas. O pacote enviado não inclui `node_modules`.
