const DEFAULTS = {
  title: 'Cubo Criativo',
  description:
    'Miniaturas em resina, pintura artística e peças colecionáveis. Promoções, catálogo e atendimento via WhatsApp para todo o Brasil.',
  image: '/images/logo.png',
  path: '/',
};

function ensureMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function applySeo(input = {}) {
  if (typeof document === 'undefined') return;
  const data = { ...DEFAULTS, ...input };
  document.title = data.title;

  ensureMeta('meta[name="description"]', { name: 'description', content: data.description });
  ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  ensureMeta('meta[property="og:title"]', { property: 'og:title', content: data.title });
  ensureMeta('meta[property="og:description"]', { property: 'og:description', content: data.description });
  ensureMeta('meta[property="og:image"]', { property: 'og:image', content: data.image });
  ensureMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'pt_BR' });
  ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: data.title });
  ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: data.description });
  ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: data.image });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  const origin = window.location.origin;
  canonical.setAttribute('href', `${origin}${data.path}`);
}
