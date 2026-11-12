import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileText,
  Plus,
  RotateCw,
  X,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';

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
const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const dateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const currentMonth = () => new Date().toISOString().slice(0, 7);
const periodInYear = (period, financialYear) => {
  if (!period || !financialYear) return false;
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const firstDate = `${period}-01`;
  const lastDate = `${period}-${String(lastDay).padStart(2, '0')}`;
  return firstDate >= dateInputValue(financialYear.startDate) &&
    lastDate <= dateInputValue(financialYear.endDate);
};

const statusClass = (status) => {
  if (status === 'FILED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PAID') return 'bg-cyan-50 text-cyan-700';
  return 'bg-amber-50 text-amber-700';
};

export const GSTReturnsManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [returns, setReturns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState(currentMonth());
  const [returnType, setReturnType] = useState('GSTR3B');
  const [financialYearFilter, setFinancialYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [challanNumber, setChallanNumber] = useState('');
  const [arn, setArn] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);

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
        if (!records.length) setLoadError('No company is available for GST Returns.');
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
        if (!records.length) setLoadError('Create a branch before preparing GST Returns.');
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load branches.')); })
      .finally(() => { if (active) setIsLoadingBranches(false); });
    return () => { active = false; };
  }, [companyId, canSelectAllBranches, userBranchId]);

  useEffect(() => {
    if (!branchId || branchId === 'all') {
      setFinancialYears([]);
      return undefined;
    }
    let active = true;
    setIsLoadingYears(true);
    api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load financial years.');
        setFinancialYears(getRecords(response.data?.data).filter((year) => year.isLocked !== true));
      })
      .catch((error) => { if (active) setSetupError(getErrorMessage(error, 'Could not load financial years.')); })
      .finally(() => { if (active) setIsLoadingYears(false); });
    return () => { active = false; };
  }, [branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !period) {
      setSummary(null);
      return undefined;
    }
    let active = true;
    setIsLoadingSummary(true);
    api.get(`/api/gst/returns-summary?companyId=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not calculate GST summary.');
        setSummary(response.data?.data || null);
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not calculate GST summary.')); })
      .finally(() => { if (active) setIsLoadingSummary(false); });
    return () => { active = false; };
  }, [companyId, period, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId || branchId === 'all') {
      setReturns([]);
      setIsLoadingReturns(false);
      return undefined;
    }
    let active = true;
    setIsLoadingReturns(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId, branchId });
    if (financialYearFilter !== 'all') params.set('financialYearId', financialYearFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    api.get(`/api/gst/return?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load GST Returns.');
        setReturns(getRecords(response.data?.data));
      })
      .catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Could not load GST Returns.')); })
      .finally(() => { if (active) setIsLoadingReturns(false); });
    return () => { active = false; };
  }, [companyId, branchId, financialYearFilter, statusFilter, reloadKey]);

  const selectedYear = financialYears.find((year) => getId(year) === financialYearFilter) ||
    financialYears.find((year) => getId(year) === (returns.find((item) => item.period === period)?.financialYearId)) ||
    financialYears[0];
  const currentReturnExists = returns.some((item) => (
    item.period === period && item.returnType === returnType
  ));
  const selectedPeriodInYear = periodInYear(period, selectedYear);
  const returnStats = useMemo(() => returns.reduce((result, item) => {
    result.netPayable += Number(item.netPayable || 0);
    result.taxableValue += Number(item.taxableValue || 0);
    if (item.status === 'FILED') result.filed += 1;
    if (item.status === 'DRAFT') result.draft += 1;
    return result;
  }, { netPayable: 0, taxableValue: 0, filed: 0, draft: 0 }), [returns]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setFinancialYears([]);
    setReturns([]);
    setSummary(null);
    setFinancialYearFilter('all');
    setLoadError('');
    setSetupError('');
  };

  const openCreateForm = () => {
    const firstYear = financialYears.find((year) => periodInYear(currentMonth(), year)) || financialYears[0];
    setFinancialYearFilter(getId(firstYear) || 'all');
    if (firstYear && !periodInYear(period, firstYear)) setPeriod(dateInputValue(firstYear.startDate).slice(0, 7));
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
    setFormError('');
    const financialYearId = financialYearFilter !== 'all'
      ? financialYearFilter
      : getId(financialYears.find((year) => periodInYear(period, year)));
    const financialYear = financialYears.find((year) => getId(year) === financialYearId);
    if (!companyId || !branchId || branchId === 'all' || !financialYear) {
      setFormError('Select a specific branch and open financial year.');
      return;
    }
    if (!periodInYear(period, financialYear)) {
      setFormError('The selected month must fall entirely within the financial year.');
      return;
    }
    if (currentReturnExists) {
      setFormError(`${returnType} already exists for ${period}.`);
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.post('/api/gst/return', {
        companyId,
        branchId,
        financialYearId,
        returnType,
        period,
        notes: '',
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'GST Return was not created.');
      }
      showToast(`${returnType} draft for ${period} created.`, 'success');
      setIsFormOpen(false);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create GST Return.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openAction = (gstReturn, action) => {
    setActionTarget({ gstReturn, action });
    setActionDate(new Date().toISOString().slice(0, 10));
    setChallanNumber('');
    setArn('');
    setActionError('');
  };

  const closeAction = () => {
    if (isSavingAction) return;
    setActionTarget(null);
    setActionError('');
  };

  const handleAction = async (event) => {
    event.preventDefault();
    if (!actionTarget) return;
    setIsSavingAction(true);
    setActionError('');
    try {
      const returnId = getId(actionTarget.gstReturn);
      const isPayAction = actionTarget.action === 'pay';
      const endpoint = isPayAction
        ? `/api/gst/return/${encodeURIComponent(returnId)}/pay`
        : `/api/gst/return/${encodeURIComponent(returnId)}/file`;
      const payload = isPayAction
        ? { paymentDate: actionDate, challanNumber: challanNumber.trim() }
        : { arn: arn.trim() };
      const response = await api.put(endpoint, payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'GST Return update failed.');
      }
      showToast(isPayAction ? 'GST challan payment recorded.' : 'GST Return marked as filed.', 'success');
      setActionTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not update GST Return.');
      setActionError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingAction(false);
    }
  };

  useEffect(() => {
    if (!isFormOpen && !actionTarget) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving && !isSavingAction) {
        setIsFormOpen(false);
        setActionTarget(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFormOpen, actionTarget, isSaving, isSavingAction]);

  const refreshReturns = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };
  const cards = [
    { title: 'Returns', value: returns.length.toLocaleString(), detail: `${returnStats.draft} draft · ${returnStats.filed} filed`, icon: FileText },
    { title: 'Taxable Value', value: formatCurrency(returnStats.taxableValue), detail: 'Current return register', icon: CalendarDays },
    { title: 'Net GST Payable', value: formatCurrency(returnStats.netPayable), detail: 'Current return register', icon: CheckCircle2 },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Tax &amp; Compliance</span><span aria-hidden="true">›</span><span className="font-semibold text-slate-800">GST Returns</span></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700"><FileText className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">GST Returns</h1><p className="mt-1 text-sm text-slate-500">Review GST summaries, prepare returns, and track challan and filing status.</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" leftIcon={RotateCw} onClick={refreshReturns} isDisabled={!companyId}>Refresh</Button><Button leftIcon={Plus} onClick={openCreateForm} className="bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-500/30" isDisabled={!companyId || !branchId || branchId === 'all' || !financialYears.length || isLoadingYears}>Prepare Return</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">{cards.map((card) => { const Icon = card.icon; return <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700"><Icon className="h-4 w-4" /></div><p className="text-xs font-medium text-slate-500">{card.title}</p><p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{card.value}</p><p className="mt-1 text-[11px] text-slate-400">{card.detail}</p></div>; })}</div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(190px,1fr)_200px_180px]">
          <label><span className="sr-only">Financial year filter</span><select className={`${CONTROL_CLASS} h-10`} value={financialYearFilter} onChange={(event) => setFinancialYearFilter(event.target.value)}><option value="all">All Financial Years</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
          <label><span className="sr-only">Status filter</span><select className={`${CONTROL_CLASS} h-10`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Statuses</option><option value="DRAFT">Draft</option><option value="PAID">Paid</option><option value="FILED">Filed</option></select></label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /><span className="sr-only">Summary period</span><input className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && <select aria-label="Company" className={`${CONTROL_CLASS} h-9 min-w-[220px]`} value={companyId} onChange={(event) => changeCompany(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select>}
          <label className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="sr-only">Branch</span><select className={`${CONTROL_CLASS} h-9 max-w-xs`} value={branchId} onChange={(event) => { setBranchId(event.target.value); setFinancialYearFilter('all'); }} disabled={isLoadingBranches}><option value="">Select branch</option>{canSelectAllBranches && <option value="all">All branches</option>}{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
          {branchId === 'all' && <p role="status" className="basis-full text-xs text-amber-700">Select a specific branch to prepare or manage returns.</p>}
        </div>
      </div>

      {summary && <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-sm font-semibold text-slate-800">GST Summary · {period}</h2><p className="text-[11px] text-slate-500">Company-wide source totals for the selected month</p></div>
        {summary.note && <p className="mt-1 text-[11px] text-slate-500">{summary.note}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ title: 'Output Tax Liability', value: summary.outputTax?.total }, { title: 'Input Tax Credit', value: summary.inputTax?.total }, { title: 'Net Payable', value: summary.netPayable }, { title: 'ITC Carry Forward', value: summary.itcCarryForward }].map((item) => <div key={item.title} className="rounded-lg border border-white bg-white/80 p-3"><p className="text-[11px] font-medium text-slate-500">{item.title}</p><p className="mt-1 text-base font-bold tabular-nums text-slate-900">{isLoadingSummary ? 'Calculating…' : formatCurrency(item.value)}</p></div>)}
        </div>
      </div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Return Type</th><th className="px-4 py-3 text-right">Taxable Value</th><th className="px-4 py-3 text-right">Output Tax</th><th className="px-4 py-3 text-right">Input Tax Credit</th><th className="px-4 py-3 text-right">Net Payable</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{isLoadingReturns ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading GST Returns…</td></tr>
            : returns.length === 0 ? <tr><td colSpan="8" className="px-4 py-14 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">{branchId === 'all' ? 'Select a branch to view returns' : 'No GST Returns found'}</p><p className="mt-1 text-xs text-slate-500">Prepare a GSTR-1 or GSTR-3B draft for an open financial year.</p></td></tr>
              : returns.map((item) => <tr key={getId(item)} className="transition-colors hover:bg-cyan-50/30"><td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{item.period}</td><td className="px-4 py-3 text-slate-700">{item.returnType}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(item.taxableValue)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(item.outputTax)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(item.inputTaxCredit)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(item.netPayable)}</td><td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>{item.status}</span></td><td className="px-4 py-3 text-right">{item.status === 'DRAFT' ? <button type="button" onClick={() => openAction(item, 'pay')} className="rounded-md border border-cyan-200 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50">Record challan</button> : item.status === 'PAID' ? <button type="button" onClick={() => openAction(item, 'file')} className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">File return</button> : <span className="text-xs text-slate-400">{item.arn || 'Completed'}</span>}</td></tr>)}</tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{returns.length} return{returns.length === 1 ? '' : 's'} in selected scope</span><span>Draft → Paid → Filed</span></div>
      </div>

      {isFormOpen && <div className="fixed inset-x-0 bottom-0 top-[64px] z-[70]">
        <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25" aria-label="Close GST return form" onClick={closeForm} />
        <aside role="dialog" aria-modal="true" aria-labelledby="create-gst-return-title" className="absolute inset-y-0 right-0 flex w-full max-w-[540px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><FileText className="h-4 w-4" /></div><div><h2 id="create-gst-return-title" className="text-base font-bold text-slate-900">Prepare GST Return</h2><p className="mt-0.5 text-[11px] text-slate-500">Create a draft from the selected period summary</p></div></div><button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
          <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block"><span className={LABEL_CLASS}>Branch <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={branchId} onChange={(event) => setBranchId(event.target.value)} required disabled={isSaving}><option value="">Select branch</option>{selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
              <label className="block"><span className={LABEL_CLASS}>Financial Year <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={financialYearFilter === 'all' ? '' : financialYearFilter} onChange={(event) => setFinancialYearFilter(event.target.value || 'all')} required disabled={isSaving}><option value="">Select open financial year</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={LABEL_CLASS}>Return Type <span className="text-rose-500">*</span></span><select className={CONTROL_CLASS} value={returnType} onChange={(event) => setReturnType(event.target.value)} disabled={isSaving}><option value="GSTR3B">GSTR-3B</option><option value="GSTR1">GSTR-1</option></select></label>
                <label><span className={LABEL_CLASS}>Tax Period <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="month" value={period} onChange={(event) => setPeriod(event.target.value)} required disabled={isSaving} /></label>
              </div>
              {summary && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">Period tax summary</p>{isLoadingSummary && <span className="text-[11px] text-slate-500">Refreshing…</span>}</div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-500">Taxable sales</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(summary.outputTax?.taxableValue)}</p></div><div><p className="text-slate-500">Output GST</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(summary.outputTax?.total)}</p></div><div><p className="text-slate-500">Input tax credit</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(summary.inputTax?.total)}</p></div><div><p className="text-slate-500">Net payable</p><p className="mt-1 font-semibold text-slate-800">{formatCurrency(summary.netPayable)}</p></div></div></div>}
              {currentReturnExists && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">A {returnType} return already exists for {period}.</p>}
              {!selectedPeriodInYear && selectedYear && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Choose a month fully inside {selectedYear.yearLabel}.</p>}
              {setupError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
              {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
              <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">This creates a draft return. Record the GST challan after payment, then file it using the ARN.</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><span className="text-xs text-slate-500">{period || 'Select tax period'}</span><div className="flex gap-2"><Button variant="outline" type="button" onClick={closeForm} isDisabled={isSaving}>Cancel</Button><Button type="submit" leftIcon={Plus} isLoading={isSaving} isDisabled={currentReturnExists || !selectedPeriodInYear}>Create Draft</Button></div></div>
          </form>
        </aside>
      </div>}

      {actionTarget && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4">
        <button type="button" aria-label="Close GST return action" className="absolute inset-0 cursor-default" onClick={closeAction} />
        <section role="dialog" aria-modal="true" aria-labelledby="gst-return-action-title" className="relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between"><div><h2 id="gst-return-action-title" className="text-lg font-bold text-slate-900">{actionTarget.action === 'pay' ? 'Record GST Challan' : 'File GST Return'}</h2><p className="mt-1 text-xs text-slate-500">{actionTarget.gstReturn.returnType} · {actionTarget.gstReturn.period}</p></div><button type="button" aria-label="Close" onClick={closeAction} disabled={isSavingAction} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
          <form onSubmit={handleAction} className="mt-4 space-y-4">
            {actionTarget.action === 'pay' ? <><label className="block"><span className={LABEL_CLASS}>Payment Date <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} type="date" value={actionDate} onChange={(event) => setActionDate(event.target.value)} required disabled={isSavingAction} /></label><label className="block"><span className={LABEL_CLASS}>Challan Number <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={challanNumber} onChange={(event) => setChallanNumber(event.target.value)} maxLength={100} required disabled={isSavingAction} /></label><p className="text-[11px] text-slate-500">This records the challan details and advances the return status; it does not initiate a bank payment.</p></>
              : <><label className="block"><span className={LABEL_CLASS}>ARN <span className="text-rose-500">*</span></span><input className={CONTROL_CLASS} value={arn} onChange={(event) => setArn(event.target.value)} maxLength={100} required disabled={isSavingAction} /></label><p className="text-[11px] text-slate-500">Filing is available only after the challan payment has been recorded.</p></>}
            {actionError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeAction} isDisabled={isSavingAction}>Cancel</Button><Button type="submit" leftIcon={actionTarget.action === 'pay' ? CheckCircle2 : FileCheck2} isLoading={isSavingAction}>{actionTarget.action === 'pay' ? 'Confirm Payment' : 'Mark Filed'}</Button></div>
          </form>
        </section>
      </div>}
    </section>
  );
};
