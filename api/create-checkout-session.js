export const config = { runtime: "nodejs" };

/**
 * Vercel Serverless Function
 * Route: /api/create-checkout-session
 *
 * ✅ Works with plain Stripe HTTP API (no npm dependency).
 *
 * Configure on Vercel (Project Settings -> Environment Variables):
 * - STRIPE_SECRET_KEY=sk_live_...
 */

function getBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function asIntCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function add(params, key, value) {
  if (value === undefined || value === null || value === "") return;
  params.append(key, String(value));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        error:
          "Missing STRIPE_SECRET_KEY. Add it in Vercel -> Project Settings -> Environment Variables.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: "Carrinho vazio." });

    const baseUrl = getBaseUrl(req);

    const params = new URLSearchParams();

    // Core config
    add(params, "mode", "payment");
    add(params, "success_url", `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    add(params, "cancel_url", `${baseUrl}/?payment=cancel`);

    // Payment methods
    add(params, "payment_method_types[0]", "card");

    // Address/phone collection (helpful for physical products)
    add(params, "billing_address_collection", "required");
    add(params, "phone_number_collection[enabled]", "true");
    add(params, "shipping_address_collection[allowed_countries][0]", "BR");

    // Custom field: CPF
    add(params, "custom_fields[0][key]", "cpf");
    add(params, "custom_fields[0][label][type]", "custom");
    add(params, "custom_fields[0][label][custom]", "CPF");
    add(params, "custom_fields[0][type]", "text");
    add(params, "custom_fields[0][text][minimum_length]", "11");
    add(params, "custom_fields[0][text][maximum_length]", "14");
    add(params, "custom_fields[0][optional]", "false");

    // Line items
    items.forEach((it, idx) => {
      const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
      const unit_amount = asIntCents(it.unitPrice);
      if (!unit_amount) {
        throw new Error(
          "Existem itens sem preço. Defina os preços no catálogo antes de pagar."
        );
      }

      const nameParts = [String(it.nome || "Produto").trim()];
      if (it.escala) nameParts.push(`(${String(it.escala).trim()})`);
      const name = nameParts.join(" ");

      const img = typeof it.img === "string" ? it.img : "";
      const absImg = img && img.startsWith("/") ? `${baseUrl}${img}` : img;

      add(params, `line_items[${idx}][quantity]`, qty);
      add(params, `line_items[${idx}][price_data][currency]`, "brl");
      add(params, `line_items[${idx}][price_data][unit_amount]`, unit_amount);
      add(params, `line_items[${idx}][price_data][product_data][name]`, name);
      if (absImg) {
        add(
          params,
          `line_items[${idx}][price_data][product_data][images][0]`,
          absImg
        );
      }
      add(params, `line_items[${idx}][price_data][product_data][metadata][product_id]`, it.id || "");
      add(params, `line_items[${idx}][price_data][product_data][metadata][escala]`, it.escala || "");
    });

    // Metadata
    add(params, "metadata[source]", "cubo-criativo");

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg =
        data?.error?.message || data?.error || "Erro ao criar checkout.";
      return res.status(500).json({ error: msg, details: data });
    }

    return res.status(200).json({ url: data.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Erro ao criar checkout.",
      details: err?.message || String(err),
    });
  }
}
