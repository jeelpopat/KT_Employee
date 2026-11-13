import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Camera, Loader2, Monitor, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AppProvider, useApp, isRoleAllowed, deriveUserRole } from './context/AppContext.jsx';
import { performAutoCheckout, clearAuth, isTokenExpired, validateUserSession, SCREEN_CAPTURE_ENABLED_SESSION_KEY } from './utils/auth.js';
import { BASE_URL } from './api/config.js';
import { LoginView } from './components/auth/LoginView.jsx';
import { PublicInfoView } from './components/auth/PublicInfoView.jsx';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView.jsx';
import { pathToTab } from './utils/navigation.js';
import { RefreshFeedback, ToastContainer, showToast } from './components/common/Toast.jsx';
import { LoadingScreen, PageSkeleton, TopProgressBar } from './components/common/Loader.jsx';
import { stopScreenCapture } from './services/monitoringService.js';
import SeoMeta from './SeoMeta.jsx';

// Lazy-load layout and views so unauthenticated users download ONLY the Login screen
const Sidebar = lazy(() => import('./components/layout/Sidebar.jsx').then(m => ({ default: m.Sidebar })));
const Header = lazy(() => import('./components/layout/Header.jsx').then(m => ({ default: m.Header })));
const FinancePanel = lazy(() => import('./components/finance/FinancePanel.jsx').then(m => ({ default: m.FinancePanel })));
const DashboardView = lazy(() => import('./components/dashboard/DashboardView.jsx').then(m => ({ default: m.DashboardView })));
const AttendanceView = lazy(() => import('./components/attendance/AttendanceView.jsx').then(m => ({ default: m.AttendanceView })));
const DailyReportView = lazy(() => import('./components/daily-report/DailyReportView.jsx').then(m => ({ default: m.DailyReportView })));
const AdminDailyTaskView = lazy(() => import('./components/daily-report/AdminDailyTaskView.jsx').then(m => ({ default: m.AdminDailyTaskView })));
const TaskManagementView = lazy(() => import('./components/tasks/TaskManagementView.jsx').then(m => ({ default: m.TaskManagementView })));
const LeaveManagementView = lazy(() => import('./components/leave/LeaveManagementView.jsx').then(m => ({ default: m.LeaveManagementView })));
const ProfileView = lazy(() => import('./components/profile/ProfileView.jsx').then(m => ({ default: m.ProfileView })));
const AdminScreenshotPortal = lazy(() => import('./components/screenshots/AdminScreenshotPortal.jsx').then(m => ({ default: m.AdminScreenshotPortal })));
const InactivityAlertModal = lazy(() => import('./components/alerts/InactivityAlertModal.jsx').then(m => ({ default: m.InactivityAlertModal })));
const HolidayCalendarView = lazy(() => import('./components/holiday/HolidayCalendarView.jsx').then(m => ({ default: m.HolidayCalendarView })));
const ResetPasswordView = lazy(() => import('./pages/ResetPassword.jsx'));

