import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'https://bharatcliniq-api.onrender.com'

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('staff_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _refreshing = null  // shared promise so concurrent 401s all wait for the same refresh

api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const status = err.response?.status
    const url = err.config?.url || ''
    const isExempt = url.includes('/login') || url.includes('/send-otp') || url.includes('/verify-otp') || url.includes('/me') || url.includes('/refresh')

    // Auto-refresh on 401 for non-exempt endpoints
    if (status === 401 && !isExempt && !err.config._retried) {
      const refreshToken = localStorage.getItem('staff_refresh_token')
      if (refreshToken) {
        try {
          if (!_refreshing) {
            _refreshing = axios.post(`${API_BASE}/api/v1/auth/staff/refresh`, { refresh_token: refreshToken })
              .finally(() => { _refreshing = null })
          }
          const { data } = await _refreshing
          localStorage.setItem('staff_token', data.access_token)
          if (data.refresh_token) localStorage.setItem('staff_refresh_token', data.refresh_token)
          err.config._retried = true
          err.config.headers.Authorization = `Bearer ${data.access_token}`
          return api.request(err.config)
        } catch {
          // Refresh failed — fall through to logout
        }
      }
      localStorage.removeItem('staff_token')
      localStorage.removeItem('staff_refresh_token')
      localStorage.removeItem('clinic_id')
      localStorage.removeItem('branch_id')
      window.location.href = '/login'
      return Promise.reject(new Error('Session expired. Please log in again.'))
    }

    // Retry once on network failure or 5xx (handles Render cold starts)
    if (!err.response && !err.config._retried) {
      err.config._retried = true
      await new Promise(r => setTimeout(r, 1500))
      return api.request(err.config)
    }

    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'Something went wrong'
    const error = new Error(message)
    error.status = status
    return Promise.reject(error)
  }
)

export default api
