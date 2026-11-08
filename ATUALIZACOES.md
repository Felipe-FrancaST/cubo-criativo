# Melhorias — 08/11/2026

## Galeria VIP
- Navegação entre miniaturas sem fechar a janela, tanto na assinatura quanto na Área VIP.
- Apenas setas laterais para navegação visual, com contador de foto e peça sobre a imagem. Não há botões ou faixa de miniaturas abaixo.
- Setas laterais e teclado percorrem as fotos; ao chegar ao limite, avançam para outra peça. A coleção é circular.
- Navegação respeita a lista filtrada da Área VIP e mantém o carregamento de detalhes sob demanda e a proteção contra respostas atrasadas.
- Gesto horizontal com captura de ponteiro; gestos verticais e cancelados não trocam a peça.
- Teclado funciona também com foco no botão Fechar; Escape e retenção de foco continuam disponíveis.
- Fotos reiniciam ao trocar de peça. Lista de fotos ausente ou em formato inválido não quebra a janela; valores que não sejam URLs em texto são ignorados.
- Setas SVG locais não dependem do carregamento da fonte de ícones.
- Detalhes sem fotos adicionais também são reutilizados ao reabrir uma peça, evitando requisições repetidas. Falhas de consulta continuam permitindo uma nova tentativa.

## Apresentação e responsividade
- Superfícies mais discretas nos cartões de produtos, menos gradientes e sombras.
- Grade adaptável da coleção, duas colunas no celular e uma coluna em telas menores que 360px.
- Galeria dimensionada pela altura da tela, descrição separada e controles de pelo menos 44px.
- Campos de filtro e cabeçalhos mais resistentes a textos extensos; indicação de foco consistente.
- Respeito à preferência de movimento reduzido.
- Ajustes visuais concentrados em src/styles/refinements.css.

## Sitemap
- Conferidas as 13 páginas públicas, os caminhos canônicos, robots.txt e o redirecionamento de /sitemap.xml para o endpoint dinâmico. Não foi necessário adicionar novas páginas públicas.
- Consulta de produtos ativos paginada por ID, evitando corte pelo limite de linhas do banco, inclusive quando configurado abaixo de 500.
- Compatibilidade sem updated_at aplicada somente ao erro de coluna ausente. Erros de permissão ou de conexão não provocam uma segunda consulta desnecessária.
- Resposta institucional de contingência usa no-store, evitando manter por um dia um sitemap incompleto após falhas temporárias.
- XML estático gerado pela mesma função do endpoint. O build o sincroniza automaticamente; também é possível executar npm run sitemap:generate.
- Mantidas as datas reais de atualização dos produtos e a exclusão de páginas privadas.

## Verificação
- Build de produção concluído.
- ESLint sem erros; permanecem 46 avisos da base.
- Suíte geral executada: 90 de 92 testes passaram. As duas falhas referem-se aos arquivos ausentes no ZIP original: SQL_NIVEIS_ADMIN.sql e SQL_AVALIACOES.sql.
- Depois de acrescentar o teste de reutilização dos detalhes, os 18 testes focados de interface do cliente e sitemap passaram. Cobrem navegação apenas por setas, teclado, gestos, ausência de fotos, consulta reutilizada, XML sincronizado, 1.201 produtos, limite de resposta menor e compatibilidade de coluna.
- A inspeção visual real no navegador não foi concluída: o ambiente bloqueou a inicialização do Chromium na primeira revisão.
- Sem credenciais Supabase, a pré-renderização dos produtos foi pulada pelo script existente. Login, pagamentos, indexação pública e dados reais não foram exercitados contra serviços de produção.

## Executar
Use Node 24, rode `npm ci`, configure o `.env` a partir de `.env.example` e execute `npm run dev`. Para gerar a versão de produção, execute `npm run build`.

O arquivo contém o projeto completo e os testes, sem node_modules e sem credenciais. As regras de assinatura e cobrança não foram alteradas. Antes de publicar, confira com sua conta VIP real as fotos, os filtros e os fluxos de pagamento no seu ambiente de homologação.
