import React, { useEffect, useState, useCallback } from 'react';
import { 
  Clock, Pause, LogOut, Calendar, Gift, 
  Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
  Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';

// --- Geofencing Configuration (Office Location & 70 Meter Strict Radius) ---
const TARGET_LAT = 23.057808;
const TARGET_LNG = 72.538926;
const GEOFENCE_RADIUS_METERS = 70; // Allowed strictly within 70 meters

const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in meters
};

export const DashboardView = () => {
  const { user, setAttendanceStatus: setGlobalAttendanceStatus } = useApp();

  // --- Live Data States ---
  const [actualUserId, setActualUserId] = useState(null); // The true MongoDB _id
  const [liveFirstName, setLiveFirstName] = useState('Loading...');
  const [tasksStats, setTasksStats] = useState({ todo: 0, inProgress: 0, completed: 0 });
  const [leaveBalance, setLeaveBalance] = useState('--');
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnIndex, setCurrentAnnIndex] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]); 
  const [teamOnLeave, setTeamOnLeave] = useState([]); 
  const [isDataLoading, setIsDataLoading] = useState(true);

  // --- Attendance & Timeline States ---
  const [geoError, setGeoError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [todaySegments, setTodaySegments] = useState([]);
  
  const [attendanceStatus, setAttendanceStatus] = useState('not_checked_in'); 
  const [actionsAvailable, setActionsAvailable] = useState({
    canCheckIn: true,
    canStartBreak: false,
    canEndBreak: false,
    canCheckOut: false
  });

  const [activeBreakIsoStart, setActiveBreakIsoStart] = useState(null);
  const [checkInTimeDisplay, setCheckInTimeDisplay] = useState('--:--');
  const [checkOutTimeDisplay, setCheckOutTimeDisplay] = useState('--:--');
  const [totalWorkTimeDisplay, setTotalWorkTimeDisplay] = useState('0h 0m');
  const [breakInTimeDisplay, setBreakInTimeDisplay] = useState('--:--');
  const [breakOutTimeDisplay, setBreakOutTimeDisplay] = useState('--:--');
  const [totalBreakTimeDisplay, setTotalBreakTimeDisplay] = useState('0m');

  const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';

  // --- Announcement Controls ---
  const handlePrevAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
  };
  const handleNextAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev + 1) % announcements.length);
  };

  // --- Timeline Converters ---
  const convertUTCMinutesToLocal = (utcMinutes) => {
    const d = new Date();
    d.setUTCHours(Math.floor(utcMinutes / 60), utcMinutes % 60, 0, 0);
    return d.getHours() * 60 + d.getMinutes();
  };

  const formatMinutesToTimeStr = (totalMinutes) => {
    const d = new Date();
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatISOToLocalTime = (isoStr) => {
    if (!isoStr) return '--:--';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // --- Core Sync Logic ---
  const syncDashboardAndAttendance = useCallback(async (resolvedUserId) => {
    try {
      const effectiveId = resolvedUserId || actualUserId || user?.employee?._id || user?._id || user?.id || user?.user?._id;

      // 1. Fetch Dashboard (includes holidays, birthdays, leaves)
      let dData = {};
      try {
        const dashRes = await api.get('/api/employee-panel/dashboard');
        dData = dashRes.data?.data || dashRes.data || {};
        
        setUpcomingBirthdays(dData.upcomingBirthdays || []);
        setTeamOnLeave(dData.teamMembersOnLeave || []);
        if (dData.stats?.leaveBalance !== undefined) {
          setLeaveBalance(`${dData.stats.leaveBalance} Days`);
        }
      } catch (dashErr) {
        console.warn("Dashboard stats fetch:", dashErr);
      }

      // 2. Fetch Timeline (for the visual bar and specific segments)
      let todayTimelineData = null;
      let segments = [];
      try {
        const tlRes = await api.get('/api/employee-panel/attendance/timeline?filter=today');
        if (tlRes.data?.data && tlRes.data.data.length > 0) {
          todayTimelineData = tlRes.data.data[0];
          segments = todayTimelineData.timelineSegments || [];
          setTodaySegments(segments);
        } else {
          setTodaySegments([]);
        }
      } catch (tlErr) {
        console.warn("Timeline fetch failed:", tlErr);
      }

      // 3. Fetch dedicated attendance endpoints (try /api/attendance/today, then history)
      let todayAttRecord = null;
      try {
        const todayRes = await api.get('/api/attendance/today');
        const tData = todayRes.data?.data || todayRes.data?.attendance || todayRes.data;
        if (tData && (tData.checkInTime || tData.status || tData._id)) {
          todayAttRecord = tData;
        }
      } catch (e) {}

      if (!todayAttRecord && effectiveId) {
        try {
          const histRes = await api.get(`/api/attendance/history/${effectiveId}`);
          const history = histRes.data?.data || histRes.data?.attendance || histRes.data || [];
          if (Array.isArray(history)) {
            const todayStr = new Date().toISOString().split('T')[0];
            const found = history.find(r => 
              (r.date && r.date.startsWith(todayStr)) ||
              (r.checkInTime && r.checkInTime.startsWith(todayStr)) ||
              (r.createdAt && r.createdAt.startsWith(todayStr))
            );
            if (found) {
              todayAttRecord = found;
            }
          }
        } catch (e) {}
      }

      // 4. Robust Attendance Mapping directly from API data
      const ta = todayAttRecord || dData.todayAttendance || dData.attendance || todayTimelineData || null;

      const rawCheckIn = ta?.checkInTime || ta?.inTime || ta?.checkIn || todayTimelineData?.checkInTime;
      const rawCheckOut = ta?.checkOutTime || ta?.outTime || ta?.checkOut || todayTimelineData?.checkOutTime;

      const hasCheckedIn = Boolean(
        (rawCheckIn && rawCheckIn !== '--:--' && rawCheckIn !== 'null' && rawCheckIn !== 'undefined') ||
        ta?.status === 'present' ||
        ta?.status === 'checked_in' ||
        ta?.status === 'on_break' ||
        ta?.status === 'late' ||
        ta?.status === 'half day' ||
        ta?.status === 'checked_out' ||
        ta?.isActiveSession === true
      );

      const hasCheckedOut = Boolean(
        (rawCheckOut && rawCheckOut !== '--:--' && rawCheckOut !== 'null' && rawCheckOut !== 'undefined') ||
        ta?.status === 'checked_out'
      );

      // Check break state from timeline segments or attendance record
      let isOnBreak = Boolean(
        ta?.status === 'on_break' ||
        ta?.isOnBreak === true ||
        ta?.isBreakActive === true ||
        todayTimelineData?.status === 'on_break' ||
        todayTimelineData?.isOnBreak === true
      );

      if (!isOnBreak && Array.isArray(ta?.breaks) && ta.breaks.length > 0) {
        const lastB = ta.breaks[ta.breaks.length - 1];
        if (lastB.startTime && !lastB.endTime) {
          isOnBreak = true;
        }
      }

      const yellowSegments = segments.filter(s => s.type === 'yellow');
      if (yellowSegments.length > 0) {
        const lastBreak = yellowSegments[yellowSegments.length - 1];
        setBreakInTimeDisplay(formatMinutesToTimeStr(convertUTCMinutesToLocal(lastBreak.fromMinutes)));
        if (lastBreak.toMinutes > lastBreak.fromMinutes) {
          setBreakOutTimeDisplay(formatMinutesToTimeStr(convertUTCMinutesToLocal(lastBreak.toMinutes)));
        } else {
          isOnBreak = true;
        }
      }

      // Format time displays
      if (hasCheckedIn && rawCheckIn) setCheckInTimeDisplay(formatISOToLocalTime(rawCheckIn));
      else if (ta?.checkInTimeDisplay) setCheckInTimeDisplay(ta.checkInTimeDisplay);
      else if (!hasCheckedIn) setCheckInTimeDisplay('--:--');

      if (hasCheckedOut && rawCheckOut) setCheckOutTimeDisplay(formatISOToLocalTime(rawCheckOut));
      else if (ta?.checkOutTimeDisplay) setCheckOutTimeDisplay(ta.checkOutTimeDisplay);
      else if (!hasCheckedOut) setCheckOutTimeDisplay('--:--');

      if (ta?.currentWorkingHours !== undefined) setTotalWorkTimeDisplay(`${ta.currentWorkingHours}h`);
      else if (ta?.totalWorkTimeDisplay) setTotalWorkTimeDisplay(ta.totalWorkTimeDisplay);

      if (ta?.breakDuration !== undefined) setTotalBreakTimeDisplay(`${ta.breakDuration}m`);
      else if (ta?.totalBreakTime !== undefined) setTotalBreakTimeDisplay(`${ta.totalBreakTime}m`);

      // 5. Compute Dynamic Action States According to API Attendance Data
      let computedActions = {
        canCheckIn: false,
        canStartBreak: false,
        canEndBreak: false,
        canCheckOut: false
      };

      if (!hasCheckedIn) {
        // Not checked in yet -> Check In is active and clickable
        computedActions.canCheckIn = true;
      } else if (hasCheckedOut) {
        // Already checked out for the day -> shift completed, all disabled
        computedActions.canCheckIn = false;
        computedActions.canStartBreak = false;
        computedActions.canEndBreak = false;
        computedActions.canCheckOut = false;
      } else if (isOnBreak) {
        // Checked in & currently on break -> Break Out (Resume) is active and clickable, Check Out is clickable
        computedActions.canEndBreak = true;
        computedActions.canCheckOut = true;
      } else {
        // Checked in & actively working -> Break In and Check Out are active and clickable
        computedActions.canStartBreak = true;
        computedActions.canCheckOut = true;
      }

      // If backend explicitly provided actionsAvailable booleans, respect them
      if (ta?.actionsAvailable && typeof ta.actionsAvailable === 'object') {
        if (typeof ta.actionsAvailable.canCheckIn === 'boolean') computedActions.canCheckIn = ta.actionsAvailable.canCheckIn;
        if (typeof ta.actionsAvailable.canStartBreak === 'boolean') computedActions.canStartBreak = ta.actionsAvailable.canStartBreak;
        if (typeof ta.actionsAvailable.canEndBreak === 'boolean') computedActions.canEndBreak = ta.actionsAvailable.canEndBreak;
        if (typeof ta.actionsAvailable.canCheckOut === 'boolean') computedActions.canCheckOut = ta.actionsAvailable.canCheckOut;
      }

      // Final guarantee: If checked in and NOT checked out, Check Out MUST be clickable!
      if (hasCheckedIn && !hasCheckedOut) {
        computedActions.canCheckOut = true;
      }

      setActionsAvailable(computedActions);
      const newStatus = hasCheckedOut ? 'checked_out' :
        isOnBreak ? 'on_break' :
        hasCheckedIn ? 'checked_in' : 'not_checked_in';
      
      setAttendanceStatus(newStatus);
      if (setGlobalAttendanceStatus) {
        setGlobalAttendanceStatus(newStatus);
      }

      // 6. Fetch Tasks
      if (effectiveId) {
        try {
          const taskRes = await api.get(`/api/task/employee/${effectiveId}`);
          const tasksList = taskRes.data?.tasks || taskRes.data?.data || taskRes.data || [];
          setTasksStats({
            todo: tasksList.filter(t => t.status === 'Assigned').length,
            inProgress: tasksList.filter(t => t.status === 'In Progress').length,
            completed: tasksList.filter(t => t.status === 'Completed').length,
          });
        } catch (e) { console.warn("Tasks sync failed:", e); }
      }

    } catch (error) {
      console.error("Failed to sync dashboard:", error);
    }
  }, [actualUserId, user, setGlobalAttendanceStatus]);

  // --- Initial Mount & Bootstrapper ---
  useEffect(() => {
    const bootstrapDashboard = async () => {
      setIsDataLoading(true);
      let validUserId = null;

      // Ensure we get the correct 24-character MongoDB ID from the profile API
      try {
        const pRes = await api.get('/api/users/profile');
        const prof = pRes.data?.data || pRes.data || {};
        setLiveFirstName((prof.employee?.firstName || prof.employee?.name || prof.name || 'User').split(' ')[0]);
        const fallbackId = user?.employee?._id || user?._id || user?.id || user?.user?._id;
        validUserId = prof.employee?._id || prof._id || prof.user?._id || fallbackId;
        setActualUserId(validUserId);
      } catch (e) {
        console.warn("Profile fetch failed. Using fallback user context.");
        const fallbackId = user?.employee?._id || user?._id || user?.id || user?.user?._id;
        validUserId = fallbackId;
        setActualUserId(validUserId);
      }

      // Load core module data
      await syncDashboardAndAttendance(validUserId);

      // Fetch independent data (Announcements, Holidays)
      try {
        const annRes = await api.get('/api/notification/announcement/all');
        if (annRes.data?.success && annRes.data?.data) setAnnouncements(annRes.data.data);
      } catch (e) {}

      try {
        const holRes = await api.get('/api/holiday/all');
        if (holRes.data?.success && holRes.data?.holidays) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          setHolidays(holRes.data.holidays.filter(h => {
            const hDate = new Date(h.holidayDate);
            return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear && hDate >= new Date();
          }));
        }
      } catch (e) {}

      setIsDataLoading(false);
    };

    bootstrapDashboard();

    // Auto-refresh interval
    const interval = setInterval(() => syncDashboardAndAttendance(actualUserId), 30000);
    return () => clearInterval(interval);
  }, [syncDashboardAndAttendance, actualUserId, user]);

  // --- Robust Geolocation & Verification ---
  const verifyLocationAndExecute = (actionCallback) => {
    setGeoError('');
    setIsActionLoading(true);

    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

    const effectiveUserId = actualUserId || user?.employee?._id || user?._id || user?.id || user?.user?._id;
    if (!effectiveUserId) {
      setGeoError("User profile is syncing. Please wait a moment and try again.");
      setIsActionLoading(false);
      return;
    }

    // On localhost, allow checking in/out freely without 70m distance restriction
    if (isLocalhost) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            actionCallback(latitude, longitude, 0, effectiveUserId);
          },
          () => {
            // Even if GPS is off or denied on localhost, proceed with target office coordinates
            actionCallback(TARGET_LAT, TARGET_LNG, 0, effectiveUserId);
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
        );
      } else {
        actionCallback(TARGET_LAT, TARGET_LNG, 0, effectiveUserId);
      }
      return;
    }

    // Production strict 70-meter geofence check
    if (!navigator.geolocation) {
      setGeoError("Location tracking is not supported by your browser.");
      setIsActionLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distanceMeters = calculateDistanceInMeters(latitude, longitude, TARGET_LAT, TARGET_LNG);
        
        if (distanceMeters <= GEOFENCE_RADIUS_METERS) {
          actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
        } else {
          setGeoError(
            `Office Location Error: You are ${Math.round(distanceMeters)}m away. Check In, Break In, Break Out, and Check Out are strictly allowed within 70 meters of office premises.`
          );
          setIsActionLoading(false);
        }
      },
      (error) => {
        let errorMsg = "Location permission and GPS coordinates are required to mark attendance.";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please allow location access in your browser/device settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Location unavailable. Please enable device GPS/location.";
            break;
          case error.TIMEOUT:
            errorMsg = "Timeout: Failed to acquire GPS location in time. Please check your signal and try again.";
            break;
        }
        setGeoError(errorMsg);
        setIsActionLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } 
    );
  };
  
  const handleAttendanceAction = async (endpoint, payload, actionType) => {
    try {
      const response = await api.post(endpoint, payload);
      const resData = response.data;
      
      // Flexible success verification: HTTP 200/201 or data.success or data.status === 'success' or data.attendance or data.data
      if (
        response.status === 200 || 
        response.status === 201 || 
        resData?.success || 
        resData?.status === 'success' || 
        resData?.attendance || 
        resData?.data
      ) {
        setGeoError('');
        const nowIso = new Date().toISOString();
        const nowLocal = formatISOToLocalTime(nowIso);

        if (actionType === 'check_in') {
          setAttendanceStatus('checked_in');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
          setCheckInTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        } else if (actionType === 'break_start') {
          setAttendanceStatus('on_break');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
          setBreakInTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: true });
        } else if (actionType === 'break_end') {
          setAttendanceStatus('checked_in');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
          setBreakOutTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        } else if (actionType === 'check_out') {
          setAttendanceStatus('checked_out');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
          setCheckOutTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
        }

        // Re-sync with backend to get latest server computed times and timeline
        await syncDashboardAndAttendance(payload.userId || actualUserId);
      } else {
        setGeoError(resData?.message || "Action failed.");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Server Error. Please try again.";
      const lowerMsg = (errMsg || '').toLowerCase();
      
      if (lowerMsg.includes('already checked in') || lowerMsg.includes('already marked') || lowerMsg.includes('already clocked in')) {
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        setGeoError('Already checked in today. You can now Break In or Check Out.');
        await syncDashboardAndAttendance(payload.userId || actualUserId);
      } else if (lowerMsg.includes('already checked out') || lowerMsg.includes('already clocked out')) {
        setAttendanceStatus('checked_out');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
        setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
        setGeoError('Already checked out for today.');
      } else {
        setGeoError(errMsg);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Strict Mapped Action Payloads (Within 70m of Office) ---
  const onCheckInClick = () => {
    if (!actionsAvailable.canCheckIn) return;
    verifyLocationAndExecute(async (lat, lng, distanceMeters, effId) => {
      const nowIso = new Date().toISOString();
      const payload = {
        userId: effId,
        employeeId: effId,
        latitude: lat,
        longitude: lng,
        date: nowIso.split('T')[0],
        checkInTime: nowIso,
        checkInLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat((distanceMeters / 1000).toFixed(3))
        },
        location: {
          latitude: lat,
          longitude: lng
        },
        isLate: false, 
        status: "present",
        isActiveSession: true
      };
      await handleAttendanceAction('/api/attendance/check-in', payload, 'check_in');
    });
  };

  const onStartBreakClick = () => {
    if (!actionsAvailable.canStartBreak) return;
    const isoNow = new Date().toISOString();
    setActiveBreakIsoStart(isoNow);
    verifyLocationAndExecute(async (lat, lng, distanceMeters, effId) => {
      const payload = {
        userId: effId,
        employeeId: effId,
        latitude: lat,
        longitude: lng,
        date: isoNow.split('T')[0],
        startTime: isoNow,
        startLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat((distanceMeters / 1000).toFixed(3))
        },
        location: {
          latitude: lat,
          longitude: lng
        }
      };
      await handleAttendanceAction('/api/attendance/break/start', payload, 'break_start');
    });
  };

  const onResumeWorkClick = () => {
    if (!actionsAvailable.canEndBreak) return;
    verifyLocationAndExecute(async (lat, lng, distanceMeters, effId) => {
      const endTime = new Date();
      const duration = activeBreakIsoStart 
        ? Math.max(0, Math.round((endTime - new Date(activeBreakIsoStart)) / 60000)) 
        : 0;

      const payload = {
        userId: effId,
        employeeId: effId,
        latitude: lat,
        longitude: lng,
        date: endTime.toISOString().split('T')[0],
        endTime: endTime.toISOString(),
        duration: duration,
        endLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat((distanceMeters / 1000).toFixed(3))
        },
        location: {
          latitude: lat,
          longitude: lng
        }
      };
      await handleAttendanceAction('/api/attendance/break/end', payload, 'break_end');
    });
  };

  const onCheckOutClick = () => {
    if (!actionsAvailable.canCheckOut) return;
    verifyLocationAndExecute(async (lat, lng, distanceMeters, effId) => {
      const nowIso = new Date().toISOString();
      const payload = {
        userId: effId,
        employeeId: effId,
        latitude: lat,
        longitude: lng,
        date: nowIso.split('T')[0],
        checkOutTime: nowIso,
        checkOutLocation: {
          latitude: lat,
          longitude: lng,
          distanceFromOffice: parseFloat((distanceMeters / 1000).toFixed(3))
        },
        location: {
          latitude: lat,
          longitude: lng
        },
        isActiveSession: false
      };
      await handleAttendanceAction('/api/attendance/check-out', payload, 'check_out');
    });
  };

  const formatDateDayMonth = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  // --- Calculate Timeline Layout Variables ---
  const activeSegments = todaySegments.filter(seg => seg.type !== 'grey');
  let minMinutes = Infinity;
  let maxMinutes = 0;

  activeSegments.forEach(seg => {
    const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
    const localTo = convertUTCMinutesToLocal(seg.toMinutes);
    if (localFrom < minMinutes) minMinutes = localFrom;
    if (localTo > maxMinutes) maxMinutes = localTo;
  });

  if (minMinutes === Infinity) {
    minMinutes = 540; 
    maxMinutes = 1080; 
  }
  const totalDurationMinutes = maxMinutes - minMinutes || 1;
  const breakSegment = activeSegments.find(s => s.type === 'yellow');
  const breakStartTime = breakSegment ? formatMinutesToTimeStr(convertUTCMinutesToLocal(breakSegment.fromMinutes)) : '';

  return (
    <div className="min-h-full space-y-6">

      {/* KPI Cards (5 items) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today Hours', value: totalWorkTimeDisplay, accent: 'border-l-blue-500' },
          { label: 'Tasks To Do', value: tasksStats.todo, accent: 'border-l-slate-400' },
          { label: 'In Progress', value: tasksStats.inProgress, accent: 'border-l-amber-500' },
          { label: 'Completed', value: tasksStats.completed, accent: 'border-l-green-500' },
          // { label: 'Paid Balance', value: leaveBalance, accent: 'border-l-indigo-500' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={`kpi-${idx}`} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${item.accent} rounded-md p-4 transition-colors shadow-sm flex flex-col justify-between`}>
              <div className="flex justify-between items-start w-full">
                <span className="text-2xs  font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{item.label}</span>
                {/* <Icon size={14} className="text-slate-400 dark:text-slate-500" /> */}   
                <div className="px-2 items-end text-xl font-bold text-slate-900 dark:text-slate-100">
                  {isDataLoading && idx !== 0 ? <Loader2 size={20} className="animate-spin text-slate-400" /> : item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TIME & ATTENDANCE - QUICK ACTIONS & TIMELINE */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors shadow-sm p-4 sm:p-6 flex flex-col justify-center">

          {geoError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold flex items-center justify-center gap-2 text-center">
              <AlertCircle size={16} className="shrink-0" /> 
              <span>{geoError}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock size={16} className="text-slate-400" /> Quick Actions
              </h3>
              <div>
                {attendanceStatus === 'checked_in' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Checked In / Working
                  </span>
                )}
                {attendanceStatus === 'on_break' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    On Break
                  </span>
                )}
                {attendanceStatus === 'checked_out' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Shift Completed
                  </span>
                )}
                {attendanceStatus === 'not_checked_in' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    Not Checked In
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center px-2">
              {/* Check In */}
              <button 
                onClick={onCheckInClick}
                disabled={isActionLoading || !actionsAvailable.canCheckIn}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canCheckIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canCheckIn ? "Click to Check In" : "Already checked in today"}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canCheckIn ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#ECFDF5] text-[#10B981] hover:bg-[#D1FAE5] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canCheckIn ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check In</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkInTimeDisplay}</p>
                </div>
              </button>

              {/* Break In */}
              <button 
                onClick={onStartBreakClick}
                disabled={isActionLoading || !actionsAvailable.canStartBreak}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canStartBreak ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canStartBreak ? "Click to Start Break" : "Break In not available"}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canStartBreak ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FFFBEB] text-[#F59E0B] hover:bg-[#FEF3C7] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canStartBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break In</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakInTimeDisplay}</p>
                </div>
              </button>

              {/* Break Out */}
              <button 
                onClick={onResumeWorkClick}
                disabled={isActionLoading || !actionsAvailable.canEndBreak}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canEndBreak ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canEndBreak ? "Click to End Break and Resume Work" : "Break Out not available"}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canEndBreak ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canEndBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Break Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakOutTimeDisplay}</p>
                </div>
              </button>

              {/* Check Out */}
              <button 
                onClick={onCheckOutClick}
                disabled={isActionLoading || !actionsAvailable.canCheckOut}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canCheckOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canCheckOut ? "Click to Check Out" : "Check Out not available"}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canCheckOut ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEE2E2] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canCheckOut ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Check Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkOutTimeDisplay}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Timeline Visualizer */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
              {activeSegments.length > 0 ? (
                activeSegments.map((seg, sIdx) => {
                  const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
                  const localTo = convertUTCMinutesToLocal(seg.toMinutes);
                  
                  const startPercent = Math.max(0, ((localFrom - minMinutes) / totalDurationMinutes) * 100);
                  const widthPercent = Math.min(100 - startPercent, ((localTo - localFrom) / totalDurationMinutes) * 100);
                  
                  let colorClass = 'bg-[#3B82F6]'; 
                  if (seg.type === 'yellow') colorClass = 'bg-[#F59E0B]'; 

                  return (
                    <div 
                      key={sIdx}
                      title={`${seg.label} (${formatMinutesToTimeStr(localFrom)} - ${formatMinutesToTimeStr(localTo)})`}
                      style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                      className={`absolute top-0 bottom-0 h-full ${colorClass} transition-all border-r border-white/20`}
                    />
                  );
                })
              ) : (
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800"></div>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-3 uppercase tracking-wider font-mono">
              <span>{activeSegments.length > 0 ? formatMinutesToTimeStr(minMinutes) : '--:--'}</span>
              {breakStartTime && <span>{breakStartTime}</span>}
              <span>{activeSegments.length > 0 && attendanceStatus === 'checked_out' ? formatMinutesToTimeStr(maxMinutes) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* VERTICAL ANNOUNCEMENTS LIST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bell size={16} className="text-[#2563EB]" /> Announcements
            </h2>
            {announcements.length > 0 && (
              <span className="bg-[#EFF6FF] dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                {announcements.length} Updates
              </span>
            )}
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[220px] divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
            {isDataLoading ? (
              <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : announcements.length === 0 ? (
              <div className="text-center p-8">
                <Bell size={24} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No announcements.</p>
              </div>
            ) : (
              announcements.map((ann, idx) => (
                <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-tight">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {ann.message}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <Calendar size={12} /> 
                    {ann.createdAtIST || (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'Recent')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* HOLIDAYS - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Umbrella size={16} className="text-[#10B981]" /> Upcoming Holidays
              <span className="bg-[#ECFDF5] dark:bg-green-900/20 text-[#10B981] px-1.5 py-0.5 rounded-full text-[10px]">{holidays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : holidays.length === 0 ? (
              <p className="text-sm text-slate-500 w-full text-center">No holidays this month.</p>
            ) : (
              holidays.map((h, i) => {
                const dateObj = new Date(h.holidayDate);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('en-US', { month: 'short' });
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-green-900/10 flex flex-col items-center justify-center border border-[#D1EBE5] dark:border-green-800/30 mb-2 group-hover:scale-105 transition-transform">
                      <span className="text-sm font-bold text-[#10B981] leading-none">{day}</span>
                      <span className="text-[10px] font-bold text-[#10B981] uppercase mt-0.5">{month}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize truncate w-full px-1">{h.holidayName}</p>
                    <p className="text-[9px] font-bold text-[#10B981] uppercase mt-1 bg-[#ECFDF5] dark:bg-green-900/20 px-1.5 py-0.5 rounded-sm">Public</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BIRTHDAYS - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Gift size={16} className="text-[#8B5CF6]" /> Upcoming Birthdays
              <span className="bg-[#F5F3FF] dark:bg-purple-900/20 text-[#8B5CF6] px-1.5 py-0.5 rounded-full text-[10px]">{upcomingBirthdays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : upcomingBirthdays.length === 0 ? (
               <p className="text-sm text-slate-500 w-full text-center">No birthdays upcoming.</p>
            ) : (
              upcomingBirthdays.map((b, i) => {
                const initials = b.name ? b.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'BD';
                const d = new Date(b.birthdayDate);
                const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
                
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-[#F5F3FF] dark:bg-purple-900/10 flex items-center justify-center text-[#8B5CF6] font-bold text-lg border border-[#E9E4FF] dark:border-purple-800/30 mb-2 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{b.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{dateStr}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TEAM ON LEAVE - HORIZONTAL DESIGN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm xl:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users size={16} className="text-[#F59E0B]" /> Team On Leave
              <span className="bg-[#FFFBEB] dark:bg-amber-900/20 text-[#F59E0B] px-1.5 py-0.5 rounded-full text-[10px]">{teamOnLeave.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
               <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : teamOnLeave.length === 0 ? (
               <p className="text-sm text-slate-500 w-full text-center">Everyone is present today.</p>
            ) : (
              teamOnLeave.map((t, i) => (
                <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                  <img src={t.profilePhoto || defaultAvatar} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#FFFBEB] dark:border-amber-900/30 mb-2 group-hover:scale-105 transition-transform" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{t.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate w-full px-1">{t.designation}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};