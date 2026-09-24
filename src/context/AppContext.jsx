import React, { createContext, useContext, useState, useEffect } from 'react';
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

const AppContext = createContext();

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
    u.email === 'kureshpoonawala384@gmail.com'
  ) {
    return 'team_leader';
  }

  if (roleStr.includes('intern')) {
    return 'intern';
  }

  return 'employee';
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return initialUser;
      }
    }
    return initialUser;
  });

  const [userRole, setUserRole] = useState(() => {
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        return deriveUserRole(JSON.parse(stored));
      } catch (e) {}
    }
    return 'employee';
  });

  const [roleDetails, setRoleDetails] = useState(() => {
    const initialRole = (() => {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        try {
          return deriveUserRole(JSON.parse(stored));
        } catch (e) {}
      }
      return 'employee';
    })();
    return { roleName: initialRole === 'team_leader' ? 'Team Leader' : initialRole === 'intern' ? 'Intern' : 'Employee' };
  });

  const [rolePermissions, setRolePermissions] = useState([]);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Attendance state initialized as checked_in for rich demonstration
  const [attendanceStatus, setAttendanceStatus] = useState('checked_in');
  const [sessionId, setSessionId] = useState('SES-20260820-001');
  const [checkInTime, setCheckInTime] = useState('10:00:00 AM');
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [monitoringStartTime, setMonitoringStartTime] = useState('10:00:00 AM');
  const [monitoringEndTime, setMonitoringEndTime] = useState(null);
  const [workSeconds, setWorkSeconds] = useState(5710); // ~1hr 35m active
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState(initialAttendanceRecords);

  // Background Screenshot Monitoring Config & Engine (100% Silent for Employee)
  const [screenshotConfig, setScreenshotConfig] = useState({
    intervalSeconds: 10,
    isPausedOnBreak: true,
    retentionDays: 30,
    allowEmployeeView: false
  });

  const [screenshots, setScreenshots] = useState(initialScreenshots);
  const [latestScreenshot, setLatestScreenshot] = useState(initialScreenshots[0]);
  const [nextScreenshotCountdown, setNextScreenshotCountdown] = useState(screenshotConfig.intervalSeconds);
  const [sequenceCounter, setSequenceCounter] = useState(146);

  // 5-Minute Continuous Inactivity Detection System
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [isInactivityAlertOpen, setIsInactivityAlertOpen] = useState(false);
  const [inactivityEvents, setInactivityEvents] = useState([
    {
      id: 'ina-101',
      employeeName: 'Alex Morgan',
      employeeId: 'EMP-8492',
      date: '2026-08-20',
      startTime: '11:20:00 AM',
      duration: '5 Minutes',
      sessionId: 'SES-20260820-001',
      attendanceStatus: 'Active',
      responseStatus: 'Acknowledged - Working'
    }
  ]);

  // Tasks, Daily Reports, Leave
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  // Sync Live Tasks into global AppContext
  useEffect(() => {
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

  // 1. Session Work & Break Timer Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (attendanceStatus === 'checked_in') {
        setWorkSeconds(prev => prev + 1);
        if (!isInactivityAlertOpen) {
          setInactivitySeconds(prev => prev + 1);
        }
      } else if (attendanceStatus === 'on_break') {
        setBreakSeconds(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attendanceStatus, isInactivityAlertOpen]);

  // 2. 5-Minute Inactivity Trigger Check (300 seconds)
  useEffect(() => {
    if (inactivitySeconds >= 300 && !isInactivityAlertOpen && attendanceStatus === 'checked_in') {
      triggerInactivityAlert();
    }
  }, [inactivitySeconds, isInactivityAlertOpen, attendanceStatus]);

  const triggerInactivityAlert = () => {
    setIsInactivityAlertOpen(true);
    playAlertSound();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Record Event for HR/Admin
    const newInactivityEvent = {
      id: `ina-${Date.now()}`,
      employeeName: user.name,
      employeeId: user.employeeId,
      date: '2026-08-20',
      startTime: timeStr,
      duration: '5 Minutes',
      sessionId: sessionId,
      attendanceStatus: 'Active',
      responseStatus: 'Waiting for Employee Response'
    };

    setInactivityEvents(prev => [newInactivityEvent, ...prev]);

    // Send HR/Admin Notification
    const newNotif = {
      id: `notif-ina-${Date.now()}`,
      title: '⚠️ 5-Minute Inactivity Alert',
      message: `No activity detected for ${user.name} (${user.employeeId}) for 5 continuous minutes. Status: Waiting for Response.`,
      time: 'Just now',
      isRead: false,
      type: 'system'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Play Alert Sound
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (err) {
      console.log('Audio alert fallback', err);
    }
  };

  // Inactivity Alert Responses
  const handleAcknowledgeWorking = () => {
    setIsInactivityAlertOpen(false);
    setInactivitySeconds(0);

    setInactivityEvents(prev => prev.map((evt, idx) => idx === 0 ? {
      ...evt,
      responseStatus: 'Acknowledged - Working'
    } : evt));

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Activity Confirmed',
      message: `${user.name} confirmed active work. Resumed tracking.`,
      time: 'Just now',
      isRead: false,
      type: 'attendance'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleInactivityStartBreak = () => {
    setIsInactivityAlertOpen(false);
    setInactivitySeconds(0);

    setInactivityEvents(prev => prev.map((evt, idx) => idx === 0 ? {
      ...evt,
      responseStatus: 'Switched to Break'
    } : evt));

    handleStartBreak();
  };

  const handleSimulateInactivity = () => {
    triggerInactivityAlert();
  };

  // 3. Silent Background Screenshot Interval Capture Ticker
  useEffect(() => {
    if (attendanceStatus !== 'checked_in') {
      setNextScreenshotCountdown(screenshotConfig.intervalSeconds);
      return;
    }

    const intervalTimer = setInterval(() => {
      setNextScreenshotCountdown(prev => {
        if (prev <= 1) {
          captureMockScreenshot();
          return screenshotConfig.intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, [attendanceStatus, screenshotConfig.intervalSeconds, sequenceCounter]);

  const captureMockScreenshot = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sampleWindows = [
      'VS Code - DailyReportView.jsx',
      'Chrome - Kevalon CRM API Specs',
      'Figma - Enterprise HRMS Layout',
      'Terminal - npm run dev',
      'Slack - #engineering-team'
    ];
    const sampleImages = [
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80'
    ];

    const randomIdx = Math.floor(Math.random() * sampleWindows.length);
    const newRecord = {
      id: `scr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      employeeId: user.employeeId,
      employeeName: user.name,
      designation: user.designation,
      date: '2026-08-20',
      captureTime: timeStr,
      sessionId: sessionId,
      checkInTime: checkInTime,
      sequenceNo: sequenceCounter,
      thumbnailUrl: sampleImages[randomIdx],
      fullUrl: sampleImages[randomIdx],
      activityLevel: Math.floor(Math.random() * 25) + 75,
      activeWindow: sampleWindows[randomIdx]
    };

    setScreenshots(prev => [newRecord, ...prev]);
    setLatestScreenshot(newRecord);
    setSequenceCounter(prev => prev + 1);
  };

  // Actions
  const handleCheckIn = () => {
    const now = new Date();
    const formattedCheckIn = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newSessionId = `SES-20260820-${Math.floor(Math.random() * 900 + 100)}`;
    setSessionId(newSessionId);
    setCheckInTime(formattedCheckIn);
    setCheckOutTime(null);
    setMonitoringStartTime(formattedCheckIn);
    setMonitoringEndTime(null);
    setAttendanceStatus('checked_in');
    setWorkSeconds(0);
    setBreakSeconds(0);
    setInactivitySeconds(0);

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: 'Checked In Successfully',
      message: `Session ${newSessionId} started at ${formattedCheckIn}. Background work monitoring active.`,
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
    const now = new Date();
    const formattedCheckOut = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAttendanceStatus('checked_out');
    setCheckOutTime(formattedCheckOut);
    setMonitoringEndTime(formattedCheckOut);
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

  // Manual role switching is completely disabled per security requirements
  const switchRole = () => {
    console.warn('Role switching is disabled. User role is strictly bound to account permissions.');
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
          const profileRes = await api.get('/api/users/profile');
          const pData = profileRes.data?.data || profileRes.data;
          if (pData) {
            candidate = pData;
            setUser(pData);
            localStorage.setItem('auth_user', JSON.stringify(pData));
            const pEmp = pData.employee || {};
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

      // Check all possible Team Leader signals:
      if (
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
        candidateEmail === 'hetvi.kevalon@gmail.com'
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
        if (determinedRole === 'team_leader') {
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
      setRoleDetails(rawRoleData || { roleName: resolvedRoleName || (determinedRole === 'team_leader' ? 'Team Leader' : 'Employee') });
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

  // Sync role and fresh user profile on initial mount
  useEffect(() => {
    const initRoleAndUser = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const profileRes = await api.get('/api/users/profile');
          const pData = profileRes.data?.data || profileRes.data;
          if (pData) {
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
    // Immediately fetch latest profile with role info from backend
    try {
      const profRes = await api.get('/api/users/profile');
      const pData = profRes.data?.data || profRes.data;
      if (pData) {
        activeUser = { ...userData, ...pData };
      }
    } catch (e) {
      console.warn('Profile fetch on login fallback:', e);
    }

    if (activeUser) {
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
      const merged = {
        ...prev,
        ...updated,
        name: updated.name !== undefined ? updated.name : prev?.name,
        employee: prev?.employee ? { ...prev.employee, ...updated } : updated,
        profile: prev?.profile ? { ...prev.profile, ...updated } : updated
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
      const profileRes = await api.get('/api/users/profile');
      const pData = profileRes.data?.data || profileRes.data;
      if (pData) {
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
      refreshUserProfile
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
