import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(initialUser);
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
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState(null);
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
  const handleUpdateTaskStatus = (taskId, status) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      status,
      progressPercentage: status === 'completed' ? 100 : t.progressPercentage,
      activity: [
        { id: `act-${Date.now()}`, date: 'Just now', user: user.name, text: `Changed status to ${status.replace('_', ' ').toUpperCase()}` },
        ...t.activity
      ]
    } : t));

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, status, progressPercentage: status === 'completed' ? 100 : prev.progressPercentage } : null);
    }
  };

  const handleUpdateTaskProgress = (taskId, progress) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      progressPercentage: progress,
      status: progress === 100 ? 'completed' : t.status
    } : t));

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, progressPercentage: progress } : null);
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

  const updateUserProfile = (updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  };

  return (
    <AppContext.Provider value={{
      user,
      currentTab,
      setCurrentTab,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      isMobileSidebarOpen,
      setIsMobileSidebarOpen,
      attendanceStatus,
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
      updateUserProfile
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
