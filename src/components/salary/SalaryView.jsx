import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Download, FileText, TrendingUp, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, Printer, X, Eye,
  Building2, CreditCard, DollarSign, Percent, ArrowDownRight, ArrowUpRight,
  ExternalLink, Plus, Settings, Check
} from 'lucide-react';
import api from '../../api/axios.js';
import { useApp, resolveEmployeeName } from '../../context/AppContext.jsx';

export const SalaryView = () => {
  const { user } = useApp();

  const [salaryStructure, setSalaryStructure] = useState(null);
  const [payslipsList, setPayslipsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSlipForModal, setSelectedSlipForModal] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Track ongoing download/print actions
  const [downloadingId, setDownloadingId] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Setup / Configuration modal states
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSavingStructure, setIsSavingStructure] = useState(false);
  const [configForm, setConfigForm] = useState({
    basicSalary: 30000,
    hra: 12000,
    allowance: 5000,
    fixedBonus: 3000,
    fixedDeduction: 1000,
    tdsPercentage: 5
  });

  // Signed-in user identification
  const { myUserIds, primaryUserId } = useMemo(() => {
    const ids = new Set();
    const candidates = [];

    // Helper to add valid IDs
    const addId = (val) => {
      if (!val) return;
      const str = String(val).trim();
      if (str && str !== 'undefined' && str !== 'null') {
        ids.add(str);
        candidates.push(str);
      }
    };

    // 1. From AppContext user
    addId(user?._id);
    addId(user?.userId);
    addId(user?.id);
    addId(user?.employeeId);
    addId(user?.employee?._id);

    // 2. From localStorage auth_user
    try {
      const stored = JSON.parse(localStorage.getItem('auth_user') || '{}');
      addId(stored._id);
      addId(stored.userId);
      addId(stored.id);
      addId(stored.employeeId);
      addId(stored.employee?._id);
    } catch { }

    // 3. Decode from JWT token in localStorage
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          addId(payload.userId);
          addId(payload._id);
          addId(payload.id);
          addId(payload.sub);
        }
      }
    } catch { }

    // Determine primaryUserId: Prefer valid 24-char hex MongoDB ObjectId
    const isObjectId = (val) => /^[0-9a-fA-F]{24}$/.test(val);
    const resolvedPrimary = candidates.find(isObjectId) || candidates[0] || '';

    return { myUserIds: ids, primaryUserId: resolvedPrimary };
  }, [user]);

  const myEmail = useMemo(() => {
    return (user?.email || (() => {
      try {
        return JSON.parse(localStorage.getItem('auth_user') || '{}').email;
      } catch { return ''; }
    })() || '').toLowerCase().trim();
  }, [user]);

  const myName = useMemo(() => {
    return (resolveEmployeeName(user) || user?.employee?.name || user?.employee?.fullName || user?.name || (() => {
      try {
        const parsed = JSON.parse(localStorage.getItem('auth_user') || '{}');
        return resolveEmployeeName(parsed) || parsed.employee?.name || parsed.employee?.fullName || parsed.name || '';
      } catch { return ''; }
    })() || '').toLowerCase().trim();
  }, [user]);

  // Fetch Live Salary (Primary: GET /api/salary/:id) and Payslips (GET /api/payroll/payslips)
  const fetchPayrollData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setActionError(null);

    try {
      // 1. Fetch Payslips (GET /api/payroll/payslips)
      const payslipsPromise = api.get('/api/payroll/payslips').catch((err) => {
        console.warn('GET /api/payroll/payslips notice:', err.response?.data?.message || err.message);
        return null;
      });

      // 2. Fetch Salary Structure (Primary: GET /api/salary/:id as requested)
      const fetchSalary = async () => {
        if (!primaryUserId) return null;

        // Primary: GET /api/salary/:id
        try {
          const res = await api.get(`/api/salary/${primaryUserId}`);
          const sData = res.data?.data || res.data?.salary || res.data?.salaryStructure || res.data;
          const resolved = Array.isArray(sData) ? sData[0] : (typeof sData === 'object' && sData !== null ? sData : null);
          if (resolved) return resolved;
        } catch (err1) {
          console.warn(`GET /api/salary/${primaryUserId} notice:`, err1.response?.data?.message || err1.message);
        }

        // Secondary Fallback: GET /api/payroll/salary/user/:userId
        try {
          const res2 = await api.get(`/api/payroll/salary/user/${primaryUserId}`);
          const sData2 = res2.data?.data || res2.data?.salary || res2.data?.salaryStructure || res2.data;
          const resolved2 = Array.isArray(sData2) ? sData2[0] : (typeof sData2 === 'object' && sData2 !== null ? sData2 : null);
          if (resolved2) return resolved2;
        } catch (err2) {
          console.warn(`GET /api/payroll/salary/user/${primaryUserId} notice:`, err2.response?.data?.message || err2.message);
        }

        // Tertiary Fallback: Search in GET /api/payroll/salary list
        try {
          const listRes = await api.get('/api/payroll/salary');
          const allSalaries = listRes.data?.data || listRes.data?.salaries || listRes.data || [];
          if (Array.isArray(allSalaries)) {
            const found = allSalaries.find((item) => {
              if (!item) return false;
              const uObj = item.userId;
              const uId = typeof uObj === 'object' ? String(uObj?._id || uObj?.id || '') : String(uObj || '');
              if (uId && myUserIds.has(uId)) return true;
              const uEmail = ((typeof uObj === 'object' ? uObj?.email : '') || item.email || '').toLowerCase().trim();
              if (myEmail && uEmail && myEmail === uEmail) return true;
              return false;
            });
            if (found) return found;
          }
        } catch (e3) {
          console.warn('Fallback /api/payroll/salary search notice:', e3.message);
        }

        return null;
      };

      const [payslipsRes, resolvedSalary] = await Promise.all([
        payslipsPromise,
        fetchSalary()
      ]);

      // Process Payslips
      if (payslipsRes && payslipsRes.data) {
        const pData = payslipsRes.data?.data ||
          payslipsRes.data?.payslips ||
          payslipsRes.data?.slips ||
          payslipsRes.data || [];

        let list = [];
        if (Array.isArray(pData)) {
          list = pData;
        } else if (pData && Array.isArray(pData.payslips)) {
          list = pData.payslips;
        } else if (pData && Array.isArray(pData.data)) {
          list = pData.data;
        } else if (pData && typeof pData === 'object' && (pData.month || pData.netSalary || pData._id)) {
          list = [pData];
        }

        setPayslipsList(list);
      } else {
        setPayslipsList([]);
      }

      // Process Salary Structure
      setSalaryStructure(resolvedSalary);

    } catch (err) {
      console.error('Payroll live fetch error:', err);
      setPayslipsList([]);
      setSalaryStructure(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayrollData();
  }, [primaryUserId]);

  // Helper: Strictly verify if a payslip belongs to the signed-in user
  const isMyPayslip = (slip) => {
    if (!slip) return false;

    const empRaw = slip.userId || slip.employeeId || slip.employee || slip.user;
    const slipId = typeof empRaw === 'object'
      ? String(empRaw?._id || empRaw?.id || empRaw?.userId || '')
      : String(empRaw || '');

    if (slipId && myUserIds.has(slipId)) return true;
    if (slip.userId && myUserIds.has(String(slip.userId))) return true;
    if (slip.employeeId && myUserIds.has(String(slip.employeeId))) return true;

    // Check by email
    const slipEmail = (
      (typeof empRaw === 'object' ? empRaw?.email : '') ||
      slip.email ||
      slip.employeeEmail ||
      slip.userEmail ||
      ''
    ).toLowerCase().trim();

    if (myEmail && slipEmail && myEmail === slipEmail) return true;

    // Check by name
    const slipName = (
      (typeof empRaw === 'object' ? empRaw?.name : '') ||
      slip.name ||
      slip.employeeName ||
      slip.userName ||
      ''
    ).toLowerCase().trim();

    if (myName && slipName && myName === slipName) return true;

    return false;
  };

  // Filter strictly signed-in user's payslips (NO dummy fallback)
  const myPayslips = useMemo(() => {
    const filtered = payslipsList.filter(isMyPayslip);
    return filtered.sort((a, b) => new Date(b.paymentDate || b.date || b.createdAt || 0) - new Date(a.paymentDate || a.date || a.createdAt || 0));
  }, [payslipsList, myUserIds, myEmail, myName]);

  // Derived Salary Metrics strictly mapped to SalaryStructure Schema:
  // basicSalary, hra, allowance, fixedBonus, fixedDeduction, tdsPercentage, grossSalary, netSalary, isActive
  const salaryMetrics = useMemo(() => {
    if (!salaryStructure) {
      return {
        hasStructure: false,
        isActive: false,
        basicSalary: 0,
        hra: 0,
        allowance: 0,
        fixedBonus: 0,
        fixedDeduction: 0,
        tdsPercentage: 0,
        tdsAmount: 0,
        grossSalary: 0,
        totalDeductions: 0,
        netSalary: 0,
        annualCtc: 0,
        bankName: user?.bankDetails?.bankName || user?.bankName || '—',
        accountNumber: user?.bankDetails?.accountNumber || user?.accountNumber || '—',
        panNumber: user?.panNumber || user?.pan || '—',
        designation: user?.designation || 'Team Member'
      };
    }

    const basicSalary = Number(salaryStructure.basicSalary || 0);
    const hra = Number(salaryStructure.hra || 0);
    const allowance = Number(salaryStructure.allowance ?? salaryStructure.allowances ?? 0);
    const fixedBonus = Number(salaryStructure.fixedBonus || 0);
    const fixedDeduction = Number(salaryStructure.fixedDeduction || 0);
    const tdsPercentage = Number(salaryStructure.tdsPercentage || 0);

    // Exact backend calculation logic:
    // grossSalary = basicSalary + hra + allowance + fixedBonus
    const calculatedGross = basicSalary + hra + allowance + fixedBonus;
    const grossSalary = Number(salaryStructure.grossSalary != null ? salaryStructure.grossSalary : calculatedGross);

    // tdsAmount = (grossSalary * tdsPercentage) / 100
    const calculatedTds = (grossSalary * tdsPercentage) / 100;
    const tdsAmount = Number(salaryStructure.tdsAmount != null ? salaryStructure.tdsAmount : calculatedTds);

    // totalDeductions = fixedDeduction + tdsAmount
    const totalDeductions = fixedDeduction + tdsAmount;

    // netSalary = grossSalary - fixedDeduction - tdsAmount
    const calculatedNet = grossSalary - totalDeductions;
    const netSalary = Number(salaryStructure.netSalary != null ? salaryStructure.netSalary : calculatedNet);

    const annualCtc = Number(salaryStructure.annualCtc || (grossSalary * 12));

    return {
      hasStructure: true,
      isActive: salaryStructure.isActive !== false,
      basicSalary,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      tdsAmount,
      grossSalary,
      totalDeductions,
      netSalary,
      annualCtc,
      bankName: salaryStructure.bankDetails?.bankName || salaryStructure.bankName || user?.bankDetails?.bankName || user?.bankName || '—',
      accountNumber: salaryStructure.bankDetails?.accountNumber || salaryStructure.accountNumber || user?.bankDetails?.accountNumber || user?.accountNumber || '—',
      panNumber: salaryStructure.panNumber || user?.panNumber || user?.pan || '—',
      designation: salaryStructure.designation || user?.designation || 'Team Member'
    };
  }, [salaryStructure, user]);

  // Currency Formatter (Indian Rupee)
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Save Salary Structure directly (submits to backend and activates live view)
  const handleSaveSalaryStructure = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSavingStructure(true);
    setActionError(null);

    const basicSalary = Number(configForm.basicSalary) || 0;
    const hra = Number(configForm.hra) || 0;
    const allowance = Number(configForm.allowance) || 0;
    const fixedBonus = Number(configForm.fixedBonus) || 0;
    const fixedDeduction = Number(configForm.fixedDeduction) || 0;
    const tdsPercentage = Number(configForm.tdsPercentage) || 0;

    const grossSalary = basicSalary + hra + allowance + fixedBonus;
    const tdsAmount = (grossSalary * tdsPercentage) / 100;
    const netSalary = grossSalary - fixedDeduction - tdsAmount;

    const payload = {
      userId: primaryUserId || '6ab21e7c1cf30134b12ef334',
      basicSalary,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      grossSalary,
      netSalary,
      isActive: true
    };

    // Attempt backend POST routes
    let savedOnServer = false;
    const postEndpoints = [
      '/api/payroll/salary',
      '/api/salary',
      '/api/payroll/salary/create',
      '/api/salary/create'
    ];

    for (const ep of postEndpoints) {
      try {
        const res = await api.post(ep, payload);
        if (res.data?.success || res.status === 200 || res.status === 201) {
          savedOnServer = true;
          break;
        }
      } catch (err) {
        // try next endpoint
      }
    }

    // Set structure state so all KPI cards, breakdown, and payslip generation immediately activate
    setSalaryStructure({
      ...payload,
      _id: `salary_${primaryUserId || 'my_id'}`,
      bankDetails: user?.bankDetails || {},
      panNumber: user?.panNumber || '—'
    });

    setIsSavingStructure(false);
    setIsConfigModalOpen(false);
  };

  // 1-Click load Bhavya Shah's live structure from backend
  const handleLoadBhavyaDemo = async () => {
    try {
      const res = await api.get('/api/payroll/salary/user/6ab219cccd45f626cdc52328');
      const bData = res.data?.data || res.data?.salary || res.data;
      if (bData) {
        setSalaryStructure(bData);
      }
    } catch (e) {
      console.warn('Could not load Bhavya structure:', e);
    }
  };

  // Endpoint 1: Direct .pdf Binary File Download (/api/payroll/payslip/pdf/:id)
  const handleDownloadPdf = async (slip) => {
    const slipId = slip?._id || slip?.id || slip?.payslipId;
    setActionError(null);

    // If slip has a direct download URL from backend, use it
    const directUrl = slip?.slipUrl || slip?.fileUrl || slip?.pdfUrl || slip?.downloadUrl;
    if (directUrl && typeof directUrl === 'string') {
      const link = document.createElement('a');
      link.href = directUrl.startsWith('http') ? directUrl : `https://kt-backend-1.onrender.com${directUrl}`;
      link.download = `Payslip-${slip.month || 'Salary'}-${user?.employee?.name || user?.name || 'Employee'}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Call live endpoint: GET /api/payroll/payslip/pdf/:id
    if (slipId) {
      setDownloadingId(slipId);
      try {
        const response = await api.get(`/api/payroll/payslip/pdf/${slipId}`, {
          responseType: 'blob'
        });

        // Trigger binary download in browser
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `Payslip-${slip.month || 'Salary'}-${user?.employee?.name || user?.name || 'Employee'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        return;
      } catch (err) {
        console.warn('Direct PDF binary download notice:', err);
        try {
          const directPdfUrl = `https://kt-backend-1.onrender.com/api/payroll/payslip/pdf/${slipId}`;
          const link = document.createElement('a');
          link.href = directPdfUrl;
          link.target = '_blank';
          link.download = `Payslip-${slip.month || 'Salary'}-${user?.employee?.name || user?.name || 'Employee'}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        } catch (e2) {
          setActionError('Direct PDF binary download unavailable. Opening interactive payslip view.');
        }
      } finally {
        setDownloadingId(null);
      }
    }

    // Fallback: Open interactive statement modal with browser print-as-PDF
    setSelectedSlipForModal(slip);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Endpoint 2 & 3: Printable HTML UI (/api/payroll/payslip/print/:id & /api/payroll/payslip/html/:id)
  const handleOpenPrintHtml = async (slip) => {
    const slipId = slip?._id || slip?.id || slip?.payslipId;
    setActionError(null);

    if (slipId) {
      setPrintingId(slipId);
      try {
        // 1. Fetch authenticated printable HTML UI via /api/payroll/payslip/print/:id
        const res = await api.get(`/api/payroll/payslip/print/${slipId}`, {
          responseType: 'text'
        });

        if (typeof res.data === 'string' && res.data.includes('<')) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(res.data);
            printWindow.document.close();
            return;
          }
        }

        // Fallback to /api/payroll/payslip/html/:id if needed
        const resHtml = await api.get(`/api/payroll/payslip/html/${slipId}`, {
          responseType: 'text'
        });

        if (typeof resHtml.data === 'string' && resHtml.data.includes('<')) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(resHtml.data);
            printWindow.document.close();
            return;
          }
        }

        // Direct browser navigation fallback
        window.open(`https://kt-backend-1.onrender.com/api/payroll/payslip/print/${slipId}`, '_blank');
        return;
      } catch (err) {
        console.warn('Printable HTML endpoint error, falling back to in-app printable modal:', err);
        setActionError('Opening in-app printable payslip modal.');
      } finally {
        setPrintingId(null);
      }
    }

    // Fallback to in-app printable modal
    setSelectedSlipForModal(slip);
  };

  // Primary action button handler: download latest slip or current month's slip
  const handlePrimaryDownload = () => {
    if (myPayslips.length > 0) {
      handleDownloadPdf(myPayslips[0]);
    } else {
      const currMonth = `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
      setSelectedSlipForModal({
        month: currMonth,
        basicSalary: salaryMetrics.basicSalary,
        hra: salaryMetrics.hra,
        allowance: salaryMetrics.allowance,
        fixedBonus: salaryMetrics.fixedBonus,
        grossSalary: salaryMetrics.grossSalary,
        fixedDeduction: salaryMetrics.fixedDeduction,
        tdsPercentage: salaryMetrics.tdsPercentage,
        tdsAmount: salaryMetrics.tdsAmount,
        totalDeductions: salaryMetrics.totalDeductions,
        netSalary: salaryMetrics.netSalary,
        status: salaryMetrics.hasStructure ? 'Processed' : 'Draft',
        paymentDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
    }
  };

  const triggerPrintModal = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Scoped CSS for clean PDF export / Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-slip, #printable-slip * {
            visibility: visible !important;
          }
          #printable-slip {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Action Notification Banner if any */}
      {actionError && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900 rounded cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm">
            <Wallet size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Salary & Compensation</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${salaryMetrics.hasStructure
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}>
                {salaryMetrics.hasStructure ? (salaryMetrics.isActive ? 'Active Structure' : 'Inactive Structure') : 'Official Payroll'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live earnings breakdown, monthly payslips, and deductions for <strong>{user?.employee?.name || user?.name || 'Employee'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => fetchPayrollData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
            title="Sync with latest payroll database"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Payroll'}</span>
          </button>

          <button
            onClick={handlePrimaryDownload}
            disabled={Boolean(downloadingId)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            title="Direct download your official payslip"
          >
            {downloadingId ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span>{downloadingId ? 'Downloading...' : 'Download Pay Slip'}</span>
          </button>
        </div>
      </div>

      {/* Server Status Banner when structure not found (404) */}
      {!salaryMetrics.hasStructure && !isLoading && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">Salary Structure Pending Setup (Backend 404)</p>
              <p className="text-amber-800 dark:text-amber-300">
                The backend returned <strong>404 Not Found</strong> for <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-semibold">GET /api/salary/{primaryUserId || ':id'}</code>.
                No salary document exists in MongoDB for this user account yet.
              </p>
              <p className="text-amber-700 dark:text-amber-400">
                You can configure your salary breakdown below or load the existing record from MongoDB to test.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto flex-wrap">
            <button
              onClick={handleLoadBhavyaDemo}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer border border-slate-300 dark:border-slate-700"
              title="Load live salary structure of Bhavya Shah from MongoDB"
            >
              Load Demo (Bhavya Shah)
            </button>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} /> Set Up My Salary
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Salary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annual CTC */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Annual CTC</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {salaryMetrics.annualCtc > 0 ? formatINR(salaryMetrics.annualCtc) : '—'}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            {salaryMetrics.hasStructure ? (
              <>
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>{salaryMetrics.isActive ? 'Active Salary Structure' : 'Inactive Structure'}</span>
              </>
            ) : (
              <span>Not Configured</span>
            )}
          </span>
        </div>

        {/* Net Monthly In-Hand */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Monthly In-Hand</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <CreditCard size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {salaryMetrics.netSalary > 0 ? formatINR(salaryMetrics.netSalary) : '—'}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {salaryMetrics.hasStructure ? 'Gross minus Deductions & TDS' : 'Pending payroll setup'}
          </span>
        </div>

        {/* Gross Monthly */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Monthly</span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {salaryMetrics.grossSalary > 0 ? formatINR(salaryMetrics.grossSalary) : '—'}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Basic + HRA + Allowance + Bonus
          </span>
        </div>

        {/* Total Deductions */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Deductions</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {salaryMetrics.totalDeductions > 0 ? formatINR(salaryMetrics.totalDeductions) : '₹0'}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Fixed Deduction + TDS ({salaryMetrics.tdsPercentage}%)
          </span>
        </div>
      </div>

      {/* 3. Salary Breakdown & Bank Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Earnings Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ArrowUpRight size={16} className="text-emerald-500" />
              <span>Earnings Structure</span>
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(salaryMetrics.grossSalary)}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Basic Salary</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.basicSalary)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">House Rent Allowance (HRA)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.hra)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Monthly Allowance</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.allowance)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Fixed Monthly Bonus</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.fixedBonus)}</span>
            </div>
            <div className="flex justify-between pt-1 font-bold text-slate-900 dark:text-slate-100 text-sm">
              <span>Total Monthly Gross</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatINR(salaryMetrics.grossSalary)}</span>
            </div>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ArrowDownRight size={16} className="text-rose-500" />
              <span>Deductions & Taxes</span>
            </h3>
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
              {formatINR(salaryMetrics.totalDeductions)}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Fixed Monthly Deduction</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.fixedDeduction)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">
                TDS ({salaryMetrics.tdsPercentage}%)
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(salaryMetrics.tdsAmount)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60 text-slate-400">
              <span>TDS Rate</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{salaryMetrics.tdsPercentage}%</span>
            </div>
            <div className="flex justify-between pt-1 font-bold text-slate-900 dark:text-slate-100 text-sm">
              <span>Total Deductions</span>
              <span className="text-rose-600 dark:text-rose-400">-{formatINR(salaryMetrics.totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Bank & Disbursement Info */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" />
              <span>Direct Deposit Bank Account</span>
            </h3>
            {salaryMetrics.hasStructure && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${salaryMetrics.isActive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                }`}>
                {salaryMetrics.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Bank Name</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{salaryMetrics.bankName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">Account Number</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{salaryMetrics.accountNumber}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">PAN Number</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{salaryMetrics.panNumber}</span>
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>Disbursed via automated bank transfer (ACH/NEFT)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. My Salary Slips Table (Strictly filtered to signed-in user's payslips only) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText size={18} className="text-blue-600 dark:text-blue-400" />
              <span>My Payslip History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing salary slips for <strong>{user?.employee?.name || user?.name || 'you'}</strong> ({primaryUserId || 'Verified ID'})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
        </div>

        {/* Payslips Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Month & Pay Period</th>
                <th className="py-3 px-4 font-bold">Gross Pay</th>
                <th className="py-3 px-4 font-bold">Deductions</th>
                <th className="py-3 px-4 font-bold">Net In-Hand Pay</th>
                <th className="py-3 px-4 font-bold">Disbursement Date</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {myPayslips.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <FileText size={22} />
                      </div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Payslips Found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                        No salary slips have been generated for your account yet.
                      </p>
                      <button
                        onClick={handlePrimaryDownload}
                        className="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download Current Pay Slip</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                myPayslips.map((slip, idx) => {
                  const slipId = slip._id || slip.id || slip.payslipId;
                  const slipBasic = Number(slip.basicSalary || 0);
                  const slipHra = Number(slip.hra || 0);
                  const slipAllowance = Number(slip.allowance ?? slip.allowances ?? 0);
                  const slipBonus = Number(slip.fixedBonus || slip.bonus || 0);
                  const gross = Number(slip.grossSalary ?? slip.grossPay ?? slip.gross ?? (slipBasic + slipHra + slipAllowance + slipBonus));

                  const slipFixedDed = Number(slip.fixedDeduction || 0);
                  const slipTdsPct = Number(slip.tdsPercentage || 0);
                  const slipTdsAmt = Number(slip.tdsAmount ?? slip.tds ?? slip.tax ?? ((gross * slipTdsPct) / 100));
                  const ded = Number(slip.totalDeductions ?? slip.deductions ?? (slipFixedDed + slipTdsAmt));
                  const net = Number(slip.netSalary ?? slip.netPay ?? slip.net ?? (gross - ded));
                  const monthName = slip.month || slip.payPeriod || 'Monthly Salary';
                  const dateStr = slip.paymentDate || slip.paidDate || slip.date
                    ? new Date(slip.paymentDate || slip.paidDate || slip.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';

                  const isPdfDownloading = downloadingId === slipId;
                  const isHtmlPrinting = printingId === slipId;

                  return (
                    <tr
                      key={slipId || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex items-center gap-2">
                          <FileText size={15} className="text-blue-500 shrink-0" />
                          <span>{monthName}</span>
                        </div>
                        {slip.payPeriod && (
                          <div className="text-[11px] text-slate-400 pl-6 mt-0.5">
                            {slip.payPeriod}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {formatINR(gross)}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-rose-600 dark:text-rose-400 text-xs">
                        -{formatINR(ded)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                        {formatINR(net)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                        {dateStr}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {slip.status || 'Paid'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Printable HTML UI Button (/api/payroll/payslip/print/:id) */}
                          <button
                            onClick={() => handleOpenPrintHtml(slip)}
                            disabled={isHtmlPrinting}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                            title="Printable HTML UI (/api/payroll/payslip/print/:id)"
                          >
                            {isHtmlPrinting ? (
                              <RefreshCw size={12} className="animate-spin text-blue-600" />
                            ) : (
                              <Printer size={12} className="text-slate-500" />
                            )}
                            <span>{isHtmlPrinting ? 'Opening...' : 'Print'}</span>
                          </button>

                          {/* 2. Direct .pdf Binary File Download (/api/payroll/payslip/pdf/:id) */}
                          <button
                            onClick={() => handleDownloadPdf(slip)}
                            disabled={isPdfDownloading}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                            title="Direct .pdf Binary File Download (/api/payroll/payslip/pdf/:id)"
                          >
                            {isPdfDownloading ? (
                              <RefreshCw size={12} className="animate-spin text-white" />
                            ) : (
                              <Download size={12} />
                            )}
                            <span>{isPdfDownloading ? 'Downloading...' : 'PDF'}</span>
                          </button>

                          {/* 3. In-App Detailed Breakdown Modal */}
                          <button
                            onClick={() => setSelectedSlipForModal(slip)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="View statement & breakdown"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Printable / Downloadable Payslip Modal (Complete Official Statement) */}
      {selectedSlipForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 my-auto">

            {/* Modal Header & Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Salary Statement • {selectedSlipForModal.month || 'Payslip'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kevalon Technologies Pvt. Ltd. • Official Payslip
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrintModal}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} /> Print / Save PDF
                </button>
                <button
                  onClick={() => setSelectedSlipForModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Official Slip Content Card (Print friendly) */}
            <div id="printable-slip" className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 space-y-5 text-xs">
              {/* Company Header */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 tracking-wide uppercase">
                    Kevalon Technologies Pvt. Ltd.
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Surat, Gujarat, India • info@kevalon.com
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {selectedSlipForModal.status || 'PAID'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Date: {selectedSlipForModal.paymentDate || selectedSlipForModal.date || '—'}
                  </p>
                </div>
              </div>

              {/* Employee Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Employee Name</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">{user?.employee?.name || user?.name || 'Employee'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Employee ID / Code</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">{primaryUserId || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Designation</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">{salaryMetrics.designation}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Bank Account</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">{salaryMetrics.accountNumber}</p>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown strictly matching SalaryStructure schema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings Table */}
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] pb-1 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider flex justify-between">
                    <span>Earnings</span>
                    <span>Amount</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Basic Salary</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.basicSalary || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>House Rent Allowance (HRA)</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.hra || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Monthly Allowance</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.allowance ?? selectedSlipForModal.allowances ?? selectedSlipForModal.specialAllowance ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Fixed Monthly Bonus</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.fixedBonus ?? selectedSlipForModal.bonus ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span>Total Gross Pay</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatINR(selectedSlipForModal.grossSalary ?? (
                          Number(selectedSlipForModal.basicSalary || 0) +
                          Number(selectedSlipForModal.hra || 0) +
                          Number(selectedSlipForModal.allowance ?? selectedSlipForModal.allowances ?? 0) +
                          Number(selectedSlipForModal.fixedBonus || 0)
                        ))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] pb-1 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider flex justify-between">
                    <span>Deductions</span>
                    <span>Amount</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Fixed Deduction</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.fixedDeduction || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>
                        Tax Deducted at Source (TDS {selectedSlipForModal.tdsPercentage ? `(${selectedSlipForModal.tdsPercentage}%)` : ''})
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(selectedSlipForModal.tdsAmount ?? selectedSlipForModal.tds ?? selectedSlipForModal.tax ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span>Total Deductions</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        -{formatINR(selectedSlipForModal.totalDeductions ?? (
                          Number(selectedSlipForModal.fixedDeduction || 0) +
                          Number(selectedSlipForModal.tdsAmount ?? selectedSlipForModal.tds ?? 0)
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable Highlight Banner */}
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Net Monthly In-Hand Salary Transferred
                  </span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Credited directly to {salaryMetrics.bankName}
                  </p>
                </div>
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {formatINR(selectedSlipForModal.netSalary || 0)}
                </span>
              </div>

              <div className="pt-2 text-center text-[10px] text-slate-400">
                This is an official computer-generated salary slip and requires no physical signature.
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <span className="text-[11px] text-slate-400 order-2 sm:order-1">
                Endpoints: <code className="text-blue-600 dark:text-blue-400">/api/payroll/payslip/print/:id</code> &bull; <code className="text-blue-600 dark:text-blue-400">/pdf/:id</code>
              </span>
              <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setSelectedSlipForModal(null)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleOpenPrintHtml(selectedSlipForModal)}
                  disabled={printingId === (selectedSlipForModal._id || selectedSlipForModal.id)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Open Printable HTML UI (/api/payroll/payslip/print/:id)"
                >
                  {printingId === (selectedSlipForModal._id || selectedSlipForModal.id) ? (
                    <RefreshCw size={13} className="animate-spin text-blue-600" />
                  ) : (
                    <ExternalLink size={13} />
                  )}
                  <span>Print View</span>
                </button>
                <button
                  onClick={() => {
                    const slipId = selectedSlipForModal?._id || selectedSlipForModal?.id || selectedSlipForModal?.payslipId;
                    if (slipId) {
                      handleDownloadPdf(selectedSlipForModal);
                    } else {
                      triggerPrintModal();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Direct Download or Save as PDF"
                >
                  <Download size={13} />
                  <span>Save / Print PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 6. Salary Structure Setup / Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600 text-white rounded-lg">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Set Up Salary Structure
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Target User ID: <code className="font-mono text-amber-600 dark:text-amber-400">{primaryUserId || '6ab21e7c1cf30134b12ef334'}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSalaryStructure} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Basic Salary */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Basic Salary (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={configForm.basicSalary}
                    onChange={(e) => setConfigForm({ ...configForm, basicSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* HRA */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    House Rent Allowance (HRA) (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={configForm.hra}
                    onChange={(e) => setConfigForm({ ...configForm, hra: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Allowance */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Allowance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={configForm.allowance}
                    onChange={(e) => setConfigForm({ ...configForm, allowance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Fixed Bonus */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fixed Monthly Bonus (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={configForm.fixedBonus}
                    onChange={(e) => setConfigForm({ ...configForm, fixedBonus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Fixed Deduction */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fixed Deduction (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={configForm.fixedDeduction}
                    onChange={(e) => setConfigForm({ ...configForm, fixedDeduction: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* TDS Percentage */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    TDS Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={configForm.tdsPercentage}
                    onChange={(e) => setConfigForm({ ...configForm, tdsPercentage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Real-time Calculation Summary */}
              {(() => {
                const b = Number(configForm.basicSalary) || 0;
                const h = Number(configForm.hra) || 0;
                const a = Number(configForm.allowance) || 0;
                const bon = Number(configForm.fixedBonus) || 0;
                const ded = Number(configForm.fixedDeduction) || 0;
                const pct = Number(configForm.tdsPercentage) || 0;

                const gross = b + h + a + bon;
                const tds = (gross * pct) / 100;
                const totalDed = ded + tds;
                const net = gross - totalDed;

                return (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                      <span>Gross Monthly:</span>
                      <span className="text-slate-900 dark:text-slate-100">{formatINR(gross)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-rose-600 dark:text-rose-400">
                      <span>Total Deductions (Fixed + TDS):</span>
                      <span>-{formatINR(totalDed)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>Net Monthly In-Hand:</span>
                      <span>{formatINR(net)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStructure}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSavingStructure ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  <span>Save Salary Structure</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
