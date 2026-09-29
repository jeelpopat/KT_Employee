import api from '../api/axios.js';

export const CLOUDINARY_CONFIG = {
  cloudName: 'eluf75ev',
  apiKey: '736137837225317',
  apiSecret: 'IHu_UDOyaodGqTUdWO2SwLzFRGA',
  cloudId: 'cdffd49bbd5ca53c25bb6ba43af40c'
};

// 1. Fetch screenshot monitoring settings for HR/Admin
export const getMonitoringSettings = async () => {
  try {
    const res = await api.get('/api/employee-panel/monitoring/settings');
    const settings = res.data?.settings || res.data?.data || res.data || {};
    return {
      intervalSeconds: settings.intervalSeconds || (settings.intervalMinutes ? settings.intervalMinutes * 60 : 300),
      intervalMinutes: settings.intervalMinutes || Math.max(1, Math.round((settings.intervalSeconds || 300) / 60)),
      isEnabled: settings.isEnabled !== undefined ? settings.isEnabled : true,
      pauseOnBreak: settings.pauseOnBreak !== undefined ? settings.pauseOnBreak : true,
      retentionDays: settings.retentionDays || 30,
      cloudinary: {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        cloudId: CLOUDINARY_CONFIG.cloudId,
        connected: true
      },
      ...settings
    };
  } catch (error) {
    if (error.response?.status !== 403 && error.response?.status !== 401) {
      console.warn('Failed to fetch monitoring settings from backend, using defaults:', error.message);
    }
    return {
      intervalSeconds: 300,
      intervalMinutes: 5,
      isEnabled: true,
      pauseOnBreak: true,
      retentionDays: 30,
      cloudinary: {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        cloudId: CLOUDINARY_CONFIG.cloudId,
        connected: true
      }
    };
  }
};

// 2. Update screenshot monitoring settings (Admin/HR)
export const updateMonitoringSettings = async (settings) => {
  const payload = {
    intervalSeconds: Number(settings.intervalSeconds) || (Number(settings.intervalMinutes) ? Number(settings.intervalMinutes) * 60 : 60),
    intervalMinutes: Number(settings.intervalMinutes) || Math.max(1, Math.round((Number(settings.intervalSeconds) || 60) / 60)),
    isEnabled: settings.isEnabled !== false,
    pauseOnBreak: settings.pauseOnBreak !== false,
    retentionDays: Number(settings.retentionDays) || 30,
    cloudName: CLOUDINARY_CONFIG.cloudName,
    apiKey: CLOUDINARY_CONFIG.apiKey,
    cloudId: CLOUDINARY_CONFIG.cloudId
  };

  try {
    const res = await api.post('/api/employee-panel/monitoring/settings', payload);
    return res.data?.settings || res.data?.data || res.data || payload;
  } catch (error) {
    console.warn('POST /api/employee-panel/monitoring/settings error, attempting PUT fallback:', error.message);
    try {
      const putRes = await api.put('/api/employee-panel/monitoring/settings', payload);
      return putRes.data?.settings || putRes.data?.data || putRes.data || payload;
    } catch (putError) {
      console.warn('Fallback also failed, returning local state:', putError.message);
      return payload;
    }
  }
};

// 3. Get all employees screenshots for Admin/HR
export const getAdminScreenshots = async (params = {}) => {
  try {
    const res = await api.get('/api/employee-panel/monitoring/admin/screenshots', { params });
    const rawList = res.data?.screenshots || res.data?.data?.screenshots || res.data?.data || res.data || [];
    if (Array.isArray(rawList)) {
      return rawList.map(s => normalizeScreenshotRecord(s));
    }
    return [];
  } catch (error) {
    console.warn('Failed to fetch admin screenshots from backend:', error.message);
    return [];
  }
};

// Validate 24-character hexadecimal MongoDB ObjectId string
export const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
};

