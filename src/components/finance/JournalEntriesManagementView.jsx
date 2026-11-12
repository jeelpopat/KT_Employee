import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  BookOpen,
  CalendarDays,
  CircleAlert,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  Layers3,
  Pencil,
  Plus,
  RotateCcw,
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
import { useApp } from '../../context/AppContext.jsx';

const EMPTY_LINE = { accountId: '', debit: '', credit: '', remarks: '' };
const EMPTY_FORM = {
  financialYearId: '',
  entryDate: new Date().toISOString().slice(0, 10),
  reference: '',
  narration: '',
  lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
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

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const getAccountLabel = (account) => [account?.code, account?.name].filter(Boolean).join(' · ');
const getLineTotal = (lines, field) => Math.round(
  lines.reduce((total, line) => total + (Number(line[field]) || 0), 0) * 100
) / 100;

const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const fieldLabelClass = 'mb-1 block text-xs font-medium text-slate-600';

export const JournalEntriesManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [reversingEntryId, setReversingEntryId] = useState('');

  const activeAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeAccess?.role || user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) ||
    user?.companyCreated === true;

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
        else if (!records.length) setLoadError('No company is available for Journal Entries.');
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
        if (!records.length) setLoadError('Create a branch before using Journal Entries.');
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
    const accountParams = new URLSearchParams({ companyId, branchId, includeInactive: 'false' });
    const yearRequest = branchId === 'all'
      ? Promise.resolve({ data: { success: true, data: [] } })
      : api.get(`/api/financial-year?branchId=${encodeURIComponent(branchId)}`);
    Promise.all([
      api.get(`/api/coa?${accountParams.toString()}`),
      yearRequest,
    ])
      .then(([accountResponse, yearResponse]) => {
        if (!active) return;
        if (accountResponse.data?.success === false) {
          throw new Error(accountResponse.data.message || 'Could not load Chart of Accounts.');
        }
        if (yearResponse.data?.success === false) {
          throw new Error(yearResponse.data.message || 'Could not load financial years.');
        }
        const accountRecords = Array.isArray(accountResponse.data?.data) ? accountResponse.data.data : [];
        const yearRecords = Array.isArray(yearResponse.data?.data) ? yearResponse.data.data : [];
        setAccounts(accountRecords.filter((account) => account.isActive !== false && !account.isGroup));
        const openYears = yearRecords.filter((year) => year.isLocked !== true);
        setFinancialYears(openYears);
        setSelectedYearId((current) => (
          openYears.some((year) => getId(year) === current)
            ? current
            : getId(openYears.find((year) => {
              const today = new Date().toISOString().slice(0, 10);
              return today >= new Date(year.startDate).toISOString().slice(0, 10) &&
                today <= new Date(year.endDate).toISOString().slice(0, 10);
            }) || openYears[0])
        ));
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load Journal Entry setup.'));
      })
      .finally(() => {
        if (active) setIsLoadingSetup(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, reloadKey]);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;
    let active = true;
    const params = new URLSearchParams({ companyId });
    params.set('branchId', branchId);
    if (selectedYearId) params.set('financialYearId', selectedYearId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    api.get(`/api/journal-entry?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) throw new Error(response.data.message || 'Could not load journal entries.');
        setEntries(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load journal entries.'));
      })
      .finally(() => {
        if (active) setIsLoadingEntries(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, selectedYearId, fromDate, toDate, reloadKey]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [getId(account), account])), [accounts]);
  const totals = useMemo(() => ({
    debit: getLineTotal(form.lines, 'debit'),
    credit: getLineTotal(form.lines, 'credit'),
  }), [form.lines]);
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const source = entry.entrySource || 'AUTOMATIC';
      const matchesSource = sourceFilter === 'all' || source === sourceFilter;
      const status = entry.isReversed ? 'reversed' : entry.reversedFrom ? 'reversal' : 'posted';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesSearch = !query || [
        entry.reference,
        entry.narration,
        entry._id,
        source === 'MANUAL' ? 'manual' : 'automatic',
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesSource && matchesStatus && matchesSearch;
    });
  }, [entries, search, sourceFilter, statusFilter]);

  const totalDebit = getLineTotal(entries, 'totalDebit');
  const totalCredit = getLineTotal(entries, 'totalCredit');
  const manualEntryCount = entries.filter((entry) => entry.entrySource === 'MANUAL').length;
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const visibleEntries = filteredEntries.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const firstVisibleEntry = filteredEntries.length ? (visiblePage - 1) * pageSize + 1 : 0;
  const lastVisibleEntry = Math.min(visiblePage * pageSize, filteredEntries.length);

  const selectableBranches = userBranchId && !canSelectAllBranches
    ? branches.filter((branch) => getId(branch) === userBranchId)
    : branches;
  const isLoading = isLoadingCompanies || isLoadingBranches || isLoadingSetup;

  const changeCompany = (value) => {
    setCompanyId(value);
    setBranchId('');
    setBranches([]);
    setFinancialYears([]);
    setAccounts([]);
    setEntries([]);
    setSelectedYearId('');
    setPage(1);
    setLoadError('');
    setIsLoadingBranches(Boolean(value));
    setIsLoadingSetup(false);
    setIsLoadingEntries(false);
  };

  const changeBranch = (value) => {
    setBranchId(value);
    setFinancialYears([]);
    setAccounts([]);
    setEntries([]);
    setSelectedYearId('');
    setPage(1);
    setLoadError('');
    setIsLoadingSetup(Boolean(value));
    setIsLoadingEntries(Boolean(value));
  };

  const openCreateForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = financialYears.find((item) => (
      today >= new Date(item.startDate).toISOString().slice(0, 10) &&
      today <= new Date(item.endDate).toISOString().slice(0, 10)
    )) || financialYears[0];
    setForm({ ...EMPTY_FORM, financialYearId: getId(year), entryDate: today, lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError('');
  };

  const changeLine = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, lineIndex) => (
        lineIndex === index
          ? {
            ...line,
            [field]: value,
            ...(field === 'debit' && Number(value) > 0 ? { credit: '' } : {}),
            ...(field === 'credit' && Number(value) > 0 ? { debit: '' } : {}),
          }
          : line
      )),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!companyId || !form.financialYearId || !form.entryDate) {
      setFormError('Select a company, open financial year, and entry date.');
      return;
    }
    if (branchId === 'all') {
      setFormError('Select a specific branch before creating a manual journal entry.');
      return;
    }
    if (form.lines.length < 2 || form.lines.some((line) => (
      !line.accountId ||
      ((Number(line.debit) || 0) <= 0 && (Number(line.credit) || 0) <= 0) ||
      ((Number(line.debit) || 0) > 0 && (Number(line.credit) || 0) > 0)
    ))) {
      setFormError('Each of at least two lines must have an account and either a debit or credit amount.');
      return;
    }
    if (Math.abs(totals.debit - totals.credit) > 0.0001) {
      setFormError('Total debit must equal total credit.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const response = await api.post('/api/journal-entry', {
        companyId,
        branchId,
        financialYearId: form.financialYearId,
        entryDate: form.entryDate,
        reference: form.reference.trim(),
        narration: form.narration.trim(),
        lines: form.lines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          remarks: line.remarks.trim(),
        })),
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Journal entry was not saved.');
      }
      showToast('Manual journal entry created successfully.', 'success');
      setIsFormOpen(false);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save this journal entry.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const reverseEntry = async (entry) => {
    const entryId = getId(entry);
    if (!window.confirm('Create a reversal for this manual journal entry?')) return;
    setReversingEntryId(entryId);
    try {
      const response = await api.delete(`/api/journal-entry/${encodeURIComponent(entryId)}`);
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Could not reverse this entry.');
      }
      showToast('Journal entry reversed successfully.', 'success');
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not reverse this entry.'), 'error');
    } finally {
      setReversingEntryId('');
    }
  };

  const viewEntry = (entry) => {
    setViewingEntry({
      ...entry,
      lines: (entry.lines || []).map((line) => ({
        ...line,
        account: accountById.get(getId(line.accountId)) ||
          (line.accountId && typeof line.accountId === 'object' ? line.accountId : null),
      })),
    });
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

  const refreshEntries = () => {
    setIsLoadingSetup(Boolean(companyId && branchId));
    setIsLoadingEntries(Boolean(companyId && branchId));
    setLoadError('');
    setReloadKey((previous) => previous + 1);
  };

  const summaryCards = [
    { title: 'Total Entries', value: entries.length.toLocaleString(), detail: 'Manual and automatic', icon: FileText, tone: 'blue' },
    { title: 'Total Debit', value: formatCurrency(totalDebit), detail: 'Selected period', icon: CircleDollarSign, tone: 'emerald' },
    { title: 'Total Credit', value: formatCurrency(totalCredit), detail: 'Selected period', icon: Wallet, tone: 'violet' },
    { title: 'Manual Entries', value: manualEntryCount.toLocaleString(), detail: 'Created from this screen', icon: Layers3, tone: 'amber' },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Accounts</span>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-slate-800">Journal Entries</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Journal Entries</h1>
            <p className="mt-1 text-sm text-slate-500">Manage, create and track all journal transactions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={RotateCw} onClick={refreshEntries} isDisabled={!companyId}>
            Refresh
          </Button>
          <Button
            onClick={openCreateForm}
            leftIcon={Plus}
            className="bg-sky-700 hover:bg-sky-800 focus:ring-sky-500/30"
            isDisabled={isLoading || !companyId || !branchId || branchId === 'all' || !financialYears.length || !accounts.length}
          >
            Create Journal Entry
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
              <div className={`pointer-events-none absolute -bottom-8 -right-5 h-20 w-28 rounded-full opacity-20 blur-2xl ${card.tone === 'emerald' ? 'bg-emerald-400' : card.tone === 'violet' ? 'bg-violet-400' : card.tone === 'amber' ? 'bg-amber-400' : 'bg-sky-400'}`} />
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[130px_140px_160px_minmax(190px,1.3fr)_minmax(170px,1.3fr)]">
          <label>
            <span className="sr-only">Status</span>
            <select
              className={`${controlClass} h-10`}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
            >
              <option value="all">All Status</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
              <option value="reversal">Reversal Entries</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Source</span>
            <select
              className={`${controlClass} h-10`}
              value={sourceFilter}
              onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}
            >
              <option value="all">All Sources</option>
              <option value="MANUAL">Manual</option>
              <option value="AUTOMATIC">Automatic</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Financial year</span>
            <select
              className={`${controlClass} h-10`}
              value={selectedYearId}
              onChange={(event) => { setSelectedYearId(event.target.value); setPage(1); }}
            >
              <option value="">All Periods</option>
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
            <span className="sr-only">Search entries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${controlClass} h-10 pl-9`}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search by entry no. / narration..."
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
            <select className={`${controlClass} h-9 max-w-xs`} value={branchId} onChange={(event) => changeBranch(event.target.value)} disabled={isLoadingBranches}>
              <option value="">Select branch</option>
              {canSelectAllBranches && <option value="all">All branches</option>}
              {selectableBranches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}
            </select>
          </label>
        </div>
        {loadError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Entry No.</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingEntries ? (
                <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading journal entries…</td></tr>
              ) : visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-14 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No journal entries found</p>
                    <p className="mt-1 text-xs text-slate-500">Manual adjustments and automatic transaction entries appear here.</p>
                  </td>
                </tr>
              ) : visibleEntries.map((entry) => {
                const source = entry.entrySource || 'AUTOMATIC';
                const entryId = getId(entry);
                const status = entry.isReversed
                  ? { label: 'Reversed', className: 'bg-rose-50 text-rose-700' }
                  : entry.reversedFrom
                    ? { label: 'Reversal', className: 'bg-violet-50 text-violet-700' }
                    : { label: 'Posted', className: 'bg-emerald-50 text-emerald-700' };
                return (
                  <tr key={entryId} className="transition-colors hover:bg-sky-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">{formatDate(entry.entryDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">JV-{entryId.slice(-6).toUpperCase()}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{entry.reference || '—'}</td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-medium text-slate-700" title={entry.narration}>{entry.narration || '—'}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${source === 'MANUAL' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                        {source === 'MANUAL' ? 'Manual Entry' : 'Automatic'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(entry.totalDebit)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatCurrency(entry.totalCredit)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="View details" aria-label="View journal entry" onClick={() => viewEntry(entry)}>
                          <Eye className="h-4 w-4 text-slate-500" />
                        </Button>
                        {source === 'MANUAL' && !entry.isReversed && !entry.reversedFrom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reverse manual entry"
                            aria-label="Reverse manual entry"
                            isLoading={reversingEntryId === entryId}
                            onClick={() => reverseEntry(entry)}
                          >
                            <RotateCcw className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {firstVisibleEntry} to {lastVisibleEntry} of {filteredEntries.length.toLocaleString()} entries</span>
          <div className="flex items-center justify-end gap-1">
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page" disabled={visiblePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                className={`min-w-8 rounded-md border px-2 py-1.5 ${visiblePage === pageNumber ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            {pageCount > 5 && <span className="px-1">… {pageCount}</span>}
            <button type="button" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page" disabled={visiblePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

          {isFormOpen && (
            <div className="fixed inset-x-0 bottom-0 top-[72px] z-[70]">
              <button
                type="button"
                className="absolute inset-0 h-full w-full cursor-default bg-slate-950/25"
                aria-label="Close journal entry form"
                onClick={closeForm}
              />
              <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-journal-title"
                className="absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col border-l border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                      <Pencil className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 id="create-journal-title" className="text-base font-bold text-slate-900">Create Journal Entry</h2>
                      <p className="mt-0.5 text-[11px] text-slate-500">Manual accounting entry</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={isSaving}
                    aria-label="Close create journal entry"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="border-b border-slate-100 px-5">
                  <div className="inline-flex border-b-2 border-sky-600 px-1 py-3 text-xs font-semibold text-sky-700">General</div>
                </div>

                <form id="manual-journal-form" onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <label className="block">
                      <span className={fieldLabelClass}>Entry Date <span className="text-rose-500">*</span></span>
                      <input
                        className={controlClass}
                        type="date"
                        value={form.entryDate}
                        onChange={(event) => setForm((previous) => ({ ...previous, entryDate: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>Financial Year <span className="text-rose-500">*</span></span>
                      <select
                        className={controlClass}
                        value={form.financialYearId}
                        onChange={(event) => setForm((previous) => ({ ...previous, financialYearId: event.target.value }))}
                        required
                      >
                        <option value="">Select open financial year</option>
                        {financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>Reference Number</span>
                      <input
                        className={controlClass}
                        value={form.reference}
                        onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value }))}
                        maxLength={255}
                        placeholder="e.g. REF-107"
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabelClass}>Narration <span className="text-rose-500">*</span></span>
                      <textarea
                        className={`${controlClass} min-h-[82px] resize-y`}
                        value={form.narration}
                        onChange={(event) => setForm((previous) => ({ ...previous, narration: event.target.value }))}
                        maxLength={5000}
                        placeholder="Describe the reason for this journal entry"
                        required
                      />
                      <span className="mt-1 block text-right text-[10px] text-slate-400">{form.narration.length}/5000</span>
                    </label>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-800">Ledger Details</h3>
                        <span className="text-[10px] text-slate-400">Debit and credit must balance</span>
                      </div>
                      <div className="rounded-lg border border-slate-200">
                        <div className="grid grid-cols-[minmax(0,1fr)_74px_74px_28px] gap-1 rounded-t-lg bg-slate-50 px-2 py-2 text-[10px] font-semibold text-slate-500">
                          <span>Ledger Account</span>
                          <span className="text-right">Debit (₹)</span>
                          <span className="text-right">Credit (₹)</span>
                          <span />
                        </div>
                        <div className="divide-y divide-slate-100">
                          {form.lines.map((line, index) => (
                            <div key={`line-${index}`} className="space-y-1.5 px-2 py-2">
                              <div className="grid grid-cols-[minmax(0,1fr)_74px_74px_28px] items-center gap-1">
                                <select
                                  className={`${controlClass} min-w-0 px-2 text-xs`}
                                  value={line.accountId}
                                  onChange={(event) => changeLine(index, 'accountId', event.target.value)}
                                  aria-label={`Ledger account for line ${index + 1}`}
                                >
                                  <option value="">Select account</option>
                                  {accounts.map((account) => <option key={getId(account)} value={getId(account)}>{getAccountLabel(account)}</option>)}
                                </select>
                                <input
                                  className={`${controlClass} min-w-0 px-1.5 text-right text-xs tabular-nums`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.debit}
                                  onChange={(event) => changeLine(index, 'debit', event.target.value)}
                                  aria-label={`Debit for line ${index + 1}`}
                                  placeholder="—"
                                />
                                <input
                                  className={`${controlClass} min-w-0 px-1.5 text-right text-xs tabular-nums`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.credit}
                                  onChange={(event) => changeLine(index, 'credit', event.target.value)}
                                  aria-label={`Credit for line ${index + 1}`}
                                  placeholder="—"
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove line ${index + 1}`}
                                  className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                                  disabled={form.lines.length <= 2}
                                  onClick={() => setForm((previous) => ({ ...previous, lines: previous.lines.filter((_, lineIndex) => lineIndex !== index) }))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <input
                                className={`${controlClass} px-2 py-1.5 text-xs`}
                                value={line.remarks}
                                onChange={(event) => changeLine(index, 'remarks', event.target.value)}
                                maxLength={1000}
                                placeholder="Line remarks (optional)"
                                aria-label={`Remarks for line ${index + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-100 px-2 py-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
                            onClick={() => setForm((previous) => ({ ...previous, lines: [...previous.lines, { ...EMPTY_LINE }] }))}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Row
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between rounded-lg px-3 py-3 text-xs ${Math.abs(totals.debit - totals.credit) <= 0.0001 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-800'}`}>
                      <div className="flex items-center gap-2">
                        {Math.abs(totals.debit - totals.credit) <= 0.0001
                          ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                          : <CircleAlert className="h-4 w-4 shrink-0" />}
                        <span className="font-semibold">Total Debit</span>
                        <span className="font-bold tabular-nums">{formatCurrency(totals.debit)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Total Credit</span>
                        <span className="font-bold tabular-nums">{formatCurrency(totals.credit)}</span>
                      </div>
                    </div>
                    <p className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-800">
                      This creates a manual journal entry. Expenses, income, payments and receipts should be entered in their own modules.
                    </p>
                    {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
                  </div>
                  <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
                    <Button variant="outline" onClick={closeForm} isDisabled={isSaving}>Cancel</Button>
                    <Button type="submit" isLoading={isSaving} className="bg-sky-700 hover:bg-sky-800">
                      Post Entry
                    </Button>
                  </div>
                </form>
              </aside>
            </div>
          )}

      <Modal
        isOpen={Boolean(viewingEntry)}
        onClose={() => setViewingEntry(null)}
        title="Journal entry details"
        subtitle={viewingEntry?.reference || getId(viewingEntry).slice(-8)}
        size="xl"
        footer={<Button variant="outline" onClick={() => setViewingEntry(null)}>Close</Button>}
      >
        {viewingEntry && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><span className={fieldLabelClass}>Date</span><p className="text-sm font-medium text-slate-800">{formatDate(viewingEntry.entryDate)}</p></div>
              <div><span className={fieldLabelClass}>Source</span><p className="text-sm font-medium text-slate-800">{viewingEntry.entrySource === 'MANUAL' ? 'Manual' : 'Automatic'}</p></div>
              <div><span className={fieldLabelClass}>Status</span><p className="text-sm font-medium text-slate-800">{viewingEntry.isReversed ? 'Reversed' : viewingEntry.reversedFrom ? 'Reversal entry' : 'Posted'}</p></div>
            </div>
            <div><span className={fieldLabelClass}>Narration</span><p className="text-sm text-slate-700">{viewingEntry.narration || '—'}</p></div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-3 py-2">Account</th><th className="px-3 py-2">Remarks</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingEntry.lines || []).map((line, index) => (
                    <tr key={getId(line) || index}>
                      <td className="px-3 py-2 font-medium text-slate-800">{getAccountLabel(line.account) || getId(line.accountId)}</td>
                      <td className="px-3 py-2 text-slate-600">{line.remarks || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(line.debit) ? formatCurrency(line.debit) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(line.credit) ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr><td colSpan="2" className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{formatCurrency(viewingEntry.totalDebit)}</td><td className="px-3 py-2 text-right">{formatCurrency(viewingEntry.totalCredit)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};

export default JournalEntriesManagementView;
