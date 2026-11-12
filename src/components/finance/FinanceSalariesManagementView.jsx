import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  Info,
  Pencil,
  RotateCw,
  Search,
  Save,
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
const EDITABLE_STATUSES = ['draft', 'generated', 'pending', 'processed', 'unpaid'];
const COMMON_EDIT_FIELDS = [
  { name: 'extraAllowance', label: 'Extra allowance' },
  { name: 'incentive', label: 'Incentive' },
  { name: 'bonus', label: 'Bonus' },
  { name: 'extraDeduction', label: 'Extra deduction' },
];
const COMPONENT_EDIT_FIELDS = [
  { name: 'basicSalary', label: 'Basic salary' },
  { name: 'hra', label: 'HRA' },
  { name: 'conveyanceAllowance', label: 'Conveyance allowance' },
  { name: 'medicalAllowance', label: 'Medical allowance' },
  { name: 'specialAllowance', label: 'Special allowance' },
  { name: 'dearnessAllowance', label: 'Dearness allowance' },
  { name: 'otherAllowances', label: 'Other allowances' },
];

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

const getFirstPositiveAmount = (...values) => {
  for (const value of values) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return 0;
};

const getSalaryDetailAmount = (salary, ...keys) => {
  const sources = [salary, salary?.deductionBreakdown, salary?.salaryStructureSnapshot].filter(Boolean);
  for (const source of sources) {
    const amount = getFirstPositiveAmount(...keys.map((key) => source[key]));
    if (amount > 0) return amount;
  }
  return 0;
};

const getSalaryDeductionBreakdown = (salary) => {
  const sources = [salary, salary?.deductionBreakdown, salary?.salaryStructureSnapshot].filter(Boolean);
  const customDeductionLists = sources.map((source) => (
    [
      source.customDeductionsList,
      source.employeeDeductions,
      Array.isArray(source.customDeductions) ? source.customDeductions : source.customDeductions?.approvedAndPermissible,
    ]
  )).flat();
  const rawCustomDeductions = customDeductionLists.find((list) => Array.isArray(list) && list.length > 0) ||
    customDeductionLists.find(Array.isArray) ||
    [];
  const appliedPenalty = getSalaryDetailAmount(salary, 'appliedPenalty', 'legallyApprovedPenalties');
  const customDeductions = Array.isArray(rawCustomDeductions)
    ? rawCustomDeductions.filter((item) => {
      if (!(Number(item?.amount) > 0)) return false;
      if (!appliedPenalty) return true;
      const description = `${item?.category || ''} ${item?.name || item?.title || ''}`.toLowerCase();
      return !description.includes('penalty') && !description.includes('policy_violation');
    })
    : [];
  const fixedDeduction = getSalaryDetailAmount(salary, 'fixedDeduction');
  const extraDeduction = getSalaryDetailAmount(salary, 'extraDeduction');
  const advanceDeduction = getSalaryDetailAmount(salary, 'advanceDeduction');
  const customDeductionTotal = customDeductions.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const aggregateOtherDeductions = getSalaryDetailAmount(salary, 'approvedOtherDeductions', 'otherDeductions', 'customDeductions');
  const itemizedOtherTotal = fixedDeduction + extraDeduction + advanceDeduction + customDeductionTotal;
  const otherDeductions = Math.max(0, aggregateOtherDeductions - itemizedOtherTotal);
  const approvedLeaveDeduction = getSalaryDetailAmount(salary, 'approvedLeaveDeduction');
  const unauthorizedAbsenceDeduction = getSalaryDetailAmount(salary, 'unauthorizedAbsenceDeduction');
  const statutoryItems = [
    { label: 'Provident Fund (PF)', amount: getSalaryDetailAmount(salary, 'pfDeduction'), note: salary?.isPfApplicable === false ? 'Not applicable' : '' },
    { label: 'ESIC', amount: getSalaryDetailAmount(salary, 'esicDeduction'), note: salary?.isEsicApplicable === false ? 'Not applicable' : '' },
    { label: 'Professional Tax', amount: getSalaryDetailAmount(salary, 'professionalTax'), note: salary?.isPtApplicable === false ? 'Not applicable' : '' },
    { label: 'TDS / Income Tax', amount: getSalaryDetailAmount(salary, 'tdsAmount', 'tds'), note: Number(salary?.tdsPercentage) > 0 ? `${salary.tdsPercentage}%` : '' },
  ];
  const statutoryItemTotal = statutoryItems.reduce((total, item) => total + item.amount, 0);
  const aggregateStatutoryDeductions = getSalaryDetailAmount(salary, 'statutoryDeductions');
  const otherStatutoryDeductions = Math.max(0, aggregateStatutoryDeductions - statutoryItemTotal);
  const leaveDeduction = getFirstPositiveAmount(
    getSalaryDetailAmount(salary, 'lopDeduction'),
    getSalaryDetailAmount(salary, 'leaveDeduction'),
    getSalaryDetailAmount(salary, 'unpaidLeaveDeduction'),
    approvedLeaveDeduction + unauthorizedAbsenceDeduction
  );
  const deductions = [
    {
      label: 'Leave / Loss of Pay (LOP)',
      amount: leaveDeduction,
      note: approvedLeaveDeduction || unauthorizedAbsenceDeduction
        ? `Approved leave: ${formatCurrency(approvedLeaveDeduction)} · Unauthorized absence: ${formatCurrency(unauthorizedAbsenceDeduction)}`
        : '',
    },
    ...statutoryItems,
    { label: 'Other statutory deductions', amount: otherStatutoryDeductions },
    { label: 'Fixed Monthly Deduction', amount: fixedDeduction },
    { label: 'Extra Deduction', amount: extraDeduction },
    { label: 'Advance Adjustment', amount: advanceDeduction },
    ...customDeductions.map((item, index) => {
      const label = item.deductionMasterId?.name || item.name || item.code || 'Employee deduction';
      const note = [
        item.deductionMasterId?.category || item.category,
        item.deductionMasterId?.description || item.description,
        item.deductionMasterId?.code || item.code,
      ].filter(Boolean).join(' · ');
      return {
        label: `${label}${customDeductions.filter((entry) => (entry.deductionMasterId?.name || entry.name || entry.code || 'Employee deduction') === label).length > 1 ? ` ${index + 1}` : ''}`,
        amount: Number(item.amount) || 0,
        note,
      };
    }),
    { label: 'Other Approved Deductions', amount: otherDeductions },
    { label: 'Approved Penalty', amount: appliedPenalty, note: salary?.penaltyDate ? `Date: ${formatDate(salary.penaltyDate)}` : '' },
  ];
  const itemizedTotal = deductions.reduce((total, item) => total + item.amount, 0);
  const grossSalary = getSalaryDetailAmount(salary, 'grossSalary');
  const grossNetDifference = Math.max(0, grossSalary - getSalaryAmount(salary));
  const totalDeduction = getSalaryDetailAmount(salary, 'totalDeduction', 'totalAppliedDeductions', 'totalDeductions') || grossNetDifference;
  const unitemizedBalance = Math.round((totalDeduction - itemizedTotal) * 100) / 100;
  if (unitemizedBalance > 0.01) {
    deductions.push({ label: 'Other / Unitemized Deduction Balance', amount: unitemizedBalance });
  }

  return {
    deductions,
    totalDeduction,
    itemizedTotal,
    unitemizedBalance,
    proposedPenalty: getSalaryDetailAmount(salary, 'proposedPenalty', 'proposedPenaltyAmount'),
    customDeductions,
  };
};

