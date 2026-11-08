import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Download, Filter, Search, RefreshCw, Calendar, Users,
  BarChart2, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, XCircle, Lock, ShieldCheck, FileSpreadsheet, Layers,
  Eye, X, Tag, PieChart, TrendingUp, AlertTriangle, ArrowRight,
  RotateCcw, DollarSign, ChevronDown, Check, Info, FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/axios.js';
import {
  fetchEmployeeDeductions,
  fetchDeductionMasters
} from '../../services/deductionService.js';
import { showToast } from '../common/Toast.jsx';
import { filterOutUnknownUsers } from '../../utils/roleFilters.js';

// Format Currency in Indian Rupee format
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

// Category styling dictionary
const getCategoryStyle = (category) => {
  const cat = String(category || '').toUpperCase();
  if (cat.includes('PENALTY') || cat.includes('DISCIPLINARY')) {
    return { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500', label: 'Disciplinary Penalty' };
  }
  if (cat.includes('DAMAGE') || cat.includes('ASSET')) {
    return { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500', label: 'Asset Damage' };
  }
  if (cat.includes('ADVANCE') || cat.includes('LOAN') || cat.includes('RECOVERY')) {
    return { bg: 'bg-sky-50 text-sky-700 border-sky-200/80', dot: 'bg-sky-500', label: 'Salary Advance' };
  }
  if (cat.includes('STATUTORY') || cat.includes('TAX') || cat.includes('LEGAL')) {
    return { bg: 'bg-purple-50 text-purple-700 border-purple-200/80', dot: 'bg-purple-500', label: 'Statutory Compliance' };
  }
  if (cat.includes('VOLUNTARY') || cat.includes('CONTRIBUTION')) {
    return { bg: 'bg-teal-50 text-teal-700 border-teal-200/80', dot: 'bg-teal-500', label: 'Voluntary Contribution' };
  }
  return { bg: 'bg-slate-100 text-slate-700 border-slate-200/80', dot: 'bg-slate-500', label: category || 'General Policy' };
};

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Report', icon: Calendar, description: 'Consolidated overview by calendar month' },
  { id: 'employee', label: 'Employee-wise', icon: Users, description: 'Deductions grouped per staff member' },
  { id: 'team_leader', label: 'Team Leader-wise', icon: Layers, description: 'Reporting-line breakdown & review' },
  { id: 'type', label: 'Deduction Types', icon: Tag, description: 'Categorized penalties & recoveries' },
  { id: 'pending', label: 'Pending Approvals', icon: Clock, description: 'Awaiting HR/Admin authorization' },
  { id: 'payroll_applied', label: 'Payroll Applied', icon: Lock, description: 'Locked & disbursed pay run records' },
  { id: 'reversal_audit', label: 'Audit Trail', icon: ShieldCheck, description: 'Rejected, disputed & reversed records' }
];

export const DeductionReportsView = () => {
  const [selectedReportType, setSelectedReportType] = useState('monthly');
  const [deductions, setDeductions] = useState([]);
  const [masters, setMasters] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterEmployeeId, setFilterEmployeeId] = useState('ALL');
  const [filterTeamLeadId, setFilterTeamLeadId] = useState('ALL');
  const [filterMasterId, setFilterMasterId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayrollStatus, setFilterPayrollStatus] = useState('ALL'); // ALL | LOCKED | UNAPPLIED
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Inspection Modal
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Load Data
  const loadReportData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [deductionsRes, mastersRes, usersRes] = await Promise.allSettled([
        fetchEmployeeDeductions({
          month: filterMonth !== 'ALL' ? filterMonth : undefined,
          year: filterYear !== 'ALL' ? filterYear : undefined
        }),
        fetchDeductionMasters(),
        api.get('/api/users/all')
      ]);

      if (deductionsRes.status === 'fulfilled') {
        setDeductions(Array.isArray(deductionsRes.value) ? deductionsRes.value : []);
      }
      if (mastersRes.status === 'fulfilled') {
        setMasters(Array.isArray(mastersRes.value) ? mastersRes.value : []);
      }
      if (usersRes.status === 'fulfilled') {
        const raw = usersRes.value.data?.users || usersRes.value.data?.data || usersRes.value.data || [];
        setUsers(filterOutUnknownUsers(Array.isArray(raw) ? raw : []));
      }
    } catch (err) {
      console.error('Failed to load deduction report data:', err);
      showToast('Could not load report records', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [filterMonth, filterYear]);

  // Unique Team Leaders extracted from records
  const teamLeadersList = useMemo(() => {
    const tlMap = new Map();
    deductions.forEach((d) => {
      const tlId = d.teamLeadId || d.teamLeadUser?._id;
      const tlName = d.teamLeadUser?.name || d.teamLeadName || (tlId ? `TL (${tlId})` : null);
      if (tlId && tlName) {
        tlMap.set(String(tlId), tlName);
      }
    });
    return Array.from(tlMap.entries()).map(([id, name]) => ({ id, name }));
  }, [deductions]);

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      filterEmployeeId !== 'ALL' ||
      filterTeamLeadId !== 'ALL' ||
      filterMasterId !== 'ALL' ||
      filterStatus !== 'ALL' ||
      filterPayrollStatus !== 'ALL' ||
      startDate !== '' ||
      endDate !== ''
    );
  }, [searchQuery, filterEmployeeId, filterTeamLeadId, filterMasterId, filterStatus, filterPayrollStatus, startDate, endDate]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterEmployeeId('ALL');
    setFilterTeamLeadId('ALL');
    setFilterMasterId('ALL');
    setFilterStatus('ALL');
    setFilterPayrollStatus('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    showToast('Filters reset to default view', 'info');
  };

  // Filtered Records based on Report Type & Selected Filters
  const filteredRecords = useMemo(() => {
    return deductions.filter((d) => {
      // Report Type specific presets
      if (selectedReportType === 'pending') {
        if (d.status !== 'Pending') return false;
      } else if (selectedReportType === 'payroll_applied') {
        if (filterPayrollStatus === 'LOCKED' && !d.isLocked) return false;
        if (filterPayrollStatus === 'UNAPPLIED' && d.isLocked) return false;
        if (filterPayrollStatus === 'ALL' && !d.isLocked && d.status !== 'Approved') return false;
      } else if (selectedReportType === 'reversal_audit') {
        if (d.status !== 'Rejected' && (!d.approvalHistory || d.approvalHistory.length <= 1)) {
          return false;
        }
      }

      // General Status Filters
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;

      // Payroll Status Filter
      if (filterPayrollStatus === 'LOCKED' && !d.isLocked) return false;
      if (filterPayrollStatus === 'UNAPPLIED' && d.isLocked) return false;

      // Employee Filter
      if (filterEmployeeId !== 'ALL') {
        const empId = String(d.employeeId?._id || d.employeeId || d.userId?._id || d.userId || '');
        if (empId !== filterEmployeeId) return false;
      }

      // Team Leader Filter
      if (filterTeamLeadId !== 'ALL') {
        const tlId = String(d.teamLeadId || d.teamLeadUser?._id || '');
        if (tlId !== filterTeamLeadId) return false;
      }

      // Deduction Master Type Filter
      if (filterMasterId !== 'ALL') {
        const mId = String(d.deductionMasterId?._id || d.deductionMasterId || '');
        if (mId !== filterMasterId) return false;
      }

      // Date Range Filter (incidentDate)
      if (startDate || endDate) {
        const dDate = new Date(d.incidentDate || d.createdAt).getTime();
        if (startDate && dDate < new Date(startDate).getTime()) return false;
        if (endDate && dDate > new Date(endDate).getTime() + 86400000) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const recId = String(d.deductionRecordId || '').toLowerCase();
        const empName = String(d.employeeId?.name || d.userId?.name || '').toLowerCase();
        const empCode = String(d.employeeId?.uniqueID || d.userId?.uniqueID || '').toLowerCase();
        const title = String(d.deductionMasterId?.name || d.name || '').toLowerCase();
        const reason = String(d.reason || '').toLowerCase();
        const tl = String(d.teamLeadUser?.name || d.teamLeadName || '').toLowerCase();
        if (
          !recId.includes(q) &&
          !empName.includes(q) &&
          !empCode.includes(q) &&
          !title.includes(q) &&
          !reason.includes(q) &&
          !tl.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    deductions,
    selectedReportType,
    filterStatus,
    filterPayrollStatus,
    filterEmployeeId,
    filterTeamLeadId,
    filterMasterId,
    startDate,
    endDate,
    searchQuery
  ]);

  // Aggregate Metrics for this report
  const summaryMetrics = useMemo(() => {
    let totalAmt = 0;
    let approvedAmt = 0;
    let pendingAmt = 0;
    let lockedAmt = 0;
    let rejectedAmt = 0;

    let approvedCount = 0;
    let pendingCount = 0;
    let lockedCount = 0;
    let rejectedCount = 0;

    filteredRecords.forEach((d) => {
      const amt = Number(d.amount) || 0;
      totalAmt += amt;
      if (d.status === 'Approved') {
        approvedAmt += amt;
        approvedCount++;
      } else if (d.status === 'Pending') {
        pendingAmt += amt;
        pendingCount++;
      } else if (d.status === 'Rejected') {
        rejectedAmt += amt;
        rejectedCount++;
      }

      if (d.isLocked) {
        lockedAmt += amt;
        lockedCount++;
      }
    });

    const avgDeduction = filteredRecords.length > 0 ? totalAmt / filteredRecords.length : 0;

    return {
      totalRecords: filteredRecords.length,
      totalAmount: totalAmt,
      approvedAmount: approvedAmt,
      approvedCount,
      pendingAmount: pendingAmt,
      pendingCount,
      lockedAmount: lockedAmt,
      lockedCount,
      rejectedAmount: rejectedAmt,
      rejectedCount,
      avgDeduction
    };
  }, [filteredRecords]);

  // Analytics: Category Breakdown
  const categoryAnalytics = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((d) => {
      const cat = d.deductionMasterId?.category || 'OTHER';
      const amt = Number(d.amount) || 0;
      const prev = map.get(cat) || { count: 0, amount: 0 };
      map.set(cat, { count: prev.count + 1, amount: prev.amount + amt });
    });

    const arr = Array.from(map.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      amount: stats.amount,
      pct: summaryMetrics.totalAmount > 0 ? (stats.amount / summaryMetrics.totalAmount) * 100 : 0
    }));

    return arr.sort((a, b) => b.amount - a.amount);
  }, [filteredRecords, summaryMetrics.totalAmount]);

  // Analytics: Top Deduction Masters
  const topMastersAnalytics = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((d) => {
      const name = d.deductionMasterId?.name || d.name || 'Other';
      const amt = Number(d.amount) || 0;
      const prev = map.get(name) || { count: 0, amount: 0 };
      map.set(name, { count: prev.count + 1, amount: prev.amount + amt });
    });

    return Array.from(map.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        amount: stats.amount,
        pct: summaryMetrics.totalAmount > 0 ? (stats.amount / summaryMetrics.totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [filteredRecords, summaryMetrics.totalAmount]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('No records to export for current filters.', 'error');
      return;
    }

    try {
      const excelRows = filteredRecords.map((d, index) => {
        return {
          '#': index + 1,
          'Record ID': d.deductionRecordId || '—',
          'Employee Name': d.employeeId?.name || d.userId?.name || 'Staff Member',
          'Employee Unique ID': d.employeeId?.uniqueID || d.userId?.uniqueID || '—',
          'Department': d.employeeId?.department || '—',
          'Team Leader': d.teamLeadUser?.name || d.teamLeadName || d.teamLeadId || '—',
          'Deduction Title': d.deductionMasterId?.name || d.name || 'Deduction',
          'Category': d.deductionMasterId?.category || 'OTHER',
          'Amount (₹)': Number(d.amount) || 0,
          'Incident Date': formatDate(d.incidentDate || d.createdAt),
          'Payroll Period': `${MONTH_NAMES[(d.month || 1) - 1]} ${d.year}`,
          'Approval Status': d.status || 'Pending',
          'Payroll Status': d.isLocked ? 'Applied / Locked' : 'Unapplied',
          'Legal Permissibility': d.isLegallyPermissible !== false ? 'Permissible' : 'Restricted',
          'Reason / Description': d.reason || '',
          'Rejection / Audit Remarks': d.rejectionReason || d.remarks || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Deductions Report');

      // Auto-fit column widths
      const colWidths = Object.keys(excelRows[0] || {}).map((k) => ({
        wch: Math.max(k.length + 4, 14)
      }));
      worksheet['!cols'] = colWidths;

      const fileName = `Kevalon_Deductions_${selectedReportType}_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('Excel report generated and downloaded successfully!', 'success');
    } catch (e) {
      console.error('Export error:', e);
      showToast('Failed to export Excel report', 'error');
    }
  };

  // Export to CSV handler
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('No records to export for current filters.', 'error');
      return;
    }

    try {
      const headers = ['Record ID', 'Employee Name', 'Employee ID', 'Team Leader', 'Deduction Title', 'Category', 'Amount (INR)', 'Incident Date', 'Payroll Period', 'Status', 'Payroll Applied', 'Reason'];
      const rows = filteredRecords.map((d) => [
        `"${d.deductionRecordId || ''}"`,
        `"${d.employeeId?.name || d.userId?.name || ''}"`,
        `"${d.employeeId?.uniqueID || d.userId?.uniqueID || ''}"`,
        `"${d.teamLeadUser?.name || d.teamLeadName || ''}"`,
        `"${d.deductionMasterId?.name || d.name || ''}"`,
        `"${d.deductionMasterId?.category || 'OTHER'}"`,
        Number(d.amount) || 0,
        `"${formatDate(d.incidentDate || d.createdAt)}"`,
        `"${MONTH_NAMES[(d.month || 1) - 1]} ${d.year}"`,
        `"${d.status || 'Pending'}"`,
        d.isLocked ? 'Locked' : 'Unapplied',
        `"${(d.reason || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Deductions_${selectedReportType}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('CSV export downloaded successfully!', 'success');
    } catch (e) {
      console.error('CSV export error:', e);
      showToast('Failed to export CSV report', 'error');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-poppins animate-fade-in pb-12">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER & QUICK ACTIONS BAR                        */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span>Payroll &amp; Salary</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Deduction Analytics &amp; Reports</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span
              className="p-2.5 rounded-xl text-white shadow-xs shrink-0"
              style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
            >
              <BarChart2 size={22} />
            </span>
            <span>Employee Deduction Analytics &amp; Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Audit-ready payroll reports, categorized financial liability metrics, and statutory compliance intelligence across all corporate reporting lines.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => loadReportData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Download as CSV"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. REPORT TYPE NAV PILLS WITH COUNTERS                   */}
      {/* ======================================================== */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 modal-scrollbar">
          {REPORT_TYPES.map((rep) => {
            const Icon = rep.icon;
            const isActive = selectedReportType === rep.id;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => {
                  setSelectedReportType(rep.id);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                }`}
                style={isActive ? { background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' } : {}}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{rep.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ANALYTICAL KPI METRIC CARDS (4 TILES)                 */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-slate-300 transition">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Filtered Deductions
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                {formatINR(summaryMetrics.totalAmount)}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {summaryMetrics.totalRecords} records (Avg: {formatINR(summaryMetrics.avgDeduction)})
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Card 2: Approved for Payroll */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-emerald-200 transition">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Approved &amp; Ready
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600">
                {formatINR(summaryMetrics.approvedAmount)}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
              {summaryMetrics.approvedCount} approved ({summaryMetrics.totalAmount > 0 ? Math.round((summaryMetrics.approvedAmount / summaryMetrics.totalAmount) * 100) : 0}% of total)
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Card 3: Pending Authorization */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-amber-200 transition">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Approvals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-600">
                {formatINR(summaryMetrics.pendingAmount)}
              </span>
            </div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
              {summaryMetrics.pendingCount} requests in review queue
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock size={20} />
          </div>
        </div>

        {/* Card 4: Disbursed / Locked in Payroll */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between hover:border-indigo-200 transition">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Applied to Payroll
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-indigo-600">
                {formatINR(summaryMetrics.lockedAmount)}
              </span>
            </div>
            <span className="text-[11px] text-indigo-700 font-medium mt-0.5 block">
              {summaryMetrics.lockedCount} records disbursed &amp; locked
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Lock size={20} />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. VISUAL ANALYTICS BREAKDOWN SECTION                     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Analytics Card 1: Category Distribution */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <PieChart size={17} className="text-indigo-600" />
              <span>Deduction Category Distribution</span>
            </div>
            <span className="text-xs text-slate-400">
              {categoryAnalytics.length} active categories
            </span>
          </div>

          {categoryAnalytics.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No deduction data available for category analysis.
            </div>
          ) : (
            <div className="space-y-3.5">
              {categoryAnalytics.map((catItem) => {
                const style = getCategoryStyle(catItem.category);
                return (
                  <div key={catItem.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="font-semibold text-slate-800">{style.label}</span>
                        <span className="text-slate-400 text-[11px]">({catItem.count} {catItem.count === 1 ? 'record' : 'records'})</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900">{formatINR(catItem.amount)}</span>
                        <span className="text-slate-400 text-[11px]">({catItem.pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${style.dot}`}
                        style={{ width: `${Math.max(catItem.pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analytics Card 2: Top Deduction Types */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <TrendingUp size={17} className="text-emerald-600" />
              <span>Top Deduction Drivers</span>
            </div>
            <span className="text-xs text-slate-400">By Amount</span>
          </div>

          {topMastersAnalytics.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No deduction records to rank.
            </div>
          ) : (
            <div className="space-y-3">
              {topMastersAnalytics.map((item, idx) => (
                <div key={item.name} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <span className="w-5 h-5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-slate-900">
                      {formatINR(item.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.count} instances recorded</span>
                    <span className="font-semibold text-indigo-600">{item.pct.toFixed(1)}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* 5. FILTER TOOLBAR CARD                                   */}
      {/* ======================================================== */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Filter size={16} className="text-indigo-600" />
            <span>Filter Report Records</span>
            {isAnyFilterActive && (
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                Filters Active
              </span>
            )}
          </div>

          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw size={13} />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Search Query */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Search Records</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Record ID, employee name, ID, or reason..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Month */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payroll Month</label>
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payroll Year</label>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Employee</label>
            <select
              value={filterEmployeeId}
              onChange={(e) => {
                setFilterEmployeeId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Employees</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.fullName} {u.uniqueID ? `(${u.uniqueID})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Team Leader */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Team Leader</label>
            <select
              value={filterTeamLeadId}
              onChange={(e) => {
                setFilterTeamLeadId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Team Leads</option>
              {teamLeadersList.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deduction Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deduction Type</label>
            <select
              value={filterMasterId}
              onChange={(e) => {
                setFilterMasterId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Types</option>
              {masters.map((m) => (
                <option key={m._id || m.id} value={m._id || m.id}>
                  {m.name || m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Approval Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Approval Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Payroll Application Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payroll Application</label>
            <select
              value={filterPayrollStatus}
              onChange={(e) => {
                setFilterPayrollStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="ALL">All Payroll States</option>
              <option value="LOCKED">Applied / Locked</option>
              <option value="UNAPPLIED">Unapplied / Mutable</option>
            </select>
          </div>

          {/* Incident Date: From */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Incident From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>

          {/* Incident Date: To */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Incident To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. REDESIGNED REPORT DATA TABLE                         */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        
        {/* Table Header Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Report Data Records
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing filtered results based on selected report criteria. Click any row or view icon to inspect audit trail.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto shadow-2xs">
            {filteredRecords.length} Total Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <th className="py-3 px-4">Record ID</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Team Leader</th>
                <th className="py-3 px-4">Deduction Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Incident Date</th>
                <th className="py-3 px-4">Payroll Month</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4">Payroll Application</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500">
                    <RefreshCw size={26} className="animate-spin mx-auto text-indigo-600 mb-3" />
                    <span className="text-xs font-semibold text-slate-700 block">Compiling report analytics...</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Fetching live records from database</span>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((d) => {
                  const empName = d.employeeId?.name || d.userId?.name || 'Staff Member';
                  const empCode = d.employeeId?.uniqueID || d.userId?.uniqueID || '';
                  const initial = empName.charAt(0).toUpperCase() || 'E';
                  const isApproved = d.status === 'Approved';
                  const isPending = d.status === 'Pending';
                  const isRejected = d.status === 'Rejected';
                  const categoryStyle = getCategoryStyle(d.deductionMasterId?.category);

                  return (
                    <tr
                      key={d._id}
                      onClick={() => setSelectedRecordForDetail(d)}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Record ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-700 group-hover:underline">
                          {d.deductionRecordId}
                        </span>
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {empName}
                            </div>
                            {empCode && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {empCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Team Leader */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {d.teamLeadUser?.name || d.teamLeadName || d.teamLeadId || '—'}
                      </td>

                      {/* Deduction Type & Category */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {d.deductionMasterId?.name || d.name || 'Deduction'}
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border mt-0.5 ${categoryStyle.bg}`}>
                          {categoryStyle.label}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 font-mono font-bold text-rose-600 whitespace-nowrap text-xs sm:text-sm">
                        -{formatINR(d.amount)}
                      </td>

                      {/* Incident Date */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(d.incidentDate || d.createdAt)}
                      </td>

                      {/* Payroll Month */}
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {MONTH_NAMES[(d.month || 1) - 1]} {d.year}
                      </td>

                      {/* Approval Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved
                                ? 'bg-emerald-500'
                                : isPending
                                ? 'bg-amber-500'
                                : isRejected
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{d.status || 'Pending'}</span>
                        </span>
                      </td>

                      {/* Payroll Application */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {d.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            <Lock size={11} />
                            <span>Applied / Locked</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50/70 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                            <Check size={11} />
                            <span>Ready for Payroll</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Pending Approval
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecordForDetail(d);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Full Audit Details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500">
                    <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2 opacity-80" />
                    <p className="font-bold text-slate-800 text-sm">No report records found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      No deduction records match the specified filters. Try adjusting or resetting your filter criteria.
                    </p>
                    {isAnyFilterActive && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                      >
                        <RotateCcw size={12} />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ======================================================== */}
        {/* PAGINATION FOOTER                                        */}
        {/* ======================================================== */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(currentPage * pageSize, filteredRecords.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{filteredRecords.length}</span> records
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 7. DETAIL INSPECTION MODAL (USING CREATEPORTAL)          */}
      {/* ======================================================== */}
      {selectedRecordForDetail && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-y-auto animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedRecordForDetail(null)}
          />

          <div
            className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,720px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold shadow-2xs">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                    {selectedRecordForDetail.deductionRecordId}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {selectedRecordForDetail.deductionMasterId?.name || selectedRecordForDetail.name || 'Deduction Record'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 text-xs modal-scrollbar">
              
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Employee
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {selectedRecordForDetail.employeeId?.name || selectedRecordForDetail.userId?.name || 'Staff Member'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    ID: {selectedRecordForDetail.employeeId?.uniqueID || selectedRecordForDetail.userId?.uniqueID || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Deduction Amount
                  </span>
                  <span className="font-mono text-lg font-bold text-rose-600 mt-0.5 block">
                    -{formatINR(selectedRecordForDetail.amount)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Approval Status
                  </span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 inline-block">
                    {selectedRecordForDetail.status}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Payroll Month
                  </span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 inline-block">
                    {MONTH_NAMES[selectedRecordForDetail.month - 1]} {selectedRecordForDetail.year}
                  </span>
                </div>
              </div>

              {/* Reporting Line & Lock State */}
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reporting Team Leader:</span>
                  <span className="font-bold text-indigo-800">
                    {selectedRecordForDetail.teamLeadUser?.name || selectedRecordForDetail.teamLeadName || selectedRecordForDetail.teamLeadId || 'Self / Top'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Incident Date:</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {formatDate(selectedRecordForDetail.incidentDate || selectedRecordForDetail.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Payroll Lock State:</span>
                  <span className="font-bold text-slate-800">
                    {selectedRecordForDetail.isLocked ? 'Locked / Disbursed' : 'Unlocked / Mutable'}
                  </span>
                </div>
              </div>

              {/* Reason / Incident Rationale */}
              <div>
                <span className="text-slate-700 font-bold block mb-1">Incident Reason &amp; Rationale:</span>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed text-xs">
                  {selectedRecordForDetail.reason || 'No description provided.'}
                </p>
              </div>

              {/* Rejection Reason if applicable */}
              {selectedRecordForDetail.rejectionReason && (
                <div>
                  <span className="text-rose-700 font-bold block mb-1">Rejection Ground:</span>
                  <p className="text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed text-xs">
                    {selectedRecordForDetail.rejectionReason}
                  </p>
                </div>
              )}

              {/* Supporting Evidence / Reference Notes */}
              {selectedRecordForDetail.supportingEvidence && (
                <div>
                  <span className="text-slate-700 font-bold block mb-1">Supporting Evidence / Reference:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-mono text-[11px]">
                    {selectedRecordForDetail.supportingEvidence}
                  </p>
                </div>
              )}

              {/* Audit Trail */}
              <div>
                <span className="text-slate-700 font-bold block mb-2">
                  Approval &amp; Audit Trail:
                </span>
                <div className="space-y-2.5 border-l-2 border-indigo-200 pl-3.5 ml-1 py-1">
                  {selectedRecordForDetail.approvalHistory && selectedRecordForDetail.approvalHistory.length > 0 ? (
                    selectedRecordForDetail.approvalHistory.map((hist, i) => (
                      <div key={hist._id || i} className="relative text-xs">
                        <span className="font-bold text-slate-900">{hist.status}</span>
                        <span className="text-slate-400 ml-1.5 text-[11px]">
                          by {hist.actionByName || hist.actionRole || 'System'} on{' '}
                          {formatDate(hist.actionDate)}
                        </span>
                        {hist.comments && (
                          <p className="text-slate-600 italic mt-0.5 text-[11px]">"{hist.comments}"</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400">
                      Created on {formatDate(selectedRecordForDetail.createdAt)} — Pending Review
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer shadow-2xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default DeductionReportsView;
