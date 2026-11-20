import assert from 'node:assert/strict';
import { isBeyondAutoCheckoutRadius } from '../src/services/attendanceService.js';

assert.equal(isBeyondAutoCheckoutRadius(50, 10), false);
assert.equal(isBeyondAutoCheckoutRadius(100, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(115, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(116, 35), true);
assert.equal(isBeyondAutoCheckoutRadius(116, Number.NaN), false);

console.log('Geofence auto-checkout accuracy checks passed.');
