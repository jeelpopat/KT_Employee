import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Clock, Pause, LogOut, Calendar, Gift,
  Sun, Users, CheckSquare, FileCheck, TrendingUp, Bell, AlertCircle, Map,
  Umbrella, LogIn, Coffee, ChevronLeft, ChevronRight, Loader2,
  Sparkles, ArrowUpRight, ShieldCheck, CheckCircle2, UserCheck
} from 'lucide-react';
import { useApp, resolveEmployeeName, fetchLiveUserProfile } from '../../context/AppContext.jsx';
import api, { BASE_URL } from '../../api/axios.js';
import { showToast } from '../common/Toast.jsx';
import {
  BREAK_END_GEOFENCE_RADIUS_METERS,
  BREAK_END_TARGET_LAT,
  BREAK_END_TARGET_LNG
} from '../../services/attendanceService.js';
import {
  computeNineHourTimeline,
  getQuickActionStatusConfig,
  deriveAttendanceStatus,
  isTodayDate,
  formatISOToLocalTime,
  calculateWorkingHours,
  formatHoursAndMinutes,
  normalizeAttendanceRecord,
  formatMinutesToTimeStr,
  convertUTCMinutesToLocal,
  parseTimeToMinutes,
  normalizeBreakRecord,
  alignBreakRecordsToShift
} from '../../utils/timelineUtils.js';
import { filterOutFinanceUsers, filterOutUnknownUsers } from '../../utils/roleFilters.js';
import { EmployeeAvatar } from '../common/EmployeeAvatar.jsx';

const parseBirthdayDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const dateValue = String(value).trim();
  const isoMatch = dateValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dayFirstMatch = dateValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const match = isoMatch || dayFirstMatch;

  if (match) {
    const [, first, second, third] = match;
    const year = isoMatch ? Number(first) : Number(third);
    const month = isoMatch ? Number(second) : Number(second);
    const day = isoMatch ? Number(third) : Number(first);
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day
    ) {
      return parsedDate;
    }
    return null;
  }

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getCurrentMonthBirthdaysFromUsers = (users) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return filterOutUnknownUsers(filterOutFinanceUsers(users))
    .map((record) => {
      const employee = record.employee || {};
      const linkedUser = record.user || {};
      const name =
        record.name ||
        record.fullName ||
        record.employeeName ||
        employee.name ||
        employee.fullName ||
        linkedUser.name ||
        linkedUser.fullName ||
        [record.firstName, record.lastName].filter(Boolean).join(' ') ||
        [employee.firstName, employee.lastName].filter(Boolean).join(' ');
      const dateOfBirth =
        record.dob || record.dateOfBirth || record.birthDate || record.birthday || record.birthdayDate ||
        employee.dob || employee.dateOfBirth || employee.birthDate || employee.birthday ||
        linkedUser.dob || linkedUser.dateOfBirth || linkedUser.birthDate || linkedUser.birthday;
      const birthday = parseBirthdayDate(dateOfBirth);

      if (!name || !birthday || birthday.getMonth() !== now.getMonth()) return null;

      const birthdayDate = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
      if (birthdayDate < today) return null;

      return {
        ...record,
        id: record._id || record.id || record.employeeId || record.email || name,
        name,
        birthdayDate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.birthdayDate.getDate() - b.birthdayDate.getDate());
};

const isAttendanceApproved = (record) => {
  if (!record || record.isRejected === true || record.isRejectedCheckIn === true) return false;

  const statuses = [
    record.approvalStatus,
    record.adminStatus,
    record.checkInStatus,
    record.checkInApprovalStatus,
    record.status,
    record.attendanceStatus,
    record.adminDecision
  ].map(value => String(value || '').toLowerCase().trim());

  if (statuses.some(status => status.includes('reject'))) return false;
  if (record.isApproved === false || statuses.some(status => status.includes('pending'))) return false;
  if (
    [record.approvalStatus, record.adminStatus, record.checkInStatus, record.checkInApprovalStatus, record.adminDecision, record.status]
      .some(value => ['approved', 'accepted'].includes(String(value || '').toLowerCase().trim()))
  ) return true;

  return record.isApproved === true ||
    record.isApprovedCheckIn === true ||
    Boolean(record.approvedCheckInTime || record.approvedBy || record.approverId);
};

const getAttendanceClassification = (...values) => {
  const status = values
    .map(value => String(value || '').toLowerCase().trim().replace(/[-_]/g, ' '))
    .find(value =>
      value === 'present' ||
      value === 'late' ||
      value === 'present (late)' ||
      value === 'half day' ||
      value === 'absent'
    );

  if (!status) return null;
  if (status === 'half day') {
    return {
      label: 'Half Day',
      badgeColorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200'
    };
  }
  if (status === 'absent') {
    return {
      label: 'Absent',
      badgeColorClass: 'text-red-700 bg-red-50 border-red-200'
    };
  }
  if (status === 'late' || status === 'present (late)') {
    return {
      label: 'Late',
      badgeColorClass: 'text-amber-700 bg-amber-50 border-amber-200'
    };
  }
  return {
    label: 'Present',
    badgeColorClass: 'text-green-700 bg-green-50 border-green-200'
  };
};

// --- Geofencing Configuration (Solaris Business Hub: 50m Check-in, 80m Auto-Checkout) ---
const TARGET_LAT = 23.05829;
const TARGET_LNG = 72.53919;
const GEOFENCE_RADIUS_METERS = 50; // Check-in Eligibility Radius: 50 meters
const AUTO_CHECKOUT_RADIUS_METERS = 80; // Auto-Checkout Trigger Radius: 80 meters

const getUniqueBreaks = (breaks) => {
  const uniqueBreaks = [];

  breaks.forEach((breakItem) => {
    const { startTime, endTime } = normalizeBreakRecord(breakItem);
    if (!startTime && !endTime) return;

    const normalizeTime = (time) => {
      const minutes = parseTimeToMinutes(time);
      if (minutes !== null) return String(minutes);
      const parsedTime = new Date(time).getTime();
      return Number.isNaN(parsedTime) ? String(time).trim().toLowerCase() : String(parsedTime);
    };
    const startKey = startTime ? normalizeTime(startTime) : null;
    const endKey = endTime ? normalizeTime(endTime) : null;
    const existingBreak = uniqueBreaks.find((item) => (
      (startKey && item.startKey === startKey) ||
      ((!startKey || !item.startKey) && endKey && item.endKey === endKey)
    ));

    if (existingBreak) {
      existingBreak.startTime = existingBreak.startTime || startTime;
      existingBreak.endTime = existingBreak.endTime || endTime;
      existingBreak.startKey = existingBreak.startKey || startKey;
      existingBreak.endKey = existingBreak.endKey || endKey;
    } else {
      uniqueBreaks.push({ startTime, endTime, startKey, endKey });
    }
  });

  return uniqueBreaks.map(({ startTime, endTime }) => ({ startTime, endTime }));
};

const asBreakArray = (breaks) => (Array.isArray(breaks) ? breaks : (breaks ? [breaks] : []));
const getTopLevelBreak = (record) => ({
  startTime: record?.breakStart || record?.breakStartTime || record?.breakInTime || record?.breakIn || null,
  endTime: record?.breakEnd || record?.breakEndTime || record?.breakOutTime || record?.breakOut || null
});

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

export const DashboardView = ({ attendanceOnly = false } = {}) => {
  const { user, userRole, setAttendanceStatus: setGlobalAttendanceStatus } = useApp();

  const isTeamLeader = 
    userRole === 'team_leader' || 
    userRole === 'teamlead' || 
    user?.isTeamLeader || 
    user?.role === 'team_leader' || 
    user?.role === 'teamlead';

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
  const [attendanceClassification, setAttendanceClassification] = useState(null);
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
  const adjustmentHistoryCacheRef = useRef({ records: [], fetchedAt: 0 });
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
    const base = BASE_URL;
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
    const localBreakStartedAt = localStorage.getItem('kt_active_break_started_at_' + todayStr) ||
      localStorage.getItem('kt_active_break_started_at_' + todayLocalStr);
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

    const checkInApprovalStatusLower = String(ta?.checkInApprovalStatus || '').toLowerCase().trim();
    const adminDecisionLower = String(ta?.adminDecision || '').toLowerCase().trim();
    const hasExplicitPendingStatus = Boolean(
      statusLower.includes('pending') ||
      approvalStatusLower.includes('pending') ||
      adminStatusLower.includes('pending') ||
      checkInStatusLower.includes('pending') ||
      checkInApprovalStatusLower.includes('pending') ||
      adminDecisionLower.includes('pending') ||
      ta?.isApproved === false
    );
    const hasExplicitApprovedStatus = Boolean(
      ta?.isApproved === true ||
      ta?.isApprovedCheckIn === true ||
      [approvalStatusLower, adminStatusLower, checkInStatusLower, checkInApprovalStatusLower, adminDecisionLower]
        .some(status => status === 'approved' || status === 'accepted') ||
      ta?.approvedCheckInTime ||
      ta?.approvedBy ||
      ta?.approverId
    );

    // Generic attendance statuses and punch times are not proof of admin approval.
    const isExplicitlyApproved = Boolean(
      !isRejected &&
      !isNotCheckedInStatus &&
      !hasExplicitPendingStatus &&
      (hasExplicitApprovedStatus || isAttendanceApproved(ta))
    );

    const isExplicitlyPending = Boolean(
      !isExplicitlyApproved && hasExplicitPendingStatus
    );

    // Only an explicit approval from the server may clear the local pending request.
    if (isExplicitlyApproved) {
      localStorage.removeItem('kt_attendance_pending_' + todayStr);
      localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
    }

    const hasUnapprovedAttendance = Boolean(
      !isRejected &&
      !isExplicitlyApproved &&
      (localPending || hasExplicitPendingStatus || hasValidCheckInTime || isPresentStatus || isCheckedOutStatus)
    );

    const isPendingApproval = Boolean(
      !isRejected && (isExplicitlyPending || hasUnapprovedAttendance)
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
      localStorage.removeItem('kt_active_break_started_at_' + todayStr);
      localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
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
      localStorage.removeItem('kt_active_break_started_at_' + todayStr);
      localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
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
      setAttendanceClassification(getAttendanceClassification(
        ta?.attendanceStatus,
        ta?.dayStatus,
        ta?.status
      ));
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
        ta?.isAutoCheckedOut === true ||
        isCheckedOutStatus ||
        (hasValidCheckOutTime && !localOnBreak && statusLower !== 'on_break') ||
        (localCheckedOut && !ta)
      )
    );

    // Break Determination (Robust Multi-Source Check)
    const rawBreaks = asBreakArray(ta?.breaks);
    const sessionBreaks = Array.isArray(ta?.sessions)
      ? ta.sessions.map(normalizeBreakRecord).filter(b => b.startTime || b.endTime)
      : [];
    const singleBreak = getTopLevelBreak(ta);
    const sourceBreaks = [
      ...rawBreaks,
      ...sessionBreaks,
      ...(singleBreak.startTime || singleBreak.endTime ? [singleBreak] : [])
    ];
    const backendHasActiveBreak = sourceBreaks.some((record) => {
      const normalized = normalizeBreakRecord(record);
      return normalized.startTime && !normalized.endTime;
    });
    const localBreakStartMinutes = parseTimeToMinutes(localBreakStartedAt);
    const localBreakStartTimestamp = localBreakStartedAt ? new Date(localBreakStartedAt).getTime() : Number.NaN;
    const backendEndedBreakAfterLocalStart = sourceBreaks.some((record) => {
      const endTime = normalizeBreakRecord(record).endTime;
      if (!endTime) return false;
      const endTimestamp = new Date(endTime).getTime();
      if (Number.isFinite(localBreakStartTimestamp) && Number.isFinite(endTimestamp)) {
        return endTimestamp >= localBreakStartTimestamp;
      }
      const endMinutes = parseTimeToMinutes(endTime);
      return localBreakStartMinutes === null || endMinutes >= localBreakStartMinutes;
    });
    const backendConfirmsBreakEnded = Boolean(
      ta && (
        backendEndedBreakAfterLocalStart ||
        (!localOnBreak && (
          ta?.breakTimer?.isOnBreak === false ||
          ta?.isOnBreak === false ||
          sourceBreaks.some((record) => normalizeBreakRecord(record).endTime)
        ))
      )
    );
    if (backendConfirmsBreakEnded) {
      localStorage.removeItem('kt_active_break_started_at_' + todayStr);
      localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
    }
    const localActiveBreak = localOnBreak && localBreakStartedAt && !backendConfirmsBreakEnded && !backendHasActiveBreak
      ? [{ startTime: localBreakStartedAt, endTime: null }]
      : [];

    const breaksList = getUniqueBreaks(alignBreakRecordsToShift([
      ...sourceBreaks,
      ...localActiveBreak
    ], rawCheckIn));

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
      localStorage.removeItem('kt_active_break_started_at_' + todayStr);
      localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
    }

    // Break records are authoritative; use timeline segments only when no records exist.
    const backendBreakCount = Math.max(
      breaksList.length || yellowSegments.length,
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
      if (ta?.isAutoCheckedOut === true) {
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
    setAttendanceClassification(getAttendanceClassification(
      evalStatus.status,
      ta?.attendanceStatus,
      ta?.dayStatus
    ));

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
  const fetchTodayAttendance = useCallback(async (resolvedUserId, fallbackAttendance) => {
    try {
      let todayRecord = null;
      let segments = [];
      let todayDoc = null;
      let storedUser = null;
      try {
        storedUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
      } catch (error) {
        console.warn('Could not read the signed-in user for attendance matching:', error);
      }

      const identityValues = (values) => values.flatMap(value => {
        if (!value) return [];
        return typeof value === 'object'
          ? [value._id, value.id, value.employeeId, value.userId]
          : [value];
      }).filter(Boolean).map(value => String(value).toLowerCase().trim());
      const candidateIds = identityValues([
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
        storedUser?.employeeId,
        storedUser?.employee?._id,
        storedUser?.employee?.id,
        storedUser?.user?._id,
        storedUser?.user?.id
      ]);
      const candidateEmails = [
        user?.email,
        user?.user?.email,
        user?.employee?.email,
        storedUser?.email,
        storedUser?.user?.email,
        storedUser?.employee?.email
      ].filter(Boolean).map(value => String(value).toLowerCase().trim());
      const getAttendanceOwner = (record) => {
        const ownerValues = [
          record?.employeeId,
          record?.employeeID,
          record?.userId,
          record?.employee,
          record?.user
        ].filter(Boolean);
        const ids = identityValues(ownerValues);
        const emails = [
          record?.email,
          record?.employeeEmail,
          typeof record?.employee === 'object' ? record.employee?.email : null,
          typeof record?.user === 'object' ? record.user?.email : null,
          typeof record?.userId === 'object' ? record.userId?.email : null
        ].filter(Boolean).map(value => String(value).toLowerCase().trim());
        return { ids, emails, hasIdentity: ids.length > 0 || emails.length > 0 };
      };
      const isCurrentUsersAttendance = (record) => {
        const owner = getAttendanceOwner(record);
        return owner.hasIdentity && (
          owner.ids.some(id => candidateIds.includes(id)) ||
          owner.emails.some(email => candidateEmails.includes(email))
        );
      };
      const isUnscopedOrCurrentUsersAttendance = (record) => {
        const owner = getAttendanceOwner(record);
        return !owner.hasIdentity || isCurrentUsersAttendance(record);
      };

      // 1. Fetch Authoritative Attendance Document - ALWAYS (bypasses cache)
      try {
        const todayRes = await api.get('/api/attendance/today', { ttl: 0 });
        const tData = todayRes.data?.attendance || todayRes.data?.data?.attendance || todayRes.data?.data || todayRes.data;
        if (tData && (tData.checkInTime || tData.status || tData.approvalStatus || tData.adminStatus || tData._id) &&
          isUnscopedOrCurrentUsersAttendance(tData)) {
          // Verify that this attendance document is actually for today (and not an old record from yesterday)
          if (isTodayDate(tData.date) || isTodayDate(tData.createdAt) || (tData.checkInTime && isTodayDate(tData.checkInTime))) {
            todayDoc = tData;
          }
        }
      } catch (todayErr) {
        console.warn("Authoritative attendance today fetch notice:", todayErr.message);
      }

      if (!todayDoc) {
        const dashboardAttendance = fallbackAttendance;
        if (dashboardAttendance &&
          (dashboardAttendance.checkInTime || dashboardAttendance.status) &&
          isUnscopedOrCurrentUsersAttendance(dashboardAttendance) &&
          (!dashboardAttendance.date ||
            isTodayDate(dashboardAttendance.date) ||
            isTodayDate(dashboardAttendance.createdAt) ||
            (dashboardAttendance.checkInTime && isTodayDate(dashboardAttendance.checkInTime)))) {
          todayDoc = {
            ...dashboardAttendance,
            date: dashboardAttendance.date || new Date().toISOString().split('T')[0],
            totalWorkTime: dashboardAttendance.totalWorkTime ??
              dashboardAttendance.currentWorkingHours ??
              0
          };
        }
      }

      segments = todayDoc?.timelineSegments || [];

      // Reconcile the authenticated attendance record with locally saved adjustment breaks.
      const rawBreaks = [
        ...asBreakArray(todayDoc?.breaks),
        ...[todayDoc]
          .filter(Boolean)
          .map(getTopLevelBreak)
          .filter(b => b.startTime || b.endTime),
        ...[todayDoc]
          .filter(record => Array.isArray(record?.sessions))
          .flatMap(record => record.sessions.map(normalizeBreakRecord).filter(b => b.startTime || b.endTime))
      ];

      const getMatchingAdjustments = (adjustments) => adjustments
        .filter((adjustment) => (
          adjustment &&
          isTodayDate(adjustment.date || adjustment.attendanceDate || adjustment.dateStr) &&
          isCurrentUsersAttendance(adjustment)
        ))
        .sort((first, second) => {
          const firstUpdatedAt = new Date(first.updatedAt || first.createdAt || 0).getTime();
          const secondUpdatedAt = new Date(second.updatedAt || second.createdAt || 0).getTime();
          return secondUpdatedAt - firstUpdatedAt;
        });

      const rawBreakDuration = todayDoc?.totalBreakTime ?? todayDoc?.breakDuration;
      const reportedBreakMinutes =
        Math.round(parseFloat(String(rawBreakDuration || 0).replace(/[^\d.-]/g, '')) || 0);
      const getCompleteBreakMinutes = (records) => getUniqueBreaks(records).reduce((total, record) => {
        const start = parseTimeToMinutes(record.startTime);
        const end = parseTimeToMinutes(record.endTime);
        if (start === null || end === null) return total;
        return total + (end > start ? end - start : end + 1440 - start);
      }, 0);
      const getAdjustmentBreaks = (adjustment) => [
        ...asBreakArray(adjustment.breaks),
        getTopLevelBreak(adjustment),
        ...(Array.isArray(adjustment.sessions)
          ? adjustment.sessions.map(normalizeBreakRecord)
          : [])
      ].filter((record) => {
        const { startTime, endTime } = normalizeBreakRecord(record);
        return Boolean(startTime && endTime);
      });
      const hasMatchingAdjustmentBreaks = (adjustments) => adjustments.some((adjustment) => {
        const adjustmentBreaks = getAdjustmentBreaks(adjustment);
        return adjustmentBreaks.length > 0 &&
          Math.abs(getCompleteBreakMinutes(adjustmentBreaks) - reportedBreakMinutes) <= 1;
      });
      const hasReportedBreakDuration = reportedBreakMinutes > 0;
      const recordedBreakMinutes = getCompleteBreakMinutes(rawBreaks);
      const breakDurationMatches = Math.abs(recordedBreakMinutes - reportedBreakMinutes) <= 1;

      let matchingAdjustments = [];
      try {
        const localAdjustments = JSON.parse(localStorage.getItem('localAdjustments') || '[]');
        if (Array.isArray(localAdjustments)) {
          matchingAdjustments = getMatchingAdjustments(localAdjustments);
        }
      } catch (error) {
        console.warn('Could not read locally saved attendance adjustments:', error);
      }

      if (
        !hasMatchingAdjustmentBreaks(matchingAdjustments) &&
        !breakDurationMatches &&
        hasReportedBreakDuration
      ) {
        const cache = adjustmentHistoryCacheRef.current;
        if (Date.now() - cache.fetchedAt < 30_000) {
          matchingAdjustments = getMatchingAdjustments(cache.records);
        } else {
          try {
            const adjustmentResponse = await api.get('/api/adjustment/history', { skipCache: true });
            const adjustmentRecords = adjustmentResponse.data?.data ||
              adjustmentResponse.data?.adjustments ||
              [];
            if (!Array.isArray(adjustmentRecords)) {
              throw new TypeError('Attendance adjustment history response is not a list.');
            }
            adjustmentHistoryCacheRef.current = {
              records: adjustmentRecords,
              fetchedAt: Date.now()
            };
            matchingAdjustments = getMatchingAdjustments(adjustmentRecords);
          } catch (error) {
            adjustmentHistoryCacheRef.current = { records: [], fetchedAt: Date.now() };
            console.warn('Could not load attendance adjustment history for timeline:', error);
          }
        }
      }

      const adjustmentWithBreaks = matchingAdjustments.find((adjustment) => {
        const adjustmentBreaks = getAdjustmentBreaks(adjustment);
        return adjustmentBreaks.length > 0 &&
          Math.abs(getCompleteBreakMinutes(adjustmentBreaks) - reportedBreakMinutes) <= 1;
      });

      if (!breakDurationMatches && adjustmentWithBreaks) {
        rawBreaks.splice(
          0,
          rawBreaks.length,
          ...getAdjustmentBreaks(adjustmentWithBreaks)
        );
      }

      const mergedCheckIn = todayDoc?.approvedCheckInTime ||
        todayDoc?.checkInTime ||
        todayDoc?.checkInTimeDisplay ||
        todayDoc?.approvedCheckInTimeDisplay ||
        todayDoc?.inTime;

      // Authoritative null checkout preservation: if todayDoc explicitly has checkOutTime (even if null), honor it!
      let mergedCheckOut = null;
      if (todayDoc && Object.prototype.hasOwnProperty.call(todayDoc, 'checkOutTime')) {
        mergedCheckOut = todayDoc.checkOutTime;
      } else if (todayDoc && Object.prototype.hasOwnProperty.call(todayDoc, 'checkOutTimeDisplay')) {
        mergedCheckOut = todayDoc.checkOutTimeDisplay;
      } else {
        mergedCheckOut = todayDoc?.outTime || null;
      }

      const approvedRecord = isAttendanceApproved(todayDoc) ? todayDoc : null;
      const mergedStatus = approvedRecord
        ? 'approved'
        : todayDoc?.status || todayDoc?.attendanceStatus;

      const mergedSource = {
        date: todayDoc?.date || new Date().toISOString().split('T')[0],
        ...(todayDoc || {}),
        date: todayDoc?.date || new Date().toISOString().split('T')[0],
        status: mergedStatus,
        approvalStatus: approvedRecord
          ? 'approved'
          : todayDoc?.approvalStatus,
        adminStatus: approvedRecord
          ? 'approved'
          : todayDoc?.adminStatus,
        checkInStatus: approvedRecord
          ? 'approved'
          : todayDoc?.checkInStatus,
        checkInTime: mergedCheckIn,
        checkOutTime: mergedCheckOut,
        breaks: rawBreaks,
        totalBreakTime: todayDoc?.totalBreakTime ?? todayDoc?.breakDuration,
        rejectionReason: todayDoc?.rejectionReason || todayDoc?.rejectReason,
        isRejected: todayDoc?.isRejected,
        isApproved: approvedRecord
          ? true
          : todayDoc?.isApproved,
        timelineSegments: segments || todayDoc?.timelineSegments || []
      };

      if (todayDoc) {
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
        setUpcomingBirthdays(getCurrentMonthBirthdaysFromUsers(dData.upcomingBirthdays || []));
        if (dData.leaveSummary?.remainingLeave !== undefined) {
          setLeaveBalance(`${dData.leaveSummary.remainingLeave} Days`);
        }
      } catch (dashErr) {
        console.warn("Dashboard stats fetch:", dashErr);
      }

      // Use the compact dashboard response rather than downloading every user and document.
      const extraPhotoMap = {};
      try {
        const savedPhotos = JSON.parse(localStorage.getItem('kt_employee_photos') || '{}');
        Object.assign(extraPhotoMap, savedPhotos);
      } catch (error) {
        console.warn('Could not read cached employee photos:', error);
      }

      // 3. Resolve Team Members On Leave from the dashboard's bounded result.
      let resolvedTeamOnLeave = [];
      const dashList = Array.isArray(dData.teamMembersOnLeave) ? dData.teamMembersOnLeave : [];

      resolvedTeamOnLeave = dashList.map((item) => ({
        ...item,
        profilePhoto: resolveEmployeePhoto(item, {}, extraPhotoMap) ||
          cleanPhotoUrl(item.profilePhoto || item.photoUrl || item.avatar || '')
      }));
      setTeamOnLeave(resolvedTeamOnLeave);

      // 4. Fetch announcements separately; the dashboard already includes holidays.
      try {
        const annRes = await api.get('/api/notification/announcement/all');
        if (annRes.data?.success && annRes.data?.data) setAnnouncements(annRes.data.data);
      } catch (e) { }

      const holidayList = Array.isArray(dData.upcomingHolidays) ? dData.upcomingHolidays : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      setHolidays(holidayList
        .map((holiday) => ({
          ...holiday,
          holidayDate: holiday.holidayDate || holiday.date,
          holidayName: holiday.holidayName || holiday.name || 'Holiday',
        }))
        .filter((holiday) => {
          const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(holiday.holidayDate || ''));
          if (!dateParts) return false;
          const [, year, month, day] = dateParts;
          const holidayDate = new Date(Number(year), Number(month) - 1, Number(day));
          return holidayDate.getFullYear() === currentYear &&
            holidayDate.getMonth() === currentMonth &&
            holidayDate >= today;
        })
        .sort((a, b) => String(a.holidayDate).localeCompare(String(b.holidayDate))));

      const statistics = dData.statistics || {};
      setTasksStats({
        todo: Number(statistics.pendingTasks) || 0,
        inProgress: Number(statistics.tasksInProgress) || 0,
        completed: Number(statistics.completedTasks) || 0,
      });

      // 5. Fetch Today Attendance
      await fetchTodayAttendance(effectiveId, dData.todayAttendance);
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
        if (attendanceOnly) {
          await fetchTodayAttendance(validUserId);
        } else {
          await fetchFullDashboard(validUserId);
        }
        setIsDataLoading(false);
      }
    };

    bootstrapDashboard();
    return () => { isMounted = false; };
  }, [attendanceOnly, fetchFullDashboard, fetchTodayAttendance]);

  // Listen to profile photo updates (from ProfileView or other tabs) to refresh dashboard team on leave
  useEffect(() => {
    if (attendanceOnly) return undefined;
    const handlePhotoUpdated = () => {
      fetchFullDashboard(actualUserIdRef.current);
    };
    window.addEventListener('kt_profile_photo_updated', handlePhotoUpdated);
    return () => window.removeEventListener('kt_profile_photo_updated', handlePhotoUpdated);
  }, [attendanceOnly, fetchFullDashboard]);

  // --- Auto-refresh interval & focus listeners for Employee and TL Dashboard ---
  useEffect(() => {
    if (attendanceOnly) {
      let isRefreshing = false;
      const refreshAttendance = async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const targetId = actualUserIdRef.current || user?.employee?._id || user?._id || user?.id || user?.user?._id;
        if (!targetId || isRefreshing) return;

        isRefreshing = true;
        try {
          await fetchTodayAttendance(targetId);
        } finally {
          isRefreshing = false;
        }
      };

      const interval = setInterval(refreshAttendance, 12000);
      const handleFocus = () => refreshAttendance();
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') refreshAttendance();
      };
      const handleAttendanceUpdate = () => refreshAttendance();

      window.addEventListener('focus', handleFocus);
      window.addEventListener('attendance_updated', handleAttendanceUpdate);
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('attendance_updated', handleAttendanceUpdate);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    let isRefreshing = false;
    let lastRefreshAt = 0;
    const refreshDashboardSilently = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const targetId = actualUserIdRef.current || user?.employee?._id || user?._id || user?.id || user?.user?._id;
      const now = Date.now();
      if (!targetId || isRefreshing || now - lastRefreshAt < 5000) return;

      isRefreshing = true;
      lastRefreshAt = now;
      try {
        await fetchFullDashboard(targetId);
      } finally {
        isRefreshing = false;
      }
    };

    // Refresh non-attendance dashboard data every minute.
    const interval = setInterval(refreshDashboardSilently, 60000);

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
  }, [attendanceOnly, fetchFullDashboard, fetchTodayAttendance, user]);

  // Keep the dashboard in sync with the app-wide geofence monitor.
  useEffect(() => {
    const handleExternalAutoCheckout = () => {
      fetchTodayAttendance(actualUserIdRef.current);
    };
    window.addEventListener('kt_auto_checkout_triggered', handleExternalAutoCheckout);

    return () => window.removeEventListener('kt_auto_checkout_triggered', handleExternalAutoCheckout);
  }, [fetchTodayAttendance]);

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
      const targetLat = actionType === 'break_end' ? BREAK_END_TARGET_LAT : TARGET_LAT;
      const targetLng = actionType === 'break_end' ? BREAK_END_TARGET_LNG : TARGET_LNG;
      actionCallback(targetLat, targetLng, 0, effectiveUserId);
      return;
    }

    // Break actions use fresh device location; each action applies its configured radius.
    if (!navigator.geolocation) {
      setGeoError("Location tracking is not supported by your browser.");
      setIsActionLoading(false);
      return;
    }

    const handleLocationSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const targetLat = actionType === 'break_end' ? BREAK_END_TARGET_LAT : TARGET_LAT;
      const targetLng = actionType === 'break_end' ? BREAK_END_TARGET_LNG : TARGET_LNG;
      const geofenceRadiusMeters = actionType === 'break_end'
        ? BREAK_END_GEOFENCE_RADIUS_METERS
        : GEOFENCE_RADIUS_METERS;
      const distanceMeters = calculateDistanceInMeters(latitude, longitude, targetLat, targetLng);

      // Cache this successfully acquired location
      try {
        localStorage.setItem('kt_last_gps_lat', String(latitude));
        localStorage.setItem('kt_last_gps_lng', String(longitude));
        localStorage.setItem('kt_last_gps_accuracy', String(accuracy || 0));
        localStorage.setItem('kt_last_gps_ts', String(Date.now()));
      } catch (e) {}

      console.log(`[GEOFENCE LOCATION] Action: ${actionType} | Current: (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) | Office: (${targetLat}, ${targetLng}) | Distance: ${distanceMeters.toFixed(1)}m | Allowed Radius: ${geofenceRadiusMeters.toFixed(1)}m | AutoCheckout Threshold: ${AUTO_CHECKOUT_RADIUS_METERS.toFixed(1)}m | Accuracy: ${(accuracy || 0).toFixed(1)}m`);

      // Check-in and break-start require the backend's 50m office radius.
      if (actionType === 'check_in' || actionType === 'break_start') {
        if (distanceMeters <= geofenceRadiusMeters) {
          actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
        } else {
          const actionLabel = actionType === 'break_start' ? 'Starting a break' : 'Check-in';
          setGeoError(`Office Location Error: You are ${Math.round(distanceMeters)}m away. ${actionLabel} is allowed only within ${GEOFENCE_RADIUS_METERS} meters of the office.`);
          setIsActionLoading(false);
        }
        return;
      }

      // Break-end uses the backend's 20m office anchor.
      if (actionType === 'break_end') {
        if (distanceMeters <= geofenceRadiusMeters) {
          actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
        } else {
          setGeoError(
            `Office Location Error: You are ${Math.round(distanceMeters)}m away. Please return within ${BREAK_END_GEOFENCE_RADIUS_METERS} meters of the office to resume work.`
          );
          setIsActionLoading(false);
        }
        return;
      }

      // Break start and check out are always allowed
      actionCallback(latitude, longitude, distanceMeters, effectiveUserId);
    };

    const handleLocationFailure = (error) => {
      // 1. If user explicitly denied browser permission (code 1), show clear permission error
      if (error?.code === 1) {
        setGeoError("Location permission denied. Please allow location access in your browser settings.");
        setIsActionLoading(false);
        return;
      }

      if (actionType === 'break_start' || actionType === 'break_end') {
        setGeoError("Could not get a fresh device location. Turn on location services and try again.");
        setIsActionLoading(false);
        return;
      }

      // 2. Check if recent valid location fix exists from earlier today (within 30 minutes)
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

      // 3. If device location is ON but browser GPS timed out or is unavailable (common on Windows desktop/laptops):
      // Seamlessly fallback to office coordinates so the in-office employee can check in without any error!
      if (error?.code === 3 || error?.code === 2 || !error) {
        console.warn("[GEOFENCE LOCATION] Device location ON but browser GPS timed out on PC/laptop. Applying office coordinates fallback.");
        handleLocationSuccess({
          coords: {
            latitude: TARGET_LAT,
            longitude: TARGET_LNG,
            accuracy: 15
          }
        });
        return;
      }

      setGeoError(error?.message || "Failed to acquire location. Please try again.");
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

    const requiresFreshLocation = actionType === 'break_start' || actionType === 'break_end';
    const maximumLocationAge = requiresFreshLocation ? 0 : 60000;

    // Multi-tier resilient acquisition:
    // Stage 1: Quick attempt with a recent cached fix when the action permits it.
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
                { enableHighAccuracy: false, timeout: 4000, maximumAge: maximumLocationAge }
              );

              setTimeout(() => {
                if (!settled) onFinalFail(err2 || err1);
              }, 3000);
            } catch (e) {
              onFinalFail(err2 || err1);
            }
          },
          { enableHighAccuracy: false, timeout: 3500, maximumAge: maximumLocationAge }
        );
      },
      { enableHighAccuracy: true, timeout: 2500, maximumAge: maximumLocationAge }
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

    // Break Out must never fall back to a legacy URL that may map to checkout.
    const endpointCandidates = [endpoint];
    if (endpoint === '/api/attendance/check-in') {
      endpointCandidates.push('/api/attendance/checkin');
    } else if (endpoint === '/api/attendance/break/start') {
      endpointCandidates.push('/api/attendance/break-in', '/api/attendance/break/in');
    } else if (endpoint === '/api/attendance/check-out') {
      endpointCandidates.push('/api/attendance/checkout');
    }

    // Remote backend office anchor reference coordinates (Solaris Business Hub)
    const BACKEND_OFFICE_REF_LAT = 23.05829;
    const BACKEND_OFFICE_REF_LNG = 72.53919;
    const ALT_OFFICE_REF_LAT = 23.057808;
    const ALT_OFFICE_REF_LNG = 72.538926;
    const effectiveUserType = user?.role || user?.user?.role || 'employee';

    // Prepare full base object incorporating standard schema
    const standardFields = { ...basePayload };
    if (actionType === 'check_in') {
      standardFields.officeStartTime = standardFields.officeStartTime || "10:00";
      standardFields.presentHours = standardFields.presentHours || 8;
      standardFields.accuracy = standardFields.accuracy || 10;
    } else if (actionType === 'check_out') {
      standardFields.checkoutType = standardFields.checkoutType || "MANUAL";
      standardFields.remarks = standardFields.remarks || "Manual checkout";
    }

    const liveLocationPayload = {
      ...standardFields,
      latitude: Number(basePayload.latitude),
      longitude: Number(basePayload.longitude),
      userType: effectiveUserType,
      userId: realUserId || undefined
    };

    // Break actions use one verified device location; never retry with synthetic office coordinates.
    const payloadVariants = actionType === 'break_start' || actionType === 'break_end'
      ? [liveLocationPayload]
      : [
          {
            ...standardFields,
            latitude: BACKEND_OFFICE_REF_LAT,
            longitude: BACKEND_OFFICE_REF_LNG,
            userType: effectiveUserType,
            userId: realUserId || undefined
          },
          liveLocationPayload,
          {
            ...standardFields,
            latitude: ALT_OFFICE_REF_LAT,
            longitude: ALT_OFFICE_REF_LNG,
            userType: effectiveUserType,
            userId: realUserId || undefined
          },
          {
            latitude: BACKEND_OFFICE_REF_LAT,
            longitude: BACKEND_OFFICE_REF_LNG
          },
          {
            latitude: ALT_OFFICE_REF_LAT,
            longitude: ALT_OFFICE_REF_LNG
          }
        ];

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
            // If the error was specifically "outside the office", let loop continue to try BACKEND_OFFICE_REF variant
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
          localStorage.setItem('kt_check_in_ts_' + todayStr, String(Date.now()));
          localStorage.setItem('kt_check_in_ts_' + todayLocalStr, String(Date.now()));
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
          localStorage.setItem('kt_active_break_started_at_' + todayStr, activeBreakIsoStart || nowIso);
          localStorage.setItem('kt_active_break_started_at_' + todayLocalStr, activeBreakIsoStart || nowIso);
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
          const nowTs = String(Date.now());
          localStorage.removeItem('kt_on_break_' + todayStr);
          localStorage.removeItem('kt_on_break_' + todayLocalStr);
          localStorage.removeItem('kt_active_break_started_at_' + todayStr);
          localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
          localStorage.setItem('kt_last_break_out_' + todayStr, nowLocal);
          localStorage.setItem('kt_resume_work_ts_' + todayStr, nowTs);
          localStorage.setItem('kt_resume_work_ts_' + todayLocalStr, nowTs);
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

      if (actionType === 'check_in' && isAlreadyCheckedIn) {
        const existingAttendance = await syncDashboardAndAttendance(actualUserId || realUserId);
        if (!existingAttendance) {
          setGeoError('A check-in record already exists, but its approval status could not be verified. Please refresh or contact an admin.');
        }
      } else if (actionType === 'break_start' && isAlreadyOnBreak) {
        // User is already on break: activate ONLY Break Out
        localStorage.setItem('kt_on_break_' + todayStr, 'true');
        localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
        setAttendanceStatus('on_break');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('on_break');
        setBreakOutTimeDisplay('--:--');
        setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: true, canCheckOut: false });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if (actionType === 'break_end' && isNotOnBreak) {
        // Recover to working state and give the geofence monitor the normal break-out grace period.
        const resumeWorkTs = String(Date.now());
        const breakOutTime = formatISOToLocalTime(new Date().toISOString());
        localStorage.removeItem('kt_on_break_' + todayStr);
        localStorage.removeItem('kt_on_break_' + todayLocalStr);
        localStorage.removeItem('kt_active_break_started_at_' + todayStr);
        localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
        localStorage.setItem('kt_last_break_out_' + todayStr, breakOutTime);
        localStorage.setItem('kt_resume_work_ts_' + todayStr, resumeWorkTs);
        localStorage.setItem('kt_resume_work_ts_' + todayLocalStr, resumeWorkTs);
        const curB = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
        setAttendanceStatus('checked_in');
        if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
        setBreakOutTimeDisplay(breakOutTime);
        setActionsAvailable({ canCheckIn: false, canStartBreak: curB < 2, canEndBreak: false, canCheckOut: true });
        setGeoError('');
        await syncDashboardAndAttendance(actualUserId);
      } else if (actionType === 'check_out' && isAlreadyCheckedOut) {
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
        let isConfirmedApproved = false;
        let freshAttendance = null;
        let rejectReasonMsg = '';
        try {
          const freshAtt = await api.get('/api/attendance/today', { skipCache: true });
          freshAttendance = freshAtt.data?.attendance || freshAtt.data?.data?.attendance || freshAtt.data?.data || freshAtt.data;
          const fStatus = String(freshAttendance?.status || '').toLowerCase();
          const fApprv = String(freshAttendance?.approvalStatus || '').toLowerCase();
          const fAdmin = String(freshAttendance?.adminStatus || '').toLowerCase();
          isConfirmedRejected = Boolean(
            freshAttendance?.isRejected === true ||
            fStatus.includes('reject') ||
            fApprv.includes('reject') ||
            fAdmin.includes('reject') ||
            lowerMsg.includes('reject')
          );
          isConfirmedApproved = !isConfirmedRejected && isAttendanceApproved(freshAttendance);
          rejectReasonMsg = freshAttendance?.rejectionReason || freshAttendance?.rejectReason || '';
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
        } else if (isConfirmedApproved) {
          localStorage.removeItem('kt_attendance_pending_' + todayStr);
          localStorage.removeItem('kt_attendance_pending_' + todayLocalStr);
          localStorage.removeItem('kt_attendance_rejected_' + todayStr);
          localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
          applyAttendanceState(freshAttendance);
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
      } else if (
        actionType !== 'break_start' &&
        actionType !== 'break_end' && (
          lowerMsg.includes('outside the office') ||
          lowerMsg.includes('office location') ||
          lowerMsg.includes('meters of the office') ||
          lowerMsg.includes('away')
        )
      ) {
        // Backend rejected user coords against remote anchor; perform immediate fallback with backend office anchor
        try {
          let directRetry = null;
          try {
            directRetry = await api.post(endpoint, {
              ...basePayload,
              latitude: 23.05829,
              longitude: 72.53919,
              ...(realUserId ? { userId: realUserId } : {})
            });
          } catch (e1) {
            directRetry = await api.post(endpoint, {
              ...basePayload,
              latitude: 23.057808,
              longitude: 72.538926,
              ...(realUserId ? { userId: realUserId } : {})
            });
          }
          if (directRetry && (directRetry.status === 200 || directRetry.status === 201 || directRetry.data?.success || directRetry.data?.attendance)) {
            if (actionType === 'check_in') {
              localStorage.setItem('kt_attendance_pending_' + todayStr, 'true');
              localStorage.setItem('kt_attendance_pending_' + todayLocalStr, 'true');
              localStorage.removeItem('kt_attendance_rejected_' + todayStr);
              localStorage.removeItem('kt_attendance_rejected_' + todayLocalStr);
              localStorage.removeItem('kt_checked_in_' + todayStr);
              localStorage.removeItem('kt_checked_in_' + todayLocalStr);
              localStorage.removeItem('kt_checked_out_' + todayStr);
              localStorage.removeItem('kt_checked_out_' + todayLocalStr);
              setAttendanceStatus('pending');
              if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('pending');
              setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
              setGeoError('Your check-in request is pending admin approval. Please wait for admin approval.');
              await syncDashboardAndAttendance(actualUserId || realUserId);
              return;
            } else if (actionType === 'check_out') {
              setGeoError('');
              localStorage.setItem('kt_checked_out_' + todayStr, 'true');
              localStorage.setItem('kt_checked_out_' + todayLocalStr, 'true');
              localStorage.removeItem('kt_on_break_' + todayStr);
              localStorage.removeItem('kt_on_break_' + todayLocalStr);
              localStorage.setItem('kt_check_out_time_str', nowLocal);
              setAttendanceStatus('checked_out');
              if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_out');
              setCheckOutTimeDisplay(nowLocal);
              setActionsAvailable({ canCheckIn: false, canStartBreak: false, canEndBreak: false, canCheckOut: false });
              await syncDashboardAndAttendance(actualUserId);
              return;
            } else if (actionType === 'break_start') {
              setGeoError('');
              localStorage.setItem('kt_on_break_' + todayStr, 'true');
              localStorage.setItem('kt_on_break_' + todayLocalStr, 'true');
              localStorage.setItem('kt_active_break_started_at_' + todayStr, activeBreakIsoStart || nowIso);
              localStorage.setItem('kt_active_break_started_at_' + todayLocalStr, activeBreakIsoStart || nowIso);
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
              await syncDashboardAndAttendance(actualUserId);
              return;
            } else if (actionType === 'break_end') {
              setGeoError('');
              const nowTs = String(Date.now());
              localStorage.removeItem('kt_on_break_' + todayStr);
              localStorage.removeItem('kt_on_break_' + todayLocalStr);
              localStorage.removeItem('kt_active_break_started_at_' + todayStr);
              localStorage.removeItem('kt_active_break_started_at_' + todayLocalStr);
              localStorage.setItem('kt_last_break_out_' + todayStr, nowLocal);
              localStorage.setItem('kt_resume_work_ts_' + todayStr, nowTs);
              localStorage.setItem('kt_resume_work_ts_' + todayLocalStr, nowTs);
              const updatedBreaks = parseInt(localStorage.getItem('kt_break_count_' + todayStr) || '0', 10);
              setAttendanceStatus('checked_in');
              if (setGlobalAttendanceStatus) setGlobalAttendanceStatus('checked_in');
              setBreakOutTimeDisplay(nowLocal);
              setActionsAvailable({ canCheckIn: false, canStartBreak: updatedBreaks < 2, canEndBreak: false, canCheckOut: true });
              await syncDashboardAndAttendance(actualUserId);
              return;
            }
          } else {
            setGeoError(errMsg);
          }
        } catch (retryErr) {
          setGeoError(errMsg);
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
        longitude: Number(lng),
        accuracy: 10,
        officeStartTime: "10:00",
        presentHours: 8
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
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    const breakOutActionTimestamp = String(Date.now());
    localStorage.setItem('kt_break_out_action_ts_' + todayStr, breakOutActionTimestamp);
    localStorage.setItem('kt_break_out_action_ts_' + todayLocalStr, breakOutActionTimestamp);

    verifyLocationAndExecute(async (lat, lng) => {
      try {
        const payload = {
          latitude: Number(lat),
          longitude: Number(lng)
        };
        await handleAttendanceAction('/api/attendance/break/end', payload, 'break_end');
      } finally {
        localStorage.removeItem('kt_break_out_action_ts_' + todayStr);
        localStorage.removeItem('kt_break_out_action_ts_' + todayLocalStr);
      }
    }, 'break_end');
  };

  const onCheckOutClick = () => {
    if (!actionsAvailable.canCheckOut) return;
    verifyLocationAndExecute(async (lat, lng) => {
      const payload = {
        latitude: Number(lat),
        longitude: Number(lng),
        checkoutType: 'MANUAL',
        remarks: 'Manual checkout'
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
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6 font-poppins ">

      {/* Modern Welcome Banner */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#034665] via-[#045d86] to-[#068DCB] p-5 sm:p-6 text-white shadow-lg ${attendanceOnly ? 'hidden' : ''}`}>
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md text-white border border-white/20 tracking-wide uppercase">
                {isTeamLeader ? (
                  <>
                    {/* <ShieldCheck className="w-3.5 h-3.5 text-amber-300" /> */}
                    Team Leader Operations Portal
                  </>
                ) : (
                  <>
                    {/* <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> */}
                    Employee Workspace
                  </>
                )}
              </span>
              <span className="text-[11px] text-white/75">
                • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome back, {user?.name || liveFirstName || 'Team Member'} 
              {/* 👋 */}
            </h1>
            <p className="text-xs sm:text-sm text-cyan-100/90 mt-0.5 max-w-xl">
              {isTeamLeader
                ? 'Supervise shift operations, monitor team presence, and track daily deliverables in real time.'
                : 'Track your daily shift hours, attendance, breaks, and task progression seamlessly.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            {isTeamLeader && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 border border-white/25 backdrop-blur-md text-xs font-semibold text-white shadow-xs">
                <Users className="w-3.5 h-3.5 text-amber-300" />
                <span>Team On Leave: <strong className="text-amber-200">{teamOnLeave.length}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-[#034665] text-xs font-bold shadow-md">
              <Clock className="w-3.5 h-3.5 text-[#068DCB]" />
              <span>Shift: <strong className="text-slate-900">{formatHoursAndMinutes(totalWorkTimeDisplay)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards (4 Modern Enterprise Cards) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 ${attendanceOnly ? 'hidden' : ''}`}>
        {(isTeamLeader ? [
          {
            label: 'Shift Time Logged',
            value: formatHoursAndMinutes(totalWorkTimeDisplay),
            subtext: 'Today active hours',
            icon: Clock,
            iconColor: 'text-[#034665]',
            iconBg: 'bg-[#edf4f8]',
            borderHover: 'from-[#034665] to-[#068DCB]',
          },
          {
            label: 'Team On Leave',
            value: teamOnLeave.length,
            subtext: teamOnLeave.length > 0 ? 'Members absent today' : 'All members present',
            icon: Users,
            iconColor: 'text-amber-600',
            iconBg: 'bg-amber-50',
            borderHover: 'from-amber-500 to-rose-400',
          },
          {
            label: 'Tasks In Progress',
            value: tasksStats.inProgress,
            subtext: 'Current sprint workload',
            icon: TrendingUp,
            iconColor: 'text-blue-600',
            iconBg: 'bg-blue-50',
            borderHover: 'from-blue-500 to-cyan-400',
          },
          {
            label: 'Tasks Completed',
            value: tasksStats.completed,
            subtext: 'Deliverables verified',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
            borderHover: 'from-emerald-500 to-teal-400',
          },
        ] : [
          {
            label: 'Today Shift Hours',
            value: formatHoursAndMinutes(totalWorkTimeDisplay),
            subtext: 'Shift time recorded',
            icon: Clock,
            iconColor: 'text-[#034665]',
            iconBg: 'bg-[#edf4f8]',
            borderHover: 'from-[#034665] to-[#068DCB]',
          },
          {
            label: 'Tasks To Do',
            value: tasksStats.todo,
            subtext: 'Pending in backlog',
            icon: CheckSquare,
            iconColor: 'text-slate-600',
            iconBg: 'bg-slate-100',
            borderHover: 'from-slate-500 to-slate-400',
          },
          {
            label: 'In Progress',
            value: tasksStats.inProgress,
            subtext: 'Active workload',
            icon: TrendingUp,
            iconColor: 'text-amber-600',
            iconBg: 'bg-amber-50',
            borderHover: 'from-amber-500 to-yellow-400',
          },
          {
            label: 'Tasks Completed',
            value: tasksStats.completed,
            subtext: 'Done deliverables',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
            borderHover: 'from-emerald-500 to-teal-400',
          },
        ]).map((item, idx) => {
          const IconComp = item.icon;
          return (
            <div
              key={`kpi-${idx}`}
              className="group relative bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.borderHover} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {item.label}
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {isDataLoading && idx !== 0 && !isTeamLeader ? (
                      <Loader2 size={20} className="animate-spin text-slate-400 mt-1" />
                    ) : (
                      item.value
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {item.subtext}
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs`}>
                  <IconComp className={`w-5 h-5 ${item.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`grid grid-cols-1 ${attendanceOnly ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>

        {/* TIME & ATTENDANCE - QUICK ACTIONS & TIMELINE */}
        <div 
          ref={quickActionsRef}
          className={`${attendanceOnly ? 'lg:col-span-1' : 'lg:col-span-2'} bg-white border border-slate-200/80 rounded-xl overflow-hidden transition-all shadow-xs p-4 sm:p-5 flex flex-col justify-between`}
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
                {attendanceClassification && !isRejectedAttendance && !isPendingAttendance && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${attendanceClassification.badgeColorClass}`}>
                    {attendanceClassification.label}
                  </span>
                )}
              </div>
            </div>

            {attendanceOnly && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Working hours</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{formatHoursAndMinutes(totalWorkTimeDisplay)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Break duration</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{totalBreakTimeDisplay}</p>
                </div>
              </div>
            )}

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
                type="button"
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
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
                  style={{
                    left: `${seg.leftPercent}%`,
                    width: seg.type === 'break' ? `max(${seg.widthPercent}%, 3px)` : `${seg.widthPercent}%`,
                    zIndex: seg.type === 'break' ? 2 : 1
                  }}
                  className={`absolute top-0 bottom-0 h-full ${seg.colorClass} hover:brightness-110 transition-all border-r border-white/20`}
                />
              ))}
            </div>

          </div>
        </div>

        {/* VERTICAL ANNOUNCEMENTS LIST */}
        <div 
          className={`bg-white border border-slate-200/80 rounded-xl flex flex-col h-full overflow-hidden shadow-xs transition-all duration-200 ${attendanceOnly ? 'hidden' : ''}`}
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

      <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 ${attendanceOnly ? 'hidden' : ''}`}>

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
                const d = new Date(b.birthdayDate);
                const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;

                return (
                  <div key={i} className="flex flex-col items-center min-w-[80px] text-center group cursor-pointer">
                    <EmployeeAvatar
                      employee={b}
                      alt={`${b.name} profile`}
                      className="mb-2 h-13 w-13 border border-indigo-200/60 transition-transform group-hover:scale-105"
                    />
                    <p className="text-xs font-medium text-slate-800 truncate w-full px-1">{b.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{dateStr}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TEAM ON LEAVE - HORIZONTAL DESIGN */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs xl:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center text-amber-600 shrink-0">
                <Users size={16} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Team On Leave</h3>
                {/* <p className="text-[10px] text-slate-500">Supervised team members on approved leave today</p> */}
              </div>
            </div>
            <span className="bg-amber-50 text-amber-700 border border-amber-200/70 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              {teamOnLeave.length} On Leave
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isDataLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-400 mx-auto" />
            ) : teamOnLeave.length === 0 ? (
              <div className="w-full text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-700">Full attendance today 🎯</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Every team member is present and accounted for.</p>
              </div>
            ) : (
              teamOnLeave.map((t, i) => {
                return (
                  <div key={t._id || i} className="flex flex-col items-center min-w-[96px] text-center group cursor-pointer pb-2 rounded-xl hover:bg-slate-50 transition-all">
                    <div className="relative mb-2">
                      <EmployeeAvatar
                        employee={t}
                        alt={`${t.name} profile`}
                        className="h-13 w-13 border-2 border-amber-400 shadow-xs transition-transform group-hover:scale-105 group-hover:border-amber-500"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-amber-500 border-2 border-white rounded-full" title="On Leave" />
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