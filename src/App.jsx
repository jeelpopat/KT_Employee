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

const MainLayout = ({ handleSignOut }) => {
  const { currentTab, isSidebarCollapsed } = useApp();

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'dashboard': return <DashboardView />;
      case 'attendance': return <AttendanceView />;
      case 'daily-report': return <DailyReportView />;
      case 'tasks': return <TaskManagementView />;
      case 'leave': return <LeaveManagementView />;
      case 'profile': return <ProfileView />;
      case 'admin-screenshots': return <AdminScreenshotPortal />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors">
      <Sidebar onSignOut={handleSignOut} />

      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Header onSignOut={handleSignOut} />

        {/* Removed max-w-7xl here to make the layout fully fluid */}
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

  // Initialize Dark Mode instantly on root app load
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