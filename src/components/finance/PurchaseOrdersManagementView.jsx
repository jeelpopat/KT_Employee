import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
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
  supplierId: '',
  financialYearId: '',
  poDate: new Date().toISOString().slice(0, 10),
  expectedDeliveryDate: '',
  reference: '',
  lineItems: [{ ...EMPTY_LINE }],
};

const STATUS_OPTIONS = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'REJECTED', label: 'Rejected' },
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
  if (errorDetails.length) {
    return [data?.message, ...errorDetails].filter(Boolean).join(' — ');
  }
  return data?.message || error?.message || fallback;
};

const getPurchaseOrderId = (purchaseOrder) => getId(purchaseOrder?.id || purchaseOrder?._id);

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

const statusLabel = (status) => STATUS_OPTIONS.find((option) => option.value === status)?.label || status || 'Unknown';

const statusStyle = (status) => {
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PENDING_APPROVAL') return 'bg-amber-50 text-amber-700';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

export const PurchaseOrdersManagementView = () => {
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
  const [purchaseOrders, setPurchaseOrders] = useState([]);
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
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState('');
  const [approvalAction, setApprovalAction] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');

  const activeCompanyAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeCompanyAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeCompanyAccess?.role || user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  const canApproveOrders = ['admin', 'super admin'].includes(role);

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
          setCompanyId(getId(availableCompanies[0]._id || availableCompanies[0].id));
          setIsLoadingBranches(true);
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for purchase order management.');
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
          if (current && availableBranches.some((branch) => getId(branch._id || branch.id) === current)) return current;
          if (userBranchId && availableBranches.some((branch) => getId(branch._id || branch.id) === userBranchId)) {
            return userBranchId;
          }
          return getId(availableBranches[0]?._id || availableBranches[0]?.id);
        });
        if (!availableBranches.length) {
          setSuppliers([]);
          setFinancialYears([]);
          setLoadError('Create a branch before creating purchase orders.');
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
    Promise.all([
      api.get(`/api/supplier?${supplierParams.toString()}`),
      api.get(`/api/product?${productParams.toString()}`),
      api.get(`/api/tax?${taxParams.toString()}`),
    ])
      .then(([supplierResponse, productResponse, taxResponse]) => {
        if (!active) return;
        [supplierResponse, productResponse, taxResponse].forEach((response) => {
          if (response.data?.success === false) {
            throw new Error(response.data.message || 'Could not load purchase order setup data.');
          }
        });
        setSuppliers(Array.isArray(supplierResponse.data?.data?.items) ? supplierResponse.data.data.items : []);
        setProducts(Array.isArray(productResponse.data?.data?.items)
          ? productResponse.data.data.items.filter((product) => product.isActive !== false)
          : []);
        setTaxRates(Array.isArray(taxResponse.data?.data)
          ? taxResponse.data.data.filter((tax) => tax.isActive !== false)
          : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load suppliers, products, or tax rates.'));
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
          const currentYear = openYears.find((year) => getId(year) === previous.financialYearId);
          if (currentYear) return previous;
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
    api.get(`/api/purchase-order?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load purchase orders.');
        }
        const data = response.data?.data || {};
        const records = Array.isArray(data.items) ? data.items : [];
        const pageInfo = data.pagination || { page, limit: pagination.limit, total: records.length };
        const lastPage = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
        if (records.length === 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setPurchaseOrders(records);
        setPagination(pageInfo);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load purchase orders.'));
      })
      .finally(() => {
        if (active) setIsLoadingOrders(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, branchId, page, pagination.limit, statusFilter, supplierFilter, fromDate, toDate, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const selectedBranch = branches.find((branch) => getId(branch._id || branch.id) === branchId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const branchLabel = selectedBranch?.branchName || 'Select a branch';
  const selectedYear = financialYears.find((year) => getId(year) === form.financialYearId);
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingReferenceData || isLoadingYears;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const taxRateById = useMemo(() => new Map(taxRates.map((tax) => [getId(tax), Number(tax.ratePercent) || 0])), [taxRates]);
  const totals = useMemo(() => {
    const subTotal = roundMoney(form.lineItems.reduce(
      (sum, line) => sum + roundMoney((Number(line.quantity) || 0) * (Number(line.rate) || 0)),
      0
    ));
    const taxAmount = roundMoney(form.lineItems.reduce((sum, line) => {
      const lineAmount = roundMoney((Number(line.quantity) || 0) * (Number(line.rate) || 0));
      const rate = taxRateById.get(line.taxRateId) || 0;
      return sum + (lineAmount * rate) / 100;
    }, 0));
    return { subTotal, taxAmount, totalAmount: roundMoney(subTotal + taxAmount) };
  }, [form.lineItems, taxRateById]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return purchaseOrders;
    return purchaseOrders.filter((order) => [
      order.poNumber,
      order.supplierName,
      order.reference,
      order.status,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [purchaseOrders, search]);

  const approvedCount = purchaseOrders.filter((order) => order.status === 'APPROVED').length;
  const pendingCount = purchaseOrders.filter((order) => order.status === 'PENDING_APPROVAL').length;
  const orderValue = purchaseOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setFinancialYears([]);
    setSuppliers([]);
    setProducts([]);
    setTaxRates([]);
    setPurchaseOrders([]);
    setPage(1);
    setIsLoadingBranches(Boolean(nextCompanyId));
    setLoadError('');
  };

  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setFinancialYears([]);
    setSuppliers([]);
    setProducts([]);
    setTaxRates([]);
    setPurchaseOrders([]);
    setPage(1);
    setIsLoadingReferenceData(Boolean(nextBranchId));
    setIsLoadingYears(Boolean(nextBranchId));
    setIsLoadingOrders(Boolean(nextBranchId));
    setLoadError('');
  };

  const setFilter = (setter, value) => {
    setter(value);
    setPage(1);
    setIsLoadingOrders(Boolean(companyId && branchId));
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => (
      today >= dateInputValue(item.startDate) && today <= dateInputValue(item.endDate)
    )) || financialYears[0];
    setForm({
      ...EMPTY_FORM,
      supplierId: '',
      financialYearId: getId(year),
      poDate: today,
      lineItems: [{ ...EMPTY_LINE }],
    });
    setEditingOrder(null);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingOrder(null);
    setFormError('');
  };

  const openEditForm = async (order) => {
    if (order.isLinkedToPurchaseBill) {
      showToast('This purchase order is linked to a purchase bill and cannot be changed.', 'error');
      return;
    }
    if (order.financialYearIsLocked) {
      showToast('This purchase order belongs to a locked financial year and cannot be edited.', 'error');
      return;
    }
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/purchase-order/${encodeURIComponent(getPurchaseOrderId(order))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load purchase order details.');
      }
      const details = response.data.data;
      if (details.isLinkedToPurchaseBill) {
        throw new Error('This purchase order is linked to a purchase bill and cannot be changed.');
      }
      if (details.financialYearIsLocked) {
        throw new Error('This purchase order belongs to a locked financial year and cannot be edited.');
      }
      setForm({
        supplierId: details.supplierId || '',
        financialYearId: details.financialYearId || '',
        poDate: dateInputValue(details.poDate),
        expectedDeliveryDate: dateInputValue(details.expectedDeliveryDate),
        reference: details.reference || '',
        lineItems: (details.lineItems || []).map((line) => ({
          productId: getId(line.productId),
          description: line.description || line.productName || '',
          quantity: String(line.quantity ?? 1),
          rate: String(line.rate ?? 0),
          taxRateId: getId(line.taxRateId),
          productName: line.productName || line.description || '',
        })),
      });
      setEditingOrder(details);
      setFormError('');
      setIsFormOpen(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load purchase order for editing.'), 'error');
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

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !branchId || !form.financialYearId) {
      setFormError('Select a company, branch, and open financial year.');
      return;
    }
    if (!suppliers.some((supplier) => getId(supplier) === form.supplierId)) {
      setFormError('Select an active supplier for this branch.');
      return;
    }
    if (!form.poDate || (selectedYear && (
      form.poDate < dateInputValue(selectedYear.startDate) ||
      form.poDate > dateInputValue(selectedYear.endDate)
    ))) {
      setFormError('Purchase order date must fall within the selected financial year.');
      return;
    }
    if (form.expectedDeliveryDate && form.expectedDeliveryDate < form.poDate) {
      setFormError('Expected delivery date cannot be earlier than the PO date.');
      return;
    }
    const validLines = form.lineItems.every((line) => (
      line.productId &&
      Number(line.quantity) > 0 &&
      Number.isFinite(Number(line.rate)) &&
      Number(line.rate) >= 0
    ));
    if (!validLines) {
      setFormError('Select a product and enter a valid quantity and rate for every line.');
      return;
    }
    if (totals.totalAmount <= 0) {
      setFormError('Purchase order total must be greater than zero.');
      return;
    }

    const orderData = {
      financialYearId: form.financialYearId,
      supplierId: form.supplierId,
      poDate: form.poDate,
      expectedDeliveryDate: form.expectedDeliveryDate || null,
      reference: form.reference.trim(),
      lineItems: form.lineItems.map((line) => ({
        productId: line.productId,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        rate: roundMoney(line.rate),
        amount: roundMoney(Number(line.quantity) * Number(line.rate)),
        taxRateId: line.taxRateId || null,
      })),
      subTotal: totals.subTotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
    };
    const payload = editingOrder
      ? orderData
      : { companyId, branchId, ...orderData };

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingOrder
        ? await api.put(`/api/purchase-order/${encodeURIComponent(getPurchaseOrderId(editingOrder))}`, payload)
        : await api.post('/api/purchase-order', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || `Purchase order was not ${editingOrder ? 'updated' : 'created'}.`);
      }
      const savedOrder = response.data.data;
      showToast(`Purchase order ${savedOrder.poNumber || ''} ${editingOrder ? 'updated' : 'created'} successfully.`, 'success');
      setIsFormOpen(false);
      setEditingOrder(null);
      setPage(1);
      setIsLoadingOrders(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create purchase order.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleView = async (order) => {
    setViewingOrder(order);
    setDetailError('');
    setIsLoadingDetails(true);
    try {
      const response = await api.get(`/api/purchase-order/${encodeURIComponent(getPurchaseOrderId(order))}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Could not load purchase order details.');
      }
      setViewingOrder(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load purchase order details.');
      setDetailError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const openApprovalAction = (order, action) => {
    setApprovalReason('');
    setApprovalAction({ order, action });
  };

  const confirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    const id = getPurchaseOrderId(deletingOrder);
    setDeletingOrderId(id);
    try {
      const response = await api.delete(`/api/purchase-order/${encodeURIComponent(id)}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Purchase order was not deleted.');
      }
      showToast(`Purchase order ${deletingOrder.poNumber || ''} deleted.`, 'success');
      setDeletingOrder(null);
      setIsLoadingOrders(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete purchase order.');
      showToast(message, 'error');
      setLoadError(message);
    } finally {
      setDeletingOrderId('');
    }
  };

  const confirmApprovalAction = async () => {
    if (!approvalAction) return;
    const { order, action } = approvalAction;
    if (action === 'reject' && !approvalReason.trim()) {
      showToast('Add a reason before rejecting this purchase order.', 'error');
      return;
    }
    const id = getPurchaseOrderId(order);
    setProcessingOrderId(id);
    setLoadError('');
    try {
      const response = await api.put(
        `/api/purchase-order/${encodeURIComponent(id)}/${action}`,
        approvalReason.trim() ? { reason: approvalReason.trim() } : {}
      );
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || `Purchase order was not ${action}ed.`);
      }
      showToast(action === 'approve' ? 'Purchase order approved.' : 'Purchase order rejected.', 'success');
      setApprovalAction(null);
      setIsLoadingOrders(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, `Could not ${action} this purchase order.`);
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setProcessingOrderId('');
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingBranches(Boolean(companyId));
    setIsLoadingReferenceData(Boolean(companyId && branchId));
    setIsLoadingYears(Boolean(branchId));
    setIsLoadingOrders(Boolean(companyId && branchId));
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
              <Truck size={13} className="text-cyan-200" />
              Purchase
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Purchase Orders</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Prepare supplier orders, review their approval status, and track delivery dates.
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
            Create Purchase Order
          </Button>
        </div>
      </header>

      {(companies.length > 1 || branches.length > 1) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:grid-cols-2">
          {companies.length > 1 && (
            <div>
              <label htmlFor="po-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
              <select id="po-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
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
              <label htmlFor="po-branch-select" className="mb-1.5 block text-xs font-medium text-slate-700">Branch</label>
              <select id="po-branch-select" value={branchId} disabled={!companyId || isLoadingBranches} onChange={(event) => changeBranch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select a branch</option>
                {branches
                  .filter((branch) => !userBranchId || canApproveOrders || getId(branch) === userBranchId)
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
          { label: 'Orders in this view', value: pagination.total, icon: FileText, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Pending approval', value: pendingCount, icon: Clock3, style: 'bg-amber-50 text-amber-700' },
          { label: 'Page order value', value: formatCurrency(orderValue), icon: CircleDollarSign, style: 'bg-cyan-50 text-[#045d86]' },
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
            <div><h2 className="text-sm font-semibold text-slate-900">Purchase order register</h2><p className="mt-0.5 text-xs text-slate-500">Review order totals, expected delivery, and approvals.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PO or supplier..." aria-label="Search purchase orders" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56" />
              </div>
              <select value={statusFilter} onChange={(event) => setFilter(setStatusFilter, event.target.value)} aria-label="Filter by purchase order status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={supplierFilter} onChange={(event) => setFilter(setSupplierFilter, event.target.value)} aria-label="Filter by supplier" className="max-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
                <option value="all">All suppliers</option>
                {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input id="po-filter-from" label="From" type="date" value={fromDate} onChange={(event) => setFilter(setFromDate, event.target.value)} containerClassName="w-full sm:w-44" />
            <Input id="po-filter-to" label="To" type="date" value={toDate} onChange={(event) => setFilter(setToDate, event.target.value)} containerClassName="w-full sm:w-44" />
          </div>
        </div>

        {isLoading || isLoadingOrders ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading purchase orders...</div>
        ) : !companyId || !branchId ? (
          <div className="p-8 text-center text-sm text-slate-500">Select a company and branch to view purchase orders.</div>
        ) : !purchaseOrders.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><FileText size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No purchase orders yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Create a purchase order using an active supplier and products from your catalogue.</p>
            <Button type="button" leftIcon={Plus} onClick={openCreateForm} isDisabled={isLoading} className="mt-4">Create first order</Button>
          </div>
        ) : !visibleOrders.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No orders match the current search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">PO number / supplier</th>
                  <th className="px-5 py-3 font-semibold">PO date</th>
                  <th className="px-5 py-3 font-semibold">Expected delivery</th>
                  <th className="px-5 py-3 font-semibold">Financial year</th>
                  <th className="px-5 py-3 font-semibold">Total amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => {
                  const orderId = getPurchaseOrderId(order);
                  const isPending = order.status === 'PENDING_APPROVAL';
                  const isProcessing = processingOrderId === orderId;
                  return (
                    <tr key={orderId} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-900">{order.poNumber || '—'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{order.supplierName || 'Supplier unavailable'}</p>
                        {order.reference && <p className="mt-1 text-[10px] text-slate-400">Ref: {order.reference}</p>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(order.poDate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatDate(order.expectedDeliveryDate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{order.financialYearLabel || '—'}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(order.status)}`}>
                          {isPending ? <Clock3 size={12} /> : order.status === 'APPROVED' ? <CheckCircle2 size={12} /> : null}
                          {statusLabel(order.status)}
                        </span>
                        {order.approvalRequired && <span className="mt-1 block text-[10px] text-slate-400">{order.autoApproved ? 'Auto-approved' : 'Approval required'}</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => handleView(order)} aria-label={`View ${order.poNumber}`} title="View order" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          {isPending && canApproveOrders && (
                            <>
                              <button type="button" onClick={() => openApprovalAction(order, 'approve')} disabled={isProcessing} aria-label={`Approve ${order.poNumber}`} title="Approve order" className="rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"><BadgeCheck size={15} /></button>
                              <button type="button" onClick={() => openApprovalAction(order, 'reject')} disabled={isProcessing} aria-label={`Reject ${order.poNumber}`} title="Reject order" className="rounded-lg p-2 text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"><XCircle size={15} /></button>
                            </>
                          )}
                          {!order.isLinkedToPurchaseBill && (
                            <>
                              {!order.financialYearIsLocked && (
                                <button type="button" onClick={() => openEditForm(order)} aria-label={`Edit ${order.poNumber}`} title="Edit order" className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"><Pencil size={15} /></button>
                              )}
                              <button type="button" onClick={() => setDeletingOrder(order)} aria-label={`Delete ${order.poNumber}`} title="Delete order" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                            </>
                          )}
                          {order.isLinkedToPurchaseBill && <span title="Linked to a purchase bill; editing and deletion are disabled." className="px-2 py-1 text-[10px] font-medium text-slate-400">Bill linked</span>}
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
          <span>{visibleFrom}–{visibleTo} of {pagination.total} orders · {approvedCount} approved on this page</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => Math.max(current - 1, 1)); setIsLoadingOrders(true); }} isDisabled={page <= 1 || isLoadingOrders}>Previous</Button>
            <span>Page {page} of {Math.max(totalPages, 1)}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { setPage((current) => current + 1); setIsLoadingOrders(true); }} isDisabled={page >= totalPages || isLoadingOrders}>Next</Button>
          </div>
        </div>
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingOrder ? 'Edit purchase order' : 'Create purchase order'} subtitle={editingOrder ? `Update ${editingOrder.poNumber} details and items.` : 'Select a supplier, financial year, and catalogue items.'} size="xl" closeOnBackdrop={!isSaving} footer={(
        <>
          <Button type="button" variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
          <Button
            type="submit"
            form="purchase-order-form"
            leftIcon={editingOrder ? Pencil : Plus}
            isLoading={isSaving}
            isDisabled={isLoading || !financialYears.length || !suppliers.length || !products.length}
          >
            {editingOrder ? 'Save Changes' : 'Create Purchase Order'}
          </Button>
        </>
      )}>
        <form id="purchase-order-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          {(!financialYears.length || !suppliers.length || !products.length) && !isLoading && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {!financialYears.length ? 'An open financial year is required. ' : ''}
              {!suppliers.length ? 'An active supplier for this branch is required. ' : ''}
              {!products.length ? 'At least one active product or service is required.' : ''}
              <span className="font-semibold">Complete the missing setup and retry.</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="po-supplier" className="mb-1 block text-xs font-medium text-slate-700">Supplier</label>
              <select id="po-supplier" value={form.supplierId} onChange={(event) => setForm((previous) => ({ ...previous, supplierId: event.target.value }))} disabled={isSaving || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select supplier</option>
                {editingOrder?.supplierId && !suppliers.some((supplier) => getId(supplier) === form.supplierId) && <option value={form.supplierId}>{editingOrder.supplierName || 'Inactive supplier'} (select an active supplier)</option>}
                {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}{supplier.gstin ? ` · ${supplier.gstin}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="po-financial-year" className="mb-1 block text-xs font-medium text-slate-700">Financial year</label>
              <select id="po-financial-year" value={form.financialYearId} onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))} disabled={isSaving || isLoadingYears} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                <option value="">Select open financial year</option>
                {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
              </select>
            </div>
            <Input id="po-date" label="PO date" type="date" value={form.poDate} onChange={(event) => setForm((previous) => ({ ...previous, poDate: event.target.value }))} isDisabled={isSaving} required />
            <Input id="po-delivery-date" label="Expected delivery date" type="date" value={form.expectedDeliveryDate} onChange={(event) => setForm((previous) => ({ ...previous, expectedDeliveryDate: event.target.value }))} isDisabled={isSaving} />
            <Input id="po-reference" label="Reference / quotation no." value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))} isDisabled={isSaving} placeholder="Optional" />
            <div className="flex items-end rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-800">
              <ShieldCheck size={14} className="mr-2 mt-0.5 shrink-0" />
              <span>High-value orders may require Admin approval before a purchase bill can be created.</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div><h3 className="text-xs font-semibold text-slate-800">Order items</h3><p className="mt-0.5 text-[10px] text-slate-500">Product purchase price and tax are used to calculate the order total.</p></div>
              <Button type="button" variant="outline" size="sm" leftIcon={Plus} onClick={addLine} isDisabled={isSaving}>Add item</Button>
            </div>
            <div className="space-y-3 p-3">
              {form.lineItems.map((line, index) => {
                const lineAmount = roundMoney((Number(line.quantity) || 0) * (Number(line.rate) || 0));
                const selectedTaxRate = taxRateById.get(line.taxRateId) || 0;
                return (
                  <div key={`po-line-${index}`} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_0.7fr_0.9fr_1.1fr_1fr_auto] lg:items-end">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label htmlFor={`po-product-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Product / service</label>
                      <select id={`po-product-${index}`} value={line.productId} onChange={(event) => handleLineChange(index, 'productId', event.target.value)} disabled={isSaving || isLoadingReferenceData} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">Select product</option>
                        {line.productId && !products.some((product) => getId(product) === line.productId) && <option value={line.productId}>{line.productName || line.description || 'Inactive product'}</option>}
                        {products.map((product) => <option key={getId(product)} value={getId(product)}>{product.name}{product.code ? ` (${product.code})` : ''}</option>)}
                      </select>
                    </div>
                    <Input id={`po-description-${index}`} label="Description" value={line.description} onChange={(event) => handleLineChange(index, 'description', event.target.value)} isDisabled={isSaving} />
                    <Input id={`po-quantity-${index}`} label="Quantity" type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => handleLineChange(index, 'quantity', event.target.value)} isDisabled={isSaving} required />
                    <Input id={`po-rate-${index}`} label="Rate (₹)" type="number" min="0" step="0.01" value={line.rate} onChange={(event) => handleLineChange(index, 'rate', event.target.value)} isDisabled={isSaving} required />
                    <div>
                      <label htmlFor={`po-tax-${index}`} className="mb-1 block text-xs font-medium text-slate-700">Tax rate</label>
                      <select id={`po-tax-${index}`} value={line.taxRateId} onChange={(event) => handleLineChange(index, 'taxRateId', event.target.value)} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                        <option value="">No tax</option>
                        {taxRates.map((tax) => <option key={getId(tax)} value={getId(tax)}>{tax.name} ({tax.ratePercent}%)</option>)}
                      </select>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-slate-500">Line amount</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800">{formatCurrency(lineAmount)}</p>
                      <p className="text-[10px] text-slate-400">Tax {selectedTaxRate}%</p>
                    </div>
                    <button type="button" onClick={() => removeLine(index)} disabled={isSaving || form.lineItems.length <= 1} aria-label="Remove item" title="Remove item" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Subtotal', totals.subTotal],
              ['Tax', totals.taxAmount],
              ['Order total', totals.totalAmount],
            ].map(([label, amount]) => (
              <div key={label} className={`rounded-xl border p-3 ${label === 'Order total' ? 'border-[#068DCB]/20 bg-[#edf4f8]' : 'border-slate-200 bg-white'}`}>
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(amount)}</p>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingOrder)} onClose={() => { if (!isLoadingDetails) setViewingOrder(null); }} title="Purchase order details" subtitle={viewingOrder?.poNumber} size="xl">
        {viewingOrder && (
          <div className="space-y-4">
            {isLoadingDetails && <p className="flex items-center gap-2 text-xs text-slate-500"><RotateCw size={14} className="animate-spin" />Loading order details...</p>}
            {detailError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Supplier', viewingOrder.supplierName || '—'],
                ['PO date', formatDate(viewingOrder.poDate)],
                ['Expected delivery', formatDate(viewingOrder.expectedDeliveryDate)],
                ['Financial year', viewingOrder.financialYearLabel || '—'],
                ['Status', statusLabel(viewingOrder.status)],
                ['Reference', viewingOrder.reference || '—'],
                ['Subtotal', formatCurrency(viewingOrder.subTotal)],
                ['Tax', formatCurrency(viewingOrder.taxAmount)],
                ['Total amount', formatCurrency(viewingOrder.totalAmount)],
                ['Approval required', viewingOrder.approvalRequired ? 'Yes' : 'No'],
                ['Purchase bill linked', viewingOrder.isLinkedToPurchaseBill ? 'Yes — order is locked' : 'No'],
                ['Approved at', formatDate(viewingOrder.approvedAt)],
                ['Rejected at', formatDate(viewingOrder.rejectedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
              ))}
            </div>
            {viewingOrder.rejectionReason && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><strong>Rejection reason:</strong> {viewingOrder.rejectionReason}</div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Rate</th><th className="px-4 py-2.5 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingOrder.lineItems || []).map((line, index) => (
                    <tr key={line._id || `${line.productId}-${index}`}>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{line.productName || line.description || 'Product'}{line.productCode && <span className="ml-1 text-[10px] text-slate-400">{line.productCode}</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{line.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatCurrency(line.rate)}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingOrder)}
        onClose={() => { if (!deletingOrderId) setDeletingOrder(null); }}
        title="Delete purchase order?"
        subtitle={deletingOrder?.poNumber}
        size="sm"
        closeOnBackdrop={!deletingOrderId}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setDeletingOrder(null)} isDisabled={Boolean(deletingOrderId)}>Cancel</Button>
            <Button type="button" variant="danger" leftIcon={Trash2} onClick={confirmDeleteOrder} isLoading={Boolean(deletingOrderId)}>Delete order</Button>
          </>
        )}
      >
        {deletingOrder && (
          <div className="space-y-3">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
              <p>This order will be removed from the purchase order register.</p>
              <p className="mt-1 font-semibold">{formatCurrency(deletingOrder.totalAmount)}</p>
            </div>
            <p className="text-xs text-slate-500">Orders linked to a purchase bill cannot be deleted. Deleted orders are retained in the system and cannot be restored from this screen.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(approvalAction)}
        onClose={() => { if (!processingOrderId) setApprovalAction(null); }}
        title={approvalAction?.action === 'approve' ? 'Approve purchase order?' : 'Reject purchase order?'}
        subtitle={approvalAction?.order?.poNumber}
        size="sm"
        closeOnBackdrop={!processingOrderId}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setApprovalAction(null)} isDisabled={Boolean(processingOrderId)}>Cancel</Button>
            <Button
              type="button"
              variant={approvalAction?.action === 'reject' ? 'danger' : 'success'}
              leftIcon={approvalAction?.action === 'reject' ? XCircle : BadgeCheck}
              onClick={confirmApprovalAction}
              isLoading={Boolean(processingOrderId)}
            >
              {approvalAction?.action === 'reject' ? 'Reject order' : 'Approve order'}
            </Button>
          </>
        )}
      >
        {approvalAction && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p>{approvalAction.action === 'approve' ? 'This order will be marked approved.' : 'This order will be rejected and cannot be approved later.'}</p>
              <p className="mt-1 font-semibold text-slate-800">{formatCurrency(approvalAction.order.totalAmount)}</p>
            </div>
            <label htmlFor="po-approval-reason" className="block text-xs font-medium text-slate-700">
              {approvalAction.action === 'reject' ? 'Rejection reason *' : 'Approval note (optional)'}
            </label>
            <textarea id="po-approval-reason" rows={3} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} maxLength={1000} placeholder={approvalAction.action === 'reject' ? 'Explain why this order is rejected...' : 'Add an optional approval note...'} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10" />
          </div>
        )}
      </Modal>
    </section>
  );
};

export default PurchaseOrdersManagementView;
