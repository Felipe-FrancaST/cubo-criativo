import React from 'react'
import brand from '../data/config.js'
import { legalDocuments, legalUpdated } from '../data/legal.js'

export default function LegalDocument({ kind, onGoHome }) {
  const doc = legalDocuments[kind]
  return (
    <main className="flex-1">
      <article className="container-cc legal-document px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">{doc.title}</h1>
            <p className="mt-3 text-sm text-slate-300">
              {brand.name} · CNPJ: {brand.cnpj}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Última atualização: {legalUpdated}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoHome}
            className="customer-secondary"
          >
            Voltar ao site
          </button>
        </header>
        <p className="mt-6 text-slate-300 leading-7">{doc.intro}</p>
        <nav aria-label="Nesta página" className="legal-summary">
          {doc.sections.map(([title], index) => (
            <a key={title} href={`#legal-${index + 1}`}>
              {index + 1}. {title}
            </a>
          ))}
        </nav>
        {doc.sections.map(([title, paragraphs], index) => (
          <section
            key={title}
            id={`legal-${index + 1}`}
            className="legal-section"
          >
            <h2 className="text-lg font-bold">
              {index + 1}. {title}
            </h2>
            {paragraphs.map((text) => (
              <p key={text} className="mt-3 text-slate-300 leading-7">
                {text}
              </p>
            ))}
          </section>
        ))}
        <section className="legal-section" aria-label="Canais de atendimento">
          <h2 className="text-lg font-bold">Fale com a Cubo Criativo</h2>
          <p className="mt-3">
            <a href={`mailto:${brand.email}`}>{brand.email}</a>
          </p>
          <p className="mt-3">
            <a
              href={`https://wa.me/${brand.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp: (77) 99847-2372
            </a>
          </p>
          <p className="mt-3 text-sm text-slate-300">
            Segunda a sexta, das 09h às 18h · {brand.city}
          </p>
        </section>
        <nav className="legal-summary" aria-label="Políticas da loja">
          {Object.entries(legalDocuments)
            .filter(([key]) => key !== kind)
            .map(([key, item]) => (
              <a key={key} href={item.path}>
                {item.title}
              </a>
            ))}
        </nav>
      </article>
    </main>
  )
}
