import React from 'react';

export default function CustomerOrdersLandingPage({ user, orderId = '', onOpenOrders, onRequireLogin, onGoHome }) {
  return (
    <main className="flex-1">
      <section className="container-cc px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.96))] p-6 sm:p-8 shadow-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20">
            <span className="material-icons text-3xl">inventory_2</span>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Área do cliente</p>
          <h1 className="mt-2 text-3xl font-black text-white">Meus pedidos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Consulte pagamento, produção, rastreamento, itens comprados e avaliações. Quando o link vier de um e-mail, o pedido indicado será aberto automaticamente.
          </p>
          {orderId ? (
            <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">
              Abrindo o pedido <b>#{String(orderId).slice(0, 8)}</b>.
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => user ? onOpenOrders?.() : onRequireLogin?.('Faça login para acessar seus pedidos.')}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 ring-4 ring-cyan-400/15"
            >
              {user ? 'Abrir meus pedidos' : 'Entrar para continuar'}
            </button>
            <button type="button" onClick={onGoHome} className="rounded-2xl px-5 py-3 font-semibold text-slate-100 ring-1 ring-white/15 hover:bg-white/5">
              Voltar ao site
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
