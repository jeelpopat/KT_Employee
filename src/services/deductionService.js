import api, { invalidateCache } from '../api/axios.js';

// Cache invalidator for deduction operations
export const invalidateDeductionCaches = () => {
  invalidateCache(/deduction/);
  invalidateCache(/payroll/);
  invalidateCache(/salary/);
};

// Default empty masters array - strictly no static mock data fallback
export const DEFAULT_DEDUCTION_MASTERS = [];

const DEDUCTION_MASTERS_STORAGE_KEY = 'kt_deduction_masters';

// Helper to get cached masters from localStorage (excluding any legacy mock templates)
const getCachedDeductionMasters = () => {
  try {
    const raw = localStorage.getItem(DEDUCTION_MASTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out any legacy hardcoded mock templates so authentic empty state is respected
        const realMasters = parsed.filter(m => 
          !String(m._id || m.id || '').startsWith('ded_master_idcard') &&
          !String(m._id || m.id || '').startsWith('ded_master_late') &&
          !String(m._id || m.id || '').startsWith('ded_master_uniform') &&
          !String(m._id || m.id || '').startsWith('ded_master_damage') &&
          !String(m._id || m.id || '').startsWith('ded_master_advance') &&
          !String(m._id || m.id || '').startsWith('ded_master_absence')
        );
        return realMasters;
      }
    }
  } catch (e) {
    console.warn('Could not read cached deduction masters:', e);
  }
  return [];
};

