import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  ChevronDown,
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
} from 'lucide-react';
import {
  isFinanceOrExcludedUser,
  isUnknownEmployeeOrUser,
  filterOutUnknownUsers
} from '../../utils/roleFilters';
import { showToast } from '../../components/common/Toast';

const ATTENDANCE_URL =
  'https://kt-backend-ttzj.onrender.com/api/attendance/admin/all';

const PENDING_URL =
  'https://kt-backend-ttzj.onrender.com/api/attendance/pending';

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
   GET TODAY
========================================================= */
const getTodayLocal = () => {
  const now = new Date();

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

  const [exportingMonth, setExportingMonth] =
    useState(false);

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

      // Build quick lookup map by all possible user identifier keys (lowercased)
      const userRequestMap = new Map();
      const registerUserRequest = (userKeys, reqObj) => {
        userKeys.filter(Boolean).map((k) => String(k).toLowerCase().trim()).forEach((k) => {
          if (!userRequestMap.has(k) || isRecordRejected(reqObj)) {
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
          const reqIsPend = !reqIsRej && (isRecordPending(matchedReq) || matchedReq.approvalStatus === 'pending');
          if (reqIsRej) {
            enhancedItem = {
              ...item,
              approvalStatus: 'rejected',
              status: 'rejected',
              isRejected: true,
              rejectionReason: matchedReq.rejectionReason || matchedReq.reason || item.rejectionReason || 'Attendance rejected by admin',
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
        const usersUrl = 'https://kt-backend-ttzj.onrender.com/api/users/all';
        const usersRes = await fetch(usersUrl, { method: 'GET', headers });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersList = usersData.users || usersData.data || [];
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
            const reqIsPend = !reqIsRej && matchedReq && (isRecordPending(matchedReq) || matchedReq.approvalStatus === 'pending');

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
                status: reqIsRej ? 'rejected' : (reqIsPend ? 'pending' : 'absent'),
                approvalStatus: reqIsRej ? 'rejected' : (reqIsPend ? 'pending' : 'not_checked_in'),
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
     DATE CHANGE FETCH
  ========================================================= */
  useEffect(() => {
    fetchAttendanceLogs(selectedDate, false);

    // Silent background auto-refresh every 10s for new attendance logs and status changes
    const interval = setInterval(() => {
      fetchAttendanceLogs(selectedDate, true);
    }, 10000);

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
      clearInterval(interval);
      window.removeEventListener("attendanceAdjusted", handleAdjustmentUpdate);
      window.removeEventListener("attendance_adjusted", handleAdjustmentUpdate);
      window.removeEventListener("attendance_updated", handleAdjustmentUpdate);
      window.removeEventListener("storage", handleAdjustmentUpdate);
      window.removeEventListener("focus", handleAdjustmentUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
      .filter((segment) => segment.color === 'yellow')
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
          {/* DATE PICKER */}
          <div className="relative flex items-center h-9 bg-white border border-slate-300 rounded-md px-3 shadow-2xs gap-2 font-poppins cursor-pointer hover:bg-slate-50 transition-colors">
            <Calendar size={14} className="text-slate-700 shrink-0" />
            <span className="text-xs font-medium text-slate-800 select-none">
              {formatHeaderDate(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
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
      {/* 2. TOP METRICS ROW */}
      {/* ==================================================== */}
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
          <div className="p-16 text-center font-poppins">
            <RefreshCw size={28} className="animate-spin text-[#0088cc] mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading attendance records...</p>
            <p className="text-[11px] text-slate-400 mt-1">Fetching latest team logs for {formatIndianDate(selectedDate)}</p>
          </div>
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

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6 backdrop-blur-sm"
            role="presentation"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="max-w-lg w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-details-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-11 w-11 rounded-full ${activeLog.avatarColor} flex flex-shrink-0 items-center justify-center text-sm font-bold text-white shadow-xs`}>
                    {getInitials(activeLog.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 id="attendance-details-title" className="truncate text-base sm:text-lg font-bold text-slate-900">
                      {activeLog.name}
                    </h2>
                    <p className="truncate text-xs text-slate-400 mt-0.5">
                      {activeLog.email} • {formatIndianDate(activeLog.date)}
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

              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  {(() => {
                    const badge = getStatusBadge(activeLog.status);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}
                  <span className="text-xs text-slate-500 font-medium">
                    Total Work Hours: <strong className="text-slate-900 font-bold font-mono">{activeLog.totalHours}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="border border-emerald-200/80 bg-emerald-50/70 p-3 rounded-xl shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Check In</p>
                    <p className="mt-1 text-sm font-bold text-emerald-900 font-mono">{formatTime(activeLog.checkIn)}</p>
                  </div>
                  <div className="border border-rose-200/80 bg-rose-50/70 p-3 rounded-xl shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Check Out</p>
                    <p className="mt-1 text-sm font-bold text-rose-900 font-mono">{formatTime(activeLog.checkOut)}</p>
                  </div>
                  <div className="border border-blue-200/80 bg-blue-50/70 p-3 rounded-xl shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Working</p>
                    <p className="mt-1 text-sm font-bold text-blue-900 font-mono">{formatDuration(workingMinutes)}</p>
                  </div>
                  <div className="border border-amber-200/80 bg-amber-50/70 p-3 rounded-xl shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Break</p>
                    <p className="mt-1 text-sm font-bold text-amber-900 font-mono">{formatDuration(breakMinutes)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">Break & Segment Details</h3>
                  {segments.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30">
                      {segments.map((segment, index) => (
                        <div key={`${segment.label}-${index}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${segment.color === 'yellow' ? 'bg-amber-400' : segment.color === 'gray' ? 'bg-slate-400' : 'bg-blue-500'}`} />
                            <span className="font-semibold text-slate-800">{segment.label}</span>
                          </div>
                          <span className="text-slate-500 font-medium">
                            {segment.startTime} - {segment.endTime}
                            <span className="ml-2 font-bold text-slate-700 font-mono">
                              ({formatDuration(segment.end - segment.start)})
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : activeLog.status === 'rejected' || activeLog.approvalStatus === 'rejected' ? (
                    <div className="border border-rose-200/80 bg-rose-50/70 rounded-xl px-3.5 py-3 text-center text-xs text-rose-700 font-medium flex items-center justify-center gap-2">
                      <XCircle size={14} className="text-rose-500 shrink-0" />
                      <span>Admin rejects the check in{activeLog.rejectionReason ? `: ${activeLog.rejectionReason}` : ''}</span>
                    </div>
                  ) : activeLog.status === 'pending' || activeLog.approvalStatus === 'pending' ? (
                    <div className="border border-amber-200/80 bg-amber-50/70 rounded-xl px-3.5 py-3 text-center text-xs text-amber-700 font-medium flex items-center justify-center gap-2">
                      <Clock size={14} className="text-amber-500 shrink-0" />
                      <span>Pending request</span>
                    </div>
                  ) : (
                    <p className="border border-slate-200/80 rounded-xl px-3 py-4 text-center text-xs text-slate-400">
                      No timeline data available
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}