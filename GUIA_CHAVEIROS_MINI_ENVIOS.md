# Chaveiros e frete Mini Envios — Cubo Criativo

## O que mudou

- Categoria **Chaveiros** em Administração → Produtos e filtro no Catálogo.
- Chaveiros sem variante podem ser cadastrados com um preço único. Caso o produto possua variantes próprias, o preço continua sendo calculado normalmente conforme a opção escolhida.
- Pedidos exclusivos de chaveiros: Mini Envios (serviço 17), cotação real via SuperFrete. Cada volume aceita **até 20 chaveiros** e utiliza caixa padrão **24 × 16 × 4 cm e até 300 g** (incluindo a proteção).
- Exemplos: 1–20 = 1 caixa; 21–40 = 2 caixas; 41–60 = 3 caixas.
- O cálculo soma os preços reais cotados para todos os volumes e cobra a taxa fixa de miniaturas **uma única vez por pedido** (inicialmente R$ 5; ajustável em Administração → Frete SuperFrete).
- Se o pedido contiver chaveiros e outros produtos, o checkout oferece apenas serviços compatíveis com todas as caixas. A modalidade Mini Envios pode não aparecer nesses casos.
- Se Mini Envios não estiver disponível no CEP do cliente, não exibe um preço inventado: cliente deverá escolher outra composição de carrinho ou consultar a loja.

## Ativação

1. Publique o site completo atualizado na Vercel.
2. Confira em **Administração → Frete SuperFrete → Caixas e pesos** a caixa **Chaveiros — Mini Envios**.
3. Em **Taxas e serviços**, confirme que **Mini Envios** está marcado.
4. Em **Administração → Produtos**, cadastre um produto na categoria **Chaveiros**, e confira o filtro no catálogo.
5. Teste 1, 20 e 21 unidades, e depois um carrinho misto com outra categoria.

**Sem migração SQL adicional**: a categoria já usa o campo textual existente na tabela de produtos e a nova embalagem é incluída nos valores padrão do servidor, sendo editável na administração.

## Cuidados operacionais

- **20 unidades por caixa é uma capacidade informada pela loja**, não uma garantia física da transportadora. Antes de postar, confirme se os chaveiros + material de proteção realmente cabem em 24 × 16 × 4 cm e pesam até 300 g. Se ultrapassarem esses limites, reduza a quantidade física por volume e ajuste a regra no código antes de vender.
- Mini Envios também tem limites para valor segurado, rota e serviços habilitados na conta SuperFrete; conforme o pedido, pode não aparecer na API.
- A cotação não compra nem imprime etiquetas automaticamente: em pedidos multivolume, gere uma etiqueta válida para cada caixa na SuperFrete.
- O front e o servidor nunca podem garantir uma cotação sem resposta da API SuperFrete. O servidor recalcula o preço no momento do pagamento.
