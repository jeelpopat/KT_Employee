import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { LoadingScreen } from "../../components/common/Loader.jsx";
import { createPortal } from "react-dom";
import axios from "axios";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Clock,
  User,
  Users, 
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FolderOpen,
  ListTodo,
  FileText,
  RefreshCw,
  Eye,
  MessageSquare,
  Check,
  Search,
  Filter,
  Sparkles,
  Layers,
  Box
} from "lucide-react";
import { useConfirm } from "../../components/common/ConfirmDialog";
import { showToast } from "../../components/common/Toast";
import {
  isFinanceOrExcludedUser,
  filterOutFinanceUsers,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser,
  isHrRoleOrUser,
  isStrictEmployeeRole
} from "../../utils/roleFilters";
import { useApp, deriveUserRole } from "../../context/AppContext";
import { 
  getLoggedInUserIdentifiers, 
  isProjectAssignedToLead, 
  isTeamLeadRole, 
  isAdminRole 
} from "../../utils/teamLeadUtils";
import { normalizeTaskStatus, getProgressForStatus, getTaskProgress } from "../../utils/taskUtils";
import { BASE_URL as BACKEND_URL } from "../../api/config";

const BASE_URL = `${BACKEND_URL}/api/projectManage/project`;

const API_CORE = `${BACKEND_URL}/api/projectManage`;

const EMPLOYEE_URL = `${BACKEND_URL}/api/employee/list`;

const USER_URL = `${BACKEND_URL}/api/users/all`;

const TASK_URL = `${BACKEND_URL}/api/task`;

const TASK_PROJECT_MANAGE_URL = `${BACKEND_URL}/api/projectManage/task`;

const TEAM_LEAD_URL = `${BACKEND_URL}/api/teamLead/team`;

const DAILY_UPDATE_URL = `${BACKEND_URL}/api/dailyUpdate/list`;

const getLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isValidProjectDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
};

