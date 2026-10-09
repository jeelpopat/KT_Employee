import React, { useEffect, useRef, useState } from "react";
import { useConfirm } from "../components/common/ConfirmDialog";
import { FileText, Edit3, ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { isFinanceOrExcludedUser, filterOutFinanceUsers } from "../utils/roleFilters";

const Performance = () => {
  const { confirm, confirmationDialog } = useConfirm();
  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };

  const [employees, setEmployees] = useState([]);
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [editingId, setEditingId] = useState(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [isEmployeeMenuOpen, setIsEmployeeMenuOpen] = useState(false);
  const employeeMenuRef = useRef(null);

  const [form, setForm] = useState({
    employeeID: "",
    percentage: "",
    remarks: "",
  });

  useEffect(() => {
    fetchEmployees();
    fetchAllPerformances();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        employeeMenuRef.current &&
        !employeeMenuRef.current.contains(event.target)
      ) {
        setIsEmployeeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: "", type: "" });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
  };

  // ============================================================
  // GET EMPLOYEE DISPLAY NAME
  // ============================================================

  const getEmployeeDisplayName = (perf) => {
    if (!perf) return "Unknown Employee";

    if (perf.employeeID) {
      if (typeof perf.employeeID === "object") {
        const emp = perf.employeeID;

        if (emp.name) return emp.name;

        if (emp.firstName && emp.lastName) {
          return `${emp.firstName} ${emp.lastName}`;
        }

        if (emp.firstName) return emp.firstName;

        if (emp.fullName) return emp.fullName;

        if (emp.displayName) return emp.displayName;
      }
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

    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return "Unknown Employee";
  };

  // ============================================================
  // GET EMPLOYEE TYPE
  // ============================================================

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
        return rawType ? String(rawType) : "N/A";
    }
  };

  // ============================================================
  // GET PERFORMANCE PERCENTAGE
  // ============================================================

  const getPerformancePercentage = (perf) => {
    const percentage =
      perf?.performancePercentage ??
      perf?.percentage ??
      perf?.performance?.performancePercentage ??
      "";

    if (percentage === "" || percentage === null || percentage === undefined) {
      return "-";
    }

    return `${percentage}%`;
  };

  // ============================================================
  // FETCH ALL PERFORMANCES
  // ============================================================

  const fetchAllPerformances = async () => {
    try {
      const response = await fetch(
        "https://kt-backend-yzr4.onrender.com/api/performance/all",
        { headers }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch performances");
      }

      const data = await response.json();

      console.log("Performance API:", data);

      if (data.success) {
        const rawPerfs = Array.isArray(data.data) ? data.data : [];
        const filteredPerfs = rawPerfs.filter((perf) => {
          if (!perf) return false;
          if (isFinanceOrExcludedUser(perf)) return false;
          if (perf.employeeID && isFinanceOrExcludedUser(perf.employeeID)) return false;
          if (perf.employee && isFinanceOrExcludedUser(perf.employee)) return false;
          return true;
        });
        setPerformances(filteredPerfs);
      }
    } catch (err) {
      console.error("Error fetching performances:", err);

      showNotification(
        "Failed to load performance history",
        "warning"
      );
    }
  };

  // ============================================================
  // FETCH EMPLOYEES + TEAM LEADS
  // ============================================================

  const fetchEmployees = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const commonHeaders = {
        Authorization: `Bearer ${token}`,
      };

      const [
        employeeResponse,
        usersResponse,
        teamLeadResponse,
      ] = await Promise.all([
        fetch(
          "https://kt-backend-yzr4.onrender.com/api/employee/list",
          { headers: commonHeaders }
        ),

        fetch(
          "https://kt-backend-yzr4.onrender.com/api/users/all",
          { headers: commonHeaders }
        ),

        fetch(
          "https://kt-backend-yzr4.onrender.com/api/teamLead/team",
          { headers: commonHeaders }
        ),
      ]);

      const employeeData = await employeeResponse.json();
      const usersData = await usersResponse.json();
      const teamLeadData = await teamLeadResponse.json();

      // ========================================================
      // 1. EMPLOYEES
      // ========================================================

      let employeeList = [];

      if (Array.isArray(employeeData)) {
        employeeList = employeeData;
      } else if (Array.isArray(employeeData.users)) {
        employeeList = employeeData.users;
      } else if (Array.isArray(employeeData.data)) {
        employeeList = employeeData.data;
      } else if (Array.isArray(employeeData.employees)) {
        employeeList = employeeData.employees;
      }

      const employees = employeeList
        .filter((emp) => emp && !isFinanceOrExcludedUser(emp))
        .map((employee) => ({
          _id:
            employee._id ||
            employee.id ||
            employee.userId,

          name:
            employee.name ||
            employee.fullName ||
            employee.displayName ||
            `${employee.firstName || ""} ${
              employee.lastName || ""
            }`.trim() ||
            "Unknown Employee",

          email:
            employee.email ||
            employee.employeeEmail ||
            employee.user?.email ||
            "",

          type: "employee",

          role:
            employee.role ||
            employee.user?.role ||
            "employee",
        }))
        .filter((employee) => employee._id);



      // ========================================================
      // 3. TEAM LEADS
      // ========================================================

      const teamLeadList =
        teamLeadData.teamLeads ||
        teamLeadData.data ||
        teamLeadData.teamlead ||
        teamLeadData.teams ||
        [];

      const teamLeads = Array.isArray(teamLeadList)
        ? teamLeadList
            .filter((tl) => {
              if (!tl || isFinanceOrExcludedUser(tl)) return false;
              const u = tl.user || tl.employee || tl.teamLead;
              if (u && isFinanceOrExcludedUser(u)) return false;
              return true;
            })
            .map((teamLead) => {
              const user =
                teamLead.user ||
                teamLead.employee ||
                teamLead.teamLead ||
                teamLead;

              return {
                _id:
                  user?._id ||
                  user?.id ||
                  teamLead._id ||
                  teamLead.id ||
                  teamLead.userId,

                name:
                  user?.name ||
                  user?.fullName ||
                  user?.displayName ||
                  `${user?.firstName || ""} ${
                    user?.lastName || ""
                  }`.trim() ||
                  teamLead.name ||
                  teamLead.fullName ||
                  "Unknown Team Lead",

                email:
                  user?.email ||
                  teamLead.email ||
                  "",

                type: "teamlead",

                role: "teamlead",
              };
            })
            .filter((teamLead) => teamLead._id)
        : [];

      // ========================================================
      // MERGE ALL
      // ========================================================

      const combinedEmployees = [
        ...employees,
        ...teamLeads,
      ];

      // Remove duplicate IDs
      const uniqueEmployees = Array.from(
        new Map(
          combinedEmployees.map((employee) => [
            employee._id,
            employee,
          ])
        ).values()
      );

      console.log(
        "Performance Employees:",
        uniqueEmployees
      );

      console.log("Employees:", employees);
      console.log("Team Leads:", teamLeads);

      setEmployees(uniqueEmployees);
    } catch (err) {
      console.error(
        "Error fetching employees and team leads:",
        err
      );

      showNotification(
        "Failed to load employees and team leads",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // HANDLE FORM CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });
  };

  const handleEmployeeSelect = (employeeId) => {
    setForm((currentForm) => ({
      ...currentForm,
      employeeID: employeeId,
    }));
    setIsEmployeeMenuOpen(false);
  };

  // ============================================================
  // VALIDATE FORM
  // ============================================================

  const validateForm = () => {
    if (!form.employeeID) {
      showNotification(
        "Please select an employee",
        "error"
      );

      return false;
    }

    if (
      form.percentage === "" ||
      Number(form.percentage) < 0 ||
      Number(form.percentage) > 100 ||
      Number.isNaN(Number(form.percentage))
    ) {
      showNotification(
        "Please enter a percentage between 0 and 100",
        "error"
      );

      return false;
    }

    return true;
  };

  // ============================================================
  // SUBMIT PERFORMANCE
  // ============================================================

  const submitPerformance = async () => {
    if (!validateForm()) return;

    setSubmitting(true);

    // IMPORTANT:
    // Backend expects performancePercentage
    const payload = {
      employeeID: form.employeeID,
      performancePercentage: Number(form.percentage),
      remarks: form.remarks || "",
    };

    console.log(
      "Performance Submit Payload:",
      payload
    );

    try {
      const response = await fetch(
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

      const data = await response.json();

      console.log(
        "Performance Create Response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to submit performance"
        );
      }

      showNotification(
        "Performance submitted successfully!",
        "success"
      );

      await fetchAllPerformances();

      setForm({
        employeeID: "",
        percentage: "",
        remarks: "",
      });
    } catch (err) {
      console.error(
        "Error submitting performance:",
        err
      );

      showNotification(
        err.message ||
          "Failed to submit performance. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RESET FORM
  // ============================================================

  const resetForm = () => {
    setForm({
      employeeID: "",
      percentage: "",
      remarks: "",
    });

    setEditingId(null);
    setEditRemarks("");

    showNotification(
      "Form has been reset",
      "info"
    );
  };

  // ============================================================
  // EDIT PERFORMANCE
  // ============================================================

  const handleEditPerformance = (perf) => {
    setEditingId(perf._id);
    setEditRemarks(perf.remarks || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // UPDATE PERFORMANCE
  // ============================================================

  const handleUpdatePerformance = async () => {
    if (!editRemarks.trim()) {
      showNotification(
        "Please enter some remarks",
        "error"
      );

      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/performance/update/${editingId}`,
        {
          method: "PUT",

          headers: {
            ...headers,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            remarks: editRemarks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update performance"
        );
      }

      showNotification(
        "Performance updated successfully!",
        "success"
      );

      await fetchAllPerformances();

      setEditingId(null);
      setEditRemarks("");
    } catch (err) {
      console.error(
        "Error updating performance:",
        err
      );

      showNotification(
        err.message ||
          "Failed to update performance. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // DELETE PERFORMANCE
  // ============================================================

  const handleDeletePerformance = async (perf) => {
    const employeeName =
      getEmployeeDisplayName(perf);

    const confirmed = await confirm({
      title: "Delete performance record?",
      message: `Are you sure you want to delete performance record for ${employeeName}?`,
      confirmLabel: "Delete",
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `https://kt-backend-yzr4.onrender.com/api/performance/delete/${perf._id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to delete performance"
        );
      }

      showNotification(
        `Performance record for ${employeeName} deleted successfully!`,
        "success"
      );

      await fetchAllPerformances();
    } catch (err) {
      console.error(
        "Error deleting performance:",
        err
      );

      showNotification(
        "Failed to delete performance. Please try again.",
        "error"
      );
    }
  };

  // ============================================================
  // CANCEL EDIT
  // ============================================================

  const cancelEdit = () => {
    setEditingId(null);
    setEditRemarks("");
  };

  // ============================================================
  // NOTIFICATION
  // ============================================================

  const Notification = () => {
    if (!notification.message) return null;

    const bgColor = {
      success:
        "bg-green-100 border-green-400 text-green-700",

      error:
        "bg-red-100 border-red-400 text-red-700",

      warning:
        "bg-yellow-100 border-yellow-400 text-yellow-700",

      info:
        "bg-blue-100 border-blue-400 text-blue-700",
    };

    return (
      <div
        className={`fixed top-4 right-4 z-50 px-4 sm:px-6 py-3 sm:py-4 rounded-lg border max-w-[90%] sm:max-w-md ${
          bgColor[notification.type] ||
          bgColor.info
        }`}
      >
        <div className="flex items-center text-sm sm:text-base">
          <span className="mr-2 sm:mr-3">
            {notification.type === "success" &&
              "✅"}

            {notification.type === "error" &&
              "❌"}

            {notification.type === "warning" &&
              "⚠️"}

            {notification.type === "info" &&
              "ℹ️"}
          </span>

          <span className="break-words">
            {notification.message}
          </span>
        </div>
      </div>
    );
  };

  // ============================================================
  // PERFORMANCE LIST
  // ============================================================

  const PerformanceList = () => {
    if (performances.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
          No performance records found
        </div>
      );
    }

    return (
      <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">

        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            Performance History
          </span>
        </h3>

        {/* ======================================================
            MOBILE CARD VIEW
        ====================================================== */}

        <div className="block md:hidden space-y-4">
          {performances.map((perf) => (
            <div
              key={perf._id}
              className="rounded-lg p-4 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-2">

                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">
                    {getEmployeeDisplayName(perf)}
                  </div>

                  <div className="text-xs text-gray-500">
                    {perf.employeeID?.email ||
                      perf.employeeEmail ||
                      "No email"}
                  </div>
                </div>

                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                    getEmployeeTypeLabel(perf) ===
                    "Employee"
                      ? "bg-blue-100 text-blue-800"
                      : getEmployeeTypeLabel(perf) ===
                        "Team Lead"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {getEmployeeTypeLabel(perf)}
                </span>
              </div>

              {/* Percentage */}
              <div className="mb-2">
                <div className="text-xs text-gray-500">
                  Performance:
                </div>

                <div className="text-lg font-bold text-indigo-600">
                  {getPerformancePercentage(perf)}
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-2">
                <div className="text-xs text-gray-500">
                  Remarks:
                </div>

                <div className="text-sm text-gray-700 break-words">
                  {perf.remarks || "-"}
                </div>
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">

                <div className="text-xs text-gray-500">
                  {new Date(
                    perf.createdAt
                  ).toLocaleDateString()}
                </div>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      handleEditPerformance(perf)
                    }
                    className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition duration-150"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeletePerformance(perf)
                    }
                    className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition duration-150"
                  >
                    Delete
                  </button>

                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ======================================================
            DESKTOP TABLE VIEW
        ====================================================== */}

        <div className="hidden md:block overflow-x-auto">

          <table className="min-w-full divide-y divide-gray-200">

            <thead className="bg-gray-50">
              <tr>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentage
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remarks
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">

              {performances.map((perf) => (
                <tr
                  key={perf._id}
                  className="hover:bg-gray-50"
                >

                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>

                      <div className="text-sm font-medium text-gray-900">
                        {getEmployeeDisplayName(perf)}
                      </div>

                      <div className="text-sm text-gray-500">
                        {perf.employeeID?.email ||
                          perf.employeeEmail ||
                          "No email"}
                      </div>

                    </div>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">

                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        getEmployeeTypeLabel(
                          perf
                        ) === "Employee"
                          ? "bg-blue-100 text-blue-800"
                          : getEmployeeTypeLabel(
                              perf
                            ) === "Team Lead"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {getEmployeeTypeLabel(perf)}
                    </span>

                  </td>

                  {/* Percentage */}
                  <td className="px-4 py-4 whitespace-nowrap">

                    <span className="text-sm font-bold text-indigo-600">
                      {getPerformancePercentage(perf)}
                    </span>

                  </td>

                  {/* Remarks */}
                  <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {perf.remarks || "-"}
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(
                      perf.createdAt
                    ).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">

                    <div className="flex gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          handleEditPerformance(perf)
                        }
                        className="px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition duration-150"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeletePerformance(perf)
                        }
                        className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition duration-150"
                      >
                        Delete
                      </button>

                    </div>

                  </td>

                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="min-h-screen py-4 sm:py-8 px-3 sm:px-4 lg:px-8">
      {confirmationDialog}

      <Notification />

      <div className="max-w-6xl mx-auto">

        <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden">

          {loading ? (
            <div className="flex justify-center items-center py-16 sm:py-20">

              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>

            </div>
          ) : (
            <div className="p-4 sm:p-6 md:p-8">

              <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">

              <div className="border border-gray-200 rounded-lg p-4 sm:p-5">

              {/* ==================================================
                  EDIT MODE
              ================================================== */}

              {editingId ? (
                <div className="mb-6">

                  <div className="border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">

                    <p className="text-blue-800 font-medium text-sm sm:text-base flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-blue-600" />
                      Editing Performance
                    </p>

                    <p className="text-blue-600 text-xs sm:text-sm">
                      Updating remarks for:{" "}
                      {performances.find(
                        (p) => p._id === editingId
                      )
                        ? getEmployeeDisplayName(
                            performances.find(
                              (p) =>
                                p._id === editingId
                            )
                          )
                        : "Unknown"}
                    </p>

                  </div>

                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Edit Remarks
                  </label>

                  <textarea
                    rows={5}
                    value={editRemarks}
                    onChange={(e) =>
                      setEditRemarks(e.target.value)
                    }
                    placeholder="Edit remarks..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 sm:p-4 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition duration-200 resize-none text-sm sm:text-base"
                  />

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4">

                    <button
                      onClick={
                        handleUpdatePerformance
                      }
                      disabled={submitting}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 text-sm sm:text-base"
                    >
                      {submitting ? (
                        "Updating..."
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle className="h-4 w-4" /> Update Performance
                        </span>
                      )}
                    </button>

                    <button
                      onClick={cancelEdit}
                      disabled={submitting}
                      className="px-4 sm:px-6 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-2.5 sm:py-3 rounded-xl transition duration-200 text-sm sm:text-base"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <XCircle className="h-4 w-4 text-gray-500" /> Cancel
                      </span>
                    </button>

                  </div>
                </div>
              ) : (
                <>
                  {/* ==================================================
                      EMPLOYEE SELECTION
                  ================================================== */}

                  <div className="mb-6">

                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Employee *
                    </label>

                    <div ref={employeeMenuRef} className="relative w-full max-w-[230px]">
                      <button
                        type="button"
                        onClick={() => setIsEmployeeMenuOpen((isOpen) => !isOpen)}
                        className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 text-left text-xs sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                        aria-haspopup="listbox"
                        aria-expanded={isEmployeeMenuOpen}
                      >
                        <span className={form.employeeID ? "text-gray-900" : "text-gray-500"}>
                          {employees.find((employee) => employee._id === form.employeeID)?.name ||
                            "-- Select an Employee --"}
                        </span>
                        <svg
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                            isEmployeeMenuOpen ? "rotate-180" : ""
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {isEmployeeMenuOpen && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                          {["employee", "teamlead"].map((type) => {
                            const matchingEmployees = employees.filter(
                              (employee) => employee.type === type
                            );

                            if (matchingEmployees.length === 0) return null;

                            return (
                              <div key={type}>
                                <div className="border-b border-gray-100 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-gray-500">
                                  {type === "teamlead" ? "Team Leads" : `${type}s`}
                                </div>
                                {matchingEmployees.map((employee) => (
                                  <button
                                    key={employee._id}
                                    type="button"
                                    role="option"
                                    aria-selected={form.employeeID === employee._id}
                                    onClick={() => handleEmployeeSelect(employee._id)}
                                    className={`block w-full px-2.5 py-2 text-left text-xs transition-colors ${
                                      form.employeeID === employee._id
                                        ? "bg-indigo-50 font-medium text-indigo-700"
                                        : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    {employee.name}
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {employees.length === 0 &&
                      !loading && (
                        <p className="text-yellow-600 text-xs sm:text-sm mt-2">
                          ⚠️ No employees available for
                          evaluation
                        </p>
                      )}

                    {employees.length > 0 && (
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        Total: {employees.length} (
                        {
                          employees.filter(
                            (e) =>
                              e.type === "employee"
                          ).length
                        }{" "}
                        employees,{" "}
                        {
                          employees.filter(
                            (e) =>
                              e.type === "teamlead"
                          ).length
                        }{" "}
                        team leads)
                      </p>
                    )}

                  </div>

                  {/* ==================================================
                      PERFORMANCE FORM
                  ================================================== */}

                  <div className="mb-6 space-y-6">

                      {/* Percentage */}

                      <div>

                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Performance Percentage *
                        </label>

                        <div className="relative">

                          <input
                            type="number"
                            name="percentage"
                            min="0"
                            max="100"
                            step="1"
                            value={form.percentage}
                            onChange={handleChange}
                            placeholder="Enter percentage"
                            className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 text-sm sm:text-base"
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                            %
                          </span>

                        </div>

                      </div>

                      {/* Remarks */}

                      <div>

                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-600" />
                          Remarks
                        </label>

                        <textarea
                          rows={5}
                          name="remarks"
                          value={form.remarks}
                          onChange={handleChange}
                          placeholder="Add your remarks about the employee's performance..."
                          className="w-full border border-gray-300 rounded-lg p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 resize-none text-sm sm:text-base"
                        />

                      </div>

                  </div>

                  {/* ==================================================
                      ACTION BUTTONS
                  ================================================== */}

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
 
                    <button
                      onClick={submitPerformance}
                      disabled={
                        submitting ||
                        loading ||
                        !form.employeeID
                      }
                      className="flex-1 bg-slate-300 hover:bg-slate-400 border border-slate-400 text-black font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >

                      {submitting ? (
                        <span className="flex items-center justify-center">

                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-black"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >

                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />

                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />

                          </svg>

                          Submitting...

                        </span>
                      ) : (
                        "Save"
                      )}

                    </button>

                    <button
                      onClick={resetForm}
                      disabled={submitting}
                      className="px-4 sm:px-6 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-2.5 sm:py-3 rounded-xl transition duration-200 disabled:opacity-50 text-sm sm:text-base"
                    >
                      Reset
                    </button>

                  </div>
                </>
              )}

                </div>

                <div className="min-w-0">
                {/* ==================================================
                  PERFORMANCE LIST
                ================================================== */}

              <PerformanceList />

                </div>
                </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Performance;