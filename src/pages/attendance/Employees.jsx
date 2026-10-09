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
} from "lucide-react";
import { useConfirm } from "../../components/common/ConfirmDialog";
import Toast from "../../components/common/Toast";
import { isFinanceOrExcludedUser, filterOutFinanceUsers } from "../../utils/roleFilters";

const API_BASE = "https://kt-backend-yzr4.onrender.com/api";

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

export default function Employees() {
  const { confirm, confirmationDialog } = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
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
    fetchEmployees();
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

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        "https://kt-backend-yzr4.onrender.com/api/employee/list",
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data = await res.json();

      if (data.success) {
        setEmployees(filterOutFinanceUsers(data.employees || []));
      } else {
        console.error(data.message || "Failed to fetch employees");
      }
    } catch (error) {
      console.error("Fetch employees error:", error);
    } finally {
      setLoading(false);
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
        ? `https://kt-backend-yzr4.onrender.com/api/employee/remove-tl/${employeeId}`
        : `https://kt-backend-yzr4.onrender.com/api/employee/assign-tl/${employeeId}`;

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
    if (emp?.isTeamLead || emp?.role === "team lead") {
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

    const payload = {
      ...formData,
      name: fullName,
      fullName: fullName,
      firstName: fullName,
      lastName: "",
      address: (formData.address || "").trim(),
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
      designation: employee.designation || "",
      department:
        employee.department?.departmentName ||
        employee.departmentName ||
        employee.department ||
        "",
      role: employee.role || (employee.isTeamLead ? "team lead" : "employee"),
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
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");

      const res = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/employee/edit/${selectedEmployeeId}`,
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
        `https://kt-backend-yzr4.onrender.com/api/employee/delete/${employeeId}`,
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
    if (isFinanceOrExcludedUser(emp)) return false;
    const fullName = `${emp.firstName || ""} ${emp.lastName || ""
      }`.toLowerCase();

    const search = searchTerm.toLowerCase();

    const matchesSearch =
      fullName.includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      emp.designation?.toLowerCase().includes(search);

    const matchesStatus =
      filterStatus === "all" || emp.employeeStatus === filterStatus;

    return matchesSearch && matchesStatus;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
            Employees
          </h1>

          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            View and manage all employees
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

          {/* TOTAL */}
          <div className="px-3 sm:px-4 py-2 bg-white shadow-xs border border-slate-200/80 rounded-lg flex items-center gap-1.5 sm:gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />

            <span className="text-xs sm:text-sm text-gray-600">
              Total:
            </span>

            <span className="font-semibold text-gray-900 text-xs sm:text-sm">
              {employees.length}
            </span>
          </div>

          {/* LIVE */}
          {/* <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500" />
            </span>

            <span className="text-[10px] sm:text-xs font-medium text-green-700">
              Live
            </span>
          </div> */}

          {/* ADD */}
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="h-10 px-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-xs text-xs sm:text-sm font-medium rounded-lg cursor-pointer"
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
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
              >
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

                <span className="hidden xs:inline">
                  Filters
                </span>

                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""
                    }`}
                />
              </button>
            </div>

            {/* FILTER OPTIONS */}
            {showFilters && (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-100">
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
            )}
          </div>
        </div>

        {/* ================= LOADING ================= */}
        {loading ? (
          <div className="flex justify-center items-center py-16 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
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
                            {emp.isTeamLead || emp.role === "team lead" ? (
                              <>
                                <Crown className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-amber-700 font-semibold">Team Lead</span>
                              </>
                            ) : (
                              <>
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span>Employee</span>
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
                                  emp.isTeamLead
                                )
                              }
                              title={emp.isTeamLead ? "Remove as Team Lead" : "Assign as Team Lead"}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${emp.isTeamLead
                                ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                }`}
                            >
                              {emp.isTeamLead ? (
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
                          {emp.isTeamLead || emp.role === "team lead" ? (
                            <>
                              <Crown className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-700 font-semibold">TL</span>
                            </>
                          ) : (
                            "Member"
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
                            emp.isTeamLead
                          )
                        }
                        title={emp.isTeamLead ? "Remove as Team Lead" : "Assign as Team Lead"}
                        className={`inline-flex min-w-[104px] flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors cursor-pointer ${emp.isTeamLead
                          ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                          : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                      >
                        {emp.isTeamLead ? (
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
                        {emp.isTeamLead || emp.role === "team lead" ? (
                          <>
                            <Crown className="h-2.5 w-2.5 text-amber-500" />
                            <span className="text-amber-700 font-semibold">TL</span>
                          </>
                        ) : (
                          "Member"
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
                            emp.isTeamLead
                          )
                        }
                        title={emp.isTeamLead ? "Remove as Team Lead" : "Assign as Team Lead"}
                        className={`inline-flex min-w-[86px] flex-1 items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium whitespace-nowrap rounded-lg transition-colors cursor-pointer ${emp.isTeamLead
                          ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                          : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                      >
                        {emp.isTeamLead ? (
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name *
                </label>

                <input
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email *
                  </label>

                  <input
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mobile Number *
                  </label>

                  <input
                    name="mobile"
                    placeholder="e.g. 7896321550"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>
              </div>

              {/* ROW 2: DESIGNATION & DEPARTMENT (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Designation *
                  </label>

                  <input
                    name="designation"
                    placeholder="e.g. UI/UX Designer"
                    value={formData.designation}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Department *
                  </label>

                  <input
                    type="text"
                    name="department"
                    placeholder="e.g. Design, IT, HR"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>
              </div>

              {/* ROW 3: ROLE & GENDER (2 per row) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role *
                  </label>

                  <select
                    name="role"
                    value={formData.role || "employee"}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="team lead">Team Lead</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Gender *
                  </label>

                  <select
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of Birth *
                  </label>

                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Blood Group *
                  </label>

                  <select
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address *
                </label>

                <input
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
                  className={`flex-1 px-4 py-2.5 text-sm font-medium text-white transition-colors rounded-lg shadow-xs ${editMode
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                    }`}
                >
                  {editMode
                    ? "Update Employee"
                    : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}