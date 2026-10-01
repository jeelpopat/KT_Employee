import axios from "axios";

/**
 * Safely decodes a JWT token without external libraries
 * @param {string} token 
 * @returns {object|null}
 */
export const decodeToken = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

/**
 * Checks whether a JWT token is expired
 * @param {string} token 
 * @returns {boolean}
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded) return true; // If corrupted or invalid format, treat as expired
  if (!decoded.exp) return false; // If no exp field, cannot determine expiry
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp <= currentTime;
};

/**
 * Clears authentication data from localStorage
 */
export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("isAuthenticated");
};

/**
 * Checks if current session is authenticated and token is not expired
 * @returns {boolean}
 */
export const checkIsAuthenticated = () => {
  const isAuth = localStorage.getItem("isAuthenticated") === "true";
  const token = localStorage.getItem("token");

  if (!isAuth || !token) {
    clearAuth();
    return false;
  }

  if (isTokenExpired(token)) {
    clearAuth();
    return false;
  }

  return true;
};

/**
 * Triggers auth logout across the application
 */
export const triggerLogout = () => {
  clearAuth();
  window.dispatchEvent(new Event("auth-logout"));
};

/**
 * Checks if a given request URL is a public auth endpoint (e.g. login)
 * where 401 should NOT trigger a global logout redirect
 */
const isAuthEndpoint = (url) => {
  if (!url) return false;
  const urlStr = typeof url === "string" ? url : url.url || "";
  return (
    urlStr.includes("/users/login") ||
    urlStr.includes("/users/forgot-password") ||
    urlStr.includes("/users/reset-password")
  );
};

let isInterceptorInitialized = false;

/**
 * Sets up global interceptors for both window.fetch and axios
 * to catch 401 Unauthorized responses (Token Expired) and auto-logout
 */
export const setupAuthInterceptor = () => {
  if (isInterceptorInitialized) return;
  isInterceptorInitialized = true;

  // 1. Intercept window.fetch
  if (typeof window !== "undefined" && window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      
      const requestUrl = args[0];
      if (response.status === 401 && !isAuthEndpoint(requestUrl)) {
        // Only trigger logout if we had an active session
        if (localStorage.getItem("token") || localStorage.getItem("isAuthenticated") === "true") {
          console.warn("Session expired or unauthorized (401). Redirecting to login...");
          triggerLogout();
        }
      }
      return response;
    };
  }

  // 2. Intercept axios responses
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const requestUrl = error?.config?.url;
      if (error?.response?.status === 401 && !isAuthEndpoint(requestUrl)) {
        if (localStorage.getItem("token") || localStorage.getItem("isAuthenticated") === "true") {
          console.warn("Axios: Session expired or unauthorized (401). Redirecting to login...");
          triggerLogout();
        }
      }
      return Promise.reject(error);
    }
  );
};
