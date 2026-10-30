import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Search,
  Filter,
  ChevronDown,
  AlertCircle,
  MessageSquare,
  X,
  Check,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  Users,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { isFinanceOrExcludedUser, isUnknownEmployeeOrUser } from "../../utils/roleFilters";
import {
  getLoggedInUserIdentifiers,
  fetchTeamsList,
  isTeamOwnedByLead,
  extractAssignedTeamEmployees,
  isLeaveOfAssignedTeam,
} from "../../utils/teamLeadUtils";

const BASE_URL = "https://kt-backend-ttzj.onrender.com/api/leave";

const LEAVE_URL = `${BASE_URL}/all`;


const TL_APPROVE_URL = `${BASE_URL}/teamlead/approve`;
const TL_REJECT_URL = `${BASE_URL}/teamlead/reject`;

const HR_APPROVE_URL = `${BASE_URL}/hr/approve`;
const HR_REJECT_URL = `${BASE_URL}/hr/reject`;

const ADMIN_APPROVE_URL = `${BASE_URL}/admin/approve`;
const ADMIN_REJECT_URL = `${BASE_URL}/admin/reject`;

// ============================================================
// HELPERS
// ============================================================

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, "");

const normalizeStatus = (status) => {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (
    value === "approved" ||
    value === "approve" ||
    value === "accepted"
  ) {
    return "Approved";
  }

  if (
    value === "rejected" ||
    value === "reject" ||
    value === "denied"
  ) {
    return "Rejected";
  }

  return "Pending";
};

const isApproved = (status) =>
  normalizeStatus(status) === "Approved";

const isRejected = (status) =>
  normalizeStatus(status) === "Rejected";

const isPending = (status) =>
  normalizeStatus(status) === "Pending";

const getLeaveFinalStatus = (leave) => {
  if (!leave) return "";

  const rawLeave = leave.rawLeave || leave;
  const statusValue =
    rawLeave?.status ||
    rawLeave?.approvalStatus ||
    leave?.approvalStatus ||
    "";

  return String(statusValue || "").trim().toLowerCase();
};

const isLeaveFinalized = (leave) => {
  if (!leave) return false;

  const finalStatus = getLeaveFinalStatus(leave);

  return (
    finalStatus === "approved" ||
    finalStatus === "rejected"
  );
};

const formatRole = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === "teamlead") return "Team Lead";
  if (normalized === "hr") return "HR";
  if (normalized === "admin") return "Admin";
  if (normalized === "employee") return "Employee";

  return role || "Unknown";
};

const normalizeLeaveType = (type) => {
  const normalized = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  const aliases = {
    sick: "sick leave",
    casual: "casual leave",
    annual: "annual leave",
    maternity: "maternity leave",
    paternity: "paternity leave",
  };

  return aliases[normalized] || normalized;
};

const formatLeaveType = (type) =>
  normalizeLeaveType(type)
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getCanonicalLeaveType = (type, leave) => {
  const rawLeave = leave?.rawLeave || leave || {};
  const totalDays = Number(rawLeave.totalDays ?? leave?.totalDays);
  const halfDayType = String(rawLeave.halfDayType || leave?.halfDayType || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  const isHalfDay = isHalfDayLeave(rawLeave, leave, totalDays, halfDayType);

  if (!isHalfDay) return type || "Leave";

  if (halfDayType === "first-half" || halfDayType === "second-half") {
    return `Half Day (${halfDayType.replace("-", " ")})`;
  }
  return "Half Day";
};

const formatDuration = (leave) => {
  if (leave?.dateIssue) return "Invalid date range";

  const rawLeave = leave?.rawLeave || leave || {};
  const totalDays = Number(rawLeave?.totalDays ?? leave?.totalDays ?? 0);
  const halfType = String(rawLeave?.halfDayType || leave?.halfDayType || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  const isHalf = isHalfDayLeave(rawLeave, leave, totalDays, halfType);

  if (isHalf) {
    if (halfType === "first-half") return "0.5 Day (First Half)";
    if (halfType === "second-half") return "0.5 Day (Second Half)";
    return "0.5 Day (Half Day)";
  }

  return `${totalDays} ${totalDays === 1 ? "Day" : "Days"}`;
};

const isHalfDayLeave = (rawLeave, leave, totalDays, halfDayType) =>
  rawLeave?.isHalfDay === true ||
  leave?.isHalfDay === true ||
  totalDays === 0.5 ||
  halfDayType === "first-half" ||
  halfDayType === "second-half";

const getLeaveDateIssue = (startDate, endDate) => {
  const parseLeaveDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const yearMatch = raw.match(/^[+-]?(\d{4,6})-\d{2}-\d{2}/);
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) return null;

    const year = yearMatch ? Number(yearMatch[1]) : date.getFullYear();
    if (year < 1900 || year > 9999) return null;

    if (yearMatch) {
      const [, month, day] = raw.match(/^[+-]?\d{4,6}-(\d{2})-(\d{2})/) || [];
      if (!month || !day) return null;
      const utcDate = new Date(0);
      utcDate.setUTCFullYear(year, Number(month) - 1, Number(day));
      utcDate.setUTCHours(0, 0, 0, 0);
      if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== Number(month) - 1 ||
        utcDate.getUTCDate() !== Number(day)
      ) {
        return null;
      }
    }

    return date;
  };

  const start = parseLeaveDate(startDate);
  const end = parseLeaveDate(endDate);
  if (!start || !end) return "The leave date is invalid or outside the supported range.";
  if (end < start) return "The leave end date is before its start date.";
  return "";
};

const DateCorrectionNotice = ({ issue }) => (
  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
    {issue}
  </span>
);

const getEmployeeId = (employee) => {
  if (!employee) return "";

  if (typeof employee === "string") {
    return employee;
  }

  return employee._id || employee.id || "";
};

const getEmployeeName = (employee, leave) => {
  if (!employee) {
    return (
      leave?.name ||
      leave?.employeeName ||
      "Unknown Employee"
    );
  }

  if (employee.name) return employee.name;

  const fullName =
    `${employee.firstName || ""} ${employee.lastName || ""
      }`.trim();

  return (
    fullName ||
    leave?.name ||
    leave?.employeeName ||
    "Unknown Employee"
  );
};

const getEmployeeRole = (employee, leave) => {
  return (
    employee?.role ||
    leave?.applicantRole ||
    leave?.role ||
    "Unknown"
  );
};

// ============================================================
// COMPONENT
// ============================================================

