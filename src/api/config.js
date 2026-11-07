export const BASE_URL = 'https://api.kevalontechnology.com/';
export const API_BASE_URL = 'https://api.kevalontechnology.com/';

/**
 * Helper to construct an endpoint URL safely with BASE_URL
 * @param {string} endpoint 
 * @returns {string}
 */
export const getApiUrl = (endpoint = '') => {
  if (!endpoint) return BASE_URL;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${cleanEndpoint}`;
};

export default BASE_URL;
