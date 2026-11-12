import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  FileText,
  Layers3,
  Percent,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_LINE = { description: '', quantity: '1', rate: '', taxRateId: '' };
const EMPTY_FORM = {
  financialYearId: '',
  supplierId: '',
  originalPurchaseId: '',
  date: new Date().toISOString().slice(0, 10),
  reason: 'PURCHASE_RETURN',
  reference: '',
  lineItems: [{ ...EMPTY_LINE }],
};
const PAGE_LIMIT = 20;

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

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(numberValue(value));
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const reasonLabels = {
  PURCHASE_RETURN: 'Purchase return',
  RATE_DIFFERENCE: 'Rate difference',
  DISCOUNT: 'Discount',
  OTHER: 'Other',
};
const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100';
const fieldLabelClass = 'mb-1 block text-xs font-medium text-slate-600';

const getLineAmounts = (line, taxRates) => {
  const amount = roundMoney(numberValue(line.quantity) * numberValue(line.rate));
  const taxRate = taxRates.find((tax) => getId(tax) === line.taxRateId);
  const taxAmount = roundMoney(amount * numberValue(taxRate?.ratePercent) / 100);
  return { amount, taxAmount, totalAmount: roundMoney(amount + taxAmount) };
};

export const DebitNotesManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [financialYearFilter, setFinancialYearFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [setupError, setSetupError] = useState('');
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
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setCompanies(records);
        if (records.length === 1) setCompanyId(getId(records[0]));
        else if (!records.length) setLoadError('No company is available for Debit Notes.');
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load companies.'));
      })
      .finally(() => {
        if (active) setIsLoadingCompanies(false);
      });
    return () => { active = false; };
  }, [preferredCompanyId, reloadKey]);

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      setBranchId('');
      setIsLoadingBranches(false);
      return undefined;
    }
    let active = true;
    setIsLoadingBranches(true);
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
        if (!records.length) setLoadError('Create a branch before using Debit Notes.');
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load branches.'));
      })
      .finally(() => {
        if (active) setIsLoadingBranches(false);
      });
    return () => { active = false; };
  }, [companyId, canSelectAllBranches, userBranchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    const supplierParams = new URLSearchParams({
      companyId,
      isActive: 'true',
      page: '1',
      limit: '100',
    });
    if (branchId !== 'all') supplierParams.set('branchId', branchId);
    const requests = [
      api.get(`/api/supplier?${supplierParams.toString()}`),
      api.get(`/api/tax?companyId=${encodeURIComponent(companyId)}`),
    ];
    Promise.allSettled(requests)
      .then((results) => {
        if (!active) return;
        const failures = [];
        const [supplierResult, taxResult] = results;
        if (supplierResult.status === 'fulfilled' && supplierResult.value.data?.success !== false) {
          const records = supplierResult.value.data?.data?.items;
          setSuppliers(Array.isArray(records) ? records.filter((supplier) => supplier.isActive !== false) : []);
        } else {
          failures.push(supplierResult.status === 'rejected'
            ? getErrorMessage(supplierResult.reason, 'Could not load suppliers.')
            : supplierResult.value.data?.message || 'Could not load suppliers.');
        }
        if (taxResult.status === 'fulfilled' && taxResult.value.data?.success !== false) {
          const records = taxResult.value.data?.data;
          setTaxRates(Array.isArray(records) ? records.filter((tax) => tax.isActive !== false) : []);
        } else {
          failures.push(taxResult.status === 'rejected'
            ? getErrorMessage(taxResult.reason, 'Could not load tax rates.')
            : taxResult.value.data?.message || 'Could not load tax rates.');
        }
        setSetupError(failures.join(' '));
      })
      .finally(() => {
        if (active) setIsLoadingSetup(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId || branchId === 'all') {
      setFinancialYears([]);
      setIsLoadingYears(false);
      return undefined;
    }
    let active = true;
    setIsLoadingYears(true);
    api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load financial years.');
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const openYears = records.filter((year) => year.isLocked !== true);
        setFinancialYears(openYears);
        setFinancialYearFilter((current) => (
          current === 'all' || openYears.some((year) => getId(year) === current) ? current : 'all'
        ));
        setForm((previous) => {
          if (openYears.some((year) => getId(year) === previous.financialYearId)) return previous;
          const today = new Date().toISOString().slice(0, 10);
          const currentYear = openYears.find((year) => (
            today >= new Date(year.startDate).toISOString().slice(0, 10) &&
            today <= new Date(year.endDate).toISOString().slice(0, 10)
          ));
          return { ...previous, financialYearId: getId(currentYear || openYears[0]) };
        });
      })
      .catch((error) => {
        if (active) setSetupError((previous) => [previous, getErrorMessage(error, 'Could not load financial years.')].filter(Boolean).join(' '));
      })
      .finally(() => {
        if (active) setIsLoadingYears(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingNotes(true);
    setLoadError('');
    const params = new URLSearchParams({
      companyId,
      page: String(page),
      limit: String(PAGE_LIMIT),
    });
    if (branchId !== 'all') params.set('branchId', branchId);
    if (financialYearFilter !== 'all') params.set('financialYearId', financialYearFilter);
    if (supplierFilter !== 'all') params.set('supplierId', supplierFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    api.get(`/api/debit-note?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load debit notes.');
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: PAGE_LIMIT, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (!records.length && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setNotes(records);
        setPagination(pageInfo);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load debit notes.'));
      })
      .finally(() => {
        if (active) setIsLoadingNotes(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, page, financialYearFilter, supplierFilter, statusFilter, fromDate, toDate, reloadKey]);

  useEffect(() => {
    if (!isFormOpen || !companyId || !branchId || branchId === 'all' || !form.supplierId) {
      setPurchases([]);
      setIsLoadingPurchases(false);
      return undefined;
    }
    let active = true;
    setIsLoadingPurchases(true);
    const params = new URLSearchParams({
      companyId,
      branchId,
      supplierId: form.supplierId,
      page: '1',
      limit: '100',
    });
    api.get(`/api/purchase?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load purchase bills.');
        const records = response.data?.data?.items;
        setPurchases(Array.isArray(records)
          ? records.filter((purchase) => purchase.status !== 'CANCELLED')
          : []);
      })
      .catch((error) => {
        if (active) setFormError(getErrorMessage(error, 'Could not load purchase bills for this supplier.'));
      })
      .finally(() => {
        if (active) setIsLoadingPurchases(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, form.supplierId, isFormOpen]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => [
      note.reference,
      note.supplierName,
      note.reason,
      getId(note),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [notes, search]);

  const summary = useMemo(() => notes.reduce((totals, note) => ({
    subtotal: totals.subtotal + numberValue(note.subTotal),
    tax: totals.tax + numberValue(note.taxAmount),
    total: totals.total + numberValue(note.totalAmount),
    posted: totals.posted + (note.status === 'POSTED' ? 1 : 0),
  }), { subtotal: 0, tax: 0, total: 0, posted: 0 }), [notes]);

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const firstVisible = pagination.total ? (page - 1) * pagination.limit + 1 : 0;
  const lastVisible = Math.min(page * pagination.limit, pagination.total);
  const selectedPurchase = purchases.find((purchase) => getId(purchase) === form.originalPurchaseId);
  const formTotals = useMemo(() => form.lineItems.reduce((totals, line) => {
    const lineTotals = getLineAmounts(line, taxRates);
    return {
      subTotal: roundMoney(totals.subTotal + lineTotals.amount),
      taxAmount: roundMoney(totals.taxAmount + lineTotals.taxAmount),
      totalAmount: roundMoney(totals.totalAmount + lineTotals.totalAmount),
    };
  }, { subTotal: 0, taxAmount: 0, totalAmount: 0 }), [form.lineItems, taxRates]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranchId('');
    setBranches([]);
    setFinancialYears([]);
    setSuppliers([]);
    setTaxRates([]);
    setNotes([]);
    setPage(1);
    setLoadError('');
    setSetupError('');
    setIsFormOpen(false);
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setPage(1);
    setNotes([]);
    setFinancialYearFilter('all');
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
    setLoadError('');
    setSetupError('');
  };

  const openCreateForm = () => {
    const defaultYear = financialYears.find((year) => getId(year) === form.financialYearId) || financialYears[0];
    setForm({
      ...EMPTY_FORM,
      financialYearId: getId(defaultYear),
      lineItems: [{ ...EMPTY_LINE }],
    });
    setPurchases([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError('');
  };

  useEffect(() => {
    if (!isFormOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) setIsFormOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFormOpen, isSaving]);

  const refreshNotes = () => {
    setLoadError('');
    setReloadKey((previous) => previous + 1);
  };

  const updateLine = (index, key, value) => {
    setForm((previous) => ({
      ...previous,
      lineItems: previous.lineItems.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [key]: value } : line
      )),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!companyId || !branchId || branchId === 'all') {
      setFormError('Select a specific branch before creating a debit note.');
      return;
    }
    if (!form.financialYearId || !form.supplierId) {
      setFormError('Select an open financial year and supplier.');
      return;
    }
    const preparedLines = form.lineItems.map((line) => ({
      ...line,
      description: line.description.trim(),
      ...getLineAmounts(line, taxRates),
    }));
    if (preparedLines.some((line) => !line.description || numberValue(line.quantity) <= 0)) {
      setFormError('Each line needs a description and a quantity greater than zero.');
      return;
    }
    if (formTotals.totalAmount <= 0) {
      setFormError('Debit note total must be greater than zero.');
      return;
    }
    const payload = {
      companyId,
      branchId,
      financialYearId: form.financialYearId,
      supplierId: form.supplierId,
      originalPurchaseId: form.originalPurchaseId || null,
      date: form.date,
      reason: form.reason,
      reference: form.reference.trim(),
      lineItems: preparedLines.map((line) => ({
        productId: null,
        description: line.description,
        quantity: numberValue(line.quantity),
        rate: numberValue(line.rate),
        amount: line.amount,
        taxRateId: line.taxRateId || null,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
      })),
      subTotal: formTotals.subTotal,
      taxAmount: formTotals.taxAmount,
      totalAmount: formTotals.totalAmount,
    };

    setIsSaving(true);
    try {
      const response = await api.post('/api/debit-note', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not create debit note.');
      }
      showToast('Debit note created and posted successfully.', 'success');
      setIsFormOpen(false);
      setPage(1);
      setReloadKey((previous) => previous + 1);
      setFormError('');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create debit note.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const summaryCards = [
    { title: 'Total Notes', value: pagination.total.toLocaleString(), detail: 'For selected filters', icon: FileText, tone: 'blue' },
    { title: 'Page Subtotal', value: formatCurrency(summary.subtotal), detail: 'Before tax', icon: CircleDollarSign, tone: 'emerald' },
    { title: 'GST Reversal', value: formatCurrency(summary.tax), detail: 'Current page', icon: Percent, tone: 'violet' },
    { title: 'Page Total', value: formatCurrency(summary.total), detail: `${summary.posted} posted on this page`, icon: Wallet, tone: 'amber' },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Accounting</span>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-slate-800">Debit Notes</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Debit Notes</h1>
            <p className="mt-1 text-sm text-slate-500">Record supplier returns, discounts and purchase adjustments.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={RotateCw} onClick={refreshNotes} isDisabled={!companyId}>
            Refresh
          </Button>
          <Button
            onClick={openCreateForm}
            leftIcon={Plus}
            className="bg-violet-700 hover:bg-violet-800 focus:ring-violet-500/30"
            isDisabled={!companyId || !branchId || branchId === 'all' || !financialYears.length || !suppliers.length || isLoadingSetup || isLoadingYears}
          >
            Create Debit Note
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const tones = {
            blue: 'bg-sky-100 text-sky-700',
            emerald: 'bg-emerald-100 text-emerald-700',
            violet: 'bg-violet-100 text-violet-700',
            amber: 'bg-amber-100 text-amber-700',
          };
          return (
            <div key={card.title} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${tones[card.tone]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-slate-500">{card.title}</p>
              <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{card.value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[140px_160px_160px_150px_minmax(190px,1fr)]">
          <label>
            <span className="sr-only">Status</span>
            <select
              className={`${controlClass} h-10`}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
            >
              <option value="all">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Supplier</span>
            <select
              className={`${controlClass} h-10`}
              value={supplierFilter}
              onChange={(event) => { setSupplierFilter(event.target.value); setPage(1); }}
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Financial year</span>
            <select
              className={`${controlClass} h-10`}
              value={financialYearFilter}
              onChange={(event) => { setFinancialYearFilter(event.target.value); setPage(1); }}
              disabled={branchId === 'all' || !financialYears.length}
            >
              <option value="all">All Financial Years</option>
              {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
            </select>
          </label>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-2">
            <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none"
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(event) => { setFromDate(event.target.value); setPage(1); }}
            />
            <span className="text-slate-300">–</span>
            <input
              className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none"
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(event) => { setToDate(event.target.value); setPage(1); }}
            />
          </div>
          <label className="relative">
            <span className="sr-only">Search current page</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${controlClass} h-10 pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this page..."
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && (
            <label className="min-w-[220px]">
              <span className="sr-only">Company</span>
              <select className={`${controlClass} h-9`} value={companyId} onChange={(event) => changeCompany(event.target.value)}>
                <option value="">Select company</option>
                {companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="sr-only">Branch</span>
            <select
              className={`${controlClass} h-9 max-w-xs`}
              value={branchId}
              onChange={(event) => changeBranch(event.target.value)}
              disabled={isLoadingBranches}
            >
              <option value="">Select branch</option>
              {canSelectAllBranches && <option value="all">All branches</option>}
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Reason / Reference</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingNotes ? (
                <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading debit notes…</td></tr>
              ) : visibleNotes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-14 text-center">
                    <Layers3 className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No debit notes found</p>
                    <p className="mt-1 text-xs text-slate-500">Create a note to record a supplier return or adjustment.</p>
                  </td>
                </tr>
              ) : visibleNotes.map((note) => {
                const noteId = getId(note);
                const posted = note.status === 'POSTED';
                return (
                  <tr key={noteId} className="transition-colors hover:bg-violet-50/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">{formatDate(note.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800" title={noteId}>
                      #{noteId.slice(-8).toUpperCase()}
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate font-medium text-slate-700">{note.supplierName || '—'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{note.originalPurchaseId ? `Purchase linked · ${note.originalPurchaseId.slice(-6).toUpperCase()}` : 'No purchase linked'}</p>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-medium text-slate-700">{reasonLabels[note.reason] || note.reason || '—'}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">{note.reference || 'No reference'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(note.subTotal)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(note.taxAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(note.totalAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${posted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {posted ? 'Posted' : note.status || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {firstVisible} to {lastVisible} of {pagination.total.toLocaleString()} notes
            {search.trim() ? ` · ${visibleNotes.length} match${visibleNotes.length === 1 ? '' : 'es'} on this page` : ''}
          </span>
          <div className="flex items-center justify-end gap-1">
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={`min-w-8 rounded-md border px-2 py-1.5 ${page === pageNumber ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            {pageCount > 5 && <span className="px-1">… {pageCount}</span>}
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[72px] z-[70]">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close debit note form" onClick={closeForm} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-debit-note-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="create-debit-note-title" className="text-base font-bold text-slate-900">Create Debit Note</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Supplier purchase return or adjustment</p>
                </div>
              </div>
              <button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close create debit note" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-slate-100 px-5">
              <div className="inline-flex border-b-2 border-violet-600 px-1 py-3 text-xs font-semibold text-violet-700">General</div>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={fieldLabelClass}>Note Date <span className="text-rose-500">*</span></span>
                    <input className={controlClass} type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} required />
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Financial Year <span className="text-rose-500">*</span></span>
                    <select className={controlClass} value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required>
                      <option value="">Select open financial year</option>
                      {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Supplier <span className="text-rose-500">*</span></span>
                    <select
                      className={controlClass}
                      value={form.supplierId}
                      onChange={(event) => setForm((previous) => ({ ...previous, supplierId: event.target.value, originalPurchaseId: '' }))}
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Original Purchase Bill</span>
                    <select
                      className={controlClass}
                      value={form.originalPurchaseId}
                      onChange={(event) => setForm((previous) => ({ ...previous, originalPurchaseId: event.target.value }))}
                      disabled={!form.supplierId || isLoadingPurchases}
                    >
                      <option value="">{isLoadingPurchases ? 'Loading bills…' : 'No linked purchase bill'}</option>
                      {purchases.map((purchase) => (
                        <option key={getId(purchase)} value={getId(purchase)}>
                          {purchase.billNumber} · Due {formatCurrency(purchase.balanceDue)}
                        </option>
                      ))}
                    </select>
                    {selectedPurchase && <span className="mt-1 block text-[11px] text-slate-500">Bill total {formatCurrency(selectedPurchase.grandTotal)} · outstanding {formatCurrency(selectedPurchase.balanceDue)}</span>}
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Reason <span className="text-rose-500">*</span></span>
                    <select className={controlClass} value={form.reason} onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))} required>
                      <option value="PURCHASE_RETURN">Purchase return</option>
                      <option value="RATE_DIFFERENCE">Rate difference</option>
                      <option value="DISCOUNT">Discount</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={fieldLabelClass}>Reference</span>
                    <input className={controlClass} value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))} maxLength={200} placeholder="Supplier credit / return reference" />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Line items</p>
                      <p className="text-[11px] text-slate-500">Amounts and tax reversal are calculated automatically.</p>
                    </div>
                    <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50" onClick={() => setForm((previous) => ({ ...previous, lineItems: [...previous.lineItems, { ...EMPTY_LINE }] }))}>
                      <Plus className="h-3.5 w-3.5" /> Add line
                    </button>
                  </div>
                  <div className="space-y-3 p-3">
                    {form.lineItems.map((line, index) => {
                      const lineTotals = getLineAmounts(line, taxRates);
                      return (
                        <div key={`debit-line-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">Item {index + 1}</span>
                            <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" aria-label={`Remove item ${index + 1}`} disabled={form.lineItems.length <= 1} onClick={() => setForm((previous) => ({ ...previous, lineItems: previous.lineItems.filter((_, lineIndex) => lineIndex !== index) }))}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <label className="mb-2 block">
                            <span className={fieldLabelClass}>Description <span className="text-rose-500">*</span></span>
                            <input className={controlClass} value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} maxLength={500} placeholder="Returned goods / adjustment" required />
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <label>
                              <span className={fieldLabelClass}>Quantity</span>
                              <input className={controlClass} type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} required />
                            </label>
                            <label>
                              <span className={fieldLabelClass}>Rate</span>
                              <input className={controlClass} type="number" min="0" step="0.01" value={line.rate} onChange={(event) => updateLine(index, 'rate', event.target.value)} required />
                            </label>
                            <label>
                              <span className={fieldLabelClass}>Tax rate</span>
                              <select className={controlClass} value={line.taxRateId} onChange={(event) => updateLine(index, 'taxRateId', event.target.value)}>
                                <option value="">No tax</option>
                                {taxRates.map((tax) => <option key={getId(tax)} value={getId(tax)}>{tax.name} ({numberValue(tax.ratePercent)}%)</option>)}
                              </select>
                            </label>
                            <div>
                              <span className={fieldLabelClass}>Line total</span>
                              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(lineTotals.totalAmount)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1 border-t border-slate-100 px-3 py-3 text-sm">
                    <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(formTotals.subTotal)}</span></div>
                    <div className="flex justify-between text-slate-500"><span>Tax reversal</span><span>{formatCurrency(formTotals.taxAmount)}</span></div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900"><span>Debit note total</span><span>{formatCurrency(formTotals.totalAmount)}</span></div>
                  </div>
                </div>

                {setupError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
                {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
                <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Saving posts the accounting entry automatically. A linked purchase bill may have its outstanding balance reduced.</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                <span className="text-xs text-slate-500">{isLoadingSetup || isLoadingYears ? 'Loading setup…' : 'Creates a posted debit note'}</span>
                <div className="flex gap-2">
                  <Button variant="outline" type="button" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
                  <Button type="submit" isLoading={isSaving} className="bg-violet-700 hover:bg-violet-800 focus:ring-violet-500/30">Create Debit Note</Button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
};