// Helper to save masters to localStorage
const setCachedDeductionMasters = (list) => {
  try {
    if (Array.isArray(list)) {
      localStorage.setItem(DEDUCTION_MASTERS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Could not cache deduction masters:', e);
  }
};

// Safe helper to handle primary and multiple fallback routes
const requestWithFallback = async (primaryCall, fallbackCall) => {
  try {
    return await primaryCall();
  } catch (error) {
    if (fallbackCall && (error.response?.status === 404 || error.response?.status === 403 || error.code === 'ERR_BAD_REQUEST')) {
      return await fallbackCall();
    }
    throw error;
  }
};

// ========================================================
// 1. DEDUCTION MASTER API
// ========================================================

/**
 * Fetch all deduction masters with optional filters
 * Strictly fetches from backend API without injecting static mock data
 * @param {Object} params - { category, isActive, isLegallyPermissible, search }
 */
export const fetchDeductionMasters = async (params = {}) => {
  try {
    const res = await requestWithFallback(
      () => api.get('/api/deduction-masters', { params }),
      () => api.get('/api/deductions/master', { params })
    );

    const list = res.data?.data || res.data?.deductionMasters || res.data || [];
    if (Array.isArray(list)) {
      if (list.length === 0) {
        // Backend genuinely returned 0 masters - strictly respect empty data
        return [];
      }
      // Normalize masters
      const normalized = list.map((m) => ({
        ...m,
        _id: m._id || m.id,
        id: m._id || m.id,
        name: m.name || m.title || m.deductionTitle || m.code,
        title: m.name || m.title || m.deductionTitle || m.code,
        code: m.code || m.deductionCode || 'DED',
        defaultAmount: Number(m.defaultAmount ?? m.amount ?? 0),
        amount: Number(m.defaultAmount ?? m.amount ?? 0),
        isActive: m.isActive !== false && m.status !== 'Inactive' && m.status !== 'inactive'
      }));
      setCachedDeductionMasters(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('API fetch for deduction masters was unavailable:', err?.message);
    return [];
  }

  // Fallback to real cached masters if available, else empty list
  return getCachedDeductionMasters();
};

/**
 * Fetch single deduction master by ID
 * @param {string} id
 */
export const fetchDeductionMasterById = async (id) => {
  try {
    return await requestWithFallback(
      () => api.get(`/api/deduction-masters/${id}`),
      () => api.get(`/api/deductions/master/${id}`)
    ).then((res) => res.data?.data || res.data);
  } catch (e) {
    const cached = getCachedDeductionMasters();
    return cached.find((m) => String(m._id || m.id) === String(id)) || null;
  }
};

/**
 * Create new deduction master
 * @param {Object} payload
 */
export const createDeductionMaster = async (payload) => {
  let createdDoc = null;
  try {
    const res = await requestWithFallback(
      () => api.post('/api/deduction-masters', payload),
      () => api.post('/api/deductions/master', payload)
    );
    createdDoc = res.data?.data || res.data;
  } catch (err) {
    console.warn('Backend create master API fallback:', err?.message);
    createdDoc = {
      _id: `ded_master_${Date.now()}`,
      id: `ded_master_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString()
    };
  }

  // Update cached masters
  const current = getCachedDeductionMasters();
  const updated = [createdDoc, ...current.filter((m) => String(m._id || m.id) !== String(createdDoc._id || createdDoc.id))];
  setCachedDeductionMasters(updated);

  invalidateDeductionCaches();
  return createdDoc;
};

/**
 * Update existing deduction master
 * @param {string} id
 * @param {Object} payload
 */
export const updateDeductionMaster = async (id, payload) => {
  let updatedDoc = null;
  try {
    const res = await requestWithFallback(
      () => api.put(`/api/deduction-masters/${id}`, payload),
      () => api.put(`/api/deductions/master/${id}`, payload)
    );
    updatedDoc = res.data?.data || res.data;
  } catch (err) {
    console.warn('Backend update master API fallback:', err?.message);
    const current = getCachedDeductionMasters();
    const existing = current.find((m) => String(m._id || m.id) === String(id));
    updatedDoc = { ...(existing || {}), ...payload, _id: id, id, updatedAt: new Date().toISOString() };
  }

  const current = getCachedDeductionMasters();
  const next = current.map((m) => (String(m._id || m.id) === String(id) ? { ...m, ...updatedDoc } : m));
  setCachedDeductionMasters(next);

  invalidateDeductionCaches();
  return updatedDoc;
};

/**
 * Delete or soft-deactivate deduction master
 * @param {string} id
 */
export const deleteDeductionMaster = async (id) => {
  try {
    await requestWithFallback(
      () => api.delete(`/api/deduction-masters/${id}`),
      () => api.delete(`/api/deductions/master/${id}`)
    );
  } catch (err) {
    console.warn('Backend delete master API fallback:', err?.message);
  }

  const current = getCachedDeductionMasters();
  const next = current.filter((m) => String(m._id || m.id) !== String(id));
  setCachedDeductionMasters(next);

  invalidateDeductionCaches();
  return { success: true };
};

// ========================================================
// 2. EMPLOYEE DEDUCTIONS API
// ========================================================

/**
 * Fetch employee deductions with filtering
 * Scoped automatically by backend based on caller's role (Admin, HR, TL, Employee)
 * @param {Object} params - { employeeId, teamLeadId, month, year, status, isLocked, category, search }
 */
export const fetchEmployeeDeductions = async (params = {}) => {
  return requestWithFallback(
    () => api.get('/api/employee-deductions', { params }),
    () => api.get('/api/deductions', { params })
  ).then((res) => {
    const list = res.data?.data || res.data?.deductions || res.data || [];
    return Array.isArray(list) ? list : [];
  }).catch((err) => {
    console.warn('Backend fetch employee deductions fallback:', err?.message);
    return [];
  });
};

/**
 * Fetch deductions belonging to the authenticated Team Lead's assigned team.
 * The backend derives the team scope from the authenticated user.
 */
export const fetchTeamDeductions = async (params = {}) => {
  const res = await api.get('/api/teamLead/deductions', { params });
  const list = res.data?.data || res.data?.deductions || res.data || [];
  return Array.isArray(list) ? list : [];
};

/**
 * Fetch logged-in employee's own deductions (Self-service portal)
 * @param {Object} params - { month, year, status }
 */
export const fetchMyDeductions = async (params = {}) => {
  return requestWithFallback(
    () => api.get('/api/employee-deductions/my-deductions', { params }),
    () => api.get('/api/deductions/my-deductions', { params })
  ).then((res) => {
    const list = res.data?.data || res.data?.deductions || res.data || [];
    return Array.isArray(list) ? list : [];
  }).catch((err) => {
    console.warn('Backend fetch my deductions fallback:', err?.message);
    return [];
  });
};

/**
 * Fetch single employee deduction record by ID
 * @param {string} id
 */
export const fetchEmployeeDeductionById = async (id) => {
  return requestWithFallback(
    () => api.get(`/api/employee-deductions/${id}`),
    () => api.get(`/api/deductions/${id}`)
  ).then((res) => res.data?.data || res.data);
};

/**
 * Create employee deduction
 * Backend generates unique deductionRecordId (e.g. DED-202611-0001)
 * @param {Object} payload
 */
export const createEmployeeDeduction = async (payload) => {
  const res = await requestWithFallback(
    () => api.post('/api/employee-deductions', payload),
    () => api.post('/api/deductions', payload)
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Update pending employee deduction
 * @param {string} id
 * @param {Object} payload
 */
export const updateEmployeeDeduction = async (id, payload) => {
  const res = await requestWithFallback(
    () => api.put(`/api/employee-deductions/${id}`, payload),
    () => api.put(`/api/deductions/${id}`, payload)
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Cancel or delete pending employee deduction
 * @param {string} id
 */
export const deleteEmployeeDeduction = async (id) => {
  const res = await requestWithFallback(
    () => api.delete(`/api/employee-deductions/${id}`),
    () => api.delete(`/api/deductions/${id}`)
  );
  invalidateDeductionCaches();
  return res.data;
};

/**
 * Approve employee deduction
 * @param {string} id
 * @param {string} comments
 */
export const approveEmployeeDeduction = async (id, comments = '') => {
  const res = await requestWithFallback(
    () => api.post(`/api/employee-deductions/${id}/approve`, { comments }),
    () => api.put(`/api/deductions/${id}/approve`, { comments })
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Reject employee deduction with reason
 * @param {string} id
 * @param {string} reason
 * @param {string} comments
 */
export const rejectEmployeeDeduction = async (id, reason, comments = '') => {
  const res = await requestWithFallback(
    () => api.post(`/api/employee-deductions/${id}/reject`, { reason, comments }),
    () => api.put(`/api/deductions/${id}/reject`, { reason, comments })
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Batch approve multiple deductions
 * @param {string[]} deductionIds
 * @param {string} comments
 */
export const batchApproveDeductions = async (deductionIds, comments = '') => {
  const res = await requestWithFallback(
    () => api.post('/api/employee-deductions/batch-approve', { deductionIds, comments }),
    () => api.post('/api/deductions/batch-approve', { deductionIds, comments })
  );
  invalidateDeductionCaches();
  return res.data;
};

/**
 * Admin Unlock Operation
 * @param {string} id
 * @param {string} reason
 */
export const unlockEmployeeDeduction = async (id, reason = '') => {
  const res = await requestWithFallback(
    () => api.post(`/api/employee-deductions/${id}/unlock`, { reason }),
    () => api.post(`/api/deductions/${id}/unlock`, { reason })
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Preview payroll with applied and excluded custom deductions
 * @param {Object} params - { employeeId, userId, month, year }
 */
export const previewPayrollWithDeductions = async (params) => {
  return requestWithFallback(
    () => api.get('/api/employee-deductions/preview', { params }),
    () => api.post('/api/deductions/preview', params)
  ).then((res) => res.data?.data || res.data);
};

/**
 * Fetch deduction reports with aggregate summaries
 * @param {Object} params - { month, year, category, teamLeadId, status }
 */
export const fetchDeductionsReport = async (params = {}) => {
  return requestWithFallback(
    () => api.get('/api/employee-deductions/report', { params }),
    () => api.get('/api/deductions/report', { params })
  ).then((res) => res.data);
};

export default {
  fetchDeductionMasters,
  fetchDeductionMasterById,
  createDeductionMaster,
  updateDeductionMaster,
  deleteDeductionMaster,
  fetchEmployeeDeductions,
  fetchMyDeductions,
  fetchEmployeeDeductionById,
  createEmployeeDeduction,
  updateEmployeeDeduction,
  deleteEmployeeDeduction,
  approveEmployeeDeduction,
  rejectEmployeeDeduction,
  batchApproveDeductions,
  unlockEmployeeDeduction,
  previewPayrollWithDeductions,
  fetchDeductionsReport,
  invalidateDeductionCaches
};
