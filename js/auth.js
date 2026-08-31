const AUTH_CONFIG = {
  API_BASE: window.location.origin + "/api",
  ACCESS_TOKEN_DURATION: 36e5,
  REFRESH_CHECK_INTERVAL: 50 * 60 * 1e3
};

let refreshTokenTimer = null;

let refeshCheckTimer = null;

function setupAutoRefresh() {
  if (refeshCheckTimer) clearInterval(refeshCheckTimer);
  refeshCheckTimer = setInterval(async () => {
    await refreshTokenSilently();
  }, AUTH_CONFIG.REFRESH_CHECK_INTERVAL);
}

async function refreshTokenSilently() {
  try {
    const e = await fetch(`${AUTH_CONFIG.API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    if (e.ok) {
      const t = await e.json();
      return true;
    } else if (e.status === 401) {
      console.warn("[Auth] Refresh failed - session expired, redirecting to login");
      redirectToLogin();
      return false;
    }
  } catch (e) {
    console.error("[Auth] Refresh error:", e);
  }
  return false;
}

async function logoutUser() {
  if (window._logoutInProgress) return;
  window._logoutInProgress = true;
  if (refreshTokenTimer) clearTimeout(refreshTokenTimer);
  if (refeshCheckTimer) clearInterval(refeshCheckTimer);
  localStorage.clear();
  sessionStorage.setItem("solis_just_logged_out", "1");
  sessionStorage.setItem("solis_skip_auth_redirect", "1");
  fetch(`${AUTH_CONFIG.API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  }).catch(() => {}).finally(() => {
    window.location.replace("/login.html?logout=1");
  });
}

async function isAuthenticated() {
  try {
    const e = await fetch(`${AUTH_CONFIG.API_BASE}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (e.ok) {
      const t = await e.json();
      return t.authenticated === true;
    }
  } catch (e) {
    console.error("[Auth] Authentication check error:", e);
  }
  return false;
}

async function getCurrentUser() {
  try {
    const e = await fetch(`${AUTH_CONFIG.API_BASE}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (e.ok) {
      const t = await e.json();
      if (t.authenticated && t.user) {
        return t.user;
      }
    }
  } catch (e) {
    console.error("[Auth] Failed to get current user:", e);
  }
  return null;
}

function redirectToLogin() {
  if (!window.location.pathname.includes("login")) {
    window.location.href = "/login.html";
  }
}

async function protectedFetch(e, t = {}) {
  let r = await fetch(e, {
    ...t,
    credentials: "include"
  });
  if (r.status === 401) {
    const n = await refreshTokenSilently();
    if (n) {
      r = await fetch(e, {
        ...t,
        credentials: "include"
      });
    } else {
      redirectToLogin();
    }
  }
  return r;
}

function initAuth() {
  setupAutoRefresh();
  isAuthenticated().then(e => {
    if (!e) {
      console.warn("[Auth] Not authenticated, redirecting to login");
      redirectToLogin();
    } else {}
  });
}

window.Auth = {
  setup: setupAutoRefresh,
  refresh: refreshTokenSilently,
  logout: logoutUser,
  isAuthenticated: isAuthenticated,
  getCurrentUser: getCurrentUser,
  redirectToLogin: redirectToLogin,
  protectedFetch: protectedFetch,
  init: initAuth
};
