window.AuthValidator = (() => {
  const apiBase = () => window.API_BASE_URL || window.location.origin + "/api";
  const tryRefreshSession = async () => {
    try {
      const t = await fetch(`${apiBase()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      return t.ok;
    } catch (t) {
      console.warn("[Auth] Refresh attempt failed:", t);
      return false;
    }
  };
  const validateAuth = async () => {
    try {
      let t = await fetch(`${apiBase()}/auth/check`, {
        method: "GET",
        credentials: "include"
      });
      if (t.ok) {
        const e = await t.json();
        if (e.authenticated) {
          return {
            valid: true,
            user: e.user
          };
        }
      }
      const e = await tryRefreshSession();
      if (e) {
        t = await fetch(`${apiBase()}/auth/check`, {
          method: "GET",
          credentials: "include"
        });
        if (t.ok) {
          const e = await t.json();
          if (e.authenticated) {
            return {
              valid: true,
              user: e.user
            };
          }
        }
      }
      return {
        valid: false
      };
    } catch (t) {
      console.warn("[Auth] Validation error:", t);
      return {
        valid: false
      };
    }
  };
  const isOnAuthPage = () => {
    const t = window.location.pathname;
    return t.includes("login") || t.includes("welcome") || t.includes("auth");
  };
  const redirectToLogin = (t = "") => {
    const e = "/login.html" + (t ? `?redirect=${encodeURIComponent(window.location.pathname)}` : "");
    window.location.href = e;
  };
  const initialize = async () => {
    if (isOnAuthPage()) {
      return {
        valid: false
      };
    }
    const t = await validateAuth();
    if (!t.valid) {
      redirectToLogin("session_expired");
      return t;
    }
    return t;
  };
  return {
    initialize: initialize,
    validateAuth: validateAuth,
    tryRefreshSession: tryRefreshSession,
    redirectToLogin: redirectToLogin,
    isOnAuthPage: isOnAuthPage
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.AuthValidator.initialize());
} else {
  window.AuthValidator.initialize();
}
