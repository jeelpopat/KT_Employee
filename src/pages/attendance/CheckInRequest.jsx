import { useState, useEffect } from "react";
import { LoadingScreen, TableSkeleton } from "../../components/common/Loader.jsx";
import {
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  Users,
  Calendar,
  X,
  Building2,
  Phone,
  Mail,
  Shield,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { isFinanceOrExcludedUser, isUnknownEmployeeOrUser } from "../../utils/roleFilters";
import { useApp } from "../../context/AppContext";
import { BASE_URL } from "../../api/config.js";

// Validate 24-character hexadecimal MongoDB ObjectId
const isValidObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id.trim());

// Safe JWT parser with proper base64url padding and Unicode decoding
const parseJwtPayload = (token) => {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    const jsonStr = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonStr);
  } catch (e1) {
    try {
      const parts = token.split(".");
      return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e2) {
      return null;
    }
  }
};

// Recursively inspect candidate objects for a valid MongoDB ObjectId
const extractIdFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return null;

  const candidates = [
    obj._id,
    obj.id,
    obj.userId,
    obj.userID,
    obj.user?._id,
    obj.user?.id,
    obj.user?.userId,
    obj.user?.userID,
    obj.data?._id,
    obj.data?.id,
    obj.data?.userId,
    obj.data?.user?._id,
    obj.data?.user?.id,
    obj.profile?._id,
    obj.profile?.id,
    obj.employee?._id,
    obj.employee?.userId,
    obj.employee?.userID,
    obj.sub,
  ];

  for (const c of candidates) {
    if (isValidObjectId(c)) return String(c).trim();
  }
  return null;
};

// Retrieve authentic dynamic logged-in admin user ID (NEVER static mock IDs)
const getLoggedInAdminId = (fallbackUser = null) => {
  // 1. From contextUser passed into function
  if (fallbackUser) {
    const fromCtx = extractIdFromObject(fallbackUser);
    if (fromCtx) return fromCtx;
  }

  // 2. From localStorage keys: auth_user, user, profile, currentUser
  const storageKeys = ["auth_user", "user", "profile", "currentUser", "kt_admin_user"];
  for (const k of storageKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        const id = extractIdFromObject(parsed);
        if (id) return id;
      }
    } catch {}
  }

  // 3. From decoded JWT token payload
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  if (token) {
    const payload = parseJwtPayload(token);
    if (payload) {
      const id = extractIdFromObject(payload);
      if (id) return id;
    }
  }

  return null;
};

const PENDING_URL =
  `${BASE_URL}/api/attendance/pending`;

const APPROVE_URL =
  `${BASE_URL}/api/attendance/approve`;

const REJECT_URL =
  `${BASE_URL}/api/attendance/reject`;

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-indigo-600",
  "bg-teal-600",
];

// ============================================================
// NORMALIZE API RESPONSE
// ============================================================
const normalizeRequests = (payload) => {
  const arrayKeys = [
    "pendingRequests",
    "approvedRequests",
    "rejectedRequests",
    "pending",
    "approved",
    "rejected",
    "pendingAttendances",
    "approvedAttendances",
    "rejectedAttendances",
    "approvedCheckIns",
    "rejectedCheckIns",
    "checkIns",
    "checkInRequests",
    "attendanceRequests",
    "attendanceRecords",
    "allRequests",
    "allRecords",
    "allAttendances",
    "requests",
    "data",
    "attendance",
    "logs",
    "records",
    "result",
    "items",
  ];
  const envelopeKeys = ["data", "result", "payload", "response", "summary", "attendance", "requests", "records", "items"];
  const visited = new WeakSet();
  const records = [];

  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 5 || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) records.push(item);
      });
      return;
    }

    arrayKeys.forEach((key) => {
      if (!Array.isArray(value[key])) return;
      const statusHint = key.toLowerCase().startsWith("approved")
        ? "approved"
        : key.toLowerCase().startsWith("rejected")
          ? "rejected"
          : key.toLowerCase().startsWith("pending")
            ? "pending"
            : "";

      value[key].forEach((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        const currentStatus = String(item.approvalStatus || "").toLowerCase().trim();
        const generalStatus = String(item.status || "").toLowerCase().trim();
        const hasExplicitDecision = ["approved", "rejected", "pending"].includes(currentStatus) ||
          ["approved", "rejected", "pending"].includes(generalStatus) ||
          isRecordApproved(item) ||
          isRecordRejected(item);
        records.push(statusHint && !hasExplicitDecision
          ? { ...item, __approvalStatusHint: statusHint }
          : item);
      });
    });

    envelopeKeys.forEach((key) => {
      if (value[key] && typeof value[key] === "object") visit(value[key], depth + 1);
    });

    if (value._id || value.id || value.userId || value.attendanceId) {
      records.push(value);
    }
  };

  visit(payload);

  const uniqueRecords = new Map();
  records.forEach((record, index) => {
    const key = record.attendanceId || record._id || record.id || `unkeyed-${index}`;
    const existing = uniqueRecords.get(String(key));
    if (!existing || record.__approvalStatusHint) {
      uniqueRecords.set(String(key), { ...existing, ...record });
    }
  });
  return [...uniqueRecords.values()];
};

