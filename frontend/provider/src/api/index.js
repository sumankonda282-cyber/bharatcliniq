import api from './client'

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (identifier, password) =>
    api.post('/auth/staff/login', { identifier, password }),
  platformLogin: (identifier, password) =>
    api.post('/auth/platform/login', { identifier, password }),
  me: () => api.get('/auth/staff/me'),
  changePassword: (current_password, new_password) =>
    api.post('/auth/staff/change-password', { current_password, new_password }),
}

// ── Clinic Admin ──────────────────────────────────────────────────
export const clinicApi = {
  getProfile:      () => api.get('/clinic/profile'),
  updateProfile:   (data) => api.put('/clinic/profile', data),
  uploadLogo:      (formData) => api.post('/clinic/profile/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getBranches:     () => api.get('/clinic/branches'),
  addBranch:       (data) => api.post('/clinic/branches', data),
  getStaff:        (role) => api.get('/clinic/staff', { params: role ? { role } : {} }),
  addStaff:        (data) => api.post('/clinic/staff', data),
  updateStaff:     (id, data) => api.put(`/clinic/staff/${id}`, data),
  getDoctors:      () => api.get('/clinic/doctors'),
  getSubscription: () => api.get('/clinic/subscription'),
  getRevenue:      (month) => api.get('/clinic/revenue', { params: { month } }),
  getOnlineBookings: (status) => api.get('/clinic/online-bookings', { params: status ? { status } : {} }),
  updateBooking:   (id, data) => api.put(`/clinic/online-bookings/${id}`, data),
  setSchedule:     (doctorId, data) => api.post(`/clinic/doctors/${doctorId}/schedule`, data),
  getSchedules:    (doctorId) => api.get(`/clinic/doctors/${doctorId}/schedules`),
}

// ── Patients ──────────────────────────────────────────────────────
export const patientsApi = {
  list:   (params) => api.get('/patients', { params }),
  get:    (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
}

// ── Appointments ──────────────────────────────────────────────────
export const appointmentsApi = {
  list:       (params) => api.get('/appointments', { params }),
  create:     (data) => api.post('/appointments', data),
  update:     (id, data) => api.put(`/appointments/${id}`, data),
  addVitals:  (data) => api.post('/appointments/vitals', data),
}

// ── Doctor Desk ───────────────────────────────────────────────────
export const doctorApi = {
  getQueue:           (params) => api.get('/doctor/queue', { params }),
  getEncounter:       (id) => api.get(`/doctor/encounter/${id}`),
  completeEncounter:  (id, data) => api.post(`/doctor/encounter/${id}/complete`, data),
  createPrescription: (data) => api.post('/doctor/prescriptions', data),
  createLabOrder:     (data) => api.post('/doctor/lab-orders', data),
}

// ── Pharmacy ──────────────────────────────────────────────────────
export const pharmacyApi = {
  getMedicines:      (params) => api.get('/pharmacy/medicines', { params }),
  addMedicine:       (branchId, data) => api.post('/pharmacy/medicines', data, { params: { branch_id: branchId } }),
  getPending:        () => api.get('/pharmacy/prescriptions/pending'),
  dispense:          (id) => api.post(`/pharmacy/prescriptions/${id}/dispense`),
}

// ── Lab ───────────────────────────────────────────────────────────
export const labApi = {
  getOrders:   (params) => api.get('/lab/orders', { params }),
  updateStatus:(id, status) => api.put(`/lab/orders/${id}/status`, { status }),
  addResults:  (id, items) => api.post(`/lab/orders/${id}/results`, { items }),
}

// ── Imaging ───────────────────────────────────────────────────────
export const imagingApi = {
  getOrders:   (params) => api.get('/imaging/orders', { params }),
  create:      (data) => api.post('/imaging/orders', data),
  update:      (id, data) => api.put(`/imaging/orders/${id}`, data),
}

// ── Billing ───────────────────────────────────────────────────────
export const billingApi = {
  getInvoices: (params) => api.get('/billing/invoices', { params }),
  create:      (data) => api.post('/billing/invoices', data),
  pay:         (id, data) => api.post(`/billing/invoices/${id}/pay`, data),
}

// ── Referrals ─────────────────────────────────────────────────────
export const referralsApi = {
  create:   (data) => api.post('/referrals', data),
  getSent:  () => api.get('/referrals/sent'),
  getReceived: () => api.get('/referrals/received'),
  accept:   (id) => api.put(`/referrals/${id}/accept`),
}

// ── Platform Admin ────────────────────────────────────────────────
export const platformApi = {
  getDashboard: () => api.get('/platform/dashboard'),
  getClinics:   (params) => api.get('/platform/clinics', { params }),
  getPending:   () => api.get('/platform/clinics/pending'),
  verify:       (id) => api.put(`/platform/clinics/${id}/verify`),
  reject:       (id) => api.put(`/platform/clinics/${id}/reject`),
  toggle:       (id) => api.put(`/platform/clinics/${id}/toggle`),
  setSubscription: (id, plan, status) =>
    api.put(`/platform/clinics/${id}/subscription`, null, { params: { plan, status } }),
}

// ── PDF ───────────────────────────────────────────────────────────
export const pdfApi = {
  prescription: (id) => `${api.defaults.baseURL}/pdf/prescription/${id}`,
  invoice:      (id) => `${api.defaults.baseURL}/pdf/invoice/${id}`,
  labReport:    (id) => `${api.defaults.baseURL}/pdf/lab-report/${id}`,
}
