// src/App.jsx
import React from "react";
import brand from "./data/config";
import { produtos } from "./data/produtos";

// Componentes
import Modal from "./components/Modal.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import OrdersModal from "./components/OrdersModal.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import { useAuth } from "./auth/AuthProvider.jsx";

// Páginas
import HomePage from "./pages/HomePage.jsx";
import StockPage from "./pages/StockPage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";

// Lazy-load (carrega só quando abrir)
const ModelViewer3D = React.lazy(() => import("./components/ModelViewer3D.jsx"));
const RPGPage = React.lazy(() => import("./rpg/RPGPage.jsx"));

/* ========================================================================
   HELPERS
   ======================================================================== */
const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

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

  // ===== Carrinho =====
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cart, setCart] = React.useState([]);
  const [cartBounce, setCartBounce] = React.useState(false);
  const [toastOpen, setToastOpen] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState("Adicionado!");
  const bounceT = React.useRef(null);
  const toastT = React.useRef(null);

  // ===== Pagamento (Stripe Checkout) =====
  const [paying, setPaying] = React.useState(false);

  // ===== Visualizador 3D =====
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerModel, setViewerModel] = React.useState({ src: "", title: "" });

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

  function addToCart(p, { escala, unitPrice } = {}) {
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

  // Detecta retorno do Stripe (success/cancel) e mostra feedback
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;

    if (payment === "success") {
      setToastMsg("✅ Pagamento confirmado!");
      setToastOpen(true);
      setCart([]);
      setCartOpen(false);
    }
    if (payment === "cancel") {
      setToastMsg("Pagamento cancelado.");
      setToastOpen(true);
    }

    params.delete("payment");
    params.delete("session_id");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", next);

    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastOpen(false), 2200);
  }, []);

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
      if (!resp.ok || !data?.url) throw new Error(data?.error || "Não foi possível iniciar o pagamento.");
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

  function openViewer(modelSrc, title) {
    if (!modelSrc) return;
    setViewerModel({ src: modelSrc, title });
    setViewerOpen(true);
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
    const anyOverlayOpen = cartOpen || viewerOpen || galleryOpen || rpgMode;
    document.body.style.overflow = anyOverlayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, viewerOpen, galleryOpen, rpgMode]);

  // ===== Produtos =====
  const emEstoque = React.useMemo(() => produtos.filter((p) => p.status === "estoque"), []);
  const catalogo = React.useMemo(() => produtos.filter((p) => p.status !== "estoque"), []);

  const featured = React.useMemo(() => {
    const explicit = produtos.filter((p) => p.featured === true);
    if (explicit.length) return explicit.slice(0, 8);

    // fallback: mistura estoque + catálogo
    const a = emEstoque.slice(0, 4);
    const b = catalogo.slice(0, 4);
    return [...a, ...b].slice(0, 8);
  }, [emEstoque, catalogo]);

  // ===== Render da página =====
  const page = (() => {
    if (route === "/estoque") {
      return (
        <StockPage
          items={emEstoque}
          addToCart={addToCart}
          buyNow={buyNow}
          openViewer={openViewer}
          openGallery={openGallery}
        />
      );
    }
    if (route === "/catalogo") {
      return (
        <CatalogPage
          items={catalogo}
          addToCart={addToCart}
          buyNow={buyNow}
          openViewer={openViewer}
          openGallery={openGallery}
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
        addToCart={addToCart}
        buyNow={buyNow}
        openViewer={openViewer}
        openGallery={openGallery}
        onGoEstoque={() => navigate("/estoque")}
        onGoCatalogo={() => navigate("/catalogo")}
      />
    );
  })();

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <Toast open={toastOpen}>{toastMsg}</Toast>

      <SiteHeader
        route={route}
        user={user}
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        cartOpen={cartOpen}
        onToggleCart={() => setCartOpen((v) => !v)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        onSignOut={() => signOut()}
        onToggleRpg={() => setRpgMode((v) => !v)}
        rpgMode={rpgMode}
        onNavigate={navigate}
        onGoHomeSection={goHomeSection}
      />

      {rpgMode && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-[140] grid place-items-center bg-black/60 text-slate-200">
              Carregando RPG…
            </div>
          }
        >
          <RPGPage onClose={() => setRpgMode(false)} addToCart={addToCart} />
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
                <li>• Checkout no site (Stripe)</li>
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
        userEmail={user?.email || ""}
        onRequireLogin={() => setAuthOpen(true)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <OrdersModal open={ordersOpen} onClose={() => setOrdersOpen(false)} />

      {/* MODAL 3D */}
      <Modal open={viewerOpen} onClose={() => setViewerOpen(false)} title={`Visualizador 3D — ${viewerModel.title}`}>
        {viewerOpen && viewerModel.src ? (
          <React.Suspense fallback={<div className="p-6 text-slate-300">Carregando 3D…</div>}>
            <ModelViewer3D src={viewerModel.src} />
          </React.Suspense>
        ) : (
          <div className="text-slate-400 text-sm">Selecione um produto com modelo 3D.</div>
        )}
      </Modal>

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