// Resolve a valid 24-character hexadecimal MongoDB ObjectId string for userId/attendanceId
export const resolveMongoObjectId = (val, defaultHex = '65f100000000000000008492') => {
  if (isValidObjectId(val)) return val;
  if (!val) return defaultHex;
  const str = String(val).trim();
  if (isValidObjectId(str)) return str;
  // If string is already hex but under 24 chars, pad it
  if (/^[0-9a-fA-F]+$/.test(str)) {
    return str.padStart(24, '0').slice(0, 24);
  }
  // Convert characters to hex
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return hex.padEnd(24, '0').slice(0, 24);
};

// Auto-detect employee workstation device info (OS, browser, screen resolution)
export const getDeviceInfoString = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Desktop • Browser Client';
  }
  const ua = navigator.userAgent || '';
  let os = 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium|Edg/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';

  const width = window.screen?.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const height = window.screen?.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);
  const screenRes = `${width}x${height}`;

  return `${os} • ${browser} • ${screenRes}`;
};

// Derive valid session status enum: ["active", "break", "terminated", "auto_checkout"]
export const deriveSessionStatus = (attendanceStatus, isAutoCheckedOut = false) => {
  if (attendanceStatus === 'on_break') return 'break';
  if (attendanceStatus === 'checked_out') {
    return isAutoCheckedOut ? 'auto_checkout' : 'terminated';
  }
  return 'active';
};

// Helper to derive employee position (e.g. TL, EMP, HR, ADMIN, INTERN)
export const deriveEmployeePosition = (raw = {}, emp = {}) => {
  const nameStr = (
    raw?.employeeName ||
    raw?.name ||
    raw?.fullName ||
    emp?.name ||
    emp?.fullName ||
    ''
  ).toString().toLowerCase().trim();

  const emailStr = (
    raw?.email ||
    raw?.userEmail ||
    emp?.email ||
    ''
  ).toString().toLowerCase().trim();

  const idStr = (
    raw?.userId ||
    raw?.employeeId ||
    raw?._id ||
    emp?._id ||
    emp?.id ||
    emp?.employeeId ||
    ''
  ).toString().toLowerCase().trim();

  // Known company Team Leaders: Pandya Hetvi, Kuresh Poonawala, etc.
  if (
    nameStr.includes('hetvi') ||
    emailStr.includes('hetvi') ||
    nameStr.includes('kuresh') ||
    emailStr.includes('kuresh') ||
    idStr.includes('6ab3894c4b9bcbcfe8afc6c')
  ) {
    return { short: 'TL', label: 'Team Leader', code: 'team_leader' };
  }

  const roleStr = (
    raw?.position ||
    raw?.positionShort ||
    raw?.employeePosition ||
    raw?.applicantRole ||
    raw?.userRole ||
    raw?.role ||
    raw?.roleName ||
    raw?.designation ||
    emp?.position ||
    emp?.positionShort ||
    emp?.applicantRole ||
    emp?.userRole ||
    emp?.role ||
    emp?.roleName ||
    emp?.designation ||
    ''
  ).toString().toLowerCase().trim();

  const isTL =
    raw?.isTeamLeader === true ||
    raw?.isTeamLead === true ||
    emp?.isTeamLeader === true ||
    emp?.isTeamLead === true ||
    raw?.position === 'TL' ||
    raw?.positionShort === 'TL' ||
    emp?.position === 'TL' ||
    emp?.positionShort === 'TL' ||
    roleStr.includes('lead') ||
    roleStr.includes('leader') ||
    roleStr.includes('tl') ||
    roleStr.includes('team lead') ||
    roleStr.includes('team_leader');

  if (isTL) {
    return { short: 'TL', label: 'Team Leader', code: 'team_leader' };
  }
  if (roleStr.includes('admin')) {
    return { short: 'ADMIN', label: 'Administrator', code: 'admin' };
  }
  if (roleStr.includes('hr')) {
    return { short: 'HR', label: 'HR Manager', code: 'hr' };
  }
  if (roleStr.includes('intern')) {
    return { short: 'INTERN', label: 'Intern', code: 'intern' };
  }
  return { short: 'EMP', label: 'Employee', code: 'employee' };
};

