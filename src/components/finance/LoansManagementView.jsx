import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Eye,
  History,
  Landmark,
  Percent,
  Plus,
  RotateCw,
  Search,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_LOAN = {
  financialYearId: '',
  lenderType: 'PERSON',
  lenderName: '',
  lenderPhone: '',
  lenderEmail: '',
  lenderAccountNumber: '',
  lenderIfscCode: '',
  loanReference: '',
  principalAmount: '',
  annualInterestRatePercent: '',
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
const PAGE_LIMIT = 20;
const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
const fieldLabelClass = 'mb-1 block text-xs font-medium text-slate-600';

const getId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  return String(value._id || value.id || value.companyId || '').trim();
};
const getUserCompanyId = (user) => {
  const activeAccess = user?.companyAccess?.find((access) => access?.isActive);
  return getId(user?.companyId) || getId(user?.company?._id || user?.company) || getId(activeAccess?.companyId);
};
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(numberValue(value));
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const LoansManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lenderFilter, setLenderFilter] = useState('all');
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [repaymentForm, setRepaymentForm] = useState(EMPTY_REPAYMENT);
  const [drawerMode, setDrawerMode] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [panelError, setPanelError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const activeAccess = user?.companyAccess?.find((access) => access?.isActive && getId(access.companyId) === companyId);
  const userBranchId = getId(activeAccess?.branchId) || (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeAccess?.role || user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) || user?.companyCreated === true;
  const selectableBranches = branches.filter((branch) => !userBranchId || canSelectAllBranches || getId(branch) === userBranchId);
  const payableBalance = numberValue(selectedLoan?.principalOutstanding);
  const repaymentTotal = roundMoney(numberValue(repaymentForm.principalAmount) + numberValue(repaymentForm.interestAmount));
  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE').length;
  const outstandingTotal = loans.reduce((total, loan) => total + numberValue(loan.principalOutstanding), 0);
  const principalTotal = loans.reduce((total, loan) => total + numberValue(loan.principalAmount), 0);
  const interestTotal = loans.reduce((total, loan) => total + numberValue(loan.totalInterestPaid), 0);
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const firstVisible = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const lastVisible = Math.min(page * pagination.limit, pagination.total);

  useEffect(() => {
    if (preferredCompanyId) return undefined;
    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load companies.');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setCompanies(records);
        if (records.length === 1) setCompanyId(getId(records[0]));
        else if (!records.length) setLoadError('No company is available for Borrowings.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load companies.')); })
      .finally(() => { if (active) setIsLoadingCompanies(false); });
    return () => { active = false; };
  }, [preferredCompanyId, reloadKey]);

  useEffect(() => {
    if (!companyId) return undefined;
    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load branches.');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setBranches(records);
        setBranchId((current) => {
          if (current === 'all' && (canSelectAllBranches || !userBranchId)) return current;
          if (records.some((branch) => getId(branch) === current)) return current;
          if (userBranchId && records.some((branch) => getId(branch) === userBranchId)) return userBranchId;
          return canSelectAllBranches || !userBranchId ? 'all' : getId(records[0]);
        });
        if (!records.length) setLoadError('Create a branch before using Loans.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load branches.')); })
      .finally(() => { if (active) setIsLoadingBranches(false); });
    return () => { active = false; };
  }, [companyId, canSelectAllBranches, userBranchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    const bankParams = new URLSearchParams({ companyId });
    if (branchId !== 'all') bankParams.set('branchId', branchId);
    const yearRequest = branchId === 'all'
      ? Promise.resolve({ data: { success: true, data: [] } })
      : api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`);
    Promise.allSettled([
      api.get(`/api/bank-account?${bankParams.toString()}`),
      yearRequest,
    ]).then(([bankResult, yearResult]) => {
      if (!active) return;
      const failures = [];
      if (bankResult.status === 'fulfilled' && bankResult.value.data?.success !== false) {
        const records = bankResult.value.data?.data;
        setBankAccounts(Array.isArray(records)
          ? records.filter((account) => account.isActive !== false && !['CreditCard'].includes(account.accountType))
          : []);
      } else {
        failures.push(bankResult.status === 'rejected'
          ? getErrorMessage(bankResult.reason, 'Could not load bank and cash accounts.')
          : bankResult.value.data?.message || 'Could not load bank and cash accounts.');
      }
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        const records = Array.isArray(yearResult.value.data?.data) ? yearResult.value.data.data : [];
        setFinancialYears(records.filter((year) => year.isLocked !== true));
      } else {
        failures.push(yearResult.status === 'rejected'
          ? getErrorMessage(yearResult.reason, 'Could not load financial years.')
          : yearResult.value.data?.message || 'Could not load financial years.');
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingLoans(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId, page: String(page), limit: String(PAGE_LIMIT) });
    if (branchId !== 'all') params.set('branchId', branchId);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (lenderFilter !== 'all') params.set('lenderType', lenderFilter);
    if (search.trim()) params.set('search', search.trim());
    api.get(`/api/loan?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load Borrowings.');
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: PAGE_LIMIT, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (!records.length && page > lastPage) { setPage(lastPage); return; }
        setLoans(records);
        setPagination(pageInfo);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load Borrowings.')); })
      .finally(() => { if (active) setIsLoadingLoans(false); });
    return () => { active = false; };
  }, [companyId, branchId, page, statusFilter, lenderFilter, search, reloadKey]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranchId('');
    setBranches([]);
    setBankAccounts([]);
    setFinancialYears([]);
    setLoans([]);
    setPage(1);
    setDrawerMode('');
    setLoadError('');
    setSetupError('');
  };
  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setBankAccounts([]);
    setFinancialYears([]);
    setLoans([]);
    setPage(1);
    setDrawerMode('');
    setLoadError('');
    setSetupError('');
  };
  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerMode('');
    setSelectedLoan(null);
    setLoanDetails(null);
    setPanelError('');
  };
  const refreshLoans = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };
  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= new Date(item.startDate).toISOString().slice(0, 10) && today <= new Date(item.endDate).toISOString().slice(0, 10)) || financialYears[0];
    setLoanForm({ ...EMPTY_LOAN, financialYearId: getId(year) });
    setPanelError('');
    setDrawerMode('create');
  };
  const openRepayment = (loan) => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= new Date(item.startDate).toISOString().slice(0, 10) && today <= new Date(item.endDate).toISOString().slice(0, 10)) || financialYears[0];
    setSelectedLoan(loan);
    setRepaymentForm({ ...EMPTY_REPAYMENT, financialYearId: getId(year) });
    setPanelError('');
    setDrawerMode('repayment');
  };
  const openDetails = async (loan) => {
    setSelectedLoan(loan);
    setLoanDetails(null);
    setPanelError('');
    setIsLoadingDetails(true);
    setDrawerMode('details');
    try {
      const response = await api.get(`/api/loan/${encodeURIComponent(getId(loan))}?companyId=${encodeURIComponent(companyId)}`);
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Could not load loan details.');
      setLoanDetails(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load loan details.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const handleCreate = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!companyId || !branchId || branchId === 'all') {
      setPanelError('Select a specific branch before registering a loan.');
      return;
    }
    if (!loanForm.financialYearId || !loanForm.disbursementBankAccountId) {
      setPanelError('Select a financial year and the company bank/cash account receiving the loan.');
      return;
    }
    const payload = {
      companyId,
      branchId,
      financialYearId: loanForm.financialYearId,
      lenderType: loanForm.lenderType,
      lenderName: loanForm.lenderName.trim(),
      lenderPhone: loanForm.lenderPhone.trim(),
      lenderEmail: loanForm.lenderEmail.trim(),
      lenderBankName: loanForm.lenderType === 'BANK' ? loanForm.lenderName.trim() : '',
      lenderAccountNumber: loanForm.lenderType === 'BANK' ? loanForm.lenderAccountNumber.trim() : '',
      lenderIfscCode: loanForm.lenderType === 'BANK' ? loanForm.lenderIfscCode.trim().toUpperCase() : '',
      loanReference: loanForm.loanReference.trim(),
      principalAmount: numberValue(loanForm.principalAmount),
      annualInterestRatePercent: numberValue(loanForm.annualInterestRatePercent),
      startDate: loanForm.startDate,
      maturityDate: loanForm.maturityDate || null,
      disbursementBankAccountId: loanForm.disbursementBankAccountId,
      notes: loanForm.notes.trim(),
    };
    setIsSaving(true);
    try {
      const response = await api.post('/api/loan', payload);
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Loan was not registered.');
      showToast('Loan registered and disbursement journal posted.', 'success');
      setDrawerMode('');
      setPage(1);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not register this loan.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  const handleRepayment = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!selectedLoan || !repaymentForm.financialYearId || !repaymentForm.bankAccountId) {
      setPanelError('Select a financial year and the bank/cash account used for repayment.');
      return;
    }
    const principalAmount = numberValue(repaymentForm.principalAmount);
    const interestAmount = numberValue(repaymentForm.interestAmount);
    if (principalAmount + interestAmount <= 0) {
      setPanelError('Enter a principal or interest amount greater than zero.');
      return;
    }
    if (principalAmount - numberValue(selectedLoan.principalOutstanding) > 0.01) {
      setPanelError('Principal repayment cannot exceed the outstanding principal.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post(`/api/loan/${encodeURIComponent(getId(selectedLoan))}/repayments`, {
        companyId,
        financialYearId: repaymentForm.financialYearId,
        paymentDate: repaymentForm.paymentDate,
        principalAmount,
        interestAmount,
        bankAccountId: repaymentForm.bankAccountId,
        reference: repaymentForm.reference.trim(),
        notes: repaymentForm.notes.trim(),
      });
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Repayment was not recorded.');
      showToast('Repayment recorded and accounting journal posted.', 'success');
      setDrawerMode('');
      setSelectedLoan(null);
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
        setSelectedLoan(null);
        setLoanDetails(null);
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

  const cards = [
    { title: 'Total Borrowings', value: pagination.total.toLocaleString(), detail: `${activeLoans} active on this page`, icon: Landmark, tone: 'blue' },
    { title: 'Principal Outstanding', value: formatCurrency(outstandingTotal), detail: 'Current page', icon: CircleDollarSign, tone: 'amber' },
    { title: 'Original Principal', value: formatCurrency(principalTotal), detail: 'Current page', icon: Wallet, tone: 'violet' },
    { title: 'Interest Paid', value: formatCurrency(interestTotal), detail: 'Current page', icon: Percent, tone: 'emerald' },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Accounting</span><span aria-hidden="true">›</span><span className="font-semibold text-slate-800">Borrowings</span></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Landmark className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Borrowings</h1><p className="mt-1 text-sm text-slate-500">Track lenders, interest, principal balances, and repayments.</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" leftIcon={RotateCw} onClick={refreshLoans} isDisabled={!companyId}>Refresh</Button><Button onClick={openCreate} leftIcon={Plus} className="bg-indigo-700 hover:bg-indigo-800 focus:ring-indigo-500/30" isDisabled={!companyId || !branchId || branchId === 'all' || !financialYears.length || !bankAccounts.length || isLoadingSetup}>Register Loan</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const tone = { blue: 'bg-sky-100 text-sky-700', amber: 'bg-amber-100 text-amber-700', violet: 'bg-violet-100 text-violet-700', emerald: 'bg-emerald-100 text-emerald-700' }[card.tone];
          return <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div><p className="text-xs font-medium text-slate-500">{card.title}</p><p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{card.value}</p><p className="mt-1 text-[11px] text-slate-400">{card.detail}</p></div>;
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[150px_150px_minmax(220px,1fr)]">
          <select aria-label="Loan status" className={`${controlClass} h-10`} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All Statuses</option><option value="ACTIVE">Active</option><option value="PAID_OFF">Paid off</option></select>
          <select aria-label="Lender type" className={`${controlClass} h-10`} value={lenderFilter} onChange={(event) => { setLenderFilter(event.target.value); setPage(1); }}><option value="all">All Lenders</option><option value="PERSON">Person</option><option value="BANK">Bank</option></select>
          <label className="relative"><span className="sr-only">Search loans</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${controlClass} h-10 pl-9`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search lender or loan reference..." /></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${controlClass} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch</span><select className={`${controlClass} h-9 max-w-xs`} value={branchId} onChange={(event) => changeBranch(event.target.value)} disabled={isLoadingBranches}><option value="">Select branch</option>{canSelectAllBranches && <option value="all">All branches</option>}{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Lender</th><th className="px-4 py-3">Start / Maturity</th><th className="px-4 py-3 text-right">Principal</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Interest rate</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingLoans ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">Loading borrowings…</td></tr>
              : loans.length === 0 ? <tr><td colSpan="7" className="px-4 py-14 text-center"><Landmark className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No borrowings found</p><p className="mt-1 text-xs text-slate-500">Register a borrowing from a person or bank to begin tracking it.</p></td></tr>
                : loans.map((loan) => (
                  <tr key={getId(loan)} className="transition-colors hover:bg-indigo-50/30">
                    <td className="max-w-[240px] px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">{loan.lenderType === 'BANK' ? <Landmark className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{loan.lenderName}</p><p className="truncate text-[11px] text-slate-400">{loan.lenderType === 'BANK' ? `${loan.lenderBankName || 'Bank'} ${loan.lenderAccountNumberMasked || ''}` : 'Person'}{loan.loanReference ? ` · ${loan.loanReference}` : ''}</p></div></div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(loan.startDate)}<p className="mt-0.5 text-[11px] text-slate-400">Maturity {formatDate(loan.maturityDate)}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(loan.principalAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(loan.principalOutstanding)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{numberValue(loan.annualInterestRatePercent)}% <span className="text-[10px] text-slate-400">p.a.</span></td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${loan.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{loan.status === 'ACTIVE' ? 'Active' : 'Paid off'}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" title="View loan and repayment history" aria-label="View loan details" onClick={() => openDetails(loan)}><Eye className="h-4 w-4 text-slate-500" /></Button>{loan.status === 'ACTIVE' && <Button variant="ghost" size="sm" title="Record repayment" aria-label="Record repayment" onClick={() => openRepayment(loan)}><Banknote className="h-4 w-4 text-indigo-700" /></Button>}</div></td>
                  </tr>
                ))}
          </tbody>
        </table></div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Showing {firstVisible} to {lastVisible} of {pagination.total.toLocaleString()} Borrowings</span><div className="flex items-center justify-end gap-1">
          <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => <button type="button" key={pageNumber} className={`min-w-8 rounded-md border px-2 py-1.5 ${page === pageNumber ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
          {pageCount > 5 && <span className="px-1">… {pageCount}</span>}
          <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></button>
        </div></div>
      </div>

      {drawerMode && <div className="fixed inset-x-0 bottom-0 top-[72px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close loan panel" onClick={closeDrawer} />
        <aside role="dialog" aria-modal="true" aria-labelledby="loan-drawer-title" className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">{drawerMode === 'details' ? <History className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</div><div><h2 id="loan-drawer-title" className="text-base font-bold text-slate-900">{drawerMode === 'create' ? 'Register Loan' : drawerMode === 'repayment' ? 'Record Repayment' : 'Loan Details'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{selectedLoan ? `${selectedLoan.lenderName} · ${formatCurrency(selectedLoan.principalOutstanding)} outstanding` : 'New lender and loan information'}</p></div></div><button type="button" onClick={closeDrawer} disabled={isSaving} aria-label="Close loan panel" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-4 w-4" /></button></div>

          {drawerMode === 'create' && <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={fieldLabelClass}>Lender type <span className="text-rose-500">*</span></span><select className={controlClass} value={loanForm.lenderType} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderType: event.target.value, lenderAccountNumber: '', lenderIfscCode: '' }))}><option value="PERSON">Person</option><option value="BANK">Bank / financial institution</option></select></label>
                <label><span className={fieldLabelClass}>{loanForm.lenderType === 'BANK' ? 'Bank / lender name' : 'Lender name'} <span className="text-rose-500">*</span></span><input className={controlClass} value={loanForm.lenderName} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderName: event.target.value }))} maxLength={200} required /></label>
                <label><span className={fieldLabelClass}>Contact phone</span><input className={controlClass} type="tel" value={loanForm.lenderPhone} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderPhone: event.target.value }))} maxLength={30} /></label>
                <label><span className={fieldLabelClass}>Contact email</span><input className={controlClass} type="email" value={loanForm.lenderEmail} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderEmail: event.target.value }))} maxLength={254} /></label>
                {loanForm.lenderType === 'BANK' && <>
                  <label><span className={fieldLabelClass}>Lender account number</span><input className={controlClass} value={loanForm.lenderAccountNumber} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderAccountNumber: event.target.value }))} maxLength={50} autoComplete="off" /></label>
                  <label><span className={fieldLabelClass}>Lender IFSC</span><input className={controlClass} value={loanForm.lenderIfscCode} onChange={(event) => setLoanForm((previous) => ({ ...previous, lenderIfscCode: event.target.value.toUpperCase() }))} maxLength={20} /></label>
                </>}
                <label><span className={fieldLabelClass}>Loan reference</span><input className={controlClass} value={loanForm.loanReference} onChange={(event) => setLoanForm((previous) => ({ ...previous, loanReference: event.target.value }))} maxLength={100} placeholder="Agreement / lender reference" /></label>
                <label><span className={fieldLabelClass}>Principal amount <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0.01" step="0.01" value={loanForm.principalAmount} onChange={(event) => setLoanForm((previous) => ({ ...previous, principalAmount: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Annual interest rate (%) <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0" max="100" step="0.01" value={loanForm.annualInterestRatePercent} onChange={(event) => setLoanForm((previous) => ({ ...previous, annualInterestRatePercent: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Loan start / receipt date <span className="text-rose-500">*</span></span><input className={controlClass} type="date" value={loanForm.startDate} onChange={(event) => setLoanForm((previous) => ({ ...previous, startDate: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Maturity date</span><input className={controlClass} type="date" min={loanForm.startDate} value={loanForm.maturityDate} onChange={(event) => setLoanForm((previous) => ({ ...previous, maturityDate: event.target.value }))} /></label>
                <label><span className={fieldLabelClass}>Financial year <span className="text-rose-500">*</span></span><select className={controlClass} value={loanForm.financialYearId} onChange={(event) => setLoanForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
                <label><span className={fieldLabelClass}>Deposit into bank / cash account <span className="text-rose-500">*</span></span><select className={controlClass} value={loanForm.disbursementBankAccountId} onChange={(event) => setLoanForm((previous) => ({ ...previous, disbursementBankAccountId: event.target.value }))} required><option value="">Select receiving account</option>{bankAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}</select></label>
              </div>
              <label className="block"><span className={fieldLabelClass}>Notes</span><textarea className={`${controlClass} min-h-[80px] resize-y`} maxLength={5000} value={loanForm.notes} onChange={(event) => setLoanForm((previous) => ({ ...previous, notes: event.target.value }))} /></label>
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>Registering the loan records the receipt and posts a journal: debit the selected bank/cash account and credit a loan liability ledger.</p></div>
              {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">Lender bank account number is masked in views.</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-indigo-700 hover:bg-indigo-800 focus:ring-indigo-500/30">Register Loan</Button></div></div>
          </form>}

          {drawerMode === 'repayment' && <form onSubmit={handleRepayment} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-indigo-50 p-3 text-xs"><div><p className="text-indigo-800">Principal outstanding</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(selectedLoan?.principalOutstanding)}</p></div><div><p className="text-indigo-800">Annual interest rate</p><p className="mt-1 font-bold text-slate-900">{numberValue(selectedLoan?.annualInterestRatePercent)}% p.a.</p></div></div>
              <label className="block"><span className={fieldLabelClass}>Payment date <span className="text-rose-500">*</span></span><input className={controlClass} type="date" value={repaymentForm.paymentDate} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, paymentDate: event.target.value }))} required /></label>
              <label className="block"><span className={fieldLabelClass}>Financial year <span className="text-rose-500">*</span></span><select className={controlClass} value={repaymentForm.financialYearId} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
              <label className="block"><span className={fieldLabelClass}>Pay from bank / cash account <span className="text-rose-500">*</span></span><select className={controlClass} value={repaymentForm.bankAccountId} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, bankAccountId: event.target.value }))} required><option value="">Select paying account</option>{bankAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · Available {formatCurrency(account.currentBalance)}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={fieldLabelClass}>Principal paid</span><input className={controlClass} type="number" min="0" max={payableBalance} step="0.01" value={repaymentForm.principalAmount} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, principalAmount: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Interest paid</span><input className={controlClass} type="number" min="0" step="0.01" value={repaymentForm.interestAmount} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, interestAmount: event.target.value }))} required /></label>
              </div>
              <div className="flex justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm"><span className="font-medium text-slate-600">Total payment</span><span className="font-bold tabular-nums text-slate-900">{formatCurrency(repaymentTotal)}</span></div>
              <label className="block"><span className={fieldLabelClass}>Payment reference</span><input className={controlClass} value={repaymentForm.reference} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, reference: event.target.value }))} maxLength={200} placeholder="Bank transaction / cheque reference" /></label>
              <label className="block"><span className={fieldLabelClass}>Notes</span><textarea className={`${controlClass} min-h-[72px] resize-y`} maxLength={2000} value={repaymentForm.notes} onChange={(event) => setRepaymentForm((previous) => ({ ...previous, notes: event.target.value }))} /></label>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>Enter the principal and interest split from the lender's statement. The saved annual rate is informational; interest is not auto-accrued. The account balance is checked before posting.</p></div>
              {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-indigo-700 hover:bg-indigo-800 focus:ring-indigo-500/30">Record Repayment</Button></div>
          </form>}

          {drawerMode === 'details' && <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoadingDetails ? <p className="py-12 text-center text-sm text-slate-500">Loading loan details…</p> : loanDetails ? <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[['Lender type', loanDetails.lenderType === 'BANK' ? 'Bank' : 'Person'], ['Lender', loanDetails.lenderName], ['Bank', loanDetails.lenderBankName || '—'], ['Account', loanDetails.lenderAccountNumberMasked || '—'], ['IFSC', loanDetails.lenderIfscCode || '—'], ['Contact', loanDetails.lenderPhone || loanDetails.lenderEmail || '—'], ['Loan reference', loanDetails.loanReference || '—'], ['Annual interest', `${numberValue(loanDetails.annualInterestRatePercent)}% p.a.`], ['Start date', formatDate(loanDetails.startDate)], ['Maturity date', formatDate(loanDetails.maturityDate)], ['Original principal', formatCurrency(loanDetails.principalAmount)], ['Outstanding principal', formatCurrency(loanDetails.principalOutstanding)], ['Principal repaid', formatCurrency(loanDetails.totalPrincipalRepaid)], ['Interest paid', formatCurrency(loanDetails.totalInterestPaid)], ['Status', loanDetails.status === 'ACTIVE' ? 'Active' : 'Paid off'], ['Received into', loanDetails.disbursementAccountName || '—']].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>)}
              </div>
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><div><p className="text-sm font-semibold text-slate-800">Repayment history</p><p className="text-[11px] text-slate-500">{loanDetails.repayments?.length || 0} posted payments</p></div><History className="h-4 w-4 text-slate-400" /></div>
                {(loanDetails.repayments || []).length === 0 ? <p className="px-3 py-6 text-center text-xs text-slate-500">No repayments recorded yet.</p> : <div className="divide-y divide-slate-100">
                  {[...loanDetails.repayments].reverse().map((repayment) => <div key={repayment.id} className="flex items-start justify-between gap-3 px-3 py-3"><div><p className="text-xs font-semibold text-slate-800">{formatDate(repayment.paymentDate)} · {repayment.bankAccountName || 'Bank / cash'}</p><p className="mt-1 text-[11px] text-slate-500">Principal {formatCurrency(repayment.principalAmount)} · Interest {formatCurrency(repayment.interestAmount)}{repayment.reference ? ` · ${repayment.reference}` : ''}</p></div><p className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-900">{formatCurrency(repayment.totalAmount)}</p></div>)}
                </div>}
              </div>
              {loanDetails.notes && <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-medium text-slate-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{loanDetails.notes}</p></div>}
              {panelError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{panelError}</p>}
            </div> : <p className="py-12 text-center text-sm text-slate-500">{panelError || 'Loan details are unavailable.'}</p>}
          </div>}

          {drawerMode === 'details' && <div className="flex justify-end border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer}>Close</Button></div>}
        </aside>
      </div>}
    </section>
  );
};
