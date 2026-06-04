import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { Plus, Search, Loader2, Users } from 'lucide-react'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ full_name: '', mobile: '', date_of_birth: '', gender: '', blood_group: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = search ? { search, limit: 50 } : { limit: 50 }
    api.get('/patients', { params }).then(r => setPatients(Array.isArray(r) ? r : [])).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    try { await api.post('/patients', form); setShowNew(false); load() }
    catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} />Register Patient</button>
      </div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#0F2557' }}>Register New Patient</h3>
            <form onSubmit={save} className="space-y-3">
              <div><label className="label">Full Name *</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
              <div><label className="label">Mobile *</label><input className="input" type="tel" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date of Birth</label><input type="date" className="input" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
                <div><label className="label">Gender</label><select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              </div>
              <div><label className="label">Blood Group</label><select className="input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}><option value="">Unknown</option>{'A+ A- B+ B- O+ O- AB+ AB-'.split(' ').map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              {err && <p className="text-red-600 text-sm">{err}</p>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Register'}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
         : patients.length === 0 ? <div className="p-10 text-center text-gray-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p>No patients found</p></div>
         : <div className="table-wrapper"><table className="table"><thead><tr><th className="th">Clinic ID</th><th className="th">Name</th><th className="th">Mobile</th><th className="th">Age / Gender</th><th className="th">Blood Group</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{patients.map(p => <tr key={p.id} className="tr-hover">
              <td className="td font-mono text-xs text-gray-500">{p.clinic_patient_id || `#${p.id}`}</td>
              <td className="td font-medium">{p.full_name}</td>
              <td className="td">{p.mobile}</td>
              <td className="td">{p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) + 'y' : '—'} {p.gender ? '· ' + p.gender : ''}</td>
              <td className="td">{p.blood_group || '—'}</td>
            </tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
