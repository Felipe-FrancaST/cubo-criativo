# Cubo Criativo — configurações, planos VIP e cards

Atualização de 2 de outubro de 2026. O pacote reúne o projeto completo, com as melhorias anteriores de administração, Área VIP, Cubo Game e responsividade. As alterações desta revisão foram aplicadas ao código; o site ainda não foi publicado.

## Configurações da conta

- Uma navegação por Dados e entrega, Segurança, Favoritos, Cupons e Avaliações, com suporte a teclado. No celular, as abas deslizam horizontalmente.
- Dados pessoais e endereços em blocos separados, com rótulos ligados aos campos, avatar e acesso à Área VIP.
- Indicação de alterações não salvas, descarte do rascunho e barra com ação de salvar. Trocar de aba mantém os campos preenchidos.
- Falhas de carregamento oferecem nova tentativa e impedem salvar um perfil vazio. Falhas de salvamento preservam o rascunho e liberam a tentativa seguinte.
- Salvamento protegido contra envios repetidos; campos opcionais apagados são enviados como nulos para limpar o valor anterior.
- CPF válido e nascimento obrigatórios ao completar o cadastro solicitado pelo checkout.
- Segurança com confirmação de senha, recuperação de acesso e exclusão da conta agrupadas. As janelas de avaliação e exclusão aparecem acima das configurações.
- Favoritos em linhas compactas, cupons com ação de copiar e avaliações associadas aos pedidos entregues.
- Remoção do carregamento de opções VIP que não eram usadas nas configurações.

## Planos VIP

- Comparação de planos antes da coleção, com preço, miniaturas, bosses e total de peças por ciclo. Os valores continuam vindo da API.
- Seleção por cartões acessíveis, compactos no celular, e resumo com plano, cupom, desconto e total.
- Trocar o plano remove o desconto anterior e descarta respostas atrasadas da validação de cupom. Um total de zero é exibido corretamente.
- Verificação do cadastro e bloqueio de duplo toque antes de criar pagamentos. Falhas de conexão permitem tentar novamente.
- Depois de completar o cadastro, o fluxo retoma o método e o plano escolhidos.
- Pix mostra o plano e o valor do pagamento gerado. Um código só é reaproveitado quando plano, cupom e total correspondem à seleção atual e o pagamento continua pendente. Uma falha confirmada permite gerar outro pagamento.
- Verificação do Pix protegida contra consultas simultâneas. Respostas antigas de outra conta ou pagamento são ignoradas.
- Uma informação VIP antiga no armazenamento local não redireciona a conta: a assinatura é conferida na API.
- Coleção com rolagem horizontal no celular, galeria compartilhada e dúvidas em seções expansíveis.

## Cards de produtos no celular

- Imagem proporcional de 5:4, sem a altura mínima que alongava os cards de promoção.
- Título de até duas linhas, menos textos repetidos e preço organizado em um único bloco.
- Seletor de escala sem repetir o preço nas opções; a seleção continua atualizando o valor da compra.
- Carrinho e Comprar na mesma linha. O carrinho usa um ícone com rótulo acessível e confirmação visual; os controles mantêm área de toque de pelo menos 44 px.
- Favorito separado do botão da galeria. Produtos esgotados mostram uma única ação desabilitada.
- Catálogo, pronta entrega e promoções usam o mesmo componente de card, mantendo preços e descontos por escala.

## Validação

- **84 testes aprovados**, incluindo 15 novos testes de configurações, cards, cupons e pagamentos simulados.
- **ESLint: 0 erros e 46 avisos** em outros trechos do projeto.
- **Build de produção concluído**. O componente 3D continua gerando um aviso de tamanho de arquivo.
- Testes de interface executados em DOM simulado com APIs simuladas. Não foram realizadas transações reais.
- A pré-renderização de produtos foi ignorada no build local pela ausência das variáveis públicas do Supabase.

A conferência visual em aparelhos reais continua pendente, pois a prévia de navegador estava bloqueada neste ambiente. Confira especialmente os cards em 320–430 px, abas e formulários com teclado aberto, descarte e salvamento, troca de plano, cupons e checkout no ambiente integrado.

## Aplicação

Extraia a pasta `cubo` e aplique os arquivos ao projeto, preservando as variáveis da hospedagem. Com Node.js 24:

```bash
npm ci
npm run check
npm run build
```

Esta revisão não exige nova migração SQL. As instruções dos scripts de administração incluídos anteriormente permanecem em `MELHORIAS.md`.
