// src/App.jsx
import React from "react";
import brand from "./data/config";

// Componentes
import Modal from "./components/Modal.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import OrdersModal from "./components/OrdersModal.jsx";
import MenuDrawer from "./components/MenuDrawer.jsx";
import VipAreaModal from "./components/VipAreaModal.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import { useAuth } from "./auth/AuthProvider.jsx";
import { supabase } from "./lib/supabaseClient";

// Páginas
import HomePage from "./pages/HomePage.jsx";
import StockPage from "./pages/StockPage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PromocoesPage from "./pages/PromocoesPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import SobrePage from "./pages/SobrePage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import AdminOrdersPage from "./pages/AdminOrdersPage.jsx";
import FAQPage from "./pages/FAQPage.jsx";
import PoliticaPrivacidadePage from "./pages/PoliticaPrivacidadePage.jsx";
import TrocasPage from "./pages/TrocasPage.jsx";
import TermosPage from "./pages/TermosPage.jsx";
import CupomGamePage from "./pages/CupomGamePage.jsx";
import VipRpgPage from "./pages/VipRpgPage.jsx";
import VipRedirectPage from "./pages/VipRedirectPage.jsx";
import VipAreaPage from "./pages/VipAreaPage.jsx";
import PasswordResetPage from "./pages/PasswordResetPage.jsx";
import { fetchAdminStatus } from "./lib/admin.js";
import { applySeo, setJsonLd, clearJsonLd } from "./lib/seo.js";
import { trackEvent } from "./lib/analytics.js";

// (Removido) Modo RPG separado: agora as peças RPG vivem dentro do Catálogo.

/* ========================================================================
   HELPERS
   ======================================================================== */
const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";


/* ========================================================================
   SCROLL HELPERS
   ======================================================================== */
function scrollToTop() {
  if (typeof window === "undefined") return;

  // Evita que o browser restaure scroll automaticamente (muito comum no mobile).
  try {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  } catch {}

  // 1) Window (padrão)
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {}

  // 2) Fallbacks (alguns browsers/containers usam outro elemento como scroller)
  try {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {}

  // 3) Se existir algum container interno com scroll (ex.: #root)
  try {
    const rootEl = document.getElementById("root");
    if (rootEl && typeof rootEl.scrollTo === "function") rootEl.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {}
}


/* ========================================================================
   SUPABASE -> PRODUTOS (fonte de verdade)
   ======================================================================== */
const centsToBRL = (cents) =>
  typeof cents === "number" && isFinite(cents) ? Number((cents / 100).toFixed(2)) : 0;

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

function normalizeTextArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return [];
}

function normalizeImages(row) {
  const imgs = Array.isArray(row?.images) ? row.images.filter(Boolean).map(String) : [];
  const main = row?.image_url ? String(row.image_url) : "";
  if (imgs.length > 0) return imgs;
  return main ? [main] : [];
}

function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDescription(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  // alguns registros antigos ficaram com texto sentinela
  if (!s || s.toUpperCase() === "EMPTY") return "";
  return s;
}

function mapProductRow(row) {
  const variants = Array.isArray(row?.variants)
    ? row.variants
        .filter(Boolean)
        .map((v) => {
          const priceCents = toInt(v?.price_cents ?? 0);
          return {
            label: String(v?.label ?? ""),
            // compat: preço em BRL que o front já usa
            price: centsToBRL(priceCents),
            // novo: mantém centavos para cálculos (promo/variante)
            priceCents,
          };
        })
        .filter((v) => v.label)
    : [];

  const imgs = normalizeImages(row);
  const img = row?.image_url ? String(row.image_url) : imgs[0] || "";

  return {
    // campos no formato que o front já usa
    id: String(row?.id ?? ""),
    slug: row?.slug ? String(row.slug) : slugifyName(row?.name),
    nome: row?.name ? String(row.name) : "",
    // Mantém compatibilidade com o front (campo "descricao"), mas vem do Supabase ("description")
    descricao: normalizeDescription(row?.description),
    img,
    imgs,
    status: row?.status ? String(row.status) : "catalogo",
    featured: !!row?.featured,
    promo: !!row?.promo,
    originalPrice: centsToBRL(toInt(row?.original_price_cents ?? 0)),
    preco: centsToBRL(toInt(row?.price_cents ?? 0)),
    // novo: mantém centavos para promo/variante
    originalPriceCents: toInt(row?.original_price_cents ?? 0),
    priceCents: toInt(row?.price_cents ?? 0),
    currency: row?.currency ? String(row.currency) : "brl",
    // stock:
    // - null/undefined => sem controle de estoque (não bloquear compra)
    // - number        => controlar disponibilidade (0 => esgotado)
    stock:
      row?.stock === null || row?.stock === undefined
        ? null
        : (() => {
            const n = Number(row.stock);
            return Number.isFinite(n) ? Math.trunc(n) : null;
          })(),
    active: row?.active !== false,
    tags: normalizeTextArray(row?.tags),
    category: row?.category ? String(row.category) : "",
    defaultVariant: row?.default_variant ? String(row.default_variant) : "",
    variants,
  };
}

function Toast({ open, children }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 ${
        open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      <div className="container-cc rounded-full bg-gradient-to-r from-amber-300 via-amber-200 to-orange-200 text-[#241208] font-semibold px-4 py-2 shadow-lg ring-4 ring-amber-400/20">
        {children}
      </div>
    </div>
  );
}



function buildProductSchemaList({ products = [], route = "/", listName = "Produtos" }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const visible = (Array.isArray(products) ? products : []).filter(Boolean).slice(0, 24);
  if (!visible.length) return null;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    itemListOrder: "https://schema.org/ItemListUnordered",
    numberOfItems: visible.length,
    itemListElement: visible.map((p, idx) => {
      const price = Number.isFinite(p?.preco) ? p.preco : 0;
      const image = p?.img ? (String(p.img).startsWith("http") ? p.img : `${origin}${p.img}`) : undefined;
      const inStock = typeof p?.stock === "number" ? p.stock > 0 : true;
      const category = p?.category || (Array.isArray(p?.tags) && p.tags[0]) || "Miniatura";
      // Rotas sem hash (history API)
      const urlPath = route === "/" ? `/catalogo` : `${route}`;
      return {
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Product",
          name: String(p?.nome || "Produto"),
          description: String(p?.descricao || "Miniatura em resina e pintura artística."),
          image: image ? [image] : undefined,
          sku: String(p?.id || idx + 1),
          category,
          brand: { "@type": "Brand", name: "Cubo Criativo" },
          offers: {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: Number(price.toFixed ? price.toFixed(2) : price),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `${origin}${urlPath}`,

            // Campos opcionais recomendados pelo Google (Rich Results)
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingDestination: {
                "@type": "DefinedRegion",
                addressCountry: "BR",
              },
              // Ajuste se você cobrar frete. Mantido como 0 para não gerar aviso.
              shippingRate: {
                "@type": "MonetaryAmount",
                value: "0",
                currency: "BRL",
              },
              deliveryTime: {
                "@type": "ShippingDeliveryTime",
                handlingTime: {
                  "@type": "QuantitativeValue",
                  minValue: 1,
                  maxValue: 3,
                  unitCode: "d",
                },
                transitTime: {
                  "@type": "QuantitativeValue",
                  minValue: 2,
                  maxValue: 10,
                  unitCode: "d",
                },
              },
            },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "BR",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 7,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: "https://schema.org/FreeReturn",
            },
          }
        }
      };
    })
  };

  // remove undefined recursivo leve
  const clean = (obj) => {
    if (Array.isArray(obj)) return obj.map(clean).filter((v) => v !== undefined);
    if (obj && typeof obj === "object") {
      return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, clean(v)]).filter(([,v]) => v !== undefined));
    }
    return obj;
  };
  return clean(itemList);
}

