import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp, isRoleAllowed, deriveUserRole } from './context/AppContext.jsx';
import { LoginView } from './components/auth/LoginView.jsx';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView.jsx';

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
  const { currentTab, isSidebarCollapsed, userRole, setCurrentTab, isRoleAllowed: roleCheck } = useApp();

  // If user is HR, enforce that active tab is strictly locked to screenshot monitoring
  useEffect(() => {
    if (userRole === 'hr' && currentTab !== 'admin-screenshots') {
      setCurrentTab('admin-screenshots');
    }
  }, [userRole, currentTab, setCurrentTab]);

  // Reject unauthorized roles (account, ca, admin, etc.)
  const checkAllowed = roleCheck || isRoleAllowed;
  if (!checkAllowed(userRole)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl shadow-xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Unauthorized Login
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Access to this Employee Portal is restricted to <strong>Employee</strong>, <strong>Team Lead</strong>, and <strong>HR</strong> roles only. Access denied for role &quot;<strong>{userRole}</strong>&quot;.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow transition-colors cursor-pointer"
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
      // Existing Modules
      case 'dashboard': return <DashboardView />;
      case 'attendance': return <AttendanceView />;
      case 'daily-report': return <DailyReportView />;
      case 'tasks': return <TaskManagementView />;
      case 'leave': return <LeaveManagementView />;
      case 'profile': return <ProfileView />;
      case 'admin-screenshots': return <AdminScreenshotPortal />;

      // New Role-Specific Modules
      case 'salary': return <SalaryView />;
      case 'performance': return <PerformanceView />;
      case 'projects': return <ProjectView />;
      case 'holiday': return <HolidayCalendarView />;
      case 'team-members': return <TeamMembersView />;
      case 'employees': return <EmployeesView />;
      case 'learning-hub': return <LearningHubView />;
      case 'internship-progress': return <InternshipProgressView />;
      case 'documents': return <DocumentsView />;
      case 'daily-follow-up': return <DailyFollowUpView />;
      case 'team-tasks': return <TeamTaskManagementView />;
      case 'team-leaves': return <TeamLeaveManagementView />;
      // case 'attendance-review': return <AttendanceReviewView />;
      case 'report': return <ReportView />;

      default: return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors">
      <Suspense fallback={null}>
        <Sidebar onSignOut={handleSignOut} />
      </Suspense>
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
      >
        <Suspense fallback={<div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />}>
          <Header onSignOut={handleSignOut} />
        </Suspense>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[350px]">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            {renderActiveTab()}
          </Suspense>
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
    const token = localStorage.getItem('auth_token');
    const storedRole = localStorage.getItem('user_role') || localStorage.getItem('active_role');
    if (storedRole && !isRoleAllowed(storedRole)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('active_role');
      localStorage.removeItem('user_role');
      return false;
    }
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const derived = deriveUserRole(parsed);
        if (!isRoleAllowed(derived)) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          localStorage.removeItem('active_role');
          localStorage.removeItem('user_role');
          return false;
        }
      } catch (e) { }
    }
    return !!token;
  });
  const [authView, setAuthView] = useState('login');

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
    const token = localStorage.getItem('auth_token');
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
      localStorage.removeItem('auth_user');
      localStorage.removeItem('active_role');
      localStorage.removeItem('user_role');
      setIsAuthenticated(false);
    }
  };

  return (
    <AppProvider>
      {isAuthenticated ? (
        <MainLayout handleSignOut={handleSignOut} />
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