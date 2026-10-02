# Cubo Criativo — revisão de código e interface

Revisão de 2 de outubro de 2026, feita sobre o projeto enviado em ZIP.
As alterações estão no código deste pacote. A versão publicada do site e o banco de dados não foram alterados.

## O que mudou

### Loja e navegação

- Cabeçalho fixo, navegação comercial mais direta e controles maiores no celular.
- Página inicial com hierarquia de títulos e ações mais clara.
- Cards com proporções consistentes, melhor alinhamento e duas colunas no celular.
- Tipografia mais legível nos controles; fonte decorativa concentrada nos títulos.
- Cores, espaçamentos, estados de foco e transições mais consistentes.
- Respeito à preferência do visitante por movimento reduzido e atalho para o conteúdo.
- Mensagem de indisponibilidade quando falta a configuração pública do Supabase, em vez de uma falha na inicialização.

### Painel administrativo

- Navegação agrupada por operação, gestão comercial e comunidade.
- Cabeçalho com busca, atualização e ação principal de novo pedido.
- Seção selecionada preservada durante a sessão.
- Lista de pedidos em cards no celular e tabela no computador.
- Estados de carregamento e ausência de resultados mais claros.
- Seções carregadas sob demanda, reduzindo o código necessário na abertura.
- Modais com rolagem interna, controle de foco e fechamento por Escape.
- Modais aninhados mantêm a rolagem bloqueada e fecham apenas a janela superior.

### Criação de pedidos

O formulário foi separado em três etapas: **cliente e endereço → itens → revisão e pagamento**.

- Seleção de cliente existente para gerentes e proprietários.
- Validação de CPF, e-mail, CEP, estado, endereço e quantidades antes do envio.
- Busca de clientes com intervalo entre consultas para reduzir requisições durante a digitação.
- Produtos cadastrados, escala, itens personalizados, frete e assinatura VIP.
- Preços promocionais por escala calculados pela mesma função no navegador e na API.
- Total calculado em centavos, evitando diferenças de arredondamento entre os itens.
- Revisão do cliente, endereço, itens e valores antes de gerar o link ou lançar como pago.
- Bloqueio de cliques repetidos durante o envio do formulário.
- Feedback após cópia do link e upload 3D reaproveitado quando há uma nova tentativa.
- A senha de uma conta já existente deixa de ser redefinida ao criar outro pedido.
- Operadores não consultam as áreas de clientes e controle VIP reservadas à gerência.

### Controle VIP e lançamentos

- Abas separadas para ciclos e assinantes, biblioteca e votações.
- Biblioteca pesquisável por nome, tipo e ciclo.
- Seleção do mês com campo próprio para mês/ano.
- Novos ciclos e duplicações começam sem ativação automática.
- Duplicar um ciclo cria novos registros das miniaturas; o ciclo de origem é preservado.
- A API impede duplicação sobre um mês que já contém miniaturas.
- Validação do mês e da seleção antes de salvar.
- Correção do cálculo do próximo mês em datas como o dia 31.
- Indicadores financeiros identificam o período filtrado.
- Exportação identificada como dados da página atual, com CSV adequado a valores e textos do Excel em português.

## Erros e problemas corrigidos

| Problema encontrado | Correção aplicada |
| --- | --- |
| Hooks executados apenas quando os detalhes do pedido estavam abertos | Hooks ficam em ordem estável ao abrir e fechar o modal |
| Estado `busy` inexistente na atualização de status | Estado local de envio e recuperação após erro |
| Formulário de status fechado mesmo quando a API falhava | Continua aberto para correção ou nova tentativa |
| Preço do pedido manual sem o desconto proporcional da escala | Função compartilhada com cálculo em centavos |
| Duplicação VIP transferindo registros entre ciclos | Cópia dos registros com novos identificadores |
| Respostas antigas substituindo consultas mais recentes de pedidos/clientes | Cancelamento e descarte de respostas antigas |
| Biblioteca 3D incluída entre as dependências de abertura | React separado da biblioteca 3D e visualizador carregado sob demanda |
| Colunas de texto quebrando a exportação ou interpretadas como fórmulas | Escape de CSV, proteção de fórmulas e codificação UTF-8 com BOM |
| Scripts SQL referenciados pelos testes ausentes no pacote original | Scripts de níveis administrativos e avaliações incluídos |

