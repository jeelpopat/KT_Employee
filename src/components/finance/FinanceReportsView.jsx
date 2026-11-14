import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { useApp } from '../../context/AppContext.jsx';

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const ALL_BRANCHES = 'all';
const REPORTS = {
  '/finance/reports/profit-loss': {
    type: 'profit-loss',
    title: 'Profit & Loss',
    description: 'Review income, expenses, and net profit for the selected period.',
  },
  '/finance/reports/balance-sheet': {
    type: 'balance-sheet',
    title: 'Balance Sheet',
    description: 'Review assets, liabilities, and equity as of the selected date.',
  },
  '/finance/reports/trial-balance': {
    type: 'trial-balance',
    title: 'Trial Balance',
    description: 'Compare debit and credit balances across your accounts.',
  },
  '/finance/reports/gst-report': {
    type: 'gst',
    title: 'GST Report',
    description: 'Review output tax, input tax, and net GST payable.',
  },
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

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const REPORT_ROWS = {
  'trial-balance': (report) => (report?.accounts || []).map((account) => ({
    section: '',
    code: account.code || '—',
    name: account.name || '—',
    debit: Number(account.debit) || 0,
    credit: Number(account.credit) || 0,
    balance: `${formatCurrency(account.balance)} ${account.balanceType || ''}`.trim(),
  })),
  'profit-loss': (report) => (report?.lines || []).flatMap((group) => (
    (group.accounts || []).map((account) => ({
      section: String(group.group || '').replaceAll('_', ' '),
      code: '',
      name: account.name || '—',
      amount: Number(account.amount) || 0,
    }))
  )),
  'balance-sheet': (report) => [
    ...(report?.assets || []).map((account) => ({
      section: 'ASSETS',
      code: account.code || '—',
      name: account.name || '—',
      amount: Number(account.balance) || 0,
    })),
    ...(report?.liabilities || []).map((account) => ({
      section: 'LIABILITIES',
      code: account.code || '—',
      name: account.name || '—',
      amount: Number(account.balance) || 0,
    })),
    ...(report?.equity || []).map((account) => ({
      section: 'EQUITY',
      code: account.code || '—',
      name: account.name || '—',
      amount: Number(account.balance) || 0,
    })),
  ],
  gst: (report) => (report?.details || []).map((detail) => ({
    section: detail.gstType || 'GST',
    code: `${Number(detail.ratePercent) || 0}%`,
    name: detail.taxName || 'GST',
    outputTax: Number(detail.outputTax) || 0,
    inputTax: Number(detail.inputTax) || 0,
    net: Number(detail.net) || 0,
  })),
};

const REPORT_COLUMNS = {
  'trial-balance': [
    ['code', 'Code'], ['name', 'Account'], ['debit', 'Debit'], ['credit', 'Credit'], ['balance', 'Balance'],
  ],
  'profit-loss': [['section', 'Section'], ['name', 'Account'], ['amount', 'Amount']],
  'balance-sheet': [['section', 'Section'], ['code', 'Code'], ['name', 'Account'], ['amount', 'Balance']],
  gst: [['section', 'Type'], ['code', 'Rate'], ['name', 'Tax'], ['outputTax', 'Output tax'], ['inputTax', 'Input tax'], ['net', 'Net payable']],
};

const SUMMARY_CARDS = {
  'trial-balance': (report) => [
    { label: 'Total Debit', value: formatCurrency(report?.totals?.debit) },
    { label: 'Total Credit', value: formatCurrency(report?.totals?.credit) },
    { label: 'Accounts', value: (report?.accounts || []).length.toLocaleString('en-IN') },
  ],
  'profit-loss': (report) => [
    { label: 'Total Income', value: formatCurrency(report?.totalIncome) },
    { label: 'Total Expenses', value: formatCurrency(report?.totalExpenses) },
    { label: 'Net Profit / Loss', value: formatCurrency(report?.netProfit) },
  ],
  'balance-sheet': (report) => [
    { label: 'Total Assets', value: formatCurrency(report?.totals?.assets) },
    { label: 'Total Liabilities', value: formatCurrency(report?.totals?.liabilities) },
    { label: 'Total Equity', value: formatCurrency(report?.totals?.equity) },
  ],
  gst: (report) => [
    { label: 'Output Tax', value: formatCurrency(report?.summary?.outputTax) },
    { label: 'Input Tax', value: formatCurrency(report?.summary?.inputTax) },
    { label: 'Net GST Payable', value: formatCurrency(report?.summary?.netPayable) },
  ],
};

export const FinanceReportsView = () => {
  const { pathname } = useLocation();
  const { user } = useApp();
  const reportConfig = REPORTS[pathname] || REPORTS['/finance/reports/trial-balance'];
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchesCompanyId, setBranchesCompanyId] = useState('');
  const [financialYears, setFinancialYears] = useState([]);
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [financialYearId, setFinancialYearId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(Boolean(preferredCompanyId));
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!records.length) setSetupError('No company is available for reports.');
      })
      .catch((requestError) => { if (active) setSetupError(getErrorMessage(requestError, 'Could not load companies.')); });
    return () => { active = false; };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      setBranchesCompanyId('');
      setFinancialYears([]);
      setReport(null);
      setIsLoadingSetup(false);
      return undefined;
    }
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((branchResponse) => {
      if (!active) return;
      if (branchResponse.data?.success === false) throw new Error(branchResponse.data.message || 'Could not load branches.');
      const records = getRecords(branchResponse.data?.data);
      setBranches(records);
      setBranchesCompanyId(companyId);
      setBranchId((current) => records.some((branch) => getId(branch) === current) ? current : ALL_BRANCHES);
      setReport(null);
    }).catch((requestError) => {
      if (active) setSetupError(getErrorMessage(requestError, 'Could not load report filters.'));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, reloadKey]);

  useEffect(() => {
    if (!companyId || branchesCompanyId !== companyId) {
      setFinancialYears([]);
      return undefined;
    }
    const selectedBranches = branchId === ALL_BRANCHES
      ? []
      : branches.filter((branch) => getId(branch) === branchId);
    if (!selectedBranches.length) {
      setFinancialYears([]);
      setFinancialYearId('');
      return undefined;
    }
    let active = true;
    setIsLoadingSetup(true);
    setSetupError('');
    Promise.all(selectedBranches.map((branch) => (
      api.get(`/api/financial-year?branchId=${encodeURIComponent(getId(branch))}`)
    ))).then((responses) => {
      if (!active) return;
      const years = responses.flatMap((response) => {
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load financial years.');
        }
        return getRecords(response.data?.data);
      });
      setFinancialYears([...new Map(years.map((year) => [getId(year), year])).values()]);
      setFinancialYearId('');
    }).catch((requestError) => {
      if (active) setSetupError(getErrorMessage(requestError, 'Could not load financial years.'));
    }).finally(() => { if (active) setIsLoadingSetup(false); });
    return () => { active = false; };
  }, [companyId, branchesCompanyId, branches, branchId]);

  const params = useMemo(() => {
    const query = new URLSearchParams({ companyId });
    if (branchId !== ALL_BRANCHES) query.set('branchId', branchId);
    if (financialYearId) query.set('financialYearId', financialYearId);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return query;
  }, [companyId, branchId, financialYearId, from, to]);

  const rows = useMemo(() => REPORT_ROWS[reportConfig.type](report), [report, reportConfig]);
  const columns = REPORT_COLUMNS[reportConfig.type];
  const cards = report ? SUMMARY_CARDS[reportConfig.type](report) : [];

  const generateReport = async () => {
    if (!companyId) {
      setError('Select a company before generating a report.');
      return;
    }
    if (from && to && from > to) {
      setError('From date must be on or before the To date.');
      return;
    }
    setIsLoadingReport(true);
    setError('');
    try {
      const response = await api.get(`/api/reports/${reportConfig.type}?${params.toString()}`);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Report data was not returned.');
      }
      setReport(response.data.data);
    } catch (requestError) {
      setReport(null);
      setError(getErrorMessage(requestError, `Could not load the ${reportConfig.title} report.`));
    } finally {
      setIsLoadingReport(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const csvRows = [
      columns.map(([, label]) => label),
      ...rows.map((row) => columns.map(([key]) => row[key] ?? '')),
    ];
    const csv = csvRows.map((row) => row.map((value) => (
      `"${String(value).replaceAll('"', '""')}"`
    )).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportConfig.type}-${from || report?.period?.from || 'report'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!report) return;
    setIsExporting(true);
    setError('');
    try {
      const response = await api.get(`/api/reports/${reportConfig.type}/pdf?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportConfig.type}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not download the PDF report.'));
    } finally {
      setIsExporting(false);
    }
  };

  const renderCell = (key, value) => {
    if (['debit', 'credit', 'amount', 'outputTax', 'inputTax', 'net'].includes(key)) {
      return formatCurrency(value);
    }
    return value || '—';
  };

  return (
    <section className="mx-auto max-w-[1480px] space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><BarChart3 className="h-6 w-6" /></div>
          <div><p className="text-xs font-medium text-slate-500">Finance / Reports</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{reportConfig.title}</h1><p className="mt-1 text-sm text-slate-500">{reportConfig.description}</p></div>
        </div>
        <Button variant="outline" leftIcon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)} isDisabled={isLoadingSetup}>Refresh filters</Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {!preferredCompanyId && <label><span className="mb-1 block text-xs font-medium text-slate-600">Company</span><select className={CONTROL_CLASS} value={companyId} onChange={(event) => { setCompanyId(event.target.value); setReport(null); }}><option value="">Select company</option>{companies.map((company) => <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>)}</select></label>}
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Branch</span><select className={CONTROL_CLASS} value={branchId} onChange={(event) => { setBranchId(event.target.value); setReport(null); }} disabled={isLoadingSetup}><option value={ALL_BRANCHES}>All branches</option>{branches.map((branch) => <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-medium text-slate-600">Financial year</span><select className={CONTROL_CLASS} value={financialYearId} onChange={(event) => { setFinancialYearId(event.target.value); setReport(null); }} disabled={isLoadingSetup || branchId === ALL_BRANCHES}><option value="">{branchId === ALL_BRANCHES ? 'Select a branch first' : 'All / automatic'}</option>{financialYears.map((year) => <option key={getId(year)} value={getId(year)}>{year.yearLabel || year.label || year.name}</option>)}</select></label>
          {reportConfig.type !== 'balance-sheet' && <label><span className="mb-1 block text-xs font-medium text-slate-600">From date</span><input className={CONTROL_CLASS} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setReport(null); }} /></label>}
          <label><span className="mb-1 block text-xs font-medium text-slate-600">To date / as of</span><input className={CONTROL_CLASS} type="date" value={to} onChange={(event) => { setTo(event.target.value); setReport(null); }} /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button leftIcon={BarChart3} onClick={generateReport} isLoading={isLoadingReport} isDisabled={!companyId || isLoadingSetup}>Generate report</Button>
          <Button variant="outline" leftIcon={FileSpreadsheet} onClick={downloadCsv} isDisabled={!report}>Download CSV</Button>
          <Button variant="outline" leftIcon={Download} onClick={downloadPdf} isLoading={isExporting} isDisabled={!report}>Download PDF</Button>
          {report?.period?.from && <span className="ml-auto text-xs text-slate-500">Period: {formatDate(report.period.from)}{report.period.to ? ` – ${formatDate(report.period.to)}` : ''}</span>}
          {report?.asOfDate && <span className="ml-auto text-xs text-slate-500">As of {formatDate(report.asOfDate)}</span>}
        </div>
        {setupError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{setupError}</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>

      {isLoadingSetup && <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading report filters…</p>}
      {report && <>
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{card.label}</p><p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{card.value}</p></article>)}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-800">{reportConfig.title} details</h2><span className="text-xs text-slate-500">{rows.length} rows</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr>{columns.map(([key, title]) => <th key={key} className={`px-4 py-3 ${['debit', 'credit', 'amount', 'outputTax', 'inputTax', 'net'].includes(key) ? 'text-right' : ''}`}>{title}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length ? rows.map((row, index) => <tr key={`${row.section}-${row.code}-${row.name}-${index}`} className="hover:bg-slate-50/70">{columns.map(([key]) => <td key={key} className={`px-4 py-3 text-slate-700 ${['debit', 'credit', 'amount', 'outputTax', 'inputTax', 'net'].includes(key) ? 'text-right tabular-nums' : ''} ${key === 'section' ? 'text-xs font-medium text-slate-500' : ''}`}>{renderCell(key, row[key])}</td>)}</tr>)
                  : <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-500"><FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />No report rows for the selected filters.</td></tr>}
              </tbody>
              {reportConfig.type === 'trial-balance' && <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800"><tr><td className="px-4 py-3" colSpan="2">Total</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(report.totals?.debit)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(report.totals?.credit)}</td><td /></tr></tfoot>}
            </table>
          </div>
        </div>
      </>}
    </section>
  );
};
