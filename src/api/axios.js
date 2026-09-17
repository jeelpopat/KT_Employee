import axios from 'axios';

const api = axios.create({
  baseURL: 'https://kt-backend-1.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach the auth token to every request if the user is logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;