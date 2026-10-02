import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, Clock, Calendar, User, Briefcase, AlertCircle, 
  CheckCircle2, Search, ChevronDown, ChevronUp, RefreshCw, 
  FileText, Sparkles, Layers, Hourglass, AlertTriangle, TrendingUp, 
  Plus, MessageSquare, Check, X, Shield, ArrowUpRight, BarChart2
} from 'lucide-react';
import api from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';

export const DailyFollowUpView = () => {
  const { user } = useApp();

  // Raw fetched data
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Expand State (All restrictions/filters removed as requested)
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [tlNotes, setTlNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kt_tl_followup_notes') || '{}');
    } catch {
      return {};
    }
  });
  const [activeNoteInput, setActiveNoteInput] = useState(null);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // Extract Team Lead ID from logged-in user
  const tlUserId = useMemo(() => {
    let id = user?._id || user?.id || user?.employeeId || user?.employee?._id || user?.userId;
    if (!id) {
      try {
        const stored = JSON.parse(localStorage.getItem('auth_user') || '{}');
        id = stored._id || stored.id || stored.userId || stored.employeeId;
      } catch {}
    }
    return id || '';
  }, [user]);

  // Fetch Live Data using GET /api/dailyUpdate/list?teamLeadId=<TL_USER_ID>
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setFetchError(null);

    try {
      const endpoint = tlUserId 
        ? `/api/dailyUpdate/list?teamLeadId=${tlUserId}` 
        : '/api/dailyUpdate/list';

      const [updatesRes, usersRes] = await Promise.allSettled([
        api.get(endpoint),
        api.get('/api/users/all')
      ]);

      // 1. Process Daily Updates List
      if (updatesRes.status === 'fulfilled') {
        const raw = updatesRes.value.data?.data || 
                    updatesRes.value.data?.updates || 
                    updatesRes.value.data?.dailyUpdates || 
                    updatesRes.value.data || [];
        
        let list = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (raw && Array.isArray(raw.reports)) {
          list = raw.reports;
        } else if (raw && Array.isArray(raw.data)) {
          list = raw.data;
        } else if (raw && typeof raw === 'object' && (raw.todaysWork || raw._id)) {
          list = [raw];
        }

        setDailyUpdates(list);
      } else {
        console.warn(`GET ${endpoint} failed:`, updatesRes.reason);
        setFetchError('Failed to fetch daily updates for team leader.');
      }

      // 2. Process Users List for Profile/Designation enrichment
      if (usersRes.status === 'fulfilled') {
        const uPayload = usersRes.value.data?.data || usersRes.value.data?.users || usersRes.value.data || [];
        setUsersList(Array.isArray(uPayload) ? uPayload : []);
      }
    } catch (err) {
      console.error('Error fetching team daily updates:', err);
      setFetchError('Could not connect to live backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tlUserId]);

  // Map users by ID for quick O(1) profile lookup
  const userMap = useMemo(() => {
    const map = {};
    usersList.forEach(u => {
      if (u._id) map[u._id] = u;
      if (u.id) map[u.id] = u;
      if (u.name) map[u.name.toLowerCase().trim()] = u;
    });
    return map;
  }, [usersList]);

  // Current logged in TL identifiers to exclude self-reports
  const currentTLIds = useMemo(() => {
    const ids = new Set();
    if (user?._id) ids.add(String(user._id));
    if (user?.id) ids.add(String(user.id));
    if (user?.userId) ids.add(String(user.userId));
    if (user?.employeeId) ids.add(String(user.employeeId));
    if (user?.employee?._id) ids.add(String(user.employee._id));
    if (tlUserId) ids.add(String(tlUserId));

    try {
      const stored = JSON.parse(localStorage.getItem('auth_user') || '{}');
      if (stored._id) ids.add(String(stored._id));
      if (stored.id) ids.add(String(stored.id));
      if (stored.userId) ids.add(String(stored.userId));
      if (stored.employeeId) ids.add(String(stored.employeeId));
    } catch {}

    return ids;
  }, [user, tlUserId]);

  const currentTLEmail = useMemo(() => {
    return (user?.email || (() => {
      try {
        return JSON.parse(localStorage.getItem('auth_user') || '{}').email;
      } catch { return ''; }
    })() || '').toLowerCase().trim();
  }, [user]);

  const currentTLName = useMemo(() => {
    return (user?.name || (() => {
      try {
        return JSON.parse(localStorage.getItem('auth_user') || '{}').name;
      } catch { return ''; }
    })() || '').toLowerCase().trim();
  }, [user]);

  // Helper: check if a report belongs to the current logged-in TL
  const isCurrentUserReport = (item) => {
    if (!item) return false;

    // 1. Match by Employee/User ID
    const empRaw = item.employeeId;
    const empId = typeof empRaw === 'object' 
      ? String(empRaw?._id || empRaw?.id || empRaw?.userId || '') 
      : String(empRaw || '');

    if (empId && currentTLIds.has(empId)) return true;
    if (item.userId && currentTLIds.has(String(item.userId))) return true;
    if (item.employee?._id && currentTLIds.has(String(item.employee._id))) return true;

    // 2. Match by Email
    const empEmail = (
      (typeof empRaw === 'object' ? empRaw?.email : '') || 
      item.email || 
      ''
    ).toLowerCase().trim();

    if (currentTLEmail && empEmail && currentTLEmail === empEmail) return true;

    // 3. Match by Name
    const empName = (
      (typeof empRaw === 'object' ? empRaw?.name : '') || 
      item.name || 
      ''
    ).toLowerCase().trim();

    if (currentTLName && empName && currentTLName === empName) return true;

    return false;
  };

  // Filter updates: strictly exclude current TL's own reports, and apply search query if provided
  const filteredUpdates = useMemo(() => {
    // 1. Exclude the logged-in TL's own daily reports
    const teamOnlyUpdates = dailyUpdates.filter(item => !isCurrentUserReport(item));

    if (!searchQuery.trim()) return teamOnlyUpdates;

    const q = searchQuery.toLowerCase().trim();
    return teamOnlyUpdates.filter(item => {
      const empName = (item.employeeId?.name || '').toLowerCase();
      const projectName = (item.projectId?.projectName || '').toLowerCase();
      const todaysWork = (item.todaysWork || '').toLowerCase();
      const issues = (item.issuesFaced || '').toLowerCase();
      const pending = (item.pendingWork || '').toLowerCase();

      return empName.includes(q) || projectName.includes(q) || todaysWork.includes(q) || issues.includes(q) || pending.includes(q);
    });
  }, [dailyUpdates, searchQuery, currentTLIds, currentTLEmail, currentTLName]);

  // Group daily updates by Person (Employee)
  const groupedByPerson = useMemo(() => {
    const groups = {};

    filteredUpdates.forEach(update => {
      // Extra safety check: skip if this is current TL
      if (isCurrentUserReport(update)) return;

      const empId = update.employeeId?._id || update.employeeId?.id || update.employeeId?.name || update.employeeId || 'unknown';
      const u = userMap[empId] || userMap[update.employeeId?.name?.toLowerCase()?.trim()];

      // Also verify person is not current TL
      if (u?._id && currentTLIds.has(String(u._id))) return;
      if (u?.email && currentTLEmail && u.email.toLowerCase().trim() === currentTLEmail) return;
      if (u?.name && currentTLName && u.name.toLowerCase().trim() === currentTLName) return;

      if (!groups[empId]) {
        groups[empId] = {
          employeeId: empId,
          name: update.employeeId?.name || u?.name || 'Unnamed Employee',
          role: update.employeeId?.role || u?.role || 'Employee',
          designation: u?.designation || update.employeeId?.designation || 'Team Member',
          avatar: u?.avatar || u?.profileImage || null,
          email: u?.email || '',
          totalHours: 0,
          reports: [],
          blockersCount: 0
        };
      }

      const hours = Number(update.hoursWorked) || 0;
      groups[empId].totalHours += hours;
      groups[empId].reports.push(update);

      if (
        update.issuesFaced && 
        update.issuesFaced.trim().length > 0 && 
        update.issuesFaced.trim().toLowerCase() !== 'none' && 
        update.issuesFaced.trim().toLowerCase() !== 'no'
      ) {
        groups[empId].blockersCount += 1;
      }
    });

    // Sort reports for each person by date descending
    Object.values(groups).forEach(person => {
      person.reports.sort((a, b) => new Date(b.reportDate || b.createdAt) - new Date(a.reportDate || a.createdAt));
    });

    // Return as array sorted by name
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredUpdates, userMap, currentTLIds, currentTLEmail, currentTLName]);

  // Overall statistics for top KPI cards
  const stats = useMemo(() => {
    const totalTeamMembers = groupedByPerson.length;
    const totalHours = groupedByPerson.reduce((acc, p) => acc + p.totalHours, 0);
    const totalReports = filteredUpdates.length;
    const totalBlockers = groupedByPerson.reduce((acc, p) => acc + p.blockersCount, 0);

    return { totalTeamMembers, totalHours, totalReports, totalBlockers };
  }, [groupedByPerson, filteredUpdates]);

  // Expand / collapse all employees toggle
  const toggleExpand = (empId) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };


  // TL Follow-Up Notes Handlers
  const handleSaveNote = (reportId) => {
    if (!currentNoteText.trim()) return;
    const updated = {
      ...tlNotes,
      [reportId]: {
        note: currentNoteText.trim(),
        savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        author: user?.name || 'Team Leader'
      }
    };
    setTlNotes(updated);
    try {
      localStorage.setItem('kt_tl_followup_notes', JSON.stringify(updated));
    } catch {}
    setActiveNoteInput(null);
    setCurrentNoteText('');
  };

  const handleDeleteNote = (reportId) => {
    const updated = { ...tlNotes };
    delete updated[reportId];
    setTlNotes(updated);
    try {
      localStorage.setItem('kt_tl_followup_notes', JSON.stringify(updated));
    } catch {}
  };

  // Avatar initial color generator
  const getAvatarColor = (name = '') => {
    const colors = [
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today at ${timeFormatted}`;
      if (isYesterday) return `Yesterday at ${timeFormatted}`;

      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` • ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm">
            <PhoneCall size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Daily Follow-Up</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review daily standup submissions, hours worked, task progress, and blockers by person
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee, task, project..."
              className="w-full pl-9 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="Refresh live daily reports"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Team Members</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <User size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalTeamMembers}</span>
            <span className="text-xs text-slate-500">reporting</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Hours Logged</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalHours}</span>
            <span className="text-xs text-slate-500">hrs recorded</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Reports</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalReports}</span>
            <span className="text-xs text-slate-500">submitted</span>
          </div>
        </div>

        <div className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-2xs ${
          stats.totalBlockers > 0 
            ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Blockers</span>
            <div className={`p-1.5 rounded-lg ${
              stats.totalBlockers > 0 
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' 
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.totalBlockers > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {stats.totalBlockers}
            </span>
            <span className="text-xs text-slate-500">need sync</span>
          </div>
        </div>
      </div>

      {/* 3. Loading & Error States */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-xs">
          <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Loading Team Daily Reports...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connecting to /api/dailyUpdate/list?teamLeadId={tlUserId || 'TL_ID'}</p>
        </div>
      ) : fetchError && groupedByPerson.length === 0 ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-6 text-center space-y-2">
          <AlertCircle size={28} className="text-rose-600 dark:text-rose-400 mx-auto" />
          <p className="text-sm font-bold text-rose-900 dark:text-rose-300">{fetchError}</p>
          <button
            onClick={() => loadData(true)}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : groupedByPerson.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Daily Updates Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No daily tasks have been recorded by your team members yet.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Refresh Data
            </button>
          </div>
        </div>
      ) : (
        /* 4. Team Daily Reports Grouped by Person */
        <div className="space-y-5">
          {groupedByPerson.map((person, idx) => {
            const isExpanded = !!expandedEmployees[person.employeeId]; // Collapsed by default

            return (
              <div
                key={person.employeeId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-all"
              >
                {/* Person Header Card */}
                <div 
                  onClick={() => toggleExpand(person.employeeId)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition select-none"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Employee Avatar */}
                    {person.avatar ? (
                      <img
                        src={person.avatar}
                        alt={person.name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                      />
                    ) : (
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-2xs ${getAvatarColor(person.name)}`}>
                        {person.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{person.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                          {person.designation}
                        </span>
                        {person.role.toLowerCase().includes('lead') && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/60 flex items-center gap-0.5">
                            <Shield size={10} /> Lead
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {person.reports.length} report{person.reports.length > 1 ? 's' : ''} logged
                      </p>
                    </div>
                  </div>

                  {/* Summary Pills & Expand Toggle */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5">
                        <Clock size={13} className="text-indigo-600" />
                        <span>{person.totalHours} hrs</span>
                      </div>

                      {person.blockersCount > 0 ? (
                        <div className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                          <span>{person.blockersCount} Blocker{person.blockersCount > 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>No Blockers</span>
                        </div>
                      )}
                    </div>

                    <div className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Daily Reports List for this Employee */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:p-5 space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calendar size={13} /> Daily Updates & Task Timeline
                    </h4>

                    <div className="space-y-3.5">
                      {person.reports.map((report) => {
                        const noteData = tlNotes[report._id];
                        const isAddingNote = activeNoteInput === report._id;
                        const hasBlocker = report.issuesFaced && 
                                          report.issuesFaced.trim().length > 0 && 
                                          report.issuesFaced.trim().toLowerCase() !== 'none' && 
                                          report.issuesFaced.trim().toLowerCase() !== 'no';

                        return (
                          <div
                            key={report._id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                          >
                            {/* Report Meta Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                  <Calendar size={12} className="text-indigo-600" />
                                  {formatDate(report.reportDate || report.createdAt)}
                                </span>

                                {report.projectId?.projectName && (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Briefcase size={11} className="text-slate-500" />
                                    Project: <strong>{report.projectId.projectName}</strong>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                                  {report.hoursWorked || 0} Hours Logged
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  report.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                  report.status === 'Pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {report.status || 'Submitted'}
                                </span>
                              </div>
                            </div>

                            {/* Work Content Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* Today's Work */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                  <CheckCircle2 size={12} className="text-emerald-500" /> Completed Work
                                </p>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                                  {report.todaysWork || 'No details provided'}
                                </p>
                              </div>

                              {/* Pending Work */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                  <Hourglass size={12} className="text-amber-500" /> In Progress / Pending
                                </p>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                                  {report.pendingWork || 'None'}
                                </p>
                              </div>

                              {/* Next Day Plan */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                  <TrendingUp size={12} className="text-indigo-600" /> Next Day Plan
                                </p>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                                  {report.tomorrowPlan || 'None'}
                                </p>
                              </div>
                            </div>

                            {/* Blockers & Issues (if reported) */}
                            {hasBlocker && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                                  <span>Blocker / Issue Reported</span>
                                </div>
                                <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed pl-5 font-medium">
                                  {report.issuesFaced}
                                </p>
                              </div>
                            )}

                            {/* Remarks */}
                            {report.remarks && report.remarks.trim().length > 0 && (
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50/80 dark:bg-slate-800/40 p-2 rounded border border-slate-100 dark:border-slate-800">
                                <strong>Remarks:</strong> {report.remarks}
                              </div>
                            )}

                            {/* Task References Breakdown */}
                            {Array.isArray(report.taskReferences) && report.taskReferences.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <Layers size={11} /> Associated Tasks ({report.taskReferences.length})
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {report.taskReferences.map((tRef, tIdx) => (
                                    <div
                                      key={tRef._id || tIdx}
                                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                                          {tRef.taskTitle || 'Untitled Task'}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                          {tRef.progress || 0}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div
                                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                          style={{ width: `${Math.min(100, Math.max(0, tRef.progress || 0))}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                                        <span className="capitalize">{tRef.status?.replace('_', ' ') || 'In Progress'}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* TL Follow-Up Note & Action Area */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              {noteData ? (
                                <div className="flex-1 p-2 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-lg flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                      <MessageSquare size={11} />
                                      <span>TL Note by {noteData.author} ({noteData.savedAt}):</span>
                                    </div>
                                    <p className="text-slate-800 dark:text-slate-200 text-xs font-medium pl-4">
                                      {noteData.note}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteNote(report._id)}
                                    className="text-slate-400 hover:text-rose-500 text-xs p-1 cursor-pointer"
                                    title="Delete note"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : isAddingNote ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={currentNoteText}
                                    onChange={(e) => setCurrentNoteText(e.target.value)}
                                    placeholder="Add standup note or action item for this report..."
                                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveNote(report._id);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveNote(report._id)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveNoteInput(null);
                                      setCurrentNoteText('');
                                    }}
                                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActiveNoteInput(report._id);
                                    setCurrentNoteText('');
                                  }}
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={13} /> Add Follow-Up Note
                                </button>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
