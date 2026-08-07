(function() {
  "use strict";
  const e = window.location.hostname;
  const t = e === "localhost" || e === "127.0.0.1";
  const i = "5500";
  try {
    const e = localStorage.getItem("solis_debug") === "1" || /(?:\?|&)solis_debug=1(?:&|$)/.test(location.search || "");
    const i = console.log.bind(console);
    const o = console.info.bind(console);
    const n = console.warn.bind(console);
    const s = console.error.bind(console);
    window.solisLog = function solisLog(e, t) {
      const o = String(e || "Solis");
      const n = t == null ? "" : String(t);
      const s = "          ";
      i(`%c${s}${o}${s}\n%c${n ? s + n + s : ""}`, 'display:block;text-align:center;font-family:"Plus Jakarta Sans",system-ui,sans-serif;' + "font-size:13px;font-weight:800;letter-spacing:0.04em;color:#fff;" + "background:linear-gradient(135deg,#f97316,#ea580c);padding:10px 18px;border-radius:10px 10px 0 0;", "display:block;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;" + "font-size:11px;font-weight:500;color:#431407;background:#ffedd5;padding:8px 18px;" + "border-radius:0 0 10px 10px;margin-bottom:6px;");
    };
    if (!e) {
      const noop = function() {};
      console.log = noop;
      console.debug = noop;
      console.info = noop;
      const stripEmoji = e => typeof e === "string" ? e.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/^\s+/, "") : e;
      console.error = function(...e) {
        s(...e.map(stripEmoji));
      };
      console.warn = function(...e) {
        n(...e.map(stripEmoji));
      };
    } else {
      console.log = i;
      console.info = o;
    }
    window.__SOLIS_DEBUG__ = !!e;
    window.solisLog("Solis AI", t ? "local" : "www · api.solisai.video");
  } catch (e) {}
  if (!window.API_BASE_URL) {
    if (t) {
      window.API_BASE_URL = `http://${e}:${i}/api`;
    } else {
      window.API_BASE_URL = "https://api.solisai.video/api";
    }
    if (!t) {
      Object.defineProperty(window, "API_BASE_URL", {
        writable: false,
        configurable: false,
        enumerable: false
      });
    }
  }
  try {
    Object.defineProperty(window, "API_ORIGIN", {
      value: String(window.API_BASE_URL || "").replace(/\/api\/?$/, ""),
      writable: t,
      configurable: t,
      enumerable: false
    });
  } catch (e) {
    window.API_ORIGIN = window.API_BASE_URL.replace(/\/api\/?$/, "");
  }
  window.apiUrl = function apiUrl(e) {
    const t = (window.API_BASE_URL || "").replace(/\/$/, "");
    if (!e) return t;
    let i = String(e);
    if (i.startsWith("http://") || i.startsWith("https://")) return i;
    if (i.startsWith("/api/")) i = i.slice(4); else if (i.startsWith("/api")) i = i.slice(4);
    if (!i.startsWith("/")) i = "/" + i;
    return t + i;
  };
  try {
    Object.defineProperty(window, "apiUrl", {
      value: window.apiUrl,
      writable: false,
      configurable: false,
      enumerable: false
    });
  } catch (e) {}
  (function patchFetchForApiHost() {
    const e = window.fetch.bind(window);
    const t = (() => {
      try {
        return new URL(window.API_BASE_URL || "", location.href).host;
      } catch (e) {
        return "";
      }
    })();
    const i = {
      fails: 0,
      openUntil: 0,
      noteOk() {
        this.fails = 0;
        this.openUntil = 0;
      },
      noteFail() {
        this.fails += 1;
        if (this.fails >= 3) {
          this.openUntil = Date.now() + Math.min(45e3, 15e3 + this.fails * 3e3);
        }
      },
      allowPoll() {
        return Date.now() >= this.openUntil;
      },
      isApiUrl(e) {
        if (!e) return false;
        if (e.startsWith("/api/") || e === "/api") return true;
        try {
          const i = new URL(e, location.href);
          return !!(t && i.host === t);
        } catch (e) {
          return false;
        }
      },
      isPollPath(e) {
        return /\/clips\/status|\/auth\/check|\/auth\/subscription|\/news\/feed|\/user\/profile/i.test(String(e || ""));
      }
    };
    window.solisApiGate = i;
    window.fetch = function fetchWithApiHost(t, o) {
      let n = typeof t === "string" ? t : t instanceof Request ? t.url : String(t || "");
      if (n.startsWith("/api/") || n === "/api") {
        const e = window.apiUrl(n);
        if (typeof t === "string") {
          t = e;
          n = e;
        } else if (t instanceof Request) {
          t = new Request(e, t);
          n = e;
        }
      }
      const s = o || {};
      if (i.isApiUrl(n) && i.isPollPath(n) && s.solisOptionalPoll && !i.allowPoll()) {
        return Promise.reject(new Error("solis_api_backoff"));
      }
      return e(t, o).then(e => {
        if (i.isApiUrl(n)) {
          if (e && e.ok) i.noteOk(); else if (e && e.status >= 500) i.noteFail();
        }
        return e;
      }).catch(e => {
        if (i.isApiUrl(n) && String(e?.message || "") !== "solis_api_backoff") {
          i.noteFail();
        }
        throw e;
      });
    };
  })();
  if (!t) {
    try {
      delete window.__SOLIS_DEBUG__;
      Object.defineProperty(window, "__SOLIS_DEBUG__", {
        get() {
          return false;
        },
        set() {},
        enumerable: false,
        configurable: false
      });
    } catch (e) {}
  }
  window.SOLIS_INITIALIZED = true;
  try {
    document.documentElement.style.touchAction = "manipulation";
    if (document.body) document.body.style.touchAction = "manipulation"; else document.addEventListener("DOMContentLoaded", function() {
      if (document.body) document.body.style.touchAction = "manipulation";
    });
    var o = 0;
    document.addEventListener("touchend", function(e) {
      var t = Date.now();
      if (t - o <= 280) {
        var i = e.target;
        if (i && (i.closest && i.closest('input, textarea, select, [contenteditable="true"],' + ".preview-placeholder, .sub-text-block, .overlay-text-block," + ".sub-resize-handle, #splitscreenDivider, .ss-collapse-handle," + "[data-template-element-id], .preview-timeline-wrap, .preview-timeline-handle"))) {
          o = t;
          return;
        }
        e.preventDefault();
      }
      o = t;
    }, {
      passive: false
    });
  } catch (e) {}
})();
