import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Plus, Edit3, Eye, Search, Filter, RefreshCw, CheckCircle2,
  AlertCircle, X, Download, Printer, Users, Shield, ArrowUpRight,
  ArrowDownRight, DollarSign, Percent, Calendar, Check, ChevronRight,
  Building2, CreditCard, Sparkles, FileText, Info, Award, UserCheck,
  TrendingUp, Clock, ChevronDown, CheckSquare, Layers, Send, Calculator
} from 'lucide-react';
import api, { invalidateCache } from '../../api/axios.js';
import { useApp, deriveUserRole, getRealAuthUserId, resolveEmployeeName } from '../../context/AppContext.jsx';
import { filterOutUnknownUsers, isUnknownEmployeeOrUser } from '../../utils/roleFilters.js';

// Currency Formatter (Indian Rupee)
const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

// Month Names mapping
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to format Month and Year
const formatMonthYear = (month, year) => {
  let mStr = '';
  if (typeof month === 'number') {
    mStr = MONTH_NAMES[month - 1] || MONTH_NAMES[month] || `Month ${month}`;
  } else if (!isNaN(Number(month)) && Number(month) >= 1 && Number(month) <= 12) {
    mStr = MONTH_NAMES[Number(month) - 1];
  } else if (typeof month === 'string') {
    mStr = month;
  }
  return `${mStr} ${year || ''}`.trim();
};

// Format Date nicely
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateStr);
  }
};

// Normalize role label helper
const getRoleLabel = (u) => {
  if (!u) return 'Employee';
  const roleStr = (
    u.role?.roleName ||
    u.role?.name ||
    (typeof u.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(u.role) ? u.role : '') ||
    u.roleName ||
    u.userRole ||
    u.designation ||
    ''
  ).toLowerCase().trim();

  if (roleStr.includes('lead') || roleStr === 'tl' || roleStr === 'team_leader' || u.isTeamLeader) {
    return 'Team Lead';
  }
  if (roleStr === 'admin') return 'Admin';
  if (roleStr === 'hr') return 'HR';
  return 'Employee';
};

// Salary disbursement status badge color mapping
const getStatusBadgeClass = (status) => {
  const s = String(status || 'paid').toLowerCase();
  switch (s) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'processed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'unpaid':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'hold':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

// Calculate total calendar days in a given month and year
const getDaysInMonth = (month, year) => {
  const m = Number(month);
  const y = Number(year);
  if (!m || !y) return 30;
  return new Date(y, m, 0).getDate();
};

// Calculate total approved leave days and LOP days for a user in a specific month
const calculateApprovedLeaveDaysForMonth = (targetUser, month, year, leavesList) => {
  if (!targetUser || !month || !year || !Array.isArray(leavesList) || leavesList.length === 0) {
    return { leaveDays: 0, lopDays: 0 };
  }

  const targetId = String(targetUser._id || targetUser.id || (typeof targetUser === 'string' ? targetUser : '')).toLowerCase().trim();
  const targetEmail = String(targetUser.email || '').toLowerCase().trim();
  const targetName = String(targetUser.name || targetUser.fullName || '').toLowerCase().trim();

  const m = Number(month);
  const y = Number(year);
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

  let approvedLeaveDays = 0;
  let approvedLopDays = 0;

  for (const leave of leavesList) {
    if (!leave) continue;

    // Check approval status
    const status = String(leave.status || leave.approvalStatus || leave.adminStatus || '').toLowerCase().trim();
    const tlStatus = String(leave.teamLeadStatus || '').toLowerCase().trim();
    const isApproved = status === 'approved' || status.includes('approved') || tlStatus === 'approved';
    if (!isApproved) continue;

    // Check user matching
    const leaveEmp = (typeof leave.employeeId === 'object' && leave.employeeId !== null) ? leave.employeeId :
      (typeof leave.employee === 'object' && leave.employee !== null) ? leave.employee :
      (typeof leave.user === 'object' && leave.user !== null) ? leave.user :
      (typeof leave.userId === 'object' && leave.userId !== null) ? leave.userId : null;

    const leaveIds = [
      typeof leave.employeeId === 'string' ? leave.employeeId : null,
      typeof leave.employee === 'string' ? leave.employee : null,
      typeof leave.user === 'string' ? leave.user : null,
      typeof leave.userId === 'string' ? leave.userId : null,
      typeof leave.applicantId === 'string' ? leave.applicantId : null,
      typeof leave.applicantID === 'string' ? leave.applicantID : null,
      leaveEmp?._id ? String(leaveEmp._id) : null,
      leaveEmp?.id ? String(leaveEmp.id) : null,
      leave.appliedBy ? String(leave.appliedBy) : null
    ].filter(Boolean).map(id => String(id).toLowerCase().trim());

    let isMatch = false;
    if (targetId && leaveIds.includes(targetId)) {
      isMatch = true;
    } else if (targetEmail) {
      const leaveEmails = [
        leave.applicantEmail,
        leave.employeeEmail,
        leave.email,
        leaveEmp?.email
      ].filter(Boolean).map(e => String(e).toLowerCase().trim());
      if (leaveEmails.includes(targetEmail)) {
        isMatch = true;
      }
    } else if (targetName && targetName.length > 2) {
      const leaveNames = [
        leave.applicantName,
        leave.employeeName,
        leave.name,
        leaveEmp?.name,
        leaveEmp?.fullName
      ].filter(Boolean).map(n => String(n).toLowerCase().trim());
      if (leaveNames.includes(targetName)) {
        isMatch = true;
      }
    }

    if (!isMatch) continue;

    // Check date range overlap with the target month
    const rawStart = leave.startDate || leave.fromDate || leave.date;
    const rawEnd = leave.endDate || leave.toDate || rawStart;
    if (!rawStart) continue;

    const startDate = new Date(rawStart);
    const endDate = new Date(rawEnd);
    if (isNaN(startDate.getTime())) continue;

    const effectiveStart = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
    const effectiveEnd = new Date(Math.min(isNaN(endDate.getTime()) ? startDate.getTime() : endDate.getTime(), monthEnd.getTime()));

    if (effectiveStart > effectiveEnd) {
      continue;
    }

    const oneDay = 24 * 60 * 60 * 1000;
    const sDateOnly = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
    const eDateOnly = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());
    const daysDiff = Math.round((eDateOnly - sDateOnly) / oneDay) + 1;

    let overlappingDays = 0;
    const isEntirelyInMonth = startDate >= monthStart && endDate <= monthEnd;
    if (leave.isHalfDay) {
      overlappingDays = 0.5;
    } else if (isEntirelyInMonth && leave.totalDays != null && Number(leave.totalDays) > 0) {
      overlappingDays = Number(leave.totalDays);
    } else {
      overlappingDays = Math.max(0, daysDiff);
    }

    const leaveType = String(leave.leaveType || leave.type || '').toLowerCase();
    const isLop = leaveType.includes('lop') || leaveType.includes('loss of pay') || leaveType.includes('unpaid');

    if (isLop) {
      approvedLopDays += overlappingDays;
    } else {
      approvedLeaveDays += overlappingDays;
    }
  }

  return {
    leaveDays: approvedLeaveDays,
    lopDays: approvedLopDays
  };
};

// Fetch user leaves directly from backend APIs:
// 1. GET /api/leave/my-leaves/:userId
// 2. OR fallback to GET /api/leave/all filtered by name, id, employeeID, email
const fetchBackendUserLeaves = async (userId, targetUser) => {
  if (!userId) return [];
  let userLeaves = [];

  // 1. Primary endpoint: GET /api/leave/my-leaves/:userId
  try {
    const res = await api.get(`/api/leave/my-leaves/${userId}`, { skipCache: true });
    const raw = res.data?.data || res.data?.leaves || res.data?.history || (Array.isArray(res.data) ? res.data : []);
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw.leaves) ? raw.leaves : []);
    if (list.length > 0) {
      userLeaves = list;
    }
  } catch (err) {
    // Proceed to /api/leave/all fallback
  }

  // 2. Fallback endpoint: GET /api/leave/all filtered by name, id, employeeID, or email
  if (userLeaves.length === 0) {
    try {
      const allRes = await api.get('/api/leave/all', { skipCache: true });
      const rawAll = allRes.data?.data || allRes.data?.leaves || allRes.data?.history || (Array.isArray(allRes.data) ? allRes.data : []);
      const allList = Array.isArray(rawAll)
        ? rawAll
        : (Array.isArray(rawAll.leaves) ? rawAll.leaves : (Array.isArray(rawAll.history) ? rawAll.history : []));

      const targetId = String(userId).toLowerCase().trim();
      const targetName = String(targetUser?.name || targetUser?.fullName || '').toLowerCase().trim();
      const targetEmail = String(targetUser?.email || '').toLowerCase().trim();
      const targetEmpId = String(targetUser?.employeeID || targetUser?.uniqueID || '').toLowerCase().trim();

      userLeaves = allList.filter((leave) => {
        if (!leave) return false;

        const leaveEmp = (typeof leave.employeeId === 'object' && leave.employeeId !== null) ? leave.employeeId :
          (typeof leave.employee === 'object' && leave.employee !== null) ? leave.employee :
          (typeof leave.user === 'object' && leave.user !== null) ? leave.user :
          (typeof leave.userId === 'object' && leave.userId !== null) ? leave.userId : null;

        const leaveIds = [
          typeof leave.employeeId === 'string' ? leave.employeeId : null,
          typeof leave.employee === 'string' ? leave.employee : null,
          typeof leave.user === 'string' ? leave.user : null,
          typeof leave.userId === 'string' ? leave.userId : null,
          typeof leave.applicantId === 'string' ? leave.applicantId : null,
          typeof leave.applicantID === 'string' ? leave.applicantID : null,
          leaveEmp?._id ? String(leaveEmp._id) : null,
          leaveEmp?.id ? String(leaveEmp.id) : null,
          leave.appliedBy ? String(leave.appliedBy) : null
        ].filter(Boolean).map(id => String(id).toLowerCase().trim());

        if (targetId && leaveIds.includes(targetId)) return true;

        if (targetEmpId) {
          const lEmpId = String(leave.employeeID || leave.uniqueID || leaveEmp?.employeeID || leaveEmp?.uniqueID || '').toLowerCase().trim();
          if (lEmpId && lEmpId === targetEmpId) return true;
        }

        if (targetName && targetName.length > 2) {
          const leaveNames = [
            leave.applicantName,
            leave.employeeName,
            leave.name,
            leaveEmp?.name,
            leaveEmp?.fullName
          ].filter(Boolean).map(n => String(n).toLowerCase().trim());
          if (leaveNames.includes(targetName)) return true;
        }

        if (targetEmail) {
          const leaveEmails = [
            leave.applicantEmail,
            leave.employeeEmail,
            leave.email,
            leaveEmp?.email
          ].filter(Boolean).map(e => String(e).toLowerCase().trim());
          if (leaveEmails.includes(targetEmail)) return true;
        }

        return false;
      });
    } catch (allErr) {
      console.warn('Could not fetch /api/leave/all:', allErr.message);
    }
  }

  return userLeaves;
};

