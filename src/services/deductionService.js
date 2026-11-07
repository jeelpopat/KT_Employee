import api, { invalidateCache } from '../api/axios.js';

// Cache invalidator for deduction operations
export const invalidateDeductionCaches = () => {
  invalidateCache(/deduction/);
  invalidateCache(/payroll/);
  invalidateCache(/salary/);
};

// Safe helper to handle primary and fallback routes
const requestWithFallback = async (primaryCall, fallbackCall) => {
  try {
    return await primaryCall();
  } catch (error) {
    if (fallbackCall && (error.response?.status === 404 || error.code === 'ERR_BAD_REQUEST')) {
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
 * @param {Object} params - { category, isActive, isLegallyPermissible, search }
 */
export const fetchDeductionMasters = async (params = {}) => {
  return requestWithFallback(
    () => api.get('/api/deduction-masters', { params }),
    () => api.get('/api/deductions/master', { params })
  ).then((res) => {
    const list = res.data?.data || res.data?.deductionMasters || res.data || [];
    return Array.isArray(list) ? list : [];
  });
};

/**
 * Fetch single deduction master by ID
 * @param {string} id
 */
export const fetchDeductionMasterById = async (id) => {
  return requestWithFallback(
    () => api.get(`/api/deduction-masters/${id}`),
    () => api.get(`/api/deductions/master/${id}`)
  ).then((res) => res.data?.data || res.data);
};

/**
 * Create new deduction master
 * @param {Object} payload
 */
export const createDeductionMaster = async (payload) => {
  const res = await requestWithFallback(
    () => api.post('/api/deduction-masters', payload),
    () => api.post('/api/deductions/master', payload)
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Update existing deduction master
 * @param {string} id
 * @param {Object} payload
 */
export const updateDeductionMaster = async (id, payload) => {
  const res = await requestWithFallback(
    () => api.put(`/api/deduction-masters/${id}`, payload),
    () => api.put(`/api/deductions/master/${id}`, payload)
  );
  invalidateDeductionCaches();
  return res.data?.data || res.data;
};

/**
 * Delete or soft-deactivate deduction master
 * @param {string} id
 */
export const deleteDeductionMaster = async (id) => {
  const res = await requestWithFallback(
    () => api.delete(`/api/deduction-masters/${id}`),
    () => api.delete(`/api/deductions/master/${id}`)
  );
  invalidateDeductionCaches();
  return res.data;
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
