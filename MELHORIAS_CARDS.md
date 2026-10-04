# Cubo Criativo — cards de produtos

Atualização de 4 de outubro de 2026. Este pacote contém o projeto completo e mantém as revisões anteriores de administração, configurações, planos VIP, Área VIP e Cubo Game.

## Nova apresentação

- O card mostra imagem, nome, preço e uma linha com ícone de carrinho e Comprar.
- O seletor de escala e os textos extras foram retirados do corpo do card.
- A imagem ocupa uma área quadrada e recebe menos margem interna: no celular, o preenchimento passou de 7 para 3 px. A peça permanece inteira, com `object-fit: contain`.
- Nome com até duas linhas, tipografia legível e espaçamentos menores entre nome, preço e ações.
- O botão de detalhes fica sobre o canto inferior da imagem. No celular ele mostra apenas o ícone de informação, com rótulo acessível; no desktop também mostra o texto Detalhes. Não acrescenta uma linha à altura do card.
- Carrinho e Comprar permanecem lado a lado no celular e no desktop. O carrinho mostra uma confirmação visual após adicionar a peça.
- Controles de compra e detalhes mantêm área de toque de 44 px. Foco de teclado visível e respeito à preferência por movimento reduzido.
- Promoções mantêm o desconto no canto da imagem. No celular, o bloco de preço mostra apenas o valor atual para reduzir a altura; o preço anterior permanece no desktop.
- Catálogo, destaques da home, pronta entrega e promoções usam o mesmo layout.

## Fluxo de compra e detalhes

A compra rápida usa a opção padrão configurada no produto. Se não houver uma opção padrão correspondente, usa a primeira variante. O valor exibido, o valor enviado ao carrinho e o valor enviado por Comprar são calculados pela mesma função de preços, incluindo o desconto promocional.

Detalhes abre a página da peça, onde continuam disponíveis a descrição completa e as outras escalas. A navegação mantém o estado de retorno ao catálogo. Quando uma peça não tem link próprio, o botão abre uma janela com sua descrição e informações cadastradas. Produtos esgotados mantêm o acesso aos detalhes e bloqueiam a compra.

## Validação

- `npm run check`: **86 testes aprovados**, sem falhas; **0 erros e 46 avisos** de ESLint em outros trechos do projeto.
- `npm run build`: compilação de produção concluída.
- Testes dos cards verificam a opção padrão, o preço promocional enviado à compra, ausência do seletor na vitrine, favoritos, galeria, navegação de detalhes, descrição alternativa, Escape e bloqueio de produto esgotado.
- A interface foi verificada em DOM simulado. A conferência visual em aparelhos reais continua pendente; não foram medidas dimensões de cards em navegador real.
- A pré-renderização de produtos foi ignorada neste build local por falta das variáveis públicas do Supabase. O componente 3D mantém o aviso de tamanho de arquivo.

## Aplicação

Extraia a pasta `cubo`, aplique os arquivos ao projeto e preserve as variáveis da hospedagem. Use Node.js 24:

```bash
npm ci
npm run check
npm run build
```

Esta revisão não exige nova migração SQL. Não houve publicação do site. Confira uma prévia no celular, especialmente em 320, 360, 390 e 430 px, e valide detalhes, carrinho e compra antes da publicação.
