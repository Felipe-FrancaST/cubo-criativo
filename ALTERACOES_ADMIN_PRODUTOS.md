# Cadastro de produtos pelo painel administrativo

## O que foi adicionado

A área `/admin` agora possui a seção **Produtos**, disponível no menu lateral do computador e nas abas roláveis do celular.

O formulário permite:

- enviar uma imagem JPG, PNG, WEBP ou AVIF de até 10 MB;
- informar nome e descrição;
- gerar automaticamente uma URL/slug editável;
- informar valor normal;
- ativar promoção e informar valor promocional;
- marcar o produto como destaque;
- publicar imediatamente ou salvar como rascunho;
- marcar como pronta entrega;
- definir estoque, categoria, tags e ordem de exibição;
- editar produtos existentes;
- publicar ou ocultar rapidamente um produto;
- abrir a página individual do produto diretamente pelo painel.

## Como os preços são gravados

A estrutura já usada pelo site foi preservada:

- sem promoção: `price_cents` e `original_price_cents` recebem o valor normal;
- com promoção: `price_cents` recebe o preço promocional e `original_price_cents` recebe o preço normal;
- `promo` determina se o site deve exibir o valor normal riscado.

## Página e sitemap

Ao cadastrar um produto, o painel gera um `slug` único e grava o registro na tabela `products`. A página passa a funcionar imediatamente em:

`https://www.cubocriativo3d.com.br/p/slug-do-produto`

O sitemap dinâmico já existente consulta a mesma tabela, portanto produtos ativos também passam a entrar automaticamente em `/sitemap.xml`.

A pré-renderização estática de SEO continuará sendo atualizada nos próximos deploys, como já acontecia no projeto.

## SQL obrigatório antes de usar o upload

A tabela `products` já possui políticas de administrador. Entretanto, o diagnóstico mostrou que o bucket `product-images` não possuía políticas de gravação para o painel.

Execute no Supabase o arquivo:

`SQL_ADMIN_PRODUTOS.sql`

Caminho alternativo dentro do projeto:

`supabase/sql/admin_product_images_policies.sql`

O SQL permite inserir, atualizar e excluir arquivos do bucket **somente** para usuários autenticados que estejam registrados na tabela `public.admins`.

## Arquivos principais alterados

- `src/App.jsx`
- `src/pages/AdminOrdersPage.jsx`
- `src/pages/admin/products/AdminProductsSection.jsx`
- `src/pages/admin/products/adminProductUtils.js`
- `test/admin-products.test.js`
- `SQL_ADMIN_PRODUTOS.sql`
