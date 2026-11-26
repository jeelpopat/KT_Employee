import assert from 'node:assert/strict';
import api from '../src/api/axios.js';
import { breakIn, breakOut, checkIn, checkOut } from '../src/services/attendanceService.js';

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

for (const action of [checkIn, breakIn, breakOut, checkOut]) {
  await action();
}

assert.equal(requests.length, 4);
for (const request of requests) {
  const body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
  assert.deepEqual(body, {});
  assert.equal(request.headers.get('x-client-platform'), 'web');
  assert.equal('latitude' in body, false);
  assert.equal('longitude' in body, false);
  assert.equal('accuracy' in body, false);
}

console.log('Web attendance requests omit GPS coordinates and accuracy.');
