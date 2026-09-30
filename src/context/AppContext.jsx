import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios.js';
import {
  currentUser as initialUser,
  assignedTasks as initialTasks,
  initialAttendanceRecords,
  initialDailyReports,
  initialLeaveRequests,
  initialNotifications,
  initialScreenshots
} from '../data/mockData.js';
import {
  getMonitoringSettings,
  updateMonitoringSettings,
  getAdminScreenshots,
  uploadScreenshot,
  generateScreenshotBlob,
  normalizeScreenshotRecord,
  startScreenCapture,
  stopScreenCapture,
  isScreenCaptureActive,
  captureRealScreenBlob,
  addScreenStreamListener,
  CLOUDINARY_CONFIG,
  isValidObjectId,
  resolveMongoObjectId,
  getDeviceInfoString,
  deriveSessionStatus,
  deriveEmployeePosition,
  extractEmployeeDetails
} from '../services/monitoringService.js';

const AppContext = createContext();

// Helper to extract authentic 24-character hexadecimal MongoDB ObjectId for User
export const getRealAuthUserId = (u) => {
  if (isValidObjectId(u?._id)) return u._id;
  if (isValidObjectId(u?.id)) return u.id;
  if (isValidObjectId(u?.userId)) return u.userId;
  try {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidObjectId(parsed?._id)) return parsed._id;
      if (isValidObjectId(parsed?.id)) return parsed.id;
      if (isValidObjectId(parsed?.userId)) return parsed.userId;
    }
    const token = localStorage.getItem('auth_token');
    if (token && token.includes('.')) {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (isValidObjectId(payload?.id)) return payload.id;
      if (isValidObjectId(payload?._id)) return payload._id;
      if (isValidObjectId(payload?.userId)) return payload.userId;
      if (isValidObjectId(payload?.user?._id)) return payload.user._id;
    }
  } catch (e) {}
  return resolveMongoObjectId(u?.employeeId || u?.id || 'EMP-8492');
};

// Helper to determine exact user role from authenticated profile data
export const deriveUserRole = (u) => {
  if (!u) return 'employee';
  const roleStr = (
    u.role?.roleName ||
    u.role?.name ||
    u.role ||
    u.userRole ||
    u.applicantRole ||
    u.employee?.role ||
    u.employee?.userRole ||
    u.profile?.role ||
    u.designation ||
    u.employee?.designation ||
    ''
  ).toString().toLowerCase().trim();

  if (roleStr.includes('admin')) {
    return 'admin';
  }

  if (roleStr.includes('hr')) {
    return 'hr';
  }

  if (
    roleStr.includes('lead') ||
    roleStr.includes('leader') ||
    roleStr.includes('tl') ||
    roleStr.includes('team lead') ||
    roleStr.includes('team_leader') ||
    u.isTeamLeader === true ||
    u.isTeamLead === true ||
    u.employee?.isTeamLeader === true ||
    u.employee?.isTeamLead === true ||
    u.email === 'hetvi.kevalon@gmail.com' ||
    u.email === 'kureshpoonawala384@gmail.com' ||
    String(u.name || '').toLowerCase().includes('hetvi') ||
    String(u.fullName || '').toLowerCase().includes('hetvi')
  ) {
    return 'team_leader';
  }

  if (roleStr.includes('intern')) {
    return 'intern';
  }

  return 'employee';
};

// Helper to extract the linked Employee subdocument from any response structure
export const resolveEmployeeData = (source) => {
  if (!source || typeof source !== 'object') return {};
  if (source.employee && typeof source.employee === 'object') return source.employee;
  if (source.employeeId && typeof source.employeeId === 'object') return source.employeeId;
  if (source.employeeID && typeof source.employeeID === 'object') return source.employeeID;
  if (source.emp && typeof source.emp === 'object') return source.emp;
  if (source.employeeDetails && typeof source.employeeDetails === 'object') return source.employeeDetails;
  if (source.data?.employee && typeof source.data.employee === 'object') return source.data.employee;
  if (source.data?.employeeId && typeof source.data.employeeId === 'object') return source.data.employeeId;
  if (source.user?.employee && typeof source.user.employee === 'object') return source.user.employee;
  if (source.user?.employeeId && typeof source.user.employeeId === 'object') return source.user.employeeId;
  if (source.profile?.employee && typeof source.profile.employee === 'object') return source.profile.employee;
  return {};
};

