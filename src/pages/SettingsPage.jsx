import React from 'react'
import ProfileSettingsModal from '../components/ProfileSettingsModal.jsx'

export default function SettingsPage({
  initialTab = 'profile',
  onGoBack,
  onRequireLogin,
  onNavigate,
  onSignOut,
  onSaved,
}) {
  return (
    <main className="customer-page settings-page">
      <div className="container-cc customer-page-inner">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Tudo sobre sua conta</p>
            <h1>Configurações da conta</h1>
            <p className="customer-subtitle">
              Cadastro, segurança e benefícios em um só lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoBack?.()}
            className="customer-secondary"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
            <span className="text-sm">Voltar</span>
          </button>
        </header>

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
    </main>
  )
}
