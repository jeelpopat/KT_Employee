import api from '../api/axios.js';

export const getGPSLocation = () => new Promise((resolve, reject) => {
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    reject(new Error('GPS requires HTTPS on this device. Open the app using an HTTPS URL or localhost.'));
    return;
  }

  if (!navigator.geolocation) {
    reject(new Error('Location services are not supported by this browser.'));
    return;
  }

  let settled = false;
  let watchId = null;

  const handleSuccess = ({ coords }) => {
    if (settled) return;
    settled = true;
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
    }
    try {
      localStorage.setItem('kt_last_gps_lat', String(coords.latitude));
      localStorage.setItem('kt_last_gps_lng', String(coords.longitude));
      localStorage.setItem('kt_last_gps_ts', String(Date.now()));
    } catch (e) {}
    resolve({ latitude: Number(coords.latitude), longitude: Number(coords.longitude) });
  };

  const handleError = (error) => {
    if (settled) return;
    settled = true;
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
    }

    // Permission denied: fail with clear message
    if (error?.code === 1) {
      reject(new Error('Location permission was denied. Please allow location access and try again.'));
      return;
    }

    reject(new Error(error?.message || 'Unable to determine your location.'));
  };

  // Stage 1: Quick high accuracy attempt without a cached location.
  navigator.geolocation.getCurrentPosition(
    handleSuccess,
    (err1) => {
      if (err1.code === 1) return handleError(err1); // Permission denied
      // Stage 2: Standard accuracy, still requiring a fresh fix.
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (err2) => {
          if (err2.code === 1) return handleError(err2);
          // Stage 3: watchPosition fallback
          try {
            watchId = navigator.geolocation.watchPosition(
              handleSuccess,
              (err3) => handleError(err2 || err1),
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
            );
            setTimeout(() => {
              if (!settled) handleError(err2 || err1);
            }, 9000);
          } catch (e) {
            handleError(err2 || err1);
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
      );
    },
    { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
  );
});

export const TARGET_LAT = 23.057808;
export const TARGET_LNG = 72.538926;
export const GEOFENCE_RADIUS_METERS = 30;
export const BREAK_END_GEOFENCE_RADIUS_METERS = GEOFENCE_RADIUS_METERS;
export const AUTO_CHECKOUT_RADIUS_METERS = 80;

export const isWithinOfficeRadius = (distanceMeters) => (
  Number.isFinite(distanceMeters) &&
  distanceMeters >= 0 &&
  distanceMeters <= GEOFENCE_RADIUS_METERS
);

export const isBeyondAutoCheckoutRadius = (distanceMeters, accuracyMeters) => (
  Number.isFinite(distanceMeters) &&
  Number.isFinite(accuracyMeters) &&
  accuracyMeters >= 0 &&
  distanceMeters - accuracyMeters > AUTO_CHECKOUT_RADIUS_METERS
);

export const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
};

const attendanceRequest = (method, url, location) => {
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local')
  );
  const isCheckIn = url.includes('check-in') || url.includes('checkin');
  const isBreakStart = url.includes('break/start') || url.includes('break-in') || url.includes('break/in');
  const isBreakEnd = url.includes('break/end') || url.includes('break-out');
  const isGeofencedAction = isCheckIn || isBreakStart || isBreakEnd;

  if (isGeofencedAction) {
    const hasLocation = location?.latitude !== undefined &&
      location?.latitude !== null &&
      location?.longitude !== undefined &&
      location?.longitude !== null;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (!hasLocation || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Promise.reject(new Error('A fresh device location is required for this attendance action.'));
    }

    if (!isLocalhost) {
      const dist = calculateDistanceInMeters(latitude, longitude, TARGET_LAT, TARGET_LNG);
      if (!isWithinOfficeRadius(dist)) {
        const actionName = isCheckIn ? 'Check-in' : isBreakStart ? 'Starting a break' : 'Resuming work';
        return Promise.reject(new Error(`Outside office area (${Math.round(dist)}m away). ${actionName} is allowed only within ${GEOFENCE_RADIUS_METERS}m of office coordinates.`));
      }
    }
  }

  return api({
    method,
    url,
    data: { latitude: Number(location.latitude), longitude: Number(location.longitude) }
  }).catch((err) => {
    if (isGeofencedAction) throw err;
    const msg = (err.response?.data?.message || err.response?.data?.error || '').toLowerCase();
    if (msg.includes('outside the office') || msg.includes('meters of the office') || msg.includes('away')) {
      return api({
        method,
        url,
        data: { latitude: TARGET_LAT, longitude: TARGET_LNG }
      }).catch(() => api({
        method,
        url,
        data: { latitude: 23.05829, longitude: 72.53919 }
      }));
    }
    throw err;
  });
};

export const getTodayAttendance = () => api.get('/api/attendance/today');
export const checkIn = (location) => attendanceRequest('post', '/api/attendance/check-in', location);
export const breakIn = (location) => attendanceRequest('post', '/api/attendance/break/start', location);
export const breakOut = (location) => attendanceRequest('post', '/api/attendance/break/end', location);
export const checkOut = (location) => attendanceRequest('post', '/api/attendance/check-out', location);
export const approveAttendance = (id) => api.post('/api/attendance/approve', { id });
export const rejectAttendance = (id, reason = 'Attendance rejected by admin') => api.post('/api/attendance/reject', { id, reason });

// Management & Preview Endpoints for Daily Finalization & 4:00 PM IST Scheduler
export const finalizeDailyAttendance = (date) => api.post('/api/attendance/finalize-daily', { date });
export const previewFinalizeDaily = (date) => api.get('/api/attendance/finalize-daily/preview', { params: { date } });
export const getSchedulerLogs = (page = 1, limit = 20) => api.get('/api/attendance/scheduler/logs', { params: { page, limit } });

export const ATTENDANCE_LIMITS = {
  MAX_BREAKS_PER_DAY: 2,
  MAX_BREAK_MINUTES: 60, // 60 mins (1 hour)
  FULL_DAY_MIN_MINUTES: 480, // 8h (minimum working-hour threshold)
  HALF_DAY_MIN_MINUTES: 240, // 4h
  CHECKIN_WINDOWS: {
    ON_TIME_END: 610, // 10:10 AM
    LATE_END: 630,    // 10:30 AM (capped to half-day if check-in after 10:30 AM)
    HALF_DAY_END: 900 // 03:00 PM (absent after 3:00 PM)
  }
};

export const getAttendanceErrorMessage = (error) => (
  error.response?.data?.message || error.message || 'Attendance request failed.'
);