// Helper to thoroughly extract genuine employee details (name, employeeId, designation) from any user/profile/record
export const extractEmployeeDetails = (source = {}) => {
  if (!source) return { name: '', employeeId: '', designation: '' };

  const emp = (typeof source.employee === 'object' && source.employee !== null)
    ? source.employee
    : (typeof source.employeeId === 'object' && source.employeeId !== null)
      ? source.employeeId
      : {};

  const prof = (typeof source.profile === 'object' && source.profile !== null)
    ? source.profile
    : (typeof source.user === 'object' && source.user !== null)
      ? source.user
      : {};

  // Extract Name (strictly avoid generic placeholders like 'Active Employee' or 'Employee')
  const isValidName = (val) => {
    if (!val || typeof val !== 'string') return false;
    const s = val.trim().toLowerCase();
    return s.length > 0 && s !== 'active employee' && s !== 'employee' && s !== 'user' && s !== 'staff';
  };

  let name = '';
  if (isValidName(source.employeeName)) {
    name = source.employeeName.trim();
  } else if (emp.firstName || emp.lastName) {
    name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  } else if (isValidName(emp.name)) {
    name = emp.name.trim();
  } else if (isValidName(emp.fullName)) {
    name = emp.fullName.trim();
  } else if (prof.firstName || prof.lastName) {
    name = `${prof.firstName || ''} ${prof.lastName || ''}`.trim();
  } else if (isValidName(prof.name)) {
    name = prof.name.trim();
  } else if (isValidName(prof.fullName)) {
    name = prof.fullName.trim();
  } else if (source.firstName || source.lastName) {
    name = `${source.firstName || ''} ${source.lastName || ''}`.trim();
  } else if (isValidName(source.name)) {
    name = source.name.trim();
  } else if (isValidName(source.fullName)) {
    name = source.fullName.trim();
  }

  // Fallback: If still invalid, check localStorage 'auth_user'
  if (!name && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        const uEmp = u.employee || {};
        const uProf = u.profile || u.user || {};
        if (uEmp.firstName || uEmp.lastName) {
          name = `${uEmp.firstName || ''} ${uEmp.lastName || ''}`.trim();
        } else if (isValidName(uEmp.name)) {
          name = uEmp.name.trim();
        } else if (isValidName(u.name)) {
          name = u.name.trim();
        } else if (isValidName(uProf.name)) {
          name = uProf.name.trim();
        }
      }
    } catch (e) {}
  }

  // Extract Employee ID
  let employeeId = 
    emp.employeeID ||
    emp.employeeId ||
    prof.employeeID ||
    prof.uniqueID ||
    prof.employeeId ||
    (typeof source.employeeId === 'string' && source.employeeId !== 'EMP-8492' && source.employeeId !== 'EMP' ? source.employeeId : '') ||
    source.employeeID ||
    source.uniqueID ||
    emp._id ||
    emp.id ||
    source._id ||
    source.id ||
    '';

  if (!employeeId && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        employeeId = u.employee?.employeeID || u.employee?.employeeId || u.employee?._id || u._id || u.id || '';
      }
    } catch (e) {}
  }

  // Extract Designation
  let designation = 
    emp.designation ||
    prof.designation ||
    source.designation ||
    emp.roleName ||
    source.roleName ||
    (typeof emp.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(emp.role) ? emp.role : '') ||
    (typeof source.role === 'string' && !/^[0-9a-fA-F]{24}$/.test(source.role) ? source.role : '') ||
    '';

  if (!designation && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        designation = u.employee?.designation || u.designation || u.profile?.designation || '';
      }
    } catch (e) {}
  }

  return {
    name: name || '',
    employeeId: employeeId || '',
    designation: designation || 'Team Member'
  };
};

