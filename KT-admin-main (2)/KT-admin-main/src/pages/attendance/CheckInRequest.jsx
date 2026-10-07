import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { isFinanceOrExcludedUser } from "../../utils/roleFilters";

const ADMIN_ID = "6a23b5c49cd1507bfd5e3bcb";

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

  return {
    id:
      item._id ||
      item.id ||
      `${item.date || item.requestedTime || Date.now()}-${index}`,

    name:
      item.employeeName ||
      item.name ||
      item.userId?.name ||
      item.employee?.name ||
      "Unknown Employee",

    role:
      item.role ||
      item.userId?.role ||
      item.employee?.role ||
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

    approvalStatus:
      item.approvalStatus ||
      item.status ||
      "pending",

    avatarColor:
      item.avatarColor ||
      AVATAR_COLORS[index % AVATAR_COLORS.length],

    email:
      item.email ||
      item.userId?.email ||
      item.employee?.email ||
      "",

    department:
      item.department ||
      item.userId?.department ||
      item.employee?.department ||
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
  const [requests, setRequests] = useState([]);

  // Initial page loading
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [actioningId, setActioningId] = useState(null);

  const [rejectingRequest, setRejectingRequest] = useState(null);

  const [rejectionReason, setRejectionReason] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [filterStatus, setFilterStatus] = useState("all");

  const token = localStorage.getItem("token");

  // ============================================================
  // FETCH PENDING REQUESTS
  // ============================================================
  const fetchPendingRequests = async () => {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        setError("Please login first.");
        return;
      }

      const res = await fetch(PENDING_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(
          `Failed to fetch pending requests: ${res.status}`
        );
      }

      const data = await res.json();

      const normalized = normalizeRequests(data);

      const mappedRequests = normalized
        .filter((item) => {
          if (!item) return false;
          if (isFinanceOrExcludedUser(item)) return false;
          if (item.userId && isFinanceOrExcludedUser(item.userId)) return false;
          if (item.employee && isFinanceOrExcludedUser(item.employee)) return false;

          const name =
            item.employeeName ||
            item.name ||
            item.userId?.name ||
            item.employee?.name;
          if (
            !name ||
            name === "Unknown Employee" ||
            name === "Unknown User" ||
            name === "Unknown"
          ) {
            return false;
          }
          return true;
        })
        .map(mapRequest);

      // ========================================================
      // Preserve already processed requests
      // ========================================================
      setRequests((prevRequests) => {
        const processedItems =
          prevRequests.filter(
            (item) =>
              item.approvalStatus !== "pending"
          );

        // Replace current pending records with fresh
        // backend records so updated checkInTimeDisplay
        // is immediately reflected.
        const pendingItems =
          mappedRequests.filter(
            (newItem) =>
              newItem.approvalStatus === "pending"
          );

        return [
          ...processedItems,
          ...pendingItems,
        ];
      });
    } catch (err) {
      console.error(
        "Fetch Pending Requests Error:",
        err
      );

      setError(
        "Unable to load pending requests."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD + AUTO REFRESH
  // ============================================================
  useEffect(() => {
    fetchPendingRequests();

    const interval = setInterval(() => {
      fetchPendingRequests();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // APPROVE / REJECT
  // ============================================================
  const handleAction = async (
    id,
    type,
    reason = ""
  ) => {
    setActioningId(id);
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

      // ========================================================
      // APPROVE
      // ========================================================
      if (type === "approve") {
        const response = await fetch(
          APPROVE_URL,
          {
            method: "PUT",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              approvedBy: ADMIN_ID,
              attendanceId: id,
            }),
          }
        );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData?.message ||
              "Failed to approve attendance"
          );
        }

        // ======================================================
        // Update UI immediately with backend response
        // ======================================================
        setRequests((prevRequests) =>
          prevRequests.map((req) =>
            req.id === id
              ? {
                  ...req,
                  approvalStatus:
                    "approved",

                  // Keep actual employee
                  // check-in time
                  checkInTime:
                    responseData?.data
                      ?.checkInTime ||
                    req.checkInTime,

                  checkInTimeDisplay:
                    responseData?.data
                      ?.checkInTimeDisplay ||
                    req.checkInTimeDisplay,

                  checkInTimeFullDisplay:
                    responseData?.data
                      ?.checkInTimeFullDisplay ||
                    req.checkInTimeFullDisplay,

                  requestedTime:
                    responseData?.data
                      ?.checkInTimeDisplay ||
                    req.requestedTime,

                  status:
                    responseData?.data
                      ?.status ||
                    req.status,

                  isLate:
                    responseData?.data
                      ?.isLate ??
                    req.isLate,
                }
              : req
          )
        );
      }

      // ========================================================
      // REJECT
      // ========================================================
      if (type === "reject") {
        const response = await fetch(
          REJECT_URL,
          {
            method: "PUT",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              attendanceId: id,
              reason,
            }),
          }
        );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            responseData?.message ||
              "Failed to reject attendance"
          );
        }

        // ======================================================
        // Update UI
        // ======================================================
        setRequests((prevRequests) =>
          prevRequests.map((req) =>
            req.id === id
              ? {
                  ...req,
                  approvalStatus:
                    "rejected",
                }
              : req
          )
        );

        setRejectingRequest(null);
        setRejectionReason("");
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
      rejectingRequest.id,
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
  // COUNTS
  // ============================================================
  const pendingCount =
    requests.filter(
      (r) =>
        r.approvalStatus ===
        "pending"
    ).length;

  const approvedCount =
    requests.filter(
      (r) =>
        r.approvalStatus ===
        "approved"
    ).length;

  const rejectedCount =
    requests.filter(
      (r) =>
        r.approvalStatus ===
        "rejected"
    ).length;

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
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">

        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
            Check-In Requests
          </h1>

          <p className="text-xs sm:text-sm text-gray-500">
            Manage employee attendance approvals
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">

          {/* Total */}
          <div className="bg-white border border-gray-300 px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm">
            <span className="text-gray-600">
              Total:{" "}
            </span>

            <span className="font-semibold">
              {requests.length}
            </span>
          </div>
 
          {/* Pending */}
          <div className="bg-yellow-50 border border-yellow-300 px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm">
            <span className="text-yellow-700 font-medium">
              {pendingCount} Pending
            </span>
          </div>

        </div>
      </div>

      {/* =====================================================
          MAIN CARD
      ===================================================== */}
      <div className="bg-white border border-gray-300 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">

        {/* ===================================================
            STATS
        =================================================== */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-200">

          {/* Pending */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 sm:p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-yellow-700 text-[10px] sm:text-xs font-bold uppercase">

              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

              <span className="hidden xs:inline">
                Pending
              </span>

              <span className="xs:hidden">
                Pend
              </span>
            </div>

            <p className="text-base sm:text-xl font-bold text-yellow-700">
              {pendingCount}
            </p>
          </div>

          {/* Approved */}
          <div className="bg-green-50 border border-green-300 rounded-lg p-2 sm:p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-700 text-[10px] sm:text-xs font-bold uppercase">

              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

              <span className="hidden xs:inline">
                Approved
              </span>

              <span className="xs:hidden">
                Appr
              </span>
            </div>

            <p className="text-base sm:text-xl font-bold text-green-700">
              {approvedCount}
            </p>
          </div>

          {/* Rejected */}
          <div className="bg-red-50 border border-red-300 rounded-lg p-2 sm:p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-700 text-[10px] sm:text-xs font-bold uppercase">

              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

              <span className="hidden xs:inline">
                Rejected
              </span>

              <span className="xs:hidden">
                Rej
              </span>
            </div>

            <p className="text-base sm:text-xl font-bold text-red-700">
              {rejectedCount}
            </p>
          </div>
        </div>

        {/* ===================================================
            SEARCH
        =================================================== */}
        <div className="p-3 sm:p-4 border-b border-gray-200">

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">

            <div className="flex-1 relative">

              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />

              <input
                type="text"
                placeholder="Search by name or role..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
          <div className="flex justify-center items-center py-16 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
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
                                disabled={
                                  actioningId ===
                                  req.id
                                }
                                onClick={() =>
                                  openRejectModal(
                                    req
                                  )
                                }
                                className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {actioningId ===
                                req.id
                                  ? "..."
                                  : "Reject"}
                              </button>

                              {/* Approve */}
                              <button
                                disabled={
                                  actioningId ===
                                  req.id
                                }
                                onClick={() =>
                                  handleAction(
                                    req.id,
                                    "approve"
                                  )
                                }
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {actioningId ===
                                req.id
                                  ? "..."
                                  : "Approve"}
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
                          disabled={
                            actioningId ===
                            req.id
                          }
                          onClick={() =>
                            openRejectModal(
                              req
                            )
                          }
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {actioningId ===
                          req.id
                            ? "Processing..."
                            : "Reject"}
                        </button>

                        {/* Approve */}
                        <button
                          disabled={
                            actioningId ===
                            req.id
                          }
                          onClick={() =>
                            handleAction(
                              req.id,
                              "approve"
                            )
                          }
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actioningId ===
                          req.id
                            ? "Processing..."
                            : "Approve"}
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
        className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={confirmRejection}
        disabled={Boolean(actioningId)}
        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {actioningId
          ? "Rejecting..."
          : "Reject Request"}
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