const isSimpleFixedPayroll = (salary) => (
  String(salary?.structureType || '').toUpperCase() === 'SIMPLE_FIXED' ||
  (Number(salary?.fixedSalary) > 0 && !Number(salary?.hra)) ||
  (Number(salary?.basicSalary) > 0 && !Number(salary?.hra) && !Number(salary?.allowance))
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

const formatSalaryPeriod = (salary) => {
  const month = Number(salary?.month);
  const year = Number(salary?.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return salary?.salaryMonth || '—';
  }
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
};

const getPaymentMethodLabel = (salary) => {
  if (String(salary?.status || '').toLowerCase() !== 'paid') return '—';
  const mode = String(salary?.paymentMode || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (mode === 'CASH') return 'Cash';
  if (['BANK_TRANSFER', 'ACCOUNT', 'BANK', 'BANK_ACCOUNT', 'NEFT', 'IMPS', 'RTGS'].includes(mode)) return 'Account';
  if (mode === 'CHEQUE') return 'Cheque';
  return mode ? mode.replace(/_/g, ' ') : 'Not specified';
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
  const [period, setPeriod] = useState('all');
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
  const [viewingSalary, setViewingSalary] = useState(null);
  const [editingSalary, setEditingSalary] = useState(null);
  const [salaryEditForm, setSalaryEditForm] = useState({});
  const [salaryEditError, setSalaryEditError] = useState('');
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
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
  const [year, month] = period === 'all' ? [null, null] : period.split('-').map(Number);

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
    if (!companyId || !branchId) {
      setSalaries([]);
      setIsLoadingSalaries(false);
      return undefined;
    }
    let active = true;
    setIsLoadingSalaries(true);
    setLoadError('');
    const params = new URLSearchParams({ companyId, branchId });
    if (month && year) {
      params.set('month', String(month));
      params.set('year', String(year));
    }
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
      const matchesPeriod = period === 'all' ||
        `${salary.year}-${String(salary.month).padStart(2, '0')}` === period;
      const matchesSearch = !query || [
        getEmployeeName(salary),
        employee.email,
        employee.uniqueID,
        salary.employeeCode,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesPeriod && matchesStatus && matchesSearch;
    });
  }, [salaries, search, statusFilter, period]);

  const periodSalaries = useMemo(() => salaries.filter((salary) => (
    period === 'all' || `${salary.year}-${String(salary.month).padStart(2, '0')}` === period
  )), [salaries, period]);

  const payrollSummary = useMemo(() => periodSalaries.reduce((summary, salary) => {
    const amount = getSalaryAmount(salary);
    summary.employeeCount += 1;
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
  }, { total: 0, paid: 0, due: 0, paidCount: 0, dueCount: 0, employeeCount: 0 }), [periodSalaries]);

  const closePayment = () => {
    if (isPaying) return;
    setSelectedSalary(null);
    setPaymentMode('BANK_TRANSFER');
    setTransferConfirmed(false);
    setTransferReference('');
    setPaymentError('');
  };

  const openSalaryEditor = (salary) => {
    const simpleFixed = isSimpleFixedPayroll(salary);
    const fields = [
      ...(simpleFixed
        ? [{ name: 'fixedSalary', label: 'Monthly fixed salary' }]
        : COMPONENT_EDIT_FIELDS),
      ...COMMON_EDIT_FIELDS,
    ];
    const form = Object.fromEntries(fields.map(({ name }) => [
      name,
      String(Number(
        name === 'bonus'
          ? salary.bonus ?? salary.extraBonus
          : salary[name] ?? (name === 'fixedSalary' ? salary.basicSalary ?? salary.monthlySalary : 0)
      ) || 0),
    ]));
    setEditingSalary(salary);
    setSalaryEditForm({ ...form, remarks: salary.remarks || '' });
    setSalaryEditError('');
  };

  const handleSaveSalary = async (event) => {
    event.preventDefault();
    if (!editingSalary) return;
    const fields = Object.keys(salaryEditForm).filter((field) => field !== 'remarks');
    const invalidField = fields.find((field) => {
      const value = salaryEditForm[field];
      return String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0;
    });
    if (invalidField) {
      setSalaryEditError('Enter a valid amount of 0 or greater for every salary component.');
      return;
    }

    setIsSavingSalary(true);
    setSalaryEditError('');
    try {
      const payload = {
        ...Object.fromEntries(fields.map((field) => [field, Number(salaryEditForm[field])])),
        remarks: salaryEditForm.remarks,
      };
      if (Object.prototype.hasOwnProperty.call(payload, 'bonus')) payload.extraBonus = payload.bonus;
      const response = await api.put(`/api/salaries/${encodeURIComponent(getId(editingSalary))}`, payload);
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Salary changes were not saved.');
      }
      invalidateCache(/salaries/);
      invalidateCache(/payroll/);
      showToast(`${getEmployeeName(editingSalary)}'s payroll updated successfully.`, 'success');
      setEditingSalary(null);
      setSalaryEditForm({});
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not update this payroll record.');
      setSalaryEditError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingSalary(false);
    }
  };

  useEffect(() => {
    if (!selectedSalary && !viewingSalary && !editingSalary) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isPaying && !isSavingSalary) {
        if (selectedSalary) {
          setSelectedSalary(null);
          setPaymentMode('BANK_TRANSFER');
          setTransferConfirmed(false);
          setTransferReference('');
          setPaymentError('');
        } else if (editingSalary) {
          setEditingSalary(null);
          setSalaryEditError('');
        } else {
          setViewingSalary(null);
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSalary, viewingSalary, editingSalary, isPaying, isSavingSalary]);

  const handlePaySalary = async (event) => {
    event.preventDefault();
    if (!selectedSalary || !transferConfirmed || !companyId || !branchId) {
      setPaymentError(`Confirm that the ${paymentMode === 'CASH' ? 'cash payment' : 'bank transfer'} has already been completed.`);
      return;
    }
    const employeeBank = getBankDetails(selectedSalary);
    if (paymentMode === 'BANK_TRANSFER' && (!employeeBank.accountNumber || !employeeBank.ifsc)) {
      setPaymentError('Employee bank account number and IFSC code are required.');
      return;
    }

    setIsPaying(true);
    setPaymentError('');
    const reference = transferReference.trim();
    const remarks = paymentMode === 'CASH'
      ? 'Cash salary payment confirmed by Finance.'
      : reference
        ? `Manual bank transfer confirmed. UTR/Reference: ${reference}`
        : 'Manual bank transfer confirmed by Finance.';
    try {
      const response = await api.put('/api/salaries/finance-register/pay', {
        companyId,
        branchId,
        salaryId: getId(selectedSalary),
        paymentMode,
        paidAt: new Date().toISOString(),
        transferConfirmed: true,
        remarks,
      });
      if (response.data?.success === false || !response.data?.data) {
        throw new Error(response.data?.message || 'Salary payment was not recorded.');
      }
      invalidateCache(/salaries/);
      invalidateCache(/payroll/);
      showToast(`${getEmployeeName(selectedSalary)}'s salary marked paid by ${getPaymentMethodLabel({ status: 'Paid', paymentMode })}.`, 'success');
      setSelectedSalary(null);
      setPaymentMode('BANK_TRANSFER');
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

  const availablePeriods = [...new Map(salaries
    .filter((salary) => Number.isInteger(Number(salary.month)) && Number.isInteger(Number(salary.year)))
    .map((salary) => [
      `${salary.year}-${String(salary.month).padStart(2, '0')}`,
      formatSalaryPeriod(salary),
    ])).entries()]
    .sort(([periodA], [periodB]) => periodB.localeCompare(periodA));

  const cards = [
    { title: 'Payroll records', value: payrollSummary.employeeCount.toLocaleString(), detail: `${payrollSummary.paidCount} paid · ${payrollSummary.dueCount} due`, icon: Users },
    { title: 'Net Payroll', value: formatCurrency(payrollSummary.total), detail: period === 'all' ? 'All payroll periods' : formatSalaryPeriod({ month, year }), icon: Wallet },
    { title: 'Paid', value: formatCurrency(payrollSummary.paid), detail: 'Confirmed payments', icon: CheckCircle2 },
    { title: 'To Pay', value: formatCurrency(payrollSummary.due), detail: 'Awaiting payment confirmation', icon: Clock3 },
  ];

  return (
    <section className="mx-auto max-w-[1480px] space-y-5 pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Expense &amp; Payroll</span>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-slate-800">Salaries</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-600 text-white shadow-lg shadow-indigo-900/15 sm:h-14 sm:w-14">
            <Banknote className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">Finance · Payroll</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Salary Register</h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">All payroll periods in one place. Record cash or account payments after they are completed.</p>
          </div>
        </div>
        <Button variant="outline" leftIcon={RotateCw} onClick={refreshSalaries} isDisabled={!companyId || isLoadingSalaries}>
          Refresh
        </Button>
      </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Complete the cash handover or bank transfer outside this app, then confirm the actual payment method here. This screen does not move money.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-slate-500">{card.title}</p>
              <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{card.value}</p>
              <p className="mt-1 text-[11px] text-slate-400">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payroll records</h2>
            <p className="mt-0.5 text-xs text-slate-500">Search employees or narrow the register by month and payment status.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
            {visibleSalaries.length} record{visibleSalaries.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_190px_minmax(240px,1.4fr)]">
          <label>
            <span className="sr-only">Payroll period</span>
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
              <select className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Payroll period">
                <option value="all">All months</option>
                {availablePeriods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
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
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Payroll Period</th>
                <th className="px-4 py-3 text-right">Gross Salary</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net Pay</th>
                <th className="px-4 py-3">Paid Via</th>
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
                    <p className="mt-1 text-xs text-slate-500">Generate payroll in HRMS, or adjust the month and branch filters.</p>
                  </td>
                </tr>
              ) : visibleSalaries.map((salary) => {
                const employee = getEmployee(salary);
                const bank = getBankDetails(salary);
                const status = salary.status || 'Generated';
                const isPaid = String(status).toLowerCase() === 'paid';
                const paymentMethod = getPaymentMethodLabel(salary);
                const canPay = PAYABLE_STATUSES.includes(String(status).toLowerCase());
                const canEdit = EDITABLE_STATUSES.includes(String(status).toLowerCase());
                const id = getId(salary);
                return (
                  <tr key={id} className="transition-colors hover:bg-indigo-50/30">
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-semibold text-slate-800">{getEmployeeName(salary)}</p>
                      <p className="truncate text-[11px] text-slate-400">{employee.uniqueID || salary.employeeCode || employee.email || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatSalaryPeriod(salary)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(salary.grossSalary)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(salary.totalDeduction ?? salary.totalAppliedDeductions ?? salary.totalDeductions)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(getSalaryAmount(salary))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isPaid
                          ? paymentMethod === 'Cash'
                            ? 'bg-amber-50 text-amber-700'
                            : paymentMethod === 'Account'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {paymentMethod === 'Cash' && <Banknote className="h-3.5 w-3.5" />}
                        {paymentMethod === 'Account' && <Building2 className="h-3.5 w-3.5" />}
                        {paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>{status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`View ${getEmployeeName(salary)} payroll details`}
                          title="View payroll details"
                          onClick={() => setViewingSalary(salary)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${getEmployeeName(salary)} payroll`}
                          title={canEdit ? 'Edit payroll details' : 'Approved or paid payroll cannot be edited'}
                          onClick={() => openSalaryEditor(salary)}
                          disabled={!canEdit}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {isPaid ? (
                          <span className="whitespace-nowrap text-[11px] text-slate-500">Paid {formatDate(salary.paidAt)}</span>
                        ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSalary(salary);
                            setPaymentMode('BANK_TRANSFER');
                            setTransferConfirmed(false);
                            setTransferReference('');
                            setPaymentError('');
                          }}
                          disabled={!canPay}
                          className="whitespace-nowrap rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Record payment
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{visibleSalaries.length} employee{visibleSalaries.length === 1 ? '' : 's'} shown</span>
          <span>Paid: {payrollSummary.paidCount} · Pending: {payrollSummary.dueCount}</span>
        </div>
      </div>

      {selectedSalary && (() => {
        const employeeBank = getBankDetails(selectedSalary);
        const employeeName = getEmployeeName(selectedSalary);
        const isBankPayment = paymentMode === 'BANK_TRANSFER';
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-3 sm:p-5">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close salary payment confirmation" onClick={closePayment} />
            <section role="dialog" aria-modal="true" aria-labelledby="salary-payment-title" className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">Salary payment</p>
                  <h2 id="salary-payment-title" className="mt-0.5 text-lg font-bold text-slate-900">Record payment</h2>
                  <p className="mt-1 text-xs text-slate-500">{employeeName} · {formatSalaryPeriod(selectedSalary)}</p>
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
              </div>

              <form onSubmit={handlePaySalary} className="mt-4 space-y-4">
                <fieldset>
                  <legend className={LABEL_CLASS}>How was the salary paid?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'CASH', label: 'Cash', Icon: Banknote },
                      { value: 'BANK_TRANSFER', label: 'Account transfer', Icon: Building2 },
                    ].map(({ value, label, Icon }) => (
                      <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                        paymentMode === value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="salaryPaymentMode"
                          value={value}
                          checked={paymentMode === value}
                          onChange={() => {
                            setPaymentMode(value);
                            setTransferConfirmed(false);
                            setTransferReference('');
                            setPaymentError('');
                          }}
                          disabled={isPaying}
                          className="sr-only"
                        />
                        <Icon className="h-4 w-4" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {isBankPayment ? (
                  <>
                    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs">
                      <p className="mb-2 font-semibold text-sky-900">Employee account destination</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><p className="text-slate-500">Account holder</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.holder || employeeName}</p></div>
                        <div><p className="text-slate-500">Bank</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.bank || '—'}</p></div>
                        <div><p className="text-slate-500">Account number</p><p className="mt-0.5 break-all font-semibold text-slate-800">{employeeBank.accountNumber || 'Missing'}</p></div>
                        <div><p className="text-slate-500">IFSC</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.ifsc || 'Missing'}</p></div>
                        {employeeBank.branch && <div className="sm:col-span-2"><p className="text-slate-500">Bank branch</p><p className="mt-0.5 font-semibold text-slate-800">{employeeBank.branch}</p></div>}
                      </div>
                    </div>
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
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Confirm only after the salary has been handed to the employee in cash.
                  </div>
                )}
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-700"
                    checked={transferConfirmed}
                    onChange={(event) => setTransferConfirmed(event.target.checked)}
                    disabled={isPaying}
                    required
                  />
                  <span>{isBankPayment
                    ? 'I have completed this bank transfer to the employee’s account. This confirmation will mark the payroll as Paid.'
                    : 'I have handed the salary to the employee in cash. This confirmation will mark the payroll as Paid.'}</span>
                </label>
                {paymentError && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{paymentError}
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline" onClick={closePayment} isDisabled={isPaying}>Cancel</Button>
                  <Button type="submit" leftIcon={CheckCircle2} isLoading={isPaying} isDisabled={
                    !transferConfirmed || (isBankPayment && (!employeeBank.accountNumber || !employeeBank.ifsc))
                  }>
                    Mark as Paid
                  </Button>
                </div>
              </form>
            </section>
          </div>
        );
      })()}

      {viewingSalary && (() => {
        const employee = getEmployee(viewingSalary);
        const salaryDeductionBreakdown = getSalaryDeductionBreakdown(viewingSalary);
        const simpleFixed = isSimpleFixedPayroll(viewingSalary);
        const detailAmount = (...keys) => getSalaryDetailAmount(viewingSalary, ...keys);
        const earnings = simpleFixed
          ? [{
            label: 'Fixed monthly salary',
            amount: detailAmount('earnedBaseSalary', 'fixedSalary', 'monthlySalary', 'basicSalary'),
          }]
          : [
            { label: 'Basic salary', amount: detailAmount('basicSalary') },
            { label: 'HRA', amount: detailAmount('hra') },
            { label: 'Conveyance allowance', amount: detailAmount('conveyanceAllowance') },
            { label: 'Medical allowance', amount: detailAmount('medicalAllowance') },
            { label: 'Special allowance', amount: detailAmount('specialAllowance', 'allowance') },
            { label: 'Dearness allowance', amount: detailAmount('dearnessAllowance') },
            { label: 'Other allowances', amount: detailAmount('otherAllowances') },
            { label: 'Fixed bonus', amount: detailAmount('fixedBonus') },
          ];
        earnings.push(
          { label: 'Extra allowance', amount: detailAmount('extraAllowance') },
          { label: 'Incentive', amount: detailAmount('incentive') },
          { label: 'Bonus', amount: detailAmount('bonus', 'extraBonus') }
        );
        const listedEarnings = earnings.reduce((total, item) => total + (Number(item.amount) || 0), 0);
        const grossSalary = detailAmount('grossSalary');
        if (grossSalary - listedEarnings > 0.01) {
          earnings.push({ label: 'Other / unitemized earnings', amount: grossSalary - listedEarnings });
        }
        const employerData = viewingSalary.employerContributions || viewingSalary.salaryStructureSnapshot?.employerContributions || {};
        const employerContributions = [
          { label: 'Employer PF', amount: employerData.pf },
          { label: 'Employer ESIC', amount: employerData.esic },
          { label: 'Gratuity', amount: employerData.gratuity },
          { label: 'Other contribution', amount: employerData.other },
        ];
        const attendanceDetails = [
          ['Salary structure', viewingSalary.structureType || viewingSalary.salaryStructureSnapshot?.structureType || '—'],
          ['Monthly base salary', detailAmount('monthlySalary', 'fixedSalary') ? formatCurrency(detailAmount('monthlySalary', 'fixedSalary')) : '—'],
          ['Earned base salary', detailAmount('earnedBaseSalary') ? formatCurrency(detailAmount('earnedBaseSalary')) : '—'],
          ['Basic for PF', detailAmount('basicForPf') ? formatCurrency(detailAmount('basicForPf')) : '—'],
          ['Total calendar days', viewingSalary.totalDays ?? '—'],
          ['Working days', viewingSalary.workingDays ?? '—'],
          ['Present days', viewingSalary.presentDays ?? '—'],
          ['Payable days', viewingSalary.daysPayable ?? viewingSalary.payableDays ?? '—'],
          ['Approved leave days', viewingSalary.approvedLeaveDays ?? viewingSalary.leaveDays ?? 0],
          ['Unpaid / LOP days', viewingSalary.lopDays ?? viewingSalary.unpaidLeaveDays ?? 0],
          ['Unauthorized full days', viewingSalary.unauthorizedFullDayCount ?? viewingSalary.unauthorizedFullDays ?? 0],
          ['Unauthorized half days', viewingSalary.unauthorizedHalfDayCount ?? viewingSalary.unauthorizedHalfDays ?? 0],
          ['Actual absence days', viewingSalary.actualAbsenceDays ?? 0],
          ['Penalty incidents', viewingSalary.penaltyEligibleIncidentCount ?? 0],
          ['Sundays', viewingSalary.sundaysCount ?? viewingSalary.sundays ?? 0],
          ['Saturday holidays', viewingSalary.saturdayHolidaysCount ?? viewingSalary.saturdayHolidays ?? 0],
          ['Configured holidays', viewingSalary.configuredHolidaysCount ?? viewingSalary.configuredHolidays ?? 0],
          ['Per-day salary', formatCurrency(viewingSalary.perDaySalary)],
          ['Calculation divisor', viewingSalary.calculationDivisor ?? '—'],
          ['Calculation mode', String(viewingSalary.calculationMode || '—').replace(/_/g, ' ')],
          ['PF applicable', viewingSalary.isPfApplicable == null ? '—' : viewingSalary.isPfApplicable ? 'Yes' : 'No'],
          ['ESIC applicable', viewingSalary.isEsicApplicable == null ? '—' : viewingSalary.isEsicApplicable ? 'Yes' : 'No'],
          ['Professional Tax applicable', viewingSalary.isPtApplicable == null ? '—' : viewingSalary.isPtApplicable ? 'Yes' : 'No'],
          ['TDS applicable', viewingSalary.isTdsApplicable == null ? '—' : viewingSalary.isTdsApplicable ? 'Yes' : 'No'],
          ['Financial year', viewingSalary.financialYearId?.yearLabel || viewingSalary.financialYearId?.year || viewingSalary.financialYearId?.name || '—'],
        ];
        const bank = getBankDetails(viewingSalary);
        const remarkReference = String(viewingSalary.remarks || '').match(/(?:UTR\/Reference|reference)\s*:\s*([^\n.]+)/i)?.[1]?.trim();
        const designation = employee.designation?.designationName || employee.designation?.name || employee.designation || '—';
        const department = employee.department?.departmentName || employee.department?.name || employee.department || '—';
        const employeeDetails = [
          ['Employee ID', employee.uniqueID || viewingSalary.employeeCode || '—'],
          ['Email', employee.email || '—'],
          ['Phone', employee.phoneNumber || employee.phone || '—'],
          ['Role', employee.role || '—'],
          ['Department', department],
          ['Designation', designation],
        ];
        const approvalInfo = [
          ['Status', viewingSalary.status || 'Generated'],
          ['Payment method', getPaymentMethodLabel(viewingSalary)],
          ['Generated date', formatDate(viewingSalary.generatedAt || viewingSalary.createdAt)],
          ['Approved date', formatDate(viewingSalary.approvedAt)],
          ['Paid date', formatDate(viewingSalary.paidAt)],
          ['Payment reference', viewingSalary.utrNumber || viewingSalary.transactionReference || viewingSalary.paymentReference || remarkReference || '—'],
          ['Bank name', bank.bank || '—'],
          ['Account holder', bank.holder || '—'],
          ['Account number', bank.accountNumber ? `Ending in ${bank.accountNumber.slice(-4)}` : '—'],
          ['IFSC code', bank.ifsc || '—'],
          ['Generated by', viewingSalary.generatedBy?.name || viewingSalary.generatedBy?.fullName || '—'],
          ['Approved by', viewingSalary.approvedBy?.name || viewingSalary.approvedBy?.fullName || '—'],
          ['Paid by', viewingSalary.paidBy?.name || viewingSalary.paidBy?.fullName || '—'],
          ['Remarks', viewingSalary.remarks || '—'],
        ];
        const renderAmounts = (items, showZero = false) => {
          const rows = items.filter((item) => showZero || Number(item.amount) > 0);
          return rows.length ? (
            <div className="divide-y divide-slate-100">
              {rows.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 text-slate-600">
                    {item.label}
                    {item.note && <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">{item.note}</span>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-800">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-slate-400">No components recorded.</p>
          );
        };
        const renderDetailGrid = (items) => (
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(([label, value]) => (
              <div key={label} className="border-b border-slate-100 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-0.5 break-words text-xs font-medium text-slate-700">{value}</p>
              </div>
            ))}
          </div>
        );
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-5">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close salary details" onClick={() => setViewingSalary(null)} />
            <section role="dialog" aria-modal="true" aria-labelledby="salary-details-title" className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">Payroll breakdown</p>
                  <h2 id="salary-details-title" className="mt-0.5 text-lg font-bold text-slate-900">{getEmployeeName(viewingSalary)}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatSalaryPeriod(viewingSalary)} · {employee.uniqueID || employee.email || viewingSalary.employeeCode || 'Employee'}</p>
                </div>
                <button type="button" aria-label="Close salary details" onClick={() => setViewingSalary(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Gross salary</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{formatCurrency(grossSalary || getSalaryAmount(viewingSalary) + salaryDeductionBreakdown.totalDeduction)}</p>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Total deductions</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{formatCurrency(salaryDeductionBreakdown.totalDeduction)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Net pay</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{formatCurrency(getSalaryAmount(viewingSalary))}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Earnings</h3>
                    {renderAmounts(earnings)}
                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                      <span>Gross earnings</span>
                      <span className="tabular-nums">{formatCurrency(grossSalary || getSalaryAmount(viewingSalary) + salaryDeductionBreakdown.totalDeduction)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Deductions</h3>
                    {renderAmounts(salaryDeductionBreakdown.deductions, true)}
                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                      <span>Total deductions</span>
                      <span className="tabular-nums">{formatCurrency(salaryDeductionBreakdown.totalDeduction)}</span>
                    </div>
                  </div>
                </div>
                {salaryDeductionBreakdown.unitemizedBalance < -0.01 && (
                  <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Itemized deductions exceed the recorded total by {formatCurrency(Math.abs(salaryDeductionBreakdown.unitemizedBalance))}. Please review this payroll record.
                  </p>
                )}
                {salaryDeductionBreakdown.proposedPenalty > 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Proposed penalty not included in deductions: {formatCurrency(salaryDeductionBreakdown.proposedPenalty)}
                  </p>
                )}
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Employee details</h3>
                  {renderDetailGrid(employeeDetails)}
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Attendance &amp; payroll calculation</h3>
                  {renderDetailGrid(attendanceDetails)}
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Employer contributions</h3>
                  <p className="mb-1 text-[10px] text-slate-500">Employer-paid amounts are shown separately and are not deducted from employee net pay.</p>
                  {renderAmounts(employerContributions, true)}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                    <span>Total employer contribution</span>
                    <span className="tabular-nums">{formatCurrency(employerContributions.reduce((total, item) => total + (Number(item.amount) || 0), 0))}</span>
                  </div>
                </section>
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-700">Payment &amp; payroll record</h3>
                  {renderDetailGrid(approvalInfo)}
                </section>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
                {EDITABLE_STATUSES.includes(String(viewingSalary.status || 'Generated').toLowerCase()) && (
                  <Button
                    type="button"
                    variant="outline"
                    leftIcon={Pencil}
                    onClick={() => {
                      const salary = viewingSalary;
                      setViewingSalary(null);
                      openSalaryEditor(salary);
                    }}
                  >
                    Edit payroll
                  </Button>
                )}
                <Button type="button" onClick={() => setViewingSalary(null)}>Close</Button>
              </div>
            </section>
          </div>
        );
      })()}

      {editingSalary && (() => {
        const simpleFixed = isSimpleFixedPayroll(editingSalary);
        const fields = [
          ...(simpleFixed
            ? [{ name: 'fixedSalary', label: 'Monthly fixed salary' }]
            : COMPONENT_EDIT_FIELDS),
          ...COMMON_EDIT_FIELDS,
        ];
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-5">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close edit salary"
              onClick={() => {
                if (isSavingSalary) return;
                setEditingSalary(null);
                setSalaryEditError('');
              }}
            />
            <section role="dialog" aria-modal="true" aria-labelledby="edit-salary-title" className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Edit payroll</p>
                  <h2 id="edit-salary-title" className="mt-0.5 text-lg font-bold text-slate-900">{getEmployeeName(editingSalary)}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatSalaryPeriod(editingSalary)} · Current net {formatCurrency(getSalaryAmount(editingSalary))}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close edit salary"
                  disabled={isSavingSalary}
                  onClick={() => {
                    setEditingSalary(null);
                    setSalaryEditError('');
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSaveSalary} className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map(({ name, label }) => (
                    <label key={name}>
                      <span className={LABEL_CLASS}>{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className={CONTROL_CLASS}
                        value={salaryEditForm[name] ?? ''}
                        onChange={(event) => setSalaryEditForm((current) => ({ ...current, [name]: event.target.value }))}
                        disabled={isSavingSalary}
                      />
                    </label>
                  ))}
                </div>
                <label className="block">
                  <span className={LABEL_CLASS}>Remarks</span>
                  <textarea
                    className={`${CONTROL_CLASS} min-h-20 resize-y`}
                    value={salaryEditForm.remarks ?? ''}
                    onChange={(event) => setSalaryEditForm((current) => ({ ...current, remarks: event.target.value }))}
                    disabled={isSavingSalary}
                    maxLength={500}
                  />
                </label>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  Net salary and deductions are recalculated when you save. Approved and paid payroll records cannot be edited.
                </p>
                {salaryEditError && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{salaryEditError}
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (isSavingSalary) return;
                      setEditingSalary(null);
                      setSalaryEditError('');
                    }}
                    isDisabled={isSavingSalary}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" leftIcon={Save} isLoading={isSavingSalary}>Save changes</Button>
                </div>
              </form>
            </section>
          </div>
        );
      })()}
    </section>
  );
};