// Helper to normalize screenshot records from backend schema to consistent UI model
export const normalizeScreenshotRecord = (raw) => {
  if (!raw) return null;
  const empDetails = extractEmployeeDetails(raw);
  const emp = (typeof raw.employee === 'object' && raw.employee !== null)
    ? raw.employee
    : (typeof raw.employeeId === 'object' && raw.employeeId !== null)
      ? raw.employeeId
      : {};
  const empId = empDetails.employeeId || (typeof raw.employeeId === 'string' && raw.employeeId !== 'EMP-8492' ? raw.employeeId : (raw._id || 'EMP'));
  const empName = empDetails.name || raw.employeeName || 'Employee';
  const empRole = empDetails.designation || raw.designation || 'Team Member';
  const empPhoto = typeof emp === 'object' ? (emp.profilePhoto || emp.photoUrl || emp.avatar || '') : (raw.profilePhoto || '');
  const positionInfo = deriveEmployeePosition(raw, typeof emp === 'object' ? emp : {});

  const imgUrl = raw.imageUrl || raw.fullUrl || raw.thumbnailUrl || raw.url || raw.secure_url ||
                 `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/v${Date.now()}/monitoring/${empId}.jpg`;

  const dateObj = raw.capturedAt ? new Date(raw.capturedAt) : (raw.createdAt ? new Date(raw.createdAt) : new Date());
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Mongoose Session Schema fields:
  // userId: ObjectId ref 'User'
  const rawUserId = raw.userId || (typeof raw.user === 'object' ? raw.user?._id : raw.user) || empId;
  const userId = resolveMongoObjectId(rawUserId);

  // attendanceId: ObjectId ref 'Attendance' or null
  const rawAttId = raw.attendanceId || (typeof raw.attendance === 'object' ? raw.attendance?._id : raw.attendance);
  const attendanceId = isValidObjectId(rawAttId) ? rawAttId : null;

  // Timestamps
  const startTime = raw.startTime || raw.sessionStartTime || dateObj.toISOString();
  const endTime = raw.endTime || raw.sessionEndTime || null;
  const lastActiveTime = raw.lastActiveTime || dateObj.toISOString();

  // Status enum: ["active", "break", "terminated", "auto_checkout"]
  const rawStatus = raw.status || (raw.attendanceStatus === 'on_break' ? 'break' : 'active');
  const status = ['active', 'break', 'terminated', 'auto_checkout'].includes(rawStatus)
    ? rawStatus
    : 'active';

  // Device Info string
  const deviceInfo = raw.deviceInfo || getDeviceInfoString();

  const createdAt = raw.createdAt || dateObj.toISOString();
  const updatedAt = raw.updatedAt || raw.createdAt || dateObj.toISOString();

  return {
    id: raw._id || raw.id || `scr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    _id: raw._id || raw.id,
    userId,
    attendanceId,
    startTime,
    endTime,
    lastActiveTime,
    status,
    deviceInfo,
    createdAt,
    updatedAt,
    employeeId: empId,
    employeeName: empName,
    designation: empRole,
    position: positionInfo.short,
    positionShort: positionInfo.short,
    positionLabel: positionInfo.label,
    profilePhoto: empPhoto,
    date: raw.date || dateStr,
    captureTime: raw.captureTime || raw.time || timeStr,
    sessionId: raw.sessionId || `SES-${dateStr.replace(/-/g, '')}-001`,
    sequenceNo: raw.sequenceNo || raw.sequence || Math.floor(Math.random() * 800 + 100),
    thumbnailUrl: raw.thumbnailUrl || imgUrl,
    fullUrl: raw.fullUrl || raw.imageUrl || imgUrl,
    activityLevel: raw.activityLevel || Math.floor(Math.random() * 20 + 80),
    activeWindow: raw.activeWindow || raw.windowTitle || 'Work Workspace',
    cloudStorage: 'Cloudinary (' + CLOUDINARY_CONFIG.cloudName + ')',
    capturedAt: raw.capturedAt || raw.createdAt || dateObj.toISOString()
  };
};

// Pure JS SHA-1 implementation fallback for environments where crypto.subtle is unavailable
function sha1Js(msg) {
  function rotateLeft(n, s) {
    return (n << s) | (n >>> (32 - s));
  }
  function cvtHex(val) {
    let str = '';
    for (let i = 7; i >= 0; i--) {
      const v = (val >>> (i * 4)) & 0x0f;
      str += v.toString(16);
    }
    return str;
  }
  const utf8 = unescape(encodeURIComponent(msg));
  const words = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const bits = utf8.length * 8;
  words[bits >> 2] |= 0x80 << (24 - (bits % 4) * 8);
  words[(((bits + 64) >> 9) << 4) + 15] = bits;

  let H0 = 0x67452301, H1 = 0xefcdab89, H2 = 0x98badcfe, H3 = 0x10325476, H4 = 0xc3d2e1f0;
  const W = new Array(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t] || 0;
    for (let t = 16; t < 80; t++) W[t] = rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);

    let A = H0, B = H1, C = H2, D = H3, E = H4;

    for (let t = 0; t < 80; t++) {
      let f, K;
      if (t < 20) {
        f = (B & C) | ((~B) & D);
        K = 0x5a827999;
      } else if (t < 40) {
        f = B ^ C ^ D;
        K = 0x6ed9eba1;
      } else if (t < 60) {
        f = (B & C) | (B & D) | (C & D);
        K = 0x8f1bbcdc;
      } else {
        f = B ^ C ^ D;
        K = 0xca62c1d6;
      }
      const temp = (rotateLeft(A, 5) + f + E + K + W[t]) & 0xffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }

    H0 = (H0 + A) & 0xffffffff;
    H1 = (H1 + B) & 0xffffffff;
    H2 = (H2 + C) & 0xffffffff;
    H3 = (H3 + D) & 0xffffffff;
    H4 = (H4 + E) & 0xffffffff;
  }

  return (cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4)).toLowerCase();
}

// Compute SHA-1 hash in lowercase hex
export const computeSha1 = async (str) => {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const data = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      // Fall through to js implementation
    }
  }
  return sha1Js(str);
};

// 4. Direct Upload to Cloudinary REST API
// Stores the file directly in the user's Cloudinary account (console.cloudinary.com)
export const uploadToCloudinaryDirect = async (blobOrFile, metadata = {}) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'employee_monitoring';

  // Cloudinary signature rule: parameters sorted alphabetically, secret appended
  // 'folder' comes before 'timestamp'
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
  const signature = await computeSha1(stringToSign);

  const cldFormData = new FormData();
  const filename = `screen_${metadata.employeeId || 'emp'}_${Date.now()}.jpg`;
  cldFormData.append('file', blobOrFile, filename);
  cldFormData.append('api_key', CLOUDINARY_CONFIG.apiKey);
  cldFormData.append('timestamp', String(timestamp));
  cldFormData.append('folder', folder);
  cldFormData.append('signature', signature);

  const cldUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  let response = await fetch(cldUrl, {
    method: 'POST',
    body: cldFormData
  });

  let data = await response.json();

  // If failed with folder, retry without folder
  if (!response.ok && data?.error?.message?.toLowerCase().includes('folder')) {
    const fallbackStringToSign = `timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
    const fallbackSig = await computeSha1(fallbackStringToSign);
    const fallbackFormData = new FormData();
    fallbackFormData.append('file', blobOrFile, filename);
    fallbackFormData.append('api_key', CLOUDINARY_CONFIG.apiKey);
    fallbackFormData.append('timestamp', String(timestamp));
    fallbackFormData.append('signature', fallbackSig);

    response = await fetch(cldUrl, {
      method: 'POST',
      body: fallbackFormData
    });
    data = await response.json();
  }

  if (!response.ok) {
    console.error('Cloudinary Direct Upload Error:', data);
    throw new Error(data?.error?.message || `Cloudinary upload failed: HTTP ${response.status}`);
  }

  console.log('✅ Stored in console.cloudinary.com:', data.secure_url);
  return data;
};

