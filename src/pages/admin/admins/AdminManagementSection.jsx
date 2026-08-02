import React from "react";
import { ADMIN_LEVEL, adminLevelLabel, normalizeAdminLevel } from "../../../lib/admin.js";
import { SectionTitle } from "../orders/AdminOrdersComponents.jsx";

const LEVEL_OPTIONS = [
  { value: ADMIN_LEVEL.OPERATOR, label: "Nível 1 — Operador" },
  { value: ADMIN_LEVEL.MANAGER, label: "Nível 2 — Gerente" },
  { value: ADMIN_LEVEL.OWNER, label: "Nível 3 — Proprietário" },
];

const LEVEL_DETAILS = [
  {
    level: ADMIN_LEVEL.OPERATOR,
    title: "Operador",
    description: "Pedidos, criação de pedidos, produção, rastreio, notas e reenvio de e-mails.",
  },
  {
    level: ADMIN_LEVEL.MANAGER,
    title: "Gerente",
    description: "Tudo do operador, além de financeiro, clientes, produtos, avaliações, cupons, VIP e ações destrutivas.",
  },
  {
    level: ADMIN_LEVEL.OWNER,
    title: "Proprietário",
    description: "Acesso total e controle para conceder, alterar ou remover níveis de outros administradores.",
  },
];

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function levelBadgeClass(level) {
  const normalized = normalizeAdminLevel(level);
  if (normalized >= ADMIN_LEVEL.OWNER) return "bg-violet-500/15 text-violet-100 ring-violet-400/30";
  if (normalized >= ADMIN_LEVEL.MANAGER) return "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30";
  return "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30";
}

function auditActionLabel(action) {
  const key = String(action || "").toLowerCase();
  if (key === "admin_access_granted") return "Acesso concedido";
  if (key === "admin_access_removed") return "Acesso removido";
  if (key === "admin_promoted") return "Administrador promovido";
  if (key === "admin_demoted") return "Administrador rebaixado";
  return "Nível alterado";
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Não foi possível concluir a operação.");
  return data;
}

