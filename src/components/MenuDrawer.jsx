import React from "react";
import { focusFirst, handleFocusTrapKeydown } from "../lib/a11y.js";
import brandConfig from "../data/config";
import { trackEvent } from "../lib/analytics.js";

function DrawerButton({ icon, children, onClick, right }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl px-2.5 sm:px-4 py-2 sm:py-3 ring-1 ring-white/10 hover:bg-white/4 transition"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="material-icons text-[16px] sm:text-[20px] text-slate-200">{icon}</span>
        <span className="text-sm text-slate-100 truncate">{children}</span>
      </span>
      {right ? <span className="material-icons text-[18px] text-slate-400">{right}</span> : null}
    </button>
  );
}

export default function MenuDrawer({
  open,
  onClose,
  route,
  user,
  isAdmin,
  isVip,
  onNavigate,
  onGoHomeSection,
  onOpenAuth,
  onOpenOrders,
  onOpenVipArea,
  onOpenSettings,
  onSignOut,
}) {
  const brand = brandConfig;
  const panelRef = React.useRef(null);
  const lastFocusRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[145] ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-[#020b10]/65 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className={`absolute left-0 top-0 h-full w-[88vw] sm:w-[380px] bg-[#05131a]/95 backdrop-blur shadow-xl ring-1 ring-white/10 transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2">
              <img
                src={brand.logo}
                alt={brand.name}
                className="site-logo h-7 w-auto"
                style={{ height: 32, width: "auto" }}
              />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold">{brand.name}</p>
              <p className="text-xs text-slate-400">Menu</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/4" aria-label="Fechar menu">
            <span className="material-icons">close</span>
          </button>
        </div>

        
<div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-76px)]">
  <div className="space-y-2">
    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase px-1">Loja</p>
    <DrawerButton icon="home" onClick={() => { onNavigate("/"); onClose?.(); }}>
      Início
    </DrawerButton>
    <DrawerButton icon="view_module" onClick={() => { onNavigate("/catalogo"); onClose?.(); }}>
      Catálogo
    </DrawerButton>
    <DrawerButton icon="local_shipping" onClick={() => { onNavigate("/estoque"); onClose?.(); }}>
      Pronta entrega
    </DrawerButton>
    <DrawerButton icon="local_offer" onClick={() => { onNavigate("/promocoes"); onClose?.(); }}>
      Promoções
    </DrawerButton>
    <DrawerButton icon="redeem" onClick={() => { onNavigate("/cupom"); onClose?.(); }}>
      Cubo Game
    </DrawerButton>
  </div>

  <div className="space-y-2">
    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase px-1">Clube</p>
    <DrawerButton
      icon="stars"
      onClick={() => {
        // Um único CTA no menu:
        // - não VIP: "Se torne VIP" -> planos
        // - VIP: "Área VIP" -> área
        if (isVip) onNavigate("/area-vip");
        else onNavigate("/planos-vip");
        onClose?.();
      }}
    >
      {isVip ? "Área VIP" : "Se torne VIP"}
    </DrawerButton>
  </div>

  <div className="space-y-2">
    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase px-1">Minha conta</p>

    {user ? (
      <DrawerButton
        icon="receipt_long"
        onClick={() => {
          onOpenOrders?.();
          onClose?.();
        }}
        right="chevron_right"
      >
        Meus pedidos
      </DrawerButton>
    ) : null}

    {!user ? (
      <DrawerButton
        icon="person"
        right="chevron_right"
        onClick={() => {
          onOpenAuth?.();
          onClose?.();
        }}
      >
        Entrar / Criar conta
      </DrawerButton>
    ) : (
      <>
        <div className="rounded-xl bg-white/4 ring-1 ring-white/10 px-4 py-3">
          <p className="text-xs text-slate-400">Logado como</p>
          <p className="mt-1 text-sm text-slate-100 break-all">{user.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              onOpenSettings?.("profile");
              onClose?.();
            }}
            className="rounded-xl px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/4 transition flex items-center gap-2 justify-center"
          >
            <span className="material-icons text-[18px]">person</span>
            Perfil
          </button>

          <button
            onClick={() => {
              onOpenSettings?.("settings");
              onClose?.();
            }}
            className="rounded-xl px-4 py-3 text-sm ring-1 ring-white/10 hover:bg-white/4 transition flex items-center gap-2 justify-center"
          >
            <span className="material-icons text-[18px]">settings</span>
            Ajustes
          </button>
        </div>

        {isAdmin ? (
          <DrawerButton
            icon="admin_panel_settings"
            right="chevron_right"
            onClick={() => {
              onNavigate("/admin");
              onClose?.();
            }}
          >
            Admin — Painel
          </DrawerButton>
        ) : null}

        <DrawerButton
          icon="settings"
          right="chevron_right"
          onClick={() => {
            onOpenSettings?.("settings");
            onClose?.();
          }}
        >
          Configurações
        </DrawerButton>

        <DrawerButton
          icon="logout"
          onClick={() => {
            onSignOut?.();
            onClose?.();
          }}
        >
          Sair
        </DrawerButton>
      </>
    )}
  </div>

  <div className="space-y-2">
    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase px-1">Ajuda</p>
    <DrawerButton icon="reviews" onClick={() => { onNavigate("/avaliacoes"); onClose?.(); }}>
      Avaliações de clientes
    </DrawerButton>
    <DrawerButton icon="help_outline" onClick={() => { onNavigate("/faq"); onClose?.(); }}>
      FAQ
    </DrawerButton>
    <DrawerButton icon="swap_horiz" onClick={() => { onNavigate("/trocas-e-devolucoes"); onClose?.(); }}>
      Trocas / devoluções
    </DrawerButton>
    <DrawerButton icon="info" onClick={() => { onNavigate("/sobre"); onClose?.(); }}>
      Sobre a empresa
    </DrawerButton>
    <DrawerButton icon="support_agent" onClick={() => { onNavigate("/contato"); onClose?.(); }}>
      Contato
    </DrawerButton>

    <a
      href="/privacy.html"
      className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/4 transition"
      onClick={() => { trackEvent("legal_click", { page: "privacy", location: "menu" }); onClose?.(); }}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="material-icons text-[20px] text-slate-200">policy</span>
        <span className="text-sm text-slate-100 truncate">Política de Privacidade</span>
      </span>
      <span className="material-icons text-[18px] text-slate-400">open_in_new</span>
    </a>

    <a
      href="/terms.html"
      className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/4 transition"
      onClick={() => { trackEvent("legal_click", { page: "terms", location: "menu" }); onClose?.(); }}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="material-icons text-[20px] text-slate-200">gavel</span>
        <span className="text-sm text-slate-100 truncate">Termos de Serviço</span>
      </span>
      <span className="material-icons text-[18px] text-slate-400">open_in_new</span>
    </a>
  </div>

<div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href="https://instagram.com/cubo_criativo3d"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/4"
              title="Instagram"
              onClick={() => trackEvent("social_click", { network: "instagram", location: "menu" })}
            >
              <img src="/icons/instagram.svg" alt="Instagram" className="h-4 w-4" />
            </a>
            <a
              href="https://tiktok.com/@cubo.criativo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/4"
              title="TikTok"
              onClick={() => trackEvent("social_click", { network: "tiktok", location: "menu" })}
            >
              <img src="/icons/tiktok.svg" alt="TikTok" className="h-4 w-4" />
            </a>
            <a
              href={`https://wa.me/${brand.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/4"
              title="WhatsApp"
              onClick={() => trackEvent("whatsapp_click", { location: "menu" })}
            >
              <img src="/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