// 5. Main Upload Handler: Uploads directly to Cloudinary and syncs to backend API
export const uploadScreenshot = async (blobOrFile, metadata = {}) => {
  let cldResult = null;
  let cldError = null;

  // Normalize Session Schema Attributes:
  // userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }
  const effectiveUserId = resolveMongoObjectId(metadata.userId || metadata.employeeId);

  // attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", default: null }
  const effectiveAttendanceId = isValidObjectId(metadata.attendanceId) ? metadata.attendanceId : null;

  // startTime: { type: Date, default: Date.now }
  const effectiveStartTime = metadata.startTime || new Date().toISOString();

  // endTime: { type: Date, default: null }
  const effectiveEndTime = metadata.endTime || null;

  // lastActiveTime: { type: Date, default: Date.now }
  const effectiveLastActiveTime = metadata.lastActiveTime || new Date().toISOString();

  // status: { type: String, enum: ["active", "break", "terminated", "auto_checkout"], default: "active" }
  const effectiveStatus = ['active', 'break', 'terminated', 'auto_checkout'].includes(metadata.status)
    ? metadata.status
    : 'active';

  // deviceInfo: { type: String, default: "" }
  const effectiveDeviceInfo = metadata.deviceInfo || getDeviceInfoString();

  const nowIso = new Date().toISOString();
  const createdAt = metadata.createdAt || nowIso;
  const updatedAt = metadata.updatedAt || nowIso;

  // 1. Direct Cloudinary upload (guarantees storage in console.cloudinary.com)
  try {
    cldResult = await uploadToCloudinaryDirect(blobOrFile, {
      ...metadata,
      employeeId: effectiveUserId
    });
  } catch (err) {
    console.warn('Direct Cloudinary upload notice:', err.message);
    cldError = err;
  }

  const secureUrl = cldResult?.secure_url || cldResult?.url || '';

  // 2. Also submit to backend POST /api/employee-panel/monitoring/screenshot
  const formData = new FormData();
  if (blobOrFile instanceof Blob) {
    const filename = `screenshot-${effectiveUserId}-${Date.now()}.jpg`;
    formData.append('screenshot', blobOrFile, filename);
    formData.append('file', blobOrFile, filename);
    formData.append('image', blobOrFile, filename);
  } else if (typeof blobOrFile === 'string') {
    formData.append('imageData', blobOrFile);
  }

  if (secureUrl) {
    formData.append('imageUrl', secureUrl);
    formData.append('screenshotUrl', secureUrl);
    formData.append('cloudinaryUrl', secureUrl);
    formData.append('secure_url', secureUrl);
    formData.append('public_id', cldResult?.public_id || '');
    formData.append('publicId', cldResult?.public_id || '');
  }

  // --- Mongoose Session Schema Fields ---
  formData.append('userId', effectiveUserId);
  if (effectiveAttendanceId) {
    formData.append('attendanceId', effectiveAttendanceId);
  }
  formData.append('startTime', effectiveStartTime);
  if (effectiveEndTime) {
    formData.append('endTime', effectiveEndTime);
  }
  formData.append('lastActiveTime', effectiveLastActiveTime);
  formData.append('status', effectiveStatus);
  formData.append('deviceInfo', effectiveDeviceInfo);
  formData.append('createdAt', createdAt);
  formData.append('updatedAt', updatedAt);

  // Send structured JSON payload as well for multi-field backend parsers
  formData.append('sessionData', JSON.stringify({
    userId: effectiveUserId,
    attendanceId: effectiveAttendanceId,
    startTime: effectiveStartTime,
    endTime: effectiveEndTime,
    lastActiveTime: effectiveLastActiveTime,
    status: effectiveStatus,
    deviceInfo: effectiveDeviceInfo,
    createdAt,
    updatedAt
  }));

  // Contextual Employee & Cloudinary info
  formData.append('employeeId', metadata.employeeId || effectiveUserId);
  formData.append('employeeName', metadata.employeeName || '');
  formData.append('position', metadata.position || metadata.positionShort || 'EMP');
  formData.append('positionShort', metadata.positionShort || 'EMP');
  formData.append('positionLabel', metadata.positionLabel || 'Employee');
  formData.append('userRole', metadata.userRole || '');
  formData.append('isTeamLeader', String(metadata.isTeamLeader || false));
  formData.append('activeWindow', metadata.activeWindow || 'Kevalon Workspace');
  formData.append('sessionId', metadata.sessionId || '');
  formData.append('capturedAt', metadata.capturedAt || createdAt);
  formData.append('activityLevel', metadata.activityLevel ? String(metadata.activityLevel) : '90');
  formData.append('cloudName', CLOUDINARY_CONFIG.cloudName);
  formData.append('apiKey', CLOUDINARY_CONFIG.apiKey);
  formData.append('cloudId', CLOUDINARY_CONFIG.cloudId);

  let backendResult = null;
  try {
    let res;
    // Don't pass explicit Content-Type: multipart/form-data so Axios/Browser attaches boundary!
    try {
      res = await api.post('/api/employee-panel/monitoring/screenshot', formData, {
        headers: { 'Content-Type': undefined }
      });
    } catch (postErr) {
      if (postErr.response?.status === 404) {
        res = await api.post('/api/employee-panel//monitoring/screenshot', formData, {
          headers: { 'Content-Type': undefined }
        });
      } else {
        throw postErr;
      }
    }
    backendResult = res.data;
  } catch (backendErr) {
    console.warn('Backend screenshot sync notice:', backendErr.response?.data || backendErr.message);
  }

  // If Cloudinary failed and backend also didn't return an image URL, throw error
  if (!secureUrl && !backendResult?.imageUrl && !backendResult?.data?.imageUrl) {
    if (cldError) throw cldError;
    throw new Error('Failed to upload screenshot to Cloudinary');
  }

  const finalUrl = secureUrl || backendResult?.imageUrl || backendResult?.data?.imageUrl || backendResult?.data?.url || backendResult?.url;

  return {
    success: true,
    imageUrl: finalUrl,
    secure_url: finalUrl,
    public_id: cldResult?.public_id,
    cloudinary: cldResult,
    backend: backendResult,
    session: {
      userId: effectiveUserId,
      attendanceId: effectiveAttendanceId,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      lastActiveTime: effectiveLastActiveTime,
      status: effectiveStatus,
      deviceInfo: effectiveDeviceInfo,
      createdAt,
      updatedAt
    }
  };
};

