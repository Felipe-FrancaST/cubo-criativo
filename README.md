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
✔️ Pagamento por cartão via **Stripe Checkout**  
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
# abra o .env e coloque sua STRIPE_SECRET_KEY
npm run dev
```

---

## 💳 Pagamento (Stripe Checkout)

O botão **“Pagar com cartão”** no carrinho chama uma função serverless da Vercel em `api/create-checkout-session.cjs`.

### Configurar na Vercel
1. Crie sua conta na Stripe e pegue sua chave em **Developers → API keys**.
2. Na Vercel (Project → Settings → Environment Variables), adicione:
   - `STRIPE_SECRET_KEY` = `sk_live_...` (produção) ou `sk_test_...` (teste)
3. Faça um novo deploy.

### Como funciona
- O site redireciona para o **Stripe Checkout**.
- Ao concluir ou cancelar, volta para o seu site com `?payment=success` ou `?payment=cancel`.

---

## 🏗️ Build

```bash
npm run build
npm run preview
```
