import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Download,
  LoaderCircle,
  RefreshCw,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import api from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';

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

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  return { startDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toDateInput(now) };
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatCurrency = (value) => currency.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const getErrorMessage = (error) => (
  error?.response?.data?.message || error?.message || 'Could not load the Finance overview.'
);

const CHART_COLORS = ['#2563eb', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#64748b', '#06b6d4', '#84cc16'];
const ALL_BRANCHES = 'all';

const StatCard = ({ title, value, caption, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{caption}</p>
    </article>
  );
};

export const FinanceOverviewView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const activeCompanyId = preferredCompanyId || companyId;
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [dateRange, setDateRange] = useState(getCurrentMonthRange);
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [branchError, setBranchError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (preferredCompanyId) return undefined;

    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load company details.');
        }
        const companies = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!companies.length) {
          throw new Error('No company is available for the Finance overview.');
        }
        setCompanies(companies);
        if (companies.length === 1) setCompanyId(getId(companies[0]));
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError));
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [preferredCompanyId, reloadKey]);

  useEffect(() => {
    if (!activeCompanyId) return undefined;

    let active = true;
    api.get(`/api/branch?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load branches.');
        }
        const records = Array.isArray(response.data?.data) ? response.data.data : [];
        setBranches(records);
        setBranchError('');
      })
      .catch((loadError) => {
        if (active) setBranchError(getErrorMessage(loadError));
      });

    return () => {
      active = false;
    };
  }, [activeCompanyId, reloadKey]);

  useEffect(() => {
    if (!activeCompanyId) return undefined;

    let active = true;
    const params = { companyId: activeCompanyId, ...dateRange };
    if (branchId !== ALL_BRANCHES) params.branchId = branchId;

    api.get('/api/admin/dashboard', { params })
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load the Finance overview.');
        }
        setDashboard(response.data?.data || null);
        setError('');
      })
      .catch((loadError) => {
        if (active) {
          setDashboard(null);
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeCompanyId, branchId, dateRange, reloadKey]);

  const branchNames = useMemo(() => new Map(
    branches.map((branch) => [getId(branch), branch.branchName || branch.name || 'Branch']),
  ), [branches]);

  const stats = dashboard?.statistics || {};
  const isAllBranches = branchId === ALL_BRANCHES;
  const sales = Number(stats.sales?.totalAmount ?? stats.totalSales) || 0;
  const received = Number(stats.sales?.totalReceived) || 0;
  const expenses = Number(stats.totalOutflow) ||
    ((Number(stats.totalPurchases) || 0) + (Number(stats.expenses?.totalAmount) || 0) + (Number(stats.totalSalaries) || 0));
  const netProfit = Number(stats.netProfit) || 0;
  const receivables = Number(stats.receivables?.totalAmount ?? stats.totalReceivables) || 0;
  const expenseBreakdown = dashboard?.expenseBreakdown || [];
  const branchPerformance = dashboard?.branchPerformance || [];

  const transactions = useMemo(() => {
    const activity = dashboard?.recentActivity || {};
    return [
      ...(activity.invoices || []).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: invoice.invoiceNumber || 'Sales invoice',
        subtitle: invoice.customer?.name || invoice.customerName || 'Customer',
        date: invoice.invoiceDate,
        amount: Number(invoice.grandTotal) || 0,
        type: 'Sales',
        status: invoice.status || 'Issued',
      })),
      ...(activity.purchases || []).map((purchase) => ({
        id: `purchase-${purchase.id}`,
        title: purchase.billNumber || 'Purchase bill',
        subtitle: purchase.supplier?.name || 'Supplier',
        date: purchase.billDate,
        amount: Number(purchase.grandTotal) || 0,
        type: 'Purchase',
        status: purchase.status || 'Recorded',
      })),
      ...(activity.expenses || []).map((expense) => ({
        id: `expense-${expense.id}`,
        title: expense.description || expense.category || 'Expense',
        subtitle: expense.category || 'Operating expense',
        date: expense.expenseDate,
        amount: Number(expense.amount) || 0,
        type: 'Expense',
        status: 'Recorded',
      })),
      ...(activity.salaries || []).map((salary) => ({
        id: `salary-${salary.id}`,
        title: salary.employeeName || 'Salary payment',
        subtitle: salary.paymentMode ? `Payroll · ${salary.paymentMode.replaceAll('_', ' ')}` : 'Payroll',
        date: salary.periodStart,
        amount: Number(salary.amount) || 0,
        type: 'Payroll',
        status: 'Posted',
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 8);
  }, [dashboard]);

  const chartMax = Math.max(
    1,
    ...branchPerformance.flatMap((branch) => [Number(branch.revenue) || 0, Number(branch.totalExpenses) || 0]),
  );
  const chartBranches = branchPerformance;
  const totalBreakdown = expenseBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  let runningPercent = 0;
  const donutGradient = totalBreakdown > 0
    ? `conic-gradient(${expenseBreakdown.map((item, index) => {
      const start = runningPercent;
      runningPercent += (Number(item.amount) / totalBreakdown) * 100;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${runningPercent}%`;
    }).join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)';

  const setRange = (key, value) => {
    setIsLoading(true);
    setDateRange((current) => ({ ...current, [key]: value }));
  };

  const refreshDashboard = () => {
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const changeBranch = (value) => {
    setIsLoading(true);
    setBranchId(value);
  };

  const handleExport = () => {
    if (!dashboard) return;
    setIsExporting(true);
    try {
      const rows = [
        ['Branch', 'Revenue', 'Expenses', 'Net profit', 'Receivables'],
        ...(isAllBranches ? [[
          'All branches total',
          sales,
          expenses,
          netProfit,
          receivables,
        ]] : []),
        ...branchPerformance.map((branch) => [
          branch.branchId ? (branchNames.get(branch.branchId) || 'Branch') : 'Unassigned',
          branch.revenue || 0,
          branch.totalExpenses || 0,
          branch.netProfit || 0,
          branch.receivables || 0,
        ]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-overview-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-lg shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-200">FINANCE · DASHBOARD</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Finance Overview</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80">Your consolidated view of revenue, expenses, branch performance and recent activity.</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {isAllBranches ? 'All branches · consolidated totals' : (branchNames.get(branchId) || 'Selected branch')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshDashboard}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <RefreshCw size={16} aria-hidden="true" /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!dashboard || isExporting}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-blue-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} aria-hidden="true" /> Export report
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Dashboard filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Report filters</h2>
            <p className="mt-0.5 text-xs text-slate-500">Choose a company, branch and reporting period.</p>
          </div>
          {isLoading && dashboard && <span className="text-xs font-medium text-blue-700">Updating dashboard…</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!preferredCompanyId && companies.length > 1 && (
            <label className="grid gap-1.5 text-xs font-medium text-slate-500">
              Company
              <select
                value={activeCompanyId}
                onChange={(event) => {
                  setIsLoading(true);
                  setCompanyId(event.target.value);
                  setBranchId(ALL_BRANCHES);
                }}
                className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={getId(company)} value={getId(company)}>{company.name || 'Company'}</option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1.5 text-xs font-medium text-slate-500">
            Branch
            <select
              value={branchId}
              onChange={(event) => changeBranch(event.target.value)}
              className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value={ALL_BRANCHES}>All branches</option>
              {branches.map((branch) => (
                <option key={getId(branch)} value={getId(branch)}>{branch.branchName || branch.name || 'Branch'}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-500">
            From
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500">
              <CalendarDays size={16} className="text-slate-400" aria-hidden="true" />
              <input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate}
                onChange={(event) => setRange('startDate', event.target.value)}
                className="min-w-0 bg-transparent text-sm text-slate-800 outline-none"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-500">
            To
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500">
              <CalendarDays size={16} className="text-slate-400" aria-hidden="true" />
              <input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate}
                onChange={(event) => setRange('endDate', event.target.value)}
                className="min-w-0 bg-transparent text-sm text-slate-800 outline-none"
              />
            </span>
          </label>
        </div>
      </section>

      {branchError && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Branch options could not be loaded: {branchError}
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center">
          <span>{error}</span>
          <button type="button" onClick={refreshDashboard} className="font-semibold underline">Try again</button>
        </div>
      )}

      {!activeCompanyId && !isLoading ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div><p className="font-semibold text-slate-800">Choose a company to continue</p><p className="mt-1 text-sm text-slate-500">The dashboard will show results for the selected company.</p></div>
        </div>
      ) : isLoading && !dashboard ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-blue-700" aria-hidden="true" />
            Loading Finance overview…
          </div>
        </div>
      ) : dashboard && (
        <>
          <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard title="Total revenue" value={formatCurrency(sales)} caption={`${stats.sales?.count || 0} sales invoices in this period`} icon={CircleDollarSign} tone="blue" />
            <StatCard title="Payments received" value={formatCurrency(received)} caption="Collected against sales invoices" icon={ArrowDownRight} tone="green" />
            <StatCard title="Total expenses" value={formatCurrency(expenses)} caption="Purchases, operating expenses and payroll" icon={ReceiptText} tone="violet" />
            <StatCard title="Net profit" value={formatCurrency(netProfit)} caption="Revenue less purchases, expenses and salaries" icon={ChartNoAxesCombined} tone={netProfit < 0 ? 'amber' : 'green'} />
            <StatCard title="Pending receivables" value={formatCurrency(receivables)} caption="Outstanding customer invoices" icon={Wallet} tone="amber" />
            <StatCard title="Cash & bank balance" value={formatCurrency(stats.liquidBalance)} caption={`Cash ${formatCurrency(stats.cashBalance)} · Bank ${formatCurrency(stats.bankBalance)}`} icon={Banknote} tone="blue" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
            <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Branch performance</h2>
                  <p className="mt-1 text-sm text-slate-500">{isAllBranches ? 'Revenue compared with outgoing across all branches' : 'Revenue compared with outgoing for this branch'}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {branchPerformance.length} {branchPerformance.length === 1 ? 'branch' : 'branches'}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-blue-600" />Revenue</span>
                <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Expenses</span>
              </div>
              {chartBranches.length ? (
                <div className="mt-5 overflow-x-auto">
                  <div className="flex min-w-[560px] items-end justify-around gap-4 border-b border-slate-200 px-2">
                    {chartBranches.map((branch) => {
                      const revenueHeight = Math.max(3, ((Number(branch.revenue) || 0) / chartMax) * 150);
                      const expenseHeight = Math.max(3, ((Number(branch.totalExpenses) || 0) / chartMax) * 150);
                      const name = branch.branchId ? (branchNames.get(branch.branchId) || 'Branch') : 'Unassigned';
                      return (
                        <div key={branch.branchId || 'unassigned'} className="flex min-w-14 flex-1 flex-col items-center">
                          <div className="mb-2 text-center text-[10px] font-medium text-slate-500">{formatCurrency(branch.revenue)}</div>
                          <div className="flex h-40 items-end gap-1.5">
                            <div title={`${name} revenue: ${formatCurrency(branch.revenue)}`} className="w-5 rounded-t-md bg-blue-600 transition-all" style={{ height: `${revenueHeight}px` }} />
                            <div title={`${name} expenses: ${formatCurrency(branch.totalExpenses)}`} className="w-5 rounded-t-md bg-violet-400 transition-all" style={{ height: `${expenseHeight}px` }} />
                          </div>
                          <p className="max-w-24 truncate py-3 text-center text-xs font-semibold text-slate-600" title={name}>{name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid min-h-52 place-items-center text-center text-sm text-slate-500">
                  <p>No branch performance data for this date range.</p>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Expense breakdown</h2>
                <p className="mt-1 text-sm text-slate-500">How total outgoing is distributed</p>
              </div>
              {expenseBreakdown.length ? (
                <>
                  <div className="mt-5 flex items-center justify-center">
                    <div className="relative grid h-48 w-48 place-items-center rounded-full" role="img" aria-label="Expense breakdown chart" style={{ background: donutGradient }}>
                      <div className="grid h-32 w-32 place-items-center rounded-full bg-white text-center shadow-inner">
                        <div><p className="text-xs font-medium text-slate-500">Total expenses</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(expenses)}</p></div>
                      </div>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-3">
                    {expenseBreakdown.map((item, index) => (
                      <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600">
                          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-slate-800">{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">
                  <div><Banknote size={30} className="mx-auto mb-2 text-slate-300" aria-hidden="true" /><p>No expenses recorded for this date range.</p></div>
                </div>
              )}
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)]">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Branch summary</h2>
                  <p className="mt-1 text-sm text-slate-500">{isAllBranches ? 'Branch-wise results with consolidated company totals' : 'Results for the selected branch and period'}</p>
                </div>
                <ArrowUpRight size={18} className="text-emerald-600" aria-hidden="true" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3 font-semibold">Branch</th><th className="px-4 py-3 text-right font-semibold">Revenue</th><th className="px-4 py-3 text-right font-semibold">Expenses</th><th className="px-4 py-3 text-right font-semibold">Receivables</th><th className="px-5 py-3 text-right font-semibold">Net profit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branchPerformance.length ? branchPerformance.map((branch) => (
                      <tr key={branch.branchId || 'unassigned'} className="text-slate-700">
                        <td className="px-5 py-4 font-semibold text-slate-900">{branch.branchId ? (branchNames.get(branch.branchId) || 'Branch') : 'Unassigned'}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(branch.revenue)}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(branch.totalExpenses)}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(branch.receivables)}</td>
                        <td className={`px-5 py-4 text-right font-semibold tabular-nums ${branch.netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(branch.netProfit)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-500">No branch totals available for this period.</td></tr>
                    )}
                    {isAllBranches && (
                      <tr className="border-t-2 border-blue-100 bg-blue-50/70 font-bold text-slate-900">
                        <td className="px-5 py-4">All branches total</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(sales)}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(expenses)}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(receivables)}</td>
                        <td className={`px-5 py-4 text-right tabular-nums ${netProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(netProfit)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Recent transactions</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest sales, purchases, expenses and payroll</p>
                </div>
                <ReceiptText size={18} className="text-slate-400" aria-hidden="true" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3 font-semibold">Transaction</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-5 py-3 text-right font-semibold">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length ? transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="max-w-48 px-5 py-3.5">
                          <p className="truncate font-semibold text-slate-900" title={transaction.title}>{transaction.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{transaction.subtitle}</p>
                        </td>
                        <td className="px-4 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{transaction.type}</span></td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{formatDate(transaction.date)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(transaction.amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="px-5 py-12 text-center text-sm text-slate-500">No transactions found for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
          <p className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
            {netProfit < 0 ? <ArrowDownRight size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
            Showing {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}
          </p>
        </>
      )}
    </main>
  );
};
