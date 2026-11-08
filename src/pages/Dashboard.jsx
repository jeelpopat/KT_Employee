import React, { useEffect, useRef, useState } from "react";
import { LoadingScreen, PageSkeleton } from "../components/common/Loader.jsx";
import { useNavigate } from "react-router-dom";
import {
  Users,
  FolderKanban,
  Briefcase,
  Cake,
  Palmtree,
  SquareUser,
  CheckCircle2,
  AlertCircle,
  X,
  UserX,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Calendar,
  Sparkles,
  RefreshCw,
  FileCheck2,
  Check,
  Building2,
  FileText,
  Search
} from "lucide-react";
import api from "../api/axios";
import { BASE_URL } from "../api/config";
import { useConfirm } from "../components/common/ConfirmDialog";
import { showToast } from "../components/common/Toast";
import { useApp } from "../context/AppContext.jsx";
import {
  isFinanceOrExcludedUser,
  filterOutFinanceUsers,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser,
  isTeamLeadRole
} from "../utils/roleFilters";

export default function Dashboard() {
  const { confirmationDialog } = useConfirm();
  const { user, userRole } = useApp();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [absentPage, setAbsentPage] = useState(1);
  const [absentSearch, setAbsentSearch] = useState("");
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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchUsers(),
      fetchProjects(),
      fetchTeamLeads(),
      fetchLeaves(),
      fetchHolidays(),
      fetchAbsentAttendance(),
    ]);
    setIsRefreshing(false);
  };

  const formatShortDate = (val) => {
    if (!val) return "-";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).slice(0, 10);
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  };

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
      const employeeResponse = await fetch(`${BASE_URL}/api/employee/list`);
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
      const usersResponse = await fetch(`${BASE_URL}/api/users/all`);
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
      let employeeList = [];
      try {
        const res = await fetch(`${BASE_URL}/api/users/all`, { headers });
        const d = await res.json();
        const list = d.users || d.data?.users || d.data?.employees || d.data || d.employees || d;
        userList = Array.isArray(list) ? list : [];
      } catch (e1) {
        try {
          const res = await fetch(`${BASE_URL}/api/user/all`, { headers });
          const d = await res.json();
          const list = d.users || d.data?.users || d.data?.employees || d.data || d.employees || d;
          userList = Array.isArray(list) ? list : [];
        } catch (e2) {
          try {
            const res = await fetch(`${BASE_URL}/api/users/all`);
            const d = await res.json();
            const list = d.users || d.data?.users || d.data?.employees || d.data || d.employees || d;
            userList = Array.isArray(list) ? list : [];
          } catch (e3) {
            console.warn("Could not fetch user/all or users/all for team leads:", e3);
          }
        }
      }

      try {
        const res = await fetch(`${BASE_URL}/api/employee/list`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = data.employees || data.data?.employees || data.employeesList ||
            data.data?.employeesList || data.data || data;
          employeeList = Array.isArray(list) ? list : [];
        }
      } catch (error) {
        console.warn("Could not fetch employee records for team lead roles:", error);
      }

      const normalizeId = (value) => String(value?._id || value?.id || value?.userId || value?.userID || value || '').trim().toLowerCase();
      const findEmployee = (user) => {
        const userIds = [user?._id, user?.id, user?.userId, user?.userID, user?.employeeID, user?.employeeId]
          .map(normalizeId)
          .filter(Boolean);
        const userEmail = String(user?.email || '').trim().toLowerCase();

        return employeeList.find((employee) => {
          const employeeIds = [
            employee?._id,
            employee?.id,
            employee?.userID,
            employee?.userId,
            employee?.employeeID,
            employee?.employeeId,
          ].map(normalizeId).filter(Boolean);
          const employeeEmail = String(employee?.email || employee?.userID?.email || employee?.userId?.email || '')
            .trim()
            .toLowerCase();
          return userIds.some((id) => employeeIds.includes(id)) ||
            Boolean(userEmail && employeeEmail && userEmail === employeeEmail);
        });
      };

      const teamLeadsFromUsers = (Array.isArray(userList) ? userList : [])
        .filter((user) => {
          const employee = findEmployee(user);
          const member = { ...employee, ...user };
          const name = member.name || member.fullName ||
            [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
          const email = member.email || "";
          return isTeamLeadRole(user, employee) &&
            !isFinanceOrExcludedUser(member) &&
            !isUnknownEmployeeOrUser({ ...member, name }) &&
            Boolean(email && email !== "N/A" && email.includes("@"));
        });
      let finalCount = new Set(teamLeadsFromUsers.map((user) =>
        normalizeId(user._id || user.id || user.email || user.employeeID || user.employeeId)
      ).filter(Boolean)).size;

      // If users API had 0 team leads, fallback to teamLead/team
      if (finalCount === 0) {
        try {
          const response = await fetch(`${BASE_URL}/api/teamLead/team`, {
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
          const res = await fetch(`${BASE_URL}/api/projectManage/project/all`, { headers });
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
      const response = await fetch(`${BASE_URL}/api/leave/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      let leaveArray = Array.isArray(data) ? data : data.leaves || data.data || [];

      const validLeaves = leaveArray.filter((leave) => {
        if (!leave || isUnknownEmployeeOrUser(leave)) return false;
        if (isFinanceOrExcludedUser(leave)) return false;
        if (leave.employeeId && (isFinanceOrExcludedUser(leave.employeeId) || isUnknownEmployeeOrUser(leave.employeeId))) return false;
        return true;
      });
      setLeaves(validLeaves);
    } catch (error) {
      console.error(error);
    }
  }
  async function fetchHolidays() {
    try {
      const response = await fetch(
        `${BASE_URL}/api/holiday/current-month`
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
        .map((holiday) => {
          const targetDate = holiday.holidayDate || holiday.date;
          return {
            id: holiday._id || holiday.id,

            name:
              holiday.holidayName ||
              holiday.name ||
              "Holiday",

            date: formatHolidayDate(targetDate),
            rawDate: targetDate,
            day: holiday.day || null,

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
          };
        })
        .sort((a, b) => {
          const aDate = parseBirthdayDate(a.rawDate || a.date);
          const bDate = parseBirthdayDate(b.rawDate || b.date);
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
        `${BASE_URL}/api/attendance/absent/all?_t=${Date.now()}`,
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
      const attendanceResponse = await fetch(`${BASE_URL}/api/attendance/admin/all?_t=${Date.now()}`, {
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
        const response = await fetch(`${BASE_URL}/api/attendance/admin/all`, {
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
    setAbsentSearch("");
    setAbsentPage(1);
    setShowAbsentModal(true);
  };

  const handleLeaveStatusClick = (leaveId, status) => {
    setSelectedLeave(leaveId);
    setSelectedStatus(status);
    setLeaveRemark("");
    setShowModal(true);
  };

  const updateLeaveStatus = async (leaveId, status, remark = "") => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/leave/admin/approve`, {
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
      showToast("Please enter a description / remark.", "error");
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
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-4.5 font-poppins">
      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {confirmationDialog}
          {/* Executive Portal Header Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 sm:p-6 text-white shadow-lg">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md text-white border border-white/20 tracking-wide uppercase">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    {userRole === 'hr' ? 'HR Management Portal' : 'Executive Administration'}
                  </span>
                  <span className="text-[11px] text-white/75">
                    • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Welcome back, {user?.name || (userRole === 'hr' ? 'HR Director' : 'Administrator')}
                </h1>
                <p className="text-xs sm:text-sm text-cyan-100/90 mt-0.5 max-w-xl">
                  {userRole === 'hr'
                    ? 'Oversee workforce attendance, leave approvals, and employee records in real-time.'
                    : 'System-wide overview of organizational performance, team leads, and live attendance.'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-xs font-semibold text-white border border-white/25 backdrop-blur-md transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Refresh Live Dashboard Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/attendance/employees')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#034665] hover:bg-cyan-50 active:scale-95 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  <Users className="w-3.5 h-3.5 text-[#034665]" />
                  <span>Employees</span>
                </button>
              </div>
            </div>
          </div>

          {/* Top 4 Modern Enterprise KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
            {/* Total Employees */}
            <div
              onClick={() => navigate('/attendance/employees')}
              className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#034665] to-[#068DCB] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Employees
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {dashboardCounts.employeeCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="text-emerald-600 font-semibold">Active roster</span> in system
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-[#edf4f8] text-[#034665] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Users className="w-5 h-5 text-[#034665]" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#068DCB]">
                <span>View directory</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>

            {/* Total Projects */}
            <div
              onClick={() => navigate('/projects')}
              className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#068DCB] to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Active Projects
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {dashboardCounts.projectCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="text-cyan-600 font-semibold">Organizational</span> pipelines
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <FolderKanban className="w-5 h-5 text-cyan-600" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#068DCB]">
                <span>Manage projects</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>

            {/* Total Team Leads */}
            <div
              onClick={() => navigate('/team-lead')}
              className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Team Leaders
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {dashboardCounts.teamLeadCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="text-indigo-600 font-semibold">Supervisors</span> & leads
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
                <span>View team leads</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>

            {/* Absent Today */}
            <div
              ref={absentCardRef}
              onClick={openAbsentDetails}
              className="group relative bg-white rounded-2xl border border-rose-200/70 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Absent Today
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-1 tracking-tight">
                    {absentRecords.length}
                  </h3>
                  <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                    Click to inspect list
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <UserX className="w-5 h-5 text-rose-600" />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-rose-600">
                <span>View absentees</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Present Today Live Workforce Ribbon */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 font-poppins">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#edf4f8] flex items-center justify-center text-[#034665] shrink-0">
                  <SquareUser className="w-5 h-5 text-[#034665]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    Present Today
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Attendance
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Employees clocked in and actively working today
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {dashboardCounts.employeeCount > 0 && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    {Math.round((presentRecords.length / Math.max(dashboardCounts.employeeCount, 1)) * 100)}% Turnout
                  </span>
                )}
                <span
                  className="text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs font-poppins"
                  style={{ background: "linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)" }}
                >
                  {presentRecords.length} Active
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pb-2 custom-scrollbar">
              {presentRecords.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-poppins bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No present records logged today yet.
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-0.5">
                  {presentRecords.map((record, index) => {
                    const displayName = record.employee?.name || record.employeeName || record.user?.name || record.name || "N/A";
                    const role = record.employee?.role || record.role || record.user?.role || record.employee?.designation?.name || "Team Member";
                    const initials = displayName
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((word) => word.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join("") || "EM";

                    return (
                      <div
                        key={record._id || record.id || index}
                        className="bg-slate-50/80 hover:bg-white border border-slate-200/70 hover:border-[#068DCB]/40 rounded-xl p-3 flex flex-col items-center justify-center text-center w-32 shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <div
                          className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs font-poppins shrink-0"
                          style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                        >
                          {initials}
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-900 truncate w-full" title={displayName}>
                          {displayName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate w-full">
                          {role}
                        </p>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                          Present
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pending Leave Requests / HR Quick Approvals */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 font-poppins">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <FileCheck2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    Pending Leave Requests
                    {leaves.filter(l => (l.status || l.adminStatus || '').toLowerCase() === 'pending' || (userRole === 'hr' && (l.hrStatus || '').toLowerCase() === 'pending')).length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {leaves.filter(l => (l.status || l.adminStatus || '').toLowerCase() === 'pending' || (userRole === 'hr' && (l.hrStatus || '').toLowerCase() === 'pending')).length} Pending
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Review and authorize employee leave applications requiring administrative approval
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/leaves')}
                className="text-xs font-semibold text-[#068DCB] hover:text-[#034665] flex items-center gap-1 self-start sm:self-center transition-colors"
              >
                <span>View all leave requests</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {leaves.filter(l => (l.status || l.adminStatus || '').toLowerCase() === 'pending' || (userRole === 'hr' && (l.hrStatus || '').toLowerCase() === 'pending')).length === 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">All leave requests are up to date</p>
                    <p className="text-[11px] text-slate-500">There are no outstanding leave requests requiring action at this moment.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/leaves')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shrink-0 shadow-xs"
                >
                  Leave History
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {leaves
                  .filter(l => (l.status || l.adminStatus || '').toLowerCase() === 'pending' || (userRole === 'hr' && (l.hrStatus || '').toLowerCase() === 'pending'))
                  .slice(0, 4)
                  .map((leave) => {
                    const empName = leave.employeeName || leave.employee?.name || leave.user?.name || leave.name || "Employee";
                    const leaveType = leave.leaveType || leave.type || "Casual Leave";
                    const startDate = leave.startDate ? formatShortDate(leave.startDate) : "-";
                    const endDate = leave.endDate ? formatShortDate(leave.endDate) : startDate;
                    const reason = leave.reason || leave.description || "Personal reason";

                    return (
                      <div
                        key={leave._id || leave.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors shadow-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {empName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">{empName}</h4>
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                                {leaveType}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{startDate === endDate ? startDate : `${startDate} → ${endDate}`}</span>
                              <span className="text-slate-300">•</span>
                              <span className="truncate max-w-xs text-slate-600 italic">"{reason}"</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLeaveStatusClick(leave._id || leave.id, "approved")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeaveStatusClick(leave._id || leave.id, "rejected")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Corporate Events & Celebrations (Holidays & Birthdays) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 font-poppins">
            {/* Holidays Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Palmtree className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">Upcoming Holidays</h2>
                    <p className="text-[11px] text-slate-500">Official company recognized days off</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg">
                  {upcomingHolidays.length} Upcoming
                </span>
              </div>

              <div>
                {upcomingHolidays.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-poppins bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    No upcoming holidays scheduled this month.
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-1 pt-1 custom-scrollbar">
                    {upcomingHolidays.map((holiday) => {
                      const parsedDate = parseBirthdayDate(holiday.rawDate || holiday.date);
                      const day = parsedDate ? parsedDate.getDate() : ((holiday.date || "").trim().split(" ")[0] || "14");
                      const month = parsedDate
                        ? parsedDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
                        : (((holiday.date || "").trim().split(" ").slice(1).join(" ") || "JAN").substring(0, 3).toUpperCase());
                      const dayName = holiday.day || (parsedDate ? parsedDate.toLocaleDateString("en-US", { weekday: "long" }) : "Saturday");

                      return (
                        <div
                          key={holiday.id}
                          className="flex flex-col items-center text-center shrink-0 w-24 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <div
                            className="w-11 h-11 rounded-full text-white flex flex-col items-center justify-center shadow-xs shrink-0"
                            style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                          >
                            <span className="text-xs sm:text-[13px] font-bold leading-tight font-poppins">
                              {day}
                            </span>
                            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5 font-poppins">
                              {month}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#034665] mt-1.5 font-poppins">
                            {dayName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800 truncate w-full mt-0.5 font-poppins" title={holiday.name}>
                            {holiday.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Birthdays Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Cake className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">Upcoming Birthdays</h2>
                    <p className="text-[11px] text-slate-500">Employee celebrations this month</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-lg">
                  {birthdays.length} This Month
                </span>
              </div>

              <div>
                {birthdays.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-poppins bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    No birthdays scheduled this month.
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-1 pt-1 custom-scrollbar">
                    {birthdays.map((person) => {
                      const bDate = person.dob ? parseBirthdayDate(person.dob) : null;
                      const day = bDate ? bDate.getDate() : "14";
                      const month = bDate ? bDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "JAN";
                      const currentYear = new Date().getFullYear();
                      const thisYearBday = bDate ? new Date(currentYear, bDate.getMonth(), bDate.getDate()) : null;
                      const dayName = thisYearBday ? thisYearBday.toLocaleDateString("en-US", { weekday: "long" }) : "Saturday";

                      return (
                        <div
                          key={person.id}
                          className="flex flex-col items-center text-center shrink-0 w-24 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <div
                            className="w-11 h-11 rounded-full text-white flex flex-col items-center justify-center shadow-xs shrink-0"
                            style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                          >
                            <span className="text-xs sm:text-[13px] font-bold leading-tight font-poppins">
                              {day}
                            </span>
                            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5 font-poppins">
                              {month}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#034665] mt-1.5 font-poppins">
                            {dayName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800 truncate w-full mt-0.5 font-poppins" title={person.name}>
                            {person.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>



          {/* Absent Today Modal matching Image 4 */}
          {showAbsentModal && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-poppins"
              onClick={() => setShowAbsentModal(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="absent-today-title"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden font-poppins animate-scale-in"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 text-[#034665]">
                    <UserPlus className="h-5 w-5 text-[#034665]" strokeWidth={2} />
                    <h3 id="absent-today-title" className="text-base sm:text-lg font-bold text-[#034665]">
                      Absent Today
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAbsentModal(false)}
                    className="text-[#034665] hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-5">
                  {/* Search absent employee */}
                  <div className="relative mb-3.5">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={absentSearch}
                      onChange={(e) => {
                        setAbsentSearch(e.target.value);
                        setAbsentPage(1);
                      }}
                      placeholder="Search absent employee or role..."
                      className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:bg-white transition-all font-poppins"
                    />
                    {absentSearch && (
                      <button
                        type="button"
                        onClick={() => setAbsentSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {(() => {
                    const filtered = absentRecords.filter((record) => {
                      if (!absentSearch.trim()) return true;
                      const q = absentSearch.toLowerCase();
                      const displayName = record.employee?.name || record.employeeName || record.user?.name || record.name || "";
                      const rawRole = record.employee?.designation?.name || record.employee?.role || record.role || record.user?.role || "";
                      return displayName.toLowerCase().includes(q) || rawRole.toLowerCase().includes(q);
                    });

                    const totalPages = Math.max(1, Math.ceil(filtered.length / 6));

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-8 text-xs text-slate-400 font-poppins bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          {absentSearch ? "No employees match your search" : "No absent records today"}
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Responsive grid: 2 cols on mobile, 3 cols on tablet/desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                          {filtered
                            .slice((absentPage - 1) * 6, absentPage * 6)
                            .map((record, index) => {
                              const displayName =
                                record.employee?.name ||
                                record.employeeName ||
                                record.user?.name ||
                                record.name ||
                                "N/A";

                              const rawRole =
                                record.employee?.designation?.name ||
                                record.employee?.role ||
                                record.role ||
                                record.user?.role ||
                                "Employee";

                              const roleCleaned = String(rawRole).replace(/[-_]/g, " ").trim();
                              const role =
                                roleCleaned.toLowerCase() === "team lead" || roleCleaned.toLowerCase() === "teamlead"
                                  ? "Team lead"
                                  : roleCleaned.charAt(0).toUpperCase() + roleCleaned.slice(1).toLowerCase();

                              const initials = displayName
                                .trim()
                                .split(/\s+/)
                                .filter(Boolean)
                                .map((word) => word.charAt(0).toUpperCase())
                                .slice(0, 2)
                                .join("") || "EM";

                              return (
                                <div
                                  key={record._id || record.id || index}
                                  className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center text-center shadow-xs transition-shadow hover:shadow-sm"
                                >
                                  {/* Ocean Blue Circle with vertical gradient */}
                                  <div
                                    className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-xs select-none shadow-xs shrink-0 font-poppins"
                                    style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                                  >
                                    {initials}
                                  </div>

                                  {/* Employee Name */}
                                  <p
                                    className="mt-2 text-xs font-bold text-[#034665] truncate w-full text-center font-poppins"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </p>

                                  {/* Designation / Role */}
                                  <p
                                    className="mt-0.5 text-[10px] font-medium text-slate-400 truncate w-full text-center font-poppins"
                                    title={role}
                                  >
                                    {role}
                                  </p>

                                  {/* Absent Badge */}
                                  <span className="mt-1.5 px-2 py-0.5 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full select-none">
                                    Absent
                                  </span>
                                </div>
                              );
                            })}
                        </div>

                        {/* Pagination chevrons matching Image 4 */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                          <p className="text-[11px] text-slate-400 font-medium font-poppins">
                            Page {absentPage} of {totalPages} ({filtered.length} total)
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAbsentPage((prev) => Math.max(1, prev - 1))}
                              disabled={absentPage === 1}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#034665] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              aria-label="Previous Page"
                            >
                              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAbsentPage((prev) => Math.min(totalPages, prev + 1))}
                              disabled={absentPage >= totalPages}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#034665] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              aria-label="Next Page"
                            >
                              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-poppins">
              <div className="bg-white w-full max-w-sm rounded-xl p-5 text-center shadow-xl border border-slate-200/90 font-poppins">
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