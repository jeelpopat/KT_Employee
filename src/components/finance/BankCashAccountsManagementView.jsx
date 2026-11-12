import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Eye,
  Landmark,
  MapPin,
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

const ACCOUNT_TYPES = [
  { value: 'Savings', label: 'Savings', icon: Landmark },
  { value: 'Current', label: 'Current', icon: Landmark },
  { value: 'Cash', label: 'Cash', icon: Wallet },
  { value: 'Wallet', label: 'Wallet', icon: Wallet },
  { value: 'CreditCard', label: 'Credit Card', icon: CreditCard },
  { value: 'UPI', label: 'UPI', icon: CircleDollarSign },
];

const EMPTY_ACCOUNT = {
  accountType: 'Savings',
  accountName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  branchId: '',
  openingBalance: '0',
  openingBalanceDate: new Date().toISOString().slice(0, 10),
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

const getAccountId = (account) => getId(account?.id || account?._id);

const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const getAccountForm = (account, canSelectAllBranches) => ({
  ...EMPTY_ACCOUNT,
  accountType: account?.accountType || 'Savings',
  accountName: account?.accountName || '',
  bankName: account?.bankName || '',
  accountNumber: '',
  ifscCode: account?.ifscCode || '',
  branchName: account?.bankBranchName || '',
  branchId: account?.branchId
    ? getId(account.branchId)
    : (canSelectAllBranches ? 'all' : ''),
  openingBalance: String(account?.openingBalance ?? 0),
  openingBalanceDate: account?.openingBalanceDate
    ? new Date(account.openingBalanceDate).toISOString().slice(0, 10)
    : EMPTY_ACCOUNT.openingBalanceDate,
  isActive: account?.isActive !== false,
});

export const BankCashAccountsManagementView = () => {
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
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [ifscLookupStatus, setIfscLookupStatus] = useState({ type: '', message: '' });
  const [isLookingUpIfsc, setIsLookingUpIfsc] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingAccount, setViewingAccount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const ifscLookupControllerRef = useRef(null);
  const ifscLookupSequenceRef = useRef(0);

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
          setIsLoadingBranches(true);
          setCompanyId(getId(availableCompanies[0]._id || availableCompanies[0].id));
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for bank and cash account management.');
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
    if (!companyId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId, includeInactive: 'true' });
    if (branchId) params.set('branchId', branchId);

    api.get(`/api/bank-account?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load bank and cash accounts.');
        }
        setAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load bank and cash accounts.'));
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
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingAccounts;
  const isCompanyPickerVisible = !preferredCompanyId && companies.length > 1;
  const isBranchPickerVisible = branches.length > 1 || canSelectAllBranches;

  const visibleAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? account.isActive !== false : account.isActive === false);
      const searchValues = [
        account.accountName,
        account.accountType,
        account.bankName,
        account.accountNumber,
        account.ifscCode,
        account.branchName,
        account.coaAccountName,
        account.branchId === null ? 'all branches shared' : '',
      ];
      const matchesSearch = !normalizedSearch || searchValues
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [accounts, search, statusFilter]);

  const activeCount = accounts.filter((account) => account.isActive !== false).length;
  const totalBalance = accounts
    .filter((account) => account.isActive !== false)
    .reduce((sum, account) => sum + (Number(account.currentBalance ?? account.balance) || 0), 0);

  const openCreateForm = () => {
    setEditingAccount(null);
    setForm({
      ...EMPTY_ACCOUNT,
      branchId: branchId || '',
      openingBalanceDate: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (account) => {
    setEditingAccount(account);
    setForm(getAccountForm(account, canSelectAllBranches));
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    ifscLookupControllerRef.current?.abort();
    ifscLookupSequenceRef.current += 1;
    setIsLookingUpIfsc(false);
    setIfscLookupStatus({ type: '', message: '' });
    setIsFormOpen(false);
    setEditingAccount(null);
    setFormError('');
  };

  const lookupIfsc = async (value) => {
    const code = String(value || '').trim().toUpperCase();
    ifscLookupControllerRef.current?.abort();
    const sequence = ifscLookupSequenceRef.current + 1;
    ifscLookupSequenceRef.current = sequence;

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setIsLookingUpIfsc(false);
      setIfscLookupStatus({
        type: 'error',
        message: 'Enter a valid 11-character IFSC code to fetch bank details.',
      });
      return;
    }

    const controller = new AbortController();
    ifscLookupControllerRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 5000);
    setIsLookingUpIfsc(true);
    setIfscLookupStatus({ type: 'loading', message: 'Looking up bank details...' });

    try {
      const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'IFSC code was not found.' : 'IFSC lookup service is unavailable.');
      }

      const data = await response.json();
      if (sequence !== ifscLookupSequenceRef.current) return;
      const bankName = String(data.BANK || '').trim();
      const bankBranch = [data.BRANCH, data.CITY].filter(Boolean).join(', ');
      if (!bankName && !bankBranch) {
        throw new Error('No bank details were returned for this IFSC code.');
      }

      setForm((previous) => ({
        ...previous,
        ifscCode: code,
        bankName: bankName || previous.bankName,
        branchName: bankBranch || previous.branchName,
      }));
      setIfscLookupStatus({
        type: 'success',
        message: [bankName, bankBranch].filter(Boolean).join(' · ') || 'Bank details found.',
      });
    } catch (error) {
      if (sequence !== ifscLookupSequenceRef.current) return;
      if (error.name === 'AbortError' && !timedOut) return;
      setIfscLookupStatus({
        type: 'error',
        message: `${timedOut ? 'IFSC lookup timed out.' : getErrorMessage(error, 'Could not look up this IFSC code.')} You can enter the details manually.`,
      });
    } finally {
      clearTimeout(timeoutId);
      if (sequence === ifscLookupSequenceRef.current) {
        setIsLookingUpIfsc(false);
        ifscLookupControllerRef.current = null;
      }
    }
  };

  const handleIfscChange = (event) => {
    const code = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    setForm((previous) => ({
      ...previous,
      ifscCode: code,
      ...(code !== previous.ifscCode ? { bankName: '', branchName: '' } : {}),
    }));
    ifscLookupControllerRef.current?.abort();
    ifscLookupSequenceRef.current += 1;
    setIsLookingUpIfsc(false);

    if (code.length === 11) {
      lookupIfsc(code);
    } else {
      setIfscLookupStatus(code
        ? { type: 'info', message: 'Enter all 11 IFSC characters to auto-fill bank and branch.' }
        : { type: '', message: '' });
    }
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
      setFormError('Select a company before saving a bank or cash account.');
      return;
    }
    if (!form.accountName.trim()) {
      setFormError('Account name is required.');
      return;
    }
    if (isLookingUpIfsc) {
      setFormError('Wait for IFSC lookup to finish before saving.');
      return;
    }

    const requiresBankDetails = ['Savings', 'Current', 'CreditCard'].includes(form.accountType);
    if (requiresBankDetails && (!form.bankName.trim() || !form.accountNumber.trim())) {
      setFormError('Bank name and account number are required for this account type.');
      return;
    }
    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      setFormError('Enter a valid 11-character IFSC code.');
      return;
    }
    if (['Savings', 'Current'].includes(form.accountType) && !form.ifscCode.trim()) {
      setFormError('IFSC code is required for Savings and Current accounts.');
      return;
    }

    const branchForAccount = form.branchId && form.branchId !== 'all' ? form.branchId : null;
    const payload = editingAccount
      ? {
        accountName: form.accountName.trim(),
        bankName: form.bankName.trim(),
        ifscCode: form.ifscCode.trim(),
        branchName: form.branchName.trim(),
        isActive: Boolean(form.isActive),
      }
      : {
        companyId,
        branchId: branchForAccount,
        accountType: form.accountType,
        accountName: form.accountName.trim(),
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        ifscCode: form.ifscCode.trim(),
        branchName: form.branchName.trim(),
        openingBalance: Number(form.openingBalance) || 0,
        openingBalanceDate: form.openingBalanceDate
          ? new Date(`${form.openingBalanceDate}T00:00:00`).toISOString()
          : undefined,
      };
    if (!editingAccount || canSelectAllBranches || editingAccount.branchId) {
      payload.branchId = branchForAccount;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingAccount
        ? await api.put(`/api/bank-account/${encodeURIComponent(getAccountId(editingAccount))}`, payload)
        : await api.post('/api/bank-account', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Account details were not saved.');
      }
      showToast(editingAccount ? 'Bank or cash account updated.' : 'Bank or cash account created.', 'success');
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setLoadError('');
    try {
      const response = await api.delete(`/api/bank-account/${encodeURIComponent(getAccountId(deleteTarget))}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Account was not deleted.');
      }
      showToast('Bank or cash account deleted.', 'success');
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

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingAccounts(Boolean(companyId));
    setReloadKey((previous) => previous + 1);
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setAccounts([]);
    setIsLoadingBranches(Boolean(nextCompanyId));
    setIsLoadingAccounts(Boolean(nextCompanyId));
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setIsLoadingAccounts(Boolean(companyId));
    setLoadError('');
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <Landmark size={13} className="text-cyan-200" />Masters
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Bank &amp; Cash Accounts</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">Manage bank, cash, wallet, card and UPI accounts with live ledger balances.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><Building2 size={14} className="text-cyan-200" />{companyLabel}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><MapPin size={14} className="text-cyan-200" />{branchLabel}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={Plus}
            onClick={openCreateForm}
            isDisabled={!companyId || isLoading}
            className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
          >
            Add Account
          </Button>
        </div>
      </header>

      {(isCompanyPickerVisible || isBranchPickerVisible) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {isCompanyPickerVisible && (
            <div>
              <label htmlFor="bank-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <div className="relative">
                <select id="bank-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
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
          {isBranchPickerVisible && (
            <div>
              <label htmlFor="bank-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <div className="relative">
                <select id="bank-branch-select" value={branchId} disabled={isLoadingBranches} onChange={(event) => changeBranch(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  {canSelectAllBranches && <option value="all">All branches (shared + branch accounts)</option>}
                  {selectableBranches.map((branch) => {
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
          <button type="button" onClick={retryLoad} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline"><RotateCw size={14} />Retry</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Accounts in view', value: visibleAccounts.length, icon: Landmark, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Active accounts', value: activeCount, icon: ShieldCheck, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Combined balance', value: formatCurrency(totalBalance), icon: CircleDollarSign, style: 'bg-cyan-50 text-[#045d86]' },
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
          <div><h2 className="text-sm font-semibold text-slate-900">Account directory</h2><p className="mt-0.5 text-xs text-slate-500">Account details, linked ledgers and balances</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts..." aria-label="Search accounts" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by account status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading bank and cash accounts...</div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">{companies.length > 1 ? 'Select a company to view accounts.' : 'A company is required before accounts can be managed.'}</div>
        ) : visibleAccounts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><Landmark size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{accounts.length ? 'No matching accounts' : 'No bank or cash accounts yet'}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{accounts.length ? 'Try another search or status filter.' : 'Create an account to begin tracking balances and transactions.'}</p>
            {!accounts.length && <Button type="button" leftIcon={Plus} onClick={openCreateForm} className="mt-4">Create first account</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[970px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Account</th>
                  <th className="px-5 py-3 font-semibold">Type / Bank</th>
                  <th className="px-5 py-3 font-semibold">Account number</th>
                  <th className="px-5 py-3 font-semibold">Linked ledger</th>
                  <th className="px-5 py-3 font-semibold">Current balance</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleAccounts.map((account) => {
                  const AccountIcon = ACCOUNT_TYPES.find((type) => type.value === account.accountType)?.icon || Landmark;
                  return (
                    <tr key={getAccountId(account)} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf4f8] text-[#034665]"><AccountIcon size={17} /></span>
                          <div><p className="font-semibold text-slate-900">{account.accountName}</p><p className="mt-0.5 text-[11px] text-slate-400">{account.companyBranchName || branchLabel}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600"><span className="block font-medium text-slate-700">{account.accountType}</span><span className="mt-1 block text-slate-400">{account.bankName || 'No bank specified'}</span></td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">{account.accountNumber || '—'}</td>
                      <td className="px-5 py-4 text-xs text-slate-600"><span className="block font-medium">{account.coaAccountName || '—'}</span>{account.coaAccountCode && <span className="mt-1 block text-slate-400">{account.coaAccountCode}</span>}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(account.currentBalance ?? account.balance)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${account.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${account.isActive === false ? 'bg-slate-400' : 'bg-emerald-500'}`} />{account.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setViewingAccount(account)} aria-label={`View ${account.accountName}`} title="View account" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          <button type="button" onClick={() => openEditForm(account)} aria-label={`Edit ${account.accountName}`} title="Edit account" className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665]"><Pencil size={15} /></button>
                          <button type="button" onClick={() => setDeleteTarget(account)} aria-label={`Delete ${account.accountName}`} title="Delete account" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
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

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingAccount ? 'Edit bank / cash account' : 'Create bank / cash account'} subtitle={editingAccount ? 'Update account details and access status.' : 'Create an account with a linked Chart of Accounts ledger.'} size="xl" closeOnBackdrop={!isSaving} footer={(
        <>
          <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
          <Button type="submit" form="bank-account-form" leftIcon={editingAccount ? Pencil : Plus} isLoading={isSaving} isDisabled={isLookingUpIfsc}>{editingAccount ? 'Save changes' : 'Create account'}</Button>
        </>
      )}>
        <form id="bank-account-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input id="bank-account-name" name="accountName" label="Account name" value={form.accountName} onChange={handleFormChange} required isDisabled={isSaving} placeholder="e.g. HDFC Main Account" />
            <div>
              <label htmlFor="bank-account-type" className="mb-1 block text-xs font-medium text-slate-700">Account type</label>
              <select id="bank-account-type" name="accountType" value={form.accountType} onChange={handleFormChange} disabled={isSaving || Boolean(editingAccount)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                {ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            {isBranchPickerVisible && (
              <div>
                <label htmlFor="bank-account-branch" className="mb-1 block text-xs font-medium text-slate-700">Available at</label>
                <select id="bank-account-branch" name="branchId" value={form.branchId} onChange={handleFormChange} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  {canSelectAllBranches && <option value="all">All branches</option>}
                  {selectableBranches.map((branch) => {
                    const id = getId(branch._id || branch.id);
                    return <option key={id} value={id}>{branch.branchName}</option>;
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-2">
            <Input id="bank-ifsc" name="ifscCode" label="IFSC code" value={form.ifscCode} onChange={handleIfscChange} isDisabled={isSaving} required={['Savings', 'Current'].includes(form.accountType)} autoCapitalize="characters" maxLength={11} placeholder="e.g. HDFC0001234" />
            <Input id="bank-name" name="bankName" label="Bank / provider name" value={form.bankName} onChange={handleFormChange} isDisabled={isSaving} required={['Savings', 'Current', 'CreditCard'].includes(form.accountType)} placeholder="Auto-filled from IFSC" />
            <Input id="bank-account-number" name="accountNumber" label={editingAccount ? 'Account number (cannot be changed)' : 'Account number'} value={editingAccount ? (editingAccount.accountNumber || '••••') : form.accountNumber} onChange={handleFormChange} isDisabled={isSaving || Boolean(editingAccount)} required={!editingAccount && ['Savings', 'Current', 'CreditCard'].includes(form.accountType)} autoComplete="off" />
            <Input id="bank-branch-name" name="branchName" label="Bank branch" value={form.branchName} onChange={handleFormChange} isDisabled={isSaving} placeholder="Auto-filled from IFSC" />
            {ifscLookupStatus.message && (
              <div
                role={ifscLookupStatus.type === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-5 sm:col-span-2 ${
                  ifscLookupStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : ifscLookupStatus.type === 'error'
                      ? 'bg-rose-50 text-rose-700'
                      : ifscLookupStatus.type === 'loading'
                        ? 'bg-[#edf4f8] text-[#034665]'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {ifscLookupStatus.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : null}
                {ifscLookupStatus.type === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : null}
                {ifscLookupStatus.type === 'loading' ? <RotateCw size={14} className="mt-0.5 shrink-0 animate-spin" /> : null}
                <span>{ifscLookupStatus.message}</span>
              </div>
            )}
          </div>

          {!editingAccount && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="bank-opening-balance" name="openingBalance" label="Opening balance (₹)" type="number" min="0" step="0.01" value={form.openingBalance} onChange={handleFormChange} isDisabled={isSaving} />
              <Input id="bank-opening-balance-date" name="openingBalanceDate" label="Opening balance date" type="date" value={form.openingBalanceDate} onChange={handleFormChange} isDisabled={isSaving} />
            </div>
          )}

          {editingAccount && (
            <div>
              <label htmlFor="bank-account-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
              <select id="bank-account-status" name="isActive" value={String(form.isActive)} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.value === 'true' }))} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50 sm:max-w-xs">
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-800">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <p>Account numbers are masked in the account directory. Creating an account also creates its linked ledger in Charts of Accounts.</p>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingAccount)} onClose={() => setViewingAccount(null)} title="Bank / cash account details" subtitle={viewingAccount?.accountName} size="lg">
        {viewingAccount && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Account name', viewingAccount.accountName || '—'],
              ['Account type', viewingAccount.accountType || '—'],
              ['Status', viewingAccount.isActive === false ? 'Inactive' : 'Active'],
              ['Bank / provider', viewingAccount.bankName || '—'],
              ['Account number', viewingAccount.accountNumber || '—'],
              ['IFSC code', viewingAccount.ifscCode || '—'],
              ['Bank branch', viewingAccount.bankBranchName || '—'],
              ['Company branch', viewingAccount.companyBranchName || branchLabel],
              ['Opening balance', formatCurrency(viewingAccount.openingBalance)],
              ['Current balance', formatCurrency(viewingAccount.currentBalance ?? viewingAccount.balance)],
              ['Opening balance date', viewingAccount.openingBalanceDate ? new Date(viewingAccount.openingBalanceDate).toLocaleDateString() : '—'],
              ['Linked ledger', viewingAccount.coaAccountName || '—'],
              ['Ledger code', viewingAccount.coaAccountCode || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => { if (!isDeleting) setDeleteTarget(null); }} title="Delete account?" subtitle={deleteTarget?.accountName} size="sm" closeOnBackdrop={!isDeleting} footer={(
        <>
          <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} isDisabled={isDeleting}>Keep account</Button>
          <Button type="button" variant="danger" leftIcon={Trash2} onClick={handleDelete} isLoading={isDeleting}>Delete account</Button>
        </>
      )}>
        <p className="text-sm leading-6 text-slate-600">This permanently removes the bank or cash account record. Its linked ledger and transaction history are not deleted.</p>
      </Modal>
    </section>
  );
};

export default BankCashAccountsManagementView;
