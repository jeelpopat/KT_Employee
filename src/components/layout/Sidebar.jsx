import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { tabToPath } from '../../utils/navigation.js';

// ==========================================================
// PIXEL-PERFECT REFERENCE SVG ICONS MATCHING USER SCREENSHOT
// ==========================================================

// 1. Dashboard: 4 rounded squares in 2x2 grid
const DashboardIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

// 2. Performance: 3 vertical columns with an upward trend line
const PerformanceIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 17v-4" />
    <path d="M12 17v-7" />
    <path d="M17 17v-11" />
    <path d="M6 13l5-4 4 2 5-6" />
  </svg>
);

// 3. Attendance Logs: Document with folded top-right corner, lines and plus symbol at bottom right
const AttendanceLogsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6" />
    <path d="M14 2v6h6" />
    <path d="M14 2l6 6" />
    <path d="M8 12h4" />
    <path d="M8 16h2" />
    <path d="M18 15v6" />
    <path d="M15 18h6" />
  </svg>
);

// 4. Check-ins Requests: Circular clock
const CheckInsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// 5. Leave Requests: Calendar with binder rings
const LeaveRequestsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// 6. Adjustments: Cog / Settings gear
const AdjustmentsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// 7. Holidays and Events: Umbrella
const HolidaysIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 12a10.06 10.06 0 0 0-20 0Z" />
    <path d="M12 12v8a2 2 0 0 0 4 0" />
    <path d="M12 2v1" />
  </svg>
);

// 8. Employee: Two users outline
const EmployeeIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// 9. Employee Requests: Single user with plus sign
const EmployeeRequestsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

// 10. Team Members: 3 people grouped together
const TeamMembersIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path d="M8 3.13a4 4 0 0 0 0 7.75" />
    <circle cx="12" cy="7" r="4" />
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  </svg>
);

// 11. Team Leads: Award ribbon medallion
const TeamLeadsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

// 12. Salary & Payroll: Wallet
const SalaryIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    <circle cx="18" cy="14" r="1" fill="currentColor" />
  </svg>
);

// 13. Task Management: Checklist
const TaskManagementIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
  </svg>
);

// 14. Screenshot Monitoring: Camera
const ScreenshotIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

// 15. Applications: ID badge card
const ApplicationsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="6" y="8" width="4" height="4" rx="0.5" />
    <line x1="13" y1="9" x2="18" y2="9" />
    <line x1="13" y1="12" x2="18" y2="12" />
    <line x1="6" y1="16" x2="18" y2="16" />
  </svg>
);

// 16. Positions: Storefront with awning & door
const PositionsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
  </svg>
);

// 17. Contacts: Single user outline
const ContactsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 18. Profile: User portrait outline
const ProfileIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 19. Projects: Briefcase
const ProjectsIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

