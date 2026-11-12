import React, { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
};

const EMPTY_SUPPLIER = {
  name: '',
  code: '',
  gstin: '',
  pan: '',
  email: '',
  phone: '',
  contactPerson: '',
  billingAddress: { ...EMPTY_ADDRESS },
  shippingAddress: { ...EMPTY_ADDRESS },
  isActive: true,
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

const getSupplierForm = (supplier) => ({
  ...EMPTY_SUPPLIER,
  billingAddress: { ...EMPTY_ADDRESS, ...(supplier?.billingAddress || {}) },
  shippingAddress: { ...EMPTY_ADDRESS, ...(supplier?.shippingAddress || {}) },
  name: supplier?.name || '',
  code: supplier?.code || '',
  gstin: supplier?.gstin || '',
  pan: supplier?.pan || '',
  email: supplier?.email || '',
  phone: supplier?.phone || '',
  contactPerson: supplier?.contactPerson || '',
  isActive: supplier?.isActive !== false,
});

const addressText = (address) => {
  if (!address) return '—';
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].filter(Boolean).join(', ') || '—';
};

const supplierId = (supplier) => getId(supplier?.id || supplier?._id);

export const SuppliersManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deactivatingSupplier, setDeactivatingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);

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
          setLoadError('No company is available for supplier management.');
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
        setIsLoadingSuppliers(Boolean(availableBranches.length));
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
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({
      companyId,
      branchId,
      page: String(page),
      limit: String(pagination.limit),
    });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('isActive', String(statusFilter === 'active'));

    api.get(`/api/supplier?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load suppliers.');
        }
        const list = response.data?.data?.items;
        const records = Array.isArray(list) ? list : [];
        const resultPagination = response.data?.data?.pagination || {
          page,
          limit: pagination.limit,
          total: records.length,
        };
        const totalPages = Math.ceil(resultPagination.total / resultPagination.limit);
        if (records.length === 0 && page > 1 && totalPages < page) {
          setIsLoadingSuppliers(true);
          setPage(Math.max(totalPages, 1));
          return;
        }
        setSuppliers(records);
        setPagination(resultPagination);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load suppliers.'));
      })
      .finally(() => {
        if (active) setIsLoadingSuppliers(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, page, pagination.limit, search, statusFilter, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const selectedBranch = branches.find((branch) => getId(branch._id || branch.id) === branchId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = selectedBranch?.branchName || 'Select a branch';
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const visibleFrom = pagination.total ? ((page - 1) * pagination.limit) + 1 : 0;
  const visibleTo = Math.min(page * pagination.limit, pagination.total);
  const activeOnPage = suppliers.filter((supplier) => supplier.isActive !== false).length;
  const inactiveOnPage = suppliers.filter((supplier) => supplier.isActive === false).length;
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingSuppliers;

  const openCreateForm = () => {
    setEditingSupplier(null);
    setForm({ ...EMPTY_SUPPLIER, billingAddress: { ...EMPTY_ADDRESS }, shippingAddress: { ...EMPTY_ADDRESS } });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (supplier) => {
    setEditingSupplier(supplier);
    setForm(getSupplierForm(supplier));
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingSupplier(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    if (name.startsWith('billingAddress.') || name.startsWith('shippingAddress.')) {
      const [addressName, fieldName] = name.split('.');
      setForm((previous) => ({
        ...previous,
        [addressName]: { ...previous[addressName], [fieldName]: value },
      }));
      return;
    }
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId) {
      setFormError('Select a company and branch before saving a supplier.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      gstin: form.gstin.trim(),
      pan: form.pan.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      contactPerson: form.contactPerson.trim(),
      billingAddress: form.billingAddress,
      shippingAddress: form.shippingAddress,
    };
    if (editingSupplier) {
      payload.isActive = form.isActive;
    } else {
      payload.companyId = companyId;
      payload.branchId = branchId;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingSupplier
        ? await api.put(`/api/supplier/${encodeURIComponent(supplierId(editingSupplier))}`, payload)
        : await api.post('/api/supplier', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Supplier details were not saved.');
      }
      showToast(editingSupplier ? 'Supplier updated successfully.' : 'Supplier created successfully.', 'success');
      setIsFormOpen(false);
      setEditingSupplier(null);
      setPage(1);
      setIsLoadingSuppliers(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save supplier details.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingSupplier) return;
    setIsDeleting(true);
    setLoadError('');
    try {
      const response = await api.delete(`/api/supplier/${encodeURIComponent(supplierId(deactivatingSupplier))}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Supplier was not deactivated.');
      }
      showToast('Supplier deactivated successfully.', 'success');
      setDeactivatingSupplier(null);
      setIsLoadingSuppliers(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not deactivate this supplier.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingSuppliers(Boolean(companyId && branchId));
    setReloadKey((previous) => previous + 1);
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setSuppliers([]);
    setPage(1);
    setIsLoadingBranches(Boolean(nextCompanyId));
    setIsLoadingSuppliers(false);
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setSuppliers([]);
    setPage(1);
    setIsLoadingSuppliers(Boolean(nextBranchId));
    setLoadError('');
  };

  const isCompanyPickerVisible = !preferredCompanyId && companies.length > 1;
  const isSeparateBranchPickerVisible = !isCompanyPickerVisible && companyId && branches.length > 1;

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <Truck size={13} className="text-cyan-200" />
              Masters
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Suppliers</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Manage supplier contacts, tax details and payable accounts.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <Building2 size={14} className="text-cyan-200" />{companyLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <MapPin size={14} className="text-cyan-200" />{branchLabel}
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
            Add Supplier
          </Button>
        </div>
      </header>

      {(isCompanyPickerVisible || isSeparateBranchPickerVisible) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {isCompanyPickerVisible && (
            <div>
              <label htmlFor="supplier-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <div className="relative">
                <select
                  id="supplier-company-select"
                  value={companyId}
                  onChange={(event) => changeCompany(event.target.value)}
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
          )}
          {isCompanyPickerVisible && (
            <div>
              <label htmlFor="supplier-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <div className="relative">
                <select
                  id="supplier-branch-select"
                  value={branchId}
                  disabled={!companyId || isLoadingBranches}
                  onChange={(event) => changeBranch(event.target.value)}
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
          {isSeparateBranchPickerVisible && (
            <div>
              <label htmlFor="supplier-branch-filter" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <div className="relative">
                <select
                  id="supplier-branch-filter"
                  value={branchId}
                  disabled={isLoadingBranches}
                  onChange={(event) => changeBranch(event.target.value)}
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
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={retryLoad} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline">
            <RotateCw size={14} />Retry
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total suppliers', value: pagination.total, icon: Truck, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Active on this page', value: activeOnPage, icon: UserRound, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Inactive on this page', value: inactiveOnPage, icon: UsersRound, style: 'bg-slate-100 text-slate-600' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#034665] to-[#068DCB] opacity-0 transition-opacity group-hover:opacity-100" />
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.style}`}><Icon size={18} /></span>
              <div><p className="text-xs text-slate-500">{stat.label}</p><p className="text-base font-semibold text-slate-900">{stat.value}</p></div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Supplier directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Contact details, tax IDs and payable ledger</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setIsLoadingSuppliers(Boolean(companyId && branchId));
                }}
                placeholder="Search suppliers..."
                aria-label="Search suppliers"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
                setIsLoadingSuppliers(Boolean(companyId && branchId));
              }}
              aria-label="Filter suppliers by status"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading suppliers...</div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">{companies.length > 1 ? 'Select a company to view suppliers.' : 'A company is required before suppliers can be managed.'}</div>
        ) : !branchId ? (
          <div className="p-8 text-center text-sm text-slate-500">{branches.length ? 'Select a branch to view its suppliers.' : 'Create a branch before adding suppliers.'}</div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><Truck size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{pagination.total ? 'No suppliers on this page' : 'No suppliers yet'}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{pagination.total ? 'Try another search or status filter.' : 'Add your first supplier to manage purchases and payables.'}</p>
            {!pagination.total && <Button type="button" leftIcon={Plus} onClick={openCreateForm} className="mt-4">Create first supplier</Button>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Supplier</th>
                    <th className="px-5 py-3 font-semibold">GSTIN / PAN</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 font-semibold">Payable account</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((supplier) => (
                    <tr key={supplierId(supplier)} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf4f8] text-[#045d86]"><Truck size={17} /></span>
                          <div><p className="font-semibold text-slate-900">{supplier.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{supplier.code || supplier.branchName || branchLabel}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600"><span className="block">{supplier.gstin || 'GSTIN not set'}</span><span className="mt-1 block text-slate-400">{supplier.pan || 'PAN not set'}</span></td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" />{supplier.phone || '—'}</span>
                        <span className="mt-1 flex items-center gap-1.5"><Mail size={12} className="text-slate-400" />{supplier.email || '—'}</span>
                      </td>
                      <td className="max-w-52 px-5 py-4 text-xs text-slate-600"><span className="line-clamp-2">{addressText(supplier.billingAddress)}</span></td>
                      <td className="px-5 py-4 text-xs text-slate-600">{supplier.payableAccountName || '—'}{supplier.payableAccountCode ? <span className="mt-1 block text-slate-400">{supplier.payableAccountCode}</span> : null}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${supplier.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${supplier.isActive === false ? 'bg-slate-400' : 'bg-emerald-500'}`} />{supplier.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setViewingSupplier(supplier)} aria-label={`View ${supplier.name}`} title="View supplier" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          <button type="button" onClick={() => openEditForm(supplier)} aria-label={`Edit ${supplier.name}`} title="Edit supplier" className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665]"><Pencil size={15} /></button>
                          {supplier.isActive !== false && <button type="button" onClick={() => setDeactivatingSupplier(supplier)} aria-label={`Deactivate ${supplier.name}`} title="Deactivate supplier" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
              <span>Showing {visibleFrom}–{visibleTo} of {pagination.total} suppliers</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsLoadingSuppliers(true); setPage((current) => Math.max(1, current - 1)); }} isDisabled={page <= 1 || isLoading}>Previous</Button>
                <span>Page {page} of {Math.max(totalPages, 1)}</span>
                <Button type="button" variant="outline" onClick={() => { setIsLoadingSuppliers(true); setPage((current) => Math.min(totalPages, current + 1)); }} isDisabled={page >= totalPages || isLoading}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingSupplier ? 'Edit supplier' : 'Create supplier'}
        subtitle={editingSupplier ? 'Update supplier contact and registration details.' : `Add a supplier to ${branchLabel}.`}
        size="xl"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button type="submit" form="supplier-management-form" leftIcon={editingSupplier ? Pencil : Plus} isLoading={isSaving}>{editingSupplier ? 'Save changes' : 'Create supplier'}</Button>
          </>
        )}
      >
        <form id="supplier-management-form" onSubmit={handleSave} className="space-y-5">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="supplier-name" name="name" label="Supplier Name" value={form.name} onChange={handleFormChange} required isDisabled={isSaving} />
            <Input id="supplier-code" name="code" label="Supplier Code" value={form.code} onChange={handleFormChange} isDisabled={isSaving} />
            <Input id="supplier-gstin" name="gstin" label="GSTIN" value={form.gstin} onChange={handleFormChange} isDisabled={isSaving} autoCapitalize="characters" />
            <Input id="supplier-pan" name="pan" label="PAN" value={form.pan} onChange={handleFormChange} isDisabled={isSaving} autoCapitalize="characters" />
            <Input id="supplier-email" name="email" label="Email" type="email" value={form.email} onChange={handleFormChange} isDisabled={isSaving} />
            <Input id="supplier-phone" name="phone" label="Phone" type="tel" value={form.phone} onChange={handleFormChange} isDisabled={isSaving} />
            <Input id="supplier-contact-person" name="contactPerson" label="Contact Person" value={form.contactPerson} onChange={handleFormChange} isDisabled={isSaving} />
            {editingSupplier && (
              <div>
                <label htmlFor="supplier-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select id="supplier-status" name="isActive" value={String(form.isActive)} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.value === 'true' }))} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { key: 'billingAddress', title: 'Billing Address' },
              { key: 'shippingAddress', title: 'Shipping Address' },
            ].map((address) => (
              <div key={address.key} className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-800"><MapPin size={14} className="text-[#045d86]" />{address.title}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id={`${address.key}-line1`} name={`${address.key}.line1`} label="Address Line 1" value={form[address.key].line1} onChange={handleFormChange} isDisabled={isSaving} />
                  <Input id={`${address.key}-line2`} name={`${address.key}.line2`} label="Address Line 2" value={form[address.key].line2} onChange={handleFormChange} isDisabled={isSaving} />
                  <Input id={`${address.key}-city`} name={`${address.key}.city`} label="City" value={form[address.key].city} onChange={handleFormChange} isDisabled={isSaving} />
                  <Input id={`${address.key}-state`} name={`${address.key}.state`} label="State" value={form[address.key].state} onChange={handleFormChange} isDisabled={isSaving} />
                  <Input id={`${address.key}-pincode`} name={`${address.key}.pincode`} label="PIN Code" value={form[address.key].pincode} onChange={handleFormChange} isDisabled={isSaving} />
                  <Input id={`${address.key}-country`} name={`${address.key}.country`} label="Country" value={form[address.key].country} onChange={handleFormChange} isDisabled={isSaving} />
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingSupplier)} onClose={() => setViewingSupplier(null)} title="Supplier details" subtitle={viewingSupplier?.name} size="lg">
        {viewingSupplier && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Supplier name', viewingSupplier.name || '—'],
              ['Status', viewingSupplier.isActive === false ? 'Inactive' : 'Active'],
              ['Supplier code', viewingSupplier.code || '—'],
              ['Contact person', viewingSupplier.contactPerson || '—'],
              ['GSTIN', viewingSupplier.gstin || '—'],
              ['PAN', viewingSupplier.pan || '—'],
              ['Email', viewingSupplier.email || '—'],
              ['Phone', viewingSupplier.phone || '—'],
              ['Branch', viewingSupplier.branchName || branchLabel],
              ['Payable account', viewingSupplier.payableAccountName || '—'],
              ['Billing address', addressText(viewingSupplier.billingAddress)],
              ['Shipping address', addressText(viewingSupplier.shippingAddress)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(deactivatingSupplier)} onClose={() => { if (!isDeleting) setDeactivatingSupplier(null); }} title="Deactivate supplier?" subtitle={deactivatingSupplier?.name} size="sm" closeOnBackdrop={!isDeleting} footer={(
        <>
          <Button type="button" variant="outline" onClick={() => setDeactivatingSupplier(null)} isDisabled={isDeleting}>Keep supplier</Button>
          <Button type="button" variant="danger" leftIcon={Trash2} onClick={handleDeactivate} isLoading={isDeleting}>Deactivate</Button>
        </>
      )}>
        <p className="text-sm leading-6 text-slate-600"><strong>{deactivatingSupplier?.name}</strong> will be deactivated so existing purchase and payable history remains available.</p>
      </Modal>
    </section>
  );
};

export default SuppliersManagementView;
