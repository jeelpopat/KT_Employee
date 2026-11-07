import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Edit3, Trash2, Search, Filter, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Shield, ShieldCheck, ShieldAlert, SlidersHorizontal,
  ArrowUpDown, ChevronLeft, ChevronRight, Eye, Layers, HelpCircle, Info
} from 'lucide-react';
import {
  fetchDeductionMasters,
  createDeductionMaster,
  updateDeductionMaster,
  deleteDeductionMaster
} from '../../services/deductionService.js';
import { useConfirm } from '../common/ConfirmDialog.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

// Format Indian Rupee Currency
const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
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

const CATEGORIES = [
  { value: 'STATUTORY', label: 'Statutory (PF / ESI / PT / Tax)' },
  { value: 'VOLUNTARY', label: 'Voluntary Contribution' },
  { value: 'LOAN_ADVANCE', label: 'Loan / Salary Advance Recovery' },
  { value: 'SECURITY_DEPOSIT', label: 'Security Deposit' },
  { value: 'PENALTY_DAMAGE', label: 'Penalty / Asset Damage / Late Fine' },
  { value: 'OTHER', label: 'Other Operational Deduction' }
];

const categoryBadgeColor = (cat) => {
  switch (cat) {
    case 'STATUTORY':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'LOAN_ADVANCE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PENALTY_DAMAGE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'SECURITY_DEPOSIT':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'VOLUNTARY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const DeductionMasterView = () => {
  const { userRole } = useApp();
  const { confirm, confirmationDialog } = useConfirm();
  const isAdminOrHr = userRole === 'admin' || userRole === 'hr';

  const [masters, setMasters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [legalFilter, setLegalFilter] = useState('ALL'); // ALL, PERMISSIBLE, RESTRICTED

  // Sorting & Pagination
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modal State: Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMaster, setEditingMaster] = useState(null);

  // Details Modal State
  const [viewingMaster, setViewingMaster] = useState(null);

  // Form State
  const initialFormState = {
    name: '',
    code: '',
    category: 'VOLUNTARY',
    description: '',
    calculationType: 'FLAT', // 'FLAT' | 'PERCENTAGE'
    defaultAmount: 0,
    percentage: 0,
    percentageBasis: 'GROSS_SALARY',
    isLegallyPermissible: true,
    legalReference: 'Payment of Wages Act 1936 Sec 7(2)',
    maxDeductionPercent: 50,
    isActive: true
  };
  const [form, setForm] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  // Fetch masters
  const loadMasters = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await fetchDeductionMasters();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load deduction masters:', err);
      showToast(err.response?.data?.message || 'Failed to load deduction masters', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  // Filtered and Sorted Data
  const filteredMasters = useMemo(() => {
    return masters.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = m.name?.toLowerCase().includes(q);
        const codeMatch = m.code?.toLowerCase().includes(q);
        const descMatch = m.description?.toLowerCase().includes(q);
        const refMatch = m.legalReference?.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !descMatch && !refMatch) return false;
      }

      // Category
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) {
        return false;
      }

      // Status
      if (statusFilter === 'ACTIVE' && !m.isActive) return false;
      if (statusFilter === 'INACTIVE' && m.isActive) return false;

      // Legal permissibility
      if (legalFilter === 'PERMISSIBLE' && !m.isLegallyPermissible) return false;
      if (legalFilter === 'RESTRICTED' && m.isLegallyPermissible) return false;

      return true;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'name' || sortField === 'code') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      } else if (sortField === 'defaultAmount' || sortField === 'percentage') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'createdAt') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [masters, searchQuery, categoryFilter, statusFilter, legalFilter, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredMasters.length / pageSize) || 1;
  const paginatedMasters = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMasters.slice(start, start + pageSize);
  }, [filteredMasters, currentPage, pageSize]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = masters.length;
    const active = masters.filter((m) => m.isActive).length;
    const inactive = total - active;
    const permissible = masters.filter((m) => m.isLegallyPermissible).length;
    return { total, active, inactive, permissible };
  }, [masters]);

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingMaster(null);
    setForm(initialFormState);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (master) => {
    setEditingMaster(master);
    setForm({
      name: master.name || '',
      code: master.code || '',
      category: master.category || 'VOLUNTARY',
      description: master.description || '',
      calculationType: master.calculationType || 'FLAT',
      defaultAmount: master.defaultAmount || 0,
      percentage: master.percentage || 0,
      percentageBasis: master.percentageBasis || 'GROSS_SALARY',
      isLegallyPermissible: master.isLegallyPermissible !== false,
      legalReference: master.legalReference || '',
      maxDeductionPercent: master.maxDeductionPercent || 50,
      isActive: master.isActive !== false
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Auto-generate code from Title if user hasn't typed one
  const handleTitleChange = (val) => {
    const newTitle = val;
    let newCode = form.code;
    if (!editingMaster) {
      // Auto-suggest slug code like DED_UNIFORM
      const slug = newTitle
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .slice(0, 15);
      newCode = slug ? (slug.startsWith('DED_') ? slug : `DED_${slug}`) : '';
    }
    setForm((prev) => ({ ...prev, name: newTitle, code: newCode }));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Deduction Title is required';
    if (!form.code.trim()) errors.code = 'Deduction Code is required';
    if (form.calculationType === 'FLAT') {
      if (form.defaultAmount === '' || Number(form.defaultAmount) < 0) {
        errors.defaultAmount = 'Default Amount must be a positive number';
      }
    } else {
      if (form.percentage === '' || Number(form.percentage) <= 0 || Number(form.percentage) > 100) {
        errors.percentage = 'Percentage must be between 0.1 and 100';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Master (Create or Update)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        category: form.category,
        description: form.description.trim(),
        calculationType: form.calculationType,
        defaultAmount: Number(form.defaultAmount) || 0,
        percentage: Number(form.percentage) || 0,
        percentageBasis: form.percentageBasis,
        isLegallyPermissible: Boolean(form.isLegallyPermissible),
        legalReference: form.legalReference.trim(),
        maxDeductionPercent: Number(form.maxDeductionPercent) || 50,
        isActive: Boolean(form.isActive)
      };

      if (editingMaster) {
        await updateDeductionMaster(editingMaster._id, payload);
        showToast(`Deduction Master "${payload.name}" updated successfully!`, 'success');
      } else {
        await createDeductionMaster(payload);
        showToast(`Deduction Master "${payload.name}" created successfully!`, 'success');
      }

      setIsModalOpen(false);
      await loadMasters(true);
    } catch (err) {
      console.error('Save Deduction Master Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to save deduction master';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleActive = async (master) => {
    const newStatus = !master.isActive;
    const ok = await confirm({
      title: `${newStatus ? 'Activate' : 'Deactivate'} Deduction Master`,
      message: `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} "${master.name}" (${master.code})? ${
        !newStatus ? 'Inactive deductions cannot be selected for new deduction entries.' : ''
      }`,
      confirmLabel: newStatus ? 'Activate' : 'Deactivate',
      danger: !newStatus
    });

    if (!ok) return;

    try {
      await updateDeductionMaster(master._id, { isActive: newStatus });
      showToast(`"${master.name}" is now ${newStatus ? 'Active' : 'Inactive'}`, 'success');
      await loadMasters(true);
    } catch (err) {
      console.error('Toggle status error:', err);
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // Archive / Delete Master
  const handleDeleteMaster = async (master) => {
    const ok = await confirm({
      title: 'Archive / Delete Deduction Master',
      message: `Are you sure you want to archive "${master.name}" (${master.code})? If this master is linked to existing employee deduction records, it will be automatically safe-deactivated rather than permanently deleted to preserve payroll audit history.`,
      confirmLabel: 'Archive / Delete',
      danger: true
    });

    if (!ok) return;

    try {
      const res = await deleteDeductionMaster(master._id);
      showToast(res.message || `Deduction master "${master.name}" archived successfully`, 'success');
      await loadMasters(true);
    } catch (err) {
      console.error('Delete error:', err);
      showToast(err.response?.data?.message || 'Failed to archive deduction master', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in font-poppins">
      {/* Confirmation Dialog Host */}
      {confirmationDialog}

      {/* Page Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Payroll &amp; Salary</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Deduction Master</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <FileText size={18} />
            </span>
            Deduction Master Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure standardized deduction categories, calculation rules, statutory legal permissibility, and default amounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadMasters(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Catalog"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {isAdminOrHr && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Deduction</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Types
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
              {stats.total}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Active Masters
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1 block">
              {stats.active}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Inactive / Archived
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-500 mt-1 block">
              {stats.inactive}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <XCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Statutory &amp; Compliant
            </span>
            <span className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1 block">
              {stats.permissible}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Main Card with Filters and Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/40">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, code, description, or policy..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <SlidersHorizontal size={13} />
              <span className="hidden sm:inline">Filters:</span>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            {/* Legal Permissibility Filter */}
            <select
              value={legalFilter}
              onChange={(e) => {
                setLegalFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Compliance</option>
              <option value="PERMISSIBLE">Legally Permissible</option>
              <option value="RESTRICTED">Restricted / Non-Permissible</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort('code')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Code</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Title / Name</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3.5">Category</th>
                <th
                  onClick={() => handleSort('defaultAmount')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Rate / Default Amount</span>
                    <ArrowUpDown size={11} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3.5">Legal Policy</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading deduction master catalog...</span>
                  </td>
                </tr>
              ) : paginatedMasters.length > 0 ? (
                paginatedMasters.map((master) => {
                  return (
                    <tr
                      key={master._id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setViewingMaster(master)}
                    >
                      {/* Code */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-indigo-700">
                        {master.code}
                      </td>

                      {/* Title & Description */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-800">{master.name}</div>
                        {master.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {master.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${categoryBadgeColor(
                            master.category
                          )}`}
                        >
                          {master.category?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Default Amount or Rate */}
                      <td className="py-2.5 px-3.5">
                        {master.calculationType === 'PERCENTAGE' ? (
                          <div>
                            <span className="font-mono font-semibold text-slate-800">
                              {master.percentage}%
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">
                              of {master.percentageBasis === 'BASIC_SALARY' ? 'Basic' : 'Gross'}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono font-semibold text-slate-800">
                            {formatINR(master.defaultAmount)}
                          </span>
                        )}
                      </td>

                      {/* Legal Compliance */}
                      <td className="py-2.5 px-3.5">
                        {master.isLegallyPermissible ? (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <ShieldCheck size={13} className="shrink-0" />
                            <span className="text-[11px] font-medium truncate max-w-[140px]" title={master.legalReference || 'Compliant with Payment of Wages Act'}>
                              {master.legalReference || 'Compliant'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-700">
                            <ShieldAlert size={13} className="shrink-0" />
                            <span className="text-[11px] font-medium">Restricted</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5" onClick={(e) => e.stopPropagation()}>
                        {isAdminOrHr ? (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(master)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                              master.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle Active/Inactive"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                master.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span>{master.isActive ? 'Active' : 'Inactive'}</span>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              master.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                master.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span>{master.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td
                        className="py-2.5 px-3.5 text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setViewingMaster(master)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>

                        {isAdminOrHr && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(master)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Master"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteMaster(master)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Archive / Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Layers size={32} className="mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No deduction masters found</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or filters.'
                          : 'Create your first deduction master using the button above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        {!isLoading && filteredMasters.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, filteredMasters.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredMasters.length}</span> records
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

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT DEDUCTION MASTER                     */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,660px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            {/* Header - Fixed & Pinned at Top */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingMaster ? 'Edit Deduction Master' : 'Create New Deduction Master'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Define standardized parameters for employee deductions and payroll processing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Scrollable Form Body - Strictly contained between Header and Footer */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs modal-scrollbar">
                {/* Deduction Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deduction Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                  value={form.name}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. ID Card Not Worn, Laptop Damage, Advance Recovery"
                  className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    formErrors.name ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Deduction Code & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deduction Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. DED_PENALTY"
                    className={`w-full px-3 py-2 border font-mono uppercase rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      formErrors.code ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.code}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Calculation Type & Amount/Percentage Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Calculation Type
                  </label>
                  <select
                    value={form.calculationType}
                    onChange={(e) => setForm({ ...form, calculationType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  >
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                {form.calculationType === 'FLAT' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.defaultAmount}
                      onChange={(e) => setForm({ ...form, defaultAmount: e.target.value })}
                      className={`w-full px-3 py-2 border font-mono rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                        formErrors.defaultAmount ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    />
                    {formErrors.defaultAmount && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        {formErrors.defaultAmount}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Percentage (%) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.01"
                      value={form.percentage}
                      onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                      className={`w-full px-3 py-2 border font-mono rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                        formErrors.percentage ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    />
                    {formErrors.percentage && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        {formErrors.percentage}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Percentage Basis (if percentage) */}
              {form.calculationType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Calculate Percentage Of
                  </label>
                  <select
                    value={form.percentageBasis}
                    onChange={(e) => setForm({ ...form, percentageBasis: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  >
                    <option value="GROSS_SALARY">Gross Salary</option>
                    <option value="BASIC_SALARY">Basic Salary</option>
                  </select>
                </div>
              )}

              {/* Legal Reference & Statutory Ceiling */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy / Legal Reference
                  </label>
                  <input
                    type="text"
                    value={form.legalReference}
                    onChange={(e) => setForm({ ...form, legalReference: e.target.value })}
                    placeholder="e.g. Payment of Wages Act 1936 Sec 7(2)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wage Ceiling (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.maxDeductionPercent}
                    onChange={(e) => setForm({ ...form, maxDeductionPercent: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 font-mono rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Deduction Policy Rules
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detail the operational guidelines or policy criteria under which this deduction is levied..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </div>

              {/* Toggles: Permissibility & Active Status */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isLegallyPermissible}
                    onChange={(e) => setForm({ ...form, isLegallyPermissible: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 text-xs block">
                      Legally Permissible for Payroll Application
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      When checked, approved instances of this deduction will automatically flow into the monthly salary preview and payslip.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 text-xs block">
                      Active Status
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Uncheck to deactivate. Inactive deduction masters cannot be selected when creating new deduction records.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Actions - Fixed & Pinned at bottom */}
            <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 btn-brand-primary text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 transition"
              >
                {isSubmitting ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>{editingMaster ? 'Update Master' : 'Save Master'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* ======================================================== */}
      {/* MODAL: VIEW DEDUCTION MASTER DETAILS                     */}
      {/* ======================================================== */}
      {viewingMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs font-poppins overflow-hidden">
          <div
            className="fixed inset-0"
            onClick={() => setViewingMaster(null)}
          />

          <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[min(88vh,660px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden animate-fade-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90 shrink-0">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-50 text-[#0088cc] font-bold border border-sky-100">
                  {viewingMaster.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {viewingMaster.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingMaster(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs modal-scrollbar">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Category
                  </span>
                  <span className="font-semibold text-slate-800">
                    {viewingMaster.category?.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Status
                  </span>
                  <span
                    className={`font-semibold ${
                      viewingMaster.isActive ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {viewingMaster.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Calculation Type
                  </span>
                  <span className="font-semibold text-slate-800">
                    {viewingMaster.calculationType}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Rate / Amount
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {viewingMaster.calculationType === 'PERCENTAGE'
                      ? `${viewingMaster.percentage}% (${viewingMaster.percentageBasis || 'Gross'})`
                      : formatINR(viewingMaster.defaultAmount)}
                  </span>
                </div>
              </div>

              {viewingMaster.description && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Description:</span>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                    {viewingMaster.description}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Legal Permissibility:</span>
                <div className="flex items-center gap-2 text-slate-700 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  {viewingMaster.isLegallyPermissible ? (
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-900">
                      {viewingMaster.isLegallyPermissible ? 'Permissible for Payroll' : 'Restricted'}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {viewingMaster.legalReference || 'Payment of Wages Act 1936 Sec 7'} (Max ceiling: {viewingMaster.maxDeductionPercent || 50}%)
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
                <div>Created: {formatDate(viewingMaster.createdAt)}</div>
                {viewingMaster.updatedAt && (
                  <div>Last Updated: {formatDate(viewingMaster.updatedAt)}</div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingMaster(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition"
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

export default DeductionMasterView;
