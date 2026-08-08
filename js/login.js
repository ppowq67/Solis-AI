(function detectLogoutLanding() {
  const e = new URLSearchParams(window.location.search);
  if (e.has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1") {
    window.__SOLIS_FORCE_LOGIN_PAGE__ = true;
    sessionStorage.setItem("solis_skip_auth_redirect", "1");
  }
})();

const SKIP_AUTH_REDIRECT_KEY = "solis_skip_auth_redirect";

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
  const e = localStorage.getItem("theme");
  localStorage.clear();
  if (e) localStorage.setItem("theme", e);
  window.history.replaceState({}, document.title, "/login.html");
  const t = window.API_BASE_URL || window.location.origin + "/api";
  fetch(`${t}/auth/logout`, {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
}

async function waitForInitialization() {
  return new Promise(e => {
    if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
      e();
    } else {
      const t = setInterval(() => {
        if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
          clearInterval(t);
          e();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        e();
      }, 5e3);
    }
  });
}

let googleLoginBtn, googleBtnText;

async function initializeCSRFToken() {
  return true;
}

async function setupLoginPage() {
  await waitForInitialization();
  googleLoginBtn = document.getElementById("googleLoginBtn");
  googleBtnText = document.getElementById("googleBtnText");
  if (isPostLogoutLanding()) {
    finishLogoutLanding();
    if (googleLoginBtn && googleBtnText) {
      setupEventListeners();
    }
    return;
  }
  if (shouldSkipAuthRedirect()) {
    if (googleLoginBtn && googleBtnText) {
      setupEventListeners();
    }
    return;
  }
  if (!googleLoginBtn || !googleBtnText) {
    return;
  }
  await initializeCSRFToken();
  try {
    const e = await fetch(`${window.API_BASE_URL}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (e.ok) {
      const t = await e.json();
      if (t.authenticated && t.user) {
        window.location.href = window.location.origin + "/dashboard.html";
        return;
      }
    }
  } catch (e) {}
  setupEventListeners();
}

function getCSRFToken() {
  return null;
}

function disableButtonWithCountdown(e, t = 3) {
  e.disabled = true;
  let o = t;
  const n = e.querySelector("span").textContent;
  const i = setInterval(() => {
    e.querySelector("span").textContent = `Try again in ${o}s`;
    o--;
    if (o < 0) {
      clearInterval(i);
      e.disabled = false;
      e.querySelector("span").textContent = n;
    }
  }, 1e3);
}

function resetGoogleLoginButton() {
  const e = document.getElementById("googleLoginBtn") || googleLoginBtn;
  const t = document.getElementById("googleBtnText") || googleBtnText;
  if (e) {
    e.disabled = false;
    e.removeAttribute("aria-busy");
  }
  if (t) t.textContent = "Continue with Google";
  googleLoginBtn = e || googleLoginBtn;
  googleBtnText = t || googleBtnText;
}

function setupEventListeners() {
  if (!googleLoginBtn) return;
  googleLoginBtn.removeEventListener("click", handleGoogleLogin);
  googleLoginBtn.addEventListener("click", handleGoogleLogin);
}

async function handleGoogleLogin() {
  try {
    const e = document.getElementById("googleLoginBtn");
    const t = document.getElementById("googleBtnText");
    googleLoginBtn = e;
    googleBtnText = t;
    if (t) t.textContent = "Connecting…";
    if (e) {
      e.disabled = true;
      e.setAttribute("aria-busy", "true");
    }
    const o = window.API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5500/api`;
    await fetch(`${o}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => {});
    try {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("solis_template_memory");
      localStorage.removeItem("solis_caption_by_template");
      localStorage.removeItem("solis_memory_owner_id");
    } catch (e) {}
    sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);
    const n = window.apiUrl ? window.apiUrl("/api/auth/google?fresh=1") : `${o}/auth/google?fresh=1`;
    const i = await fetch(n, {
      method: "GET",
      credentials: "include"
    });
    if (!i.ok) throw new Error(`Server error: ${i.status}`);
    const g = await i.json();
    if (g.auth_url) {
      resetGoogleLoginButton();
      window.location.href = g.auth_url;
      return;
    }
    throw new Error("Authentication unavailable");
  } catch (e) {
    sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, "1");
    console.error("Login error:", e);
    alert("Login failed. Please check your connection and try again.");
    resetGoogleLoginButton();
    if (googleLoginBtn) disableButtonWithCountdown(googleLoginBtn, 3);
  }
}

async function secureFetch(e, t = {}) {
  return fetch(e, {
    ...t,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...t.headers
    }
  });
}

function unlockGoogleLoginUi() {
  resetGoogleLoginButton();
}

window.addEventListener("pageshow", unlockGoogleLoginUi);

window.addEventListener("pagehide", unlockGoogleLoginUi);

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") unlockGoogleLoginUi();
});

window.addEventListener("focus", unlockGoogleLoginUi);

document.addEventListener("DOMContentLoaded", setupLoginPage);
