import React, { useEffect, useRef, useState } from "react";
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
  ChevronRight
} from "lucide-react";
import api from "../api/axios";
import { useConfirm } from "../components/common/ConfirmDialog";
import { showToast } from "../components/common/Toast";
import {
  isFinanceOrExcludedUser,
  filterOutFinanceUsers,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser
} from "../utils/roleFilters";

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
  const [absentPage, setAbsentPage] = useState(1);
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
    setAbsentPage(1);
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
      {loading && (
        <div className="flex justify-center items-center py-12 sm:py-16">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-[#005a7d]" />
        </div>
      )}
      {!loading && (
        <>
          {confirmationDialog}
          {/* Unified Page Header */}
          <div className="mb-1 sm:mb-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-poppins">
              Dashboard
            </h1>
          </div>

          {/* Top 4 Summary Cards matching exact Figma 2-card specification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
            {[
              { label: "TOTAL EMPLOYEES", value: dashboardCounts.employeeCount },
              { label: "TOTAL PROJECTS", value: dashboardCounts.projectCount },
              { label: "TOTAL TEAM LEADS", value: dashboardCounts.teamLeadCount },
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative flex items-center h-[80px] w-full"
              >
                {/* Left card for the border: width: 22; height: 80; border-top-left-radius: 10px; border-bottom-left-radius: 10px; */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[22px] h-[80px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                  style={{ background: "linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)", opacity: 1 }}
                />
                {/* Inner card: height: 80; border-radius: 10px; border-width: 0.2px; */}
                <div
                  className="relative z-10 ml-[11px] flex-1 h-[80px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                  style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
                >
                  <p className="text-[11px] sm:text-[12px] font-medium text-[#718096] tracking-wider uppercase font-poppins select-none">
                    {item.label}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}

            {/* Absent Today Card */}
            <button
              type="button"
              ref={absentCardRef}
              onClick={openAbsentDetails}
              className="relative flex items-center h-[80px] w-full text-left cursor-pointer transition-transform hover:scale-[1.01]"
            >
              {/* Left card for the border */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[22px] h-[80px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)", opacity: 1 }}
              />
              {/* Inner card */}
              <div
                className="relative z-10 ml-[11px] flex-1 h-[80px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow"
                style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
              >
                <p className="text-[11px] sm:text-[12px] font-medium text-[#718096] tracking-wider uppercase font-poppins select-none">
                  ABSENT TODAY
                </p>
                <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                  {absentRecords.length}
                </p>
              </div>
            </button>
          </div>

          {/* Corporate Events & Celebrations (Holidays & Birthdays) compact layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 font-poppins">
            {/* Holidays Card */}
            <div className="bg-white rounded-[10px] border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-3.5 sm:p-4" style={{ borderWidth: "0.2px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#edf4f8] flex items-center justify-center text-[#034665] shrink-0">
                    <Palmtree className="w-5 h-5 text-[#034665]" />
                  </div>
                  <h2 className="text-sm sm:text-[15px] font-semibold text-[#1e293b] font-poppins">Holidays</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#8e9aa8] font-poppins font-normal">
                  <span>upcoming</span>
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[10px] font-semibold text-[#0f172a] shadow-xs">
                    {upcomingHolidays.length}
                  </span>
                </div>
              </div>

              {/* Thin Divider Line */}
              <div className="border-b border-[#edf2f7] my-2.5 sm:my-3" />

              <div>
                {upcomingHolidays.length === 0 ? (
                  <div className="text-center py-4 text-[11px] text-slate-400 font-poppins">
                    No upcoming holidays
                  </div>
                ) : (
                  <div className="flex items-start gap-5 sm:gap-6 overflow-x-auto pb-1 pt-0.5">
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
                          className="flex flex-col items-center text-center shrink-0 w-20"
                        >
                          {/* Circular Date Badge with exact required vertical gradient */}
                          <div
                            className="w-10 h-10 rounded-full text-white flex flex-col items-center justify-center shadow-xs shrink-0"
                            style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                          >
                            <span className="text-xs sm:text-[13px] font-bold leading-tight font-poppins">
                              {day}
                            </span>
                            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5 font-poppins">
                              {month}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-[#034665] mt-1 font-poppins">
                            {dayName}
                          </span>
                          <span className="text-[11px] sm:text-xs font-semibold text-[#1e293b] truncate w-full mt-0.5 font-poppins" title={holiday.name}>
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
            <div className="bg-white rounded-[10px] border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-3.5 sm:p-4" style={{ borderWidth: "0.2px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#edf4f8] flex items-center justify-center text-[#034665] shrink-0">
                    <Cake className="w-5 h-5 text-[#034665]" />
                  </div>
                  <h2 className="text-sm sm:text-[15px] font-semibold text-[#1e293b] font-poppins">Birthdays</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#8e9aa8] font-poppins font-normal">
                  <span>upcoming</span>
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[10px] font-semibold text-[#0f172a] shadow-xs">
                    {birthdays.length}
                  </span>
                </div>
              </div>

              {/* Thin Divider Line */}
              <div className="border-b border-[#edf2f7] my-2.5 sm:my-3" />

              <div>
                {birthdays.length === 0 ? (
                  <div className="text-center py-4 text-[11px] text-slate-400 font-poppins">
                    No birthdays this month
                  </div>
                ) : (
                  <div className="flex items-start gap-5 sm:gap-6 overflow-x-auto pb-1 pt-0.5">
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
                          className="flex flex-col items-center text-center shrink-0 w-20"
                        >
                          {/* Circular Date Badge with exact required vertical gradient */}
                          <div
                            className="w-10 h-10 rounded-full text-white flex flex-col items-center justify-center shadow-xs shrink-0"
                            style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                          >
                            <span className="text-xs sm:text-[13px] font-bold leading-tight font-poppins">
                              {day}
                            </span>
                            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5 font-poppins">
                              {month}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-[#034665] mt-1 font-poppins">
                            {dayName}
                          </span>
                          <span className="text-[11px] sm:text-xs font-semibold text-[#1e293b] truncate w-full mt-0.5 font-poppins" title={person.name}>
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

          {/* Present Today Full-Width Card matching reference image (compact) */}
          <div className="bg-white rounded-[10px] border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-3.5 sm:p-4 font-poppins" style={{ borderWidth: "0.2px" }}>
            <div className="flex items-center justify-between mb-3 sm:mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#edf4f8] flex items-center justify-center text-[#034665] shrink-0">
                  <SquareUser className="w-5 h-5 text-[#034665]" />
                </div>
                <h2 className="text-sm sm:text-[15px] font-semibold text-[#1e293b] font-poppins">Present Today</h2>
              </div>
              <span
                className="text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs font-poppins"
                style={{ background: "linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)" }}
              >
                {presentRecords.length} Active
              </span>
            </div>

            <div className="overflow-x-auto pb-1">
              {presentRecords.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-slate-400 font-poppins">
                  No present records logged today
                </div>
              ) : (
                <div className="flex items-center gap-3 sm:gap-3.5 pt-0.5">
                  {presentRecords.map((record, index) => {
                    const displayName = record.employee?.name || record.employeeName || record.user?.name || record.name || "N/A";
                    const role = record.employee?.role || record.role || record.user?.role || record.employee?.designation?.name || "Team Lead";
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
                        className="bg-[#f4f7fa] border border-[#e8eff5] rounded-xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center w-28 sm:w-32 shrink-0 transition-transform hover:scale-[1.02] shadow-xs"
                      >
                        {/* Avatar Initial Circle with exact required vertical gradient */}
                        <div
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white flex items-center justify-center font-bold text-xs sm:text-[13px] shadow-xs font-poppins shrink-0"
                          style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                        >
                          {initials}
                        </div>
                        <p className="mt-2 text-xs font-bold text-[#1e293b] truncate w-full font-poppins" title={displayName}>
                          {displayName}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-[#8e9aa8] font-medium mt-0.5 truncate w-full font-poppins">
                          {role}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
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
                <div className="p-5">
                  {absentRecords.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400 font-poppins">
                      No absent records today
                    </div>
                  ) : (
                    <>
                      {/* 3 columns x 2 rows grid (6 per page) */}
                      <div className="grid grid-cols-3 gap-3">
                        {absentRecords
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
                                className="bg-white rounded-xl border border-[#81A2B2] p-3 flex flex-col items-center justify-center text-center shadow-xs transition-shadow hover:shadow-sm"
                              >
                                {/* Ocean Blue Circle with vertical gradient */}
                                <div
                                  className="w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm select-none shadow-xs shrink-0 font-poppins"
                                  style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                                >
                                  {initials}
                                </div>

                                {/* Employee Name */}
                                <p
                                  className="mt-2.5 text-xs sm:text-[13px] font-bold text-[#034665] truncate w-full text-center"
                                  title={displayName}
                                >
                                  {displayName}
                                </p>

                                {/* Designation / Role */}
                                <p
                                  className="mt-0.5 text-[11px] font-medium text-[#8ea2ad] truncate w-full text-center"
                                  title={role}
                                >
                                  {role}
                                </p>

                                {/* Absent Badge */}
                                <span className="mt-2 px-2.5 py-0.5 text-[10px] font-medium text-[#f98e8e] bg-white border border-[#fbcaca] rounded-[4px] select-none">
                                  Absent
                                </span>
                              </div>
                            );
                          })}
                      </div>

                      {/* Pagination chevrons matching Image 4 */}
                      <div className="flex items-center justify-center gap-4 mt-5">
                        <button
                          type="button"
                          onClick={() => setAbsentPage((prev) => Math.max(1, prev - 1))}
                          disabled={absentPage === 1}
                          className="w-8 h-8 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] flex items-center justify-center text-[#034665] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAbsentPage((prev) =>
                              Math.min(Math.max(1, Math.ceil(absentRecords.length / 6)), prev + 1)
                            )
                          }
                          disabled={absentPage >= Math.max(1, Math.ceil(absentRecords.length / 6))}
                          className="w-8 h-8 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] flex items-center justify-center text-[#034665] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Next Page"
                        >
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </>
                  )}
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