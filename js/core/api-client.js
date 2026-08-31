/**
 * Standard API client for Solis AI SaaS.
 * Auth is httpOnly cookie-based — no CSRF meta tags or X-CSRF-Token headers.
 */
(function () {
  function apiBase() {
    return window.API_BASE_URL || '';
  }

  /** Resolve relative /api paths without doubling the /api prefix on API_BASE_URL. */
  function resolveApiUrl(url) {
    if (!url) return apiBase();
    const s = String(url);
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (typeof window.apiUrl === 'function') return window.apiUrl(s);
    const base = apiBase().replace(/\/$/, '');
    let path = s.startsWith('/') ? s : '/' + s;
    if (base.endsWith('/api') && path.startsWith('/api/')) {
      path = path.slice(4);
    }
    return base + path;
  }

  async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body != null;
    const method = (options.method || 'GET').toUpperCase();
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    // Never set Content-Type for FormData — browser must add multipart boundary
    if (
      hasBody &&
      !isFormData &&
      !headers['Content-Type'] &&
      !headers['content-type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    if (isFormData) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }

    return fetch(resolveApiUrl(url), {
      ...options,
      method,
      credentials: 'include',
      headers,
    });
  }

  function getAuthHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  /** @deprecated Use apiFetch — kept so older scripts keep working */
  function getCSRFToken() {
    return null;
  }

  /** @deprecated */
  async function initializeCSRFToken() {
    return true;
  }

  /** @deprecated alias */
  async function secureFetch(url, options = {}) {
    return apiFetch(url, options);
  }

  window.apiFetch = apiFetch;
  window.secureFetch = secureFetch;
  window.resolveApiUrl = resolveApiUrl;
  window.getAuthHeaders = getAuthHeaders;
  window.getCSRFToken = getCSRFToken;
  window.initializeCSRFToken = initializeCSRFToken;
})();
