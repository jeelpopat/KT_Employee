import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Info,
  RotateCw,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api, { invalidateCache } from '../../api/axios.js';
import { Button } from '../common/Button.jsx';
import { showToast } from '../common/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

const CONTROL_CLASS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';
const PAYABLE_STATUSES = ['generated', 'approved', 'processed', 'unpaid'];

const getId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  return String(value._id || value.id || value.companyId || '').trim();
};

const getRecords = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
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

const getCurrentPeriod = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getEmployee = (salary) => (
  (salary?.userId && typeof salary.userId === 'object' && salary.userId) ||
  (salary?.employeeId && typeof salary.employeeId === 'object' && salary.employeeId) ||
  salary?.employee ||
  {}
);

const getEmployeeName = (salary) => {
  const employee = getEmployee(salary);
  return employee.name ||
    employee.fullName ||
    salary.employeeName ||
    salary.userName ||
  'Employee';
};

const getBankDetails = (salary) => {
  const employee = getEmployee(salary);
  const details = employee.bankDetails || {};
  return {
    holder: employee.accountHolderName || details.accountHolderName || '',
    bank: employee.bankName || details.bankName || '',
    branch: employee.bankBranch || details.bankBranch || '',
    accountNumber: String(employee.bankAccountNumber || details.bankAccountNumber || details.accountNumber || '').trim(),
    ifsc: String(employee.ifscCode || details.ifscCode || details.IFSC || '').trim().toUpperCase(),
  };
};

const getSalaryAmount = (salary) => {
  const amount = Number(salary?.netSalary ?? salary?.netPayable);
  return Number.isFinite(amount) ? amount : 0;
};

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

const maskAccount = (accountNumber) => {
  if (!accountNumber) return 'Bank details missing';
  return `•••• ${accountNumber.slice(-4)}`;
};

const statusClass = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700';
    case 'approved':
      return 'bg-indigo-50 text-indigo-700';
    case 'hold':
    case 'cancelled':
    case 'canceled':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-amber-50 text-amber-700';
  }
};

