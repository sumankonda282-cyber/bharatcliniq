import { useState, useEffect } from 'react'
import { adminApi } from '../api'
import {
  IndianRupee, Loader2, Check, RotateCcw, Video, Percent,
  Building2, Hospital, Pill, FlaskConical,
} from 'lucide-react'

const ORG_META = {
  clinic:     { label: 'Clinic Plans',            icon: Building2,    hint: 'Per-doctor pricing' },
  hospital:   { label: 'Hospital Plans',          icon: Hospital,     hint: 'Base + per-doctor + modules' },
  pharmacy:   { label: 'Standalone Pharmacy',     icon: Pill,         hint: 'Flat monthly' },
  diagnostic: { label: 'Diagnostic Centre',       icon: FlaskConical, hint: 'Flat monthly' },
}

function NumInput({ value, onChange, w = 'w-28' }) {
  return (
    <input
      type="number" min={0}
      className={`input ${w} text-right`}
      value={value ?? 0}
      onChange={e => onChange(Number(e.target.value) || 0)}
    />
  )
}

export default function PlansPricing() {
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    adminApi.getPricing()
      .then(setPricing)
      .catch(() => setErr('Could not load pricing'))
      .finally(() => setLoading(false))
  }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const setPlanField = (org, idx, field, val) => {
    setPricing(p => {
      const next = structuredClone(p)
      next.plans[org][idx][field] = val
      return next
    })
  }
  const setModule = (org, idx, mod, val) => {
    setPricing(p => {
      const next = structuredClone(p)
      next.plans[org][idx].modules = { ...(next.plans[org][idx].modules || {}), [mod]: val }
      return next
    })
  }
  const setTele = (field, val) => {
    setPricing(p => ({ ...p, telehealth: { ...(p.telehealth || {}), [field]: val } }))
  }
  const setCycle = (field, val) => {
    setPricing(p => ({ ...p, cycle_discounts: { ...(p.cycle_discounts || {}), [field]: val } }))
  }

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const updated = await adminApi.updatePricing(pricing)
      setPricing(updated)
      flash('Pricing saved — live everywhere immediately')
    } catch (e) { setErr(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const reset = async () => {
    if (!window.confirm('Restore default pricing? Your custom prices will be removed.')) return
    setSaving(true); setErr('')
    try {
      const defaults = await adminApi.resetPricing()
      setPricing(defaults)
      flash('Pricing reset to defaults')
    } catch (e) { setErr(e.message || 'Reset failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>
  if (!pricing) return <div className="p-6 text-red-600">{err || 'Pricing unavailable'}</div>

  return (
    <div className="max-w-4xl">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Plans & Pricing</h1>
        <div className="flex gap-2">
          <button onClick={reset} disabled={saving} className="btn-secondary">
            <RotateCcw size={14} />Reset to defaults
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><Check size={14} />Save Pricing</>}
          </button>
        </div>
      </div>

      {err && <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}
      {msg && <div className="p-3 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>}

      <div className="space-y-6">

        {/* ── Clinic: per-doctor ── */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">{ORG_META.clinic.label}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">{ORG_META.clinic.hint}</p>
          <table className="table">
            <thead><tr>
              <th className="th">Plan</th>
              <th className="th text-right">₹ / doctor / month</th>
              <th className="th text-right">Max doctors</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(pricing.plans.clinic || []).map((p, i) => (
                <tr key={p.key}>
                  <td className="td font-medium capitalize">{p.label || p.key}</td>
                  <td className="td text-right">
                    {p.model === 'custom'
                      ? <span className="text-gray-400 text-sm">Custom / negotiated</span>
                      : <NumInput value={p.price_per_doctor} onChange={v => setPlanField('clinic', i, 'price_per_doctor', v)} />}
                  </td>
                  <td className="td text-right">
                    <NumInput value={p.max_doctors} onChange={v => setPlanField('clinic', i, 'max_doctors', v)} w="w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Hospital: base + per-doctor + modules ── */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Hospital size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">{ORG_META.hospital.label}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">{ORG_META.hospital.hint}</p>
          {(pricing.plans.hospital || []).map((p, i) => p.model === 'custom' ? (
            <div key={p.key} className="text-sm text-gray-500 mt-2">{p.label}: custom / negotiated</div>
          ) : (
            <div key={p.key} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Base / month (₹)</label>
                <NumInput value={p.base_monthly} onChange={v => setPlanField('hospital', i, 'base_monthly', v)} w="w-full" />
              </div>
              <div>
                <label className="label">Included doctors</label>
                <NumInput value={p.included_doctors} onChange={v => setPlanField('hospital', i, 'included_doctors', v)} w="w-full" />
              </div>
              <div>
                <label className="label">₹ / extra doctor</label>
                <NumInput value={p.price_per_extra_doctor} onChange={v => setPlanField('hospital', i, 'price_per_extra_doctor', v)} w="w-full" />
              </div>
              {['pharmacy', 'lab', 'imaging'].map(mod => (
                <div key={mod}>
                  <label className="label capitalize">{mod} module (₹/mo)</label>
                  <NumInput value={p.modules?.[mod]} onChange={v => setModule('hospital', i, mod, v)} w="w-full" />
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* ── Pharmacy + Diagnostic: flat ── */}
        {['pharmacy', 'diagnostic'].map(org => {
          const Meta = ORG_META[org]
          return (
            <section key={org} className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Meta.icon size={16} className="text-gray-500" />
                <h2 className="font-semibold text-gray-800">{Meta.label}</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4">{Meta.hint}</p>
              <table className="table">
                <thead><tr>
                  <th className="th">Plan</th>
                  <th className="th">Includes</th>
                  <th className="th text-right">₹ / month</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {(pricing.plans[org] || []).map((p, i) => (
                    <tr key={p.key}>
                      <td className="td font-medium capitalize">{p.label || p.key}</td>
                      <td className="td text-sm text-gray-500">{p.note || '—'}</td>
                      <td className="td text-right">
                        <NumInput value={p.monthly} onChange={v => setPlanField(org, i, 'monthly', v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}

        {/* ── Telehealth fees ── */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Video size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Telehealth Platform Fees</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Charged per completed telehealth visit. GST applies to platform fees only — consultation fees are GST-exempt healthcare services.</p>
          <div className="grid grid-cols-3 gap-4 max-w-lg">
            <div>
              <label className="label">Patient fee (₹)</label>
              <NumInput value={pricing.telehealth?.patient_fee} onChange={v => setTele('patient_fee', v)} w="w-full" />
            </div>
            <div>
              <label className="label">Provider fee (₹)</label>
              <NumInput value={pricing.telehealth?.provider_fee} onChange={v => setTele('provider_fee', v)} w="w-full" />
            </div>
            <div>
              <label className="label">GST %</label>
              <NumInput value={pricing.telehealth?.gst_percent} onChange={v => setTele('gst_percent', v)} w="w-full" />
            </div>
          </div>
        </section>

        {/* ── Billing-cycle discounts ── */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Percent size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Billing-Cycle Discounts</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">% off when an organisation prepays for a longer cycle.</p>
          <div className="grid grid-cols-3 gap-4 max-w-lg">
            {[['quarterly', 'Quarterly'], ['half_yearly', 'Half-yearly'], ['yearly', 'Yearly']].map(([k, label]) => (
              <div key={k}>
                <label className="label">{label} (%)</label>
                <NumInput value={pricing.cycle_discounts?.[k]} onChange={v => setCycle(k, v)} w="w-full" />
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-2 text-xs text-gray-400 pb-8">
          <IndianRupee size={12} />
          Changes apply immediately to dashboard MRR, billing summaries, plan validation, and the public pricing endpoint.
        </div>
      </div>
    </div>
  )
}
