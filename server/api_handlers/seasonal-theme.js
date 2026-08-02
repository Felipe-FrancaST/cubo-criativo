import { supabaseAdmin } from "../supabase.js";
import { rateLimit } from "../rateLimit.js";

const VALID_THEMES = new Set(["christmas", "sao_joao", "easter", "halloween", "carnival"]);
const VALID_INTENSITIES = new Set(["subtle", "elegant", "festive"]);

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  theme: "christmas",
  intensity: "elegant",
  animations_enabled: true,
  updated_at: null,
  updated_by: null,
});

function normalizeSettings(value = {}) {
  const theme = String(value?.theme || "").trim().toLowerCase();
  const intensity = String(value?.intensity || "").trim().toLowerCase();
  return {
    enabled: value?.enabled === true,
    theme: VALID_THEMES.has(theme) ? theme : DEFAULT_SETTINGS.theme,
    intensity: VALID_INTENSITIES.has(intensity) ? intensity : DEFAULT_SETTINGS.intensity,
    animations_enabled: value?.animations_enabled !== false,
    updated_at: value?.updated_at || null,
    updated_by: value?.updated_by || null,
  };
}

function isMissingTableError(error) {
  return /site_seasonal_theme|relation|does not exist|schema cache/i.test(String(error?.message || ""));
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { key: "api:seasonal-theme", limit: 120, windowMs: 60000 })) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("site_seasonal_theme")
      .select("enabled,theme,intensity,animations_enabled,updated_at,updated_by")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(200).json({
          settings: DEFAULT_SETTINGS,
          setup_required: true,
        });
      }
      throw error;
    }

    return res.status(200).json({
      settings: normalizeSettings(data || DEFAULT_SETTINGS),
      setup_required: false,
    });
  } catch (error) {
    console.error("seasonal-theme error", error);
    return res.status(200).json({
      settings: DEFAULT_SETTINGS,
      setup_required: true,
    });
  }
}
