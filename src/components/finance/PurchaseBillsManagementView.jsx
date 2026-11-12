import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCw,
  Search,
  ShoppingCart,
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
  billNumber: '',
  supplierId: '',
  financialYearId: '',
  purchaseOrderId: '',
  billDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  discountTotal: '0',
  roundOff: '0',
  paymentOption: 'credit',
  paymentAccountId: '',
  notes: '',
  lineItems: [{ ...EMPTY_LINE }],
};

const STATUS_OPTIONS = [
  { value: 'POSTED', label: 'Posted' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

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

const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : Array.isArray(data?.details) ? data.details : [];
  const errorDetails = errors
    .map((item) => [item.field || item.path?.join?.('.'), item.message].filter(Boolean).join(': '))
    .filter(Boolean);
  return errorDetails.length
    ? [data?.message, ...errorDetails].filter(Boolean).join(' — ')
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

const billId = (bill) => getId(bill?.id || bill?._id);
const statusLabel = (status) => STATUS_OPTIONS.find((option) => option.value === status)?.label || status || 'Unknown';
const paymentModeForAccount = (account) => (
  ['Cash', 'Wallet'].includes(account?.accountType)
    ? 'CASH'
    : account?.accountType === 'UPI' ? 'UPI' : 'BANK_TRANSFER'
);
const paymentAccountTypes = new Set(['Savings', 'Current', 'Cash', 'Wallet', 'UPI']);

const statusStyle = (status) => {
  if (status === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIALLY_PAID') return 'bg-amber-50 text-amber-700';
  if (status === 'CANCELLED') return 'bg-rose-50 text-rose-700';
  return 'bg-cyan-50 text-[#045d86]';
};

export const PurchaseBillsManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingReferenceData, setIsLoadingReferenceData] = useState(false);
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [viewingBill, setViewingBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentFinancialYearId, setPaymentFinancialYearId] = useState('');
  const [immediatePaymentDate, setImmediatePaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [immediatePaymentFinancialYearId, setImmediatePaymentFinancialYearId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

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
          const onlyCompanyId = getId(availableCompanies[0]._id || availableCompanies[0].id);
          setCompanyId(onlyCompanyId);
          setIsLoadingBranches(true);
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for Purchase Bills.');
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
          return getId(availableBranches[0]?._id || availableBranches[0]?.id);
        });
        if (!availableBranches.length) {
          setLoadError('Create a branch before creating purchase bills.');
        }
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
    const supplierParams = new URLSearchParams({
      companyId,
      branchId,
      isActive: 'true',
      page: '1',
      limit: '100',
    });
    const productParams = new URLSearchParams({ companyId, page: '1', limit: '100' });
    const taxParams = new URLSearchParams({ companyId });
    const orderParams = new URLSearchParams({
      companyId,
      branchId,
      status: 'APPROVED',
      page: '1',
      limit: '100',
    });
    const bankAccountParams = new URLSearchParams({ companyId, branchId });
    Promise.allSettled([
      api.get(`/api/supplier?${supplierParams.toString()}`),
      api.get(`/api/product?${productParams.toString()}`),
      api.get(`/api/tax?${taxParams.toString()}`),
      api.get(`/api/purchase-order?${orderParams.toString()}`),
      api.get(`/api/bank-account?${bankAccountParams.toString()}`),
    ])
      .then((results) => {
        if (!active) return;
        const failures = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            failures.push(getErrorMessage(result.reason, `Could not load purchase bill setup data (${index + 1}).`));
          } else if (result.value.data?.success === false) {
            failures.push(result.value.data.message || `Could not load purchase bill setup data (${index + 1}).`);
          }
        });
        const [supplierResult, productResult, taxResult, orderResult, bankAccountResult] = results;
        if (supplierResult.status === 'fulfilled' && supplierResult.value.data?.success !== false) {
          setSuppliers(Array.isArray(supplierResult.value.data?.data?.items) ? supplierResult.value.data.data.items : []);
        }
        if (productResult.status === 'fulfilled' && productResult.value.data?.success !== false) {
          setProducts(Array.isArray(productResult.value.data?.data?.items)
            ? productResult.value.data.data.items.filter((product) => product.isActive !== false)
            : []);
        }
        if (taxResult.status === 'fulfilled' && taxResult.value.data?.success !== false) {
          setTaxRates(Array.isArray(taxResult.value.data?.data)
            ? taxResult.value.data.data.filter((tax) => tax.isActive !== false)
            : []);
        }
        if (orderResult.status === 'fulfilled' && orderResult.value.data?.success !== false) {
          const orderRecords = Array.isArray(orderResult.value.data?.data?.items) ? orderResult.value.data.data.items : [];
          setPurchaseOrders(orderRecords.filter((order) => (
            order.status === 'APPROVED' &&
            !order.isLinkedToPurchaseBill &&
            !order.financialYearIsLocked
          )));
        }
        if (bankAccountResult.status === 'fulfilled' && bankAccountResult.value.data?.success !== false) {
          const accountRecords = Array.isArray(bankAccountResult.value.data?.data)
            ? bankAccountResult.value.data.data
            : [];
          setBankAccounts(accountRecords.filter((account) => (
            account.isActive !== false && paymentAccountTypes.has(account.accountType)
          )));
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
          const today = new Date();
          const containingYear = openYears.find((year) => (
            today >= new Date(year.startDate) && today <= new Date(year.endDate)
          ));
          return { ...previous, financialYearId: getId(containingYear || openYears[0]) };
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
    if (supplierFilter !== 'all') params.set('supplierId', supplierFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (search.trim()) params.set('search', search.trim());
    api.get(`/api/purchase?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load purchase bills.');
        }
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: pagination.limit, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (!records.length && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setBills(records);
        setPagination(pageInfo);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load purchase bills.'));
      })
      .finally(() => {
        if (active) setIsLoadingBills(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, page, pagination.limit, statusFilter, supplierFilter, fromDate, toDate, search, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const selectedBranch = branches.find((branch) => getId(branch._id || branch.id) === branchId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = selectedBranch?.branchName || 'Select a branch';
  const selectedYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const paymentAccounts = bankAccounts.filter((account) => paymentAccountTypes.has(account.accountType));
  const selectedPaymentAccount = paymentAccounts.find((account) => getId(account) === form.paymentAccountId);
  const payingAccount = paymentAccounts.find((account) => getId(account) === paymentAccountId);
  const selectedImmediatePaymentYear = financialYears.find((year) => getId(year) === immediatePaymentFinancialYearId);
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingReferenceData || isLoadingYears;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const taxRateById = useMemo(() => new Map(
    taxRates.map((tax) => [getId(tax), Number(tax.ratePercent) || 0])
  ), [taxRates]);

  const totals = useMemo(() => {
    const lineItems = form.lineItems.map((line) => {
      const amount = roundMoney((Number(line.quantity) || 0) * (Number(line.rate) || 0));
      const rate = taxRateById.get(line.taxRateId) || 0;
      const taxAmount = roundMoney((amount * rate) / 100);
      return { amount, taxAmount, totalAmount: roundMoney(amount + taxAmount) };
    });
    const subTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.amount, 0));
    const taxTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.taxAmount, 0));
    const discountTotal = Math.max(0, roundMoney(form.discountTotal));
    const roundOff = roundMoney(form.roundOff);
    const grandTotal = roundMoney(subTotal - discountTotal + taxTotal + roundOff);
    return { lineItems, subTotal, taxTotal, discountTotal, roundOff, grandTotal };
  }, [form.lineItems, form.discountTotal, form.roundOff, taxRateById]);

  const payNowFundsInsufficient = form.paymentOption === 'pay_now' && (
    !selectedPaymentAccount ||
    !Number.isFinite(Number(selectedPaymentAccount.currentBalance)) ||
    Number(selectedPaymentAccount.currentBalance) + 0.01 < totals.grandTotal
  );
  const visibleBills = bills;
  const postedCount = bills.filter((bill) => bill.status === 'POSTED').length;
  const unpaidTotal = bills.reduce((sum, bill) => sum + (Number(bill.balanceDue) || 0), 0);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setFinancialYears([]);
    setSuppliers([]);
    setProducts([]);
    setTaxRates([]);
    setBankAccounts([]);
    setPurchaseOrders([]);
    setBills([]);
    setPage(1);
    setIsLoadingBranches(Boolean(nextCompanyId));
    setIsLoadingBills(Boolean(nextCompanyId));
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setFinancialYears([]);
    setSuppliers([]);
    setProducts([]);
    setTaxRates([]);
    setBankAccounts([]);
    setPurchaseOrders([]);
    setBills([]);
    setPage(1);
    setIsLoadingReferenceData(Boolean(nextBranchId));
    setIsLoadingYears(Boolean(nextBranchId));
    setIsLoadingBills(Boolean(nextBranchId));
    setLoadError('');
  };

  const setFilter = (setter, value) => {
    setter(value);
    setPage(1);
    setIsLoadingBills(Boolean(companyId && branchId));
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => (
      today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)
    )) || financialYears[0];
    setImmediatePaymentDate(today);
    setImmediatePaymentFinancialYearId(getId(year));
    setEditingBill(null);
    setForm({
      ...EMPTY_FORM,
      financialYearId: getId(year),
      paymentAccountId: getId(bankAccounts.find((account) => paymentAccountTypes.has(account.accountType))),
      billDate: today,
      lineItems: [{ ...EMPTY_LINE }],
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingBill(null);
    setFormError('');
  };

  const openEditForm = async (bill) => {
    if (bill.status !== 'POSTED') {
      showToast('Only posted, unpaid purchase bills can be edited.', 'error');
      return;
    }
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/purchase/${encodeURIComponent(billId(bill))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load bill details.');
      }
      const details = response.data.data;
      setEditingBill(details);
      setForm({
        ...EMPTY_FORM,
        billNumber: details.billNumber || '',
        supplierId: details.supplierId || '',
        financialYearId: details.financialYearId || '',
        purchaseOrderId: details.purchaseOrderId || '',
        billDate: dateInputValue(details.billDate),
        dueDate: dateInputValue(details.dueDate),
        discountTotal: String(details.discountTotal ?? 0),
        roundOff: String(details.roundOff ?? 0),
        paymentOption: 'credit',
        paymentAccountId: '',
        notes: details.notes || '',
        lineItems: (details.lineItems || []).map((line) => ({
          productId: getId(line.productId),
          description: line.itemDescription || line.description || '',
          quantity: String(line.quantity ?? 1),
          rate: String(line.rate ?? 0),
          taxRateId: getId(line.taxRateId),
          productName: line.productName || line.description || '',
        })),
      });
      setFormError('');
      setIsFormOpen(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load bill for editing.'), 'error');
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
        const linkedTaxId = getId(product?.taxRateId);
        const productTaxId = linkedTaxId || getId(taxRates.find((tax) => (
          Number(tax.ratePercent) === Number(product?.gstRate)
        )));
        return {
          ...line,
          productId: value,
          description: product?.description || product?.name || '',
          rate: String(product?.purchaseRate ?? 0),
          taxRateId: productTaxId,
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

  const selectPurchaseOrder = async (purchaseOrderId) => {
    setForm((previous) => ({ ...previous, purchaseOrderId }));
    if (!purchaseOrderId) return;
    try {
      const response = await api.get(`/api/purchase-order/${encodeURIComponent(purchaseOrderId)}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load purchase order.');
      }
      const order = response.data.data;
      if (order.status !== 'APPROVED' || order.isLinkedToPurchaseBill) {
        throw new Error('This purchase order is no longer available for billing.');
      }
      setForm((previous) => ({
        ...previous,
        supplierId: order.supplierId || previous.supplierId,
        financialYearId: order.financialYearId || previous.financialYearId,
        billDate: dateInputValue(order.poDate) || previous.billDate,
        lineItems: (order.lineItems || []).map((line) => ({
          productId: getId(line.productId),
          description: line.description || line.productName || '',
          quantity: String(line.quantity ?? 1),
          rate: String(line.rate ?? 0),
          taxRateId: getId(line.taxRateId),
          productName: line.productName || line.description || '',
        })),
      }));
      setFormError('');
    } catch (error) {
      setForm((previous) => ({ ...previous, purchaseOrderId: '' }));
      const message = getErrorMessage(error, 'Could not load selected purchase order.');
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId || !form.financialYearId) {
      setFormError('Select a company, branch, and open financial year.');
      return;
    }
    if (!form.billNumber.trim()) {
      setFormError('Enter the supplier bill number.');
      return;
    }
    if (!suppliers.some((supplier) => getId(supplier) === form.supplierId)) {
      setFormError('Select an active supplier for this branch.');
      return;
    }
    if (!form.billDate || (selectedYear && (
      form.billDate < dateInputValue(selectedYear.startDate) ||
      form.billDate > dateInputValue(selectedYear.endDate)
    ))) {
      setFormError('Bill date must fall within the selected financial year.');
      return;
    }
    if (form.dueDate && form.dueDate < form.billDate) {
      setFormError('Due date cannot be earlier than bill date.');
      return;
    }
    if (form.lineItems.some((line) => (
      !line.productId ||
      !Number.isFinite(Number(line.quantity)) ||
      Number(line.quantity) <= 0 ||
      !Number.isFinite(Number(line.rate)) ||
      Number(line.rate) < 0
    ))) {
      setFormError('Select a product and enter a valid quantity and rate for every item.');
      return;
    }
    if (totals.discountTotal > totals.subTotal) {
      setFormError('Discount cannot exceed the subtotal.');
      return;
    }
    if (totals.grandTotal <= 0) {
      setFormError('Bill total must be greater than zero.');
      return;
    }
    if (!editingBill && form.paymentOption === 'pay_now') {
      if (!selectedPaymentAccount) {
        setFormError('Select a bank or cash account for the immediate payment.');
        return;
      }
      if (!selectedImmediatePaymentYear ||
        immediatePaymentDate < dateInputValue(selectedImmediatePaymentYear.startDate) ||
        immediatePaymentDate > dateInputValue(selectedImmediatePaymentYear.endDate)) {
        setFormError('Payment date must fall within the selected open financial year.');
        return;
      }
      const availableBalance = Number(selectedPaymentAccount.currentBalance);
      if (!Number.isFinite(availableBalance)) {
        setFormError('Could not verify the selected account balance. Refresh the page and try again.');
        return;
      }
      if (availableBalance + 0.01 < totals.grandTotal) {
        setFormError(`Insufficient funds. ${selectedPaymentAccount.accountName} has ${formatCurrency(selectedPaymentAccount.currentBalance)} available.`);
        return;
      }
    }

    const lineItems = form.lineItems.map((line, index) => ({
      productId: line.productId,
      description: line.description.trim(),
      quantity: Number(line.quantity),
      rate: roundMoney(line.rate),
      amount: totals.lineItems[index].amount,
      taxRateId: line.taxRateId || null,
      taxAmount: totals.lineItems[index].taxAmount,
      totalAmount: totals.lineItems[index].totalAmount,
    }));
    const sharedPayload = {
      billDate: form.billDate,
      dueDate: form.dueDate || null,
      warehouseId: null,
      lineItems,
      subTotal: totals.subTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      roundOff: totals.roundOff,
      balanceDue: totals.grandTotal,
      notes: form.notes.trim(),
    };
    const payload = editingBill
      ? sharedPayload
      : {
        companyId,
        branchId,
        financialYearId: form.financialYearId,
        supplierId: form.supplierId,
        purchaseOrderId: form.purchaseOrderId || null,
        billNumber: form.billNumber.trim(),
        ...sharedPayload,
      };

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingBill
        ? await api.put(`/api/purchase/${encodeURIComponent(billId(editingBill))}`, payload)
        : await api.post('/api/purchase', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || `Purchase bill was not ${editingBill ? 'updated' : 'created'}.`);
      }
      const savedBill = response.data.data;
      if (!editingBill && form.paymentOption === 'pay_now') {
        try {
          const paymentResponse = await api.post('/api/pay-supplier/pay-supplier', {
            companyId,
            branchId,
            financialYearId: immediatePaymentFinancialYearId,
            supplierId: form.supplierId,
            paymentDate: immediatePaymentDate,
            mode: paymentModeForAccount(selectedPaymentAccount),
            bankAccountId: getId(selectedPaymentAccount),
            totalAmount: totals.grandTotal,
            allocations: [{
              purchaseId: billId(savedBill),
              allocatedAmount: totals.grandTotal,
            }],
          });
          if (paymentResponse.data?.success === false) {
            throw new Error(paymentResponse.data.message || 'Payment was not recorded.');
          }
          showToast(`Purchase bill ${form.billNumber.trim()} created and paid.`, 'success');
        } catch (paymentRequestError) {
          const paymentMessage = getErrorMessage(paymentRequestError, 'Payment could not be recorded.');
          showToast(`Purchase bill ${form.billNumber.trim()} was created, but payment failed and remains unpaid. ${paymentMessage}`, 'error');
        }
      } else {
        showToast(`Purchase bill ${form.billNumber.trim()} ${editingBill ? 'updated' : 'created'} on credit.`, 'success');
      }
      setIsFormOpen(false);
      setEditingBill(null);
      setPage(1);
      setIsLoadingBills(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save purchase bill.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openPaymentForm = (bill) => {
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = financialYears.find((year) => (
      today >= dateInputValue(year.startDate) && today <= dateInputValue(year.endDate)
    ));
    setPayingBill(bill);
    setPaymentAmount(String(roundMoney(bill.balanceDue)));
    setPaymentAccountId(getId(paymentAccounts[0]));
    setPaymentDate(today);
    setPaymentFinancialYearId(getId(currentYear || financialYears[0]));
    setPaymentError('');
  };

  const closePaymentForm = () => {
    if (isPaying) return;
    setPayingBill(null);
    setPaymentError('');
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    const amount = roundMoney(paymentAmount);
    const balanceDue = Number(payingBill?.balanceDue) || 0;
    const selectedYearForPayment = financialYears.find((year) => getId(year) === paymentFinancialYearId);
    if (!payingBill || !payingAccount) {
      setPaymentError('Select a bank or cash account.');
      return;
    }
    if (amount <= 0 || amount - balanceDue > 0.01) {
      setPaymentError('Payment must be greater than zero and cannot exceed the bill balance due.');
      return;
    }
    const availableBalance = Number(payingAccount.currentBalance);
    if (!Number.isFinite(availableBalance)) {
      setPaymentError('Could not verify the selected account balance. Refresh the page and try again.');
      return;
    }
    if (availableBalance + 0.01 < amount) {
      setPaymentError(`Insufficient funds. ${payingAccount.accountName} has ${formatCurrency(payingAccount.currentBalance)} available.`);
      return;
    }
    if (!selectedYearForPayment || paymentDate < dateInputValue(selectedYearForPayment.startDate) ||
      paymentDate > dateInputValue(selectedYearForPayment.endDate)) {
      setPaymentError('Select a payment date within an open financial year.');
      return;
    }

    setIsPaying(true);
    setPaymentError('');
    try {
      const response = await api.post('/api/pay-supplier/pay-supplier', {
        companyId,
        branchId,
        financialYearId: paymentFinancialYearId,
        supplierId: getId(payingBill.supplierId),
        paymentDate,
        mode: paymentModeForAccount(payingAccount),
        bankAccountId: getId(payingAccount),
        totalAmount: amount,
        allocations: [{
          purchaseId: billId(payingBill),
          allocatedAmount: amount,
        }],
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Payment was not recorded.');
      }
      showToast(`Payment of ${formatCurrency(amount)} recorded from ${payingAccount.accountName}.`, 'success');
      setPayingBill(null);
      setPage(1);
      setIsLoadingBills(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record supplier payment.');
      setPaymentError(message);
      showToast(message, 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handleView = async (bill) => {
    setViewingBill(bill);
    setDetailError('');
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/purchase/${encodeURIComponent(billId(bill))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load bill details.');
      }
      setViewingBill(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load bill details.');
      setDetailError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingReferenceData(Boolean(companyId && branchId));
    setIsLoadingYears(Boolean(branchId));
    setIsLoadingBills(Boolean(companyId && branchId));
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
              <ShoppingCart size={13} className="text-cyan-200" />
              Purchase
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Purchase Bills</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Record supplier invoices, link approved purchase orders, and track outstanding balances.
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
            Create Purchase Bill
          </Button>
        </div>
      </header>

      {(companies.length > 1 || branches.length > 1) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {companies.length > 1 && (
            <div>
              <label htmlFor="bill-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <select id="bill-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="">Select a company</option>
                {companies.map((company) => {
                  const id = getId(company._id || company.id);
                  return <option key={id} value={id}>{company.name || company.companyName || 'Unnamed Company'}</option>;
                })}
              </select>
            </div>
          )}
          {branches.length > 1 && (
            <div>
              <label htmlFor="bill-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <select id="bill-branch-select" value={branchId} disabled={!companyId || isLoadingBranches} onChange={(event) => changeBranch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select a branch</option>
                {branches
                  .filter((branch) => !userBranchId || canSelectAllBranches || getId(branch) === userBranchId)
                  .map((branch) => {
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
          <button type="button" onClick={retryLoad} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline"><RotateCw size={14} />Retry</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Bills in this view', value: pagination.total, icon: FileText, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Posted on this page', value: postedCount, icon: Clock3, style: 'bg-cyan-50 text-[#045d86]' },
          { label: 'Outstanding on this page', value: formatCurrency(unpaidTotal), icon: CircleDollarSign, style: 'bg-amber-50 text-amber-700' },
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
            <div><h2 className="text-sm font-semibold text-slate-900">Purchase bill register</h2><p className="mt-0.5 text-xs text-slate-500">Search supplier bills and review payment balances.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search bill or notes..." aria-label="Search purchase bills" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56" />
              </div>
              <select value={statusFilter} onChange={(event) => setFilter(setStatusFilter, event.target.value)} aria-label="Filter by bill status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={supplierFilter} onChange={(event) => setFilter(setSupplierFilter, event.target.value)} aria-label="Filter by supplier" className="max-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="all">All suppliers</option>
                {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input id="bill-filter-from" label="From" type="date" value={fromDate} onChange={(event) => setFilter(setFromDate, event.target.value)} containerClassName="w-full sm:w-44" />
            <Input id="bill-filter-to" label="To" type="date" value={toDate} onChange={(event) => setFilter(setToDate, event.target.value)} containerClassName="w-full sm:w-44" />
          </div>
        </div>

        {isLoading || isLoadingBills ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading purchase bills...</div>
        ) : !companyId || !branchId ? (
          <div className="p-8 text-center text-sm text-slate-500">Select a company and branch to view purchase bills.</div>
        ) : !bills.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><FileText size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No purchase bills yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Record a supplier bill, optionally linking it to an approved purchase order.</p>
            <Button type="button" leftIcon={Plus} onClick={openCreateForm} isDisabled={!financialYears.length || !suppliers.length || !products.length} className="mt-4">Create first bill</Button>
          </div>
        ) : !visibleBills.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No bills match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bill number / supplier</th>
                  <th className="px-5 py-3 font-semibold">Bill date</th>
                  <th className="px-5 py-3 font-semibold">Due date</th>
                  <th className="px-5 py-3 font-semibold">Purchase order</th>
                  <th className="px-5 py-3 font-semibold">Grand total</th>
                  <th className="px-5 py-3 font-semibold">Balance due</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBills.map((bill) => {
                  const id = billId(bill);
                  const canEdit = bill.status === 'POSTED';
                  return (
                    <tr key={id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-900">{bill.billNumber || '—'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{bill.supplierName || 'Supplier unavailable'}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(bill.billDate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(bill.dueDate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{bill.purchaseOrderId ? 'Linked' : '—'}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(bill.grandTotal)}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(bill.balanceDue)}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(bill.status)}`}>{statusLabel(bill.status)}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => handleView(bill)} aria-label={`View bill ${bill.billNumber}`} title="View bill" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          {['POSTED', 'PARTIALLY_PAID'].includes(bill.status) && Number(bill.balanceDue) > 0 && (
                            <button type="button" onClick={() => openPaymentForm(bill)} aria-label={`Record payment for bill ${bill.billNumber}`} title="Record payment" className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"><CircleDollarSign size={15} /></button>
                          )}
                          {canEdit && <button type="button" onClick={() => openEditForm(bill)} aria-label={`Edit bill ${bill.billNumber}`} title="Edit posted bill" className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"><Pencil size={15} /></button>}
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
          <span>{visibleFrom}–{visibleTo} of {pagination.total} bills · {postedCount} posted on this page</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => Math.max(current - 1, 1)); setIsLoadingBills(true); }} isDisabled={page <= 1 || isLoadingBills}>Previous</Button>
            <span>Page {page} of {Math.max(totalPages, 1)}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => current + 1); setIsLoadingBills(true); }} isDisabled={page >= totalPages || isLoadingBills}>Next</Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingBill ? 'Edit purchase bill' : 'Create purchase bill'}
        subtitle={editingBill ? `Update bill ${editingBill.billNumber}.` : 'Enter a supplier invoice and its line items.'}
        size="xl"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button type="submit" form="purchase-bill-form" leftIcon={editingBill ? Pencil : Plus} isLoading={isSaving} isDisabled={isLoading || !financialYears.length || !suppliers.length || !products.length || payNowFundsInsufficient}>
              {editingBill ? 'Save changes' : form.paymentOption === 'pay_now' ? 'Create and pay' : 'Create on credit'}
            </Button>
          </>
        )}
      >
        <form id="purchase-bill-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          {(!financialYears.length || !suppliers.length || !products.length) && !isLoading && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {!financialYears.length ? 'An open financial year is required. ' : ''}
              {!suppliers.length ? 'An active supplier for this branch is required. ' : ''}
              {!products.length ? 'At least one active product or service is required.' : ''}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="bill-number" label="Supplier bill number" value={form.billNumber} onChange={(event) => setForm((previous) => ({ ...previous, billNumber: event.target.value }))} isDisabled={isSaving || Boolean(editingBill)} placeholder="Enter invoice number" required maxLength={100} />
            <div>
              <label htmlFor="bill-supplier" className="mb-1 block text-xs font-medium text-slate-700">Supplier</label>
              <select id="bill-supplier" value={form.supplierId} onChange={(event) => setForm((previous) => ({ ...previous, supplierId: event.target.value, purchaseOrderId: '' }))} disabled={isSaving || Boolean(form.purchaseOrderId) || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}{supplier.gstin ? ` · ${supplier.gstin}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bill-financial-year" className="mb-1 block text-xs font-medium text-slate-700">Financial year</label>
              <select id="bill-financial-year" value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} disabled={isSaving || Boolean(editingBill) || Boolean(form.purchaseOrderId) || isLoadingYears} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select open financial year</option>
                {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
              </select>
            </div>
            <Input id="bill-date" label="Bill date" type="date" value={form.billDate} onChange={(event) => setForm((previous) => ({ ...previous, billDate: event.target.value }))} isDisabled={isSaving} required />
            <Input id="bill-due-date" label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))} isDisabled={isSaving} />
            <div>
              <label htmlFor="bill-po" className="mb-1 block text-xs font-medium text-slate-700">Approved purchase order</label>
              <select id="bill-po" value={form.purchaseOrderId} onChange={(event) => selectPurchaseOrder(event.target.value)} disabled={isSaving || Boolean(editingBill) || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">No linked order</option>
                {purchaseOrders
                  .filter((order) => !form.supplierId || order.supplierId === form.supplierId)
                  .map((order) => <option key={getId(order)} value={getId(order)}>{order.poNumber} · {formatCurrency(order.totalAmount)}</option>)}
              </select>
            </div>
          </div>

          {!editingBill && (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="bill-payment-option" className="mb-1 block text-xs font-medium text-slate-700">Payment option</label>
                <select
                  id="bill-payment-option"
                  value={form.paymentOption}
                  onChange={(event) => setForm((previous) => ({
                    ...previous,
                    paymentOption: event.target.value,
                    paymentAccountId: previous.paymentAccountId || getId(paymentAccounts[0]),
                  }))}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
                >
                  <option value="credit">Credit (pay later)</option>
                  <option value="pay_now">Pay now from bank / cash</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-500">Credit bills are allowed. Funds are checked only when a payment is submitted.</p>
              </div>
              {form.paymentOption === 'pay_now' && (
                <>
                <div>
                  <label htmlFor="bill-payment-account" className="mb-1 block text-xs font-medium text-slate-700">Pay from account</label>
                  <select
                    id="bill-payment-account"
                    value={form.paymentAccountId}
                    onChange={(event) => setForm((previous) => ({ ...previous, paymentAccountId: event.target.value }))}
                    disabled={isSaving || !paymentAccounts.length}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
                  >
                    <option value="">Select a bank or cash account</option>
                    {paymentAccounts.map((account) => (
                      <option key={getId(account)} value={getId(account)}>
                        {account.accountName} · {account.accountType}
                      </option>
                    ))}
                  </select>
                  {selectedPaymentAccount ? (
                    <p className={`mt-1 text-[10px] ${payNowFundsInsufficient ? 'text-rose-700' : 'text-slate-500'}`}>
                      Available: {formatCurrency(selectedPaymentAccount.currentBalance)}
                      {payNowFundsInsufficient ? ` · ${formatCurrency(totals.grandTotal)} required` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-rose-700">Add an active bank or cash account before paying now.</p>
                  )}
                  {payNowFundsInsufficient && selectedPaymentAccount && (
                    <p role="alert" className="mt-1 text-[10px] font-medium text-rose-700">Insufficient funds. Choose another account or create this bill on credit.</p>
                  )}
                </div>
                <Input id="bill-payment-date" label="Payment date" type="date" value={immediatePaymentDate} onChange={(event) => setImmediatePaymentDate(event.target.value)} isDisabled={isSaving} required />
                <div>
                  <label htmlFor="bill-payment-year" className="mb-1 block text-xs font-medium text-slate-700">Payment financial year</label>
                  <select id="bill-payment-year" value={immediatePaymentFinancialYearId} onChange={(event) => setImmediatePaymentFinancialYearId(event.target.value)} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                    <option value="">Select open financial year</option>
                    {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
                  </select>
                </div>
                </>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div><h3 className="text-xs font-semibold text-slate-800">Bill items</h3><p className="mt-0.5 text-[10px] text-slate-500">Taxes are calculated from the selected Tax Master rate.</p></div>
              <Button type="button" variant="outline" size="sm" leftIcon={Plus} onClick={addLine} isDisabled={isSaving || Boolean(form.purchaseOrderId)}>Add item</Button>
            </div>
            <div className="space-y-3 p-3">
              {form.lineItems.map((line, index) => {
                const lineAmount = totals.lineItems[index]?.amount || 0;
                const lineTax = totals.lineItems[index]?.taxAmount || 0;
                const taxRate = taxRateById.get(line.taxRateId) || 0;
                return (
                  <div key={`bill-line-${index}`} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_0.7fr_0.9fr_1.1fr_1fr_auto] lg:items-end">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label htmlFor={`bill-product-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Product / service</label>
                      <select id={`bill-product-${index}`} value={line.productId} onChange={(event) => handleLineChange(index, 'productId', event.target.value)} disabled={isSaving || Boolean(form.purchaseOrderId) || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select product</option>
                        {line.productId && !products.some((product) => getId(product) === line.productId) && <option value={line.productId}>{line.productName || line.description || 'Inactive product'}</option>}
                        {products.map((product) => <option key={getId(product)} value={getId(product)}>{product.name}{product.code ? ` (${product.code})` : ''}</option>)}
                      </select>
                    </div>
                    <Input id={`bill-description-${index}`} label="Description" value={line.description} onChange={(event) => handleLineChange(index, 'description', event.target.value)} isDisabled={isSaving || Boolean(form.purchaseOrderId)} />
                    <Input id={`bill-quantity-${index}`} label="Quantity" type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => handleLineChange(index, 'quantity', event.target.value)} isDisabled={isSaving || Boolean(form.purchaseOrderId)} required />
                    <Input id={`bill-rate-${index}`} label="Rate (₹)" type="number" min="0" step="0.01" value={line.rate} onChange={(event) => handleLineChange(index, 'rate', event.target.value)} isDisabled={isSaving || Boolean(form.purchaseOrderId)} required />
                    <div>
                      <label htmlFor={`bill-tax-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Tax rate</label>
                      <select id={`bill-tax-${index}`} value={line.taxRateId} onChange={(event) => handleLineChange(index, 'taxRateId', event.target.value)} disabled={isSaving || Boolean(form.purchaseOrderId)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">No tax</option>
                        {taxRates.map((tax) => <option key={getId(tax)} value={getId(tax)}>{tax.name} ({tax.ratePercent}%)</option>)}
                      </select>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-slate-500">Line amount</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{formatCurrency(lineAmount + lineTax)}</p>
                      <p className="text-[10px] text-slate-400">{formatCurrency(lineTax)} tax · {taxRate}%</p>
                    </div>
                    <button type="button" onClick={() => removeLine(index)} disabled={isSaving || Boolean(form.purchaseOrderId) || form.lineItems.length <= 1} aria-label="Remove item" title="Remove item" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><XCircle size={15} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input id="bill-discount" label="Discount (₹)" type="number" min="0" step="0.01" value={form.discountTotal} onChange={(event) => setForm((previous) => ({ ...previous, discountTotal: event.target.value }))} isDisabled={isSaving} />
            <Input id="bill-round-off" label="Round off (₹)" type="number" step="0.01" value={form.roundOff} onChange={(event) => setForm((previous) => ({ ...previous, roundOff: event.target.value }))} isDisabled={isSaving} />
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
            <label htmlFor="bill-notes" className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
            <textarea id="bill-notes" rows={2} maxLength={5000} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} disabled={isSaving} placeholder="Optional notes for this supplier bill" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(payingBill)}
        onClose={closePaymentForm}
        title="Record supplier payment"
        subtitle={payingBill ? `${payingBill.billNumber} · balance due ${formatCurrency(payingBill.balanceDue)}` : ''}
        size="lg"
        closeOnBackdrop={!isPaying}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closePaymentForm} isDisabled={isPaying}>Cancel</Button>
            <Button type="submit" form="supplier-payment-form" leftIcon={CircleDollarSign} isLoading={isPaying} isDisabled={!paymentAccounts.length || !financialYears.length}>
              Record payment
            </Button>
          </>
        )}
      >
        <form id="supplier-payment-form" onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{paymentError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-payment-account" className="mb-1 block text-xs font-medium text-slate-700">Bank / cash account</label>
              <select id="supplier-payment-account" value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)} disabled={isPaying} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select an account</option>
                {paymentAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.accountName} · {account.accountType}</option>)}
              </select>
              {payingAccount && (
                <p className={`mt-1 text-[10px] ${Number(payingAccount.currentBalance) + 0.01 < Number(paymentAmount) ? 'text-rose-700' : 'text-slate-500'}`}>
                  Available: {formatCurrency(payingAccount.currentBalance)}
                </p>
              )}
            </div>
            <Input id="supplier-payment-amount" label="Payment amount (₹)" type="number" min="0.01" max={payingBill?.balanceDue} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} isDisabled={isPaying} required />
            <Input id="supplier-payment-date" label="Payment date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} isDisabled={isPaying} required />
            <div>
              <label htmlFor="supplier-payment-year" className="mb-1 block text-xs font-medium text-slate-700">Financial year</label>
              <select id="supplier-payment-year" value={paymentFinancialYearId} onChange={(event) => setPaymentFinancialYearId(event.target.value)} disabled={isPaying} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select open financial year</option>
                {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
              </select>
            </div>
          </div>
          <p className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-[11px] leading-5 text-cyan-900">
            The selected account’s live ledger balance is checked before posting. The server repeats this check when recording the payment.
          </p>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingBill)} onClose={() => { if (!isLoadingDetails) setViewingBill(null); }} title="Purchase bill details" subtitle={viewingBill?.billNumber} size="xl">
        {viewingBill && (
          <div className="space-y-4">
            {isLoadingDetails && <p className="flex items-center gap-2 text-xs text-slate-500"><RotateCw size={14} className="animate-spin" />Loading bill details...</p>}
            {detailError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Supplier', viewingBill.supplierName || '—'],
                ['Bill date', formatDate(viewingBill.billDate)],
                ['Due date', formatDate(viewingBill.dueDate)],
                ['Financial year', viewingBill.financialYearLabel || '—'],
                ['Status', statusLabel(viewingBill.status)],
                ['Purchase order', viewingBill.purchaseOrderId || 'Not linked'],
                ['Subtotal', formatCurrency(viewingBill.subTotal)],
                ['Discount', formatCurrency(viewingBill.discountTotal)],
                ['Tax total', formatCurrency(viewingBill.taxTotal)],
                ['Grand total', formatCurrency(viewingBill.grandTotal)],
                ['Balance due', formatCurrency(viewingBill.balanceDue)],
                ['Journal entry', viewingBill.journalEntryId || '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
              ))}
            </div>
            {viewingBill.notes && <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><strong>Notes:</strong> {viewingBill.notes}</div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[600px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Rate</th><th className="px-4 py-2.5">Tax</th><th className="px-4 py-2.5 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingBill.lineItems || []).map((line, index) => (
                    <tr key={line._id || `${line.productId}-${index}`}>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{line.productName || line.description || 'Product'}{line.productCode && <span className="ml-1 text-[10px] text-slate-400">{line.productCode}</span>}</td>
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

export default PurchaseBillsManagementView;
