import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
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
  const { currentTab, isSidebarCollapsed } = useApp();

  const renderActiveTab = () => {
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
    return !!localStorage.getItem('auth_token');
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