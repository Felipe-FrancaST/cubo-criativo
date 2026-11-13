# Cubo Criativo — Menu de conta simplificado

## Alterações

- Removidos os dois atalhos duplicados **Perfil** e **Ajustes** que apareciam lado a lado no menu do usuário autenticado.
- Mantido o item único **Configurações**, com destaque quando a página de configurações (ou seu endereço legado `/perfil`) está aberta.
- Conferido que a página **Configurações da conta** já oferece: **Dados e entrega**, **Segurança**, **Favoritos**, **Cupons** e **Avaliações**. Essas funções não foram removidas e não foi necessário criar campos adicionais.
- Mantidos **Minha conta**, **Meus pedidos**, **Minha área de vendedor** (para vendedores), **Admin — Painel** (para administradores) e **Sair**.
- Compatibilidade de navegação com `/configuracoes` e `/perfil` preservada, inclusive quando a compra exige completar cadastro.

## Publicação

1. Publique o projeto completo atualizado na Vercel.
2. Abra o site com uma conta autenticada, acesse o menu e confira que apenas **Configurações** aparece no lugar de **Perfil** e **Ajustes**.
3. Em **Configurações**, confira os cinco separadores existentes.
4. Teste o preenchimento de cadastro a partir de um checkout e o acesso ao painel do vendedor com uma conta autorizada.

**Banco de dados:** nenhuma migração SQL necessária.

## Verificações realizadas

- 3 testes específicos novos passaram (`test/account-settings-menu.test.mjs`).
- Na suíte geral `node --test`, 145 de 154 testes passaram; 9 falharam sobretudo por dependências npm ausentes ou por arquivos já indisponíveis no pacote de origem.
- O build completo deve ser verificado no pipeline da Vercel após instalar as dependências.
