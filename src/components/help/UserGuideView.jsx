import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Circle,
  HelpCircle, LayoutDashboard, Play, Search, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

const ROLE_MENU = {
  admin: [
    ['Overview', ['Dashboard', 'Performance']],
    ['Attendance and Leaves', ['Attendance Logs', 'Check-in Requests', 'Leave Requests', 'Adjustments', 'Holidays and Events', 'Daily Task', 'Announcements']],
    ['People and Organization', ['Employee', 'Employee Requests', 'Team Members', 'Team Leads', 'Salary & Payroll', 'Project Management', 'Deduction Master', 'Employee Deductions', 'Deduction Reports', 'Task Management']],
    ['Monitoring and Security', ['Audit Logs']],
    ['Account', ['Profile']]
  ],
  hr: [
    ['Overview', ['Dashboard', 'Performance']],
    ['HR Resources', ['Company Policies']],
    ['Attendance and Leaves', ['My Attendance', 'Attendance Logs', 'Check-in Requests', 'Leave Requests', 'Adjustments', 'Holidays and Events', 'Daily Task']],
    ['People and Organization', ['Employees', 'Team Members', 'Salary & Payroll', 'Project Management', 'Deduction Master', 'Employee Deductions', 'Deduction Reports', 'Task Management']],
    ['Monitoring and Security', ['Audit Logs']],
    ['Account', ['Profile']]
  ],
  team_leader: [
    ['Overview', ['Dashboard', 'Performance']],
    ['Team Management', ['Check-in Requests', 'Task Management', 'Team Leave Requests', 'Team Deductions', 'Daily Follow-Up', 'Team Members', 'Employees']],
    ['Policies', ['Team Lead Policies']],
    ['My Workspace', ['My Attendance', 'My Tasks', 'My Projects', 'My Leaves', 'My Salary', 'My Deductions', 'Daily Report', 'Holidays']],
    ['Account', ['Profile']]
  ],
  employee: [
    ['Overview', ['Dashboard', 'My Performance']],
    ['My Work', ['My Tasks', 'My Projects', 'Daily Report']],
    ['Attendance and People', ['My Attendance', 'My Leaves', 'Salary', 'My Deductions', 'Holidays', 'Team Members', 'Employees']],
    ['Policies', ['Employee Policies']],
    ['Account', ['Profile']]
  ],
  finance: [
    ['Organization and Setup', ['Company Profile', 'Branch Management', 'Financial Year', 'User Management']],
    ['Masters', ['Customers', 'Suppliers', 'Products & Services', 'Tax Master', 'Bank & Cash Accounts', 'Account Transfer', 'Chart of Accounts']],
    ['Purchase and Payables', ['Purchase Orders', 'Purchase Bills', 'Debit Notes']],
    ['Sales and Receivables', ['Sales Invoices', 'Customer Payments', 'Other Income', 'Credit Notes']],
    ['Loans and Financing', ['Lending / Money Given', 'Borrowings / Loans Taken']],
    ['Expenses and Payroll', ['Expenses', 'Salary & Payroll']],
    ['Assets', ['Fixed Assets']],
    ['Accounting', ['Journal Entries']],
    ['Tax and Compliance', ['GST Returns']],
    ['Reports', ['Profit & Loss', 'Balance Sheet', 'Trial Balance', 'GST Report']],
    ['Audit and Activity', ['Notifications', 'Audit Logs']],
    ['My Account', ['My Profile']]
  ]
};

const moduleDetail = (name) => {
  const purpose = {
    'Dashboard': 'View current work summaries and role-relevant operational information.',
    'Performance': 'Review performance information and activity trends available to your role.',
    'Profile': 'View and update your personal, employment and account information.',
    'My Attendance': 'Check in, track breaks and review your attendance status.',
    'Attendance Logs': 'Review employee attendance records and apply available attendance actions.',
    'Check-in Requests': 'Review check-in corrections or requests submitted through the attendance workflow.',
    'Leave Requests': 'Review leave applications and approve or reject requests where permitted.',
    'My Leaves': 'Submit leave requests and track their approval status.',
    'My Tasks': 'Open assigned tasks, update progress and add task comments.',
    'Task Management': 'Create, assign and monitor tasks according to your role permissions.',
    'My Projects': 'View projects assigned to you and their current status.',
    'Project Management': 'Manage project records and project teams where your role permits.',
    'Salary': 'View your available payroll and salary information.',
    'My Salary': 'View your available payroll and salary information.',
    'Employee Policies': 'Read policies applicable to your employee role.',
  };
  return {
    purpose: purpose[name] || `Open ${name} from the sidebar to view, create, search, filter or manage the records provided for your role.`,
    steps: [
      `Open ${name} from the left sidebar.`,
      'Use the available search, date or status filters to find the required record.',
      'Use the module-specific Add, View, Edit or approval button only when it is available.',
      'Complete the required fields and review the information before saving.',
      'Confirm the result in the updated list or detail view.'
    ],
    fields: 'Form fields and filters differ by module. Required fields are normally marked in the form and should be completed before submission.',
    trouble: 'If a record is missing, verify the selected filter and date range. If a save or action is unavailable, your role may not have permission for it.'
  };
};

