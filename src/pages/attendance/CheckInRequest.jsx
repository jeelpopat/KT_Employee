import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { isFinanceOrExcludedUser, isUnknownEmployeeOrUser } from "../../utils/roleFilters";
import { useApp } from "../../context/AppContext";

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
  "https://kt-backend-yzr4.onrender.com/api/attendance/pending";

const APPROVE_URL =
  "https://kt-backend-yzr4.onrender.com/api/attendance/approve";

const REJECT_URL =
  "https://kt-backend-yzr4.onrender.com/api/attendance/reject";

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
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.pendingRequests)) {
      return payload.pendingRequests;
    }

    if (Array.isArray(payload.requests)) {
      return payload.requests;
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    if (Array.isArray(payload.attendance)) {
      return payload.attendance;
    }

    if (Array.isArray(payload.logs)) {
      return payload.logs;
    }

    if (Array.isArray(payload.records)) {
      return payload.records;
    }

    if (Array.isArray(payload.result)) {
      return payload.result;
    }

    if (Array.isArray(payload.items)) {
      return payload.items;
    }

    if (payload.data && typeof payload.data === "object") {
      if (Array.isArray(payload.data.data)) return payload.data.data;
      if (Array.isArray(payload.data.attendance)) return payload.data.attendance;
      if (Array.isArray(payload.data.logs)) return payload.data.logs;
      if (Array.isArray(payload.data.records)) return payload.data.records;
      if (Array.isArray(payload.data.result)) return payload.data.result;
      if (Array.isArray(payload.data.items)) return payload.data.items;
    }

    if (payload._id || payload.userId) {
      return [payload];
    }
  }

  return [];
};

