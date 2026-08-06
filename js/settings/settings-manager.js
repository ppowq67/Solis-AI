function escapeHtml(t) {
  if (typeof t !== "string") return "";
  const e = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;"
  };
  return t.replace(/[&<>"'\/]/g, t => e[t] || t);
}

function getCsrfToken() {
  const t = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
  if (!t || typeof t !== "string" || t.length < 10) return "";
  return t.trim();
}

function validatePlatformName(t) {
  if (typeof t !== "string") return false;
  if (t.length === 0 || t.length > 50) return false;
  return /^[a-zA-Z0-9_-]{1,50}$/.test(t);
}

function validateUserId(t) {
  if (typeof t !== "string") return false;
  if (t.length === 0 || t.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(t);
}

async function _signRequest(t, e = "POST", n = "") {
  try {
    const n = Math.floor(Date.now() / 1e3).toString();
    const o = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(t => t.toString(16).padStart(2, "0")).join("");
    const s = getCsrfToken();
    if (!s) return {
      timestamp: n,
      nonce: o
    };
    const i = new TextEncoder;
    const a = i.encode(s);
    const r = await crypto.subtle.importKey("raw", a, {
      name: "HMAC",
      hash: "SHA-256"
    }, false, [ "sign" ]);
    const c = i.encode(`${t}|${e}|${n}|${o}`);
    const l = await crypto.subtle.sign("HMAC", r, c);
    const d = Array.from(new Uint8Array(l)).map(t => t.toString(16).padStart(2, "0")).join("");
    return {
      timestamp: n,
      nonce: o,
      signature: d
    };
  } catch (t) {
    console.error("Request signing error:", t);
    return {};
  }
}

function safeSetHTML(t, e) {
  if (!t) return;
  if (typeof e === "string" && e.length < 5e4) {
    t.innerHTML = e;
  }
}

class SettingsManager {
  constructor() {
    this.apiBase = window.API_BASE_URL || "https://api.solisai.video/api";
    this.userId = localStorage.getItem("youtube_user_id") || this.generateUserId();
    this.connections = JSON.parse(localStorage.getItem("platform_connections") || "{}");
    this.init();
  }
  init() {
    window.addEventListener("storage", t => {
      if (t.key === "platform_connections") {
        this.connections = JSON.parse(t.newValue || "{}");
        this.updateConnectionsDisplay();
      }
    });
    this.updateConnectionsDisplay();
    const t = document.getElementById("manageConnectionsBtn");
    if (t) {
      t.addEventListener("click", () => {
        if (window.setupModal) {
          window.setupModal.openModal();
        }
      });
    }
  }
  updateConnectionsDisplay() {
    const t = document.getElementById("platformConnectionsContainer");
    const e = t?.parentElement.querySelector("div:last-child");
    const n = Object.values(this.connections).some(t => t.connected);
    if (t && e) {
      if (n) {
        t.style.display = "block";
        e.style.display = "none";
        this.populatePlatformsList();
      } else {
        t.style.display = "none";
        e.style.display = "block";
      }
    }
  }
  populatePlatformsList() {
    const t = document.getElementById("platformsList");
    if (!t) return;
    while (t.firstChild) {
      t.removeChild(t.firstChild);
    }
    const e = [ {
      key: "youtube",
      name: "YouTube"
    } ];
    e.forEach(e => {
      if (!validatePlatformName(e.key) || !validatePlatformName(e.name)) {
        return;
      }
      const n = this.connections[e.key];
      const o = n?.connected === true;
      const s = document.createElement("div");
      s.style.cssText = `padding: 15px; border: 2px solid ${o ? "#d4edda" : "#e9ecef"}; border-radius: 8px; background: ${o ? "#f1f8f4" : "#f8f9fa"}; margin-bottom: 10px;`;
      const i = document.createElement("div");
      i.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
      const a = document.createElement("div");
      a.style.cssText = "display: flex; align-items: center; gap: 12px;";
      const r = document.createElement("span");
      r.style.cssText = "font-size: 20px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;";
      r.innerHTML = '<svg width="24" height="24" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.4313 3.11C27.1213 1.89 26.1313 0.91 24.9113 0.6C22.7313 0 14.0013 0 14.0013 0C14.0013 0 5.27128 0 3.09128 0.6C1.87128 0.91 0.881281 1.89 0.571281 3.11C0.261281 4.33 0.00128174 6.6 0.00128174 10C0.00128174 13.4 0.261281 15.67 0.571281 16.89C0.881281 18.11 1.87128 19.09 3.09128 19.4C5.27128 20 14.0013 20 14.0013 20C14.0013 20 22.7313 20 24.9113 19.4C26.1313 19.09 27.1213 18.11 27.4313 16.89C27.7413 15.67 28.0013 13.4 28.0013 10C28.0013 6.6 27.7413 4.33 27.4313 3.11Z" fill="#FF0000"/><path d="M11.2013 14.2V5.8L18.2013 10L11.2013 14.2Z" fill="white"/></svg>';
      const c = document.createElement("div");
      const l = document.createElement("div");
      l.style.cssText = "font-family: 'Archivo Black', sans-serif; font-weight: 700; color: #333; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;";
      l.textContent = escapeHtml(e.name);
      const d = document.createElement("div");
      d.style.cssText = "font-size: 11px; color: #666;";
      d.textContent = o ? "✓ Connected" : "○ Not connected";
      c.appendChild(l);
      c.appendChild(d);
      a.appendChild(r);
      a.appendChild(c);
      if (o) {
        const t = document.createElement("button");
        t.className = "unlink-btn";
        t.setAttribute("data-platform", escapeHtml(e.key));
        t.style.cssText = "padding: 6px 12px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.3s ease;";
        t.textContent = "Unlink";
        t.addEventListener("click", () => {
          const e = t.getAttribute("data-platform");
          if (confirm(`Unlink ${escapeHtml(this.getPlatformName(e))}?`)) {
            this.unlinkPlatform(e);
          }
        });
        i.appendChild(a);
        i.appendChild(t);
      } else {
        i.appendChild(a);
      }
      s.appendChild(i);
      t.appendChild(s);
    });
  }
  async unlinkPlatform(t) {
    try {
      if (!validatePlatformName(t)) {
        throw new Error("Invalid platform name");
      }
      if (!validateUserId(this.userId)) {
        throw new Error("Invalid user ID");
      }
      const e = JSON.stringify({
        user_id: this.userId
      });
      const n = getCsrfToken();
      const o = await _signRequest("/analytics/disconnect", "POST", e);
      if (t === "youtube") {
        const t = await fetch(`${this.apiBase}/analytics/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": n,
            "X-Request-Timestamp": o.timestamp || "",
            "X-Request-Nonce": o.nonce || "",
            "X-Request-Signature": o.signature || ""
          },
          body: e,
          credentials: "include",
          signal: AbortSignal.timeout(3e4)
        });
        if (!t.ok && t.status !== 200 && t.status !== 204) {
          throw new Error(`Disconnect failed: ${t.status}`);
        }
        localStorage.removeItem("youtube_connected");
        localStorage.removeItem("youtube_token_time");
        localStorage.removeItem("youtube_token");
      }
      if (this.connections[t]) {
        this.connections[t].connected = false;
      }
      if (typeof this.connections === "object") {
        localStorage.setItem("platform_connections", JSON.stringify(this.connections));
      }
      const s = document.getElementById("setupBanner");
      if (s) s.style.display = "block";
      if (window.analyticsManager) {
        window.analyticsManager.isConnected = false;
        window.analyticsManager.loadAnalyticsData();
      }
      this.updateConnectionsDisplay();
      this.showNotification(`${this.getPlatformName(t)} disconnected successfully`);
    } catch (t) {
      this.showNotification(`Failed to disconnect: ${t.message}`, true);
    }
  }
  getPlatformName(t) {
    const e = {
      youtube: "YouTube"
    };
    return e[t] || t;
  }
  generateUserId() {
    let t = localStorage.getItem("youtube_user_id");
    if (!t) {
      t = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("youtube_user_id", t);
    }
    return t;
  }
  showNotification(t, e = false) {
    const n = document.createElement("div");
    n.style.cssText = `\n            position: fixed;\n            top: 20px;\n            right: 20px;\n            padding: 15px 20px;\n            background: ${e ? "#f8d7da" : "#d4edda"};\n            color: ${e ? "#721c24" : "#155724"};\n            border: 1px solid ${e ? "#f5c6cb" : "#c3e6cb"};\n            border-radius: 8px;\n            z-index: 9999;\n            font-size: 14px;\n            animation: slideIn 0.3s ease;\n        `;
    n.textContent = t;
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = "slideOut 0.3s ease";
      setTimeout(() => n.remove(), 300);
    }, 3e3);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.settingsManager = new SettingsManager;
});

const settingsStyle = document.createElement("style");

settingsStyle.textContent = `\n    @keyframes slideIn {\n        from {\n            transform: translateX(400px);\n            opacity: 0;\n        }\n        to {\n            transform: translateX(0);\n            opacity: 1;\n        }\n    }\n    @keyframes slideOut {\n        from {\n            transform: translateX(0);\n            opacity: 1;\n        }\n        to {\n            transform: translateX(400px);\n            opacity: 0;\n        }\n    }\n`;

document.head.appendChild(settingsStyle);
