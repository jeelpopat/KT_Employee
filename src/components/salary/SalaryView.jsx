import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, Plus, Edit3, Eye, Search, Filter, RefreshCw, CheckCircle2,
  AlertCircle, X, Download, Printer, Users, Shield, ArrowUpRight,
  ArrowDownRight, DollarSign, Percent, Calendar, Check, ChevronRight,
  Building2, CreditCard, Sparkles, FileText, Info, Award, UserCheck,
  TrendingUp, Clock, ChevronDown, CheckSquare, Layers, Send, Calculator,
  FileSpreadsheet, Receipt, PieChart
} from 'lucide-react';
import api, { invalidateCache } from '../../api/axios.js';
import { useApp, deriveUserRole, getRealAuthUserId, resolveEmployeeName } from '../../context/AppContext.jsx';
import { filterOutUnknownUsers, isUnknownEmployeeOrUser } from '../../utils/roleFilters.js';
import { DeductionBreakdownSection } from '../deductions/DeductionBreakdownSection.jsx';
import { DeductionMasterView } from '../deductions/DeductionMasterView.jsx';
import { EmployeeDeductionsView } from '../deductions/EmployeeDeductionsView.jsx';
import { DeductionReportsView } from '../deductions/DeductionReportsView.jsx';
import { previewPayrollWithDeductions } from '../../services/deductionService.js';

