// src/utils/timelineUtils.js
// Fixed 9-Hour Timeline computation and formatting utilities

/**
 * Total minutes in standard fixed shift: 9 Hours = 540 Minutes
 */
export const TOTAL_SHIFT_MINUTES = 540;

/**
 * Robust date comparison checking if given date string/object matches today in local or UTC time.
 */
export const isTodayDate = (dateVal) => {
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

/**
 * Checks if a given date string/object is strictly in the past (before today).
 */
export const isPastDate = (dateVal) => {
  if (!dateVal) return false;
  if (isTodayDate(dateVal)) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return dMidnight < todayMidnight;
};

/**
 * Formats an ISO string or time string into a 12-hour local time string (e.g. "07:00 PM")
 */
export const formatISOToLocalTime = (isoStr) => {
  if (!isoStr || isoStr === '--:--' || isoStr === 'null' || isoStr === 'undefined' || isoStr === '00:00:00' || isoStr === '00:00') {
    return '--:--';
  }
  if (typeof isoStr === 'string' && (isoStr.includes('AM') || isoStr.includes('PM'))) {
    return isoStr;
  }
  const date = new Date(isoStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return String(isoStr);
};

/**
 * Returns 7:00 PM (19:00:00) on the given date (or today) for auto check-out.
 */
export const getAutoCheckOutTimeForDate = (dateVal) => {
  const d = dateVal ? new Date(dateVal) : new Date();
  const base = isNaN(d.getTime()) ? new Date() : new Date(d);
  base.setHours(19, 0, 0, 0); // 7:00 PM local
  return {
    iso: base.toISOString(),
    timeStr: '07:00 PM',
    minutes: 19 * 60 // 1140 minutes
  };
};

/**
 * Determines whether auto check-out rule applies for a record:
 * If employees have not checked out until 11:59 PM, auto check out time is 7:00 PM at that day.
 */
export const isAutoCheckOutApplicable = (dateVal) => {
  if (!dateVal) return false;
  const now = new Date();
  const isPast = isPastDate(dateVal);
  const isToday = isTodayDate(dateVal);

  if (isPast) {
    // Midnight (11:59 PM) of that past day has already passed
    return true;
  }

  if (isToday) {
    // For today: check if 11:59 PM (23:59) has been reached
    return now.getHours() === 23 && now.getMinutes() >= 59;
  }

  return false;
};

/**
 * Calculate working hours formatted as "Xh Ym"
 * Guarantees both X (hours) and Y (minutes) are strictly integers, never floats.
 */
export const calculateWorkingHours = (checkInVal, checkOutVal, breakDurationMins = 0) => {
  const inMins = parseTimeToMinutes(checkInVal);
  if (inMins === null) return '0h 0m';

  const outMins = parseTimeToMinutes(checkOutVal);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const endMins = outMins !== null ? outMins : currentMins;
  const rawBreakNum = parseFloat(String(breakDurationMins).replace(/[^\d.-]/g, '')) || 0;
  const breakMins = Math.round(rawBreakNum);

  const netMins = Math.max(0, Math.round(endMins - inMins - breakMins));

  const hrs = Math.floor(netMins / 60);
  const mins = netMins % 60;
  return `${hrs}h ${mins}m`;
};

/**
 * Formats any hours/minutes representation into clean integer "Xh Ym"
 * Guarantees both hours and minutes are strictly integers (no floating point decimals).
 */
export const formatHoursAndMinutes = (val) => {
  if (val === undefined || val === null || val === '' || val === '--:--') {
    return '0h 0m';
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '0h 0m' || trimmed === '0h' || trimmed === '0m') return '0h 0m';

    // Match "Xh Ym" or "Xh Y.YYYm" or "X.Xh"
    const matchHm = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?/i);
    if (matchHm) {
      const rawHrs = parseFloat(matchHm[1]) || 0;
      const rawMins = matchHm[2] !== undefined ? parseFloat(matchHm[2]) || 0 : (rawHrs % 1) * 60;
      const totalMinutes = Math.round(Math.floor(rawHrs) * 60 + rawMins);
      const finalHrs = Math.floor(totalMinutes / 60);
      const finalMins = totalMinutes % 60;
      return `${finalHrs}h ${finalMins}m`;
    }

    // Match "Ym" or "Y.YYm"
    const matchM = trimmed.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/i);
    if (matchM) {
      const totalMinutes = Math.round(parseFloat(matchM[1]) || 0);
      const finalHrs = Math.floor(totalMinutes / 60);
      const finalMins = totalMinutes % 60;
      return `${finalHrs}h ${finalMins}m`;
    }

    // Match numeric string like "5.66"
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      const totalMinutes = Math.round(num * 60);
      const finalHrs = Math.floor(totalMinutes / 60);
      const finalMins = totalMinutes % 60;
      return `${finalHrs}h ${finalMins}m`;
    }

    return trimmed;
  }

  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 60);
    const finalHrs = Math.floor(totalMinutes / 60);
    const finalMins = totalMinutes % 60;
    return `${finalHrs}h ${finalMins}m`;
  }

  return '0h 0m';
};

/**
 * Normalizes an attendance record:
 * - If employee checked in and NOT checked out until 11:59 PM, auto check out time is set to 7:00 PM at that day!
 */
