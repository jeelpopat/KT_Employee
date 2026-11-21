import assert from 'node:assert/strict';
import {
  GEOFENCE_RADIUS_METERS,
  TARGET_LAT,
  TARGET_LNG,
  calculateDistanceInMeters,
  getAccuracyAdjustedDistanceInMeters,
  isBeyondAutoCheckoutRadius,
  isWithinOfficeRadius
} from '../src/services/attendanceService.js';

assert.equal(TARGET_LAT, 23.057808);
assert.equal(TARGET_LNG, 72.538926);
assert.equal(GEOFENCE_RADIUS_METERS, 20);
assert.equal(isWithinOfficeRadius(20), true);
assert.equal(isWithinOfficeRadius(20.01), false);
assert.equal(isWithinOfficeRadius(Number.NaN), false);

const recentDeviceGpsDistance = calculateDistanceInMeters(TARGET_LAT, TARGET_LNG, TARGET_LAT, TARGET_LNG);
assert.ok(recentDeviceGpsDistance < GEOFENCE_RADIUS_METERS);
assert.equal(isWithinOfficeRadius(recentDeviceGpsDistance), true);
assert.equal(getAccuracyAdjustedDistanceInMeters(63, 35), 28);
assert.equal(isWithinOfficeRadius(getAccuracyAdjustedDistanceInMeters(63, 35)), false);
assert.equal(isWithinOfficeRadius(getAccuracyAdjustedDistanceInMeters(50, 35)), true);
assert.equal(getAccuracyAdjustedDistanceInMeters(63, 35.01), null);

assert.equal(isBeyondAutoCheckoutRadius(50, 10), false);
assert.equal(isBeyondAutoCheckoutRadius(100, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(115, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(116, 35), true);
assert.equal(isBeyondAutoCheckoutRadius(116, Number.NaN), false);

console.log('Office geofence and auto-checkout accuracy checks passed.');
