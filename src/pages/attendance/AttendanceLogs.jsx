import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  isFinanceOrExcludedUser,
  isUnknownEmployeeOrUser,
  filterOutUnknownUsers
} from '../../utils/roleFilters';
import { showToast } from '../../components/common/Toast';

const ATTENDANCE_URL =
  'https://kt-backend-yzr4.onrender.com/api/attendance/admin/all';

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

    if (['pending', 'waiting for approval'].includes(normalized)) {
      return 'pending';
    }

    if (['rejected', 'declined', 'denied'].includes(normalized)) {
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

  // =========================================================
  // IMPORTANT:
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
    hasCheckIn && (
      approvalStatus === 'approved' ||
      rawStatus === 'approved' ||
      rawStatus === 'accepted' ||
      item?.isApproved === true ||
      item?.isApprovedCheckIn === true ||
      ['present', 'late', 'on time', 'half day', 'half-day', 'working', 'completed', 'checked_out', 'checked out'].includes(rawStatus)
    );

  const approvedCheckIn = (hasCheckIn && isApproved) ? rawCheckInVal : '';

  const rawCheckOutVal =
    item?.checkOutTime ||
    item?.punchOut ||
    firstSession.checkout ||
    '';

  const approvedCheckOut = (hasCheckIn && isApproved) ? rawCheckOutVal : '';

  const approvedBreaks = (hasCheckIn && isApproved) ? breaks : [];

  return {
    id:
      item?._id ||
      item?.id ||
      `log-${index}`,

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

    totalHours: (hasCheckIn && isApproved)
      ? (
        item?.totalWorkTimeDisplay ||
        item?.totalWorkTimeHours ||
        item?.totalHours ||
        item?.hours ||
        '0h'
      )
      : '0h',

    isLate: isApproved && item?.isLate === true,

    // Keep approval status separately
    approvalStatus: isApproved ? 'approved' : (hasCheckIn ? approvalStatus : (rawStatus === 'absent' ? 'absent' : (approvalStatus || 'not_checked_in'))),

    status: hasCheckIn ? normalizeStatus(item) : (rawStatus === 'on leave' || rawStatus === 'leave' ? 'on leave' : 'absent'),

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
}) => {
  const [
    localHoveredSegment,
    setLocalHoveredSegment,
  ] = useState(null);

  // =========================================================
  // NEVER RUN TIMER UNTIL APPROVED AND VALID CHECK-IN EXISTS
  // =========================================================
  if (approvalStatus !== 'approved' || !checkIn || checkIn === '—' || checkIn === '--:--') {
    return (
      <div className="w-full bg-gray-100 h-6 rounded-lg flex items-center justify-center text-[10px] text-gray-500">
        {approvalStatus === 'pending'
          ? 'Pending approval'
          : approvalStatus === 'rejected'
            ? 'Rejected from Admin'
            : 'No timeline data available'}
      </div>
    );
  }

  const segments = calculateAttendanceProgress(
    checkIn,
    breaks,
    checkOut
  );

  // Timeline width is always based on the configured 9-hour workday.
  const totalDuration = WORKDAY_MINUTES;

  if (segments.length === 0) {
    return (
      <div className="w-full bg-gray-100 h-6 rounded-lg flex items-center justify-center text-[10px] text-gray-500">
        No timeline data available
      </div>
    );
  }

  const getColorClass = (color) => {
    switch (color) {
      case 'blue':
        return 'bg-gradient-to-r from-blue-400 to-blue-600';

      case 'yellow':
        return 'bg-gradient-to-r from-yellow-300 to-yellow-500';

      case 'gray':
        return 'bg-gradient-to-r from-gray-300 to-gray-500';

      default:
        return 'bg-gray-300';
    }
  };

  const getHoverColor = (color) => {
    switch (color) {
      case 'blue':
        return 'hover:from-blue-500 hover:to-blue-700';

      case 'yellow':
        return 'hover:from-yellow-400 hover:to-yellow-600';

      case 'gray':
        return 'hover:from-gray-400 hover:to-gray-600';

      default:
        return '';
    }
  };

  const getSegmentIcon = (color) => {
    switch (color) {
      case 'blue':
        return <Briefcase className="h-3 w-3 inline text-blue-100" />;

      case 'yellow':
        return <Coffee className="h-3 w-3 inline text-amber-100" />;

      case 'gray':
        return <PauseCircle className="h-3 w-3 inline text-gray-100" />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            In: {formatTime(checkIn)}
          </span>

          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Out: {formatTime(checkOut)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">
            {segments.map((seg, idx) => (
              <span key={idx}>
                {idx > 0 && ' → '}

                <span
                  className={
                    seg.color === 'blue'
                      ? 'text-blue-600'
                      : seg.color === 'yellow'
                        ? 'text-yellow-600'
                        : 'text-gray-500'
                  }
                >
                  {seg.label}
                </span>
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="relative w-full h-6 rounded-lg overflow-hidden shadow-inner bg-gray-100">
        {segments.map((segment, idx) => {
          const width =
            ((segment.end - segment.start) /
              totalDuration) *
            100;

          const isHovered =
            localHoveredSegment === idx;

          return (
            <div
              key={idx}
              className={`
                ${getColorClass(segment.color)}
                ${getHoverColor(segment.color)}
                h-full
                absolute
                top-0
                left-0
                flex
                items-center
                justify-center
                text-white
                text-xs
                font-semibold
                transition-all
                duration-200
                cursor-pointer
                ${isHovered
                  ? 'shadow-lg z-10 scale-y-105'
                  : ''
                }
              `}
              style={{
                width: `${width}%`,
                left: `${((segment.start -
                  segments[0].start) /
                  totalDuration) *
                  100
                  }%`,
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0,0,0,0.3)'
                  : 'none',
              }}
              onMouseEnter={() =>
                setLocalHoveredSegment(idx)
              }
              onMouseLeave={() =>
                setLocalHoveredSegment(null)
              }
              title={`${segment.label}: ${segment.startTime} - ${segment.endTime}`}
            >
              {width > 12 && (
                <span className="truncate px-1 flex items-center gap-1">
                  <span className="text-sm">
                    {getSegmentIcon(segment.color)}
                  </span>

                  <span className="hidden sm:inline text-[11px]">
                    {segment.label}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs font-medium text-gray-600 mt-2">
        <span className="flex items-center gap-1.5">
          <LogIn className="h-3.5 w-3.5 text-emerald-600" />
          Check-in
        </span>

        {breaks?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Coffee className="h-3.5 w-3.5 text-amber-600" />
            Break
          </span>
        )}

        {segments.some((s) => s.color === 'gray') && (
          <span className="flex items-center gap-1.5">
            <PauseCircle className="h-3.5 w-3.5 text-gray-500" />
            Idle
          </span>
        )}

        <span className="flex items-center gap-1.5">
          <LogOut className="h-3.5 w-3.5 text-rose-600" />
          Check-out
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function AttendanceLogs() {
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

        if (!attendanceMap.has(canonicalKey)) {
          attendanceMap.set(canonicalKey, item);
        }

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
          item?.email
        ].filter(Boolean).map(x => String(x).toLowerCase().trim());

        candidateKeys.forEach(k => {
          if (!userLookupMap.has(k)) {
            userLookupMap.set(k, canonicalKey);
          }
        });
      });

      // 2. Fetch all users from /users/all to guarantee HR, TL, Employee are all in table (Excluding Admin & Finance)
      try {
        const usersUrl = 'https://kt-backend-yzr4.onrender.com/api/users/all';
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
              user.email
            ].filter(Boolean).map(x => String(x).toLowerCase().trim());

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
                status: 'absent',
                approvalStatus: 'not_checked_in',
                checkInTime: null,
                checkOutTime: null,
                totalWorkTime: 0,
                totalBreakTime: 0,
                breaks: [],
              });
              userKeys.forEach(k => userLookupMap.set(k, uIdKey));
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
          label: 'Pending',
        };

      case 'rejected':
        return {
          icon: (
            <AlertCircle
              className={`${iconClass} text-red-600`}
            />
          ),
          color: 'red',
          label: 'Rejected from Admin',
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
    <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 tracking-tight">
            Attendance Logs
          </h1>
          {/* <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Inspect detailed attendance logs and history for your team
          </p> */}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* DATE */}
          <div className="h-10 flex items-center gap-2 bg-white border border-slate-200/80 rounded-lg px-3 py-1 shadow-xs">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) =>
                setSelectedDate(
                  e.target.value
                )
              }
              className="text-xs sm:text-sm text-gray-700 focus:outline-none bg-transparent"
            />
          </div>

          {/* TOTAL */}
          <div className="h-10 bg-white border border-slate-200/80 rounded-lg px-3.5 py-1 shadow-xs flex items-center gap-1.5 sm:gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-xs sm:text-sm text-gray-600 hidden xs:inline">
              Total:
            </span>
            <span className="font-semibold text-gray-900 text-xs sm:text-sm">
              {logs.length}
            </span>
          </div>

          {/* REFRESH */}
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={loading}
            title="Refresh attendance records"
            className="h-10 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-lg shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span className="hidden xs:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* EXPORT */}
          <button
            onClick={() => setShowExportOptions(true)}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1 rounded-lg shadow-xs flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {showExportOptions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onClick={() => !exportingMonth && setShowExportOptions(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200/80 shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-export-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 id="attendance-export-title" className="font-semibold text-gray-800">
                Download Attendance
              </h2>
              <button
                type="button"
                onClick={() => setShowExportOptions(false)}
                aria-label="Close export options"
                className="p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg"
                disabled={exportingMonth}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 p-4">
              <button
                type="button"
                onClick={exportToExcel}
                className="flex w-full items-center gap-3 border border-gray-200 rounded-lg px-3 py-3 text-left hover:bg-gray-50 transition-colors"
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
                className="flex w-full items-center gap-3 border border-gray-200 rounded-lg px-3 py-3 text-left hover:bg-gray-50 transition-colors disabled:cursor-wait disabled:opacity-60"
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

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "On Time", value: onTimeCount, accent: "border-l-emerald-500" },
          { label: "Late", value: lateCount, accent: "border-l-amber-500" },
          { label: "Half Day", value: halfDayCount, accent: "border-l-blue-500" },
          { label: "Absent", value: absentCount, accent: "border-l-rose-500" }
        ].map((item, idx) => (
          <div
            key={idx}
            className={`bg-white border border-slate-200/80 border-l-4 ${item.accent} rounded-xl p-4 transition-all shadow-xs`}
          >
            <div className="flex items-start justify-between">
              <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
              <p className="text-xl font-bold text-slate-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CARD */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">

        {/* TIMELINE LEGEND */}
        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-700 bg-gray-50 p-3 border-b border-gray-200">

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white">
              <Briefcase className="h-3 w-3" />
            </div>
            <span className="font-medium text-slate-700">
              Working
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-r from-yellow-300 to-yellow-500 flex items-center justify-center text-white">
              <Coffee className="h-3 w-3" />
            </div>
            <span className="font-medium text-slate-700">
              Break
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-r from-gray-300 to-gray-500 flex items-center justify-center text-white">
              <PauseCircle className="h-3 w-3" />
            </div>
            <span className="font-medium text-slate-700">
              Idle
            </span>
          </div>
        </div>

        {/* SEARCH + FILTER */}
        <div className="p-2 sm:p-4 border-b border-gray-200">

          <div className="flex flex-col gap-2 sm:gap-4">

            <div className="flex flex-col xs:flex-row xs:items-center gap-2 sm:gap-4">

              {/* SEARCH */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* FILTER */}
              <button
                onClick={() =>
                  setShowFilters(
                    !showFilters
                  )
                }
                className="h-10 px-3.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-lg flex items-center gap-2 whitespace-nowrap flex-shrink-0 shadow-xs transition-colors"
              >
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="hidden xs:inline">
                  Filters
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showFilters
                    ? 'rotate-180'
                    : ''
                    }`}
                />
              </button>
            </div>

            {/* FILTER OPTIONS */}
            {showFilters && (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-200">

                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                    Status
                  </label>

                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(
                        e.target.value
                      )
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">
                      All Status
                    </option>

                    <option value="on time">
                      On Time
                    </option>

                    <option value="present">
                      Present
                    </option>

                    <option value="late">
                      Late
                    </option>

                    <option value="on leave">
                      On Leave
                    </option>

                    <option value="absent">
                      Absent
                    </option>

                    <option value="half day">
                      Half Day
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                    Sort By
                  </label>

                  <select
                    value={`${sortField}-${sortOrder}`}
                    onChange={(e) => {
                      const [
                        field,
                        order,
                      ] =
                        e.target.value.split(
                          '-'
                        );

                      setSortField(field);
                      setSortOrder(order);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="date-desc">
                      Date (Newest)
                    </option>

                    <option value="name-asc">
                      Name (A-Z)
                    </option>

                    <option value="name-desc">
                      Name (Z-A)
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mx-2 sm:mx-4 mt-2 sm:mt-4 bg-red-50 border border-red-300 text-red-600 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />

            <span className="break-words">
              {error}
            </span>
          </div>
        )}

        {/* =====================================================
            LOADING EFFECT
        ===================================================== */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-16 sm:py-24">
            <Loader2 className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-indigo-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800">Loading attendance records...</p>
            <p className="text-xs text-slate-500 mt-1">Fetching latest team logs for {formatIndianDate(selectedDate)}</p>
          </div>
        ) : filteredAndSortedLogs.length === 0 ? (

          /* EMPTY */
          <div className="text-center py-12 sm:py-16">

            <div className="flex justify-center mb-3 sm:mb-4">

              <div className="bg-blue-50 border border-blue-300 p-3 sm:p-4">

                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />

              </div>
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-gray-800">

              {searchTerm ||
                filterStatus !== 'all'
                ? 'No Results Found'
                : 'No Attendance Logs'}

            </h3>

            <p className="mt-1 text-xs sm:text-sm text-gray-500 px-4">

              {searchTerm ||
                filterStatus !== 'all'
                ? 'Try adjusting your search or filter terms'
                : 'Attendance records will appear here.'}

            </p>
          </div>
        ) : (

          /* DATA */
          <div className="p-2 sm:p-4">

            {/* DESKTOP */}
            <div className="hidden xl:block overflow-x-auto border border-gray-200">

              <table className="w-full text-sm">

                <thead>

                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase text-gray-500">

                    <th className="px-3 py-2.5 text-left">
                      #
                    </th>

                    <th className="px-3 py-2.5 text-left">
                      Employee
                    </th>

                    <th
                      className="px-3 py-2.5 text-left cursor-pointer hover:text-gray-700"
                      onClick={() =>
                        handleSort('date')
                      }
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>

                    <th className="px-3 py-2.5 text-left min-w-[280px]">
                      Timeline
                    </th>

                    <th className="px-3 py-2.5 text-left">
                      Total Hours
                    </th>

                    <th className="px-3 py-2.5 text-left">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">

                  {filteredAndSortedLogs.map(
                    (log, index) => {

                      const {
                        icon,
                      } =
                        getStatusIconAndColor(
                          log.status
                        );

                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >

                          <td className="px-3 py-3 text-sm font-medium text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-3 py-3">

                            <div className="flex items-center gap-2">

                              <div
                                className={`h-8 w-8 rounded-full ${log.avatarColor} text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs`}
                              >
                                {getInitials(
                                  log.name
                                )}
                              </div>

                              <div className="min-w-0">

                                <p className="font-medium text-gray-800 truncate max-w-[120px]">
                                  {log.name}
                                </p>

                                <p className="text-xs text-gray-400 truncate max-w-[120px]">
                                  {log.email}
                                </p>

                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {formatIndianDate(
                              log.date
                            )}
                          </td>

                          <td className="px-3 py-3 min-w-[280px]">

                            <AttendanceTimeline
                              checkIn={log.checkIn}
                              breaks={log.breaks}
                              checkOut={log.checkOut}
                              approvalStatus={log.approvalStatus}
                            />

                          </td>

                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">
                            {log.totalHours}
                          </td>

                          <td className="px-3 py-3">

                            <span
                              title={
                                log.status
                              }
                              className={`inline-flex items-center justify-center h-8 w-8 rounded border ${getStatusStyle(
                                log.status
                              )}`}
                            >
                              {icon}
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>
              </table>
            </div>

            {/* MOBILE / TABLET */}
            <div className="xl:hidden">

              <div className="space-y-3">

                {filteredAndSortedLogs.map(
                  (log, index) => {

                    const {
                      icon,
                    } =
                      getStatusIconAndColor(
                        log.status
                      );

                    return (
                      <div
                        key={log.id}
                        className="border border-gray-200 p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedLog(log)}
                      >

                        <div className="flex items-start justify-between">

                          <div className="flex items-center gap-3 flex-1 min-w-0">

                            <div
                              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full ${log.avatarColor} text-white flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 shadow-xs`}
                            >
                              {getInitials(
                                log.name
                              )}
                            </div>

                            <div className="min-w-0 flex-1">

                              <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                                {log.name}
                              </h3>

                              <p className="text-xs text-gray-400 truncate">
                                {log.email}
                              </p>

                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatIndianDate(
                                  log.date
                                )}
                              </p>

                            </div>
                          </div>

                          <div className="ml-2 flex-shrink-0">

                            <span
                              title={
                                log.status
                              }
                              className={`inline-flex items-center justify-center h-8 w-8 rounded border ${getStatusStyle(
                                log.status
                              )}`}
                            >
                              {icon}
                            </span>

                          </div>
                        </div>

                        <div className="mt-3">

                          <AttendanceTimeline
                            checkIn={log.checkIn}
                            breaks={log.breaks}
                            checkOut={log.checkOut}
                            approvalStatus={log.approvalStatus}
                          />

                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-2 text-xs text-gray-600">

                          <div className="flex items-center gap-1">

                            <Clock className="h-3 w-3 text-gray-400" />

                            <span>
                              In:{' '}
                              {formatTime(
                                log.checkIn
                              )}
                            </span>

                          </div>

                          <div className="flex items-center gap-1">

                            <Clock className="h-3 w-3 text-gray-400" />

                            <span>
                              Out:{' '}
                              {formatTime(
                                log.checkOut
                              )}
                            </span>

                          </div>

                          <div className="flex items-center gap-1">

                            <span className="font-semibold text-gray-700">
                              Total:{' '}
                              {
                                log.totalHours
                              }
                            </span>

                          </div>

                          <div className="flex items-center gap-1">

                            <span className="font-semibold text-gray-700 capitalize">
                              Status:{' '}
                              {log.status}
                            </span>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            </div>
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
              className="max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-details-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${activeLog.avatarColor} flex flex-shrink-0 items-center justify-center text-sm font-bold text-white shadow-xs`}>
                    {getInitials(activeLog.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 id="attendance-details-title" className="truncate text-lg font-bold text-gray-800">
                      {activeLog.name}
                    </h2>
                    <p className="truncate text-xs text-gray-500">
                      {formatIndianDate(activeLog.date)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close attendance details"
                  className="flex-shrink-0 p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 px-4 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(activeLog.status)}`}>
                    {activeLog.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    Total: <strong className="text-gray-800">{activeLog.totalHours}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Check In</p>
                    <p className="mt-1 text-sm font-bold text-emerald-800">{formatTime(activeLog.checkIn)}</p>
                  </div>
                  <div className="border border-rose-200 bg-rose-50 p-3">
                    <p className="text-[10px] font-semibold uppercase text-rose-700">Check Out</p>
                    <p className="mt-1 text-sm font-bold text-rose-800">{formatTime(activeLog.checkOut)}</p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[10px] font-semibold uppercase text-blue-700">Working</p>
                    <p className="mt-1 text-sm font-bold text-blue-800">{formatDuration(workingMinutes)}</p>
                  </div>
                  <div className="border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-[10px] font-semibold uppercase text-yellow-700">Break</p>
                    <p className="mt-1 text-sm font-bold text-yellow-800">{formatDuration(breakMinutes)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Time Details</h3>
                  {segments.length > 0 ? (
                    <div className="divide-y divide-gray-100 border border-gray-200">
                      {segments.map((segment, index) => (
                        <div key={`${segment.label}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs sm:px-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${segment.color === 'yellow' ? 'bg-yellow-400' : segment.color === 'gray' ? 'bg-gray-400' : 'bg-blue-500'}`} />
                            <span className="font-medium text-gray-700">{segment.label}</span>
                          </div>
                          <span className="text-gray-500">
                            {segment.startTime} - {segment.endTime}
                            <span className="ml-2 font-semibold text-gray-700">
                              ({formatDuration(segment.end - segment.start)})
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="border border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
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