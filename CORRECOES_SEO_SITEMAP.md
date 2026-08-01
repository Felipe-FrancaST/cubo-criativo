# Correções de SEO e sitemap

## O que foi alterado

- O sitemap deixou de ser um arquivo estático duplicado e passou a ser gerado dinamicamente em `/sitemap.xml` pelo endpoint já consolidado em `/api/core`.
- Produtos ativos são lidos diretamente do Supabase; produtos novos ou atualizados entram no sitemap sem exigir novo deploy, respeitando o cache configurado.
- O `lastmod` usa `updated_at` ou, como alternativa, `created_at`. Páginas fixas não recebem datas artificiais.
- `/planos-vip`, `/privacy.html` e `/terms.html` são as URLs canônicas incluídas no sitemap.
- `/vip`, rotas privadas e URLs antigas não são incluídas no sitemap.
- `/politica-de-privacidade` redireciona permanentemente para `/privacy.html`.
- `/termos` redireciona permanentemente para `/terms.html`.
- `/sob-encomenda` redireciona permanentemente para `/catalogo`.
- Páginas privadas recebem `noindex` tanto no React quanto pelo cabeçalho `X-Robots-Tag` da Vercel.
- As páginas estáticas de Política de Privacidade e Termos receberam descrição, canonical, Open Graph e Twitter Cards.
- Produtos pré-renderizados continuam sendo servidos diretamente. Produtos cadastrados depois do último deploy usam o fallback da aplicação e continuam acessíveis.
- URLs internas do ambiente de geração foram removidas do `package-lock.json` e substituídas pelo registro público do npm.

## Após publicar

1. Confirme que `https://www.cubocriativo3d.com.br/sitemap.xml` abre um XML.
2. No Google Search Console, envie novamente a URL `sitemap.xml`.
3. Teste os redirecionamentos antigos e as páginas privadas.

## Validações executadas

- 7 testes automatizados aprovados.
- Sintaxe dos arquivos JavaScript/MJS alterados aprovada.
- Sintaxe JSX de `src/App.jsx` aprovada.
- `vercel.json` e `package-lock.json` validados como JSON.
