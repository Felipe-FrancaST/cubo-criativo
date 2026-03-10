# Cubo Criativo

Loja online da **Cubo Criativo** para venda de miniaturas, action figures, peças em resina, itens pintados à mão e produtos para colecionadores. O projeto foi desenvolvido com **React + Vite** no frontend, **Supabase** para autenticação e dados, **Mercado Pago** para pagamentos e **Vercel** para deploy e APIs serverless.

Este repositório reúne a aplicação pública, rotas serverless, integrações de pagamento e o fluxo de conta do usuário, incluindo login por e-mail e Google, recuperação de senha, exclusão de conta, cupons e área VIP.

## Visão geral

O site foi estruturado para separar com clareza os dois principais tipos de oferta:

- **Catálogo**: produtos com status `catalogo`, usados como vitrine de peças e encomendas.
- **Pronta Entrega**: produtos com status `estoque`, exibidos em página própria.

Além disso, a aplicação inclui:

- catálogo com busca e filtros
- página de produto com SEO e metadados
- carrinho e checkout
- pagamento por cartão e Pix com Mercado Pago
- autenticação com Supabase
- login com Google
- redefinição e criação de senha
- configurações de conta e exclusão permanente
- promoções, cupons e jogo da memória
- páginas institucionais, termos e privacidade
- pré-render de páginas de produto para SEO

## Stack principal

### Frontend
- **React 18**
- **Vite 5**
- **Tailwind CSS 4**

### Backend e serviços
- **Supabase Auth** para autenticação
- **Supabase Database** para produtos, perfil, pedidos e dados relacionados
- **Vercel Functions** para APIs serverless
- **Mercado Pago** para cartão e Pix
- **Resend** para e-mails transacionais e lembretes
- **Vercel Analytics**

## Funcionalidades do projeto

### Loja
- home com destaque de marca e atalhos comerciais
- catálogo com busca e filtros
- página separada de pronta entrega
- promoções
- página individual de produto
- carrinho de compras
- checkout com integração externa

### Conta do usuário
- cadastro com aceite obrigatório de termos e privacidade
- login com e-mail/senha
- login com Google
- redefinição de senha por e-mail
- criação de senha para contas sociais
- troca de senha dentro das configurações
- edição de dados de perfil
- exclusão permanente de conta com confirmação por senha

### Operação e venda
- pedidos e acompanhamento básico
- pagamentos por cartão via Checkout Pro
- pagamentos por Pix
- webhook do Mercado Pago
- lembrete de Pix pendente por cron
- cupons e campanhas promocionais
- área VIP / RPG

### SEO e conteúdo
- sitemap e robots
- Open Graph e metadados dinâmicos
- JSON-LD para produto e listagem
- pré-render de páginas de produto
- páginas de termos e privacidade

## Estrutura do projeto

```text
.
├── api/                     # Rotas serverless da Vercel
├── public/                  # Arquivos públicos e páginas estáticas
├── server/                  # Helpers de backend / integrações
├── src/
│   ├── auth/                # Contexto e fluxo de autenticação
│   ├── components/          # Componentes reutilizáveis
│   ├── data/                # Configurações e dados auxiliares
│   ├── lib/                 # Utilitários de frontend
│   └── pages/               # Páginas da aplicação
├── scripts/                 # Scripts auxiliares (ex.: prerender)
├── vercel.json              # Configuração de deploy
└── README.md
```

## Rotas principais

### Públicas
- `/` — Home
- `/catalogo` — Catálogo
- `/estoque` — Pronta entrega
- `/promocoes` — Promoções
- `/produto/:slug` — Produto
- `/sobre` — Sobre
- `/contato` — Contato
- `/faq` — FAQ
- `/trocas` — Trocas e devoluções
- `/terms.html` — Termos de serviço
- `/privacy.html` — Política de privacidade

### Conta e autenticação
- `/conta` — Conta do usuário
- `/configuracoes` — Configurações
- `/redefinir-senha` — Página segura para definir nova senha via link de e-mail

### Extras
- `/cupom` — Jogo da memória / cupom
- `/vip` e rotas relacionadas — Área VIP

## Requisitos

- **Node.js 20.x**
- **npm**
- conta no **Supabase**
- conta no **Mercado Pago**
- conta no **Vercel**
- conta no **Resend** se quiser e-mails transacionais

## Instalação local

```bash
git clone <seu-repositorio>
cd cubo-criativo
npm install
cp .env.example .env
npm run dev
```

O projeto abrirá em ambiente local pelo Vite.

## Scripts disponíveis

```bash
npm run dev       # ambiente local
npm run build     # build de produção + prerender de produtos
npm run preview   # pré-visualização local do build
```

## Variáveis de ambiente

