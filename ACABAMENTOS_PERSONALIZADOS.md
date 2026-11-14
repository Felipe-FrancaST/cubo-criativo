# Cubo Criativo — acabamentos para miniaturas e bustos personalizados

## O que foi adicionado

Na página **Miniaturas personalizadas**, tanto **Miniatura** como **Busto** oferecem:

- **Com pintura**: valor específico, com pintura manual.
- **Sem pintura**: valor específico, peça em resina sem pintura.

O comprador seleciona uma opção antes de enviar as referências. Os preços aparecem na escolha, no resumo e no valor final do Pix ou cartão. Cupons são recalculados conforme a opção escolhida; um desconto de outra variante não é reaproveitado. O backend verifica o formato e o acabamento registrados na solicitação, antes de criar a cobrança.

O acabamento escolhido também aparece nos detalhes do pedido, histórico do cliente, área de personalizadas da administração, pedidos gerais e descrição do item enviado ao Mercado Pago. Pedidos antigos passam a ser identificados como **Com pintura**.

## Administração

Acesse **Administração → Personalizadas → Preços de personalização**.

O painel possui quatro campos:

| Peça | Acabamento | Campo no banco |
| --- | --- | --- |
| Miniatura | Com pintura | `miniature_price_cents` |
| Miniatura | Sem pintura | `miniature_unpainted_price_cents` |
| Busto | Com pintura | `bust_price_cents` |
| Busto | Sem pintura | `bust_unpainted_price_cents` |

Defina valores diferentes para cada opção e clique em **Salvar preços**. A opção sem pintura deve ter preço menor que a opção com pintura. Os valores são guardados em centavos no Supabase e calculados novamente no servidor na hora do pagamento.

## Instalação obrigatória

1. **Faça backup do Supabase.**
2. No **SQL Editor do Supabase**, execute o arquivo `supabase/migrations/20261114_custom_finishes.sql` **uma única vez**, antes de publicar o novo frontend/backend.
3. Publique o conteúdo do ZIP completo na Vercel, incluindo `server`, `api`, `src` e `supabase`.
4. Acesse **Administração → Personalizadas** e confira os quatro valores. Ajuste-os ao que deseja cobrar.
5. Teste uma miniatura com pintura e outra sem pintura, um busto de cada acabamento e um cupom, com Pix e cartão em ambiente de testes.

**Preços iniciais:** os valores COM pintura já configurados são preservados. A migração cria os valores SEM pintura inicialmente 25% menores (por exemplo, se a peça com pintura custa R$ 200,00, a sem pintura começa em R$ 150,00). **Confira e ajuste esses valores no administrador antes de receber pedidos.**

**Frete:** não foi alterado. A SuperFrete continua calculando pelo tipo de peça, medidas, peso e modalidade selecionada, sem levar em conta o acabamento.

## Validação neste ambiente

Foram aprovados **15 testes direcionados** à personalização e aos acabamentos. A suíte geral reportou **151 testes aprovados e 9 falhas** ligadas a dependências indisponíveis (`jsdom`, `@supabase/supabase-js`) e arquivos SQL antigos ausentes. A compilação integral e as cobranças reais do Mercado Pago precisam ser verificadas na hospedagem.
