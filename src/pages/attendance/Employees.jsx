import { useState, useEffect } from "react";
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
  X,
  User,
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

const API_BASE = "https://kt-backend-ttzj.onrender.com/api";

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

export default function Employees() {
  const { confirm, confirmationDialog } = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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
        "https://kt-backend-ttzj.onrender.com/api/users/all",
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
        const employeeRes = await fetch("https://kt-backend-ttzj.onrender.com/api/employee/list", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (employeeRes.ok) {
          const employeeData = await employeeRes.json();
          const records = Array.isArray(employeeData)
            ? employeeData
            : employeeData.employees || employeeData.data || employeeData.employeesList || [];
          if (Array.isArray(records)) employeeRecords = records;
        } else {
          console.warn(`Could not load employee status records (HTTP ${employeeRes.status})`);
        }
      } catch (employeeError) {
        console.warn("Could not load employee status records:", employeeError?.message);
      }

      let roleNamesById = new Map();
      try {
        const rolesRes = await fetch("https://kt-backend-ttzj.onrender.com/api/role", {
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
        const employeeId = normalizeIdentity(record?.employeeID || record?.employeeId);
        const email = normalizeIdentity(record?.email || record?.employeeEmail);
        const employeeRecord = employeeRecords.find((employee) => {
          const employeeUserId = normalizeIdentity(employee?.userID || employee?.userId);
          const employeeIdValue = normalizeIdentity(employee?.employeeID || employee?.employeeId);
          const employeeEmail = normalizeIdentity(
            employee?.email || employee?.userID?.email || employee?.userId?.email
          );
          return (
            (userId && employeeUserId && userId === employeeUserId) ||
            (employeeId && employeeIdValue && employeeId === employeeIdValue) ||
            (email && employeeEmail && email === employeeEmail)
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

        return {
          ...record,
          _id: record?._id || record?.id || record?.employeeId?._id || record?.employeeID?._id,
          name,
          role: String(role),
          designation,
          department,
          employeeStatus: getEmploymentStatus(employeeRecord, record),
        };
      });
      setEmployees(filterOutUnknownUsers(normalizedUsers));
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
  };

  // =========================
  // TEAM LEAD TOGGLE
  // =========================
  const toggleTL = async (employeeId, isTeamLead) => {
    try {
      const url = isTeamLead
        ? `https://kt-backend-ttzj.onrender.com/api/employee/remove-tl/${employeeId}`
        : `https://kt-backend-ttzj.onrender.com/api/employee/assign-tl/${employeeId}`;

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
            emp._id === employeeId
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getFormPayload = () => {
    const fullName = (formData.fullName || "").trim();
    if (!fullName) {
      showToast("Full Name is required", "error");
      return null;
    }

    const rawRole = String(formData.role || "employee").trim().toLowerCase();
    const cleanRole = rawRole === "hr" ? "hr" : rawRole === "team lead" || rawRole === "teamlead" ? "team lead" : "employee";

    const payload = {
      ...formData,
      name: fullName,
      fullName: fullName,
      firstName: fullName,
      lastName: "",
      address: (formData.address || "").trim(),
      role: cleanRole,
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
    setSelectedEmployeeId(employee._id);

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
      mobile:
        employee.mobile ||
        employee.phone ||
        employee.phoneNumber ||
        employee.contactNumber ||
        employee.userId?.phoneNumber ||
        employee.userId?.phone ||
        employee.userID?.phoneNumber ||
        employee.userID?.phone ||
        "",
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
      gender: employee.gender || "",
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

      const res = await fetch(
        `https://kt-backend-ttzj.onrender.com/api/employee/edit/${selectedEmployeeId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

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
  const handleDeleteEmployee = async (employeeId, employeeName) => {
    const confirmed = await confirm({
      title: "Delete employee?",
      message: `Are you sure you want to delete ${employeeName}? This action cannot be undone.`,
      confirmLabel: "Delete",
    });

    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        `https://kt-backend-ttzj.onrender.com/api/employee/delete/${employeeId}`,
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
          prev.filter((employee) => employee._id !== employeeId)
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
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {confirmationDialog}
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "success" })}
        />
      )}

      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#004b73] flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Employees
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              View and manage company employees, roles, and profiles
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

          {/* TOTAL */}
          <div className="px-3 sm:px-4 py-2 bg-white shadow-xs border border-slate-200/80 rounded-lg flex items-center gap-1.5 sm:gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />

            <span className="text-xs sm:text-sm text-gray-600">
              Total:
            </span>

            <span className="font-semibold text-gray-900 text-xs sm:text-sm">
              {filteredEmployees.length !== employees.length
                ? `${filteredEmployees.length} / ${employees.length}`
                : employees.length}
            </span>
          </div>

          {/* REFRESH */}
          <button
            type="button"
            onClick={() => fetchEmployees(false)}
            disabled={loading}
            title="Refresh employee directory"
            className="h-10 px-3.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#0088cc]" : "text-slate-500"}`} />
            <span className="hidden xs:inline">{loading ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* ADD */}
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="h-10 px-4 btn-brand-primary text-white transition-all flex items-center gap-2 shadow-xs text-xs sm:text-sm font-medium rounded-lg cursor-pointer"
            style={{ background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' }}
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="bg-white shadow-xs border border-slate-200/80 rounded-xl overflow-hidden">

        {/* SEARCH */}
        <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col gap-3 sm:gap-4">

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />

                <input
                  type="text"
                  placeholder="Search by name, email, or designation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap relative"
              >
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

                <span className="hidden xs:inline">
                  Filters
                </span>

                {(filterDepartment !== "all" || filterEmployeeRole !== "all" || filterRole !== "all" || filterStatus !== "all") && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                )}

                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""
                    }`}
                />
              </button>
            </div>

            {/* FILTER OPTIONS */}
            {showFilters && (
              <div className="pt-2 sm:pt-3 border-t border-gray-100 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {/* Department Filter */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                    >
                      <option value="all">All Departments</option>
                      {ALL_EMPLOYEE_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Employee Role Filter */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
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

                  {/* System Role Filter */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                      System Role
                    </label>

                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
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

                  {/* Status Filter */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                      Status
                    </label>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
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
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================= LOADING ================= */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 sm:py-24">
            <Loader2 className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-indigo-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800">Loading employee directory...</p>
            <p className="text-xs text-slate-500 mt-1">Fetching team records and credentials</p>
          </div>

        ) : filteredEmployees.length === 0 ? (

          /* ================= EMPTY ================= */
          <div className="text-center py-12 sm:py-16">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="bg-blue-50 p-3 sm:p-4 border border-blue-200">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              {searchTerm || filterStatus !== "all"
                ? "No Results Found"
                : "No Employees Found"}
            </h3>

            <p className="mt-1 text-xs sm:text-sm text-gray-500 px-4">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter terms"
                : "Add your first employee to get started."}
            </p>
          </div>

        ) : (

          /* ================= EMPLOYEE LIST ================= */
          <div className="p-3 sm:p-4 lg:p-6">

            {/* ================= DESKTOP TABLE ================= */}
            <div className="hidden lg:block overflow-hidden border border-slate-200/80 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pl-6 pr-3 py-3.5 text-left w-12">#</th>
                      <th className="px-4 py-3.5 text-left">Employee</th>
                      <th className="px-4 py-3.5 text-left">Designation</th>
                      <th className="px-4 py-3.5 text-left">Status</th>
                      <th className="px-4 py-3.5 text-left">Role</th>
                      <th className="px-4 py-3.5 text-left">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp, index) => (
                      <tr
                        key={emp._id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* # COLUMN WITH EXACT SAME LEFT PADDING (pl-6) */}
                        <td className="pl-6 pr-3 py-3.5 text-left text-sm font-medium text-slate-500 whitespace-nowrap w-12">
                          {index + 1}
                        </td>

                        {/* EMPLOYEE (NAME + CLICKABLE EMAIL RIGHT BELOW) */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-xs shrink-0">
                              {(emp.name || emp.firstName || "E")?.charAt(0)?.toUpperCase()}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-slate-900 text-sm truncate">
                                {emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()}
                              </span>
                              {emp.email && (
                                <a
                                  href={`mailto:${emp.email}`}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline truncate transition-colors cursor-pointer mt-0.5 inline-block"
                                  title={`Click to send mail to ${emp.email}`}
                                >
                                  {emp.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* DESIGNATION */}
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            {/* <Briefcase className="h-3.5 w-3.5 text-slate-400" /> */}
                            {emp.designation || "N/A"}
                          </span>
                        </td>

                        {/* STATUS (CLEAN UNBOXED WITH STATUS DOT) */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              emp.employeeStatus === "Inactive"
                                ? "text-rose-600"
                                : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
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

                        {/* ROLE (CLEAN UNBOXED WITH ICON) */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            {getEmployeeRoleLabel(emp) === "HR" ? (
                              <>
                                <UserCheck className="h-3.5 w-3.5 text-purple-600" />
                                <span className="text-purple-700 font-semibold">HR</span>
                              </>
                            ) : getEmployeeRoleLabel(emp) === "Team Lead" ? (
                              <>
                                <Crown className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-amber-700 font-semibold">Team Lead</span>
                              </>
                            ) : (
                              <>
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span>{getEmployeeRoleLabel(emp)}</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* ACTIONS (CLEAN UNBOXED BUTTONS, NO HEAVY BOXES) */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">

                            {/* EDIT */}
                            <button
                              onClick={() =>
                                handleEditEmployee(emp)
                              }
                              title="Edit Employee"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5 text-indigo-500" />
                              Edit
                            </button>

                            {/* DELETE */}
                            <button
                              onClick={() =>
                                handleDeleteEmployee(
                                  emp._id,
                                  `${emp.firstName || ""} ${emp.lastName || ""
                                    }`.trim()
                                )
                              }
                              title="Delete Employee"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              Delete
                            </button>

                            {/* TEAM LEAD */}
                            <button
                              onClick={() =>
                                toggleTL(
                                  emp._id,
                                  isTeamLeadEmployee(emp)
                                )
                              }
                              title={isTeamLeadEmployee(emp) ? "Remove as Team Lead" : "Assign as Team Lead"}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${isTeamLeadEmployee(emp)
                                ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                }`}
                            >
                              {isTeamLeadEmployee(emp) ? (
                                <>
                                  <UserMinus className="h-3.5 w-3.5 text-rose-500" />
                                  Remove TL
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  Assign TL
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ================= TABLET ================= */}
            <div className="hidden sm:block lg:hidden">
              <div className="space-y-3">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp._id}
                    className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-bold text-white shadow-xs flex-shrink-0">
                          {emp.firstName?.charAt(0)}
                          {emp.lastName?.charAt(0)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {emp.firstName} {emp.lastName}
                          </h3>

                          <p className="text-sm text-gray-500 truncate">
                            {emp.designation || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            emp.employeeStatus === "Inactive"
                              ? "text-rose-600"
                              : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              emp.employeeStatus === "Inactive"
                                ? "bg-rose-500"
                                : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {emp.employeeStatus || "Active"}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          {getEmployeeRoleLabel(emp) === "HR" ? (
                            <>
                              <UserCheck className="h-3 w-3 text-purple-600" />
                              <span className="text-purple-700 font-semibold">HR</span>
                            </>
                          ) : getEmployeeRoleLabel(emp) === "Team Lead" ? (
                            <>
                              <Crown className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-700 font-semibold">Team Lead</span>
                            </>
                          ) : (
                            getEmployeeRoleLabel(emp)
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />

                        <a
                          href={`mailto:${emp.email}`}
                          className="truncate text-indigo-600 hover:underline"
                        >
                          {emp.email}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 text-gray-600 min-w-0">
                        <Building className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />

                        <span className="truncate">
                          {emp.department?.departmentName ||
                            emp.departmentName ||
                            "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* TABLET ACTIONS */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-nowrap gap-2 overflow-x-auto">

                      <button
                        onClick={() =>
                          handleEditEmployee(emp)
                        }
                        className="inline-flex min-w-[76px] flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5 text-indigo-500" />
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteEmployee(
                            emp._id,
                            `${emp.firstName || ""} ${emp.lastName || ""
                              }`.trim()
                          )
                        }
                        className="inline-flex min-w-[76px] flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        Delete
                      </button>

                      <button
                        onClick={() =>
                          toggleTL(
                            emp._id,
                            isTeamLeadEmployee(emp)
                          )
                        }
                        title={isTeamLeadEmployee(emp) ? "Remove as Team Lead" : "Assign as Team Lead"}
                        className={`inline-flex min-w-[104px] flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors cursor-pointer ${isTeamLeadEmployee(emp)
                          ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                          : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                      >
                        {isTeamLeadEmployee(emp) ? (
                          <>
                            <UserMinus className="h-3.5 w-3.5 text-rose-500" />
                            Remove TL
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                            Assign TL
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ================= MOBILE ================= */}
            <div className="sm:hidden space-y-3">
              {filteredEmployees.map((emp) => (
                <div
                  key={emp._id}
                  className="border border-slate-200/80 rounded-xl p-3 bg-white shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-xs flex-shrink-0">
                        {emp.firstName?.charAt(0)}
                        {emp.lastName?.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {emp.firstName} {emp.lastName}
                        </h3>

                        <p className="text-xs text-gray-500 truncate">
                          {emp.designation || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 ml-1 flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          emp.employeeStatus === "Inactive"
                            ? "text-rose-600"
                            : emp.employeeStatus === "Leave" || emp.employeeStatus === "On Leave"
                            ? "text-amber-600"
                            : "text-emerald-600"
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

                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                        {getEmployeeRoleLabel(emp) === "HR" ? (
                          <>
                            <UserCheck className="h-2.5 w-2.5 text-purple-600" />
                            <span className="text-purple-700 font-semibold">HR</span>
                          </>
                        ) : getEmployeeRoleLabel(emp) === "Team Lead" ? (
                          <>
                            <Crown className="h-2.5 w-2.5 text-amber-500" />
                            <span className="text-amber-700 font-semibold">TL</span>
                          </>
                        ) : (
                          getEmployeeRoleLabel(emp)
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">

                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={`mailto:${emp.email}`}
                        className="flex items-center gap-1 text-indigo-600 hover:underline truncate max-w-[55%]"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />

                        <span className="truncate">
                          {emp.email}
                        </span>
                      </a>

                      <span className="flex items-center gap-1 text-gray-500 text-[10px]">
                        <Building className="h-3 w-3 text-gray-400" />

                        <span className="truncate max-w-[60px]">
                          {emp.department?.departmentName ||
                            emp.departmentName ||
                            "N/A"}
                        </span>
                      </span>
                    </div>

                    {/* MOBILE ACTIONS */}
                    <div className="mt-2 flex flex-nowrap gap-1 overflow-x-auto">

                      <button
                        onClick={() =>
                          handleEditEmployee(emp)
                        }
                        className="inline-flex min-w-[64px] flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <Edit className="h-3 w-3 text-indigo-500" />
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteEmployee(
                            emp._id,
                            `${emp.firstName || ""} ${emp.lastName || ""
                              }`.trim()
                          )
                        }
                        className="inline-flex min-w-[64px] flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3 text-rose-500" />
                        Delete
                      </button>

                      <button
                        onClick={() =>
                          toggleTL(
                            emp._id,
                            isTeamLeadEmployee(emp)
                          )
                        }
                        title={isTeamLeadEmployee(emp) ? "Remove as Team Lead" : "Assign as Team Lead"}
                        className={`inline-flex min-w-[86px] flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium whitespace-nowrap rounded-lg transition-colors cursor-pointer ${isTeamLeadEmployee(emp)
                          ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                          : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                      >
                        {isTeamLeadEmployee(emp) ? (
                          <>
                            <UserMinus className="h-3 w-3 text-rose-500" />
                            Remove TL
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3 text-emerald-500" />
                            Assign TL
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          ADD / EDIT EMPLOYEE MODAL
      ====================================================== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div
            className="relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-fade-in border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            onClick={(e) => e.stopPropagation()}
          >

            {/* MODAL HEADER */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 id="employee-form-title" className="text-xl font-bold text-gray-900">
                    {editMode ? "Edit Employee" : "Add Employee"}
                  </h2>

                  <p className="text-sm text-gray-500 mt-0.5">
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
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* FORM */}
            <form
              onSubmit={
                editMode
                  ? handleUpdateEmployee
                  : handleAddEmployee
              }
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
            >

              {/* FULL NAME (1 per row) */}
              <div>
                <label htmlFor="employee-full-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name *
                </label>

                <input
                  id="employee-full-name"
                  name="fullName"
                  placeholder="e.g. Keyur Nai"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                />
              </div>

              {/* ROW 1: EMAIL & MOBILE NUMBER (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email *
                  </label>

                  <input
                    id="employee-email"
                    name="email"
                    type="email"
                    placeholder="e.g. itsmetilaksoni@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="employee-mobile" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mobile Number *
                  </label>

                  <input
                    id="employee-mobile"
                    name="mobile"
                    placeholder="e.g. 7896321550"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>
              </div>

              {/* ROW 2: DEPARTMENT & ROLE / DESIGNATION (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-department" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Department *
                  </label>

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
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg bg-white"
                  >
                    <option value="">Select Department</option>
                    {ALL_EMPLOYEE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    {formData.department && !ALL_EMPLOYEE_DEPARTMENTS.includes(formData.department) && (
                      <option value={formData.department}>{formData.department}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="employee-designation" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role / Designation *
                  </label>

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
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg bg-white"
                  >
                    <option value="">Select Role</option>
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
                </div>
              </div>

              {/* ROW 3: ROLE & GENDER (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-system-role" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role *
                  </label>

                  <select
                    id="employee-system-role"
                    name="role"
                    value={formData.role || "employee"}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="team lead">Team Lead</option>
                    <option value="hr">HR</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="employee-gender" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Gender *
                  </label>

                  <select
                    id="employee-gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  >
                    <option value="">Select gender</option>
                    {["Male", "Female", "Other"].map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ROW 4: DATE OF BIRTH & BLOOD GROUP (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee-dob" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of Birth *
                  </label>

                  <input
                    id="employee-dob"
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="employee-blood-group" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Blood Group *
                  </label>

                  <select
                    id="employee-blood-group"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
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
                </div>
              </div>

              {/* ADDRESS (1 per row) */}
              <div>
                <label htmlFor="employee-address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address *
                </label>

                <input
                  id="employee-address"
                  type="text"
                  name="address"
                  placeholder="e.g. 123 Main St, City, State"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white pb-1">

                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium text-white transition-colors rounded-lg shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${editMode
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "btn-brand-primary"
                    }`}
                  style={!editMode ? { background: 'linear-gradient(95.91deg, #034665 12.65%, #068DCB 77.27%)' } : undefined}
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