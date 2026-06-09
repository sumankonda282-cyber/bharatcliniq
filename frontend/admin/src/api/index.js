import api from './client'

export const authApi = {
  login:     (identifier, password) => api.post('/auth/platform/login', { identifier, password }),
  verifyOtp: (email, otp)           => api.post('/auth/platform/verify-otp', { email, otp }),
  me:        ()                     => api.get('/auth/platform/me'),
}

export const adminApi = {
  // Dashboard
  getDashboard: () => api.get('/platform/dashboard'),

  // Clinics
  getPending:      () => api.get('/platform/clinics/pending'),
  getClinics:      (params) => api.get('/platform/clinics', { params }),
  getClinic:       (id) => api.get(`/platform/clinics/${id}`),
  approve:         (id) => api.put(`/platform/clinics/${id}/approve`),
  reject:          (id, body) => api.put(`/platform/clinics/${id}/reject`, body),
  suspend:         (id, body) => api.put(`/platform/clinics/${id}/suspend`, body),
  revoke:          (id, body) => api.put(`/platform/clinics/${id}/revoke`, body),
  reactivate:      (id) => api.put(`/platform/clinics/${id}/reactivate`),
  changePlan:      (id, plan) => api.put(`/platform/clinics/${id}/plan`, { plan }),

  // Staff
  getPendingStaff: () => api.get('/platform/staff/pending'),
  verifyStaff:     (id) => api.put(`/platform/staff/${id}/verify`),
  rejectStaff:     (id, body) => api.put(`/platform/staff/${id}/reject`, body),

  // Audit log
  getAuditLog: (params) => api.get('/platform/audit-log', { params }),

  // Reports
  getReports: (params) => api.get('/platform/reports', { params }),

  // Clinic staff
  getClinicStaff:     (id) => api.get(`/platform/clinics/${id}/staff`),
  resetStaffPassword: (id) => api.post(`/platform/staff/${id}/reset-password`),

  // BH ID Lookup
  bhidLookup: (id) => api.get(`/platform/bhid/${id}`),

  // Clinic Manager
  createManager: (clinicId, body) => api.post(`/platform/clinics/${clinicId}/create-manager`, body),

  // Clinic Edit (superadmin)
  editClinic: (id, body) => api.put(`/platform/clinics/${id}/edit`, body),

  // Platform Admin Team
  listAdmins:    ()       => api.get('/platform/admins'),
  createAdmin:   (body)   => api.post('/platform/admins', body),
  toggleAdmin:   (id)     => api.patch(`/platform/admins/${id}/toggle`),

  // Hospital Setup (platform-admin scoped)
  getOrgConfig:        (cid)          => api.get(`/platform/clinics/${cid}/org-config`),
  updateOrgConfig:     (cid, body)    => api.put(`/platform/clinics/${cid}/org-config`, body),
  listDepartments:     (cid)          => api.get(`/platform/clinics/${cid}/departments`),
  createDepartment:    (cid, body)    => api.post(`/platform/clinics/${cid}/departments`, body),
  updateDepartment:    (cid, id, body) => api.put(`/platform/clinics/${cid}/departments/${id}`, body),
  deleteDepartment:    (cid, id)      => api.delete(`/platform/clinics/${cid}/departments/${id}`),
  listWards:           (cid)          => api.get(`/platform/clinics/${cid}/wards`),
  createWard:          (cid, body)    => api.post(`/platform/clinics/${cid}/wards`, body),
  updateWard:          (cid, id, body) => api.put(`/platform/clinics/${cid}/wards/${id}`, body),
  deleteWard:          (cid, id)      => api.delete(`/platform/clinics/${cid}/wards/${id}`),
  listBeds:            (cid)          => api.get(`/platform/clinics/${cid}/beds`),
  createBed:           (cid, body)    => api.post(`/platform/clinics/${cid}/beds`, body),
  updateBed:           (cid, id, body) => api.put(`/platform/clinics/${cid}/beds/${id}`, body),

  // Direct clinic creation
  createClinicDirect: (body) => api.post('/platform/clinics/create-direct', body),

  // Plans & Pricing (editable)
  getPricing:    ()     => api.get('/platform/pricing'),
  updatePricing: (body) => api.put('/platform/pricing', body),
  resetPricing:  ()     => api.post('/platform/pricing/reset'),
}
