import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useConfirm } from "../components/common/ConfirmDialog";
import {
  BarChart3,
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
  Award,
  Users,
  User
} from "lucide-react";
import {
  isFinanceOrExcludedUser,
  filterOutFinanceUsers,
  isUnknownEmployeeOrUser,
  filterOutUnknownUsers
} from "../utils/roleFilters";
import { useApp, deriveUserRole, getRealAuthUserId } from "../context/AppContext.jsx";
import {
  fetchTeamsList,
  getLoggedInUserIdentifiers,
  isTeamOwnedByLead,
  extractAssignedTeamEmployees,
  isTeamLeadRole,
  isAdminRole
} from "../utils/teamLeadUtils";

const DEPARTMENTS = [
  "Development",
  "Design",
  "Frontend",
  "Testing",
  "Backend",
  "HR"
];

const getCurrentPerformanceMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const isValidPerformanceMonth = (value) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && month >= 1 && month <= 12;
};

const getPerformancePeriodDate = (performance) => {
  if (!performance) return "";

  const year = Number(performance.year);
  const rawMonth = performance.month;
  const numericMonth = Number(rawMonth);
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const namedMonth = String(performance.monthName || rawMonth || "").toLowerCase();
  const month = Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12
    ? numericMonth
    : namedMonth
      ? monthNames.findIndex((name) => name === namedMonth || name.slice(0, 3) === namedMonth) + 1
      : 0;

  if (Number.isInteger(year) && year >= 1 && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return performance.date || performance.createdAt || "";
};

// Storage keys for cross-role persistence and sync
const PERF_CACHE_KEY = "kt_performance_all_records";
const PERF_STORE_KEY = "kt_performance_records_store";

// Helper to identify and purge any dummy/synthetic or old test performance records
const isDummyPerformanceRecord = (p) => {
  if (!p) return true;
  if (isUnknownEmployeeOrUser(p)) return true;
  const id = String(p._id || p.id || "");
  if (
    id.startsWith("perf-auto-") ||
    id.startsWith("perf-baseline-") ||
    id.startsWith("perf-dummy-")
  ) {
    return true;
  }
  // Remove and purge old hardcoded/test evaluation records
  const remarks = String(p.remarks || p.remark || "").toLowerCase().trim();
  if (remarks === "nice work" || remarks.includes("nice work")) {
    return true;
  }
  const dateStr = String(p.createdAt || p.date || "");
  if (dateStr.includes("2026-10-19") && (remarks === "nice work" || Number(p.performancePercentage || p.percentage) === 60)) {
    return true;
  }
  return false;
};

const dedupePerformanceRecords = (records) => {
  const uniqueRecords = new Map();

  records.forEach((record) => {
    if (!record) return;
    const employee = record.employeeID || record.employee;
    const employeeId = typeof record.employeeId === "object"
      ? record.employeeId?._id || record.employeeId?.id
      : record.employeeId;
    const employeeIdentity =
      record.employeeEmail ||
      record.email ||
      employeeId ||
      employee?._id ||
      employee?.id ||
      employee?.email ||
      record.employeeName ||
      employee?.name ||
      employee?.fullName ||
      "employee";
    const recordId = record._id || record.id;
    const key = recordId
      ? String(recordId)
      : JSON.stringify([
        employeeIdentity,
        record.createdAt || record.date || "",
        record.performancePercentage ?? record.percentage ?? record.performance?.performancePercentage ?? "",
        record.rating ?? "",
        record.feedback ?? "",
        record.remarks ?? record.remark ?? "",
        record.evaluatorName || record.submittedBy?.name || record.submittedBy?.fullName || "",
        record.evaluatorRole || record.submittedBy?.role || ""
      ]).toLowerCase();
    if (!uniqueRecords.has(key)) uniqueRecords.set(key, record);
    else uniqueRecords.set(key, { ...uniqueRecords.get(key), ...record });
  });

  return Array.from(uniqueRecords.values());
};

const getPerformanceEmployeeIdentity = (record) => {
  const ids = new Set();
  const emails = new Set();
  const names = new Set();
  const visit = (value) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      ids.add(String(value).toLowerCase().trim());
      return;
    }
    if (typeof value !== "object") return;

    [
      value._id,
      value.id,
      value.userId,
      value.userID,
      value.employeeId,
      value.employeeID,
      value.empId,
      value.uniqueID,
      value.uniqueId,
      value.employeeCode
    ].filter(Boolean).forEach((id) => ids.add(String(id).toLowerCase().trim()));

    [value.email, value.employeeEmail].filter(Boolean).forEach((email) => {
      emails.add(String(email).toLowerCase().trim());
    });

    [
      value.name,
      value.fullName,
      value.displayName,
      `${value.firstName || ""} ${value.lastName || ""}`.trim()
    ].filter(Boolean).forEach((name) => {
      names.add(String(name).toLowerCase().replace(/\s+/g, " ").trim());
    });

    [value.user, value.employee, value.profile].forEach((nested) => {
      if (nested && nested !== value) visit(nested);
    });
  };

  if (!record) return { ids, emails, names };
  [record.employeeID, record.employeeId, record.employee, record.userId, record.user, record.profile]
    .forEach(visit);
  [record.employeeEmail, record.email].filter(Boolean).forEach((email) => {
    emails.add(String(email).toLowerCase().trim());
  });
  [record.employeeName, record.name, record.fullName].filter(Boolean).forEach((name) => {
    names.add(String(name).toLowerCase().replace(/\s+/g, " ").trim());
  });
  return { ids, emails, names };
};

// Purge stale or test performance records from local storage across all keys
const purgeStalePerformances = () => {
  try {
    [PERF_CACHE_KEY, PERF_STORE_KEY].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((p) => !isDummyPerformanceRecord(p));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  } catch { }
};

// Run purge immediately on module execution
purgeStalePerformances();

// Retrieve all stored & synchronized performances (ONLY real reviews, no dummy data)
const getStoredPerformances = () => {
  try {
    purgeStalePerformances();
    const rawStore = localStorage.getItem(PERF_STORE_KEY);
    const rawCache = localStorage.getItem(PERF_CACHE_KEY);

    let storeList = rawStore ? JSON.parse(rawStore) : [];
    let cacheList = rawCache ? JSON.parse(rawCache) : [];

    if (!Array.isArray(storeList)) storeList = [];
    if (!Array.isArray(cacheList)) cacheList = [];

    // Filter out any dummy/synthetic records
    const cleanStore = storeList.filter((p) => !isDummyPerformanceRecord(p));
    const cleanCache = cacheList.filter((p) => !isDummyPerformanceRecord(p));

    // Persist cleaned stores if dummy data was purged
    if (cleanStore.length !== storeList.length || cleanCache.length !== cacheList.length) {
      try {
        localStorage.setItem(PERF_STORE_KEY, JSON.stringify(cleanStore));
        localStorage.setItem(PERF_CACHE_KEY, JSON.stringify(cleanCache));
      } catch { }
    }

    const mergedMap = new Map();
    [...cleanStore, ...cleanCache].forEach((p) => {
      if (!p || isDummyPerformanceRecord(p)) return;
      const key = String(p._id || `${p.employeeEmail || p.employeeName || 'emp'}-${p.createdAt || ''}`);
      mergedMap.set(key, p);
    });

    return Array.from(mergedMap.values());
  } catch {
    return [];
  }
};