// ============================================================
// FORMAT DATE
// ============================================================
const formatDate = (value) => {
  if (!value) return "N/A";

  // Backend date field is normally YYYY-MM-DD
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value.split("-");

    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// ============================================================
// FORMAT CHECK-IN TIME
// ============================================================
const formatCheckInTime = (value) => {
  if (!value) return "N/A";

  // If backend already sends formatted IST time
  // Example: "11:00"
  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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

const getTodayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ============================================================
// MAP BACKEND REQUEST
// ============================================================
const mapRequest = (item, index) => {
  const actualCheckInTime =
    item.checkInTimeDisplay ||
    item.checkInTime ||
    item.requestedTime ||
    item.time ||
    item.punchInTime ||
    item.attendanceTime ||
    item.checkIn?.time ||
    (typeof item.checkIn === "string"
      ? item.checkIn
      : "") ||
    item.attendance?.checkInTime ||
    item.requestedAt ||
    "N/A";

  const attendanceId = extractAttendanceId(item);
  const employeeUserId = extractEmployeeUserId(item);

  const resolvedApprovalStatus = (() => {
    const rawStatus = String(item.approvalStatus || "").toLowerCase().trim();
    if (rawStatus === "approved" || rawStatus === "rejected" || rawStatus === "pending") {
      return rawStatus;
    }
    if (isRecordRejected(item)) return "rejected";
    if (isRecordApproved(item)) return "approved";
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

    name:
      item.employeeName ||
      item.name ||
      item.userId?.name ||
      item.user?.name ||
      item.employee?.name ||
      item.employeeId?.name ||
      "Unknown Employee",

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

    email:
      item.email ||
      item.userId?.email ||
      item.user?.email ||
      item.employee?.email ||
      item.employeeId?.email ||
      "",

    department:
      item.department ||
      item.userId?.department ||
      item.user?.department ||
      item.employee?.department ||
      item.employeeId?.department ||
      "",

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
  const { user: contextUser } = useApp();
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
        const pRes = await fetch("https://kt-backend-yzr4.onrender.com/api/users/profile", { headers });
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
        const uRes = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all", { headers });
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
              return r === "admin" || r === "hr";
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
  // FETCH PENDING REQUESTS
  // ============================================================
  const fetchPendingRequests = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError("");
    }

    try {
      if (!token) {
        if (!isSilent) setError("Please login first.");
        return;
      }

      // Add cache-busting timestamp to bypass browser/proxy caching
      const freshUrl = `${PENDING_URL}${PENDING_URL.includes("?") ? "&" : "?"}_t=${Date.now()}`;

      const res = await fetch(freshUrl, {
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
        throw new Error(
          `Failed to fetch pending requests: ${res.status}`
        );
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
          if (!item || isFinanceOrExcludedUser(item) || isUnknownEmployeeOrUser(item)) return false;
          if (item.userId && (isFinanceOrExcludedUser(item.userId) || isUnknownEmployeeOrUser(item.userId))) return false;
          if (item.employee && (isFinanceOrExcludedUser(item.employee) || isUnknownEmployeeOrUser(item.employee))) return false;

          const name =
            item.employeeName ||
            item.name ||
            item.userId?.name ||
            item.user?.name ||
            item.employee?.name;
          if (!name || isUnknownEmployeeOrUser(name)) {
            return false;
          }
          return true;
        })
        .map(mapRequest);

      // Query organizational attendance logs from /api/attendance/admin/all so that
      // approved and rejected check-in records are also available when filtering
      let additionalRecords = [];
      try {
        const todayDate = getTodayLocal();
        let allRes = await fetch(
          `https://kt-backend-yzr4.onrender.com/api/attendance/admin/all?date=${todayDate}&_t=${Date.now()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }
        );
        if (!allRes.ok) {
          allRes = await fetch(
            `https://kt-backend-yzr4.onrender.com/api/attendance/admin/all?_t=${Date.now()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        }
        if (allRes.ok) {
          const allData = await allRes.json();
          const allLogs = normalizeRequests(allData);
          additionalRecords = allLogs
            .filter((item) => {
              if (!item || isFinanceOrExcludedUser(item) || isUnknownEmployeeOrUser(item)) return false;
              return isRecordApproved(item) || isRecordRejected(item);
            })
            .map((item, idx) => {
              const mapped = mapRequest(item, idx + 500);
              const isRej = isRecordRejected(item);
              return {
                ...mapped,
                approvalStatus: isRej ? "rejected" : "approved",
              };
            });
        }
      } catch (e) {
        // Silently continue if /admin/all is unavailable
      }

      // Merge pending requests and approved/rejected records
      const existingIds = new Set(mappedRequests.map((r) => r.id));
      const combined = [
        ...mappedRequests,
        ...additionalRecords.filter((r) => !existingIds.has(r.id)),
      ];

      setRequests(combined);

      // Set authoritative counts from API response
      const finalPending = apiPending !== null ? apiPending : mappedRequests.filter((r) => r.approvalStatus === "pending").length;
      const finalApproved = apiApproved !== null ? apiApproved : combined.filter((r) => r.approvalStatus === "approved").length;
      const finalRejected = apiRejected !== null ? apiRejected : combined.filter((r) => r.approvalStatus === "rejected").length;
      const finalTotal = (apiPending !== null && apiApproved !== null && apiRejected !== null)
        ? (apiPending + apiApproved + apiRejected)
        : (apiCount !== null && apiCount > 0 ? apiCount : (finalPending + finalApproved + finalRejected));

      setServerCounts({
        pending: finalPending,
        approved: finalApproved,
        rejected: finalRejected,
        total: finalTotal,
      });
    } catch (err) {
      console.error(
        "Fetch Pending Requests Error:",
        err
      );

      if (!isSilent) {
        setError(
          "Unable to load pending requests."
        );
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  // ============================================================
  // INITIAL LOAD + PROPER SILENT AUTO REFRESH + FOCUS REVALIDATION
  // ============================================================
  useEffect(() => {
    fetchPendingRequests(false);

    // Fast 6-second silent background poll for immediate new requests
    const interval = setInterval(() => {
      fetchPendingRequests(true);
    }, 6000);

    // Immediately revalidate whenever admin returns to the tab
    const handleFocus = () => {
      fetchPendingRequests(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPendingRequests(true);
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
  }, []);

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
          const pRes = await fetch("https://kt-backend-yzr4.onrender.com/api/users/profile", {
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
            const uRes = await fetch("https://kt-backend-yzr4.onrender.com/api/users/all", {
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
                  return r === "admin" || r === "hr";
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
        throw new Error("Could not determine dynamic Admin/HR Approver ID. Please sign in again.");
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
      }

      // ========================================================
      // Refresh after action
      // ========================================================
      setTimeout(() => {
        fetchPendingRequests();
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
  // STATUS COLOR
  // ============================================================
  const getStatusColor = (status) => {
    switch (
      status?.toLowerCase()
    ) {
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

  // ============================================================
  // STATUS ICON
  // ============================================================
  const getStatusIcon = (status) => {
    switch (
      status?.toLowerCase()
    ) {
      case "approved":
        return (
          <CheckCircle className="h-3 w-3" />
        );

      case "rejected":
        return (
          <XCircle className="h-3 w-3" />
        );

      case "pending":
        return (
          <Clock className="h-3 w-3" />
        );

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
  // FILTER
  // ============================================================
  const filteredRequests =
    requests.filter((req) => {
      const name = req.name || "";
      const role = req.role || "";

      const matchesSearch =
        name
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          ) ||
        role
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesStatus =
        filterStatus === "all" ||
        req.approvalStatus ===
          filterStatus;

      return (
        matchesSearch &&
        matchesStatus
      );
    });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Check-In Requests
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Review and approve or reject employee punch-in attendance requests
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Total */}
          <div className="h-10 bg-white border border-slate-200/80 px-3.5 py-1 rounded-lg shadow-xs text-xs sm:text-sm flex items-center">
            <span className="text-slate-500">Total: </span>
            <span className="ml-1.5 font-bold text-slate-900">
              {totalCount}
            </span>
          </div>

          {/* Pending */}
          <div className="h-10 bg-amber-50 border border-amber-200/80 px-3.5 py-1 rounded-lg shadow-xs text-xs sm:text-sm flex items-center">
            <span className="text-amber-700 font-medium">
              {pendingCount} Pending
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchPendingRequests()}
            disabled={loading}
            title="Refresh from Database"
            className="h-10 px-3.5 py-1 bg-white border border-slate-200/80 rounded-lg shadow-xs text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ===================================================
          3 METRIC CARDS (UI Standard Design)
      =================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {[
          { key: "pending", label: "PENDING", value: pendingCount },
          { key: "approved", label: "APPROVED", value: approvedCount },
          { key: "rejected", label: "REJECTED", value: rejectedCount },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <div
              key={item.key}
              onClick={() => setFilterStatus(filterStatus === item.key ? "all" : item.key)}
              title={`Click to filter by ${item.label}`}
              className={`bg-white rounded-xl shadow-xs border p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all ${
                isSelected
                  ? "border-[#0088cc] ring-2 ring-[#0088cc]/20 shadow-xs"
                  : "border-slate-100 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-7 rounded-full ${isSelected ? "bg-[#0088cc]" : "bg-[#004b73]"}`} />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      {/* =====================================================
          MAIN CARD
      ===================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">

        {/* ===================================================
            SEARCH
        =================================================== */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80">

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">

            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or role..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all placeholder:text-slate-400"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(
                  e.target.value
                )
              }
              className="px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
            >
              <option value="all">
                All Status
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>
            </select>

            <button
              type="button"
              onClick={() => fetchPendingRequests(false)}
              disabled={loading}
              title="Refresh requests"
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
              <span>{loading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* ===================================================
            ERROR
        =================================================== */}
        {error && (
          <div className="m-3 sm:m-4 bg-red-50 border border-red-300 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm flex items-center gap-2">

            <AlertCircle className="h-4 w-4 flex-shrink-0" />

            <span className="break-words">
              {error}
            </span>
          </div>
        )}

        {/* ===================================================
            LOADING EFFECT
        =================================================== */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 sm:py-24">
            <Loader2 className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-indigo-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800">Loading check-in requests...</p>
            <p className="text-xs text-slate-500 mt-1">Fetching pending employee check-in submissions</p>
          </div>

        ) : filteredRequests.length === 0 ? (

          /* =================================================
             EMPTY STATE
          ================================================= */
          <div className="text-center py-12 sm:py-16">

            <div className="inline-block bg-blue-50 border border-blue-200 rounded-full p-3 sm:p-4 mb-3">

              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />

            </div>

            <h3 className="text-base sm:text-lg font-semibold text-gray-800">

              {searchTerm ||
              filterStatus !==
                "all"
                ? "No Results"
                : "No Check-In Requests"}

            </h3>

            <p className="text-xs sm:text-sm text-gray-500 mt-1 px-4">

              {searchTerm ||
              filterStatus !==
                "all"
                ? "Try adjusting your search or filter"
                : "All attendance requests will appear here."}

            </p>

          </div>

        ) : (

          /* =================================================
             REQUEST DATA
          ================================================= */
          <div className="p-3 sm:p-4">

            {/* =================================================
                DESKTOP TABLE
            ================================================= */}
            <div className="hidden md:block overflow-x-auto">

              <table className="w-full text-sm border border-gray-200 rounded-lg">

                <thead className="bg-gray-50 border-b border-gray-200">

                  <tr className="text-left text-[10px] sm:text-xs font-bold uppercase text-gray-600">

                    <th className="px-3 sm:px-4 py-2.5">
                      #
                    </th>

                    <th className="px-3 sm:px-4 py-2.5">
                      Employee
                    </th>

                    <th className="px-3 sm:px-4 py-2.5">
                      Time
                    </th>

                    <th className="px-3 sm:px-4 py-2.5">
                      Date
                    </th>

                    <th className="px-3 sm:px-4 py-2.5">
                      Status
                    </th>

                    <th className="px-3 sm:px-4 py-2.5 text-right">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">

                  {filteredRequests.map(
                    (req, index) => (

                      <tr
                        key={req.id}
                        className={
                          actioningId ===
                          req.id
                            ? "opacity-60"
                            : "hover:bg-gray-50 transition-colors"
                        }
                      >

                        {/* Number */}
                        <td className="px-3 sm:px-4 py-3 text-gray-500 text-sm">
                          {index + 1}
                        </td>

                        {/* Employee */}
                        <td className="px-3 sm:px-4 py-3">

                          <div className="flex items-center gap-2">

                            <div
                              className={`h-8 w-8 rounded-full ${req.avatarColor} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}
                            >
                              {req.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>

                              <p className="font-medium text-gray-800 text-sm">
                                {req.name}
                              </p>

                              <p className="text-xs text-gray-500">
                                {req.role}
                              </p>

                            </div>
                          </div>
                        </td>

                        {/* =================================================
                            ACTUAL CHECK-IN TIME
                        ================================================= */}
                        <td className="px-3 sm:px-4 py-3 text-sm text-gray-700">

                          <div className="flex items-center gap-1.5">

                            <Clock className="h-3.5 w-3.5 text-gray-400" />

                            <span>
                              {req.requestedTime}
                            </span>

                          </div>

                        </td>

                        {/* Date */}
                        <td className="px-3 sm:px-4 py-3 text-sm text-gray-500">
                          {formatDate(req.date)}
                        </td>

                        {/* Status */}
                        <td className="px-3 sm:px-4 py-3">

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-full ${getStatusColor(
                              req.approvalStatus
                            )}`}
                          >

                            {getStatusIcon(
                              req.approvalStatus
                            )}

                            {req.approvalStatus}

                          </span>

                        </td>

                        {/* Actions */}
                        <td className="px-3 sm:px-4 py-3 text-right">

                          {req.approvalStatus ===
                          "pending" ? (

                            <div className="flex items-center justify-end gap-2">

                              {/* Reject */}
                              <button
                                disabled={Boolean(actioningId)}
                                onClick={() =>
                                  openRejectModal(
                                    req
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {actioningId === req.id ? (
                                  <>
                                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                                    <span>Rejecting...</span>
                                  </>
                                ) : (
                                  "Reject"
                                )}
                              </button>

                              {/* Approve */}
                              <button
                                disabled={Boolean(actioningId)}
                                onClick={() =>
                                  handleAction(
                                    req,
                                    "approve"
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-2xs"
                              >
                                {actioningId === req.id ? (
                                  <>
                                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                                    <span>Approving...</span>
                                  </>
                                ) : (
                                  "Approve"
                                )}
                              </button>

                            </div>

                          ) : (

                            <span className="text-xs text-gray-400">
                              -
                            </span>

                          )}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>
              </table>
            </div>

            {/* =================================================
                MOBILE CARDS
            ================================================= */}
            <div className="md:hidden space-y-3">

              {filteredRequests.map(
                (req) => (

                  <div
                    key={req.id}
                    className={`border border-gray-200 rounded-lg p-3 ${
                      actioningId ===
                      req.id
                        ? "opacity-60"
                        : ""
                    }`}
                  >

                    {/* Employee Header */}
                    <div className="flex items-start justify-between">

                      <div className="flex items-center gap-2 flex-1 min-w-0">

                        <div
                          className={`h-9 w-9 rounded-full ${req.avatarColor} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}
                        >
                          {req.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="font-semibold text-gray-800 text-sm truncate">
                            {req.name}
                          </p>

                          <p className="text-xs text-gray-500 truncate">
                            {req.role}
                          </p>

                          {/* Actual Check-In Time */}
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">

                            <Clock className="h-3 w-3" />

                            <span>
                              {req.requestedTime}
                            </span>

                            <span>
                              •
                            </span>

                            <span>
                              {formatDate(
                                req.date
                              )}
                            </span>

                          </p>

                        </div>
                      </div>

                      {/* Status */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium border rounded-full flex-shrink-0 ${getStatusColor(
                          req.approvalStatus
                        )}`}
                      >

                        {getStatusIcon(
                          req.approvalStatus
                        )}

                        {req.approvalStatus}

                      </span>

                    </div>

                    {/* Actions */}
                    {req.approvalStatus ===
                      "pending" && (

                      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">

                        {/* Reject */}
                        <button
                          disabled={Boolean(actioningId)}
                          onClick={() =>
                            openRejectModal(
                              req
                            )
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {actioningId === req.id ? (
                            <>
                              <Loader2 className="animate-spin h-3.5 w-3.5" />
                              <span>Rejecting...</span>
                            </>
                          ) : (
                            "Reject"
                          )}
                        </button>

                        {/* Approve */}
                        <button
                          disabled={Boolean(actioningId)}
                          onClick={() =>
                            handleAction(
                              req,
                              "approve"
                            )
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-2xs"
                        >
                          {actioningId === req.id ? (
                            <>
                              <Loader2 className="animate-spin h-3.5 w-3.5" />
                              <span>Approving...</span>
                            </>
                          ) : (
                            "Approve"
                          )}
                        </button>

                      </div>
                    )}

                  </div>

                )
              )}

            </div>
          </div>
        )}
      </div>

      {/* =======================================================
          REJECT MODAL
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
    <>
      <button
        type="button"
        onClick={() => {
          setRejectingRequest(null);
          setRejectionReason("");
        }}
        disabled={Boolean(actioningId)}
        className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={confirmRejection}
        disabled={Boolean(actioningId)}
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-2xs"
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
    </>
  }
>
  <label
    htmlFor="rejection-reason"
    className="block mb-2 text-sm font-medium text-slate-700"
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
    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
  />
</Modal>
    </div>
  );
}