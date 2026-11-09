import { useState, useEffect, useRef } from 'react';
import { LoadingScreen, TableSkeleton } from "../../components/common/Loader.jsx";
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  CalendarDays,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Users,
  AlertCircle,
  ArrowUpDown,
  FileSpreadsheet,
  X,
  Briefcase,
  Coffee,
  PauseCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Loader2,
  FileText,
  SlidersHorizontal,
  XCircle,
  ShieldCheck,
  PlayCircle,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import {
  isFinanceOrExcludedUser,
  isUnknownEmployeeOrUser,
  filterOutUnknownUsers
} from '../../utils/roleFilters';
import { showToast } from '../../components/common/Toast';
import { useApp } from '../../context/AppContext';
import { BASE_URL } from '../../api/config.js';

const ATTENDANCE_URL =
  `${BASE_URL}/api/attendance/admin/all`;

const PENDING_URL =
  `${BASE_URL}/api/attendance/pending`;

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-sky-600',
  'bg-rose-600',
  'bg-violet-600',
  'bg-indigo-600',
  'bg-teal-600',
];

const WORKDAY_MINUTES = 9 * 60;

/* =========================================================
   GET TODAY & YESTERDAY
========================================================= */
const getTodayLocal = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getYesterdayLocal = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/* =========================================================
   NORMALIZE API RESPONSE
========================================================= */
export const normalizeLogs = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const nestedCandidates = [
    payload.data,
    payload.attendance,
    payload.logs,
    payload.records,
    payload.result,
    payload.items,
    payload.data?.data,
    payload.data?.attendance,
    payload.data?.logs,
    payload.data?.records,
    payload.data?.result,
    payload.data?.items,
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

/* =========================================================
   NORMALIZE CHECK-IN REQUESTS FROM /api/attendance/pending
========================================================= */
export const normalizeRequests = (payload) => {
  const arrayKeys = [
    'pendingRequests',
    'approvedRequests',
    'rejectedRequests',
    'pending',
    'approved',
    'rejected',
    'pendingAttendances',
    'approvedAttendances',
    'rejectedAttendances',
    'approvedCheckIns',
    'rejectedCheckIns',
    'checkIns',
    'checkInRequests',
    'attendanceRequests',
    'attendanceRecords',
    'allRequests',
    'allRecords',
    'allAttendances',
    'requests',
    'data',
    'attendance',
    'logs',
    'records',
    'result',
    'items',
  ];
  const envelopeKeys = ['data', 'result', 'payload', 'response', 'summary', 'attendance', 'requests', 'records', 'items'];
  const visited = new WeakSet();
  const records = [];

  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 5 || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) records.push(item);
      });
      return;
    }

    arrayKeys.forEach((key) => {
      if (!Array.isArray(value[key])) return;
      const statusHint = key.toLowerCase().startsWith('approved')
        ? 'approved'
        : key.toLowerCase().startsWith('rejected')
          ? 'rejected'
          : key.toLowerCase().startsWith('pending')
            ? 'pending'
            : '';

      value[key].forEach((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        records.push(statusHint ? { ...item, __approvalStatusHint: statusHint } : item);
      });
    });

    envelopeKeys.forEach((key) => {
      if (value[key] && typeof value[key] === 'object') visit(value[key], depth + 1);
    });

    if (value._id || value.id || value.userId || value.attendanceId) {
      records.push(value);
    }
  };

  visit(payload);
  return records;
};

/* =========================================================
   ATTENDANCE RECORD STATUS EVALUATORS
========================================================= */
export const isRecordApproved = (item) => {
  if (!item) return false;
  const s = String(item.approvalStatus || item.status || '').toLowerCase().trim();
  if (['approved', 'accepted', 'approved by admin'].includes(s)) return true;
  if (item.isApproved === true || item.isApprovedCheckIn === true) return true;
  if (Boolean(item.approvedCheckInTime) || Boolean(item.approvedBy) || Boolean(item.approverId)) return true;
  return false;
};

export const isRecordRejected = (item) => {
  if (!item) return false;
  const s = String(item.approvalStatus || item.status || item.attendanceStatus || item.adminDecision || item.decision || '').toLowerCase().trim();
  if (['rejected', 'declined', 'denied'].includes(s) || s.includes('reject')) return true;
  if (item.isRejected === true || item.isRejectedCheckIn === true) return true;
  if (Boolean(item.rejectionReason) || Boolean(item.rejectedBy)) return true;
  if (item.checkIn && typeof item.checkIn === 'object') {
    const cs = String(item.checkIn.approvalStatus || item.checkIn.status || '').toLowerCase().trim();
    if (['rejected', 'declined', 'denied'].includes(cs) || cs.includes('reject')) return true;
  }
  if (item.attendance && typeof item.attendance === 'object') {
    if (isRecordRejected(item.attendance)) return true;
  }
  return false;
};

export const isRecordPending = (item) => {
  if (!item) return false;
  if (isRecordRejected(item)) return false;
  const s = String(item.approvalStatus || item.status || item.attendanceStatus || item.adminDecision || item.decision || '').toLowerCase().trim();
  if (['pending', 'waiting for approval', 'waiting', 'pending approval'].includes(s) || s.includes('pending')) return true;
  if (item.isPending === true || item.isPendingCheckIn === true) return true;
  if (item.checkIn && typeof item.checkIn === 'object') {
    const cs = String(item.checkIn.approvalStatus || item.checkIn.status || '').toLowerCase().trim();
    if (['pending', 'waiting for approval', 'waiting'].includes(cs) || cs.includes('pending')) return true;
  }
  if (item.attendance && typeof item.attendance === 'object') {
    if (isRecordPending(item.attendance)) return true;
  }
  return false;
};

/* =========================================================
   FORMAT TIME
========================================================= */
const formatTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return value;
};

const getApprovalState = (item) => {
  if (isRecordRejected(item)) return 'rejected';
  if (isRecordPending(item)) return 'pending';
  if (isRecordApproved(item)) return 'approved';

  const rawCandidates = [
    item?.approvalStatus,
    item?.attendance?.approvalStatus,
    item?.status,
    item?.attendanceStatus,
    item?.attendance?.status,
    item?.adminDecision,
    item?.decision,
  ];

  for (const candidate of rawCandidates) {
    const normalized = String(candidate ?? '')
      .trim()
      .toLowerCase();

    if (!normalized) continue;

    if (['approved', 'approved by admin', 'accepted'].includes(normalized)) {
      return 'approved';
    }

    if (['pending', 'waiting for approval', 'waiting', 'pending approval'].includes(normalized) || normalized.includes('pending')) {
      return 'pending';
    }

    if (['rejected', 'declined', 'denied'].includes(normalized) || normalized.includes('reject')) {
      return 'rejected';
    }
  }

  return '';
};

const normalizeStatus = (item) => {
  const approvalState = getApprovalState(item);

  if (approvalState === 'pending') {
    return 'pending';
  }

  if (approvalState === 'rejected') {
    return 'rejected';
  }

  const rawStatus = String(
    item?.status ||
    item?.attendanceStatus ||
    item?.attendance?.status ||
    ''
  )
    .trim()
    .toLowerCase();

  if (rawStatus === 'onleave' || rawStatus === 'leave') {
    return 'on leave';
  }

  // Calculate status dynamically based on Check-In time (10:00-10:10 Present, 10:11-10:30 Late, 10:31-15:00 Half Day, >15:00 Absent)
  const checkInVal = item?.approvedCheckInTime || item?.checkInTime || item?.checkIn || item?.punchIn;
  const checkInMinutes = parseTimeToMinutes(checkInVal);

  if (checkInMinutes !== null) {
    const OFFICE_START = 10 * 60 + 10; // 10:10 AM (610 mins)
    const LATE_CUTOFF = 10 * 60 + 30;  // 10:30 AM (630 mins)
    const HALF_DAY_CUTOFF = 15 * 60;   // 3:00 PM / 15:00 (900 mins)

    if (checkInMinutes > HALF_DAY_CUTOFF) {
      return 'absent';
    }
    if (checkInMinutes > LATE_CUTOFF) {
      return 'half day';
    }
    if (checkInMinutes > OFFICE_START) {
      return 'late';
    }
    if (checkInMinutes <= OFFICE_START) {
      return 'on time';
    }
  }

  if (
    item?.isAbsent === true ||
    item?.absent === true ||
    rawStatus === 'absent' ||
    item?.isAbsentDueToLate
  ) {
    return 'absent';
  }

  // Parse working hours (< 8 hours is Half Day)
  const rawHours =
    item?.totalWorkTime ??
    item?.totalWorkTimeHours ??
    item?.totalHours ??
    item?.hours ??
    item?.workingHours ??
    0;

  let totalHours = 0;
  if (typeof rawHours === 'number') {
    totalHours = rawHours;
  } else if (typeof rawHours === 'string') {
    totalHours = parseFloat(rawHours) || 0;
  }

  const checkOutVal = item?.checkOutTime || item?.checkOut || item?.punchOut;
  const isCheckedOut = Boolean(checkOutVal) || totalHours > 0;

  if (
    rawStatus === 'half-day' ||
    rawStatus === 'halfday' ||
    rawStatus === 'half day' ||
    item?.isHalfDay === true ||
    (isCheckedOut && totalHours > 0 && totalHours < 8)
  ) {
    return 'half day';
  }

  if (item?.isLate === true || rawStatus === 'late') {
    return 'late';
  }

  if (
    rawStatus === 'present' ||
    rawStatus === 'on time'
  ) {
    return 'on time';
  }

  if (totalHours >= 8) {
    return 'on time';
  }

  return rawStatus || 'unknown';
};

/* =========================================================
   MAP API LOG
========================================================= */
const mapLog = (item, index) => {
  const breaks = [
    ...(Array.isArray(item?.breaks)
      ? item.breaks
      : item?.breaks
        ? [item.breaks]
        : []),
    ...(item?.breakStart || item?.breakEnd
      ? [
        {
          startTime: item.breakStart,
          endTime: item.breakEnd,
        },
      ]
      : []),
    ...(Array.isArray(item?.sessions)
      ? item.sessions
        .filter(
          (session) =>
            session?.breakStart || session?.breakEnd
        )
        .map((session) => ({
          startTime: session.breakStart,
          endTime: session.breakEnd,
        }))
      : []),
  ].filter((breakItem, breakIndex, allBreaks) => {
    const key = `${breakItem?.startTime || ''}-${breakItem?.endTime || ''
      }`;

    return (
      allBreaks.findIndex(
        (candidate) =>
          `${candidate?.startTime || ''}-${candidate?.endTime || ''
          }` === key
      ) === breakIndex
    );
  });

  const firstSession = Array.isArray(item?.sessions)
    ? item.sessions[0] || {}
    : {};

  const approvalStatus = getApprovalState(item);

  const rawStatus = String(
    item?.status ||
    item?.attendanceStatus ||
    item?.attendance?.status ||
    item?.adminDecision ||
    ''
  )
    .trim()
    .toLowerCase();

  const isRejected =
    isRecordRejected(item) ||
    approvalStatus === 'rejected' ||
    rawStatus === 'rejected' ||
    rawStatus === 'declined' ||
    item?.isRejected === true;

  const isPending =
    !isRejected && (
      isRecordPending(item) ||
      approvalStatus === 'pending' ||
      rawStatus === 'pending' ||
      item?.isPending === true
    );

  // =========================================================
  // AUTHENTIC CHECK-IN RESOLUTION (NO DUMMY / SYNTHETIC DATA)
  // =========================================================
  const rawCheckInVal =
    item?.approvedCheckInTime ||
    item?.checkInTime ||
    item?.punchIn ||
    firstSession.checkin ||
    null;

  const hasCheckIn = Boolean(
    rawCheckInVal &&
    rawCheckInVal !== '—' &&
    rawCheckInVal !== '--:--'
  );

  const isApproved =
    !isRejected &&
    !isPending &&
    hasCheckIn && (
      approvalStatus === 'approved' ||
      rawStatus === 'approved' ||
      rawStatus === 'accepted' ||
      item?.isApproved === true ||
      item?.isApprovedCheckIn === true ||
      ['present', 'late', 'on time', 'half day', 'half-day', 'working', 'completed', 'checked_out', 'checked out'].includes(rawStatus)
    );

  const approvedCheckIn = isApproved ? rawCheckInVal : '';

  const rawCheckOutVal =
    item?.checkOutTime ||
    item?.punchOut ||
    firstSession.checkout ||
    '';

  const approvedCheckOut = isApproved ? rawCheckOutVal : '';

  const approvedBreaks = isApproved ? breaks : [];

  const finalApprovalStatus = isApproved
    ? 'approved'
    : isRejected
      ? 'rejected'
      : isPending
        ? 'pending'
        : (hasCheckIn ? (approvalStatus || 'pending') : (rawStatus === 'on leave' || rawStatus === 'leave' ? 'on leave' : (rawStatus === 'absent' ? 'absent' : (approvalStatus || 'not_checked_in'))));

  const finalStatus = isRejected
    ? 'rejected'
    : isPending
      ? 'pending'
      : (hasCheckIn && isApproved
        ? normalizeStatus(item)
        : (rawStatus === 'on leave' || rawStatus === 'leave' ? 'on leave' : 'absent'));

  return {
    id:
      item?._id ||
      item?.id ||
      `log-${index}`,

    employeeId:
      item?.userId?._id ||
      (typeof item?.userId === 'string' ? item.userId : '') ||
      item?.employee?._id ||
      item?.employee?.id ||
      item?.employeeId?._id ||
      item?.employeeId?.id ||
      (typeof item?.employeeId === 'string' ? item.employeeId : '') ||
      item?.user?._id ||
      item?.user?.id ||
      '',

    name:
      item?.employeeName ||
      item?.name ||
      item?.user?.name ||
      item?.employee?.name ||
      item?.employeeId?.name ||
      'Unknown Employee',

    email:
      item?.email ||
      item?.user?.email ||
      item?.employee?.email ||
      item?.employeeId?.email ||
      '',

    date:
      item?.date ||
      item?.attendanceDate ||
      item?.createdAt ||
      '',

    // =======================================================
    // ONLY APPROVED CHECK-IN IS USED BY TIMELINE
    // =======================================================
    checkIn: approvedCheckIn,

    // =======================================================
    // CHECK-OUT ONLY AFTER APPROVAL
    // =======================================================
    checkOut: approvedCheckOut,

    // =======================================================
    // BREAKS ONLY AFTER APPROVAL
    // =======================================================
    breaks: approvedBreaks,

    totalHours: isApproved
      ? (
        item?.totalWorkTimeDisplay ||
        item?.totalWorkTimeHours ||
        item?.totalHours ||
        item?.hours ||
        '0h'
      )
      : '0h',

    isLate: isApproved && item?.isLate === true,

    approvalStatus: finalApprovalStatus,

    status: finalStatus,

    rejectionReason:
      item?.rejectionReason ||
      item?.reason ||
      item?.attendance?.rejectionReason ||
      '',

    avatarColor:
      item?.avatarColor ||
      AVATAR_COLORS[index % AVATAR_COLORS.length],
  };
};

