import React from "react";
import brandConfig from "../data/config";
import { trackEvent } from "../lib/analytics.js";

function IconButton({ title, onClick, children, className = "", ...rest }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-full p-2.5 ring-1 ring-white/12 hover:bg-white/5 transition ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function NavPill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm transition ring-1 ${
        active
          ? "bg-white/10 text-white ring-white/15"
          : "text-slate-300 ring-transparent hover:ring-white/10 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

export default function SiteHeader({
  route,
  user,
  menuOpen,
  onToggleMenu,
  cartCount,
  cartOpen,
  onToggleCart,
  onOpenAuth,
  onOpenOrders,
  onOpenSettings,
  onSignOut,
  onNavigate,
  onGoHomeSection,
}) {
  const brand = brandConfig;
  const [logoAnimate, setLogoAnimate] = React.useState(false);

  function handleLogoClick() {
    setLogoAnimate(true);
    setTimeout(() => setLogoAnimate(false), 350);
    onNavigate("/");
  }

  // nav foi movida para o menu lateral (MenuDrawer) para ganhar espaço no desktop

  return (
    <header className="sticky top-0 z-[90]">
      <div className="backdrop-blur supports-[backdrop-filter]:bg-slate-950/65 bg-slate-950/85 border-b border-white/10">
        <div className="mx-auto w-full" style={{ maxWidth: "var(--container-max, 1320px)" }}>
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
            {/* Menu lateral */}
            <IconButton title={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={onToggleMenu}>
              <span className="material-icons text-[20px]">{menuOpen ? "close" : "menu"}</span>
            </IconButton>

            {/* Logo */}
            <button onClick={handleLogoClick} className="flex items-center gap-3 group shrink-0">
              <span
                className={`bg-white rounded-2xl p-3 shadow-sm transition-transform duration-300 ${
                  logoAnimate ? "scale-110 rotate-3" : "scale-100"
                }`}
              >
                <img src={brand.logo} alt={brand.name} className="h-10 sm:h-12 w-auto object-contain" />
              </span>
              <div className="hidden sm:flex flex-col leading-tight text-left">
                <span className="font-extrabold tracking-tight">{brand.name}</span>
                <span className="text-xs text-slate-400">{brand.slogan}</span>
              </div>
            </button>

            {/* Espaçador */}
            <div className="flex-1" />

            {/* Ações */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {/* Social (desktop) */}
              <div className="hidden md:flex items-center gap-2">
                <a
                  href="https://instagram.com/cubo_criativo3d"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent("social_click", { network: "instagram", location: "header" })}
                  className="inline-flex items-center justify-center rounded-full p-2 ring-1 ring-white/12 hover:bg-white/5"
                  title="Instagram"
                >
                  <img src="/icons/instagram.svg" alt="Instagram" className="h-4 w-4" />
                </a>
                <a
                  href="https://tiktok.com/@cubo.criativo"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent("social_click", { network: "tiktok", location: "header" })}
                  className="inline-flex items-center justify-center rounded-full p-2 ring-1 ring-white/12 hover:bg-white/5"
                  title="TikTok"
                >
                  <img src="/icons/tiktok.svg" alt="TikTok" className="h-4 w-4" />
                </a>

                <a
                  href={`https://wa.me/${brand.whatsapp}`}
                  target="_blank"
                  className="inline-flex items-center justify-center rounded-full p-2 ring-1 ring-white/12 hover:bg-white/5"
                  title="WhatsApp"
                  rel="noreferrer"
                  onClick={() => trackEvent("whatsapp_click", { location: "header" })}
                >
                  <img src="/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4" />
                </a>
              </div>

              {/* Conta */}
              {/* Conta */}
{!user ? (
  <IconButton title="Entrar / Criar conta" onClick={onOpenAuth}>
    <span className="material-icons text-[20px]">person</span>
  </IconButton>
) : null}
{/* Carrinho */}
              <IconButton title={cartOpen ? "Fechar carrinho" : "Carrinho"} onClick={onToggleCart} className="relative">
                <span className="material-icons text-[20px]">{cartOpen ? "close" : "shopping_cart"}</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-teal-400 text-black font-bold rounded-full px-1.5 py-0.5 shadow">
                    {cartCount}
                  </span>
                )}
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
