import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Droplet,
  Hash,
  Building,
  User,
  Clock,
  RefreshCw,
  Building2,
  CheckCheck,
  AlertCircle,
  X,
  ShieldCheck
} from 'lucide-react';
import api from '../api/axios';
import { isFinanceOrExcludedUser } from '../utils/roleFilters';

const EmployeeRequests = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingState, setProcessingState] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedCards, setExpandedCards] = useState(new Set());

  // ================= APPROVAL MODAL & METADATA STATE =================
  const [approvingUser, setApprovingUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [successNotification, setSuccessNotification] = useState('');

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      let userList = [];
      try {
        const res = await api.get('/api/users/all');
        userList = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.data || [];
      } catch (apiErr) {
        // Fallback to direct fetch
        const response = await fetch('https://kt-backend-yzr4.onrender.com/api/users/all');
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        userList = Array.isArray(data) ? data : data?.users || data?.data || [];
      }
      setUsers(userList);
    } catch (err) {
      setError(err.message || 'Something went wrong while loading users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Company, Branch, Financial Year metadata
  const fetchApprovalMetadata = async () => {
    setLoadingMeta(true);
    setMetaError('');
    try {
      // 1. Fetch Companies: GET /api/company
      let companyList = [];
      try {
        const compRes = await api.get('/api/company');
        const cData = compRes.data?.data || compRes.data?.companies || compRes.data || [];
        if (Array.isArray(cData) && cData.length > 0) companyList = cData;
      } catch (cErr) {
        console.warn('GET /api/company failed, trying fallback /api/company/all:', cErr?.message);
        try {
          const compRes2 = await api.get('/api/company/all');
          const cData2 = compRes2.data?.data || compRes2.data?.companies || compRes2.data || [];
          if (Array.isArray(cData2)) companyList = cData2;
        } catch (e2) {}
      }

      // 2. Fetch Branches: GET /api/branch
      let branchList = [];
      try {
        const branchRes = await api.get('/api/branch');
        const bData = branchRes.data?.data || branchRes.data?.branches || branchRes.data || [];
        if (Array.isArray(bData) && bData.length > 0) branchList = bData;
      } catch (bErr) {
        console.warn('GET /api/branch failed, trying fallback /api/branch/all:', bErr?.message);
        try {
          const branchRes2 = await api.get('/api/branch/all');
          const bData2 = branchRes2.data?.data || branchRes2.data?.branches || branchRes2.data || [];
          if (Array.isArray(bData2)) branchList = bData2;
        } catch (e2) {}
      }

      // 3. Fetch Financial Year: GET /api/financial-year
      let fyList = [];
      try {
        const fyRes = await api.get('/api/financial-year');
        const fData = fyRes.data?.data || fyRes.data?.financialYears || fyRes.data?.years || fyRes.data || [];
        if (Array.isArray(fData) && fData.length > 0) fyList = fData;
      } catch (fErr) {
        console.warn('GET /api/financial-year failed, trying fallback /api/financial-year/all:', fErr?.message);
        try {
          const fyRes2 = await api.get('/api/financial-year/all');
          const fData2 = fyRes2.data?.data || fyRes2.data?.financialYears || fyRes2.data || [];
          if (Array.isArray(fData2)) fyList = fData2;
        } catch (e2) {}
      }

      setCompanies(companyList);
      setBranches(branchList);
      setFinancialYears(fyList);
      return { companyList, branchList, fyList };
    } catch (err) {
      console.error('Failed to load approval metadata:', err);
      setMetaError('Unable to load full company or branch records from server.');
      return { companyList: [], branchList: [], fyList: [] };
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchApprovalMetadata();
  }, []);

  const getUserIdentifier = (user, fallbackIndex) => {
    return user?._id || user?.id || user?.userId || user?.email || `user-${fallbackIndex}`;
  };

  // ================= ENTITY NAME RESOLVERS =================
  const getCompanyName = (compVal) => {
    if (!compVal) return null;
    const compId = typeof compVal === 'object' ? (compVal._id || compVal.id) : String(compVal);
    const found = companies.find(c => String(c._id || c.id) === compId);
    if (found) return found.name || found.companyName || found.title;
    if (typeof compVal === 'object' && (compVal.name || compVal.companyName)) return compVal.name || compVal.companyName;
    return compId;
  };

  const getBranchName = (branchVal) => {
    if (!branchVal) return null;
    const bId = typeof branchVal === 'object' ? (branchVal._id || branchVal.id) : String(branchVal);
    const found = branches.find(b => String(b._id || b.id) === bId);
    if (found) return found.name || found.branchName || found.title;
    if (typeof branchVal === 'object' && (branchVal.name || branchVal.branchName)) return branchVal.name || branchVal.branchName;
    return bId;
  };

  const getFinancialYearName = (fyVal) => {
    if (!fyVal) return null;
    const fId = typeof fyVal === 'object' ? (fyVal._id || fyVal.id) : String(fyVal);
    const found = financialYears.find(f => String(f._id || f.id) === fId);
    if (found) return found.year || found.financialYear || found.name;
    if (typeof fyVal === 'object' && (fyVal.year || fyVal.financialYear || fyVal.name)) return fyVal.year || fyVal.financialYear || fyVal.name;
    return fId;
  };

  // Fallback options if database collections are empty
  const getAvailableCompanies = () => {
    if (companies && companies.length > 0) return companies;
    return [
      { _id: '6ab4ba5e041b4cc1178235a1', name: 'Kevalon Technology Pvt. Ltd.' }
    ];
  };

  const getAvailableBranches = () => {
    if (branches && branches.length > 0) {
      if (selectedCompanyId) {
        const filtered = branches.filter(b => {
          const compRef = b.companyId || b.company;
          const compId = typeof compRef === 'object' ? (compRef?._id || compRef?.id) : compRef;
          return !compId || String(compId) === String(selectedCompanyId);
        });
        if (filtered.length > 0) return filtered;
      }
      return branches;
    }
    return [
      { _id: 'branch-head-office', name: 'Head Office (Main Branch)' },
      { _id: 'branch-development', name: 'Development Center' }
    ];
  };

  const getAvailableFinancialYears = () => {
    if (financialYears && financialYears.length > 0) return financialYears;
    const curYear = new Date().getFullYear();
    return [
      { _id: `fy-${curYear - 1}-${curYear}`, year: `${curYear - 1}-${curYear}`, name: `FY ${curYear - 1}-${curYear}` },
      { _id: `fy-${curYear}-${curYear + 1}`, year: `${curYear}-${curYear + 1}`, name: `FY ${curYear}-${curYear + 1} (Current)` },
      { _id: `fy-${curYear + 1}-${curYear + 2}`, year: `${curYear + 1}-${curYear + 2}`, name: `FY ${curYear + 1}-${curYear + 2}` }
    ];
  };

  // ================= OPEN APPROVAL MODAL =================
  const handleApproveClick = (user) => {
    setApprovingUser(user);
    setApprovalError('');

    const userCompId = typeof user?.companyId === 'object' ? user?.companyId?._id : user?.companyId;
    const userBranchId = typeof user?.branchId === 'object' ? user?.branchId?._id : user?.branchId;
    const userFyId = typeof user?.financialYearId === 'object' ? user?.financialYearId?._id : user?.financialYearId;

    const availCompanies = getAvailableCompanies();
    const defaultCompanyId = userCompId || (availCompanies.length > 0 ? (availCompanies[0]._id || availCompanies[0].id) : '');
    setSelectedCompanyId(defaultCompanyId);

    const availBranches = getAvailableBranches();
    setSelectedBranchId(userBranchId || (availBranches.length > 0 ? (availBranches[0]._id || availBranches[0].id) : ''));

    const availFys = getAvailableFinancialYears();
    setSelectedFinancialYearId(userFyId || (availFys.length > 0 ? (availFys[0]._id || availFys[0].id) : ''));

    if (companies.length === 0 || branches.length === 0 || financialYears.length === 0) {
      fetchApprovalMetadata();
    }
  };

  // ================= SUBMIT APPROVAL WITH COMPANY, BRANCH & FINANCIAL YEAR =================
  const submitApproval = async (e) => {
    if (e) e.preventDefault();
    if (!approvingUser) return;

    if (!selectedCompanyId) {
      setApprovalError('Please select a Company Name.');
      return;
    }
    if (!selectedBranchId) {
      setApprovalError('Please select a Branch.');
      return;
    }
    if (!selectedFinancialYearId) {
      setApprovalError('Please select a Financial Year.');
      return;
    }

    const userId = getUserIdentifier(approvingUser, 0);
    setSubmittingApproval(true);
    setApprovalError('');

    const payload = {
      id: userId,
      userId,
      _id: userId,
      email: approvingUser?.email,
      companyId: selectedCompanyId,
      company: selectedCompanyId,
      branchId: selectedBranchId,
      branch: selectedBranchId,
      financialYearId: selectedFinancialYearId,
      financialYear: selectedFinancialYearId,
      isApproved: true,
      approved: true,
      status: 'approved'
    };

    try {
      let isSuccess = false;

      // 1. Primary: PUT /api/users/approve using authenticated api instance
      try {
        const response = await api.put('/api/users/approve', payload);
        if (response.status >= 200 && response.status < 300) {
          isSuccess = true;
        }
      } catch (apiErr) {
        console.warn('api.put failed, trying fallback raw fetch with auth token:', apiErr?.message);
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const fetchRes = await fetch('https://kt-backend-yzr4.onrender.com/api/users/approve', {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });

        if (fetchRes.ok) {
          isSuccess = true;
        } else {
          const errData = await fetchRes.json().catch(() => ({}));
          throw new Error(errData.message || apiErr.response?.data?.message || 'Approval request failed');
        }
      }

      if (isSuccess) {
        // Update user locally
        setUsers((prevUsers) =>
          prevUsers.map((item, index) => {
            const itemId = getUserIdentifier(item, index);
            if (itemId !== userId) return item;
            return {
              ...item,
              isApproved: true,
              approved: true,
              status: 'approved',
              companyId: selectedCompanyId,
              branchId: selectedBranchId,
              financialYearId: selectedFinancialYearId
            };
          })
        );

        const approvedName = approvingUser?.name || approvingUser?.fullName || 'Employee';
        setSuccessNotification(`Approved ${approvedName} and linked to Company, Branch, & Financial Year!`);
        setTimeout(() => setSuccessNotification(''), 4500);
        setApprovingUser(null);
      }
    } catch (err) {
      console.error('Approval failed:', err);
      setApprovalError(err.message || 'Failed to complete approval. Please try again.');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // ================= REJECT / REVOKE ACTION =================
  const handleAction = async (user, action) => {
    const userId = getUserIdentifier(user, 0);
    const endpoint = action === 'approve'
      ? 'https://kt-backend-yzr4.onrender.com/api/users/approve'
      : 'https://kt-backend-yzr4.onrender.com/api/users/reject';

    setProcessingState({ userId, action });
    setError('');

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: userId,
          userId,
          _id: user?._id,
          email: user?.email
        }),
      });

      if (!response.ok) {
        throw new Error(`${action === 'approve' ? 'Approval' : 'Rejection'} failed`);
      }

      setUsers((prevUsers) =>
        prevUsers.map((item, index) => {
          const itemId = getUserIdentifier(item, index);
          if (itemId !== userId) return item;

          return {
            ...item,
            isApproved: action === 'approve',
            approved: action === 'approve',
            status: action === 'approve' ? 'approved' : 'rejected',
          };
        })
      );

      if (action === 'reject') {
        setSuccessNotification(`Rejected / revoked access for ${user?.name || 'user'}.`);
        setTimeout(() => setSuccessNotification(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setProcessingState(null);
    }
  };

  const toggleExpand = (userId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const getGradientColor = (name) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-rose-500',
      'from-green-500 to-emerald-600',
      'from-indigo-500 to-indigo-600',
      'from-orange-500 to-orange-600',
      'from-teal-500 to-teal-600',
      'from-red-500 to-red-600'
    ];
    const index = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  const getStatusBadge = (user) => {
    const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
    if (isApproved) {
      return {
        text: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        icon: CheckCircle
      };
    }
    return {
      text: 'Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      icon: Clock
    };
  };

  const filteredUsers = users
    .filter(user => {
      if (isFinanceOrExcludedUser(user)) return false;

      const searchMatch = user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user?.department?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!searchMatch) return false;

      const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
      if (filterStatus === 'approved') return isApproved;
      if (filterStatus === 'pending') return !isApproved;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const stats = {
    total: filteredUsers.length,
    pending: filteredUsers.filter(u => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return !isApproved;
    }).length,
    approved: filteredUsers.filter(u => {
      const isApproved = u?.isApproved === true || u?.approved === true || u?.status === 'approved';
      return isApproved;
    }).length
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Floating Success Toast */}
      {successNotification && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-medium bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-4">
          <CheckCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
            Employee Requests
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            Review, authorize, and assign company & branch details for new staff accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 px-3.5 py-2 shadow-xs border border-slate-200/80 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              {stats.total} Total
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 border border-amber-200/80 dark:border-amber-800/80 shadow-xs">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300">
              {stats.pending} Pending
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {stats.approved} Approved
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-700 dark:text-slate-200"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 px-3 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-700 dark:text-slate-200"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <button
              onClick={() => {
                fetchUsers();
                fetchApprovalMetadata();
              }}
              title="Refresh"
              className="h-10 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-16 sm:py-20">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-950/40 dark:border-red-800 p-3 sm:p-4 text-xs sm:text-sm text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="flex h-48 sm:h-64 flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 backdrop-blur-sm">
          <Users className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">No employee requests found</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Employee Cards Grid */}
      <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user, index) => {
          const userId = getUserIdentifier(user, index);
          const name = user?.name || user?.fullName || 'No Name';
          const email = user?.email || 'No Email';
          const role = user?.role || 'No Role';
          const department = user?.department || 'Not Specified';
          const phone = user?.phone || user?.phoneNumber || 'Not Specified';
          const isApproved = user?.isApproved === true || user?.approved === true || user?.status === 'approved';
          const isProcessingReject = processingState?.userId === userId && processingState?.action === 'reject';
          const isExpanded = expandedCards.has(userId);
          const StatusBadge = getStatusBadge(user).icon;

          const companyDisplay = getCompanyName(user?.companyId);
          const branchDisplay = getBranchName(user?.branchId);
          const fyDisplay = getFinancialYearName(user?.financialYearId);

          return (
            <div
              key={userId}
              className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5"
            >
              {/* Animated Gradient Border */}
              <div className="absolute inset-x-0 top-0 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Card Header */}
              <div className="p-3 sm:p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`relative h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${getGradientColor(name)} flex items-center justify-center text-base sm:text-lg font-bold text-white shadow-lg shrink-0`}>
                      {getInitials(name)}
                      {!isApproved && (
                        <div className="absolute -right-0.5 -top-0.5 sm:-right-1 sm:-top-1 h-2.5 w-2.5 sm:h-3 sm:w-3 animate-pulse rounded-full bg-amber-400 ring-1 sm:ring-2 ring-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium shrink-0 ${getStatusBadge(user).className}`}>
                    <StatusBadge className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span className="hidden xs:inline">{getStatusBadge(user).text}</span>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="rounded-lg bg-slate-50/50 dark:bg-slate-800/50 px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                      <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>Role</span>
                    </div>
                    <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate capitalize">{role}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50/50 dark:bg-slate-800/50 px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
                      <Building className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span>Department</span>
                    </div>
                    <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{department}</p>
                  </div>
                </div>

                {/* Company & Branch Chip if assigned */}
                {(companyDisplay || branchDisplay) && (
                  <div className="mt-2 p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-[11px] flex flex-col gap-1">
                    {companyDisplay && (
                      <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-medium truncate">
                        <Building2 size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">{companyDisplay}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 text-[10px]">
                      {branchDisplay && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate">{branchDisplay}</span>
                        </span>
                      )}
                      {fyDisplay && (
                        <span className="flex items-center gap-1 shrink-0 font-mono text-[9px] px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-indigo-200 dark:border-indigo-800">
                          {fyDisplay}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Expandable Details */}
                <div className="mt-2 sm:mt-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(userId)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-50/50 dark:bg-slate-800/50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 p-2 sm:p-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 truncate">{phone}</span>
                      </div>
                      {user?.address && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">{user.address}</span>
                        </div>
                      )}
                      {user?.dob && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">DOB: {user.dob}</span>
                        </div>
                      )}
                      {user?.bloodGroup && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Droplet className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">Blood: {user.bloodGroup}</span>
                        </div>
                      )}
                      {user?.gender && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">Gender: {user.gender}</span>
                        </div>
                      )}
                      {user?.designation && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">Designation: {user.designation}</span>
                        </div>
                      )}
                      {user?.uniqueID && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm">
                          <Hash className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300 truncate">ID: {user.uniqueID}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                          View Full Profile Modal &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 sm:mt-4 flex flex-col xs:flex-row gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveClick(user);
                    }}
                    disabled={isApproved}
                    className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isApproved
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isApproved ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                        Approved
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Approve...
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(user, 'reject');
                    }}
                    disabled={isProcessingReject}
                    className={`flex-1 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isProcessingReject
                        ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-slate-800 dark:text-slate-500'
                        : isApproved
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950/60 dark:text-orange-300 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isProcessingReject ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        Processing...
                      </span>
                    ) : isApproved ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                        Revoke
                      </span>
                    ) : (
                      'Reject'
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* APPROVE EMPLOYEE MODAL (COMPANY, BRANCH & FINANCIAL YEAR) */}
      {/* ==================================================== */}
      {approvingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !submittingApproval && setApprovingUser(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Approve Employee Access
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign Company, Branch & Financial Year
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                disabled={submittingApproval}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={submitApproval} className="p-5 sm:p-6 space-y-4 sm:space-y-5">
              {/* Target Employee Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradientColor(approvingUser?.name)} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}>
                    {getInitials(approvingUser?.name || approvingUser?.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {approvingUser?.name || approvingUser?.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {approvingUser?.email}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                    {approvingUser?.role || 'employee'}
                  </span>
                  {approvingUser?.department && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[120px]">
                      {approvingUser?.department}
                    </p>
                  )}
                </div>
              </div>

              {/* Error Alert */}
              {approvalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{approvalError}</span>
                </div>
              )}

              {/* Notice Banner & Metadata Status */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Building2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Select the official company entity, branch location, and current financial year to complete this employee&apos;s registration.
                  </span>
                </div>
                {loadingMeta && (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium shrink-0">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Syncing...</span>
                  </span>
                )}
              </div>

              {metaError && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                  Note: {metaError} Standard fallback entries are provided below.
                </p>
              )}

              {/* Field 1: Company Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  {loadingMeta && <Loader2 size={12} className="animate-spin text-slate-400" />}
                </div>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    disabled={submittingApproval}
                    className="w-full h-11 pl-10 pr-8 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100"
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {getAvailableCompanies().map((c) => {
                      const id = c._id || c.id;
                      const label = c.name || c.companyName || c.title || id;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Field 2: Branch */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Branch <span className="text-rose-500">*</span>
                  </label>
                  {loadingMeta && <Loader2 size={12} className="animate-spin text-slate-400" />}
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={submittingApproval}
                    className="w-full h-11 pl-10 pr-8 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100"
                    required
                  >
                    <option value="">-- Select Branch --</option>
                    {getAvailableBranches().map((b) => {
                      const id = b._id || b.id;
                      const label = b.name || b.branchName || b.title || id;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Field 3: Financial Year */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Financial Year <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedFinancialYearId}
                    onChange={(e) => setSelectedFinancialYearId(e.target.value)}
                    disabled={submittingApproval}
                    className="w-full h-11 pl-10 pr-8 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100 font-mono"
                    required
                  >
                    <option value="">-- Select Financial Year --</option>
                    {getAvailableFinancialYears().map((fy) => {
                      const id = fy._id || fy.id;
                      const label = fy.year || fy.financialYear || fy.name || id;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setApprovingUser(null)}
                  disabled={submittingApproval}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApproval}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submittingApproval ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting Approval...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm & Approve</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ENHANCED FULL DETAIL MODAL (MOBILE RESPONSIVE) */}
      {/* ==================================================== */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 mx-1 sm:mx-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient Header */}
            <div className={`bg-gradient-to-r ${getGradientColor(selectedUser?.name)} p-4 sm:p-6 relative`}>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full bg-white/20 p-1.5 sm:p-2 text-white transition hover:bg-white/30 cursor-pointer"
              >
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-gradient-to-br ${getGradientColor(selectedUser?.name)} flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl ring-2 sm:ring-4 ring-white/30`}>
                  {getInitials(selectedUser?.name || selectedUser?.fullName)}
                </div>
                <h2 className="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-white">
                  {selectedUser?.name || selectedUser?.fullName}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 break-all">{selectedUser?.email}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Organization Assignment */}
              {(selectedUser?.companyId || selectedUser?.branchId || selectedUser?.financialYearId) && (
                <div>
                  <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Organization Assignment
                  </h3>
                  <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                    {selectedUser?.companyId && (
                      <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100 dark:border-indigo-900/50">
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">Company</p>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {getCompanyName(selectedUser?.companyId)}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedUser?.branchId && (
                      <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100 dark:border-indigo-900/50">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">Branch</p>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {getBranchName(selectedUser?.branchId)}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedUser?.financialYearId && (
                      <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 px-2 sm:px-3 py-1.5 sm:py-2 border border-indigo-100 dark:border-indigo-900/50">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">Financial Year</p>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate font-mono">
                            {getFinancialYearName(selectedUser?.financialYearId)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Personal Info */}
              <div>
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Personal Information
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {[
                    { icon: Phone, label: 'Phone', value: selectedUser?.phoneNumber || selectedUser?.phone },
                    { icon: Calendar, label: 'Date of Birth', value: selectedUser?.dob },
                    { icon: User, label: 'Gender', value: selectedUser?.gender },
                    { icon: Droplet, label: 'Blood Group', value: selectedUser?.bloodGroup }
                  ].map((item, idx) => (
                    item.value && (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 px-2 sm:px-3 py-1.5 sm:py-2">
                        <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.value}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Professional Info */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
                <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Professional Details
                </h3>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {[
                    { icon: Building, label: 'Department', value: selectedUser?.department },
                    { icon: Briefcase, label: 'Designation', value: selectedUser?.designation },
                    { icon: Briefcase, label: 'Role', value: selectedUser?.role },
                    { icon: Hash, label: 'Unique ID', value: selectedUser?.uniqueID }
                  ].map((item, idx) => (
                    item.value && (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 px-2 sm:px-3 py-1.5 sm:py-2">
                        <item.icon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs text-slate-400">{item.label}</p>
                          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.value}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Address */}
              {selectedUser?.address && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
                  <h3 className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Address
                  </h3>
                  <div className="mt-2 sm:mt-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 p-2 sm:p-3 border border-blue-100 dark:border-slate-700">
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">{selectedUser.address}</p>
                  </div>
                </div>
              )}

              {/* Status & Quick Action */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4 space-y-2">
                <div className={`rounded-lg p-2 sm:p-3 ${
                  selectedUser?.isApproved
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                }`}>
                  <p className="text-xs sm:text-sm font-medium text-center">
                    Status: {selectedUser?.isApproved ? '✅ Approved' : '⏳ Pending Review'}
                  </p>
                </div>

                {!selectedUser?.isApproved && (
                  <button
                    type="button"
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleApproveClick(u);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ShieldCheck size={16} />
                    <span>Approve Employee Request</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;