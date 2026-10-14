import React, { useEffect, useRef, useState } from "react";
import {
  Users,
  FolderKanban,
  Briefcase,
  Cake,
  CheckCircle2,
  AlertCircle,
  X,
  UserX
} from "lucide-react";
import api from "../api/axios";
import { useConfirm } from "../components/common/ConfirmDialog";
import {
  isFinanceOrExcludedUser,
  filterOutFinanceUsers,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser
} from "../utils/roleFilters";

const UmbrellaIcon = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 12a10.06 10.06 0 0 0-20 0Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 12v8a2 2 0 0 0 4 0" />
    <path d="M12 2v1" />
  </svg>
);

export default function Dashboard() {
  const { confirmationDialog } = useConfirm();
  const [stats, setStats] = useState([
    {
      id: 1,
      name: "Total Employees",
      value: 0,
      icon: Users,
      badge: "Full-Time",
      accent: "indigo",
    },
    {
      id: 2,
      name: "Total Projects",
      value: 0,
      icon: FolderKanban,
      badge: "Active",
      accent: "amber",
    },
    {
      id: 3,
      name: "Total Team Leads",
      value: 0,
      icon: Briefcase,
      badge: "Management",
      accent: "purple",
    },
  ]);


  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [leaveRemark, setLeaveRemark] = useState("");
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [absentRecords, setAbsentRecords] = useState([]);
  const [presentRecords, setPresentRecords] = useState([]);
  const [dashboardCounts, setDashboardCounts] = useState({
    employeeCount: 0,
    projectCount: 0,
    teamLeadCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const absentCardRef = useRef(null);
  const [absentPosition, setAbsentPosition] = useState(null);

  const isAutoAbsentTimeReached = () => {
    const now = new Date();
    return now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() >= 30);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchProjects(),
        fetchTeamLeads(),
        fetchLeaves(),
        fetchHolidays(),
        fetchAbsentAttendance(),
      ]);
      setLoading(false);
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    // Background polling every 12s to automatically reflect new attendances, leaves, and employee registrations
    const intervalId = setInterval(() => {
      fetchAbsentAttendance();
      fetchLeaves();
      fetchUsers();
    }, 12000);

    const handleFocus = () => {
      fetchAbsentAttendance();
      fetchLeaves();
      fetchUsers();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAbsentAttendance();
        fetchLeaves();
        fetchUsers();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("attendance_updated", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("attendance_updated", handleFocus);
    };
  }, []);

  useEffect(() => {
    setStats([
      {
        id: 1,
        name: "Total Employees",
        value: dashboardCounts.employeeCount,
        icon: Users,
        badge: "Full-Time",
        accent: "indigo",
      },
      {
        id: 2,
        name: "Total Projects",
        value: dashboardCounts.projectCount,
        icon: FolderKanban,
        badge: "Active",
        accent: "amber",
      },
      {
        id: 3,
        name: "Total Team Leads",
        value: dashboardCounts.teamLeadCount,
        icon: Briefcase,
        badge: "Management",
        accent: "purple",
      },
    ]);
  }, [dashboardCounts.employeeCount, dashboardCounts.projectCount, dashboardCounts.teamLeadCount]);

  async function fetchUsers() {
    try {
      // Fetch employees from employee/list API
      const employeeResponse = await fetch("https://kt-backend-yzr4.onrender.com/api/employee/list");
      const employeeData = await employeeResponse.json();

      let employees = [];
      if (Array.isArray(employeeData)) {
        employees = employeeData;
      } else if (employeeData.users && Array.isArray(employeeData.users)) {
        employees = employeeData.users;
      } else if (employeeData.data && Array.isArray(employeeData.data)) {
        employees = employeeData.data;
      } else if (employeeData.employees && Array.isArray(employeeData.employees)) {
        employees = employeeData.employees;
      }

      const filteredEmployees = filterOutUnknownUsers(filterOutFinanceUsers(employees));
      const employeeCount = filteredEmployees.length;

      // Fetch users for birthdays
      const usersResponse = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all");
      const usersData = await usersResponse.json();
      const users = usersData.users || usersData.data || [];
      const filteredUsers = filterOutUnknownUsers(filterOutFinanceUsers(users));

      const formattedBirthdays = filteredUsers
        .map((user) => ({
          id: user._id || user.id,
          name: user.name || user.fullName || "N/A",
          role: user.role || "N/A",
          dob: user.dob || user.dateOfBirth || user.birthDate || user.birthday || null,
        }))
        .filter((user) => user.dob && isBirthdayInCurrentMonth(user.dob))
        .sort((a, b) => {
          const aDate = parseBirthdayDate(a.dob);
          const bDate = parseBirthdayDate(b.dob);

          if (!aDate || !bDate) return 0;
          return aDate.getMonth() - bDate.getMonth() || aDate.getDate() - bDate.getDate();
        });

      setBirthdays(formattedBirthdays);
      setDashboardCounts((prev) => ({
        ...prev,
        employeeCount,
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  async function fetchTeamLeads() {
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let userList = [];
      try {
        const res = await fetch("https://kt-backend-yzr4.onrender.com/api/user/all", { headers });
        const d = await res.json();
        userList = d.users || d.data || (Array.isArray(d) ? d : []);
      } catch (e1) {
        try {
          const res = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all", { headers });
          const d = await res.json();
          userList = d.users || d.data || (Array.isArray(d) ? d : []);
        } catch (e2) {
          try {
            const res = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all");
            const d = await res.json();
            userList = d.users || d.data || (Array.isArray(d) ? d : []);
          } catch (e3) {
            console.warn("Could not fetch user/all or users/all for team leads:", e3);
          }
        }
      }

      const isTeamLeadUser = (u) => {
        if (!u || isFinanceOrExcludedUser(u)) return false;
        const role = String(u.role || '').toLowerCase().trim();
        const desig = String(u.designation?.designationName || u.designation?.name || u.designation || '').toLowerCase().trim();
        return (
          u.isTeamLead === true ||
          u.isTeamLeader === true ||
          role === 'team lead' ||
          role === 'team_leader' ||
          role === 'team leader' ||
          role === 'tl' ||
          role.includes('team lead') ||
          role.includes('lead') ||
          desig.includes('team lead') ||
          desig.includes('team leader')
        );
      };

      const teamLeadsFromUsers = (Array.isArray(userList) ? userList : []).filter(isTeamLeadUser);
      let finalCount = teamLeadsFromUsers.length;

      // If users API had 0 team leads, fallback to teamLead/team
      if (finalCount === 0) {
        try {
          const response = await fetch("https://kt-backend-yzr4.onrender.com/api/teamLead/team", {
            headers,
          });
          const data = await response.json();
          const teamLeads = data.teamLeads || data.data || data.teamlead || data.teams || [];
          const filteredTeamLeads = filterOutFinanceUsers(Array.isArray(teamLeads) ? teamLeads : []);
          finalCount = filteredTeamLeads.length;
        } catch (err) { }
      }

      setDashboardCounts((prev) => ({
        ...prev,
        teamLeadCount: finalCount,
      }));
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchProjects() {
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let projectList = [];
      try {
        const res = await api.get('/api/projectManage/project/all');
        projectList = res.data?.data || res.data?.projects || (Array.isArray(res.data) ? res.data : []);
      } catch (e1) {
        try {
          const res = await fetch("https://kt-backend-yzr4.onrender.com/api/projectManage/project/all", { headers });
          const d = await res.json();
          projectList = d?.data || d?.projects || (Array.isArray(d) ? d : []);
        } catch (e2) {
          console.warn("Could not fetch projects:", e2);
        }
      }

      const count = Array.isArray(projectList) ? projectList.length : 0;
      setDashboardCounts((prev) => ({
        ...prev,
        projectCount: count,
      }));
    } catch (error) {
      console.error("Error fetching projects count:", error);
    }
  }

  async function fetchLeaves() {
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const response = await fetch("https://kt-backend-yzr4.onrender.com/api/leave/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      let leaveArray = Array.isArray(data) ? data : data.leaves || data.data || [];

      const hrApprovedLeaves = leaveArray.filter((leave) => {
        if (!leave || isUnknownEmployeeOrUser(leave)) return false;
        if (isFinanceOrExcludedUser(leave)) return false;
        if (leave.employeeId && (isFinanceOrExcludedUser(leave.employeeId) || isUnknownEmployeeOrUser(leave.employeeId))) return false;
        return leave.hrStatus?.toLowerCase() === "approved";
      });
      setLeaves(hrApprovedLeaves);
    } catch (error) {
      console.error(error);
    }
  }
  async function fetchHolidays() {
    try {
      const response = await fetch(
        "https://kt-backend-yzr4.onrender.com/api/holiday/current-month"
      );

      if (!response.ok) {
        throw new Error(
          `Holiday API failed: ${response.status}`
        );
      }

      const data = await response.json();

      let holidays = [];

      if (Array.isArray(data)) {
        holidays = data;
      } else if (Array.isArray(data.holidays)) {
        holidays = data.holidays;
      } else if (Array.isArray(data.data)) {
        holidays = data.data;
      } else if (Array.isArray(data.holiday)) {
        holidays = data.holiday;
      } else if (Array.isArray(data.currentMonthHolidays)) {
        holidays = data.currentMonthHolidays;
      } else if (Array.isArray(data.result)) {
        holidays = data.result;
      }

      const formatted = holidays
        .filter((holiday) => {
          const targetDate = holiday.holidayDate || holiday.date;
          return isHolidayUpcomingInCurrentMonth(targetDate);
        })
        .map((holiday) => ({
          id: holiday._id || holiday.id,

          name:
            holiday.holidayName ||
            holiday.name ||
            "Holiday",

          date: formatHolidayDate(
            holiday.holidayDate ||
            holiday.date
          ),

          // ================= UNSPLASH IMAGE =================
          image:
            holiday.imagePhotographer || null,

          // Optional Unsplash attribution
          photographer:
            holiday.imagePhotographer || null,

          photographerUrl:
            holiday.imagePhotographerUrl || null,

          unsplashUrl:
            holiday.imageUnsplashUrl || null,

          isDefault:
            holiday.isDefault || false,
        }))
        .sort((a, b) => {
          const aDate = parseBirthdayDate(a.date);
          const bDate = parseBirthdayDate(b.date);
          if (!aDate || !bDate) return 0;
          return aDate.getDate() - bDate.getDate();
        });

      setUpcomingHolidays(formatted);
    } catch (error) {
      console.error(
        "Error fetching holidays:",
        error
      );

      setUpcomingHolidays([]);
    }
  }

  const getLocalDateKey = (dateValue) => {
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
  };

  const normalizeAttendanceRecords = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    const nestedCandidates = [
      payload.data,
      payload.records,
      payload.result,
      payload.attendance,
      payload.absent,
      payload.notCheckedIn,
      payload.notCheckedInList,
      payload.users,
      payload.employees,
      payload.data?.data,
      payload.data?.records,
      payload.data?.users,
      payload.data?.employees,
    ];

    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    return [];
  };

  const getAttendanceStatus = (record) => {
    const rawStatus =
      record?.status ||
      record?.attendanceStatus ||
      record?.currentStatus ||
      record?.state ||
      record?.attendance?.status ||
      "";
    const status = String(rawStatus).trim().toLowerCase();

    if (["present", "on time", "approved"].includes(status)) return "present";
    if (record?.checkInTime || record?.checkinTime || record?.punchIn || record?.approvedCheckInTime) {
      return "present";
    }
    return status;
  };

  const getAttendanceDate = (record) =>
    record?.date ||
    record?.attendanceDate ||
    record?.attendance?.date ||
    record?.createdAt ||
    record?.checkInTime ||
    record?.checkinTime ||
    record?.updatedAt;

  async function fetchAbsentAttendance() {
    try {
      const token = localStorage.getItem("token");

      // Fetch absent records from the dedicated API
      const absentResponse = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/attendance/absent/all?_t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          cache: "no-store",
        }
      );

      if (!absentResponse.ok) {
        throw new Error(`Absent attendance fetch failed: ${absentResponse.status}`);
      }

      const absentData = await absentResponse.json();
      const absentRecordsList = normalizeAttendanceRecords(absentData);

      const normalizedAbsent = absentRecordsList
        .filter((record) => {
          if (!record || isFinanceOrExcludedUser(record) || isUnknownEmployeeOrUser(record)) return false;
          if (record.user && (isFinanceOrExcludedUser(record.user) || isUnknownEmployeeOrUser(record.user))) return false;
          if (record.employee && (isFinanceOrExcludedUser(record.employee) || isUnknownEmployeeOrUser(record.employee))) return false;
          if (record.userId && (isFinanceOrExcludedUser(record.userId) || isUnknownEmployeeOrUser(record.userId))) return false;
          return true;
        })
        .map((record, index) => ({
          ...record,
          _id: record._id || record.id || `absent-${index}`,
          employeeName: record.employeeName || record.name || record.user?.name || record.employee?.name || "N/A",
          role: record.role || record.user?.role || record.employee?.role || "N/A",
        }));

      setAbsentRecords(normalizedAbsent);

      // Fetch present records (with cache-busting)
      const attendanceResponse = await fetch(`https://kt-backend-yzr4.onrender.com/api/attendance/admin/all?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        cache: "no-store",
      });
      const attendanceData = await attendanceResponse.json();
      const attendanceList = normalizeAttendanceRecords(attendanceData);

      const todayKey = getLocalDateKey(new Date());
      const todayPresent = attendanceList.filter((record) => {
        if (!record || isFinanceOrExcludedUser(record) || isUnknownEmployeeOrUser(record)) return false;
        if (record.user && (isFinanceOrExcludedUser(record.user) || isUnknownEmployeeOrUser(record.user))) return false;
        if (record.employee && (isFinanceOrExcludedUser(record.employee) || isUnknownEmployeeOrUser(record.employee))) return false;
        if (record.userId && (isFinanceOrExcludedUser(record.userId) || isUnknownEmployeeOrUser(record.userId))) return false;

        const recordDate = getLocalDateKey(getAttendanceDate(record));
        return getAttendanceStatus(record) === "present" && (!recordDate || recordDate === todayKey);
      });

      setPresentRecords(todayPresent);
    } catch (error) {
      console.error("Error fetching absent attendance:", error);
      setAbsentRecords([]);

      try {
        const token = localStorage.getItem("token");
        const response = await fetch("https://kt-backend-yzr4.onrender.com/api/attendance/admin/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        let attendanceData = normalizeAttendanceRecords(data);

        const todayKey = getLocalDateKey(new Date());
        const filteredAttendance = attendanceData.filter((record) => {
          if (!record || isFinanceOrExcludedUser(record) || isUnknownEmployeeOrUser(record)) return false;
          if (record.user && (isFinanceOrExcludedUser(record.user) || isUnknownEmployeeOrUser(record.user))) return false;
          if (record.employee && (isFinanceOrExcludedUser(record.employee) || isUnknownEmployeeOrUser(record.employee))) return false;
          if (record.userId && (isFinanceOrExcludedUser(record.userId) || isUnknownEmployeeOrUser(record.userId))) return false;
          return true;
        });

        const absentOnly = filteredAttendance.filter((record) => {
          const recordDate = getLocalDateKey(getAttendanceDate(record));
          return getAttendanceStatus(record) === "absent" && (!recordDate || recordDate === todayKey);
        });

        const presentOnly = filteredAttendance.filter((record) => {
          const recordDate = getLocalDateKey(getAttendanceDate(record));
          return getAttendanceStatus(record) === "present" && (!recordDate || recordDate === todayKey);
        });

        setAbsentRecords(absentOnly);
        setPresentRecords(presentOnly);
      } catch (fallbackError) {
        console.error("Fallback absent attendance fetch failed:", fallbackError);
      }
    }
  }

  const openAbsentDetails = () => {
    const cardRect = absentCardRef.current?.getBoundingClientRect();
    const popupWidth = Math.min(360, window.innerWidth - 24);
    const isMobile = window.innerWidth < 640;

    setAbsentPosition({
      top: isMobile ? "50%" : (cardRect?.bottom || 0) + 8,
      left: isMobile
        ? "50%"
        : Math.min(
          Math.max(12, cardRect?.left || 12),
          window.innerWidth - popupWidth - 12
        ),
      width: popupWidth,
      transform: isMobile ? "translate(-50%, -50%)" : "none",
    });
    setShowAbsentModal(true);
  };

  const updateLeaveStatus = async (leaveId, status, remark = "") => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("https://kt-backend-yzr4.onrender.com/api/leave/admin/approve", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leaveId, status, remark, description: remark }),
      });
      const data = await response.json();
      if (data.success) fetchLeaves();
    } catch (error) {
      console.error(error);
    }
  };

  const confirmAction = async () => {
    if (!leaveRemark || !leaveRemark.trim()) {
      alert("Please enter a description / remark.");
      return;
    }
    await updateLeaveStatus(selectedLeave, selectedStatus, leaveRemark);
    setShowModal(false);
    setLeaveRemark("");
  };



  const formatHolidayDate = (dateValue) => {
    if (!dateValue) return "";
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    return parsedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const parseBirthdayDate = (dateValue) => {
    if (!dateValue) return null;

    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return dateValue;
    }

    const value = String(dateValue).trim();
    if (!value) return null;

    const isoMatch = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    }

    const ddmmyyyyMatch = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;

    return null;
  };

  const formatBirthdayDate = (dateValue) => {
    const parsedDate = parseBirthdayDate(dateValue);
    if (!parsedDate) return "";
    return parsedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const isBirthdayInCurrentMonth = (dateValue) => {
    const parsedDate = parseBirthdayDate(dateValue);
    if (!parsedDate) return false;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (parsedDate.getMonth() !== currentMonth) return false;

    const birthdayThisYear = new Date(currentYear, parsedDate.getMonth(), parsedDate.getDate());
    const today = new Date(currentYear, currentMonth, now.getDate());

    return birthdayThisYear.getTime() >= today.getTime();
  };

  const isHolidayUpcomingInCurrentMonth = (dateValue) => {
    const parsedDate = parseBirthdayDate(dateValue);
    if (!parsedDate) return false;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (parsedDate.getMonth() !== currentMonth || parsedDate.getFullYear() !== currentYear) {
      return false;
    }

    const holidayDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    const today = new Date(currentYear, currentMonth, now.getDate());

    return holidayDate.getTime() >= today.getTime();
  };

  const getAccentStyles = (accent) => {
    switch (accent) {
      case "amber":
        return {
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200/60",
          badgeBg: "bg-amber-50 text-amber-700 border border-amber-200/60",
        };
      case "purple":
        return {
          iconBg: "bg-purple-50 text-purple-600 border border-purple-200/60",
          badgeBg: "bg-purple-50 text-purple-700 border border-purple-200/60",
        };
      default:
        return {
          iconBg: "bg-indigo-50 text-indigo-600 border border-indigo-200/60",
          badgeBg: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
        };
    }
  };



  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {loading && (
        <div className="flex justify-center items-center py-16 sm:py-20">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
        </div>
      )}
      {!loading && (
        <>
          {confirmationDialog}
          {/* Unified Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 tracking-tight">
                Dashboard
              </h1>
            </div>
          </div>

          {/* Unified Stat Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Employees", value: dashboardCounts.employeeCount, accent: "border-l-indigo-600" },
              { label: "Total Projects", value: dashboardCounts.projectCount, accent: "border-l-amber-500" },
              { label: "Total Team Leads", value: dashboardCounts.teamLeadCount, accent: "border-l-purple-500" },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`bg-white border border-slate-200/80 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}

            {/* Absent Card */}
            <button
              type="button"
              ref={absentCardRef}
              onClick={openAbsentDetails}
              className="bg-white border-l-4 border-l-rose-500 rounded-xl p-4 transition-all shadow-xs text-left cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <p className="text-2xs font-semibold text-rose-600 uppercase tracking-wider mt-1">Absent Today</p>
                <p className="text-xl font-bold text-slate-900">{absentRecords.length}</p>
              </div>
            </button>
          </div>

          {/* Corporate Events & Celebrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-5 sm:gap-6">

            {/* Holidays */}
            <div className="flex flex-col h-full bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <UmbrellaIcon className="h-4 w-4 -rotate-12" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">Upcoming Holidays</h2>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    {upcomingHolidays.length}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center overflow-y-auto">
                {upcomingHolidays.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No upcoming holidays
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-1">
                    {upcomingHolidays.map((holiday) => {
                      const parts = (holiday.date || "").trim().split(" ");
                      const day = parts[0] || "";
                      const month = parts.slice(1).join(" ") || "";

                      return (
                        <div
                          key={holiday.id}
                          className="flex flex-col items-center text-center w-16 sm:w-20 shrink-0 group"
                        >
                          <div className="h-12 w-12 rounded-xl bg-emerald-100/70 border border-emerald-200/80 text-emerald-800 flex flex-col items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                            <span className="text-xs font-extrabold text-emerald-900 leading-none">
                              {day}
                            </span>
                            {month && (
                              <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider leading-none mt-0.5">
                                {month}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate w-full" title={holiday.name}>
                            {holiday.name}
                          </p>
                          <span className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                            Public
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Birthdays */}
            <div className="flex flex-col h-full bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    <Cake className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">Upcoming Birthdays</h2>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">
                    {birthdays.length}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center overflow-y-auto">
                {birthdays.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No birthdays this month
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-1">
                    {birthdays.map((person) => {
                      const initials = person.name
                        .trim()
                        .split(/\s+/)
                        .map((word) => word.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join("");

                      return (
                        <div
                          key={person.id}
                          className="flex flex-col items-center text-center w-16 sm:w-20 shrink-0 group"
                        >
                          <div className="h-12 w-12 rounded-xl bg-purple-100/70 border border-purple-200/80 text-purple-700 font-bold text-xs flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                            {initials}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate w-full" title={person.name}>
                            {person.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            {formatBirthdayDate(person.dob)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Present Today Grid */}
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Present Today</h2>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                {presentRecords.length} Active
              </span>
            </div>

            <div className="p-4 sm:p-5 max-h-[320px] overflow-y-auto">
              {presentRecords.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No present records logged today
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {presentRecords.map((record, index) => {
                    const displayName = record.employee?.name || record.employeeName || record.user?.name || record.name || "N/A";
                    const role = record.employee?.role || record.role || record.user?.role || "N/A";
                    const initials = displayName
                      .split(" ")
                      .map((word) => word.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join("");

                    return (
                      <div
                        key={record._id || record.id || index}
                        className="flex flex-col items-center p-2.5 rounded-lg bg-slate-50/60 border border-slate-100 hover:border-emerald-300 transition-all text-center"
                      >
                        <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials}
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-slate-800 truncate w-full">
                          {displayName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate w-full">{role}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>



          {/* Absent Drawer */}
          {showAbsentModal && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
              onClick={() => setShowAbsentModal(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="absent-today-title"
                onClick={(event) => event.stopPropagation()}
                style={absentPosition || { top: 12, left: 12, width: "calc(100vw - 24px)" }}
                className="fixed max-w-[360px] max-h-[70vh] rounded-xl bg-white shadow-xl border border-slate-200/90 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-rose-600" />
                    <h3 id="absent-today-title" className="text-xs font-semibold text-slate-900">
                      Absent Today
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAbsentModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3 max-h-[calc(70vh-53px)] overflow-y-auto">
                  {absentRecords.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No absent records today
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {absentRecords.map((record, index) => {
                        const displayName =
                          record.employee?.name ||
                          record.employeeName ||
                          record.user?.name ||
                          record.name ||
                          "N/A";

                        const role =
                          record.employee?.role ||
                          record.role ||
                          record.user?.role ||
                          "N/A";

                        const initials = displayName
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((word) => word.charAt(0).toUpperCase())
                          .slice(0, 2)
                          .join("");

                        return (
                          <div
                            key={record._id || record.id || index}
                            className="group flex flex-col items-center justify-center text-center p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-rose-50/40 hover:border-rose-200 transition-all"
                          >
                            {/* Initial Circle */}
                            <div className="h-11 w-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-bold border border-rose-200 shadow-xs">
                              {initials}
                            </div>

                            {/* Employee Name */}
                            <p
                              className="mt-2 text-xs font-semibold text-slate-800 truncate w-full"
                              title={displayName}
                            >
                              {displayName}
                            </p>

                            {/* Role */}
                            <p
                              className="mt-0.5 text-[10px] text-slate-400 truncate w-full"
                              title={role}
                            >
                              {role}
                            </p>

                            {/* Absent Badge */}
                            <span className="mt-2 px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200/60 rounded-md">
                              Absent
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl p-5 text-center shadow-xl border border-slate-200/90">
                <div
                  className={`mx-auto h-9 w-9 rounded-full flex items-center justify-center mb-3 ${selectedStatus === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                >
                  <AlertCircle className="h-5 w-5" />
                </div>

                <h3 className="text-sm font-semibold text-slate-900">Confirm Decision</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Set leave status to <span className="font-semibold text-slate-800 uppercase">{selectedStatus}</span>?
                </p>

                <div className="mt-3 text-left">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Description / Remark <span className="text-rose-500 font-bold">* (Required)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={leaveRemark}
                    onChange={(e) => setLeaveRemark(e.target.value)}
                    placeholder="Enter description or remark (Required)..."
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  {!leaveRemark?.trim() && (
                    <p className="text-[10px] text-rose-500 mt-1">
                      * Description is required before confirming.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setLeaveRemark("");
                    }}
                    className="flex-1 border border-slate-200 bg-white py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAction}
                    disabled={!leaveRemark?.trim()}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium text-white transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${selectedStatus === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                      }`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}


        </>
      )}
    </div>
  );
}