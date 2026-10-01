import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { 
  Menu, X, Plus, Bell, LayoutDashboard, FileText, Users, Briefcase, UserCheck, User, LogOut, ChevronRight, Settings, Calendar, Award
} from "lucide-react";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuSections = [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "Performance", path: "/performance", icon: Award },
      ]
    },
    {
      title: "Attendance & Leaves",
      items: [
        { label: "Attendance Logs", path: "/attendance/attendance-logs", icon: FileText },
        { label: "Check-In Request", path: "/attendance/check-in-request", icon: UserCheck },
        { label: "Leave Request", path: "/attendance/leave-request", icon: FileText },
        { label: "Adjustments", path: "/attendance/adjustments", icon: Settings },
        { label: "Holidays", path: "/attendance/holidays", icon: Calendar },
      ]
    },
    {
      title: "People & Organization",
      items: [
        { label: "Employees", path: "/attendance/employees", icon: Users },
        { label: "Employee Requests", path: "/employee-requests", icon: UserCheck },
        { label: "Members", path: "/attendance/members", icon: Users },
        { label: "Team Lead", path: "/team-lead", icon: UserCheck },
        { label: "Task Management", path: "/attendance/team", icon: Briefcase },
      ]
    },
    {
      title: "Recruitment & Leads",
      items: [
        { label: "Applications", path: "/applications", icon: FileText },
        { label: "Positions", path: "/positions", icon: Briefcase },
        { label: "Portfolio Leads", path: "/portfolio-leads", icon: UserCheck },
        { label: "Contacts", path: "/contacts", icon: Users },
      ]
    },
    {
      title: "Account",
      items: [
        { label: "Profile", path: "/profile", icon: User },
        { label: "Logout", path: "/logout", icon: LogOut },
      ]
    }
  ];

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Bar */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain rounded" />
          <span className="font-semibold text-xs text-slate-800 tracking-tight">Kevalon Tech</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="View notifications"
            aria-label="View notifications"
            onClick={() => window.dispatchEvent(new Event("open-notifications"))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            title="Post announcement"
            aria-label="Post announcement"
            onClick={() => window.dispatchEvent(new Event("open-announcement"))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50"
          >
            <Plus size={20} />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Backdrop (Mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-200/80 flex flex-col overflow-hidden z-50 transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          lg:translate-x-0`}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Kevalon Technology"
              className="h-14 w-36 object-contain"
            />
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 text-xs scrollbar-thin">
          {menuSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all duration-150 text-xs ${
                        item.label === "Logout"
                          ? "text-rose-600 hover:bg-rose-50/80 font-medium"
                          : isActive
                          ? "bg-indigo-50/90 text-indigo-700 font-semibold border-l-2 border-indigo-600"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      }`
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

      </aside>
    </>
  );
}

export default Sidebar;