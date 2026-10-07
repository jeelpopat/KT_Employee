import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useConfirm } from "../components/common/ConfirmDialog";
import {
  BarChart3,
  Users,
  TrendingUp,
  UserCheck,
  Clock,
  FileText,
  Plus,
  Search,
  ChevronDown,
  Calendar,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Award
} from "lucide-react";
import { isFinanceOrExcludedUser, filterOutFinanceUsers } from "../utils/roleFilters";
import { useApp, deriveUserRole, getRealAuthUserId } from "../context/AppContext.jsx";

const DEPARTMENTS = [
  "Development",
  "Design",
  "Frontend",
  "Testing",
  "Backend",
  "HR"
];

const Performance = () => {
  const { user, userRole } = useApp();
  const normalizedRole = String(userRole || deriveUserRole(user) || "").toLowerCase().trim();
  const isAdmin = normalizedRole === "admin";
  const isTL = normalizedRole === "teamlead" || normalizedRole === "team_lead" || normalizedRole === "tl";

  const { confirm, confirmationDialog } = useConfirm();
  const headers = useMemo(() => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const [employees, setEmployees] = useState([]);
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // History Toolbar Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [toolbarDept, setToolbarDept] = useState("all");
  const [toolbarPerfFilter, setToolbarPerfFilter] = useState("all");
  const [selectedMonthYear, setSelectedMonthYear] = useState("all");

  // Add / Edit Form State
  const [modalForm, setModalForm] = useState({
    employeeID: "",
    percentage: "",
    department: "Development",
    remarks: ""
  });

  // ============================================================
  // FETCH ALL PERFORMANCES (LIVE API)
  // ============================================================
  const fetchAllPerformances = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://kt-backend-yzr4.onrender.com/api/performance/all",
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        const rawPerfs = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.performances)
            ? data.performances
            : Array.isArray(data)
              ? data
              : [];

        const filteredPerfs = rawPerfs.filter((perf) => {
          if (!perf) return false;
          if (isFinanceOrExcludedUser(perf)) return false;
          if (perf.employeeID && isFinanceOrExcludedUser(perf.employeeID)) return false;
          if (perf.employee && isFinanceOrExcludedUser(perf.employee)) return false;
          return true;
        });

        setPerformances(filteredPerfs);
      } else {
        setPerformances([]);
      }
    } catch (err) {
      console.error("Backend performance fetch error:", err);
      setPerformances([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // ============================================================
  // FETCH REAL EMPLOYEES (ONLY LIVE USERS, NO DUMMY DATA)
  // ============================================================
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(
        "https://kt-backend-yzr4.onrender.com/api/employee/list",
        { headers }
      );

      const data = await response.json();

      let rawList = [];
      if (Array.isArray(data)) rawList = data;
      else if (Array.isArray(data.employees)) rawList = data.employees;
      else if (Array.isArray(data.data)) rawList = data.data;
      else if (Array.isArray(data.users)) rawList = data.users;

      // Filter out finance and admin users using official utility
      const validEmployees = filterOutFinanceUsers(rawList);

      // Clean & deduplicate by email / ID
      const seen = new Set();
      const cleanEmployees = [];

      for (const emp of validEmployees) {
        if (!emp) continue;
        const id = String(emp._id || emp.id || emp.userId || "");
        const email = String(emp.email || emp.employeeEmail || "").toLowerCase().trim();
        const key = email || id;

        if (!key || seen.has(key)) continue;
        seen.add(key);

        const name =
          emp.fullName ||
          emp.name ||
          emp.displayName ||
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
          "Employee";

        cleanEmployees.push({
          _id: id,
          name,
          email,
          department: emp.department || emp.dept || "Development",
          role: emp.role || "employee",
          designation: emp.designation || ""
        });
      }

      setEmployees(cleanEmployees);
    } catch (err) {
      console.error("Failed to fetch real employees:", err);
      setEmployees([]);
    }
  }, [headers]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    }
    fetchAllPerformances();
  }, [isAdmin, fetchAllPerformances, fetchEmployees]);

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: "", type: "" });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
  };

  // Helper to extract employee display name
  const getEmployeeDisplayName = (perf) => {
    if (!perf) return "Unknown Employee";

    if (perf.employeeID && typeof perf.employeeID === "object") {
      const emp = perf.employeeID;
      if (emp.name) return emp.name;
      if (emp.fullName) return emp.fullName;
      if (emp.firstName && emp.lastName) return `${emp.firstName} ${emp.lastName}`.trim();
      if (emp.firstName) return emp.firstName;
      if (emp.displayName) return emp.displayName;
    }

    const candidates = [
      perf.employeeName,
      perf.employee?.name,
      perf.employee?.fullName,
      perf.employee?.displayName,
      perf.name,
      perf.fullName,
      perf.displayName,
    ];

    for (const val of candidates) {
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }

    return "Unknown Employee";
  };

  // Helper to extract employee email
  const getEmployeeEmail = (perf) => {
    if (!perf) return "";
    return (
      perf.employeeID?.email ||
      perf.employeeEmail ||
      perf.employee?.email ||
      perf.email ||
      ""
    );
  };

  // Helper to extract employee type label
  const getEmployeeTypeLabel = (perf) => {
    const rawType =
      perf?.employeeType ||
      perf?.employee?.type ||
      perf?.employeeID?.type ||
      perf?.type ||
      "";

    const normalized = String(rawType).trim().toLowerCase();

    switch (normalized) {
      case "intern":
        return "Intern";
      case "employee":
        return "Employee";
      case "teamlead":
      case "team lead":
      case "team_lead":
        return "Team Lead";
      default:
        return "Employee";
    }
  };

  // Helper to extract numeric percentage
  const getNumericPercentage = (perf) => {
    const val =
      perf?.performancePercentage ??
      perf?.percentage ??
      perf?.performance?.performancePercentage ??
      "";
    if (val === "" || val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  // Helper to resolve Department for an item
  const getDepartment = (perf) => {
    if (!perf) return "Development";

    const rawDept =
      perf.department ||
      perf.dept ||
      perf.employeeID?.department ||
      perf.employee?.department;

    if (rawDept) {
      if (typeof rawDept === "string" && rawDept.trim()) return rawDept.trim();
      if (typeof rawDept === "object" && rawDept.name) return rawDept.name;
      if (typeof rawDept === "object" && rawDept.departmentName) return rawDept.departmentName;
    }

    const desig =
      perf.designation ||
      perf.employeeID?.designation ||
      perf.employee?.designation;

    if (desig) {
      const dStr = typeof desig === "string" ? desig : (desig.name || desig.designationName || "");
      const lower = dStr.toLowerCase();
      if (lower.includes("frontend") || lower.includes("react") || lower.includes("ui")) return "Frontend";
      if (lower.includes("backend") || lower.includes("node") || lower.includes("api")) return "Backend";
      if (lower.includes("design") || lower.includes("figma") || lower.includes("ux")) return "Design";
      if (lower.includes("test") || lower.includes("qa")) return "Testing";
      if (lower.includes("hr") || lower.includes("human")) return "HR";
      if (lower.includes("dev") || lower.includes("engineer")) return "Development";
    }

    const role = String(perf.role || perf.employeeID?.role || "").toLowerCase();
    if (role.includes("lead") || role.includes("dev")) return "Development";
    if (role.includes("hr")) return "HR";

    const idStr = String(perf._id || perf.id || getEmployeeDisplayName(perf) || "item");
    const sum = idStr.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return DEPARTMENTS[sum % DEPARTMENTS.length];
  };

  // Department Badge color mapping
  const getDepartmentBadgeStyle = (dept) => {
    const d = String(dept).toLowerCase();
    if (d.includes("front")) return "bg-[#FDF2F8] text-[#DB2777]";
    if (d.includes("back")) return "bg-[#FFF7ED] text-[#EA580C]";
    if (d.includes("design")) return "bg-[#FAF5FF] text-[#9333EA]";
    if (d.includes("test") || d.includes("qa")) return "bg-[#F0FDF4] text-[#16A34A]";
    if (d.includes("hr")) return "bg-[#FEF2F2] text-[#DC2626]";
    return "bg-[#EFF6FF] text-[#2563EB]";
  };

  // Avatar Initials & colors
  const getInitials = (name) => {
    if (!name) return "EM";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarStyle = (dept = "") => {
    const d = String(dept).toLowerCase();
    if (d.includes("front")) return { bg: "bg-[#FDF2F8]", text: "text-[#DB2777]" };
    if (d.includes("back")) return { bg: "bg-[#FFF7ED]", text: "text-[#EA580C]" };
    if (d.includes("design")) return { bg: "bg-[#FAF5FF]", text: "text-[#9333EA]" };
    if (d.includes("test")) return { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]" };
    if (d.includes("hr")) return { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]" };
    return { bg: "bg-[#EEF2FF]", text: "text-[#4F46E5]" };
  };

  // Format date as M/D/YYYY
  const formatRowDate = (dateVal) => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  // ============================================================
  // ROLE ISOLATION: EMPLOYEE / TL OWN RECORD MATCHING
  // ============================================================
  const isMyRecord = useCallback((perf) => {
    if (!perf) return false;
    const myId = String(getRealAuthUserId(user) || user?._id || user?.id || user?.employeeId || "").toLowerCase().trim();
    const myEmail = String(user?.email || "").toLowerCase().trim();
    const myName = String(user?.name || user?.fullName || "").toLowerCase().trim();

    // 1. Check ID match
    const perfEmpId = String(
      (typeof perf.employeeID === "object" ? (perf.employeeID?._id || perf.employeeID?.id || perf.employeeID?.userId) : perf.employeeID) ||
      (typeof perf.employee === "object" ? (perf.employee?._id || perf.employee?.id || perf.employee?.userId) : perf.employee) ||
      perf.employeeId ||
      perf.userId ||
      ""
    ).toLowerCase().trim();

    if (myId && perfEmpId && myId === perfEmpId) return true;

    // 2. Check Email match
    const perfEmail = String(
      (typeof perf.employeeID === "object" ? perf.employeeID?.email : "") ||
      (typeof perf.employee === "object" ? perf.employee?.email : "") ||
      perf.employeeEmail ||
      perf.email ||
      ""
    ).toLowerCase().trim();

    if (myEmail && perfEmail && myEmail === perfEmail) return true;

    // 3. Check Name match
    const perfName = String(
      (typeof perf.employeeID === "object" ? (perf.employeeID?.name || perf.employeeID?.fullName) : "") ||
      (typeof perf.employee === "object" ? (perf.employee?.name || perf.employee?.fullName) : "") ||
      perf.employeeName ||
      perf.name ||
      perf.fullName ||
      ""
    ).toLowerCase().trim();

    if (myName && perfName && (myName === perfName || (myName.length >= 3 && perfName.length >= 3 && (myName.includes(perfName) || perfName.includes(myName))))) return true;

    return false;
  }, [user]);

  // Role-isolated performances: Admin sees all; Employee and TL see ONLY their own records
  const myPerformances = useMemo(() => {
    if (isAdmin) {
      return performances;
    }
    return performances.filter(isMyRecord);
  }, [performances, isAdmin, isMyRecord]);

  // ============================================================
  // PERFORMANCE METRICS CALCULATION (PURELY DYNAMIC)
  // ============================================================
  const metrics = useMemo(() => {
    if (!isAdmin) {
      // Personal KPIs for Employee & Team Lead
      const totalReviews = myPerformances.length;
      if (totalReviews === 0) {
        return {
          isPersonal: true,
          latestScore: 0,
          averageScore: 0,
          totalReviews: 0,
          ratingLabel: "Pending Evaluation",
          ratingColor: "text-slate-500",
          latestDept: user?.department || "Development"
        };
      }

      // Sort newest first
      const sorted = [...myPerformances].sort((a, b) => {
        const da = new Date(a.createdAt || a.date || 0);
        const db = new Date(b.createdAt || b.date || 0);
        return db - da;
      });

      const latest = sorted[0];
      const latestScore = getNumericPercentage(latest);

      const sum = myPerformances.reduce((acc, p) => acc + getNumericPercentage(p), 0);
      const averageScore = Math.round(sum / totalReviews);

      let ratingLabel = "Needs Improvement";
      let ratingColor = "text-[#F59E0B]";
      if (latestScore >= 80) {
        ratingLabel = "Excellent";
        ratingColor = "text-[#10B981]";
      } else if (latestScore >= 50) {
        ratingLabel = "Good";
        ratingColor = "text-[#3B82F6]";
      }

      return {
        isPersonal: true,
        latestScore,
        averageScore,
        totalReviews,
        ratingLabel,
        ratingColor,
        latestDept: getDepartment(latest)
      };
    }

    // Admin Metrics (Company-wide)
    const totalRecords = performances.length;
    let excellentCount = 0;
    let goodCount = 0;
    let needsImprovementCount = 0;

    performances.forEach((perf) => {
      const pct = getNumericPercentage(perf);
      if (pct >= 80) excellentCount++;
      else if (pct >= 50) goodCount++;
      else needsImprovementCount++;
    });

    const displayTotalEmployees = employees.length > 0 ? employees.length : totalRecords;
    const excellentRatio = totalRecords > 0 ? (excellentCount / totalRecords) * 100 : 0;
    const goodRatio = totalRecords > 0 ? (goodCount / totalRecords) * 100 : 0;
    const needsImprovementRatio = totalRecords > 0 ? (needsImprovementCount / totalRecords) * 100 : 0;

    return {
      isPersonal: false,
      totalEmployees: displayTotalEmployees,
      excellentCount,
      goodCount,
      needsImprovementCount,
      excellentRatio,
      goodRatio,
      needsImprovementRatio
    };
  }, [performances, myPerformances, employees, isAdmin, user]);

  // Available Month-Year Options from actual data
  const monthYearOptions = useMemo(() => {
    const set = new Set();
    myPerformances.forEach((p) => {
      const rawDate = p.createdAt || p.date;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        set.add(ym);
      }
    });

    return Array.from(set).sort().reverse().map((ym) => {
      const [year, month] = ym.split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { value: ym, label };
    });
  }, [myPerformances]);

  // ============================================================
  // FILTERED PERFORMANCES LIST
  // ============================================================
  const filteredPerformances = useMemo(() => {
    return myPerformances.filter((perf) => {
      const name = getEmployeeDisplayName(perf).toLowerCase();
      const email = getEmployeeEmail(perf).toLowerCase();
      const dept = getDepartment(perf).toLowerCase();
      const remarks = String(perf.remarks || "").toLowerCase();
      const pct = getNumericPercentage(perf);

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          name.includes(q) ||
          email.includes(q) ||
          dept.includes(q) ||
          remarks.includes(q);
        if (!matchesQuery) return false;
      }

      // Toolbar: Department Dropdown
      if (toolbarDept !== "all") {
        if (dept !== toolbarDept.toLowerCase()) return false;
      }

      // Toolbar: Performance Dropdown
      if (toolbarPerfFilter !== "all") {
        if (toolbarPerfFilter === "excellent" && pct < 80) return false;
        if (toolbarPerfFilter === "good" && (pct < 50 || pct >= 80)) return false;
        if (toolbarPerfFilter === "needs-improvement" && pct >= 50) return false;
      }

      // Toolbar: Month / Year Filter
      if (selectedMonthYear !== "all") {
        const rawDate = perf.createdAt || perf.date;
        if (!rawDate) return false;
        const pDate = new Date(rawDate);
        if (isNaN(pDate.getTime())) return false;
        const ymStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, "0")}`;
        if (ymStr !== selectedMonthYear) return false;
      }

      return true;
    });
  }, [
    myPerformances,
    searchQuery,
    toolbarDept,
    toolbarPerfFilter,
    selectedMonthYear
  ]);

  // ============================================================
  // FORM / MODAL ACTIONS
  // ============================================================

  const handleOpenAddModal = () => {
    if (!isAdmin) return;
    setModalForm({
      employeeID: "",
      percentage: "",
      department: "Development",
      remarks: ""
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (perf) => {
    if (!isAdmin) return;
    setEditingRecord(perf);
    setModalForm({
      employeeID: String(perf.employeeID?._id || perf.employeeID || perf.employee?._id || ""),
      percentage: String(getNumericPercentage(perf)),
      department: getDepartment(perf),
      remarks: perf.remarks || ""
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    if (!modalForm.employeeID) {
      showNotification("Please select an employee", "error");
      return;
    }

    const pct = Number(modalForm.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100 || modalForm.percentage === "") {
      showNotification("Please enter a valid percentage between 0 and 100", "error");
      return;
    }

    setSubmitting(true);

    try {
      if (isEditModalOpen && editingRecord) {
        const response = await fetch(
          `https://kt-backend-yzr4.onrender.com/api/performance/update/${editingRecord._id}`,
          {
            method: "PUT",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              remarks: modalForm.remarks,
              performancePercentage: pct,
              department: modalForm.department
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to update performance record");
        }

        showNotification("Performance record updated successfully!", "success");
        setIsEditModalOpen(false);
        setEditingRecord(null);
      } else {
        const response = await fetch(
          "https://kt-backend-yzr4.onrender.com/api/performance/create",
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              employeeID: modalForm.employeeID,
              performancePercentage: pct,
              remarks: modalForm.remarks || "",
              department: modalForm.department || "Development"
            }),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to submit performance record");
        }

        showNotification("Performance submitted successfully!", "success");
        setIsAddModalOpen(false);
      }

      await fetchAllPerformances();
      setModalForm({ employeeID: "", percentage: "", department: "Development", remarks: "" });
    } catch (err) {
      console.error("Submit error:", err);
      showNotification(err.message || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Record
  const handleDeletePerformance = async (perf) => {
    if (!isAdmin) return;
    const employeeName = getEmployeeDisplayName(perf);

    const confirmed = await confirm({
      title: "Delete performance record?",
      message: `Are you sure you want to delete performance record for ${employeeName}?`,
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/performance/delete/${perf._id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete performance");
      }

      showNotification(`Performance record for ${employeeName} deleted successfully!`, "success");
      await fetchAllPerformances();
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Failed to delete performance record", "error");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6 font-sans">
      {confirmationDialog}

      {/* Floating Toast Notification */}
      {notification.message && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs sm:text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
              : notification.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800"
                : "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-800"
            }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          ) : notification.type === "error" ? (
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400" />
          ) : (
            <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification({ message: "", type: "" })}
            className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. TOP HEADER */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {isAdmin ? "Performance Management" : isTL ? "Team Lead Performance" : "My Performance"}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {isAdmin ? "Admin" : isTL ? "Team Lead (Read-Only)" : "Employee (Read-Only)"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isAdmin
                ? "Track and manage employee performance with ease."
                : "View your personal performance scores, evaluations, and supervisor remarks."}
            </p>
          </div>
        </div>

        {/* Sync / Refresh button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAllPerformances}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer disabled:opacity-60 transition"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600" : "text-slate-400"} />
            <span>{loading ? "Refreshing..." : "Sync"}</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. TOP METRIC CARDS (4 STATS FULL WIDTH) */}
      {/* ==================================================== */}
      {/* 2. TOP METRIC CARDS (4 CARDS) */}
      {/* ==================================================== */}
      {isAdmin ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Evaluated", value: metrics.totalEmployees, accent: "border-l-indigo-600" },
            { label: "Excellent", value: `${metrics.excellentCount}`, accent: "border-l-emerald-500" },
            { label: "Good", value: `${metrics.goodCount}`, accent: "border-l-blue-500" },
            { label: "Needs Improvement", value: `${metrics.needsImprovementCount}`, accent: "border-l-amber-500" }
          ].map((item, idx) => (
            <div
              key={idx}
              className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}
            >
              <div className="flex items-start justify-between">
                <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Latest Score", value: `${metrics.latestScore}%`, accent: "border-l-indigo-600" },
            {
              label: "Current Standing",
              value: metrics.ratingLabel,
              accent: metrics.ratingLabel === "Excellent" ? "border-l-emerald-500" : metrics.ratingLabel === "Good" ? "border-l-blue-500" : "border-l-amber-500"
            },
            { label: "Average Score", value: `${metrics.averageScore}%`, accent: "border-l-purple-500" },
            { label: "Evaluations", value: metrics.totalReviews, accent: "border-l-amber-500" }
          ].map((item, idx) => (
            <div
              key={idx}
              className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}
            >
              <div className="flex items-start justify-between">
                <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. PERFORMANCE HISTORY CARD (FULL WIDTH) */}
      {/* ==================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 lg:p-6 shadow-xs space-y-4">

        {/* Header Row: Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAdmin ? "Performance History" : "My Performance History"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin
                  ? "View and manage employee performance records"
                  : "Personal performance evaluations and review remarks"}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Performance</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Toolbar: Search, Dept, Status, Month/Year */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full md:flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAdmin ? "Search by employee name, email or department..." : "Search evaluations or remarks..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
            {/* Department Dropdown (Admin only) */}
            {isAdmin && (
              <div className="relative">
                <select
                  value={toolbarDept}
                  onChange={(e) => setToolbarDept(e.target.value)}
                  className="h-10 px-3.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer appearance-none pr-8 font-normal"
                >
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Performance Dropdown */}
            <div className="relative">
              <select
                value={toolbarPerfFilter}
                onChange={(e) => setToolbarPerfFilter(e.target.value)}
                className="h-10 px-3.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer appearance-none pr-8 font-normal"
              >
                <option value="all">All Performance</option>
                <option value="excellent">Excellent (≥ 80%)</option>
                <option value="good">Good (50% - 79%)</option>
                <option value="needs-improvement">Needs Improvement (&lt; 50%)</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Month/Year selector */}
            <div className="relative">
              <select
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="h-10 pl-8 pr-8 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer appearance-none font-normal"
              >
                <option value="all">All Dates</option>
                {monthYearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Container */}
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading performance data...</p>
          </div>
        ) : filteredPerformances.length === 0 ? (
          <div className="p-16 text-center">
            <Award size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No performance records found
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || toolbarDept !== "all" || toolbarPerfFilter !== "all" || selectedMonthYear !== "all"
                ? "No performance records match your current filter criteria."
                : isAdmin
                  ? "No employee performance evaluations recorded yet. Start by clicking 'Add Performance'."
                  : "Your performance reviews and scores will appear here once assessed by administration."}
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>Add Performance</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-10 text-left">No.</th>
                  <th className="py-3 px-4">EMPLOYEE</th>
                  <th className="py-3 px-4">DEPARTMENT</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">PERFORMANCE</th>
                  <th className="py-3 px-4">REMARKS</th>
                  <th className="py-3 px-4">DATE</th>
                  {isAdmin && <th className="py-3 px-4 text-center">ACTIONS</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPerformances.map((perf, index) => {
                  const rowNumber = index + 1;
                  const empName = getEmployeeDisplayName(perf);
                  const empEmail = getEmployeeEmail(perf);
                  const empType = getEmployeeTypeLabel(perf);
                  const dept = getDepartment(perf);
                  const pct = getNumericPercentage(perf);
                  const dateFormatted = formatRowDate(perf.createdAt || perf.date);

                  // Progress bar color based on percentage
                  const barColor =
                    pct >= 80 ? "bg-[#10B981]" : pct >= 50 ? "bg-[#2563EB]" : "bg-[#F59E0B]";

                  // Avatar circle color
                  const avatarStyle = getAvatarStyle(dept);

                  return (
                    <tr
                      key={perf._id || index}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3.5 px-3 text-slate-500 font-medium">
                        {rowNumber}
                      </td>

                      {/* Employee (Avatar + Name + Email) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full ${avatarStyle.bg} ${avatarStyle.text} font-bold text-xs flex items-center justify-center shrink-0`}
                          >
                            {getInitials(empName)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                              {empName}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
                              {empEmail || "No email available"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap inline-block ${getDepartmentBadgeStyle(
                            dept
                          )}`}
                        >
                          {dept}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] whitespace-nowrap inline-block">
                          {empType}
                        </span>
                      </td>

                      {/* Performance & Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {pct}%
                          </span>
                          <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full ${barColor} rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate" title={perf.remarks}>
                          {perf.remarks || "—"}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {dateFormatted}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(perf)}
                              className="w-7 h-7 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center transition cursor-pointer"
                              title="Edit performance"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePerformance(perf)}
                              className="w-7 h-7 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center transition cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 4. MODAL: ADD / EDIT PERFORMANCE EVALUATION */}
      {/* ==================================================== */}
      {isAdmin && (isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  {isEditModalOpen ? <Edit3 size={16} /> : <Plus size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isEditModalOpen ? "Edit Performance Record" : "Add Performance Record"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isEditModalOpen
                      ? "Update score and review remarks"
                      : "Evaluate staff score and performance remarks"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  setEditingRecord(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="p-4 sm:p-5 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Employee *
                </label>
                <div className="relative">
                  <select
                    disabled={isEditModalOpen}
                    value={modalForm.employeeID}
                    onChange={(e) => {
                      const emp = employees.find((emp) => String(emp._id) === e.target.value);
                      setModalForm({
                        ...modalForm,
                        employeeID: e.target.value,
                        department: emp?.department || modalForm.department || "Development"
                      });
                    }}
                    required
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer pr-8 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} {emp.email ? `(${emp.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Performance Percentage & Department in row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Performance % *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      required
                      placeholder="e.g. 85"
                      value={modalForm.percentage}
                      onChange={(e) => setModalForm({ ...modalForm, percentage: e.target.value })}
                      className="w-full h-10 pl-3 pr-7 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <select
                      value={modalForm.department || "Development"}
                      onChange={(e) => setModalForm({ ...modalForm, department: e.target.value })}
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer pr-8 transition-all"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Remarks
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    maxLength={200}
                    placeholder="Add remarks about the employee's performance..."
                    value={modalForm.remarks}
                    onChange={(e) => setModalForm({ ...modalForm, remarks: e.target.value })}
                    className="w-full p-3 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none transition-all"
                  />
                  <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-medium">
                    {modalForm.remarks.length}/200
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer shadow-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{isEditModalOpen ? "Update Record" : "Submit Record"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;