// 20. Daily Report: File Text
const DailyReportIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// 21. Log Out
const LogOutIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

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
        { tab: 'admin-dashboard', label: 'Dashboard', icon: DashboardIcon },
        { tab: 'admin-performance', label: 'Performance', icon: PerformanceIcon },
      ]
    },
    {
      title: "Attendance and Leaves",
      items: [
        { tab: 'admin-attendance-logs', label: 'Attendance Logs', icon: AttendanceLogsIcon },
        { tab: 'admin-checkin-requests', label: 'Check-ins Requests', icon: CheckInsIcon },
        { tab: 'admin-leave-requests', label: 'Leave Requests', icon: LeaveRequestsIcon },
        { tab: 'admin-adjustments', label: 'Adjustments', icon: AdjustmentsIcon },
        { tab: 'admin-holidays', label: 'Holidays and Events', icon: HolidaysIcon },
      ]
    },
    {
      title: "People and Organization",
      items: [
        { tab: 'admin-employees', label: 'Employee', icon: EmployeeIcon },
        { tab: 'admin-employee-requests', label: 'Employee Requests', icon: EmployeeRequestsIcon },
        { tab: 'admin-members', label: 'Team Members', icon: TeamMembersIcon },
        { tab: 'admin-team-lead', label: 'Team Leads', icon: TeamLeadsIcon },
        { tab: 'salary', label: 'Salary & Payroll', icon: SalaryIcon },
        { tab: 'admin-team-tasks', label: 'Task Management', icon: TaskManagementIcon },
      ]
    },
    {
      title: "Monitoring and Security",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: ScreenshotIcon },
      ]
    },
    {
      title: "Recruitment and Leads",
      items: [
        { tab: 'admin-applications', label: 'Applications', icon: ApplicationsIcon },
        { tab: 'admin-positions', label: 'Positions', icon: PositionsIcon },
        { tab: 'admin-portfolio-leads', label: 'Portfolio Leads', icon: PerformanceIcon },
        { tab: 'admin-contacts', label: 'Contacts', icon: ContactsIcon },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: ProfileIcon },
      ]
    }
  ];

  const HR_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'admin-dashboard', label: 'Dashboard', icon: DashboardIcon },
        { tab: 'admin-performance', label: 'Performance', icon: PerformanceIcon },
      ]
    },
    {
      title: "Attendance and Leaves",
      items: [
        { tab: 'admin-attendance-logs', label: 'Attendance Logs', icon: AttendanceLogsIcon },
        { tab: 'admin-checkin-requests', label: 'Check-ins Requests', icon: CheckInsIcon },
        { tab: 'admin-leave-requests', label: 'Leave Requests', icon: LeaveRequestsIcon },
        { tab: 'admin-adjustments', label: 'Adjustments', icon: AdjustmentsIcon },
        { tab: 'admin-holidays', label: 'Holidays and Events', icon: HolidaysIcon },
      ]
    },
    {
      title: "People and Organization",
      items: [
        { tab: 'admin-employees', label: 'Employees', icon: EmployeeIcon },
        { tab: 'admin-employee-requests', label: 'Employee Requests', icon: EmployeeRequestsIcon },
        { tab: 'admin-members', label: 'Team Members', icon: TeamMembersIcon },
        { tab: 'salary', label: 'Salary & Payroll', icon: SalaryIcon },
      ]
    },
    {
      title: "Monitoring and Security",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: ScreenshotIcon },
      ]
    },
    {
      title: "Recruitment and Hiring",
      items: [
        { tab: 'admin-applications', label: 'Applications', icon: ApplicationsIcon },
        { tab: 'admin-positions', label: 'Positions', icon: PositionsIcon },
        { tab: 'admin-contacts', label: 'Contacts', icon: ContactsIcon },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: ProfileIcon },
      ]
    }
  ];

  const TL_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { tab: 'performance', label: 'Performance', icon: PerformanceIcon },
      ]
    },
    {
      title: "Team Management",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: ScreenshotIcon },
        { tab: 'team-tasks', label: 'Task Management', icon: TaskManagementIcon },
        { tab: 'team-leaves', label: 'Team Leave Requests', icon: LeaveRequestsIcon },
        { tab: 'daily-follow-up', label: 'Daily Follow-Up', icon: CheckInsIcon },
        { tab: 'team-members', label: 'Team Members', icon: TeamMembersIcon },
        { tab: 'employees', label: 'Employees', icon: EmployeeIcon },
      ]
    },
    {
      title: "My Workspace",
      items: [
        { tab: 'attendance', label: 'My Attendance', icon: CheckInsIcon, badge: attendanceStatus === 'checked_in' ? 'Active' : undefined },
        { tab: 'tasks', label: 'My Tasks', icon: TaskManagementIcon },
        { tab: 'projects', label: 'My Projects', icon: ProjectsIcon },
        { tab: 'leave', label: 'My Leaves', icon: LeaveRequestsIcon },
        { tab: 'salary', label: 'My Salary', icon: SalaryIcon },
        { tab: 'daily-report', label: 'Daily Report', icon: DailyReportIcon },
        { tab: 'holiday', label: 'Holidays', icon: HolidaysIcon },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: ProfileIcon },
      ]
    }
  ];

  const EMP_SECTIONS = [
    {
      title: "Overview",
      items: [
        { tab: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { tab: 'performance', label: 'My Performance', icon: PerformanceIcon },
      ]
    },
    {
      title: "Monitoring",
      items: [
        { tab: 'admin-screenshots', label: 'Screenshot Monitoring', icon: ScreenshotIcon },
      ]
    },
    {
      title: "My Work",
      items: [
        { tab: 'tasks', label: 'My Tasks', icon: TaskManagementIcon },
        { tab: 'projects', label: 'My Projects', icon: ProjectsIcon },
        { tab: 'daily-report', label: 'Daily Report', icon: DailyReportIcon },
      ]
    },
    {
      title: "Attendance & People",
      items: [
        { tab: 'attendance', label: 'My Attendance', icon: CheckInsIcon, badge: attendanceStatus === 'checked_in' ? 'Active' : undefined },
        { tab: 'leave', label: 'My Leaves', icon: LeaveRequestsIcon },
        { tab: 'salary', label: 'Salary', icon: SalaryIcon },
        { tab: 'holiday', label: 'Holidays', icon: HolidaysIcon },
        { tab: 'team-members', label: 'Team Members', icon: TeamMembersIcon },
        { tab: 'employees', label: 'Employees', icon: EmployeeIcon },
      ]
    },
    {
      title: "Account",
      items: [
        { tab: 'profile', label: 'Profile', icon: ProfileIcon },
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
          className="fixed inset-0 top-16 bg-slate-900/30 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container positioned seamlessly below the full-width navbar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 h-[calc(100vh-4rem)] w-60 bg-white border-r border-slate-200/80 flex flex-col overflow-hidden z-40 transition-transform duration-200 ease-in-out
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} 
          lg:translate-x-0`}
      >
        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {menuSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 bg-slate-100/70 rounded-xs">
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

        {/* Footer with Role indicator & Logout matching reference image */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <div className="mb-2 p-2.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider leading-none mb-1">Role</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {roleLabels[userRole] || 'Administrator'}
              </span>
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-white bg-[#0088cc] capitalize"
              >
                {userRole === 'admin' ? 'Admin' : (userRole === 'hr' ? 'HR' : (userRole === 'team_leader' ? 'TL' : 'Employee'))}
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
            <LogOutIcon size={16} className="shrink-0 text-rose-500" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;