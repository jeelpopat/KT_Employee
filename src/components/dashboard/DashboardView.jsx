import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock, Pause, LogOut, Calendar, Gift,
  Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
  Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';
import { computeNineHourTimeline, getQuickActionStatusConfig } from '../../utils/timelineUtils.js';

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

  // Date matching helper robust against UTC/local time offsets and format variations
  const isTodayDate = (dateVal) => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      return true;
    }
    const todayIso = now.toISOString().split('T')[0];
    const todayLocal = now.toLocaleDateString('en-CA');
    const dStr = typeof dateVal === 'string' ? dateVal : d.toISOString();
    return dStr.startsWith(todayIso) || dStr.startsWith(todayLocal);
  };

  // Resolve employee photo from various nested properties or user directory lookup
  const resolveEmployeePhoto = (source, uMap = {}) => {
    if (!source) return '';
    const directPhoto = (
      source.profilePhoto ||
      source.profileImage ||
      source.photoUrl ||
      source.avatar ||
      source.image ||
      source.photo ||
      source.employee?.profilePhoto ||
      source.employee?.photoUrl ||
      source.employee?.avatar ||
      source.user?.profilePhoto ||
      source.user?.photoUrl ||
      source.user?.avatar ||
      ''
    );
    if (directPhoto) return directPhoto;

    const idStr = String(source._id || source.id || source.employeeId || '');
    const emailStr = (source.email || '').toLowerCase().trim();
    const nameStr = (source.name || '').toLowerCase().trim();

    const matched = (idStr && uMap[idStr]) || (emailStr && uMap[emailStr]) || (nameStr && uMap[nameStr]);
    if (matched) {
      return (
        matched.resolvedPhoto ||
        matched.profilePhoto ||
        matched.profileImage ||
        matched.photoUrl ||
        matched.avatar ||
        matched.image ||
        matched.photo ||
        matched.employee?.profilePhoto ||
        matched.employee?.photoUrl ||
        matched.employee?.avatar ||
        ''
      );
    }
    return '';
  };

  // --- Core Sync Logic ---
  const syncDashboardAndAttendance = useCallback(async (resolvedUserId) => {
    try {
      const effectiveId = resolvedUserId || actualUserId || user?.employee?._id || user?._id || user?.id || user?.user?._id;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLocalStr = new Date().toLocaleDateString('en-CA');

      // 1. Fetch Dashboard (includes holidays, birthdays, leaves)
      let dData = {};
      try {
        const dashRes = await api.get('/api/employee-panel/dashboard');
        dData = dashRes.data?.data || dashRes.data || {};

        setUpcomingBirthdays(dData.upcomingBirthdays || []);
        if (dData.stats?.leaveBalance !== undefined) {
          setLeaveBalance(`${dData.stats.leaveBalance} Days`);
        }
      } catch (dashErr) {
        console.warn("Dashboard stats fetch:", dashErr);
      }

      // 1.1 Fetch User Directory for comprehensive employee photo resolution
      const uMap = {};
      try {
        const uRes = await api.get('/api/users/all');
        const rawUsers = uRes.data?.users || uRes.data?.data || (Array.isArray(uRes.data) ? uRes.data : []);
        if (Array.isArray(rawUsers)) {
          rawUsers.forEach(u => {
            const photo = (
              u.profilePhoto ||
              u.profileImage ||
              u.photoUrl ||
              u.avatar ||
              u.image ||
              u.photo ||
              u.employee?.profilePhoto ||
              u.employee?.photoUrl ||
              u.employee?.avatar ||
              ''
            );
            const enriched = { ...u, resolvedPhoto: photo };
            if (u._id) uMap[String(u._id).toLowerCase()] = enriched;
            if (u.id) uMap[String(u.id).toLowerCase()] = enriched;
            if (u.employeeId) uMap[String(u.employeeId).toLowerCase()] = enriched;
            if (u.email) uMap[u.email.toLowerCase().trim()] = enriched;
            if (u.name) uMap[u.name.toLowerCase().trim()] = enriched;
          });
        }
      } catch (uErr) {
        console.warn("Users directory fetch notice for dashboard:", uErr.message);
      }

      // 1.2 Resolve Team Members On Leave with photos
      let resolvedTeamOnLeave = [];
      if (Array.isArray(dData.teamMembersOnLeave) && dData.teamMembersOnLeave.length > 0) {
        resolvedTeamOnLeave = dData.teamMembersOnLeave.map(t => {
          const photo = resolveEmployeePhoto(t, uMap);
          return {
            ...t,
            profilePhoto: photo || t.profilePhoto || ''
          };
        });
      }

      // If backend returned empty teamMembersOnLeave, check active approved leaves for today
      if (resolvedTeamOnLeave.length === 0) {
        try {
          const lRes = await api.get('/api/leave/all');
          const allLeaves = lRes.data?.data || lRes.data?.leaves || lRes.data?.history || (Array.isArray(lRes.data) ? lRes.data : []);
          if (Array.isArray(allLeaves)) {
            const todayIso = new Date().toISOString().split('T')[0];
            const todayLocal = new Date().toLocaleDateString('en-CA');

            const activeLeaves = allLeaves.filter(l => {
              const status = String(l.status || '').toLowerCase().trim();
              const tlStatus = String(l.teamLeadStatus || '').toLowerCase().trim();
              const isApproved = status.includes('approved') || tlStatus === 'approved';
              if (!isApproved) return false;

              const s = (l.startDate || '').split('T')[0];
              const e = (l.endDate || '').split('T')[0] || s;
              return (s <= todayIso && e >= todayIso) || (s <= todayLocal && e >= todayLocal);
            });

            resolvedTeamOnLeave = activeLeaves.map(l => {
              const emp = (typeof l.employeeId === 'object' && l.employeeId !== null) ? l.employeeId :
                          (typeof l.employee === 'object' && l.employee !== null) ? l.employee :
                          (typeof l.user === 'object' && l.user !== null) ? l.user : null;
              const idStr = String((typeof l.employeeId === 'string' ? l.employeeId : '') ||
                                   (typeof l.employee === 'string' ? l.employee : '') ||
                                   (typeof l.user === 'string' ? l.user : '') ||
                                   (typeof l.applicantId === 'string' ? l.applicantId : '') ||
                                   emp?._id || '').toLowerCase();
              const emailStr = (l.applicantEmail || l.employeeEmail || l.email || emp?.email || '').toLowerCase().trim();
              const nameStr = (l.applicantName || l.employeeName || l.name || emp?.name || '').toLowerCase().trim();

              const matched = (idStr && uMap[idStr]) || (emailStr && uMap[emailStr]) || (nameStr && uMap[nameStr]) || null;

              const rawName = emp?.name || emp?.fullName || matched?.name || matched?.fullName || l.applicantName || l.employeeName || 'Team Member';
              const name = rawName.split(' ').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '').join(' ').trim();

              const rawDesig = emp?.designation || matched?.designation || matched?.role || l.applicantRole || 'Employee';
              const designation = typeof rawDesig === 'object' ? (rawDesig.roleName || rawDesig.name || 'Employee') : String(rawDesig);

              const photo = emp?.profilePhoto || emp?.photoUrl || emp?.avatar ||
                            matched?.resolvedPhoto || matched?.profilePhoto || matched?.photoUrl ||
                            l.profilePhoto || l.photoUrl || '';

              const leaveType = l.leaveType ? (l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1).replace('_', ' ')) : 'Leave';

              return {
                _id: l._id || idStr,
                name,
                designation,
                profilePhoto: photo,
                leaveType: `${leaveType}${l.isHalfDay ? ' (Half Day)' : ''}`
              };
            });
          }
        } catch (lErr) {
          console.warn("Active leaves fallback notice:", lErr.message);
        }
      }

      setTeamOnLeave(resolvedTeamOnLeave);

      // 2. Fetch Timeline - Try 'today' first, then fallback to 'last10days' to guarantee finding today's record
      let todayTimelineData = null;
      let segments = [];
      try {
        const tlRes = await api.get('/api/employee-panel/attendance/timeline?filter=today');
        const tlList = tlRes.data?.data || tlRes.data?.timeline || [];
        if (Array.isArray(tlList) && tlList.length > 0) {
          todayTimelineData = tlList[0];
          segments = todayTimelineData.timelineSegments || [];
        }
      } catch (tlErr) {
        console.warn("Timeline today fetch failed:", tlErr);
      }

      if (!todayTimelineData) {
        try {
          const tl10Res = await api.get('/api/employee-panel/attendance/timeline?filter=last10days');
          const tl10List = tl10Res.data?.data || tl10Res.data?.timeline || [];
          if (Array.isArray(tl10List) && tl10List.length > 0) {
            // Sort descending by date/creation to inspect most recent
            const sortedTimeline = [...tl10List].sort((a, b) => {
              const tA = new Date(a.date || a.checkInTime || a.createdAt || 0).getTime();
              const tB = new Date(b.date || b.checkInTime || b.createdAt || 0).getTime();
              return tB - tA;
            });

            const match = sortedTimeline.find(r =>
              isTodayDate(r.date) ||
              isTodayDate(r.checkInTime) ||
              isTodayDate(r.createdAt)
            );

            if (match) {
              todayTimelineData = match;
              segments = match.timelineSegments || [];
            } else if (sortedTimeline.length > 0) {
              const latest = sortedTimeline[0];
              const lStatus = String(latest.status || '').toLowerCase().trim();
              const hasNoCheckout = !latest.checkOutTime || latest.checkOutTime === '--:--' || latest.checkOutTime === 'null';
              if (hasNoCheckout && (latest.checkInTime || ['present', 'checked_in', 'on_break', 'late'].includes(lStatus))) {
                todayTimelineData = latest;
                segments = latest.timelineSegments || [];
              }
            }
          }
        } catch (tl10Err) {
          console.warn("Timeline last10days fallback failed:", tl10Err);
        }
      }
      setTodaySegments(segments);

      // 3. Try /api/attendance/today
      let todayAttRecord = null;
      try {
        const todayRes = await api.get('/api/attendance/today');
        const tData = todayRes.data?.attendance || todayRes.data?.data?.attendance || todayRes.data?.data || todayRes.data;
        if (tData && (tData.checkInTime || tData.status || tData._id)) {
          todayAttRecord = tData;
        }
      } catch (e) { }

      // 4. Try /api/attendance/history/${effectiveId}
      if (!todayAttRecord && effectiveId) {
        try {
          const histRes = await api.get(`/api/attendance/history/${effectiveId}`);
          const history = histRes.data?.data || histRes.data?.attendance || histRes.data || [];
          if (Array.isArray(history)) {
            const match = history.find(r =>
              isTodayDate(r.date) ||
              isTodayDate(r.checkInTime) ||
              isTodayDate(r.createdAt)
            );
            if (match) todayAttRecord = match;
          }
        } catch (e) { }
      }

      // Check persistent action flags in localStorage
      const localCheckedIn = localStorage.getItem('kt_checked_in_' + todayStr) === 'true' || localStorage.getItem('kt_checked_in_' + todayLocalStr) === 'true';
      const localCheckedOut = localStorage.getItem('kt_checked_out_' + todayStr) === 'true' || localStorage.getItem('kt_checked_out_' + todayLocalStr) === 'true';
      const localOnBreak = localStorage.getItem('kt_on_break_' + todayStr) === 'true' || localStorage.getItem('kt_on_break_' + todayLocalStr) === 'true';

      // 5. Robust Attendance Mapping directly from API data + persistent flags
      const ta = todayAttRecord || dData.todayAttendance || dData.attendance || todayTimelineData || null;

      const rawCheckIn = ta?.checkInTime || ta?.inTime || ta?.checkIn || todayTimelineData?.checkInTime;
      const rawCheckOut = ta?.checkOutTime || ta?.outTime || ta?.checkOut || todayTimelineData?.checkOutTime;

      const statusLower = String(ta?.status || todayTimelineData?.status || '').toLowerCase().trim();

      const isPresentStatus = [
        'present', 'late', 'half day', 'half-day', 'checked_in', 'checked-in',
        'checked in', 'working', 'active', 'on_break', 'on-break', 'on break'
      ].includes(statusLower);

      const isCheckedOutStatus = [
        'checked_out', 'checked-out', 'checked out', 'completed'
      ].includes(statusLower);

      const hasValidCheckInTime = Boolean(
        rawCheckIn &&
        rawCheckIn !== '--:--' &&
        rawCheckIn !== 'null' &&
        rawCheckIn !== 'undefined' &&
        rawCheckIn !== ''
      );

      const hasValidCheckOutTime = Boolean(
        rawCheckOut &&
        rawCheckOut !== '--:--' &&
        rawCheckOut !== '00:00:00' &&
        rawCheckOut !== '00:00' &&
        rawCheckOut !== 'null' &&
        rawCheckOut !== 'undefined' &&
        rawCheckOut !== ''
      );

      // If backend confirms employee is in active present/working status, purge any stale checkout flag
      if (isPresentStatus) {
        localStorage.removeItem('kt_checked_out_' + todayStr);
        localStorage.removeItem('kt_checked_out_' + todayLocalStr);
      }

      // Check-in Recognition
      const hasCheckedIn = Boolean(
        localCheckedIn ||
        hasValidCheckInTime ||
        isPresentStatus ||
        isCheckedOutStatus ||
        ta?.isActiveSession === true ||
        (todayAttRecord && todayAttRecord._id) ||
        (todayTimelineData && todayTimelineData._id)
      );

      // Check-out Recognition: Only true if NOT in active present status, and checkout is explicitly recorded
      const hasCheckedOut = Boolean(
        !isPresentStatus && (
          localCheckedOut ||
          isCheckedOutStatus ||
          (hasValidCheckOutTime && !localOnBreak && statusLower !== 'on_break')
        )
      );

      // Break Determination
      let isOnBreak = Boolean(
        hasCheckedIn && !hasCheckedOut && (
          localOnBreak ||
          statusLower === 'on_break' ||
          statusLower === 'on-break' ||
          statusLower === 'on break' ||
          statusLower === 'break' ||
          ta?.isOnBreak === true ||
          ta?.isBreakActive === true ||
          todayTimelineData?.isOnBreak === true
        )
      );

      if (!isOnBreak && hasCheckedIn && !hasCheckedOut && Array.isArray(ta?.breaks) && ta.breaks.length > 0) {
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
          if (!localOnBreak) {
            isOnBreak = false;
          }
        } else if (hasCheckedIn && !hasCheckedOut) {
          isOnBreak = true;
        }
      }

      // Format time displays
      if (hasCheckedIn && rawCheckIn) setCheckInTimeDisplay(formatISOToLocalTime(rawCheckIn));
      else if (ta?.checkInTimeDisplay) setCheckInTimeDisplay(ta.checkInTimeDisplay);
      else if (hasCheckedIn) setCheckInTimeDisplay(localStorage.getItem('kt_check_in_time_str') || '10:00 AM');
      else setCheckInTimeDisplay('--:--');

      if (hasCheckedOut && rawCheckOut) setCheckOutTimeDisplay(formatISOToLocalTime(rawCheckOut));
      else if (ta?.checkOutTimeDisplay) setCheckOutTimeDisplay(ta.checkOutTimeDisplay);
      else if (hasCheckedOut) setCheckOutTimeDisplay(localStorage.getItem('kt_check_out_time_str') || '06:00 PM');
      else setCheckOutTimeDisplay('--:--');

      if (ta?.currentWorkingHours !== undefined) setTotalWorkTimeDisplay(`${ta.currentWorkingHours}h`);
      else if (ta?.totalWorkTimeDisplay) setTotalWorkTimeDisplay(ta.totalWorkTimeDisplay);

      if (ta?.breakDuration !== undefined) setTotalBreakTimeDisplay(`${ta.breakDuration}m`);
      else if (ta?.totalBreakTime !== undefined) setTotalBreakTimeDisplay(`${ta.totalBreakTime}m`);

      // 6. Compute Dynamic Action States
      let computedActions = {
        canCheckIn: !hasCheckedIn,
        canStartBreak: hasCheckedIn && !hasCheckedOut && !isOnBreak,
        canEndBreak: hasCheckedIn && !hasCheckedOut && isOnBreak,
        canCheckOut: hasCheckedIn && !hasCheckedOut
      };

      setActionsAvailable(computedActions);
      const newStatus = hasCheckedOut ? 'checked_out' :
        isOnBreak ? 'on_break' :
          hasCheckedIn ? 'checked_in' : 'not_checked_in';

      setAttendanceStatus(newStatus);
      if (setGlobalAttendanceStatus) {
        setGlobalAttendanceStatus(newStatus);
      }

      // 7. Fetch Live Tasks
      try {
        let tasksList = [];
        try {
          const allRes = await api.get('/api/task/all');
          tasksList = allRes.data?.data || allRes.data?.tasks || [];
        } catch (allErr) {
          if (effectiveId) {
            const taskRes = await api.get(`/api/task/employee/${effectiveId}`);
            tasksList = taskRes.data?.tasks || taskRes.data?.data || [];
          }
        }
        if (Array.isArray(tasksList)) {
          const norm = (s) => {
            const str = String(s || '').toLowerCase().trim().replace(/[- ]/g, '_');
            if (['pending', 'assigned', 'to_do', 'todo'].includes(str)) return 'todo';
            if (['in_progress', 'testing', 'review', 'in_review'].includes(str)) return 'inProgress';
            if (['completed', 'done'].includes(str)) return 'completed';
            return 'todo';
          };
          setTasksStats({
            todo: tasksList.filter(t => norm(t.status) === 'todo').length,
            inProgress: tasksList.filter(t => norm(t.status) === 'inProgress').length,
            completed: tasksList.filter(t => norm(t.status) === 'completed').length,
          });
        }
      } catch (e) { console.warn("Tasks sync failed:", e); }

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
      } catch (e) { }

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
      } catch (e) { }

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
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.startsWith('172.') ||
      window.location.hostname.endsWith('.local') ||
      window.location.port === '5173' ||
      window.location.port === '5174' ||
      window.location.port === '3000' ||
      window.location.protocol === 'http:'
    );

    const effectiveUserId = actualUserId || user?.employee?._id || user?._id || user?.id || user?.user?._id;

    // On localhost or local dev, execute instantly with target office coordinates without blocking
    if (isLocalhost) {
      actionCallback(TARGET_LAT, TARGET_LNG, 0, effectiveUserId);
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
        switch (error.code) {
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

  // Extract real user ID from JWT token or user profile (never employee document ID)
  const getRealAuthUserId = () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const tId = payload.id || payload._id || payload.userId || payload.sub;
          if (tId && /^[a-fA-F0-9]{24}$/.test(String(tId))) return String(tId);
        }
      }
    } catch (e) { }

    const storedUser = (() => {
      try {
        const s = localStorage.getItem('auth_user');
        return s ? JSON.parse(s) : null;
      } catch (e) { return null; }
    })();

    const u = storedUser || user || {};
    const cand = u.user?._id || (typeof u.user === 'string' ? u.user : null) || u._id;
    if (cand && /^[a-fA-F0-9]{24}$/.test(String(cand))) return String(cand);
    return null;
  };

  const handleAttendanceAction = async (endpoint, basePayload, actionType) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    const nowIso = new Date().toISOString();
    const nowLocal = formatISOToLocalTime(nowIso);

    const realUserId = getRealAuthUserId();

    // Fallback URL candidates if 404
    const endpointCandidates = [endpoint];
    if (endpoint === '/api/attendance/check-in') {
      endpointCandidates.push('/api/attendance/checkin');
    } else if (endpoint === '/api/attendance/break/start') {
      endpointCandidates.push('/api/attendance/break-in', '/api/attendance/break/in');
    } else if (endpoint === '/api/attendance/break/end') {
      endpointCandidates.push('/api/attendance/break-out', '/api/attendance/break/out');
    } else if (endpoint === '/api/attendance/check-out') {
      endpointCandidates.push('/api/attendance/checkout');
    }

    // Payload variants:
    // 1st: Clean { latitude, longitude } (uses JWT Bearer token authentication on backend)
    // 2nd: If backend specifically requires userId in body, attach the real JWT User ID (not employee ID)
    const payloadVariants = [
      { latitude: Number(basePayload.latitude), longitude: Number(basePayload.longitude) }
    ];
    if (realUserId) {
      payloadVariants.push({
        latitude: Number(basePayload.latitude),
        longitude: Number(basePayload.longitude),
        userId: realUserId
      });
    }

    try {
      let response = null;
      let lastErr = null;

      outerLoop:
      for (const ep of endpointCandidates) {
        for (const pl of payloadVariants) {
          try {
            response = await api.post(ep, pl);
            if (response && (response.status === 200 || response.status === 201)) {
              break outerLoop;
            }
          } catch (postErr) {
            lastErr = postErr;
            if (postErr.response?.status === 404) {
              break; // Try next candidate endpoint URL
            }
            const msg = (postErr.response?.data?.message || postErr.response?.data?.error || '').toLowerCase();
            // Don't retry different payloads if backend gave a domain-level message (e.g. already marked, already checked in)
            if (
              msg.includes('already checked') ||
              msg.includes('already marked') ||
              msg.includes('already on break') ||
              msg.includes('already clocked') ||
              msg.includes('already in break') ||
              msg.includes('already checked out')
            ) {
              break outerLoop;
            }
          }
        }
      }

      if (!response && lastErr) {
        throw lastErr;
      }

      const resData = response?.data;

      if (
        response?.status === 200 ||
        response?.status === 201 ||
        resData?.success ||
        resData?.status === 'success' ||
        resData?.attendance ||
        resData?.data
      ) {
        setGeoError('');

        if (actionType === 'check_in') {
          localStorage.setItem('kt_checked_in_' + todayStr, 'true');
          localStorage.setItem('kt_checked_in_' + todayLocalStr, 'true');
          localStorage.removeItem('kt_checked_out_' + todayStr);
          localStorage.removeItem('kt_checked_out_' + todayLocalStr);
          localStorage.setItem('kt_check_in_time_str', nowLocal);
          setAttendanceStatus('checked_in');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
          setCheckInTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        } else if (actionType === 'break_start') {
          localStorage.setItem('kt_on_break_' + todayStr, 'true');
          localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
          setAttendanceStatus('on_break');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
          setBreakInTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: true });
        } else if (actionType === 'break_end') {
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);
          setAttendanceStatus('checked_in');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
          setBreakOutTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        } else if (actionType === 'check_out') {
          localStorage.setItem('kt_checked_out_' + todayStr, 'true');
          localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);
          localStorage.setItem('kt_check_out_time_str', nowLocal);
          setAttendanceStatus('checked_out');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
          setCheckOutTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
        }

        await syncDashboardAndAttendance(actualUserId);
      } else {
        setGeoError(resData?.message || "Action failed.");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Server Error. Please try again.";
      const lowerMsg = (errMsg || '').toLowerCase();

      const isAlreadyCheckedIn =
        lowerMsg.includes('already checked') ||
        lowerMsg.includes('already marked') ||
        lowerMsg.includes('already clocked') ||
        lowerMsg.includes('already punched') ||
        lowerMsg.includes('already present') ||
        lowerMsg.includes('already exists') ||
        lowerMsg.includes('duplicate') ||
        lowerMsg.includes('active session') ||
        lowerMsg.includes('cannot check in again') ||
        lowerMsg.includes('once per day') ||
        lowerMsg.includes('already done');

      const isAlreadyOnBreak =
        lowerMsg.includes('already on break') ||
        lowerMsg.includes('already in break') ||
        lowerMsg.includes('break already started') ||
        lowerMsg.includes('active break');

      const isNotOnBreak =
        lowerMsg.includes('not on break') ||
        lowerMsg.includes('no active break') ||
        lowerMsg.includes('no break found') ||
        lowerMsg.includes('not in break');

      const isAlreadyCheckedOut =
        lowerMsg.includes('already checked out') ||
        lowerMsg.includes('already clocked out') ||
        lowerMsg.includes('already punched out') ||
        lowerMsg.includes('shift already completed') ||
        lowerMsg.includes('shift completed') ||
        lowerMsg.includes('already signed out');

      if ((actionType === 'check_in' && isAlreadyCheckedIn) || isAlreadyCheckedIn) {
        // User is already checked in today: activate Break In and Check Out!
        localStorage.setItem('kt_checked_in_' + todayStr, 'true');
        localStorage.setItem('kt_checked_in_' + todayLocalStr, 'true');
        localStorage.removeItem('kt_checked_out_' + todayStr);
        localStorage.removeItem('kt_checked_out_' + todayLocalStr);
        if (!localStorage.getItem('kt_check_in_time_str')) {
          localStorage.setItem('kt_check_in_time_str', nowLocal);
        }
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if ((actionType === 'break_start' && isAlreadyOnBreak) || isAlreadyOnBreak) {
        // User is already on break: activate Break Out
        localStorage.setItem('kt_on_break_' + todayStr, 'true');
        localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
        setAttendanceStatus('on_break');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
        setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: true });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if ((actionType === 'break_end' && isNotOnBreak) || isNotOnBreak) {
        // User is not on break: return to checked in
        localStorage.removeItem('kt_on_break_' + todayStr);
        localStorage.removeItem('kt_on_break_' + todayLocalStr);
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if ((actionType === 'check_out' && isAlreadyCheckedOut) || isAlreadyCheckedOut) {
        localStorage.setItem('kt_checked_out_' + todayStr, 'true');
        localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
        localStorage.removeItem('kt_on_break_' + todayStr);
        localStorage.removeItem('kt_on_break_' + todayLocalStr);
        setAttendanceStatus('checked_out');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
        setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
        setGeoError('Shift is completed for today.');
      } else {
        setGeoError(errMsg);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Strict Mapped Action Payloads (matching attendanceService protocol) ---
  const onCheckInClick = () => {
    if (!actionsAvailable.canCheckIn) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/check-in', payload, 'check_in');
    });
  };

  const onStartBreakClick = () => {
    if (!actionsAvailable.canStartBreak) return;
    const isoNow = new Date().toISOString();
    setActiveBreakIsoStart(isoNow);
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/break/start', payload, 'break_start');
    });
  };

  const onResumeWorkClick = () => {
    if (!actionsAvailable.canEndBreak) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/break/end', payload, 'break_end');
    });
  };

  const onCheckOutClick = () => {
    if (!actionsAvailable.canCheckOut) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/check-out', payload, 'check_out');
    });
  };

  const formatDateDayMonth = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  // --- Calculate Fixed 9-Hour Timeline Layout ---
  const nineHourTimeline = computeNineHourTimeline({
    checkInTime: checkInTimeDisplay !== '--:--' ? checkInTimeDisplay : null,
    checkOutTime: checkOutTimeDisplay !== '--:--' ? checkOutTimeDisplay : null,
    breakInTime: breakInTimeDisplay !== '--:--' ? breakInTimeDisplay : null,
    breakOutTime: breakOutTimeDisplay !== '--:--' ? breakOutTimeDisplay : null,
    timelineSegments: todaySegments,
    isOnBreak: attendanceStatus === 'on_break',
    isCheckedIn: attendanceStatus !== 'not_checked_in',
    isCheckedOut: attendanceStatus === 'checked_out'
  });

  const statusConfig = getQuickActionStatusConfig({
    hasCheckedIn: attendanceStatus === 'checked_in' || attendanceStatus === 'on_break',
    isOnBreak: attendanceStatus === 'on_break',
    hasCheckedOut: attendanceStatus === 'checked_out'
  });

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
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusConfig.badgeColorClass}`}>
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dotColorClass}`}></span>
                  {statusConfig.statusText}
                </span>
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

          {/* Timeline Visualizer - Fixed 9-Hour Timeline */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">

              {/* Timeline Legend */}
              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
                  Working Time
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                  Break
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                  Extra Break
                </span>
              </div>
            </div>

            {/* Fixed 9-Hour Track (Grey Base for Early Out / Remaining Time) */}
            <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex relative shadow-inner group cursor-help">
              {nineHourTimeline.displaySegments.map((seg) => (
                <div
                  key={seg.id}
                  title={seg.label}
                  style={{ left: `${seg.leftPercent}%`, width: `${seg.widthPercent}%` }}
                  className={`absolute top-0 bottom-0 h-full ${seg.colorClass} hover:brightness-110 transition-all border-r border-white/20`}
                />
              ))}
            </div>

            {/* Status Transition Markers Below Timeline (Check In, Break In, Extra Break, Break Out, Check Out, 9h End) */}
            <div className="mt-3 space-y-2.5">
              {/* Positioned Marker Ticks & Timestamps along Timeline */}
              <div className="relative w-full h-5">
                {(nineHourTimeline.statusMarkers || []).map((marker) => {
                  let alignClass = '-translate-x-1/2';
                  if (marker.percent <= 3) alignClass = 'translate-x-0';
                  else if (marker.percent >= 97) alignClass = '-translate-x-full';

                  return (
                    <div
                      key={`tick-${marker.id}`}
                      style={{ left: `${marker.percent}%` }}
                      className={`absolute top-0 flex flex-col items-center ${alignClass} transition-all pointer-events-auto group cursor-help`}
                      title={`${marker.label}: ${marker.timeStr}`}
                    >
                      <div className={`w-1 h-2 rounded-full ${marker.dotClass} mb-0.5`} />
                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 leading-none">
                        {marker.timeStr}
                      </span>
                    </div>
                  );
                })}
              </div>
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
                const initials = b.name ? b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'BD';
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
              <span className="bg-[#FFFBEB] dark:bg-amber-900/20 text-[#F59E0B] px-1.5 py-0.5 rounded-full text-[10px] font-bold">{teamOnLeave.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : teamOnLeave.length === 0 ? (
              <p className="text-sm text-slate-500 w-full text-center py-4">Everyone is present today.</p>
            ) : (
              teamOnLeave.map((t, i) => {
                const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name || 'User')}&background=F59E0B&color=fff&bold=true`;
                return (
                  <div key={t._id || i} className="flex flex-col items-center min-w-[96px] text-center group cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                    <div className="relative mb-2">
                      <img 
                        src={t.profilePhoto || avatarFallback} 
                        alt={t.name} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = avatarFallback;
                        }}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 dark:border-amber-500 shadow-xs group-hover:scale-105 group-hover:border-amber-500 transition-transform" 
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 border-2 border-white dark:border-slate-900 rounded-full" title="On Leave" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full px-1">{t.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate w-full px-1">{t.designation || 'Team Member'}</p>
                    {t.leaveType && (
                      <span className="mt-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40 truncate max-w-full">
                        {t.leaveType}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};