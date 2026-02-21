import React from 'react';

export default function TrocasPage({ onGoHome }) {
  return (
    <main className="flex-1">
      <section className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" style={{ maxWidth: 'var(--container-max, 1000px)' }}>
        <div className="flex items-start sm:items-end justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Trocas, devoluções e encomendas</h1>
            <p className="mt-2 text-slate-300 text-sm">Regras gerais para transparência no atendimento.</p>
          </div>
          <button onClick={onGoHome} className="rounded-xl px-4 py-2 ring-1 ring-white/15 hover:bg-white/5 text-sm">Voltar</button>
        </div>
        <div className="mt-8 grid gap-4">
          {[
            ['Peças com defeito ou avaria', 'Entre em contato o quanto antes com fotos e número do pedido para avaliação.'],
            ['Arrependimento (quando aplicável)', 'Solicitações serão analisadas conforme o tipo de peça, estado do item e regras legais aplicáveis.'],
            ['Peças sob encomenda/personalizadas', 'Por serem produzidas sob demanda, podem ter regras específicas de cancelamento e devolução. Combine antes de fechar.'],
            ['Prazo de produção', 'Peças sob encomenda costumam levar de 3 a 7 dias úteis, podendo variar conforme complexidade e fila.'],
            ['Prazo de envio', 'O envio ocorre após confirmação de pagamento e finalização da produção (quando aplicável).'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
              <h2 className="font-bold text-slate-100">{title}</h2>
              <p className="mt-2 text-sm text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