// Currency Formatter (Indian Rupee) - strictly formatted with 2 decimal places per specification
export const formatINR = (val) => {
  if (val == null || val === '') return '—';
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const getPreviewNumber = (preview, paths) => {
  for (const path of paths) {
    const value = path.split('.').reduce((source, key) => source?.[key], preview);
    if (value != null && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

const getPayrollPreviewValues = (preview) => {
  const values = {
    calendarDays: getPreviewNumber(preview, ['calendarDays', 'calendarDayCount', 'days.calendarDays', 'dayBreakdown.calendarDays', 'salaryCalculation.calendarDays', 'totalDays', 'days.totalDays']),
    sundays: getPreviewNumber(preview, ['sundays', 'sundayCount', 'sundayDays', 'days.sundays', 'days.sundayCount', 'dayBreakdown.sundays', 'salaryCalculation.sundays']),
    holidayDays: getPreviewNumber(preview, ['configuredHolidayDays', 'configuredHolidays', 'holidayDays', 'days.configuredHolidayDays', 'days.holidayDays', 'dayBreakdown.configuredHolidayDays', 'salaryCalculation.configuredHolidayDays']),
    workingDays: getPreviewNumber(preview, ['workingDays', 'calculationDivisor', 'days.workingDays', 'days.calculationDivisor', 'dayBreakdown.workingDays', 'salaryCalculation.workingDays']),
    perDaySalary: getPreviewNumber(preview, ['perDaySalary', 'summary.perDaySalary', 'salaryCalculation.perDaySalary']),
    approvedLeaveDays: getPreviewNumber(preview, ['approvedUnpaidLeaveDays', 'approvedLeaveDays', 'leaveDays', 'days.approvedLeaveDays', 'leaveDeductions.approvedLeaveDays']),
    unauthorizedFullDays: getPreviewNumber(preview, ['unauthorizedFullDays', 'unauthorizedFullDayCount', 'unauthorizedFullDayIncidentCount', 'days.unauthorizedFullDays']),
    unauthorizedHalfDays: getPreviewNumber(preview, ['unauthorizedHalfDays', 'unauthorizedHalfDayCount', 'unauthorizedHalfDayIncidentCount', 'days.unauthorizedHalfDays']),
    unauthorizedAbsenceDays: getPreviewNumber(preview, ['actualAbsenceDays', 'unauthorizedAbsenceDays', 'unapprovedLeaveDays', 'days.actualAbsenceDays', 'days.unapprovedLeaveDays', 'leaveDeductions.actualAbsenceDays']),
    lopDays: getPreviewNumber(preview, ['lopDays', 'days.lopDays']),
    daysPayable: getPreviewNumber(preview, ['payableDays', 'daysPayable', 'days.payableDays', 'days.daysPayable', 'summary.daysPayable']),
    monthlySalary: getPreviewNumber(preview, ['monthlySalary', 'monthlyBaseSalary', 'summary.monthlySalary', 'salaryCalculation.monthlySalary']),
    grossSalary: getPreviewNumber(preview, ['grossEarnings', 'grossSalary', 'summary.grossEarnings', 'summary.grossSalary']),
    lopDeduction: getPreviewNumber(preview, ['lopAmount', 'lopDeduction', 'leaveDeductions.lopDeduction', 'leaveDeductions.unpaidLeaveDeduction', 'unpaidLeaveDeduction', 'summary.lopDeduction']),
    proposedPenalty: getPreviewNumber(preview, ['proposedPenalty', 'proposedPenaltyAmount', 'leaveDeductions.proposedPenalty', 'leaveDeductions.proposedPenaltyAmount']),
    appliedPenalty: getPreviewNumber(preview, ['appliedPenalty', 'appliedPenaltyAmount', 'legallyApprovedPenalties', 'authorizedPenalty', 'summary.appliedPenalty', 'summary.appliedPenaltyAmount']),
    totalDeduction: getPreviewNumber(preview, ['totalDeduction', 'totalDeductions', 'summary.totalDeductions']),
    netSalary: getPreviewNumber(preview, ['netSalary', 'summary.netSalary']),
    pfDeduction: getPreviewNumber(preview, ['statutoryDeductions.pfDeduction', 'pfDeduction']),
    esicDeduction: getPreviewNumber(preview, ['statutoryDeductions.esicDeduction', 'esicDeduction']),
    professionalTax: getPreviewNumber(preview, ['statutoryDeductions.professionalTax', 'professionalTax']),
    tdsAmount: getPreviewNumber(preview, ['statutoryDeductions.tds', 'tdsAmount', 'tds'])
  };
  values.earnedBaseSalary = getPreviewNumber(preview, ['earnedBaseSalary', 'earnedSalary', 'summary.earnedBaseSalary', 'summary.earnedSalary'])
    ?? (values.monthlySalary != null && values.lopDeduction != null
      ? Number((values.monthlySalary - values.lopDeduction).toFixed(2))
      : null);
  return values;
};

const getPayrollDeductionBreakdown = (payroll, fallbackPayslip) => {
  const sources = [
    payroll,
    payroll?.salaryStructureSnapshot,
    fallbackPayslip,
    fallbackPayslip?.salaryStructureSnapshot
  ].filter(Boolean);

  const readAmount = (keys) => {
    let firstDefinedAmount;
    for (const source of sources) {
      for (const key of keys) {
        if (source[key] != null && Number.isFinite(Number(source[key]))) {
          const amount = Number(source[key]);
          if (amount !== 0) return amount;
          if (firstDefinedAmount === undefined) firstDefinedAmount = amount;
        }
      }
    }
    return firstDefinedAmount;
  };

  // Check for itemized employee custom deductions
  const rawCustomDeds = (
    payroll?.customDeductions?.approvedAndPermissible ||
    payroll?.employeeDeductions ||
    payroll?.customDeductions ||
    fallbackPayslip?.customDeductions?.approvedAndPermissible ||
    fallbackPayslip?.employeeDeductions ||
    fallbackPayslip?.customDeductions ||
    []
  );
  const customDeductionsList = Array.isArray(rawCustomDeds) ? rawCustomDeds : [];
  const customDeductionTotal = customDeductionsList.length > 0
    ? Math.round(customDeductionsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) * 100) / 100
    : (readAmount(['totalCustomDeductions', 'customDeductionTotal', 'employeeDeductionTotal']) || 0);

  const appliedPenaltyAmount = readAmount(['appliedPenalty', 'legallyApprovedPenalty', 'legallyApprovedPenalties', 'authorizedPenalty']) || 0;

  const components = [
    { key: 'fixedDeduction', label: 'Fixed Monthly Deduction', amount: readAmount(['fixedDeduction']) || 0 },
    { key: 'extraDeduction', label: 'Extra Deduction', amount: readAmount(['extraDeduction']) || 0 },
    { key: 'pfDeduction', label: 'Provident Fund (PF)', amount: readAmount(['pfDeduction']) || 0 },
    { key: 'esicDeduction', label: 'ESIC', amount: readAmount(['esicDeduction']) || 0 },
    { key: 'professionalTax', label: 'Professional Tax', amount: readAmount(['professionalTax']) || 0 },
    { key: 'otherDeductions', label: 'Other Deductions', amount: readAmount(['otherDeductions']) || 0 },
    { key: 'lopDeduction', label: 'Loss of Pay (LOP)', amount: readAmount(['lopDeduction', 'unpaidLeaveDeduction']) || 0 },
    { key: 'tdsAmount', label: 'TDS / Income Tax', amount: readAmount(['tdsAmount', 'tds']) || 0 },
    ...(appliedPenaltyAmount > 0 ? [{ key: 'appliedPenalty', label: 'Applied Disciplinary Penalty', amount: appliedPenaltyAmount }] : []),
    ...(customDeductionTotal > 0 ? [{ key: 'employeeDeductions', label: 'Additional Employee Deductions', amount: customDeductionTotal, isCustom: true }] : [])
  ];
  const componentTotal = Math.round(components.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const persistedTotal = readAmount(['totalDeduction', 'totalDeductions']);
  const grossSalary = readAmount(['grossSalary']);
  const netSalary = readAmount(['netSalary']);
  const grossNetDifference = grossSalary != null && netSalary != null
    ? Math.round((grossSalary - netSalary) * 100) / 100
    : undefined;
  const resolvedTotalDeduction = persistedTotal ?? grossNetDifference
    ?? (components.some((item) => item.amount > 0) ? componentTotal : null);
  const totalDeduction = resolvedTotalDeduction == null
    ? null
    : Math.round(resolvedTotalDeduction * 100) / 100;
  const tdsPercentage = readAmount(['tdsPercentage']) || 0;

  return {
    components,
    customDeductionsList,
    customDeductionTotal,
    totalDeduction,
    tdsPercentage,
    reconciliation: totalDeduction == null ? null : Math.round((totalDeduction - componentTotal) * 100) / 100
  };
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
  const s = String(status || 'generated').toLowerCase();
  switch (s) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'approved':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'generated':
    case 'processed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
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
    structureType: 'SIMPLE_FIXED', // 'SIMPLE_FIXED' | 'COMPONENT_BASED'
    fixedSalary: '',
    basicSalary: '',
    hra: '',
    allowance: '',
    extraAllowance: '',
    incentive: '',
    bonus: '',
    fixedBonus: '',
    fixedDeduction: '',
    tdsPercentage: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    autoCalculateStatutory: true,
    isPfApplicable: true,
    isEsicApplicable: true,
    isPtApplicable: true,
    isTdsApplicable: true,
    isActive: true
  };
  const [structureForm, setStructureForm] = useState(initialStructureForm);

  // Auto-calculated fields for Salary Structure modal supporting SIMPLE_FIXED & COMPONENT_BASED
  const structureCalculations = useMemo(() => {
    const isFixed = structureForm.structureType === 'SIMPLE_FIXED';
    const fixedSalary = Number(structureForm.fixedSalary) || 0;
    const basic = isFixed ? fixedSalary : (Number(structureForm.basicSalary) || 0);
    const hra = isFixed ? 0 : (Number(structureForm.hra) || 0);
    const allowance = isFixed ? 0 : (Number(structureForm.allowance) || 0);
    const extraAllowance = Number(structureForm.extraAllowance) || 0;
    const incentive = Number(structureForm.incentive) || 0;
    const bonus = Number(structureForm.bonus) || 0;
    const fixedBonus = isFixed ? 0 : (Number(structureForm.fixedBonus) || 0);
    const fixedDeduction = Number(structureForm.fixedDeduction) || 0;
    const tdsPercentage = Number(structureForm.tdsPercentage) || 0;

    // Gross Salary = Basic (or Fixed) + HRA + Allowances + Recurring Allowances + Bonuses
    const grossSalary = Math.round((basic + hra + allowance + extraAllowance + incentive + bonus + fixedBonus) * 100) / 100;
    const baseGross = grossSalary;

    // Statutory Calculations
    const basicForPf = basic;
    const pfDeduction = structureForm.isPfApplicable ? Math.round(basicForPf * 0.12) : 0;
    const esicDeduction = structureForm.isEsicApplicable ? Math.round(grossSalary * 0.0075) : 0;
    // PT applies only if Gross > 12000 (standard state slabs)
    const professionalTax = (structureForm.isPtApplicable && grossSalary > 12000) ? 200 : 0;
    const tdsAmount = structureForm.isTdsApplicable ? Math.round(((grossSalary * tdsPercentage) / 100) * 100) / 100 : 0;

    const totalStatutory = pfDeduction + esicDeduction + professionalTax;
    const totalDeductions = Math.round((fixedDeduction + totalStatutory + tdsAmount) * 100) / 100;
    const netSalary = Math.max(0, Math.round((grossSalary - totalDeductions) * 100) / 100);
    const annualCtc = Math.round(grossSalary * 12 * 100) / 100;

    return {
      isFixed,
      fixedSalary,
      basic,
      hra,
      allowance,
      extraAllowance,
      incentive,
      bonus,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      baseGross,
      grossSalary,
      basicForPf,
      pfDeduction,
      esicDeduction,
      professionalTax,
      totalStatutory,
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
    approvedLeaveDays: 0,
    unauthorizedFullDays: 0,
    unauthorizedHalfDays: 0,
    unauthorizedAbsenceDays: 0,
    lopDays: 0,
    extraAllowance: '',
    incentive: '',
    bonus: '',
    extraBonus: '',
    extraDeduction: '',
    status: 'Generated', // Generated by default; do not auto-mark Paid
    remarks: '',
    applyLegallyApprovedPenalty: false,
    legallyApprovedPenaltyAmount: 0,
    penaltyDate: ''
  };
  const [processForm, setProcessForm] = useState(initialProcessForm);
  const [isFetchingLeaves, setIsFetchingLeaves] = useState(false);
  const [processCustomDeductions, setProcessCustomDeductions] = useState([]);
  const [processExcludedDeductions, setProcessExcludedDeductions] = useState([]);
  const [isLoadingDeductionPreview, setIsLoadingDeductionPreview] = useState(false);
  const [liveDeductionPreview, setLiveDeductionPreview] = useState(null);
  const [processPreviewError, setProcessPreviewError] = useState('');
  const [updatePayrollPreview, setUpdatePayrollPreview] = useState(null);
  const [isLoadingUpdatePayrollPreview, setIsLoadingUpdatePayrollPreview] = useState(false);
  const [updatePayrollPreviewError, setUpdatePayrollPreviewError] = useState('');
  const processPreviewRequestId = useRef(0);

  // Live sync employee custom approved deductions and preview from backend API
  const syncCustomDeductionsForPayroll = async (targetUserId, targetM, targetY, formOverrides = {}) => {
    if (!targetUserId) {
      processPreviewRequestId.current += 1;
      setProcessCustomDeductions([]);
      setProcessExcludedDeductions([]);
      setLiveDeductionPreview(null);
      return;
    }
    setIsLoadingDeductionPreview(true);
    setProcessPreviewError('');
    setLiveDeductionPreview(null);
    const requestId = ++processPreviewRequestId.current;
    try {
      // Primary backend preview API: POST /api/deductions/preview or GET /api/employee-deductions/preview
      const preview = await previewPayrollWithDeductions({
        employeeId: targetUserId,
        userId: targetUserId,
        salaryStructureId: selectedUserActiveStructure?._id,
        month: targetM,
        year: targetY,
        totalDays: formOverrides.totalDays !== undefined ? formOverrides.totalDays : processForm.totalDays,
        leaveDays: formOverrides.leaveDays !== undefined ? formOverrides.leaveDays : processForm.leaveDays,
        approvedLeaveDays: formOverrides.approvedLeaveDays !== undefined ? formOverrides.approvedLeaveDays : (formOverrides.leaveDays !== undefined ? formOverrides.leaveDays : processForm.leaveDays),
        unauthorizedFullDays: formOverrides.unauthorizedFullDays !== undefined ? formOverrides.unauthorizedFullDays : processForm.unauthorizedFullDays,
        unauthorizedHalfDays: formOverrides.unauthorizedHalfDays !== undefined ? formOverrides.unauthorizedHalfDays : processForm.unauthorizedHalfDays,
        unauthorizedFullDayCount: formOverrides.unauthorizedFullDays !== undefined ? formOverrides.unauthorizedFullDays : processForm.unauthorizedFullDays,
        unauthorizedHalfDayCount: formOverrides.unauthorizedHalfDays !== undefined ? formOverrides.unauthorizedHalfDays : processForm.unauthorizedHalfDays,
        extraAllowance: formOverrides.extraAllowance !== undefined ? formOverrides.extraAllowance : processForm.extraAllowance,
        incentive: formOverrides.incentive !== undefined ? formOverrides.incentive : processForm.incentive,
        bonus: formOverrides.bonus !== undefined ? formOverrides.bonus : (processForm.bonus || processForm.extraBonus),
        extraBonus: formOverrides.extraBonus !== undefined ? formOverrides.extraBonus : (processForm.bonus || processForm.extraBonus),
        extraDeduction: formOverrides.extraDeduction !== undefined ? formOverrides.extraDeduction : processForm.extraDeduction,
        isPenaltyApproved: formOverrides.applyLegallyApprovedPenalty !== undefined ? formOverrides.applyLegallyApprovedPenalty : processForm.applyLegallyApprovedPenalty,
        legallyApprovedPenalties: processForm.applyLegallyApprovedPenalty
          ? Number(processForm.legallyApprovedPenaltyAmount) || 0
          : 0,
        penaltyDate: formOverrides.penaltyDate !== undefined ? formOverrides.penaltyDate : processForm.penaltyDate
      });

      if (requestId !== processPreviewRequestId.current) return;
      setLiveDeductionPreview(preview);
      if (preview.customDeductions) {
        setProcessCustomDeductions(preview.customDeductions.approvedAndPermissible || []);
        setProcessExcludedDeductions(preview.customDeductions.excludedDeductions || []);
      }
    } catch (err) {
      console.warn('Failed to sync live deductions preview:', err);
      if (requestId !== processPreviewRequestId.current) return;
      setLiveDeductionPreview(null);
      setProcessPreviewError(err.response?.data?.message || err.message || 'Payroll preview is unavailable.');
    } finally {
      if (requestId === processPreviewRequestId.current) setIsLoadingDeductionPreview(false);
    }
  };

  // Live sync user leaves from backend API
  const syncUserLeavesFromBackend = async (userId, month, year, staffList = companyStaff) => {
    if (!userId) return;
    setIsFetchingLeaves(true);
    try {
      const targetUserObj = (staffList || companyStaff).find((s) => String(s._id || s.id) === String(userId)) || userId;
      const userLeaves = await fetchBackendUserLeaves(userId, targetUserObj);

      const targetM = Number(month);
      const targetY = Number(year);
      const leavesInfo = calculateApprovedLeaveDaysForMonth(targetUserObj, targetM, targetY, userLeaves);
      const approvedLeaveDays = leavesInfo.leaveDays || 0;
      const totalMonthDays = getDaysInMonth(targetM, targetY);

      setProcessForm((prev) => ({
        ...prev,
        totalDays: totalMonthDays,
        daysPayable: null,
        leaveDays: approvedLeaveDays,
        approvedLeaveDays,
        unauthorizedFullDays: null,
        unauthorizedHalfDays: null,
        unauthorizedAbsenceDays: null,
        lopDays: null
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
      daysPayable: null
    });

    if (targetUserId) {
      if (field === 'userId' || field === 'month' || field === 'year') {
        setLiveDeductionPreview(null);
        setProcessPreviewError('');
      }
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

  const processCalculations = useMemo(() => {
    const values = getPayrollPreviewValues(liveDeductionPreview);
    const hasStructure = Boolean(selectedUserActiveStructure);
    return {
      hasStructure,
      contractedSalary: values.monthlySalary,
      monthlySalary: values.monthlySalary,
      earnedBaseSalary: values.earnedBaseSalary,
      basicSalary: getPreviewNumber(liveDeductionPreview, ['basicSalary']),
      hra: getPreviewNumber(liveDeductionPreview, ['hra']),
      allowance: getPreviewNumber(liveDeductionPreview, ['allowance', 'specialAllowance']),
      extraAllowance: Number(processForm.extraAllowance) || 0,
      incentive: Number(processForm.incentive) || 0,
      bonus: Number(processForm.bonus || processForm.extraBonus) || 0,
      fixedBonus: getPreviewNumber(liveDeductionPreview, ['fixedBonus']),
      fixedDeduction: getPreviewNumber(liveDeductionPreview, ['fixedDeduction']),
      extraDeduction: Number(processForm.extraDeduction) || 0,
      baseGross: values.monthlySalary,
      grossSalary: values.grossSalary,
      pfDeduction: values.pfDeduction,
      esicDeduction: values.esicDeduction,
      professionalTax: values.professionalTax,
      tdsAmount: values.tdsAmount,
      totalDeduction: values.totalDeduction,
      netSalary: values.netSalary,
      totalDays: values.calendarDays,
      calendarDays: values.calendarDays,
      sundays: values.sundays,
      holidayDays: values.holidayDays,
      workingDays: values.workingDays,
      daysPayable: values.daysPayable,
      leaveDays: values.approvedLeaveDays,
      approvedLeaveDays: values.approvedLeaveDays,
      unauthorizedFullDays: values.unauthorizedFullDays ?? processForm.unauthorizedFullDays,
      unauthorizedHalfDays: values.unauthorizedHalfDays ?? processForm.unauthorizedHalfDays,
      unauthorizedAbsenceDays: values.unauthorizedAbsenceDays,
      lopDays: values.lopDays,
      presentDays: values.daysPayable,
      perDaySalary: values.perDaySalary,
      approvedLeaveDeduction: getPreviewNumber(liveDeductionPreview, ['leaveDeductions.approvedLeaveDeduction', 'approvedLeaveDeduction']),
      unauthorizedAbsenceDeduction: getPreviewNumber(liveDeductionPreview, ['leaveDeductions.unauthorizedAbsenceDeduction', 'unauthorizedAbsenceDeduction']),
      lopDeduction: values.lopDeduction,
      proposedPenaltyAmount: values.proposedPenalty,
      legallyApprovedPenalty: values.appliedPenalty,
      customDeductionsSum: getPreviewNumber(liveDeductionPreview, ['customDeductions.totalApprovedCustomDeductions']),
      processCustomDeductions,
      processExcludedDeductions,
      isAuthoritativeBackendPreview: Boolean(liveDeductionPreview)
    };
  }, [selectedUserActiveStructure, processForm, processCustomDeductions, processExcludedDeductions, liveDeductionPreview]);

  useEffect(() => {
    if (!isProcessModalOpen || !processForm.userId || !selectedUserActiveStructure) return;
    syncCustomDeductionsForPayroll(processForm.userId, processForm.month, processForm.year);
  }, [
    isProcessModalOpen,
    processForm.userId,
    processForm.month,
    processForm.year,
    processForm.totalDays,
    processForm.leaveDays,
    processForm.unauthorizedFullDays,
    processForm.unauthorizedHalfDays,
    processForm.extraAllowance,
    processForm.incentive,
    processForm.bonus,
    processForm.extraDeduction,
    processForm.applyLegallyApprovedPenalty,
    processForm.legallyApprovedPenaltyAmount,
    processForm.penaltyDate,
    selectedUserActiveStructure
  ]);

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
            : typeof item.employee === 'object'
              ? String(item.employee?._id || item.employee?.id || '')
              : typeof item.user === 'object'
                ? String(item.user?._id || item.user?.id || '')
                : String(item.userId || item.employeeId || item.employee || item.user || '');

        const matchedUser = staffMap.get(uId) ||
          (typeof item.userId === 'object' ? item.userId : null) ||
          (typeof item.employeeId === 'object' ? item.employeeId : null) ||
          (typeof item.employee === 'object' ? item.employee : null) ||
          (typeof item.user === 'object' ? item.user : null);
        const employeeSnapshots = [
          item.employeeSnapshot,
          item.userSnapshot,
          item.employeeDetails,
          item.userDetails,
          typeof item.employeeId === 'object' ? item.employeeId : null,
          typeof item.userId === 'object' ? item.userId : null,
          typeof item.employee === 'object' ? item.employee : null,
          typeof item.user === 'object' ? item.user : null
        ].filter((snapshot) => snapshot && typeof snapshot === 'object');
        const snapshotName =
          item.employeeNameSnapshot ||
          item.userNameSnapshot ||
          employeeSnapshots.map((snapshot) => snapshot.nameSnapshot || snapshot.employeeNameSnapshot || snapshot.name || snapshot.fullName || snapshot.displayName).find(Boolean) ||
          item.employeeName ||
          item.userName ||
          item.name;
        const employeeIdentifier =
          item.employeeCode ||
          item.employeeIdentifierSnapshot ||
          item.employeeID ||
          item.uniqueID ||
          employeeSnapshots.map((snapshot) => snapshot.employeeCode || snapshot.employeeID || snapshot.uniqueID).find(Boolean) ||
          matchedUser?.employeeCode ||
          matchedUser?.employeeID ||
          matchedUser?.uniqueID ||
          uId;
        const pId = String(item._id || item.id || '');
        const rawStatus = String(savedOverrides[pId] || item.status || item.paymentStatus || item.salaryStatus || 'processed').toLowerCase().trim();
        const currentStatus = rawStatus === 'paid' ? 'paid' : 'processed';

        return {
          ...item,
          status: currentStatus,
          employeeIdentifier: employeeIdentifier ? String(employeeIdentifier) : '',
          userObj: {
            ...(matchedUser || {}),
            _id: matchedUser?._id || matchedUser?.id || uId,
            name: snapshotName || matchedUser?.name || matchedUser?.fullName || (employeeIdentifier ? `User ${employeeIdentifier}` : 'Staff Member'),
            email: item.userEmailSnapshot || item.employeeEmailSnapshot || item.userEmail || item.employeeEmail || item.email || matchedUser?.email || '',
            role: matchedUser?.role || item.role || item.employeeId?.role || item.userId?.role || 'employee'
          }
        };
      }).filter((item) => !isUnknownEmployeeOrUser(item.userObj));

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
      userId: preselectedUserId || (companyStaff.length > 0 ? String(companyStaff[0]._id || companyStaff[0].id) : ''),
      structureType: 'SIMPLE_FIXED',
      fixedSalary: '',
      basicSalary: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
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

    const isFixed = salaryRecord.structureType === 'SIMPLE_FIXED' ||
      (salaryRecord.fixedSalary > 0 && !salaryRecord.hra) ||
      (salaryRecord.basicSalary && !salaryRecord.hra && !salaryRecord.allowance);

    const effDate = salaryRecord.effectiveFrom
      ? new Date(salaryRecord.effectiveFrom).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    setStructureForm({
      userId: uId,
      structureType: isFixed ? 'SIMPLE_FIXED' : 'COMPONENT_BASED',
      fixedSalary: salaryRecord.fixedSalary != null ? String(salaryRecord.fixedSalary) : (isFixed && salaryRecord.basicSalary != null ? String(salaryRecord.basicSalary) : ''),
      basicSalary: salaryRecord.basicSalary != null ? String(salaryRecord.basicSalary) : '',
      hra: salaryRecord.hra != null ? String(salaryRecord.hra) : '',
      allowance: salaryRecord.allowance != null ? String(salaryRecord.allowance) : '',
      extraAllowance: salaryRecord.extraAllowance != null ? String(salaryRecord.extraAllowance) : '',
      incentive: salaryRecord.incentive != null ? String(salaryRecord.incentive) : '',
      bonus: salaryRecord.bonus != null ? String(salaryRecord.bonus) : '',
      fixedBonus: salaryRecord.fixedBonus != null ? String(salaryRecord.fixedBonus) : '',
      fixedDeduction: salaryRecord.fixedDeduction != null ? String(salaryRecord.fixedDeduction) : '',
      tdsPercentage: salaryRecord.tdsPercentage != null ? String(salaryRecord.tdsPercentage) : '',
      effectiveFrom: effDate,
      autoCalculateStatutory: salaryRecord.autoCalculateStatutory !== false,
      isPfApplicable: salaryRecord.isPfApplicable !== false,
      isEsicApplicable: salaryRecord.isEsicApplicable !== false,
      isPtApplicable: salaryRecord.isPtApplicable !== false,
      isTdsApplicable: salaryRecord.isTdsApplicable !== false,
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
    if (structureForm.structureType === 'SIMPLE_FIXED') {
      if (structureForm.fixedSalary === '' || Number(structureForm.fixedSalary) < 0) {
        setStructureFormError('Monthly Fixed Salary is required and must be 0 or greater.');
        return;
      }
    } else {
      if (structureForm.basicSalary === '' || Number(structureForm.basicSalary) < 0) {
        setStructureFormError('Basic Salary is required and must be 0 or greater.');
        return;
      }
    }

    setIsSubmittingStructure(true);
    setStructureFormError('');

    const payload = {
      userId: structureForm.userId,
      employeeId: structureForm.userId,
      structureType: structureForm.structureType,
      fixedSalary: structureCalculations.fixedSalary,
      basicSalary: structureCalculations.basic,
      hra: structureCalculations.hra,
      allowance: structureCalculations.allowance,
      specialAllowance: structureCalculations.allowance,
      extraAllowance: structureCalculations.extraAllowance,
      incentive: structureCalculations.incentive,
      bonus: structureCalculations.bonus,
      fixedBonus: structureCalculations.fixedBonus,
      fixedDeduction: structureCalculations.fixedDeduction,
      tdsPercentage: structureCalculations.tdsPercentage,
      effectiveFrom: structureForm.effectiveFrom || new Date().toISOString().slice(0, 10),
      autoCalculateStatutory: structureForm.autoCalculateStatutory,
      isPfApplicable: structureForm.isPfApplicable,
      isEsicApplicable: structureForm.isEsicApplicable,
      isPtApplicable: structureForm.isPtApplicable,
      isTdsApplicable: structureForm.isTdsApplicable,
      grossSalary: structureCalculations.grossSalary,
      netSalary: structureCalculations.netSalary,
      isActive: Boolean(structureForm.isActive)
    };

    try {
      if (structureModalMode === 'edit' && editingSalaryId) {
        try {
          await api.put(`/api/payroll/update-salary/${editingSalaryId}`, payload);
        } catch (errPut) {
          await api.put(`/api/salary-structures/${editingSalaryId}`, payload);
        }
        setNotification({
          type: 'success',
          message: 'Salary structure updated successfully!'
        });
      } else {
        try {
          await api.post('/api/payroll/salary/create', payload);
        } catch (errPost) {
          await api.post('/api/salary-structures', payload);
        }
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
      unauthorizedAbsenceDays: 0,
      lopDays: 0,
      extraAllowance: '',
      incentive: '',
      bonus: '',
      extraBonus: '',
      extraDeduction: '',
      status: 'Generated' // Generated by default; do not auto-mark Paid
    });
    processPreviewRequestId.current += 1;
    setLiveDeductionPreview(null);
    setProcessPreviewError('');
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
    if (isLoadingDeductionPreview || !liveDeductionPreview) {
      setProcessFormError(processPreviewError || 'Wait for the authoritative payroll preview before generating payroll.');
      return;
    }

    setIsSubmittingProcess(true);
    setProcessFormError('');

    const parsedMonth = Number(processForm.month);
    const parsedYear = Number(processForm.year);
    const extraAllowanceValue = Number(processForm.extraAllowance) || 0;
    const incentiveValue = Number(processForm.incentive) || 0;
    const bonusValue = Number(processForm.bonus || processForm.extraBonus) || 0;
    const extraDeductionValue = Number(processForm.extraDeduction) || 0;

    const targetUserObj = companyStaff.find((s) => String(s._id || s.id) === String(processForm.userId));
    const monthName = MONTH_NAMES[parsedMonth - 1] || `Month ${parsedMonth}`;
    const formattedSalaryMonth = `${monthName} ${parsedYear}`;

    const targetLeaveDays = processCalculations.approvedLeaveDays;
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
      totalDays: processForm.totalDays,
      leaveDays: targetLeaveDays,
      approvedLeaveDays: targetLeaveDays,
      unauthorizedFullDays: processForm.unauthorizedFullDays == null
        ? undefined
        : Number(processForm.unauthorizedFullDays),
      unauthorizedHalfDays: processForm.unauthorizedHalfDays == null
        ? undefined
        : Number(processForm.unauthorizedHalfDays),
      unauthorizedFullDayCount: processForm.unauthorizedFullDays == null
        ? undefined
        : Number(processForm.unauthorizedFullDays),
      unauthorizedHalfDayCount: processForm.unauthorizedHalfDays == null
        ? undefined
        : Number(processForm.unauthorizedHalfDays),
      extraAllowance: extraAllowanceValue,
      incentive: incentiveValue,
      bonus: bonusValue,
      extraBonus: bonusValue,
      extraDeduction: extraDeductionValue,
      isPenaltyApproved: Boolean(processForm.applyLegallyApprovedPenalty),
      legallyApprovedPenalties: processForm.applyLegallyApprovedPenalty
        ? Number(processForm.legallyApprovedPenaltyAmount) || 0
        : 0,
      penaltyDate: processForm.penaltyDate || null,
      status: "Generated", // Generated by default (do not automatically mark as Paid)
      remarks: processForm.remarks || `Generated for ${formattedSalaryMonth}`
    };

    try {
      // 1. POST: api/payroll/process - generates/creates monthly salary in backend
      await api.post('/api/payroll/process', payload);
      setNotification({
        type: 'success',
        message: `Payroll generated successfully in status 'Generated' for ${formattedSalaryMonth}!`
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

  // 3b. APPROVE PAYROLL ACTION (POST /api/payroll/approve)
  const handleApprovePayroll = async (payroll) => {
    const salaryId = payroll._id || payroll.id;
    if (!salaryId) return;
    try {
      await api.post('/api/payroll/approve', {
        salaryId,
        id: salaryId,
        remarks: 'Approved by HR/Admin'
      });
      setNotification({
        type: 'success',
        message: `Payroll for ${payroll.userObj?.name || 'Staff Member'} approved successfully!`
      });
      invalidateCache(/payroll/);
      invalidateCache(/salaries/);
      invalidateCache(/salary/);
      await loadData(true);
    } catch (err) {
      console.error('Failed to approve payroll:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to approve payroll'
      });
    }
  };

  // 3c. MARK PAID ACTION (PUT /api/payroll/pay)
  const handlePayPayroll = async (payroll) => {
    const salaryId = payroll._id || payroll.id;
    if (!salaryId) return;
    try {
      await api.put('/api/payroll/pay', {
        salaryId,
        id: salaryId,
        paymentMode: 'BANK_TRANSFER',
        paidAt: new Date().toISOString(),
        remarks: 'Disbursed via Bank Transfer'
      });
      setNotification({
        type: 'success',
        message: `Salary for ${payroll.userObj?.name || 'Staff Member'} marked as Paid!`
      });
      invalidateCache(/payroll/);
      invalidateCache(/salaries/);
      invalidateCache(/salary/);
      await loadData(true);
    } catch (err) {
      console.error('Failed to mark payroll as paid:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to disburse salary'
      });
    }
  };

  // ==========================================
  // 4. GENERATE PAYSLIP HTML HELPER FOR PRINT & PDF
  // ==========================================

  const generatePayslipHtml = (slip, autoPrint = true) => {
    const staff = slip.userObj || slip.employeeId || slip.userId || {};
    const staffName = staff.name || staff.fullName || resolveEmployeeName(staff);
    const period = formatMonthYear(slip.month, slip.year);
    const previewValues = getPayrollPreviewValues(slip);
    const deductionBreakdown = getPayrollDeductionBreakdown(slip);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
    const displayValue = (value) => {
      if (!value || typeof value !== 'object') return value;
      return value.designationName || value.departmentName || value.name || value.title || value.displayName || '';
    };
    const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
    const positiveAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
    const amountRows = (items) => items
      .filter((item) => hasValue(item.value) && positiveAmount(item.value))
      .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td class="amount">${escapeHtml(formatINR(item.value))}</td></tr>`)
      .join('');
    const infoFields = [
      ['Employee Name', staffName],
      ['Employee ID', staff.uniqueID || staff.employeeID || staff.employeeCode || slip.employeeIdentifierSnapshot],
      ['Department', displayValue(staff.department || slip.department)],
      ['Designation', displayValue(staff.designation || staff.role)],
      ['Email', staff.email || slip.employeeEmailSnapshot],
      ['Month & Year', period],
      ['Voucher No.', slip.voucherNumber || slip.payslipNumber || slip.slipNumber],
      ['Date', slip.paidAt || slip.createdAt ? formatDate(slip.paidAt || slip.createdAt) : null],
      ['Status', slip.status],
    ].filter(([, value]) => hasValue(value));
    const fieldHtml = infoFields
      .map(([label, value]) => `<div class="info-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join('');

    const earnings = [
      { label: 'Basic Salary', value: slip.basicSalary },
      { label: 'HRA', value: slip.hra },
      { label: 'Conveyance Allowance', value: slip.conveyanceAllowance },
      { label: 'Medical Allowance', value: slip.medicalAllowance },
      { label: 'Special Allowance', value: slip.specialAllowance ?? slip.allowance },
      { label: 'Dearness Allowance', value: slip.dearnessAllowance },
      { label: 'Other Allowance', value: slip.otherAllowances },
    ];
    if (!earnings.some((item) => positiveAmount(item.value))) {
      earnings.push({
        label: 'Salary',
        value: previewValues.monthlySalary ?? previewValues.grossSalary,
      });
    }
    const deductions = deductionBreakdown.components
      .filter((item) => !item.isCustom && item.key !== 'appliedPenalty')
      .map((item) => ({
        label: item.key === 'tdsAmount' && positiveAmount(deductionBreakdown.tdsPercentage)
          ? `${item.label} (${deductionBreakdown.tdsPercentage}%)`
          : item.label,
        value: item.amount,
      }));
    if (positiveAmount(previewValues.appliedPenalty)) {
      deductions.push({ label: 'Applied Penalty', value: previewValues.appliedPenalty });
    }
    deductions.push(...(deductionBreakdown.customDeductionsList || []).map((item) => ({
      label: item.deductionMasterId?.name || item.name || 'Employee Deduction',
      value: item.amount,
    })));
    const extras = [
      { label: 'Extra Allowance', value: slip.extraAllowance },
      { label: 'Overtime', value: slip.overtime },
      { label: 'Bonus', value: slip.fixedBonus ?? slip.extraBonus ?? slip.bonus },
      { label: 'Incentive', value: slip.incentive },
      { label: 'Arrears', value: slip.arrears },
    ].filter((item) => positiveAmount(item.value));
    if (extras.length === 0 && positiveAmount(slip.extraEarnings)) {
      extras.push({ label: 'Other Extra', value: slip.extraEarnings });
    }
    const rowHtml = (items, totalLabel, totalValue) => {
      const rows = amountRows(items);
      const totalRow = hasValue(totalValue)
        ? `<tr class="total-row"><td>${escapeHtml(totalLabel)}</td><td class="amount">${escapeHtml(formatINR(totalValue))}</td></tr>`
        : '';
      return `${rows}${totalRow}`;
    };
    const paymentFields = [
      ['Payment Mode', slip.paymentMode],
      ['Bank Name', staff.bankName || slip.bankName],
      ['Payment Reference / UTR', slip.utrNumber || slip.transactionReference || slip.paymentReference],
      ['Payment Date', slip.paidAt ? formatDate(slip.paidAt) : null],
      ['Remarks', slip.remarks],
    ].filter(([, value]) => hasValue(value));
    const paymentHtml = paymentFields.length
      ? `<section class="payment"><h2>D. Payment Details</h2><div class="payment-grid">${paymentFields.map(([label, value]) => `<div class="info-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></section>`
      : '';
    const netAmount = positiveAmount(previewValues.netSalary) ? formatINR(previewValues.netSalary) : '';
    const title = ['Salary Payment Voucher', period, staffName].filter(hasValue).map(escapeHtml).join(' - ');
    const printScript = autoPrint ? '<script>window.onload = function() { window.print(); };</script>' : '';
    const salaryTotal = earnings.reduce((sum, item) => sum + (positiveAmount(item.value) ? Number(item.value) : 0), 0);
    const extraTotal = extras.reduce((sum, item) => sum + (positiveAmount(item.value) ? Number(item.value) : 0), 0);
    const tablePanels = [
      { className: 'earnings', title: 'A. SALARY DETAILS', items: earnings, totalLabel: 'TOTAL SALARY (A)', total: salaryTotal },
      { className: 'deductions', title: 'B. DEDUCTION DETAILS', items: deductions, totalLabel: 'TOTAL DEDUCTION (B)', total: deductionBreakdown.totalDeduction },
      { className: 'extras', title: 'C. EXTRA / ADDITIONAL PAYMENT', items: extras, totalLabel: 'TOTAL EXTRA (C)', total: extraTotal },
    ].filter((panel) => panel.items.some((item) => positiveAmount(item.value)) || positiveAmount(panel.total));
    const tablesHtml = tablePanels.map((panel) => `
      <div class="panel ${panel.className}">
        <h2>${escapeHtml(panel.title)}</h2>
        <table><thead><tr><th>PARTICULARS</th><th class="amount">AMOUNT (₹)</th></tr></thead>
          <tbody>${rowHtml(panel.items, panel.totalLabel, positiveAmount(panel.total) ? panel.total : null)}</tbody>
        </table>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 9mm; }
    body { margin: 0; padding: 20px; background: #eaf0f6; color: #163047; font: 12px/1.4 Arial, Helvetica, sans-serif; }
    .voucher { max-width: 1000px; margin: 0 auto; padding: 18px; border: 1px solid #93aec2; background: white; }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 8px 12px 14px; border-bottom: 2px solid #0a557d; }
    .brand-name { color: #075985; font-size: 18px; font-weight: 800; letter-spacing: .04em; }
    .brand-sub { color: #557386; font-size: 10px; }
    .voucher-title { padding: 9px 18px; background: linear-gradient(110deg, #064c73, #0d709e); color: white; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: .04em; }
    .info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; margin: 12px 0; padding: 10px 12px; border: 1px solid #bdd4e5; background: #f1f8fd; }
    .info-field { display: flex; min-width: 0; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid #d5e4ef; }
    .info-field span { color: #466277; }
    .info-field strong { overflow-wrap: anywhere; color: #14324a; text-align: right; }
    .tables { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .panel { overflow: hidden; border: 1px solid #aac2d4; }
    .panel h2 { margin: 0; padding: 8px 9px; color: white; font-size: 11px; letter-spacing: .04em; }
    .earnings h2 { background: #075985; }
    .deductions h2 { background: #be3155; }
    .extras h2 { background: #138557; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 6px; background: #e9f1f7; color: #28465c; font-size: 9px; text-align: left; }
    td { padding: 7px 6px; border-top: 1px solid #dce7ee; font-size: 10px; }
    td.amount { text-align: right; white-space: nowrap; font-weight: 700; }
    .total-row td { background: #f0f7fb; font-weight: 800; }
    .deductions .total-row td { background: #fff0f3; }
    .extras .total-row td { background: #effbf5; }
    .net { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 12px; padding: 12px 16px; border: 1px solid #78a8c7; background: linear-gradient(110deg, #064c73, #eaf6ff 55%); }
    .net-label { color: white; font-size: 14px; font-weight: 800; }
    .net-amount { color: #073f62; font-size: 22px; font-weight: 900; }
    .payment { margin-top: 12px; border: 1px solid #c8d6e5; }
    .payment h2 { margin: 0; padding: 8px 10px; background: #eef0ff; color: #273f88; font-size: 11px; }
    .payment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; padding: 4px 10px; }
    .digital-note { padding-top: 10px; color: #607789; font-size: 9px; text-align: center; }
    @media (max-width: 640px) { body { padding: 8px; } .voucher { padding: 10px; } .tables { grid-template-columns: 1fr; } .info, .payment-grid { grid-template-columns: 1fr; } .net-label { font-size: 11px; } .net-amount { font-size: 18px; } }
    @media print { body { padding: 0; background: white; } .voucher { max-width: none; padding: 0; border: 0; } .panel, .info, .payment, .net { break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="voucher">
    <header class="brand">
      <div><div class="brand-name">KEVALON</div><div class="brand-sub">TECHNOLOGY</div></div>
      <div class="voucher-title">EMPLOYEE SALARY PAYMENT VOUCHER</div>
    </header>
    ${fieldHtml ? `<section class="info">${fieldHtml}</section>` : ''}
    ${tablesHtml ? `<section class="tables">${tablesHtml}</section>` : ''}
    ${netAmount ? `<section class="net"><div class="net-label">NET PAYABLE AMOUNT</div><div class="net-amount">${escapeHtml(netAmount)}</div></section>` : ''}
    ${paymentHtml}
    <footer class="digital-note">This is a digitally generated salary slip. No signature is required.</footer>
  </main>
  ${printScript}
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

    const approvedLeaveDays = payroll.approvedLeaveDays != null
      ? Number(payroll.approvedLeaveDays)
      : (payroll.leaveDays != null ? Number(payroll.leaveDays) : null);
    const unauthorizedFullDays = payroll.unauthorizedFullDays != null
      ? Number(payroll.unauthorizedFullDays)
      : (payroll.unauthorizedFullDayCount != null ? Number(payroll.unauthorizedFullDayCount) : null);
    const unauthorizedHalfDays = payroll.unauthorizedHalfDays != null
      ? Number(payroll.unauthorizedHalfDays)
      : (payroll.unauthorizedHalfDayCount != null ? Number(payroll.unauthorizedHalfDayCount) : null);
    const unauthorizedAbsenceDays = payroll.unapprovedLeaveDays != null
      ? Number(payroll.unapprovedLeaveDays)
      : (payroll.unauthorizedAbsenceDays != null ? Number(payroll.unauthorizedAbsenceDays) : null);
    const lopDays = payroll.lopDays != null ? Number(payroll.lopDays) : null;
    const totalMonthDays = payroll.totalDays != null ? Number(payroll.totalDays) : getDaysInMonth(payroll.month, payroll.year);
    const defaultPayableDays = payroll.daysPayable != null ? Number(payroll.daysPayable) : null;

    setUpdatePayrollForm({
      paymentMode: payroll.paymentMode || 'CASH',
      status: currentStatus,
      paidAt: initialPaidDate,
      remarks: payroll.remarks || (payroll.paymentMode === 'CASH' || !payroll.paymentMode ? 'Salary paid in cash' : 'Salary disbursed'),
      extraBonus: payroll.extraBonus != null && Number(payroll.extraBonus) !== 0 ? String(payroll.extraBonus) : '',
      extraDeduction: payroll.extraDeduction != null && Number(payroll.extraDeduction) !== 0 ? String(payroll.extraDeduction) : '',
      totalDays: totalMonthDays,
      leaveDays: approvedLeaveDays,
      approvedLeaveDays,
      unauthorizedFullDays,
      unauthorizedHalfDays,
      unauthorizedAbsenceDays,
      lopDays,
      daysPayable: defaultPayableDays,
      applyLegallyApprovedPenalty: Boolean(payroll.isPenaltyApproved),
      legallyApprovedPenaltyAmount: payroll.legallyApprovedPenalties ?? payroll.appliedPenalty ?? '',
      penaltyDate: payroll.penaltyDate || ''
    });

    setIsUpdatePayrollModalOpen(true);
  };

  const updatePayrollCalculations = useMemo(() => {
    const values = getPayrollPreviewValues(updatePayrollPreview);
    return {
      baseGross: values.monthlySalary,
      monthlySalary: values.monthlySalary,
      earnedBaseSalary: values.earnedBaseSalary,
      grossSalary: values.grossSalary,
      fixedDeduction: getPreviewNumber(updatePayrollPreview, ['fixedDeduction']),
      tdsAmount: values.tdsAmount,
      totalDeduction: values.totalDeduction,
      netSalary: values.netSalary,
      totalDays: values.calendarDays,
      calendarDays: values.calendarDays,
      sundays: values.sundays,
      holidayDays: values.holidayDays,
      workingDays: values.workingDays,
      daysPayable: values.daysPayable,
      leaveDays: values.approvedLeaveDays,
      approvedLeaveDays: values.approvedLeaveDays,
      unauthorizedFullDays: values.unauthorizedFullDays ?? updatePayrollForm.unauthorizedFullDays,
      unauthorizedHalfDays: values.unauthorizedHalfDays ?? updatePayrollForm.unauthorizedHalfDays,
      unauthorizedAbsenceDays: values.unauthorizedAbsenceDays,
      lopDays: values.lopDays,
      presentDays: values.daysPayable,
      perDaySalary: values.perDaySalary,
      lopDeduction: values.lopDeduction,
      proposedPenaltyAmount: values.proposedPenalty,
      legallyApprovedPenalty: values.appliedPenalty,
      pfDeduction: values.pfDeduction,
      esicDeduction: values.esicDeduction,
      professionalTax: values.professionalTax
    };
  }, [updatePayrollForm, updatePayrollPreview]);

  useEffect(() => {
    if (!isUpdatePayrollModalOpen || !selectedPayrollToUpdate) return undefined;
    let active = true;
    const employeeId = selectedPayrollToUpdate.employeeId?._id ||
      selectedPayrollToUpdate.employeeId ||
      selectedPayrollToUpdate.userId?._id ||
      selectedPayrollToUpdate.userId;
    setIsLoadingUpdatePayrollPreview(true);
    setUpdatePayrollPreviewError('');
    setUpdatePayrollPreview(null);
    previewPayrollWithDeductions({
      employeeId,
      userId: employeeId,
      payrollId: selectedPayrollToUpdate._id || selectedPayrollToUpdate.id,
      salaryStructureId: selectedPayrollToUpdate.salaryStructureId?._id ||
        selectedPayrollToUpdate.salaryStructureId ||
        selectedPayrollToUpdate.salaryStructureSnapshot?._id,
      month: Number(selectedPayrollToUpdate.month),
      year: Number(selectedPayrollToUpdate.year),
      totalDays: updatePayrollForm.totalDays,
      leaveDays: updatePayrollForm.leaveDays,
      approvedLeaveDays: updatePayrollForm.leaveDays,
      unauthorizedFullDays: updatePayrollForm.unauthorizedFullDays,
      unauthorizedHalfDays: updatePayrollForm.unauthorizedHalfDays,
      unauthorizedFullDayCount: updatePayrollForm.unauthorizedFullDays,
      unauthorizedHalfDayCount: updatePayrollForm.unauthorizedHalfDays,
      extraBonus: Number(updatePayrollForm.extraBonus) || 0,
      extraDeduction: Number(updatePayrollForm.extraDeduction) || 0,
      isPenaltyApproved: Boolean(updatePayrollForm.applyLegallyApprovedPenalty),
      legallyApprovedPenalties: updatePayrollForm.applyLegallyApprovedPenalty
        ? Number(updatePayrollForm.legallyApprovedPenaltyAmount) || 0
        : 0,
      penaltyDate: updatePayrollForm.penaltyDate || null
    }).then((preview) => {
      if (active) setUpdatePayrollPreview(preview);
    }).catch((err) => {
      if (!active) return;
      setUpdatePayrollPreviewError(err.response?.data?.message || err.message || 'Payroll preview is unavailable.');
    }).finally(() => {
      if (active) setIsLoadingUpdatePayrollPreview(false);
    });
    return () => {
      active = false;
    };
  }, [isUpdatePayrollModalOpen, selectedPayrollToUpdate, updatePayrollForm]);

  const handleSubmitUpdatePayroll = async (e) => {
    e.preventDefault();
    if (!selectedPayrollToUpdate) return;
    if (isLoadingUpdatePayrollPreview || !updatePayrollPreview) {
      setUpdatePayrollError(updatePayrollPreviewError || 'Wait for the authoritative payroll preview before updating.');
      return;
    }

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
      totalDays: updatePayrollForm.totalDays,
      leaveDays: updatePayrollForm.leaveDays,
      approvedLeaveDays: updatePayrollForm.leaveDays,
      unauthorizedFullDays: updatePayrollForm.unauthorizedFullDays == null
        ? undefined
        : Number(updatePayrollForm.unauthorizedFullDays),
      unauthorizedHalfDays: updatePayrollForm.unauthorizedHalfDays == null
        ? undefined
        : Number(updatePayrollForm.unauthorizedHalfDays),
      unauthorizedFullDayCount: updatePayrollForm.unauthorizedFullDays == null
        ? undefined
        : Number(updatePayrollForm.unauthorizedFullDays),
      unauthorizedHalfDayCount: updatePayrollForm.unauthorizedHalfDays == null
        ? undefined
        : Number(updatePayrollForm.unauthorizedHalfDays),
      isPenaltyApproved: Boolean(updatePayrollForm.applyLegallyApprovedPenalty),
      legallyApprovedPenalties: updatePayrollForm.applyLegallyApprovedPenalty
        ? Number(updatePayrollForm.legallyApprovedPenaltyAmount) || 0
        : 0,
      penaltyDate: updatePayrollForm.penaltyDate || null,
    };

    try {
      let res;
      try {
        // PUT: /api/salaries/:id/pay
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
        localStorage.setItem('payroll_status_overrides', JSON.stringify(savedOverrides));
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
              paidAt: payload.paidAt
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
              paidAt: payload.paidAt
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
            year: Number(payroll.year)
          });
          slip = res.data?.data || res.data?.payslip || res.data;
          invalidateCache(/payroll/);
        } catch (errGen) {
          console.warn('Auto payslip generate notice on download:', errGen);
        }
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

    const deductionBreakdown = getPayrollDeductionBreakdown(payroll, existingPayslip);
    setViewingPayslipModal({
      ...(existingPayslip || {}),
      ...payroll,
      userObj: payroll.userObj || existingPayslip?.userObj || user,
      status: String(payroll.status || existingPayslip?.status || 'processed').toLowerCase() === 'paid' ? 'paid' : 'processed',
      deductionBreakdown
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
      {/* ==================================================== */}
      {/* 1. TOP HEADER SECTION */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {isAdmin ? 'Salary & Payroll' : isTL ? 'Team Lead Compensation' : 'My Salary & Payslips'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isAdmin ? 'Manage salary structures, process monthly disbursements and track payslips.' : 'View your compensation details, breakdown, and download monthly payslip statements.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Tabs */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold border border-slate-200 flex-wrap gap-1">
              <button
                onClick={() => setAdminViewMode('processed-payrolls')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'processed-payrolls'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Layers size={13} />
                <span>Monthly Payrolls ({allProcessedPayrolls.length})</span>
              </button>
              <button
                onClick={() => setAdminViewMode('salary-structures')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'salary-structures'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <CreditCard size={13} />
                <span>Structures ({allSalaries.length})</span>
              </button>
              <button
                onClick={() => setAdminViewMode('deduction-masters')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'deduction-masters'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <FileSpreadsheet size={13} />
                <span>Deduction Master</span>
              </button>
              <button
                onClick={() => setAdminViewMode('employee-deductions')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'employee-deductions'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Receipt size={13} />
                <span>Employee Deductions</span>
              </button>
              <button
                onClick={() => setAdminViewMode('deduction-reports')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${adminViewMode === 'deduction-reports'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <PieChart size={13} />
                <span>Deduction Reports</span>
              </button>
            </div>
          )}

          {/* Action Buttons for Admin */}
          {isAdmin && adminViewMode === 'processed-payrolls' && (
            <button
              onClick={() => openProcessPayrollModal()}
              className="h-10 px-4 btn-brand-primary text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
            >
              <Plus size={15} />
              <span>Process Payroll</span>
            </button>
          )}

          {isAdmin && adminViewMode === 'salary-structures' && (
            <button
              onClick={() => openCreateStructureModal()}
              className="h-10 px-4 btn-brand-primary text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
            >
              <Plus size={15} />
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
                      <th className="py-3 px-3">Days (Pay/Leave/Absence)</th>
                      <th className="py-3 px-4">Monthly Salary</th>
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
                                  {payroll.daysPayable ?? '—'}d
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-amber-700 font-medium">Leaves: {payroll.approvedLeaveDays ?? payroll.leaveDays ?? '—'}d</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-700 font-bold">
                                  Absence: {payroll.actualAbsenceDays ?? payroll.unauthorizedAbsenceDays ?? payroll.unapprovedLeaveDays ?? '—'}d
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {formatINR(payroll.monthlySalary ?? payroll.fixedSalary ?? payroll.baseGross)}
                          </td>

                          <td className="py-3.5 px-2 font-semibold text-xs">
                            <div className="text-emerald-600 font-semibold">
                              +{(Number(payroll.fixedBonus) || 0) + (Number(payroll.extraBonus) || 0) > 0
                                ? formatINR((Number(payroll.fixedBonus) || 0) + (Number(payroll.extraBonus) || 0))
                                : '—'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                            {formatINR(payroll.grossSalary)}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-rose-600">
                            <div>{payroll.totalDeduction == null ? '—' : `-${formatINR(payroll.totalDeduction)}`}</div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-bold text-sm text-emerald-600 px-2 py-0.5 rounded">
                              {formatINR(payroll.netSalary)}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize shadow-2xs ${getStatusBadgeClass(payroll.status)}`}>
                              {payroll.status || 'Generated'}
                            </span>
                          </td>

                          {/* Actions: Separate Generate, Approve, Mark Paid and Breakdown */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Approve action if not yet approved or paid */}
                              {isAdmin && (String(payroll.status || '').toLowerCase() === 'generated' || String(payroll.status || '').toLowerCase() === 'processed' || String(payroll.status || '').toLowerCase() === 'draft') && (
                                <button
                                  type="button"
                                  onClick={() => handleApprovePayroll(payroll)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="Approve this monthly payroll (HR / Admin authorization)"
                                >
                                  <CheckCircle2 size={12} className="text-indigo-600" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {/* Mark Paid action if approved */}
                              {isAdmin && String(payroll.status || '').toLowerCase() === 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handlePayPayroll(payroll)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="Disburse / Mark as Paid via Bank Transfer"
                                >
                                  <CreditCard size={12} className="text-emerald-600" />
                                  <span>Mark Paid</span>
                                </button>
                              )}

                              {/* Always allow viewing the 13-point detailed Salary Breakdown */}
                              <button
                                type="button"
                                onClick={() => handleViewPayslipForPayroll(payroll)}
                                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                title="View Comprehensive 13-Point Salary Breakdown"
                              >
                                <FileText size={12} className="text-slate-500" />
                                <span>Breakdown</span>
                              </button>

                              {/* Download PDF payslip when paid */}
                              {String(payroll.status || '').toLowerCase() === 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPayslipForPayroll(payroll)}
                                  disabled={downloadingSlipId === payroll._id}
                                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="Download Official PDF Payslip"
                                >
                                  {downloadingSlipId === payroll._id ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  <span>PDF</span>
                                </button>
                              )}

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openUpdatePayrollModal(payroll)}
                                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                                  title="Update Payroll Details"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}
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
      {/* ADMIN VIEW: TAB 3 - DEDUCTION MASTER */}
      {/* ==================================================== */}
      {isAdmin && adminViewMode === 'deduction-masters' && (
        <div className="space-y-6">
          <DeductionMasterView />
        </div>
      )}

      {/* ==================================================== */}
      {/* ADMIN VIEW: TAB 4 - EMPLOYEE DEDUCTIONS */}
      {/* ==================================================== */}
      {isAdmin && adminViewMode === 'employee-deductions' && (
        <div className="space-y-6">
          <EmployeeDeductionsView />
        </div>
      )}

      {/* ==================================================== */}
      {/* ADMIN VIEW: TAB 5 - DEDUCTION REPORTS */}
      {/* ==================================================== */}
      {isAdmin && adminViewMode === 'deduction-reports' && (
        <div className="space-y-6">
          <DeductionReportsView />
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
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myProcessedPayrolls.map((rec) => (
                      <tr key={rec._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {formatMonthYear(rec.month, rec.year)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {formatINR(rec.monthlySalary ?? rec.fixedSalary ?? rec.baseGross)}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-600">
                          +{(Number(rec.fixedBonus) || 0) + (Number(rec.extraBonus) || 0) > 0
                            ? formatINR((Number(rec.fixedBonus) || 0) + (Number(rec.extraBonus) || 0))
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">{formatINR(rec.grossSalary)}</td>
                        <td className="py-3 px-4 font-mono text-rose-600">{rec.totalDeduction == null ? '—' : `-${formatINR(rec.totalDeduction)}`}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">{formatINR(rec.netSalary)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase shadow-2xs ${getStatusBadgeClass(rec.status)}`}>
                            {rec.status || 'Generated'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewPayslipForPayroll(rec)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer border border-slate-200"
                              title="View Detailed Salary Breakdown"
                            >
                              <FileText size={12} className="text-slate-500" />
                              <span>Breakdown</span>
                            </button>
                            {String(rec.status || '').toLowerCase() === 'paid' && (
                              <button
                                type="button"
                                onClick={() => handleDownloadPayslipForPayroll(rec)}
                                disabled={downloadingSlipId === rec._id}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer border border-purple-200 shadow-2xs"
                                title="Download Official PDF Payslip"
                              >
                                {downloadingSlipId === rec._id ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Download size={12} />
                                )}
                                <span>PDF</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => openUpdatePayrollModal(rec)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer border border-emerald-200"
                                title="Update Monthly Payroll / Mark as Paid"
                              >
                                <CreditCard size={12} />
                                <span>Update / Pay</span>
                              </button>
                            )}
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
                      Backend calculation preview
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Calendar Days
                      </label>
                      <input
                        type="number"
                        value={updatePayrollCalculations.calendarDays ?? ''}
                        readOnly
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Approved Unpaid Leave Days
                      </label>
                      <input
                        type="number"
                        readOnly
                        value={updatePayrollCalculations.approvedLeaveDays ?? ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-amber-300 rounded-lg text-amber-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                        placeholder="0"
                        title="Approved Leaves is fixed (Authorized Unpaid Leave)"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Unauthorized Full-Day Incident Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={updatePayrollForm.unauthorizedFullDays ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
                          setUpdatePayrollForm((prev) => ({
                            ...prev,
                            unauthorizedFullDays: val
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Unauthorized Half-Day Incident Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={updatePayrollForm.unauthorizedHalfDays ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
                          setUpdatePayrollForm((prev) => ({
                            ...prev,
                            unauthorizedHalfDays: val
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Total LOP Days
                      </label>
                      <input
                        type="number"
                        readOnly
                        value={updatePayrollCalculations.lopDays ?? ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-rose-200 rounded-lg text-rose-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                        placeholder="0"
                        title="LOP days returned by the backend payroll preview."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Payable Days
                      </label>
                      <input
                        type="number"
                        readOnly
                        value={updatePayrollCalculations.daysPayable ?? ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-emerald-300 rounded-lg text-emerald-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                        placeholder="—"
                        title="Payable days returned by the backend payroll preview."
                      />
                    </div>
                  </div>

                  {isLoadingUpdatePayrollPreview && <p className="text-xs text-indigo-700">Loading backend payroll preview…</p>}
                  {updatePayrollPreviewError && <p role="alert" className="text-xs text-rose-700">{updatePayrollPreviewError}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div>Sundays: <strong>{updatePayrollCalculations.sundays ?? '—'}</strong></div>
                    <div>Configured Holiday Days (Saturday included): <strong>{updatePayrollCalculations.holidayDays ?? '—'}</strong></div>
                    <div>Working Days / Calculation Divisor: <strong>{updatePayrollCalculations.workingDays ?? '—'}</strong></div>
                    <div>Per Day Salary: <strong>{formatINR(updatePayrollCalculations.perDaySalary)}</strong></div>
                    <div>Actual Absence Days: <strong>{updatePayrollCalculations.unauthorizedAbsenceDays ?? '—'}</strong></div>
                  </div>
                </div>

                {/* Disciplinary Penalty Advisory & Application in Update Modal */}
                {(updatePayrollCalculations.proposedPenaltyAmount != null || updatePayrollCalculations.legallyApprovedPenalty != null) && (
                  <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Info size={14} className="text-amber-600" />
                        <span>Disciplinary Penalty Advisory (Unauthorized Absence)</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded">
                        Labor Law Compliance
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Proposed Penalty: <strong>{formatINR(updatePayrollCalculations.proposedPenaltyAmount)}</strong>. Applied Penalty: <strong>{formatINR(updatePayrollCalculations.legallyApprovedPenalty)}</strong>. Payable days are not changed by penalty.
                    </p>

                    <div className="p-3 bg-white rounded-lg border border-amber-300 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(updatePayrollForm.applyLegallyApprovedPenalty)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUpdatePayrollForm((prev) => ({
                              ...prev,
                              applyLegallyApprovedPenalty: checked,
                              legallyApprovedPenaltyAmount: checked ? (updatePayrollCalculations.proposedPenaltyAmount ?? '') : 0,
                              penaltyDate: checked && !prev.penaltyDate ? new Date().toISOString().split('T')[0] : prev.penaltyDate
                            }));
                          }}
                          className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="font-bold text-xs text-slate-800">
                          Authorize penalty (proposed {formatINR(updatePayrollCalculations.proposedPenaltyAmount)})
                        </span>
                      </label>

                      {updatePayrollForm.applyLegallyApprovedPenalty && (
                        <div className="pl-6 pt-1 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Penalty Incident / Authorized Date <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={updatePayrollForm.penaltyDate || ''}
                                onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, penaltyDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Approved Penalty Amount (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={updatePayrollForm.legallyApprovedPenaltyAmount ?? ''}
                                onChange={(e) => setUpdatePayrollForm({ ...updatePayrollForm, legallyApprovedPenaltyAmount: Number(e.target.value) || 0 })}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Calculated Financial Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monthly Contracted Salary</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{formatINR(updatePayrollCalculations.monthlySalary)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Earned Base Salary (Info)</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{formatINR(updatePayrollCalculations.earnedBaseSalary)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Earnings</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {formatINR(updatePayrollCalculations.grossSalary)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">LOP Amount</span>
                    <span className="font-mono font-semibold text-rose-600 text-xs">
                      {updatePayrollCalculations.lopDeduction == null ? '—' : `-${formatINR(updatePayrollCalculations.lopDeduction)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">Proposed Penalty</span>
                    <span className="font-mono font-semibold text-amber-700 text-xs">{formatINR(updatePayrollCalculations.proposedPenaltyAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-700 uppercase font-semibold block">Applied Penalty</span>
                    <span className="font-mono font-semibold text-rose-700 text-xs">{formatINR(updatePayrollCalculations.legallyApprovedPenalty)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Deductions</span>
                    <span className="font-mono font-bold text-rose-600 text-xs">
                      {updatePayrollCalculations.totalDeduction == null ? '—' : `-${formatINR(updatePayrollCalculations.totalDeduction)}`}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-2 bg-emerald-50/60 rounded">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">Net Take-Home</span>
                    <span className="font-mono font-black text-emerald-600 text-xs sm:text-sm">
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
                      className={`w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-semibold ${String(selectedPayrollToUpdate.status || '').toLowerCase() === 'paid'
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
                      Backend calculation preview
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Calendar Days
                    </label>
                    <input
                      type="number"
                      value={processCalculations.calendarDays ?? ''}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Approved Unpaid Leave Days
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={processCalculations.approvedLeaveDays ?? ''}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-amber-300 rounded-lg text-amber-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                      placeholder="0"
                      title="Approved Leaves is fixed (synced from Leave API)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unauthorized Full-Day Incident Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={processForm.unauthorizedFullDays ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
                        setProcessForm((prev) => ({
                          ...prev,
                          unauthorizedFullDays: val
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unauthorized Half-Day Incident Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={processForm.unauthorizedHalfDays ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
                        setProcessForm((prev) => ({
                          ...prev,
                          unauthorizedHalfDays: val
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-rose-700 font-mono font-bold focus:outline-none focus:border-rose-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Total LOP Days
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={processCalculations.lopDays ?? ''}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-rose-200 rounded-lg text-rose-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                      placeholder="0"
                      title="LOP days returned by the backend payroll preview."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Payable Days
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={processCalculations.daysPayable ?? ''}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-emerald-300 rounded-lg text-emerald-700 font-mono font-bold cursor-not-allowed focus:outline-none"
                      placeholder="—"
                      title="Payable days returned by the backend payroll preview."
                    />
                  </div>
                </div>

                {isLoadingDeductionPreview && <p className="text-xs text-indigo-700">Loading backend payroll preview…</p>}
                {processPreviewError && <p role="alert" className="text-xs text-rose-700">{processPreviewError}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <div>Sundays: <strong>{processCalculations.sundays ?? '—'}</strong></div>
                  <div>Configured Holiday Days (Saturday included): <strong>{processCalculations.holidayDays ?? '—'}</strong></div>
                  <div>Working Days / Calculation Divisor: <strong>{processCalculations.workingDays ?? '—'}</strong></div>
                  <div>Per Day Salary: <strong>{formatINR(processCalculations.perDaySalary)}</strong></div>
                  <div>Actual Absence Days: <strong>{processCalculations.unauthorizedAbsenceDays ?? '—'}</strong></div>
                </div>
              </div>

              {selectedUserActiveStructure ? (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Basic Pay</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {formatINR(selectedUserActiveStructure.basicSalary)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">HRA & Allowance</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {formatINR((Number(selectedUserActiveStructure.hra) || 0) + (Number(selectedUserActiveStructure.specialAllowance || selectedUserActiveStructure.allowance) || 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Fixed Bonus</span>
                    <span className="font-mono font-bold text-emerald-600 text-xs">
                      +{formatINR(selectedUserActiveStructure.fixedBonus)}
                    </span>
                  </div>
                </div>
              ) : processForm.userId ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>This staff member does not have an active salary structure. Please create one before processing payroll.</span>
                </div>
              ) : null}

              {/* Earning Components (Backend Supported) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-800 block">Earnings & Adjustment Components</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Extra Allowance (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 2000"
                      value={processForm.extraAllowance || ''}
                      onChange={(e) => setProcessForm({ ...processForm, extraAllowance: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Incentive (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 3000"
                      value={processForm.incentive || ''}
                      onChange={(e) => setProcessForm({ ...processForm, incentive: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Performance Bonus (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 5000"
                      value={processForm.bonus || processForm.extraBonus || ''}
                      onChange={(e) => setProcessForm({ ...processForm, bonus: e.target.value, extraBonus: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Other Extra Deduction (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1000"
                      value={processForm.extraDeduction || ''}
                      onChange={(e) => setProcessForm({ ...processForm, extraDeduction: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Disbursement Lifecycle Status
                    </label>
                    <div className="px-3 py-2 text-xs bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-semibold flex items-center justify-between">
                      <span>Status: Generated</span>
                      <span className="text-[10px] font-normal text-blue-600">(Requires HR Approval &rarr; Mark Paid)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proposed Disciplinary Penalty Advisory (0.5d/absence) */}
              {(processCalculations.proposedPenaltyAmount != null || processCalculations.legallyApprovedPenalty != null) && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Info size={14} className="text-amber-600" />
                      <span>Disciplinary Penalty Advisory (Unauthorized Absence)</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded">
                      Labor Law Compliance
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Proposed Penalty: <strong>{formatINR(processCalculations.proposedPenaltyAmount)}</strong>. Applied Penalty: <strong>{formatINR(processCalculations.legallyApprovedPenalty)}</strong>. Payable days do not change when a penalty is authorized.
                  </p>

                  {/* Legal Authorization & Application Control */}
                  <div className="p-3 bg-white rounded-lg border border-amber-300 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(processForm.applyLegallyApprovedPenalty)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setProcessForm((prev) => ({
                            ...prev,
                            applyLegallyApprovedPenalty: checked,
                            legallyApprovedPenaltyAmount: checked ? (processCalculations.proposedPenaltyAmount ?? '') : 0,
                            penaltyDate: checked && !prev.penaltyDate ? new Date().toISOString().split('T')[0] : prev.penaltyDate
                          }));
                        }}
                        className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Authorize penalty (proposed {formatINR(processCalculations.proposedPenaltyAmount)})
                      </span>
                    </label>

                    {processForm.applyLegallyApprovedPenalty && (
                      <div className="pl-6 pt-1 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Penalty Incident / Authorized Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={processForm.penaltyDate || ''}
                              onChange={(e) => setProcessForm({ ...processForm, penaltyDate: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Approved Penalty Amount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={processForm.legallyApprovedPenaltyAmount ?? ''}
                              onChange={(e) => setProcessForm({ ...processForm, legallyApprovedPenaltyAmount: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>Legally permissible: Authorized penalty will be deducted from Net Salary with incident date.</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Auto generate payslip note 
              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={15} />
                <span>Status is changeable anytime from payrolls table • Official payslip automatically generated</span>
              </div> */}

              {/* Module 5: Integrated Salary Preview & Expandable Employee Deduction Breakdown */}
              {selectedUserActiveStructure && (
                <div className="space-y-3 pt-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-1">
                      <div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          Salary Preview: {companyStaff.find((s) => String(s._id || s.id) === String(processForm.userId))?.name || 'Staff Member'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          Employee ID: {companyStaff.find((s) => String(s._id || s.id) === String(processForm.userId))?.uniqueID || processForm.userId}
                        </span>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Salary Period</span>
                        <span className="font-bold text-indigo-700 font-mono text-xs">
                          {formatMonthYear(processForm.month, processForm.year)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-3 rounded-lg border border-slate-200/70">
                      <div><span className="text-[10px] text-slate-500 uppercase block font-semibold">Monthly Contracted Salary</span><strong>{formatINR(processCalculations.monthlySalary)}</strong></div>
                      <div><span className="text-[10px] text-slate-500 uppercase block font-semibold">Earned Base Salary (Info)</span><strong>{formatINR(processCalculations.earnedBaseSalary)}</strong></div>
                      <div><span className="text-[10px] text-slate-500 uppercase block font-semibold">Gross Earnings</span><strong>{formatINR(processCalculations.grossSalary)}</strong></div>
                      <div><span className="text-[10px] text-rose-600 uppercase block font-semibold">LOP Amount</span><strong>{processCalculations.lopDeduction == null ? '—' : `-${formatINR(processCalculations.lopDeduction)}`}</strong></div>
                      <div><span className="text-[10px] text-amber-700 uppercase block font-semibold">Proposed Penalty</span><strong>{formatINR(processCalculations.proposedPenaltyAmount)}</strong></div>
                      <div><span className="text-[10px] text-rose-700 uppercase block font-semibold">Applied Penalty</span><strong>{formatINR(processCalculations.legallyApprovedPenalty)}</strong></div>
                      <div><span className="text-[10px] text-rose-600 uppercase block font-semibold">Total Deductions</span><strong>{processCalculations.totalDeduction == null ? '—' : `-${formatINR(processCalculations.totalDeduction)}`}</strong></div>
                      <div className="bg-emerald-50/80 p-1.5 rounded border border-emerald-100"><span className="text-[10px] text-emerald-800 uppercase block font-bold">Net Salary</span><strong>{formatINR(processCalculations.netSalary)}</strong></div>
                    </div>
                  </div>

                  {/* Expandable Employee Deduction Breakdown Section */}
                  <DeductionBreakdownSection
                    deductions={processCustomDeductions}
                    totalCustomDeductions={processCalculations.customDeductionsSum || 0}
                    excludedDeductions={processExcludedDeductions}
                  />
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
                  <span>Generate Payroll (Status: Generated)</span>
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

              {/* Structure Type Selector (SIMPLE_FIXED vs COMPONENT_BASED) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Salary Structure Model <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setStructureForm({ ...structureForm, structureType: 'SIMPLE_FIXED' })}
                    className={`py-2 px-3 text-xs font-bold rounded-md transition text-center cursor-pointer ${structureForm.structureType === 'SIMPLE_FIXED'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Simple Fixed (e.g. ₹6,000/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStructureForm({ ...structureForm, structureType: 'COMPONENT_BASED' })}
                    className={`py-2 px-3 text-xs font-bold rounded-md transition text-center cursor-pointer ${structureForm.structureType === 'COMPONENT_BASED'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Component Based (Basic / HRA / Allowances)
                  </button>
                </div>
              </div>

              {/* Effective Date & Recurring Additions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective From Date
                  </label>
                  <input
                    type="date"
                    value={structureForm.effectiveFrom || ''}
                    onChange={(e) => setStructureForm({ ...structureForm, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recurring Extra Allowance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1000"
                    value={structureForm.extraAllowance || ''}
                    onChange={(e) => setStructureForm({ ...structureForm, extraAllowance: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Conditional Inputs Based on Structure Type */}
              {structureForm.structureType === 'SIMPLE_FIXED' ? (
                /* SIMPLE_FIXED FORM: Fixed Monthly Salary (e.g. ₹6,000) without mandatory Basic/HRA */
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>Simple Fixed Salary Details</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Fixed Salary (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      placeholder="e.g. 6000"
                      value={structureForm.fixedSalary}
                      onChange={(e) => setStructureForm({
                        ...structureForm,
                        fixedSalary: e.target.value,
                        basicSalary: e.target.value // Keep basicSalary in sync for backward-compatible backend validation
                      })}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-indigo-200 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Accepts direct fixed amount (such as ₹6,000) without requiring mandatory Basic or HRA breakdown.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fixed Monthly Bonus (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 0"
                        value={structureForm.fixedBonus || ''}
                        onChange={(e) => setStructureForm({ ...structureForm, fixedBonus: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fixed Monthly Deduction (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 0"
                        value={structureForm.fixedDeduction || ''}
                        onChange={(e) => setStructureForm({ ...structureForm, fixedDeduction: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* COMPONENT_BASED FORM: Full Breakdown */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              )}

              {/* Statutory Applicability Settings & Backend-Calculated Amounts */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">Statutory Applicability & Computation</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={structureForm.isPfApplicable}
                      onChange={(e) => setStructureForm({ ...structureForm, isPfApplicable: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>PF (12%)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={structureForm.isEsicApplicable}
                      onChange={(e) => setStructureForm({ ...structureForm, isEsicApplicable: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>ESIC (0.75%)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={structureForm.isPtApplicable}
                      onChange={(e) => setStructureForm({ ...structureForm, isPtApplicable: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>PT (State Slab)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={structureForm.isTdsApplicable}
                      onChange={(e) => setStructureForm({ ...structureForm, isTdsApplicable: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>TDS Deductions</span>
                  </label>
                </div>

                {/* Live Computed Statutory Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gross Salary:</span>
                    <span className="font-mono font-bold text-slate-900">{formatINR(structureCalculations.grossSalary)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PF Amount:</span>
                    <span className="font-mono font-semibold text-rose-600">
                      {structureCalculations.pfDeduction > 0 ? `-${formatINR(structureCalculations.pfDeduction)}` : 'Exempt'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Prof. Tax (PT):</span>
                    <span className="font-mono font-semibold text-rose-600">
                      {structureCalculations.professionalTax > 0 ? `-${formatINR(structureCalculations.professionalTax)}` : '₹0 (Under Slab)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Net Payable:</span>
                    <span className="font-mono font-bold text-emerald-600">{formatINR(structureCalculations.netSalary)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
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
      {/* 6. MODAL: SALARY BREAKDOWN & PAYSLIP (ALL 13 ITEMS) */}
      {/* ==================================================== */}
      {viewingPayslipModal && (() => {
        const slip = viewingPayslipModal;
        const staff = slip.userObj || slip.employeeId || slip.userId || {};
        const staffName = staff.name || staff.fullName || resolveEmployeeName(staff) || 'Staff Member';
        const staffEmail = staff.email || slip.employeeEmailSnapshot || '—';
        const staffId = staff.uniqueID || staff.employeeID || slip.employeeIdentifierSnapshot || '—';
        const roleTitle = getRoleLabel(staff);
        const period = formatMonthYear(slip.month, slip.year);
        const status = slip.status || 'Generated';
        const isPaid = String(status).toLowerCase() === 'paid';
        const isApproved = String(status).toLowerCase() === 'approved';

        // 13 REQUIRED CONTRACT & SALARY BREAKDOWN METRICS (Using backend response values)
        // 1. Monthly Contracted Salary
        const previewValues = getPayrollPreviewValues(slip);
        const contractedSalary = previewValues.monthlySalary;

        // 2. Earned Salary
        const earnedSalary = previewValues.earnedBaseSalary;

        // 3. Extra Allowances
        const extraAllowances = slip.extraAllowance == null ? null : Number(slip.extraAllowance);

        // 4. Incentives & Bonuses
        const incentives = slip.incentive == null ? null : Number(slip.incentive);
        const bonuses = slip.bonus ?? slip.extraBonus ?? slip.fixedBonus;

        // 5. Approved Unpaid Leave Days
        const approvedUnpaidLeaveDays = previewValues.approvedLeaveDays;
        const unauthorizedFullDays = previewValues.unauthorizedFullDays;
        const unauthorizedHalfDays = previewValues.unauthorizedHalfDays;

        // 6. Unauthorized Absence Days
        const unauthorizedAbsenceDays = previewValues.unauthorizedAbsenceDays;

        // 7. LOP Deduction
        const lopDeduction = previewValues.lopDeduction;

        // 8. Statutory Deductions
        const pfVal = slip.pfDeduction == null ? null : Number(slip.pfDeduction);
        const esicVal = slip.esicDeduction == null ? null : Number(slip.esicDeduction);
        const ptVal = slip.professionalTax == null ? null : Number(slip.professionalTax);
        const tdsVal = slip.tdsAmount == null && slip.tds == null ? null : Number(slip.tdsAmount ?? slip.tds);
        const statutoryDeductions = [pfVal, esicVal, ptVal, tdsVal].some((amount) => amount == null)
          ? null
          : pfVal + esicVal + ptVal + tdsVal;

        // 9. Other Approved Deductions
        const otherApprovedDeductions = slip.approvedAndPermissibleDeductions ??
          slip.customDeductionsSum ??
          (Array.isArray(slip.deductionBreakdown?.customDeductionsList)
            ? slip.deductionBreakdown.customDeductionsList.reduce((s, d) => s + (Number(d.amount) || 0), 0)
            : slip.fixedDeduction ?? slip.otherDeductions ?? null);

        // 10. Proposed Penalty (not applied)
        const proposedPenalty = previewValues.proposedPenalty;

        // 11. Legally Approved Penalty (if applicable)
        const legallyApprovedPenalty = previewValues.appliedPenalty;
        const penaltyDate = slip.penaltyDate ||
          slip.customDeductions?.approvedAndPermissible?.find(d =>
            String(d.category || '').toUpperCase() === 'POLICY_VIOLATION' ||
            String(d.name || d.title || '').toLowerCase().includes('penalty')
          )?.incidentDate ||
          slip.incidentDate ||
          null;

        const itemizedDeductions = (
          slip.deductionBreakdown?.customDeductionsList ||
          slip.customDeductions?.approvedAndPermissible ||
          (Array.isArray(slip.employeeDeductions) ? slip.employeeDeductions : []) ||
          (Array.isArray(slip.customDeductions) ? slip.customDeductions : [])
        );

        // 12. Total Deductions
        const totalDeductions = previewValues.totalDeduction;

        // 13. Net Payable Salary
        const netPayableSalary = previewValues.netSalary;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
            onClick={() => setViewingPayslipModal(null)}
          >
            <div
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Salary Breakdown & Payslip</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shadow-2xs ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Period: <strong className="text-slate-800">{period}</strong> • Employee: <strong className="text-slate-800">{staffName}</strong> ({staffId})
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

              <iframe
                title="Salary payment voucher preview"
                srcDoc={generatePayslipHtml(slip, false)}
                className="min-h-[65vh] w-full flex-1 bg-slate-100"
              />
              <div id="printable-payslip-content" className="hidden">
                {/* Employee & Company Header Bar */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block">
                      Kevalon Technology Pvt. Ltd.
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {staffName}
                    </h4>
                    <div className="flex items-center gap-2 text-slate-500 mt-0.5 text-[11px] flex-wrap">
                      <span className="font-medium text-slate-700">{roleTitle}</span>
                      <span>•</span>
                      <span>ID: {staffId}</span>
                      <span>•</span>
                      <span>{staffEmail}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Backend Day Breakdown</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      Calendar Days {previewValues.calendarDays ?? '—'} • Sundays {previewValues.sundays ?? '—'}
                    </span>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Holidays {previewValues.holidayDays ?? '—'} • Working / Divisor {previewValues.workingDays ?? '—'} • Per Day {formatINR(previewValues.perDaySalary)} • Payable {previewValues.daysPayable ?? '—'}
                    </div>
                  </div>
                </div>

                {/* 13-POINT STATUTORY & EARNINGS BREAKDOWN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT: EARNINGS & CONTRACT */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        1. Contract & Earnings (Credits)
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">Backend Response</span>
                    </div>

                    <div className="space-y-2 text-slate-700">
                      {/* Item 1: Monthly Contracted Salary */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-900 block">1. Monthly Contracted Salary</span>
                          <span className="text-[10px] text-slate-400">Agreed monthly CTC / fixed structure</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-xs">{formatINR(contractedSalary)}</span>
                      </div>

                      {/* Item 2: Earned Salary */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-900 block">2. Earned Salary</span>
                          <span className="text-[10px] text-slate-400">Monthly salary less backend LOP amount (informational subtotal)</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-xs">{formatINR(earnedSalary)}</span>
                      </div>

                      {/* Item 3: Extra Allowances */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-800 block">3. Extra Allowances</span>
                          <span className="text-[10px] text-slate-400">Approved recurring / one-time allowances</span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-600">+{formatINR(extraAllowances)}</span>
                      </div>

                      {/* Item 4: Incentives & Bonus */}
                      <div className="flex justify-between items-center py-1">
                        <div>
                          <span className="font-medium text-slate-800 block">4. Incentives & Performance Bonus</span>
                          <span className="text-[10px] text-slate-400">Incentive: {formatINR(incentives)} • Bonus: {formatINR(bonuses)}</span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-600">
                          +{formatINR(incentives)} / +{formatINR(bonuses)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                      <span>Total Gross Earnings:</span>
                      <span className="font-mono text-indigo-700 text-sm">{formatINR(previewValues.grossSalary)}</span>
                    </div>
                  </div>

                  {/* RIGHT: DEDUCTIONS & LEAVES */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                        2. Leaves & Deductions (Debits)
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">Statutory & Lawful</span>
                    </div>

                    <div className="space-y-2 text-slate-700">
                      {/* Item 5: Approved Unpaid Leave Days */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-900 block">5. Approved Unpaid Leave Days</span>
                          <span className="text-[10px] text-amber-700">Authorized unpaid leave per policy</span>
                        </div>
                        <span className="font-mono font-bold text-amber-700">{approvedUnpaidLeaveDays ?? '—'}</span>
                      </div>

                      {/* Item 6: Unauthorized Absence Days */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-900 block">6. Unauthorized Full-Day Incident Count</span>
                          <span className="text-[10px] text-rose-700">Backend incident count</span>
                        </div>
                        <span className="font-mono font-bold text-rose-700">{unauthorizedFullDays ?? '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-900 block">Unauthorized Half-Day Incident Count</span>
                          <span className="text-[10px] text-rose-700">Backend incident count</span>
                        </div>
                        <span className="font-mono font-bold text-rose-700">{unauthorizedHalfDays ?? '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="font-medium text-slate-900">Actual Absence Days</span>
                        <span className="font-mono font-bold text-rose-700">{unauthorizedAbsenceDays ?? '—'}</span>
                      </div>

                      {/* Item 7: LOP Deduction */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-800 block">7. Loss of Pay (LOP) Deduction</span>
                          <span className="text-[10px] text-slate-400">Backend-calculated LOP</span>
                        </div>
                        <span className="font-mono font-semibold text-rose-600">{lopDeduction == null ? '—' : `-${formatINR(lopDeduction)}`}</span>
                      </div>

                      {/* Item 8: Statutory Deductions */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-800 block">8. Statutory Deductions</span>
                          <span className="text-[10px] text-slate-400">PF: {formatINR(pfVal)} | ESIC: {formatINR(esicVal)} | PT: {formatINR(ptVal)} | TDS: {formatINR(tdsVal)}</span>
                        </div>
                        <span className="font-mono font-semibold text-rose-600">{statutoryDeductions == null ? '—' : `-${formatINR(statutoryDeductions)}`}</span>
                      </div>

                      {/* Item 9: Other Approved Deductions */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <div>
                          <span className="font-medium text-slate-800 block">9. Other Approved Deductions</span>
                          <span className="text-[10px] text-slate-400">HR/Admin verified permissible deductions</span>
                        </div>
                        <span className="font-mono font-semibold text-rose-600">{otherApprovedDeductions == null ? '—' : `-${formatINR(otherApprovedDeductions)}`}</span>
                      </div>

                      {/* Item 11: Legally Approved Penalty (Deductions with Date) */}
                      <div className="flex justify-between items-center py-1">
                        <div>
                          <span className="font-medium text-slate-800 block">11. Legally Approved Penalty</span>
                          <span className="text-[10px] text-slate-500">
                            {legallyApprovedPenalty > 0 ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                                <Calendar size={11} className="text-emerald-600" />
                                <span>Incident Date: {formatDate(penaltyDate || slip.createdAt)}</span>
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-1 font-bold">Applied</span>
                              </span>
                            ) : (
                              <span>Applied Penalty: {formatINR(legallyApprovedPenalty)}</span>
                            )}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-rose-600">
                          {legallyApprovedPenalty == null ? '—' : `-${formatINR(legallyApprovedPenalty)}`}
                        </span>
                      </div>

                      {/* Itemized Approved Deductions with Incident Dates */}
                      {itemizedDeductions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                            Applied Deduction Details (with Dates):
                          </span>
                          {itemizedDeductions.map((d, dIdx) => (
                            <div key={d._id || dIdx} className="flex justify-between items-center text-[11px] bg-white p-2 rounded-lg border border-slate-200">
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {d.deductionMasterId?.name || d.name || d.title || 'Deduction'}
                                </span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Calendar size={11} className="text-slate-400" />
                                  <span>Date: {formatDate(d.incidentDate || d.date || d.createdAt)}</span>
                                  {d.deductionRecordId && <span className="font-mono text-indigo-600 ml-1">({d.deductionRecordId})</span>}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-rose-600">-{formatINR(d.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-rose-700">
                      <span>Total Applied Deductions:</span>
                      <span className="font-mono text-rose-700 text-sm">{totalDeductions == null ? '—' : `-${formatINR(totalDeductions)}`}</span>
                    </div>
                  </div>
                </div>

                {/* DISCIPLINARY PENALTY POLICY TRANSPARENCY CARD (ITEMS 10 & 11) */}
                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                      <Shield size={14} className="text-amber-700" />
                      <span>Disciplinary Policy Transparency (Labor Law Compliance)</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded">
                      Audited
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    {/* Item 10: Proposed Penalty (not applied) */}
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-800">10. Proposed Penalty (Not Applied):</span>
                        <span className="font-mono font-bold text-amber-700">{formatINR(proposedPenalty)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Backend proposal for this payroll. <strong>Not included in net salary unless the backend reports an applied penalty.</strong>
                      </p>
                    </div>

                    {/* Item 11: Legally Approved Penalty */}
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-800">11. Legally Approved Penalty:</span>
                        <span className="font-mono font-bold text-rose-700">{legallyApprovedPenalty == null ? '—' : `-${formatINR(legallyApprovedPenalty)}`}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {legallyApprovedPenalty > 0 ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                            <span>Applied & Deducted from Net Salary • Incident Date: {formatDate(penaltyDate || slip.createdAt)}</span>
                          </span>
                        ) : (
                          'Only legally permissible, formally authorized penalties can affect net salary.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FINAL SUMMARY RECONCILIATION: ITEMS 12 & 13 */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider block">
                      12. Total Lawful Deductions: {totalDeductions == null ? '—' : `-${formatINR(totalDeductions)}`}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-600 mt-0.5">
                      13. Net Payable Salary (Bank Disbursal Amount)
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-2xl text-emerald-600 block">
                      {formatINR(netPayableSalary)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Status: {status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Print */}
                  <button
                    onClick={() => handleOpenPrintHtml(slip)}
                    disabled={!isPaid}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${isPaid
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    title={isPaid ? "Print official payslip" : "Printing available when status is Paid"}
                  >
                    <Printer size={13} />
                    <span>Print Statement</span>
                  </button>

                  {/* Download PDF */}
                  <button
                    onClick={() => handleDownloadPayslipForPayroll(slip)}
                    disabled={downloadingSlipId === (slip._id || slip.id) || !isPaid}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${isPaid
                      ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    title={isPaid ? "Download PDF payslip" : "PDF download available when status is Paid"}
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>

                  {/* Approve Action in modal if Generated */}
                  {isAdmin && (String(status).toLowerCase() === 'generated' || String(status).toLowerCase() === 'processed' || String(status).toLowerCase() === 'draft') && (
                    <button
                      onClick={async () => {
                        await handleApprovePayroll(slip);
                        setViewingPayslipModal(null);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Approve this monthly salary"
                    >
                      <CheckCircle2 size={13} />
                      <span>Approve Payroll</span>
                    </button>
                  )}

                  {/* Mark Paid Action in modal if Approved */}
                  {isAdmin && isApproved && (
                    <button
                      onClick={async () => {
                        await handlePayPayroll(slip);
                        setViewingPayslipModal(null);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Mark as Paid and disburse"
                    >
                      <CreditCard size={13} />
                      <span>Mark Paid (Disburse)</span>
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
        );
      })()}

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
              {(() => {
                const getVal = (key) => {
                  if (viewingDetailSalary[key] !== undefined && viewingDetailSalary[key] !== null) {
                    return viewingDetailSalary[key];
                  }
                  if (viewingDetailSalary.salaryStructureSnapshot?.[key] !== undefined && viewingDetailSalary.salaryStructureSnapshot?.[key] !== null) {
                    return viewingDetailSalary.salaryStructureSnapshot[key];
                  }
                  return null;
                };

                const hasSalaryValue = (val) => {
                  if (val === null || val === undefined) return false;
                  if (typeof val === 'string') {
                    const trimmed = val.trim();
                    if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
                      return false;
                    }
                    const num = Number(trimmed);
                    if (!isNaN(num) && num === 0) return false;
                    return true;
                  }
                  if (typeof val === 'number') {
                    return !isNaN(val) && val !== 0;
                  }
                  return Boolean(val);
                };

                // 1. EARNINGS (CREDITS)
                const basicSalary = getVal('basicSalary');
                const hra = getVal('hra');
                const conveyanceAllowance = getVal('conveyanceAllowance');
                const medicalAllowance = getVal('medicalAllowance');
                const specialAllowance = getVal('specialAllowance');
                const allowance = getVal('allowance');
                const dearnessAllowance = getVal('dearnessAllowance');
                const otherAllowances = getVal('otherAllowances');
                const fixedBonus = getVal('fixedBonus');

                const earningsItems = [
                  { key: 'basicSalary', label: 'Basic Salary:', val: basicSalary, isBonus: false },
                  { key: 'hra', label: 'HRA:', val: hra, isBonus: false },
                  { key: 'conveyanceAllowance', label: 'Conveyance Allowance:', val: conveyanceAllowance, isBonus: false },
                  { key: 'medicalAllowance', label: 'Medical Allowance:', val: medicalAllowance, isBonus: false },
                  { key: 'specialAllowance', label: 'Special Allowance:', val: specialAllowance, isBonus: false },
                  { key: 'allowance', label: 'Allowance:', val: allowance, isBonus: false },
                  { key: 'dearnessAllowance', label: 'Dearness Allowance (DA):', val: dearnessAllowance, isBonus: false },
                  { key: 'otherAllowances', label: 'Other Allowances:', val: otherAllowances, isBonus: false },
                  { key: 'fixedBonus', label: 'Bonus:', val: fixedBonus, isBonus: true },
                ].filter((item) => hasSalaryValue(item.val));

                // Gross Salary
                const rawGross = getVal('grossSalary');
                const calculatedGross = [
                  basicSalary, hra, conveyanceAllowance, medicalAllowance,
                  specialAllowance, allowance, dearnessAllowance, otherAllowances, fixedBonus
                ].reduce((sum, v) => sum + (hasSalaryValue(v) ? Number(v) : 0), 0);
                const finalGross = hasSalaryValue(rawGross) ? Number(rawGross) : (calculatedGross > 0 ? calculatedGross : null);

                // 2. DEDUCTIONS (DEBITS)
                const basicForPf = getVal('basicForPf');
                const pfDeduction = getVal('pfDeduction');
                const esicDeduction = getVal('esicDeduction');
                const professionalTax = getVal('professionalTax');
                const rawTds = getVal('tds');
                const tdsPercentage = getVal('tdsPercentage');
                const fixedDeduction = getVal('fixedDeduction');
                const otherDeductions = getVal('otherDeductions');

                const calculatedTds = (hasSalaryValue(tdsPercentage) && hasSalaryValue(finalGross))
                  ? (Number(finalGross) * Number(tdsPercentage)) / 100
                  : null;
                const finalTds = hasSalaryValue(rawTds) ? Number(rawTds) : (hasSalaryValue(calculatedTds) ? calculatedTds : null);

                const deductionsItems = [
                  { key: 'basicForPf', label: 'Basic for PF:', val: basicForPf, isBase: true },
                  { key: 'fixedDeduction', label: 'Fixed Deduction:', val: fixedDeduction },
                  ...(hasSalaryValue(finalTds) ? [{
                    key: 'tds',
                    label: hasSalaryValue(tdsPercentage) ? `TDS (${tdsPercentage}%):` : 'TDS / Income Tax:',
                    val: finalTds
                  }] : (hasSalaryValue(tdsPercentage) ? [{
                    key: 'tdsPercentage',
                    label: 'TDS Rate:',
                    val: `${tdsPercentage}%`,
                    isRate: true
                  }] : [])),
                  { key: 'pfDeduction', label: 'PF Deduction:', val: pfDeduction },
                  { key: 'esicDeduction', label: 'ESIC Deduction:', val: esicDeduction },
                  { key: 'professionalTax', label: 'Professional Tax:', val: professionalTax },
                  { key: 'otherDeductions', label: 'Other Deductions:', val: otherDeductions },
                ].filter((item) => item.isRate || hasSalaryValue(item.val));

                // Total Deductions
                const rawTotalDeduction = getVal('totalDeduction') != null ? getVal('totalDeduction') : getVal('totalDeductions');
                const calculatedTotalDeduction = [
                  fixedDeduction, finalTds, pfDeduction, esicDeduction, professionalTax, otherDeductions
                ].reduce((sum, v) => sum + (hasSalaryValue(v) ? Number(v) : 0), 0);
                const finalTotalDeductions = hasSalaryValue(rawTotalDeduction)
                  ? Number(rawTotalDeduction)
                  : (calculatedTotalDeduction > 0 ? calculatedTotalDeduction : null);

                // 3. NET SALARY
                const rawNetSalary = getVal('netSalary');
                const calculatedNet = (finalGross != null ? finalGross : 0) - (finalTotalDeductions != null ? finalTotalDeductions : 0);
                const finalNetSalary = hasSalaryValue(rawNetSalary) ? Number(rawNetSalary) : (calculatedNet > 0 ? calculatedNet : null);

                // 4. YEARS OF SERVICE
                const yearsOfService = getVal('yearsOfService');

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
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
                      {hasSalaryValue(yearsOfService) && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Years of Service</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {yearsOfService} {Number(yearsOfService) === 1 ? 'Year' : 'Years'}
                          </span>
                        </div>
                      )}
                      {hasSalaryValue(finalGross) && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Annual CTC</span>
                          <span className="font-mono font-bold text-indigo-600">
                            {formatINR(Number(finalGross) * 12)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Earnings */}
                      <div className="flex flex-col justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px]">
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 block pb-1 border-b border-slate-200">
                            Earnings (Credits)
                          </span>
                          {earningsItems.length > 0 ? (
                            earningsItems.map((item) => (
                              <div key={item.key} className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">{item.label}</span>
                                <span className={`font-mono font-semibold ${item.isBonus ? 'text-emerald-600' : 'text-slate-800'}`}>
                                  {item.isBonus ? `+${formatINR(item.val)}` : formatINR(item.val)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 italic text-[11px] py-1">No additional earnings configured</p>
                          )}
                        </div>
                        {hasSalaryValue(finalGross) && (
                          <div className="pt-2 mt-3 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                            <span>Gross Salary:</span>
                            <span className="font-mono">{formatINR(finalGross)}</span>
                          </div>
                        )}
                      </div>

                      {/* Deductions */}
                      <div className="flex flex-col justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px]">
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-rose-600 block pb-1 border-b border-slate-200">
                            Deductions (Debits)
                          </span>
                          {deductionsItems.length > 0 ? (
                            deductionsItems.map((item) => (
                              <div key={item.key} className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">{item.label}</span>
                                <span className={`font-mono font-semibold ${item.isBase ? 'text-slate-700' : 'text-rose-600'}`}>
                                  {item.isRate ? item.val : item.isBase ? formatINR(item.val) : `-${formatINR(item.val)}`}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 italic text-[11px] py-1">No deductions applicable</p>
                          )}
                        </div>
                        {hasSalaryValue(finalTotalDeductions) && (
                          <div className="pt-2 mt-3 border-t border-slate-200 flex justify-between font-bold text-rose-600">
                            <span>Total Deductions:</span>
                            <span className="font-mono">-{formatINR(finalTotalDeductions)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Net Take-Home Salary */}
                    {hasSalaryValue(finalNetSalary) && (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                            Net Take-Home Salary
                          </span>
                          <span className="text-xs text-slate-500">Baseline monthly credited amount</span>
                        </div>
                        <span className="font-mono font-black text-xl text-emerald-600">
                          {formatINR(finalNetSalary)}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
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
