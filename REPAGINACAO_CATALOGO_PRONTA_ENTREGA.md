# Cubo Criativo — nova vitrine do catálogo e pronta entrega

## O que mudou

- Catálogo e Pronta entrega passaram a usar o mesmo padrão de vitrine, com cabeçalho discreto em azul-petróleo, busca simples, contagem de itens e cartões organizados.
- No celular, a grade mostra duas peças por linha em telas a partir de 360 px e uma por linha em telas muito estreitas (até 359 px), evitando cartões apertados.
- Os cartões exibem uma área de imagem quadrada, nome limitado a duas linhas, tipo da peça, preço e ações sempre alinhadas. Há espaço para preços maiores e nomes extensos.
- A busca é mais compacta, e os filtros por tipo ficam acessíveis em uma faixa horizontal. Temas adicionais aparecem na janela de filtros.
- Estados de carregamento, busca vazia e erro foram visualmente unificados.
- As melhorias visuais estão no CSS exclusivo `src/styles/storefront.css`, evitando mudanças acidentais na home, promoções e checkout.

## Arquivos relevantes

- `src/pages/CatalogPage.jsx`
- `src/pages/StockPage.jsx`
- `src/components/StorefrontSearch.jsx` (novo)
- `src/components/StorefrontProductGrid.jsx` (novo)
- `src/components/ProductCard.jsx` (classe e etiqueta de contexto apenas nas páginas da vitrine)
- `src/styles/storefront.css` (novo)
- `src/main.jsx` (importação do estilo)
- `test/storefront-responsive.test.js` (novo)

## Preservado

- Rotas e URLs, incluindo filtros e busca na URL e links diretos da pronta entrega.
- A escolha obrigatória da escala, preços por variante, compra imediata e adicionar ao carrinho.
- Favoritos, promoções, descrição e galeria dos produtos.
- Cadastro, autenticação, meios de pagamento, cupons e demais áreas do site.

## Instalação

1. Faça backup dos arquivos publicados.
2. Publique o conteúdo completo deste ZIP como nova versão do site.
3. Garanta que a nova folha `src/styles/storefront.css` esteja incluída na compilação.
4. Não é necessário executar SQL: são alterações apenas de interface.
5. Verifique no navegador (inclusive em dispositivo físico) ` /catalogo ` e ` /estoque `, com busca, filtros, galeria, escalas, carrinho e compra imediata.

## Validação feita

- Verificação de layout com navegador Chromium em larguras 320, 360, 375, 390, 414, 768, 1024 e 1440 px, utilizando cartões de teste representativos. Nessas larguras, não houve rolagem horizontal e os botões permaneceram dentro dos cartões.
- Verificação de sintaxe JSX/JS dos arquivos alterados.
- Testes automatizados específicos de vitrine, navegação, preços e escala.
- Compilação integral com Vite não realizada neste ambiente: a instalação das dependências npm não terminou. Necessário executar `npm ci && npm run build` no ambiente de publicação.

> Os testes visuais com dados de demonstração validam medidas e organização do layout, não equivalem a teste real com o catálogo e dados de produção da loja.
