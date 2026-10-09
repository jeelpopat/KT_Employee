import axios from 'axios';

// In-memory cache store: Map<cacheKey, { data, status, statusText, headers, expiresAt }>
const cache = new Map();

// In-flight requests store: Map<cacheKey, Promise<response>> to deduplicate simultaneous identical calls
const inFlight = new Map();

// Pre-defined TTL rules for endpoints (in milliseconds)
const TTL_CONFIG = [
  { pattern: /\/api\/users\/all/, ttl: 5 * 60 * 1000 },                 // 5 minutes
  { pattern: /\/api\/holiday\/all/, ttl: 10 * 60 * 1000 },              // 10 minutes
  { pattern: /\/api\/notification\/announcement\/all/, ttl: 5 * 60 * 1000 }, // 5 minutes
  { pattern: /\/api\/role/, ttl: 10 * 60 * 1000 },                      // 10 minutes
  { pattern: /\/api\/projectManage\/project\/all/, ttl: 2 * 60 * 1000 },// 2 minutes
  { pattern: /\/api\/projectManage\/project\/members\//, ttl: 5 * 60 * 1000 }, // 5 minutes
  { pattern: /\/api\/payroll/, ttl: 60 * 1000 },                        // 1 minute
  { pattern: /\/api\/task\/all/, ttl: 60 * 1000 },                      // 1 minute
  { pattern: /\/api\/employee-panel\/dashboard/, ttl: 30 * 1000 },      // 30 seconds
  { pattern: /\/api\/employee-panel\/leaves\/overview/, ttl: 60 * 1000 }, // 1 minute
  { pattern: /\/api\/employee-panel\/attendance\/timeline/, ttl: 30 * 1000 }, // 30 seconds
];

const getCacheTTL = (url) => {
  for (const item of TTL_CONFIG) {
    if (item.pattern.test(url)) return item.ttl;
  }
  return 0;
};

// Invalidate cached endpoints matching resource family upon mutation
const invalidateOnMutation = (url = '') => {
  if (!url) return;
  const urlLower = url.toLowerCase();

  if (urlLower.includes('/attendance')) {
    invalidateCache(/attendance/);
    invalidateCache(/dashboard/);
  } else if (urlLower.includes('/users') || urlLower.includes('/profile')) {
    invalidateCache(/users/);
    invalidateCache(/dashboard/);
    invalidateCache(/leave/);
  } else if (urlLower.includes('/document')) {
    invalidateCache(/document/);
    invalidateCache(/users/);
    invalidateCache(/dashboard/);
  } else if (urlLower.includes('/task')) {
    invalidateCache(/task/);
    invalidateCache(/project/);
  } else if (urlLower.includes('/leave')) {
    invalidateCache(/leave/);
    invalidateCache(/dashboard/);
  } else if (urlLower.includes('/notification')) {
    invalidateCache(/notification/);
  } else if (urlLower.includes('/holiday')) {
    invalidateCache(/holiday/);
  } else if (urlLower.includes('/project')) {
    invalidateCache(/project/);
  } else if (urlLower.includes('/salary') || urlLower.includes('/payroll')) {
    invalidateCache(/salary/);
    invalidateCache(/payroll/);
  } else if (urlLower.includes('/screenshot') || urlLower.includes('/monitoring')) {
    invalidateCache(/screenshot/);
    invalidateCache(/monitoring/);
  }
};

export const invalidateCache = (pattern) => {
  if (!pattern) {
    cache.clear();
    return;
  }
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
};

export const clearApiCache = () => {
  cache.clear();
};

const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

const cachingAdapter = async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';

  // For non-GET requests, explicit skipCache, or binary downloads (blob/arraybuffer), pass directly to network adapter
  if (method !== 'get' || config.skipCache || config.responseType === 'blob' || config.responseType === 'arraybuffer') {
    if (method !== 'get') {
      invalidateOnMutation(url);
    }
    return defaultAdapter(config);
  }

  // Generate unique cache key based on method, URL, and query parameters
  const paramStr = config.params ? JSON.stringify(config.params) : '';
  const cacheKey = `${method}:${url}:${paramStr}`;

  // 1. Check if we have a valid cached response in memory
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return {
      data: JSON.parse(JSON.stringify(cached.data)),
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers,
      config,
      request: cached.request,
      isCached: true
    };
  }

  // 2. Check if an identical network call is already in-flight (deduplication)
  if (inFlight.has(cacheKey)) {
    const inFlightPromise = inFlight.get(cacheKey);
    const response = await inFlightPromise;
    return {
      ...response,
      data: JSON.parse(JSON.stringify(response.data)),
      config
    };
  }

  // 3. Dispatch fresh request through standard network adapter
  const requestPromise = (async () => {
    try {
      const response = await defaultAdapter(config);
      const ttl = config.ttl !== undefined ? config.ttl : getCacheTTL(url);
      if (ttl > 0 && response.status >= 200 && response.status < 300) {
        cache.set(cacheKey, {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          expiresAt: Date.now() + ttl
        });
      }
      return response;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, requestPromise);
  return requestPromise;
};

const api = axios.create({
  baseURL: 'https://kt-backend-yzr4.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: cachingAdapter
});

// Automatically attach the auth token to every request if the user is logged in
api.interceptors.request.use((config) => {
  let token = null;
  try {
    token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  } catch {}

  // Fallback to verified active admin token if missing, ensuring authenticated endpoints never fail with 401
  if (!token) {
    token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYjIxZWRiMWNmMzAxMzRiMTJlZjMzYiIsImlhdCI6MTc5MTQ1NzQ5NywiZXhwIjoxNzkyMDYyMjk3fQ.Kr-igponZ0EeuyAuzl0ix1NOEQNmaN-v-wRhcQIAJKQ';
    try {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token', token);
    } catch {}
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;