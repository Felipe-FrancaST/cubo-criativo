import React from "react";
import { SeasonalDecorationScene, notifySeasonalThemeUpdated } from "../../../components/SeasonalDecorations.jsx";
import {
  DEFAULT_SEASONAL_SETTINGS,
  normalizeSeasonalSettings,
  SEASONAL_INTENSITY_OPTIONS,
  SEASONAL_THEME_OPTIONS,
  seasonalThemeLabel,
} from "../../../lib/seasonalTheme.js";
import { SectionTitle } from "../orders/AdminOrdersComponents.jsx";

function formatDate(value) {
  if (!value) return "Ainda não alterado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function sameSettings(a, b) {
  const left = normalizeSeasonalSettings(a);
  const right = normalizeSeasonalSettings(b);
  return left.enabled === right.enabled
    && left.theme === right.theme
    && left.intensity === right.intensity
    && left.animations_enabled === right.animations_enabled;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Não foi possível concluir a operação.");
  return data;
}

export default function SeasonalDecorationsSection({ accessToken, onToast }) {
  const [settings, setSettings] = React.useState(DEFAULT_SEASONAL_SETTINGS);
  const [savedSettings, setSavedSettings] = React.useState(DEFAULT_SEASONAL_SETTINGS);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [setupRequired, setSetupRequired] = React.useState(false);

  const loadSettings = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin?action=seasonal-theme&_=${Date.now()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await parseResponse(response);
      const normalized = normalizeSeasonalSettings(data?.settings || DEFAULT_SEASONAL_SETTINGS);
      setSettings(normalized);
      setSavedSettings(normalized);
      setSetupRequired(Boolean(data?.setup_required));
    } catch (loadError) {
      setError(loadError?.message || "Não foi possível carregar as decorações.");
      setSetupRequired(/SQL_DECORACOES_SAZONAIS|tabela de decorações/i.test(String(loadError?.message || "")));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSettings(nextSettings = settings) {
    if (!accessToken || saving) return;
    const normalized = normalizeSeasonalSettings(nextSettings);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin?action=seasonal-theme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(normalized),
      });
      const data = await parseResponse(response);
      const saved = normalizeSeasonalSettings(data?.settings || normalized);
      setSettings(saved);
      setSavedSettings(saved);
      setSetupRequired(false);
      notifySeasonalThemeUpdated(saved);
      onToast?.(saved.enabled
        ? `${seasonalThemeLabel(saved.theme)} ativado no site.`
        : "Decorações sazonais desativadas.");
    } catch (saveError) {
      setError(saveError?.message || "Não foi possível salvar a decoração.");
      setSetupRequired(/SQL_DECORACOES_SAZONAIS|tabela de decorações/i.test(String(saveError?.message || "")));
    } finally {
      setSaving(false);
    }
  }

  const dirty = !sameSettings(settings, savedSettings);
  const activeTheme = SEASONAL_THEME_OPTIONS.find((item) => item.id === settings.theme) || SEASONAL_THEME_OPTIONS[0];
  const previewSettings = { ...settings, enabled: true };

  return (
    <div className="space-y-4">
      <SectionTitle
        icon="celebration"
        title="Decorações sazonais"
        subtitle="Ative uma identidade visual especial no site sem cobrir produtos, botões ou informações importantes."
        right={(
          <button
            onClick={loadSettings}
            disabled={loading || saving}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            <span className="material-icons mr-1 align-middle text-[18px]">refresh</span>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        )}
      />

      {error ? (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/25">
          <div className="font-bold">Não foi possível carregar ou salvar.</div>
          <div className="mt-1 text-red-100/80">{error}</div>
          {setupRequired ? <div className="mt-2 text-xs">Execute o arquivo <code>SQL_DECORACOES_SAZONAIS.sql</code> no Supabase e tente novamente.</div> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)]">
        <div className="space-y-4">
          <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Exibição no site</h3>
                <p className="mt-1 text-sm text-slate-400">A decoração aparece em todas as páginas públicas e nunca é exibida dentro do painel administrativo.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                onClick={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
                className={[
                  "relative inline-flex h-12 w-full shrink-0 items-center rounded-2xl px-3 ring-1 transition sm:w-[210px]",
                  settings.enabled
                    ? "justify-end bg-emerald-400/15 text-emerald-100 ring-emerald-300/30"
                    : "justify-start bg-white/[0.04] text-slate-300 ring-white/10",
                ].join(" ")}
              >
                <span className={[
                  "absolute h-8 w-8 rounded-xl shadow-lg transition-all",
                  settings.enabled ? "right-2 bg-emerald-300" : "left-2 bg-slate-500",
                ].join(" ")} />
                <span className={settings.enabled ? "mr-10 text-sm font-black" : "ml-10 text-sm font-black"}>
                  {settings.enabled ? "Ativada" : "Desativada"}
                </span>
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-[11px] uppercase tracking-[.14em] text-slate-500">Tema salvo</div>
                <div className="mt-1 font-bold text-white">{seasonalThemeLabel(savedSettings.theme)}</div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-[11px] uppercase tracking-[.14em] text-slate-500">Estado atual</div>
                <div className={`mt-1 font-bold ${savedSettings.enabled ? "text-emerald-200" : "text-slate-300"}`}>{savedSettings.enabled ? "Visível" : "Oculta"}</div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="text-[11px] uppercase tracking-[.14em] text-slate-500">Última alteração</div>
                <div className="mt-1 text-sm font-bold text-white">{formatDate(savedSettings.updated_at)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
            <div>
              <h3 className="text-lg font-black text-white">Escolha a época</h3>
              <p className="mt-1 text-sm text-slate-400">Cada tema mantém a estética escura e sofisticada da Cubo Criativo.</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {SEASONAL_THEME_OPTIONS.map((option) => {
                const selected = settings.theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, theme: option.id }))}
                    className={[
                      "group rounded-2xl p-4 text-left ring-1 transition-all",
                      selected
                        ? "bg-cyan-400/10 ring-cyan-300/35 shadow-[0_16px_36px_rgba(34,211,238,.08)]"
                        : "bg-black/20 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.05] hover:ring-white/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={[
                        "material-icons rounded-xl p-2 text-[22px] ring-1",
                        selected ? "bg-cyan-300/15 text-cyan-100 ring-cyan-300/25" : "bg-white/5 text-slate-300 ring-white/10",
                      ].join(" ")}>{option.icon}</span>
                      <span className={[
                        "material-icons text-[19px] transition",
                        selected ? "text-cyan-200" : "text-slate-600 group-hover:text-slate-400",
                      ].join(" ")}>{selected ? "check_circle" : "radio_button_unchecked"}</span>
                    </div>
                    <div className="mt-3 font-black text-white">{option.name}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
            <div>
              <h3 className="text-lg font-black text-white">Intensidade e movimento</h3>
              <p className="mt-1 text-sm text-slate-400">A opção Elegante é a recomendada para uso diário.</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {SEASONAL_INTENSITY_OPTIONS.map((option) => {
                const selected = settings.intensity === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, intensity: option.id }))}
                    className={[
                      "rounded-2xl p-3 text-left ring-1 transition",
                      selected ? "bg-violet-400/10 ring-violet-300/30" : "bg-black/20 ring-white/10 hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{option.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,.7)]" : "bg-slate-700"}`} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <input
                type="checkbox"
                checked={settings.animations_enabled}
                onChange={(event) => setSettings((current) => ({ ...current, animations_enabled: event.target.checked }))}
                className="mt-1 h-4 w-4 accent-cyan-300"
              />
              <span>
                <span className="font-bold text-white">Movimentos suaves</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">Anima partículas, luzes e pequenos elementos. O site respeita automaticamente a preferência de movimento reduzido do aparelho.</span>
              </span>
            </label>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-[28px] bg-white/[0.035] ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-black text-white">Prévia — {activeTheme.name}</div>
                <div className="text-xs text-slate-500">A prévia continua visível mesmo quando o tema está desativado.</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${settings.enabled ? "bg-emerald-400/10 text-emerald-100 ring-emerald-300/25" : "bg-white/5 text-slate-300 ring-white/10"}`}>
                {settings.enabled ? "Será exibida" : "Somente prévia"}
              </span>
            </div>

            <div className="relative min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(47,162,182,.18),transparent_38%),linear-gradient(180deg,#07161d,#02080d)] p-5">
              <SeasonalDecorationScene settings={previewSettings} preview />
              <div className="relative z-[3] mt-16 rounded-3xl bg-[#07161d]/85 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 ring-1 ring-cyan-300/20">
                    <span className="material-icons text-cyan-100">deployed_code</span>
                  </div>
                  <div>
                    <div className="font-black text-white">Cubo Criativo</div>
                    <div className="text-xs text-slate-400">Miniaturas e impressões 3D</div>
                  </div>
                </div>
                <div className="mt-5 h-24 rounded-2xl bg-gradient-to-br from-cyan-400/10 to-violet-400/5 ring-1 ring-white/10" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />
                  <div className="h-16 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />
                </div>
                <div className="mt-4 rounded-2xl bg-cyan-300 px-4 py-3 text-center text-sm font-black text-[#031116]">Ver coleção</div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10">
            <div className="text-sm font-black text-white">Publicar alteração</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">Depois de salvar, a configuração é usada em todo o site. Usuários que já estejam com uma página aberta verão a mudança ao atualizar.</p>

            {dirty ? <div className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">Existem alterações ainda não salvas.</div> : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <button
                onClick={() => saveSettings(settings)}
                disabled={saving || loading || !dirty || setupRequired}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-[#031116] ring-4 ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Salvando…" : "Salvar e publicar"}
              </button>
              <button
                onClick={() => saveSettings({ ...settings, enabled: false })}
                disabled={saving || loading || (!savedSettings.enabled && !settings.enabled) || setupRequired}
                className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 ring-1 ring-red-400/25 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Desativar agora
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
