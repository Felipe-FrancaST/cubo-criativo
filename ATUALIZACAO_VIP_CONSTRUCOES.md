# Atualização — Construções, frete VIP público e personalizados

## Instalação
1. Faça backup do banco de dados.
2. Execute no SQL Editor do Supabase a migração `supabase/migrations/20261126_vip_construcoes.sql`.
3. Publique o projeto na Vercel.

## Regras
- Construção é uma categoria visual independente (`display_type = construction`), com `item_type = boss` para manter o limite compartilhado dos planos e as validações do banco. As peças existentes não são modificadas. O novo campo é preservado ao duplicar ciclos.
- O frete da assinatura pode ser consultado sem login com CEP e plano selecionado; a API usa o plano cadastrado no servidor. Trocar o CEP, o plano ou a sessão invalida a cotação anterior. O checkout exige login e valida o endereço e preço do frete novamente. Após login, selecione novamente o frete.
- Personalizados: miniaturas de 32 a 50 mm (informar tamanho nas observações) e bustos de 10 cm. A orientação foi incluída no formulário e resumo; sem alteração no preço, frete ou validação automática do texto.

## Validação
56 testes direcionados passaram, incluindo seis novos testes. Sintaxe JS/JSX dos 16 arquivos de implementação verificada. Build, testes de navegador e execução da migração no Supabase de produção não foram realizados neste ambiente.