function MultiSelectDropdown({
  label,
  options = [],
  selectedValues = [],
  onChange,
  placeholder = "Select...",
  icon: Icon,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !dropdownRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const spaceAbove = triggerRect.top - 8;
      const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
      const openAbove = spaceBelow < 264 && spaceAbove > spaceBelow;
      const availableSpace = Math.max(
        120,
        Math.min(256, openAbove ? spaceAbove : spaceBelow)
      );
      const width = Math.min(triggerRect.width, window.innerWidth - 16);

      setMenuPosition({
        position: "fixed",
        left: Math.max(8, Math.min(triggerRect.left, window.innerWidth - width - 8)),
        width,
        maxHeight: availableSpace,
        ...(openAbove
          ? { bottom: window.innerHeight - triggerRect.top + 4 }
          : { top: triggerRect.bottom + 4 }),
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(
    (opt) =>
      (opt.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.subText || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (id) => {
    const normalized = String(id);
    if (selectedValues.includes(normalized)) {
      onChange(selectedValues.filter((v) => v !== normalized));
    } else {
      onChange([...selectedValues, normalized]);
    }
  };

  const removeOption = (e, id) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== String(id)));
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    const allIds = options.map((o) => String(o.id));
    onChange(allIds);
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedOptions = options.filter((opt) =>
    selectedValues.includes(String(opt.id))
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1 min-h-[22px]">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          {label}
        </label>
        {selectedValues.length > 0 && (
          <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
            {selectedValues.length} selected
          </span>
        )}
      </div>

      {/* Trigger Box - Fixed uniform height h-[42px] matching Team Lead */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((open) => !open);
          }
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`h-[42px] w-full border rounded-lg px-3 py-2 bg-white flex items-center justify-between gap-1.5 cursor-pointer shadow-sm transition-all text-sm select-none ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-100"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400 text-sm truncate">{placeholder}</span>
          ) : selectedOptions.length === 1 ? (
            <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md truncate max-w-full">
              <span className="truncate">{selectedOptions[0].name}</span>
              <button
                type="button"
                onClick={(e) => removeOption(e, selectedOptions[0].id)}
                className="hover:bg-blue-200 p-0.5 rounded text-blue-600 hover:text-blue-900 ml-0.5"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 max-w-[130px]">
                <span className="truncate">{selectedOptions[0].name}</span>
                <button
                  type="button"
                  onClick={(e) => removeOption(e, selectedOptions[0].id)}
                  className="hover:bg-blue-200 p-0.5 rounded text-blue-600 hover:text-blue-900 ml-0.5"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <span className="bg-blue-100/70 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">
                +{selectedOptions.length - 1} more
              </span>
            </div>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          style={menuPosition}
          className="z-[10000] bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 flex flex-col overflow-hidden"
        >
          {/* Search + Quick Actions */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
              >
                Select All ({options.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                No members found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(String(opt.id));
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-medium"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{opt.name}</p>
                      {opt.subText && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {opt.subText}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Team() {
  const { confirm, confirmationDialog } = useConfirm();
  const { user, userRole } = useApp();
  const currentRole = userRole || deriveUserRole(user);
  const isAdmin = isAdminRole(currentRole, user);
  const isTL = !isAdmin && isTeamLeadRole(currentRole, user);
  const todayDate = getLocalDateString();
  const userIdentifiers = useMemo(() => getLoggedInUserIdentifiers(user), [user]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [rawUsers, setRawUsers] = useState([]);
  const [teamLeadOptions, setTeamLeadOptions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  
  // State for daily updates
  const [taskUpdatesById, setTaskUpdatesById] = useState({});
  const [loadingTaskUpdates, setLoadingTaskUpdates] = useState({});
  const [selectedReportMemberByTask, setSelectedReportMemberByTask] = useState({});

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // Top-level Navigation: 'projects' | 'daily-reports'
  const [activeMainTab, setActiveMainTab] = useState('projects');

  // Daily Work Reports State from API /api/dailyUpdate/list
  const [dailyReports, setDailyReports] = useState([]);
  const [isDailyReportsLoading, setIsDailyReportsLoading] = useState(false);
  const [dailySearchQuery, setDailySearchQuery] = useState("");
  const [dailyProjectFilter, setDailyProjectFilter] = useState("all");
  const [dailyEmployeeFilter, setDailyEmployeeFilter] = useState("all");
  const [selectedDailyReportModal, setSelectedDailyReportModal] = useState(null);

  const fetchAllDailyReports = async (isSilent = false) => {
    if (!isSilent) setIsDailyReportsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(DAILY_UPDATE_URL, { headers });
      const list = res.data?.data || res.data?.reports || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(list)) {
        const valid = list.filter(r => r && (r.todaysWork || r.workUpdate || r.description) && !isUnknownEmployeeOrUser(r));
        valid.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || a.reportDate || 0).getTime();
          const dateB = new Date(b.createdAt || b.date || b.reportDate || 0).getTime();
          return dateB - dateA;
        });
        setDailyReports(valid);
      }
    } catch (err) {
      console.error("Failed to fetch daily reports from /api/dailyUpdate/list:", err);
    } finally {
      if (!isSilent) setIsDailyReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDailyReports(false);

    // Silent background auto-refresh every 10s for new daily work updates
    const interval = setInterval(() => {
      fetchAllDailyReports(true);
    }, 10000);

    const handleFocus = () => {
      fetchAllDailyReports(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAllDailyReports(true);
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
  
const [projectTeamMembers, setProjectTeamMembers] = useState({
  tl: null,
  employees: [],
});

  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);
  const lastProjectClickTimeRef = useRef(0);

  const [projectForm, setProjectForm] = useState({
    projectName: "",
    projectDescription: "",
    clientName: "",
    clientEmail: "",
    projectBudget: "",
    startDate: "",
    endDate: "",
    priority: "medium",
    status: "pending",
    assignedEmployees: [],
    assignedTL: "",
  });

  const defaultProjectForm = {
    projectName: "",
    projectDescription: "",
    clientName: "",
    clientEmail: "",
    projectBudget: "",
    startDate: "",
    endDate: "",
    priority: "medium",
    status: "pending",
    assignedEmployees: [],
    assignedTL: "",
  };

  const defaultTaskForm = {
    projectId: "",
    taskTitle: "",
    description: "",
    assignedTeamLead: "",
    assignedTo: "",
    assignedEmployee: "",
    assignedBy: "",
    startDate: "",
    dueDate: "",
    priority: "medium",
    progress: 0,
    status: "pending",
  };

  const [taskForm, setTaskForm] = useState({ ...defaultTaskForm });
  const [editingTask, setEditingTask] = useState(null);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const lastTaskActionRef = useRef(0);

  const checkTaskActionCooldown = (cooldownMs = 300) => {
    const now = Date.now();
    if (now - lastTaskActionRef.current < cooldownMs) {
      return false;
    }
    lastTaskActionRef.current = now;
    return true;
  };

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    fetchUsers();
    fetchTeamLeadOptions();
    fetchTasks();

    // Silent background auto-refresh every 10 seconds for real-time projects and tasks
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!showProjectModal && !showTaskModal && !editingTask) {
        fetchProjects(true);
        fetchTasks(selectedProject?._id || null);
      }
    }, 10000);

    const handleFocus = () => {
      if (!showProjectModal && !showTaskModal && !editingTask) {
        fetchProjects(true);
        fetchTasks(selectedProject?._id || null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !showProjectModal && !showTaskModal && !editingTask) {
        fetchProjects(true);
        fetchTasks(selectedProject?._id || null);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [showProjectModal, showTaskModal, editingTask, selectedProject]);

  // Function to fetch daily updates for a task using DAILY_UPDATE_URL
  const fetchTaskUpdates = async (taskId) => {
    if (!taskId) return;

    setLoadingTaskUpdates((prev) => ({ ...prev, [taskId]: true }));

    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Primary Live API: GET DAILY_UPDATE_URL
      let rawList = [];
      try {
        const response = await axios.get(DAILY_UPDATE_URL, {
          headers,
          params: { taskId },
        });
        const payload = response.data;
        rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.reports)
              ? payload.reports
              : Array.isArray(payload?.dailyUpdates)
                ? payload.dailyUpdates
                : Array.isArray(payload?.updates)
                  ? payload.updates
                  : [];
      } catch (paramErr) {
        // Fallback without params if param caused issue
        const response = await axios.get(DAILY_UPDATE_URL, { headers });
        const payload = response.data;
        rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.reports)
              ? payload.reports
              : Array.isArray(payload?.dailyUpdates)
                ? payload.dailyUpdates
                : Array.isArray(payload?.updates)
                  ? payload.updates
                  : [];
      }

      // If empty, check if dailyReports state has loaded reports
      if ((!rawList || rawList.length === 0) && Array.isArray(dailyReports) && dailyReports.length > 0) {
        rawList = dailyReports;
      }

      const targetTask = tasks.find((t) => String(t._id || t.id) === String(taskId));
      const targetTitle = (targetTask?.taskTitle || targetTask?.title || "").trim().toLowerCase();

      // Filter reports associated with this specific task
      const matchedReports = rawList.filter((item) => {
        if (!item) return false;

        // 1. Check in taskReferences array (e.g. [{ _id, projectId, taskTitle, progress, status }])
        if (Array.isArray(item.taskReferences) && item.taskReferences.length > 0) {
          const hasTaskRef = item.taskReferences.some((ref) => {
            if (!ref) return false;
            const refId = String(
              typeof ref === "object" ? ref._id || ref.id || ref.taskId || "" : ref
            );
            if (refId && refId === String(taskId)) return true;
            if (
              targetTitle &&
              typeof ref === "object" &&
              ref.taskTitle &&
              ref.taskTitle.trim().toLowerCase() === targetTitle
            ) {
              return true;
            }
            return false;
          });
          if (hasTaskRef) return true;
        }

        // 2. Direct taskId or task references on the report object
        const directTaskId = String(
          item.taskId?._id || item.taskId?.id || item.taskId || item.task?._id || item.task || ""
        );
        if (directTaskId && directTaskId === String(taskId)) return true;

        // 3. Array of tasks (item.tasks)
        if (Array.isArray(item.tasks) && item.tasks.length > 0) {
          const hasTaskInArray = item.tasks.some((t) => {
            if (!t) return false;
            const tId = String(typeof t === "object" ? t._id || t.id || t.taskId || "" : t);
            return tId && tId === String(taskId);
          });
          if (hasTaskInArray) return true;
        }

        return false;
      });

      // Normalize report records for UI display
      const normalizedUpdates = matchedReports.map((item) => {
        const matchingRef = Array.isArray(item.taskReferences)
          ? item.taskReferences.find((ref) => {
              if (!ref) return false;
              const refId = String(
                typeof ref === "object" ? ref._id || ref.id || ref.taskId || "" : ref
              );
              if (refId && refId === String(taskId)) return true;
              if (
                targetTitle &&
                typeof ref === "object" &&
                ref.taskTitle &&
                ref.taskTitle.trim().toLowerCase() === targetTitle
              ) {
                return true;
              }
              return false;
            })
          : null;

        const progressVal =
          typeof matchingRef === "object" && matchingRef?.progress !== undefined
            ? matchingRef.progress
            : typeof item.progress === "number"
              ? item.progress
              : null;

        const primaryText =
          item.todaysWork ||
          item.workUpdate ||
          item.updateText ||
          item.description ||
          item.message ||
          "";

        return {
          ...item,
          progress: typeof progressVal === "number" ? progressVal : null,
          updateText: primaryText || "No report details provided.",
          todaysWork: item.todaysWork,
          pendingWork: item.pendingWork,
          tomorrowPlan: item.tomorrowPlan,
          issuesFaced: item.issuesFaced,
          hoursWorked: item.hoursWorked,
          createdAt: item.createdAt || item.reportDate || item.date || new Date().toISOString(),
        };
      });

      const sortedUpdates = [...normalizedUpdates].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setTaskUpdatesById((prev) => ({ ...prev, [taskId]: sortedUpdates }));
    } catch (error) {
      console.error("Error fetching task updates from /api/dailyUpdate/list:", error);
      setTaskUpdatesById((prev) => ({ ...prev, [taskId]: [] }));
    } finally {
      setLoadingTaskUpdates((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Automatically correlate loaded dailyReports with tasks so updates show immediately
  useEffect(() => {
    if (!dailyReports || dailyReports.length === 0 || !tasks || tasks.length === 0) return;

    const updatesMap = {};
    tasks.forEach((task) => {
      const taskId = String(task._id || task.id);
      const targetTitle = (task.taskTitle || task.title || "").trim().toLowerCase();

      const matched = dailyReports.filter((item) => {
        if (!item) return false;
        if (Array.isArray(item.taskReferences) && item.taskReferences.length > 0) {
          return item.taskReferences.some((ref) => {
            if (!ref) return false;
            const refId = String(typeof ref === "object" ? ref._id || ref.id || ref.taskId || "" : ref);
            if (refId && refId === taskId) return true;
            if (targetTitle && typeof ref === "object" && ref.taskTitle && ref.taskTitle.trim().toLowerCase() === targetTitle) return true;
            return false;
          });
        }
        const directTaskId = String(item.taskId?._id || item.taskId?.id || item.taskId || item.task?._id || item.task || "");
        if (directTaskId && directTaskId === taskId) return true;
        return false;
      });

      if (matched.length > 0) {
        updatesMap[taskId] = matched.map((item) => {
          const matchingRef = Array.isArray(item.taskReferences)
            ? item.taskReferences.find((ref) => {
                const refId = String(typeof ref === "object" ? ref._id || ref.id || ref.taskId || "" : ref);
                return refId === taskId || (targetTitle && typeof ref === "object" && ref.taskTitle && ref.taskTitle.trim().toLowerCase() === targetTitle);
              })
            : null;
          const progressVal = typeof matchingRef === "object" && matchingRef?.progress !== undefined
            ? matchingRef.progress
            : typeof item.progress === "number" ? item.progress : null;
          const primaryText = item.todaysWork || item.workUpdate || item.updateText || item.description || item.message || "";
          return {
            ...item,
            progress: typeof progressVal === "number" ? progressVal : null,
            updateText: primaryText || "No report details provided.",
            todaysWork: item.todaysWork,
            pendingWork: item.pendingWork,
            tomorrowPlan: item.tomorrowPlan,
            issuesFaced: item.issuesFaced,
            hoursWorked: item.hoursWorked,
            createdAt: item.createdAt || item.reportDate || item.date || new Date().toISOString(),
          };
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
    });

    if (Object.keys(updatesMap).length > 0) {
      setTaskUpdatesById((prev) => ({ ...updatesMap, ...prev }));
    }
  }, [dailyReports, tasks]);

  const fetchTasks = async (projectId = null) => {
    try {
      let taskData = [];

      // 1. Try primary TASK_URL (/api/task/all)
      try {
        const res = await axios.get(`${TASK_URL}/all`);
        const payload = res.data;
        if (Array.isArray(payload)) {
          taskData = payload;
        } else if (Array.isArray(payload?.data)) {
          taskData = payload.data;
        } else if (Array.isArray(payload?.tasks)) {
          taskData = payload.tasks;
        }
      } catch (err1) {
        console.warn("Primary task fetch (/api/task/all) error, trying fallback:", err1.message);
      }

      // 2. If empty or failed, try fallback TASK_PROJECT_MANAGE_URL
      if (taskData.length === 0) {
        try {
          const fetchUrl = projectId
            ? `${TASK_PROJECT_MANAGE_URL}/project/${projectId}`
            : `${TASK_PROJECT_MANAGE_URL}/all`;
          const res2 = await axios.get(fetchUrl);
          const payload2 = res2.data;
          if (Array.isArray(payload2)) {
            taskData = payload2;
          } else if (Array.isArray(payload2?.data)) {
            taskData = payload2.data;
          } else if (Array.isArray(payload2?.tasks)) {
            taskData = payload2.tasks;
          }
        } catch (err2) {
          // fallback error handled
        }
      }

      const sortedTasks = sortTasksByNewest(taskData);
      setTasks(sortedTasks);
      return sortedTasks;
    } catch (error) {
      console.error("Tasks fetch error:", error?.response?.data || error.message);
      setTasks([]);
      return [];
    }
  };

  const sortTasksByNewest = (tasks = []) => {
    return [...tasks].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.updatedAt || a.startDate || a.dueDate || 0).getTime();
      const bTime = new Date(b.createdAt || b.updatedAt || b.startDate || b.dueDate || 0).getTime();
      return bTime - aTime;
    });
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(EMPLOYEE_URL);
      const empData = res.data.data || res.data.employees || res.data || [];
      const list = Array.isArray(empData) ? empData : [];
      setEmployees(filterOutUnknownUsers(filterOutFinanceUsers(list)));
    } catch (error) {
      console.error("Employees fetch error:", error);
      setEmployees([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(USER_URL);
      const userData = res.data.data || res.data.users || res.data || [];
      const list = Array.isArray(userData) ? userData : [];
      setRawUsers(list);
      setUsers(filterOutUnknownUsers(filterOutFinanceUsers(list)));
    } catch (error) {
      console.error("Users fetch error:", error);
      setRawUsers([]);
      setUsers([]);
    }
  };

  const fetchTeamLeadOptions = async () => {
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : {};

      // 1. Fetch from api/user/all (fallback to api/users/all)
      let allUsers = [];
      try {
        const userRes = await axios.get(`${BACKEND_URL}/api/user/all`, { headers });
        allUsers = userRes?.data?.users || userRes?.data?.data || (Array.isArray(userRes?.data) ? userRes.data : []);
      } catch (e1) {
        try {
          const userRes = await axios.get(USER_URL, { headers });
          allUsers = userRes?.data?.users || userRes?.data?.data || (Array.isArray(userRes?.data) ? userRes.data : []);
        } catch (e2) {
          try {
            const userRes = await axios.get(USER_URL);
            allUsers = userRes?.data?.users || userRes?.data?.data || (Array.isArray(userRes?.data) ? userRes.data : []);
          } catch (e3) {
            console.warn("Could not fetch user/all or users/all:", e3);
          }
        }
      }

      const isTeamLeadUser = (u) => {
        if (!u || isFinanceOrExcludedUser(u) || isHrRoleOrUser(u)) return false;
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
          desig.includes('team lead') ||
          desig.includes('team leader') ||
          isTeamLeadRole(u)
        );
      };

      const userTeamLeads = (Array.isArray(allUsers) ? allUsers : []).filter(isTeamLeadUser);

      // Optional: check teamLead/team for assigned employees if available
      let teamLeadsData = [];
      try {
        const res = await axios.get(TEAM_LEAD_URL, { headers });
        const payload = res?.data?.data || res?.data?.teamLeads || res?.data?.teamLead || res?.data || [];
        teamLeadsData = Array.isArray(payload) ? payload : [];
      } catch (err) {
        // Safe to ignore if endpoint is not used
      }

      const optionsMap = new Map();

      // 1. Add from userTeamLeads
      userTeamLeads
        .filter((u) => u && !isFinanceOrExcludedUser(u) && !isUnknownEmployeeOrUser(u))
        .forEach((u) => {
          const name = u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || '';
          if (!name || isUnknownEmployeeOrUser({ name, email: u.email })) return;

          const emailKey = u.email ? String(u.email).toLowerCase().trim() : '';
          const idKey = String(u._id || u.id || '');
          const dedupeKey = emailKey || idKey || name.toLowerCase();
          if (optionsMap.has(dedupeKey)) return;

          const matchingDoc = teamLeadsData.find((doc) => {
            const docId = doc?.teamLead?.userId || doc?.teamLead?._id || doc?.teamLead?.employeeId || doc?.userId || doc?._id;
            const docEmail = doc?.teamLead?.email || doc?.email;
            return (docId && String(docId) === String(u._id)) || (docEmail && docEmail.toLowerCase() === (u.email || '').toLowerCase());
          });

          const employees = (matchingDoc?.teamLead?.employees || matchingDoc?.employees || matchingDoc?.teamLead?.teamMembers || [])
            .filter((e) => e && !isFinanceOrExcludedUser(e) && !isUnknownEmployeeOrUser(e) && !isHrRoleOrUser(e));

          optionsMap.set(dedupeKey, {
            _id: String(u._id || idKey),
            value: String(u._id || idKey),
            name: name,
            email: u.email || "",
            department: u.department || "",
            designation: typeof u.designation === 'object' ? (u.designation?.designationName || u.designation?.name || "") : (u.designation || ""),
            employees: Array.isArray(employees) ? employees : [],
          });
        });

      // 2. Include any extra confirmed TLs from teamLeadsData without duplication
      teamLeadsData.forEach((lead) => {
        const teamLeadRecord = lead?.teamLead || lead?.lead || lead?.user || lead?.employee || null;
        if (lead && (isFinanceOrExcludedUser(lead) || isUnknownEmployeeOrUser(lead) || isHrRoleOrUser(lead))) return;
        if (teamLeadRecord && (isFinanceOrExcludedUser(teamLeadRecord) || isUnknownEmployeeOrUser(teamLeadRecord) || isHrRoleOrUser(teamLeadRecord))) return;

        const leadId =
          teamLeadRecord?.userId ||
          teamLeadRecord?.employeeId ||
          teamLeadRecord?._id ||
          lead?.teamLeadId ||
          lead?._id ||
          null;

        const name =
          teamLeadRecord?.name ||
          teamLeadRecord?.fullName ||
          lead?.name ||
          lead?.fullName ||
          "";

        const email = teamLeadRecord?.email || lead?.email || "";
        const emailKey = email ? String(email).toLowerCase().trim() : '';
        const idKey = leadId ? String(leadId) : '';
        const dedupeKey = emailKey || idKey || name.toLowerCase();

        if (!leadId || !name || isUnknownEmployeeOrUser({ name, email }) || optionsMap.has(dedupeKey)) {
          return;
        }

        const employees = (teamLeadRecord?.employees || lead?.employees || teamLeadRecord?.teamMembers || [])
          .filter((e) => e && !isFinanceOrExcludedUser(e) && !isUnknownEmployeeOrUser(e) && !isHrRoleOrUser(e));

        optionsMap.set(dedupeKey, {
          _id: String(leadId),
          value: String(leadId),
          name: name,
          email: email,
          employees: Array.isArray(employees) ? employees : [],
        });
      });

      setTeamLeadOptions(Array.from(optionsMap.values()));
    } catch (error) {
      console.error("Team lead options fetch error:", error);
      setTeamLeadOptions([]);
    }
  };

  const extractName = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;

    const name = [
      item.name,
      item.fullName,
      item.username,
      item.employeeName,
      item.userName,
      item.title,
      item.displayName,
      item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : null,
    ].find(Boolean);

    return name || "";
  };

  const getIdCandidates = (item) => {
    if (!item) return [];
    if (typeof item === "string" || typeof item === "number") return [String(item)];
    if (typeof item !== "object") return [];

    const candidates = [];
    const keys = ["_id", "id", "userId", "employeeId", "teamLeadId", "uniqueID", "uuid"];

    keys.forEach((key) => {
      const value = item[key];
      if (value !== undefined && value !== null && value !== "") {
        candidates.push(String(value));
      }
    });

    if (item.user && typeof item.user === "object") {
      candidates.push(...getIdCandidates(item.user));
    }
    if (item.employee && typeof item.employee === "object") {
      candidates.push(...getIdCandidates(item.employee));
    }
    if (item.teamLead && typeof item.teamLead === "object") {
      candidates.push(...getIdCandidates(item.teamLead));
    }
    if (item.person && typeof item.person === "object") {
      candidates.push(...getIdCandidates(item.person));
    }

    return [...new Set(candidates.filter(Boolean))];
  };

  const findEntity = (collection, value) => {
    if (!collection || !value) return null;

    const targetIds = new Set(getIdCandidates(value));
    if (targetIds.size > 0) {
      return collection.find((item) => {
        const itemIds = getIdCandidates(item);
        return itemIds.some((id) => targetIds.has(id));
      });
    }

    if (typeof value === "object") {
      const targetName = extractName(value);
      if (targetName) {
        return collection.find((item) => {
          const itemName = extractName(item);
          return itemName && itemName.toLowerCase() === targetName.toLowerCase();
        });
      }
    }

    return null;
  };

  const getUserName = (user) => {
    if (!user) return "";
    if (typeof user === "string") return user;

    const direct = extractName(user);
    if (direct) return direct;

    if (user.user) return getUserName(user.user);
    if (user.employee) return getUserName(user.employee);
    if (user.person) return getUserName(user.person);

    return "Unknown";
  };

  const getNamesByIds = (collection, values, type = "user") => {
    if (!values) return "";

    if (!Array.isArray(values)) {
      return type === "employee"
        ? getEmployeeNameById(values)
        : getUserNameById(values);
    }

    return values
      .map((value) => {
        const item = findEntity(collection, value);
        if (item) return extractName(item);
        if (typeof value === "object") return extractName(value) || getUserName(value) || getEmployeeName(value) || "";
        return value;
      })
      .filter(Boolean)
      .join(", ");
  };

  const getUserNameById = (value) => {
    if (!value) return "";
    if (typeof value === "object") return getUserName(value);

    const user = findEntity(users, value) || findEntity(employees, value) || findEntity(teamLeadOptions, value);
    if (user) return getUserName(user);

    return value;
  };

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
      const ids = getIdCandidates(value);
      if (ids.length > 0) return String(ids[0]);
      return String(
        value._id ||
        value.id ||
        value.projectId ||
        (value.user && normalizeId(value.user)) ||
        (value.employee && normalizeId(value.employee)) ||
        (value.teamLead && normalizeId(value.teamLead)) ||
        (value.person && normalizeId(value.person)) ||
        value
      );
    }
    return String(value);
  };

  const isSameId = (a, b) => normalizeId(a) === normalizeId(b);
  const sortByNewest = (items = []) => {
    return [...items].sort((a, b) => {
      const aTime = new Date(
        a.createdAt || a.updatedAt || a.startDate || a.dueDate || a.completedAt || 0
      ).getTime();
      const bTime = new Date(
        b.createdAt || b.updatedAt || b.startDate || b.dueDate || b.completedAt || 0
      ).getTime();

      if (aTime && bTime && aTime !== bTime) {
        return bTime - aTime;
      }

      return String(b._id || "").localeCompare(String(a._id || ""));
    });
  };

  const fetchProjects = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await axios.get(`${BASE_URL}/all`);
      const projectData = res.data.data || res.data.projects || res.data;
      
      const processedProjects = (projectData || []).map(project => {
        let teamLeadName = "";
        if (project.teamLeadUser) {
          teamLeadName = extractName(project.teamLeadUser);
        } else if (project.teamLeadEmployee) {
          teamLeadName = extractName(project.teamLeadEmployee);
        }
        
        return {
          ...project,
          teamLeadName: teamLeadName || "Not Assigned",
          teamLead: project.teamLeadUser || project.teamLeadEmployee
        };
      });
      
      setProjects(sortByNewest(processedProjects || []));
    } catch (error) {
      console.error("Fetch Projects Error:", error);
      if (!isSilent) setProjects([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const updateProjectTeamMembers = (project) => {
  if (!project) {
    setProjectTeamMembers({
      tl: null,
      employees: [],
    });
    return;
  }

  const tlId = project.teamLeadUser
    ? normalizeId(project.teamLeadUser)
    : project.teamLeadEmployee
      ? normalizeId(project.teamLeadEmployee)
      : null;

  const tl = tlId
    ? findEntity(teamLeadOptions, tlId) ||
      findEntity(users, tlId) ||
      findEntity(employees, tlId)
    : null;

  const employeeList = Array.isArray(project.employees)
    ? project.employees
        .map((emp) =>
          findEntity(employees, emp) ||
          findEntity(users, emp)
        )
        .filter(Boolean)
    : [];

  setProjectTeamMembers({
    tl,
    employees: employeeList,
  });
};

  const getTeamLeadDisplayName = (lead) => {
    if (!lead) return "";
    if (typeof lead === "string") return isUnknownEmployeeOrUser(lead) ? "" : lead;

    const direct =
      extractName(lead) ||
      extractName(lead.user) ||
      extractName(lead.teamLead) ||
      extractName(lead.employee) ||
      extractName(lead.person);

    if (direct && !isUnknownEmployeeOrUser(direct)) return direct;
    if (lead.user && typeof lead.user === "object") return getTeamLeadDisplayName(lead.user);
    if (lead.teamLead && typeof lead.teamLead === "object") return getTeamLeadDisplayName(lead.teamLead);
    if (lead.employee && typeof lead.employee === "object") return getTeamLeadDisplayName(lead.employee);
    if (lead.person && typeof lead.person === "object") return getTeamLeadDisplayName(lead.person);

    return "";
  };

  const getTeamLeadNameById = (value) => {
    if (!value) return "";
    if (typeof value === "object") return getTeamLeadDisplayName(value);

    const match = findEntity(teamLeadOptions, value) || findEntity(users, value) || findEntity(employees, value);
    if (match) return getTeamLeadDisplayName(match);

    const fallback = getUserNameById(value);
    return isUnknownEmployeeOrUser(fallback) ? "" : fallback;
  };

  const getProjectTeamLeadName = (project) => {
    if (!project) return "Not Assigned";
    
    if (project.teamLeadName && !isUnknownEmployeeOrUser(project.teamLeadName)) return project.teamLeadName;
    if (project.teamLeadUser) {
      const n = extractName(project.teamLeadUser);
      if (n && !isUnknownEmployeeOrUser(n)) return n;
    }
    if (project.teamLeadEmployee) {
      const n = extractName(project.teamLeadEmployee);
      if (n && !isUnknownEmployeeOrUser(n)) return n;
    }
    
    return "Not Assigned";
  };

  const getEmployeeName = (emp) => {
    if (!emp) return "";
    if (typeof emp === "string") return isUnknownEmployeeOrUser(emp) ? "" : emp;

    const direct = extractName(emp);
    if (direct && !isUnknownEmployeeOrUser(direct)) return direct;

    if (emp.employee) return getEmployeeName(emp.employee);
    if (emp.user) return getEmployeeName(emp.user);

    return ""; 
  };

  const getEmployeeNameById = (value) => {
    if (!value) return "";
    if (typeof value === "object") return getEmployeeName(value);

    const emp = findEntity(employees, value) || findEntity(users, value);
    if (emp) return getEmployeeName(emp);

    return "";
  };

  const getProjectAssignedMembers = (project) => {
    if (!project) return [];

    const members = [];
    const teamLead = findEntity(
      teamLeadOptions,
      project.teamLeadUser || project.teamLeadEmployee
    ) || project.teamLeadUser || project.teamLeadEmployee;

    if (teamLead) {
      members.push({ member: teamLead, role: "Team Lead" });
    }

    (Array.isArray(project.employees) ? project.employees : []).forEach((employee) => {
      const member = findEntity(employees, employee) || findEntity(users, employee) || employee;
      if (member) members.push({ member, role: "Employee" });
    });

    return members.filter(({ member }, index, allMembers) => {
      const memberId = normalizeId(member);
      return memberId && allMembers.findIndex(({ member: candidate }) => normalizeId(candidate) === memberId) === index;
    });
  };

  const getTaskAssignedMember = (task) => {
    const assignedId =
      task?.assignedTo ||
      task?.assignedEmployee ||
      task?.assignedTeamLeadUser ||
      task?.assignedTeamLeadEmployee;
    if (!assignedId) return null;

    const projectId = task?.projectId?._id || task?.projectId || task?.project?._id || task?.project;
    const project = findEntity(projects, projectId);
    const assignedMember = getProjectAssignedMembers(project).find(({ member }) =>
      isSameId(member, assignedId)
    );

    return assignedMember || {
      member: findEntity(users, assignedId) || findEntity(employees, assignedId) || assignedId,
      role: "Assigned Member",
    };
  };

  const getUpdateMemberId = (update) =>
    normalizeId(update?.userId || update?.user || update?.employeeId || update?.employee);

  const getUpdateMemberName = (update) => {
    const value = update?.userId || update?.user || update?.employee || update?.employeeId;
    if (value && typeof value === "object") return getUserName(value);

    const member = findEntity(users, value) || findEntity(employees, value) || findEntity(teamLeadOptions, value);
    return (member && getUserName(member)) || update?.employeeName || value || "Unknown User";
  };

  const handleReportMemberClick = async (taskId, member) => {
    const memberId = normalizeId(member);
    if (!memberId) return;

    setSelectedReportMemberByTask((prev) => ({ ...prev, [taskId]: memberId }));
    if (!taskUpdatesById[taskId]) {
      await fetchTaskUpdates(taskId);
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProjectForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "assignedTL" ? { assignedEmployees: [] } : {}),
    }));
  };
  const handleProjectDateChange = (e) => {
    const { name, value } = e.currentTarget;
    const previousValue = projectForm[name];

    if (value && !isValidProjectDate(value)) {
      e.currentTarget.value = previousValue;
      showToast("Enter a valid date using a four-digit year.", "error");
      return;
    }

    if (name === "endDate" && value && value < todayDate) {
      e.currentTarget.value = previousValue;
      showToast("End date must be today or later.", "error");
      return;
    }

    if (name === "endDate" && value && projectForm.startDate && value < projectForm.startDate) {
      e.currentTarget.value = previousValue;
      showToast("End date cannot be earlier than the start date.", "error");
      return;
    }

    setProjectForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "startDate" && value && prev.endDate && prev.endDate < value
        ? { endDate: value }
        : {}),
    }));
  };
  const handleProjectDateBlur = (e) => {
    const { name, value, validity } = e.currentTarget;
    if (validity.badInput || (value && !isValidProjectDate(value))) {
      e.currentTarget.value = projectForm[name];
      showToast("Enter a valid date using a four-digit year.", "error");
    }
  };

  const getProjectParticipants = (task) => {
    if (!task) return { empNames: "", tlName: "" };
    const projId =
      task?.projectId?._id || task?.projectId || task?.project?._id || task?.project || "";
    const project = findEntity(projects, projId) || null;

    const empNames = project ? getNamesByIds(employees, project.employees, "employee") : "";
    const tlName = project ? getTeamLeadNameById(project.teamLeadUser || project.teamLeadEmployee) : "";

    return { empNames, tlName };
  };
  const handleTaskChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "assignedEmployee") {
      setTaskForm({
        ...taskForm,
        assignedTo: value,
        assignedEmployee: value,
      });
    } else if (name === "status") {
      const autoProgress = getProgressForStatus(value);
      setTaskForm({
        ...taskForm,
        status: value,
        progress: autoProgress !== null ? autoProgress : taskForm.progress,
      });
    } else {
      setTaskForm({
        ...taskForm,
        [name]: value,
      });
    }
  };
  const closeTaskModal = () => {
    setShowTaskModal(false);
    setEditingTask(null);
    setIsSubmittingTask(false);
    setTaskForm({ ...defaultTaskForm });
  };

  const openAddTask = (projectId = null) => {
    if (!checkTaskActionCooldown(300)) return;
    setEditingTask(null);
    setIsSubmittingTask(false);
    const projId = projectId || selectedProject?._id || "";
    const proj = projects.find(p => isSameId(p._id || p.id, projId));

    setSelectedProject(proj || null);
    updateProjectTeamMembers(proj);
    
    setTaskForm({
      projectId: projId,
      taskTitle: "",
      description: "",
      assignedTeamLead: "",
      assignedTo: "",
      assignedEmployee: "",
      assignedBy: "",
      startDate: "",
      dueDate: "",
      priority: "medium",
      progress: 0,
      status: "pending",
    });

    setShowTaskModal(true);
  };

  const formatTaskDate = (dateVal) => {
    if (!dateVal) return "";
    const str = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    if (str.includes("T")) {
      const part = str.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
        return part;
      }
    }
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    } catch {}
    return str.split("T")[0] || "";
  };

  const openEditTask = async (task) => {
    if (!task) return;
    if (!checkTaskActionCooldown(300)) return;
    setIsSubmittingTask(false);

    // Prefer freshest task entity from tasks state if available
    const taskId = normalizeId(task._id || task.id);
    const existingInState = tasks.find((t) => isSameId(t._id || t.id, taskId));
    const sourceTask = existingInState ? { ...existingInState, ...task } : task;

    setEditingTask(sourceTask);

    const projId = normalizeId(
      sourceTask.projectId?._id ||
      sourceTask.projectId?.id ||
      sourceTask.projectId ||
      sourceTask.project?._id ||
      sourceTask.project?.id ||
      sourceTask.project
    );

    let proj = projects.find((p) => isSameId(p._id || p.id, projId));
    if (!proj && typeof sourceTask.projectId === "object" && sourceTask.projectId) {
      proj = sourceTask.projectId;
    } else if (!proj && typeof sourceTask.project === "object" && sourceTask.project) {
      proj = sourceTask.project;
    }

    setSelectedProject(proj || null);
    updateProjectTeamMembers(proj);

    // Only assign TL if sourceTask actually had a TL assigned (do NOT default to project TL)
    const assignedTL = normalizeId(
      sourceTask.assignedTeamLeadUser?._id ||
      sourceTask.assignedTeamLeadUser ||
      sourceTask.assignedTeamLeadEmployee?._id ||
      sourceTask.assignedTeamLeadEmployee ||
      sourceTask.assignedTeamLead?._id ||
      sourceTask.assignedTeamLead ||
      ""
    );

    // Only assign employee if sourceTask actually had an employee assigned
    const assignedEmp = normalizeId(
      sourceTask.assignedEmployee?._id ||
      sourceTask.assignedEmployee?.id ||
      sourceTask.assignedEmployee ||
      sourceTask.assignedTo?._id ||
      sourceTask.assignedTo?.id ||
      sourceTask.assignedTo ||
      sourceTask.employee?._id ||
      sourceTask.employee?.id ||
      sourceTask.employee ||
      sourceTask.assignedUser?._id ||
      sourceTask.assignedUser?.id ||
      sourceTask.assignedUser ||
      sourceTask.userId?._id ||
      sourceTask.userId?.id ||
      sourceTask.userId ||
      ""
    );

    const assignedByVal = normalizeId(
      sourceTask.assignedBy?._id ||
      sourceTask.assignedBy?.id ||
      sourceTask.assignedBy ||
      sourceTask.createdBy?._id ||
      sourceTask.createdBy?.id ||
      sourceTask.createdBy ||
      ""
    );

    const rawStatus = String(sourceTask.status || "pending").toLowerCase().trim();
    const normalizedStatus = normalizeTaskStatus(rawStatus);

    const rawStartDate =
      sourceTask.startDate ||
      sourceTask.taskStartDate ||
      sourceTask.start ||
      sourceTask.startingDate ||
      sourceTask.start_date ||
      "";

    const rawDueDate =
      sourceTask.dueDate ||
      sourceTask.deadline ||
      sourceTask.endDate ||
      sourceTask.taskDueDate ||
      sourceTask.due_date ||
      "";

    setTaskForm({
      projectId: projId || "",
      taskTitle: sourceTask.taskTitle || sourceTask.title || sourceTask.name || "",
      description: sourceTask.description || sourceTask.taskDescription || sourceTask.details || "",
      assignedTeamLead: assignedTL,
      assignedTo: assignedEmp,
      assignedEmployee: assignedEmp,
      assignedBy: assignedByVal,
      startDate: formatTaskDate(rawStartDate),
      dueDate: formatTaskDate(rawDueDate),
      priority: String(sourceTask.priority || "medium").toLowerCase(),
      progress: Number(sourceTask.progress != null ? sourceTask.progress : (getProgressForStatus(normalizedStatus) || 0)),
      status: normalizedStatus || "pending",
    });

    setShowTaskModal(true);

    // Asynchronous silent fetch to ensure all populated fields match backend GET /api/task/:id
    if (taskId) {
      try {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${TASK_URL}/${taskId}`, { headers });
        const fresh = res.data?.data || res.data?.task || res.data;
        if (fresh && typeof fresh === "object") {
          const freshProjId = normalizeId(
            fresh.projectId?._id || fresh.projectId?.id || fresh.projectId || fresh.project?._id || fresh.project
          );
          const freshEmpRaw =
            fresh.assignedEmployee?._id ||
            fresh.assignedEmployee?.id ||
            fresh.assignedEmployee ||
            fresh.assignedTo?._id ||
            fresh.assignedTo?.id ||
            fresh.assignedTo ||
            fresh.employee;
          const freshEmp = freshEmpRaw ? normalizeId(freshEmpRaw) : "";

          const freshTLRaw =
            fresh.assignedTeamLeadUser?._id ||
            fresh.assignedTeamLeadUser ||
            fresh.assignedTeamLeadEmployee?._id ||
            fresh.assignedTeamLeadEmployee ||
            fresh.assignedTeamLead;
          const freshTL = freshTLRaw ? normalizeId(freshTLRaw) : "";

          const freshBy = normalizeId(fresh.assignedBy?._id || fresh.assignedBy || fresh.createdBy);

          const freshStart =
            fresh.startDate ||
            fresh.taskStartDate ||
            fresh.start ||
            fresh.startingDate ||
            fresh.start_date;
          const freshDue =
            fresh.dueDate ||
            fresh.deadline ||
            fresh.endDate ||
            fresh.taskDueDate ||
            fresh.due_date;

          setTaskForm((prev) => ({
            ...prev,
            projectId: freshProjId || prev.projectId,
            taskTitle: fresh.taskTitle || fresh.title || prev.taskTitle,
            description: fresh.description || fresh.taskDescription || prev.description,
            assignedTeamLead: freshTL || prev.assignedTeamLead,
            assignedEmployee: freshEmp || prev.assignedEmployee,
            assignedTo: freshEmp || prev.assignedTo,
            assignedBy: freshBy || prev.assignedBy,
            startDate: freshStart ? formatTaskDate(freshStart) : prev.startDate,
            dueDate: freshDue ? formatTaskDate(freshDue) : prev.dueDate,
            priority: fresh.priority ? String(fresh.priority).toLowerCase() : prev.priority,
            progress: fresh.progress != null ? Number(fresh.progress) : prev.progress,
            status: fresh.status ? normalizeTaskStatus(fresh.status) : prev.status,
          }));
          setEditingTask((prev) => ({ ...prev, ...fresh }));
        }
      } catch {
        // Fallback already prefilled
      }
    }
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
    if (!expandedProjects[projectId]) {
      const project = projects.find(p => isSameId(p._id, projectId));
      if (project) {
        setSelectedProject(project);
        updateProjectTeamMembers(project);
        fetchTasks(projectId);
      }
    }
  };
  const addTask = async (e) => {
    e.preventDefault();

    if (isSubmittingTask) return;
    if (!checkTaskActionCooldown(300)) return;

    setIsSubmittingTask(true);
    try {
      const assignedEmployeeId = taskForm.assignedEmployee || taskForm.assignedTo;
      const taskProject = findEntity(
        projects,
        taskForm.projectId || selectedProject?._id || selectedProject?.id
      );
      const projectTeamLeadUserId = normalizeId(taskProject?.teamLeadUser);
      const projectTeamLeadEmployeeId = normalizeId(taskProject?.teamLeadEmployee);
      const assignedTLId = normalizeId(taskForm.assignedTeamLead);
      let assignedTeamLeadUserId =
        assignedTLId && isSameId(assignedTLId, projectTeamLeadUserId)
          ? projectTeamLeadUserId
          : null;
      let assignedTeamLeadEmployeeId =
        assignedTLId && isSameId(assignedTLId, projectTeamLeadEmployeeId)
          ? projectTeamLeadEmployeeId
          : null;

      if (assignedTLId && !assignedTeamLeadUserId && !assignedTeamLeadEmployeeId) {
        const u = findEntity(users, assignedTLId) || findEntity(rawUsers, assignedTLId);
        const e = findEntity(employees, assignedTLId);
        if (u) assignedTeamLeadUserId = normalizeId(u);
        else if (e) assignedTeamLeadEmployeeId = normalizeId(e);
        else assignedTeamLeadUserId = assignedTLId;
      }
      
      const assignedEmployee = users.find(user => 
        isSameId(user._id, assignedEmployeeId)
      ) || employees.find(emp => isSameId(emp._id, assignedEmployeeId));
      
      const payload = {
        projectId: taskForm.projectId || selectedProject?._id || selectedProject?.id || null,
        taskTitle: (taskForm.taskTitle || "").trim(),
        taskDescription: taskForm.description || "",
        description: taskForm.description || "",
        assignedTeamLead: assignedTLId || null,
        assignedTeamLeadUser: assignedTeamLeadUserId,
        assignedTeamLeadEmployee: assignedTeamLeadEmployeeId,
        assignedEmployee: assignedEmployeeId || null,
        assignedTo: assignedEmployeeId || null,
        assignedBy: taskForm.assignedBy || assignedEmployeeId || null,
        startDate: taskForm.startDate || null,
        dueDate: taskForm.dueDate || null,
        priority: taskForm.priority || "medium",
        progress: Number(taskForm.progress) || 0,
        status: taskForm.status || "pending",
        assignedEmployeeName: assignedEmployee ? getUserName(assignedEmployee) : (editingTask?.assignedEmployeeName || ""),
      };

      if (!payload.projectId) {
        showToast("Please select a project before saving a task.", "error");
        setIsSubmittingTask(false);
        return;
      }

      if (!assignedTeamLeadUserId && !assignedTeamLeadEmployeeId && !payload.assignedEmployee) {
        showToast("Please assign this task to a team lead or an employee.", "error");
        setIsSubmittingTask(false);
        return;
      }

      if (payload.assignedEmployee) {
        const allowedAssigneeIds = getAvailableTaskAssignees(taskProject, editingTask ? payload.assignedEmployee : null).map(normalizeId);
        if (!allowedAssigneeIds.includes(normalizeId(payload.assignedEmployee))) {
          showToast("Please assign this task to an employee assigned to the selected project.", "error");
          setIsSubmittingTask(false);
          return;
        }
      }

      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (editingTask?._id || editingTask?.id) {
        const taskId = editingTask._id || editingTask.id;
        try {
          await axios.put(`${TASK_PROJECT_MANAGE_URL}/update/${taskId}`, payload, { headers });
        } catch (err1) {
          try {
            await axios.put(`${TASK_URL}/update/${taskId}`, payload, { headers });
          } catch (err2) {
            try {
              await axios.put(`${TASK_PROJECT_MANAGE_URL}/${taskId}`, payload, { headers });
            } catch (err3) {
              await axios.put(`${TASK_URL}/${taskId}`, payload, { headers });
            }
          }
        }
        showToast("Task updated successfully!", "success");
      } else {
        try {
          await axios.post(`${TASK_URL}/create`, payload, { headers });
        } catch (err1) {
          console.warn("Primary create task failed, trying fallback:", err1.message);
          await axios.post(`${TASK_PROJECT_MANAGE_URL}/create`, payload, { headers });
        }
        showToast("Task created successfully!", "success");
      }

      const updatedTasks = await fetchTasks();
      if (selectedTaskDetails && editingTask && isSameId(selectedTaskDetails._id, editingTask._id)) {
        const fresh = updatedTasks.find(t => isSameId(t._id, editingTask._id));
        if (fresh) setSelectedTaskDetails(fresh);
      }
      
      closeTaskModal();
    } catch (error) {
      console.error("Task save error:", error);
      showToast(`Task ${editingTask ? "update" : "creation"} failed: ` + (error?.response?.data?.message || error?.message || "Unknown error"), "error");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      try {
        await axios.put(`${TASK_URL}/status/${taskId}`, { status: newStatus });
      } catch (e) {
        await axios.put(`${TASK_PROJECT_MANAGE_URL}/status/${taskId}`, { status: newStatus });
      }
      await fetchTasks(selectedProject?._id || null);
    } catch (error) {
      console.error("Failed to update status:", error);
      showToast("Failed to update status", "error");
    }
  };

  const handleDeleteTask = async (taskId) => {
    const confirmed = await confirm({
      title: "Delete task?",
      message: "Are you sure you want to delete this task?",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    try {
      try {
        await axios.delete(`${TASK_URL}/delete/${taskId}`);
      } catch (e) {
        await axios.delete(`${TASK_PROJECT_MANAGE_URL}/delete/${taskId}`);
      }
      await fetchTasks(selectedProject?._id || null);
      if (selectedTaskDetails && isSameId(selectedTaskDetails._id, taskId)) {
        setSelectedTaskDetails(null);
      }
      showToast("Task deleted successfully.", "success");
    } catch (error) {
      console.error("Failed to delete task:", error);
      showToast("Failed to delete task", "error");
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!projectId) return;
    const targetProject = projects.find((p) => isSameId(p._id || p.id, projectId));
    const confirmed = await confirm({
      title: "Delete Project?",
      message: `Are you sure you want to delete project "${targetProject?.projectName || "this project"}"? All associated tasks will be affected.`,
      confirmLabel: "Delete Project",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        await axios.delete(`${BASE_URL}/delete/${projectId}`, { headers });
      } catch (err1) {
        console.warn("Primary delete project failed, trying fallback:", err1.message);
        await axios.delete(`${BASE_URL}/${projectId}`, { headers });
      }

      if (isSameId(selectedProject?._id, projectId)) {
        setSelectedProject(null);
      }

      await fetchProjects();
      await fetchTasks();
      showToast("Project deleted successfully.", "success");
    } catch (error) {
      console.error("Failed to delete project:", error);
      const msg = error?.response?.data?.message || error?.message || "Failed to delete project";
      showToast(`Failed to delete project: ${msg}`, "error");
    }
  };

  // Open the SAME form used for creating a new project.
  // All project fields are loaded into the form so they can be edited.
  const openEditProject = (project) => {
    setSelectedProject(project);
    updateProjectTeamMembers(project);

    const empList = Array.isArray(project?.employees)
      ? project.employees.map(normalizeId).filter(Boolean)
      : project?.employees
        ? [normalizeId(project.employees)].filter(Boolean)
        : [];

    const tlId =
      normalizeId(project?.teamLeadUser || project?.teamLeadEmployee) || "";

    setProjectForm({
      projectName: project?.projectName || "",
      projectDescription: project?.projectDescription || "",
      clientName: project?.clientName || "",
      clientEmail: project?.clientEmail || "",
      projectBudget: project?.projectBudget ?? "",
      startDate: project?.startDate ? String(project.startDate).split("T")[0] : "",
      endDate: project?.endDate ? String(project.endDate).split("T")[0] : "",
      priority: project?.priority || "medium",
      status: project?.status || "pending",
      assignedEmployees: empList,
      assignedTL: tlId,
    });

    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    if (isProjectSubmitting) return;
    setShowProjectModal(false);
    setSelectedProject(null);
    setProjectForm({ ...defaultProjectForm });
  };

  const handleAddProject = async (e) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastProjectClickTimeRef.current < 300) {
      return;
    }
    lastProjectClickTimeRef.current = now;

    if (isProjectSubmitting) {
      return;
    }

    if (!projectForm.projectName.trim()) {
      showToast("Please enter project name.", "error");
      return;
    }

    if (!projectForm.clientName.trim()) {
      showToast("Please enter client name.", "error");
      return;
    }

    if (!projectForm.assignedTL) {
      showToast("Please select a team lead.", "error");
      return;
    }

    if (
      (projectForm.startDate && !isValidProjectDate(projectForm.startDate)) ||
      (projectForm.endDate && !isValidProjectDate(projectForm.endDate))
    ) {
      showToast("Enter valid project dates using a four-digit year.", "error");
      return;
    }

    if (projectForm.endDate && projectForm.endDate < todayDate) {
      showToast("End date must be today or later.", "error");
      return;
    }

    if (projectForm.startDate && projectForm.endDate && projectForm.endDate < projectForm.startDate) {
      showToast("End date cannot be earlier than the start date.", "error");
      return;
    }

    try {
      setIsProjectSubmitting(true);

      const payload = {
        projectName: projectForm.projectName.trim(),
        projectDescription: projectForm.projectDescription?.trim() || "",
        clientName: projectForm.clientName.trim(),
        clientEmail: projectForm.clientEmail?.trim() || "",
        projectBudget: Number(projectForm.projectBudget) || 0,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
        priority: projectForm.priority || "medium",
        status: projectForm.status || "pending",
        employees: Array.isArray(projectForm.assignedEmployees) ? projectForm.assignedEmployees : [],
        teamLeadUser: projectForm.assignedTL || null,
      };

      if (selectedProject?._id) {
        const id = selectedProject._id;

        // IMPORTANT: Edit uses one single PUT request with the complete
        // project payload, exactly like the New Project form.
        // Backend route expected: PUT /api/projectManage/project/:id
        await axios.put(`${BASE_URL}/${id}`, payload);

        showToast("Project updated successfully.", "success");
      } else {
        await axios.post(`${BASE_URL}/create`, payload);
        showToast("Project created successfully.", "success");
      }

      await fetchProjects();
      setProjectForm({ ...defaultProjectForm });
      setShowProjectModal(false);
      setSelectedProject(null);
      setProjectTeamMembers({
        tl: null,
        employees: [],
      });
    } catch (error) {
      console.error("Project save error:", error?.response?.data || error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Unable to save project.";

      showToast(`Project ${selectedProject ? "update" : "creation"} failed: ${message}`, "error");
    } finally {
      setIsProjectSubmitting(false);
    }
  };

  const getProjectTeamLeadOptions = (project = selectedProject) => {
    if (!project) return [];
    const candidates = [
      project.teamLeadUser,
      project.teamLeadEmployee,
      project.assignedTL,
      project.teamLead,
    ].filter(Boolean);

    if (Array.isArray(project.teamLeads)) {
      candidates.push(...project.teamLeads);
    }

    const uniqueTLs = [];
    const seenIds = new Set();
    const seenNames = new Set();

    candidates.forEach((cand) => {
      const id = normalizeId(cand);
      if (!id) return;
      const resolved =
        findEntity(teamLeadOptions, cand) ||
        findEntity(users, cand) ||
        findEntity(employees, cand) ||
        (typeof cand === "object" ? cand : null);

      const name =
        getTeamLeadNameById(cand) ||
        (resolved ? extractName(resolved) || getUserName(resolved) : null) ||
        getUserNameById(id) ||
        "Team Lead";

      if (!name || isUnknownEmployeeOrUser(name)) return;
      const lowerName = name.trim().toLowerCase();

      const candidateIds = getIdCandidates(cand);
      if (candidateIds.some((cid) => seenIds.has(cid)) || seenNames.has(lowerName)) {
        return;
      }

      candidateIds.forEach((cid) => seenIds.add(cid));
      seenIds.add(id);
      seenNames.add(lowerName);

      uniqueTLs.push({ id, name });
    });

    return uniqueTLs;
  };

  const getAvailableTaskAssignees = (project = selectedProject, extraAssigneeId = null) => {
    const projectEmployees = Array.isArray(project?.employees) ? [...project.employees] : [];
    if (extraAssigneeId) {
      const extraIdStr = normalizeId(extraAssigneeId);
      if (extraIdStr && !projectEmployees.some((e) => isSameId(e, extraIdStr))) {
        projectEmployees.push(extraAssigneeId);
      }
    }

    const resolved = [];
    projectEmployees.forEach((employee) => {
      const member =
        findEntity(employees, employee) ||
        findEntity(users, employee) ||
        (typeof employee === "object" ? employee : null);

      if (member) {
        resolved.push({ ...member, role: "Employee" });
      } else if (extraAssigneeId && isSameId(employee, extraAssigneeId)) {
        const fallbackName =
          editingTask?.assignedEmployeeName ||
          (typeof editingTask?.assignedEmployee === "object" ? extractName(editingTask.assignedEmployee) : null) ||
          (typeof editingTask?.assignedTo === "object" ? extractName(editingTask.assignedTo) : null) ||
          getUserNameById(extraAssigneeId) ||
          "Assigned Employee";
        resolved.push({ _id: normalizeId(extraAssigneeId), name: fallbackName, role: "Employee" });
      }
    });

    if (editingTask) {
      const editEmpId = normalizeId(editingTask.assignedEmployee || editingTask.assignedTo);
      if (editEmpId) {
        const fallbackName =
          editingTask.assignedEmployeeName ||
          (typeof editingTask.assignedEmployee === "object" ? extractName(editingTask.assignedEmployee) : null) ||
          (typeof editingTask.assignedTo === "object" ? extractName(editingTask.assignedTo) : null) ||
          getUserNameById(editEmpId) ||
          "Assigned Employee";
        resolved.push({ _id: editEmpId, name: fallbackName, role: "Employee" });
      }
    }

    // Strict deduplication by candidate IDs AND by user name
    const seenCandidates = new Set();
    const seenNames = new Set();
    const uniqueList = [];

    resolved.forEach((item) => {
      if (!item) return;
      const itemId = normalizeId(item);
      const name = (getUserName(item) || extractName(item) || "").trim();
      const lowerName = name.toLowerCase();
      const candidates = getIdCandidates(item);

      const hasDuplicateId = candidates.some((c) => seenCandidates.has(c));
      const hasDuplicateName = lowerName && !isUnknownEmployeeOrUser(name) && seenNames.has(lowerName);

      if (hasDuplicateId || hasDuplicateName) {
        if (extraAssigneeId && (candidates.includes(String(extraAssigneeId)) || isSameId(item, extraAssigneeId))) {
          const existing = uniqueList.find((u) => 
            (lowerName && (getUserName(u) || extractName(u) || "").trim().toLowerCase() === lowerName) ||
            getIdCandidates(u).some((cid) => candidates.includes(cid))
          );
          if (existing) {
            existing._matchedAssigneeId = String(extraAssigneeId);
          }
        }
        return; // Skip duplicate!
      }

      if (extraAssigneeId && (candidates.includes(String(extraAssigneeId)) || isSameId(item, extraAssigneeId))) {
        item._matchedAssigneeId = String(extraAssigneeId);
      }

      candidates.forEach((c) => seenCandidates.add(c));
      if (itemId) seenCandidates.add(itemId);
      if (lowerName && !isUnknownEmployeeOrUser(name)) seenNames.add(lowerName);

      uniqueList.push(item);
    });

    return uniqueList;
  };

  const getHrAndAdminUsers = () => {
    const pool = [...rawUsers, ...users, ...employees];

    try {
      const storedUser = localStorage.getItem("user") || localStorage.getItem("auth_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === "object") {
          pool.push(parsed);
        }
      }
    } catch {}

    const eligible = pool.filter((u) => {
      if (!u) return false;
      const role = String(u.role || u.userRole || u.roleType || "").trim().toLowerCase();
      const desig = String(u.designation?.designationName || u.designation?.name || u.designation || "").trim().toLowerCase();
      const name = String(u.name || u.fullName || u.userName || "").trim().toLowerCase();

      const isAdmin =
        role === "admin" ||
        role === "administrator" ||
        desig === "admin" ||
        desig === "administrator" ||
        name === "admin" ||
        name === "administrator";
      const isHR =
        role === "hr" ||
        role === "human resources" ||
        desig.includes("hr") ||
        desig.includes("human resources");
      const isTL =
        role === "team lead" ||
        role === "tl" ||
        role === "teamlead" ||
        role === "team_leader" ||
        role.includes("lead") ||
        desig.includes("team lead");
      const isManager =
        role === "manager" ||
        role === "project manager" ||
        desig.includes("manager");

      return isAdmin || isHR || isTL || isManager;
    });

    const seenCandidates = new Set();
    const seenNames = new Set();
    const result = [];

    eligible.forEach((u) => {
      const id = normalizeId(u);
      const name = (getUserName(u) || extractName(u) || "").trim();
      const lowerName = name.toLowerCase();
      const candidates = getIdCandidates(u);

      if (candidates.some((c) => seenCandidates.has(c)) || (lowerName && seenNames.has(lowerName))) {
        return;
      }

      candidates.forEach((c) => seenCandidates.add(c));
      if (id) seenCandidates.add(id);
      if (lowerName) seenNames.add(lowerName);

      const rawRole = String(u.role || u.userRole || "").trim();
      const cleanRole = /admin/i.test(rawRole) || /admin/i.test(name)
        ? "Admin"
        : /hr|human/i.test(rawRole)
          ? "HR"
          : /tl|lead/i.test(rawRole)
            ? "Team Lead"
            : rawRole || "Admin";

      result.push({
        _id: id,
        name: name || "Admin",
        role: cleanRole,
        ...u,
      });
    });

    if (!result.some((u) => /admin/i.test(u.role) || /admin/i.test(u.name))) {
      result.unshift({
        _id: "admin",
        name: "Administrator",
        role: "Admin",
      });
    }

    return result;
  };
 
  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-amber-50 text-amber-700 border-amber-200/80',
      'in-progress': 'bg-blue-50 text-blue-700 border-blue-200/80',
      'in_progress': 'bg-blue-50 text-blue-700 border-blue-200/80',
      'completed': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      'cancelled': 'bg-rose-50 text-rose-700 border-rose-200/80',
      'testing': 'bg-purple-50 text-purple-700 border-purple-200/80',
      'review': 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
    };
    return colors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getStatusDotColor = (status) => {
    const dots = {
      'pending': 'bg-amber-500',
      'in-progress': 'bg-blue-500',
      'in_progress': 'bg-blue-500',
      'completed': 'bg-emerald-500',
      'cancelled': 'bg-rose-500',
      'testing': 'bg-purple-500',
      'review': 'bg-indigo-500'
    };
    return dots[status] || 'bg-slate-400';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'medium': 'bg-amber-50 text-amber-700 border-amber-200',
      'high': 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return colors[priority] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getPriorityLeftBorder = (priority) => {
    if (priority === 'high') return 'border-l-4 border-l-rose-500';
    if (priority === 'medium') return 'border-l-4 border-l-amber-500';
    if (priority === 'low') return 'border-l-4 border-l-emerald-500';
    return 'border-l-4 border-l-slate-300';
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    if (status === 'in-progress' || status === 'in_progress') return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    if (status === 'cancelled') return <X className="w-4 h-4 text-rose-600" />;
    return <AlertCircle className="w-4 h-4 text-amber-600" />;
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  // Projects accessible to current user (strictly assigned projects for TL, all for Admin)
  const accessibleProjects = useMemo(() => {
    if (!isTL) return projects;
    return projects.filter((p) => isProjectAssignedToLead(p, userIdentifiers));
  }, [projects, isTL, userIdentifiers]);

  // Tasks accessible to current user (scoped to accessible projects or assigned to TL)
  const accessibleTasks = useMemo(() => {
    if (!isTL) return tasks;
    const accessibleProjectIds = new Set(accessibleProjects.map((p) => String(p._id || p.id)));
    return tasks.filter((t) => {
      const pId = String(typeof t.projectId === 'object' ? (t.projectId?._id || t.projectId?.id) : (t.projectId || ''));
      if (pId && accessibleProjectIds.has(pId)) return true;
      const aTL = String(typeof t.assignedTeamLead === 'object' ? (t.assignedTeamLead?._id || t.assignedTeamLead?.id) : (t.assignedTeamLead || ''));
      if (aTL && userIdentifiers.ids.has(aTL.toLowerCase())) return true;
      return false;
    });
  }, [tasks, accessibleProjects, isTL, userIdentifiers]);

  // Daily work reports accessible to current user (scoped to assigned projects for TL)
  const accessibleDailyReports = useMemo(() => {
    const list = dailyReports.filter((r) => !isUnknownEmployeeOrUser(r));
    if (!isTL) return list;
    const accessibleProjectNames = new Set(
      accessibleProjects.map((p) => (p.projectName || '').toLowerCase().trim()).filter(Boolean)
    );
    const accessibleProjectIds = new Set(
      accessibleProjects.map((p) => String(p._id || p.id).toLowerCase().trim()).filter(Boolean)
    );

    return dailyReports.filter((r) => {
      // 1. Report authored by current TL themselves
      const empId = String(r.employeeId?._id || r.employeeId?.id || (typeof r.employeeId === 'string' ? r.employeeId : '')).toLowerCase().trim();
      const empEmail = String(r.employeeId?.email || r.employeeEmail || '').toLowerCase().trim();
      if ((empId && userIdentifiers.ids.has(empId)) || (empEmail && userIdentifiers.emails.has(empEmail))) return true;

      // 2. Report linked to an accessible project
      const pId = String(r.projectId?._id || r.projectId?.id || (typeof r.projectId === 'string' ? r.projectId : '')).toLowerCase().trim();
      if (pId && accessibleProjectIds.has(pId)) return true;
      const pName = String(r.projectId?.projectName || r.projectId?.name || r.projectName || '').toLowerCase().trim();
      if (pName && accessibleProjectNames.has(pName)) return true;
      if (Array.isArray(r.taskReferences)) {
        const matchesTaskRef = r.taskReferences.some((ref) => {
          const refPId = String(ref?.projectId || '').toLowerCase().trim();
          return refPId && accessibleProjectIds.has(refPId);
        });
        if (matchesTaskRef) return true;
      }

      // 3. Report authored by team member in one of the TL's projects
      const isMember = accessibleProjects.some(p => 
        Array.isArray(p.employees) && p.employees.some(e => {
          const eId = String(e._id || e.id || e.userID || '').toLowerCase().trim();
          const eEmail = String(e.email || '').toLowerCase().trim();
          return (eId && empId && eId === empId) || (eEmail && empEmail && eEmail === empEmail);
        })
      );
      if (isMember) return true;

      return false;
    });
  }, [dailyReports, accessibleProjects, isTL, userIdentifiers]);

  // Filter projects by search query, status, and priority
  const filteredProjects = accessibleProjects.filter((project) => {
    const matchesSearch =
      !searchQuery.trim() ||
      (project.projectName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.clientName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (getProjectTeamLeadName(project) || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      accessibleTasks.some(
        (t) =>
          isSameId(t.projectId, project._id) &&
          (t.taskTitle || t.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus =
      statusFilter === "all" ||
      (project.status || "").toLowerCase() === statusFilter.toLowerCase();

    const matchesPriority =
      priorityFilter === "all" ||
      (project.priority || "").toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // KPI calculations
  const totalProjectsCount = accessibleProjects.length;
  const totalTasksCount = accessibleTasks.length;
  const completedTasksCount = accessibleTasks.filter((t) => (t.status || "").toLowerCase() === "completed").length;
  const inProgressTasksCount = accessibleTasks.filter(
    (t) =>
      (t.status || "").toLowerCase() === "in_progress" ||
      (t.status || "").toLowerCase() === "in-progress" ||
      (t.status || "").toLowerCase() === "testing" ||
      (t.status || "").toLowerCase() === "review"
  ).length;
  const overallProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const formatProjectDate = (dVal) => {
    if (!dVal) return "";
    try {
      const d = new Date(dVal);
      if (isNaN(d.getTime())) return String(dVal);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "";
    }
  };

  const formatReportDateTime = (dVal) => {
    if (!dVal) return { dateStr: "N/A", timeStr: "" };
    try {
      const d = new Date(dVal);
      if (isNaN(d.getTime())) return { dateStr: String(dVal), timeStr: "" };
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
      return { dateStr, timeStr };
    } catch {
      return { dateStr: "N/A", timeStr: "" };
    }
  };

  return (
    <div className="w-full space-y-5 font-poppins">
      {confirmationDialog}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Task Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Organize projects, assign tasks to members and track daily progress
          </p>
        </div>

        {activeMainTab === 'projects' && (
          <button
            type="button"
            onClick={() => {
              setSelectedProject(null);
              setProjectForm({
                ...defaultProjectForm,
                assignedTL: isTL ? normalizeId(user) : "",
              });
              setShowProjectModal(true);
            }}
            className="text-white px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm cursor-pointer hover:opacity-95 shrink-0 self-start sm:self-auto"
            style={{ background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeMainTab === 'projects'
                ? 'text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:text-slate-900'
            }`}
            style={
              activeMainTab === 'projects'
                ? { background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }
                : undefined
            }
          >
            Project & Tasks ({totalProjectsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('daily-reports')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeMainTab === 'daily-reports'
                ? 'text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:text-slate-900'
            }`}
            style={
              activeMainTab === 'daily-reports'
                ? { background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }
                : undefined
            }
          >
            Daily Work Reports ({accessibleDailyReports.length})
          </button>
        </div>

        {activeMainTab === 'daily-reports' && (
          <button
            type="button"
            onClick={fetchAllDailyReports}
            disabled={isDailyReportsLoading}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all text-xs sm:text-sm font-medium flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isDailyReportsLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        )}
      </div>

      {activeMainTab === 'projects' && (
        <>
          {/* KPI Metrics Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
            {[
              { label: "Total Projects", value: totalProjectsCount },
              { label: "Team Tasks", value: totalTasksCount },
              { label: "In Progress", value: inProgressTasksCount },
              { label: "Completed", value: completedTasksCount }
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative flex items-center h-[60px] w-full"
              >
                {/* Left card for the border: width: 16; height: 60; border-top-left-radius: 10px; border-bottom-left-radius: 10px; */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                  style={{ background: "#034665", opacity: 1 }}
                />
                {/* Inner card: height: 60; border-radius: 10px; border-width: 0.2px; */}
                <div
                  className="relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                  style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
                >
                  <p className="text-[12px] sm:text-[13px] font-medium text-[#718096] font-poppins select-none">
                    {item.label}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by employee name, email or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#034665] focus:border-[#034665]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Status Filter */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="testing">Testing</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-xs sm:text-sm font-medium text-slate-500 mr-1">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setPriorityFilter("all");
                  }}
                  className="text-xs font-medium text-[#034665] hover:underline px-2 py-1 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Project List */}
        {loading ? (
          <LoadingScreen message="Loading projects and tasks..." />
        ) : (
          <div className="space-y-4">
            {filteredProjects.length > 0 ? (
              sortByNewest(filteredProjects).map((project) => {
                const isExpanded = expandedProjects[project._id] || false;
                const projectTasks = tasks.filter((t) => isSameId(t.projectId, project._id));
                const completedCount = projectTasks.filter((t) => (t.status || "").toLowerCase() === "completed").length;
                const getTaskProgressVal = (t) => {
                  const s = normalizeTaskStatus(t.status);
                  if (typeof t.progress === 'number' && !isNaN(t.progress) && t.progress > 0) {
                    if (s === 'completed') return 100;
                    if (s === 'cancelled') return 0;
                    return Math.min(100, Math.max(0, t.progress));
                  }
                  const autoProgress = getProgressForStatus(t.status);
                  if (autoProgress !== null) return autoProgress;
                  return 0;
                };
                const validProjectTasks = projectTasks.filter(t => (t.status || '').toLowerCase() !== 'cancelled');
                const projectPercent = (project.status || '').toLowerCase() === 'completed'
                  ? 100
                  : validProjectTasks.length > 0
                    ? Math.round(validProjectTasks.reduce((sum, t) => sum + getTaskProgressVal(t), 0) / validProjectTasks.length)
                    : (typeof project.progress === 'number' && !isNaN(project.progress) ? project.progress : 0);

                return (
                  <div
                    key={project._id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all duration-200 overflow-hidden"
                  >
                    {/* Project Header Card */}
                    <div
                      className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                      onClick={() => toggleProject(project._id)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Left Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <button
                              type="button"
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                              )}
                            </button>

                            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#034665] font-bold text-xs shrink-0">
                              <Box className="w-4 h-4 text-[#034665]" />
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                              {project.projectName}
                            </h3>

                            {/* Status Badge */}
                            <span
                              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize"
                            >
                              {project.status || "Pending"}
                            </span>

                            {/* Priority Badge */}
                            {project.priority && (
                              <span
                                className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 capitalize"
                              >
                                {project.priority}
                              </span>
                            )}
                          </div>

                          {/* Metadata Row */}
                          <div className="mt-2.5 sm:ml-10 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500">
                            {project.clientName && (
                              <span className="inline-flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>Client: <strong className="text-slate-700 font-semibold">{project.clientName}</strong></span>
                              </span>
                            )}

                            {getProjectTeamLeadName(project) && (
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>TL: <strong className="text-slate-700 font-semibold">{getProjectTeamLeadName(project)}</strong></span>
                              </span>
                            )}

                            {project.projectBudget && (
                              <span className="inline-flex items-center gap-1">
                                <span>Budget: <strong className="text-slate-700 font-semibold">₹{project.projectBudget}</strong></span>
                              </span>
                            )}

                            {(project.startDate || project.createdAt) && (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatProjectDate(project.startDate || project.createdAt)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions and Progress */}
                        <div className="flex flex-col items-end gap-2 shrink-0 sm:ml-10 lg:ml-0">
                          
                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddTask(project._id);
                              }}
                              className="px-3.5 py-1.5 text-white rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer hover:opacity-95"
                              style={{ background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Task</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditProject(project);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                              title="Edit Project"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project._id);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Progress Bar & Counter */}
                          <div className="flex flex-col items-end w-36 sm:w-44">
                            <div className="text-[11px] text-slate-500 font-medium">
                              {completedCount} / {projectTasks.length} Tasks ({projectPercent}%)
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${projectPercent}%`,
                                  backgroundColor: '#068DCB'
                                }}
                              />
                            </div>
                          </div>

                        </div>

                      </div>
                    </div>

                    {/* Expanded Project View - Tasks List */}
                    {isExpanded && (
                      <div className="border-t border-slate-200/80 bg-[#FAFBFD] p-4 sm:p-5 space-y-3">
                        
                        {/* Section Header */}
                        <div className="flex items-center gap-2">
                          <ListTodo className="w-4 h-4 text-slate-700" />
                          <h4 className="font-bold text-slate-800 text-sm">
                            Project Tasks
                          </h4>
                        </div>

                        {/* Task Cards */}
                        {projectTasks.length > 0 ? (
                          <div className="space-y-3">
                            {sortTasksByNewest(projectTasks).map((task) => {
                              const p = getProjectParticipants(task);
                              const assignedMember = getTaskAssignedMember(task);
                              const selectedReportMemberId = selectedReportMemberByTask[task._id];
                              const taskReports = (taskUpdatesById[task._id] || []).filter((update) =>
                                !selectedReportMemberId || getUpdateMemberId(update) === selectedReportMemberId
                              );

                              return (
                                <div
                                  key={task._id}
                                  className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5"
                                >
                                  {/* Task Top Row */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="font-bold text-slate-900 text-sm">
                                        {task.taskTitle || task.title || "Untitled Task"}
                                      </h5>
                                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 uppercase">
                                        {task.priority || "Medium"}
                                      </span>
                                    </div>

                                    {/* Task Status & Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      <select
                                        value={task.status || "pending"}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleStatusChange(task._id, e.target.value)}
                                        className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 bg-white font-medium focus:outline-none cursor-pointer"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="testing">Testing</option>
                                        <option value="review">Review</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (assignedMember) {
                                            handleReportMemberClick(task._id, assignedMember.member);
                                          } else {
                                            fetchTaskUpdates(task._id);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-[#034665] transition-colors cursor-pointer"
                                        title="View Daily Updates"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditTask(task);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                                        title="Edit Task"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task._id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                        title="Delete Task"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Assigned Details & Due Date */}
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                    {assignedMember && (
                                      <span className="inline-flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{getUserName(assignedMember.member)} <span className="text-slate-400">({assignedMember.role})</span></span>
                                      </span>
                                    )}

                                    {p.tlName && (
                                      <span className="inline-flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span>TL: {p.tlName}</span>
                                      </span>
                                    )}

                                    {task.dueDate && (
                                      <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Due: {formatProjectDate(task.dueDate)}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Daily Reports Box */}
                                  <div className="pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mb-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Daily Reports</span>
                                    </div>

                                    {loadingTaskUpdates[task._id] ? (
                                      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#034665]" />
                                        <span>Loading reports...</span>
                                      </div>
                                    ) : taskReports.length > 0 ? (
                                      <div className="space-y-2 mt-2">
                                        {taskReports.map((update) => (
                                          <div
                                            key={update._id || update.id}
                                            className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 text-xs"
                                          >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                              <span className="font-semibold text-slate-800">
                                                {getUpdateMemberName(update)}
                                              </span>
                                              <span className="text-[10px] text-slate-400">
                                                {update.createdAt ? new Date(update.createdAt).toLocaleDateString() : ""}
                                              </span>
                                            </div>
                                            <p className="text-slate-600">
                                              {update.todaysWork || update.workUpdate || update.updateText || update.message || update.description}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400">
                                        No daily reports submitted yet for this Task.
                                      </p>
                                    )}
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                            <p className="text-xs sm:text-sm text-slate-500">No tasks created yet for this project.</p>
                            <button
                              type="button"
                              onClick={() => openAddTask(project._id, null)}
                              className="mt-2 text-xs text-[#034665] font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add first task
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                    ? "No Matching Projects Found"
                    : isTL
                      ? "No Assigned Projects"
                      : "No Projects Yet"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mb-4 max-w-md mx-auto">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your search query or reset your status/priority filters."
                    : isTL
                      ? "You do not have any projects assigned to you as Team Lead yet. Projects assigned to you will automatically appear here."
                      : "Get started by creating your first project workspace and adding tasks."}
                </p>
                {searchQuery || statusFilter !== "all" || priorityFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject(null);
                      setProjectForm(defaultProjectForm);
                      setShowProjectModal(true);
                    }}
                    className="text-white px-5 py-2.5 rounded-xl shadow-md transition-all text-xs font-semibold inline-flex items-center gap-1.5 mx-auto cursor-pointer"
                    style={{ background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Project</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
          </>
        )}

        {/* DAILY WORK REPORTS SECTION (API: DAILY_UPDATE_URL) */}
        {activeMainTab === 'daily-reports' && (
          <div className="space-y-5">
            {/* KPI Metrics Dashboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
              {[
                { label: "Total Reports", value: accessibleDailyReports.length },
                { label: "Total Hours Logged", value: accessibleDailyReports.reduce((acc, r) => acc + (Number(r.hoursWorked) || 0), 0) },
                { label: "Staff Reporting", value: new Set(accessibleDailyReports.map(r => r.employeeId?._id || r.employeeId?.email || r.employeeId).filter(Boolean)).size },
                { label: "Active Submissions", value: accessibleDailyReports.filter(r => r.todaysWork || r.workUpdate).length }
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
                    <p className="text-[12px] sm:text-[13px] font-medium text-[#718096] font-poppins select-none">
                      {item.label}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by employee name, email or department..."
                  value={dailySearchQuery}
                  onChange={(e) => setDailySearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#034665] focus:border-[#034665]"
                />
                {dailySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDailySearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Project Filter */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                  <select
                    value={dailyProjectFilter}
                    onChange={(e) => setDailyProjectFilter(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    {Array.from(new Set(accessibleDailyReports.map(r => r.projectId?.projectName || r.projectId?.name || r.projectName || r.remarks || 'Other').filter(Boolean))).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Priority / Employee Filter */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs sm:text-sm font-medium text-slate-500 mr-1">Priority:</span>
                  <select
                    value={dailyEmployeeFilter}
                    onChange={(e) => setDailyEmployeeFilter(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All</option>
                    {Array.from(new Set(accessibleDailyReports.map(r => r.employeeId?.name || r.employeeName || (typeof r.employeeId === 'string' ? r.employeeId : '')).filter(Boolean))).map((emp) => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>

                {(dailySearchQuery || dailyProjectFilter !== "all" || dailyEmployeeFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setDailySearchQuery("");
                      setDailyProjectFilter("all");
                      setDailyEmployeeFilter("all");
                    }}
                    className="text-xs font-medium text-[#034665] hover:underline px-2 py-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Daily Reports Table */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200/80">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-800">Processed Monthly Payroll Records</h3>
              </div>

              {isDailyReportsLoading ? (
                <div className="flex flex-col justify-center items-center py-16">
                  <Loader2 className="w-8 h-8 text-[#034665] animate-spin mb-3" />
                  <p className="text-xs sm:text-sm font-medium text-slate-500">Loading daily reports...</p>
                </div>
              ) : (() => {
                const q = dailySearchQuery.toLowerCase().trim();
                const filtered = accessibleDailyReports.filter((report) => {
                  const empName = (report.employeeId?.name || report.employeeName || report.name || '').toLowerCase();
                  const empEmail = (report.employeeId?.email || report.email || '').toLowerCase();
                  const projName = (report.projectId?.projectName || report.projectId?.name || report.projectName || report.remarks || 'Other').toLowerCase();
                  const work = (report.todaysWork || report.workUpdate || report.description || '').toLowerCase();
                  const tomorrow = (report.tomorrowPlan || report.tomorrow_plan || '').toLowerCase();

                  const matchesQuery = !q || empName.includes(q) || empEmail.includes(q) || projName.includes(q) || work.includes(q) || tomorrow.includes(q);
                  const rawProj = report.projectId?.projectName || report.projectId?.name || report.projectName || report.remarks || 'Other';
                  const matchesProject = dailyProjectFilter === 'all' || rawProj === dailyProjectFilter;
                  const rawEmp = report.employeeId?.name || report.employeeName || (typeof report.employeeId === 'string' ? report.employeeId : '');
                  const matchesEmp = dailyEmployeeFilter === 'all' || rawEmp === dailyEmployeeFilter;

                  return matchesQuery && matchesProject && matchesEmp;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-slate-800 mb-1">
                        {dailySearchQuery || dailyProjectFilter !== 'all' || dailyEmployeeFilter !== 'all'
                          ? "No Matching Daily Reports Found"
                          : "No Daily Reports Submitted Yet"}
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {dailySearchQuery || dailyProjectFilter !== 'all' || dailyEmployeeFilter !== 'all'
                          ? "Try adjusting your search criteria or clearing filters."
                          : "Reports submitted via employee & TL daily report portals will automatically appear here."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm min-w-[950px]">
                      <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 text-xs font-medium">
                        <tr>
                          <th className="px-5 py-3.5">Employee</th>
                          <th className="px-4 py-3.5">Project</th>
                          <th className="px-4 py-3.5">Date & Time</th>
                          <th className="px-3 py-3.5">Hours</th>
                          <th className="px-5 py-3.5 w-1/4">Today's Work</th>
                          <th className="px-5 py-3.5 w-1/4">Tomorrow's Plan</th>
                          <th className="px-4 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((report) => {
                          const empName = report.employeeId?.name || report.employeeName || report.name || "Employee";
                          const empEmail = report.employeeId?.email || report.email || "";
                          const empRole = report.employeeId?.role || report.role || "";
                          const isEmpTL = isTeamLeadRole(empRole) || (empRole || '').toLowerCase().includes('lead');
                          const projName = report.projectId?.projectName || report.projectId?.name || report.projectName || report.remarks || "Digital marketing";
                          
                          const { dateStr, timeStr } = formatReportDateTime(report.createdAt || report.date || report.reportDate);
                          const hours = report.hoursWorked ?? report.hours ?? 8;
                          const work = report.todaysWork || report.workUpdate || report.description || "—";
                          const plan = report.tomorrowPlan || report.tomorrow_plan || "—";
                          const issues = report.issuesFaced || report.blockers || "";

                          const initials = empName
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "E";

                          return (
                            <tr key={report._id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-[#034665] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-slate-900 truncate">
                                        {empName}
                                      </span>
                                      {isEmpTL ? (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                                          Team lead
                                        </span>
                                      ) : null}
                                    </div>
                                    {empEmail && (
                                      <p className="text-[11px] text-slate-400 truncate">
                                        {empEmail}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200 inline-block">
                                  {projName}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                                <div className="font-medium text-slate-800">Date: {dateStr}</div>
                                {timeStr && <div className="text-[11px] text-slate-400">Time: {timeStr}</div>}
                              </td>

                              <td className="px-3 py-3.5 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                  {hours} Hours
                                </span>
                              </td>

                              <td className="px-5 py-3.5 max-w-xs text-slate-700">
                                <p className="line-clamp-2 text-xs leading-relaxed" title={work}>
                                  {work}
                                </p>
                                {issues && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                    Issue solved
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3.5 max-w-xs text-slate-700">
                                <p className="line-clamp-2 text-xs leading-relaxed" title={plan}>
                                  {plan}
                                </p>
                              </td>

                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDailyReportModal(report)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      {/* Project Modal - SAME FORM for Create + Edit */}
      {showProjectModal && (
        <div
          className="team-drawer-backdrop fixed inset-0 z-[10000] bg-slate-950/40 backdrop-blur-[2px]"
          onClick={closeProjectModal}
        >
          <div
            className="team-drawer-panel ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 justify-between items-center px-5 sm:px-7 py-4 border-b border-slate-200 bg-white">
              <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <span className="text-slate-900">
                {selectedProject ? "Edit Project" : "Create New Project"}
                </span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">Set up the project, timeline, and assigned team.</p>
              </div>
              <button
                type="button"
                onClick={closeProjectModal}
                disabled={isProjectSubmitting}
                aria-label="Close project form"
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg p-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProject} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {/* Project Name + Client Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    name="projectName"
                    placeholder="Enter project name"
                    value={projectForm.projectName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    name="clientName"
                    placeholder="Enter client name"
                    value={projectForm.clientName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Email
                  </label>
                  <input
                    name="clientEmail"
                    type="email"
                    placeholder="client@example.com"
                    value={projectForm.clientEmail}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Budget
                  </label>
                  <input
                    name="projectBudget"
                    type="number"
                    min="0"
                    placeholder="Enter budget"
                    value={projectForm.projectBudget}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={projectForm.startDate}
                    max="9999-12-31"
                    onChange={handleProjectDateChange}
                    onBlur={handleProjectDateBlur}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    min={projectForm.startDate && projectForm.startDate > todayDate
                      ? projectForm.startDate
                      : todayDate}
                    max="9999-12-31"
                    value={projectForm.endDate}
                    onChange={handleProjectDateChange}
                    onBlur={handleProjectDateBlur}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Description
                </label>
                <textarea
                  name="projectDescription"
                  placeholder="Describe the project..."
                  value={projectForm.projectDescription}
                  onChange={handleChange}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              </div>

              {/* Priority + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={projectForm.priority}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={projectForm.status}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="testing">Testing</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Team Assignment */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Project Team</h3>
                  {selectedProject && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                      Editing existing project
                    </span>
                  )}
                </div>

                {(() => {
                  // Compute options for TL and Employees with proper deduplication

                  // 1. Team Leads
                  const tlMap = new Map();
                  const seenTLEmails = new Set();
                  const seenTLNames = new Set();

                  if (teamLeadOptions.length > 0) {
                    teamLeadOptions.forEach((lead) => {
                      const id = String(lead.value || lead._id || lead.id || "");
                      if (!id) return;
                      const name = lead.name || "Team Lead";
                      const email = String(lead.email || "").toLowerCase().trim();
                      if (email) seenTLEmails.add(email);
                      seenTLNames.add(name.toLowerCase().trim());
                      if (!tlMap.has(id)) {
                        tlMap.set(id, { id, name });
                      }
                    });
                  }

                  users.forEach((user) => {
                    const role = String(user.role || user.userRole || "").trim().toLowerCase();
                    if (role === "team lead" || role === "tl" || role === "teamlead") {
                      const id = normalizeId(user);
                      if (!id) return;
                      const name = getUserName(user) || "Team Lead";
                      const email = String(user.email || "").toLowerCase().trim();
                      if ((email && seenTLEmails.has(email)) || seenTLNames.has(name.toLowerCase().trim())) {
                        return;
                      }
                      if (email) seenTLEmails.add(email);
                      seenTLNames.add(name.toLowerCase().trim());
                      if (!tlMap.has(id)) {
                        tlMap.set(id, { id, name });
                      }
                    }
                  });
                  const allTLs = Array.from(tlMap.values()).sort((a, b) => a.name.localeCompare(b.name));

                  // 2. Employees (prefer Employee record with Designation over plain User email)
                  const empMap = new Map();
                  const seenEmpEmails = new Set();
                  const seenEmpNames = new Set();

                  employees.forEach((emp) => {
                    if (isFinanceOrExcludedUser(emp) || isHrRoleOrUser(emp) || !isStrictEmployeeRole(emp)) return;
                    const id = normalizeId(emp);
                    if (!id) return;
                    const name = getEmployeeName(emp) || "Employee";
                    const email = String(emp.email || emp.user?.email || "").toLowerCase().trim();
                    const designation = emp.designation || emp.jobTitle || emp.role || "";
                    if (email) seenEmpEmails.add(email);
                    seenEmpNames.add(name.toLowerCase().trim());
                    if (!empMap.has(id)) {
                      empMap.set(id, {
                        id,
                        name,
                        subText: designation || email || "Employee",
                      });
                    }
                  });

                  users.forEach((user) => {
                    if (isFinanceOrExcludedUser(user) || isHrRoleOrUser(user) || !isStrictEmployeeRole(user)) return;
                    const role = String(user.role || user.userRole || "").trim().toLowerCase();
                    if (role === "employee" || role === "staff") {
                      const id = normalizeId(user);
                      if (!id) return;
                      const name = getUserName(user) || "Employee";
                      const email = String(user.email || "").toLowerCase().trim();
                      if ((email && seenEmpEmails.has(email)) || seenEmpNames.has(name.toLowerCase().trim())) {
                        return;
                      }
                      if (email) seenEmpEmails.add(email);
                      seenEmpNames.add(name.toLowerCase().trim());
                      if (!empMap.has(id)) {
                        empMap.set(id, {
                          id,
                          name,
                          subText: user.email || "Employee",
                        });
                      }
                    }
                  });
                  const allEmps = Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                  const selectedTeamLead = teamLeadOptions.find((lead) =>
                    isSameId(lead.value, projectForm.assignedTL)
                  );
                  const assignedLeadEmployees = selectedTeamLead?.employees || [];
                  const teamLeadEmployees = allEmps.filter((employee) =>
                    assignedLeadEmployees.some((assignedEmployee) => {
                      const matchedEmployee =
                        findEntity(employees, assignedEmployee) ||
                        findEntity(users, assignedEmployee) ||
                        assignedEmployee;
                      return isSameId(employee.id, matchedEmployee);
                    })
                  );

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Team Lead */}
                      <div>
                        <div className="flex items-center justify-between mb-1 min-h-[22px]">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-gray-500" />
                            Team Lead *
                          </label>
                        </div>
                        <select
                          name="assignedTL"
                          value={projectForm.assignedTL}
                          onChange={handleChange}
                          className="w-full h-[42px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm text-sm"
                          required
                        >
                          <option value="">Select Team Lead</option>
                          {allTLs.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Multiple Employees */}
                      <div className="md:col-span-1">
                        <MultiSelectDropdown
                          label="Employees"
                          icon={User}
                          placeholder={projectForm.assignedTL ? "Select Employees..." : "Select Team Lead first..."}
                          options={teamLeadEmployees}
                          selectedValues={projectForm.assignedEmployees || []}
                          onChange={(newValues) =>
                            setProjectForm((prev) => ({
                              ...prev,
                              assignedEmployees: newValues,
                            }))
                          }
                        />
                      </div>

                    </div>
                  );
                })()}
              </div>

              </div>

              {/* Buttons */}
              <div className="flex shrink-0 flex-col-reverse sm:flex-row gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <button
                  type="button"
                  disabled={isProjectSubmitting}
                  onClick={closeProjectModal}
                  className="w-full sm:flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  Cancel
                </button>

                {selectedProject && (
                  <button
                    type="button"
                    disabled={isProjectSubmitting}
                    onClick={() => {
                      if (isProjectSubmitting) return;
                      const idToDelete = selectedProject._id;
                      closeProjectModal();
                      handleDeleteProject(idToDelete);
                    }}
                    className="w-full sm:w-auto px-4 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    Delete Project
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isProjectSubmitting}
                  className="w-full sm:flex-1 text-white py-3 rounded-lg font-semibold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }}
                >
                  {isProjectSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>{selectedProject ? "Updating Project..." : "Creating Project..."}</span>
                    </>
                  ) : (
                    <span>{selectedProject ? "Update Project" : "Create Project"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Task Modal */}
      {showTaskModal && (
        <div
          className="team-drawer-backdrop fixed inset-0 z-[10000] bg-slate-950/40 backdrop-blur-[2px]"
          onClick={closeTaskModal}
        >
          <div
            className="team-drawer-panel ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={addTask} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <ListTodo className="w-5 h-5 text-emerald-600" />
                    {editingTask ? "Edit Task" : "Create Task"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingTask
                      ? "Update task details, assignment, schedule, and progress."
                      : "Choose a project, assign ownership, and set the deadline."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTaskModal}
                  aria-label="Close task form"
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {selectedProject && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Project team</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                      {projectTeamMembers.tl && (
                        <span className="rounded-md border border-blue-200 bg-white px-2.5 py-1">Lead: {getUserName(projectTeamMembers.tl)}</span>
                      )}
                      {projectTeamMembers.employees.map((employee) => (
                        <span key={normalizeId(employee)} className="rounded-md border border-blue-200 bg-white px-2.5 py-1">Employee: {getUserName(employee)}</span>
                      ))}
                    </div>
                  </div>
                )}

                <section className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Task details</h3>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                  <select
                    name="projectId"
                    value={taskForm.projectId || ""}
                    onChange={(e) => { 
                      const projectId = e.target.value;
                      const project = accessibleProjects.find(
                        (p) => isSameId(p._id || p.id, projectId)
                      ) || projects.find((p) => isSameId(p._id || p.id, projectId));
                      setSelectedProject(project || null);
                      updateProjectTeamMembers(project);
                      setTaskForm((prev) => ({
                        ...prev,
                        projectId: project?._id || project?.id || projectId || "",
                        assignedTeamLead: "",
                        assignedTo: "",
                        assignedEmployee: "",
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Project</option>
                    {accessibleProjects.map((project) => (
                      <option key={project._id || project.id} value={project._id || project.id}>
                        {project.projectName || project.name}
                      </option>
                    ))}
                    {taskForm.projectId && !accessibleProjects.some((p) => isSameId(p._id || p.id, taskForm.projectId)) && (
                      <option value={taskForm.projectId}>
                        {selectedProject?.projectName || (typeof editingTask?.projectId === "object" ? editingTask.projectId?.projectName : null) || "Assigned Project"}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                  <input
                    name="taskTitle"
                    placeholder="Enter task title"
                    value={taskForm.taskTitle}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    placeholder="Describe the task..."
                    value={taskForm.description}
                    onChange={handleTaskChange}
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                </section>

                <section className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Assignment</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Employees are limited to the selected project team.</p>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Team Lead</label>
                  <select
                    name="assignedTeamLead"
                    value={taskForm.assignedTeamLead || ""}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">
                      {!taskForm.projectId
                        ? "Select a project first"
                        : getProjectTeamLeadOptions(selectedProject).length === 0
                          ? "No Team Lead assigned to this project"
                          : "Select Team Lead"}
                    </option>
                    {getProjectTeamLeadOptions(selectedProject).map((tl) => (
                      <option key={tl.id} value={tl.id}>
                        {tl.name}
                      </option>
                    ))}
                    {taskForm.assignedTeamLead && 
                      !getProjectTeamLeadOptions(selectedProject).some((tl) => isSameId(tl.id, taskForm.assignedTeamLead)) && (
                      <option value={taskForm.assignedTeamLead}>
                        {getTeamLeadNameById(taskForm.assignedTeamLead) || "Assigned Team Lead"}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Employee</label>
                  <select
                    name="assignedEmployee"
                    value={taskForm.assignedEmployee || ""}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">
                      {!taskForm.projectId
                        ? "Select a project first"
                        : getAvailableTaskAssignees(selectedProject, taskForm.assignedEmployee).length === 0
                          ? "No employees assigned to this project"
                          : "Select Employee"}
                    </option>
                    {getAvailableTaskAssignees(selectedProject, taskForm.assignedEmployee).map((member) => {
                      const memberId = normalizeId(member);
                      const isMatch =
                        taskForm.assignedEmployee &&
                        (member._matchedAssigneeId === String(taskForm.assignedEmployee) ||
                          isSameId(member, taskForm.assignedEmployee) ||
                          getIdCandidates(member).includes(String(taskForm.assignedEmployee)));
                      const optValue = isMatch ? taskForm.assignedEmployee : memberId;
                      return (
                        <option key={optValue} value={optValue}>
                          {getUserName(member)}
                        </option>
                      );
                    })}
                    {taskForm.assignedEmployee &&
                      !getAvailableTaskAssignees(selectedProject, taskForm.assignedEmployee).some(
                        (m) =>
                          m._matchedAssigneeId === String(taskForm.assignedEmployee) ||
                          isSameId(m, taskForm.assignedEmployee) ||
                          getIdCandidates(m).includes(String(taskForm.assignedEmployee))
                      ) && (
                        <option value={taskForm.assignedEmployee}>
                          {editingTask?.assignedEmployeeName ||
                            (typeof editingTask?.assignedEmployee === "object"
                              ? extractName(editingTask.assignedEmployee)
                              : null) ||
                            getUserNameById(taskForm.assignedEmployee) ||
                            "Assigned Employee"}
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned By (Admin / HR / TL)</label>
                  <select
                    name="assignedBy"
                    value={taskForm.assignedBy || ""}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Assigner</option>
                    {getHrAndAdminUsers().map((user) => (
                      <option key={normalizeId(user) || user._id || user.id} value={normalizeId(user) || user._id || user.id}>
                        {getUserName(user)} ({user.role || "Admin"})
                      </option>
                    ))}
                    {taskForm.assignedBy && !getHrAndAdminUsers().some((u) => isSameId(u, taskForm.assignedBy)) && (
                      <option value={taskForm.assignedBy}>
                        {getUserNameById(taskForm.assignedBy) || "Assigned By"}
                      </option>
                    )}
                    {getHrAndAdminUsers().length === 0 && !taskForm.assignedBy && (
                      <option value="">No Admin/HR/TL users available</option>
                    )}
                  </select>
                </div>
                </section>

                <section className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900">Schedule and progress</h3>
                  </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={taskForm.startDate || ""}
                      onChange={handleTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={taskForm.dueDate || ""}
                      onChange={handleTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      name="priority"
                      value={taskForm.priority}
                      onChange={handleTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Progress (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      name="progress"
                      value={taskForm.progress}
                      onChange={handleTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={taskForm.status}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="delayed">Delayed</option>
                    <option value="testing">Testing</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                </section>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={isSubmittingTask}
                  onClick={closeTaskModal}
                  className="w-full sm:flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="w-full sm:flex-1 rounded-lg text-white py-3 font-semibold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(100.88deg, #034665 -11.43%, #068DCB 85.83%)' }}
                >
                  {isSubmittingTask && <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>
                    {isSubmittingTask
                      ? (editingTask ? "Updating Task..." : "Creating Task...")
                      : (editingTask ? "Update Task" : "Create Task")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    
      {/* Task Full Details Modal */}
      {selectedTaskDetails && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedTaskDetails(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    Task Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Full overview, assigned team & daily progress
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskDetails(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {(() => {
                const modalProject = projects.find(
                  (p) => String(p._id) === String(selectedTaskDetails.projectId || selectedTaskDetails.project?._id || selectedTaskDetails.project)
                );
                const modalParticipants = getProjectParticipants(selectedTaskDetails);
                const modalAssigned = getTaskAssignedMember(selectedTaskDetails);
                const modalUpdates = (taskUpdatesById[selectedTaskDetails._id] || []);

                return (
                  <>
                    {/* Title & Badges */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${getPriorityColor(
                            selectedTaskDetails.priority
                          )}`}
                        >
                          {selectedTaskDetails.priority || "NORMAL"} PRIORITY
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(
                            selectedTaskDetails.status
                          )}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${getStatusDotColor(selectedTaskDetails.status)}`} />
                          {selectedTaskDetails.status || "pending"}
                        </span>

                        {typeof selectedTaskDetails.progress === "number" && (
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {selectedTaskDetails.progress}% Progress
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                        {selectedTaskDetails.taskTitle || selectedTaskDetails.title || "Untitled Task"}
                      </h2>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Project
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {modalProject?.projectName || "Direct Project"}
                          </span>
                        </div>
                        {modalProject?.clientName && (
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Client: {modalProject.clientName}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Assigned Member
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(getUserName(modalAssigned?.member) || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-800 block truncate">
                              {getUserName(modalAssigned?.member) || "Unassigned"}
                            </span>
                            {modalAssigned?.role && (
                              <span className="text-[10px] text-slate-500 font-medium capitalize">
                                Role: {modalAssigned.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Team Lead
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 text-sm font-medium text-slate-700">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>{modalParticipants?.tlName || getProjectTeamLeadName(modalProject) || "N/A"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Due Date
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 text-sm font-medium text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>
                            {selectedTaskDetails.dueDate
                              ? new Date(selectedTaskDetails.dueDate).toLocaleDateString()
                              : "Not specified"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Description
                      </h4>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                        {selectedTaskDetails.description || "No detailed description provided for this task."}
                      </div>
                    </div>

                    {/* Daily Updates Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                          Daily Reports ({modalUpdates.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => fetchTaskUpdates(selectedTaskDetails._id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Refresh Updates
                        </button>
                      </div>

                      {loadingTaskUpdates[selectedTaskDetails._id] ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-6 bg-slate-50 rounded-xl border border-slate-100">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          Loading task reports...
                        </div>
                      ) : modalUpdates.length > 0 ? (
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {modalUpdates.map((update) => (
                            <div
                              key={update._id || update.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-bold">
                                    {(getUpdateMemberName(update) || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800">
                                    {getUpdateMemberName(update)}
                                  </span>
                                  {update.hoursWorked ? (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                                      {update.hoursWorked} hrs logged
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {update.createdAt ? new Date(update.createdAt).toLocaleString() : "No date"}
                                </span>
                              </div>
                              <div className="space-y-1.5 mt-1 text-xs">
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  <span className="font-bold text-slate-800">Today's Work: </span>
                                  {update.todaysWork || update.workUpdate || update.updateText || update.message || update.description || "No report details provided."}
                                </p>
                                {update.pendingWork && (
                                  <p className="text-amber-800 bg-amber-50/70 border border-amber-200/70 p-2 rounded-lg">
                                    <span className="font-bold">Pending: </span>{update.pendingWork}
                                  </p>
                                )}
                                {update.tomorrowPlan && (
                                  <p className="text-indigo-800 bg-indigo-50/70 border border-indigo-200/70 p-2 rounded-lg">
                                    <span className="font-bold">Tomorrow's Plan: </span>{update.tomorrowPlan}
                                  </p>
                                )}
                                {update.issuesFaced && (
                                  <p className="text-rose-800 bg-rose-50/70 border border-rose-200/70 p-2 rounded-lg">
                                    <span className="font-bold">Issues: </span>{update.issuesFaced}
                                  </p>
                                )}
                              </div>
                              {typeof update.progress === "number" && (
                                <div className="flex items-center gap-2 pt-1">
                                  <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full ${getProgressColor(update.progress)}`}
                                      style={{ width: `${Math.max(0, Math.min(100, update.progress))}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600">{update.progress}%</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                          No daily updates submitted yet for this task.
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const taskToEdit = selectedTaskDetails;
                    setSelectedTaskDetails(null);
                    openEditTask(taskToEdit);
                  }}
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                  Edit Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const taskIdToDelete = selectedTaskDetails._id || selectedTaskDetails.id;
                    setSelectedTaskDetails(null);
                    handleDeleteTask(taskIdToDelete);
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  Delete Task
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-xs text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Work Report Details Modal */}
      {selectedDailyReportModal && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDailyReportModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Daily Work Report Details</h3>
                  <p className="text-[11px] text-slate-300">
                    {selectedDailyReportModal.createdAt
                      ? new Date(selectedDailyReportModal.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Report Information'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDailyReportModal(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Employee & Project row */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(selectedDailyReportModal.employeeId?.name || selectedDailyReportModal.employeeName || selectedDailyReportModal.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {selectedDailyReportModal.employeeId?.name || selectedDailyReportModal.employeeName || selectedDailyReportModal.name || (selectedDailyReportModal.employeeId?.email ? selectedDailyReportModal.employeeId.email.split('@')[0] : 'User')}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {selectedDailyReportModal.employeeId?.email || selectedDailyReportModal.email || ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project</span>
                  <p className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg mt-1 w-fit truncate max-w-full">
                    {selectedDailyReportModal.projectId?.projectName || selectedDailyReportModal.projectId?.name || selectedDailyReportModal.projectName || selectedDailyReportModal.remarks || 'Other'}
                  </p>
                </div>
              </div>

              {/* Hours & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Hours Logged
                  </span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">
                    {selectedDailyReportModal.hoursWorked ?? selectedDailyReportModal.hours ?? 8} hrs
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Submission Date
                  </span>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    {selectedDailyReportModal.createdAt
                      ? new Date(selectedDailyReportModal.createdAt).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Work Accomplished */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Work Summary</span>
                <div className="mt-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedDailyReportModal.todaysWork || selectedDailyReportModal.workUpdate || selectedDailyReportModal.description || 'No work summary provided.'}
                </div>
              </div>

              {/* Pending Work */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Work</span>
                <div className="mt-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedDailyReportModal.pendingWork || 'None logged.'}
                </div>
              </div>

              {/* Tomorrow's Plan */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tomorrow's Plan</span>
                <div className="mt-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedDailyReportModal.tomorrowPlan || selectedDailyReportModal.tomorrow_plan || 'None logged.'}
                </div>
              </div>

              {/* Issues Faced */}
              {selectedDailyReportModal.issuesFaced && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Issues / Blockers Faced
                  </span>
                  <div className="mt-1.5 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
                    {selectedDailyReportModal.issuesFaced}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDailyReportModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}