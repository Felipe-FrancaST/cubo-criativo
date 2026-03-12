import React from "react";
import ProfileSettingsModal from "../components/ProfileSettingsModal.jsx";

export default function SettingsPage({
  initialTab = "profile",
  onGoBack,
  onRequireLogin,
  onNavigate,
  onSignOut,
  onSaved,
}) {
  return (
    <div className="min-h-[calc(100vh-96px)] px-3 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => onGoBack?.()}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-white/10 hover:bg-white/4"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
            <span className="text-sm">Voltar</span>
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-100">Minha conta</p>
            <p className="text-xs text-slate-400">Perfil e configurações</p>
          </div>

          <div className="w-[88px]" />
        </div>

        {/* Conteúdo (sem modal/overlay) */}
        <ProfileSettingsModal
          open={true}
          mode="page"
          initialTab={initialTab}
          onRequireLogin={onRequireLogin}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          onSaved={onSaved}
          onClose={onGoBack}
        />
      </div>
    </div>
  );
}
