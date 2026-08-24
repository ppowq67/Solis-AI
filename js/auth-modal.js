(function(e) {
  "use strict";
  var t = "solis_skip_auth_redirect";
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
    if (e.API_BASE_URL) return String(e.API_BASE_URL).replace(/\/$/, "");
    var t = location.hostname || "";
    var o = t === "localhost" || t === "127.0.0.1";
    if (o) return location.protocol + "//" + t + ":5500/api";
    return "https://api.solisai.video/api";
  }
  function oauthUrl(t) {
    if (typeof e.apiUrl === "function") return e.apiUrl(t);
    var o = apiBase();
    var a = String(t || "");
    if (a.indexOf("/api/") === 0) a = a.slice(4); else if (a.indexOf("/api") === 0) a = a.slice(4);
    if (a.charAt(0) !== "/") a = "/" + a;
    return o + a;
  }
  function modalEl() {
    return document.getElementById("auth-modal");
  }
  function openAuthModal(e) {
    var t = modalEl();
    if (!t) return;
    t.hidden = false;
    t.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("auth-modal-open");
    document.body.classList.add("auth-modal-open");
    var o = t.querySelector("#googleLoginBtn") || t.querySelector("button, [href]");
    if (o) setTimeout(function() {
      o.focus();
    }, 40);
    if (e && e.replaceUrl) {
      try {
        var a = new URL(location.href);
        a.searchParams.set("login", "1");
        history.replaceState({}, "", a.pathname + a.search);
      } catch (e) {}
    }
  }
  function closeAuthModal(e) {
    var t = modalEl();
    if (!t) return;
    t.hidden = true;
    t.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("auth-modal-open");
    document.body.classList.remove("auth-modal-open");
    if (!e || e.cleanUrl !== false) {
      try {
        var o = new URL(location.href);
        o.searchParams.delete("login");
        o.searchParams.delete("auth");
        var a = o.searchParams.toString();
        history.replaceState({}, "", o.pathname + (a ? "?" + a : "") + o.hash);
      } catch (e) {}
    }
  }
  function isOpen() {
    var e = modalEl();
    return e && !e.hidden;
  }
  function resetOAuth(e) {
    var t = o[e];
    if (!t) return;
    var a = document.getElementById(t.btnId);
    var n = document.getElementById(t.textId);
    if (a) {
      a.disabled = false;
      a.removeAttribute("aria-busy");
    }
    if (n) n.textContent = t.label;
  }
  async function handleOAuth(e) {
    var a = o[e];
    if (!a) return;
    try {
      var n = document.getElementById(a.btnId);
      var r = document.getElementById(a.textId);
      if (r) r.textContent = "Connecting…";
      if (n) {
        n.disabled = true;
        n.setAttribute("aria-busy", "true");
      }
      try {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("solis_template_memory");
        localStorage.removeItem("solis_caption_by_template");
        localStorage.removeItem("solis_memory_owner_id");
      } catch (e) {}
      sessionStorage.removeItem(t);
      var i = oauthUrl(a.path);
      var l = i.indexOf("?") >= 0 ? "&" : "?";
      location.assign(i + l + "nav=1");
    } catch (o) {
      sessionStorage.setItem(t, "1");
      console.error("Login error:", o);
      var u = String(o && o.message || "");
      alert(/failed to fetch|networkerror|load failed/i.test(u) ? "Could not reach Solis servers. Check your connection and try again." : u || "Login failed. Please try again.");
      resetOAuth(e);
    }
  }
  function wireOAuth() {
    Object.keys(o).forEach(function(e) {
      var t = o[e];
      var a = document.getElementById(t.btnId);
      if (!a || a.__solisAuthBound) return;
      a.__solisAuthBound = true;
      a.addEventListener("click", function() {
        handleOAuth(e);
      });
    });
  }
  function wireChrome() {
    var e = modalEl();
    if (!e || e.__solisChromeBound) return;
    e.__solisChromeBound = true;
    var t = e.querySelector("[data-auth-dismiss]");
    if (t) t.addEventListener("click", function() {
      closeAuthModal();
    });
    var o = e.querySelector("[data-auth-close]");
    if (o) o.addEventListener("click", function() {
      closeAuthModal();
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && isOpen()) closeAuthModal();
    });
    document.querySelectorAll("[data-open-auth]").forEach(function(e) {
      e.addEventListener("click", function(e) {
        e.preventDefault();
        openAuthModal();
      });
    });
  }
  function finishLogoutLanding() {
    sessionStorage.setItem(t, "1");
    sessionStorage.removeItem("solis_just_logged_out");
    try {
      var e = localStorage.getItem("theme");
      localStorage.clear();
      if (e) localStorage.setItem("theme", e);
    } catch (e) {}
    fetch(apiBase() + "/auth/logout", {
      method: "POST",
      credentials: "include"
    }).catch(function() {});
  }
  function bootFromQuery() {
    var e = new URLSearchParams(location.search);
    var t = e.has("logout") || e.get("login") === "1" || e.get("auth") === "1" || sessionStorage.getItem("solis_just_logged_out") === "1";
    if (e.has("logout") || sessionStorage.getItem("solis_just_logged_out") === "1") {
      finishLogoutLanding();
    }
    if (t) {
      openAuthModal({
        replaceUrl: true
      });
      try {
        var o = new URL(location.href);
        o.searchParams.delete("logout");
        history.replaceState({}, "", o.pathname + (o.searchParams.toString() ? "?" + o.searchParams.toString() : ""));
      } catch (e) {}
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
      }).then(function(e) {
        return e.ok ? e.json() : null;
      }).then(function(e) {
        if (e && e.authenticated && e.user) location.href = "/dashboard"; else open();
      }).catch(open);
    } catch (e) {
      open();
    }
  }
  function init() {
    wireChrome();
    wireOAuth();
    bootFromQuery();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  e.openAuthModal = openAuthModal;
  e.closeAuthModal = closeAuthModal;
  e.goToAppOrLogin = goToAppOrLogin;
})(window);
