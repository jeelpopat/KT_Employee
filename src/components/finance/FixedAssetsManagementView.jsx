import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Eye,
  Landmark,
  Plus,
  RotateCw,
  Search,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_ASSET = {
  financialYearId: '',
  assetName: '',
  assetCode: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  purchaseCost: '',
  salvageValue: '0',
  usefulLifeYears: '5',
  depreciationMethod: 'STRAIGHT_LINE',
  depreciationRatePercent: '20',
  coaAssetAccountId: '',
  coaDepreciationExpenseAccountId: '',
  coaAccumulatedDepreciationAccountId: '',
  notes: '',
};
const EMPTY_DEPRECIATION = {
  financialYearId: '',
  depreciationDate: new Date().toISOString().slice(0, 10),
  depreciationAmount: '',
  remarks: '',
};
const EMPTY_DISPOSAL = {
  financialYearId: '',
  disposalDate: new Date().toISOString().slice(0, 10),
  disposalType: 'SALE',
  saleProceeds: '0',
  coaGainLossAccountId: '',
  remarks: '',
};
const STATUS_LABELS = {
  ACTIVE: 'Active',
  FULLY_DEPRECIATED: 'Fully depreciated',
  DISPOSED: 'Disposed',
};
const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100';
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
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getStatusClass = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'FULLY_DEPRECIATED') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

