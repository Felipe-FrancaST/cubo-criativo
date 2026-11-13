/**
 * Usa exatamente o mesmo indicador de promoção utilizado pela página /promocoes.
 * O carrossel não consulta tabelas de banners e nunca mostra imagens estáticas
 * quando não existem ofertas com fotografias disponíveis.
 */
export function getPromotionSlides(products) {
  if (!Array.isArray(products)) return [];
  return products
    .filter((product) => product?.promo === true && product?.active !== false)
    .map((product) => ({
      ...product,
      carouselImage: String(product.img || '').trim() || String(product.imgs?.find((image) => String(image || '').trim()) || '').trim(),
    }))
    .filter((product) => Boolean(product.carouselImage));
}