export const getGuideStorageKey = (role, userId) => `crm-guide:${role}:${userId || 'anonymous'}`;

const getTourPath = (tab, name) => {
  const paths = {
    'dashboard': '/dashboard', 'admin-dashboard': '/dashboard',
    'performance': '/performance', 'admin-performance': '/performance',
    'attendance': '/attendance', 'admin-attendance-logs': '/attendance/attendance-logs',
    'admin-checkin-requests': '/attendance/check-in-request', 'admin-leave-requests': '/attendance/leave-request',
    'admin-adjustments': '/attendance/adjustments', 'admin-holidays': '/attendance/holidays',
    'admin-daily-task': '/admin/daily-task', 'admin-employees': '/attendance/employees',
    'admin-employee-requests': '/employee-requests', 'team-members': '/team-members',
    'admin-team-lead': '/team-lead', 'salary': '/salary', 'projects': '/projects',
    'deduction-master': '/deduction-master', 'employee-deductions': '/employee-deductions',
    'deduction-reports': '/deduction-reports', 'team-tasks': '/attendance/team',
    'admin-audit-logs': '/admin/audit-logs', 'profile': '/profile',
    'hr-policies': '/hr/policies', 'team-leaves': '/team-leaves',
    'team-deductions': '/team-deductions', 'daily-follow-up': '/daily-follow-up',
    'tasks': '/tasks', 'leave': '/leave', 'my-deductions': '/my-deductions',
    'daily-report': '/daily-report', 'holiday': '/holiday',
    'employee-policies': '/employee/policies', 'team-lead-policies': '/team-leader/policies',
  };
  if (paths[tab]) return paths[tab];
  if (tab?.startsWith('finance-')) return tab.replace(/^finance-/, '/finance/') === '/finance-company-profile'
    ? '/finance/company-profile'
    : tab.replace(/^finance-/, '/finance/').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return '/dashboard';
};

const TOUR_TAB_MAP = {
  'Dashboard': 'dashboard', 'My Performance': 'performance', 'Performance': 'admin-performance',
  'Attendance Logs': 'admin-attendance-logs', 'Check-in Requests': 'admin-checkin-requests',
  'Leave Requests': 'admin-leave-requests', 'Adjustments': 'admin-adjustments',
  'Holidays and Events': 'admin-holidays', 'Daily Task': 'admin-daily-task',
  'Announcements': 'admin-announcements', 'Employee': 'admin-employees',
  'Employee Requests': 'admin-employee-requests', 'Team Members': 'team-members',
  'Team Leads': 'admin-team-lead', 'Salary & Payroll': 'salary',
  'Project Management': 'projects', 'Deduction Master': 'deduction-master',
  'Employee Deductions': 'employee-deductions', 'Deduction Reports': 'deduction-reports',
  'Task Management': 'team-tasks', 'Audit Logs': 'admin-audit-logs', 'Profile': 'profile',
  'My Profile': 'profile', 'Company Policies': 'hr-policies',
  'My Attendance': 'attendance', 'Employees': 'admin-employees',
  'Team Lead Policies': 'team-lead-policies', 'Task Management': 'team-tasks',
  'Team Leave Requests': 'team-leaves', 'Team Deductions': 'team-deductions',
  'Daily Follow-Up': 'daily-follow-up', 'My Tasks': 'tasks', 'My Projects': 'projects',
  'My Leaves': 'leave', 'My Salary': 'salary', 'My Deductions': 'my-deductions',
  'Daily Report': 'daily-report', 'Holidays': 'holiday',
  'Employee Policies': 'employee-policies', 'Salary': 'salary',
  'Company Profile': 'finance-company-profile', 'Branch Management': 'finance-branch-management',
  'Financial Year': 'finance-financial-year', 'User Management': 'finance-user-management',
  'Customers': 'finance-customers', 'Suppliers': 'finance-suppliers',
  'Products & Services': 'finance-products-services', 'Tax Master': 'finance-tax-master',
  'Bank & Cash Accounts': 'finance-bank-cash-accounts', 'Account Transfer': 'finance-account-transfer',
  'Chart of Accounts': 'finance-coa', 'Purchase Orders': 'finance-purchase-orders',
  'Purchase Bills': 'finance-purchase-bills', 'Debit Notes': 'finance-debit-notes',
  'Sales Invoices': 'finance-sales-invoices', 'Customer Payments': 'finance-customer-payments',
  'Other Income': 'finance-income', 'Credit Notes': 'finance-credit-notes',
  'Lending / Money Given': 'finance-lending', 'Borrowings / Loans Taken': 'finance-loans',
  'Expenses': 'finance-expenses', 'Fixed Assets': 'finance-fixed-assets',
  'Journal Entries': 'finance-journal-entries', 'GST Returns': 'finance-gst-returns',
  'Profit & Loss': 'finance-profit-loss', 'Balance Sheet': 'finance-balance-sheet',
  'Trial Balance': 'finance-trial-balance', 'GST Report': 'finance-gst-report',
  'Notifications': 'finance-notifications'
};

