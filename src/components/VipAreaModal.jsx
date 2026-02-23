import React from "react";
import Modal from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider.jsx";

function cycleKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function statusLabel(s) {
  const v = String(s || "editavel").toLowerCase();
  if (v === "editavel" || v === "recebido") return { label: "Editável", cls: "bg-emerald-500/10 ring-emerald-400/25 text-emerald-200" };
  if (v === "em_producao") return { label: "Em produção", cls: "bg-indigo-500/10 ring-indigo-400/25 text-indigo-200" };
  if (v === "enviado") return { label: "Enviado", cls: "bg-amber-500/10 ring-amber-400/25 text-amber-200" };
  if (v === "entregue") return { label: "Entregue", cls: "bg-teal-500/10 ring-teal-400/25 text-teal-200" };
  return { label: v.replaceAll("_", " "), cls: "bg-white/5 ring-white/15 text-slate-200" };
}

export default function VipAreaModal({ open, onClose, onGoVip }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [vipUntil, setVipUntil] = React.useState(null);
  const [vipPlan, setVipPlan] = React.useState("");
  const [orderStatus, setOrderStatus] = React.useState("editavel");
  const [options, setOptions] = React.useState([]);
  const [selected, setSelected] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const cycle = React.useMemo(() => cycleKeyUTC(), []);
  const isVip = vipUntil ? new Date(vipUntil).getTime() > Date.now() : false;
  const st = statusLabel(orderStatus);
  const editable = isVip && (String(orderStatus || "").toLowerCase() === "editavel" || String(orderStatus || "").toLowerCase() === "recebido");

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const [{ data: prof }, { data: opts }, { data: lastVipOrder }, { data: sel }] = await Promise.all([
        supabase.from("profiles").select("vip_until,vip_plan").eq("id", user.id).maybeSingle(),
        supabase.from("vip_mini_options").select("id,title,description,image_url,sort_order,active").eq("active", true).order("sort_order", { ascending: true }).limit(24),
        supabase
          .from("orders")
          .select("id,production_status,created_at")
          .eq("user_id", user.id)
          .eq("order_type", "vip")
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("vip_mini_selections").select("selected_option_ids").eq("user_id", user.id).eq("cycle_key", cycle).maybeSingle(),
      ]);

      setVipUntil(prof?.vip_until || null);
      setVipPlan(prof?.vip_plan || "Cubo Level 1 — RPG");
      setOptions(Array.isArray(opts) ? opts : []);

      const order = Array.isArray(lastVipOrder) ? lastVipOrder[0] : null;
      setOrderStatus(String(order?.production_status || "editavel").toLowerCase());

      const ids = Array.isArray(sel?.selected_option_ids) ? sel.selected_option_ids : [];
      setSelected(ids);
    } catch (e) {
      setError(e?.message || "Não foi possível carregar a Área VIP.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open) load();
  }, [open]);

  async function saveSelection() {
    if (!editable) return;
    if (selected.length !== 3) {
      setMsg("Escolha exatamente 3 miniaturas.");
      return;
    }
    try {
      setSaving(true);
      setMsg("");
      const payload = { user_id: user.id, cycle_key: cycle, selected_option_ids: selected };
      const { error: upErr } = await supabase.from("vip_mini_selections").upsert(payload, { onConflict: "user_id,cycle_key" });
      if (upErr) throw upErr;
      setMsg("Escolhas salvas ✅");
    } catch (e) {
      setMsg(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-950 to-black ring-1 ring-white/10">
        <div className="absolute inset-0 opacity-35 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, rgba(168,85,247,.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(34,197,94,.22), transparent 55%), radial-gradient(circle at 50% 90%, rgba(56,189,248,.18), transparent 55%)" }} />
        <div className="relative p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Área VIP</p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold">{vipPlan || "Clube VIP"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}>
                  <span className="material-icons text-[16px]">flag</span>
                  Status: <b>{st.label}</b>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/5 text-slate-200">
                  <span className="material-icons text-[16px]">calendar_month</span>
                  Ciclo: <b>{cycle}</b>
                </span>
                {isVip ? (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-violet-400/25 bg-violet-500/10 text-violet-100">
                    <span className="material-icons text-[16px]">stars</span>
                    VIP ativo • expira em <b>{new Date(vipUntil).toLocaleDateString("pt-BR")}</b>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-white/15 bg-white/5 text-slate-200">
                    <span className="material-icons text-[16px]">lock</span>
                    Não VIP
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 ring-1 ring-white/15 hover:bg-white/5" aria-label="Fechar">
              <span className="material-icons">close</span>
            </button>
          </div>

          {!user ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Faça login para acessar a Área VIP.</div>
          ) : loading ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-slate-200">Carregando…</div>
          ) : error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-rose-100">{error}</div>
          ) : !isVip ? (
            <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
              <p className="text-slate-200">Assine para escolher suas miniaturas mensais e liberar benefícios VIP.</p>
              <button onClick={onGoVip} className="mt-4 rounded-xl px-4 py-3 font-extrabold bg-teal-400 text-black ring-4 ring-teal-400/20">Ver planos VIP</button>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-300">
                  Escolha <b>3</b> miniaturas entre <b>{options.length}</b> opções do mês.
                  {!editable ? (
                    <span className="ml-2 text-slate-400">(Escolhas bloqueadas: status {st.label})</span>
                  ) : null}
                </div>
                <div className="text-sm text-slate-200">Selecionadas: <b>{selected.length}</b>/3</div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {options.map((opt) => {
                  const isSel = selected.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!editable || saving}
                      onClick={() => {
                        setSelected((prev) => {
                          const has = prev.includes(opt.id);
                          if (has) return prev.filter((x) => x !== opt.id);
                          if (prev.length >= 3) return prev;
                          return [...prev, opt.id];
                        });
                      }}
                      className={`rounded-2xl p-4 text-left ring-1 transition ${isSel ? "bg-violet-500/15 ring-violet-400/30" : "bg-white/5 ring-white/10 hover:bg-white/10"} ${(!editable || saving) ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-slate-100 truncate">{opt.title}</p>
                          {opt.description ? (
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{opt.description}</p>
                          ) : null}
                        </div>
                        <span className={`material-icons ${isSel ? "text-violet-200" : "text-slate-500"}`}>{isSel ? "check_circle" : "radio_button_unchecked"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-slate-400">Dica: você pode mudar as escolhas enquanto o status estiver <b>Editável</b>.</div>
                <button
                  type="button"
                  disabled={!editable || saving || selected.length !== 3}
                  onClick={saveSelection}
                  className={`rounded-xl px-4 py-2 font-extrabold ring-1 ring-white/10 ${(!editable || saving || selected.length !== 3) ? "bg-slate-700/40 text-slate-300" : "bg-emerald-300 text-black hover:bg-emerald-200"}`}
                >
                  {saving ? "Salvando…" : "Salvar escolhas"}
                </button>
              </div>
              {msg ? <div className="mt-3 text-sm text-slate-200">{msg}</div> : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
