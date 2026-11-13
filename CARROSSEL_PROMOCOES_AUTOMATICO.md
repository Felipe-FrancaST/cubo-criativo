# Cubo Criativo — Carrossel automático de produtos em promoção

## O que mudou

- O carrossel da página inicial **não usa mais** a tabela `site_carousel_images` nem as imagens locais `promo.jpg`, `promo1.jpg` ou `promo2.jpg`.
- Ele recebe a lista `promocoes` já utilizada pela página **Promoções**. O produto precisa estar ativo, marcado como promoção no painel de produtos e ter ao menos uma fotografia cadastrada.
- Mostra a fotografia real do produto, nome, preço promocional, preço antigo (quando aplicável) e percentual de desconto (quando houver).
- Ao tocar na imagem/cartão o visitante abre a página do produto; setas, indicadores, rotação automática e gesto de deslizar continuam funcionando.
- A imagem é exibida inteira, sem corte (`object-fit: contain`), tanto no computador quanto no celular.
- Se não houver produto promocional com foto, exibe uma mensagem discreta e acesso à página de promoções. **Não** retorna às imagens estáticas antigas.
- O banner VIP continua sendo o primeiro elemento da página inicial e não foi alterado.

## Como controlar o carrossel

1. Em **Administração → Produtos**, abra o produto desejado.
2. Ative a opção de **Promoção**, configure os valores e confirme que a imagem principal foi enviada.
3. Salve. O produto passa a ser elegível para o carrossel e para a página Promoções.
4. Desative a promoção para retirá-lo do carrossel.
5. Atualize a página inicial do site para carregar a lista mais recente de produtos.

A ordem segue a lista de promoções da loja (maior desconto primeiro, quando aplicável). Nenhum SQL novo é necessário.

## Publicação

Substitua o código publicado na Vercel por este pacote completo. Não é necessário modificar os segredos do Supabase ou da SuperFrete.

## Verificação

- 17 testes relacionados à home, carrossel, catálogo e promoções passaram.
- Testes gerais: 130 aprovados e 9 falhas preexistentes, comparadas ao pacote anterior (126 aprovados, 9 falhas).
- Arquivos JSX modificados: sintaxe validada.
- A compilação integral e o comportamento com dados reais do Supabase devem ser conferidos após o deploy, já que as dependências npm não estão instaladas neste ambiente.