export default function AdminManagementSection({ accessToken, currentUserId, currentLevel = 0, onToast }) {
  const [admins, setAdmins] = React.useState([]);
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busyUserId, setBusyUserId] = React.useState("");
  const [draftLevels, setDraftLevels] = React.useState({});
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [newAdminLevel, setNewAdminLevel] = React.useState(ADMIN_LEVEL.OPERATOR);

  const applyData = React.useCallback((data) => {
    const nextAdmins = Array.isArray(data?.admins) ? data.admins : [];
    setAdmins(nextAdmins);
    if (Array.isArray(data?.audit_logs)) setAuditLogs(data.audit_logs);
    setDraftLevels(Object.fromEntries(nextAdmins.map((admin) => [String(admin.user_id), normalizeAdminLevel(admin.admin_level)])));
  }, []);

  const loadAdmins = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin?action=admins-list", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      applyData(await parseResponse(response));
    } catch (e) {
      setError(e?.message || "Não foi possível carregar os administradores.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, applyData]);

  React.useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  React.useEffect(() => {
    const query = search.trim();
    if (query.length < 2 || !accessToken) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ action: "admin-users-search", q: query, _: String(Date.now()) });
        const response = await fetch(`/api/admin?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await parseResponse(response);
        if (active) setSearchResults(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        if (active) setError(e?.message || "Não foi possível pesquisar usuários.");
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, accessToken]);

  async function setAdminLevel(userId, level, displayName = "") {
    if (!userId || !accessToken) return;
    const desired = normalizeAdminLevel(level);
    const current = admins.find((admin) => String(admin.user_id) === String(userId));
    const verb = desired === ADMIN_LEVEL.NONE
      ? "remover o acesso administrativo"
      : current
        ? `alterar o nível para ${adminLevelLabel(desired)}`
        : `conceder acesso como ${adminLevelLabel(desired)}`;
    const target = displayName || current?.email || current?.full_name || "este usuário";
    if (!window.confirm(`Deseja ${verb} de ${target}?`)) return;

    setBusyUserId(String(userId));
    setError("");
    try {
      const response = await fetch("/api/admin?action=set-admin-level", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userId, admin_level: desired }),
      });
      const data = await parseResponse(response);
      applyData(data);
      setSearchResults((rows) => rows.map((row) => String(row.id) === String(userId)
        ? { ...row, admin_level: desired, admin_role: adminLevelLabel(desired) }
        : row));
      onToast?.(desired === ADMIN_LEVEL.NONE ? "Acesso administrativo removido." : `Nível definido como ${adminLevelLabel(desired)}.`);
    } catch (e) {
      setError(e?.message || "Não foi possível alterar o administrador.");
      setDraftLevels((currentDrafts) => ({
        ...currentDrafts,
        [String(userId)]: normalizeAdminLevel(current?.admin_level || ADMIN_LEVEL.NONE),
      }));
    } finally {
      setBusyUserId("");
    }
  }

  const ownerCount = admins.filter((admin) => normalizeAdminLevel(admin.admin_level) === ADMIN_LEVEL.OWNER).length;

  return (
    <div className="space-y-4">
      <SectionTitle
        icon="admin_panel_settings"
        title="Administradores e níveis"
        subtitle="Conceda, altere ou remova permissões administrativas sem compartilhar a sua conta principal."
        right={(
          <button
            onClick={loadAdmins}
            disabled={loading}
            className="rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            <span className="material-icons mr-1 align-middle text-[18px]">refresh</span>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        )}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        {LEVEL_DETAILS.map((item) => (
          <article key={item.level} className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-white">Nível {item.level} — {item.title}</div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${levelBadgeClass(item.level)}`}>
                {admins.filter((admin) => normalizeAdminLevel(admin.admin_level) === item.level).length}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl bg-violet-500/[0.07] p-4 ring-1 ring-violet-400/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-violet-100">Sua conta: Nível {normalizeAdminLevel(currentLevel)} — {adminLevelLabel(currentLevel)}</div>
            <div className="mt-1 text-xs text-violet-100/70">A própria conta proprietária não pode ser rebaixada ou removida. O sistema também protege o último proprietário.</div>
          </div>
          <span className="rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-100 ring-1 ring-violet-300/25">
            {ownerCount} proprietário{ownerCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30">{error}</div> : null}

      <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-white">Adicionar administrador</h3>
            <p className="mt-1 text-sm text-slate-400">Pesquise uma conta já cadastrada no site pelo nome, e-mail, telefone ou ID.</p>
          </div>
          <label className="block min-w-[220px]">
            <span className="text-xs font-semibold text-slate-300">Nível que será concedido</span>
            <select
              value={newAdminLevel}
              onChange={(event) => setNewAdminLevel(normalizeAdminLevel(event.target.value))}
              className="mt-1.5 w-full rounded-xl bg-[#07161d] px-3 py-2.5 text-sm text-white ring-1 ring-white/10"
            >
              {LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="relative mt-4">
          <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite pelo menos 2 caracteres…"
            className="w-full rounded-2xl bg-black/20 py-3 pl-10 pr-4 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40"
          />
        </div>

        {searchLoading ? <div className="mt-3 text-sm text-slate-400">Pesquisando usuários…</div> : null}
        {!searchLoading && search.trim().length >= 2 && !searchResults.length ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">Nenhum usuário encontrado.</div>
        ) : null}
        {searchResults.length ? (
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {searchResults.map((candidate) => {
              const candidateLevel = normalizeAdminLevel(candidate.admin_level);
              const busy = busyUserId === String(candidate.id);
              return (
                <article key={candidate.id} className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{candidate.full_name || candidate.email || "Usuário"}</div>
                      <div className="truncate text-xs text-slate-400">{candidate.email || candidate.id}</div>
                      {candidateLevel ? (
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${levelBadgeClass(candidateLevel)}`}>
                          Já é {adminLevelLabel(candidateLevel)}
                        </span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setAdminLevel(candidate.id, newAdminLevel, candidate.email || candidate.full_name)}
                      disabled={busy || candidateLevel === newAdminLevel}
                      className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Salvando…" : candidateLevel ? "Alterar nível" : "Conceder acesso"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">Administradores atuais</h3>
            <p className="mt-1 text-sm text-slate-400">As mudanças entram em vigor na próxima requisição do usuário.</p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10">{admins.length} conta{admins.length === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-4 space-y-2">
          {admins.map((admin) => {
            const id = String(admin.user_id);
            const isSelf = id === String(currentUserId || "");
            const savedLevel = normalizeAdminLevel(admin.admin_level);
            const draftLevel = normalizeAdminLevel(draftLevels[id] ?? savedLevel);
            const busy = busyUserId === id;
            return (
              <article key={id} className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-white">{admin.full_name || admin.email || "Administrador"}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${levelBadgeClass(savedLevel)}`}>{adminLevelLabel(savedLevel)}</span>
                      {isSelf ? <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-100 ring-1 ring-violet-300/25">Sua conta</span> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-400">{admin.email || id}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Adicionado em {fmtDate(admin.created_at)} • último acesso {fmtDate(admin.last_sign_in_at)}</div>
                  </div>

                  <select
                    value={draftLevel}
                    onChange={(event) => setDraftLevels((current) => ({ ...current, [id]: normalizeAdminLevel(event.target.value) }))}
                    disabled={busy || isSelf}
                    className="w-full rounded-xl bg-[#07161d] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 disabled:opacity-50"
                  >
                    {LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>

                  <div className="flex gap-2 lg:justify-end">
                    <button
                      onClick={() => setAdminLevel(id, draftLevel, admin.email || admin.full_name)}
                      disabled={busy || isSelf || draftLevel === savedLevel}
                      className="rounded-xl px-3 py-2 text-xs font-bold text-cyan-100 ring-1 ring-cyan-300/25 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy ? "Salvando…" : "Salvar nível"}
                    </button>
                    <button
                      onClick={() => setAdminLevel(id, ADMIN_LEVEL.NONE, admin.email || admin.full_name)}
                      disabled={busy || isSelf}
                      className="rounded-xl px-3 py-2 text-xs font-bold text-red-200 ring-1 ring-red-400/25 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!loading && !admins.length ? <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">Nenhum administrador cadastrado.</div> : null}
        </div>
      </section>

      <section className="rounded-[26px] bg-white/[0.035] p-4 ring-1 ring-white/10 md:p-5">
        <div>
          <h3 className="text-lg font-black text-white">Histórico de alterações</h3>
          <p className="mt-1 text-sm text-slate-400">Registro das concessões, promoções, rebaixamentos e remoções de acesso.</p>
        </div>
        <div className="mt-4 space-y-2">
          {auditLogs.slice(0, 80).map((log) => (
            <article key={log.id} className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{auditActionLabel(log.action)}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {log.actor_email || "Administrador"} alterou {log.target_email || "usuário"}: {log.previous_role} → {log.new_role}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-slate-500">{fmtDate(log.created_at)}</div>
              </div>
            </article>
          ))}
          {!auditLogs.length ? <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">O histórico começará a ser registrado após a primeira alteração de nível.</div> : null}
        </div>
      </section>
    </div>
  );
}
