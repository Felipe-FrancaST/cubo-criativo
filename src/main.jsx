import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { FavoritesProvider } from './state/FavoritesProvider.jsx'
import './index.css' // pode ficar vazio, mas vamos usar pra qualquer ajuste seu
import './styles/mobile.css'
import './styles/customer.css'
import { Analytics } from '@vercel/analytics/react'
import { isSupabaseConfigured } from './lib/supabaseClient.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <AuthProvider>
        <FavoritesProvider>
          <App />
        </FavoritesProvider>
        <Analytics />
      </AuthProvider>
    ) : (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101e2b] p-8 text-center">
          <img
            src="/images/logo.png"
            alt="Cubo Criativo"
            className="mx-auto mb-6 h-16 w-auto"
          />
          <h1 className="text-xl font-semibold">
            A loja está temporariamente indisponível
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Tente acessar novamente em instantes.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-6"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )}
  </React.StrictMode>
)
