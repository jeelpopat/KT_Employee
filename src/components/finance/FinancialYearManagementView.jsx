import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  UnlockKeyhole,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_FINANCIAL_YEAR = {
  yearLabel: '',
  startDate: '',
  endDate: '',
  status: 'active',
};

const getId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  return String(value._id || value.id || value.companyId || '').trim();
};

const getUserCompanyId = (user) => {
  const activeAccess = user?.companyAccess?.find((access) => access?.isActive);
  return getId(user?.companyId) ||
    getId(user?.company?._id || user?.company) ||
    getId(activeAccess?.companyId);
};

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const getFinancialYearId = (financialYear) => getId(financialYear?._id || financialYear?.id);

export const FinancialYearManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_FINANCIAL_YEAR);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lockingYearId, setLockingYearId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (preferredCompanyId) return undefined;

    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load companies.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const availableCompanies = records.filter((record) => getId(record?._id || record?.id));
        setCompanies(availableCompanies);
        if (availableCompanies.length === 1) {
          setCompanyId(getId(availableCompanies[0]._id || availableCompanies[0].id));
          setIsLoadingBranches(true);
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for financial year management.');
        }
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load companies.'));
      })
      .finally(() => {
        if (active) setIsLoadingCompanies(false);
      });

    return () => {
      active = false;
    };
  }, [preferredCompanyId, reloadKey]);

  useEffect(() => {
    if (!companyId) return undefined;

    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load branches.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const availableBranches = records.filter((record) => getId(record?._id || record?.id));
        setBranches(availableBranches);
        setIsLoadingYears(Boolean(availableBranches.length));
        setBranchId((current) => (
          availableBranches.some((branch) => getId(branch._id || branch.id) === current)
            ? current
            : getId(availableBranches[0]?._id || availableBranches[0]?.id)
        ));
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load branches.'));
      })
      .finally(() => {
        if (active) setIsLoadingBranches(false);
      });

    return () => {
      active = false;
    };
  }, [companyId, reloadKey]);

  useEffect(() => {
    if (!branchId) return undefined;

    let active = true;
    api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load financial years.');
        }
        setFinancialYears(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load financial years.'));
      })
      .finally(() => {
        if (active) setIsLoadingYears(false);
      });

    return () => {
      active = false;
    };
  }, [branchId, reloadKey]);

  const filteredYears = useMemo(() => {
    const query = search.trim().toLowerCase();
    return financialYears.filter((year) => {
      const matchesSearch = !query || [
        year.yearLabel,
        formatDate(year.startDate),
        formatDate(year.endDate),
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || year.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [financialYears, search, statusFilter]);

  const activeCount = financialYears.filter((year) => year.status === 'active').length;
  const lockedCount = financialYears.filter((year) => year.isLocked).length;
  const selectedCompany = companies.find(
    (company) => getId(company._id || company.id) === companyId
  );
  const selectedBranch = branches.find(
    (branch) => getId(branch._id || branch.id) === branchId
  );
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = selectedBranch?.branchName || 'Select a branch';
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingYears;

  const openCreateForm = () => {
    setEditingYear(null);
    setForm({ ...EMPTY_FINANCIAL_YEAR });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (year) => {
    setEditingYear(year);
    setForm({
      yearLabel: year.yearLabel || '',
      startDate: toDateInput(year.startDate),
      endDate: toDateInput(year.endDate),
      status: year.status || 'active',
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingYear(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId) {
      setFormError('Select a company and branch before saving.');
      return;
    }
    if (!form.yearLabel.trim()) {
      setFormError('Financial year name is required.');
      return;
    }
    if (!form.startDate || !form.endDate || new Date(form.startDate) >= new Date(form.endDate)) {
      setFormError('End date must be later than the start date.');
      return;
    }

    const payload = {
      yearLabel: form.yearLabel.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
    };
    setIsSaving(true);
    setFormError('');
    try {
      const response = editingYear
        ? await api.put(`/api/financial-year/${encodeURIComponent(getFinancialYearId(editingYear))}`, payload)
        : await api.post('/api/financial-year', { ...payload, companyId, branchId });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Financial year was not saved.');
      }

      showToast(editingYear ? 'Financial year updated successfully.' : 'Financial year created successfully.', 'success');
      setIsFormOpen(false);
      setEditingYear(null);
      setIsLoadingYears(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save financial year.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setLoadError('');
    try {
      const response = await api.delete(
        `/api/financial-year/${encodeURIComponent(getFinancialYearId(deleteTarget))}`
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Financial year was not deleted.');
      }
      showToast('Financial year deleted successfully.', 'success');
      setDeleteTarget(null);
      setIsLoadingYears(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete this financial year.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLock = async (year) => {
    const id = getFinancialYearId(year);
    setLockingYearId(id);
    setLoadError('');
    try {
      const response = await api.put(`/api/financial-year/${encodeURIComponent(id)}/lock`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Financial year was not locked.');
      }
      showToast('Financial year locked successfully.', 'success');
      setIsLoadingYears(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not lock this financial year.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLockingYearId('');
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <CalendarRange size={13} className="text-cyan-200" />
              Organization &amp; Setup
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Financial Year</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Create and manage financial periods for each company branch.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <Building2 size={14} className="text-cyan-200" />
                {companyLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <CalendarDays size={14} className="text-cyan-200" />
                {branchLabel}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={Plus}
            onClick={openCreateForm}
            isDisabled={!companyId || !branchId || isLoading}
            className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
          >
            Add Financial Year
          </Button>
        </div>
      </header>

      {companies.length > 1 && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          <div>
            <label htmlFor="financial-year-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
            <div className="relative">
              <select
                id="financial-year-company-select"
                value={companyId}
                onChange={(event) => {
                  const nextCompanyId = event.target.value;
                  setCompanyId(nextCompanyId);
                  setBranches([]);
                  setBranchId('');
                  setFinancialYears([]);
                  setIsLoadingBranches(Boolean(nextCompanyId));
                  setIsLoadingYears(false);
                  setLoadError('');
                }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10"
              >
                <option value="">Select a company</option>
                {companies.map((company) => {
                  const id = getId(company._id || company.id);
                  return <option key={id} value={id}>{company.name || company.companyName || 'Unnamed Company'}</option>;
                })}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div>
            <label htmlFor="financial-year-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
            <div className="relative">
              <select
                id="financial-year-branch-select"
                value={branchId}
                disabled={!companyId || isLoadingBranches}
                onChange={(event) => {
                  const nextBranchId = event.target.value;
                  setBranchId(nextBranchId);
                  setFinancialYears([]);
                  setIsLoadingYears(Boolean(nextBranchId));
                  setLoadError('');
                }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
              >
                <option value="">Select a branch</option>
                {branches.map((branch) => {
                  const id = getId(branch._id || branch.id);
                  return <option key={id} value={id}>{branch.branchName}</option>;
                })}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      )}

      {companies.length <= 1 && companyId && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <label htmlFor="financial-year-branch-select" className="text-sm font-medium text-slate-700">Branch</label>
          <div className="relative min-w-56">
            <select
              id="financial-year-branch-select"
              value={branchId}
              disabled={isLoadingBranches}
              onChange={(event) => {
                const nextBranchId = event.target.value;
                setBranchId(nextBranchId);
                setFinancialYears([]);
                setIsLoadingYears(Boolean(nextBranchId));
                setLoadError('');
              }}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => {
                const id = getId(branch._id || branch.id);
                return <option key={id} value={id}>{branch.branchName}</option>;
              })}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError('');
              setIsLoadingCompanies(!preferredCompanyId);
              setIsLoadingBranches(Boolean(companyId));
              setIsLoadingYears(Boolean(branchId));
              setReloadKey((previous) => previous + 1);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline"
          >
            <RotateCw size={14} />
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total financial years', value: financialYears.length, icon: CalendarRange, iconStyle: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Active periods', value: activeCount, icon: Check, iconStyle: 'bg-emerald-50 text-emerald-700' },
          { label: 'Locked periods', value: lockedCount, icon: LockKeyhole, iconStyle: 'bg-amber-50 text-amber-700' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#034665] to-[#068DCB] opacity-0 transition-opacity group-hover:opacity-100" />
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconStyle}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="truncate text-base font-semibold text-slate-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Financial years</h2>
            <p className="mt-0.5 text-xs text-slate-500">Review date ranges, status and lock state</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search financial years..."
                aria-label="Search financial years"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by financial year status"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">
            <RotateCw size={18} className="mr-2 animate-spin" />
            Loading financial years...
          </div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {companies.length > 1 ? 'Select a company to view financial years.' : 'A company is required before financial years can be managed.'}
          </div>
        ) : !branchId ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {branches.length === 0 ? 'Create a branch before adding financial years.' : 'Select a branch to view its financial years.'}
          </div>
        ) : filteredYears.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]">
              <CalendarRange size={24} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              {financialYears.length === 0 ? 'No financial years yet' : 'No matching financial years'}
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              {financialYears.length === 0
                ? 'Create a financial period for this branch to start managing accounts.'
                : 'Try a different search or status filter.'}
            </p>
            {financialYears.length === 0 && (
              <Button type="button" leftIcon={Plus} onClick={openCreateForm} className="mt-4">
                Create first financial year
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Financial year</th>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Lock state</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredYears.map((year) => {
                  const id = getFinancialYearId(year);
                  return (
                    <tr key={id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf4f8] text-[#045d86]">
                            <CalendarDays size={17} />
                          </span>
                          <span className="font-semibold text-slate-900">{year.yearLabel || 'Unnamed financial year'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={14} className="text-slate-400" />
                          {formatDate(year.startDate)} <span className="text-slate-400">to</span> {formatDate(year.endDate)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          year.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${year.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {year.status || 'active'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          year.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {year.isLocked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}
                          {year.isLocked ? 'Locked' : 'Open'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          {!year.isLocked && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(year)}
                                aria-label={`Edit ${year.yearLabel}`}
                                title="Edit financial year"
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/20"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLock(year)}
                                disabled={lockingYearId === id}
                                aria-label={`Lock ${year.yearLabel}`}
                                title="Lock financial year"
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                              >
                                {lockingYearId === id ? <RotateCw size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(year)}
                            aria-label={`Delete ${year.yearLabel}`}
                            title="Delete financial year"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 size={15} />
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

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingYear ? 'Edit financial year' : 'Create financial year'}
        subtitle={editingYear ? 'Update the period name, date range and status.' : `Add a financial period for ${branchLabel}.`}
        size="md"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" form="financial-year-form" leftIcon={editingYear ? Check : Plus} isLoading={isSaving}>
              {editingYear ? 'Save changes' : 'Create financial year'}
            </Button>
          </>
        )}
      >
        <form id="financial-year-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}
          <Input
            id="financial-year-label"
            name="yearLabel"
            label="Financial Year Name"
            placeholder="e.g. 2026-27"
            value={form.yearLabel}
            onChange={handleFormChange}
            required
            isDisabled={isSaving}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="financial-year-start-date"
              name="startDate"
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={handleFormChange}
              required
              isDisabled={isSaving}
            />
            <Input
              id="financial-year-end-date"
              name="endDate"
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={handleFormChange}
              required
              isDisabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="financial-year-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
            <select
              id="financial-year-status"
              name="status"
              value={form.status}
              onChange={handleFormChange}
              disabled={isSaving}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        title="Delete financial year?"
        subtitle={deleteTarget?.yearLabel}
        size="sm"
        closeOnBackdrop={!isDeleting}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} isDisabled={isDeleting}>
              Keep financial year
            </Button>
            <Button type="button" variant="danger" leftIcon={Trash2} onClick={handleDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-slate-600">
          This will permanently remove <strong>{deleteTarget?.yearLabel}</strong>. Financial years linked to transactions cannot be deleted.
        </p>
      </Modal>
    </section>
  );
};

export default FinancialYearManagementView;
