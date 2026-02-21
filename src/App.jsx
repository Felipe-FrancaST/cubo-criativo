// src/App.jsx
import React from "react";
import brand from "./data/config";

// Componentes
import Modal from "./components/Modal.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import OrdersModal from "./components/OrdersModal.jsx";
import MenuDrawer from "./components/MenuDrawer.jsx";
import ProfileSettingsModal from "./components/ProfileSettingsModal.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import { useAuth } from "./auth/AuthProvider.jsx";
import { supabase } from "./lib/supabaseClient";

// Páginas
import HomePage from "./pages/HomePage.jsx";
import StockPage from "./pages/StockPage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import PromocoesPage from "./pages/PromocoesPage.jsx";
import SobrePage from "./pages/SobrePage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import AdminOrdersPage from "./pages/AdminOrdersPage.jsx";
import { isAdminEmail } from "./lib/admin.js";

// Lazy-load (carrega só quando abrir)
const RPGPage = React.lazy(() => import("./rpg/RPGPage.jsx"));

/* ========================================================================
   HELPERS
   ======================================================================== */
const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

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
    slug: row?.slug ? String(row.slug) : "",
    nome: row?.name ? String(row.name) : "",
    descricao: row?.description ? String(row.description) : "",
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
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 ${
        open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      <div className="rounded-full bg-emerald-500 text-black font-semibold px-4 py-2 shadow-lg ring-4 ring-emerald-400/30">
        {children}
      </div>
    </div>
  );
}

function getRouteFromHash() {
  const h = window.location.hash || "";
  // Aceita: #/ , #/estoque, #/catalogo, #/conta
  if (!h.startsWith("#/")) return "/";
  const raw = h.slice(1); // remove '#'
  const path = raw.split("?")[0]; // remove query
  return path || "/";
}

/* ========================================================================
   APP
   ======================================================================== */