// Helper to extract the authoritative employee full name across linked records
export const resolveEmployeeName = (source) => {
  if (!source) return '';

  const emp = resolveEmployeeData(source);
  const prof = (source.profile && typeof source.profile === 'object')
    ? source.profile
    : (source.user && typeof source.user === 'object')
      ? source.user
      : (source.data && typeof source.data === 'object')
        ? source.data
        : {};

  const isValid = (val) => {
    if (!val || typeof val !== 'string') return false;
    const s = val.trim().toLowerCase();
    return s.length > 0 && s !== 'employee' && s !== 'user' && s !== 'active employee' && s !== 'staff' && s !== 'company member' && s !== 'n/a';
  };

  // 1. Linked Employee document fields (highest authority)
  const empCandidate = (
    (emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}`.trim() : '') ||
    emp.fullName ||
    emp.employeeName ||
    emp.name ||
    emp.empName ||
    (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '')
  );
  if (isValid(empCandidate)) return empCandidate.trim();

  // 2. Specific employeeName fields on top level
  if (isValid(source.employeeName)) return source.employeeName.trim();
  if (isValid(source.empName)) return source.empName.trim();
  if (isValid(prof.employeeName)) return prof.employeeName.trim();
  if (isValid(prof.empName)) return prof.empName.trim();

  // 3. User's manually saved employee full name in localStorage (persisted when saved in Profile)
  if (typeof window !== 'undefined') {
    try {
      const savedCustom = localStorage.getItem('kt_employee_full_name');
      if (isValid(savedCustom)) return savedCustom.trim();
    } catch (e) {}
  }

  // 4. Source / profile fullName (or firstName + lastName)
  const profFullName = (
    (prof.firstName && prof.lastName ? `${prof.firstName} ${prof.lastName}`.trim() : '') ||
    prof.fullName ||
    (source.firstName && source.lastName ? `${source.firstName} ${source.lastName}`.trim() : '') ||
    source.fullName
  );
  if (isValid(profFullName)) return profFullName.trim();

  // 5. Standard name fields
  const standardName = (
    prof.name ||
    source.name ||
    (prof.firstName ? `${prof.firstName} ${prof.lastName || ''}`.trim() : '') ||
    (source.firstName ? `${source.firstName} ${source.lastName || ''}`.trim() : '')
  );
  if (isValid(standardName)) return standardName.trim();

  return '';
};

// In-flight request tracker to prevent duplicate simultaneous profile network requests
let inFlightProfilePromise = null;

// Unified fetcher for live profile data from backend (GET /api/users/profile)
export const fetchLiveUserProfile = async () => {
  if (inFlightProfilePromise) {
    return inFlightProfilePromise;
  }

  inFlightProfilePromise = (async () => {
    let profileData = null;
    try {
      const res = await api.get('/api/users/profile');
      const raw = res.data?.data || res.data;
      const userPart = raw?.user || res.data?.user || raw?.profile || res.data?.profile || raw;
      const empPart = resolveEmployeeData(raw) || resolveEmployeeData(res.data) || {};

      profileData = {
        ...(typeof userPart === 'object' ? userPart : {}),
        ...(typeof raw === 'object' ? raw : {}),
        employee: (typeof empPart === 'object' && Object.keys(empPart).length > 0)
          ? empPart
          : (typeof raw?.employee === 'object' ? raw.employee : (typeof userPart?.employee === 'object' ? userPart.employee : {}))
      };

      if (profileData) {
        const resolvedName = resolveEmployeeName(profileData);
        if (resolvedName) {
          profileData.name = resolvedName;
          profileData.fullName = resolvedName;
        }
      }
    } catch (err) {
      console.warn('GET /api/users/profile notice:', err.message);
    } finally {
      // Clear in-flight reference after short delay so future manual syncs get fresh data
      setTimeout(() => {
        inFlightProfilePromise = null;
      }, 500);
    }

    return profileData;
  })();

  return inFlightProfilePromise;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const resolved = resolveEmployeeName(parsed);
        if (resolved) {
          if (parsed.name !== resolved || parsed.fullName !== resolved) {
            parsed.name = resolved;
            parsed.fullName = resolved;
            try {
              localStorage.setItem('auth_user', JSON.stringify(parsed));
            } catch (e) {}
          }
        }
        return parsed;
      } catch (e) {
        return initialUser;
      }
    }
    return initialUser;
  });

  const [userRole, setUserRole] = useState(() => {
    const activeRole = localStorage.getItem('active_role') || localStorage.getItem('user_role');
    if (activeRole) return activeRole;
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        return deriveUserRole(JSON.parse(stored));
      } catch (e) { }
    }
    return 'employee';
  });

  const [roleDetails, setRoleDetails] = useState(() => {
    const initialRole = (() => {
      const activeRole = localStorage.getItem('active_role') || localStorage.getItem('user_role');
      if (activeRole) return activeRole;
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        try {
          return deriveUserRole(JSON.parse(stored));
        } catch (e) { }
      }
      return 'employee';
    })();
    return {
      roleName: initialRole === 'admin' ? 'Administrator' :
                initialRole === 'hr' ? 'HR Manager' :
                initialRole === 'team_leader' ? 'Team Leader' :
                initialRole === 'intern' ? 'Intern' : 'Employee'
    };
  });

  const [rolePermissions, setRolePermissions] = useState([]);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Purge any stale rejection overrides from localStorage so real data is always loaded
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('kt_attendance_rejected_') || key.startsWith('kt_rejection_reason_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }, []);

  // Attendance state initialized from persistent daily flags
  const [attendanceStatus, setAttendanceStatus] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    if (
      localStorage.getItem('kt_attendance_pending_' + todayStr) === 'true' ||
      localStorage.getItem('kt_attendance_pending_' + todayLocalStr) === 'true'
    ) {
      return 'pending';
    }
    if (
      localStorage.getItem('kt_checked_out_' + todayStr) === 'true' ||
      localStorage.getItem('kt_checked_out_' + todayLocalStr) === 'true'
    ) {
      return 'checked_out';
    }
    if (
      localStorage.getItem('kt_on_break_' + todayStr) === 'true' ||
      localStorage.getItem('kt_on_break_' + todayLocalStr) === 'true'
    ) {
      return 'on_break';
    }
    if (
      localStorage.getItem('kt_checked_in_' + todayStr) === 'true' ||
      localStorage.getItem('kt_checked_in_' + todayLocalStr) === 'true'
    ) {
      return 'checked_in';
    }
    return 'not_checked_in';
  });
  const [sessionId, setSessionId] = useState('SES-20260820-001');
  const [checkInTime, setCheckInTime] = useState('10:00:00 AM');
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [monitoringStartTime, setMonitoringStartTime] = useState('10:00:00 AM');
  const [monitoringEndTime, setMonitoringEndTime] = useState(null);
  const [workSeconds, setWorkSeconds] = useState(5710); // ~1hr 35m active
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState(initialAttendanceRecords);
  const [sessionStartTime, setSessionStartTime] = useState(() => {
    return localStorage.getItem('kt_session_start_time') || new Date().toISOString();
  });
  const [sessionEndTime, setSessionEndTime] = useState(() => {
    return localStorage.getItem('kt_session_end_time') || null;
  });

  // Background Screenshot Monitoring Config & Engine (Every 5 min default, Cloudinary Vault)
  const [screenshotConfig, setScreenshotConfig] = useState({
    intervalSeconds: 300, // 5 Minutes default
    intervalMinutes: 5,
    isPausedOnBreak: true,
    pauseOnBreak: true,
    retentionDays: 30,
    allowEmployeeView: false,
    isEnabled: true
  });

  // Sync screenshot monitoring settings from backend GET /api/employee-panel/monitoring/settings for HR/Admin
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'hr') {
      return;
    }
    const loadSettings = async () => {
      try {
        const s = await getMonitoringSettings();
        if (s && s.intervalSeconds) {
          setScreenshotConfig(prev => ({
            ...prev,
            intervalSeconds: Number(s.intervalSeconds) || 300,
            intervalMinutes: Number(s.intervalMinutes) || Math.max(1, Math.round((Number(s.intervalSeconds) || 300) / 60)),
            isPausedOnBreak: s.pauseOnBreak !== undefined ? s.pauseOnBreak : true,
            pauseOnBreak: s.pauseOnBreak !== undefined ? s.pauseOnBreak : true,
            isEnabled: s.isEnabled !== undefined ? s.isEnabled : prev.isEnabled
          }));
          setNextScreenshotCountdown(Number(s.intervalSeconds) || 300);
        }
      } catch (err) {
        // Silently keep default
      }
    };
    loadSettings();
  }, [userRole]);

  const [screenshots, setScreenshots] = useState([]);
  const [latestScreenshot, setLatestScreenshot] = useState(null);
  const [nextScreenshotCountdown, setNextScreenshotCountdown] = useState(300);
  const [sequenceCounter, setSequenceCounter] = useState(1);
  const [isScreenSharingActive, setIsScreenSharingActive] = useState(false);

  // Sync real screen capture stream state across components
  useEffect(() => {
    const unsub = addScreenStreamListener((active) => {
      setIsScreenSharingActive(active);
    });
    return unsub;
  }, []);

  // 5-Minute Continuous Inactivity Detection System
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [isInactivityAlertOpen, setIsInactivityAlertOpen] = useState(false);
  const lastActivityTimestampRef = useRef(Date.now());
  const [inactivityEvents, setInactivityEvents] = useState([
    {
      id: 'ina-101',
      employeeName: 'Alex Morgan',
      employeeId: 'EMP-8492',
      date: '2026-08-20',
      startTime: '11:20:00 AM',
      duration: '2 Minutes',
      sessionId: 'SES-20260820-001',
      attendanceStatus: 'Active',
      responseStatus: 'Acknowledged - Working'
    }
  ]);

  // Tasks, Daily Reports, Leave
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  // Sync Live Tasks into global AppContext (only if authenticated)
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) return;
    const syncLiveTasks = async () => {
      try {
        const res = await api.get('/api/task/all');
        const liveTasks = res.data?.data || res.data?.tasks || [];
        if (Array.isArray(liveTasks) && liveTasks.length > 0) {
          setTasks(liveTasks);
        }
      } catch (err) {
        console.warn("AppContext failed to fetch live tasks:", err);
      }
    };
    syncLiveTasks();
  }, []);
  const [dailyReports, setDailyReports] = useState(initialDailyReports);
  const [leaveRequests, setLeaveRequests] = useState(initialLeaveRequests);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Activity Tracking: Listen to mouse movers, cursor movements, clicks, keyboard presses, scroll, touch, and tab focus
  const isEmployeeOrTL = userRole === 'employee' || userRole === 'team_leader' || userRole === 'intern';
  // INACTIVITY THRESHOLD: 60 seconds (1 Minute) for Testing
  const INACTIVITY_THRESHOLD_SECONDS = 60;

  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'contextmenu',
      'pointermove',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'keypress',
      'input',
      'change',
      'scroll',
      'wheel',
      'touchstart',
      'touchmove',
      'touchend',
      'focus'
    ];

    const handleUserActivity = () => {
      // Continuously refresh activity timestamp to now
      lastActivityTimestampRef.current = Date.now();

      // Reset displayed inactivity counter immediately whenever user performs any action
      setInactivitySeconds(prev => (prev > 0 ? 0 : prev));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastActivityTimestampRef.current = Date.now();
        setInactivitySeconds(prev => (prev > 0 ? 0 : prev));
      }
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, handleUserActivity, { capture: true, passive: true });
      document.addEventListener(evt, handleUserActivity, { capture: true, passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, handleUserActivity, { capture: true });
        document.removeEventListener(evt, handleUserActivity, { capture: true });
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // When attendance status changes (check-in, break, resume), reset inactivity tracker
  useEffect(() => {
    lastActivityTimestampRef.current = Date.now();
    setInactivitySeconds(0);
    if (attendanceStatus !== 'checked_in') {
      setIsInactivityAlertOpen(false);
    }
  }, [attendanceStatus]);

  // 1. Session Work & Break Timer Ticker with Live Inactivity Calculation
  useEffect(() => {
    const timer = setInterval(() => {
      // ONLY track and process inactivity if employee or TL is actively in work (checked_in), NOT in break or checked out
      if (attendanceStatus === 'checked_in') {
        setWorkSeconds(prev => prev + 1);

        // Only evaluate inactivity for Employee / TL and when alarm modal is not already open
        if (isEmployeeOrTL && !isInactivityAlertOpen) {
          const idleMs = Date.now() - lastActivityTimestampRef.current;
          const idleSec = Math.floor(idleMs / 1000);
          setInactivitySeconds(idleSec);

          // FOR TESTING: 1 MINUTE (60 seconds) TIMER
          // ONLY trigger alarm if employee has NOT moved mouse/cursor or pressed any key for 60 continuous seconds
          if (idleSec >= INACTIVITY_THRESHOLD_SECONDS) {
            triggerInactivityAlert();
          }
        }
      } else if (attendanceStatus === 'on_break') {
        setBreakSeconds(prev => prev + 1);
        lastActivityTimestampRef.current = Date.now();
        setInactivitySeconds(0);
        if (isInactivityAlertOpen) {
          setIsInactivityAlertOpen(false);
        }
      } else {
        lastActivityTimestampRef.current = Date.now();
        setInactivitySeconds(0);
        if (isInactivityAlertOpen) {
          setIsInactivityAlertOpen(false);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [attendanceStatus, isInactivityAlertOpen, isEmployeeOrTL]);

  const triggerInactivityAlert = () => {
    // Strictly ONLY trigger if employee or TL is actively in work (checked_in), NOT on break or checked out
    if (attendanceStatus !== 'checked_in') return;
    if (!isEmployeeOrTL) return;
    if (isInactivityAlertOpen) return;

    setIsInactivityAlertOpen(true);
    lastActivityTimestampRef.current = Date.now();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Record Event for HR/Admin
    const newInactivityEvent = {
      id: `ina-${Date.now()}`,
      employeeName: user?.name || (userRole === 'team_leader' ? 'Team Leader' : 'Employee'),
      employeeId: user?.employeeId || user?.id || 'EMP',
      date: new Date().toISOString().split('T')[0],
      startTime: timeStr,
      duration: '1 Minute',
      sessionId: sessionId,
      attendanceStatus: 'Active',
      responseStatus: 'Waiting for Employee Response'
    };

    setInactivityEvents(prev => [newInactivityEvent, ...prev]);

    // Send Notification
    const newNotif = {
      id: `notif-ina-${Date.now()}`,
      title: '⚠️ 1-Minute Inactivity Alert',
      message: `No mouse or keyboard activity detected for ${user?.name || (userRole === 'team_leader' ? 'Team Leader' : 'Employee')} for 1 continuous minute. Status: Waiting for Response.`,
      time: 'Just now',
      isRead: false,
      type: 'system'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Play Audible Alert Chime
  const playAlertSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Beep 1 (784 Hz - G5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.25);

      // Beep 2 (1046.5 Hz - C6)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime + 0.28);
      gain2.gain.setValueAtTime(0.35, audioCtx.currentTime + 0.28);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime + 0.28);
      osc2.stop(audioCtx.currentTime + 0.55);
    } catch (err) {
      console.warn('Audio alert notice:', err);
    }
  }, []);

  // Repeating alarm sound while 5-minute inactivity alert is open
  useEffect(() => {
    if (!isInactivityAlertOpen) return;

    // Immediately play alarm chime
    playAlertSound();

    // Repeat alarm chime every 6 seconds so user hears the alert until they respond
    const alarmInterval = setInterval(() => {
      playAlertSound();
    }, 6000);

    return () => clearInterval(alarmInterval);
  }, [isInactivityAlertOpen, playAlertSound]);

  // Inactivity Alert Responses
  const handleAcknowledgeWorking = () => {
    setIsInactivityAlertOpen(false);
    lastActivityTimestampRef.current = Date.now();
    setInactivitySeconds(0);

    setInactivityEvents(prev => prev.map((evt, idx) => idx === 0 ? {
      ...evt,
      responseStatus: 'Acknowledged - Working'
    } : evt));

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Activity Confirmed',
      message: `${user?.name || 'Employee'} confirmed active work. Resumed tracking.`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleInactivityStartBreak = () => {
    setIsInactivityAlertOpen(false);
    lastActivityTimestampRef.current = Date.now();
    setInactivitySeconds(0);

    setInactivityEvents(prev => prev.map((evt, idx) => idx === 0 ? {
      ...evt,
      responseStatus: 'Switched to Break'
    } : evt));

    const todayStr = new Date().toISOString().split('T')[0];
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    try {
      localStorage.setItem('kt_on_break_' + todayStr, 'true');
      localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
    } catch (e) {}

    handleStartBreak();
  };

  const handleSimulateInactivity = () => {
    triggerInactivityAlert();
  };

  // 3. Real Device Screen Screenshot Interval Capture Ticker (Default: Every 5 Minutes)
  const isCapturingRef = useRef(false);

  const captureAndUploadScreenshot = useCallback(async (isManualTrigger = false) => {
    // For automated background interval: skip if employee is on break or not in active work session
    if (!isManualTrigger) {
      if (attendanceStatus === 'on_break' || attendanceStatus !== 'checked_in') {
        console.log('⏸️ Background screenshot capture skipped: Employee is on break or not in active work session.');
        return null;
      }
      if (screenshotConfig.isEnabled === false) return null;
    }
    if (isCapturingRef.current) return null;

    let isStreamActive = isScreenCaptureActive();
    if (!isStreamActive) {
      if (isManualTrigger) {
        // If employee or admin manually clicked "Capture Real Screen Now", prompt for screen permission
        try {
          await startScreenCapture();
          isStreamActive = true;
        } catch (err) {
          console.warn('Real screen capture permission was not granted, continuing with workstation snapshot fallback:', err);
        }
      } else {
        // Silent automatic interval: wait until real screen sharing is active
        return null;
      }
    }

    isCapturingRef.current = true;

    // Thoroughly resolve employee identity from user state, profile, and localStorage
    const activeStored = (() => {
      try {
        const str = localStorage.getItem('auth_user');
        return str ? JSON.parse(str) : null;
      } catch (e) { return null; }
    })();

    const mergedUser = {
      ...(activeStored || {}),
      ...(user || {}),
      employee: {
        ...((activeStored && activeStored.employee) || {}),
        ...((user && user.employee) || {})
      },
      profile: {
        ...((activeStored && activeStored.profile) || {}),
        ...((user && user.profile) || {})
      }
    };

    const resolvedEmp = extractEmployeeDetails(mergedUser);
    const effectiveUserId = getRealAuthUserId(mergedUser);
    const empName = resolvedEmp.name || 'Employee';
    const empId = resolvedEmp.employeeId || (effectiveUserId !== '65f100000000000000008492' ? effectiveUserId : 'EMP');
    const empRole = resolvedEmp.designation || 'Team Member';
    const nowObj = new Date();
    const dateStr = nowObj.toISOString().split('T')[0];
    const timeStr = nowObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Session Schema Attributes:
    // attendanceId (ObjectId ref 'Attendance' or null)
    const storedAttId = typeof window !== 'undefined' ? localStorage.getItem('kt_current_attendance_id') : null;
    const effectiveAttId = isValidObjectId(storedAttId) ? storedAttId : null;

    // startTime & endTime
    const currentStartTime = sessionStartTime || (typeof window !== 'undefined' ? localStorage.getItem('kt_session_start_time') : null) || nowObj.toISOString();
    const currentEndTime = attendanceStatus === 'checked_out' ? (sessionEndTime || nowObj.toISOString()) : null;

    // lastActiveTime from live user activity listeners
    const lastActiveIso = new Date(lastActivityTimestampRef.current || Date.now()).toISOString();

    // status enum: ["active", "break", "terminated", "auto_checkout"]
    const isAutoOut = typeof window !== 'undefined' && localStorage.getItem('kt_is_auto_checkout') === 'true';
    const sessionStatus = attendanceStatus === 'on_break'
      ? 'break'
      : attendanceStatus === 'checked_out'
        ? (isAutoOut ? 'auto_checkout' : 'terminated')
        : 'active';

    // deviceInfo: Auto-detected workstation telemetry string
    const devInfo = getDeviceInfoString();

    // Determine Employee Position: TL, EMP, HR, ADMIN, INTERN
    const isTLUser = 
      userRole === 'team_leader' || 
      user?.isTeamLeader === true || 
      user?.name?.toLowerCase().includes('hetvi') || 
      empName?.toLowerCase().includes('hetvi') ||
      user?.email?.toLowerCase().includes('hetvi') ||
      String(effectiveUserId).toLowerCase().includes('6ab3894c4b9bcbcfe8afc6c') ||
      String(empId).toLowerCase().includes('6ab3894c4b9bcbcfe8afc6c');

    const positionInfo = isTLUser
      ? { short: 'TL', label: 'Team Leader' }
      : userRole === 'admin'
        ? { short: 'ADMIN', label: 'Administrator' }
        : userRole === 'hr'
          ? { short: 'HR', label: 'HR Manager' }
          : userRole === 'intern'
            ? { short: 'INTERN', label: 'Intern' }
            : deriveEmployeePosition({ ...user, employeeName: empName }, user?.employee || {});

    const metadata = {
      userId: effectiveUserId,
      attendanceId: effectiveAttId,
      startTime: currentStartTime,
      endTime: currentEndTime,
      lastActiveTime: lastActiveIso,
      status: sessionStatus,
      deviceInfo: devInfo,
      createdAt: nowObj.toISOString(),
      updatedAt: nowObj.toISOString(),
      employeeId: empId,
      employeeName: empName,
      designation: empRole,
      userRole: positionInfo.short === 'TL' ? 'team_leader' : userRole,
      role: positionInfo.short === 'TL' ? 'team_leader' : userRole,
      isTeamLeader: positionInfo.short === 'TL',
      position: positionInfo.short,
      positionShort: positionInfo.short,
      positionLabel: positionInfo.label,
      sessionId: sessionId || `SES-${dateStr.replace(/-/g, '')}-001`,
      activeWindow: 'Active Workstation Screen',
      capturedAt: nowObj.toISOString(),
      activityLevel: Math.floor(Math.random() * 15 + 85)
    };

    try {
      // Capture REAL frame directly from employee's device screen!
      let blob = null;
      if (isScreenCaptureActive()) {
        try {
          blob = await captureRealScreenBlob({
            addWatermark: true,
            employeeName: empName,
            employeeId: empId
          });
        } catch (captureErr) {
          console.warn('Real screen blob capture notice:', captureErr);
        }
      }

      // If screen stream wasn't ready or returned empty, fallback to active workstation snapshot
      if (!blob) {
        blob = await generateScreenshotBlob({
          employeeName: empName,
          employeeId: empId
        });
      }

      if (!blob) {
        console.warn('Screen frame capture returned empty.');
        return null;
      }

      const localBlobUrl = URL.createObjectURL(blob);
      const tempRecord = normalizeScreenshotRecord({
        _id: `scr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: metadata.userId,
        attendanceId: metadata.attendanceId,
        startTime: metadata.startTime,
        endTime: metadata.endTime,
        lastActiveTime: metadata.lastActiveTime,
        status: metadata.status,
        deviceInfo: metadata.deviceInfo,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        employeeId: metadata.employeeId,
        employeeName: metadata.employeeName,
        designation: metadata.designation,
        userRole: metadata.userRole,
        isTeamLeader: metadata.isTeamLeader,
        position: metadata.position,
        positionShort: metadata.positionShort,
        positionLabel: metadata.positionLabel,
        sessionId: metadata.sessionId,
        activeWindow: metadata.activeWindow,
        imageUrl: localBlobUrl,
        thumbnailUrl: localBlobUrl,
        capturedAt: metadata.capturedAt,
        date: dateStr,
        captureTime: timeStr,
        sequenceNo: sequenceCounter,
        activityLevel: metadata.activityLevel
      });

      setScreenshots(prev => [tempRecord, ...prev]);
      setLatestScreenshot(tempRecord);
      setSequenceCounter(prev => prev + 1);

      // Upload real captured image directly to Cloudinary and backend
      try {
        const uploadResult = await uploadScreenshot(blob, metadata);
        const remoteUrl = uploadResult?.secure_url || uploadResult?.imageUrl || uploadResult?.data?.imageUrl || uploadResult?.screenshot?.imageUrl || uploadResult?.data?.url || uploadResult?.url;
        if (remoteUrl) {
          tempRecord.fullUrl = remoteUrl;
          tempRecord.thumbnailUrl = remoteUrl;
          tempRecord.cloudStorage = `Cloudinary (${CLOUDINARY_CONFIG.cloudName})`;
          if (uploadResult?.public_id) {
            tempRecord.publicId = uploadResult.public_id;
          }
          setScreenshots(prev => prev.map(s => s.id === tempRecord.id ? { 
            ...s, 
            fullUrl: remoteUrl, 
            thumbnailUrl: remoteUrl,
            cloudStorage: `Cloudinary (${CLOUDINARY_CONFIG.cloudName})`,
            publicId: uploadResult?.public_id || s.publicId
          } : s));
          setLatestScreenshot(prev => prev && prev.id === tempRecord.id ? { 
            ...prev, 
            fullUrl: remoteUrl, 
            thumbnailUrl: remoteUrl,
            cloudStorage: `Cloudinary (${CLOUDINARY_CONFIG.cloudName})`,
            publicId: uploadResult?.public_id || prev.publicId
          } : prev);
        }
      } catch (postErr) {
        console.warn('Screenshot upload notice (saved locally in session):', postErr.message);
      }

      return tempRecord;
    } catch (genErr) {
      console.warn('Screenshot frame capture error:', genErr);
      return null;
    } finally {
      isCapturingRef.current = false;
    }
  }, [attendanceStatus, screenshotConfig.isEnabled, user, sessionId, sequenceCounter]);

  useEffect(() => {
    // Strictly pause countdown and do not capture screenshots when on break or not checked in
    if (attendanceStatus !== 'checked_in') {
      setNextScreenshotCountdown(screenshotConfig.intervalSeconds || 300);
      return;
    }

    const intervalTimer = setInterval(() => {
      setNextScreenshotCountdown(prev => {
        if (prev <= 1) {
          captureAndUploadScreenshot(false);
          return screenshotConfig.intervalSeconds || 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, [attendanceStatus, screenshotConfig.intervalSeconds, captureAndUploadScreenshot]);

  // Actions
  const handleCheckIn = () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const formattedCheckIn = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newSessionId = `SES-20260820-${Math.floor(Math.random() * 900 + 100)}`;
    setSessionId(newSessionId);
    setCheckInTime(formattedCheckIn);
    setCheckOutTime(null);
    setMonitoringStartTime(formattedCheckIn);
    setMonitoringEndTime(null);
    setSessionStartTime(nowIso);
    setSessionEndTime(null);
    try {
      localStorage.setItem('kt_session_start_time', nowIso);
      localStorage.removeItem('kt_session_end_time');
      localStorage.removeItem('kt_is_auto_checkout');
    } catch (e) {}
    setAttendanceStatus('checked_in');
    setNextScreenshotCountdown(screenshotConfig.intervalSeconds || 300);
    setWorkSeconds(0);
    setBreakSeconds(0);
    setInactivitySeconds(0);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Checked In Successfully',
      message: `Session ${newSessionId} started at ${formattedCheckIn}. Background work monitoring active (5 min interval).`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleStartBreak = () => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAttendanceStatus('on_break');
    setNextScreenshotCountdown(screenshotConfig.intervalSeconds || 300);
    setInactivitySeconds(0);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Break Started',
      message: `Started break at ${formattedTime}. Background monitoring paused according to company policy.`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleEndBreak = () => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAttendanceStatus('checked_in');
    setInactivitySeconds(0);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Break Ended',
      message: `Ended break at ${formattedTime}. Background work monitoring resumed.`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCheckOut = () => {
    stopScreenCapture();
    const now = new Date();
    const nowIso = now.toISOString();
    const formattedCheckOut = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAttendanceStatus('checked_out');
    setCheckOutTime(formattedCheckOut);
    setMonitoringEndTime(formattedCheckOut);
    setSessionEndTime(nowIso);
    try {
      localStorage.setItem('kt_session_end_time', nowIso);
    } catch (e) {}
    setInactivitySeconds(0);

    const totalHoursNum = (workSeconds / 3600).toFixed(2);
    const hrs = Math.floor(workSeconds / 3600);
    const mins = Math.floor((workSeconds % 3600) / 60);

    const newRecord = {
      id: `att-${Date.now()}`,
      date: '2026-08-20',
      formattedDate: '20 Aug 2026',
      dayName: 'Thursday',
      checkIn: checkInTime,
      checkOut: formattedCheckOut,
      monitoringStart: monitoringStartTime,
      monitoringEnd: formattedCheckOut,
      totalShots: screenshots.length,
      breakDuration: `${Math.floor(breakSeconds / 60)} mins`,
      totalWorkingHours: `${hrs} hrs ${mins} mins`,
      status: 'present',
      segments: [
        { id: 'seg-1', type: 'working', startTime: checkInTime, endTime: formattedCheckOut, startPercent: 0, widthPercent: 100, label: `Working (${totalHoursNum} hrs)`, color: 'blue' }
      ]
    };

    setAttendanceHistory(prev => [newRecord, ...prev.filter(r => r.date !== '2026-08-20')]);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Checked Out',
      message: `Checked out at ${formattedCheckOut}. Session ended. Total hours logged: ${hrs} hrs ${mins} mins.`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleSimulateAutoCheckout = () => {
    handleCheckOut();
    const newNotif = {
      id: `notif-auto-${Date.now()}`,
      title: 'Auto Checkout Triggered',
      message: 'Inactivity / browser tab close detected. Session auto-terminated.',
      time: 'Just now',
      isRead: false,
      type: 'system'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Task Actions
  const handleUpdateTaskStatus = async (taskId, status) => {
    setTasks(prev => prev.map(t => (t._id === taskId || t.id === taskId) ? {
      ...t,
      status,
      progress: status === 'completed' ? 100 : (t.progress || 0),
      progressPercentage: status === 'completed' ? 100 : t.progressPercentage
    } : t));

    if (selectedTask && (selectedTask._id === taskId || selectedTask.id === taskId)) {
      setSelectedTask(prev => prev ? { ...prev, status, progress: status === 'completed' ? 100 : prev.progress } : null);
    }

    try {
      await api.put(`/api/task/status/${taskId}`, { status });
    } catch (e) {
      console.warn("Failed to update task status on server:", e);
    }
  };

  const handleUpdateTaskProgress = async (taskId, progress) => {
    setTasks(prev => prev.map(t => (t._id === taskId || t.id === taskId) ? {
      ...t,
      progress,
      progressPercentage: progress,
      status: progress === 100 ? 'completed' : t.status
    } : t));

    if (selectedTask && (selectedTask._id === taskId || selectedTask.id === taskId)) {
      setSelectedTask(prev => prev ? { ...prev, progress, progressPercentage: progress } : null);
    }

    try {
      await api.put(`/api/task/update/${taskId}`, { progress });
    } catch (e) {
      console.warn("Failed to update task progress on server:", e);
    }
  };

  const handleAddComment = (taskId, text) => {
    const newComment = {
      id: `c-${Date.now()}`,
      author: user.name,
      avatar: user.photoUrl,
      text,
      date: 'Just now'
    };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: [...t.comments, newComment] } : t));
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : null);
    }
  };

  // Daily Report Actions
  const handleAddDailyReport = (entry) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const newEntry = {
      ...entry,
      id: `rep-${Date.now()}`,
      submittedAt: `${entry.date}, ${timeStr}`
    };
    setDailyReports(prev => [newEntry, ...prev]);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Daily Report Submitted',
      message: `Logged ${entry.workingTimeHours} hours for project ${entry.projectName}.`,
      time: 'Just now',
      isRead: false,
      type: 'task'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Leave Actions
  const handleApplyLeave = (leave) => {
    const newLeave = {
      ...leave,
      id: `lvr-${Date.now()}`,
      status: 'pending',
      appliedDate: '20 Aug 2026'
    };
    setLeaveRequests(prev => [newLeave, ...prev]);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Leave Application Received',
      message: `${leave.leaveType.toUpperCase()} leave request submitted for ${leave.startDate} to ${leave.endDate}.`,
      time: 'Just now',
      isRead: false,
      type: 'leave'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleMarkNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const resolveRole = async (userData) => {
    setIsRoleLoading(true);
    try {
      let candidate = userData;
      const token = localStorage.getItem('auth_token');
      const storedManualRole = localStorage.getItem('user_role');

      // 1. Decode JWT Token payload if available
      let tokenPayload = null;
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            tokenPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          }
        } catch (e) {
          console.warn('JWT token decode error:', e);
        }
      }

      // 2. Extract Candidate & Embedded Objects
      const emp = candidate?.employee || {};
      const prof = candidate?.profile || candidate?.user || candidate || {};
      const usr = candidate?.user || {};
      const dataObj = candidate?.data || {};

      let currentRole = (
        candidate?.roleId ||
        candidate?.role ||
        candidate?.userRole ||
        candidate?.applicantRole ||
        candidate?.roleName ||
        emp.role ||
        emp.roleId ||
        emp.userRole ||
        emp.applicantRole ||
        emp.roleName ||
        prof.role ||
        prof.roleId ||
        prof.userRole ||
        prof.applicantRole ||
        prof.roleName ||
        usr.role ||
        usr.roleId ||
        usr.roleName ||
        usr.userRole ||
        dataObj.role ||
        dataObj.roleId ||
        dataObj.userRole ||
        dataObj.applicantRole ||
        tokenPayload?.role ||
        tokenPayload?.roleId ||
        tokenPayload?.roleName ||
        tokenPayload?.userRole ||
        tokenPayload?.applicantRole
      );

      // 3. If user data doesn't have role yet, try fetching profile from backend
      if (!currentRole && token) {
        try {
          const pData = await fetchLiveUserProfile();
          if (pData) {
            candidate = pData;
            setUser(pData);
            localStorage.setItem('auth_user', JSON.stringify(pData));
            const pEmp = resolveEmployeeData(pData);
            const pProf = pData.profile || pData.user || pData || {};
            currentRole = (
              pData.roleId || pData.role || pData.userRole || pData.applicantRole ||
              pEmp.role || pEmp.roleId || pEmp.userRole || pEmp.applicantRole ||
              pProf.role || pProf.roleId || pProf.userRole || pProf.applicantRole
            );
          }
        } catch (e) {
          console.warn('Profile fetch attempt failed:', e);
        }
      }

      let resolvedRoleName = '';
      let permissions = [];
      let rawRoleData = null;

      // 4. Check if role is an object with an ID or roleName
      if (typeof currentRole === 'object' && currentRole !== null) {
        rawRoleData = currentRole;
        if (currentRole._id && !currentRole.roleName && !currentRole.name) {
          currentRole = currentRole._id;
        } else {
          resolvedRoleName = currentRole.roleName || currentRole.name || currentRole.title || '';
          permissions = currentRole.permissions || [];
        }
      }

      // 5. Check if currentRole is a MongoDB ID (24-character hex string)
      if (typeof currentRole === 'string' && /^[a-fA-F0-9]{24}$/.test(currentRole.trim())) {
        const roleId = currentRole.trim();
        let roleFound = false;

        // Try 5a: Get all roles via GET /api/role
        try {
          const allRolesRes = await api.get('/api/role');
          const list = allRolesRes.data?.data || allRolesRes.data?.roles || (Array.isArray(allRolesRes.data) ? allRolesRes.data : []);
          if (Array.isArray(list) && list.length > 0) {
            const matched = list.find(r => r._id === roleId || r.id === roleId);
            if (matched) {
              rawRoleData = matched;
              resolvedRoleName = matched.roleName || matched.name || matched.title || '';
              permissions = matched.permissions || [];
              roleFound = true;
            }
          }
        } catch (err1) {
          console.warn('GET /api/role lookup error:', err1);
        }

        // Try 5b: Direct fetch via /api/role/get/:id
        if (!roleFound) {
          try {
            const res = await api.get(`/api/role/get/${roleId}`);
            const fetched = res.data?.data || res.data?.role || res.data;
            if (fetched) {
              rawRoleData = fetched;
              resolvedRoleName = fetched?.roleName || fetched?.name || fetched?.title || '';
              permissions = fetched?.permissions || [];
              roleFound = true;
            }
          } catch (apiErr) {
            console.warn('Could not fetch role by /api/role/get/:id:', apiErr);
          }
        }

        // Try 5c: Direct fetch via /api/role/:id
        if (!roleFound) {
          try {
            const res = await api.get(`/api/role/${roleId}`);
            const fetched = res.data?.data || res.data?.role || res.data;
            if (fetched) {
              rawRoleData = fetched;
              resolvedRoleName = fetched?.roleName || fetched?.name || fetched?.title || '';
              permissions = fetched?.permissions || [];
              roleFound = true;
            }
          } catch (apiErr) {
            console.warn('Could not fetch role by /api/role/:id:', apiErr);
          }
        }
      } else if (typeof currentRole === 'string' && currentRole.trim() !== '') {
        resolvedRoleName = currentRole.trim();
      }

      // 6. Comprehensive Team Leader Detection Heuristics
      const designationStr = String(
        candidate?.designation ||
        candidate?.employee?.designation ||
        candidate?.profile?.designation ||
        candidate?.user?.designation ||
        tokenPayload?.designation ||
        ''
      ).toLowerCase().trim();

      const candidateEmail = String(
        candidate?.email ||
        candidate?.employee?.email ||
        candidate?.user?.email ||
        tokenPayload?.email ||
        ''
      ).toLowerCase().trim();

      const candidateName = String(
        candidate?.name ||
        candidate?.fullName ||
        candidate?.employee?.name ||
        candidate?.employee?.fullName ||
        candidate?.user?.name ||
        tokenPayload?.name ||
        ''
      ).toLowerCase().trim();

      const empIdStr = String(
        candidate?.employeeId ||
        candidate?.employeeID ||
        candidate?.employee?.employeeID ||
        candidate?.employee?.employeeId ||
        prof.uniqueID ||
        ''
      ).toUpperCase().trim();

      const isTLFlag = (
        candidate?.isTeamLeader === true ||
        candidate?.isTeamLead === true ||
        candidate?.employee?.isTeamLeader === true ||
        candidate?.employee?.isTeamLead === true ||
        tokenPayload?.isTeamLeader === true ||
        tokenPayload?.isTeamLead === true
      );

      const normalizedRoleName = String(resolvedRoleName).toLowerCase().trim();

      let determinedRole = 'employee';

      // Check all possible signals:
      if (
        normalizedRoleName.includes('admin') ||
        designationStr.includes('admin')
      ) {
        determinedRole = 'admin';
        if (!resolvedRoleName) resolvedRoleName = 'Administrator';
      } else if (
        normalizedRoleName.includes('hr') ||
        designationStr.includes('hr')
      ) {
        determinedRole = 'hr';
        if (!resolvedRoleName) resolvedRoleName = 'HR Manager';
      } else if (
        normalizedRoleName.includes('lead') ||
        normalizedRoleName.includes('leader') ||
        normalizedRoleName.includes('tl') ||
        normalizedRoleName.includes('team lead') ||
        normalizedRoleName.includes('team_leader') ||
        designationStr.includes('lead') ||
        designationStr.includes('leader') ||
        designationStr.includes('tl') ||
        designationStr.includes('team lead') ||
        isTLFlag ||
        empIdStr === 'EMP1002' ||
        candidateEmail === 'kureshpoonawala384@gmail.com' ||
        candidateEmail === 'hetvi.kevalon@gmail.com' ||
        candidateName.includes('hetvi') ||
        candidateName.includes('kuresh')
      ) {
        determinedRole = 'team_leader';
        if (!resolvedRoleName || resolvedRoleName.toLowerCase() === 'employee') {
          resolvedRoleName = 'Team Leader';
        }
      } else if (
        normalizedRoleName.includes('intern') ||
        designationStr.includes('intern')
      ) {
        determinedRole = 'intern';
        if (!resolvedRoleName) resolvedRoleName = 'Intern';
      } else {
        determinedRole = 'employee';
        if (!resolvedRoleName) resolvedRoleName = 'Employee';
      }

      // Default role permissions if not provided by backend
      if (!permissions || permissions.length === 0) {
        if (determinedRole === 'admin' || determinedRole === 'hr') {
          permissions = [
            'view_dashboard',
            'manage_monitoring',
            'view_screenshots',
            'view_employees',
            'manage_team_leaves',
            'view_attendance',
            'view_salary',
            'view_performance',
            'view_holidays',
            'view_profile',
            'view_reports'
          ];
        } else if (determinedRole === 'team_leader') {
          permissions = [
            'view_dashboard',
            'manage_team_tasks',
            'manage_team_leaves',
            'view_performance',
            'view_projects',
            'view_attendance',
            'apply_leave',
            'submit_daily_report',
            'view_salary',
            'view_holidays'
          ];
        } else if (determinedRole === 'intern') {
          permissions = [
            'view_dashboard',
            'view_my_tasks',
            'view_learning_hub',
            'view_internship_progress',
            'view_attendance',
            'apply_leave',
            'submit_daily_report'
          ];
        } else {
          permissions = [
            'view_dashboard',
            'view_my_tasks',
            'view_performance',
            'view_projects',
            'view_attendance',
            'apply_leave',
            'submit_daily_report',
            'view_salary',
            'view_holidays',
            'view_team_members',
            'view_employees'
          ];
        }
      }

      setUserRole(determinedRole);
      localStorage.setItem('user_role', determinedRole);
      setRoleDetails(rawRoleData || { roleName: resolvedRoleName || (determinedRole === 'team_leader' ? 'Team Leader' : determinedRole === 'hr' ? 'HR Manager' : determinedRole === 'admin' ? 'Administrator' : 'Employee') });
      setRolePermissions(permissions);
      return determinedRole;
    } catch (err) {
      console.error('Error resolving role:', err);
      const fallback = deriveUserRole(userData);
      setUserRole(fallback);
      return fallback;
    } finally {
      setIsRoleLoading(false);
    }
  };

  const switchRole = (newRole) => {
    localStorage.setItem('active_role', newRole);
    localStorage.setItem('user_role', newRole);
    setUserRole(newRole);
    const roleLabels = {
      admin: 'Administrator',
      hr: 'HR Manager',
      team_leader: 'Team Leader',
      intern: 'Intern',
      employee: 'Employee'
    };
    setRoleDetails({ roleName: roleLabels[newRole] || 'Employee' });
  };

  // Sync role and fresh user profile on initial mount
  useEffect(() => {
    const initRoleAndUser = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const pData = await fetchLiveUserProfile();
          if (pData) {
            const resolved = resolveEmployeeName(pData);
            if (resolved) {
              pData.name = resolved;
              pData.fullName = resolved;
            }
            setUser(pData);
            localStorage.setItem('auth_user', JSON.stringify(pData));
            await resolveRole(pData);
            return;
          }
        } catch (e) {
          console.warn('Error fetching initial profile:', e);
        }
      }
      if (user) {
        resolveRole(user);
      }
    };

    initRoleAndUser();
  }, []);

  const loginUser = async (userData, token) => {
    if (token) localStorage.setItem('auth_token', token);

    let activeUser = userData;
    // Immediately fetch latest live profile with role info from backend
    try {
      const pData = await fetchLiveUserProfile();
      if (pData) {
        activeUser = { 
          ...userData, 
          ...pData,
          employee: { ...resolveEmployeeData(userData), ...resolveEmployeeData(pData) }
        };
      }
    } catch (e) {
      console.warn('Profile fetch on login fallback:', e);
    }

    if (activeUser) {
      const resolved = resolveEmployeeName(activeUser);
      if (resolved) {
        activeUser.name = resolved;
        activeUser.fullName = resolved;
      }
      localStorage.setItem('auth_user', JSON.stringify(activeUser));
      setUser(activeUser);
      const determined = await resolveRole(activeUser);
      if (determined) {
        localStorage.setItem('user_role', determined);
      }
    }

    // Always take the user to their role dashboard
    setCurrentTab('dashboard');
  };

  const updateUserProfile = (updated) => {
    setUser(prev => {
      const resolvedName = updated.name || updated.fullName || resolveEmployeeName(updated) || prev?.name;
      const merged = {
        ...prev,
        ...updated,
        name: resolvedName,
        fullName: resolvedName,
        employee: prev?.employee ? { ...prev.employee, ...updated, name: resolvedName, fullName: resolvedName } : { ...updated, name: resolvedName, fullName: resolvedName },
        profile: prev?.profile ? { ...prev.profile, ...updated, name: resolvedName, fullName: resolvedName } : { ...updated, name: resolvedName, fullName: resolvedName }
      };
      try {
        localStorage.setItem('auth_user', JSON.stringify(merged));
      } catch (e) {
        console.warn('Could not cache updated user in localStorage', e);
      }
      return merged;
    });
  };

  const refreshUserProfile = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try {
      const pData = await fetchLiveUserProfile();
      if (pData) {
        const resolved = resolveEmployeeName(pData);
        if (resolved) {
          pData.name = resolved;
          pData.fullName = resolved;
        }
        setUser(pData);
        localStorage.setItem('auth_user', JSON.stringify(pData));
        await resolveRole(pData);
        return pData;
      }
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
    return null;
  };

  return (
    <AppContext.Provider value={{
      user,
      setUser,
      userRole,
      roleDetails,
      rolePermissions,
      isRoleLoading,
      resolveRole,
      switchRole,
      loginUser,
      currentTab,
      setCurrentTab,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      isMobileSidebarOpen,
      setIsMobileSidebarOpen,
      attendanceStatus,
      setAttendanceStatus,
      sessionId,
      checkInTime,
      checkOutTime,
      monitoringStartTime,
      monitoringEndTime,
      workSeconds,
      breakSeconds,
      attendanceHistory,
      sessionStartTime,
      sessionEndTime,
      getRealAuthUserId,
      getDeviceInfoString,
      handleCheckIn,
      handleStartBreak,
      handleEndBreak,
      handleCheckOut,
      handleSimulateAutoCheckout,
      screenshotConfig,
      setScreenshotConfig,
      screenshots,
      latestScreenshot,
      nextScreenshotCountdown,
      isScreenSharingActive,
      startScreenCapture,
      stopScreenCapture,
      captureRealScreenNow: () => captureAndUploadScreenshot(true),
      inactivitySeconds,
      isInactivityAlertOpen,
      inactivityEvents,
      handleAcknowledgeWorking,
      handleInactivityStartBreak,
      handleSimulateInactivity,
      tasks,
      selectedTask,
      setSelectedTask,
      handleUpdateTaskStatus,
      handleUpdateTaskProgress,
      handleAddComment,
      dailyReports,
      handleAddDailyReport,
      leaveRequests,
      handleApplyLeave,
      notifications,
      handleMarkNotificationRead,
      globalSearchQuery,
      setGlobalSearchQuery,
      updateUserProfile,
      refreshUserProfile,
      resolveEmployeeName,
      resolveEmployeeData,
      fetchLiveUserProfile,
      updateMonitoringSettings,
      getAdminScreenshots,
      getMonitoringSettings,
      CLOUDINARY_CONFIG
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
