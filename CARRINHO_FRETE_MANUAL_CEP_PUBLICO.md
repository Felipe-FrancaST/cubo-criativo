# Cubo Criativo — Carrinho: quantidade digitável e frete sob demanda

## O que foi alterado

- O carrinho permite editar a quantidade diretamente, além dos botões de mais e menos.
- Quantidades digitadas são confirmadas ao sair do campo ou pressionar **Enter**, com limite de 1 a 100 por linha. O servidor continua verificando estoque, categoria e quantidade de volumes.
- O carrinho não chama mais a SuperFrete a cada alteração de item: o cliente informa o CEP e clica em **Calcular frete**.
- A consulta do frete de produtos está disponível para visitantes, sem login. O preço e a embalagem são determinados no backend com os dados reais do Supabase.
- Se a quantidade, os produtos ou o CEP mudarem, a seleção anterior é imediatamente invalidada. É necessário clicar em **Recalcular frete** e escolher novamente uma modalidade para prosseguir.
- O servidor aceita cotações públicas apenas para produtos do carrinho. Pedidos, configurações, assinaturas e personalizadas mantêm as verificações de autenticação existentes.
- O servidor limita o número de consultas por IP para proteger a integração. Para uma conta autenticada, o limite de consulta é 20/minuto; para um visitante, 10/minuto. Normalmente, não será atingido porque a cotação é sob demanda.
- Ao finalizar o Pix ou cartão, o servidor recalcula o frete, confere o valor escolhido e garante que o CEP consultado seja o CEP do cadastro. Caso sejam diferentes, o cliente deve atualizar o cadastro ou refazer a cotação.
- As páginas de assinaturas e personalizadas continuam com o comportamento anterior.
- A revalidação de cupom ao editar o subtotal agora espera 600 ms após a última mudança, para não gerar requisições desnecessárias.

## Como publicar

1. Faça backup do código atual e publique todo o conteúdo do ZIP na Vercel.
2. Não é necessário executar SQL nem alterar `SUPERFRETE_TOKEN` ou `SUPERFRETE_USER_AGENT`.
3. Após a publicação, abra o carrinho no celular e no desktop, primeiro sem login e depois com login.

## Roteiro de verificação recomendado

1. Sem login, adicione um chaveiro, digite **27** na quantidade e confira o subtotal.
2. Informe um CEP válido e clique em **Calcular frete**. Para 27 chaveiros, a regra atual agrupa em uma embalagem de 20 e outra de 7; a disponibilidade do serviço Mini Envios depende da SuperFrete.
3. Selecione uma modalidade e depois altere a quantidade para **40**. O total anterior não pode continuar disponível; a tela deve solicitar **Recalcular frete**.
4. Altere o CEP, recalcule e confira as modalidades e o preço. Não deve ser feito nenhum novo cálculo enquanto apenas digita ou usa os botões +/−.
5. Clique rapidamente várias vezes em + e verifique no DevTools > Network que não surgem requisições `/api/shipping?op=quote` até clicar no botão.
6. Faça login, confira o CEP salvo em Configurações e verifique que o pagamento é recusado caso o CEP selecionado na cotação seja diferente do cadastro.
7. Verifique também que as formas de pagamento Pix/cartão, cupons e outras categorias de produtos continuam funcionando.

## Testes no ambiente de desenvolvimento

- Testes novos de quantidade, acesso público, restrições e vínculo do CEP: aprovados.
- Testes de agrupamento, preços e modalidades de frete anteriores: aprovados.
- Análise de sintaxe dos componentes JSX alterados: aprovada.
- Suíte geral: 177 aprovados e nove falhas previamente existentes relacionadas a dependências ou arquivos antigos no pacote de origem. **Ainda é preciso testar a cotação real e o checkout na Vercel.**
