import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileText,
  Info,
  Percent,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Modal } from '../common/Modal.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const TAX_CATEGORIES = [
  { value: 'Taxable', label: 'Taxable' },
  { value: 'Exempt', label: 'Exempt' },
  { value: 'NilRated', label: 'Nil Rated' },
  { value: 'ZeroRated', label: 'Zero Rated' },
];

const EMPTY_TAX = {
  name: '',
  ratePercent: '',
  taxCategory: 'Taxable',
  hsnSacApplicable: true,
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

const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const details = Array.isArray(data?.details)
    ? data.details.map((item) => item.message).filter(Boolean).join(', ')
    : '';
  return [data?.message || error?.message || fallback, details]
    .filter(Boolean)
    .filter((message, index, messages) => messages.indexOf(message) === index)
    .join(': ');
};

const categoryLabel = (category) => (
  TAX_CATEGORIES.find((item) => item.value === category)?.label || category || 'Taxable'
);

const getCategoryStyle = (category) => {
  if (category === 'Taxable') return 'bg-cyan-50 text-[#045d86]';
  if (category === 'Exempt') return 'bg-emerald-50 text-emerald-700';
  if (category === 'NilRated') return 'bg-amber-50 text-amber-700';
  return 'bg-violet-50 text-violet-700';
};

const taxId = (tax) => getId(tax?.id || tax?._id);

