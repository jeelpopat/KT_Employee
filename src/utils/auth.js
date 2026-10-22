import axios from "axios";
import { stopScreenCapture } from "../services/monitoringService.js";

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
  if (!token || typeof token !== "string" || !token.trim()) return true;
  const decoded = decodeToken(token);
  if (decoded && typeof decoded.exp === "number") {
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp <= currentTime;
  }
  return false;
};

/**
 * Clears authentication data from localStorage
 */
export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("active_role");
  localStorage.removeItem("user_role");
  localStorage.removeItem("kt_employee_full_name");
};

/**
 * Performs auto checkout if user is currently checked in.
 * Calls backend API /api/attendance/check-out with coordinates and cleans up local attendance flags.
 */
export const performAutoCheckout = async (authToken) => {
  const token = authToken || localStorage.getItem("auth_token") || localStorage.getItem("token");
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLocalStr = new Date().toLocaleDateString("en-CA");

  const isCheckedIn = (
    localStorage.getItem("kt_checked_in_" + todayStr) === "true" ||
    localStorage.getItem("kt_checked_in_" + todayLocalStr) === "true" ||
    !!localStorage.getItem("kt_active_session_id") ||
    !!localStorage.getItem("kt_check_in_time")
  );

  // If user is checked in, send auto-checkout request to backend API
  if (isCheckedIn && token) {
    try {
      const resp = await fetch("https://kt-backend-yzr4.onrender.com/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude: 23.05829,
          longitude: 72.53919
        })
      });
      if (!resp.ok) {
        await fetch("https://kt-backend-yzr4.onrender.com/api/attendance/check-out", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            latitude: 23.057808,
            longitude: 72.538926
          })
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Auto-checkout API notification failed:", err);
    }
  }

  // Stop screen capture if running
  try {
    if (typeof stopScreenCapture === "function") {
      stopScreenCapture();
    }
  } catch (e) { }

  // Clear local check-in & active session flags
  try {
    localStorage.removeItem("kt_active_session_id");
    localStorage.removeItem("kt_check_in_time");
    localStorage.removeItem("kt_monitoring_start_time");
    localStorage.removeItem("kt_checked_in_" + todayStr);
    localStorage.removeItem("kt_checked_in_" + todayLocalStr);
    localStorage.removeItem("kt_on_break_" + todayStr);
    localStorage.removeItem("kt_on_break_" + todayLocalStr);
    localStorage.setItem("kt_checked_out_" + todayStr, "true");
    localStorage.setItem("kt_checked_out_" + todayLocalStr, "true");
  } catch (e) { }
};

/**
 * Normalizes role string to canonical key: 'admin' | 'team_leader' | 'hr' | 'employee'
 */
export const normalizeRole = (role) => {
  if (!role) return "";
  const r = String(role).toLowerCase().trim();
  if (
    r === "admin" ||
    r === "administrator" ||
    r === "superadmin" ||
    (r.includes("admin") && !r.includes("hr") && !r.includes("lead") && !r.includes("leader"))
  ) {
    return "admin";
  }
  if (
    r === "hr" ||
    r === "hr manager" ||
    r.includes("human resource") ||
    r.startsWith("hr")
  ) {
    return "hr";
  }
  if (
    r === "team_leader" ||
    r === "team lead" ||
    r === "team leader" ||
    r === "teamlead" ||
    r === "tl" ||
    r.includes("team lead") ||
    r.includes("team leader")
  ) {
    return "team_leader";
  }
  if (r === "employee" || r === "trainee") {
    return "employee";
  }
  return r;
};

/**
 * Validates if a role is allowed to access the employee/admin panel
 */
export const isRoleAllowed = (role) => {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  if (
    r.includes("account") ||
    /\bca\b/i.test(r) ||
    r.includes("chartered")
  ) {
    return false;
  }
  const norm = normalizeRole(r);
  return ["admin", "employee", "team_leader", "hr"].includes(norm);
};

