import assert from 'node:assert/strict';
import {
  GEOFENCE_RADIUS_METERS,
  TARGET_LAT,
  TARGET_LNG,
  calculateDistanceInMeters,
  getGPSLocation,
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

const browserGlobalNames = ['window', 'navigator', 'localStorage'];
const originalBrowserGlobals = Object.fromEntries(
  browserGlobalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);

try {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true, location: { hostname: 'localhost' } }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: (onSuccess) => onSuccess({
          coords: { latitude: TARGET_LAT, longitude: TARGET_LNG, accuracy: 80 }
        })
      }
    }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem() {} }
  });

  const lowAccuracyFix = await getGPSLocation();
  assert.equal(lowAccuracyFix.accuracy, 80);
} finally {
  for (const name of browserGlobalNames) {
    const descriptor = originalBrowserGlobals[name];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

console.log('Office geofence and auto-checkout accuracy checks passed.');
