import React from 'react'
import './admin-shipping.css'

const STANDARD_BOXES = {
  miniature_small: { length: 13, width: 11, height: 10, weight: 0.3 },
  miniature_large: { length: 20, width: 20, height: 20, weight: 1 },
  action_10: { length: 20, width: 20, height: 20, weight: 1 },
  action_12: { length: 20, width: 20, height: 20, weight: 1 },
  action_15: { length: 20, width: 20, height: 20, weight: 2 },
  action_20: { length: 30, width: 20, height: 20, weight: 2 },
  bust: { length: 20, width: 20, height: 20, weight: 1 },
  vip_1: { length: 20, width: 20, height: 20, weight: 0.3 },
  vip_2_3: { length: 30, width: 20, height: 20, weight: 1 },
}
const BASE_LABELS = {
  miniature_small: 'Miniaturas — caixa pequena (1 a 2)',
  miniature_large: 'Miniaturas — caixa grande (3 a 10)',
  action_10: 'Action figure — 10 cm',
  action_12: 'Action figure — 12 cm',
  action_15: 'Action figure — 15 cm',
  action_20: 'Action figure — 20 cm',
  bust: 'Busto personalizado',
  vip_1: 'Assinatura — nível 1',
  vip_2_3: 'Assinaturas — níveis 2 e 3',
}
const START_RULES = [
  { id: 'action_10cm', kind: 'action', scale: '10 cm', package_key: 'action_10' },
  { id: 'action_12cm', kind: 'action', scale: '12 cm', package_key: 'action_12' },
  { id: 'action_15cm', kind: 'action', scale: '15 cm', package_key: 'action_15' },
  { id: 'action_20cm', kind: 'action', scale: '20 cm', package_key: 'action_20' },
  { id: 'miniature_32mm', kind: 'miniature', scale: '32 mm', small_package_key: 'miniature_small', large_package_key: 'miniature_large', small_limit: 2, large_limit: 10 },
]
const SERVICES = [
  { id: '1', name: 'PAC', carrier: 'Correios' },
  { id: '2', name: 'SEDEX', carrier: 'Correios' },
  { id: '17', name: 'Mini Envios', carrier: 'Correios' },
  { id: '3', name: 'Jadlog', carrier: 'Jadlog' },
  { id: '31', name: 'Loggi', carrier: 'Loggi' },
]
const BRL = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const moneyInput = cents => (Number(cents || 0) / 100).toFixed(2)
const newBoxId = () => `box_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const newScaleId = () => `scale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const prettyMeasure = data => `${Number(data?.length || 0)} × ${Number(data?.width || 0)} × ${Number(data?.height || 0)} cm · até ${Number(data?.weight || 0)} kg`

function InfoHeader({ symbol, title, children }) {
  return <div className="as-title"><span className="material-icons" aria-hidden="true">{symbol}</span><div><h3>{title}</h3>{children && <p>{children}</p>}</div></div>
}

