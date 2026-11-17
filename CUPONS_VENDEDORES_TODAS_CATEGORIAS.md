# Cubo Criativo — cupons dos vendedores: Tudo e edição

## O que mudou

No painel **Administração → Vendedores**:

1. Ao cadastrar um vendedor, marque **Criar cupom exclusivo junto com o vendedor**, preencha o código, a descrição, o tipo de desconto, o valor e **Onde funciona**.
2. A opção padrão **Tudo — produtos, personalizadas e assinaturas** autoriza o uso do cupom em compras elegíveis de catálogo, pronta entrega, miniaturas/bustos personalizados e assinaturas VIP. Cupons continuam sujeitos às regras comuns de CPF, validade, uso único e limite de utilizações.
3. A seção **Vendedores cadastrados** mostra atalhos para editar os cupons já associados a cada vendedor.
4. Na seção **Cupons dos vendedores**, cada cupom possui **Editar cupom**. Permite modificar o código (se ainda não usado/resgatado), a descrição, o tipo e valor do desconto, valor mínimo, limite, vencimento, ativação e categorias elegíveis.
5. O vendedor permanece associado ao cupom, e a edição não zera o contador de utilizações ou as comissões anteriores.

## Destinos disponíveis

- **Tudo:** produtos da loja + personalizadas + assinaturas.
- **Somente produtos da loja**.
- **Somente personalizadas:** miniaturas e bustos.
- **Somente assinaturas VIP**.
- **Produtos + personalizadas** (comportamento dos cupons antigos com `products`).
- **Produtos + assinaturas**.
- **Personalizadas + assinaturas**.

Para **Tudo**, filtros de produtos e planos específicos são ignorados e removidos quando salvar o cupom. Cupons antigos mantêm seu funcionamento original (`products`, `vip`, `both`). A elegibilidade para pagamentos de assinatura depende também do fluxo de assinatura e das regras gerais de compra (por exemplo, upgrades e renovações podem ter regras próprias).

## Publicação

1. Antes de atualizar a Vercel, faça backup do banco e execute no **SQL Editor do Supabase** a migração `supabase/migrations/20261117_affiliate_coupon_scopes.sql`.
2. Publique este projeto completo na Vercel, incluindo `shared`, `server`, `api` e `src`.
3. Entre em **Administração → Vendedores**, abra um cupom, selecione **Tudo** e salve.
4. Teste a validação de um cupom em carrinho, assinatura VIP e miniatura/busto personalizado, em Pix e cartão. Confira também se o vendedor permanece vinculado nas comissões.

Não são necessárias novas chaves secretas. **A migração é necessária** para os quatro novos escopos específicos; o campo `both` (Tudo) já existia, mas é importante publicar backend e interface juntos.

## Cuidados

- Ao editar um cupom, o servidor verifica se ele realmente pertence ao vendedor indicado. Não permite transferir o cupom para outro vendedor através da edição.
- O código só pode ser trocado quando não tem usos, pedidos ou cupons resgatados associados; os demais dados continuam editáveis.
- O limite de usos não pode ficar abaixo do contador de utilizações existente.
- Cupons do vendedor não afetam automaticamente frete, e não anulam as regras financeiras já estabelecidas.
- A comissão segue sendo atribuída conforme o vínculo registrado na compra, sem reescrever pedidos anteriores.

## Verificações neste pacote

Os testes de escopos, regras de cupons, atribuição e personalizados foram executados. A suíte geral do projeto ainda possui testes que falham por arquivos SQL legados ou dependências de desenvolvimento ausentes, como já ocorria nas versões anteriores; a compilação completa e a cobrança real devem ser confirmadas na hospedagem.
