# Revisão dos e-mails de pedidos

## Objetivo

Padronizar os e-mails enviados pela Cubo Criativo, melhorar os detalhes apresentados ao cliente e tornar os disparos coerentes com as alterações importantes do pedido.

## Modelo visual padronizado

Todos os modelos de pedido agora usam a mesma identidade visual:

- cabeçalho escuro com a logo da Cubo Criativo;
- título, prévia do e-mail e assunto padronizados;
- blocos de resumo com pedido, status, pagamento e valores;
- botões para acompanhar pedido, abrir pagamento, acessar Área VIP ou rastrear entrega;
- rodapé com acesso ao site e à área `Meus pedidos`;
- cartão de suporte sem exibir campos vazios;
- layout adaptado para celular e computador;
- textos revisados em português e assuntos com o número curto do pedido.

## Disparos automáticos revisados

### Compra feita pelo site

- pagamento aprovado: confirmação completa do pedido;
- produção iniciada: aviso com itens e estimativa, quando informada;
- pedido pronto: aviso de preparação para postagem;
- pedido enviado: aviso com transportadora, código e botão de rastreio;
- pedido entregue: confirmação e acesso à avaliação;
- pedido cancelado: confirmação e orientação sobre reembolso;
- pedido reembolsado: confirmação e orientação sobre prazo bancário.

### Atualizações sem mudança de status

Também passam a gerar e-mail quando necessário:

- código de rastreio ou transportadora adicionados/alterados enquanto o pedido está como `enviado`;
- estimativa de produção alterada enquanto o pedido está `em_producao` ou `pronto`.

Salvar novamente o mesmo status, sem nenhuma informação relevante diferente, não dispara outro e-mail.

### Pedidos criados pelo painel administrativo

- pedido aguardando pagamento: o link é enviado automaticamente para o cliente;
- pedido lançado como pago: a confirmação é enviada automaticamente;
- o resultado do envio aparece no painel administrativo.

### Clube VIP

- ativação da assinatura;
- confirmação de upgrade;
- escolhas do ciclo liberadas;
- miniaturas em produção;
- envio pronto, despachado e entregue;
- links direcionam para a Área VIP quando apropriado.

### Pix pendente

O lembrete de Pix existente foi substituído pelo mesmo modelo visual dos demais e-mails e agora inclui:

- nome do cliente;
- número do pedido;
- valor;
- botão para abrir o pagamento;
- botão para consultar os pedidos;
- aviso para ignorar a mensagem caso o pagamento já tenha sido feito.

## Auditoria no painel

Os envios feitos pelas alterações administrativas continuam registrando:

- tipo de e-mail;
- sucesso, falha ou envio ignorado;
- data do último envio;
- erro retornado pelo provedor;
- evento na linha do tempo do pedido, quando a tabela estiver disponível.

## Variáveis recomendadas na Vercel

```env
SITE_URL=https://www.cubocriativo3d.com.br
BRAND_NAME=Cubo Criativo
RESEND_API_KEY=re_...
RESEND_FROM=Cubo Criativo <pedidos@seudominio.com>
ORDER_EMAIL_TO=seu-email-interno@dominio.com
SUPPORT_EMAIL=atendimento@seudominio.com
WHATSAPP_NUMBER=(77) 99999-9999
APP_TIMEZONE=America/Bahia
```

`RESEND_FROM` deve usar um domínio validado no Resend em produção.

## Banco de dados

Nenhum SQL novo é obrigatório. O código mantém compatibilidade com instalações que ainda não possuem todas as colunas de auditoria de e-mail.