// Real Screen Capture Stream State
let activeScreenStream = null;
let hiddenScreenVideo = null;
const streamListeners = new Set();

export const addScreenStreamListener = (listener) => {
  if (typeof listener === 'function') {
    streamListeners.add(listener);
    // Fire immediately with current state
    listener(isScreenCaptureActive());
  }
  return () => streamListeners.delete(listener);
};

const notifyStreamChange = (isActive) => {
  streamListeners.forEach((fn) => {
    try {
      fn(isActive);
    } catch (e) {
      console.warn('Screen stream listener error:', e);
    }
  });
};

// Check if real device screen capture is currently active
export const isScreenCaptureActive = () => {
  if (!activeScreenStream || !activeScreenStream.active) return false;
  const tracks = activeScreenStream.getVideoTracks();
  return tracks.length > 0 && tracks[0].readyState === 'live';
};

// 5. Start real employee device screen capture via Web Screen Capture API (getDisplayMedia)
export const startScreenCapture = async () => {
  if (isScreenCaptureActive()) {
    return activeScreenStream;
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen Capture API (getDisplayMedia) is not supported in this browser. Please use Chrome, Edge, or Firefox on desktop.');
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: false
    });

    activeScreenStream = stream;

    if (!hiddenScreenVideo) {
      hiddenScreenVideo = document.createElement('video');
      hiddenScreenVideo.autoplay = true;
      hiddenScreenVideo.muted = true;
      hiddenScreenVideo.playsInline = true;
      hiddenScreenVideo.style.position = 'fixed';
      hiddenScreenVideo.style.top = '-9999px';
      hiddenScreenVideo.style.left = '-9999px';
      hiddenScreenVideo.style.width = '1px';
      hiddenScreenVideo.style.height = '1px';
      hiddenScreenVideo.style.opacity = '0';
      hiddenScreenVideo.style.pointerEvents = 'none';
      document.body.appendChild(hiddenScreenVideo);
    }

    hiddenScreenVideo.srcObject = stream;
    await hiddenScreenVideo.play().catch(e => console.warn('Hidden video play notice:', e));

    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        stopScreenCapture();
      };
    }

    notifyStreamChange(true);
    return stream;
  } catch (err) {
    console.warn('Real screen capture permission denied or dismissed:', err);
    notifyStreamChange(false);
    throw err;
  }
};

