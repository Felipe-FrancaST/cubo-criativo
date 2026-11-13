# Correção: Frete SuperFrete abrindo o Dashboard

## O que foi corrigido

Ao clicar em **Frete SuperFrete**, o menu ativava a seção `shipping`, mas o efeito de autorização em `src/pages/AdminOrdersPage.jsx` não reconhecia essa chave na lista de seções disponíveis e imediatamente alterava a seleção para `dashboard`.

A chave `shipping` foi incluída nas duas listas corretas:

- `knownSections`: permite que a navegação reconheça a seção de frete.
- `businessSections`: mantém a seção restrita a gerentes e administradores com permissão comercial.

A interface que já existia em `src/pages/admin/shipping/AdminShippingSection.jsx` permanece sem alterações. O menu passa a abrir normalmente as abas **Escalas**, **Caixas e pesos** e **Taxas e serviços**.

## Publicação na Vercel

1. Publique o conteúdo completo desta versão, substituindo a anterior.
2. Aguarde o deploy marcar `Ready` na Vercel e verifique se está associado ao domínio de produção.
3. Recarregue a aba do painel administrativo (Ctrl+Shift+R no Windows, Cmd+Shift+R no Mac).
4. Entre em **Administração → Gestão comercial → Frete SuperFrete**.
5. Confira se as três abas aparecem, se as caixas e escalas são carregadas e se o botão **Salvar configurações** responde.

Nenhuma migração SQL adicional é necessária para esta correção. As migrações de frete e escalas já aplicadas continuam válidas. Não altere `SUPERFRETE_TOKEN` ou `SUPERFRETE_USER_AGENT`.

## Validação

- Os testes automatizados de navegação e cálculo de frete executados localmente passaram.
- Adicionamos um teste de interface em `test/admin-ui.test.js` para validar a entrada e as três abas quando as dependências React e jsdom estiverem instaladas.
- A suíte completa executou 135 testes: 126 passaram e 9 falharam por dependências ausentes (`jsdom`) e testes/arquivos antigos já indisponíveis no projeto de origem. Por isso, a compilação integral deve ser conferida na Vercel após o deploy.