export default function App() {
  const { user, session, signOut } = useAuth();
  const accessToken = session?.access_token || "";
  const isAdmin = isAdminEmail(user?.email || "");

  // ===== Rotas (Hash router sem dependências) =====
  const [route, setRoute] = React.useState(() => (typeof window === "undefined" ? "/" : getRouteFromHash()));
  const pendingScroll = React.useRef(null);

  React.useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/";
    const onHash = () => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(path) {
    const normalized = path?.startsWith("/") ? path : `/${path || ""}`;
    window.location.hash = `#${normalized}`;
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
  const [rpgMode, setRpgMode] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
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
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash || ""}`;
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
        setSettingsOpen(true);
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      setToastMsg("Não foi possível validar seus dados. Abra Configurações e tente novamente.");
      setToastOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 3000);
      setSettingsOpen(true);
      return false;
    }
  }

  async function startCheckout() {
    if (!user) {
      setToastMsg("Faça login para pagar.");
      setToastOpen(true);
      setAuthOpen(true);
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastOpen(false), 2400);
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
          setSettingsOpen(true);
          return;
        }
        throw new Error(data?.error || "Não foi possível iniciar o pagamento.");
      }
      if (!data?.url) throw new Error("Não foi possível iniciar o pagamento.");
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
    setGalleryOpen(true);
  }

  function prevImage() {
    setGalleryIndex((i) => (i - 1 + galleryData.imgs.length) % galleryData.imgs.length);
  }
  function nextImage() {
    setGalleryIndex((i) => (i + 1) % galleryData.imgs.length);
  }

  // Bloqueia scroll do body quando overlays estão abertos
  React.useEffect(() => {
    const anyOverlayOpen = cartOpen || galleryOpen || rpgMode || authOpen || ordersOpen || settingsOpen || menuDrawerOpen;
    document.body.style.overflow = anyOverlayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, galleryOpen, rpgMode, authOpen, ordersOpen, settingsOpen, menuDrawerOpen]);

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
            "id,slug,name,description,price_cents,currency,stock,active,featured,promo,image_url,images,status,tags,default_variant,variants,original_price_cents,category,created_at"
          )
          .eq("active", true)
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

  const emEstoque = React.useMemo(
    () =>
      products.filter((p) => {
        const isStock = String(p.status || "").toLowerCase() === "estoque";
        const cat = String(p.category || "").toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
        const isRpg = cat === "rpg" || tags.includes("rpg");
        return isStock && !isRpg;
      }),
    [products]
  );
  const catalogo = React.useMemo(
    () =>
      products.filter((p) => {
        const isCatalog = String(p.status || "").toLowerCase() !== "estoque";
        const cat = String(p.category || "").toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
        const isRpg = cat === "rpg" || tags.includes("rpg");
        return isCatalog && !isRpg;
      }),
    [products]
  );

  const featured = React.useMemo(() => {
    // Destaques devem ser controlados exclusivamente pelo campo `featured` no Supabase.
    // Se nenhum produto estiver marcado como featured, não mostra nada.
    const explicit = products.filter((p) => {
      const cat = String(p.category || "").toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
      const isRpg = cat === "rpg" || tags.includes("rpg");
      return p.featured === true && !isRpg;
    });
    // opcional: mantém uma ordem estável (mais recentes primeiro)
    explicit.sort((a, b) => {
      const ta = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
    return explicit.slice(0, 8);
  }, [products, emEstoque, catalogo]);

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

  // ===== RPG (usa a mesma tabela `products`) =====
  const rpgItems = React.useMemo(() => {
    return products.filter((p) => {
      const cat = String(p.category || "").toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
      return cat === "rpg" || tags.includes("rpg");
    });
  }, [products]);

  // ===== Render da página =====
  const page = (() => {
    if (route === "/admin") {
      return <AdminOrdersPage user={user} accessToken={accessToken} onNavigateHome={() => navigate("/")} />;
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
          items={emEstoque}
          loading={productsLoading}
          error={productsError}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
        />
      );
    }
    if (route === "/catalogo") {
      return (
        <CatalogPage
          items={catalogo}
          loading={productsLoading}
          error={productsError}
          addToCart={addToCart}
          buyNow={buyNow}
          openGallery={openGallery}
        />
      );
    }
    if (route === "/sobre") {
      return <SobrePage onGoHome={() => navigate("/")} />;
    }
    if (route === "/contato") {
      return <ContactPage onGoHome={() => navigate("/")} />;
    }
    if (route === "/conta") {
      return <AccountPage onGoHome={() => navigate("/")} />;
    }
    // Home default
    return (
      <HomePage
        brand={brand}
        featured={featured}
        loadingProducts={productsLoading}
        productsError={productsError}
        addToCart={addToCart}
        buyNow={buyNow}
        openGallery={openGallery}
        onGoEstoque={() => navigate("/estoque")}
        onGoCatalogo={() => navigate("/catalogo")}
        onGoPromocoes={() => navigate("/promocoes")}
      />
    );
  })();

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
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
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => signOut()}
        onToggleRpg={() => setRpgMode((v) => !v)}
        rpgMode={rpgMode}
        onNavigate={navigate}
        onGoHomeSection={goHomeSection}
      />

      <MenuDrawer
        open={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        route={route}
        user={user}
        isAdmin={isAdmin}
        onNavigate={navigate}
        onGoHomeSection={goHomeSection}
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
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => signOut()}
        onToggleRpg={() => setRpgMode((v) => !v)}
        rpgMode={rpgMode}
      />

      {rpgMode && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-[140] grid place-items-center bg-black/60 text-slate-200">
              Carregando RPG…
            </div>
          }
        >
          <RPGPage
            onClose={() => setRpgMode(false)}
            addToCart={addToCart}
            items={rpgItems}
            loading={productsLoading}
            error={productsError}
          />
        </React.Suspense>
      )}

      {/* Conteúdo (só quando NÃO está no RPG) */}
      {!rpgMode && page}

      {/* FOOTER */}
      {!rpgMode && (
        <footer id="contato" className="mt-auto border-t border-white/10">
          <div
            className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-sm px-4 sm:px-6 lg:px-8 py-10"
            style={{ maxWidth: "var(--container-max, 1200px)" }}
          >
            <div>
              <p className="font-extrabold text-lg">{brand.name}</p>
              <p className="text-slate-400 mt-2">Cultura geek, qualidade de coleção.</p>
            </div>
            <div>
              <p className="font-bold">Pagamento</p>
              <ul className="mt-2 text-slate-300 space-y-1">
                <li>• Checkout no site (Mercado Pago)</li>
                <li>• Também finalizamos pelo WhatsApp</li>
              </ul>
            </div>
            <div>
              <p className="font-bold">Contato</p>
              <ul className="mt-2 text-slate-300 space-y-1">
                <li>WhatsApp: (77) 99821-1169</li>
                <li>E-mail: {brand.email}</li>
                <li>Instagram: @_cubocriativo_</li>
                <li>Cidade/UF: {brand.city}</li>
              </ul>
            </div>
          </div>
          <div className="text-center text-xs text-slate-500 pb-8">
            © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
          </div>
        </footer>
      )}

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
        paying={paying}
        authToken={accessToken}
        userId={user?.id || ""}
        userEmail={user?.email || ""}
        onRequireLogin={() => setAuthOpen(true)}
        onRequireProfile={() => setSettingsOpen(true)}
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

      <OrdersModal open={ordersOpen} onClose={() => setOrdersOpen(false)} />

      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setToastMsg("Dados salvos!");
          setToastOpen(true);
          clearTimeout(toastT.current);
          toastT.current = setTimeout(() => setToastOpen(false), 1600);
        }}
      />

      {/* MODAL GALERIA */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={`Fotos — ${galleryData.title}`}>
        {galleryOpen && (
          <div className="relative">
            <div className="relative w-full grid place-items-center rounded-xl ring-1 ring-white/10 bg-slate-900/60 p-2">
              <img
                key={galleryIndex}
                src={galleryData.imgs[galleryIndex]}
                alt={galleryData.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
                loading="lazy"
              />
            </div>

            {galleryData.imgs.length > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={prevImage}
                  className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/5"
                >
                  <span className="material-icons align-middle">chevron_left</span> Anterior
                </button>
                <div className="text-xs text-slate-400">
                  {galleryIndex + 1} / {galleryData.imgs.length}
                </div>
                <button
                  onClick={nextImage}
                  className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/5"
                >
                  Próxima <span className="material-icons align-middle">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}