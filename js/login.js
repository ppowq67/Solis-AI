(function detectLogoutLanding() {
  const t = new URLSearchParams(window.location.search);
  if (t.has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1") {
    window.__SOLIS_FORCE_LOGIN_PAGE__ = true;
    sessionStorage.setItem("solis_skip_auth_redirect", "1");
  }
})();

const SKIP_AUTH_REDIRECT_KEY = "solis_skip_auth_redirect";

const OAUTH_PROVIDERS = {
  google: {
    btnId: "googleLoginBtn",
    textId: "googleBtnText",
    label: "Continue with Google",
    path: "/api/auth/google?fresh=1"
  },
  tiktok: {
    btnId: "tiktokLoginBtn",
    textId: "tiktokBtnText",
    label: "Continue with TikTok",
    path: "/api/auth/tiktok?fresh=1"
  },
  youtube: {
    btnId: "youtubeLoginBtn",
    textId: "youtubeBtnText",
    label: "Continue with YouTube",
    path: "/api/auth/youtube?fresh=1"
  }
};

function isPostLogoutLanding() {
  return window.__SOLIS_FORCE_LOGIN_PAGE__ === true || new URLSearchParams(window.location.search).has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1";
}

function shouldSkipAuthRedirect() {
  return sessionStorage.getItem(SKIP_AUTH_REDIRECT_KEY) === "1" || isPostLogoutLanding();
}

function finishLogoutLanding() {
  sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, "1");
  sessionStorage.removeItem("solis_just_logged_out");
  window.__SOLIS_FORCE_LOGIN_PAGE__ = false;
  const t = localStorage.getItem("theme");
  localStorage.clear();
  if (t) localStorage.setItem("theme", t);
  window.history.replaceState({}, document.title, "/login.html");
  const e = window.API_BASE_URL || window.location.origin + "/api";
  fetch(`${e}/auth/logout`, {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
}

async function waitForInitialization() {
  return new Promise(t => {
    if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
      t();
    } else {
      const e = setInterval(() => {
        if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
          clearInterval(e);
          t();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(e);
        t();
      }, 5e3);
    }
  });
}

async function initializeCSRFToken() {
  return true;
}

function resetOAuthButton(t) {
  const e = OAUTH_PROVIDERS[t];
  if (!e) return;
  const n = document.getElementById(e.btnId);
  const o = document.getElementById(e.textId);
  if (n) {
    n.disabled = false;
    n.removeAttribute("aria-busy");
  }
  if (o) o.textContent = e.label;
}

function resetAllOAuthButtons() {
  Object.keys(OAUTH_PROVIDERS).forEach(resetOAuthButton);
}

function disableButtonWithCountdown(t, e = 3, n) {
  if (!t) return;
  t.disabled = true;
  let o = e;
  const i = t.querySelector("span");
  const a = n || i && i.textContent || "Try again";
  const s = setInterval(() => {
    if (i) i.textContent = `Try again in ${o}s`;
    o -= 1;
    if (o < 0) {
      clearInterval(s);
      t.disabled = false;
      if (i) i.textContent = a;
    }
  }, 1e3);
}

function setupEventListeners() {
  Object.entries(OAUTH_PROVIDERS).forEach(([t, e]) => {
    const n = document.getElementById(e.btnId);
    if (!n) return;
    const handler = () => handleOAuthLogin(t);
    n.removeEventListener("click", handler);
    n.addEventListener("click", handler);
  });
}

async function handleOAuthLogin(t) {
  const e = OAUTH_PROVIDERS[t];
  if (!e) return;
  try {
    const n = document.getElementById(e.btnId);
    const o = document.getElementById(e.textId);
    if (o) o.textContent = "Connecting…";
    if (n) {
      n.disabled = true;
      n.setAttribute("aria-busy", "true");
    }
    const i = window.API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5500/api`;
    await fetch(`${i}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => {});
    try {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("solis_template_memory");
      localStorage.removeItem("solis_caption_by_template");
      localStorage.removeItem("solis_memory_owner_id");
    } catch (t) {}
    sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);
    const a = window.apiUrl ? window.apiUrl(e.path) : `${i}${e.path.replace(/^\/api/, "")}`;
    const s = await fetch(a, {
      method: "GET",
      credentials: "include"
    });
    if (!s.ok) {
      const t = await s.json().catch(() => ({}));
      throw new Error(t.error || t.message || `Server error: ${s.status}`);
    }
    const r = await s.json();
    if (r.auth_url) {
      resetOAuthButton(t);
      window.location.href = r.auth_url;
      return;
    }
    throw new Error("Authentication unavailable");
  } catch (n) {
    sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, "1");
    console.error("Login error:", n);
    alert(n.message || "Login failed. Please check your connection and try again.");
    resetOAuthButton(t);
    const o = document.getElementById(e.btnId);
    disableButtonWithCountdown(o, 3, e.label);
  }
}

async function setupLoginPage() {
  await waitForInitialization();
  const t = Object.values(OAUTH_PROVIDERS).some(t => document.getElementById(t.btnId));
  if (isPostLogoutLanding()) {
    finishLogoutLanding();
    if (t) setupEventListeners();
    return;
  }
  if (sessionStorage.getItem(SKIP_AUTH_REDIRECT_KEY) === "1") {
    sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);
  }
  if (!t) return;
  await initializeCSRFToken();
  try {
    const t = await fetch(`${window.API_BASE_URL}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (t.ok) {
      const e = await t.json();
      if (e.authenticated && e.user) {
        window.location.replace("/dashboard");
        return;
      }
    }
  } catch (t) {}
  setupEventListeners();
}

function unlockOAuthUi() {
  resetAllOAuthButtons();
}

window.addEventListener("pageshow", unlockOAuthUi);

window.addEventListener("pagehide", unlockOAuthUi);

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") unlockOAuthUi();
});

window.addEventListener("focus", unlockOAuthUi);

document.addEventListener("DOMContentLoaded", setupLoginPage);
