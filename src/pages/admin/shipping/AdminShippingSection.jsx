import React from 'react'
import '../../../components/shipping-selector.css'

const labels = {
  miniature_small: 'Miniaturas 32 mm (1–2 unidades)', miniature_large: 'Miniaturas 32 mm (3–10 unidades)',
  action_10: 'Action figure 10 cm', action_12: 'Action figure 12 cm',
  action_15: 'Action figure 15 cm', action_20: 'Action figure 20 cm',
  bust: 'Busto personalizado', vip_1: 'Assinatura nível 1', vip_2_3: 'Assinaturas níveis 2 e 3',
}
const defaults = {
  miniature_small: { length: 13, width: 11, height: 10, weight: .3 }, miniature_large: { length: 20, width: 20, height: 20, weight: 1 },
  action_10: { length: 20, width: 20, height: 20, weight: 1 }, action_12: { length: 20, width: 20, height: 20, weight: 1 },
  action_15: { length: 20, width: 20, height: 20, weight: 2 }, action_20: { length: 30, width: 20, height: 20, weight: 2 },
  bust: { length: 20, width: 20, height: 20, weight: 1 }, vip_1: { length: 20, width: 20, height: 20, weight: .3 },
  vip_2_3: { length: 30, width: 20, height: 20, weight: 1 },
}

export default function AdminShippingSection({ accessToken }) {
  const [settings, setSettings] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  // Campos de valores usam texto local para permitir apagar e digitar decimais sem saltos no cursor.
  const [feeInputs, setFeeInputs] = React.useState({ mini: '5.00', other: '10.00' })
  const load = React.useCallback(async () => {
    if (!accessToken) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/shipping?op=config', { headers: { Authorization: `Bearer ${accessToken}` } })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar configurações.')
      setSettings({ ...json.settings, packages: { ...defaults, ...(json.settings.packages || {}) } })
      setFeeInputs({ mini: (Number(json.settings.mini_fee_cents || 0) / 100).toFixed(2), other: (Number(json.settings.other_fee_cents || 0) / 100).toFixed(2) })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [accessToken])
  React.useEffect(() => { void load() }, [load])
  const update = (key, value) => setSettings(current => ({ ...current, [key]: value }))
  const changeBox = (key, field, value) => setSettings(current => ({ ...current,
    packages: { ...current.packages, [key]: { ...current.packages[key], [field]: value } },
  }))
  async function save(event) {
    event.preventDefault()
    if (!settings) return
    setSaving(true); setError(''); setMessage('')
    try {
      const parseFee = value => {
        const normalized = String(value).trim().replace(',', '.')
        const amount = Number(normalized)
        if (!normalized || !Number.isFinite(amount) || amount < 0 || amount > 1000) throw new Error('Informe taxas válidas em reais (por exemplo, 5,00).')
        return Math.round(amount * 100)
      }
      const feeMini = parseFee(feeInputs.mini)
      const feeOther = parseFee(feeInputs.other)
      const res = await fetch('/api/shipping?op=config', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_zip: settings.origin_zip, enabled: settings.enabled,
          services: settings.services, mini_fee_cents: feeMini,
          other_fee_cents: feeOther, packages: settings.packages,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar o frete.')
      setSettings({ ...data.settings, packages: { ...defaults, ...(data.settings.packages || {}) } })
      setFeeInputs({ mini: (Number(data.settings.mini_fee_cents || 0) / 100).toFixed(2), other: (Number(data.settings.other_fee_cents || 0) / 100).toFixed(2) })
      setMessage('Configurações salvas. As próximas cotações usarão os novos valores.')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }
  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', color: '#effafa' }}>
      <div style={{ marginBottom: 20 }}><p style={{ color: '#85cfc9', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Logística</p>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>SuperFrete</h2><p style={{ color: '#b5c8d3' }}>Defina as caixas reais, origem e taxas. O cliente verá apenas modalidades válidas para seu CEP.</p></div>
      {loading && <p role="status">Carregando configurações…</p>}
      {!!error && <p role="alert" className="shipping-selector-error">{error}</p>}
      {!!message && <p role="status" style={{ color: '#9fe9c7' }}>{message}</p>}
      {!!settings && <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
        <section className="shipping-selector">
          <div className="shipping-selector-head"><div><span className="material-icons">settings</span><strong>Configurações gerais</strong></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
            <label>CEP de origem<input required inputMode="numeric" maxLength={9} value={settings.origin_zip || ''} onChange={e => update('origin_zip', e.target.value)} /></label>
            <label>Taxa de miniaturas por pedido (R$)<input required type="number" min="0" step="0.01" value={feeInputs.mini} onChange={e => setFeeInputs(old => ({ ...old, mini: e.target.value }))} /></label>
            <label>Taxa de figures, bustos, personalizadas e VIP (R$)<input required type="number" min="0" step="0.01" value={feeInputs.other} onChange={e => setFeeInputs(old => ({ ...old, other: e.target.value }))} /></label>
            <label>IDs dos serviços autorizados<input required value={settings.services || ''} onChange={e => update('services', e.target.value)} placeholder="1,2,17" /></label>
          </div>
          <label style={{ display: 'flex', gap: 9, alignItems: 'center' }}><input type="checkbox" checked={settings.enabled !== false} onChange={e => update('enabled', e.target.checked)} /> Habilitar cotação de frete</label>
          <p className="shipping-selector-fineprint">Serviços iniciais: 1 PAC, 2 SEDEX e 17 Mini Envios. Cada transportadora só aparece quando a API a disponibilizar.</p>
        </section>
        <section className="shipping-selector"><h3 style={{ fontWeight: 750, fontSize: 16 }}>Caixas e pesos por categoria</h3>
          <p className="shipping-selector-fineprint">Dimensões externas da caixa fechada; peso total já incluindo embalagem. Todas as medidas em centímetros, peso em kg.</p>
          <div style={{ display: 'grid', gap: 10 }}>{Object.entries(labels).map(([key, label]) => (
            <div key={key} style={{ display: 'grid', gap: 9, gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))', background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 13, border: '1px solid rgba(134,201,202,.13)' }}>
              <strong style={{ gridColumn: '1/-1', fontSize: 13 }}>{label}</strong>
              {Object.entries({ length: 'Comprimento', width: 'Largura', height: 'Altura', weight: 'Peso (kg)' }).map(([field, caption]) => (
                <label key={field} style={{ fontSize: 12, color: '#b5c8d3' }}>{caption}<input required type="number" min="0.01" max={field === 'weight' ? 30 : 100} step="0.01"
                  value={settings.packages?.[key]?.[field] ?? ''} onChange={e => changeBox(key, field, e.target.value)} /></label>
              ))}
            </div>
          ))}</div>
        </section>
        <button disabled={saving} className="customer-primary" type="submit" style={{ width: 'fit-content', padding: '13px 26px', background: '#79d5cb', color: '#072931', borderRadius: 12, fontWeight: 800 }}>{saving ? 'Salvando…' : 'Salvar configurações de frete'}</button>
      </form>}
      <style>{`.shipping-selector label input:not([type=checkbox]){display:block;margin-top:7px;width:100%;padding:11px 12px;background:#081e28;color:#e8f7f9;border:1px solid #385f67;border-radius:10px;min-width:0}`}</style>
    </div>
  )
}