export const TaxMasterManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState(EMPTY_TAX);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingTaxes, setIsLoadingTaxes] = useState(Boolean(preferredCompanyId));
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);

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
          setIsLoadingTaxes(true);
        } else if (availableCompanies.length === 0) {
          setLoadError('No company is available for Tax Master.');
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
    api.get(`/api/tax?companyId=${encodeURIComponent(companyId)}&includeInactive=true`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load tax rates.');
        }
        setTaxRates(Array.isArray(response.data?.data) ? response.data.data : []);
        setLoadError('');
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load tax rates.'));
      })
      .finally(() => {
        if (active) setIsLoadingTaxes(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, reloadKey]);

  const selectedCompany = companies.find((company) => getId(company._id || company.id) === companyId);
  const companyLabel = selectedCompany?.name || selectedCompany?.companyName ||
    user?.company?.name || user?.companyName || 'Selected company';
  const hasSystemTaxes = taxRates.some((tax) => tax.isSystemTax);
  const activeCount = taxRates.filter((tax) => tax.isActive !== false).length;
  const inactiveCount = taxRates.length - activeCount;

  const visibleTaxes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return taxRates.filter((tax) => {
      if (statusFilter === 'active' && tax.isActive === false) return false;
      if (statusFilter === 'inactive' && tax.isActive !== false) return false;
      if (categoryFilter !== 'all' && tax.taxCategory !== categoryFilter) return false;
      if (!query) return true;
      return [tax.name, tax.ratePercent, tax.taxCategory]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [taxRates, search, categoryFilter, statusFilter]);

  const openCreateForm = () => {
    setForm({ ...EMPTY_TAX });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError('');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const cleanName = form.name.trim();
    const ratePercent = Number(form.ratePercent);
    if (!companyId) {
      setFormError('Select a company before creating a tax rate.');
      return;
    }
    if (!cleanName) {
      setFormError('Enter a tax rate name.');
      return;
    }
    if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      setFormError('Enter a valid percentage from 0 to 100.');
      return;
    }
    if (taxRates.some((tax) => tax.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      setFormError('A tax rate with this name already exists.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = await api.post('/api/tax', {
        companyId,
        name: cleanName,
        ratePercent,
        taxCategory: form.taxCategory,
        hsnSacApplicable: form.hsnSacApplicable,
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Tax rate was not created.');
      }
      showToast(`${cleanName} tax rate created.`, 'success');
      setIsFormOpen(false);
      setIsLoadingTaxes(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create tax rate.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!companyId || hasSystemTaxes) return;
    setIsSeeding(true);
    try {
      const response = await api.post('/api/tax/seed-default', { companyId });
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Default GST rates were not added.');
      }
      const count = response.data?.data?.count;
      showToast(`${count || 'Default'} standard GST rates added.`, 'success');
      setIsLoadingTaxes(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not add standard GST rates.');
      showToast(message, 'error');
      setLoadError(message);
    } finally {
      setIsSeeding(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoadingCompanies(!preferredCompanyId);
    setIsLoadingTaxes(Boolean(companyId));
    setReloadKey((previous) => previous + 1);
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 font-poppins">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
              <Percent size={13} className="text-cyan-200" />
              Finance · Masters
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Tax Master</h1>
            <p className="mt-1 max-w-xl text-xs text-cyan-100/90 sm:text-sm">
              Manage company tax rates and GST categories for purchases and sales.
            </p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
              <Building2 size={14} className="text-cyan-200" />
              {companyLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasSystemTaxes && (
              <Button
                type="button"
                variant="outline"
                leftIcon={Sparkles}
                onClick={handleSeedDefaults}
                isLoading={isSeeding}
                isDisabled={!companyId || isLoadingCompanies || isLoadingTaxes}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Add standard GST rates
              </Button>
            )}
            {hasSystemTaxes && (
              <span className="inline-flex items-center gap-1.5 self-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white">
                <BadgeCheck size={14} className="text-cyan-200" />
                Standard rates added
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              leftIcon={Plus}
              onClick={openCreateForm}
              isDisabled={!companyId || isLoadingCompanies}
              className="border-white/30 bg-white text-[#034665] shadow-md hover:bg-cyan-50"
            >
              Create Tax Rate
            </Button>
          </div>
        </div>
      </header>

      {!preferredCompanyId && companies.length > 1 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <label htmlFor="tax-company-select" className="mb-1.5 block text-xs font-medium text-slate-700">Company</label>
          <select
            id="tax-company-select"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setTaxRates([]);
              setLoadError('');
              setIsLoadingTaxes(Boolean(event.target.value));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 sm:max-w-md"
          >
            <option value="">Select a company</option>
            {companies.map((company) => {
              const id = getId(company._id || company.id);
              return <option key={id} value={id}>{company.name || company.companyName || 'Unnamed Company'}</option>;
            })}
          </select>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={retryLoad} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-rose-800 hover:underline">
            <RotateCw size={14} />
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total tax rates', value: taxRates.length, icon: Percent, style: 'bg-[#edf4f8] text-[#034665]' },
          { label: 'Active rates', value: activeCount, icon: CheckCircle2, style: 'bg-emerald-50 text-emerald-700' },
          { label: 'Inactive rates', value: inactiveCount, icon: CircleAlert, style: 'bg-amber-50 text-amber-700' },
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
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tax rate register</h2>
              <p className="mt-0.5 text-xs text-slate-500">Tax rates are shared across branches in this company.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tax rates..."
                  aria-label="Search tax rates"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/10 sm:w-56"
                />
              </div>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by tax category" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="all">All categories</option>
                {TAX_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by tax rate status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#068DCB]">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All statuses</option>
              </select>
            </div>
          </div>
        </div>

        {isLoadingCompanies || isLoadingTaxes ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">
            <RotateCw size={18} className="mr-2 animate-spin" />
            Loading tax rates...
          </div>
        ) : !companyId ? (
          <div className="p-8 text-center text-sm text-slate-500">Select a company to view tax rates.</div>
        ) : !taxRates.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f8] text-[#034665]"><Percent size={24} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No tax rates yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Add standard Indian GST rates or create a custom rate for this company.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {!hasSystemTaxes && <Button type="button" variant="outline" leftIcon={Sparkles} onClick={handleSeedDefaults} isLoading={isSeeding}>Add standard GST rates</Button>}
              <Button type="button" leftIcon={Plus} onClick={openCreateForm}>Create tax rate</Button>
            </div>
          </div>
        ) : !visibleTaxes.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No tax rates match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tax rate</th>
                  <th className="px-5 py-3 font-semibold">Rate</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">HSN / SAC</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTaxes.map((tax) => (
                  <tr key={taxId(tax)} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-900">{tax.name}</p>
                      <p className="mt-1 text-[10px] text-slate-400">Created {tax.createdAt ? new Date(tax.createdAt).toLocaleDateString() : '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">{Number(tax.ratePercent) || 0}%</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getCategoryStyle(tax.taxCategory)}`}>{categoryLabel(tax.taxCategory)}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{tax.hsnSacApplicable ? 'Applicable' : 'Not applicable'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        {tax.isSystemTax ? <><ShieldCheck size={14} className="text-[#068DCB]" /> Standard GST</> : <><FileText size={14} className="text-slate-400" /> Custom</>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {tax.isActive === false ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Inactive</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={12} />Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <span>Showing {visibleTaxes.length} of {taxRates.length} tax rates</span>
          <span className="inline-flex items-center gap-1.5"><Info size={13} /> Tax rates apply company-wide.</span>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title="Create tax rate"
        subtitle="Add a company-wide tax rate for sales and purchases."
        size="md"
        closeOnBackdrop={!isSaving}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button type="submit" form="tax-master-form" leftIcon={Plus} isLoading={isSaving}>Create tax rate</Button>
          </>
        )}
      >
        <form id="tax-master-form" onSubmit={handleCreate} className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>}
          <Input
            id="tax-name"
            label="Tax rate name"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="e.g. GST 18%"
            isDisabled={isSaving}
            required
            maxLength={100}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="tax-rate-percent"
              label="Rate percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.ratePercent}
              onChange={(event) => setForm((previous) => ({ ...previous, ratePercent: event.target.value }))}
              isDisabled={isSaving}
              required
              rightIcon={Percent}
            />
            <div>
              <label htmlFor="tax-category" className="mb-1 block text-xs font-medium text-slate-700">Tax category</label>
              <select
                id="tax-category"
                value={form.taxCategory}
                onChange={(event) => setForm((previous) => ({ ...previous, taxCategory: event.target.value }))}
                disabled={isSaving}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#068DCB] focus:outline-none focus:ring-2 focus:ring-[#068DCB]/10 disabled:bg-slate-50"
              >
                {TAX_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor="tax-hsn-applicable" className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-[#068DCB]/40">
            <input
              id="tax-hsn-applicable"
              type="checkbox"
              checked={form.hsnSacApplicable}
              onChange={(event) => setForm((previous) => ({ ...previous, hsnSacApplicable: event.target.checked }))}
              disabled={isSaving}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#068DCB] focus:ring-[#068DCB]"
            />
            <span>
              <span className="block text-xs font-medium text-slate-800">HSN / SAC code applicable</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">Enable this when goods or services using this tax rate require an HSN / SAC code.</span>
            </span>
          </label>
        </form>
      </Modal>
    </section>
  );
};

export default TaxMasterManagementView;
