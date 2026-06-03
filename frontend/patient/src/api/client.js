import axios from 'axios'

const API_BASE = 'https://bharatcliniq-api.onrender.com'

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('patient_token')
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
      const isLoginCall = url.includes('/login') || url.includes('/send-otp') || url.includes('/verify-otp')
      if (!isLoginCall) {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'Something went wrong'
    return Promise.reject(new Error(message))
  }
)

export default api
