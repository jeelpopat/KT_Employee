import assert from 'node:assert/strict';
import api from '../src/api/axios.js';
import {
  breakIn,
  breakOut,
  checkIn,
  checkOut
} from '../src/services/attendanceService.js';

const requests = [];
api.defaults.adapter = async (config) => {
  requests.push(config);
  return {
    data: { success: true },
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  };
};

await checkIn();
await breakIn();
await breakOut();
await checkOut();

assert.deepEqual(
  requests.map(({ url, data }) => ({ url, data: JSON.parse(data) })),
  [
    { url: '/api/attendance/check-in', data: {} },
    { url: '/api/attendance/break/start', data: {} },
    { url: '/api/attendance/break/end', data: {} },
    { url: '/api/attendance/check-out', data: {} }
  ]
);

console.log('Web attendance actions can be submitted without GPS coordinates.');
