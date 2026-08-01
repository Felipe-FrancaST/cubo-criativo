import React from "react";
import { isDynamicImportFailure } from "../lib/lazyWithReload.js";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const staleBuild = isDynamicImportFailure(error);
    return (
      <main className="container-cc flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-2xl bg-[#07161d]/70 p-6 text-center ring-1 ring-white/10">
          <h1 className="text-xl font-black text-white">
            {staleBuild ? "O site recebeu uma atualização" : "Não foi possível abrir esta página"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {staleBuild
              ? "Atualize a página para carregar a versão mais recente da Cubo Criativo."
              : "Ocorreu um erro temporário. Atualize a página e tente novamente."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black ring-4 ring-cyan-400/20"
          >
            Atualizar página
          </button>
        </section>
      </main>
    );
  }
}