export default function AdminShippingSection({ accessToken }) {
  const [settings, setSettings] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [section, setSection] = React.useState('scales')
  const [feeInputs, setFeeInputs] = React.useState({ mini: '5.00', other: '10.00' })
  const [boxName, setBoxName] = React.useState('')
  const [scaleDraft, setScaleDraft] = React.useState({ kind: 'action', amount: '' })
  const [addingScale, setAddingScale] = React.useState(false)
  const [addingBox, setAddingBox] = React.useState(false)

  const hydrate = React.useCallback(raw => {
    setSettings({
      ...raw,
      packages: { ...STANDARD_BOXES, ...(raw.packages || {}) },
      package_labels: raw.package_labels || {},
      scale_rules: Array.isArray(raw.scale_rules) ? raw.scale_rules : START_RULES,
    })
    setFeeInputs({ mini: moneyInput(raw.mini_fee_cents), other: moneyInput(raw.other_fee_cents) })
  }, [])
  const load = React.useCallback(async () => {
    if (!accessToken) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/shipping?op=config', { headers: { Authorization: `Bearer ${accessToken}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as configurações.')
      hydrate(data.settings)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }, [accessToken, hydrate])
  React.useEffect(() => { void load() }, [load])
  const update = (key, value) => { setNotice(''); setSettings(old => ({ ...old, [key]: value })) }
  const updateRule = (id, changes) => update('scale_rules', settings.scale_rules.map(rule => rule.id === id ? { ...rule, ...changes } : rule))
  const changeBox = (key, prop, value) => update('packages', { ...settings.packages, [key]: { ...settings.packages[key], [prop]: value } })
  const labels = { ...BASE_LABELS, ...(settings?.package_labels || {}) }
  const boxKeys = Object.keys(settings?.packages || {})
  const getBoxLabel = key => labels[key] || key
  const selectBoxes = (value, onChange, description) => <label className="as-field"><span>{description}</span><select value={value || ''} onChange={event => onChange(event.target.value)}>{boxKeys.map(key => <option key={key} value={key}>{getBoxLabel(key)} — {prettyMeasure(settings.packages[key])}</option>)}</select></label>

  function addBox() {
    const name = boxName.trim()
    if (name.length < 3 || name.length > 80) { setError('Digite um nome para a nova caixa (3 a 80 caracteres).'); return }
    const key = newBoxId()
    update('packages', { ...settings.packages, [key]: { length: 20, width: 20, height: 20, weight: 1 } })
    setSettings(old => ({ ...old, package_labels: { ...old.package_labels, [key]: name } }))
    setBoxName(''); setAddingBox(false); setError(''); setSection('boxes')
  }
  function removeBox(key) {
    if (Object.hasOwn(STANDARD_BOXES, key)) return
    const usedBy = settings.scale_rules.find(rule => [rule.package_key, rule.small_package_key, rule.large_package_key].includes(key))
    if (usedBy) { setError(`A caixa está vinculada à escala ${usedBy.scale}. Troque esse vínculo antes de excluir.`); return }
    const nextPackages = { ...settings.packages }; delete nextPackages[key]
    const nextLabels = { ...settings.package_labels }; delete nextLabels[key]
    setSettings(old => ({ ...old, packages: nextPackages, package_labels: nextLabels }))
    setError(''); setNotice('Caixa removida da edição. Clique em Salvar para confirmar.')
  }
  function addScale() {
    const number = Number(String(scaleDraft.amount).replace(',', '.'))
    if (!Number.isFinite(number) || number <= 0 || number > 300 || !/^\d+(?:[.,]\d{1,2})?$/.test(String(scaleDraft.amount).trim())) {
      setError('Informe um tamanho válido, por exemplo 25 (cm) ou 28 (mm).'); return
    }
    const kind = scaleDraft.kind
    const scale = `${number} ${kind === 'action' ? 'cm' : 'mm'}`
    if (settings.scale_rules.some(rule => rule.kind === kind && rule.scale === scale)) { setError(`A escala ${scale} já está cadastrada.`); return }
    if (settings.scale_rules.length >= 80) { setError('Limite de 80 escalas atingido.'); return }
    const rule = kind === 'action'
      ? { id: newScaleId(), kind, scale, package_key: 'action_10' }
      : { id: newScaleId(), kind, scale, small_package_key: 'miniature_small', large_package_key: 'miniature_large', small_limit: 2, large_limit: 10 }
    update('scale_rules', [...settings.scale_rules, rule])
    setScaleDraft({ kind: 'action', amount: '' }); setAddingScale(false); setError('')
    setNotice(`Escala ${scale} adicionada. Escolha a caixa e salve as configurações.`)
  }
  const services = String(settings?.services || '').split(',').map(s => s.trim()).filter(Boolean)
  function toggleService(code, checked) {
    const next = new Set(services)
    if (checked) next.add(code)
    else next.delete(code)
    update('services', [...next].join(','))
  }
  function parseFee(value) {
    const text = String(value || '').trim().replace(',', '.')
    const number = Number(text)
    if (!text || !Number.isFinite(number) || number < 0 || number > 1000) throw new Error('Os acréscimos devem estar entre R$ 0,00 e R$ 1.000,00 por pedido.')
    return Math.round(number * 100)
  }
  async function save(event) {
    event.preventDefault()
    if (!settings) return
    setSaving(true); setError(''); setNotice('')
    try {
      if (!services.length) throw new Error('Habilite pelo menos uma modalidade de transporte.')
      const response = await fetch('/api/shipping?op=config', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_zip: settings.origin_zip, enabled: settings.enabled !== false,
          services: settings.services, mini_fee_cents: parseFee(feeInputs.mini),
          other_fee_cents: parseFee(feeInputs.other), packages: settings.packages,
          package_labels: settings.package_labels, scale_rules: settings.scale_rules,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Falha ao salvar as configurações.')
      hydrate(result.settings)
      setNotice('Tudo salvo! As próximas cotações e compras usarão essas configurações.')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return <main className="as-root">
    <header className="as-top">
      <div className="as-top-icon"><span className="material-icons" aria-hidden="true">local_shipping</span></div>
      <div><div className="as-eyebrow">LOGÍSTICA DA LOJA</div><h2>Frete e embalagens</h2><p>Configure escalas, caixas, acréscimos e transportadoras sem alterar o código do site.</p></div>
    </header>
    {busy && <p className="as-feedback" role="status">Carregando configurações…</p>}
    {error && <div className="as-feedback as-error" role="alert"><span className="material-icons">error_outline</span>{error}<button type="button" onClick={() => setError('')} aria-label="Fechar erro">×</button></div>}
    {notice && <div className="as-feedback as-success" role="status"><span className="material-icons">check_circle</span>{notice}</div>}
    {settings && <form onSubmit={save}>
      <nav className="as-tabs" aria-label="Seções de frete">
        {[['scales', 'straighten', 'Escalas'], ['boxes', 'inventory_2', 'Caixas e pesos'], ['rates', 'tune', 'Taxas e serviços']].map(([id, icon, label]) => <button key={id} type="button" className={section === id ? 'active' : ''} onClick={() => { setSection(id); setError(''); setNotice('') }} aria-current={section === id ? 'page' : undefined}><span className="material-icons" aria-hidden="true">{icon}</span>{label}</button>)}
      </nav>
      {section === 'scales' && <section className="as-panel">
        <div className="as-panel-bar"><InfoHeader symbol="straighten" title="Escalas cadastradas">Associe cada tamanho à embalagem apropriada. A escolha do cliente no catálogo define qual regra será usada.</InfoHeader><button type="button" className="as-add" onClick={() => setAddingScale(old => !old)}><span className="material-icons">add</span>Nova escala</button></div>
        {addingScale && <div className="as-new"><strong>Adicionar tamanho</strong><div className="as-new-fields"><label className="as-field"><span>Tipo de produto</span><select value={scaleDraft.kind} onChange={event => setScaleDraft({ ...scaleDraft, kind: event.target.value })}><option value="action">Action figure</option><option value="miniature">Miniatura RPG</option></select></label><label className="as-field"><span>Tamanho ({scaleDraft.kind === 'action' ? 'cm' : 'mm'})</span><input type="text" inputMode="decimal" placeholder={scaleDraft.kind === 'action' ? 'Ex.: 25' : 'Ex.: 28'} value={scaleDraft.amount} onChange={event => setScaleDraft({ ...scaleDraft, amount: event.target.value })} /></label><button type="button" className="as-add" onClick={addScale}>Adicionar</button><button type="button" className="as-cancel" onClick={() => setAddingScale(false)}>Cancelar</button></div></div>}
        {['action', 'miniature'].map(kind => <div key={kind} className="as-scale-block"><h4>{kind === 'action' ? 'Action figures' : 'Miniaturas RPG'} <span>{settings.scale_rules.filter(rule => rule.kind === kind).length}</span></h4><div className="as-scale-grid">{settings.scale_rules.filter(rule => rule.kind === kind).map(rule => <article key={rule.id} className="as-scale-card"><div className="as-card-heading"><div><small>{kind === 'action' ? 'AÇÃO INDIVIDUAL' : 'AGRUPAMENTO POR ESCALA'}</small><h5>{rule.scale}</h5></div>{!START_RULES.some(base => base.id === rule.id) && <button type="button" className="as-delete" onClick={() => { update('scale_rules', settings.scale_rules.filter(row => row.id !== rule.id)); setNotice(`Escala ${rule.scale} removida da edição. Salve para confirmar.`) }} title={`Excluir escala ${rule.scale}`} aria-label={`Excluir escala ${rule.scale}`}><span className="material-icons">delete_outline</span></button>}</div>{kind === 'action' ? <>{selectBoxes(rule.package_key, value => updateRule(rule.id, { package_key: value }), 'Embalagem de cada figure')}<p className="as-hint">Uma caixa por action figure comprada.</p></> : <><div className="as-two-col">{selectBoxes(rule.small_package_key, value => updateRule(rule.id, { small_package_key: value }), 'Caixa para poucos itens')}{selectBoxes(rule.large_package_key, value => updateRule(rule.id, { large_package_key: value }), 'Caixa para vários itens')}</div><div className="as-two-col"><label className="as-field"><span>Até quantas unidades na caixa menor?</span><input type="number" min="1" max="20" required value={rule.small_limit} onChange={event => updateRule(rule.id, { small_limit: event.target.value })}/></label><label className="as-field"><span>Até quantas unidades na caixa maior?</span><input type="number" min="2" max="100" required value={rule.large_limit} onChange={event => updateRule(rule.id, { large_limit: event.target.value })}/></label></div><p className="as-hint">Acima do limite, o sistema divide em novas caixas automaticamente.</p></>}</article>)}{!settings.scale_rules.some(rule => rule.kind === kind) && <p className="as-hint">Nenhuma escala nesta categoria. Clique em “Nova escala” para adicionar.</p>}</div></div>)}
      </section>}
      {section === 'boxes' && <section className="as-panel">
        <div className="as-panel-bar"><InfoHeader symbol="inventory_2" title="Modelos de caixas">Edite medidas e peso de embalagens existentes ou crie caixas novas para associar às escalas.</InfoHeader><button type="button" className="as-add" onClick={() => setAddingBox(old => !old)}><span className="material-icons">add</span>Nova caixa</button></div>
        {addingBox && <div className="as-new"><strong>Nova embalagem</strong><div className="as-new-fields"><label className="as-field"><span>Nome da embalagem</span><input placeholder="Ex.: Caixa para figure de 25 cm" value={boxName} maxLength={80} onChange={event => setBoxName(event.target.value)} /></label><button type="button" className="as-add" onClick={addBox}>Adicionar</button><button type="button" className="as-cancel" onClick={() => setAddingBox(false)}>Cancelar</button></div></div>}
        <p className="as-tip"><span className="material-icons">info</span>Use as dimensões externas da caixa pronta e o peso máximo do pacote já com proteção. Todas as medidas são em centímetros; o peso é em quilogramas.</p>
        <div className="as-box-grid">{boxKeys.map(key => <article className="as-box-card" key={key}><div className="as-card-heading"><div><small>{Object.hasOwn(STANDARD_BOXES, key) ? 'EMBALAGEM PADRÃO' : 'EMBALAGEM PERSONALIZADA'}</small><h5>{getBoxLabel(key)}</h5></div>{!Object.hasOwn(STANDARD_BOXES, key) && <button type="button" className="as-delete" onClick={() => removeBox(key)} title="Excluir caixa" aria-label={`Excluir caixa ${getBoxLabel(key)}`}><span className="material-icons">delete_outline</span></button>}</div><label className="as-field"><span>Nome de identificação</span><input value={getBoxLabel(key)} maxLength={80} onChange={event => update('package_labels', { ...settings.package_labels, [key]: event.target.value })}/></label><div className="as-measure-grid">{[['length', 'Comprimento'], ['width', 'Largura'], ['height', 'Altura'], ['weight', 'Peso (kg)']].map(([prop, caption]) => <label className="as-field" key={prop}><span>{caption}</span><input required type="number" min="0.01" max={prop === 'weight' ? 30 : 100} step="0.01" value={settings.packages[key]?.[prop] ?? ''} onChange={event => changeBox(key, prop, event.target.value)}/></label>)}</div></article>)}</div>
      </section>}
      {section === 'rates' && <section className="as-panel">
        <InfoHeader symbol="payments" title="Acréscimos e origem">A taxa de embalagem é cobrada apenas uma vez por pedido, mesmo que ele tenha várias caixas.</InfoHeader>
        <div className="as-rate-grid"><label className="as-field"><span>CEP da loja</span><input value={settings.origin_zip || ''} inputMode="numeric" maxLength={9} required onChange={event => update('origin_zip', event.target.value)} placeholder="00000-000"/></label><label className="as-field"><span>Acréscimo — miniaturas comuns (R$)</span><input type="number" min="0" max="1000" step="0.01" required value={feeInputs.mini} onChange={event => setFeeInputs(old => ({ ...old, mini: event.target.value }))}/></label><label className="as-field"><span>Acréscimo — figures, personalizadas e assinaturas (R$)</span><input type="number" min="0" max="1000" step="0.01" required value={feeInputs.other} onChange={event => setFeeInputs(old => ({ ...old, other: event.target.value }))}/></label></div>
        <div className="as-divider"/>
        <InfoHeader symbol="local_shipping" title="Transportadoras e modalidades">Ative os serviços que deseja consultar. Só aparecerão para o cliente as opções retornadas pela SuperFrete.</InfoHeader>
        <div className="as-carriers">{SERVICES.map(service => <label key={service.id} className="as-service"><input type="checkbox" checked={services.includes(service.id)} onChange={event => toggleService(service.id, event.target.checked)}/><span className="as-check"><span className="material-icons">check</span></span><span><strong>{service.name}</strong><small>{service.carrier}</small></span></label>)}</div>
        <div className="as-carrier-note"><span className="material-icons">info_outline</span><p><strong>Jadlog e Loggi:</strong> além de selecionar aqui, habilite as transportadoras na integração da sua conta SuperFrete e configure um ponto de postagem. A disponibilidade depende do CEP e do acesso liberado pela transportadora. Se a API rejeitar algum serviço, desmarque-o e consulte o suporte da SuperFrete.</p></div>
        <label className="as-active"><input type="checkbox" checked={settings.enabled !== false} onChange={event => update('enabled', event.target.checked)}/> <span>Habilitar o cálculo de frete na loja</span></label>
        <div className="as-preview"><span>Total de acréscimo por pedido</span><strong>{BRL(parseFloat(feeInputs.mini) || 0)} / {BRL(parseFloat(feeInputs.other) || 0)}</strong><small>Miniaturas comuns / demais categorias</small></div>
      </section>}
      <footer className="as-footer"><p><span className="material-icons">security</span> Preços recalculados no servidor na hora da compra.</p><button className="as-save" type="submit" disabled={saving || busy}><span className="material-icons" aria-hidden="true">save</span>{saving ? 'Salvando alterações…' : 'Salvar configurações'}</button></footer>
    </form>}
  </main>
}
