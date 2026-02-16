# 🧊 Cubo Criativo – Loja Online

Bem-vindo ao **Cubo Criativo**, uma loja virtual focada em:
- Miniaturas em resina de alta qualidade
- Pintura artística detalhada
- Modelagem e impressão 3D sob medida

Este repositório contém o código-fonte do site oficial, desenvolvido com **React + Vite + TailwindCSS** e hospedado na **Vercel**.

---

## 🚀 Tecnologias Utilizadas
- [React](https://react.dev/) – UI declarativa e componentizada
- [Vite](https://vitejs.dev/) – Build tool rápida e moderna
- [TailwindCSS](https://tailwindcss.com/) – Estilização ágil e responsiva
- [Vercel](https://vercel.com/) – Deploy contínuo e hospedagem

---

## 📦 Funcionalidades
✔️ Catálogo organizado por categorias (anime, HQs, filmes, games)  
✔️ Visualização em 3D dos modelos (`.glb`)  
✔️ Galeria de imagens com múltiplas perspectivas  
✔️ Filtros e barra de busca no catálogo  
✔️ Carrinho de compras dinâmico  
✔️ Finalização rápida pelo **WhatsApp**  
✔️ Pagamento por cartão via **Mercado Pago (Checkout Pro)**  
✔️ Layout moderno e responsivo  

---

## 🖼️ Prévia
![Preview do Site](public/images/promo.jpg)

---

## 🔧 Como Rodar Localmente
Clone este repositório e instale as dependências:

```bash
git clone https://github.com/seu-usuario/cubo-criativo.git
cd cubo-criativo
npm install
cp .env.example .env
npm run dev
```

---

## 💳 Pagamento (Mercado Pago – Checkout Pro)

O botão **“Pagar com cartão”** no carrinho chama a função serverless da Vercel em `api/create-checkout-session.js`, que cria uma **preferência** no Mercado Pago e redireciona o cliente para o Checkout Pro.

### Configurar na Vercel
Na Vercel (Project → Settings → Environment Variables), adicione:
- `MP_ACCESS_TOKEN` (produção: `APP_USR-...`)
- `SITE_URL` (sua URL pública, ex: `https://cubo-criativo.vercel.app`)

### Como funciona
- O site redireciona para o **Checkout Pro** do Mercado Pago.
- Ao aprovar, ele retorna para o seu site com `?payment=success`.
- O webhook `api/mp-webhook.js` confirma e marca o pedido como **pago** no Supabase.

---

## 🔐 Login + Banco de Dados (Supabase)

O projeto agora usa **Supabase Auth (email/senha)** e salva pedidos no **Supabase Database**.

### 1) Criar o projeto no Supabase
1. Crie um projeto.
2. Em **Project Settings → API**, copie:
   - **Project URL**
   - **anon public** key
   - **service_role** key (mantenha em segredo: só no backend!)

### 2) Criar as tabelas
No Supabase, abra **SQL Editor** e rode o arquivo `SUPABASE_SCHEMA.sql` (está na raiz do repositório).

### 3) Configurar Auth
No Supabase, em **Authentication → URL Configuration**:
1. Adicione sua URL de produção da Vercel em **Site URL**.
2. Adicione também (se usar) o endereço local: `http://localhost:5173`.

### 4) Variáveis de ambiente
Configure na Vercel (Project → Settings → Environment Variables) e também no seu `.env` local:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## ⚡ Pix (Mercado Pago)

O botão **“Pagar com Pix”** chama `api/create-pix-payment.js` e o webhook é `api/mp-webhook.js`.

> Observação importante: se você ver o erro `Unauthorized use of live credentials`, normalmente significa que o token é de produção e sua conta ainda não está habilitada para usar credenciais live (ou o app/credencial não tem permissão). Nesse caso, finalize a ativação da sua conta no Mercado Pago ou use um token de teste/sandbox compatível com Pix.

---

## 🏗️ Build

```bash
npm run build
npm run preview
```
