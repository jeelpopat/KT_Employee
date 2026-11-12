import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_LINE = {
  productId: '',
  description: '',
  quantity: '1',
  rate: '0',
  taxRateId: '',
};

const EMPTY_FORM = {
  customerId: '',
  financialYearId: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  reference: '',
  discountTotal: '0',
  roundOff: '0',
  notes: '',
  lineItems: [{ ...EMPTY_LINE }],
};

const INVOICE_STATUSES = [
  { value: 'POSTED', label: 'Outstanding' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_ACCOUNT_TYPES = new Set(['Savings', 'Current', 'Cash', 'Wallet', 'UPI']);

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

const getInvoiceId = (invoice) => getId(invoice?.id || invoice?._id);

const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.errors) ? data.errors : Array.isArray(data?.details) ? data.details : [];
  const messages = details
    .map((item) => [item.field || item.path?.join?.('.'), item.message].filter(Boolean).join(': '))
    .filter(Boolean);
  return messages.length
    ? [data?.message, ...messages].filter(Boolean).join(' — ')
    : data?.message || error?.message || fallback;
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

const getPaymentMode = (account) => (
  ['Cash', 'Wallet'].includes(account?.accountType)
    ? 'CASH'
    : account?.accountType === 'UPI' ? 'UPI' : 'BANK_TRANSFER'
);

const statusLabel = (invoice) => (
  INVOICE_STATUSES.find((item) => item.value === (invoice.rawStatus || invoice.status))?.label ||
  invoice.statusLabel ||
  invoice.status ||
  'Unknown'
);

const statusClass = (invoice) => {
  const status = invoice.rawStatus || invoice.status;
  if (status === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIALLY_PAID') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED') return 'bg-rose-50 text-rose-700';
  return 'bg-cyan-50 text-[#045d86]';
};

export const SalesInvoicesManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(false);
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentFinancialYearId, setPaymentFinancialYearId] = useState('');

  const activeCompanyAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeCompanyAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeCompanyAccess?.role || user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) ||
    user?.companyCreated === true;

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
          setCompanyId(getId(availableCompanies[0]));
          setIsLoadingBranches(true);
        } else if (!availableCompanies.length) {
          setLoadError('No company is available for Sales Invoices.');
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
        setIsLoadingReferenceData(Boolean(availableBranches.length));
        setIsLoadingYears(Boolean(availableBranches.length));
        setBranchId((current) => {
          if (current && availableBranches.some((branch) => getId(branch) === current)) return current;
          if (userBranchId && availableBranches.some((branch) => getId(branch) === userBranchId)) return userBranchId;
          return getId(availableBranches[0]);
        });
        if (!availableBranches.length) setLoadError('Create a branch before creating Sales Invoices.');
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
  }, [companyId, userBranchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const customerParams = new URLSearchParams({
      companyId,
      branchId,
      isActive: 'true',
      page: '1',
      limit: '100',
    });
    const productParams = new URLSearchParams({ companyId, page: '1', limit: '100' });
    const taxParams = new URLSearchParams({ companyId });
    const accountParams = new URLSearchParams({ companyId, branchId });
    Promise.allSettled([
      api.get(`/api/customer?${customerParams.toString()}`),
      api.get(`/api/product?${productParams.toString()}`),
      api.get(`/api/tax?${taxParams.toString()}`),
      api.get(`/api/bank-account?${accountParams.toString()}`),
    ])
      .then((results) => {
        if (!active) return;
        const failures = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            failures.push(getErrorMessage(result.reason, `Could not load Sales Invoice setup data (${index + 1}).`));
          } else if (result.value.data?.success === false) {
            failures.push(result.value.data.message || `Could not load Sales Invoice setup data (${index + 1}).`);
          }
        });
        const [customerResult, productResult, taxResult, accountResult] = results;
        if (customerResult.status === 'fulfilled' && customerResult.value.data?.success !== false) {
          const records = customerResult.value.data?.data?.items || customerResult.value.data?.data || [];
          setCustomers(Array.isArray(records) ? records.filter((item) => item.isActive !== false) : []);
        }
        if (productResult.status === 'fulfilled' && productResult.value.data?.success !== false) {
          const records = productResult.value.data?.data?.items || productResult.value.data?.data || [];
          setProducts(Array.isArray(records) ? records.filter((item) => item.isActive !== false) : []);
        }
        if (taxResult.status === 'fulfilled' && taxResult.value.data?.success !== false) {
          const records = taxResult.value.data?.data || [];
          setTaxRates(Array.isArray(records) ? records.filter((item) => item.isActive !== false) : []);
        }
        if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
          const records = accountResult.value.data?.data || [];
          setPaymentAccounts(Array.isArray(records)
            ? records.filter((item) => item.isActive !== false && PAYMENT_ACCOUNT_TYPES.has(item.accountType))
            : []);
        }
        setLoadError(failures.join(' '));
      })
      .finally(() => {
        if (active) setIsLoadingReferenceData(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!branchId) return undefined;
    let active = true;
    api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load financial years.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        const openYears = records.filter((year) => year.isLocked !== true);
        setFinancialYears(openYears);
        setForm((previous) => {
          if (openYears.some((year) => getId(year) === previous.financialYearId)) return previous;
          const today = new Date().toISOString().slice(0, 10);
          const currentYear = openYears.find((year) => (
            today >= dateInputValue(year.startDate) && today <= dateInputValue(year.endDate)
          ));
          return { ...previous, financialYearId: getId(currentYear || openYears[0]) };
        });
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load financial years.'));
      })
      .finally(() => {
        if (active) setIsLoadingYears(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({
      companyId,
      branchId,
      page: String(page),
      limit: String(pagination.limit),
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (customerFilter !== 'all') params.set('customerId', customerFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (search.trim()) params.set('search', search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    api.get(`/api/invoice?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load Sales Invoices.');
        }
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: pagination.limit, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (!records.length && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setInvoices(records);
        setPagination(pageInfo);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load Sales Invoices.'));
      })
      .finally(() => {
        if (active) setIsLoadingInvoices(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, page, pagination.limit, statusFilter, customerFilter, fromDate, toDate, search, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company) === companyId);
  const selectedBranch = branches.find((branch) => getId(branch) === branchId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = selectedBranch?.branchName || 'Select a branch';
  const selectedYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const receivingAccount = paymentAccounts.find((account) => getId(account) === paymentAccountId);
  const paymentYear = financialYears.find((year) => getId(year) === paymentFinancialYearId);
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingReferenceData || isLoadingYears;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const taxRateById = useMemo(() => new Map(
    taxRates.map((tax) => [getId(tax), Number(tax.ratePercent) || 0])
  ), [taxRates]);

  const totals = useMemo(() => {
    const lineItems = form.lineItems.map((line) => {
      const taxableAmount = roundMoney((Number(line.quantity) || 0) * (Number(line.rate) || 0));
      const rate = taxRateById.get(line.taxRateId) || 0;
      const taxAmount = roundMoney((taxableAmount * rate) / 100);
      return { taxableAmount, taxAmount, totalAmount: roundMoney(taxableAmount + taxAmount) };
    });
    const subTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.taxableAmount, 0));
    const taxTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const discountTotal = Math.max(0, roundMoney(form.discountTotal));
    const roundOff = roundMoney(form.roundOff);
    const grandTotal = roundMoney(subTotal - discountTotal + taxTotal + roundOff);
    return { lineItems, subTotal, taxTotal, discountTotal, roundOff, grandTotal };
  }, [form.lineItems, form.discountTotal, form.roundOff, taxRateById]);

  const outstandingTotal = invoices.reduce((sum, invoice) => sum + (Number(invoice.balanceDue) || 0), 0);
  const receivedTotal = invoices.reduce((sum, invoice) => sum + (Number(invoice.amountReceived) || 0), 0);

  const resetCompanyData = () => {
    setBranches([]);
    setBranchId('');
    setFinancialYears([]);
    setCustomers([]);
    setProducts([]);
    setTaxRates([]);
    setPaymentAccounts([]);
    setInvoices([]);
    setPage(1);
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    resetCompanyData();
    setIsLoadingBranches(Boolean(nextCompanyId));
    setIsLoadingInvoices(Boolean(nextCompanyId));
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setFinancialYears([]);
    setCustomers([]);
    setProducts([]);
    setTaxRates([]);
    setPaymentAccounts([]);
    setInvoices([]);
    setPage(1);
    setIsLoadingReferenceData(Boolean(nextBranchId));
    setIsLoadingYears(Boolean(nextBranchId));
    setIsLoadingInvoices(Boolean(nextBranchId));
    setLoadError('');
  };

  const setFilter = (setter, value) => {
    setter(value);
    setPage(1);
    setIsLoadingInvoices(Boolean(companyId && branchId));
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => (
      today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)
    )) || financialYears[0];
    setEditingInvoice(null);
    setForm({
      ...EMPTY_FORM,
      financialYearId: getId(year),
      invoiceDate: today,
      lineItems: [{ ...EMPTY_LINE }],
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingInvoice(null);
    setFormError('');
  };

  const openEditForm = async (invoice) => {
    if ((invoice.rawStatus || invoice.status) !== 'POSTED' || Number(invoice.amountReceived) > 0) {
      showToast('Only unpaid invoices can be edited.', 'error');
      return;
    }
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/invoice/${encodeURIComponent(getInvoiceId(invoice))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load invoice details.');
      }
      const details = response.data.data;
      setEditingInvoice(details);
      setForm({
        ...EMPTY_FORM,
        customerId: getId(details.customerId),
        financialYearId: getId(details.financialYearId),
        invoiceDate: dateInputValue(details.invoiceDate),
        dueDate: dateInputValue(details.dueDate),
        reference: details.reference || '',
        discountTotal: String(details.discountTotal ?? 0),
        roundOff: String(details.roundOff ?? 0),
        notes: details.notes || '',
        lineItems: (details.lineItems || []).map((line) => ({
          productId: getId(line.productId),
          description: line.description || line.itemDescription || '',
          quantity: String(line.quantity ?? 1),
          rate: String(line.rate ?? 0),
          taxRateId: getId(line.taxRateId),
          productName: line.productName || line.description || '',
        })),
      });
      setFormError('');
      setIsFormOpen(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load invoice for editing.'), 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleLineChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      lineItems: previous.lineItems.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (field !== 'productId') return { ...line, [field]: value };
        const product = products.find((item) => getId(item) === value);
        const taxId = getId(product?.taxRateId) || getId(taxRates.find((tax) => (
          Number(tax.ratePercent) === Number(product?.gstRate)
        )));
        return {
          ...line,
          productId: value,
          description: product?.description || product?.name || '',
          rate: String(product?.saleRate ?? 0),
          taxRateId: taxId,
        };
      }),
    }));
  };

  const addLine = () => setForm((previous) => ({
    ...previous,
    lineItems: [...previous.lineItems, { ...EMPTY_LINE }],
  }));

  const removeLine = (index) => setForm((previous) => ({
    ...previous,
    lineItems: previous.lineItems.length <= 1
      ? previous.lineItems
      : previous.lineItems.filter((_, lineIndex) => lineIndex !== index),
  }));

  const buildLineItems = () => form.lineItems.map((line, index) => ({
    productId: line.productId || null,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    rate: roundMoney(line.rate),
    discount: 0,
    taxableAmount: totals.lineItems[index].taxableAmount,
    taxRateId: line.taxRateId || null,
    taxAmount: totals.lineItems[index].taxAmount,
    totalAmount: totals.lineItems[index].totalAmount,
  }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId || !form.financialYearId) {
      setFormError('Select a company, branch, and open financial year.');
      return;
    }
    if (!customers.some((customer) => getId(customer) === form.customerId)) {
      setFormError('Select an active customer for this branch.');
      return;
    }
    if (!form.invoiceDate || (selectedYear && (
      form.invoiceDate < dateInputValue(selectedYear.startDate) ||
      form.invoiceDate > dateInputValue(selectedYear.endDate)
    ))) {
      setFormError('Invoice date must fall within the selected financial year.');
      return;
    }
    if (form.dueDate && form.dueDate < form.invoiceDate) {
      setFormError('Due date cannot be earlier than invoice date.');
      return;
    }
    if (form.lineItems.some((line) => (
      !line.description.trim() ||
      !Number.isFinite(Number(line.quantity)) ||
      Number(line.quantity) <= 0 ||
      !Number.isFinite(Number(line.rate)) ||
      Number(line.rate) < 0
    ))) {
      setFormError('Enter a description, valid quantity, and valid rate for every item.');
      return;
    }
    if (totals.discountTotal > totals.subTotal) {
      setFormError('Discount cannot exceed subtotal.');
      return;
    }
    if (totals.subTotal - totals.discountTotal + totals.roundOff < 0) {
      setFormError('Discount and round off cannot make the sales revenue negative.');
      return;
    }
    if (totals.grandTotal <= 0) {
      setFormError('Invoice total must be greater than zero.');
      return;
    }

    const payload = {
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || null,
      reference: form.reference.trim(),
      lineItems: buildLineItems(),
      subTotal: totals.subTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      roundOff: totals.roundOff,
      notes: form.notes.trim(),
    };
    if (!editingInvoice) {
      Object.assign(payload, {
        companyId,
        branchId,
        financialYearId: form.financialYearId,
        customerId: form.customerId,
      });
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingInvoice
        ? await api.put(`/api/invoice/${encodeURIComponent(getInvoiceId(editingInvoice))}`, payload)
        : await api.post('/api/invoice', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || `Invoice was not ${editingInvoice ? 'updated' : 'created'}.`);
      }
      const result = response.data.data;
      showToast(
        editingInvoice
          ? `Invoice ${editingInvoice.invoiceNumber} updated.`
          : `Sales invoice ${result.invoiceNumber || ''} created successfully.`,
        'success'
      );
      setIsFormOpen(false);
      setEditingInvoice(null);
      setPage(1);
      setIsLoadingInvoices(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save sales invoice.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleView = async (invoice) => {
    setViewingInvoice(invoice);
    setDetailError('');
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/invoice/${encodeURIComponent(getInvoiceId(invoice))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load invoice details.');
      }
      setViewingInvoice(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load invoice details.');
      setDetailError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDownload = async (invoice) => {
    try {
      const response = await api.get(`/api/invoice/${encodeURIComponent(getInvoiceId(invoice))}/pdf`, {
        responseType: 'blob',
      });
      const fileUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${invoice.invoiceNumber || 'sales-invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not download invoice PDF.'), 'error');
    }
  };

  const openPaymentForm = (invoice) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = financialYears.find((year) => (
      today >= dateInputValue(year.startDate) && today <= dateInputValue(year.endDate)
    )) || financialYears[0];
    setPaymentTarget(invoice);
    setPaymentAmount(String(roundMoney(invoice.balanceDue)));
    setPaymentAccountId(getId(paymentAccounts[0]));
    setPaymentDate(today);
    setPaymentFinancialYearId(getId(currentYear));
    setPaymentError('');
  };

  const closePaymentForm = () => {
    if (isRecordingPayment) return;
    setPaymentTarget(null);
    setPaymentError('');
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    const amount = roundMoney(paymentAmount);
    const balanceDue = Number(paymentTarget?.balanceDue) || 0;
    if (!paymentTarget || !receivingAccount) {
      setPaymentError('Select a bank or cash account where the customer payment was received.');
      return;
    }
    if (amount <= 0 || amount - balanceDue > 0.01) {
      setPaymentError('Payment must be greater than zero and cannot exceed the invoice balance due.');
      return;
    }
    if (!paymentYear || paymentDate < dateInputValue(paymentYear.startDate) ||
      paymentDate > dateInputValue(paymentYear.endDate)) {
      setPaymentError('Payment date must fall within an open financial year.');
      return;
    }

    setIsRecordingPayment(true);
    setPaymentError('');
    try {
      const response = await api.post('/api/payment/receive', {
        companyId,
        branchId,
        financialYearId: paymentFinancialYearId,
        customerId: getId(paymentTarget.customerId),
        paymentDate,
        mode: getPaymentMode(receivingAccount),
        bankAccountId: getId(receivingAccount),
        totalAmount: amount,
        allocations: [{
          invoiceId: getInvoiceId(paymentTarget),
          allocatedAmount: amount,
        }],
        notes: '',
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Payment was not recorded.');
      }
      showToast(`Receipt of ${formatCurrency(amount)} recorded for ${paymentTarget.invoiceNumber}.`, 'success');
      setPaymentTarget(null);
      setPage(1);
      setIsLoadingInvoices(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record customer payment.');
      setPaymentError(message);
      showToast(message, 'error');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelTarget) return;
    setIsSaving(true);
    try {
      const response = await api.delete(`/api/invoice/${encodeURIComponent(getInvoiceId(cancelTarget))}`);
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Invoice was not cancelled.');
      }
      showToast(`Invoice ${cancelTarget.invoiceNumber} cancelled.`, 'success');
      setCancelTarget(null);
      setPage(1);
      setIsLoadingInvoices(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not cancel invoice.');
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingReferenceData(Boolean(companyId && branchId));
    setIsLoadingYears(Boolean(branchId));
    setIsLoadingInvoices(Boolean(companyId && branchId));
    setReloadKey((previous) => previous + 1);
  };

  const visibleFrom = pagination.total ? ((page - 1) * pagination.limit) + 1 : 0;
  const visibleTo = Math.min(page * pagination.limit, pagination.total);

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <FileText size={13} className="text-cyan-200" />
              Sales &amp; Receivables
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Sales Invoices</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Create invoices, track customer balances, record receipts, and download invoice PDFs.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><Building2 size={14} className="text-cyan-200" />{companyLabel}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><CalendarDays size={14} className="text-cyan-200" />{branchLabel}</span>
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
            Create Sales Invoice
          </Button>
        </div>
      </header>

      {(companies.length > 1 || branches.length > 1) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {companies.length > 1 && (
            <div>
              <label htmlFor="invoice-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <select id="invoice-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="">Select a company</option>
                {companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName || 'Unnamed Company'}</option>)}
              </select>
            </div>
          )}
          {branches.length > 1 && (
            <div>
              <label htmlFor="invoice-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <select id="invoice-branch-select" value={branchId} disabled={!companyId || isLoadingBranches} onChange={(event) => changeBranch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select a branch</option>
                {branches
                  .filter((branch) => !userBranchId || canSelectAllBranches || getId(branch) === userBranchId)
                  .map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}
              </select>
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
          { label: 'Invoices in this view', value: pagination.total, icon: FileText, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Received on this page', value: formatCurrency(receivedTotal), icon: CircleDollarSign, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Outstanding on this page', value: formatCurrency(outstandingTotal), icon: CircleDollarSign, style: 'bg-amber-50 text-amber-700' },
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
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-semibold text-slate-900">Sales invoice register</h2><p className="mt-0.5 text-xs text-slate-500">Search invoices and review customer payment balances.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search invoice or reference..." aria-label="Search sales invoices" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56" />
              </div>
              <select value={statusFilter} onChange={(event) => setFilter(setStatusFilter, event.target.value)} aria-label="Filter by invoice status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="all">All statuses</option>
                {INVOICE_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
              <select value={customerFilter} onChange={(event) => setFilter(setCustomerFilter, event.target.value)} aria-label="Filter by customer" className="max-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="all">All customers</option>
                {customers.map((customer) => <option key={getId(customer)} value={getId(customer)}>{customer.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input id="invoice-filter-from" label="From" type="date" value={fromDate} onChange={(event) => setFilter(setFromDate, event.target.value)} containerClassName="w-full sm:w-44" />
            <Input id="invoice-filter-to" label="To" type="date" value={toDate} onChange={(event) => setFilter(setToDate, event.target.value)} containerClassName="w-full sm:w-44" />
          </div>
        </div>

        {isLoading || isLoadingInvoices ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading sales invoices...</div>
        ) : !companyId || !branchId ? (
          <div className="p-8 text-center text-sm text-slate-500">Select a company and branch to view sales invoices.</div>
        ) : !invoices.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><FileText size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No sales invoices yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Create a customer invoice to record sales and track receivables.</p>
            <Button type="button" leftIcon={Plus} onClick={openCreateForm} isDisabled={!financialYears.length || !customers.length} className="mt-4">Create first invoice</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Invoice / customer</th>
                  <th className="px-5 py-3 font-semibold">Invoice date</th>
                  <th className="px-5 py-3 font-semibold">Due date</th>
                  <th className="px-5 py-3 font-semibold">Grand total</th>
                  <th className="px-5 py-3 font-semibold">Received</th>
                  <th className="px-5 py-3 font-semibold">Balance due</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => {
                  const rawStatus = invoice.rawStatus || invoice.status;
                  const unpaid = ['POSTED', 'PARTIALLY_PAID'].includes(rawStatus) && Number(invoice.balanceDue) > 0.01;
                  const editable = rawStatus === 'POSTED' && Number(invoice.amountReceived) <= 0;
                  const cancellable = unpaid && Number(invoice.amountReceived) <= 0;
                  return (
                    <tr key={getInvoiceId(invoice)} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-900">{invoice.invoiceNumber || '—'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{invoice.customerName || 'Customer unavailable'}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(invoice.dueDate)}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(invoice.grandTotal)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatCurrency(invoice.amountReceived)}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(invoice.balanceDue)}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(invoice)}`}>{statusLabel(invoice)}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => handleView(invoice)} aria-label={`View invoice ${invoice.invoiceNumber}`} title="View invoice" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          <button type="button" onClick={() => handleDownload(invoice)} aria-label={`Download invoice ${invoice.invoiceNumber}`} title="Download PDF" className="rounded-lg p-2 text-slate-500 transition hover:bg-cyan-50 hover:text-cyan-700"><Download size={15} /></button>
                          {unpaid && <button type="button" onClick={() => openPaymentForm(invoice)} aria-label={`Record receipt for invoice ${invoice.invoiceNumber}`} title="Record customer receipt" className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"><CircleDollarSign size={15} /></button>}
                          {editable && <button type="button" onClick={() => openEditForm(invoice)} aria-label={`Edit invoice ${invoice.invoiceNumber}`} title="Edit unpaid invoice" className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"><Pencil size={15} /></button>}
                          {cancellable && <button type="button" onClick={() => setCancelTarget(invoice)} aria-label={`Cancel invoice ${invoice.invoiceNumber}`} title="Cancel invoice" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <span>{visibleFrom}–{visibleTo} of {pagination.total} invoices</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => Math.max(current - 1, 1)); setIsLoadingInvoices(true); }} isDisabled={page <= 1 || isLoadingInvoices}>Previous</Button>
            <span>Page {page} of {Math.max(totalPages, 1)}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => current + 1); setIsLoadingInvoices(true); }} isDisabled={page >= totalPages || isLoadingInvoices}>Next</Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingInvoice ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
        subtitle={editingInvoice ? `Update unpaid invoice ${editingInvoice.invoiceNumber}.` : 'Create a customer invoice with product and tax details.'}
        size="xl"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button type="submit" form="sales-invoice-form" leftIcon={editingInvoice ? Pencil : Plus} isLoading={isSaving} isDisabled={isLoading || !financialYears.length || !customers.length}>
              {editingInvoice ? 'Save changes' : 'Create invoice'}
            </Button>
          </>
        )}
      >
        <form id="sales-invoice-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          {(!financialYears.length || !customers.length) && !isLoading && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {!financialYears.length ? 'An open financial year is required. ' : ''}
              {!customers.length ? 'An active customer for this branch is required.' : ''}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="sales-invoice-customer" className="mb-1 block text-xs font-medium text-slate-700">Customer</label>
              <select id="sales-invoice-customer" value={form.customerId} onChange={(event) => setForm((previous) => ({ ...previous, customerId: event.target.value }))} disabled={isSaving || Boolean(editingInvoice) || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" required>
                <option value="">Select customer</option>
                {form.customerId && !customers.some((customer) => getId(customer) === form.customerId) && <option value={form.customerId}>{editingInvoice?.customerName || 'Existing customer'}</option>}
                {customers.map((customer) => <option key={getId(customer)} value={getId(customer)}>{customer.name}{customer.gstin ? ` · ${customer.gstin}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sales-invoice-year" className="mb-1 block text-xs font-medium text-slate-700">Financial year</label>
              <select id="sales-invoice-year" value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} disabled={isSaving || Boolean(editingInvoice) || isLoadingYears} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" required>
                <option value="">Select open financial year</option>
                {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
              </select>
            </div>
            <Input id="sales-invoice-date" label="Invoice date" type="date" value={form.invoiceDate} onChange={(event) => setForm((previous) => ({ ...previous, invoiceDate: event.target.value }))} isDisabled={isSaving} required />
            <Input id="sales-invoice-due-date" label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))} isDisabled={isSaving} />
            <Input id="sales-invoice-reference" label="Reference" value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))} isDisabled={isSaving} maxLength={200} placeholder="Optional order / reference number" />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div><h3 className="text-xs font-semibold text-slate-800">Invoice items</h3><p className="mt-0.5 text-[10px] text-slate-500">Product selection fills the sales rate and default tax where available.</p></div>
              <Button type="button" variant="outline" size="sm" leftIcon={Plus} onClick={addLine} isDisabled={isSaving}>Add item</Button>
            </div>
            <div className="space-y-3 p-3">
              {form.lineItems.map((line, index) => {
                const lineAmount = totals.lineItems[index]?.taxableAmount || 0;
                const lineTax = totals.lineItems[index]?.taxAmount || 0;
                const taxRate = taxRateById.get(line.taxRateId) || 0;
                return (
                  <div key={`invoice-line-${index}`} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1.7fr_1.2fr_0.7fr_0.9fr_1.1fr_1fr_auto] lg:items-end">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label htmlFor={`sales-invoice-product-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Product / service</label>
                      <select id={`sales-invoice-product-${index}`} value={line.productId} onChange={(event) => handleLineChange(index, 'productId', event.target.value)} disabled={isSaving || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Custom invoice item</option>
                        {line.productId && !products.some((product) => getId(product) === line.productId) && <option value={line.productId}>{line.productName || line.description || 'Existing product'}</option>}
                        {products.map((product) => <option key={getId(product)} value={getId(product)}>{product.name}{product.code ? ` (${product.code})` : ''}</option>)}
                      </select>
                    </div>
                    <Input id={`sales-invoice-description-${index}`} label="Description" value={line.description} onChange={(event) => handleLineChange(index, 'description', event.target.value)} isDisabled={isSaving} required maxLength={500} />
                    <Input id={`sales-invoice-quantity-${index}`} label="Quantity" type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => handleLineChange(index, 'quantity', event.target.value)} isDisabled={isSaving} required />
                    <Input id={`sales-invoice-rate-${index}`} label="Rate (₹)" type="number" min="0" step="0.01" value={line.rate} onChange={(event) => handleLineChange(index, 'rate', event.target.value)} isDisabled={isSaving} required />
                    <div>
                      <label htmlFor={`sales-invoice-tax-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Tax rate</label>
                      <select id={`sales-invoice-tax-${index}`} value={line.taxRateId} onChange={(event) => handleLineChange(index, 'taxRateId', event.target.value)} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">No tax</option>
                        {taxRates.map((tax) => <option key={getId(tax)} value={getId(tax)}>{tax.name} ({tax.ratePercent}%)</option>)}
                      </select>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-slate-500">Line total</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{formatCurrency(lineAmount + lineTax)}</p>
                      <p className="text-[10px] text-slate-400">{formatCurrency(lineTax)} tax · {taxRate}%</p>
                    </div>
                    <button type="button" onClick={() => removeLine(index)} disabled={isSaving || form.lineItems.length <= 1} aria-label="Remove item" title="Remove item" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><XCircle size={15} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input id="sales-invoice-discount" label="Invoice discount (₹)" type="number" min="0" step="0.01" value={form.discountTotal} onChange={(event) => setForm((previous) => ({ ...previous, discountTotal: event.target.value }))} isDisabled={isSaving} />
            <Input id="sales-invoice-round-off" label="Round off (₹)" type="number" step="0.01" value={form.roundOff} onChange={(event) => setForm((previous) => ({ ...previous, roundOff: event.target.value }))} isDisabled={isSaving} />
            {[
              ['Subtotal', totals.subTotal],
              ['Tax total', totals.taxTotal],
              ['Grand total', totals.grandTotal],
            ].map(([label, amount]) => (
              <div key={label} className={`rounded-xl border p-3 ${label === 'Grand total' ? 'border-[#068DCB]/20 bg-[#edf4f8]' : 'border-slate-200 bg-white'}`}>
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(amount)}</p>
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="sales-invoice-notes" className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
            <textarea id="sales-invoice-notes" rows={2} maxLength={5000} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} disabled={isSaving} placeholder="Optional notes for this invoice" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(paymentTarget)}
        onClose={closePaymentForm}
        title="Record customer receipt"
        subtitle={paymentTarget ? `${paymentTarget.invoiceNumber} · balance due ${formatCurrency(paymentTarget.balanceDue)}` : ''}
        size="lg"
        closeOnBackdrop={!isRecordingPayment}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closePaymentForm} isDisabled={isRecordingPayment}>Cancel</Button>
            <Button type="submit" form="sales-receipt-form" leftIcon={Send} isLoading={isRecordingPayment} isDisabled={!paymentAccounts.length || !financialYears.length}>
              Record receipt
            </Button>
          </>
        )}
      >
        <form id="sales-receipt-form" onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{paymentError}</div>}
          {!paymentAccounts.length && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Create an active bank or cash account before recording customer receipts.</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sales-receipt-account" className="mb-1 block text-xs font-medium text-slate-700">Received in</label>
              <select id="sales-receipt-account" value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)} disabled={isRecordingPayment} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select bank / cash account</option>
                {paymentAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}
              </select>
            </div>
            <Input id="sales-receipt-amount" label="Received amount (₹)" type="number" min="0.01" max={paymentTarget?.balanceDue} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} isDisabled={isRecordingPayment} required />
            <Input id="sales-receipt-date" label="Receipt date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} isDisabled={isRecordingPayment} required />
            <div>
              <label htmlFor="sales-receipt-year" className="mb-1 block text-xs font-medium text-slate-700">Financial year</label>
              <select id="sales-receipt-year" value={paymentFinancialYearId} onChange={(event) => setPaymentFinancialYearId(event.target.value)} disabled={isRecordingPayment} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select open financial year</option>
                {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
              </select>
            </div>
          </div>
          <p className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-[11px] leading-5 text-cyan-900">
            The receipt is allocated to this invoice and updates its amount received and balance due.
          </p>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => { if (!isSaving) setCancelTarget(null); }}
        title="Cancel Sales Invoice"
        subtitle={cancelTarget?.invoiceNumber}
        size="sm"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)} isDisabled={isSaving}>Keep invoice</Button>
            <Button type="button" leftIcon={Trash2} onClick={handleCancelInvoice} isLoading={isSaving}>Cancel invoice</Button>
          </>
        )}
      >
        <p className="text-xs leading-5 text-slate-600">
          This will cancel the invoice and reverse its accounting entry. Paid or partially paid invoices cannot be cancelled.
        </p>
      </Modal>

      <Modal
        isOpen={Boolean(viewingInvoice)}
        onClose={() => { if (!isLoadingDetails) setViewingInvoice(null); }}
        title="Sales Invoice Details"
        subtitle={viewingInvoice?.invoiceNumber}
        size="xl"
        footer={viewingInvoice && (
          <>
            <Button type="button" variant="outline" leftIcon={Download} onClick={() => handleDownload(viewingInvoice)}>Download PDF</Button>
            {['POSTED', 'PARTIALLY_PAID'].includes(viewingInvoice.rawStatus || viewingInvoice.status) && Number(viewingInvoice.balanceDue) > 0.01 && (
              <Button type="button" leftIcon={CircleDollarSign} onClick={() => { const invoice = viewingInvoice; setViewingInvoice(null); openPaymentForm(invoice); }}>Record receipt</Button>
            )}
          </>
        )}
      >
        {viewingInvoice && (
          <div className="space-y-4">
            {isLoadingDetails && <p className="flex items-center gap-2 text-xs text-slate-500"><RotateCw size={14} className="animate-spin" />Loading invoice details...</p>}
            {detailError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Customer', viewingInvoice.customerName || '—'],
                ['Invoice date', formatDate(viewingInvoice.invoiceDate)],
                ['Due date', formatDate(viewingInvoice.dueDate)],
                ['Financial year', viewingInvoice.financialYearLabel || '—'],
                ['Status', statusLabel(viewingInvoice)],
                ['Reference', viewingInvoice.reference || '—'],
                ['Subtotal', formatCurrency(viewingInvoice.subTotal)],
                ['Discount', formatCurrency(viewingInvoice.discountTotal)],
                ['Tax total', formatCurrency(viewingInvoice.taxTotal)],
                ['Grand total', formatCurrency(viewingInvoice.grandTotal)],
                ['Amount received', formatCurrency(viewingInvoice.amountReceived)],
                ['Balance due', formatCurrency(viewingInvoice.balanceDue)],
                ['Journal entry', viewingInvoice.journalEntryId || '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
              ))}
            </div>
            {viewingInvoice.notes && <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><strong>Notes:</strong> {viewingInvoice.notes}</div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[600px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Rate</th><th className="px-4 py-2.5">Tax</th><th className="px-4 py-2.5 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingInvoice.lineItems || []).map((line, index) => (
                    <tr key={line._id || `${line.productId}-${index}`}>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{line.productName || line.description || 'Item'}{line.productCode && <span className="ml-1 text-[10px] text-slate-400">{line.productCode}</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{line.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatCurrency(line.rate)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatCurrency(line.taxAmount)}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">{formatCurrency(line.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};

export default SalesInvoicesManagementView;