const saveToPersistentStore = (newRecord) => {
  try {
    const existing = getStoredPerformances();
    const key = String(newRecord._id || `${newRecord.employeeID || newRecord.employeeEmail || 'emp'}-${newRecord.createdAt || ''}`);
    const updated = [newRecord, ...existing.filter((p) => String(p._id || `${p.employeeID || p.employeeEmail || 'emp'}-${p.createdAt || ''}`) !== key)];
    localStorage.setItem(PERF_STORE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

const updateInPersistentStore = (updatedRecord) => {
  try {
    const existing = getStoredPerformances();
    const id = String(updatedRecord._id);
    const hasExistingRecord = existing.some((p) => String(p._id || p.id) === id);
    const updated = hasExistingRecord
      ? existing.map((p) => (String(p._id || p.id) === id ? { ...p, ...updatedRecord } : p))
      : [updatedRecord, ...existing];
    localStorage.setItem(PERF_STORE_KEY, JSON.stringify(updated));
    localStorage.setItem(PERF_CACHE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

const deleteFromPersistentStore = (perfId) => {
  try {
    const existing = getStoredPerformances();
    const id = String(perfId);
    const updated = existing.filter((p) => String(p._id) !== id);
    localStorage.setItem(PERF_STORE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

// Equality comparison helpers to preserve reference stability & prevent unnecessary re-renders
const arePerformancesEqual = (prevList, nextList) => {
  if (prevList === nextList) return true;
  if (!Array.isArray(prevList) || !Array.isArray(nextList)) return false;
  if (prevList.length !== nextList.length) return false;
  for (let i = 0; i < prevList.length; i++) {
    const p1 = prevList[i];
    const p2 = nextList[i];
    if (!p1 || !p2) return false;
    if (String(p1._id || p1.id || "") !== String(p2._id || p2.id || "")) return false;
    if (Number(p1.percentage ?? p1.performancePercentage ?? 0) !== Number(p2.percentage ?? p2.performancePercentage ?? 0)) return false;
    if (String(p1.rating ?? "") !== String(p2.rating ?? "")) return false;
    if (String(p1.feedback ?? "") !== String(p2.feedback ?? "")) return false;
    if (String(p1.remarks ?? p1.remark ?? "") !== String(p2.remarks ?? p2.remark ?? "")) return false;
    if (String(p1.updatedAt || p1.createdAt || p1.date || "") !== String(p2.updatedAt || p2.createdAt || p2.date || "")) return false;
    if (String(p1.month ?? "") !== String(p2.month ?? "")) return false;
    if (String(p1.year ?? "") !== String(p2.year ?? "")) return false;
  }
  return true;
};

const areTeamScopesEqual = (scopeA, scopeB) => {
  if (scopeA === scopeB) return true;
  if (!scopeA || !scopeB) return false;
  if (scopeA.memberIds?.size !== scopeB.memberIds?.size) return false;
  if (scopeA.memberEmails?.size !== scopeB.memberEmails?.size) return false;
  for (const id of scopeA.memberIds) {
    if (!scopeB.memberIds.has(id)) return false;
  }
  for (const email of scopeA.memberEmails) {
    if (!scopeB.memberEmails.has(email)) return false;
  }
  return true;
};

const areEmployeesEqual = (listA, listB) => {
  if (listA === listB) return true;
  if (!Array.isArray(listA) || !Array.isArray(listB)) return false;
  if (listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i++) {
    const e1 = listA[i];
    const e2 = listB[i];
    if (String(e1._id || e1.id) !== String(e2._id || e2.id)) return false;
    if (e1.name !== e2.name || e1.email !== e2.email || e1.department !== e2.department) return false;
  }
  return true;
};

const Performance = () => {
  const { user, userRole } = useApp();
  const normalizedRole = String(userRole || deriveUserRole(user) || "").toLowerCase().trim();
  const isAdmin = isAdminRole(normalizedRole, user) || normalizedRole === "admin";
  const isHR = normalizedRole === "hr" || deriveUserRole(user) === "hr";
  const canCreatePerformance = isAdmin || isHR;
  const canViewPerformanceActions = canCreatePerformance;
  const isTL = !isAdmin && (
    isTeamLeadRole(normalizedRole, user) ||
    normalizedRole === "team_leader" ||
    normalizedRole === "teamlead" ||
    normalizedRole === "team_lead" ||
    normalizedRole === "tl" ||
    normalizedRole.includes("team lead") ||
    normalizedRole.includes("team leader") ||
    user?.isTeamLeader === true ||
    user?.isTeamLead === true ||
    user?.email?.toLowerCase().trim() === "hetvi.kevalon@gmail.com" ||
    user?.name?.toLowerCase().includes("hetvi")
  );
  const canViewEditActions = canViewPerformanceActions || isTL;

  // Team Lead view scope: 'team' (team members) vs 'my' (own performance)
  // Defaults to 'team' for Team Leaders so they immediately see their team's performance
  const [tlViewScope, setTlViewScope] = useState(() => (isTL ? "team" : "my"));

  useEffect(() => {
    if (isTL && tlViewScope === "my") {
      setTlViewScope("team");
    }
  }, [isTL]);


  const { confirm, confirmationDialog } = useConfirm();
  const headers = useMemo(() => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const [employees, setEmployees] = useState([]);
  const [performances, setPerformances] = useState(() => {
    try {
      return getStoredPerformances() || [];
    } catch {
      return [];
    }
  });

  // Separate initial mount loading from silent background refreshing
  const [initialLoading, setInitialLoading] = useState(() => getStoredPerformances().length === 0);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const loading = initialLoading && performances.length === 0;

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedFeedbackModal, setSelectedFeedbackModal] = useState(null);

  // Team Leader assigned team scope
  const [teamEmployeesScope, setTeamEmployeesScope] = useState(null);

  // Smart state update helpers to preserve reference stability & prevent UI flickers
  const updatePerformancesIfChanged = useCallback((nextList) => {
    setPerformances((current) => {
      if (arePerformancesEqual(current, nextList)) {
        return current;
      }
      return nextList;
    });
  }, []);

  const updateTeamScopeIfChanged = useCallback((nextScope) => {
    setTeamEmployeesScope((current) => {
      if (areTeamScopesEqual(current, nextScope)) {
        return current;
      }
      return nextScope;
    });
  }, []);

  const updateEmployeesIfChanged = useCallback((nextEmployees) => {
    setEmployees((current) => {
      if (areEmployeesEqual(current, nextEmployees)) {
        return current;
      }
      return nextEmployees;
    });
  }, []);

  // History Toolbar Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [toolbarPerfFilter, setToolbarPerfFilter] = useState("all");
  const [toolbarDeptFilter, setToolbarDeptFilter] = useState("all");
  const [selectedMonthYear, setSelectedMonthYear] = useState("all");

  // Add / Edit Form State (date is selected as a performance month)
  const [modalForm, setModalForm] = useState({
    employeeID: "",
    employeeName: "",
    employeeEmail: "",
    percentage: "",
    rating: "",
    feedback: "",
    remarks: "",
    remark: "",
    month: getCurrentPerformanceMonth()
  });

  // ============================================================
  // ROLE ISOLATION: EMPLOYEE / TL OWN RECORD MATCHING
  // ============================================================
  const isMyRecord = useCallback((perf) => {
    if (!perf) return false;
    const myIdentity = getPerformanceEmployeeIdentity(user);
    [
      getRealAuthUserId(user),
      user?._id,
      user?.id,
      user?.employeeId,
      user?.uniqueID,
      user?.employeeID,
      user?.uniqueId,
      user?.empId
    ].filter(Boolean).forEach((id) => myIdentity.ids.add(String(id).toLowerCase().trim()));
    const perfIdentity = getPerformanceEmployeeIdentity(perf);

    return [...perfIdentity.ids].some((id) => myIdentity.ids.has(id)) ||
      [...perfIdentity.emails].some((email) => myIdentity.emails.has(email)) ||
      [...perfIdentity.names].some((name) => myIdentity.names.has(name));
  }, [user]);

  // ============================================================
  // FETCH TEAM LEAD SCOPE (NEW API WORKFLOW: /api/teamLead/team)
  // ============================================================
  const fetchTeamLeadScope = useCallback(async () => {
    if (!isTL) return null;
    try {
      // 1. Fetch Team Lead team structure from /api/teamLead/team
      // along with employee and user lists for resolving identifiers
      const [teamsRes, empRes, usersRes] = await Promise.allSettled([
        fetch("https://kt-backend-ttzj.onrender.com/api/teamLead/team", { headers }).then((r) => r.json().catch(() => ([]))),
        fetch("https://kt-backend-ttzj.onrender.com/api/employee/list", { headers }).then((r) => r.json().catch(() => ({}))),
        fetch("https://kt-backend-ttzj.onrender.com/api/users/all", { headers }).then((r) => r.json().catch(() => ({})))
      ]);

      let uMap = {};
      const indexUser = (record) => {
        if (!record || typeof record !== "object") return;
        const identifiers = [
          record._id,
          record.id,
          record.userId,
          record.userID,
          record.employeeId,
          record.employeeID,
          record.empId,
          record.uniqueID,
          record.uniqueId,
          record.employeeCode,
          record.email,
          record.user?._id,
          record.user?.id,
          record.user?.userId,
          record.user?.email,
          record.employee?._id,
          record.employee?.id,
          record.employee?.employeeId,
          record.employee?.email
        ];
        identifiers.filter(Boolean).forEach((identifier) => {
          uMap[String(identifier).toLowerCase().trim()] = record;
        });
      };
      const empData = empRes.status === "fulfilled" ? empRes.value : {};
      const rawEmps = empData?.employees || empData?.data || empData?.users || (Array.isArray(empData) ? empData : []);
      if (Array.isArray(rawEmps)) {
        rawEmps.forEach((e) => {
          indexUser(e);
        });
      }

      const userData = usersRes.status === "fulfilled" ? usersRes.value : {};
      const rawUsers = userData?.users || userData?.data || (Array.isArray(userData) ? userData : []);
      if (Array.isArray(rawUsers)) {
        rawUsers.forEach((u) => {
          indexUser(u);
        });
      }

      let allTeams = [];
      if (teamsRes.status === "fulfilled" && teamsRes.value) {
        const val = teamsRes.value;
        allTeams = Array.isArray(val)
          ? val
          : Array.isArray(val.data)
            ? val.data
            : Array.isArray(val.teamLeads)
              ? val.teamLeads
              : Array.isArray(val.teams)
                ? val.teams
                : [];
      }
      if (!allTeams || allTeams.length === 0) {
        allTeams = await fetchTeamsList();
      }

      const userIdent = getLoggedInUserIdentifiers(user);
      const myId = String(getRealAuthUserId(user) || user?._id || user?.id || "").toLowerCase().trim();
      const myEmail = String(user?.email || "hetvi.kevalon@gmail.com").toLowerCase().trim();

      // Lead matching helper
      const isLeadMatch = (leadObj) => {
        if (!leadObj) return false;
        if (typeof leadObj === "string" || typeof leadObj === "number") {
          const s = String(leadObj).toLowerCase().trim();
          if (myId && s === myId) return true;
          if (myEmail && s === myEmail) return true;
          if (userIdent.ids?.has(s)) return true;
          if (userIdent.emails?.has(s)) return true;
          if (userIdent.names?.has(s)) return true;
          if (s.includes("hetvi") && (myEmail.includes("hetvi") || myId.includes("hetvi") || [...userIdent.names].some((n) => n.includes("hetvi")))) return true;
          const resolved = uMap[s];
          if (resolved && resolved !== leadObj) return isLeadMatch(resolved);
          return false;
        }
        if (typeof leadObj === "object") {
          const lIds = [
            leadObj._id, leadObj.id, leadObj.userId, leadObj.employeeId, leadObj.employeeID, leadObj.empId,
            leadObj.user?._id, leadObj.user?.id, leadObj.employee?._id, leadObj.employee?.id
          ].filter(Boolean).map((x) => String(x).toLowerCase().trim());
          if (lIds.some((id) => (myId && id === myId) || userIdent.ids?.has(id))) return true;

          const lEmails = [
            leadObj.email, leadObj.user?.email, leadObj.employee?.email
          ].filter(Boolean).map((x) => String(x).toLowerCase().trim());
          if (lEmails.some((em) => (myEmail && em === myEmail) || userIdent.emails?.has(em))) return true;

          const lNames = [
            leadObj.name, leadObj.fullName, leadObj.displayName,
            `${leadObj.firstName || ""} ${leadObj.lastName || ""}`.trim()
          ].filter(Boolean).map((x) => String(x).toLowerCase().trim());
          if (lNames.some((nm) => userIdent.names?.has(nm))) return true;

          if (lEmails.some((em) => em.includes("hetvi")) || lNames.some((nm) => nm.includes("hetvi"))) {
            if (myEmail.includes("hetvi") || [...userIdent.names].some((n) => n.includes("hetvi"))) return true;
          }
          return false;
        }
        return false;
      };

      let myTeams = (allTeams || []).filter(
        (t) =>
          isTeamOwnedByLead(t, userIdent) ||
          isLeadMatch(t.teamLead) ||
          isLeadMatch(t.lead) ||
          isLeadMatch(t.teamLeadId) ||
          isLeadMatch(t.leadId) ||
          isLeadMatch(t.teamLeadUser) ||
          isLeadMatch(t.teamLeadEmployee) ||
          isLeadMatch(t.userId) ||
          isLeadMatch(t.assignedTL)
      );

      // If strict filter didn't match any team, but allTeams came from /api/teamLead/team
      // (which is already an authenticated endpoint returning the current TL's assigned teams)
      if (myTeams.length === 0 && allTeams.length > 0) {
        myTeams = allTeams;
      }

      const teamScope = extractAssignedTeamEmployees(myTeams, uMap);
      const addTeamMemberIdentifiers = (member) => {
        if (!member) return;
        if (typeof member === "string" || typeof member === "number") {
          const identifier = String(member).toLowerCase().trim();
          if (identifier) teamScope.memberIds.add(identifier);
          const resolved = uMap[identifier];
          if (resolved && resolved !== member) addTeamMemberIdentifiers(resolved);
          return;
        }
        if (typeof member !== "object") return;

        [
          member._id,
          member.id,
          member.userId,
          member.userID,
          member.employeeId,
          member.employeeID,
          member.empId,
          member.uniqueID,
          member.uniqueId,
          member.employeeCode
        ].filter(Boolean).forEach((identifier) => {
          teamScope.memberIds.add(String(identifier).toLowerCase().trim());
        });

        [
          member.email,
          member.user?.email,
          member.employee?.email
        ].filter(Boolean).forEach((email) => {
          teamScope.memberEmails.add(String(email).toLowerCase().trim());
        });

        [
          member.name,
          member.fullName,
          member.displayName,
          `${member.firstName || ""} ${member.lastName || ""}`.trim(),
          member.user?.name,
          member.user?.fullName,
          member.employee?.name,
          member.employee?.fullName
        ].filter(Boolean).forEach((name) => {
          teamScope.memberNames.add(String(name).toLowerCase().replace(/\s+/g, " ").trim());
        });

        [member.user, member.employee, member.profile].forEach((nested) => {
          if (nested && nested !== member) addTeamMemberIdentifiers(nested);
        });
      };
      teamScope.memberRecords.forEach(addTeamMemberIdentifiers);

      // Check all team docs directly for candidate employee lists
      myTeams.forEach((team) => {
        const pool = [
          ...(Array.isArray(team.employees) ? team.employees : []),
          ...(Array.isArray(team.assignedEmployees) ? team.assignedEmployees : []),
          ...(Array.isArray(team.assignedMembers) ? team.assignedMembers : []),
          ...(Array.isArray(team.teamMembers) ? team.teamMembers : []),
          ...(Array.isArray(team.members) ? team.members : []),
          ...(Array.isArray(team.teamEmployees) ? team.teamEmployees : []),
          ...(Array.isArray(team.employeeIds) ? team.employeeIds : []),
          ...(Array.isArray(team.team?.employees) ? team.team.employees : []),
          ...(Array.isArray(team.team?.members) ? team.team.members : []),
          ...(Array.isArray(team.user?.employees) ? team.user.employees : []),
          ...(Array.isArray(team.teamLead?.employees) ? team.teamLead.employees : [])
        ];
        pool.forEach(addTeamMemberIdentifiers);
      });

      // Check employees roster from /api/employee/list for direct team lead references
      if (Array.isArray(rawEmps)) {
        rawEmps.forEach((emp) => {
          if (!emp) return;
          const assignedLead = emp.teamLeadId || emp.teamLead || emp.tlId || emp.assignedTL || emp.teamLeaderId;
          if (assignedLead && isLeadMatch(assignedLead)) {
            addTeamMemberIdentifiers(emp);
          }
        });
      }

      // Check localStorage team assignments
      try {
        const storedAssignments = JSON.parse(localStorage.getItem("teamLeadAssignedEmployees") || "{}");
        Object.entries(storedAssignments).forEach(([tlKey, empIds]) => {
          if (isLeadMatch(tlKey) && Array.isArray(empIds)) {
            empIds.forEach(addTeamMemberIdentifiers);
          }
        });
      } catch { }

      try {
        const userTLMap = JSON.parse(localStorage.getItem("kt_user_assigned_tl") || "{}");
        Object.entries(userTLMap).forEach(([uid, tlVal]) => {
          if (isLeadMatch(tlVal)) {
            addTeamMemberIdentifiers(uid);
          }
        });
      } catch { }

      updateTeamScopeIfChanged(teamScope);
      return teamScope;
    } catch (err) {
      console.warn("Failed to fetch Team Lead scope:", err);
      return null;
    }
  }, [isTL, headers, user, updateTeamScopeIfChanged]);

  // ============================================================
  // FETCH ALL PERFORMANCES (NEW WORKFLOW: /api/teamLead/team -> /api/performance/all)
  // ============================================================
  const fetchAllPerformances = useCallback(async (isSilent = false) => {
    // Avoid concurrent duplicate network calls
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isSilent) {
      if (performances.length === 0 && !hasLoadedRef.current) {
        setInitialLoading(true);
      } else {
        setIsBackgroundRefreshing(true);
      }
    } else {
      setIsBackgroundRefreshing(true);
    }

    try {
      // 1. Sequential Step 1 for Team Leads: fetch team structure and employee IDs from /api/teamLead/team
      let activeTeamScope = teamEmployeesScope;
      if (isTL) {
        const resolvedScope = await fetchTeamLeadScope();
        if (resolvedScope) {
          activeTeamScope = resolvedScope;
        }
      }

      // 2. Sequential Step 2: Fetch overall performance dataset from /api/performance/all
      let fetchedData = [];
      let liveSucceeded = false;

      try {
        const response = await fetch(
          "https://kt-backend-ttzj.onrender.com/api/performance/all",
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

          if (isAdmin) {
            // Clean any old test records from backend if present
            rawPerfs.forEach((perf) => {
              if (isDummyPerformanceRecord(perf) && perf._id && !String(perf._id).startsWith("perf-")) {
                try {
                  fetch(`https://kt-backend-ttzj.onrender.com/api/performance/delete/${perf._id}`, {
                    method: "DELETE",
                    headers
                  }).catch(() => { });
                } catch { }
              }
            });
          }

          const isValidPerformanceRecord = (perf) => {
            if (!perf || typeof perf !== "object") return false;
            if (isDummyPerformanceRecord(perf)) return false;
            if (isFinanceOrExcludedUser(perf)) return false;
            if (perf.employeeID && typeof perf.employeeID === "object" && isFinanceOrExcludedUser(perf.employeeID)) return false;
            if (perf.employee && typeof perf.employee === "object" && isFinanceOrExcludedUser(perf.employee)) return false;
            return Boolean(
              perf.employeeID ||
              perf.employeeId ||
              perf.employee ||
              perf.userId ||
              perf.employeeName ||
              perf.name ||
              perf.employeeEmail ||
              perf.email
            );
          };

          const filteredPerfs = dedupePerformanceRecords(rawPerfs.filter(isValidPerformanceRecord));

          if (isAdmin || isHR) {
            try {
              localStorage.setItem(PERF_CACHE_KEY, JSON.stringify(filteredPerfs));
              localStorage.setItem(PERF_STORE_KEY, JSON.stringify(filteredPerfs));
            } catch { }

            const stored = getStoredPerformances();
            const validStored = stored.filter((p) => p && !isDummyPerformanceRecord(p));
            updatePerformancesIfChanged(dedupePerformanceRecords([...filteredPerfs, ...validStored]));
            liveSucceeded = true;
            return;
          }

          if (isTL) {
            // Filter / match records using the employee IDs obtained from the team data response (/api/teamLead/team)
            const teamMemberIds = activeTeamScope?.memberIds || new Set();
            const teamMemberEmails = activeTeamScope?.memberEmails || new Set();
            const teamMemberNames = activeTeamScope?.memberNames || new Set();
            const hasAssignedTeamMembers = teamMemberIds.size > 0 || teamMemberEmails.size > 0;

            const myIdentity = getPerformanceEmployeeIdentity(user);
            [
              getRealAuthUserId(user),
              user?._id,
              user?.id,
              user?.employeeId
            ].filter(Boolean).forEach((id) => myIdentity.ids.add(String(id).toLowerCase().trim()));

            const matchedPerfs = filteredPerfs.filter((perf) => {
              // Always retain TL's own record for the personal evaluation tab
              if (isMyRecord(perf)) return true;

              // Match records evaluated or submitted by this Team Lead
              const submittedById = String(
                (typeof perf.submittedBy === 'object' ? perf.submittedBy?._id || perf.submittedBy?.id : perf.submittedBy) || ''
              ).toLowerCase().trim();
              if (submittedById && myIdentity.ids.has(submittedById)) return true;

              const evaluatorId = String(perf.evaluatorId || '').toLowerCase().trim();
              if (evaluatorId && myIdentity.ids.has(evaluatorId)) return true;

              const evaluatorName = String(perf.evaluatorName || '').toLowerCase().trim();
              if (evaluatorName && [...myIdentity.names].some((n) => evaluatorName === n || evaluatorName.includes(n))) return true;

              // Match direct team lead attribution on performance record
              const teamLeadIdentity = getPerformanceEmployeeIdentity({
                employeeId: perf.teamLeadId,
                employeeID: perf.teamLeaderId,
                userId: perf.tlId,
                employee: perf.teamLead
              });
              if ([...teamLeadIdentity.ids].some((id) => myIdentity.ids.has(id)) ||
                [...teamLeadIdentity.emails].some((email) => myIdentity.emails.has(email))) {
                return true;
              }

              // Direct target employee ID matching from teamMemberIds
              const targetEmpId = String(
                (typeof perf.employeeID === 'object' ? perf.employeeID?._id || perf.employeeID?.id : perf.employeeID) ||
                (typeof perf.employeeId === 'object' ? perf.employeeId?._id || perf.employeeId?.id : perf.employeeId) ||
                perf.userId ||
                ''
              ).toLowerCase().trim();
              if (targetEmpId && teamMemberIds.has(targetEmpId)) return true;

              // Match against employee IDs obtained from /api/teamLead/team response
              const perfIdent = getPerformanceEmployeeIdentity(perf);
              const matchesTeamMembers =
                [...perfIdent.ids].some((id) => teamMemberIds.has(id)) ||
                [...perfIdent.emails].some((email) => teamMemberEmails.has(email)) ||
                [...perfIdent.names].some((name) => teamMemberNames.has(name));

              if (matchesTeamMembers) return true;

              // Resilient fallback if no team members are assigned yet in backend
              if (!hasAssignedTeamMembers) return true;

              return false;
            });

            try {
              localStorage.setItem(PERF_CACHE_KEY, JSON.stringify(matchedPerfs));
              localStorage.setItem(PERF_STORE_KEY, JSON.stringify(matchedPerfs));
            } catch { }

            const stored = getStoredPerformances();
            const validStored = stored.filter((p) => p && !isDummyPerformanceRecord(p));
            updatePerformancesIfChanged(dedupePerformanceRecords([...matchedPerfs, ...validStored]));
            liveSucceeded = true;
            return;
          }

          // Regular Employee: filter /api/performance/all by isMyRecord
          const employeeScopedPerfs = filteredPerfs.filter(isMyRecord);
          updatePerformancesIfChanged(employeeScopedPerfs);
          liveSucceeded = true;
          return;
        }
      } catch (err) {
        console.warn("Fetch /api/performance/all error:", err);
      }

      if (!liveSucceeded) {
        // Fallback for employee or TL if /api/performance/all fails
        const myId = String(getRealAuthUserId(user) || user?._id || user?.id || user?.employeeId || "").trim();
        const fallbackEndpoints = myId
          ? [
            `https://kt-backend-ttzj.onrender.com/api/performance/user/${myId}`,
            `https://kt-backend-ttzj.onrender.com/api/performance/${myId}`,
            "https://kt-backend-ttzj.onrender.com/api/performance/my"
          ]
          : [];

        for (const ep of fallbackEndpoints) {
          try {
            const res = await fetch(ep, { headers });
            if (res.ok) {
              const json = await res.json();
              const list = Array.isArray(json.data)
                ? json.data
                : Array.isArray(json.performances)
                  ? json.performances
                  : Array.isArray(json)
                    ? json
                    : (json && typeof json === "object" && (json._id || json.performancePercentage))
                      ? [json]
                      : [];
              const cleanList = list.filter((p) => !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p));
              if (cleanList.length > 0) {
                fetchedData = [...fetchedData, ...cleanList];
              }
            }
          } catch { }
        }

        if (isAdmin || isHR || isTL) {
          const stored = getStoredPerformances();
          const validStored = stored.filter((p) => p && !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p));
          updatePerformancesIfChanged(dedupePerformanceRecords([...fetchedData, ...validStored]));
        } else {
          updatePerformancesIfChanged(dedupePerformanceRecords(fetchedData));
        }
      }
    } catch (err) {
      console.error("Backend performance fetch error:", err);
      if (isAdmin || isHR || isTL) {
        const stored = getStoredPerformances();
        updatePerformancesIfChanged(stored);
      } else {
        updatePerformancesIfChanged([]);
      }
    } finally {
      hasLoadedRef.current = true;
      setInitialLoading(false);
      setIsBackgroundRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [headers, isAdmin, isHR, isTL, user, fetchTeamLeadScope, isMyRecord, teamEmployeesScope, updatePerformancesIfChanged]);

  // ============================================================
  // FETCH REAL EMPLOYEES (ONLY LIVE USERS, NO DUMMY DATA)
  // ============================================================
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(
        "https://kt-backend-ttzj.onrender.com/api/employee/list",
        { headers }
      );

      const data = await response.json();

      let rawList = [];
      if (Array.isArray(data)) rawList = data;
      else if (Array.isArray(data.employees)) rawList = data.employees;
      else if (Array.isArray(data.data)) rawList = data.data;
      else if (Array.isArray(data.users)) rawList = data.users;

      // Filter out finance and admin users and unknown employees using official utility
      const validEmployees = filterOutUnknownUsers(filterOutFinanceUsers(rawList));

      // Clean & deduplicate by email / ID
      const seen = new Set();
      const cleanEmployees = [];

      for (const emp of validEmployees) {
        if (!emp || isUnknownEmployeeOrUser(emp)) continue;
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

      updateEmployeesIfChanged(cleanEmployees);
    } catch (err) {
      console.error("Failed to fetch real employees:", err);
      updateEmployeesIfChanged([]);
    }
  }, [headers, updateEmployeesIfChanged]);

  useEffect(() => {
    purgeStalePerformances();
    if (!canCreatePerformance && !isTL) {
      try {
        localStorage.removeItem(PERF_CACHE_KEY);
        localStorage.removeItem(PERF_STORE_KEY);
      } catch { }
    }
    if (canCreatePerformance || isTL) {
      fetchEmployees();
    }
    if (isTL) {
      fetchTeamLeadScope();
    }
    fetchAllPerformances(false);

    // Silent background auto-refresh every 10s for new performance reviews
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchAllPerformances(true);
      if (canCreatePerformance || isTL) fetchEmployees();
      if (isTL) fetchTeamLeadScope();
    }, 10000);

    const handleFocus = () => {
      fetchAllPerformances(true);
      if (isTL) fetchTeamLeadScope();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAllPerformances(true);
        if (isTL) fetchTeamLeadScope();
      }
    };
    const handlePerformanceUpdated = () => fetchAllPerformances(true);
    const handlePerformanceStorage = (event) => {
      if (event.key === PERF_STORE_KEY || event.key === PERF_CACHE_KEY) {
        fetchAllPerformances(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("kt_performance_updated", handlePerformanceUpdated);
    window.addEventListener("storage", handlePerformanceStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("kt_performance_updated", handlePerformanceUpdated);
      window.removeEventListener("storage", handlePerformanceStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canCreatePerformance, isAdmin, isTL, fetchAllPerformances, fetchEmployees, fetchTeamLeadScope]);

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
    if (!perf) return "";

    if (perf.employeeID && typeof perf.employeeID === "object") {
      const emp = perf.employeeID;
      if (emp.name && !isUnknownEmployeeOrUser(emp.name)) return emp.name;
      if (emp.fullName && !isUnknownEmployeeOrUser(emp.fullName)) return emp.fullName;
      if (emp.firstName && emp.lastName) {
        const full = `${emp.firstName} ${emp.lastName}`.trim();
        if (!isUnknownEmployeeOrUser(full)) return full;
      }
      if (emp.firstName && !isUnknownEmployeeOrUser(emp.firstName)) return emp.firstName;
      if (emp.displayName && !isUnknownEmployeeOrUser(emp.displayName)) return emp.displayName;
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
      if (typeof val === "string" && val.trim() && !isUnknownEmployeeOrUser(val)) {
        return val.trim();
      }
    }

    // Resolve from employees roster using employeeID / userId
    const targetId = String(
      (typeof perf.employeeID === 'object' ? perf.employeeID?._id || perf.employeeID?.id : perf.employeeID) ||
      (typeof perf.employeeId === 'object' ? perf.employeeId?._id || perf.employeeId?.id : perf.employeeId) ||
      perf.userId ||
      ""
    ).toLowerCase().trim();

    if (targetId && Array.isArray(employees)) {
      const found = employees.find((e) => {
        if (!e) return false;
        const eId = String(e._id || e.id || e.userId || e.employeeId || "").toLowerCase().trim();
        return eId === targetId;
      });
      if (found) {
        return found.name || found.fullName || found.displayName || "Employee";
      }
    }

    return perf.employeeEmail || perf.email || "Employee";
  };

  // Helper to extract employee email
  const getEmployeeEmail = (perf) => {
    if (!perf) return "";
    const direct =
      perf.employeeID?.email ||
      perf.employeeEmail ||
      perf.employee?.email ||
      perf.email;
    if (direct && typeof direct === "string" && direct.trim()) return direct.trim();

    const targetId = String(
      (typeof perf.employeeID === 'object' ? perf.employeeID?._id || perf.employeeID?.id : perf.employeeID) ||
      (typeof perf.employeeId === 'object' ? perf.employeeId?._id || perf.employeeId?.id : perf.employeeId) ||
      perf.userId ||
      ""
    ).toLowerCase().trim();

    if (targetId && Array.isArray(employees)) {
      const found = employees.find((e) => {
        if (!e) return false;
        const eId = String(e._id || e.id || e.userId || e.employeeId || "").toLowerCase().trim();
        return eId === targetId;
      });
      if (found && found.email) return found.email.trim();
    }

    return "";
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

  // Helper to extract Rating (out of 10, decimal supported)
  const getRating = (perf) => {
    if (!perf) return "—";
    const raw = perf.rating;
    if (raw === undefined || raw === null || raw === "") return "—";
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      return `${num % 1 === 0 ? num : num.toFixed(1)} / 10`;
    }
    return String(raw).trim() || "—";
  };

  // Rating badge styling based on 10-point scale
  const getRatingBadgeStyle = (perfOrRating) => {
    let num = null;
    if (typeof perfOrRating === "number") {
      num = perfOrRating;
    } else if (typeof perfOrRating === "object" && perfOrRating !== null) {
      const parsed = parseFloat(perfOrRating.rating);
      if (!isNaN(parsed)) num = parsed;
    } else if (typeof perfOrRating === "string") {
      const match = perfOrRating.match(/[\d.]+/);
      if (match) {
        const parsed = parseFloat(match[0]);
        if (!isNaN(parsed)) num = parsed;
      }
    }

    if (num !== null) {
      if (num >= 8.5) return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
      if (num >= 7.0) return "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]";
      if (num >= 5.0) return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
      return "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]";
    }

    const r = String(perfOrRating || "").toLowerCase();
    if (r.includes("excel") || r.includes("outstand")) return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
    if (r.includes("good") || r.includes("meet")) return "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]";
    if (r.includes("avg") || r.includes("average")) return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  // Helper to extract feedback
  const getFeedback = (perf) => {
    if (!perf) return "—";
    return perf.feedback || "—";
  };

  // Helper to extract remarks
  const getRemarks = (perf) => {
    if (!perf) return "—";
    return perf.remarks || perf.remark || "—";
  };

  // Helper to extract evaluator info
  const getEvaluatorInfo = (perf) => {
    if (!perf) return { name: "Management", role: "Admin" };
    const name = perf.evaluatorName || (perf.submittedBy?.name || perf.submittedBy?.fullName) || "Admin";
    const role = perf.evaluatorRole || (perf.submittedBy?.role) || "Management";
    return { name, role };
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

    const targetId = String(
      (typeof perf.employeeID === 'object' ? perf.employeeID?._id || perf.employeeID?.id : perf.employeeID) ||
      (typeof perf.employeeId === 'object' ? perf.employeeId?._id || perf.employeeId?.id : perf.employeeId) ||
      perf.userId ||
      ""
    ).toLowerCase().trim();

    if (targetId && Array.isArray(employees)) {
      const found = employees.find((e) => {
        if (!e) return false;
        const eId = String(e._id || e.id || e.userId || e.employeeId || "").toLowerCase().trim();
        return eId === targetId;
      });
      if (found && found.department) return found.department;
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

  const getAvatarStyle = () => {
    return { bg: "bg-indigo-50", text: "text-indigo-600" };
  };

  // Format date as M/D/YYYY
  const formatRowDate = (dateVal) => {
    if (!dateVal) return "—";
    if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
      const [y, m, d] = dateVal.trim().split("-");
      return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  const formatRowMonth = (dateVal) => {
    if (!dateVal) return "—";
    const dateOnlyMatch = typeof dateVal === "string"
      ? /^(\d{4})-(\d{2})-\d{2}$/.exec(dateVal.trim())
      : null;
    const date = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, 1)
      : new Date(dateVal);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  };

  const formatRowMonthToInput = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string") {
      const monthMatch = /^(\d{4})-(\d{2})/.exec(dateVal.trim());
      if (monthMatch && isValidPerformanceMonth(`${monthMatch[1]}-${monthMatch[2]}`)) {
        return `${monthMatch[1]}-${monthMatch[2]}`;
      }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // (Role isolation helper isMyRecord is declared above for sequential workflow initialization)

  // ============================================================
  // TEAM LEAD ISOLATION: ASSIGNED TEAM MEMBERS RECORD MATCHING
  // ============================================================
  const isTeamMemberRecord = useCallback((perf) => {
    if (!perf) return false;
    // Exclude TL's personal review from team members tab
    if (isMyRecord(perf)) return false;

    // Filter out dummy/finance records
    if (isDummyPerformanceRecord(perf) || isFinanceOrExcludedUser(perf)) return false;

    const myIdentity = getPerformanceEmployeeIdentity(user);
    [
      getRealAuthUserId(user),
      user?._id,
      user?.id,
      user?.employeeId
    ].filter(Boolean).forEach((id) => myIdentity.ids.add(String(id).toLowerCase().trim()));

    // 1. Direct evaluator / submitter match: If this TL submitted or evaluated this record, it's their team member review!
    const submittedById = String(
      (typeof perf.submittedBy === 'object' ? perf.submittedBy?._id || perf.submittedBy?.id : perf.submittedBy) || ''
    ).toLowerCase().trim();
    if (submittedById && myIdentity.ids.has(submittedById)) return true;

    const evaluatorId = String(perf.evaluatorId || '').toLowerCase().trim();
    if (evaluatorId && myIdentity.ids.has(evaluatorId)) return true;

    const evaluatorName = String(perf.evaluatorName || '').toLowerCase().trim();
    if (evaluatorName && [...myIdentity.names].some((n) => evaluatorName === n || evaluatorName.includes(n))) return true;

    // 2. Direct team lead attribution on the performance record
    const teamLeadIdentity = getPerformanceEmployeeIdentity({
      employeeId: perf.teamLeadId,
      employeeID: perf.teamLeaderId,
      userId: perf.tlId,
      employee: perf.teamLead
    });
    const isAssignedToCurrentLead = [...teamLeadIdentity.ids].some((id) => myIdentity.ids.has(id)) ||
      [...teamLeadIdentity.emails].some((email) => myIdentity.emails.has(email));

    if (isAssignedToCurrentLead) {
      return true;
    }

    // Direct target employee ID matching from teamEmployeesScope.memberIds
    const targetId = String(
      (typeof perf.employeeID === 'object' ? perf.employeeID?._id || perf.employeeID?.id : perf.employeeID) ||
      (typeof perf.employeeId === 'object' ? perf.employeeId?._id || perf.employeeId?.id : perf.employeeId) ||
      perf.userId ||
      ""
    ).toLowerCase().trim();

    if (targetId && teamEmployeesScope?.memberIds?.has(targetId)) {
      return true;
    }

    // 3. Match against resolved team scope from /api/teamLead/team
    const perfIdentity = getPerformanceEmployeeIdentity(perf);
    if (teamEmployeesScope && (teamEmployeesScope.memberIds?.size > 0 || teamEmployeesScope.memberEmails?.size > 0)) {
      const { memberIds, memberEmails, memberNames } = teamEmployeesScope;
      const matchesScope =
        [...perfIdentity.ids].some((id) => memberIds && memberIds.has(id)) ||
        [...perfIdentity.emails].some((email) => memberEmails && memberEmails.has(email)) ||
        [...perfIdentity.names].some((name) => memberNames && memberNames.has(name));
      if (matchesScope) return true;
    }

    // 4. Match against live employees roster (emp.teamLeadId / emp.teamLead)
    if (Array.isArray(employees) && employees.length > 0) {
      const matchedEmp = employees.find((emp) => {
        if (!emp) return false;
        const eIds = [emp._id, emp.id, emp.userId, emp.employeeId, emp.employeeID].filter(Boolean).map((x) => String(x).toLowerCase().trim());
        const eEmail = String(emp.email || "").toLowerCase().trim();
        const eName = String(emp.name || emp.fullName || "").toLowerCase().trim();
        const matchesPerf = (targetId && eIds.includes(targetId)) ||
          eIds.some((id) => perfIdentity.ids.has(id)) ||
          (eEmail && perfIdentity.emails.has(eEmail)) ||
          (eName && perfIdentity.names.has(eName));
        if (!matchesPerf) return false;
        const leadRef = String(emp.teamLeadId || emp.teamLead || emp.tlId || emp.assignedTL || "").toLowerCase().trim();
        return leadRef && (myIdentity.ids.has(leadRef) || myIdentity.emails.has(leadRef));
      });
      if (matchedEmp) return true;
    }

    // 5. Match against localStorage team assignments
    try {
      const storedAssignments = JSON.parse(localStorage.getItem("teamLeadAssignedEmployees") || "{}");
      for (const [tlKey, empIds] of Object.entries(storedAssignments)) {
        const normKey = String(tlKey).toLowerCase().trim();
        if (myIdentity.ids.has(normKey) || myIdentity.emails.has(normKey) || normKey.includes("hetvi")) {
          if (Array.isArray(empIds)) {
            const matchesStored = empIds.some((empId) => (targetId && String(empId).toLowerCase().trim() === targetId) || perfIdentity.ids.has(String(empId).toLowerCase().trim()));
            if (matchesStored) return true;
          }
        }
      }
    } catch { }

    // 6. Resilient Fallback: If no explicit team assignments exist in backend at all (memberIds size is 0),
    // and this is a general employee performance record (not an admin or HR user),
    // allow the TL to view it so the team lead is never left with an empty screen when employees are evaluated!
    const hasAnyConfiguredTeam = (teamEmployeesScope?.memberIds?.size > 0 || teamEmployeesScope?.memberEmails?.size > 0);
    if (!hasAnyConfiguredTeam) {
      return true;
    }

    return false;
  }, [teamEmployeesScope, isMyRecord, user, employees]);

  const canEditPerformanceRecord = useCallback((perf) => (
    isAdmin || isHR || (isTL && isTeamMemberRecord(perf))
  ), [isAdmin, isHR, isTL, isTeamMemberRecord]);

  // Role-isolated performances: Admin sees all; TL can toggle personal vs assigned team; Employee sees personal
  const myPerformances = useMemo(() => {
    const cleanList = performances.filter(
      (p) => !isDummyPerformanceRecord(p)
    );
    if (isAdmin) {
      return cleanList;
    }
    if (isTL && tlViewScope === "team") {
      return cleanList.filter(isTeamMemberRecord);
    }
    return cleanList.filter(isMyRecord);
  }, [performances, isAdmin, isTL, tlViewScope, isMyRecord, isTeamMemberRecord]);

  const teamPerformancesCount = useMemo(() => {
    return performances.filter(
      (p) => !isDummyPerformanceRecord(p) && isTeamMemberRecord(p)
    ).length;
  }, [performances, isTeamMemberRecord]);

  const personalPerformancesCount = useMemo(() => {
    return performances.filter(
      (p) => !isDummyPerformanceRecord(p) && isMyRecord(p)
    ).length;
  }, [performances, isMyRecord]);

  const availableEmployeesForModal = useMemo(() => {
    if (isAdmin || isHR) return employees;
    if (isTL) {
      if (teamEmployeesScope && (teamEmployeesScope.memberIds?.size > 0 || teamEmployeesScope.memberEmails?.size > 0)) {
        const teamEmps = employees.filter((emp) => {
          const empIdent = getPerformanceEmployeeIdentity(emp);
          return [...empIdent.ids].some((id) => teamEmployeesScope.memberIds.has(id)) ||
            [...empIdent.emails].some((email) => teamEmployeesScope.memberEmails.has(email)) ||
            [...empIdent.names].some((name) => teamEmployeesScope.memberNames.has(name));
        });
        if (teamEmps.length > 0) return teamEmps;
      }
      return employees.filter((emp) => !isMyRecord(emp));
    }
    return employees;
  }, [isAdmin, isHR, isTL, employees, teamEmployeesScope, isMyRecord]);

  // ============================================================
  // PERFORMANCE METRICS CALCULATION (PURELY DYNAMIC)
  // ============================================================
  const metrics = useMemo(() => {
    const isTeamView = isAdmin || (isTL && tlViewScope === "team");

    if (!isTeamView) {
      // Personal KPIs for Employee & Team Lead
      const totalReviews = myPerformances.length;
      if (totalReviews === 0) {
        return {
          isPersonal: true,
          latestScore: 0,
          averageScore: 0,
          totalReviews: 0,
          ratingLabel: 0,
          ratingColor: "text-slate-500",
          latestDept: user?.department || "Development"
        };
      }

      // Sort newest first
      const sorted = [...myPerformances].sort((a, b) => {
        const da = new Date(getPerformancePeriodDate(a) || 0);
        const db = new Date(getPerformancePeriodDate(b) || 0);
        return db - da;
      });

      const latest = sorted[0];
      const latestScore = getNumericPercentage(latest);

      const sum = myPerformances.reduce((acc, p) => acc + getNumericPercentage(p), 0);
      const averageScore = Math.round(sum / totalReviews);

      const ratingLabel = getRating(latest);

      return {
        isPersonal: true,
        latestScore,
        averageScore,
        totalReviews,
        ratingLabel,
        ratingColor: "text-emerald-600"
      };
    }

    // Team / Company-wide Metrics (Admin or Team Lead viewing Team Members)
    const totalRecords = myPerformances.length;
    let excellentCount = 0;
    let goodCount = 0;
    let needsImprovementCount = 0;

    myPerformances.forEach((perf) => {
      const pct = getNumericPercentage(perf);
      if (pct >= 80) excellentCount++;
      else if (pct >= 50) goodCount++;
      else needsImprovementCount++;
    });

    return {
      isPersonal: false,
      totalEmployees: totalRecords,
      totalEmployeesLabel: isTL ? "Team Evaluated" : "Total Evaluated",
      excellentCount,
      goodCount,
      needsImprovementCount
    };
  }, [isAdmin, isTL, tlViewScope, myPerformances, user]);

  // Available Month-Year Options from actual data
  const monthYearOptions = useMemo(() => {
    const set = new Set();
    myPerformances.forEach((p) => {
      const rawDate = getPerformancePeriodDate(p);
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
      if (!perf || isDummyPerformanceRecord(perf)) return false;
      const rawName = getEmployeeDisplayName(perf);
      if (!rawName) return false;
      const name = rawName.toLowerCase();
      const email = getEmployeeEmail(perf).toLowerCase();
      const feedbackText = String(perf.feedback || "").toLowerCase();
      const remarksText = String(perf.remarks || perf.remark || "").toLowerCase();
      const ratingText = String(getRating(perf)).toLowerCase();
      const pct = getNumericPercentage(perf);

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dept = getDepartment(perf).toLowerCase();
        const matchesQuery =
          name.includes(q) ||
          email.includes(q) ||
          dept.includes(q) ||
          feedbackText.includes(q) ||
          remarksText.includes(q) ||
          ratingText.includes(q);
        if (!matchesQuery) return false;
      }

      // Toolbar: Department Dropdown
      if (toolbarDeptFilter !== "all") {
        const dept = getDepartment(perf).toLowerCase();
        if (!dept.includes(toolbarDeptFilter.toLowerCase())) return false;
      }

      // Toolbar: Performance Dropdown
      if (toolbarPerfFilter !== "all") {
        if (toolbarPerfFilter === "excellent" && pct < 80) return false;
        if (toolbarPerfFilter === "good" && (pct < 50 || pct >= 80)) return false;
        if (toolbarPerfFilter === "needs-improvement" && pct >= 50) return false;
      }

      // Toolbar: Month / Year Filter
      if (selectedMonthYear !== "all") {
        const rawDate = getPerformancePeriodDate(perf);
        if (!rawDate) return false;
        const pDate = new Date(rawDate);
        if (!isNaN(pDate.getTime())) {
          const ymStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, "0")}`;
          if (ymStr !== selectedMonthYear) return false;
        }
      }

      return true;
    });
  }, [
    myPerformances,
    searchQuery,
    toolbarDeptFilter,
    toolbarPerfFilter,
    selectedMonthYear
  ]);

  // ============================================================
  // FORM / MODAL ACTIONS
  // ============================================================

  const handleSelectEmployee = (empId) => {
    const emp = employees.find((e) => String(e._id) === String(empId));
    if (!emp) {
      setModalForm((prev) => ({
        ...prev,
        employeeID: empId
      }));
      return;
    }
    setModalForm((prev) => ({
      ...prev,
      employeeID: emp._id,
      employeeName: emp.name,
      employeeEmail: emp.email
    }));
  };

  const handlePercentageChange = (val) => {
    setModalForm((prev) => ({
      ...prev,
      percentage: val
    }));
  };

  const handleRatingChange = (val) => {
    setModalForm((prev) => ({
      ...prev,
      rating: val
    }));
  };

  const handleOpenAddModal = () => {
    if (!canCreatePerformance) return;
    setModalForm({
      employeeID: "",
      employeeName: "",
      employeeEmail: "",
      percentage: "",
      rating: "",
      feedback: "",
      remarks: "",
      remark: "",
      month: getCurrentPerformanceMonth()
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (perf) => {
    if (!canEditPerformanceRecord(perf)) {
      showNotification("You can only edit performance records for your assigned team members.", "error");
      return;
    }
    setEditingRecord(perf);
    const pct = getNumericPercentage(perf);
    const empName = getEmployeeDisplayName(perf);
    const empEmail = getEmployeeEmail(perf);
    const rawRating = perf.rating !== undefined && perf.rating !== null ? String(perf.rating) : "";
    const existingRemarks = perf.remarks || perf.remark || "";
    const existingFeedback = perf.feedback || "";
    const existingMonth = formatRowMonthToInput(getPerformancePeriodDate(perf)) || getCurrentPerformanceMonth();

    setModalForm({
      employeeID: String(perf.employeeID?._id || perf.employeeID || perf.employee?._id || ""),
      employeeName: empName,
      employeeEmail: empEmail,
      percentage: String(pct),
      rating: rawRating,
      feedback: existingFeedback,
      remarks: existingRemarks,
      remark: existingRemarks,
      month: existingMonth
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    if (e) e.preventDefault();
    const canSubmit = isEditModalOpen
      ? Boolean(editingRecord && canEditPerformanceRecord(editingRecord))
      : canCreatePerformance;
    if (!canSubmit) {
      showNotification("You do not have permission to update this performance record.", "error");
      return;
    }

    if (!isValidPerformanceMonth(modalForm.month)) {
      showNotification("Please select a valid performance month.", "error");
      return;
    }

    if (!modalForm.employeeID) {
      showNotification("Please select an employee", "error");
      return;
    }

    const pct = Number(modalForm.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100 || modalForm.percentage === "") {
      showNotification("Please enter a valid percentage between 0 and 100", "error");
      return;
    }

    const ratingNum = parseFloat(modalForm.rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10 || modalForm.rating === "") {
      showNotification("Please enter a valid rating between 0 and 10 (decimal allowed, e.g. 8.5)", "error");
      return;
    }

    const selectedEmp = employees.find((e) => String(e._id) === String(modalForm.employeeID));
    const empName = selectedEmp?.name || modalForm.employeeName || "Employee";
    const empEmail = selectedEmp?.email || modalForm.employeeEmail || "";
    const empRole = String(selectedEmp?.role || "").toLowerCase();
    const empType = empRole.includes("lead") || empRole === "tl" ? "Team Leader" : "Employee";
    const feedbackText = (modalForm.feedback || "").trim();
    const remarksText = (modalForm.remarks || modalForm.remark || "").trim();
    const selectedMonth = modalForm.month || getCurrentPerformanceMonth();
    const [yearStr, monthStr] = selectedMonth.split("-");
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const selectedDate = `${selectedMonth}-01`;
    const dateObj = new Date(yearNum, monthNum - 1, 1);
    const monthName = dateObj.toLocaleString("en-US", { month: "long" });
    const isoDateTime = new Date(`${selectedDate}T12:00:00.000Z`).toISOString();

    const evaluatorId = String(getRealAuthUserId(user) || user?._id || user?.id || "");
    const evaluatorName = String(user?.name || user?.fullName || "Admin").trim();
    const evaluatorRole = String(user?.roleName || user?.role || "Admin").trim();

    setSubmitting(true);

    try {
      const payload = {
        employeeID: modalForm.employeeID,
        employeeType: empType,
        employeeName: empName,
        employeeEmail: empEmail,
        performancePercentage: pct,
        rating: ratingNum,
        remarks: remarksText,
        remark: remarksText,
        evaluatorRemarks: remarksText,
        comments: remarksText,
        comment: remarksText,
        notes: remarksText,
        description: remarksText,
        feedback: feedbackText,
        submittedBy: evaluatorId,
        evaluatorName: evaluatorName,
        evaluatorRole: evaluatorRole,
        date: selectedDate,
        createdAt: isoDateTime,
        month: monthNum,
        year: yearNum,
        monthName: monthName
      };

      if (isEditModalOpen && editingRecord) {
        const response = await fetch(
          `https://kt-backend-ttzj.onrender.com/api/performance/update/${editingRecord._id}`,
          {
            method: "PUT",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const responseData = await response.json().catch(() => ({}));
        if (!response.ok || responseData?.success === false) {
          throw new Error(responseData.message || "Failed to update performance record");
        }

        const serverRecord = responseData?.data?.performance ||
          responseData?.performance ||
          responseData?.data ||
          responseData?.record ||
          responseData;
        const updatedData = {
          ...editingRecord,
          ...payload,
          ...(serverRecord && typeof serverRecord === "object" ? serverRecord : {}),
          ...payload,
          _id: editingRecord._id || editingRecord.id,
          percentage: pct,
          remarks: remarksText,
          remark: remarksText,
          feedback: feedbackText,
          date: selectedDate,
          createdAt: isoDateTime,
          month: monthNum,
          year: yearNum,
          monthName: monthName
        };
        updateInPersistentStore(updatedData);
        setPerformances((current) => dedupePerformanceRecords(
          current.map((record) => String(record._id || record.id) === String(updatedData._id)
            ? { ...record, ...updatedData }
            : record)
        ));
        window.dispatchEvent(new CustomEvent("kt_performance_updated", { detail: updatedData }));

        showNotification("Performance record updated successfully!", "success");
        setIsEditModalOpen(false);
        setEditingRecord(null);
      } else {
        let response = await fetch(
          "https://kt-backend-ttzj.onrender.com/api/performance/create",
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        let data = await response.json().catch(() => ({}));

        // Fallback: If backend specifically expects month name string (e.g. "October")
        if (!response.ok && (data.message || "").toLowerCase().includes("month")) {
          const fallbackRes = await fetch(
            "https://kt-backend-ttzj.onrender.com/api/performance/create",
            {
              method: "POST",
              headers: {
                ...headers,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...payload,
                month: monthName
              }),
            }
          );
          if (fallbackRes.ok) {
            response = fallbackRes;
            data = await fallbackRes.json().catch(() => ({}));
          }
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to submit performance record");
        }

        let newId =
          data?.data?._id ||
          data?.data?.id ||
          data?.performance?._id ||
          data?.performance?.id ||
          data?.record?._id ||
          data?.record?.id ||
          data?.result?._id ||
          data?.result?.id ||
          data?._id ||
          data?.id;

        // In case the backend create controller defaulted or copied remarks from feedback,
        // immediately call the update endpoint which is confirmed to persist remarks correctly.
        if (!newId) {
          try {
            const checkRes = await fetch("https://kt-backend-ttzj.onrender.com/api/performance/all", { headers });
            if (checkRes.ok) {
              const allJson = await checkRes.json();
              const list = Array.isArray(allJson.data)
                ? allJson.data
                : Array.isArray(allJson.performances)
                  ? allJson.performances
                  : [];
              const matching = list.filter((p) => {
                const pEmpId = String(p.employeeID?._id || p.employeeID || "");
                return pEmpId === String(modalForm.employeeID);
              });
              if (matching.length > 0) {
                const latest = matching[matching.length - 1];
                newId = latest._id || latest.id;
              }
            }
          } catch { }
        }

        if (newId && !String(newId).startsWith("perf-")) {
          try {
            await fetch(
              `https://kt-backend-ttzj.onrender.com/api/performance/update/${newId}`,
              {
                method: "PUT",
                headers: {
                  ...headers,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ...payload,
                  remarks: remarksText,
                  remark: remarksText,
                  feedback: feedbackText,
                  date: selectedDate,
                  createdAt: isoDateTime,
                  month: monthNum,
                  year: yearNum,
                  monthName: monthName
                }),
              }
            );
          } catch (updateErr) {
            console.warn("Immediate update after create warning:", updateErr);
          }
        }

        const createdRecord = {
          ...(data.data || data.performance || data.record || {}),
          _id: newId || `perf-${Date.now()}`,
          ...payload,
          percentage: pct,
          remarks: remarksText,
          remark: remarksText,
          feedback: feedbackText,
          date: selectedDate,
          createdAt: isoDateTime
        };
        saveToPersistentStore(createdRecord);

        showNotification("Performance submitted successfully!", "success");
        setIsAddModalOpen(false);
      }

      await fetchAllPerformances(true);
      setModalForm({
        employeeID: "",
        employeeName: "",
        employeeEmail: "",
        percentage: "",
        rating: "",
        feedback: "",
        remarks: "",
        remark: "",
        month: getCurrentPerformanceMonth()
      });
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
        `https://kt-backend-ttzj.onrender.com/api/performance/delete/${perf._id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete performance");
      }

      deleteFromPersistentStore(perf._id);
      showNotification(`Performance record for ${employeeName} deleted successfully!`, "success");
      await fetchAllPerformances(true);
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Failed to delete performance record", "error");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 font-poppins">
      {confirmationDialog}

      {/* Floating Toast Notification */}
      {notification.message && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs sm:text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-4 font-poppins ${notification.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : notification.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-indigo-50 text-indigo-800 border-indigo-200"
            }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : notification.type === "error" ? (
            <AlertCircle size={16} className="text-rose-600" />
          ) : (
            <Sparkles size={16} className="text-indigo-600" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification({ message: "", type: "" })}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. TOP HEADER */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-poppins">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-poppins">
            {isAdmin
              ? "Performance Management"
              : isTL
                ? (tlViewScope === "team" ? "Team Members' Performance" : "My Performance")
                : "My Performance"}
          </h1>
        </div>

        {/* Top Controls: TL Switcher + Sync button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isTL && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs font-poppins">
              <button
                type="button"
                onClick={() => setTlViewScope("team")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${tlViewScope === "team"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Users size={14} />
                <span>My Team</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tlViewScope === "team" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-200 text-slate-600"
                  }`}>
                  {teamPerformancesCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTlViewScope("my")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${tlViewScope === "my"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <User size={14} />
                <span>My Review</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tlViewScope === "my" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-200 text-slate-600"
                  }`}>
                  {personalPerformancesCount}
                </span>
              </button>
            </div>
          )}

          {/* Outline Sync button matching reference design */}
          <button
            type="button"
            onClick={() => fetchAllPerformances(false)}
            disabled={isBackgroundRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-60 transition font-poppins"
          >
            <RefreshCw size={13} className={isBackgroundRefreshing ? "animate-spin text-[#0088cc]" : "text-slate-600"} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. TOP METRIC CARDS (4 STATS FULL WIDTH) */}
      {/* ==================================================== */}
      {!metrics.isPersonal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
          {[
            { label: "TOTAL EVALUATED", value: metrics.totalEmployees },
            { label: "EXCELLENT", value: metrics.excellentCount },
            { label: "GOOD", value: metrics.goodCount },
            { label: "NEED IMPROVEMENT", value: metrics.needsImprovementCount }
          ].map((item, idx) => (
            <div
              key={idx}
              className="relative flex items-center h-[60px] w-full"
            >
              {/* Left card for the border: width: 22; height: 80; border-top-left-radius: 10px; border-bottom-left-radius: 10px; */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "#034665", opacity: 1 }}
              />
              {/* Inner card: height: 80; border-radius: 10px; border-width: 0.2px; */}
              <div
                className="relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
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
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
          {[
            { label: "LATEST SCORE", value: `${metrics.latestScore}%` },
            { label: "CURRENT STANDING", value: metrics.ratingLabel },
            { label: "AVERAGE SCORE", value: `${metrics.averageScore}%` },
            { label: "EVALUATIONS", value: metrics.totalReviews }
          ].map((item, idx) => (
            <div
              key={idx}
              className="relative flex items-center h-[60px] w-full"
            >
              {/* Left card for the border */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "#034665", opacity: 1 }}
              />
              {/* Inner card */}
              <div
                className="relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
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
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. PERFORMANCE HISTORY CARD (FULL WIDTH) */}
      {/* ==================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 lg:p-6 shadow-xs space-y-4 font-poppins">

        {/* Header Row: Title & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-poppins">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#e8f1f5] text-[#034665] flex items-center justify-center shrink-0">
              <FileText size={18} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
                {isAdmin
                  ? "Performance History"
                  : isTL && tlViewScope === "team"
                    ? "Team Performance History"
                    : "My Performance History"}
              </h3>
              <p className="text-xs text-slate-500 font-normal font-poppins mt-0.5">
                {isAdmin
                  ? "View and mange employee performance records"
                  : isTL && tlViewScope === "team"
                    ? "Performance evaluations and review remarks for your team members"
                    : "Personal performance evaluations and review remarks"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {canCreatePerformance && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="h-9 px-4 text-white rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer font-poppins"
                style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
              >
                <Plus size={15} />
                <span>Add Performance</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar: Search, Dept, Performance, Month/Year */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1 font-poppins">
          <div className="relative w-full md:w-[320px] lg:w-[360px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee name, email or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] font-poppins transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end font-poppins">
            {/* All Departments */}
            <div className="relative">
              <select
                value={toolbarDeptFilter}
                onChange={(e) => setToolbarDeptFilter(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins"
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept.toLowerCase()}>
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* All Performance */}
            <div className="relative">
              <select
                value={toolbarPerfFilter}
                onChange={(e) => setToolbarPerfFilter(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins"
              >
                <option value="all">All Performance</option>
                <option value="excellent">Excellent (≥ 80%)</option>
                <option value="good">Good (50% - 79%)</option>
                <option value="needs-improvement">Needs Improvement (&lt; 50%)</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* All Dates */}
            <div className="relative">
              <select
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins"
              >
                <option value="all">All Dates</option>
                {monthYearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Container */}
        {initialLoading && performances.length === 0 ? (
          <div className="p-16 text-center font-poppins">
            <RefreshCw size={28} className="animate-spin text-[#0088cc] mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading performance data...</p>
          </div>
        ) : filteredPerformances.length === 0 ? (
          <div className="p-16 text-center font-poppins">
            <Award size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No performance records found
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || toolbarDeptFilter !== "all" || toolbarPerfFilter !== "all" || selectedMonthYear !== "all"
                ? "No performance records match your current filter criteria."
                : isAdmin
                  ? "No employee performance evaluations recorded yet. Start by clicking 'Add Performance'."
                  : isTL && tlViewScope === "team"
                    ? "No performance evaluations recorded yet for employees under your team."
                    : "Your performance reviews and scores will appear here once assessed by administration."}
            </p>
            {canCreatePerformance && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 px-4 py-2 text-white rounded-md text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all font-poppins"
                style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
              >
                <Plus size={14} />
                <span>Add Performance</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/80 rounded-lg font-poppins">
            <table className="w-full text-left text-xs border-collapse min-w-[760px] sm:min-w-full font-poppins">
              <thead>
                <tr className="bg-[#0346651A] text-[#034665] text-xs font-semibold font-poppins" style={{ backgroundColor: "#0346651A" }}>
                  <th className="py-3 px-4 w-12 text-left font-semibold">No.</th>
                  <th className="py-3 px-4 text-left font-semibold">Employee</th>
                  <th className="py-3 px-4 text-left font-semibold">Performance</th>
                  <th className="py-3 px-4 text-left font-semibold">Rating</th>
                  <th className="py-3 px-4 text-left font-semibold">Feedback</th>
                  <th className="py-3 px-4 text-left font-semibold">Remark</th>
                  <th className="py-3 px-4 text-left font-semibold">
                    {canViewPerformanceActions ? "Date" : "Month"}
                  </th>
                  {canViewEditActions && (
                    <th className="py-3 px-4 text-center font-semibold">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-poppins">
                {filteredPerformances.map((perf, index) => {
                  const rowNumber = index + 1;
                  const empName = getEmployeeDisplayName(perf);
                  const empEmail = getEmployeeEmail(perf);
                  const pct = getNumericPercentage(perf);
                  const ratingVal = getRating(perf);
                  const feedbackText = getFeedback(perf);
                  const remarksText = getRemarks(perf);
                  const recordDate = getPerformancePeriodDate(perf);
                  const dateFormatted = canViewPerformanceActions
                    ? formatRowDate(recordDate)
                    : formatRowMonth(recordDate);

                  return (
                    <tr
                      key={perf._id || index}
                      className="hover:bg-slate-50/60 transition-colors font-poppins"
                    >
                      {/* No. */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {rowNumber}
                      </td>

                      {/* Employee (Name + Subtext Email) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-xs sm:text-[13px]">
                            {empName}
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {empEmail || "No email available"}
                          </span>
                        </div>
                      </td>

                      {/* Performance (Visual Progress Bar) */}
                      <td className="py-3.5 px-4">
                        <div className="w-24 sm:w-28">
                          <span className="font-semibold text-xs text-slate-800 block mb-1">
                            {pct}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                background: "linear-gradient(90deg, #034665 0%, #068DCB 100%)"
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap inline-block ${getRatingBadgeStyle(ratingVal)}`}>
                          {ratingVal}
                        </span>
                      </td>

                      {/* Feedback */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600 truncate font-normal" title={feedbackText}>
                            {feedbackText}
                          </span>
                          {feedbackText && feedbackText !== "—" && feedbackText.length > 25 && (
                            <button
                              type="button"
                              onClick={() => setSelectedFeedbackModal({ perf, field: "feedback" })}
                              className="text-[11px] text-[#0088cc] hover:underline font-semibold shrink-0 cursor-pointer"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Remark */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600 truncate font-normal" title={remarksText}>
                            {remarksText}
                          </span>
                          {remarksText && remarksText !== "—" && remarksText.length > 25 && (
                            <button
                              type="button"
                              onClick={() => setSelectedFeedbackModal({ perf, field: "remarks" })}
                              className="text-[11px] text-[#0088cc] hover:underline font-semibold shrink-0 cursor-pointer"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap font-normal">
                        {dateFormatted}
                      </td>

                      {canViewEditActions && (
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2.5">
                            {canEditPerformanceRecord(perf) && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(perf)}
                                className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer p-1"
                                title="Edit performance"
                              >
                                <Edit3 size={15} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeletePerformance(perf)}
                                className="text-slate-600 hover:text-rose-600 transition-colors cursor-pointer p-1"
                                title="Delete record"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
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
      {((canCreatePerformance && isAddModalOpen) || (isEditModalOpen && canEditPerformanceRecord(editingRecord))) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 md:p-6 overflow-y-auto font-poppins animate-in fade-in"
          onClick={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            setEditingRecord(null);
          }}
        >
          <div
            className="relative bg-white border border-slate-200/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col font-poppins"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed at top) */}
            <div className="shrink-0 px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#e0f2fe] text-[#034665] flex items-center justify-center shadow-2xs shrink-0">
                  {isEditModalOpen ? <Edit3 size={17} /> : <Plus size={17} />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {isEditModalOpen ? "Edit Performance Record" : "Add Performance Record"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {isEditModalOpen
                      ? "Update score, rating, and evaluator feedback"
                      : "Select employee, set score, rating, and feedback"}
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
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Form with Scrollable Body & Sticky Footer */}
            <form onSubmit={handleSubmitModal} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 modal-scrollbar">
                {/* 1. Select Employee Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Employee *
                  </label>
                  <div className="relative">
                    <select
                      disabled={isEditModalOpen}
                      value={modalForm.employeeID}
                      onChange={(e) => handleSelectEmployee(e.target.value)}
                      required
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] cursor-pointer pr-8 disabled:opacity-70 disabled:cursor-not-allowed transition-all font-poppins"
                    >
                      <option value="">-- Choose Employee --</option>
                      {availableEmployeesForModal.map((emp) => (
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

                {/* Performance Month */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Month *
                  </label>
                  <div className="relative">
                    <input
                      type="month"
                      required
                      value={modalForm.month || ""}
                      onChange={(e) => {
                        setModalForm((prev) => ({ ...prev, month: e.target.value }));
                      }}
                      className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all cursor-pointer font-poppins"
                    />
                  </div>
                </div>

                {/* 2. Performance % & 3. Rating in 2-column row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Performance % (out of 100) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        required
                        placeholder="e.g. 85"
                        value={modalForm.percentage}
                        onChange={(e) => handlePercentageChange(e.target.value)}
                        className="w-full h-10 pl-3 pr-7 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all font-poppins"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Rating (out of 10) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="any"
                        required
                        placeholder="e.g. 8.5"
                        value={modalForm.rating}
                        onChange={(e) => handleRatingChange(e.target.value)}
                        className="w-full h-10 pl-3 pr-9 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all font-poppins"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                        / 10
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Feedback */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Feedback
                  </label>
                  <div className="relative">
                    <textarea
                      name="feedback"
                      rows={3}
                      maxLength={500}
                      placeholder="Enter constructive performance feedback..."
                      value={modalForm.feedback}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalForm((prev) => ({ ...prev, feedback: val }));
                      }}
                      className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] resize-none transition-all font-poppins"
                    />
                    <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-medium">
                      {(modalForm.feedback || "").length}/500
                    </span>
                  </div>
                </div>

                {/* 4. Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Remarks
                  </label>
                  <div className="relative">
                    <textarea
                      name="remarks"
                      rows={2}
                      maxLength={500}
                      placeholder="Enter evaluator remarks..."
                      value={modalForm.remarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalForm((prev) => ({ ...prev, remarks: val, remark: val }));
                      }}
                      className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] resize-none transition-all font-poppins"
                    />
                    <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-medium">
                      {(modalForm.remarks || "").length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/70">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer shadow-2xs font-poppins"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4.5 py-2 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60 font-poppins"
                  style={{ background: 'linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)' }}
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{isEditModalOpen ? "Update Record" : "Submit Record"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL: FEEDBACK DETAIL PREVIEW */}
      {/* ==================================================== */}
      {selectedFeedbackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 md:p-6 overflow-y-auto font-poppins animate-in fade-in"
          onClick={() => setSelectedFeedbackModal(null)}
        >
          <div
            className="relative bg-white border border-slate-200/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col font-poppins"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#e0f2fe] text-[#034665] flex items-center justify-center shadow-2xs shrink-0">
                  <FileText size={17} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Performance Evaluation Details</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {getEmployeeDisplayName(selectedFeedbackModal.perf)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedbackModal(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 modal-scrollbar">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Score</span>
                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {getNumericPercentage(selectedFeedbackModal.perf)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Rating</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block ${getRatingBadgeStyle(getRating(selectedFeedbackModal.perf))}`}>
                    {getRating(selectedFeedbackModal.perf)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Evaluator</span>
                  <span className="font-semibold text-slate-800">
                    {getEvaluatorInfo(selectedFeedbackModal.perf).name} ({getEvaluatorInfo(selectedFeedbackModal.perf).role})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                  <span className="font-medium text-slate-600 font-mono">
                    {formatRowDate(getPerformancePeriodDate(selectedFeedbackModal.perf))}
                  </span>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Feedback
                  </label>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap modal-scrollbar">
                    {selectedFeedbackModal.perf.feedback || "No feedback recorded."}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Remarks
                  </label>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap modal-scrollbar">
                    {selectedFeedbackModal.perf.remarks || selectedFeedbackModal.perf.remark || "No remarks recorded."}
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="shrink-0 flex items-center justify-end px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setSelectedFeedbackModal(null)}
                className="px-4.5 py-2 text-white rounded-lg text-xs sm:text-sm font-medium cursor-pointer shadow-2xs transition-all font-poppins"
                style={{ background: 'linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;