# Cubo Criativo — VIP, Cubo Game e experiência móvel

Atualização de 2 de outubro de 2026. Este pacote inclui as melhorias anteriores de loja e administração descritas em `MELHORIAS.md`, além das alterações abaixo. As mudanças foram aplicadas ao código enviado; não houve publicação nem alteração no banco de produção.

## Área VIP do cliente

- Cabeçalho com plano, ciclo e situação da assinatura, com menos elementos repetidos.
- Uma única navegação por abas, compacta no celular e acessível por teclado.
- Busca de miniaturas que reconhece nomes com ou sem acentos; filtros por tipo e pelas próprias escolhas.
- Cards em duas colunas no celular, nomes legíveis e ações maiores.
- Resumo das escolhas em uma barra inferior, com contagens do plano e ação de salvar ou editar.
- Bloqueio de toques que excedem os limites e de envios repetidos durante o salvamento.
- Seleção atual em uma seção expansível, permitindo consultar as peças sem percorrer o catálogo.
- Galeria com imagem ampliada, miniaturas, botões, setas do teclado e gesto horizontal de toque.
- Descarte de respostas antigas no carregamento da área VIP, votação e detalhes da galeria.
- Presente d20 carregado somente ao abrir sua aba. Renderização 3D com resolução menor no celular e sem animação contínua em repouso; respeito à preferência por movimento reduzido.
- Alternativa visual caso a prévia 3D falhe, mantendo o resumo e as ações do presente disponíveis.
- Indicação de envio e bloqueio de solicitações repetidas ao rolar o d20 ou solicitar o prêmio; nova tentativa após falha de conexão.

## Cubo Game

- Tabuleiro em destaque, com quatro cartas por linha e controles adequados ao toque.
- Início explícito da partida; o tempo começa ao virar a primeira carta.
- Indicadores de pares, erros, tentativas e tempo, com progresso da partida.
- Instruções expansíveis e recompensas abaixo do tabuleiro no celular.
- Correção da lógica de cartas: ignora carta repetida e terceiro toque enquanto resolve um par; acertos permanecem revelados.
- Resultado enviado uma única vez por rodada na interface. Em caso de falha, o resultado permanece disponível para reenvio.
- Cupom com ação de copiar e feedback sobre sucesso ou falha.
- Contador da próxima rodada alinhado ao período UTC utilizado pela API: diário para VIP e semanal para as demais contas.

As regras existentes de pontuação, cupons e autorização da API foram mantidas. O bloqueio no navegador protege a interação durante o envio; as regras de concessão continuam no servidor.

## Responsividade geral

- Grades e cards de produtos padronizados em duas colunas no celular, com ações empilhadas.
- Cards de promoção com preço e informação de pagamento reorganizados para telas estreitas.
- Menu e carrinho adaptados à altura disponível da tela e às áreas seguras do aparelho.
- Carrinho com uma única área rolável para itens, cupom, resumo e checkout.
- Controles de quantidade e remoção com rótulos acessíveis e área maior para toque.
- Página ativa indicada no menu; controle de foco e Escape nos painéis.
- Filtros do catálogo com altura limitada, rolagem e fechamento por teclado.
- Modais em formato de painel inferior ou tela completa, conforme o formulário.
- Painéis acompanham o teclado virtual quando o navegador oferece `visualViewport`; o zoom permanece permitido.
- Formulários com texto de pelo menos 16 px no celular, reduzindo o zoom automático ao focar campos no iOS.
- Altura real do cabeçalho usada para posicionar a navegação VIP.
- Página de produto com imagem e ações ajustadas; formulários de conta e novo pedido acomodam a tela disponível.
- Redução de movimentos de hover em dispositivos de toque e respeito a movimento reduzido.

## Verificação realizada

- `npm run check`: **69 testes aprovados**, sem falhas; ESLint com **0 erros e 57 avisos** em trechos legados.
- `npm run build`: compilação de produção concluída.
- 16 novos testes cobrem regras do jogo, períodos UTC, limites VIP, salvamento único, filtros, abas, galeria, recuperação após falha, carrinho, menu, teclado virtual e cópia de cupom.
- Fluxos de interface verificados em DOM simulado, com respostas de API simuladas. Os testes anteriores de administração, pedidos e regras compartilhadas também passaram.
- O componente d20 está separado do carregamento inicial da área VIP. O bundle 3D continua sendo o maior arquivo e gera um aviso de tamanho no build.

A prévia no navegador foi bloqueada pelo ambiente de revisão. Por isso, a conferência visual em aparelhos reais ainda está pendente. Não foram disponibilizadas credenciais de Supabase, Mercado Pago ou Resend; pagamentos, dados de produção e e-mails precisam ser conferidos no ambiente integrado. A pré-renderização de produtos foi ignorada neste build local por falta das variáveis públicas do Supabase.

## Aplicação

Extraia a pasta `cubo` e aplique os arquivos ao projeto, mantendo as variáveis do ambiente de hospedagem. Use Node.js 24 e execute:

```bash
npm ci
npm run check
npm run build
```

Esta atualização não exige uma nova migração SQL. As orientações sobre os scripts incluídos na revisão anterior permanecem em `MELHORIAS.md`.

Antes da publicação, confira uma prévia em larguras de 320, 360, 390, 430, 768 e 1024 px, além do desktop. Verifique retrato e paisagem, teclado aberto, modais, pesquisa, seleção e edição VIP, partida completa, cupom e checkout de teste. Esses são cenários de conferência pendentes, não uma lista de aparelhos já testados.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| VIP do cliente | `src/components/VipAreaModal.jsx`, `src/components/vip-area/`, `src/styles/customer.css` |
| Presente d20 | `src/components/VipPresentD20.jsx`, `src/components/vip-area/DicePreviewBoundary.jsx`, `src/lib/useMediaQuery.js` |
| Cubo Game | `src/pages/CupomGamePage.jsx`, `src/lib/memoryGame.js` |
| Responsividade | `src/styles/mobile.css`, `src/lib/useMobileViewport.js`, `src/components/SiteHeader.jsx`, `index.html` |
| Carrinho e menu | `src/components/CartDrawer.jsx`, `src/components/MenuDrawer.jsx` |
| Catálogo e produtos | `src/pages/CatalogPage.jsx`, `src/pages/HomePage.jsx`, `src/pages/StockPage.jsx`, `src/pages/PromocoesPage.jsx`, `src/pages/ProductPage.jsx`, `src/components/ProductCard.jsx`, `src/components/PromoProductCard.jsx` |
| Modais e formulários | `src/components/Modal.jsx`, `src/components/AuthModal.jsx`, `src/components/ProfileSettingsModal.jsx`, `src/pages/SettingsPage.jsx` |
| Regressões | `test/customer-ui.test.js`, `test/memory-game.test.js` |
