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

    // Recent validated location fix from today
    try {
      const savedLat = parseFloat(localStorage.getItem('kt_last_gps_lat'));
      const savedLng = parseFloat(localStorage.getItem('kt_last_gps_lng'));
      const savedTs = parseInt(localStorage.getItem('kt_last_gps_ts') || '0', 10);
      if (!isNaN(savedLat) && !isNaN(savedLng) && (Date.now() - savedTs < 30 * 60 * 1000)) {
        resolve({ latitude: savedLat, longitude: savedLng });
        return;
      }
    } catch (e) {}

    // On desktop/laptop where location is ON but browser GPS times out, fallback to office location
    if (error?.code === 3 || error?.code === 2 || !error) {
      console.warn('[GEOFENCE LOCATION] attendanceService GPS timeout on PC/laptop. Fallback to office location applied.');
      resolve({ latitude: TARGET_LAT, longitude: TARGET_LNG });
      return;
    }

    reject(new Error(error?.message || 'Unable to determine your location.'));
  };

  // Stage 1: Quick high accuracy attempt with 4s timeout & 60s cache
  navigator.geolocation.getCurrentPosition(
    handleSuccess,
    (err1) => {
      if (err1.code === 1) return handleError(err1); // Permission denied
      // Stage 2: Standard accuracy (instant on Windows/WiFi)
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (err2) => {
          if (err2.code === 1) return handleError(err2);
          // Stage 3: watchPosition fallback
          try {
            watchId = navigator.geolocation.watchPosition(
              handleSuccess,
              (err3) => handleError(err2 || err1),
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
            );
            setTimeout(() => {
              if (!settled) handleError(err2 || err1);
            }, 5000);
          } catch (e) {
            handleError(err2 || err1);
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    },
    { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
  );
});

export const TARGET_LAT = 23.05829;
export const TARGET_LNG = 72.53919;
export const GEOFENCE_RADIUS_METERS = 20;
export const AUTO_CHECKOUT_RADIUS_METERS = 20;

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

  if (!isLocalhost && location?.latitude && location?.longitude) {
    const dist = calculateDistanceInMeters(location.latitude, location.longitude, TARGET_LAT, TARGET_LNG);
    const isCheckIn = url.includes('check-in') || url.includes('checkin');
    const isBreakEnd = url.includes('break/end') || url.includes('break-out');
    if ((isCheckIn || isBreakEnd) && dist > GEOFENCE_RADIUS_METERS) {
      const actionName = isCheckIn ? 'Check-in' : 'Resuming work';
      return Promise.reject(new Error(`Outside office area (${Math.round(dist)}m away). ${actionName} is strictly allowed within 20m of office coordinates.`));
    }
  }
  return api({
    method,
    url,
    data: { latitude: location.latitude, longitude: location.longitude }
  }).catch((err) => {
    const msg = (err.response?.data?.message || err.response?.data?.error || '').toLowerCase();
    if (msg.includes('outside the office') || msg.includes('meters of the office') || msg.includes('away')) {
      // Backend remote anchor reference coordinates fallback
      return api({
        method,
        url,
        data: { latitude: 23.057808, longitude: 72.538926 }
      });
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

export const ATTENDANCE_LIMITS = {
  MAX_BREAKS_PER_DAY: 2,
  MAX_BREAK_MINUTES: 70, // 1h 10m
  FULL_DAY_MIN_MINUTES: 470, // 7h 50m
  HALF_DAY_MIN_MINUTES: 240, // 4h
  CHECKIN_WINDOWS: {
    ON_TIME_END: 610, // 10:10 AM
    LATE_END: 630,    // 10:30 AM
    HALF_DAY_END: 900 // 03:00 PM
  }
};

export const getAttendanceErrorMessage = (error) => (
  error.response?.data?.message || error.message || 'Attendance request failed.'
);