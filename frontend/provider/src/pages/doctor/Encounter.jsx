import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doctorApi, appointmentsApi } from '../../api'
import { PageLoader } from '../../components/ui/Spinner'
import {
  ArrowLeft, Activity, FileText, Pill, FlaskConical,
  Save, CheckCircle, Plus, Trash2
} from 'lucide-react'

export default function Encounter() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('soap')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  // SOAP
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '', follow_up_days: '' })

  // Vitals
  const [vitals, setVitals] = useState({
    blood_pressure_systolic: '', blood_pressure_diastolic: '', pulse_rate: '',
    temperature: '', weight_kg: '', height_cm: '', oxygen_saturation: '', blood_sugar: ''
  })

  // Prescription
  const [rxItems, setRxItems] = useState([{ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const [rxNotes, setRxNotes] = useState('')

  // Lab
  const [labTests, setLabTests] = useState([{ test_name: '' }])
  const [labNotes, setLabNotes] = useState('')

  useEffect(() => {
    doctorApi.getEncounter(id)
      .then(r => {
        setData(r.data)
        if (r.data.soap_note) setSoap({ ...soap, ...r.data.soap_note })
        if (r.data.vitals) setVitals({ ...vitals, ...r.data.vitals })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const saveVitals = async () => {
    setSaving(true)
    try {
      await appointmentsApi.addVitals({ appointment_id: parseInt(id), patient_id: data.patient.id, ...vitals })
      setSuccess('Vitals saved')
    } catch (err) {
      setSuccess('Error: ' + (err.response?.data?.detail || 'Failed'))
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const completeEncounter = async () => {
    setSaving(true)
    try {
      const payload = {
        soap: { ...soap, appointment_id: parseInt(id) },
        prescription: rxItems.some(i => i.medicine_name) ? { notes: rxNotes, items: rxItems.filter(i => i.medicine_name) } : null,
        lab_order: labTests.some(t => t.test_name) ? { notes: labNotes, tests: labTests.filter(t => t.test_name) } : null,
      }
      await doctorApi.completeEncounter(id, payload)
      setSuccess('Encounter completed!')
      setTimeout(() => navigate('/doctor-desk'), 1500)
    } catch (err) {
      setSuccess('Error: ' + (err.response?.data?.detail || 'Failed'))
    } finally {
      setSaving(false)
    }
  }

  const addRxItem = () => setRxItems(i => [...i, { medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const removeRxItem = (idx) => setRxItems(i => i.filter((_, j) => j !== idx))
  const setRx = (idx, k, v) => setRxItems(i => i.map((item, j) => j === idx ? { ...item, [k]: v } : item))

  const addLabTest = () => setLabTests(t => [...t, { test_name: '' }])
  const setLab = (idx, v) => setLabTests(t => t.map((item, j) => j === idx ? { ...item, test_name: v } : item))

  if (loading) return <PageLoader />
  if (!data) return <div className="text-gray-500">Encounter not found</div>

  const patient = data.patient || {}

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{patient.full_name}</h1>
            <p className="text-sm text-gray-500">{patient.uhid || `Patient #${patient.id}`} · {data.appointment_date} {data.appointment_time}</p>
          </div>
        </div>
        <button onClick={completeEncounter} disabled={saving} className="btn-success">
          <CheckCircle size={16} />
          {saving ? 'Saving…' : 'Complete Encounter'}
        </button>
      </div>

      {success && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${success.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {success}
        </div>
      )}

      {/* Patient summary */}
      <div className="card p-4 mb-5 flex items-center gap-6 text-sm">
        <div><span className="text-gray-400">Age:</span> <span className="font-medium">{patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs` : '—'}</span></div>
        <div><span className="text-gray-400">Gender:</span> <span className="font-medium">{patient.gender || '—'}</span></div>
        <div><span className="text-gray-400">Blood:</span> <span className="font-medium text-red-600">{patient.blood_group || '—'}</span></div>
        <div><span className="text-gray-400">Allergies:</span> <span className="font-medium text-orange-600">{patient.allergies || 'None'}</span></div>
        <div><span className="text-gray-400">Reason:</span> <span className="font-medium">{data.reason || '—'}</span></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit">
        {[
          { key: 'soap', label: 'SOAP Notes', icon: FileText },
          { key: 'vitals', label: 'Vitals', icon: Activity },
          { key: 'rx', label: 'Prescription', icon: Pill },
          { key: 'lab', label: 'Lab Orders', icon: FlaskConical },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* SOAP */}
      {tab === 'soap' && (
        <div className="card p-6 space-y-4">
          {[
            ['subjective', 'S — Subjective (Chief complaint, history)', 5],
            ['objective', 'O — Objective (Examination findings)', 4],
            ['assessment', 'A — Assessment / Diagnosis', 4],
            ['plan', 'P — Plan (Treatment, advice)', 4],
          ].map(([key, label, rows]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <textarea
                className="input resize-none"
                rows={rows}
                value={soap[key]}
                onChange={e => setSoap(s => ({ ...s, [key]: e.target.value }))}
                placeholder={`Enter ${key} notes…`}
              />
            </div>
          ))}
          <div className="w-32">
            <label className="label">Follow-up (days)</label>
            <input className="input" type="number" value={soap.follow_up_days} onChange={e => setSoap(s => ({ ...s, follow_up_days: e.target.value }))} placeholder="7" />
          </div>
        </div>
      )}

      {/* Vitals */}
      {tab === 'vitals' && (
        <div className="card p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              ['BP Systolic',  'blood_pressure_systolic',  'number', 'mmHg'],
              ['BP Diastolic', 'blood_pressure_diastolic', 'number', 'mmHg'],
              ['Pulse Rate',   'pulse_rate',               'number', 'bpm'],
              ['Temperature',  'temperature',              'number', '°F'],
              ['Weight',       'weight_kg',                'number', 'kg'],
              ['Height',       'height_cm',                'number', 'cm'],
              ['SpO2',         'oxygen_saturation',        'number', '%'],
              ['Blood Sugar',  'blood_sugar',              'number', 'mg/dL'],
            ].map(([label, key, type, unit]) => (
              <div key={key}>
                <label className="label">{label} <span className="text-gray-400 font-normal">{unit}</span></label>
                <input
                  className="input"
                  type={type}
                  value={vitals[key]}
                  onChange={e => setVitals(v => ({ ...v, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button onClick={saveVitals} disabled={saving} className="btn-primary">
            <Save size={15} />Save Vitals
          </button>
        </div>
      )}

      {/* Prescription */}
      {tab === 'rx' && (
        <div className="card p-6">
          <div className="space-y-3 mb-4">
            {rxItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                <div className="col-span-2">
                  <label className="label text-xs">Medicine Name</label>
                  <input className="input text-sm" placeholder="Tab Paracetamol 500mg" value={item.medicine_name} onChange={e => setRx(idx, 'medicine_name', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Dosage</label>
                  <input className="input text-sm" placeholder="1-0-1" value={item.dosage} onChange={e => setRx(idx, 'dosage', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Duration</label>
                  <input className="input text-sm" placeholder="5 days" value={item.duration} onChange={e => setRx(idx, 'duration', e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button onClick={() => removeRxItem(idx)} className="btn-secondary p-2 text-red-500 hover:text-red-700 mt-5">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="col-span-5">
                  <label className="label text-xs">Instructions</label>
                  <input className="input text-sm" placeholder="After food, with water" value={item.instructions} onChange={e => setRx(idx, 'instructions', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addRxItem} className="btn-secondary text-sm mb-4"><Plus size={14} />Add Medicine</button>
          <div>
            <label className="label">Prescription Notes</label>
            <textarea className="input resize-none" rows={2} value={rxNotes} onChange={e => setRxNotes(e.target.value)} placeholder="General notes…" />
          </div>
        </div>
      )}

      {/* Lab Orders */}
      {tab === 'lab' && (
        <div className="card p-6">
          <div className="space-y-2 mb-4">
            {labTests.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <input className="input" placeholder="e.g. CBC, LFT, Blood Sugar" value={t.test_name} onChange={e => setLab(idx, e.target.value)} />
              </div>
            ))}
          </div>
          <button onClick={addLabTest} className="btn-secondary text-sm mb-4"><Plus size={14} />Add Test</button>
          <div>
            <label className="label">Clinical Notes</label>
            <textarea className="input resize-none" rows={2} value={labNotes} onChange={e => setLabNotes(e.target.value)} placeholder="Reason for tests…" />
          </div>
        </div>
      )}
    </div>
  )
}
