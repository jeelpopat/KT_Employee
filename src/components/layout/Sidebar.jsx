import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Clock, FileText, CheckSquare,
  CalendarDays, User, LogOut, X, Menu,
  Wallet, TrendingUp, Briefcase, Umbrella, Users,
  ListTodo, CalendarX, Camera, Award, Settings, UserCheck, Shield
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { tabToPath } from '../../utils/navigation.js';
import logo from '../../assets/Logo.png';

export const Sidebar = ({ onSignOut }) => {
  const {
    currentTab, setCurrentTab,
    isMobileSidebarOpen, setIsMobileSidebarOpen,
    attendanceStatus, handleCheckOut, userRole
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const isTabActive = (itemTab) => {
    if (currentTab === itemTab) return true;

    // Check location pathname match with tabToPath
    const currentPath = location.pathname;
    if (tabToPath && tabToPath[itemTab] && tabToPath[itemTab] === currentPath) {
      return true;
    }

    // Check common aliases across role views
    const aliases = {
      'admin-performance': ['performance', 'admin-performance'],
      'performance': ['performance', 'admin-performance'],
      'admin-dashboard': ['dashboard', 'admin-dashboard'],
      'dashboard': ['dashboard', 'admin-dashboard'],
      'admin-salary': ['salary', 'admin-salary'],
      'salary': ['salary', 'admin-salary'],
      'admin-team-tasks': ['team-tasks', 'admin-team-tasks'],
      'team-tasks': ['team-tasks', 'admin-team-tasks'],
      'admin-holidays': ['holiday', 'admin-holidays'],
      'holiday': ['holiday', 'admin-holidays'],
      'admin-members': ['team-members', 'admin-members'],
      'team-members': ['team-members', 'admin-members'],
      'admin-employees': ['employees', 'admin-employees'],
      'employees': ['employees', 'admin-employees'],
      'admin-leave-requests': ['team-leaves', 'admin-leave-requests'],
      'team-leaves': ['team-leaves', 'admin-leave-requests'],
      'admin-settings': ['settings', 'admin-settings', 'setting'],
      'settings': ['settings', 'admin-settings', 'setting'],
    };

    if (aliases[itemTab] && aliases[itemTab].includes(currentTab)) {
      return true;
    }

    return false;
  };

  const handleNavClick = (tab) => {
    setCurrentTab(tab);
    if (tabToPath && tabToPath[tab]) {
      navigate(tabToPath[tab]);
    }
    setIsMobileSidebarOpen(false);
  };

  // Structured menu sections matching Admin Panel organization & typography
  const ADMIN_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { tab: 'admin-performance', label: 'Performance', icon: Award },
      ]
    },
    {
      title: "Attendance & Leaves",
      items: [
        { tab: 'admin-attendance-logs', label: 'Attendance Logs', icon: FileText },
        { tab: 'admin-checkin-requests', label: 'Check-In Requests', icon: Clock },
        { tab: 'admin-leave-requests', label: 'Leave Requests', icon: CalendarX },
        { tab: 'admin-adjustments', label: 'Adjustments', icon: Settings },
        { tab: 'admin-holidays', label: 'Holidays & Events', icon: Umbrella },
      ]
    },
    {
      title: "People & Organization",
      items: [
        { tab: 'admin-employees', label: 'Employee', icon: Users },
        { tab: 'admin-employee-requests', label: 'Employee Requests', icon: UserCheck },
        { tab: 'admin-members', label: 'Team Members', icon: Users },
        { tab: 'admin-team-lead', label: 'Team Leads', icon: Award },
        { tab: 'salary', label: 'Salary & Payroll', icon: Wallet },
        { tab: 'admin-team-tasks', label: 'Task Management', icon: ListTodo },
      ]
    },

    {
      title: "Monitoring & Security",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: Camera },
      ]
    },
    {
      title: "Recruitment & Leads",
      items: [
        { tab: 'admin-applications', label: 'Applications', icon: FileText },
        { tab: 'admin-positions', label: 'Positions', icon: Briefcase },
        { tab: 'admin-portfolio-leads', label: 'Portfolio Leads', icon: TrendingUp },
        { tab: 'admin-contacts', label: 'Contacts', icon: Users },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: User },
      ]
    }
  ];

  const HR_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { tab: 'admin-performance', label: 'Performance', icon: Award },
      ]
    },
    {
      title: "Attendance & Leaves",
      items: [
        { tab: 'admin-attendance-logs', label: 'Attendance Logs', icon: FileText },
        { tab: 'admin-checkin-requests', label: 'Check-In Requests', icon: Clock },
        { tab: 'admin-leave-requests', label: 'Leave Requests', icon: CalendarX },
        { tab: 'admin-adjustments', label: 'Adjustments', icon: Settings },
        { tab: 'admin-holidays', label: 'Holidays & Events', icon: Umbrella },
      ]
    },
    {
      title: "People & Organization",
      items: [
        { tab: 'admin-employees', label: 'Employees', icon: Users },
        { tab: 'admin-employee-requests', label: 'Employee Requests', icon: UserCheck },
        { tab: 'admin-members', label: 'Team Members', icon: Users },
        { tab: 'salary', label: 'Salary & Payroll', icon: Wallet },
      ]
    },
    {
      title: "Monitoring & Security",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: Camera },
      ]
    },
    {
      title: "Recruitment & Hiring",
      items: [
        { tab: 'admin-applications', label: 'Applications', icon: FileText },
        { tab: 'admin-positions', label: 'Positions', icon: Briefcase },
        { tab: 'admin-contacts', label: 'Contacts', icon: Users },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: User },
      ]
    }
  ];

  const TL_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { tab: 'performance', label: 'Performance', icon: TrendingUp },
      ]
    },
    {
      title: "Team Management",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: Camera },
        { tab: 'team-tasks', label: 'Task Management', icon: ListTodo },
        { tab: 'team-leaves', label: 'Team Leave Requests', icon: CalendarX },
        { tab: 'daily-follow-up', label: 'Daily Follow-Up', icon: Clock },
        { tab: 'team-members', label: 'Team Members', icon: Users },
        { tab: 'employees', label: 'Employees', icon: Users },
      ]
    },
    {
      title: "My Workspace",
      items: [
        { tab: 'attendance', label: 'My Attendance', icon: Clock, badge: attendanceStatus === 'checked_in' ? 'Active' : undefined },
        { tab: 'tasks', label: 'My Tasks', icon: CheckSquare },
        { tab: 'projects', label: 'My Projects', icon: Briefcase },
        { tab: 'leave', label: 'My Leaves', icon: CalendarDays },
        { tab: 'salary', label: 'My Salary', icon: Wallet },
        { tab: 'daily-report', label: 'Daily Report', icon: FileText },
        { tab: 'holiday', label: 'Holidays', icon: Umbrella },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: User },
      ]
    }
  ];

  const EMP_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { tab: 'performance', label: 'My Performance', icon: TrendingUp },
      ]
    },
    {
      title: "Monitoring",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: Camera },
      ]
    },
    {
      title: "My Work",
      items: [
        { tab: 'tasks', label: 'My Tasks', icon: CheckSquare },
        { tab: 'projects', label: 'My Projects', icon: Briefcase },
        { tab: 'daily-report', label: 'Daily Report', icon: FileText },
      ]
    },
    {
      title: "Attendance & People",
      items: [
        { tab: 'attendance', label: 'My Attendance', icon: Clock, badge: attendanceStatus === 'checked_in' ? 'Active' : undefined },
        { tab: 'leave', label: 'My Leaves', icon: CalendarDays },
        { tab: 'salary', label: 'Salary', icon: Wallet },
        { tab: 'holiday', label: 'Holidays', icon: Umbrella },
        { tab: 'team-members', label: 'Team Members', icon: Users },
        { tab: 'employees', label: 'Employees', icon: Users },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: User },
      ]
    }
  ];

  const menuSections =
    userRole === 'admin' ? ADMIN_SECTIONS :
      userRole === 'hr' ? HR_SECTIONS :
        userRole === 'team_leader' ? TL_SECTIONS : EMP_SECTIONS;

  const roleLabels = {
    admin: 'Administrator',
    hr: 'HR Manager',
    team_leader: 'Team Leader',
    employee: 'Employee'
  };

  return (
    <>
      {/* Backdrop (Mobile only) */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container matching KT-admin */}
      <aside
        className={`fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-200/80 flex flex-col overflow-hidden z-50 transition-transform duration-200 ease-in-out
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} 
          lg:translate-x-0`}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0 overflow-hidden">
          <div className="flex items-center justify-center h-full flex-1 overflow-hidden">
            <img
              src={logo}
              alt="Kevalon Technology"
              className="h-8 w-auto object-contain scale-[5] origin-center transition-all"
              style={{ transform: 'scale(1)' }}
            />
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 z-10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {menuSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isTabActive(item.tab);

                return (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => handleNavClick(item.tab)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all duration-150 text-xs cursor-pointer text-left ${isActive
                      ? "text-white font-semibold shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      }`}
                    style={
                      isActive
                        ? { background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={16} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer with Role indicator & Logout matching KT-admin */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <div className="mb-2 p-2.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider leading-none mb-1">Role</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {roleLabels[userRole] || 'Administrator'}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white lowercase"
                style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
              >
                {userRole || 'admin'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleCheckOut();
              if (onSignOut) onSignOut();
            }}
            className="w-full flex items-center gap-2 px-1 py-1 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut size={16} className="shrink-0 text-rose-500" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;