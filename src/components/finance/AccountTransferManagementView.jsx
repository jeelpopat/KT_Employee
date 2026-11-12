import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  MapPin,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const PAYMENT_MODES = ['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'Other'];
const TRANSFER_TYPES = [
  { value: 'BANK_TO_BANK', label: 'Bank to Bank' },
  { value: 'BANK_TO_CASH', label: 'Bank to Cash' },
  { value: 'CASH_TO_BANK', label: 'Cash to Bank' },
  { value: 'CASH_TO_CASH', label: 'Cash to Cash' },
  { value: 'FUND_PLUS', label: 'Fund Plus' },
  { value: 'FUND_MINUS', label: 'Fund Minus' },
];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  fromAccountId: '',
  toAccountId: '',
  contraAccountId: '',
  amount: '',
  transferDate: today(),
  paymentMode: 'Other',
  referenceNo: '',
  narration: '',
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

const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const getAccountId = (account) => getId(account?.id || account?._id);
const getTransferId = (transfer) => getId(transfer?._id || transfer?.id);

const accountName = (account) => {
  if (!account) return '—';
  return account.accountName || account.name || 'Unknown account';
};

const transactionLabel = (transferType) => (
  TRANSFER_TYPES.find((type) => type.value === transferType)?.label || transferType || 'Transaction'
);

const dateToIso = (date) => (
  date ? new Date(`${date}T00:00:00`).toISOString() : undefined
);

export const AccountTransferManagementView = () => {
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
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [operation, setOperation] = useState('transfer');
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingLedgers, setIsLoadingLedgers] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

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
          setLoadError('No company is available for account transfers.');
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
        setIsLoadingLedgers(Boolean(companyId));
        setIsLoadingTransactions(Boolean(companyId));
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
        if (active) {
          setLoadError(getErrorMessage(error, 'Could not load branches.'));
          setIsLoadingLedgers(false);
        }
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
    const params = new URLSearchParams({ companyId, branchId });
    api.get(`/api/bank-account?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load bank and cash accounts.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setAccounts(records.filter((account) => account.isActive !== false));
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

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId, branchId });
    api.get(`/api/coa?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load Charts of Accounts.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setLedgerAccounts(records.filter((account) => !account.isGroup && account.isActive !== false));
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load ledger accounts.'));
      })
      .finally(() => {
        if (active) setIsLoadingLedgers(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId });
    if (branchId !== 'all') params.set('branchId', branchId);
    if (typeFilter !== 'all') params.set('transferType', typeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (fromDate) params.set('from', dateToIso(fromDate));
    if (toDate) params.set('to', `${dateToIso(toDate).slice(0, 10)}T23:59:59.999Z`);
    api.get(`/api/bank-account/transfers?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load account transfers.');
        }
        setTransactions(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load account transfers.'));
      })
      .finally(() => {
        if (active) setIsLoadingTransactions(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, typeFilter, statusFilter, fromDate, toDate, reloadKey]);

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
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingAccounts ||
    (operation !== 'transfer' && isLoadingLedgers);
  const availableAccounts = accounts.filter((account) => account.isActive !== false);
  const visibleTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return transactions;
    return transactions.filter((transaction) => {
      const searchable = [
        transaction.transferType,
        transaction.paymentMode,
        transaction.referenceNo,
        transaction.narration,
        transaction.fromAccountId?.accountName,
        transaction.toAccountId?.accountName,
        transaction.contraAccountId?.name,
      ];
      return searchable.some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [transactions, search]);
  const completedTransactions = transactions.filter((transaction) => transaction.status === 'Completed').length;
  const transactionVolume = transactions
    .filter((transaction) => transaction.status === 'Completed')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);

  const updateForm = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId) {
      setFormError('Select a company and branch scope before posting a transaction.');
      return;
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (operation === 'transfer' && (!form.fromAccountId || !form.toAccountId)) {
      setFormError('Select both source and destination accounts.');
      return;
    }
    if (operation === 'transfer' && form.fromAccountId === form.toAccountId) {
      setFormError('Source and destination accounts must be different.');
      return;
    }
    if (operation === 'fund-plus' && (!form.toAccountId || !form.contraAccountId)) {
      setFormError('Select the receiving account and source ledger.');
      return;
    }
    if (operation === 'fund-minus' && (!form.fromAccountId || !form.contraAccountId)) {
      setFormError('Select the paying account and destination ledger.');
      return;
    }

    const payload = {
      companyId,
      branchId: branchId === 'all' ? null : branchId,
      amount: Number(form.amount),
      transferDate: dateToIso(form.transferDate),
      paymentMode: form.paymentMode,
      referenceNo: form.referenceNo.trim(),
      narration: form.narration.trim(),
    };
    let endpoint = '/api/bank-account/transfer';
    if (operation === 'transfer') {
      payload.fromAccountId = form.fromAccountId;
      payload.toAccountId = form.toAccountId;
    } else if (operation === 'fund-plus') {
      endpoint = '/api/bank-account/fund-plus';
      payload.toAccountId = form.toAccountId;
      payload.contraAccountId = form.contraAccountId;
    } else {
      endpoint = '/api/bank-account/fund-minus';
      payload.fromAccountId = form.fromAccountId;
      payload.contraAccountId = form.contraAccountId;
    }

    setIsSaving(true);
    setFormError('');
    setLoadError('');
    try {
      const response = await api.post(endpoint, payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Transaction was not posted.');
      }
      showToast(response.data.message || 'Transaction posted successfully.', 'success');
      setForm({ ...EMPTY_FORM, transferDate: today() });
      setIsLoadingAccounts(true);
      setIsLoadingTransactions(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not post this transaction.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setLoadError('');
    try {
      const response = await api.post(
        `/api/bank-account/transfers/${encodeURIComponent(getTransferId(cancelTarget))}/cancel`,
        { companyId },
      );
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Transaction was not reversed.');
      }
      showToast('Transaction cancelled and reversing journal entry created.', 'success');
      setCancelTarget(null);
      setIsLoadingAccounts(true);
      setIsLoadingTransactions(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not cancel this transaction.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setAccounts([]);
    setLedgerAccounts([]);
    setTransactions([]);
    setIsLoadingBranches(Boolean(nextCompanyId));
    setIsLoadingAccounts(Boolean(nextCompanyId));
    setIsLoadingLedgers(Boolean(nextCompanyId));
    setIsLoadingTransactions(Boolean(nextCompanyId));
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setIsLoadingAccounts(Boolean(companyId));
    setIsLoadingLedgers(Boolean(companyId));
    setIsLoadingTransactions(Boolean(companyId));
    setLoadError('');
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingAccounts(Boolean(companyId));
    setIsLoadingLedgers(Boolean(companyId));
    setIsLoadingTransactions(Boolean(companyId));
    setReloadKey((previous) => previous + 1);
  };

  const renderAccountOptions = (excludeId = '') => availableAccounts
    .filter((account) => getAccountId(account) !== excludeId)
    .map((account) => (
      <option key={getAccountId(account)} value={getAccountId(account)}>
        {accountName(account)} · {account.accountType} · {formatCurrency(account.currentBalance ?? account.balance)}
      </option>
    ));

  const renderLedgerOptions = () => ledgerAccounts.map((account) => (
    <option key={getAccountId(account)} value={getAccountId(account)}>
      {account.code ? `${account.code} · ` : ''}{account.name} · {account.type}
    </option>
  ));

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <ArrowLeftRight size={13} className="text-cyan-200" />Accounting
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Account Transfer</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">Move funds between accounts, record deposits and post withdrawals to the ledger.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><Building2 size={14} className="text-cyan-200" />{companyLabel}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><MapPin size={14} className="text-cyan-200" />{branchLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-cyan-50">
            <ShieldCheck size={16} className="text-cyan-200" />
            Journal entries post automatically
          </div>
        </div>
      </header>

      {(isCompanyPickerVisible || isBranchPickerVisible) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {isCompanyPickerVisible && (
            <div>
              <label htmlFor="transfer-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <div className="relative">
                <select id="transfer-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
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
              <label htmlFor="transfer-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch scope</label>
              <div className="relative">
                <select id="transfer-branch-select" value={branchId} disabled={isLoadingBranches} onChange={(event) => changeBranch(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  {canSelectAllBranches && <option value="all">All branches</option>}
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
          { label: 'Movements shown', value: visibleTransactions.length, icon: ArrowLeftRight, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Completed movements', value: completedTransactions, icon: CheckCircle2, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Completed volume', value: formatCurrency(transactionVolume), icon: CircleDollarSign, style: 'bg-cyan-50 text-[#045d86]' },
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-4 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-900">Post a transaction</h2>
            <p className="mt-0.5 text-xs text-slate-500">Choose a movement type and enter the transaction details.</p>
          </div>
          <div className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-slate-50/70 p-2">
            {[
              { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
              { value: 'fund-plus', label: 'Fund Plus', icon: ArrowDownLeft },
              { value: 'fund-minus', label: 'Fund Minus', icon: ArrowUpRight },
            ].map((tab) => {
              const Icon = tab.icon;
              const selected = operation === tab.value;
              return (
                <button key={tab.value} type="button" onClick={() => { setOperation(tab.value); setFormError(''); }} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition ${selected ? 'bg-white text-[#034665] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'}`}>
                  <Icon size={14} />{tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
            {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
            {!companyId ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Select a company to post a transaction.</p>
            ) : isLoading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-slate-500"><RotateCw size={17} className="mr-2 animate-spin" />Loading accounts...</div>
            ) : availableAccounts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Create an active bank or cash account before posting a transfer or fund movement.</div>
            ) : (
              <>
                {operation === 'transfer' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="transfer-from-account" className="mb-1 block text-xs font-medium text-slate-700">Transfer from</label>
                      <select id="transfer-from-account" value={form.fromAccountId} onChange={(event) => updateForm('fromAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select source account</option>{renderAccountOptions()}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="transfer-to-account" className="mb-1 block text-xs font-medium text-slate-700">Transfer to</label>
                      <select id="transfer-to-account" value={form.toAccountId} onChange={(event) => updateForm('toAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select destination account</option>{renderAccountOptions(form.fromAccountId)}
                      </select>
                    </div>
                  </div>
                )}
                {operation === 'fund-plus' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fund-plus-account" className="mb-1 block text-xs font-medium text-slate-700">Deposit to</label>
                      <select id="fund-plus-account" value={form.toAccountId} onChange={(event) => updateForm('toAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select receiving account</option>{renderAccountOptions()}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fund-plus-ledger" className="mb-1 block text-xs font-medium text-slate-700">Source ledger</label>
                      <select id="fund-plus-ledger" value={form.contraAccountId} onChange={(event) => updateForm('contraAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select source ledger</option>{renderLedgerOptions()}
                      </select>
                    </div>
                  </div>
                )}
                {operation === 'fund-minus' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fund-minus-account" className="mb-1 block text-xs font-medium text-slate-700">Withdraw from</label>
                      <select id="fund-minus-account" value={form.fromAccountId} onChange={(event) => updateForm('fromAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select paying account</option>{renderAccountOptions()}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fund-minus-ledger" className="mb-1 block text-xs font-medium text-slate-700">Destination ledger</label>
                      <select id="fund-minus-ledger" value={form.contraAccountId} onChange={(event) => updateForm('contraAccountId', event.target.value)} required disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select destination ledger</option>{renderLedgerOptions()}
                      </select>
                    </div>
                  </div>
                )}

                {operation !== 'transfer' && ledgerAccounts.length === 0 && (
                  <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No active ledger accounts are available. Add or activate a ledger in Charts of Accounts.</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="transfer-amount" label="Amount (₹)" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} required isDisabled={isSaving} placeholder="0.00" />
                  <Input id="transfer-date" label="Transaction date" type="date" value={form.transferDate} onChange={(event) => updateForm('transferDate', event.target.value)} required isDisabled={isSaving} />
                  <div>
                    <label htmlFor="transfer-payment-mode" className="mb-1 block text-xs font-medium text-slate-700">Payment mode</label>
                    <select id="transfer-payment-mode" value={form.paymentMode} onChange={(event) => updateForm('paymentMode', event.target.value)} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                      {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </div>
                  <Input id="transfer-reference" label="Reference number" value={form.referenceNo} onChange={(event) => updateForm('referenceNo', event.target.value)} isDisabled={isSaving} placeholder="Optional bank reference" />
                  <div className="sm:col-span-2">
                    <label htmlFor="transfer-narration" className="mb-1 block text-xs font-medium text-slate-700">Narration <span className="font-normal text-slate-400">(optional)</span></label>
                    <textarea id="transfer-narration" rows={2} value={form.narration} onChange={(event) => updateForm('narration', event.target.value)} disabled={isSaving} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" placeholder="Add a note for the accounting record" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={14} className="text-[#068DCB]" />A balanced journal entry will be created.</p>
                  <Button type="submit" leftIcon={operation === 'transfer' ? ArrowLeftRight : Plus} isLoading={isSaving} isDisabled={!companyId || isLoading || (operation !== 'transfer' && ledgerAccounts.length === 0)}>
                    {operation === 'transfer' ? 'Post transfer' : operation === 'fund-plus' ? 'Record fund plus' : 'Record fund minus'}
                  </Button>
                </div>
              </>
            )}
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:px-5">
            <div><h2 className="text-sm font-semibold text-slate-900">Movement history</h2><p className="mt-0.5 text-xs text-slate-500">Review, filter or reverse completed transactions.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative sm:col-span-2">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, account..." aria-label="Search transfer history" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10" />
              </div>
              <select value={typeFilter} onChange={(event) => { setIsLoadingTransactions(true); setTypeFilter(event.target.value); }} aria-label="Filter transaction type" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="all">All movement types</option>{TRANSFER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => { setIsLoadingTransactions(true); setStatusFilter(event.target.value); }} aria-label="Filter transaction status" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="all">All statuses</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
              </select>
              <Input id="movement-from-date" label="From" type="date" value={fromDate} onChange={(event) => { setIsLoadingTransactions(true); setFromDate(event.target.value); }} />
              <Input id="movement-to-date" label="To" type="date" value={toDate} onChange={(event) => { setIsLoadingTransactions(true); setToDate(event.target.value); }} />
            </div>
          </div>

          {isLoadingTransactions ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><RotateCw size={17} className="mr-2 animate-spin" />Loading movements...</div>
          ) : !companyId ? (
            <div className="p-8 text-center text-sm text-slate-500">Select a company to view movement history.</div>
          ) : visibleTransactions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf4f8] text-[#034665]"><Clock3 size={21} /></span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">No movements found</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Posted transfers and fund movements will appear here.</p>
            </div>
          ) : (
            <div className="max-h-[720px] overflow-auto">
              <div className="divide-y divide-slate-100">
                {visibleTransactions.map((transaction) => {
                  const isFundPlus = transaction.transferType === 'FUND_PLUS';
                  const isFundMinus = transaction.transferType === 'FUND_MINUS';
                  const from = transaction.fromAccountId?.accountName ||
                    (isFundPlus ? transaction.contraAccountId?.name : '—');
                  const to = transaction.toAccountId?.accountName ||
                    (isFundMinus ? transaction.contraAccountId?.name : '—');
                  return (
                    <article key={getTransferId(transaction)} className="p-4 transition hover:bg-slate-50/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isFundPlus ? 'bg-emerald-50 text-emerald-700' : isFundMinus ? 'bg-amber-50 text-amber-700' : 'bg-[#edf4f8] text-[#034665]'}`}>
                            {isFundPlus ? <ArrowDownLeft size={17} /> : isFundMinus ? <ArrowUpRight size={17} /> : <ArrowLeftRight size={17} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{transactionLabel(transaction.transferType)}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">{from} <span className="text-slate-400">→</span> {to}</p>
                            <p className="mt-1 truncate text-[10px] text-slate-400">{new Date(transaction.transferDate).toLocaleDateString()} · {transaction.paymentMode || 'Other'}{transaction.referenceNo ? ` · ${transaction.referenceNo}` : ''}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-slate-900">{formatCurrency(transaction.amount)}</p>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${transaction.status === 'Cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{transaction.status || 'Completed'}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end gap-1">
                        <button type="button" onClick={() => setViewingTransaction(transaction)} aria-label={`View ${transactionLabel(transaction.transferType)} details`} title="View details" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={14} /></button>
                        {transaction.status !== 'Cancelled' && <button type="button" onClick={() => setCancelTarget(transaction)} aria-label={`Reverse ${transactionLabel(transaction.transferType)}`} title="Cancel and reverse" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><X size={14} /></button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={Boolean(viewingTransaction)} onClose={() => setViewingTransaction(null)} title="Movement details" subtitle={viewingTransaction ? transactionLabel(viewingTransaction.transferType) : ''} size="lg">
        {viewingTransaction && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Type', transactionLabel(viewingTransaction.transferType)],
              ['Status', viewingTransaction.status || 'Completed'],
              ['Date', viewingTransaction.transferDate ? new Date(viewingTransaction.transferDate).toLocaleString() : '—'],
              ['Amount', formatCurrency(viewingTransaction.amount)],
              ['From', viewingTransaction.fromAccountId?.accountName || (viewingTransaction.transferType === 'FUND_PLUS' ? viewingTransaction.contraAccountId?.name : '—') || '—'],
              ['To', viewingTransaction.toAccountId?.accountName || (viewingTransaction.transferType === 'FUND_MINUS' ? viewingTransaction.contraAccountId?.name : '—') || '—'],
              ['Payment mode', viewingTransaction.paymentMode || 'Other'],
              ['Reference number', viewingTransaction.referenceNo || '—'],
              ['Narration', viewingTransaction.narration || '—'],
              ['Journal entry', viewingTransaction.journalEntryId?.entryNumber || viewingTransaction.journalEntryId?._id || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => { if (!isCancelling) setCancelTarget(null); }} title="Cancel and reverse transaction?" subtitle={cancelTarget ? `${transactionLabel(cancelTarget.transferType)} · ${formatCurrency(cancelTarget.amount)}` : ''} size="sm" closeOnBackdrop={!isCancelling} footer={(
        <>
          <Button type="button" variant="outline" onClick={() => setCancelTarget(null)} isDisabled={isCancelling}>Keep transaction</Button>
          <Button type="button" variant="danger" leftIcon={X} onClick={handleCancel} isLoading={isCancelling}>Cancel and reverse</Button>
        </>
      )}>
        <p className="text-sm leading-6 text-slate-600">This does not delete the original transaction. It creates a reversing journal entry and marks the movement as Cancelled.</p>
      </Modal>
    </section>
  );
};

export default AccountTransferManagementView;
