import assert from 'node:assert/strict';
import {
  GEOFENCE_RADIUS_METERS,
  calculateDistanceInMeters,
  isBeyondAutoCheckoutRadius,
  isWithinOfficeRadius,
  normalizeOfficeSettings,
  parseOfficeGeofenceSettings
} from '../src/services/attendanceService.js';

assert.equal(GEOFENCE_RADIUS_METERS, 20);
assert.equal(isWithinOfficeRadius(50, 50), true);
assert.equal(isWithinOfficeRadius(50.01, 50), false);
assert.equal(isWithinOfficeRadius(Number.NaN), false);

const serverSettings = normalizeOfficeSettings({
  data: { settings: { latitude: 23.057808, longitude: 72.538926, radiusMeters: 50 } }
});
assert.equal(serverSettings.latitude, 23.057808);
assert.equal(serverSettings.longitude, 72.538926);
const recentDeviceGpsDistance = calculateDistanceInMeters(
  serverSettings.latitude,
  serverSettings.longitude,
  serverSettings.latitude,
  serverSettings.longitude
);
assert.ok(recentDeviceGpsDistance < GEOFENCE_RADIUS_METERS);
assert.equal(isWithinOfficeRadius(recentDeviceGpsDistance, serverSettings.radiusMeters), true);
assert.deepEqual(parseOfficeGeofenceSettings({
  settings: {
    officeLocation: { lat: 23.057808, lng: 72.538926 },
    geofenceRadius: 50
  }
}), { latitude: 23.057808, longitude: 72.538926, radiusMeters: 50 });
assert.throws(
  () => parseOfficeGeofenceSettings({ latitude: 'invalid', longitude: 72.538926, radiusMeters: 50 }),
  /Valid office geofence coordinates and radius/
);

assert.equal(isBeyondAutoCheckoutRadius(50, 10), false);
assert.equal(isBeyondAutoCheckoutRadius(100, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(115, 35), false);
assert.equal(isBeyondAutoCheckoutRadius(116, 35), true);
assert.equal(isBeyondAutoCheckoutRadius(116, Number.NaN), false);

console.log('Office geofence and auto-checkout accuracy checks passed.');
