(function() {
  "use strict";
  const e = window.location.hostname;
  const t = e === "localhost" || e === "127.0.0.1";
  const i = "5500";
  try {
    const e = localStorage.getItem("solis_debug") === "1" || /(?:\?|&)solis_debug=1(?:&|$)/.test(location.search || "");
    if (!e) {
      const noop = function() {};
      console.log = noop;
      console.debug = noop;
      console.info = noop;
      const stripEmoji = e => typeof e === "string" ? e.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/^\s+/, "") : e;
      const e = console.error.bind(console);
      console.error = function(...t) {
        e(...t.map(stripEmoji));
      };
    }
    window.__SOLIS_DEBUG__ = !!e;
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
        var i = e.target;
        if (i && (i.closest && i.closest('input, textarea, select, [contenteditable="true"],' + ".preview-placeholder, .sub-text-block, .overlay-text-block," + ".sub-resize-handle, #splitscreenDivider, .ss-collapse-handle," + "[data-template-element-id], .preview-timeline-wrap, .preview-timeline-handle"))) {
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