export const normalizeAttendanceRecord = (record) => {
  if (!record) return record;

  const now = new Date();
  const recDateStr = record.date || record.checkInTime || record.createdAt;
  const isToday = isTodayDate(recDateStr);

  const rawCheckIn = record.checkInTime || record.inTime || record.checkIn;
  const statusStr = String(record.status || '').toLowerCase().trim();
  const approvalStatusLower = String(record.approvalStatus || '').toLowerCase().trim();
  const adminStatusLower = String(record.adminStatus || '').toLowerCase().trim();
  const checkInStatusLower = String(record.checkInStatus || '').toLowerCase().trim();

  // If record was rejected by admin
  const isRej = Boolean(
    record.isRejected === true ||
    statusStr === 'rejected' ||
    statusStr.includes('reject') ||
    approvalStatusLower.includes('reject') ||
    adminStatusLower.includes('reject') ||
    checkInStatusLower.includes('reject')
  );

  if (isRej) {
    return {
      ...record,
      status: 'rejected',
      approvalStatus: 'rejected',
      isRejected: true,
      totalWorkTime: 0,
      totalWorkTimeDisplay: '0h',
      timelineSegments: []
    };
  }

  const hasCheckIn = Boolean(
    (rawCheckIn && rawCheckIn !== '--:--' && rawCheckIn !== 'null' && rawCheckIn !== 'undefined') ||
    ['present', 'late', 'half day', 'checked_in', 'on_break', 'completed'].includes(statusStr)
  );

  const rawCheckOut = record.checkOutTime || record.outTime || record.checkOut;
  const hasExistingCheckOut = Boolean(
    rawCheckOut &&
    rawCheckOut !== '--:--' &&
    rawCheckOut !== '00:00:00' &&
    rawCheckOut !== '00:00' &&
    rawCheckOut !== 'null' &&
    rawCheckOut !== 'undefined' &&
    rawCheckOut !== ''
  );

  // Auto check-out condition:
  // - If past day: 11:59 PM has already passed.
  // - If today: current time >= 23:59.
  const isPast1159PM = !isToday || (now.getHours() === 23 && now.getMinutes() >= 59);

  if (hasCheckIn && !hasExistingCheckOut && isPast1159PM) {
    let baseDate = new Date(recDateStr || Date.now());
    if (isNaN(baseDate.getTime())) baseDate = new Date();

    // Auto check out at 7:00 PM (19:00:00) on that day
    baseDate.setHours(19, 0, 0, 0);
    const autoCheckOutIso = baseDate.toISOString();
    const autoCheckOutDisplay = '07:00 PM';

    // Calculate total working hours up to 7:00 PM (1140 mins) minus break
    const startMins = parseTimeToMinutes(rawCheckIn);
    let hrs = 9;
    let mins = 0;
    if (startMins !== null) {
      const endMins = 19 * 60; // 1140 mins (7:00 PM)
      const rawBreak = parseFloat(String(record.totalBreakTime || record.breakDuration || 0).replace(/[^\d.-]/g, '')) || 0;
      const breakMins = Math.round(rawBreak);
      const netMins = Math.max(0, Math.round(endMins - startMins - breakMins));
      hrs = Math.floor(netMins / 60);
      mins = netMins % 60;
    }

    return {
      ...record,
      checkOutTime: autoCheckOutIso,
      checkOutTimeDisplay: autoCheckOutDisplay,
      isAutoCheckedOut: true,
      totalWorkTime: hrs,
      totalWorkTimeDisplay: `${hrs}h ${mins}m`,
      status: (statusStr && statusStr !== 'not_checked_in') ? statusStr : 'present'
    };
  }

  return record;
};

/**
 * Converts UTC minutes (from midnight UTC) to local minutes (from midnight local time)
 * @param {number} utcMinutes 
 * @returns {number} localMinutes
 */
