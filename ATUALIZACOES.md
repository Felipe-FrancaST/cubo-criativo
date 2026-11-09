# Galeria, retorno e banners — 09/11/2026

- Galeria de produtos: indicadores de 6 px dentro de controles discretos, sem as bolas ampliadas pela regra mobile.
- Botão de informação: círculo de 32 px e ícone de 17 px no celular e no computador.
- Voltar dos detalhes: guarda a URL com filtros, a rolagem e a posição do card. Aguarda a lista reaparecer e interrompe a restauração se o usuário tocar, rolar ou usar o teclado.
- Pesquisa do estoque também é mantida na URL; filtros do catálogo preservam o estado de navegação.
- Nova seção Admin → Banners do site: imagens independentes para celular e computador, prévia, envio, salvar, descartar e restaurar padrão.
- Upload permitido para gerente/proprietário, com autorização verificada no servidor. JPG, PNG e WebP até 8 MB.
- Banners e configuração são gravados no Supabase Storage, no bucket público site-assets, criado automaticamente no primeiro envio/salvamento se necessário. Nenhuma nova tabela SQL é exigida. Um bucket site-assets existente precisa ser público; o código não altera sua visibilidade automaticamente.
- A gravação usa a chave de serviço já configurada no backend. Essa chave não é enviada ao navegador. O navegador recebe somente a autorização temporária de upload para um arquivo específico.
- Imagens carregadas ficam como rascunho até clicar em Salvar banners. Arquivos anteriores não são excluídos automaticamente; descartes podem deixar arquivos sem uso no Storage.
- O banner continua abrindo a área de planos VIP. A nova configuração prevalece sobre a tabela antiga home_banners; se não existir, a Home mantém a fonte antiga e as imagens locais.

## Como usar depois de publicar
1. Entre como gerente ou proprietário e abra Administração → Banners do site.
2. Escolha as imagens. Para computador, use aproximadamente 1200 × 450 px (8:3); para celular, 1280 × 720 px (16:9). Imagens com outra proporção podem sofrer recorte na Home.
3. Confira as prévias e clique em Salvar banners. Abra ou atualize a página inicial para verificar.

## Validação desta entrega
- 17 testes focados de navegação, autorização, validação de upload e interface administrativa passaram.
- Suíte geral: 102 de 104 testes passaram. Os dois erros continuam sendo arquivos SQL ausentes no pacote original (SQL_NIVEIS_ADMIN.sql e SQL_AVALIACOES.sql).
- Build de produção aprovado. Sem credenciais reais, o upload ao Supabase e a exibição em produção precisam ser conferidos após publicar.
- Não foi concluída inspeção visual interativa em navegador neste ambiente; não se deve interpretar os testes automatizados como validação em todos os aparelhos.

# Revisão geral — 09/11/2026

Políticas unificadas, transparência de cancelamento, proteção de métricas, links de condições no checkout e correções de navegação. Consulte REVISAO_SITE_2026-11-09.md para o escopo, validações e limitações.

# WhatsApp — 09/11/2026

- Número atualizado para (77) 99847-2372 nos links, rodapé e dados estruturados do site.
- .env.example atualizado. Se WHATSAPP_NUMBER estiver configurada na hospedagem para os e-mails, ajuste seu valor para 5577998472372.

# Atualização institucional — 09/11/2026

- CNPJ 69.869.629/0001-79 incluído no rodapé, Sobre, Contato, Política de Privacidade e Termos (inclusive páginas HTML independentes).
- Fundadores: mantidos somente Felipe França Alves e Adriele Lira de Jesus.
- CNPJ centralizado em src/data/config.js para as telas React.
- Configurações do Mercado Pago e variáveis de ambiente não foram alteradas. O token da conta PJ continua configurado na hospedagem.
- Build de produção verificado; o ZIP contém os fontes para publicação, sem credenciais.

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
