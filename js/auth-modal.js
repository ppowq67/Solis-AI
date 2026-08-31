(function(t) {
  "use strict";
  var e = "solis_skip_auth_redirect";
  var o = {
    google: {
      btnId: "googleLoginBtn",
      textId: "googleBtnText",
      label: "Sign in with Google",
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
  function apiBase() {
    if (t.API_BASE_URL) return String(t.API_BASE_URL).replace(/\/$/, "");
    var e = location.hostname || "";
    var o = e === "localhost" || e === "127.0.0.1";
    if (o) return location.protocol + "//" + e + ":5500/api";
    return "https://api.solisai.video/api";
  }
  function oauthUrl(e) {
    if (typeof t.apiUrl === "function") return t.apiUrl(e);
    var o = apiBase();
    var n = String(e || "");
    if (n.indexOf("/api/") === 0) n = n.slice(4); else if (n.indexOf("/api") === 0) n = n.slice(4);
    if (n.charAt(0) !== "/") n = "/" + n;
    return o + n;
  }
  function modalEl() {
    return document.getElementById("auth-modal");
  }
  function closeAuthModal(t) {
    var e = modalEl();
    if (!e) return;
    e.hidden = true;
    e.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("auth-modal-open");
    document.body.classList.remove("auth-modal-open");
    if (!t || t.cleanUrl !== false) {
      try {
        var o = new URL(location.href);
        o.searchParams.delete("login");
        o.searchParams.delete("auth");
        var n = o.searchParams.toString();
        history.replaceState({}, "", o.pathname + (n ? "?" + n : "") + o.hash);
      } catch (t) {}
    }
  }
  function isOpen() {
    var t = modalEl();
    return t && !t.hidden;
  }
  function resetOAuth(t) {
    var e = o[t];
    if (!e) return;
    var n = document.getElementById(e.btnId);
    var a = document.getElementById(e.textId);
    if (n) {
      n.disabled = false;
      n.removeAttribute("aria-busy");
      n.classList.remove("is-connecting");
    }
    if (a) a.textContent = e.label;
  }
  function resetAllOAuth() {
    Object.keys(o).forEach(resetOAuth);
  }
  function unlockOAuthUi() {
    resetAllOAuth();
  }
  function openAuthModal(t) {
    var e = modalEl();
    if (!e) return;
    unlockOAuthUi();
    e.hidden = false;
    e.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("auth-modal-open");
    document.body.classList.add("auth-modal-open");
    var o = e.querySelector("#googleLoginBtn") || e.querySelector("button, [href]");
    if (o) setTimeout(function() {
      o.focus();
    }, 40);
    if (t && t.replaceUrl) {
      try {
        var n = new URL(location.href);
        n.searchParams.set("login", "1");
        history.replaceState({}, "", n.pathname + n.search);
      } catch (t) {}
    }
  }
  async function handleOAuth(t) {
    var n = o[t];
    if (!n) return;
    var a = document.getElementById(n.btnId);
    var i = document.getElementById(n.textId);
    try {
      Object.keys(o).forEach(function(e) {
        if (e !== t) resetOAuth(e);
      });
      if (i) i.textContent = "Connecting…";
      if (a) {
        a.disabled = true;
        a.setAttribute("aria-busy", "true");
        a.classList.add("is-connecting");
      }
      try {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("solis_template_memory");
        localStorage.removeItem("solis_caption_by_template");
        localStorage.removeItem("solis_memory_owner_id");
      } catch (t) {}
      sessionStorage.removeItem(e);
      var r = oauthUrl(n.path);
      var u = r.indexOf("?") >= 0 ? "&" : "?";
      setTimeout(unlockOAuthUi, 8e3);
      location.assign(r + u + "nav=1");
    } catch (t) {
      sessionStorage.setItem(e, "1");
      console.error("Login error:", t);
      var l = String(t && t.message || "");
      alert(/failed to fetch|networkerror|load failed/i.test(l) ? "Could not reach Solis servers. Check your connection and try again." : l || "Login failed. Please try again.");
      unlockOAuthUi();
    }
  }
  function wireOAuth() {
    Object.keys(o).forEach(function(t) {
      var e = o[t];
      var n = document.getElementById(e.btnId);
      if (!n || n.__solisAuthBound) return;
      n.__solisAuthBound = true;
      n.addEventListener("click", function() {
        handleOAuth(t);
      });
    });
  }
  function wireChrome() {
    var t = modalEl();
    if (!t || t.__solisChromeBound) return;
    t.__solisChromeBound = true;
    var e = t.querySelector("[data-auth-dismiss]");
    if (e) e.addEventListener("click", function() {
      unlockOAuthUi();
      closeAuthModal();
    });
    var o = t.querySelector("[data-auth-close]");
    if (o) o.addEventListener("click", function() {
      unlockOAuthUi();
      closeAuthModal();
    });
    document.addEventListener("keydown", function(t) {
      if (t.key === "Escape" && isOpen()) {
        unlockOAuthUi();
        closeAuthModal();
      }
    });
    document.querySelectorAll("[data-open-auth]").forEach(function(t) {
      t.addEventListener("click", function(t) {
        t.preventDefault();
        openAuthModal();
      });
    });
  }
  function finishLogoutLanding() {
    sessionStorage.setItem(e, "1");
    sessionStorage.removeItem("solis_just_logged_out");
    try {
      var t = localStorage.getItem("theme");
      localStorage.clear();
      if (t) localStorage.setItem("theme", t);
    } catch (t) {}
    fetch(apiBase() + "/auth/logout", {
      method: "POST",
      credentials: "include"
    }).catch(function() {});
  }
  function bootFromQuery() {
    var t = new URLSearchParams(location.search);
    var e = t.has("logout") || t.get("login") === "1" || t.get("auth") === "1" || sessionStorage.getItem("solis_just_logged_out") === "1";
    if (t.has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1") {
      finishLogoutLanding();
    }
    if (e) {
      openAuthModal({
        replaceUrl: true
      });
      try {
        var o = new URL(location.href);
        o.searchParams.delete("logout");
        history.replaceState({}, "", o.pathname + (o.searchParams.toString() ? "?" + o.searchParams.toString() : ""));
      } catch (t) {}
    }
  }
  function goToAppOrLogin() {
    var open = function() {
      openAuthModal();
    };
    try {
      fetch(apiBase() + "/auth/check", {
        method: "GET",
        credentials: "include"
      }).then(function(t) {
        return t.ok ? t.json() : null;
      }).then(function(t) {
        if (t && t.authenticated && t.user) location.href = "/dashboard"; else open();
      }).catch(open);
    } catch (t) {
      open();
    }
  }
  function init() {
    wireChrome();
    wireOAuth();
    unlockOAuthUi();
    bootFromQuery();
  }
  window.addEventListener("pageshow", unlockOAuthUi);
  window.addEventListener("pagehide", unlockOAuthUi);
  window.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") unlockOAuthUi();
  });
  window.addEventListener("focus", unlockOAuthUi);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  t.openAuthModal = openAuthModal;
  t.closeAuthModal = closeAuthModal;
  t.goToAppOrLogin = goToAppOrLogin;
  t.resetAuthOAuthButtons = unlockOAuthUi;
})(window);