/* =========================================================
   FORMAT INDIAN DATE
========================================================= */
const formatIndianDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatTableDate = (value) => {
  if (!value) return '—';
  const parts = String(value).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
  }
  return value;
};

const formatHeaderDate = (value) => {
  if (!value) return '';
  const parts = String(value).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return value;
};

/* =========================================================
   PARSE TIME TO MINUTES
========================================================= */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '—') {
    return null;
  }

  const date = new Date(timeStr);

  if (!Number.isNaN(date.getTime())) {
    return date.getHours() * 60 + date.getMinutes();
  }

  try {
    const timeParts = String(timeStr).match(
      /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
    );

    if (timeParts) {
      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const ampm = timeParts[4];

      if (ampm) {
        if (
          ampm.toUpperCase() === 'PM' &&
          hours !== 12
        ) {
          hours += 12;
        }

        if (
          ampm.toUpperCase() === 'AM' &&
          hours === 12
        ) {
          hours = 0;
        }
      }

      return hours * 60 + minutes;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const formatMinutes = (minutes) => {
  return `${String(Math.floor(minutes / 60)).padStart(
    2,
    '0'
  )}:${String(minutes % 60).padStart(2, '0')}`;
};

const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0m';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}m`.trim();
};

/* =========================================================
   ATTENDANCE TIMELINE CALCULATION
========================================================= */
const calculateAttendanceProgress = (
  checkIn,
  breaks = [],
  checkOut
) => {
  const checkInMinutes = parseTimeToMinutes(checkIn);
  const checkOutMinutes = parseTimeToMinutes(checkOut);

  if (checkInMinutes === null) {
    return [];
  }

  const now = new Date();
  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  const activeEnd = Math.min(
    checkOutMinutes !== null
      ? checkOutMinutes
      : currentMinutes,
    checkInMinutes + WORKDAY_MINUTES
  );

  if (activeEnd <= checkInMinutes) {
    return [];
  }

  const segments = [];
  let currentTime = checkInMinutes;

  const normalizedBreaks = breaks
    .map((item) => ({
      start: parseTimeToMinutes(
        item?.startTime ||
        item?.startTimeFullDisplay ||
        item?.startTimeDisplay
      ),
      end: parseTimeToMinutes(
        item?.endTime ||
        item?.endTimeFullDisplay ||
        item?.endTimeDisplay
      ),
    }))
    .filter(
      (item) =>
        item.start !== null &&
        item.end !== null &&
        item.start >= checkInMinutes &&
        item.start < activeEnd &&
        item.end > item.start
    )
    .sort((a, b) => a.start - b.start);

  const addSegment = (
    start,
    end,
    color,
    label,
    startTime,
    endTime
  ) => {
    if (end > start) {
      segments.push({
        start,
        end,
        color,
        label,
        startTime,
        endTime,
      });
    }
  };

  const MAX_ALLOWED_BREAK_MINUTES = 60; // 1 Hour Allowed Break
  let accumulatedBreakMinutes = 0;

  normalizedBreaks.forEach((breakItem) => {
    const breakStart = breakItem.start;
    const breakEnd = Math.min(
      breakItem.end ?? activeEnd,
      activeEnd
    );

    if (breakStart > currentTime) {
      addSegment(
        currentTime,
        breakStart,
        'blue',
        'Working',
        currentTime === checkInMinutes
          ? formatTime(checkIn)
          : formatMinutes(currentTime),
        formatMinutes(breakStart)
      );
    }

    if (breakEnd > breakStart) {
      const breakDuration = breakEnd - breakStart;
      const availableAllowance = Math.max(0, MAX_ALLOWED_BREAK_MINUTES - accumulatedBreakMinutes);

      if (availableAllowance >= breakDuration) {
        // Entire break is within the 1-hour allowance
        addSegment(
          breakStart,
          breakEnd,
          'yellow',
          'Break',
          formatMinutes(breakStart),
          formatMinutes(breakEnd)
        );
      } else if (availableAllowance > 0) {
        // Break starts within allowance and exceeds 1 hour
        const splitTime = breakStart + availableAllowance;
        addSegment(
          breakStart,
          splitTime,
          'yellow',
          'Break',
          formatMinutes(breakStart),
          formatMinutes(splitTime)
        );
        addSegment(
          splitTime,
          breakEnd,
          'gray',
          'Idle',
          formatMinutes(splitTime),
          formatMinutes(breakEnd)
        );
      } else {
        // 1-hour allowance is already exhausted; entire duration is Idle
        addSegment(
          breakStart,
          breakEnd,
          'gray',
          'Idle',
          formatMinutes(breakStart),
          formatMinutes(breakEnd)
        );
      }

      accumulatedBreakMinutes += breakDuration;
      currentTime = breakEnd;
    }
  });

  addSegment(
    currentTime,
    activeEnd,
    'blue',
    'Working',
    currentTime === checkInMinutes
      ? formatTime(checkIn)
      : formatMinutes(currentTime),
    checkOutMinutes !== null && activeEnd === checkOutMinutes
      ? formatTime(checkOut)
      : formatMinutes(activeEnd)
  );

  return segments;
};

/* =========================================================
   TIMELINE COMPONENT
========================================================= */
const AttendanceTimeline = ({
  checkIn,
  breaks,
  checkOut,
  approvalStatus,
  status,
  rejectionReason = '',
}) => {
  const isRejected =
    approvalStatus === 'rejected' ||
    status === 'rejected';

  const isPending =
    !isRejected && (
      approvalStatus === 'pending' ||
      status === 'pending'
    );

  const isOnLeave =
    status === 'on leave' ||
    status === 'leave';

  if (isRejected) {
    return (
      <div
        className="w-full max-w-[420px] bg-rose-50/70 border border-rose-200/80 text-rose-700 h-7 rounded-md flex items-center justify-center gap-1.5 px-3 text-[11px] font-medium font-poppins select-none shadow-2xs"
        title={rejectionReason ? `Reason: ${rejectionReason}` : 'Admin rejects the check in'}
      >
        <XCircle size={13} className="text-rose-500 shrink-0" />
        <span className="truncate">Admin rejects the check in</span>
      </div>
    );
  }

  if (isPending) {
    return (
      <div
        className="w-full max-w-[420px] bg-amber-50/70 border border-amber-200/80 text-amber-700 h-7 rounded-md flex items-center justify-center gap-1.5 px-3 text-[11px] font-medium font-poppins select-none shadow-2xs"
        title="Check-in request waiting for admin approval"
      >
        <Clock size={13} className="text-amber-500 shrink-0" />
        <span className="truncate">Pending request</span>
      </div>
    );
  }

  if (isOnLeave) {
    return (
      <div className="w-full max-w-[420px] bg-purple-50/70 border border-purple-200/80 text-purple-700 h-7 rounded-md flex items-center justify-center gap-1.5 px-3 text-[11px] font-medium font-poppins select-none shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
        <span className="truncate">On Leave</span>
      </div>
    );
  }

  // =========================================================
  // NEVER RUN TIMER UNTIL APPROVED AND VALID CHECK-IN EXISTS
  // =========================================================
  if (approvalStatus !== 'approved' || !checkIn || checkIn === '—' || checkIn === '--:--') {
    return (
      <div className="w-full max-w-[420px] bg-slate-50 h-7 rounded-md flex items-center justify-center text-[11px] text-slate-400 font-medium border border-slate-200/50 select-none">
        No timeline data available
      </div>
    );
  }

  const segments = calculateAttendanceProgress(
    checkIn,
    breaks,
    checkOut
  );

  const totalDuration = WORKDAY_MINUTES;

  if (segments.length === 0) {
    return (
      <div className="w-full max-w-[420px] bg-slate-50 h-7 rounded-md flex items-center justify-center text-[11px] text-slate-400 font-medium border border-slate-200/50 select-none">
        No timeline data available
      </div>
    );
  }

  const hasValidCheckOut = Boolean(checkOut && checkOut !== '—' && checkOut !== '--:--');
  const isBreakActive = Boolean(breaks && Array.isArray(breaks) && breaks.some((b) => b.startTime && !b.endTime));
  const currentStatusLabel = hasValidCheckOut ? 'Completed' : (isBreakActive ? 'Break' : 'Working');
  const currentStatusColor = hasValidCheckOut ? 'text-slate-500' : (isBreakActive ? 'text-[#eab308]' : 'text-[#0284c7]');

  return (
    <div className="space-y-1 min-w-[280px] max-w-[420px] font-poppins">
      {/* Top line: In, Out, and Working/Break Status */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2 font-normal">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>In: <strong className="font-semibold text-slate-700">{formatTime(checkIn)}</strong></span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Out: <strong className="font-semibold text-slate-700">{hasValidCheckOut ? formatTime(checkOut) : '-'}</strong></span>
          </span>
        </div>

        <span className={`text-[11px] font-semibold ${currentStatusColor}`}>
          {currentStatusLabel}
        </span>
      </div>

      {/* Middle line: Progress Bar */}
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-slate-200">
        {segments.map((segment, idx) => {
          const width =
            ((segment.end - segment.start) /
              totalDuration) *
            100;

          return (
            <div
              key={idx}
              className={`h-full absolute top-0 left-0 transition-all duration-150 rounded-full ${
                segment.color === 'yellow'
                  ? 'bg-[#eab308]'
                  : segment.color === 'gray'
                    ? 'bg-slate-400'
                    : 'bg-[#0284c7]'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, width))}%`,
                left: `${Math.min(100, Math.max(0, ((segment.start - segments[0].start) / totalDuration) * 100))}%`,
              }}
              title={`${segment.label}: ${segment.startTime} - ${segment.endTime}`}
            />
          );
        })}
      </div>

      {/* Bottom line: Check-In & Check-Out Icons */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
        <span className="flex items-center gap-1 text-emerald-600 font-medium">
          <LogIn size={11} className="text-emerald-500" />
          Check-In
        </span>
        <span className="flex items-center gap-1 text-rose-500 font-medium">
          <LogOut size={11} className="text-rose-400" />
          Check-Out
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function AttendanceLogs() {
  const navigate = useNavigate();
  const { userRole } = useApp() || {};
  const canManageFinalization = userRole === 'admin' || userRole === 'hr';
  const [selectedDate, setSelectedDate] =
    useState(getTodayLocal());

  const [logs, setLogs] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [searchTerm, setSearchTerm] =
    useState('');

  const [showFilters, setShowFilters] =
    useState(false);

  const [filterStatus, setFilterStatus] =
    useState('all');

  const [sortField, setSortField] =
    useState('date');

  const [sortOrder, setSortOrder] =
    useState('desc');

  const [selectedLog, setSelectedLog] =
    useState(null);

  const [showExportOptions, setShowExportOptions] =
    useState(false);
  const [showPolicyModal, setShowPolicyModal] =
    useState(false);

  const [exportingMonth, setExportingMonth] =
    useState(false);

  const dateInputRef = useRef(null);
  const [allStaffUsers, setAllStaffUsers] = useState([]);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'history'

  // Historical Explorer (Old Logs across range) State
  const [historyFromDate, setHistoryFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [historyToDate, setHistoryToDate] = useState(getTodayLocal());
  const [historySelectedUser, setHistorySelectedUser] = useState('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyProgress, setHistoryProgress] = useState(0);

  // Employee-Specific History Modal State
  const [employeeHistoryModal, setEmployeeHistoryModal] = useState(null);
  const [employeeHistoryList, setEmployeeHistoryList] = useState([]);
  const [loadingEmpHistory, setLoadingEmpHistory] = useState(false);
  const [empHistoryMonth, setEmpHistoryMonth] = useState('all');
  const [empHistorySearch, setEmpHistorySearch] = useState('');
  const [empHistoryStatus, setEmpHistoryStatus] = useState('all');

  // Daily Finalization & 4:00 PM IST Scheduler State
  const [finalizeTargetDate, setFinalizeTargetDate] = useState(() => getTodayLocal());
  const [finalizePreview, setFinalizePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isExecutingFinalize, setIsExecutingFinalize] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState(null);
  const [schedulerLogs, setSchedulerLogs] = useState([]);
  const [loadingScheduler, setLoadingScheduler] = useState(false);
  const [schedulerError, setSchedulerError] = useState('');
  const [schedulerPage, setSchedulerPage] = useState(1);
  const [schedulerTotalPages, setSchedulerTotalPages] = useState(1);
  const [schedulerTotalCount, setSchedulerTotalCount] = useState(0);

  const fetchFinalizePreview = async (targetDate = finalizeTargetDate) => {
    setLoadingPreview(true);
    setPreviewError('');
    try {
      const tok = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/attendance/finalize-daily/preview?date=${encodeURIComponent(targetDate)}&_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to preview finalization: ${res.status}`);
      }
      const data = await res.json();
      setFinalizePreview(data);
    } catch (err) {
      console.warn('Finalize preview error:', err);
      setPreviewError(err.message || 'Unable to fetch finalization preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteFinalize = async (targetDate = finalizeTargetDate) => {
    setIsExecutingFinalize(true);
    setFinalizeResult(null);
    try {
      const tok = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/attendance/finalize-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Finalization failed: ${res.status}`);
      }
      setFinalizeResult({
        type: 'success',
        message: data?.message || `Daily attendance finalization for ${targetDate} executed successfully!`,
        data: data?.data || data?.summary || data,
      });
      showToast(data?.message || 'Daily attendance finalization completed successfully!', 'success');
      // Refresh current attendance logs, preview, and scheduler logs
      fetchAttendanceLogs(selectedDate, true);
      fetchFinalizePreview(targetDate);
      fetchSchedulerLogs(1);
      window.dispatchEvent(new Event('attendance_updated'));
    } catch (err) {
      console.error('Finalize execute error:', err);
      setFinalizeResult({
        type: 'error',
        message: err.message || 'Daily finalization failed to execute.',
      });
      showToast(err.message || 'Daily finalization failed', 'error');
    } finally {
      setIsExecutingFinalize(false);
    }
  };

  const fetchSchedulerLogs = async (page = 1) => {
    setLoadingScheduler(true);
    setSchedulerError('');
    try {
      const tok = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/attendance/scheduler/logs?page=${page}&limit=10&_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch scheduler logs: ${res.status}`);
      }
      const data = await res.json();
      
      const extractLogs = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        if (Array.isArray(payload.logs)) return payload.logs;
        if (Array.isArray(payload.records)) return payload.records;
        if (Array.isArray(payload.items)) return payload.items;
        if (Array.isArray(payload.data)) return payload.data;
        if (payload.data && typeof payload.data === 'object') {
          if (Array.isArray(payload.data.logs)) return payload.data.logs;
          if (Array.isArray(payload.data.records)) return payload.data.records;
          if (Array.isArray(payload.data.items)) return payload.data.items;
          if (Array.isArray(payload.data.data)) return payload.data.data;
        }
        return [];
      };

      const logs = extractLogs(data);
      const safeLogs = Array.isArray(logs) ? logs : [];
      setSchedulerLogs(safeLogs);

      const total =
        data?.total ??
        data?.totalLogs ??
        data?.count ??
        data?.data?.total ??
        data?.data?.totalLogs ??
        data?.data?.count ??
        safeLogs.length;

      const totalPages =
        data?.totalPages ??
        data?.data?.totalPages ??
        Math.max(1, Math.ceil(total / 10));

      const currentPage =
        data?.page ??
        data?.currentPage ??
        data?.data?.page ??
        data?.data?.currentPage ??
        page;

      setSchedulerPage(currentPage);
      setSchedulerTotalPages(totalPages);
      setSchedulerTotalCount(total);
    } catch (err) {
      console.warn('Scheduler logs fetch error:', err);
      setSchedulerLogs([]);
      setSchedulerError(err.message || 'Unable to load scheduler execution logs.');
    } finally {
      setLoadingScheduler(false);
    }
  };

  const token =
    typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || localStorage.getItem('token'))
      : null;

  /* =========================================================
     FETCH ATTENDANCE
  ========================================================= */
  const fetchAttendanceLogs = async (
    date = selectedDate,
    isSilent = false
  ) => {
    if (!isSilent) {
      setLoading(true);
      setError('');
    }

    try {
      if (!token) {
        setError(
          'Please login to view attendance logs.'
        );
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // 1. Fetch attendance records for selected date (with cache busting)
      let attendanceItems = [];
      try {
        const url = `${ATTENDANCE_URL}?date=${encodeURIComponent(date)}&_t=${Date.now()}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          attendanceItems = normalizeLogs(data);
        }
      } catch (aErr) {
        console.warn('Attendance logs fetch error:', aErr);
      }

      // 1b. Fetch check-in requests (pending / approved / rejected) from /api/attendance/pending
      let requestItems = [];
      try {
        const pUrl = `${PENDING_URL}?_t=${Date.now()}`;
        const pResponse = await fetch(pUrl, {
          method: 'GET',
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
          cache: 'no-store',
        });
        if (pResponse.ok) {
          const pData = await pResponse.json();
          requestItems = normalizeRequests(pData);
        }
      } catch (pErr) {
        console.warn('Pending requests fetch error:', pErr);
      }

      // 1c. Load local persistent rejection store (synced from Check-In Requests actions)
      let localRejected = [];
      try {
        const rawStore = localStorage.getItem('kt_rejected_attendance_store');
        if (rawStore) {
          localRejected = JSON.parse(rawStore);
          if (!Array.isArray(localRejected)) localRejected = [];
        }
      } catch {}

      // 1d. Load local persistent approval store (synced from Check-In Requests approvals)
      let localApproved = [];
      try {
        const rawApp = localStorage.getItem('kt_approved_attendance_store');
        if (rawApp) {
          localApproved = JSON.parse(rawApp);
          if (!Array.isArray(localApproved)) localApproved = [];
        }
      } catch {}

      const isDateMatch = (recordDate, targetDate) => {
        if (!recordDate || !targetDate) return false;
        const rStr = String(recordDate).trim();
        if (rStr.startsWith(targetDate)) return true;
        const d = new Date(recordDate);
        if (!Number.isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          if (`${y}-${m}-${day}` === targetDate) return true;
        }
        const parts = rStr.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4 && `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}` === targetDate) return true;
          if (parts[2].length === 4) {
            const y = parts[2];
            const p1 = parts[0].padStart(2, '0');
            const p2 = parts[1].padStart(2, '0');
            if (`${y}-${p2}-${p1}` === targetDate || `${y}-${p1}-${p2}` === targetDate) return true;
          }
        }
        return false;
      };

      // Filter requestItems and localRejected for selected date
      const relevantRequests = requestItems.filter((req) => {
        if (!req) return false;
        const rDate = req.date || req.attendanceDate || req.createdAt || req.requestedTime;
        return isDateMatch(rDate, date) || (!rDate && date === getTodayLocal());
      });

      const relevantLocalRejected = localRejected.filter((rej) => {
        if (!rej) return false;
        return isDateMatch(rej.date, date) || (!rej.date && date === getTodayLocal()) || (rej.rejectedAt && isDateMatch(rej.rejectedAt, date));
      });

      const relevantLocalApproved = localApproved.filter((app) => {
        if (!app) return false;
        return isDateMatch(app.date, date) || (!app.date && date === getTodayLocal()) || (app.approvedAt && isDateMatch(app.approvedAt, date));
      });

      // Build quick lookup map by all possible user identifier keys (lowercased)
      const userRequestMap = new Map();
      const registerUserRequest = (userKeys, reqObj) => {
        userKeys.filter(Boolean).map((k) => String(k).toLowerCase().trim()).forEach((k) => {
          if (!userRequestMap.has(k) || isRecordRejected(reqObj) || isRecordApproved(reqObj)) {
            userRequestMap.set(k, reqObj);
          }
        });
      };

      relevantRequests.forEach((req) => {
        const uKeys = [
          req.userId?._id,
          req.userId?.id,
          req.userId,
          req.user?._id,
          req.user?.id,
          req.employee?._id,
          req.employee?.id,
          req.employeeId?._id,
          req.employeeId?.id,
          req.employeeId,
          req.employeeID,
          req.email,
          req.user?.email,
          req.employee?.email,
          req.name,
          req.employeeName,
          req.user?.name,
          req.employee?.name,
          req._id,
          req.id,
          req.attendanceId,
        ];
        registerUserRequest(uKeys, req);
      });

      relevantLocalApproved.forEach((app) => {
        const uKeys = [
          app.userId,
          app.employeeUserId,
          app.attendanceId,
          app.id,
          app.email,
          app.name,
        ];
        registerUserRequest(uKeys, {
          ...app,
          approvalStatus: 'approved',
          status: app.status || 'present',
          isApproved: true,
        });
      });

      relevantLocalRejected.forEach((rej) => {
        const uKeys = [
          rej.userId,
          rej.attendanceId,
          rej.email,
          rej.name,
        ];
        registerUserRequest(uKeys, {
          ...rej,
          approvalStatus: 'rejected',
          status: 'rejected',
          isRejected: true,
          rejectionReason: rej.reason || 'Attendance rejected by admin',
        });
      });

      // Map attendance items by canonical ID and build lookup index for all identifiers
      const attendanceMap = new Map();
      const userLookupMap = new Map();

      attendanceItems.forEach((item) => {
        if (!item || isFinanceOrExcludedUser(item) || isUnknownEmployeeOrUser(item)) return;
        if (item.user && (isFinanceOrExcludedUser(item.user) || isUnknownEmployeeOrUser(item.user))) return;
        if (item.employee && (isFinanceOrExcludedUser(item.employee) || isUnknownEmployeeOrUser(item.employee))) return;
        if (item.userId && (isFinanceOrExcludedUser(item.userId) || isUnknownEmployeeOrUser(item.userId))) return;

        const canonicalKey = String(
          item?.userId?._id ||
          item?.userId ||
          item?.employee?._id ||
          item?.user?._id ||
          item?._id
        );

        const candidateKeys = [
          canonicalKey,
          item?._id,
          item?.id,
          item?.employee?._id,
          item?.employee?.id,
          item?.employee?.employeeId,
          item?.user?._id,
          item?.user?.id,
          item?.userId?._id,
          item?.userId?.id,
          item?.userId,
          item?.employeeId,
          item?.employee?.email,
          item?.user?.email,
          item?.email,
          item?.employee?.name,
          item?.user?.name,
          item?.employeeName,
          item?.name,
        ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

        candidateKeys.forEach((k) => {
          if (!userLookupMap.has(k)) {
            userLookupMap.set(k, canonicalKey);
          }
        });

        // Check if there is a matching pending or rejected request for this user
        const matchedReq = candidateKeys.reduce((found, k) => found || userRequestMap.get(k), null);
        let enhancedItem = item;
        if (matchedReq) {
          const reqIsRej = isRecordRejected(matchedReq) || matchedReq.approvalStatus === 'rejected';
          const reqIsApp = !reqIsRej && (isRecordApproved(matchedReq) || matchedReq.approvalStatus === 'approved');
          const reqIsPend = !reqIsRej && !reqIsApp && (isRecordPending(matchedReq) || matchedReq.approvalStatus === 'pending');
          if (reqIsRej) {
            enhancedItem = {
              ...item,
              approvalStatus: 'rejected',
              status: 'rejected',
              isRejected: true,
              rejectionReason: matchedReq.rejectionReason || matchedReq.reason || item.rejectionReason || 'Attendance rejected by admin',
            };
          } else if (reqIsApp) {
            enhancedItem = {
              ...item,
              approvalStatus: 'approved',
              status: matchedReq.status || (item.status && item.status !== 'absent' ? item.status : 'present'),
              checkInTime: matchedReq.checkInTime || item.checkInTime,
              checkInTimeDisplay: matchedReq.checkInTimeDisplay || item.checkInTimeDisplay,
              isApproved: true,
            };
          } else if (reqIsPend && !isRecordApproved(item)) {
            enhancedItem = {
              ...item,
              approvalStatus: 'pending',
              status: 'pending',
              isPending: true,
            };
          }
        }

        if (!attendanceMap.has(canonicalKey)) {
          attendanceMap.set(canonicalKey, enhancedItem);
        } else {
          const existing = attendanceMap.get(canonicalKey);
          if (enhancedItem.approvalStatus === 'rejected') {
            attendanceMap.set(canonicalKey, { ...existing, ...enhancedItem });
          }
        }
      });

      // 2. Fetch all users from /users/all to guarantee HR, TL, Employee are all in table (Excluding Admin & Finance)
      try {
        const usersUrl = `${BASE_URL}/api/users/all`;
        const usersRes = await fetch(usersUrl, { method: 'GET', headers });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersList = usersData.users || usersData.data || [];
          const validUsers = usersList.filter((user) => user && user._id && !isFinanceOrExcludedUser(user) && !isUnknownEmployeeOrUser(user));
          setAllStaffUsers(validUsers);
          usersList.forEach((user) => {
            if (!user || !user._id || isFinanceOrExcludedUser(user) || isUnknownEmployeeOrUser(user)) return;

            const userKeys = [
              user._id,
              user.id,
              user.employeeId,
              user.uniqueID,
              user.email,
              user.name,
            ].filter(Boolean).map((x) => String(x).toLowerCase().trim());

            const matchedReq = userKeys.reduce((found, k) => found || userRequestMap.get(k), null);
            const reqIsRej = matchedReq && (isRecordRejected(matchedReq) || matchedReq.approvalStatus === 'rejected');
            const reqIsApp = !reqIsRej && matchedReq && (isRecordApproved(matchedReq) || matchedReq.approvalStatus === 'approved');
            const reqIsPend = !reqIsRej && !reqIsApp && matchedReq && (isRecordPending(matchedReq) || matchedReq.approvalStatus === 'pending');

            const matchedCanonical = userKeys.reduce((found, k) => found || userLookupMap.get(k), null);
            if (!matchedCanonical || !attendanceMap.has(matchedCanonical)) {
              const uIdKey = String(user._id);
              attendanceMap.set(uIdKey, {
                _id: user._id,
                employee: {
                  _id: user._id,
                  name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || 'Unknown User',
                  uniqueID: user.uniqueID || '',
                  email: user.email || '',
                  department: user.department || '',
                  role: user.role || 'employee',
                },
                user: {
                  _id: user._id,
                  name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || 'Unknown User',
                  uniqueID: user.uniqueID || '',
                  email: user.email || '',
                  department: user.department || '',
                  role: user.role || 'employee',
                },
                date,
                status: reqIsRej ? 'rejected' : (reqIsApp ? (matchedReq.status || 'present') : (reqIsPend ? 'pending' : 'absent')),
                approvalStatus: reqIsRej ? 'rejected' : (reqIsApp ? 'approved' : (reqIsPend ? 'pending' : 'not_checked_in')),
                rejectionReason: reqIsRej ? (matchedReq.rejectionReason || matchedReq.reason || 'Attendance rejected by admin') : '',
                checkInTime: matchedReq?.checkInTime || matchedReq?.requestedTime || null,
                checkOutTime: null,
                totalWorkTime: 0,
                totalBreakTime: 0,
                breaks: [],
              });
              userKeys.forEach((k) => userLookupMap.set(k, uIdKey));
            } else {
              // User already in attendanceMap (e.g. from attendanceItems as absent or pending)
              const existing = attendanceMap.get(matchedCanonical);
              if (reqIsRej && existing.approvalStatus !== 'approved') {
                attendanceMap.set(matchedCanonical, {
                  ...existing,
                  status: 'rejected',
                  approvalStatus: 'rejected',
                  rejectionReason: matchedReq.rejectionReason || matchedReq.reason || 'Attendance rejected by admin',
                });
              } else if (reqIsApp) {
                attendanceMap.set(matchedCanonical, {
                  ...existing,
                  status: matchedReq.status || 'present',
                  approvalStatus: 'approved',
                  checkInTime: matchedReq?.checkInTime || existing.checkInTime,
                  checkInTimeDisplay: matchedReq?.checkInTimeDisplay || existing.checkInTimeDisplay,
                });
              } else if (reqIsPend && existing.approvalStatus !== 'approved' && existing.approvalStatus !== 'rejected') {
                attendanceMap.set(matchedCanonical, {
                  ...existing,
                  status: 'pending',
                  approvalStatus: 'pending',
                });
              }
            }
          });
        }
      } catch (uErr) {
        console.warn('Users fetch error:', uErr);
      }

      // Real backend data only: purge any legacy adjustment caches from localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.removeItem("attendance_adjustments");
        }
      } catch { }

      // Filter out admin & finance users and unknown employees from attendance logs list
      const combinedLogs = Array.from(attendanceMap.values()).filter((item) => {
        if (!item || isFinanceOrExcludedUser(item) || isUnknownEmployeeOrUser(item)) return false;
        if (item.user && (isFinanceOrExcludedUser(item.user) || isUnknownEmployeeOrUser(item.user))) return false;
        if (item.employee && (isFinanceOrExcludedUser(item.employee) || isUnknownEmployeeOrUser(item.employee))) return false;
        if (item.userId && (isFinanceOrExcludedUser(item.userId) || isUnknownEmployeeOrUser(item.userId))) return false;
        return true;
      });

      const mappedLogs = combinedLogs
        .map(mapLog)
        .filter((log) => log && log.name && !isUnknownEmployeeOrUser(log.name));

      setLogs(mappedLogs);
    } catch (err) {
      console.error(
        'Attendance fetch error:',
        err
      );

      if (!isSilent) {
        setError(
          'Unable to load attendance logs.'
        );
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  /* =========================================================
     DATE CHANGE FETCH & OLD LOG AUTO-REFRESH GUARD
  ========================================================= */
  useEffect(() => {
    fetchAttendanceLogs(selectedDate, false);

    // Silent background auto-refresh every 10s ONLY for today's logs (disabled for historical dates)
    const isToday = selectedDate === getTodayLocal();
    let interval = null;
    if (isToday && viewMode === 'daily') {
      interval = setInterval(() => {
        fetchAttendanceLogs(selectedDate, true);
      }, 10000);
    }

    const handleAdjustmentUpdate = () => {
      fetchAttendanceLogs(selectedDate, true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAttendanceLogs(selectedDate, true);
      }
    };

    window.addEventListener("attendanceAdjusted", handleAdjustmentUpdate);
    window.addEventListener("attendance_adjusted", handleAdjustmentUpdate);
    window.addEventListener("attendance_updated", handleAdjustmentUpdate);
    window.addEventListener("storage", handleAdjustmentUpdate);
    window.addEventListener("focus", handleAdjustmentUpdate);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("attendanceAdjusted", handleAdjustmentUpdate);
      window.removeEventListener("attendance_adjusted", handleAdjustmentUpdate);
      window.removeEventListener("attendance_updated", handleAdjustmentUpdate);
      window.removeEventListener("storage", handleAdjustmentUpdate);
      window.removeEventListener("focus", handleAdjustmentUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, viewMode]);

  /* =========================================================
     OLD LOG DATE NAVIGATION HELPERS
  ========================================================= */
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleJumpToday = () => {
    setSelectedDate(getTodayLocal());
  };

  const handleJumpYesterday = () => {
    setSelectedDate(getYesterdayLocal());
  };

  const fetchLogs = (date = selectedDate, isSilent = false) => {
    fetchAttendanceLogs(date, isSilent);
  };

  /* =========================================================
     INDIVIDUAL EMPLOYEE OLD LOGS / ATTENDANCE HISTORY
  ========================================================= */
  const fetchEmployeeHistory = async (targetUser, month = 'all') => {
    const uId = targetUser._id || targetUser.employeeId || targetUser.id;
    if (!uId || !token) return;
    setLoadingEmpHistory(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let url = `${BASE_URL}/api/attendance/history/${uId}`;
      if (month && month !== 'all') {
        url = `${BASE_URL}/api/attendance/history/month/${uId}/${month}`;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const records = data.attendance || data.data || normalizeLogs(data);
        const mapped = records.map(mapLog);
        mapped.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setEmployeeHistoryList(mapped);
      } else {
        setEmployeeHistoryList([]);
      }
    } catch (err) {
      console.warn('Failed to fetch employee attendance history:', err);
      setEmployeeHistoryList([]);
    } finally {
      setLoadingEmpHistory(false);
    }
  };

  const openEmployeeHistoryModal = (log) => {
    const userObj = {
      _id: log.employeeId || log.id,
      name: log.name,
      email: log.email,
      role: log.role || 'employee',
      department: log.department || 'General',
      uniqueID: log.uniqueID || log.employeeId || ''
    };
    setEmployeeHistoryModal(userObj);
    setEmpHistoryMonth('all');
    setEmpHistorySearch('');
    setEmpHistoryStatus('all');
    fetchEmployeeHistory(userObj, 'all');
  };

  /* =========================================================
     HISTORICAL LOG EXPLORER (MULTI-DATE OLD LOG SEARCH)
  ========================================================= */
  const fetchHistoryRangeLogs = async () => {
    if (!token) return;
    setLoadingHistory(true);
    setHistoryLogs([]);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Case A: Specific employee selected
      if (historySelectedUser && historySelectedUser !== 'all') {
        const url = `${BASE_URL}/api/attendance/history/${historySelectedUser}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          const records = data.attendance || data.data || normalizeLogs(data);
          const mapped = records
            .map(mapLog)
            .filter((r) => {
              const d = r.date ? (r.date.length >= 10 ? r.date.slice(0, 10) : r.date) : '';
              return (!historyFromDate || d >= historyFromDate) && (!historyToDate || d <= historyToDate);
            });
          mapped.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setHistoryLogs(mapped);
        }
        return;
      }

      // Case B: All employees in date range
      const startDate = new Date(`${historyFromDate}T00:00:00`);
      const endDate = new Date(`${historyToDate}T00:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
        showToast('Please select a valid date range', 'error');
        return;
      }

      const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const targetDays = Math.min(diffDays, 31);
      const dateList = [];
      const cur = new Date(endDate);
      for (let i = 0; i < targetDays; i++) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        dateList.push(`${y}-${m}-${day}`);
        cur.setDate(cur.getDate() - 1);
      }

      const allFetchedLogs = [];
      const chunkSize = 5;
      for (let i = 0; i < dateList.length; i += chunkSize) {
        const chunk = dateList.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(async (dStr) => {
            try {
              const u = `${ATTENDANCE_URL}?date=${encodeURIComponent(dStr)}`;
              const resp = await fetch(u, { headers });
              if (resp.ok) {
                const j = await resp.json();
                const dayItems = normalizeLogs(j);
                return dayItems.map((item) => ({ ...item, date: item.date || dStr }));
              }
            } catch (_) { }
            return [];
          })
        );
        chunkResults.flat().forEach((item) => {
          if (!item || isFinanceOrExcludedUser(item) || isUnknownEmployeeOrUser(item)) return;
          allFetchedLogs.push(item);
        });
        setHistoryProgress(Math.round(((i + chunk.length) / dateList.length) * 100));
      }

      const mapped = allFetchedLogs
        .map(mapLog)
        .filter((l) => l && l.name && !isUnknownEmployeeOrUser(l.name));
      mapped.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setHistoryLogs(mapped);
    } catch (err) {
      console.error('Failed to fetch historical logs:', err);
      showToast('Error fetching historical logs', 'error');
    } finally {
      setLoadingHistory(false);
      setHistoryProgress(0);
    }
  };

  const exportHistoryToExcel = () => {
    if (!historyLogs || historyLogs.length === 0) {
      showToast('No historical logs to export', 'warning');
      return;
    }
    const exportData = filteredHistoryLogs.map((log, index) => ({
      'No.': index + 1,
      'Date': formatIndianDate(log.date),
      'Employee Name': log.name,
      'Employee ID': log.uniqueID || log.employeeId || '—',
      'Email': log.email || '—',
      'Check In Time': formatTime(log.checkIn),
      'Check Out Time': formatTime(log.checkOut),
      'Total Working Hours': log.totalHours || '0h',
      'Status': log.status ? log.status.toUpperCase() : 'ABSENT',
      'Approval Status': log.approvalStatus || 'approved'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance History');
    XLSX.writeFile(workbook, `Attendance_Historical_Logs_${historyFromDate}_to_${historyToDate}.xlsx`);
    showToast('Historical logs exported successfully!', 'success');
  };

  const exportEmpHistoryToExcel = () => {
    if (!employeeHistoryList || employeeHistoryList.length === 0) {
      showToast('No history records to export', 'warning');
      return;
    }
    const exportData = filteredEmployeeHistory.map((log, index) => ({
      'No.': index + 1,
      'Date': formatIndianDate(log.date),
      'Check In Time': formatTime(log.checkIn),
      'Check Out Time': formatTime(log.checkOut),
      'Total Working Hours': log.totalHours || '0h',
      'Status': log.status ? log.status.toUpperCase() : 'ABSENT',
      'Approval Status': log.approvalStatus || 'approved'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance History');
    const safeName = (employeeHistoryModal?.name || 'Employee').replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Attendance_History_${safeName}.xlsx`);
    showToast('Employee history exported successfully!', 'success');
  };

  useEffect(() => {
    if (!selectedLog) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedLog(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [selectedLog]);

  /* =========================================================
     STATUS ICON
  ========================================================= */
  const getStatusIconAndColor = (
    status
  ) => {
    const iconClass =
      'h-3 w-3 sm:h-3.5 sm:w-3.5';

    switch (
    String(status || '')
      .toLowerCase()
      .trim()
    ) {
      case 'on time':
      case 'present':
        return {
          icon: (
            <Clock
              className={`${iconClass} text-green-600`}
            />
          ),
          color: 'green',
          label: 'On Time / Present',
        };

      case 'late':
        return {
          icon: (
            <Clock
              className={`${iconClass} text-yellow-600`}
            />
          ),
          color: 'yellow',
          label: 'Late',
        };

      case 'half day':
      case 'half-day':
      case 'halfday':
        return {
          icon: (
            <Clock
              className={`${iconClass} text-blue-600`}
            />
          ),
          color: 'blue',
          label: 'Half Day',
        };

      case 'on leave':
      case 'absent':
        return {
          icon: (
            <Clock
              className={`${iconClass} text-rose-600`}
            />
          ),
          color: 'rose',
          label: 'On Leave / Absent',
        };

      case 'pending':
        return {
          icon: (
            <Clock
              className={`${iconClass} text-amber-600`}
            />
          ),
          color: 'amber',
          label: 'Pending request',
        };

      case 'rejected':
        return {
          icon: (
            <XCircle
              className={`${iconClass} text-rose-600`}
            />
          ),
          color: 'rose',
          label: 'Admin rejects the check in',
        };

      default:
        return {
          icon: (
            <Clock
              className={`${iconClass} text-gray-600`}
            />
          ),
          color: 'gray',
          label: 'Unknown',
        };
    }
  };

  /* =========================================================
     STATUS BADGE (PILL TAG WITH COLORED DOT)
  ========================================================= */
  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase().trim();
    switch (s) {
      case 'on time':
      case 'present':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dot: 'bg-emerald-500',
          label: 'On Time',
        };
      case 'late':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dot: 'bg-amber-500',
          label: 'Late',
        };
      case 'half day':
      case 'half-day':
      case 'halfday':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dot: 'bg-blue-500',
          label: 'Half Day',
        };
      case 'on leave':
      case 'leave':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200/80',
          dot: 'bg-purple-500',
          label: 'On Leave',
        };
      case 'absent':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          dot: 'bg-rose-500',
          label: 'Absent',
        };
      case 'pending':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dot: 'bg-amber-500',
          label: 'Pending Request',
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          dot: 'bg-rose-500',
          label: 'Admin Rejects Check-In',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200/80',
          dot: 'bg-slate-400',
          label: status || 'Unknown',
        };
    }
  };

  /* =========================================================
     STATUS STYLE
  ========================================================= */
  const getStatusStyle = (status) => {
    switch (
    String(status || '')
      .toLowerCase()
      .trim()
    ) {
      case 'on time':
      case 'present':
        return 'bg-green-50 text-green-700 border-green-300';

      case 'late':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';

      case 'half day':
      case 'half-day':
      case 'halfday':
        return 'bg-blue-50 text-blue-700 border-blue-300';

      case 'on leave':
      case 'absent':
        return 'bg-rose-50 text-rose-700 border-rose-300';

      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-300';

      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-300';

      default:
        return 'bg-gray-50 text-gray-600 border-gray-300';
    }
  };

  /* =========================================================
     INITIALS (MAX 2 LETTERS)
  ========================================================= */
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'NA';

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return 'NA';

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.slice(0, 2).toUpperCase();
  };

  /* =========================================================
     SORT
  ========================================================= */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(
        sortOrder === 'asc'
          ? 'desc'
          : 'asc'
      );
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  /* =========================================================
     FILTER + SORT
  ========================================================= */
  const filteredAndSortedLogs =
    [...logs]
      .filter((log) => {
        const name =
          String(log.name || '')
            .toLowerCase();

        const email =
          String(log.email || '')
            .toLowerCase();

        const search =
          searchTerm.toLowerCase();

        const matchesSearch =
          name.includes(search) ||
          email.includes(search);

        const currentStatus =
          String(log.status || '')
            .toLowerCase()
            .trim();

        const selectedFilter = filterStatus.toLowerCase().trim();

        let matchesStatus = selectedFilter === 'all';
        if (!matchesStatus) {
          if (selectedFilter === 'on time' || selectedFilter === 'present') {
            matchesStatus = currentStatus === 'on time' || currentStatus === 'present';
          } else if (selectedFilter === 'half day') {
            matchesStatus = currentStatus === 'half day' || currentStatus === 'half-day' || currentStatus === 'halfday';
          } else {
            matchesStatus = currentStatus === selectedFilter;
          }
        }

        return (
          matchesSearch &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        let compareA =
          a[sortField] || '';

        let compareB =
          b[sortField] || '';

        if (sortField === 'date') {
          compareA =
            new Date(a.date).getTime() ||
            0;

          compareB =
            new Date(b.date).getTime() ||
            0;
        }

        if (sortField === 'name') {
          compareA = String(
            compareA
          ).toLowerCase();

          compareB = String(
            compareB
          ).toLowerCase();
        }

        if (sortOrder === 'asc') {
          return compareA > compareB
            ? 1
            : -1;
        }

        return compareA < compareB
          ? 1
          : -1;
      });

  /* =========================================================
     ATTENDANCE COUNTS
  ========================================================= */
  const getNormalizedStatus = (log) => {
    return normalizeStatus(log);
  };

  const onTimeCount = logs.filter((log) => {
    const s = getNormalizedStatus(log);
    return s === 'on time' || s === 'present';
  }).length;

  const lateCount = logs.filter((log) => {
    const s = getNormalizedStatus(log);
    return s === 'late';
  }).length;

  const halfDayCount = logs.filter((log) => {
    const s = getNormalizedStatus(log);
    return s === 'half day' || s === 'half-day' || s === 'halfday';
  }).length;

  const absentCount = logs.filter((log) => {
    const s = getNormalizedStatus(log);
    return s === 'absent';
  }).length;

  const setRangePreset = (days) => {
    const today = new Date();
    const endStr = getTodayLocal();
    if (days === 'thisMonth') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      setHistoryFromDate(`${y}-${m}-01`);
      setHistoryToDate(endStr);
      return;
    }
    if (days === 'lastMonth') {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      const fy = firstOfLastMonth.getFullYear();
      const fm = String(firstOfLastMonth.getMonth() + 1).padStart(2, '0');
      const ly = lastOfLastMonth.getFullYear();
      const lm = String(lastOfLastMonth.getMonth() + 1).padStart(2, '0');
      const ld = String(lastOfLastMonth.getDate()).padStart(2, '0');
      setHistoryFromDate(`${fy}-${fm}-01`);
      setHistoryToDate(`${ly}-${lm}-${ld}`);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setHistoryFromDate(`${y}-${m}-${day}`);
    setHistoryToDate(endStr);
  };

  /* =========================================================
     HISTORICAL LOG FILTERING & METRICS
  ========================================================= */
  const filteredHistoryLogs = historyLogs.filter((log) => {
    if (!log) return false;
    const name = String(log.name || '').toLowerCase();
    const email = String(log.email || '').toLowerCase();
    const dept = String(log.department || '').toLowerCase();
    const dateStr = String(log.date || '').toLowerCase();
    const search = historySearchTerm.toLowerCase().trim();

    const matchesSearch = !search || name.includes(search) || email.includes(search) || dept.includes(search) || dateStr.includes(search);

    const s = normalizeStatus(log);
    const filter = historyFilterStatus.toLowerCase().trim();
    let matchesStatus = filter === 'all';
    if (!matchesStatus) {
      if (filter === 'on time' || filter === 'present') {
        matchesStatus = s === 'on time' || s === 'present';
      } else if (filter === 'half day') {
        matchesStatus = s === 'half day' || s === 'half-day' || s === 'halfday';
      } else {
        matchesStatus = s === filter;
      }
    }
    return matchesSearch && matchesStatus;
  });

  const historyOnTimeCount = filteredHistoryLogs.filter((l) => {
    const s = normalizeStatus(l);
    return s === 'on time' || s === 'present';
  }).length;

  const historyLateCount = filteredHistoryLogs.filter((l) => normalizeStatus(l) === 'late').length;
  const historyHalfDayCount = filteredHistoryLogs.filter((l) => {
    const s = normalizeStatus(l);
    return s === 'half day' || s === 'half-day' || s === 'halfday';
  }).length;
  const historyAbsentCount = filteredHistoryLogs.filter((l) => normalizeStatus(l) === 'absent').length;

  /* =========================================================
     EMPLOYEE HISTORY FILTERING & METRICS
  ========================================================= */
  const filteredEmployeeHistory = employeeHistoryList.filter((log) => {
    if (!log) return false;
    // Month filter: e.g. "2026-11"
    if (empHistoryMonth && empHistoryMonth !== 'all') {
      const d = String(log.date || '');
      if (!d.startsWith(empHistoryMonth)) return false;
    }
    // Status filter
    if (empHistoryStatus && empHistoryStatus !== 'all') {
      const s = normalizeStatus(log);
      if (empHistoryStatus === 'on time' || empHistoryStatus === 'present') {
        if (s !== 'on time' && s !== 'present') return false;
      } else if (empHistoryStatus === 'half day') {
        if (s !== 'half day' && s !== 'half-day' && s !== 'halfday') return false;
      } else if (s !== empHistoryStatus) {
        return false;
      }
    }
    // Search
    if (empHistorySearch && empHistorySearch.trim()) {
      const term = empHistorySearch.toLowerCase().trim();
      const d = String(log.date || '').toLowerCase();
      const s = String(log.status || '').toLowerCase();
      const h = String(log.totalHours || '').toLowerCase();
      if (!d.includes(term) && !s.includes(term) && !h.includes(term)) return false;
    }
    return true;
  });

  const empOnTimeCount = filteredEmployeeHistory.filter((l) => {
    const s = normalizeStatus(l);
    return s === 'on time' || s === 'present';
  }).length;
  const empLateCount = filteredEmployeeHistory.filter((l) => normalizeStatus(l) === 'late').length;
  const empHalfDayCount = filteredEmployeeHistory.filter((l) => {
    const s = normalizeStatus(l);
    return s === 'half day' || s === 'half-day' || s === 'halfday';
  }).length;
  const empAbsentCount = filteredEmployeeHistory.filter((l) => normalizeStatus(l) === 'absent').length;

  /* =========================================================
     EXPORT EXCEL
  ========================================================= */
  const downloadExcel = (exportLogs, fileName) => {
    try {
      const exportData =
        exportLogs.map(
          (log) => ({
            'Employee Name': log.name,
            Email: log.email,
            Date: formatIndianDate(
              log.date
            ),
            'Check In': formatTime(
              log.checkIn
            ),
            'Break Start': (log.breaks || [])
              .map((breakItem) =>
                formatTime(
                  breakItem?.startTime ||
                  breakItem?.startTimeFullDisplay ||
                  breakItem?.startTimeDisplay
                )
              )
              .join(', '),
            'Break End': (log.breaks || [])
              .map((breakItem) =>
                formatTime(
                  breakItem?.endTime ||
                  breakItem?.endTimeFullDisplay ||
                  breakItem?.endTimeDisplay
                )
              )
              .join(', '),
            'Check Out': formatTime(
              log.checkOut
            ),
            'Total Hours':
              log.totalHours,
            Status: log.status,
          })
        );

      const wb =
        XLSX.utils.book_new();

      const ws =
        XLSX.utils.json_to_sheet(
          exportData
        );

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        'Attendance'
      );

      XLSX.writeFile(
        wb,
        fileName
      );
      showToast('Daily attendance logs exported successfully.', 'success');
    } catch (error) {
      console.error(
        'Export error:',
        error
      );

      showToast(
        'Failed to export data',
        'error'
      );
    }
  };

  const exportToExcel = () => {
    downloadExcel(
      filteredAndSortedLogs,
      `Attendance_Logs_${selectedDate}.xlsx`
    );
    setShowExportOptions(false);
  };

  const exportMonthToExcel = async () => {
    setExportingMonth(true);

    try {
      if (!token) {
        throw new Error('Please login to export attendance logs.');
      }

      const monthKey = selectedDate.slice(0, 7);
      const [year, month] = monthKey.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthDates = Array.from({ length: daysInMonth }, (_, index) =>
        `${monthKey}-${String(index + 1).padStart(2, '0')}`
      );
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const attendanceItems = [];

      for (let index = 0; index < monthDates.length; index += 5) {
        const dateBatch = monthDates.slice(index, index + 5);
        const batchItems = await Promise.all(dateBatch.map(async (date) => {
          const url = `${ATTENDANCE_URL}?date=${encodeURIComponent(date)}`;
          const response = await fetch(url, { method: 'GET', headers });

          if (!response.ok) {
            throw new Error(`Unable to load attendance for ${date}.`);
          }

          return normalizeLogs(await response.json());
        }));

        attendanceItems.push(...batchItems.flat());
      }

      const monthLogs = attendanceItems
        .filter((item) => {
          if (!item || isFinanceOrExcludedUser(item)) return false;
          if (item.user && isFinanceOrExcludedUser(item.user)) return false;
          if (item.employee && isFinanceOrExcludedUser(item.employee)) return false;
          if (item.userId && isFinanceOrExcludedUser(item.userId)) return false;
          return true;
        })
        .map(mapLog)
        .sort((firstLog, secondLog) => {
          const nameOrder = firstLog.name.localeCompare(secondLog.name, 'en', {
            sensitivity: 'base',
          });

          if (nameOrder !== 0) return nameOrder;

          return new Date(firstLog.date).getTime() - new Date(secondLog.date).getTime();
        });

      downloadExcel(monthLogs, `Attendance_Logs_${monthKey}.xlsx`);
      setShowExportOptions(false);
      showToast('Monthly attendance logs exported successfully.', 'success');
    } catch (exportError) {
      console.error('Monthly export error:', exportError);
      showToast(exportError.message || 'Failed to export monthly attendance data', 'error');
    } finally {
      setExportingMonth(false);
    }
  };

  const getLogDetails = (log) => {
    if (!log?.checkIn || log.approvalStatus !== 'approved') {
      return { segments: [], workingMinutes: 0, breakMinutes: 0 };
    }

    const segments = calculateAttendanceProgress(
      log.checkIn,
      log.breaks,
      log.checkOut
    );

    const workingMinutes = segments
      .filter((segment) => segment.color === 'blue')
      .reduce(
        (total, segment) => total + segment.end - segment.start,
        0
      );

    const breakMinutes = segments
      .filter((segment) => segment.label === 'Break' || segment.label === 'Idle')
      .reduce(
        (total, segment) => total + segment.end - segment.start,
        0
      );

    return { segments, workingMinutes, breakMinutes };
  };

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 font-poppins">

      {/* ==================================================== */}
      {/* 1. HEADER SECTION */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-poppins">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-poppins">
            Attendance Logs
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap font-poppins">
          {/* DATE NAVIGATION CONTROLS (FOR DAILY & PAST DATE CHECK) */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-lg border border-slate-300/80 shadow-2xs">
            {/* Previous Day */}
            <button
              type="button"
              onClick={handlePrevDay}
              title="Previous Day (Check older logs)"
              className="h-8 w-8 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Date Picker Button */}
            <button
              type="button"
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker();
                } catch {
                  dateInputRef.current?.focus();
                }
              }}
              className="relative flex items-center h-8 bg-white border border-slate-300 hover:border-slate-400 rounded-md px-2.5 shadow-2xs gap-1.5 cursor-pointer hover:bg-slate-50 transition"
              title="Click to select a date from calendar"
            >
              <Calendar size={13} className="text-[#034665] shrink-0" />
              <span className="text-xs font-semibold text-slate-800 select-none whitespace-nowrap">
                {formatHeaderDate(selectedDate)}
              </span>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="absolute inset-0 opacity-0 pointer-events-auto cursor-pointer w-full h-full"
                aria-label="Select Date"
              />
            </button>

            {/* Next Day */}
            <button
              type="button"
              onClick={handleNextDay}
              title="Next Day"
              className="h-8 w-8 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>

            {/* Today quick button */}
            <button
              type="button"
              onClick={handleJumpToday}
              className={`h-8 px-2.5 rounded-md text-xs font-semibold transition cursor-pointer border ${
                selectedDate === getTodayLocal()
                  ? 'bg-[#034665] text-white border-[#034665]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Today
            </button>

            {/* Yesterday quick button */}
            <button
              type="button"
              onClick={handleJumpYesterday}
              className={`h-8 px-2.5 rounded-md text-xs font-semibold transition cursor-pointer border ${
                selectedDate === getYesterdayLocal()
                  ? 'bg-[#034665] text-white border-[#034665]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Yesterday
            </button>
          </div>

          {/* TOTAL COUNT */}
          <div className="h-9 bg-white border border-slate-300 rounded-md px-3 shadow-2xs flex items-center gap-1.5 font-poppins">
            <Users size={14} className="text-slate-600" />
            <span className="text-xs font-semibold text-slate-800">{logs.length}</span>
          </div>

          {/* SYNC / REFRESH */}
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={loading}
            title="Refresh attendance records"
            className="h-9 w-9 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer font-poppins"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#0088cc]' : 'text-slate-600'} />
          </button>

          {/* LEAVE & ABSENCE POLICY */}
          <button
            type="button"
            onClick={() => setShowPolicyModal(true)}
            title="View HRMS Unpaid Leave & Absence Policy"
            className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-2xs flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer font-poppins"
          >
            <FileText size={14} className="text-[#034665]" />
            <span className="hidden sm:inline">Leave Policy</span>
          </button>

          {/* DAILY FINALIZATION QUICK TRIGGER */}
          {canManageFinalization && (
            <button
              type="button"
              onClick={() => {
                setViewMode('scheduler');
                fetchSchedulerLogs(1);
                fetchFinalizePreview(finalizeTargetDate || selectedDate || getTodayLocal());
              }}
              title="Daily Attendance Finalization & 4:00 PM IST Scheduler"
              className="h-9 px-3 bg-white border border-[#034665]/30 hover:bg-sky-50 text-[#034665] rounded-md shadow-2xs flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer font-poppins"
            >
              <ShieldCheck size={15} className="text-[#034665]" />
              <span className="hidden md:inline">Daily Finalization</span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800">
                16:00 IST
              </span>
            </button>
          )}

          {/* EXPORT EXCEL */}
          <button
            type="button"
            onClick={() => setShowExportOptions(true)}
            className="h-9 px-3.5 text-white rounded-md shadow-2xs flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer font-poppins"
            style={{ background: '#034665' }}
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE TABS: DAILY LOGS vs HISTORICAL LOG EXPLORER (OLD LOGS) */}
      <div className="flex items-center justify-between border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              viewMode === 'daily'
                ? 'border-[#034665] text-[#034665] bg-sky-50/60 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <CalendarDays size={16} />
            <span>Daily Attendance Logs</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700 font-bold">
              {formatIndianDate(selectedDate)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('history');
              if (historyLogs.length === 0 && !loadingHistory) {
                fetchHistoryRangeLogs();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              viewMode === 'history'
                ? 'border-[#034665] text-[#034665] bg-sky-50/60 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <History size={16} />
            <span>Historical Log Explorer (Old Logs)</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 font-bold">
              Multi-Date Range
            </span>
          </button>

          {canManageFinalization && (
            <button
              type="button"
              onClick={() => {
                setViewMode('scheduler');
                if (schedulerLogs.length === 0 && !loadingScheduler) {
                  fetchSchedulerLogs(1);
                }
                if (!finalizePreview && !loadingPreview) {
                  fetchFinalizePreview(finalizeTargetDate || selectedDate || getTodayLocal());
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                viewMode === 'scheduler'
                  ? 'border-[#034665] text-[#034665] bg-sky-50/60 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
              }`}
            >
              <ShieldCheck size={16} />
              <span>Daily Finalization &amp; Scheduler</span>
              <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-bold">
                16:00 IST
              </span>
            </button>
          )}
        </div>
      </div>

      {/* HISTORICAL DATE NOTICE BANNER */}
      {viewMode === 'daily' && selectedDate !== getTodayLocal() && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <History size={17} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-amber-900">
                Viewing Historical Attendance: {formatHeaderDate(selectedDate)}
              </span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Displaying past attendance records. Background auto-refresh is paused. Click any employee row to see day timeline or click &quot;Past Logs&quot; to review full employee history.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleJumpToday}
            className="self-start sm:self-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <CheckCircle2 size={13} />
            <span>Return to Today ({formatIndianDate(getTodayLocal())})</span>
          </button>
        </div>
      )}

      {/* POLICY MODAL */}
      {showPolicyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 font-poppins"
          role="presentation"
          onClick={() => setShowPolicyModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden font-poppins"
            role="dialog"
            aria-modal="true"
            aria-label="HRMS Leave & Absence Policy"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-[#034665]" />
                <h3 className="text-sm font-bold text-slate-900">
                  HRMS Leave & Absence Policy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Attendance and leave deductions conform to the revised Kevalon Technology HRMS standards:
              </p>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Scenario</th>
                      <th className="py-2.5 px-3">Actual Unpaid Leave</th>
                      <th className="py-2.5 px-3">Proposed Disciplinary Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Approved Full Day</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">1 day</td>
                      <td className="py-2 px-3 text-emerald-600 font-medium">— (Authorized)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Approved Half Day</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">0.5 day</td>
                      <td className="py-2 px-3 text-emerald-600 font-medium">— (Authorized)</td>
                    </tr>
                    <tr className="bg-amber-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">Unauthorized Full Day</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">1 day</td>
                      <td className="py-2 px-3 text-amber-700 font-medium">+0.5 day (Proposed separately)</td>
                    </tr>
                    <tr className="bg-amber-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">Unauthorized Half Day</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">0.5 day</td>
                      <td className="py-2 px-3 text-amber-700 font-medium">+0.5 day (Proposed separately)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                <p>• <strong>Authorized Unpaid Leave:</strong> Final HR approval represents Authorized Unpaid Leave (LOP deduction applies, no disciplinary penalty).</p>
                <p>• <strong>Unauthorized Absence:</strong> The proposed additional 0.5-day-equivalent penalty is tracked separately. Only a legally permissible, authorized penalty may affect net salary.</p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-[#034665] text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer hover:bg-[#02334a]"
              >
                Close Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 font-poppins"
          role="presentation"
          onClick={() => !exportingMonth && setShowExportOptions(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200/80 shadow-2xl overflow-hidden font-poppins"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-export-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 id="attendance-export-title" className="font-semibold text-gray-800 text-sm">
                Download Attendance
              </h2>
              <button
                type="button"
                onClick={() => setShowExportOptions(false)}
                aria-label="Close export options"
                className="p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg cursor-pointer"
                disabled={exportingMonth}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 p-4">
              <button
                type="button"
                onClick={exportToExcel}
                className="flex w-full items-center gap-3 border border-gray-200 rounded-lg px-3 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                disabled={exportingMonth}
              >
                <Calendar className="h-5 w-5 text-emerald-600" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">Date-wise</span>
                  <span className="block text-xs text-gray-500">{formatIndianDate(selectedDate)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={exportMonthToExcel}
                className="flex w-full items-center gap-3 border border-gray-200 rounded-lg px-3 py-3 text-left hover:bg-gray-50 transition-colors disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                disabled={exportingMonth}
              >
                {exportingMonth ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                ) : (
                  <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
                )}
                <span>
                  <span className="block text-sm font-medium text-gray-800">
                    {exportingMonth ? 'Preparing monthly file...' : 'Month-wise'}
                  </span>
                  <span className="block text-xs text-gray-500">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. DAILY ATTENDANCE LOGS VIEW */}
      {/* ==================================================== */}
      {viewMode === 'daily' && (
        <>
          {/* TOP METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
        {[
          { label: "ON TIME", value: onTimeCount },
          { label: "LATE", value: lateCount },
          { label: "HALF DAY", value: halfDayCount },
          { label: "ABSENT", value: absentCount }
        ].map((item, idx) => (
          <div
            key={idx}
            className="relative flex items-center h-[60px] w-full"
          >
            {/* Left card for the border */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
              style={{ background: "#034665", opacity: 1 }}
            />
            {/* Inner card */}
            <div
              className="relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
            >
              <p className="text-[11px] sm:text-[12px] font-medium text-[#718096] tracking-wider uppercase font-poppins select-none">
                {item.label}
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ==================================================== */}
      {/* 3. ATTENDANCE LOGS MAIN CONTAINER */}
      {/* ==================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 lg:p-6 shadow-xs space-y-4 font-poppins">

        {/* Status Legend / Summary Icons */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[4px] bg-[#0284c7] flex items-center justify-center shadow-2xs">
              <Briefcase size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-800 font-poppins">Working</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[4px] bg-[#eab308] flex items-center justify-center shadow-2xs">
              <Coffee size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-800 font-poppins">Break</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[4px] bg-[#94a3b8] flex items-center justify-center shadow-2xs">
              <PauseCircle size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xs font-medium text-slate-800 font-poppins">Idle</span>
          </div>
        </div>

        {/* Filter Toolbar: Search on left + Status & Sort dropdowns on right */}
        <div className="flex flex-col md:flex-row items-end justify-between gap-3 pt-1 font-poppins">
          <div className="relative w-full md:w-[320px] lg:w-[360px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee name, email or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] font-poppins transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end font-poppins">
            {/* Status Filter */}
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium font-poppins mb-1">Status</span>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-8 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins"
                >
                  <option value="all">All Status</option>
                  <option value="on time">On Time</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half day">Half Day</option>
                  <option value="absent">Absent</option>
                  <option value="on leave">On Leave</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Sort Filter */}
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium font-poppins mb-1">Sort By</span>
              <div className="relative">
                <select
                  value={`${sortField}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortField(field);
                    setSortOrder(order);
                  }}
                  className="h-8 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0088cc] focus:border-[#0088cc] cursor-pointer appearance-none pr-7 font-poppins"
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-2 font-poppins">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* LOADING & TABLE */}
        {loading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : filteredAndSortedLogs.length === 0 ? (
          <div className="p-16 text-center border border-slate-200/80 rounded-lg bg-slate-50/50 font-poppins">
            <Clock size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No attendance logs found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm || filterStatus !== 'all'
                ? 'No attendance records match your search or filter criteria.'
                : 'No attendance records available for this selected date.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/80 rounded-lg font-poppins">
            <table className="w-full text-left text-xs border-collapse min-w-[800px] sm:min-w-full font-poppins">
              <thead>
                <tr className="bg-[#0346651A] text-[#034665] text-xs font-semibold font-poppins" style={{ backgroundColor: "#0346651A" }}>
                  <th className="py-3 px-4 w-12 text-left font-semibold">No.</th>
                  <th className="py-3 px-4 text-left font-semibold">Employee</th>
                  <th className="py-3 px-4 text-left font-semibold">Date</th>
                  <th className="py-3 px-4 text-left font-semibold min-w-[320px]">TimeLine</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">Total Hours</th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Past Logs</th>
                  <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Adjustment</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-poppins">
                {filteredAndSortedLogs.map((log, index) => {
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 transition-colors font-poppins cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* No. */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {index + 1}
                      </td>

                      {/* Employee (Avatar + Name + Email) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-2xs"
                            style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                          >
                            {getInitials(log.name)}
                          </div>

                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-xs sm:text-[13px] block truncate">
                              {log.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal block truncate">
                              {log.email || "No email available"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap font-normal">
                        {formatTableDate(log.date)}
                      </td>

                      {/* TimeLine */}
                      <td className="py-3.5 px-4 min-w-[320px]">
                        <AttendanceTimeline
                          checkIn={log.checkIn}
                          breaks={log.breaks}
                          checkOut={log.checkOut}
                          approvalStatus={log.approvalStatus}
                          status={log.status}
                          rejectionReason={log.rejectionReason}
                        />
                      </td>

                      {/* Total Hours */}
                      <td className="py-3.5 px-4 text-xs text-slate-800 whitespace-nowrap font-medium font-poppins">
                        {log.totalHours}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div
                          className="flex items-center justify-center"
                          title={getStatusIconAndColor(log.status).label}
                        >
                          {getStatusIconAndColor(log.status).icon}
                        </div>
                      </td>

                      {/* Past Logs (History) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          aria-label={`Past logs for ${log.name}`}
                          title={`View all past attendance logs for ${log.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEmployeeHistoryModal(log);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-[#034665] bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                        >
                          <History size={13} />
                          <span className="hidden sm:inline">History</span>
                        </button>
                      </td>

                      {/* Adjustment */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          aria-label={`Adjust attendance for ${log.name}`}
                          title="Adjust attendance"
                          disabled={!log.employeeId}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/attendance/adjustments', {
                              state: { adjustmentEmployeeId: String(log.employeeId) },
                            });
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-[#034665] hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <SlidersHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* ==================================================== */}
      {/* HISTORICAL LOG EXPLORER (OLD LOGS SEARCH & RANGE) */}
      {/* ==================================================== */}
      {viewMode === 'history' && (
        <div className="space-y-4 font-poppins">
          {/* Top Metrics Row for Historical Logs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 font-poppins">
            {[
              { label: "TOTAL LOGS FOUND", value: filteredHistoryLogs.length },
              { label: "ON TIME / PRESENT", value: historyOnTimeCount },
              { label: "LATE", value: historyLateCount },
              { label: "HALF DAY / ABSENT", value: `${historyHalfDayCount} / ${historyAbsentCount}` }
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative flex items-center h-[60px] w-full"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[16px] h-[60px] rounded-tl-[10px] rounded-bl-[10px] z-0"
                  style={{ background: "#034665", opacity: 1 }}
                />
                <div
                  className="relative z-10 ml-[6px] flex-1 h-[60px] bg-white rounded-[10px] px-4 sm:px-5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                  style={{ borderWidth: "0.2px", borderStyle: "solid", borderColor: "rgba(192, 209, 216, 0.8)", opacity: 1 }}
                >
                  <p className="text-[11px] sm:text-[12px] font-medium text-[#718096] tracking-wider uppercase font-poppins select-none">
                    {item.label}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-[#111827] font-poppins ml-2">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Historical Log Filter & Search Container */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5 font-poppins">
            {/* Range Presets & Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
                  <Clock size={13} className="text-[#034665]" /> Quick Range:
                </span>
                <button
                  type="button"
                  onClick={() => setRangePreset(7)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Past 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setRangePreset(14)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Past 14 Days
                </button>
                <button
                  type="button"
                  onClick={() => setRangePreset('thisMonth')}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setRangePreset('lastMonth')}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Last Month
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={fetchHistoryRangeLogs}
                  disabled={loadingHistory}
                  className="h-8 px-3.5 bg-[#034665] hover:bg-[#02334a] text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingHistory ? 'animate-spin' : ''} />
                  <span>{loadingHistory ? 'Loading Old Logs...' : 'Search History'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportHistoryToExcel}
                  disabled={filteredHistoryLogs.length === 0}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export ({filteredHistoryLogs.length})</span>
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
              {/* From Date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={historyFromDate}
                  onChange={(e) => setHistoryFromDate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={historyToDate}
                  onChange={(e) => setHistoryToDate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                />
              </div>

              {/* Staff Member Selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Staff Member</label>
                <select
                  value={historySelectedUser}
                  onChange={(e) => setHistorySelectedUser(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc] truncate"
                >
                  <option value="all">All Employees ({allStaffUsers.length})</option>
                  {allStaffUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name || u.uniqueID || 'User'} ({u.department || u.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Status</label>
                <select
                  value={historyFilterStatus}
                  onChange={(e) => setHistoryFilterStatus(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                >
                  <option value="all">All Status</option>
                  <option value="on time">On Time / Present</option>
                  <option value="late">Late</option>
                  <option value="half day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Search Term</label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name/date..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                  />
                </div>
              </div>
            </div>

            {/* Progress Bar when loading history across days */}
            {loadingHistory && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin text-[#0088cc]" />
                    Fetching attendance records across date range...
                  </span>
                  <span className="font-semibold text-slate-800">{historyProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#034665] h-1.5 transition-all duration-200"
                    style={{ width: `${historyProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Historical Logs Results Table */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-xs font-poppins">
            {loadingHistory ? (
              <TableSkeleton rows={7} cols={7} />
            ) : filteredHistoryLogs.length === 0 ? (
              <div className="p-16 text-center border border-slate-200/80 rounded-lg bg-slate-50/50 font-poppins">
                <History size={38} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">No historical attendance logs found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {historySearchTerm || historyFilterStatus !== 'all' || historySelectedUser !== 'all'
                    ? 'No records match your selected filters. Try broadening your criteria.'
                    : 'Click "Search History" above to load past records for the selected date range.'}
                </p>
                <button
                  type="button"
                  onClick={fetchHistoryRangeLogs}
                  className="mt-4 px-4 py-2 bg-[#034665] text-white text-xs font-semibold rounded-md shadow-xs hover:bg-[#02334a] transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>Load Historical Logs</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 rounded-lg font-poppins">
                <table className="w-full text-left text-xs border-collapse min-w-[800px] sm:min-w-full font-poppins">
                  <thead>
                    <tr className="bg-[#0346651A] text-[#034665] text-xs font-semibold font-poppins">
                      <th className="py-3 px-4 w-12 text-left font-semibold">No.</th>
                      <th className="py-3 px-4 text-left font-semibold">Date</th>
                      <th className="py-3 px-4 text-left font-semibold">Employee</th>
                      <th className="py-3 px-4 text-left font-semibold min-w-[280px]">TimeLine</th>
                      <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Check In</th>
                      <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Check Out</th>
                      <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">Total Hours</th>
                      <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-poppins">
                    {filteredHistoryLogs.map((log, index) => {
                      return (
                        <tr
                          key={`${log.id || log.employeeId}-${log.date}-${index}`}
                          className="hover:bg-slate-50/70 transition-colors font-poppins cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {index + 1}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-800 whitespace-nowrap font-medium">
                            {formatIndianDate(log.date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-semibold shrink-0 shadow-2xs"
                                style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                              >
                                {getInitials(log.name)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 text-xs block truncate">
                                  {log.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal block truncate">
                                  {log.email || log.department || "Employee"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 min-w-[280px]">
                            <AttendanceTimeline
                              checkIn={log.checkIn}
                              breaks={log.breaks}
                              checkOut={log.checkOut}
                              approvalStatus={log.approvalStatus}
                              status={log.status}
                              rejectionReason={log.rejectionReason}
                            />
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            {formatTime(log.checkIn)}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            {formatTime(log.checkOut)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-800 whitespace-nowrap font-medium">
                            {log.totalHours || '0h'}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div
                              className="flex items-center justify-center"
                              title={getStatusIconAndColor(log.status).label}
                            >
                              {getStatusIconAndColor(log.status).icon}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                title="View Day Timeline Details"
                                onClick={() => setSelectedLog(log)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                title={`View all past attendance logs for ${log.name}`}
                                onClick={() => openEmployeeHistoryModal(log)}
                                className="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-[#034665] border border-sky-200 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                              >
                                <History size={11} />
                                <span>History</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

            {/* ==================================================== */}
      {/* VIEW MODE 3: DAILY FINALIZATION & 16:00 IST SCHEDULER */}
      {/* ==================================================== */}
      {viewMode === 'scheduler' && (
        <div className="space-y-6 animate-fade-in font-poppins">
          {/* Header & Policy Summary Banner */}
          <div className="bg-gradient-to-r from-[#034665] to-[#068DCB] rounded-2xl p-5 sm:p-6 text-white shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>Daily 16:00 IST (4:00 PM)</span>
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-400/25 border border-emerald-300/40 rounded-full text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 text-emerald-100">
                    <ShieldCheck size={13} />
                    <span>15-Min Watchdog &amp; Safe Catch-Up</span>
                  </span>
                  <span className="px-2.5 py-1 bg-white/15 rounded-full text-xs font-semibold backdrop-blur-xs">
                    Timezone-Safe UTC Shift (toISTDate)
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mt-2.5 tracking-tight">
                  Daily Attendance Finalization &amp; Scheduler Engine
                </h2>
                <p className="text-xs sm:text-sm text-sky-100 mt-1 max-w-2xl leading-relaxed">
                  Automated background finalization evaluates active employees, applies working-hour thresholds, skips Sundays and configured holidays, preserves punches and approved leaves, and logs comprehensive audit trails.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    fetchSchedulerLogs(1);
                    fetchFinalizePreview(finalizeTargetDate);
                  }}
                  disabled={loadingScheduler || loadingPreview}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer border border-white/20"
                >
                  <RefreshCw size={14} className={loadingScheduler || loadingPreview ? 'animate-spin' : ''} />
                  <span>Sync Status</span>
                </button>
              </div>
            </div>

            {/* Core Thresholds & Rules Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/20 text-xs">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
                <div className="flex items-center gap-2 font-semibold text-sky-100">
                  <CheckCircle2 size={15} className="text-emerald-300 shrink-0" />
                  <span>Full Day (Present)</span>
                </div>
                <p className="text-white text-sm font-bold mt-1">≥ 8h (480 mins)</p>
                <p className="text-[11px] text-sky-200 mt-0.5">Check-in ≤ 10:30 AM cutoff; else capped to half-day.</p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
                <div className="flex items-center gap-2 font-semibold text-sky-100">
                  <Clock size={15} className="text-amber-300 shrink-0" />
                  <span>Half Day</span>
                </div>
                <p className="text-white text-sm font-bold mt-1">4h to &lt; 8h</p>
                <p className="text-[11px] text-sky-200 mt-0.5">Between 240 and 479 mins work duration.</p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
                <div className="flex items-center gap-2 font-semibold text-sky-100">
                  <XCircle size={15} className="text-rose-300 shrink-0" />
                  <span>Strict Absent Rule</span>
                </div>
                <p className="text-white text-sm font-bold mt-1">&lt; 4h (e.g. 3m punches)</p>
                <p className="text-[11px] text-sky-200 mt-0.5">Under 240 mins is strictly absent, not half-day.</p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
                <div className="flex items-center gap-2 font-semibold text-sky-100">
                  <ShieldCheck size={15} className="text-blue-300 shrink-0" />
                  <span>Idempotent Safeguards</span>
                </div>
                <p className="text-white text-sm font-bold mt-1">Zero Overwrite</p>
                <p className="text-[11px] text-sky-200 mt-0.5">Preserves punches, approved leaves &amp; adjustments.</p>
              </div>
            </div>
          </div>

          {/* Action Card: Target Date Selector, Live Preview & Manual Execution */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-xs font-poppins">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlayCircle size={18} className="text-[#034665]" />
                  <span>Target Date Finalization &amp; Safe Preview</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect affected attendance records in read-only preview mode before finalizing, or manually trigger execution.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  <input
                    type="date"
                    value={finalizeTargetDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFinalizeTargetDate(newDate);
                      fetchFinalizePreview(newDate);
                    }}
                    className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fetchFinalizePreview(finalizeTargetDate)}
                  disabled={loadingPreview}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingPreview ? 'animate-spin' : ''} />
                  <span>Generate Preview</span>
                </button>

                {canManageFinalization && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Run daily finalization for target date: ${finalizeTargetDate}? This will evaluate thresholds and upsert idempotent absent logs for non-punching employees.`)) {
                        handleExecuteFinalize(finalizeTargetDate);
                      }
                    }}
                    disabled={isExecutingFinalize}
                    className="px-4 py-2 bg-[#034665] hover:bg-[#02334a] text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isExecutingFinalize ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <PlayCircle size={13} />
                    )}
                    <span>{isExecutingFinalize ? 'Executing...' : 'Run Daily Finalization'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Execution Result Banner */}
            {finalizeResult && (
              <div
                className={`mt-4 p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                  finalizeResult.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {finalizeResult.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{finalizeResult.message}</p>
                  {finalizeResult.data && (
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-600">
                      {finalizeResult.data.evaluated !== undefined && (
                        <span>Evaluated: <strong>{finalizeResult.data.evaluated}</strong></span>
                      )}
                      {finalizeResult.data.absentMarked !== undefined && (
                        <span>Absent Marked: <strong>{finalizeResult.data.absentMarked}</strong></span>
                      )}
                      {finalizeResult.data.punchesPreserved !== undefined && (
                        <span>Punches Preserved: <strong>{finalizeResult.data.punchesPreserved}</strong></span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFinalizeResult(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Preview Content Area */}
            {loadingPreview ? (
              <div className="py-8">
                <TableSkeleton rows={4} cols={5} />
              </div>
            ) : previewError ? (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>{previewError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchFinalizePreview(finalizeTargetDate)}
                  className="px-3 py-1 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700 transition cursor-pointer text-xs"
                >
                  Retry Preview
                </button>
              </div>
            ) : finalizePreview ? (
              <div className="mt-4 space-y-4">
                {/* Preview Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Evaluated</span>
                    <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                      {finalizePreview?.summary?.totalEvaluated ?? finalizePreview?.totalEmployees ?? finalizePreview?.total ?? finalizePreview?.stats?.evaluated ?? 0}
                    </span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Preserved Punches</span>
                    <span className="text-lg font-bold text-emerald-800 mt-0.5 block">
                      {finalizePreview?.summary?.punchesPreserved ?? finalizePreview?.punchedCount ?? finalizePreview?.stats?.punched ?? 0}
                    </span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200/80 rounded-lg p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">Leaves Protected</span>
                    <span className="text-lg font-bold text-blue-800 mt-0.5 block">
                      {finalizePreview?.summary?.leavePreserved ?? finalizePreview?.leaveCount ?? finalizePreview?.stats?.leave ?? 0}
                    </span>
                  </div>

                  <div className="bg-rose-50 border border-rose-200/80 rounded-lg p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-rose-700 block">To Mark Absent</span>
                    <span className="text-lg font-bold text-rose-800 mt-0.5 block">
                      {finalizePreview?.summary?.absentToCreate ?? finalizePreview?.absentCount ?? finalizePreview?.stats?.absent ?? 0}
                    </span>
                  </div>

                  <div className="bg-purple-50 border border-purple-200/80 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Holidays / Excluded</span>
                    <span className="text-lg font-bold text-purple-800 mt-0.5 block">
                      {finalizePreview?.isHoliday ? 'Holiday Master Match' : finalizePreview?.isSunday ? 'Sunday Weekly Off' : '0 (Active Workday)'}
                    </span>
                  </div>
                </div>

                {/* Day Status Notice */}
                {(finalizePreview.isHoliday || finalizePreview.isSunday) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                    <Info size={15} className="text-amber-600 shrink-0" />
                    <span>
                      <strong>Safe Skip Active:</strong> {finalizePreview.holidayReason || (finalizePreview.isSunday ? 'Target date is Sunday weekly off' : 'Holiday declared in master')}. Attendance engine will skip marking absent.
                    </span>
                  </div>
                )}

                {/* Affected Records Preview Table */}
                {(() => {
                  const extractRecords = (data) => {
                    if (Array.isArray(data)) return data;
                    if (!data || typeof data !== 'object') return [];
                    if (Array.isArray(data.affectedRecords)) return data.affectedRecords;
                    if (Array.isArray(data.previewRecords)) return data.previewRecords;
                    if (Array.isArray(data.toMarkAbsent)) return data.toMarkAbsent;
                    if (Array.isArray(data.records)) return data.records;
                    if (Array.isArray(data.affected)) return data.affected;
                    if (Array.isArray(data.data)) return data.data;
                    if (data.data && typeof data.data === 'object') {
                      if (Array.isArray(data.data.affectedRecords)) return data.data.affectedRecords;
                      if (Array.isArray(data.data.previewRecords)) return data.data.previewRecords;
                      if (Array.isArray(data.data.toMarkAbsent)) return data.data.toMarkAbsent;
                      if (Array.isArray(data.data.records)) return data.data.records;
                      if (Array.isArray(data.data.affected)) return data.data.affected;
                      if (Array.isArray(data.data.data)) return data.data.data;
                    }
                    return [];
                  };
                  const records = extractRecords(finalizePreview);
                  if (!Array.isArray(records) || records.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200/70 rounded-lg text-xs text-slate-500">
                        <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                        <p className="font-semibold text-slate-700">No pending absent entries detected</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          All active eligible employees have punches, approved leaves, or are covered under company holidays.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2.5 px-3">No.</th>
                            <th className="py-2.5 px-3">Employee</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Status Action</th>
                            <th className="py-2.5 px-3">Protection / Safeguard Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {records.slice(0, 15).map((rec, idx) => (
                            <tr key={rec._id || rec.userId || idx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800">
                                  {rec.employeeName || rec.name || rec.userName || 'Employee'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {rec.employeeId || rec.uniqueID || rec.email || '-'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {rec.department || '-'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  (rec.status || rec.action) === 'leave'
                                    ? 'bg-blue-100 text-blue-800'
                                    : (rec.status || rec.action) === 'half_day' || (rec.status || rec.action) === 'half-day'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {rec.status || rec.action || 'absent'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-500">
                                {rec.reason || rec.note || 'No check-in punch found by 16:00 IST cutoff'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {records.length > 15 && (
                        <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-200">
                          Showing first 15 of {records.length} records.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Click "Generate Preview" to inspect affected records for {finalizeTargetDate}.
              </div>
            )}
          </div>

          {/* Audit History Card: Persistent Job Logs (AttendanceJobLog) */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-xs font-poppins">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={18} className="text-[#034665]" />
                  <span>Persistent Scheduler Execution Audit Logs</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit records stored in AttendanceJobLog tracking daily 16:00 IST runs, catch-ups, and manual executions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchSchedulerLogs(schedulerPage)}
                  disabled={loadingScheduler}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingScheduler ? 'animate-spin' : ''} />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            {loadingScheduler ? (
              <div className="py-8">
                <TableSkeleton rows={5} cols={6} />
              </div>
            ) : schedulerError ? (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{schedulerError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchSchedulerLogs(1)}
                  className="px-3 py-1 bg-rose-600 text-white rounded font-semibold hover:bg-rose-700 transition cursor-pointer text-xs"
                >
                  Retry
                </button>
              </div>
            ) : (() => {
              const safeLogs = Array.isArray(schedulerLogs) ? schedulerLogs : [];
              if (safeLogs.length === 0) {
                return (
                  <div className="p-12 text-center bg-slate-50 border border-slate-200/70 rounded-lg text-xs text-slate-500 mt-4">
                    <ShieldCheck size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No scheduler execution logs found yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automated logs will record every day at 16:00 IST or upon manual finalization.
                    </p>
                  </div>
                );
              }
              return (
                <div className="mt-4 space-y-3">
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-[#0346651A] text-[#034665] font-semibold border-b border-slate-200">
                          <th className="py-3 px-3.5">Target Date</th>
                          <th className="py-3 px-3.5">Execution Time (IST)</th>
                          <th className="py-3 px-3.5">Trigger Type</th>
                          <th className="py-3 px-3.5 text-center">Status</th>
                          <th className="py-3 px-3.5 text-center">Evaluated</th>
                          <th className="py-3 px-3.5 text-center">Absent Marked</th>
                          <th className="py-3 px-3.5 text-center">Punches Preserved</th>
                          <th className="py-3 px-3.5">Duration / Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {safeLogs.map((log, idx) => {
                        const status = (log.status || (log.success ? 'SUCCESS' : 'FAILED')).toUpperCase();
                        const trigger = (log.triggerType || log.trigger || log.type || 'SCHEDULED').toUpperCase();
                        return (
                          <tr key={log._id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                              {log.targetDate || log.date ? formatIndianDate(log.targetDate || log.date) : '-'}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {log.createdAt || log.timestamp
                                ? new Date(log.createdAt || log.timestamp).toLocaleTimeString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true,
                                  })
                                : '-'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {trigger}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  status === 'SUCCESS'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : status === 'SKIPPED'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center font-semibold text-slate-800">
                              {log.totalEvaluated ?? log.evaluated ?? log.metrics?.evaluated ?? '-'}
                            </td>
                            <td className="py-3 px-3.5 text-center font-semibold text-rose-700">
                              {log.absentMarked ?? log.markedAbsent ?? log.metrics?.absentMarked ?? '-'}
                            </td>
                            <td className="py-3 px-3.5 text-center font-semibold text-emerald-700">
                              {log.punchesPreserved ?? log.preserved ?? log.metrics?.punchesPreserved ?? '-'}
                            </td>
                            <td className="py-3 px-3.5 text-[11px] text-slate-500">
                              {log.durationMs ? `${log.durationMs}ms` : ''}
                              {log.errorMessage ? ` • ${log.errorMessage}` : ''}
                              {!log.durationMs && !log.errorMessage ? (log.note || '-') : ''}
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>

                {/* Pagination Controls */}
                {schedulerTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                    <div>
                      Page {schedulerPage} of {schedulerTotalPages} ({schedulerTotalCount} total logs)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fetchSchedulerLogs(Math.max(1, schedulerPage - 1))}
                        disabled={schedulerPage <= 1 || loadingScheduler}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => fetchSchedulerLogs(Math.min(schedulerTotalPages, schedulerPage + 1))}
                        disabled={schedulerPage >= schedulerTotalPages || loadingScheduler}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}

{/* ==================================================== */}
      {/* EMPLOYEE COMPLETE ATTENDANCE HISTORY MODAL */}
      {/* ==================================================== */}
      {employeeHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5 font-poppins"
          role="presentation"
          onClick={() => setEmployeeHistoryModal(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-poppins"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emp-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0"
                  style={{ background: "linear-gradient(166.41deg, #034665 9.73%, #068DCB 106.69%)" }}
                >
                  {getInitials(employeeHistoryModal.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="emp-history-title" className="text-base sm:text-lg font-bold text-slate-900">
                      {employeeHistoryModal.name}
                    </h2>
                    {employeeHistoryModal.uniqueID && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold">
                        {employeeHistoryModal.uniqueID}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {employeeHistoryModal.email} • {employeeHistoryModal.department || 'Employee'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportEmpHistoryToExcel}
                  disabled={filteredEmployeeHistory.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export History</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeHistoryModal(null)}
                  className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filter Toolbar & Summary Cards inside Modal */}
            <div className="p-5 border-b border-slate-200 bg-white space-y-3.5">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Total Days</span>
                  <span className="text-lg font-bold text-slate-900">{filteredEmployeeHistory.length}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700 block">On Time</span>
                  <span className="text-lg font-bold text-emerald-800">{empOnTimeCount}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] uppercase font-semibold text-amber-700 block">Late</span>
                  <span className="text-lg font-bold text-amber-800">{empLateCount}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] uppercase font-semibold text-blue-700 block">Half Day</span>
                  <span className="text-lg font-bold text-blue-800">{empHalfDayCount}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-semibold text-rose-700 block">Absent</span>
                  <span className="text-lg font-bold text-rose-800">{empAbsentCount}</span>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* Month Selector */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Select Month</label>
                  <select
                    value={empHistoryMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      setEmpHistoryMonth(newMonth);
                      fetchEmployeeHistory(employeeHistoryModal, newMonth);
                    }}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                  >
                    <option value="all">All Available Records</option>
                    {(() => {
                      const options = [];
                      const today = new Date();
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        options.push(<option key={ym} value={ym}>{label}</option>);
                      }
                      return options;
                    })()}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Status</label>
                  <select
                    value={empHistoryStatus}
                    onChange={(e) => setEmpHistoryStatus(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                  >
                    <option value="all">All Status</option>
                    <option value="on time">On Time / Present</option>
                    <option value="late">Late</option>
                    <option value="half day">Half Day</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">Search Date / Text</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 2026-11 or on time..."
                      value={empHistorySearch}
                      onChange={(e) => setEmpHistorySearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0088cc]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Records Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingEmpHistory ? (
                <TableSkeleton rows={6} cols={6} />
              ) : filteredEmployeeHistory.length === 0 ? (
                <div className="p-12 text-center border border-slate-200 rounded-lg bg-slate-50/50">
                  <History size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No attendance history records found</p>
                  <p className="text-xs text-slate-400 mt-1">No logs match the chosen month or filters for this employee.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-[#0346651A] text-[#034665] font-semibold">
                        <th className="py-2.5 px-3 w-10">No.</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 min-w-[200px]">TimeLine</th>
                        <th className="py-2.5 px-3 text-center">Check In</th>
                        <th className="py-2.5 px-3 text-center">Check Out</th>
                        <th className="py-2.5 px-3 text-left">Working Hours</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployeeHistory.map((rec, index) => (
                        <tr
                          key={`${rec.date}-${index}`}
                          className="hover:bg-slate-50 cursor-pointer transition"
                          onClick={() => setSelectedLog(rec)}
                        >
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{index + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {formatIndianDate(rec.date)}
                          </td>
                          <td className="py-2.5 px-3 min-w-[200px]">
                            <AttendanceTimeline
                              checkIn={rec.checkIn}
                              breaks={rec.breaks}
                              checkOut={rec.checkOut}
                              approvalStatus={rec.approvalStatus}
                              status={rec.status}
                              rejectionReason={rec.rejectionReason}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            {formatTime(rec.checkIn)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            {formatTime(rec.checkOut)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                            {rec.totalHours || '0h'}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              {getStatusIconAndColor(rec.status).icon}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(rec)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Displaying <strong>{filteredEmployeeHistory.length}</strong> historical attendance log(s)
              </span>
              <button
                type="button"
                onClick={() => setEmployeeHistoryModal(null)}
                className="px-4 py-1.5 bg-[#034665] text-white text-xs font-semibold rounded-md hover:bg-[#02334a] transition cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (() => {
        const activeLog = logs.find((l) =>
          String(l.id) === String(selectedLog.id) ||
          (l.name && selectedLog.name && String(l.name).trim().toLowerCase() === String(selectedLog.name).trim().toLowerCase())
        ) || selectedLog;
        const {
          segments,
          workingMinutes,
          breakMinutes,
        } = getLogDetails(activeLog);

        const formatPopupDate = (dateVal) => {
          const str = String(dateVal || '').trim();
          if (!str) return '—';
          const ymdMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
          if (ymdMatch) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const y = ymdMatch[1];
            const m = months[parseInt(ymdMatch[2], 10) - 1] || ymdMatch[2];
            const d = parseInt(ymdMatch[3], 10);
            return `${d} ${m}, ${y}`;
          }
          const dateObj = new Date(str);
          if (!Number.isNaN(dateObj.getTime())) {
            const d = dateObj.getDate();
            const m = dateObj.toLocaleDateString('en-US', { month: 'short' });
            const y = dateObj.getFullYear();
            return `${d} ${m}, ${y}`;
          }
          return dateVal;
        };

        const formatPopupTime = (value) => {
          if (!value || value === '—' || value === '--:--') return '--:--';
          const str = String(value).trim();
          const ampmMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(str);
          if (ampmMatch) {
            return `${parseInt(ampmMatch[1], 10)}:${ampmMatch[2]} ${ampmMatch[3].toLowerCase()}`;
          }
          if (str.includes('T') || (str.includes('-') && str.length > 10)) {
            const d = new Date(str);
            if (!Number.isNaN(d.getTime())) {
              const h = d.getHours();
              const m = String(d.getMinutes()).padStart(2, '0');
              const period = h >= 12 ? 'pm' : 'am';
              const hour12 = h % 12 || 12;
              return `${hour12}:${m} ${period}`;
            }
          }
          const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = timeMatch[2];
            const period = hour >= 12 ? 'pm' : 'am';
            hour = hour % 12 || 12;
            return `${hour}:${minute} ${period}`;
          }
          const d = new Date(str);
          if (!Number.isNaN(d.getTime())) {
            const h = d.getHours();
            const m = String(d.getMinutes()).padStart(2, '0');
            const period = h >= 12 ? 'pm' : 'am';
            const hour12 = h % 12 || 12;
            return `${hour12}:${m} ${period}`;
          }
          return str.toLowerCase();
        };

        const formatSegmentTimeStr = (val) => {
          if (!val) return '';
          const str = String(val).trim();
          if (/^\d{1,2}:\d{2}$/.test(str)) {
            return str;
          }
          return formatPopupTime(str);
        };

        const formatPopupDuration = (minutes) => {
          if (!Number.isFinite(minutes) || minutes <= 0) {
            return '0h 0m';
          }
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
          }
          return `${remainingMinutes}m`;
        };

        const formatPopupTotalHours = (val) => {
          if (!val || val === '—' || val === '0h') return '0h 0m';
          const str = String(val).trim();
          if (/^\d+h$/.test(str)) {
            return `${str} 0m`;
          }
          return str;
        };

        const getPopupStatusStyle = (status) => {
          const s = String(status || '').toLowerCase().trim();
          switch (s) {
            case 'on time':
            case 'present':
              return { text: 'text-[#16a34a]', label: 'On Time' };
            case 'late':
              return { text: 'text-[#d97706]', label: 'Late' };
            case 'half day':
            case 'half-day':
            case 'halfday':
              return { text: 'text-[#0284c7]', label: 'Half Day' };
            case 'on leave':
            case 'leave':
              return { text: 'text-[#9333ea]', label: 'On Leave' };
            case 'absent':
              return { text: 'text-[#ef4444]', label: 'Absent' };
            case 'pending':
              return { text: 'text-[#d97706]', label: 'Pending' };
            case 'rejected':
              return { text: 'text-[#ef4444]', label: 'Rejected' };
            default:
              return { text: 'text-[#16a34a]', label: status || 'On Time' };
          }
        };

        const statusStyle = getPopupStatusStyle(activeLog.status);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6 backdrop-blur-xs font-poppins"
            role="presentation"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="max-w-[540px] w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200/90 p-5 sm:p-6 space-y-4 sm:space-y-5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-details-title"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header: Avatar, Name, Date, Close Button */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-14 h-14 rounded-full text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-xs"
                    style={{ backgroundColor: '#0284c7' }}
                  >
                    {getInitials(activeLog.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 id="attendance-details-title" className="truncate text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {activeLog.name}
                    </h2>
                    <p className="text-sm text-slate-400 font-normal mt-0.5">
                      {formatPopupDate(activeLog.date || selectedDate)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close attendance details"
                  className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Divider */}
              <div className="border-b border-slate-200/90 -mx-5 sm:-mx-6" />

              {/* Status and Total Row */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className={`text-base sm:text-[17px] font-semibold ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
                <span className="text-sm sm:text-base text-slate-500 font-normal">
                  Total: <strong className="font-bold text-slate-900">{formatPopupTotalHours(activeLog.totalHours)}</strong>
                </span>
              </div>

              {/* 4 Metric Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Check In */}
                <div className="bg-[#ecfdf5] border border-[#86efac] rounded-lg p-3 sm:p-3.5 flex flex-col justify-between">
                  <span className="text-xs sm:text-[13px] font-medium text-[#16a34a]">Check In</span>
                  <span className="mt-1 text-base sm:text-lg font-medium text-slate-900 font-poppins">
                    {formatPopupTime(activeLog.checkIn)}
                  </span>
                </div>

                {/* Check Out */}
                <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-lg p-3 sm:p-3.5 flex flex-col justify-between">
                  <span className="text-xs sm:text-[13px] font-medium text-[#ef4444]">Check Out</span>
                  <span className="mt-1 text-base sm:text-lg font-medium text-slate-900 font-poppins">
                    {formatPopupTime(activeLog.checkOut)}
                  </span>
                </div>

                {/* Working */}
                <div className="bg-[#f0f9ff] border border-[#7dd3fc] rounded-lg p-3 sm:p-3.5 flex flex-col justify-between">
                  <span className="text-xs sm:text-[13px] font-medium text-[#0284c7]">Working</span>
                  <span className="mt-1 text-base sm:text-lg font-medium text-slate-900 font-poppins">
                    {workingMinutes > 0 ? formatPopupDuration(workingMinutes) : (activeLog.totalHours && activeLog.totalHours !== '0h' ? activeLog.totalHours : '0h 0m')}
                  </span>
                </div>

                {/* Break */}
                <div className="bg-[#fffbeb] border border-[#fde68a] rounded-lg p-3 sm:p-3.5 flex flex-col justify-between">
                  <span className="text-xs sm:text-[13px] font-medium text-[#d97706]">Break</span>
                  <span className="mt-1 text-base sm:text-lg font-medium text-slate-900 font-poppins">
                    {breakMinutes > 0 ? formatPopupDuration(breakMinutes) : '0h 0m'}
                  </span>
                </div>
              </div>

              {/* Policy Breakdown Card for Leave / Absent / Half Day */}
              {(() => {
                const s = String(activeLog.status || '').toLowerCase().trim();
                const isAbsent = s === 'absent';
                const isHalf = s === 'half day' || s === 'half-day' || s === 'halfday';
                const isLeave = s === 'on leave' || s === 'leave';

                if (!isAbsent && !isHalf && !isLeave) return null;

                const unpaidDays = isAbsent ? '1.0 Day' : isHalf ? '0.5 Day' : '1.0 Day';
                const isApproved = isLeave;

                return (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    isApproved
                      ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span>HRMS Unpaid Leave & Absence Classification:</span>
                      <span className="font-mono font-bold">{isApproved ? 'Authorized Leave' : 'Unauthorized Absence'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-lg border border-slate-200/60 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Actual Unpaid Leave:</span>
                        <strong className="text-slate-900 font-mono text-xs">{unpaidDays}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Proposed Penalty:</span>
                        <strong className={isApproved ? 'text-emerald-600' : 'text-amber-700'}>
                          {isApproved ? '0 (None)' : '+0.5 day proposed (Requires legal authorization)'}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-tight">
                      {isApproved
                        ? 'Final HR approval represents Authorized Unpaid Leave (LOP applies, no disciplinary penalty).'
                        : 'For unauthorized absence, the proposed 0.5-day penalty is tracked separately and does not reduce net pay without legal authorization.'}
                    </p>
                  </div>
                );
              })()}

              {/* Time Details */}
              <div className="pt-1">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-2.5">
                  Time Details
                </h3>

                {segments.length > 0 ? (
                  <div className="space-y-2.5">
                    {segments.map((segment, index) => (
                      <div
                        key={`${segment.label}-${index}`}
                        className="flex items-center justify-between border border-[#cbd5e1] rounded-lg p-3 sm:p-3.5 bg-white text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              segment.color === 'yellow'
                                ? 'bg-[#eab308]'
                                : segment.color === 'gray'
                                ? 'bg-slate-400'
                                : 'bg-[#0284c7]'
                            }`}
                          />
                          <span className="font-medium text-slate-900">
                            {segment.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-slate-500 font-normal">
                          <span>
                            {formatSegmentTimeStr(segment.startTime)} - {formatSegmentTimeStr(segment.endTime)}
                          </span>
                          <span className="font-semibold text-slate-900 ml-1.5">
                            ({formatPopupDuration(segment.end - segment.start)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeLog.status === 'rejected' || activeLog.approvalStatus === 'rejected' ? (
                  <div className="border border-rose-200 bg-rose-50/70 rounded-lg p-3.5 text-center text-xs sm:text-sm text-rose-700 font-medium flex items-center justify-center gap-2">
                    <XCircle size={16} className="text-rose-500 shrink-0" />
                    <span>Admin rejects the check in{activeLog.rejectionReason ? `: ${activeLog.rejectionReason}` : ''}</span>
                  </div>
                ) : activeLog.status === 'pending' || activeLog.approvalStatus === 'pending' ? (
                  <div className="border border-amber-200 bg-amber-50/70 rounded-lg p-3.5 text-center text-xs sm:text-sm text-amber-700 font-medium flex items-center justify-center gap-2">
                    <Clock size={16} className="text-amber-500 shrink-0" />
                    <span>Pending request</span>
                  </div>
                ) : (
                  <div className="border border-[#cbd5e1] rounded-lg p-4 text-center text-xs sm:text-sm text-slate-400">
                    No timeline data available
                  </div>
                )}
              </div>

              {/* Button to check full attendance history for this employee */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLog(null);
                    openEmployeeHistoryModal(activeLog);
                  }}
                  className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#034665] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                >
                  <History size={14} />
                  <span>Check All Past Attendance Logs for {activeLog.name}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}