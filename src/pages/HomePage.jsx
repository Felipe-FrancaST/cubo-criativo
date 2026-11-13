import React from 'react'
import CarrosselPromo from '../components/CarrosselPromo.jsx'
import HomeShelf from '../components/HomeShelf.jsx'
import ReviewCard from '../components/ReviewCard.jsx'
import { supabase } from '../lib/supabaseClient'

const FALLBACK_BANNER = {
  image_url: '/images/banner_base_pc.jpg',
  mobile_image_url: '/images/banner_base.jpg',
}

function resolveBannerImage(banner, isMobile) {
  if (isMobile && banner?.mobile_image_url) return banner.mobile_image_url
  return banner?.image_url || ''
}

export default function HomePage({
  featured,
  prontaEntregaPreview = [],
  rpgPreview = [],
  loadingProducts = false,
  productsError = '',
  addToCart,
  buyNow,
  openGallery,
  onGoEstoque,
  onGoCatalogo,
  onGoSobEncomenda,
  onGoPromocoes,
  onGoFaq,
  onGoPoliticas,
  onGoCupom,
  onGoCustomMiniatures,
  onGoVipPlans,
  onGoReviews,
  onRequireLogin,
}) {
  const [depoimentos, setDepoimentos] = React.useState([])
  const [loadingDepoimentos, setLoadingDepoimentos] = React.useState(true)
  const [banner, setBanner] = React.useState(FALLBACK_BANNER)
  const [bannerLoading, setBannerLoading] = React.useState(true)
  const [bannerImageLoaded, setBannerImageLoaded] = React.useState(false)
  const [displayBannerImage, setDisplayBannerImage] = React.useState(
    FALLBACK_BANNER.image_url
  )
  const [bannerOverlayVisible, setBannerOverlayVisible] = React.useState(false)
  const [isMobileBanner, setIsMobileBanner] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 640px)').matches
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsMobileBanner(media.matches)
    sync()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setBannerLoading(true)
        // Prefer images published through the admin; retain legacy/local fallbacks.
        try {
          const response = await fetch('/api/core?action=home-banner')
          const result = response.ok ? await response.json() : null
          if (!alive) return
          if (result?.banner?.image_url && result?.banner?.mobile_image_url) {
            setBanner(result.banner)
            return
          }
        } catch {
          /* Keep the previous banner source when the service is unavailable. */
        }
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('home_banners')
          .select('id,image_url,mobile_image_url')
          .eq('is_active', true)
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .or(`ends_at.is.null,ends_at.gte.${now}`)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error
        if (!alive) return

        if (data) {
          setBanner({
            ...FALLBACK_BANNER,
            ...data,
          })
        } else {
          setBanner(FALLBACK_BANNER)
        }
      } catch (e) {
        console.warn(
          'Não foi possível carregar banner da home:',
          e?.message || e
        )
        if (alive) setBanner(FALLBACK_BANNER)
      } finally {
        if (alive) setBannerLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoadingDepoimentos(true)
        let response = await supabase
          .from('customer_reviews_public')
          .select(
            'id,rating,comment,display_name,city,state,product_names,product_slugs,featured,created_at,approved_at'
          )
          .order('featured', { ascending: false })
          .order('approved_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(6)
        if (
          response.error &&
          /customer_reviews_public/i.test(String(response.error.message || ''))
        ) {
          response = await supabase
            .from('customer_reviews')
            .select(
              'id,rating,comment,display_name,city,state,product_names,product_slugs,featured,created_at'
            )
            .eq('approved', true)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(6)
        }
        if (response.error) throw response.error
        if (!alive) return
        setDepoimentos(Array.isArray(response.data) ? response.data : [])
      } catch (e) {
        if (!alive) return
        console.warn('Não foi possível carregar depoimentos:', e?.message || e)
        setDepoimentos([])
      } finally {
        if (alive) setLoadingDepoimentos(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const bannerImage = resolveBannerImage(banner, isMobileBanner)
  const fallbackBannerImage = resolveBannerImage(
    FALLBACK_BANNER,
    isMobileBanner
  )

  React.useEffect(() => {
    let alive = true

    if (!bannerImage || bannerImage === fallbackBannerImage) {
      setDisplayBannerImage(fallbackBannerImage)
      setBannerOverlayVisible(false)
      setBannerImageLoaded(true)
      return () => {
        alive = false
      }
    }

    setBannerImageLoaded(false)
    setBannerOverlayVisible(false)

    const img = new window.Image()
    img.src = bannerImage
    img.onload = () => {
      if (!alive) return
      setDisplayBannerImage(bannerImage)
      setBannerImageLoaded(true)
      if (
        typeof window !== 'undefined' &&
        typeof window.requestAnimationFrame === 'function'
      ) {
        window.requestAnimationFrame(() => {
          if (alive) setBannerOverlayVisible(true)
        })
      } else {
        setBannerOverlayVisible(true)
      }
    }
    img.onerror = () => {
      if (!alive) return
      setDisplayBannerImage(fallbackBannerImage)
      setBannerOverlayVisible(false)
      setBannerImageLoaded(true)
    }

    return () => {
      alive = false
    }
  }, [bannerImage, fallbackBannerImage])

  const shelfProps = { addToCart, buyNow, openGallery, onRequireLogin }

  return (
    <main className="storefront-page editorial-page editorial-home flex-1">
      <div className="container-cc editorial-container">
        <section className="editorial-hero-grid" aria-label="Boas-vindas à Cubo Criativo">
          <div className="editorial-hero-copy">
            <p className="editorial-kicker"><span className="editorial-dot" /> MINIATURAS E ACTION FIGURES</p>
            <h1>Seu universo favorito, <em>em cada detalhe.</em></h1>
            <p>Peças em resina para colecionadores e aventureiros de RPG. Explore o catálogo e encontre sua próxima miniatura.</p>
            <div className="editorial-hero-actions">
              <button type="button" className="editorial-button editorial-button-primary" onClick={onGoEstoque}>Pronta entrega <span className="material-icons" aria-hidden="true">arrow_forward</span></button>
              <button type="button" className="editorial-button editorial-button-secondary" onClick={onGoCatalogo}>Explorar catálogo</button>
            </div>
            <div className="editorial-hero-footnote"><span className="material-icons" aria-hidden="true">auto_awesome</span> Modelos exclusivos e detalhes que fazem a diferença</div>
          </div>
          <div className="editorial-hero-promo" id="promocoes">
            <div className="editorial-promo-heading"><div><span className="editorial-kicker"><span className="editorial-dot"/> OFERTAS ESPECIAIS</span><h2>Escolhas da semana</h2></div><button type="button" onClick={onGoPromocoes} aria-label="Ver todas as promoções" className="editorial-arrow-button"><span className="material-icons" aria-hidden="true">arrow_forward</span></button></div>
            <CarrosselPromo className="editorial-carousel" onActivate={onGoPromocoes} />
          </div>
        </section>

        <section className="editorial-shortcuts" aria-label="Explore a loja">
          <button type="button" onClick={onGoCustomMiniatures}><span className="editorial-shortcut-icon"><span className="material-icons">view_in_ar</span></span><span><strong>Peça personalizada</strong><small>Transforme sua ideia em miniatura</small></span><span className="material-icons editorial-shortcut-arrow" aria-hidden="true">arrow_forward</span></button>
          <button type="button" onClick={onGoCupom}><span className="editorial-shortcut-icon"><span className="material-icons">sports_esports</span></span><span><strong>Cubo Game</strong><small>Jogue e descubra seu cupom</small></span><span className="material-icons editorial-shortcut-arrow" aria-hidden="true">arrow_forward</span></button>
          <button type="button" onClick={onGoSobEncomenda}><span className="editorial-shortcut-icon"><span className="material-icons">casino</span></span><span><strong>Miniaturas RPG</strong><small>Personagens para sua aventura</small></span><span className="material-icons editorial-shortcut-arrow" aria-hidden="true">arrow_forward</span></button>
        </section>

        <HomeShelf id="destaques" eyebrow="ESCOLHIDOS PARA VOCÊ" title="Destaques da loja" description="Uma seleção especial para sua coleção." products={featured} loading={loadingProducts} error={productsError} emptyMessage="Nenhum destaque no momento." actionLabel="Ver catálogo" onAction={onGoCatalogo} {...shelfProps}/>

        <section className="editorial-vip-banner" aria-label="Planos VIP">
          <a href="/planos-vip" onClick={(event) => { event.preventDefault(); if (typeof onGoVipPlans === 'function') onGoVipPlans(); else window.location.href = '/planos-vip' }} aria-label="Conheça os planos VIP da Cubo Criativo">
            <div className="editorial-vip-media">
              <img src={fallbackBannerImage} alt="" loading="lazy" decoding="async" />
              {displayBannerImage && displayBannerImage !== fallbackBannerImage && <img className={`editorial-vip-custom ${bannerOverlayVisible ? 'is-visible' : ''}`} src={displayBannerImage} alt="" loading="lazy" decoding="async"/>}
              {bannerLoading || !bannerImageLoaded ? <span className="editorial-vip-loading" aria-hidden="true"/> : null}
            </div>
            <span className="editorial-vip-link">Conheça os planos VIP <span className="material-icons" aria-hidden="true">arrow_forward</span></span>
          </a>
        </section>

        <HomeShelf eyebrow="PEÇAS DISPONÍVEIS" title="Pronta entrega" description="Descubra peças disponíveis em nosso estoque." products={prontaEntregaPreview} loading={loadingProducts} error={productsError} emptyMessage="Sem itens de pronta entrega por enquanto." actionLabel="Ver estoque" onAction={onGoEstoque} {...shelfProps}/>
        <HomeShelf eyebrow="PARA SUA PRÓXIMA AVENTURA" title="Miniaturas RPG" description="Heróis, criaturas e personagens que ganham vida na mesa." products={rpgPreview} loading={loadingProducts} error={productsError} emptyMessage="Estamos preparando os destaques de RPG." actionLabel="Ver miniaturas" onAction={onGoSobEncomenda} {...shelfProps}/>

        <section className="editorial-custom-banner">
          <span className="editorial-custom-icon material-icons" aria-hidden="true">auto_fix_high</span>
          <div><p className="editorial-kicker"><span className="editorial-dot"/> CRIAÇÃO PERSONALIZADA</p><h2>Uma peça que é só sua.</h2><p>Envie imagens, escolha busto ou miniatura e conte como imagina seu projeto.</p></div>
          <button type="button" className="editorial-button editorial-button-primary" onClick={onGoCustomMiniatures}>Criar minha miniatura <span className="material-icons" aria-hidden="true">arrow_forward</span></button>
        </section>

        <section className="editorial-section editorial-reviews-preview">
          <header className="editorial-section-heading"><div className="editorial-section-heading-copy"><p className="editorial-kicker"><span className="editorial-dot"/> EXPERIÊNCIAS REAIS</p><h2>Quem comprou, recomenda</h2><p className="editorial-section-description">Veja as avaliações de quem já recebeu suas peças.</p></div><button type="button" className="editorial-text-action" onClick={onGoReviews}>Ver avaliações <span className="material-icons" aria-hidden="true">arrow_forward</span></button></header>
          {loadingDepoimentos ? <div className="editorial-review-grid">{Array.from({length:3}).map((_,i)=><div className="editorial-review-skeleton" key={i} aria-hidden="true"/>)}</div> : depoimentos.length === 0 ? <p className="editorial-empty">Ainda não há avaliações publicadas.</p> : <div className="editorial-review-grid">{depoimentos.slice(0,3).map((review)=><ReviewCard key={review.id} review={review} compact/>)}</div>}
        </section>
        <section className="editorial-help-banner"><div><p className="editorial-kicker"><span className="editorial-dot"/> PRECISA DE AJUDA?</p><h2>Dúvidas antes de comprar?</h2><p>Encontre informações sobre produção, frete, pagamentos e devoluções.</p></div><div className="editorial-help-actions"><button type="button" className="editorial-button editorial-button-primary" onClick={onGoFaq}>Perguntas frequentes</button><button type="button" className="editorial-button editorial-button-secondary" onClick={onGoPoliticas}>Ver políticas</button></div></section>
      </div>
    </main>
  )
}
