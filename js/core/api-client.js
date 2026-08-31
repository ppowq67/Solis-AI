(function() {
  function apiBase() {
    return window.API_BASE_URL || "";
  }
  function resolveApiUrl(e) {
    if (!e) return apiBase();
    const t = String(e);
    if (t.startsWith("http://") || t.startsWith("https://")) return t;
    if (typeof window.apiUrl === "function") return window.apiUrl(t);
    const n = apiBase().replace(/\/$/, "");
    let i = t.startsWith("/") ? t : "/" + t;
    if (n.endsWith("/api") && i.startsWith("/api/")) {
      i = i.slice(4);
    }
    return n + i;
  }
  async function apiFetch(e, t = {}) {
    const n = {
      ...t.headers || {}
    };
    const i = t.body != null;
    const o = (t.method || "GET").toUpperCase();
    const r = typeof FormData !== "undefined" && t.body instanceof FormData;
    if (i && !r && !n["Content-Type"] && !n["content-type"]) {
      n["Content-Type"] = "application/json";
    }
    if (r) {
      delete n["Content-Type"];
      delete n["content-type"];
    }
    return fetch(resolveApiUrl(e), {
      ...t,
      method: o,
      credentials: "include",
      headers: n
    });
  }
  function getAuthHeaders() {
    return {
      "Content-Type": "application/json"
    };
  }
  function getCSRFToken() {
    return null;
  }
  async function initializeCSRFToken() {
    return true;
  }
  async function secureFetch(e, t = {}) {
    return apiFetch(e, t);
  }
  window.apiFetch = apiFetch;
  window.secureFetch = secureFetch;
  window.resolveApiUrl = resolveApiUrl;
  window.getAuthHeaders = getAuthHeaders;
  window.getCSRFToken = getCSRFToken;
  window.initializeCSRFToken = initializeCSRFToken;
})();
