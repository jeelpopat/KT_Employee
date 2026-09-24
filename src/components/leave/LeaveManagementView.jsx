import React, { useState, useEffect } from 'react';
import { 
  Plus, CheckCircle2, Clock, XCircle, 
  Paperclip, Search, Info, Calendar, FileText, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import api from '../../api/axios.js'; 
import { useApp } from '../../context/AppContext.jsx';

export const LeaveManagementView = () => {
  const { user, userRole } = useApp();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({ 
    totalLeaves: 12, usedLeaves: 0, remainingLeaves: 12, pendingRequests: 0 
  });
  const [holidaysList, setHolidaysList] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  
  // Form States mapped strictly to Mongoose Leave Schema:
  // enum: ["casual", "sick", "paid", "unpaid", "half_day"]
  const [leaveType, setLeaveType] = useState('paid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState('first-half'); // enum: ["first-half", "second-half", null]
  const [attachmentName, setAttachmentName] = useState('');
  
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Helper for local date strings in YYYY-MM-DD
  const getLocalDateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(0);
  const advance2DaysStr = getLocalDateString(2);

  // Determine minimum allowed date: Sick leave can be applied starting TODAY.
  // Other leaves require 2 days advance notice according to company policy.
  const minAllowedDate = leaveType === 'sick' ? todayStr : advance2DaysStr;

  // Resolve applicant role strictly matching schema enum: ["employee", "intern", "team lead", "hr", "admin"]
  const resolveApplicantRole = () => {
    const rawRole = (
      userRole ||
      user?.role?.roleName ||
      user?.role?.name ||
      user?.role ||
      user?.applicantRole ||
      ''
    ).toString().toLowerCase().trim();

    if (rawRole.includes('intern')) return 'intern';
    if (rawRole.includes('lead') || rawRole.includes('tl') || rawRole.includes('leader')) return 'team lead';
    if (rawRole.includes('hr')) return 'hr';
    if (rawRole.includes('admin')) return 'admin';
    return 'employee';
  };

  // Extract all IDs, emails, and names identifying the logged-in user
  const getLoggedInUserIdentifiers = () => {
    let storedUser = null;
    try {
      const s = localStorage.getItem('auth_user');
      if (s) storedUser = JSON.parse(s);
    } catch (e) {}

    let tokenPayload = null;
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          tokenPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        }
      }
    } catch (e) {}

    const ids = new Set();
    const emails = new Set();
    const names = new Set();

    const addId = (id) => {
      if (!id) return;
      if (typeof id === 'object') {
        if (id._id) addId(id._id);
        if (id.id) addId(id.id);
        return;
      }
      const s = String(id).trim().toLowerCase();
      if (s && s !== 'null' && s !== 'undefined') ids.add(s);
    };

    const addEmail = (email) => {
      if (typeof email === 'string' && email.trim() && email.includes('@')) {
        emails.add(email.trim().toLowerCase());
      }
    };

    const addName = (name) => {
      if (typeof name === 'string') {
        const cleaned = name.trim().toLowerCase();
        if (cleaned && !['employee', 'team member', 'user', 'admin', 'hr', 'intern', 'team lead', 'team leader'].includes(cleaned)) {
          names.add(cleaned);
        }
      }
    };

    [user, storedUser].forEach(u => {
      if (!u) return;
      addId(u._id);
      addId(u.id);
      addId(u.userId);
      addId(u.employeeId);
      addId(u.empId);
      if (u.user) {
        addId(u.user._id);
        addId(u.user.id);
        addId(u.user);
      }
      if (u.employee) {
        addId(u.employee._id);
        addId(u.employee.id);
        addId(u.employee);
        addEmail(u.employee.email);
        addName(u.employee.name);
      }
      if (u.profile) {
        addId(u.profile._id);
        addId(u.profile.id);
        addEmail(u.profile.email);
        addName(u.profile.name);
      }
      addEmail(u.email);
      addName(u.name);
      addName(u.fullName);
      if (u.firstName) {
        addName(`${u.firstName} ${u.lastName || ''}`);
      }
    });

    if (tokenPayload) {
      addId(tokenPayload._id);
      addId(tokenPayload.id);
      addId(tokenPayload.userId);
      addId(tokenPayload.sub);
      addEmail(tokenPayload.email);
      addName(tokenPayload.name);
    }

    return { ids, emails, names };
  };

  // Strictly check if a leave request belongs to the logged-in user
  const isMyLeave = (leave, myIdent = getLoggedInUserIdentifiers(), usersMap = {}) => {
    if (!leave) return false;
    if (String(leave._id || '').startsWith('temp-')) return true;

    const leaveEmp = (typeof leave.employeeId === 'object' && leave.employeeId !== null) ? leave.employeeId :
                     (typeof leave.employee === 'object' && leave.employee !== null) ? leave.employee :
                     (typeof leave.user === 'object' && leave.user !== null) ? leave.user : null;

    const leaveIds = [
      typeof leave.employeeId === 'string' ? leave.employeeId : null,
      typeof leave.employee === 'string' ? leave.employee : null,
      typeof leave.user === 'string' ? leave.user : null,
      typeof leave.applicantId === 'string' ? leave.applicantId : null,
      typeof leave.applicantID === 'string' ? leave.applicantID : null,
      typeof leave.userId === 'string' ? leave.userId : null,
      leaveEmp?._id ? String(leaveEmp._id) : null,
      leaveEmp?.id ? String(leaveEmp.id) : null,
      leave.appliedBy ? String(leave.appliedBy) : null
    ].filter(Boolean).map(id => id.toLowerCase().trim());

    for (const id of leaveIds) {
      if (myIdent.ids.has(id)) return true;
    }

    const leaveEmails = [
      leave.applicantEmail,
      leave.employeeEmail,
      leave.email,
      leaveEmp?.email
    ].filter(Boolean).map(e => e.toLowerCase().trim());

    for (const email of leaveEmails) {
      if (myIdent.emails.has(email)) return true;
    }

    const leaveNames = [
      leave.applicantName,
      leave.employeeName,
      leave.name,
      leaveEmp?.name,
      leaveEmp?.fullName,
      leaveEmp?.firstName ? `${leaveEmp.firstName} ${leaveEmp.lastName || ''}`.trim() : null
    ].filter(Boolean).map(n => n.toLowerCase().trim()).filter(n => !['employee', 'team member', 'user'].includes(n));

    for (const name of leaveNames) {
      if (myIdent.names.has(name)) return true;
    }

    // Resolve through usersMap if available
    for (const id of leaveIds) {
      const mapped = usersMap[id];
      if (mapped) {
        const mEmail = (mapped.email || '').toLowerCase().trim();
        const mName = (mapped.name || mapped.fullName || `${mapped.firstName || ''} ${mapped.lastName || ''}`).toLowerCase().trim();
        if (mEmail && myIdent.emails.has(mEmail)) return true;
        if (mName && myIdent.names.has(mName)) return true;
        if (mapped._id && myIdent.ids.has(String(mapped._id).toLowerCase())) return true;
        if (mapped.id && myIdent.ids.has(String(mapped.id).toLowerCase())) return true;
      }
    }

    return false;
  };

  // Fetch Live Leave & Holiday Data with resilient fallback extraction
  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setIsRefreshing(true);
    try {
      // 0. Fetch Users directory for seamless employee ID mapping
      const usersMap = {};
      const myIdent = getLoggedInUserIdentifiers();
      try {
        const uRes = await api.get('/api/users/all');
        const rawUsers = uRes.data?.users || uRes.data?.data || (Array.isArray(uRes.data) ? uRes.data : []);
        if (Array.isArray(rawUsers)) {
          rawUsers.forEach(u => {
            if (u._id) usersMap[String(u._id).toLowerCase()] = u;
            if (u.id) usersMap[String(u.id).toLowerCase()] = u;
            if (u.employeeId) usersMap[String(u.employeeId).toLowerCase()] = u;
            if (u.email) usersMap[u.email.toLowerCase().trim()] = u;

            // If this user record in the directory matches our identity, register all its server IDs to myIdent
            const uEmail = (u.email || '').toLowerCase().trim();
            const uName = (u.name || u.fullName || '').toLowerCase().trim();
            const uId = String(u._id || u.id || '').toLowerCase();
            if (
              (uEmail && myIdent.emails.has(uEmail)) ||
              (uName && myIdent.names.has(uName)) ||
              (uId && myIdent.ids.has(uId))
            ) {
              if (u._id) myIdent.ids.add(String(u._id).toLowerCase());
              if (u.id) myIdent.ids.add(String(u.id).toLowerCase());
              if (u.employeeId) myIdent.ids.add(String(u.employeeId).toLowerCase());
              if (u.email) myIdent.emails.add(u.email.toLowerCase().trim());
              if (u.name) myIdent.names.add(u.name.toLowerCase().trim());
            }
          });
        }
      } catch (uErr) {
        console.warn('Users directory fetch notice:', uErr.message);
      }

      // 1. Fetch Leave Overview
      let overviewRes = null;
      try {
        overviewRes = await api.get('/api/employee-panel/leaves/overview');
      } catch (e) {
        console.warn('Overview fetch notice:', e.message);
      }

      const raw = overviewRes?.data?.data || overviewRes?.data || {};
      let history = raw.history || raw.leaves || (Array.isArray(raw) ? raw : null) || overviewRes?.data?.history || overviewRes?.data?.leaves || null;
      let summary = raw.summary || raw.balance || overviewRes?.data?.summary || overviewRes?.data?.balance || null;

      // If history is not provided by overview endpoint, try dedicated history endpoints
      if (!history || !Array.isArray(history) || history.length === 0) {
        try {
          const histRes = await api.get('/api/employee-panel/leaves/history');
          const hRaw = histRes.data?.data || histRes.data || {};
          const hList = hRaw.history || hRaw.leaves || (Array.isArray(hRaw) ? hRaw : null);
          if (Array.isArray(hList) && hList.length > 0) {
            history = hList;
          }
        } catch (hErr) {
          try {
            const allRes = await api.get('/api/leave/all');
            const aRaw = allRes.data?.data || allRes.data || {};
            const aList = aRaw.leaves || aRaw.history || (Array.isArray(aRaw) ? aRaw : null);
            if (Array.isArray(aList) && aList.length > 0) {
              history = aList;
            }
          } catch (aErr) {
            // secondary fallback completed
          }
        }
      }

      // Filter history to ONLY show the logged-in user's leaves
      const myLeavesOnly = Array.isArray(history)
        ? history.filter(l => isMyLeave(l, myIdent, usersMap))
        : [];

      // Calculate personal leave metrics strictly based on my leaves
      const totalQuota = (summary?.totalLeaves !== undefined) ? summary.totalLeaves : 12;
      const myApprovedLeaves = myLeavesOnly.filter(l => String(l.status || '').toLowerCase() === 'approved');
      const myUsedDays = myApprovedLeaves.reduce((acc, curr) => acc + (Number(curr.totalDays) || 1), 0);
      const myPendingCount = myLeavesOnly.filter(l => String(l.status || '').toLowerCase().includes('pending')).length;
      const myRemainingDays = Math.max(0, totalQuota - myUsedDays);

      setLeaveBalance({
        totalLeaves: totalQuota,
        usedLeaves: (summary?.usedLeaves !== undefined && summary?.usedLeaves <= myUsedDays) ? summary.usedLeaves : myUsedDays,
        remainingLeaves: (summary?.remainingLeaves !== undefined) ? summary.remainingLeaves : myRemainingDays,
        pendingRequests: (summary?.pendingRequests !== undefined && summary?.pendingRequests <= myPendingCount) ? summary.pendingRequests : myPendingCount
      });

      setLeaveRequests(myLeavesOnly);

      // 2. Fetch Holidays List to calculate working days
      const year = new Date().getFullYear();
      try {
        const holidayRes = await api.get(`/api/holiday/all?year=${year}`);
        const hList = holidayRes.data?.holidays || holidayRes.data?.data || holidayRes.data;
        if (Array.isArray(hList)) {
          const dates = hList.map(h => (h.holidayDate || h.date || '').split('T')[0]).filter(Boolean);
          setHolidaysList(dates);
        }
      } catch (holErr) {
        console.warn('Holiday fetch notice:', holErr.message);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Force endDate to equal startDate if Half Day is selected
  useEffect(() => {
    if ((isHalfDay || leaveType === 'half_day') && startDate) {
      setEndDate(startDate);
    }
  }, [isHalfDay, leaveType, startDate]);

  // Safely calculate actual working days excluding Sundays and Holidays
  const getCalculatedDays = () => {
    if (isHalfDay || leaveType === 'half_day') return 0.5;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);
    
    while (curr <= end) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const isSunday = curr.getDay() === 0;

      // Only count if it's NOT a Sunday AND NOT in the backend holiday list
      if (!isSunday && !holidaysList.includes(dateStr)) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    return count;
  };

  const calculatedDays = getCalculatedDays();

  const filteredLeaves = leaveRequests.filter(l => {
    if (!isMyLeave(l)) return false;
    const matchesSearch = (l.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (l.leaveType || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (l.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = () => {
    const defaultDate = leaveType === 'sick' ? todayStr : advance2DaysStr;
    setStartDate(defaultDate);
    setEndDate(defaultDate);
    setFormError('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    const effectiveMinDate = leaveType === 'sick' ? todayStr : advance2DaysStr;

    if (startDate < effectiveMinDate) {
      if (leaveType === 'sick') {
        setFormError('Policy Notice: Sick leave cannot be applied for past dates.');
      } else {
        setFormError('Policy Notice: Leave requests must be submitted at least 2 days in advance (except Sick Leave).');
      }
      return;
    }

    if (calculatedDays === 0) {
      setFormError('Invalid Range: The selected dates fall entirely on recognized holidays or Sundays.');
      return;
    }

    setIsSubmitting(true);

    const isHalfDayActive = Boolean(isHalfDay || leaveType === 'half_day');
    const finalHalfDayType = isHalfDayActive ? (halfDayType || 'first-half') : null;
    const finalTotalDays = isHalfDayActive ? 0.5 : Number(calculatedDays);
    const finalEndDate = isHalfDayActive ? startDate : endDate;

    try {
      // Sending exact payload mapped strictly to Mongoose Leave Schema
      const payload = {
        applicantRole: resolveApplicantRole(),
        leaveType: leaveType,
        startDate: startDate,
        endDate: finalEndDate,
        isHalfDay: isHalfDayActive,
        halfDayType: finalHalfDayType,
        totalDays: finalTotalDays,
        reason: reason.trim(),
        attachment: attachmentName ? attachmentName.trim() : ''
      };

      let response;
      try {
        response = await api.post('/api/employee-panel/leaves/apply', payload);
      } catch (postErr) {
        if (postErr.response?.status === 404) {
          response = await api.post('/api/leave/apply', payload);
        } else {
          throw postErr;
        }
      }

      if (response?.data) {
        setSuccessMsg('Leave request submitted successfully.');

        // Optimistically prepend to leaveRequests so user immediately sees past/current leave data updated
        const createdLeave = response.data.leave || response.data.data?.leave || response.data.data || {
          _id: `temp-${Date.now()}`,
          applicantId: user?._id || user?.id,
          employeeId: user?.employeeId || user?.employee?._id || user?._id,
          applicantEmail: user?.email,
          applicantName: user?.name,
          leaveType: payload.leaveType,
          startDate: payload.startDate,
          endDate: payload.endDate,
          totalDays: payload.totalDays,
          isHalfDay: payload.isHalfDay,
          halfDayType: payload.halfDayType,
          reason: payload.reason,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        setLeaveRequests(prev => [createdLeave, ...prev]);

        // Refresh background data and close modal
        fetchData(false);

        setTimeout(() => {
          setIsModalOpen(false);
          setReason('');
          setAttachmentName('');
          setIsHalfDay(false);
          setSuccessMsg('');
        }, 1500);
      }
    } catch (error) {
      console.error('Error applying for leave:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to submit leave application. Please try again.';
      setFormError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dateString.split('T')[0];
  };

  // Human-readable leave category badge
  const renderLeaveCategoryBadge = (type, isHalf, halfType) => {
    const norm = String(type || '').toLowerCase();
    const isPaid = norm === 'paid';
    const isSick = norm === 'sick';

    let displayTitle = 'Casual Leave';
    if (norm === 'paid') displayTitle = 'Paid Leave';
    else if (norm === 'sick') displayTitle = 'Sick Leave';
    else if (norm === 'unpaid') displayTitle = 'Unpaid Leave';
    else if (norm === 'half_day') displayTitle = 'Half Day';

    return (
      <div>
        <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase block text-xs sm:text-sm">
          {displayTitle}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
            isPaid 
              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' 
              : isSick
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          }`}>
            {isPaid ? 'Paid' : 'Unpaid'}
          </span>
          {isHalf && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
              {halfType === 'first-half' ? '1st Half' : halfType === 'second-half' ? '2nd Half' : 'Half Day'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Status badge matching Mongoose enum: ["pending", "pending_hr", "pending_admin", "approved", "rejected"]
  const renderStatusBadge = (status) => {
    const statusStr = String(status || 'pending').toLowerCase();
    if (statusStr === 'approved') {
      return (
        <span className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
          <CheckCircle2 size={14} /> Approved
        </span>
      );
    }
    if (statusStr === 'rejected') {
      return (
        <span className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
          <XCircle size={14} /> Rejected
        </span>
      );
    }
    if (statusStr === 'pending_hr') {
      return (
        <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
          <Clock size={14} /> Pending HR
        </span>
      );
    }
    if (statusStr === 'pending_admin') {
      return (
        <span className="px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
          <Clock size={14} /> Pending Admin
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-xs font-semibold flex items-center gap-1.5 w-fit">
        <Clock size={14} /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">

      {/* Action buttons aligned to the top-right */}
      <div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Leave Management</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Apply for leave, track requests, and check quotas</p>
            </div>
              
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
              >
                <FileText size={15} />
                Leave Policy
              </button>

              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={15} />
                Apply Leave
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Balance Quota Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Paid Quota', value: `${leaveBalance.totalLeaves || 12} Days`, icon: Calendar, accent: 'border-l-blue-500' },
          { label: 'Leaves Used', value: `${leaveBalance.usedLeaves || 0} Days`, icon: Clock, accent: 'border-l-amber-500' },
          { label: 'Paid Balance', value: `${leaveBalance.remainingLeaves || 12} Days`, icon: CheckCircle2, accent: 'border-l-green-500' },
          { label: 'Pending', value: `${leaveBalance.pendingRequests || 0} Req.`, icon: Clock, accent: 'border-l-slate-400' }
        ].map((item, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm`}>
            <div className="flex justify-between items-start">
              <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
              <p className="px-2 text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Leave History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden transition-colors shadow-sm">
        
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Leave History</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track and view your past and active leave applications</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search reason or type..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="pending_hr">Pending HR</option>
              <option value="pending_admin">Pending Admin</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              type="button"
              onClick={() => fetchData(false)}
              disabled={isRefreshing}
              title="Refresh Leave History"
              className="p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-3">
               <Loader2 size={24} className="animate-spin text-blue-500" />
               <span className="text-sm text-slate-500 font-medium">Loading history...</span>
             </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Leave Category</th>
                  <th className="px-5 py-4">Duration & Dates</th>
                  <th className="px-5 py-4 w-1/3">Reason & Remarks</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">No leave requests found.</td>
                  </tr>
                ) : (
                  filteredLeaves.map((l, index) => {
                    const activeRemarks = l.adminRemark || l.hrRemark || l.teamLeadRemark || l.remark;
                    return (
                      <tr key={l._id || index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-5 py-4">
                          {renderLeaveCategoryBadge(l.leaveType, l.isHalfDay, l.halfDayType)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {formatDate(l.startDate)} {l.startDate !== l.endDate ? `to ${formatDate(l.endDate)}` : ''}
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 block">
                            {l.totalDays} {l.totalDays === 1 || l.totalDays === 0.5 ? 'Day' : 'Days'} {l.isHalfDay ? `(${l.halfDayType === 'first-half' ? '1st Half' : l.halfDayType === 'second-half' ? '2nd Half' : 'Half Day'})` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 max-w-xs">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={l.reason}>
                            {l.reason || 'No reason provided'}
                          </p>
                          {activeRemarks && (
                            <div className="mt-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/40">
                              <span className="font-semibold">Remark:</span> {activeRemarks}
                            </div>
                          )}
                          {l.attachment && (
                            <a 
                              href={l.attachment} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <Paperclip size={12} /> View Attachment
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {renderStatusBadge(l.status)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Policy Modal */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 dark:bg-black/60 transition-opacity flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText size={20} className="text-slate-500" />
                  Leave Policies
                </h3>
              </div>
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/50 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-500 rounded-md">
                    <Calendar size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Paid Leave (PL)</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Paid leaves are meant for planned vacations, personal time, or extended rest.
                </p>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3">Policy Rules:</h5>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 marker:text-purple-500">
                  <li>Employees earn <strong className="text-slate-800 dark:text-slate-200">12 days</strong> of paid leave per year (1 per month).</li>
                  <li>Paid leaves can be carried forward up to a maximum of 30 days.</li>
                  <li>Prior approval is required at least <strong>2 days in advance</strong>.</li>
                </ul>
              </div>

              <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/50 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-md">
                    <Info size={20} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sick Leave & Casual Leave</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Sick leave is granted for unanticipated health emergencies and can be applied on the <strong>same day</strong> without advance request.
                </p>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3">Policy Rules:</h5>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 marker:text-amber-500">
                  <li><strong>Same-day application:</strong> Sick leave can be applied starting today without the 2-day advance notice restriction.</li>
                  <li>Medical documents or doctor prescriptions can be attached for leaves exceeding 2 consecutive days.</li>
                  <li>Casual and unpaid leaves require 2 days advance notice.</li>
                </ul>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-slate-300 text-white dark:text-slate-900 font-medium rounded-md transition-colors cursor-pointer"
              >
                Close Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 dark:bg-black/60 transition-opacity flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            
            <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Apply For Leave</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Applying as <span className="font-semibold uppercase text-blue-600 dark:text-blue-400">{resolveApplicantRole()}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 text-sm">
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md text-red-700 dark:text-red-400 font-medium text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-md text-green-700 dark:text-green-400 font-medium text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> {successMsg}
                </div>
              )}

              {/* Leave Category & Duration Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Leave Category</label>
                  <select 
                    value={leaveType}
                    onChange={e => {
                      const newType = e.target.value;
                      setLeaveType(newType);
                      if (newType === 'half_day') {
                        setIsHalfDay(true);
                      }
                      const newMin = newType === 'sick' ? todayStr : advance2DaysStr;
                      if (startDate < newMin) {
                        setStartDate(newMin);
                        setEndDate(newMin);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="paid">Paid Leave (PL)</option>
                    <option value="sick">Sick Leave (Same Day Allowed)</option>
                    <option value="casual">Casual Leave (Unpaid)</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="half_day">Half Day Leave</option>
                  </select>
                  <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <Info size={12} className="text-blue-500 shrink-0" />
                    {leaveType === 'sick' ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Today ({todayStr}) allowed without 2-day advance
                      </span>
                    ) : (
                      <span>Requires 2 days advance notice (Earliest: {advance2DaysStr})</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Duration</label>
                  <div className="flex items-center gap-4 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duration" 
                        checked={!isHalfDay && leaveType !== 'half_day'}
                        onChange={() => {
                          setIsHalfDay(false);
                          if (leaveType === 'half_day') setLeaveType('paid');
                        }}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Full Day</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duration" 
                        checked={isHalfDay || leaveType === 'half_day'}
                        onChange={() => setIsHalfDay(true)}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Half Day</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Half Day Type Sub-selector if Half Day active */}
              {(isHalfDay || leaveType === 'half_day') && (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/40">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-2">
                    Shift Selection (Half Day)
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                      <input 
                        type="radio" 
                        name="halfDayType" 
                        value="first-half"
                        checked={halfDayType === 'first-half'}
                        onChange={() => setHalfDayType('first-half')}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                      First Half (Morning)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                      <input 
                        type="radio" 
                        name="halfDayType" 
                        value="second-half"
                        checked={halfDayType === 'second-half'}
                        onChange={() => setHalfDayType('second-half')}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                      Second Half (Afternoon)
                    </label>
                  </div>
                </div>
              )}

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Start Date</label>
                  <input 
                    type="date" 
                    min={minAllowedDate}
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      if (isHalfDay || leaveType === 'half_day' || endDate < e.target.value) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">End Date</label>
                  <input 
                    type="date" 
                    min={startDate || minAllowedDate}
                    value={(isHalfDay || leaveType === 'half_day') ? startDate : endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={isHalfDay || leaveType === 'half_day'}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>
              
              {/* Dynamic Working Days Banner */}
              {startDate && endDate && (
                <div className={`p-2.5 rounded-md border text-sm font-semibold flex items-center justify-between ${
                  calculatedDays === 0 
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' 
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50'
                }`}>
                  <span>Working Days Requested:</span>
                  <span className="font-mono text-base">
                    {calculatedDays} {calculatedDays === 1 || calculatedDays === 0.5 ? 'Day' : 'Days'} {(isHalfDay || leaveType === 'half_day') ? `(${halfDayType === 'first-half' ? 'First Half' : 'Second Half'})` : ''}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Reason</label>
                <textarea 
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Provide brief explanation for leave..."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">Document Link (Optional)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Provide a link to medical doc / certificate..."
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || calculatedDays === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Submit Application
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};