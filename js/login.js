(function detectLogoutLanding() {
  const t = new URLSearchParams(window.location.search);
  if (t.has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1") {
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

let googleLoginBtn, googleBtnText;

async function initializeCSRFToken() {
  return true;
}

async function setupLoginPage() {
  await waitForInitialization();
  googleLoginBtn = document.getElementById("i1wl");
  googleBtnText = document.getElementById("i1wk");
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
    const t = await fetch(`${window.API_BASE_URL}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (t.ok) {
      const e = await t.json();
      if (e.authenticated && e.user) {
        window.location.href = window.location.origin + "/dashboard.html";
        return;
      }
    }
  } catch (t) {}
  setupEventListeners();
}

function getCSRFToken() {
  return null;
}

function disableButtonWithCountdown(t, e = 3) {
  t.disabled = true;
  let o = e;
  const n = t.querySelector("span").textContent;
  const i = setInterval(() => {
    t.querySelector("span").textContent = `Try again in ${o}s`;
    o--;
    if (o < 0) {
      clearInterval(i);
      t.disabled = false;
      t.querySelector("span").textContent = n;
    }
  }, 1e3);
}

function setupEventListeners() {
  if (!googleLoginBtn) return;
  googleLoginBtn.addEventListener("click", handleGoogleLogin);
}

async function handleGoogleLogin() {
  try {
    googleBtnText.textContent = "Connecting…";
    googleLoginBtn.disabled = true;
    const t = window.API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5500/api`;
    await fetch(`${t}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => {});
    sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);
    const e = window.apiUrl ? window.apiUrl("/api/auth/google?fresh=1") : `${t}/auth/google?fresh=1`;
    const o = await fetch(e, {
      method: "GET",
      credentials: "include"
    });
    if (!o.ok) throw new Error(`Server error: ${o.status}`);
    const n = await o.json();
    if (n.auth_url) {
      window.location.href = n.auth_url;
      return;
    }
    throw new Error("Authentication unavailable");
  } catch (t) {
    sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, "1");
    console.error("Login error:", t);
    alert("Login failed. Please check your connection and try again.");
    googleBtnText.textContent = "Continue with Google";
    disableButtonWithCountdown(googleLoginBtn, 3);
  }
}

async function secureFetch(t, e = {}) {
  return fetch(t, {
    ...e,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...e.headers
    }
  });
}

document.addEventListener("DOMContentLoaded", setupLoginPage);
