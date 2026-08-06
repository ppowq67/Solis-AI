window.apiRequestCache = {
  cache: new Map,
  CACHE_TTL_MS: 5e3,
  async dedupFetch(e, n = {}) {
    const t = n.method || "GET";
    const o = `${t}:${e}`;
    const a = Date.now();
    const i = this.cache.get(o);
    if (i && a - i.timestamp < this.CACHE_TTL_MS) {
      if (i.data) {
        return new Response(JSON.stringify(i.data), {
          status: 200,
          statusText: "OK (from cache)",
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      if (i.response) {
        return i.response.clone();
      }
    }
    const s = fetch(e, n);
    this.cache.set(o, {
      promise: s,
      timestamp: a,
      response: null,
      data: null
    });
    try {
      const e = await s;
      const a = this.cache.get(o);
      if (a) a.response = e.clone();
      if (e.ok && !n.method && t === "GET") {
        try {
          const n = await e.clone().json();
          const t = this.cache.get(o);
          if (t) t.data = n;
        } catch (e) {}
      }
      return e;
    } finally {
      const e = [];
      for (const [n, t] of this.cache.entries()) {
        if (a - t.timestamp > this.CACHE_TTL_MS * 2) {
          e.push(n);
        }
      }
      e.forEach(e => this.cache.delete(e));
    }
  }
};

window.getApiBase = function() {
  return window.API_BASE_URL || "https://api.solisai.video/api";
};

function escapeHtml(e) {
  if (typeof e !== "string") return "";
  const n = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;"
  };
  return e.replace(/[&<>"'\/]/g, e => n[e] || e);
}

function getCsrfToken() {
  const e = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
  if (!e || typeof e !== "string" || e.length < 10) {
    console.warn("CSRF token not found or invalid");
    return "";
  }
  return e.trim();
}

function validateUserId(e) {
  if (typeof e !== "string" || e.length === 0) return false;
  if (e.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(e);
}

function validateAuthUrl(e) {
  if (typeof e !== "string") return false;
  try {
    const n = new URL(e);
    return /^https?:$/.test(n.protocol);
  } catch {
    return false;
  }
}

function validateAuthResponse(e) {
  if (!e || typeof e !== "object") return {
    valid: false
  };
  if (e.error) {
    return {
      valid: false,
      error: typeof e.error === "string" ? e.error : "Unknown error"
    };
  }
  if (!e.auth_url || typeof e.auth_url !== "string") return {
    valid: false,
    error: "Invalid auth URL format"
  };
  if (!validateAuthUrl(e.auth_url)) return {
    valid: false,
    error: "Invalid auth URL protocol"
  };
  return {
    valid: true
  };
}

async function _signRequest(e, n = "POST", t = "") {
  try {
    const t = Math.floor(Date.now() / 1e3).toString();
    const o = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(e => e.toString(16).padStart(2, "0")).join("");
    const a = getCsrfToken();
    if (!a) return {
      timestamp: t,
      nonce: o
    };
    const i = new TextEncoder;
    const s = i.encode(a);
    const r = await crypto.subtle.importKey("raw", s, {
      name: "HMAC",
      hash: "SHA-256"
    }, false, [ "sign" ]);
    const l = i.encode(`${e}|${n}|${t}|${o}`);
    const c = await crypto.subtle.sign("HMAC", r, l);
    const d = Array.from(new Uint8Array(c)).map(e => e.toString(16).padStart(2, "0")).join("");
    return {
      timestamp: t,
      nonce: o,
      signature: d
    };
  } catch (e) {
    console.error("Request signing error:", e);
    return {};
  }
}

class SetupModal {
  constructor() {
    this.isConnecting = false;
    this.setupComplete = false;
    this.apiBase = window.getApiBase();
    this.userId = this.generateUserId();
    this.connections = {};
    this.initBanner();
    this.loadConnectionStatus();
  }
  async loadConnectionStatus() {
    try {
      const e = await fetch(`${this.apiBase}/analytics/status`, {
        method: "GET",
        credentials: "include"
      });
      const n = await e.json();
      this.connections = n;
      localStorage.setItem("platform_connections", JSON.stringify(n));
      window.platformConnections = n;
    } catch (e) {
      console.error("Error loading connection status:", e);
    }
  }
  initBanner() {
    const e = document.getElementById("setupBanner");
    if (e) {
      e.addEventListener("click", () => this.openModal());
      if (this.setupComplete) {}
    }
  }
  async initiateYouTubeAuth() {
    if (window.__ytOAuthInFlight) {
      this.showError("YouTube connection already in progress");
      return;
    }
    if (this.isConnecting) return;
    this.isConnecting = true;
    window.__ytOAuthInFlight = true;
    const e = document.getElementById("connectYouTubeBtn");
    if (e) {
      e.textContent = "Connecting...";
      e.disabled = true;
    }
    try {
      const n = this.generateUserId();
      if (!validateUserId(n)) {
        throw new Error("Invalid user ID format");
      }
      localStorage.setItem("youtube_user_id", n);
      const t = getCsrfToken();
      const o = await _signRequest("/analytics/youtube/auth", "POST", JSON.stringify({
        user_id: n
      }));
      const a = await fetch(`${this.apiBase}/analytics/youtube/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": t,
          "X-Request-Timestamp": o.timestamp || "",
          "X-Request-Nonce": o.nonce || "",
          "X-Request-Signature": o.signature || ""
        },
        body: JSON.stringify({
          user_id: n
        }),
        credentials: "include",
        signal: AbortSignal.timeout(3e4)
      });
      if (!a.ok) {
        throw new Error(`HTTP error! status: ${a.status}`);
      }
      const i = a.headers.get("content-length");
      if (i && parseInt(i) > 5e4) {
        throw new Error("Response too large");
      }
      const s = await a.text();
      if (!s || s.length === 0) {
        throw new Error("Empty response from server");
      }
      if (s.length > 5e4) {
        throw new Error("Response too large");
      }
      let r;
      try {
        r = JSON.parse(s);
      } catch (e) {
        throw new Error("Invalid JSON response");
      }
      const l = validateAuthResponse(r);
      if (!l.valid) {
        throw new Error(`Failed to initialize YouTube authentication: ${l.error || "No auth URL"}`);
      }
      if (r.auth_url && validateAuthUrl(r.auth_url)) {
        const e = window.open(r.auth_url, "YouTubeAuth", "width=600,height=700,left=100,top=100");
        this.waitForAuth(e);
      } else {
        this.showError("Failed to initialize YouTube authentication: invalid auth URL");
        this.isConnecting = false;
        window.__ytOAuthInFlight = false;
        if (e) {
          e.textContent = "Connect YouTube";
          e.disabled = false;
        }
      }
    } catch (n) {
      console.error("Auth error:", n);
      this.showError("Connection failed: " + n.message);
      this.isConnecting = false;
      window.__ytOAuthInFlight = false;
      if (e) {
        e.textContent = "Connect YouTube";
        e.disabled = false;
      }
    }
  }
  waitForAuth(e) {
    const n = setInterval(() => {
      if (e.closed) {
        clearInterval(n);
        window.__ytOAuthInFlight = false;
        setTimeout(() => {
          if (localStorage.getItem("youtube_connected") === "true") {
            this.onAuthSuccess();
          } else {
            this.isConnecting = false;
            window.__ytOAuthInFlight = false;
            const e = document.getElementById("connectYouTubeBtn");
            if (e) {
              e.textContent = "Connect YouTube";
              e.disabled = false;
            }
          }
        }, 500);
      }
    }, 500);
  }
  onAuthSuccess() {
    this.setupComplete = true;
    this.connections.youtube = {
      connected: true,
      name: "YouTube"
    };
    localStorage.setItem("platform_connections", JSON.stringify(this.connections));
    this.showSuccess("YouTube connected successfully!");
    const e = document.getElementById("setupBanner");
    if (e) {
      e.style.display = "none";
    }
    setTimeout(() => {
      const e = document.getElementById("setupModal");
      if (e) e.remove();
      if (window.analyticsManager) {
        window.analyticsManager.isConnected = true;
        window.analyticsManager.userId = localStorage.getItem("youtube_user_id");
        window.analyticsManager.fetchAnalyticsFromServer();
      }
    }, 2e3);
  }
  async unlinkPlatform(e) {
    if (e === "youtube") {
      try {
        if (!validateUserId(this.userId)) {
          throw new Error("Invalid user ID format");
        }
        const e = getCsrfToken();
        const n = await _signRequest("/analytics/disconnect", "POST", JSON.stringify({
          user_id: this.userId
        }));
        const t = await fetch(`${this.apiBase}/analytics/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": e,
            "X-Request-Timestamp": n.timestamp || "",
            "X-Request-Nonce": n.nonce || "",
            "X-Request-Signature": n.signature || ""
          },
          body: JSON.stringify({
            user_id: this.userId
          }),
          credentials: "include",
          signal: AbortSignal.timeout(3e4)
        });
        if (!t.ok && t.status !== 200 && t.status !== 204) {
          throw new Error(`Disconnect failed: ${t.status}`);
        }
        localStorage.removeItem("youtube_connected");
        localStorage.removeItem("youtube_token_time");
        localStorage.removeItem("youtube_token");
        this.setupComplete = false;
        this.connections.youtube = {
          connected: false,
          name: "YouTube"
        };
        if (typeof this.connections === "object") {
          localStorage.setItem("platform_connections", JSON.stringify(this.connections));
        }
        const o = document.getElementById("setupBanner");
        if (o) o.style.display = "block";
        if (window.analyticsManager) {
          window.analyticsManager.isConnected = false;
          window.analyticsManager.loadAnalyticsData();
        }
        this.showSuccess("YouTube disconnected");
        setTimeout(() => {
          const e = document.getElementById("setupModal");
          if (e) {
            e.remove();
            this.openModal();
          }
        }, 1500);
      } catch (e) {
        this.showError("Failed to disconnect: " + e.message);
      }
    }
  }
  openModal() {
    const e = document.getElementById("setupModal");
    if (e) e.remove();
    const n = document.createElement("div");
    n.id = "setupModal";
    n.style.cssText = `\n            position: fixed;\n            top: 0;\n            left: 0;\n            right: 0;\n            bottom: 0;\n            background: rgba(0,0,0,0.6);\n            backdrop-filter: blur(5px);\n            display: flex;\n            justify-content: center;\n            align-items: center;\n            z-index: 10000;\n            padding: 20px;\n        `;
    const t = this.connections.youtube?.connected;
    n.innerHTML = `\n  <style>\n    :root {\n      --modal-bg: #ffffff;\n      --modal-card-bg: #fff8f3;\n      --modal-text-primary: #1a1a1a;\n      --modal-text-secondary: #5a5a5a;\n      --modal-text-tertiary: #8a8a8a;\n      --modal-border: #f5e6d3;\n      --modal-accent: #ff7a56;\n      --modal-accent-hover: #ff6542;\n      --modal-shadow: 0 20px 60px rgba(255, 122, 86, 0.12);\n    }\n\n    :root.dark {\n      --modal-bg: #1a1a1a;\n      --modal-card-bg: #2d2520;\n      --modal-text-primary: #f5f5f5;\n      --modal-text-secondary: #c9c9c9;\n      --modal-text-tertiary: #8a8a8a;\n      --modal-border: #3d3530;\n      --modal-accent: #ff8c66;\n      --modal-accent-hover: #ff7a56;\n      --modal-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\n    }\n\n    @keyframes modalFadeIn {\n      from {\n        opacity: 0;\n        transform: scale(0.95) translateY(-10px);\n      }\n      to {\n        opacity: 1;\n        transform: scale(1) translateY(0);\n      }\n    }\n\n    @keyframes modalFadeOut {\n      from {\n        opacity: 1;\n        transform: scale(1) translateY(0);\n      }\n      to {\n        opacity: 0;\n        transform: scale(0.95) translateY(-10px);\n      }\n    }\n\n    @keyframes slideInUp {\n      from {\n        opacity: 0;\n        transform: translateY(10px);\n      }\n      to {\n        opacity: 1;\n        transform: translateY(0);\n      }\n    }\n\n    @keyframes checkmarkPop {\n      0% {\n        opacity: 0;\n        transform: scale(0.8);\n      }\n      50% {\n        transform: scale(1.1);\n      }\n      100% {\n        opacity: 1;\n        transform: scale(1);\n      }\n    }\n\n    .onboarding-container {\n      background: var(--modal-bg);\n      box-shadow: var(--modal-shadow);\n      border: 2px solid var(--modal-border);\n      overflow: hidden;\n      width: 100%;\n      max-width: 850px;\n      padding: 70px 80px;\n      position: relative;\n      max-height: 85vh;\n      overflow-y: auto;\n      animation: modalFadeIn 0.3s ease-out;\n    }\n\n    .onboarding-container.closing {\n      animation: modalFadeOut 0.3s ease-out forwards;\n    }\n\n    .modal-close-btn {\n      position: absolute;\n      top: 28px;\n      right: 28px;\n      background: none;\n      border: none;\n      font-size: 32px;\n      cursor: pointer;\n      color: var(--modal-text-tertiary);\n      width: 44px;\n      height: 44px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      transition: all 0.2s ease;\n    }\n\n    .modal-close-btn:hover {\n      background: var(--modal-card-bg);\n      color: var(--modal-text-primary);\n    }\n\n    .modal-header {\n      text-align: center;\n      margin-bottom: 50px;\n      animation: slideInUp 0.4s ease-out 0.1s both;\n    }\n\n    .modal-title {\n      font-size: 36px;\n      margin: 0 0 14px;\n      color: var(--modal-text-primary);\n      font-weight: 700;\n      letter-spacing: -0.02em;\n    }\n\n    .modal-subtitle {\n      color: var(--modal-text-secondary);\n      font-size: 16px;\n      margin: 0;\n      line-height: 1.6;\n    }\n\n    .modal-section {\n      background: var(--modal-card-bg);\n      padding: 32px;\n      margin-bottom: 28px;\n      border: 2px solid var(--modal-border);\n      animation: slideInUp 0.4s ease-out 0.2s both;\n      transition: all 0.2s ease;\n    }\n\n    .modal-section:hover {\n      border-color: var(--modal-accent);\n    }\n\n    .section-title {\n      margin: 0 0 20px;\n      color: var(--modal-text-primary);\n      font-size: 18px;\n      font-weight: 600;\n      letter-spacing: -0.01em;\n    }\n\n    .features-list {\n      list-style: none;\n      padding: 0;\n      margin: 0;\n    }\n\n    .feature-item {\n      margin-bottom: 16px;\n      color: var(--modal-text-secondary);\n      display: flex;\n      align-items: center;\n      font-size: 15px;\n      line-height: 1.7;\n      animation: slideInUp 0.4s ease-out both;\n    }\n\n    .feature-item:nth-child(1) { animation-delay: 0.3s; }\n    .feature-item:nth-child(2) { animation-delay: 0.35s; }\n    .feature-item:nth-child(3) { animation-delay: 0.4s; }\n    .feature-item:nth-child(4) { animation-delay: 0.45s; }\n\n    .feature-item:last-child {\n      margin-bottom: 0;\n    }\n\n    .checkmark {\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      min-width: 24px;\n      height: 24px;\n      background: var(--modal-accent);\n      margin-right: 14px;\n      color: white;\n      font-size: 12px;\n      font-weight: 700;\n      animation: checkmarkPop 0.4s ease-out both;\n    }\n\n    .feature-item:nth-child(1) .checkmark { animation-delay: 0.3s; }\n    .feature-item:nth-child(2) .checkmark { animation-delay: 0.35s; }\n    .feature-item:nth-child(3) .checkmark { animation-delay: 0.4s; }\n    .feature-item:nth-child(4) .checkmark { animation-delay: 0.45s; }\n\n    .connect-btn {\n      width: 100%;\n      padding: 18px 24px;\n      background: var(--modal-accent);\n      color: white;\n      border: none;\n      font-size: 16px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.2s ease;\n      margin-bottom: 16px;\n      animation: slideInUp 0.4s ease-out 0.5s both;\n      position: relative;\n      overflow: hidden;\n      letter-spacing: 0.01em;\n    }\n\n    .connect-btn::before {\n      content: '';\n      position: absolute;\n      top: 0;\n      left: -100%;\n      width: 100%;\n      height: 100%;\n      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);\n      transition: left 0.5s ease;\n    }\n\n    .connect-btn:hover::before {\n      left: 100%;\n    }\n\n    .connect-btn:hover {\n      background: var(--modal-accent-hover);\n      transform: translateY(-2px);\n      box-shadow: 0 6px 20px rgba(255, 122, 86, 0.3);\n    }\n\n    .connect-btn:active {\n      transform: translateY(0);\n    }\n\n    .security-note {\n      text-align: center;\n      color: var(--modal-text-tertiary);\n      font-size: 13px;\n      margin: 0;\n      animation: slideInUp 0.4s ease-out 0.55s both;\n      line-height: 1.5;\n    }\n\n    .setup-notification {\n      display: none;\n      margin-top: 24px;\n      padding: 18px;\n      font-size: 15px;\n      text-align: center;\n      animation: slideInUp 0.3s ease-out;\n    }\n  </style>\n\n  <div class="onboarding-container">\n    <button id="closeSetupModal" class="modal-close-btn">×</button>\n\n    <div class="modal-header">\n      <h2 class="modal-title">\n        ${t ? "Analytics Dashboard" : "Connect Your Channel"}\n      </h2>\n      <p class="modal-subtitle">\n        ${t ? "Manage and monitor all your platform connections" : "Link your YouTube account to access real-time analytics and performance insights"}\n      </p>\n    </div>\n\n    <div class="modal-section">\n      <h3 class="section-title">Connected Platforms</h3>\n      <div id="platformsList"></div>\n    </div>\n\n    ${!t ? `\n    <div class="modal-section">\n      <h3 class="section-title">Features You'll Unlock</h3>\n      <ul class="features-list">\n        <li class="feature-item">\n          <span class="checkmark">✓</span>\n          Live analytics streaming directly from your YouTube channel\n        </li>\n        <li class="feature-item">\n          <span class="checkmark">✓</span>\n          Comprehensive view tracking across daily, weekly, and monthly periods\n        </li>\n        <li class="feature-item">\n          <span class="checkmark">✓</span>\n          Detailed subscriber growth and revenue analytics\n        </li>\n        <li class="feature-item">\n          <span class="checkmark">✓</span>\n          Cross-platform performance comparison and insights\n        </li>\n      </ul>\n    </div>\n\n    <button id="connectYouTubeBtn" class="connect-btn">\n      Connect YouTube Channel\n    </button>\n\n    <p class="security-note">\n      Your data is protected with industry-standard OAuth 2.0 authentication. We never store your password.\n    </p>\n    ` : ""}\n\n    <div id="setupNotification" class="setup-notification"></div>\n  </div>\n`;
    document.body.appendChild(n);
    this.populatePlatformsList();
    document.getElementById("closeSetupModal").addEventListener("click", () => {
      const e = n.querySelector(".onboarding-container");
      if (e) e.classList.add("closing");
      setTimeout(() => n.remove(), 300);
    });
    if (!t) {
      document.getElementById("connectYouTubeBtn").addEventListener("click", () => {
        this.initiateYouTubeAuth();
      });
    }
    n.addEventListener("click", e => {
      if (e.target === n) {
        const e = n.querySelector(".onboarding-container");
        if (e) e.classList.add("closing");
        setTimeout(() => n.remove(), 300);
      }
    });
  }
  populatePlatformsList() {
    const e = document.getElementById("platformsList");
    if (!e) return;
    e.innerHTML = `\n            <div style="padding: 15px; border: 2px solid ${this.connections.youtube?.connected ? "#d4edda" : "#e9ecef"}; border-radius: 8px; background: ${this.connections.youtube?.connected ? "#f1f8f4" : "#f8f9fa"};">\n                <div style="display: flex; justify-content: space-between; align-items: center;">\n                    <div style="display: flex; align-items: center; gap: 12px;">\n                        <span class="platform-icon" style="display:inline-flex;align-items:center;width:36px;height:24px;">\n                          <svg width="24" height="24" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube" role="img" style="width:100%;height:100%;display:block;">\n                            <path d="M27.4313 3.11C27.1213 1.89 26.1313 0.91 24.9113 0.6C22.7313 0 14.0013 0 14.0013 0C14.0013 0 5.27128 0 3.09128 0.6C1.87128 0.91 0.881281 1.89 0.571281 3.11C0.261281 4.33 0.00128174 6.6 0.00128174 10C0.00128174 13.4 0.261281 15.67 0.571281 16.89C0.881281 18.11 1.87128 19.09 3.09128 19.4C5.27128 20 14.0013 20 14.0013 20C14.0013 20 22.7313 20 24.9113 19.4C26.1313 19.09 27.1213 18.11 27.4313 16.89C27.7413 15.67 28.0013 13.4 28.0013 10C28.0013 6.6 27.7413 4.33 27.4313 3.11Z" fill="#FF0000"></path>\n                            <path d="M11.2013 14.2V5.8L18.2013 10L11.2013 14.2Z" fill="white"></path>\n                          </svg>\n                        </span>\n                        <div>\n                            <div style="font-weight: 600; color: #333;">YouTube</div>\n                            <div style="font-size: 12px; color: #666;">${this.connections.youtube?.connected ? "✓ Connected" : "○ Not connected"}</div>\n                        </div>\n                    </div>\n                    ${this.connections.youtube?.connected ? `\n                    <button id="unlinkYouTube" style="\n                        padding: 8px 16px;\n                        background: #f8d7da;\n                        color: #721c24;\n                        border: 1px solid #f5c6cb;\n                        border-radius: 6px;\n                        cursor: pointer;\n                        font-size: 12px;\n                        font-weight: 600;\n                        transition: all 0.3s ease;\n                    ">\n                        Unlink\n                    </button>\n                    ` : ""}\n                </div>\n            </div>\n        `;
    if (this.connections.youtube?.connected) {
      document.getElementById("unlinkYouTube").addEventListener("click", () => {
        if (confirm("Are you sure you want to unlink YouTube?")) {
          this.unlinkPlatform("youtube");
        }
      });
    }
  }
  generateUserId() {
    let e = localStorage.getItem("youtube_user_id");
    if (!e) {
      e = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("youtube_user_id", e);
    }
    return e;
  }
  showSuccess(e) {
    const n = document.getElementById("setupNotification");
    if (n) {
      n.textContent = e;
      n.style.display = "block";
      n.style.background = "#d4edda";
      n.style.color = "#155724";
    }
  }
  showError(e) {
    const n = document.getElementById("setupNotification");
    if (n) {
      n.textContent = e;
      n.style.display = "block";
      n.style.background = "#f8d7da";
      n.style.color = "#721c24";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.setupModal = new SetupModal;
  setTimeout(() => {
    handleUpgradeCardVisibility();
  }, 500);
  setTimeout(() => {
    handleUpgradeCardVisibility();
  }, 1500);
});

if (document.readyState !== "loading") {
  if (!window.setupModal) {
    window.setupModal = new SetupModal;
  }
  setTimeout(() => {
    handleUpgradeCardVisibility();
  }, 500);
  setTimeout(() => {
    handleUpgradeCardVisibility();
  }, 1500);
}

window.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setTimeout(() => {
      handleUpgradeCardVisibility();
      const e = document.querySelector(".ci4");
      if (e) {
        e.style.display = "none";
        setTimeout(() => {
          e.style.display = "flex";
        }, 10);
      }
    }, 100);
  }
}, false);

