import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp, isRoleAllowed, deriveUserRole } from './context/AppContext.jsx';
import { LoginView } from './components/auth/LoginView.jsx';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView.jsx';
import { pathToTab } from './utils/navigation.js';

// Lazy-load layout and views so unauthenticated users download ONLY the Login screen
const Sidebar = lazy(() => import('./components/layout/Sidebar.jsx').then(m => ({ default: m.Sidebar })));
const Header = lazy(() => import('./components/layout/Header.jsx').then(m => ({ default: m.Header })));
const DashboardView = lazy(() => import('./components/dashboard/DashboardView.jsx').then(m => ({ default: m.DashboardView })));
const AttendanceView = lazy(() => import('./components/attendance/AttendanceView.jsx').then(m => ({ default: m.AttendanceView })));
const DailyReportView = lazy(() => import('./components/daily-report/DailyReportView.jsx').then(m => ({ default: m.DailyReportView })));
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

// Lazy-load role & placeholder views
const SalaryView = lazy(() => import('./components/salary/SalaryView.jsx').then(m => ({ default: m.SalaryView })));
const ProjectView = lazy(() => import('./components/projects/ProjectView.jsx').then(m => ({ default: m.ProjectView })));
const PerformanceView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.PerformanceView })));
const TeamMembersView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamMembersView })));
const EmployeesView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.EmployeesView })));
const LearningHubView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.LearningHubView })));
const InternshipProgressView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.InternshipProgressView })));
const DocumentsView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.DocumentsView })));
const DailyFollowUpView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.DailyFollowUpView })));
const TeamTaskManagementView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamTaskManagementView })));
const TeamLeaveManagementView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.TeamLeaveManagementView })));
const ReportView = lazy(() => import('./components/placeholders/PlaceholderViews.jsx').then(m => ({ default: m.ReportView })));

const MainLayout = ({ handleSignOut }) => {
  const { currentTab, userRole, setCurrentTab, isRoleAllowed: roleCheck } = useApp();
  const location = useLocation();

  // If user is HR, enforce that active tab is strictly locked to screenshot monitoring
  useEffect(() => {
    if (userRole === 'hr' && currentTab !== 'admin-screenshots') {
      setCurrentTab('admin-screenshots');
    }
  }, [userRole, currentTab, setCurrentTab]);

  // Synchronize URL route with currentTab
  useEffect(() => {
    const path = location.pathname;
    const mapped = pathToTab[path];
    if (mapped && mapped !== currentTab) {
      if (userRole === 'hr') {
        setCurrentTab('admin-screenshots');
      } else if (userRole === 'admin' && (mapped === 'dashboard' || path === '/')) {
        setCurrentTab('admin-dashboard');
      } else if (userRole !== 'admin' && (mapped === 'admin-dashboard' || path === '/admin' || path === '/admin/dashboard')) {
        setCurrentTab('dashboard');
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

  const renderActiveTab = () => {
    // HR is strictly locked to Screenshot Monitoring portal only - no dashboard, profile, etc.
    if (userRole === 'hr') {
      return <AdminScreenshotPortal />;
    }

    switch (currentTab) {
      // Admin Specific Modules
      case 'admin-dashboard': return <AdminDashboardView />;
      case 'admin-performance': return <AdminPerformanceView />;
      case 'admin-attendance-logs': return <AdminAttendanceLogsView />;
      case 'admin-checkin-requests': return <AdminCheckInRequestsView />;
      case 'admin-leave-requests': return <AdminLeaveRequestsView />;
      case 'admin-adjustments': return <AdminAdjustmentsView />;
      case 'admin-holidays': return <AdminHolidaysView />;
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

      // Existing Modules
      case 'dashboard': return userRole === 'admin' ? <AdminDashboardView /> : <DashboardView />;
      case 'attendance': return <AttendanceView />;
      case 'daily-report': return <DailyReportView />;
      case 'tasks': return <TaskManagementView />;
      case 'leave': return <LeaveManagementView />;
      case 'profile': return <ProfileView />;
      case 'admin-screenshots': return <AdminScreenshotPortal />;

      // Role-Specific & Standard Modules
      case 'salary': return <SalaryView />;
      case 'performance': return userRole === 'admin' ? <AdminPerformanceView /> : <PerformanceView />;
      case 'projects': return <ProjectView />;
      case 'holiday': return userRole === 'admin' ? <AdminHolidaysView /> : <HolidayCalendarView />;
      case 'team-members': return userRole === 'admin' ? <AdminMembersView /> : <TeamMembersView />;
      case 'employees': return userRole === 'admin' ? <AdminEmployeesView /> : <EmployeesView />;
      case 'learning-hub': return <LearningHubView />;
      case 'internship-progress': return <InternshipProgressView />;
      case 'documents': return <DocumentsView />;
      case 'daily-follow-up': return <DailyFollowUpView />;
      case 'team-tasks': return userRole === 'admin' ? <AdminTeamTasksView /> : <TeamTaskManagementView />;
      case 'team-leaves': return userRole === 'admin' ? <AdminLeaveRequestsView /> : <TeamLeaveManagementView />;
      case 'report': return <ReportView />;

      default: return userRole === 'admin' ? <AdminDashboardView /> : <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Suspense fallback={null}>
        <Sidebar onSignOut={handleSignOut} />
      </Suspense>
      <div className="lg:pl-60 flex flex-col min-h-screen">
        <Suspense fallback={<div className="h-16 border-b border-slate-200/80 bg-white" />}>
          <Header onSignOut={handleSignOut} />
        </Suspense>
        <main className="flex-1 p-3 pt-32 sm:p-5 sm:pt-32 lg:p-6 lg:pt-20">
          <div className="page-content w-full">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[350px]">
                <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              {renderActiveTab()}
            </Suspense>
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <InactivityAlertModal />
      </Suspense>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const storedRole = localStorage.getItem('user_role') || localStorage.getItem('active_role');
    if (storedRole && !isRoleAllowed(storedRole)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
      localStorage.removeItem('active_role');
      localStorage.removeItem('user_role');
      return false;
    }
    const storedUser = localStorage.getItem('auth_user') || localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const derived = deriveUserRole(parsed);
        if (!isRoleAllowed(derived)) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('token');
          localStorage.removeItem('auth_user');
          localStorage.removeItem('user');
          localStorage.removeItem('active_role');
          localStorage.removeItem('user_role');
          return false;
        }
      } catch (e) { }
    }
    return !!token;
  });
  const [authView, setAuthView] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hasToken = new URLSearchParams(window.location.search).has('token');
      if (path.includes('reset-password') || hasToken) {
        return 'reset_password';
      }
    }
    return 'login';
  });

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAuthView('login');
  };

  const handleSignOut = async () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    try {
      if (token) {
        await fetch('https://kt-backend-1.onrender.com/api/users/logout', {
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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
      localStorage.removeItem('active_role');
      localStorage.removeItem('user_role');
      localStorage.removeItem('kt_employee_full_name');
      setIsAuthenticated(false);
      window.location.href = '/';
    }
  };

  return (
    <AppProvider>
      {isAuthenticated ? (
        <MainLayout handleSignOut={handleSignOut} />
      ) : authView === 'reset_password' ? (
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <ResetPasswordView onBackToLogin={() => setAuthView('login')} />
        </Suspense>
      ) : authView === 'forgot_password' ? (
        <ForgotPasswordView onBackToLogin={() => setAuthView('login')} />
      ) : (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onForgotPassword={() => setAuthView('forgot_password')}
        />
      )}
    </AppProvider>
  );
}