## Validação realizada

- `npm run check`: **53 testes aprovados**, sem falhas.
- ESLint: **0 erros e 98 avisos**, contra 1.238 avisos na versão recebida.
- Testes de interface com DOM simulado: validação do cliente, revisão por escala, envio único, reabertura dos detalhes, recuperação após erro de status, modais aninhados, duplicação VIP, permissões e navegação por teclado.
- `npm run build`: compilação de produção concluída.
- Dependência 3D removida dos preloads do HTML inicial; o arquivo 3D de aproximadamente 910 kB permanece disponível para o visualizador.

Os avisos restantes incluem dependências de efeitos e variáveis não utilizadas em partes legadas. O build também sinaliza o tamanho do arquivo 3D, que agora é carregado quando necessário.

O ambiente de revisão não disponibilizou credenciais de Supabase, Mercado Pago ou Resend. Por isso, a pré-renderização dos produtos foi ignorada no build local, e as integrações foram simuladas nos testes. A prévia no navegador foi bloqueada pelo ambiente; não foi possível certificar visualmente todos os tamanhos de tela.

## Como aplicar

1. Extraia a pasta `cubo` do ZIP e aplique os arquivos ao seu projeto, mantendo suas variáveis de ambiente.
2. Use **Node.js 24.x**, conforme a configuração existente do projeto.
3. Execute os comandos abaixo na pasta do projeto.

```bash
npm ci
npm run check
npm run build
```

4. Confira as variáveis existentes do Supabase, Mercado Pago e Resend no ambiente de hospedagem. O arquivo `.env.example` continua sendo a referência.
5. Faça uma publicação de prévia no fluxo já utilizado pelo projeto e confira a lista abaixo antes de disponibilizar a atualização aos clientes.

### Conferência no ambiente integrado

- Home, catálogo e admin em celular e computador: alinhamento, imagens, menus e rolagem.
- Pedido novo e pedido para cliente existente: dados, escala, frete, total e vínculo à conta correta.
- Link de pagamento e lançamento como pago, usando as credenciais de teste da integração.
- Recuperação após falha de API e upload 3D quando esse recurso for usado.
- E-mails e webhooks de pagamento.
- Ciclo VIP duplicado: origem preservada, cópias no mês escolhido e ativação somente após a ação desejada.
- Permissões dos níveis operador, gerente e proprietário.

### Scripts SQL

`SQL_NIVEIS_ADMIN.sql` e `SQL_AVALIACOES.sql` são complementos para estruturas que faltavam no pacote. **Não são necessários para aplicar o novo layout.** Compare-os com o schema real antes de executar qualquer migração. O script de avaliações pressupõe `public.orders` e a configuração dos níveis administrativos. Nenhum SQL foi executado nesta revisão.

A criação de pedidos e as operações VIP continuam usando várias gravações e serviços externos, sem uma transação única. O bloqueio de envio duplo protege o formulário durante a requisição, mas não substitui uma chave de idempotência persistida no servidor. A integração real deve ser conferida antes da publicação.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Visual da loja | `src/index.css`, `src/components/SiteHeader.jsx`, `src/components/ProductCard.jsx`, `src/pages/HomePage.jsx` |
| Visual e navegação do admin | `src/pages/AdminOrdersPage.jsx`, `src/pages/admin/admin.css` e seções em `src/pages/admin/` |
| Novo pedido | `src/pages/admin/orders/NewManualOrderModal.jsx`, `shared/manualOrder.js`, `api/admin.js`, `server/manualOrder.js` |
| VIP | `src/pages/admin/vip/AdminVipSection.jsx`, `src/pages/AdminOrdersPage.jsx`, `api/admin.js` |
| Modais e teclado | `src/components/Modal.jsx`, `src/lib/useDialog.js`, `src/lib/a11y.js` |
| Desempenho | `vite.config.js` e imports sob demanda no admin |
| Regressões | `test/admin-ui.test.js`, `test/manual-orders.test.js`, `test/navigation.test.js` |