export const SalaryView = () => {
  const { user, userRole } = useApp();

  // Role detection: Admin vs Team Lead vs Employee
  const rawRole = userRole || deriveUserRole(user);
  const normalizedRole = String(rawRole || '').toLowerCase().trim();
  const isAdmin = normalizedRole === 'admin';
  const isTL =
    normalizedRole === 'team_leader' ||
    normalizedRole === 'team lead' ||
    normalizedRole === 'team leader' ||
    normalizedRole === 'teamlead' ||
    normalizedRole === 'tl';
  const isEmployee = normalizedRole === 'employee';

  // For Admin: view switcher ('processed-payrolls' | 'payslips' | 'salary-structures' | 'my-salary')
  const [adminViewMode, setAdminViewMode] = useState('processed-payrolls');

  // Authenticated user ID (MongoDB ObjectId)
  const myMongoUserId = useMemo(() => {
    return getRealAuthUserId(user) || String(user?._id || user?.id || user?.userId || '');
  }, [user]);

  // Loading & notification states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message }

  // Admin Data State: Salary Structures (GET /api/payroll/salary) & Staff
  const [allSalaries, setAllSalaries] = useState([]);
  const [companyStaff, setCompanyStaff] = useState([]);

  // Processed Payrolls Data State (GET /api/payroll)
  const [allProcessedPayrolls, setAllProcessedPayrolls] = useState([]);

  // Payslips Data State (GET /api/payroll/payslip)
  const [allPayslips, setAllPayslips] = useState([]);

  // All leaves data state for approved leaves & days payable calculation (GET /api/leave/all)
  const [allLeaves, setAllLeaves] = useState([]);

  // Admin Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'employee' | 'team_lead'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive' | 'processed'
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState(new Date().getFullYear().toString());

  // Employee / TL Personal Data State
  const [mySalaryStructure, setMySalaryStructure] = useState(null);
  const [mySalaryHistory, setMySalaryHistory] = useState([]);
  const [myProcessedPayrolls, setMyProcessedPayrolls] = useState([]);
  const [myPayslips, setMyPayslips] = useState([]);
  const [downloadingSlipId, setDownloadingSlipId] = useState(null);
  const [printingSlipId, setPrintingSlipId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Detail / Statement Modal State (for both Admin & Employee)
  const [viewingDetailSalary, setViewingDetailSalary] = useState(null);
  const [viewingPayslipModal, setViewingPayslipModal] = useState(null);

  // ==========================================
  // MODAL: UPDATE MONTHLY PAYROLL / MARK AS PAID
  // PUT /api/salaries/:id/pay
  // ==========================================
  const [isUpdatePayrollModalOpen, setIsUpdatePayrollModalOpen] = useState(false);
  const [selectedPayrollToUpdate, setSelectedPayrollToUpdate] = useState(null);
  const [isSubmittingUpdatePayroll, setIsSubmittingUpdatePayroll] = useState(false);
  const [updatePayrollError, setUpdatePayrollError] = useState('');
  const [updatePayrollForm, setUpdatePayrollForm] = useState({
    paymentMode: 'CASH',
    status: 'Processed',
    paidAt: '',
    remarks: '',
    extraBonus: '',
    extraDeduction: ''
  });

  // ==========================================
  // MODAL 1: CREATE / EDIT SALARY STRUCTURE (ADMIN)
  // POST /api/payroll/salary/create
  // PUT /api/payroll/update-salary/:id
  // ==========================================
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structureModalMode, setStructureModalMode] = useState('create'); // 'create' | 'edit'
  const [editingSalaryId, setEditingSalaryId] = useState(null);
  const [isSubmittingStructure, setIsSubmittingStructure] = useState(false);
  const [structureFormError, setStructureFormError] = useState('');

  const initialStructureForm = {
    userId: '',
    basicSalary: '',
    hra: '',
    allowance: '',
    fixedBonus: '',
    fixedDeduction: '',
    tdsPercentage: '',
    isActive: true
  };
  const [structureForm, setStructureForm] = useState(initialStructureForm);

  // Auto-calculated fields for Salary Structure modal
  const structureCalculations = useMemo(() => {
    const basic = Number(structureForm.basicSalary) || 0;
    const hra = Number(structureForm.hra) || 0;
    const allowance = Number(structureForm.allowance) || 0;
    const fixedBonus = Number(structureForm.fixedBonus) || 0;
    const fixedDeduction = Number(structureForm.fixedDeduction) || 0;
    const tdsPercentage = Number(structureForm.tdsPercentage) || 0;

    const grossSalary = basic + hra + allowance + fixedBonus;
    const tdsAmount = (grossSalary * tdsPercentage) / 100;
    const totalDeductions = fixedDeduction + tdsAmount;
    const netSalary = Math.max(0, grossSalary - totalDeductions);
    const annualCtc = grossSalary * 12;

    return {
      basic,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      grossSalary,
      tdsAmount,
      totalDeductions,
      netSalary,
      annualCtc
    };
  }, [structureForm]);

  // ==========================================
  // MODAL 2: PROCESS PAYROLL (ADMIN)
  // POST /api/payroll/process
  // ==========================================
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isSubmittingProcess, setIsSubmittingProcess] = useState(false);
  const [processFormError, setProcessFormError] = useState('');

  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();
  const currentMonthDays = getDaysInMonth(currentMonthNum, currentYearNum);

  const initialProcessForm = {
    userId: '',
    month: currentMonthNum,
    year: currentYearNum,
    totalDays: currentMonthDays,
    daysPayable: currentMonthDays,
    leaveDays: 0,
    lopDays: 0,
    extraBonus: '',
    extraDeduction: '',
    status: 'processed'
  };
  const [processForm, setProcessForm] = useState(initialProcessForm);
  const [isFetchingLeaves, setIsFetchingLeaves] = useState(false);

  // Live sync user leaves from backend API (GET /api/leave/my-leaves/:userId or /api/leave/all filtered by name/id)
  const syncUserLeavesFromBackend = async (userId, month, year, staffList = companyStaff) => {
    if (!userId) return;
    setIsFetchingLeaves(true);
    try {
      const targetUserObj = (staffList || companyStaff).find((s) => String(s._id || s.id) === String(userId)) || userId;
      const userLeaves = await fetchBackendUserLeaves(userId, targetUserObj);

      const targetM = Number(month);
      const targetY = Number(year);
      const totalMonthDays = getDaysInMonth(targetM, targetY);
      const leavesInfo = calculateApprovedLeaveDaysForMonth(targetUserObj, targetM, targetY, userLeaves);
      const defaultPayable = Math.max(0, totalMonthDays - (leavesInfo.lopDays || 0));

      setProcessForm((prev) => ({
        ...prev,
        totalDays: totalMonthDays,
        daysPayable: defaultPayable,
        leaveDays: leavesInfo.leaveDays,
        lopDays: leavesInfo.lopDays
      }));
    } catch (err) {
      console.warn('Failed to sync live leave data from backend API:', err);
    } finally {
      setIsFetchingLeaves(false);
    }
  };

  // Helper to sync user or month/year changes with live leave calculation from backend API
  const handleProcessUserOrDateChange = (field, value) => {
    const updated = {
      ...processForm,
      [field]: value
    };

    const targetUserId = field === 'userId' ? value : updated.userId;
    const targetM = field === 'month' ? Number(value) : Number(updated.month);
    const targetY = field === 'year' ? Number(value) : Number(updated.year);

    const totalMonthDays = getDaysInMonth(targetM, targetY);

    setProcessForm({
      ...updated,
      totalDays: totalMonthDays,
      daysPayable: totalMonthDays
    });

    if (targetUserId) {
      syncUserLeavesFromBackend(targetUserId, targetM, targetY, companyStaff);
    }
  };

  // Find active salary structure of the selected user for processing
  const selectedUserActiveStructure = useMemo(() => {
    if (!processForm.userId) return null;
    return allSalaries.find((s) => {
      const uId = typeof s.userId === 'object'
        ? String(s.userId?._id || s.userId?.id)
        : String(s.userId);
      return uId === String(processForm.userId) && s.isActive;
    }) || null;
  }, [processForm.userId, allSalaries]);

  // Real-time calculation for Process Payroll modal
  const processCalculations = useMemo(() => {
    const totalDays = Number(processForm.totalDays) || getDaysInMonth(processForm.month, processForm.year);
    const daysPayable = processForm.daysPayable !== '' && processForm.daysPayable !== undefined
      ? Number(processForm.daysPayable)
      : totalDays;
    const leaveDays = Number(processForm.leaveDays) || 0;
    const lopDays = Number(processForm.lopDays) || 0;
    // Explicit user specification: presentDays = daysPayable - leaveDays - lopDays
    const presentDays = Math.max(0, daysPayable - leaveDays - lopDays);

    if (!selectedUserActiveStructure) {
      return {
        hasStructure: false,
        basicSalary: 0,
        hra: 0,
        allowance: 0,
        fixedBonus: 0,
        fixedDeduction: 0,
        extraBonus: 0,
        extraDeduction: 0,
        grossSalary: 0,
        tdsPercentage: 0,
        tdsAmount: 0,
        totalDeduction: 0,
        netSalary: 0,
        totalDays,
        daysPayable,
        leaveDays,
        lopDays,
        presentDays,
        perDaySalary: 0,
        lopDeduction: 0
      };
    }

    const basic = Number(selectedUserActiveStructure.basicSalary) || 0;
    const hra = Number(selectedUserActiveStructure.hra) || 0;
    const allowance = Number(selectedUserActiveStructure.allowance) || 0;
    const fixedBonus = Number(selectedUserActiveStructure.fixedBonus) || 0;
    const fixedDeduction = Number(selectedUserActiveStructure.fixedDeduction) || 0;
    const tdsPercentage = Number(selectedUserActiveStructure.tdsPercentage) || 0;

    const extraBonus = Number(processForm.extraBonus) || 0;
    const extraDeduction = Number(processForm.extraDeduction) || 0;

    const grossSalary = basic + hra + allowance + fixedBonus + extraBonus;
    const tdsAmount = (grossSalary * tdsPercentage) / 100;
    const perDaySalary = totalDays > 0 ? Math.round((grossSalary / totalDays) * 100) / 100 : 0;
    const lopDeduction = Math.round(lopDays * perDaySalary * 100) / 100;

    const totalDeduction = Math.round((fixedDeduction + extraDeduction + tdsAmount + lopDeduction) * 100) / 100;
    const netSalary = Math.max(0, Math.round((grossSalary - totalDeduction) * 100) / 100);

    return {
      hasStructure: true,
      basicSalary: basic,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      extraBonus,
      extraDeduction,
      grossSalary,
      tdsPercentage,
      tdsAmount,
      totalDeduction,
      netSalary,
      totalDays,
      daysPayable,
      leaveDays,
      lopDays,
      presentDays,
      perDaySalary,
      lopDeduction
    };
  }, [selectedUserActiveStructure, processForm]);

  // ==========================================
  // 1. DATA FETCHING LOGIC
  // ==========================================

  // Fetch company staff users: GET /api/users/all
  const fetchStaffList = async () => {
    try {
      const res = await api.get('/api/users/all');
      const list = res.data?.users || res.data?.data || res.data || [];
      const staffArray = (Array.isArray(list) ? list : []).filter(u => !isUnknownEmployeeOrUser(u));
      setCompanyStaff(staffArray);
      return staffArray;
    } catch (err) {
      console.warn('Could not load company staff directory:', err.message);
      return [];
    }
  };

  // Fetch all company leaves for calculating approved leaveDays and daysPayable: GET /api/leave/all
  const fetchLeaves = async () => {
    try {
      const res = await api.get('/api/leave/all');
      const raw = res.data?.data || res.data?.leaves || (Array.isArray(res.data) ? res.data : []);
      const leavesList = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw.leaves) ? raw.leaves : (Array.isArray(raw.history) ? raw.history : []));
      setAllLeaves(leavesList);
      return leavesList;
    } catch (err) {
      console.warn('Could not load leaves for salary calculations:', err.message);
      return [];
    }
  };

  // Fetch all base salaries: GET /api/payroll/salary
  const fetchAdminSalaries = async (staffList) => {
    try {
      const salaryRes = await api.get('/api/payroll/salary');
      const rawSalaries =
        salaryRes.data?.data ||
        salaryRes.data?.salaries ||
        salaryRes.data?.salaryStructures ||
        (Array.isArray(salaryRes.data) ? salaryRes.data : []);

      const list = Array.isArray(rawSalaries) ? rawSalaries : [];

      const staffMap = new Map();
      (staffList || companyStaff || []).forEach((u) => {
        if (u?._id) staffMap.set(String(u._id), u);
        if (u?.id) staffMap.set(String(u.id), u);
      });

      const enriched = list.map((item) => {
        const uId = typeof item.userId === 'object'
          ? String(item.userId?._id || item.userId?.id || '')
          : String(item.userId || '');

        const matchedUser = staffMap.get(uId) || (typeof item.userId === 'object' ? item.userId : null);

        return {
          ...item,
          userObj: matchedUser || {
            _id: uId,
            name: item.userName || item.name || 'Staff Member',
            email: item.userEmail || item.email || '',
            role: item.role || 'employee'
          }
        };
      }).filter((item) => !isUnknownEmployeeOrUser(item.userObj) && !isUnknownEmployeeOrUser(item));

      enriched.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });

      setAllSalaries(enriched);
    } catch (err) {
      console.error('Error fetching admin salaries:', err);
      setAllSalaries([]);
    }
  };

  // Fetch all processed payrolls: GET /api/payroll
  const fetchProcessedPayrolls = async (staffList) => {
    try {
      const res = await api.get('/api/payroll');
      const rawData =
        res.data?.data ||
        res.data?.payrolls ||
        res.data?.payroll ||
        (Array.isArray(res.data) ? res.data : []);

      const list = Array.isArray(rawData) ? rawData : [];

      // Load persisted salary status and leave overrides so user status and leave changes remain persistent and live
      let savedOverrides = {};
      try {
        savedOverrides = JSON.parse(localStorage.getItem('payroll_status_overrides') || '{}');
      } catch { }

      let savedLeaveOverrides = {};
      try {
        savedLeaveOverrides = JSON.parse(localStorage.getItem('payroll_leave_overrides') || '{}');
      } catch { }

      const staffMap = new Map();
      (staffList || companyStaff || []).forEach((u) => {
        if (u?._id) staffMap.set(String(u._id), u);
        if (u?.id) staffMap.set(String(u.id), u);
      });

      const enriched = list.map((item) => {
        const uId = typeof item.userId === 'object'
          ? String(item.userId?._id || item.userId?.id || '')
          : typeof item.employeeId === 'object'
            ? String(item.employeeId?._id || item.employeeId?.id || '')
            : String(item.userId || item.employeeId || '');

        const matchedUser = staffMap.get(uId) || (typeof item.userId === 'object' ? item.userId : (typeof item.employeeId === 'object' ? item.employeeId : null));
        const pId = String(item._id || item.id || '');
        const rawStatus = String(savedOverrides[pId] || item.status || item.paymentStatus || item.salaryStatus || 'processed').toLowerCase().trim();
        const currentStatus = rawStatus === 'paid' ? 'paid' : 'processed';

        // Check for persisted leave overrides by payroll ID or by user_month_year key
        const userPeriodKey = `${uId}_${item.month}_${item.year}`;
        const leaveOverride = savedLeaveOverrides[pId] || savedLeaveOverrides[userPeriodKey] || null;

        const effectiveTotalDays = leaveOverride?.totalDays != null
          ? Number(leaveOverride.totalDays)
          : (item.totalDays != null ? Number(item.totalDays) : getDaysInMonth(item.month, item.year));

        const effectiveLeaveDays = leaveOverride?.leaveDays != null
          ? Number(leaveOverride.leaveDays)
          : (item.leaveDays != null ? Number(item.leaveDays) : 0);

        const effectiveLopDays = leaveOverride?.lopDays != null
          ? Number(leaveOverride.lopDays)
          : (item.lopDays != null ? Number(item.lopDays) : 0);

        const effectiveDaysPayable = leaveOverride?.daysPayable != null
          ? Number(leaveOverride.daysPayable)
          : (item.daysPayable != null ? Number(item.daysPayable) : effectiveTotalDays);

        // Explicit formula: presentDays = daysPayable - leaveDays - lopDays
        const calculatedPresDays = Math.max(0, effectiveDaysPayable - effectiveLeaveDays - effectiveLopDays);
        const effectivePresentDays = leaveOverride?.presentDays != null
          ? Number(leaveOverride.presentDays)
          : (item.presentDays != null ? Number(item.presentDays) : calculatedPresDays);

        const effectiveLopDeduction = leaveOverride?.lopDeduction != null
          ? Number(leaveOverride.lopDeduction)
          : (item.lopDeduction != null ? Number(item.lopDeduction) : 0);

        const effectiveNetSalary = leaveOverride?.netSalary != null
          ? Number(leaveOverride.netSalary)
          : item.netSalary;

        const effectiveTotalDeduction = leaveOverride?.totalDeduction != null
          ? Number(leaveOverride.totalDeduction)
          : item.totalDeduction;

        return {
          ...item,
          status: currentStatus,
          totalDays: effectiveTotalDays,
          workingDays: effectiveTotalDays,
          daysPayable: effectiveDaysPayable,
          leaveDays: effectiveLeaveDays,
          lopDays: effectiveLopDays,
          presentDays: effectivePresentDays,
          lopDeduction: effectiveLopDeduction,
          netSalary: effectiveNetSalary,
          totalDeduction: effectiveTotalDeduction,
          userObj: matchedUser || {
            _id: uId,
            name: item.userName || item.name || item.employeeId?.name || item.userId?.name || 'Staff Member',
            email: item.userEmail || item.email || item.employeeId?.email || item.userId?.email || '',
            role: item.role || item.employeeId?.role || item.userId?.role || 'employee'
          }
        };
      }).filter((item) => !isUnknownEmployeeOrUser(item.userObj) && !isUnknownEmployeeOrUser(item));

      enriched.sort((a, b) => {
        const yearDiff = (Number(b.year) || 0) - (Number(a.year) || 0);
        if (yearDiff !== 0) return yearDiff;
        const monthDiff = (Number(b.month) || 0) - (Number(a.month) || 0);
        if (monthDiff !== 0) return monthDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      setAllProcessedPayrolls(enriched);

      if (myMongoUserId) {
        const myPayrolls = enriched.filter((p) => {
          const pUserId = typeof p.userId === 'object'
            ? String(p.userId?._id || p.userId?.id || '')
            : typeof p.employeeId === 'object'
              ? String(p.employeeId?._id || p.employeeId?.id || '')
              : String(p.userId || p.employeeId || '');
          return pUserId === String(myMongoUserId);
        });
        setMyProcessedPayrolls(myPayrolls);
      }
    } catch (err) {
      console.warn('GET /api/payroll notice:', err.message);
      setAllProcessedPayrolls([]);
    }
  };

  // Payslips state management (avoiding failing GET /api/payroll/payslip 404 endpoint)
  const fetchPayslips = async (staffList) => {
    // Backend has no GET /api/payroll/payslip endpoint; payslips are maintained from processed payrolls
    return [];
  };

  // Fetch individual salary history & structure: GET /api/payroll/salary/user/:userId
  const fetchEmployeeSalary = async () => {
    if (!myMongoUserId) return;

    try {
      let userSalaries = [];
      try {
        const res = await api.get(`/api/payroll/salary/user/${myMongoUserId}`);
        const sData = res.data?.data || res.data?.salary || res.data?.salaryStructure || res.data;
        if (Array.isArray(sData)) {
          userSalaries = sData;
        } else if (sData && typeof sData === 'object') {
          userSalaries = [sData];
        }
      } catch (err1) {
        console.warn(`GET /api/payroll/salary/user/${myMongoUserId} notice:`, err1.response?.data?.message || err1.message);
      }

      if (userSalaries.length === 0) {
        try {
          const listRes = await api.get('/api/payroll/salary');
          const all = listRes.data?.data || listRes.data?.salaries || listRes.data || [];
          if (Array.isArray(all)) {
            const myEmail = (user?.email || '').toLowerCase().trim();
            userSalaries = all.filter((s) => {
              if (!s) return false;
              const sUserId = typeof s.userId === 'object' ? String(s.userId?._id || s.userId?.id || '') : String(s.userId || '');
              if (sUserId && sUserId === myMongoUserId) return true;
              const sEmail = ((typeof s.userId === 'object' ? s.userId?.email : '') || s.email || '').toLowerCase().trim();
              if (myEmail && sEmail && myEmail === sEmail) return true;
              return false;
            });
          }
        } catch { }
      }

      userSalaries.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      const activeStructure = userSalaries.find((s) => s.isActive) || userSalaries[0] || null;

      setMySalaryStructure(activeStructure);
      setMySalaryHistory(userSalaries);
    } catch (err) {
      console.error('Error fetching employee salary:', err);
    }
  };

  // Master refresh function
  const loadData = async (isManual = false, isSilent = false) => {
    if (isManual) setIsRefreshing(true);
    else if (!isSilent) setIsLoading(true);

    try {
      const staffList = await fetchStaffList();
      const leavesPromise = fetchLeaves();
      if (isAdmin) {
        await Promise.all([
          fetchAdminSalaries(staffList),
          fetchProcessedPayrolls(staffList),
          fetchPayslips(staffList),
          fetchEmployeeSalary(),
          leavesPromise
        ]);
      } else {
        await Promise.all([
          fetchEmployeeSalary(),
          fetchProcessedPayrolls(staffList),
          fetchPayslips(staffList),
          leavesPromise
        ]);
      }
    } finally {
      if (!isSilent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false, false);

    // Silent background auto-refresh every 15 seconds
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!isStructureModalOpen && !isProcessModalOpen && !isUpdatePayrollModalOpen) {
        loadData(false, true);
      }
    }, 15000);

    const handleFocus = () => {
      if (!isStructureModalOpen && !isProcessModalOpen && !isUpdatePayrollModalOpen) {
        loadData(false, true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isStructureModalOpen && !isProcessModalOpen && !isUpdatePayrollModalOpen) {
        loadData(false, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [myMongoUserId, isAdmin, isStructureModalOpen, isProcessModalOpen, isUpdatePayrollModalOpen]);

  // ==========================================
  // 2. ADMIN ACTIONS: CREATE / EDIT SALARY STRUCTURE
  // ==========================================

  const openCreateStructureModal = (preselectedUserId = '') => {
    setStructureModalMode('create');
    setEditingSalaryId(null);
    setStructureFormError('');
    setStructureForm({
      ...initialStructureForm,
      userId: preselectedUserId || (companyStaff.length > 0 ? String(companyStaff[0]._id || companyStaff[0].id) : '')
    });
    setIsStructureModalOpen(true);
  };

  const openEditStructureModal = (salaryRecord) => {
    if (!salaryRecord) return;
    setStructureModalMode('edit');
    setEditingSalaryId(salaryRecord._id);
    setStructureFormError('');

    const uId = typeof salaryRecord.userId === 'object'
      ? String(salaryRecord.userId?._id || salaryRecord.userId?.id || '')
      : String(salaryRecord.userId || '');

    setStructureForm({
      userId: uId,
      basicSalary: salaryRecord.basicSalary != null ? String(salaryRecord.basicSalary) : '',
      hra: salaryRecord.hra != null ? String(salaryRecord.hra) : '',
      allowance: salaryRecord.allowance != null ? String(salaryRecord.allowance) : '',
      fixedBonus: salaryRecord.fixedBonus != null ? String(salaryRecord.fixedBonus) : '',
      fixedDeduction: salaryRecord.fixedDeduction != null ? String(salaryRecord.fixedDeduction) : '',
      tdsPercentage: salaryRecord.tdsPercentage != null ? String(salaryRecord.tdsPercentage) : '',
      isActive: salaryRecord.isActive !== false
    });
    setIsStructureModalOpen(true);
  };

  const handleSubmitStructure = async (e) => {
    e.preventDefault();
    if (!structureForm.userId) {
      setStructureFormError('Please select an employee or team lead.');
      return;
    }
    if (structureForm.basicSalary === '' || Number(structureForm.basicSalary) < 0) {
      setStructureFormError('Basic Salary is required and must be 0 or greater.');
      return;
    }

    setIsSubmittingStructure(true);
    setStructureFormError('');

    const payload = {
      userId: structureForm.userId,
      basicSalary: structureCalculations.basic,
      hra: structureCalculations.hra,
      allowance: structureCalculations.allowance,
      fixedBonus: structureCalculations.fixedBonus,
      fixedDeduction: structureCalculations.fixedDeduction,
      tdsPercentage: structureCalculations.tdsPercentage,
      grossSalary: structureCalculations.grossSalary,
      netSalary: structureCalculations.netSalary,
      isActive: Boolean(structureForm.isActive)
    };

    try {
      if (structureModalMode === 'edit' && editingSalaryId) {
        // PUT: api/payroll/update-salary/:id
        await api.put(`/api/payroll/update-salary/${editingSalaryId}`, payload);
        setNotification({
          type: 'success',
          message: 'Salary structure updated successfully!'
        });
      } else {
        // POST: api/payroll/salary/create
        await api.post('/api/payroll/salary/create', payload);
        setNotification({
          type: 'success',
          message: 'New salary structure created successfully!'
        });
      }

      invalidateCache(/payroll/);
      invalidateCache(/salary/);
      setIsStructureModalOpen(false);
      await loadData(true);
    } catch (err) {
      console.error('Failed to save salary structure:', err);
      setStructureFormError(err.response?.data?.message || err.message || 'Failed to save salary structure.');
    } finally {
      setIsSubmittingStructure(false);
    }
  };

  // ==========================================
  // 3. ADMIN ACTIONS: PROCESS PAYROLL (POST api/payroll/process)
  // ==========================================

  const openProcessPayrollModal = (preselectedUserId = '') => {
    setProcessFormError('');
    const selectedUserId = preselectedUserId || (companyStaff.length > 0 ? String(companyStaff[0]._id || companyStaff[0].id) : '');
    const m = currentMonthNum;
    const y = currentYearNum;
    const totalMonthDays = getDaysInMonth(m, y);

    setProcessForm({
      ...initialProcessForm,
      userId: selectedUserId,
      month: m,
      year: y,
      totalDays: totalMonthDays,
      daysPayable: totalMonthDays,
      leaveDays: 0,
      lopDays: 0,
      status: 'processed'
    });
    setIsProcessModalOpen(true);

    if (selectedUserId) {
      syncUserLeavesFromBackend(selectedUserId, m, y, companyStaff);
    }
  };

  const handleSubmitProcessPayroll = async (e) => {
    e.preventDefault();
    if (!processForm.userId) {
      setProcessFormError('Please select a staff member to process payroll for.');
      return;
    }
    if (!selectedUserActiveStructure) {
      setProcessFormError('Selected staff member has no active salary structure. Please create one first.');
      return;
    }

    setIsSubmittingProcess(true);
    setProcessFormError('');

    const parsedMonth = Number(processForm.month);
    const parsedYear = Number(processForm.year);
    const extraBonusValue = Number(processForm.extraBonus) || 0;
    const extraDeductionValue = Number(processForm.extraDeduction) || 0;

    const selectedStatus = processForm.status || 'paid';
    const targetUserObj = companyStaff.find((s) => String(s._id || s.id) === String(processForm.userId));

    const structureSnapshot = {
      basicSalary: Number(selectedUserActiveStructure.basicSalary) || 0,
      hra: Number(selectedUserActiveStructure.hra) || 0,
      conveyanceAllowance: Number(selectedUserActiveStructure.conveyanceAllowance) || 0,
      medicalAllowance: Number(selectedUserActiveStructure.medicalAllowance) || 0,
      specialAllowance: Number(selectedUserActiveStructure.specialAllowance || selectedUserActiveStructure.allowance) || 0,
      dearnessAllowance: Number(selectedUserActiveStructure.dearnessAllowance) || 0,
      otherAllowances: Number(selectedUserActiveStructure.otherAllowances) || 0,
      fixedBonus: Number(selectedUserActiveStructure.fixedBonus) || 0,
      grossSalary: Number(selectedUserActiveStructure.grossSalary) || processCalculations.grossSalary,
      basicForPf: Number(selectedUserActiveStructure.basicForPf) || 0,
      pfDeduction: Number(selectedUserActiveStructure.pfDeduction) || 0,
      esicDeduction: Number(selectedUserActiveStructure.esicDeduction) || 0,
      professionalTax: Number(selectedUserActiveStructure.professionalTax) || 0,
      tds: processCalculations.tdsAmount || 0,
      totalDeduction: processCalculations.totalDeduction,
      netSalary: processCalculations.netSalary,
      employerContributions: selectedUserActiveStructure.employerContributions || {
        pf: 0,
        esic: 0,
        gratuity: 0,
        other: 0
      }
    };

    const monthName = MONTH_NAMES[parsedMonth - 1] || `Month ${parsedMonth}`;
    const formattedSalaryMonth = `${monthName} ${parsedYear}`;

    const targetLeaveDays = Number(processForm.leaveDays) || 0;
    const targetLopDays = Number(processForm.lopDays) || 0;
    const targetTotalDays = processCalculations.totalDays;
    const targetDaysPayable = processCalculations.daysPayable;
    const targetPresentDays = processCalculations.presentDays;
    const targetPerDaySalary = processCalculations.perDaySalary;
    const targetLopDeduction = processCalculations.lopDeduction;
    const targetGrossSalary = processCalculations.grossSalary;
    const targetTotalDeduction = processCalculations.totalDeduction;
    const targetNetSalary = processCalculations.netSalary;

    // Exact backend schema parameters conforming to MonthlySalary mongoose model and controller aliases
    const payload = {
      employeeId: processForm.userId,
      userId: processForm.userId,
      companyId: targetUserObj?.companyId?._id || targetUserObj?.companyId || null,
      branchId: targetUserObj?.branchId?._id || targetUserObj?.branchId || null,
      financialYearId: targetUserObj?.financialYearId || selectedUserActiveStructure.financialYearId || null,
      month: parsedMonth,
      year: parsedYear,
      salaryMonth: formattedSalaryMonth,
      salaryStructureId: selectedUserActiveStructure._id,
      salaryStructureSnapshot: structureSnapshot,
      calculationMode: "CALENDAR_DAYS",
      totalDays: targetTotalDays,
      workingDays: targetTotalDays,
      presentDays: targetPresentDays,
      daysPayable: targetDaysPayable,
      payableDays: targetDaysPayable,
      leaveDays: targetLeaveDays,
      leaves: targetLeaveDays,
      totalLeaveDays: targetLeaveDays,
      approvedLeaveDays: targetLeaveDays,
      approvedLeaves: targetLeaveDays,
      lopDays: targetLopDays,
      perDaySalary: targetPerDaySalary,
      lopDeduction: targetLopDeduction,
      basicSalary: Number(selectedUserActiveStructure.basicSalary) || 0,
      hra: Number(selectedUserActiveStructure.hra) || 0,
      conveyanceAllowance: Number(selectedUserActiveStructure.conveyanceAllowance) || 0,
      medicalAllowance: Number(selectedUserActiveStructure.medicalAllowance) || 0,
      specialAllowance: Number(selectedUserActiveStructure.specialAllowance || selectedUserActiveStructure.allowance) || 0,
      allowance: Number(selectedUserActiveStructure.allowance) || 0,
      dearnessAllowance: Number(selectedUserActiveStructure.dearnessAllowance) || 0,
      otherAllowances: Number(selectedUserActiveStructure.otherAllowances) || 0,
      fixedBonus: Number(selectedUserActiveStructure.fixedBonus) || 0,
      extraBonus: extraBonusValue,
      grossSalary: targetGrossSalary,
      basicForPf: Number(selectedUserActiveStructure.basicForPf) || 0,
      pfDeduction: Number(selectedUserActiveStructure.pfDeduction) || 0,
      esicDeduction: Number(selectedUserActiveStructure.esicDeduction) || 0,
      professionalTax: Number(selectedUserActiveStructure.professionalTax) || 0,
      tds: processCalculations.tdsAmount,
      tdsPercentage: Number(selectedUserActiveStructure.tdsPercentage) || 0,
      tdsAmount: processCalculations.tdsAmount,
      fixedDeduction: Number(selectedUserActiveStructure.fixedDeduction) || 0,
      extraDeduction: extraDeductionValue,
      otherDeductions: Number(selectedUserActiveStructure.otherDeductions) || 0,
      totalDeduction: targetTotalDeduction,
      netSalary: targetNetSalary,
      employerContributions: structureSnapshot.employerContributions,
      status: selectedStatus === 'paid' ? 'Paid' : 'Processed',
      paymentMode: "BANK_TRANSFER",
      remarks: processForm.remarks || `Monthly payroll for ${formattedSalaryMonth}`
    };

    try {
      // 1. POST: api/payroll/process - generates/creates monthly salary in backend
      const res = await api.post('/api/payroll/process', payload);
      const createdPayroll = res.data?.data || res.data?.payroll || res.data;
      const createdRecord = Array.isArray(createdPayroll)
        ? (createdPayroll.find(p => String(p.employeeId?._id || p.employeeId || p.userId?._id || p.userId) === String(processForm.userId)) || createdPayroll[0])
        : createdPayroll;
      const createdId = createdRecord?._id || createdRecord?.id;

      // 2. Synchronize leave data directly to backend monthly salary update API
      const backendSyncPayload = {
        employeeId: processForm.userId,
        userId: processForm.userId,
        month: parsedMonth,
        year: parsedYear,
        leaveDays: targetLeaveDays,
        leaves: targetLeaveDays,
        totalLeaveDays: targetLeaveDays,
        approvedLeaveDays: targetLeaveDays,
        approvedLeaves: targetLeaveDays,
        lopDays: targetLopDays,
        daysPayable: targetDaysPayable,
        payableDays: targetDaysPayable,
        presentDays: targetPresentDays,
        totalDays: targetTotalDays,
        workingDays: targetTotalDays,
        perDaySalary: targetPerDaySalary,
        lopDeduction: targetLopDeduction,
        grossSalary: targetGrossSalary,
        totalDeduction: targetTotalDeduction,
        netSalary: targetNetSalary,
        status: selectedStatus === 'paid' ? 'Paid' : 'Processed',
        paymentMode: "BANK_TRANSFER",
        paidAt: new Date().toISOString(),
        remarks: processForm.remarks || `Monthly payroll for ${formattedSalaryMonth}`
      };

      try {
        if (createdId) {
          await api.put(`/api/salaries/${createdId}/pay`, backendSyncPayload);
        } else {
          await api.put(`/api/salaries/${processForm.userId}/pay`, backendSyncPayload);
        }
      } catch (errSync1) {
        try {
          await api.put(`/api/salaries/${processForm.userId}/pay`, backendSyncPayload);
        } catch { }
      }

      // 3. Persist status and leave overrides locally for instant reactivity and perfect sync
      try {
        const savedOverrides = JSON.parse(localStorage.getItem('payroll_status_overrides') || '{}');
        if (createdId) savedOverrides[String(createdId)] = selectedStatus;
        savedOverrides[`${processForm.userId}_${parsedMonth}_${parsedYear}`] = selectedStatus;
        localStorage.setItem('payroll_status_overrides', JSON.stringify(savedOverrides));

        const savedLeaveOverrides = JSON.parse(localStorage.getItem('payroll_leave_overrides') || '{}');
        const leaveDataToSave = {
          leaveDays: targetLeaveDays,
          lopDays: targetLopDays,
          daysPayable: targetDaysPayable,
          presentDays: targetPresentDays,
          totalDays: targetTotalDays,
          workingDays: targetTotalDays,
          perDaySalary: targetPerDaySalary,
          lopDeduction: targetLopDeduction,
          grossSalary: targetGrossSalary,
          totalDeduction: targetTotalDeduction,
          netSalary: targetNetSalary,
          status: selectedStatus === 'paid' ? 'Paid' : 'Processed'
        };
        if (createdId) savedLeaveOverrides[String(createdId)] = leaveDataToSave;
        savedLeaveOverrides[`${processForm.userId}_${parsedMonth}_${parsedYear}`] = leaveDataToSave;
        localStorage.setItem('payroll_leave_overrides', JSON.stringify(savedLeaveOverrides));
      } catch { }

      // 4. Automatically generate official payslip immediately with full attendance details (POST: api/payroll/payslip/generate)
      const targetPayrollId = createdId || processForm.userId;
      if (targetPayrollId) {
        try {
          await api.post('/api/payroll/payslip/generate', {
            salaryId: targetPayrollId,
            id: targetPayrollId,
            payrollId: targetPayrollId,
            employeeId: processForm.userId,
            userId: processForm.userId,
            month: parsedMonth,
            year: parsedYear,
            salaryMonth: formattedSalaryMonth,
            calculationMode: "CALENDAR_DAYS",
            totalDays: targetTotalDays,
            workingDays: targetTotalDays,
            daysPayable: targetDaysPayable,
            leaveDays: targetLeaveDays,
            leaves: targetLeaveDays,
            totalLeaveDays: targetLeaveDays,
            lopDays: targetLopDays,
            presentDays: targetPresentDays,
            perDaySalary: targetPerDaySalary,
            lopDeduction: targetLopDeduction,
            basicSalary: Number(selectedUserActiveStructure.basicSalary) || 0,
            hra: Number(selectedUserActiveStructure.hra) || 0,
            allowance: Number(selectedUserActiveStructure.allowance) || 0,
            fixedBonus: Number(selectedUserActiveStructure.fixedBonus) || 0,
            extraBonus: extraBonusValue,
            grossSalary: targetGrossSalary,
            fixedDeduction: Number(selectedUserActiveStructure.fixedDeduction) || 0,
            extraDeduction: extraDeductionValue,
            totalDeduction: targetTotalDeduction,
            tdsPercentage: Number(selectedUserActiveStructure.tdsPercentage) || 0,
            tdsAmount: processCalculations.tdsAmount,
            netSalary: targetNetSalary,
            status: selectedStatus === 'paid' ? 'Paid' : 'Processed'
          });
        } catch (errGen) {
          console.warn('Auto payslip generation note:', errGen);
        }
      }

      setNotification({
        type: 'success',
        message: `Payroll processed with status '${selectedStatus.toUpperCase()}' & Leave data synchronized for ${formatMonthYear(parsedMonth, parsedYear)}!`
      });

      invalidateCache(/payroll/);
      invalidateCache(/salaries/);
      invalidateCache(/salary/);
      setIsProcessModalOpen(false);
      await loadData(true);
    } catch (err) {
      console.error('Failed to process payroll:', err);
      setProcessFormError(err.response?.data?.message || err.message || 'Failed to process payroll.');
    } finally {
      setIsSubmittingProcess(false);
    }
  };

  // ==========================================
  // 4. GENERATE PAYSLIP HTML HELPER FOR PRINT & PDF
  // ==========================================

  const generatePayslipHtml = (slip) => {
    const staffName = slip.userObj?.name || 'Staff Member';
    const staffEmail = slip.userObj?.email || '—';
    const roleTitle = getRoleLabel(slip.userObj);
    const period = formatMonthYear(slip.month, slip.year);
    const issueDate = formatDate(slip.createdAt || new Date());
    const grossVal = Number(slip.grossSalary) || 0;
    const netVal = Number(slip.netSalary) || 0;
    const basicVal = Number(slip.basicSalary) || 0;
    const hraVal = Number(slip.hra) || 0;
    const allowVal = Number(slip.allowance) || 0;
    const fixBonusVal = Number(slip.fixedBonus) || 0;
    const extBonusVal = Number(slip.extraBonus) || 0;
    const fixDedVal = Number(slip.fixedDeduction) || 0;
    const extDedVal = Number(slip.extraDeduction) || 0;
    const totDedVal = Number(slip.totalDeduction) || 0;
    const tdsAmtVal = Number(slip.tdsAmount) || 0;
    const tdsRate = slip.tdsPercentage || 0;

    const slipStatus = String(slip?.status || 'processed').toLowerCase() === 'paid' ? 'Paid' : 'Processed';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip_${period.replace(/\\s+/g, '_')}_${staffName.replace(/\\s+/g, '_')}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; background: #fff; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .company-title { font-size: 22px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px; }
    .sub-title { font-size: 13px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #dcfce7; color: #15803d; font-weight: 700; font-size: 11px; text-transform: uppercase; border: 1px solid #bbf7d0; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
    .info-group h4 { margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; }
    .info-group p { margin: 3px 0 0 0; color: #64748b; font-size: 12px; }
    .table-grid { display: flex; gap: 20px; margin-bottom: 24px; }
    .table-col { flex: 1; }
    .col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px; border-bottom: 2px solid #cbd5e1; margin-bottom: 8px; }
    .earnings-title { color: #166534; border-color: #86efac; }
    .deductions-title { color: #991b1b; border-color: #fca5a5; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; }
    td.amount { text-align: right; font-family: monospace; font-weight: 600; }
    .total-row { border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 13px; }
    .total-row td { padding-top: 10px; }
    .net-box { background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 10px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
    .net-label { font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase; }
    .net-amount { font-size: 26px; font-weight: 900; color: #047857; font-family: monospace; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">Kevalon Technology Pvt. Ltd.</div>
      <div class="sub-title">Monthly Employee Compensation Statement</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 14px; font-weight: 700;">${period}</div>
      <div style="margin-top: 4px;"><span class="status-badge" style="${slipStatus === 'Paid' ? 'background: #dcfce7; color: #15803d; border-color: #bbf7d0;' : 'background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe;'}">Status: ${slipStatus}</span></div>
    </div>
  </div>

  <div class="info-card">
    <div class="info-group">
      <h4>${staffName}</h4>
      <p>Role: ${roleTitle} • Email: ${staffEmail}</p>
    </div>
    <div class="info-group" style="text-align: right;">
      <p style="margin: 0;">Disbursement Date: <strong>${issueDate}</strong></p>
      <p>Payment Mode: <strong>Direct Bank Transfer</strong></p>
    </div>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; margin-top: -14px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 11px;">
    <div>Total Month Days: <strong style="font-family: monospace;">${slip.totalDays || 30}</strong></div>
    <div>Approved Leaves: <strong style="font-family: monospace; color: #b45309;">${slip.leaveDays ?? 0}</strong></div>
    <div>Total Payable Days: <strong style="font-family: monospace; color: #15803d;">${slip.daysPayable ?? 30}</strong></div>
    <div>Calculated Present Days: <strong style="font-family: monospace; color: #4338ca;">${slip.presentDays != null ? slip.presentDays : (slip.daysPayable != null ? Math.max(0, Number(slip.daysPayable) - (Number(slip.leaveDays) || 0) - (Number(slip.lopDays) || 0)) : '—')}</strong></div>
  </div>

  <div class="table-grid">
    <div class="table-col">
      <div class="col-title earnings-title">Earnings (Credits)</div>
      <table>
        <tbody>
          <tr><td>Basic Pay</td><td class="amount">${formatINR(basicVal)}</td></tr>
          <tr><td>House Rent Allowance (HRA)</td><td class="amount">${formatINR(hraVal)}</td></tr>
          <tr><td>Special Allowance</td><td class="amount">${formatINR(allowVal)}</td></tr>
          <tr><td>Fixed Monthly Bonus</td><td class="amount">${formatINR(fixBonusVal)}</td></tr>
          ${extBonusVal > 0 ? `<tr><td>Extra Incentive</td><td class="amount">+${formatINR(extBonusVal)}</td></tr>` : ''}
          <tr class="total-row"><td>Gross Earnings</td><td class="amount" style="color: #4338ca;">${formatINR(grossVal)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="table-col">
      <div class="col-title deductions-title">Deductions (Debits)</div>
      <table>
        <tbody>
          <tr><td>Fixed Deduction</td><td class="amount" style="color: #dc2626;">-${formatINR(fixDedVal)}</td></tr>
          ${extDedVal > 0 ? `<tr><td>Extra Deduction</td><td class="amount" style="color: #dc2626;">-${formatINR(extDedVal)}</td></tr>` : ''}
          <tr><td>TDS / Income Tax (${tdsRate}%)</td><td class="amount" style="color: #dc2626;">-${formatINR(tdsAmtVal)}</td></tr>
          <tr class="total-row"><td>Total Deductions</td><td class="amount" style="color: #dc2626;">-${formatINR(totDedVal)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-box">
    <div>
      <div class="net-label">Net Take-Home Salary</div>
      <div style="font-size: 11px; color: #047857; margin-top: 2px;">Credited to employee bank account</div>
    </div>
    <div class="net-amount">${formatINR(netVal)}</div>
  </div>

  <div class="footer">
    This is an officially verified computer-generated payslip statement issued by Kevalon Technology Pvt. Ltd. and requires no physical signature.
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
  };

  // ==========================================
  // MODAL LOGIC: UPDATE MONTHLY PAYROLL / MARK AS PAID
  // PUT /api/salaries/:id/pay
  // ==========================================
  const openUpdatePayrollModal = (payroll) => {
    if (!payroll) return;
    setSelectedPayrollToUpdate(payroll);
    setUpdatePayrollError('');

    const todayStr = new Date().toISOString().split('T')[0];
    let initialPaidDate = todayStr;
    if (payroll.paidAt) {
      try {
        const d = new Date(payroll.paidAt);
        if (!isNaN(d.getTime())) {
          initialPaidDate = d.toISOString().split('T')[0];
        }
      } catch { }
    }

    const rawStatus = String(payroll.status || 'processed').toLowerCase().trim();
    const currentStatus = rawStatus === 'paid' ? 'Paid' : 'Processed';

    setUpdatePayrollForm({
      paymentMode: payroll.paymentMode || 'CASH',
      status: currentStatus,
      paidAt: initialPaidDate,
      remarks: payroll.remarks || (payroll.paymentMode === 'CASH' || !payroll.paymentMode ? 'Salary paid in cash' : 'Salary disbursed'),
      extraBonus: payroll.extraBonus != null && Number(payroll.extraBonus) !== 0 ? String(payroll.extraBonus) : '',
      extraDeduction: payroll.extraDeduction != null && Number(payroll.extraDeduction) !== 0 ? String(payroll.extraDeduction) : '',
      totalDays: payroll.totalDays != null ? Number(payroll.totalDays) : getDaysInMonth(payroll.month, payroll.year),
      leaveDays: payroll.leaveDays != null ? Number(payroll.leaveDays) : 0,
      lopDays: payroll.lopDays != null ? Number(payroll.lopDays) : 0,
      daysPayable: payroll.daysPayable != null ? Number(payroll.daysPayable) : (payroll.totalDays || 30)
    });

    setIsUpdatePayrollModalOpen(true);
  };

  const updatePayrollCalculations = useMemo(() => {
    if (!selectedPayrollToUpdate) {
      return { grossSalary: 0, totalDeduction: 0, netSalary: 0, totalDays: 30, daysPayable: 30, leaveDays: 0, lopDays: 0, presentDays: 30, perDaySalary: 0, lopDeduction: 0 };
    }

    const prevExtraBonus = Number(selectedPayrollToUpdate.extraBonus) || 0;
    const prevExtraDeduction = Number(selectedPayrollToUpdate.extraDeduction) || 0;
    const prevLopDeduction = Number(selectedPayrollToUpdate.lopDeduction) || 0;

    const baseGross = (Number(selectedPayrollToUpdate.grossSalary) || 0) - prevExtraBonus;
    const baseDeductions = (Number(selectedPayrollToUpdate.totalDeduction) || 0) - prevExtraDeduction - prevLopDeduction;

    const newExtraBonus = Number(updatePayrollForm.extraBonus) || 0;
    const newExtraDeduction = Number(updatePayrollForm.extraDeduction) || 0;

    const totalDays = Number(updatePayrollForm.totalDays) || getDaysInMonth(selectedPayrollToUpdate.month, selectedPayrollToUpdate.year);
    const daysPayable = updatePayrollForm.daysPayable !== '' && updatePayrollForm.daysPayable !== undefined
      ? Number(updatePayrollForm.daysPayable)
      : totalDays;
    const leaveDays = Number(updatePayrollForm.leaveDays) || 0;
    const lopDays = Number(updatePayrollForm.lopDays) || 0;
    // Formula: presentDays = daysPayable - leaveDays - lopDays
    const presentDays = Math.max(0, daysPayable - leaveDays - lopDays);

    const grossSalary = Math.max(0, baseGross + newExtraBonus);
    const perDaySalary = totalDays > 0 ? Math.round((grossSalary / totalDays) * 100) / 100 : 0;
    const lopDeduction = Math.round(lopDays * perDaySalary * 100) / 100;

    const totalDeduction = Math.max(0, Math.round((baseDeductions + newExtraDeduction + lopDeduction) * 100) / 100);
    const netSalary = Math.max(0, Math.round((grossSalary - totalDeduction) * 100) / 100);

    return { grossSalary, totalDeduction, netSalary, totalDays, daysPayable, leaveDays, lopDays, presentDays, perDaySalary, lopDeduction };
  }, [selectedPayrollToUpdate, updatePayrollForm]);

  const handleSubmitUpdatePayroll = async (e) => {
    e.preventDefault();
    if (!selectedPayrollToUpdate) return;

    setIsSubmittingUpdatePayroll(true);
    setUpdatePayrollError('');

    const empId =
      selectedPayrollToUpdate.employeeId?._id ||
      selectedPayrollToUpdate.employeeId ||
      selectedPayrollToUpdate.userId?._id ||
      selectedPayrollToUpdate.userId ||
      selectedPayrollToUpdate._id;

    const formattedPaidAt = updatePayrollForm.paidAt
      ? new Date(updatePayrollForm.paidAt).toISOString()
      : new Date().toISOString();

    const wasAlreadyPaid = String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid';
    if (wasAlreadyPaid && String(updatePayrollForm.status || '').toLowerCase() === 'processed') {
      setUpdatePayrollError('Once payroll status is Paid, it cannot be changed back to Processed.');
      setIsSubmittingUpdatePayroll(false);
      return;
    }

    const chosenStatus = wasAlreadyPaid ? 'paid' : (String(updatePayrollForm.status || 'Processed').toLowerCase() === 'paid' ? 'paid' : 'processed');
    const payload = {
      paymentMode: updatePayrollForm.paymentMode || 'CASH',
      remarks: updatePayrollForm.remarks || '',
      paidAt: formattedPaidAt,
      status: chosenStatus,
      month: Number(selectedPayrollToUpdate.month),
      year: Number(selectedPayrollToUpdate.year),
      extraBonus: Number(updatePayrollForm.extraBonus) || 0,
      extraDeduction: Number(updatePayrollForm.extraDeduction) || 0,
      leaveDays: updatePayrollCalculations.leaveDays,
      leaves: updatePayrollCalculations.leaveDays,
      totalLeaveDays: updatePayrollCalculations.leaveDays,
      approvedLeaveDays: updatePayrollCalculations.leaveDays,
      lopDays: updatePayrollCalculations.lopDays,
      daysPayable: updatePayrollCalculations.daysPayable,
      payableDays: updatePayrollCalculations.daysPayable,
      presentDays: updatePayrollCalculations.presentDays,
      totalDays: updatePayrollCalculations.totalDays,
      workingDays: updatePayrollCalculations.totalDays,
      perDaySalary: updatePayrollCalculations.perDaySalary,
      lopDeduction: updatePayrollCalculations.lopDeduction,
      grossSalary: updatePayrollCalculations.grossSalary,
      totalDeduction: updatePayrollCalculations.totalDeduction,
      netSalary: updatePayrollCalculations.netSalary
    };

    try {
      let res;
      try {
        // PUT: https://kt-backend-yzr4.onrender.com/api/salaries/:id/pay
        res = await api.put(`/api/salaries/${empId}/pay`, payload);
      } catch (errPrimary) {
        if (selectedPayrollToUpdate._id && String(selectedPayrollToUpdate._id) !== String(empId)) {
          res = await api.put(`/api/salaries/${selectedPayrollToUpdate._id}/pay`, payload);
        } else {
          throw errPrimary;
        }
      }

      const updatedRecord = res.data?.data || res.data?.salary || res.data;
      const successMsg = res.data?.message || 'Monthly salary marked as Paid successfully';

      // Persist status and leave overrides locally
      const targetId = String(selectedPayrollToUpdate._id || empId);
      try {
        const savedOverrides = JSON.parse(localStorage.getItem('payroll_status_overrides') || '{}');
        savedOverrides[targetId] = payload.status;
        localStorage.setItem('payroll_status_overrides', JSON.stringify(savedOverrides));

        const savedLeaveOverrides = JSON.parse(localStorage.getItem('payroll_leave_overrides') || '{}');
        const leaveDataToSave = {
          leaveDays: updatePayrollCalculations.leaveDays,
          lopDays: updatePayrollCalculations.lopDays,
          daysPayable: updatePayrollCalculations.daysPayable,
          presentDays: updatePayrollCalculations.presentDays,
          totalDays: updatePayrollCalculations.totalDays,
          workingDays: updatePayrollCalculations.totalDays,
          perDaySalary: updatePayrollCalculations.perDaySalary,
          lopDeduction: updatePayrollCalculations.lopDeduction,
          grossSalary: updatePayrollCalculations.grossSalary,
          totalDeduction: updatePayrollCalculations.totalDeduction,
          netSalary: updatePayrollCalculations.netSalary,
          status: payload.status === 'paid' ? 'Paid' : 'Processed'
        };
        savedLeaveOverrides[targetId] = leaveDataToSave;
        savedLeaveOverrides[`${empId}_${payload.month}_${payload.year}`] = leaveDataToSave;
        localStorage.setItem('payroll_leave_overrides', JSON.stringify(savedLeaveOverrides));
      } catch { }

      // Update state live across tables
      setAllProcessedPayrolls((prev) =>
        prev.map((item) => {
          const itemId = String(item._id || item.id || '');
          const itemEmpId = String(item.employeeId?._id || item.employeeId || item.userId?._id || item.userId || '');
          if (itemId === targetId || itemEmpId === String(empId)) {
            return {
              ...item,
              ...(updatedRecord && typeof updatedRecord === 'object' ? updatedRecord : {}),
              status: payload.status,
              paymentMode: payload.paymentMode,
              remarks: payload.remarks,
              paidAt: payload.paidAt,
              leaveDays: updatePayrollCalculations.leaveDays,
              lopDays: updatePayrollCalculations.lopDays,
              daysPayable: updatePayrollCalculations.daysPayable,
              presentDays: updatePayrollCalculations.presentDays,
              totalDays: updatePayrollCalculations.totalDays,
              workingDays: updatePayrollCalculations.totalDays,
              perDaySalary: updatePayrollCalculations.perDaySalary,
              lopDeduction: updatePayrollCalculations.lopDeduction,
              netSalary: updatedRecord?.netSalary != null ? updatedRecord.netSalary : updatePayrollCalculations.netSalary,
              grossSalary: updatedRecord?.grossSalary != null ? updatedRecord.grossSalary : updatePayrollCalculations.grossSalary,
              totalDeduction: updatedRecord?.totalDeduction != null ? updatedRecord.totalDeduction : updatePayrollCalculations.totalDeduction
            };
          }
          return item;
        })
      );

      setMyProcessedPayrolls((prev) =>
        prev.map((item) => {
          const itemId = String(item._id || item.id || '');
          const itemEmpId = String(item.employeeId?._id || item.employeeId || item.userId?._id || item.userId || '');
          if (itemId === targetId || itemEmpId === String(empId)) {
            return {
              ...item,
              ...(updatedRecord && typeof updatedRecord === 'object' ? updatedRecord : {}),
              status: payload.status,
              paymentMode: payload.paymentMode,
              remarks: payload.remarks,
              paidAt: payload.paidAt,
              leaveDays: updatePayrollCalculations.leaveDays,
              lopDays: updatePayrollCalculations.lopDays,
              daysPayable: updatePayrollCalculations.daysPayable,
              presentDays: updatePayrollCalculations.presentDays,
              netSalary: updatedRecord?.netSalary != null ? updatedRecord.netSalary : updatePayrollCalculations.netSalary
            };
          }
          return item;
        })
      );

      invalidateCache(/salaries/);
      invalidateCache(/salary/);
      invalidateCache(/payroll/);

      setNotification({
        type: 'success',
        message: successMsg
      });

      setIsUpdatePayrollModalOpen(false);
      setSelectedPayrollToUpdate(null);
      await loadData(true);
    } catch (err) {
      console.error('Failed to update monthly payroll:', err);
      setUpdatePayrollError(
        err.response?.data?.message || err.message || 'Failed to update monthly payroll.'
      );
    } finally {
      setIsSubmittingUpdatePayroll(false);
    }
  };

  // ==========================================
  // CHANGE SALARY STATUS (ADMIN)
  // Updates live details in UI and synchronizes with backend PUT /api/salaries/:id/pay
  // ==========================================
  const handleChangeSalaryStatus = async (payroll, newStatus) => {
    const pId = String(payroll?._id || payroll?.id || '');
    if (!pId || !newStatus) return;

    const currentStatus = String(payroll?.status || '').toLowerCase().trim();
    if (currentStatus === 'paid' && String(newStatus).toLowerCase() !== 'paid') {
      setNotification({
        type: 'warning',
        message: 'Once salary status is Paid, it cannot be changed back to Processed.'
      });
      return;
    }

    setUpdatingStatusId(pId);

    // 1. Optimistic UI update across all active states so UI reflects live changes immediately
    setAllProcessedPayrolls((prev) =>
      prev.map((item) => {
        const id = String(item._id || item.id || '');
        return id === pId ? { ...item, status: newStatus } : item;
      })
    );

    setMyProcessedPayrolls((prev) =>
      prev.map((item) => {
        const id = String(item._id || item.id || '');
        return id === pId ? { ...item, status: newStatus } : item;
      })
    );

    setAllPayslips((prev) =>
      prev.map((ps) => {
        const matchId = String(ps.payrollId?._id || ps.payrollId || '');
        return matchId === pId ? { ...ps, status: newStatus } : ps;
      })
    );

    // 2. Persist in local storage so status is preserved across page reloads
    try {
      const savedOverrides = JSON.parse(localStorage.getItem('payroll_status_overrides') || '{}');
      savedOverrides[pId] = newStatus;
      localStorage.setItem('payroll_status_overrides', JSON.stringify(savedOverrides));
    } catch { }

    // 3. Update backend in real-time via PUT: api/salaries/:id/pay
    const empId =
      payroll.employeeId?._id ||
      payroll.employeeId ||
      payroll.userId?._id ||
      payroll.userId ||
      pId;

    const payload = {
      status: newStatus,
      paymentMode: payroll.paymentMode || 'CASH',
      paidAt: new Date().toISOString(),
      month: Number(payroll.month),
      year: Number(payroll.year),
      remarks: payroll.remarks || `Marked as ${newStatus}`
    };

    let backendUpdated = false;
    try {
      await api.put(`/api/salaries/${empId}/pay`, payload);
      backendUpdated = true;
      invalidateCache(/salaries/);
      invalidateCache(/payroll/);
    } catch (errPay) {
      console.warn('PUT /api/salaries/:id/pay notice:', errPay.response?.data?.message || errPay.message);
      if (payroll._id && String(payroll._id) !== String(empId)) {
        try {
          await api.put(`/api/salaries/${payroll._id}/pay`, payload);
          backendUpdated = true;
          invalidateCache(/salaries/);
          invalidateCache(/payroll/);
        } catch { }
      }
    }

    const staffName = payroll.userObj?.name || 'Staff Member';
    const period = formatMonthYear(payroll.month, payroll.year);

    setNotification({
      type: 'success',
      message: `Salary status updated to "${newStatus.toUpperCase()}" for ${staffName} (${period})`
    });

    setUpdatingStatusId(null);
  };

  // ==========================================
  // 5. DOWNLOAD & VIEW ACTIONS (OFFICIAL BACKEND PDF)
  // Uses POST: api/payroll/payslip/generate & GET: api/payroll/payslip
  // Downloads actual backend PDF binary directly
  // ==========================================
  const handleDownloadPayslipForPayroll = async (payroll) => {
    const isPaid = String(payroll?.status || '').toLowerCase() === 'paid';
    if (!isPaid) {
      setNotification({
        type: 'warning',
        message: 'Payslip PDF download is only allowed when payroll status is Paid.'
      });
      return;
    }

    const pId = payroll?._id || payroll?.id;
    if (!pId) return;

    setDownloadingSlipId(pId);
    try {
      // 1. Find matching payslip in state if already created
      let slip = allPayslips.find((ps) => {
        const psPayrollId = String(ps.payrollId?._id || ps.payrollId || '');
        const psUserId = String(ps.userId?._id || ps.userId || '');
        const payUserId = String(payroll.userId?._id || payroll.userId || '');
        return (psPayrollId && psPayrollId === String(pId)) ||
          (psUserId === payUserId && String(ps.month) === String(payroll.month) && String(ps.year) === String(payroll.year));
      }) || myPayslips.find((ps) => {
        const psPayrollId = String(ps.payrollId?._id || ps.payrollId || '');
        const psUserId = String(ps.userId?._id || ps.userId || '');
        const payUserId = String(payroll.userId?._id || payroll.userId || '');
        return (psPayrollId && psPayrollId === String(pId)) ||
          (psUserId === payUserId && String(ps.month) === String(payroll.month) && String(ps.year) === String(payroll.year));
      });

      const uId = typeof payroll.userId === 'object'
        ? String(payroll.userId?._id || payroll.userId?.id || '')
        : String(payroll.userId || '');

      // 2. If not yet present in state, auto-generate on backend (POST: api/payroll/payslip/generate)
      if (!slip) {
        try {
          const res = await api.post('/api/payroll/payslip/generate', {
            payrollId: pId,
            userId: uId,
            month: Number(payroll.month),
            year: Number(payroll.year),
            basicSalary: Number(payroll.basicSalary) || 0,
            hra: Number(payroll.hra) || 0,
            allowance: Number(payroll.allowance) || 0,
            fixedBonus: Number(payroll.fixedBonus) || 0,
            extraBonus: Number(payroll.extraBonus) || 0,
            grossSalary: Number(payroll.grossSalary) || 0,
            fixedDeduction: Number(payroll.fixedDeduction) || 0,
            extraDeduction: Number(payroll.extraDeduction) || 0,
            totalDeduction: Number(payroll.totalDeduction) || 0,
            tdsPercentage: Number(payroll.tdsPercentage) || 0,
            tdsAmount: Number(payroll.tdsAmount) || 0,
            netSalary: Number(payroll.netSalary) || 0
          });
          slip = res.data?.data || res.data?.payslip || res.data;
          invalidateCache(/payroll/);
        } catch (errGen) {
          console.warn('Auto payslip generate notice on download:', errGen);
        }
      }

      // Check if slip returned a direct hosted PDF URL
      const directPdfUrl = slip?.pdfUrl || slip?.pdf || slip?.fileUrl || slip?.downloadUrl || slip?.file;
      if (directPdfUrl && typeof directPdfUrl === 'string' && directPdfUrl.startsWith('http')) {
        window.open(directPdfUrl, '_blank');
        setNotification({
          type: 'success',
          message: 'Official backend PDF opened for download.'
        });
        return;
      }

      // 3. Download the official backend PDF binary format
      const slipId = slip?._id || slip?.id || pId;
      const staffName = payroll.userObj?.name || slip?.userObj?.name || 'Staff';
      const period = formatMonthYear(payroll.month, payroll.year);
      const fileName = `Payslip_${period.replace(/\s+/g, '_')}_${staffName.replace(/\s+/g, '_')}.pdf`;

      let downloaded = false;
      const pdfEndpoints = [
        `/api/payroll/payslip/pdf/${slipId}`,
        `/api/payroll/payslip/pdf/${pId}`,
        `/api/payroll/payslip/download/${slipId}`,
        `/api/payroll/payslip/download/${pId}`
      ];

      for (const endpoint of pdfEndpoints) {
        try {
          const pdfRes = await api.get(endpoint, {
            responseType: 'blob',
            skipCache: true
          });

          if (pdfRes.data && (pdfRes.data.size > 100 || (pdfRes.headers && String(pdfRes.headers['content-type']).includes('pdf')))) {
            const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            downloaded = true;
            setNotification({
              type: 'success',
              message: `Official backend PDF payslip downloaded successfully for ${staffName}!`
            });
            break;
          }
        } catch (errPdf) {
          console.warn(`PDF download from ${endpoint} notice:`, errPdf.message);
        }
      }

      // 4. Fallback to client print-to-PDF statement window if binary stream is blocked
      if (!downloaded) {
        const slipToPrint = {
          ...(slip || payroll),
          userObj: payroll.userObj || slip?.userObj || user,
          status: payroll.status || 'paid'
        };
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(generatePayslipHtml(slipToPrint));
          printWindow.document.close();
        }
      }
    } catch (err) {
      console.error('Payslip download error:', err);
      setNotification({
        type: 'error',
        message: 'Could not complete payslip download.'
      });
    } finally {
      setDownloadingSlipId(null);
    }
  };

  const handleViewPayslipForPayroll = (payroll) => {
    const pId = payroll?._id || payroll?.id;
    const existingPayslip = allPayslips.find((ps) => {
      const psPayrollId = String(ps.payrollId?._id || ps.payrollId || '');
      const psUserId = String(ps.userId?._id || ps.userId || '');
      const payUserId = String(payroll.userId?._id || payroll.userId || '');
      return (psPayrollId && psPayrollId === String(pId)) ||
        (psUserId === payUserId && String(ps.month) === String(payroll.month) && String(ps.year) === String(payroll.year));
    }) || myPayslips.find((ps) => {
      const psPayrollId = String(ps.payrollId?._id || ps.payrollId || '');
      const psUserId = String(ps.userId?._id || ps.userId || '');
      const payUserId = String(payroll.userId?._id || payroll.userId || '');
      return (psPayrollId && psPayrollId === String(pId)) ||
        (psUserId === payUserId && String(ps.month) === String(payroll.month) && String(ps.year) === String(payroll.year));
    });

    setViewingPayslipModal({
      ...(existingPayslip || payroll),
      userObj: payroll.userObj || existingPayslip?.userObj || user,
      status: String(payroll.status || existingPayslip?.status || 'processed').toLowerCase() === 'paid' ? 'paid' : 'processed'
    });
  };

  const handleDownloadPdf = async (slip) => {
    await handleDownloadPayslipForPayroll(slip);
  };

  const handleOpenPrintHtml = async (slip) => {
    const isPaid = String(slip?.status || '').toLowerCase() === 'paid';
    if (!isPaid) {
      setNotification({
        type: 'warning',
        message: 'Payslip statement printing is only available when payroll status is Paid.'
      });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(generatePayslipHtml(slip));
      printWindow.document.close();
    }
  };

  // ==========================================
  // 6. FILTERING & KPI CALCULATIONS
  // ==========================================

  // Filtered Processed Payrolls (GET /api/payroll)
  const filteredProcessedPayrolls = useMemo(() => {
    return allProcessedPayrolls.filter((item) => {
      const u = item.userObj || {};
      const name = (u.name || u.fullName || item.userName || '').toLowerCase();
      const email = (u.email || item.userEmail || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || email.includes(q);

      const role = getRoleLabel(u).toLowerCase();
      let matchesRole = true;
      if (roleFilter === 'team_lead') {
        matchesRole = role.includes('lead') || role === 'tl';
      } else if (roleFilter === 'employee') {
        matchesRole = !role.includes('lead') && role !== 'admin';
      }

      let matchesMonth = true;
      if (selectedMonthFilter !== 'all') {
        matchesMonth = String(item.month) === String(selectedMonthFilter);
      }

      let matchesYear = true;
      if (selectedYearFilter !== 'all') {
        matchesYear = String(item.year) === String(selectedYearFilter);
      }

      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = String(item.status || '').toLowerCase() === statusFilter.toLowerCase();
      }

      return matchesSearch && matchesRole && matchesMonth && matchesYear && matchesStatus;
    });
  }, [allProcessedPayrolls, searchQuery, roleFilter, selectedMonthFilter, selectedYearFilter, statusFilter]);



  // Filtered Salary Structures (GET /api/payroll/salary)
  const filteredSalaries = useMemo(() => {
    return allSalaries.filter((item) => {
      const u = item.userObj || {};
      const name = (u.name || u.fullName || item.userName || '').toLowerCase();
      const email = (u.email || item.userEmail || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || email.includes(q);

      const role = getRoleLabel(u).toLowerCase();
      let matchesRole = true;
      if (roleFilter === 'team_lead') {
        matchesRole = role.includes('lead') || role === 'tl';
      } else if (roleFilter === 'employee') {
        matchesRole = !role.includes('lead') && role !== 'admin';
      }

      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = item.isActive === true;
      } else if (statusFilter === 'inactive') {
        matchesStatus = item.isActive === false;
      }

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [allSalaries, searchQuery, roleFilter, statusFilter]);

  // KPI Metrics for Processed Payrolls (Live reactive stats based on changeable status)
  const payrollMetrics = useMemo(() => {
    let totalDisbursed = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let totalGross = 0;
    let totalTds = 0;
    let totalDeductions = 0;

    allProcessedPayrolls.forEach((p) => {
      const st = String(p.status || 'paid').toLowerCase();
      const net = Number(p.netSalary) || 0;
      totalGross += Number(p.grossSalary) || 0;
      totalTds += Number(p.tdsAmount) || 0;
      totalDeductions += Number(p.totalDeduction) || 0;

      if (st === 'paid' || st === 'processed') {
        paidCount++;
        totalDisbursed += net;
      } else {
        pendingCount++;
        totalPending += net;
      }
    });

    return {
      totalDisbursed,
      totalPending,
      paidCount,
      pendingCount,
      totalGross,
      totalTds,
      totalDeductions,
      totalCount: allProcessedPayrolls.length
    };
  }, [allProcessedPayrolls]);

  // Employee/TL KPI metrics
  const employeeMetrics = useMemo(() => {
    if (!mySalaryStructure) {
      return {
        hasStructure: false,
        basicSalary: 0,
        hra: 0,
        allowance: 0,
        fixedBonus: 0,
        fixedDeduction: 0,
        tdsPercentage: 0,
        grossSalary: 0,
        tdsAmount: 0,
        totalDeductions: 0,
        netSalary: 0,
        annualCtc: 0,
        isActive: false
      };
    }

    const basic = Number(mySalaryStructure.basicSalary) || 0;
    const hra = Number(mySalaryStructure.hra) || 0;
    const allowance = Number(mySalaryStructure.allowance) || 0;
    const fixedBonus = Number(mySalaryStructure.fixedBonus) || 0;
    const fixedDeduction = Number(mySalaryStructure.fixedDeduction) || 0;
    const tdsPercentage = Number(mySalaryStructure.tdsPercentage) || 0;

    const calculatedGross = basic + hra + allowance + fixedBonus;
    const grossSalary = Number(mySalaryStructure.grossSalary != null ? mySalaryStructure.grossSalary : calculatedGross);
    const tdsAmount = (grossSalary * tdsPercentage) / 100;
    const totalDeductions = fixedDeduction + tdsAmount;
    const netSalary = Number(mySalaryStructure.netSalary != null ? mySalaryStructure.netSalary : Math.max(0, grossSalary - totalDeductions));
    const annualCtc = grossSalary * 12;

    return {
      hasStructure: true,
      basicSalary: basic,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      grossSalary,
      tdsAmount,
      totalDeductions,
      netSalary,
      annualCtc,
      isActive: mySalaryStructure.isActive !== false
    };
  }, [mySalaryStructure]);

  // ==========================================
  // RENDER UI
  // ==========================================

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border shadow-xs transition-all ${notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75 rounded cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. TOP HEADER SECTION */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-200/60 text-indigo-600 rounded-lg shadow-xs">
            <Wallet size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isAdmin ? 'Salary & Payroll Processing' : isTL ? 'Team Lead Compensation & Payslips' : 'My Salary & Payslip Statements'}
              </h2>
              {/* <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200">
                {isAdmin ? 'Admin' : isTL ? 'Team Lead' : 'Employee'}
              </span> */}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Tabs */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setAdminViewMode('processed-payrolls')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'processed-payrolls'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Layers size={13} />
                <span>Monthly Payrolls ({allProcessedPayrolls.length})</span>
              </button>
              <button
                onClick={() => setAdminViewMode('salary-structures')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'salary-structures'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <CreditCard size={13} />
                <span>Structures ({allSalaries.length})</span>
              </button>
            </div>
          )}

          {/* Action Buttons for Admin */}
          {isAdmin && adminViewMode === 'processed-payrolls' && (
            <button
              onClick={() => openProcessPayrollModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Process Payroll</span>
            </button>
          )}

          {isAdmin && adminViewMode === 'salary-structures' && (
            <button
              onClick={() => openCreateStructureModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Structure</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-xs disabled:opacity-60"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. ADMIN VIEW: TAB 1 - PROCESSED MONTHLY PAYROLLS (GET /api/payroll) */}
      {/* ==================================================== */}
      {isAdmin && adminViewMode === 'processed-payrolls' && (
        <div className="space-y-6">

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full lg:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
              >
                <option value="all">All Months</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
              >
                <option value="all">All Years</option>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="processed">Processed</option>
                <option value="paid">Paid</option>
              </select>

              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  All Roles
                </button>
                <button
                  onClick={() => setRoleFilter('employee')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'employee'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  Employees
                </button>
                <button
                  onClick={() => setRoleFilter('team_lead')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'team_lead'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  Team Leads
                </button>
              </div>
            </div>
          </div>

          {/* Processed Payrolls Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-emerald-600" />
                <span>Processed Monthly Payroll Records</span>
              </h3>
            </div>

            {filteredProcessedPayrolls.length === 0 ? (
              <div className="p-12 text-center">
                <Layers size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">No processed payroll records found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || roleFilter !== 'all' || selectedMonthFilter !== 'all'
                    ? 'No processed payroll records match your filter criteria.'
                    : 'No monthly payrolls have been processed yet. Click "Process Payroll Run" to generate your first monthly disbursement.'}
                </p>
                <button
                  onClick={() => openProcessPayrollModal()}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles size={14} />
                  <span>Process First Monthly Payroll</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-3">Days (Pay/Leave/Pres)</th>
                      <th className="py-3 px-4">Base Gross</th>
                      <th className="py-3 px-4">Bonus</th>
                      <th className="py-3 px-4">Gross Total</th>
                      <th className="py-3 px-4">Deductions</th>
                      <th className="py-3 px-4">Net Disbursed</th>
                      <th className="py-3 px-4">Status</th>
                      {/* <th className="py-3 px-4">Payslip</th> */}
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProcessedPayrolls.map((payroll) => {
                      const u = payroll.userObj || {};
                      const roleLabel = getRoleLabel(u);
                      const isLead = roleLabel === 'Team Lead';

                      const gross = Number(payroll.grossSalary) || 0;
                      const net = Number(payroll.netSalary) || 0;
                      const extraB = Number(payroll.extraBonus) || 0;
                      const fixedB = Number(payroll.fixedBonus) || 0;
                      const totDed = Number(payroll.totalDeduction) || 0;
                      const tdsAmt = Number(payroll.tdsAmount) || 0;

                      // Check if payslip was already generated for this payroll
                      const existingPayslip = allPayslips.find((ps) => {
                        const psPayrollId = String(ps.payrollId?._id || ps.payrollId || '');
                        const psUserId = String(ps.userId?._id || ps.userId || '');
                        const payUserId = String(payroll.userId?._id || payroll.userId || '');
                        return (psPayrollId && psPayrollId === String(payroll._id)) ||
                          (psUserId === payUserId && String(ps.month) === String(payroll.month) && String(ps.year) === String(payroll.year));
                      });

                      const initials = (u.name || 'S')
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();


                      return (
                        <tr
                          key={payroll._id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              {formatMonthYear(payroll.month, payroll.year)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 text-white shadow-xs ${isLead ? 'bg-amber-500' : 'bg-indigo-600'
                                  }`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 truncate block">
                                    {u.name || 'Staff Member'}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${isLead
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700'
                                      }`}
                                  >
                                    {roleLabel}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {u.email || 'No email'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 font-mono text-[11px] whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 text-[10px]">Payable:</span>
                                <span className="font-bold text-emerald-700">
                                  {payroll.daysPayable != null ? payroll.daysPayable : (payroll.totalDays || 30)}d
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-amber-700 font-medium">Leaves: {payroll.leaveDays ?? 0}d</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-700 font-bold">
                                  Pres: {payroll.presentDays != null
                                    ? payroll.presentDays
                                    : (payroll.daysPayable != null
                                      ? Math.max(0, Number(payroll.daysPayable) - (Number(payroll.leaveDays) || 0) - (Number(payroll.lopDays) || 0))
                                      : '—')}d
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {formatINR(gross - extraB)}
                          </td>

                          <td className="py-3.5 px-2 font-semibold text-xs">
                            <div className="text-emerald-600 font-semibold">
                              +{formatINR(fixedB + extraB)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                            {formatINR(gross)}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-rose-600">
                            <div>-{formatINR(totDed)}</div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-bold text-sm text-emerald-600 px-2 py-0.5 rounded">
                              {formatINR(net)}
                            </span>
                          </td>

                          {/* Status - Changeable with live UI & Backend update */}
                          <td className="py-3.5 px-4">
                            {(() => {
                              const isPaid = String(payroll.status || '').toLowerCase() === 'paid';
                              return (
                                <div className="relative inline-block">
                                  <select
                                    value={isPaid ? 'paid' : 'processed'}
                                    disabled={isPaid || updatingStatusId === payroll._id}
                                    onChange={(e) => handleChangeSalaryStatus(payroll, e.target.value)}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition appearance-none capitalize shadow-2xs ${getStatusBadgeClass(payroll.status)} ${
                                      isPaid ? 'cursor-not-allowed pr-2.5 opacity-90' : 'cursor-pointer pr-6 hover:shadow-xs'
                                    }`}
                                    title={isPaid ? "Status is Paid and cannot be changed back to Processed" : "Click to mark as Paid"}
                                  >
                                    {!isPaid && <option value="processed">Processed</option>}
                                    <option value="paid">Paid</option>
                                  </select>
                                  {!isPaid && (
                                    updatingStatusId === payroll._id ? (
                                      <RefreshCw size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-500 pointer-events-none" />
                                    ) : (
                                      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                    )
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Payslip Download Column */}
                          {/* <td className="py-3.5 px-4"> */}
                          {/* <button
                            onClick={() => handleDownloadPayslipForPayroll(payroll)}
                            disabled={downloadingSlipId === payroll._id}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                            title="Download Official Payslip"
                          >
                            {downloadingSlipId === payroll._id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                          </button> */}
                          {/* </td> */}

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAdmin && (
                                <button
                                  onClick={() => openUpdatePayrollModal(payroll)}
                                  className="px-2.5 py-1.5 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                  title="Update Monthly Payroll"
                                >
                                  {/* <CreditCard size={12} /> */}
                                  <Edit3 size={14} />
                                  {/* <span>Update / Pay</span> */}
                                </button>
                              )}
                              <button
                                onClick={() => handleViewPayslipForPayroll(payroll)}
                                className="px-2.5 py-1.5 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="View Statement"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDownloadPayslipForPayroll(payroll)}
                                disabled={downloadingSlipId === payroll._id || String(payroll.status || '').toLowerCase() !== 'paid'}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                                  String(payroll.status || '').toLowerCase() === 'paid'
                                    ? 'hover:bg-indigo-100 text-indigo-700 cursor-pointer'
                                    : 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
                                }`}
                                title={
                                  String(payroll.status || '').toLowerCase() === 'paid'
                                    ? "Download Official Payslip"
                                    : "PDF download is only available when status is Paid"
                                }
                              >
                                {downloadingSlipId === payroll._id ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Download size={14} />
                                )}
                              </button>

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ==================================================== */}
      {/* 2. ADMIN VIEW: TAB 3 - SALARY STRUCTURES (GET /api/payroll/salary) */}
      {/* ==================================================== */}
      {isAdmin && adminViewMode === 'salary-structures' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  All Roles ({allSalaries.length})
                </button>
                <button
                  onClick={() => setRoleFilter('employee')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'employee'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  Employees
                </button>
                <button
                  onClick={() => setRoleFilter('team_lead')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${roleFilter === 'team_lead'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  Team Leads
                </button>
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${statusFilter === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${statusFilter === 'active'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-600'
                    }`}
                >
                  Active Only
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard size={16} className="text-indigo-600" />
                <span>Configured Staff Salary Structures</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Base compensation contracts: basic salary, HRA, allowance, bonus, deductions, and TDS
              </p>
            </div>

            {filteredSalaries.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No salary structures match your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Basic Pay</th>
                      <th className="py-3 px-4">HRA & Allowance</th>
                      <th className="py-3 px-4">Fixed Bonus</th>
                      <th className="py-3 px-4">Gross Salary</th>
                      <th className="py-3 px-4">Deduction & TDS</th>
                      <th className="py-3 px-4">Net Monthly</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSalaries.map((salary) => {
                      const u = salary.userObj || {};
                      const roleLabel = getRoleLabel(u);
                      const isLead = roleLabel === 'Team Lead';

                      const basic = Number(salary.basicSalary) || 0;
                      const hra = Number(salary.hra) || 0;
                      const allowance = Number(salary.allowance) || 0;
                      const bonus = Number(salary.fixedBonus) || 0;
                      const fixedDed = Number(salary.fixedDeduction) || 0;
                      const tdsPct = Number(salary.tdsPercentage) || 0;

                      const gross = Number(salary.grossSalary != null ? salary.grossSalary : basic + hra + allowance + bonus);
                      const tdsAmt = (gross * tdsPct) / 100;
                      const totalDed = fixedDed + tdsAmt;
                      const net = Number(salary.netSalary != null ? salary.netSalary : Math.max(0, gross - totalDed));

                      const initials = (u.name || 'S')
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr key={salary._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-xs ${isLead ? 'bg-amber-500' : 'bg-indigo-600'
                                  }`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 truncate block">
                                    {u.name || 'Staff Member'}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${isLead
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700'
                                      }`}
                                  >
                                    {roleLabel}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {u.email || 'No email'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-medium">{formatINR(basic)}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {formatINR(hra + allowance)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-600">
                            {bonus > 0 ? `+${formatINR(bonus)}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold">{formatINR(gross)}</td>
                          <td className="py-3.5 px-4 font-mono text-rose-600">-{formatINR(totalDed)}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                              {formatINR(net)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {salary.isActive !== false ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingDetailSalary(salary)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                                title="View Breakdown"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => openEditStructureModal(salary)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                                title="Edit Structure"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. EMPLOYEE & TL PERSONAL VIEW */}
      {/* ==================================================== */}
      {!isAdmin && (
        <div className="space-y-6">
          {/* Top Metric Cards: Base Salary Structure Matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Basic Salary", value: formatINR(employeeMetrics.basicSalary), accent: "border-l-indigo-600" },
              { label: "Allowances & Bonus", value: formatINR(employeeMetrics.hra + employeeMetrics.allowance + employeeMetrics.fixedBonus), accent: "border-l-purple-500" },
              { label: "Monthly Gross Salary", value: formatINR(employeeMetrics.grossSalary), accent: "border-l-amber-500" },
              { label: "Monthly Net Take-Home", value: formatINR(employeeMetrics.netSalary), accent: "border-l-emerald-500" }
            ].map((item, idx) => (
              <div
                key={idx}
                className={`bg-white border border-slate-200/80 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>


          {/* Processed Monthly Payroll Statements (GET /api/payroll) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers size={16} className="text-emerald-600" />
                  <span>Monthly Processed Payroll History ({myProcessedPayrolls.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Processed monthly payroll runs with earnings, deductions, paid status, and downloadable official payslips
                </p>
              </div>
            </div>

            {myProcessedPayrolls.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No monthly payroll runs processed yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Base Gross</th>
                      <th className="py-3 px-4">Bonus (Fixed + Extra)</th>
                      <th className="py-3 px-4">Gross Total</th>
                      <th className="py-3 px-4">Deductions & TDS</th>
                      <th className="py-3 px-4">Net Disbursed</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myProcessedPayrolls.map((rec) => (
                      <tr key={rec._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {formatMonthYear(rec.month, rec.year)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {formatINR((Number(rec.grossSalary) || 0) - (Number(rec.extraBonus) || 0))}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-600">
                          +{(Number(rec.fixedBonus) || 0) + (Number(rec.extraBonus) || 0) > 0
                            ? formatINR((Number(rec.fixedBonus) || 0) + (Number(rec.extraBonus) || 0))
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">{formatINR(rec.grossSalary)}</td>
                        <td className="py-3 px-4 font-mono text-rose-600">-{formatINR(rec.totalDeduction)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">{formatINR(rec.netSalary)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase shadow-2xs ${getStatusBadgeClass(rec.status)}`}>
                            {String(rec.status || 'processed').toLowerCase() === 'paid' ? 'Paid' : 'Processed'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button
                                onClick={() => openUpdatePayrollModal(rec)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-emerald-200"
                                title="Update Monthly Payroll / Mark as Paid"
                              >
                                <CreditCard size={12} />
                                <span>Update / Pay</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadPayslipForPayroll(rec)}
                              disabled={downloadingSlipId === rec._id || String(rec.status || '').toLowerCase() !== 'paid'}
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                                String(rec.status || '').toLowerCase() === 'paid'
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              }`}
                              title={
                                String(rec.status || '').toLowerCase() === 'paid'
                                  ? "Download Official Payslip"
                                  : "PDF download is only available when status is Paid"
                              }
                            >
                              {downloadingSlipId === rec._id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Download size={12} />
                              )}
                              <span>Download</span>
                            </button>
                            <button
                              onClick={() => handleViewPayslipForPayroll(rec)}
                              className="px-2 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="View Official Payslip"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: UPDATE MONTHLY PAYROLL / MARK AS PAID (PUT /api/salaries/:id/pay) */}
      {/* ==================================================== */}
      {isUpdatePayrollModalOpen && selectedPayrollToUpdate && (() => {
        const staff = selectedPayrollToUpdate.userObj || selectedPayrollToUpdate.employeeId || selectedPayrollToUpdate.userId || {};
        const staffName = staff.name || staff.fullName || resolveEmployeeName(staff) || 'Staff Member';
        const staffRole = getRoleLabel(staff);
        const staffInitials = (staffName || 'S')
          .split(' ')
          .map((w) => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();
        const periodStr = formatMonthYear(selectedPayrollToUpdate.month, selectedPayrollToUpdate.year);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
            onClick={() => !isSubmittingUpdatePayroll && setIsUpdatePayrollModalOpen(false)}
          >
            <div
              className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Update Monthly Payroll
                    </h3>
                    <p className="text-xs text-slate-400">
                      Update payment details & mark as Paid for {periodStr}
                    </p>
                  </div>
                </div>
                <button
                  disabled={isSubmittingUpdatePayroll}
                  onClick={() => setIsUpdatePayrollModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmitUpdatePayroll} className="p-6 overflow-y-auto space-y-4 text-xs">
                {updatePayrollError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{updatePayrollError}</span>
                  </div>
                )}

                {/* Staff Member Info Card (Dynamically derived, zero static data) */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {staffInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {staffName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {staffRole}
                      </span>
                      {(staff.uniqueID || staff.employeeId?.uniqueID) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-500 bg-slate-200">
                          {staff.uniqueID || staff.employeeId?.uniqueID}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Period: <strong className="text-slate-800 font-mono">{periodStr}</strong></span>
                      {(staff.designation || staff.department) && (
                        <span>• {staff.designation || ''}{staff.department ? ` (${staff.department})` : ''}</span>
                      )}
                      {(staff.email || selectedPayrollToUpdate.employeeId?.email) && (
                        <span>• {staff.email || selectedPayrollToUpdate.employeeId?.email}</span>
                      )}
                    </div>
                    {/* Dynamic Account Info if available */}
                    {(staff.bankAccountNumber || staff.bankDetails?.accountNumber || staff.bankDetails?.bankAccountNumber || staff.upiId || staff.bankDetails?.upiId) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                        {(staff.bankAccountNumber || staff.bankDetails?.accountNumber || staff.bankDetails?.bankAccountNumber) && (
                          <span>
                            <strong className="text-slate-700">A/C:</strong>{' '}
                            {staff.bankAccountNumber || staff.bankDetails?.accountNumber || staff.bankDetails?.bankAccountNumber}
                            {(staff.ifscCode || staff.bankDetails?.ifscCode) && ` (${staff.ifscCode || staff.bankDetails?.ifscCode})`}
                          </span>
                        )}
                        {(staff.upiId || staff.bankDetails?.upiId) && (
                          <span>
                            <strong className="text-slate-700">UPI:</strong>{' '}
                            {staff.upiId || staff.bankDetails?.upiId}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly Attendance & Leave Days Section */}
                <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Calendar size={14} className="text-indigo-600" />
                      <span>Monthly Attendance & Leave Days</span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      CALENDAR_DAYS ({updatePayrollCalculations.totalDays || 30}d)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Total Month Days
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={updatePayrollForm.totalDays ?? 30}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, totalDays: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Approved Leaves
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={updatePayrollForm.leaveDays ?? 0}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, leaveDays: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-amber-700 font-mono font-bold focus:outline-none focus:border-amber-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        LOP Days
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={updatePayrollForm.lopDays ?? 0}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, lopDays: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Total Payable Days <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="31"
                        step="0.5"
                        required
                        value={updatePayrollForm.daysPayable ?? 30}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, daysPayable: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg text-emerald-700 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 30"
                      />
                    </div>
                  </div>

                  {/* Present Days Calculation Indicator */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-indigo-50/80 rounded-lg border border-indigo-200/80 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                      <Calculator size={14} className="text-indigo-600 shrink-0" />
                      <span>
                        Formula: <code className="font-mono font-bold text-indigo-700 bg-white/90 px-1.5 py-0.5 rounded text-[11px]">presentDays = daysPayable - leaveDays - lopDays</code>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-[11px]">Calculated Present Days:</span>
                      <span className="font-mono font-black text-sm text-indigo-700 bg-white px-2.5 py-0.5 rounded-md border border-indigo-300 shadow-2xs">
                        {updatePayrollCalculations.presentDays} Days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Calculated Financial Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Earnings</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {formatINR(updatePayrollCalculations.grossSalary)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Deductions</span>
                    <span className="font-mono font-bold text-rose-600 text-xs">
                      -{formatINR(updatePayrollCalculations.totalDeduction)}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-2">
                    <span className="text-[10px] text-emerald-600 uppercase font-bold block">Net Take-Home</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      {formatINR(updatePayrollCalculations.netSalary)}
                    </span>
                  </div>
                </div>

                {/* Status & Payment Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Disbursement Status <span className="text-rose-500">*</span>
                      </label>
                      {String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Locked as Paid
                        </span>
                      )}
                    </div>
                    <select
                      value={String(updatePayrollForm.status || 'Processed').toLowerCase() === 'paid' ? 'Paid' : 'Processed'}
                      disabled={String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid'}
                      onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, status: e.target.value })}
                      className={`w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-semibold ${
                        String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid'
                          ? 'opacity-80 cursor-not-allowed bg-slate-100'
                          : 'cursor-pointer'
                      }`}
                      title={String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid' ? "Paid status is final and cannot be reverted to Processed" : "Select disbursement status"}
                    >
                      {String(selectedPayrollToUpdate.status || '').toLowerCase() !== 'paid' && (
                        <option value="Processed">Processed</option>
                      )}
                      <option value="Paid">Paid</option>
                    </select>
                    {String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid' && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Once marked as Paid, the status cannot be changed back to Processed.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={updatePayrollForm.paymentMode}
                      onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="CASH">CASH (Cash in Hand)</option>
                      <option value="BANK_TRANSFER">BANK TRANSFER (Direct Deposit)</option>
                      <option value="UPI">UPI (Google Pay / PhonePe)</option>
                      <option value="CHEQUE">CHEQUE</option>
                    </select>
                  </div>
                </div>

                {/* Payment Date & Remarks */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Date (Paid At)
                    </label>
                    <input
                      type="date"
                      value={updatePayrollForm.paidAt}
                      onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, paidAt: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Remarks / Note
                    </label>
                    <input
                      type="text"
                      value={updatePayrollForm.remarks}
                      onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, remarks: e.target.value })}
                      placeholder="e.g. Salary paid in cash"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Optional Payroll Adjustments */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">
                      Payroll Adjustments (Optional)
                    </span>
                    <span className="text-[10px] text-slate-400">Recalculates net amount</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Extra Bonus / Incentive (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={updatePayrollForm.extraBonus}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, extraBonus: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Extra Deduction / LOP (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={updatePayrollForm.extraDeduction}
                        onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, extraDeduction: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isSubmittingUpdatePayroll}
                    onClick={() => setIsUpdatePayrollModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUpdatePayroll}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isSubmittingUpdatePayroll ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>Update Payroll Status</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ==================================================== */}
      {/* 4. MODAL: PROCESS MONTHLY PAYROLL (POST api/payroll/process) */}
      {/* ==================================================== */}
      {isProcessModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isSubmittingProcess && setIsProcessModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Process Monthly Payroll
                  </h3>
                  <p className="text-xs text-slate-400">
                    Calculates and generates monthly payroll via POST /api/payroll/process
                  </p>
                </div>
              </div>
              <button
                disabled={isSubmittingProcess}
                onClick={() => setIsProcessModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitProcessPayroll} className="p-6 overflow-y-auto space-y-4">
              {processFormError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{processFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Staff Member (Employee or Team Lead) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={processForm.userId}
                  onChange={(e) => handleProcessUserOrDateChange('userId', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Staff Member --</option>
                  {companyStaff.map((s) => {
                    const id = String(s._id || s.id);
                    const role = getRoleLabel(s);
                    const hasActive = allSalaries.some((item) => {
                      const uId = typeof item.userId === 'object' ? String(item.userId?._id || item.userId?.id) : String(item.userId);
                      return uId === id && item.isActive;
                    });

                    return (
                      <option key={id} value={id}>
                        {s.name || s.fullName} ({role}) — {hasActive ? 'Active Structure Set' : '⚠️ No Structure'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payroll Month <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={processForm.month}
                    onChange={(e) => handleProcessUserOrDateChange('month', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {MONTH_NAMES.map((mName, idx) => (
                      <option key={idx} value={idx + 1}>
                        {mName} ({idx + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payroll Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={processForm.year}
                    onChange={(e) => handleProcessUserOrDateChange('year', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Monthly Attendance, Leave Days & Payable Days Section */}
              <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Calendar size={14} className="text-indigo-600" />
                    <span>Monthly Attendance & Leave Days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isFetchingLeaves ? (
                      <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        <RefreshCw size={11} className="animate-spin text-indigo-600" />
                        <span>Fetching leave API...</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => syncUserLeavesFromBackend(processForm.userId, processForm.month, processForm.year, companyStaff)}
                        disabled={!processForm.userId || isFetchingLeaves}
                        className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                        title="Re-sync approved leaves directly from backend API"
                      >
                        <RefreshCw size={10} />
                        <span>Sync Leaves</span>
                      </button>
                    )}
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      CALENDAR_DAYS ({processForm.totalDays || 30}d)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Total Month Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={processForm.totalDays}
                      onChange={(e) => setProcessForm({ ...processForm, totalDays: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Approved Leaves
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={processForm.leaveDays}
                      onChange={(e) => setProcessForm({ ...processForm, leaveDays: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-amber-700 font-mono font-bold focus:outline-none focus:border-amber-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      LOP Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={processForm.lopDays}
                      onChange={(e) => setProcessForm({ ...processForm, lopDays: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Total Payable Days <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="31"
                      step="0.5"
                      required
                      value={processForm.daysPayable}
                      onChange={(e) => setProcessForm({ ...processForm, daysPayable: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg text-emerald-700 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>

                {/* Present Days Calculation Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/80 rounded-lg border border-indigo-200/80 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                    <Calculator size={14} className="text-indigo-600 shrink-0" />
                    <span>
                      Formula: <code className="font-mono font-bold text-indigo-700 bg-white/90 px-1.5 py-0.5 rounded text-[11px]">presentDays = daysPayable - leaveDays - lopDays</code>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-[11px]">Calculated Present Days:</span>
                    <span className="font-mono font-black text-sm text-indigo-700 bg-white px-2.5 py-0.5 rounded-md border border-indigo-300 shadow-2xs">
                      {processCalculations.presentDays} Days
                    </span>
                  </div>
                </div>
              </div>

              {selectedUserActiveStructure ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-700 pb-1 border-b border-slate-200">
                    <span>Active Salary Contract ID</span>
                    <span className="font-mono text-[11px] text-indigo-600">
                      {String(selectedUserActiveStructure._id).slice(-8)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Basic Pay</span>
                      <span className="font-mono font-medium">{formatINR(selectedUserActiveStructure.basicSalary)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">HRA & Allowance</span>
                      <span className="font-mono font-medium">
                        {formatINR((Number(selectedUserActiveStructure.hra) || 0) + (Number(selectedUserActiveStructure.allowance) || 0))}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Fixed Bonus</span>
                      <span className="font-mono font-medium text-emerald-600">
                        +{formatINR(selectedUserActiveStructure.fixedBonus)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : processForm.userId ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>This staff member does not have an active salary structure. Please create one before processing payroll.</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Extra Bonus / Incentive (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={processForm.extraBonus}
                    onChange={(e) => setProcessForm({ ...processForm, extraBonus: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Extra Deduction (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1000"
                    value={processForm.extraDeduction}
                    onChange={(e) => setProcessForm({ ...processForm, extraDeduction: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Salary Disbursement Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={String(processForm.status || 'processed').toLowerCase() === 'paid' ? 'paid' : 'processed'}
                  onChange={(e) => setProcessForm({ ...processForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
                >
                  <option value="processed">Processed (Default)</option>
                  <option value="paid">Paid (Immediate Disbursal)</option>
                </select>
              </div>

              {/* Auto generate payslip note */}
              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={15} />
                <span>Status is changeable anytime from payrolls table • Official payslip automatically generated</span>
              </div>

              {selectedUserActiveStructure && (
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/70 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-800 border-b border-emerald-200/50 pb-1.5">
                    <span>Summary Payout Preview</span>
                    <span className="font-mono text-emerald-700">
                      {formatMonthYear(processForm.month, processForm.year)}
                    </span>
                  </div>

                  {/* Attendance & Days Metric Preview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-b border-emerald-200/40 pb-2 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Total Days</span>
                      <span className="font-mono font-bold text-slate-800">{processCalculations.totalDays}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-700 block uppercase font-semibold">Approved Leaves</span>
                      <span className="font-mono font-bold text-amber-800">{processCalculations.leaveDays} days</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block uppercase font-semibold">Payable Days</span>
                      <span className="font-mono font-bold text-emerald-800">{processCalculations.daysPayable} days</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-700 block uppercase font-semibold">Present Days</span>
                      <span className="font-mono font-black text-indigo-800">{processCalculations.presentDays} days</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Gross Payout</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatINR(processCalculations.grossSalary)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Total Deduct</span>
                      <span className="font-mono font-semibold text-rose-600">
                        -{formatINR(processCalculations.totalDeduction)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">TDS ({processCalculations.tdsPercentage}%)</span>
                      <span className="font-mono font-semibold text-rose-600">
                        -{formatINR(processCalculations.tdsAmount)}
                      </span>
                    </div>
                    <div className="bg-emerald-100/70 p-1.5 rounded">
                      <span className="text-[10px] text-emerald-800 block font-bold uppercase">
                        Net Disbursed
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {formatINR(processCalculations.netSalary)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingProcess}
                  onClick={() => setIsProcessModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProcess || !selectedUserActiveStructure}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isSubmittingProcess ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Execute Payroll Process</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL: CREATE / EDIT SALARY STRUCTURE (POST /api/payroll/salary/create) */}
      {/* ==================================================== */}
      {isStructureModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isSubmittingStructure && setIsStructureModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  {structureModalMode === 'edit' ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {structureModalMode === 'edit' ? 'Update Salary Structure' : 'Create Salary Structure'}
                  </h3>
                </div>
              </div>
              <button
                disabled={isSubmittingStructure}
                onClick={() => setIsStructureModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitStructure} className="p-6 overflow-y-auto space-y-4">
              {structureFormError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{structureFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Staff Member (Employee or Team Lead) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={structureForm.userId}
                  onChange={(e) => setStructureForm({ ...structureForm, userId: e.target.value })}
                  disabled={structureModalMode === 'edit'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Employee or Team Lead --</option>
                  {companyStaff.map((s) => {
                    const id = String(s._id || s.id);
                    const role = getRoleLabel(s);
                    const existing = allSalaries.find((item) => {
                      const uId = typeof item.userId === 'object' ? String(item.userId?._id || item.userId?.id) : String(item.userId);
                      return uId === id && item.isActive;
                    });

                    return (
                      <option key={id} value={id}>
                        {s.name || s.fullName} ({role}) — {existing ? `[Net: ₹${Number(existing.netSalary).toLocaleString()}]` : '[No Structure]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Basic Salary (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="e.g. 50000"
                    value={structureForm.basicSalary}
                    onChange={(e) => setStructureForm({ ...structureForm, basicSalary: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    House Rent Allowance - HRA (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 20000"
                    value={structureForm.hra}
                    onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Special / Other Allowance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 10000"
                    value={structureForm.allowance}
                    onChange={(e) => setStructureForm({ ...structureForm, allowance: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fixed Monthly Bonus (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 5000"
                    value={structureForm.fixedBonus}
                    onChange={(e) => setStructureForm({ ...structureForm, fixedBonus: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fixed Monthly Deduction (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 2000"
                    value={structureForm.fixedDeduction}
                    onChange={(e) => setStructureForm({ ...structureForm, fixedDeduction: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    TDS Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 10"
                    value={structureForm.tdsPercentage}
                    onChange={(e) => setStructureForm({ ...structureForm, tdsPercentage: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="structureActiveToggle"
                  checked={structureForm.isActive}
                  onChange={(e) => setStructureForm({ ...structureForm, isActive: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="structureActiveToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Set as <strong>Active Structure</strong>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSubmittingStructure}
                  onClick={() => setIsStructureModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStructure}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isSubmittingStructure ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>{structureModalMode === 'edit' ? 'Update Salary Structure' : 'Create Salary Structure'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MODAL: OFFICIAL PAYSLIP STATEMENT (PRINT & VIEW) */}
      {/* ==================================================== */}
      {viewingPayslipModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setViewingPayslipModal(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Official Salary Statement / Payslip
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formatMonthYear(viewingPayslipModal.month, viewingPayslipModal.year)} • {viewingPayslipModal.userObj?.name || 'Staff Member'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPayslipModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Content Body */}
            <div id="printable-payslip-content" className="p-6 overflow-y-auto space-y-5 text-xs bg-white">
              {/* Company & Employee Identity Banner */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">
                    Kevalon Technology Pvt. Ltd.
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    {viewingPayslipModal.userObj?.name || 'Staff Member'}
                  </h4>
                  <div className="flex items-center gap-2 text-slate-500 mt-0.5 text-[11px]">
                    <span>{getRoleLabel(viewingPayslipModal.userObj)}</span>
                    <span>•</span>
                    <span>{viewingPayslipModal.userObj?.email || '—'}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pay Period
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatMonthYear(viewingPayslipModal.month, viewingPayslipModal.year)}
                  </span>
                  <div className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase shadow-2xs ${getStatusBadgeClass(viewingPayslipModal.status)}`}>
                      Payment Status: {String(viewingPayslipModal.status || 'processed').toLowerCase() === 'paid' ? 'Paid' : 'Processed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Attendance & Working Days Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Month Days</span>
                  <span className="font-mono font-bold text-slate-800">{viewingPayslipModal.totalDays || 30} Days</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Approved Leaves</span>
                  <span className="font-mono font-bold text-amber-700">{viewingPayslipModal.leaveDays ?? 0} Days</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Payable Days</span>
                  <span className="font-mono font-bold text-emerald-700">{viewingPayslipModal.daysPayable ?? 30} Days</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase block">Present Days</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {viewingPayslipModal.presentDays != null
                      ? viewingPayslipModal.presentDays
                      : (viewingPayslipModal.daysPayable != null
                          ? Math.max(0, Number(viewingPayslipModal.daysPayable) - (Number(viewingPayslipModal.leaveDays) || 0) - (Number(viewingPayslipModal.lopDays) || 0))
                          : '—')} Days
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Earnings Table */}
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block pb-1 border-b border-slate-200/60">
                    Earnings Breakdown (Credits)
                  </span>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span>Basic Salary:</span>
                      <span className="font-mono font-semibold">{formatINR(viewingPayslipModal.basicSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>House Rent Allowance (HRA):</span>
                      <span className="font-mono font-semibold">{formatINR(viewingPayslipModal.hra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Special Allowance:</span>
                      <span className="font-mono font-semibold">{formatINR(viewingPayslipModal.allowance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed Monthly Bonus:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        +{formatINR(viewingPayslipModal.fixedBonus)}
                      </span>
                    </div>
                    {Number(viewingPayslipModal.extraBonus) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Extra Monthly Incentive:</span>
                        <span className="font-mono font-semibold">
                          +{formatINR(viewingPayslipModal.extraBonus)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Total Gross Earnings:</span>
                    <span className="font-mono text-indigo-600 text-sm">{formatINR(viewingPayslipModal.grossSalary)}</span>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block pb-1 border-b border-slate-200/60">
                    Deductions Breakdown (Debits)
                  </span>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span>Fixed Monthly Deduction:</span>
                      <span className="font-mono font-semibold text-rose-600">
                        -{formatINR(viewingPayslipModal.fixedDeduction)}
                      </span>
                    </div>
                    {Number(viewingPayslipModal.extraDeduction) > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>Extra Deduction:</span>
                        <span className="font-mono font-semibold">
                          -{formatINR(viewingPayslipModal.extraDeduction)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>TDS / Income Tax ({viewingPayslipModal.tdsPercentage || 0}%):</span>
                      <span className="font-mono font-semibold text-rose-600">
                        -{formatINR(viewingPayslipModal.tdsAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-8 border-t border-slate-200 flex justify-between font-bold text-rose-600">
                    <span>Total Monthly Deductions:</span>
                    <span className="font-mono text-sm">-{formatINR(viewingPayslipModal.totalDeduction)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary Highlight Box */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    Net Take-Home Pay
                  </span>
                  <span className="text-xs text-slate-500">Credited to employee bank account</span>
                </div>
                <span className="font-mono font-black text-2xl text-emerald-600">
                  {formatINR(viewingPayslipModal.netSalary)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPrintHtml(viewingPayslipModal)}
                  disabled={String(viewingPayslipModal.status || '').toLowerCase() !== 'paid'}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                    String(viewingPayslipModal.status || '').toLowerCase() === 'paid'
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    String(viewingPayslipModal.status || '').toLowerCase() === 'paid'
                      ? "Print Statement"
                      : "Printing is only available when status is Paid"
                  }
                >
                  <Printer size={13} />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => handleDownloadPayslipForPayroll(viewingPayslipModal)}
                  disabled={downloadingSlipId === (viewingPayslipModal._id || viewingPayslipModal.id) || String(viewingPayslipModal.status || '').toLowerCase() !== 'paid'}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                    String(viewingPayslipModal.status || '').toLowerCase() === 'paid'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    String(viewingPayslipModal.status || '').toLowerCase() === 'paid'
                      ? "Download Official PDF Payslip"
                      : "PDF download is only available when status is Paid"
                  }
                >
                  <Download size={13} />
                  <span>Download PDF</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const rec = viewingPayslipModal;
                      setViewingPayslipModal(null);
                      openUpdatePayrollModal(rec);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Update Monthly Payroll / Mark as Paid"
                  >
                    <CreditCard size={13} />
                    <span>Update / Pay</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setViewingPayslipModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. MODAL: VIEW BASE SALARY STRUCTURE BREAKDOWN */}
      {/* ==================================================== */}
      {viewingDetailSalary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setViewingDetailSalary(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Salary Structure Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    {viewingDetailSalary.userObj?.name || 'Staff Member'} ({getRoleLabel(viewingDetailSalary.userObj)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingDetailSalary(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Record Status</span>
                  <span className="font-semibold text-slate-800">
                    {viewingDetailSalary.isActive !== false ? 'Active Structure' : 'Archived Record'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Last Updated</span>
                  <span className="font-mono text-slate-700">
                    {formatDate(viewingDetailSalary.updatedAt || viewingDetailSalary.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Annual CTC</span>
                  <span className="font-mono font-bold text-indigo-600">
                    {formatINR((Number(viewingDetailSalary.grossSalary) || 0) * 12)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block pb-1 border-b border-slate-200">
                    Earnings (Credits)
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Basic Salary:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingDetailSalary.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">HRA:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingDetailSalary.hra)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Allowance:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingDetailSalary.allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bonus:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      +{formatINR(viewingDetailSalary.fixedBonus)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Gross Salary:</span>
                    <span className="font-mono">{formatINR(viewingDetailSalary.grossSalary)}</span>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block pb-1 border-b border-slate-200">
                    Deductions (Debits)
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fixed Deduction:</span>
                    <span className="font-mono font-semibold text-rose-600">
                      -{formatINR(viewingDetailSalary.fixedDeduction)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">TDS ({viewingDetailSalary.tdsPercentage || 0}%):</span>
                    <span className="font-mono font-semibold text-rose-600">
                      -{formatINR(((Number(viewingDetailSalary.grossSalary) || 0) * (Number(viewingDetailSalary.tdsPercentage) || 0)) / 100)}
                    </span>
                  </div>
                  <div className="pt-8 border-t border-slate-200 flex justify-between font-bold text-rose-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono">
                      -{formatINR((Number(viewingDetailSalary.fixedDeduction) || 0) + (((Number(viewingDetailSalary.grossSalary) || 0) * (Number(viewingDetailSalary.tdsPercentage) || 0)) / 100))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    Net Take-Home Salary
                  </span>
                  <span className="text-xs text-slate-500">Baseline monthly credited amount</span>
                </div>
                <span className="font-mono font-black text-xl text-emerald-600">
                  {formatINR(viewingDetailSalary.netSalary)}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {isAdmin && (
                <button
                  onClick={() => {
                    const rec = viewingDetailSalary;
                    setViewingDetailSalary(null);
                    openEditStructureModal(rec);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Edit This Structure</span>
                </button>
              )}
              <button
                onClick={() => setViewingDetailSalary(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