// Lazy-load Admin Views
const AdminDashboardView = lazy(() => import('./pages/Dashboard.jsx'));
const AdminPerformanceView = lazy(() => import('./pages/Performance.jsx'));
const AdminAttendanceLogsView = lazy(() => import('./pages/attendance/AttendanceLogs.jsx'));
const AdminCheckInRequestsView = lazy(() => import('./pages/attendance/CheckInRequest.jsx'));
const AdminLeaveRequestsView = lazy(() => import('./pages/attendance/LeaveRequest.jsx'));
const AdminAdjustmentsView = lazy(() => import('./pages/attendance/Adjustments.jsx'));
const AdminHolidaysView = lazy(() => import('./pages/attendance/Holidays.jsx'));
const AdminEmployeesView = lazy(() => import('./pages/attendance/Employees.jsx'));
const AdminEmployeeRequestsView = lazy(() => import('./pages/EmployeeRequests.jsx'));
const AdminMembersView = lazy(() => import('./pages/attendance/Members.jsx'));
const AdminTeamLeadView = lazy(() => import('./pages/TeamLead.jsx').then(m => ({ default: m.TeamLead || m.default })));
const AdminTeamTasksView = lazy(() => import('./pages/attendance/Team.jsx'));
const AdminOfficeSettingsView = lazy(() => import('./pages/attendance/OfficeSettings.jsx'));
const AdminApplicationsView = lazy(() => import('./pages/Applications.jsx'));
const AdminPositionsView = lazy(() => import('./pages/Positions.jsx'));
const AdminPortfolioLeadsView = lazy(() => import('./pages/PortfolioLeads.jsx'));
const AdminContactsView = lazy(() => import('./pages/Contacts.jsx'));
const AdminSettingsView = lazy(() => import('./pages/Setting.jsx'));
const AuditLogsView = lazy(() => import('./pages/AuditLogs.jsx'));

// Lazy-load role & placeholder views
const SalaryView = lazy(() => import('./components/salary/SalaryView.jsx').then(m => ({ default: m.SalaryView })));
const ProjectView = lazy(() => import('./components/projects/ProjectView.jsx').then(m => ({ default: m.ProjectView })));
const PerformanceView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.PerformanceView })));
const TeamMembersView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamMembersView })));
const EmployeesView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.EmployeesView })));
const LearningHubView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.LearningHubView })));
const DocumentsView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.DocumentsView })));
const DailyFollowUpView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.DailyFollowUpView })));
const TeamTaskManagementView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamTaskManagementView })));
const TeamLeaveManagementView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamLeaveManagementView })));
const ReportView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.ReportView })));
const DeductionMasterView = lazy(() => import('./components/deductions/DeductionMasterView.jsx').then(m => ({ default: m.DeductionMasterView || m.default })));
const EmployeeDeductionsView = lazy(() => import('./components/deductions/EmployeeDeductionsView.jsx').then(m => ({ default: m.EmployeeDeductionsView || m.default })));
const DeductionReportsView = lazy(() => import('./components/deductions/DeductionReportsView.jsx').then(m => ({ default: m.DeductionReportsView || m.default })));

