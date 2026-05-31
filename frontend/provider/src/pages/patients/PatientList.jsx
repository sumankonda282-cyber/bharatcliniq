import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { patientsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import { Search, Plus, User, Phone, Calendar } from 'lucide-react'

export default function PatientList() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      patientsApi.list({ search, limit: 50 })
        .then(r => setPatients(r.data || []))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <Link to="/patients/new" className="btn-primary">
          <Plus size={16} />
          Register Patient
        </Link>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, mobile, UHID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? <PageLoader /> : patients.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p>No patients found</p>
            <Link to="/patients/new" className="btn-primary mt-4 inline-flex">Register first patient</Link>
          </div>
        ) : (
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">UHID / BHID</th>
                  <th className="th">Name</th>
                  <th className="th">Mobile</th>
                  <th className="th">Age / Gender</th>
                  <th className="th">Blood Group</th>
                  <th className="th">Registered</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map(p => (
                  <tr key={p.id} className="tr-hover cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                    <td className="td font-mono text-xs text-gray-500">
                      {p.uhid || p.bh_id || `#${p.id}`}
                    </td>
                    <td className="td">
                      <div className="font-medium text-gray-900">{p.full_name}</div>
                      <div className="text-xs text-gray-400">{p.email}</div>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone size={12} className="text-gray-400" />
                        {p.mobile || '—'}
                      </div>
                    </td>
                    <td className="td">
                      {p.date_of_birth
                        ? `${new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()} yrs`
                        : '—'} / {p.gender || '—'}
                    </td>
                    <td className="td">
                      {p.blood_group
                        ? <span className="badge badge-red">{p.blood_group}</span>
                        : '—'}
                    </td>
                    <td className="td text-xs text-gray-400">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="td">
                      <Link
                        to={`/patients/${p.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
