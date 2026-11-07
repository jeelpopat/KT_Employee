import { useState, useEffect, useRef } from "react";
import { LoadingScreen } from "../../components/common/Loader.jsx";
import {
  Users,
  Plus,
  Mail,
  Briefcase,
  Building,
  UserCheck,
  Search,
  Filter,
  ChevronDown,
  Edit,
  Trash2,
  Crown,
  UserMinus,
  UserPlus,
  X,
  User,
  ShieldCheck,
  GraduationCap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useConfirm } from "../../components/common/ConfirmDialog";
import Toast from "../../components/common/Toast";
import {
  getEmploymentStatus,
  filterOutUnknownUsers,
  isUnknownEmployeeOrUser,
  resolveRoleName
} from "../../utils/roleFilters";
import {
  EMPLOYEE_DEPARTMENTS_ROLES,
  ALL_EMPLOYEE_DEPARTMENTS,
  ALL_EMPLOYEE_ROLES,
  getDepartmentForRole,
  matchesEmployeeDepartment,
  matchesEmployeeRole
} from "../../utils/employeeRoles";
import { BASE_URL } from "../../api/config";

const API_BASE = `${BASE_URL}/api`;

const initialFormData = {
  fullName: "",
  email: "",
  mobile: "",
  gender: "",
  designation: "",
  department: "",
  role: "employee",
  dob: "",
  address: "",
  bloodGroup: "",
};

