import assert from 'node:assert/strict';
import {
  GEOFENCE_RADIUS_METERS,
  TARGET_LAT,
  TARGET_LNG,
  calculateDistanceInMeters,
  isBeyondAutoCheckoutRadius,
  isWithinOfficeRadius
} from '../src/services/attendanceService.js';


assert.equal(TARGET_LAT, 23.057808);
assert.equal(TARGET_LNG, 72.538926);
assert.equal(GEOFENCE_RADIUS_METERS, 20);
assert.equal(isWithinOfficeRadius(20), true);
assert.equal(isWithinOfficeRadius(20.01), false);
assert.equal(isWithinOfficeRadius(Number.NaN), false);

const recentDeviceGpsDistance = calculateDistanceInMeters(
  23.057808,
  72.538926,
  TARGET_LAT,
  TARGET_LNG
);
assert.ok(recentDeviceGpsDistance < GEOFENCE_RADIUS_METERS);
assert.equal(isWithinOfficeRadius(recentDeviceGpsDistance), true);

assert.equal(isBeyondAutoCheckoutRadius(50, 10), false);
assert.equal(isBeyondAutoCheckoutRadius(100, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(115, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(135, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(136, 35), true);
assert.equal(isBeyondAutoCheckoutRadius(116, Number.NaN), false);

console.log('Office geofence and auto-checkout accuracy checks passed.');
