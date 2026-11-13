# Cubo Criativo — limpeza da home e galeria centralizada

## Alterações

- Página individual: removidos os quatro blocos repetidos de **Escala**, **Entrega**, **Material** e **Galeria**. A seleção obrigatória da escala para comprar foi preservada.
- Nova galeria: abre como janela centralizada em celular e desktop, fora do modal genérico de rodapé. A foto é contida na área disponível sem cortes. Possui botão de fechar, fotos anterior/próxima, miniaturas e zoom entre 100% e 400%. No celular aceita gesto de pinça; no computador roda do mouse, arrastar para mover a foto ampliada e duplo clique. Esc fecha; setas navegam; +, - e 0 controlam o zoom.
- Carrossel: setas laterais menores, indicadores compactos, até sete pontos por vez (sem quebra de linha); retirada a seta decorativa ao lado do nome do produto. A lista de promoções e os links de produtos continuam dinâmicos.
- Página inicial: retirados os três atalhos imediatamente depois do carrossel (Peça personalizada, Cubo Game, Miniaturas RPG), sem remover as respectivas funcionalidades do restante do site.
- Removidas as frases: “Uma seleção especial para sua coleção”, “Descubra peças disponíveis em nosso estoque” e “Heróis, criaturas e personagens que ganham vida na mesa”. As vitrines continuam disponíveis.

## Publicação

1. Publique o conteúdo do projeto na Vercel, substituindo a versão anterior.
2. Após concluir o deploy, atualize a página no navegador. Caso haja cache, faça atualização forçada.
3. Confira a página inicial no celular e toque na foto de um produto para abrir a nova galeria.
4. Confirme que a seleção de escalas, compra e carrinho continuam funcionando.

**Banco de dados:** não exige SQL adicional. Não muda funções de pagamento nem credenciais.

## Verificações realizadas

- Parser JSX: sem erros sintáticos nos componentes alterados.
- 32 testes direcionados de home, promoções, produtos, escala e galeria: aprovados.
- 144 testes na suíte geral: 135 aprovações, 9 falhas em testes dependentes de arquivos SQL ausentes ou bibliotecas de teste indisponíveis no pacote original; não foram identificadas novas falhas relacionadas a estas alterações.
- Layout isolado da galeria verificado com Chrome headless em 320, 375, 390, 768 e 1366 px: painel centralizado e sem rolagem horizontal.

A compilação total do aplicativo não foi executada neste ambiente por ausência das dependências npm. Recomenda-se conferir o build na Vercel antes de liberar a versão em produção.
