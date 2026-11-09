# Revisão do Cubo Criativo — 09/11/2026

## Escopo e resultado
Revisão do código fornecido: rotas públicas, páginas institucionais, carrinho, pagamentos de pedidos manuais e VIP, atendimento/cancelamento, coleta de métricas, configuração de publicação, sitemap e testes existentes. As páginas públicas publicadas também foram consultadas, mas a extração de conteúdo não executa todos os fluxos JavaScript. Não houve compra, reembolso, alteração no banco de produção ou publicação automática.

## Alterações realizadas
- Privacidade, Termos e Trocas agora têm conteúdo central em `src/data/legal.js` e apresentação React compartilhada.
- `npm run legal:generate` gera os HTML de privacidade e termos pela mesma fonte. O build executa esse comando automaticamente.
- Textos com contato direto, CNPJ, data, sumário e links entre as políticas; HTML estático legível no celular e preparado para impressão.
- Arrependimento, avaria, defeito, encomenda e devolução descritos de forma objetiva. Removidas exclusões amplas de responsabilidade por transportadoras e alterações irrestritas de compras anteriores.
- Privacidade descreve os serviços presentes no código, os dados de pedidos/conta, o armazenamento no navegador, a atribuição de afiliados, avaliações públicas, conservação e direitos.
- Orientação sobre renovação VIP por nova ação e pagamento do cliente, conforme a implementação atual.
- Links de consulta das condições antes dos botões de pagamento do carrinho, planos VIP e pedidos manuais. Não foi adicionado consentimento genérico obrigatório para tratamento de dados.
- Removidas mensagens que definiam automaticamente estorno de 30% ou 50% segundo a etapa de produção. A API registra solicitação de análise, não percentual; a tela não afirma que o dinheiro já foi estornado.
- Atendimento de devolução acessível na janela de cancelamento, inclusive quando a atualização automática de status não está disponível para pedidos enviados/entregues.
- Analytics exclui áreas privadas, retira parâmetros e fragmentos de URLs, respeita Do Not Track e Global Privacy Control no envio de eventos do aplicativo. Propriedades de eventos não incluem identificadores de conta/pedido nem textos fornecidos por usuários. Isso não altera logs de infraestrutura ou a atribuição de afiliados.
- Links de rastreamento rejeitam protocolos executáveis e URLs com usuário/senha, com retorno ao site da transportadora quando possível.
- URL desconhecida mostra página não encontrada e `noindex` no cliente, em vez de repetir a página inicial. O fallback SPA da hospedagem continua podendo responder HTTP 200; isso não equivale a um 404 de servidor.
- Corrigido o destino de “Pular para o conteúdo”; adicionado CNPJ aos dados estruturados da organização.
- Cabeçalhos `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin` na publicação Vercel.
- FAQ atualizada sobre devolução e renovação VIP.

## Verificação
- Build de produção: aprovado. O arquivo 3D ainda gera alerta de tamanho de bundle; não foi removido o recurso.
- ESLint: zero erros, 45 avisos remanescentes de código existente.
- Suíte geral final: 96 de 98 testes aprovados. As duas falhas são por ausência de `SQL_NIVEIS_ADMIN.sql` e `SQL_AVALIACOES.sql` no pacote original.
- Cinco testes focados de privacidade, conteúdo estático e rastreamento aprovados e incorporados à suíte final.
- Dependência transitiva ws atualizada para 8.22.2 após dois alertas de segurança. A auditoria final `npm audit --omit=dev` reportou zero vulnerabilidades conhecidas nas dependências de produção. Isso não certifica ausência de falhas na aplicação ou nas dependências de desenvolvimento. Build e suíte repetidos após a atualização.
- Pré-renderização com produtos reais não executada sem variáveis Supabase. Nenhuma credencial foi incluída no ZIP.
- A inspeção visual interativa não foi concluída; o Chromium deste ambiente falhou ao iniciar na revisão anterior. Testes de componentes e compilação não substituem conferência em dispositivos reais.

## Pontos que dependem da operação/produção
1. **Frete:** o checkout padrão não apresenta um cálculo automático de frete nos arquivos revisados. Não inventei tarifa, frete grátis ou contrato de transportadora. Confirme que o total e a entrega estejam definidos antes da contratação; caso a regra comercial exija cálculo por CEP, essa regra precisa ser fornecida para implementação.
2. **Reembolso:** cancelar o pedido registra a solicitação, mas não executa estorno financeiro no Mercado Pago. O atendimento precisa processar e acompanhar cada caso. Não foram feitas alterações em credenciais ou transações.
3. **Banco de dados:** sem as migrações ausentes e sem acesso à produção, não é possível certificar as políticas RLS, permissões efetivas e comportamento de exclusão/retencão por chaves estrangeiras. Não gerei SQL presumindo o esquema do seu banco.
4. **Notificações Mercado Pago:** o handler consulta o pagamento com o token do servidor, porém a versão atual não valida a assinatura criptográfica `x-signature`. O endurecimento dessa integração exige a configuração do segredo real e testes de notificações; não ativei uma exigência sem segredo que interromperia pagamentos.
5. **Dados da empresa:** mantidos os dados disponíveis, conforme sua confirmação de que já os conferiu. Nesta cópia há marca, CNPJ, cidade/UF e contatos; não inventei razão social nem endereço completo. A conferência documental/publicação desses dados é separada desta revisão.
6. **Atendimento e retenção:** os textos precisam corresponder à prática real: resposta a demandas, logística reversa, estornos, prazos de produção e regras de retenção dos fornecedores. O projeto não automatiza todos esses processos.
7. **Conteúdo e modelos:** a autorização de uso/licenciamento de marcas, personagens e modelos comercializados não pode ser verificada apenas pelo código.

Esta revisão melhora clareza e coerência técnica, mas não é certificação de conformidade jurídica nem auditoria completa da infraestrutura. Condições comerciais específicas devem ser validadas com assessoria jurídica, especialmente exceções de personalização e retenção de dados.

## Referências oficiais consultadas
- Comércio eletrônico: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
- Código de Defesa do Consumidor: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Direitos dos titulares — ANPD: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares
- Proteção de dados em métricas: https://vercel.com/docs/analytics/redacting-sensitive-data
- Vercel Web Analytics: https://vercel.com/docs/analytics/privacy-policy

## Publicação
Publique os fontes mantendo as variáveis de ambiente da hospedagem. O build gera sitemap e políticas. Depois, confira navegação, informações de entrega, uma compra real controlada, atualização do pedido, atendimento e devolução no seu ambiente. Mantenha `WHATSAPP_NUMBER=5577998472372` nos e-mails se essa variável for usada.
