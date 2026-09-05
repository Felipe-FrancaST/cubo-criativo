import React from "react";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "../orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "../orders/adminOrdersUtils.js";
import AdminProductsSection from "../products/AdminProductsSection.jsx";
import AdminReviewsSection from "../reviews/AdminReviewsSection.jsx";
import AdminManagementSection from "../admins/AdminManagementSection.jsx";
import { TRACKING_CARRIERS, inferTrackingCarrierFromUrl, normalizeTrackingCarrier, resolveTrackingCarrier, trackingCarrierLabel } from "../../../lib/tracking.js";

export default function AdminVipSection({ admin }) {
  const {
    user,
    accessToken,
    isAdmin,
    adminLevel,
    adminRole,
    isAdminLoading,
    onNavigateHome,
    onRequireLogin,
    section,
    setSection,
    orders,
    setOrders,
    loading,
    setLoading,
    error,
    setError,
    q,
    setQ,
    qInput,
    setQInput,
    filterPay,
    setFilterPay,
    filterProd,
    setFilterProd,
    filterType,
    setFilterType,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    page,
    setPage,
    pageSize,
    setPageSize,
    pagination,
    setPagination,
    summary,
    setSummary,
    selectedOrderIds,
    setSelectedOrderIds,
    bulkBusy,
    setBulkBusy,
    bulkModal,
    setBulkModal,
    toast,
    setToast,
    resendEmailBusyId,
    setResendEmailBusyId,
    details,
    setDetails,
    actionModal,
    setActionModal,
    vipPolls,
    setVipPolls,
    vipPollsLoading,
    setVipPollsLoading,
    vipPollsError,
    setVipPollsError,
    vipVotingImages,
    setVipVotingImages,
    vipVotingImagesLoading,
    setVipVotingImagesLoading,
    vipVotingImagesError,
    setVipVotingImagesError,
    vipControl,
    setVipControl,
    vipControlLoading,
    setVipControlLoading,
    vipControlError,
    setVipControlError,
    vipCycleEditor,
    setVipCycleEditor,
    vipCycleBusy,
    setVipCycleBusy,
    vipMiniForm,
    setVipMiniForm,
    vipMiniFiles,
    setVipMiniFiles,
    vipMiniBusy,
    setVipMiniBusy,
    vipMiniError,
    setVipMiniError,
    vipLibrarySearch,
    setVipLibrarySearch,
    vipLibraryFilter,
    setVipLibraryFilter,
    gameCouponLoading,
    setGameCouponLoading,
    gameCouponError,
    setGameCouponError,
    gameCouponForm,
    setGameCouponForm,
    currentGameCoupon,
    setCurrentGameCoupon,
    gameCouponMetricsLoading,
    setGameCouponMetricsLoading,
    gameCouponMetricsError,
    setGameCouponMetricsError,
    gameCouponMetrics,
    setGameCouponMetrics,
    closeVote,
    setCloseVote,
    startVote,
    setStartVote,
    deleteVote,
    setDeleteVote,
    newOrderOpen,
    setNewOrderOpen,
    clients,
    setClients,
    clientsLoading,
    setClientsLoading,
    clientsError,
    setClientsError,
    clientsQ,
    setClientsQ,
    clientEditor,
    setClientEditor,
    clientVipPlans,
    setClientVipPlans,
    clientVipBusy,
    setClientVipBusy,
    newClientOpen,
    setNewClientOpen,
    adminQuickSearch,
    setAdminQuickSearch,
    confirmAction,
    setConfirmAction,
    normalizedAdminLevel,
    canOperate,
    canManageBusiness,
    canManageAdmins,
    showToast,
    fetchOrders,
    fetchClients,
    fetchVipVoting,
    fetchVipVotingImages,
    nextMonthKey,
    fetchVipControl,
    fetchGameCoupon,
    fetchGameCouponMetrics,
    startVipVoting,
    closeVipVoting,
    deleteVipVoting,
    uploadVipMiniImage,
    createVipMiniature,
    deleteVipMiniature,
    toggleVipCycleItem,
    loadVipCycleIntoEditor,
    saveVipCycle,
    activateVipCycle,
    deleteVipCycle,
    saveGameCoupon,
    updateOrder,
    resendOrderEmail,
    deleteOrder,
    addOrderNote,
    saveClientEdits,
    updateClientVipStatus,
    deleteClient,
    toggleOrderSelection,
    toggleSelectAllCurrentPage,
    bulkUpdateOrders,
    bulkResendEmails,
    bulkDeleteOrders,
    orderMatchesInlineSearch,
    filteredOrders,
    stats,
    bottlenecks,
    quickQueue,
    financeHighlights,
    orderQuickPresets,
    openDeleteClientConfirm,
    openDeleteVipCycleConfirm,
    handleConfirmAction,
    runAdminQuickSearch,
    applyOrderSearch,
    clearOrderSearchAndFilters,
    allPageSelected,
    selectedOrders,
    selectedPaidOrders,
    vipSelectedItems,
    vipSelectedSummary,
    vipVisibleLibrary,
    vipActiveCycle,
    vipCycleAudience,
    activeOrder,
    activeActionOrder,
  } = admin;

  return (
            <div className="space-y-4">
              <SectionTitle
                icon="workspace_premium"
                title="VIP Controle"
                subtitle="Organize ciclos VIP, acompanhe base ativa e mantenha a votação do próximo tema."
                right={
                  <div className="flex w-full gap-2 sm:w-auto sm:items-center">
                    <button
                      onClick={() => fetchVipVoting()}
                      className="flex-1 rounded-xl px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:flex-none"
                    >
                      Atualizar
                    </button>

                    {!vipPolls.some((x) => String(x?.poll?.status || "").toLowerCase() === "open") ? (
                      <button
                        onClick={() =>
                          setStartVote({
                            open: true,
                            busy: false,
                            error: "",
                            data: {
                              month_key: nextMonthKey(),
                              title: "Qual tema você quer no próximo mês?",
                              options: [
                                { title: "", description: "", image_asset_id: "" },
                                { title: "", description: "", image_asset_id: "" },
                                { title: "", description: "", image_asset_id: "" },
                              ],
                            },
                          })
                        }
                        className="flex-1 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-black ring-4 ring-emerald-400/20 sm:flex-none"
                      >
                        + Nova votação
                      </button>
                    ) : null}
                  </div>
                }
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl bg-gradient-to-br from-cyan-500/15 via-cyan-400/8 to-transparent ring-1 ring-cyan-400/20 p-4 shadow-[0_12px_40px_rgba(6,182,212,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Ciclo ativo</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.active_cycle_key || '—'}</div>
                    <div className="mt-2 text-sm text-slate-300">Esse é o mês exibido agora para os assinantes VIP.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-violet-500/15 via-violet-400/8 to-transparent ring-1 ring-violet-400/20 p-4 shadow-[0_12px_40px_rgba(139,92,246,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-violet-200/80">Assinantes ativos</div>
                    <div className="mt-2 text-2xl font-black text-white">{Number(vipControl?.vip_summary?.activeSubscribers || 0)}</div>
                    <div className="mt-2 text-sm text-slate-300">Base atual apta a visualizar ciclos e participar das votações.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/8 to-transparent ring-1 ring-emerald-400/20 p-4 shadow-[0_12px_40px_rgba(16,185,129,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">Ciclos montados</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.cycles.length}</div>
                    <div className="mt-2 text-sm text-slate-300">Meses prontos para ativar, editar ou duplicar rapidamente.</div>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-400/8 to-transparent ring-1 ring-amber-400/20 p-4 shadow-[0_12px_40px_rgba(245,158,11,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">Biblioteca VIP</div>
                    <div className="mt-2 text-2xl font-black text-white">{vipControl.library.length}</div>
                    <div className="mt-2 text-sm text-slate-300">Miniaturas e bosses disponíveis para montar os próximos ciclos.</div>
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-violet-500/10 via-white/[0.03] to-transparent ring-1 ring-violet-400/20 p-4 md:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-lg font-bold text-white">Cadastrar nova miniatura</div>
                      <div className="mt-1 text-sm text-slate-400">Cadastre nome, imagens, ciclo e tipo diretamente no banco. Depois ela aparece automaticamente na biblioteca do ciclo.</div>
                    </div>
                    <span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/20">Cadastro direto</span>
                  </div>
                  <form onSubmit={createVipMiniature} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
                    <label className="md:col-span-4"><div className="mb-1.5 text-xs text-slate-400">Nome</div><input required value={vipMiniForm.title} onChange={(e) => setVipMiniForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Guerreiro Orc" className="w-full rounded-2xl bg-black/20 px-3.5 py-3 text-sm text-slate-100 ring-1 ring-white/10" /></label>
                    <label className="md:col-span-2"><div className="mb-1.5 text-xs text-slate-400">Ciclo</div><input required value={vipMiniForm.cycle_key} onChange={(e) => setVipMiniForm((p) => ({ ...p, cycle_key: e.target.value }))} placeholder="2026-10" className="w-full rounded-2xl bg-black/20 px-3.5 py-3 text-sm text-slate-100 ring-1 ring-white/10" /></label>
                    <label className="md:col-span-2"><div className="mb-1.5 text-xs text-slate-400">Tipo</div><select value={vipMiniForm.item_type} onChange={(e) => setVipMiniForm((p) => ({ ...p, item_type: e.target.value }))} className="w-full rounded-2xl bg-black/20 px-3.5 py-3 text-sm text-slate-100 ring-1 ring-white/10"><option value="miniature">Miniatura</option><option value="boss">Boss</option></select></label>
                    <label className="md:col-span-2"><div className="mb-1.5 text-xs text-slate-400">Ordem</div><input type="number" min="0" value={vipMiniForm.sort_order} onChange={(e) => setVipMiniForm((p) => ({ ...p, sort_order: e.target.value }))} className="w-full rounded-2xl bg-black/20 px-3.5 py-3 text-sm text-slate-100 ring-1 ring-white/10" /></label>
                    <label className="md:col-span-2"><div className="mb-1.5 text-xs text-slate-400">Imagens</div><input id="vip-mini-images-input" required type="file" accept="image/*" multiple onChange={(e) => setVipMiniFiles(Array.from(e.target.files || []).slice(0, 6))} className="block w-full rounded-2xl bg-black/20 px-3 py-2.5 text-xs text-slate-300 ring-1 ring-white/10 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-slate-100" /></label>
                    <label className="md:col-span-10"><div className="mb-1.5 text-xs text-slate-400">Descrição (opcional)</div><input value={vipMiniForm.description} onChange={(e) => setVipMiniForm((p) => ({ ...p, description: e.target.value }))} placeholder="Detalhes rápidos para identificar a peça no painel" className="w-full rounded-2xl bg-black/20 px-3.5 py-3 text-sm text-slate-100 ring-1 ring-white/10" /></label>
                    <div className="flex items-end md:col-span-2"><button disabled={vipMiniBusy} className="w-full rounded-2xl bg-violet-400 px-4 py-3 text-sm font-bold text-black ring-4 ring-violet-400/15 disabled:opacity-60">{vipMiniBusy ? 'Enviando...' : 'Cadastrar miniatura'}</button></div>
                  </form>
                  {vipMiniFiles.length ? <div className="mt-3 text-xs text-slate-400">{vipMiniFiles.length} imagem(ns) selecionada(s). A primeira será a capa.</div> : null}
                  {vipMiniError ? <div className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2.5 text-sm text-red-200 ring-1 ring-red-500/30">{vipMiniError}</div> : null}
                </div>

                <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-lg font-bold text-white">Biblioteca cadastrada</div><div className="mt-1 text-sm text-slate-400">Veja rapidamente o que já está no banco e remova cadastros que não serão usados.</div></div><div className="text-xs text-slate-500">{vipControl.library.length} item(ns)</div></div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {(vipControl.library || []).slice(0, 18).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{item.title}</div><div className="mt-1 text-[11px] text-slate-400">{item.cycle_key || 'Sem ciclo'} • {String(item.item_type).toLowerCase() === 'boss' ? 'Boss' : 'Miniatura'}</div></div><button type="button" onClick={() => deleteVipMiniature(item)} disabled={vipMiniBusy} className="rounded-xl px-2.5 py-2 text-xs text-red-200 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50" aria-label={`Excluir ${item.title}`}>Excluir</button></div>)}
                  </div>
                </div>

                {vipControlLoading ? <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-4 py-3 text-slate-400">Carregando controle VIP...</div> : null}
                {vipControlError ? <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-200">{vipControlError}</div> : null}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.82fr)]">
                  <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-2xl">
                        <div className="text-lg font-bold text-white">Montagem do ciclo VIP</div>
                        <div className="mt-1 text-sm text-slate-400">Monte o mês, escolha as minis e mantenha claro o que está no editor e o que já está ativo. Tudo fica concentrado aqui.</div>
                      </div>
                      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[430px]">
                        <button
                          onClick={() => setVipCycleEditor({ cycle_key: nextMonthKey(), selected_ids: [], activate: true })}
                          className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10"
                        >
                          + Novo ciclo
                        </button>
                        <button
                          onClick={() => {
                            const active = (vipControl.cycles || []).find((cycle) => cycle.is_active) || (vipControl.cycles || [])[0];
                            if (!active) return;
                            setVipCycleEditor({ cycle_key: nextMonthKey(), selected_ids: (active.items || []).map((item) => String(item.id)), activate: true });
                          }}
                          disabled={vipCycleBusy || !(vipControl.cycles || []).length}
                          className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10 disabled:opacity-60"
                        >
                          Duplicar ativo
                        </button>
                        <button
                          onClick={saveVipCycle}
                          disabled={vipCycleBusy}
                          className="col-span-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black ring-4 ring-emerald-400/20 disabled:opacity-60 sm:col-span-1"
                        >
                          {vipCycleBusy ? 'Salvando...' : 'Salvar ciclo'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                      <div className="space-y-4 lg:col-span-4 2xl:col-span-3">
                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Configuração do ciclo</div>
                          <label className="mt-4 block">
                            <div className="text-xs text-slate-400 mb-1.5">Mês de referência</div>
                            <input
                              value={vipCycleEditor.cycle_key}
                              onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, cycle_key: e.target.value }))}
                              placeholder="YYYY-MM"
                              className="w-full rounded-2xl bg-black/20 ring-1 ring-white/10 px-3.5 py-3 text-slate-100"
                            />
                          </label>
                          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={!!vipCycleEditor.activate}
                              onChange={(e) => setVipCycleEditor((prev) => ({ ...prev, activate: e.target.checked }))}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-semibold text-white">Ativar ao salvar</span>
                              <span className="mt-1 block text-xs text-slate-400">Use quando esse mês já deve aparecer imediatamente para os assinantes.</span>
                            </span>
                          </label>
                          {vipCycleEditor.cycle_key ? (
                            <button
                              onClick={() => openDeleteVipCycleConfirm(vipCycleEditor.cycle_key)}
                              disabled={vipCycleBusy}
                              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-red-100 bg-red-500/10 ring-1 ring-red-500/30 disabled:opacity-60"
                            >
                              Excluir ciclo atual do editor
                            </button>
                          ) : null}
                        </div>

                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resumo da seleção</div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Itens</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedItems.length}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Minis</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedSummary.mini}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Boss</div>
                              <div className="mt-1 text-xl font-black text-white">{vipSelectedSummary.boss}</div>
                            </div>
                          </div>
                          <div className="mt-4 text-xs leading-5 text-slate-400">Toque nos cards da biblioteca para adicionar ou remover itens deste ciclo.</div>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-4 lg:col-span-8 2xl:col-span-9">
                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Ciclos disponíveis</div>
                              <div className="mt-1 text-xs text-slate-400">Clique em um mês para carregar no editor e ajustar rapidamente.</div>
                            </div>
                            <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 self-start lg:self-auto">
                              {vipControl.cycles.length} ciclo(s)
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-h-[320px] md:overflow-y-auto md:pr-1 2xl:grid-cols-3">
                            {(vipControl.cycles || []).map((cycle) => {
                              const isCurrentCycle = String(vipCycleEditor.cycle_key || '') === String(cycle.cycle_key);
                              return (
                                <button
                                  key={cycle.cycle_key}
                                  type="button"
                                  onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                                  className={[
                                    'min-w-0 rounded-2xl p-4 text-left ring-1 transition-all duration-200',
                                    'bg-white/[0.03] hover:bg-white/[0.05] hover:-translate-y-[1px]',
                                    isCurrentCycle
                                      ? 'ring-cyan-400/35 bg-cyan-400/10 shadow-[0_10px_30px_rgba(34,211,238,0.12)]'
                                      : 'ring-white/10'
                                  ].join(' ')}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-white truncate">{cycle.cycle_key}</div>
                                      <div className="mt-1 text-[11px] text-slate-400 leading-5">
                                        {cycle.is_active ? 'Ciclo ativo para assinantes' : 'Clique para carregar no editor'}
                                      </div>
                                    </div>
                                    <span className="material-icons text-slate-500 text-lg shrink-0">calendar_month</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {cycle.is_active ? (
                                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20">
                                        Ativo
                                      </span>
                                    ) : null}
                                    {isCurrentCycle ? (
                                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20">
                                        No editor
                                      </span>
                                    ) : null}
                                    <span className="rounded-full px-2 py-1 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">
                                      {cycle.total_items} item(ns)
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Biblioteca do ciclo</div>
                              <div className="mt-1 text-xs text-slate-400">Busque e filtre antes de tocar nos cards que entrarão neste mês.</div>
                            </div>
                            <div className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 self-start lg:self-auto">
                              {vipVisibleLibrary.length} de {(vipControl.library || []).length} item(ns)
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="relative block">
                              <span className="material-icons pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-500">search</span>
                              <input
                                value={vipLibrarySearch}
                                onChange={(event) => setVipLibrarySearch(event.target.value)}
                                placeholder="Buscar por nome, descrição ou ciclo..."
                                aria-label="Buscar na biblioteca VIP"
                                className="w-full rounded-2xl bg-black/25 py-3 pl-10 pr-10 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-cyan-400/35"
                              />
                              {vipLibrarySearch ? (
                                <button
                                  type="button"
                                  onClick={() => setVipLibrarySearch('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                                  aria-label="Limpar busca"
                                >
                                  <span className="material-icons text-[18px]">close</span>
                                </button>
                              ) : null}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                              {[
                                ['all', 'Todos'],
                                ['selected', 'Selecionados'],
                                ['mini', 'Minis'],
                                ['boss', 'Bosses'],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setVipLibraryFilter(value)}
                                  className={[
                                    'shrink-0 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition',
                                    vipLibraryFilter === value
                                      ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-400/30'
                                      : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06]',
                                  ].join(' ')}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:max-h-[720px] md:overflow-y-auto md:pr-1">
                            {vipVisibleLibrary.map((item) => {
                              const selected = (vipCycleEditor.selected_ids || []).includes(String(item.id));
                              const assignedCycle = String(item?.cycle_key || '');
                              const isBoss = String(item?.item_type || '').toLowerCase() === 'boss';
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => toggleVipCycleItem(String(item.id))}
                                  aria-pressed={selected}
                                  className={[
                                    'w-full text-left rounded-3xl p-3.5 ring-1 transition shadow-[0_8px_30px_rgba(0,0,0,0.14)]',
                                    selected
                                      ? 'bg-cyan-400/10 ring-cyan-400/30 shadow-[0_10px_35px_rgba(34,211,238,0.12)]'
                                      : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'
                                  ].join(' ')}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="h-16 w-16 rounded-2xl overflow-hidden bg-black/20 ring-1 ring-white/10 shrink-0">
                                      {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" /> : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-bold text-slate-100 break-words leading-5">{item.title}</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className={isBoss ? 'rounded-full px-2 py-0.5 text-[10px] bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/20' : 'rounded-full px-2 py-0.5 text-[10px] bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/20'}>
                                          {isBoss ? 'Boss' : 'Mini'}
                                        </span>
                                        {selected ? <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20">Selecionado</span> : null}
                                        {assignedCycle ? (
                                          <span className="rounded-full px-2 py-0.5 text-[10px] bg-white/6 text-slate-300 ring-1 ring-white/10">
                                            {assignedCycle}
                                          </span>
                                        ) : null}
                                      </div>
                                      {item.description ? <div className="mt-2 text-xs text-slate-400 leading-5 line-clamp-2">{item.description}</div> : null}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {!vipVisibleLibrary.length ? (
                              <div className="rounded-2xl bg-white/[0.03] p-5 text-center text-sm text-slate-400 ring-1 ring-white/10 md:col-span-2">
                                Nenhum item encontrado com esses filtros.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#0a202a]/95 p-3 shadow-[0_16px_45px_rgba(0,0,0,0.45)] ring-1 ring-cyan-300/20 backdrop-blur lg:hidden">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">Ciclo {vipCycleEditor.cycle_key || 'novo'}</div>
                        <div className="truncate text-sm font-semibold text-white">{vipSelectedItems.length} item(ns) selecionado(s)</div>
                      </div>
                      <button
                        type="button"
                        onClick={saveVipCycle}
                        disabled={vipCycleBusy}
                        className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black ring-4 ring-emerald-400/15 disabled:opacity-60"
                      >
                        {vipCycleBusy ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-lg font-bold text-white">Radar VIP</div>
                          <div className="mt-1 text-sm text-slate-400">Acompanhe o ciclo ativo e a distribuição dos assinantes por mês.</div>
                        </div>
                        {vipActiveCycle ? <span className="rounded-full px-3 py-1.5 text-xs bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">Ativo: {vipActiveCycle.cycle_key}</span> : null}
                      </div>

                      <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-[0.16em]">Resumo do ciclo ativo</div>
                        {vipActiveCycle ? (
                          <div className="mt-3 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Itens</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.total_items}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Minis</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.miniatures_count}</div>
                            </div>
                            <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Boss</div>
                              <div className="mt-1 text-xl font-black text-white">{vipActiveCycle.boss_count}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-slate-400">Nenhum ciclo ativo no momento.</div>
                        )}
                      </div>

                      <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-white">Assinantes por ciclo</div>
                          <div className="text-xs text-slate-500">Leitura rápida da base</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {vipCycleAudience.length ? vipCycleAudience.map((row, idx) => {
                            const count = Number(row?.count || row?.total || 0);
                            const pct = Math.max(6, Math.min(100, vipControl?.vip_summary?.activeSubscribers ? (count / Number(vipControl.vip_summary.activeSubscribers || 1)) * 100 : 0));
                            return (
                              <div key={`${row?.cycle_key || 'none'}-${idx}`} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <div className="font-semibold text-slate-100">{row?.cycle_key || 'Sem ciclo'}</div>
                                  <div className="text-slate-300">{count} assinante(s)</div>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/10">
                                  <div className="h-full rounded-full bg-white/30" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          }) : <div className="text-sm text-slate-400">Sem dados de distribuição por ciclo.</div>}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {(vipControl.cycles || []).map((cycle) => (
                          <div key={cycle.cycle_key} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-100">{cycle.cycle_key}</div>
                                <div className="mt-1 text-xs text-slate-400">{cycle.miniatures_count} minis • {cycle.boss_count} boss • {cycle.total_items} itens</div>
                              </div>
                              {cycle.is_active ? <span className="rounded-full px-2.5 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">Ativo</span> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => loadVipCycleIntoEditor(cycle.cycle_key)}
                                className="rounded-2xl px-3 py-2 text-xs font-semibold text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10"
                              >
                                Editar
                              </button>
                              {!cycle.is_active ? (
                                <button
                                  onClick={() => activateVipCycle(cycle.cycle_key)}
                                  disabled={vipCycleBusy}
                                  className="rounded-2xl px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30 disabled:opacity-60"
                                >
                                  Ativar
                                </button>
                              ) : null}
                              <button
                                onClick={() => openDeleteVipCycleConfirm(cycle.cycle_key)}
                                disabled={vipCycleBusy}
                                className="rounded-2xl px-3 py-2 text-xs font-semibold text-red-100 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/30 disabled:opacity-60"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">Votações do próximo tema</div>
                          <div className="mt-1 text-sm text-slate-400">Crie, acompanhe e encerre as votações do mês seguinte sem sair desta área.</div>
                        </div>
                      </div>
                      {vipPollsLoading ? <div className="mt-4 text-slate-400">Carregando...</div> : null}
                      {vipPollsError ? <div className="mt-4 text-red-200">{vipPollsError}</div> : null}

                      {!vipPollsLoading && !vipPollsError && !vipPolls.length ? (
                        <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 text-slate-400">Nenhuma votação encontrada.</div>
                      ) : null}

                      <div className="mt-4 space-y-4">
                      {vipPolls.map((p, idx) => (
                        <div key={idx} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3.5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="break-words text-white font-semibold">{p?.poll?.title || "Votação"}</div>
                              <div className="text-xs text-slate-500">
                                {p?.poll?.month_key || "—"} • {p?.total_votes || 0} votos • {p?.poll?.status || "—"}
                              </div>
                            </div>

                            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                              {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                                <span className="rounded-full px-2 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20">
                                  Encerrada
                                </span>
                              ) : (
                                <span className="rounded-full px-2 py-1 text-[11px] bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20">
                                  Aberta
                                </span>
                              )}

                              {String(p?.poll?.status || "").toLowerCase() === "open" ? (
                                <button
                                  onClick={() =>
                                    setCloseVote({
                                      open: true,
                                      poll: p,
                                      winnerId: null,
                                      busy: false,
                                      error: "",
                                    })
                                  }
                                  className="w-full rounded-2xl px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/4 sm:w-auto"
                                >
                                  Encerrar votação
                                </button>
                              ) : null}

                              {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                                <button
                                  onClick={() => setDeleteVote({ open: true, poll: p, busy: false, error: "" })}
                                  className="w-full rounded-2xl px-3 py-2 text-xs font-semibold text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/10 sm:w-auto"
                                >
                                  Excluir votação
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {String(p?.poll?.status || "").toLowerCase() === "closed" ? (
                            (() => {
                              const winnerId = p?.poll?.winner_option_id;
                              const winner = (p?.options || []).find((o) => String(o.id) === String(winnerId));
                              return winner ? (
                                <div className="mt-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-3">
                                  <div className="text-xs uppercase tracking-wide text-emerald-200/90">Vencedor</div>
                                  <div className="mt-1 text-slate-100 font-extrabold">{winner.title}</div>
                                </div>
                              ) : (
                                <div className="mt-3 rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-3 text-sm text-cyan-200">
                                  Votação encerrada, mas o vencedor não está salvo no banco (adicione a coluna <b>winner_option_id</b> em <b>vip_theme_polls</b>).
                                </div>
                              );
                            })()
                          ) : null}

                          <div className="mt-3 space-y-2">
                            {(p?.options || []).map((o) => (
                              <div key={o.id} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex flex-1 items-center gap-3">
                                    {o.image_url ? (
                                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/10 shrink-0">
                                        <img src={o.image_url} alt={o.title} className="h-full w-full object-cover" loading="lazy" />
                                      </div>
                                    ) : null}
                                    <div className="min-w-0">
                                      <div className="text-slate-100 truncate">{o.title}</div>
                                      {o.description ? <div className="text-xs text-slate-500 line-clamp-2">{o.description}</div> : null}
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-300 whitespace-nowrap">
                                    {o.votes} • {o.pct}%
                                  </div>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/10">
                                  <div className="h-full bg-white/30" style={{ width: `${o.pct || 0}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
            </div>
  );
}
