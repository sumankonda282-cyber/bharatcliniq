import { useState, useEffect } from 'react'
import { platformApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { ShieldCheck, Building2, CheckCircle, XCircle, Search, ToggleLeft, ToggleRight, CreditCard } from 'lucide-react'
import StatCard from '../../components/ui/StatCard'

const PLANS = ['free', 'basic', 'pro', 'enterprise']
const PLAN_COLORS = { free: 'badge-gray', basic: 'badge-blue', pro: 'badge-purple', enterprise: 'badge-yellow' }

export default function PlatformAdmin() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [allClinics, setAllClinics] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showSubscription, setShowSubscription] = useState(null)
  const [newPlan, setNewPlan] = useState('free')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      platformApi.getDashboard(),
      platformApi.getPending(),
      platformApi.getClinics({ limit: 100 }),
    ]).then(([d, p, a]) => {
      setDashboard(d)
      setPending(Array.isArray(p) ? p : [])
      setAllClinics(Array.isArray(a) ? a : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleVerify = async (id) => {
    setSaving(true)
    try { await platformApi.verify(id); load() } finally { setSaving(false) }
  }

  const handleReject = async (id) => {
    setSaving(true)
    try { await platformApi.reject(id); load() } finally { setSaving(false) }
  }

  const handleToggle = async (id) => {
    await platformApi.toggle(id); load()
  }

  const handleSubscription = async () => {
    setSaving(true)
    try {
      await platformApi.setSubscription(showSubscription.id, newPlan, 'active')
      setShowSubscription(null)
      load()
    } finally { setSaving(false) }
  }

  const filtered = allClinics.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Platform Administration</h1>
        <div className="badge badge-purple">BharatCliniq Super Admin</div>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Clinics"   value={dashboard.total_clinics}      icon={Building2} color="blue" />
          <StatCard label="Active Clinics"  value={dashboard.active_clinics}     icon={CheckCircle} color="green" />
          <StatCard label="Pending Approval" value={dashboard.pending_clinics}   icon={ShieldCheck} color="orange" />
          <StatCard label="Total Patients"  value={dashboard.total_patients}     icon={Building2} color="purple" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 w-fit">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Pending ({pending.length})
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          All Clinics
        </button>
      </div>

      {/* Pending approvals */}
      {tab === 'pending' && (
        <div className="card">
          {pending.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-2 opacity-30" />
              <p>No pending clinic approvals</p>
            </div>
          ) : (
            <div className="table-wrapper rounded-xl border-0">
              <table className="table">
                <thead><tr>
                  <th className="th">Clinic</th><th className="th">Specialty</th><th className="th">City</th>
                  <th className="th">Admin</th><th className="th">Date</th><th className="th">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.map(c => (
                    <tr key={c.id} className="tr-hover">
                      <td className="td">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone}</div>
                      </td>
                      <td className="td text-sm text-gray-600">{c.specialty || '—'}</td>
                      <td className="td text-sm">{c.city}, {c.state}</td>
                      <td className="td">
                        <div className="text-sm">{c.admin_name}</div>
                        <div className="text-xs text-gray-400">{c.admin_email}</div>
                      </td>
                      <td className="td text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="td">
                        <div className="flex gap-2">
                          <button onClick={() => handleVerify(c.id)} disabled={saving} className="btn-success text-xs py-1">
                            <CheckCircle size={12} />Approve
                          </button>
                          <button onClick={() => handleReject(c.id)} disabled={saving} className="btn-danger text-xs py-1">
                            <XCircle size={12} />Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Clinics */}
      {tab === 'all' && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search clinics…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="table-wrapper rounded-xl border-0">
            <table className="table">
              <thead><tr>
                <th className="th">Clinic</th><th className="th">City</th><th className="th">Plan</th>
                <th className="th">Verified</th><th className="th">Active</th><th className="th">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="tr-hover">
                    <td className="td">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.specialty}</div>
                    </td>
                    <td className="td text-sm">{c.city}, {c.state}</td>
                    <td className="td">
                      <span className={PLAN_COLORS[c.plan] || 'badge-gray'}>{c.plan}</span>
                    </td>
                    <td className="td">
                      {c.is_verified
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <XCircle size={16} className="text-gray-300" />}
                    </td>
                    <td className="td">
                      <button onClick={() => handleToggle(c.id)} className="flex items-center gap-1 text-xs">
                        {c.is_active
                          ? <ToggleRight size={18} className="text-green-500" />
                          : <ToggleLeft size={18} className="text-gray-400" />}
                      </button>
                    </td>
                    <td className="td">
                      <button onClick={() => { setShowSubscription(c); setNewPlan(c.plan) }} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                        <CreditCard size={12} />Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      <Modal open={!!showSubscription} onClose={() => setShowSubscription(null)} title={`Change Plan — ${showSubscription?.name}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map(plan => (
              <button
                key={plan}
                type="button"
                onClick={() => setNewPlan(plan)}
                className={`p-3 rounded-xl border-2 font-medium capitalize transition-all ${newPlan === plan ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <div className="font-bold capitalize">{plan}</div>
                <div className="text-xs mt-1">
                  {plan === 'free' && '2 Doctors · 1 Branch'}
                  {plan === 'basic' && '10 Doctors · 3 Branches'}
                  {plan === 'pro' && 'Unlimited'}
                  {plan === 'enterprise' && 'Custom'}
                </div>
              </button>
            ))}
          </div>
          <button onClick={handleSubscription} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Updating…' : 'Update Subscription'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
