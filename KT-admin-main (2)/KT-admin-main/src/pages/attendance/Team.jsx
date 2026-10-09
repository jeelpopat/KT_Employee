import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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
  MessageSquare,
  Check,
  Search,
  Filter,
  Sparkles,
  DollarSign,
  Layers
} from "lucide-react";
import { useConfirm } from "../../components/common/ConfirmDialog";
import { isFinanceOrExcludedUser, filterOutFinanceUsers } from "../../utils/roleFilters";

const BASE_URL =
  "https://kt-backend-yzr4.onrender.com/api/projectManage/project";

const API_CORE = BASE_URL.replace(/\/project$/, "");

const EMPLOYEE_URL = 
  "https://kt-backend-yzr4.onrender.com/api/employee/list"; 

const USER_URL =
  "https://kt-backend-yzr4.onrender.com/api/users/all";

const TASK_URL =
  "https://kt-backend-yzr4.onrender.com/api/task";

const TASK_PROJECT_MANAGE_URL =
  "https://kt-backend-yzr4.onrender.com/api/projectManage/task";

const TEAM_LEAD_URL =
  "https://kt-backend-yzr4.onrender.com/api/teamLead/team";

const DAILY_UPDATE_URL =
  "https://kt-backend-yzr4.onrender.com/api/dailyUpdate/list";

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
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [users, setUsers] = useState([]);
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
  
