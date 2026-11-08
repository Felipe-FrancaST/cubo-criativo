# Melhorias — 08/11/2026

## Galeria VIP
- Navegação entre miniaturas sem fechar a janela, tanto na assinatura quanto na Área VIP.
- Botões Anterior/Próxima e posição da peça na coleção.
- Setas laterais e teclado percorrem as fotos; ao chegar ao limite, avançam para outra peça. A coleção é circular.
- Navegação respeita a lista filtrada da Área VIP e mantém o carregamento de detalhes sob demanda e a proteção contra respostas atrasadas.
- Gesto horizontal com captura de ponteiro; gestos verticais e cancelados não trocam a peça.
- Teclado funciona também com foco no botão Fechar; Escape e retenção de foco continuam disponíveis.
- Fotos reiniciam ao trocar de peça. Lista de fotos ausente ou em formato inválido não quebra a janela.

## Apresentação e responsividade
- Superfícies mais discretas nos cartões de produtos, menos gradientes e sombras.
- Grade adaptável da coleção, duas colunas no celular e uma coluna em telas menores que 360px.
- Galeria dimensionada pela altura da tela, descrição separada e controles de pelo menos 44px.
- Campos de filtro e cabeçalhos mais resistentes a textos extensos; indicação de foco consistente.
- Respeito à preferência de movimento reduzido.
- Ajustes visuais concentrados em src/styles/refinements.css.

## Verificação
- Build de produção concluído.
- ESLint sem erros; 46 avisos já presentes na base.
- Suíte geral: 86 de 88 testes passaram na primeira execução com as melhorias. As duas falhas referem-se a arquivos ausentes no ZIP original: SQL_NIVEIS_ADMIN.sql e SQL_AVALIACOES.sql. Não foram inventadas migrações de banco para contornar os testes.
- Teste adicional de gesto horizontal/vertical/cancelamento incluído e executado com a suíte da interface do cliente.
- O ambiente bloqueou a inicialização do navegador Chromium: não foi possível concluir inspeção visual real de desktop/celular.
- Sem credenciais Supabase, pré-renderização dos produtos foi pulada pelo script existente. Login, pagamentos e dados de produção não foram exercitados contra serviços reais.

## Executar
Use Node 24, rode `npm ci`, configure o `.env` a partir de `.env.example` e execute `npm run dev`. Para gerar a versão de produção, execute `npm run build`.

O arquivo contém o projeto completo e os testes, sem node_modules e sem credenciais. As regras de assinatura e cobrança não foram alteradas. Antes de publicar, confira com sua conta VIP real as fotos, os filtros e os fluxos de pagamento no seu ambiente de homologação.
