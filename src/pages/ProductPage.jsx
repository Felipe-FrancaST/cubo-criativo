import React from "react";
import "../styles/product-page.css";
import { fmtBRL, centsToBRL, getVariantPricingCents, percentOffCents } from "../lib/pricing.js";
import { supabase } from "../lib/supabaseClient.js";
import ScaleSelectionModal from "../components/ScaleSelectionModal.jsx";
import { requiresScaleChoice } from "../lib/scaleSelection.js";
import { useFavorites } from "../state/FavoritesProvider.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

function uniqueImages(product) {
  return Array.from(
    new Set(
      [product?.img, ...(Array.isArray(product?.imgs) ? product.imgs : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export default function ProductPage({ slug, product, loading, onBack, addToCart, buyNow, openGallery, onRequireLogin }) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [favoriteBusy, setFavoriteBusy] = React.useState(false);
  const [favoriteError, setFavoriteError] = React.useState("");
  const touchStart = React.useRef(null);
  const swipeHandled = React.useRef(false);
  const activeThumb = React.useRef(null);
  const defaultIndex = Math.max(0, product?.variants?.findIndex((v) => v.label === product.defaultVariant) ?? 0);
  const [selIndex, setSelIndex] = React.useState(defaultIndex);
  const [selectedExplicitly, setSelectedExplicitly] = React.useState(false);
  const [scaleAction, setScaleAction] = React.useState(null);
  const [productReviews, setProductReviews] = React.useState([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(false);
  const [imgErrorMap, setImgErrorMap] = React.useState({});
  const galleryImages = React.useMemo(() => uniqueImages(product), [product]);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);

  React.useEffect(() => {
    setSelIndex(defaultIndex);
    setSelectedExplicitly(false);
    setScaleAction(null);
    setActiveImageIndex(0);
    setImgErrorMap({});
    setFavoriteError("");
    touchStart.current = null;
    swipeHandled.current = false;
  }, [defaultIndex, slug]);

  React.useEffect(() => {
    let alive = true;
    if (!product?.id && !product?.slug && !product?.nome) {
      setProductReviews([]);
      return undefined;
    }
    (async () => {
      setReviewsLoading(true);
      try {
        let response = await supabase
          .from("customer_reviews_public")
          .select("id,rating,comment,display_name,city,state,product_ids,product_slugs,product_names,featured,created_at,approved_at")
          .order("featured", { ascending: false })
          .order("approved_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(80);
        if (response.error && /customer_reviews_public/i.test(String(response.error.message || ""))) {
          response = await supabase
            .from("customer_reviews")
            .select("id,rating,comment,display_name,city,state,product_ids,product_slugs,product_names,featured,created_at")
            .eq("approved", true)
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(80);
        }
        if (response.error) throw response.error;
        const id = String(product?.id || "").toLowerCase();
        const productSlug = String(product?.slug || slug || "").toLowerCase();
        const name = String(product?.nome || "").trim().toLowerCase();
        const matches = (response.data || [])
          .filter((review) => {
            const ids = Array.isArray(review.product_ids)
              ? review.product_ids.map((value) => String(value).toLowerCase())
              : [];
            const slugs = Array.isArray(review.product_slugs)
              ? review.product_slugs.map((value) => String(value).toLowerCase())
              : [];
            const names = Array.isArray(review.product_names)
              ? review.product_names.map((value) => String(value).trim().toLowerCase())
              : [];
            return (id && ids.includes(id)) || (productSlug && slugs.includes(productSlug)) || (name && names.includes(name));
          })
          .slice(0, 6);
        if (alive) setProductReviews(matches);
      } catch {
        if (alive) setProductReviews([]);
      } finally {
        if (alive) setReviewsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [product?.id, product?.slug, product?.nome, slug]);

  React.useEffect(() => {
    const thumb = activeThumb.current;
    const strip = thumb?.parentElement;
    if (!thumb || !strip) return;
    const left = thumb.offsetLeft;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (left + thumb.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = left + thumb.offsetWidth - strip.clientWidth;
  }, [activeImageIndex]);

  if (loading) {
    return (
      <main className="product-page-shell product-page-shell--state">
        <section className="product-page-wrap">
          <div className="product-page-state-card">
            <p>Carregando produto…</p>
          </div>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-page-shell product-page-shell--state">
        <section className="product-page-wrap">
          <div className="product-page-state-card">
            <h1>Produto não encontrado</h1>
            <p>O link pode estar errado ou o produto foi removido.</p>
            <button type="button" onClick={onBack} className="product-page-button product-page-button--primary">
              Voltar
            </button>
          </div>
        </section>
      </main>
    );
  }

  const outOfStock = typeof product?.stock === "number" && Number.isFinite(product.stock) && product.stock <= 0;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const pricing = getVariantPricingCents(product, selIndex, defaultIndex);
  const escala = pricing.sel?.label ?? product.escala ?? "";
  const needsScale = requiresScaleChoice(product);
  const currentPrice = centsToBRL(pricing.currentCents);
  const originalPrice = centsToBRL(pricing.originalCents);
  const off = percentOffCents(pricing.originalCents, pricing.currentCents);
  const activeImage = galleryImages[activeImageIndex] || galleryImages[0] || product.img;
  const visibleTags = Array.isArray(product?.tags) ? product.tags.slice(0, 12) : [];
  const statusLabel = outOfStock ? "Esgotado" : "Disponível";

  const favorite = isFavorite(product.id);
  async function handleFavorite() {
    if (!user) { onRequireLogin?.("Faça login para favoritar."); return; }
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    setFavoriteError("");
    try {
      const result = await toggleFavorite(product.id);
      if (!result.ok) setFavoriteError("Não foi possível atualizar os favoritos. Tente novamente.");
    } finally { setFavoriteBusy(false); }
  }
  function changeImage(delta) {
    if (galleryImages.length > 1)
      setActiveImageIndex((index) => (index + delta + galleryImages.length) % galleryImages.length);
  }
  function startPurchase(action) {
    if (needsScale) {
      setScaleAction(action);
      return;
    }
    const choice = { escala, unitPrice: currentPrice };
    if (action === "buy") buyNow?.(product, choice);
    else addToCart?.(product, choice);
  }

  return (
    <main className="product-page-shell">
      <section className="product-page-wrap">
        <nav className="product-page-topbar" aria-label="Navegação do produto">
          <button type="button" onClick={onBack} className="product-page-backlink">
            <span aria-hidden="true">←</span>
            <span>Voltar</span>
          </button>
          <a href="/catalogo" className="product-page-catalog-link">
            Ver catálogo completo
          </a>
        </nav>

        <div className="product-page-panel">
          <div className="product-page-grid">
            <section className="product-gallery-card">
              <div className="product-gallery-stage">
                <button
                  type="button"
                  className="product-gallery-open"
                  onClick={() => {
                    if (!swipeHandled.current && galleryImages.length) openGallery?.(product, activeImageIndex);
                    swipeHandled.current = false;
                  }}
                  onTouchStart={(event) => {
                    swipeHandled.current = false;
                    touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
                  }}
                  onTouchEnd={(event) => {
                    const start = touchStart.current;
                    touchStart.current = null;
                    if (!start || !event.changedTouches.length || galleryImages.length < 2) return;
                    const dx = event.changedTouches[0].clientX - start.x;
                    const dy = event.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                      swipeHandled.current = true;
                      changeImage(dx < 0 ? 1 : -1);
                    }
                  }}
                  onTouchCancel={() => { touchStart.current = null; swipeHandled.current = false; }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      changeImage(event.key === "ArrowRight" ? 1 : -1);
                    }
                  }}
                  aria-label={`Ampliar imagem ${activeImageIndex + 1} de ${galleryImages.length} de ${product.nome}`}
                  disabled={!galleryImages.length}
                >
                  {activeImage && !imgErrorMap[activeImage] ? (
                    <img src={activeImage} alt={product.nome} loading="eager" decoding="async" className="product-gallery-image"
                      onError={() => setImgErrorMap((current) => ({ ...current, [activeImage]: true }))} />
                  ) : <span className="product-gallery-missing">Imagem indisponível.</span>}
                  {galleryImages.length > 0 && <span className="product-gallery-expand material-icons" aria-hidden="true">zoom_in</span>}
                </button>
                {off > 0 && <span className="product-badge product-badge--promo product-gallery-discount">-{off}%</span>}
                {galleryImages.length > 1 && <>
                  <button type="button" className="product-gallery-arrow is-prev" aria-label="Foto anterior" onClick={() => changeImage(-1)}><span className="material-icons" aria-hidden="true">chevron_left</span></button>
                  <button type="button" className="product-gallery-arrow is-next" aria-label="Próxima foto" onClick={() => changeImage(1)}><span className="material-icons" aria-hidden="true">chevron_right</span></button>
                  <span className="product-gallery-count" aria-live="polite">{activeImageIndex + 1} / {galleryImages.length}</span>
                </>}
              </div>

              {galleryImages.length > 1 ? (
                <div className="product-gallery-thumbs" aria-label="Miniaturas da galeria">
                  {galleryImages.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      ref={index === activeImageIndex ? activeThumb : null}
                      className={`product-gallery-thumb ${index === activeImageIndex ? "is-active" : ""}`}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Ver imagem ${index + 1} de ${galleryImages.length}`}
                      aria-pressed={index === activeImageIndex}
                    >
                      <img src={image} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <aside className="product-summary-card">
              <div className="product-summary-head">
                <div className="product-summary-text">
                  <h1>{product.nome}</h1>
                </div>
                <button type="button" className={`product-page-favorite ${favorite ? "is-favorite" : ""}`} aria-pressed={favorite} aria-label={favorite ? "Remover dos favoritos" : "Favoritar"} title={favorite ? "Remover dos favoritos" : "Favoritar"} onClick={handleFavorite} disabled={favoriteBusy}>
                  <span className="material-icons" aria-hidden="true">{favorite ? "favorite" : "favorite_border"}</span>
                </button>
              </div>

              {favoriteError && <p className="product-favorite-error" role="status">{favoriteError}</p>}
              <div className="product-price-block">
                {pricing.showStrike && originalPrice > currentPrice ? (
                  <>
                    <span className="product-price-original">{fmtBRL(originalPrice)}</span>
                    <div className="product-price-current-row">
                      <strong className="product-price-current">{fmtBRL(currentPrice)}</strong>
                      {off > 0 ? <span className="product-discount-chip">{off}% OFF</span> : null}
                    </div>
                  </>
                ) : (
                  <strong className="product-price-current">{fmtBRL(currentPrice)}</strong>
                )}
                <span className={`product-status-chip ${outOfStock ? "is-out" : ""}`}>{statusLabel}</span>
              </div>

              {hasVariants ? (
                <div className="product-option-card">
                  <div className="product-option-head">
                    <h2>Escolha a escala</h2>
                    <span>Seleção obrigatória para garantir o valor correto.</span>
                  </div>
                  <div className="product-option-select-wrap">
                    <select
                      aria-label="Escala da miniatura"
                      className="product-option-select"
                      value={selIndex}
                      onChange={(event) => {
                        setSelIndex(Number(event.target.value));
                        setSelectedExplicitly(true);
                      }}
                    >
                      {product.variants.map((variant, index) => (
                        <option key={variant.label} value={index}>
                          {variant.label} — {fmtBRL(centsToBRL(getVariantPricingCents(product, index, defaultIndex).currentCents))}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="product-purchase-actions">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => startPurchase("add")}
                  className={`product-page-button product-page-button--primary ${outOfStock ? "is-disabled" : ""}`}
                >
                  {outOfStock ? "Esgotado" : "Adicionar ao carrinho"}
                </button>
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => startPurchase("buy")}
                  className={`product-page-button product-page-button--secondary ${outOfStock ? "is-disabled" : ""}`}
                >
                  {outOfStock ? "Esgotado" : "Comprar agora"}
                </button>
              </div>

              {product?.descricao ? (
                <div className="product-copy-card">
                  <h2>Descrição</h2>
                  <p>{product.descricao}</p>
                </div>
              ) : (
                <div className="product-copy-card">
                  <h2>Descrição</h2>
                  <p>A descrição desta peça ainda não foi disponibilizada.</p>
                </div>
              )}

              {visibleTags.length ? (
                <div className="product-tags-wrap">
                  {visibleTags.map((tag) => (
                    <span key={tag} className="product-tag-chip">{tag}</span>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>

          <section className="product-reviews-card">
            <div className="product-reviews-head">
              <div>
                <p className="product-summary-kicker">Compras verificadas</p>
                <h2>Avaliações deste produto</h2>
              </div>
              <a href="/avaliacoes" className="product-page-catalog-link">Ver todas</a>
            </div>
            {reviewsLoading ? (
              <div className="product-reviews-grid">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="product-review-skeleton" />
                ))}
              </div>
            ) : null}
            {!reviewsLoading && !productReviews.length ? (
              <div className="product-reviews-empty">Ainda não há avaliações públicas vinculadas a este produto.</div>
            ) : null}
            {!reviewsLoading && productReviews.length ? (
              <div className="product-reviews-grid">
                {productReviews.map((review) => {
                  const location = [review.city, review.state].filter(Boolean).join("/");
                  return (
                    <article
                      key={review.id}
                      className={`product-review-card ${review.featured ? "is-featured" : ""}`}
                    >
                      <div className="product-review-stars" aria-label={`${review.rating} estrelas`}>
                        {"★".repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}
                      </div>
                      <p className="product-review-comment">“{review.comment}”</p>
                      <p className="product-review-author">
                        {review.display_name || "Cliente verificado"}
                        {location ? ` • ${location}` : ""}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </section>
      {scaleAction ? (
        <ScaleSelectionModal
          product={product}
          action={scaleAction}
          initialScale={selectedExplicitly ? escala : ""}
          onClose={() => setScaleAction(null)}
          onConfirm={(choice) => {
            if (scaleAction === "buy") buyNow?.(product, choice);
            else addToCart?.(product, choice);
          }}
        />
      ) : null}
    </main>
  );
}
