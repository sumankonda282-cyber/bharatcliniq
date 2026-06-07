import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'https://bharatcliniq-api.onrender.com').replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    // Only redirect to login on 401 for non-auth endpoints
    // Login endpoint returning 401 means wrong credentials — show error, don't redirect
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      const isExempt = url.includes('/login') || url.includes('/send-otp') || url.includes('/verify-otp') || url.includes('/me')
      if (!isExempt) {
        sessionStorage.removeItem('admin_token')
        window.location.href = '/login'
      }
    }
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'Something went wrong'
    const error = new Error(message)
    error.status = err.response?.status
    return Promise.reject(error)
  }
)

export default api
