import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CircleAlert,
  CircleDollarSign,
  Eye,
  History,
  Landmark,
  LoaderCircle,
  Percent,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const ALL_BRANCHES = 'all';
const PAGE_LIMIT = 20;
const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-cyan-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const EMPTY_LOAN = {
  financialYearId: '',
  customerId: '',
  loanReference: '',
  principalAmount: '',
  annualInterestRatePercent: '0',
  startDate: new Date().toISOString().slice(0, 10),
  maturityDate: '',
  disbursementBankAccountId: '',
  notes: '',
};
const EMPTY_REPAYMENT = {
  financialYearId: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  principalAmount: '',
  interestAmount: '0',
  bankAccountId: '',
  reference: '',
  notes: '',
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

export const LendingManagementView = () => {
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
  const [formBranchId, setFormBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lendings, setLendings] = useState([]);
  const [summary, setSummary] = useState({ principalAmount: 0, principalOutstanding: 0, interestReceived: 0, activeLoans: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [repaymentForm, setRepaymentForm] = useState(EMPTY_REPAYMENT);
  const [drawerMode, setDrawerMode] = useState('');
  const [selectedLending, setSelectedLending] = useState(null);
  const [lendingDetails, setLendingDetails] = useState(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingLendings, setIsLoadingLendings] = useState(Boolean(preferredCompanyId));
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [panelError, setPanelError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const activeCompanyId = preferredCompanyId || companyId;
  const selectableBranches = branches.filter((branch) => (
    !userBranchId || canSelectAllBranches || getId(branch) === userBranchId
  ));
  const branchNames = useMemo(() => new Map(
    branches.map((branch) => [getId(branch), branch.branchName || branch.name || 'Branch']),
  ), [branches]);
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const firstVisible = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const lastVisible = Math.min(page * pagination.limit, pagination.total);
  const repaymentTotal = Math.round((numberValue(repaymentForm.principalAmount) + numberValue(repaymentForm.interestAmount) + Number.EPSILON) * 100) / 100;
  const selectedYear = financialYears.find((year) => getId(year) === loanForm.financialYearId);
  const selectedAccount = bankAccounts.find((account) => getId(account) === loanForm.disbursementBankAccountId);

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
          setIsLoadingLendings(true);
        }
        if (!records.length) setLoadError('No company is available for Lending.');
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
    if (!activeCompanyId || !formBranchId) return undefined;
    let active = true;
    const params = new URLSearchParams({
      companyId: activeCompanyId,
      branchId: formBranchId,
      page: '1',
      limit: '100',
      isActive: 'true',
    });
    Promise.allSettled([
      api.get(`/api/financial-year?branchId=${encodeURIComponent(formBranchId)}`),
      api.get(`/api/bank-account?companyId=${encodeURIComponent(activeCompanyId)}&branchId=${encodeURIComponent(formBranchId)}`),
      api.get(`/api/customer?${params.toString()}`),
    ]).then(([yearResult, accountResult, customerResult]) => {
      if (!active) return;
      const failures = [];
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        setFinancialYears(getRecords(yearResult.value.data?.data).filter((year) => year.isLocked !== true));
      } else {
        failures.push(yearResult.status === 'rejected' ? getErrorMessage(yearResult.reason, 'Could not load financial years.') : yearResult.value.data?.message || 'Could not load financial years.');
      }
      if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
        setBankAccounts(getRecords(accountResult.value.data?.data).filter((account) => account.isActive !== false && account.accountType !== 'CreditCard'));
      } else {
        failures.push(accountResult.status === 'rejected' ? getErrorMessage(accountResult.reason, 'Could not load payment accounts.') : accountResult.value.data?.message || 'Could not load payment accounts.');
      }
      if (customerResult.status === 'fulfilled' && customerResult.value.data?.success !== false) {
        setCustomers(getRecords(customerResult.value.data?.data).filter((customer) => customer.isActive !== false));
      } else {
        failures.push(customerResult.status === 'rejected' ? getErrorMessage(customerResult.reason, 'Could not load customers.') : customerResult.value.data?.message || 'Could not load customers.');
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [activeCompanyId, formBranchId, reloadKey]);

  useEffect(() => {
    if (!activeCompanyId) return undefined;
    let active = true;
    const params = new URLSearchParams({
      companyId: activeCompanyId,
      page: String(page),
      limit: String(PAGE_LIMIT),
    });
    params.set('branchId', branchId);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    api.get(`/api/lending?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load lending records.');
        const data = response.data?.data || {};
        const pageInfo = data.pagination || { page, limit: PAGE_LIMIT, total: 0 };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setLendings(Array.isArray(data.items) ? data.items : []);
        setPagination(pageInfo);
        setSummary(data.summary || { principalAmount: 0, principalOutstanding: 0, interestReceived: 0, activeLoans: 0 });
        setLoadError('');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load lending records.')); })
      .finally(() => { if (active) setIsLoadingLendings(false); });
    return () => { active = false; };
  }, [activeCompanyId, branchId, page, search, statusFilter, reloadKey]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setIsLoadingBranches(true);
    setIsLoadingSetup(true);
    setIsLoadingLendings(true);
    setBranches([]);
    setLendings([]);
    setBranchId(ALL_BRANCHES);
    setFormBranchId('');
    setPage(1);
    setDrawerMode('');
    setLoadError('');
    setSetupError('');
  };
  const changeBranch = (nextBranchId) => {
    setIsLoadingLendings(true);
    setBranchId(nextBranchId);
    setPage(1);
    setLoadError('');
  };
  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerMode('');
    setSelectedLending(null);
    setLendingDetails(null);
    setPanelError('');
  };
  const openCreate = () => {
    const branchForForm = branchId !== ALL_BRANCHES ? branchId : (selectableBranches[0] ? getId(selectableBranches[0]) : '');
    if (branchForForm !== formBranchId) setIsLoadingSetup(true);
    setFormBranchId(branchForForm);
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)) || financialYears[0];
    setLoanForm({ ...EMPTY_LOAN, financialYearId: getId(year) });
    setSelectedLending(null);
    setPanelError('');
    setDrawerMode('create');
  };
  const openRepayment = (lending) => {
    setSelectedLending(lending);
    if (getId(lending.branchId) !== formBranchId) setIsLoadingSetup(true);
    setFormBranchId(getId(lending.branchId));
    setLendingDetails(null);
    setRepaymentForm(EMPTY_REPAYMENT);
    setPanelError('');
    setDrawerMode('repayment');
  };
  const openDetails = async (lending) => {
    setSelectedLending(lending);
    setFormBranchId(getId(lending.branchId));
    setLendingDetails(null);
    setPanelError('');
    setIsLoadingDetails(true);
    setDrawerMode('details');
    try {
      const response = await api.get(`/api/lending/${encodeURIComponent(getId(lending))}?companyId=${encodeURIComponent(activeCompanyId)}`);
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Could not load lending details.');
      setLendingDetails(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load lending details.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const handleCreate = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!activeCompanyId || !formBranchId || !loanForm.financialYearId || !loanForm.customerId || !loanForm.disbursementBankAccountId) {
      setPanelError('Choose a branch, customer, open financial year and bank/cash account.');
      return;
    }
    if (numberValue(loanForm.principalAmount) <= 0) {
      setPanelError('Principal amount must be greater than zero.');
      return;
    }
    if (loanForm.maturityDate && loanForm.maturityDate <= loanForm.startDate) {
      setPanelError('Maturity date must be after the lending start date.');
      return;
    }
    if (selectedYear && (loanForm.startDate < dateInputValue(selectedYear.startDate) || loanForm.startDate > dateInputValue(selectedYear.endDate))) {
      setPanelError('Lending start date must fall within the selected financial year.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post('/api/lending', {
        companyId: activeCompanyId,
        branchId: formBranchId,
        financialYearId: loanForm.financialYearId,
        customerId: loanForm.customerId,
        loanReference: loanForm.loanReference.trim(),
        principalAmount: numberValue(loanForm.principalAmount),
        annualInterestRatePercent: numberValue(loanForm.annualInterestRatePercent),
        startDate: loanForm.startDate,
        maturityDate: loanForm.maturityDate || null,
        disbursementBankAccountId: loanForm.disbursementBankAccountId,
        notes: loanForm.notes.trim(),
      });
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Lending record was not saved.');
      showToast('Loan disbursed and accounting journal posted.', 'success');
      setDrawerMode('');
      setPage(1);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create lending record.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  const handleRepayment = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!selectedLending || !repaymentForm.financialYearId || !repaymentForm.bankAccountId) {
      setPanelError('Choose a financial year and the bank/cash account receiving payment.');
      return;
    }
    if (numberValue(repaymentForm.principalAmount) + numberValue(repaymentForm.interestAmount) <= 0) {
      setPanelError('Enter a principal or interest amount greater than zero.');
      return;
    }
    if (numberValue(repaymentForm.principalAmount) - numberValue(selectedLending.principalOutstanding) > 0.01) {
      setPanelError('Principal repayment cannot exceed the outstanding principal.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post(`/api/lending/${encodeURIComponent(getId(selectedLending))}/repayments`, {
        companyId: activeCompanyId,
        financialYearId: repaymentForm.financialYearId,
        paymentDate: repaymentForm.paymentDate,
        principalAmount: numberValue(repaymentForm.principalAmount),
        interestAmount: numberValue(repaymentForm.interestAmount),
        bankAccountId: repaymentForm.bankAccountId,
        reference: repaymentForm.reference.trim(),
        notes: repaymentForm.notes.trim(),
      });
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Repayment was not recorded.');
      showToast('Repayment received and accounting journal posted.', 'success');
      setDrawerMode('');
      setSelectedLending(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record this repayment.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!drawerMode) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        setDrawerMode('');
        setSelectedLending(null);
        setLendingDetails(null);
        setPanelError('');
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerMode, isSaving]);

  return (
    <section className="mx-auto max-w-[1480px] space-y-5 pb-8 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-cyan-100">FINANCE · LENDING</p>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">Lending</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-cyan-50/90 sm:text-sm">Manage loans given to customers, track repayments and monitor outstanding principal.</p>
            <p className="mt-3 inline-flex rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">{branchId === ALL_BRANCHES ? 'All branches · consolidated' : (branchNames.get(branchId) || 'Selected branch')}</p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2">
            <Button variant="outline" leftIcon={RefreshCw} onClick={() => { setIsLoadingLendings(true); setIsLoadingSetup(Boolean(formBranchId)); setReloadKey((value) => value + 1); }} isDisabled={!activeCompanyId} className="border-white/25 bg-white/15 text-white hover:bg-white/20">Refresh</Button>
            <Button leftIcon={Plus} onClick={openCreate} isDisabled={!activeCompanyId || !selectableBranches.length || isLoadingSetup} className="bg-white text-[#034665] shadow-md hover:bg-cyan-50">Give a loan</Button>
          </div>
        </div>
      </header>

      <section aria-label="Lending summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Total lending', value: formatCurrency(summary.principalAmount), detail: `${pagination.total.toLocaleString()} customer loans`, icon: Landmark, tone: 'bg-blue-50 text-blue-700' },
          { title: 'Principal outstanding', value: formatCurrency(summary.principalOutstanding), detail: 'Customer principal to be recovered', icon: CircleDollarSign, tone: 'bg-amber-50 text-amber-700' },
          { title: 'Active loans', value: numberValue(summary.activeLoans).toLocaleString(), detail: 'Currently open lending records', icon: UserRound, tone: 'bg-cyan-50 text-[#034665]' },
          { title: 'Interest received', value: formatCurrency(summary.interestReceived), detail: 'Recorded interest income', icon: Percent, tone: 'bg-emerald-50 text-emerald-700' },
        ].map((card) => {
          const Icon = card.icon;
          return <article key={card.title} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{card.title}</p><p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{card.value}</p></div><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${card.tone}`}><Icon size={20} aria-hidden="true" /></span></div><p className="mt-3 text-xs text-slate-500">{card.detail}</p></article>;
        })}
      </section>

      <section aria-label="Lending filters" className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="grid gap-2 lg:grid-cols-[170px_minmax(220px,1fr)]">
          <select aria-label="Lending status" className={`${CONTROL_CLASS} h-10`} value={statusFilter} onChange={(event) => { setIsLoadingLendings(true); setStatusFilter(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="ACTIVE">Active</option><option value="PAID_OFF">Paid off</option></select>
          <label className="relative"><span className="sr-only">Search lending records</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${CONTROL_CLASS} h-10 pl-9`} value={search} onChange={(event) => { setIsLoadingLendings(true); setSearch(event.target.value); setPage(1); }} placeholder="Search customer or loan reference..." /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch</span><select className={`${CONTROL_CLASS} h-9 max-w-xs`} value={branchId} onChange={(event) => changeBranch(event.target.value)} disabled={isLoadingBranches}>{canSelectAllBranches && <option value={ALL_BRANCHES}>All branches</option>}{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName || branch.name}</option>)}</select></label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="status" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-bold text-slate-900">Customer lending register</h2><p className="mt-1 text-xs text-slate-500">Loan balances, terms and repayment activity.</p></div><span className="text-xs font-medium text-slate-500">{pagination.total.toLocaleString()} records</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Customer</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Start / maturity</th><th className="px-4 py-3 text-right">Principal</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingLendings ? <tr><td colSpan="7" className="px-5 py-14 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-[#068DCB]" />Loading lending records…</td></tr>
                : lendings.length === 0 ? <tr><td colSpan="7" className="px-5 py-14 text-center"><Landmark className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No lending records found</p><p className="mt-1 text-xs text-slate-500">Create a customer loan to begin tracking disbursements and repayments.</p></td></tr>
                  : lendings.map((lending) => <tr key={getId(lending)} className="transition-colors hover:bg-cyan-50/50">
                    <td className="max-w-[240px] px-5 py-3.5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf4f8] text-[#034665]"><UserRound className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{lending.customerName}</p><p className="truncate text-[11px] text-slate-500">{lending.customerPhone || 'Customer'}{lending.loanReference ? ` · ${lending.loanReference}` : ''}</p></div></div></td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{branchNames.get(getId(lending.branchId)) || 'Branch'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">{formatDate(lending.startDate)}<p className="mt-0.5 text-[11px] text-slate-400">Maturity {formatDate(lending.maturityDate)}</p></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-700">{formatCurrency(lending.principalAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(lending.principalOutstanding)}</td>
                    <td className="px-4 py-3.5 text-center"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${lending.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{lending.status === 'ACTIVE' ? 'Active' : 'Paid off'}</span></td>
                    <td className="px-5 py-3.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" title="View lending details" aria-label="View lending details" onClick={() => openDetails(lending)}><Eye className="h-4 w-4 text-slate-500" /></Button>{lending.status === 'ACTIVE' && <Button variant="ghost" size="sm" title="Record repayment" aria-label="Record repayment" onClick={() => openRepayment(lending)}><Banknote className="h-4 w-4 text-[#045d86]" /></Button>}</div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>Showing {firstVisible} to {lastVisible} of {pagination.total.toLocaleString()}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => { setIsLoadingLendings(true); setPage((value) => Math.max(1, value - 1)); }} isDisabled={page <= 1}>Previous</Button><span>Page {page} of {pageCount}</span><Button variant="outline" size="sm" onClick={() => { setIsLoadingLendings(true); setPage((value) => Math.min(pageCount, value + 1)); }} isDisabled={page >= pageCount}>Next</Button></div></div>
      </section>

      {drawerMode && <div className="fixed inset-x-0 bottom-0 top-[64px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close lending panel" onClick={closeDrawer} />
        <aside role="dialog" aria-modal="true" aria-labelledby="lending-drawer-title" className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf4f8] text-[#034665]">{drawerMode === 'details' ? <History className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</span><div><h2 id="lending-drawer-title" className="text-base font-bold text-slate-900">{drawerMode === 'create' ? 'Give a customer loan' : drawerMode === 'repayment' ? 'Record repayment' : 'Lending details'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{selectedLending ? `${selectedLending.customerName} · ${formatCurrency(selectedLending.principalOutstanding)} outstanding` : 'New customer lending record'}</p></div></div><button type="button" onClick={closeDrawer} disabled={isSaving} aria-label="Close lending panel" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button></div>

          {drawerMode === 'create' && <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={LABEL_CLASS}>Branch <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={formBranchId} onChange={(event) => { setFormBranchId(event.target.value); setLoanForm((current) => ({ ...current, customerId: '', financialYearId: '', disbursementBankAccountId: '' })); }} required><option value="">Select branch</option>{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName || branch.name}</option>)}</select></label>
              <label><span className={LABEL_CLASS}>Customer <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={loanForm.customerId} onChange={(event) => setLoanForm((current) => ({ ...current, customerId: event.target.value }))} required disabled={isLoadingSetup}><option value="">Select customer</option>{customers.map((customer) => <option key={getId(customer)} value={getId(customer)}>{customer.name || customer.customerName}</option>)}</select></label>
              <label><span className={LABEL_CLASS}>Principal amount <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="number" min="0.01" step="0.01" value={loanForm.principalAmount} onChange={(event) => setLoanForm((current) => ({ ...current, principalAmount: event.target.value }))} required /></label>
              <label><span className={LABEL_CLASS}>Annual interest rate (%) <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="number" min="0" max="100" step="0.01" value={loanForm.annualInterestRatePercent} onChange={(event) => setLoanForm((current) => ({ ...current, annualInterestRatePercent: event.target.value }))} required /></label>
              <label><span className={LABEL_CLASS}>Start date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={loanForm.startDate} onChange={(event) => setLoanForm((current) => ({ ...current, startDate: event.target.value }))} required /></label>
              <label><span className={LABEL_CLASS}>Maturity date</span><input className={CONTROL_CLASS} type="date" min={loanForm.startDate} value={loanForm.maturityDate} onChange={(event) => setLoanForm((current) => ({ ...current, maturityDate: event.target.value }))} /></label>
              <label><span className={LABEL_CLASS}>Financial year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={loanForm.financialYearId} onChange={(event) => setLoanForm((current) => ({ ...current, financialYearId: event.target.value }))} required disabled={isLoadingSetup}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
              <label><span className={LABEL_CLASS}>Disburse from <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={loanForm.disbursementBankAccountId} onChange={(event) => setLoanForm((current) => ({ ...current, disbursementBankAccountId: event.target.value }))} required disabled={isLoadingSetup}><option value="">Select bank / cash account</option>{bankAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}</select></label>
              <label className="sm:col-span-2"><span className={LABEL_CLASS}>Loan reference</span><input className={CONTROL_CLASS} value={loanForm.loanReference} onChange={(event) => setLoanForm((current) => ({ ...current, loanReference: event.target.value }))} maxLength={100} /></label>
              <label className="sm:col-span-2"><span className={LABEL_CLASS}>Notes</span><textarea className={`${CONTROL_CLASS} min-h-20 resize-y`} value={loanForm.notes} onChange={(event) => setLoanForm((current) => ({ ...current, notes: event.target.value }))} maxLength={5000} /></label>
            </div>
            {setupError && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
            {!isLoadingSetup && formBranchId && customers.length === 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Add an active customer for this branch before creating a lending record.</p>}
            {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
            <p className="rounded-lg bg-[#edf4f8] px-3 py-2 text-xs text-[#034665]">Disbursement is posted as a debit to loan receivable and a credit to the selected bank/cash account.</p>
          </div><div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{selectedAccount?.accountName || 'Select a disbursement account'}</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-[#045d86] hover:bg-[#034665] focus:ring-cyan-500/30">Save loan</Button></div></div></form>}

          {drawerMode === 'repayment' && <form onSubmit={handleRepayment} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#edf4f8] p-3 text-xs"><div><p className="text-[#034665]">Principal outstanding</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(selectedLending?.principalOutstanding)}</p></div><div><p className="text-[#034665]">Interest rate</p><p className="mt-1 font-bold text-slate-900">{numberValue(selectedLending?.annualInterestRatePercent)}% p.a.</p></div></div>
            <label className="block"><span className={LABEL_CLASS}>Payment date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={repaymentForm.paymentDate} onChange={(event) => setRepaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} required /></label>
            <label className="block"><span className={LABEL_CLASS}>Financial year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={repaymentForm.financialYearId} onChange={(event) => setRepaymentForm((current) => ({ ...current, financialYearId: event.target.value }))} required disabled={isLoadingSetup}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
            <label className="block"><span className={LABEL_CLASS}>Deposit to <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={repaymentForm.bankAccountId} onChange={(event) => setRepaymentForm((current) => ({ ...current, bankAccountId: event.target.value }))} required disabled={isLoadingSetup}><option value="">Select receiving account</option>{bankAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label><span className={LABEL_CLASS}>Principal received</span><input className={CONTROL_CLASS} type="number" min="0" max={numberValue(selectedLending?.principalOutstanding)} step="0.01" value={repaymentForm.principalAmount} onChange={(event) => setRepaymentForm((current) => ({ ...current, principalAmount: event.target.value }))} required /></label><label><span className={LABEL_CLASS}>Interest received</span><input className={CONTROL_CLASS} type="number" min="0" step="0.01" value={repaymentForm.interestAmount} onChange={(event) => setRepaymentForm((current) => ({ ...current, interestAmount: event.target.value }))} required /></label></div>
            <div className="flex justify-between rounded-lg border border-cyan-100 bg-cyan-50/50 px-3 py-2 text-sm"><span className="font-medium text-slate-600">Total received</span><span className="font-bold tabular-nums text-slate-900">{formatCurrency(repaymentTotal)}</span></div>
            <label className="block"><span className={LABEL_CLASS}>Reference</span><input className={CONTROL_CLASS} value={repaymentForm.reference} onChange={(event) => setRepaymentForm((current) => ({ ...current, reference: event.target.value }))} maxLength={200} /></label>
            <label className="block"><span className={LABEL_CLASS}>Notes</span><textarea className={`${CONTROL_CLASS} min-h-16 resize-y`} value={repaymentForm.notes} onChange={(event) => setRepaymentForm((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} /></label>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Record the principal and interest split from the customer's payment. The annual interest rate is informational; interest is not auto-accrued.</p>
            {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
          </div><div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-[#045d86] hover:bg-[#034665] focus:ring-cyan-500/30">Record repayment</Button></div></form>}

          {drawerMode === 'details' && <><div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoadingDetails ? <p className="py-12 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading lending details…</p>
              : lendingDetails ? <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">{[
                  ['Customer', lendingDetails.customerName],
                  ['Contact', lendingDetails.customerPhone || '—'],
                  ['Reference', lendingDetails.loanReference || '—'],
                  ['Branch', branchNames.get(getId(lendingDetails.branchId)) || 'Branch'],
                  ['Start date', formatDate(lendingDetails.startDate)],
                  ['Maturity date', formatDate(lendingDetails.maturityDate)],
                  ['Interest rate', `${numberValue(lendingDetails.annualInterestRatePercent)}% p.a.`],
                  ['Disbursed from', lendingDetails.disbursementAccountName || '—'],
                  ['Original principal', formatCurrency(lendingDetails.principalAmount)],
                  ['Outstanding principal', formatCurrency(lendingDetails.principalOutstanding)],
                  ['Principal repaid', formatCurrency(lendingDetails.totalPrincipalRepaid)],
                  ['Interest received', formatCurrency(lendingDetails.totalInterestReceived)],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>)}</div>
                <section className="rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><div><p className="text-sm font-semibold text-slate-800">Repayment history</p><p className="text-[11px] text-slate-500">{lendingDetails.repayments?.length || 0} posted payments</p></div><History className="h-4 w-4 text-slate-400" /></div>
                  {(lendingDetails.repayments || []).length === 0 ? <p className="px-3 py-6 text-center text-xs text-slate-500">No repayments recorded yet.</p> : <div className="divide-y divide-slate-100">{[...lendingDetails.repayments].reverse().map((repayment) => <div key={repayment.id} className="flex items-start justify-between gap-3 px-3 py-3"><div><p className="text-xs font-semibold text-slate-800">{formatDate(repayment.paymentDate)} · {repayment.bankAccountName || 'Bank / cash'}</p><p className="mt-1 text-[11px] text-slate-500">Principal {formatCurrency(repayment.principalAmount)} · Interest {formatCurrency(repayment.interestAmount)}{repayment.reference ? ` · ${repayment.reference}` : ''}</p></div><p className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-900">{formatCurrency(repayment.totalAmount)}</p></div>)}</div>}
                </section>
                {lendingDetails.notes && <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-medium text-slate-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lendingDetails.notes}</p></div>}
              </div> : <p className="py-12 text-center text-sm text-slate-500">{panelError || 'Lending details are unavailable.'}</p>}
            {panelError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{panelError}</p>}
          </div><div className="flex justify-end border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer}>Close</Button></div></>}
        </aside>
      </div>}
    </section>
  );
};
