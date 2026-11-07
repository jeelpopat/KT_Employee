import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, Filter, Search, RefreshCw, Calendar, Users,
  BarChart2, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, XCircle, Lock, ShieldCheck, FileSpreadsheet, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/axios.js';
import {
  fetchEmployeeDeductions,
  fetchDeductionMasters,
  fetchDeductionsReport
} from '../../services/deductionService.js';
import { showToast } from '../common/Toast.jsx';
import { filterOutUnknownUsers } from '../../utils/roleFilters.js';

// Format Currency
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

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Deduction Report' },
  { id: 'employee', label: 'Employee-wise Report' },
  { id: 'team_leader', label: 'Team Leader-wise Report' },
  { id: 'type', label: 'Deduction Type-wise Report' },
  { id: 'pending', label: 'Pending Approval Report' },
  { id: 'payroll_applied', label: 'Payroll Applied / Unapplied Report' },
  { id: 'reversal_audit', label: 'Reversal & Audit Trail Report' }
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Load Data
  const loadReportData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [deductionsRes, mastersRes, usersRes] = await Promise.allSettled([
        fetchEmployeeDeductions({ month: filterMonth !== 'ALL' ? filterMonth : undefined, year: filterYear !== 'ALL' ? filterYear : undefined }),
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

  // Filtered Records based on Report Type & Selected Filters
  const filteredRecords = useMemo(() => {
    return deductions.filter((d) => {
      // Report Type specific presets
      if (selectedReportType === 'pending') {
        if (d.status !== 'Pending') return false;
      } else if (selectedReportType === 'payroll_applied') {
        if (filterPayrollStatus === 'LOCKED' && !d.isLocked) return false;
        if (filterPayrollStatus === 'UNAPPLIED' && d.isLocked) return false;
      } else if (selectedReportType === 'reversal_audit') {
        // Records that have rejection or audit history
        if (d.status !== 'Rejected' && (!d.approvalHistory || d.approvalHistory.length <= 1)) {
          return false;
        }
      }

      // General Filters
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;

      if (filterEmployeeId !== 'ALL') {
        const empId = String(d.employeeId?._id || d.employeeId || d.userId?._id || d.userId || '');
        if (empId !== filterEmployeeId) return false;
      }

      if (filterTeamLeadId !== 'ALL') {
        const tlId = String(d.teamLeadId || d.teamLeadUser?._id || '');
        if (tlId !== filterTeamLeadId) return false;
      }

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
        const title = String(d.deductionMasterId?.name || d.name || '').toLowerCase();
        const reason = String(d.reason || '').toLowerCase();
        if (!recId.includes(q) && !empName.includes(q) && !title.includes(q) && !reason.includes(q)) {
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

    filteredRecords.forEach((d) => {
      const amt = Number(d.amount) || 0;
      totalAmt += amt;
      if (d.status === 'Approved') approvedAmt += amt;
      else if (d.status === 'Pending') pendingAmt += amt;

      if (d.isLocked) lockedAmt += amt;
    });

    return {
      totalRecords: filteredRecords.length,
      totalAmount: totalAmt,
      approvedAmount: approvedAmt,
      pendingAmount: pendingAmt,
      lockedAmount: lockedAmt
    };
  }, [filteredRecords]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('No records to export for the current filters.', 'error');
      return;
    }

    try {
      const excelRows = filteredRecords.map((d, index) => {
        return {
          '#': index + 1,
          'Record ID': d.deductionRecordId || '—',
          'Employee Name': d.employeeId?.name || d.userId?.name || 'Staff Member',
          'Employee ID': d.employeeId?.uniqueID || d.userId?.uniqueID || '—',
          'Department': d.employeeId?.department || '—',
          'Team Leader': d.teamLeadUser?.name || d.teamLeadName || d.teamLeadId || '—',
          'Deduction Title': d.deductionMasterId?.name || d.name || 'Deduction',
          'Category': d.deductionMasterId?.category || 'OTHER',
          'Amount (INR)': Number(d.amount) || 0,
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Deductions');

      // Auto-fit column widths
      const colWidths = Object.keys(excelRows[0] || {}).map((k) => ({
        wch: Math.max(k.length + 4, 14)
      }));
      worksheet['!cols'] = colWidths;

      const fileName = `Kevalon_Deduction_${selectedReportType}_Report_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('Excel report generated and downloaded successfully!', 'success');
    } catch (e) {
      console.error('Export error:', e);
      showToast('Failed to export Excel report', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in font-poppins">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Payroll &amp; Salary</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Deduction Reports</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BarChart2 size={18} />
            </span>
            Employee Deduction Analytics &amp; Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate searchable, filtered, and exportable reports by employee, team lead, deduction type, or payroll status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadReportData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Report Types Pills */}
      <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {REPORT_TYPES.map((rep) => {
          const isActive = selectedReportType === rep.id;
          return (
            <button
              key={rep.id}
              type="button"
              onClick={() => {
                setSelectedReportType(rep.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
              }`}
            >
              {rep.label}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Filtered Records
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
            {summaryMetrics.totalRecords}
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Deduction Value
          </span>
          <span className="text-lg sm:text-xl font-mono font-bold text-rose-600 mt-1 block">
            {formatINR(summaryMetrics.totalAmount)}
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Approved &amp; Ready
          </span>
          <span className="text-lg sm:text-xl font-mono font-bold text-emerald-600 mt-1 block">
            {formatINR(summaryMetrics.approvedAmount)}
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Applied to Payroll
          </span>
          <span className="text-lg sm:text-xl font-mono font-bold text-indigo-600 mt-1 block">
            {formatINR(summaryMetrics.lockedAmount)}
          </span>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 pb-2 border-b border-slate-100">
          <Filter size={14} className="text-indigo-600" />
          <span>Report Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID, Employee, or Description..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Employee</label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Employees</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Team Leader */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Team Leader</label>
            <select
              value={filterTeamLeadId}
              onChange={(e) => setFilterTeamLeadId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Team Leads</option>
              {teamLeadersList.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3.5">Record ID</th>
                <th className="py-2.5 px-3.5">Employee</th>
                <th className="py-2.5 px-3.5">Team Leader</th>
                <th className="py-2.5 px-3.5">Deduction Type</th>
                <th className="py-2.5 px-3.5">Amount</th>
                <th className="py-2.5 px-3.5">Incident Date</th>
                <th className="py-2.5 px-3.5">Payroll Month</th>
                <th className="py-2.5 px-3.5">Approval Status</th>
                <th className="py-2.5 px-3.5">Payroll Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Generating report data...</span>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((d) => {
                  const empName = d.employeeId?.name || d.userId?.name || 'Staff Member';
                  const empCode = d.employeeId?.uniqueID || d.userId?.uniqueID || '—';
                  const isApproved = d.status === 'Approved';
                  const isPending = d.status === 'Pending';
                  const isRejected = d.status === 'Rejected';

                  return (
                    <tr key={d._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-indigo-700">
                        {d.deductionRecordId}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-900">{empName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{empCode}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                        {d.teamLeadUser?.name || d.teamLeadName || d.teamLeadId || '—'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-800">
                          {d.deductionMasterId?.name || d.name || 'Deduction'}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {d.deductionMasterId?.category || 'OTHER'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-rose-600">
                        -{formatINR(d.amount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600">
                        {formatDate(d.incidentDate || d.createdAt)}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                        {MONTH_NAMES[(d.month || 1) - 1]} {d.year}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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
                      <td className="py-2.5 px-3.5">
                        {d.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Lock size={10} />
                            <span>Applied / Locked</span>
                          </span>
                        ) : isApproved ? (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            Ready for Payroll
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Pending Approval
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">No report records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No deduction records match the specified filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, filteredRecords.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredRecords.length}</span> records
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeductionReportsView;
