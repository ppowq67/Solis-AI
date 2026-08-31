class AnalyticsManager {
  constructor() {
    this.apiBase = window.API_BASE_URL || "https://api.solisai.video/api";
    this.usageChartInstance = null;
    this.platformChartInstance = null;
    this.securityConfig = {
      MAX_RESPONSE_SIZE: 10 * 1024 * 1024,
      MAX_ARRAY_LENGTH: 1e4,
      MAX_STRING_LENGTH: 5e3,
      REQUIRE_CSRF_TOKEN: true,
      CSRF_HEADER: "X-CSRF-Token",
      ENABLE_CONTENT_VALIDATION: true,
      SECURITY_LOG_ENABLED: true,
      MAX_LOG_ENTRIES: 100,
      REQUEST_TIMEOUT: 3e4,
      SAFE_DOMAINS: [ window.location.origin ],
      CHART_INSTANCE_LIMIT: 5,
      AUTO_REFRESH_INTERVAL: 3e5,
      ENABLE_SRI_VALIDATION: true,
      CHART_JS_INTEGRITY: "sha384-aZS6tFgzrDd/fMJyEZZLPDZZ0pOLxrVfvlIa8F3XvKU6aMhIvDlFBQ5JhMPSLRFf",
      SRI_ALGORITHMS: [ "sha256", "sha384", "sha512" ],
      ENABLE_REQUEST_SIGNING: true,
      SIGNATURE_ALGORITHM: "HMAC-SHA256",
      SIGNATURE_HEADER: "X-Request-Signature",
      TIMESTAMP_HEADER: "X-Request-Timestamp",
      NONCE_HEADER: "X-Request-Nonce",
      REQUEST_TTL: 3e5,
      REQUIRE_CRYPTO_API: true
    };
    this.analyticsData = {
      monetization: 0,
      subscribers: 0,
      views: 0,
      clipsCreated: 0,
      dailyViews: [],
      weeklyViews: [],
      monthlyViews: [],
      currentPeriod: "week",
      platformViews: {
        youtube: 0,
        tiktok: 0,
        all: 0
      },
      currentPlatform: "all"
    };
    this.previousMetrics = {
      views: 0,
      subscribers: 0
    };
    this.securityState = {
      csrfToken: this._getCSRFToken(),
      chartInstances: 0,
      securityLog: []
    };
    this.loadAnalyticsData();
    this.setupFilterButtons();
    this.observeClipsStudio();
    this.startAutoRefresh();
  }
  _getCSRFToken() {
    const t = document.querySelector('meta[name="csrf-token"]');
    return t ? t.getAttribute("content") : null;
  }
  _constantTimeCompare(t, e) {
    if (t.length !== e.length) return false;
    let i = 0;
    for (let s = 0; s < t.length; s++) {
      i |= t.charCodeAt(s) ^ e.charCodeAt(s);
    }
    return i === 0;
  }
  _sanitizeString(t, e = this.securityConfig.MAX_STRING_LENGTH) {
    if (typeof t !== "string") return "";
    let i = t.replace(/[\x00-\x1F\x7F]/g, "");
    const s = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    i = i.replace(/[&<>"']/g, t => s[t]);
    return i.slice(0, e);
  }
  _validateNumber(t, e = 0, i = Number.MAX_SAFE_INTEGER) {
    const s = Number(t);
    if (!Number.isFinite(s)) return 0;
    return Math.max(e, Math.min(i, s));
  }
  _validateArray(t, e = this.securityConfig.MAX_ARRAY_LENGTH) {
    if (!Array.isArray(t)) return [];
    return t.slice(0, e);
  }
  _validateResponseSize(t) {
    const e = t.headers.get("content-length");
    if (e && parseInt(e) > this.securityConfig.MAX_RESPONSE_SIZE) {
      this._logSecurityEvent("RESPONSE_SIZE_EXCEEDED", {
        size: e,
        max: this.securityConfig.MAX_RESPONSE_SIZE
      });
      return false;
    }
    return true;
  }
  _validateAnalyticsResponse(t) {
    if (!t || typeof t !== "object") {
      this._logSecurityEvent("INVALID_RESPONSE_TYPE", {
        received: typeof t
      });
      return null;
    }
    const e = {
      monetization: this._validateNumber(t.monetization, 0, 999999999),
      subscribers: this._validateNumber(t.subscribers, 0, 999999999),
      views: this._validateNumber(t.views, 0, 999999999),
      dailyViews: this._validateArray(t.dailyViews),
      weeklyViews: this._validateArray(t.weeklyViews),
      monthlyViews: this._validateArray(t.monthlyViews),
      platformViews: this._validatePlatformViews(t.platformViews),
      connected: typeof t.connected === "boolean" ? t.connected : false,
      connections: this._validateConnections(t.connections)
    };
    e.dailyViews = e.dailyViews.map(t => this._validateMetricItem(t));
    e.weeklyViews = e.weeklyViews.map(t => this._validateMetricItem(t));
    e.monthlyViews = e.monthlyViews.map(t => this._validateMetricItem(t));
    return e;
  }
  _validateMetricItem(t) {
    return {
      views: this._validateNumber(t.views, 0),
      revenue: this._validateNumber(t.revenue || t.estimatedRevenue, 0),
      estimatedRevenue: this._validateNumber(t.estimatedRevenue, 0),
      subscribers: this._validateNumber(t.subscribers, 0),
      day: this._sanitizeString(t.day || "", 50),
      week: this._sanitizeString(t.week || "", 50),
      month: this._sanitizeString(t.month || "", 50)
    };
  }
  _validatePlatformViews(t) {
    return {
      youtube: this._validateNumber((t || {}).youtube, 0),
      tiktok: this._validateNumber((t || {}).tiktok, 0),
      all: this._validateNumber((t || {}).all, 0)
    };
  }
  _validateConnections(t) {
    if (!t || typeof t !== "object") return {};
    return {
      youtube: t.youtube ? {
        connected: typeof t.youtube.connected === "boolean" ? t.youtube.connected : false,
        username: this._sanitizeString(t.youtube.username || "", 100)
      } : null
    };
  }
  _logSecurityEvent(t, e = {}) {
    if (!this.securityConfig.SECURITY_LOG_ENABLED) return;
    const i = {
      timestamp: (new Date).toISOString(),
      type: t,
      details: e,
      url: window.location.pathname
    };
    this.securityState.securityLog.push(i);
    if (this.securityState.securityLog.length > this.securityConfig.MAX_LOG_ENTRIES) {
      this.securityState.securityLog.shift();
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      if (t.includes("ERROR") || t.includes("FAILED") || t.includes("EXCEEDED")) {
        console.warn(`[Analytics Security] ${t}`, e);
      }
    }
  }
  _safeSetTextContent(t, e) {
    if (!t) return;
    try {
      t.textContent = this._sanitizeString(String(e));
    } catch (t) {
      this._logSecurityEvent("DOM_UPDATE_ERROR", {
        error: t.message
      });
    }
  }
  _validateSRI(t, e) {
    if (!this.securityConfig.ENABLE_SRI_VALIDATION) return true;
    try {
      const i = document.querySelectorAll("script[src]");
      let s = null;
      for (const e of i) {
        if (e.src === t) {
          s = e;
          break;
        }
      }
      if (!s) {
        this._logSecurityEvent("SRI_SCRIPT_NOT_FOUND", {
          url: t
        });
        return false;
      }
      const a = s.getAttribute("integrity");
      if (!a && e) {
        this._logSecurityEvent("SRI_MISSING_INTEGRITY", {
          url: t
        });
        return false;
      }
      const r = this.securityConfig.SRI_ALGORITHMS.some(t => a.startsWith(t + "-"));
      if (!r) {
        this._logSecurityEvent("SRI_INVALID_ALGORITHM", {
          url: t,
          integrity: a
        });
        return false;
      }
      this._logSecurityEvent("SRI_VALIDATION_SUCCESS", {
        url: t
      });
      return true;
    } catch (t) {
      this._logSecurityEvent("SRI_VALIDATION_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
      return false;
    }
  }
  _generateNonce() {
    const t = new Uint8Array(16);
    crypto.getRandomValues(t);
    return Array.from(t, t => t.toString(16).padStart(2, "0")).join("");
  }
  async _signRequest(t, e, i = null) {
    if (!this.securityConfig.ENABLE_REQUEST_SIGNING) {
      return {
        signature: null,
        timestamp: Date.now(),
        nonce: this._generateNonce()
      };
    }
    try {
      if (!window.crypto || !window.crypto.subtle) {
        this._logSecurityEvent("CRYPTO_API_UNAVAILABLE", {});
        if (this.securityConfig.REQUIRE_CRYPTO_API) return null;
        return {
          signature: null,
          timestamp: Date.now(),
          nonce: this._generateNonce()
        };
      }
      const s = Date.now().toString();
      const a = this._generateNonce();
      const r = await this._hashData(i || "");
      const n = `${t}|${e}|${s}|${a}|${r}`;
      const o = await this._getDerivedKey();
      const c = new TextEncoder;
      const l = c.encode(n);
      const u = await window.crypto.subtle.sign("HMAC", o, l);
      const d = Array.from(new Uint8Array(u)).map(t => t.toString(16).padStart(2, "0")).join("");
      this._logSecurityEvent("REQUEST_SIGNED_SUCCESS", {
        endpoint: e,
        timestamp: s
      });
      return {
        signature: d,
        timestamp: s,
        nonce: a
      };
    } catch (t) {
      this._logSecurityEvent("REQUEST_SIGNING_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
      return null;
    }
  }
  async _hashData(t) {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        return "no-hash";
      }
      const e = new TextEncoder;
      const i = e.encode(String(t));
      const s = await window.crypto.subtle.digest("SHA-256", i);
      const a = Array.from(new Uint8Array(s));
      return a.map(t => t.toString(16).padStart(2, "0")).join("");
    } catch (t) {
      this._logSecurityEvent("HASH_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
      return "hash-error";
    }
  }
  async _getDerivedKey() {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API not available");
      }
      const t = this.securityState.csrfToken || "fallback-key";
      const e = new TextEncoder;
      const i = await window.crypto.subtle.importKey("raw", e.encode(t), {
        name: "HMAC",
        hash: "SHA-256"
      }, false, [ "sign", "verify" ]);
      return i;
    } catch (t) {
      this._logSecurityEvent("KEY_DERIVATION_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
      return null;
    }
  }
  observeClipsStudio() {
    setInterval(() => {
      if (window.clipsStudio && Array.isArray(window.clipsStudio.libraryItems)) {
        const t = this._validateNumber(window.clipsStudio.libraryItems.length, 0, 999999);
        if (t !== this.analyticsData.clipsCreated) {
          this.analyticsData.clipsCreated = t;
          this.updateDashboard();
        }
      }
    }, 5e3);
  }
  setupFilterButtons() {
    document.querySelectorAll(".period-btn").forEach(t => {
      t.addEventListener("click", () => {
        const e = t.dataset.period;
        this.setTimePeriod(e);
      });
    });
    document.querySelectorAll(".platform-btn").forEach(t => {
      t.addEventListener("click", () => {
        const e = t.dataset.platform;
        this.setPlatformFilter(e);
      });
    });
  }
  setTimePeriod(t) {
    this.analyticsData.currentPeriod = t;
    document.querySelectorAll(".period-btn").forEach(e => {
      e.classList.remove("active");
      if (e.dataset.period === t) {
        e.classList.add("active");
      }
    });
    this.updateDashboard();
  }
  setPlatformFilter(t) {
    this.analyticsData.currentPlatform = t;
    document.querySelectorAll(".platform-btn").forEach(e => {
      e.classList.remove("active");
      if (e.dataset.platform === t) {
        e.classList.add("active");
      }
    });
    this.updateCharts();
  }
  startAutoRefresh() {
    setInterval(() => {
      if (this.isConnected) {
        this.fetchAnalyticsFromServer().catch(t => {
          this._logSecurityEvent("AUTO_REFRESH_ERROR", {
            error: t instanceof Error ? t.message : "Unknown error"
          });
        });
      }
    }, this.securityConfig.AUTO_REFRESH_INTERVAL);
  }
  animateNumber(t, e, i = 1e3, s = "", a = "") {
    if (!t) return;
    try {
      const r = 0;
      const n = Date.now();
      const updateValue = () => {
        const o = Date.now() - n;
        const c = Math.min(o / i, 1);
        const easeOutQuad = t => 1 - (1 - t) * (1 - t);
        const l = easeOutQuad(c);
        const u = Math.floor(r + (e - r) * l);
        const d = s + this.formatNumber(u) + a;
        this._safeSetTextContent(t, d);
        if (c < 1) {
          requestAnimationFrame(updateValue);
        } else {
          const i = s + this.formatNumber(e) + a;
          this._safeSetTextContent(t, i);
        }
      };
      requestAnimationFrame(updateValue);
    } catch (i) {
      this._logSecurityEvent("ANIMATION_ERROR", {
        error: i instanceof Error ? i.message : "Unknown error"
      });
      const r = s + this.formatNumber(e) + a;
      this._safeSetTextContent(t, r);
    }
  }
  async fetchAnalyticsFromServer() {
    try {
      const t = {
        "Content-Type": "application/json"
      };
      if (this.securityState.csrfToken && this.securityConfig.REQUIRE_CSRF_TOKEN) {
        t[this.securityConfig.CSRF_HEADER] = this.securityState.csrfToken;
      }
      const e = `${this.apiBase}/analytics/dashboard`;
      if (this.securityConfig.ENABLE_REQUEST_SIGNING) {
        const i = await this._signRequest("GET", e);
        if (i) {
          if (i.signature) {
            t[this.securityConfig.SIGNATURE_HEADER] = i.signature;
          }
          t[this.securityConfig.TIMESTAMP_HEADER] = i.timestamp;
          t[this.securityConfig.NONCE_HEADER] = i.nonce;
        }
      }
      const i = new AbortController;
      const s = setTimeout(() => i.abort(), this.securityConfig.REQUEST_TIMEOUT);
      const a = await fetch(e, {
        method: "GET",
        headers: t,
        credentials: "include",
        signal: i.signal
      });
      clearTimeout(s);
      if (!this._validateResponseSize(a)) {
        this.isConnected = false;
        this.updateDashboard();
        return;
      }
      if (!a.ok) {
        this._logSecurityEvent("ANALYTICS_FETCH_FAILED", {
          status: a.status,
          statusText: a.statusText
        });
        this.isConnected = false;
        this.updateDashboard();
        return;
      }
      const r = await a.json();
      const n = this._validateAnalyticsResponse(r);
      if (!n) {
        this._logSecurityEvent("RESPONSE_VALIDATION_FAILED", {});
        this.isConnected = false;
        this.updateDashboard();
        return;
      }
      const o = n.connected || n.connections?.youtube?.connected === true;
      if (o || n.dailyViews?.length > 0) {
        this.isConnected = true;
        this.analyticsData.monetization = n.monetization;
        this.analyticsData.subscribers = n.subscribers;
        this.analyticsData.views = n.views;
        this.analyticsData.dailyViews = n.dailyViews;
        this.analyticsData.weeklyViews = n.weeklyViews;
        this.analyticsData.monthlyViews = n.monthlyViews;
        this.analyticsData.platformViews = n.platformViews;
        if (n.connections) {
          Object.defineProperty(window, "platformConnections", {
            value: Object.freeze(n.connections),
            writable: false,
            configurable: false
          });
        }
        this._logSecurityEvent("ANALYTICS_FETCH_SUCCESS", {});
        this.updateDashboard();
      } else {
        this.isConnected = false;
        this.updateDashboard();
      }
    } catch (t) {
      if (t.name === "AbortError") {
        this._logSecurityEvent("REQUEST_TIMEOUT", {});
      } else {
        this._logSecurityEvent("ANALYTICS_FETCH_ERROR", {
          error: t instanceof Error ? t.message : "Unknown error"
        });
      }
      this.isConnected = false;
      this.updateDashboard();
    }
  }
  async loadAnalyticsData() {
    try {
      const t = {
        "Content-Type": "application/json"
      };
      if (this.securityState.csrfToken && this.securityConfig.REQUIRE_CSRF_TOKEN) {
        t[this.securityConfig.CSRF_HEADER] = this.securityState.csrfToken;
      }
      const e = `${this.apiBase}/analytics/dashboard`;
      if (this.securityConfig.ENABLE_REQUEST_SIGNING) {
        const i = await this._signRequest("GET", e);
        if (i) {
          if (i.signature) {
            t[this.securityConfig.SIGNATURE_HEADER] = i.signature;
          }
          t[this.securityConfig.TIMESTAMP_HEADER] = i.timestamp;
          t[this.securityConfig.NONCE_HEADER] = i.nonce;
        }
      }
      const i = new AbortController;
      const s = setTimeout(() => i.abort(), this.securityConfig.REQUEST_TIMEOUT);
      try {
        const a = await fetch(e, {
          method: "GET",
          headers: t,
          credentials: "include",
          signal: i.signal
        });
        clearTimeout(s);
        if (a.ok) {
          if (!this._validateResponseSize(a)) {
            this.isConnected = false;
            this.updateDashboard();
            return;
          }
          const t = await a.json();
          const e = this._validateAnalyticsResponse(t);
          if (!e) {
            this._logSecurityEvent("INITIAL_LOAD_VALIDATION_FAILED", {});
            this.isConnected = false;
            this.updateDashboard();
            return;
          }
          const i = e.connected || e.connections?.youtube?.connected === true;
          this.isConnected = i;
          if (e) {
            this.analyticsData.monetization = e.monetization;
            this.analyticsData.subscribers = e.subscribers;
            this.analyticsData.views = e.views;
            this.analyticsData.dailyViews = e.dailyViews;
            this.analyticsData.weeklyViews = e.weeklyViews;
            this.analyticsData.monthlyViews = e.monthlyViews;
            this.analyticsData.platformViews = e.platformViews;
          }
          this._logSecurityEvent("INITIAL_LOAD_SUCCESS", {});
          this.updateDashboard();
        } else if (a.status === 401) {
          this._logSecurityEvent("UNAUTHORIZED_ACCESS", {
            status: 401
          });
          this.isConnected = false;
          this.updateDashboard();
        } else {
          this._logSecurityEvent("DASHBOARD_LOAD_ERROR", {
            status: a.status,
            statusText: a.statusText
          });
          this.isConnected = false;
          this.updateDashboard();
        }
      } catch (t) {
        if (t.name === "AbortError") {
          this._logSecurityEvent("INITIAL_LOAD_TIMEOUT", {});
        } else {
          this._logSecurityEvent("INITIAL_LOAD_ERROR", {
            error: t instanceof Error ? t.message : "Unknown error"
          });
        }
        this.isConnected = false;
        this.updateDashboard();
      }
    } catch (t) {
      this._logSecurityEvent("LOAD_ANALYTICS_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
      this.isConnected = false;
      this.updateDashboard();
    }
    setTimeout(() => {
      this.updateCharts();
    }, 100);
  }
  updateDashboard() {
    if (!this.isConnected) {
      const t = document.querySelector('[data-card="monetization"] .card-value');
      if (t) this._safeSetTextContent(t, "€0");
      const e = document.querySelector('[data-card="subscribers"] .card-value');
      if (e) this._safeSetTextContent(e, "0");
      const i = document.querySelector('[data-card="views"] .card-value');
      if (i) this._safeSetTextContent(i, "0");
      document.querySelectorAll(".card-trend span").forEach(t => {
        this._safeSetTextContent(t, "0%");
        t.parentElement.className = "card-trend trend-neutral";
        const e = t.parentElement.querySelector("i");
        if (e) e.className = "fas fa-minus";
      });
      const s = document.querySelector('[data-card="clips"] .card-value');
      if (s) {
        const t = window.clipsStudio?.libraryItems?.length || 0;
        this._safeSetTextContent(s, this._validateNumber(t, 0));
      }
      return;
    }
    const t = document.querySelector('[data-card="monetization"] .card-value');
    if (t) {
      this.animateNumber(t, this.analyticsData.monetization, 800, "€", "");
    }
    const e = document.querySelector('[data-card="subscribers"] .card-value');
    if (e) {
      this.animateNumber(e, this.analyticsData.subscribers, 800, "", "");
    }
    const i = document.querySelector('[data-card="views"] .card-value');
    if (i) {
      this.animateNumber(i, this.analyticsData.views, 800, "", "");
    }
    const s = document.querySelector('[data-card="clips"] .card-value');
    if (s) {
      const t = window.clipsStudio?.libraryItems?.length || this.analyticsData.clipsCreated || 0;
      this._safeSetTextContent(s, this._validateNumber(t, 0));
    }
    this.updateTrends();
    this.updateCharts();
  }
  updateTrends() {
    if (!this.isConnected) {
      document.querySelectorAll(".card-trend").forEach(t => {
        t.className = "card-trend trend-neutral";
        const e = t.querySelector("span");
        if (e) e.textContent = "0%";
        const i = t.querySelector("i");
        if (i) i.className = "fas fa-minus";
      });
      return;
    }
    let t = [];
    if (this.analyticsData.currentPeriod === "day" && this.analyticsData.dailyViews?.length >= 2) {
      t = this.analyticsData.dailyViews;
    } else if (this.analyticsData.currentPeriod === "week" && this.analyticsData.weeklyViews?.length >= 2) {
      t = this.analyticsData.weeklyViews;
    } else if (this.analyticsData.currentPeriod === "month" && this.analyticsData.monthlyViews?.length >= 2) {
      t = this.analyticsData.monthlyViews;
    } else {
      t = this.analyticsData.weeklyViews;
    }
    const e = {
      monetization: this.calculateTrend(t, "revenue"),
      subscribers: this.calculateTrend(t, "subscribers"),
      views: this.calculateTrend(t, "views"),
      clips: 0
    };
    const i = {
      monetization: e.monetization,
      subscribers: e.subscribers,
      views: e.views,
      clips: e.clips
    };
    for (const [t, e] of Object.entries(i)) {
      const i = document.querySelector(`[data-card="${t}"]`);
      if (i) {
        const t = i.querySelector(".card-trend");
        if (t) {
          const i = t.querySelector("span");
          const s = Math.abs(e);
          if (i) i.textContent = `${s}%`;
          const a = t.querySelector("i");
          if (e > 0) {
            t.className = "card-trend trend-up";
            if (a) a.className = "fas fa-arrow-up";
          } else if (e < 0) {
            t.className = "card-trend trend-down";
            if (a) a.className = "fas fa-arrow-down";
          } else {
            t.className = "card-trend trend-neutral";
            if (a) a.className = "fas fa-minus";
          }
        }
      }
    }
  }
  calculateTrend(t, e) {
    if (!Array.isArray(t) || t.length < 2) return 0;
    const i = t[t.length - 1] || {};
    const s = t[t.length - 2] || {};
    let a = 0;
    let r = 0;
    if (e === "revenue") {
      a = this._validateNumber(i.revenue || i.estimatedRevenue || 0, 0);
      r = this._validateNumber(s.revenue || s.estimatedRevenue || 0, 0);
    } else if (e === "subscribers") {
      a = this._validateNumber(i.subscribers || 0, 0);
      r = this._validateNumber(s.subscribers || 0, 0);
    } else if (e === "views") {
      a = this._validateNumber(i.views || 0, 0);
      r = this._validateNumber(s.views || 0, 0);
    }
    if (r === 0 && a === 0) return 0;
    if (r === 0) return 100;
    return Math.round((a - r) / r * 100);
  }
  updateCharts() {
    this.drawUsageChart();
    this.drawPlatformChart();
  }
  drawUsageChart() {
    const t = document.getElementById("usageChart");
    if (!t) return;
    if (typeof Chart === "undefined") {
      this._logSecurityEvent("CHART_LIB_UNAVAILABLE", {});
      setTimeout(() => this.drawUsageChart(), 100);
      return;
    }
    if (this.securityConfig.ENABLE_SRI_VALIDATION) {
      const t = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      if (!this._validateSRI(t, this.securityConfig.CHART_JS_INTEGRITY)) {
        this._logSecurityEvent("CHART_INTEGRITY_CHECK_FAILED", {
          library: "Chart.js"
        });
      }
    }
    if (this.usageChartInstance) {
      this.usageChartInstance.destroy();
      this.securityState.chartInstances--;
    }
    if (this.securityState.chartInstances >= this.securityConfig.CHART_INSTANCE_LIMIT) {
      this._logSecurityEvent("CHART_INSTANCE_LIMIT_EXCEEDED", {
        limit: this.securityConfig.CHART_INSTANCE_LIMIT
      });
      return;
    }
    let e = [];
    let i = [];
    if (this.analyticsData.currentPeriod === "day" && this.analyticsData.dailyViews?.length) {
      e = this.analyticsData.dailyViews.map(t => this._validateNumber(t.views, 0));
      i = this.analyticsData.dailyViews.map(t => this._sanitizeString(t.day || "-", 50));
    } else if (this.analyticsData.currentPeriod === "month" && this.analyticsData.monthlyViews?.length) {
      e = this.analyticsData.monthlyViews.map(t => this._validateNumber(t.views, 0));
      i = this.analyticsData.monthlyViews.map(t => this._sanitizeString(t.month || "-", 50));
    } else {
      e = (this.analyticsData.weeklyViews || []).map(t => this._validateNumber(t.views, 0));
      i = (this.analyticsData.weeklyViews || []).map(t => this._sanitizeString(t.week || "-", 50));
    }
    if (!e.length) {
      e = [ 0, 0, 0, 0, 0, 0, 0 ];
      i = [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" ];
    }
    const s = t.getContext("2d");
    const a = s.createLinearGradient(0, 0, 0, 300);
    a.addColorStop(0, "rgba(255, 107, 53, 0.3)");
    a.addColorStop(1, "rgba(255, 107, 53, 0.01)");
    try {
      this.usageChartInstance = new Chart(s, {
        type: "line",
        data: {
          labels: i,
          datasets: [ {
            label: "Views",
            data: e,
            backgroundColor: a,
            borderColor: "#ff6b35",
            borderWidth: 2,
            tension: .4,
            fill: true,
            pointBackgroundColor: "#ff6b35",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          } ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 12,
                  weight: "600"
                },
                color: "#666",
                padding: 15,
                usePointStyle: true,
                pointStyle: "circle"
              }
            },
            tooltip: {
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              padding: 12,
              titleFont: {
                family: "Poppins, sans-serif",
                size: 13,
                weight: "bold"
              },
              bodyFont: {
                family: "Poppins, sans-serif",
                size: 12
              },
              borderColor: "#ff6b35",
              borderWidth: 1,
              displayColors: true,
              callbacks: {
                label: function(t) {
                  const e = t.parsed.y;
                  return `Views: ${e.toLocaleString()}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(200, 200, 200, 0.1)",
                drawBorder: false
              },
              ticks: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 11
                },
                color: "#999",
                callback: function(t) {
                  if (t >= 1e6) return (t / 1e6).toFixed(1) + "M";
                  if (t >= 1e3) return (t / 1e3).toFixed(1) + "K";
                  return t;
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 11
                },
                color: "#999"
              }
            }
          }
        }
      });
      this.securityState.chartInstances++;
    } catch (t) {
      this._logSecurityEvent("CHART_RENDERING_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
    }
  }
  drawPlatformChart() {
    const t = document.getElementById("platformChart");
    if (!t) return;
    if (typeof Chart === "undefined") {
      this._logSecurityEvent("CHART_LIB_UNAVAILABLE", {});
      setTimeout(() => this.drawPlatformChart(), 100);
      return;
    }
    if (this.securityConfig.ENABLE_SRI_VALIDATION) {
      const t = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      if (!this._validateSRI(t, this.securityConfig.CHART_JS_INTEGRITY)) {
        this._logSecurityEvent("CHART_INTEGRITY_CHECK_FAILED", {
          library: "Chart.js"
        });
      }
    }
    if (this.platformChartInstance) {
      this.platformChartInstance.destroy();
      this.securityState.chartInstances--;
    }
    if (this.securityState.chartInstances >= this.securityConfig.CHART_INSTANCE_LIMIT) {
      this._logSecurityEvent("CHART_INSTANCE_LIMIT_EXCEEDED", {
        limit: this.securityConfig.CHART_INSTANCE_LIMIT
      });
      return;
    }
    let e = [];
    let i = [];
    let s = [];
    if (this.analyticsData.currentPeriod === "day" && this.analyticsData.dailyViews?.length) {
      i = this.analyticsData.dailyViews.map(t => this._validateNumber(t.views, 0));
      e = this.analyticsData.dailyViews.map(t => this._sanitizeString(t.day || "-", 50));
      s = [];
    } else if (this.analyticsData.currentPeriod === "month" && this.analyticsData.monthlyViews?.length) {
      i = this.analyticsData.monthlyViews.map(t => this._validateNumber(t.views, 0));
      e = this.analyticsData.monthlyViews.map(t => this._sanitizeString(t.month || "-", 50));
      s = [];
    } else if (this.analyticsData.weeklyViews?.length) {
      i = this.analyticsData.weeklyViews.map(t => this._validateNumber(t.views, 0));
      e = this.analyticsData.weeklyViews.map(t => this._sanitizeString(t.week || "-", 50));
      s = [];
    } else {
      i = [ 0, 0, 0, 0 ];
      e = [ "Week 1", "Week 2", "Week 3", "Week 4" ];
      s = [ 0, 0, 0, 0 ];
    }
    const a = t.getContext("2d");
    const r = a.createLinearGradient(0, 0, 0, 300);
    r.addColorStop(0, "rgba(255, 107, 53, 0.3)");
    r.addColorStop(1, "rgba(255, 107, 53, 0.01)");
    const n = a.createLinearGradient(0, 0, 0, 300);
    n.addColorStop(0, "rgba(79, 70, 229, 0.3)");
    n.addColorStop(1, "rgba(79, 70, 229, 0.01)");
    try {
      this.platformChartInstance = new Chart(a, {
        type: "line",
        data: {
          labels: e,
          datasets: [ {
            label: "YouTube Views",
            data: i,
            backgroundColor: r,
            borderColor: "#ff6b35",
            borderWidth: 2,
            tension: .4,
            fill: true,
            pointBackgroundColor: "#ff6b35",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }, {
            label: "TikTok Views",
            data: s,
            backgroundColor: n,
            borderColor: "#4f46e5",
            borderWidth: 2,
            tension: .4,
            fill: true,
            pointBackgroundColor: "#4f46e5",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          } ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 12,
                  weight: "600"
                },
                color: "#666",
                padding: 15,
                usePointStyle: true,
                pointStyle: "circle"
              }
            },
            tooltip: {
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              padding: 12,
              titleFont: {
                family: "Poppins, sans-serif",
                size: 13,
                weight: "bold"
              },
              bodyFont: {
                family: "Poppins, sans-serif",
                size: 12
              },
              borderColor: "#ff6b35",
              borderWidth: 1
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(0, 0, 0, 0.05)"
              },
              ticks: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 11
                },
                color: "#999",
                callback: function(t) {
                  if (t >= 1e6) return (t / 1e6).toFixed(1) + "M";
                  if (t >= 1e3) return (t / 1e3).toFixed(1) + "K";
                  return t;
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  family: "Poppins, sans-serif",
                  size: 11
                },
                color: "#999"
              }
            }
          }
        }
      });
      this.securityState.chartInstances++;
    } catch (t) {
      this._logSecurityEvent("CHART_RENDERING_ERROR", {
        error: t instanceof Error ? t.message : "Unknown error"
      });
    }
  }
  formatNumber(t) {
    if (t >= 1e6) {
      return (t / 1e6).toFixed(1) + "M";
    } else if (t >= 1e3) {
      return (t / 1e3).toFixed(1) + "K";
    }
    return t.toString();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.analyticsManager = new AnalyticsManager;
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.analyticsManager) {
      window.analyticsManager = new AnalyticsManager;
    }
  });
} else {
  if (!window.analyticsManager) {
    window.analyticsManager = new AnalyticsManager;
  }
}