Use o arquivo `.env.example` como base.

### Mercado Pago
- `MP_ACCESS_TOKEN`
- `SITE_URL`
- `MP_MODE`

### Resend
- `RESEND_API_KEY`
- `RESEND_FROM`
- `ORDER_EMAIL_TO`

### Supabase
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Configuração do Supabase

### 1) Crie o projeto
No painel do Supabase, crie um novo projeto e copie:

- Project URL
- anon public key
- service role key

### 2) Configure autenticação
Em **Authentication → URL Configuration**, ajuste:

- **Site URL** para sua URL de produção
- **Redirect URLs** para cobrir pelo menos:
  - `http://localhost:5173`
  - `https://seu-dominio.com`
  - `https://seu-dominio.com/redefinir-senha`
  - `https://seu-dominio.com/configuracoes` se necessário para outros fluxos

### 3) Login social
Se o projeto usar Google, configure o provedor em **Authentication → Providers → Google** com as credenciais corretas e os redirects autorizados.

### 4) Banco de dados
Crie as tabelas e políticas que seu projeto utiliza antes de testar fluxos como pedidos, perfil, favoritos, cupons e avaliações.

> Importante: este README descreve a aplicação, mas a estrutura exata do banco deve seguir o schema SQL adotado no seu projeto.

## Fluxo de produtos

O frontend trata o campo `status` do produto como fonte de verdade para exibição:

- `status = estoque` → produto aparece em **Pronta entrega**
- `status = catalogo` → produto aparece em **Catálogo**

Outros campos importantes usados no mapeamento do produto incluem:

- `name`
- `description`
- `slug`
- `price_cents`
- `original_price_cents`
- `images`
- `image_url`
- `stock`
- `featured`
- `promo`
- `category`
- `tags`
- `variants`
- `active`

## Pagamentos

### Cartão
O pagamento por cartão usa uma function serverless para criar a preferência no Mercado Pago e redirecionar o cliente para o checkout.

Arquivos relevantes:
- `api/create-checkout-session.js`
- `api/mp-webhook.js`

### Pix
O fluxo de Pix é tratado por endpoints específicos e pelo webhook do Mercado Pago.

Arquivos relevantes:
- `api/create-pix-payment.js`
- `api/pix-payment.js`
- `api/mp-webhook.js`

### Lembrete de Pix pendente
Existe um fluxo para enviar lembrete de pagamento pendente por cron job.

Para usar:
- configure o endpoint de cron na Vercel
- proteja com `CRON_SECRET`
- configure Resend para envio de e-mail

## Recuperação de senha

O fluxo correto do projeto é:

1. usuário clica em **Esqueceu a senha?**
2. o site envia um e-mail via Supabase
3. o link leva para `/redefinir-senha`
4. nessa página o usuário define a nova senha
5. não é exigida senha atual nesse fluxo

Já na área de configurações:

- se a conta **já possui senha**, a interface pede **senha atual + nova senha**
- se a conta veio de login social e **ainda não possui senha**, a interface exibe **Criar senha**

## Deploy na Vercel

1. conecte o repositório à Vercel
2. configure todas as variáveis de ambiente
3. confirme que `vercel.json` está correto
4. valide os redirects do Supabase para o domínio final
5. publique

### Recomendação importante
Não suba `node_modules` no repositório nem em pacotes de entrega. Sempre gere as dependências no ambiente de build com `npm install`.

## Boas práticas para manutenção

- mantenha `README.md`, `terms.html` e `privacy.html` alinhados com o que o site realmente faz
- revise redirects do Supabase sempre que mudar domínio ou fluxo de autenticação
- teste os fluxos de login, Google, redefinição e troca de senha antes de cada deploy importante
- limpe a pasta `dist` antes de builds de produção, se necessário
- proteja credenciais sensíveis e nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend

## Problemas comuns

### O link de redefinição de senha não abre a tela correta
Confira:
- `redirectTo` configurado no frontend
- Redirect URLs autorizados no Supabase
- domínio final correto na Vercel

### Login com Google redireciona de forma errada
Confira:
- URLs autorizadas no Google e no Supabase
- tratamento correto do callback de autenticação

### Mercado Pago não conclui pagamento
Confira:
- `MP_ACCESS_TOKEN`
- `SITE_URL`
- webhook publicado e acessível
- permissões da conta do Mercado Pago

## Licença e uso

Este projeto é de uso da **Cubo Criativo**. Adapte este repositório conforme sua operação, integrações e políticas internas.

---

Se você for apresentar este projeto para cliente, parceiro ou desenvolvedor, este README já serve como visão geral técnica e operacional do site. Para produção final, vale complementar com o schema do banco, instruções de deploy do domínio e checklist de integrações.
