(function() {
  "use strict";
  const e = window.location.hostname;
  const t = e === "localhost" || e === "127.0.0.1";
  const o = "5500";
  try {
    const e = localStorage.getItem("solis_debug") === "1" || /(?:\?|&)solis_debug=1(?:&|$)/.test(location.search || "");
    const o = console.log.bind(console);
    const n = console.info.bind(console);
    const i = console.warn.bind(console);
    const s = console.error.bind(console);
    window.solisLog = function solisLog(e, t) {
      const n = String(e || "Solis");
      const i = t == null ? "" : String(t);
      const s = "          ";
      o(`%c${s}${n}${s}\n%c${i ? s + i + s : ""}`, 'display:block;text-align:center;font-family:"Plus Jakarta Sans",system-ui,sans-serif;' + "font-size:13px;font-weight:800;letter-spacing:0.04em;color:#fff;" + "background:linear-gradient(135deg,#f97316,#ea580c);padding:10px 18px;border-radius:10px 10px 0 0;", "display:block;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;" + "font-size:11px;font-weight:500;color:#431407;background:#ffedd5;padding:8px 18px;" + "border-radius:0 0 10px 10px;margin-bottom:6px;");
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
        i(...e.map(stripEmoji));
      };
    } else {
      console.log = o;
      console.info = n;
    }
    window.__SOLIS_DEBUG__ = !!e;
    window.solisLog("Solis AI", t ? "local" : "www · api.solisai.video");
  } catch (e) {}
  if (!window.API_BASE_URL) {
    if (t) {
      window.API_BASE_URL = `http://${e}:${o}/api`;
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
    let o = String(e);
    if (o.startsWith("http://") || o.startsWith("https://")) return o;
    if (o.startsWith("/api/")) o = o.slice(4); else if (o.startsWith("/api")) o = o.slice(4);
    if (!o.startsWith("/")) o = "/" + o;
    return t + o;
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
    window.fetch = function fetchWithApiHost(t, o) {
      let n = typeof t === "string" ? t : t instanceof Request ? t.url : String(t || "");
      if (n.startsWith("/api/") || n === "/api") {
        const e = window.apiUrl(n);
        if (typeof t === "string") {
          t = e;
        } else if (t instanceof Request) {
          t = new Request(e, t);
        }
      }
      return e(t, o);
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
    var n = 0;
    document.addEventListener("touchend", function(e) {
      var t = Date.now();
      if (t - n <= 280) {
        var o = e.target;
        if (o && (o.closest && o.closest('input, textarea, select, [contenteditable="true"],' + ".preview-placeholder, .sub-text-block, .overlay-text-block," + ".sub-resize-handle, #splitscreenDivider, .ss-collapse-handle," + "[data-template-element-id], .preview-timeline-wrap, .preview-timeline-handle"))) {
          n = t;
          return;
        }
        e.preventDefault();
      }
      n = t;
    }, {
      passive: false
    });
  } catch (e) {}
})();
