import React from "react";
import { DetailRow, KpiCard, OrderBadgeCluster, SectionTitle, SidebarItem, TimelineList } from "../orders/AdminOrdersComponents.jsx";
import { badgeBase, copyToClipboard, daysBetween, emailAuditBadge, endOfDay, exportCsv, fmtAddress, fmtBRL, fmtDate, onlyDigits, prodStatusBadge, shortId, startOfDay, statusBadge, toDateInputValue } from "../orders/adminOrdersUtils.js";
import AdminProductsSection from "../products/AdminProductsSection.jsx";
import AdminReviewsSection from "../reviews/AdminReviewsSection.jsx";
import AdminManagementSection from "../admins/AdminManagementSection.jsx";
import { TRACKING_CARRIERS, inferTrackingCarrierFromUrl, normalizeTrackingCarrier, resolveTrackingCarrier, trackingCarrierLabel } from "../../../lib/tracking.js";

export default function AdminOrdersSection({ admin }) {
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
                icon="inventory_2"
                title="Pedidos"
                subtitle="Busque, filtre e atualize status/rastreio. (Pedidos pagos liberam ações.)"
                right={
                  <button
                    onClick={() => exportCsv(filteredOrders)}
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                  >
                    <span className="material-icons text-[18px] align-middle mr-1">download</span>
                    Exportar CSV
                  </button>
                }
              />

              <div className="rounded-[28px] bg-gradient-to-br from-white/[0.06] to-white/[0.025] ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Busca e filtros</div>
                    <div className="text-xs text-slate-400">Busque por nome do cliente ou número do pedido e refine pelos filtros abaixo.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={applyOrderSearch}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(103,232,249,0.18)] transition hover:-translate-y-0.5"
                    >
                      <span className="material-icons text-[18px]">search</span>
                      Buscar
                    </button>
                    <button
                      onClick={clearOrderSearchAndFilters}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 transition hover:bg-white/[0.07]"
                    >
                      <span className="material-icons text-[18px]">restart_alt</span>
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <label className="block md:col-span-2">
                    <div className="text-xs text-slate-500 mb-1">Busca</div>
                    <input
                      value={qInput}
                      onChange={(e) => setQInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyOrderSearch(); }}
                      placeholder="Nome do cliente ou número do pedido"
                      className="w-full rounded-2xl bg-black/20 ring-1 ring-white/10 px-4 py-3 text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Pagamento</div>
                    <select
                      value={filterPay}
                      onChange={(e) => setFilterPay(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="failed">Falhou</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Produção</div>
                    <select
                      value={filterProd}
                      onChange={(e) => setFilterProd(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="editavel">Editável</option>
                      <option value="recebido">Recebido</option>
                      <option value="em_producao">Em produção</option>
                      <option value="pronto">Pronto</option>
                      <option value="overdue">Atrasados</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="reembolsado">Reembolsado</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Tipo</div>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      <option value="all">Todos</option>
                      <option value="store">Loja</option>
                      <option value="vip">VIP</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">De</div>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-slate-500 mb-1">Até</div>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>

                  <div className="md:col-span-5 flex flex-wrap items-end gap-2">
                    <div className="text-xs text-slate-500">
                      Página <span className="text-slate-200">{pagination.page}</span> de{" "}
                      <span className="text-slate-200">{pagination.totalPages}</span> • exibindo{" "}
                      <span className="text-slate-200">{filteredOrders.length}</span> de{" "}
                      <span className="text-slate-200">{pagination.totalCount}</span>
                    </div>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Pagos: {stats.paid}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Aguardando produção: {bottlenecks.paidWaitingProduction}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
                      Prontos sem rastreio: {bottlenecks.readyWithoutTracking}
                    </span>
                  </div>

                  <div className="flex items-end justify-end" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {orderQuickPresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={preset.apply}
                    className="rounded-full bg-white/[0.04] px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.07]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {selectedOrderIds.length ? (
                  <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-amber-100">{selectedOrderIds.length} pedido(s) selecionado(s)</div>
                        <div className="mt-1 text-xs text-slate-300">Use ações em lote para acelerar produção, reembolso e comunicação.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setBulkModal({ open: true, mode: "status" })}
                          disabled={!selectedPaidOrders.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Status em lote
                        </button>
                        {canManageBusiness ? (
                          <>
                            <button
                              onClick={() => setBulkModal({ open: true, mode: "refund_on" })}
                              disabled={!selectedOrderIds.length || bulkBusy}
                              className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                            >
                              Marcar reembolso
                            </button>
                            <button
                              onClick={() => setBulkModal({ open: true, mode: "refund_off" })}
                              disabled={!selectedOrderIds.length || bulkBusy}
                              className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                            >
                              Limpar reembolso
                            </button>
                          </>
                        ) : null}
                        <button
                          onClick={bulkResendEmails}
                          disabled={!selectedPaidOrders.length || bulkBusy}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                        >
                          Reenviar e-mails
                        </button>
                        {canManageBusiness ? (
                          <button
                            onClick={() => setBulkModal({ open: true, mode: "delete" })}
                            disabled={!selectedOrderIds.length || bulkBusy}
                            className="rounded-xl px-3 py-2 text-sm text-red-100 hover:bg-red-500/10 ring-1 ring-red-500/30 disabled:opacity-50"
                          >
                            Excluir pedidos
                          </button>
                        ) : null}
                        <button
                          onClick={() => setSelectedOrderIds([])}
                          className="rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-white/4 ring-1 ring-white/10"
                        >
                          Limpar seleção
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-400 bg-black/10">
                        <tr className="border-b border-white/10">
                          <th className="py-3 px-3 w-10">
                            <input
                              type="checkbox"
                              checked={allPageSelected}
                              onChange={toggleSelectAllCurrentPage}
                              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                              aria-label="Selecionar página atual"
                            />
                          </th>
                          <th className="py-3 px-3">Pedido</th>
                          <th className="py-3 px-3">Cliente</th>
                          <th className="py-3 px-3">Total</th>
                          <th className="py-3 px-3">Pagamento</th>
                          <th className="py-3 px-3">Produção</th>
                          <th className="py-3 px-3">Rastreio</th>
                          <th className="py-3 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {filteredOrders.map((o) => {
                          const pay = statusBadge(o.status);
                          const prod = prodStatusBadge(o.production_status);
                          const selectedRow = selectedOrderIds.includes(o.id);
                          return (
                            <tr key={o.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${selectedRow ? 'bg-cyan-500/5' : ''}`}>
                              <td className="py-3 px-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedRow}
                                  onChange={() => toggleOrderSelection(o.id)}
                                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                                  aria-label={`Selecionar pedido ${shortId(o.id)}`}
                                />
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <button
                                  onClick={() => setDetails({ open: true, orderId: o.id })}
                                  className="text-slate-100 hover:underline"
                                >
                                  {shortId(o.id)}
                                </button>
                                <div className="text-[11px] text-slate-500">{fmtDate(o.created_at)}</div>
                              </td>
                              <td className="py-3 px-3 min-w-[240px]">
                                <div className="text-slate-100">{o.customer_name || o.profile?.full_name || "—"}</div>
                                <div className="text-[11px] text-slate-500">{o.customer_email || ""}</div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-white/10">{Number(o.days_open || 0)} dia(s) aberto</span>
                                  {o.is_overdue ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-500/30">Atrasado</span> : null}
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">{fmtBRL(o.effective_total ?? o.total)}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${pay.cls}`}>{pay.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`${badgeBase} ${prod.cls}`}>{prod.label}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {o.shipping_tracking ? (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => {
                                        copyToClipboard(o.shipping_tracking);
                                        showToast("📋 Rastreio copiado!");
                                      }}
                                      className="text-slate-100 hover:underline"
                                    >
                                      {o.shipping_tracking}
                                    </button>
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/65">{trackingCarrierLabel(o.shipping_carrier || inferTrackingCarrierFromUrl(o.tracking_url))}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap text-right">
                                <button
                                  onClick={() => setDetails({ open: true, orderId: o.id })}
                                  className="rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                >
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, mode: "status", orderId: o.id })}
                                  className="ml-2 rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                  disabled={String(o.status || "").toLowerCase() !== "paid"}
                                >
                                  Status
                                </button>
                                <button
                                  onClick={() => setActionModal({ open: true, mode: "tracking", orderId: o.id })}
                                  className="ml-2 rounded-xl px-2 py-1 text-xs text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                                  disabled={String(o.status || "").toLowerCase() !== "paid"}
                                >
                                  Rastreio
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-slate-400">
                              Carregando...
                            </td>
                          </tr>
                        ) : null}
                        {!loading && error ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-red-200">
                              {error}
                            </td>
                          </tr>
                        ) : null}
                        {!loading && !error && !filteredOrders.length ? (
                          <tr>
                            <td colSpan={8} className="py-8 px-3 text-slate-400">
                              Nenhum pedido encontrado.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span>Linhas por página</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value || 25))}
                      className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-slate-100"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <span className="text-slate-500">• {pagination.totalCount} pedido(s) no filtro atual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1 || loading}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <div className="rounded-xl bg-black/20 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                      Página {pagination.page} / {pagination.totalPages}
                    </div>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages || loading}
                      className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
  );
}
