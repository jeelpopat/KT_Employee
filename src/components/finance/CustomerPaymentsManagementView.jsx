import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Plus,
  RotateCw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const PAGE_LIMIT = 20;
const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const PAYMENT_MODES = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer', accountTypes: ['Savings', 'Current'] },
  { value: 'CASH', label: 'Cash', accountTypes: ['Cash', 'Wallet'] },
  { value: 'CHEQUE', label: 'Cheque', accountTypes: ['Savings', 'Current'] },
  { value: 'UPI', label: 'UPI', accountTypes: ['UPI'] },
  { value: 'OTHER', label: 'Other', accountTypes: ['Savings', 'Current', 'Cash', 'Wallet', 'UPI'] },
];

const emptyForm = () => ({
  customerId: '',
  financialYearId: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  mode: 'BANK_TRANSFER',
  bankAccountId: '',
  reference: '',
  notes: '',
  allocations: [{ invoiceId: '', allocatedAmount: '' }],
});

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

const getRecords = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const roundMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};
const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const modeForAccount = (account) => (
  ['Cash', 'Wallet'].includes(account?.accountType)
    ? 'CASH'
    : account?.accountType === 'UPI' ? 'UPI' : 'BANK_TRANSFER'
);

export const CustomerPaymentsManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [openInvoices, setOpenInvoices] = useState([]);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const activeAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeAccess?.role || user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) ||
    user?.companyCreated === true;
  const selectableBranches = branches.filter((branch) => (
    !userBranchId || canSelectAllBranches || getId(branch) === userBranchId
  ));

  useEffect(() => {
    if (preferredCompanyId) return undefined;
    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load companies.');
        const records = getRecords(response.data?.data);
        setCompanies(records);
        if (records.length === 1) setCompanyId(getId(records[0]));
        if (!records.length) setLoadError('No company is available for Customer Payments.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load companies.')); })
      .finally(() => { if (active) setIsLoadingCompanies(false); });
    return () => { active = false; };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!companyId) return undefined;
    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load branches.');
        const records = getRecords(response.data?.data);
        setBranches(records);
        setBranchId((current) => {
          if (current === 'all' && (canSelectAllBranches || !userBranchId)) return current;
          if (records.some((branch) => getId(branch) === current)) return current;
          if (userBranchId && records.some((branch) => getId(branch) === userBranchId)) return userBranchId;
          return getId(records[0]);
        });
        if (!records.length) setLoadError('Create a branch before recording customer payments.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load branches.')); })
      .finally(() => { if (active) setIsLoadingBranches(false); });
    return () => { active = false; };
  }, [companyId, canSelectAllBranches, userBranchId]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    const customerParams = new URLSearchParams({ companyId, isActive: 'true', page: '1', limit: '100' });
    const accountParams = new URLSearchParams({ companyId });
    if (branchId !== 'all') {
      customerParams.set('branchId', branchId);
      accountParams.set('branchId', branchId);
    }
    const requests = [
      api.get(`/api/customer?${customerParams.toString()}`),
      api.get(`/api/bank-account?${accountParams.toString()}`),
      branchId === 'all'
        ? Promise.resolve({ data: { success: true, data: [] } })
        : api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`),
    ];
    Promise.allSettled(requests).then((results) => {
      if (!active) return;
      const failures = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failures.push(getErrorMessage(result.reason, `Could not load setup data (${index + 1}).`));
        } else if (result.value.data?.success === false) {
          failures.push(result.value.data.message || `Could not load setup data (${index + 1}).`);
        }
      });
      const [customerResult, accountResult, yearResult] = results;
      if (customerResult.status === 'fulfilled' && customerResult.value.data?.success !== false) {
        setCustomers(getRecords(customerResult.value.data?.data).filter((customer) => customer.isActive !== false));
      }
      if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
        setPaymentAccounts(getRecords(accountResult.value.data?.data).filter((account) => (
          account.isActive !== false && PAYMENT_MODES.some((mode) => mode.accountTypes.includes(account.accountType))
        )));
      }
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        setFinancialYears(getRecords(yearResult.value.data?.data).filter((year) => year.isLocked !== true));
      } else {
        setFinancialYears([]);
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingPayments(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId, page: String(page), limit: String(PAGE_LIMIT) });
    if (branchId !== 'all') params.set('branchId', branchId);
    if (customerFilter !== 'all') params.set('customerId', customerFilter);
    if (modeFilter !== 'all') params.set('mode', modeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    api.get(`/api/payment?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load customer payments.');
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: PAGE_LIMIT, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (!records.length && page > lastPage) { setPage(lastPage); return; }
        setPayments(records);
        setPagination(pageInfo);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load customer payments.')); })
      .finally(() => { if (active) setIsLoadingPayments(false); });
    return () => { active = false; };
  }, [companyId, branchId, page, customerFilter, modeFilter, statusFilter, fromDate, toDate, reloadKey]);

  const selectedCustomer = customers.find((customer) => getId(customer) === form.customerId);
  const selectedAccount = paymentAccounts.find((account) => getId(account) === form.bankAccountId);
  const selectedYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const availableAccounts = paymentAccounts.filter((account) => (
    PAYMENT_MODES.find((mode) => mode.value === form.mode)?.accountTypes.includes(account.accountType)
  ));
  const totalAmount = roundMoney(form.allocations.reduce(
    (sum, allocation) => sum + roundMoney(allocation.allocatedAmount), 0
  ));
  const visiblePayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? payments.filter((payment) => [
      payment.paymentNumber,
      payment.customerName,
      payment.bankAccountName,
      payment.mode,
    ].some((value) => String(value || '').toLowerCase().includes(query))) : payments;
  }, [payments, search]);
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  useEffect(() => {
    if (!isFormOpen || !selectedCustomer || branchId === 'all') {
      setOpenInvoices([]);
      setIsLoadingInvoices(false);
      return undefined;
    }
    let active = true;
    setIsLoadingInvoices(true);
    setFormError('');
    const params = new URLSearchParams({
      companyId,
      branchId: getId(selectedCustomer.branchId) || branchId,
      customerId: form.customerId,
      status: 'POSTED,PARTIALLY_PAID',
      page: '1',
      limit: '100',
    });
    api.get(`/api/invoice?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load outstanding invoices.');
        const records = getRecords(response.data?.data);
        setOpenInvoices(records.filter((invoice) => (
          ['POSTED', 'PARTIALLY_PAID'].includes(invoice.rawStatus || invoice.status) &&
          Number(invoice.balanceDue) > 0
        )));
      })
      .catch((error) => { if (active) setFormError(getErrorMessage(error, 'Could not load outstanding invoices.')); })
      .finally(() => { if (active) setIsLoadingInvoices(false); });
    return () => { active = false; };
  }, [companyId, branchId, form.customerId, isFormOpen, selectedCustomer]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setCustomers([]);
    setFinancialYears([]);
    setPaymentAccounts([]);
    setPayments([]);
    setPage(1);
    setIsFormOpen(false);
    setLoadError('');
    setSetupError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setFinancialYears([]);
    setPage(1);
    setIsFormOpen(false);
    setLoadError('');
    setSetupError('');
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => (
      today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)
    )) || financialYears[0];
    const initial = emptyForm();
    initial.financialYearId = getId(year);
    initial.bankAccountId = getId(paymentAccounts[0]);
    initial.mode = modeForAccount(paymentAccounts[0]);
    setForm(initial);
    setOpenInvoices([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError('');
  };

  const updateAllocation = (index, key, value) => {
    setForm((previous) => ({
      ...previous,
      allocations: previous.allocations.map((allocation, allocationIndex) => (
        allocationIndex === index ? { ...allocation, [key]: value } : allocation
      )),
    }));
  };

  const openPaymentDetails = async (payment) => {
    setIsLoadingDetails(true);
    setDetailError('');
    setViewingPayment(payment);
    try {
      const response = await api.get(`/api/payment/${encodeURIComponent(getId(payment))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load receipt details.');
      }
      setViewingPayment(response.data.data);
    } catch (error) {
      setDetailError(getErrorMessage(error, 'Could not load receipt details.'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!companyId || !branchId || branchId === 'all') {
      setFormError('Select a specific branch before recording a customer payment.');
      return;
    }
    if (!selectedCustomer || !selectedAccount || !selectedYear) {
      setFormError('Select a customer, open financial year, and receiving account.');
      return;
    }
    if (form.paymentDate < dateInputValue(selectedYear.startDate) ||
      form.paymentDate > dateInputValue(selectedYear.endDate)) {
      setFormError('Payment date must fall within the selected financial year.');
      return;
    }
    const allocations = form.allocations.map((allocation) => ({
      invoiceId: allocation.invoiceId,
      allocatedAmount: roundMoney(allocation.allocatedAmount),
    })).filter((allocation) => allocation.invoiceId && allocation.allocatedAmount > 0);
    if (!allocations.length) {
      setFormError('Allocate the receipt to at least one outstanding invoice.');
      return;
    }
    if (new Set(allocations.map((allocation) => allocation.invoiceId)).size !== allocations.length) {
      setFormError('Each invoice can only be selected once.');
      return;
    }
    const invalidAllocation = allocations.find((allocation) => {
      const invoice = openInvoices.find((item) => getId(item) === allocation.invoiceId);
      return !invoice || allocation.allocatedAmount - Number(invoice.balanceDue) > 0.01;
    });
    if (invalidAllocation) {
      setFormError('An allocation cannot exceed the selected invoice balance due.');
      return;
    }
    const receiptTotal = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0));
    if (receiptTotal <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post('/api/payment/receive', {
        companyId,
        branchId: getId(selectedCustomer.branchId) || branchId,
        financialYearId: form.financialYearId,
        customerId: form.customerId,
        paymentDate: form.paymentDate,
        mode: form.mode,
        bankAccountId: form.bankAccountId,
        totalAmount: receiptTotal,
        allocations,
        reference: form.reference.trim(),
        notes: form.notes.trim(),
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not record customer payment.');
      }
      showToast(`Receipt ${response.data.data.paymentNumber || ''} recorded successfully.`, 'success');
      setIsFormOpen(false);
      setPage(1);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record customer payment.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isFormOpen && !viewingPayment) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        setIsFormOpen(false);
        setViewingPayment(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFormOpen, isSaving, viewingPayment]);

  const refreshPayments = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };
  const firstVisible = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const lastVisible = Math.min(page * pagination.limit, pagination.total);
  const pageTotal = payments.reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0);

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Sales &amp; Receivables</span>
        <span aria-hidden="true">›</span><span className="font-semibold text-slate-800">Customer Payments</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700"><Banknote className="h-7 w-7" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Payments</h1><p className="mt-1 text-sm text-slate-500">Record receipts against outstanding sales invoices.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={RotateCw} onClick={refreshPayments} isDisabled={!companyId}>Refresh</Button>
          <Button leftIcon={Plus} onClick={openCreateForm} className="bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-500/30" isDisabled={!companyId || !branchId || branchId === 'all' || !financialYears.length || !customers.length || !paymentAccounts.length || isLoadingSetup}>
            Record Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { title: 'Total Receipts', value: pagination.total.toLocaleString(), detail: 'For selected filters' },
          { title: 'Page Receipt Total', value: formatCurrency(pageTotal), detail: 'Posted on this page' },
          { title: 'Current Page', value: `${page} / ${pageCount}`, detail: `${pagination.limit} receipts per page` },
        ].map((card) => <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">{card.title}</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{card.value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{card.detail}</p>
        </div>)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(190px,1fr)_160px_150px_150px_155px_155px]">
          <label className="relative"><span className="sr-only">Search receipts</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${CONTROL_CLASS} h-10 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipts..." /></label>
          <select aria-label="Customer filter" className={`${CONTROL_CLASS} h-10`} value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1); }}>
            <option value="all">All Customers</option>{customers.map((customer) => <option key={getId(customer)} value={getId(customer)}>{customer.name || customer.customerName}</option>)}
          </select>
          <select aria-label="Payment mode filter" className={`${CONTROL_CLASS} h-10`} value={modeFilter} onChange={(event) => { setModeFilter(event.target.value); setPage(1); }}>
            <option value="all">All Modes</option>{PAYMENT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </select>
          <select aria-label="Payment status filter" className={`${CONTROL_CLASS} h-10`} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="all">All Statuses</option><option value="POSTED">Posted</option><option value="REVERSED">Reversed</option>
          </select>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-2">
            <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" /><input aria-label="From date" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} />
          </div>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-2">
            <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" /><input aria-label="To date" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}>
            <option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}
          </select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch</span>
            <select className={`${CONTROL_CLASS} h-9 max-w-xs`} value={branchId} onChange={(event) => changeBranch(event.target.value)} disabled={isLoadingBranches}>
              <option value="">Select branch</option>{canSelectAllBranches && <option value="all">All branches</option>}
              {selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}
            </select>
          </label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Receipt No.</th><th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Received In</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Details</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingPayments ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading customer payments…</td></tr>
                : visiblePayments.length === 0 ? <tr><td colSpan="8" className="px-4 py-14 text-center"><Banknote className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No customer payments found</p><p className="mt-1 text-xs text-slate-500">Record a receipt allocated to one or more outstanding invoices.</p></td></tr>
                  : visiblePayments.map((payment) => <tr key={getId(payment)} className="transition-colors hover:bg-cyan-50/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">{formatDate(payment.paymentDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{payment.paymentNumber || '—'}</td>
                    <td className="max-w-[200px] px-4 py-3"><p className="truncate font-medium text-slate-700">{payment.customerName || '—'}</p></td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-600">{payment.bankAccountName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{PAYMENT_MODES.find((mode) => mode.value === payment.mode)?.label || payment.mode}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(payment.totalAmount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${payment.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{payment.status || '—'}</span></td>
                    <td className="px-4 py-3 text-center"><button type="button" aria-label={`View ${payment.paymentNumber} details`} onClick={() => openPaymentDetails(payment)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />View</button></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {firstVisible} to {lastVisible} of {pagination.total.toLocaleString()} receipts{search.trim() ? ` · ${visiblePayments.length} matches on this page` : ''}</span>
          <div className="flex items-center justify-end gap-1">
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => <button type="button" key={pageNumber} className={`min-w-8 rounded-md border px-2 py-1.5 ${page === pageNumber ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
            {pageCount > 5 && <span className="px-1">… {pageCount}</span>}
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {isFormOpen && <div className="fixed inset-x-0 bottom-0 top-[72px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close customer payment form" onClick={closeForm} />
        <aside role="dialog" aria-modal="true" aria-labelledby="create-customer-payment-title" className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><Banknote className="h-4 w-4" /></div><div><h2 id="create-customer-payment-title" className="text-base font-bold text-slate-900">Record Customer Payment</h2><p className="mt-0.5 text-[11px] text-slate-500">Allocate a receipt to open sales invoices</p></div></div>
            <button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close payment form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={LABEL_CLASS}>Customer <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.customerId} onChange={(event) => setForm((previous) => ({ ...previous, customerId: event.target.value, allocations: [{ invoiceId: '', allocatedAmount: '' }] }))} required disabled={isSaving}><option value="">Select customer</option>{customers.map((customer) => <option key={getId(customer)} value={getId(customer)}>{customer.name || customer.customerName}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Financial Year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required disabled={isSaving}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Receipt Date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={form.paymentDate} onChange={(event) => setForm((previous) => ({ ...previous, paymentDate: event.target.value }))} required disabled={isSaving} /></label>
                <label><span className={LABEL_CLASS}>Payment Mode <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.mode} onChange={(event) => setForm((previous) => ({ ...previous, mode: event.target.value, bankAccountId: '' }))} required disabled={isSaving}>{PAYMENT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Received In <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.bankAccountId} onChange={(event) => setForm((previous) => ({ ...previous, bankAccountId: event.target.value }))} required disabled={isSaving}><option value="">Select bank / cash account</option>{availableAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}</select>{selectedAccount && <span className="mt-1 block text-[11px] text-slate-500">Current ledger balance: {formatCurrency(selectedAccount.currentBalance ?? selectedAccount.balance)}</span>}</label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Reference</span><input className={CONTROL_CLASS} value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))} maxLength={200} placeholder="Cheque / transaction reference" disabled={isSaving} /></label>
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5"><div><p className="text-sm font-semibold text-slate-800">Invoice allocation</p><p className="text-[11px] text-slate-500">Receipt total is calculated from invoice allocations.</p></div><button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50" onClick={() => setForm((previous) => ({ ...previous, allocations: [...previous.allocations, { invoiceId: '', allocatedAmount: '' }] }))} disabled={!form.customerId || isLoadingInvoices || !openInvoices.length || isSaving}><Plus className="h-3.5 w-3.5" />Add invoice</button></div>
                {isLoadingInvoices ? <p className="px-3 py-8 text-center text-xs text-slate-500">Loading outstanding invoices…</p>
                  : !form.customerId ? <p className="px-3 py-8 text-center text-xs text-slate-500">Choose a customer to load outstanding invoices.</p>
                    : !openInvoices.length ? <p className="px-3 py-8 text-center text-xs text-slate-500">This customer has no outstanding invoices.</p>
                      : <div className="space-y-3 p-3">
                        {form.allocations.map((allocation, index) => {
                          const invoice = openInvoices.find((item) => getId(item) === allocation.invoiceId);
                          const selectedIds = form.allocations.filter((_, itemIndex) => itemIndex !== index).map((item) => item.invoiceId);
                          return <div key={`payment-allocation-${index}`} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                            <label><span className={LABEL_CLASS}>Invoice</span><select className={CONTROL_CLASS} value={allocation.invoiceId} onChange={(event) => updateAllocation(index, 'invoiceId', event.target.value)} disabled={isSaving}><option value="">Select invoice</option>{openInvoices.filter((item) => !selectedIds.includes(getId(item))).map((item) => <option key={getId(item)} value={getId(item)}>{item.invoiceNumber} · Due {formatCurrency(item.balanceDue)}</option>)}</select>{invoice && <span className="mt-1 block text-[11px] text-slate-500">Balance due: {formatCurrency(invoice.balanceDue)}</span>}</label>
                            <label><span className={LABEL_CLASS}>Allocated Amount</span><input className={CONTROL_CLASS} type="number" min="0.01" max={invoice?.balanceDue} step="0.01" value={allocation.allocatedAmount} onChange={(event) => updateAllocation(index, 'allocatedAmount', event.target.value)} disabled={!invoice || isSaving} /></label>
                            <button type="button" aria-label={`Remove allocation ${index + 1}`} className="mt-5 h-9 rounded-lg border border-slate-200 px-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" disabled={form.allocations.length <= 1 || isSaving} onClick={() => setForm((previous) => ({ ...previous, allocations: previous.allocations.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4" /></button>
                          </div>;
                        })}
                      </div>}
                <div className="flex justify-between border-t border-slate-100 px-3 py-3 text-sm font-bold text-slate-900"><span>Receipt Total</span><span>{formatCurrency(totalAmount)}</span></div>
              </div>
              <label className="block"><span className={LABEL_CLASS}>Notes</span><textarea className={`${CONTROL_CLASS} min-h-20 resize-y`} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} maxLength={5000} disabled={isSaving} /></label>
              {setupError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
              {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
              <div className="flex items-start gap-2 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>Saving creates the receipt journal and updates the allocated invoice balances.</p></div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{isLoadingInvoices ? 'Loading invoices…' : `${formatCurrency(totalAmount)} allocated`}</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeForm} isDisabled={isSaving}>Cancel</Button><Button type="submit" leftIcon={Send} isLoading={isSaving} isDisabled={!paymentAccounts.length || !financialYears.length || !openInvoices.length}>Record Receipt</Button></div></div>
          </form>
        </aside>
      </div>}

      {viewingPayment && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4">
        <button type="button" aria-label="Close receipt details" className="absolute inset-0 cursor-default" onClick={() => setViewingPayment(null)} />
        <section role="dialog" aria-modal="true" aria-labelledby="payment-details-title" className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between"><div><h2 id="payment-details-title" className="text-lg font-bold text-slate-900">Receipt Details</h2><p className="mt-1 text-xs text-slate-500">{viewingPayment.paymentNumber} · {formatDate(viewingPayment.paymentDate)}</p></div><button type="button" aria-label="Close" onClick={() => setViewingPayment(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
          {isLoadingDetails ? <p className="py-8 text-center text-sm text-slate-500">Loading receipt details…</p> : detailError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p> : <div className="mt-5 space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Customer</dt><dd className="mt-1 font-medium text-slate-800">{viewingPayment.customerName || '—'}</dd></div><div><dt className="text-xs text-slate-500">Amount</dt><dd className="mt-1 font-semibold text-slate-900">{formatCurrency(viewingPayment.totalAmount)}</dd></div><div><dt className="text-xs text-slate-500">Payment mode</dt><dd className="mt-1 text-slate-800">{PAYMENT_MODES.find((mode) => mode.value === viewingPayment.mode)?.label || viewingPayment.mode}</dd></div><div><dt className="text-xs text-slate-500">Received in</dt><dd className="mt-1 text-slate-800">{viewingPayment.bankAccountName || '—'}</dd></div><div><dt className="text-xs text-slate-500">Reference</dt><dd className="mt-1 text-slate-800">{viewingPayment.reference || '—'}</dd></div><div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 text-slate-800">{viewingPayment.status || '—'}</dd></div></dl>
            <div className="rounded-lg border border-slate-200"><div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Invoice Allocations</div>{(viewingPayment.allocations || []).map((allocation) => <div key={allocation.invoiceId} className="flex justify-between gap-3 px-3 py-2 text-xs"><span className="truncate text-slate-600">Invoice #{String(allocation.invoiceId).slice(-8).toUpperCase()}</span><span className="font-semibold tabular-nums text-slate-800">{formatCurrency(allocation.allocatedAmount)}</span></div>)}</div>
            {viewingPayment.notes && <p className="text-sm text-slate-600">{viewingPayment.notes}</p>}
          </div>}
          <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setViewingPayment(null)}>Close</Button></div>
        </section>
      </div>}
    </section>
  );
};
