import React from 'react'
import { createClient } from '@supabase/supabase-js'
import Modal from './Modal.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { supabase } from '../lib/supabaseClient'
import { fetchAddressFromCep, isValidCep, onlyDigits } from '../lib/cep.js'
import { useFavorites } from '../state/FavoritesProvider.jsx'
import {
  buildPublicReviewName,
  extractReviewProductRefs,
} from '../lib/reviews.js'
import AccountSettingsTabs from './account/AccountSettingsTabs.jsx'
import { copyText } from '../lib/clipboard.js'

function Field({ label, children, wide = false }) {
  const id = React.useId()
  const fields = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    if (
      ['input', 'select', 'textarea'].includes(child.type) ||
      child.type === PasswordInput
    )
      return React.cloneElement(child, { id: child.props.id || id })
    return child
  })
  return (
    <div className={`account-field ${wide ? 'account-field-wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {fields}
    </div>
  )
}

function FloatingNotice({ tone = 'success', message }) {
  if (!message) return null
  const palette =
    tone === 'error'
      ? 'border-rose-400/35 bg-[#05131a]/95 text-rose-100 shadow-[0_20px_60px_-20px_rgba(244,63,94,0.45)]'
      : 'border-emerald-400/35 bg-[#05131a]/95 text-emerald-100 shadow-[0_20px_60px_-20px_rgba(52,211,153,0.45)]'
  const icon = tone === 'error' ? 'error' : 'verified'
  return (
    <div className="sticky top-3 z-[70] mb-4 flex justify-center px-1">
      <div
        className={`max-w-xl rounded-2xl border px-4 py-3 backdrop-blur-xl ring-1 ring-white/10 ${palette}`.trim()}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 ring-1 ring-white/10">
            <span className="material-icons text-[18px]">{icon}</span>
          </div>
          <p
            role={tone === 'error' ? 'alert' : 'status'}
            className="text-sm font-medium leading-6"
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder = '••••••••',
  className = '',
  inputClassName = '',
  buttonClassName = '',
  ...props
}) {
  const [visible, setVisible] = React.useState(false)
  const resolvedInputClass = (
    className ||
    inputClassName ||
    'w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-cyan-400/60'
  ).trim()
  const resolvedButtonClass = (
    buttonClassName ||
    'absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-300 transition hover:text-white'
  ).trim()
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={resolvedInputClass}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className={resolvedButtonClass}
      >
        <span className="material-icons text-[20px]">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  )
}

export default function ProfileSettingsModal({
  open,
  onClose,
  required = false,
  onSaved,
  initialTab = 'profile',
  onSignOut,
  onNavigate,
  onRequireLogin,
  mode = 'modal',
  modalTitle,
  highlightTitle = '',
  highlightMessage = '',
}) {
  const {
    user,
    session,
    resetPassword,
    loading: authLoading,
    isPasswordRecovery,
    clearPasswordRecovery,
    accountHasPassword,
  } = useAuth()

  // Navegação compatível com o router simples do App.jsx.
  // - Preferimos usar onNavigate (que chama navigate() e atualiza o state da rota).
  // - Fallback: pushState + popstate
  // - Último recurso: location.assign
  const go = React.useCallback(
    (path) => {
      const normalized = String(path || '/')
      try {
        if (onNavigate) return onNavigate(normalized)
      } catch {}

      if (typeof window !== 'undefined') {
        try {
          window.history.pushState({}, '', normalized)
          window.dispatchEvent(new PopStateEvent('popstate'))
          return
        } catch {}
        try {
          window.location.assign(normalized)
        } catch {}
      }
    },
    [onNavigate]
  )

  const isPage = mode === 'page'
  const authActions = React.useRef({ onRequireLogin, onClose, isPage })
  authActions.current = { onRequireLogin, onClose, isPage }
  function maybeClose() {
    if (isPage) return
    try {
      onClose?.()
    } catch {}
  }

  React.useEffect(() => {
    // Em refresh de página, o Supabase pode demorar alguns ms para restaurar a sessão.
    // Não devemos abrir o modal de login enquanto o AuthProvider ainda está carregando.
    if (!open) return
    if (authLoading) return
    if (!user) {
      authActions.current.onRequireLogin?.('Faça login para editar seus dados.')
      if (!required && !authActions.current.isPage)
        authActions.current.onClose?.()
    }
  }, [open, user, authLoading, required])
  const jwt = session?.access_token || ''
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [ok, setOk] = React.useState('')
  const [activeTab, setActiveTab] = React.useState(
    initialTab === 'settings' ? 'settings' : 'profile'
  )

  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [cpf, setCpf] = React.useState('')
  const [birthdate, setBirthdate] = React.useState('')
  const [vipUntil, setVipUntil] = React.useState('')

  const [street, setStreet] = React.useState('')
  const [number, setNumber] = React.useState('')
  const [addr2, setAddr2] = React.useState('')
  const [neighborhood, setNeighborhood] = React.useState('')
  const [city, setCity] = React.useState('')
  const [stateUF, setStateUF] = React.useState('')
  const [zip, setZip] = React.useState('')

  const [hasSecondAddress, setHasSecondAddress] = React.useState(false)
  const [zip2, setZip2] = React.useState('')
  const [street2, setStreet2] = React.useState('')
  const [number2, setNumber2] = React.useState('')
  const [addr22, setAddr22] = React.useState('')
  const [neighborhood2, setNeighborhood2] = React.useState('')
  const [city2, setCity2] = React.useState('')
  const [stateUF2, setStateUF2] = React.useState('')

  const [avatarPreview, setAvatarPreview] = React.useState('')
  const [avatarFileName, setAvatarFileName] = React.useState('')
  const [avatarFile, setAvatarFile] = React.useState(null)
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [newPassword2, setNewPassword2] = React.useState('')
  const [pwdBusy, setPwdBusy] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [deleteAccountModal, setDeleteAccountModal] = React.useState({
    open: false,
    password: '',
    confirm: false,
    error: '',
  })
  const saveLock = React.useRef(false)
  const passwordLock = React.useRef(false)
  const resetLock = React.useRef(false)
  const [resetBusy, setResetBusy] = React.useState(false)
  const [profileReady, setProfileReady] = React.useState(false)
  const [profileBaseline, setProfileBaseline] = React.useState('')
  const [loadError, setLoadError] = React.useState('')
  const profileRequest = React.useRef(null)
  const loadProfileRef = React.useRef(null)
  const [settingsSection, setSettingsSection] = React.useState('security')
  const [localHasPassword, setLocalHasPassword] = React.useState(
    () => !!accountHasPassword
  )
  const isRecoveryMode = !!isPasswordRecovery
  const shouldRequireCurrentPassword = !isRecoveryMode && !!localHasPassword
  const securityActionLabel = shouldRequireCurrentPassword
    ? 'Trocar senha'
    : 'Criar senha'
  const securityIntro = shouldRequireCurrentPassword
    ? 'Troque sua senha com segurança. Se preferir, envie um link de recuperação por e-mail.'
    : 'Sua conta ainda não tem senha definida. Crie uma senha para também poder entrar com e-mail e senha.'

  // Favoritos
  const {
    favoriteIds,
    toggleFavorite,
    reload: reloadFavorites,
  } = useFavorites()
  const [favProducts, setFavProducts] = React.useState([])
  const [favBusy, setFavBusy] = React.useState(false)

  // Cupons
  const [myCoupons, setMyCoupons] = React.useState([])
  const [couponBusy, setCouponBusy] = React.useState(false)

  // Avaliações (por pedido entregue)
  const [reviewsBusy, setReviewsBusy] = React.useState(false)
  const [sectionErrors, setSectionErrors] = React.useState({})
  const [deliveredOrders, setDeliveredOrders] = React.useState([])
  const [reviewsByOrder, setReviewsByOrder] = React.useState({})
  const [reviewModal, setReviewModal] = React.useState({
    open: false,
    order: null,
    rating: 5,
    comment: '',
    busy: false,
  })

  const [cepBusy, setCepBusy] = React.useState(false)
  const [cepHint, setCepHint] = React.useState('')

  const updateDeleteAccountModal = React.useCallback((patch) => {
    setDeleteAccountModal((prev) => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }))
  }, [])

  React.useEffect(() => {
    setLocalHasPassword(!!accountHasPassword)
  }, [accountHasPassword, user?.id])

  function translatePasswordError(error, fallback) {
    const raw = String(error?.message || error || '').trim()
    const normalized = raw.toLowerCase()
    if (!raw) return fallback
    if (
      /invalid login credentials|senha incorreta|invalid credentials|email not confirmed/.test(
        normalized
      )
    ) {
      return 'Senha atual incorreta.'
    }
    if (/auth session missing/.test(normalized)) {
      return isRecoveryMode
        ? 'Abra o link enviado ao seu e-mail para criar a nova senha com segurança.'
        : 'Sua sessão expirou. Entre novamente para alterar sua senha.'
    }
    if (/new password should be different|same password/.test(normalized)) {
      return 'Escolha uma nova senha diferente da atual.'
    }
    return raw || fallback
  }

  function createTemporaryPasswordClient() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey)
      throw new Error('Configuração de autenticação ausente.')

    const memoryStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `cc-password-check-${user?.id || 'anon'}`,
        storage: memoryStorage,
      },
    })
  }

  async function updatePasswordUsingCurrentPassword(password, nextPassword) {
    const email = String(user?.email || '').trim()
    if (!email || !password) throw new Error('Informe sua senha atual.')

    const temp = createTemporaryPasswordClient()

    try {
      const { data, error } = await temp.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      if (!data?.user || data.user.id !== user?.id)
        throw new Error('Senha atual incorreta.')

      const { error: updateError } = await temp.auth.updateUser({
        password: nextPassword,
        data: { has_password: true },
      })
      if (updateError) throw updateError
      return true
    } catch (error) {
      throw new Error(
        translatePasswordError(error, 'Não foi possível alterar a senha.')
      )
    } finally {
      try {
        await temp.auth.signOut()
      } catch {}
    }
  }

  function isValidCpf(raw) {
    const v = onlyDigits(raw)
    if (v.length !== 11) return false
    if (/^(\d)\1{10}$/.test(v)) return false
    const calc = (base, factor) => {
      let sum = 0
      for (let i = 0; i < base.length; i++)
        sum += Number(base[i]) * (factor - i)
      const mod = (sum * 10) % 11
      return mod === 10 ? 0 : mod
    }
    const d1 = calc(v.slice(0, 9), 10)
    const d2 = calc(v.slice(0, 10), 11)
    return d1 === Number(v[9]) && d2 === Number(v[10])
  }

  React.useEffect(() => {
    if (!open) return
    const t =
      initialTab === 'settings' || isPasswordRecovery ? 'settings' : 'profile'
    setActiveTab(t)
    setSettingsSection((current) => (t === 'settings' ? 'security' : current))
  }, [open, initialTab, isPasswordRecovery])

  const profileValues = {
    fullName,
    phone,
    cpf,
    birthdate,
    street,
    number,
    addr2,
    neighborhood,
    city,
    stateUF,
    zip,
    hasSecondAddress,
    zip2,
    street2,
    number2,
    addr22,
    neighborhood2,
    city2,
    stateUF2,
    avatarPreview,
  }
  const profileDirty = Boolean(
    profileBaseline &&
    (JSON.stringify(profileValues) !== profileBaseline || avatarFile)
  )

  const userId = user?.id
  const userAvatar = user?.user_metadata?.avatar_url || ''
  const loadProfile = React.useCallback(async () => {
    if (!userId || !jwt) return
    profileRequest.current?.abort()
    const controller = new AbortController()
    profileRequest.current = controller
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/profile', {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const json = await response.json().catch(() => ({}))
      if (controller.signal.aborted) return
      if (!response.ok)
        throw new Error(json?.error || 'Não foi possível carregar seus dados.')
      const data = json?.profile || {}
      const values = {
        fullName: data.full_name || '',
        phone: data.phone || '',
        cpf: data.cpf || '',
        birthdate: data.birthdate || '',
        street: data.address_line1 || '',
        number: data.address_number || '',
        addr2: data.address_line2 || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        stateUF: data.state || '',
        zip: data.zip || '',
        hasSecondAddress: Boolean(data.has_second_address),
        zip2: data.address2_zip || '',
        street2: data.address2_line1 || '',
        number2: data.address2_number || '',
        addr22: data.address2_line2 || '',
        neighborhood2: data.address2_neighborhood || '',
        city2: data.address2_city || '',
        stateUF2: data.address2_state || '',
        avatarPreview: userAvatar,
      }
      const setters = {
        fullName: setFullName,
        phone: setPhone,
        cpf: setCpf,
        birthdate: setBirthdate,
        street: setStreet,
        number: setNumber,
        addr2: setAddr2,
        neighborhood: setNeighborhood,
        city: setCity,
        stateUF: setStateUF,
        zip: setZip,
        hasSecondAddress: setHasSecondAddress,
        zip2: setZip2,
        street2: setStreet2,
        number2: setNumber2,
        addr22: setAddr22,
        neighborhood2: setNeighborhood2,
        city2: setCity2,
        stateUF2: setStateUF2,
        avatarPreview: setAvatarPreview,
      }
      for (const [key, value] of Object.entries(values)) setters[key](value)
      setVipUntil(data.vip_until || '')
      setAvatarFile(null)
      setAvatarFileName('')
      setProfileBaseline(JSON.stringify(values))
      setProfileReady(true)
    } catch (error) {
      if (!controller.signal.aborted)
        setLoadError(
          (error instanceof TypeError ? '' : error?.message) ||
            'Não foi possível carregar seus dados. Tente novamente.'
        )
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [userId, jwt, userAvatar])

  const isVip = React.useMemo(() => {
    if (!vipUntil) return false
    const t = new Date(vipUntil).getTime()
    return Number.isFinite(t) && t > Date.now()
  }, [vipUntil])

  const loadFavoritesProducts = React.useCallback(async () => {
    if (!open || !user) {
      setFavProducts([])
      return
    }
    const ids = Array.from(favoriteIds || new Set()).filter(Boolean)
    if (!ids.length) {
      setFavProducts([])
      return
    }
    setFavBusy(true)
    setSectionErrors((prev) => ({ ...prev, favorites: '' }))
    try {
      // Buscar no mesmo formato da tabela "products" (campos reais do Supabase)
      const { data, error } = await supabase
        .from('products')
        .select(
          'id,slug,name,description,price_cents,currency,stock,active,featured,promo,image_url,images,status,tags,default_variant,variants,original_price_cents,category,created_at'
        )
        .in('id', ids)

      if (error) throw error

      // Mapear para o formato usado no front (compat com ProductCard / galeria)
      const mapped = (data || [])
        .map((row) => {
          const toInt = (v) => {
            const n = Number(v)
            return Number.isFinite(n) ? Math.trunc(n) : 0
          }
          const centsToBRL = (cents) =>
            typeof cents === 'number' && Number.isFinite(cents)
              ? Number((cents / 100).toFixed(2))
              : 0

          const promoActive = !!row?.promo
          const promoPriceCents = toInt(row?.price_cents ?? 0)
          const originalPriceCents = toInt(row?.original_price_cents ?? 0)
          const effectiveBasePriceCents = promoActive
            ? promoPriceCents > 0
              ? promoPriceCents
              : originalPriceCents
            : originalPriceCents > 0
              ? originalPriceCents
              : promoPriceCents
          const strikePriceCents =
            promoActive && originalPriceCents > effectiveBasePriceCents
              ? originalPriceCents
              : 0

          const variants = Array.isArray(row?.variants)
            ? row.variants
                .filter(Boolean)
                .map((v) => {
                  const fullPriceCents = toInt(v?.price_cents ?? 0)
                  return {
                    label: String(v?.label ?? ''),
                    price: centsToBRL(fullPriceCents),
                    priceCents: fullPriceCents,
                  }
                })
                .filter((v) => v.label)
            : []

          const imgs = Array.isArray(row?.images)
            ? row.images.filter(Boolean).map(String)
            : []
          const main = row?.image_url ? String(row.image_url) : ''
          const allImgs = imgs.length ? imgs : main ? [main] : []
          const img = main || allImgs[0] || ''

          return {
            id: String(row?.id ?? ''),
            slug: row?.slug ? String(row.slug) : '',
            nome: row?.name ? String(row.name) : '',
            descricao: row?.description ? String(row.description) : '',
            img,
            imgs: allImgs,
            status: row?.status ? String(row.status) : 'catalogo',
            featured: !!row?.featured,
            promo: promoActive,
            originalPrice: centsToBRL(strikePriceCents),
            preco: centsToBRL(effectiveBasePriceCents),
            originalPriceCents: strikePriceCents,
            priceCents: effectiveBasePriceCents,
            currency: row?.currency ? String(row.currency) : 'brl',
            stock:
              row?.stock === null || row?.stock === undefined
                ? null
                : (() => {
                    const n = Number(row.stock)
                    return Number.isFinite(n) ? Math.trunc(n) : null
                  })(),
            active: row?.active !== false,
            tags: Array.isArray(row?.tags)
              ? row.tags.filter(Boolean).map(String)
              : [],
            category: row?.category ? String(row.category) : '',
            defaultVariant: row?.default_variant
              ? String(row.default_variant)
              : '',
            variants,
          }
        })
        .filter((pp) => pp.id && pp.nome)

      // Mantém a ordem dos favoritos (mais recente primeiro)
      const map = new Map(mapped.map((pp) => [String(pp.id), pp]))
      setFavProducts(ids.map((id) => map.get(String(id))).filter(Boolean))
    } catch (e) {
      console.warn('load favorites products failed', e)
      setSectionErrors((prev) => ({
        ...prev,
        favorites:
          'Não foi possível carregar seus favoritos. Toque em Atualizar para tentar novamente.',
      }))
      setFavProducts([])
    } finally {
      setFavBusy(false)
    }
  }, [open, user, favoriteIds])

  const loadMyCoupons = React.useCallback(async () => {
    if (!open || !user) {
      setMyCoupons([])
      return
    }
    setCouponBusy(true)
    setSectionErrors((prev) => ({ ...prev, coupons: '' }))
    try {
      const resp = await fetch('/api/coupons?action=my-coupons', {
        method: 'GET',
        headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(json?.error || 'Não foi possível carregar seus cupons.')
      setMyCoupons(Array.isArray(json?.coupons) ? json.coupons : [])
    } catch (e) {
      console.warn('load coupons failed', e)
      setSectionErrors((prev) => ({
        ...prev,
        coupons:
          'Não foi possível carregar seus cupons. Toque em Atualizar para tentar novamente.',
      }))
      setMyCoupons([])
    } finally {
      setCouponBusy(false)
    }
  }, [open, user, jwt])

  const loadDeliveredOrdersForReviews = React.useCallback(async () => {
    if (!open || !user) {
      setDeliveredOrders([])
      setReviewsByOrder({})
      return
    }
    setReviewsBusy(true)
    setSectionErrors((prev) => ({ ...prev, reviews: '' }))
    try {
      // pedidos do usuário + itens
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('id,created_at,status,production_status,total')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60)
      if (oErr) throw oErr
      const delivered = (orders || []).filter(
        (o) => String(o?.production_status || '').toLowerCase() === 'entregue'
      )

      const orderIds = delivered.map((o) => o.id)
      let itemsByOrder = new Map()
      if (orderIds.length) {
        const { data: items, error: iErr } = await supabase
          .from('order_items')
          .select(
            'order_id,product_id,product_name,product_image_url,img,name,qty,unit_price'
          )
          .in('order_id', orderIds)
        if (iErr) throw iErr
        itemsByOrder = new Map()
        ;(items || []).forEach((it) => {
          const k = String(it.order_id)
          const arr = itemsByOrder.get(k) || []
          arr.push(it)
          itemsByOrder.set(k, arr)
        })
      }

      const withItems = delivered.map((o) => ({
        ...o,
        order_items: itemsByOrder.get(String(o.id)) || [],
      }))
      setDeliveredOrders(withItems)

      // reviews existentes
      const { data: revs, error: rErr } = await supabase
        .from('customer_reviews')
        .select(
          'order_id,rating,comment,display_name,approved,featured,created_at,updated_at'
        )
        .eq('user_id', user.id)
      if (rErr && rErr.code !== '42P01') throw rErr // tabela pode não existir
      const map = {}
      ;(revs || []).forEach((r) => {
        map[String(r.order_id)] = r
      })
      setReviewsByOrder(map)
    } catch (e) {
      console.warn('load reviews data failed', e)
      setSectionErrors((prev) => ({
        ...prev,
        reviews:
          'Não foi possível carregar suas compras. Toque em Atualizar para tentar novamente.',
      }))
      setDeliveredOrders([])
      setReviewsByOrder({})
    } finally {
      setReviewsBusy(false)
    }
  }, [open, user])

  React.useEffect(() => {
    if (!open || activeTab !== 'settings') return
    if (settingsSection === 'favorites') loadFavoritesProducts()
    if (settingsSection === 'coupons') loadMyCoupons()
    if (settingsSection === 'reviews') loadDeliveredOrdersForReviews()
  }, [
    open,
    activeTab,
    settingsSection,
    loadFavoritesProducts,
    loadMyCoupons,
    loadDeliveredOrdersForReviews,
  ])

  loadProfileRef.current = loadProfile
  React.useEffect(() => {
    if (!open || !userId || authLoading) return
    setProfileReady(false)
    setProfileBaseline('')
    loadProfileRef.current()
    return () => profileRequest.current?.abort()
  }, [open, userId, authLoading])

  React.useEffect(() => {
    const d = onlyDigits(zip)
    if (d.length !== 8) {
      setCepHint('')
      setCepBusy(false)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setCepBusy(true)
      const resp = await fetchAddressFromCep(d)
      if (cancelled) return
      setCepBusy(false)
      if (!resp.ok) {
        setCepHint(resp.error || 'Não foi possível consultar o CEP')
        return
      }
      const a = resp.data
      setCepHint('Endereço encontrado ✓')
      if (!street.trim() && a.street) setStreet(a.street)
      if (!neighborhood.trim() && a.neighborhood)
        setNeighborhood(a.neighborhood)
      if (!city.trim() && a.city) setCity(a.city)
      if (!stateUF.trim() && a.uf) setStateUF(a.uf)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip])

  function handleAvatarFile(e) {
    setError('')
    const file = e?.target?.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Escolha uma foto de até 5 MB.')
      return
    }
    if (!String(file.type || '').startsWith('image/')) {
      setError('Selecione uma imagem válida para a foto de perfil.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      setAvatarPreview(dataUrl)
      setAvatarFileName(file.name || 'foto')
      setAvatarFile(file)
    }
    reader.readAsDataURL(file)
  }

  async function uploadAvatarIfNeeded() {
    if (!user || !avatarFile)
      return String(avatarPreview || user?.user_metadata?.avatar_url || '')
    const ext = (avatarFile.name || 'jpg').split('.').pop() || 'jpg'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, cacheControl: '3600' })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = String(data?.publicUrl || '')
    if (publicUrl) {
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })
      if (metaErr) throw metaErr
      setAvatarPreview(publicUrl)
      setAvatarFile(null)
    }
    return publicUrl
  }

  async function savePassword() {
    if (passwordLock.current) return
    setError('')
    setOk('')
    if (!newPassword || newPassword.length < 6)
      return setError('A nova senha deve ter pelo menos 6 caracteres.')
    if (newPassword !== newPassword2)
      return setError('As senhas não coincidem.')
    if (shouldRequireCurrentPassword) {
      if (!currentPassword)
        return setError('Digite sua senha atual para continuar.')
      if (currentPassword === newPassword)
        return setError('Escolha uma nova senha diferente da atual.')
    }
    try {
      passwordLock.current = true
      setPwdBusy(true)
      const sessionBeforeCheck =
        session?.access_token && session?.refresh_token
          ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }
          : null

      if (shouldRequireCurrentPassword) {
        await updatePasswordUsingCurrentPassword(currentPassword, newPassword)
      } else {
        let { data: sessData } = await supabase.auth.getSession()
        if (!sessData?.session && sessionBeforeCheck?.refresh_token) {
          const { data: restored, error: restoreErr } =
            await supabase.auth.setSession(sessionBeforeCheck)
          if (restoreErr) throw restoreErr
          sessData = restored
        }

        if (!sessData?.session) {
          throw new Error(
            isRecoveryMode
              ? 'Abra o link de redefinição enviado ao seu e-mail para criar a nova senha com segurança.'
              : 'Sua sessão expirou. Entre novamente para alterar sua senha.'
          )
        }

        const { error: updErr } = await supabase.auth.updateUser({
          password: newPassword,
          data: { has_password: true },
        })
        if (updErr) throw updErr
      }

      setCurrentPassword('')
      setNewPassword('')
      setNewPassword2('')
      setLocalHasPassword(true)
      clearPasswordRecovery?.()
      setOk(
        shouldRequireCurrentPassword
          ? 'Senha alterada com sucesso ✅'
          : 'Senha criada com sucesso ✅'
      )
    } catch (e) {
      setError(
        translatePasswordError(
          e,
          shouldRequireCurrentPassword
            ? 'Não foi possível alterar a senha.'
            : 'Não foi possível criar a senha.'
        )
      )
    } finally {
      passwordLock.current = false
      setPwdBusy(false)
    }
  }

  async function sendPasswordResetLink() {
    if (resetLock.current) return
    resetLock.current = true
    setResetBusy(true)
    setError('')
    setOk('')
    try {
      await resetPassword({ email: String(user?.email || '') })
      setOk(
        'Enviamos um e-mail com um link seguro para você definir uma nova senha.'
      )
    } catch (e) {
      setError(e?.message || 'Não foi possível enviar o link de recuperação.')
    } finally {
      resetLock.current = false
      setResetBusy(false)
    }
  }

  async function deleteAccount() {
    if (!user || !jwt) return
    setError('')
    setOk('')

    const password = String(deleteAccountModal?.password || '').trim()
    updateDeleteAccountModal({ error: '' })
    const confirmDelete = !!deleteAccountModal?.confirm

    if (!password) return setError('Digite sua senha atual para confirmar.')
    if (!confirmDelete)
      return setError('Marque a confirmação para excluir a conta.')

    try {
      setDeleteBusy(true)
      const resp = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ password, confirm: true }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok)
        throw new Error(json?.error || 'Não foi possível excluir sua conta.')

      setDeleteAccountModal({
        open: false,
        password: '',
        confirm: false,
        error: '',
      })
      setOk('Conta excluída com sucesso. Encerrando sua sessão…')
      try {
        await onSignOut?.()
      } catch {}
      try {
        maybeClose()
      } catch {}
      try {
        go('/')
      } catch {}
    } catch (e) {
      const msg = e?.message || 'Não foi possível excluir sua conta.'
      if (/senha incorreta|invalid login credentials/i.test(String(msg))) {
        updateDeleteAccountModal({
          error: 'A senha informada não confere. Confira e tente novamente.',
        })
      } else {
        updateDeleteAccountModal({ error: msg })
      }
    } finally {
      setDeleteBusy(false)
    }
  }

  const closeDeleteAccountModal = React.useCallback(() => {
    if (deleteBusy) return
    setDeleteAccountModal({
      open: false,
      password: '',
      confirm: false,
      error: '',
    })
  }, [deleteBusy])

  async function submitReview() {
    if (!user || !reviewModal?.order?.id) return
    setError('')
    setOk('')
    const rating = Math.max(1, Math.min(5, Number(reviewModal.rating) || 5))
    const comment = String(reviewModal.comment || '').trim()
    if (comment.length < 8) {
      setError('Escreva um comentário com pelo menos 8 caracteres.')
      return
    }
    setReviewModal((p) => ({ ...p, busy: true }))
    try {
      const order = reviewModal.order
      const refs = extractReviewProductRefs(order?.order_items || [])
      const payload = {
        order_id: order.id,
        user_id: user.id,
        rating,
        comment,
        display_name: buildPublicReviewName(
          fullName || user.user_metadata?.full_name || user.user_metadata?.name
        ),
        city: city?.trim() || null,
        state: stateUF?.trim() || null,
        approved: false,
        featured: false,
        approved_at: null,
        order_total: order.total ?? null,
        product_ids: refs.productIds.length ? refs.productIds : null,
        product_slugs: refs.productSlugs.length ? refs.productSlugs : null,
        product_names: refs.productNames.length ? refs.productNames : null,
      }

      const { data, error: upErr } = await supabase
        .from('customer_reviews')
        .upsert(payload, { onConflict: 'order_id' })
        .select(
          'order_id,rating,comment,display_name,approved,featured,created_at,updated_at'
        )
        .maybeSingle()
      if (upErr) throw upErr
      setReviewsByOrder((prev) => ({
        ...prev,
        [String(order.id)]: data || payload,
      }))
      setOk('Pedido avaliado com sucesso ✅')
      setReviewModal({
        open: false,
        order: null,
        rating: 5,
        comment: '',
        busy: false,
      })
    } catch (e) {
      const msg = String(
        e?.message || e || 'Não foi possível salvar sua avaliação.'
      )
      setError(
        msg.includes('customer_reviews')
          ? 'Não foi possível salvar sua avaliação. Tente novamente.'
          : msg
      )
    } finally {
      setReviewModal((p) => ({ ...p, busy: false }))
    }
  }

  async function save(event) {
    event?.preventDefault?.()
    if (!user || !profileReady || saveLock.current) return
    saveLock.current = true
    setSaving(true)
    setError('')
    setOk('')
    try {
      if (!fullName.trim()) throw new Error('Informe seu nome.')
      if (!phone.trim()) throw new Error('Informe seu telefone.')
      if (required && !isValidCpf(cpf))
        throw new Error('Informe um CPF válido para continuar.')
      if (required && !birthdate)
        throw new Error('Informe sua data de nascimento para continuar.')
      if (cpf.trim() && !isValidCpf(cpf))
        throw new Error('CPF inválido. Confira os 11 dígitos.')
      if (!isValidCep(zip)) throw new Error('Informe um CEP válido.')
      if (!city.trim()) throw new Error('Informe sua cidade.')
      if (!/^[A-Z]{2}$/.test(stateUF.trim().toUpperCase()))
        throw new Error('Informe a UF com duas letras.')
      if (!neighborhood.trim()) throw new Error('Informe o bairro.')
      if (!street.trim()) throw new Error('Informe a rua.')
      if (!number.trim()) throw new Error('Informe o número.')
      if (hasSecondAddress && zip2.trim()) {
        if (!isValidCep(zip2))
          throw new Error('Segundo endereço: informe um CEP válido.')
        if (!city2.trim() || !stateUF2.trim() || !street2.trim())
          throw new Error('Complete cidade, UF e rua do segundo endereço.')
      }
      const avatarUrl = await uploadAvatarIfNeeded()
      const payload = {
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        cpf: onlyDigits(cpf) || null,
        birthdate: birthdate || null,
        address_line1: street.trim(),
        address_number: number.trim(),
        address_line2: addr2.trim() || null,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: stateUF.trim().toUpperCase(),
        zip: onlyDigits(zip),
        has_second_address: Boolean(hasSecondAddress),
        address2_line1: hasSecondAddress ? street2.trim() || null : null,
        address2_number: hasSecondAddress ? number2.trim() || null : null,
        address2_line2: hasSecondAddress ? addr22.trim() || null : null,
        address2_neighborhood: hasSecondAddress
          ? neighborhood2.trim() || null
          : null,
        address2_city: hasSecondAddress ? city2.trim() || null : null,
        address2_state: hasSecondAddress
          ? stateUF2.trim().toUpperCase() || null
          : null,
        address2_zip: hasSecondAddress ? onlyDigits(zip2) || null : null,
      }
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ profile: payload }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(json?.error || 'Não foi possível salvar seus dados.')
      setProfileBaseline(
        JSON.stringify({
          ...profileValues,
          avatarPreview: avatarUrl || avatarPreview,
        })
      )
      setOk('Dados salvos com sucesso.')
      window.dispatchEvent(new CustomEvent('profile:saved'))
      try {
        onSaved?.()
      } catch {}
      if (!isPage) {
        try {
          onClose?.()
        } catch {}
      }
    } catch (error) {
      setError(
        (error instanceof TypeError ? '' : error?.message) ||
          'Não foi possível salvar. Confira sua conexão e tente novamente.'
      )
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  const effectiveModalTitle = String(
    modalTitle || (activeTab === 'settings' ? 'Configurações' : 'Perfil')
  ).trim()

  const activeSection = activeTab === 'profile' ? 'profile' : settingsSection
  const sectionTitles = {
    profile: 'Dados e entrega',
    security: 'Segurança',
    favorites: 'Favoritos',
    coupons: 'Cupons',
    reviews: 'Avaliações',
  }
  function changeSection(key) {
    setError('')
    setOk('')
    if (key === 'profile') setActiveTab('profile')
    else {
      setActiveTab('settings')
      setSettingsSection(key)
    }
  }
  const addressFields = (second = false) => {
    const suffix = second ? ' do segundo endereço' : ''
    return (
      <div className="account-address-grid">
        <Field label={`CEP${suffix}`}>
          <input
            value={second ? zip2 : zip}
            onChange={(e) => (second ? setZip2 : setZip)(e.target.value)}
            autoComplete={
              second
                ? 'section-secondary postal-code'
                : 'section-primary postal-code'
            }
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
          />
        </Field>
        <Field label={`UF${suffix}`}>
          <input
            value={second ? stateUF2 : stateUF}
            onChange={(e) =>
              (second ? setStateUF2 : setStateUF)(e.target.value.toUpperCase())
            }
            autoComplete={
              second
                ? 'section-secondary address-level1'
                : 'section-primary address-level1'
            }
            maxLength={2}
            placeholder="SP"
          />
        </Field>
        <Field label={`Cidade${suffix}`}>
          <input
            value={second ? city2 : city}
            onChange={(e) => (second ? setCity2 : setCity)(e.target.value)}
            autoComplete={
              second
                ? 'section-secondary address-level2'
                : 'section-primary address-level2'
            }
          />
        </Field>
        <Field label={`Bairro${suffix}`}>
          <input
            value={second ? neighborhood2 : neighborhood}
            onChange={(e) =>
              (second ? setNeighborhood2 : setNeighborhood)(e.target.value)
            }
            autoComplete={
              second
                ? 'section-secondary address-level3'
                : 'section-primary address-level3'
            }
          />
        </Field>
        <Field label={`Rua${suffix}`} wide>
          <input
            value={second ? street2 : street}
            onChange={(e) => (second ? setStreet2 : setStreet)(e.target.value)}
            autoComplete={
              second
                ? 'section-secondary address-line1'
                : 'section-primary address-line1'
            }
          />
        </Field>
        <Field label={`Número${suffix}`}>
          <input
            value={second ? number2 : number}
            onChange={(e) => (second ? setNumber2 : setNumber)(e.target.value)}
            placeholder="123"
          />
        </Field>
        <Field label={`Complemento${suffix} (opcional)`}>
          <input
            value={second ? addr22 : addr2}
            onChange={(e) => (second ? setAddr22 : setAddr2)(e.target.value)}
            autoComplete={
              second
                ? 'section-secondary address-line2'
                : 'section-primary address-line2'
            }
            placeholder="Apartamento, bloco…"
          />
        </Field>
      </div>
    )
  }

  const inner = (
    <div
      className={`account-settings ${isPage ? 'account-settings-page' : 'account-settings-modal'}`}
    >
      {highlightTitle && (
        <div className="account-highlight">
          <strong>{highlightTitle}</strong>
          {highlightMessage && <p>{highlightMessage}</p>}
        </div>
      )}
      {!user ? (
        <div className="account-section">
          <h2>Entre para continuar</h2>
          <p>Acesse sua conta para editar seus dados.</p>
          <button
            type="button"
            className="customer-primary"
            onClick={() =>
              onRequireLogin?.('Faça login para editar seus dados.')
            }
          >
            Entrar / Criar conta
          </button>
        </div>
      ) : (
        <>
          <header className="account-summary">
            <div className="account-avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Foto de perfil" />
              ) : (
                <span className="material-icons" aria-hidden="true">
                  person
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="customer-eyebrow">Sua conta Cubo</p>
              <h2>
                {fullName ||
                  user.user_metadata?.full_name ||
                  'Bem-vindo à sua conta'}
              </h2>
              <p className="account-email">{user.email}</p>
            </div>
            {isVip && (
              <button
                type="button"
                className="account-vip-link"
                onClick={() => go('/area-vip')}
              >
                <span className="material-icons" aria-hidden="true">
                  workspace_premium
                </span>
                VIP ativo
                <span className="material-icons" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            )}
          </header>
          <div className="account-layout">
            <AccountSettingsTabs
              active={activeSection}
              onChange={changeSection}
            />
            <section
              className="account-panel"
              role="tabpanel"
              id={`account-panel-${activeSection}`}
              aria-labelledby={`account-tab-${activeSection}`}
            >
              {loadError && (
                <div className="customer-alert" role="alert">
                  <p>{loadError}</p>
                  <button
                    type="button"
                    className="customer-secondary"
                    onClick={loadProfile}
                    disabled={loading}
                  >
                    Carregar novamente
                  </button>
                </div>
              )}
              {activeSection === 'profile' ? (
                <form onSubmit={save} noValidate>
                  <fieldset
                    disabled={saving || loading || !profileReady}
                    className="account-form-fields"
                  >
                    <section
                      className="account-section"
                      aria-labelledby="account-personal-title"
                    >
                      <div className="account-section-heading">
                        <div>
                          <h3 id="account-personal-title">Dados pessoais</h3>
                          <p>
                            Seu cadastro para acompanhar compras e receber sua
                            coleção.
                          </p>
                        </div>
                        <label className="account-upload">
                          <span className="material-icons" aria-hidden="true">
                            photo_camera
                          </span>
                          Alterar foto
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFile}
                          />
                        </label>
                      </div>
                      {avatarFileName && (
                        <p className="account-help">
                          Foto selecionada: {avatarFileName}
                        </p>
                      )}
                      <div className="account-form-grid">
                        <Field label="Nome completo">
                          <input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                            placeholder="Seu nome completo"
                          />
                        </Field>
                        <Field label="Telefone (WhatsApp)">
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            type="tel"
                            autoComplete="tel"
                            placeholder="(11) 99999-9999"
                          />
                        </Field>
                        <Field label="CPF">
                          <input
                            value={cpf}
                            onChange={(e) => setCpf(e.target.value)}
                            inputMode="numeric"
                            maxLength={14}
                            placeholder="000.000.000-00"
                          />
                        </Field>
                        <Field label="Data de nascimento">
                          <input
                            value={birthdate}
                            onChange={(e) => setBirthdate(e.target.value)}
                            type="date"
                            autoComplete="bday"
                          />
                        </Field>
                      </div>
                      <p className="account-help">
                        CPF e data de nascimento são necessários para concluir
                        compras.
                      </p>
                    </section>
                    <section
                      className="account-section"
                      aria-labelledby="account-address-title"
                    >
                      <div className="account-section-heading">
                        <div>
                          <h3 id="account-address-title">
                            Endereço de entrega
                          </h3>
                          <p>
                            Confira os dados para sua encomenda chegar ao lugar
                            certo.
                          </p>
                        </div>
                        <span className="material-icons" aria-hidden="true">
                          local_shipping
                        </span>
                      </div>
                      {addressFields()}
                      {(cepBusy || cepHint) && (
                        <p className="account-help" role="status">
                          {cepBusy ? 'Consultando CEP…' : cepHint}
                        </p>
                      )}
                    </section>
                    <section className="account-section">
                      <label className="account-switch">
                        <input
                          type="checkbox"
                          checked={hasSecondAddress}
                          onChange={(e) =>
                            setHasSecondAddress(e.target.checked)
                          }
                        />
                        <span>
                          <strong>Adicionar segundo endereço</strong>
                          <small>Guarde também um endereço alternativo.</small>
                        </span>
                      </label>
                      {hasSecondAddress && (
                        <div className="mt-4">{addressFields(true)}</div>
                      )}
                    </section>
                  </fieldset>
                  <div className="account-save-bar">
                    <div>
                      <strong>
                        {loading
                          ? 'Carregando seus dados…'
                          : profileDirty
                            ? 'Alterações não salvas'
                            : 'Seu cadastro'}
                      </strong>
                      <span>
                        {profileDirty
                          ? 'Salve para atualizar sua conta.'
                          : 'Dados pessoais e endereço de entrega.'}
                      </span>
                    </div>
                    <div className="account-save-actions">
                      {profileDirty && (
                        <button
                          type="button"
                          className="customer-secondary"
                          onClick={loadProfile}
                          disabled={saving || loading}
                        >
                          Descartar
                        </button>
                      )}
                      <button
                        type="submit"
                        className="customer-primary"
                        disabled={
                          saving ||
                          loading ||
                          !profileReady ||
                          (!profileDirty && !required)
                        }
                      >
                        {saving ? 'Salvando…' : 'Salvar perfil'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="account-section-heading">
                    <div>
                      <h3>{sectionTitles[activeSection]}</h3>
                      <p>
                        {activeSection === 'security'
                          ? securityIntro
                          : activeSection === 'favorites'
                            ? 'Suas peças favoritas, sempre por perto.'
                            : activeSection === 'coupons'
                              ? 'Seus cupons disponíveis para usar no carrinho.'
                              : 'Conte como foi receber sua encomenda.'}
                      </p>
                    </div>
                    {activeSection !== 'security' && (
                      <button
                        type="button"
                        className="customer-secondary"
                        onClick={() => {
                          if (activeSection === 'favorites') reloadFavorites()
                          else if (activeSection === 'coupons') loadMyCoupons()
                          else loadDeliveredOrdersForReviews()
                        }}
                      >
                        Atualizar
                      </button>
                    )}
                  </div>
                  {sectionErrors[activeSection] && (
                    <div role="alert" className="customer-alert">
                      {sectionErrors[activeSection]}
                    </div>
                  )}
                  {activeSection === 'security' && (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          savePassword()
                        }}
                        className="account-section"
                      >
                        <h4>{securityActionLabel}</h4>
                        {isRecoveryMode && (
                          <div className="account-highlight">
                            <strong>Defina sua nova senha</strong>
                            <p>
                              Seu link de recuperação foi reconhecido. Conclua a
                              alteração abaixo.
                            </p>
                          </div>
                        )}
                        <fieldset
                          disabled={pwdBusy}
                          className="account-form-fields"
                        >
                          <div className="account-form-grid">
                            {shouldRequireCurrentPassword && (
                              <Field label="Senha atual" wide>
                                <PasswordInput
                                  value={currentPassword}
                                  onChange={(e) =>
                                    setCurrentPassword(e.target.value)
                                  }
                                  placeholder="Sua senha atual"
                                />
                              </Field>
                            )}
                            <Field
                              label={
                                shouldRequireCurrentPassword
                                  ? 'Nova senha'
                                  : 'Crie sua senha'
                              }
                            >
                              <PasswordInput
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                placeholder="Mínimo 6 caracteres"
                              />
                            </Field>
                            <Field
                              label={
                                shouldRequireCurrentPassword
                                  ? 'Confirmar nova senha'
                                  : 'Confirmar senha'
                              }
                            >
                              <PasswordInput
                                value={newPassword2}
                                onChange={(e) =>
                                  setNewPassword2(e.target.value)
                                }
                                autoComplete="new-password"
                                placeholder="Repita a senha"
                              />
                            </Field>
                          </div>
                        </fieldset>
                        <p className="account-help" aria-live="polite">
                          {newPassword2
                            ? newPassword === newPassword2
                              ? 'As senhas coincidem.'
                              : 'As senhas ainda não coincidem.'
                            : 'Use pelo menos 6 caracteres.'}
                        </p>
                        <div className="account-inline-actions">
                          <button
                            type="submit"
                            className="customer-primary"
                            disabled={pwdBusy || resetBusy}
                          >
                            {pwdBusy ? 'Salvando…' : securityActionLabel}
                          </button>
                          <button
                            type="button"
                            className="customer-secondary"
                            onClick={sendPasswordResetLink}
                            disabled={resetBusy || pwdBusy}
                          >
                            {resetBusy
                              ? 'Enviando…'
                              : 'Enviar link de recuperação'}
                          </button>
                        </div>
                      </form>
                      <section className="account-section account-session">
                        <div>
                          <h4>Sessão atual</h4>
                          <p>{user.email}</p>
                        </div>
                        <button
                          type="button"
                          className="customer-secondary"
                          onClick={() => onSignOut?.()}
                        >
                          Sair da conta
                        </button>
                      </section>
                      <details className="account-danger">
                        <summary>Excluir minha conta</summary>
                        <p>
                          A exclusão é permanente. Você perderá acesso à conta,
                          cupons e favoritos.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteAccountModal({
                              open: true,
                              password: '',
                              confirm: false,
                              error: '',
                            })
                          }}
                          className="account-danger-button"
                        >
                          Solicitar exclusão da conta
                        </button>
                      </details>
                    </>
                  )}
                  {activeSection === 'favorites' && (
                    <div className="account-list">
                      {favBusy ? (
                        <p role="status" className="account-empty">
                          Carregando favoritos…
                        </p>
                      ) : favProducts.length ? (
                        favProducts.map((product) => (
                          <article
                            key={product.id}
                            className="account-list-item account-favorite"
                          >
                            <img
                              src={product.img}
                              alt={product.nome}
                              loading="lazy"
                            />
                            <div className="min-w-0">
                              <h4>{product.nome}</h4>
                              <p>{product.descricao}</p>
                              <div className="account-inline-actions">
                                <button
                                  type="button"
                                  className="customer-secondary"
                                  onClick={() => {
                                    const slug = String(
                                      product.slug || ''
                                    ).trim()
                                    go(
                                      slug
                                        ? `/p/${encodeURIComponent(slug)}`
                                        : `/estoque?product=${encodeURIComponent(product.id)}&open=1`
                                    )
                                    maybeClose()
                                  }}
                                >
                                  Ver produto
                                </button>
                                <button
                                  type="button"
                                  className="customer-icon-button"
                                  aria-label={`Remover ${product.nome} dos favoritos`}
                                  onClick={() => toggleFavorite(product.id)}
                                >
                                  <span
                                    className="material-icons"
                                    aria-hidden="true"
                                  >
                                    favorite
                                  </span>
                                </button>
                              </div>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="account-empty">
                          <span className="material-icons" aria-hidden="true">
                            favorite_border
                          </span>
                          <h4>Sua lista começa com uma peça especial</h4>
                          <p>
                            Toque no coração dos produtos para encontrá-los
                            aqui.
                          </p>
                          <button
                            type="button"
                            className="customer-secondary"
                            onClick={() => go('/catalogo')}
                          >
                            Explorar catálogo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {activeSection === 'coupons' && (
                    <div className="account-list">
                      {couponBusy ? (
                        <p role="status" className="account-empty">
                          Carregando cupons…
                        </p>
                      ) : myCoupons.length ? (
                        myCoupons.map((coupon) => (
                          <article key={coupon.code} className="account-coupon">
                            <div>
                              <h4>{coupon.label || 'Cupom de desconto'}</h4>
                              <code>{coupon.code}</code>
                              <p>
                                {coupon.expires_at
                                  ? `Válido até ${new Date(coupon.expires_at).toLocaleDateString('pt-BR')}`
                                  : 'Disponível para sua próxima compra'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="customer-secondary"
                              aria-label={`Copiar cupom ${coupon.code}`}
                              onClick={async () => {
                                const copied = await copyText(coupon.code)
                                setOk(
                                  copied
                                    ? 'Cupom copiado.'
                                    : 'Selecione o código para copiar manualmente.'
                                )
                              }}
                            >
                              Copiar
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className="account-empty">
                          <span className="material-icons" aria-hidden="true">
                            confirmation_number
                          </span>
                          <h4>Nenhum cupom disponível</h4>
                          <p>
                            Jogue o Cubo Game para tentar conquistar uma
                            recompensa.
                          </p>
                          <button
                            type="button"
                            className="customer-secondary"
                            onClick={() => go('/cupom')}
                          >
                            Ir para Cubo Game
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {activeSection === 'reviews' && (
                    <div className="account-list">
                      {reviewsBusy ? (
                        <p role="status" className="account-empty">
                          Carregando compras…
                        </p>
                      ) : deliveredOrders.length ? (
                        deliveredOrders.map((order) => {
                          const review = reviewsByOrder[String(order.id)]
                          return (
                            <article
                              key={order.id}
                              className="account-list-item"
                            >
                              <div className="min-w-0">
                                <h4>Pedido #{String(order.id).slice(0, 8)}</h4>
                                <p>
                                  {order.created_at
                                    ? new Date(
                                        order.created_at
                                      ).toLocaleDateString('pt-BR')
                                    : ''}
                                </p>
                                <p>
                                  {(order.order_items || [])
                                    .map(
                                      (item) => item.product_name || item.name
                                    )
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                                {review && (
                                  <>
                                    <span
                                      className="account-stars"
                                      aria-label={`Nota ${review.rating} de 5`}
                                    >
                                      {'★'.repeat(
                                        Math.max(
                                          1,
                                          Math.min(
                                            5,
                                            Number(review.rating) || 1
                                          )
                                        )
                                      )}
                                    </span>
                                    <p>{review.comment}</p>
                                    <span className="account-help">
                                      Avaliado
                                    </span>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                className="customer-secondary"
                                onClick={() => {
                                  setError('')
                                  setOk('')
                                  setReviewModal({
                                    open: true,
                                    order,
                                    rating: Number(review?.rating) || 5,
                                    comment: String(review?.comment || ''),
                                    busy: false,
                                  })
                                }}
                              >
                                {review ? 'Editar avaliação' : 'Avaliar pedido'}
                              </button>
                            </article>
                          )
                        })
                      ) : (
                        <div className="account-empty">
                          <span className="material-icons" aria-hidden="true">
                            star_outline
                          </span>
                          <h4>Suas avaliações aparecem aqui</h4>
                          <p>
                            Assim que um pedido for entregue, você poderá
                            avaliar sua experiência.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {error && <FloatingNotice tone="error" message={error} />}
              {ok && <FloatingNotice message={ok} />}
            </section>
          </div>
        </>
      )}
    </div>
  )

  const deleteAccountModalEl = (
    <Modal
      open={!!deleteAccountModal.open}
      onClose={closeDeleteAccountModal}
      title="Excluir conta"
      busy={deleteBusy}
      zIndexClass="z-[260]"
      widthClass="w-[94vw] sm:w-[560px]"
      maxWidth="max-w-[560px]"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-400/20 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30">
              <span className="material-icons">warning</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-100">
                Esta ação é permanente
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                Sua conta será excluída definitivamente. Você perderá acesso ao
                login, favoritos, cupons e preferências salvas. Registros
                necessários para pedidos e obrigações legais podem continuar
                armazenados internamente quando exigido.
              </p>
            </div>
          </div>
        </div>

        <Field label="Digite sua senha para confirmar">
          <PasswordInput
            value={deleteAccountModal.password}
            onChange={(e) =>
              updateDeleteAccountModal({ password: e.target.value, error: '' })
            }
            autoComplete="current-password"
            className="w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 pr-12 outline-none focus:ring-rose-400/60"
            buttonClassName="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-rose-100/80 transition hover:text-rose-50"
            placeholder="Sua senha atual"
          />
        </Field>

        {deleteAccountModal.error ? (
          <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-transparent p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-200 ring-1 ring-amber-400/30">
                <span className="material-icons">priority_high</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  Não foi possível excluir a conta
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-200">
                  {deleteAccountModal.error}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl bg-white/4 p-3 ring-1 ring-white/10">
          <input
            type="checkbox"
            checked={!!deleteAccountModal.confirm}
            onChange={(e) =>
              updateDeleteAccountModal({ confirm: e.target.checked, error: '' })
            }
            className="mt-1 h-4 w-4 rounded border-white/20 bg-[#07161d]"
          />
          <span className="text-sm leading-6 text-slate-200">
            Entendo que essa exclusão é permanente e desejo remover minha conta
            agora.
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeDeleteAccountModal}
            disabled={deleteBusy}
            className="rounded-xl px-4 py-3 ring-1 ring-white/10 hover:bg-white/4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={
              deleteBusy ||
              !deleteAccountModal.password ||
              !deleteAccountModal.confirm
            }
            className="rounded-xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-500/60"
          >
            {deleteBusy ? 'Excluindo conta…' : 'Excluir conta permanentemente'}
          </button>
        </div>
      </div>
    </Modal>
  )

  const reviewModalEl = (
    <Modal
      open={!!reviewModal.open}
      onClose={
        reviewModal.busy
          ? undefined
          : () =>
              setReviewModal({
                open: false,
                order: null,
                rating: 5,
                comment: '',
                busy: false,
              })
      }
      title="Avaliar compra"
      busy={reviewModal.busy}
      zIndexClass="z-[260]"
    >
      {reviewModal.open && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
            <p className="text-sm font-semibold text-slate-100">
              Sua avaliação
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Conte como foi sua experiência. Isso ajuda outras pessoas.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nota (1 a 5)">
                <select
                  value={reviewModal.rating}
                  onChange={(e) =>
                    setReviewModal((p) => ({
                      ...p,
                      rating: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pedido">
                <input
                  readOnly
                  value={
                    reviewModal?.order?.created_at
                      ? new Date(reviewModal.order.created_at).toLocaleString(
                          'pt-BR'
                        )
                      : ''
                  }
                  className="w-full rounded-xl bg-[#0c2430]/52 ring-1 ring-white/10 px-4 py-3 outline-none text-slate-300"
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Comentário">
                <textarea
                  value={reviewModal.comment}
                  onChange={(e) =>
                    setReviewModal((p) => ({ ...p, comment: e.target.value }))
                  }
                  rows={5}
                  className="w-full rounded-xl bg-[#0c2430]/68 ring-1 ring-white/10 px-4 py-3 outline-none focus:ring-cyan-400/60"
                  placeholder="Ex.: Chegou bem embalado, pintura impecável, envio rápido..."
                />
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() =>
                  setReviewModal({
                    open: false,
                    order: null,
                    rating: 5,
                    comment: '',
                    busy: false,
                  })
                }
                className="rounded-xl px-4 py-2 ring-1 ring-white/10 hover:bg-white/4"
              >
                Cancelar
              </button>
              <button
                onClick={submitReview}
                disabled={reviewModal.busy}
                className={`rounded-xl px-4 py-2 font-semibold ring-4 ring-indigo-400/20 ${reviewModal.busy ? 'bg-[#12303b]/55 text-slate-300' : 'bg-cyan-500 hover:bg-cyan-400 text-black'}`}
              >
                {reviewModal.busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )

  if (isPage) {
    if (!open) return null
    return (
      <>
        {inner}
        {deleteAccountModalEl}
        {reviewModalEl}
      </>
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={effectiveModalTitle}
        busy={saving || pwdBusy || deleteBusy}
        zIndexClass="z-[230]"
        mobileLayout="fullscreen"
        widthClass="w-[96vw] sm:w-[92vw] lg:w-[70vw]"
        panelClassName="max-h-[100dvh] sm:max-h-[92vh] rounded-t-[26px] sm:rounded-2xl"
        bodyClassName="p-0 sm:p-4"
      >
        {inner}
      </Modal>
      {deleteAccountModalEl}
      {reviewModalEl}
    </>
  )
}
