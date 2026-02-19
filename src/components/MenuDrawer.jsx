import React from "react";
import brandConfig from "../data/config";

function DrawerButton({ icon, children, onClick, right }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/5 transition"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="material-icons text-[20px] text-slate-200">{icon}</span>
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
  onNavigate,
  onGoHomeSection,
  onOpenAuth,
  onOpenOrders,
  onOpenSettings,
  onSignOut,
  onToggleRpg,
  rpgMode,
}) {
  const brand = brandConfig;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[145] ${open ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <aside
        className={`absolute left-0 top-0 h-full w-[88vw] sm:w-[380px] bg-slate-950/95 backdrop-blur shadow-xl ring-1 ring-white/10 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2">
              <img src={brand.logo} alt={brand.name} className="h-8 w-auto" />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold">{brand.name}</p>
              <p className="text-xs text-slate-400">Menu</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 ring-1 ring-white/15 hover:bg-white/5">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-76px)]">
          <DrawerButton icon="home" onClick={() => { onNavigate("/"); onClose?.(); }}>
            Início
          </DrawerButton>
          <DrawerButton icon="local_offer" onClick={() => { onNavigate("/promocoes"); onClose?.(); }}>
            Promoções
          </DrawerButton>
          <DrawerButton icon="inventory_2" onClick={() => { onNavigate("/estoque"); onClose?.(); }}>
            Estoque
          </DrawerButton>
          <DrawerButton icon="view_module" onClick={() => { onNavigate("/catalogo"); onClose?.(); }}>
            Catálogo
          </DrawerButton>
          <DrawerButton icon="contact_support" onClick={() => { onGoHomeSection("contato"); onClose?.(); }}>
            Contato
          </DrawerButton>
          <DrawerButton icon="groups" onClick={() => { onNavigate("/sobre"); onClose?.(); }}>
            Sobre nós
          </DrawerButton>

          <div className="my-3 h-px bg-white/10" />

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
              <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3">
                <p className="text-xs text-slate-400">Logado como</p>
                <p className="mt-1 text-sm text-slate-100 break-all">{user.email}</p>
              </div>
              <DrawerButton
                icon="receipt_long"
                right="chevron_right"
                onClick={() => {
                  onOpenOrders?.();
                  onClose?.();
                }}
              >
                Meus pedidos
              </DrawerButton>

              {isAdmin ? (
                <DrawerButton
                  icon="admin_panel_settings"
                  right="chevron_right"
                  onClick={() => {
                    onNavigate("/admin");
                    onClose?.();
                  }}
                >
                  Admin — Pedidos
                </DrawerButton>
              ) : null}
              <DrawerButton
                icon="settings"
                right="chevron_right"
                onClick={() => {
                  onOpenSettings?.();
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

          <div className="my-3 h-px bg-white/10" />

          <DrawerButton
            icon={rpgMode ? "close" : "casino"}
            onClick={() => {
              onToggleRpg?.();
              onClose?.();
            }}
          >
            {rpgMode ? "Sair do modo RPG" : "Modo RPG"}
          </DrawerButton>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href="https://instagram.com/_cubocriativo_"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/5"
              title="Instagram"
            >
              <img src="/icons/instagram.svg" alt="Instagram" className="h-4 w-4" />
            </a>
            <a
              href="https://tiktok.com/@cubo.criativo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/5"
              title="TikTok"
            >
              <img src="/icons/tiktok.svg" alt="TikTok" className="h-4 w-4" />
            </a>
            <a
              href={`https://wa.me/${brand.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl px-3 py-3 ring-1 ring-white/10 hover:bg-white/5"
              title="WhatsApp"
            >
              <img src="/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
