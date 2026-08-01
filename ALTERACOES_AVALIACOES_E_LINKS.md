# Links de e-mail e avaliações — Cubo Criativo

## Instalação obrigatória

Antes de publicar a funcionalidade, execute `SQL_AVALIACOES.sql` no **Supabase → SQL Editor**.

O SQL:

- cria ou atualiza `public.customer_reviews`;
- permite uma avaliação por pedido;
- aceita avaliações apenas do usuário responsável por um pedido marcado como `entregue`;
- impede que o cliente aprove ou destaque a própria avaliação;
- cria a visão pública `public.customer_reviews_public`, que exibe somente avaliações aprovadas;
- adiciona políticas administrativas para aprovar, ocultar, destacar e excluir;
- preserva avaliações existentes sempre que a estrutura já estiver criada.

## Rotas adicionadas

- `/meus-pedidos?pedido=ID`: abre a área de pedidos, expande e posiciona o pedido indicado.
- `/avaliar-pedido?pedido=ID`: abre a avaliação verificada daquele pedido.
- `/avaliacoes`: página pública com todas as avaliações aprovadas.

As duas primeiras rotas recebem `noindex`, pois são áreas privadas.

## Links dos e-mails

- Confirmação, produção, previsão, cancelamento e reembolso de pedidos comuns levam ao pedido específico.
- Rastreio leva primeiro à transportadora e oferece um botão secundário para o pedido específico.
- Entrega leva à avaliação específica e oferece acesso ao pedido.
- Mensagens VIP levam à Área VIP durante o ciclo.
- Entrega VIP leva à avaliação específica daquele envio.
- Lembretes Pix e pedidos manuais levam ao pedido correto.

## Área do cliente

A avaliação só é liberada quando:

1. o cliente está autenticado com a conta da compra;
2. o pedido pertence ao cliente;
3. o status de produção é `entregue`.

O cliente informa de 1 a 5 estrelas e um comentário entre 8 e 500 caracteres. Ao enviar ou editar, a avaliação volta para análise administrativa.

O nome público é reduzido para primeiro nome e inicial do último sobrenome. E-mails nunca são apresentados publicamente.

## Exibição pública

Avaliações aprovadas aparecem:

- na página inicial;
- em `/avaliacoes`;
- na página individual dos produtos associados.

Avaliações destacadas aparecem primeiro. Produtos vinculados podem abrir suas respectivas páginas.

## Painel administrativo

Nova seção **Avaliações** no painel com:

- contadores de total, pendentes, publicadas e destacadas;
- pesquisa por cliente, pedido, produto ou comentário;
- filtros de pendentes, publicadas e destaques;
- aprovação e publicação;
- ocultação imediata do site;
- destaque ou remoção de destaque;
- exclusão permanente.

## Validação realizada

- 29 testes automatizados aprovados;
- 98 arquivos JavaScript/JSX/MJS verificados sintaticamente;
- `vercel.json` e demais JSONs validados;
- teste de links exatos para pedido, avaliação e Área VIP;
- teste das regras de segurança e publicação das avaliações.

O build Vite completo exige instalar as dependências (`npm install`). Ele não foi executado no ambiente de edição porque o projeto recebido não continha `node_modules`.
