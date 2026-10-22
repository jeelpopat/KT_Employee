import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Clock, Pause, LogOut, Calendar, Gift,
  Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
  Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { useApp, resolveEmployeeName, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api from '../../api/axios.js';
import { showToast } from '../common/Toast.jsx';
import {
  computeNineHourTimeline,
  getQuickActionStatusConfig,
  deriveAttendanceStatus,
  isTodayDate,
  isPastDate,
  formatISOToLocalTime,
  calculateWorkingHours,
  formatHoursAndMinutes,
  normalizeAttendanceRecord,
  getAutoCheckOutTimeForDate,
  formatMinutesToTimeStr,
  convertUTCMinutesToLocal,
  parseTimeToMinutes
} from '../../utils/timelineUtils.js';

// --- Geofencing Configuration (Office Location & 20 Meter Strict Radius) ---
const TARGET_LAT = 23.05829;
const TARGET_LNG = 72.53919;
const GEOFENCE_RADIUS_METERS = 20; // Allowed strictly within 20 meters
const AUTO_CHECKOUT_RADIUS_METERS = 20; // Auto checkout outside 20 meters

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
  const [todayBreaks, setTodayBreaks] = useState([]);

  const [attendanceStatus, setAttendanceStatus] = useState('not_checked_in');
  const [actionsAvailable, setActionsAvailable] = useState({
    canCheckIn: true,
    canStartBreak: false,
    canEndBreak: false,
    canCheckOut: false
  });

  const [dailyBreaksCount, setDailyBreaksCount] = useState(0);
  const [attendanceEvaluation, setAttendanceEvaluation] = useState(null);
  const [activeBreakIsoStart, setActiveBreakIsoStart] = useState(null);
  const [checkInTimeDisplay, setCheckInTimeDisplay] = useState('--:--');
  const [checkOutTimeDisplay, setCheckOutTimeDisplay] = useState('--:--');
  const [totalWorkTimeDisplay, setTotalWorkTimeDisplay] = useState('0h 0m');
  const [breakInTimeDisplay, setBreakInTimeDisplay] = useState('--:--');
  const [breakOutTimeDisplay, setBreakOutTimeDisplay] = useState('--:--');
  const [totalBreakTimeDisplay, setTotalBreakTimeDisplay] = useState('0m');

  // --- Dynamic Quick Actions Height Tracking for Announcements ---
  const quickActionsRef = useRef(null);
  const [quickActionsHeight, setQuickActionsHeight] = useState(null);

  useEffect(() => {
    const measureHeight = () => {
      if (quickActionsRef.current) {
        const h = quickActionsRef.current.offsetHeight;
        if (h > 0) {
          setQuickActionsHeight(h);
        }
      }
    };

    measureHeight();

    if (!quickActionsRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      measureHeight();
    });
    observer.observe(quickActionsRef.current);
    window.addEventListener('resize', measureHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureHeight);
    };
  }, [geoError, attendanceStatus, isActionLoading, dailyBreaksCount]);

  // Dynamically calculate how many announcements to show based on Quick Actions height
  // When normal height, display top 2 announcements. When height increases, display 3 (or up to 4).
  const visibleAnnouncementsLimit = useMemo(() => {
    if (!quickActionsHeight || quickActionsHeight <= 370) {
      return 2;
    } else if (quickActionsHeight <= 470) {
      return 3;
    } else {
      return 4;
    }
  }, [quickActionsHeight]);

  const displayedAnnouncements = useMemo(() => {
    return (announcements || []).slice(0, visibleAnnouncementsLimit);
  }, [announcements, visibleAnnouncementsLimit]);

  // --- Announcement Controls ---
  const handlePrevAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
  };
  const handleNextAnnouncement = () => {
    setCurrentAnnIndex((prev) => (prev + 1) % announcements.length);
  };

  // Helper to ensure valid and absolute photo URL
  const cleanPhotoUrl = (raw) => {
    if (!raw) return '';
    if (typeof raw === 'object') {
      raw = raw.fileUrl || raw.url || raw.secure_url || raw.path || '';
    }
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    const base = 'https://kt-backend-yzr4.onrender.com';
    return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
  };

  // Resolve employee photo from various nested properties or user directory lookup
  const resolveEmployeePhoto = (source, uMap = {}, extraPhotoMap = {}) => {
    if (!source) return '';

    // 1. Direct photo on source
    const directPhoto = cleanPhotoUrl(
      source.profilePhoto ||
      source.profileImage ||
      source.photoUrl ||
      source.avatar ||
      source.image ||
      source.photo ||
      source.fileUrl ||
      (typeof source.employeeId === 'object' ? (source.employeeId?.profilePhoto || source.employeeId?.profileImage || source.employeeId?.photoUrl || source.employeeId?.avatar || source.employeeId?.image || source.employeeId?.photo) : '') ||
      (typeof source.employee === 'object' ? (source.employee?.profilePhoto || source.employee?.profileImage || source.employee?.photoUrl || source.employee?.avatar || source.employee?.image || source.employee?.photo) : '') ||
      (typeof source.user === 'object' ? (source.user?.profilePhoto || source.user?.profileImage || source.user?.photoUrl || source.user?.avatar || source.user?.image || source.user?.photo) : '') ||
      ''
    );
    if (directPhoto) return directPhoto;

    // 2. Candidate IDs
    const candidateIds = [
      source._id,
      source.id,
      source.userId,
      source.applicantId,
      typeof source.employeeId === 'object' ? source.employeeId?._id : source.employeeId,
      typeof source.employeeId === 'object' ? source.employeeId?.id : null,
      typeof source.employeeId === 'object' ? source.employeeId?.employeeId : null,
      typeof source.employee === 'object' ? source.employee?._id : source.employee,
      typeof source.employee === 'object' ? source.employee?.id : null,
      typeof source.employee === 'object' ? source.employee?.employeeId : null,
      typeof source.user === 'object' ? source.user?._id : source.user,
      typeof source.user === 'object' ? source.user?.id : null
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    // 3. Candidate Emails
    const candidateEmails = [
      source.email,
      source.applicantEmail,
      source.employeeEmail,
      typeof source.employeeId === 'object' ? source.employeeId?.email : null,
      typeof source.employee === 'object' ? source.employee?.email : null,
      typeof source.user === 'object' ? source.user?.email : null
    ].filter(Boolean).map(x => String(x).toLowerCase().trim());

    // 4. Candidate Names
    const candidateNames = [
      source.name,
      source.fullName,
      source.employeeName,
      source.applicantName,
      (source.firstName || source.lastName) ? `${source.firstName || ''} ${source.lastName || ''}`.trim() : null,
      typeof source.employeeId === 'object' ? (source.employeeId?.name || source.employeeId?.fullName) : null,
      typeof source.employee === 'object' ? (source.employee?.name || source.employee?.fullName) : null,
      typeof source.user === 'object' ? (source.user?.name || source.user?.fullName) : null
    ].filter(Boolean).map(x => String(x).toLowerCase().replace(/\s+/g, ' ').trim());

    // 5. Check extraPhotoMap (from /api/document or localStorage)
    for (const id of candidateIds) {
      if (extraPhotoMap[id]) return cleanPhotoUrl(extraPhotoMap[id]);
    }
    for (const em of candidateEmails) {
      if (extraPhotoMap[em]) return cleanPhotoUrl(extraPhotoMap[em]);
    }
    for (const nm of candidateNames) {
      if (extraPhotoMap[nm]) return cleanPhotoUrl(extraPhotoMap[nm]);
    }

    // 6. Check uMap
    let matched = null;
    for (const id of candidateIds) {
      if (uMap[id]) { matched = uMap[id]; break; }
    }
    if (!matched) {
      for (const em of candidateEmails) {
        if (uMap[em]) { matched = uMap[em]; break; }
      }
    }
    if (!matched) {
      for (const nm of candidateNames) {
        if (uMap[nm]) { matched = uMap[nm]; break; }
      }
    }
    if (!matched && candidateNames.length > 0) {
      for (const cName of candidateNames) {
        if (cName.length < 3) continue;
        const foundKey = Object.keys(uMap).find(k => k.length > 2 && (k === cName || k.includes(cName) || cName.includes(k)));
        if (foundKey) {
          matched = uMap[foundKey];
          break;
        }
      }
    }

    if (matched) {
      const photo = cleanPhotoUrl(
        matched.resolvedPhoto ||
        matched.profilePhoto ||
        matched.profileImage ||
        matched.photoUrl ||
        matched.avatar ||
        matched.image ||
        matched.photo ||
        matched.employee?.profilePhoto ||
        matched.employee?.profileImage ||
        matched.employee?.photoUrl ||
        matched.employee?.avatar ||
        matched.employee?.image ||
        matched.employee?.photo ||
        matched.user?.profilePhoto ||
        matched.user?.photoUrl ||
        matched.user?.avatar ||
        matched.profile?.profilePhoto ||
        matched.profile?.photoUrl ||
        matched.profile?.avatar
      );
      if (photo) return photo;
    }

    // 7. Check current logged-in user
    if (user) {
      const myIds = [String(user._id || ''), String(user.id || ''), String(user.employeeId || '')].filter(Boolean).map(x => x.toLowerCase());
      const isMe = candidateIds.some(id => myIds.includes(id)) ||
                   candidateEmails.some(em => em === (user.email || '').toLowerCase().trim()) ||
                   candidateNames.some(nm => nm === (user.name || user.fullName || '').toLowerCase().replace(/\s+/g, ' ').trim());
      if (isMe) {
        const myPhoto = cleanPhotoUrl(user.profilePhoto || user.photoUrl || user.avatar || user.employee?.profilePhoto || localStorage.getItem(`user_profile_photo_${user._id}`));
        if (myPhoto) return myPhoto;
      }
    }

    return '';
  };

  // Refs to allow interval timers to access freshest states without re-triggering effects
  const attendanceStatusRef = useRef(attendanceStatus);
  useEffect(() => {
    attendanceStatusRef.current = attendanceStatus;
  }, [attendanceStatus]);

  const actualUserIdRef = useRef(actualUserId);
  useEffect(() => {
    actualUserIdRef.current = actualUserId;
  }, [actualUserId]);

  // Helper to map and apply attendance records to UI state
  const applyAttendanceState = useCallback((ta, segments = []) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLocalStr = new Date().toLocaleDateString('en-CA');

    // Clean up past day un-scoped time string cache when date rolls over to today
    const lastActiveDate = localStorage.getItem('kt_attendance_date');
    if (lastActiveDate && lastActiveDate !== todayStr && lastActiveDate !== todayLocalStr) {
      localStorage.removeItem('kt_check_in_time_str');
      localStorage.removeItem('kt_check_out_time_str');
    }
    localStorage.setItem('kt_attendance_date', todayStr);

    // Cache active attendance ObjectId for monitoring screenshots
    const activeAttId = ta?._id || ta?.id;
    if (activeAttId && /^[0-9a-fA-F]{24}$/.test(String(activeAttId))) {
      try {
        localStorage.setItem('kt_current_attendance_id', String(activeAttId));
      } catch (e) {}
    }

    // Check persistent action flags in localStorage strictly for today
    const localPending = localStorage.getItem('kt_attendance_pending_' + todayStr) === 'true' || localStorage.getItem('kt_attendance_pending_' + todayLocalStr) === 'true';
    const localRejected = localStorage.getItem('kt_attendance_rejected_' + todayStr) === 'true' || localStorage.getItem('kt_attendance_rejected_' + todayLocalStr) === 'true';
    const localCheckedIn = localStorage.getItem('kt_checked_in_' + todayStr) === 'true' || localStorage.getItem('kt_checked_in_' + todayLocalStr) === 'true';
    const localCheckedOut = localStorage.getItem('kt_checked_out_' + todayStr) === 'true' || localStorage.getItem('kt_checked_out_' + todayLocalStr) === 'true';
    const localOnBreak = localStorage.getItem('kt_on_break_' + todayStr) === 'true' || localStorage.getItem('kt_on_break_' + todayLocalStr) === 'true';
    const rawCheckIn = ta?.approvedCheckInTime || ta?.checkInTime || ta?.checkInTimeDisplay || ta?.approvedCheckInTimeDisplay || ta?.inTime || ta?.checkIn || ta?.punchIn;
    const rawCheckOut = ta?.checkOutTime || ta?.checkOutTimeDisplay || ta?.outTime || ta?.checkOut || ta?.punchOut;
    const statusLower = String(ta?.status || '').toLowerCase().trim();
    const approvalStatusLower = String(ta?.approvalStatus || '').toLowerCase().trim();
    const adminStatusLower = String(ta?.adminStatus || '').toLowerCase().trim();
    const checkInStatusLower = String(ta?.checkInStatus || '').toLowerCase().trim();
    const rejectionReasonText = ta?.rejectionReason || ta?.rejectReason || localStorage.getItem('kt_rejection_reason_' + todayStr) || '';

    // Admin Rejection Recognition
    const isRejected = Boolean(
      localRejected ||
      ta?.isRejected === true ||
      statusLower === 'rejected' ||
      statusLower.includes('reject') ||
      approvalStatusLower === 'rejected' ||
      approvalStatusLower.includes('reject') ||
      adminStatusLower === 'rejected' ||
      adminStatusLower.includes('reject') ||
      checkInStatusLower === 'rejected' ||
      checkInStatusLower.includes('reject')
    );

    const isNotCheckedInStatus = !statusLower || [
      'not_checked_in', 'not-checked-in', 'not checked in',
      'absent', 'none', 'idle', 'unregistered', 'off'
    ].includes(statusLower) || statusLower.startsWith('not_') || statusLower.startsWith('not ');

    const hasValidCheckInTime = Boolean(
      rawCheckIn &&
      rawCheckIn !== '--:--' &&
      rawCheckIn !== 'null' &&
      rawCheckIn !== 'undefined' &&
      rawCheckIn !== '00:00:00' &&
      rawCheckIn !== '00:00' &&
      rawCheckIn !== '' &&
      rawCheckIn !== '—' &&
      rawCheckIn !== '-' &&
      rawCheckIn !== 'NA' &&
      rawCheckIn !== 'N/A' &&
      parseTimeToMinutes(rawCheckIn) !== null
    );

    const isPresentStatus = !isNotCheckedInStatus && [
      'present', 'late', 'half day', 'half-day', 'checked_in', 'checked-in',
      'checked in', 'working', 'active', 'on_break', 'on-break', 'on break'
    ].includes(statusLower);

    const isCheckedOutStatus = !isNotCheckedInStatus && [
      'checked_out', 'checked-out', 'checked out', 'completed'
    ].includes(statusLower);

    // Explicit approval recognition (must not be not_checked_in status)
    const isExplicitlyApproved = Boolean(
      !isRejected && !isNotCheckedInStatus && (
        ta?.isApproved === true ||
        approvalStatusLower === 'approved' ||
        adminStatusLower === 'approved' ||
        checkInStatusLower === 'approved' ||
        statusLower === 'approved' ||
        isPresentStatus ||
        isCheckedOutStatus
      )
    );

    // Explicit pending check
    const isExplicitlyPending = Boolean(
      statusLower === 'pending' ||
      statusLower.includes('pending') ||
      approvalStatusLower === 'pending' ||
      approvalStatusLower.includes('pending') ||
      adminStatusLower === 'pending' ||
      adminStatusLower.includes('pending') ||
      checkInStatusLower === 'pending' ||
      checkInStatusLower.includes('pending') ||
      ta?.isApproved === false
    );

    // If server confirms employee is active/working/approved/completed today, purge any stale local pending flag
    if (isPresentStatus || isCheckedOutStatus || isExplicitlyApproved) {
      localStorage.removeItem('kt_attendance_pending_' + todayStr);
      localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
    }

    // Pending Approval Recognition (strictly when check-in requested and not approved or explicitly pending)
    const isPendingApproval = Boolean(
      !isRejected && (
        isExplicitlyPending ||
        (localPending && !isExplicitlyApproved && !isPresentStatus && !isCheckedOutStatus)
      )
    );

    const hasValidCheckOutTime = Boolean(
      rawCheckOut &&
      rawCheckOut !== '--:--' &&
      rawCheckOut !== '00:00:00' &&
      rawCheckOut !== '00:00' &&
      rawCheckOut !== 'null' &&
      rawCheckOut !== 'undefined' &&
      rawCheckOut !== '' &&
      rawCheckOut !== '—' &&
      rawCheckOut !== '-' &&
      parseTimeToMinutes(rawCheckOut) !== null
    );

    // Check-in Recognition: ONLY if there is authentic attendance data in the database with a valid check-in time!
    // An employee CANNOT be checked in without a valid parseable check-in punch time.
    const hasCheckedIn = Boolean(
      !isRejected &&
      !isPendingApproval &&
      !isNotCheckedInStatus &&
      ta &&
      hasValidCheckInTime
    );

    // Synchronize localStorage persistence with verified state
    if (isRejected) {
      localStorage.removeItem('kt_checked_in_' + todayStr);
      localStorage.removeItem('kt_checked_in_' + todayLocalStr);
      localStorage.removeItem('kt_check_in_time_str');
      localStorage.removeItem('kt_attendance_pending_' + todayStr);
      localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
      localStorage.removeItem('kt_on_break_' + todayStr);
      localStorage.removeItem('kt_on_break_' + todayLocalStr);
      localStorage.setItem('kt_attendance_rejected_' + todayStr, 'true');
      localStorage.setItem('kt_attendance_rejected_' + todayLocalStr, 'true');
      if (rejectionReasonText) {
        localStorage.setItem('kt_rejection_reason_' + todayStr, rejectionReasonText);
      }
    } else if (isPendingApproval) {
      localStorage.removeItem('kt_checked_in_' + todayStr);
      localStorage.removeItem('kt_checked_in_' + todayLocalStr);
      localStorage.removeItem('kt_attendance_rejected_' + todayStr);
      localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
      localStorage.removeItem('kt_rejection_reason_' + todayStr);
      localStorage.setItem('kt_attendance_pending_' + todayStr, 'true');
      localStorage.setItem('kt_attendance_pending_' + todayLocalStr, 'true');
    } else if (hasCheckedIn && hasValidCheckInTime) {
      localStorage.removeItem('kt_attendance_pending_' + todayStr);
      localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
      localStorage.removeItem('kt_attendance_rejected_' + todayStr);
      localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
      localStorage.removeItem('kt_rejection_reason_' + todayStr);
      localStorage.setItem('kt_checked_in_' + todayStr, 'true');
      localStorage.setItem('kt_checked_in_' + todayLocalStr, 'true');
    }

    // IF EMPLOYEE HAS NOT CHECKED IN TODAY:
    // Strictly reset all attendance states to unstarted, zero out working hours, and purge stale storage
    if (!hasCheckedIn && !isPendingApproval && !isRejected) {
      localStorage.removeItem('kt_checked_in_' + todayStr);
      localStorage.removeItem('kt_checked_in_' + todayLocalStr);
      localStorage.removeItem('kt_check_in_time_str');
      localStorage.removeItem('kt_check_in_time');
      localStorage.removeItem('kt_on_break_' + todayStr);
      localStorage.removeItem('kt_on_break_' + todayLocalStr);
      localStorage.removeItem('kt_checked_out_' + todayStr);
      localStorage.removeItem('kt_checked_out_' + todayLocalStr);
      localStorage.removeItem('kt_check_out_time_str');
      localStorage.removeItem('kt_active_session_id');
      localStorage.removeItem('kt_current_attendance_id');
      localStorage.removeItem('kt_break_count_' + todayStr);
      localStorage.removeItem('kt_break_count_' + todayLocalStr);

      setCheckInTimeDisplay('--:--');
      setCheckOutTimeDisplay('--:--');
      setBreakInTimeDisplay('--:--');
      setBreakOutTimeDisplay('--:--');
      setTotalWorkTimeDisplay('0h 0m');
      setTotalBreakTimeDisplay('0m');
      setTodaySegments([]);
      setTodayBreaks([]);
      setDailyBreaksCount(0);
      setAttendanceStatus('not_checked_in');
      if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('not_checked_in');
      setActionsAvailable({
        canCheckIn: true,
        canStartBreak: false,
        canEndBreak: false,
        canCheckOut: false
      });
      setAttendanceEvaluation(null);
      return;
    }

    // If backend confirms employee is checked in without checkout, purge all stale checkout flags
    if (hasCheckedIn && !isRejected && !isPendingApproval && !hasValidCheckOutTime && !isCheckedOutStatus) {
      localStorage.removeItem('kt_checked_out_' + todayStr);
      localStorage.removeItem('kt_checked_out_' + todayLocalStr);
      localStorage.removeItem('kt_auto_checked_out_' + todayStr);
      localStorage.removeItem('kt_auto_checked_out_' + todayLocalStr);
      localStorage.removeItem('kt_check_out_time_str');
    }

    // AUTO CHECK-OUT RULE: 11:59 PM auto check out time 7:00 PM at that day
    const nowClock = new Date();
    const isPast1159PMToday = nowClock.getHours() === 23 && nowClock.getMinutes() >= 59;
    const shouldAutoCheckOut = Boolean(
      !isRejected &&
      hasCheckedIn &&
      isPast1159PMToday &&
      !localCheckedOut &&
      !hasValidCheckOutTime &&
      !isCheckedOutStatus
    );

    if (shouldAutoCheckOut) {
      localStorage.setItem('kt_checked_out_' + todayStr, 'true');
      localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
      const autoEndStr = ta?.officeEndTime ? formatISOToLocalTime(ta.officeEndTime) : (rawCheckOut ? formatISOToLocalTime(rawCheckOut) : formatISOToLocalTime("19:00"));
      localStorage.setItem('kt_check_out_time_str', autoEndStr);
      localStorage.removeItem('kt_on_break_' + todayStr);
      localStorage.removeItem('kt_on_break_' + todayLocalStr);
    }

    // Check-out Recognition
    // If backend confirms employee is checked in and has NO valid checkout time, trust the backend: NOT checked out!
    const isBackendConfirmedUncheckedOut = Boolean(
      hasCheckedIn &&
      !hasValidCheckOutTime &&
      !isCheckedOutStatus &&
      ta?.isAutoCheckedOut !== true
    );

    const hasCheckedOut = Boolean(
      !isRejected &&
      hasCheckedIn &&
      !isBackendConfirmedUncheckedOut && (
        shouldAutoCheckOut ||
        ta?.isAutoCheckedOut === true ||
        isCheckedOutStatus ||
        (hasValidCheckOutTime && !localOnBreak && statusLower !== 'on_break') ||
        (localCheckedOut && !ta)
      )
    );

    // Break Determination (Robust Multi-Source Check)
    const rawBreaks = Array.isArray(ta?.breaks) ? ta.breaks : (ta?.breaks ? [ta.breaks] : []);
    const sessionBreaks = Array.isArray(ta?.sessions)
      ? ta.sessions.filter(s => s.breakStart || s.breakEnd).map(s => ({ startTime: s.breakStart, endTime: s.breakEnd }))
      : [];
    const singleBreak = (ta?.breakStart || ta?.breakEnd) ? [{ startTime: ta.breakStart, endTime: ta.breakEnd }] : [];

    const breaksList = [...rawBreaks, ...sessionBreaks, ...singleBreak].map(b => ({
      startTime: b.startTime || b.breakStart || b.start,
      endTime: b.endTime || b.breakEnd || b.end
    })).filter(b => b.startTime || b.endTime);

    const yellowSegments = (segments || []).filter(s => s.type === 'yellow');
    const localBreakCount = parseInt(
      localStorage.getItem('kt_break_count_' + todayStr) ||
      localStorage.getItem('kt_break_count_' + todayLocalStr) ||
      '0', 10
    );

    const isBreakExplicitActive = Boolean(
      !isRejected && (
        ta?.isOnBreak === true ||
        ta?.isBreakActive === true ||
        ta?.breakTimer?.isOnBreak === true ||
        statusLower === 'on_break' ||
        statusLower === 'on-break' ||
        statusLower === 'on break' ||
        statusLower === 'break' ||
        (breaksList.length > 0 && breaksList[breaksList.length - 1].startTime && !breaksList[breaksList.length - 1].endTime)
      )
    );

    // If backend confirms that the latest break is completed (has valid endTime) and breakTimer is inactive,
    // then backend definitively confirms the employee is NOT currently on break!
    const isBackendConfirmedBreakEnded = Boolean(
      ta &&
      !isBreakExplicitActive && (
        ta?.breakTimer?.isOnBreak === false ||
        (breaksList.length > 0 && Boolean(breaksList[breaksList.length - 1].endTime)) ||
        ta?.isOnBreak === false
      )
    );

    const isOnBreak = Boolean(
      !isRejected &&
      hasCheckedIn &&
      !hasCheckedOut &&
      !isBackendConfirmedBreakEnded && (
        isBreakExplicitActive ||
        (localOnBreak && !ta)
      )
    );

    // Keep localStorage in sync with verified break state
    if (isOnBreak) {
      localStorage.setItem('kt_on_break_' + todayStr, 'true');
      localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
    } else {
      localStorage.removeItem('kt_on_break_' + todayStr);
      localStorage.removeItem('kt_on_break_' + todayLocalStr);
    }

    // Breaks taken today (Maximum 2 breaks allowed per day)
    // When backend data is loaded, backend breaksList/yellowSegments is authoritative!
    const backendBreakCount = Math.max(
      breaksList.length,
      yellowSegments.length,
      isOnBreak ? 1 : 0
    );
    const totalBreaksTakenToday = isRejected ? 0 : (
      ta ? backendBreakCount : Math.max(backendBreakCount, localBreakCount)
    );

    // Keep localStorage break count synchronized with authoritative backend count
    if (ta && !isRejected) {
      localStorage.setItem('kt_break_count_' + todayStr, String(totalBreaksTakenToday));
      localStorage.setItem('kt_break_count_' + todayLocalStr, String(totalBreaksTakenToday));
    }
    setDailyBreaksCount(totalBreaksTakenToday);

    // Format Break Time Displays
    if (isOnBreak) {
      // Currently ON BREAK: Break In shows when this break began; Break Out must strictly be '--:--'
      let bInTime = null;
      if (breaksList.length > 0 && breaksList[breaksList.length - 1].startTime) {
        bInTime = formatISOToLocalTime(breaksList[breaksList.length - 1].startTime);
      }
      if ((!bInTime || bInTime === '--:--') && yellowSegments.length > 0) {
        bInTime = formatMinutesToTimeStr(convertUTCMinutesToLocal(yellowSegments[yellowSegments.length - 1].fromMinutes));
      }
      setBreakInTimeDisplay(bInTime || localStorage.getItem('kt_last_break_in_' + todayStr) || localStorage.getItem('kt_break_in_time_str') || '--:--');
      setBreakOutTimeDisplay('--:--');
    } else {
      // NOT ON BREAK: Display previous completed break times if any
      let bIn = null;
      let bOut = null;
      if (breaksList.length > 0) {
        const lastB = breaksList[breaksList.length - 1];
        if (lastB.startTime) bIn = formatISOToLocalTime(lastB.startTime);
        if (lastB.endTime) bOut = formatISOToLocalTime(lastB.endTime);
      }
      if ((!bIn || bIn === '--:--') && yellowSegments.length > 0) {
        const lastSeg = yellowSegments[yellowSegments.length - 1];
        bIn = formatMinutesToTimeStr(convertUTCMinutesToLocal(lastSeg.fromMinutes));
        if (!bOut || bOut === '--:--') {
          bOut = formatMinutesToTimeStr(convertUTCMinutesToLocal(lastSeg.toMinutes));
        }
      }
      setBreakInTimeDisplay(bIn || localStorage.getItem('kt_last_break_in_' + todayStr) || '--:--');
      setBreakOutTimeDisplay(bOut || localStorage.getItem('kt_last_break_out_' + todayStr) || '--:--');
    }

    // Format time displays strictly for today
    if (hasCheckedIn && rawCheckIn && hasValidCheckInTime) {
      const formatted = formatISOToLocalTime(rawCheckIn);
      setCheckInTimeDisplay(formatted);
      if (formatted !== '--:--') {
        localStorage.setItem('kt_check_in_time_str', formatted);
      }
    } else if (hasCheckedIn && ta?.checkInTimeDisplay && ta.checkInTimeDisplay !== '--:--') {
      const formatted = formatISOToLocalTime(ta.checkInTimeDisplay);
      setCheckInTimeDisplay(formatted);
      if (formatted !== '--:--') {
        localStorage.setItem('kt_check_in_time_str', formatted);
      }
    } else if (hasCheckedIn) {
      setCheckInTimeDisplay(localStorage.getItem('kt_check_in_time_str') || '--:--');
    } else {
      setCheckInTimeDisplay('--:--');
    }

    if (hasCheckedOut) {
      if (shouldAutoCheckOut || ta?.isAutoCheckedOut) {
        const autoOut = ta?.officeEndTime ? formatISOToLocalTime(ta.officeEndTime) : (localStorage.getItem('kt_check_out_time_str') || (rawCheckOut ? formatISOToLocalTime(rawCheckOut) : '--:--'));
        setCheckOutTimeDisplay(autoOut !== '--:--' ? autoOut : '--:--');
      } else if (rawCheckOut && hasValidCheckOutTime) {
        setCheckOutTimeDisplay(formatISOToLocalTime(rawCheckOut));
      } else if (ta?.checkOutTimeDisplay && ta.checkOutTimeDisplay !== '--:--') {
        setCheckOutTimeDisplay(formatISOToLocalTime(ta.checkOutTimeDisplay));
      } else {
        setCheckOutTimeDisplay(localStorage.getItem('kt_check_out_time_str') || '--:--');
      }
    } else {
      setCheckOutTimeDisplay('--:--');
    }

    // Calculate Working and Break Times
    const rawBreak = parseFloat(String(ta?.totalBreakTime || ta?.breakDuration || 0).replace(/[^\d.-]/g, '')) || 0;
    let breakMins = Math.round(rawBreak);

    // If currently on break, include live break minutes
    if (isOnBreak && breaksList.length > 0 && breaksList[breaksList.length - 1].startTime) {
      const bStartMins = parseTimeToMinutes(breaksList[breaksList.length - 1].startTime);
      if (bStartMins !== null) {
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
        const liveBreak = Math.max(0, nowMins - bStartMins);
        if (liveBreak > breakMins) breakMins = liveBreak;
      }
    }
    setTotalBreakTimeDisplay(`${breakMins}m`);

    const inVal = (hasCheckedIn && hasValidCheckInTime) ? (rawCheckIn || (hasCheckedIn ? localStorage.getItem('kt_check_in_time_str') : null) || null) : null;
    const outVal = hasCheckedOut 
      ? (rawCheckOut || localStorage.getItem('kt_check_out_time_str') || (ta?.officeEndTime ? formatISOToLocalTime(ta.officeEndTime) : null))
      : null;

    // Prioritize backend-provided totalWorkTimeDisplay or numeric totalWorkTime only when checked out
    const rawWorkTime = ta?.totalWorkTimeDisplay || ta?.totalWorkTimeHours;
    if (hasCheckedOut && rawWorkTime && rawWorkTime !== '0h' && rawWorkTime !== '0h 0m') {
      setTotalWorkTimeDisplay(formatHoursAndMinutes(rawWorkTime));
    } else if (hasCheckedOut && ta?.totalWorkTime && typeof ta.totalWorkTime === 'number' && ta.totalWorkTime > 0) {
      setTotalWorkTimeDisplay(formatHoursAndMinutes(ta.totalWorkTime));
    } else if (!hasCheckedIn || isRejected || !inVal) {
      setTotalWorkTimeDisplay('0h 0m');
    } else {
      setTotalWorkTimeDisplay(formatHoursAndMinutes(calculateWorkingHours(inVal, outVal, breakMins)));
    }

    // Comprehensive Status Evaluation (Check-in time window, Working hours rule, 70m break penalty, Admin rejection)
    const evalStatus = deriveAttendanceStatus({
      checkInTime: inVal,
      checkOutTime: outVal,
      totalBreakMinutes: breakMins,
      adminStatus: ta?.adminStatus || ta?.approvalStatus,
      approvalStatus: ta?.approvalStatus,
      checkInStatus: ta?.checkInStatus,
      isRejected: isRejected,
      isPending: isPendingApproval,
      rejectionReason: rejectionReasonText,
      status: ta?.status,
      isCompleted: hasCheckedOut
    });
    setAttendanceEvaluation(evalStatus);

    // Status banner management:
    // If rejected: display clear rejection message (never "wait for admin approval")
    // If pending: display pending approval notification
    // If approved/working: clear stale rejection or approval messages
    if (isRejected) {
      const displayReason = rejectionReasonText 
        ? `Your check-in request was rejected by admin: ${rejectionReasonText}`
        : "Your check-in request has been rejected by admin.";
      setGeoError(displayReason);
    } else if (isPendingApproval) {
      setGeoError("Your check-in request is pending admin approval. Please wait for admin approval.");
    } else {
      setGeoError((prev) => {
        if (
          prev.includes("rejected") ||
          prev.includes("too late") ||
          prev.includes("not approved yet") ||
          prev.includes("pending admin approval") ||
          prev.includes("wait for admin approval")
        ) {
          return '';
        }
        return prev;
      });
    }

    // Compute Dynamic Action States according to exact state flow:
    // 1. Rejected: all action buttons disabled (Check In, Break In, Break Out, Check Out)
    // 2. Pending Approval: all action buttons disabled until admin acts
    // 3. Not checked in: ONLY canCheckIn
    // 4. Checked in (working): canStartBreak (if < 2 breaks) and canCheckOut (2 options)
    // 5. On break: ONLY canEndBreak (1 option)
    // 6. Break out: again canStartBreak (if < 2 breaks) and canCheckOut (2 options)
    // 7. Checked out: all false (once checked out, no option to check in again today)
    const canTakeBreak = Boolean(!isRejected && !isPendingApproval && hasCheckedIn && !hasCheckedOut && !isOnBreak && totalBreaksTakenToday < 2);
    let computedActions = {
      canCheckIn: Boolean(!hasCheckedIn && !hasValidCheckInTime && !isPendingApproval && !hasCheckedOut && !isRejected),
      canStartBreak: canTakeBreak,
      canEndBreak: Boolean(!isRejected && !isPendingApproval && hasCheckedIn && !hasCheckedOut && isOnBreak),
      canCheckOut: Boolean(!isRejected && !isPendingApproval && hasCheckedIn && !hasCheckedOut && !isOnBreak)
    };

    setActionsAvailable(computedActions);
    const newStatus = isRejected ? 'rejected' :
      isPendingApproval ? 'pending' :
        hasCheckedOut ? 'checked_out' :
          isOnBreak ? 'on_break' :
            hasCheckedIn ? 'checked_in' : 'not_checked_in';

    setAttendanceStatus(newStatus);
    if (setGlobalAttendanceStatus) {
      setGlobalAttendanceStatus(newStatus);
    }
    setTodaySegments(isRejected ? [] : (segments || []));
    setTodayBreaks(isRejected ? [] : (breaksList || []));
  }, [setGlobalAttendanceStatus]);

  // Lightweight attendance-only query (called on interval and after actions)
  const fetchTodayAttendance = useCallback(async (resolvedUserId) => {
    try {
      let todayRecord = null;
      let segments = [];
      let todayDoc = null;
      let timelineItem = null;

      // 1. Fetch Authoritative Attendance Document - ALWAYS (bypasses cache)
      try {
        const todayRes = await api.get('/api/attendance/today', { skipCache: true });
        const tData = todayRes.data?.attendance || todayRes.data?.data?.attendance || todayRes.data?.data || todayRes.data;
        if (tData && (tData.checkInTime || tData.status || tData.approvalStatus || tData.adminStatus || tData._id)) {
          // Verify that this attendance document is actually for today (and not an old record from yesterday)
          if (isTodayDate(tData.date) || isTodayDate(tData.createdAt) || (tData.checkInTime && isTodayDate(tData.checkInTime))) {
            todayDoc = tData;
          }
        }
      } catch (todayErr) {
        console.warn("Authoritative attendance today fetch notice:", todayErr.message);
      }

      // 1b. Fallback: If not found from /api/attendance/today, query /api/employee-panel/dashboard todayAttendance
      if (!todayDoc) {
        try {
          const dashRes = await api.get('/api/employee-panel/dashboard', { skipCache: true });
          const dAtt = dashRes.data?.data?.todayAttendance || dashRes.data?.todayAttendance;
          if (dAtt && (dAtt.checkInTime || dAtt.status)) {
            if (isTodayDate(dAtt.date) || isTodayDate(dAtt.createdAt) || (dAtt.checkInTime && isTodayDate(dAtt.checkInTime))) {
              todayDoc = {
                ...dAtt,
                date: dAtt.date || new Date().toISOString().split('T')[0],
                totalWorkTime: dashRes.data?.data?.statistics?.todayWorkingHours || dAtt.currentWorkingHours || 0
              };
            }
          }
        } catch (dErr) {}
      }

      // 1c. Fallback: If still not found, check /api/attendance/:id if active attendance ID is cached
      if (!todayDoc) {
        try {
          const cachedAttId = localStorage.getItem('kt_current_attendance_id');
          if (cachedAttId && /^[0-9a-fA-F]{24}$/.test(cachedAttId)) {
            const attByIdRes = await api.get(`/api/attendance/${cachedAttId}`, { skipCache: true });
            const attData = attByIdRes.data?.attendance || attByIdRes.data?.data || attByIdRes.data;
            if (attData && (attData.checkInTime || attData.status)) {
              if (isTodayDate(attData.date) || isTodayDate(attData.createdAt) || (attData.checkInTime && isTodayDate(attData.checkInTime))) {
                todayDoc = attData;
              } else {
                localStorage.removeItem('kt_current_attendance_id');
              }
            }
          }
        } catch (idErr) {}
      }

      // 2. Fetch Timeline - Matches AttendanceView.jsx query protocol to reliably retrieve today's record
      try {
        let tlList = [];
        try {
          const tlRes = await api.get('/api/employee-panel/attendance/timeline?filter=today', { skipCache: true });
          tlList = tlRes.data?.data || tlRes.data?.timeline || [];
        } catch (e) {
          tlList = [];
        }

        // Find today's record in the returned list
        let found = Array.isArray(tlList) 
          ? tlList.find(r => isTodayDate(r.date) || isTodayDate(r.createdAt) || (r.checkInTime && isTodayDate(r.checkInTime)))
          : null;

        // Fallback: If not found with ?filter=today, fetch ?filter=last10days (which is the default in AttendanceView)
        if (!found) {
          try {
            const tlRes10 = await api.get('/api/employee-panel/attendance/timeline?filter=last10days', { skipCache: true });
            const list10 = tlRes10.data?.data || tlRes10.data?.timeline || [];
            if (Array.isArray(list10)) {
              found = list10.find(r => isTodayDate(r.date) || isTodayDate(r.createdAt) || (r.checkInTime && isTodayDate(r.checkInTime)));
            }
          } catch (e10) {
            console.warn("Timeline last10days fallback notice:", e10.message);
          }
        }

        if (found) {
          timelineItem = found;
          segments = found.timelineSegments || [];
        }
      } catch (tlErr) {
        console.warn("Timeline today fetch notice:", tlErr.message);
      }

      // 3. Query organizational attendance logs (/api/attendance/admin/all) which holds authoritative verified records for today
      let adminRecord = null;
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayDateStr = `${year}-${month}-${day}`;

        let aList = [];
        try {
          const aRes = await api.get(`/api/attendance/admin/all?date=${encodeURIComponent(todayDateStr)}&_t=${Date.now()}`, { skipCache: true });
          aList = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.data || aRes.data?.attendance || aRes.data?.logs || aRes.data?.records || []);
        } catch (e1) {
          try {
            const aResAll = await api.get('/api/attendance/admin/all', { skipCache: true });
            aList = Array.isArray(aResAll.data) ? aResAll.data : (aResAll.data?.data || aResAll.data?.attendance || aResAll.data?.logs || aResAll.data?.records || []);
          } catch (e2) {}
        }

        if (Array.isArray(aList) && aList.length > 0) {
          let storedUser = null;
          try {
            storedUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
          } catch (e) {}

          let tokenUserId = null;
          try {
            const token = localStorage.getItem('auth_token');
            if (token && token.includes('.')) {
              const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
              tokenUserId = payload.id || payload._id || payload.userId;
            }
          } catch (e) {}

          const candIds = [
            resolvedUserId,
            actualUserIdRef.current,
            user?._id,
            user?.id,
            user?.employeeId,
            user?.employee?._id,
            user?.employee?.id,
            user?.employee?.employeeId,
            user?.user?._id,
            user?.user?.id,
            storedUser?._id,
            storedUser?.id,
            storedUser?.employee?._id,
            storedUser?.employeeId,
            storedUser?.user?._id,
            tokenUserId
          ].filter(Boolean).map(x => String(x).toLowerCase().trim());

          const candEmails = [
            user?.email,
            user?.user?.email,
            user?.employee?.email,
            storedUser?.email,
            storedUser?.user?.email,
            storedUser?.employee?.email
          ].filter(Boolean).map(x => String(x).toLowerCase().trim());

          const matchedAdmin = aList.find(item => {
            if (!item) return false;
            // Record MUST be strictly for today
            const isItemToday = isTodayDate(item.date) || isTodayDate(item.attendanceDate) || isTodayDate(item.createdAt);
            if (!isItemToday) return false;

            // Only consider if item has an actual check-in or is active
            const hasCheckIn = Boolean(
              item.checkInTime || item.punchIn || item.checkIn || item.approvedCheckInTime
            );
            const statusL = String(item.status || item.attendanceStatus || '').toLowerCase();
            if (!hasCheckIn && ['not_checked_in', 'not-checked-in', 'absent', 'none', 'idle'].includes(statusL)) {
              return false;
            }

            // Strictly match user identity - NEVER match item._id (which is attendance record ID!)
            const itemUserIds = [
              item.employeeId,
              item.employeeID,
              item.userId,
              typeof item.employee === 'object' ? item.employee?._id : item.employee,
              typeof item.employee === 'object' ? item.employee?.id : null,
              typeof item.employee === 'object' ? item.employee?.employeeId : null,
              typeof item.user === 'object' ? item.user?._id : item.user,
              typeof item.user === 'object' ? item.user?.id : null,
              typeof item.userId === 'object' ? item.userId?._id : null
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());

            if (candIds.length > 0 && itemUserIds.some(id => candIds.includes(id))) return true;

            const itemEmails = [
              item.email,
              item.employeeEmail,
              typeof item.employee === 'object' ? item.employee?.email : null,
              typeof item.user === 'object' ? item.user?.email : null,
              typeof item.userId === 'object' ? item.userId?.email : null
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());

            if (candEmails.length > 0 && itemEmails.some(em => candEmails.includes(em))) return true;

            // Strict exact full-name match only (no substring/partial matching!)
            const candNames = [
              user?.name,
              user?.fullName,
              user?.employeeName,
              user?.employee?.name,
              user?.employee?.fullName,
              user?.user?.name,
              user?.user?.fullName,
              storedUser?.name,
              storedUser?.fullName,
              storedUser?.employee?.name,
              storedUser?.employeeName
            ].filter(Boolean).map(x => String(x).toLowerCase().replace(/\s+/g, ' ').trim());

            const itemNames = [
              item.name,
              item.employeeName,
              typeof item.employee === 'object' ? (item.employee?.name || item.employee?.fullName) : null,
              typeof item.user === 'object' ? (item.user?.name || item.user?.fullName) : null
            ].filter(Boolean).map(x => String(x).toLowerCase().replace(/\s+/g, ' ').trim());

            return candNames.length > 0 && itemNames.some(nm => candNames.some(c => c === nm));
          });

          if (matchedAdmin) {
            adminRecord = matchedAdmin;
          }
        }
      } catch (adminErr) {
        console.warn("Admin all attendance lookup notice:", adminErr.message);
      }

      // 4. Query /api/attendance/pending ONLY for TODAY'S pending check-in requests
      let pendingDoc = null;
      try {
        const pendRes = await api.get('/api/attendance/pending', { skipCache: true });
        const pList = pendRes.data?.pendingRequests || pendRes.data?.requests || pendRes.data?.data || pendRes.data?.attendance || (Array.isArray(pendRes.data) ? pendRes.data : []);
        if (Array.isArray(pList) && pList.length > 0) {
          const effId = resolvedUserId || actualUserIdRef.current || user?.employee?._id || user?._id || user?.id || user?.user?._id;
          const effEmail = (user?.email || user?.user?.email || '').toLowerCase().trim();
          const myPending = pList.find(item => {
            const isRecToday = isTodayDate(item.date) || isTodayDate(item.checkInTime) || isTodayDate(item.createdAt);
            if (!isRecToday) return false;
            const iUserId = item.userId?._id || item.userId?.id || item.userId || item.employee?._id || item.employee || item.employeeId;
            const iEmail = (item.email || item.userId?.email || item.user?.email || item.employee?.email || '').toLowerCase().trim();
            return (effId && iUserId && String(iUserId).toLowerCase() === String(effId).toLowerCase()) ||
                   (effEmail && iEmail && iEmail === effEmail);
          });
          if (myPending) {
            // ONLY consider pending if user does NOT already have an active/present session
            const hasActiveWork = Boolean(
              (timelineItem && (['present', 'late', 'half day', 'checked_in', 'working', 'active', 'on_break', 'completed', 'checked_out'].some(s => String(timelineItem.status || '').toLowerCase().includes(s)) || (timelineItem.checkInTime && timelineItem.checkInTime !== '--:--'))) ||
              (adminRecord && (['present', 'late', 'half day', 'checked_in', 'working', 'active', 'on_break', 'completed', 'checked_out'].some(s => String(adminRecord.status || adminRecord.attendanceStatus || '').toLowerCase().includes(s)) || (adminRecord.checkInTime || adminRecord.approvedCheckInTime || adminRecord.punchIn || adminRecord.checkIn)))
            );
            if (!hasActiveWork) {
              pendingDoc = myPending;
              if (!todayDoc) todayDoc = {};
              todayDoc.approvalStatus = 'pending';
              todayDoc.status = 'pending';
              if (myPending.checkInTime && !todayDoc.checkInTime) {
                todayDoc.checkInTime = myPending.checkInTime;
              }
            }
          }
        }
      } catch (pendErr) {
        // Ignored if /api/attendance/pending is restricted or empty
      }

      // 5. Merge all sources: todayDoc, timelineItem, adminRecord (preserving all break data, times, and segments)
      const rawBreaks = [
        ...(Array.isArray(todayDoc?.breaks) && todayDoc.breaks.length > 0 ? todayDoc.breaks : []),
        ...(Array.isArray(timelineItem?.breaks) && timelineItem.breaks.length > 0 ? timelineItem.breaks : []),
        ...(Array.isArray(adminRecord?.breaks) && adminRecord.breaks.length > 0 ? adminRecord.breaks : []),
        ...(todayDoc?.breakStart || todayDoc?.breakEnd ? [{ startTime: todayDoc.breakStart, endTime: todayDoc.breakEnd }] : []),
        ...(timelineItem?.breakStart || timelineItem?.breakEnd ? [{ startTime: timelineItem.breakStart, endTime: timelineItem.breakEnd }] : []),
        ...(adminRecord?.breakStart || adminRecord?.breakEnd ? [{ startTime: adminRecord.breakStart, endTime: adminRecord.breakEnd }] : []),
        ...(Array.isArray(adminRecord?.sessions) ? adminRecord.sessions.filter(s => s.breakStart || s.breakEnd).map(s => ({ startTime: s.breakStart, endTime: s.breakEnd })) : [])
      ];

      const mergedCheckIn = todayDoc?.approvedCheckInTime || todayDoc?.checkInTime || todayDoc?.checkInTimeDisplay || todayDoc?.approvedCheckInTimeDisplay || timelineItem?.approvedCheckInTime || timelineItem?.checkInTime || timelineItem?.checkInTimeDisplay || adminRecord?.approvedCheckInTime || adminRecord?.checkInTime || adminRecord?.punchIn || adminRecord?.checkIn || todayDoc?.inTime || timelineItem?.inTime;

      // Authoritative null checkout preservation: if todayDoc explicitly has checkOutTime (even if null), honor it!
      let mergedCheckOut = null;
      if (todayDoc && Object.prototype.hasOwnProperty.call(todayDoc, 'checkOutTime')) {
        mergedCheckOut = todayDoc.checkOutTime;
      } else if (todayDoc && Object.prototype.hasOwnProperty.call(todayDoc, 'checkOutTimeDisplay')) {
        mergedCheckOut = todayDoc.checkOutTimeDisplay;
      } else if (timelineItem && Object.prototype.hasOwnProperty.call(timelineItem, 'checkOutTime')) {
        mergedCheckOut = timelineItem.checkOutTime;
      } else {
        mergedCheckOut = adminRecord?.checkOutTime || adminRecord?.punchOut || adminRecord?.checkOut || todayDoc?.outTime || timelineItem?.outTime || null;
      }

      const mergedStatus = todayDoc?.status || timelineItem?.status || adminRecord?.status || adminRecord?.attendanceStatus;

      const mergedSource = {
        date: todayDoc?.date || timelineItem?.date || adminRecord?.date || new Date().toISOString().split('T')[0],
        ...(adminRecord || {}),
        ...(timelineItem || {}),
        ...(todayDoc || {}),
        date: todayDoc?.date || timelineItem?.date || adminRecord?.date || new Date().toISOString().split('T')[0],
        status: mergedStatus,
        approvalStatus: todayDoc?.approvalStatus || timelineItem?.approvalStatus || adminRecord?.approvalStatus,
        adminStatus: todayDoc?.adminStatus || timelineItem?.adminStatus || adminRecord?.adminStatus,
        checkInStatus: todayDoc?.checkInStatus || timelineItem?.checkInStatus || adminRecord?.checkInStatus,
        checkInTime: mergedCheckIn,
        checkOutTime: mergedCheckOut,
        breaks: rawBreaks,
        totalBreakTime: todayDoc?.totalBreakTime ?? timelineItem?.totalBreakTime ?? adminRecord?.totalBreakTime ?? adminRecord?.breakDuration,
        rejectionReason: todayDoc?.rejectionReason || timelineItem?.rejectionReason || adminRecord?.rejectionReason || todayDoc?.rejectReason || timelineItem?.rejectReason,
        isRejected: todayDoc?.isRejected ?? timelineItem?.isRejected ?? adminRecord?.isRejected,
        isApproved: todayDoc?.isApproved ?? timelineItem?.isApproved ?? adminRecord?.isApproved,
        timelineSegments: (segments && segments.length > 0) ? segments : (todayDoc?.timelineSegments || timelineItem?.timelineSegments || adminRecord?.timelineSegments || [])
      };

      if (todayDoc || timelineItem || adminRecord) {
        todayRecord = normalizeAttendanceRecord(mergedSource);
      }

      applyAttendanceState(todayRecord, mergedSource.timelineSegments || []);
      return todayRecord;
    } catch (err) {
      console.error("fetchTodayAttendance failed:", err);
      return null;
    }
  }, [applyAttendanceState, user]);

  // Core Sync Logic for action callbacks
  const syncDashboardAndAttendance = useCallback(async (resolvedUserId) => {
    return fetchTodayAttendance(resolvedUserId);
  }, [fetchTodayAttendance]);

  // Comprehensive Dashboard Data Loader (runs ONCE on mount)
  const fetchFullDashboard = useCallback(async (resolvedUserId) => {
    try {
      const effectiveId = resolvedUserId || actualUserIdRef.current || user?.employee?._id || user?._id || user?.id || user?.user?._id;

      // 1. Fetch Dashboard Overview
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

      // 2. Fetch User Directory (fresh without stale cache)
      const uMap = {};
      try {
        const uRes = await api.get('/api/users/all', { skipCache: true });
        const rawUsers = uRes.data?.users || uRes.data?.data || (Array.isArray(uRes.data) ? uRes.data : []);
        if (Array.isArray(rawUsers)) {
          rawUsers.forEach(u => {
            const photo = cleanPhotoUrl(
              u.profilePhoto || u.profileImage || u.photoUrl || u.avatar || u.image || u.photo ||
              u.employee?.profilePhoto || u.employee?.profileImage || u.employee?.photoUrl || u.employee?.avatar || u.employee?.image || u.employee?.photo ||
              u.user?.profilePhoto || u.user?.photoUrl || u.user?.avatar ||
              u.profile?.profilePhoto || u.profile?.photoUrl || u.profile?.avatar || ''
            );
            const enriched = { ...u, resolvedPhoto: photo };

            const registerKey = (val) => {
              if (!val) return;
              if (typeof val === 'object') {
                if (val._id) uMap[String(val._id).toLowerCase()] = enriched;
                if (val.id) uMap[String(val.id).toLowerCase()] = enriched;
                if (val.employeeId) uMap[String(val.employeeId).toLowerCase()] = enriched;
                if (val.email) uMap[val.email.toLowerCase().trim()] = enriched;
                if (val.name) uMap[val.name.toLowerCase().replace(/\s+/g, ' ').trim()] = enriched;
                if (val.fullName) uMap[val.fullName.toLowerCase().replace(/\s+/g, ' ').trim()] = enriched;
                return;
              }
              const str = String(val).trim();
              if (str) uMap[str.toLowerCase()] = enriched;
            };

            registerKey(u._id);
            registerKey(u.id);
            registerKey(u.employeeId);
            registerKey(u.email);
            registerKey(u.name);
            registerKey(u.fullName);
            registerKey(u.employeeName);
            if (u.firstName || u.lastName) {
              registerKey(`${u.firstName || ''} ${u.lastName || ''}`.replace(/\s+/g, ' ').trim());
            }
            if (u.employee) registerKey(u.employee);
            if (u.user) registerKey(u.user);
          });
        }
      } catch (uErr) {
        console.warn("Users directory fetch notice for dashboard:", uErr.message);
      }

      // Build extraPhotoMap from localStorage & uploaded /api/document records
      const extraPhotoMap = {};
      try {
        const savedPhotos = JSON.parse(localStorage.getItem('kt_employee_photos') || '{}');
        Object.assign(extraPhotoMap, savedPhotos);
      } catch (e) {}

      try {
        const docRes = await api.get('/api/document');
        const docList = docRes.data?.data || docRes.data || [];
        if (Array.isArray(docList)) {
          docList.forEach(d => {
            const isPhotoDoc = (
              String(d.title || '').toLowerCase().includes('photo') ||
              String(d.fileName || '').toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i) ||
              String(d.fileType || '').toLowerCase().startsWith('image/')
            );
            const fileUrl = cleanPhotoUrl(d.fileUrl || d.url || d.path);
            if (isPhotoDoc && fileUrl) {
              if (d.referenceId) extraPhotoMap[String(d.referenceId).toLowerCase().trim()] = fileUrl;
              if (d.uploadedBy) extraPhotoMap[String(d.uploadedBy).toLowerCase().trim()] = fileUrl;
            }
          });
        }
      } catch (dErr) {
        // Document fetch fallback
      }

      // 3. Resolve Team Members On Leave
      // Fetch /api/leave/all to get approved leaves with full employee populate & photos
      let allLeaves = [];
      try {
        const lRes = await api.get('/api/leave/all', { skipCache: true });
        allLeaves = lRes.data?.data || lRes.data?.leaves || lRes.data?.history || (Array.isArray(lRes.data) ? lRes.data : []);
      } catch (lErr) {
        console.warn("Active leaves fetch notice:", lErr.message);
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const todayLocal = new Date().toLocaleDateString('en-CA');
      const activeLeaves = Array.isArray(allLeaves) ? allLeaves.filter(l => {
        const status = String(l.status || '').toLowerCase().trim();
        const tlStatus = String(l.teamLeadStatus || '').toLowerCase().trim();
        const isApproved = status.includes('approved') || tlStatus === 'approved';
        if (!isApproved) return false;
        const s = (l.startDate || '').split('T')[0];
        const e = (l.endDate || '').split('T')[0] || s;
        return (s <= todayIso && e >= todayIso) || (s <= todayLocal && e >= todayLocal);
      }) : [];

      let resolvedTeamOnLeave = [];
      const dashList = Array.isArray(dData.teamMembersOnLeave) ? dData.teamMembersOnLeave : [];

      if (dashList.length > 0) {
        resolvedTeamOnLeave = dashList.map(t => {
          // Cross-reference with matching active leave if available
          const matchedLeave = activeLeaves.find(l => {
            const lEmpId = String(typeof l.employeeId === 'object' ? l.employeeId?._id : l.employeeId || l.applicantId || '').toLowerCase();
            const tId = String(t._id || t.id || (typeof t.employeeId === 'object' ? t.employeeId?._id : t.employeeId) || '').toLowerCase();
            if (lEmpId && tId && (lEmpId === tId)) return true;
            const lName = (l.applicantName || l.employeeName || (typeof l.employeeId === 'object' ? l.employeeId?.name : '') || '').toLowerCase().trim();
            const tName = (t.name || t.fullName || '').toLowerCase().trim();
            return lName && tName && (lName === tName);
          });

          let photo = resolveEmployeePhoto(t, uMap, extraPhotoMap);
          if (!photo && matchedLeave) {
            photo = resolveEmployeePhoto(matchedLeave, uMap, extraPhotoMap);
          }
          if (!photo) {
            photo = cleanPhotoUrl(t.profilePhoto || t.photoUrl || t.avatar || '');
          }

          return {
            ...t,
            profilePhoto: photo
          };
        });
      }

      // If dashboard API returned no team leaves, use resolved active leaves from /api/leave/all
      if (resolvedTeamOnLeave.length === 0 && activeLeaves.length > 0) {
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

          let photo = resolveEmployeePhoto(l, uMap, extraPhotoMap);
          if (!photo && emp) {
            photo = resolveEmployeePhoto(emp, uMap, extraPhotoMap);
          }
          if (!photo && matched) {
            photo = resolveEmployeePhoto(matched, uMap, extraPhotoMap);
          }
          if (!photo) {
            photo = cleanPhotoUrl(l.profilePhoto || l.photoUrl || '');
          }

          const isHalf = Boolean(l.isHalfDay || l.leaveType === 'half_day');
          const leaveDisplay = isHalf
            ? `Half Day${l.halfDayType === 'second-half' ? ' (2nd Half)' : l.halfDayType === 'first-half' ? ' (1st Half)' : ''}`
            : 'Full Day';
          return {
            _id: l._id || idStr,
            name,
            designation,
            profilePhoto: photo,
            leaveType: leaveDisplay
          };
        });
      }
      setTeamOnLeave(resolvedTeamOnLeave);

      // 4. Fetch Announcements & Holidays (cached in axios)
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

      // 5. Fetch Tasks stats once
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
            if (['cancelled', 'canceled'].includes(str)) return 'cancelled';
            return 'todo';
          };
          setTasksStats({
            todo: tasksList.filter(t => norm(t.status) === 'todo').length,
            inProgress: tasksList.filter(t => norm(t.status) === 'inProgress').length,
            completed: tasksList.filter(t => norm(t.status) === 'completed').length,
          });
        }
      } catch (e) { console.warn("Tasks sync failed:", e); }

      // 6. Fetch Today Attendance
      await fetchTodayAttendance(effectiveId);
    } catch (error) {
      console.error("fetchFullDashboard error:", error);
    }
  }, [fetchTodayAttendance, user]);

  // --- Initial Mount & Bootstrapper (Runs ONCE on tab mount) ---
  useEffect(() => {
    let isMounted = true;
    const bootstrapDashboard = async () => {
      // Clean up past days' rejection keys, but preserve today's verified state
      try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayLocalStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        Object.keys(localStorage).forEach(key => {
          if ((key.startsWith('kt_attendance_rejected_') || key.startsWith('kt_rejection_reason_')) &&
              !key.endsWith(todayStr) && !key.endsWith(todayLocalStr)) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {}

      setIsDataLoading(true);
      const fallbackId = user?.employee?._id || user?._id || user?.id || user?.user?._id;
      let validUserId = fallbackId;

      if (!validUserId) {
        try {
          const pRes = await api.get('/api/users/profile');
          const prof = pRes.data?.data || pRes.data || {};
          validUserId = prof.employee?._id || prof._id || prof.user?._id;
        } catch (e) { }
      }

      const resolvedFullName = resolveEmployeeName(user) || user?.employee?.name || user?.name || 'User';
      const rawFirstName = resolvedFullName.split(' ')[0] || 'User';
      setLiveFirstName(rawFirstName);

      if (isMounted) {
        setActualUserId(validUserId);
        actualUserIdRef.current = validUserId;
        fetchTodayAttendance(validUserId); // Instant attendance fetch
        await fetchFullDashboard(validUserId);
        setIsDataLoading(false);
      }
    };

    bootstrapDashboard();
    return () => { isMounted = false; };
  }, [fetchFullDashboard, fetchTodayAttendance]);

  // Instant attendance fetch on mount (in parallel with bootstrapDashboard)
  useEffect(() => {
    const targetId = user?.employee?._id || user?._id || user?.id || user?.user?._id;
    fetchTodayAttendance(targetId);
  }, [fetchTodayAttendance, user]);

  // Listen to profile photo updates (from ProfileView or other tabs) to refresh dashboard team on leave
  useEffect(() => {
    const handlePhotoUpdated = () => {
      fetchFullDashboard(actualUserIdRef.current);
    };
    window.addEventListener('kt_profile_photo_updated', handlePhotoUpdated);
    return () => window.removeEventListener('kt_profile_photo_updated', handlePhotoUpdated);
  }, [fetchFullDashboard]);

  // --- Auto-refresh interval & focus listeners for Employee and TL Dashboard ---
  useEffect(() => {
    const refreshDashboardSilently = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const targetId = actualUserIdRef.current || user?.employee?._id || user?._id || user?.id || user?.user?._id;
      if (targetId) {
        fetchFullDashboard(targetId);
      }
    };

    // Auto-refresh every 12 seconds silently in the background
    const interval = setInterval(refreshDashboardSilently, 12000);

    const handleFocus = () => refreshDashboardSilently();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboardSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchFullDashboard, user]);

  // --- Auto Check-Out Monitor: If employee has not checked out until 11:59 PM, auto check out time 7:00 PM at that day ---
  useEffect(() => {
    const checkAutoCheckoutThreshold = async () => {
      const nowClock = new Date();
      const hrs = nowClock.getHours();
      const mins = nowClock.getMinutes();

      // Trigger condition: 11:59 PM (23:59)
      if (hrs === 23 && mins >= 59) {
        const todayStr = nowClock.toISOString().split('T')[0];
        const todayLocalStr = nowClock.toLocaleDateString('en-CA');
        const alreadyDone = localStorage.getItem('kt_auto_checked_out_' + todayStr) === 'true';

        if (!alreadyDone && attendanceStatusRef.current !== 'checked_out' && attendanceStatusRef.current !== 'not_checked_in') {
          localStorage.setItem('kt_auto_checked_out_' + todayStr, 'true');
          localStorage.setItem('kt_checked_out_' + todayStr, 'true');
          localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
          const autoEndTimeStr = formatISOToLocalTime("19:00");
          localStorage.setItem('kt_check_out_time_str', autoEndTimeStr);
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);

          setAttendanceStatus('checked_out');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
          setCheckOutTimeDisplay(autoEndTimeStr);
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });

          // Send background check-out to backend
          try {
            await api.post('/api/attendance/check-out', { latitude: TARGET_LAT, longitude: TARGET_LNG }).catch(() => {});
          } catch (e) { }

          await fetchTodayAttendance(actualUserIdRef.current);
        }
      }
    };

    const autoTimer = setInterval(checkAutoCheckoutThreshold, 30000);
    return () => clearInterval(autoTimer);
  }, [fetchTodayAttendance, setGlobalAttendanceStatus]);

  // --- Continuous Geofence Auto-Checkout Monitor (20m Perimeter) ---
  // If user is checked in and moves outside 20m radius -> AUTO CHECKOUT
  // CRITICAL REQUIREMENT: When user takes a break and goes downstairs/niche -> DO NOT AUTO CHECKOUT!
  const consecutiveBreachCountRef = useRef(0);
  const isPerformingAutoCheckoutRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const isLocalhost = (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

    const checkGeofenceAutoCheckout = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLocalStr = new Date().toLocaleDateString('en-CA');

      // 1. Break Exception Check (CRITICAL)
      const isUserOnBreak = (
        attendanceStatusRef.current === 'on_break' ||
        localStorage.getItem('kt_on_break_' + todayStr) === 'true' ||
        localStorage.getItem('kt_on_break_' + todayLocalStr) === 'true'
      );

      // If user is on break (downstairs for lunch/tea), NEVER auto-checkout!
      if (isUserOnBreak) {
        consecutiveBreachCountRef.current = 0;
        return;
      }

      // 2. Only active workers (checked_in) are subject to 20m perimeter enforcement
      const isWorking = (
        attendanceStatusRef.current === 'checked_in' ||
        (localStorage.getItem('kt_checked_in_' + todayStr) === 'true' &&
         localStorage.getItem('kt_checked_out_' + todayStr) !== 'true')
      );

      if (!isWorking || isPerformingAutoCheckoutRef.current) {
        consecutiveBreachCountRef.current = 0;
        return;
      }

      // In local dev, skip live GPS auto-checkout to avoid locking out developers
      if (isLocalhost) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const dist = calculateDistanceInMeters(latitude, longitude, TARGET_LAT, TARGET_LNG);

          console.log(`[GEOFENCE LOCATION] Current: (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) | Office: (${TARGET_LAT}, ${TARGET_LNG}) | Distance: ${dist.toFixed(1)}m | CheckIn Threshold: ${GEOFENCE_RADIUS_METERS.toFixed(1)}m | AutoCheckout Threshold: ${AUTO_CHECKOUT_RADIUS_METERS.toFixed(1)}m | Accuracy: ${(accuracy || 0).toFixed(1)}m | Status: ${attendanceStatusRef.current}`);

          // Re-verify break state (in case user clicked Break In while GPS was reading)
          if (
            attendanceStatusRef.current === 'on_break' ||
            localStorage.getItem('kt_on_break_' + todayStr) === 'true'
          ) {
            consecutiveBreachCountRef.current = 0;
            return;
          }

          if (dist > AUTO_CHECKOUT_RADIUS_METERS) {
            consecutiveBreachCountRef.current += 1;
            console.warn(`[GEOFENCE ALERT] Out of 20m office bounds: ${dist.toFixed(1)}m (Breach ${consecutiveBreachCountRef.current}/2)`);

            // Verify with 2 consecutive checks or high confidence fix
            if (consecutiveBreachCountRef.current >= 2 || (accuracy && accuracy <= 20 && dist > 35)) {
              isPerformingAutoCheckoutRef.current = true;
              console.warn(`[GEOFENCE AUTO-CHECKOUT] Outside 20m perimeter (${dist.toFixed(1)}m). Triggering automatic checkout.`);

              const nowIso = new Date().toISOString();
              const nowLocal = formatISOToLocalTime(nowIso);

              localStorage.setItem('kt_checked_out_' + todayStr, 'true');
              localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
              localStorage.setItem('kt_auto_checked_out_' + todayStr, 'true');
              localStorage.setItem('kt_is_auto_checkout', 'true');
              localStorage.setItem('kt_check_out_time_str', nowLocal);
              localStorage.removeItem('kt_checked_in_' + todayStr);
              localStorage.removeItem('kt_checked_in_' + todayLocalStr);
              localStorage.removeItem('kt_on_break_' + todayStr);
              localStorage.removeItem('kt_on_break_' + todayLocalStr);

              setAttendanceStatus('checked_out');
              if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
              setCheckOutTimeDisplay(nowLocal);
              setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });

              const checkoutReason = `Auto-Checkout: You moved outside the 20m office perimeter (${Math.round(dist)}m away). Automatic checkout recorded.`;
              setGeoError(checkoutReason);
              try {
                showToast(checkoutReason, 'warning');
              } catch (e) {}

              // Send check-out to backend API
              try {
                await api.post('/api/attendance/check-out', {
                  latitude: Number(latitude),
                  longitude: Number(longitude),
                  isAutoCheckout: true,
                  reason: 'Geofence breach (>20m)'
                }).catch(() => {});
              } catch (e) {}

              await fetchTodayAttendance(actualUserIdRef.current);
              isPerformingAutoCheckoutRef.current = false;
              consecutiveBreachCountRef.current = 0;
            }
          } else {
            // Inside 20m
            consecutiveBreachCountRef.current = 0;
          }
        },
        (err) => {
          console.warn('[GEOFENCE LOCATION] GPS location tracking error:', err.message);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    };

    const geofenceInterval = setInterval(checkGeofenceAutoCheckout, 10000);

    // Also listen to external auto-checkout events dispatched by AppContext or tabs
    const handleExternalAutoCheckout = () => {
      fetchTodayAttendance(actualUserIdRef.current);
    };
    window.addEventListener('kt_auto_checkout_triggered', handleExternalAutoCheckout);

    return () => {
      clearInterval(geofenceInterval);
      window.removeEventListener('kt_auto_checkout_triggered', handleExternalAutoCheckout);
    };
  }, [fetchTodayAttendance, setGlobalAttendanceStatus]);

  // --- Robust Geolocation & Verification ---
  const verifyLocationAndExecute = (actionCallback, actionType = 'check_in') => {
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

    // Production strict 20-meter geofence check
    if (!navigator.geolocation) {
      setGeoError("Location tracking is not supported by your browser.");
      setIsActionLoading(false);
      return;
    }

    const handleLocationSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const distanceMeters = calculateDistanceInMeters(latitude, longitude, TARGET_LAT, TARGET_LNG);

      // Cache this successfully acquired location
      try {
        localStorage.setItem('kt_last_gps_lat', String(latitude));
        localStorage.setItem('kt_last_gps_lng', String(longitude));
        localStorage.setItem('kt_last_gps_accuracy', String(accuracy || 0));
        localStorage.setItem('kt_last_gps_ts', String(Date.now()));
      } catch (e) {}

      console.log(`[GEOFENCE LOCATION] Action: ${actionType} | Current: (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) | Office: (${TARGET_LAT}, ${TARGET_LNG}) | Distance: ${distanceMeters.toFixed(1)}m | CheckIn Threshold: ${GEOFENCE_RADIUS_METERS.toFixed(1)}m | AutoCheckout Threshold: ${AUTO_CHECKOUT_RADIUS_METERS.toFixed(1)}m | Accuracy: ${(accuracy || 0).toFixed(1)}m`);

      // Check-in strictly requires <= 20 meters
      if (actionType === 'check_in') {
        if (distanceMeters <= GEOFENCE_RADIUS_METERS) {
          actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
        } else {
          setGeoError(
            `Office Location Error: You are ${Math.round(distanceMeters)}m away. Check-in is strictly allowed within 20 meters of office premises.`
          );
          setIsActionLoading(false);
        }
        return;
      }

      // Resuming work requires returning within 20 meters of office
      if (actionType === 'break_end') {
        if (distanceMeters <= GEOFENCE_RADIUS_METERS) {
          actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
        } else {
          setGeoError(
            `Office Location Error: You are ${Math.round(distanceMeters)}m away. Please return to the office within 20 meters to resume work.`
          );
          setIsActionLoading(false);
        }
        return;
      }

      // Break start and check out are always allowed
      actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
    };

    const handleLocationFailure = (error) => {
      // Check if recent valid location fix exists from earlier today (within 30 minutes)
      try {
        const savedLat = parseFloat(localStorage.getItem('kt_last_gps_lat'));
        const savedLng = parseFloat(localStorage.getItem('kt_last_gps_lng'));
        const savedAcc = parseFloat(localStorage.getItem('kt_last_gps_accuracy') || '10');
        const savedTs = parseInt(localStorage.getItem('kt_last_gps_ts') || '0', 10);
        const isRecent = Date.now() - savedTs < 30 * 60 * 1000;
        if (!isNaN(savedLat) && !isNaN(savedLng) && isRecent) {
          console.warn("[GEOFENCE LOCATION] Fallback to recent validated device location fix:", savedLat, savedLng);
          handleLocationSuccess({
            coords: { latitude: savedLat, longitude: savedLng, accuracy: savedAcc }
          });
          return;
        }
      } catch (e) {}

      let errorMsg = "Location permission and GPS coordinates are required to mark attendance.";
      switch (error?.code) {
        case 1:
          errorMsg = "Location permission denied. Please allow location access in your browser settings.";
          break;
        case 2:
          errorMsg = "Location unavailable. Please make sure location services are enabled on your device.";
          break;
        case 3:
          errorMsg = "Location request timed out. Please check your network/location settings and try again.";
          break;
        default:
          errorMsg = error?.message || "Failed to acquire location. Please try again.";
          break;
      }
      setGeoError(errorMsg);
      setIsActionLoading(false);
    };

    let settled = false;
    let watchId = null;

    const onPos = (pos) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
      }
      handleLocationSuccess(pos);
    };

    const onFinalFail = (err) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
      }
      handleLocationFailure(err);
    };

    // Multi-tier resilient acquisition:
    // Stage 1: Quick attempt with 60s cache allowed (instant 0ms response if location was queried recently)
    navigator.geolocation.getCurrentPosition(
      onPos,
      (err1) => {
        if (err1.code === 1) return onFinalFail(err1); // Permission denied - fail fast

        // Stage 2: Standard accuracy (uses Wi-Fi / cell triangulation - instant on Windows/laptops/desktops)
        navigator.geolocation.getCurrentPosition(
          onPos,
          (err2) => {
            if (err2.code === 1) return onFinalFail(err2);

            // Stage 3: Watch stream fallback
            try {
              watchId = navigator.geolocation.watchPosition(
                onPos,
                (err3) => onFinalFail(err2 || err1),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
              );

              setTimeout(() => {
                if (!settled) onFinalFail(err2 || err1);
              }, 5000);
            } catch (e) {
              onFinalFail(err2 || err1);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
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
          const newAttId = resData?.attendance?._id || resData?.data?._id || resData?.attendanceId || resData?._id;
          if (newAttId && /^[0-9a-fA-F]{24}$/.test(String(newAttId))) {
            try {
              localStorage.setItem('kt_current_attendance_id', String(newAttId));
            } catch (e) {}
          }

          const attObj = resData?.attendance || resData?.data?.attendance || resData?.data || resData;
          const attApprv = String(attObj?.approvalStatus || resData?.approvalStatus || '').toLowerCase().trim();
          const attStat = String(attObj?.status || resData?.status || '').toLowerCase().trim();
          const attAdmin = String(attObj?.adminStatus || resData?.adminStatus || '').toLowerCase().trim();

          const isExplicitlyApproved = Boolean(
            attObj?.isApproved === true ||
            attApprv === 'approved' ||
            attStat === 'approved' ||
            attAdmin === 'approved'
          );

          const isExplicitlyRejected = Boolean(
            attObj?.isRejected === true ||
            attApprv.includes('reject') ||
            attStat.includes('reject') ||
            attAdmin.includes('reject')
          );

          // Store authentic dynamic requested check-in time for display
          const backendCheckInIso = attObj?.approvedCheckInTime || attObj?.checkInTime || attObj?.inTime || attObj?.punchIn;
          const dynamicCheckInTime = backendCheckInIso ? formatISOToLocalTime(backendCheckInIso) : nowLocal;
          localStorage.setItem('kt_check_in_time_str', dynamicCheckInTime);
          setCheckInTimeDisplay(dynamicCheckInTime);

          if (isExplicitlyRejected) {
            localStorage.removeItem('kt_checked_in_' + todayStr);
            localStorage.removeItem('kt_checked_in_' + todayLocalStr);
            localStorage.removeItem('kt_attendance_pending_' + todayStr);
            localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
            localStorage.setItem('kt_attendance_rejected_' + todayStr, 'true');
            localStorage.setItem('kt_attendance_rejected_' + todayLocalStr, 'true');
            setAttendanceStatus('rejected');
            if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('rejected');
            setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
            setGeoError("Your check-in request was rejected by admin.");
          } else if (isExplicitlyApproved) {
            localStorage.removeItem('kt_attendance_pending_' + todayStr);
            localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
            localStorage.removeItem('kt_attendance_rejected_' + todayStr);
            localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
            localStorage.setItem('kt_checked_in_' + todayStr, 'true');
            localStorage.setItem('kt_checked_in_' + todayLocalStr, 'true');
            localStorage.removeItem('kt_checked_out_' + todayStr);
            localStorage.removeItem('kt_checked_out_' + todayLocalStr);
            setAttendanceStatus('checked_in');
            if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
            setActionsAvailable({ canCheckIn: false, canStartBreak: true, canEndBreak: false, canCheckOut: true });
            setGeoError('');
          } else {
            // Check-in request submitted to admin for approval -> status: PENDING
            localStorage.setItem('kt_attendance_pending_' + todayStr, 'true');
            localStorage.setItem('kt_attendance_pending_' + todayLocalStr, 'true');
            localStorage.removeItem('kt_checked_in_' + todayStr);
            localStorage.removeItem('kt_checked_in_' + todayLocalStr);
            localStorage.removeItem('kt_checked_out_' + todayStr);
            localStorage.removeItem('kt_checked_out_' + todayLocalStr);
            setAttendanceStatus('pending');
            if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('pending');
            setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
            setGeoError("Your check-in request is pending admin approval. Please wait for admin approval.");
          }
        } else if (actionType === 'break_start') {
          localStorage.setItem('kt_on_break_' + todayStr, 'true');
          localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
          localStorage.setItem('kt_last_break_in_' + todayStr, nowLocal);
          const currentBreaks = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
          const newBreaksCount = currentBreaks + 1;
          localStorage.setItem('kt_break_count_' + todayStr, String(newBreaksCount));
          localStorage.setItem('kt_break_count_' + todayLocalStr, String(newBreaksCount));
          setDailyBreaksCount(newBreaksCount);
          setAttendanceStatus('on_break');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
          setBreakInTimeDisplay(nowLocal);
          setBreakOutTimeDisplay('--:--');
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: false });
        } else if (actionType === 'break_end') {
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);
          localStorage.setItem('kt_last_break_out_' + todayStr, nowLocal);
          const updatedBreaks = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
          setAttendanceStatus('checked_in');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
          setBreakOutTimeDisplay(nowLocal);
          setActionsAvailable({ canCheckIn: false, canStartBreak: updatedBreaks < 2, canEndBreak: false, canCheckOut: true });
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
        const existingInStr = localStorage.getItem('kt_check_in_time_str');
        if (!existingInStr || existingInStr === '--:--') {
          localStorage.setItem('kt_check_in_time_str', nowLocal);
          setCheckInTimeDisplay(nowLocal);
        } else {
          setCheckInTimeDisplay(existingInStr);
        }
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        const curB = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
        setActionsAvailable({ canCheckIn: false, canStartBreak: curB < 2, canEndBreak: false, canCheckOut: true });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId || realUserId);
      } else if ((actionType === 'break_start' && isAlreadyOnBreak) || isAlreadyOnBreak) {
        // User is already on break: activate ONLY Break Out
        localStorage.setItem('kt_on_break_' + todayStr, 'true');
        localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
        setAttendanceStatus('on_break');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
        setBreakOutTimeDisplay('--:--');
        setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: false });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if ((actionType === 'break_end' && isNotOnBreak) || isNotOnBreak) {
        // User is not on break: return to checked in
        localStorage.removeItem('kt_on_break_' + todayStr);
        localStorage.removeItem('kt_on_break_' + todayLocalStr);
        const curB = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        setActionsAvailable({ canCheckIn: false, canStartBreak: curB < 2, canEndBreak: false, canCheckOut: true });
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
      } else if (
        lowerMsg.includes('not approved') ||
        lowerMsg.includes('wait for admin approval') ||
        lowerMsg.includes('admin approval') ||
        lowerMsg.includes('pending approval') ||
        lowerMsg.includes('rejected') ||
        lowerMsg.includes('reject')
      ) {
        // Query /api/attendance/today immediately with skipCache to get the actual approval/rejection state
        let isConfirmedRejected = false;
        let rejectReasonMsg = '';
        try {
          const freshAtt = await api.get('/api/attendance/today', { skipCache: true });
          const fData = freshAtt.data?.attendance || freshAtt.data?.data?.attendance || freshAtt.data?.data || freshAtt.data;
          const fStatus = String(fData?.status || '').toLowerCase();
          const fApprv = String(fData?.approvalStatus || '').toLowerCase();
          const fAdmin = String(fData?.adminStatus || '').toLowerCase();
          isConfirmedRejected = Boolean(
            fData?.isRejected === true ||
            fStatus.includes('reject') ||
            fApprv.includes('reject') ||
            fAdmin.includes('reject') ||
            lowerMsg.includes('reject')
          );
          rejectReasonMsg = fData?.rejectionReason || fData?.rejectReason || '';
        } catch (fetchErr) {
          isConfirmedRejected = lowerMsg.includes('reject');
        }

        if (isConfirmedRejected) {
          localStorage.removeItem('kt_checked_in_' + todayStr);
          localStorage.removeItem('kt_checked_in_' + todayLocalStr);
          localStorage.removeItem('kt_attendance_pending_' + todayStr);
          localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);
          localStorage.setItem('kt_attendance_rejected_' + todayStr, 'true');
          localStorage.setItem('kt_attendance_rejected_' + todayLocalStr, 'true');
          if (rejectReasonMsg) {
            localStorage.setItem('kt_rejection_reason_' + todayStr, rejectReasonMsg);
          }

          setAttendanceStatus('rejected');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('rejected');
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
          const finalReason = rejectReasonMsg ? `Your check-in request was rejected by admin: ${rejectReasonMsg}` : "Your check-in request has been rejected by admin.";
          setGeoError(finalReason);
          await syncDashboardAndAttendance(actualUserId);
        } else {
          // Genuinely pending admin approval
          localStorage.setItem('kt_attendance_pending_' + todayStr, 'true');
          localStorage.setItem('kt_attendance_pending_' + todayLocalStr, 'true');
          localStorage.removeItem('kt_checked_in_' + todayStr);
          localStorage.removeItem('kt_checked_in_' + todayLocalStr);
          localStorage.removeItem('kt_attendance_rejected_' + todayStr);
          localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
          setAttendanceStatus('pending');
          if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('pending');
          setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
          setGeoError("Your check-in request is pending admin approval. Please wait for admin approval.");
          await syncDashboardAndAttendance(actualUserId);
        }
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
    }, 'check_in');
  };

  const onStartBreakClick = () => {
    if (!actionsAvailable.canStartBreak) return;
    const todayKey = new Date().toISOString().split('T')[0];
    const currentBreaks = parseInt(
      localStorage.getItem('kt_break_count_' + todayKey) ||
      String(dailyBreaksCount || 0), 10
    );
    if (currentBreaks >= 2) {
      setGeoError("Maximum 2 breaks allowed per day. You cannot take a 3rd break.");
      return;
    }
    const isoNow = new Date().toISOString();
    setActiveBreakIsoStart(isoNow);
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/break/start', payload, 'break_start');
    }, 'break_start');
  };

  const onResumeWorkClick = () => {
    if (!actionsAvailable.canEndBreak) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/break/end', payload, 'break_end');
    }, 'break_end');
  };

  const onCheckOutClick = () => {
    if (!actionsAvailable.canCheckOut) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng)
      };
      await handleAttendanceAction('/api/attendance/check-out', payload, 'check_out');
    }, 'check_out');
  };

  const formatDateDayMonth = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  const isRejectedAttendance = attendanceStatus === 'rejected' || attendanceEvaluation?.status === 'rejected';
  const isPendingAttendance = attendanceStatus === 'pending' || attendanceEvaluation?.status === 'pending';

  // --- Calculate Fixed 9-Hour Timeline Layout ---
  const isCheckedOut = !isRejectedAttendance && !isPendingAttendance && attendanceStatus === 'checked_out';
  const isCheckedInActive = !isRejectedAttendance && !isPendingAttendance && (attendanceStatus === 'checked_in' || attendanceStatus === 'on_break' || attendanceStatus === 'checked_out');
  const nineHourTimeline = computeNineHourTimeline({
    checkInTime: (isCheckedInActive && checkInTimeDisplay !== '--:--') ? checkInTimeDisplay : null,
    checkOutTime: (isCheckedOut && checkOutTimeDisplay !== '--:--') ? checkOutTimeDisplay : null,
    breakInTime: (isCheckedInActive && breakInTimeDisplay !== '--:--') ? breakInTimeDisplay : null,
    breakOutTime: (isCheckedInActive && breakOutTimeDisplay !== '--:--') ? breakOutTimeDisplay : null,
    breaks: isRejectedAttendance || isPendingAttendance || !isCheckedInActive ? [] : todayBreaks,
    timelineSegments: isRejectedAttendance || isPendingAttendance || !isCheckedInActive ? [] : todaySegments,
    isOnBreak: !isRejectedAttendance && !isPendingAttendance && attendanceStatus === 'on_break',
    isCheckedIn: isCheckedInActive,
    isCheckedOut: isCheckedOut,
    isRejected: isRejectedAttendance,
    isPending: isPendingAttendance
  });

  const statusConfig = getQuickActionStatusConfig({
    hasCheckedIn: !isRejectedAttendance && !isPendingAttendance && (attendanceStatus === 'checked_in' || attendanceStatus === 'on_break'),
    isOnBreak: !isRejectedAttendance && attendanceStatus === 'on_break',
    hasCheckedOut: !isRejectedAttendance && attendanceStatus === 'checked_out',
    isRejected: isRejectedAttendance,
    isPending: isPendingAttendance
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">

      {/* KPI Cards (4 items) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today Hours', value: formatHoursAndMinutes(totalWorkTimeDisplay), accent: 'border-l-indigo-600' },
          { label: 'Tasks To Do', value: tasksStats.todo, accent: 'border-l-slate-400' },
          { label: 'In Progress', value: tasksStats.inProgress, accent: 'border-l-amber-500' },
          { label: 'Completed', value: tasksStats.completed, accent: 'border-l-emerald-500' },
        ].map((item, idx) => (
          <div key={`kpi-${idx}`} className={`bg-white border border-slate-200/80 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}>
            <div className="flex items-start justify-between">
              <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
              <p className="text-xl font-bold text-slate-900">
                {isDataLoading && idx !== 0 ? <Loader2 size={18} className="animate-spin text-slate-400" /> : item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* TIME & ATTENDANCE - QUICK ACTIONS & TIMELINE */}
        <div 
          ref={quickActionsRef}
          className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden transition-all shadow-xs p-4 sm:p-5 flex flex-col justify-between"
        >

          {geoError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold flex items-center justify-center gap-2 text-center">
              <AlertCircle size={16} className="shrink-0" />
              <span>{geoError}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-slate-400" /> Quick Actions
              </h3>
              <div className="flex items-center gap-2">
                {dailyBreaksCount > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {dailyBreaksCount}/2 Breaks
                  </span>
                )}
                {parseFloat(totalBreakTimeDisplay) > 70 && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    Break &gt; 70m (Half Day)
                  </span>
                )}
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
                title={actionsAvailable.canCheckIn ? "Click to Check In" : (isRejectedAttendance ? "Check-in request was rejected by admin" : (isPendingAttendance ? "Check-in request is pending admin approval" : (attendanceStatus === 'checked_out' ? "Checked out for today (single check-in per day)" : "Already checked in today")))}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canCheckIn ? 'bg-slate-100 text-slate-400' : 'bg-[#ECFDF5] text-[#10B981] hover:bg-[#D1FAE5] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canCheckIn ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">Check In</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkInTimeDisplay}</p>
                </div>
              </button>

              {/* Break In */}
              <button
                onClick={onStartBreakClick}
                disabled={isActionLoading || !actionsAvailable.canStartBreak}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canStartBreak ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canStartBreak ? "Click to Start Break" : (isRejectedAttendance ? "Cannot start break: Check-in was rejected by admin" : (isPendingAttendance ? "Check-in request is pending admin approval" : (dailyBreaksCount >= 2 ? "Maximum 2 breaks reached for today" : (attendanceStatus === 'on_break' ? "Currently on break" : "Break In not available"))))}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canStartBreak ? 'bg-slate-100 text-slate-400' : 'bg-[#FFFBEB] text-[#F59E0B] hover:bg-[#FEF3C7] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canStartBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">Break In</p>
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
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canEndBreak ? 'bg-slate-100 text-slate-400' : 'bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canEndBreak ? <Loader2 className="animate-spin" size={24} /> : <Coffee size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">Break Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{breakOutTimeDisplay}</p>
                </div>
              </button>

              {/* Check Out */}
              <button
                onClick={onCheckOutClick}
                disabled={isActionLoading || !actionsAvailable.canCheckOut}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${!actionsAvailable.canCheckOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                title={actionsAvailable.canCheckOut ? "Click to Check Out" : (isRejectedAttendance ? "Cannot check out: Check-in was rejected by admin" : (isPendingAttendance ? "Check-in request is pending admin approval" : (attendanceStatus === 'on_break' ? "Cannot check out during break. End break first." : (attendanceStatus === 'checked_out' ? "Shift completed today" : "Check Out not available"))))}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!actionsAvailable.canCheckOut ? 'bg-slate-100 text-slate-400' : 'bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEE2E2] shadow-sm hover:shadow-md'}`}>
                  {isActionLoading && actionsAvailable.canCheckOut ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800">Check Out</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{checkOutTimeDisplay}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Timeline Visualizer - Fixed 9-Hour Timeline */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">

              {/* Timeline Legend */}
              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
                  Working Time
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                  Break
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  Extra Break
                </span>
              </div>
            </div>

            {/* Fixed 9-Hour Track (Grey Base for Early Out / Remaining Time) */}
            <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex relative shadow-inner group cursor-help">
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
                      <span className="text-[10px] font-mono font-bold text-slate-700 leading-none">
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
        <div 
          className="bg-white border border-slate-200/80 rounded-xl flex flex-col h-full overflow-hidden shadow-xs transition-all duration-200"
          style={quickActionsHeight && typeof window !== 'undefined' && window.innerWidth >= 1024 ? { height: `${quickActionsHeight}px`, maxHeight: `${quickActionsHeight}px` } : undefined}
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Bell size={16} className="text-indigo-600" /> Announcements
            </h2>
            {announcements.length > 0 && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider">
                {announcements.length} Updates
              </span>
            )}
          </div>
          <div className="p-0 flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 custom-scrollbar flex flex-col">
            {isDataLoading ? (
              <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : announcements.length === 0 ? (
              <div className="text-center p-8">
                <Bell size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No announcements.</p>
              </div>
            ) : (
              displayedAnnouncements.map((ann, idx) => (
                <div key={idx} className="p-3.5 sm:p-4 hover:bg-slate-50 transition-colors flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 mb-1 leading-tight break-words [overflow-wrap:anywhere]">
                      {ann.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2 break-words [overflow-wrap:anywhere]">
                      {ann.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mt-auto pt-1">
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
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Umbrella size={16} className="text-emerald-600" /> Upcoming Holidays
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">{holidays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : holidays.length === 0 ? (
              <p className="text-xs text-slate-400 w-full text-center">No holidays this month.</p>
            ) : (
              holidays.map((h, i) => {
                const dateObj = new Date(h.holidayDate);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('en-US', { month: 'short' });
                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-13 h-13 rounded-full bg-emerald-50 flex flex-col items-center justify-center border border-emerald-200/60 mb-2 group-hover:scale-105 transition-transform">
                      <span className="text-sm font-bold text-emerald-600 leading-none">{day}</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">{month}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 capitalize truncate w-full px-1">{h.holidayName}</p>
                    <p className="text-[9px] font-semibold text-emerald-700 uppercase mt-1 bg-emerald-50 px-1.5 py-0.5 rounded-sm">Public</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BIRTHDAYS - HORIZONTAL DESIGN */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Gift size={16} className="text-indigo-600" /> Upcoming Birthdays
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">{upcomingBirthdays.length}</span>
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-slate-400 w-full text-center">No birthdays upcoming.</p>
            ) : (
              upcomingBirthdays.map((b, i) => {
                const initials = b.name ? b.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'BD';
                const d = new Date(b.birthdayDate);
                const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;

                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <div className="w-13 h-13 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-200/60 mb-2 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <p className="text-xs font-medium text-slate-800 truncate w-full px-1">{b.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{dateStr}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TEAM ON LEAVE - HORIZONTAL DESIGN */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs xl:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users size={16} className="text-[#F59E0B]" /> Team On Leave
              <span className="bg-[#FFFBEB] text-[#F59E0B] px-1.5 py-0.5 rounded-full text-[10px] font-bold">{teamOnLeave.length}</span>
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
                const photoSrc = cleanPhotoUrl(t.profilePhoto) || avatarFallback;
                return (
                  <div key={t._id || i} className="flex flex-col items-center min-w-[96px] text-center group cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-all">
                    <div className="relative mb-2">
                      <img 
                        src={photoSrc} 
                        alt={t.name} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = avatarFallback;
                        }}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-xs group-hover:scale-105 group-hover:border-amber-500 transition-transform bg-amber-50" 
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full" title="On Leave" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate w-full px-1">{t.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate w-full px-1">{t.designation || 'Team Member'}</p>
                    {t.leaveType && (
                      <span className="mt-1 text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 truncate max-w-full">
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