import assert from 'node:assert/strict';
import { isAttendanceRequestPending } from '../src/utils/attendanceApproval.js';

assert.equal(
  isAttendanceRequestPending({ status: 'pending', isApproved: false }, false),
  false,
  'A pending/default approval status without check-in activity is not a request.'
);
assert.equal(
  isAttendanceRequestPending({ status: 'pending' }, true),
  true,
  'An explicit pending status with check-in activity remains pending.'
);
assert.equal(
  isAttendanceRequestPending({ isApproved: false }, false),
  false,
  'An unapproved flag without check-in activity is not a request.'
);
assert.equal(
  isAttendanceRequestPending({ isApproved: false }, true),
  true,
  'An unapproved check-in with activity remains pending.'
);

console.log('Attendance approval requires check-in activity.');
