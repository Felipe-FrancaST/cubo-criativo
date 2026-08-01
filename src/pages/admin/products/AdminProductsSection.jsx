import React from "react";
import { supabase } from "../../../lib/supabaseClient.js";
import { SectionTitle } from "../orders/AdminOrdersComponents.jsx";
import {
  EMPTY_PRODUCT_FORM,
  formatCents,
  getNormalPriceCents,
  parseBrlToCents,
  productRowToForm,
  safeImageFileName,
  slugifyProduct,
  splitTags,
} from "./adminProductUtils.js";

function productStoragePathFromUrl(value) {
  const url = String(value || "");
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  try {
    return decodeURIComponent(url.slice(index + marker.length));
  } catch {
    return url.slice(index + marker.length);
  }
}

const PRODUCT_SELECT = [
  "id",
  "sku",
  "name",
  "slug",
  "description",
  "price_cents",
  "original_price_cents",
  "currency",
  "stock",
  "active",
  "featured",
  "promo",
  "image_url",
  "images",
  "status",
  "tags",
  "category",
  "sort_order",
  "created_at",
  "updated_at",
].join(",");

function FieldLabel({ children, required = false }) {
  return (
    <span className="text-sm font-medium text-slate-200">
      {children}
      {required ? <span className="ml-1 text-cyan-300">*</span> : null}
    </span>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10 transition hover:bg-white/[0.04]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-cyan-300"
      />
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}

function ProductStat({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.025] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-white">{value}</div>
        </div>
        <span className="material-icons rounded-2xl bg-cyan-300/10 p-2.5 text-cyan-200 ring-1 ring-cyan-300/15">{icon}</span>
      </div>
    </div>
  );
}

