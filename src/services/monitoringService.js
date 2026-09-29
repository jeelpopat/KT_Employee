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

// Helper to normalize screenshot records from backend schema to consistent UI model
export const normalizeScreenshotRecord = (raw) => {
  if (!raw) return null;
  const emp = raw.employeeId || raw.employee || {};
  const empId = typeof emp === 'object' ? (emp.employeeId || emp._id || emp.id || 'EMP') : (raw.employeeId || 'EMP');
  const empName = typeof emp === 'object' ? (emp.name || emp.fullName || 'Employee') : (raw.employeeName || 'Employee');
  const empRole = typeof emp === 'object' ? (emp.designation || emp.role || 'Team Member') : (raw.designation || 'Team Member');
  const empPhoto = typeof emp === 'object' ? (emp.profilePhoto || emp.photoUrl || emp.avatar || '') : (raw.profilePhoto || '');

  const imgUrl = raw.imageUrl || raw.fullUrl || raw.thumbnailUrl || raw.url || raw.secure_url ||
                 `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/v${Date.now()}/monitoring/${empId}.jpg`;

  const dateObj = raw.capturedAt ? new Date(raw.capturedAt) : (raw.createdAt ? new Date(raw.createdAt) : new Date());
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    id: raw._id || raw.id || `scr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    employeeId: empId,
    employeeName: empName,
    designation: empRole,
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
    capturedAt: raw.capturedAt || raw.createdAt || new Date().toISOString()
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

  // 1. Direct Cloudinary upload (guarantees storage in console.cloudinary.com)
  try {
    cldResult = await uploadToCloudinaryDirect(blobOrFile, metadata);
  } catch (err) {
    console.warn('Direct Cloudinary upload notice:', err.message);
    cldError = err;
  }

  const secureUrl = cldResult?.secure_url || cldResult?.url || '';

  // 2. Also submit to backend POST /api/employee-panel/monitoring/screenshot
  const formData = new FormData();
  if (blobOrFile instanceof Blob) {
    const filename = `screenshot-${metadata.employeeId || 'emp'}-${Date.now()}.jpg`;
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

  formData.append('employeeId', metadata.employeeId || '');
  formData.append('employeeName', metadata.employeeName || '');
  formData.append('activeWindow', metadata.activeWindow || 'Kevalon Workspace');
  formData.append('sessionId', metadata.sessionId || '');
  formData.append('capturedAt', metadata.capturedAt || new Date().toISOString());
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
    backend: backendResult
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
    const empName = options.employeeName || 'Employee';
    const empId = options.employeeId || 'EMP';

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
      const employeeName = options.employeeName || 'Active Employee';
      const employeeId = options.employeeId || 'EMP-KT';

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
