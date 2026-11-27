# Produtos — galeria, categorias e modalidade de venda

## Instalação

1. Faça um backup do banco (especialmente `products.stock`), pois o estoque numérico dos produtos de catálogo será removido.
2. No SQL Editor da Supabase, execute `supabase/migrations/20261126_catalogo_estoque.sql`. A migração preserva os estoques numéricos de pronta entrega e define zero para pronta entrega sem quantidade. Ela permite estoque nulo para catálogo e valida o estoque de pronta entrega. Não foi executada no banco de produção.
3. Publique o projeto atualizado na Vercel.

## Administração

- Em Produtos, arraste pelo ícone de mover para alterar a ordem das imagens. As setas também permitem ordenar no celular ou com teclado. A primeira imagem é a capa. Salve o produto para confirmar. Imagens já cadastradas e novas podem ser intercaladas.
- Os filtros de categoria e situação podem ser combinados com a busca.
- Catálogo: sob encomenda, sem controle de estoque. Pronta entrega: exige quantidade inteira a partir de zero. Zero significa esgotado. Alterar para catálogo remove o estoque ao salvar.
- A visibilidade (publicação/rascunho) continua independente e pode ser alterada na lista de produtos.
- Brincos: nova categoria no cadastro e filtro público do catálogo. Usa a mesma configuração `keychain_mini` dos chaveiros. Pedidos exclusivos de brincos/chaveiros usam Mini Envios, com até 20 unidades somadas por caixa e até 300 g por pacote. Acima disso, divide em caixas adicionais. O peso real embalado deve respeitar esse limite. O acréscimo existente permanece por pedido.

## Validação local

44 testes direcionados passaram, incluindo 6 novos testes. Suíte completa: 183 aprovados, 9 falhas idênticas às da versão base (dependências ausentes e arquivos SQL históricos ausentes). Sintaxe dos arquivos alterados conferida. Build, interação no navegador e migração em produção não foram validados neste ambiente.
