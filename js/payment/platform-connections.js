document.addEventListener("DOMContentLoaded", function() {
  const e = document.getElementById("platformConnectionsContainer");
  const t = document.getElementById("platformOnboarding");
  const n = document.getElementById("connectFirstPlatformBtn");
  function getApiBase() {
    return window.API_BASE_URL || "https://api.solisai.video/api";
  }
  const o = getApiBase();
  const s = !!e;
  async function fetchConnectionStatus() {
    try {
      const e = await fetch(`${o}/analytics/status`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (e.ok) {
        const t = await e.json();
        if (!t || typeof t !== "object") {
          throw new Error("Invalid response structure");
        }
        renderConnections(t);
        if (t.youtube?.connected) {
          localStorage.setItem("youtube_connected", "true");
          if (window.analyticsManager) {
            await window.analyticsManager.loadAnalyticsData();
          } else {}
        } else {}
      } else {
        throw new Error("Endpoint not available");
      }
    } catch (e) {
      const t = localStorage.getItem("platform_connections");
      if (t) {
        try {
          const e = JSON.parse(t);
          renderConnections(e);
        } catch (e) {
          showOnboarding();
        }
      } else {
        showOnboarding();
      }
    }
  }
  function renderConnections(n) {
    if (!e) return;
    e.innerHTML = "";
    let o = false;
    if (!n || typeof n !== "object") {
      console.error("Invalid statusData:", n);
      showOnboarding();
      return;
    }
    const s = Object.values(n).filter(e => e && typeof e === "object");
    s.forEach(t => {
      if (!t || !t.platform) {
        console.warn("Skipping invalid platform:", t);
        return;
      }
      o = true;
      const n = document.createElement("div");
      n.className = "settings-option platform-connection-item";
      n.dataset.platform = t.platform.toLowerCase();
      n.dataset.connected = t.connected ? "true" : "false";
      n.style.cursor = t.connected ? "default" : "pointer";
      if (t.connected) {
        n.innerHTML = `\n                    <div class="settings-option-icon">${t.icon || ""}</div>\n                    <div class="option-info">\n                        <div class="option-name">${t.platform}</div>\n                        <div class="option-description" style="color: #22c55e;">Connected</div>\n                    </div>\n                    <button class="disconnect-btn" data-platform="${t.platform.toLowerCase()}">Disconnect</button>\n                `;
      } else {
        n.innerHTML = `\n                    <div class="settings-option-icon">${t.icon || ""}</div>\n                    <div class="option-info">\n                        <div class="option-name">${t.platform}</div>\n                        <div class="option-description" style="color: #999;">Click to connect</div>\n                    </div>\n                    <button style="background: #0066ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">Connect</button>\n                `;
      }
      e.appendChild(n);
    });
    if (o) {
      if (t) t.style.display = "none";
      e.style.display = "block";
    } else {
      showOnboarding();
    }
  }
  function showOnboarding() {
    if (e) e.style.display = "none";
    if (t) t.style.display = "block";
  }
  window.connectYouTube = async function() {
    const e = new Promise(e => {
      const messageHandler = t => {
        if (t.data && t.data.type === "YOUTUBE_AUTH_SUCCESS") {
          window.removeEventListener("message", messageHandler);
          e(true);
        }
      };
      window.addEventListener("message", messageHandler);
    });
    try {
      const t = `${o}/analytics/youtube/auth`;
      const n = await fetch(t, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!n.ok) {
        const e = await n.json().catch(() => ({
          error: "An unknown server error occurred."
        }));
        console.error("[connectYouTube] Backend error:", e);
        throw new Error(e.error || `HTTP error! status: ${n.status}`);
      }
      const s = await n.json();
      if (s.auth_url) {
        const t = window.open(s.auth_url, "authWindow", "width=600,height=700");
        if (!t) {
          alert("Please allow popups to connect YouTube");
          console.error("[connectYouTube] Popup was blocked!");
          return;
        }
        const n = new Promise(e => {
          setTimeout(() => {
            e(false);
          }, 3e3);
        });
        Promise.race([ e, n ]).then(() => {
          setTimeout(() => {
            fetchConnectionStatus();
          }, 500);
        });
      } else {
        console.error("[connectYouTube] No auth_url in response");
        alert("Failed to get authentication URL");
      }
    } catch (e) {
      console.error("[connectYouTube] Connection failed:", e);
      alert(`Connection failed: ${e.message}`);
    }
  };
  async function disconnectPlatform(e) {
    if (!e || typeof e !== "string" || e.length === 0) {
      console.error("Invalid platform name");
      return;
    }
    const t = document.getElementById("i1qw");
    const n = document.getElementById("i1px");
    const s = document.getElementById("i1qx");
    const c = e.replace(/[<>"']/g, "");
    s.textContent = `Are you sure you want to disconnect ${c}?`;
    t.classList.add("show");
    const handleConfirm = async () => {
      n.removeEventListener("click", handleConfirm);
      t.classList.remove("show");
      const s = await fetch(`${o}/analytics/disconnect`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          platform: e
        })
      });
      if (s.ok) {
        showNotification(`${e} disconnected successfully`, "success");
        fetchConnectionStatus();
      } else {
        showNotification("Failed to disconnect. Please try again.", "error");
      }
    };
    n.addEventListener("click", handleConfirm);
  }
  if (s && n) {
    n.addEventListener("click", function() {
      window.connectYouTube();
    });
    showOnboarding();
  }
  if (e) {
    e.addEventListener("click", e => {
      const t = e.target.closest(".ca0");
      const n = e.target.closest(".platform-connection-item");
      if (t) {
        disconnectPlatform(t.dataset.platform);
      } else if (n && n.dataset.connected === "false") {
        const e = n.dataset.platform;
        if (e === "youtube") {
          window.connectYouTube();
        }
      }
    });
  }
  const c = document.getElementById("getStartedBadge");
  if (c) {
    c.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      const t = document.getElementById("i259");
      const n = document.getElementById("i258");
      if (t) {
        t.classList.remove("active");
      }
      if (n) {
        n.classList.remove("active");
      }
      if (window.setupModal) {
        window.setupModal.openModal();
      } else {}
    });
  } else {}
  if (s) {
    fetchConnectionStatus();
  }
  const i = sessionStorage.getItem("paymentSuccess");
  if (i) {
    try {
      const e = JSON.parse(i);
      showPaymentSuccessModal();
      createConfetti();
      if (window.clipsStudio) {
        clipsStudio.loadAndDisplayStorageInfo();
      }
      sessionStorage.removeItem("paymentSuccess");
    } catch (e) {
      console.error("Error parsing payment success data:", e);
    }
  } else {}
  const a = document.getElementById("DeleteALLBtn");
  if (a) {
    a.addEventListener("click", () => {
      const e = document.getElementById("processingList");
      const t = e.querySelectorAll(".cwv:not(.processing)");
      if (t.length === 0) {
        alert("No completed or failed items to delete.");
        return;
      }
      if (confirm(`Are you sure you want to delete ${t.length} item(s)? This action cannot be undone.`)) {
        t.forEach(e => {
          e.remove();
        });
        const n = e.querySelectorAll(".cwv");
        const o = document.getElementById("emptyProcessingState");
        if (n.length === 0 && o) {
          o.style.display = "block";
        }
      }
    });
  }
  const r = document.getElementById("processingList");
  const l = document.getElementById("emptyProcessingState");
  if (r && l) {
    const e = new MutationObserver(() => {
      const e = r.querySelector(".cwv");
      l.style.display = e ? "none" : "flex";
    });
    e.observe(r, {
      childList: true
    });
  }
});
