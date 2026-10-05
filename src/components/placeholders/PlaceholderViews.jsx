import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, TrendingUp, Briefcase, Users, BookOpen, GraduationCap,
  FileBadge, PhoneCall, ListTodo, CalendarX, ClipboardCheck,
  BarChart, Download, Search, CheckCircle2, Clock, Eye, AlertCircle,
  ExternalLink, FileText, ChevronRight, Filter, Plus, Check, X,
  Shield, Award, BookCheck, Sparkles, Building2, UserCheck, Loader2,
  Trash2, Edit3, MessageSquare, Calendar, User, CheckSquare,
  AlertTriangle, RefreshCw, Layers, CheckCircle, XCircle, CheckCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';
import { ProjectView } from '../projects/ProjectView.jsx';
import {
  getLoggedInUserIdentifiers,
  fetchTeamsList,
  isTeamOwnedByLead,
  extractAssignedTeamEmployees,
  isLeaveOfAssignedTeam,
} from '../../utils/teamLeadUtils.js';

export { ProjectView };

// 1. SALARY VIEW (Live API with GET /api/payroll/salary/user/:userId and GET /api/payroll/payslips)
export { SalaryView } from '../salary/SalaryView.jsx';


// 2. PERFORMANCE VIEW - Live API integration using GET /api/performance/:id (My Performance Only)
export const PerformanceView = () => {
  const { user } = useApp();
  const [performanceData, setPerformanceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch logged-in user's performance using GET /api/performance/:id
  const fetchMyPerformance = async () => {
    setIsLoading(true);
    try {
      const uEmail = (user?.email || '').toLowerCase().trim();
      const uName = (user?.name || '').toLowerCase().trim();
      const uId = String(user?._id || user?.id || user?.employeeId || '');

      let matchedId = null;
      let matchedData = null;

      // 1. Resolve current user's performance record ID
      try {
        const allRes = await api.get('/api/performance/all');
        const list = allRes.data?.data || allRes.data?.performances || allRes.data || [];
        if (Array.isArray(list)) {
          const matched = list.find(p =>
            (p.employeeEmail && p.employeeEmail.toLowerCase().trim() === uEmail) ||
            (p.employeeName && p.employeeName.toLowerCase().trim() === uName) ||
            (p.employeeID && String(p.employeeID) === uId) ||
            (p.employeeId && String(p.employeeId) === uId)
          );
          if (matched?._id) {
            matchedId = matched._id;
            matchedData = matched;
          }
        }
      } catch (allErr) {
        console.warn('Could not query performance list:', allErr);
      }

      // 2. Query GET /api/performance/:id for detailed scorecard & remarks
      const targetId = matchedId || uId;
      if (targetId) {
        try {
          const res = await api.get(`/api/performance/${targetId}`);
          const detail = res.data?.data || res.data?.performance || res.data;
          if (detail && typeof detail === 'object') {
            setPerformanceData(detail);
            return;
          }
        } catch (detailErr) {
          console.warn(`GET /api/performance/${targetId} detail notice:`, detailErr.message);
        }
      }

      if (matchedData) {
        setPerformanceData(matchedData);
      }
    } catch (err) {
      console.error('My Performance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPerformance();
  }, [user]);

  const score = Number(performanceData?.performancePercentage ?? 0);

  const getScoreRating = (val) => {
    if (val >= 90) return { label: 'Outstanding (Exceeding Expectations)', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' };
    if (val >= 75) return { label: 'Very Good (Above Standard)', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' };
    if (val >= 50) return { label: 'Good (Meets Expectations)', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' };
    if (val > 0) return { label: 'Needs Improvement', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' };
    return { label: 'Evaluation In Progress', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  const ratingInfo = getScoreRating(score);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Performance</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Personal performance percentage, productivity score, and supervisor feedback
            </p>
          </div>
        </div>

        <button
          onClick={fetchMyPerformance}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-xs text-slate-500 font-medium">Loading your performance metrics...</p>
        </div>
      ) : (
        <>
          {/* Main Scorecard Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 shadow-xs transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

              {/* Left Details */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Evaluation Scorecard</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ratingInfo.bg} ${ratingInfo.color}`}>
                    {ratingInfo.label}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {user?.name || performanceData?.employeeName || 'Pandya Hetvi'}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Email: <strong className="text-slate-700 dark:text-slate-300">{user?.email || performanceData?.employeeEmail || 'N/A'}</strong></span>
                  <span>Role: <strong className="text-slate-700 dark:text-slate-300 uppercase">{user?.role || performanceData?.employeeType || 'Team Leader'}</strong></span>
                  <span>Evaluated Date: <strong className="text-slate-700 dark:text-slate-300">{formatDate(performanceData?.updatedAt || performanceData?.createdAt)}</strong></span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2 max-w-xl">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Performance Rating</span>
                    <span>{score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-indigo-600' : score > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      style={{ width: `${Math.max(score, 4)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Big Percentage Badge */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl min-w-[180px] text-center shrink-0">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100">
                  {score}%
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  Overall Rating
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  GET api/performance/:id
                </span>
              </div>
            </div>

            {/* Evaluator Remarks */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Evaluator Remarks & Feedback</h4>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl">
                <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  "{performanceData?.remarks || 'No specific remarks recorded for this evaluation cycle yet. Keep up the consistent deliverables.'}"
                </p>
              </div>
            </div>
          </div>


        </>
      )}
    </div>
  );
};

// 3. PROJECT VIEW - Exported directly from ../projects/ProjectView.jsx (Live API integration)

// 4. TEAM MEMBERS VIEW (Employee) - Shows ONLY teammates in the user's assigned project(s)
export const TeamMembersView = () => {
  const { user } = useApp();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userProjects, setUserProjects] = useState([]);

  useEffect(() => {
    const fetchMyProjectTeam = async () => {
      setIsLoading(true);
      try {
        const userEmail = (user?.email || user?.user?.email || '').toLowerCase().trim();
        const userId = String(user?._id || user?.id || user?.employee?._id || user?.employeeId || '');

        // 1. Fetch live projects and tasks
        const [projRes, taskRes] = await Promise.allSettled([
          api.get('/api/projectManage/project/all'),
          api.get('/api/task/all')
        ]);

        const projects = projRes.status === 'fulfilled' && Array.isArray(projRes.value.data?.data)
          ? projRes.value.data.data
          : [];

        const tasks = taskRes.status === 'fulfilled' && Array.isArray(taskRes.value.data?.data)
          ? taskRes.value.data.data
          : [];

        if (projects.length === 0) {
          setMembers([]);
          setUserProjects([]);
          return;
        }

        // 2. Determine which projects the current user belongs to
        const memberMap = new Map();
        const myProjectsList = [];

        await Promise.all(
          projects.map(async (p) => {
            let pMembers = null;
            const hasEmbeddedMembers = Boolean(
              p.teamLeadUser || p.teamLeadEmployee ||
              (Array.isArray(p.employees) && p.employees.length > 0)
            );
            if (!hasEmbeddedMembers && p._id) {
              try {
                const memRes = await api.get(`/api/projectManage/project/members/${p._id}`);
                if (memRes.data?.success && memRes.data?.data) {
                  pMembers = memRes.data.data;
                }
              } catch (e) {
                // Ignore failure for individual project
              }
            }

            // Check if CURRENT USER is assigned to this project
            const tlUser = pMembers?.teamLeadUser || p.teamLeadUser;
            const tlEmp = pMembers?.teamLeadEmployee || p.teamLeadEmployee;
            const emps = [...(pMembers?.employees || []), ...(p.employees || [])];
            const interns = [...(pMembers?.interns || []), ...(p.interns || [])];

            const isUserLead = (
              (tlUser?.email && tlUser.email.toLowerCase() === userEmail) ||
              (tlUser?._id && String(tlUser._id) === userId) ||
              (tlEmp?.email && tlEmp.email.toLowerCase() === userEmail) ||
              (tlEmp?._id && String(tlEmp._id) === userId) ||
              (tlEmp?.id && String(tlEmp.id) === userId)
            );

            const isUserEmp = emps.some(e =>
              (e?.email && String(e.email).toLowerCase() === userEmail) ||
              (e?._id && String(e._id) === userId) ||
              (e?.id && String(e.id) === userId)
            );

            const isUserIntern = interns.some(i =>
              (i?.email && String(i.email).toLowerCase() === userEmail) ||
              (i?._id && String(i._id) === userId) ||
              (i?.id && String(i.id) === userId)
            );

            // Also check if any task in this project is assigned to user
            const hasTaskInProject = tasks.some(t => {
              const tPId = typeof t.projectId === 'object' ? t.projectId?._id : t.projectId;
              if (String(tPId) !== String(p._id)) return false;

              const aEmpId = typeof t.assignedEmployee === 'object' ? t.assignedEmployee?._id : t.assignedEmployee;
              const aEmpEmail = typeof t.assignedEmployee === 'object' ? t.assignedEmployee?.email : null;
              const aIntId = typeof t.assignedIntern === 'object' ? t.assignedIntern?._id : t.assignedIntern;
              const aIntEmail = typeof t.assignedIntern === 'object' ? t.assignedIntern?.email : null;

              return (
                (aEmpId && String(aEmpId) === userId) ||
                (aEmpEmail && String(aEmpEmail).toLowerCase() === userEmail) ||
                (aIntId && String(aIntId) === userId) ||
                (aIntEmail && String(aIntEmail).toLowerCase() === userEmail)
              );
            });

            const isUserInThisProject = isUserLead || isUserEmp || isUserIntern || hasTaskInProject;

            // ONLY IF the current user is part of this project, collect team members from it!
            if (isUserInThisProject) {
              const pTitle = p.projectName || 'Project';
              if (!myProjectsList.includes(pTitle)) {
                myProjectsList.push(pTitle);
              }

              const addMem = (m, role, isLead) => {
                if (!m) return;
                const key = (m.email || m._id || m.id || '').toLowerCase().trim();
                if (!key) return;

                const isMe = (
                  (m.email && String(m.email).toLowerCase() === userEmail) ||
                  (m._id && String(m._id) === userId) ||
                  (m.id && String(m.id) === userId)
                );

                const existing = memberMap.get(key);
                if (existing) {
                  if (!existing.projects.includes(pTitle)) {
                    existing.projects.push(pTitle);
                  }
                } else {
                  const name = m.fullName || m.name || (m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : (m.email ? m.email.split('@')[0] : 'Team Member'));
                  memberMap.set(key, {
                    id: m._id || m.id || key,
                    name,
                    email: m.email || '',
                    employeeID: m.employeeID || '',
                    role: isLead ? 'Team Leader' : (role || 'Employee'),
                    status: 'Online',
                    isLead,
                    isMe,
                    projects: [pTitle]
                  });
                }
              };

              // Add Team Leader
              const leadObj = tlEmp || tlUser;
              if (leadObj) addMem(leadObj, 'Team Leader', true);

              // Add Employees
              emps.forEach(e => addMem(e, 'Employee', false));

              // Add Interns
              interns.forEach(i => addMem(i, 'Intern', false));
            }
          })
        );

        setUserProjects(myProjectsList);
        setMembers(Array.from(memberMap.values()));
      } catch (err) {
        console.error("Failed to load project team members:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyProjectTeam();
  }, [user]);

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q) ||
      (m.projects || []).some(pr => pr.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Team Members</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Colleagues and team leaders in your assigned project teams
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search teammates by name, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Active Team Projects Tag */}
      {userProjects.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">My Assigned Projects:</span>
          <div className="flex flex-wrap gap-1.5">
            {userProjects.map((p, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-800 dark:text-indigo-200 font-semibold border border-indigo-200 dark:border-indigo-800 shadow-xs">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">Loading your project teammates...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-10 text-center shadow-xs">
          <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Team Members Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {search
              ? 'No teammates match your search criteria.'
              : 'You are not currently assigned to any active project team. Once assigned to a project, your project teammates and team leader will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((m, idx) => {
            const initials = m.name
              .split(' ')
              .map(w => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'M';

            return (
              <div
                key={m.id || idx}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs ${m.isLead
                    ? 'bg-amber-500'
                    : m.role === 'Intern'
                      ? 'bg-purple-600'
                      : 'bg-indigo-600'
                    }`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{m.name}</h4>
                        {m.isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            You
                          </span>
                        )}
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${m.isLead
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : m.role === 'Intern'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                        {m.role}
                      </span>
                      {m.employeeID && (
                        <span className="text-[10px] font-mono text-slate-400">ID: {m.employeeID}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-1.5">{m.email}</p>
                  </div>
                </div>

                {/* Assigned Projects Tags */}
                {m.projects && m.projects.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Team Project:</span>
                    {m.projects.map((pr, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]"
                        title={pr}
                      >
                        {pr}
                      </span>
                    ))}
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

// 5. EMPLOYEES DIRECTORY (Company-wide directory for Employees & Team Leads - Showing Employee, TL, HR, Admin; Excluding Account & CA)
export const EmployeesView = () => {
  const [filterRole, setFilterRole] = useState('ALL');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyEmployees = async () => {
      setIsLoading(true);
      try {
        // Fetch users and employee records
        const [usersRes, empsRes] = await Promise.allSettled([
          api.get('/api/users/all'),
          api.get('/api/employee/list')
        ]);

        const rawUsers = usersRes.status === 'fulfilled'
          ? (usersRes.value.data?.users || usersRes.value.data?.data || (Array.isArray(usersRes.value.data) ? usersRes.value.data : []))
          : [];

        const rawEmps = empsRes.status === 'fulfilled'
          ? (empsRes.value.data?.employees || empsRes.value.data?.data || (Array.isArray(empsRes.value.data) ? empsRes.value.data : []))
          : [];

        // Helper to identify Account, CA, and Finance users who must NOT be shown
        const isAccountOrCA = (u) => {
          if (!u) return false;
          const role = String(u.role || '').toLowerCase().trim();
          const dept = String(u.department || u.dept || '').toLowerCase().trim();
          const desig = String(u.designation || '').toLowerCase().trim();
          const name = String(u.fullName || u.name || '').toLowerCase().trim();

          // 1. Account / Accountant
          if (role.includes('account') || dept.includes('account') || desig.includes('account')) return true;

          // 2. CA / Chartered Accountant
          if (
            role === 'ca' ||
            role.startsWith('ca ') ||
            role.endsWith(' ca') ||
            role.includes('chartered accountant') ||
            desig === 'ca' ||
            desig.startsWith('ca ') ||
            desig.endsWith(' ca') ||
            desig.includes('chartered accountant')
          ) {
            return true;
          }

          // 3. Finance & Audit
          if (role.includes('finance') || dept.includes('finance') || desig.includes('finance')) return true;
          if (role.includes('audit') || dept.includes('audit') || desig.includes('audit')) return true;
          if (role.includes('cfo') || desig.includes('cfo')) return true;

          // 4. Finance Admin specific check
          if (name.includes('finance') && role.includes('admin')) return true;

          return false;
        };

        // Helper to ensure ONLY employee, TL, HR, admin are shown
        const isAllowedDirectoryRole = (u) => {
          if (!u) return false;
          if (isAccountOrCA(u)) return false;

          const role = String(u.role || '').toLowerCase().trim();
          const desig = String(u.designation || '').toLowerCase().trim();

          const isEmployee =
            role.includes('employee') ||
            role === 'staff' ||
            role.includes('intern') ||
            desig.includes('developer') ||
            desig.includes('designer') ||
            desig.includes('engineer');

          const isTL =
            role.includes('lead') ||
            role.includes('tl') ||
            role === 'team_leader' ||
            desig.includes('team lead') ||
            desig.includes('team leader');

          const isHR =
            role.includes('hr') ||
            desig.includes('hr');

          const isAdmin =
            role.includes('admin') ||
            role.includes('ceo') ||
            desig.includes('ceo') ||
            desig.includes('admin');

          return isEmployee || isTL || isHR || isAdmin;
        };

        const seenKeys = new Set();
        const combined = [];

        [...rawUsers, ...rawEmps].forEach((u) => {
          if (!isAllowedDirectoryRole(u)) return;

          const emailKey = String(u.email || '').toLowerCase().trim();
          const nameKey = String(u.name || u.fullName || '').toLowerCase().trim();
          const uniqueKey = emailKey || nameKey;

          if (uniqueKey && seenKeys.has(uniqueKey)) return;
          if (uniqueKey) seenKeys.add(uniqueKey);

          const roleStr = String(u.role || '').toLowerCase().trim();
          const desigStr = String(u.designation || '').toLowerCase().trim();

          let category = 'EMP';
          let roleFull = 'Employee';

          if (roleStr.includes('lead') || roleStr.includes('tl') || roleStr === 'team_leader' || desigStr.includes('team lead') || desigStr.includes('team leader')) {
            category = 'TL';
            roleFull = 'Team Leader';
          } else if (roleStr.includes('hr') || desigStr.includes('hr')) {
            category = 'HR';
            roleFull = 'HR Manager';
          } else if (roleStr.includes('admin') || roleStr.includes('ceo') || desigStr.includes('ceo') || desigStr.includes('admin')) {
            category = 'ADMIN';
            roleFull = u.designation || 'Administrator';
          } else if (roleStr.includes('intern') || roleStr === 'int') {
            category = 'INT';
            roleFull = 'Intern';
          } else {
            category = 'EMP';
            roleFull = u.designation || 'Employee';
          }

          combined.push({
            id: u.employeeID || (u._id ? `EMP-${String(u._id).slice(-4).toUpperCase()}` : 'EMP'),
            name: u.fullName || u.name || 'Company Member',
            email: u.email || '',
            phone: u.phone || u.phoneNumber || u.mobile || '',
            role: category,
            roleFull,
            rawRole: u.role,
            dept: u.department || (category === 'ADMIN' ? 'Management' : category === 'HR' ? 'Human Resources' : 'Technology'),
            designation: u.designation || roleFull,
            status: u.isActive !== false ? 'Active' : 'Inactive',
            bloodGroup: u.bloodGroup,
            address: u.address
          });
        });

        setEmployees(combined);
      } catch (err) {
        console.error("Failed to load company employees:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanyEmployees();
  }, []);

  const filtered = employees.filter(item => {
    const matchesRole =
      filterRole === 'ALL' ||
      item.role === filterRole ||
      (filterRole === 'EMP' && (item.role === 'EMP' || item.role === 'INT'));

    const q = search.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.dept.toLowerCase().includes(q) ||
      item.designation.toLowerCase().includes(q) ||
      item.roleFull.toLowerCase().includes(q);

    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Company Employee Directory</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Company staff directory including Employees, Team Leaders, HR, and Administrators
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs self-start sm:self-auto flex-wrap">
          {[
            { tag: 'ALL', label: 'All Staff' },
            { tag: 'EMP', label: 'Employees' },
            { tag: 'TL', label: 'Team Leaders' },
            { tag: 'HR', label: 'HR' },
            { tag: 'ADMIN', label: 'Admin' },
          ].map(({ tag, label }) => (
            <button
              key={tag}
              onClick={() => setFilterRole(tag)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                filterRole === tag
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, department, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400 self-end sm:self-auto">
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{filtered.length}</span> of {employees.length} members
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No members match your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Name & Contact</th>
                  <th className="py-3 px-4 font-semibold">Role & Category</th>
                  <th className="py-3 px-4 font-semibold">Department & Designation</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((emp, i) => {
                  const initials = emp.name
                    .split(' ')
                    .map(w => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'M';

                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-500 text-xs">
                        {emp.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                            emp.role === 'TL' ? 'bg-amber-500' :
                            emp.role === 'HR' ? 'bg-rose-500' :
                            emp.role === 'ADMIN' ? 'bg-purple-600' :
                            emp.role === 'INT' ? 'bg-emerald-600' :
                            'bg-indigo-600'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{emp.name}</div>
                            <div className="text-[11px] text-slate-400">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          emp.role === 'TL' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' :
                          emp.role === 'HR' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800' :
                          emp.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800' :
                          emp.role === 'INT' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' :
                          'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {emp.roleFull}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">{emp.designation}</div>
                        <div className="text-[11px] text-slate-400">{emp.dept}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {emp.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// 6. LEARNING HUB (Intern #3)
export const LearningHubView = () => {
  const [modules] = useState([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Internship Learning Hub</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Curated training modules, documentation guidelines, and developer roadmaps</p>
          </div>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <BookOpen size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Learning Modules Assigned</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Your mentor or team leader has not assigned any training modules to your account yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    {mod.level}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">{mod.title}</h4>
                </div>
                <span className="text-xs font-semibold text-slate-500">{mod.hours}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span>Completion Status</span>
                  <span>{mod.completed}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${mod.completed}%` }} />
                </div>
              </div>

              <button className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
                {mod.completed === 100 ? 'Review Material' : 'Continue Module'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 7. INTERNSHIP PROGRESS (Intern #4)
export const InternshipProgressView = () => {
  const checkpoints = [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Internship Progress Tracker</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Internship roadmap, weekly evaluations, and mentor checkpoints</p>
          </div>
        </div>
      </div>

      {checkpoints.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <GraduationCap size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Evaluation Checkpoints Yet</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Your monthly roadmap checkpoints and evaluation scores will appear here once submitted by your mentor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {checkpoints.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${item.status === 'Completed' ? 'bg-green-100 text-green-700' : item.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}>
                {item.status}
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.month}</h4>
              <div className="text-xs text-slate-500 space-y-1">
                <p>Evaluation Score: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.score}</span></p>
                <p>Assigned Mentor: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.mentor}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 8. DOCUMENTS & CERTIFICATE (Intern #7)
export const DocumentsView = () => {
  const { user, setCurrentTab } = useApp();
  const currentUserId = user?.id || user?._id || user?.employeeId || 'current_user';

  const [employeeDocs] = useState(() => {
    try {
      const saved = localStorage.getItem(`employee_documents_${currentUserId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return [];
  });

  const docs = [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
            <FileBadge size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Documents & Certificates</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Official onboarding documents, statutory identity proofs, and certificates</p>
          </div>
        </div>

        <button
          onClick={() => setCurrentTab('profile')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <span>Manage Identity Proofs in Profile</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Statutory Identity Proofs Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Statutory Identity Documents (Aadhar, PAN & Photo)
          </h3>
          <button
            onClick={() => setCurrentTab('profile')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Upload or Update in Profile &rarr;
          </button>
        </div>

        {employeeDocs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No identity proofs saved yet. You can upload your Aadhar Card, PAN Card, and photo from the{' '}
            <button onClick={() => setCurrentTab('profile')} className="text-indigo-600 dark:text-indigo-400 font-semibold underline cursor-pointer">
              Profile section
            </button>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {employeeDocs.slice(0, 3).map((doc) => (
              <div key={doc.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{doc.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                      {doc.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mb-1">{doc.docNumber || 'Verified'}</p>
                  <p className="text-[11px] text-slate-400">{doc.fileName || 'Document record'} • {doc.uploadedAt || 'Recent'}</p>
                </div>

                <button
                  onClick={() => setCurrentTab('profile')}
                  className="mt-3 w-full py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Eye size={13} /> View / Update in Profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Onboarding & HR Documents */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Onboarding & Corporate Agreements
        </h3>
        {docs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No corporate agreements or onboarding documents currently issued.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {docs.map((doc, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{doc.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{doc.date} • {doc.size}</p>
                  </div>
                </div>
                <button
                  onClick={() => alert(`Viewing document: ${doc.title}`)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download size={13} /> View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 9. DAILY FOLLOW UP (Team Leader #2) - Live API integration
export { DailyFollowUpView } from '../follow-up/DailyFollowUpView.jsx';

// 10. TEAM TASK MANAGEMENT (Team Leader #3) - Live API integration
export const TeamTaskManagementView = () => {
  const { user, setSelectedTask } = useApp();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [alertNotice, setAlertNotice] = useState(null);

  // Form State
  const initialForm = {
    taskTitle: '',
    projectId: '',
    taskDescription: '',
    assignedTo: '',
    priority: 'medium',
    status: 'pending',
    dueDate: '',
    estimatedHours: ''
  };
  const [taskForm, setTaskForm] = useState(initialForm);

  const showAlert = (message, type = 'success') => {
    setAlertNotice({ message, type });
    setTimeout(() => setAlertNotice(null), 4000);
  };

  // Fetch live tasks, projects, and users
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch tasks: GET /api/projectManage/task/all with fallback to /api/task/all
      let loadedTasks = [];
      try {
        const pmRes = await api.get('/api/projectManage/task/all');
        const d = pmRes.data?.data || pmRes.data?.tasks || pmRes.data;
        if (Array.isArray(d)) loadedTasks = d;
      } catch (pmErr) {
        try {
          const tRes = await api.get('/api/task/all');
          const d = tRes.data?.data || tRes.data?.tasks || tRes.data;
          if (Array.isArray(d)) loadedTasks = d;
        } catch (tErr) {
          console.error('Failed to load tasks:', tErr);
        }
      }
      setTasks(loadedTasks);

      // 2. Fetch projects: GET /api/projectManage/project/all
      try {
        const pRes = await api.get('/api/projectManage/project/all');
        const pList = pRes.data?.data || pRes.data?.projects || pRes.data;
        if (Array.isArray(pList)) setProjects(pList);
      } catch (pErr) {
        console.warn('Could not load projects for task dropdown:', pErr);
      }

      // 3. Fetch users: GET /api/users/all
      try {
        const uRes = await api.get('/api/users/all');
        const uList = uRes.data?.users || uRes.data?.data || uRes.data;
        if (Array.isArray(uList)) setUsersList(uList);
      } catch (uErr) {
        console.warn('Could not load users for task dropdown:', uErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const normalizeStatus = (status = '') => {
    const s = String(status || '').toLowerCase().trim().replace(/[- ]/g, '_');
    if (['pending', 'assigned', 'to_do', 'todo'].includes(s)) return 'todo';
    if (['in_progress', 'working', 'doing'].includes(s)) return 'in_progress';
    if (['testing', 'review', 'in_review'].includes(s)) return 'review';
    if (['completed', 'done', 'finished'].includes(s)) return 'completed';
    return 'todo';
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setTaskForm({
      ...initialForm,
      projectId: projects[0]?._id || ''
    });
    setEditingTask(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (task, e) => {
    if (e) e.stopPropagation();
    const assignedUser = task.assignedEmployee?._id || task.assignedEmployee ||
      task.assignedIntern?._id || task.assignedIntern || '';
    setTaskForm({
      taskTitle: task.taskTitle || task.title || '',
      projectId: task.projectId?._id || task.projectId || '',
      taskDescription: task.taskDescription || task.description || '',
      assignedTo: assignedUser,
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      estimatedHours: task.estimatedHours || ''
    });
    setEditingTask(task);
    setIsCreateModalOpen(true);
  };

  // CREATE or UPDATE Task
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.taskTitle.trim()) {
      alert('Please enter a task title.');
      return;
    }
    if (!taskForm.projectId) {
      alert('Please select a project.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        taskTitle: taskForm.taskTitle.trim(),
        projectId: taskForm.projectId,
        taskDescription: taskForm.taskDescription.trim(),
        priority: taskForm.priority || 'medium',
        status: taskForm.status || 'pending',
        estimatedHours: Number(taskForm.estimatedHours) || 0
      };
      if (taskForm.dueDate) payload.dueDate = taskForm.dueDate;

      // Assign employee or intern
      if (taskForm.assignedTo) {
        const selectedUserObj = usersList.find(u => (u._id || u.id) === taskForm.assignedTo);
        const roleStr = String(selectedUserObj?.role?.roleName || selectedUserObj?.role || '').toLowerCase();
        if (roleStr.includes('intern')) {
          payload.assignedIntern = taskForm.assignedTo;
          payload.assignedEmployee = null;
        } else {
          payload.assignedEmployee = taskForm.assignedTo;
          payload.assignedIntern = null;
        }
      }

      // If user is TL, attach TL reference
      const myUserId = user?._id || user?.id || user?.profile?._id;
      const myEmpId = user?.employee?._id || user?.employee?.id;
      if (myUserId) payload.assignedTeamLeadUser = myUserId;
      if (myEmpId) payload.assignedTeamLeadEmployee = myEmpId;

      if (editingTask) {
        // UPDATE by TL: PUT /api/projectManage/task/update/:id
        try {
          await api.put(`/api/projectManage/task/update/${editingTask._id}`, payload);
        } catch (upErr) {
          const msg = upErr.response?.data?.message || upErr.message || '';
          if (!msg.includes('milestoneId')) {
            // Secondary fallback if route has another issue
            await api.put(`/api/task/update/${editingTask._id}`, payload);
          }
        }
        showAlert('Task updated successfully!');
      } else {
        // CREATE by TL: POST /api/projectManage/task/create
        try {
          await api.post('/api/projectManage/task/create', payload);
        } catch (crErr) {
          const msg = crErr.response?.data?.message || crErr.message || '';
          if (!msg.includes('milestoneId')) {
            throw crErr;
          }
        }
        showAlert('Task created successfully!');
      }

      setIsCreateModalOpen(false);
      setEditingTask(null);
      await fetchAllData();
    } catch (err) {
      console.error('Failed to save task:', err);
      alert(err.response?.data?.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Change: PUT /api/projectManage/task/update/:id
  const handleQuickStatusChange = async (task, newStatus, e) => {
    if (e) e.stopPropagation();
    // Optimistic UI update
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
    try {
      try {
        await api.put(`/api/projectManage/task/update/${task._id}`, { status: newStatus });
      } catch (upErr) {
        const msg = upErr.response?.data?.message || upErr.message || '';
        if (!msg.includes('milestoneId')) {
          await api.put(`/api/task/status/${task._id}`, { status: newStatus });
        }
      }
      showAlert(`Task marked as ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchAllData();
    }
  };

  // DELETE Task: DELETE /api/projectManage/task/delete/:id
  const handleDeleteTask = async () => {
    if (!deletingTask?._id) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/projectManage/task/delete/${deletingTask._id}`);
      showAlert('Task deleted successfully!');
      setDeletingTask(null);
      await fetchAllData();
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const title = (task.taskTitle || task.title || '').toLowerCase();
      const desc = (task.taskDescription || task.description || '').toLowerCase();
      const pName = (task.projectId?.projectName || task.projectId?.name || '').toLowerCase();
      const empName = (task.assignedEmployee?.name || task.assignedIntern?.name || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || title.includes(q) || desc.includes(q) || pName.includes(q) || empName.includes(q);

      const pId = task.projectId?._id || task.projectId;
      const matchesProject = projectFilter === 'all' || pId === projectFilter;

      const prio = (task.priority || 'medium').toLowerCase();
      const matchesPriority = priorityFilter === 'all' || prio === priorityFilter.toLowerCase();

      const taskNorm = normalizeStatus(task.status);
      const matchesStatus = statusFilter === 'all' || taskNorm === statusFilter || (task.status || '').toLowerCase() === statusFilter;

      return matchesSearch && matchesProject && matchesPriority && matchesStatus;
    });
  }, [tasks, searchQuery, projectFilter, priorityFilter, statusFilter]);

  const todoTasks = filteredTasks.filter(t => normalizeStatus(t.status) === 'todo');
  const inProgressTasks = filteredTasks.filter(t => normalizeStatus(t.status) === 'in_progress');
  const reviewTasks = filteredTasks.filter(t => normalizeStatus(t.status) === 'review');
  const completedTasks = filteredTasks.filter(t => normalizeStatus(t.status) === 'completed');

  const columns = [
    { title: 'To Do', count: todoTasks.length, statusKey: 'pending', tasks: todoTasks, accent: 'border-t-slate-400 bg-slate-50 dark:bg-slate-900/40' },
    { title: 'In Progress', count: inProgressTasks.length, statusKey: 'in_progress', tasks: inProgressTasks, accent: 'border-t-amber-500 bg-amber-50/20 dark:bg-amber-950/10' },
    { title: 'Testing & Review', count: reviewTasks.length, statusKey: 'review', tasks: reviewTasks, accent: 'border-t-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10' },
    { title: 'Completed', count: completedTasks.length, statusKey: 'completed', tasks: completedTasks, accent: 'border-t-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10' }
  ];

  const getPriorityBadge = (priority = 'medium') => {
    const p = String(priority || '').toLowerCase();
    if (['critical', 'urgent'].includes(p)) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">Critical</span>;
    }
    if (p === 'high') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">High</span>;
    }
    if (p === 'low') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Low</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">Medium</span>;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {alertNotice && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all ${alertNotice.type === 'error'
          ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
          }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{alertNotice.message}</span>
          </div>
          <button onClick={() => setAlertNotice(null)} className="cursor-pointer hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <ListTodo size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Task Management</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Live task assignments, workload distribution, and deliverables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Refresh Tasks"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                }`}
            >
              <Layers size={14} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                }`}
            >
              <CheckSquare size={14} /> List
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> Create Task
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: tasks.length, color: 'text-slate-900 dark:text-slate-100', border: 'border-l-indigo-600' },
          { label: 'To Do', value: tasks.filter(t => normalizeStatus(t.status) === 'todo').length, color: 'text-slate-600 dark:text-slate-300', border: 'border-l-slate-400' },
          { label: 'In Progress', value: tasks.filter(t => normalizeStatus(t.status) === 'in_progress').length, color: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-500' },
          { label: 'Completed', value: tasks.filter(t => normalizeStatus(t.status) === 'completed').length, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500' },
        ].map((item, idx) => (
          <div key={idx} className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${item.border} rounded-xl shadow-2xs`}>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">{item.label}</span>
            <span className={`text-2xl font-bold mt-1 block ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, description, project, assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p._id} value={p._id}>{p.projectName || p.name}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Stages</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Testing & Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-xs text-slate-500 font-medium">Loading live team tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full w-fit mx-auto">
            <ListTodo size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No tasks found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || projectFilter !== 'all' ? 'No tasks match the active filters.' : 'Get started by creating your team’s first project task.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Plus size={14} /> Create Task
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {columns.map((col, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-3.5 space-y-3 border border-slate-200 dark:border-slate-800 border-t-4 ${col.accent}`}
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {col.title}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs">
                  {col.count}
                </span>
              </div>

              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {col.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                    No tasks in this stage
                  </p>
                ) : (
                  col.tasks.map((task) => {
                    const assignedName = task.assignedEmployee?.name || task.assignedIntern?.name || 'Unassigned';
                    const projectName = task.projectId?.projectName || task.projectId?.name || 'Project';

                    return (
                      <div
                        key={task._id}
                        onClick={() => setSelectedTask && setSelectedTask(task)}
                        className="group p-3.5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-2xs hover:shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer space-y-2.5 relative"
                      >
                        {/* Top row: Project badge & Priority */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 truncate max-w-[130px]">
                            {projectName}
                          </span>
                          {getPriorityBadge(task.priority)}
                        </div>

                        {/* Task Title */}
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs line-clamp-2 leading-relaxed">
                          {task.taskTitle || task.title}
                        </p>

                        {/* Description excerpt */}
                        {task.taskDescription && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {task.taskDescription}
                          </p>
                        )}

                        {/* Assignee & Due Date */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          <div className="flex items-center gap-1.5 truncate max-w-[140px]" title={assignedName}>
                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                              {assignedName.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{assignedName}</span>
                          </div>

                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                            {task.dueDate ? task.dueDate.split('T')[0] : 'No due date'}
                          </span>
                        </div>

                        {/* Action buttons (Edit, Delete, Advance Status) */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60 gap-1" onClick={e => e.stopPropagation()}>
                          {/* Quick Status Dropdown */}
                          <select
                            value={task.status || 'pending'}
                            onChange={(e) => handleQuickStatusChange(task, e.target.value, e)}
                            className="text-[10px] px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none"
                          >
                            <option value="pending">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">In Review</option>
                            <option value="completed">Completed</option>
                          </select>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleOpenEditModal(task, e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition cursor-pointer"
                              title="Edit Task"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingTask(task);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Task Details</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTasks.map(task => (
                <tr key={task._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3.5 max-w-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {task.taskTitle || task.title}
                    </span>
                    {task.taskDescription && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {task.taskDescription}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {task.projectId?.projectName || task.projectId?.name || 'Project'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      {task.assignedEmployee?.name || task.assignedIntern?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {getPriorityBadge(task.priority)}
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={task.status || 'pending'}
                      onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                      className="text-xs px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                    >
                      <option value="pending">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">In Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {task.dueDate ? task.dueDate.split('T')[0] : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(task)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Edit Task"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingTask(task)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE & EDIT TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingTask ? 'Update task assignment and details' : 'Assign a new task to your team'}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 space-y-4">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design authentication modal"
                  value={taskForm.taskTitle}
                  onChange={(e) => setTaskForm({ ...taskForm, taskTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Project Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project *
                </label>
                <select
                  required
                  value={taskForm.projectId}
                  onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.projectName || p.name}</option>
                  ))}
                </select>
              </div>

              {/* Assigned Member */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignee
                </label>
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Unassigned</option>
                  {usersList.map(u => {
                    const r = u.role?.roleName || u.role || 'employee';
                    return (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.name} ({r}) — {u.email}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  >
                    <option value="pending">To Do / Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="testing">Testing</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Due Date & Estimated Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 16"
                    value={taskForm.estimatedHours}
                    onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide scope, requirements, or acceptance criteria..."
                  value={taskForm.taskDescription}
                  onChange={(e) => setTaskForm({ ...taskForm, taskDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Task</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{deletingTask.taskTitle || deletingTask.title}"</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingTask(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 11. TEAM LEAVE MANAGEMENT (Team Leader #4) - Live API integration with strict assigned-team scoping
export const TeamLeaveManagementView = () => {
  const { user } = useApp();
  const [leaves, setLeaves] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [assignedTeams, setAssignedTeams] = useState([]);
  const [assignedEmployeesCount, setAssignedEmployeesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterTab, setFilterTab] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Approval / Rejection Modal
  const [actionModal, setActionModal] = useState(null); // { type: 'approve' | 'reject', leave: object }
  const [remarksText, setRemarksText] = useState('');
  const [alertNotice, setAlertNotice] = useState(null);

  const showAlert = (message, type = 'success') => {
    setAlertNotice({ message, type });
    setTimeout(() => setAlertNotice(null), 4000);
  };

  // Helper to resolve employee name and role from leave object or usersMap
  const resolveApplicantDetails = (l, uMap = usersMap) => {
    const emp = (typeof l.employeeId === 'object' && l.employeeId !== null) ? l.employeeId :
      (typeof l.employee === 'object' && l.employee !== null) ? l.employee :
        (typeof l.user === 'object' && l.user !== null) ? l.user : null;

    const idStr = (typeof l.employeeId === 'string' ? l.employeeId : '') ||
      (typeof l.employee === 'string' ? l.employee : '') ||
      (typeof l.user === 'string' ? l.user : '') ||
      (typeof l.applicantId === 'string' ? l.applicantId : '') ||
      (emp?._id ? String(emp._id) : '');

    const mappedUser = idStr && uMap ? uMap[idStr] : null;

    const rawName = emp?.name ||
      emp?.fullName ||
      (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
      mappedUser?.name ||
      mappedUser?.fullName ||
      (mappedUser?.firstName ? `${mappedUser.firstName} ${mappedUser.lastName || ''}`.trim() : '') ||
      l.applicantName ||
      l.employeeName ||
      l.name ||
      (emp?.email ? emp.email.split('@')[0] : '') ||
      (mappedUser?.email ? mappedUser.email.split('@')[0] : '') ||
      'Team Member';

    // Proper capitalization
    const name = rawName
      .split(' ')
      .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '')
      .join(' ')
      .trim() || 'Team Member';

    // Professional role / designation resolution
    const rawRole = mappedUser?.designation ||
      emp?.designation ||
      mappedUser?.department ||
      emp?.department ||
      mappedUser?.role ||
      emp?.role ||
      l.applicantRole ||
      'Employee';

    const roleStr = typeof rawRole === 'object' ? (rawRole.roleName || rawRole.name || 'Employee') : String(rawRole);
    const role = roleStr.charAt(0).toUpperCase() + roleStr.slice(1);

    const email = emp?.email || mappedUser?.email || '';
    const photo = (
      emp?.profilePhoto || emp?.profileImage || emp?.photoUrl || emp?.avatar || emp?.image ||
      mappedUser?.profilePhoto || mappedUser?.profileImage || mappedUser?.photoUrl || mappedUser?.avatar || mappedUser?.image ||
      l.profilePhoto || l.photoUrl || l.avatar || ''
    );

    return { name, role, email, photo };
  };

  // Determine Team Leader approval status for a leave
  const getTlStatus = (l) => {
    const tl = String(l.teamLeadStatus || '').toLowerCase().trim();
    if (tl === 'approved') return 'approved';
    if (tl === 'rejected') return 'rejected';

    // If TL note already approved or state advanced to HR/Admin, consider TL approved
    if (l.teamLeadRemark && l.teamLeadRemark.toLowerCase().includes('approved')) return 'approved';
    if (l.status === 'pending_hr' || l.status === 'pending_admin') return 'approved';

    const overall = String(l.status || '').toLowerCase().trim();
    if (overall.includes('approve')) return 'approved';
    if (overall.includes('reject')) return 'rejected';

    return 'pending';
  };

  // Fetch Live Leaves and User Directory with Team Scope filter
  const fetchLeaves = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Users directory and Teams collection simultaneously
      let uMap = {};
      const [uRes, teamsData] = await Promise.allSettled([
        api.get('/api/users/all'),
        fetchTeamsList()
      ]);

      if (uRes.status === 'fulfilled') {
        const rawUsers = uRes.value.data?.users || uRes.value.data?.data || (Array.isArray(uRes.value.data) ? uRes.value.data : []);
        if (Array.isArray(rawUsers)) {
          rawUsers.forEach(u => {
            if (u._id) uMap[String(u._id)] = u;
            if (u.id) uMap[String(u.id)] = u;
            if (u.employeeId) uMap[String(u.employeeId)] = u;
            if (u.email) uMap[u.email.toLowerCase().trim()] = u;
          });
          setUsersMap(uMap);
        }
      }

      // 2. Identify the logged-in user's assigned team(s) from GET /api/teamLead/team
      const allTeams = teamsData.status === 'fulfilled' && Array.isArray(teamsData.value) ? teamsData.value : [];
      const userIdent = getLoggedInUserIdentifiers(user);
      const myTeams = allTeams.filter(team => isTeamOwnedByLead(team, userIdent));
      setAssignedTeams(myTeams);

      const teamScope = extractAssignedTeamEmployees(myTeams, uMap);
      setAssignedEmployeesCount(teamScope.memberIds.size);

      // 3. Fetch leaves
      let allLeavesList = [];
      try {
        const res = await api.get('/api/leave/all');
        const raw = res.data?.data || res.data?.leaves || res.data?.history || (Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(raw) && raw.length > 0) allLeavesList = raw;
      } catch (err1) {
        try {
          const res2 = await api.get('/api/employee-panel/leaves/history');
          const raw2 = res2.data?.data || res2.data?.leaves || res2.data?.history || (Array.isArray(res2.data) ? res2.data : []);
          if (Array.isArray(raw2) && raw2.length > 0) allLeavesList = raw2;
        } catch (err2) {
          console.warn('Could not load leaves:', err2);
        }
      }

      // 4. CRITICAL RULE: Leave requests go ONLY to that employee's TL, not to all TLs
      // Only keep leaves from employees assigned to this Team Lead's team!
      const myTeamLeaves = allLeavesList.filter(l => isLeaveOfAssignedTeam(l, teamScope, uMap));
      setLeaves(myTeamLeaves);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [user]);

  // APPROVE LEAVE: PUT /api/leave/teamlead/approve or /api/leave/teamlead-approval with status: 'approved'
  // When TL approves, it goes to HR for approval!
  const handleApprove = async () => {
    if (!actionModal?.leave?._id) return;
    setIsSubmitting(true);
    try {
      const leaveId = actionModal.leave._id;
      const remarks = remarksText.trim() || 'Approved by Team Leader';
      const payload = {
        leaveId,
        id: leaveId,
        status: 'approved',
        remark: remarks,
        remarks: remarks,
        teamLeadRemark: remarks
      };

      try {
        await api.put('/api/leave/teamlead/approve', payload);
      } catch (err1) {
        try {
          await api.put('/api/leave/teamlead-approval', payload);
        } catch (err2) {
          if (err2.response?.status === 404 || err2.response?.status === 400) {
            await api.put(`/api/leave/teamlead-approval/${leaveId}`, payload);
          } else {
            throw err2;
          }
        }
      }

      const applicantName = resolveApplicantDetails(actionModal.leave).name;
      showAlert(`Leave for ${applicantName} approved by you! Request has been forwarded to HR for final approval.`);
      setActionModal(null);
      setRemarksText('');
      await fetchLeaves();
    } catch (err) {
      console.error('Failed to approve leave:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to approve leave';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // REJECT LEAVE: PUT /api/leave/teamlead/reject or /api/leave/teamlead-approval with status: 'rejected'
  const handleReject = async () => {
    if (!actionModal?.leave?._id) return;
    setIsSubmitting(true);
    try {
      const leaveId = actionModal.leave._id;
      const remarks = remarksText.trim() || 'Rejected by Team Leader';
      const payload = {
        leaveId,
        id: leaveId,
        status: 'rejected',
        remark: remarks,
        remarks: remarks,
        teamLeadRemark: remarks,
        rejectionReason: remarks
      };

      try {
        await api.put('/api/leave/teamlead/reject', payload);
      } catch (err1) {
        try {
          await api.put('/api/leave/teamlead-approval', payload);
        } catch (err2) {
          throw err1;
        }
      }

      const applicantName = resolveApplicantDetails(actionModal.leave).name;
      showAlert(`Leave for ${applicantName} has been rejected.`, 'error');
      setActionModal(null);
      setRemarksText('');
      await fetchLeaves();
    } catch (err) {
      console.error('Failed to reject leave:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to reject leave';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      const tlStatus = getTlStatus(l);
      if (filterTab !== 'all' && tlStatus !== filterTab) return false;

      const applicant = resolveApplicantDetails(l, usersMap).name.toLowerCase();
      const reason = (l.reason || '').toLowerCase();
      const type = (l.leaveType || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      return !q || applicant.includes(q) || reason.includes(q) || type.includes(q);
    });
  }, [leaves, filterTab, searchQuery, usersMap]);

  const pendingCount = leaves.filter(l => getTlStatus(l) === 'pending').length;
  const approvedCount = leaves.filter(l => getTlStatus(l) === 'approved').length;
  const rejectedCount = leaves.filter(l => getTlStatus(l) === 'rejected').length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Avatar initial background color generator
  const getAvatarColor = (name = '') => {
    const colors = [
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {alertNotice && (
        <div className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between shadow-md transition-all ${alertNotice.type === 'error'
          ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
          }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{alertNotice.message}</span>
          </div>
          <button onClick={() => setAlertNotice(null)} className="cursor-pointer hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl">
            <CalendarX size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Leave Approvals</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Review and approve leave applications for your assigned team members before they proceed to HR
            </p>
          </div>
        </div>

        <button
          onClick={fetchLeaves}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Team Assignment Banner */}
      {assignedTeams.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
            <Users size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              Your Assigned Team: <strong>{assignedTeams.map(t => t.name || 'My Team').join(', ')}</strong> ({assignedEmployeesCount} Assigned Members)
            </span>
          </div>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
            Requests forward to HR upon your approval
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            No specific team currently assigned to your Team Lead account in <code>/api/teamLead/team</code>. Only leave requests from your assigned team members will appear here.
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Your Approval', value: pendingCount, color: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-500' },
          { label: 'Approved by You', value: approvedCount, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500' },
          { label: 'Rejected by You', value: rejectedCount, color: 'text-rose-600 dark:text-rose-400', border: 'border-l-rose-500' },
          { label: 'Team Total Requests', value: leaves.length, color: 'text-indigo-600 dark:text-indigo-400', border: 'border-l-indigo-600' }
        ].map((item, idx) => (
          <div key={idx} className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${item.border} rounded-xl shadow-2xs`}>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">{item.label}</span>
            <span className={`text-2xl font-bold mt-1 block ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
          {[
            { key: 'pending', label: `Pending (${pendingCount})` },
            { key: 'all', label: `All (${leaves.length})` },
            { key: 'approved', label: `Approved (${approvedCount})` },
            { key: 'rejected', label: `Rejected (${rejectedCount})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${filterTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search team applicant, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <Loader2 size={32} className="animate-spin text-rose-500" />
          <p className="text-xs text-slate-500 font-medium">Loading team leave requests...</p>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center space-y-2">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No leave requests found</h3>
          <p className="text-xs text-slate-500">
            {filterTab === 'pending'
              ? 'All caught up! No pending leave applications from your team members require your review.'
              : 'No leaves match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLeaves.map((l) => {
            const { name: applicantName, role: applicantRole, photo: applicantPhoto } = resolveApplicantDetails(l);
            const tlStatus = getTlStatus(l);
            const isPending = tlStatus === 'pending';
            const tlRemark = l.teamLeadRemark || l.adminRemark || l.hrRemark || l.remark;

            return (
              <div
                key={l._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Left: Applicant details and leave info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {applicantPhoto ? (
                      <img
                        src={applicantPhoto}
                        alt={applicantName}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.avatar-initial-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                      />
                    ) : null}
                    <div
                      className={`avatar-initial-fallback w-9 h-9 rounded-full items-center justify-center font-bold text-xs shadow-2xs ${getAvatarColor(applicantName)}`}
                      style={{ display: applicantPhoto ? 'none' : 'flex' }}
                    >
                      {applicantName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 mr-2">
                        {applicantName}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {applicantRole}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      (l.leaveType === 'half_day' || l.isHalfDay) 
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' 
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    }`}>
                      {(l.leaveType === 'half_day' || l.isHalfDay) ? 'Half Day Leave' : 'Full Day Leave'}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${tlStatus === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      tlStatus === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                      {tlStatus === 'approved'
                        ? 'Approved by You • Awaiting HR Approval'
                        : tlStatus === 'rejected'
                          ? 'Rejected by You'
                          : 'Action Required (Your Team Member)'}
                    </span>
                  </div>

                  {/* Dates & Reason */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Duration: <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(l.startDate)} {l.endDate && l.endDate !== l.startDate ? `to ${formatDate(l.endDate)}` : ''}
                      </span>
                      <span className="ml-2 text-slate-500">
                        ({l.totalDays || 1} {l.totalDays === 1 ? 'Day' : 'Days'})
                        {l.isHalfDay && (
                          <span className="ml-1 text-slate-500">
                            • {l.halfDayType === 'second-half' ? 'Second Half' : 'First Half'}
                          </span>
                        )}
                      </span>
                    </p>
                    <p className="italic text-slate-500 dark:text-slate-400">
                      Reason: "{l.reason || 'No reason specified'}"
                    </p>
                    {tlRemark && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded inline-block">
                        <span className="font-semibold">TL Note:</span> {tlRemark}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => {
                          setActionModal({ type: 'approve', leave: l });
                          setRemarksText('Approved by Team Leader');
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Check size={14} /> Approve & Forward to HR
                      </button>
                      <button
                        onClick={() => {
                          setActionModal({ type: 'reject', leave: l });
                          setRemarksText('Rejected by Team Leader');
                        }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <X size={14} /> Reject
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {tlStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs font-semibold">
                          <Check size={13} /> Approved by You (Sent to HR)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md text-xs font-semibold">
                          <X size={13} /> Rejected by You
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* APPROVE / REJECT MODAL */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-full ${actionModal.type === 'approve'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                  {actionModal.type === 'approve' ? <Check size={18} /> : <X size={18} />}
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {actionModal.type === 'approve' ? 'Approve & Forward to HR' : 'Reject Leave Request'}
                </h4>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-md text-xs space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {resolveApplicantDetails(actionModal.leave).name}
                <span className="text-slate-500 font-normal ml-1.5">
                  ({resolveApplicantDetails(actionModal.leave).role})
                </span>
              </p>
              <p className="text-slate-500">
                {formatDate(actionModal.leave?.startDate)} to {formatDate(actionModal.leave?.endDate)} ({actionModal.leave?.totalDays || 1} Days)
              </p>
              <p className="text-slate-600 dark:text-slate-400 italic">
                "{actionModal.leave?.reason}"
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {actionModal.type === 'approve' ? 'Approval Remarks (Forwarded to HR)' : 'Rejection Reason / Remarks'}
              </label>
              <textarea
                rows={3}
                placeholder={actionModal.type === 'approve' ? 'e.g. Approved by Team Leader' : 'e.g. Rejected by Team Leader'}
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={isSubmitting}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${actionModal.type === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
                  }`}
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                {actionModal.type === 'approve' ? 'Approve & Forward to HR' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// 13. REPORT / PERFORMANCE VIEW (Team Leader #7) - Aliased to live PerformanceView using GET /api/performance/:id
export const ReportView = PerformanceView;