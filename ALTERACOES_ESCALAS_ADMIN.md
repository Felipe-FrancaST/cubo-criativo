# Ajustes no painel administrativo

## Menu lateral

- O cartão `Conta admin` agora fica dentro do mesmo contêiner `sticky` do menu.
- Menu e conta acompanham a rolagem como um único bloco.
- O bloco recebe limite de altura e rolagem interna apenas quando a tela é baixa demais para mostrar tudo.

## Escalas e preços de produtos

A seção Produtos agora permite:

- adicionar até 20 escalas/opções por produto;
- informar o nome da escala, por exemplo `28 mm`, `32 mm` ou `1/10`;
- definir um valor normal diferente para cada escala;
- escolher qual escala será a padrão;
- editar e remover escalas já cadastradas;
- carregar automaticamente as escalas existentes ao editar um produto.

Os dados são gravados nas colunas já existentes:

- `products.variants` — lista JSON com `label` e `price_cents`;
- `products.default_variant` — nome da escala padrão.

Quando o produto está em promoção, o valor promocional informado corresponde à escala padrão. O site aplica o mesmo percentual de desconto às outras escalas, preservando o funcionamento atual da loja.
