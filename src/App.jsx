import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Header } from './components/layout/Header.jsx';
import { DashboardView } from './components/dashboard/DashboardView.jsx';
import { AttendanceView } from './components/attendance/AttendanceView.jsx';
import { DailyReportView } from './components/daily-report/DailyReportView.jsx';
import { TaskManagementView } from './components/tasks/TaskManagementView.jsx';
import { LeaveManagementView } from './components/leave/LeaveManagementView.jsx';
import { ProfileView } from './components/profile/ProfileView.jsx';
import { AdminScreenshotPortal } from './components/screenshots/AdminScreenshotPortal.jsx';
import { InactivityAlertModal } from './components/alerts/InactivityAlertModal.jsx';
import { LoginView } from './components/auth/LoginView.jsx';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView.jsx';

// Import Holiday Calendar & New Placeholders
import { HolidayCalendarView } from './components/holiday/HolidayCalendarView.jsx';
import {
  SalaryView, PerformanceView, ProjectView,
  TeamMembersView, EmployeesView, LearningHubView, InternshipProgressView,
  DocumentsView, TeamTaskManagementView,
  TeamLeaveManagementView, ReportView
} from './components/placeholders/PlaceholderViews.jsx';

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
      //  case 'daily-follow-up': return <DailyFollowUpView />;
      case 'team-tasks': return <TeamTaskManagementView />;
      case 'team-leaves': return <TeamLeaveManagementView />;
      // case 'attendance-review': return <AttendanceReviewView />;
      case 'report': return <ReportView />;

      default: return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors">
      <Sidebar onSignOut={handleSignOut} />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
      >
        <Header onSignOut={handleSignOut} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6">
          {renderActiveTab()}
        </main>
      </div>
      <InactivityAlertModal />
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