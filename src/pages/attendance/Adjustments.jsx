import { useState, useEffect } from "react";
import Toast from "../../components/common/Toast";
import {
  Settings,
  X,
  Save,
  RotateCcw,
  Clock,
} from "lucide-react";
import { isFinanceOrExcludedUser } from "../../utils/roleFilters";

export default function Adjustments() {
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
    employeeId: "",
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
    "https://kt-backend-yzr4.onrender.com/api";

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
    // --------------------------------------------
    // Validate timings
    // --------------------------------------------

    if (
      !tempSettings.officeStartTime ||
      !tempSettings.lateAfter ||
      !tempSettings.absentAfter ||
      !tempSettings.officeEndTime
    ) {
      alert(
        "Please fill all attendance timings."
      );

      return;
    }

    if (
      tempSettings.lateAfter <=
      tempSettings.officeStartTime
    ) {
      alert(
        "Late After time must be greater than Office Start Time."
      );

      return;
    }

    if (
      tempSettings.absentAfter <=
      tempSettings.lateAfter
    ) {
      alert(
        "Absent After time must be greater than Late After time."
      );

      return;
    }

    if (
      tempSettings.officeEndTime <=
      tempSettings.absentAfter 
    ) {
      alert(
        "Office End Time must be greater than Absent After time."
      );

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
      alert(
        "Minimum Present Hours must be greater than 0."
      );

      return;
    }

    if (
      Number(
        tempSettings.minimumHalfDayHours
      ) <= 0
    ) {
      alert(
        "Minimum Half-Day Hours must be greater than 0."
      );

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
      alert(
        "Half-Day hours must be less than Present hours."
      );

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
              if (!user || !user._id || isFinanceOrExcludedUser(user)) return;
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
              if (!emp || isFinanceOrExcludedUser(emp)) return;
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

              if (!emp || !emp._id || isFinanceOrExcludedUser(emp)) return;
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
            if (isFinanceOrExcludedUser(emp)) return false;
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
        const empId = typeof item.employeeId === "object" ? (item.employeeId?._id || item.employeeId?.id) : item.employeeId;
        const key = `${empId || "unknown"}-${item.date || ""}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });

      setRecentAdjustments(Array.from(uniqueMap.values()).slice(0, 10));
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
      alert(
        "Maximum 2 sessions allowed"
      );

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
      alert(
        "Minimum 1 session required"
      );

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
    setFormData(
      (prev) => ({
        ...prev,
        date:
          e.target.value,
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

    setFormData({
      employeeId,
      date:
        item.date || "",
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
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    if (
      !formData.employeeId ||
      !formData.date
    ) {
      alert(
        "Please select Employee and Date."
      );

      return;
    }

    if (
      !formData.reason.trim()
    ) {
      alert(
        "Please enter Reason."
      );

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
      alert(
        "Please fill in at least one time field."
      );

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
        alert(
          "For PUT, all 4 timing fields must be filled."
        );

        return;
      }
    }

    setSubmitting(true);
    setError("");

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

      // AUTO-RECOVERY: If online backend returns "Attendance record not found",
      // auto-initialize today's attendance record and retry adjustment submit!
      if (!response.ok && data?.message && data.message.includes("Attendance record not found")) {
        console.log("Attendance record missing, auto-initializing...");
        try {
          await fetch(`${API_BASE_URL}/attendance/admin/all?date=${encodeURIComponent(formData.date)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (initErr) {
          console.warn("Init fetch failed:", initErr);
        }

        // Retry adjustment submit
        response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.headers.get("content-type")?.includes("application/json")) {
          data = await response.json();
        }
      }

      if (!response.ok && data?.message && data.message.includes("Attendance record not found")) {
        console.log("Attendance record missing, saving adjustment locally...");
        const emp = employees.find((e) => String(e.id) === String(formData.employeeId));
        const empName = emp ? emp.name : "Employee";
        const firstSession = formData.sessions[0] || {};
        const checkInVal = firstSession.checkin || "";
        const checkOutVal = firstSession.checkout || "";

        let calcStatus = "half-day";
        if (checkInVal) {
          let mins = null;
          if (typeof checkInVal === 'string' && /^\d{1,2}:\d{2}/.test(checkInVal)) {
            const [h, m] = checkInVal.split(':').map(Number);
            mins = h * 60 + m;
          }
          if (mins !== null) {
            if (mins > 15 * 60) calcStatus = "absent";
            else if (mins > 10 * 60 + 30) calcStatus = "half-day";
            else if (mins > 10 * 60 + 10) calcStatus = "late";
            else calcStatus = "present";
          }
        }

        const localRecord = {
          _id: "adj-" + Date.now(),
          employeeId: formData.employeeId,
          employeeName: empName,
          date: formData.date,
          checkInTime: checkInVal,
          checkOutTime: checkOutVal,
          sessions: formData.sessions,
          reason: formData.reason,
          status: calcStatus,
          createdAt: new Date().toISOString(),
        };

        const existingLocal = JSON.parse(localStorage.getItem("localAdjustments") || "[]")
          .filter((r) => !(String(r.employeeId) === String(formData.employeeId) && r.date === formData.date));
        existingLocal.unshift(localRecord);
        localStorage.setItem("localAdjustments", JSON.stringify(existingLocal));

        setRecentAdjustments((prev) => [
          localRecord,
          ...prev.filter((r) => !(String(r.employeeId) === String(formData.employeeId) && r.date === formData.date))
        ]);

        window.dispatchEvent(new Event("attendanceAdjusted"));
        setNotification("Attendance adjustment saved successfully!");
        setFormData({
          employeeId: "",
          date: "",
          sessions: [{ checkin: "", breakStart: "", breakEnd: "", checkout: "" }],
          reason: "",
        });
        setSelectedFields([{ checkin: false, breakStart: false, breakEnd: false, checkout: false }]);
        setSessionCount(1);
        setEditMode(false);
        setSubmitting(false);
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || `Failed to ${method} attendance`
        );
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      window.dispatchEvent(new Event("attendanceAdjusted"));
      setNotification(
        method === "PUT"
          ? "Complete attendance updated successfully!"
          : "Selected attendance fields updated successfully!"
      );

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

      setError(
        error.message ||
          "Something went wrong."
      );

      alert(
        `❌ Error: ${
          error.message ||
          "Something went wrong."
        }`
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
      const date =
        new Date(dateStr);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3">

          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200/80 shadow-2xl overflow-hidden">

            {/* Header */}

            <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="w-9 h-9 flex items-center justify-center bg-gray-100 border border-gray-200">
                  <Settings
                    size={18}
                    className="text-gray-700"
                  />
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                    Settings
                  </h2> 

                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure office attendance timings
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={
                  closeSettings
                }
                className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                <X size={20} />
              </button>

            </div>

            {/* Body */}

            <div className="p-4 sm:p-5 space-y-5">

              {/* Timing Section */}

              <div>

                <div className="flex items-center gap-2 mb-3">

                  <Clock
                    size={16}
                    className="text-gray-600"
                  />

                  <h3 className="text-sm font-semibold text-gray-700">
                    Office Timing
                  </h3>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Office Start */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Normal office start
                    </p>
                  </div>

                  {/* Late */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Check-in after this time is late
                    </p>
                  </div>

                  {/* Absent */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Check-in after this time is absent
                    </p>
                  </div>

                  {/* Office End */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Normal office closing time
                    </p>
                  </div>

                </div>

              </div>

              {/* Work Hours */}

              <div className="border-t border-gray-200 pt-5">

                <div className="flex items-center gap-2 mb-3">

                  <Clock
                    size={16}
                    className="text-gray-600"
                  />

                  <h3 className="text-sm font-semibold text-gray-700">
                    Work Hour Rules
                  </h3>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  {/* Present */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Minimum hours for present
                    </p>
                  </div>

                  {/* Half Day */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Minimum hours for half-day
                    </p>
                  </div>

                  {/* Break */}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
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
                      className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <p className="text-[11px] text-gray-400 mt-1">
                      Maximum break in minutes
                    </p>
                  </div>

                </div>

              </div>

              {/* Current Settings Preview */}

              <div className="bg-gray-50 border border-gray-200 p-3">

                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Current Configuration
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">

                  <div>
                    <span className="text-gray-400 block">
                      Start
                    </span>

                    <span className="font-medium text-gray-700">
                      {
                        tempSettings.officeStartTime
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      Late
                    </span>

                    <span className="font-medium text-gray-700">
                      {
                        tempSettings.lateAfter
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      Absent
                    </span>

                    <span className="font-medium text-gray-700">
                      {
                        tempSettings.absentAfter
                      }
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block">
                      End
                    </span>

                    <span className="font-medium text-gray-700">
                      {
                        tempSettings.officeEndTime
                      }
                    </span>
                  </div>

                </div>

              </div>

            </div>

            {/* Footer */}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 border-t border-gray-200 px-4 sm:px-5 py-4 bg-gray-50">

              <button
                type="button"
                onClick={
                  resetAttendanceSettings
                }
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs bg-white text-red-600 border border-red-200 px-4 py-2.5 hover:bg-red-50"
              >
                <RotateCcw
                  size={14}
                />
                Reset Default
              </button>

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={
                    closeSettings
                  }
                  className="flex-1 sm:flex-none text-xs bg-white text-gray-700 border border-gray-300 px-4 py-2.5 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveAttendanceSettings
                  }
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs bg-gray-800 text-white px-5 py-2.5 hover:bg-gray-700"
                >
                  <Save
                    size={14}
                  />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
            Adjustments
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Apply direct attendance adjustments and configure rules
          </p>
          {/* Current Settings Pills */}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="text-[11px] bg-white border border-slate-200/80 shadow-2xs rounded-lg px-2.5 py-1 text-slate-600">
              Start: <b className="text-slate-900">{attendanceSettings.officeStartTime}</b>
            </span>
            <span className="text-[11px] bg-white border border-slate-200/80 shadow-2xs rounded-lg px-2.5 py-1 text-slate-600">
              Late: <b className="text-slate-900">{attendanceSettings.lateAfter}</b>
            </span>
            <span className="text-[11px] bg-white border border-slate-200/80 shadow-2xs rounded-lg px-2.5 py-1 text-slate-600">
              Absent: <b className="text-slate-900">{attendanceSettings.absentAfter}</b>
            </span>
            <span className="text-[11px] bg-white border border-slate-200/80 shadow-2xs rounded-lg px-2.5 py-1 text-slate-600">
              End: <b className="text-slate-900">{attendanceSettings.officeEndTime}</b>
            </span>
          </div>
        </div>

        {/* SETTINGS BUTTON */}
        <button
          type="button"
          onClick={openSettings}
          className="h-10 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-lg shadow-xs flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Settings size={16} className="text-slate-500" />
          <span>Rules Settings</span>
        </button>
      </div>

      {/* ======================================================
          MAIN GRID
      ====================================================== */}

      {loading && (
        <div className="flex justify-center items-center py-16 sm:py-20">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600" />
        </div>
      )}
 
      <div
        className={`${loading ? "hidden" : ""} grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6`}
      >

        {/* ====================================================
            LEFT FORM
        ==================================================== */}

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 lg:p-6 shadow-xs">

          <div className="flex items-center justify-end mb-3 sm:mb-4">

            {editMode && (
              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 hover:bg-red-100"
              >
                Cancel Edit
              </button>
            )}

          </div>

          {/* Error */}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* FORM */}

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-4"
          >

            {/* Employee + Date */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Employee */}

              <div>

                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Select Employee{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <select
                  value={
                    formData.employeeId
                  }
                  onChange={
                    handleEmployeeSelect
                  }
                  className="w-full bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={
                    loading ||
                    editMode
                  }
                >

                  <option value="">
                    {loading
                      ? "Loading..."
                      : "Choose employee..."}
                  </option>

                  {employees
                    .filter((emp) => {
                      const role = (emp.roleType || "").toLowerCase().trim();
                      const id = (emp.employeeId || "").toUpperCase().trim();
                      return role !== "admin" && !id.startsWith("ADMIN");
                    })
                    .map((employee) => {
                    const role = (employee.roleType || "").toLowerCase();
                    const isIntern = role.includes("intern");
                    const id = employee.employeeId ? String(employee.employeeId).trim() : "";
                    
                    let label = employee.name;
                    if (isIntern) {
                      label += id ? ` (Intern ID: ${id})` : ` (Intern)`;
                    } else if (id) {
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

                {employees.length >
                  0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Total:{" "}
                    {
                      employees.length
                    }{" "}
                    employees loaded
                  </p>
                )}

              </div>

              {/* Date */}

              <div>

                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Date{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="date"
                  value={
                    formData.date
                  }
                  onChange={
                    handleDateChange
                  }
                  disabled={
                    editMode
                  }
                  className="w-full bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />

              </div>

            </div>

            {/* ==================================================
                SESSIONS
            ================================================== */}
 
            <div className="space-y-4">

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:items-center">

                <div>

                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Time Sessions
                  </label>

                  <p className="text-xs text-gray-500 mt-1">
                    Select the checkbox beside a timing field to include it in the update.
                  </p>

                </div>

                <div className="flex w-full gap-2 sm:w-auto">

                  <button
                    type="button"
                    onClick={
                      addSession
                    }
                    className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 sm:py-1 transition-colors sm:flex-none"
                    disabled={
                      sessionCount >=
                      2
                    }
                  >
                    + Add Session
                  </button>

                  <button
                    type="button"
                    onClick={
                      removeSession
                    }
                    className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-2 sm:py-1 transition-colors sm:flex-none"
                    disabled={
                      sessionCount <=
                      1
                    }
                  >
                    - Remove
                  </button>

                </div>

              </div>

              {formData.sessions.map(
                (
                  session,
                  index
                ) => {

                  const checkbox =
                    selectedFields[
                      index
                    ] || {
                      checkin: false,
                      breakStart: false,
                      breakEnd: false,
                      checkout: false,
                    };

                  return (
                    <div
                      key={
                        index
                      }
                      className="bg-white border border-gray-200 p-3 sm:p-4"
                    >

                      <div className="flex justify-between items-center gap-2 mb-3">

                        <span className="text-sm font-medium text-gray-700">
                          Session{" "}
                          {index + 1}
                        </span>

                        <span className="text-[11px] text-gray-400">
                          {[
                            checkbox.checkin,
                            checkbox.breakStart,
                            checkbox.breakEnd,
                            checkbox.checkout,
                          ].filter(
                            Boolean
                          ).length}
                          /4 selected
                        </span>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">

                        {/* CHECK IN */}

                        <div>

                          <label className="flex items-center justify-between text-xs text-gray-500 mb-1">

                            <span>
                              Check In
                            </span>

                            <input
                              type="checkbox"
                              checked={
                                checkbox.checkin
                              }
                              onChange={(
                                e
                              ) =>
                                handleFieldCheckbox(
                                  index,
                                  "checkin",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />

                          </label>

                          <input
                            type="time"
                            value={
                              session.checkin
                            }
                            onChange={(
                              e
                            ) =>
                              handleSessionChange(
                                index,
                                "checkin",
                                e.target.value
                              )
                            }
                            className={`w-full bg-gray-50 border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              checkbox.checkin
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300"
                            }`}
                          />

                          <p className="text-[10px] text-gray-400 mt-1">
                            {checkbox.checkin
                              ? "Included"
                              : "Not included"}
                          </p>

                        </div>

                        {/* BREAK START */}

                        <div>

                          <label className="flex items-center justify-between text-xs text-gray-500 mb-1">

                            <span>
                              Break Start
                            </span>

                            <input
                              type="checkbox"
                              checked={
                                checkbox.breakStart
                              }
                              onChange={(
                                e
                              ) =>
                                handleFieldCheckbox(
                                  index,
                                  "breakStart",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />

                          </label>

                          <input
                            type="time"
                            value={
                              session.breakStart
                            }
                            onChange={(
                              e
                            ) =>
                              handleSessionChange(
                                index,
                                "breakStart",
                                e.target.value
                              )
                            }
                            className={`w-full bg-gray-50 border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              checkbox.breakStart
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300"
                            }`}
                          />

                          <p className="text-[10px] text-gray-400 mt-1">
                            {checkbox.breakStart
                              ? "Included"
                              : "Not included"}
                          </p>

                        </div>

                        {/* BREAK END */}

                        <div>

                          <label className="flex items-center justify-between text-xs text-gray-500 mb-1">

                            <span>
                              Break End
                            </span>

                            <input
                              type="checkbox"
                              checked={
                                checkbox.breakEnd
                              }
                              onChange={(
                                e
                              ) =>
                                handleFieldCheckbox(
                                  index,
                                  "breakEnd",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />

                          </label>

                          <input
                            type="time"
                            value={
                              session.breakEnd
                            }
                            onChange={(
                              e
                            ) =>
                              handleSessionChange(
                                index,
                                "breakEnd",
                                e.target.value
                              )
                            }
                            className={`w-full bg-gray-50 border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              checkbox.breakEnd
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300"
                            }`}
                          />

                          <p className="text-[10px] text-gray-400 mt-1">
                            {checkbox.breakEnd
                              ? "Included"
                              : "Not included"}
                          </p>

                        </div>

                        {/* CHECK OUT */}

                        <div>

                          <label className="flex items-center justify-between text-xs text-gray-500 mb-1">

                            <span>
                              Check Out
                            </span>

                            <input
                              type="checkbox"
                              checked={
                                checkbox.checkout
                              }
                              onChange={(
                                e
                              ) =>
                                handleFieldCheckbox(
                                  index,
                                  "checkout",
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />

                          </label>

                          <input
                            type="time"
                            value={
                              session.checkout
                            }
                            onChange={(
                              e
                            ) =>
                              handleSessionChange(
                                index,
                                "checkout",
                                e.target.value
                              )
                            }
                            className={`w-full bg-gray-50 border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              checkbox.checkout
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300"
                            }`}
                          />

                          <p className="text-[10px] text-gray-400 mt-1">
                            {checkbox.checkout
                              ? "Included"
                              : "Not included"}
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

            {/* ==================================================
                REASON
            ================================================== */}

            <div>

              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Reason{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <textarea
                rows="3"
                placeholder="Reason for adjustment..."
                value={
                  formData.reason
                }
                onChange={
                  handleReasonChange
                }
                className="w-full bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />

            </div>

            {/* ==================================================
                SUBMIT
            ================================================== */}

            <div className="flex justify-stretch sm:justify-end pt-2">

              <button
                type="submit"
                disabled={
                  submitting ||
                  loading
                }
                className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 transition-colors"
              >
                {submitting
                  ? "Submitting..."
                  : editMode
                  ? "Update Attendance"
                  : "Submit"}
              </button>

            </div>

          </form>

        </div>

        {/* ====================================================
            RIGHT - HISTORY
        ==================================================== */}

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 lg:p-6 shadow-xs flex flex-col">

          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
            Recent Adjustments
          </h2>

          <div className="space-y-3 flex-1 overflow-y-visible lg:overflow-y-auto max-h-none lg:max-h-[500px] pr-0 sm:pr-1">

            {fetchingLogs ? (

              <p className="text-sm text-gray-500 text-center py-4">
                Loading...
              </p>

            ) : recentAdjustments.length ===
              0 ? (

              <p className="text-sm text-gray-500 text-center py-4">
                No adjustments yet
              </p>

            ) : (

              recentAdjustments
                .filter((item) => {
                  const resolvedName = item.employeeName || getEmployeeName(item.employeeId);
                  return resolvedName && resolvedName !== "Unknown Employee" && resolvedName !== "Unknown User";
                })
                .map((item) => {
                  const resolvedName = item.employeeName || getEmployeeName(item.employeeId);
                  return (
                    <div
                      key={item._id}
                      className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/60 text-xs text-gray-600"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800 text-sm">
                          {resolvedName}
                        </span>

                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 border ${getStatusStyle(
                          (() => {
                            const firstSess = Array.isArray(item.sessions) && item.sessions[0] ? item.sessions[0] : {};
                            const rawHours = item.totalWorkTime ?? item.totalWorkTimeHours ?? item.totalHours ?? item.hours ?? item.workHours ?? 0;
                            let totalHours = typeof rawHours === 'number' ? rawHours : parseFloat(rawHours) || 0;
                            const isCheckedOut = Boolean(item.checkOutTime || firstSess.checkout) || totalHours > 0;
                            const rawStatusStr = String(item.status || '').toLowerCase();

                            if (rawStatusStr.includes('half') || item.isHalfDay === true || (isCheckedOut && totalHours > 0 && totalHours < 8)) {
                              return "half-day";
                            }

                            const checkInVal = item.checkInTime || firstSess.checkin || "";
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

                                if (checkInMinutes > HALF_DAY_CUTOFF) return "absent";
                                if (checkInMinutes > LATE_CUTOFF) return "half-day";
                                if (checkInMinutes > OFFICE_START) return "late";
                                return "present";
                              }
                            }
                            return (item.status || "present").toLowerCase();
                          })()
                        )}`}
                      >
                        {(() => {
                          const firstSess = Array.isArray(item.sessions) && item.sessions[0] ? item.sessions[0] : {};
                          const rawHours = item.totalWorkTime ?? item.totalWorkTimeHours ?? item.totalHours ?? item.hours ?? item.workHours ?? 0;
                          let totalHours = typeof rawHours === 'number' ? rawHours : parseFloat(rawHours) || 0;
                          const isCheckedOut = Boolean(item.checkOutTime || firstSess.checkout) || totalHours > 0;
                          const rawStatusStr = String(item.status || '').toLowerCase();

                          if (rawStatusStr.includes('half') || item.isHalfDay === true || (isCheckedOut && totalHours > 0 && totalHours < 8)) {
                            return "HALF DAY";
                          }

                          const checkInVal = item.checkInTime || firstSess.checkin || "";
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

                              if (checkInMinutes > HALF_DAY_CUTOFF) return "ABSENT";
                              if (checkInMinutes > LATE_CUTOFF) return "HALF DAY";
                              if (checkInMinutes > OFFICE_START) return "LATE";
                              return "PRESENT";
                            }
                          }
                          return (item.status || "PRESENT").toUpperCase();
                        })()}
                      </span>

                    </div>

                    <p className="text-gray-500 mt-1">

                      Date:{" "}

                      <span className="text-gray-700">

                        {formatDateDisplay(
                          item.date
                        )}

                      </span>

                    </p>

                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200 flex flex-wrap gap-2">

                      {item.checkInTime && (
                        <span className="bg-green-50 px-1.5 py-0.5 border border-green-200">
                          In:{" "}
                          {formatTimeDisplay(
                            item.checkInTime
                          )}
                        </span>
                      )}

                      {item.checkOutTime && (
                        <span className="bg-red-50 px-1.5 py-0.5 border border-red-200">
                          Out:{" "}
                          {formatTimeDisplay(
                            item.checkOutTime
                          )}
                        </span>
                      )}

                      {item.totalWorkTime >
                        0 && (
                        <span className="bg-blue-50 px-1.5 py-0.5 border border-blue-200">
                          Work:{" "}
                          {
                            item.totalWorkTime
                          }
                          h
                        </span>
                      )}

                    </div>

                    {item.reason && (
                      <p className="mt-2 text-gray-500">

                        Reason:{" "}

                        <span className="text-gray-700">
                          {
                            item.reason
                          }
                        </span>

                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleEditAdjustment(
                          item
                        )
                      }
                      className="mt-3 w-full bg-gray-800 hover:bg-gray-700 text-white py-2 text-xs font-medium transition-colors"
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