export const FixedAssetsManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET);
  const [depreciationForm, setDepreciationForm] = useState(EMPTY_DEPRECIATION);
  const [disposalForm, setDisposalForm] = useState(EMPTY_DISPOSAL);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [viewingAsset, setViewingAsset] = useState(null);
  const [drawerMode, setDrawerMode] = useState('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
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
  const assetAccounts = useMemo(() => accounts.filter((account) => account.type === 'Asset' && !account.isGroup), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter((account) => account.type === 'Expense' && !account.isGroup), [accounts]);
  const activeAssets = assets.filter((asset) => asset.status === 'ACTIVE').length;
  const totalCost = assets.reduce((sum, asset) => sum + numberValue(asset.purchaseCost), 0);
  const bookValueTotal = assets.reduce((sum, asset) => sum + numberValue(asset.bookValue), 0);
  const visibleAssets = assets;

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
        else if (!records.length) setLoadError('No company is available for Fixed Assets.');
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
        if (!records.length) setLoadError('Create a branch before using Fixed Assets.');
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
    const yearRequest = branchId === 'all'
      ? Promise.resolve({ data: { success: true, data: [] } })
      : api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`);
    const accountParams = new URLSearchParams({ companyId, includeInactive: 'false' });
    if (branchId !== 'all') accountParams.set('branchId', branchId);
    Promise.allSettled([
      yearRequest,
      api.get(`/api/coa?${accountParams.toString()}`),
    ]).then(([yearResult, accountResult]) => {
      if (!active) return;
      const failures = [];
      if (yearResult.status === 'fulfilled' && yearResult.value.data?.success !== false) {
        const records = Array.isArray(yearResult.value.data?.data) ? yearResult.value.data.data : [];
        setFinancialYears(records.filter((year) => year.isLocked !== true));
      } else {
        failures.push(yearResult.status === 'rejected'
          ? getErrorMessage(yearResult.reason, 'Could not load financial years.')
          : yearResult.value.data?.message || 'Could not load financial years.');
      }
      if (accountResult.status === 'fulfilled' && accountResult.value.data?.success !== false) {
        const records = Array.isArray(accountResult.value.data?.data) ? accountResult.value.data.data : [];
        setAccounts(records.filter((account) => account.isActive !== false));
      } else {
        failures.push(accountResult.status === 'rejected'
          ? getErrorMessage(accountResult.reason, 'Could not load Chart of Accounts.')
          : accountResult.value.data?.message || 'Could not load Chart of Accounts.');
      }
      setSetupError(failures.join(' '));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    setIsLoadingAssets(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId });
    if (branchId !== 'all') params.set('branchId', branchId);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('search', escapeRegex(search.trim()));
    api.get(`/api/asset?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load assets.');
        setAssets(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load assets.')); })
      .finally(() => { if (active) setIsLoadingAssets(false); });
    return () => { active = false; };
  }, [companyId, branchId, statusFilter, search, reloadKey]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranchId('');
    setBranches([]);
    setAssets([]);
    setFinancialYears([]);
    setAccounts([]);
    setDrawerMode('');
    setLoadError('');
    setSetupError('');
  };
  const changeBranch = (nextBranchId) => {
    setBranchId(nextBranchId);
    setAssets([]);
    setFinancialYears([]);
    setAccounts([]);
    setDrawerMode('');
    setLoadError('');
    setSetupError('');
  };
  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerMode('');
    setSelectedAsset(null);
    setViewingAsset(null);
    setPanelError('');
  };
  const refreshAssets = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };
  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= new Date(item.startDate).toISOString().slice(0, 10) && today <= new Date(item.endDate).toISOString().slice(0, 10)) || financialYears[0];
    setAssetForm({ ...EMPTY_ASSET, financialYearId: getId(year) });
    setSelectedAsset(null);
    setPanelError('');
    setDrawerMode('create');
  };
  const openAssetDetails = async (asset) => {
    setDrawerMode('details');
    setSelectedAsset(asset);
    setViewingAsset(null);
    setIsLoadingDetails(true);
    setPanelError('');
    try {
      const response = await api.get(`/api/asset/${encodeURIComponent(getId(asset))}?companyId=${encodeURIComponent(companyId)}`);
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Could not load asset details.');
      setViewingAsset(response.data.data);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load asset details.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const openDepreciation = (asset) => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= new Date(item.startDate).toISOString().slice(0, 10) && today <= new Date(item.endDate).toISOString().slice(0, 10)) || financialYears[0];
    const remaining = Math.max(0, numberValue(asset.bookValue) - numberValue(asset.salvageValue));
    const annualAmount = asset.depreciationMethod === 'WRITTEN_DOWN_VALUE'
      ? numberValue(asset.bookValue) * numberValue(asset.depreciationRatePercent) / 100
      : (numberValue(asset.purchaseCost) - numberValue(asset.salvageValue)) / numberValue(asset.usefulLifeYears);
    setDepreciationForm({
      financialYearId: getId(year),
      depreciationDate: today,
      depreciationAmount: String(roundMoney(Math.min(annualAmount / 12, remaining))),
      remarks: '',
    });
    setSelectedAsset(asset);
    setPanelError('');
    setDrawerMode('depreciation');
  };
  const openDisposal = (asset) => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => today >= new Date(item.startDate).toISOString().slice(0, 10) && today <= new Date(item.endDate).toISOString().slice(0, 10)) || financialYears[0];
    setDisposalForm({ ...EMPTY_DISPOSAL, financialYearId: getId(year), disposalDate: today });
    setSelectedAsset(asset);
    setPanelError('');
    setDrawerMode('disposal');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!companyId || !branchId || branchId === 'all') {
      setPanelError('Select a specific branch before registering an asset.');
      return;
    }
    if (!assetForm.financialYearId) {
      setPanelError('Select an open financial year.');
      return;
    }
    const purchaseCost = numberValue(assetForm.purchaseCost);
    const salvageValue = numberValue(assetForm.salvageValue);
    if (salvageValue >= purchaseCost) {
      setPanelError('Salvage value must be less than the purchase cost.');
      return;
    }
    const payload = {
      companyId,
      branchId,
      financialYearId: assetForm.financialYearId,
      assetName: assetForm.assetName.trim(),
      assetCode: assetForm.assetCode.trim(),
      purchaseDate: assetForm.purchaseDate,
      purchaseCost,
      salvageValue,
      usefulLifeYears: numberValue(assetForm.usefulLifeYears),
      depreciationMethod: assetForm.depreciationMethod,
      depreciationRatePercent: numberValue(assetForm.depreciationRatePercent),
      ...(assetForm.coaAssetAccountId ? { coaAssetAccountId: assetForm.coaAssetAccountId } : {}),
      ...(assetForm.coaDepreciationExpenseAccountId ? { coaDepreciationExpenseAccountId: assetForm.coaDepreciationExpenseAccountId } : {}),
      ...(assetForm.coaAccumulatedDepreciationAccountId ? { coaAccumulatedDepreciationAccountId: assetForm.coaAccumulatedDepreciationAccountId } : {}),
      notes: assetForm.notes.trim(),
    };
    setIsSaving(true);
    try {
      const response = await api.post('/api/asset', payload);
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Asset was not registered.');
      showToast('Fixed asset registered successfully.', 'success');
      setDrawerMode('');
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not register this asset.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDepreciation = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!selectedAsset || !depreciationForm.financialYearId) {
      setPanelError('Select an open financial year.');
      return;
    }
    const amount = numberValue(depreciationForm.depreciationAmount);
    if (amount <= 0 || amount > numberValue(selectedAsset.bookValue) - numberValue(selectedAsset.salvageValue) + 0.0001) {
      setPanelError('Depreciation amount must be positive and cannot exceed the remaining depreciable value.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post(`/api/asset/${encodeURIComponent(getId(selectedAsset))}/depreciation`, {
        companyId,
        financialYearId: depreciationForm.financialYearId,
        depreciationDate: depreciationForm.depreciationDate,
        depreciationAmount: amount,
        remarks: depreciationForm.remarks.trim(),
      });
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Depreciation was not posted.');
      showToast('Depreciation posted and journal entry created.', 'success');
      setDrawerMode('');
      setSelectedAsset(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not post depreciation.');
      setPanelError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisposal = async (event) => {
    event.preventDefault();
    setPanelError('');
    if (!selectedAsset || !disposalForm.financialYearId) {
      setPanelError('Select an open financial year.');
      return;
    }
    if (!window.confirm(`Confirm disposal of ${selectedAsset.assetName} (${selectedAsset.assetCode})? This action cannot be undone.`)) return;
    setIsSaving(true);
    try {
      const response = await api.post(`/api/asset/${encodeURIComponent(getId(selectedAsset))}/dispose`, {
        companyId,
        financialYearId: disposalForm.financialYearId,
        disposalDate: disposalForm.disposalDate,
        disposalType: disposalForm.disposalType,
        saleProceeds: numberValue(disposalForm.saleProceeds),
        ...(disposalForm.coaGainLossAccountId ? { coaGainLossAccountId: disposalForm.coaGainLossAccountId } : {}),
        remarks: disposalForm.remarks.trim(),
      });
      if (response.data?.success === false || !response.data?.data) throw new Error(response.data?.message || 'Asset disposal was not posted.');
      showToast('Asset disposed and accounting entry posted.', 'success');
      setDrawerMode('');
      setSelectedAsset(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not dispose this asset.');
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
        setSelectedAsset(null);
        setViewingAsset(null);
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

  const assetAccountOptions = (list) => list.map((account) => (
    <option key={getId(account)} value={getId(account)}>{account.code} · {account.name}</option>
  ));
  const stats = [
    { title: 'Total Assets', value: assets.length.toLocaleString(), detail: `${activeAssets} active`, icon: Landmark, tone: 'amber' },
    { title: 'Original Cost', value: formatCurrency(totalCost), detail: 'Selected branch scope', icon: CircleDollarSign, tone: 'blue' },
    { title: 'Current Book Value', value: formatCurrency(bookValueTotal), detail: 'After posted depreciation', icon: Calculator, tone: 'emerald' },
    { title: 'Disposed', value: assets.filter((asset) => asset.status === 'DISPOSED').length.toLocaleString(), detail: 'Assets disposed', icon: CheckCircle2, tone: 'violet' },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Expense & Payroll</span><span aria-hidden="true">›</span><span className="font-semibold text-slate-800">Fixed Assets</span></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Landmark className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Fixed Assets</h1><p className="mt-1 text-sm text-slate-500">Register assets, post depreciation, and record disposals.</p></div></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={RotateCw} onClick={refreshAssets} isDisabled={!companyId}>Refresh</Button>
          <Button onClick={openCreate} leftIcon={Plus} className="bg-amber-700 hover:bg-amber-800 focus:ring-amber-500/30" isDisabled={!companyId || !branchId || branchId === 'all' || !financialYears.length || isLoadingSetup}>Register Asset</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((card) => {
          const Icon = card.icon;
          const tone = { amber: 'bg-amber-100 text-amber-700', blue: 'bg-sky-100 text-sky-700', emerald: 'bg-emerald-100 text-emerald-700', violet: 'bg-violet-100 text-violet-700' }[card.tone];
          return <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div><p className="text-xs font-medium text-slate-500">{card.title}</p><p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{card.value}</p><p className="mt-1 text-[11px] text-slate-400">{card.detail}</p></div>;
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[170px_minmax(220px,1fr)]">
          <select aria-label="Asset status" className={`${controlClass} h-10`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Statuses</option><option value="ACTIVE">Active</option><option value="FULLY_DEPRECIATED">Fully depreciated</option><option value="DISPOSED">Disposed</option></select>
          <label className="relative"><span className="sr-only">Search assets</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${controlClass} h-10 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by asset name or code..." /></label>
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
        <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Purchase date</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Book value</th><th className="px-4 py-3">Depreciation</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingAssets ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">Loading fixed assets…</td></tr>
              : visibleAssets.length === 0 ? <tr><td colSpan="7" className="px-4 py-14 text-center"><Landmark className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No fixed assets found</p><p className="mt-1 text-xs text-slate-500">Register an asset to begin tracking cost and depreciation.</p></td></tr>
                : visibleAssets.map((asset) => (
                  <tr key={getId(asset)} className="transition-colors hover:bg-amber-50/30">
                    <td className="max-w-[260px] px-4 py-3"><p className="truncate font-semibold text-slate-800">{asset.assetName}</p><p className="mt-0.5 text-[11px] text-slate-400">{asset.assetCode}</p></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(asset.purchaseDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(asset.purchaseCost)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(asset.bookValue)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{asset.depreciationMethod === 'WRITTEN_DOWN_VALUE' ? 'Written down value' : 'Straight line'}<span className="ml-1 text-slate-400">· {numberValue(asset.depreciationRatePercent)}%</span></td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(asset.status)}`}>{STATUS_LABELS[asset.status] || asset.status}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" title="View details" aria-label="View asset details" isDisabled={isLoadingDetails} onClick={() => openAssetDetails(asset)}><Eye className="h-4 w-4 text-slate-500" /></Button>
                      {asset.status === 'ACTIVE' && <Button variant="ghost" size="sm" title="Post depreciation" aria-label="Post depreciation" onClick={() => openDepreciation(asset)}><Calculator className="h-4 w-4 text-amber-700" /></Button>}
                      {asset.status !== 'DISPOSED' && <Button variant="ghost" size="sm" title="Dispose asset" aria-label="Dispose asset" onClick={() => openDisposal(asset)}><ChevronRight className="h-4 w-4 text-rose-600" /></Button>}
                    </div></td>
                  </tr>
                ))}
          </tbody>
        </table></div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing {assets.length.toLocaleString()} assets</div>
      </div>

      {drawerMode && <div className="fixed inset-x-0 bottom-0 top-[72px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close asset panel" onClick={closeDrawer} />
        <aside role="dialog" aria-modal="true" aria-labelledby="asset-drawer-title" className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Landmark className="h-4 w-4" /></div><div><h2 id="asset-drawer-title" className="text-base font-bold text-slate-900">{drawerMode === 'create' ? 'Register Fixed Asset' : drawerMode === 'depreciation' ? 'Post Depreciation' : drawerMode === 'disposal' ? 'Dispose Asset' : 'Asset Details'}</h2><p className="mt-0.5 text-[11px] text-slate-500">{selectedAsset ? `${selectedAsset.assetName} · ${selectedAsset.assetCode}` : 'Register a company asset'}</p></div></div>
            <button type="button" onClick={closeDrawer} disabled={isSaving} aria-label="Close asset panel" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-4 w-4" /></button>
          </div>

          {drawerMode === 'create' && <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={fieldLabelClass}>Asset name <span className="text-rose-500">*</span></span><input className={controlClass} value={assetForm.assetName} onChange={(event) => setAssetForm((previous) => ({ ...previous, assetName: event.target.value }))} maxLength={200} required /></label>
                <label><span className={fieldLabelClass}>Asset code <span className="text-rose-500">*</span></span><input className={controlClass} value={assetForm.assetCode} onChange={(event) => setAssetForm((previous) => ({ ...previous, assetCode: event.target.value }))} maxLength={100} required /></label>
                <label><span className={fieldLabelClass}>Purchase date <span className="text-rose-500">*</span></span><input className={controlClass} type="date" value={assetForm.purchaseDate} onChange={(event) => setAssetForm((previous) => ({ ...previous, purchaseDate: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Financial year <span className="text-rose-500">*</span></span><select className={controlClass} value={assetForm.financialYearId} onChange={(event) => setAssetForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
                <label><span className={fieldLabelClass}>Purchase cost <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0.01" step="0.01" value={assetForm.purchaseCost} onChange={(event) => setAssetForm((previous) => ({ ...previous, purchaseCost: event.target.value }))} required /></label>
                <label><span className={fieldLabelClass}>Salvage value</span><input className={controlClass} type="number" min="0" step="0.01" value={assetForm.salvageValue} onChange={(event) => setAssetForm((previous) => ({ ...previous, salvageValue: event.target.value }))} /></label>
                <label><span className={fieldLabelClass}>Useful life (years) <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0.01" step="0.01" value={assetForm.usefulLifeYears} onChange={(event) => setAssetForm((previous) => ({ ...previous, usefulLifeYears: event.target.value, ...(previous.depreciationMethod === 'STRAIGHT_LINE' && numberValue(event.target.value) > 0 ? { depreciationRatePercent: String(roundMoney(100 / numberValue(event.target.value))) } : {}) }))} required /></label>
                <label><span className={fieldLabelClass}>Depreciation method <span className="text-rose-500">*</span></span><select className={controlClass} value={assetForm.depreciationMethod} onChange={(event) => setAssetForm((previous) => ({ ...previous, depreciationMethod: event.target.value, depreciationRatePercent: event.target.value === 'STRAIGHT_LINE' && numberValue(previous.usefulLifeYears) > 0 ? String(roundMoney(100 / numberValue(previous.usefulLifeYears))) : previous.depreciationRatePercent }))}><option value="STRAIGHT_LINE">Straight line</option><option value="WRITTEN_DOWN_VALUE">Written down value</option></select></label>
                <label><span className={fieldLabelClass}>Depreciation rate (%) <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0" max="100" step="0.01" value={assetForm.depreciationRatePercent} onChange={(event) => setAssetForm((previous) => ({ ...previous, depreciationRatePercent: event.target.value }))} required /></label>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div><p className="text-sm font-semibold text-slate-800">Chart of Accounts</p><p className="text-[11px] text-slate-500">Leave blank to create standard asset ledgers automatically.</p></div>
                <label className="block"><span className={fieldLabelClass}>Asset ledger</span><select className={controlClass} value={assetForm.coaAssetAccountId} onChange={(event) => setAssetForm((previous) => ({ ...previous, coaAssetAccountId: event.target.value }))}><option value="">Auto-create asset ledger</option>{assetAccountOptions(assetAccounts)}</select></label>
                <label className="block"><span className={fieldLabelClass}>Depreciation expense ledger</span><select className={controlClass} value={assetForm.coaDepreciationExpenseAccountId} onChange={(event) => setAssetForm((previous) => ({ ...previous, coaDepreciationExpenseAccountId: event.target.value }))}><option value="">Auto-create depreciation expense ledger</option>{assetAccountOptions(expenseAccounts)}</select></label>
                <label className="block"><span className={fieldLabelClass}>Accumulated depreciation ledger</span><select className={controlClass} value={assetForm.coaAccumulatedDepreciationAccountId} onChange={(event) => setAssetForm((previous) => ({ ...previous, coaAccumulatedDepreciationAccountId: event.target.value }))}><option value="">Auto-create accumulated depreciation ledger</option>{assetAccountOptions(assetAccounts)}</select></label>
              </div>
              <label className="block"><span className={fieldLabelClass}>Notes</span><textarea className={`${controlClass} min-h-[80px] resize-y`} maxLength={5000} value={assetForm.notes} onChange={(event) => setAssetForm((previous) => ({ ...previous, notes: event.target.value }))} /></label>
              {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{isLoadingSetup ? 'Loading setup…' : 'Asset ledgers post automatically'}</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-amber-700 hover:bg-amber-800 focus:ring-amber-500/30">Register Asset</Button></div></div>
          </form>}

          {drawerMode === 'depreciation' && <form onSubmit={handleDepreciation} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-amber-50 p-3 text-xs"><div><p className="text-amber-800">Current book value</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(selectedAsset?.bookValue)}</p></div><div><p className="text-amber-800">Remaining depreciable value</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(Math.max(0, numberValue(selectedAsset?.bookValue) - numberValue(selectedAsset?.salvageValue)))}</p></div></div>
              <label className="block"><span className={fieldLabelClass}>Financial year <span className="text-rose-500">*</span></span><select className={controlClass} value={depreciationForm.financialYearId} onChange={(event) => setDepreciationForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
              <label className="block"><span className={fieldLabelClass}>Depreciation date <span className="text-rose-500">*</span></span><input className={controlClass} type="date" value={depreciationForm.depreciationDate} onChange={(event) => setDepreciationForm((previous) => ({ ...previous, depreciationDate: event.target.value }))} required /></label>
              <label className="block"><span className={fieldLabelClass}>Amount <span className="text-rose-500">*</span></span><input className={controlClass} type="number" min="0.01" step="0.01" max={Math.max(0, numberValue(selectedAsset?.bookValue) - numberValue(selectedAsset?.salvageValue))} value={depreciationForm.depreciationAmount} onChange={(event) => setDepreciationForm((previous) => ({ ...previous, depreciationAmount: event.target.value }))} required /><span className="mt-1 block text-[11px] text-slate-500">Suggested monthly amount based on the asset's depreciation method. You may adjust it.</span></label>
              <label className="block"><span className={fieldLabelClass}>Remarks</span><textarea className={`${controlClass} min-h-[80px] resize-y`} maxLength={1000} value={depreciationForm.remarks} onChange={(event) => setDepreciationForm((previous) => ({ ...previous, remarks: event.target.value }))} /></label>
              {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>This updates the book value and automatically posts a journal entry.</p></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-amber-700 hover:bg-amber-800 focus:ring-amber-500/30">Post Depreciation</Button></div>
          </form>}

          {drawerMode === 'disposal' && <form onSubmit={handleDisposal} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><p className="font-semibold">This action is irreversible.</p><p className="mt-1">The asset will be marked disposed, its book value set to zero, and an accounting entry will be posted.</p></div>
              <label className="block"><span className={fieldLabelClass}>Financial year <span className="text-rose-500">*</span></span><select className={controlClass} value={disposalForm.financialYearId} onChange={(event) => setDisposalForm((previous) => ({ ...previous, financialYearId: event.target.value }))} required><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
              <label className="block"><span className={fieldLabelClass}>Disposal date <span className="text-rose-500">*</span></span><input className={controlClass} type="date" value={disposalForm.disposalDate} onChange={(event) => setDisposalForm((previous) => ({ ...previous, disposalDate: event.target.value }))} required /></label>
              <label className="block"><span className={fieldLabelClass}>Disposal type <span className="text-rose-500">*</span></span><select className={controlClass} value={disposalForm.disposalType} onChange={(event) => setDisposalForm((previous) => ({ ...previous, disposalType: event.target.value }))}><option value="SALE">Sale</option><option value="WRITE_OFF">Write-off</option><option value="SCRAP">Scrap</option></select></label>
              <label className="block"><span className={fieldLabelClass}>Sale proceeds</span><input className={controlClass} type="number" min="0" step="0.01" value={disposalForm.saleProceeds} onChange={(event) => setDisposalForm((previous) => ({ ...previous, saleProceeds: event.target.value }))} /><span className="mt-1 block text-[11px] text-slate-500">If proceeds are entered, the backend posts them to the standard cash ledger.</span></label>
              <label className="block"><span className={fieldLabelClass}>Gain / loss account</span><select className={controlClass} value={disposalForm.coaGainLossAccountId} onChange={(event) => setDisposalForm((previous) => ({ ...previous, coaGainLossAccountId: event.target.value }))}><option value="">Auto-create gain/loss ledger</option>{expenseAccounts.map((account) => <option key={getId(account)} value={getId(account)}>{account.code} · {account.name}</option>)}</select></label>
              <label className="block"><span className={fieldLabelClass}>Remarks</span><textarea className={`${controlClass} min-h-[80px] resize-y`} maxLength={1000} value={disposalForm.remarks} onChange={(event) => setDisposalForm((previous) => ({ ...previous, remarks: event.target.value }))} /></label>
              {panelError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{panelError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><Button variant="outline" type="button" onClick={closeDrawer} isDisabled={isSaving}>Cancel</Button><Button type="submit" isLoading={isSaving} className="bg-rose-700 hover:bg-rose-800 focus:ring-rose-500/30">Dispose Asset</Button></div>
          </form>}

          {drawerMode === 'details' && <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoadingDetails ? <p className="py-12 text-center text-sm text-slate-500">Loading asset details…</p> : viewingAsset ? <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[['Asset name', viewingAsset.assetName], ['Asset code', viewingAsset.assetCode], ['Purchase date', formatDate(viewingAsset.purchaseDate)], ['Status', STATUS_LABELS[viewingAsset.status] || viewingAsset.status], ['Purchase cost', formatCurrency(viewingAsset.purchaseCost)], ['Current book value', formatCurrency(viewingAsset.bookValue)], ['Salvage value', formatCurrency(viewingAsset.salvageValue)], ['Useful life', `${viewingAsset.usefulLifeYears} years`], ['Method', viewingAsset.depreciationMethod === 'WRITTEN_DOWN_VALUE' ? 'Written down value' : 'Straight line'], ['Rate', `${numberValue(viewingAsset.depreciationRatePercent)}%`]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</p></div>)}
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">Accounting ledgers</p>{[['Asset', viewingAsset.coaAssetAccountId], ['Depreciation expense', viewingAsset.coaDepreciationExpenseAccountId], ['Accumulated depreciation', viewingAsset.coaAccumulatedDepreciationAccountId]].map(([label, account]) => <div key={label} className="flex justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-700">{account?.code ? `${account.code} · ${account.name}` : account?.name || '—'}</span></div>)}</div>
              {viewingAsset.notes && <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-medium text-slate-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{viewingAsset.notes}</p></div>}
              {viewingAsset.disposalDetails && <div className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">Disposal details</p><p className="mt-2 text-xs text-slate-600">{formatDate(viewingAsset.disposalDetails.disposalDate)} · {viewingAsset.disposalDetails.disposalType} · Proceeds {formatCurrency(viewingAsset.disposalDetails.saleProceeds)} · Gain/loss {formatCurrency(viewingAsset.disposalDetails.gainLossAmount)}</p></div>}
            </div> : <p className="py-12 text-center text-sm text-slate-500">{panelError || 'Asset details are unavailable.'}</p>}
          </div>}
        </aside>
      </div>}
    </section>
  );
};
