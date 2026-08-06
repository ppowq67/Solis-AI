class YouTubeAnalyticsManager {
  constructor() {
    this.isConnected = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.userInfo = null;
    this.channels = [];
    this.apiBase = window.API_BASE_URL || "https://api.solisai.video/api";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.loadStoredToken();
    this.checkConnectionStatus();
  }
  loadStoredToken() {
    try {
      const e = sessionStorage.getItem("youtube_access_token");
      const t = sessionStorage.getItem("youtube_token_expiry");
      if (e && t) {
        const o = new Date(t);
        if (o > new Date) {
          this.accessToken = e;
          this.tokenExpiry = t;
          this.isConnected = true;
          return true;
        } else {
          this.clearStoredToken();
        }
      }
    } catch (e) {
      console.error("Error loading YouTube token:", e);
    }
    return false;
  }
  clearStoredToken() {
    sessionStorage.removeItem("youtube_access_token");
    sessionStorage.removeItem("youtube_token_expiry");
    sessionStorage.removeItem("youtube_refresh_token");
    localStorage.removeItem("youtube_connected");
    localStorage.removeItem("youtube_user_id");
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isConnected = false;
  }
  async checkConnectionStatus() {
    this.isConnected = false;
  }
  async startOAuthFlow() {
    try {
      if (window.__ytOAuthInFlight) {
        return false;
      }
      window.__ytOAuthInFlight = true;
      const e = await fetch(`${this.apiBase}/auth/youtube/authorize`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!e.ok) {
        throw new Error(`OAuth setup failed: ${e.status}`);
      }
      const t = await e.json();
      const {auth_url: o, token_id: n} = t;
      if (!o) {
        throw new Error("No authorization URL received");
      }
      sessionStorage.setItem("youtube_oauth_token_id", n);
      sessionStorage.setItem("youtube_oauth_timestamp", Date.now().toString());
      this.openOAuthPopup(o);
      return true;
    } catch (e) {
      window.__ytOAuthInFlight = false;
      console.error("Failed to start OAuth flow:", e);
      this.showNotification("Failed to start YouTube connection", "error");
      return false;
    }
  }
  openOAuthPopup(e) {
    const t = 500;
    const o = 600;
    const n = (window.innerWidth - t) / 2;
    const s = (window.innerHeight - o) / 2;
    const i = window.open(e, "youtube_oauth", `width=${t},height=${o},left=${n},top=${s}`);
    if (!i) {
      this.showNotification("Please allow pop-ups to connect YouTube", "error");
      return;
    }
    const a = setInterval(() => {
      if (i.closed) {
        clearInterval(a);
        window.__ytOAuthInFlight = false;
        setTimeout(() => this.checkConnectionStatus(), 1e3);
      }
    }, 500);
  }
  async handleOAuthCallback(e) {
    try {
      if (!e || !e.success) {
        console.error("OAuth callback failed");
        return false;
      }
      const t = sessionStorage.getItem("youtube_oauth_token_id");
      if (e.token_id !== t) {
        console.error("Token ID mismatch - possible CSRF attempt");
        return false;
      }
      sessionStorage.setItem("youtube_access_token", e.access_token);
      sessionStorage.setItem("youtube_token_expiry", e.expires_at);
      this.accessToken = e.access_token;
      this.tokenExpiry = e.expires_at;
      this.isConnected = true;
      this.updateAnalyticsUI();
      this.showNotification(" YouTube connected successfully!", "success");
      return true;
    } catch (e) {
      console.error("Error handling OAuth callback:", e);
      return false;
    }
  }
  async disconnect() {
    try {
      const e = await fetch(`${this.apiBase}/auth/youtube/disconnect`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!e.ok) {
        throw new Error(`Disconnect failed: ${e.status}`);
      }
      this.clearStoredToken();
      this.updateAnalyticsUI();
      this.showNotification(" YouTube disconnected", "success");
      return true;
    } catch (e) {
      console.error("Error disconnecting YouTube:", e);
      this.showNotification("Failed to disconnect YouTube", "error");
      return false;
    }
  }
  async checkTokenExpiry() {
    if (!this.tokenExpiry) return;
    const e = new Date(this.tokenExpiry);
    const t = new Date;
    const o = e - t;
    const n = 5 * 60 * 1e3;
    if (o < n && o > 0) {
      await this.refreshToken();
    } else if (o <= 0) {
      this.clearStoredToken();
      this.isConnected = false;
    }
  }
  async refreshToken() {
    try {
      const e = await fetch(`${this.apiBase}/auth/youtube/refresh-token`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!e.ok) {
        throw new Error(`Token refresh failed: ${e.status}`);
      }
      const t = await e.json();
      sessionStorage.setItem("youtube_access_token", t.access_token);
      sessionStorage.setItem("youtube_token_expiry", t.expires_at);
      this.accessToken = t.access_token;
      this.tokenExpiry = t.expires_at;
      return true;
    } catch (e) {
      console.error("Error refreshing YouTube token:", e);
      this.clearStoredToken();
      return false;
    }
  }
  async fetchAnalyticsData(e = null, t = null) {
    try {
      if (!this.isConnected || !this.accessToken) {
        console.warn("Not connected to YouTube");
        return null;
      }
      await this.checkTokenExpiry();
      if (!e) {
        const o = new Date;
        t = new Date;
        e = new Date(o.setDate(o.getDate() - 30));
      }
      const formatDate = e => e.toISOString().split("T")[0];
      const o = await fetch(`${this.apiBase}/analytics/dashboard`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          start_date: formatDate(e),
          end_date: formatDate(t)
        })
      });
      if (!o.ok) {
        if (o.status === 401) {
          await this.refreshToken();
        }
        throw new Error(`Analytics fetch failed: ${o.status}`);
      }
      const n = await o.json();
      return n;
    } catch (e) {
      console.error("Error fetching analytics:", e);
      return null;
    }
  }
  updateAnalyticsUI() {
    const e = document.getElementById("connectYouTubeBtn");
    const t = document.getElementById("disconnectYouTubeBtn");
    const o = document.getElementById("youtubeStatus");
    if (this.isConnected) {
      if (e) e.style.display = "none";
      if (t) t.style.display = "flex";
      if (o) {
        o.innerHTML = '<span style="color: #4caf50;">✓ YouTube Connected</span>';
      }
    } else {
      if (e) e.style.display = "flex";
      if (t) t.style.display = "none";
      if (o) {
        o.innerHTML = '<span style="color: #999;">YouTube Not Connected</span>';
      }
    }
  }
  showNotification(e, t = "info") {
    const o = document.getElementById("i1y0");
    if (!o) {
      return;
    }
    const n = document.createElement("div");
    n.className = `notification notification-${t}`;
    n.textContent = e;
    n.style.cssText = `\n            padding: 16px;\n            margin-bottom: 12px;\n            background: ${t === "error" ? "#ff4444" : t === "success" ? "#4caf50" : "#2196f3"};\n            color: white;\n            border-radius: 8px;\n            animation: slideInRight 0.3s ease;\n        `;
    o.appendChild(n);
    setTimeout(() => {
      n.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => n.remove(), 300);
    }, 4e3);
  }
}

window.youtubeAnalyticsManager = new YouTubeAnalyticsManager;

window.connectYouTube = () => window.youtubeAnalyticsManager.startOAuthFlow();

window.disconnectYouTube = () => window.youtubeAnalyticsManager.disconnect();

setInterval(() => {
  if (window.youtubeAnalyticsManager) {
    window.youtubeAnalyticsManager.checkTokenExpiry();
  }
}, 5 * 60 * 1e3);

window.addEventListener("message", e => {
  const t = window.API_BASE_URL || "https://api.solisai.video/api";
  const o = t.split("/api")[0];
  if (e.origin !== o) return;
  if (e.data.type === "youtube_oauth_callback") {
    if (window.youtubeAnalyticsManager) {
      window.youtubeAnalyticsManager.handleOAuthCallback(e.data.payload);
    }
  }
});
