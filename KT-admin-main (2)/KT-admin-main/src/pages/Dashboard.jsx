import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Briefcase,
  Calendar,
  Clock,
  Cake,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  UserX,
  ChevronRight,
  Bell,
  Plus,
  Edit3,
  Trash2,
  CheckCheck,
  FileText,
  Activity,
  UserPlus,
  ExternalLink
} from "lucide-react";
import { useConfirm } from "../components/common/ConfirmDialog";
import { isFinanceOrExcludedUser, filterOutFinanceUsers } from "../utils/roleFilters";

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
  const navigate = useNavigate();
  const { confirm, confirmationDialog } = useConfirm();
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
      name: "Total Team Leads",
      value: 0,
      icon: Briefcase,
      badge: "Management",
      accent: "purple",
    },
    {
      id: 3,
      name: "Total Projects",
      value: 0,
      icon: Briefcase,
      badge: "Active",
      accent: "emerald",
    },
  ]);


  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
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
  const [announcements, setAnnouncements] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationTab, setNotificationTab] = useState("unread"); // "unread" | "all" | "read" | "requests" | "announcements"
  const [showAllAnnouncementsModal, setShowAllAnnouncementsModal] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const notificationButtonRef = useRef(null);
  const [notificationPosition, setNotificationPosition] = useState(null);
  const absentCardRef = useRef(null);
  const [absentPosition, setAbsentPosition] = useState(null);
  // Announcement form state
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    message: "",
    type: "ANNOUNCEMENT"
  });
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

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
        fetchNotificationsFeed(),
      ]);
      setLoading(false);
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    const openAnnouncement = () => {
      setAnnouncementForm({ title: "", message: "", type: "ANNOUNCEMENT" });
      setEditingAnnouncementId(null);
      setShowAnnouncementModal(true);
    };

    window.addEventListener("open-announcement", openAnnouncement);
    return () => window.removeEventListener("open-announcement", openAnnouncement);
  }, []);

  useEffect(() => {
    const openNotifications = () => {
      setNotificationPosition({
        top: 64,
        left: 12,
        width: Math.min(320, window.innerWidth - 24),
      });
      setShowBellDropdown(true);
    };

    window.addEventListener("open-notifications", openNotifications);
    return () => window.removeEventListener("open-notifications", openNotifications);
  }, []);

  useEffect(() => {
    if (!isAutoAbsentTimeReached()) return;

    fetchAbsentAttendance();

    const intervalId = setInterval(() => {
      if (isAutoAbsentTimeReached()) {
        fetchAbsentAttendance();
      }
    }, 60000);

    return () => clearInterval(intervalId);
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
        icon: Briefcase,
        badge: "Active",
        accent: "emerald",
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

      const filteredEmployees = filterOutFinanceUsers(employees);
      const employeeCount = filteredEmployees.length;

      // Fetch users for birthdays
      const usersResponse = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all");
      const usersData = await usersResponse.json();
      const users = usersData.users || usersData.data || [];
      const filteredUsers = filterOutFinanceUsers(users);

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
      const token = localStorage.getItem("token");
      const response = await fetch("https://kt-backend-yzr4.onrender.com/api/teamLead/team", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const teamLeads = data.teamLeads || data.data || data.teamlead || data.teams || [];
      const filteredTeamLeads = filterOutFinanceUsers(Array.isArray(teamLeads) ? teamLeads : []);

      setDashboardCounts((prev) => ({
        ...prev,
        teamLeadCount: filteredTeamLeads.length,
      }));
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchProjects() {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("https://kt-backend-yzr4.onrender.com/api/projectManage/project/all", { headers });
      const data = await res.json();
      const projectList = data?.data || data?.projects || (Array.isArray(data) ? data : []);
      setDashboardCounts((prev) => ({
        ...prev,
        projectCount: Array.isArray(projectList) ? projectList.length : 0,
      }));
    } catch (err) {
      console.warn("Could not fetch projects:", err);
    }
  }

  async function fetchLeaves() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("https://kt-backend-yzr4.onrender.com/api/leave/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      let leaveArray = Array.isArray(data) ? data : data.leaves || data.data || [];

      const hrApprovedLeaves = leaveArray.filter((leave) => {
        if (!leave) return false;
        if (isFinanceOrExcludedUser(leave)) return false;
        if (leave.employeeId && isFinanceOrExcludedUser(leave.employeeId)) return false;
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
        "https://kt-backend-yzr4.onrender.com/api/attendance/absent/all",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!absentResponse.ok) {
        throw new Error(`Absent attendance fetch failed: ${absentResponse.status}`);
      }

      const absentData = await absentResponse.json();
      const absentRecordsList = normalizeAttendanceRecords(absentData);

      const normalizedAbsent = absentRecordsList
        .filter((record) => {
          if (!record) return false;
          if (isFinanceOrExcludedUser(record)) return false;
          if (record.user && isFinanceOrExcludedUser(record.user)) return false;
          if (record.employee && isFinanceOrExcludedUser(record.employee)) return false;
          if (record.userId && isFinanceOrExcludedUser(record.userId)) return false;
          return true;
        })
        .map((record, index) => ({
          ...record,
          _id: record._id || record.id || `absent-${index}`,
          employeeName: record.employeeName || record.name || record.user?.name || record.employee?.name || "N/A",
          role: record.role || record.user?.role || record.employee?.role || "N/A",
        }));

      setAbsentRecords(normalizedAbsent);

      // Fetch present records
      const attendanceResponse = await fetch("https://kt-backend-yzr4.onrender.com/api/attendance/admin/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const attendanceData = await attendanceResponse.json();
      const attendanceList = normalizeAttendanceRecords(attendanceData);

      const todayKey = getLocalDateKey(new Date());
      const todayPresent = attendanceList.filter((record) => {
        if (!record) return false;
        if (isFinanceOrExcludedUser(record)) return false;
        if (record.user && isFinanceOrExcludedUser(record.user)) return false;
        if (record.employee && isFinanceOrExcludedUser(record.employee)) return false;
        if (record.userId && isFinanceOrExcludedUser(record.userId)) return false;

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
          if (!record) return false;
          if (isFinanceOrExcludedUser(record)) return false;
          if (record.user && isFinanceOrExcludedUser(record.user)) return false;
          if (record.employee && isFinanceOrExcludedUser(record.employee)) return false;
          if (record.userId && isFinanceOrExcludedUser(record.userId)) return false;
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

  const fetchNotificationsFeed = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const readIds = new Set(JSON.parse(localStorage.getItem("adminReadNotifications") || "[]"));

      let unifiedList = [];

      // 1. Try unified backend endpoint first
      let backendSucceeded = false;
      try {
        const response = await fetch("https://kt-backend-yzr4.onrender.com/api/notification/admin/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            unifiedList = data.data;
            backendSucceeded = true;
            if (data.announcements && Array.isArray(data.announcements)) {
              setAnnouncements(data.announcements);
            }
          }
        }
      } catch (e) {
        // fallback to client aggregation
      }

      // 2. Client-side aggregation if backend admin feed didn't return items
      if (!backendSucceeded) {
        // Fetch announcements
        let announcementsList = [];
        try {
          const annRes = await fetch("https://kt-backend-yzr4.onrender.com/api/notification/announcement/all", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const annData = await annRes.json();
          if (Array.isArray(annData)) {
            announcementsList = annData;
          } else if (annData.data && Array.isArray(annData.data)) {
            announcementsList = annData.data;
          } else if (annData.announcements && Array.isArray(annData.announcements)) {
            announcementsList = annData.announcements;
          }
        } catch (e) {
          console.error("Announcement fetch error:", e);
        }

        const sortedAnn = announcementsList
          .filter((item) => item && (item.title || item.message))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        setAnnouncements(sortedAnn);

        // Add announcements to unified list
        sortedAnn.forEach((ann) => {
          const id = ann._id || ann.id;
          unifiedList.push({
            _id: id,
            id: id,
            title: ann.title || "Announcement",
            message: ann.message || "",
            type: ann.type || "ANNOUNCEMENT",
            category: "announcement",
            isRead: readIds.has(id),
            createdAt: ann.createdAt || new Date(),
          });
        });

        // Fetch pending leaves
        try {
          const leaveRes = await fetch("https://kt-backend-yzr4.onrender.com/api/leave/all", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const leaveData = await leaveRes.json();
          const leaveList = Array.isArray(leaveData) ? leaveData : leaveData.data || [];
          const pendingLeaves = leaveList.filter((l) => (l.status || "").toLowerCase().includes("pending"));
          pendingLeaves.forEach((l) => {
            const id = `leave_${l._id || l.id}`;
            const applicantName = l.employeeName || l.employeeId?.name || "Employee";
            unifiedList.push({
              _id: id,
              id: id,
              title: "New Leave Application",
              message: `${applicantName} applied for ${l.leaveType || "Leave"} (${l.totalDays || 1} day(s))`,
              type: "LEAVE_REQUEST",
              category: "request",
              isRead: readIds.has(id),
              createdAt: l.createdAt || l.startDate || new Date(),
              link: "/attendance/leave-request",
            });
          });
        } catch (e) {
          // ignore
        }

        // Fetch upcoming holidays
        try {
          const holRes = await fetch("https://kt-backend-yzr4.onrender.com/api/holiday/current-month");
          if (holRes.ok) {
            const holData = await holRes.json();
            const holList = Array.isArray(holData)
              ? holData
              : holData.data || holData.holidays || holData.currentMonthHolidays || [];
            holList.forEach((h) => {
              const id = `holiday_${h._id || h.id || h.holidayName}`;
              unifiedList.push({
                _id: id,
                id: id,
                title: `Upcoming Holiday: ${h.holidayName || h.name || "Holiday"}`,
                message: `Office Holiday on ${h.holidayDate ? new Date(h.holidayDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "this month"}`,
                type: "HOLIDAY",
                category: "announcement",
                isRead: readIds.has(id),
                createdAt: h.createdAt || new Date(),
                link: "/attendance/holidays",
              });
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // Apply read status from local storage
      const listWithReadStatus = unifiedList.map((item) => {
        const itemId = item.id || item._id;
        return {
          ...item,
          isRead: item.isRead || readIds.has(itemId),
        };
      });

      // Sort descending
      listWithReadStatus.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setAdminNotifications(listWithReadStatus);
      const unread = listWithReadStatus.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Error in fetchNotificationsFeed:", error);
    }
  }, []);

  // Live Real-Time Auto Refresh for Notifications (every 20s & on window focus)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotificationsFeed();
    }, 20000);

    const onFocus = () => {
      fetchNotificationsFeed();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotificationsFeed]);

  const fetchAnnouncements = fetchNotificationsFeed;

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const readIds = new Set(JSON.parse(localStorage.getItem("adminReadNotifications") || "[]"));
      if (id) readIds.add(id);
      localStorage.setItem("adminReadNotifications", JSON.stringify(Array.from(readIds)));

      const token = localStorage.getItem("token");
      if (token && id && !id.startsWith("leave_") && !id.startsWith("holiday_")) {
        fetch(`https://kt-backend-yzr4.onrender.com/api/notification/read/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { });
      }
      setAdminNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const allIds = adminNotifications.map((n) => n.id || n._id);
      localStorage.setItem("adminReadNotifications", JSON.stringify(allIds));

      const token = localStorage.getItem("token");
      if (token) {
        fetch("https://kt-backend-yzr4.onrender.com/api/notification/read-all", {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { });
      }
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleNotificationClick = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id || item._id);
    }
    setShowBellDropdown(false);
    if (item.link) {
      navigate(item.link);
    }
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

  const handleAnnouncementSubmit = async () => {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      alert("Please fill both title and message before posting.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = {
        title: announcementForm.title.trim(),
        message: announcementForm.message.trim(),
        type: announcementForm.type || "ANNOUNCEMENT",
      };

      const endpoint = editingAnnouncementId
        ? `https://kt-backend-yzr4.onrender.com/api/notification/announcement/${editingAnnouncementId}`
        : "https://kt-backend-yzr4.onrender.com/api/notification/announcement/create";
      const method = editingAnnouncementId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      const success = response.ok && (data?.success || data?.message || data?.data);
      if (success) {
        setAnnouncementForm({
          title: "",
          message: "",
          type: "ANNOUNCEMENT",
        });
        setEditingAnnouncementId(null);
        setShowAnnouncementModal(false);
        await fetchNotificationsFeed();
      } else {
        alert(data?.message || "Failed to save announcement. Please try again.");
      }
    } catch (error) {
      console.error("Error posting announcement:", error);
    }
  };

  const handleAnnouncementEdit = (announcement) => {
    setAnnouncementForm({
      title: announcement.title || "",
      message: announcement.message || "",
      type: announcement.type || "ANNOUNCEMENT",
    });
    setEditingAnnouncementId(announcement._id || announcement.id || null);
    setShowAnnouncementModal(true);
  };

  const handleAnnouncementDelete = async (announcementId) => {
    const confirmed = await confirm({
      title: "Delete announcement?",
      message: "Are you sure you want to delete this announcement?",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/notification/announcement/${announcementId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await fetchNotificationsFeed();
      }
    } catch (error) {
      console.error("Error deleting announcement:", error);
    }
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

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;

    return null;
  };

  const formatBirthdayDate = (dateValue) => {
    const parsedDate = parseBirthdayDate(dateValue);
    if (!parsedDate) return dateValue || "";
    const dayMonth = parsedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const year = parsedDate.getFullYear();
    if (year && year > 1900 && year < new Date().getFullYear()) {
      return `${dayMonth} ${year}`;
    }
    return dayMonth;
  };

  const formatAnnouncementDate = (dateValue) => {
    if (!dateValue) return "";
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    return parsedDate.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  const toggleNotifications = () => {
    if (!showBellDropdown && notificationButtonRef.current) {
      const buttonRect = notificationButtonRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(380, window.innerWidth - 24);
      const isMobile = window.innerWidth < 640;
      setNotificationPosition({
        top: buttonRect.bottom + 8,
        left: isMobile
          ? 12
          : Math.max(12, buttonRect.right - dropdownWidth),
        width: dropdownWidth,
      });
    }
    setShowBellDropdown((visible) => !visible);
  };

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

  // Filter notifications based on selected tab
  const unreadList = adminNotifications.filter((n) => !n.isRead);
  const readList = adminNotifications.filter((n) => n.isRead);
  const requestsCount = adminNotifications.filter((n) => n.category === "request").length;
  const announcementsCount = adminNotifications.filter(
    (n) => n.category === "announcement" || n.type === "ANNOUNCEMENT" || n.type === "HOLIDAY"
  ).length;

  const filteredNotifications = adminNotifications.filter((n) => {
    if (notificationTab === "unread") return !n.isRead;
    if (notificationTab === "read") return n.isRead;
    if (notificationTab === "requests") return n.category === "request";
    if (notificationTab === "announcements") return n.category === "announcement" || n.type === "ANNOUNCEMENT" || n.type === "HOLIDAY";
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case "LEAVE_REQUEST":
        return <Calendar className="h-4 w-4 text-amber-600" />;
      case "CHECKIN_REQUEST":
        return <Clock className="h-4 w-4 text-indigo-600" />;
      case "ADJUSTMENT_REQUEST":
        return <AlertCircle className="h-4 w-4 text-purple-600" />;
      case "ANNOUNCEMENT":
        return <Bell className="h-4 w-4 text-emerald-600" />;
      case "HOLIDAY":
        return <Calendar className="h-4 w-4 text-rose-600" />;
      default:
        return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const getNotificationBg = (type) => {
    switch (type) {
      case "LEAVE_REQUEST":
        return "bg-amber-50 border-amber-200/70";
      case "CHECKIN_REQUEST":
        return "bg-indigo-50 border-indigo-200/70";
      case "ADJUSTMENT_REQUEST":
        return "bg-purple-50 border-purple-200/70";
      case "ANNOUNCEMENT":
        return "bg-emerald-50 border-emerald-200/70";
      case "HOLIDAY":
        return "bg-rose-50 border-rose-200/70";
      default:
        return "bg-blue-50 border-blue-200/70";
    }
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex justify-center items-center py-16 sm:py-20">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
        </div>
      )}
      {!loading && (
        <>
          {confirmationDialog}
          {/* Minimal Compact Header */}
          <div className="bg-transparent p-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs text-slate-400">Overview of organization metrics & daily status</p>
            </div>

            <div className="hidden items-center gap-2 shrink-0 sm:flex">
              {/* Exact Bell Icon & Dropdown with Real-Time Data */}
              <div className="relative">
                <button
                  type="button"
                  ref={notificationButtonRef}
                  onClick={toggleNotifications}
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                  aria-expanded={showBellDropdown}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {showBellDropdown && (
                  createPortal(
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowBellDropdown(false)} />
                      <div
                        role="dialog"
                        aria-label="Notifications"
                        className="fixed z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white text-xs shadow-2xl"
                        style={notificationPosition || { top: 80, left: 12, width: "calc(100vw - 1.5rem)" }}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                {unreadCount} unread
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors hover:underline"
                                title="Mark all as read"
                              >
                                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setShowBellDropdown(false);
                                setAnnouncementForm({ title: "", message: "", type: "ANNOUNCEMENT" });
                                setEditingAnnouncementId(null);
                                setShowAnnouncementModal(true);
                              }}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100"
                            >
                              <Plus className="h-3 w-3" /> New
                            </button>
                          </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center border-b border-slate-100 bg-white px-2 pt-1 gap-1 text-[11px] overflow-x-auto no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setNotificationTab("unread")}
                            className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 ${notificationTab === "unread"
                              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            Unread ({unreadList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationTab("all")}
                            className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 ${notificationTab === "all"
                              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            All ({adminNotifications.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationTab("read")}
                            className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 ${notificationTab === "read"
                              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            Read ({readList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationTab("requests")}
                            className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 ${notificationTab === "requests"
                              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            Requests ({requestsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationTab("announcements")}
                            className={`px-2.5 py-1.5 rounded-t-md font-medium border-b-2 transition-all shrink-0 ${notificationTab === "announcements"
                              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            Announcements ({announcementsCount})
                          </button>
                        </div>

                        {/* Items List */}
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/80">
                          {filteredNotifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                              {notificationTab === "unread" ? (
                                <>
                                  <CheckCircle2 className="h-8 w-8 mx-auto mb-1.5 text-emerald-500 opacity-80" />
                                  <p className="font-semibold text-slate-700 text-xs">All Caught Up!</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">No unread notifications at the moment.</p>
                                </>
                              ) : (
                                <>
                                  <Bell className="h-8 w-8 mx-auto mb-1.5 text-slate-300 opacity-60" />
                                  <p className="font-medium text-slate-600 text-xs">No notifications in this tab</p>
                                </>
                              )}
                            </div>
                          ) : (
                            filteredNotifications.slice(0, 20).map((item, idx) => (
                              <div
                                key={item._id || item.id || idx}
                                onClick={() => handleNotificationClick(item)}
                                className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer group ${!item.isRead ? "bg-indigo-50/30 hover:bg-indigo-50/60" : "hover:bg-slate-50 opacity-80"
                                  }`}
                              >
                                <div
                                  className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${getNotificationBg(item.type)}`}
                                >
                                  {getNotificationIcon(item.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`truncate text-xs ${!item.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>
                                      {item.title}
                                    </p>
                                    {!item.isRead && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                    {item.message}
                                  </p>
                                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                                    <span>{formatAnnouncementDate(item.createdAt)}</span>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {item.category === "announcement" && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAnnouncementEdit(item);
                                            }}
                                            className="p-0.5 text-slate-400 hover:text-slate-700"
                                          >
                                            <Edit3 className="h-3 w-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAnnouncementDelete(item._id || item.id);
                                            }}
                                            className="p-0.5 text-slate-400 hover:text-rose-600"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </>
                                      )}
                                      {item.link && (
                                        <span className="text-indigo-600 font-medium flex items-center gap-0.5 text-[10px]">
                                          Open <ExternalLink className="h-2.5 w-2.5" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50">
                          <button
                            type="button"
                            onClick={() => {
                              setShowBellDropdown(false);
                              setShowAllAnnouncementsModal(true);
                            }}
                            className="text-[11px] font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                          >
                            View all Announcements
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowBellDropdown(false);
                              navigate("/attendance/leave-request");
                            }}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            All Requests &rarr;
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )
                )}
              </div>


              <button
                type="button"
                onClick={() => {
                  setAnnouncementForm({ title: "", message: "", type: "ANNOUNCEMENT" });
                  setEditingAnnouncementId(null);
                  setShowAnnouncementModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Post Announcement
              </button>
            </div>
          </div>

          {/* Shrink-to-fit Minimal Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              const styles = getAccentStyles(stat.accent);
              return (
                <div
                  key={stat.id}
                  className="bg-white p-3.5 border border-slate-200/80 rounded-xl shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-1.5 rounded-md ${styles.iconBg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${styles.badgeBg}`}>
                      {stat.badge}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{stat.name}</p>
                  </div>
                </div>
              );
            })}

            {/* Absent Card */}
            <button
              type="button"
              ref={absentCardRef}
              onClick={openAbsentDetails}
              className="bg-white p-3.5 border border-rose-200/80 rounded-xl shadow-xs text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60">
                  <UserX className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                  Action Required
                </span>
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">{absentRecords.length}</p>
                  <p className="text-[11px] text-rose-600 font-medium">Absent Today</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </button>
          </div>

          {/* Corporate Events & Celebrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-4">

            {/* Holidays */}
            <div className="flex flex-col h-full bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <UmbrellaIcon className="h-3 w-3 -rotate-12" />
                  </div>
                  <h2 className="text-xs font-semibold text-slate-900">Upcoming Holidays</h2>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-full">
                    {upcomingHolidays.length}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-center overflow-y-auto">
                {upcomingHolidays.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No upcoming holidays
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-0.5">
                    {upcomingHolidays.map((holiday) => {
                      const parts = (holiday.date || "").trim().split(" ");
                      const day = parts[0] || "";
                      const month = parts.slice(1).join(" ") || "";

                      return (
                        <div
                          key={holiday.id}
                          className="flex flex-col items-center text-center w-16 sm:w-20 shrink-0 group"
                        >
                          <div className="h-11 w-11 rounded-full bg-emerald-100/70 border-2 border-emerald-200/80 text-emerald-800 flex flex-col items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
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
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <Cake className="h-3 w-3" />
                  </div>
                  <h2 className="text-xs font-semibold text-slate-900">Upcoming Birthdays</h2>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded-full">
                    {birthdays.length}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-center overflow-y-auto">
                {birthdays.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No birthdays this month
                  </div>
                ) : (
                  <div className="flex items-start gap-4 overflow-x-auto pb-0.5">
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
                          <div className="h-11 w-11 rounded-full bg-purple-100/70 border-2 border-purple-200/80 text-purple-700 font-bold text-xs flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
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
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-900">Present Today</h2>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                {presentRecords.length} Active
              </span>
            </div>

            <div className="p-3 max-h-[300px] overflow-y-auto">
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

          {/* Announcement Modal */}
          {showAnnouncementModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div
                className="w-full rounded-xl border border-slate-200/90 bg-white shadow-xl overflow-hidden"
                style={{
                  width: "100%",
                  maxWidth: "28rem",
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">
                    {editingAnnouncementId ? "Edit Announcement" : "Post Announcement"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnnouncementModal(false);
                      setAnnouncementForm({ title: "", message: "", type: "ANNOUNCEMENT" });
                      setEditingAnnouncementId(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Enter title"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                    <textarea
                      placeholder="Enter message..."
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementForm({ title: "", message: "", type: "ANNOUNCEMENT" });
                        setShowAnnouncementModal(false);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAnnouncementSubmit}
                      disabled={!announcementForm.title.trim() || !announcementForm.message.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
                    >
                      {editingAnnouncementId ? "Update" : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* View All Announcements Modal */}
          {showAllAnnouncementsModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white w-full max-w-xl rounded-xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">All Announcements</h3>
                  <button
                    type="button"
                    onClick={() => setShowAllAnnouncementsModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                  {announcements.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No announcements
                    </div>
                  ) : (
                    announcements.map((announcement, index) => (
                      <div key={announcement._id || index} className="p-3 rounded-lg bg-slate-50/60 border border-slate-100">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-xs font-semibold text-slate-900">{announcement.title}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatAnnouncementDate(announcement.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{announcement.message}</p>
                        <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-200/60 pt-1.5">
                          <button
                            onClick={() => handleAnnouncementEdit(announcement)}
                            className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleAnnouncementDelete(announcement._id || announcement.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAllAnnouncementsModal(false)}
                    className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    Close
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