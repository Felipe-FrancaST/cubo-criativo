import React from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function StockPage({ items, addToCart, buyNow, openViewer, openGallery }) {
  return (
    <main className="flex-1">
      <section
        className="mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
        style={{ maxWidth: "var(--container-max, 1200px)" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Em estoque</h1>
            <p className="mt-1 text-sm text-slate-400">Peças prontas para envio.</p>
          </div>
          <span className="text-xs sm:text-sm text-slate-400">{items.length} item(ns)</span>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
          {items.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              addToCart={addToCart}
              buyNow={buyNow}
              openViewer={openViewer}
              openGallery={openGallery}
            />
          ))}

          {items.length === 0 && (
            <div className="col-span-full text-center text-slate-400 text-sm">
              Nenhum item em estoque no momento.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
