# Cubo Criativo — correção do banner e carrossel da página inicial

## Mudanças

- O banner principal dos planos VIP voltou à primeira posição da página inicial, antes do texto de apresentação, das promoções e das vitrines.
- Foram removidas as alturas fixas e o `object-fit: cover` que cortavam as imagens do banner. Agora cada imagem ocupa a largura disponível e mantém sua proporção original; a versão mobile cadastrada continua sendo utilizada em telas pequenas.
- O botão de acesso aos planos VIP fica abaixo da imagem, sem cobrir sua arte.
- As imagens do carrossel usam `object-fit: contain`, sem cortes. O quadro acompanha a proporção da imagem (com limites para imagens extremas) e mantém os controles abaixo dela, sem sobreposições.
- Permaneceram a troca automática de slides, as setas, a navegação por indicadores, o deslize por toque, a navegação via teclado e o acesso à página de promoções.

## Publicação

Substitua o código da versão anterior por este projeto completo e publique o frontend. Não é preciso executar novas migrações SQL ou alterar suas credenciais de pagamento.

## Verificações

- Testes direcionados: `node --test test/editorial-pages.test.js test/home-banner-carousel-responsive.test.js`.
- Análise sintática de `HomePage.jsx` e `CarrosselPromo.jsx` via compilação JSX.
- Conferência visual representativa em 320, 360, 390, 414, 640, 768, 1024 e 1440 px sem rolagem horizontal e sem cortes nas imagens locais usadas como referência.
- A integração ao vivo com as imagens cadastradas no Supabase deve ser conferida após a publicação.

Caso o navegador continue exibindo o banner antigo, atualize a página ignorando o cache e confirme se a publicação da hospedagem foi concluída.
