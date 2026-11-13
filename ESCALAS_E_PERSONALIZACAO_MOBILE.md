# Cubo Criativo — Escolha de escalas e experiência móvel

Atualização desenvolvida sobre o pacote `cubo-criativo-checkout-padronizado-cupons-cadastro.zip`.

## O que foi alterado

### Seleção de escala na compra
- Nos cartões do catálogo, promoções, estoque e demais páginas que utilizam `ProductCard`, tanto **Adicionar ao carrinho** quanto **Comprar** abrem uma janela de seleção antes de realizar a ação.
- Na página de detalhes de cada produto, os dois botões também exigem a confirmação da escala. A seleção prévia na própria página é reconhecida pela janela quando o cliente já tiver alterado a opção.
- A janela mostra o nome da opção e seu preço efetivo, incluindo descontos promocionais por variante. O botão de confirmar fica bloqueado até o cliente escolher uma escala.
- A escolha é enviada ao sistema de carrinho como `{ escala, unitPrice }`; itens de escalas distintas permanecem separados, e a escala continua no pedido.
- A camada `App.jsx` rejeita variantes com escala ausente ou inválida antes de adicionar ao carrinho ou iniciar a compra direta.
- Produtos **sem escalas cadastradas** continuam com a venda normal e não recebem escalas fictícias. Para oferecer opções, preencha as variantes do produto no painel administrativo. Variantes com preço não definido não podem ser confirmadas.

### Melhorias para celular — miniaturas personalizadas
- Abertura compacta sem ilustração decorativa que ocupava grande parte da tela.
- Navegação em quatro etapas: formato, imagens, detalhes e pagamento.
- Formatos em cartões verticais fáceis de ler e tocar.
- Instruções de upload próprias para celular e botão grande para selecionar as imagens.
- Pré-visualização de referências com botões de remoção maiores.
- Botão **Revisar pedido e pagar**, que leva diretamente ao resumo; sem imagens, volta à etapa obrigatória de envio.
- Resumo com número de referências anexadas, campos maiores, áreas de toque acessíveis e ajustes para telas estreitas (incluindo 320 px).
- O fluxo de autenticação, upload obrigatório, cupons, Pix e cartão foi preservado.

## Arquivos principais
- `src/components/ScaleSelectionModal.jsx` (novo)
- `src/components/scale-selection.css` (novo)
- `src/lib/scaleSelection.js` (novo)
- `src/components/ProductCard.jsx`
- `src/pages/ProductPage.jsx`
- `src/App.jsx`
- `src/pages/CustomMiniaturesPage.jsx`
- `src/pages/custom-miniatures.css`
- `test/scale-selection.test.js` (novo)

## Publicação
1. Faça backup da versão publicada.
2. Publique o frontend atualizado, mantendo as variáveis de ambiente e as configurações da loja.
3. Confira no painel administrativo se cada produto que deve oferecer escalas possui variantes com nome e preço válidos.
4. Verifique no computador e no celular: adicionar pelo catálogo, comprar direto, duas escalas diferentes no mesmo carrinho, descontos promocionais, upload, cupom e as duas formas de pagamento da personalização.
5. Faça uma transação de teste antes de liberar a alteração em produção.

**SQL:** esta alteração não exige uma nova migração de banco de dados.

## Validação neste ambiente
- Testes direcionados da implementação e de preços/checkout: **14/14 passaram**.
- Verificação sintática dos seis arquivos JS/JSX alterados: **sem erros de análise**.
- Suíte geral: **92 testes passaram de 101**, com 9 falhas por dependências npm indisponíveis (React/Supabase) e dois arquivos SQL ausentes no pacote de origem; não são alegadas como testes de integração aprovados.
- Não foi possível executar compilação completa ou um teste de pagamento real neste ambiente por falta de instalação concluída das dependências.
