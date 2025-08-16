// src/App.jsx
import React from "react";
import Modal from "./components/Modal.jsx";
import ModelViewer3D from "./components/ModelViewer3D.jsx";
import CarrosselPromo from "./components/CarrosselPromo.jsx";


/* ==========================
   CONFIG DA MARCA
   ========================== */
const brand = {
  name: "Cubo Criativo",
  slogan: "Miniaturas em resina • Pintura artística • Modelagem 3D",
  whatsapp: "5577998211169",
  email: "cubocriativox0@gmail.com",
  insta: "@_cubocriativo_",
  city: "Barreiras - BA",
  logo: "/images/logo.png",
};

/* =============================================================================
   PRODUTOS
   - status: "estoque" ou "catalogo"
   - tags: grupos/categorias (ex.: ["Naruto"], ["DBZ"], ["RPG"], ["Filmes"])
   - variants: [{ label: "1/7", price: 500 }, ...]
   - defaultVariant: escala inicial
   - imgs: (opcional) array de imagens extras para a galeria. A PRIMEIRA pode
           ser igual à "img" principal, ou você deixa que eu uso p.img como base.
   >>> PARA ADICIONAR FOTOS EXTRAS: coloque caminhos em p.imgs abaixo.
   ============================================================================ */
const produtos = [
  {
    id: "p1",
    nome: "Minthara (Baldur's Gate)",
    img: "/images/prod1.jpg",
    imgs: ["/images/prod1.jpg", "/images/prod1b.jpg", "/images/prod1c.jpg"], // << EDITE/ADICIONE
    model: "/models/mintharaviewer.glb",
    status: "estoque",
    tags: ["Baldur's Gate", "Games", "RPG"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/9", price: 420 },
      { label: "1/7", price: 500 },
      { label: "1/6", price: 580 },
    ],
  },
  {
    id: "p2",
    nome: "Majin Boo (DBZ)",
    img: "/images/prod2.jpg",
    imgs: ["/images/prod2.jpg", "/images/prod2-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DBZ", "Animes"],
    defaultVariant: "1/4",
    variants: [
      { label: "1/6", price: 260 },
      { label: "1/5", price: 310 },
      { label: "1/4", price: 380 },
    ],
  },
  {
    id: "p3",
    nome: "Konan (Naruto)",
    img: "/images/prod3.jpg",
    imgs: ["/images/prod3.jpg", "/images/prod3-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/9",
    variants: [
      { label: "1/10", price: 110 },
      { label: "1/9", price: 120 },
      { label: "1/8", price: 140 },
    ],
  },
  {
    id: "p4",
    nome: "Arlequina (DC)",
    img: "/images/prod4.jpg",
    imgs: ["/images/prod4.jpg", "/images/prod4-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DC", "Filmes", "HQs"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p5",
    nome: "Naruto Clássico (Naruto)",
    img: "/images/prod5.jpg",
    imgs: ["/images/prod5.jpg", "/images/prod5-1.jpg",],
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p6",
    nome: "Naruto Hokage (Naruto)",
    img: "/images/prod6.jpg",
    imgs: ["/images/prod6.jpg", ],
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p7",
    nome: "Orochimaru (Naruto)",
    img: "/images/prod7.jpg",
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p8",
    nome: "Jiraiya Modo Sábio (Naruto)",
    img: "/images/prod8.jpg",
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p9",
    nome: "Hinata (Naruto)",
    img: "/images/prod9.jpg",
    imgs: ["/images/prod9.jpg", "/images/prod9-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p10",
    nome: "Goku Ssj 4 (DBZ)",
    img: "/images/prod10.jpg",
    imgs: ["/images/prod10.jpg", "/images/prod10-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DBZ", "Animes"],
    defaultVariant: "1/4",
    variants: [
      { label: "1/6", price: 260 },
      { label: "1/5", price: 310 },
      { label: "1/4", price: 380 },
    ],
  },
  {
    id: "p11",
    nome: "Sr. Kaioh (DBZ)",
    img: "/images/prod11.jpg",
    imgs: ["/images/prod11.jpg", "/images/prod11-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DBZ", "Animes"],
    defaultVariant: "1/4",
    variants: [
      { label: "1/6", price: 260 },
      { label: "1/5", price: 310 },
      { label: "1/4", price: 380 },
    ],
  },
  {
    id: "p12",
    nome: "Android 18 (DBZ)",
    img: "/images/prod12.jpg",
    imgs: ["/images/prod12.jpg", "/images/prod12-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DBZ", "Animes"],
    defaultVariant: "1/4",
    variants: [
      { label: "1/6", price: 260 },
      { label: "1/5", price: 310 },
      { label: "1/4", price: 380 },
    ],
  },
  {
    id: "p13",
    nome: "Naruto Modo Sanin (Naruto)",
    img: "/images/prod13.jpg",
    imgs: ["/images/prod13.jpg", "/images/prod13-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p14",
    nome: "Naruto Modo Sanin Rasengan (Naruto)",
    img: "/images/prod14.jpg",
    imgs: ["/images/prod14.jpg", "/images/prod14-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p15",
    nome: "Superman (DC)",
    img: "/images/prod15.jpg",
    imgs: ["/images/prod15.jpg", "/images/prod15-1.jpg", "/images/prod15-2.jpg"], // << opcional
    status: "catalogo",
    tags: ["DC", "Filmes", "HQs"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
  {
    id: "p16",
    nome: "Arlequina (DC)",
    img: "/images/prod16.jpg",
    imgs: ["/images/prod16.jpg", "/images/prod16-1.jpg"], // << opcional
    status: "catalogo",
    tags: ["DC", "Filmes", "HQs"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/8", price: 260 },
      { label: "1/7", price: 300 },
      { label: "1/6", price: 360 },
    ],
  },
];

/* ==========================
   HELPERS
   ========================== */
const fmtBRL = (n) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function Toast({ open, children }) {
  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 ${
        open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      <div className="rounded-full bg-emerald-500 text-black font-semibold px-4 py-2 shadow-lg ring-4 ring-emerald-400/30">
        {children}
      </div>
    </div>
  );
}

/* ==========================
   CARD DE PRODUTO
   ========================== */
function ProductCard({ p, addToCart, buyNow, openViewer, openGallery }) {
  const defaultIndex = Math.max(0, p.variants?.findIndex((v) => v.label === p.defaultVariant));
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [addedFlash, setAddedFlash] = React.useState(false);

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const sel = hasVariants ? p.variants[selIndex] : null;
  const price = sel?.price ?? p.preco ?? 0;
  const escala = sel?.label ?? p.escala ?? "";

  function handleAdd() {
    addToCart(p, { escala, unitPrice: price });
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 900);
  }

  return (
    <article className="w-full max-w-[320px] group rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60 hover:ring-teal-400/30 transition">
      {/* Imagem clicável -> abre galeria */}
      <button
        type="button"
        className="aspect-[4/5] bg-slate-800/60 grid place-items-center overflow-hidden w-full relative"
        onClick={() => openGallery(p)}
        title="Ver mais fotos"
      >
        <img
          src={p.img}
          alt={p.nome}
          loading="lazy"
          className="object-cover w-full h-full group-hover:scale-[1.02] transition"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("bg-slate-700");
            e.currentTarget.parentElement.innerHTML =
              `<div class="text-slate-300 text-xs px-3 text-center">Imagem não encontrada.<br/>Coloque em <b>public/images</b>.</div>`;
          }}
        />
        <span className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 ring-1 ring-white/20">
          ver fotos
        </span>
      </button>

      <div className="p-4">
        <h3 className="font-bold tracking-tight text-center lg:text-left">{p.nome}</h3>

        {hasVariants && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">Escala / Preço</label>
            <select
              className="mt-1 w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm"
              value={selIndex}
              onChange={(e) => setSelIndex(Number(e.target.value))}
            >
              {p.variants.map((v, i) => (
                <option key={v.label} value={i}>
                  {v.label} — {fmtBRL(v.price)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-300">Resina Premium</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            className={`rounded-lg px-3 py-2 font-semibold ring-4 ring-teal-400/20 ${
              addedFlash ? "bg-emerald-400 text-black" : "bg-teal-400 text-black"
            } transition`}
            title="Adicionar ao carrinho"
          >
            {addedFlash ? "Adicionado!" : "Adicionar"}
          </button>
          <button
            onClick={() => buyNow(p, { escala, unitPrice: price })}
            className="rounded-lg px-3 py-2 ring-1 ring-white/15 hover:bg-white/5"
            title="Comprar agora"
          >
            Comprar
          </button>
        </div>

        {p.model && (
          <button
            onClick={() => openViewer(p.model, p.nome)}
            className="mt-2 w-full rounded-lg px-3 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm"
          >
            Ver em 3D
          </button>
        )}
      </div>
    </article>
  );
}

/* ==========================
   APP
   ========================== */
export default function App() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Carrinho
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cart, setCart] = React.useState([]);
  const [cartBounce, setCartBounce] = React.useState(false);
  const [toastOpen, setToastOpen] = React.useState(false);

  function addToCart(p, { escala, unitPrice } = {}) {
    const price = typeof unitPrice === "number" ? unitPrice : p.preco || 0;
    const scale = escala || p.escala || "";

    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id && i.escala === scale && i.unitPrice === price);
      if (found) {
        return prev.map((i) =>
          i.id === p.id && i.escala === scale && i.unitPrice === price
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }
      return [...prev, { ...p, qty: 1, unitPrice: price, escala: scale }];
    });

    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 800);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 1400);
  }

  function openCart() { setCartOpen(true); }

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
      (i) => `• ${i.nome}${i.escala ? ` (${i.escala})` : ""} x${i.qty} — ${fmtBRL((i.unitPrice || i.preco || 0) * i.qty)}`
    );
    const totalTxt = subtotal > 0 ? `\nTotal: ${fmtBRL(subtotal)}` : "";
    return encodeURIComponent(
      `Olá! Quero finalizar meu pedido:\n${linhas.join("\n")}${totalTxt}\n\nPagamento: combinar via WhatsApp.`
    );
  }, [cart, subtotal]);

  // Visualizador 3D
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerModel, setViewerModel] = React.useState({ src: "", title: "" });
  function openViewer(modelSrc, title) {
    if (!modelSrc) return;
    setViewerModel({ src: modelSrc, title });
    setViewerOpen(true);
  }

  // ======== GALERIA (miniaturas + imagem principal sem corte) ========
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [galleryData, setGalleryData] = React.useState({ title: "", imgs: [] });
  const [galleryIndex, setGalleryIndex] = React.useState(0);

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

  // Listas separadas
  const emEstoque = produtos.filter((p) => p.status === "estoque");
  const catalogo = produtos.filter((p) => p.status !== "estoque");

  // Filtros do catálogo
  const allTags = React.useMemo(() => {
    const set = new Set();
    catalogo.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [catalogo]);

  const [selectedTag, setSelectedTag] = React.useState("Todos");
  const [query, setQuery] = React.useState("");

  const catalogoFiltrado = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo.filter((p) => {
      const matchTag = selectedTag === "Todos" || (p.tags || []).includes(selectedTag);
      const matchName = q === "" || p.nome.toLowerCase().includes(q);
      return matchTag && matchName;
    });
  }, [catalogo, selectedTag, query]);

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      {/* TOAST */}
      <Toast open={toastOpen}>Adicionado ao carrinho!</Toast>

      {/* HEADER – elegante */}
      <header className="sticky top-0 z-50">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
        <div className="backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/90 border-b border-white/10">
          <div className="mx-auto w-full" style={{ maxWidth: "var(--container-max, 1200px)" }}>
            <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
              {/* Logo + nome */}
              <a href="#" className="flex items-center gap-3 group">
                <span className="relative isolate">
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="h-12 sm:h-14 w-auto object-contain rounded-lg ring-1 ring-white/10"
                  />
                  <span className="pointer-events-none absolute -inset-1 -z-10 rounded-xl bg-gradient-to-tr from-teal-500/15 via-fuchsia-500/10 to-indigo-500/15 blur-md opacity-80 group-hover:opacity-100 transition" />
                </span>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="font-extrabold tracking-tight">{brand.name}</span>
                  <span className="text-xs text-slate-400">{brand.slogan}</span>
                </div>
              </a>

              {/* Navegação desktop */}
              <nav className="hidden md:flex items-center gap-1 text-sm">
                {[
                  { href: "#sobre", label: "Sobre" },
                  { href: "#estoque", label: "Em estoque" },
                  { href: "#catalogo", label: "Catálogo" },
                  { href: "#contato", label: "Contato" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="relative px-3 py-2 rounded-lg text-slate-300 hover:text-white transition group"
                  >
                    {link.label}
                    <span className="pointer-events-none absolute left-3 right-3 -bottom-[2px] h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent scale-x-0 group-hover:scale-x-100 origin-center transition-transform duration-300" />
                  </a>
                ))}
              </nav>

              {/* Ações */}
              <div className="flex items-center gap-2">
                <a
                  href="https://instagram.com/_cubocriativo_"
                  target="_blank"
                  className="hidden sm:inline-flex items-center rounded-full px-3 py-2 ring-1 ring-white/10 hover:bg-white/5 text-sm"
                  title="Instagram"
                >
                  <img src="/icons/instagram.svg" alt="" className="h-4 w-4 mr-2" />
                  Instagram
                </a>
                <a
                  href="https://tiktok.com/@cubo.criativo"
                  target="_blank"
                  className="hidden sm:inline-flex items-center rounded-full px-3 py-2 ring-1 ring-white/10 hover:bg-white/5 text-sm"
                  title="TikTok"
                >
                  <img src="/icons/tiktok.svg" alt="" className="h-4 w-4 mr-2" />
                  TikTok
                </a>

                <a
                  href={`https://wa.me/${brand.whatsapp}`}
                  target="_blank"
                  className="hidden lg:inline-flex items-center gap-2 rounded-full px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-black font-semibold shadow-sm ring-4 ring-emerald-400/25 transition"
                >
                  <span className="material-icons text-[18px]">chat</span>
                  WhatsApp
                </a>

                <button
                  onClick={openCart}
                  className={`relative rounded-full p-2.5 ring-1 ring-white/15 hover:bg-white/5 transition ${
                    cartBounce ? "animate-bounce" : ""
                  }`}
                  title="Carrinho"
                  aria-label="Abrir carrinho"
                >
                  <span className="material-icons">shopping_cart</span>
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-teal-400 text-black font-bold rounded-full px-1.5 py-0.5 shadow">
                      {cart.reduce((s, i) => s + i.qty, 0)}
                    </span>
                  )}
                </button>

                <button
                  className="md:hidden rounded-full p-2.5 ring-1 ring-white/15 hover:bg-white/5"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Abrir menu"
                >
                  <span className="material-icons">{menuOpen ? "close" : "menu"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile drawer */}
          {menuOpen && (
            <div className="md:hidden border-t border-white/10 bg-slate-900/95">
              <nav
                className="mx-auto w-full px-4 sm:px-6 py-3 flex flex-col gap-2 text-sm"
                style={{ maxWidth: "var(--container-max, 1200px)" }}
              >
                {[
                  { href: "#sobre", label: "Sobre" },
                  { href: "#estoque", label: "Em estoque" },
                  { href: "#catalogo", label: "Catálogo" },
                  { href: "#contato", label: "Contato" },
                ].map((link) => (
                  <a
                    key={link.href}
                    onClick={() => setMenuOpen(false)}
                    href={link.href}
                    className="py-2 px-2 rounded-lg hover:bg-white/5"
                  >
                    {link.label}
                  </a>
                ))}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/${brand.whatsapp}`}
                    target="_blank"
                    className="rounded-lg px-3 py-2 bg-emerald-400 text-black font-semibold text-center"
                  >
                    WhatsApp
                  </a>
                  <a
                    href="https://instagram.com/_cubocriativo_"
                    target="_blank"
                    className="rounded-lg px-3 py-2 ring-1 ring-white/10 text-center hover:bg-white/5"
                  >
                    Instagram
                  </a>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/40 via-fuchsia-500/20 to-indigo-500/10" />
          <div
            className="mx-auto grid lg:grid-cols-2 items-center gap-10 px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20"
            style={{ maxWidth: "var(--container-max, 1200px)" }}
          >
            <div className="text-center lg:text-left lg:pr-6">
              <h1 className="font-black leading-tight text-3xl sm:text-5xl lg:text-6xl">
                Miniaturas e Impressões 3D <span className="text-teal-400">Exclusivas</span>
              </h1>
              <p className="mt-4 text-slate-300 text-base sm:text-lg">
                {brand.slogan}. Qualidade de vitrine para colecionadores, RPG e cultura geek.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-sm mx-auto lg:mx-0 justify-center lg:justify-start">
                <a href="#estoque" className="rounded-xl px-5 py-3 bg-teal-400 text-black font-bold ring-4 ring-teal-400/20 text-center">
                  Ver em estoque
                </a>
                <a href="#catalogo" className="rounded-xl px-5 py-3 ring-1 ring-white/20 hover:bg-white/5 text-center">
                  Ver catálogo
                </a>
              </div>
            </div>

            {/* PROMOÇÕES */}
            <div className="relative">
              <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-fuchsia-500/20 via-teal-500/15 to-indigo-500/20 ring-1 ring-white/10">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-400 text-black">
                      Promoções
                    </span>
                    <span className="hidden sm:inline text-slate-300 text-sm">Ofertas selecionadas da semana</span>
                  </div>
                  <span className="hidden sm:inline text-emerald-300 text-xs font-semibold">⚡ até 30% OFF</span>
                </div>
                <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/60">
                  <CarrosselPromo images={["/images/promo.jpg", "/images/promo1.jpg", "/images/promo2.jpg"]} fit="cover" />
                </div>
              </div>
              <div className="absolute -top-3 -right-2 sm:-right-3">
                <div className="animate-pulse rounded-full px-3 py-1 text-xs font-bold bg-emerald-400 text-black ring-4 ring-emerald-400/30 shadow-lg">
                  Só esta semana
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SOBRE */}
        <section id="sobre" className="mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16" style={{ maxWidth: "var(--container-max, 1200px)" }}>
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-2 text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold">Sobre a {brand.name}</h2>
              <p className="mt-4 text-slate-300 leading-relaxed">
                Estúdio gamer/nerd focado em impressão 3D em resina, pintura artística e modelagem sob medida.
              </p>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-300 justify-items-center lg:justify-items-start">
                <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Atendimento via WhatsApp</li>
                <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Envio para todo o Brasil</li>
                <li className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">Pagamento combinado</li>
              </ul>
            </div>
            <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/80">
              <h3 className="font-bold">Especificações</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>• Camadas de 0,01–0,05 mm</li>
                <li>• Resina premium 12K</li>
                <li>• Suporte e pós-processo inclusos</li>
                <li>• Pintura com aerógrafo e pincel</li>
              </ul>
            </div>
          </div>
        </section>

        {/* EM ESTOQUE */}
        <section id="estoque" className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" style={{ maxWidth: "var(--container-max, 1200px)" }}>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Em estoque</h2>
            <span className="text-xs sm:text-sm text-slate-400">{emEstoque.length} item(ns) prontos para envio</span>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
            {emEstoque.map((p) => (
              <ProductCard key={p.id} p={p} addToCart={addToCart} buyNow={buyNow} openViewer={openViewer} openGallery={openGallery} />
            ))}
          </div>
        </section>

        {/* CATÁLOGO + FILTROS */}
        <section id="catalogo" className="mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16" style={{ maxWidth: "var(--container-max, 1200px)" }}>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Catálogo</h2>
            <span className="text-xs sm:text-sm text-slate-400">{catalogoFiltrado.length} modelo(s)</span>
          </div>

          {/* Barra de filtros: chips de tags + busca */}
          <div className="mt-5 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {allTags.map((tag) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ring-1 ring-white/10 ${
                        active ? "bg-teal-400 text-black font-semibold" : "bg-slate-800/60 hover:bg-white/5"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full lg:w-72">
              <input
                type="search"
                placeholder="Buscar por nome…"
                className="w-full rounded-lg bg-slate-800/60 ring-1 ring-white/10 px-3 py-2 text-sm placeholder:text-slate-400"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
            {catalogoFiltrado.map((p) => (
              <ProductCard key={p.id} p={p} addToCart={addToCart} buyNow={buyNow} openViewer={openViewer} openGallery={openGallery} />
            ))}

            {catalogoFiltrado.length === 0 && (
              <div className="col-span-full text-center text-slate-400 text-sm">
                Nenhum item encontrado para “{selectedTag}” {query && `+ "${query}"`}.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="contato" className="mt-auto border-t border-white/10">
        <div className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-sm px-4 sm:px-6 lg:px-8 py-10" style={{ maxWidth: "var(--container-max, 1200px)" }}>
          <div>
            <p className="font-extrabold text-lg">{brand.name}</p>
            <p className="text-slate-400 mt-2">Cultura geek, qualidade de coleção.</p>
          </div>
          <div>
            <p className="font-bold">Pagamento</p>
            <ul className="mt-2 text-slate-300 space-y-1">
              <li>• Finalização pelo WhatsApp</li>
            </ul>
          </div>
          <div>
            <p className="font-bold">Contato</p>
            <ul className="mt-2 text-slate-300 space-y-1">
              <li>WhatsApp: (77) 99821-1169</li>
              <li>E-mail: {brand.email}</li>
              <li>Instagram: {brand.insta}</li>
              <li>Cidade/UF: {brand.city}</li>
            </ul>
          </div>
        </div>
        <div className="text-center text-xs text-slate-500 pb-8">
          © {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.
        </div>
      </footer>

      {/* DRAWER CARRINHO */}
      <div className={`fixed inset-0 z-[60] ${cartOpen ? "visible" : "invisible"}`}>
        <div className={`absolute inset-0 bg-black/50 transition-opacity ${cartOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setCartOpen(false)} />
        <aside className={`absolute right-0 top-0 h-full w-[92vw] sm:w-[420px] bg-slate-900 shadow-xl ring-1 ring-white/10 transition-transform duration-300 ${cartOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <h3 className="font-bold">Seu carrinho</h3>
            <button onClick={() => setCartOpen(false)} className="rounded-lg p-2 ring-1 ring-white/15">
              <span className="material-icons">close</span>
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {cart.length === 0 && <p className="text-slate-400 text-sm">Seu carrinho está vazio.</p>}
            {cart.map((item) => (
              <div key={`${item.id}-${item.escala}-${item.unitPrice}`} className="flex gap-3 items-center rounded-lg p-3 ring-1 ring-white/10 bg-slate-800/40">
                <img src={item.img} alt={item.nome} className="h-16 w-16 object-cover rounded-md" />
                <div className="flex-1">
                  <p className="font-semibold text-sm leading-tight">{item.nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.escala ? `Escala: ${item.escala}` : ""} {item.unitPrice ? `• ${fmtBRL(item.unitPrice)}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1, item.escala, item.unitPrice)} className="rounded px-2 ring-1 ring-white/15">-</button>
                    <span className="min-w-[2ch] text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1, item.escala, item.unitPrice)} className="rounded px-2 ring-1 ring-white/15">+</button>
                  </div>
                </div>
                <button onClick={() => removeItem(item.id, item.escala, item.unitPrice)} className="text-slate-400 hover:text-white">
                  <span className="material-icons">delete</span>
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-semibold">{subtotal > 0 ? fmtBRL(subtotal) : "Definir preços"}</span>
            </div>

            <a
              href={`https://wa.me/${brand.whatsapp}?text=${waMsg}`}
              target="_blank"
              className="block text-center rounded-lg px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
            >
              Finalizar pelo WhatsApp
            </a>
          </div>
        </aside>
      </div>

      {/* MODAL 3D */}
      <Modal open={viewerOpen} onClose={() => setViewerOpen(false)} title={`Visualizador 3D — ${viewerModel.title}`}>
        {viewerModel.src ? <ModelViewer3D src={viewerModel.src} /> : <div className="text-slate-400 text-sm">Selecione um produto com modelo 3D.</div>}
      </Modal>

      {/* MODAL GALERIA (miniaturas + imagem principal sem corte) */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={`Fotos — ${galleryData.title}`}>
        {galleryOpen && (
          <div className="relative">
            {/* Imagem principal na proporção original */}
            <div className="relative w-full grid place-items-center rounded-xl ring-1 ring-white/10 bg-slate-900/60 p-2">
              <img
                key={galleryIndex}
                src={galleryData.imgs[galleryIndex]}
                alt={`${galleryData.title} — ${galleryIndex + 1}`}
                className="max-h-[70vh] w-auto h-auto object-contain rounded-md"
                style={{ maxWidth: "100%" }}
              />

              {galleryData.imgs.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    aria-label="Imagem anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
                  >
                    <span className="material-icons">chevron_left</span>
                  </button>
                  <button
                    onClick={nextImage}
                    aria-label="Próxima imagem"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black/40 hover:bg-black/60 ring-1 ring-white/20"
                  >
                    <span className="material-icons">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas */}
            {galleryData.imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {galleryData.imgs.map((src, idx) => {
                  const active = idx === galleryIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setGalleryIndex(idx)}
                      className={`relative rounded-lg overflow-hidden ring-1 ${
                        active ? "ring-teal-400" : "ring-white/10 hover:ring-white/20"
                      }`}
                      title={`Ver imagem ${idx + 1}`}
                    >
                      <img src={src} alt={`thumb ${idx + 1}`} className="h-16 w-full object-cover" />
                      {active && <span className="absolute inset-0 ring-2 ring-teal-400 rounded-lg pointer-events-none" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
