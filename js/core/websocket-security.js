class WebSocketSecurityManager {
  constructor(e = {}) {
    this.authToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.userId = null;
    this.sessionId = this._generateSecureId();
    this.nonceCache = new Set;
    this.maxCachedNonces = 1e3;
    this.rateLimitMap = new Map;
    this.rateLimits = e.rateLimits || {
      delete_clip: 10,
      processing_update: 100,
      default: 50
    };
    this.validateIncomingMessages = e.validateIncomingMessages !== false;
    this.messageValidationQueue = [];
    this.maxValidationQueueSize = 100;
    this.securityLogs = [];
    this.maxSecurityLogs = 500;
    this.suspiciousActivityThreshold = e.suspiciousActivityThreshold || 10;
    this.suspiciousActivityCount = 0;
    this.MAX_MESSAGE_SIZE = e.maxMessageSize || 256 * 1024;
    this.TIMESTAMP_VALIDITY_WINDOW = e.timestampWindow || 3e5;
    this.TOKEN_REFRESH_THRESHOLD = e.tokenRefreshThreshold || 3e5;
    this.NONCE_VALIDITY_DURATION = e.nonceValidity || 36e5;
    this.CLEANUP_INTERVAL = e.cleanupInterval || 6e5;
    this.expectedOrigin = e.expectedOrigin || window.location.origin;
    this.nonceTimestamps = new Map;
    this.cleanupTask = null;
  }
  init(e, t, s = null) {
    if (!e || !t) {
      console.error("Invalid credentials for security init");
      return false;
    }
    this.authToken = e;
    this.userId = t;
    this.refreshToken = s;
    if (!this._validateToken()) {
      console.error("Token validation failed");
      return false;
    }
    this._logSecurityEvent("security_init", {
      userId: t
    });
    return true;
  }
  _validateToken() {
    if (!this.authToken) {
      console.warn("No authentication token");
      return false;
    }
    try {
      const e = this.authToken.split(".");
      if (e.length !== 3) {
        throw new Error("Invalid JWT structure");
      }
      const t = JSON.parse(atob(e[1]));
      if (t.exp) {
        const e = t.exp * 1e3;
        this.tokenExpiresAt = e;
        if (e < Date.now()) {
          console.warn("Token expired");
          return false;
        }
        if (this.refreshToken) {
          this._scheduleTokenRefresh();
        }
      }
      return true;
    } catch (e) {
      console.error("Token validation error:", e);
      return false;
    }
  }
  _scheduleTokenRefresh() {
    if (!this.tokenExpiresAt) return;
    const e = this.tokenExpiresAt - Date.now() - this.tokenRefreshThreshold;
    if (e > 0) {
      setTimeout(() => this._refreshToken(), e);
    }
  }
  async _refreshToken() {
    if (!this.userId) return;
    try {
      const e = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this._getCsrfToken()
        },
        body: JSON.stringify({
          userId: this.userId
        })
      });
      if (e.ok) {
        const t = await e.json();
        this.authToken = t.authToken;
        this._validateToken();
        this._logSecurityEvent("token_refresh_success", {});
      } else {
        this._logSecurityEvent("token_refresh_failed", {
          status: e.status
        });
        console.error("Token refresh failed");
      }
    } catch (e) {
      this._logSecurityEvent("token_refresh_error", {
        error: e.message
      });
      console.error("Token refresh error:", e);
    }
  }
  _getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
  }
  _generateSecureId() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const e = new Uint8Array(16);
      crypto.getRandomValues(e);
      return Array.from(e, e => e.toString(16).padStart(2, "0")).join("");
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  _generateNonce() {
    const e = this._generateSecureId();
    const t = Date.now();
    this.nonceCache.add(e);
    this.nonceTimestamps.set(e, t);
    if (this.nonceCache.size > this.maxCachedNonces) {
      const e = Array.from(this.nonceTimestamps.entries()).sort((e, t) => e[1] - t[1]).slice(0, this.nonceCache.size - this.maxCachedNonces);
      e.forEach(([e, t]) => {
        this.nonceCache.delete(e);
        this.nonceTimestamps.delete(e);
      });
    }
    return e;
  }
  _validateNonce(e) {
    if (!e || !this.nonceCache.has(e)) {
      return false;
    }
    const t = this.nonceTimestamps.get(e);
    if (!t || Date.now() - t > this.NONCE_VALIDITY_DURATION) {
      this.nonceCache.delete(e);
      this.nonceTimestamps.delete(e);
      return false;
    }
    return true;
  }
  _cleanupExpiredNonces() {
    const e = Date.now();
    const t = [];
    for (const [s, i] of this.nonceTimestamps) {
      if (e - i > this.NONCE_VALIDITY_DURATION) {
        t.push(s);
      }
    }
    t.forEach(e => {
      this.nonceCache.delete(e);
      this.nonceTimestamps.delete(e);
    });
  }
  checkRateLimit(e, t = null) {
    const s = t || this.rateLimits[e] || this.rateLimits.default;
    if (!this.rateLimitMap.has(e)) {
      this.rateLimitMap.set(e, []);
    }
    const i = this.rateLimitMap.get(e);
    const n = Date.now();
    const r = n - 1e3;
    const o = i.filter(e => e > r);
    o.push(n);
    if (o.length > s) {
      this._logSecurityEvent("rate_limit_exceeded", {
        eventType: e,
        limit: s
      });
      this.suspiciousActivityCount++;
      return false;
    }
    this.rateLimitMap.set(e, o);
    return true;
  }
  sanitizeData(e, t = 10) {
    if (t <= 0) {
      console.warn("Max sanitization depth exceeded");
      return null;
    }
    if (e === null || e === undefined) {
      return e;
    }
    if (typeof e === "string") {
      if (e.length > 5e4) {
        console.warn("String too long, truncating");
        return e.substring(0, 5e4);
      }
      return this._escapeHtml(e);
    }
    if (typeof e === "number" || typeof e === "boolean") {
      return e;
    }
    if (Array.isArray(e)) {
      return e.map((e, s) => {
        if (s > 1e3) {
          console.warn("Array too large, truncating");
          return null;
        }
        return this.sanitizeData(e, t - 1);
      });
    }
    if (typeof e === "object") {
      const s = {};
      const i = Object.keys(e);
      if (i.length > 100) {
        console.warn("Object has too many keys");
        return null;
      }
      for (const n of i) {
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$\-\.]*$/.test(n)) {
          console.warn(`⚠️ Invalid key name: ${n}`);
          continue;
        }
        s[n] = this.sanitizeData(e[n], t - 1);
      }
      return s;
    }
    return null;
  }
  async _encryptPayload(e) {
    if (!this.serverPublicKey) {
      console.warn("No server public key configured for encryption");
      return null;
    }
    try {
      const t = new TextEncoder;
      const s = t.encode(JSON.stringify(e));
      const i = await crypto.subtle.encrypt({
        name: "RSA-OAEP",
        hash: "SHA-256"
      }, this.serverPublicKey, s);
      return btoa(String.fromCharCode(...new Uint8Array(i)));
    } catch (e) {
      console.error("Encryption failed:", e);
      this._logSecurityEvent("encryption_error", {
        error: e.message
      });
      return null;
    }
  }
  _escapeHtml(e) {
    const t = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return e.replace(/[&<>"']/g, e => t[e]);
  }
  _containsSuspiciousContent(e) {
    const t = JSON.stringify(e).toLowerCase();
    if (/(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b|\bexec\b|\bexecute\b)/i.test(t)) {
      return true;
    }
    if (/(<script|javascript:|onerror=|onclick=|onload=|eval\(|function\()/i.test(t)) {
      return true;
    }
    if (/(setTimeout|setInterval|constructorFunction|__proto__|constructor)\s*(\(|=)/i.test(t)) {
      return true;
    }
    return false;
  }
  validateMessage(e, t) {
    if (!this.checkRateLimit(e)) {
      return false;
    }
    const s = JSON.stringify(t);
    if (s.length > this.MAX_MESSAGE_SIZE) {
      console.warn(`⚠️ Message too large: ${s.length} bytes (max: ${this.MAX_MESSAGE_SIZE})`);
      this.suspiciousActivityCount++;
      return false;
    }
    if (this._containsSuspiciousContent(t)) {
      console.warn("Suspicious content detected");
      this.suspiciousActivityCount++;
      return false;
    }
    return true;
  }
  validateIncomingMessage(e) {
    if (!this.validateIncomingMessages) {
      return true;
    }
    if (!e || typeof e !== "object") {
      return false;
    }
    const {type: t, timestamp: s, nonce: i, userId: n, sessionId: r} = e;
    if (!t || !s || !i) {
      console.warn("Incomplete message structure");
      return false;
    }
    const o = Math.abs(Date.now() - s);
    if (o > this.TIMESTAMP_VALIDITY_WINDOW) {
      console.warn("Message timestamp too old");
      this._logSecurityEvent("old_timestamp", {
        timeDiff: o
      });
      return false;
    }
    if (!this._validateNonce(i)) {
      console.warn("Invalid or replayed nonce");
      this._logSecurityEvent("nonce_validation_failed", {
        nonce: i
      });
      return false;
    }
    if (n && n !== this.userId) {
      console.warn("Message from unauthorized user");
      this._logSecurityEvent("unauthorized_user", {
        messageUserId: n
      });
      return false;
    }
    if (r && r !== this.sessionId) {
      console.warn("Message from different session");
      return false;
    }
    return true;
  }
  createSecureEnvelope(e, t) {
    const s = {
      type: e,
      payload: this.sanitizeData(t),
      timestamp: Date.now(),
      nonce: this._generateNonce(),
      userId: this.userId,
      sessionId: this.sessionId,
      version: "2.0",
      priority: t.priority || "normal"
    };
    return s;
  }
  _securityNote() {}
  isSuspiciousActivityDetected() {
    return this.suspiciousActivityCount >= this.suspiciousActivityThreshold;
  }
  resetSuspiciousActivityCounter() {
    this.suspiciousActivityCount = 0;
  }
  _logSecurityEvent(e, t) {
    const s = {
      timestamp: (new Date).toISOString(),
      eventType: e,
      userId: this.userId,
      sessionId: this.sessionId,
      details: t
    };
    this.securityLogs.push(s);
    if (this.securityLogs.length > this.maxSecurityLogs) {
      this.securityLogs.shift();
    }
  }
  getSecurityLogs(e = 50) {
    return this.securityLogs.slice(-e);
  }
  async flushLogsToServer() {
    if (this.securityLogs.length === 0) return;
    try {
      const e = this.securityLogs.slice();
      await fetch("/api/audit/logs", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this._getCsrfToken()
        },
        body: JSON.stringify({
          logs: e,
          sessionId: this.sessionId
        })
      });
      this.securityLogs = [];
    } catch (e) {
      console.error("Failed to flush logs to server:", e);
    }
  }
  startCleanupTask() {
    if (this.cleanupTask) clearInterval(this.cleanupTask);
    this.cleanupTask = setInterval(() => this._cleanupExpiredNonces(), this.CLEANUP_INTERVAL);
  }
  stopCleanupTask() {
    if (this.cleanupTask) {
      clearInterval(this.cleanupTask);
      this.cleanupTask = null;
    }
  }
  destroy() {
    this.stopCleanupTask();
    this.authToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.nonceCache.clear();
    this.nonceTimestamps.clear();
    this.rateLimitMap.clear();
    this.securityLogs = [];
    this.suspiciousActivityCount = 0;
  }
  getSecurityStatus() {
    return {
      isInitialized: !!this.userId,
      userId: this.userId,
      sessionId: this.sessionId,
      tokenValid: this.tokenExpiresAt > Date.now(),
      tokenExpiresAt: this.tokenExpiresAt,
      noncesCached: this.nonceCache.size,
      rateLimitingActive: this.rateLimitMap.size > 0,
      suspiciousActivityDetected: this.isSuspiciousActivityDetected(),
      suspiciousActivityCount: this.suspiciousActivityCount
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = WebSocketSecurityManager;
}

if (typeof window !== "undefined") {
  window.WebSocketSecurityManager = WebSocketSecurityManager;
}
