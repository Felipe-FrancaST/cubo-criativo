# Cubo Criativo — escalas, caixas e transportadoras SuperFrete

## Instalação

1. **Backup do Supabase** antes de aplicar alterações no banco de produção.
2. Execute no **Supabase → SQL Editor** `supabase/migrations/20261113_shipping_scales_and_carriers.sql`, **depois** da migração `20261113_superfrete.sql` já instalada.
3. Publique novamente este projeto completo na **Vercel** (frontend e APIs da pasta `api/`, incluindo os módulos `server/`).
4. Mantenha as variáveis secretas `SUPERFRETE_TOKEN` e `SUPERFRETE_USER_AGENT` como estavam. Não é necessário recriar token.
5. Vá em **Administração → Frete SuperFrete**. O painel tem três guias:
   - **Escalas:** adicione tamanhos em cm (action figures) ou mm (miniaturas RPG) e escolha a caixa correspondente. As escalas existentes foram mantidas. Para miniaturas você também informa quantidade por caixa pequena/grande.
   - **Caixas e pesos:** edite as medidas e os pesos existentes ou crie novas embalagens. É possível reutilizar a mesma caixa para várias escalas. As caixas iniciais de bustos e assinaturas permanecem editáveis.
   - **Taxas e serviços:** aumente/diminua as taxas únicas por pedido, altere CEP da loja e selecione transportadoras.
6. Clique em **Salvar configurações**. As próximas cotações usarão os valores novos; não muda os dados gravados em pedidos existentes.

## Loggi e Jadlog: por que não apareciam?

O código anterior enviava apenas `services: 1,2,17`, que solicita os serviços padrão dos Correios. A nova migração amplia a configuração **somente quando o valor antigo ainda é exatamente `1,2,17`** para `1,2,3,17,31` (Jadlog e Loggi, IDs presentes em integrações SuperFrete publicadas). O painel passa a mostrar os serviços como opções selecionáveis.

**Também é necessário habilitar as transportadoras no painel SuperFrete:**

1. SuperFrete → **Integrações** → localize a integração → **engrenagem de configuração**.
2. Ative **Jadlog** e **Loggi** se estiverem disponíveis para sua conta.
3. Informe CEP da loja e escolha um **ponto de postagem válido/próximo**. Confira sempre a unidade indicada para evitar reprecificação.
4. Faça uma cotação no site com o mesmo CEP de destino usado na calculadora SuperFrete e com as dimensões exatas da caixa.

Mesmo habilitadas, essas transportadoras **não são garantidas** para todos os CEPs, volumes e contas. A Loggi passa por liberação gradual. O sistema lista apenas os serviços confirmados pela resposta real da API, nunca cria preços artificiais. Se a API não aceitar um ID do serviço para sua conta, desmarque esse serviço no painel e consulte o suporte SuperFrete.

Fontes oficiais: https://ajuda.superfrete.com/artigo/como-ativar-ou-desativar-transportadoras-na-minha-integracao/ e https://ajuda.superfrete.com/artigo/quais-as-transportadoras-disponiveis-na-superfrete/ .

## Exemplos de cadastro

**Action figure 25 cm:** em **Caixas e pesos**, crie `Caixa figure 25 cm`, informe dimensões/peso da embalagem fechada. Em **Escalas**, clique em `Nova escala → Action figure → 25` e associe essa caixa. Cadastre também uma variante de produto com a escala `25 cm` na área de produtos, para que o comprador possa selecioná-la.

**Miniatura RPG 28 mm:** crie duas caixas (pequena e grande) se precisar. Em **Escalas**, clique em `Nova escala → Miniatura RPG → 28`, vincule ambas e informe os limites máximos por caixa. Se o mesmo produto tem várias escalas, cadastre as variantes correspondentes no cadastro desse produto.

**Atenção:** as regras da página de frete definem como **embalar e cotar** a escala. Elas não criam automaticamente novas variantes ou novos preços no catálogo.

## Regras financeiras preservadas

- A SuperFrete recebe peso em **kg** e dimensões em **cm**.
- Action figures: uma caixa por peça, conforme a escala selecionada.
- Miniaturas RPG: agrupadas por escala e conforme os limites das caixas pequena/grande; lotes de tamanhos diferentes não compartilham automaticamente a mesma caixa.
- Miniaturas personalizadas de 32 mm, bustos e assinaturas mantêm as embalagens padrão configuradas.
- O acréscimo por embalagem é cobrado **uma vez por pedido**, mesmo com múltiplas caixas; carrinhos mistos com action figure usam o valor da categoria de maior custo.
- Os valores e a modalidade são recalculados **no servidor** antes da cobrança Pix ou cartão. O cliente não pode escolher um frete fictício nem alterar o preço do checkout pelo navegador.

## Testes recomendados na Vercel

1. Calcule frete para um produto de 10 cm, e depois para uma nova escala adicionada no admin.
2. Teste 2, 3, 10 e 12 miniaturas, conferindo o número de caixas e o acréscimo único.
3. Verifique o cálculo em carrinho misto, miniatura personalizada e assinatura, tanto no Pix quanto no cartão.
4. Tente comprar com escala não configurada: a loja deve solicitar o cadastro da embalagem em vez de inventar peso/medidas.
5. Compare as opções retornadas pelo checkout e pelo simulador da SuperFrete com a mesma origem, destino e embalagem; habilite Jadlog/Loggi no painel da SuperFrete se necessário.

## Validação local

Os testes específicos de escalas e frete passaram (15 testes); o JSX do novo painel passou na análise de sintaxe. A suíte de testes geral passou 123 de 132 testes, com 9 falhas já relacionadas a dependências/npm e arquivos da versão de origem indisponíveis; a compilação integral e as cotações de transportadoras reais não puderam ser executadas aqui. Nenhuma credencial SuperFrete foi acessada ou copiada.
