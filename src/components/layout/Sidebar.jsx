import React from 'react';
import { 
  LayoutDashboard, Clock, FileText, CheckSquare, 
  CalendarDays, User, LogOut, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import logo from '../../assets/Logo.png';

export const Sidebar = ({ onSignOut }) => {
  const { 
    currentTab, setCurrentTab, isSidebarCollapsed, 
    setIsSidebarCollapsed, isMobileSidebarOpen, setIsMobileSidebarOpen, 
    attendanceStatus, handleCheckOut 
  } = useApp();

  const employeeNavItems = [
    { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { tab: 'attendance', label: 'Attendance', icon: <Clock size={18} />, badge: attendanceStatus === 'checked_in' ? 'Active' : undefined },
    { tab: 'daily-report', label: 'Daily Report', icon: <FileText size={18} /> },
    { tab: 'tasks', label: 'Task Management', icon: <CheckSquare size={18} />, badge: 3 },
    { tab: 'leave', label: 'Leave Management', icon: <CalendarDays size={18} /> },
    { tab: 'profile', label: 'Profile', icon: <User size={18} /> }
  ];

  const handleNavClick = (tab) => {
    setCurrentTab(tab);
    setIsMobileSidebarOpen(false);
  };

  return (
    <>
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-colors">
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-center h-full flex-1 overflow-hidden">
              <img
                src={logo} 
                alt="Kevalon Technology" 
                className="h-7 w-auto object-contain scale-[6] origin-center dark:brightness-0 dark:invert transition-all" 
              />
            </div>
          )}
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {isSidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
          </button>

          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {employeeNavItems.map((item) => {
            const isActive = currentTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => handleNavClick(item.tab)}
                className={`w-full flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-l-4 border-slate-800 dark:border-slate-300 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border-l-4 border-transparent'
                } ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3">
                  <span className={`${isActive ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                
                {!isSidebarCollapsed && item.badge && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-colors">
          <button
            onClick={() => {
              handleCheckOut();
              if (onSignOut) onSignOut();
            }}
            className={`w-full flex items-center px-3 py-2.5 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer ${
              isSidebarCollapsed ? 'justify-center' : 'space-x-3'
            }`}
            title="Log Out"
          >
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};