export const convertUTCMinutesToLocal = (utcMinutes) => {
  if (utcMinutes === undefined || utcMinutes === null) return 0;
  const d = new Date();
  d.setUTCHours(Math.floor(utcMinutes / 60), utcMinutes % 60, 0, 0);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Formats minutes from midnight to localized 12-hour time string (e.g. "09:48 AM")
 * @param {number} totalMinutes 
 * @returns {string}
 */
export const formatMinutesToTimeStr = (totalMinutes) => {
  if (totalMinutes === undefined || totalMinutes === null || isNaN(totalMinutes)) return '--:--';
  const d = new Date();
  d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Parses any ISO string, Date object, or time string ("HH:MM:SS" or "HH:MM AM/PM")
 * into local minutes from midnight.
 * @param {string|Date|number} timeVal 
 * @returns {number|null}
 */
export const parseTimeToMinutes = (timeVal) => {
  if (timeVal === undefined || timeVal === null || timeVal === '' || timeVal === '--:--') return null;
  if (typeof timeVal === 'number') return timeVal;

  // If already a Date object
  if (timeVal instanceof Date) {
    if (isNaN(timeVal.getTime())) return null;
    return timeVal.getHours() * 60 + timeVal.getMinutes();
  }

  // If ISO string containing 'T'
  if (typeof timeVal === 'string' && timeVal.includes('T')) {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  // If 12-hour or 24-hour time string (e.g. "09:48 AM", "18:30", "9:45:00 PM")
  if (typeof timeVal === 'string') {
    const match = timeVal.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
    if (match) {
      let hrs = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const ampm = (match[4] || '').toUpperCase();
      if (ampm === 'PM' && hrs < 12) hrs += 12;
      if (ampm === 'AM' && hrs === 12) hrs = 0;
      return hrs * 60 + mins;
    }
  }

  return null;
};

/**
 * Computes a strictly fixed 9-hour timeline starting from check-in time.
 * - Timeline span is strictly 9 hours (540 minutes).
 * - Working time rendered in Blue (#3B82F6).
 * - Break time rendered in Orange (#F59E0B).
 * - Late check-in or early checkout or remaining shift time rendered in Gray (#94A3B8 / bg-slate-300).
 * - Timeline starts from when employee checks in.
 * - Remaining time is shown at the end in Gray.
 *
 * @param {Object} options
 * @param {string|Date} [options.checkInTime]
 * @param {string|Date} [options.checkOutTime]
 * @param {Array} [options.timelineSegments] Backend timeline segments array
 * @param {boolean} [options.isOnBreak]
 * @param {boolean} [options.isCheckedIn]
 * @param {boolean} [options.isCheckedOut]
 * @param {Array} [options.breaks]
 * @returns {Object} { startMinutes, endMinutes, midMinutes, startTimeStr, midTimeStr, endTimeStr, displaySegments, hasCheckedIn, breakStartTime }
 */
export const computeNineHourTimeline = ({
  checkInTime = null,
  checkOutTime = null,
  breakInTime = null,
  breakOutTime = null,
  timelineSegments = [],
  isOnBreak = false,
  isCheckedIn = false,
  isCheckedOut = false,
  isRejected = false,
  breaks = []
}) => {
  const TOTAL_MINUTES = TOTAL_SHIFT_MINUTES; // 540 minutes = 9 hours

  let startMinutes = parseTimeToMinutes(checkInTime);

  // If rejected by admin: shift was NOT approved/active. Do not draw working time segments or continue progress!
  if (isRejected) {
    if (startMinutes === null) {
      startMinutes = 540; // 09:00 AM default
    }
    const endMinutes = startMinutes + TOTAL_MINUTES;
    const midMinutes = startMinutes + 270;

    const statusMarkers = [];
    statusMarkers.push({
      id: 'marker-checkin-rejected',
      type: 'check_in',
      label: 'Check In (Rejected)',
      timeStr: formatMinutesToTimeStr(startMinutes),
      minutes: startMinutes,
      percent: 0,
      color: '#10B981',
      badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      dotClass: 'bg-emerald-500'
    });

    statusMarkers.push({
      id: 'marker-shiftend',
      type: 'shift_end',
      label: '9h End',
      timeStr: formatMinutesToTimeStr(endMinutes),
      minutes: endMinutes,
      percent: 100,
      color: '#64748B',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      dotClass: 'bg-slate-500'
    });

    return {
      startMinutes,
      endMinutes,
      midMinutes,
      startTimeStr: formatMinutesToTimeStr(startMinutes),
      midTimeStr: formatMinutesToTimeStr(midMinutes),
      endTimeStr: formatMinutesToTimeStr(endMinutes),
      breakStartTime: '',
      displaySegments: [], // Strictly EMPTY when rejected - no active work bar!
      statusMarkers,
      hasCheckedIn: false
    };
  }

  // If no check-in time parsed yet, inspect earliest active segment from backend
  if (startMinutes === null && Array.isArray(timelineSegments) && timelineSegments.length > 0) {
    const activeSegs = timelineSegments.filter(s => s.type === 'blue' || s.type === 'yellow');
    if (activeSegs.length > 0) {
      let minFrom = Infinity;
      activeSegs.forEach(s => {
        const localFrom = convertUTCMinutesToLocal(s.fromMinutes);
        if (localFrom < minFrom) minFrom = localFrom;
      });
      if (minFrom !== Infinity) startMinutes = minFrom;
    }
  }

  const hasCheckedIn = Boolean(!isRejected && (isCheckedIn || startMinutes !== null));

  // Fallback start time if not checked in: default 9:00 AM (540 minutes from midnight)
  if (startMinutes === null) {
    startMinutes = 540; // 09:00 AM default
  }

  // Exactly 9 hours after check-in
  const endMinutes = startMinutes + TOTAL_MINUTES;
  // 4.5 hours midpoint
  const midMinutes = startMinutes + 270;

  const MAX_STANDARD_BREAK_MINUTES = 60; // Standard break allowance is 1 hour (60 minutes)
  let accumulatedBreakMinutes = 0;
  let displaySegments = [];
  let breakStartTime = '';

  // 1. Process backend timelineSegments if present
  if (!isRejected && Array.isArray(timelineSegments) && timelineSegments.length > 0) {
    const parsedCheckOut = parseTimeToMinutes(checkOutTime);
    const maxAllowedEnd = (isCheckedOut && parsedCheckOut !== null)
      ? Math.min(endMinutes, parsedCheckOut)
      : endMinutes;

    timelineSegments.forEach((seg, idx) => {
      const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
      const localTo = convertUTCMinutesToLocal(seg.toMinutes);

      // Clamp strictly within the 9-hour timeline [startMinutes, maxAllowedEnd]
      const clampedFrom = Math.max(startMinutes, localFrom);
      const clampedTo = Math.min(maxAllowedEnd, localTo);

      if (clampedTo > clampedFrom) {
        const isBreak = seg.type === 'yellow' || (seg.label || '').toLowerCase().includes('break');
        const isInactiveOrLate =
          seg.type === 'grey' ||
          seg.type === 'gray' ||
          (seg.label || '').toLowerCase().includes('late') ||
          (seg.label || '').toLowerCase().includes('early');

        if (isBreak) {
          if (!breakStartTime) breakStartTime = formatMinutesToTimeStr(clampedFrom);

          const breakDuration = clampedTo - clampedFrom;
          const remainingAllowed = Math.max(0, MAX_STANDARD_BREAK_MINUTES - accumulatedBreakMinutes);
          const standardBreakDuration = Math.min(breakDuration, remainingAllowed);
          const excessBreakDuration = breakDuration - standardBreakDuration;

          // Standard Break (up to 1 hour): Orange (#F59E0B)
          if (standardBreakDuration > 0) {
            const stdEnd = clampedFrom + standardBreakDuration;
            const leftPercent = Math.max(0, ((clampedFrom - startMinutes) / TOTAL_MINUTES) * 100);
            const widthPercent = Math.min(100 - leftPercent, (standardBreakDuration / TOTAL_MINUTES) * 100);

            displaySegments.push({
              id: `seg-${idx}-break-std`,
              leftPercent,
              widthPercent,
              color: '#F59E0B',
              colorClass: 'bg-[#F59E0B]',
              type: 'break',
              label: `Break Time (${formatMinutesToTimeStr(clampedFrom)} - ${formatMinutesToTimeStr(stdEnd)})`
            });
          }

          // Excess Break (> 1 hour): Grey (#94A3B8 / bg-slate-400
          if (excessBreakDuration > 0) {
            const excessStart = clampedFrom + standardBreakDuration;
            const leftPercent = Math.max(0, ((excessStart - startMinutes) / TOTAL_MINUTES) * 100);
            const widthPercent = Math.min(100 - leftPercent, (excessBreakDuration / TOTAL_MINUTES) * 100);

            displaySegments.push({
              id: `seg-${idx}-break-extra`,
              leftPercent,
              widthPercent,
              color: '#94A3B8',
              colorClass: 'bg-slate-400',
              type: 'gray',
              label: `Extra Break (>1 hr) (${formatMinutesToTimeStr(excessStart)} - ${formatMinutesToTimeStr(clampedTo)})`
            });
          }

          accumulatedBreakMinutes += breakDuration;
        } else if (isInactiveOrLate) {
          const leftPercent = Math.max(0, ((clampedFrom - startMinutes) / TOTAL_MINUTES) * 100);
          const widthPercent = Math.min(100 - leftPercent, ((clampedTo - clampedFrom) / TOTAL_MINUTES) * 100);

          displaySegments.push({
            id: `seg-${idx}-inactive`,
            leftPercent,
            widthPercent,
            color: '#94A3B8',
            colorClass: 'bg-slate-400',
            type: 'gray',
            label: `${seg.label || 'Early Checkout / Inactive'} (${formatMinutesToTimeStr(clampedFrom)} - ${formatMinutesToTimeStr(clampedTo)})`
          });
        } else {
          // Working Time: Blue (#3B82F6)
          const leftPercent = Math.max(0, ((clampedFrom - startMinutes) / TOTAL_MINUTES) * 100);
          const widthPercent = Math.min(100 - leftPercent, ((clampedTo - clampedFrom) / TOTAL_MINUTES) * 100);

          displaySegments.push({
            id: `seg-${idx}-work`,
            leftPercent,
            widthPercent,
            color: '#3B82F6',
            colorClass: 'bg-[#3B82F6]',
            type: 'work',
            label: `Working Time (${formatMinutesToTimeStr(clampedFrom)} - ${formatMinutesToTimeStr(clampedTo)})`
          });
        }
      }
    });
  } else if (!isRejected && hasCheckedIn) {
    // 2. Fallback: Build live segments dynamically from check-in, breaks, checkout/current time
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const parsedCheckOut = parseTimeToMinutes(checkOutTime);

    const effectiveEndMinutes = (isCheckedOut && parsedCheckOut !== null)
      ? parsedCheckOut
      : Math.min(endMinutes, currentMinutes);

    if (effectiveEndMinutes > startMinutes) {
      if (Array.isArray(breaks) && breaks.length > 0) {
        let cursor = startMinutes;
        breaks.forEach((b, bIdx) => {
          const bStart = parseTimeToMinutes(b.startTime || b.from);
          const bEnd = parseTimeToMinutes(b.endTime || b.to) || (isOnBreak ? currentMinutes : effectiveEndMinutes);

          if (bStart !== null && bStart > cursor) {
            const wClampedFrom = Math.max(startMinutes, cursor);
            const wClampedTo = Math.min(endMinutes, bStart);
            if (wClampedTo > wClampedFrom) {
              const left = ((wClampedFrom - startMinutes) / TOTAL_MINUTES) * 100;
              const width = ((wClampedTo - wClampedFrom) / TOTAL_MINUTES) * 100;
              displaySegments.push({
                id: `live-work-${bIdx}`,
                leftPercent: left,
                widthPercent: width,
                color: '#3B82F6',
                colorClass: 'bg-[#3B82F6]',
                type: 'work',
                label: `Working Time (${formatMinutesToTimeStr(wClampedFrom)} - ${formatMinutesToTimeStr(wClampedTo)})`
              });
            }
          }

          if (bStart !== null) {
            const bClampedFrom = Math.max(startMinutes, bStart);
            const bClampedTo = Math.min(endMinutes, bEnd || effectiveEndMinutes);
            if (bClampedTo > bClampedFrom) {
              const breakDuration = bClampedTo - bClampedFrom;
              const remainingAllowed = Math.max(0, MAX_STANDARD_BREAK_MINUTES - accumulatedBreakMinutes);
              const standardBreakDuration = Math.min(breakDuration, remainingAllowed);
              const excessBreakDuration = breakDuration - standardBreakDuration;

              if (!breakStartTime) breakStartTime = formatMinutesToTimeStr(bClampedFrom);

              if (standardBreakDuration > 0) {
                const stdEnd = bClampedFrom + standardBreakDuration;
                const left = ((bClampedFrom - startMinutes) / TOTAL_MINUTES) * 100;
                const width = (standardBreakDuration / TOTAL_MINUTES) * 100;
                displaySegments.push({
                  id: `live-break-${bIdx}-std`,
                  leftPercent: left,
                  widthPercent: width,
                  color: '#F59E0B',
                  colorClass: 'bg-[#F59E0B]',
                  type: 'break',
                  label: `Break Time (${formatMinutesToTimeStr(bClampedFrom)} - ${formatMinutesToTimeStr(stdEnd)})`
                });
              }

              if (excessBreakDuration > 0) {
                const excessStart = bClampedFrom + standardBreakDuration;
                const left = ((excessStart - startMinutes) / TOTAL_MINUTES) * 100;
                const width = (excessBreakDuration / TOTAL_MINUTES) * 100;
                displaySegments.push({
                  id: `live-break-${bIdx}-extra`,
                  leftPercent: left,
                  widthPercent: width,
                  color: '#94A3B8',
                  colorClass: 'bg-slate-400',
                  type: 'gray',
                  label: `Extra Break (>1 hr) (${formatMinutesToTimeStr(excessStart)} - ${formatMinutesToTimeStr(bClampedTo)})`
                });
              }

              accumulatedBreakMinutes += breakDuration;
              cursor = bClampedTo;
            }
          }
        });

        if (cursor < effectiveEndMinutes) {
          const wClampedFrom = Math.max(startMinutes, cursor);
          const wClampedTo = Math.min(endMinutes, effectiveEndMinutes);
          if (wClampedTo > wClampedFrom) {
            const left = ((wClampedFrom - startMinutes) / TOTAL_MINUTES) * 100;
            const width = ((wClampedTo - wClampedFrom) / TOTAL_MINUTES) * 100;
            displaySegments.push({
              id: 'live-work-final',
              leftPercent: left,
              widthPercent: width,
              color: '#3B82F6',
              colorClass: 'bg-[#3B82F6]',
              type: 'work',
              label: `Working Time (${formatMinutesToTimeStr(wClampedFrom)} - ${formatMinutesToTimeStr(wClampedTo)})`
            });
          }
        }
      } else {
        const clampedEnd = Math.min(endMinutes, effectiveEndMinutes);
        const duration = clampedEnd - startMinutes;

        if (isOnBreak) {
          const remainingAllowed = Math.max(0, MAX_STANDARD_BREAK_MINUTES - accumulatedBreakMinutes);
          const standardBreakDuration = Math.min(duration, remainingAllowed);
          const excessBreakDuration = duration - standardBreakDuration;

          if (standardBreakDuration > 0) {
            const stdEnd = startMinutes + standardBreakDuration;
            const widthPercent = Math.min(100, (standardBreakDuration / TOTAL_MINUTES) * 100);
            displaySegments.push({
              id: 'live-break-single-std',
              leftPercent: 0,
              widthPercent,
              color: '#F59E0B',
              colorClass: 'bg-[#F59E0B]',
              type: 'break',
              label: `Break Time (${formatMinutesToTimeStr(startMinutes)} - ${formatMinutesToTimeStr(stdEnd)})`
            });
          }

          if (excessBreakDuration > 0) {
            const excessStart = startMinutes + standardBreakDuration;
            const leftPercent = (standardBreakDuration / TOTAL_MINUTES) * 100;
            const widthPercent = Math.min(100 - leftPercent, (excessBreakDuration / TOTAL_MINUTES) * 100);
            displaySegments.push({
              id: 'live-break-single-extra',
              leftPercent,
              widthPercent,
              color: '#94A3B8',
              colorClass: 'bg-slate-400',
              type: 'gray',
              label: `Extra Break (>1 hr) (${formatMinutesToTimeStr(excessStart)} - ${formatMinutesToTimeStr(clampedEnd)})`
            });
          }
        } else {
          const widthPercent = Math.min(100, (duration / TOTAL_MINUTES) * 100);
          displaySegments.push({
            id: 'live-work-single',
            leftPercent: 0,
            widthPercent,
            color: '#3B82F6',
            colorClass: 'bg-[#3B82F6]',
            type: 'work',
            label: `Working Time (${formatMinutesToTimeStr(startMinutes)} - ${formatMinutesToTimeStr(clampedEnd)})`
          });
        }
      }
    }
  }

  // 3. Build status transition markers: Check In, Break In, Extra Break, Break Out, Check Out, 9h End
  const statusMarkers = [];

  if (hasCheckedIn && startMinutes !== null) {
    statusMarkers.push({
      id: 'marker-checkin',
      type: 'check_in',
      label: 'Check In',
      timeStr: formatMinutesToTimeStr(startMinutes),
      minutes: startMinutes,
      percent: 0,
      color: '#00E676',
      badgeClass: 'bg-emerald-500/10 text-[#00E676] border-[#00E676]/30',
      dotClass: 'bg-[#00E676]'
    });
  } else {
    statusMarkers.push({
      id: 'marker-checkin-placeholder',
      type: 'check_in',
      label: 'Check In',
      timeStr: '--:--',
      minutes: startMinutes,
      percent: 0,
      color: '#94A3B8',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      dotClass: 'bg-slate-400'
    });
  }

  // Inspect break transitions from displaySegments
  displaySegments.forEach((seg, sIdx) => {
    if (seg.type === 'break') {
      const segStartMins = Math.round(startMinutes + (seg.leftPercent / 100) * TOTAL_MINUTES);
      const segEndMins = Math.round(startMinutes + ((seg.leftPercent + seg.widthPercent) / 100) * TOTAL_MINUTES);

      if (!statusMarkers.some(m => m.type === 'break_in' && Math.abs(m.minutes - segStartMins) < 3)) {
        statusMarkers.push({
          id: `marker-breakin-${sIdx}`,
          type: 'break_in',
          label: 'Break In',
          timeStr: formatMinutesToTimeStr(segStartMins),
          minutes: segStartMins,
          percent: Number(seg.leftPercent.toFixed(1)),
          color: '#F59E0B',
          badgeClass: 'bg-amber-500/10 text-[#F59E0B] border-[#F59E0B]/30',
          dotClass: 'bg-[#F59E0B]'
        });
      }

      // If no extra break immediately follows and shift hasn't ended on break
      const hasAdjacentExtra = displaySegments.some(
        other => (other.id.includes('extra') || other.type === 'gray') &&
          Math.abs(other.leftPercent - (seg.leftPercent + seg.widthPercent)) < 0.5
      );

      if (!hasAdjacentExtra && !isOnBreak && segEndMins <= endMinutes) {
        if (!statusMarkers.some(m => m.type === 'break_out' && Math.abs(m.minutes - segEndMins) < 3)) {
          statusMarkers.push({
            id: `marker-breakout-${sIdx}`,
            type: 'break_out',
            label: 'Break Out',
            timeStr: formatMinutesToTimeStr(segEndMins),
            minutes: segEndMins,
            percent: Number(((segEndMins - startMinutes) / TOTAL_MINUTES * 100).toFixed(1)),
            color: '#10B981',
            badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
            dotClass: 'bg-emerald-500'
          });
        }
      }
    } else if (seg.id.includes('extra') || (seg.label || '').toLowerCase().includes('extra break')) {
      const segStartMins = Math.round(startMinutes + (seg.leftPercent / 100) * TOTAL_MINUTES);
      const segEndMins = Math.round(startMinutes + ((seg.leftPercent + seg.widthPercent) / 100) * TOTAL_MINUTES);

      if (!statusMarkers.some(m => m.type === 'extra_break' && Math.abs(m.minutes - segStartMins) < 3)) {
        statusMarkers.push({
          id: `marker-extrabreak-${sIdx}`,
          type: 'extra_break',
          label: 'Extra Break',
          timeStr: formatMinutesToTimeStr(segStartMins),
          minutes: segStartMins,
          percent: Number(seg.leftPercent.toFixed(1)),
          color: '#94A3B8',
          badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          dotClass: 'bg-slate-400'
        });
      }

      if (!isOnBreak && segEndMins <= endMinutes) {
        if (!statusMarkers.some(m => m.type === 'break_out' && Math.abs(m.minutes - segEndMins) < 3)) {
          statusMarkers.push({
            id: `marker-breakout-extra-${sIdx}`,
            type: 'break_out',
            label: 'Break Out',
            timeStr: formatMinutesToTimeStr(segEndMins),
            minutes: segEndMins,
            percent: Number(((segEndMins - startMinutes) / TOTAL_MINUTES * 100).toFixed(1)),
            color: '#10B981',
            badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
            dotClass: 'bg-emerald-500'
          });
        }
      }
    }
  });

  // Check explicit breakInTime / breakOutTime
  const parsedBreakIn = parseTimeToMinutes(breakInTime);
  const parsedBreakOut = parseTimeToMinutes(breakOutTime);

  if (parsedBreakIn !== null && parsedBreakIn >= startMinutes && parsedBreakIn <= endMinutes) {
    if (!statusMarkers.some(m => m.type === 'break_in')) {
      const bInPct = Number((((parsedBreakIn - startMinutes) / TOTAL_MINUTES) * 100).toFixed(1));
      statusMarkers.push({
        id: 'marker-breakin-prop',
        type: 'break_in',
        label: 'Break In',
        timeStr: formatMinutesToTimeStr(parsedBreakIn),
        minutes: parsedBreakIn,
        percent: bInPct,
        color: '#F59E0B',
        badgeClass: 'bg-amber-500/10 text-[#F59E0B] border-[#F59E0B]/30',
        dotClass: 'bg-[#F59E0B]'
      });

      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      const effectiveBreakEnd = parsedBreakOut !== null ? parsedBreakOut : (isOnBreak ? nowMins : null);
      if (effectiveBreakEnd !== null && effectiveBreakEnd - parsedBreakIn > 60) {
        const extraMins = parsedBreakIn + 60;
        if (!statusMarkers.some(m => m.type === 'extra_break')) {
          const extraPct = Number((((extraMins - startMinutes) / TOTAL_MINUTES) * 100).toFixed(1));
          statusMarkers.push({
            id: 'marker-extrabreak-prop',
            type: 'extra_break',
            label: 'Extra Break',
            timeStr: formatMinutesToTimeStr(extraMins),
            minutes: extraMins,
            percent: extraPct,
            color: '#94A3B8',
            badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
            dotClass: 'bg-slate-400'
          });
        }
      }
    }
  }

  if (parsedBreakOut !== null && parsedBreakOut >= startMinutes && parsedBreakOut <= endMinutes) {
    if (!statusMarkers.some(m => m.type === 'break_out')) {
      const bOutPct = Number((((parsedBreakOut - startMinutes) / TOTAL_MINUTES) * 100).toFixed(1));
      statusMarkers.push({
        id: 'marker-breakout-prop',
        type: 'break_out',
        label: 'Break Out',
        timeStr: formatMinutesToTimeStr(parsedBreakOut),
        minutes: parsedBreakOut,
        percent: bOutPct,
        color: '#10B981',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
        dotClass: 'bg-emerald-500'
      });
    }
  }

  // Check Out marker
  const parsedCheckOut = parseTimeToMinutes(checkOutTime);
  if ((isCheckedOut || parsedCheckOut !== null) && parsedCheckOut !== null && parsedCheckOut >= startMinutes) {
    if (!statusMarkers.some(m => m.type === 'check_out')) {
      const outPct = Number((Math.max(0, Math.min(100, ((parsedCheckOut - startMinutes) / TOTAL_MINUTES) * 100))).toFixed(1));
      statusMarkers.push({
        id: 'marker-checkout',
        type: 'check_out',
        label: 'Check Out',
        timeStr: formatMinutesToTimeStr(parsedCheckOut),
        minutes: parsedCheckOut,
        percent: outPct,
        color: '#EF4444',
        badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30',
        dotClass: 'bg-red-500'
      });
    }
  }

  // 9h Shift End marker
  if (hasCheckedIn) {
    statusMarkers.push({
      id: 'marker-shiftend',
      type: 'shift_end',
      label: '9h End',
      timeStr: formatMinutesToTimeStr(endMinutes),
      minutes: endMinutes,
      percent: 100,
      color: '#64748B',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      dotClass: 'bg-slate-500'
    });
  } else {
    statusMarkers.push({
      id: 'marker-shiftend-placeholder',
      type: 'shift_end',
      label: '9h End',
      timeStr: '--:--',
      minutes: endMinutes,
      percent: 100,
      color: '#64748B',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      dotClass: 'bg-slate-500'
    });
  }

  // Chronologically sort all status transition markers
  statusMarkers.sort((a, b) => a.minutes - b.minutes);

  return {
    startMinutes,
    endMinutes,
    midMinutes,
    startTimeStr: hasCheckedIn ? formatMinutesToTimeStr(startMinutes) : '--:--',
    midTimeStr: hasCheckedIn ? formatMinutesToTimeStr(midMinutes) : '--:--',
    endTimeStr: hasCheckedIn ? formatMinutesToTimeStr(endMinutes) : '--:--',
    breakStartTime,
    displaySegments,
    statusMarkers,
    hasCheckedIn
  };
};

/**
 * Evaluates attendance status according to exact business rules:
 *
 * 1. Admin Status Check:
 *    - If record is rejected (status includes 'reject' or adminStatus === 'rejected') -> 'Rejected'
 *
 * 2. Break Limit Rule:
 *    - Max allowed break is 70 minutes (1h 10m).
 *    - If total break time > 70 minutes -> capped at 'Half Day' (unless hours < 4h -> 'Absent').
 *
 * 3. Working Hours Rule (FIRST PRIORITY for evaluated/completed attendance):
 *    - If net working hours >= 7h 50m (470 mins) -> 'Present' (or 'Half Day' if break > 70m)
 *    - If net working hours < 7h 50m (470 mins) and >= 4h (240 mins) -> 'Half Day'
 *    - If net working hours < 4h (240 mins) -> 'Absent'
 *
 * 4. Check-in Time Rule (Used upon check-in or when shift is ongoing / before checkout):
 *    - 09:30 AM to 10:10 AM -> 'Present'
 *    - 10:11 AM to 10:30 AM -> 'Present (Late)' / 'Late'
 *    - 10:31 AM to 03:00 PM (15:00) -> 'Half Day'
 *    - After 03:00 PM (> 15:00) -> 'Absent'
 *    - Before 09:30 AM -> 'Present' (early/on time)
 */
export const deriveAttendanceStatus = ({
  checkInTime = null,
  checkOutTime = null,
  totalWorkMinutes = null,
  totalBreakMinutes = 0,
  adminStatus = null,
  approvalStatus = null,
  checkInStatus = null,
  isRejected = false,
  isPending = false,
  rejectionReason = '',
  status = null,
  isCompleted = false
}) => {
  const statusStr = String(status || '').toLowerCase().trim();
  const adminStr = String(adminStatus || '').toLowerCase().trim();
  const apprvStr = String(approvalStatus || '').toLowerCase().trim();
  const checkInStatusStr = String(checkInStatus || '').toLowerCase().trim();

  // 1. Admin Rejection Check: ONLY when rejected status is explicitly indicated
  if (
    isRejected ||
    statusStr === 'rejected' ||
    statusStr.includes('reject') ||
    adminStr.includes('reject') ||
    apprvStr.includes('reject') ||
    checkInStatusStr.includes('reject')
  ) {
    return {
      status: 'rejected',
      label: 'Rejected',
      reason: rejectionReason || 'Attendance request rejected by admin',
      badgeClass: 'text-red-700 bg-red-50 border-red-200',
      dotClass: 'bg-red-500'
    };
  }

  // 2. Admin Pending Check
  if (
    isPending ||
    statusStr.includes('pending') ||
    adminStr.includes('pending') ||
    apprvStr.includes('pending') ||
    checkInStatusStr.includes('pending')
  ) {
    return {
      status: 'pending',
      label: 'Pending Approval',
      reason: 'Check-in request pending admin approval',
      badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
      dotClass: 'bg-amber-500'
    };
  }

  // Parse Check-in time to minutes from midnight
  const inMins = parseTimeToMinutes(checkInTime);
  const outMins = parseTimeToMinutes(checkOutTime);
  const hasCheckedOut = Boolean(outMins !== null || isCompleted || statusStr.includes('checked_out') || statusStr.includes('completed'));

  // Calculate or parse break duration in minutes
  const breakMins = Math.round(parseFloat(String(totalBreakMinutes).replace(/[^\d.-]/g, '')) || 0);
  const isBreakExceeded = breakMins > 70; // Maximum break 70 mins (1h 10m)

  // Calculate or parse net working minutes
  let netWorkMins = totalWorkMinutes;
  if (netWorkMins === null || netWorkMins === undefined) {
    if (inMins !== null) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const endMins = outMins !== null ? outMins : currentMins;
      netWorkMins = Math.max(0, endMins - inMins - breakMins);
    } else {
      netWorkMins = 0;
    }
  }

  // Check-in Time evaluation:
  // 09:30 AM = 570 mins, 10:10 AM = 610 mins
  // 10:11 AM = 611 mins, 10:30 AM = 630 mins
  // 10:31 AM = 631 mins, 03:00 PM (15:00) = 900 mins
  let checkInClassification = 'present';
  if (inMins !== null) {
    if (inMins > 900) {
      checkInClassification = 'absent'; // After 3:00 PM
    } else if (inMins > 630) {
      checkInClassification = 'half_day'; // 10:31 AM to 3:00 PM
    } else if (inMins > 610) {
      checkInClassification = 'late'; // 10:11 AM to 10:30 AM
    } else {
      checkInClassification = 'present'; // 09:30 AM to 10:10 AM (or earlier)
    }
  }

  // FIRST PRIORITY RULE: Working hours rule (applies when checked out or shift completed)
  // >= 7h 50m (470 mins) -> Present
  // < 7h 50m (470 mins) & >= 4h (240 mins) -> Half Day
  // < 4h (240 mins) -> Absent
  if (hasCheckedOut) {
    if (netWorkMins < 240) {
      return {
        status: 'absent',
        label: 'Absent',
        reason: 'Worked less than 4 hours',
        badgeClass: 'text-red-700 bg-red-50 border-red-200',
        dotClass: 'bg-red-500'
      };
    }

    if (netWorkMins < 470) {
      return {
        status: 'half_day',
        label: 'Half Day',
        reason: 'Worked less than 7h 50m',
        badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        dotClass: 'bg-indigo-600'
      };
    }

    // netWorkMins >= 470 (>= 7h 50m)
    // Check if break exceeded 70 mins:
    if (isBreakExceeded) {
      return {
        status: 'half_day',
        label: 'Half Day',
        reason: `Break exceeded 70 mins (${breakMins}m)`,
        badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        dotClass: 'bg-indigo-600'
      };
    }

    // Check-in classification:
    if (checkInClassification === 'half_day') {
      return {
        status: 'half_day',
        label: 'Half Day',
        reason: 'Check-in after 10:30 AM',
        badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        dotClass: 'bg-indigo-600'
      };
    }

    if (checkInClassification === 'late') {
      return {
        status: 'late',
        label: 'Present (Late)',
        reason: 'Checked in between 10:11 - 10:30 AM',
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    }

    return {
      status: 'present',
      label: 'Present',
      reason: 'Standard shift completed on time',
      badgeClass: 'text-green-700 bg-green-50 border-green-200',
      dotClass: 'bg-green-500'
    };
  }

  // If ongoing shift (hasCheckedIn && !hasCheckedOut):
  if (inMins !== null) {
    if (isBreakExceeded) {
      return {
        status: 'half_day',
        label: 'Half Day',
        reason: `Break exceeded 70 mins (${breakMins}m)`,
        badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        dotClass: 'bg-indigo-600'
      };
    }

    if (checkInClassification === 'late') {
      return {
        status: 'late',
        label: 'Late',
        reason: 'Checked in between 10:11 - 10:30 AM',
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    }

    if (checkInClassification === 'half_day') {
      return {
        status: 'half_day',
        label: 'Half Day',
        reason: 'Checked in between 10:31 AM - 3:00 PM',
        badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        dotClass: 'bg-indigo-600'
      };
    }

    if (checkInClassification === 'absent') {
      return {
        status: 'absent',
        label: 'Absent',
        reason: 'Checked in after 3:00 PM',
        badgeClass: 'text-red-700 bg-red-50 border-red-200',
        dotClass: 'bg-red-500'
      };
    }

    return {
      status: 'present',
      label: 'Present',
      badgeClass: 'text-green-700 bg-green-50 border-green-200',
      dotClass: 'bg-green-500'
    };
  }

  return {
    status: 'not_checked_in',
    label: 'Not Checked In',
    badgeClass: 'text-slate-500 bg-slate-50 border-slate-200',
    dotClass: 'bg-slate-400'
  };
};

/**
 * Status text and color resolver matching user specification:
 * - isRejected -> 'Rejected' (Red)
 * - isPending -> 'Pending Approval' (Amber)
 * - hasCheckedOut -> 'Checked Out' (Slate/muted)
 * - isOnBreak -> 'On Break' (#F59E0B)
 * - hasCheckedIn -> 'Working' (#00E676)
 * - else -> 'Not Checked In' (Slate/muted)
 */
export const getQuickActionStatusConfig = ({ hasCheckedIn, isOnBreak, hasCheckedOut, isRejected = false, isPending = false }) => {
  if (isRejected) {
    return {
      statusText: 'Rejected',
      badgeColorClass: 'text-red-600 bg-red-500/10 border-red-500/30',
      dotColorClass: 'bg-red-500 animate-pulse'
    };
  } else if (isPending) {
    return {
      statusText: 'Pending Approval',
      badgeColorClass: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
      dotColorClass: 'bg-amber-500 animate-pulse'
    };
  } else if (hasCheckedOut) {
    return {
      statusText: 'Checked Out',
      badgeColorClass: 'text-slate-600 bg-slate-100 border-slate-200',
      dotColorClass: 'bg-slate-400'
    };
  } else if (isOnBreak) {
    return {
      statusText: 'On Break',
      badgeColorClass: 'text-[#F59E0B] bg-amber-500/10 border-[#F59E0B]/30',
      dotColorClass: 'bg-[#F59E0B] animate-pulse'
    };
  } else if (hasCheckedIn) {
    return {
      statusText: 'Working',
      badgeColorClass: 'text-[#00E676] bg-emerald-500/10 border-[#00E676]/30',
      dotColorClass: 'bg-[#00E676] animate-pulse'
    };
  } else {
    return {
      statusText: 'Not Checked In',
      badgeColorClass: 'text-slate-500 bg-slate-50 border-slate-200',
      dotColorClass: 'bg-slate-400'
    };
  }
};
