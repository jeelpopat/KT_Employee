import assert from 'node:assert/strict';
import {
  getHalfDayType,
  getLeaveDurationPayload,
  hasActiveLeaveDateOverlap,
  isHalfDayLeave,
  normalizeHalfDayType,
} from '../src/utils/leaveUtils.js';

assert.deepEqual(
  getLeaveDurationPayload(false, 'second_half', 3),
  {
    leaveType: 'full_day',
    isHalfDay: false,
    halfDayType: null,
    totalDays: 3,
  },
  'Full-day payload uses the calculated working-day count'
);

assert.deepEqual(
  getLeaveDurationPayload(true, 'first_half', 4),
  {
    leaveType: 'half_day_1',
    isHalfDay: true,
    halfDayType: 'first-half',
    totalDays: 0.5,
  },
  'First-half payload normalizes the shift and sends half a day'
);

assert.deepEqual(
  getLeaveDurationPayload(true, 'second_half', 4),
  {
    leaveType: 'half_day_2',
    isHalfDay: true,
    halfDayType: 'second-half',
    totalDays: 0.5,
  },
  'Second-half payload normalizes the shift and sends half a day'
);

assert.equal(normalizeHalfDayType(' first_half '), 'first-half');
assert.equal(normalizeHalfDayType('second_half'), 'second-half');
assert.equal(getHalfDayType({ leaveType: 'half_day_2' }), 'second-half');
assert.equal(isHalfDayLeave({ leaveType: 'full_day', isHalfDay: true }), true);
assert.equal(
  getHalfDayType({ leaveType: 'full_day', isHalfDay: true, halfDayType: 'second_half' }),
  'second-half'
);

const existingLeaves = [
  { status: 'Approved', startDate: '2026-11-25', endDate: '2026-11-25' },
  { status: 'pending_hr', startDate: '2026-11-27T00:00:00.000Z', endDate: '2026-11-29T00:00:00.000Z' },
  { status: 'Rejected', startDate: '2026-11-25', endDate: '2026-11-25' },
];
assert.equal(hasActiveLeaveDateOverlap(existingLeaves, '2026-11-25'), true, 'Approved leave blocks re-application');
assert.equal(hasActiveLeaveDateOverlap(existingLeaves, '2026-11-28'), true, 'Pending range blocks an overlapping date');
assert.equal(hasActiveLeaveDateOverlap(existingLeaves, '2026-11-26', '2026-11-27'), true, 'Date ranges overlap inclusively');
assert.equal(hasActiveLeaveDateOverlap(existingLeaves, '2026-11-25', '2026-11-25'), true, 'Approved overlap still blocks when rejected record also exists');
assert.equal(hasActiveLeaveDateOverlap([{ status: 'Rejected', startDate: '2026-11-25', endDate: '2026-11-25' }], '2026-11-25'), false, 'Rejected leave allows re-application');
assert.equal(hasActiveLeaveDateOverlap(existingLeaves, '2026-11-30'), false, 'Non-overlapping dates remain available');

console.log('PASS: Half-day payloads and legacy leave display normalization');