export default function LeaveRequest() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const filterDropdownRef = useRef(null);

  const [selectedLeave, setSelectedLeave] = useState(null);

  const [actioningId, setActioningId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [localOverrides, setLocalOverrides] = useState({});

  const [assignedTeams, setAssignedTeams] = useState([]);
  const [teamEmployeesScope, setTeamEmployeesScope] = useState(null);
  const [usersMap, setUsersMap] = useState({});

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    leave: null,
    status: "",
    remark: "",
  });

  const openActionModal = (leave, status) => {
    if (!leave) return;
    if (getLeaveDateIssue(leave.startDate, leave.endDate)) {
      setError("This leave request has invalid dates and cannot be approved or rejected.");
      return;
    }
    setActionModal({
      isOpen: true,
      leave,
      status,
      remark: "",
    });
  };

  const closeActionModal = () => {
    setActionModal({
      isOpen: false,
      leave: null,
      status: "",
      remark: "",
    });
  };

  // ==========================================================
  // GET CURRENT USER
  // ==========================================================

  const getCurrentUser = () => {
    try {
      const storedUser =
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser") ||
        localStorage.getItem("loggedInUser") ||
        localStorage.getItem("auth_user");

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);

        setCurrentUser(parsedUser);

        const role =
          parsedUser?.role ||
          parsedUser?.user?.role ||
          parsedUser?.data?.role ||
          "";

        setCurrentRole(normalizeRole(role));

        return parsedUser;
      }

      const storedRole =
        localStorage.getItem("role") ||
        localStorage.getItem("userRole") ||
        localStorage.getItem("active_role");

      if (storedRole) {
        setCurrentRole(normalizeRole(storedRole));
      }

      return null;
    } catch (error) {
      console.error("Current user parse error:", error);
      return null;
    }
  };

  // ==========================================================
  // FETCH LEAVES
  // ==========================================================

  const fetchLeaves = async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
        setError("");
      }

      const token = localStorage.getItem("token") || localStorage.getItem("auth_token");

      if (!token) {
        throw new Error("Please login first.");
      }

      // Simultaneously fetch leaves, teams list, and users directory
      const [leaveRes, teamsData, uRes] = await Promise.allSettled([
        fetch(LEAVE_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).then(r => r.json().catch(() => ({}))),
        fetchTeamsList(),
        fetch("https://kt-backend-ttzj.onrender.com/api/users/all", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).then(r => r.json().catch(() => ({})))
      ]);

      const responseData = leaveRes.status === "fulfilled" ? leaveRes.value : {};

      let uMap = {};
      if (uRes.status === "fulfilled" && uRes.value) {
        const rawUsers = uRes.value?.users || uRes.value?.data || (Array.isArray(uRes.value) ? uRes.value : []);
        if (Array.isArray(rawUsers)) {
          rawUsers.forEach(u => {
            if (u._id) uMap[String(u._id)] = u;
            if (u.id) uMap[String(u.id)] = u;
            if (u.employeeId) uMap[String(u.employeeId)] = u;
            if (u.email) uMap[u.email.toLowerCase().trim()] = u;
          });
          setUsersMap(uMap);
        }
      }

      const allTeams = teamsData.status === "fulfilled" && Array.isArray(teamsData.value) ? teamsData.value : [];
      const userIdent = getLoggedInUserIdentifiers(currentUser);
      const myTeams = allTeams.filter(t => isTeamOwnedByLead(t, userIdent));
      setAssignedTeams(myTeams);

      const teamScope = extractAssignedTeamEmployees(myTeams, uMap);
      setTeamEmployeesScope(teamScope);

      let leaveArray = [];

      if (Array.isArray(responseData)) {
        leaveArray = responseData;
      } else if (Array.isArray(responseData.data)) {
        leaveArray = responseData.data;
      } else if (Array.isArray(responseData.leaves)) {
        leaveArray = responseData.leaves;
      } else if (Array.isArray(responseData.requests)) {
        leaveArray = responseData.requests;
      } else if (Array.isArray(responseData.result)) {
        leaveArray = responseData.result;
      }

      const normalized = leaveArray
        .filter((leave) => {
          if (!leave) return false;
          if (isFinanceOrExcludedUser(leave)) return false;

          const employee =
            leave?.employeeId && typeof leave.employeeId === "object"
              ? leave.employeeId
              : leave?.employee || leave?.user || leave?.userId;

          if (!leave || isFinanceOrExcludedUser(leave) || isUnknownEmployeeOrUser(leave)) return false;
          if (employee && (isFinanceOrExcludedUser(employee) || isUnknownEmployeeOrUser(employee))) return false;

          const employeeName = getEmployeeName(employee, leave);

          if (!employeeName || isUnknownEmployeeOrUser(employeeName)) {
            return false;
          }

          return true;
        })
        .map((leave, index) => {
          const employee =
            leave?.employeeId &&
              typeof leave.employeeId === "object"
              ? leave.employeeId
              : leave?.employee ||
              leave?.user ||
              leave?.userId ||
              {};

          const employeeName = getEmployeeName(
            employee,
            leave
          );

          const employeeRole = getEmployeeRole(
            employee,
            leave
          );

          const teamLeadStatus = normalizeStatus(
            leave.teamLeadStatus
          );

          const hrStatus = normalizeStatus(
            leave.hrStatus ||
            leave.hrApprovalStatus
          );

          const leaveId =
            leave?._id ||
            leave?.id ||
            `${employee?._id || "employee"}-${index}`;

          const isHrApplicant = normalizeRole(employeeRole) === "hr";

          let rawAdminStatus = leave.adminStatus;
          if (localOverrides[leaveId]) {
            rawAdminStatus = localOverrides[leaveId];
          } else if (!rawAdminStatus) {
            if (isHrApplicant) {
              const leaveFinal = getLeaveFinalStatus(leave);
              if (leaveFinal === "approved") {
                rawAdminStatus = "Approved";
              } else if (leaveFinal === "rejected") {
                rawAdminStatus = "Rejected";
              } else {
                rawAdminStatus = "Pending";
              }
            }
          }

          const adminStatus = normalizeStatus(rawAdminStatus);

          // ======================================================
          // OVERALL STATUS
          // ======================================================

          let overallStatus = "Pending";

          if (
            isRejected(teamLeadStatus) ||
            isRejected(hrStatus) ||
            isRejected(adminStatus)
          ) {
            overallStatus = "Rejected";
          } else if (
            isApproved(hrStatus) &&
            (
              normalizeRole(employeeRole) === "employee" ||
              normalizeRole(employeeRole) === "teamlead"
            )
          ) {
            overallStatus = "Approved";
          } else if (
            isApproved(adminStatus) &&
            normalizeRole(employeeRole) === "hr"
          ) {
            overallStatus = "Approved";
          }

          return {
            id:
              leave?._id ||
              leave?.id ||
              `${employee?._id || "employee"}-${index}`,

            employeeId: getEmployeeId(
              leave?.employeeId || employee
            ),

            name: employeeName,

            email:
              employee?.email ||
              leave?.email ||
              "",

            role: employeeRole,

            leaveType: getCanonicalLeaveType(
              leave?.leaveType || leave?.type || "Leave",
              leave
            ),

            isHalfDay: leave?.isHalfDay === true ||
              Number(leave?.totalDays) === 0.5 ||
              ["first-half", "second-half"].includes(String(leave?.halfDayType || "").trim().toLowerCase().replace(/[_\s]+/g, "-")),

            halfDayType: leave?.halfDayType || "",

            startDate:
              leave?.startDate ||
              leave?.fromDate ||
              "",

            endDate:
              leave?.endDate ||
              leave?.toDate ||
              "",

            dateIssue: getLeaveDateIssue(
              leave?.startDate || leave?.fromDate || "",
              leave?.endDate || leave?.toDate || ""
            ),

            totalDays:
              leave?.totalDays ??
              calculateDays(
                leave?.startDate,
                leave?.endDate
              ),

            reason: leave?.reason || "",

            teamLeadStatus,

            hrStatus,

            adminStatus,

            approvalStatus: overallStatus,

            appliedOn:
              leave?.createdAt ||
              leave?.appliedOn ||
              "",

            remark:
              leave?.remark ||
              leave?.description ||
              "",

            description:
              leave?.description ||
              leave?.remark ||
              "",

            teamLeadRemark:
              leave?.teamLeadRemark ||
              leave?.teamLeadComment ||
              leave?.teamLeadRemarks ||
              "",

            hrRemark:
              leave?.hrRemark ||
              leave?.hrComment ||
              leave?.hrRemarks ||
              "",

            adminRemark:
              leave?.adminRemark ||
              leave?.adminComment ||
              leave?.adminRemarks ||
              "",

            rawLeave: leave,
          };
        });

      const loggedRole = normalizeRole(currentRole || currentUser?.role);
      let finalLeaves = normalized;

      // CRITICAL RULE: Leave requests go ONLY to that employee's TL, not to all TLs
      // If logged in as Team Lead, strictly filter leaves so they only see their assigned team employees!
      if (loggedRole === "teamlead") {
        finalLeaves = normalized.filter(leave => isLeaveOfAssignedTeam(leave, teamScope, uMap));
      }

      setRequests(finalLeaves);

      // Keep selected modal synchronized
      setSelectedLeave((previous) => {
        if (!previous) return null;

        return (
          finalLeaves.find(
            (item) => item.id === previous.id
          ) || null
        );
      });
    } catch (error) {
      console.error("FETCH LEAVES ERROR:", error);

      if (!isSilent) {
        setError(
          error?.message ||
          "Failed to load leave requests."
        );
        setRequests([]);
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  // ==========================================================
  // CALCULATE DAYS
  // ==========================================================

  function calculateDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return 0;
    }

    return (
      Math.ceil(
        (end - start) /
        (1000 * 60 * 60 * 24)
      ) + 1
    );
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    getCurrentUser();
    fetchLeaves(false);

    // Silent auto-refresh every 8s for new leave requests
    const interval = setInterval(() => {
      fetchLeaves(true);
    }, 8000);

    const handleFocus = () => {
      fetchLeaves(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLeaves(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!showFilters) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!filterDropdownRef.current?.contains(event.target)) {
        setShowFilters(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowFilters(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showFilters]);

  // ==========================================================
  // WORKFLOW
  // ==========================================================

  const getWorkflowStage = (leave) => {
    if (!leave) return "none";

    const role = normalizeRole(leave.role);

    // --------------------------------------------------------
    // EMPLOYEE
    // Team Lead -> HR
    // --------------------------------------------------------

    if (
      role === "employee"
    ) {
      if (isRejected(leave.teamLeadStatus)) {
        return "rejected";
      }

      if (isPending(leave.teamLeadStatus)) {
        return "teamlead";
      }

      if (
        isApproved(leave.teamLeadStatus) &&
        isPending(leave.hrStatus)
      ) {
        return "hr";
      }

      if (isRejected(leave.hrStatus)) {
        return "rejected";
      }

      if (isApproved(leave.hrStatus)) {
        return "completed";
      }
    }

    // --------------------------------------------------------
    // TEAM LEAD
    // Direct HR
    // --------------------------------------------------------

    if (role === "teamlead") {
      if (isPending(leave.hrStatus)) {
        return "hr";
      }

      if (isRejected(leave.hrStatus)) {
        return "rejected";
      }

      if (isApproved(leave.hrStatus)) {
        return "completed";
      }
    }

    // --------------------------------------------------------
    // HR
    // Direct Admin
    // --------------------------------------------------------

    if (role === "hr") {
      if (isPending(leave.adminStatus)) {
        return "admin";
      }

      if (isRejected(leave.adminStatus)) {
        return "rejected";
      }

      if (isApproved(leave.adminStatus)) {
        return "completed";
      }
    }

    return "none";
  };

  // ==========================================================
  // WORKFLOW TEXT
  // ==========================================================

  const getWorkflowText = (leave) => {
    const stage = getWorkflowStage(leave);

    switch (stage) {
      case "teamlead":
        return "Waiting for Team Lead";

      case "hr":
        return "Waiting for HR";

      case "admin":
        return "Waiting for Admin";

      case "rejected":
        if (normalizeRole(leave?.role) === "hr" || isRejected(leave?.adminStatus)) {
          return "Rejected by Admin";
        }

        if (normalizeRole(leave?.role) === "teamlead" || isRejected(leave?.hrStatus)) {
          return "Rejected by HR";
        }

        if (isRejected(leave?.teamLeadStatus)) {
          return "Rejected by Team Lead";
        }

        return "Rejected";


      case "completed":
        return "Leave Approved";

      default:
        return "View Only";
    }
  };

  // ==========================================================
  // CAN CURRENT USER TAKE ACTION?
  // ==========================================================

  const canTakeAction = (leave) => {
    if (!leave) return false;
    if (leave.dateIssue) return false;

    const loggedRole = normalizeRole(
      currentRole
    );

    const applicantRole = normalizeRole(
      leave.role
    );

    // If already finalized (approved or rejected), never show action buttons
    if (isLeaveFinalized(leave)) {
      return false;
    }

    // ========================================================
    // ADMIN
    // CAN APPROVE/REJECT HR LEAVE (if not already finalized)
    // ========================================================

    if (loggedRole === "admin") {
      return applicantRole === "hr" && !isApproved(leave.adminStatus) && !isRejected(leave.adminStatus);
    }

    // ========================================================
    // HR
    // ========================================================

    if (loggedRole === "hr") {
      // HR cannot approve own leave
      if (applicantRole === "hr") {
        return false;
      }

      // Employee:
      // TL approval compulsory
      if (
        applicantRole === "employee"
      ) {
        return (
          isApproved(leave.teamLeadStatus) &&
          isPending(leave.hrStatus)
        );
      }

      // Team Lead:
      // Direct HR approval
      if (applicantRole === "teamlead") {
        return isPending(leave.hrStatus);
      }

      return false;
    }

    // ========================================================
    // TEAM LEAD
    // Only that employee's assigned TL can approve!
    // ========================================================

    if (loggedRole === "teamlead") {
      const isMyTeamEmployee = isLeaveOfAssignedTeam(leave, teamEmployeesScope, usersMap);
      return (
        applicantRole === "employee" &&
        isMyTeamEmployee &&
        isPending(leave.teamLeadStatus)
      );
    }

    return false;
  };

  // ==========================================================
  // ACTION ROLE LABEL
  // ==========================================================

  const getActionRoleLabel = () => {
    const role = normalizeRole(
      currentRole
    );

    if (role === "teamlead") {
      return "Team Lead";
    }

    if (role === "hr") {
      return "HR";
    }

    if (role === "admin") {
      return "Admin";
    }

    return "";
  };

  const isApprovalAlreadyApproved = (leave) => {
    if (!leave) return false;

    const applicantRole = normalizeRole(leave.role);
    const loggedRole = normalizeRole(currentRole);

    const finalStatus = getLeaveFinalStatus(leave);

    if (finalStatus === "approved") {
      return true;
    }

    if (isApproved(leave.approvalStatus)) {
      return true;
    }

    if (loggedRole === "teamlead") {
      return isApproved(leave.teamLeadStatus);
    }

    if (loggedRole === "hr") {
      return applicantRole !== "hr" && isApproved(leave.hrStatus);
    }

    if (loggedRole === "admin") {
      return isApproved(leave.adminStatus);
    }

    return false;
  };

  // ==========================================================
  // GET ACTION URL
  // ==========================================================

  const getActionUrl = (status) => {
    const role = normalizeRole(
      currentRole
    );

    if (role === "teamlead") {
      return status === "approved"
        ? TL_APPROVE_URL
        : TL_REJECT_URL;
    }

    if (role === "hr") {
      return status === "approved"
        ? HR_APPROVE_URL
        : HR_REJECT_URL;
    }

    if (role === "admin") {
      return status === "approved"
        ? ADMIN_APPROVE_URL
        : ADMIN_REJECT_URL;
    }

    return null;
  };

  // ==========================================================
  // APPROVE / REJECT
  // ==========================================================

  const handleAction = async (
    leave,
    status,
    remark = ""
  ) => {
    if (!leave) return;

    setError("");
    setSuccess("");

    const dateIssue = getLeaveDateIssue(leave.startDate, leave.endDate);
    if (dateIssue) {
      setError(`${dateIssue} Correct the dates before taking approval action.`);
      return;
    }

    if (!remark || !remark.trim()) {
      setError("Please enter a description/remark before submitting.");
      return;
    }

    // --------------------------------------------------------
    // Authorization check
    // --------------------------------------------------------

    if (!canTakeAction(leave)) {
      setError(
        "You are not authorized to perform this action."
      );
      return;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      setError("Please login first.");
      return;
    }

    const url = getActionUrl(status);

    if (!url) {
      setError(
        "Approval API is not available for your role."
      );
      return;
    }

    try {
      setActioningId(leave.id);

      const newStatusTitle = status === "approved" ? "Approved" : "Rejected";
      const newStatusLower = status === "approved" ? "approved" : "rejected";
      const userRole = normalizeRole(currentRole);

      // Instantly record local override so refetch preserves it
      setLocalOverrides((prev) => ({
        ...prev,
        [leave.id]: newStatusTitle,
      }));

      // Optimistically update current requests state
      setRequests((prevRequests) =>
        prevRequests.map((item) => {
          if (item.id === leave.id) {
            const updated = {
              ...item,
              remark: remark || item.remark,
              description: remark || item.description,
              rawLeave: {
                ...item.rawLeave,
                status: newStatusLower,
                remark: remark || item.rawLeave?.remark,
                description: remark || item.rawLeave?.description,
              },
            };

            if (userRole === "teamlead") {
              updated.teamLeadStatus = newStatusTitle;
              updated.teamLeadRemark = remark || item.teamLeadRemark;
              if (status === "approved") {
                updated.hrStatus = "Pending";
                updated.approvalStatus = "Pending";
              } else {
                updated.hrStatus = "Rejected";
                updated.approvalStatus = "Rejected";
              }
            } else if (userRole === "hr") {
              updated.hrStatus = newStatusTitle;
              updated.hrRemark = remark || item.hrRemark;
              updated.approvalStatus = newStatusTitle;
            } else if (userRole === "admin") {
              updated.adminStatus = newStatusTitle;
              updated.adminRemark = remark || item.adminRemark;
              updated.approvalStatus = newStatusTitle;
            }

            return updated;
          }
          return item;
        })
      );

      // Also update selectedLeave if open
      setSelectedLeave((prev) => {
        if (!prev || prev.id !== leave.id) return prev;
        const updated = {
          ...prev,
          remark: remark || prev.remark,
          description: remark || prev.description,
        };
        if (userRole === "teamlead") {
          updated.teamLeadStatus = newStatusTitle;
          updated.teamLeadRemark = remark || prev.teamLeadRemark;
        } else if (userRole === "hr") {
          updated.hrStatus = newStatusTitle;
          updated.hrRemark = remark || prev.hrRemark;
        } else if (userRole === "admin") {
          updated.adminStatus = newStatusTitle;
          updated.adminRemark = remark || prev.adminRemark;
        }
        return updated;
      });

      // ======================================================
      // BACKEND EXPECTS status, remark, description IN BODY
      // ======================================================

      const response = await fetch(url, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          leaveId: leave.id,
          status,
          remark: remark || "",
          description: remark || "",
        }),
      });

      const responseData =
        await response
          .json()
          .catch(() => ({}));

      if (
        !response.ok ||
        responseData?.success === false
      ) {
        const alreadyProcessedMessage =
          /already\s+(approved|rejected)/i.test(
            responseData?.message || ""
          );

        if (!alreadyProcessedMessage) {
          throw new Error(
            responseData?.message ||
            `Failed to ${status === "approved"
              ? "approve"
              : "reject"
            } leave`
          );
        }
      }

      setSuccess(
        userRole === "teamlead" && status === "approved"
          ? "Leave approved by Team Lead and forwarded to HR for final approval."
          : `Leave status updated to ${newStatusTitle} successfully.`
      );
      closeActionModal();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("LEAVE ACTION ERROR:", error);
      setError(error?.message || "Failed to update leave status.");
    } finally {
      setActioningId(null);
    }
  };

  // ==========================================================
  // SEARCH + FILTER
  // ==========================================================

  const filteredRequests = useMemo(() => {
    const search =
      searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const name =
        request.name?.toLowerCase() || "";

      const role =
        request.role?.toLowerCase() || "";

      const leaveType =
        request.leaveType?.toLowerCase() || "";
      const normalizedLeaveType = normalizeLeaveType(request.leaveType);
      const leaveTypeLabel = formatLeaveType(request.leaveType).toLowerCase();

      const reason =
        request.reason?.toLowerCase() || "";

      const matchesSearch =
        !search ||
        name.includes(search) ||
        role.includes(search) ||
        leaveType.includes(search) ||
        leaveTypeLabel.includes(search) ||
        reason.includes(search);

      const matchesType =
        filterType === "all" ||
        normalizedLeaveType === filterType;

      return (
        matchesSearch &&
        matchesType
      );
    });
  }, [
    requests,
    searchTerm,
    filterType,
  ]);

  const availableLeaveTypes = useMemo(
    () => [...new Set(requests.map((request) => normalizeLeaveType(request.leaveType)).filter(Boolean))].sort(),
    [requests]
  );

  // ==========================================================
  // DATE
  // ==========================================================

  const formatDate = (date) => {
    if (!date) return "-";

    if (getLeaveDateIssue(date, date)) return "Invalid date";

    const parsed = new Date(date);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() > 9999
    ) {
      return "-";
    }

    return parsed.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ==========================================================
  // INITIALS
  // ==========================================================

  const getInitials = (name) => {
    if (!name) return "NA";

    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  // ==========================================================
  // LEAVE TYPE
  // ==========================================================

  const getLeaveTypeStyle = (type) => {
    switch (normalizeLeaveType(type)) {
      case "sick leave":
        return "bg-rose-50 text-rose-700 border-rose-200";

      case "casual leave":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";

      case "annual leave":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "maternity leave":
        return "bg-pink-50 text-pink-700 border-pink-200";

      case "paternity leave":
        return "bg-sky-50 text-sky-700 border-sky-200";

      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  // ==========================================================
  // LEAVE TYPE ICON
  // ==========================================================

  const getLeaveTypeIcon = (type) => {
    switch (normalizeLeaveType(type)) {
      case "sick leave":
        return (
          <AlertCircle className="w-4 h-4" />
        );

      case "casual leave":
        return (
          <Calendar className="w-4 h-4" />
        );

      case "annual leave":
        return (
          <CalendarDays className="w-4 h-4" />
        );

      default:
        return (
          <FileText className="w-4 h-4" />
        );
    }
  };

  // ==========================================================
  // STATUS BADGE
  // ==========================================================

  const StatusBadge = ({ status }) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Approved") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-poppins select-none whitespace-nowrap">
          Approved
        </span>
      );
    }

    if (normalized === "Rejected") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-poppins select-none whitespace-nowrap">
          Rejected
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] font-poppins select-none whitespace-nowrap">
        Pending
      </span>
    );
  };

  const ApprovalStatus = ({ leave, stage, status }) => {
    const applicantRole = normalizeRole(leave?.role);
    const isHrLeave = applicantRole === "hr";
    const isTeamLeadLeave = applicantRole === "teamlead";

    const isNotApplicable =
      (isHrLeave && (stage === "teamlead" || stage === "hr")) ||
      (isTeamLeadLeave && (stage === "teamlead" || stage === "admin"));

    if (isNotApplicable) {
      return (
        <span className="text-sm text-slate-400 font-medium select-none">
          -
        </span>
      );
    }

    return <StatusBadge status={status} />;
  };

  const ApprovalActions = ({ leave }) => {
    if (!canTakeAction(leave)) {
      const loggedRole = normalizeRole(currentRole);
      const applicantRole = normalizeRole(leave?.role);

      // If logged in as HR and employee leave hasn't been approved by TL yet
      if (loggedRole === "hr" && applicantRole === "employee") {
        if (isPending(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 font-poppins select-none whitespace-nowrap">
              <Clock className="w-3 h-3 text-amber-600" />
              Waiting for TL
            </span>
          );
        }
        if (isRejected(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-poppins select-none whitespace-nowrap">
              <XCircle className="w-3 h-3 text-rose-600" />
              Rejected by TL
            </span>
          );
        }
        if (isApproved(leave?.hrStatus)) {
          return (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-poppins select-none whitespace-nowrap">
              Approved by HR
            </span>
          );
        }
        if (isRejected(leave?.hrStatus)) {
          return (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-poppins select-none whitespace-nowrap">
              Rejected by HR
            </span>
          );
        }
      }

      // If logged in as Team Lead
      if (loggedRole === "teamlead") {
        if (isApproved(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-poppins select-none whitespace-nowrap">
              Approved
            </span>
          );
        }
        if (isRejected(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-poppins select-none whitespace-nowrap">
              Rejected
            </span>
          );
        }
      }

      return <StatusBadge status={leave?.adminStatus || "Pending"} />;
    }

    const loggedRole = normalizeRole(currentRole);
    let relevantStatus = leave?.adminStatus;
    if (loggedRole === "teamlead") relevantStatus = leave?.teamLeadStatus;
    else if (loggedRole === "hr") relevantStatus = leave?.hrStatus;

    const currentStatus = normalizeStatus(relevantStatus);

    if (currentStatus === "Approved") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] font-poppins select-none whitespace-nowrap">
          Approved
        </span>
      );
    }

    if (currentStatus === "Rejected") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-poppins select-none whitespace-nowrap">
          Rejected
        </span>
      );
    }

    const isActioning = actioningId === leave.id;

    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap font-poppins" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openActionModal(leave, "approved");
          }}
          disabled={isActioning}
          aria-label="Approve Leave"
          title="Approve Leave"
          className="h-7 w-7 rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isActioning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openActionModal(leave, "rejected");
          }}
          disabled={isActioning}
          aria-label="Reject Leave"
          title="Reject Leave"
          className="h-7 w-7 rounded-md bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex items-center justify-center shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isActioning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>
      </div>
    );
  };


  // ==========================================================
  // LOADER
  // ==========================================================

  const Loader = () => (
    <div className="flex flex-col justify-center items-center py-16 sm:py-24">
      <Loader2 className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-indigo-600 mb-3" />
      <p className="text-sm font-semibold text-slate-800">Loading leave requests...</p>
      <p className="text-xs text-slate-500 mt-1">Fetching latest employee leave applications</p>
    </div>
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 font-poppins text-slate-800">
      {/* ====================================================
          PAGE HEADER (Matches Screenshot cite [2])
      ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 font-poppins">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-poppins">
            Leave Requests
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 font-normal font-poppins mt-0.5">
            Review And Manage Leave Applications
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Total Count Badge */}
          <div className="h-9 bg-white border border-slate-300 rounded-md px-3 sm:px-3.5 shadow-2xs text-xs font-medium flex items-center select-none font-poppins text-slate-600 gap-1.5">
            <Users size={14} className="text-slate-600 shrink-0" />
            <span>Total:</span>
            <span className="font-bold text-slate-900">{requests.length}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchLeaves()}
            disabled={loading}
            title="Refresh requests"
            aria-label="Refresh requests"
            className="h-9 w-9 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer font-poppins"
          >
            <RefreshCw size={13} className={`text-slate-600 ${loading ? "animate-spin text-[#0088cc]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ====================================================
            SUCCESS & ERROR NOTIFICATIONS
      ==================================================== */}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs sm:text-sm font-poppins animate-in fade-in duration-200 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs sm:text-sm font-poppins animate-in fade-in duration-200 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ====================================================
            TEAM LEAD ASSIGNED BANNER
      ==================================================== */}
      {normalizeRole(currentRole) === "teamlead" && (
        <div>
          {assignedTeams.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs font-poppins">
              <div className="flex items-center gap-2 text-indigo-900 font-medium">
                <User className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Viewing leaves for your assigned team: <strong>{assignedTeams.map(t => t.name || 'My Team').join(', ')}</strong> ({teamEmployeesScope?.memberIds?.size || 0} Members)
                </span>
              </div>
              <span className="text-[11px] text-indigo-700 font-semibold bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs">
                Requests forward to HR upon your approval
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-poppins">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                No specific team assigned to your Team Lead account. Only leaves for your assigned team members will appear here.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
            MAIN DATA CONTAINER (Clean White Background #FFFFFF)
      ==================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-2xs space-y-4 font-poppins">

        {/* ==================================================
              SEARCH & FILTERS TOOLBAR
          ================================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-poppins">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee, role, leave type..."
              className="w-full h-10 pl-10 pr-9 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] transition bg-white font-poppins"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              aria-expanded={showFilters}
              aria-haspopup="true"
              onClick={() => setShowFilters((prev) => !prev)}
              className="h-10 inline-flex items-center justify-center gap-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium font-poppins shadow-2xs transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters</span>
              {filterType !== "all" && (
                <span className="w-2 h-2 rounded-full bg-[#034665]" />
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl font-poppins p-1.5 animate-in fade-in zoom-in-95 duration-100">
                <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Leave Type
                </p>

                <div className="max-h-72 overflow-y-auto modal-scrollbar p-1">
                  {[{ value: "all", label: "All Types" }, ...availableLeaveTypes.map((type) => ({
                    value: type,
                    label: formatLeaveType(type),
                  }))].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilterType(option.value);
                        setShowFilters(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs sm:text-sm transition cursor-pointer ${
                        filterType === option.value
                          ? "bg-[#034665]/10 font-semibold text-[#034665]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {filterType === option.value && (
                        <Check className="h-4 w-4 text-[#034665]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================
              LOADING & EMPTY STATES
          ================================================== */}
        {loading ? (
          <Loader />
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center font-poppins">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4 text-[#034665]">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-poppins">
              {searchTerm || filterType !== "all"
                ? "No Results Found"
                : "No Leave Requests"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-poppins">
              {searchTerm || filterType !== "all"
                ? "Try adjusting your search keywords or leave type filter."
                : "Leave applications submitted by team members will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* ==================================================
                  DESKTOP TABLE (Clean White Row Background, Navy Headers)
              ================================================== */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full table-fixed text-xs font-poppins">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                </colgroup>

                <thead style={{ backgroundColor: "#0346651A" }}>
                  <tr className="border-b border-slate-200/80">
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      No.
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Employee
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Leave
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Duration
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Dates
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Team Lead
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      HR
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Admin
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Workflow
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins">
                      Approve / Reject Reason
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRequests.map((request, index) => (
                    <tr
                      key={request.id}
                      onClick={() => setSelectedLeave(request)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 text-slate-500 font-medium font-poppins text-xs">
                        {index + 1}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 font-poppins shadow-2xs"
                            style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                          >
                            {getInitials(request.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-[13px] font-poppins truncate">
                              {request.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-normal font-poppins truncate">
                              {formatRole(request.role)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium font-poppins shadow-2xs whitespace-nowrap">
                          {getLeaveTypeIcon(request.leaveType)}
                          <span>{getCanonicalLeaveType(formatLeaveType(request.leaveType), request)}</span>
                        </span>
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-900 text-xs sm:text-[13px] font-poppins whitespace-nowrap">
                        {formatDuration(request)}
                      </td>

                      <td className="px-3 py-3 text-[11px] font-poppins leading-tight">
                        <span className="block font-medium text-slate-700 whitespace-nowrap">{formatDate(request.startDate)}</span>
                        <span className="block text-slate-400 whitespace-nowrap">to {formatDate(request.endDate)}</span>
                        {request.dateIssue && (
                          <DateCorrectionNotice issue={request.dateIssue} />
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {normalizeRole(currentRole) === "teamlead" && canTakeAction(request) ? (
                          <ApprovalActions leave={request} />
                        ) : (
                          <ApprovalStatus
                            leave={request}
                            stage="teamlead"
                            status={request.teamLeadStatus}
                          />
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {normalizeRole(currentRole) === "hr" && canTakeAction(request) ? (
                          <ApprovalActions leave={request} />
                        ) : (
                          <ApprovalStatus
                            leave={request}
                            stage="hr"
                            status={request.hrStatus}
                          />
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {normalizeRole(request.role) === "hr" ? (
                          normalizeRole(currentRole) === "admin" && canTakeAction(request) ? (
                            <ApprovalActions leave={request} />
                          ) : (
                            <StatusBadge status={request.adminStatus} />
                          )
                        ) : (
                          <span className="text-sm text-slate-400 font-medium select-none">-</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-slate-700 font-poppins whitespace-nowrap">
                          {getWorkflowText(request)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        {request.teamLeadRemark || request.hrRemark || request.adminRemark || request.remark || request.description ? (
                          <div className="space-y-1 text-xs font-poppins max-w-[200px]">
                            {request.teamLeadRemark && (
                              <div className="text-[11px] leading-tight break-words">
                                <span className="font-bold text-amber-700 mr-1 font-poppins">TL:</span>
                                <span className="text-slate-700 font-poppins">{request.teamLeadRemark}</span>
                              </div>
                            )}
                            {request.hrRemark && (
                              <div className="text-[11px] leading-tight break-words">
                                <span className="font-bold text-purple-700 mr-1 font-poppins">HR:</span>
                                <span className="text-slate-700 font-poppins">{request.hrRemark}</span>
                              </div>
                            )}
                            {request.adminRemark && (
                              <div className="text-[11px] leading-tight break-words">
                                <span className="font-bold text-blue-700 mr-1 font-poppins">Admin:</span>
                                <span className="text-slate-700 font-poppins">{request.adminRemark}</span>
                              </div>
                            )}
                            {!request.teamLeadRemark && !request.hrRemark && !request.adminRemark && (request.remark || request.description) && (
                              <p className="text-[11px] text-slate-700 font-poppins leading-tight break-words">
                                {request.remark || request.description}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium select-none">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ==================================================
                  MOBILE & TABLET CARDS (< 1024px)
              ================================================== */}
            <div className="lg:hidden space-y-3 font-poppins">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => setSelectedLeave(request)}
                  className="bg-white border border-slate-200/80 rounded-xl p-4 hover:border-[#034665]/30 hover:shadow-xs cursor-pointer transition font-poppins space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 font-poppins shadow-2xs"
                        style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                      >
                        {getInitials(request.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm font-poppins truncate">
                          {request.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-normal font-poppins truncate">
                          {formatRole(request.role)}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium font-poppins shadow-2xs shrink-0">
                      {getLeaveTypeIcon(request.leaveType)}
                      <span>{getCanonicalLeaveType(formatLeaveType(request.leaveType), request)}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs font-poppins">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-poppins">
                        Duration
                      </p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5 font-poppins">
                        {formatDuration(request)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-poppins">
                        Dates
                      </p>
                      <p className="text-slate-600 text-xs mt-0.5 font-poppins">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </p>
                      {request.dateIssue && (
                        <DateCorrectionNotice issue={request.dateIssue} />
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2 font-poppins">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-poppins">
                        Team Lead
                      </p>
                      {normalizeRole(currentRole) === "teamlead" && canTakeAction(request) ? (
                        <ApprovalActions leave={request} />
                      ) : (
                        <ApprovalStatus
                          leave={request}
                          stage="teamlead"
                          status={request.teamLeadStatus}
                        />
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-poppins">
                        HR
                      </p>
                      {normalizeRole(currentRole) === "hr" && canTakeAction(request) ? (
                        <ApprovalActions leave={request} />
                      ) : (
                        <ApprovalStatus
                          leave={request}
                          stage="hr"
                          status={request.hrStatus}
                        />
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-poppins">
                        Admin
                      </p>
                      {normalizeRole(request.role) === "hr" ? (
                        normalizeRole(currentRole) === "admin" && canTakeAction(request) ? (
                          <ApprovalActions leave={request} />
                        ) : (
                          <StatusBadge status={request.adminStatus} />
                        )
                      ) : (
                        <span className="text-sm text-slate-400 font-medium select-none">-</span>
                      )}
                    </div>
                  </div>

                  {(request.teamLeadRemark || request.hrRemark || request.adminRemark || request.remark || request.description) && (
                    <div className="pt-2 border-t border-slate-100 text-xs space-y-1 font-poppins">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-poppins">
                        Approve / Reject Reason
                      </p>
                      {request.teamLeadRemark && (
                        <p className="text-slate-600 font-poppins text-xs">
                          <span className="font-bold text-amber-700">TL: </span>
                          {request.teamLeadRemark}
                        </p>
                      )}
                      {request.hrRemark && (
                        <p className="text-slate-600 font-poppins text-xs">
                          <span className="font-bold text-purple-700">HR: </span>
                          {request.hrRemark}
                        </p>
                      )}
                      {request.adminRemark && (
                        <p className="text-slate-600 font-poppins text-xs">
                          <span className="font-bold text-blue-700">Admin: </span>
                          {request.adminRemark}
                        </p>
                      )}
                      {!request.teamLeadRemark && !request.hrRemark && !request.adminRemark && (request.remark || request.description) && (
                        <p className="text-slate-600 font-poppins text-xs">
                          {request.remark || request.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ========================================================
          DETAILS MODAL
      ======================================================== */}
      {selectedLeave && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-poppins animate-in fade-in duration-150"
          onClick={() => setSelectedLeave(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100vh-3.5rem)] my-auto flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden font-poppins animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* STICKY HEADER */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-5 sm:px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins">
                  Leave Details
                </h2>
                <p className="text-xs text-slate-500 font-poppins mt-0.5">
                  Complete leave application & approval workflow
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLeave(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto modal-scrollbar p-5 sm:p-6 space-y-4">
              {/* EMPLOYEE HEADER */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div
                  className="w-12 h-12 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0 font-poppins shadow-2xs"
                  style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                >
                  {getInitials(selectedLeave.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 font-poppins truncate">
                    {selectedLeave.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                    <span className="font-medium text-slate-600 font-poppins">
                      {formatRole(selectedLeave.role)}
                    </span>
                    {selectedLeave.email && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-poppins truncate">
                          {selectedLeave.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* LEAVE STATS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200/80 rounded-xl p-3.5 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5 text-xs font-semibold uppercase tracking-wider font-poppins">
                    <FileText className="w-3.5 h-3.5 text-[#034665]" />
                    <span>Leave Type</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-800 text-xs font-semibold font-poppins shadow-2xs">
                    {getLeaveTypeIcon(selectedLeave.leaveType)}
                    <span>{getCanonicalLeaveType(formatLeaveType(selectedLeave.leaveType), selectedLeave)}</span>
                  </span>
                </div>

                <div className="border border-slate-200/80 rounded-xl p-3.5 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5 text-xs font-semibold uppercase tracking-wider font-poppins">
                    <Clock className="w-3.5 h-3.5 text-[#034665]" />
                    <span>Duration</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 font-poppins">
                    {formatDuration(selectedLeave)}
                  </p>
                </div>

                <div className="border border-slate-200/80 rounded-xl p-3.5 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5 text-xs font-semibold uppercase tracking-wider font-poppins">
                    <Calendar className="w-3.5 h-3.5 text-[#034665]" />
                    <span>Start Date</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 font-poppins">
                    {formatDate(selectedLeave.startDate)}
                  </p>
                </div>

                <div className="border border-slate-200/80 rounded-xl p-3.5 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1.5 text-xs font-semibold uppercase tracking-wider font-poppins">
                    <CalendarDays className="w-3.5 h-3.5 text-[#034665]" />
                    <span>End Date</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 font-poppins">
                    {formatDate(selectedLeave.endDate)}
                  </p>
                </div>
              </div>

              {selectedLeave.dateIssue && (
                <div className="border border-rose-200 bg-rose-50 rounded-xl p-3 text-xs sm:text-sm text-rose-800 font-poppins">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Date correction required</p>
                      <p className="mt-0.5">{selectedLeave.dateIssue} This request cannot be approved or rejected until its dates are corrected.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* REASON */}
              <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-2xs">
                <div className="flex items-center gap-2 text-slate-700 mb-2 font-poppins">
                  <MessageSquare className="w-4 h-4 text-[#034665]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Reason
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-poppins whitespace-pre-wrap">
                  {selectedLeave.reason || "No reason provided by applicant."}
                </p>
              </div>

              {/* APPROVAL FLOW */}
              <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-3.5 font-poppins">
                  <ShieldCheck className="w-4 h-4 text-[#034665]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-poppins">
                    Approval Flow
                  </h3>
                </div>

                <div className="space-y-3 font-poppins divide-y divide-slate-100">
                  {/* TEAM LEAD */}
                  <div className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#034665] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 font-poppins">
                          Team Lead
                        </p>
                        <p className="text-[11px] text-slate-400 font-poppins">
                          Initial team assessment
                        </p>
                      </div>
                    </div>
                    <ApprovalStatus
                      leave={selectedLeave}
                      stage="teamlead"
                      status={selectedLeave.teamLeadStatus}
                    />
                  </div>

                  {/* HR */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 font-poppins">
                          HR
                        </p>
                        <p className="text-[11px] text-slate-400 font-poppins">
                          HR Department review
                        </p>
                      </div>
                    </div>
                    <ApprovalStatus
                      leave={selectedLeave}
                      stage="hr"
                      status={selectedLeave.hrStatus}
                    />
                  </div>

                  {/* ADMIN */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 font-poppins">
                          Admin
                        </p>
                        <p className="text-[11px] text-slate-400 font-poppins">
                          Required for HR personnel leave
                        </p>
                      </div>
                    </div>
                    {normalizeRole(selectedLeave.role) === "hr" ? (
                      <StatusBadge status={selectedLeave.adminStatus} />
                    ) : (
                      <span className="text-sm text-slate-400 font-medium select-none">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CURRENT WORKFLOW */}
              <div className="bg-[#034665]/5 border border-[#034665]/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#034665] font-poppins">
                  Workflow Status:
                </span>
                <span className="text-xs font-bold text-[#034665] font-poppins">
                  {getWorkflowText(selectedLeave)}
                </span>
              </div>

              {/* REMARKS & DESCRIPTIONS */}
              {(selectedLeave.teamLeadRemark ||
                selectedLeave.hrRemark ||
                selectedLeave.adminRemark ||
                selectedLeave.remark) && (
                <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/70 space-y-2.5 font-poppins">
                  <div className="flex items-center gap-2 text-slate-700 font-poppins">
                    <MessageSquare className="w-4 h-4 text-[#034665]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Remarks & Descriptions
                    </span>
                  </div>

                  {selectedLeave.teamLeadRemark && (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mb-1 font-poppins">
                        Team Lead Remark
                      </span>
                      <p className="text-slate-700 font-poppins leading-relaxed">
                        {selectedLeave.teamLeadRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.hrRemark && (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 mb-1 font-poppins">
                        HR Remark
                      </span>
                      <p className="text-slate-700 font-poppins leading-relaxed">
                        {selectedLeave.hrRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.adminRemark && (
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1 font-poppins">
                        Admin Remark
                      </span>
                      <p className="text-slate-700 font-poppins leading-relaxed">
                        {selectedLeave.adminRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.remark &&
                    selectedLeave.remark !== selectedLeave.teamLeadRemark &&
                    selectedLeave.remark !== selectedLeave.hrRemark &&
                    selectedLeave.remark !== selectedLeave.adminRemark && (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 mb-1 font-poppins">
                          Description / Remark
                        </span>
                        <p className="text-slate-700 font-poppins leading-relaxed">
                          {selectedLeave.remark}
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* STICKY FOOTER */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-poppins">
              {canTakeAction(selectedLeave) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 mr-1 font-poppins">
                    Action as <b className="text-slate-800">{getActionRoleLabel()}</b>:
                  </span>

                  <button
                    type="button"
                    onClick={() => openActionModal(selectedLeave, "approved")}
                    disabled={actioningId === selectedLeave.id || isApprovalAlreadyApproved(selectedLeave)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-2xs font-poppins transition cursor-pointer"
                  >
                    {actioningId === selectedLeave.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{actioningId === selectedLeave.id ? "Approving..." : "Approve"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal(selectedLeave, "rejected")}
                    disabled={actioningId === selectedLeave.id}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-2xs font-poppins transition cursor-pointer"
                  >
                    {actioningId === selectedLeave.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{actioningId === selectedLeave.id ? "Rejecting..." : "Reject"}</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-poppins">
                  {normalizeRole(currentRole) === "admin"
                    ? "View only. Admin can act only on HR leave applications."
                    : normalizeRole(currentRole) === "hr"
                      ? "View only. HR can act after Team Lead approval or directly on Team Lead leaves."
                      : normalizeRole(currentRole) === "teamlead"
                        ? "View only. Team Lead can act only on assigned employee pending leaves."
                        : "View only. No pending action is required from your account."}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedLeave(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-medium font-poppins transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          APPROVE / REJECT ACTION MODAL WITH REQUIRED DESCRIPTION
      ======================================================== */}
      {actionModal.isOpen && actionModal.leave && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-poppins animate-in fade-in duration-150"
          onClick={closeActionModal}
        >
          <div
            className="w-full max-w-md max-h-[calc(100vh-3.5rem)] my-auto flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 font-poppins animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div
              className={`p-5 flex items-start gap-3.5 border-b shrink-0 ${
                actionModal.status === "approved"
                  ? "bg-emerald-50/80 border-emerald-100"
                  : "bg-rose-50/80 border-rose-100"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  actionModal.status === "approved"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white"
                }`}
              >
                {actionModal.status === "approved" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 font-poppins truncate">
                  {actionModal.status === "approved"
                    ? "Approve Leave Request"
                    : "Reject Leave Request"}
                </h3>
                <p className="text-xs text-slate-500 font-poppins mt-0.5">
                  Confirm action as{" "}
                  <span className="font-semibold text-slate-700">
                    {getActionRoleLabel()}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeActionModal}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* LEAVE SUMMARY PILL */}
            <div className="flex-1 overflow-y-auto modal-scrollbar p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-sm font-poppins">
                    {actionModal.leave.name}
                  </p>
                  <p className="text-slate-500 font-poppins mt-0.5">
                    {formatRole(actionModal.leave.role)} • {formatLeaveType(actionModal.leave.leaveType)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-slate-800 text-xs font-poppins">
                    {actionModal.leave.totalDays}{" "}
                    {actionModal.leave.totalDays === 1 ? "Day" : "Days"}
                  </span>
                  <p className="text-[11px] text-slate-500 font-poppins mt-1">
                    {formatDate(actionModal.leave.startDate)} -{" "}
                    {formatDate(actionModal.leave.endDate)}
                  </p>
                </div>
              </div>

              {/* DESCRIPTION / REMARK INPUT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-poppins">
                  Description / Remark{" "}
                  <span className="text-rose-500 font-bold">* (Required)</span>
                </label>
                <textarea
                  rows={3}
                  value={actionModal.remark}
                  onChange={(e) =>
                    setActionModal((prev) => ({
                      ...prev,
                      remark: e.target.value,
                    }))
                  }
                  placeholder={
                    actionModal.status === "approved"
                      ? "Enter approval description / remark (Required)..."
                      : "Enter rejection reason / description (Required)..."
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] bg-white placeholder:text-slate-400 resize-none transition font-poppins"
                  autoFocus
                />
                {!actionModal.remark?.trim() && (
                  <p className="text-[11px] text-rose-500 mt-1 font-poppins">
                    * Description is required to {actionModal.status === "approved" ? "approve" : "reject"} this leave.
                  </p>
                )}
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actioningId === actionModal.leave?.id}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50 font-poppins cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAction(
                    actionModal.leave,
                    actionModal.status,
                    actionModal.remark
                  )
                }
                disabled={
                  actioningId === actionModal.leave?.id ||
                  !actionModal.remark?.trim()
                }
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-semibold shadow-2xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-poppins cursor-pointer ${
                  actionModal.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actioningId === actionModal.leave?.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : actionModal.status === "approved" ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <X className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>
                  {actioningId === actionModal.leave?.id
                    ? "Processing..."
                    : actionModal.status === "approved"
                      ? "Confirm Approve"
                      : "Confirm Reject"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}