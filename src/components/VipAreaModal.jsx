import React from 'react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider.jsx'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import { copyText } from '../lib/clipboard.js'
import VipAreaTabs from './vip-area/VipAreaTabs.jsx'
import VipSelectionBar from './vip-area/VipSelectionBar.jsx'
import VipGalleryModal from './vip-area/VipGalleryModal.jsx'
const VipPresentD20 = lazyWithReload(() => import('./VipPresentD20.jsx'))
import {
  clearVipCache,
  cycleDeadlineLabel,
  cycleKeyUTC,
  findPlanByProfileValue,
  fmtBRLFromCents,
  readVipCache,
  statusLabel,
  tabHelpContent,
  vipBlockMessage,
  writeVipCache,
} from './vip-area/vipAreaHelpers.js'
import {
  buildTrackingUrl,
  resolveTrackingCarrier,
  trackingCarrierLabel,
} from '../lib/tracking'

// Planos VIP vêm do Supabase (tabela vip_plans). Sem valores fixos no código.
const FALLBACK_VIP_PLANS = []

export default function VipAreaModal({
  open,
  onClose,
  onGoVip,
  onRequireLogin,
  asPage = false,
  onGoHome,
}) {
  const { user, session, loading: authLoading } = useAuth()
  const accessToken = session?.access_token || ''

  const isOpen = asPage ? true : open

  React.useEffect(() => {
    // Evita falso-positivo ao recarregar: aguarda o AuthProvider resolver a sessão.
    if (isOpen && !user && !authLoading) {
      // Em modo página não fechamos nada — apenas pedimos login.
      onRequireLogin?.('Entre para acessar a Área VIP.')
      if (!asPage) onClose?.()
    }
  }, [isOpen, user, asPage, authLoading, onRequireLogin, onClose])
  // no refresh, usamos cache local para não "piscar" o upsell
  const cachedVipUntil = React.useMemo(() => {
    if (typeof window === 'undefined') return ''
    try {
      return String(window.localStorage.getItem('vip_until_cache') || '')
    } catch {
      return ''
    }
  }, [isOpen])

  const [loading, setLoading] = React.useState(() => Boolean(isOpen && user))
  const [error, setError] = React.useState('')
  const [vipUntil, setVipUntil] = React.useState(() =>
    cachedVipUntil ? cachedVipUntil : null
  )
  const [vipPlan, setVipPlan] = React.useState('')
  const [vipCycleKey, setVipCycleKey] = React.useState('')
  const [activeCycleKey, setActiveCycleKey] = React.useState('')
  const [orderStatus, setOrderStatus] = React.useState('editavel')
  const [shippingTracking, setShippingTracking] = React.useState('')
  const [shippingTrackingUrl, setShippingTrackingUrl] = React.useState('')
  const [shippingCarrier, setShippingCarrier] = React.useState('correios')
  const [options, setOptions] = React.useState([])
  const [optionSearch, setOptionSearch] = React.useState('')
  const [optionFilter, setOptionFilter] = React.useState('all')
  const [showOnlySelected, setShowOnlySelected] = React.useState(false)
  const [optionsError, setOptionsError] = React.useState('')
  const saveLockRef = React.useRef(false)
  const selectedRef = React.useRef([])
  const previewRequestRef = React.useRef(0)
  const loadRef = React.useRef(null)
  // selected: escolhas em edição (não necessariamente salvas)
  const [selected, setSelected] = React.useState([])
  selectedRef.current = selected
  // savedSelected: escolhas já salvas no ciclo
  const [savedSelected, setSavedSelected] = React.useState([])
  // Quando false, a UI fica travada e o botão vira "Editar".
  const [editing, setEditing] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [msg, setMsg] = React.useState('')
  const [preview, setPreview] = React.useState(null)
  const [vipPlans, setVipPlans] = React.useState(FALLBACK_VIP_PLANS)

  // UI (organização)
  const [showPoll, setShowPoll] = React.useState(false)
  const [showUpgrade, setShowUpgrade] = React.useState(false)
  const [optionsLoading, setOptionsLoading] = React.useState(false)
  const [pollLoading, setPollLoading] = React.useState(false)
  const [pollBootstrapped, setPollBootstrapped] = React.useState(false)

  // Navegação (melhor experiência no mobile)
  const [tab, setTab] = React.useState('escolhas') // 'escolhas' | 'pedido' | 'votacao' | 'upgrade' | 'presente'
  const [helpOpen, setHelpOpen] = React.useState(false)

  // Aviso elegante quando o usuário estoura o limite do plano
  const [limitNotice, setLimitNotice] = React.useState(null) // { title, text }
  const [savedChoicesPromptOpen, setSavedChoicesPromptOpen] =
    React.useState(false)
  const limitTimerRef = React.useRef(null)
  const loadSeqRef = React.useRef(0)
  const vipTopRef = React.useRef(null)
  const handleVipImageError = React.useCallback((event) => {
    const img = event?.currentTarget
    if (!img) return
    img.onerror = null
    img.src =
      "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'%3E%3Crect width='320' height='320' fill='%23060b18'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial, sans-serif' font-size='18'%3EImagem indispon%C3%ADvel%3C/text%3E%3C/svg%3E"
  }, [])

  const scrollVipToTop = React.useCallback(() => {
    try {
      vipTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {}
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {}
    try {
      const modalScroll = vipTopRef.current?.closest('[data-modal-scroll]')
      if (modalScroll) modalScroll.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {}
    try {
      const pageScroll =
        document.scrollingElement || document.documentElement || document.body
      pageScroll?.scrollTo?.({ top: 0, behavior: 'smooth' })
    } catch {}
  }, [])

  // Votação (tema do próximo mês)
  const [poll, setPoll] = React.useState(null)
  const [pollOptions, setPollOptions] = React.useState([])
  const [myVote, setMyVote] = React.useState(null)
  const [voteCounts, setVoteCounts] = React.useState({})
  const [voteBusy, setVoteBusy] = React.useState(false)

  // Upgrade de level (Pix)
  const [upgrade, setUpgrade] = React.useState(null) // {order_id, qr_code, qr_code_base64, ticket_url, status}
  const [upgradeBusy, setUpgradeBusy] = React.useState(false)
  const [upgradePayOpen, setUpgradePayOpen] = React.useState(false)
  const [upgradePayMethod, setUpgradePayMethod] = React.useState(null) // 'pix' | 'card'
  const [upgradeSuccess, setUpgradeSuccess] = React.useState(false)
  const [renewBusy, setRenewBusy] = React.useState(false)
  const [renewPayOpen, setRenewPayOpen] = React.useState(false)
  const [renewPayMethod, setRenewPayMethod] = React.useState(null)
  const [renewPix, setRenewPix] = React.useState(null)
  const [renewPixStatus, setRenewPixStatus] = React.useState('')
  const [renewChecking, setRenewChecking] = React.useState(false)

  const [cycle, setCycle] = React.useState(() => cycleKeyUTC())
  const cacheKey = React.useMemo(
    () => (user?.id ? `vip_area:${user.id}:${cycle}` : ''),
    [user?.id, cycle]
  )
  const isVip = vipUntil ? new Date(vipUntil).getTime() > Date.now() : false
  const hasCurrentCycleAccess =
    !activeCycleKey ||
    !vipCycleKey ||
    String(activeCycleKey) === String(vipCycleKey)
  const st = statusLabel(orderStatus)
  const normalizedOrderStatus = String(orderStatus || '').toLowerCase()
  const editable =
    isVip &&
    (normalizedOrderStatus === 'editavel' ||
      normalizedOrderStatus === 'recebido')
  const productionLocked = normalizedOrderStatus === 'em_producao'
  const canShowUpgrade =
    isVip &&
    ['editavel', 'recebido', 'em_producao'].includes(normalizedOrderStatus)
  const cycleDeadline = React.useMemo(() => cycleDeadlineLabel(cycle), [cycle])
  const blockNotice = React.useMemo(
    () => vipBlockMessage(orderStatus),
    [orderStatus]
  )

  // IDs que serão exibidos como selecionados na UI:
  // - editando: usa selected
  // - travado: usa savedSelected
  const displaySelected = React.useMemo(
    () => (editing ? selected : savedSelected),
    [editing, selected, savedSelected]
  )
  const selectedPlan = React.useMemo(
    () =>
      findPlanByProfileValue(vipPlans, vipPlan) ||
      (Array.isArray(vipPlans) ? vipPlans[0] : null),
    [vipPlans, vipPlan]
  )
  const vipPlanLabel = React.useMemo(
    () => selectedPlan?.short_name || selectedPlan?.name || 'VIP',
    [selectedPlan]
  )
  const isLevel3Plan = React.useMemo(() => {
    const raw = [
      selectedPlan?.id,
      selectedPlan?.slug,
      selectedPlan?.short_name,
      selectedPlan?.name,
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' | ')
    return (
      raw.includes('cubo_l3') ||
      raw.includes('level-3') ||
      raw.includes('level 3') ||
      raw.includes('nível 3') ||
      raw.includes('nivel 3')
    )
  }, [selectedPlan])

  const upgradePlans = React.useMemo(() => {
    const plans =
      Array.isArray(vipPlans) && vipPlans.length ? vipPlans : FALLBACK_VIP_PLANS
    const ordered = [...plans].sort(
      (a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0)
    )
    const idx = ordered.findIndex(
      (p) => String(p?.id) === String(selectedPlan?.id)
    )
    if (idx >= 0 && idx + 1 < ordered.length) return ordered.slice(idx + 1)
    return []
  }, [vipPlans, selectedPlan?.id])
  const nextPlan = upgradePlans[0] || null
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = React.useState('')
  const selectedUpgradePlan = React.useMemo(
    () =>
      upgradePlans.find(
        (p) => String(p?.id) === String(selectedUpgradePlanId)
      ) ||
      nextPlan ||
      null,
    [upgradePlans, selectedUpgradePlanId, nextPlan]
  )
  const miniLimit = Math.max(
    0,
    Number(
      selectedPlan?.miniatures_count ?? selectedPlan?.items_per_month ?? 0
    ) || 0
  )
  const bossLimit = Math.max(0, Number(selectedPlan?.boss_count ?? 0) || 0)
  const totalLimit = Math.max(
    0,
    Number(selectedPlan?.items_per_month ?? miniLimit + bossLimit) ||
      miniLimit + bossLimit
  )
  const help = React.useMemo(
    () =>
      tabHelpContent(tab, {
        totalLimit,
        editable,
        planName: vipPlanLabel,
        deadline: cycleDeadline,
      }) || { title: 'Como funciona', body: '' },
    [tab, totalLimit, editable, vipPlanLabel, cycleDeadline]
  )

  const currentPriceCents = React.useMemo(() => {
    if (typeof selectedPlan?.price_cents === 'number')
      return selectedPlan.price_cents
    if (typeof selectedPlan?.price_brl === 'number')
      return Math.round(selectedPlan.price_brl * 100)
    if (typeof selectedPlan?.price === 'number')
      return Math.round(selectedPlan.price * 100)
    return 0
  }, [selectedPlan])

  const selectedUpgradePriceCents = React.useMemo(() => {
    if (typeof selectedUpgradePlan?.price_cents === 'number')
      return selectedUpgradePlan.price_cents
    if (typeof selectedUpgradePlan?.price_brl === 'number')
      return Math.round(selectedUpgradePlan.price_brl * 100)
    if (typeof selectedUpgradePlan?.price === 'number')
      return Math.round(selectedUpgradePlan.price * 100)
    return 0
  }, [selectedUpgradePlan])

  const upgradeDiffCents = React.useMemo(() => {
    const diff =
      Number(selectedUpgradePriceCents || 0) - Number(currentPriceCents || 0)
    return diff > 0 ? diff : 0
  }, [selectedUpgradePriceCents, currentPriceCents])

  React.useEffect(() => {
    if (!upgradePlans.length) {
      setSelectedUpgradePlanId('')
      return
    }
    setSelectedUpgradePlanId((current) => {
      const hasCurrent = upgradePlans.some(
        (p) => String(p?.id) === String(current)
      )
      return hasCurrent ? current : String(upgradePlans[0]?.id || '')
    })
  }, [upgradePlans])

  const optionTypeById = React.useMemo(() => {
    const map = new Map()
    for (const o of options || []) {
      const t = String(o?.item_type || 'miniature').toLowerCase()
      map.set(o.id, t === 'boss' ? 'boss' : 'miniature')
    }
    return map
  }, [options])

  const optionById = React.useMemo(() => {
    const map = new Map()
    for (const o of options || []) map.set(o.id, o)
    return map
  }, [options])

  const selectedCards = React.useMemo(() => {
    return (displaySelected || []).map((id) => ({
      id,
      opt: optionById.get(id) || null,
    }))
  }, [displaySelected, optionById])
  const level3AutoIds = React.useMemo(() => {
    if (!isLevel3Plan) return []
    return (options || []).map((o) => o?.id).filter(Boolean)
  }, [isLevel3Plan, options])
  const level3AutoSet = React.useMemo(
    () => new Set(level3AutoIds),
    [level3AutoIds]
  )
  const isLevel3AutoMode =
    isLevel3Plan && hasCurrentCycleAccess && level3AutoIds.length > 0
  const level3EffectiveIds = React.useMemo(
    () =>
      Array.isArray(savedSelected) && savedSelected.length
        ? savedSelected
        : level3AutoIds,
    [savedSelected, level3AutoIds]
  )
  const hasLevel3CustomSelection = React.useMemo(() => {
    if (!isLevel3Plan || !Array.isArray(savedSelected) || !savedSelected.length)
      return false
    return (
      savedSelected.length !== level3AutoIds.length ||
      savedSelected.some((id) => !level3AutoSet.has(id))
    )
  }, [isLevel3Plan, savedSelected, level3AutoIds, level3AutoSet])

  const openEditingMode = React.useCallback(() => {
    if (!editable) {
      if (productionLocked) {
        showCenteredNotice(
          'Pedido em produção',
          'Seu pedido já está em produção. Não é mais permitido fazer alterações.'
        )
      }
      return
    }
    setSelected(Array.isArray(savedSelected) ? savedSelected : [])
    setEditing(true)
    setMsg('')
    setSavedChoicesPromptOpen(false)
    scrollVipToTop()
  }, [editable, productionLocked, savedSelected, scrollVipToTop])

  const selectedCounts = React.useMemo(() => {
    let mini = 0
    let boss = 0
    const sourceIds = isLevel3AutoMode ? level3EffectiveIds : displaySelected
    for (const id of sourceIds || []) {
      const t = optionTypeById.get(id) || 'miniature'
      if (t === 'boss') boss += 1
      else mini += 1
    }
    return { mini, boss, total: mini + boss }
  }, [displaySelected, optionTypeById, isLevel3AutoMode, level3EffectiveIds])

  const progress = React.useMemo(() => {
    const safePct = (value, limit) => {
      if (!limit) return value > 0 ? 100 : 0
      return Math.min(100, Math.round((value / limit) * 100))
    }
    const remaining = Math.max(0, totalLimit - selectedCounts.total)
    const missingMini = Math.max(0, miniLimit - selectedCounts.mini)
    const missingBoss = Math.max(0, bossLimit - selectedCounts.boss)
    const complete =
      selectedCounts.total === totalLimit &&
      selectedCounts.mini === miniLimit &&
      selectedCounts.boss === bossLimit
    return {
      totalPct: safePct(selectedCounts.total, totalLimit),
      miniPct: safePct(selectedCounts.mini, miniLimit),
      bossPct: bossLimit ? safePct(selectedCounts.boss, bossLimit) : 100,
      remaining,
      missingMini,
      missingBoss,
      complete,
    }
  }, [selectedCounts, totalLimit, miniLimit, bossLimit])

  const filteredOptions = React.useMemo(() => {
    const normalize = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    const query = normalize(optionSearch.trim())
    const selectedIds = isLevel3AutoMode ? level3EffectiveIds : displaySelected
    return options.filter((option) => {
      const type =
        String(option.item_type || 'miniature').toLowerCase() === 'boss'
          ? 'boss'
          : 'miniature'
      return (
        (optionFilter === 'all' || type === optionFilter) &&
        (!showOnlySelected || selectedIds.includes(option.id)) &&
        normalize(option.title).includes(query)
      )
    })
  }, [
    options,
    optionSearch,
    optionFilter,
    showOnlySelected,
    displaySelected,
    isLevel3AutoMode,
    level3EffectiveIds,
  ])

  const visibleTabs = React.useMemo(() => {
    const tabs = [
      {
        k: 'escolhas',
        label: 'Escolhas',
        ic: 'checklist',
        mobileLabel: 'Escolhas',
        badge: progress.complete
          ? 'Fechado'
          : `${selectedCounts.total}/${totalLimit}`,
        tone: progress.complete
          ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30'
          : 'bg-violet-500/15 text-violet-100 ring-violet-400/30',
        visible: true,
      },
      {
        k: 'pedido',
        label: 'Pedido',
        ic: 'local_shipping',
        mobileLabel: 'Pedido',
        badge: st.label,
        tone: st.cls,
        visible: true,
      },
      {
        k: 'votacao',
        label: 'Votação',
        ic: 'how_to_vote',
        mobileLabel: 'Votação',
        badge: poll?.id
          ? String(poll?.status || '').toLowerCase() === 'open'
            ? 'Aberta'
            : 'Encerrada'
          : 'Indisponível',
        tone: poll?.id
          ? 'bg-cyan-500/15 text-cyan-100 ring-cyan-400/30'
          : 'bg-white/4 text-slate-300 ring-white/10',
        visible: !!poll?.id || pollLoading || !pollBootstrapped,
      },
      {
        k: 'upgrade',
        label: 'Upgrade',
        ic: 'upgrade',
        mobileLabel: 'Upgrade',
        badge:
          canShowUpgrade && nextPlan
            ? 'Disponível'
            : upgrade?.order_id
              ? 'Em andamento'
              : 'Fechado',
        tone:
          (canShowUpgrade && nextPlan) || upgrade?.order_id
            ? 'bg-amber-400/15 text-amber-100 ring-amber-300/30'
            : 'bg-white/4 text-slate-300 ring-white/10',
        visible:
          canShowUpgrade &&
          (!!nextPlan || !!upgrade?.order_id || !!upgradeSuccess),
      },
      {
        k: 'presente',
        label: 'Presente',
        ic: 'redeem',
        mobileLabel: 'Presente',
        badge: 'd20',
        tone: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30',
        visible: true,
      },
    ]
    return tabs.filter((item) => item.visible)
  }, [
    progress.complete,
    selectedCounts.total,
    totalLimit,
    st.label,
    st.cls,
    poll?.id,
    poll?.status,
    pollLoading,
    pollBootstrapped,
    nextPlan,
    upgrade?.order_id,
    upgradeSuccess,
    canShowUpgrade,
  ])

  const orderTimelineSteps = React.useMemo(() => {
    const current = String(orderStatus || 'editavel').toLowerCase()
    const map = {
      editavel: 0,
      recebido: 1,
      em_producao: 2,
      pronto: 3,
      enviado: 4,
      entregue: 5,
      cancelado: 5,
      reembolsado: 5,
    }
    const currentIdx = map[current] ?? 0
    const cancelled = current === 'cancelado' || current === 'reembolsado'
    const labels = [
      {
        key: 'editavel',
        title: 'Escolhas abertas',
        desc: 'Você ainda pode revisar o ciclo.',
      },
      {
        key: 'recebido',
        title: 'Pedido recebido',
        desc: 'Seu ciclo entrou na fila interna.',
      },
      {
        key: 'em_producao',
        title: 'Em produção',
        desc: 'Sua caixa está sendo preparada.',
      },
      {
        key: 'pronto',
        title: 'Pronto para envio',
        desc: 'Falta apenas gerar o envio.',
      },
      {
        key: 'enviado',
        title: 'Enviado',
        desc: shippingTracking
          ? `Rastreio ${shippingTracking}`
          : 'Seu código aparece aqui assim que sair.',
      },
      {
        key: 'entregue',
        title: 'Entregue',
        desc: 'Pedido finalizado com sucesso.',
      },
    ]
    return labels.map((step, idx) => ({
      ...step,
      done: cancelled ? idx < currentIdx : idx <= currentIdx,
      current: !cancelled && idx === currentIdx,
      blocked: cancelled && idx >= currentIdx,
      cancelled,
    }))
  }, [orderStatus, shippingTracking])

  React.useEffect(() => {
    if (!visibleTabs.some((item) => item.k === tab)) {
      setTab(visibleTabs[0]?.k || 'escolhas')
    }
  }, [visibleTabs, tab])

  function canAdd(optionId) {
    if (!hasCurrentCycleAccess) return false
    const t = optionTypeById.get(optionId) || 'miniature'
    if (selectedCounts.total >= totalLimit) return false
    if (t === 'boss') return selectedCounts.boss < bossLimit
    return selectedCounts.mini < miniLimit
  }

  React.useEffect(() => {
    if (!cacheKey) return
    const cached = readVipCache(cacheKey, null)
    if (!cached || typeof cached !== 'object') return
    if (cached.vipUntil) setVipUntil(cached.vipUntil)
    if (cached.vipPlan) setVipPlan(cached.vipPlan)
    if (cached.vipCycleKey) setVipCycleKey(String(cached.vipCycleKey))
    if (cached.activeCycleKey) setActiveCycleKey(String(cached.activeCycleKey))
    if (cached.orderStatus)
      setOrderStatus(String(cached.orderStatus).toLowerCase())
    if (typeof cached.shippingTracking === 'string')
      setShippingTracking(cached.shippingTracking)
    if (Array.isArray(cached.savedSelected))
      setSavedSelected(cached.savedSelected)
    if (Array.isArray(cached.selected)) setSelected(cached.selected)
    if (typeof cached.editing === 'boolean') setEditing(cached.editing)
    if (typeof cached.tab === 'string') setTab(cached.tab)
    if (Array.isArray(cached.options) && cached.options.length)
      setOptions(cached.options)
  }, [cacheKey])

  React.useEffect(() => {
    if (!cacheKey || !user?.id) return
    writeVipCache(cacheKey, {
      vipUntil,
      vipPlan,
      vipCycleKey,
      activeCycleKey,
      orderStatus,
      shippingTracking,
      savedSelected,
      selected,
      editing,
      tab,
      options: Array.isArray(options) ? options.slice(0, 24) : [],
      updatedAt: Date.now(),
    })
  }, [
    cacheKey,
    user?.id,
    vipUntil,
    vipPlan,
    vipCycleKey,
    activeCycleKey,
    orderStatus,
    shippingTracking,
    savedSelected,
    selected,
    editing,
    tab,
    options,
  ])

  function showCenteredNotice(title, text) {
    if (limitTimerRef.current) {
      clearTimeout(limitTimerRef.current)
      limitTimerRef.current = null
    }
    setLimitNotice({ title, text, center: true })
    limitTimerRef.current = setTimeout(() => setLimitNotice(null), 3800)
  }

  function showLimitNotice(kind, anchorEl) {
    // kind: 'total' | 'mini' | 'boss'
    if (limitTimerRef.current) {
      clearTimeout(limitTimerRef.current)
      limitTimerRef.current = null
    }

    const planName =
      selectedPlan?.short_name || selectedPlan?.name || 'seu plano'
    const base = `Você já atingiu o limite do ${planName}.`

    let title = 'Limite do plano atingido'
    let text = base
    if (kind === 'mini') {
      text = `${base} Seu plano permite ${miniLimit} miniatura(s). Para escolher mais miniaturas, faça o upgrade.`
    } else if (kind === 'boss') {
      text = `${base} Seu plano permite ${bossLimit} boss(es). Para escolher mais bosses, faça o upgrade.`
    } else {
      text = `${base} Seu plano permite ${totalLimit} item(ns) por mês. Para escolher mais, faça o upgrade.`
    }

    // Se não existir próximo plano, não promete upgrade — só informa o limite.
    if (!nextPlan) {
      text = `${base} Você já escolheu a quantidade máxima deste ciclo.`
    }

    // Posiciona a notificação perto do botão/ação que disparou o limite.
    // (Experiência melhor no mobile: aparece onde o usuário está olhando.)
    let x = Math.round((window.innerWidth || 0) / 2)
    let y = Math.round((window.innerHeight || 0) * 0.75)
    try {
      if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
        const r = anchorEl.getBoundingClientRect()
        x = Math.round(r.left + r.width / 2)
        y = Math.round(r.top)
      }
      const pad = 16
      const maxX = Math.max(pad, (window.innerWidth || 0) - pad)
      const maxY = Math.max(pad, (window.innerHeight || 0) - pad)
      x = Math.min(Math.max(x, pad), maxX)
      y = Math.min(Math.max(y, pad), maxY)
    } catch {}

    setLimitNotice({ title, text, x, y })
    limitTimerRef.current = setTimeout(() => setLimitNotice(null), 3800)
  }

  React.useEffect(() => {
    return () => {
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current)
    }
  }, [])

  // Lazy-load por aba (evita travar o mobile)
  React.useEffect(() => {
    if (!user || !isVip) return
    // sincroniza os painéis antigos com a navegação por abas
    setShowPoll(tab === 'votacao')
    setShowUpgrade(tab === 'upgrade')
    if (
      tab === 'escolhas' &&
      !optionsLoading &&
      (!options || options.length === 0)
    ) {
      loadOptionsLite()
    }
    if (tab === 'votacao' && !pollLoading && !poll?.id) {
      loadPollAsync()
    }
  }, [tab, user, isVip])

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.items)) return null
      return parsed
    } catch {
      return null
    }
  }

  function writeCache(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify({ items, savedAt: Date.now() }))
    } catch {}
  }

  async function loadOptionsLite(seq = loadSeqRef.current, cycleKey = cycle) {
    if (!user) return
    setOptionsLoading(true)
    setOptionsError('')
    const cacheKey = `vip_options_${cycleKey}`
    const cached = readCache(cacheKey)
    if (cached?.items?.length) setOptions(cached.items)
    try {
      // Listagem leve: deixa o grid rápido; detalhes só no preview.
      const cycleResp = await fetch(
        `/api/core?action=vip-cycle&cycle_key=${encodeURIComponent(String(cycleKey || cycle || ''))}`
      )
      const cycleJson = await cycleResp.json().catch(() => ({}))
      if (!cycleResp.ok)
        throw new Error(
          cycleJson?.error || 'Não foi possível carregar as miniaturas.'
        )
      const items = Array.isArray(cycleJson?.items) ? cycleJson.items : []
      if (seq !== loadSeqRef.current) return
      setOptions(items)
      if (items.length) writeCache(cacheKey, items)
    } catch {
      if (seq === loadSeqRef.current)
        setOptionsError(
          'Não foi possível atualizar as miniaturas. Tente novamente.'
        )
      // mantém cache (se houver)
    } finally {
      if (seq === loadSeqRef.current) setOptionsLoading(false)
    }
  }

  async function loadPollAsync(seq = loadSeqRef.current) {
    if (!user) return
    setPollLoading(true)
    try {
      let pollResp = await supabase
        .from('vip_theme_polls')
        .select('id,month_key,title,status,winner_option_id,closed_at')
        .order('month_key', { ascending: false })
        .limit(1)
        .maybeSingle()

      // compat: winner columns may not exist yet
      if (
        pollResp?.error &&
        String(pollResp.error.message || '').match(
          /winner_option_id|closed_at|column/i
        )
      ) {
        pollResp = await supabase
          .from('vip_theme_polls')
          .select('id,month_key,title,status')
          .order('month_key', { ascending: false })
          .limit(1)
          .maybeSingle()
      }

      const p = pollResp?.data
      if (seq !== loadSeqRef.current) return
      setPoll(p || null)
      if (p?.id) {
        const [{ data: opts2 }, { data: mine }, { data: counts }] =
          await Promise.all([
            supabase
              .from('vip_theme_options')
              .select(
                'id,poll_id,title,description,image_url,sort_order,active'
              )
              .eq('poll_id', p.id)
              .eq('active', true)
              .order('sort_order', { ascending: true }),
            supabase
              .from('vip_theme_votes')
              .select('option_id')
              .eq('poll_id', p.id)
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase.rpc('vip_theme_counts', { p_poll_id: p.id }),
          ])
        if (seq !== loadSeqRef.current) return
        setPollOptions(Array.isArray(opts2) ? opts2 : [])
        setMyVote(mine?.option_id || null)
        const map = {}
        for (const r of counts || [])
          map[String(r.option_id)] = Number(r.votes) || 0
        setVoteCounts(map)
      } else {
        setPollOptions([])
        setMyVote(null)
        setVoteCounts({})
      }
    } catch {
      if (seq !== loadSeqRef.current) return
      setPoll(null)
      setPollOptions([])
      setMyVote(null)
      setVoteCounts({})
    } finally {
      if (seq === loadSeqRef.current) {
        setPollLoading(false)
        setPollBootstrapped(true)
      }
    }
  }

  async function openPreviewLite(opt) {
    if (!opt?.id) return
    const request = ++previewRequestRef.current
    setPreview(opt)
    if (Array.isArray(opt.gallery_images) && opt.gallery_images.length) return
    try {
      const { data } = await supabase
        .from('vip_mini_options')
        .select(
          'id,title,description,image_url,gallery_images,sort_order,active,item_type'
        )
        .eq('id', opt.id)
        .maybeSingle()
      if (request !== previewRequestRef.current) return
      const merged = { ...opt, ...(data || {}) }
      setOptions((previous) =>
        previous.map((option) =>
          String(option.id) === String(opt.id) ? merged : option
        )
      )
      setPreview(merged)
    } catch {
      /* Keep the first image available even when details fail. */
    }
  }

  async function resolveActiveCycle() {
    try {
      const resp = await fetch(`/api/core?action=vip-cycle`)
      const json = await resp.json().catch(() => ({}))
      const nextCycle = String(json?.active_cycle_key || '').trim()
      if (nextCycle) {
        setActiveCycleKey(nextCycle)
        return nextCycle
      }
    } catch {}
    const fallbackCycle = cycleKeyUTC()
    setActiveCycleKey(fallbackCycle)
    return fallbackCycle
  }

  async function load() {
    if (!user) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const cycleForLoad = await resolveActiveCycle()
      if (seq !== loadSeqRef.current) return
      setCycle(cycleForLoad)

      // Planos em background (não trava a UI)
      ;(async () => {
        try {
          const plansResp = await fetch('/api/vip-plans')
          const plansJson = await plansResp.json().catch(() => ({}))
          if (
            seq === loadSeqRef.current &&
            plansResp.ok &&
            Array.isArray(plansJson?.plans) &&
            plansJson.plans.length
          )
            setVipPlans(plansJson.plans)
        } catch {}
      })()

      // Core (rápido): perfil + status + seleção salva
      const profilePromise = (async () => {
        const sessionResp = await supabase.auth.getSession()
        const jwt = sessionResp?.data?.session?.access_token || ''
        if (jwt) {
          try {
            const apiResp = await fetch('/api/profile', {
              headers: { Authorization: `Bearer ${jwt}` },
            })
            const apiJson = await apiResp.json().catch(() => ({}))
            if (apiResp.ok) {
              return {
                ...(apiJson?.profile || {}),
                vip_cycle_key: String(
                  apiJson?.profile?.vip_cycle_key || ''
                ).trim(),
              }
            }
          } catch {}
        }

        let resp = await supabase
          .from('profiles')
          .select('vip_until,vip_plan')
          .eq('id', user.id)
          .maybeSingle()
        if (resp?.error) throw resp.error
        return { ...(resp?.data || {}), vip_cycle_key: '' }
      })()
      const [prof, { data: lastVipOrder }, { data: sel }] = await Promise.all([
        profilePromise,
        (async () => {
          const attempts = [
            'id,production_status,shipping_tracking,shipping_carrier,tracking_url,created_at',
            'id,production_status,shipping_tracking,shipping_carrier,created_at',
            'id,production_status,shipping_tracking,created_at',
          ]
          let lastResp = null
          for (const selectColumns of attempts) {
            const resp = await supabase
              .from('orders')
              .select(selectColumns)
              .eq('user_id', user.id)
              .eq('order_type', 'vip')
              .eq('status', 'paid')
              .order('created_at', { ascending: false })
              .limit(1)
            if (!resp.error) return resp
            lastResp = resp
            if (!/column/i.test(String(resp.error.message || ''))) break
          }
          return lastResp || { data: [], error: null }
        })(),
        // saved_at ajuda a diferenciar seleção realmente salva de um registro antigo/placeholder
        supabase
          .from('vip_mini_selections')
          .select('selected_option_ids,saved_at')
          .eq('user_id', user.id)
          .eq('cycle_key', cycleForLoad)
          .maybeSingle(),
      ])

      if (seq !== loadSeqRef.current) return
      const order = Array.isArray(lastVipOrder) ? lastVipOrder[0] : null
      const fallbackAccountCycle = String(order?.created_at || '').slice(0, 7)
      const until = prof?.vip_until || null
      setVipUntil(until)
      setVipPlan(prof?.vip_plan || '')
      setVipCycleKey(
        String(prof?.vip_cycle_key || '').trim() || fallbackAccountCycle || ''
      )

      // Atualiza cache local para evitar "piscar" no refresh.
      try {
        if (until && new Date(String(until)) > new Date())
          window.localStorage.setItem('vip_until_cache', String(until))
        else window.localStorage.removeItem('vip_until_cache')
      } catch {}
      // Mantém o que já estava na tela para evitar flicker no mobile durante refresh.

      const resolvedCarrier = resolveTrackingCarrier({
        carrier: order?.shipping_carrier,
        trackingUrl: order?.tracking_url,
      })
      setOrderStatus(
        String(order?.production_status || 'editavel').toLowerCase()
      )
      setShippingTracking(String(order?.shipping_tracking || '').trim())
      setShippingCarrier(resolvedCarrier)
      setShippingTrackingUrl(
        buildTrackingUrl({
          code: order?.shipping_tracking,
          fallbackUrl: order?.tracking_url,
          carrier: resolvedCarrier,
        })
      )

      // Regra: ao abrir a tela após assinatura, não deve vir nada pré-selecionado.
      // Só exibimos escolhas se houver saved_at (seleção confirmada no ciclo).
      const hasSaved = !!sel?.saved_at
      const ids =
        hasSaved && Array.isArray(sel?.selected_option_ids)
          ? sel.selected_option_ids
          : []
      setSavedSelected(ids)

      // Em edição: começa vazio se não houver seleção salva no ciclo.
      // Se já existe seleção salva, começa travado e o usuário clica em "Editar".
      if (ids.length) {
        setEditing(false)
        setSelected([])
      } else {
        setEditing(true)
        setSelected([])
      }

      // Carrega catálogo + votação em background
      setPollBootstrapped(false)
      loadOptionsLite(seq, cycleForLoad)
      loadPollAsync(seq)
    } catch {
      if (seq === loadSeqRef.current)
        setError('Não foi possível carregar a área VIP. Tente novamente.')
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }

  loadRef.current = load
  React.useEffect(() => {
    if (!isOpen || authLoading || !user?.id) return
    loadRef.current()
    return () => {
      loadSeqRef.current += 1
      previewRequestRef.current += 1
    }
  }, [isOpen, authLoading, user?.id])

  React.useEffect(() => {
    if (!isOpen || !Array.isArray(savedSelected) || !savedSelected.length)
      return
    const knownIds = new Set(
      (options || []).map((option) => String(option?.id || ''))
    )
    const missingIds = savedSelected
      .map(String)
      .filter((id) => id && !knownIds.has(id))
    if (!missingIds.length) return
    let active = true
    fetch(
      `/api/core?action=vip-cycle&option_ids=${encodeURIComponent(missingIds.join(','))}`
    )
      .then((response) =>
        response
          .json()
          .catch(() => ({}))
          .then((json) => ({ ok: response.ok, json }))
      )
      .then(({ ok, json }) => {
        const data = Array.isArray(json?.items) ? json.items : []
        if (!active || !ok || !data.length) return
        setOptions((current) => {
          const map = new Map(
            (Array.isArray(current) ? current : []).map((option) => [
              String(option?.id),
              option,
            ])
          )
          data.forEach((option) =>
            map.set(String(option.id), { ...option, from_previous_cycle: true })
          )
          return Array.from(map.values())
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen, savedSelected, options])

  React.useEffect(() => {
    if (!cacheKey || !editing) return
    const draft = readVipCache(`${cacheKey}:draft`, null)
    if (!draft || !Array.isArray(draft.selected_option_ids)) return
    if (savedSelected?.length) return
    setSelected(draft.selected_option_ids)
  }, [cacheKey, editing, savedSelected])

  React.useEffect(() => {
    if (!cacheKey) return
    if (!editing || !Array.isArray(selected) || !selected.length) {
      clearVipCache(`${cacheKey}:draft`)
      return
    }
    writeVipCache(`${cacheKey}:draft`, {
      selected_option_ids: selected,
      updatedAt: Date.now(),
    })
  }, [cacheKey, editing, selected])

  React.useEffect(() => {
    if (!isOpen || !user?.id || !isLevel3AutoMode) return
    if (Array.isArray(savedSelected) && savedSelected.length) return
    const ids = level3AutoIds
    if (!ids.length) return
    setSavedSelected((prev) => {
      const prevIds = Array.isArray(prev) ? prev : []
      if (
        prevIds.length === ids.length &&
        prevIds.every((id) => level3AutoSet.has(id))
      )
        return prevIds
      return ids
    })
    setSelected([])
    setEditing(false)
    setMsg('')
    let cancelled = false
    ;(async () => {
      try {
        const payload = {
          user_id: user.id,
          cycle_key: cycle,
          selected_option_ids: ids,
          saved_at: new Date().toISOString(),
        }
        const { error } = await supabase
          .from('vip_mini_selections')
          .upsert(payload, { onConflict: 'user_id,cycle_key' })
        if (error) throw error
      } catch (e) {
        if (!cancelled) console.warn('vip level 3 auto selection failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    user?.id,
    isLevel3AutoMode,
    level3AutoIds,
    level3AutoSet,
    cycle,
    savedSelected,
  ])

  React.useEffect(() => {
    if (!isOpen || !user || !isVip || pollBootstrapped || pollLoading) return
    loadPollAsync()
  }, [isOpen, user, isVip, pollBootstrapped, pollLoading])

  async function refreshVoteCounts(pollId) {
    try {
      const { data: counts } = await supabase.rpc('vip_theme_counts', {
        p_poll_id: pollId,
      })
      const map = {}
      for (const r of counts || [])
        map[String(r.option_id)] = Number(r.votes) || 0
      setVoteCounts(map)
    } catch {}
  }

  async function vote(optionId) {
    if (!user || !poll?.id) return
    if (String(poll?.status || '').toLowerCase() !== 'open') {
      setMsg('A votação já foi encerrada.')
      return
    }
    if (!isVip) {
      setMsg('A votação é exclusiva para membros VIP.')
      return
    }
    try {
      setVoteBusy(true)
      setMsg('')
      const payload = {
        poll_id: poll.id,
        option_id: optionId,
        user_id: user.id,
      }
      const { error: upErr } = await supabase
        .from('vip_theme_votes')
        .upsert(payload, { onConflict: 'poll_id,user_id' })
      if (upErr) throw upErr
      setMyVote(optionId)
      await refreshVoteCounts(poll.id)
      setMsg('Voto registrado ✅')
    } catch {
      setMsg('Não foi possível registrar seu voto.')
    } finally {
      setVoteBusy(false)
    }
  }

  async function startUpgradePix() {
    if (!user || !isVip) return
    if (!selectedUpgradePlan?.id) return
    try {
      setUpgradeBusy(true)
      setMsg('')
      setUpgrade(null)
      const session = await supabase.auth.getSession()
      const jwt = session?.data?.session?.access_token
      if (!jwt) {
        onRequireLogin?.(
          'Sessão expirada. Faça login novamente para continuar.'
        )
        onClose?.()
        return
      }
      const res = await fetch('/api/create-pix-payment?mode=vip_upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ to_plan_id: selectedUpgradePlan.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          data?.error || 'Não foi possível gerar o Pix do upgrade.'
        )
      setUpgrade({
        order_id: data?.order_id || '',
        qr_code: data?.qr_code || '',
        qr_code_base64: data?.qr_code_base64 || '',
        ticket_url: data?.ticket_url || '',
        status: String(data?.status || '').toLowerCase(),
      })
      setUpgradePayOpen(false)
      setMsg('Pix do upgrade gerado. A confirmação é automática.')
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível gerar o Pix do upgrade.'))
    } finally {
      setUpgradeBusy(false)
    }
  }

  async function startUpgradeCard() {
    if (!user || !isVip) return
    if (!selectedUpgradePlan?.id) return
    try {
      setUpgradeBusy(true)
      setMsg('')
      const session = await supabase.auth.getSession()
      const jwt = session?.data?.session?.access_token
      if (!jwt) {
        onRequireLogin?.(
          'Sessão expirada. Faça login novamente para continuar.'
        )
        onClose?.()
        return
      }
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          mode: 'vip_upgrade',
          to_plan_id: selectedUpgradePlan.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.code === 'profile_incomplete') {
          setMsg(
            'Complete seus dados no perfil (CPF e endereço) para continuar.'
          )
          return
        }
        throw new Error(data?.error || 'Não foi possível iniciar o pagamento.')
      }
      if (data?.url) {
        setUpgradePayOpen(false)
        window.location.href = data.url
        return
      }
      setMsg('Checkout criado.')
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível iniciar o pagamento.'))
    } finally {
      setUpgradeBusy(false)
    }
  }

  React.useEffect(() => {
    if (!upgrade?.order_id) return
    let stopped = false
    const t = setInterval(async () => {
      if (stopped) return
      try {
        const session = await supabase.auth.getSession()
        const jwt = session?.data?.session?.access_token
        if (!jwt) return

        const res = await fetch(`/api/pix-payment?action=verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ order_id: upgrade.order_id }),
        })
        const data = await res.json().catch(() => ({}))
        const st = String(data?.status || '').toLowerCase()
        if (st) setUpgrade((p) => ({ ...(p || {}), status: st }))

        if (st === 'paid') {
          stopped = true
          clearInterval(t)
          setUpgrade(null) // some o QR code
          setUpgradePayMethod(null)
          setUpgradeSuccess(true)
          setMsg('Você subiu de nível ✅')
          await load()
          setTimeout(() => setUpgradeSuccess(false), 12000)
        }

        if (st === 'failed') {
          stopped = true
          clearInterval(t)
          setMsg(
            'Pagamento recusado ou cancelado. Se precisar, gere um novo Pix.'
          )
        }
      } catch {}
    }, 5000)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [upgrade?.order_id])

  function toggleOption(opt, anchor) {
    if (saving || isLevel3AutoMode) return
    if (!editable) {
      showCenteredNotice(
        blockNotice?.title || 'Escolhas fechadas',
        blockNotice?.text ||
          'Seu pedido já avançou e não permite novas alterações.'
      )
      return
    }
    if (!editing) {
      setSavedChoicesPromptOpen(true)
      return
    }
    const current = selectedRef.current
    if (current.includes(opt.id)) {
      const next = current.filter((id) => id !== opt.id)
      selectedRef.current = next
      setSelected(next)
      setMsg('')
      return
    }
    const counts = current.reduce(
      (result, id) => {
        result[optionTypeById.get(id) === 'boss' ? 'boss' : 'mini'] += 1
        return result
      },
      { mini: 0, boss: 0 }
    )
    const type = optionTypeById.get(opt.id) === 'boss' ? 'boss' : 'mini'
    if (current.length >= totalLimit) {
      showLimitNotice('total', anchor)
      return
    }
    if (counts[type] >= (type === 'boss' ? bossLimit : miniLimit)) {
      showLimitNotice(type, anchor)
      return
    }
    const next = [...current, opt.id]
    selectedRef.current = next
    setSelected(next)
    setMsg('')
  }

  async function copyPixCode(code) {
    const copied = await copyText(code)
    setMsg(
      copied
        ? 'Código Pix copiado.'
        : 'Não foi possível copiar. Selecione o código e copie manualmente.'
    )
  }

  async function saveSelection() {
    if (saveLockRef.current) return
    if (!hasCurrentCycleAccess) {
      setMsg('Renove sua assinatura para liberar as escolhas do ciclo atual.')
      return
    }
    if (!editable) {
      if (productionLocked) {
        showCenteredNotice(
          'Pedido em produção',
          'Seu pedido já está em produção. Não é mais permitido fazer alterações.'
        )
      }
      return
    }
    if (!editing) return
    if (
      selectedCounts.mini !== miniLimit ||
      selectedCounts.boss !== bossLimit ||
      selectedCounts.total !== totalLimit
    ) {
      setMsg(
        `Escolha exatamente ${totalLimit} item(ns) para o seu plano (${miniLimit} miniatura(s)${bossLimit ? ` + ${bossLimit} boss(es)` : ''}).`
      )
      return
    }
    saveLockRef.current = true
    try {
      setSaving(true)
      setMsg('')
      const payload = {
        user_id: user.id,
        cycle_key: cycle,
        selected_option_ids: selected,
        saved_at: new Date().toISOString(),
      }
      const { error: upErr } = await supabase
        .from('vip_mini_selections')
        .upsert(payload, { onConflict: 'user_id,cycle_key' })
      if (upErr) throw upErr
      setSavedSelected(selected)
      setSelected([])
      setEditing(false)
      clearVipCache(`${cacheKey}:draft`)
      setMsg('Escolhas salvas ✅')
    } catch (e) {
      const raw = String(e?.message || '')
      // Não mostrar mensagens técnicas do Postgres na UI
      if (
        raw.toLowerCase().includes('violates check constraint') ||
        raw.toLowerCase().includes('new row for relation')
      ) {
        setMsg(
          'Não foi possível salvar. Confira se você selecionou a quantidade correta do seu plano.'
        )
      } else {
        setMsg('Não foi possível salvar. Tente novamente.')
      }
    } finally {
      saveLockRef.current = false
      setSaving(false)
    }
  }

  async function verifyRenewPix(orderId) {
    if (!orderId || !accessToken) return false
    try {
      setRenewChecking(true)
      const res = await fetch('/api/pix-payment?action=verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          data?.error || 'Não foi possível verificar a renovação.'
        )
      const st = String(data?.status || data?.mp_status || '').toLowerCase()
      setRenewPixStatus(st)
      if (st === 'paid' || st === 'approved') {
        setMsg('Renovação confirmada ✅ O novo ciclo foi liberado.')
        setRenewPix(null)
        setRenewPayOpen(false)
        await load()
        return true
      }
      return false
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível verificar a renovação.'))
      return false
    } finally {
      setRenewChecking(false)
    }
  }

  async function startRenewPix() {
    if (!user || !isVip || !selectedPlan?.id) return
    try {
      setRenewBusy(true)
      setRenewPix(null)
      setMsg('')
      const res = await fetch('/api/create-pix-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vip_plan_id: selectedPlan.id,
          description: `Renovação ${selectedPlan.id}`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          data?.error || 'Não foi possível gerar o Pix da renovação.'
        )
      setRenewPix({
        order_id: data?.order_id || '',
        qr_code: data?.qr_code || '',
        qr_code_base64: data?.qr_code_base64 || '',
        ticket_url: data?.ticket_url || '',
      })
      setRenewPixStatus(String(data?.status || '').toLowerCase())
      setMsg('Pix de renovação gerado.')
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível iniciar a renovação.'))
    } finally {
      setRenewBusy(false)
    }
  }

  async function startRenewCard() {
    if (!user || !isVip || !selectedPlan?.id) return
    try {
      setRenewBusy(true)
      setMsg('')
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ vip_plan_id: selectedPlan.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(data?.error || 'Não foi possível iniciar a renovação.')
      if (data?.url) {
        setUpgradePayOpen(false)
        window.location.href = data.url
        return
      }
    } catch (e) {
      setMsg(String(e?.message || 'Não foi possível iniciar a renovação.'))
    } finally {
      setRenewBusy(false)
    }
  }

  React.useEffect(() => {
    if (!renewPix?.order_id || !accessToken) return
    let stopped = false
    const t = setInterval(async () => {
      if (stopped) return
      const done = await verifyRenewPix(renewPix.order_id)
      if (done) {
        stopped = true
        clearInterval(t)
      }
    }, 5000)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [renewPix?.order_id, accessToken])

  const Heading = asPage ? 'h1' : 'h2'
  const body = (
    <div className={`vip-workspace ${asPage ? '' : 'vip-workspace-in-modal'}`}>
      <div
        className={`vip-content ${isVip && tab === 'escolhas' && hasCurrentCycleAccess && !isLevel3AutoMode ? 'has-selection-bar' : ''}`}
      >
        <header className="vip-heading">
          <div>
            <p className="customer-eyebrow">Seu clube de colecionáveis</p>
            <Heading>{isVip ? vipPlanLabel : 'Clube VIP'}</Heading>
          </div>
          <button
            type="button"
            onClick={asPage ? onGoHome : onClose}
            className="customer-icon-button"
            aria-label={asPage ? 'Voltar para a loja' : 'Fechar área VIP'}
          >
            <span className="material-icons" aria-hidden="true">
              {asPage ? 'arrow_back' : 'close'}
            </span>
          </button>
        </header>
        {user && isVip && (
          <div className="vip-membership">
            <span>
              <span className="material-icons" aria-hidden="true">
                calendar_month
              </span>
              Ciclo {activeCycleKey || cycle}
            </span>
            <span className={st.cls}>
              <span className="material-icons" aria-hidden="true">
                local_shipping
              </span>
              {st.label}
            </span>
            <span>
              <span className="material-icons" aria-hidden="true">
                verified
              </span>
              Ativo até {new Date(vipUntil).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}
        {msg && tab !== 'escolhas' && (
          <div className="vip-help" role="status">
            {msg}
          </div>
        )}
        {!user ? (
          authLoading ? (
            <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">
              Carregando…
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
              <p className="text-slate-200">Entre para acessar a Área VIP.</p>
              <button
                type="button"
                onClick={() =>
                  onRequireLogin?.('Entre para acessar a Área VIP.')
                }
                className="mt-4 rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
              >
                Entrar
              </button>
            </div>
          )
        ) : loading ? (
          <div className="mt-6 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">
            Carregando…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 p-4 text-rose-100">
            {error}
          </div>
        ) : !isVip ? (
          <div className="mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-500/12 via-slate-950 to-cyan-500/10 ring-1 ring-violet-300/20 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-violet-100 ring-1 ring-violet-300/20">
                  <span className="material-icons text-[16px]">
                    workspace_premium
                  </span>
                  Clube VIP
                </div>
                <h3 className="mt-4 text-2xl font-extrabold text-white">
                  Seu próximo passo é entrar para o VIP
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200/90">
                  Assine para escolher miniaturas mensais, acompanhar produção,
                  votar nos próximos temas e liberar seu presente d20 do mês em
                  um painel exclusivo.
                </p>
              </div>
              <div className="lg:w-[320px] rounded-3xl bg-black/25 p-4 ring-1 ring-white/10">
                <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-400">
                  O que desbloqueia
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    [
                      'deployed_code',
                      'Escolhas mensais',
                      'Selecione miniaturas e bosses do seu plano em um fluxo guiado.',
                    ],
                    [
                      'local_shipping',
                      'Pedido acompanhado',
                      'Veja status do ciclo, produção e rastreio em um só lugar.',
                    ],
                    [
                      'how_to_vote',
                      'Votação VIP',
                      'Ajude a definir o próximo tema do clube todo mês.',
                    ],
                    [
                      'redeem',
                      'Presente d20',
                      'Faça sua rolagem mensal e receba prêmios e cupons.',
                    ],
                  ].map(([icon, title, desc]) => (
                    <div
                      key={title}
                      className="rounded-2xl bg-white/4 px-3 py-3 ring-1 ring-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="material-icons text-cyan-200">
                          {icon}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-slate-100">
                            {title}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-400">
                            {desc}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={onGoVip}
                className="rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20 hover:bg-cyan-300"
              >
                Ver planos VIP
              </button>
              <div className="rounded-xl px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10 bg-white/4">
                Escolhas mensais, votação, presente e acompanhamento no mesmo
                painel.
              </div>
            </div>
          </div>
        ) : (
          <>
            <VipAreaTabs
              tabs={visibleTabs}
              activeTab={tab}
              onChange={(key) => {
                setTab(key)
                setHelpOpen(false)
              }}
            />
            <div
              role="tabpanel"
              id={`vip-panel-${tab}`}
              aria-labelledby={`vip-tab-${tab}`}
              tabIndex={0}
            >
              <div className="vip-section-heading">
                <div>
                  <h3>
                    {tab === 'escolhas'
                      ? 'Sua coleção do mês'
                      : tab === 'pedido'
                        ? 'Acompanhe seu pedido'
                        : tab === 'votacao'
                          ? 'Escolha o próximo tema'
                          : tab === 'upgrade'
                            ? 'Amplie sua coleção'
                            : 'Seu presente do mês'}
                  </h3>
                  <p>
                    {tab === 'escolhas'
                      ? isLevel3AutoMode
                        ? 'Todos os itens incluídos no seu plano.'
                        : editing
                          ? `Escolha ${miniLimit} miniaturas${bossLimit ? ` e ${bossLimit} bosses` : ''} para completar seu plano.`
                          : 'Sua seleção está salva. Consulte os detalhes ou revise enquanto estiver aberta.'
                      : tab === 'pedido'
                        ? 'Produção, envio e rastreio em um só lugar.'
                        : tab === 'votacao'
                          ? 'Seu voto ajuda a definir a próxima coleção.'
                          : tab === 'upgrade'
                            ? 'Compare os níveis disponíveis para sua assinatura.'
                            : 'Uma rolagem d20 por ciclo para descobrir sua recompensa.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="customer-icon-button"
                  onClick={() => setHelpOpen((value) => !value)}
                  aria-label="Como funciona esta aba"
                  aria-expanded={helpOpen}
                >
                  <span className="material-icons" aria-hidden="true">
                    help_outline
                  </span>
                </button>
              </div>
              {helpOpen && (
                <div className="vip-help">
                  <strong>{help.title}</strong>
                  <p>{help.body}</p>
                </div>
              )}
              {!editable && blockNotice && tab === 'escolhas' && (
                <div className="vip-help">
                  <strong>{blockNotice.title}</strong>
                  <p>{blockNotice.text}</p>
                </div>
              )}
              {/* Conteúdo por aba */}
              {tab === 'pedido' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Status do seu pedido VIP
                        </div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">
                          {st.label}
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          {editable
                            ? 'Você pode editar e salvar suas escolhas enquanto o status estiver em Editável.'
                            : 'Seu pedido já avançou para a próxima etapa do ciclo.'}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${st.cls}`}
                      >
                        <span className="material-icons text-[16px]">flag</span>
                        <b>{st.label}</b>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-950/45 to-violet-500/10 ring-1 ring-white/10 p-5">
                    <div className="hidden sm:flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Timeline do ciclo
                        </div>
                        <div className="mt-1 text-sm text-slate-200">
                          Veja em que etapa sua caixa VIP está agora.
                        </div>
                      </div>
                      <span className="rounded-full bg-white/4 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                        Ciclo {cycle}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {orderTimelineSteps.map((step) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl p-4 ring-1 transition ${
                            step.current
                              ? 'bg-cyan-400/12 ring-cyan-300/30'
                              : step.done
                                ? 'bg-emerald-500/10 ring-emerald-400/20'
                                : 'bg-black/20 ring-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-slate-100">
                                {step.title}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-400">
                                {step.desc}
                              </div>
                            </div>
                            <span
                              className={`material-icons text-[18px] ${
                                step.current
                                  ? 'text-cyan-200'
                                  : step.done
                                    ? 'text-emerald-200'
                                    : 'text-slate-500'
                              }`}
                            >
                              {step.current
                                ? 'radio_button_checked'
                                : step.done
                                  ? 'check_circle'
                                  : 'radio_button_unchecked'}
                            </span>
                          </div>
                          <div className="mt-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] ring-1 ${
                                step.current
                                  ? 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/30'
                                  : step.done
                                    ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-300/30'
                                    : 'bg-white/4 text-slate-400 ring-white/10'
                              }`}
                            >
                              {step.current
                                ? 'Etapa atual'
                                : step.done
                                  ? 'Concluída'
                                  : 'Aguardando'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {shippingTracking ? (
                    <div className="rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/20 p-5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-amber-100">
                          Código de rastreio
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                          {trackingCarrierLabel(shippingCarrier)}
                        </p>
                        <a
                          href={
                            shippingTrackingUrl ||
                            buildTrackingUrl({
                              code: shippingTracking,
                              carrier: shippingCarrier,
                            })
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg px-3 py-2 text-xs font-extrabold bg-cyan-400 text-black hover:bg-amber-200"
                        >
                          Rastrear
                        </a>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <code className="rounded-lg bg-black/30 px-3 py-3 text-xs text-cyan-50 ring-1 ring-amber-200/10 break-all">
                          {shippingTracking}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              String(shippingTracking || '')
                            )
                          }
                          className="rounded-xl px-4 py-3 text-xs font-extrabold ring-1 ring-cyan-300/20 hover:bg-white/4"
                        >
                          Copiar código
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-sm text-slate-300">
                      Quando seu pedido avançar para envio, o{' '}
                      <b>código de rastreio</b> vai aparecer aqui.
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'presente' ? (
                <div className="mt-5">
                  <React.Suspense
                    fallback={
                      <div className="vip-help" role="status">
                        Carregando seu presente…
                      </div>
                    }
                  >
                    <VipPresentD20
                      accessToken={accessToken}
                      user={user}
                      isVip={isVip}
                      cycleKey={cycle}
                    />
                  </React.Suspense>
                </div>
              ) : null}

              {tab === 'upgrade' && canShowUpgrade ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Upgrade de nível
                        </div>
                        <div className="mt-1 text-xl font-extrabold text-slate-100">
                          Mais escolhas por mês
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          Escolha para qual nível você quer subir neste ciclo.
                        </div>
                      </div>
                      <span className="material-icons text-violet-200">
                        upgrade
                      </span>
                    </div>

                    {upgradePlans.length ? (
                      <div className="mt-4 grid gap-3">
                        {upgradePlans.map((plan) => {
                          const priceCents =
                            typeof plan?.price_cents === 'number'
                              ? plan.price_cents
                              : typeof plan?.price_brl === 'number'
                                ? Math.round(plan.price_brl * 100)
                                : typeof plan?.price === 'number'
                                  ? Math.round(plan.price * 100)
                                  : 0
                          const diffCents = Math.max(
                            0,
                            Number(priceCents || 0) -
                              Number(currentPriceCents || 0)
                          )
                          const isSelected =
                            String(selectedUpgradePlanId) === String(plan?.id)
                          const planMini = Math.max(
                            0,
                            Number(
                              plan?.miniatures_count ??
                                plan?.items_per_month ??
                                0
                            ) || 0
                          )
                          const planBoss = Math.max(
                            0,
                            Number(plan?.boss_count ?? 0) || 0
                          )
                          return (
                            <button
                              key={plan?.id}
                              type="button"
                              onClick={() =>
                                setSelectedUpgradePlanId(String(plan?.id || ''))
                              }
                              className={`w-full rounded-2xl p-4 text-left ring-1 transition ${isSelected ? 'bg-violet-300/10 ring-violet-300/50' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.05]'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-base font-extrabold text-slate-100">
                                    {plan?.short_name || plan?.name}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-300">
                                    {planMini} miniatura(s)
                                    {planBoss ? ` + ${planBoss} boss` : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs uppercase tracking-wide text-slate-400">
                                    Diferença
                                  </div>
                                  <div className="text-base font-extrabold text-violet-100">
                                    {fmtBRLFromCents(diffCents)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}

                        <button
                          type="button"
                          disabled={!selectedUpgradePlan || upgradeBusy}
                          onClick={() => {
                            setUpgradePayOpen(true)
                          }}
                          className={`w-full rounded-xl px-4 py-3 font-extrabold ring-1 ring-white/10 ${!selectedUpgradePlan || upgradeBusy ? 'bg-slate-700/40 text-slate-300' : 'bg-violet-300 text-black hover:bg-violet-200'}`}
                        >
                          {selectedUpgradePlan
                            ? `Fazer upgrade para ${selectedUpgradePlan?.short_name || selectedUpgradePlan?.name}`
                            : 'Upgrade indisponível'}
                          {selectedUpgradePlan ? (
                            <span className="ml-2 text-xs font-semibold">
                              ({fmtBRLFromCents(upgradeDiffCents)})
                            </span>
                          ) : null}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-slate-400">
                        Você já está no nível máximo.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <Modal
                open={upgradePayOpen}
                onClose={() => setUpgradePayOpen(false)}
                title="Upgrade de nível"
                busy={upgradeBusy}
                maxWidth="max-w-md"
                zIndexClass="z-[220]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Upgrade de Nível
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-slate-100">
                      Escolha a forma de pagamento
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      Plano:{' '}
                      <b>
                        {selectedUpgradePlan?.short_name ||
                          selectedUpgradePlan?.name ||
                          'Upgrade'}
                      </b>
                      <br />
                      Valor: <b>{fmtBRLFromCents(upgradeDiffCents)}</b>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    disabled={upgradeBusy}
                    onClick={() => {
                      setUpgradePayMethod('card')
                      startUpgradeCard()
                    }}
                    className={`rounded-xl px-4 py-3 font-extrabold ring-4 transition ${upgradeBusy ? 'bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait' : 'bg-cyan-400 text-black ring-cyan-400/20 hover:opacity-95'}`}
                  >
                    {upgradeBusy && upgradePayMethod === 'card'
                      ? 'Aguarde…'
                      : 'Pagar com cartão'}
                  </button>
                  <button
                    disabled={upgradeBusy}
                    onClick={() => {
                      setUpgradePayMethod('pix')
                      startUpgradePix()
                    }}
                    className={`rounded-xl px-4 py-3 font-semibold ring-1 transition ${upgradeBusy ? 'bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait' : 'ring-white/15 hover:bg-white/4'}`}
                  >
                    {upgradeBusy && upgradePayMethod === 'pix'
                      ? 'Aguarde…'
                      : 'Pagar com Pix'}
                  </button>
                </div>
              </Modal>

              <Modal
                open={renewPayOpen}
                onClose={() => setRenewPayOpen(false)}
                title="Renovar assinatura"
                busy={renewBusy}
                maxWidth="max-w-md"
                zIndexClass="z-[220]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Renovação do ciclo
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-slate-100">
                      Liberar {activeCycleKey || cycle}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      Seu plano atual é <b>{vipPlanLabel}</b>. Renove para
                      receber as miniaturas do novo ciclo.
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    disabled={renewBusy}
                    onClick={() => {
                      setRenewPayMethod('card')
                      setRenewPayOpen(false)
                      startRenewCard()
                    }}
                    className={`rounded-xl px-4 py-3 font-extrabold ring-4 transition ${renewBusy ? 'bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait' : 'bg-cyan-400 text-black ring-cyan-400/20 hover:opacity-95'}`}
                  >
                    {renewBusy && renewPayMethod === 'card'
                      ? 'Aguarde…'
                      : 'Pagar com cartão'}
                  </button>
                  <button
                    disabled={renewBusy}
                    onClick={() => {
                      setRenewPayMethod('pix')
                      setRenewPayOpen(false)
                      startRenewPix()
                    }}
                    className={`rounded-xl px-4 py-3 font-semibold ring-1 transition ${renewBusy ? 'bg-cyan-400/20 text-cyan-50 ring-cyan-200/15 cursor-wait' : 'ring-white/15 hover:bg-white/4'}`}
                  >
                    {renewBusy && renewPayMethod === 'pix'
                      ? 'Aguarde…'
                      : 'Pagar com Pix'}
                  </button>
                </div>
              </Modal>

              {renewPix?.order_id ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-extrabold text-slate-100">
                        Pix da renovação
                      </div>
                      <div className="text-xs text-slate-400">
                        Status: <b>{renewPixStatus || 'pendente'}</b>
                      </div>
                    </div>
                    {renewPix?.ticket_url ? (
                      <a
                        className="text-sm font-semibold text-teal-200 hover:underline"
                        href={renewPix.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir no Mercado Pago
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-4 flex items-center justify-center">
                      {renewPix?.qr_code_base64 ? (
                        <img
                          alt="QR Code Pix"
                          className="w-56 h-56"
                          src={`data:image/png;base64,${renewPix.qr_code_base64}`}
                        />
                      ) : (
                        <div className="text-slate-300">
                          QR Code indisponível
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Copia e cola
                      </div>
                      <textarea
                        readOnly
                        value={renewPix?.qr_code || ''}
                        className="mt-2 w-full h-40 rounded-xl bg-black/30 ring-1 ring-white/10 p-3 text-xs text-slate-100"
                      />
                      <button
                        onClick={() => copyPixCode(renewPix?.qr_code)}
                        className="mt-3 w-full rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
                      >
                        Copiar código Pix
                      </button>
                      <button
                        type="button"
                        onClick={() => verifyRenewPix(renewPix?.order_id)}
                        disabled={renewChecking || !renewPix?.order_id}
                        className="mt-3 w-full rounded-xl px-4 py-3 font-semibold ring-1 ring-white/15 hover:bg-white/4 disabled:opacity-60"
                      >
                        {renewChecking ? 'Verificando…' : 'Já paguei'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showUpgrade && upgrade?.order_id ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-extrabold text-slate-100">
                        Pix do upgrade
                      </div>
                      <div className="text-xs text-slate-400">
                        Status: <b>{upgrade?.status || 'pendente'}</b>
                      </div>
                    </div>
                    {upgrade?.ticket_url ? (
                      <a
                        className="text-sm font-semibold text-teal-200 hover:underline"
                        href={upgrade.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir no Mercado Pago
                      </a>
                    ) : null}

                    {showUpgrade && upgradeSuccess ? (
                      <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-emerald-200/90">
                              Upgrade concluído
                            </div>
                            <div className="mt-1 text-xl font-extrabold text-emerald-100">
                              Você subiu de nível ✅
                            </div>
                            <div className="mt-2 text-sm text-slate-200/80">
                              Seu novo nível já está ativo. Pode continuar
                              escolhendo as miniaturas do seu plano.
                            </div>
                          </div>
                          <span className="material-icons text-emerald-200">
                            verified
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-4 flex items-center justify-center">
                      {upgrade?.qr_code_base64 ? (
                        <img
                          alt="QR Code Pix"
                          className="w-56 h-56"
                          src={`data:image/png;base64,${upgrade.qr_code_base64}`}
                        />
                      ) : (
                        <div className="text-slate-300">
                          QR Code indisponível
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Copia e cola
                      </div>
                      <textarea
                        readOnly
                        value={upgrade?.qr_code || ''}
                        className="mt-2 w-full h-40 rounded-xl bg-black/30 ring-1 ring-white/10 p-3 text-xs text-slate-100"
                      />
                      <button
                        onClick={() => copyPixCode(upgrade?.qr_code)}
                        className="mt-3 w-full rounded-xl px-4 py-3 font-extrabold bg-cyan-400 text-black ring-4 ring-cyan-400/20"
                      >
                        Copiar código Pix
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showPoll && pollLoading ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5 text-slate-200">
                  Carregando votação…
                </div>
              ) : null}

              {showPoll && poll?.id ? (
                <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Votação VIP
                      </div>
                      <div className="mt-1 text-xl font-extrabold text-slate-100">
                        Tema do próximo mês
                      </div>
                      <div className="text-sm text-slate-300 mt-1">
                        {poll?.title || `Votação ${poll?.month_key}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">
                        Ciclo: <b>{poll?.month_key}</b>
                      </div>
                      <div className="mt-1 text-xs">
                        {String(poll?.status || '').toLowerCase() ===
                        'closed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20 px-2 py-1">
                            <span className="material-icons text-[14px]">
                              verified
                            </span>
                            Votação encerrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20 px-2 py-1">
                            <span className="material-icons text-[14px]">
                              how_to_vote
                            </span>
                            Votação aberta
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {String(poll?.status || '').toLowerCase() === 'closed'
                    ? (() => {
                        const wId = poll?.winner_option_id
                        const w = (pollOptions || []).find(
                          (o) => String(o.id) === String(wId)
                        )
                        return (
                          <div className="mt-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-4">
                            <div className="text-xs uppercase tracking-wide text-emerald-200/90">
                              Resultado
                            </div>
                            <div className="mt-1 text-lg font-extrabold text-emerald-100">
                              {w?.title
                                ? `Vencedor: ${w.title}`
                                : 'Votação encerrada (vencedor não divulgado)'}
                            </div>
                            <div className="mt-1 text-sm text-slate-200/80">
                              Assim que o próximo ciclo abrir, você já vai ver
                              as opções atualizadas.
                            </div>
                          </div>
                        )
                      })()
                    : null}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(pollOptions || []).map((o) => {
                      const votes = Number(voteCounts[String(o.id)] || 0)
                      const totalVotes = Object.values(voteCounts || {}).reduce(
                        (a, b) => a + (Number(b) || 0),
                        0
                      )
                      const pct = totalVotes
                        ? Math.round((votes / totalVotes) * 100)
                        : 0
                      const active = String(myVote) === String(o.id)
                      return (
                        <button
                          key={o.id}
                          disabled={
                            voteBusy ||
                            String(poll?.status || '').toLowerCase() !== 'open'
                          }
                          onClick={() => vote(o.id)}
                          className={`text-left rounded-2xl ring-1 p-4 transition hover:-translate-y-0.5 ${active ? 'bg-violet-500/15 ring-violet-400/30' : 'bg-black/25 ring-white/10 hover:bg-white/4'}`}
                        >
                          {o.image_url ? (
                            <div className="mb-3 overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/10">
                              <img
                                src={o.image_url}
                                alt={o.title}
                                className="h-48 w-full object-contain bg-black/20"
                                loading="lazy"
                                onError={handleVipImageError}
                              />
                            </div>
                          ) : null}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-slate-100">
                                {o.title}
                              </div>
                              {o.description ? (
                                <div className="text-xs text-slate-300 mt-1 line-clamp-2">
                                  {o.description}
                                </div>
                              ) : null}
                            </div>
                            {active ? (
                              <span className="material-icons text-violet-200">
                                check_circle
                              </span>
                            ) : (
                              <span className="material-icons text-slate-400">
                                how_to_vote
                              </span>
                            )}
                          </div>
                          <div className="mt-3">
                            <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                              <div
                                className="h-full bg-violet-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              {pct}%
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {tab === 'escolhas' ? (
                <>
                  {!hasCurrentCycleAccess ? (
                    <div className="mt-6 rounded-2xl bg-amber-500/10 ring-1 ring-amber-400/25 p-5">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="max-w-2xl">
                          <div className="text-xs uppercase tracking-[0.24em] text-amber-200/80">
                            Novo ciclo disponível
                          </div>
                          <div className="mt-2 text-xl font-extrabold text-amber-50">
                            Renove a assinatura para receber as novas miniaturas
                          </div>
                          <p className="mt-3 text-sm leading-6 text-amber-50/85">
                            Sua assinatura continua ativa até{' '}
                            <b>
                              {vipUntil
                                ? new Date(vipUntil).toLocaleDateString('pt-BR')
                                : '—'}
                            </b>
                            , mas as escolhas do ciclo{' '}
                            <b>{activeCycleKey || cycle}</b> só são liberadas
                            após a renovação. Seu último ciclo vinculado é{' '}
                            <b>{vipCycleKey || '—'}</b>.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRenewPayOpen(true)}
                          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-extrabold text-black ring-4 ring-cyan-400/15 transition hover:bg-cyan-300"
                        >
                          Renovar
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {hasCurrentCycleAccess ? (
                    <>
                      {isLevel3AutoMode ? (
                        <div className="mt-6 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/25 p-5">
                          <div className="flex items-start gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/25 text-emerald-100">
                              <span className="material-icons text-[20px]">
                                workspace_premium
                              </span>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">
                                Level 3 ativo
                              </div>
                              <div className="mt-2 text-xl font-extrabold text-emerald-50">
                                Parabéns por assinar o plano Level 3
                              </div>
                              <p className="mt-3 text-sm leading-6 text-emerald-50/85">
                                {hasLevel3CustomSelection
                                  ? 'As miniaturas desta assinatura foram definidas pela equipe, incluindo itens de outras coleções.'
                                  : 'Você receberá todas as miniaturas dessa coleção.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {editing ? (
                        <div className="vip-help">
                          <p>
                            <strong>
                              {selectedCounts.total}/{totalLimit}
                            </strong>{' '}
                            peças escolhidas.{' '}
                            {progress.remaining
                              ? 'Faltam ' +
                                progress.remaining +
                                ' para completar o plano.'
                              : 'Seleção completa. Salve para confirmar.'}
                          </p>
                        </div>
                      ) : null}

                      {/* Miniaturas escolhidas (fixo no topo, como antes) */}
                      {selectedCards.length > 0 && (
                        <details
                          className="vip-current-selection mt-4 rounded-xl border border-white/10 p-3"
                          open={!editing}
                        >
                          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                            Sua seleção · {selectedCards.length} peça(s)
                          </summary>
                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {selectedCards.map(({ id, opt }) => (
                              <button
                                type="button"
                                key={id}
                                className="min-w-0 rounded-lg border border-white/10 p-2 text-left"
                                onClick={() => opt && openPreviewLite(opt)}
                                aria-label={
                                  'Ver imagens de ' +
                                  (opt?.title || 'miniatura')
                                }
                              >
                                {opt?.image_url && (
                                  <img
                                    src={opt.image_url}
                                    alt=""
                                    loading="lazy"
                                    className="aspect-square w-full object-contain"
                                    onError={handleVipImageError}
                                  />
                                )}
                                <p className="mt-2 line-clamp-2 text-[11px] text-slate-300">
                                  {opt?.title || 'Miniatura escolhida'}
                                </p>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Notificação de limite: aparece perto da ação e some em poucos segundos */}
                      {limitNotice
                        ? (() => {
                            const isMobileNotice =
                              typeof window !== 'undefined' &&
                              window.innerWidth < 640
                            const shouldCenterNotice =
                              isMobileNotice || Boolean(limitNotice?.center)
                            return (
                              <div
                                className={
                                  shouldCenterNotice
                                    ? 'fixed inset-x-4 top-1/2 z-[9999] pointer-events-none'
                                    : 'fixed z-[9999] pointer-events-none'
                                }
                                style={
                                  shouldCenterNotice
                                    ? undefined
                                    : {
                                        left: `${limitNotice.x || 0}px`,
                                        top: `${limitNotice.y || 0}px`,
                                      }
                                }
                              >
                                <div
                                  className={
                                    shouldCenterNotice
                                      ? 'mx-auto -translate-y-1/2 w-full max-w-[360px] rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-violet-400/25 px-4 py-3 shadow-xl backdrop-blur'
                                      : '-translate-x-1/2 -translate-y-[115%] w-[min(360px,calc(100vw-32px))] rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-violet-400/25 px-4 py-3 shadow-xl backdrop-blur'
                                  }
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="material-icons text-violet-200 text-[18px] mt-0.5">
                                      info
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-sm font-extrabold text-slate-100">
                                        {limitNotice.title}
                                      </p>
                                      <p className="mt-0.5 text-xs text-slate-200/85 leading-relaxed">
                                        {limitNotice.text}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })()
                        : null}

                      {optionsLoading && !options.length ? (
                        <div className="mt-4 rounded-2xl bg-white/4 ring-1 ring-white/10 p-4 text-slate-200">
                          Carregando catálogo VIP…
                        </div>
                      ) : null}

                      <div className="vip-choice-tools">
                        <label>
                          Buscar miniatura
                          <input
                            type="search"
                            value={optionSearch}
                            onChange={(event) =>
                              setOptionSearch(event.target.value)
                            }
                            placeholder="Nome da peça"
                          />
                        </label>
                        <label>
                          Tipo
                          <select
                            value={optionFilter}
                            onChange={(event) =>
                              setOptionFilter(event.target.value)
                            }
                          >
                            <option value="all">Todos</option>
                            <option value="miniature">Miniaturas</option>
                            <option value="boss">Bosses</option>
                          </select>
                        </label>
                      </div>
                      <div className="vip-choice-filter-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={showOnlySelected}
                            onChange={(event) =>
                              setShowOnlySelected(event.target.checked)
                            }
                          />
                          Só minhas escolhas
                        </label>
                        <span>{filteredOptions.length} peça(s)</span>
                      </div>
                      {optionsError && (
                        <div className="customer-alert" role="alert">
                          <p>{optionsError}</p>
                          <button
                            type="button"
                            className="customer-secondary"
                            onClick={() => loadOptionsLite()}
                          >
                            Atualizar miniaturas
                          </button>
                        </div>
                      )}
                      <div className="vip-choices-grid">
                        {!optionsLoading && !filteredOptions.length && (
                          <div className="vip-choices-empty">
                            <p>Nenhuma miniatura encontrada.</p>
                            <button
                              type="button"
                              className="customer-text-button"
                              onClick={() => {
                                setOptionSearch('')
                                setOptionFilter('all')
                                setShowOnlySelected(false)
                              }}
                            >
                              Limpar filtros
                            </button>
                          </div>
                        )}
                        {filteredOptions.map((opt) => {
                          const isSel = (
                            isLevel3AutoMode
                              ? level3EffectiveIds
                              : displaySelected
                          ).includes(opt.id)
                          const kind =
                            String(
                              opt?.item_type || 'miniature'
                            ).toLowerCase() === 'boss'
                              ? 'boss'
                              : 'miniature'
                          // IMPORTANTE: não desabilitar o botão quando o limite for atingido.
                          // Se desabilitar, o usuário não consegue clicar e ver a mensagem de upgrade.
                          const addBlocked =
                            !isLevel3AutoMode &&
                            editing &&
                            !isSel &&
                            !canAdd(opt.id)
                          return (
                            <div
                              key={opt.id}
                              className={`vip-choice-card rounded-2xl overflow-hidden ring-1 transition relative ${isSel ? 'bg-violet-500/15 ring-violet-300/40 shadow-[0_0_0_1px_rgba(167,139,250,0.25)]' : 'bg-white/4 ring-white/10'}`}
                            >
                              {isSel ? (
                                <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-violet-500/25 text-violet-50 ring-1 ring-violet-300/30 px-2 py-1 text-[10px] font-extrabold">
                                  <span className="material-icons text-[14px]">
                                    check
                                  </span>
                                  Selecionado
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openPreviewLite(opt)}
                                className="block w-full text-left"
                              >
                                <div className="aspect-square bg-[#07161d]/70 p-2">
                                  {opt.image_url ? (
                                    <img
                                      src={opt.image_url}
                                      alt={opt.title}
                                      className="h-full w-full object-contain rounded-xl ring-1 ring-white/10"
                                      loading="lazy"
                                      onError={handleVipImageError}
                                    />
                                  ) : (
                                    <div className="h-full w-full grid place-items-center text-slate-500 text-xs">
                                      Sem imagem
                                    </div>
                                  )}
                                </div>
                              </button>

                              <div className="vip-choice-info p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                                      {opt.title}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${kind === 'boss' ? 'bg-cyan-500/10 ring-amber-400/25 text-amber-100' : 'bg-emerald-500/10 ring-emerald-400/25 text-emerald-100'}`}
                                      >
                                        {kind === 'boss' ? 'Boss' : 'Miniatura'}
                                      </span>
                                    </div>
                                    {/* descrição/carrossel carregam no preview (sob demanda) */}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={saving || isLevel3AutoMode}
                                    onClick={(event) =>
                                      toggleOption(opt, event.currentTarget)
                                    }
                                    aria-pressed={isSel}
                                    className={`vip-choice-toggle shrink-0 rounded-lg p-1.5 ring-1 transition ${isSel ? 'bg-violet-500/25 ring-violet-300/30 text-violet-50' : 'bg-white/4 ring-white/10 text-slate-300'} ${saving || (!editing && !productionLocked) ? 'opacity-60 cursor-not-allowed' : productionLocked ? 'hover:bg-amber-500/10 hover:ring-amber-400/30' : addBlocked ? 'hover:bg-rose-500/10 hover:ring-rose-400/30' : 'hover:bg-white/6'}`}
                                    aria-label={
                                      isLevel3AutoMode
                                        ? `Incluído no plano: ${opt.title}`
                                        : `${isSel ? 'Remover' : 'Selecionar'} ${opt.title}`
                                    }
                                  >
                                    <span
                                      className="material-icons text-[18px]"
                                      aria-hidden="true"
                                    >
                                      {isLevel3AutoMode
                                        ? 'workspace_premium'
                                        : isSel
                                          ? 'check_circle'
                                          : 'add_circle'}
                                    </span>
                                    <span>
                                      {isLevel3AutoMode
                                        ? 'Incluído'
                                        : isSel
                                          ? 'Selecionada'
                                          : 'Selecionar'}
                                    </span>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openPreviewLite(opt)}
                                  className="mt-2 text-[11px] text-sky-300 hover:text-sky-200"
                                >
                                  Ver imagens
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <Modal
                        open={savedChoicesPromptOpen}
                        onClose={() => setSavedChoicesPromptOpen(false)}
                        title="Revisar suas escolhas"
                        maxWidth="max-w-sm"
                        zIndexClass="z-[230]"
                      >
                        <p className="text-sm leading-6 text-slate-300">
                          Suas escolhas já estão salvas. Você pode revisá-las
                          enquanto o pedido estiver aberto para edição.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSavedChoicesPromptOpen(false)}
                            className="customer-secondary"
                          >
                            Agora não
                          </button>
                          <button
                            type="button"
                            onClick={openEditingMode}
                            className="customer-primary"
                          >
                            Editar escolhas
                          </button>
                        </div>
                      </Modal>
                      <VipGalleryModal
                        item={preview}
                        onClose={() => {
                          previewRequestRef.current += 1
                          setPreview(null)
                        }}
                        onImageError={handleVipImageError}
                      />
                      {!isLevel3AutoMode && (
                        <VipSelectionBar
                          counts={selectedCounts}
                          miniLimit={miniLimit}
                          bossLimit={bossLimit}
                          totalLimit={totalLimit}
                          complete={progress.complete}
                          editable={editable}
                          editing={editing}
                          saving={saving}
                          onSave={saveSelection}
                          onEdit={openEditingMode}
                          message={msg}
                        />
                      )}
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (asPage) {
    return (
      <div className="container-cc px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {body}
      </div>
    )
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      ariaLabel="Área VIP"
      maxWidth="max-w-4xl"
      mobileLayout="fullscreen"
    >
      {body}
    </Modal>
  )
}
