import React, { useEffect, useState } from 'react';
import {
  BadgePercent,
  Boxes,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileText,
  Package,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const UNIT_OPTIONS = [
  'BAG', 'BOX', 'BTL', 'CAN', 'CBM', 'CFT', 'CMS', 'DRM', 'DOZ',
  'GMS', 'GRS', 'KGS', 'KLR', 'KME', 'LTR', 'MTR', 'MTS', 'MLT',
  'NOS', 'PAC', 'PCS', 'PRS', 'QTL', 'ROL', 'SET', 'SQF', 'SQM',
  'SQY', 'TBS', 'TON', 'TUB', 'UNT', 'YDS', 'HRS', 'OTH',
];

const EMPTY_PRODUCT = {
  name: '',
  code: '',
  description: '',
  type: 'PRODUCT',
  saleRate: '0',
  purchaseRate: '0',
  gstRate: '0',
  hsnSacCode: '',
  isStockItem: true,
  unitOfMeasure: 'NOS',
  isActive: true,
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

const productId = (product) => getId(product?.id || product?._id);

const getProductForm = (product) => ({
  ...EMPTY_PRODUCT,
  name: product?.name || '',
  code: product?.code || '',
  description: product?.description || '',
  type: product?.type || 'PRODUCT',
  saleRate: String(product?.saleRate ?? 0),
  purchaseRate: String(product?.purchaseRate ?? 0),
  gstRate: String(product?.gstRate ?? 0),
  hsnSacCode: product?.hsnSacCode || '',
  isStockItem: product?.type === 'SERVICE' ? false : product?.isStockItem !== false,
  unitOfMeasure: product?.unitOfMeasure || 'NOS',
  isActive: product?.isActive !== false,
});

export const ProductsServicesManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deactivatingProduct, setDeactivatingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);

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
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for product and service management.');
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
    const params = new URLSearchParams({
      companyId,
      page: String(page),
      limit: String(pagination.limit),
    });
    if (search.trim()) params.set('search', search.trim());
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter === 'all') {
      params.set('includeInactive', 'true');
    } else {
      params.set('isActive', String(statusFilter === 'active'));
    }

    api.get(`/api/product?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load products and services.');
        }
        const list = response.data?.data?.items;
        const records = Array.isArray(list) ? list : [];
        const resultPagination = response.data?.data?.pagination || {
          page,
          limit: pagination.limit,
          total: records.length,
          totalPages: records.length ? 1 : 0,
        };
        if (records.length === 0 && page > 1 && resultPagination.totalPages < page) {
          setIsLoadingProducts(true);
          setPage(Math.max(1, resultPagination.totalPages));
          return;
        }
        setProducts(records);
        setPagination(resultPagination);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load products and services.'));
      })
      .finally(() => {
        if (active) setIsLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, page, pagination.limit, search, typeFilter, statusFilter, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const totalPages = pagination.totalPages || Math.ceil(pagination.total / pagination.limit);
  const visibleFrom = pagination.total ? ((page - 1) * pagination.limit) + 1 : 0;
  const visibleTo = Math.min(page * pagination.limit, pagination.total);
  const productCount = products.filter((product) => product.type === 'PRODUCT').length;
  const serviceCount = products.filter((product) => product.type === 'SERVICE').length;
  const isLoading = isLoadingCompanies || isLoadingProducts;

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm({ ...EMPTY_PRODUCT });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm(getProductForm(product));
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingProduct(null);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'type') {
      selectType(value);
      return;
    }
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const selectType = (type) => {
    setForm((previous) => ({
      ...previous,
      type,
      isStockItem: type === 'SERVICE' ? false : previous.type === 'SERVICE' || previous.isStockItem,
      unitOfMeasure: type === 'SERVICE' && previous.unitOfMeasure === 'NOS' ? 'HRS' : previous.unitOfMeasure,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId) {
      setFormError('Select a company before saving a product or service.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Product or service name is required.');
      return;
    }
    if ([form.saleRate, form.purchaseRate, form.gstRate].some((value) => Number(value) < 0)) {
      setFormError('Rates and GST cannot be negative.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      type: form.type,
      saleRate: Number(form.saleRate) || 0,
      purchaseRate: Number(form.purchaseRate) || 0,
      gstRate: Number(form.gstRate) || 0,
      hsnSacCode: form.hsnSacCode.trim(),
      isStockItem: form.type === 'SERVICE' ? false : form.isStockItem,
      unitOfMeasure: form.unitOfMeasure,
    };
    if (editingProduct) {
      payload.isActive = form.isActive;
    } else {
      payload.companyId = companyId;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = editingProduct
        ? await api.put(`/api/product/${encodeURIComponent(productId(editingProduct))}`, payload)
        : await api.post('/api/product', payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Product or service details were not saved.');
      }
      showToast(editingProduct ? 'Product or service updated successfully.' : 'Product or service created successfully.', 'success');
      setIsFormOpen(false);
      setEditingProduct(null);
      setPage(1);
      setIsLoadingProducts(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save product or service details.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivatingProduct) return;
    setIsDeleting(true);
    setLoadError('');
    try {
      const response = await api.delete(`/api/product/${encodeURIComponent(productId(deactivatingProduct))}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Product or service was not deactivated.');
      }
      showToast('Product or service deactivated successfully.', 'success');
      setDeactivatingProduct(null);
      setIsLoadingProducts(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not deactivate this product or service.');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingProducts(Boolean(companyId));
    setReloadKey((previous) => previous + 1);
  };

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setProducts([]);
    setPage(1);
    setIsLoadingProducts(false);
    setLoadError('');
  };

  const isCompanyPickerVisible = !preferredCompanyId && companies.length > 1;

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <Boxes size={13} className="text-cyan-200" />
              Masters
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Product &amp; Service</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Maintain your product catalogue, service rates and tax information.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><Building2 size={14} className="text-cyan-200" />{companyLabel}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white"><Package size={14} className="text-cyan-200" />Shared across all branches</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            leftIcon={Plus}
            onClick={openCreateForm}
            isDisabled={!companyId || isLoading}
            className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
          >
            Add Product / Service
          </Button>
        </div>
      </header>

      {isCompanyPickerVisible && (
        <div className="max-w-xl rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <label htmlFor="product-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
          <div className="relative">
            <select id="product-company-select" value={companyId} onChange={(event) => changeCompany(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10">
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

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={retryLoad} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline"><RotateCw size={14} />Retry</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total items', value: pagination.total, icon: Boxes, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Products on this page', value: productCount, icon: Package, style: 'bg-blue-50 text-blue-700' },
          { label: 'Services on this page', value: serviceCount, icon: Wrench, style: 'bg-cyan-50 text-[#045d86]' },
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
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="text-sm font-semibold text-slate-900">Product and service catalogue</h2><p className="mt-0.5 text-xs text-slate-500">Manage sale rates, purchase rates and GST</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setIsLoadingProducts(Boolean(companyId)); }} placeholder="Search catalogue..." aria-label="Search products and services" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-52" />
            </div>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); setIsLoadingProducts(Boolean(companyId)); }} aria-label="Filter by item type" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
              <option value="all">All types</option><option value="PRODUCT">Products</option><option value="SERVICE">Services</option>
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); setIsLoadingProducts(Boolean(companyId)); }} aria-label="Filter by item status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RotateCw size={18} className="mr-2 animate-spin" />Loading products and services...</div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">{companies.length > 1 ? 'Select a company to view the catalogue.' : 'A company is required before the catalogue can be managed.'}</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><Boxes size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{pagination.total ? 'No items on this page' : 'No products or services yet'}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{pagination.total ? 'Try another search or filter.' : 'Create catalogue items to use them on sales and purchase documents.'}</p>
            {!pagination.total && <Button type="button" leftIcon={Plus} onClick={openCreateForm} className="mt-4">Add first item</Button>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Code / HSN-SAC</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Sale rate</th><th className="px-5 py-3 font-semibold">Purchase rate</th><th className="px-5 py-3 font-semibold">GST</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={productId(product)} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${product.type === 'SERVICE' ? 'bg-cyan-50 text-[#045d86]' : 'bg-[#edf4f8] text-[#034665]'}`}>{product.type === 'SERVICE' ? <Wrench size={17} /> : <Package size={17} />}</span>
                          <div><p className="font-semibold text-slate-900">{product.name}</p><p className="mt-0.5 max-w-64 truncate text-[11px] text-slate-400">{product.description || 'No description'}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600"><span className="block">{product.code || 'No code'}</span><span className="mt-1 block text-slate-400">{product.hsnSacCode || 'No HSN/SAC'}</span></td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.type === 'SERVICE' ? 'bg-cyan-50 text-[#045d86]' : 'bg-blue-50 text-blue-700'}`}>{product.type === 'SERVICE' ? 'Service' : 'Product'}</span></td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-700">{formatCurrency(product.saleRate)} <span className="text-slate-400">/ {product.unitOfMeasure || 'NOS'}</span></td>
                      <td className="px-5 py-4 text-xs text-slate-600">{formatCurrency(product.purchaseRate)}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{Number(product.gstRate) || 0}%</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${product.isActive === false ? 'bg-slate-400' : 'bg-emerald-500'}`} />{product.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setViewingProduct(product)} aria-label={`View ${product.name}`} title="View item" className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><Eye size={15} /></button>
                          <button type="button" onClick={() => openEditForm(product)} aria-label={`Edit ${product.name}`} title="Edit item" className="rounded-lg p-2 text-slate-500 transition hover:bg-[#edf4f8] hover:text-[#034665]"><Pencil size={15} /></button>
                          {product.isActive !== false && <button type="button" onClick={() => setDeactivatingProduct(product)} aria-label={`Deactivate ${product.name}`} title="Deactivate item" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
              <span>Showing {visibleFrom}–{visibleTo} of {pagination.total} items</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsLoadingProducts(true); setPage((current) => Math.max(1, current - 1)); }} isDisabled={page <= 1 || isLoading}>Previous</Button>
                <span>Page {page} of {Math.max(totalPages, 1)}</span>
                <Button type="button" variant="outline" onClick={() => { setIsLoadingProducts(true); setPage((current) => Math.min(totalPages, current + 1)); }} isDisabled={page >= totalPages || isLoading}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingProduct ? 'Edit product / service' : 'Create product / service'} subtitle={editingProduct ? 'Update catalogue and tax details.' : `Add an item shared across ${companyLabel} branches.`} size="xl" closeOnBackdrop={!isSaving} footer={(
        <>
          <Button type="button" variant="outline" leftIcon={X} onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
          <Button type="submit" form="product-management-form" leftIcon={editingProduct ? Pencil : Plus} isLoading={isSaving}>{editingProduct ? 'Save changes' : 'Create item'}</Button>
        </>
      )}>
        <form id="product-management-form" onSubmit={handleSave} className="space-y-4">
          {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{formError}</div>}

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#034665] via-[#045d86] to-[#068DCB] p-4 text-white shadow-md sm:p-5">
            <div className="pointer-events-none absolute -right-7 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
                  <Boxes size={12} />Shared catalogue
                </span>
                <h4 className="mt-2 text-base font-semibold">{editingProduct ? 'Update catalogue item' : 'What would you like to add?'}</h4>
                <p className="mt-1 max-w-sm text-xs leading-5 text-cyan-100/90">Choose a type. This item will be available to every branch in {companyLabel}.</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                {[
                  { value: 'PRODUCT', label: 'Product', icon: Package, description: 'Physical goods' },
                  { value: 'SERVICE', label: 'Service', icon: Wrench, description: 'Work or expertise' },
                ].map((option) => {
                  const Icon = option.icon;
                  const selected = form.type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectType(option.value)}
                      disabled={isSaving}
                      className={`flex min-w-[125px] items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${selected ? 'border-white bg-white text-[#034665] shadow-md' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-[#edf4f8]' : 'bg-white/10'}`}><Icon size={17} /></span>
                      <span><span className="block text-xs font-semibold">{option.label}</span><span className={`mt-0.5 block text-[10px] ${selected ? 'text-slate-500' : 'text-cyan-100/80'}`}>{option.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf4f8] text-[#034665]"><ClipboardList size={16} /></span>
              <div><h4 className="text-sm font-semibold text-slate-900">Basic information</h4><p className="text-[11px] text-slate-500">Add a clear name and catalogue reference.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input id="product-name" name="name" label="Name" placeholder={form.type === 'PRODUCT' ? 'e.g. Office Chair' : 'e.g. Consulting Service'} value={form.name} onChange={handleFormChange} required isDisabled={isSaving} />
              <Input id="product-code" name="code" label="Code / SKU" placeholder="Optional unique code" value={form.code} onChange={handleFormChange} isDisabled={isSaving} />
              <div>
                <label htmlFor="product-unit" className="mb-1 block text-xs font-medium text-slate-700">Unit of measure</label>
                <select id="product-unit" name="unitOfMeasure" value={form.unitOfMeasure} onChange={handleFormChange} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <Input id="product-hsn-sac" name="hsnSacCode" label="HSN / SAC code" placeholder="Optional tax classification" value={form.hsnSacCode} onChange={handleFormChange} isDisabled={isSaving} />
              <div className="sm:col-span-2">
                <label htmlFor="product-description" className="mb-1 block text-xs font-medium text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea id="product-description" name="description" rows={2} placeholder="Add a short description for this catalogue item" value={form.description} onChange={handleFormChange} disabled={isSaving} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-[#045d86]"><CircleDollarSign size={17} /></span>
              <div><h4 className="text-sm font-semibold text-slate-900">Pricing & tax</h4><p className="text-[11px] text-slate-500">Set your standard rates and GST percentage.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id="product-sale-rate" name="saleRate" label="Sale rate (₹)" type="number" min="0" step="0.01" value={form.saleRate} onChange={handleFormChange} isDisabled={isSaving} />
              <Input id="product-purchase-rate" name="purchaseRate" label="Purchase rate (₹)" type="number" min="0" step="0.01" value={form.purchaseRate} onChange={handleFormChange} isDisabled={isSaving} />
              <Input id="product-gst-rate" name="gstRate" label="GST rate (%)" type="number" min="0" step="0.01" value={form.gstRate} onChange={handleFormChange} isDisabled={isSaving} leftIcon={BadgePercent} />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {form.type === 'PRODUCT' && (
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#068DCB]/20 bg-[#edf4f8] p-4 transition hover:border-[#068DCB]/40">
                <input type="checkbox" name="isStockItem" checked={form.isStockItem} onChange={handleFormChange} disabled={isSaving} className="h-4 w-4 rounded border-slate-300 text-[#068DCB] focus:ring-[#068DCB]" />
                <span className="flex flex-1 items-center gap-2"><Warehouse size={16} className="text-[#045d86]" /><span><span className="block text-xs font-semibold text-slate-800">Track inventory</span><span className="mt-0.5 block text-[11px] text-slate-500">Manage this product as a stock item.</span></span></span>
              </label>
            )}
            {editingProduct && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="product-status" className="mb-1 block text-xs font-medium text-slate-700">Catalogue status</label>
                <select id="product-status" name="isActive" value={String(form.isActive)} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.value === 'true' }))} disabled={isSaving} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50">
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
            )}
            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-[11px] leading-5 text-blue-800">
              <FileText size={15} className="mt-0.5 shrink-0" />
              <p>{form.type === 'SERVICE' ? 'Services are never stock-tracked. Use hours or another suitable unit of measure.' : 'You can update rates and catalogue details later without changing existing transactions.'}</p>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewingProduct)} onClose={() => setViewingProduct(null)} title="Product / service details" subtitle={viewingProduct?.name} size="lg">
        {viewingProduct && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Name', viewingProduct.name || '—'],
              ['Status', viewingProduct.isActive === false ? 'Inactive' : 'Active'],
              ['Type', viewingProduct.type === 'SERVICE' ? 'Service' : 'Product'],
              ['Code / SKU', viewingProduct.code || '—'],
              ['Description', viewingProduct.description || '—'],
              ['Unit of measure', viewingProduct.unitOfMeasure || 'NOS'],
              ['Sale rate', formatCurrency(viewingProduct.saleRate)],
              ['Purchase rate', formatCurrency(viewingProduct.purchaseRate)],
              ['GST rate', `${Number(viewingProduct.gstRate) || 0}%`],
              ['HSN / SAC code', viewingProduct.hsnSacCode || '—'],
              ['Stock tracking', viewingProduct.type === 'SERVICE' ? 'Not applicable' : (viewingProduct.isStockItem ? 'Enabled' : 'Disabled')],
              ['Availability', 'Shared across all branches'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f4f7fc] p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(deactivatingProduct)} onClose={() => { if (!isDeleting) setDeactivatingProduct(null); }} title="Deactivate item?" subtitle={deactivatingProduct?.name} size="sm" closeOnBackdrop={!isDeleting} footer={(
        <>
          <Button type="button" variant="outline" onClick={() => setDeactivatingProduct(null)} isDisabled={isDeleting}>Keep item</Button>
          <Button type="button" variant="danger" leftIcon={Trash2} onClick={handleDeactivate} isLoading={isDeleting}>Deactivate</Button>
        </>
      )}>
        <p className="text-sm leading-6 text-slate-600"><strong>{deactivatingProduct?.name}</strong> will be deactivated, not permanently erased, so historical documents remain linked.</p>
      </Modal>
    </section>
  );
};

export default ProductsServicesManagementView;
