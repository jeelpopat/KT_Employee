import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  GitBranch,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_BRANCH = {
  branchName: '',
  branchCode: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  manager: '',
  isHeadOffice: false,
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

const getBranchForm = (branch) => ({
  ...EMPTY_BRANCH,
  branchName: branch?.branchName || '',
  branchCode: branch?.branchCode || '',
  address: branch?.address || '',
  city: branch?.city || '',
  state: branch?.state || '',
  pincode: branch?.pincode || '',
  country: branch?.country || 'India',
  phone: branch?.phone || '',
  email: branch?.email || '',
  manager: branch?.manager || '',
  isHeadOffice: Boolean(branch?.isHeadOffice),
  status: branch?.status || 'active',
});

export const BranchManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (preferredCompanyId) {
      return undefined;
    }

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
          setIsLoadingBranches(true);
          setCompanyId(getId(availableCompanies[0]._id || availableCompanies[0].id));
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for branch management.');
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
    if (!companyId) {
      return undefined;
    }

    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load branches.');
        }
        setBranches(Array.isArray(response.data?.data) ? response.data.data : []);
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

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return branches.filter((branch) => {
      const matchesSearch = !query || [
        branch.branchName,
        branch.branchCode,
        branch.city,
        branch.manager,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || branch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  const activeCount = branches.filter((branch) => branch.status === 'active').length;
  const headOffice = branches.find((branch) => branch.isHeadOffice);

  const openCreateForm = () => {
    setEditingBranch(null);
    setForm({ ...EMPTY_BRANCH, isHeadOffice: branches.length === 0 });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (branch) => {
    setEditingBranch(branch);
    setForm(getBranchForm(branch));
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingBranch(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId) {
      setFormError('Select a company before saving a branch.');
      return;
    }
    if (!form.branchName.trim()) {
      setFormError('Branch Name is required.');
      return;
    }

    const payload = {
      ...form,
      branchName: form.branchName.trim(),
      branchCode: form.branchCode.trim(),
      companyId,
    };
    setIsSaving(true);
    setFormError('');
    try {
      const response = editingBranch
        ? await api.put(`/api/branch/${encodeURIComponent(getId(editingBranch._id))}`, payload)
        : await api.post('/api/branch', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Branch details were not saved.');
      }

      showToast(editingBranch ? 'Branch updated successfully.' : 'Branch created successfully.', 'success');
      setIsFormOpen(false);
      setEditingBranch(null);
      setIsLoadingBranches(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save branch details.');
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
      const response = await api.delete(`/api/branch/${encodeURIComponent(getId(deleteTarget._id))}`);
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Branch was not deleted.');
      }
      showToast('Branch deleted successfully.', 'success');
      setDeleteTarget(null);
      setIsLoadingBranches(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete this branch.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCompany = companies.find(
    (company) => getId(company._id || company.id) === companyId
  );
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';

  const isLoading = isLoadingCompanies || isLoadingBranches;

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <GitBranch size={13} className="text-cyan-200" />
              Organization &amp; Setup
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Branch Management</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Manage locations, branch contacts and head office settings.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
              <Building2 size={14} className="text-cyan-200" />
              {companyLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={Plus}
            onClick={openCreateForm}
            isDisabled={!companyId || isLoading}
            className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
          >
            Add Branch
          </Button>
        </div>
      </header>

      {companies.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <label htmlFor="branch-company-select" className="text-sm font-medium text-slate-700">
            Company
          </label>
          <div className="relative min-w-56">
            <select
              id="branch-company-select"
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setBranches([]);
                setLoadError('');
                setIsLoadingBranches(Boolean(event.target.value));
              }}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10"
            >
              <option value="">Select a company</option>
              {companies.map((company) => {
                const id = getId(company._id || company.id);
                return (
                  <option key={id} value={id}>
                    {company.name || company.companyName || 'Unnamed Company'}
                  </option>
                );
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
              setIsLoadingBranches(Boolean(companyId));
              setIsLoadingCompanies(!preferredCompanyId);
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
          { label: 'Total branches', value: branches.length, icon: GitBranch, iconStyle: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Active branches', value: activeCount, icon: Check, iconStyle: 'bg-emerald-50 text-emerald-700' },
          { label: 'Head office', value: headOffice?.branchName || 'Not set', icon: Building2, iconStyle: 'bg-cyan-50 text-[#045d86]' },
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
            <h2 className="text-sm font-semibold text-slate-900">Company branches</h2>
            <p className="mt-0.5 text-xs text-slate-500">Branch details and operational status</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search branches..."
                aria-label="Search branches"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by branch status"
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
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading branches...
          </div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {companies.length > 1 ? 'Select a company to view its branches.' : 'A company is required before branches can be managed.'}
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]">
              <GitBranch size={24} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              {branches.length === 0 ? 'No branches yet' : 'No matching branches'}
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              {branches.length === 0
                ? 'Create your first branch. The first branch is automatically set as the head office.'
                : 'Try a different search or status filter.'}
            </p>
            {branches.length === 0 && (
              <Button type="button" leftIcon={Plus} onClick={openCreateForm} className="mt-4">
                Create first branch
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Branch</th>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Manager</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.map((branch) => (
                  <tr key={getId(branch._id)} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          branch.isHeadOffice ? 'bg-cyan-50 text-[#034665]' : 'bg-[#edf4f8] text-[#045d86]'
                        }`}>
                          <Building2 size={17} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{branch.branchName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-slate-500">{branch.branchCode || 'No branch code'}</span>
                            {branch.isHeadOffice && (
                              <span className="rounded-full bg-[#edf4f8] px-2 py-0.5 text-[10px] font-semibold text-[#034665]">
                                Head Office
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                          {[branch.city, branch.state].filter(Boolean).join(', ') || 'Location not set'}
                          {branch.address ? <span className="block text-slate-400">{branch.address}</span> : null}
                          {branch.pincode ? <span className="block text-slate-400">PIN {branch.pincode}</span> : null}
                          {branch.country ? <span className="block text-slate-400">{branch.country}</span> : null}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <span className="block">{branch.phone || '—'}</span>
                      <span className="mt-1 block text-slate-400">{branch.email || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{branch.manager || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        branch.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${branch.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {branch.status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(branch)}
                          aria-label={`Edit ${branch.branchName}`}
                          title="Edit branch"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/20"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(branch)}
                          disabled={branch.isHeadOffice}
                          aria-label={`Delete ${branch.branchName}`}
                          title={branch.isHeadOffice ? 'Transfer head office status before deleting' : 'Delete branch'}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={15} />
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

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingBranch ? 'Edit branch' : 'Create branch'}
        subtitle={editingBranch ? 'Update branch information and settings.' : 'Add a new location to this company.'}
        size="xl"
        closeOnBackdrop={!isSaving}
        footer={
          <>
            <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" form="branch-management-form" leftIcon={editingBranch ? Check : Plus} isLoading={isSaving}>
              {editingBranch ? 'Save changes' : 'Create branch'}
            </Button>
          </>
        }
      >
        <form id="branch-management-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="branch-name"
              name="branchName"
              label="Branch Name"
              value={form.branchName}
              onChange={handleFormChange}
              required
              isDisabled={isSaving}
              autoComplete="organization"
            />
            <Input
              id="branch-code"
              name="branchCode"
              label="Branch Code"
              value={form.branchCode}
              onChange={handleFormChange}
              isDisabled={isSaving}
              helperText="Must be unique within the company."
            />
            <Input
              id="branch-manager"
              name="manager"
              label="Branch Manager"
              value={form.manager}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="name"
            />
            <Input
              id="branch-phone"
              name="phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="tel"
            />
            <Input
              id="branch-email"
              name="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="email"
            />
            <Input
              id="branch-city"
              name="city"
              label="City"
              value={form.city}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="address-level2"
            />
            <Input
              id="branch-state"
              name="state"
              label="State"
              value={form.state}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="address-level1"
            />
            <Input
              id="branch-pincode"
              name="pincode"
              label="PIN Code"
              value={form.pincode}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="postal-code"
            />
            <Input
              id="branch-country"
              name="country"
              label="Country"
              value={form.country}
              onChange={handleFormChange}
              isDisabled={isSaving}
              autoComplete="country-name"
            />
            <div>
              <label htmlFor="branch-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
              <select
                id="branch-status"
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
          </div>
          <div>
            <label htmlFor="branch-address" className="mb-1 block text-xs font-medium text-slate-700">Address</label>
            <textarea
              id="branch-address"
              name="address"
              value={form.address}
              onChange={handleFormChange}
              rows={3}
              disabled={isSaving}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#068DCB]/20 bg-[#edf4f8] p-3.5">
            <input
              type="checkbox"
              name="isHeadOffice"
              checked={form.isHeadOffice}
              onChange={handleFormChange}
              disabled={isSaving || (!editingBranch && branches.length === 0)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#068DCB] focus:ring-[#068DCB]"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-800">Set as Head Office</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                Setting this branch as Head Office transfers the designation from the current one.
                {!editingBranch && branches.length === 0 ? ' The first branch is automatically the Head Office.' : ''}
              </span>
            </span>
          </label>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        title="Delete branch?"
        subtitle={deleteTarget?.branchName}
        size="sm"
        closeOnBackdrop={!isDeleting}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              isDisabled={isDeleting}
            >
              Keep branch
            </Button>
            <Button
              type="button"
              variant="danger"
              leftIcon={Trash2}
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete branch
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          This will permanently remove <strong>{deleteTarget?.branchName}</strong>. Branches that are Head Offices or have linked transactions cannot be deleted.
        </p>
      </Modal>
    </section>
  );
};

export default BranchManagementView;