function ProductCard({ product, onEdit, onToggleActive, busyId }) {
  const normalCents = getNormalPriceCents(product);
  const currentCents = Number(product?.price_cents || 0);
  const isBusy = busyId === product.id;

  return (
    <article className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10 transition hover:bg-white/[0.035]">
      <div className="flex gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-950/60 ring-1 ring-white/10">
          {product?.image_url ? (
            <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center text-slate-600">
              <span className="material-icons">image_not_supported</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-bold text-white">{product.name}</h3>
              <div className="mt-1 truncate text-xs text-slate-500">/p/{product.slug}</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${product.active ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20" : "bg-slate-500/10 text-slate-300 ring-white/10"}`}>
              {product.active ? "Publicado" : "Rascunho"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {product.promo && normalCents > currentCents ? (
              <>
                <span className="text-xs text-slate-500 line-through">{formatCents(normalCents)}</span>
                <span className="font-black text-emerald-300">{formatCents(currentCents)}</span>
              </>
            ) : (
              <span className="font-black text-slate-100">{formatCents(currentCents)}</span>
            )}
            {product.promo ? <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-black">PROMO</span> : null}
            {product.featured ? <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-300/20">DESTAQUE</span> : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
            <span className="rounded-full bg-white/[0.04] px-2 py-1 ring-1 ring-white/10">{product.status === "estoque" ? "Pronta entrega" : "Catálogo"}</span>
            <span className="rounded-full bg-white/[0.04] px-2 py-1 ring-1 ring-white/10">Estoque: {Number(product.stock || 0)}</span>
            {product.category ? <span className="rounded-full bg-white/[0.04] px-2 py-1 ring-1 ring-white/10">{product.category}</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.06]"
        >
          <span className="material-icons mr-1 align-middle text-[16px]">edit</span>
          Editar
        </button>
        <a
          href={`/p/${encodeURIComponent(product.slug)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl px-3 py-2 text-center text-xs font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.06]"
        >
          <span className="material-icons mr-1 align-middle text-[16px]">open_in_new</span>
          Página
        </a>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onToggleActive(product)}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-50"
        >
          <span className="material-icons mr-1 align-middle text-[16px]">{product.active ? "visibility_off" : "visibility"}</span>
          {isBusy ? "..." : product.active ? "Ocultar" : "Publicar"}
        </button>
      </div>
    </article>
  );
}

export default function AdminProductsSection({ onNotify }) {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [form, setForm] = React.useState(EMPTY_PRODUCT_FORM);
  const [imageFile, setImageFile] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const formRef = React.useRef(null);

  const loadProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error?.message || "Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  React.useEffect(() => {
    if (!imageFile) {
      setImagePreview(form.imageUrl || "");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, form.imageUrl]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleNameChange(value) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugifyProduct(value),
    }));
  }

  function resetForm() {
    setForm(EMPTY_PRODUCT_FORM);
    setImageFile(null);
    setImagePreview("");
    setFormError("");
    setSlugTouched(false);
    setLastSaved(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(product) {
    setForm(productRowToForm(product));
    setImageFile(null);
    setFormError("");
    setSlugTouched(true);
    setLastSaved(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function handleFile(file) {
    setFormError("");
    if (!file) {
      setImageFile(null);
      return;
    }
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowed.has(String(file.type || "").toLowerCase())) {
      setFormError("Envie uma imagem JPG, PNG, WEBP ou AVIF.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (Number(file.size || 0) > 10 * 1024 * 1024) {
      setFormError("A imagem deve ter no máximo 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
  }

  async function ensureUniqueSlug(rawSlug, editingId) {
    const base = slugifyProduct(rawSlug || form.name) || `produto-${Date.now()}`;
    const { data, error } = await supabase
      .from("products")
      .select("id,slug")
      .limit(1000);
    if (error) throw error;

    const used = new Set(
      (data || [])
        .filter((row) => String(row.id) !== String(editingId || ""))
        .map((row) => String(row.slug || ""))
    );
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }

  async function uploadImage(file, slug) {
    if (!file) return { url: form.imageUrl || "", path: "" };
    const fileName = safeImageFileName(file.name);
    const path = `admin/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${fileName}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw new Error(error.message || "Não foi possível enviar a imagem.");
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    const publicUrl = String(data?.publicUrl || "");
    if (!publicUrl) throw new Error("O Supabase não retornou a URL pública da imagem.");
    return { url: publicUrl, path };
  }

  async function saveProduct(event) {
    event?.preventDefault?.();
    if (saving) return;

    setFormError("");
    setLastSaved(null);

    const name = String(form.name || "").trim();
    const description = String(form.description || "").trim();
    const normalPriceCents = parseBrlToCents(form.normalPrice);
    const promoPriceCents = form.promo ? parseBrlToCents(form.promoPrice) : 0;
    const stock = Math.max(0, Math.trunc(Number(form.stock || 0)));
    const sortOrder = Math.trunc(Number(form.sortOrder || 1000));

    if (name.length < 2) return setFormError("Informe o nome do produto.");
    if (description.length < 10) return setFormError("Escreva uma descrição com pelo menos 10 caracteres.");
    if (normalPriceCents <= 0) return setFormError("Informe um valor normal válido.");
    if (form.promo && promoPriceCents <= 0) return setFormError("Informe o valor promocional.");
    if (form.promo && promoPriceCents >= normalPriceCents) return setFormError("O valor promocional precisa ser menor que o valor normal.");
    if (!form.id && !imageFile && !form.imageUrl) return setFormError("Selecione a imagem do produto.");

    let uploadedUrl = "";
    let uploadedPath = "";
    try {
      setSaving(true);
      const slug = await ensureUniqueSlug(form.slug, form.id);
      const uploadResult = await uploadImage(imageFile, slug);
      uploadedUrl = uploadResult.url;
      uploadedPath = uploadResult.path;

      const payload = {
        name,
        slug,
        description,
        price_cents: form.promo ? promoPriceCents : normalPriceCents,
        original_price_cents: normalPriceCents,
        currency: "brl",
        stock,
        active: Boolean(form.active),
        featured: Boolean(form.featured),
        promo: Boolean(form.promo),
        image_url: uploadedUrl,
        images: imageFile
          ? [uploadedUrl]
          : (Array.isArray(form.existingImages) && form.existingImages.length
            ? form.existingImages
            : (uploadedUrl ? [uploadedUrl] : [])),
        status: form.status === "estoque" ? "estoque" : "catalogo",
        tags: splitTags(form.tags),
        category: String(form.category || "").trim() || null,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 1000,
      };

      let response;
      if (form.id) {
        response = await supabase.from("products").update(payload).eq("id", form.id).select(PRODUCT_SELECT).single();
      } else {
        response = await supabase.from("products").insert(payload).select(PRODUCT_SELECT).single();
      }
      if (response.error) throw response.error;

      const saved = response.data;

      if (imageFile && form.imageUrl && form.imageUrl !== uploadedUrl) {
        const previousPath = productStoragePathFromUrl(form.imageUrl);
        if (previousPath) {
          supabase.storage.from("product-images").remove([previousPath]).catch(() => {});
        }
      }

      setProducts((current) => {
        const remaining = current.filter((item) => item.id !== saved.id);
        return [saved, ...remaining];
      });
      setLastSaved(saved);
      onNotify?.(form.id ? "✅ Produto atualizado com sucesso." : "✅ Produto cadastrado e publicado no site.");
      window.dispatchEvent(new CustomEvent("products:changed", { detail: { product: saved } }));

      if (!form.id) {
        setForm({ ...EMPTY_PRODUCT_FORM, slug: "" });
        setImageFile(null);
        setSlugTouched(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setForm(productRowToForm(saved));
        setImageFile(null);
        setSlugTouched(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from("product-images").remove([uploadedPath]).catch(() => {});
      }
      const message = String(error?.message || "Não foi possível salvar o produto.");
      if (/row-level security|policy|permission|not authorized/i.test(message)) {
        setFormError("O Supabase bloqueou a operação. Execute o SQL de permissões do bucket product-images incluído no projeto e confirme que sua conta está na tabela admins.");
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product) {
    if (!product?.id || busyId) return;
    try {
      setBusyId(product.id);
      const { data, error } = await supabase
        .from("products")
        .update({ active: !product.active })
        .eq("id", product.id)
        .select(PRODUCT_SELECT)
        .single();
      if (error) throw error;
      setProducts((current) => current.map((item) => (item.id === data.id ? data : item)));
      window.dispatchEvent(new CustomEvent("products:changed", { detail: { product: data } }));
      onNotify?.(data.active ? "✅ Produto publicado." : "🙈 Produto ocultado do site.");
    } catch (error) {
      onNotify?.(`Erro: ${error?.message || "não foi possível alterar o produto."}`);
    } finally {
      setBusyId("");
    }
  }

  const stats = React.useMemo(() => ({
    total: products.length,
    active: products.filter((item) => item.active).length,
    promo: products.filter((item) => item.promo && item.active).length,
    featured: products.filter((item) => item.featured && item.active).length,
  }), [products]);

  const filteredProducts = React.useMemo(() => {
    const query = String(search || "").trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (filter === "active" && !product.active) return false;
      if (filter === "draft" && product.active) return false;
      if (filter === "promo" && !product.promo) return false;
      if (filter === "featured" && !product.featured) return false;
      if (!query) return true;
      const haystack = [product.name, product.slug, product.description, product.category, ...(product.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [filter, products, search]);

  const editing = Boolean(form.id);

  return (
    <div className="space-y-4">
      <SectionTitle
        icon="inventory"
        title="Produtos"
        subtitle="Cadastre produtos, envie a imagem e controle publicação, promoção, destaque e estoque."
        right={(
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={loadProducts} disabled={loading} className="flex-1 rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05] disabled:opacity-50 sm:flex-none">
              <span className="material-icons mr-1 align-middle text-[17px]">refresh</span>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            <button type="button" onClick={() => { resetForm(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="flex-1 rounded-xl bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 ring-4 ring-cyan-300/20 sm:flex-none">
              <span className="material-icons mr-1 align-middle text-[17px]">add</span>
              Novo produto
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ProductStat label="Total" value={stats.total} icon="inventory_2" />
        <ProductStat label="Publicados" value={stats.active} icon="visibility" />
        <ProductStat label="Em promoção" value={stats.promo} icon="local_offer" />
        <ProductStat label="Em destaque" value={stats.featured} icon="star" />
      </div>

      {loadError ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">{loadError}</div> : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.35fr)]">
        <form ref={formRef} onSubmit={saveProduct} className="scroll-mt-28 rounded-[28px] bg-gradient-to-br from-white/[0.06] to-white/[0.025] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-white/10 sm:p-5 xl:sticky xl:top-24">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black text-white">{editing ? "Editar produto" : "Cadastrar produto"}</div>
              <div className="mt-1 text-xs text-slate-400">Os campos com * são obrigatórios.</div>
            </div>
            {editing ? <button type="button" onClick={resetForm} className="rounded-xl px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05]">Cancelar edição</button> : null}
          </div>

          {formError ? <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/25">{formError}</div> : null}
          {lastSaved ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-400/20">
              <div className="font-bold">Produto salvo.</div>
              <a href={`/p/${encodeURIComponent(lastSaved.slug)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline underline-offset-4">
                Abrir /p/{lastSaved.slug}
                <span className="material-icons text-[15px]">open_in_new</span>
              </a>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div>
              <FieldLabel required>Imagem do produto</FieldLabel>
              <label className="mt-2 block cursor-pointer overflow-hidden rounded-2xl bg-black/20 ring-1 ring-white/10 transition hover:ring-cyan-300/30">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => handleFile(event.target.files?.[0] || null)} className="sr-only" />
                <div className="grid min-h-52 place-items-center p-3">
                  {imagePreview ? (
                    <div className="relative h-52 w-full overflow-hidden rounded-xl bg-slate-950/60">
                      <img src={imagePreview} alt="Pré-visualização do produto" className="h-full w-full object-contain" />
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-1 text-[11px] text-white ring-1 ring-white/15">Trocar imagem</span>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <span className="material-icons text-4xl text-cyan-200">add_photo_alternate</span>
                      <div className="mt-2 font-semibold text-white">Toque para selecionar a imagem</div>
                      <div className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP ou AVIF • máximo 10 MB</div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <label className="block">
              <FieldLabel required>Nome do produto</FieldLabel>
              <input value={form.name} onChange={(event) => handleNameChange(event.target.value)} placeholder="Ex.: Guerreiro Esqueleto" className="mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
            </label>

            <label className="block">
              <FieldLabel required>URL do produto</FieldLabel>
              <div className="mt-2 flex rounded-xl bg-black/20 ring-1 ring-white/10 focus-within:ring-cyan-300/40">
                <span className="grid place-items-center border-r border-white/10 px-3 text-sm text-slate-500">/p/</span>
                <input value={form.slug} onChange={(event) => { setSlugTouched(true); updateForm("slug", slugifyProduct(event.target.value)); }} placeholder="nome-do-produto" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none" />
              </div>
              <span className="mt-1 block text-xs text-slate-500">Caso já exista, o sistema acrescenta um número automaticamente.</span>
            </label>

            <label className="block">
              <FieldLabel required>Descrição</FieldLabel>
              <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={5} placeholder="Descreva material, tamanho, acabamento, prazo e diferenciais da peça." className="mt-2 w-full resize-y rounded-xl bg-black/20 px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
              <span className="mt-1 block text-right text-xs text-slate-500">{form.description.length} caracteres</span>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel required>Valor normal</FieldLabel>
                <div className="mt-2 flex rounded-xl bg-black/20 ring-1 ring-white/10 focus-within:ring-cyan-300/40">
                  <span className="grid place-items-center border-r border-white/10 px-3 text-sm text-slate-400">R$</span>
                  <input value={form.normalPrice} onChange={(event) => updateForm("normalPrice", event.target.value)} inputMode="decimal" placeholder="250,00" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none" />
                </div>
              </label>

              <label className={`block ${form.promo ? "" : "opacity-50"}`}>
                <FieldLabel>Valor promocional</FieldLabel>
                <div className="mt-2 flex rounded-xl bg-black/20 ring-1 ring-white/10 focus-within:ring-cyan-300/40">
                  <span className="grid place-items-center border-r border-white/10 px-3 text-sm text-slate-400">R$</span>
                  <input disabled={!form.promo} value={form.promoPrice} onChange={(event) => updateForm("promoPrice", event.target.value)} inputMode="decimal" placeholder="199,90" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none disabled:cursor-not-allowed" />
                </div>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle checked={form.promo} onChange={(checked) => updateForm("promo", checked)} label="Está em promoção" hint="Exibe o preço normal riscado e o valor promocional." />
              <Toggle checked={form.featured} onChange={(checked) => updateForm("featured", checked)} label="Produto em destaque" hint="Pode aparecer na seção de destaques da página inicial." />
              <Toggle checked={form.active} onChange={(checked) => updateForm("active", checked)} label="Publicado no site" hint="Desative para salvar como rascunho." />
              <Toggle checked={form.status === "estoque"} onChange={(checked) => updateForm("status", checked ? "estoque" : "catalogo")} label="Pronta entrega" hint="Ative para exibir também na página Em estoque." />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Categoria</FieldLabel>
                <select value={form.category} onChange={(event) => updateForm("category", event.target.value)} className="mt-2 w-full rounded-xl bg-[#07161d] px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40">
                  <option value="action figures">Action figures</option>
                  <option value="rpg">RPG</option>
                  <option value="outros">Outros</option>
                </select>
              </label>
              <label className="block">
                <FieldLabel>Estoque</FieldLabel>
                <input type="number" min="0" step="1" value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
              </label>
            </div>

            <label className="block">
              <FieldLabel>Tags</FieldLabel>
              <input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} placeholder="Anime, personagem, série — separe por vírgulas" className="mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
              <span className="mt-1 block text-xs text-slate-500">As tags ajudam nos filtros e na busca do catálogo.</span>
            </label>

            <label className="block">
              <FieldLabel>Ordem de exibição</FieldLabel>
              <input type="number" step="1" value={form.sortOrder} onChange={(event) => updateForm("sortOrder", event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
              <span className="mt-1 block text-xs text-slate-500">Números menores aparecem primeiro. O padrão é 1000.</span>
            </label>
          </div>

          <div className="sticky bottom-2 z-10 mt-5 rounded-2xl bg-[#07161d]/95 p-2 ring-1 ring-white/10 backdrop-blur sm:static sm:bg-transparent sm:p-0 sm:ring-0">
            <button type="submit" disabled={saving} className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3.5 font-black text-slate-950 shadow-[0_12px_30px_rgba(103,232,249,0.18)] ring-4 ring-cyan-300/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0">
              <span className="material-icons mr-2 align-middle text-[19px]">{editing ? "save" : "add_circle"}</span>
              {saving ? "Salvando produto..." : editing ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </div>
        </form>

        <section className="rounded-[28px] bg-gradient-to-br from-white/[0.06] to-white/[0.025] p-4 ring-1 ring-white/10 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-lg font-black text-white">Produtos cadastrados</div>
              <div className="mt-1 text-xs text-slate-400">Edite, abra a página ou altere a publicação sem sair do painel.</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_170px] lg:w-[520px]">
              <div className="relative">
                <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">search</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto..." className="w-full rounded-xl bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40" />
              </div>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl bg-[#07161d] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none">
                <option value="all">Todos</option>
                <option value="active">Publicados</option>
                <option value="draft">Rascunhos</option>
                <option value="promo">Em promoção</option>
                <option value="featured">Em destaque</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{filteredProducts.length} de {products.length} produto(s)</span>
            {loading ? <span>Carregando...</span> : null}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onEdit={startEdit} onToggleActive={toggleActive} busyId={busyId} />
            ))}
          </div>

          {!loading && !filteredProducts.length ? (
            <div className="mt-4 rounded-2xl bg-black/20 px-4 py-10 text-center text-slate-400 ring-1 ring-white/10">
              <span className="material-icons text-4xl text-slate-600">inventory_2</span>
              <div className="mt-2 font-semibold text-slate-300">Nenhum produto encontrado</div>
              <div className="mt-1 text-sm">Ajuste a busca ou cadastre o primeiro produto.</div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