/**
 * Authoritatively derives user role from server profile payload
 */
export const deriveUserRoleFromData = (u, raw, authToken, fallbackStoredRole) => {
  if (!u && !raw) return fallbackStoredRole ? normalizeRole(fallbackStoredRole) : "";

  const candidate = u || raw || {};
  const emp = candidate.employee || (raw && raw.employee) || {};
  const prof = candidate.profile || (raw && raw.profile) || {};

  const email = (
    candidate.email ||
    emp.email ||
    prof.email ||
    ""
  ).toLowerCase().trim();

  if (email === "harsh@kevalontechnology.in") return "admin";
  if (email === "hetvi.kevalon@gmail.com") return "team_leader";

  // Check token claims if available
  if (authToken) {
    const tokenPayload = decodeToken(authToken);
    if (tokenPayload) {
      const tRole = normalizeRole(tokenPayload.role || tokenPayload.roleName || tokenPayload.userRole);
      if (tRole && ["admin", "team_leader", "hr"].includes(tRole)) return tRole;
    }
  }

  const roleVal = (
    candidate.role?.roleName ||
    candidate.role?.name ||
    (typeof candidate.role === "string" && !/^[0-9a-fA-F]{24}$/.test(candidate.role) ? candidate.role : "") ||
    candidate.roleName ||
    candidate.userRole ||
    candidate.applicantRole ||
    emp.role?.roleName ||
    emp.role?.name ||
    (typeof emp.role === "string" && !/^[0-9a-fA-F]{24}$/.test(emp.role) ? emp.role : "") ||
    emp.roleName ||
    emp.userRole ||
    prof.role?.roleName ||
    prof.role?.name ||
    (typeof prof.role === "string" && !/^[0-9a-fA-F]{24}$/.test(prof.role) ? prof.role : "") ||
    ""
  ).toLowerCase().trim();

  const desig = (
    candidate.designation ||
    emp.designation ||
    prof.designation ||
    ""
  ).toLowerCase().trim();

  if (
    roleVal === "hr" ||
    roleVal === "hr manager" ||
    roleVal.includes("human resource") ||
    roleVal.startsWith("hr") ||
    /\bhr\b/i.test(roleVal) ||
    /\bhr\b/i.test(desig)
  ) {
    return "hr";
  }

  if (
    roleVal === "team_leader" ||
    roleVal === "team lead" ||
    roleVal === "team leader" ||
    roleVal === "teamlead" ||
    roleVal === "tl" ||
    roleVal.includes("team lead") ||
    roleVal.includes("team leader") ||
    desig.includes("team lead") ||
    desig.includes("team leader") ||
    desig.includes("teamlead")
  ) {
    return "team_leader";
  }

  if (
    roleVal === "admin" ||
    roleVal === "administrator" ||
    roleVal === "superadmin" ||
    (roleVal.includes("admin") && !roleVal.includes("hr") && !roleVal.includes("lead"))
  ) {
    return "admin";
  }

  if (roleVal === "account" || roleVal.includes("account")) {
    return "account";
  }
  if (/\bca\b/i.test(roleVal) || roleVal.includes("chartered")) {
    return "ca";
  }

  if (roleVal === "employee" || roleVal.includes("trainee") || desig.includes("trainee") || desig.includes("employee")) {
    return "employee";
  }

  const norm = normalizeRole(roleVal);
  if (norm) return norm;

  // If no explicit role was identified in server payload, preserve stored role (e.g. admin or team_leader)
  if (fallbackStoredRole) return normalizeRole(fallbackStoredRole);

  return "";
};

/**
 * Validates user session live against backend database:
 * - Checks if token is valid and not expired
 * - Checks if user exists in DB
 * - Checks if user is ACTIVE (not inactive, not blocked, not terminated)
 * - Checks if user has the SAME ROLE as stored (detects role changes / demotions / promotions)
 * ONLY runs auto-checkout if user is genuinely unavailable (deleted/401/404/inactive) or role mismatch!
 */
