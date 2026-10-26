import React, { useEffect, useState, useMemo, useCallback } from "react";
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
    const key = JSON.stringify([
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
  } catch {}
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
    const updated = existing.map((p) => (String(p._id) === id ? { ...p, ...updatedRecord } : p));
    localStorage.setItem(PERF_STORE_KEY, JSON.stringify(updated));
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

const Performance = () => {
  const { user, userRole } = useApp();
  const normalizedRole = String(userRole || deriveUserRole(user) || "").toLowerCase().trim();
  const isAdmin = isAdminRole(normalizedRole, user) || normalizedRole === "admin";
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
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedFeedbackModal, setSelectedFeedbackModal] = useState(null);

  // Team Leader assigned team scope
  const [teamEmployeesScope, setTeamEmployeesScope] = useState(null);

  // History Toolbar Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [toolbarPerfFilter, setToolbarPerfFilter] = useState("all");
  const [toolbarDeptFilter, setToolbarDeptFilter] = useState("all");
  const [selectedMonthYear, setSelectedMonthYear] = useState("all");

  // Add / Edit Form State (aligned with backend fields: employeeID, performancePercentage, rating, feedback, remarks, date)
  const [modalForm, setModalForm] = useState({
    employeeID: "",
    employeeName: "",
    employeeEmail: "",
    percentage: "",
    rating: "",
    feedback: "",
    remarks: "",
    remark: "",
    date: new Date().toLocaleDateString("en-CA")
  });

  // ============================================================
  // FETCH TEAM LEAD SCOPE (EMPLOYEES ASSIGNED UNDER THIS TL)
  // ============================================================
  const fetchTeamLeadScope = useCallback(async () => {
    if (!isTL) return;
    try {
      const [teamsData, empRes, usersRes, projRes] = await Promise.allSettled([
        fetchTeamsList(),
        fetch("https://kt-backend-yzr4.onrender.com/api/employee/list", { headers }).then((r) => r.json().catch(() => ({}))),
        fetch("https://kt-backend-yzr4.onrender.com/api/users/all", { headers }).then((r) => r.json().catch(() => ({}))),
        fetch("https://kt-backend-yzr4.onrender.com/api/projectManage/project/all", { headers }).then((r) => r.json().catch(() => ({})))
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

      const allTeams = teamsData.status === "fulfilled" && Array.isArray(teamsData.value) ? teamsData.value : [];
      const userIdent = getLoggedInUserIdentifiers(user);
      const myId = String(getRealAuthUserId(user) || user?._id || user?.id || "").toLowerCase().trim();
      const myEmail = String(user?.email || "hetvi.kevalon@gmail.com").toLowerCase().trim();

      // Lead matching helper
      const isLeadMatch = (leadObj) => {
        if (!leadObj) return false;
        if (typeof leadObj === "string" || typeof leadObj === "number") {
          const s = String(leadObj).toLowerCase().trim();
          return (
            (myId && s === myId) ||
            (myEmail && s === myEmail) ||
            userIdent.ids?.has(s) ||
            userIdent.emails?.has(s) ||
            s.includes("hetvi")
          );
        }
        if (typeof leadObj === "object") {
          const lId = String(leadObj._id || leadObj.id || leadObj.userId || "").toLowerCase().trim();
          const lEmail = String(leadObj.email || "").toLowerCase().trim();
          const lName = String(leadObj.name || leadObj.fullName || "").toLowerCase().trim();
          return (
            (myId && lId === myId) ||
            (myEmail && lEmail === myEmail) ||
            userIdent.ids?.has(lId) ||
            userIdent.emails?.has(lEmail) ||
            lEmail.includes("hetvi") ||
            lName.includes("hetvi")
          );
        }
        return false;
      };

      const myTeams = allTeams.filter(
        (t) =>
          isTeamOwnedByLead(t, userIdent) ||
          isLeadMatch(t.teamLead) ||
          isLeadMatch(t.lead) ||
          isLeadMatch(t.teamLeadId) ||
          isLeadMatch(t.teamLeadUser) ||
          isLeadMatch(t.teamLeadEmployee)
      );

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

      // Check projects for team members assigned under this Team Leader
      const projData = projRes.status === "fulfilled" ? projRes.value : {};
      const rawProjs = projData?.data || projData?.projects || (Array.isArray(projData) ? projData : []);
      if (Array.isArray(rawProjs)) {
        rawProjs.forEach((p) => {
          if (!p) return;
          const isProjectLead =
            isLeadMatch(p.teamLeadUser) ||
            isLeadMatch(p.teamLeadEmployee) ||
            isLeadMatch(p.teamLead) ||
            isLeadMatch(p.assignedTL);
          if (isProjectLead && Array.isArray(p.employees)) {
            p.employees.forEach(addTeamMemberIdentifiers);
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
      } catch {}

      try {
        const userTLMap = JSON.parse(localStorage.getItem("kt_user_assigned_tl") || "{}");
        Object.entries(userTLMap).forEach(([uid, tlVal]) => {
          if (isLeadMatch(tlVal)) {
            addTeamMemberIdentifiers(uid);
          }
        });
      } catch {}

      setTeamEmployeesScope(teamScope);
    } catch (err) {
      console.warn("Failed to fetch Team Lead scope:", err);
    }
  }, [isTL, headers, user]);

  // ============================================================
  // FETCH ALL PERFORMANCES (LIVE API + SYNCHRONIZED STORAGE)
  // ============================================================
  const fetchAllPerformances = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      let fetchedData = [];
      if (isAdmin || isTL) {
        let liveSucceeded = false;
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

            if (isAdmin) {
              // Clean any old test records from backend if present
              rawPerfs.forEach((perf) => {
                if (isDummyPerformanceRecord(perf) && perf._id && !String(perf._id).startsWith("perf-")) {
                  try {
                    fetch(`https://kt-backend-yzr4.onrender.com/api/performance/delete/${perf._id}`, {
                      method: "DELETE",
                      headers
                    }).catch(() => {});
                  } catch {}
                }
              });
            }

            const filteredPerfs = dedupePerformanceRecords(rawPerfs.filter((perf) => {
              if (!perf || isDummyPerformanceRecord(perf) || isUnknownEmployeeOrUser(perf)) return false;
              if (isFinanceOrExcludedUser(perf)) return false;
              if (perf.employeeID && (isFinanceOrExcludedUser(perf.employeeID) || isUnknownEmployeeOrUser(perf.employeeID))) return false;
              if (perf.employee && (isFinanceOrExcludedUser(perf.employee) || isUnknownEmployeeOrUser(perf.employee))) return false;
              return true;
            }));

            if (isAdmin) {
              // Update persistent cache so reviews remain synchronized
              try {
                localStorage.setItem(PERF_CACHE_KEY, JSON.stringify(filteredPerfs));
                localStorage.setItem(PERF_STORE_KEY, JSON.stringify(filteredPerfs));
              } catch { }

              setPerformances(filteredPerfs);
              liveSucceeded = true;
              return;
            }

            // Team Leads also load their team-specific endpoints below; /all can be scoped to self.
            fetchedData = filteredPerfs;
          }
        } catch {
          // If fetch fails or is forbidden, fall through to candidate endpoints
        }

        if (liveSucceeded) return;
        if (isAdmin) {
          const stored = getStoredPerformances();
          setPerformances(stored);
          return;
        }
      }

      // Candidate endpoints for Employee & TL fallback
      const myId = String(getRealAuthUserId(user) || user?._id || user?.id || user?.employeeId || "").trim();

      const candidateEndpoints = [
        ...(isTL ? [
          "https://kt-backend-yzr4.onrender.com/api/performance/team",
          "https://kt-backend-yzr4.onrender.com/api/performance/teamlead",
          "https://kt-backend-yzr4.onrender.com/api/performance/team-lead",
          `https://kt-backend-yzr4.onrender.com/api/performance/team/${myId}`,
          `https://kt-backend-yzr4.onrender.com/api/performance/teamlead/${myId}`
        ] : []),
        ...(myId ? [
          `https://kt-backend-yzr4.onrender.com/api/performance/user/${myId}`,
          `https://kt-backend-yzr4.onrender.com/api/performance/employee/${myId}`,
          `https://kt-backend-yzr4.onrender.com/api/performance/${myId}`,
          "https://kt-backend-yzr4.onrender.com/api/performance/my"
        ] : [])
      ];

      for (const ep of candidateEndpoints) {
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
        } catch {
          // Ignore candidate endpoint failure
        }
      }

      // If TL, also merge all real stored performances from persistent store
      if (isTL) {
        const stored = getStoredPerformances();
        const validStored = stored.filter((p) => p && !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p));
        setPerformances(dedupePerformanceRecords([...fetchedData, ...validStored]));
      } else {
        setPerformances(dedupePerformanceRecords(fetchedData));
      }
    } catch (err) {
      console.error("Backend performance fetch error:", err);
      if (isAdmin || isTL) {
        const stored = getStoredPerformances();
        setPerformances(stored);
      } else {
        setPerformances([]);
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [headers, isAdmin, isTL, user]);

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

      setEmployees(cleanEmployees);
    } catch (err) {
      console.error("Failed to fetch real employees:", err);
      setEmployees([]);
    }
  }, [headers]);

  useEffect(() => {
    purgeStalePerformances();
    if (!isAdmin && !isTL) {
      try {
        localStorage.removeItem(PERF_CACHE_KEY);
        localStorage.removeItem(PERF_STORE_KEY);
      } catch {}
    }
    if (isAdmin || isTL) {
      fetchEmployees();
    }
    if (isTL) {
      fetchTeamLeadScope();
    }
    fetchAllPerformances(false);

    // Silent background auto-refresh every 10s for new performance reviews
    const interval = setInterval(() => {
      fetchAllPerformances(true);
      if (isAdmin || isTL) fetchEmployees();
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

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAdmin, isTL, fetchAllPerformances, fetchEmployees, fetchTeamLeadScope]);

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
    if (!perf || isUnknownEmployeeOrUser(perf)) return "";

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

    return "";
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

  const formatRowDateToInput = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
      return dateVal.trim();
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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
  // TEAM LEAD ISOLATION: ASSIGNED TEAM MEMBERS RECORD MATCHING
  // ============================================================
  const isTeamMemberRecord = useCallback((perf) => {
    if (!perf) return false;
    // Exclude TL's personal review from team members tab
    if (isMyRecord(perf)) return false;

    const myIdentity = getPerformanceEmployeeIdentity(user);
    [
      getRealAuthUserId(user),
      user?._id,
      user?.id,
      user?.employeeId
    ].filter(Boolean).forEach((id) => myIdentity.ids.add(String(id).toLowerCase().trim()));
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

    if (!teamEmployeesScope) return false;

    const { memberIds, memberEmails, memberNames } = teamEmployeesScope;
    const perfIdentity = getPerformanceEmployeeIdentity(perf);
    return [...perfIdentity.ids].some((id) => memberIds.has(id)) ||
      [...perfIdentity.emails].some((email) => memberEmails.has(email)) ||
      [...perfIdentity.names].some((name) => memberNames.has(name));
  }, [teamEmployeesScope, isMyRecord, user]);

  // Role-isolated performances: Admin sees all; TL can toggle personal vs assigned team; Employee sees personal
  const myPerformances = useMemo(() => {
    const cleanList = performances.filter(
      (p) => !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p)
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
      (p) => !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p) && isTeamMemberRecord(p)
    ).length;
  }, [performances, isTeamMemberRecord]);

  const personalPerformancesCount = useMemo(() => {
    return performances.filter(
      (p) => !isDummyPerformanceRecord(p) && !isUnknownEmployeeOrUser(p) && isMyRecord(p)
    ).length;
  }, [performances, isMyRecord]);

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

    const displayTotalEmployees = isTL
      ? (teamEmployeesScope?.memberIds?.size || totalRecords)
      : (employees.length > 0 ? employees.length : totalRecords);

    return {
      isPersonal: false,
      totalEmployees: isTL ? totalRecords : displayTotalEmployees,
      totalEmployeesLabel: isTL ? "Team Evaluated" : "Total Evaluated",
      excellentCount,
      goodCount,
      needsImprovementCount
    };
  }, [isAdmin, isTL, tlViewScope, myPerformances, employees, teamEmployeesScope, user]);

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
      if (!perf || isDummyPerformanceRecord(perf) || isUnknownEmployeeOrUser(perf)) return false;
      const rawName = getEmployeeDisplayName(perf);
      if (!rawName || isUnknownEmployeeOrUser(rawName)) return false;
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
        const rawDate = perf.createdAt || perf.date;
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
    if (!isAdmin) return;
    setModalForm({
      employeeID: "",
      employeeName: "",
      employeeEmail: "",
      percentage: "",
      rating: "",
      feedback: "",
      remarks: "",
      remark: "",
      date: new Date().toLocaleDateString("en-CA")
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (perf) => {
    if (!isAdmin) return;
    setEditingRecord(perf);
    const pct = getNumericPercentage(perf);
    const empName = getEmployeeDisplayName(perf);
    const empEmail = getEmployeeEmail(perf);
    const rawRating = perf.rating !== undefined && perf.rating !== null ? String(perf.rating) : "";
    const existingRemarks = perf.remarks || perf.remark || "";
    const existingFeedback = perf.feedback || "";
    const existingDate = formatRowDateToInput(perf.date || perf.createdAt || "") || new Date().toLocaleDateString("en-CA");

    setModalForm({
      employeeID: String(perf.employeeID?._id || perf.employeeID || perf.employee?._id || ""),
      employeeName: empName,
      employeeEmail: empEmail,
      percentage: String(pct),
      rating: rawRating,
      feedback: existingFeedback,
      remarks: existingRemarks,
      remark: existingRemarks,
      date: existingDate
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
    const selectedDate = modalForm.date ? modalForm.date : new Date().toLocaleDateString("en-CA");
    const [yearStr, monthStr, dayStr] = selectedDate.split("-");
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const dateObj = new Date(yearNum, monthNum - 1, parseInt(dayStr || "1", 10));
    const monthName = dateObj.toLocaleString("en-US", { month: "long" });
    const isoDateTime = selectedDate ? new Date(`${selectedDate}T12:00:00.000Z`).toISOString() : new Date().toISOString();

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
          `https://kt-backend-yzr4.onrender.com/api/performance/update/${editingRecord._id}`,
          {
            method: "PUT",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to update performance record");
        }

        const updatedData = {
          ...editingRecord,
          ...payload,
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

        showNotification("Performance record updated successfully!", "success");
        setIsEditModalOpen(false);
        setEditingRecord(null);
      } else {
        let response = await fetch(
          "https://kt-backend-yzr4.onrender.com/api/performance/create",
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
            "https://kt-backend-yzr4.onrender.com/api/performance/create",
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
            const checkRes = await fetch("https://kt-backend-yzr4.onrender.com/api/performance/all", { headers });
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
          } catch {}
        }

        if (newId && !String(newId).startsWith("perf-")) {
          try {
            await fetch(
              `https://kt-backend-yzr4.onrender.com/api/performance/update/${newId}`,
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

      await fetchAllPerformances();
      setModalForm({
        employeeID: "",
        employeeName: "",
        employeeEmail: "",
        percentage: "",
        rating: "",
        feedback: "",
        remarks: "",
        remark: "",
        date: new Date().toLocaleDateString("en-CA")
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
        `https://kt-backend-yzr4.onrender.com/api/performance/delete/${perf._id}`,
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
      await fetchAllPerformances();
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Failed to delete performance record", "error");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6 font-poppins">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tlViewScope === "team"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users size={14} />
                <span>My Team</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  tlViewScope === "team" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-200 text-slate-600"
                }`}>
                  {teamPerformancesCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTlViewScope("my")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tlViewScope === "my"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <User size={14} />
                <span>My Review</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  tlViewScope === "my" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-200 text-slate-600"
                }`}>
                  {personalPerformancesCount}
                </span>
              </button>
            </div>
          )}

          {/* Outline Sync button matching reference design */}
          <button
            type="button"
            onClick={fetchAllPerformances}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-60 transition font-poppins"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#0088cc]" : "text-slate-600"} />
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
              className="relative flex items-center h-[80px] w-full"
            >
              {/* Left card for the border: width: 22; height: 80; border-top-left-radius: 10px; border-bottom-left-radius: 10px; */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[22px] h-[80px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "#034665", opacity: 1 }}
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
              className="relative flex items-center h-[80px] w-full"
            >
              {/* Left card for the border */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[22px] h-[80px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                style={{ background: "#034665", opacity: 1 }}
              />
              {/* Inner card */}
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
            {isAdmin && (
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
        {loading ? (
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
            {isAdmin && (
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
            <table className="w-full text-left text-xs border-collapse">
              <thead style={{ backgroundColor: "#0346651A" }}>
                <tr className="text-[#034665] text-xs font-semibold font-poppins" style={{ backgroundColor: "#0346651A" }}>
                  <th className="py-3 px-4 w-12 text-left font-semibold">No.</th>
                  <th className="py-3 px-4 text-left font-semibold">Employee</th>
                  <th className="py-3 px-4 text-left font-semibold">Department</th>
                  <th className="py-3 px-4 text-left font-semibold">Type</th>
                  <th className="py-3 px-4 text-left font-semibold">Performance</th>
                  <th className="py-3 px-4 text-left font-semibold">Remark</th>
                  <th className="py-3 px-4 text-left font-semibold">Date</th>
                  <th className="py-3 px-4 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-poppins">
                {filteredPerformances.map((perf, index) => {
                  const rowNumber = index + 1;
                  const empName = getEmployeeDisplayName(perf);
                  const empEmail = getEmployeeEmail(perf);
                  const pct = getNumericPercentage(perf);
                  const dept = getDepartment(perf);
                  const empType = perf.employeeType || (perf.role ? (String(perf.role).toLowerCase().includes("lead") ? "Team Leader" : "Employee") : "Employee");
                  const remarksText = getRemarks(perf);
                  const dateFormatted = formatRowDate(perf.createdAt || perf.date);

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

                      {/* Department (Badge style) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-3 py-1 rounded-[6px] text-xs font-medium bg-[#e6ecf0] text-[#2c6580]">
                          {dept}
                        </span>
                      </td>

                      {/* Type (Badge style) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-3 py-1 rounded-[6px] text-xs font-medium bg-[#e6ecf0] text-[#2c6580]">
                          {empType}
                        </span>
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

                      {/* Remark */}
                      <td className="py-3.5 px-4 max-w-[220px]">
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

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2.5">
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(perf)}
                                className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer p-1"
                                title="Edit performance"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePerformance(perf)}
                                className="text-slate-600 hover:text-rose-600 transition-colors cursor-pointer p-1"
                                title="Delete record"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
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
          <div className="bg-white border border-slate-200/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center">
                  {isEditModalOpen ? <Edit3 size={16} /> : <Plus size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isEditModalOpen ? "Edit Performance Record" : "Add Performance Record"}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="p-4 sm:p-5 space-y-4">
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
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] cursor-pointer pr-8 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={modalForm.date || ""}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full h-10 px-3.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all cursor-pointer"
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
                      className="w-full h-10 pl-3 pr-7 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all"
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
                      className="w-full h-10 pl-3 pr-9 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all"
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
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] resize-none transition-all"
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
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] resize-none transition-all"
                  />
                  <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-medium">
                    {(modalForm.remarks || "").length}/500
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                  className="px-4 py-2 btn-brand-primary text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Performance Evaluation Details</h3>
                  <p className="text-[11px] text-slate-500">
                    {getEmployeeDisplayName(selectedFeedbackModal.perf)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedbackModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Score</span>
                  <span className="font-bold text-slate-900 text-sm">
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
                  <span className="font-medium text-slate-600">
                    {formatRowDate(selectedFeedbackModal.perf.createdAt || selectedFeedbackModal.perf.date)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Feedback
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {selectedFeedbackModal.perf.feedback || "No feedback recorded."}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remarks
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {selectedFeedbackModal.perf.remarks || selectedFeedbackModal.perf.remark || "No remarks recorded."}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFeedbackModal(null)}
                  className="px-4 py-2 btn-brand-primary text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs transition-all"
                  style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;