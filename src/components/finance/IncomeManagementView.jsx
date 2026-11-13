import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const ALL_BRANCHES = 'all';
const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const EMPTY_FORM = {
  financialYearId: '',
  incomeType: 'service',
  title: '',
  amount: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  paymentMode: 'bank',
  bankAccountId: '',
  description: '',
};

const getId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  return String(value._id || value.id || value.companyId || '').trim();
};

const getUserCompanyId = (user) => {
  const activeAccess = user?.companyAccess?.find((access) => access?.isActive);
  return getId(user?.companyId) || getId(user?.company?._id || user?.company) || getId(activeAccess?.companyId);
};

const getRecords = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(numberValue(value));
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const accountTypesForMode = {
  cash: ['Cash', 'Wallet'],
  bank: ['Savings', 'Current'],
  online: ['UPI', 'Savings', 'Current'],
};

export const IncomeManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const activeAccess = user?.companyAccess?.find((access) => access?.isActive && getId(access.companyId) === preferredCompanyId);
  const userBranchId = getId(activeAccess?.branchId) || getId(user?.branchId);
  const role = String(activeAccess?.role || user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) || user?.companyCreated === true;

  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(canSelectAllBranches || !userBranchId ? ALL_BRANCHES : userBranchId);
  const [incomes, setIncomes] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingIncomes, setIsLoadingIncomes] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [formBranchId, setFormBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const selectableBranches = branches.filter((branch) => (
    !userBranchId || canSelectAllBranches || getId(branch) === userBranchId
  ));
  const branchNames = useMemo(() => new Map(
    branches.map((branch) => [getId(branch), branch.branchName || branch.name || 'Branch']),
  ), [branches]);
  const activeCompanyId = preferredCompanyId || companyId;

  useEffect(() => {
    if (preferredCompanyId) return undefined;
    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load companies.');
        const records = getRecords(response.data?.data);
        setCompanies(records);
        if (records.length === 1) {
          setCompanyId(getId(records[0]));
          setIsLoadingBranches(true);
          setIsLoadingIncomes(true);
        }
        if (!records.length) setLoadError('No company is available for Income.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load companies.')); })
      .finally(() => { if (active) setIsLoadingCompanies(false); });
    return () => { active = false; };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return undefined;
    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load branches.');
        const records = getRecords(response.data?.data);
        setBranches(records);
        setIsLoadingSetup(true);
        setBranchId((current) => {
          if (current === ALL_BRANCHES && (canSelectAllBranches || !userBranchId)) return current;
          if (records.some((branch) => getId(branch) === current)) return current;
          if (userBranchId && records.some((branch) => getId(branch) === userBranchId)) return userBranchId;
          return canSelectAllBranches || !userBranchId ? ALL_BRANCHES : getId(records[0]);
        });
        setFormBranchId((current) => (
          records.some((branch) => getId(branch) === current)
            ? current
            : records.some((branch) => getId(branch) === userBranchId)
              ? userBranchId
              : getId(records[0])
        ));
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load branches.')); })
      .finally(() => { if (active) setIsLoadingBranches(false); });
    return () => { active = false; };
  }, [activeCompanyId, canSelectAllBranches, userBranchId]);

  useEffect(() => {
    if (!activeCompanyId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId: activeCompanyId });
    if (branchId !== ALL_BRANCHES) params.set('branchId', branchId);
    api.get(`/api/expense/income/all?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load income records.');
        setIncomes(getRecords(response.data?.data));
        setLoadError('');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load income records.')); })
      .finally(() => { if (active) setIsLoadingIncomes(false); });
    return () => { active = false; };
  }, [activeCompanyId, branchId, reloadKey]);

  useEffect(() => {
    if (!activeCompanyId || !formBranchId) return undefined;
    let active = true;
    Promise.allSettled([
      api.get(`/api/financial-year?branchId=${encodeURIComponent(formBranchId)}`),
      api.get(`/api/bank-account?companyId=${encodeURIComponent(activeCompanyId)}&branchId=${encodeURIComponent(formBranchId)}`),
    ]).then(([yearResult, accountResult]) => {
      if (!active) return;
      const failures = [];
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        setFinancialYears(getRecords(yearResult.value.data?.data).filter((year) => year.isLocked !== true));
      } else {
        failures.push(yearResult.status === 'rejected'
          ? getErrorMessage(yearResult.reason, 'Could not load financial years.')
          : yearResult.value.data?.message || 'Could not load financial years.');
      }
      if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
        setBankAccounts(getRecords(accountResult.value.data?.data).filter((account) => account.isActive !== false));
      } else {
        failures.push(accountResult.status === 'rejected'
          ? getErrorMessage(accountResult.reason, 'Could not load payment accounts.')
          : accountResult.value.data?.message || 'Could not load payment accounts.');
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [activeCompanyId, formBranchId, reloadKey]);

  const visibleIncomes = useMemo(() => incomes.filter((income) => {
    const receivedDate = dateInputValue(income.receivedDate);
    const searchable = [
      income.title,
      income.incomeType,
      income.description,
      income.coaAccountId?.name,
      income.coaAccountName,
    ].join(' ').toLowerCase();
    return (!search.trim() || searchable.includes(search.trim().toLowerCase())) &&
      (typeFilter === 'all' || income.incomeType === typeFilter) &&
      (!fromDate || receivedDate >= fromDate) &&
      (!toDate || receivedDate <= toDate);
  }), [incomes, search, typeFilter, fromDate, toDate]);
  const totalIncome = visibleIncomes.reduce((total, income) => total + numberValue(income.amount), 0);
  const averageIncome = visibleIncomes.length ? totalIncome / visibleIncomes.length : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthTotal = incomes
    .filter((income) => dateInputValue(income.receivedDate).startsWith(currentMonth))
    .reduce((total, income) => total + numberValue(income.amount), 0);
  const availableAccounts = bankAccounts.filter((account) => accountTypesForMode[form.paymentMode]?.includes(account.accountType));
  const selectedYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const selectedAccount = availableAccounts.find((account) => getId(account) === form.bankAccountId);

  const openForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)) || financialYears[0];
    setForm({ ...EMPTY_FORM, financialYearId: getId(year), bankAccountId: '' });
    setFormError('');
    setIsFormOpen(true);
  };
  const closeForm = () => {
    if (!isSaving) {
      setIsFormOpen(false);
      setFormError('');
    }
  };
  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setIsLoadingBranches(true);
    setIsLoadingIncomes(true);
    setIsLoadingSetup(true);
    setBranches([]);
    setIncomes([]);
    setBranchId(ALL_BRANCHES);
    setFormBranchId('');
    setFinancialYears([]);
    setBankAccounts([]);
    setIsFormOpen(false);
  };
  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');
    const amount = numberValue(form.amount);
    if (!activeCompanyId || !formBranchId || !selectedYear || !selectedAccount) {
      setFormError('Choose a branch, open financial year and compatible payment account.');
      return;
    }
    if (amount <= 0 || !form.title.trim()) {
      setFormError('Enter an income title and an amount greater than zero.');
      return;
    }
    if (form.receivedDate < dateInputValue(selectedYear.startDate) || form.receivedDate > dateInputValue(selectedYear.endDate)) {
      setFormError('Received date must fall within the selected financial year.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post('/api/expense/income/create', {
        companyId: activeCompanyId,
        branchId: formBranchId,
        financialYearId: form.financialYearId,
        incomeType: form.incomeType,
        title: form.title.trim(),
        amount,
        receivedDate: form.receivedDate,
        paymentMode: form.paymentMode,
        bankAccountId: form.bankAccountId,
        description: form.description.trim(),
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Income was not recorded.');
      }
      showToast('Income recorded and journal posted.', 'success');
      setIsFormOpen(false);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record income.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  const exportCsv = () => {
    setIsExporting(true);
    try {
      const rows = [
        ['Date', 'Income type', 'Title', 'Payment mode', 'Amount', 'Description'],
        ...visibleIncomes.map((income) => [
          dateInputValue(income.receivedDate),
          income.incomeType,
          income.title,
          income.paymentMode,
          numberValue(income.amount),
          income.description || '',
        ]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `income-register-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!isFormOpen) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !isSaving) setIsFormOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFormOpen, isSaving]);

  return (
    <section className="mx-auto max-w-[1480px] space-y-5 pb-8">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-700 p-6 text-white shadow-lg shadow-emerald-950/10 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-emerald-200">FINANCE · REVENUE</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Income</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/80">Record and review income received across your business.</p>
            <p className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              {branchId === ALL_BRANCHES ? 'All branches · consolidated' : (branchNames.get(branchId) || 'Selected branch')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" leftIcon={RefreshCw} onClick={() => { setIsLoadingIncomes(true); setIsLoadingSetup(Boolean(formBranchId)); setReloadKey((value) => value + 1); }} isDisabled={!activeCompanyId} className="border-white/25 bg-white/10 text-white hover:bg-white/15">Refresh</Button>
            <Button leftIcon={Download} onClick={exportCsv} isLoading={isExporting} isDisabled={!visibleIncomes.length} className="bg-white text-emerald-900 hover:bg-emerald-50">Export</Button>
            <Button leftIcon={Plus} onClick={openForm} isDisabled={!activeCompanyId || !formBranchId || !financialYears.length || !bankAccounts.length || isLoadingSetup} className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">Record income</Button>
          </div>
        </div>
      </header>

      <section aria-label="Income summary" className="grid gap-3 sm:grid-cols-3">
        {[
          { title: 'Total income', value: formatCurrency(totalIncome), detail: `${visibleIncomes.length.toLocaleString()} records in current view`, icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
          { title: 'This month', value: formatCurrency(currentMonthTotal), detail: 'Income received this month', icon: CalendarDays, tone: 'bg-blue-50 text-blue-700' },
          { title: 'Average income', value: formatCurrency(averageIncome), detail: 'Per record in current view', icon: Wallet, tone: 'bg-violet-50 text-violet-700' },
        ].map((card) => {
          const Icon = card.icon;
          return <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{card.title}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{card.value}</p></div><span className={`grid h-11 w-11 place-items-center rounded-xl ${card.tone}`}><Icon size={20} aria-hidden="true" /></span></div>
            <p className="mt-3 text-xs text-slate-500">{card.detail}</p>
          </article>;
        })}
      </section>

      <section aria-label="Income filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_170px_160px_160px]">
          <label className="relative"><span className="sr-only">Search income</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${CONTROL_CLASS} h-10 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, type or description..." /></label>
          <select aria-label="Income type" className={`${CONTROL_CLASS} h-10`} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All income types</option><option value="service">Service</option><option value="product">Product</option><option value="project">Project</option><option value="other">Other</option></select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-2"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /><input aria-label="From date" className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-2"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /><input aria-label="To date" className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch filter</span><select className={`${CONTROL_CLASS} h-9 max-w-xs`} value={branchId} onChange={(event) => { setIsLoadingIncomes(true); setBranchId(event.target.value); }} disabled={isLoadingBranches}>{canSelectAllBranches && <option value={ALL_BRANCHES}>All branches</option>}{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName || branch.name}</option>)}</select></label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
          {setupError && <p role="status" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-base font-bold text-slate-900">Income register</h2><p className="mt-1 text-xs text-slate-500">Posted income receipts for the selected branch and filters.</p></div>
          <span className="text-sm font-semibold text-emerald-800">{formatCurrency(totalIncome)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Income</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Payment</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingIncomes ? <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-700" />Loading income…</td></tr>
                : visibleIncomes.length === 0 ? <tr><td colSpan="5" className="px-5 py-14 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No income found</p><p className="mt-1 text-xs text-slate-500">Change the filters or record an income receipt.</p></td></tr>
                  : visibleIncomes.map((income) => <tr key={getId(income)} className="transition-colors hover:bg-emerald-50/30">
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-slate-600">{formatDate(income.receivedDate)}</td>
                    <td className="max-w-[360px] px-4 py-3.5"><p className="truncate font-semibold text-slate-900">{income.title}</p><p className="mt-0.5 truncate text-xs capitalize text-slate-500">{income.incomeType}{income.description ? ` · ${income.description}` : ''}</p></td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{branchNames.get(getId(income.branchId)) || (getId(income.branchId) ? 'Branch' : 'Unassigned')}</td>
                    <td className="px-4 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{income.paymentMode || '—'}</span></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold tabular-nums text-slate-900">{formatCurrency(income.amount)}</td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{visibleIncomes.length} records · Total {formatCurrency(totalIncome)}</span><span>Income receipts are posted to the selected bank/cash account.</span></div>
      </section>

      {isFormOpen && <div className="fixed inset-x-0 bottom-0 top-[64px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close income form" onClick={closeForm} />
        <aside role="dialog" aria-modal="true" aria-labelledby="create-income-title" className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="create-income-title" className="text-base font-bold text-slate-900">Record income</h2><p className="mt-0.5 text-[11px] text-slate-500">The receipt will post to your selected bank or cash account.</p></div><button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close income form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={LABEL_CLASS}>Branch <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={formBranchId} onChange={(event) => { setIsLoadingSetup(true); setSetupError(''); setFormBranchId(event.target.value); setForm((current) => ({ ...current, financialYearId: '', bankAccountId: '' })); }} required disabled={isSaving || isLoadingBranches}><option value="">Select branch</option>{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName || branch.name}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Received date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={form.receivedDate} onChange={(event) => setForm((current) => ({ ...current, receivedDate: event.target.value }))} required disabled={isSaving} /></label>
                <label><span className={LABEL_CLASS}>Financial year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.financialYearId} onChange={(event) => setForm((current) => ({ ...current, financialYearId: event.target.value }))} required disabled={isSaving || isLoadingSetup}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Income type <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.incomeType} onChange={(event) => setForm((current) => ({ ...current, incomeType: event.target.value }))} disabled={isSaving}><option value="service">Service</option><option value="product">Product</option><option value="project">Project</option><option value="other">Other</option></select></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Title <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={200} required disabled={isSaving} placeholder="What was this income for?" /></label>
                <label><span className={LABEL_CLASS}>Amount <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required disabled={isSaving} /></label>
                <label><span className={LABEL_CLASS}>Payment mode <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.paymentMode} onChange={(event) => setForm((current) => ({ ...current, paymentMode: event.target.value, bankAccountId: '' }))} disabled={isSaving}><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online / UPI</option></select></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Deposit to <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.bankAccountId} onChange={(event) => setForm((current) => ({ ...current, bankAccountId: event.target.value }))} required disabled={isSaving || isLoadingSetup}><option value="">Select compatible bank / cash account</option>{availableAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}</select></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Description</span><textarea className={`${CONTROL_CLASS} min-h-20 resize-y`} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1000} disabled={isSaving} /></label>
              </div>
              {setupError && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
              {!isLoadingSetup && formBranchId && financialYears.length === 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Create an open financial year for this branch before recording income.</p>}
              {!isLoadingSetup && formBranchId && availableAccounts.length === 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No payment account is available for this payment mode and branch.</p>}
              {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{selectedAccount?.accountName || 'Choose a deposit account'}</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeForm} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-500/30">Save income</Button></div></div>
          </form>
        </aside>
      </div>}
    </section>
  );
};