export const validateUserSession = async () => {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  const storedRole = localStorage.getItem("user_role") || localStorage.getItem("active_role");

  // 1. Missing token
  if (!token) {
    return { isValid: false, shouldLogout: true, reason: "No authentication token" };
  }

  // Check specifically for expired JWT exp
  if (isTokenExpired(token)) {
    console.warn("Session token expired. Triggering auto-checkout.");
    await performAutoCheckout(token);
    clearAuth();
    return { isValid: false, shouldLogout: true, reason: "Session expired" };
  }

  // 2. Fetch live profile directly from server
  try {
    let response;
    try {
      response = await fetch("https://kt-backend-yzr4.onrender.com/api/users/profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
    } catch (netErr) {
      console.warn("Session check network notice:", netErr?.message);
      // Network or temporary timeout error: user is STILL valid. DO NOT check out or logout!
      return { isValid: true, isNetworkDegraded: true };
    }

    // 2a. If server returned 401 Unauthorized or 404 Not Found: User is genuinely NOT AVAILABLE
    if (response.status === 401 || response.status === 404) {
      console.warn(`User session invalid/not found: Server returned ${response.status}. Triggering auto-checkout.`);
      await performAutoCheckout(token);
      clearAuth();
      return { isValid: false, shouldLogout: true, reason: `User not available (${response.status})` };
    }

    // 2b. If server returned 403 Forbidden: User account access denied
    if (response.status === 403) {
      console.warn("User account access forbidden (403). Triggering auto-checkout.");
      await performAutoCheckout(token);
      clearAuth();
      return { isValid: false, shouldLogout: true, reason: "Access forbidden (403)" };
    }

    // 2c. If server returned 5xx (Internal Server Error): Temporary backend issue. DO NOT check out!
    if (response.status >= 500) {
      console.warn(`Backend server temporary error: ${response.status}. Preserving current session.`);
      return { isValid: true, isServerDegraded: true };
    }

    if (!response.ok) {
      console.warn(`Profile validation notice: HTTP ${response.status}. Preserving session.`);
      return { isValid: true };
    }

    const result = await response.json();
    const raw = result.data || result;
    const userObj = raw?.user || result?.user || raw?.profile || result?.profile || raw;

    if (!userObj || (!userObj._id && !userObj.id && !userObj.email)) {
      // Body did not contain expected user object; do not logout if local token is present
      return { isValid: true };
    }

    // 3. Check if user is ACTIVE (not inactive, not blocked, not terminated)
    const isInactive = (
      userObj.isActive === false ||
      userObj.status === "inactive" ||
      userObj.status === "blocked" ||
      userObj.status === "disabled" ||
      userObj.status === "suspended" ||
      userObj.status === "terminated" ||
      userObj.status === "resigned" ||
      userObj.employee?.isActive === false ||
      userObj.employee?.status === "inactive" ||
      userObj.employee?.status === "blocked" ||
      userObj.employee?.status === "terminated" ||
      userObj.employee?.status === "resigned"
    );

    if (isInactive) {
      console.warn("User account is inactive or blocked. Triggering auto-checkout and logout.");
      await performAutoCheckout(token);
      clearAuth();
      return { isValid: false, shouldLogout: true, reason: "User account is inactive or blocked" };
    }

    // 4. Derive live role and check permission
    let liveRole = deriveUserRoleFromData(userObj, raw, token, storedRole);

    // If role is a MongoDB ObjectId on the user record, query /api/role to look it up
    const rawRoleId = userObj.role?._id || (typeof userObj.role === 'string' && /^[0-9a-fA-F]{24}$/.test(userObj.role) ? userObj.role : '') ||
      userObj.employee?.role?._id || (typeof userObj.employee?.role === 'string' && /^[0-9a-fA-F]{24}$/.test(userObj.employee?.role) ? userObj.employee?.role : '');

    if ((!liveRole || liveRole === 'employee') && rawRoleId && /^[0-9a-fA-F]{24}$/.test(String(rawRoleId).trim())) {
      try {
        const roleRes = await fetch("https://kt-backend-yzr4.onrender.com/api/role", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (roleRes.ok) {
          const rData = await roleRes.json();
          const rList = rData.data || rData.roles || (Array.isArray(rData) ? rData : []);
          const matched = rList.find(r => r._id === rawRoleId || r.id === rawRoleId);
          if (matched) {
            const matchedName = matched.roleName || matched.name || matched.title;
            if (matchedName) {
              liveRole = normalizeRole(matchedName);
            }
          }
        }
      } catch (e) { }
    }

    if (!liveRole && storedRole) {
      liveRole = normalizeRole(storedRole);
    }

    // 4b. Reject unauthorized roles (e.g. account, ca)
    if (liveRole && !isRoleAllowed(liveRole)) {
      console.warn(`Unauthorized role session detected (${liveRole}). Triggering auto-checkout and logout.`);
      await performAutoCheckout(token);
      clearAuth();
      return { isValid: false, shouldLogout: true, reason: `Unauthorized role: ${liveRole}` };
    }

    // 5. Enforce SAME ROLE check: Only trigger if both are definitively known and DIFFERENT
    if (storedRole && liveRole) {
      const normStored = normalizeRole(storedRole);
      const normLive = normalizeRole(liveRole);
      if (normStored && normLive && normStored !== normLive) {
        console.warn(`Role mismatch detected: Stored [${normStored}] !== Live [${normLive}]. Triggering auto-checkout and logout.`);
        await performAutoCheckout(token);
        clearAuth();
        return { isValid: false, shouldLogout: true, reason: `Role changed from ${normStored} to ${normLive}` };
      }
    }

    // Session is fully valid, active, and has same role! Cache authoritative profile
    try {
      localStorage.setItem("auth_user", JSON.stringify(userObj));
      localStorage.setItem("user", JSON.stringify(userObj));
      if (liveRole) {
        localStorage.setItem("active_role", normalizeRole(liveRole));
        localStorage.setItem("user_role", normalizeRole(liveRole));
      }
      localStorage.setItem("isAuthenticated", "true");
    } catch (e) { }

    return {
      isValid: true,
      user: userObj,
      role: liveRole || normalizeRole(storedRole) || "employee",
      fullData: raw
    };
  } catch (err) {
    console.warn("Session verification exception:", err);
    // On unexpected error, do NOT checkout or logout
    return { isValid: true, isErrorIgnored: true };
  }
};

/**
 * Checks if current session is authenticated and token is not expired
 * @returns {boolean}
 */
export const checkIsAuthenticated = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
  if (!token) return false;
  if (isTokenExpired(token)) {
    clearAuth();
    return false;
  }
  return true;
};

/**
 * Triggers auth logout across the application with auto-checkout
 */
export const triggerLogout = async (reason = "Session terminated") => {
  console.warn("Triggering auto-logout:", reason);
  await performAutoCheckout();
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
    urlStr.includes("/users/reset-password") ||
    urlStr.includes("/api/company") ||
    urlStr.includes("/api/branch") ||
    urlStr.includes("/api/financial-year") ||
    urlStr.includes("/api/users/all")
  );
};

let isInterceptorInitialized = false;

/**
 * Sets up global interceptors for both window.fetch and axios
 * to catch 401 Unauthorized responses (Token Expired) and auto-checkout + auto-logout
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
        if (localStorage.getItem("token") || localStorage.getItem("isAuthenticated") === "true") {
          console.warn("Session expired or unauthorized (401). Auto-checking out and redirecting to login...");
          triggerLogout("401 Unauthorized fetch response");
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
          console.warn("Axios: Session expired or unauthorized (401). Auto-checking out and redirecting to login...");
          triggerLogout("401 Unauthorized axios response");
        }
      }
      return Promise.reject(error);
    }
  );
};
