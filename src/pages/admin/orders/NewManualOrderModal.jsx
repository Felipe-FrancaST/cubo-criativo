import React from 'react'
import { supabase } from '../../../lib/supabaseClient.js'
import { fetchAddressFromCep } from '../../../lib/cep.js'
import useDebouncedValue from '../../../lib/useDebouncedValue.js'
import useDialog from '../../../lib/useDialog.js'
import { fmtBRL, onlyDigits, copyToClipboard } from './adminOrdersUtils.js'
import {
  parseMoney,
  getManualProductPriceCents,
  validateManualCustomer,
  validateManualItems,
} from '../../../../shared/manualOrder.js'
function safeStorageFileName(name = 'modelo.glb') {
  const raw = String(name || 'modelo.glb').trim() || 'modelo.glb'
  const withoutPath = raw.split(/[\\/]/).pop() || 'modelo.glb'
  const normalized = withoutPath
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized.toLowerCase().endsWith('.glb')
    ? normalized
    : `${normalized || 'modelo'}.glb`
}
async function uploadOrder3dModel(file) {
  if (!file)
    return {
      url: '',
      name: '',
    }
  const fileName = safeStorageFileName(file.name || 'modelo.glb')
  if (!fileName.toLowerCase().endsWith('.glb'))
    throw new Error('Envie um arquivo no formato .glb.')
  const maxBytes = 100 * 1024 * 1024
  if (Number(file.size || 0) > maxBytes)
    throw new Error('O arquivo .glb deve ter no máximo 100 MB.')
  const path = `manual-orders/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`
  const { error: uploadError } = await supabase.storage
    .from('order-3d-models')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'model/gltf-binary',
    })
  if (uploadError)
    throw new Error(
      uploadError.message || 'Não foi possível enviar o arquivo 3D.'
    )
  const { data } = supabase.storage.from('order-3d-models').getPublicUrl(path)
  return {
    url: data?.publicUrl || '',
    name: file.name || fileName,
  }
}
function formatCpfInput(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
function formatPhoneInput(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
function formatCepInput(value) {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
export default function NewManualOrderModal({
  open,
  accessToken,
  canManageBusiness = true,
  onClose,
  onCreated,
  showToast,
}) {
  const emptyForm = React.useMemo(
    () => ({
      name: '',
      cpf: '',
      email: '',
      phone: '',
      address_line1: '',
      address_number: '',
      address_line2: '',
      neighborhood: '',
      city: '',
      state: '',
      zip: '',
    }),
    []
  )
  const [loadingProducts, setLoadingProducts] = React.useState(false)
  const [products, setProducts] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [result, setResult] = React.useState(null)
  const [form, setForm] = React.useState(emptyForm)
  const [items, setItems] = React.useState([])
  const [step, setStep] = React.useState(0)
  const [fieldErrors, setFieldErrors] = React.useState({})
  const [paymentAction, setPaymentAction] = React.useState('payment_link')
  const [productSearch, setProductSearch] = React.useState('')
  const submitLock = React.useRef(false)
  const uploadedModelRef = React.useRef(null)
  const panelRef = useDialog(open, onClose, {
    busy,
  })
  const [customerMode, setCustomerMode] = React.useState('new')
  const [selectedClientId, setSelectedClientId] = React.useState('')
  const [clientSearch, setClientSearch] = React.useState('')
  const debouncedClientSearch = useDebouncedValue(clientSearch)
  const [availableClients, setAvailableClients] = React.useState([])
  const [loadingClients, setLoadingClients] = React.useState(false)
  const [clientsError, setClientsError] = React.useState('')
  const [cepLoading, setCepLoading] = React.useState(false)
  const [cepError, setCepError] = React.useState('')
  const [model3dFile, setModel3dFile] = React.useState(null)
  const [model3dError, setModel3dError] = React.useState('')
  const [vipPlans, setVipPlans] = React.useState([])
  const [vipOptions, setVipOptions] = React.useState([])
  const [vipCycleKey, setVipCycleKey] = React.useState('')
  const [vipPastCycleKey, setVipPastCycleKey] = React.useState('')
  const [loadingVipData, setLoadingVipData] = React.useState(false)
  const [vipDataError, setVipDataError] = React.useState('')
  React.useEffect(() => {
    if (!open) return
    setError('')
    setResult(null)
    setStep(0)
    setFieldErrors({})
    setPaymentAction('payment_link')
    setProductSearch('')
    uploadedModelRef.current = null
    setCustomerMode('new')
    setSelectedClientId('')
    setClientSearch('')
    setAvailableClients([])
    setClientsError('')
    setCepLoading(false)
    setCepError('')
    setModel3dFile(null)
    setModel3dError('')
    setVipDataError('')
    setVipPastCycleKey('')
    setForm(emptyForm)
    setItems([])
  }, [open, emptyForm])
  React.useEffect(() => {
    if (!open || !accessToken) return
    let active = true
    setLoadingProducts(true)
    fetch('/api/admin?action=manual-order-products', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((r) =>
        r
          .json()
          .catch(() => ({}))
          .then((json) => ({
            ok: r.ok,
            json,
          }))
      )
      .then(({ ok, json }) => {
        if (!active) return
        if (!ok)
          throw new Error(
            json?.error || 'Não foi possível carregar os produtos.'
          )
        setProducts(Array.isArray(json?.products) ? json.products : [])
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Erro ao carregar produtos.')
      })
      .finally(() => active && setLoadingProducts(false))
    return () => {
      active = false
    }
  }, [open, accessToken])
  React.useEffect(() => {
    if (!open || !accessToken) return
    let active = true
    if (!canManageBusiness) return
    setLoadingVipData(true)
    setVipDataError('')
    Promise.all([
      fetch('/api/vip-plans').then((r) =>
        r
          .json()
          .catch(() => ({}))
          .then((json) => ({
            ok: r.ok,
            json,
          }))
      ),
      fetch('/api/admin?action=vip-control', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).then((r) =>
        r
          .json()
          .catch(() => ({}))
          .then((json) => ({
            ok: r.ok,
            json,
          }))
      ),
    ])
      .then(([plansResp, cycleResp]) => {
        if (!active) return
        if (!plansResp.ok)
          throw new Error(
            plansResp.json?.error || 'Não foi possível carregar os planos VIP.'
          )
        if (!cycleResp.ok)
          throw new Error(
            cycleResp.json?.error ||
              'Não foi possível carregar as miniaturas VIP.'
          )
        const activeCycleKey = String(
          cycleResp.json?.active_cycle_key || ''
        ).trim()
        const library = (
          Array.isArray(cycleResp.json?.library) ? cycleResp.json.library : []
        ).filter((option) => String(option?.cycle_key || '').trim())
        const pastCycles = Array.from(
          new Set(
            library
              .map((option) => String(option?.cycle_key || '').trim())
              .filter(
                (cycleKey) =>
                  cycleKey &&
                  cycleKey !== activeCycleKey &&
                  (!activeCycleKey || cycleKey < activeCycleKey)
              )
          )
        ).sort((a, b) => b.localeCompare(a))
        setVipPlans(
          Array.isArray(plansResp.json?.plans) ? plansResp.json.plans : []
        )
        setVipOptions(library)
        setVipCycleKey(activeCycleKey)
        setVipPastCycleKey((current) =>
          pastCycles.includes(current) ? current : pastCycles[0] || ''
        )
      })
      .catch((e) => {
        if (!active) return
        setVipPlans([])
        setVipOptions([])
        setVipDataError(
          e?.message || 'Erro ao carregar dados da assinatura VIP.'
        )
      })
      .finally(() => active && setLoadingVipData(false))
    return () => {
      active = false
    }
  }, [open, accessToken, canManageBusiness])
  React.useEffect(() => {
    if (!open || !accessToken || customerMode !== 'existing') return
    let active = true
    setLoadingClients(true)
    setClientsError('')
    const params = new URLSearchParams({
      action: 'clients',
      q: String(debouncedClientSearch || ''),
    })
    fetch(`/api/admin?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((r) =>
        r
          .json()
          .catch(() => ({}))
          .then((json) => ({
            ok: r.ok,
            json,
          }))
      )
      .then(({ ok, json }) => {
        if (!active) return
        if (!ok)
          throw new Error(
            json?.error || 'Não foi possível carregar os clientes.'
          )
        setAvailableClients(Array.isArray(json?.clients) ? json.clients : [])
      })
      .catch((e) => {
        if (!active) return
        setAvailableClients([])
        setClientsError(e?.message || 'Erro ao carregar clientes.')
      })
      .finally(() => active && setLoadingClients(false))
    return () => {
      active = false
    }
  }, [open, accessToken, customerMode, debouncedClientSearch])
  const selectedClient = React.useMemo(
    () =>
      availableClients.find(
        (client) => String(client.id) === String(selectedClientId || '')
      ) || null,
    [availableClients, selectedClientId]
  )
  React.useEffect(() => {
    if (customerMode !== 'existing') return
    if (!selectedClient) return
    setForm({
      name: String(selectedClient.full_name || '').trim(),
      cpf: formatCpfInput(selectedClient.cpf || ''),
      email: String(selectedClient.email || '').trim(),
      phone: formatPhoneInput(selectedClient.phone || ''),
      address_line1: String(selectedClient.address_line1 || '').trim(),
      address_number: String(selectedClient.address_number || '').trim(),
      address_line2: String(selectedClient.address_line2 || '').trim(),
      neighborhood: String(selectedClient.neighborhood || '').trim(),
      city: String(selectedClient.city || '').trim(),
      state: String(selectedClient.state || '').trim(),
      zip: formatCepInput(selectedClient.zip || ''),
    })
  }, [customerMode, selectedClient])
  React.useEffect(() => {
    if (!open || customerMode === 'existing') return
    const cepDigits = onlyDigits(form.zip)
    if (cepDigits.length !== 8) {
      setCepError('')
      return
    }
    let active = true
    setCepLoading(true)
    setCepError('')
    fetchAddressFromCep(cepDigits)
      .then((resp) => {
        if (!active) return
        if (!resp?.ok) {
          setCepError(resp?.error || 'CEP não encontrado.')
          return
        }
        setForm((prev) => ({
          ...prev,
          address_line1: resp.data.street || prev.address_line1,
          neighborhood: resp.data.neighborhood || prev.neighborhood,
          city: resp.data.city || prev.city,
          state: resp.data.uf || prev.state,
        }))
      })
      .catch(() => active && setCepError('Erro ao consultar CEP.'))
      .finally(() => active && setCepLoading(false))
    return () => {
      active = false
    }
  }, [open, customerMode, form.zip])
  function updateForm(key, value) {
    let nextValue = value
    if (key === 'cpf') nextValue = formatCpfInput(value)
    if (key === 'phone') nextValue = formatPhoneInput(value)
    if (key === 'zip') nextValue = formatCepInput(value)
    if (key === 'state')
      nextValue = String(value || '')
        .toUpperCase()
        .slice(0, 2)
    setForm((p) => ({
      ...p,
      [key]: nextValue,
    }))
    setFieldErrors((current) => ({
      ...current,
      [key]: '',
    }))
  }
  function isLevel3VipPlan(plan) {
    const raw = [plan?.id, plan?.slug, plan?.short_name, plan?.name]
      .map((value) => String(value || '').toLowerCase())
      .join(' | ')
    return (
      raw.includes('cubo_l3') ||
      raw.includes('level-3') ||
      raw.includes('level 3') ||
      raw.includes('nível 3') ||
      raw.includes('nivel 3')
    )
  }
  function getVipPlanLimits(plan) {
    const miniatures = Math.max(
      0,
      Number(plan?.miniatures_count ?? plan?.items_per_month ?? 0) || 0
    )
    const bosses = Math.max(0, Number(plan?.boss_count ?? 0) || 0)
    const totalItems = Math.max(
      0,
      Number(plan?.items_per_month ?? miniatures + bosses) ||
        miniatures + bosses
    )
    return {
      miniatures,
      bosses,
      total: totalItems,
    }
  }
  function getVipSelectedCounts(item) {
    const selectedIds = Array.isArray(item?.selected_option_ids)
      ? item.selected_option_ids.map(String)
      : []
    return selectedIds.reduce(
      (acc, optionId) => {
        const option = vipOptions.find(
          (row) => String(row.id) === String(optionId)
        )
        if (String(option?.item_type || 'miniature').toLowerCase() === 'boss')
          acc.bosses += 1
        else acc.miniatures += 1
        acc.total += 1
        return acc
      },
      {
        miniatures: 0,
        bosses: 0,
        total: 0,
      }
    )
  }
  function getActiveVipOptions() {
    return vipOptions.filter(
      (option) =>
        String(option?.cycle_key || '').trim() ===
          String(vipCycleKey || '').trim() && option?.active !== false
    )
  }
  function getDefaultVipSelection(plan) {
    if (!isLevel3VipPlan(plan)) return []
    const limits = getVipPlanLimits(plan)
    const activeOptions = getActiveVipOptions()
    const miniatures = activeOptions
      .filter(
        (option) =>
          String(option?.item_type || 'miniature').toLowerCase() !== 'boss'
      )
      .slice(0, limits.miniatures)
    const bosses = activeOptions
      .filter(
        (option) =>
          String(option?.item_type || 'miniature').toLowerCase() === 'boss'
      )
      .slice(0, limits.bosses)
    return [...miniatures, ...bosses].map((option) => option.id)
  }
  function formatVipCycleLabel(cycleKey) {
    const raw = String(cycleKey || '').trim()
    const match = raw.match(/^(\d{4})-(\d{2})$/)
    if (!match) return raw || 'Sem ciclo'
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
    const label = date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  function ensureRegularOrderMode() {
    if (items.some((item) => item.mode === 'vip')) {
      setError(
        'A assinatura VIP deve ficar em um pedido separado. Remova a assinatura para adicionar outros itens.'
      )
      return false
    }
    setError('')
    return true
  }
  function addRegisteredProduct() {
    if (!ensureRegularOrderMode()) return
    setItems((p) => [
      ...p,
      {
        id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
        mode: 'product',
        product_id: '',
        qty: 1,
        scale: '',
      },
    ])
  }
  function addCustomItem() {
    if (!ensureRegularOrderMode()) return
    setItems((p) => [
      ...p,
      {
        id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
        mode: 'custom',
        name: '',
        price: '',
        scale: '',
        qty: 1,
        notes: '',
      },
    ])
  }
  function addFreightItem() {
    if (!ensureRegularOrderMode()) return
    setItems((p) => [
      ...p,
      {
        id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
        mode: 'freight',
        carrier: '',
        price: '',
        qty: 1,
        notes: '',
      },
    ])
  }
  function addVipItem() {
    if (items.length) {
      setError(
        'A assinatura VIP deve ser criada em um pedido separado. Remova os outros itens antes de continuar.'
      )
      return
    }
    const plan = vipPlans[0] || null
    if (!plan) {
      setError(vipDataError || 'Nenhum plano VIP ativo foi encontrado.')
      return
    }
    const selectedIds = getDefaultVipSelection(plan)
    setError('')
    setItems([
      {
        id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
        mode: 'vip',
        vip_plan_id: plan.id,
        selected_option_ids: selectedIds,
        cycle_key: vipCycleKey,
      },
    ])
  }
  function changeVipPlan(itemId, planId) {
    const plan = vipPlans.find((row) => String(row.id) === String(planId))
    const selectedIds = getDefaultVipSelection(plan)
    updateItem(itemId, {
      vip_plan_id: planId,
      selected_option_ids: selectedIds,
      cycle_key: vipCycleKey,
    })
    setError('')
  }
  function toggleVipOption(item, optionId) {
    const selectedIds = Array.isArray(item?.selected_option_ids)
      ? item.selected_option_ids.map(String)
      : []
    const optionKey = String(optionId)
    if (selectedIds.includes(optionKey)) {
      updateItem(item.id, {
        selected_option_ids: selectedIds.filter((id) => id !== optionKey),
      })
      setError('')
      return
    }
    const plan = vipPlans.find(
      (row) => String(row.id) === String(item.vip_plan_id)
    )
    const limits = getVipPlanLimits(plan)
    const counts = getVipSelectedCounts(item)
    const option = vipOptions.find((row) => String(row.id) === optionKey)
    const isBoss =
      String(option?.item_type || 'miniature').toLowerCase() === 'boss'
    if (
      counts.total >= limits.total ||
      (isBoss
        ? counts.bosses >= limits.bosses
        : counts.miniatures >= limits.miniatures)
    ) {
      setError(
        `O limite deste plano é ${limits.miniatures} miniatura(s)${limits.bosses ? ` e ${limits.bosses} boss(es)` : ''}.`
      )
      return
    }
    updateItem(item.id, {
      selected_option_ids: [...selectedIds, optionKey],
    })
    setError('')
  }
  function updateItem(id, patch) {
    setItems((p) =>
      p.map((it) =>
        it.id === id
          ? {
              ...it,
              ...patch,
            }
          : it
      )
    )
  }
  function removeItem(id) {
    setItems((p) => p.filter((it) => it.id !== id))
  }
  const hasVipItem = items.some((item) => item.mode === 'vip')
  const reviewItems = React.useMemo(
    () =>
      items.map((item) => {
        const product = products.find(
          (row) => String(row.id) === String(item.product_id)
        )
        const plan = vipPlans.find(
          (row) => String(row.id) === String(item.vip_plan_id)
        )
        const priceCents =
          item.mode === 'product'
            ? getManualProductPriceCents(product, item.scale)
            : item.mode === 'vip'
              ? Math.round(Number(plan?.price_brl ?? plan?.price ?? 0) * 100)
              : Math.round((parseMoney(item.price) || 0) * 100)
        return {
          ...item,
          label:
            item.mode === 'product'
              ? product?.name || 'Selecione um produto'
              : item.mode === 'vip'
                ? `Assinatura VIP — ${plan?.name || plan?.id || ''}`
                : item.mode === 'freight'
                  ? `Frete — ${item.carrier || 'Transportadora'}`
                  : item.name || 'Item personalizado',
          priceCents,
          quantity:
            item.mode === 'vip' || item.mode === 'freight'
              ? 1
              : Number(item.qty || 0),
        }
      }),
    [items, products, vipPlans]
  )
  const total =
    reviewItems.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0
    ) / 100
  const visibleProducts = products.filter((product) =>
    [product.name, product.category]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(productSearch.toLocaleLowerCase('pt-BR'))
  )
  function validateStep(target) {
    if (target === 0) {
      const errors = validateManualCustomer(
        form,
        customerMode,
        selectedClientId
      )
      setFieldErrors(errors)
      const message = Object.values(errors)[0]
      if (message) {
        setError(message)
        return false
      }
    } else {
      const message = validateManualItems(items)
      if (message) {
        setError(message)
        return false
      }
      if (
        reviewItems.some(
          (item) => !Number.isFinite(item.priceCents) || item.priceCents <= 0
        )
      ) {
        setError('Verifique o preço dos itens selecionados.')
        return false
      }
      const vipItem = items.find((item) => item.mode === 'vip')
      if (vipItem) {
        const plan = vipPlans.find(
          (row) => String(row.id) === String(vipItem.vip_plan_id)
        )
        const counts = getVipSelectedCounts(vipItem)
        const limits = getVipPlanLimits(plan)
        if (
          counts.total !== limits.total ||
          counts.miniatures !== limits.miniatures ||
          counts.bosses !== limits.bosses
        ) {
          setError(
            `Selecione ${limits.miniatures} miniatura(s) e ${limits.bosses} boss(es) para este plano.`
          )
          return false
        }
      }
    }
    setError('')
    return true
  }
  function goNext() {
    if (!validateStep(step)) {
      queueMicrotask(() =>
        panelRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      )
      return
    }
    setStep((current) => Math.min(2, current + 1))
  }
  function handleModel3dChange(file) {
    setModel3dError('')
    uploadedModelRef.current = null
    if (!file) {
      setModel3dFile(null)
      return
    }
    const name = String(file.name || '').toLowerCase()
    if (!name.endsWith('.glb')) {
      setModel3dFile(null)
      setModel3dError('Selecione apenas arquivos .glb.')
      return
    }
    const maxBytes = 100 * 1024 * 1024
    if (Number(file.size || 0) > maxBytes) {
      setModel3dFile(null)
      setModel3dError('O arquivo .glb deve ter no máximo 100 MB.')
      return
    }
    setModel3dFile(file)
  }
  async function handleSubmit(paymentAction = 'payment_link') {
    if (submitLock.current || result) return
    if (!validateStep(0)) {
      setStep(0)
      return
    }
    if (!validateStep(1)) {
      setStep(1)
      return
    }
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      const vipItem = items.find((item) => item.mode === 'vip')
      if (vipItem) {
        const plan = vipPlans.find(
          (row) => String(row.id) === String(vipItem.vip_plan_id)
        )
        if (!plan) throw new Error('Selecione um plano VIP válido.')
        const counts = getVipSelectedCounts(vipItem)
        const limits = getVipPlanLimits(plan)
        if (
          counts.total !== limits.total ||
          counts.miniatures !== limits.miniatures ||
          counts.bosses !== limits.bosses
        ) {
          throw new Error(
            `Selecione exatamente ${limits.miniatures} miniatura(s)${limits.bosses ? ` e ${limits.bosses} boss(es)` : ''} para este plano.`
          )
        }
      }
      let uploadedModel = uploadedModelRef.current || {
        url: '',
        name: '',
      }
      if (model3dFile && !uploadedModelRef.current) {
        uploadedModel = await uploadOrder3dModel(model3dFile)
        uploadedModelRef.current = uploadedModel
        if (!uploadedModel.url)
          throw new Error(
            'O upload do modelo 3D terminou sem gerar uma URL pública.'
          )
      }
      const payload = {
        customer: {
          ...form,
          existing_user_id: customerMode === 'existing' ? selectedClientId : '',
          account_mode: customerMode,
        },
        existing_user_id: customerMode === 'existing' ? selectedClientId : '',
        account_mode: customerMode,
        payment_action: paymentAction,
        model_3d_url: uploadedModel.url,
        model_3d_name: uploadedModel.name,
        items: items.map((it) => {
          if (it.mode === 'product')
            return {
              mode: 'product',
              product_id: it.product_id,
              qty: Number(it.qty || 1),
              scale: it.scale || '',
            }
          if (it.mode === 'freight')
            return {
              mode: 'freight',
              carrier: it.carrier || '',
              price: parseMoney(it.price),
              qty: 1,
              notes: it.notes || '',
            }
          if (it.mode === 'vip')
            return {
              mode: 'vip',
              vip_plan_id: it.vip_plan_id,
              selected_option_ids: Array.isArray(it.selected_option_ids)
                ? it.selected_option_ids
                : [],
              cycle_key: it.cycle_key || vipCycleKey,
            }
          return {
            mode: 'custom',
            name: it.name,
            price: parseMoney(it.price),
            scale: it.scale || '',
            qty: Number(it.qty || 1),
            notes: it.notes || '',
          }
        }),
      }
      const resp = await fetch('/api/admin?action=manual-order-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(json?.error || 'Não foi possível criar o pedido.')
      setResult(json)
      setStep(2)
      const createdVip =
        String(json?.order?.order_type || '').toLowerCase() === 'vip'
      showToast?.(
        json?.email?.ok
          ? paymentAction === 'mark_paid'
            ? createdVip
              ? 'Assinatura VIP ativada e boas-vindas enviadas.'
              : 'Pedido pago lançado e confirmação enviada por e-mail.'
            : createdVip
              ? 'Assinatura VIP criada e link enviado por e-mail.'
              : 'Pedido criado e link enviado por e-mail.'
          : paymentAction === 'mark_paid'
            ? createdVip
              ? 'Assinatura VIP ativada com sucesso.'
              : 'Pedido lançado como pago com sucesso.'
            : createdVip
              ? 'Assinatura VIP criada com sucesso.'
              : 'Pedido criado com sucesso.'
      )
      onCreated?.()
    } catch (e) {
      setError(e?.message || 'Erro ao criar pedido.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }
  if (!open) return null
  return (
    <div className="admin-workspace fixed inset-0 z-[10000]">
      <div
        className="absolute inset-0 bg-[#020b10]/80"
        onClick={busy ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-order-title"
        tabIndex={-1}
        className="manual-order-dialog"
      >
        <div className="manual-order-header flex items-start justify-between gap-3">
          <div>
            <div className="admin-eyebrow">CENTRAL DE PEDIDOS</div>
            <h2
              id="new-order-title"
              className="text-xl font-semibold text-white"
            >
              Novo pedido
            </h2>
            <div className="text-sm text-slate-400">
              Preencha os dados, confira os itens e escolha como registrar o
              pagamento.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar novo pedido"
            className="rounded-xl px-3 py-2 text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
          >
            Fechar
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mx-4 my-3 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </div>
        ) : null}

        {!result && (
          <nav aria-label="Etapas do pedido" className="order-stepper">
            {[
              'Cliente e entrega',
              'Itens do pedido',
              'Revisão e pagamento',
            ].map((label, index) => (
              <button
                key={label}
                type="button"
                aria-current={step === index ? 'step' : undefined}
                disabled={index > step || busy}
                onClick={() => {
                  setError('')
                  setStep(index)
                }}
                className={`order-step ${step === index ? 'is-active' : ''} ${index < step ? 'is-complete' : ''}`}
              >
                <span className="order-step-number">
                  {index < step ? '✓' : index + 1}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="manual-order-scroll">
          {result ? (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
              <div className="rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-5">
                <div className="text-emerald-100 text-xl font-extrabold">
                  {result?.payment_link
                    ? 'Pedido criado'
                    : 'Pedido lançado como pago'}
                </div>
                <div className="mt-2 text-sm text-emerald-50/90">
                  {result?.payment_link
                    ? result?.email?.ok
                      ? 'O link de pagamento foi enviado automaticamente para o e-mail do cliente. Você também pode copiá-lo abaixo.'
                      : 'Compartilhe o link abaixo com o cliente para ele pagar com Pix ou cartão.'
                    : result?.email?.ok
                      ? 'O pedido entrou no sistema como pago e a confirmação foi enviada para o cliente.'
                      : 'O pedido já entrou no sistema como pago e pronto para seguir no fluxo de produção.'}
                </div>
                {result?.payment_link ? (
                  <>
                    <div className="mt-4 rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 break-all text-sm text-slate-100">
                      {result?.payment_link}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={async () =>
                          showToast?.(
                            (await copyToClipboard(result?.payment_link || ''))
                              ? 'Link copiado.'
                              : 'Não foi possível copiar. Selecione o link e copie manualmente.'
                          )
                        }
                        className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                      >
                        Copiar link
                      </button>
                      <a
                        href={result?.payment_link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                      >
                        Abrir página
                      </a>
                    </div>
                  </>
                ) : null}
                <div className="mt-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-200">
                  <div>
                    <b>
                      {result?.account?.existing
                        ? 'Conta vinculada:'
                        : 'Conta criada:'}
                    </b>{' '}
                    {result?.account?.email}
                  </div>
                  {!result?.account?.existing ? (
                    <div className="mt-1">
                      <b>Senha inicial:</b> CPF do cliente
                    </div>
                  ) : (
                    <div className="mt-1">
                      Pedido associado a um cliente já cadastrado no site.
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 min-w-[240px]">
                <div className="text-sm text-slate-400">Pedido</div>
                <div className="mt-2 text-white font-bold">
                  #{result?.order?.order_number}
                </div>
                <div className="mt-1 text-slate-300">
                  {fmtBRL(result?.order?.total || 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div hidden={step !== 0} className="space-y-4">
                <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('new')
                        setSelectedClientId('')
                        setForm(emptyForm)
                      }}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 transition ${customerMode === 'new' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/40' : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]'}`}
                    >
                      Novo cliente
                    </button>
                    {canManageBusiness && (
                      <button
                        type="button"
                        onClick={() => setCustomerMode('existing')}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 transition ${customerMode === 'existing' ? 'bg-cyan-400 text-[#031116] ring-cyan-300/40' : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.06]'}`}
                      >
                        Cliente já cadastrado
                      </button>
                    )}
                  </div>

                  {customerMode === 'existing' ? (
                    <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 space-y-3">
                      <label className="block text-sm text-slate-300">
                        Buscar cliente
                        <input
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder="Digite nome, e-mail, CPF ou telefone"
                          className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Selecionar cliente
                        <select
                          value={selectedClientId}
                          onChange={(e) => setSelectedClientId(e.target.value)}
                          className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                          disabled={loadingClients || !availableClients.length}
                        >
                          <option value="">
                            {loadingClients
                              ? 'Carregando clientes...'
                              : 'Selecione um cliente cadastrado'}
                          </option>
                          {availableClients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.full_name || client.email || client.id}
                              {client.email ? ` • ${client.email}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      {clientsError ? (
                        <div className="text-sm text-red-200">
                          {clientsError}
                        </div>
                      ) : null}
                      {selectedClient ? (
                        <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3 text-sm text-slate-300">
                          <div className="font-semibold text-slate-100">
                            {selectedClient.full_name || 'Cliente selecionado'}
                          </div>
                          <div>
                            {selectedClient.email || 'Sem e-mail cadastrado'}
                          </div>
                          <div>
                            {selectedClient.phone || 'Sem telefone cadastrado'}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm text-slate-300">
                      Nome
                      <input
                        type="text"
                        name="name"
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={
                          fieldErrors.name ? 'error-name' : undefined
                        }
                        value={form.name}
                        onChange={(e) => updateForm('name', e.target.value)}
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.name && (
                        <span
                          id="error-name"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.name}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      CPF
                      <input
                        type="tel"
                        name="cpf"
                        aria-invalid={!!fieldErrors.cpf}
                        aria-describedby={
                          fieldErrors.cpf ? 'error-cpf' : undefined
                        }
                        value={form.cpf}
                        onChange={(e) => updateForm('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.cpf && (
                        <span
                          id="error-cpf"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.cpf}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      E-mail
                      <input
                        type="email"
                        name="email"
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={
                          fieldErrors.email ? 'error-email' : undefined
                        }
                        value={form.email}
                        onChange={(e) => updateForm('email', e.target.value)}
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.email && (
                        <span
                          id="error-email"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.email}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Telefone
                      <input
                        type="tel"
                        name="phone"
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={
                          fieldErrors.phone ? 'error-phone' : undefined
                        }
                        value={form.phone}
                        onChange={(e) => updateForm('phone', e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.phone && (
                        <span
                          id="error-phone"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.phone}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300 sm:col-span-2">
                      Rua
                      <input
                        type="text"
                        name="address_line1"
                        aria-invalid={!!fieldErrors.address_line1}
                        aria-describedby={
                          fieldErrors.address_line1
                            ? 'error-address_line1'
                            : undefined
                        }
                        value={form.address_line1}
                        onChange={(e) =>
                          updateForm('address_line1', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.address_line1 && (
                        <span
                          id="error-address_line1"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.address_line1}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Número
                      <input
                        type="text"
                        name="address_number"
                        aria-invalid={!!fieldErrors.address_number}
                        aria-describedby={
                          fieldErrors.address_number
                            ? 'error-address_number'
                            : undefined
                        }
                        value={form.address_number}
                        onChange={(e) =>
                          updateForm('address_number', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.address_number && (
                        <span
                          id="error-address_number"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.address_number}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Complemento
                      <input
                        type="text"
                        name="address_line2"
                        aria-invalid={!!fieldErrors.address_line2}
                        aria-describedby={
                          fieldErrors.address_line2
                            ? 'error-address_line2'
                            : undefined
                        }
                        value={form.address_line2}
                        onChange={(e) =>
                          updateForm('address_line2', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.address_line2 && (
                        <span
                          id="error-address_line2"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.address_line2}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Bairro
                      <input
                        type="text"
                        name="neighborhood"
                        aria-invalid={!!fieldErrors.neighborhood}
                        aria-describedby={
                          fieldErrors.neighborhood
                            ? 'error-neighborhood'
                            : undefined
                        }
                        value={form.neighborhood}
                        onChange={(e) =>
                          updateForm('neighborhood', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.neighborhood && (
                        <span
                          id="error-neighborhood"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.neighborhood}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Cidade
                      <input
                        type="text"
                        name="city"
                        aria-invalid={!!fieldErrors.city}
                        aria-describedby={
                          fieldErrors.city ? 'error-city' : undefined
                        }
                        value={form.city}
                        onChange={(e) => updateForm('city', e.target.value)}
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.city && (
                        <span
                          id="error-city"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.city}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      Estado
                      <input
                        type="text"
                        name="state"
                        aria-invalid={!!fieldErrors.state}
                        aria-describedby={
                          fieldErrors.state ? 'error-state' : undefined
                        }
                        value={form.state}
                        onChange={(e) => updateForm('state', e.target.value)}
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.state && (
                        <span
                          id="error-state"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.state}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-300">
                      CEP
                      <input
                        type="tel"
                        name="zip"
                        aria-invalid={!!fieldErrors.zip}
                        aria-describedby={
                          fieldErrors.zip ? 'error-zip' : undefined
                        }
                        value={form.zip}
                        onChange={(e) => updateForm('zip', e.target.value)}
                        placeholder="00000-000"
                        className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                      />
                      {fieldErrors.zip && (
                        <span
                          id="error-zip"
                          className="mt-1 block text-xs text-red-200"
                        >
                          {fieldErrors.zip}
                        </span>
                      )}
                      {cepLoading ? (
                        <span className="mt-1 block text-xs text-cyan-200">
                          Buscando endereço…
                        </span>
                      ) : null}
                      {cepError ? (
                        <span className="mt-1 block text-xs text-red-200">
                          {cepError}
                        </span>
                      ) : null}
                    </label>
                  </div>
                </div>

                <details className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-white">
                    Anexar modelo 3D{' '}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      Opcional
                    </span>
                  </summary>
                  <div className="mt-1 text-sm text-slate-400">
                    Adicione um arquivo .glb para o cliente visualizar o modelo
                    na página de pagamento.
                  </div>
                  <label className="mt-4 flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-400/[0.03] px-4 py-5 text-center hover:bg-cyan-400/[0.06]">
                    <input
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="sr-only"
                      onChange={(e) =>
                        handleModel3dChange(e.target.files?.[0] || null)
                      }
                      disabled={busy}
                    />
                    <span className="text-sm font-bold text-cyan-100">
                      Selecionar arquivo .glb
                    </span>
                    <span className="mt-1 text-xs text-slate-400">
                      Máximo recomendado: 100 MB
                    </span>
                  </label>
                  {model3dFile ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {model3dFile.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {(
                            Number(model3dFile.size || 0) /
                            1024 /
                            1024
                          ).toFixed(2)}{' '}
                          MB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleModel3dChange(null)}
                        disabled={busy}
                        className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}
                  {model3dError ? (
                    <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-100 ring-1 ring-red-500/20">
                      {model3dError}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-2xl bg-black/20 p-3 text-xs text-slate-400 ring-1 ring-white/10">
                    Quando o link de pagamento for aberto, o cliente verá o
                    botão <b className="text-slate-200">Ver 3D</b> se este
                    arquivo estiver anexado.
                  </div>
                </details>
              </div>
              <div hidden={step !== 1} className="space-y-4">
                <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-white font-bold">
                        Itens do pedido
                      </div>
                      <div className="text-sm text-slate-400">
                        Adicione produtos, orçamento, frete ou crie uma
                        assinatura VIP com as miniaturas do ciclo.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={addRegisteredProduct}
                        className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                      >
                        Produto cadastrado
                      </button>
                      <button
                        onClick={addCustomItem}
                        className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/4 ring-1 ring-white/10"
                      >
                        Orçamento personalizado
                      </button>
                      <button
                        onClick={addFreightItem}
                        className="rounded-xl px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 ring-1 ring-cyan-400/20"
                      >
                        Pagamento de frete
                      </button>
                      {canManageBusiness && (
                        <button
                          onClick={addVipItem}
                          disabled={loadingVipData}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/10 ring-1 ring-violet-400/30 disabled:opacity-50"
                        >
                          {loadingVipData
                            ? 'Carregando VIP…'
                            : 'Assinatura VIP'}
                        </button>
                      )}
                    </div>
                  </div>
                  <label className="mt-4 block text-xs text-slate-400">
                    Buscar produto no catálogo
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Nome ou categoria"
                      className="mt-1 w-full rounded-xl bg-black/20 px-3 py-2 text-sm text-white ring-1 ring-white/10"
                    />
                  </label>
                  {vipDataError ? (
                    <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/20">
                      {vipDataError}
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-3">
                    {items.map((it) =>
                      it.mode === 'vip' ? (
                        (() => {
                          const plan =
                            vipPlans.find(
                              (row) => String(row.id) === String(it.vip_plan_id)
                            ) || null
                          const limits = getVipPlanLimits(plan)
                          const counts = getVipSelectedCounts(it)
                          const selectedIds = Array.isArray(
                            it.selected_option_ids
                          )
                            ? it.selected_option_ids.map(String)
                            : []
                          const level3 = isLevel3VipPlan(plan)
                          const activeOptions = vipOptions.filter(
                            (option) =>
                              String(option?.cycle_key || '').trim() ===
                                String(vipCycleKey || '').trim() &&
                              option?.active !== false
                          )
                          const pastCycleKeys = Array.from(
                            new Set(
                              vipOptions
                                .map((option) =>
                                  String(option?.cycle_key || '').trim()
                                )
                                .filter(
                                  (cycleKey) =>
                                    cycleKey &&
                                    cycleKey !==
                                      String(vipCycleKey || '').trim() &&
                                    (!vipCycleKey ||
                                      cycleKey < String(vipCycleKey).trim())
                                )
                            )
                          ).sort((a, b) => b.localeCompare(a))
                          const selectedPastCycleKey = pastCycleKeys.includes(
                            vipPastCycleKey
                          )
                            ? vipPastCycleKey
                            : pastCycleKeys[0] || ''
                          const pastOptions = vipOptions.filter(
                            (option) =>
                              String(option?.cycle_key || '').trim() ===
                              selectedPastCycleKey
                          )
                          const selectedPastOptions = vipOptions.filter(
                            (option) =>
                              selectedIds.includes(String(option.id)) &&
                              String(option?.cycle_key || '').trim() !==
                                String(vipCycleKey || '').trim()
                          )
                          return (
                            <div
                              key={it.id}
                              className="rounded-2xl bg-violet-500/5 p-4 ring-1 ring-violet-400/25"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-base font-extrabold text-violet-100">
                                    Assinatura VIP
                                  </div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    Ciclo{' '}
                                    {it.cycle_key || vipCycleKey || 'ativo'} •
                                    acesso liberado automaticamente após o
                                    pagamento
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeItem(it.id)}
                                  className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
                                >
                                  Remover
                                </button>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                <label className="text-sm text-slate-300">
                                  Plano VIP
                                  <select
                                    value={it.vip_plan_id || ''}
                                    onChange={(e) =>
                                      changeVipPlan(it.id, e.target.value)
                                    }
                                    className="mt-1 w-full rounded-xl bg-black/20 px-3 py-2 text-white ring-1 ring-white/10"
                                  >
                                    <option value="">Selecione</option>
                                    {vipPlans.map((vipPlan) => (
                                      <option
                                        key={vipPlan.id}
                                        value={vipPlan.id}
                                      >
                                        {vipPlan.name ||
                                          vipPlan.short_name ||
                                          vipPlan.id}{' '}
                                        —{' '}
                                        {fmtBRL(
                                          vipPlan.price_brl ??
                                            vipPlan.price ??
                                            0
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="rounded-xl bg-black/20 px-4 py-3 text-right ring-1 ring-white/10">
                                  <div className="text-xs text-slate-400">
                                    Valor carregado
                                  </div>
                                  <div className="text-lg font-extrabold text-white">
                                    {fmtBRL(
                                      plan?.price_brl ?? plan?.price ?? 0
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-white">
                                      Miniaturas da assinatura
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      Selecione {limits.miniatures} miniatura(s)
                                      {limits.bosses
                                        ? ` e ${limits.bosses} boss(es)`
                                        : ''}
                                      .
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${counts.total === limits.total && counts.miniatures === limits.miniatures && counts.bosses === limits.bosses ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/30' : 'bg-violet-500/10 text-violet-100 ring-violet-400/30'}`}
                                  >
                                    {counts.total}/{limits.total} • Mini{' '}
                                    {counts.miniatures}/{limits.miniatures}
                                    {limits.bosses
                                      ? ` • Boss ${counts.bosses}/${limits.bosses}`
                                      : ''}
                                  </div>
                                </div>
                                {level3 ? (
                                  <div className="mt-3 rounded-xl bg-violet-500/10 px-3 py-2 text-xs text-violet-100 ring-1 ring-violet-400/20">
                                    O Level 3 vem preenchido com a coleção
                                    ativa, mas você pode desmarcar itens e
                                    substituí-los por miniaturas ou bosses de
                                    ciclos anteriores.
                                  </div>
                                ) : null}

                                <div className="mt-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-xs font-bold uppercase tracking-wide text-violet-100">
                                        Ciclo ativo
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {formatVipCycleLabel(vipCycleKey)}
                                      </div>
                                    </div>
                                    <div className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-100 ring-1 ring-violet-400/20">
                                      {activeOptions.length} opção(ões)
                                    </div>
                                  </div>
                                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {activeOptions.map((option) => {
                                      const selected = selectedIds.includes(
                                        String(option.id)
                                      )
                                      const isBoss =
                                        String(
                                          option?.item_type || 'miniature'
                                        ).toLowerCase() === 'boss'
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() =>
                                            toggleVipOption(it, option.id)
                                          }
                                          className={`flex items-center gap-3 rounded-xl p-2 text-left ring-1 transition ${selected ? 'bg-violet-400/15 ring-violet-300/50' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'}`}
                                        >
                                          {option.image_url ? (
                                            <img
                                              src={option.image_url}
                                              alt=""
                                              className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                                              loading="lazy"
                                            />
                                          ) : (
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/30 text-slate-500 ring-1 ring-white/10">
                                              <span className="material-icons">
                                                image
                                              </span>
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-slate-100">
                                              {option.title || 'Miniatura VIP'}
                                            </div>
                                            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                                              {isBoss ? 'Boss' : 'Miniatura'}
                                            </div>
                                          </div>
                                          <span
                                            className={`material-icons text-[20px] ${selected ? 'text-violet-200' : 'text-slate-600'}`}
                                          >
                                            {selected
                                              ? 'check_circle'
                                              : 'radio_button_unchecked'}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {!activeOptions.length ? (
                                    <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/20">
                                      Nenhuma miniatura está ativa no ciclo VIP
                                      atual.
                                    </div>
                                  ) : null}
                                </div>

                                <div className="mt-4 rounded-2xl bg-amber-500/[0.04] p-3 ring-1 ring-amber-400/20">
                                  <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-amber-100">
                                        Miniaturas de ciclos anteriores
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        Você pode misturar opções antigas com as
                                        do ciclo ativo, respeitando a quantidade
                                        do plano.
                                      </div>
                                    </div>
                                    {pastCycleKeys.length ? (
                                      <label className="min-w-[220px] text-xs text-slate-300">
                                        Escolher ciclo
                                        <select
                                          value={selectedPastCycleKey}
                                          onChange={(e) =>
                                            setVipPastCycleKey(e.target.value)
                                          }
                                          className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2 text-white ring-1 ring-white/10"
                                        >
                                          {pastCycleKeys.map((cycleKey) => (
                                            <option
                                              key={cycleKey}
                                              value={cycleKey}
                                            >
                                              {formatVipCycleLabel(cycleKey)}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    ) : null}
                                  </div>

                                  {selectedPastOptions.length ? (
                                    <div className="mt-3 rounded-xl bg-emerald-500/5 p-2 ring-1 ring-emerald-400/20">
                                      <div className="px-1 pb-2 text-xs font-semibold text-emerald-100">
                                        Selecionadas de ciclos anteriores
                                      </div>
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {selectedPastOptions.map((option) => {
                                          const isBoss =
                                            String(
                                              option?.item_type || 'miniature'
                                            ).toLowerCase() === 'boss'
                                          return (
                                            <button
                                              key={`selected-past-${option.id}`}
                                              type="button"
                                              onClick={() =>
                                                toggleVipOption(it, option.id)
                                              }
                                              className="flex items-center gap-3 rounded-xl bg-emerald-400/10 p-2 text-left ring-1 ring-emerald-300/30"
                                            >
                                              {option.image_url ? (
                                                <img
                                                  src={option.image_url}
                                                  alt=""
                                                  className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/30 text-slate-500 ring-1 ring-white/10">
                                                  <span className="material-icons">
                                                    image
                                                  </span>
                                                </div>
                                              )}
                                              <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold text-slate-100">
                                                  {option.title ||
                                                    'Miniatura VIP'}
                                                </div>
                                                <div className="mt-1 text-[10px] uppercase tracking-wide text-emerald-200/80">
                                                  {formatVipCycleLabel(
                                                    option.cycle_key
                                                  )}{' '}
                                                  •{' '}
                                                  {isBoss
                                                    ? 'Boss'
                                                    : 'Miniatura'}
                                                </div>
                                              </div>
                                              <span className="material-icons text-[20px] text-emerald-200">
                                                check_circle
                                              </span>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {pastCycleKeys.length ? (
                                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {pastOptions.map((option) => {
                                        const selected = selectedIds.includes(
                                          String(option.id)
                                        )
                                        const isBoss =
                                          String(
                                            option?.item_type || 'miniature'
                                          ).toLowerCase() === 'boss'
                                        return (
                                          <button
                                            key={`past-${option.id}`}
                                            type="button"
                                            onClick={() =>
                                              toggleVipOption(it, option.id)
                                            }
                                            className={`flex items-center gap-3 rounded-xl p-2 text-left ring-1 transition ${selected ? 'bg-amber-400/15 ring-amber-300/50' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'}`}
                                          >
                                            {option.image_url ? (
                                              <img
                                                src={option.image_url}
                                                alt=""
                                                className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                                                loading="lazy"
                                              />
                                            ) : (
                                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/30 text-slate-500 ring-1 ring-white/10">
                                                <span className="material-icons">
                                                  image
                                                </span>
                                              </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-semibold text-slate-100">
                                                {option.title ||
                                                  'Miniatura VIP'}
                                              </div>
                                              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                                                {isBoss ? 'Boss' : 'Miniatura'}
                                                {option?.active === false
                                                  ? ' • Arquivada'
                                                  : ''}
                                              </div>
                                            </div>
                                            <span
                                              className={`material-icons text-[20px] ${selected ? 'text-amber-200' : 'text-slate-600'}`}
                                            >
                                              {selected
                                                ? 'check_circle'
                                                : 'radio_button_unchecked'}
                                            </span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-400 ring-1 ring-white/10">
                                      Ainda não existem ciclos anteriores
                                      cadastrados.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })()
                      ) : it.mode === 'product' ? (
                        <div
                          key={it.id}
                          className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_auto] gap-3 items-end"
                        >
                          <label className="text-sm text-slate-300">
                            Produto
                            <select
                              value={it.product_id}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  product_id: e.target.value,
                                  scale:
                                    products.find(
                                      (product) =>
                                        String(product.id) === e.target.value
                                    )?.default_variant || '',
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            >
                              <option value="">Selecione</option>
                              {products
                                .filter(
                                  (product) =>
                                    visibleProducts.includes(product) ||
                                    String(product.id) === String(it.product_id)
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} —{' '}
                                    {fmtBRL(
                                      getManualProductPriceCents(
                                        p,
                                        p.default_variant
                                      ) / 100
                                    )}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-300">
                            Quantidade
                            <input
                              type="number"
                              min="1"
                              max="999"
                              step="1"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  qty: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300">
                            Escala
                            <select
                              value={
                                it.scale ||
                                products.find(
                                  (product) =>
                                    String(product.id) === String(it.product_id)
                                )?.default_variant ||
                                ''
                              }
                              onChange={(e) =>
                                updateItem(it.id, {
                                  scale: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            >
                              <option value="">Padrão</option>
                              {(
                                products.find(
                                  (product) =>
                                    String(product.id) === String(it.product_id)
                                )?.variants || []
                              ).map((variant) => (
                                <option
                                  key={variant.label}
                                  value={variant.label}
                                >
                                  {variant.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            onClick={() => removeItem(it.id)}
                            className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
                          >
                            Remover
                          </button>
                        </div>
                      ) : it.mode === 'freight' ? (
                        <div
                          key={it.id}
                          className="rounded-2xl bg-cyan-500/5 ring-1 ring-cyan-400/20 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <label className="text-sm text-slate-300">
                            Transportadora
                            <select
                              value={it.carrier}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  carrier: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            >
                              <option value="">Selecione</option>
                              <option value="correios">Correios</option>
                              <option value="jadlog">Jadlog</option>
                              <option value="loggi">Loggi</option>
                            </select>
                          </label>
                          <label className="text-sm text-slate-300">
                            Valor do frete
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.price}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  price: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300 sm:col-span-2">
                            Observações
                            <textarea
                              value={it.notes}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Opcional"
                              className="mt-1 h-20 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <div className="sm:col-span-2 flex items-center justify-between gap-3">
                            <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-cyan-100 ring-1 ring-cyan-400/20">
                              Item exclusivo para cobrança de frete.
                            </div>
                            <button
                              onClick={() => removeItem(it.id)}
                              className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={it.id}
                          className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <label className="text-sm text-slate-300">
                            Nome do produto
                            <input
                              value={it.name}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  name: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300">
                            Valor
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.price}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  price: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300">
                            Escala
                            <input
                              value={it.scale}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  scale: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300">
                            Quantidade
                            <input
                              type="number"
                              min="1"
                              max="999"
                              step="1"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  qty: e.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <label className="text-sm text-slate-300 sm:col-span-2">
                            Observações
                            <textarea
                              value={it.notes}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  notes: e.target.value,
                                })
                              }
                              className="mt-1 h-20 w-full rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2 text-white"
                            />
                          </label>
                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              onClick={() => removeItem(it.id)}
                              className="rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 ring-1 ring-red-500/30"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )
                    )}
                    {!items.length ? (
                      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 text-sm text-slate-400">
                        Nenhum item adicionado ainda.
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <span className="text-sm text-slate-400">
                      {items.length} item(ns) no pedido
                    </span>
                    <span className="text-lg font-semibold text-white">
                      {fmtBRL(total)}
                    </span>
                  </div>
                </div>
              </div>

              {step === 2 && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <section className="admin-surface p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-white">
                          Cliente e entrega
                        </h3>
                        <button
                          type="button"
                          onClick={() => setStep(0)}
                          className="text-sm text-cyan-200"
                        >
                          Editar dados
                        </button>
                      </div>
                      <p className="mt-3 font-medium text-slate-100">
                        {form.name}
                      </p>
                      <p className="text-sm text-slate-400">
                        {form.email} • {form.phone || 'Sem telefone'}
                      </p>
                      <p className="mt-3 text-sm text-slate-300">
                        {form.address_line1}, {form.address_number}
                        {form.address_line2 ? `, ${form.address_line2}` : ''}
                        <br />
                        {form.neighborhood} — {form.city}/{form.state} • CEP{' '}
                        {form.zip}
                      </p>
                      {model3dFile && (
                        <p className="mt-3 text-xs text-cyan-200">
                          Modelo 3D: {model3dFile.name}
                        </p>
                      )}
                    </section>
                    <section className="admin-surface p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-white">
                          Resumo dos itens
                        </h3>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="text-sm text-cyan-200"
                        >
                          Editar itens
                        </button>
                      </div>
                      <div className="mt-4 divide-y divide-white/10">
                        {reviewItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-100 break-words">
                                {item.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.quantity} ×{' '}
                                {fmtBRL(item.priceCents / 100)}
                                {item.scale ? ` • Escala ${item.scale}` : ''}
                              </p>
                              {item.mode === 'vip' && (
                                <p className="mt-1 text-xs text-violet-200">
                                  Ciclo {item.cycle_key || vipCycleKey} •{' '}
                                  {(item.selected_option_ids || [])
                                    .map(
                                      (id) =>
                                        vipOptions.find(
                                          (option) =>
                                            String(option.id) === String(id)
                                        )?.title
                                    )
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 font-semibold text-white">
                              {fmtBRL((item.priceCents * item.quantity) / 100)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                  <section className="admin-surface self-start p-5">
                    <p className="admin-eyebrow">TOTAL DO PEDIDO</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {fmtBRL(total)}
                    </p>
                    <fieldset className="mt-5 space-y-3">
                      <legend className="mb-3 text-sm font-medium text-slate-200">
                        Como registrar o pagamento?
                      </legend>
                      {[
                        [
                          'payment_link',
                          'Gerar link de pagamento',
                          'O cliente recebe o link para pagar com Pix ou cartão.',
                        ],
                        [
                          'mark_paid',
                          'Pagamento já recebido',
                          'O pedido será registrado como pago. Confirme que o valor foi recebido.',
                        ],
                      ].map(([value, label, description]) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${paymentAction === value ? 'border-cyan-300/40 bg-cyan-400/5' : 'border-white/10'}`}
                        >
                          <input
                            type="radio"
                            name="manualPayment"
                            value={value}
                            checked={paymentAction === value}
                            onChange={() => setPaymentAction(value)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-sm font-medium text-slate-100">
                              {label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-400">
                              {description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </section>
                </div>
              )}
            </div>
          )}
        </div>
        {!result && (
          <div className="manual-order-footer">
            <button
              type="button"
              onClick={() => {
                setError('')
                setStep((current) => Math.max(0, current - 1))
              }}
              disabled={step === 0 || busy}
              className="admin-secondary"
            >
              Voltar
            </button>
            <div className="ml-auto flex items-center gap-4">
              <span className="hidden text-sm text-slate-400 sm:block">
                Total <b className="ml-2 text-white">{fmtBRL(total)}</b>
              </span>
              <button
                type="button"
                onClick={step < 2 ? goNext : () => handleSubmit(paymentAction)}
                disabled={
                  busy ||
                  (step > 0 && loadingProducts) ||
                  (hasVipItem && loadingVipData)
                }
                className="admin-primary"
              >
                {busy
                  ? 'Processando…'
                  : step === 0
                    ? 'Continuar para itens'
                    : step === 1
                      ? 'Revisar pedido'
                      : paymentAction === 'mark_paid'
                        ? 'Lançar como pago'
                        : 'Criar e gerar link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
