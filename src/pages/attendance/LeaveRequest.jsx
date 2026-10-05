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
  ShieldCheck,
} from "lucide-react";
import { isFinanceOrExcludedUser } from "../../utils/roleFilters";
import {
  getLoggedInUserIdentifiers,
  fetchTeamsList,
  isTeamOwnedByLead,
  extractAssignedTeamEmployees,
  isLeaveOfAssignedTeam,
} from "../../utils/teamLeadUtils";

const BASE_URL = "https://kt-backend-1.onrender.com/api/leave";

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
  if (normalized === "intern") return "Intern";

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

const formatDuration = (leave) => {
  const rawLeave = leave?.rawLeave || leave || {};
  const totalDays = Number(rawLeave?.totalDays ?? leave?.totalDays ?? 0);
  const isHalf = rawLeave?.isHalfDay || leave?.isHalfDay || totalDays === 0.5;
  const halfType = rawLeave?.halfDayType || leave?.halfDayType;

  if (isHalf) {
    if (halfType === "first-half") return "0.5 Day (First Half)";
    if (halfType === "second-half") return "0.5 Day (Second Half)";
    return "0.5 Day (Half Day)";
  }

  return `${totalDays} ${totalDays === 1 ? "Day" : "Days"}`;
};

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
    `${employee.firstName || ""} ${
      employee.lastName || ""
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

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError("");

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
        fetch("https://kt-backend-1.onrender.com/api/users/all", {
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

          if (employee && isFinanceOrExcludedUser(employee)) return false;

          if (!employee || Object.keys(employee).length === 0) {
            const fallbackName = leave?.name || leave?.employeeName;
            if (
              !fallbackName ||
              fallbackName === "Unknown Employee" ||
              fallbackName === "Unknown User" ||
              fallbackName === "Unknown"
            ) {
              return false;
            }
          }

          const employeeName = getEmployeeName(employee, leave);

          if (
            !employeeName ||
            employeeName === "Unknown Employee" ||
            employeeName === "Unknown User" ||
            employeeName === "Unknown"
          ) {
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
            normalizeRole(employeeRole) === "intern" ||
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

          leaveType:
            leave?.leaveType ||
            leave?.type ||
            "Leave",

          startDate:
            leave?.startDate ||
            leave?.fromDate ||
            "",

          endDate:
            leave?.endDate ||
            leave?.toDate ||
            "",

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

      setError(
        error?.message ||
          "Failed to load leave requests."
      );

      setRequests([]);
    } finally {
      setLoading(false);
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
    fetchLeaves();
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
    // EMPLOYEE / INTERN
    // Team Lead -> HR
    // --------------------------------------------------------

    if (
      role === "employee" ||
      role === "intern"
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

    const loggedRole = normalizeRole(
      currentRole
    );

    const applicantRole = normalizeRole(
      leave.role
    );

    // ========================================================
    // ADMIN
    // CAN ALWAYS EDIT HR LEAVE STATUS
    // ========================================================

    if (loggedRole === "admin") {
      return applicantRole === "hr";
    }

    if (isLeaveFinalized(leave)) {
      return false;
    }

    // ========================================================
    // HR
    // ========================================================

    if (loggedRole === "hr") {
      // HR cannot approve own leave
      if (applicantRole === "hr") {
        return false;
      }

      // Employee / Intern:
      // TL approval compulsory
      if (
        applicantRole === "employee" ||
        applicantRole === "intern"
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
        (
          applicantRole === "employee" ||
          applicantRole === "intern"
        ) &&
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
              `Failed to ${
                status === "approved"
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

    const parsed = new Date(date);

    if (
      Number.isNaN(parsed.getTime())
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
    const normalized =
      normalizeStatus(status);

    let classes =
      "bg-amber-50 text-amber-700 border-amber-200";

    if (normalized === "Approved") {
      classes =
        "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (normalized === "Rejected") {
      classes =
        "bg-red-50 text-red-700 border-red-200";
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${classes}`}
      >
        {normalized}
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
        <span className="text-sm text-gray-400">
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
      if (loggedRole === "hr" && (applicantRole === "employee" || applicantRole === "intern")) {
        if (isPending(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Waiting for TL Approval
            </span>
          );
        }
        if (isRejected(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Rejected by TL
            </span>
          );
        }
        if (isApproved(leave?.hrStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Approved by HR
            </span>
          );
        }
        if (isRejected(leave?.hrStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Rejected by HR
            </span>
          );
        }
      }

      // If logged in as Team Lead
      if (loggedRole === "teamlead") {
        if (isApproved(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Approved by You (Sent to HR)
            </span>
          );
        }
        if (isRejected(leave?.teamLeadStatus)) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Rejected by You
            </span>
          );
        }
      }

      return <StatusBadge status={leave?.adminStatus || "Pending"} />;
    }

    const isActioning = actioningId === leave.id;
    const loggedRole = normalizeRole(currentRole);
    const ApproveIcon = Check;
    let relevantStatus = leave?.adminStatus;
    if (loggedRole === "teamlead") relevantStatus = leave?.teamLeadStatus;
    else if (loggedRole === "hr") relevantStatus = leave?.hrStatus;

    const currentStatus = normalizeStatus(relevantStatus);

    if (currentStatus === "Approved") {
      return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {loggedRole === "admin" ? (
            <span
              aria-label="Approved"
              title="Approved"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Approved
            </span>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openActionModal(leave, "rejected");
            }}
            disabled={isActioning}
            title="Reject Leave"
            className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition active:scale-90 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      );
    }

    if (currentStatus === "Rejected") {
      return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openActionModal(leave, "approved");
            }}
            disabled={isActioning}
            aria-label="Approve Leave"
            title="Approve Leave"
            className="w-7 h-7 shrink-0 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center transition active:scale-90 disabled:opacity-50"
          >
            <ApproveIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openActionModal(leave, "approved");
          }}
          disabled={isActioning}
          aria-label="Approve Leave"
          title="Approve Leave"
          className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center shadow-sm transition active:scale-90 disabled:opacity-50"
        >
          <ApproveIcon className="w-4 h-4 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openActionModal(leave, "rejected");
          }}
          disabled={isActioning}
          title="Reject Leave"
          className="w-8 h-8 shrink-0 rounded-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex items-center justify-center shadow-sm transition active:scale-90 disabled:opacity-50"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    );
  };
 

  // ==========================================================
  // LOADER
  // ==========================================================

  const Loader = () => (
    <div className="flex justify-center items-center py-16 sm:py-20">
      <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
    </div>
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              Leave Requests
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Review and manage leave applications
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {currentRole && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />

                <span className="text-xs text-blue-600">
                  Role
                </span>

                <span className="text-xs font-bold text-blue-800">
                  {formatRole(currentRole)}
                </span>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500">
                Total
              </span>

              <span className="ml-2 text-sm font-bold text-gray-800">
                {requests.length}
              </span>
            </div>

          </div>
        </div>

        {/* ====================================================
            SUCCESS
        ==================================================== */}

        {success && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ====================================================
            TEAM LEAD ASSIGNED BANNER
        ==================================================== */}

        {normalizeRole(currentRole) === "teamlead" && (
          <div className="mb-4">
            {assignedTeams.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs">
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
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  No specific team assigned to your Team Lead account in <code>/api/teamLead/team</code>. Only leaves for your assigned team members will appear here.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            MAIN CARD
        ==================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* ==================================================
              SEARCH
          ================================================== */}

          <div className="p-4 border-b border-gray-200">

            <div className="flex flex-col sm:flex-row gap-3">

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  placeholder="Search employee, role, leave type..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative" ref={filterDropdownRef}>
                <button
                  type="button"
                  aria-expanded={showFilters}
                  aria-haspopup="true"
                  onClick={() =>
                    setShowFilters(
                      (previous) =>
                        !previous
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                >
                  <Filter className="w-4 h-4" />

                  Filters

                  <ChevronDown
                    className={`w-4 h-4 transition ${
                      showFilters
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
                      Leave Type
                    </p>

                    <div className="max-h-72 overflow-y-auto p-1.5">
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
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
                            filterType === option.value
                              ? "bg-blue-50 font-semibold text-blue-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {option.label}
                          {filterType === option.value && (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (
            <Loader />
          ) : filteredRequests.length === 0 ? (

            <div className="py-16 text-center">

              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 mb-4">
                <Calendar className="w-7 h-7 text-blue-500" />
              </div>

              <h3 className="text-lg font-semibold text-gray-800">
                {searchTerm ||
                filterType !== "all"
                  ? "No Results Found"
                  : "No Leave Requests"}
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ||
                filterType !== "all"
                  ? "Try changing your search or filter."
                  : "Leave applications will appear here."}
              </p>
            </div>

          ) : (

            <>
              {/* ==================================================
                  DESKTOP TABLE
              ================================================== */}

              <div className="hidden xl:block overflow-hidden">

                <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[8%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                  </colgroup>

                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        #
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Employee
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Leave
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Duration
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Dates
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Team Lead
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        HR
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Admin
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Workflow
                      </th>

                      <th className="px-2 py-3 text-left text-xs font-bold text-gray-500">
                        Approve / Reject Reason
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {filteredRequests.map(
                      (request, index) => (

                        <tr
                          key={request.id}
                          onClick={() =>
                            setSelectedLeave(
                              request
                            )
                          }
                          className="hover:bg-blue-50 cursor-pointer transition"
                        >

                          <td className="px-2 py-3 text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-2 py-3">

                              <div className="flex min-w-0 items-center gap-2">

                              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {getInitials(
                                  request.name
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="break-words font-semibold text-gray-800">
                                  {request.name}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {formatRole(
                                    request.role
                                  )}
                                </p>
                              </div>

                            </div>
                          </td>

                          <td className="px-2 py-3">

                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getLeaveTypeStyle(
                                request.leaveType
                              )}`}
                            >
                              {getLeaveTypeIcon(
                                request.leaveType
                              )}

                              {formatLeaveType(request.leaveType)}
                            </span>
                          </td>

                          <td className="px-2 py-3 font-semibold text-gray-800">
                            {formatDuration(request)}
                          </td>

                          <td className="px-2 py-3 text-xs text-gray-600">
                            <span className="block">{formatDate(request.startDate)}</span>
                            <span className="block">to {formatDate(request.endDate)}</span>
                          </td>

                          <td className="px-2 py-3">
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

                          <td className="px-2 py-3">
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

                          <td className="px-2 py-3">
                            {normalizeRole(request.role) === "hr" ? (
                              normalizeRole(currentRole) === "admin" && canTakeAction(request) ? (
                                <ApprovalActions leave={request} />
                              ) : (
                                <StatusBadge status={request.adminStatus} />
                              )
                            ) : (
                              <span className="text-sm text-gray-400">
                                -
                              </span>
                            )}
                          </td>

                          <td className="px-2 py-3">
                            <span className="text-xs font-medium text-gray-600">
                              {getWorkflowText(
                                request
                              )}
                            </span>
                          </td>

                          <td className="px-2 py-3">
                            {request.teamLeadRemark || request.hrRemark || request.adminRemark || request.remark || request.description ? (
                              <div className="space-y-1.5 text-xs">
                                {request.teamLeadRemark && (
                                  <div className="flex items-start gap-1">
                                    <span className="font-bold text-amber-700 shrink-0">TL:</span>
                                    <span className="text-gray-700 whitespace-normal break-words">
                                      {request.teamLeadRemark}
                                    </span>
                                  </div>
                                )}
                                {request.hrRemark && (
                                  <div className="flex items-start gap-1">
                                    <span className="font-bold text-purple-700 shrink-0">HR:</span>
                                    <span className="text-gray-700 whitespace-normal break-words">
                                      {request.hrRemark}
                                    </span>
                                  </div>
                                )}
                                {request.adminRemark && (
                                  <div className="flex items-start gap-1">
                                    <span className="font-bold text-blue-700 shrink-0">Admin:</span>
                                    <span className="text-gray-700 whitespace-normal break-words">
                                      {request.adminRemark}
                                    </span>
                                  </div>
                                )}
                                {!request.teamLeadRemark && !request.hrRemark && !request.adminRemark && (request.remark || request.description) && (
                                  <span className="text-gray-700 whitespace-normal break-words">
                                    {request.remark || request.description}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>
                </table>
              </div>

              {/* ==================================================
                  MOBILE CARDS
              ================================================== */}

              <div className="xl:hidden p-3 space-y-3">

                {filteredRequests.map(
                  (request) => (

                    <div
                      key={request.id}
                      onClick={() =>
                        setSelectedLeave(
                          request
                        )
                      }
                      className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {getInitials(
                              request.name
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-gray-800">
                              {request.name}
                            </p>

                            <p className="text-xs text-gray-500">
                              {formatRole(
                                request.role
                              )}
                            </p>
                          </div>

                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${getLeaveTypeStyle(
                            request.leaveType
                          )}`}
                        >
                          {getLeaveTypeIcon(
                            request.leaveType
                          )}

                          {formatLeaveType(request.leaveType)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">

                        <div>
                          <p className="text-[11px] text-gray-400 uppercase">
                            Dates
                          </p>

                          <p className="text-xs font-medium text-gray-700 mt-1">
                            {formatDate(
                              request.startDate
                            )}
                            {" - "}
                            {formatDate(
                              request.endDate
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-gray-400 uppercase">
                            Duration
                          </p>

                          <p className="text-xs font-semibold text-gray-700 mt-1">
                            {formatDuration(request)}
                          </p>
                        </div>
                      </div>

                      {request.reason && (
                        <div className="mt-3 flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />

                          <p className="text-xs text-gray-500 line-clamp-2">
                            {request.reason}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-3 gap-2">

                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">
                            TEAM LEAD
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
                          <p className="text-[10px] text-gray-400 mb-1">
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
                          <p className="text-[10px] text-gray-400 mb-1">
                            ADMIN
                          </p>

                          {normalizeRole(request.role) === "hr" ? (
                            normalizeRole(currentRole) === "admin" && canTakeAction(request) ? (
                              <ApprovalActions leave={request} />
                            ) : (
                              <StatusBadge
                                status={
                                  request.adminStatus
                                }
                              />
                            )
                          ) : (
                            <span className="text-sm text-gray-400">
                              -
                            </span>
                          )}
                        </div>

                      </div>

                      {(request.teamLeadRemark || request.hrRemark || request.adminRemark || request.remark || request.description) && (
                        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1 text-xs">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Approve / Reject Reason
                          </p>
                          {request.teamLeadRemark && (
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold text-amber-700">TL: </span>
                              {request.teamLeadRemark}
                            </p>
                          )}
                          {request.hrRemark && (
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold text-purple-700">HR: </span>
                              {request.hrRemark}
                            </p>
                          )}
                          {request.adminRemark && (
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold text-blue-700">Admin: </span>
                              {request.adminRemark}
                            </p>
                          )}
                          {!request.teamLeadRemark && !request.hrRemark && !request.adminRemark && (request.remark || request.description) && (
                            <p className="text-xs text-gray-600">
                              {request.remark || request.description}
                            </p>
                          )}
                        </div>
                      )}

                    </div>
                  )
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================
          DETAILS MODAL
      ======================================================== */}

      {selectedLeave && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          onClick={() =>
            setSelectedLeave(null)
          }
        >

          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">

              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Leave Details
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Complete leave approval information
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedLeave(null)
                }
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* ==================================================
                MODAL BODY
            ================================================== */}

            <div className="p-5 space-y-5">

              {/* EMPLOYEE */}

              <div className="flex items-center gap-4">

                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
                  {getInitials(
                    selectedLeave.name
                  )}
                </div>

                <div className="flex-1">

                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedLeave.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mt-1">

                    <span className="text-sm text-gray-500">
                      {formatRole(
                        selectedLeave.role
                      )}
                    </span>

                    {selectedLeave.email && (
                      <>
                        <span className="text-gray-300">
                          •
                        </span>

                        <span className="text-xs text-gray-500">
                          {selectedLeave.email}
                        </span>
                      </>
                    )}

                  </div>
                </div>
              </div>

              {/* LEAVE INFO */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div className="border border-gray-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <FileText className="w-4 h-4" />

                    <span className="text-xs font-semibold">
                      Leave Type
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getLeaveTypeStyle(
                      selectedLeave.leaveType
                    )}`}
                  >
                    {getLeaveTypeIcon(
                      selectedLeave.leaveType
                    )}

                    {formatLeaveType(selectedLeave.leaveType)}
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Clock className="w-4 h-4" />

                    <span className="text-xs font-semibold">
                      Duration
                    </span>
                  </div>

                  <p className="text-sm font-bold text-gray-800">
                    {formatDuration(selectedLeave)}
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar className="w-4 h-4" />

                    <span className="text-xs font-semibold">
                      Start Date
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-gray-800">
                    {formatDate(
                      selectedLeave.startDate
                    )}
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <CalendarDays className="w-4 h-4" />

                    <span className="text-xs font-semibold">
                      End Date
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-gray-800">
                    {formatDate(
                      selectedLeave.endDate
                    )}
                  </p>
                </div>

              </div>

              {/* REASON */}

              <div className="border border-gray-200 rounded-xl p-4">

                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <MessageSquare className="w-4 h-4" />

                  <span className="text-sm font-semibold">
                    Reason
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-6">
                  {selectedLeave.reason ||
                    "No reason provided."}
                </p>
              </div>

              {/* ==================================================
                  APPROVAL FLOW
              ================================================== */}

              <div className="border border-gray-200 rounded-xl p-4">

                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />

                  <h3 className="text-sm font-bold text-gray-800">
                    Approval Flow
                  </h3>
                </div>

                <div className="space-y-4">

                  {/* TEAM LEAD */}

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Team Lead
                        </p>

                        <p className="text-xs text-gray-500">
                          First approval
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

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          HR
                        </p>

                        <p className="text-xs text-gray-500">
                          HR approval
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

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Admin
                        </p>

                        <p className="text-xs text-gray-500">
                          Required for HR leave
                        </p>
                      </div>
                    </div>

                    {normalizeRole(selectedLeave.role) === "hr" ? (
                      <StatusBadge
                        status={
                          selectedLeave.adminStatus
                        }
                      />
                    ) : (
                      <span className="text-sm text-gray-400">
                        -
                      </span>
                    )}
                  </div>

                </div>
              </div>

              {/* ==================================================
                  CURRENT WORKFLOW
              ================================================== */}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">

                <p className="text-xs font-semibold text-blue-600">
                  Current Workflow
                </p>

                <p className="text-sm font-bold text-blue-800 mt-1">
                  {getWorkflowText(
                    selectedLeave
                  )}
                </p>
              </div>

              {/* REMARKS & DESCRIPTIONS */}
              {(selectedLeave.teamLeadRemark ||
                selectedLeave.hrRemark ||
                selectedLeave.adminRemark ||
                selectedLeave.remark) && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Remarks & Descriptions
                    </span>
                  </div>

                  {selectedLeave.teamLeadRemark && (
                    <div className="bg-white border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Team Lead Remark
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">
                        {selectedLeave.teamLeadRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.hrRemark && (
                    <div className="bg-white border border-purple-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          HR Remark
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">
                        {selectedLeave.hrRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.adminRemark && (
                    <div className="bg-white border border-amber-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Admin Remark
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">
                        {selectedLeave.adminRemark}
                      </p>
                    </div>
                  )}

                  {selectedLeave.remark &&
                    selectedLeave.remark !== selectedLeave.teamLeadRemark &&
                    selectedLeave.remark !== selectedLeave.hrRemark &&
                    selectedLeave.remark !== selectedLeave.adminRemark && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            Description / Remark
                          </span>
                        </div>
                        <p className="text-xs text-gray-700">
                          {selectedLeave.remark}
                        </p>
                      </div>
                    )}
                </div>
              )}

            </div>

            {/* ==================================================
                MODAL FOOTER
            ================================================== */}

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                {/* ACTION */}

                {canTakeAction(
                  selectedLeave
                ) ? (

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="text-xs text-gray-500 mr-1">
                      Action as{" "}
                      <b className="text-gray-700">
                        {getActionRoleLabel()}
                      </b>
                    </span>

                    {/* APPROVE */}

                    <button
                      type="button"
                      onClick={() =>
                        openActionModal(
                          selectedLeave,
                          "approved"
                        )
                      }
                      disabled={
                        actioningId === selectedLeave.id ||
                        isApprovalAlreadyApproved(selectedLeave)
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold"
                    >
                      <CheckCircle className="w-4 h-4" />

                      {actioningId ===
                      selectedLeave.id
                        ? "Processing..."
                        : "Approve"}
                    </button>

                    {/* REJECT */}

                    <button
                      type="button"
                      onClick={() =>
                        openActionModal(
                          selectedLeave,
                          "rejected"
                        )
                      }
                      disabled={
                        actioningId ===
                        selectedLeave.id
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold"
                    >
                      <XCircle className="w-4 h-4" />

                      {actioningId ===
                      selectedLeave.id
                        ? "Processing..."
                        : "Reject"}
                    </button>

                  </div>

                ) : (

                  <div className="text-xs text-gray-500">

                    {normalizeRole(
                      currentRole
                    ) === "admin"
                      ? "View only. Admin can approve/reject only HR leave pending for Admin approval."
                      : normalizeRole(
                          currentRole
                        ) === "hr"
                      ? "View only. HR can act after Team Lead approval or directly on Team Lead leave."
                      : normalizeRole(
                          currentRole
                        ) === "teamlead"
                      ? "View only. Team Lead can act only on Employee/Intern pending leaves."
                      : "View only. No action is required from your role."}

                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedLeave(null)
                  }
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium"
                >
                  Close
                </button>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          APPROVE / REJECT ACTION MODAL WITH DESCRIPTION
      ======================================================== */}
      {actionModal.isOpen && actionModal.leave && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          onClick={closeActionModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div
              className={`p-5 flex items-start gap-4 border-b ${
                actionModal.status === "approved"
                  ? "bg-emerald-50/70 border-emerald-100"
                  : "bg-rose-50/70 border-rose-100"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  actionModal.status === "approved"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white"
                }`}
              >
                {actionModal.status === "approved" ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-800">
                  {actionModal.status === "approved"
                    ? "Approve Leave Request"
                    : "Reject Leave Request"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confirm action as{" "}
                  <span className="font-semibold text-gray-700">
                    {getActionRoleLabel()}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeActionModal}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-400 hover:text-gray-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* LEAVE SUMMARY PILL */}
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-gray-800 text-sm">
                    {actionModal.leave.name}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {formatRole(actionModal.leave.role)} • {formatLeaveType(actionModal.leave.leaveType)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-white border border-gray-200 font-bold text-gray-800">
                    {actionModal.leave.totalDays}{" "}
                    {actionModal.leave.totalDays === 1 ? "Day" : "Days"}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {formatDate(actionModal.leave.startDate)} -{" "}
                    {formatDate(actionModal.leave.endDate)}
                  </p>
                </div>
              </div>

              {/* DESCRIPTION / REMARK INPUT */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>
                    Description / Remark{" "}
                    <span className="text-rose-500 font-bold">* (Required)</span>
                  </span>
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
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-gray-400 resize-none transition"
                  autoFocus
                />
                {!actionModal.remark?.trim() && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    * Description is required to {actionModal.status === "approved" ? "approve" : "reject"} this leave.
                  </p>
                )}
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actioningId === actionModal.leave?.id}
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
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
                className={`inline-flex items-center gap-1.5 px-5 py-2 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actioningId === actionModal.leave?.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : actionModal.status === "approved" ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <X className="w-4 h-4 stroke-[2.5]" />
                )}
                {actioningId === actionModal.leave?.id
                  ? "Processing..."
                  : actionModal.status === "approved"
                  ? "Confirm Approve"
                  : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}