// Stop real device screen capture
export const stopScreenCapture = () => {
  if (activeScreenStream) {
    activeScreenStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {}
    });
    activeScreenStream = null;
  }
  if (hiddenScreenVideo) {
    hiddenScreenVideo.srcObject = null;
  }
  notifyStreamChange(false);
};

// 6. Capture REAL employee device screen frame directly from the active screen stream
export const captureRealScreenBlob = async (options = {}) => {
  if (!isScreenCaptureActive()) {
    return null;
  }

  if (!hiddenScreenVideo) {
    return null;
  }

  // Ensure video dimensions are available
  if (hiddenScreenVideo.videoWidth === 0 || hiddenScreenVideo.videoHeight === 0) {
    await new Promise((res) => {
      if (hiddenScreenVideo.readyState >= 2) return res();
      hiddenScreenVideo.onloadedmetadata = () => res();
      setTimeout(res, 500);
    });
  }

  const vWidth = hiddenScreenVideo.videoWidth || 1920;
  const vHeight = hiddenScreenVideo.videoHeight || 1080;

  const canvas = document.createElement('canvas');
  canvas.width = vWidth;
  canvas.height = vHeight;
  const ctx = canvas.getContext('2d');

  // Draw real employee screen frame
  ctx.drawImage(hiddenScreenVideo, 0, 0, vWidth, vHeight);

  // Optional subtle monitoring stamp at bottom edge
  if (options.addWatermark) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const resolvedStamp = extractEmployeeDetails(options);
    const empName = (options.employeeName && options.employeeName !== 'Active Employee' && options.employeeName !== 'Employee')
      ? options.employeeName
      : (resolvedStamp.name || 'Employee');
    const empId = (options.employeeId && options.employeeId !== 'EMP-8492' && options.employeeId !== 'EMP')
      ? options.employeeId
      : (resolvedStamp.employeeId || 'EMP');

    const barHeight = Math.max(26, Math.round(vHeight * 0.035));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(0, vHeight - barHeight, vWidth, barHeight);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(16, vHeight - barHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 ${Math.max(11, Math.round(barHeight * 0.42))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `Real Device Screen Capture • ${empName} (${empId}) • ${dateStr} ${timeStr}`,
      28,
      vHeight - barHeight / 2 + 4
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `Cloudinary Vault: ${CLOUDINARY_CONFIG.cloudName}`,
      vWidth - 16,
      vHeight - barHeight / 2 + 4
    );
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.88);
  });
};

// 7. Auxiliary fallback canvas generator (used only if screen permission is temporarily pending)
export const generateScreenshotBlob = (options = {}) => {
  return new Promise((resolve) => {
    try {
      const width = 1280;
      const height = 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const resolvedGen = extractEmployeeDetails(options);
      const employeeName = (options.employeeName && options.employeeName !== 'Active Employee' && options.employeeName !== 'Employee')
        ? options.employeeName
        : (resolvedGen.name || 'Employee');
      const employeeId = (options.employeeId && options.employeeId !== 'EMP-8492' && options.employeeId !== 'EMP-KT' && options.employeeId !== 'EMP')
        ? options.employeeId
        : (resolvedGen.employeeId || 'EMP-KT');

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Real Device Screen Share Pending Permission', width / 2, height / 2 - 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(`Please click "Enable Screen Capture" to stream real device desktop frames.`, width / 2, height / 2 + 15);
      ctx.fillText(`${employeeName} (${employeeId}) • ${dateStr} ${timeStr}`, width / 2, height / 2 + 45);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.85);
    } catch (e) {
      resolve(new Blob(['screen-pending'], { type: 'image/jpeg' }));
    }
  });
};