function buildProductSchema({ product, path = "/" }) {
  if (!product) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const price = Number.isFinite(product?.preco) ? product.preco : 0;
  const image = product?.img
    ? String(product.img).startsWith("http")
      ? product.img
      : `${origin}${product.img}`
    : undefined;
  const inStock = typeof product?.stock === "number" ? product.stock > 0 : true;
  const category = product?.category || (Array.isArray(product?.tags) && product.tags[0]) || "Miniatura";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: String(product?.nome || "Produto"),
    description: String(product?.descricao || "Miniatura em resina e pintura artística."),
    image: image ? [image] : undefined,
    sku: String(product?.id || ""),
    category,
    brand: { "@type": "Brand", name: "Cubo Criativo" },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: Number(price.toFixed ? price.toFixed(2) : price),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${origin}${path}`,
    },
  };
}

function getRouteFromHash() {
  const h = window.location.hash || "";
  // Aceita: #/ , #/estoque, #/catalogo, #/conta
  if (!h.startsWith("#/")) return "/";
  const raw = h.slice(1); // remove '#'
  const path = raw.split("?")[0]; // remove query
  return path || "/";
}

function normalizePathname(pathname) {
  const p = String(pathname || "/");
  if (!p || p === "/index.html") return "/";
  // remove trailing slash exceto raiz
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function getRouteFromLocation() {
  // Preferimos rotas limpas (sem #). Mantemos fallback do hash se existir.
  const h = typeof window !== "undefined" ? String(window.location.hash || "") : "";
  if (h.startsWith("#/")) {
    const raw = h.slice(1);
    const path = raw.split("?")[0];
    return path || "/";
  }
  return normalizePathname(typeof window !== "undefined" ? window.location.pathname : "/");
}

/* ========================================================================
   APP
   ======================================================================== */
export default function App() {
  const { user, session, signOut, isPasswordRecovery, needsGoogleTermsAcceptance } = useAuth();
  const accessToken = session?.access_token || "";
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isAdminLoading, setIsAdminLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    if (!accessToken) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return () => {
        alive = false;
      };
    }

    setIsAdminLoading(true);

    (async () => {
      try {
        const result = await fetchAdminStatus(accessToken);
        if (alive) setIsAdmin(Boolean(result?.isAdmin));
      } catch {
        if (alive) setIsAdmin(false);
      } finally {
        if (alive) setIsAdminLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [accessToken]);

  // VIP (best-effort) via cache local para evitar flashes no menu.
// IMPORTANTE: o cache pode ficar "stale" se um pagamento falhar/cancelar.
// Por isso, validamos via /api/profile ao iniciar sessão e limpamos o cache quando não for VIP.
const getVipCached = () => {
  try {
    if (!accessToken) return false;
    const raw = String(window?.localStorage?.getItem('vip_until_cache') || '');
    if (!raw) return false;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) && d > new Date();
  } catch {
    return false;
  }
};

const [isVip, setIsVip] = React.useState(() => getVipCached());

React.useEffect(() => {
  // Deslogado: zera e limpa cache
  if (!accessToken) {
    setIsVip(false);
    try { window.localStorage.removeItem('vip_until_cache'); } catch {}
    return;
  }

  let alive = true;

  (async () => {
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => ({}));
      const p = data?.profile || {};
      const vipUntil = p?.vip_until ? String(p.vip_until) : '';
      const vipOk = vipUntil && new Date(vipUntil) > new Date();

      try {
        if (vipOk) window.localStorage.setItem('vip_until_cache', vipUntil);
        else window.localStorage.removeItem('vip_until_cache');
      } catch {}

      if (alive) setIsVip(Boolean(vipOk));
    } catch {
      // Se falhar, mantém o que está no cache (best-effort)
      if (alive) setIsVip(getVipCached());
    }
  })();

  return () => { alive = false; };
}, [accessToken]);

  // UI
  const [trustOpen, setTrustOpen] = React.useState(false);

  // ===== Rotas (history API sem dependências) =====
  const [route, setRoute] = React.useState(() => (typeof window === "undefined" ? "/" : getRouteFromLocation()));
  const pendingScroll = React.useRef(null);
  const lastAutoOpenedProductRef = React.useRef("");

  React.useEffect(() => {
    const onPop = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", onPop);
    // compat: links antigos com hash
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

  React.useEffect(() => {
    const seoByRoute = {
      "/": { title: "Cubo Criativo", description: "Action figures, miniaturas de RPG, colecionáveis e peças em resina com pintura artística. Promoções, catálogo e encomendas com envio para todo o Brasil.", path: "/" },
      "/estoque": { title: "Em estoque | Cubo Criativo", description: "Action figures e miniaturas colecionáveis prontas para envio, com rastreio e embalagem reforçada.", path: "/estoque" },
      "/catalogo": { title: "Catálogo | Cubo Criativo", description: "Catálogo de action figures, miniaturas de RPG e colecionáveis em resina com pintura artística.", path: "/catalogo" },
      "/promocoes": { title: "Promoções | Cubo Criativo", description: "Ofertas em action figures, miniaturas de RPG e colecionáveis: descontos por tempo limitado.", path: "/promocoes" },
      "/contato": { title: "Contato | Cubo Criativo", description: "Atendimento via WhatsApp e e-mail para suporte, orçamento e pedidos.", path: "/contato" },
      "/sobre": { title: "Sobre nós | Cubo Criativo", description: "Conheça a Cubo Criativo e nosso trabalho com miniaturas e peças personalizadas.", path: "/sobre" },
      "/faq": { title: "FAQ | Cubo Criativo", description: "Perguntas frequentes sobre prazos, envio, pagamento e cuidados com as peças.", path: "/faq" },
      "/politica-de-privacidade": { title: "Política de Privacidade | Cubo Criativo", description: "Como tratamos seus dados para cadastro, pagamento, envio e suporte.", path: "/politica-de-privacidade" },
      "/trocas-e-devolucoes": { title: "Trocas e devoluções | Cubo Criativo", description: "Informações sobre trocas, devoluções e peças sob encomenda.", path: "/trocas-e-devolucoes" },
      "/termos": { title: "Termos de uso | Cubo Criativo", description: "Condições gerais de navegação e compra no site da Cubo Criativo.", path: "/termos" },
      "/cupom": { title: "Cubo Game | Cubo Criativo", description: "Jogue 1x por semana no Cubo Game e ganhe cupom para usar no carrinho.", path: "/cupom" },
      "/vip": { title: "Clube VIP | Cubo Criativo", description: "Acesse a Área VIP ou confira os planos do Clube VIP.", path: "/vip" },
      "/planos-vip": { title: "Planos VIP | Cubo Criativo", description: "Assine o Clube VIP e escolha miniaturas mensais, vote no tema e acompanhe seu ciclo.", path: "/planos-vip" },
      "/area-vip": { title: "Área VIP | Cubo Criativo", description: "Escolha suas miniaturas do ciclo, vote no tema e acompanhe o status do seu pedido VIP.", path: "/area-vip" },
      "/perfil": { title: "Minha conta | Cubo Criativo", description: "Edite seu perfil, endereço e dados para compra.", path: "/perfil" },
      "/configuracoes": { title: "Configurações | Cubo Criativo", description: "Segurança, favoritos, avaliações e cupons.", path: "/configuracoes" },
      "/redefinir-senha": { title: "Redefinir senha | Cubo Criativo", description: "Defina uma nova senha com segurança a partir do link enviado ao seu e-mail.", path: "/redefinir-senha" },
    };
    // Rotas dinâmicas (/p/:slug) são tratadas em um effect separado para SEO + schema.
    if (String(route || "").startsWith("/p/")) {
      trackEvent("page_view", { route });
      return;
    }
    applySeo(seoByRoute[route] || seoByRoute["/"]);
    trackEvent("page_view", { route });
  }, [route]);

  // Garante que ao navegar para outra aba/página o usuário comece do topo.
// (Alguns cliques usam links normais/popstate e o browser manteria o scroll.)
React.useEffect(() => {
  if (typeof window === "undefined") return;

  // Faz o scroll depois do repaint da nova rota (mais confiável em mobile),
  // e repete em seguida para neutralizar "scroll restoration" em alguns browsers.
  requestAnimationFrame(() => scrollToTop());
  setTimeout(() => scrollToTop(), 50);
}, [route]);


  function navigate(path) {
    const normalized = path?.startsWith("/") ? path : `/${path || ""}`;
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", normalized);
      // mantemos o estado de rota somente como pathname
      try {
        const u = new URL(normalized, window.location.origin);
        setRoute(normalizePathname(u.pathname));
      } catch {
        setRoute(normalizePathname(normalized.split("?")[0]));
      }
      // Mantém consistente com o scroll-to-top global (sem animação).
      scrollToTop();
    }
  }

  function openSettings(tab = 'profile', opts = {}) {
    const t = tab === 'settings' ? 'settings' : 'profile';
    setSettingsCtx({
      returnTo: String(opts?.returnTo || route || "/"),
      autoClose: Boolean(opts?.autoClose),
    });
    navigate(t === 'settings' ? '/configuracoes' : '/perfil');
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // header sticky: dá um respiro
    const top = el.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function goHomeSection(id) {
    if (route !== "/") {
      pendingScroll.current = id;
      navigate("/");
      return;
    }
    scrollToId(id);
  }

  React.useEffect(() => {
    if (!pendingScroll.current) return;
    // espera render do Home
    const id = pendingScroll.current;
    pendingScroll.current = null;
    setTimeout(() => scrollToId(id), 0);
  }, [route]);

  // ===== UI =====
  React.useEffect(() => {
    if (!isPasswordRecovery) return;
    if (route === "/redefinir-senha") return;
    navigate("/redefinir-senha");
  }, [isPasswordRecovery, route]);

  React.useEffect(() => {
    if (!needsGoogleTermsAcceptance) return;
    setAuthOpen(true);
  }, [needsGoogleTermsAcceptance]);

  const [authOpen, setAuthOpen] = React.useState(false);
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  // Configurações/Perfil agora são PÁGINA (não modal)
  const [settingsCtx, setSettingsCtx] = React.useState({ returnTo: "/", autoClose: false });
  const [vipAreaOpen, setVipAreaOpen] = React.useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = React.useState(false);

  // ===== Carrinho =====
  const CART_STORAGE_KEY = "cc_cart_v1";
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cart, setCart] = React.useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [cartBounce, setCartBounce] = React.useState(false);
  const [toastOpen, setToastOpen] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState("Adicionado!");
  const bounceT = React.useRef(null);
  const toastT = React.useRef(null);
  // evita toasts repetidos ao lidar com retorno do pagamento (URL params)
  const paymentReturnRef = React.useRef({ key: "", notified: false });

  // ===== Auth gate (padrão) =====
  const requireLogin = React.useCallback(
    (msg = "Faça login para continuar.") => {
      setToastMsg(msg);
      setToastOpen(true);
      setAuthOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 2400);
      trackEvent?.("auth_required", { message: msg });
    },
    []
  );


  // Persiste carrinho (mantém itens após recarregar)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // ===== Pagamento (Mercado Pago Checkout Pro + Pix) =====
  const [paying, setPaying] = React.useState(false);

  // ===== Galeria =====
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [galleryData, setGalleryData] = React.useState({ title: "", imgs: [] });
  const [galleryIndex, setGalleryIndex] = React.useState(0);
  // mantém o tamanho do card estável durante a troca de imagens
  const [galleryLoadedSrc, setGalleryLoadedSrc] = React.useState("");
  const [galleryIsLoading, setGalleryIsLoading] = React.useState(false);

  
  // Pré-carrega a imagem alvo e mostra a anterior (com blur + loader) até terminar,
  // evitando o "pulo" de layout quando a imagem ainda não carregou.
  React.useEffect(() => {
    if (!galleryOpen) return;
    const target = galleryData?.imgs?.[galleryIndex];
    if (!target) return;

    // se já está mostrando essa imagem, não precisa "piscar" loader
    if (target === galleryLoadedSrc) {
      setGalleryIsLoading(false);
      return;
    }

    let cancelled = false;
    setGalleryIsLoading(true);

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      setGalleryLoadedSrc(target);
      setGalleryIsLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      // mesmo em erro, tenta renderizar o src para mostrar fallback do navegador
      setGalleryLoadedSrc(target);
      setGalleryIsLoading(false);
    };
    img.src = target;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [galleryOpen, galleryIndex, galleryData?.imgs, galleryLoadedSrc]);

React.useEffect(() => {
    return () => {
      clearTimeout(bounceT.current);
      clearTimeout(toastT.current);
    };
  }, []);

  const isOutOfStock = React.useCallback((p) => {
    const s = p?.stock;
    // Só bloqueia se o estoque estiver definido (number).
    // Se stock for null => sem controle de estoque.
    return typeof s === "number" && Number.isFinite(s) && s <= 0;
  }, []);

  function addToCart(p, { escala, unitPrice } = {}) {
    if (isOutOfStock(p)) {
      clearTimeout(toastT.current);
      setToastMsg("Esgotado");
      setToastOpen(true);
      toastT.current = setTimeout(() => setToastOpen(false), 1600);
      return;
    }
    const price = typeof unitPrice === "number" ? unitPrice : p.preco || 0;
    const scale = escala || p.escala || "";

    trackEvent("add_to_cart", { product_id: p?.id, product_name: p?.nome, escala: scale, price });

    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id && i.escala === scale && i.unitPrice === price);
      if (found) {
        return prev.map((i) =>
          i.id === p.id && i.escala === scale && i.unitPrice === price ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...p, qty: 1, unitPrice: price, escala: scale }];
    });

    clearTimeout(bounceT.current);
    setCartBounce(true);
    bounceT.current = setTimeout(() => setCartBounce(false), 700);

    clearTimeout(toastT.current);
    setToastMsg("Adicionado!");
    setToastOpen(true);
    toastT.current = setTimeout(() => setToastOpen(false), 1400);
  }

  function buyNow(p, { escala, unitPrice } = {}) {
    if (isOutOfStock(p)) {
      clearTimeout(toastT.current);
      setToastMsg("Esgotado");
      setToastOpen(true);
      toastT.current = setTimeout(() => setToastOpen(false), 1600);
      return;
    }
    const price = typeof unitPrice === "number" ? unitPrice : p.preco || 0;
    const scale = escala || p.escala || "";
    trackEvent("buy_now_click", { product_id: p?.id, product_name: p?.nome, escala: scale, price });
    setCart([{ ...p, qty: 1, unitPrice: price, escala: scale }]);
    setCartOpen(true);
  }

  function updateQty(id, delta, escala, unitPrice) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id && i.escala === escala && i.unitPrice === unitPrice
            ? { ...i, qty: Math.max(1, i.qty + delta) }
            : i
        )
        .filter((i) => i.qty > 0)
    );
  }

  function removeItem(id, escala, unitPrice) {
    setCart((prev) => prev.filter((i) => !(i.id === id && i.escala === escala && i.unitPrice === unitPrice)));
  }

  const subtotal = cart.reduce((s, i) => s + (i.unitPrice || i.preco || 0) * i.qty, 0);
  const waMsg = React.useMemo(() => {
    const linhas = cart.map(
      (i) =>
        `• ${i.nome}${i.escala ? ` (${i.escala})` : ""} x${i.qty} — ${fmtBRL((i.unitPrice || i.preco || 0) * i.qty)}`
    );
    const totalTxt = subtotal > 0 ? `\nTotal: ${fmtBRL(subtotal)}` : "";
    return encodeURIComponent(`Olá! Quero finalizar meu pedido:\n${linhas.join("\n")}${totalTxt}\n\nPagamento: combinar via WhatsApp.`);
  }, [cart, subtotal]);

// Detecta retorno do Mercado Pago (Checkout Pro) e mostra feedback.
// IMPORTANTE: "success" pode ocorrer antes do webhook marcar como paid,
// então aqui fazemos uma checagem rápida pelo order_id (quando disponível).
React.useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const provider = params.get("provider");
  const orderId = params.get("order_id");

  if (!payment) return;

  const cleanupUrl = () => {
    params.delete("payment");
    params.delete("provider");
    params.delete("order_id");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  };

  const key = `${payment || ""}|${provider || ""}|${orderId || ""}`;
  if (paymentReturnRef.current.key !== key) {
    paymentReturnRef.current.key = key;
    paymentReturnRef.current.notified = false;
  }

  const showOnce = (msg, ms = 2400) => {
    if (paymentReturnRef.current.notified) return;
    paymentReturnRef.current.notified = true;
    setToastMsg(msg);
    setToastOpen(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastOpen(false), ms);
  };

  const pollOrderPaid = async (id) => {
    // tenta por ~20s (webhook pode atrasar)
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("id", id)
        .maybeSingle();

      if (!error && data?.status === "paid") return true;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  (async () => {
    try {
      if (payment === "cancel") {
        showOnce("Pagamento cancelado.");
        cleanupUrl();
        return;
      }

      if (payment === "pending") {
        showOnce("Pagamento em processamento. Acompanhe em Meus pedidos.");
        cleanupUrl();
        return;
      }

      if (payment === "success") {
        // Checkout Pro pode redirecionar antes do webhook marcar como paid.
        // Se temos order_id, confirmamos no Supabase e só então limpamos o carrinho.
        if (provider === "mercadopago" && orderId) {
          const paid = await pollOrderPaid(orderId);
          if (paid) {
            trackEvent("payment_confirmed", { provider: "mercadopago", order_id: orderId });
            setCart([]);
            setCartOpen(false);
            showOnce("✅ Pedido finalizado!");
            cleanupUrl();
            return;
          }

          // Se ainda não confirmou e o usuário não está pronto, mantemos a URL
          // para tentar novamente quando o auth hidratar.
          if (!user) {
            showOnce("Confirmando pagamento… faça login para finalizar.");
            setAuthOpen(true);
            return;
          }

          // Usuário já logado, mas ainda não marcou como paid dentro do timeout.
          showOnce("Pagamento recebido, confirmando… Veja em Meus pedidos.");
          cleanupUrl();
          return;
        }

        // fallback (sem order_id): considera como sucesso e limpa o carrinho
        trackEvent("payment_confirmed", { provider: provider || "unknown" });
        setCart([]);
        setCartOpen(false);
        showOnce("✅ Pagamento confirmado!");
        cleanupUrl();
      }
    } catch {
      cleanupUrl();
    }
  })();
}, [user]);


  async function ensureProfileCompleteForCheckout() {
    if (!user) return false;
    try {
      const resp = await fetch("/api/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const data = await resp.json().catch(() => ({}));
      const p = data?.profile || {};
      const requiredFields = [
        "full_name",
        "phone",
        "zip",
        "city",
        "state",
        "neighborhood",
        "address_line1",
        "address_number",
        "cpf",
        "birthdate",
      ];
      const missing = requiredFields.filter((k) => !String(p?.[k] || "").trim());
      if (missing.length) {
        setToastMsg("Preencha seus dados para finalizar o pagamento.");
        setToastOpen(true);
        clearTimeout(toastT.current);
        toastT.current = setTimeout(() => setToastOpen(false), 2600);
        openSettings('profile');
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      setToastMsg("Não foi possível validar seus dados. Abra Configurações e tente novamente.");
      setToastOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 3000);
      openSettings('profile');
      return false;
    }
  }

  async function startCheckout(appliedCoupon = null) {
    if (!user) {
      requireLogin("Faça login para pagar.");
      return;
    }
    if (!cart.length) return;
    if (!(subtotal > 0)) {
      setToastMsg("Defina os preços antes de pagar.");
      setToastOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 2200);
      return;
    }

    const okProfile = await ensureProfileCompleteForCheckout();
    if (!okProfile) return;

    try {
      setPaying(true);
      const resp = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          coupon_code: appliedCoupon?.code || null,
          items: cart.map((i) => ({
            id: i.id,
            name: i.nome,
            scale: i.escala,
            qty: i.qty,
            price: i.unitPrice || i.preco || 0,
            img: i.img,
          })),
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (data?.code === "profile_incomplete") {
          setToastMsg("Complete seus dados para finalizar o pagamento.");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 2600);
          openSettings('profile');
          return;
        }
        throw new Error(data?.error || "Não foi possível iniciar o pagamento.");
      }
      if (!data?.url) throw new Error("Não foi possível iniciar o pagamento.");
      trackEvent("checkout_started", { items: cart.length, subtotal, coupon_code: appliedCoupon?.code || null });
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setToastMsg(e?.message || "Erro ao iniciar pagamento.");
      setToastOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 2600);
    } finally {
      setPaying(false);
    }
  }

  function openGallery(p) {
    const imgs = Array.isArray(p.imgs) && p.imgs.length > 0 ? p.imgs : [p.img];
    setGalleryData({ title: p.nome, imgs });
    setGalleryIndex(0);
    // mostra algo imediatamente (se já estiver em cache, melhor ainda)
    setGalleryLoadedSrc(imgs?.[0] || "");
    setGalleryIsLoading(false);
    setGalleryOpen(true);
  }

  function prevImage() {
    setGalleryIndex((i) => (i - 1 + galleryData.imgs.length) % galleryData.imgs.length);
  }
  function nextImage() {
    setGalleryIndex((i) => (i + 1) % galleryData.imgs.length);
  }

  // Swipe (toque/arrasto) na galeria, estilo carrossel (sem autoplay)
  const swipeRef = React.useRef({ x: 0, y: 0, active: false, dx: 0, dy: 0 });
  const SWIPE_MIN_PX = 48;

  function onGalleryTouchStart(e) {
    const t = e.touches?.[0];
    if (!t) return;
    swipeRef.current = { x: t.clientX, y: t.clientY, active: true, dx: 0, dy: 0 };
  }

  function onGalleryTouchMove(e) {
    const t = e.touches?.[0];
    if (!t || !swipeRef.current.active) return;
    swipeRef.current.dx = t.clientX - swipeRef.current.x;
    swipeRef.current.dy = t.clientY - swipeRef.current.y;
  }

  function onGalleryTouchEnd() {
    const { dx, dy } = swipeRef.current;
    swipeRef.current.active = false;
    // só considera swipe horizontal predominante
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextImage();
    else prevImage();
  }

  function onGalleryPointerDown(e) {
    // suporte a arrasto no desktop
    swipeRef.current = { x: e.clientX, y: e.clientY, active: true, dx: 0, dy: 0 };
  }

  function onGalleryPointerMove(e) {
    if (!swipeRef.current.active) return;
    swipeRef.current.dx = e.clientX - swipeRef.current.x;
    swipeRef.current.dy = e.clientY - swipeRef.current.y;
  }

  function onGalleryPointerUp() {
    const { dx, dy } = swipeRef.current;
    swipeRef.current.active = false;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextImage();
    else prevImage();
  }

  // Bloqueia scroll do body quando overlays estão abertos
  React.useEffect(() => {
    const onOrderPaid = () => {
      setCart([]);
      setCartOpen(false);
      setToastMsg("✅ Pedido finalizado!");
      setToastOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 2400);
    };
    window.addEventListener("order:paid", onOrderPaid);
    return () => window.removeEventListener("order:paid", onOrderPaid);
  }, []);

  React.useEffect(() => {
    const anyOverlayOpen = cartOpen || galleryOpen || authOpen || ordersOpen || menuDrawerOpen;
    document.body.style.overflow = anyOverlayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, galleryOpen, authOpen, ordersOpen, menuDrawerOpen]);

  // fecha menu lateral quando muda rota
  React.useEffect(() => {
    setMenuDrawerOpen(false);
  }, [route]);


  // ===== Produtos (vem do Supabase) =====
  const [products, setProducts] = React.useState([]);
  const [productsLoading, setProductsLoading] = React.useState(true);
  const [productsError, setProductsError] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setProductsLoading(true);
        setProductsError("");

        const { data, error } = await supabase
          .from("products")
          .select(
	            "id,slug,name,description,price_cents,currency,stock,active,featured,promo,image_url,images,status,tags,default_variant,variants,original_price_cents,category,created_at,sort_order"
          )
          .eq("active", true)
	          // Ordem manual (sort_order) + fallback para mais novos primeiro
	          .order("sort_order", { ascending: true, nullsFirst: false })
	          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map(mapProductRow).filter((p) => p.id && p.nome);
        if (alive) setProducts(mapped);
      } catch (e) {
        console.error(e);
        if (alive) {
          setProducts([]);
          setProductsError(e?.message || "Não foi possível carregar os produtos.");
        }
      } finally {
        if (alive) setProductsLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);


  React.useEffect(() => {
    if (route !== "/catalogo") return;
    if (productsLoading || !Array.isArray(products) || products.length === 0) return;

    const productKey = new URLSearchParams(window.location.search || "").get("produto");
    const key = String(productKey || "").trim();
    if (!key) return;
    if (lastAutoOpenedProductRef.current === key) return;

    const found = products.find((p) => String(p.id || "") === key || String(p.slug || "") === key);
    if (!found) return;

    lastAutoOpenedProductRef.current = key;
    openGallery(found);
  }, [route, productsLoading, products]);

  // ===== Classificação (tipo + disponibilidade) =====
  const classifyProduct = React.useCallback((p) => {
    const cat = String(p?.category || "").toLowerCase();
    const tags = Array.isArray(p?.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
    const name = String(p?.nome || "").toLowerCase();

    const isRpg = cat === "rpg" || tags.includes("rpg") || tags.some((t) => t.startsWith("classe:") || t.startsWith("raça:") || t.startsWith("raca:"));
    const isStock = String(p?.status || "").toLowerCase() === "estoque";

    const tagBlob = `${tags.join(" ")} ${cat} ${name}`;
    const isActionFigure =
      tagBlob.includes("action figure") ||
      tagBlob.includes("figure action") ||
      tagBlob.includes("action-figure") ||
      cat.includes("action") ||
      tagBlob.includes("figure");

    const typeLabel = isRpg ? "Miniatura RPG" : isActionFigure ? "Action Figure" : "Colecionável";
    const availabilityLabel = isStock ? "Pronta entrega" : "Sob encomenda";
    const leadTimeLabel = isStock ? "" : "15–30 dias úteis";

    return {
      ...p,
      _isRpg: isRpg,
      _isStock: isStock,
      _typeLabel: typeLabel,
      _availabilityLabel: availabilityLabel,
      _leadTimeLabel: leadTimeLabel,
    };
  }, []);

  const allCatalogItems = React.useMemo(() => products.map(classifyProduct), [products, classifyProduct]);

  const prontaEntrega = React.useMemo(() => allCatalogItems.filter((p) => String(p?.status || "").toLowerCase() === "estoque"), [allCatalogItems]);
  const catalogoItems = React.useMemo(() => allCatalogItems.filter((p) => String(p?.status || "catalogo").toLowerCase() === "catalogo"), [allCatalogItems]);
  const rpgSobEncomenda = React.useMemo(
    () => catalogoItems.filter((p) => p._isRpg),
    [catalogoItems]
  );

  const featured = React.useMemo(() => {
    // Destaques controlados exclusivamente por `featured` (Supabase).
    const explicit = allCatalogItems.filter((p) => p.featured === true);
    // opcional: mantém uma ordem estável (mais recentes primeiro)
    explicit.sort((a, b) => {
      const ta = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
    return explicit.slice(0, 8);
  }, [allCatalogItems]);

  const promocoes = React.useMemo(() => {
    const promos = products.filter((p) => p.promo === true);
    // ordena por maior desconto (quando houver), senão mais recente
    promos.sort((a, b) => {
      const aCur = (a.variants?.[0]?.price ?? a.preco) || 0;
      const bCur = (b.variants?.[0]?.price ?? b.preco) || 0;
      const aOrig = a.originalPrice || 0;
      const bOrig = b.originalPrice || 0;
      const aOff = aOrig > aCur && aOrig > 0 ? (aOrig - aCur) / aOrig : 0;
      const bOff = bOrig > bCur && bOrig > 0 ? (bOrig - bCur) / bOrig : 0;
      if (aOff !== bOff) return bOff - aOff;
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    return promos;
  }, [products]);

  // (RPG agora faz parte do catálogo; mantemos apenas a lista para vitrine na Home)

  React.useEffect(() => {
    let listName = '';
    let source = [];
    if (route === "/") {
      listName = 'Destaques Cubo Criativo';
      source = featured;
    } else if (route === "/estoque") {
      listName = 'Pronta entrega — Cubo Criativo';
      source = prontaEntrega;
    } else if (route === "/catalogo") {
      listName = 'Catálogo — Action figures, miniaturas de RPG e colecionáveis';
      source = catalogoItems;
    } else if (route === "/promocoes") {
      listName = 'Promoções de miniaturas';
      source = promocoes;
    }

    const payload = buildProductSchemaList({ products: source, route, listName });
    if (payload) setJsonLd('seo-product-list', payload);
    else clearJsonLd('seo-product-list');

    return () => {
      // limpa quando trocar para rotas institucionais/conta/admin
    };
  }, [route, featured, prontaEntrega, catalogoItems, promocoes]);

  // ===== SEO + Schema para página de produto (/p/:slug) =====
  React.useEffect(() => {
    const r = String(route || "");
    if (!r.startsWith("/p/")) {
      clearJsonLd("seo-product");
      return;
    }

    const slug = r.slice(3).split("?")[0];
    const found = products.find((p) => String(p?.slug || "") === String(slug));

    if (!found) {
      applySeo({
        title: "Produto | Cubo Criativo",
        description:
          "Action figures, miniaturas de RPG e colecionáveis em resina com pintura artística. Confira detalhes e promoções.",
        path: r,
      });
      clearJsonLd("seo-product");
      return;
    }

    const descRaw = String(found?.descricao || "").replace(/\s+/g, " ").trim();
    const desc = descRaw
      ? descRaw.slice(0, 155)
      : "Miniatura em resina com pintura artística. Peça colecionável com envio para todo o Brasil.";

    applySeo({
      title: `${found.nome} | Cubo Criativo`,
      description: desc,
      image: found?.img || "/images/logo.png",
      path: `/p/${found.slug}`,
    });

    const payload = buildProductSchema({ product: found, path: `/p/${found.slug}` });
    if (payload) setJsonLd("seo-product", payload);
    else clearJsonLd("seo-product");
  }, [route, products]);

  // ===== Render da página =====
  const page = (() => {
    if (String(route || "").startsWith("/p/")) {
      let slug = String(route || "").slice(3).split("?")[0];
      try { slug = decodeURIComponent(slug); } catch {}
      const found = products.find((p) => String(p?.slug || "") === String(slug));
      return (
        <ProductPage
          slug={slug}
          product={found}
          loading={productsLoading}
          onBack={() => {
            try {
              if (window.history.length > 1) window.history.back();
              else navigate("/catalogo");
            } catch {
              navigate("/catalogo");
            }
          }}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
        />
      );
    }
    if (route === "/admin") {
      return <AdminOrdersPage user={user} accessToken={accessToken} isAdmin={isAdmin} isAdminLoading={isAdminLoading} onNavigateHome={() => navigate("/")} onRequireLogin={requireLogin} />;
    }
    if (route === "/promocoes") {
      return (
        <PromocoesPage
          items={promocoes}
          loading={productsLoading}
          error={productsError}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
          onGoHome={() => navigate("/")}
        />
      );
    }
    if (route === "/estoque") {
      return (
        <StockPage
          items={prontaEntrega}
          loading={productsLoading}
          error={productsError}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
        
          onRequireLogin={(msg) => requireLogin(msg)}
        />
      );
    }
    if (route === "/catalogo") {
      return (
        <CatalogPage
          items={catalogoItems}
          loading={productsLoading}
          error={productsError}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
        
          onRequireLogin={(msg) => requireLogin(msg)}
        />
      );
    }
    if (route === "/sob-encomenda") {
      navigate("/catalogo");
      return null;
    }
    if (route === "/sobre") {
      return <SobrePage onGoHome={() => navigate("/")} />;
    }
    if (route === "/contato") {
      return <ContactPage onGoHome={() => navigate("/")} onGoFaq={() => navigate("/faq")} onGoPoliticas={() => navigate("/politica-de-privacidade")} />;
    }
    if (route === "/faq") {
      return <FAQPage onGoHome={() => navigate("/")} />;
    }
    if (route === "/politica-de-privacidade") {
      return <PoliticaPrivacidadePage onGoHome={() => navigate("/")} />;
    }
    if (route === "/trocas-e-devolucoes") {
      return <TrocasPage onGoHome={() => navigate("/")} />;
    }
    if (route === "/termos") {
      return <TermosPage onGoHome={() => navigate("/")} />;
    }
    if (route === "/cupom") {
      return <CupomGamePage onGoHome={() => navigate("/")} user={user} accessToken={accessToken} onRequireLogin={requireLogin} />;
    }
    if (route === "/vip") {
      // Rota inteligente: VIPs vão direto pra Área VIP, não-VIPs vão para /planos-vip.
      return <VipRedirectPage user={user} accessToken={accessToken} onNavigate={navigate} onOpenAuth={() => setAuthOpen(true)} />;
    }
    if (route === "/planos-vip") {
      return <VipRpgPage user={user} accessToken={accessToken} onOpenAuth={() => setAuthOpen(true)} onOpenSettings={openSettings} onOpenVipArea={() => navigate("/area-vip")} onGoHome={() => navigate("/")} />;
    }
    if (route === "/area-vip") {
      return <VipAreaPage onGoHome={() => navigate("/")} onGoVip={() => navigate("/planos-vip")} onRequireLogin={(msg) => requireLogin(msg)} />;
    }
    if (route === "/redefinir-senha") {
      return <PasswordResetPage onGoHome={() => navigate("/")} onGoLogin={() => setAuthOpen(true)} />;
    }
    if (route === "/configuracoes" || route === "/perfil") {
      const initialTab = route === "/configuracoes" ? "settings" : "profile";
      return (
        <SettingsPage
          initialTab={initialTab}
          onGoBack={() => {
            const back = String(settingsCtx?.returnTo || "/");
            // evita loop
            if (back === route) navigate("/");
            else navigate(back);
            setSettingsCtx((p) => ({ ...p, autoClose: false }));
          }}
          onRequireLogin={requireLogin}
          onNavigate={navigate}
          onSignOut={() => signOut()}
          onSaved={() => {
            setToastMsg("Dados salvos!");
            setToastOpen(true);
            clearTimeout(toastT.current);
            toastT.current = setTimeout(() => setToastOpen(false), 1600);

            if (settingsCtx?.autoClose) {
              const back = String(settingsCtx?.returnTo || "/");
              setSettingsCtx((p) => ({ ...p, autoClose: false }));
              // volta para o fluxo (ex.: checkout)
              if (back && back !== route) navigate(back);
            }
          }}
        />
      );
    }
    if (route === "/conta") {
      return <AccountPage onGoHome={() => navigate("/")} />;
    }
    // Home default
    return (
      <HomePage
        brand={brand}
        featured={featured}
        prontaEntregaPreview={prontaEntrega.slice(0, 8)}
        rpgPreview={rpgSobEncomenda.slice(0, 8)}
        loadingProducts={productsLoading}
        productsError={productsError}
        addToCart={addToCart}
        buyNow={buyNow}
        openGallery={openGallery}
        onGoEstoque={() => navigate("/estoque")}
        onGoCatalogo={() => navigate("/catalogo")}
        onGoPromocoes={() => navigate("/promocoes")}
        onGoFaq={() => navigate("/faq")}
        onGoPoliticas={() => navigate("/politica-de-privacidade")}
        onGoCupom={() => navigate("/cupom")}
        onGoSobEncomenda={() => navigate("/catalogo")}
      
          onRequireLogin={(msg) => requireLogin(msg)}
        />
    );
  })();

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-[radial-gradient(circle_at_top,rgba(122,35,65,.14),transparent_24%),linear-gradient(180deg,#120809_0%,#090506_48%,#050304_100%)] text-amber-50">
      <Toast open={toastOpen}>{toastMsg}</Toast>

      <SiteHeader
        route={route}
        user={user}
        isAdmin={isAdmin}
        menuOpen={menuDrawerOpen}
        onToggleMenu={() => setMenuDrawerOpen((v) => !v)}
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        cartOpen={cartOpen}
        onToggleCart={() => setCartOpen((v) => !v)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        onPaymentConfirmed={() => {
          setCart([]);
          setCartOpen(false);
          setToastMsg("✅ Pedido finalizado!");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 2400);
        }}
        onOpenSettings={(tab) => openSettings(tab)}
        onSignOut={() => signOut()}
        onNavigate={navigate}
        onGoHomeSection={goHomeSection}
      />

      <MenuDrawer
        open={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        route={route}
        user={user}
        isAdmin={isAdmin}
        isVip={isVip}
        onNavigate={navigate}
        onGoHomeSection={goHomeSection}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        onOpenVipArea={() => navigate("/area-vip")}
        onPaymentConfirmed={() => {
          setCart([]);
          setCartOpen(false);
          setToastMsg("✅ Pedido finalizado!");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 2400);
        }}
        onOpenSettings={(tab) => openSettings(tab)}
        onSignOut={() => signOut()}
      />

      {/* TRUST BAR */}
      <div className="border-b border-amber-300/10 bg-[linear-gradient(180deg,rgba(28,14,10,.82),rgba(11,6,5,.68))]">
        <div className="container-cc px-4 sm:px-6 lg:px-8 py-2">
          {/* Mobile: compacto (não ocupa tela) */}
          <div className="md:hidden">
            <div className="flex items-center justify-between gap-3 text-[12px] text-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-icons text-[18px] text-slate-300" title="Envio com rastreio">local_shipping</span>
                <span className="material-icons text-[18px] text-slate-300" title="Pagamento seguro">lock</span>
                <span className="material-icons text-[18px] text-slate-300" title="Produção 15–30 dias úteis">schedule</span>
                <a
                  className="inline-flex items-center"
                  href={`https://wa.me/${brand.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Suporte no WhatsApp"
                >
                  <span className="material-icons text-[18px] text-slate-300">support_agent</span>
                </a>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-slate-200 hover:bg-white/10"
                onClick={() => setTrustOpen((v) => !v)}
                aria-expanded={trustOpen}
              >
                <span className="material-icons text-[16px] text-slate-300">info</span>
                <span>{trustOpen ? "Ocultar" : "Detalhes"}</span>
              </button>
            </div>

            {trustOpen && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-3 text-[12px] text-slate-200">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-icons text-[18px] text-slate-300">local_shipping</span>
                    <span>Envio p/ todo o Brasil (rastreio)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-icons text-[18px] text-slate-300">lock</span>
                    <span>Pagamento seguro (Mercado Pago)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-icons text-[18px] text-slate-300">schedule</span>
                    <span>Produção: 15–30 dias úteis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-icons text-[18px] text-slate-300">support_agent</span>
                    <a
                      className="underline decoration-dotted hover:text-white"
                      href={`https://wa.me/${brand.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Suporte no WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: completo */}
          <div className="hidden md:grid grid-cols-4 gap-2 text-[12px] sm:text-[13px] text-slate-200">
            <div className="flex items-center gap-2">
              <span className="material-icons text-[18px] text-slate-300">local_shipping</span>
              <span>Envio p/ todo o Brasil (rastreio)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-[18px] text-slate-300">lock</span>
              <span>Pagamento seguro (Mercado Pago)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-[18px] text-slate-300">schedule</span>
              <span>Produção: 15–30 dias úteis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-[18px] text-slate-300">support_agent</span>
              <a
                className="underline decoration-dotted hover:text-white"
                href={`https://wa.me/${brand.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                Suporte no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {page}

      {/* FOOTER */}
        <footer id="contato" className="mt-auto border-t border-white/10">
          <div
            className="container-cc grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-sm px-4 sm:px-6 lg:px-8 py-10" >
            <div>
              <p className="font-extrabold text-lg">{brand.name}</p>
              <p className="text-slate-400 mt-2">Cultura geek, qualidade de coleção.</p>
              <p className="text-xs text-slate-500 mt-3">Produção sob encomenda: 15–30 dias úteis • envio com rastreio</p>
            </div>
            <div>
              <p className="font-bold">Compra segura</p>
              <ul className="mt-2 text-slate-300 space-y-1">
                <li>• Checkout no site via Mercado Pago</li>
                <li>• PIX e cartão (conforme checkout)</li>
                <li>• Também finalizamos pelo WhatsApp</li>
              </ul>
            </div>
            <div>
              <p className="font-bold">Links úteis</p>
              <ul className="mt-2 text-slate-300 space-y-1">
                <li><a href="/catalogo" className="underline decoration-dotted">Catálogo</a></li>
                <li><a href="/promocoes" className="underline decoration-dotted">Promoções</a></li>
                <li><a href="/faq" className="underline decoration-dotted">FAQ</a></li>
                <li><a href="/trocas-e-devolucoes" className="underline decoration-dotted">Trocas / devoluções</a></li>
                <li><a href="/privacy.html" className="underline decoration-dotted">Política de Privacidade</a></li>
                <li><a href="/terms.html" className="underline decoration-dotted">Termos</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold">Contato</p>
              <ul className="mt-2 text-slate-300 space-y-1">
                <li>
                  <a className="underline decoration-dotted" href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  : (77) 99821-1169
                </li>
                <li>
                  <a className="underline decoration-dotted" href={`mailto:${brand.email}`}>
                    E-mail
                  </a>
                  : {brand.email}
                </li>
                <li>
                  <a className="underline decoration-dotted" href="https://instagram.com/cubo_criativo3d" target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                  : {brand.insta}
                </li>
                <li>Cidade/UF: {brand.city}</li>
                <li>Horário: Seg–Sex, 09h–18h</li>
              </ul>
            </div>
          </div>
          <div className="text-center text-xs text-slate-500 pb-8">
            © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
          </div>
        </footer>

      {/* DRAWER CARRINHO */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        updateQty={updateQty}
        removeItem={removeItem}
        subtotal={subtotal}
        brand={brand}
        waMsg={waMsg}
        onPay={startCheckout}
        onPayWithCoupon={startCheckout}
        paying={paying}
        authToken={accessToken}
        userId={user?.id || ""}
        userEmail={user?.email || ""}
        onRequireLogin={requireLogin}
        onRequireProfile={() => openSettings('profile', { autoClose: true })}
        onOpenOrders={() => setOrdersOpen(true)}
        onPaymentConfirmed={() => {
          setCart([]);
          setCartOpen(false);
          setToastMsg("✅ Pedido finalizado!");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 2400);
        }}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <OrdersModal
        open={ordersOpen}
        onRequireLogin={requireLogin}
        onClose={() => setOrdersOpen(false)}
        onPaymentFinalized={() => {
          // Quando o usuário paga um Pix pela aba "Meus pedidos",
          // precisamos replicar o mesmo comportamento do carrinho:
          // limpar carrinho e fechar a aba.
          setCart([]);
          setOrdersOpen(false);
          setCartOpen(false);
          // feedback leve
          setToastMsg("Pedido finalizado. Obrigado!");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 2400);
        }}
      />

      <VipAreaModal onRequireLogin={requireLogin} open={vipAreaOpen} onClose={() => setVipAreaOpen(false)} onGoVip={() => { setVipAreaOpen(false); navigate("/vip"); }} />

      {/* MODAL GALERIA */}
      {/*
        Galeria: no desktop algumas telas/combinações de imagens podem causar scroll no body do modal.
        Aqui a gente trava o body do modal (overflow-hidden) e limita a área da imagem para nunca estourar a viewport.
      */}
      <Modal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={`Fotos — ${galleryData.title}`}
        bodyClassName="overflow-hidden"
        // No desktop, a galeria não precisa ocupar 70vw.
        // Mantemos responsivo, mas com teto menor para não abrir "gigante".
        widthClass="w-[94vw] sm:w-[88vw]"
        maxWidth="max-w-[860px]"
      >
        {galleryOpen && (
          <div className="relative">
            <div
              className="relative w-full max-w-[820px] mx-auto grid place-items-center rounded-xl ring-1 ring-white/10 bg-slate-900/60 p-2 select-none"
              onTouchStart={onGalleryTouchStart}
              onTouchMove={onGalleryTouchMove}
              onTouchEnd={onGalleryTouchEnd}
              onPointerDown={onGalleryPointerDown}
              onPointerMove={onGalleryPointerMove}
              onPointerUp={onGalleryPointerUp}
              onPointerCancel={onGalleryPointerUp}
              style={{ touchAction: "pan-y" }}
              aria-label="Galeria de imagens. Deslize para o lado para trocar."
            >
              {/*
                Mantém um tamanho consistente sem estourar a altura do modal.
                - Usa um teto em px e também em vh (evita criar scrollbar no modal)
                - Mantém a imagem sempre dentro do container com object-contain
              */}
              {/*
                Mantém a imagem dentro do modal em desktops menores (ex.: 768–900px de altura)
                e evita criar barra de rolagem.
              */}
              {/*
                IMPORTANTE (desktop): não fixamos a altura do container.
                Em vez disso, deixamos o painel "encolher" e limitamos a IMAGEM por max-height.
                Assim a foto aparece inteira (sem precisar rolar), apenas reduzindo quando necessário.
              */}
              <div className="relative w-full grid place-items-center">
              {galleryLoadedSrc ? (
                <img
                  src={galleryLoadedSrc}
                  alt={galleryData.title}
                  className={`block max-h-[70vh] sm:max-h-[72vh] w-auto max-w-full h-auto object-contain rounded-lg transition ${galleryIsLoading ? "blur-sm opacity-80" : "blur-0 opacity-100"}`}
                  loading="eager"
                  draggable={false}
                />
              ) : (
                <div className="h-[45vh] w-full rounded-lg bg-white/5 ring-1 ring-white/10 animate-pulse" />
              )}

              {galleryIsLoading && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="container-cc flex items-center gap-3 rounded-full bg-black/45 ring-1 ring-white/10 px-4 py-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
                    <span className="text-sm text-white/90">Carregando imagem…</span>
                  </div>
                </div>
              )}
            </div>

              {/* Setas laterais (sem autoplay) */}
              {galleryData.imgs.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    aria-label="Imagem anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center bg-black/45 ring-1 ring-white/15 text-white hover:bg-black/60 active:scale-[0.98]"
                  >
                    <span aria-hidden>‹</span>
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    aria-label="Próxima imagem"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center bg-black/45 ring-1 ring-white/15 text-white hover:bg-black/60 active:scale-[0.98]"
                  >
                    <span aria-hidden>›</span>
                  </button>
                </>
              )}
            </div>

            {/* Pontinhos indicativos */}
            {galleryData.imgs.length > 1 && (
              <div className="mt-3 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full bg-black/35 ring-1 ring-white/10 px-3 py-2">
                  {galleryData.imgs.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setGalleryIndex(idx)}
                      aria-label={`Ir para imagem ${idx + 1}`}
                      aria-current={idx === galleryIndex ? "true" : "false"}
                      className={`h-2.5 w-2.5 rounded-full ring-1 ring-white/15 transition ${idx === galleryIndex ? "bg-white" : "bg-white/35 hover:bg-white/60"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}