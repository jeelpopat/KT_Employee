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
  breaks = []
}) => {
  const TOTAL_MINUTES = TOTAL_SHIFT_MINUTES; // 540 minutes = 9 hours

  let startMinutes = parseTimeToMinutes(checkInTime);

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

  const hasCheckedIn = Boolean(isCheckedIn || startMinutes !== null);

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
  if (Array.isArray(timelineSegments) && timelineSegments.length > 0) {
    timelineSegments.forEach((seg, idx) => {
      const localFrom = convertUTCMinutesToLocal(seg.fromMinutes);
      const localTo = convertUTCMinutesToLocal(seg.toMinutes);

      // Clamp strictly within the 9-hour timeline [startMinutes, endMinutes]
      const clampedFrom = Math.max(startMinutes, localFrom);
      const clampedTo = Math.min(endMinutes, localTo);

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

          // Excess Break (> 1 hour): Grey (#94A3B8 / bg-slate-400 dark:bg-slate-500)
          if (excessBreakDuration > 0) {
            const excessStart = clampedFrom + standardBreakDuration;
            const leftPercent = Math.max(0, ((excessStart - startMinutes) / TOTAL_MINUTES) * 100);
            const widthPercent = Math.min(100 - leftPercent, (excessBreakDuration / TOTAL_MINUTES) * 100);

            displaySegments.push({
              id: `seg-${idx}-break-extra`,
              leftPercent,
              widthPercent,
              color: '#94A3B8',
              colorClass: 'bg-slate-400 dark:bg-slate-500',
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
            colorClass: 'bg-slate-400 dark:bg-slate-500',
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
  } else if (hasCheckedIn) {
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
                  colorClass: 'bg-slate-400 dark:bg-slate-500',
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
              colorClass: 'bg-slate-400 dark:bg-slate-500',
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
            badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
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
            badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
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
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-500'
      });
    }
  }

  // Check Out marker
  const parsedCheckOut = parseTimeToMinutes(checkOutTime);
  if ((isCheckedOut || parsedCheckOut !== null) && parsedCheckOut !== null && parsedCheckOut >= startMinutes && parsedCheckOut <= endMinutes) {
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
 * Status text and color resolver matching user specification:
 * - hasCheckedOut -> 'Checked Out' (Slate/muted)
 * - isOnBreak -> 'Break In' (#F59E0B)
 * - hasCheckedIn -> 'Check In' (#00E676)
 * - else -> 'Not Checked In' (Slate/muted)
 */
export const getQuickActionStatusConfig = ({ hasCheckedIn, isOnBreak, hasCheckedOut }) => {
  if (hasCheckedOut) {
    return {
      statusText: 'Checked Out',
      badgeColorClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      dotColorClass: 'bg-slate-400'
    };
  } else if (isOnBreak) {
    return {
      statusText: 'Break In',
      badgeColorClass: 'text-[#F59E0B] bg-amber-500/10 border-[#F59E0B]/30',
      dotColorClass: 'bg-[#F59E0B] animate-pulse'
    };
  } else if (hasCheckedIn) {
    return {
      statusText: 'Check In',
      badgeColorClass: 'text-[#00E676] bg-emerald-500/10 border-[#00E676]/30',
      dotColorClass: 'bg-[#00E676] animate-pulse'
    };
  } else {
    return {
      statusText: 'Not Checked In',
      badgeColorClass: 'text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
      dotColorClass: 'bg-slate-400'
    };
  }
};