export const FinanceSalariesManagementView = () => {
  const { user } = useApp();
  const preferredCompanyId = getUserCompanyId(user);
  const [companyId, setCompanyId] = useState(preferredCompanyId);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [salaries, setSalaries] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(!preferredCompanyId);
  const [isLoadingBranches, setIsLoadingBranches] = useState(Boolean(preferredCompanyId));
  const [isLoadingSalaries, setIsLoadingSalaries] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const activeAccess = user?.companyAccess?.find((access) => (
    access?.isActive && getId(access.companyId) === companyId
  ));
  const userBranchId = getId(activeAccess?.branchId) ||
    (companyId === preferredCompanyId ? getId(user?.branchId) : '');
  const role = String(activeAccess?.role || user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  const canSelectAllBranches = ['admin', 'super admin', 'superadmin'].includes(role) ||
    user?.companyCreated === true;
  const selectableBranches = branches.filter((branch) => (
    !userBranchId || canSelectAllBranches || getId(branch) === userBranchId
  ));
  const [year, month] = period.split('-').map(Number);

  useEffect(() => {
    if (preferredCompanyId) return undefined;
    let active = true;
    api.get('/api/company')
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load companies.');
        }
        const records = getRecords(response.data?.data);
        setCompanies(records);
        if (records.length === 1) setCompanyId(getId(records[0]));
        if (!records.length) setLoadError('No company is available for Salaries.');
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load companies.'));
      })
      .finally(() => {
        if (active) setIsLoadingCompanies(false);
      });
    return () => { active = false; };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!companyId) return undefined;
    let active = true;
    setIsLoadingBranches(true);
    api.get(`/api/branch?companyId=${encodeURIComponent(companyId)}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load branches.');
        }
        const records = getRecords(response.data?.data);
        setBranches(records);
        setBranchId((current) => {
          if (records.some((branch) => getId(branch) === current)) return current;
          if (userBranchId && records.some((branch) => getId(branch) === userBranchId)) return userBranchId;
          return getId(records[0]);
        });
        if (!records.length) setSetupError('Create a branch before viewing salaries.');
      })
      .catch((error) => {
        if (active) setSetupError(getErrorMessage(error, 'Could not load branches.'));
      })
      .finally(() => {
        if (active) setIsLoadingBranches(false);
      });
    return () => { active = false; };
  }, [companyId, userBranchId]);

  useEffect(() => {
    if (!companyId || !branchId || !year || !month) {
      setSalaries([]);
      setIsLoadingSalaries(false);
      return undefined;
    }
    let active = true;
    setIsLoadingSalaries(true);
    setLoadError('');
    const params = new URLSearchParams({
      companyId,
      branchId,
      month: String(month),
      year: String(year),
    });
    api.get(`/api/salaries/finance-register?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Could not load monthly payroll.');
        }
        setSalaries(getRecords(response.data?.data));
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'Could not load monthly payroll.'));
      })
      .finally(() => {
        if (active) setIsLoadingSalaries(false);
      });
    return () => { active = false; };
  }, [companyId, branchId, month, year, reloadKey]);

  const changeCompany = (nextCompanyId) => {
    setCompanyId(nextCompanyId);
    setBranches([]);
    setBranchId('');
    setSalaries([]);
    setLoadError('');
    setSetupError('');
  };

  const visibleSalaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return salaries.filter((salary) => {
      const employee = getEmployee(salary);
      const status = String(salary.status || 'Generated').toLowerCase();
      const matchesStatus = statusFilter === 'all' || status === statusFilter.toLowerCase();
      const matchesSearch = !query || [
        getEmployeeName(salary),
        employee.email,
        employee.uniqueID,
        salary.employeeCode,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [salaries, search, statusFilter]);

  const payrollSummary = useMemo(() => salaries.reduce((summary, salary) => {
    const amount = getSalaryAmount(salary);
    summary.total += amount;
    const status = String(salary.status || '').toLowerCase();
    if (status === 'paid') {
      summary.paid += amount;
      summary.paidCount += 1;
    } else if (PAYABLE_STATUSES.includes(status)) {
      summary.due += amount;
      summary.dueCount += 1;
    }
    return summary;
  }, { total: 0, paid: 0, due: 0, paidCount: 0, dueCount: 0 }), [salaries]);

  const closePayment = () => {
    if (isPaying) return;
    setSelectedSalary(null);
    setTransferConfirmed(false);
    setTransferReference('');
    setPaymentError('');
  };

  useEffect(() => {
    if (!selectedSalary) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isPaying) {
        setSelectedSalary(null);
        setTransferConfirmed(false);
        setTransferReference('');
        setPaymentError('');
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSalary, isPaying]);

  const handlePaySalary = async (event) => {
    event.preventDefault();
    if (!selectedSalary || !transferConfirmed || !companyId || !branchId) {
      setPaymentError('Confirm that the bank transfer has already been completed.');
      return;
    }
    const employeeBank = getBankDetails(selectedSalary);
    if (!employeeBank.accountNumber || !employeeBank.ifsc) {
      setPaymentError('Employee bank account number and IFSC code are required.');
      return;
    }

    setIsPaying(true);
    setPaymentError('');
    const reference = transferReference.trim();
    const remarks = reference
      ? `Manual bank transfer confirmed. UTR/Reference: ${reference}`
      : 'Manual bank transfer confirmed by Finance.';
    try {
      const response = await api.put('/api/salaries/finance-register/pay', {
        companyId,
        branchId,
        salaryId: getId(selectedSalary),
        paymentMode: 'BANK_TRANSFER',
        paidAt: new Date().toISOString(),
        transferConfirmed: true,
        remarks,
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Salary payment was not recorded.');
      }
      invalidateCache(/salaries/);
      invalidateCache(/payroll/);
      showToast(`${getEmployeeName(selectedSalary)}'s salary marked as paid.`, 'success');
      setSelectedSalary(null);
      setTransferConfirmed(false);
      setTransferReference('');
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record salary payment.');
      setPaymentError(message);
      showToast(message, 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const refreshSalaries = () => {
    setLoadError('');
    setReloadKey((value) => value + 1);
  };

  const cards = [
    { title: 'Employees', value: salaries.length.toLocaleString(), detail: `${payrollSummary.paidCount} paid · ${payrollSummary.dueCount} due`, icon: Users },
    { title: 'Net Payroll', value: formatCurrency(payrollSummary.total), detail: `${month}/${year}`, icon: Wallet },
    { title: 'Paid', value: formatCurrency(payrollSummary.paid), detail: 'Marked paid after transfer confirmation', icon: CheckCircle2 },
    { title: 'To Pay', value: formatCurrency(payrollSummary.due), detail: 'Pending manual bank transfer', icon: Clock3 },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Expense &amp; Payroll</span>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-slate-800">Salaries</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <Banknote className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Salaries</h1>
            <p className="mt-1 text-sm text-slate-500">Review monthly payroll and record employee bank transfers.</p>
          </div>
        </div>
        <Button variant="outline" leftIcon={RotateCw} onClick={refreshSalaries} isDisabled={!companyId}>
          Refresh
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Complete the bank transfer outside this app, then confirm it here. This screen does not initiate or automate a bank transfer.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-slate-500">{card.title}</p>
              <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{card.value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(190px,1fr)_190px_minmax(220px,1.3fr)]">
          <label>
            <span className="sr-only">Payroll month</span>
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Payroll month"
              />
            </span>
          </label>
          <label>
            <span className="sr-only">Payroll status</span>
            <select className={`${CONTROL_CLASS} h-10`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="generated">Generated</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="hold">On hold</option>
            </select>
          </label>
          <label className="relative">
            <span className="sr-only">Search salaries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${CONTROL_CLASS} h-10 pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, code, or email..."
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!preferredCompanyId && companies.length > 1 && (
            <select
              aria-label="Company"
              className={`${CONTROL_CLASS} h-9 min-w-[220px]`}
              value={companyId}
              onChange={(event) => changeCompany(event.target.value)}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={getId(company)} value={getId(company)}>{company.name || company.companyName}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="sr-only">Branch</span>
            <select
              className={`${CONTROL_CLASS} h-9 max-w-xs`}
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              disabled={isLoadingBranches || !companyId}
              aria-label="Branch"
            >
              <option value="">Select branch</option>
              {selectableBranches.map((branch) => (
                <option key={getId(branch)} value={getId(branch)}>{branch.branchName}</option>
              ))}
            </select>
          </label>
          {isLoadingCompanies && <span className="text-xs text-slate-500">Loading companies…</span>}
          {setupError && <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setupError}</p>}
          {loadError && <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Gross Salary</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net Pay</th>
                <th className="px-4 py-3">Destination Account</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingSalaries ? (
                <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">Loading monthly payroll…</td></tr>
              ) : visibleSalaries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-14 text-center">
                    <Wallet className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No monthly payroll found</p>
                    <p className="mt-1 text-xs text-slate-500">Generate payroll in HRMS for the selected month, year, and branch.</p>
                  </td>
                </tr>
              ) : visibleSalaries.map((salary) => {
                const employee = getEmployee(salary);
                const bank = getBankDetails(salary);
                const status = salary.status || 'Generated';
                const isPaid = String(status).toLowerCase() === 'paid';
                const canPay = PAYABLE_STATUSES.includes(String(status).toLowerCase());
                const hasBankDetails = Boolean(bank.accountNumber && bank.ifsc);
                const id = getId(salary);
                return (
                  <tr key={id} className="transition-colors hover:bg-indigo-50/30">
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-semibold text-slate-800">{getEmployeeName(salary)}</p>
                      <p className="truncate text-[11px] text-slate-400">{employee.uniqueID || salary.employeeCode || employee.email || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{salary.salaryMonth || `${month}/${year}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(salary.grossSalary)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(salary.totalDeduction ?? salary.totalAppliedDeductions ?? salary.totalDeductions)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(getSalaryAmount(salary))}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{maskAccount(bank.accountNumber)}</p>
                      <p className="text-[11px] text-slate-400">{bank.bank || (bank.ifsc ? `IFSC ${bank.ifsc}` : 'Update employee bank details')}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>{status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isPaid ? (
                        <span className="whitespace-nowrap text-xs text-slate-500">Paid {formatDate(salary.paidAt)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSalary(salary);
                            setTransferConfirmed(false);
                            setTransferReference('');
                            setPaymentError('');
                          }}
                          disabled={!canPay || !hasBankDetails}
                          title={!hasBankDetails ? 'Employee bank account number and IFSC are required' : undefined}
                          className="whitespace-nowrap rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm transfer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{visibleSalaries.length} employee{visibleSalaries.length === 1 ? '' : 's'} in selected payroll</span>
          <span>Paid: {payrollSummary.paidCount} · Pending: {payrollSummary.dueCount}</span>
        </div>
      </div>

      {selectedSalary && (() => {
        const employeeBank = getBankDetails(selectedSalary);
        const employeeName = getEmployeeName(selectedSalary);
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-3 sm:p-5">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close salary payment confirmation" onClick={closePayment} />
            <section role="dialog" aria-modal="true" aria-labelledby="salary-payment-title" className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="salary-payment-title" className="text-lg font-bold text-slate-900">Confirm salary transfer</h2>
                  <p className="mt-1 text-xs text-slate-500">{employeeName} · {selectedSalary.salaryMonth || `${month}/${year}`}</p>
                </div>
                <button type="button" aria-label="Close" onClick={closePayment} disabled={isPaying} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">Net salary</span>
                  <strong className="text-lg tabular-nums text-slate-900">{formatCurrency(getSalaryAmount(selectedSalary))}</strong>
                </div>
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs sm:grid-cols-2">
                  <div><p className="text-slate-500">Account holder</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.holder || employeeName}</p></div>
                  <div><p className="text-slate-500">Bank</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.bank || '—'}</p></div>
                  <div><p className="text-slate-500">Account number</p><p className="mt-0.5 break-all font-semibold text-slate-800">{employeeBank.accountNumber || 'Missing'}</p></div>
                  <div><p className="text-slate-500">IFSC</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.ifsc || 'Missing'}</p></div>
                  {employeeBank.branch && <div className="sm:col-span-2"><p className="text-slate-500">Bank branch</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.branch}</p></div>}
                </div>
              </div>

              <form onSubmit={handlePaySalary} className="mt-4 space-y-4">
                <label className="block">
                  <span className={LABEL_CLASS}>Transfer reference / UTR (optional)</span>
                  <input
                    className={CONTROL_CLASS}
                    value={transferReference}
                    onChange={(event) => setTransferReference(event.target.value)}
                    maxLength={100}
                    disabled={isPaying}
                    placeholder="Enter bank transfer reference"
                  />
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-700"
                    checked={transferConfirmed}
                    onChange={(event) => setTransferConfirmed(event.target.checked)}
                    disabled={isPaying}
                    required
                  />
                  <span>I have completed the bank transfer to the employee’s account shown above. I understand this confirmation will mark the payroll as Paid.</span>
                </label>
                {paymentError && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{paymentError}
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline" onClick={closePayment} isDisabled={isPaying}>Cancel</Button>
                  <Button type="submit" leftIcon={CheckCircle2} isLoading={isPaying} isDisabled={!transferConfirmed || !employeeBank.accountNumber || !employeeBank.ifsc}>
                    Mark as Paid
                  </Button>
                </div>
              </form>
            </section>
          </div>
        );
      })()}
    </section>
  );
};
