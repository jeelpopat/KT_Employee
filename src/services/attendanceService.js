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

const attendanceRequest = (method, url, location) => api({
  method,
  url,
  data: { latitude: location.latitude, longitude: location.longitude }
});

export const getTodayAttendance = () => api.get('/api/attendance/today');
export const checkIn = (location) => attendanceRequest('post', '/api/attendance/check-in', location);
export const breakIn = (location) => attendanceRequest('post', '/api/attendance/break-in', location);
export const breakOut = (location) => attendanceRequest('post', '/api/attendance/break-out', location);
export const checkOut = (location) => attendanceRequest('post', '/api/attendance/check-out', location);

export const getAttendanceErrorMessage = (error) => (
  error.response?.data?.message || error.message || 'Attendance request failed.'
);