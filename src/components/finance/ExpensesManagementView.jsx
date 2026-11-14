import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleAlert,
  Coins,
  Download,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useConfirm } from '../common/ConfirmDialog.jsx';
import { useApp } from '../../context/AppContext.jsx';

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const EMPTY_FORM = {
  financialYearId: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  category: '',
  description: '',
  amount: '',
  taxRateId: '',
  vendorId: '',
  bankAccountId: '',
  expenseAccountId: '',
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
  return getId(user?.companyId) ||
    getId(user?.company?._id || user?.company) ||
    getId(activeAccess?.companyId);
};

const getRecords = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);
const roundMoney = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const formatLedgerBalance = (value) => {
  const balance = Number(value) || 0;
  return `${formatCurrency(Math.abs(balance))} ${balance < 0 ? 'CR' : 'DR'}`;
};
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
const paymentModeFor = (account) => {
  if (['Cash', 'Wallet'].includes(account?.accountType)) return 'CASH';
  if (['Savings', 'Current'].includes(account?.accountType)) return 'BANK';
  return 'OTHER';
};

export const ExpensesManagementView = () => {
  const { user } = useApp();
  const { confirm, confirmationDialog } = useConfirm();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [financialYearFilter, setFinancialYearFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const ledgerRequestRef = useRef(0);

  const activeAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeAccess?.role || user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
  const normalizedRole = role.replace(/[\s-]+/g, '');
  const canEditExpenses = ['admin', 'superadmin', 'ca', 'accountant'].includes(normalizedRole);
  const canDeleteExpenses = ['admin', 'superadmin', 'ca'].includes(normalizedRole);
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
        if (!records.length) setLoadError('No company is available for Expenses.');
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
        setBranchId((current) => (
          records.some((branch) => getId(branch) === current)
            ? current
            : records.some((branch) => getId(branch) === userBranchId)
              ? userBranchId
              : getId(records[0])
        ));
        if (!records.length) setLoadError('Create a branch before recording expenses.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load branches.')); })
      .finally(() => { if (active) setIsLoadingBranches(false); });
    return () => { active = false; };
  }, [companyId, userBranchId]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    const companyBranch = `companyId=${encodeURIComponent(companyId)}&branchId=${encodeURIComponent(branchId)}`;
    Promise.allSettled([
      api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`),
      api.get(`/api/supplier?${companyBranch}&isActive=true&page=1&limit=100`),
      api.get(`/api/tax?companyId=${encodeURIComponent(companyId)}`),
      api.get(`/api/bank-account?${companyBranch}`),
      api.get(`/api/coa?${companyBranch}&type=Expense`),
    ]).then((results) => {
      if (!active) return;
      const failures = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') failures.push(getErrorMessage(result.reason, `Could not load expense setup data (${index + 1}).`));
        else if (result.value.data?.success === false) failures.push(result.value.data.message || `Could not load expense setup data (${index + 1}).`);
      });
      const [yearResult, supplierResult, taxResult, accountResult, coaResult] = results;
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        setFinancialYears(getRecords(yearResult.value.data?.data).filter((year) => year.isLocked !== true));
      }
      if (supplierResult.status === 'fulfilled' && supplierResult.value.data?.success !== false) {
        setSuppliers(getRecords(supplierResult.value.data?.data).filter((supplier) => supplier.isActive !== false));
      }
      if (taxResult.status === 'fulfilled' && taxResult.value.data?.success !== false) {
        setTaxRates(getRecords(taxResult.value.data?.data).filter((tax) => tax.isActive !== false));
      }
      if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
        setPaymentAccounts(getRecords(accountResult.value.data?.data).filter((account) => (
          account.isActive !== false && account.accountType !== 'CreditCard'
        )));
      }
      if (coaResult.status === 'fulfilled' && coaResult.value.data?.success !== false) {
        setExpenseAccounts(getRecords(coaResult.value.data?.data).filter((account) => (
          account.isActive !== false && account.isGroup !== true && account.type === 'Expense'
        )));
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingExpenses(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId, branchId });
    if (financialYearFilter !== 'all') params.set('financialYearId', financialYearFilter);
    api.get(`/api/expense?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load expenses.');
        const data = response.data?.data;
        setExpenses(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load expenses.')); })
      .finally(() => { if (active) setIsLoadingExpenses(false); });
    return () => { active = false; };
  }, [companyId, branchId, financialYearFilter, reloadKey]);

  const selectedAccount = paymentAccounts.find((account) => getId(account) === form.bankAccountId);
  const selectedFinancialYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const editingTaxRate = editingExpense?.taxRate && getId(editingExpense.taxRate) === form.taxRateId
    ? editingExpense.taxRate
    : null;
  const taxRateOptions = editingTaxRate && !taxRates.some((tax) => getId(tax) === form.taxRateId)
    ? [...taxRates, editingTaxRate]
    : taxRates;
  const selectedTax = taxRates.find((tax) => getId(tax) === form.taxRateId) || editingTaxRate;
  const previousCategories = useMemo(() => {
    const seen = new Set();
    return expenses.reduce((categories, expense) => {
      const category = String(expense.category || '').trim();
      const normalizedCategory = category.toLowerCase();
      if (category && !seen.has(normalizedCategory)) {
        seen.add(normalizedCategory);
        categories.push(category);
      }
      return categories;
    }, []);
  }, [expenses]);
  const amount = roundMoney(form.amount);
  const taxAmount = roundMoney(amount * (Number(selectedTax?.ratePercent) || 0) / 100);
  const totalAmount = roundMoney(amount + taxAmount);
  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const date = dateInputValue(expense.expenseDate);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      if (!query) return true;
      return [expense.category, expense.description, expense.vendorName, expense.reference, expense.bankAccountName]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [expenses, search, fromDate, toDate]);
  const pageTotal = visibleExpenses.reduce((sum, expense) => sum + Number(expense.totalAmount || 0), 0);
  const ledgerEntries = Array.isArray(ledgerData?.entries) ? ledgerData.entries : [];
  const ledgerTotals = ledgerEntries.reduce((totals, entry) => ({
    debit: totals.debit + (Number(entry.debit) || 0),
    credit: totals.credit + (Number(entry.credit) || 0),
  }), { debit: 0, credit: 0 });

  const loadLedger = async (accountId, from = ledgerFrom, to = ledgerTo) => {
    if (!accountId) {
      setLedgerError('Select a bank or cash account to view its ledger.');
      return;
    }
    const requestId = ++ledgerRequestRef.current;
    setIsLoadingLedger(true);
    setLedgerError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/api/bank-account/${encodeURIComponent(accountId)}/ledger${suffix}`);
      if (requestId !== ledgerRequestRef.current) return;
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load the bank ledger.');
      }
      setLedgerData(response.data.data);
    } catch (error) {
      if (requestId === ledgerRequestRef.current) {
        setLedgerData(null);
        setLedgerError(getErrorMessage(error, 'Could not load the bank ledger.'));
      }
    } finally {
      if (requestId === ledgerRequestRef.current) setIsLoadingLedger(false);
    }
  };

  const openLedger = () => {
    const account = paymentAccounts.find((item) => ['Savings', 'Current'].includes(item.accountType)) ||
      paymentAccounts[0];
    setLedgerAccountId(getId(account));
    setLedgerFrom('');
    setLedgerTo('');
    setLedgerData(null);
    setLedgerError('');
    setIsLedgerOpen(true);
    if (account) loadLedger(getId(account), '', '');
  };

  const closeLedger = () => {
    ledgerRequestRef.current += 1;
    setIsLedgerOpen(false);
    setIsLoadingLedger(false);
    setLedgerError('');
  };

  const handleLedgerSearch = (event) => {
    event.preventDefault();
    if (ledgerFrom && ledgerTo && ledgerFrom > ledgerTo) {
      setLedgerError('From date must be on or before the To date.');
      return;
    }
    loadLedger(ledgerAccountId, ledgerFrom, ledgerTo);
  };

  const exportLedger = () => {
    if (!ledgerData) return;
    const account = paymentAccounts.find((item) => getId(item) === ledgerAccountId);
    const rows = [
      ['Account', account?.accountName || ledgerData.account?.name || 'Bank / cash account'],
      ['Opening balance', formatLedgerBalance(ledgerData.openingBalance)],
      ['Money in', formatCurrency(ledgerTotals.debit)],
      ['Money out', formatCurrency(ledgerTotals.credit)],
      ['Closing balance', formatLedgerBalance(ledgerData.closingBalance)],
      [],
      ['Date', 'Description', 'Reference', 'Money in (Debit)', 'Money out (Credit)', 'Running balance'],
      ...ledgerEntries.map((entry) => [
        formatDate(entry.date),
        entry.narration || entry.remarks || '',
        entry.reference || '',
        Number(entry.debit) || 0,
        Number(entry.credit) || 0,
        `${formatCurrency(Math.abs(Number(entry.runningBalance) || 0))} ${entry.balanceType || ''}`.trim(),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    const accountName = (account?.accountName || 'bank-account').replace(/[^a-z0-9-]+/gi, '-');
    link.href = url;
    link.download = `${accountName}-ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const changeCompany = (nextCompanyId) => {
    closeLedger();
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setFinancialYears([]);
    setSuppliers([]);
    setTaxRates([]);
    setPaymentAccounts([]);
    setExpenseAccounts([]);
    setExpenses([]);
    setFinancialYearFilter('all');
    setIsFormOpen(false);
    setLoadError('');
    setSetupError('');
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)) || financialYears[0];
    setEditingExpense(null);
    setForm({ ...EMPTY_FORM, financialYearId: getId(year), bankAccountId: getId(paymentAccounts[0]) });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (expense) => {
    setEditingExpense(expense);
    setForm({
      ...EMPTY_FORM,
      financialYearId: getId(expense.financialYearId),
      expenseDate: dateInputValue(expense.expenseDate),
      category: expense.category || '',
      description: expense.description || '',
      amount: String(expense.amount ?? ''),
      taxRateId: getId(expense.taxRateId),
      vendorId: getId(expense.vendorId),
      bankAccountId: getId(expense.bankAccountId),
      expenseAccountId: getId(expense.expenseAccountId),
      reference: expense.reference || '',
      notes: expense.notes || '',
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingExpense(null);
    setFormError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!companyId || !branchId || !selectedFinancialYear || !selectedAccount) {
      setFormError('Select a branch, open financial year, and payment account.');
      return;
    }
    if (form.expenseDate < dateInputValue(selectedFinancialYear.startDate) ||
      form.expenseDate > dateInputValue(selectedFinancialYear.endDate)) {
      setFormError('Expense date must fall within the selected financial year.');
      return;
    }
    if (!form.category.trim() || !form.description.trim() || amount <= 0) {
      setFormError('Enter an expense category, description, and amount greater than zero.');
      return;
    }
    if (totalAmount <= 0) {
      setFormError('Expense total must be greater than zero.');
      return;
    }
    const samePaymentAccount = editingExpense &&
      getId(editingExpense.bankAccountId) === form.bankAccountId;
    const availableBalance = Number(selectedAccount.currentBalance ?? selectedAccount.balance) +
      (samePaymentAccount ? Number(editingExpense.totalAmount) || 0 : 0);
    if (Number.isFinite(availableBalance) && totalAmount - availableBalance > 0.01) {
      setFormError(`Insufficient balance in ${selectedAccount.accountName}. Available: ${formatCurrency(availableBalance)}.`);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        companyId,
        branchId,
        financialYearId: form.financialYearId,
        expenseDate: form.expenseDate,
        category: form.category.trim(),
        description: form.description.trim(),
        amount,
        taxRateId: form.taxRateId || null,
        taxAmount,
        totalAmount,
        paymentMode: paymentModeFor(selectedAccount),
        bankAccountId: form.bankAccountId,
        expenseAccountId: form.expenseAccountId || null,
        vendorId: form.vendorId || null,
        reference: form.reference.trim(),
        notes: form.notes.trim(),
      };
      const response = editingExpense
        ? await api.put(`/api/expense/${encodeURIComponent(getId(editingExpense))}`, payload)
        : await api.post('/api/expense', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || `Expense was not ${editingExpense ? 'updated' : 'recorded'}.`);
      }
      showToast(
        editingExpense
          ? 'Expense updated. The previous journal entry was reversed.'
          : 'Expense recorded and journal posted.',
        'success',
      );
      setIsFormOpen(false);
      setEditingExpense(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, `Could not ${editingExpense ? 'update' : 'record'} expense.`);
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (expense) => {
    const expenseId = getId(expense);
    const confirmed = await confirm({
      title: 'Delete this expense?',
      message: `This will remove "${expense.category || expense.description}" from the expense list and reverse its accounting journal. This action cannot be undone.`,
      confirmLabel: 'Delete expense',
      danger: true,
    });
    if (!confirmed) return;

    setDeletingExpenseId(expenseId);
    try {
      const params = new URLSearchParams({ companyId, branchId });
      const response = await api.delete(`/api/expense/${encodeURIComponent(expenseId)}?${params.toString()}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Expense was not deleted.');
      }
      showToast(response.data?.message || 'Expense deleted and accounting journal reversed.', 'success');
      setReloadKey((value) => value + 1);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not delete expense.'), 'error');
    } finally {
      setDeletingExpenseId('');
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

  const refreshExpenses = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Expense &amp; Payroll</span><span aria-hidden="true">›</span><span className="font-semibold text-slate-800">Expenses</span></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700"><Coins className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses</h1><p className="mt-1 text-sm text-slate-500">Record operating expenses and post their accounting entries.</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" leftIcon={RotateCw} onClick={refreshExpenses} isDisabled={!companyId}>Refresh</Button><Button variant="outline" leftIcon={Landmark} onClick={openLedger} isDisabled={!paymentAccounts.length || isLoadingSetup}>Bank Ledger</Button><Button leftIcon={Plus} onClick={openCreateForm} className="bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-500/30" isDisabled={!companyId || !branchId || !financialYears.length || !paymentAccounts.length || isLoadingSetup}>Record Expense</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ title: 'Expense Records', value: visibleExpenses.length.toLocaleString(), detail: 'For current filters' }, { title: 'Total Expenses', value: formatCurrency(pageTotal), detail: 'Including tax' }, { title: 'Average Expense', value: formatCurrency(visibleExpenses.length ? pageTotal / visibleExpenses.length : 0), detail: 'Current result set' }].map((card) => <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{card.title}</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{card.value}</p><p className="mt-1 text-[11px] text-slate-400">{card.detail}</p></div>)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_190px_150px_150px]">
          <label className="relative"><span className="sr-only">Search expenses</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${CONTROL_CLASS} h-10 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search category, vendor, reference..." /></label>
          <select aria-label="Financial year filter" className={`${CONTROL_CLASS} h-10`} value={financialYearFilter} onChange={(event) => setFinancialYearFilter(event.target.value)}><option value="all">All Financial Years</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-2"><CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" /><input aria-label="From date" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-2"><CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" /><input aria-label="To date" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch</span><select className={`${CONTROL_CLASS} h-9 max-w-xs`} value={branchId} onChange={(event) => { setBranchId(event.target.value); setFinancialYearFilter('all'); setIsFormOpen(false); }} disabled={isLoadingBranches}><option value="">Select branch</option>{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
          {!isLoadingSetup && branchId && !financialYears.length && <p role="status" className="basis-full text-xs text-amber-700">Create an open financial year for this branch before recording expenses.</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category / Description</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Paid From</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Total</th>{(canEditExpenses || canDeleteExpenses) && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">{isLoadingExpenses ? <tr><td colSpan={canEditExpenses || canDeleteExpenses ? 8 : 7} className="px-4 py-12 text-center text-sm text-slate-500">Loading expenses…</td></tr>
            : visibleExpenses.length === 0 ? <tr><td colSpan={canEditExpenses || canDeleteExpenses ? 8 : 7} className="px-4 py-14 text-center"><Wallet className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No expenses found</p><p className="mt-1 text-xs text-slate-500">Record an expense to see it in this register.</p></td></tr>
              : visibleExpenses.map((expense) => {
                const expenseId = getId(expense);
                const canReverse = financialYears.some((year) => getId(year) === getId(expense.financialYearId));
                return <tr key={expenseId} className="transition-colors hover:bg-cyan-50/30"><td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">{formatDate(expense.expenseDate)}</td><td className="max-w-[260px] px-4 py-3"><p className="truncate font-semibold text-slate-800">{expense.category}</p><p className="mt-0.5 truncate text-xs text-slate-500">{expense.description}</p></td><td className="px-4 py-3 text-xs text-slate-600">{expense.vendorName || '—'}</td><td className="px-4 py-3 text-xs text-slate-600">{expense.bankAccountName || '—'}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(expense.amount)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(expense.taxAmount)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(expense.totalAmount)}</td>{(canEditExpenses || canDeleteExpenses) && <td className="px-4 py-3"><div className="flex justify-end gap-1.5">{canEditExpenses && <Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => openEditForm(expense)} isDisabled={!canReverse || Boolean(deletingExpenseId)} title={canReverse ? 'Edit expense' : 'This expense belongs to a locked or unavailable financial year'}>Edit</Button>}{canDeleteExpenses && <Button variant="danger" size="sm" leftIcon={Trash2} onClick={() => handleDeleteExpense(expense)} isLoading={deletingExpenseId === expenseId} isDisabled={!canReverse || (Boolean(deletingExpenseId) && deletingExpenseId !== expenseId)} title={canReverse ? 'Delete and reverse this expense' : 'This expense belongs to a locked or unavailable financial year'}>Delete</Button>}</div></td>}</tr>;
              })}</tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{visibleExpenses.length} expenses · Total {formatCurrency(pageTotal)}</span><span>Expenses are posted immediately to the selected bank/cash account.</span></div>
      </div>

      {isFormOpen && <div className="fixed inset-x-0 bottom-0 top-[64px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close expense form" onClick={closeForm} />
        <aside role="dialog" aria-modal="true" aria-labelledby="create-expense-title" className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><Coins className="h-4 w-4" /></div><div><h2 id="create-expense-title" className="text-base font-bold text-slate-900">{editingExpense ? 'Edit Expense' : 'Record Expense'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{editingExpense ? 'Changes will reverse the previous journal and post an updated entry.' : 'Payment is posted from the selected account'}</p></div></div><button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close expense form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={LABEL_CLASS}>Expense Date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={form.expenseDate} onChange={(event) => setForm((previous) => ({ ...previous, expenseDate: event.target.value }))} required disabled={isSaving} /></label>
                <label><span className={LABEL_CLASS}>Financial Year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required disabled={isSaving}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Vendor / Supplier</span><select className={CONTROL_CLASS} value={form.vendorId} onChange={(event) => setForm((previous) => ({ ...previous, vendorId: event.target.value }))} disabled={isSaving}><option value="">No vendor</option>{suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Expense Amount <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} required disabled={isSaving} /></label>
                               <label><span className={LABEL_CLASS}>Tax Rate</span><select className={CONTROL_CLASS} value={form.taxRateId} onChange={(event) => setForm((previous) => ({ ...previous, taxRateId: event.target.value }))} disabled={isSaving}><option value="">No tax</option>{taxRateOptions.map((tax) => <option key={getId(tax)} value={getId(tax)}>{tax.name} ({Number(tax.ratePercent) || 0}%){tax.isActive === false ? ' · inactive' : ''}</option>)}</select></label>

                <div><span className={LABEL_CLASS}>Total Including Tax</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(totalAmount)}</p></div>

                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Category <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))} maxLength={100} placeholder="Travel, rent, utilities..." required disabled={isSaving} />
                  {previousCategories.length > 0 && <span className="mt-2 block text-[11px] text-slate-500">Previously used categories — click to reuse:</span>}
                  {previousCategories.length > 0 && <div className="mt-1 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" aria-label="Previously used expense categories">
                    {previousCategories.map((category) => <button key={category.toLowerCase()} type="button" className={`rounded-full border px-2.5 py-1 text-[11px] transition ${form.category.trim().toLowerCase() === category.toLowerCase() ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'}`} onClick={() => setForm((previous) => ({ ...previous, category }))} disabled={isSaving}>{category}</button>)}
                  </div>}
                </label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Description <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} maxLength={500} required disabled={isSaving} /></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Pay From <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={form.bankAccountId} onChange={(event) => setForm((previous) => ({ ...previous, bankAccountId: event.target.value }))} required disabled={isSaving}><option value="">Select bank / cash account</option>{paymentAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType} · Available {formatCurrency(account.currentBalance ?? account.balance)}</option>)}</select>{selectedAccount && <span className="mt-1 block text-[11px] text-slate-500">Payment mode: {paymentModeFor(selectedAccount)} · Available balance: {formatCurrency(selectedAccount.currentBalance ?? selectedAccount.balance)}</span>}</label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Expense Ledger</span><select className={CONTROL_CLASS} value={form.expenseAccountId} onChange={(event) => setForm((previous) => ({ ...previous, expenseAccountId: event.target.value }))} disabled={isSaving}><option value="">Auto-create / map from category</option>{expenseAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.code} · {account.name}</option>)}</select></label>
                <label><span className={LABEL_CLASS}>Reference</span><input className={CONTROL_CLASS} value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))} maxLength={200} disabled={isSaving} /></label>
                <label className="sm:col-span-2"><span className={LABEL_CLASS}>Notes</span><textarea className={`${CONTROL_CLASS} min-h-20 resize-y`} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} maxLength={5000} disabled={isSaving} /></label>
              </div>
              {setupError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
              {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
              <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">The server verifies the selected account balance before saving and posts the expense journal automatically.</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{formatCurrency(totalAmount)} total</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeForm} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-500/30">{editingExpense ? 'Save Changes' : 'Save Expense'}</Button></div></div>
          </form>
        </aside>
      </div>}

      <Modal
        isOpen={isLedgerOpen}
        onClose={closeLedger}
        title="Bank / cash ledger"
        subtitle={ledgerData?.account?.name || 'View account statement and running balance'}
        size="full"
        closeOnBackdrop={!isLoadingLedger}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeLedger}>Close</Button>
            <Button type="button" leftIcon={Download} onClick={exportLedger} isDisabled={!ledgerData}>Export CSV</Button>
          </>
        )}
      >
        <form onSubmit={handleLedgerSearch} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_170px_170px_auto]">
          <label className="grid gap-1 text-[11px] font-medium text-slate-600">
            Bank / cash account
            <select className={CONTROL_CLASS} value={ledgerAccountId} onChange={(event) => { setLedgerAccountId(event.target.value); setLedgerData(null); setLedgerError(''); }} disabled={isLoadingLedger}>
              <option value="">Select account</option>
              {paymentAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-slate-600">
            From date
            <input className={CONTROL_CLASS} type="date" value={ledgerFrom} max={ledgerTo || undefined} onChange={(event) => { setLedgerFrom(event.target.value); setLedgerData(null); }} disabled={isLoadingLedger} />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-slate-600">
            To date
            <input className={CONTROL_CLASS} type="date" value={ledgerTo} min={ledgerFrom || undefined} onChange={(event) => { setLedgerTo(event.target.value); setLedgerData(null); }} disabled={isLoadingLedger} />
          </label>
          <Button type="submit" leftIcon={Search} isLoading={isLoadingLedger} isDisabled={!ledgerAccountId} className="self-end">View statement</Button>
        </form>

        {ledgerError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{ledgerError}</p>}
        {isLoadingLedger ? (
          <div className="grid min-h-40 place-items-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Loading account ledger…</span></div>
        ) : ledgerData ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Opening balance', formatLedgerBalance(ledgerData.openingBalance)],
                ['Money in', formatCurrency(ledgerTotals.debit)],
                ['Money out', formatCurrency(ledgerTotals.credit)],
                ['Closing balance', formatLedgerBalance(ledgerData.closingBalance)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Particulars</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5 text-right">Money in (Dr)</th><th className="px-3 py-2.5 text-right">Money out (Cr)</th><th className="px-3 py-2.5 text-right">Balance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEntries.length ? ledgerEntries.map((entry, index) => (
                      <tr key={`${entry.entryId || 'entry'}-${index}`} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(entry.date)}</td>
                        <td className="max-w-[320px] px-3 py-2.5"><p className="truncate font-medium text-slate-800">{entry.narration || entry.remarks || 'Transaction'}</p><p className="mt-0.5 text-[10px] capitalize text-slate-400">{String(entry.source || '').replaceAll('-', ' ')}</p></td>
                        <td className="px-3 py-2.5 text-slate-600">{entry.reference || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-emerald-700">{Number(entry.debit) ? formatCurrency(entry.debit) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-rose-700">{Number(entry.credit) ? formatCurrency(entry.credit) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(Math.abs(Number(entry.runningBalance) || 0))} {entry.balanceType || ''}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6" className="px-3 py-10 text-center text-slate-500">No transactions found for this account and date range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-36 place-items-center text-center text-xs text-slate-500">
            Select an account and choose View statement to load its ledger.
          </div>
        )}
      </Modal>
      {confirmationDialog}
    </section>
  );
};