const getEmployeeRoleLabel = (employee) => {
  const roleText = resolveRoleName(employee);
  const normalizedRole = roleText.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  if (employee?.isTeamLead || employee?.isTeamLeader || ["team lead", "team leader", "teamlead", "tl"].includes(normalizedRole)) {
    return "Team Lead";
  }
  if (normalizedRole === "hr") return "HR";
  if (normalizedRole === "admin" || normalizedRole === "administrator") return "Admin";
  if (normalizedRole.includes("account")) return "Accountant";
  if (normalizedRole === "ca" || normalizedRole.includes("chartered accountant")) return "CA";
  if (!normalizedRole || /^[0-9a-f]{24}$/i.test(normalizedRole)) return "Employee";
  return roleText.trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const isTeamLeadEmployee = (employee) =>
  Boolean(employee?.isTeamLead || employee?.isTeamLeader || getEmployeeRoleLabel(employee) === "Team Lead");

const canDeleteOrAssignTeamLead = (employee) =>
  !["HR", "Admin"].includes(getEmployeeRoleLabel(employee));

const canAssignTeamLead = (employee) =>
  !["HR", "Admin", "CA", "Accountant"].includes(getEmployeeRoleLabel(employee));

const isHrOrAdminRole = (role) => {
  const normalizedRole = String(role || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return normalizedRole === "hr" || normalizedRole.startsWith("hr ") ||
    normalizedRole === "admin" || normalizedRole === "administrator";
};

export default function Employees() {
  const { confirm, confirmationDialog } = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterEmployeeRole, setFilterEmployeeRole] = useState("all");
  const [toast, setToast] = useState({ message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev.message === message ? { message: "", type: "success" } : prev));
    }, 4000);
  };

  // =========================
  // EDIT MODE
  // =========================
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const employeeRecordsRef = useRef([]);

  const [formData, setFormData] = useState(initialFormData);

  // =========================
  // FETCH EMPLOYEES
  // =========================
  useEffect(() => {
    fetchEmployees(false);

    // Silent background auto-refresh every 10s for new employees
    const interval = setInterval(() => {
      fetchEmployees(true);
    }, 10000);

    const handleFocus = () => {
      fetchEmployees(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchEmployees(true);
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
    if (!showModal) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowModal(false);
        setFormData(initialFormData);
        setEditMode(false);
        setSelectedEmployeeId(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const fetchEmployees = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);

      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/users/all`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) throw new Error(`Failed to fetch users (HTTP ${res.status})`);
      const data = await res.json();
      const users = Array.isArray(data)
        ? data
        : data.users || data.data || data.employees || [];
      if (!Array.isArray(users)) {
        throw new Error(data.message || "Unexpected users response");
      }

      let employeeRecords = [];
      try {
        const employeeRes = await fetch(`${API_BASE}/employee/list`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (employeeRes.ok) {
          const employeeData = await employeeRes.json();
          const records = Array.isArray(employeeData)
            ? employeeData
            : employeeData.employees || employeeData.data || employeeData.employeesList || [];
          if (Array.isArray(records)) {
            employeeRecords = records;
            employeeRecordsRef.current = records;
          }
        } else {
          console.warn(`Could not load employee status records (HTTP ${employeeRes.status})`);
        }
      } catch (employeeError) {
        console.warn("Could not load employee status records:", employeeError?.message);
      }

      let roleNamesById = new Map();
      try {
        const rolesRes = await fetch(`${API_BASE}/role`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          const roles = Array.isArray(rolesData)
            ? rolesData
            : rolesData.roles || rolesData.data || [];
          roleNamesById = new Map(
            roles.map((role) => [
              String(role?._id || role?.id || role?.role_id || role?.roleID || "").toLowerCase(),
              String(role?.roleName || role?.name || role?.title || role?.displayName || "").trim(),
            ]).filter(([id, name]) => id && name)
          );
        }
      } catch (roleError) {
        console.warn("Could not resolve employee roles:", roleError?.message);
      }

      const normalizedUsers = users.map((user) => {
        const nestedUser = user?.userID || user?.userId || user?.user;
        const record = nestedUser && typeof nestedUser === "object"
          ? { ...nestedUser, ...user }
          : user;
        const normalizeIdentity = (value) => {
          const identity = value && typeof value === "object" ? value._id || value.id : value;
          return String(identity || "").trim().toLowerCase();
        };
        const userId = normalizeIdentity(record?._id || record?.id || record?.userID || record?.userId);
        const employeeId = normalizeIdentity(record?.employeeID || record?.employeeId || record?.uniqueID || record?.employeeCode);
        const email = normalizeIdentity(record?.email || record?.employeeEmail);
        const employeeRecord = employeeRecords.find((employee) => {
          const employeeUserId = normalizeIdentity(employee?.userID || employee?.userId);
          const employeeIdValue = normalizeIdentity(employee?.employeeID || employee?.employeeId || employee?.employeeCode);
          const employeeEmail = normalizeIdentity(
            employee?.email || employee?.userID?.email || employee?.userId?.email
          );
          const employeeDocId = normalizeIdentity(employee?._id || employee?.id);
          const recordEmpRefId = normalizeIdentity(
            typeof record?.employeeId === "object" ? record.employeeId?._id : record?.employeeId
          );
          const recordTlEmpId = normalizeIdentity(record?.teamLead?.employeeId);

          return (
            (userId && employeeUserId && userId === employeeUserId) ||
            (employeeId && employeeIdValue && employeeId === employeeIdValue) ||
            (email && employeeEmail && email === employeeEmail) ||
            (employeeDocId && recordEmpRefId && employeeDocId === recordEmpRefId) ||
            (employeeDocId && recordTlEmpId && employeeDocId === recordTlEmpId)
          );
        });
        const role = resolveRoleName(record, roleNamesById);
        const rawDesignation = record?.designation || record?.position || "";
        const designation = typeof rawDesignation === "object"
          ? rawDesignation.name || rawDesignation.designationName || rawDesignation.title || ""
          : rawDesignation;
        const rawDepartment = record?.department || record?.departmentName || record?.dept || "";
        const department = typeof rawDepartment === "object"
          ? rawDepartment.name || rawDepartment.departmentName || rawDepartment.title || ""
          : rawDepartment;
        const name = record?.name || record?.fullName ||
          `${record?.firstName || ""} ${record?.lastName || ""}`.trim();

        const employeeRecordId =
          employeeRecord?._id ||
          employeeRecord?.id ||
          (typeof record?.employeeId === "object" ? record.employeeId?._id || record.employeeId?.id : null) ||
          (typeof record?.employeeID === "object" ? record.employeeID?._id || record.employeeID?.id : null) ||
          (record?.employeeId && /^[0-9a-f]{24}$/i.test(String(record.employeeId)) ? String(record.employeeId) : null) ||
          (record?.teamLead && typeof record.teamLead === "object" && record.teamLead.employeeId && /^[0-9a-f]{24}$/i.test(String(record.teamLead.employeeId)) ? String(record.teamLead.employeeId) : null) ||
          null;

        const resolvedEmployeeCode =
          employeeRecord?.employeeID ||
          employeeRecord?.employeeCode ||
          employeeRecord?.employeeId ||
          record?.employeeID ||
          record?.employeeCode ||
          record?.uniqueID ||
          (typeof record?.employeeId === "string" ? record.employeeId : "");

        return {
          ...record,
          _id: record?._id || record?.id || employeeRecord?._id || record?.employeeId?._id || record?.employeeID?._id,
          userId: record?._id || record?.id,
          employeeRecordId,
          employeeRecord: employeeRecord || null,
          employeeId: employeeRecordId || resolvedEmployeeCode || record?.employeeId || record?._id,
          employeeID: resolvedEmployeeCode || record?.employeeID || "",
          employeeCode: resolvedEmployeeCode,
          name,
          role: String(role),
          designation,
          department,
          employeeStatus: getEmploymentStatus(employeeRecord, record),
        };
      });

      // Pass 2: Include employees from /api/employee/list that were not in /api/users/all
      const matchedEmployeeDocIds = new Set(
        normalizedUsers
          .map((u) => u.employeeRecordId || u.employeeRecord?._id)
          .filter(Boolean)
          .map((id) => String(id).toLowerCase().trim())
      );

      const unmatchedEmployees = employeeRecords
        .filter((empRec) => {
          if (!empRec || !empRec._id) return false;
          const recId = String(empRec._id).toLowerCase().trim();
          if (matchedEmployeeDocIds.has(recId)) return false;
          const recEmail = String(empRec.email || "").toLowerCase().trim();
          if (recEmail && normalizedUsers.some((u) => String(u.email || "").toLowerCase().trim() === recEmail)) {
            return false;
          }
          return true;
        })
        .map((empRec) => {
          const role = resolveRoleName(empRec, roleNamesById);
          const rawDesignation = empRec?.designation || empRec?.position || "";
          const designation = typeof rawDesignation === "object"
            ? rawDesignation.name || rawDesignation.designationName || rawDesignation.title || ""
            : rawDesignation;
          const rawDepartment = empRec?.department || empRec?.departmentName || empRec?.dept || "";
          const department = typeof rawDepartment === "object"
            ? rawDepartment.name || rawDepartment.departmentName || rawDepartment.title || ""
            : rawDepartment;
          const name = empRec?.name || empRec?.fullName ||
            `${empRec?.firstName || ""} ${empRec?.lastName || ""}`.trim();
          const code = empRec?.employeeID || empRec?.employeeCode || empRec?.employeeId || "";

          return {
            ...empRec,
            _id: empRec._id,
            userId: empRec.userID || empRec.userId || empRec._id,
            employeeRecordId: empRec._id,
            employeeRecord: empRec,
            employeeId: empRec._id,
            employeeID: code,
            employeeCode: code,
            name,
            role: String(role),
            designation,
            department,
            employeeStatus: getEmploymentStatus(empRec, empRec),
          };
        });

      setEmployees(filterOutUnknownUsers([...normalizedUsers, ...unmatchedEmployees]));
    } catch (error) {
      console.error("Fetch employees error:", error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // =========================
  // RESET FORM
  // =========================
  const resetForm = () => {
    setFormData(initialFormData);
    setEditMode(false);
    setSelectedEmployeeId(null);
    setSelectedEmployee(null);
  };

  // Helper to resolve employee collection document ID
  const resolveEmployeeRecordId = (employeeOrId) => {
    if (!employeeOrId) return null;
    const empObj = typeof employeeOrId === "object" && employeeOrId !== null ? employeeOrId : null;
    if (!empObj) {
      const idStr = String(employeeOrId).trim().toLowerCase();
      const currentRecords = employeeRecordsRef.current || [];
      const matchedRec = currentRecords.find((rec) => {
        const recId = String(rec?._id || "").toLowerCase();
        const recUserId = String(rec?.userID || rec?.userId || "").toLowerCase();
        return recId === idStr || recUserId === idStr;
      });
      if (matchedRec?._id) return String(matchedRec._id);

      if (/^[0-9a-f]{24}$/i.test(String(employeeOrId).trim())) {
        return String(employeeOrId).trim();
      }
      return String(employeeOrId);
    }

    if (empObj.employeeRecordId && /^[0-9a-f]{24}$/i.test(String(empObj.employeeRecordId))) {
      return String(empObj.employeeRecordId);
    }
    if (empObj.employeeRecord?._id && /^[0-9a-f]{24}$/i.test(String(empObj.employeeRecord._id))) {
      return String(empObj.employeeRecord._id);
    }

    // Lookup in cached employee records
    const currentRecords = employeeRecordsRef.current || [];
    const matchedRec = currentRecords.find((rec) => {
      const rUserId = String(rec?.userID || rec?.userId || "").toLowerCase().trim();
      const targetUserId = String(empObj.userId || empObj._id || empObj.id || "").toLowerCase().trim();
      const rEmail = String(rec?.email || "").toLowerCase().trim();
      const targetEmail = String(empObj.email || "").toLowerCase().trim();
      const rCode = String(rec?.employeeID || rec?.employeeId || rec?.employeeCode || "").toLowerCase().trim();
      const targetCode = String(empObj.employeeCode || empObj.employeeID || empObj.employeeId || empObj.uniqueID || "").toLowerCase().trim();

      return (
        (targetUserId && rUserId && targetUserId === rUserId) ||
        (targetEmail && rEmail && targetEmail === rEmail) ||
        (targetCode && rCode && targetCode === rCode)
      );
    });
    if (matchedRec?._id) {
      return String(matchedRec._id);
    }

    const candidates = [
      typeof empObj.employeeId === "object" ? empObj.employeeId?._id || empObj.employeeId?.id : empObj.employeeId,
      typeof empObj.employeeID === "object" ? empObj.employeeID?._id || empObj.employeeID?.id : empObj.employeeID,
      empObj.teamLead && typeof empObj.teamLead === "object" ? empObj.teamLead.employeeId : null,
      empObj.uniqueID,
    ];
    const validCandidate = candidates.find(
      (id) => id && /^[0-9a-f]{24}$/i.test(String(id).trim()) && String(id).trim() !== String(empObj._id || empObj.userId)
    );
    return validCandidate || candidates.find(Boolean) || empObj._id;
  };

  // =========================
  // TEAM LEAD TOGGLE
  // =========================
  const toggleTL = async (employeeOrId, isTeamLead) => {
    try {
      const empObj = typeof employeeOrId === "object" && employeeOrId !== null ? employeeOrId : null;
      const employeeId = resolveEmployeeRecordId(employeeOrId);
      const targetUserId = empObj ? (empObj.userId || empObj._id) : employeeId;

      const url = isTeamLead
        ? `${API_BASE}/employee/remove-tl/${employeeId}`
        : `${API_BASE}/employee/assign-tl/${employeeId}`;

      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(url, {
        method: "PUT",
        headers,
      });

      const data = await res.json();

      if (data.success) {
        showToast(data.message || "Team lead status updated successfully", "success");
        setEmployees((prev) =>
          prev.map((emp) =>
            emp._id === targetUserId || emp.employeeRecordId === employeeId || emp._id === employeeId
              ? {
                ...emp,
                isTeamLead: !isTeamLead,
                role: isTeamLead ? "employee" : "team lead",
              }
              : emp
          )
        );
      } else {
        showToast(data.message || "Failed to update TL", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to update TL", "error");
    }
  };

  // =========================
  // ATTENDANCE STYLE
  // =========================
  const getAttendanceStyle = (status) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "Inactive":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  // =========================
  // ROLE BADGE
  // =========================
  const getRoleBadge = (emp) => {
    const roleLower = String(emp?.role || "").trim().toLowerCase();
    if (roleLower === "hr") {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (emp?.isTeamLead || roleLower === "team lead") {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }

    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  // =========================
  // FORM CHANGE
  // =========================
  const handleChange = (e) => {
    const value = e.target.name === "mobile"
      ? e.target.value.replace(/\D/g, "").slice(0, 10)
      : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const getFormPayload = () => {
    const fullName = (formData.fullName || "").trim();
    if (!fullName) {
      showToast("Full Name is required", "error");
      return null;
    }

    const email = String(formData.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showToast("Enter a valid email address", "error");
      return null;
    }

    const mobile = String(formData.mobile || "").trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      showToast("Enter a valid 10-digit mobile number", "error");
      return null;
    }

    const rawRole = String(formData.role || "employee").trim().toLowerCase();
    const cleanRole = isHrOrAdminRole(rawRole)
      ? (rawRole.startsWith("hr") ? "hr" : "admin")
      : rawRole === "team lead" || rawRole === "teamlead"
        ? "team lead"
        : "employee";

    const payload = {
      ...formData,
      name: fullName,
      fullName: fullName,
      firstName: fullName,
      lastName: "",
      email,
      mobile,
      address: (formData.address || "").trim(),
      role: cleanRole,
      gender: String(formData.gender || "").trim().toLowerCase(),
    };

    if (!payload.address) {
      showToast("Address is required", "error");
      return null;
    }

    if (!payload.gender) {
      showToast("Gender is required", "error");
      return null;
    }

    if (!payload.designation) {
      showToast("Designation is required", "error");
      return null;
    }

    if (!payload.department) {
      showToast("Department is required", "error");
      return null;
    }

    return payload;
  };

  // =========================
  // ADD EMPLOYEE
  // =========================
  const handleAddEmployee = async (e) => {
    e.preventDefault();

    const payload = getFormPayload();

    if (!payload) {
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/employee/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (data.success) {
        showToast("Employee Added Successfully", "success");

        setShowModal(false);
        resetForm();

        fetchEmployees();
      } else {
        showToast(data.message || "Failed to add employee", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // OPEN EDIT MODAL
  // =========================
  const handleEditEmployee = (employee) => {
    setEditMode(true);
    setSelectedEmployee(employee);

    // Resolve employee collection document ID (_id) for /api/employee/edit/:id
    const empRecordId = resolveEmployeeRecordId(employee);
    setSelectedEmployeeId(empRecordId);

    const displayName =
      employee.name ||
      `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

    const rawDesig =
      employee.designation?.name ||
      employee.designation?.designationName ||
      employee.designation ||
      employee.position ||
      "";

    let rawDept =
      employee.department?.departmentName ||
      employee.departmentName ||
      employee.department ||
      "";

    if (!rawDept && rawDesig) {
      rawDept = getDepartmentForRole(rawDesig);
    }

    setFormData({
      fullName: displayName,
      email: employee.email || "",
      mobile: String(
        employee.mobile ||
        employee.phone ||
        employee.phoneNumber ||
        employee.contactNumber ||
        employee.userId?.phoneNumber ||
        employee.userId?.phone ||
        employee.userID?.phoneNumber ||
        employee.userID?.phone ||
        ""
      ).replace(/\D/g, "").slice(-10),
      designation: rawDesig,
      department: rawDept,
      role: (() => {
        const r = String(employee.role || "").trim().toLowerCase();
        if (r === "hr") return "hr";
        if (r === "team lead" || r === "teamlead" || employee.isTeamLead) return "team lead";
        return r || "employee";
      })(),
      dob: employee.dob
        ? String(employee.dob).split("T")[0]
        : employee.dateOfBirth
          ? String(employee.dateOfBirth).split("T")[0]
          : "",
      address:
        typeof employee.address === "string" && employee.address
          ? employee.address
          : employee.address?.line1
            ? [
              employee.address.line1,
              employee.address.line2,
              employee.address.city,
              employee.address.state,
              employee.address.pincode,
            ]
              .filter(Boolean)
              .join(", ")
            : employee.currentAddress ||
            employee.permanentAddress ||
            "",
      gender: String(employee.gender || "").trim().toLowerCase(),
      bloodGroup: employee.bloodGroup || "",
    });

    setShowModal(true);
  };

  // =========================
  // UPDATE EMPLOYEE
  // PUT /employee/update/:id
  // =========================
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      showToast("Employee ID is missing", "error");
      return;
    }

    const payload = getFormPayload();

    if (!payload) {
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      let targetId = selectedEmployeeId;

      // Ensure we send employee document ID instead of user ID
      if (
        selectedEmployee &&
        (targetId === selectedEmployee.userId || targetId === selectedEmployee._id)
      ) {
        const resolved = resolveEmployeeRecordId(selectedEmployee);
        if (resolved && resolved !== selectedEmployee.userId && resolved !== selectedEmployee._id) {
          targetId = resolved;
        }
      }

      let res = await fetch(
        `${API_BASE}/employee/edit/${targetId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      let data = await res.json().catch(() => ({}));

      // Fallback: If employee was not found (e.g. ID mismatch), query /api/employee/list live to find the employee document _id and retry
      if ((!res.ok || data?.success === false || data?.message === "Employee not found") && (formData.email || selectedEmployee?.email)) {
        try {
          const freshListRes = await fetch(`${API_BASE}/employee/list`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (freshListRes.ok) {
            const freshData = await freshListRes.json();
            const freshList = Array.isArray(freshData)
              ? freshData
              : freshData.employees || freshData.data || [];
            const targetEmail = String(formData.email || selectedEmployee?.email || "").trim().toLowerCase();
            const targetUid = String(selectedEmployee?.userId || selectedEmployee?._id || "").trim().toLowerCase();
            const matchedFresh = freshList.find((emp) => {
              const eEmail = String(emp.email || emp.userID?.email || emp.userId?.email || "").trim().toLowerCase();
              const eUid = String(emp.userID || emp.userId || "").trim().toLowerCase();
              return (targetEmail && eEmail && targetEmail === eEmail) || (targetUid && eUid && targetUid === eUid);
            });
            if (matchedFresh?._id && String(matchedFresh._id) !== String(targetId)) {
              const retryRes = await fetch(
                `${API_BASE}/employee/edit/${matchedFresh._id}`,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(payload),
                }
              );
              const retryData = await retryRes.json().catch(() => ({}));
              if (retryRes.ok && retryData.success) {
                res = retryRes;
                data = retryData;
              }
            }
          }
        } catch (retryError) {
          console.warn("Fallback employee edit lookup failed:", retryError?.message);
        }
      }

      if (data.success) {
        showToast("Employee Updated Successfully", "success");

        setShowModal(false);
        resetForm();

        fetchEmployees();
      } else {
        showToast(data.message || "Failed to update employee", "error");
      }
    } catch (error) {
      console.error("Update employee error:", error);
      showToast("Failed to update employee", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // DELETE EMPLOYEE
  // DELETE /employee/remove/:id
  // =========================
  const handleDeleteEmployee = async (employeeOrId, employeeName) => {
    const confirmed = await confirm({
      title: "Delete employee?",
      message: `Are you sure you want to delete ${employeeName}? This action cannot be undone.`,
      confirmLabel: "Delete",
    });

    if (!confirmed) {
      return;
    }

    try {
      const empObj = typeof employeeOrId === "object" && employeeOrId !== null ? employeeOrId : null;
      const employeeId = resolveEmployeeRecordId(employeeOrId);
      const targetUserId = empObj ? (empObj.userId || empObj._id) : employeeId;
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/employee/delete/${employeeId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const responseText = await res.text();
      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("Delete employee returned a non-JSON response:", {
          status: res.status,
          url: res.url,
          response: responseText.slice(0, 200),
        });
      }

      if (!res.ok) {
        const message =
          data.message ||
          (res.status === 404
            ? "Delete employee API endpoint was not found. Please check the backend route."
            : `Failed to delete employee (HTTP ${res.status})`);

        showToast(message, "error");
        return;
      }

      if (data.success) {
        showToast(data.message || "Employee Deleted Successfully", "success");

        setEmployees((prev) =>
          prev.filter(
            (employee) =>
              employee._id !== targetUserId &&
              employee._id !== employeeId &&
              employee.employeeRecordId !== employeeId
          )
        );
      } else {
        showToast(data.message || "Failed to delete employee", "error");
      }
    } catch (error) {
      console.error("Delete employee error:", error);
      showToast("Failed to delete employee", "error");
    }
  };

  // =========================
  // FILTER
  // =========================
  const filteredEmployees = employees.filter((emp) => {
    if (isUnknownEmployeeOrUser(emp)) return false;

    const fullName = String(
      emp.name ||
      emp.fullName ||
      `${emp.firstName || ""} ${emp.lastName || ""}`.trim()
    ).toLowerCase();

    const search = searchTerm.trim().toLowerCase();

    const rawDesig = typeof emp?.designation === 'object'
      ? (emp.designation?.name || emp.designation?.designationName || emp.designation?.title || '')
      : String(emp?.designation || emp?.position || '');

    const rawDept = typeof emp?.department === 'object'
      ? (emp.department?.name || emp.department?.departmentName || emp.department?.title || '')
      : String(emp?.departmentName || emp?.department || '');

    const matchesSearch =
      !search ||
      fullName.includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      rawDesig.toLowerCase().includes(search) ||
      rawDept.toLowerCase().includes(search);

    const rawStatus = String(emp.employeeStatus || emp.status || (emp.isActive === false ? "Inactive" : "Active")).trim().toLowerCase();
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus.toLowerCase() === "active" ? (rawStatus === "active" || !rawStatus) : rawStatus === filterStatus.toLowerCase());

    const empRole = getEmployeeRoleLabel(emp).trim().toLowerCase();
    const desigLower = rawDesig.toLowerCase();
    const deptLower = rawDept.toLowerCase();
    const isEmpTL = Boolean(
      emp.isTeamLead ||
      emp.isTeamLeader ||
      empRole === "team lead" ||
      empRole === "teamlead" ||
      empRole === "tl" ||
      desigLower.includes("team lead") ||
      desigLower.includes("teamlead") ||
      desigLower.includes("tl")
    );
    const isEmpHR = empRole === "hr" || desigLower.includes("hr");
    const isEmpAdmin = empRole === "admin";
    const isEmpAccountant =
      empRole.includes("account") ||
      desigLower.includes("account") ||
      deptLower.includes("account");
    const isEmpCA =
      /\bca\b/i.test(empRole) ||
      /\bca\b/i.test(desigLower) ||
      /\bca\b/i.test(deptLower) ||
      empRole.includes("chartered") ||
      desigLower.includes("chartered");

    const matchesRole =
      filterRole === "all" ||
      (filterRole === "admin" && isEmpAdmin) ||
      (filterRole === "hr" && isEmpHR) ||
      (filterRole === "team lead" && isEmpTL) ||
      (filterRole === "accountant" && isEmpAccountant) ||
      (filterRole === "ca" && isEmpCA) ||
      (filterRole === "employee" && !isEmpAdmin && !isEmpHR && !isEmpTL && !isEmpAccountant && !isEmpCA);

    const matchesDept = matchesEmployeeDepartment(emp, filterDepartment);
    const matchesEmpRole = matchesEmployeeRole(emp, filterEmployeeRole);

    return matchesSearch && matchesStatus && matchesRole && matchesDept && matchesEmpRole;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 font-poppins text-slate-800">
      {confirmationDialog}
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "success" })}
        />
      )}

      {/* ====================================================
          PAGE HEADER (Matches Leave Requests Geometry)
      ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 font-poppins">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-poppins">
            Employees
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 font-normal font-poppins mt-0.5">
            View and manage company employees, roles, and profiles
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Total Count Badge */}
          <div className="h-9 bg-white border border-slate-300 rounded-md px-3 sm:px-3.5 shadow-2xs text-xs font-medium flex items-center select-none font-poppins text-slate-600 gap-1.5">
            <Users size={14} className="text-slate-600 shrink-0" />
            <span>Total:</span>
            <span className="font-bold text-slate-900">
              {filteredEmployees.length !== employees.length
                ? `${filteredEmployees.length} / ${employees.length}`
                : employees.length}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchEmployees(false)}
            disabled={loading}
            title="Refresh directory"
            aria-label="Refresh directory"
            className="h-9 w-9 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer font-poppins"
          >
            <RefreshCw size={13} className={`text-slate-600 ${loading ? "animate-spin text-[#0088cc]" : ""}`} />
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="h-9 px-3.5 text-white text-xs font-medium rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95 font-poppins"
            style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
          >
            <Plus size={14} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

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
              placeholder="Search by employee name, email or department..."
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

          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((prev) => !prev)}
            className="h-10 inline-flex items-center justify-center gap-2 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium font-poppins shadow-2xs transition cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filters</span>
            {(filterDepartment !== "all" || filterEmployeeRole !== "all" || filterRole !== "all" || filterStatus !== "all") && (
              <span className="w-2 h-2 rounded-full bg-[#034665]" />
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Filters Row: Four dropdown/select filter fields placed side-by-side */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 space-y-3 font-poppins">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Department */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 font-poppins">
                  Department
                </label>
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    const nextDept = e.target.value;
                    setFilterDepartment(nextDept);
                    if (nextDept !== "all" && filterEmployeeRole !== "all") {
                      const rolesInDept = EMPLOYEE_DEPARTMENTS_ROLES[nextDept] || [];
                      if (!rolesInDept.includes(filterEmployeeRole)) {
                        setFilterEmployeeRole("all");
                      }
                    }
                  }}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] transition font-poppins"
                >
                  <option value="all">All Department</option>
                  {ALL_EMPLOYEE_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Employee Role */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 font-poppins">
                  Employee Role
                </label>
                <select
                  value={filterEmployeeRole}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setFilterEmployeeRole(nextRole);
                    if (nextRole !== "all" && filterDepartment === "all") {
                      const deducedDept = getDepartmentForRole(nextRole);
                      if (deducedDept) setFilterDepartment(deducedDept);
                    }
                  }}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] transition font-poppins"
                >
                  <option value="all">All Roles</option>
                  {filterDepartment !== "all" && EMPLOYEE_DEPARTMENTS_ROLES[filterDepartment] ? (
                    EMPLOYEE_DEPARTMENTS_ROLES[filterDepartment].map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))
                  ) : (
                    Object.entries(EMPLOYEE_DEPARTMENTS_ROLES).map(([dept, roles]) => (
                      <optgroup key={dept} label={dept}>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
              </div>

              {/* 3. System Role */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 font-poppins">
                  System Role
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] transition font-poppins"
                >
                  <option value="all">All Roles</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="team lead">Team Lead</option>
                  <option value="hr">HR</option>
                  <option value="accountant">Accountant</option>
                  <option value="ca">CA</option>
                </select>
              </div>

              {/* 4. Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 font-poppins">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#034665]/20 focus:border-[#034665] transition font-poppins"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Clear all filters shortcut if any filter is active */}
            {(filterDepartment !== "all" || filterEmployeeRole !== "all" || filterRole !== "all" || filterStatus !== "all" || searchTerm) && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFilterDepartment("all");
                    setFilterEmployeeRole("all");
                    setFilterRole("all");
                    setFilterStatus("all");
                    setSearchTerm("");
                  }}
                  className="text-xs text-[#068DCB] hover:text-[#034665] font-medium transition-colors cursor-pointer font-poppins"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================================================
              LOADING & EMPTY STATES
          ================================================== */}
        {loading ? (
          <LoadingScreen
            message="Loading employee directory..."
            description="Fetching team records and credentials"
          />
        ) : filteredEmployees.length === 0 ? (
          <div className="py-16 text-center font-poppins">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4 text-[#034665]">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-poppins">
              {searchTerm || filterStatus !== "all" || filterDepartment !== "all" || filterRole !== "all" || filterEmployeeRole !== "all"
                ? "No Results Found"
                : "No Employees Found"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-poppins">
              {searchTerm || filterStatus !== "all" || filterDepartment !== "all" || filterRole !== "all" || filterEmployeeRole !== "all"
                ? "Try adjusting your search keywords or filter options."
                : "Add your first employee to get started."}
            </p>
          </div>
        ) : (
          <>
            {/* ==================================================
                  DESKTOP TABLE (Clean White Row Background, Navy Headers)
              ================================================== */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-xs font-poppins">
                <thead style={{ backgroundColor: "#0346651A" }}>
                  <tr className="border-b border-slate-200/80">
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins w-14">
                      NO
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins min-w-[200px]">
                      EMPLOYEE
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins min-w-[150px]">
                      DESIGNATION
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins min-w-[110px]">
                      STATUS
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins min-w-[120px]">
                      ROLE
                    </th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-[#034665] font-poppins min-w-[170px]">
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredEmployees.map((emp, index) => {
                    const displayName = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                    const initial = displayName.charAt(0).toUpperCase();

                    return (
                      <tr
                        key={emp._id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* NO */}
                        <td className="px-3 py-3 text-slate-500 font-medium font-poppins text-xs w-14">
                          {index + 1}
                        </td>

                        {/* EMPLOYEE */}
                        <td className="px-3 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 font-poppins shadow-2xs"
                              style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs sm:text-[13px] font-poppins truncate">
                                {displayName}
                              </p>
                              {emp.email && (
                                <a
                                  href={`mailto:${emp.email}`}
                                  className="text-[11px] text-slate-400 hover:text-[#068DCB] hover:underline font-normal font-poppins truncate block"
                                  title={`Click to send mail to ${emp.email}`}
                                >
                                  {emp.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* DESIGNATION */}
                        <td className="px-3 py-3 text-slate-700 font-medium font-poppins text-xs">
                          {emp.designation || "N/A"}
                        </td>

                        {/* STATUS */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-poppins select-none whitespace-nowrap border ${
                              emp.employeeStatus === "Inactive"
                                ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                                : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                                  ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                                  : "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                emp.employeeStatus === "Inactive"
                                  ? "bg-rose-500"
                                  : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                            />
                            {emp.employeeStatus || "Active"}
                          </span>
                        </td>

                        {/* ROLE */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {(() => {
                            const roleLabel = getEmployeeRoleLabel(emp);
                            const isLeadership = ["Team Lead", "HR", "Admin"].includes(roleLabel);
                            const colorClass = isLeadership ? "text-[#034665]" : "text-[#475569]";

                            return (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colorClass} font-poppins`}>
                                {roleLabel === "Team Lead" ? (
                                  <Crown className="w-3.5 h-3.5 text-[#034665]" />
                                ) : roleLabel === "HR" ? (
                                  <UserCheck className="w-3.5 h-3.5 text-[#034665]" />
                                ) : roleLabel === "Admin" ? (
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#034665]" />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-[#475569]" />
                                )}
                                <span>{roleLabel}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* ACTION */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-poppins">
                            {/* EDIT */}
                            <button
                              type="button"
                              onClick={() => handleEditEmployee(emp)}
                              title="Edit Employee"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#068DCB] hover:text-[#034665] hover:bg-sky-50 rounded-md transition-colors cursor-pointer font-poppins"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {canDeleteOrAssignTeamLead(emp) && (
                              <>
                                {/* DELETE */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteEmployee(
                                      emp,
                                      displayName
                                    )
                                  }
                                  title="Delete Employee"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors cursor-pointer font-poppins"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>

                                {/* ASSIGN / REMOVE TL */}
                                {canAssignTeamLead(emp) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleTL(emp, isTeamLeadEmployee(emp))
                                    }
                                    title={isTeamLeadEmployee(emp) ? "Remove as Team Lead" : "Assign as Team Lead"}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer font-poppins ${
                                      isTeamLeadEmployee(emp)
                                        ? "text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                        : "text-[#068DCB] hover:text-[#034665] hover:bg-sky-50"
                                    }`}
                                  >
                                    {isTeamLeadEmployee(emp) ? (
                                      <>
                                        <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Remove TL</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus className="w-3.5 h-3.5 text-[#068DCB]" />
                                        <span>Assign TL</span>
                                      </>
                                    )}
                                  </button>
                                )}
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

            {/* ==================================================
                  MOBILE & TABLET CARDS (< 1024px)
              ================================================== */}
            <div className="lg:hidden space-y-3 font-poppins">
              {filteredEmployees.map((emp) => {
                const displayName = emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                const initial = displayName.charAt(0).toUpperCase();

                return (
                  <div
                    key={emp._id}
                    className="bg-white border border-slate-200/80 rounded-xl p-4 hover:border-[#034665]/30 hover:shadow-xs transition font-poppins space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 font-poppins shadow-2xs"
                          style={{ background: "linear-gradient(180deg, #034665 0%, #068DCB 100%)" }}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm font-poppins truncate">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-normal font-poppins truncate">
                            {emp.designation || "N/A"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-poppins select-none whitespace-nowrap border shrink-0 ${
                          emp.employeeStatus === "Inactive"
                            ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                            : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                              ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                              : "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            emp.employeeStatus === "Inactive"
                              ? "bg-rose-500"
                              : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                        />
                        {emp.employeeStatus || "Active"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs font-poppins">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-poppins">
                          Email
                        </p>
                        <a
                          href={`mailto:${emp.email}`}
                          className="text-xs text-[#068DCB] hover:underline font-poppins truncate block mt-0.5"
                        >
                          {emp.email || "N/A"}
                        </a>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-poppins">
                          Department
                        </p>
                        <p className="text-slate-700 text-xs mt-0.5 font-poppins truncate">
                          {emp.department?.departmentName || emp.departmentName || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 font-poppins flex-wrap">
                      <span className="text-xs font-medium text-slate-600 font-poppins">
                        Role:{" "}
                        {(() => {
                          const roleLabel = getEmployeeRoleLabel(emp);
                          const isLeadership = ["Team Lead", "HR", "Admin"].includes(roleLabel);
                          const colorClass = isLeadership ? "text-[#034665]" : "text-[#475569]";
                          return (
                            <strong className={`inline-flex items-center gap-1 font-semibold ${colorClass}`}>
                              {roleLabel === "Team Lead" ? (
                                <Crown className="w-3 h-3 text-[#034665]" />
                              ) : roleLabel === "HR" ? (
                                <UserCheck className="w-3 h-3 text-[#034665]" />
                              ) : roleLabel === "Admin" ? (
                                <ShieldCheck className="w-3 h-3 text-[#034665]" />
                              ) : (
                                <User className="w-3 h-3 text-[#475569]" />
                              )}
                              <span>{roleLabel}</span>
                            </strong>
                          );
                        })()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditEmployee(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#068DCB] hover:text-[#034665] hover:bg-sky-50 rounded-md transition-colors cursor-pointer font-poppins"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {canDeleteOrAssignTeamLead(emp) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp, displayName)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors cursor-pointer font-poppins"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>

                            {canAssignTeamLead(emp) && (
                              <button
                                type="button"
                                onClick={() => toggleTL(emp, isTeamLeadEmployee(emp))}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer font-poppins ${
                                  isTeamLeadEmployee(emp)
                                    ? "text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                    : "text-[#068DCB] hover:text-[#034665] hover:bg-sky-50"
                                }`}
                              >
                                {isTeamLeadEmployee(emp) ? (
                                  <>
                                    <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Remove TL</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3.5 h-3.5 text-[#068DCB]" />
                                    <span>Assign TL</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          ADD / EDIT EMPLOYEE MODAL (Matches Frame 107.png)
      ====================================================== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6 backdrop-blur-xs font-poppins"
          role="presentation"
          onClick={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div
            className="relative w-full max-w-[560px] max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col font-poppins border border-slate-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-2 flex-shrink-0 flex items-start justify-between gap-4">
              <div>
                <h2 id="employee-form-title" className="text-xl sm:text-2xl font-bold text-slate-900 font-poppins tracking-tight">
                  {editMode ? "Edit Employee" : "Add Employee"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-normal font-poppins mt-1">
                  {editMode
                    ? "Update employee information"
                    : "Add a new employee to the system"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-[#235d78] hover:text-slate-900 transition-colors p-1 rounded-md cursor-pointer -mr-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                editMode
                  ? handleUpdateEmployee
                  : handleAddEmployee
              }
              className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 sm:pb-7 pt-2 space-y-4 font-poppins"
            >
              {/* ROW 1: FULL NAME */}
              <div>
                <label htmlFor="employee-full-name" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                  Full Name
                </label>
                <input
                  id="employee-full-name"
                  name="fullName"
                  placeholder="Name"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-3.5 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins"
                />
              </div>

              {/* ROW 2: EMAIL & MOBILE NUMBER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-email" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Email
                  </label>
                  <input
                    id="employee-email"
                    name="email"
                    type="email"
                    placeholder="Name@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full h-11 px-3.5 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins"
                  />
                </div>

                <div>
                  <label htmlFor="employee-mobile" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Mobile Number
                  </label>
                  <input
                    id="employee-mobile"
                    name="mobile"
                    type="tel"
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    placeholder="00000 00000"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                    title="Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9"
                    className="w-full h-11 px-3.5 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins"
                  />
                </div>
              </div>

              {/* ROW 3: DEPARTMENT & ROLE / DESIGNATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-department" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Department
                  </label>
                  <div className="relative">
                    <select
                      id="employee-department"
                      name="department"
                      value={formData.department}
                      onChange={(e) => {
                        const newDept = e.target.value;
                        setFormData((prev) => {
                          const rolesInDept = EMPLOYEE_DEPARTMENTS_ROLES[newDept] || [];
                          const isCurrentRoleInDept = rolesInDept.some(
                            (r) => r.toLowerCase() === (prev.designation || "").toLowerCase()
                          );
                          return {
                            ...prev,
                            department: newDept,
                            designation: isCurrentRoleInDept ? prev.designation : "",
                          };
                        });
                      }}
                      required
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins appearance-none cursor-pointer"
                    >
                      <option value="">Department</option>
                      {ALL_EMPLOYEE_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                      {formData.department && !ALL_EMPLOYEE_DEPARTMENTS.includes(formData.department) && (
                        <option value={formData.department}>{formData.department}</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label htmlFor="employee-designation" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Role / designation
                  </label>
                  <div className="relative">
                    <select
                      id="employee-designation"
                      name="designation"
                      value={formData.designation}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        const deducedDept = getDepartmentForRole(newRole);
                        setFormData((prev) => ({
                          ...prev,
                          designation: newRole,
                          department: prev.department || deducedDept,
                        }));
                      }}
                      required
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins appearance-none cursor-pointer"
                    >
                      <option value="">Department</option>
                      {formData.department && EMPLOYEE_DEPARTMENTS_ROLES[formData.department] ? (
                        EMPLOYEE_DEPARTMENTS_ROLES[formData.department].map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))
                      ) : (
                        Object.entries(EMPLOYEE_DEPARTMENTS_ROLES).map(([dept, roles]) => (
                          <optgroup key={dept} label={dept}>
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      )}
                      {formData.designation && !ALL_EMPLOYEE_ROLES.includes(formData.designation) && (
                        <option value={formData.designation}>{formData.designation}</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* ROW 4: ROLE & GENDER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-system-role" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Role
                  </label>
                  <div className="relative">
                    <select
                      id="employee-system-role"
                      name="role"
                      value={formData.role || "employee"}
                      onChange={handleChange}
                      disabled={editMode && isHrOrAdminRole(formData.role)}
                      required
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="employee">Employee</option>
                      <option value="team lead">Team Lead</option>
                      <option value="hr">HR</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label htmlFor="employee-gender" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      id="employee-gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      required
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins appearance-none cursor-pointer"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* ROW 5: DATE OF BIRTH & BLOOD GROUP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-dob" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      id="employee-dob"
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      required
                      placeholder="dd-mm-yyyy"
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins cursor-pointer"
                    />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label htmlFor="employee-blood-group" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      id="employee-blood-group"
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      required
                      className="w-full h-11 px-3.5 pr-10 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins appearance-none cursor-pointer"
                    >
                      <option value="">Select blood group</option>
                      {[
                        "A+",
                        "A-",
                        "B+",
                        "B-",
                        "AB+",
                        "AB-",
                        "O+",
                        "O-",
                      ].map((bloodGroup) => (
                        <option key={bloodGroup} value={bloodGroup}>
                          {bloodGroup}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787878] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* ROW 6: ADDRESS */}
              <div>
                <label htmlFor="employee-address" className="block text-sm font-medium text-slate-900 mb-1.5 font-poppins">
                  Address
                </label>
                <input
                  id="employee-address"
                  type="text"
                  name="address"
                  placeholder="Address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-3.5 border border-[#c0d1d8] rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition bg-white font-poppins"
                />
              </div>

              {/* ROW 7: BUTTONS */}
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="h-11 px-4 text-sm font-medium text-[#13516f] bg-white border border-[#c0d0d8] hover:bg-slate-50 transition-colors rounded-lg flex items-center justify-center font-poppins cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-4 text-sm font-medium text-white transition-all rounded-lg shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-poppins cursor-pointer hover:opacity-95"
                  style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {isSubmitting
                      ? editMode
                        ? "Updating Employee..."
                        : "Adding Employee..."
                      : editMode
                        ? "Update Employee"
                        : "Add Employee"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}