export const UserGuideView = ({ initialTour = false }) => {
  const { userRole, user } = useApp();
  const navigate = useNavigate();
  const role = (userRole === 'team_leader') ? 'team_leader' : (userRole || 'employee');
  const financeMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/finance');
  const guideRole = financeMode && userRole === 'admin' ? 'finance' : role;
  const userId = user?._id || user?.id || user?.employeeId || user?.email || 'anonymous';
  const storageKey = getGuideStorageKey(guideRole, userId);

  const [query, setQuery] = useState('');
  const [openName, setOpenName] = useState('');
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });
  const [tourIndex, setTourIndex] = useState(initialTour ? 0 : -1);
  const [tourRect, setTourRect] = useState(null);

  const menu = ROLE_MENU[guideRole] || ROLE_MENU.employee;
  const modules = useMemo(() => menu.flatMap(([, names]) => names).map((name) => ({ name, ...moduleDetail(name) })), [menu]);
  const roadmap = useMemo(() => {
    const common = [
      ['Getting Started', 'How to log in and understand navigation'],
      ['Dashboard', 'Read the role dashboard and its summaries'],
      ['Profile', 'Review and update profile information']
    ];
    const roleSpecific = guideRole === 'admin'
      ? [['People Management', 'Use employee and organization records'], ['Approvals', 'Review attendance and leave requests'], ['Reporting', 'Review performance and audit information']]
      : guideRole === 'hr'
        ? [['People Operations', 'Use employee and HR resources'], ['Attendance', 'Review attendance and leave workflows'], ['Policies', 'Publish and maintain role information']]
        : guideRole === 'finance'
          ? [['Masters', 'Configure customers, suppliers and accounting masters'], ['Transactions', 'Create purchase and sales records'], ['Reports', 'Review GST and financial reports']]
          : guideRole === 'team_leader'
            ? [['Team Work', 'Assign and monitor team tasks'], ['Approvals', 'Review team attendance and leave'], ['Team Follow-Up', 'Complete daily follow-ups']]
            : [['My Work', 'Manage assigned tasks and projects'], ['Daily Operations', 'Submit reports and attendance'], ['Policies', 'Review employee policies']];
    return [...common, ...roleSpecific].map(([title, description], index) => ({ id: `topic-${index}`, title, description, level: index < 3 ? 'Level 1 - Getting Started' : index < 5 ? 'Level 2 - Daily Operations' : 'Level 3 - Advanced Use' }));
  }, [guideRole]);

  const completed = roadmap.filter((topic) => progress[topic.id] === 'completed').length;
  const percent = roadmap.length ? Math.round((completed / roadmap.length) * 100) : 0;
  const filtered = query.trim()
    ? modules.filter((item) => `${item.name} ${item.purpose} ${item.steps.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    : modules;

  const saveProgress = (topicId, status) => {
    const next = { ...progress, [topicId]: status };
    setProgress(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const startTour = () => {
    if (!tourSteps.length) return;
    const payload = { steps: tourSteps, index: 0 };
    sessionStorage.setItem('crm-live-tour', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('crm-live-tour-start', { detail: payload }));
    navigate(getTourPath(tourSteps[0].tab, tourSteps[0].name));
  };

  const tourItem = tourIndex >= 0 ? modules[tourIndex] : null;
  const tourSteps = useMemo(() => modules
    .map((item) => {
      let tab = TOUR_TAB_MAP[item.name];
      if (item.name === 'Dashboard' && (guideRole === 'admin' || guideRole === 'hr')) tab = 'admin-dashboard';
      if (item.name === 'Performance' && (guideRole === 'admin' || guideRole === 'hr')) tab = 'admin-performance';
      if (item.name === 'My Performance' && (guideRole === 'employee' || guideRole === 'team_leader')) tab = 'performance';
      return { ...item, tab };
    })
    .filter((item) => item.tab), [modules]);
  const liveTourItem = tourIndex >= 0 ? tourSteps[tourIndex] : null;

  useEffect(() => {
    if (!liveTourItem) {
      setTourRect(null);
      return undefined;
    }

    const element = document.querySelector(`[data-guide-tour="${liveTourItem.tab}"]`);
    if (!element) {
      setTourRect(null);
      return undefined;
    }

    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.classList.add('guide-tour-highlight');

    const updateRect = () => {
      const rect = element.getBoundingClientRect();
      setTourRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      element.classList.remove('guide-tour-highlight');
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [liveTourItem]);

  const openModule = (tab) => {
    if (!tab) return;
    const knownPaths = {
      'Dashboard': '/dashboard', 'Performance': '/performance', 'My Performance': '/performance',
      'My Tasks': '/tasks', 'Task Management': '/attendance/team', 'My Projects': '/projects',
      'Daily Report': '/daily-report', 'My Attendance': '/attendance', 'Attendance Logs': '/attendance/attendance-logs',
      'Check-in Requests': '/attendance/check-in-request', 'Leave Requests': '/attendance/leave-request',
      'My Leaves': '/leave', 'Profile': '/profile', 'My Profile': '/profile',
      'Salary': '/salary', 'My Salary': '/salary', 'Holidays': '/holiday',
      'Team Members': '/team-members', 'Employees': '/employees',
      'Employee Policies': '/employee/policies', 'Team Lead Policies': '/team-leader/policies'
    };
    if (knownPaths[tab]) navigate(knownPaths[tab]);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0877a9]">
              <BookOpen size={15} /> User Guide &amp; Help
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">How to Use Kevalon CRM</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Role-specific instructions for the sidebar sections and workflows available to your account.</p>
          </div>
          <button type="button" onClick={startTour} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(106.46deg, #034665 -20.74%, #068DCB 92.5%)' }}>
            <Play size={16} /> Start Interactive Tour
          </button>
        </div>
        <div className="relative mt-5 max-w-xl">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules or questions..." className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#068DCB] focus:ring-2 focus:ring-[#068DCB]/15" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No guide information matched your search.</div>
          ) : filtered.map((item) => (
            <article key={item.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setOpenName(openName === item.name ? '' : item.name)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{item.purpose}</p>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${openName === item.name ? 'rotate-180' : ''}`} />
              </button>
              {openName === item.name && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">How to use</h3>
                      <ol className="mt-2 space-y-2">
                        {item.steps.map((step, index) => (
                          <li key={step} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f4fa] text-[11px] font-bold text-[#0877a9]">{index + 1}</span>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-4">
                      <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Forms and filters</h3><p className="mt-2 text-sm leading-6 text-slate-700">{item.fields}</p></div>
                      <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Troubleshooting</h3><p className="mt-2 text-sm leading-6 text-slate-700">{item.trouble}</p></div>
                    </div>
                  </div>
                  <button type="button" onClick={() => openModule(item.name)} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#0877a9] hover:text-[#034665]">Open this section <ArrowRight size={14} /></button>
                </div>
              )}
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">My CRM Learning Roadmap</h2>
              <span className="text-xs font-bold text-[#0877a9]">{percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#068DCB]" style={{ width: `${percent}%` }} /></div>
            <p className="mt-2 text-xs text-slate-500">{completed} completed of {roadmap.length} topics</p>
            <div className="mt-4 space-y-3">
              {roadmap.map((topic) => {
                const status = progress[topic.id] || 'not_started';
                return (
                  <div key={topic.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{topic.level}</p>
                    <h3 className="mt-1 text-xs font-bold text-slate-800">{topic.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{topic.description}</p>
                    <div className="mt-2 flex gap-1">
                      {[
                        ['not_started', 'Not Started'], ['in_progress', 'In Progress'], ['completed', 'Completed']
                      ].map(([value, label]) => (
                        <button key={value} type="button" title={label} onClick={() => saveProgress(topic.id, value)} className={`rounded px-2 py-1 text-[10px] font-semibold ${status === value ? 'bg-[#0877a9] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value === 'completed' ? <CheckCircle2 size={13} /> : value === 'in_progress' ? <Circle size={12} /> : label}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Your available sections</h2>
            <div className="mt-3 space-y-3">
              {menu.map(([section, names]) => (
                <div key={section}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{section}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{names.join(' • ')}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {liveTourItem && (
        <>
          {tourRect && (
            <div
              className="pointer-events-none fixed z-[79] rounded-lg border-2 border-sky-400"
              style={{
                top: tourRect.top - 5,
                left: tourRect.left - 5,
                width: tourRect.width + 10,
                height: tourRect.height + 10,
                boxShadow: '0 0 0 5px rgba(14,165,233,.20), 0 12px 28px rgba(2,46,67,.28)'
              }}
            />
          )}
          <div
            className="fixed z-[80] w-[calc(100%-2.5rem)] max-w-sm rounded-xl border border-sky-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,.28)] lg:w-[360px]"
            style={tourRect && window.innerWidth >= 1024
              ? {
                  left: Math.min(tourRect.left + tourRect.width + 24, window.innerWidth - 380),
                  top: Math.max(82, Math.min(tourRect.top - 8, window.innerHeight - 230))
                }
              : { left: '1.25rem', right: '1.25rem', bottom: '1.25rem' }}
          >
            {tourRect && window.innerWidth >= 1024 && (
              <span
                className="absolute -left-2.5 top-7 h-5 w-5 rotate-45 border-b border-l border-sky-200 bg-white"
                aria-hidden="true"
              />
            )}
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#0877a9]">
                  Step {tourIndex + 1} of {tourSteps.length}
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{liveTourItem.name}</h3>
              </div>
              <button type="button" aria-label="Exit tour" onClick={() => setTourIndex(-1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="relative mt-3 text-sm leading-6 text-slate-600">{liveTourItem.purpose}</p>
            <div className="relative mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setTourIndex(-1)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Skip tour</button>
              <div className="flex gap-2">
                <button type="button" disabled={tourIndex === 0} onClick={() => setTourIndex((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><ArrowLeft size={14} /> Back</button>
                <button type="button" onClick={() => {
                  if (tourIndex >= tourSteps.length - 1) setTourIndex(-2);
                  else setTourIndex((value) => value + 1);
                }} className="inline-flex items-center gap-1 rounded-lg bg-[#0877a9] px-3 py-2 text-xs font-semibold text-white">{tourIndex >= tourSteps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14} /></button>
              </div>
            </div>
          </div>
        </>
      )}

      {tourIndex === -2 && (
        <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl">
          <CheckCircle2 className="text-emerald-600" size={22} />
          <div><p className="text-sm font-bold text-slate-900">Tour completed</p><p className="text-xs text-slate-500">You can restart it anytime.</p></div>
          <button type="button" onClick={() => setTourIndex(-1)} aria-label="Close"><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export const WelcomeGuideModal = ({ onStartLearning, onExplore }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4fa] text-[#0877a9]"><HelpCircle size={28} /></div>
      <h2 className="mt-4 text-center text-xl font-bold text-slate-900">Welcome to Kevalon Technology CRM!</h2>
      <p className="mt-2 text-center text-sm leading-6 text-slate-600">Your complete guide to understanding and using the CRM system. Learn every section, understand your responsibilities and explore the features available in your panel.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onStartLearning} className="rounded-lg px-4 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(106.46deg, #034665 -20.74%, #068DCB 92.5%)' }}>Start Learning</button>
        <button type="button" onClick={onExplore} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Explore CRM</button>
      </div>
    </div>
  </div>
);

export const LiveTourOverlay = () => {
  const navigate = useNavigate();
  const [tour, setTour] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('crm-live-tour') || 'null'); } catch { return null; }
  });
  const [rect, setRect] = useState(null);
  const [pageRect, setPageRect] = useState(null);

  useEffect(() => {
    const handleStart = (event) => setTour(event.detail);
    window.addEventListener('crm-live-tour-start', handleStart);
    return () => window.removeEventListener('crm-live-tour-start', handleStart);
  }, []);

  useEffect(() => {
    if (!tour?.steps?.length) return undefined;

    let retryTimer;
    const updateTargets = () => {
      const step = tour.steps[tour.index];
      if (!step) return;

      const sidebarTarget = document.querySelector(`[data-guide-tour="${step.tab}"]`);
      const pageTarget = document.querySelector('.page-content');
      if (sidebarTarget) {
        sidebarTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
        sidebarTarget.classList.add('guide-tour-highlight');
        const rectValue = sidebarTarget.getBoundingClientRect();
        setRect({ top: rectValue.top, left: rectValue.left, width: rectValue.width, height: rectValue.height });
      } else {
        setRect(null);
      }
      if (pageTarget) {
        pageTarget.classList.add('guide-tour-page-highlight');
        const rectValue = pageTarget.getBoundingClientRect();
        setPageRect({ top: rectValue.top, left: rectValue.left, width: rectValue.width, height: rectValue.height });
      } else {
        setPageRect(null);
      }
    };

    retryTimer = window.setTimeout(updateTargets, 350);
    window.addEventListener('resize', updateTargets);
    window.addEventListener('scroll', updateTargets, true);
    return () => {
      window.clearTimeout(retryTimer);
      window.removeEventListener('resize', updateTargets);
      window.removeEventListener('scroll', updateTargets, true);
      document.querySelectorAll('.guide-tour-highlight').forEach((item) => item.classList.remove('guide-tour-highlight'));
      document.querySelectorAll('.guide-tour-page-highlight').forEach((item) => item.classList.remove('guide-tour-page-highlight'));
    };
  }, [tour]);

  if (!tour?.steps?.length) return null;

  const step = tour.steps[tour.index];
  if (!step) return null;

  const saveAndMove = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= tour.steps.length) return;
    const next = { ...tour, index: nextIndex };
    sessionStorage.setItem('crm-live-tour', JSON.stringify(next));
    setTour(next);
    navigate(getTourPath(next.steps[nextIndex].tab, next.steps[nextIndex].name));
  };

  const finish = () => {
    sessionStorage.removeItem('crm-live-tour');
    setTour(null);
  };

  const cardStyle = rect && window.innerWidth >= 1024
    ? {
        left: Math.min(rect.left + rect.width + 30, window.innerWidth - 390),
        top: Math.max(82, Math.min(rect.top - 10, window.innerHeight - 260))
      }
    : { left: '1rem', right: '1rem', bottom: '1rem' };

  return (
    <>
      {pageRect && (
        <div
          className="pointer-events-none fixed z-[78] rounded-xl border-2 border-sky-400"
          style={{
            top: pageRect.top - 6,
            left: pageRect.left - 6,
            width: pageRect.width + 12,
            height: pageRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15,23,42,.16), 0 12px 35px rgba(2,46,67,.18)'
          }}
        />
      )}
      {rect && (
        <div
          className="pointer-events-none fixed z-[79] rounded-lg border-2 border-sky-400"
          style={{
            top: rect.top - 5,
            left: rect.left - 5,
            width: rect.width + 10,
            height: rect.height + 10,
            boxShadow: '0 0 0 5px rgba(14,165,233,.22)'
          }}
        />
      )}
      <div className="fixed z-[81] w-[calc(100%-2rem)] max-w-[370px] rounded-xl border border-sky-200 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,.32)]" style={cardStyle}>
        {rect && window.innerWidth >= 1024 && (
          <span className="absolute -left-2.5 top-7 h-5 w-5 rotate-45 border-b border-l border-sky-200 bg-white" aria-hidden="true" />
        )}
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#0877a9]">
              Live tour • {tour.index + 1} of {tour.steps.length}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{step.name}</h3>
          </div>
          <button type="button" aria-label="Exit tour" onClick={finish} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <p className="relative mt-3 text-sm leading-6 text-slate-700">{step.purpose}</p>
        {step.steps?.[0] && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">Start here: {step.steps[0]}</p>}
        <div className="relative mt-4 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Skip tour</button>
          <div className="flex gap-2">
            <button type="button" disabled={tour.index === 0} onClick={() => saveAndMove(tour.index - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><ArrowLeft size={14} /> Back</button>
            <button type="button" onClick={() => tour.index === tour.steps.length - 1 ? finish() : saveAndMove(tour.index + 1)} className="inline-flex items-center gap-1 rounded-lg bg-[#0877a9] px-3 py-2 text-xs font-semibold text-white">{tour.index === tour.steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14} /></button>
          </div>
        </div>
      </div>
    </>
  );
};
