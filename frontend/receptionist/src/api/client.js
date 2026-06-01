import axios from 'axios'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const api = axios.create({ baseURL: `${API_BASE}/api/v1` })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('staff_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(
  r => r.data,
  err => {
    if (err.response?.status === 401) { localStorage.clear(); window.location.href = '/login' }
    return Promise.reject(new Error(err.response?.data?.detail || err.response?.data?.message || err.message || 'Something went wrong'))
  }
)
export default api
