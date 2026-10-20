import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { PageSkeleton } from "./components/common/Loader";
import { checkIsAuthenticated, setupAuthInterceptor } from "./utils/auth";

// Initialize global interceptor for 401 Unauthorized API responses
setupAuthInterceptor();

const Sidebar = lazy(() => import("./components/Sidebar"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Applications = lazy(() => import("./pages/Applications"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Positions = lazy(() => import("./pages/Positions"));
const PortfolioLeads = lazy(() => import("./pages/PortfolioLeads"));
const Employees = lazy(() => import("./pages/attendance/Employees"));
const CheckInRequest = lazy(() => import("./pages/attendance/CheckInRequest"));
const LeaveRequest = lazy(() => import("./pages/attendance/LeaveRequest"));
const AttendanceLogs = lazy(() => import("./pages/attendance/AttendanceLogs"));
const OfficeSettings = lazy(() => import("./pages/attendance/OfficeSettings"));
const Adjustments = lazy(() => import("./pages/attendance/Adjustments"));
const Team = lazy(() => import("./pages/attendance/Team"));
const Members = lazy(() => import("./pages/attendance/Members"));
const Holidays = lazy(() => import("./pages/attendance/Holidays"));
const Profile = lazy(() => import("./pages/Profile"));
const Setting = lazy(() => import("./pages/Setting"));
const Logout = lazy(() => import("./pages/Logout"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const EmployeeRequests = lazy(() => import("./pages/EmployeeRequests"));
const Performance = lazy(() => import("./pages/Performance"));
const TeamLead = lazy(() => import("./pages/TeamLead").then((module) => ({ default: module.TeamLead })));

function PageHeader() {
  const location = useLocation();

  const pageTitles = {
    "/dashboard": "Dashboard",
    "/applications": "Applications",
    "/contacts": "Contacts",
    "/positions": "Positions",
    "/portfolio-leads": "Portfolio Leads",
    "/employee-requests": "Employee Requests",
    "/team-lead": "Team Leads",
    "/attendance/employees": "Employees",
    "/attendance/check-in-request": "Check-In Requests",
    "/attendance/leave-request": "Leave Requests",
    "/attendance/attendance-logs": "Attendance Logs",
    "/attendance/office-settings": "Office Settings",
    "/attendance/adjustments": "Attendance Adjustments",
    "/attendance/team": "Task Management",
    "/attendance/members": "Team Members",
    "/attendance/holidays": "Holidays & Events",
    "/performance": "Performance Analytics",
    "/profile": "User Profile",
    "/setting": "Settings",
  };

  return (
    <header className="fixed top-14 left-0 right-0 z-30 h-16 border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur lg:top-0 lg:left-60">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kevalon Technology</p>
          <h1 className="text-base font-semibold leading-6 text-slate-900">{pageTitles[location.pathname] || "Overview"}</h1>
        </div>
        <span className="hidden text-sm font-medium text-slate-400 sm:block">Admin Panel</span>
      </div>
    </header>
  );
}

function AppShell() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return checkIsAuthenticated();
  });

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(checkIsAuthenticated());
    };

    // Listen for storage changes across tabs & auth-logout event from interceptors
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("auth-logout", handleAuthChange);

    // Periodically verify if the token has expired (every 60 seconds)
    const interval = setInterval(() => {
      if (!checkIsAuthenticated()) {
        setIsAuthenticated(false);
      }
    }, 60000);

    // Also check when user focuses or returns to the tab
    const handleVisibilityOrFocus = () => {
      if (!checkIsAuthenticated()) {
        setIsAuthenticated(false);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("auth-logout", handleAuthChange);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Suspense fallback={<PageSkeleton />}>
        <Sidebar />
      </Suspense>

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <PageHeader />

        <main className="flex-1 p-3 pt-32 sm:p-5 sm:pt-32 lg:p-6 lg:pt-20">
          <div className="page-content w-full">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/positions" element={<Positions />} />
              <Route path="/portfolio-leads" element={<PortfolioLeads />} />
              <Route path="/employee-requests" element={<EmployeeRequests />} />
              <Route path="/team-lead" element={<TeamLead />} />
              <Route path="/attendance/employees" element={<Employees />} />
              <Route path="/attendance/check-in-request" element={<CheckInRequest />} />
              <Route path="/attendance/leave-request" element={<LeaveRequest />} />
              <Route path="/attendance/attendance-logs" element={<AttendanceLogs />} />
              <Route path="/attendance/office-settings" element={<OfficeSettings />} />
              <Route path="/attendance/adjustments" element={<Adjustments />} />
              <Route path="/attendance/team" element={<Team />} />
              <Route path="/attendance/members" element={<Members />} />
              <Route path="/attendance/holidays" element={<Holidays />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/setting" element={<Setting />} />
              <Route path="/logout" element={<Logout setIsAuthenticated={setIsAuthenticated} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;