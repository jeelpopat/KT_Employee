import assert from 'node:assert/strict';
import {
  getHalfDayType,
  getLeaveDurationPayload,
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

console.log('PASS: Half-day payloads and legacy leave display normalization');
