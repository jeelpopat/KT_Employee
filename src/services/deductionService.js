import api, { invalidateCache } from '../api/axios.js';

// Cache invalidator for deduction operations
export const invalidateDeductionCaches = () => {
  invalidateCache(/deduction/);
  invalidateCache(/payroll/);
  invalidateCache(/salary/);
};

// Default standard Deduction Masters for compliance and fallback
export const DEFAULT_DEDUCTION_MASTERS = [
  {
    _id: 'ded_master_idcard',
    id: 'ded_master_idcard',
    code: 'DED_IDCARD',
    name: 'ID Card Not Worn',
    title: 'ID Card Not Worn',
    category: 'POLICY_VIOLATION',
    calculationType: 'FLAT',
    defaultAmount: 100,
    amount: 100,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)'
  },
  {
    _id: 'ded_master_late',
    id: 'ded_master_late',
    code: 'DED_LATE',
    name: 'Late Attendance Penalty',
    title: 'Late Attendance Penalty',
    category: 'ATTENDANCE_PENALTY',
    calculationType: 'FLAT',
    defaultAmount: 100,
    amount: 100,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)'
  },
  {
    _id: 'ded_master_uniform',
    id: 'ded_master_uniform',
    code: 'DED_UNIFORM',
    name: 'Uniform / Dress Code Violation',
    title: 'Uniform / Dress Code Violation',
    category: 'POLICY_VIOLATION',
    calculationType: 'FLAT',
    defaultAmount: 150,
    amount: 150,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)'
  },
  {
    _id: 'ded_master_damage',
    id: 'ded_master_damage',
    code: 'DED_DAMAGE',
    name: 'Asset / Equipment Damage',
    title: 'Asset / Equipment Damage',
    category: 'ASSET_DAMAGE',
    calculationType: 'FLAT',
    defaultAmount: 500,
    amount: 500,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)(c)'
  },
  {
    _id: 'ded_master_advance',
    id: 'ded_master_advance',
    code: 'DED_ADVANCE',
    name: 'Salary Advance Recovery',
    title: 'Salary Advance Recovery',
    category: 'ADVANCE_RECOVERY',
    calculationType: 'FLAT',
    defaultAmount: 1000,
    amount: 1000,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)(f)'
  },
  {
    _id: 'ded_master_absence',
    id: 'ded_master_absence',
    code: 'DED_ABSENCE',
    name: 'Unapproved Absence Penalty',
    title: 'Unapproved Absence Penalty',
    category: 'POLICY_VIOLATION',
    calculationType: 'FLAT',
    defaultAmount: 500,
    amount: 500,
    isActive: true,
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)(b)'
  }
];

const DEDUCTION_MASTERS_STORAGE_KEY = 'kt_deduction_masters';

// Helper to get cached masters from localStorage
const getCachedDeductionMasters = () => {
  try {
    const raw = localStorage.getItem(DEDUCTION_MASTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Could not read cached deduction masters:', e);
  }
  return DEFAULT_DEDUCTION_MASTERS;
};

// Helper to save masters to localStorage
const setCachedDeductionMasters = (list) => {
  try {
    if (Array.isArray(list) && list.length > 0) {
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
 * Supports backend API and localStorage fallback for roles like Team Leader
 * @param {Object} params - { category, isActive, isLegallyPermissible, search }
 */
export const fetchDeductionMasters = async (params = {}) => {
  try {
    const res = await requestWithFallback(
      () => api.get('/api/deduction-masters', { params }),
      () => api.get('/api/deductions/master', { params })
    );

    const list = res.data?.data || res.data?.deductionMasters || res.data || [];
    if (Array.isArray(list) && list.length > 0) {
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
    console.warn('API fetch for deduction masters was unavailable, using cached/default masters:', err?.message);
  }

  // Fallback to cached or standard masters
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
  });
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
