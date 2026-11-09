import { writeFile } from 'node:fs/promises'
import brand from '../src/data/config.js'
import { legalDocuments, legalUpdated } from '../src/data/legal.js'
const escape = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
for (const key of ['privacy', 'terms']) {
  const doc = legalDocuments[key]
  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(doc.title)} | ${escape(brand.name)}</title>
<meta name="description" content="${escape(doc.intro)}"><meta name="robots" content="index,follow">
<link rel="canonical" href="https://www.cubocriativo3d.com.br${doc.path}">
<meta property="og:title" content="${escape(doc.title)} | ${escape(brand.name)}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:url" content="https://www.cubocriativo3d.com.br${doc.path}"><meta property="og:image" content="https://www.cubocriativo3d.com.br/images/logo.png">
<style>
*{box-sizing:border-box}body{margin:0;background:#07121c;color:#e5f7fb;font:16px/1.8 system-ui,sans-serif}main{max-width:920px;margin:auto;padding:32px 20px}a{color:#a5f3fc;overflow-wrap:anywhere}a:focus-visible{outline:2px solid #a5f3fc;outline-offset:4px}h1{font-size:clamp(26px,5vw,38px);line-height:1.3}h2{font-size:20px;line-height:1.5}p{color:#c7d7e4}section{padding:20px 0;border-top:1px solid #ffffff20;scroll-margin-top:20px}.muted{font-size:14px}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}nav a{display:inline-flex;align-items:center;min-height:44px}.summary{display:grid;gap:4px;background:#102131;padding:18px;border-radius:14px}button{font:inherit;padding:10px 16px;border:1px solid #a5f3fc;border-radius:8px;background:none;color:inherit;cursor:pointer}@media print{body{background:white;color:black}p,a{color:black}nav,button{display:none}main{max-width:none;padding:0}section{break-inside:avoid}h2{break-after:avoid}}
</style></head><body><main>
<nav aria-label="Navegação"><a href="/">Voltar ao site</a><a href="/contato">Contato</a></nav>
<h1>${escape(doc.title)}</h1><p class="muted">${escape(brand.name)} · CNPJ: ${escape(brand.cnpj)}<br>Última atualização: ${legalUpdated}</p>
<p>${escape(doc.intro)}</p>
<nav class="summary" aria-label="Nesta página">${doc.sections.map(([title], i) => `<a href="#secao-${i + 1}">${i + 1}. ${escape(title)}</a>`).join('')}</nav>
${doc.sections.map(([title, paragraphs], i) => `<section id="secao-${i + 1}"><h2>${i + 1}. ${escape(title)}</h2>${paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}</section>`).join('\n')}
<section><h2>Fale com a Cubo Criativo</h2><p><a href="mailto:${escape(brand.email)}">${escape(brand.email)}</a><br><a href="https://wa.me/${escape(brand.whatsapp)}" target="_blank" rel="noreferrer">WhatsApp: (77) 99847-2372</a><br>Segunda a sexta, das 09h às 18h · ${escape(brand.city)}</p></section>
<nav aria-label="Políticas da loja">${Object.entries(legalDocuments)
    .filter(([other]) => other !== key)
    .map(([, item]) => `<a href="${item.path}">${escape(item.title)}</a>`)
    .join('')}</nav>
<p class="muted">Para guardar esta versão, use a opção Imprimir ou Salvar como PDF do navegador.</p>
</main></body></html>`
  await writeFile(
    new URL(
      `../public/${key === 'privacy' ? 'privacy' : 'terms'}.html`,
      import.meta.url
    ),
    html
  )
}
console.log('[políticas] Páginas estáticas sincronizadas.')
