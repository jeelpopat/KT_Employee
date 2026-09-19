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

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: Number(coords.latitude), longitude: Number(coords.longitude) }),
    (error) => {
      const messages = {
        1: 'Location permission was denied. Please allow location access and try again.',
        2: 'Your location could not be determined. Please turn on location services.',
        3: 'Location request timed out. Please try again.'
      };
      reject(new Error(messages[error.code] || 'Unable to determine your location.'));
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

const TARGET_LAT = 23.057808;
const TARGET_LNG = 72.538926;
const GEOFENCE_RADIUS_METERS = 70;

const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
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
    if (dist > GEOFENCE_RADIUS_METERS) {
      return Promise.reject(new Error(`Outside office area (${Math.round(dist)}m away). Actions only allowed within 70m.`));
    }
  }
  return api({
    method,
    url,
    data: { latitude: location.latitude, longitude: location.longitude }
  });
};

export const getTodayAttendance = () => api.get('/api/attendance/today');
export const checkIn = (location) => attendanceRequest('post', '/api/attendance/check-in', location);
export const breakIn = (location) => attendanceRequest('post', '/api/attendance/break/start', location);
export const breakOut = (location) => attendanceRequest('post', '/api/attendance/break/end', location);
export const checkOut = (location) => attendanceRequest('post', '/api/attendance/check-out', location);

export const getAttendanceErrorMessage = (error) => (
  error.response?.data?.message || error.message || 'Attendance request failed.'
);