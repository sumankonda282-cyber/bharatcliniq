import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'
    return Promise.reject(new Error(message))
  }
)

// Public endpoints
export const publicApi = {
  // Stats
  getStats: () => api.get('/public/stats'),

  // Cities
  getCities: () => api.get('/public/cities'),

  // Clinics
  getClinics: (params) => api.get('/public/clinics', { params }),
  getClinicBySlug: (slug) => api.get(`/public/clinics/${slug}`),

  // Doctors
  getDoctorSlots: (doctorId, date) =>
    api.get(`/public/doctors/${doctorId}/slots`, { params: { date } }),

  // Booking
  bookAppointment: (data) => api.post('/public/book', data),
  getBookingStatus: (code) => api.get(`/public/booking/${code}`),

  // Register clinic
  registerClinic: (data) => api.post('/public/register-clinic', data),
}

export default api
