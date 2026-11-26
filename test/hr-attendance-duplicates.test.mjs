import assert from 'node:assert/strict';
import { deduplicateAttendanceRecordsByDate } from '../src/utils/timelineUtils.js';

const firstRecord = { _id: 'first', date: '2026-11-24T10:00:00.000Z' };
const repeatedRecord = { _id: 'duplicate', date: '2026-11-24T10:00:00.000Z' };
const nextDayRecord = { _id: 'next-day', date: '2026-11-23T10:00:00.000Z' };

assert.deepEqual(
  deduplicateAttendanceRecordsByDate([firstRecord, repeatedRecord, nextDayRecord]),
  [firstRecord, nextDayRecord],
  'Attendance timeline should retain only one row for each calendar day'
);

console.log('  ✔ Duplicate HR attendance timeline days are deduplicated\n');
