import React from 'react';

export default function TermosPage({ onGoHome }) {
  return (
    <main className="flex-1">
      <section className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" style={{ maxWidth: 'var(--container-max, 1000px)' }}>
        <div className="flex items-start sm:items-end justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Termos de uso</h1>
            <p className="mt-2 text-slate-300 text-sm">Condições gerais de navegação, compra e atendimento.</p>
          </div>
          <button onClick={onGoHome} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm">Voltar</button>
        </div>
        <div className="mt-8 space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">Ao utilizar o site, você concorda com as regras de navegação, cadastro e compra aqui descritas.</div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">As informações de produtos, preços e disponibilidade podem ser atualizadas a qualquer momento, sem aviso prévio, respeitando pedidos já concluídos.</div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">As imagens e descrições têm caráter ilustrativo, podendo existir pequenas variações de acabamento, cor e escala conforme produção artesanal.</div>
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">Em caso de dúvidas, prevalece o atendimento pelos canais oficiais da loja.</div>
        </div>
      </section>
    </main>
  );
}