window.addEventListener("focus", () => {
  setTimeout(() => {
    handleUpgradeCardVisibility();
  }, 100);
}, false);

function handleUpgradeCardVisibility() {
  let e = window.tier || localStorage.getItem("userTier") || localStorage.getItem("tier");
  if (!e) {
    try {
      const n = JSON.parse(localStorage.getItem("currentUser") || "{}");
      e = n.plan;
    } catch (e) {}
  }
  async function fetchAndManageUpgradeCards() {
    try {
      const e = await getOrFetchCurrentUser();
      if (!e || typeof e !== "object" || !e.plan) {
        throw new Error("Invalid response structure");
      }
      const n = [ "free", "prime", "elite", "basic" ];
      const t = typeof e.plan === "string" && n.includes(e.plan.toLowerCase()) ? e.plan.toLowerCase() : "free";
      const o = document.querySelector(".cuk");
      const a = document.querySelectorAll(".c1ia");
      const i = document.querySelector(".c1hm");
      if (t === "elite" || t === "prime") {
        if (i) {
          i.style.display = "none !important";
          i.style.visibility = "hidden";
          i.style.height = "0";
          i.style.overflow = "hidden";
          i.style.padding = "0";
          i.style.margin = "0";
          i.classList.add("hidden-permanently");
        }
        if (o) {
          o.style.display = "none";
          o.style.visibility = "hidden";
          o.style.height = "0";
          o.style.padding = "0";
          o.style.margin = "0";
          o.style.overflow = "hidden";
          o.style.pointerEvents = "none";
        }
        a.forEach((e, n) => {
          e.style.display = "none";
          e.style.visibility = "hidden";
          e.style.height = "0";
          e.style.overflow = "hidden";
        });
      } else if (t === "free" || t === "basic") {
        if (i) {
          i.classList.remove("hidden-permanently");
          i.style.visibility = "visible";
          i.style.height = "auto";
          i.style.overflow = "visible";
          i.style.padding = "20px";
          i.style.margin = "40px 0 0 0";
        }
        if (t === "basic" && o) {
          o.style.display = "flex";
          o.style.visibility = "visible";
          const e = o.querySelector(".c48");
          if (e && e.querySelector("h2")) {
            e.querySelector("h2").textContent = "Unlock Even More Power?";
            const n = e.querySelector(".card-subtitle") || document.createElement("p");
            if (!e.querySelector(".card-subtitle")) {
              n.className = "card-subtitle";
              n.style.cssText = "font-size: 14px; color: #666; margin-top: 8px; margin-bottom: 16px;";
              e.insertBefore(n, e.querySelector(".cd9"));
            }
            n.textContent = "Upgrade to Prime or Elite for unlimited access, advanced automation, and exclusive features.";
          }
        } else if (t === "free" && o) {
          o.style.display = "flex";
          o.style.visibility = "visible";
          const e = o.querySelector(".c48");
          if (e && e.querySelector("h2")) {
            e.querySelector("h2").textContent = "Reveal Your Earning Potential";
          }
        }
        a.forEach((e, n) => {
          e.style.display = "flex";
          e.style.visibility = "visible";
          e.style.height = "auto";
          e.style.overflow = "visible";
        });
      }
    } catch (e) {
      console.error("Error fetching user plan for card management:", e);
      const n = document.querySelectorAll(".c1ia");
      n.forEach(e => {
        e.style.display = "flex";
        e.style.visibility = "visible";
      });
    }
  }
  document.addEventListener("DOMContentLoaded", fetchAndManageUpgradeCards);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchAndManageUpgradeCards);
  } else {
    fetchAndManageUpgradeCards();
  }
}
