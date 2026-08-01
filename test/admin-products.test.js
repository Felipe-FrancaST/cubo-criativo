import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrlToCents,
  productRowToForm,
  slugifyProduct,
  splitTags,
} from "../src/pages/admin/products/adminProductUtils.js";

test("converte valor brasileiro para centavos", () => {
  assert.equal(parseBrlToCents("R$ 1.299,90"), 129990);
  assert.equal(parseBrlToCents("250,00"), 25000);
});

test("gera slug seguro e separa tags sem duplicação", () => {
  assert.equal(slugifyProduct("Dragão Élfico — Edição 2"), "dragao-elfico-edicao-2");
  assert.equal(slugifyProduct("cubo_45"), "cubo_45");
  assert.deepEqual(splitTags("RPG, Dragão; RPG\nElfo"), ["RPG", "Dragão", "Elfo"]);
});

test("mapeia preço promocional para o formulário sem perder imagens", () => {
  const form = productRowToForm({
    id: "1",
    name: "Produto",
    slug: "produto",
    promo: true,
    price_cents: 19990,
    original_price_cents: 25000,
    image_url: "https://example.com/main.png",
    images: ["https://example.com/main.png", "https://example.com/extra.png"],
  });

  assert.equal(form.normalPrice, "250,00");
  assert.equal(form.promoPrice, "199,90");
  assert.equal(form.existingImages.length, 2);
});

test("carrega escalas, preços e escala padrão no formulário", () => {
  const form = productRowToForm({
    id: "2",
    name: "Miniatura RPG",
    price_cents: 2500,
    original_price_cents: 2500,
    default_variant: "32 mm",
    variants: [
      { label: "28 mm", price_cents: 2000 },
      { label: "32 mm", price_cents: 2500 },
    ],
  });

  assert.deepEqual(form.variants, [
    { label: "28 mm", price: "20,00" },
    { label: "32 mm", price: "25,00" },
  ]);
  assert.equal(form.defaultVariantIndex, 1);
  assert.equal(form.normalPrice, "25,00");
});