// ============================================================
// DATE & STORAGE HELPERS FOR APPROVED CHECK-IN REQUESTS
// ============================================================
const getTodayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getYesterdayLocal = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getApprovedStore = () => {
  try {
    const raw = localStorage.getItem("kt_approved_attendance_store");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveApprovedToStore = (item) => {
  if (!item) return;
  try {
    const store = getApprovedStore();
    const targetKey = String(item.attendanceId || item.id || item._id || "");
    const targetUser = String(item.userId || item.employeeUserId || "");
    const targetDate = item.date;

    const filtered = store.filter((existing) => {
      const eKey = String(existing.attendanceId || existing.id || existing._id || "");
      const eUser = String(existing.userId || existing.employeeUserId || "");
      if (targetKey && eKey && targetKey === eKey) return false;
      if (targetUser && eUser && targetUser === eUser && targetDate && existing.date === targetDate) return false;
      return true;
    });

    filtered.unshift({
      ...item,
      approvalStatus: "approved",
      approvedAt: item.approvedAt || Date.now(),
    });

    localStorage.setItem("kt_approved_attendance_store", JSON.stringify(filtered.slice(0, 300)));
  } catch (err) {
    console.warn("Error saving to approved store:", err);
  }
};

// ============================================================
// FORMAT DATE (Matches UI specification: MM/DD/YYYY, e.g. 10/21/2026)
// ============================================================
const formatDate = (value) => {
  if (!value) return "N/A";

  // Backend date field is normally YYYY-MM-DD
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
  ) {
    const [year, month, day] = value.trim().split("-");
    return `${month}/${day}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

// ============================================================
// FORMAT CHECK-IN TIME (Matches UI specification: e.g. 10:00 AM)
// ============================================================
const formatCheckInTime = (value) => {
  if (!value) return "N/A";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/\b(am|pm)\b/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// ============================================================
// EXTRACT EMPLOYEE INITIALS (e.g. "Pandya Hetvi" -> "HP")
// ============================================================
const getEmployeeInitials = (req) => {
  if (!req) return "EM";
  const raw = req.raw || req;
  const firstName =
    raw.firstName ||
    raw.userId?.firstName ||
    raw.user?.firstName ||
    raw.employee?.firstName ||
    raw.employeeId?.firstName;
  const lastName =
    raw.lastName ||
    raw.userId?.lastName ||
    raw.user?.lastName ||
    raw.employee?.lastName ||
    raw.employeeId?.lastName;

  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }

  const name = (req.name || "").replace(/\([^)]*\)/g, "").trim();
  if (!name) return "EM";

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

// ============================================================
// HELPER: EXTRACT ATTENDANCE ID
// ============================================================
const extractAttendanceId = (item) => {
  if (!item) return "";
  if (typeof item === "string" && isValidObjectId(item)) return item.trim();
  if (typeof item !== "object") return "";

  const candidates = [
    item.attendanceId,
    item.attendance?._id,
    item.attendance?.id,
    item._id,
    item.id,
    item.attendanceRecordId,
    item.attendance_id,
    item.raw?.attendanceId,
    item.raw?.attendance?._id,
    item.raw?._id,
  ];

  for (const c of candidates) {
    if (isValidObjectId(c)) return String(c).trim();
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && !c.includes("-")) return c.trim();
  }

  return "";
};

// ============================================================
// HELPER: EXTRACT EMPLOYEE USER ID (TARGET USER TO APPROVE/REJECT)
// ============================================================
const extractEmployeeUserId = (item, allUsersList = []) => {
  if (!item) return "";

  // 1. Check direct fields on item and raw item
  const candidates = [
    typeof item.userId === "object" ? (item.userId?._id || item.userId?.id) : item.userId,
    typeof item.user === "object" ? (item.user?._id || item.user?.id) : item.user,
    typeof item.employeeId === "object" ? (item.employeeId?._id || item.employeeId?.id || item.employeeId?.userId) : item.employeeId,
    typeof item.employeeID === "object" ? (item.employeeID?._id || item.employeeID?.id || item.employeeID?.userId) : item.employeeID,
    typeof item.employee === "object" ? (item.employee?._id || item.employee?.userId || item.employee?.id) : item.employee,
    typeof item.attendance === "object" ? (
      (typeof item.attendance.userId === "object" ? (item.attendance.userId?._id || item.attendance.userId?.id) : item.attendance.userId) ||
      (typeof item.attendance.user === "object" ? (item.attendance.user?._id || item.attendance.user?.id) : item.attendance.user) ||
      (typeof item.attendance.employeeId === "object" ? (item.attendance.employeeId?._id || item.attendance.employeeId?.id) : item.attendance.employeeId)
    ) : null,
    item.raw ? (
      (typeof item.raw.userId === "object" ? (item.raw.userId?._id || item.raw.userId?.id) : item.raw.userId) ||
      (typeof item.raw.user === "object" ? (item.raw.user?._id || item.raw.user?.id) : item.raw.user) ||
      (typeof item.raw.employeeId === "object" ? (item.raw.employeeId?._id || item.raw.employeeId?.id || item.raw.employeeId?.userId) : item.raw.employeeId) ||
      (typeof item.raw.employee === "object" ? (item.raw.employee?._id || item.raw.employee?.userId || item.raw.employee?.id) : item.raw.employee)
    ) : null,
    item.employeeUserId,
    item.userID,
    item.targetUserId,
  ];

  for (const c of candidates) {
    if (isValidObjectId(c)) return String(c).trim();
  }

  // 2. If not a valid 24-character ObjectId, match from allUsersList (by email, name, uniqueID)
  if (Array.isArray(allUsersList) && allUsersList.length > 0) {
    const itemEmail = String(
      item.email ||
      item.userId?.email ||
      item.user?.email ||
      item.employee?.email ||
      item.employeeId?.email ||
      item.raw?.email ||
      item.raw?.userId?.email ||
      ""
    ).toLowerCase().trim();

    if (itemEmail) {
      const match = allUsersList.find(
        (u) => u.email && u.email.toLowerCase().trim() === itemEmail
      );
      if (match && isValidObjectId(match._id)) return String(match._id).trim();
    }

    const itemName = String(
      item.employeeName ||
      item.name ||
      item.userId?.name ||
      item.user?.name ||
      item.employee?.name ||
      item.raw?.employeeName ||
      item.raw?.name ||
      ""
    ).toLowerCase().trim();

    if (itemName && itemName !== "unknown employee" && itemName !== "unknown user" && itemName !== "unknown") {
      const match = allUsersList.find(
        (u) => u.name && u.name.toLowerCase().trim() === itemName
      );
      if (match && isValidObjectId(match._id)) return String(match._id).trim();
    }

    const itemEmpId = String(
      item.uniqueID ||
      item.employeeID ||
      item.userId?.employeeID ||
      item.userId?.uniqueID ||
      item.raw?.uniqueID ||
      item.raw?.employeeID ||
      ""
    ).toLowerCase().trim();

    if (itemEmpId) {
      const match = allUsersList.find(
        (u) => (u.uniqueID && u.uniqueID.toLowerCase().trim() === itemEmpId) ||
               (u.employeeID && u.employeeID.toLowerCase().trim() === itemEmpId)
      );
      if (match && isValidObjectId(match._id)) return String(match._id).trim();
    }
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return "";
};

// ============================================================
// ATTENDANCE STATUS EVALUATION HELPERS
// ============================================================
const isRecordApproved = (item) => {
  if (!item) return false;
  const s = String(item.approvalStatus || item.status || "").toLowerCase().trim();
  if (s === "approved") return true;
  if (item.isApproved === true || item.isApprovedCheckIn === true) return true;
  if (Boolean(item.approvedCheckInTime) || Boolean(item.approvedBy) || Boolean(item.approverId)) return true;
  if (item.checkInTime && item.effectiveCheckInTime && !item.rejectionReason && !item.rejectedBy && s !== "rejected" && s !== "pending") {
    return true;
  }
  return false;
};

const isRecordRejected = (item) => {
  if (!item) return false;
  const s = String(item.approvalStatus || item.status || "").toLowerCase().trim();
  if (s === "rejected") return true;
  if (item.isRejected === true || item.isRejectedCheckIn === true) return true;
  if (Boolean(item.rejectionReason) || Boolean(item.rejectedBy)) return true;
  return false;
};

const isExplicitlyExcludedAttendanceRequest = (item) => {
  const people = [
    item,
    item?.userId,
    item?.user,
    item?.employeeId,
    item?.employee,
    item?.attendance?.userId,
    item?.attendance?.user,
    item?.attendance?.employee,
  ].filter((person) => person && typeof person === "object");

  return people.some((person) => isFinanceOrExcludedUser({
    role: person.role || person.userRole || person.roleType || item.role || item.userRole,
    department: person.department || person.dept || item.department || item.dept,
    designation: person.designation || person.jobTitle || person.position || item.designation,
  }));
};

const hasStableAttendanceRequestId = (item) => Boolean(
  extractAttendanceId(item) ||
  item?._id ||
  item?.id ||
  extractEmployeeUserId(item)
);

// ============================================================
// MAP BACKEND REQUEST (ENRICHED WITH BACKEND IST & EMPLOYEE DATA)
// ============================================================
const mapRequest = (item, index) => {
  const actualCheckInTime =
    item.checkInTimeDisplay ||
    item.timeDisplay ||
    item.checkInTimeIST ||
    item.istTime ||
    item.timeIST ||
    item.formattedTime ||
    item.time ||
    item.checkInTime ||
    item.requestedTime ||
    item.punchInTime ||
    item.attendanceTime ||
    item.checkIn?.time ||
    (typeof item.checkIn === "string" ? item.checkIn : "") ||
    item.attendance?.checkInTime ||
    item.requestedAt ||
    "N/A";

  const attendanceId = extractAttendanceId(item);
  const employeeUserId = extractEmployeeUserId(item);

  // Rich employee name extraction from backend enrichment
  const rawEmployeeName =
    item.employeeName ||
    (typeof item.employee === "object" ? (item.employee?.name || `${item.employee?.firstName || ""} ${item.employee?.lastName || ""}`.trim()) : (typeof item.employee === "string" && !isValidObjectId(item.employee) ? item.employee : "")) ||
    (typeof item.user === "object" ? (item.user?.name || `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.trim()) : "") ||
    item.name ||
    item.userId?.name ||
    item.employeeId?.name ||
    item.employeeID?.name ||
    item.userID?.name ||
    item.attendance?.employee?.name ||
    item.attendance?.user?.name ||
    "";

  const employeeIdentifier = employeeUserId || attendanceId || item._id || item.id;
  const employeeName = rawEmployeeName && !isUnknownEmployeeOrUser(rawEmployeeName)
    ? rawEmployeeName
    : employeeIdentifier
      ? `Employee (${String(employeeIdentifier).slice(-6)})`
      : "Employee";

  // Rich employee ID extraction
  const resolvedEmployeeId =
    (typeof item.employeeId === "string" ? item.employeeId : (item.employeeId?.employeeID || item.employeeId?.uniqueID || item.employeeId?._id)) ||
    (typeof item.employee === "object" ? (item.employee?.employeeId || item.employee?.uniqueID || item.employee?.employeeID) : null) ||
    (typeof item.user === "object" ? (item.user?.employeeId || item.user?.uniqueID || item.user?.employeeID) : null) ||
    item.uniqueID ||
    item.employeeID ||
    "";

  // Rich department
  const resolvedDepartment =
    item.department ||
    (typeof item.employee === "object" ? item.employee?.department : null) ||
    (typeof item.user === "object" ? item.user?.department : null) ||
    item.userId?.department ||
    item.employeeId?.department ||
    "";

  // Rich email
  const resolvedEmail =
    item.email ||
    (typeof item.employee === "object" ? item.employee?.email : null) ||
    (typeof item.user === "object" ? item.user?.email : null) ||
    item.userId?.email ||
    item.employeeId?.email ||
    "";

  // Rich phone
  const resolvedPhone =
    item.phone ||
    (typeof item.employee === "object" ? item.employee?.phone : null) ||
    (typeof item.user === "object" ? item.user?.phone : null) ||
    item.userId?.phone ||
    item.employeeId?.phone ||
    "";

  // Timeline events array
  const resolvedTimeline = Array.isArray(item.timeline)
    ? item.timeline
    : (Array.isArray(item.attendance?.timeline) ? item.attendance.timeline : []);

  // Case-insensitive approval status matching (handles pending, Pending, PENDING, approved, rejected)
  const resolvedApprovalStatus = (() => {
    const rawStatus = String(item.approvalStatus || "").toLowerCase().trim();
    if (rawStatus === "approved" || rawStatus === "rejected" || rawStatus === "pending") {
      return rawStatus;
    }
    if (isRecordRejected(item)) return "rejected";
    if (isRecordApproved(item)) return "approved";
    if (["approved", "rejected", "pending"].includes(item.__approvalStatusHint)) {
      return item.__approvalStatusHint;
    }
    const generalStatus = String(item.status || "").toLowerCase().trim();
    if (generalStatus === "rejected") return "rejected";
    if (generalStatus === "approved") return "approved";
    return "pending";
  })();

  return {
    raw: item,
    id:
      attendanceId ||
      item._id ||
      item.id ||
      `${item.date || item.requestedTime || Date.now()}-${index}`,

    attendanceId: attendanceId || item._id || item.id || "",

    userId: employeeUserId,
    employeeUserId: employeeUserId,
    employeeId: resolvedEmployeeId,

    name: employeeName,

    role:
      item.role ||
      item.userId?.role ||
      item.user?.role ||
      item.employee?.role ||
      item.employeeId?.role ||
      "Employee",

    requestedTime: formatCheckInTime(actualCheckInTime),

    checkInTime: item.checkInTime || null,

    checkInTimeDisplay:
      item.checkInTimeDisplay || null,

    checkInTimeFullDisplay:
      item.checkInTimeFullDisplay || null,

    date:
      item.date ||
      "",

    approvalStatus: resolvedApprovalStatus,

    avatarColor:
      item.avatarColor ||
      AVATAR_COLORS[index % AVATAR_COLORS.length],

    email: resolvedEmail,

    phone: resolvedPhone,

    department: resolvedDepartment,

    timeline: resolvedTimeline,

    isLate:
      item.isLate || false,

    status:
      item.status || "absent",

    approvedAt:
      item.approvedAt || null,

    approvedAtDisplay:
      item.approvedAtDisplay || null,

    // ========================================================
    // REJECTION REASON
    // ========================================================
    rejectionReason:
      item.rejectionReason ||
      null,
  };
};

