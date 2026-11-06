import { useState, useEffect } from "react";
import { LoadingScreen } from "../../components/common/Loader.jsx";
import { useLocation } from "react-router-dom";
import Toast, { showToast } from "../../components/common/Toast";
import {
  Settings,
  X,
  Save,
  RotateCcw,
  Clock,
  Loader2,
} from "lucide-react";
import { isFinanceOrExcludedUser, isUnknownEmployeeOrUser } from "../../utils/roleFilters";
import { BASE_URL } from "../../api/config.js";

// Helper to reliably format any date string/object/timestamp to YYYY-MM-DD for HTML date inputs
export const formatDateForInput = (raw) => {
  if (!raw) return "";

  // 1. If already valid YYYY-MM-DD
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }

  // 2. If DD-MM-YYYY or DD/MM/YYYY
  if (typeof raw === "string") {
    const dmy = raw.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  // 3. If starts with YYYY-MM-DD (e.g. ISO string with time)
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw.trim())) {
    try {
      const d = new Date(raw.trim());
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
    } catch (e) {}
    return raw.trim().split("T")[0];
  }

  // 4. Try generic date parsing (handles "22 Oct 2026", Date objects, timestamps)
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}

  return "";
};

const isValidDateInput = (value) => {
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

export default function Adjustments() {
  const location = useLocation();

  // ============================================================
  // DEFAULT ATTENDANCE SETTINGS
  // ============================================================

  const DEFAULT_SETTINGS = {
    officeStartTime: "10:00",
    lateAfter: "10:10",
    halfDayAfter: "10:30",
    absentAfter: "15:00",
    officeEndTime: "19:00",
    minimumPresentHours: "8",
    minimumHalfDayHours: "4",
    breakLimitMinutes: "60",
  };

  // ============================================================
  // EMPTY SESSION
  // ============================================================

  const emptySession = {
    checkin: "",
    breakStart: "",
    breakEnd: "",
    checkout: "",
  };

  // ============================================================
  // INITIAL FORM
  // ============================================================

  const initialForm = {
    employeeId: location.state?.adjustmentEmployeeId
      ? String(location.state.adjustmentEmployeeId)
      : "",
    date: "",
    sessions: [{ ...emptySession }],
    reason: "",
  };

  const [formData, setFormData] = useState(initialForm);

  // ============================================================
  // BASIC STATES
  // ============================================================

  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");

  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);

  const [sessionCount, setSessionCount] = useState(1);

  // ============================================================
  // EDIT MODE
  // ============================================================

  const [editMode, setEditMode] = useState(false);

  const [selectedAdjustment, setSelectedAdjustment] =
    useState(null);

  // ============================================================
  // CHECKBOX STATE
  // ============================================================

  const [selectedFields, setSelectedFields] = useState([
    {
      checkin: false,
      breakStart: false,
      breakEnd: false,
      checkout: false,
    },
  ]);

  // ============================================================
  // ATTENDANCE SETTINGS
  // ============================================================

  const [attendanceSettings, setAttendanceSettings] =
    useState(DEFAULT_SETTINGS);

  const [tempSettings, setTempSettings] =
    useState(DEFAULT_SETTINGS);

  const [showSettings, setShowSettings] =
    useState(false);

  const API_BASE_URL =
    `${BASE_URL}/api`;

  // ============================================================
  // LOAD ATTENDANCE SETTINGS
  // ============================================================

  useEffect(() => {
    try {
      const savedSettings =
        localStorage.getItem(
          "attendanceSettings"
        );

      if (savedSettings) {
        const parsedSettings =
          JSON.parse(savedSettings);

        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        };

        setAttendanceSettings(
          mergedSettings
        );

        setTempSettings(
          mergedSettings
        );
      }
    } catch (error) {
      console.error(
        "Failed to load attendance settings:",
        error
      );

      setAttendanceSettings(
        DEFAULT_SETTINGS
      );

      setTempSettings(
        DEFAULT_SETTINGS
      );
    }
  }, []);

  // ============================================================
  // OPEN SETTINGS
  // ============================================================

  const openSettings = () => {
    setTempSettings({
      ...attendanceSettings,
    });

    setShowSettings(true);
  };

  // ============================================================
  // CLOSE SETTINGS
  // ============================================================

  const closeSettings = () => {
    setTempSettings({
      ...attendanceSettings,
    });

    setShowSettings(false);
  };

  // ============================================================
  // SETTINGS INPUT CHANGE
  // ============================================================

  const handleSettingChange = (
    field,
    value
  ) => {
    setTempSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ============================================================
  // SAVE SETTINGS
  // ============================================================

  const saveAttendanceSettings = () => {
    setNotification("");
    // --------------------------------------------
    // Validate timings
    // --------------------------------------------

    if (
      !tempSettings.officeStartTime ||
      !tempSettings.lateAfter ||
      !tempSettings.absentAfter ||
      !tempSettings.officeEndTime
    ) {
      showToast("Please fill all attendance timings.", "error");
      return;
    }

    if (
      tempSettings.lateAfter <=
      tempSettings.officeStartTime
    ) {
      showToast("Late After time must be greater than Office Start Time.", "error");
      return;
    }

    if (
      tempSettings.absentAfter <=
      tempSettings.lateAfter
    ) {
      showToast("Absent After time must be greater than Late After time.", "error");
      return;
    }

    if (
      tempSettings.officeEndTime <=
      tempSettings.absentAfter 
    ) {
      showToast("Office End Time must be greater than Absent After time.", "error");
      return;
    }

    // --------------------------------------------
    // Validate hours
    // --------------------------------------------

    if (
      Number(
        tempSettings.minimumPresentHours
      ) <= 0
    ) {
      showToast("Minimum Present Hours must be greater than 0.", "error");
      return;
    }

    if (
      Number(
        tempSettings.minimumHalfDayHours
      ) <= 0
    ) {
      showToast("Minimum Half-Day Hours must be greater than 0.", "error");
      return;
    }

    if (
      Number(
        tempSettings.minimumHalfDayHours
      ) >=
      Number(
        tempSettings.minimumPresentHours
      )
    ) {
      showToast("Half-Day hours must be less than Present hours.", "error");
      return;
    }

    // --------------------------------------------
    // Save
    // --------------------------------------------

    localStorage.setItem(
      "attendanceSettings",
      JSON.stringify(tempSettings)
    );

    setAttendanceSettings({
      ...tempSettings,
    });

    setShowSettings(false);

    setNotification(
      "Attendance settings saved successfully!"
    );
    showToast("Attendance settings saved successfully!", "success");
  };

  // ============================================================
  // RESET SETTINGS
  // ============================================================

  const resetAttendanceSettings = () => {
    const confirmReset =
      window.confirm(
        "Are you sure you want to reset attendance settings to default?"
      );

    if (!confirmReset) {
      return;
    }

    localStorage.setItem(
      "attendanceSettings",
      JSON.stringify(
        DEFAULT_SETTINGS
      )
    );

    setAttendanceSettings({
      ...DEFAULT_SETTINGS,
    });

    setTempSettings({
      ...DEFAULT_SETTINGS,
    });

    setNotification(
      "Attendance settings reset to default."
    );
  };

  // ============================================================
  // FETCH EMPLOYEES + HISTORY
  // ============================================================

  useEffect(() => {
    const fetchAllEmployees = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");

        const headers = token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {};

        const employeeMap = new Map();

        // 1. Fetch all users from /users/all (Includes HR, Team Lead, Employee, Admin, etc.)
        try {
          const usersRes = await fetch(`${API_BASE_URL}/users/all`, { headers });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const usersList = usersData.users || usersData.data || [];
            usersList.forEach((user) => {
              if (!user || !user._id || isFinanceOrExcludedUser(user) || isUnknownEmployeeOrUser(user)) return;
              const name =
                user.name ||
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                "Unknown User";

              employeeMap.set(String(user._id), {
                id: user._id,
                name: name,
                employeeId: user.uniqueID || user.employeeID || user.employeeId || "",
                roleType: user.role || "employee",
                department: user.department || user.dept || "",
                designation: user.designation || user.jobTitle || "",
              });
            });
          }
        } catch (uErr) {
          console.warn("Error fetching /users/all:", uErr);
        }

        // 2. Fetch all employees from /employee/list
        try {
          const empRes = await fetch(`${API_BASE_URL}/employee/list`, { headers });
          if (empRes.ok) {
            const empData = await empRes.json();
            const empList = empData.employees || empData.data || [];
            empList.forEach((emp) => {
              if (!emp || isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return;
              const userIdKey = emp.userID
                ? String(emp.userID)
                : emp._id
                ? String(emp._id)
                : null;
              if (!userIdKey) return;

              const existing = employeeMap.get(userIdKey) || {};
              const empName =
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                emp.name;

              const resolvedRole =
                emp.role ||
                (emp.isTeamLead
                  ? "team lead"
                  : emp.designation || existing.roleType || "employee");

              employeeMap.set(userIdKey, {
                id: emp.userID || emp._id,
                name: empName || existing.name || "Unknown Employee",
                employeeId:
                  emp.uniqueID ||
                  emp.employeeID ||
                  emp.employeeId ||
                  existing.employeeId ||
                  "",
                roleType: resolvedRole,
                department: emp.department || emp.dept || existing.department || "",
                designation: emp.designation || emp.jobTitle || existing.designation || "",
              });
            });
          }
        } catch (eErr) {
          console.warn("Error fetching /employee/list:", eErr);
        }

        // 3. Complementary fetch from /attendance/admin/all
        try {
          const attendanceRes = await fetch(
            `${API_BASE_URL}/attendance/admin/all`,
            { headers }
          );

          if (attendanceRes.ok) {
            const attendanceData = await attendanceRes.json();
            const attendanceList =
              attendanceData.data ||
              attendanceData.attendance ||
              attendanceData.records ||
              [];

            attendanceList.forEach((item) => {
              const emp =
                item.userId || item.employeeId || item.employee || {};

              if (!emp || !emp._id || isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return;
              const key = String(emp._id);

              if (!employeeMap.has(key)) {
                employeeMap.set(key, {
                  id: emp._id,
                  name:
                    `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                    emp.name ||
                    "Unknown Employee",
                  employeeId: emp.employeeID || emp.employeeId || "",
                  roleType: emp.role || "employee",
                  department: emp.department || emp.dept || "",
                  designation: emp.designation || emp.jobTitle || "",
                });
              }
            });
          }
        } catch (aErr) {
          console.warn("Error fetching /attendance/admin/all:", aErr);
        }

        const employeeList = Array.from(employeeMap.values())
          .filter((emp) => {
            if (isFinanceOrExcludedUser(emp) || isUnknownEmployeeOrUser(emp)) return false;
            const role = (emp.roleType || "").toLowerCase().trim();
            const id = (emp.employeeId || "").toUpperCase().trim();
            return role !== "admin" && !id.startsWith("ADMIN");
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setEmployees(employeeList);

        // Auto-cleanup local adjustments referencing deleted employees
        try {
          const localAdjs = JSON.parse(localStorage.getItem("localAdjustments") || "[]");
          const cleanedLocal = cleanOrphanedAdjustments(localAdjs, employeeList);
          localStorage.setItem("localAdjustments", JSON.stringify(cleanedLocal));
        } catch (e) {
          console.warn("Clean local adjustments error:", e);
        }

        if (employeeList.length === 0) {
          setError("No employees found.");
        }

        await fetchRecentAdjustments(employeeList);
      } catch (err) {
        console.error(err);
        setEmployees([]);
        setError(err.message || "Unable to load employees.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllEmployees();
  }, []);

  // ============================================================
  // EMPLOYEE NAME RESOLVER & CLEANUP
  // ============================================================

  const getEmployeeName = (empId) => {
    if (!empId) return "";
    const idStr = typeof empId === "object" ? String(empId._id || empId.id || "") : String(empId);
    const found = employees.find(
      (e) => String(e.id) === idStr || String(e._id) === idStr || String(e.employeeId) === idStr
    );
    return found ? found.name : "";
  };

  const cleanOrphanedAdjustments = (adjsList, currentEmployees) => {
    if (!Array.isArray(adjsList) || !Array.isArray(currentEmployees) || currentEmployees.length === 0) {
      return adjsList || [];
    }
    const validEmpIds = new Set();
    currentEmployees.forEach((emp) => {
      if (emp.id) validEmpIds.add(String(emp.id));
      if (emp._id) validEmpIds.add(String(emp._id));
      if (emp.employeeId) validEmpIds.add(String(emp.employeeId));
    });

    return adjsList.filter((item) => {
      if (!item) return false;
      const empId = typeof item.employeeId === "object" ? (item.employeeId?._id || item.employeeId?.id) : item.employeeId;
      return empId && validEmpIds.has(String(empId));
    });
  };

  // ============================================================
  // FETCH ADJUSTMENT HISTORY
  // ============================================================

  const fetchRecentAdjustments = async (currentEmployeesList = null) => {
    setFetchingLogs(true);
    const activeList = currentEmployeesList || employees;

    try {
      const localAdjs = JSON.parse(localStorage.getItem("localAdjustments") || "[]");
      let backendData = [];

      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/adjustment/history`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
              backendData = data.data;
            }
          }
        } catch (apiErr) {
          // Endpoint may not exist on backend, fall back to local
        }
      }

      const combined = [...localAdjs, ...backendData];
      const cleaned = cleanOrphanedAdjustments(combined, activeList);

      const uniqueMap = new Map();
      cleaned.forEach((item) => {
        if (!item) return;
        const normalizedDate = formatDateForInput(
          item.date ||
          item.attendanceDate ||
          item.checkInTime ||
          item.inTime ||
          item.createdAt ||
          item.dateStr ||
          item.day ||
          ""
        );
        if (normalizedDate && (!item.date || item.date !== normalizedDate)) {
          item.date = normalizedDate;
        }
        const empId = typeof item.employeeId === "object" ? (item.employeeId?._id || item.employeeId?.id) : item.employeeId;
        const key = `${empId || "unknown"}-${normalizedDate || item.date || ""}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });

      setRecentAdjustments(
        Array.from(uniqueMap.values())
          .filter((item) => !isUnknownEmployeeOrUser(item) && !isUnknownEmployeeOrUser(item.employeeName))
          .slice(0, 10)
      );
    } catch (error) {
      console.error("Error fetching adjustments:", error);
    } finally {
      setFetchingLogs(false);
    }
  };

  // ============================================================
  // SESSION CHANGE
  // ============================================================

  const handleSessionChange = (
    index,
    field,
    value
  ) => {
    const newSessions = [
      ...formData.sessions,
    ];

    newSessions[index] = {
      ...newSessions[index],
      [field]: value,
    };

    setFormData((prev) => ({
      ...prev,
      sessions:
        newSessions,
    }));
  };

  // ============================================================
  // CHECKBOX CHANGE
  // ============================================================

  const handleFieldCheckbox = (
    sessionIndex,
    field,
    checked
  ) => {
    setSelectedFields(
      (prev) => {
        const updated = [
          ...prev,
        ];

        if (
          !updated[
            sessionIndex
          ]
        ) {
          updated[
            sessionIndex
          ] = {
            checkin: false,
            breakStart: false,
            breakEnd: false,
            checkout: false,
          };
        }

        updated[
          sessionIndex
        ] = {
          ...updated[
            sessionIndex
          ],
          [field]: checked,
        };

        return updated;
      }
    );
  };

  // ============================================================
  // CHECK ALL FIELDS
  // ============================================================

  const areAllFieldsSelected =
    () => {
      if (
        !selectedFields.length
      ) {
        return false;
      }

      return selectedFields.every(
        (sessionFields) =>
          sessionFields.checkin &&
          sessionFields.breakStart &&
          sessionFields.breakEnd &&
          sessionFields.checkout
      );
    };

  // ============================================================
  // UPDATE METHOD
  // ============================================================

  const getUpdateMethod = () => {
    return areAllFieldsSelected()
      ? "PUT"
      : "PATCH";
  };

  // ============================================================
  // ADD SESSION
  // ============================================================

  const addSession = () => {
    if (
      sessionCount >= 2
    ) {
      showToast("Maximum 2 sessions allowed", "warning");
      return;
    }

    setFormData(
      (prev) => ({
        ...prev,

        sessions: [
          ...prev.sessions,
          {
            ...emptySession,
          },
        ],
      })
    );

    setSelectedFields(
      (prev) => [
        ...prev,
        {
          checkin: false,
          breakStart: false,
          breakEnd: false,
          checkout: false,
        },
      ]
    );

    setSessionCount(
      (prev) => prev + 1
    );
  };

  // ============================================================
  // REMOVE SESSION
  // ============================================================

  const removeSession = () => {
    if (
      sessionCount <= 1
    ) {
      showToast("Minimum 1 session required", "warning");
      return;
    }

    setFormData(
      (prev) => ({
        ...prev,

        sessions:
          prev.sessions.slice(
            0,
            -1
          ),
      })
    );

    setSelectedFields(
      (prev) =>
        prev.slice(0, -1)
    );

    setSessionCount(
      (prev) => prev - 1
    );
  };

  // ============================================================
  // AUTO FETCH & PREFILL ATTENDANCE TIMINGS
  // ============================================================

  const formatTimeToHHMM = (timeVal) => {
    if (!timeVal) return "";
    try {
      if (typeof timeVal === "string" && /^\d{2}:\d{2}$/.test(timeVal.trim())) {
        return timeVal.trim();
      }
      const d = new Date(timeVal);
      if (isNaN(d.getTime())) {
        const match = String(timeVal).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          const min = match[2];
          const ampm = (match[3] || "").toLowerCase();
          if (ampm === "pm" && hour < 12) hour += 12;
          if (ampm === "am" && hour === 12) hour = 0;
          return `${String(hour).padStart(2, "0")}:${min}`;
        }
        return "";
      }
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const isSameDate = (recordDate, checkInTime, selectedDateStr) => {
    if (!selectedDateStr) return false;
    const [sYear, sMonth, sDay] = selectedDateStr.split("-").map((v) => parseInt(v, 10));

    if (recordDate && typeof recordDate === "string") {
      const clean = recordDate.trim();
      if (clean === selectedDateStr) return true;
      const parts = clean.split(/[-/]/).map((v) => parseInt(v, 10));
      if (parts.length === 3) {
        if (parts[2] === sYear && parts[1] === sMonth && parts[0] === sDay) return true;
        if (parts[0] === sYear && parts[1] === sMonth && parts[2] === sDay) return true;
      }
    }

    const timeToCheck = checkInTime || recordDate;
    if (timeToCheck) {
      const d = new Date(timeToCheck);
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() === sYear && d.getMonth() + 1 === sMonth && d.getDate() === sDay) {
          return true;
        }
      }
    }

    return false;
  };

  useEffect(() => {
    if (editMode) return;

    const autoPopulateAttendance = async () => {
      const { employeeId, date } = formData;
      if (!employeeId || !date) {
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        let matchedRecord = null;

        // 1. Fetch by employee history
        try {
          const res = await fetch(`${API_BASE_URL}/attendance/history/${employeeId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            const records = data.data || data.attendance || data.records || [];
            matchedRecord = records.find((rec) => isSameDate(rec.date, rec.checkInTime, date));
          }
        } catch (hErr) {
          console.warn("History fetch error:", hErr);
        }

        // 2. Fallback to /attendance/admin/all if not matched
        if (!matchedRecord) {
          try {
            const allRes = await fetch(`${API_BASE_URL}/attendance/admin/all`, { headers });
            if (allRes.ok) {
              const allData = await allRes.json();
              const allList = allData.data || allData.attendance || allData.records || [];
              matchedRecord = allList.find((rec) => {
                const recEmpId =
                  rec.userId?._id ||
                  rec.userId?.id ||
                  rec.userId ||
                  rec.employeeId?._id ||
                  rec.employeeId;
                return (
                  String(recEmpId) === String(employeeId) &&
                  isSameDate(rec.date, rec.checkInTime, date)
                );
              });
            }
          } catch (aErr) {
            console.warn("Admin all fetch error:", aErr);
          }
        }

        // 3. Fallback to /attendance/history/date/:date
        if (!matchedRecord) {
          try {
            const dateRes = await fetch(`${API_BASE_URL}/attendance/history/date/${date}`, { headers });
            if (dateRes.ok) {
              const dateData = await dateRes.json();
              const dateList = dateData.data || dateData.attendance || [];
              matchedRecord = dateList.find((rec) => {
                const recEmpId =
                  rec.userId?._id ||
                  rec.userId?.id ||
                  rec.userId ||
                  rec.employeeId?._id ||
                  rec.employeeId;
                return (
                  String(recEmpId) === String(employeeId) &&
                  isSameDate(rec.date, rec.checkInTime, date)
                );
              });
            }
          } catch (dErr) {
            console.warn("Date fetch error:", dErr);
          }
        }

        if (matchedRecord) {
          const checkin = formatTimeToHHMM(matchedRecord.checkInTime || matchedRecord.checkin);
          const breakStart = formatTimeToHHMM(
            matchedRecord.breaks?.[0]?.startTime || matchedRecord.breakStart
          );
          const breakEnd = formatTimeToHHMM(
            matchedRecord.breaks?.[0]?.endTime || matchedRecord.breakEnd
          );
          const checkout = formatTimeToHHMM(matchedRecord.checkOutTime || matchedRecord.checkout);

          const hasSecondBreak = matchedRecord.breaks && matchedRecord.breaks.length > 1;

          const newSessions = [
            {
              checkin,
              breakStart,
              breakEnd,
              checkout: hasSecondBreak ? "" : checkout,
            },
          ];

          if (hasSecondBreak) {
            newSessions.push({
              checkin: "",
              breakStart: formatTimeToHHMM(matchedRecord.breaks[1]?.startTime),
              breakEnd: formatTimeToHHMM(matchedRecord.breaks[1]?.endTime),
              checkout,
            });
          }

          setFormData((prev) => ({
            ...prev,
            sessions: newSessions,
          }));

          setSessionCount(newSessions.length);

          setSelectedFields(
            newSessions.map((s) => ({
              checkin: Boolean(s.checkin),
              breakStart: Boolean(s.breakStart),
              breakEnd: Boolean(s.breakEnd),
              checkout: Boolean(s.checkout),
            }))
          );
        } else {
          setFormData((prev) => ({
            ...prev,
            sessions: [{ ...emptySession }],
          }));
          setSessionCount(1);
          setSelectedFields([
            {
              checkin: false,
              breakStart: false,
              breakEnd: false,
              checkout: false,
            },
          ]);
        }
      } catch (err) {
        console.error("Auto populate attendance error:", err);
      }
    };

    autoPopulateAttendance();
  }, [formData.employeeId, formData.date, editMode]);

  // ============================================================
  // EMPLOYEE
  // ============================================================

  const handleEmployeeSelect = (
    e
  ) => {
    setFormData(
      (prev) => ({
        ...prev,
        employeeId:
          e.target.value,
      })
    );
  };

  // ============================================================
  // DATE
  // ============================================================

  const handleDateChange = (
    e
  ) => {
    const input = e.currentTarget;
    const value = input.value;
    if (input.validity.badInput || (value && !isValidDateInput(value))) {
      input.value = formatDateForInput(formData.date);
      showToast("Please enter a valid date with a four-digit year.", "error");
      return;
    }

    setFormData(
      (prev) => ({
        ...prev,
        date: value,
      })
    );
  };

  // ============================================================
  // REASON
  // ============================================================

  const handleReasonChange = (
    e
  ) => {
    setFormData(
      (prev) => ({
        ...prev,
        reason:
          e.target.value,
      })
    );
  };

  // ============================================================
  // EDIT EXISTING ATTENDANCE
  // ============================================================

  const handleEditAdjustment = (
    item
  ) => {
    let employeeId = "";

    if (
      typeof item.employeeId ===
      "object"
    ) {
      employeeId =
        item.employeeId?._id ||
        item.employeeId?.id ||
        "";
    } else {
      employeeId =
        item.employeeId ||
        "";
    }

    let sessions = [];

    if (
      Array.isArray(
        item.sessions
      ) &&
      item.sessions.length > 0
    ) {
      sessions =
        item.sessions.map(
          (session) => ({
            checkin:
              session.checkin ||
              "",
            breakStart:
              session.breakStart ||
              "",
            breakEnd:
              session.breakEnd ||
              "",
            checkout:
              session.checkout ||
              "",
          })
        );
    } else {
      sessions = [
        {
          checkin:
            item.checkInTime ||
            "",
          breakStart:
            item.breakStart ||
            "",
          breakEnd:
            item.breakEnd ||
            "",
          checkout:
            item.checkOutTime ||
            "",
        },
      ];
    }

    const checkboxValues =
      sessions.map(
        (session) => ({
          checkin:
            Boolean(
              session.checkin
            ),
          breakStart:
            Boolean(
              session.breakStart
            ),
          breakEnd:
            Boolean(
              session.breakEnd
            ),
          checkout:
            Boolean(
              session.checkout
            ),
        })
      );

    const resolvedDate = formatDateForInput(
      item.date ||
      item.attendanceDate ||
      item.checkInTime ||
      item.inTime ||
      item.createdAt ||
      item.dateStr ||
      item.day ||
      ""
    );

    setFormData({
      employeeId,
      date: resolvedDate,
      sessions,
      reason:
        item.reason || "",
    });

    setSessionCount(
      sessions.length
    );

    setSelectedFields(
      checkboxValues
    );

    setSelectedAdjustment(
      item
    );

    setEditMode(true);
    setError("");
    setNotification("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // CANCEL EDIT
  // ============================================================

  const handleCancelEdit = () => {
    setFormData({
      ...initialForm,
      sessions: [
        {
          ...emptySession,
        },
      ],
    });

    setSessionCount(1);

    setSelectedFields([
      {
        checkin: false,
        breakStart: false,
        breakEnd: false,
        checkout: false,
      },
    ]);

    setEditMode(false);

    setSelectedAdjustment(
      null
    );

    setError("");
    setNotification("");
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    setNotification("");
    setError("");

    if (
      !formData.employeeId ||
      !formData.date
    ) {
      showToast("Please select Employee and Date.", "error");
      return;
    }

    if (!isValidDateInput(formData.date)) {
      showToast("Please enter a valid date with a four-digit year.", "error");
      return;
    }

    if (
      !formData.reason.trim()
    ) {
      showToast("Please enter Reason.", "error");
      return;
    }

    const hasAnyTime =
      formData.sessions.some(
        (session) =>
          session.checkin ||
          session.breakStart ||
          session.breakEnd ||
          session.checkout
      );

    if (!hasAnyTime) {
      showToast("Please fill in at least one time field.", "error");
      return;
    }

    const method =
      getUpdateMethod();

    if (method === "PUT") {
      const allTimesFilled =
        formData.sessions.every(
          (session) =>
            session.checkin &&
            session.breakStart &&
            session.breakEnd &&
            session.checkout
        );

      if (!allTimesFilled) {
        showToast("For PUT, all 4 timing fields must be filled.", "error");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setNotification("");

    try {
      const token =
        localStorage.getItem(
          "token"
        );

      if (!token) {
        throw new Error(
          "No authentication token found. Please login again."
        );
      }

      let payload = {};

      // ========================================================
      // PATCH
      // ========================================================

      if (
        method === "PATCH"
      ) {
        const sessionsToSend =
          formData.sessions
            .map(
              (
                session,
                sessionIndex
              ) => {
                const checkbox =
                  selectedFields[
                    sessionIndex
                  ] || {};

                const cleaned = {};

                if (
                  checkbox.checkin &&
                  session.checkin
                ) {
                  cleaned.checkin =
                    session.checkin;
                }

                if (
                  checkbox.breakStart &&
                  session.breakStart
                ) {
                  cleaned.breakStart =
                    session.breakStart;
                }

                if (
                  checkbox.breakEnd &&
                  session.breakEnd
                ) {
                  cleaned.breakEnd =
                    session.breakEnd;
                }

                if (
                  checkbox.checkout &&
                  session.checkout
                ) {
                  cleaned.checkout =
                    session.checkout;
                }

                return cleaned;
              }
            )
            .filter(
              (session) =>
                Object.keys(
                  session
                ).length > 0
            );

        const firstSession =
          formData.sessions[0];

        const firstCheckbox =
          selectedFields[0] ||
          {};

        payload = {
          employeeId:
            formData.employeeId,

          date:
            formData.date,

          reason:
            formData.reason.trim(),
        };

        if (
          firstCheckbox.checkin &&
          firstSession.checkin
        ) {
          payload.checkInTime =
            firstSession.checkin;
        }

        if (
          firstCheckbox.checkout &&
          firstSession.checkout
        ) {
          payload.checkOutTime =
            firstSession.checkout;
        }

        if (
          firstCheckbox.breakStart &&
          firstSession.breakStart
        ) {
          payload.breakStart =
            firstSession.breakStart;
        }

        if (
          firstCheckbox.breakEnd &&
          firstSession.breakEnd
        ) {
          payload.breakEnd =
            firstSession.breakEnd;
        }

        if (
          sessionsToSend.length >
          0
        ) {
          payload.sessions =
            sessionsToSend;
        }
      }

      // ========================================================
      // PUT
      // ========================================================

      else {
        const sessionsToSend =
          formData.sessions.map(
            (session) => ({
              checkin:
                session.checkin,

              breakStart:
                session.breakStart,

              breakEnd:
                session.breakEnd,

              checkout:
                session.checkout,
            })
          );

        payload = {
          employeeId:
            formData.employeeId,

          date:
            formData.date,

          sessions:
            sessionsToSend,

          reason:
            formData.reason.trim(),
        };
      }

      // ========================================================
      // API URL
      // ========================================================

      const url =
        `${API_BASE_URL}/adjustment/update/` +
        `${formData.employeeId}/` +
        `${formData.date}`;

      console.log(
        "===================================="
      );

      console.log(
        `${method} Attendance Request`
      );

      console.log(
        "URL:",
        url
      );

      console.log(
        "Selected Fields:",
        selectedFields
      );

      console.log(
        "Attendance Settings:",
        attendanceSettings
      );

      console.log(
        "Payload:",
        payload
      );

      console.log(
        "===================================="
      );

      // ========================================================
      // API CALL
      // ========================================================

      let response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server response:", text);
        throw new Error("Server returned invalid response.");
      }

      let data = await response.json();

      // If backend returns an error or attendance record missing, throw error so ONLY error message is shown
      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
          data?.error ||
          `Failed to ${method === "PUT" ? "update" : "adjust"} attendance`
        );
      }

      // ========================================================
      // SUCCESS (Only on verified successful response)
      // ========================================================

      window.dispatchEvent(new Event("attendanceAdjusted"));
      const successMsg =
        data?.message ||
        (method === "PUT"
          ? "Complete attendance updated successfully!"
          : "Selected attendance fields updated successfully!");

      setNotification(successMsg);
      showToast(successMsg, "success");

      // ========================================================
      // RESET
      // ========================================================

      setFormData({
        employeeId: "",
        date: "",

        sessions: [
          {
            checkin: "",
            breakStart: "",
            breakEnd: "",
            checkout: "",
          },
        ],

        reason: "",
      });

      setSelectedFields([
        {
          checkin: false,
          breakStart: false,
          breakEnd: false,
          checkout: false,
        },
      ]);

      setSessionCount(1);

      setEditMode(false);

      setSelectedAdjustment(
        null
      );

      await fetchRecentAdjustments();
    } catch (error) {
      console.error(
        `${method} attendance error:`,
        error
      );

      const errorMsg =
        error?.message ||
        "Something went wrong saving attendance adjustment.";

      setError(errorMsg);
      setNotification("");

      showToast(
        errorMsg,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };



  // ============================================================
  // STATUS STYLE
  // ============================================================

  const getStatusStyle = (
    status
  ) => {
    const styles = {
      present:
        "bg-green-50 text-green-700 border-green-300",

      absent:
        "bg-red-50 text-red-700 border-red-300",

      "half-day":
        "bg-yellow-50 text-yellow-700 border-yellow-300",
    };

    return (
      styles[status] ||
      "bg-slate-50 text-slate-700 border-slate-300"
    );
  };

  // ============================================================
  // FORMAT TIME
  // ============================================================

  const formatTimeDisplay = (
    timeStr
  ) => {
    if (!timeStr) {
      return "—";
    }

    try {
      const date =
        new Date(timeStr);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return timeStr;
      }

      return date.toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );
    } catch {
      return timeStr;
    }
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDateDisplay = (
    dateStr
  ) => {
    if (!dateStr) {
      return "N/A";
    }

    try {
      const normalized = formatDateForInput(dateStr);
      const date = normalized ? new Date(normalized + "T00:00:00") : new Date(dateStr);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return dateStr;
      }

      return date.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return dateStr;
    }
  };

  const format12Hour = (timeStr) => {
    if (!timeStr) return "";
    try {
      const parts = String(timeStr).split(":");
      if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1].slice(0, 2);
        if (isNaN(hours)) return timeStr;
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
      }
    } catch {}
    return timeStr;
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">

      {/* ======================================================
          TOAST
      ====================================================== */}

      <Toast
        message={notification}
        type="success"
        onClose={() =>
          setNotification("")
        }
      />

      {/* ======================================================
          SETTINGS MODAL
      ====================================================== */}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 md:p-8 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden font-poppins flex flex-col my-auto max-h-[85vh] sm:max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f0f9ff] text-[#068DCB] border border-[#bae6fd]">
                  <Settings
                    size={18}
                  />
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#0f172a] font-poppins">
                    Rule Settings
                  </h2> 

                  <p className="text-xs text-[#64748b] mt-0.5 font-poppins">
                    Configure office attendance timings and rules
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeSettings}
                aria-label="Close settings"
                title="Close settings"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body - Scrollable with top/bottom margin and padding */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

              {/* Timing Section */}

              <div>

                <div className="flex items-center gap-2 mb-3">

                  <Clock
                    size={16}
                    className="text-[#034665]"
                  />

                  <h3 className="text-sm font-semibold text-gray-800 font-poppins">
                    Office Timing
                  </h3>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Office Start */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Office Start Time
                    </label>

                    <input
                      type="time"
                      value={
                        tempSettings.officeStartTime
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "officeStartTime",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Normal office start
                    </p>
                  </div>

                  {/* Late */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Late After
                    </label>

                    <input
                      type="time"
                      value={
                        tempSettings.lateAfter
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "lateAfter",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Check-in after this time is late
                    </p>
                  </div>

                  {/* Absent */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Absent After
                    </label>

                    <input
                      type="time"
                      value={
                        tempSettings.absentAfter
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "absentAfter",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Check-in after this time is absent
                    </p>
                  </div>

                  {/* Office End */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Office End Time
                    </label>

                    <input
                      type="time"
                      value={
                        tempSettings.officeEndTime
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "officeEndTime",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Normal office closing time
                    </p>
                  </div>

                </div>

              </div>

              {/* Work Hours */}

              <div className="border-t border-slate-200 pt-5">

                <div className="flex items-center gap-2 mb-3">

                  <Clock
                    size={16}
                    className="text-[#034665]"
                  />

                  <h3 className="text-sm font-semibold text-gray-800 font-poppins">
                    Work Hour Rules
                  </h3>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  {/* Present */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Present Hours
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={
                        tempSettings.minimumPresentHours
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "minimumPresentHours",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Minimum hours for present
                    </p>
                  </div>

                  {/* Half Day */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Half-Day Hours
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={
                        tempSettings.minimumHalfDayHours
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "minimumHalfDayHours",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Minimum hours for half-day
                    </p>
                  </div>

                  {/* Break */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 font-poppins">
                      Break Limit
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={
                        tempSettings.breakLimitMinutes
                      }
                      onChange={(e) =>
                        handleSettingChange(
                          "breakLimitMinutes",
                          e.target.value
                        )
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-poppins focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] transition-colors"
                    />

                    <p className="text-[11px] text-gray-400 mt-1 font-poppins">
                      Maximum break in minutes
                    </p>
                  </div>

                </div>

              </div>

              {/* Current Settings Preview */}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-poppins">

                <p className="text-xs font-semibold text-gray-700 mb-2 font-poppins">
                  Current Configuration
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">

                  <div>
                    <span className="text-gray-400 block">
                      Start
                    </span>

                    <span className="font-semibold text-gray-800">
                      {
                        tempSettings.officeStartTime
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      Late
                    </span>

                    <span className="font-semibold text-gray-800">
                      {
                        tempSettings.lateAfter
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      Absent
                    </span>

                    <span className="font-semibold text-gray-800">
                      {
                        tempSettings.absentAfter
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      End
                    </span>

                    <span className="font-semibold text-gray-800">
                      {
                        tempSettings.officeEndTime
                      }
                    </span>
                  </div>

                </div>

              </div>

            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3 border-t border-slate-200 px-5 sm:px-6 py-4 bg-slate-50 shrink-0 font-poppins">
              <button
                type="button"
                onClick={resetAttendanceSettings}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs bg-white text-rose-600 border border-rose-200 rounded-lg px-4 py-2 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                Reset Default
              </button>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={closeSettings}
                  className="flex-1 sm:flex-none text-xs bg-white text-slate-700 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveAttendanceSettings}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs text-white rounded-lg px-5 py-2 font-medium transition-colors shadow-xs cursor-pointer hover:opacity-95"
                  style={{ background: 'linear-gradient(106.46deg, #034665 -20.74%, #068DCB 92.5%)' }}
                >
                  <Save size={14} />
                  Save Settings
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          HEADER
      ====================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 font-poppins">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-bold text-[#0f172a] tracking-tight leading-tight font-poppins">
            Adjustments
          </h1>
          <p className="mt-1 text-xs sm:text-[13px] text-[#64748b] font-poppins">
            Apply Direct Attendance Adjustments And Configure Rules
          </p>
          {/* Divider Line */}
          <div style={{ borderTop: '0.5px solid #034665' }} className="my-2.5 w-full" />
          {/* Policy Rules Badge Bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-poppins">
            <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
              POLICY RULES:
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#475569] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Start {format12Hour(attendanceSettings.officeStartTime || "10:00")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#475569] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Late {format12Hour(attendanceSettings.lateAfter || "10:10")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#475569] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              Half Day {format12Hour(attendanceSettings.absentAfter || "15:00")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#475569] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#068DCB] shrink-0" />
              End {format12Hour(attendanceSettings.officeEndTime || "19:00")}
            </span>
          </div>
        </div>

        {/* RULE SETTINGS BUTTON */}
        <button
          type="button"
          onClick={openSettings}
          className="h-9 px-4 bg-white hover:bg-slate-50 text-[#334155] border border-[#cbd5e1] rounded-lg shadow-xs flex items-center gap-2 text-xs font-medium font-poppins transition-colors self-start sm:self-auto cursor-pointer shrink-0"
        >
          <Settings size={15} className="text-[#64748b]" />
          <span>Rule Settings</span>
        </button>
      </div>

      {/* ======================================================
          MAIN GRID
      ====================================================== */}
      {loading && (
        <LoadingScreen
          message="Loading attendance adjustment console..."
          description="Fetching employee lists and adjustment history"
        />
      )}

      <div
        className={`${loading ? "hidden" : ""} grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 font-poppins`}
      >
        {/* ====================================================
            LEFT FORM CARD
        ==================================================== */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
          {editMode && (
            <div className="flex items-center justify-between mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-xs font-semibold text-amber-800">
                Edit Mode: Updating Existing Adjustment
              </span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs bg-white text-red-600 border border-red-200 px-3 py-1 rounded-md hover:bg-red-50 font-medium transition-colors cursor-pointer"
              >
                Cancel Edit
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Employee + Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Employee */}
              <div>
                <label className="block text-xs font-medium text-[#1e293b] mb-1.5 font-poppins">
                  Select Employee
                </label>
                <div className="relative">
                  <select
                    value={formData.employeeId}
                    onChange={handleEmployeeSelect}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] font-poppins transition-colors cursor-pointer"
                    disabled={loading || editMode}
                  >
                    <option value="">
                      {loading ? "Loading..." : "Select Employee"}
                    </option>
                    {employees
                      .filter((emp) => {
                        const role = (emp.roleType || "").toLowerCase().trim();
                        const id = (emp.employeeId || "").toUpperCase().trim();
                        return role !== "admin" && !id.startsWith("ADMIN");
                      })
                      .map((employee) => {
                        const id = employee.employeeId ? String(employee.employeeId).trim() : "";
                        let label = employee.name;
                        if (id) {
                          label += ` (EMP ID: ${id})`;
                        } else if (employee.roleType) {
                          label += ` (${employee.roleType})`;
                        }
                        return (
                          <option key={employee.id} value={employee.id}>
                            {label}
                          </option>
                        );
                      })}
                  </select>
                </div>
                <p className="text-[11px] text-[#94a3b8] mt-1 font-poppins">
                  Total: {employees.length > 0 ? employees.length : 13} Employees Loaded
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-[#1e293b] mb-1.5 font-poppins">
                  Date
                </label>
                <input
                  type="date"
                  value={formatDateForInput(formData.date)}
                  max="9999-12-31"
                  onChange={handleDateChange}
                  onBlur={(e) => {
                    if (e.currentTarget.validity.badInput) {
                      e.currentTarget.value = formatDateForInput(formData.date);
                      showToast("Please enter a valid date with a four-digit year.", "error");
                    }
                  }}
                  disabled={editMode}
                  placeholder="dd-mm-yyyy"
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] disabled:bg-slate-100 font-poppins transition-colors"
                />
              </div>
            </div>

            {/* Time Sessions Section */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0f172a] font-poppins">
                    Time Sessions
                  </h3>
                  <p className="text-[11px] text-[#64748b] mt-0.5 font-poppins">
                    Select the checkbox beside a timing field to include it in the update.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {sessionCount < 2 && (
                    <button
                      type="button"
                      onClick={addSession}
                      className="text-white text-xs font-medium px-4 py-1.5 rounded-md transition-all font-poppins cursor-pointer shadow-xs hover:opacity-95"
                      style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
                    >
                      Add Sessions
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={removeSession}
                    disabled={sessionCount <= 1}
                    className="border border-[#cbd5e1] text-[#64748b] hover:bg-slate-50 hover:text-[#0f172a] text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors font-poppins cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {formData.sessions.map((session, index) => {
                const checkbox = selectedFields[index] || {
                  checkin: false,
                  breakStart: false,
                  breakEnd: false,
                  checkout: false,
                };
                const selectedCount = [
                  checkbox.checkin,
                  checkbox.breakStart,
                  checkbox.breakEnd,
                  checkbox.checkout,
                ].filter(Boolean).length;

                return (
                  <div
                    key={index}
                    className="border border-[#e2e8f0] rounded-xl p-4 sm:p-5 mt-2.5 bg-white"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-[#0f172a] font-poppins">
                        Session {index + 1}
                      </span>
                      <span className="text-xs text-[#94a3b8] font-poppins font-normal">
                        {selectedCount}/4 Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {/* Check In */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[#64748b] font-poppins">
                            Check In
                          </span>
                          <input
                            type="checkbox"
                            checked={checkbox.checkin}
                            onChange={(e) => handleFieldCheckbox(index, "checkin", e.target.checked)}
                            className="w-4 h-4 rounded border-[#cbd5e1] text-[#068DCB] focus:ring-[#068DCB] cursor-pointer"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="time"
                            value={session.checkin}
                            onChange={(e) => handleSessionChange(index, "checkin", e.target.value)}
                            placeholder="--:--"
                            className={`w-full bg-white border px-3 py-2 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] font-poppins transition-colors ${
                              checkbox.checkin
                                ? "border-[#068DCB] bg-[#f0f9ff]/40 text-[#0f172a]"
                                : "border-[#cbd5e1] text-[#475569]"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Break Start */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[#64748b] font-poppins">
                            Break Start
                          </span>
                          <input
                            type="checkbox"
                            checked={checkbox.breakStart}
                            onChange={(e) => handleFieldCheckbox(index, "breakStart", e.target.checked)}
                            className="w-4 h-4 rounded border-[#cbd5e1] text-[#068DCB] focus:ring-[#068DCB] cursor-pointer"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="time"
                            value={session.breakStart}
                            onChange={(e) => handleSessionChange(index, "breakStart", e.target.value)}
                            placeholder="--:--"
                            className={`w-full bg-white border px-3 py-2 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] font-poppins transition-colors ${
                              checkbox.breakStart
                                ? "border-[#068DCB] bg-[#f0f9ff]/40 text-[#0f172a]"
                                : "border-[#cbd5e1] text-[#475569]"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Break End */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[#64748b] font-poppins">
                            Break End
                          </span>
                          <input
                            type="checkbox"
                            checked={checkbox.breakEnd}
                            onChange={(e) => handleFieldCheckbox(index, "breakEnd", e.target.checked)}
                            className="w-4 h-4 rounded border-[#cbd5e1] text-[#068DCB] focus:ring-[#068DCB] cursor-pointer"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="time"
                            value={session.breakEnd}
                            onChange={(e) => handleSessionChange(index, "breakEnd", e.target.value)}
                            placeholder="--:--"
                            className={`w-full bg-white border px-3 py-2 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] font-poppins transition-colors ${
                              checkbox.breakEnd
                                ? "border-[#068DCB] bg-[#f0f9ff]/40 text-[#0f172a]"
                                : "border-[#cbd5e1] text-[#475569]"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Check Out */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[#64748b] font-poppins">
                            Check Out
                          </span>
                          <input
                            type="checkbox"
                            checked={checkbox.checkout}
                            onChange={(e) => handleFieldCheckbox(index, "checkout", e.target.checked)}
                            className="w-4 h-4 rounded border-[#cbd5e1] text-[#068DCB] focus:ring-[#068DCB] cursor-pointer"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="time"
                            value={session.checkout}
                            onChange={(e) => handleSessionChange(index, "checkout", e.target.value)}
                            placeholder="--:--"
                            className={`w-full bg-white border px-3 py-2 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] font-poppins transition-colors ${
                              checkbox.checkout
                                ? "border-[#068DCB] bg-[#f0f9ff]/40 text-[#0f172a]"
                                : "border-[#cbd5e1] text-[#475569]"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-[#1e293b] mb-1.5 font-poppins">
                Reason
              </label>
              <textarea
                rows="3"
                placeholder="Reason For Adjustment...."
                value={formData.reason}
                onChange={handleReasonChange}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg p-3 text-xs sm:text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#068DCB] focus:border-[#068DCB] min-h-[90px] resize-none font-poppins transition-colors"
              />
            </div>

            {/* Submit Action (Centered) */}
            <div className="flex justify-center pt-4">
              <button
                type="submit"
                disabled={submitting || loading}
                className="px-12 py-2.5 rounded-lg text-white font-medium text-sm shadow-xs transition-all font-poppins cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
                style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </span>
                ) : editMode ? (
                  "Update Attendance"
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ====================================================
            RIGHT - RECENT ADJUSTMENTS
        ==================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col font-poppins">
          <h2 className="text-[17px] font-bold text-[#0f172a] mb-4 font-poppins">
            Recent Adjustments
          </h2>

          <div className="space-y-3 flex-1 overflow-y-visible lg:overflow-y-auto max-h-none lg:max-h-[560px] pr-0 sm:pr-1 font-poppins">
            {fetchingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#068DCB]" />
              </div>
            ) : recentAdjustments.length === 0 ? (
              /* Fallback sample item matching reference image when no records */
              <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white text-xs font-poppins shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a] text-sm font-poppins">
                    Yash Vaghasiya
                  </span>
                  <span
                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-md text-white font-poppins"
                    style={{ background: '#034665' }}
                  >
                    Half Day
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64748b] font-medium mt-1.5 font-poppins">
                  <span>Date: 22 Oct 2026</span>
                  <span>In- 10:00 AM</span>
                </div>
                <div className="text-xs text-[#475569] font-medium mt-2 mb-3.5 font-poppins">
                  Reason: <span className="text-[#334155]">Late</span>
                </div>
                <button
                  type="button"
                  className="w-full text-white py-2 rounded-lg text-xs font-medium tracking-wide transition-all font-poppins shadow-xs cursor-pointer hover:opacity-95"
                  style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
                >
                  Edit Attendance
                </button>
              </div>
            ) : (
              recentAdjustments
                .filter((item) => {
                  const resolvedName = item.employeeName || getEmployeeName(item.employeeId);
                  return !isUnknownEmployeeOrUser(resolvedName) && !isUnknownEmployeeOrUser(item);
                })
                .map((item) => {
                  const resolvedName = item.employeeName || getEmployeeName(item.employeeId);
                  const firstSess = Array.isArray(item.sessions) && item.sessions[0] ? item.sessions[0] : {};
                  const checkInVal = item.checkInTime || firstSess.checkin || "";
                  const formattedInTime = checkInVal ? formatTimeDisplay(checkInVal) : "";

                  // Status label
                  const statusText = (() => {
                    const rawHours = item.totalWorkTime ?? item.totalWorkTimeHours ?? item.totalHours ?? item.hours ?? item.workHours ?? 0;
                    let totalHours = typeof rawHours === 'number' ? rawHours : parseFloat(rawHours) || 0;
                    const isCheckedOut = Boolean(item.checkOutTime || firstSess.checkout) || totalHours > 0;
                    const rawStatusStr = String(item.status || '').toLowerCase();
                    if (rawStatusStr.includes('half') || item.isHalfDay === true || (isCheckedOut && totalHours > 0 && totalHours < 8)) {
                      return "Half Day";
                    }
                    if (checkInVal) {
                      let checkInMinutes = null;
                      if (typeof checkInVal === 'string' && /^\d{1,2}:\d{2}/.test(checkInVal)) {
                        const [h, m] = checkInVal.split(':').map(Number);
                        checkInMinutes = h * 60 + m;
                      } else {
                        const d = new Date(checkInVal);
                        if (!isNaN(d.getTime())) {
                          const istDate = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
                          checkInMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
                        }
                      }
                      if (checkInMinutes !== null) {
                        const OFFICE_START = 10 * 60 + 10;
                        const LATE_CUTOFF = 10 * 60 + 30;
                        const HALF_DAY_CUTOFF = 15 * 60;
                        if (checkInMinutes > HALF_DAY_CUTOFF) return "Absent";
                        if (checkInMinutes > LATE_CUTOFF) return "Half Day";
                        if (checkInMinutes > OFFICE_START) return "Late";
                        return "Present";
                      }
                    }
                    return item.status ? String(item.status) : "Present";
                  })();

                  return (
                    <div
                      key={item._id}
                      className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#cbd5e1] transition-all text-xs font-poppins shadow-2xs mb-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0f172a] text-sm font-poppins">
                          {resolvedName}
                        </span>
                        <span
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-md text-white font-poppins"
                          style={{ background: '#034665' }}
                        >
                          {statusText}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#64748b] font-medium mt-1.5 font-poppins">
                        <span>Date: {formatDateDisplay(item.date)}</span>
                        {formattedInTime && (
                          <span>In- {formattedInTime}</span>
                        )}
                      </div>

                      <div className="text-xs text-[#475569] font-medium mt-2 mb-3.5 font-poppins">
                        Reason: <span className="text-[#334155]">{item.reason || "Late"}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEditAdjustment(item)}
                        className="w-full text-white py-2 rounded-lg text-xs font-medium tracking-wide transition-all font-poppins shadow-xs cursor-pointer hover:opacity-95"
                        style={{ background: 'linear-gradient(93.63deg, #034665 9.04%, #068DCB 92.43%)' }}
                      >
                        Edit Attendance
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}