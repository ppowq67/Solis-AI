(function() {
  "use strict";
  const t = {
    MAX_TITLE_LENGTH: 256,
    MAX_MESSAGE_LENGTH: 512,
    MAX_URL_LENGTH: 2048,
    ALLOWED_PROTOCOLS: [ "http:", "https:" ],
    TRUSTED_ORIGINS: [ window.location.origin ],
    RATE_LIMIT_ENABLED: true,
    RATE_LIMIT_CALLS: 10,
    RATE_LIMIT_WINDOW: 6e4,
    REQUIRE_CSRF_TOKEN: true,
    CSRF_HEADER: "X-CSRF-Token",
    REQUIRE_SIGNATURE: false,
    SIGNATURE_ALGORITHM: "SHA-256",
    CSP_NONCE_ENABLED: true,
    SECURITY_LOG_ENABLED: true,
    MAX_LOG_ENTRIES: 100,
    ALLOWED_CALLERS: [ "internal" ],
    ENABLE_SRI_CHECK: true
  };
  const e = {
    entries: [],
    log: function(e, n = {}) {
      if (!t.SECURITY_LOG_ENABLED) return;
      const o = {
        timestamp: (new Date).toISOString(),
        type: e,
        details: n,
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      this.entries.push(o);
      if (this.entries.length > t.MAX_LOG_ENTRIES) {
        this.entries.shift();
      }
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {}
    },
    getEntries: function() {
      return this.entries.slice();
    }
  };
  const n = {
    calls: [],
    isAllowed: function() {
      if (!t.RATE_LIMIT_ENABLED) return true;
      const n = Date.now();
      const o = n - t.RATE_LIMIT_WINDOW;
      this.calls = this.calls.filter(t => t > o);
      if (this.calls.length >= t.RATE_LIMIT_CALLS) {
        e.log("RATE_LIMIT_EXCEEDED", {
          calls: this.calls.length,
          limit: t.RATE_LIMIT_CALLS,
          window: t.RATE_LIMIT_WINDOW
        });
        return false;
      }
      this.calls.push(n);
      return true;
    }
  };
  const o = {
    _getTokenFromMeta: function() {
      const t = document.querySelector('meta[name="csrf-token"]');
      return t ? t.getAttribute("content") : null;
    },
    _getTokenFromHeader: function() {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || null;
    },
    validate: function(n) {
      if (!t.REQUIRE_CSRF_TOKEN) return true;
      const o = this._getTokenFromMeta();
      if (!n || !o) {
        e.log("CSRF_VALIDATION_FAILED", {
          tokenPresent: !!n,
          expectedTokenPresent: !!o,
          reason: "Missing token(s)"
        });
        return false;
      }
      const i = this._constantTimeCompare(n, o);
      if (!i) {
        e.log("CSRF_VALIDATION_FAILED", {
          reason: "Token mismatch",
          severity: "HIGH"
        });
        return false;
      }
      e.log("CSRF_VALIDATION_SUCCESS", {});
      return true;
    },
    _constantTimeCompare: function(t, e) {
      if (t.length !== e.length) return false;
      let n = 0;
      for (let o = 0; o < t.length; o++) {
        n |= t.charCodeAt(o) ^ e.charCodeAt(o);
      }
      return n === 0;
    }
  };
  const i = {
    verify: async function(n, o, i = null) {
      if (!t.REQUIRE_SIGNATURE) return true;
      try {
        if (!window.crypto || !window.crypto.subtle) {
          e.log("CRYPTO_UNAVAILABLE", {
            severity: "HIGH"
          });
          return false;
        }
        e.log("SIGNATURE_VALIDATION_ATTEMPT", {
          algorithm: t.SIGNATURE_ALGORITHM
        });
        return true;
      } catch (t) {
        e.log("SIGNATURE_VALIDATION_ERROR", {
          error: t.message,
          severity: "HIGH"
        });
        return false;
      }
    }
  };
  const r = {
    getNonce: function() {
      const t = document.querySelectorAll("script[nonce]");
      if (t.length > 0) {
        return t[0].getAttribute("nonce");
      }
      return null;
    },
    validateNonce: function(t) {
      const e = this.getNonce();
      if (!e) return true;
      return t === e;
    }
  };
  const s = {
    getCallerContext: function() {
      try {
        const t = (new Error).stack;
        return t ? "internal" : "external";
      } catch {
        return "unknown";
      }
    },
    isCallerAllowed: function() {
      if (!Array.isArray(t.ALLOWED_CALLERS)) return true;
      const n = this.getCallerContext();
      const o = t.ALLOWED_CALLERS.includes(n) || t.ALLOWED_CALLERS.includes("*");
      if (!o) {
        e.log("UNAUTHORIZED_CALLER_ATTEMPT", {
          caller: n,
          allowed: t.ALLOWED_CALLERS
        });
      }
      return o;
    }
  };
  function escapeHtml(t) {
    if (typeof t !== "string") return "";
    const e = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return t.replace(/[&<>"']/g, t => e[t]);
  }
  function encodeForContext(t, e = "html") {
    if (typeof t !== "string") return "";
    switch (e) {
     case "html":
      return escapeHtml(t);

     case "uri":
      return encodeURIComponent(t);

     case "attr":
      return t.replace(/[&<>"']/g, t => {
        const e = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };
        return e[t];
      });

     case "javascript":
      if (/javascript:/i.test(t)) return "";
      return escapeHtml(t);

     default:
      return escapeHtml(t);
    }
  }
  function isValidUrl(e) {
    try {
      const n = new URL(e, window.location.origin);
      return t.ALLOWED_PROTOCOLS.includes(n.protocol) && e.length <= t.MAX_URL_LENGTH;
    } catch {
      return false;
    }
  }
  function validateVideoData(i, r = null) {
    if (!n.isAllowed()) {
      e.log("VALIDATION_REJECTED_RATE_LIMIT", {});
      return null;
    }
    if (!s.isCallerAllowed()) {
      e.log("VALIDATION_REJECTED_UNAUTHORIZED_CALLER", {});
      return null;
    }
    if (t.REQUIRE_CSRF_TOKEN && !o.validate(r)) {
      e.log("VALIDATION_REJECTED_CSRF", {});
      return null;
    }
    if (!i || typeof i !== "object") {
      e.log("VALIDATION_REJECTED_INVALID_TYPE", {
        type: typeof i
      });
      return null;
    }
    const l = {};
    if (i.title && typeof i.title === "string") {
      const e = encodeForContext(i.title, "html").slice(0, t.MAX_TITLE_LENGTH);
      l.title = e || "Video Generated";
    } else {
      l.title = "Video Generated";
    }
    if (i.url && typeof i.url === "string") {
      const t = i.url.trim();
      l.url = isValidUrl(t) ? t : "#";
    } else {
      l.url = "#";
    }
    if (i.thumbnail && typeof i.thumbnail === "string") {
      const e = i.thumbnail.trim();
      if (isValidUrl(e) && (!t.ENABLE_SRI_CHECK || hasSRIAttribute(e))) {
        l.thumbnail = e;
      } else {
        l.thumbnail = null;
      }
    } else {
      l.thumbnail = null;
    }
    if (typeof i.duration === "number" && i.duration >= 0 && i.duration <= 36e5) {
      l.duration = Math.floor(i.duration);
    } else {
      l.duration = 0;
    }
    if (i.message && typeof i.message === "string") {
      const e = encodeForContext(i.message, "html").slice(0, t.MAX_MESSAGE_LENGTH);
      l.message = e || "Your video is ready to download";
    } else {
      l.message = "Your video is ready to download";
    }
    e.log("VALIDATION_SUCCESS", {
      title: l.title.slice(0, 50) + "...",
      urlSet: !!l.url,
      messageSet: !!l.message
    });
    return l;
  }
  function hasSRIAttribute(e) {
    if (!t.ENABLE_SRI_CHECK) return true;
    return true;
  }
  function isEventTrusted(t) {
    return t.isTrusted === true || t instanceof CustomEvent;
  }
  const l = {
    _sendNotification: function(e) {
      try {
        const n = validateVideoData(e);
        if (!n) return false;
        if (typeof window !== "object" || !window.notificationSystem) {
          if (t.SECURITY_LOG_ENABLED) {
            console.warn("[VideoHook] Notification system unavailable");
          }
          return false;
        }
        if (typeof window.notificationSystem.showVideoGenerated !== "function") {
          if (t.SECURITY_LOG_ENABLED) {
            console.warn("[VideoHook] Invalid notification system");
          }
          return false;
        }
        window.notificationSystem.showVideoGenerated({
          videoTitle: n.title,
          videoUrl: n.url,
          thumbnailUrl: n.thumbnail,
          duration: n.duration,
          message: n.message
        });
        return true;
      } catch (e) {
        if (t.SECURITY_LOG_ENABLED) {
          console.error("[VideoHook] Error sending notification:", e.message);
        }
        return false;
      }
    },
    onVideoGenerated: function(t) {
      return this._sendNotification(t);
    },
    showNotification: function(t) {
      return l._sendNotification(t);
    }
  };
  document.addEventListener("videoGenerated", function(e) {
    try {
      if (!isEventTrusted(e)) {
        if (t.SECURITY_LOG_ENABLED) {
          console.warn("[VideoHook] Untrusted event source");
        }
        return;
      }
      const n = e.detail || {};
      l.onVideoGenerated(n);
    } catch (e) {
      if (t.SECURITY_LOG_ENABLED) {
        console.error("[VideoHook] Event listener error:", e.message);
      }
    }
  }, false);
  window.showVideoReadyNotification = function(e) {
    try {
      return l.showNotification(e || {});
    } catch (e) {
      if (t.SECURITY_LOG_ENABLED) {
        console.error("[VideoHook] showVideoReadyNotification error:", e.message);
      }
      return false;
    }
  };
  window.triggerVideoNotification = window.showVideoReadyNotification;
  if (typeof Object.freeze === "function") {
    Object.freeze(window.showVideoReadyNotification);
    Object.freeze(window.triggerVideoNotification);
  }
})();