const [projectTeamMembers, setProjectTeamMembers] = useState({
  tl: null,
  employees: [],
});

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

  const [taskForm, setTaskForm] = useState({
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
  });

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    fetchUsers();
    fetchTeamLeadOptions();
    fetchTasks();
  }, []);

  // Function to fetch daily updates for a task using https://kt-backend-yzr4.onrender.com/api/dailyUpdate/list
  const fetchTaskUpdates = async (taskId) => {
    if (!taskId) return;

    setLoadingTaskUpdates((prev) => ({ ...prev, [taskId]: true }));

    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

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

      const targetTask = tasks.find((t) => String(t._id || t.id) === String(taskId));
      const targetTitle = (targetTask?.taskTitle || targetTask?.title || "").trim().toLowerCase();

      const matchedReports = rawList.filter((item) => {
        if (!item) return false;
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

        const directTaskId = String(
          item.taskId?._id || item.taskId?.id || item.taskId || item.task?._id || item.task || ""
        );
        if (directTaskId && directTaskId === String(taskId)) return true;

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
      setEmployees(filterOutFinanceUsers(list));
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
      setUsers(filterOutFinanceUsers(list));
    } catch (error) {
      console.error("Users fetch error:", error);
      setUsers([]);
    }
  };

  const fetchTeamLeadOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : {};

      const res = await axios.get(TEAM_LEAD_URL, { headers });
      const payload = res?.data?.data || res?.data?.teamLeads || res?.data?.teamLead || res?.data || [];
      const teamLeadsData = Array.isArray(payload) ? payload : [];

      const normalizedOptions = teamLeadsData
        .map((lead) => {
          const teamLeadRecord = lead?.teamLead || lead?.lead || lead?.user || lead?.employee || null;
          if (lead && isFinanceOrExcludedUser(lead)) return null;
          if (teamLeadRecord && isFinanceOrExcludedUser(teamLeadRecord)) return null;

          const employees = (teamLeadRecord?.employees || lead?.employees || teamLeadRecord?.teamMembers || []).filter((e) => !isFinanceOrExcludedUser(e));

          const leadId =
            teamLeadRecord?.userId ||
            teamLeadRecord?.employeeId ||
            teamLeadRecord?._id ||
            teamLeadRecord?.id ||
            lead?.teamLeadId ||
            lead?.teamLead?._id ||
            lead?.teamLead?.id ||
            lead?.teamLead?.userId ||
            lead?.teamLead?.employeeId ||
            lead?.user?._id ||
            lead?.user?.id ||
            lead?._id ||
            lead?.id ||
            null;

          const name =
            teamLeadRecord?.name ||
            teamLeadRecord?.fullName ||
            teamLeadRecord?.displayName ||
            lead?.name ||
            lead?.fullName ||
            lead?.displayName ||
            lead?.user?.name ||
            lead?.user?.fullName ||
            lead?.user?.displayName ||
            [teamLeadRecord?.firstName, teamLeadRecord?.lastName].filter(Boolean).join(" ") ||
            [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") ||
            [lead?.user?.firstName, lead?.user?.lastName].filter(Boolean).join(" ") ||
            "";

          if (
            !leadId ||
            !name ||
            name === "Unnamed" ||
            name === "No Name" ||
            name === "Unknown Employee" ||
            name === "Unknown User" ||
            name === "N/A" ||
            name === "Team Lead"
          ) {
            return null;
          }

          return {
            _id: String(leadId),
            value: String(leadId),
            name: name,
            employees: Array.isArray(employees) ? employees : [],
          };
        })
        .filter(Boolean);

      setTeamLeadOptions(normalizedOptions);
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

  const fetchProjects = async () => {
    try {
      setLoading(true);
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
      setProjects([]);
    } finally {
      setLoading(false);
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
    if (typeof lead === "string") return lead;

    const direct =
      extractName(lead) ||
      extractName(lead.user) ||
      extractName(lead.teamLead) ||
      extractName(lead.employee) ||
      extractName(lead.person);

    if (direct) return direct;
    if (lead.user && typeof lead.user === "object") return getTeamLeadDisplayName(lead.user);
    if (lead.teamLead && typeof lead.teamLead === "object") return getTeamLeadDisplayName(lead.teamLead);
    if (lead.employee && typeof lead.employee === "object") return getTeamLeadDisplayName(lead.employee);
    if (lead.person && typeof lead.person === "object") return getTeamLeadDisplayName(lead.person);

    return "Team Lead";
  };

  const getTeamLeadNameById = (value) => {
    if (!value) return "";
    if (typeof value === "object") return getTeamLeadDisplayName(value);

    const match = findEntity(teamLeadOptions, value) || findEntity(users, value) || findEntity(employees, value);
    if (match) return getTeamLeadDisplayName(match);

    return getUserNameById(value);
  };

  const getProjectTeamLeadName = (project) => {
    if (!project) return "Not Assigned";
    
    if (project.teamLeadName) return project.teamLeadName;
    if (project.teamLeadUser) return extractName(project.teamLeadUser);
    if (project.teamLeadEmployee) return extractName(project.teamLeadEmployee);
    
    return "Not Assigned";
  };

  const getEmployeeName = (emp) => {
    if (!emp) return "";
    if (typeof emp === "string") return emp;

    const direct = extractName(emp);
    if (direct) return direct;

    if (emp.employee) return getEmployeeName(emp.employee);
    if (emp.user) return getEmployeeName(emp.user);

    return "Unknown"; 
  };

  const getEmployeeNameById = (value) => {
    if (!value) return "";
    if (typeof value === "object") return getEmployeeName(value);

    const emp = findEntity(employees, value) || findEntity(users, value);
    if (emp) return getEmployeeName(emp);

    return value;
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
    } else {
      setTaskForm({
        ...taskForm,
        [name]: value,
      });
    }
  };
  const openAddTask = (projectId = null) => {
    const projId = projectId || selectedProject?._id || "";
    const proj = projects.find(p => isSameId(p._id || p.id, projId));
    const assignedTeamLead = normalizeId(
      proj?.teamLeadUser || proj?.teamLeadEmployee
    );

    setSelectedProject(proj || null);
    updateProjectTeamMembers(proj);
    
    setTaskForm({
      projectId: projId,
      taskTitle: "",
      description: "",
      assignedTeamLead,
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

    try {
      const assignedEmployeeId = taskForm.assignedEmployee || taskForm.assignedTo;
      const taskProject = findEntity(
        projects,
        taskForm.projectId || selectedProject?._id || selectedProject?.id
      );
      const projectTeamLeadUserId = normalizeId(taskProject?.teamLeadUser);
      const projectTeamLeadEmployeeId = normalizeId(taskProject?.teamLeadEmployee);
      const assignedTeamLeadUserId =
        taskForm.assignedTeamLead &&
        isSameId(taskForm.assignedTeamLead, projectTeamLeadUserId)
          ? projectTeamLeadUserId
          : null;
      const assignedTeamLeadEmployeeId =
        taskForm.assignedTeamLead &&
        isSameId(taskForm.assignedTeamLead, projectTeamLeadEmployeeId)
          ? projectTeamLeadEmployeeId
          : null;
      
      const assignedEmployee = users.find(user => 
        isSameId(user._id, assignedEmployeeId)
      ) || employees.find(emp => isSameId(emp._id, assignedEmployeeId));
      
      const payload = {
        projectId: taskForm.projectId || selectedProject?._id || selectedProject?.id || null,
        taskTitle: (taskForm.taskTitle || "").trim(),
        taskDescription: taskForm.description || "",
        description: taskForm.description || "",
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
        assignedEmployeeName: assignedEmployee ? getUserName(assignedEmployee) : "",
      };

      if (!payload.projectId) {
        alert("Please select a project before adding a task.");
        return;
      }

      if (!assignedTeamLeadUserId && !assignedTeamLeadEmployeeId && !payload.assignedEmployee) {
        alert("Please assign this task to a team lead or an employee.");
        return;
      }

      if (payload.assignedEmployee) {
        const allowedAssigneeIds = getAvailableTaskAssignees(taskProject).map(normalizeId);
        if (!allowedAssigneeIds.includes(normalizeId(payload.assignedEmployee))) {
          alert("Please assign this task to an employee assigned to the selected project.");
          return;
        }
      }

      try {
        await axios.post(`${TASK_URL}/create`, payload);
      } catch (err1) {
        console.warn("Primary create task failed, trying fallback:", err1.message);
        await axios.post(`${TASK_PROJECT_MANAGE_URL}/create`, payload);
      }

      await fetchTasks();
      
      setShowTaskModal(false);
      setTaskForm({
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
      });
      alert("Task created successfully!");
    } catch (error) {
      console.error("Task create error:", error);
      alert("Task creation failed: " + (error?.response?.data?.message || error?.message || "Unknown error"));
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
      alert("Failed to update status");
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
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete task");
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
    setShowProjectModal(false);
    setSelectedProject(null);
    setProjectForm({ ...defaultProjectForm });
  };

  const handleAddProject = async (e) => {
    e.preventDefault();

    try {
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

      if (!projectForm.projectName.trim()) {
        alert("Please enter project name.");
        return;
      }

      if (!projectForm.clientName.trim()) {
        alert("Please enter client name.");
        return;
      }

      if (!projectForm.assignedTL) {
        alert("Please select a team lead.");
        return;
      }

      if (selectedProject?._id) {
        const id = selectedProject._id;

        // IMPORTANT: Edit uses one single PUT request with the complete
        // project payload, exactly like the New Project form.
        // Backend route expected: PUT /api/projectManage/project/:id
        await axios.put(`${BASE_URL}/${id}`, payload);

        alert("Project updated successfully.");
      } else {
        await axios.post(`${BASE_URL}/create`, payload);
        alert("Project created successfully.");
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

      alert(`Project ${selectedProject ? "update" : "creation"} failed: ${message}`);
    }
  };

  const getAvailableTaskAssignees = (project = selectedProject) => {
    const projectEmployees = Array.isArray(project?.employees) ? project.employees : [];

    return projectEmployees
      .map((employee) => {
        const member =
          findEntity(employees, employee) ||
          findEntity(users, employee) ||
          (typeof employee === "object" ? employee : null);
        return member ? { ...member, role: "Employee" } : null;
      })
      .filter((employee, index, allEmployees) => {
        if (!employee) return false;
        const employeeId = normalizeId(employee);
        return (
          employeeId &&
          allEmployees.findIndex((candidate) => normalizeId(candidate) === employeeId) === index
        );
      });
  };

  const getHrAndAdminUsers = () => {
    return users.filter(user => {
      const role = String(user.role || user.userRole || "").trim().toLowerCase();
      return role === 'hr' || role === 'admin' || role === 'human resources';
    });
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

  // Filter projects by search query, status, and priority
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      !searchQuery.trim() ||
      (project.projectName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.clientName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (getProjectTeamLeadName(project) || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      tasks.some(
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
  const totalProjectsCount = projects.length;
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => (t.status || "").toLowerCase() === "completed").length;
  const inProgressTasksCount = tasks.filter(
    (t) =>
      (t.status || "").toLowerCase() === "in_progress" ||
      (t.status || "").toLowerCase() === "in-progress" ||
      (t.status || "").toLowerCase() === "testing" ||
      (t.status || "").toLowerCase() === "review"
  ).length;
  const overallProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      {confirmationDialog}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Action Bar */}
        <div className="flex items-center justify-end -mt-1 sm:-mt-2 mb-1">
          <button
            onClick={() => {
              setSelectedProject(null);
              setProjectForm(defaultProjectForm);
              setShowProjectModal(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* KPI Metrics Dashboard Cards (Compact) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Projects */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Projects
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FolderOpen className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                {totalProjectsCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Workspaces</span>
            </div>
          </div>

          {/* Card 2: Total Tasks */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Tasks
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ListTodo className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                {totalTasksCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Assigned</span>
            </div>
          </div>

          {/* Card 3: In Progress */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                In Progress
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                {inProgressTasksCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Active</span>
            </div>
          </div>

          {/* Card 4: Completed Tasks */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Completed
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                {completedTasksCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">({overallProgress}% Done)</span>
            </div>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by project name, client, TL, or task title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Project List */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 bg-white rounded-2xl border border-slate-200/80">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm font-medium text-slate-500">Loading projects and tasks...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProjects.length > 0 ? (
              sortByNewest(filteredProjects).map((project) => {
                const isExpanded = expandedProjects[project._id] || false;
                const projectTasks = tasks.filter((t) => isSameId(t.projectId, project._id));
                const completedCount = projectTasks.filter((t) => (t.status || "").toLowerCase() === "completed").length;
                const projectPercent = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

                return (
                  <div
                    key={project._id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.07)] hover:border-slate-300/80 transition-all duration-200 overflow-hidden"
                  >
                    {/* Project Header Card */}
                    <div
                      className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50/60 transition-colors duration-150 select-none"
                      onClick={() => toggleProject(project._id)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Left Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <button
                              type="button"
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                              )}
                            </button>

                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                              {(project.projectName || "P").charAt(0).toUpperCase()}
                            </div>

                            <h3 className="text-lg sm:text-xl font-bold text-slate-800 truncate">
                              {project.projectName}
                            </h3>

                            {/* Status Badge with Dot */}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(
                                project.status
                              )}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(project.status)}`} />
                              {project.status || "pending"}
                            </span>

                            {/* Priority Badge */}
                            {project.priority && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border uppercase tracking-wider ${getPriorityColor(
                                  project.priority
                                )}`}
                              >
                                {project.priority}
                              </span>
                            )}
                          </div>

                          {/* Metadata Row */}
                          <div className="mt-3 sm:ml-10 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600">
                            {project.clientName && (
                              <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-500">Client:</span>
                                <span className="font-semibold text-slate-800">{project.clientName}</span>
                              </span>
                            )}

                            {getProjectTeamLeadName(project) && (
                              <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg">
                                <Users className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-slate-500">TL:</span>
                                <span className="font-semibold text-slate-800">{getProjectTeamLeadName(project)}</span>
                              </span>
                            )}

                            {project.projectBudget && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200/80 text-emerald-700 px-2.5 py-1 rounded-lg font-semibold text-xs">
                                <DollarSign className="w-3.5 h-3.5" />
                                Budget: Rs. {project.projectBudget}
                              </span>
                            )}

                            {project.startDate && (
                              <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(project.startDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Progress & Action Buttons */}
                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap justify-between lg:justify-end sm:ml-10 lg:ml-0">
                          
                          {/* Mini Progress Widget */}
                          <div className="flex flex-col items-end min-w-[120px]">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <ListTodo className="w-3.5 h-3.5 text-slate-400" />
                              <span>{completedCount} / {projectTasks.length} Tasks</span>
                              <span className="font-bold text-slate-800">({projectPercent}%)</span>
                            </div>
                            <div className="w-28 sm:w-32 bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(projectPercent)}`}
                                style={{ width: `${projectPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddTask(project._id);
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Task
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditProject(project);
                              }}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              Edit
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Expanded Project View - Tasks List */}
                    {isExpanded && (
                      <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 sm:p-6">
                        
                        {/* Section Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <ListTodo className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                              Project Tasks
                            </h4>
                            <span className="text-xs bg-slate-200/80 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                              {projectTasks.length}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openAddTask(project._id, null)}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Task
                          </button>
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
                                  onClick={() => {
                                    setSelectedTaskDetails(task);
                                    fetchTaskUpdates(task._id);
                                  }}
                                  className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4 cursor-pointer group ${getPriorityLeftBorder(
                                    task.priority
                                  )}`}
                                >
                                  {/* Task Top Row */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getPriorityColor(
                                            task.priority
                                          )}`}
                                        >
                                          {task.priority || "NORMAL"}
                                        </span>
                                        <h5 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                                          {task.taskTitle || task.title || "Untitled Task"}
                                        </h5>
                                      </div>

                                      {task.description && (
                                        <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2">
                                          {task.description}
                                        </p>
                                      )}

                                      {/* Assigned Details & Due Date */}
                                      <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-slate-600">
                                        {assignedMember && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReportMemberClick(task._id, assignedMember.member);
                                            }}
                                            className="inline-flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 text-blue-700 px-2.5 py-1 rounded-lg font-medium transition-colors"
                                            title={`View ${assignedMember.role} daily reports`}
                                          >
                                            <div className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold">
                                              {(getUserName(assignedMember.member) || "U").charAt(0).toUpperCase()}
                                            </div>
                                            <span>{getUserName(assignedMember.member)}</span>
                                            <span className="text-[10px] opacity-75">({assignedMember.role})</span>
                                          </button>
                                        )}

                                        {p.tlName && (
                                          <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-slate-600 font-medium">
                                            <Users className="w-3 h-3 text-slate-400" />
                                            <span>TL: {p.tlName}</span>
                                          </span>
                                        )}

                                        {task.dueDate && (
                                          <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            Due: {new Date(task.dueDate).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Task Status & Actions */}
                                    <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                                      <select
                                        value={task.status || "pending"} onClick={(e) => e.stopPropagation()} onChange={(e) => handleStatusChange(task._id, e.target.value)}
                                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold focus:outline-none cursor-pointer transition-colors shadow-sm ${getStatusColor(
                                          task.status || "pending"
                                        )}`}
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
                                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 p-1.5 rounded-lg transition-colors"
                                        title="View Daily Updates"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task._id); }}
                                        className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 p-1.5 rounded-lg transition-colors"
                                        title="Delete Task"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Daily Reports Box */}
                                  <div className="mt-3.5 border-t border-slate-100 pt-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <h6 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                        Daily Reports
                                      </h6>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          fetchTaskUpdates(task._id);
                                        }}
                                        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                                      >
                                        Refresh
                                      </button>
                                    </div>

                                    {loadingTaskUpdates[task._id] ? (
                                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                        Loading reports...
                                      </div>
                                    ) : taskReports.length > 0 ? (
                                      <div className="space-y-2">
                                        {taskReports.map((update) => (
                                          <div
                                            key={update._id || update.id}
                                            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                                          >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                                  {(getUpdateMemberName(update) || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-800">
                                                  {getUpdateMemberName(update)}
                                                </span>
                                              </div>
                                              <span className="text-[10px] text-slate-400 font-medium">
                                                {update.createdAt ? new Date(update.createdAt).toLocaleString() : "No date"}
                                              </span>
                                            </div>
                                            <p className="text-xs text-slate-600">
                                              {update.updateText || update.message || update.description || "No report details provided."}
                                            </p>
                                            {typeof update.progress === "number" && (
                                              <div className="mt-2 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                                  <div
                                                    className={`h-1.5 rounded-full ${getProgressColor(update.progress)}`}
                                                    style={{ width: `${Math.max(0, Math.min(100, update.progress))}%` }}
                                                  />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-700">{update.progress}%</span>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 py-1">
                                        {selectedReportMemberId
                                          ? "No daily reports for this assigned member yet."
                                          : "Click the assigned member name to view daily reports."}
                                      </p>
                                    )}
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                            <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-700">No tasks created yet</p>
                            <p className="text-xs text-slate-400 mt-0.5 mb-3">Add tasks to track progress and assign team members</p>
                            <button
                              type="button"
                              onClick={() => openAddTask(project._id, null)}
                              className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-xl font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              Create first task
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
                    : "No Projects Yet"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mb-4 max-w-md mx-auto">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try adjusting your search query or reset your status/priority filters."
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
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-xs font-semibold inline-flex items-center gap-1.5 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Create Project
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

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
                aria-label="Close project form"
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg p-2 transition-colors"
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
                    onChange={handleChange}
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
                    value={projectForm.endDate}
                    onChange={handleChange}
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
                    <option value="in-progress">In Progress</option>
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
                      <div>
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
                  onClick={closeProjectModal}
                  className="w-full sm:w-1/3 border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg font-semibold transition-all duration-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {selectedProject ? "Update Project" : "Create Project"}
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
          onClick={() => setShowTaskModal(false)}
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
                    Create Task
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Choose a project, assign ownership, and set the deadline.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  aria-label="Close task form"
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
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
                      const project = projects.find(
                        (p) => isSameId(p._id || p.id, projectId)
                      );
                      setSelectedProject(project || null);
                      updateProjectTeamMembers(project);
                      setTaskForm((prev) => ({
                        ...prev,
                        projectId: project?._id || projectId || "",
                        assignedTeamLead: normalizeId(
                          project?.teamLeadUser || project?.teamLeadEmployee
                        ),
                        assignedTo: "",
                        assignedEmployee: "",
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.projectName}
                      </option>
                    ))}
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
                    value={taskForm.assignedTeamLead}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Team Lead</option>
                    {selectedProject && (selectedProject.teamLeadUser || selectedProject.teamLeadEmployee) && (
                      <option value={normalizeId(selectedProject.teamLeadUser || selectedProject.teamLeadEmployee)}>
                        {getTeamLeadNameById(selectedProject.teamLeadUser || selectedProject.teamLeadEmployee)}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Employee</label>
                  <select
                    name="assignedEmployee"
                    value={taskForm.assignedEmployee}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">
                      {!taskForm.projectId
                        ? "Select a project first"
                        : getAvailableTaskAssignees().length === 0
                          ? "No employees assigned to this project"
                          : "Select Employee"}
                    </option>
                    {getAvailableTaskAssignees().map((member) => (
                      <option key={normalizeId(member)} value={normalizeId(member)}>
                        {getUserName(member)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned By (HR/Admin)</label>
                  <select
                    name="assignedBy"
                    value={taskForm.assignedBy}
                    onChange={handleTaskChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Assigner</option>
                    {getHrAndAdminUsers().map((user) => (
                      <option key={user._id} value={user._id}>
                        {getUserName(user)} ({user.role || "HR/Admin"})
                      </option>
                    ))}
                    {getHrAndAdminUsers().length === 0 && (
                      <option value="">No HR/Admin users available</option>
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
                      value={taskForm.startDate}
                      onChange={handleTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={taskForm.dueDate}
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
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                </section>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  Create Task
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
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {update.createdAt ? new Date(update.createdAt).toLocaleString() : "No date"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {update.updateText || update.message || update.description || "No report details provided."}
                              </p>
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
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
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