export default function CheckInRequest() {
  const { user: contextUser, userRole } = useApp();
  const isTeamLead =
    userRole === 'team_leader' ||
    userRole === 'team lead' ||
    contextUser?.role === 'team_leader' ||
    contextUser?.role === 'team lead';

  const [adminApproverId, setAdminApproverId] = useState(() => getLoggedInAdminId(contextUser));
  const [allUsers, setAllUsers] = useState([]);

  const [requests, setRequests] = useState([]);
  const [serverCounts, setServerCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Initial page loading
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [actioningId, setActioningId] = useState(null);

  const [rejectingRequest, setRejectingRequest] = useState(null);

  const [rejectionReason, setRejectionReason] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedDate, setSelectedDate] = useState("");

  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

  // Dynamically resolve authentic live Admin / Approver MongoDB ID and all users
  useEffect(() => {
    let isMounted = true;
    const resolveLiveAdminId = async () => {
      // 1. Initial resolution from memory / storage
      const initialId = getLoggedInAdminId(contextUser);
      if (initialId && isMounted) {
        setAdminApproverId(initialId);
      }

      const tok = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      };

      // 2. Query live /api/users/profile
      try {
        const pRes = await fetch(`${BASE_URL}/api/users/profile`, { headers });
        if (pRes.ok) {
          const pData = await pRes.json();
          const pId = extractIdFromObject(pData);
          if (pId && isMounted) {
            setAdminApproverId(pId);
          }
        }
      } catch (err) {
        console.warn("Could not fetch /api/users/profile for approver ID:", err?.message);
      }

      // 3. Query /api/users/all for user list and approver fallback
      try {
        const uRes = await fetch(`${BASE_URL}/api/users/all`, { headers });
        if (uRes.ok) {
          const uData = await uRes.json();
          const list = uData?.users || uData?.data || (Array.isArray(uData) ? uData : []);

          if (isMounted && Array.isArray(list)) {
            setAllUsers(list);
          }

          let currentEmail = null;
          try {
            const rawUser = JSON.parse(localStorage.getItem("auth_user") || localStorage.getItem("user") || "{}");
            currentEmail = rawUser?.email || rawUser?.user?.email || null;
          } catch {}

          let matched = null;
          if (currentEmail) {
            matched = list.find((u) => u.email && u.email.toLowerCase() === currentEmail.toLowerCase());
          }
          if (!matched) {
            matched = list.find((u) => {
              const r = String(u.role || "").toLowerCase().trim();
              return r === "admin" || r === "hr" || r === "team_leader" || r === "team lead" || r === "tl";
            });
          }

          if (matched && isMounted) {
            const mId = extractIdFromObject(matched);
            if (mId) {
              setAdminApproverId(mId);
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch /api/users/all for approver ID:", err?.message);
      }
    };

    resolveLiveAdminId();
    return () => {
      isMounted = false;
    };
  }, [contextUser]);

  // ============================================================
  // FETCH PENDING REQUESTS (SUPPORTS DYNAMIC STATUS, TAB & DATE FILTERING)
  // ============================================================
  const fetchPendingRequests = async (
    statusParam = filterStatus,
    dateParam = selectedDate,
    isSilent = false
  ) => {
    if (!isSilent) {
      setLoading(true);
      setError("");
    }

    try {
      if (!token) {
        if (!isSilent) setError("Please login first.");
        return;
      }

      // Build authoritative query params supported by attendanceController.js
      const params = new URLSearchParams();
      const effStatus = String(statusParam || "").toLowerCase().trim();

      if (effStatus && effStatus !== "all") {
        params.set("status", effStatus);
        params.set("approvalStatus", effStatus);
        params.set("tab", effStatus);
        params.set("filter", effStatus);
      } else {
        params.set("status", "all");
        params.set("approvalStatus", "all");
        params.set("tab", "all");
        params.set("filter", "all");
      }

      const effDate = typeof dateParam === "string" ? dateParam.trim() : "";
      if (effDate) {
        params.set("date", effDate);
      }

      params.set("_t", String(Date.now()));
      const targetUrl = `${PENDING_URL}?${params.toString()}`;

      const res = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch requests: ${res.status}`);
      }

      const data = await res.json();

      // Read authoritative counters directly from backend API response
      const apiPending = typeof data?.pendingCount === "number"
        ? data.pendingCount
        : (typeof data?.summary?.pendingCount === "number" ? data.summary.pendingCount : null);

      const apiApproved = typeof data?.approvedCount === "number"
        ? data.approvedCount
        : (typeof data?.summary?.approvedCount === "number" ? data.summary.approvedCount : null);

      const apiRejected = typeof data?.rejectedCount === "number"
        ? data.rejectedCount
        : (typeof data?.summary?.rejectedCount === "number" ? data.summary.rejectedCount : null);

      const apiCount = typeof data?.count === "number"
        ? data.count
        : (typeof data?.totalCount === "number" ? data.totalCount : null);

      const normalized = normalizeRequests(data);

      const mappedRequests = normalized
        .filter((item) => {
          if (!item || isExplicitlyExcludedAttendanceRequest(item)) return false;
          return !isUnknownEmployeeOrUser(item) || hasStableAttendanceRequestId(item);
        })
        .map(mapRequest);

      // 2. Load locally approved records
      const localApproved = getApprovedStore().map((item, idx) => ({
        ...mapRequest(item, idx + 2000),
        approvalStatus: "approved",
      }));

      // 3. Load locally rejected records
      let localRejected = [];
      try {
        const rawRejected = localStorage.getItem("kt_rejected_attendance_store");
        if (rawRejected) {
          const parsed = JSON.parse(rawRejected);
          if (Array.isArray(parsed)) {
            localRejected = parsed.map((item, idx) => ({
              ...mapRequest(item, idx + 3000),
              approvalStatus: "rejected",
              rejectionReason: item.reason || item.rejectionReason || "Attendance rejected",
            }));
          }
        }
      } catch {}

      // 4. Merge records with proper precedence
      const recordMap = new Map();

      // Backend records have primary precedence
      mappedRequests.forEach((req) => {
        const key = req.attendanceId || req.id || `${req.userId || req.name}_${req.date}`;
        recordMap.set(String(key), req);
      });

      // Overlay local approved records if viewing all or approved
      if (effStatus === "all" || effStatus === "approved") {
        localApproved.forEach((req) => {
          const key = req.attendanceId || req.id || `${req.userId || req.name}_${req.date}`;
          if (!recordMap.has(String(key))) {
            if (!effDate || req.date === effDate) {
              recordMap.set(String(key), { ...req, approvalStatus: "approved" });
            }
          }
        });
      }

      // Overlay local rejected records if viewing all or rejected
      if (effStatus === "all" || effStatus === "rejected") {
        localRejected.forEach((req) => {
          const key = req.attendanceId || req.id || `${req.userId || req.name}_${req.date}`;
          if (!recordMap.has(String(key))) {
            if (!effDate || req.date === effDate) {
              recordMap.set(String(key), { ...req, approvalStatus: "rejected" });
            }
          }
        });
      }

      const combined = Array.from(recordMap.values());
      setRequests(combined);

      // Compute counts
      const finalPending = apiPending !== null ? apiPending : combined.filter((r) => r.approvalStatus === "pending").length;
      const finalApproved = apiApproved !== null ? apiApproved : combined.filter((r) => r.approvalStatus === "approved").length;
      const finalRejected = apiRejected !== null ? apiRejected : combined.filter((r) => r.approvalStatus === "rejected").length;
      const finalTotal = apiCount !== null ? apiCount : (effStatus === "all" ? combined.length : (finalPending + finalApproved + finalRejected));

      setServerCounts((prev) => ({
        pending: finalPending,
        approved: apiApproved !== null ? apiApproved : (effStatus === "approved" ? combined.length : Math.max(prev.approved, finalApproved)),
        rejected: apiRejected !== null ? apiRejected : (effStatus === "rejected" ? combined.length : Math.max(prev.rejected, finalRejected)),
        total: finalTotal > 0 ? finalTotal : prev.total,
      }));
    } catch (err) {
      console.error("Fetch Pending Requests Error:", err);
      if (!isSilent) {
        setError("Unable to load check-in requests.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  // Helper filter handlers
  const handleFilterStatusChange = (newStatus) => {
    setFilterStatus(newStatus);
    fetchPendingRequests(newStatus, selectedDate, false);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    fetchPendingRequests(filterStatus, newDate, false);
  };

  // ============================================================
  // INITIAL LOAD + PROPER SILENT AUTO REFRESH + FOCUS REVALIDATION
  // ============================================================
  useEffect(() => {
    fetchPendingRequests(filterStatus, selectedDate, false);

    // Fast 6-second silent background poll for immediate new requests
    const interval = setInterval(() => {
      fetchPendingRequests(filterStatus, selectedDate, true);
    }, 6000);

    // Immediately revalidate whenever user returns to the tab
    const handleFocus = () => {
      fetchPendingRequests(filterStatus, selectedDate, true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPendingRequests(filterStatus, selectedDate, true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("attendance_updated", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("attendance_updated", handleFocus);
    };
  }, [filterStatus, selectedDate]);

  // ============================================================
  // APPROVE / REJECT
  // ============================================================
  const handleAction = async (
    target,
    type,
    reason = ""
  ) => {
    const reqObj =
      typeof target === "object" && target !== null
        ? target
        : requests.find((r) => r.id === target || r.attendanceId === target || r._id === target) || {};

    const targetActionId = reqObj.id || (typeof target === "string" ? target : "");
    setActioningId(targetActionId);
    setError("");

    const updatedStatus =
      type === "approve"
        ? "approved"
        : "rejected";

    try {
      if (!token) {
        setError("Please login first.");
        return;
      }

      // 1. Resolve authentic Admin / HR approver ID (who is taking action)
      let effectiveAdminId = adminApproverId || getLoggedInAdminId(contextUser);
      if (!effectiveAdminId) {
        try {
          const pRes = await fetch(`${BASE_URL}/api/users/profile`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            effectiveAdminId = extractIdFromObject(pData);
            if (effectiveAdminId) setAdminApproverId(effectiveAdminId);
          }
        } catch {}

        if (!effectiveAdminId) {
          try {
            const uRes = await fetch(`${BASE_URL}/api/users/all`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              }
            });
            if (uRes.ok) {
              const uData = await uRes.json();
              const list = uData?.users || uData?.data || (Array.isArray(uData) ? uData : []);
              if (Array.isArray(list)) setAllUsers(list);
              let currentEmail = null;
              try {
                const rawUser = JSON.parse(localStorage.getItem("auth_user") || localStorage.getItem("user") || "{}");
                currentEmail = rawUser?.email || rawUser?.user?.email || null;
              } catch {}
              let matched = currentEmail ? list.find((u) => u.email && u.email.toLowerCase() === currentEmail.toLowerCase()) : null;
              if (!matched) {
                matched = list.find((u) => {
                  const r = String(u.role || "").toLowerCase().trim();
                  return r === "admin" || r === "hr" || r === "team_leader" || r === "team lead" || r === "tl";
                });
              }
              if (matched) {
                effectiveAdminId = extractIdFromObject(matched);
                if (effectiveAdminId) setAdminApproverId(effectiveAdminId);
              }
            }
          } catch {}
        }
      }

      if (!effectiveAdminId) {
        throw new Error("Could not determine dynamic Approver ID (Admin/HR/Team Lead). Please sign in again.");
      }

      // 2. Resolve target employee user ID (whose check-in is being approved/rejected)
      const targetUserId =
        extractEmployeeUserId(reqObj, allUsers) ||
        extractEmployeeUserId(reqObj.raw, allUsers) ||
        reqObj.userId ||
        reqObj.employeeUserId ||
        "";

      // 3. Resolve target attendance document ID
      const targetAttendanceId =
        reqObj.attendanceId ||
        extractAttendanceId(reqObj.raw) ||
        (isValidObjectId(reqObj.id) ? reqObj.id : null) ||
        extractAttendanceId(reqObj) ||
        (typeof target === "string" ? target : "");

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // ========================================================
      // APPROVE
      // ========================================================
      if (type === "approve") {
        const approvePayload = {
          attendanceId: targetAttendanceId,
          id: targetAttendanceId,
          userId: targetUserId || undefined, // Target employee ID
          approvedBy: effectiveAdminId,     // Admin / HR ID
          approverId: effectiveAdminId,     // Admin / HR ID
        };

        let response = await fetch(APPROVE_URL, {
          method: "PUT",
          headers,
          body: JSON.stringify(approvePayload),
        });

        // Fallback to POST if PUT returned 404
        if (response.status === 404) {
          try {
            const postResponse = await fetch(APPROVE_URL, {
              method: "POST",
              headers,
              body: JSON.stringify(approvePayload),
            });
            if (postResponse.ok || postResponse.status !== 404) {
              response = postResponse;
            }
          } catch (postErr) {
            console.warn("POST fallback failed:", postErr);
          }
        }

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            responseData?.message ||
            responseData?.error ||
            "Failed to approve attendance"
          );
        }

        // ======================================================
        // Update UI immediately with backend response
        // ======================================================
        setRequests((prevRequests) =>
          prevRequests.map((req) =>
            req.id === targetActionId || req.attendanceId === targetAttendanceId
              ? {
                  ...req,
                  approvalStatus: "approved",
                  checkInTime:
                    responseData?.data?.checkInTime ||
                    req.checkInTime,
                  checkInTimeDisplay:
                    responseData?.data?.checkInTimeDisplay ||
                    req.checkInTimeDisplay,
                  checkInTimeFullDisplay:
                    responseData?.data?.checkInTimeFullDisplay ||
                    req.checkInTimeFullDisplay,
                  requestedTime:
                    responseData?.data?.checkInTimeDisplay ||
                    req.requestedTime,
                  status:
                    responseData?.data?.status ||
                    req.status,
                  isLate:
                    responseData?.data?.isLate ??
                    req.isLate,
                }
              : req
          )
        );

        const empUserId = targetUserId || reqObj.userId || reqObj.employeeUserId || "";
        const approvedItem = {
          ...reqObj,
          id: targetActionId || targetAttendanceId || `${reqObj.date || getTodayLocal()}-${empUserId}`,
          attendanceId: targetAttendanceId || reqObj.attendanceId || "",
          userId: empUserId,
          employeeUserId: empUserId,
          name: reqObj.name || "Employee",
          email: reqObj.email || "",
          role: reqObj.role || "Employee",
          department: reqObj.department || "",
          date: reqObj.date || getTodayLocal(),
          checkInTime: responseData?.data?.checkInTime || reqObj.checkInTime,
          checkInTimeDisplay: responseData?.data?.checkInTimeDisplay || reqObj.checkInTimeDisplay,
          checkInTimeFullDisplay: responseData?.data?.checkInTimeFullDisplay || reqObj.checkInTimeFullDisplay,
          requestedTime: responseData?.data?.checkInTimeDisplay || reqObj.requestedTime,
          status: responseData?.data?.status || reqObj.status || "present",
          isLate: responseData?.data?.isLate ?? reqObj.isLate ?? false,
          approvalStatus: "approved",
          approvedAt: Date.now(),
        };
        saveApprovedToStore(approvedItem);

        setServerCounts((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          approved: prev.approved + 1,
        }));
      }

      // ========================================================
      // REJECT
      // ========================================================
      if (type === "reject") {
        const rejectPayload = {
          attendanceId: targetAttendanceId,
          id: targetAttendanceId,
          userId: targetUserId || undefined, // Target employee ID
          reason: reason || "Attendance rejected by admin",
          approvedBy: effectiveAdminId,     // Admin / HR ID
          rejectedBy: effectiveAdminId,     // Admin / HR ID
          approverId: effectiveAdminId,     // Admin / HR ID
        };

        let response = await fetch(REJECT_URL, {
          method: "PUT",
          headers,
          body: JSON.stringify(rejectPayload),
        });

        // Fallback to POST if PUT returned 404
        if (response.status === 404) {
          try {
            const postResponse = await fetch(REJECT_URL, {
              method: "POST",
              headers,
              body: JSON.stringify(rejectPayload),
            });
            if (postResponse.ok || postResponse.status !== 404) {
              response = postResponse;
            }
          } catch (postErr) {
            console.warn("POST fallback failed:", postErr);
          }
        }

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            responseData?.message ||
            responseData?.error ||
            "Failed to reject attendance"
          );
        }

        // ======================================================
        // Update UI
        // ======================================================
        setRequests((prevRequests) =>
          prevRequests.map((req) =>
            req.id === targetActionId || req.attendanceId === targetAttendanceId
              ? {
                  ...req,
                  approvalStatus: "rejected",
                  rejectionReason: reason || req.rejectionReason,
                }
              : req
          )
        );

        setRejectingRequest(null);
        setRejectionReason("");

        setServerCounts((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          rejected: prev.rejected + 1,
        }));

        try {
          const rawStore = localStorage.getItem('kt_rejected_attendance_store') || '[]';
          const rejectedStore = JSON.parse(rawStore);
          const empUserId = targetUserId || reqObj.userId || reqObj.employeeUserId || '';
          rejectedStore.push({
            attendanceId: targetAttendanceId,
            userId: empUserId,
            name: reqObj.name || '',
            email: reqObj.email || '',
            reason: reason || "Attendance rejected by admin",
            date: reqObj.date,
            rejectedAt: Date.now(),
          });
          localStorage.setItem('kt_rejected_attendance_store', JSON.stringify(rejectedStore));
        } catch {}

        try {
          const rawAppStore = localStorage.getItem('kt_approved_attendance_store') || '[]';
          const appStore = JSON.parse(rawAppStore);
          const filteredApp = appStore.filter((r) => {
            const key = r.attendanceId || r.id;
            return key !== targetAttendanceId && key !== targetActionId;
          });
          localStorage.setItem('kt_approved_attendance_store', JSON.stringify(filteredApp));
        } catch {}

        window.dispatchEvent(new Event("attendance_updated"));
        window.dispatchEvent(new Event("attendance_adjusted"));
      }

      // ========================================================
      // Dispatch update events on approve as well
      // ========================================================
      if (type === "approve") {
        try {
          const rawStore = localStorage.getItem('kt_rejected_attendance_store') || '[]';
          const rejectedStore = JSON.parse(rawStore);
          const filtered = rejectedStore.filter((r) => r.attendanceId !== targetAttendanceId && r.userId !== targetUserId);
          localStorage.setItem('kt_rejected_attendance_store', JSON.stringify(filtered));
        } catch {}

        window.dispatchEvent(new Event("attendance_updated"));
        window.dispatchEvent(new Event("attendance_adjusted"));
      }

      // ========================================================
      // Refresh after action
      // ========================================================
      setTimeout(() => {
        fetchPendingRequests(filterStatus, selectedDate, true);
      }, 300);
    } catch (err) {
      console.error(
        "Attendance Action Error:",
        err
      );

      setError(
        err.message ||
          "Failed to update request status."
      );
    } finally {
      setActioningId(null);
    }
  };

  // ============================================================
  // OPEN REJECT MODAL
  // ============================================================
  const openRejectModal = (request) => {
    setRejectingRequest(request);
    setRejectionReason("");
    setError("");
  };

  // ============================================================
  // CONFIRM REJECTION
  // ============================================================
  const confirmRejection = () => {
    const reason =
      rejectionReason.trim();

    if (!reason) {
      setError(
        "Please enter a reason for rejecting this request."
      );
      return;
    }

    handleAction(
      rejectingRequest,
      "reject",
      reason
    );
  };

  // ============================================================
  // ============================================================
  // STATUS BADGE RENDERER (Matches AttendanceLogs & Performance)
  // ============================================================
  const renderStatusBadge = (status) => {
    const norm = String(status || "").toLowerCase().trim();
    if (norm === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] select-none whitespace-nowrap font-poppins">
          <CheckCircle2 className="h-3 w-3 text-[#059669]" />
          Approved
        </span>
      );
    }
    if (norm === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] select-none whitespace-nowrap font-poppins">
          <XCircle className="h-3 w-3 text-[#DC2626]" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] select-none whitespace-nowrap font-poppins">
        <Clock className="h-3 w-3 text-[#D97706]" />
        Pending
      </span>
    );
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-700 border-green-300";
      case "rejected":
        return "bg-red-100 text-red-700 border-red-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <CheckCircle className="h-3 w-3" />;
      case "rejected":
        return <XCircle className="h-3 w-3" />;
      case "pending":
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // ============================================================
  // COUNTS (Authoritative from backend server counts with fallback)
  // ============================================================
  const pendingCount =
    typeof serverCounts.pending === "number"
      ? serverCounts.pending
      : requests.filter((r) => r.approvalStatus === "pending").length;

  const approvedCount =
    typeof serverCounts.approved === "number"
      ? serverCounts.approved
      : requests.filter((r) => r.approvalStatus === "approved").length;

  const rejectedCount =
    typeof serverCounts.rejected === "number"
      ? serverCounts.rejected
      : requests.filter((r) => r.approvalStatus === "rejected").length;

  const totalCount =
    typeof serverCounts.total === "number" && serverCounts.total > 0
      ? serverCounts.total
      : (pendingCount + approvedCount + rejectedCount > 0 ? (pendingCount + approvedCount + rejectedCount) : requests.length);

  // ============================================================
  // FILTER (Employee name, email, department, role, employeeId, phone, or date)
  // ============================================================
  const filteredRequests = requests
    .filter((req) => {
      const name = req.name || "";
      const role = req.role || "";
      const email = req.email || "";
      const department = req.department || "";
      const employeeId = req.employeeId || "";
      const phone = req.phone || "";
      const dateStr = String(req.date || "").toLowerCase();
      const formattedDate = formatDate(req.date).toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        role.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term) ||
        department.toLowerCase().includes(term) ||
        employeeId.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term) ||
        dateStr.includes(term) ||
        formattedDate.includes(term);

      const currentStatus = String(req.approvalStatus || "").toLowerCase().trim();
      const targetStatus = String(filterStatus || "").toLowerCase().trim();
      const matchesStatus =
        targetStatus === "all" ||
        currentStatus === targetStatus;

      const matchesDate =
        !selectedDate ||
        String(req.date || "").startsWith(selectedDate);

      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      if (filterStatus === "all") {
        if (a.approvalStatus === "pending" && b.approvalStatus !== "pending") return -1;
        if (b.approvalStatus === "pending" && a.approvalStatus !== "pending") return 1;
      }
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return timeB - timeA;
    });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 font-poppins text-slate-800">

      {/* =====================================================
          1. UNIFIED PAGE HEADER (Matches Performance & AttendanceLogs)
      ===================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 font-poppins">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#e8f1f5] text-[#034665] flex items-center justify-center shrink-0">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-poppins">
                Check-In Requests
              </h1>
              {isTeamLead && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-[#034665] border border-sky-200">
                  Team Lead Scoped
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-normal font-poppins mt-0.5">
              {isTeamLead
                ? "Review and manage attendance punch-in requests for your assigned team members"
                : "Review and manage employee punch-in attendance requests and approvals"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Total Badge */}
          <div className="h-9 bg-white border border-slate-300 rounded-md px-3 sm:px-3.5 shadow-2xs text-xs font-medium flex items-center select-none font-poppins text-slate-600 gap-1.5">
            <Users size={14} className="text-slate-600 shrink-0" />
            <span>Total:</span>
            <span className="font-bold text-slate-900">{totalCount}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchPendingRequests(filterStatus, selectedDate, false)}
            disabled={loading}
            title="Refresh requests"
            aria-label="Refresh requests"
            className="h-9 w-9 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer font-poppins"
          >
            <RefreshCw size={13} className={`text-slate-600 ${loading ? "animate-spin text-[#0088cc]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ===================================================
          2. TOP 3 METRIC SUMMARY CARDS (Matches Figma 2-card spec)
      =================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 font-poppins">
        {[
          { key: "pending", label: "PENDING", count: pendingCount, icon: Clock },
          { key: "approved", label: "APPROVED", count: approvedCount, icon: CheckCircle2 },
          { key: "rejected", label: "REJECTED", count: rejectedCount, icon: XCircle },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = filterStatus === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleFilterStatusChange(filterStatus === item.key ? "all" : item.key)}
              title={`Click to filter by ${item.label}`}
              className="relative flex items-center h-[60px] w-full text-left cursor-pointer transition-transform hover:scale-[1.01]"
            >
              {/* Left accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "#034665", opacity: 1 }}
              />
              {/* Inner card */}
              <div
                className={`relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all ${
                  isSelected ? "ring-2 ring-[#034665]/20 border-[#034665]" : ""
                }`}
                style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className={isSelected ? "text-[#034665]" : "text-[#718096]"} />
                  <p className="text-[11px] sm:text-[12px] font-medium text-[#718096] tracking-wider uppercase font-poppins select-none truncate">
                    {item.label}
                  </p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                  {item.count}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================
          3. MAIN DATA CONTAINER (Matches Performance & AttendanceLogs)
      ===================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 lg:p-6 shadow-xs space-y-4 font-poppins">

        {/* Filter Toolbar: Search on left + Date filter & Status dropdown on right */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1 font-poppins">
          {/* Search Field */}
          <div className="relative w-full lg:w-[320px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee, ID, email, dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] font-poppins transition-all"
            />
          </div>

          {/* Controls: Date Picker + Quick Presets + Status Filter */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap justify-start lg:justify-end font-poppins">
            {/* Date Picker Input */}
            <div className="relative flex items-center">
              <Calendar size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                title="Filter attendance by date"
                className="h-9 pl-8 pr-7 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] font-poppins cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => handleDateChange("")}
                  title="Clear date filter"
                  className="absolute right-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDateChange(getTodayLocal())}
                className={`h-9 px-2.5 text-[11px] font-medium rounded-md border transition cursor-pointer select-none ${
                  selectedDate === getTodayLocal()
                    ? "bg-[#034665] text-white border-[#034665]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(getYesterdayLocal())}
                className={`h-9 px-2.5 text-[11px] font-medium rounded-md border transition cursor-pointer select-none ${
                  selectedDate === getYesterdayLocal()
                    ? "bg-[#034665] text-white border-[#034665]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Yesterday
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => handleDateChange("")}
                  className="h-9 px-2.5 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition cursor-pointer select-none"
                >
                  All Dates
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="relative w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => handleFilterStatusChange(e.target.value)}
                className="w-full sm:w-auto h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins font-medium"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-2 font-poppins">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && requests.length === 0 ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filteredRequests.length === 0 ? (
          /* Empty State */
          <div className="p-16 text-center border border-slate-200/80 rounded-lg bg-slate-50/50 font-poppins">
            <Clock size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              {searchTerm || filterStatus !== "all" || selectedDate ? "No matching check-in requests" : "No check-in requests found"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-poppins">
              {searchTerm || filterStatus !== "all" || selectedDate
                ? "Try adjusting your search query, date filter, or status filter."
                : "All employee attendance punch-in requests will appear here."}
            </p>
          </div>
        ) : (
          /* Table Container with responsive scroll */
          <div className="overflow-x-auto border border-slate-200/80 rounded-lg font-poppins">
            <table className="w-full text-left text-xs border-collapse min-w-[760px] sm:min-w-full font-poppins">
              <thead>
                <tr className="bg-[#0346651A] text-[#034665] text-xs font-semibold font-poppins" style={{ backgroundColor: "#0346651A" }}>
                  <th className="py-3 px-4 w-12 text-left font-semibold">
                    No.
                  </th>
                  <th className="py-3 px-4 text-left font-semibold">
                    Employee
                  </th>
                  <th className="py-3 px-4 text-left font-semibold">
                    Department
                  </th>
                  <th className="py-3 px-4 text-left font-semibold">
                    Time (IST)
                  </th>
                  <th className="py-3 px-4 text-left font-semibold">
                    Date
                  </th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                    Timeline
                  </th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-poppins bg-white">
                {filteredRequests.map((req, index) => (
                  <tr
                    key={req.id}
                    className={`hover:bg-slate-50/60 transition-colors font-poppins ${
                      actioningId === req.id ? "opacity-60" : ""
                    }`}
                  >
                    {/* No. */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {index + 1}
                    </td>

                    {/* Employee (Avatar + Name & Role + ID & Phone) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-2xs select-none"
                          style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                        >
                          {getEmployeeInitials(req)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-xs sm:text-[13px] truncate">
                              {req.name}
                            </span>
                            {req.employeeId && (
                              <span className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-200">
                                {req.employeeId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-normal truncate mt-0.5">
                            {req.email && <span>{req.email}</span>}
                            {req.phone && <span>• {req.phone}</span>}
                            {!req.email && !req.phone && <span>{req.role || "Employee"}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap font-normal">
                      {req.department ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/80 text-[11px] font-medium">
                          <Building2 size={11} className="text-slate-400" />
                          {req.department}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Time (IST) */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap font-normal">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">{req.requestedTime}</span>
                        {req.isLate && (
                          <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                            Late
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap font-normal">
                      {formatDate(req.date)}
                    </td>

                    {/* Timeline */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {req.timeline && req.timeline.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-sky-50 text-sky-700 border border-sky-200/80 font-medium"
                          title={`${req.timeline.length} timeline event(s) recorded`}
                        >
                          <Clock size={11} className="text-sky-600" />
                          <span>{req.timeline.length} events</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(req.approvalStatus)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {String(req.approvalStatus || "").toLowerCase().trim() === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(actioningId)}
                            onClick={() => handleAction(req, "approve")}
                            className="h-7 sm:h-8 px-3 text-xs font-medium text-white bg-[#034665] hover:bg-[#02334a] rounded-md transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1 shadow-2xs font-poppins"
                          >
                            {actioningId === req.id && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(actioningId)}
                            onClick={() => openRejectModal(req)}
                            className="h-7 sm:h-8 px-3 text-xs font-medium text-[#034665] bg-white border border-[#034665]/40 hover:bg-slate-50 rounded-md transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1 shadow-2xs font-poppins"
                          >
                            Reject
                          </button>
                        </div>
                      ) : String(req.approvalStatus || "").toLowerCase().trim() === "approved" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-md select-none">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          <span>Approved</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200/80 rounded-md select-none"
                          title={req.rejectionReason || "Attendance rejected"}
                        >
                          <XCircle size={13} className="text-rose-600 shrink-0" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =======================================================
          REJECT MODAL (Preserved with Poppins styling)
      ======================================================= */}
      <Modal
        isOpen={Boolean(rejectingRequest)}
        size="sm"
        onClose={() => {
          if (!actioningId) {
            setRejectingRequest(null);
            setRejectionReason("");
          }
        }}
        title="Reject Check-In Request"
        subtitle={
          rejectingRequest
            ? `Reason for rejecting ${rejectingRequest.name}`
            : ""
        }
        footer={
          <div className="flex items-center justify-end gap-2 font-poppins">
            <button
              type="button"
              onClick={() => {
                setRejectingRequest(null);
                setRejectionReason("");
              }}
              disabled={Boolean(actioningId)}
              className="h-9 px-3.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmRejection}
              disabled={Boolean(actioningId)}
              className="h-9 px-4 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              {actioningId ? (
                <>
                  <Loader2 className="animate-spin h-3.5 w-3.5" />
                  <span>Rejecting Request...</span>
                </>
              ) : (
                "Reject Request"
              )}
            </button>
          </div>
        }
      >
        <div className="font-poppins">
          <label
            htmlFor="rejection-reason"
            className="block mb-2 text-xs sm:text-sm font-medium text-slate-700"
          >
            Rejection reason
          </label>

          <textarea
            id="rejection-reason"
            value={rejectionReason}
            onChange={(event) =>
              setRejectionReason(event.target.value)
            }
            placeholder="Enter why this check-in request is being rejected"
            rows={4}
            autoFocus
            className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 resize-none font-poppins"
          />
        </div>
      </Modal>
    </div>
  );
}