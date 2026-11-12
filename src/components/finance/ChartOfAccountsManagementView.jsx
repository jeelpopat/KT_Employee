import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Eye,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
const EMPTY_ACCOUNT = {
  name: '',
  code: '',
  type: 'Asset',
  isGroup: false,
  parentId: '',
  branchId: '',
  openingBalance: '0',
  openingBalanceType: 'Dr',
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

const getAccountId = (account) => getId(account?._id || account?.id);

const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const buildAccountTree = (accounts) => {
  const nodes = new Map();
  accounts.forEach((account) => {
    nodes.set(getAccountId(account), { ...account, children: [] });
  });

  const roots = [];
  nodes.forEach((account) => {
    const parent = nodes.get(getId(account.parentId));
    if (parent?.isGroup && parent !== account) {
      parent.children.push(account);
    } else {
      roots.push(account);
    }
  });

  const sortTree = (items) => {
    items.sort((first, second) => String(first.code || '').localeCompare(
      String(second.code || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    ));
    items.forEach((item) => sortTree(item.children));
  };
  sortTree(roots);
  return roots;
};

const filterAccountTree = (nodes, { search, typeFilter, statusFilter }) => {
  const query = search.trim().toLowerCase();
  return nodes.reduce((visible, account) => {
    const children = filterAccountTree(account.children, { search, typeFilter, statusFilter });
    const matchesQuery = !query || [
      account.name,
      account.code,
      account.type,
      account.isGroup ? 'group' : 'ledger',
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesType = typeFilter === 'all' || account.type === typeFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? account.isActive !== false : account.isActive === false);

    if ((matchesQuery && matchesType && matchesStatus) || children.length) {
      visible.push({ ...account, children });
    }
    return visible;
  }, []);
};

const flattenExpandedTree = (nodes, collapsed, searchActive, depth = 0) => {
  const flattened = [];
  nodes.forEach((account) => {
    flattened.push({ ...account, depth });
    const accountId = getAccountId(account);
    if (account.children.length && (searchActive || !collapsed[accountId])) {
      flattened.push(...flattenExpandedTree(account.children, collapsed, searchActive, depth + 1));
    }
  });
  return flattened;
};

export const ChartOfAccountsManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const activeCompanyAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === (preferredCompanyId || getId(access.companyId))
  ));
  const userBranchId = getId(activeCompanyAccess?.branchId) || getId(user?.branchId);
  const userRole = String(activeCompanyAccess?.role || user?.role || '').trim().toLowerCase();
  const hasElevatedBranchAccess = ['admin', 'superadmin'].includes(userRole) ||
    user?.companyCreated === true;

  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [collapsedAccounts, setCollapsedAccounts] = useState({});
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingAccount, setViewingAccount] = useState(null);
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
          setLoadError('No company is available for Chart of Accounts management.');
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
        setIsLoadingAccounts(Boolean(companyId));
        setBranchId((current) => {
          if (current === 'all' && (hasElevatedBranchAccess || !userBranchId)) return current;
          if (availableBranches.some((branch) => getId(branch._id || branch.id) === current)) return current;
          if (userBranchId && availableBranches.some((branch) => getId(branch._id || branch.id) === userBranchId)) {
            return userBranchId;
          }
          return hasElevatedBranchAccess || !userBranchId
            ? 'all'
            : getId(availableBranches[0]?._id || availableBranches[0]?.id);
        });
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
  }, [companyId, hasElevatedBranchAccess, reloadKey, userBranchId]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId, branchId, includeInactive: 'true' });
    api.get(`/api/coa?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load Chart of Accounts.');
        }
        setAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load Chart of Accounts.'));
      })
      .finally(() => {
        if (active) setIsLoadingAccounts(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const selectedBranch = branches.find((branch) => getId(branch._id || branch.id) === branchId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = branchId === 'all' ? 'All branches' : selectedBranch?.branchName || 'Select a branch';
  const canSelectAllBranches = hasElevatedBranchAccess || !userBranchId;
  const selectableBranches = userBranchId && !hasElevatedBranchAccess
    ? branches.filter((branch) => getId(branch._id || branch.id) === userBranchId)
    : branches;
  const isCompanyPickerVisible = !preferredCompanyId && companies.length > 1;
  const isBranchPickerVisible = branches.length > 1 || canSelectAllBranches;
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingAccounts;
  const hasDefaultAccounts = accounts.some((account) => account.isSystemAccount);

  const filteredTree = useMemo(() => filterAccountTree(buildAccountTree(accounts), {
    search,
    typeFilter,
    statusFilter,
  }), [accounts, search, typeFilter, statusFilter]);
  const visibleAccounts = useMemo(() => flattenExpandedTree(
    filteredTree,
    collapsedAccounts,
    Boolean(search.trim())
  ), [filteredTree, collapsedAccounts, search]);

  const activeAccounts = accounts.filter((account) => account.isActive !== false).length;
  const groupCount = accounts.filter((account) => account.isGroup).length;
  const ledgerCount = accounts.filter((account) => !account.isGroup).length;

  const openCreateForm = () => {
    setEditingAccount(null);
    setForm({
      ...EMPTY_ACCOUNT,
      branchId: branchId === 'all' ? 'all' : branchId,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (account) => {
    setEditingAccount(account);
    setForm({
      name: account.name || '',
      code: account.code || '',
      type: account.type || 'Asset',
      isGroup: Boolean(account.isGroup),
      parentId: getId(account.parentId),
      branchId: getId(account.branchId) || 'all',
      openingBalance: String(account.openingBalance ?? 0),
      openingBalanceType: account.openingBalanceType || 'Dr',
      isActive: account.isActive !== false,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingAccount(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: ['isGroup', 'isActive'].includes(name) ? value === 'true' : value,
      ...(name === 'type' ? { parentId: '' } : {}),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId) {
      setFormError('Select a company before saving an account.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Account name is required.');
      return;
    }
    if (!form.type || !ACCOUNT_TYPES.includes(form.type)) {
      setFormError('Select a valid account type.');
      return;
    }
    const openingBalance = Number(form.openingBalance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setFormError('Opening balance must be zero or a positive amount.');
      return;
    }
    if (!editingAccount && !form.branchId) {
      setFormError('Select a branch scope for this account.');
      return;
    }
    if (form.parentId && !accounts.some((account) => (
      getAccountId(account) === form.parentId && account.isGroup && account.type === form.type
    ))) {
      setFormError('Parent must be an active group of the same account type.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      openingBalance,
      openingBalanceType: form.openingBalanceType,
    };
    if (form.code.trim()) payload.code = form.code.trim();
    if (form.parentId) payload.parentId = form.parentId;
    else payload.parentId = null;
    if (editingAccount) {
      payload.isActive = Boolean(form.isActive);
    } else {
      payload.companyId = companyId;
      payload.isGroup = Boolean(form.isGroup);
      payload.branchId = form.branchId === 'all' ? null : form.branchId;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingAccount
        ? await api.put(`/api/coa/${encodeURIComponent(getAccountId(editingAccount))}`, payload)
        : await api.post('/api/coa', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Account was not saved.');
      }
      showToast(editingAccount ? 'Account updated successfully.' : 'Account created successfully.', 'success');
      setIsFormOpen(false);
      setEditingAccount(null);
      setIsLoadingAccounts(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save this account.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleView = async (account) => {
    setViewingAccount(account);
    setDetailError('');
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/coa/${encodeURIComponent(getAccountId(account))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load account details.');
      }
      setViewingAccount(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load account details.');
      setDetailError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setLoadError('');
    try {
      const response = await api.delete(`/api/coa/${encodeURIComponent(getAccountId(deleteTarget))}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Account was not deleted.');
      }
      showToast('Account deactivated successfully.', 'success');
      setDeleteTarget(null);
      setIsLoadingAccounts(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete this account.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!companyId) return;
    setIsSeeding(true);
    setLoadError('');
    try {
      const response = await api.post('/api/coa/seed-default', { companyId });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Default accounts were not created.');
      }
      showToast(`${response.data.data.count || 0} default accounts added.`, 'success');
      setIsLoadingAccounts(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not add default accounts.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingAccounts(Boolean(companyId && branchId));
    setReloadKey((previous) => previous + 1);
  };

  const formBranchId = form.branchId === 'all' ? '' : form.branchId;
  const parentOptions = accounts.filter((account) => (
    account.isGroup &&
    account.isActive !== false &&
    account.type === form.type &&
    (!formBranchId || !getId(account.branchId) || getId(account.branchId) === formBranchId) &&
    (formBranchId || !getId(account.branchId)) &&
    getAccountId(account) !== getAccountId(editingAccount)
  ));
  const branchNameById = new Map(branches.map((branch) => [
    getId(branch._id || branch.id),
    branch.branchName,
  ]));

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <BookOpen size={13} className="text-cyan-200" />
              Masters
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Charts of Accounts</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Organize your company&apos;s accounts into groups and ledgers.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <Building2 size={14} className="text-cyan-200" />{companyLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <GitBranch size={14} className="text-cyan-200" />{branchLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasDefaultAccounts && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSeedDefaults}
                isLoading={isSeeding}
                isDisabled={!companyId || isLoading}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Set up default accounts
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              leftIcon={Plus}
              onClick={openCreateForm}
              isDisabled={!companyId || !branchId || isLoading}
              className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
            >
              Add account
            </Button>
          </div>
        </div>
      </header>

      {(isCompanyPickerVisible || isBranchPickerVisible) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {isCompanyPickerVisible && (
            <div>
              <label htmlFor="coa-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <select
                id="coa-company-select"
                value={companyId}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setBranches([]);
                  setBranchId('');
                  setAccounts([]);
                  setIsLoadingBranches(Boolean(event.target.value));
                  setLoadError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10"
              >
                <option value="">Select a company</option>
                {companies.map((company) => {
                  const id = getId(company._id || company.id);
                  return <option key={id} value={id}>{company.name || company.companyName || 'Unnamed Company'}</option>;
                })}
              </select>
            </div>
          )}
          {isBranchPickerVisible && (
            <div>
              <label htmlFor="coa-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <select
                id="coa-branch-select"
                value={branchId}
                disabled={!companyId || isLoadingBranches}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setAccounts([]);
                  setIsLoadingAccounts(Boolean(event.target.value));
                  setLoadError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
              >
                {canSelectAllBranches && <option value="all">All branches (shared + branch accounts)</option>}
                {selectableBranches.map((branch) => {
                  const id = getId(branch._id || branch.id);
                  return <option key={id} value={id}>{branch.branchName}</option>;
                })}
              </select>
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
          { label: 'Accounts in view', value: accounts.length, icon: BookOpen, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Groups / Ledgers', value: `${groupCount} / ${ledgerCount}`, icon: Layers3, style: 'bg-cyan-50 text-[#045d86]' },
          { label: 'Active accounts', value: activeAccounts, icon: ShieldCheck, style: 'bg-emerald-50 text-emerald-700' },
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
            <h2 className="text-sm font-semibold text-slate-900">Account hierarchy</h2>
            <p className="mt-0.5 text-xs text-slate-500">Groups contain ledgers; system accounts are protected.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or code..."
                aria-label="Search accounts"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-52"
              />
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by account type" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
              <option value="all">All account types</option>
              {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by account status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading Charts of Accounts...</div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">{companies.length > 1 ? 'Select a company to view accounts.' : 'A company is required before accounts can be managed.'}</div>
        ) : !accounts.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><BookOpen size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No accounts in this scope yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Set up the standard account hierarchy or create your first group or ledger.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {!hasDefaultAccounts && <Button type="button" onClick={handleSeedDefaults} isLoading={isSeeding} isDisabled={!companyId}>Set up default accounts</Button>}
              <Button type="button" variant="outline" leftIcon={Plus} onClick={openCreateForm}>Create account</Button>
            </div>
          </div>
        ) : !visibleAccounts.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No accounts match your search and filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Account name</th>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Scope</th>
                  <th className="px-5 py-3 font-semibold">Opening balance</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleAccounts.map((account) => {
                  const accountId = getAccountId(account);
                  const isInactive = account.isActive === false;
                  const scopeLabel = getId(account.branchId)
                    ? branchNameById.get(getId(account.branchId)) || 'Branch account'
                    : 'Shared';
                  return (
                    <tr key={accountId} className={`transition hover:bg-slate-50/70 ${isInactive ? 'opacity-70' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${account.depth * 22}px` }}>
                          {account.isGroup ? (
                            <button
                              type="button"
                              onClick={() => setCollapsedAccounts((previous) => ({ ...previous, [accountId]: !previous[accountId] }))}
                              aria-label={`${collapsedAccounts[accountId] ? 'Expand' : 'Collapse'} ${account.name}`}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              {collapsedAccounts[accountId] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : <span className="w-6" />}
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${account.isGroup ? 'bg-[#edf4f8] text-[#034665]' : 'bg-slate-100 text-slate-500'}`}>
                            {account.isGroup ? <Layers3 size={15} /> : <Wallet size={15} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{account.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                              <span>{account.isGroup ? 'Group account' : 'Ledger account'}</span>
                              {account.isSystemAccount && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">System</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{account.code || 'Auto'}</td>
                      <td className="px-5 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">{account.type}</span></td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{scopeLabel}</td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-700">{formatCurrency(account.openingBalance)} <span className="text-[10px] text-slate-400">{account.openingBalanceType || 'Dr'}</span></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isInactive ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500'}`} />{isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => handleView(account)} aria-label={`View ${account.name}`} title="View account" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          <button type="button" onClick={() => openEditForm(account)} aria-label={`Edit ${account.name}`} title={account.isSystemAccount ? 'Edit status and opening balance' : 'Edit account'} className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665]"><Pencil size={15} /></button>
                          <button type="button" onClick={() => setDeleteTarget(account)} disabled={account.isSystemAccount} aria-label={`Delete ${account.name}`} title={account.isSystemAccount ? 'System accounts cannot be deleted' : 'Deactivate account'} className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <span>{visibleAccounts.length} rows shown · {activeAccounts} active</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCollapsedAccounts({})} className="font-medium text-[#045d86] hover:underline">Expand all</button>
            <button type="button" onClick={() => setCollapsedAccounts(Object.fromEntries(accounts.filter((account) => account.isGroup).map((account) => [getAccountId(account), true])))} className="font-medium text-[#045d86] hover:underline">Collapse all</button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingAccount ? 'Edit account' : 'Create account'}
        subtitle={editingAccount ? 'Update account details and access status.' : 'Add a group or ledger to the account hierarchy.'}
        size="lg"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button type="submit" form="coa-account-form" leftIcon={editingAccount ? Pencil : Plus} isLoading={isSaving}>
              {editingAccount ? 'Save changes' : 'Create account'}
            </Button>
          </>
        )}
      >
        <form id="coa-account-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="coa-name"
              name="name"
              label="Account name"
              value={form.name}
              onChange={handleFormChange}
              required
              isDisabled={isSaving || Boolean(editingAccount?.isSystemAccount)}
              placeholder="e.g. Office Equipment"
            />
            <Input
              id="coa-code"
              name="code"
              label="Account code"
              value={form.code}
              onChange={handleFormChange}
              isDisabled={isSaving || Boolean(editingAccount?.isSystemAccount)}
              helperText={editingAccount ? '' : 'Leave blank to generate automatically.'}
              placeholder="e.g. 1500"
            />
            <div>
              <label htmlFor="coa-type" className="mb-1 block text-xs font-medium text-slate-700">Account type</label>
              <select id="coa-type" name="type" value={form.type} onChange={handleFormChange} disabled={isSaving || Boolean(editingAccount?.isSystemAccount)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            {!editingAccount && (
              <div>
                <label htmlFor="coa-account-kind" className="mb-1 block text-xs font-medium text-slate-700">Account kind</label>
                <select id="coa-account-kind" name="isGroup" value={String(form.isGroup)} onChange={handleFormChange} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                  <option value="false">Ledger account</option><option value="true">Group account</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="coa-parent" className="mb-1 block text-xs font-medium text-slate-700">Parent group</label>
              <select id="coa-parent" name="parentId" value={form.parentId} onChange={handleFormChange} disabled={isSaving || Boolean(editingAccount?.isSystemAccount)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">No parent (top level)</option>
                {parentOptions.map((parent) => <option key={getAccountId(parent)} value={getAccountId(parent)}>{parent.code} · {parent.name}</option>)}
              </select>
            </div>
            {!editingAccount && isBranchPickerVisible && (
              <div>
                <label htmlFor="coa-account-branch" className="mb-1 block text-xs font-medium text-slate-700">Account scope</label>
                <select id="coa-account-branch" name="branchId" value={form.branchId} onChange={handleFormChange} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                  {canSelectAllBranches && <option value="all">Shared across all branches</option>}
                  {selectableBranches.map((branch) => {
                    const id = getId(branch._id || branch.id);
                    return <option key={id} value={id}>{branch.branchName}</option>;
                  })}
                </select>
              </div>
            )}
            <Input id="coa-opening-balance" name="openingBalance" label="Opening balance (₹)" type="number" min="0" step="0.01" value={form.openingBalance} onChange={handleFormChange} isDisabled={isSaving} />
            <div>
              <label htmlFor="coa-balance-type" className="mb-1 block text-xs font-medium text-slate-700">Opening balance type</label>
              <select id="coa-balance-type" name="openingBalanceType" value={form.openingBalanceType} onChange={handleFormChange} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="Dr">Debit (Dr)</option><option value="Cr">Credit (Cr)</option>
              </select>
            </div>
            {editingAccount && (
              <div>
                <label htmlFor="coa-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select id="coa-status" name="isActive" value={String(form.isActive)} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.value === 'true' }))} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>
          {editingAccount?.isSystemAccount && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-800">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <p>System accounts are protected. Their name, code, type, and parent cannot be changed.</p>
            </div>
          )}
          {!editingAccount && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-600">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#045d86]" />
              <p>Account codes are unique within their company and branch scope. Account kind cannot be changed after creation.</p>
            </div>
          )}
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingAccount)} onClose={() => { if (!isLoadingDetails) setViewingAccount(null); }} title="Account details" subtitle={viewingAccount?.name} size="lg">
        {viewingAccount && (
          <div className="space-y-3">
            {isLoadingDetails && <p className="flex items-center gap-2 text-xs text-slate-500"><RotateCw size={14} className="animate-spin" />Loading ledger balance...</p>}
            {detailError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Account name', viewingAccount.name || '—'],
                ['Account code', viewingAccount.code || '—'],
                ['Account type', viewingAccount.type || '—'],
                ['Kind', viewingAccount.isGroup ? 'Group account' : 'Ledger account'],
                ['Parent group', accounts.find((account) => getAccountId(account) === getId(viewingAccount.parentId))?.name || 'Top level'],
                ['Branch scope', getId(viewingAccount.branchId) ? branchNameById.get(getId(viewingAccount.branchId)) || 'Branch account' : 'Shared across branches'],
                ['Opening balance', `${formatCurrency(viewingAccount.openingBalance)} ${viewingAccount.openingBalanceType || 'Dr'}`],
                ['Current balance', Number.isFinite(Number(viewingAccount.currentBalance)) ? formatCurrency(viewingAccount.currentBalance) : '—'],
                ['Status', viewingAccount.isActive === false ? 'Inactive' : 'Active'],
                ['Account origin', viewingAccount.isSystemAccount ? 'System account' : 'Custom account'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!isDeleting) setDeleteTarget(null); }}
        title="Deactivate account?"
        subtitle={deleteTarget?.name}
        size="sm"
        closeOnBackdrop={!isDeleting}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} isDisabled={isDeleting}>Keep account</Button>
            <Button type="button" variant="danger" leftIcon={Trash2} onClick={handleDelete} isLoading={isDeleting}>Deactivate</Button>
          </>
        )}
      >
        <div className="space-y-3 text-xs leading-5 text-slate-600">
          <p>This account will be marked inactive to preserve its financial history.</p>
          {deleteTarget?.isGroup && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Groups with child accounts cannot be deactivated.</p>}
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2"><CircleDollarSign size={14} className="mt-0.5 shrink-0 text-slate-500" />Accounts with posted transactions cannot be deactivated.</p>
        </div>
      </Modal>
    </section>
  );
};

export default ChartOfAccountsManagementView;