const MainLayout = ({ handleSignOut }) => {
  const {
    currentTab,
    userRole,
    setCurrentTab,
    isRoleAllowed: roleCheck,
    isScreenSharingActive,
    startScreenCapture
  } = useApp();
  const [screenCaptureWasEnabled, setScreenCaptureWasEnabled] = useState(() => {
    try {
      return sessionStorage.getItem(SCREEN_CAPTURE_ENABLED_SESSION_KEY) === 'true';
    } catch (error) {
      console.warn('Could not read screen capture session state:', error);
      return false;
    }
  });
  const [startingScreenCapture, setStartingScreenCapture] = useState(false);
  const [screenCaptureError, setScreenCaptureError] = useState('');
  const location = useLocation();
  const isFinanceRoute = location.pathname === '/finance' || location.pathname.startsWith('/finance/');

  useEffect(() => () => stopScreenCapture(), []);

  const handleLayoutSignOut = async () => {
    stopScreenCapture();
    await handleSignOut();
  };

  // Synchronize URL route with currentTab
  useEffect(() => {
    const path = location.pathname;
    const mapped = pathToTab[path];
    if (mapped && mapped !== currentTab) {
      if ((userRole === 'admin' || userRole === 'hr') && (mapped === 'dashboard' || path === '/')) {
        setCurrentTab('admin-dashboard');
      } else if (userRole !== 'admin' && userRole !== 'hr' && (mapped === 'admin-dashboard' || path === '/admin' || path === '/admin/dashboard')) {
        setCurrentTab('dashboard');
      } else if ((userRole === 'admin' || userRole === 'hr') && (mapped === 'performance' || path === '/performance')) {
        setCurrentTab('admin-performance');
      } else if (userRole !== 'admin' && userRole !== 'hr' && (mapped === 'admin-performance' || path === '/performance')) {
        setCurrentTab('performance');
      } else {
        setCurrentTab(mapped);
      }
    }
  }, [location.pathname, setCurrentTab, currentTab, userRole]);

  // Reject unauthorized roles (account, ca, etc.)
  const checkAllowed = roleCheck || isRoleAllowed;
  if (!checkAllowed(userRole)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-slate-200/80 rounded-xl shadow-xs p-6 text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-xl flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unauthorized Access
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Access is restricted to authorized company roles. Access denied for role &quot;<strong>{userRole}</strong>&quot;.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }
  if (isFinanceRoute && userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const renderActiveTab = () => {

    switch (currentTab) {
      // Admin Specific Modules
      case 'admin-dashboard': return <AdminDashboardView />;
      case 'admin-performance': return <AdminPerformanceView />;
      case 'admin-attendance-logs': return <AdminAttendanceLogsView />;
      case 'admin-checkin-requests':
      case 'team-checkin-requests':
      case 'checkin-requests': return <AdminCheckInRequestsView />;
      case 'admin-leave-requests': return <AdminLeaveRequestsView />;
      case 'admin-adjustments': return <AdminAdjustmentsView />;
      case 'admin-holidays': return <AdminHolidaysView />;
      case 'admin-daily-task': return (userRole === 'admin' || userRole === 'hr') ? <AdminDailyTaskView /> : <AdminDashboardView />;
      case 'admin-employees': return <AdminEmployeesView />;
      case 'admin-employee-requests': return <AdminEmployeeRequestsView />;
      case 'admin-members': return <AdminMembersView />;
      case 'admin-team-lead': return <AdminTeamLeadView />;
      case 'admin-team-tasks': return <AdminTeamTasksView />;
      case 'admin-office-settings': return <AdminOfficeSettingsView />;
      case 'admin-settings':
      case 'settings': return <AdminSettingsView />;
      case 'admin-applications': return <AdminApplicationsView />;
      case 'admin-positions': return <AdminPositionsView />;
      case 'admin-portfolio-leads': return <AdminPortfolioLeadsView />;
      case 'admin-contacts': return <AdminContactsView />;
      case 'admin-audit-logs':
        return (userRole === 'admin' || userRole === 'hr') ? <AuditLogsView /> : <AdminDashboardView />;

      // Existing Modules
      case 'dashboard': return (userRole === 'admin' || userRole === 'hr') ? <AdminDashboardView /> : <DashboardView />;
      case 'attendance': return <AttendanceView />;
      case 'daily-report': return <DailyReportView />;
      case 'tasks': return <TaskManagementView />;
      case 'leave': return <LeaveManagementView />;
      case 'profile': return <ProfileView />;
      case 'admin-screenshots': return (userRole === 'admin' || userRole === 'hr') ? <AdminScreenshotPortal /> : <DashboardView />;

      // Role-Specific & Standard Modules
      case 'admin-salary':
      case 'salary': return <SalaryView />;
      case 'admin-performance':
      case 'performance': return <AdminPerformanceView />;
      case 'projects': return <ProjectView />;
      case 'holiday': return (userRole === 'admin' || userRole === 'hr') ? <AdminHolidaysView /> : <HolidayCalendarView />;
      case 'team-members': return (userRole === 'admin' || userRole === 'hr') ? <AdminMembersView /> : <TeamMembersView />;
      case 'employees': return (userRole === 'admin' || userRole === 'hr') ? <AdminEmployeesView /> : <EmployeesView />;
      case 'learning-hub': return <LearningHubView />;
      case 'documents': return (userRole === 'admin') ? <AdminDashboardView /> : <DocumentsView />;
      case 'daily-follow-up': return <DailyFollowUpView />;
      case 'team-tasks': return <AdminTeamTasksView />;
      case 'team-leaves': return (userRole === 'admin' || userRole === 'hr') ? <AdminLeaveRequestsView /> : <TeamLeaveManagementView />;
      case 'report': return <ReportView />;
      case 'deduction-master': return <DeductionMasterView />;
      case 'employee-deductions':
      case 'deduction-approvals':
      case 'team-deductions':
      case 'my-deductions': return <EmployeeDeductionsView />;
      case 'deduction-reports': return <DeductionReportsView />;

      default: return (userRole === 'admin' || userRole === 'hr') ? <AdminDashboardView /> : <DashboardView />;
    }
  };

  const requiresEmployeeScreenCapture =
    (userRole === 'employee' || userRole === 'team_leader') &&
    !isScreenSharingActive &&
    !screenCaptureWasEnabled;

  const handleEnableScreenCapture = async () => {
    setStartingScreenCapture(true);
    setScreenCaptureError('');
    try {
      await startScreenCapture();
      try {
        sessionStorage.setItem(SCREEN_CAPTURE_ENABLED_SESSION_KEY, 'true');
        setScreenCaptureWasEnabled(true);
      } catch (error) {
        console.warn('Could not save screen capture session state:', error);
      }
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setScreenCaptureError('Screen sharing was not allowed. Select a screen and choose Share in your browser to continue.');
      } else if (error?.name === 'NotFoundError') {
        setScreenCaptureError('No screen source is available. Connect a display or choose an available screen and try again.');
      } else {
        setScreenCaptureError(error?.message || 'Could not start screen sharing. Check browser support and try again.');
      }
    } finally {
      setStartingScreenCapture(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-slate-900 font-sans" style={{ backgroundColor: '#F4F4F4' }}>
      <div inert={requiresEmployeeScreenCapture}>
        <Suspense fallback={<div className="h-16 border-b border-[#083b4e]" style={{ background: 'linear-gradient(106.46deg, #034665 -20.74%, #068DCB 92.5%)' }} />}>
          <Header onSignOut={handleLayoutSignOut} />
        </Suspense>
        <Suspense fallback={null}>
          <Sidebar onSignOut={handleLayoutSignOut} />
        </Suspense>
        <div className="lg:pl-60 flex flex-col min-h-screen pt-16 bg-[#F4F4F4]">
          <main className="flex-1 p-3 pt-4 sm:p-5 sm:pt-6 lg:p-6 lg:pt-6 bg-[#F4F4F4]">
            <div className="mb-2 flex min-h-6 justify-end">
              <RefreshFeedback />
            </div>
            <div className="page-content w-full">
              <Suspense fallback={<PageSkeleton />}>
                {isFinanceRoute ? <FinancePanel /> : renderActiveTab()}
              </Suspense>
            </div>
          </main>
        </div>
        <Suspense fallback={null}>
          <InactivityAlertModal />
        </Suspense>
      </div>
      {requiresEmployeeScreenCapture && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="screen-capture-title"
          aria-describedby="screen-capture-description"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Monitor size={28} />
            </div>
            <div className="mt-4 text-center">
              <h2 id="screen-capture-title" className="text-xl font-bold text-slate-900">
                Enable device screen monitoring
              </h2>
              <p id="screen-capture-description" className="mt-2 text-sm leading-6 text-slate-600">
                To continue as an Employee or Team Leader, allow screen sharing. Your browser will ask you to choose a screen and confirm sharing. Screenshots are captured only while monitoring is active and your work session is checked in.
              </p>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              For privacy and browser security, this permission must be granted separately in each browser and cannot be opened automatically. Choose a screen in the browser prompt, then select <strong>Share</strong>.
            </div>
            {screenCaptureError && (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {screenCaptureError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleLayoutSignOut}
                disabled={startingScreenCapture}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Log out
              </button>
              <button
                type="button"
                onClick={handleEnableScreenCapture}
                disabled={startingScreenCapture}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {startingScreenCapture ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
                {startingScreenCapture ? 'Waiting for browser permission…' : 'Enable Screen Capture'}
                {!startingScreenCapture && <ShieldCheck size={17} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const location = useLocation();

  // Global interceptor for native browser alert() -> clean modern UI Toast
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert;
      window.alert = (message) => {
        const msgStr = typeof message === 'string' ? message : (message?.message || JSON.stringify(message));
        const lower = (msgStr || '').toLowerCase();
        const isErr =
          lower.includes('fail') ||
          lower.includes('error') ||
          lower.includes('require') ||
          lower.includes('please') ||
          lower.includes('wrong') ||
          lower.includes('invalid') ||
          lower.includes('missing') ||
          lower.includes('not found') ||
          lower.includes('denied');
        showToast(msgStr, isErr ? 'error' : 'success');
      };
      return () => {
        window.alert = originalAlert;
      };
    }
  }, []);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      return false;
    }
    return false;
  });

  const [authView, setAuthView] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hasToken = new URLSearchParams(window.location.search).has('token');
      if (path.includes('reset-password') || hasToken) {
        return 'reset_password';
      }
      if (path.includes('register') || path.includes('signup')) {
        return 'register';
      }
      if (path.includes('forgot-password')) {
        return 'forgot_password';
      }
    }
    return 'login';
  });

  // Keep the existing session when its locally stored token is still valid.
  useEffect(() => {
    let isMounted = true;

    const verifySessionOnMount = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        clearAuth();
        if (isMounted) {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      if (isTokenExpired(token)) {
        if (isMounted) {
          await performAutoCheckout(token);
          clearAuth();
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        const session = await validateUserSession();
        if (!isMounted) return;

        if (!session.isValid) {
          clearAuth();
          setIsAuthenticated(false);
          setAuthView('login');
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Could not verify the current user session:', error);
        if (isMounted) {
          clearAuth();
          setIsAuthenticated(false);
          setAuthView('login');
        }
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    };

    verifySessionOnMount();

    return () => {
      isMounted = false;
    };
  }, []);

  // Global auth logout listener
  useEffect(() => {
    const handleAuthLogout = () => {
      clearAuth();
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    };
    window.addEventListener('auth-logout', handleAuthLogout);
    return () => window.removeEventListener('auth-logout', handleAuthLogout);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsCheckingAuth(false);
    setAuthView('login');
  };

  const handleSignOut = async () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    try {
      await performAutoCheckout(token);
      if (token) {
        await fetch(`${BASE_URL}/api/users/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (e) {
      console.warn('Logout notification error:', e);
    } finally {
      clearAuth();
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      window.location.href = '/';
    }
  };

  if (isCheckingAuth) {
    return <LoadingScreen message="Verifying session..." fullScreen className="bg-slate-50 font-sans" />;
  }

  const marketingPages = {
    '/crm-software': {
      eyebrow: 'KEVALON CRM',
      title: 'Smart CRM software for growing businesses',
      description: 'Bring leads, customers, team activity and pipeline data into a single, searchable workspace built for modern business teams.',
      bullets: [
        'Automate lead capture, assignment and follow-up tasks.',
        'Track customer communication across sales and service teams.',
        'Monitor pipeline performance with real-time reporting.'
      ],
      stats: [
        { value: '24/7', label: 'lead visibility' },
        { value: '100%', label: 'team alignment' },
        { value: 'A+', label: 'workflow health' }
      ]
    },
    '/features': {
      eyebrow: 'FEATURES',
      title: 'Built to streamline sales and customer operations',
      description: 'Kevalon CRM brings customer records, sales pipelines and everyday business workflows together for stronger execution.',
      bullets: [
        'Lead management with automated routing and status tracking.',
        'Customer activity timelines for service and sales visibility.',
        'Dashboards for team performance, follow-ups and conversion trends.'
      ],
      stats: [
        { value: '8+', label: 'core modules' },
        { value: '1 view', label: 'team dashboard' },
        { value: 'A+', label: 'process clarity' }
      ]
    },
    '/lead-management': {
      eyebrow: 'LEAD MANAGEMENT',
      title: 'Convert more leads with a focused sales workflow',
      description: 'Capture every opportunity, prioritize follow-ups and keep your sales pipeline moving with clear ownership at every stage.',
      bullets: [
        'Assign qualified leads to the right sales owners quickly.',
        'Track lead status, communications and next-step actions.',
        'Improve conversion rates with structured sales execution.'
      ],
      stats: [
        { value: 'Faster', label: 'lead response' },
        { value: 'Clear', label: 'ownership' },
        { value: 'Higher', label: 'conversion' }
      ]
    },
    '/customer-management': {
      eyebrow: 'CUSTOMER MANAGEMENT',
      title: 'Keep customer relationships consistent and measurable',
      description: 'Organize customer details, service interactions and business context in one secure experience for better retention.',
      bullets: [
        'Maintain a clean, searchable customer database.',
        'Review interactions, history and renewal status in one place.',
        'Support better onboarding and after-sales engagement.'
      ],
      stats: [
        { value: '360°', label: 'customer view' },
        { value: 'Secure', label: 'records' },
        { value: 'Better', label: 'retention' }
      ]
    },
    '/sales-management': {
      eyebrow: 'SALES MANAGEMENT',
      title: 'Close deals with stronger visibility and control',
      description: 'Give sales teams the tools to forecast accurately, manage pipelines and complete work without operational gaps.',
      bullets: [
        'Monitor stages, targets and revenue performance in real time.',
        'Reduce administrative friction with automated updates.',
        'Support decision-making with smarter business reporting.'
      ],
      stats: [
        { value: 'Live', label: 'pipeline view' },
        { value: 'Smart', label: 'forecasting' },
        { value: 'Growth', label: 'focused' }
      ]
    },
    '/about': {
      eyebrow: 'ABOUT US',
      title: 'Built by Kevalon Technology for ambitious businesses',
      description: 'Kevalon Technology creates digital workflows that help growing teams manage customers, sales and internal operations with clarity.',
      bullets: [
        'Business-first CRM design for operational efficiency.',
        'Support for teams across sales, service and administration.',
        'A practical, scalable approach for Indian business growth.'
      ],
      stats: [
        { value: 'India', label: 'business focus' },
        { value: 'Scalable', label: 'solutions' },
        { value: 'Trusted', label: 'operations' }
      ]
    },
    '/contact': {
      eyebrow: 'CONTACT',
      title: 'Talk to our team about your CRM requirements',
      description: 'Whether you need better lead tracking or a stronger customer workflow, Kevalon Technology can help design the right fit.',
      bullets: [
        'Discuss your sales and customer process challenges.',
        'Explore system configuration for your business workflow.',
        'Request a tailored demo for your operations team.'
      ],
      stats: [
        { value: 'Demo', label: 'available' },
        { value: 'Consultation', label: 'support' },
        { value: 'Fast', label: 'response' }
      ]
    },
    '/blog': {
      eyebrow: 'BLOG',
      title: 'CRM insights for smarter customer and sales operations',
      description: 'Explore practical ideas for improving lead capture, customer retention and organized business performance with CRM strategy.',
      bullets: [
        'Learn how structured customer data improves service quality.',
        'Understand best practices for lead follow-up and sales visibility.',
        'Explore business efficiency ideas for modern teams.'
      ],
      stats: [
        { value: 'Insights', label: 'for growth' },
        { value: 'Practical', label: 'advice' },
        { value: 'Clear', label: 'strategy' }
      ]
    }
  };

  const publicPages = ['/security-policy', '/privacy', '/support', '/terms-of-service'];
  const publicPage = publicPages.includes(location.pathname) ? location.pathname : null;
  const marketingPage = marketingPages[location.pathname] ? location.pathname : null;

  const MarketingPage = ({ page }) => {
    const pageConfig = marketingPages[page];

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <SeoMeta pathname={page} />
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/crm-software" className="flex items-center gap-3 text-slate-900">
              <img src="/kevalon-logo.png" alt="Kevalon Technology" className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">Kevalon</div>
                <div className="text-sm font-bold text-slate-900">CRM</div>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
              <Link to="/crm-software" className="transition hover:text-sky-600">CRM</Link>
              <Link to="/features" className="transition hover:text-sky-600">Features</Link>
              <Link to="/lead-management" className="transition hover:text-sky-600">Lead Management</Link>
              <Link to="/customer-management" className="transition hover:text-sky-600">Customer Management</Link>
              <Link to="/sales-management" className="transition hover:text-sky-600">Sales Management</Link>
              <Link to="/contact" className="transition hover:text-sky-600">Contact</Link>
            </nav>
            <Link to="/login" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500">
              Login
            </Link>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                  {pageConfig.eyebrow}
                </span>
                <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
                  {pageConfig.title}
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                  {pageConfig.description}
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link to="/contact" className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500">
                    Request a demo
                  </Link>
                  <Link to="/features" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                    Explore features
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
                <div className="rounded-2xl bg-slate-900 p-5 text-white">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-300">
                    <span>Kevalon CRM</span>
                    <span>Live overview</span>
                  </div>
                  <div className="mt-8 space-y-5">
                    {pageConfig.stats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-2xl font-black text-sky-300">{stat.value}</div>
                        <div className="mt-1 text-sm text-slate-200">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {pageConfig.bullets.map((bullet) => (
                <div key={bullet} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg text-sky-700">✓</div>
                  <p className="text-base font-medium leading-7 text-slate-700">{bullet}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 py-16 text-white">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-2">
                <div>
                  <h2 className="text-3xl font-black text-white">Built for business clarity</h2>
                  <p className="mt-4 max-w-xl text-lg text-slate-300">
                    Kevalon CRM helps teams focus on customer relationships, process consistency and measurable business growth without adding complexity.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2">Lead tracking</span>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2">Customer records</span>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2">Sales visibility</span>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2">Actionable insights</span>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>© {new Date().getFullYear()} Kevalon Technology</div>
            <div className="flex flex-wrap gap-4">
              <Link to="/privacy" className="hover:text-sky-600">Privacy</Link>
              <Link to="/terms-of-service" className="hover:text-sky-600">Terms</Link>
              <Link to="/security-policy" className="hover:text-sky-600">Security</Link>
              <Link to="/support" className="hover:text-sky-600">Support</Link>
            </div>
          </div>
        </footer>
      </div>
    );
  };

  return (
    <AppProvider>
      <SeoMeta pathname={location.pathname} />
      <ToastContainer />
      {isAuthenticated ? (
        <MainLayout handleSignOut={handleSignOut} />
      ) : marketingPage ? (
        <MarketingPage page={marketingPage} />
      ) : publicPage ? (
        <PublicInfoView page={publicPage} />
      ) : authView === 'reset_password' ? (
        <Suspense fallback={<LoadingScreen message="Loading password reset..." fullScreen />}>
          <ResetPasswordView onBackToLogin={() => setAuthView('login')} />
        </Suspense>
      ) : authView === 'forgot_password' ? (
        <ForgotPasswordView onBackToLogin={() => setAuthView('login')} />
      ) : (
        <LoginView
          initialMode={authView === 'register' ? 'register' : 'login'}
          onLoginSuccess={handleLoginSuccess}
          onForgotPassword={() => setAuthView('forgot_password')}
          onNavigateToRegister={() => setAuthView('register')}
        />
      )}
    </AppProvider>
  );
}