# Cubo Criativo — repaginação visual das páginas institucionais (13/11/2026)

## Base utilizada
Partimos da versão `cubo-criativo-catalogo-pronta-entrega-mobile-repaginados.zip`, preservando catálogo, estoque, miniaturas personalizadas, escala obrigatória, checkout, área do vendedor, administração e backend.

## Áreas atualizadas
- **Página inicial:** apresentação mais limpa, chamadas para catálogo e estoque, carrossel de promoções, atalhos, vitrines reutilizando o padrão de produtos do catálogo, banner VIP administrável, destaque de personalização, avaliações verificadas e ajuda.
- **Promoções:** cabeçalho consistente com a vitrine, grade responsiva idêntica ao catálogo e estados de carregamento/vazio/erro. Mantém descontos e seleção de escala no `ProductCard`.
- **Cubo Game:** modernização de superfícies, tabuleiro, métricas e recompensa. A lógica do jogo, limite de erros, autenticação, status remoto e registro de cupons **não foi alterada**.
- **Avaliações:** resumo de nota média, distribuição por estrelas, filtros e cartões padronizados. Mantém apenas avaliações publicadas/aprovadas e links para os produtos.
- **Avaliação de pedidos:** ajustes cosméticos no formulário existente, sem modificar quem pode avaliar nem as regras de aprovação.
- **FAQ:** perguntas agrupadas por categoria, campo de busca, acordeão acessível e bloco de ajuda. Respostas anteriores preservadas.

## Arquivos principais
`src/styles/editorial.css` (novo, isolado por páginas), `src/components/HomeShelf.jsx` (novo), `src/components/ReviewCard.jsx` (novo), `src/pages/HomePage.jsx`, `src/pages/PromocoesPage.jsx`, `src/pages/CupomGamePage.jsx`, `src/pages/ReviewsPage.jsx`, `src/pages/ReviewPage.jsx`, `src/pages/FAQPage.jsx`, `src/main.jsx` e pequenos ajustes no carrossel, cartão de promoção e roteamento.

## Publicação
1. Faça backup da versão em produção.
2. Publique os arquivos deste projeto completo, mantendo as variáveis de ambiente e serviços existentes.
3. Teste na hospedagem a navegação, a seleção de escala, a compra de ofertas, a autenticação e recompensa do Cubo Game, carregamento das avaliações e o FAQ.
4. Se houver cache/CDN, publique com novo build para garantir o CSS atualizado.

**SQL:** nenhuma migração nova é necessária para esta alteração visual.

## Validação realizada neste ambiente
- Parsing de JSX via TypeScript para arquivos React alterados.
- 25 testes direcionados de vitrine, escala, Cubo Game e novas páginas: todos aprovados.
- Verificação visual **com conteúdo representativo** no Chromium headless em 320, 360, 390, 414, 768, 1024 e 1440 px. Não ocorreu rolagem horizontal global nas páginas verificadas. Chips de FAQ/avaliações têm rolagem horizontal **intencional** no celular.
- A compilação integral do projeto e os fluxos reais conectados ao Supabase/Mercado Pago precisam ser testados no ambiente de publicação: as dependências npm completas não estão disponíveis neste ambiente.
