import React from "react";
import {
  DEFAULT_SEASONAL_SETTINGS,
  normalizeSeasonalSettings,
  SEASONAL_THEME,
} from "../lib/seasonalTheme.js";

const CACHE_KEY = "cc_seasonal_theme_cache_v1";
const UPDATE_EVENT = "cc:seasonal-theme-updated";

function readCachedSettings() {
  if (typeof window === "undefined") return DEFAULT_SEASONAL_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
    return normalizeSeasonalSettings(parsed || DEFAULT_SEASONAL_SETTINGS);
  } catch {
    return DEFAULT_SEASONAL_SETTINGS;
  }
}

function cacheSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeSeasonalSettings(settings)));
  } catch {}
}

function buildParticles(count = 28) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: (index * 37 + 11) % 100,
    drift: ((index * 29) % 27) - 13,
    delay: -((index * 0.73) % 10),
    duration: 8 + ((index * 17) % 9),
    size: 4 + ((index * 7) % 8),
    rotation: (index * 47) % 360,
  }));
}

const PARTICLES = buildParticles();

function ChristmasTop() {
  return (
    <div className="seasonal-top seasonal-top--christmas">
      <div className="seasonal-garland-line" />
      <div className="seasonal-lights">
        {Array.from({ length: 15 }, (_, index) => (
          <span key={index} className="seasonal-light" style={{ "--light-index": index }} />
        ))}
      </div>
      <span className="seasonal-pine seasonal-pine--left" />
      <span className="seasonal-pine seasonal-pine--right" />
    </div>
  );
}

function SaoJoaoTop() {
  return (
    <div className="seasonal-top seasonal-top--sao-joao">
      <div className="seasonal-bunting-line" />
      <div className="seasonal-bunting">
        {Array.from({ length: 17 }, (_, index) => (
          <span key={index} className="seasonal-flag" style={{ "--flag-index": index }} />
        ))}
      </div>
      <span className="seasonal-balloon seasonal-balloon--left" />
      <span className="seasonal-balloon seasonal-balloon--right" />
    </div>
  );
}

function EasterTop() {
  return (
    <div className="seasonal-top seasonal-top--easter">
      <div className="seasonal-easter-vine" />
      <div className="seasonal-easter-ornaments">
        {Array.from({ length: 11 }, (_, index) => (
          <span key={index} className={index % 3 === 1 ? "seasonal-flower" : "seasonal-egg"} style={{ "--egg-index": index }} />
        ))}
      </div>
      <span className="seasonal-bunny-ear seasonal-bunny-ear--left" />
      <span className="seasonal-bunny-ear seasonal-bunny-ear--right" />
    </div>
  );
}

function HalloweenTop() {
  return (
    <div className="seasonal-top seasonal-top--halloween">
      <span className="seasonal-web seasonal-web--left" />
      <span className="seasonal-web seasonal-web--right" />
      <span className="seasonal-moon" />
      <div className="seasonal-bats">
        {Array.from({ length: 8 }, (_, index) => <span key={index} className="seasonal-bat" style={{ "--bat-index": index }} />)}
      </div>
    </div>
  );
}

function CarnivalTop() {
  return (
    <div className="seasonal-top seasonal-top--carnival">
      <div className="seasonal-carnival-thread" />
      <div className="seasonal-streamers">
        {Array.from({ length: 9 }, (_, index) => <span key={index} className="seasonal-streamer" style={{ "--stream-index": index }} />)}
      </div>
      <span className="seasonal-mask seasonal-mask--left"><i /><b /></span>
      <span className="seasonal-mask seasonal-mask--right"><i /><b /></span>
    </div>
  );
}

function ThemeTop({ theme }) {
  if (theme === SEASONAL_THEME.SAO_JOAO) return <SaoJoaoTop />;
  if (theme === SEASONAL_THEME.EASTER) return <EasterTop />;
  if (theme === SEASONAL_THEME.HALLOWEEN) return <HalloweenTop />;
  if (theme === SEASONAL_THEME.CARNIVAL) return <CarnivalTop />;
  return <ChristmasTop />;
}

export function SeasonalDecorationScene({ settings, preview = false }) {
  const normalized = normalizeSeasonalSettings(settings);
  if (!normalized.enabled && !preview) return null;

  const classes = [
    "seasonal-decorations",
    `seasonal-decorations--${normalized.theme}`,
    `seasonal-decorations--${normalized.intensity}`,
    normalized.animations_enabled ? "seasonal-decorations--animated" : "seasonal-decorations--still",
    preview ? "seasonal-decorations--preview" : "seasonal-decorations--overlay",
  ].join(" ");

  return (
    <div className={classes} aria-hidden="true">
      <div className="seasonal-ambient seasonal-ambient--left" />
      <div className="seasonal-ambient seasonal-ambient--right" />
      <ThemeTop theme={normalized.theme} />
      <span className="seasonal-corner seasonal-corner--left" />
      <span className="seasonal-corner seasonal-corner--right" />
      <div className="seasonal-particles">
        {PARTICLES.map((particle) => (
          <span
            key={particle.id}
            className="seasonal-particle"
            style={{
              "--particle-index": particle.id,
              "--particle-x": `${particle.x}%`,
              "--particle-drift": `${particle.drift}vw`,
              "--particle-delay": `${particle.delay}s`,
              "--particle-duration": `${particle.duration}s`,
              "--particle-size": `${particle.size}px`,
              "--particle-rotation": `${particle.rotation}deg`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function notifySeasonalThemeUpdated(settings) {
  const normalized = normalizeSeasonalSettings(settings);
  cacheSettings(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: normalized }));
  }
}

export default function SeasonalDecorations({ route = "/" }) {
  const [settings, setSettings] = React.useState(readCachedSettings);

  React.useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch(`/api/seasonal-theme?_=${Date.now()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const normalized = normalizeSeasonalSettings(data?.settings || data);
        cacheSettings(normalized);
        if (active) setSettings(normalized);
      } catch {}
    }

    const onUpdated = (event) => {
      const normalized = normalizeSeasonalSettings(event?.detail || {});
      cacheSettings(normalized);
      setSettings(normalized);
    };

    loadSettings();
    window.addEventListener(UPDATE_EVENT, onUpdated);
    return () => {
      active = false;
      window.removeEventListener(UPDATE_EVENT, onUpdated);
    };
  }, []);

  if (String(route || "").startsWith("/admin")) return null;
  return <SeasonalDecorationScene settings={settings} />;
}
