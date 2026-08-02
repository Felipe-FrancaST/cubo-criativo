export const SEASONAL_THEME = Object.freeze({
  CHRISTMAS: "christmas",
  SAO_JOAO: "sao_joao",
  EASTER: "easter",
  HALLOWEEN: "halloween",
  CARNIVAL: "carnival",
});

export const SEASONAL_INTENSITY = Object.freeze({
  SUBTLE: "subtle",
  ELEGANT: "elegant",
  FESTIVE: "festive",
});

export const SEASONAL_THEME_OPTIONS = Object.freeze([
  {
    id: SEASONAL_THEME.CHRISTMAS,
    name: "Natal",
    icon: "auto_awesome",
    description: "Luzes douradas, pinheiros discretos e flocos luminosos.",
  },
  {
    id: SEASONAL_THEME.SAO_JOAO,
    name: "São João",
    icon: "local_fire_department",
    description: "Bandeirinhas elegantes, balões decorativos e brilho de fogueira.",
  },
  {
    id: SEASONAL_THEME.EASTER,
    name: "Páscoa",
    icon: "spa",
    description: "Tons pastéis, ovos ornamentais e pequenos detalhes florais.",
  },
  {
    id: SEASONAL_THEME.HALLOWEEN,
    name: "Halloween",
    icon: "dark_mode",
    description: "Lua violeta, teias finas, morcegos e pontos de luz âmbar.",
  },
  {
    id: SEASONAL_THEME.CARNIVAL,
    name: "Carnaval",
    icon: "celebration",
    description: "Confetes metálicos, fitas fluidas e máscara festiva sofisticada.",
  },
]);

export const SEASONAL_INTENSITY_OPTIONS = Object.freeze([
  {
    id: SEASONAL_INTENSITY.SUBTLE,
    name: "Sutil",
    description: "Poucos elementos e movimento mínimo.",
  },
  {
    id: SEASONAL_INTENSITY.ELEGANT,
    name: "Elegante",
    description: "Equilíbrio entre identidade visual e discrição.",
  },
  {
    id: SEASONAL_INTENSITY.FESTIVE,
    name: "Festiva",
    description: "Mais partículas e presença visual, sem bloquear o conteúdo.",
  },
]);

const VALID_THEMES = new Set(SEASONAL_THEME_OPTIONS.map((item) => item.id));
const VALID_INTENSITIES = new Set(SEASONAL_INTENSITY_OPTIONS.map((item) => item.id));

export const DEFAULT_SEASONAL_SETTINGS = Object.freeze({
  enabled: false,
  theme: SEASONAL_THEME.CHRISTMAS,
  intensity: SEASONAL_INTENSITY.ELEGANT,
  animations_enabled: true,
  updated_at: null,
  updated_by: null,
});

export function normalizeSeasonalTheme(value) {
  const theme = String(value || "").trim().toLowerCase();
  return VALID_THEMES.has(theme) ? theme : DEFAULT_SEASONAL_SETTINGS.theme;
}

export function normalizeSeasonalIntensity(value) {
  const intensity = String(value || "").trim().toLowerCase();
  return VALID_INTENSITIES.has(intensity) ? intensity : DEFAULT_SEASONAL_SETTINGS.intensity;
}

export function normalizeSeasonalSettings(value = {}) {
  return {
    enabled: value?.enabled === true,
    theme: normalizeSeasonalTheme(value?.theme),
    intensity: normalizeSeasonalIntensity(value?.intensity),
    animations_enabled: value?.animations_enabled !== false,
    updated_at: value?.updated_at || null,
    updated_by: value?.updated_by || null,
  };
}

export function seasonalThemeLabel(value) {
  const theme = normalizeSeasonalTheme(value);
  return SEASONAL_THEME_OPTIONS.find((item) => item.id === theme)?.name || "Decoração";
}
