# Integração de frete SuperFrete — Cubo Criativo

## O que foi implementado

O site consulta as modalidades ofertadas pela SuperFrete para o CEP de destino cadastrado no perfil do cliente, calcula cada volume e mostra uma seleção visual de frete no carrinho, na compra de miniaturas/bustos personalizados, na contratação da assinatura e na renovação da assinatura.

O servidor recalcula a cotação antes de criar o pagamento Pix ou o Checkout Pro (cartão). A modalidade e o valor precisam coincidir com a última cotação aceita pelo comprador. O custo entra no **total de cobrança do Mercado Pago** e é armazenado separadamente no banco como histórico do pedido, com modalidade, prazo estimado e dimensões dos volumes.

Na administração há a seção **Frete SuperFrete**, para editar CEP de origem, taxas por pedido, caixas, pesos e IDs de serviços sem mexer no código. Nas telas de detalhes do pedido do cliente e do administrador são exibidos o frete e os volumes.

### Embalagens e limites iniciais

| Produto | Comprimento × largura × altura (cm) | Peso já embalado |
| --- | --- | --- |
| Action figure 10 cm | 20 × 20 × 20 | 1 kg |
| Action figure 12 cm | 20 × 20 × 20 | 1 kg |
| Action figure 15 cm | 20 × 20 × 20 | 2 kg |
| Action figure 20 cm | 30 × 20 × 20 | 2 kg |
| Busto personalizado | 20 × 20 × 20 | 1 kg |
| Miniaturas RPG 32 mm (1–2 unidades) | 13 × 11 × 10 | 300 g |
| Miniaturas RPG 32 mm (3–10 unidades) | 20 × 20 × 20 | 1 kg |
| Miniatura RPG 32 mm personalizada | 13 × 11 × 10 | 300 g |
| Assinatura nível 1 | 20 × 20 × 20 | 300 g |
| Assinaturas níveis 2 e 3 | 30 × 20 × 20 | 1 kg |

**Origem:** `47803-604`.

**Agrupamento:** de 1 a 2 miniaturas RPG comuns, uma caixa pequena; de 3 a 10, uma caixa grande; depois dos primeiros 10 itens o cálculo continua criando caixas necessárias (12 = uma grande + uma pequena). Action figures sempre em caixas separadas, assim como bustos e miniaturas personalizadas. Pedidos mistos preservam essas regras.

**Taxa adicional uma única vez por pedido**, nunca por volume: R$ 5 quando o pedido tem somente miniaturas RPG comuns; R$ 10 quando envolve action figures, peças personalizadas ou assinatura. O frete é cotado **a cada nova contratação ou renovação** da assinatura. O upgrade sem novo envio não gera frete adicional.

O tamanho de 13 × 11 × 10 cm não é elegível ao Mini Envios com altura máxima de 4 cm. O site apenas mostra serviços que a API efetivamente retornar como disponíveis; a API pode mostrar PAC, SEDEX e outros serviços habilitados na conta, sujeito às restrições de medidas, CEP e contratação. IDs iniciais de serviços: `1,2,17` (PAC, SEDEX e Mini Envios). Caso novos serviços estejam liberados na conta, os IDs poderão ser alterados no painel administrativo.

## Instalação (obrigatória)

1. Faça backup do Supabase e da versão publicada no site.
2. Em **Supabase → SQL Editor**, execute `supabase/migrations/20261113_superfrete.sql` após as migrações anteriores. O SQL cria `shipping_settings` e `order_shipping`, sem regravar pedidos existentes.
3. Em sua hospedagem (por exemplo, **Vercel → Settings → Environment Variables**), configure:
   - `SUPERFRETE_TOKEN`: seu token secreto de API do SuperFrete.
   - `SUPERFRETE_USER_AGENT`: um identificador no formato `CuboCriativo/1.0 (SEU_EMAIL_TECNICO)` — use seu próprio e-mail.
   - `SUPERFRETE_API_URL`: opcional. O padrão é `https://api.superfrete.com`.
4. **Não** crie variáveis `VITE_SUPERFRETE_*` nem coloque o token no JavaScript público; ele deve existir somente no backend.
5. Publique **todo** o projeto, incluindo `src`, `server`, `api` e `vercel.json`; faça uma nova implantação para aplicar as variáveis.
6. Em **Administração → Frete SuperFrete**, confirme CEP, medidas, taxa e serviços autorizados. O frete está habilitado por padrão depois da migração.

Sem token e User-Agent, o cálculo mostrará uma mensagem de configuração pendente. O checkout **não aceita pagamento sem selecionar uma cotação válida**, evitando cobrar entrega sem valor real.

## Testes recomendados antes de liberar para clientes

- **Carrinho:** compra de uma miniatura RPG com escala 32 mm; confirmar caixa 13 × 11 × 10 e taxa R$ 5.
- **Carrinho com 12 miniaturas:** confirmar 2 volumes (um grande e um pequeno), a soma das cotações e apenas R$ 5 adicionais ao pedido.
- **Action figure 15 cm:** conferir 20 × 20 × 20, 2 kg e taxa de R$ 10.
- **Carrinho misto:** duas miniaturas + uma figure; confirmar a separação das caixas e uma taxa total de R$ 10.
- **Personalizações:** miniatura 32 mm e busto; confirmar uma caixa individual e R$ 10 de taxa em cada pedido.
- **Assinatura:** testar níveis 1, 2 e 3 e uma renovação; confirmar nova cotação no ciclo. Upgrade de plano sem novo envio não deve cobrar frete.
- **Pagamento:** utilizar o ambiente de testes do Mercado Pago para verificar que o valor do frete está incluído exatamente uma vez em Pix e cartão, após desconto de cupom, e aparece em “Meus pedidos” e na administração.
- **Alteração de valor:** mude o custo no painel após cotar no frontend. O backend deve impedir cobrar preço antigo e solicitar nova cotação.
- **Sem modalidades:** verificar que não aparecem modalidades inventadas e que o checkout continua bloqueado.

## O que a integração NÃO automatiza

**Este pacote implementa cotação e cobrança do frete; não gera, compra ou imprime etiquetas automaticamente.** A compra da etiqueta de postagem continua sendo uma etapa operacional na plataforma SuperFrete. Por isso, o recebimento do valor do frete no pedido **não significa** que o transporte tenha sido contratado automaticamente. Caso deseje impressão de etiquetas pelo painel, será necessário implementar um fluxo adicional de emissão com a API e os dados da transportadora.

Prazo de entrega é **estimado pela API** e não é promessa de entrega; pode haver diferenças conforme postagem, feriados, destino e regras dos serviços. Uma encomenda com múltiplos volumes exige verificação das possibilidades de postagem da conta SuperFrete: a cotação do site soma serviços equivalentes entre caixas, mas a contratação das etiquetas pode ter de ser feita separadamente para cada volume.

## Nota de validação

Os testes unitários de embalagem, taxas e combinação de modalidades utilizam respostas simuladas da API SuperFrete e passaram no ambiente de desenvolvimento. Como não foi fornecido token da sua conta nem ambiente de pagamento real, **não foi possível realizar uma cotação real ou validar a contratação de frete e o checkout em produção**. A suíte geral do repositório inclui dependências e arquivos antigos ausentes na versão de origem, o que impede declarar a compilação e os testes integrais como concluídos.
