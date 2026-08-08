const NOTIF_CONFIG = {
  VERSION: 2,
  STORAGE_KEY: "notificationSystem_v2",
  MAX_NOTIFICATIONS: 50,
  STORAGE_CLEANUP_INTERVAL: 864e5,
  WS_RECONNECT_DELAY: 3e3,
  WS_MAX_RECONNECT_DELAY: 3e4,
  WS_PING_INTERVAL: 3e4
};

function escapeHtml(e) {
  if (typeof e !== "string") return "";
  const t = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;"
  };
  return e.replace(/[&<>"'\/]/g, e => t[e] || e);
}

function isValidImageUrl(e) {
  if (typeof e !== "string" || e.length === 0 || e.length > 2048) return false;
  try {
    const t = new URL(e);
    if (!/^https?:$/.test(t.protocol)) return false;
    const n = e.toLowerCase();
    if (n.includes("javascript:") || n.includes("data:") || n.includes("vbscript:")) return false;
    return true;
  } catch {
    return false;
  }
}

function safeSetText(e, t) {
  if (e && typeof t === "string") {
    e.textContent = t;
  }
}

function safeSetImage(e, t, n = "") {
  if (!e) return;
  if (!isValidImageUrl(t)) {
    console.warn("Invalid image URL");
    return;
  }
  const i = document.createElement("img");
  i.setAttribute("src", t);
  i.setAttribute("alt", escapeHtml(n));
  i.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 50%;";
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
  e.appendChild(i);
}

function validateUserObject(e) {
  if (!e || typeof e !== "object") return {
    valid: false
  };
  const t = e.id || e.user_id || e.sub;
  const n = e.email || e.name || e.displayName;
  if (t || n) {
    return {
      valid: true,
      user: e
    };
  }
  return {
    valid: false
  };
}

let notificationSystem = {
  unreadCount: 0,
  notifications: [],
  bellElement: null,
  profileElement: null,
  notificationsDropdown: null,
  profileDropdown: null,
  initialized: false
};

function initializeNotificationSystem() {
  if (notificationSystem.initialized) return;
  notificationSystem.bellElement = document.getElementById("bellBtn");
  notificationSystem.profileElement = document.getElementById("profileAvatarBtn");
  notificationSystem.notificationsDropdown = document.getElementById("notificationsDropdown");
  if (!notificationSystem.bellElement || !notificationSystem.profileElement) {
    console.warn("Required notification elements not found");
    return;
  }
  attachNotificationEventListeners();
  loadNotificationsFromStorage();
  syncProfileButton();
  notificationSystem.initialized = true;
  syncProfileButton();
}

function syncProfileButton() {
  const e = document.getElementById("profileAvatarBtn");
  if (!e) return;
  let t = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      t = window.currentUser;
    }
  } catch (e) {
    console.error("Error syncing profile:", e);
    t = null;
  }
  const n = validateUserObject(t);
  if (!n || !n.valid) {
    console.warn("Invalid user object");
    return;
  }
  const i = n.user;
  const o = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(i) : i.picture || i.avatar || null;
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
  if (o && typeof o === "string" && isValidImageUrl(o)) {
    safeSetImage(e, o, "User Avatar");
  }
}

function attachNotificationEventListeners() {
  const e = notificationSystem.bellElement;
  const t = notificationSystem.notificationsDropdown;
  e.addEventListener("click", e => {
    e.stopPropagation();
    const n = t.classList.contains("open");
    closeAllDropdowns();
    if (!n) {
      t.classList.add("open");
      clearUnreadStatus();
    }
  });
  const n = document.getElementById("dropdownNotifications");
  if (n && !n.dataset.bound) {
    n.dataset.bound = "1";
    n.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openNotificationsFromProfile();
    });
  }
  document.addEventListener("click", closeAllDropdowns);
  const i = document.getElementById("markAsRead");
  if (i) {
    i.addEventListener("click", e => {
      e.preventDefault();
      clearUnreadStatus();
    });
  }
}

function closeAllDropdowns() {
  const e = notificationSystem.notificationsDropdown;
  if (e) e.classList.remove("open");
  const t = document.getElementById("profileDropdown");
  if (t) t.classList.remove("open");
  const n = notificationSystem.unreadCount > 0 || typeof NotificationSystemV2 !== "undefined" && NotificationSystemV2.state?.unreadCount > 0;
  if (typeof syncNotifBellVisibility === "function") {
    syncNotifBellVisibility(!!n);
  }
}

function loadNotificationsFromStorage() {
  try {
    const e = localStorage.getItem("notificationSystem");
    if (e) {
      const t = JSON.parse(e);
      notificationSystem.notifications = t.notifications || [];
      notificationSystem.unreadCount = t.unreadCount || 0;
      updateNotificationDisplay();
    }
  } catch (e) {
    console.error("Error loading notifications:", e);
  }
}

function saveNotificationsToStorage() {
  try {
    localStorage.setItem("notificationSystem", JSON.stringify({
      notifications: notificationSystem.notifications,
      unreadCount: notificationSystem.unreadCount
    }));
  } catch (e) {
    console.error("Error saving notifications:", e);
  }
}

function addNotification(e) {
  if (!e || typeof e !== "object") {
    console.error("Invalid notification object");
    return null;
  }
  const sanitizeString = (e, t = 500) => {
    if (typeof e !== "string") return "";
    return escapeHtml(e.substring(0, t));
  };
  const t = {
    id: Date.now(),
    title: sanitizeString(e.title || "Notification", 100),
    message: sanitizeString(e.message || "New notification", 500),
    icon: e.icon || "info",
    timestamp: e.timestamp || new Date,
    read: e.read === true,
    ...e
  };
  const n = [ "check", "info", "warning", "error", "default" ];
  if (!n.includes(t.icon)) {
    t.icon = "default";
  }
  notificationSystem.notifications.unshift(t);
  notificationSystem.unreadCount++;
  if (notificationSystem.notifications.length > 50) {
    notificationSystem.notifications = notificationSystem.notifications.slice(0, 50);
  }
  saveNotificationsToStorage();
  updateNotificationDisplay();
  return t;
}

function showVideoGeneratedNotification(e = {}) {
  const {videoTitle: t = "Video Generated", videoUrl: n = "#", thumbnailUrl: i = null, duration: o = 0} = e;
  showVideoGeneratedOverlay(t, n);
  addNotification({
    title: "Video Generated",
    message: `Your video "${t}" has been successfully created and is ready to download.`,
    icon: "check",
    action: {
      label: "View Video",
      url: n
    }
  });
}

function showVideoGenerated(e = {}) {
  return showVideoGeneratedNotification(e);
}

function showVideoGenerated(e = {}) {
  return showVideoGeneratedNotification(e);
}

function showVideoGeneratedOverlay(e = "Video Ready!", t = "#") {
  const n = document.getElementById("videoGeneratedBackdrop");
  const i = document.getElementById("videoGeneratedOverlay");
  if (!n || !i) {
    console.warn("Video generated overlay elements not found");
    return;
  }
  const o = i.querySelector(".video-generated-title");
  const a = i.querySelector(".video-generated-message");
  const s = i.querySelector('[data-action="view"]');
  if (o) o.textContent = e;
  if (a) a.textContent = "Your video has been successfully generated and is ready to download or share.";
  if (s) {
    s.onclick = () => {
      if (t !== "#") {
        window.open(t, "_blank");
      }
      hideVideoGeneratedOverlay();
    };
  }
  n.classList.add("show");
  i.classList.add("show");
  setTimeout(hideVideoGeneratedOverlay, 8e3);
}

function hideVideoGeneratedOverlay() {
  const e = document.getElementById("videoGeneratedBackdrop");
  const t = document.getElementById("videoGeneratedOverlay");
  if (e) e.classList.remove("show");
  if (t) t.classList.remove("show");
}

function updateNotificationDisplay() {
  const e = notificationSystem.bellElement;
  if (!e) return;
  const t = notificationSystem.unreadCount > 0;
  syncNotifBellVisibility(t);
  if (t) {
    e.classList.add("has-unread");
  } else {
    e.classList.remove("has-unread");
  }
  renderNotificationsList();
}

function isMobileNotifChrome() {
  return typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 768px)").matches : window.innerWidth <= 768;
}

function syncNotifBellVisibility(e) {
  const t = document.getElementById("notifWrapper") || document.querySelector(".notif-wrapper");
  const n = document.getElementById("dropdownNotifBadge");
  const i = notificationSystem.unreadCount || (typeof NotificationSystemV2 !== "undefined" ? NotificationSystemV2.state?.unreadCount || 0 : 0);
  const o = typeof e === "boolean" ? e : i > 0;
  const a = !!document.getElementById("notificationsDropdown")?.classList.contains("open");
  const s = isMobileNotifChrome() ? o || a : true;
  if (t) {
    t.classList.toggle("is-visible", s);
    t.setAttribute("aria-hidden", s ? "false" : "true");
  }
  if (n) {
    if (o && i > 0) {
      n.hidden = false;
      n.textContent = i > 9 ? "9+" : String(i);
    } else {
      n.hidden = true;
      n.textContent = "";
    }
  }
}

if (typeof window !== "undefined" && !window.__solisNotifChromeResizeBound) {
  window.__solisNotifChromeResizeBound = true;
  let e = null;
  window.addEventListener("resize", () => {
    clearTimeout(e);
    e = setTimeout(() => {
      if (typeof syncNotifBellVisibility === "function") syncNotifBellVisibility();
    }, 120);
  });
}

function openNotificationsFromProfile() {
  const e = document.getElementById("notificationsDropdown");
  const t = document.getElementById("notifWrapper") || document.querySelector(".notif-wrapper");
  closeAllDropdowns();
  if (t) {
    t.classList.add("is-visible");
    t.setAttribute("aria-hidden", "false");
  }
  if (e) {
    e.classList.add("open");
  }
}

function renderNotificationsList() {
  const e = document.getElementById("notificationsList");
  if (!e) return;
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
  if (notificationSystem.notifications.length === 0) {
    const t = document.createElement("div");
    t.style.cssText = "padding: 20px; text-align: center; color: #718096;";
    safeSetText(t, "No notifications");
    e.appendChild(t);
    return;
  }
  notificationSystem.notifications.forEach(t => {
    if (!t || typeof t !== "object") return;
    const n = document.createElement("div");
    n.className = "notif-item";
    const i = document.createElement("div");
    i.className = "notif-icon";
    const o = document.createElement("svg");
    o.setAttribute("width", "18");
    o.setAttribute("height", "18");
    o.setAttribute("viewBox", "0 0 24 24");
    o.setAttribute("fill", "none");
    o.setAttribute("stroke", "currentColor");
    o.setAttribute("stroke-linecap", "round");
    o.setAttribute("stroke-linejoin", "round");
    o.innerHTML = getNotificationIcon(t.icon);
    i.appendChild(o);
    const a = document.createElement("div");
    a.className = "notif-content";
    const s = document.createElement("div");
    s.className = "notif-sender";
    safeSetText(s, t.title);
    const r = document.createElement("div");
    r.className = "notif-message";
    safeSetText(r, t.message);
    const c = document.createElement("div");
    c.className = "notif-time";
    safeSetText(c, formatTime(t.timestamp));
    a.appendChild(s);
    a.appendChild(r);
    a.appendChild(c);
    n.appendChild(i);
    n.appendChild(a);
    e.appendChild(n);
  });
}

function getNotificationIcon(e) {
  const t = {
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
    default: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>'
  };
  return t[e] || t["default"];
}

function clearUnreadStatus() {
  notificationSystem.unreadCount = 0;
  notificationSystem.notifications.forEach(e => e.read = true);
  saveNotificationsToStorage();
  updateNotificationDisplay();
}

function formatTime(e) {
  if (typeof e === "string") {
    e = new Date(e);
  }
  const t = new Date;
  const n = t - e;
  const i = Math.floor(n / 1e3);
  const o = Math.floor(i / 60);
  const a = Math.floor(o / 60);
  const s = Math.floor(a / 24);
  if (i < 60) return "just now";
  if (o < 60) return `${o}m ago`;
  if (a < 24) return `${a}h ago`;
  if (s < 7) return `${s}d ago`;
  return e.toLocaleDateString();
}

function updateProfileInfo() {
  const e = document.getElementById("profileNameDisplay");
  const t = document.getElementById("profilePlanDisplay");
  const n = document.getElementById("profileAvatarDisplay");
  let i = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      i = window.currentUser;
    } else {
      const e = localStorage.getItem("currentUser");
      if (e) {
        const t = e.trim();
        if (t.startsWith("{") && t.endsWith("}")) {
          i = JSON.parse(e);
        }
      }
    }
  } catch (e) {
    console.error("Error reading user data:", e);
    i = null;
  }
  const o = validateUserObject(i);
  if (!o || !o.valid) {
    console.warn("Invalid user object");
    return;
  }
  const a = o.user;
  const s = escapeHtml((a.name || a.displayName || a.email || "User").toString().substring(0, 100));
  const r = escapeHtml((a.tier || a.plan || "Free Plan").toString().toUpperCase().substring(0, 50));
  const c = a.picture || a.avatar || null;
  if (e) {
    safeSetText(e, s);
  }
  if (t) {
    safeSetText(t, r);
  }
  if (n && c && typeof c === "string") {
    if (isValidImageUrl(c)) {
      safeSetImage(n, c, s);
    }
  }
}

const Logger = {
  log: () => {},
  success: () => {},
  warn: (e, t) => console.warn(`[NotifSys] ${e}`, t || ""),
  error: (e, t) => console.error(`[NotifSys] ${e}`, t || "")
};

const StorageManager = {
  save: (e, t) => {
    try {
      const n = {
        version: 2,
        timestamp: Date.now(),
        data: t
      };
      localStorage.setItem(e, JSON.stringify(n));
      Logger.success(`Storage saved: ${e}`);
      return true;
    } catch (e) {
      Logger.error("Storage save failed:", e.message);
      return false;
    }
  },
  load: e => {
    try {
      const t = localStorage.getItem(e);
      if (!t) return null;
      const n = JSON.parse(t);
      if (!n || typeof n !== "object") {
        Logger.warn("Invalid payload structure");
        return null;
      }
      const i = Date.now() - n.timestamp;
      if (i > 30 * 24 * 60 * 60 * 1e3) {
        Logger.warn("Data is stale, clearing");
        localStorage.removeItem(e);
        return null;
      }
      Logger.success(`Storage loaded: ${e}`);
      return n.data;
    } catch (e) {
      Logger.error("Storage load failed:", e.message);
      return null;
    }
  },
  clear: e => {
    try {
      localStorage.removeItem(e);
      Logger.success(`Storage cleared: ${e}`);
      return true;
    } catch (e) {
      Logger.error("Storage clear failed:", e.message);
      return false;
    }
  },
  getSize: e => {
    try {
      const t = localStorage.getItem(e);
      return t ? new Blob([ t ]).size : 0;
    } catch {
      return 0;
    }
  }
};

(function ensureWebSocketManagerConnect() {
  const socketOrigin = () => (typeof window.getSolisSocketOrigin === "function" ? window.getSolisSocketOrigin() : (window.API_BASE_URL || "https://api.solisai.video/api").toString().replace(/\/api\/?$/, "")) || "https://api.solisai.video";
  if (typeof WebSocketManager === "function") {
    if (typeof WebSocketManager.connect !== "function") {
      WebSocketManager.connect = function() {
        if (!window.wsManager) {
          window.wsManager = new WebSocketManager;
        }
        return window.wsManager;
      };
    }
    WebSocketManager.connected = WebSocketManager.connected || false;
    return;
  }
  if (typeof WebSocketManager !== "undefined") return;
  window.WebSocketManager = {
    ws: null,
    io: null,
    connected: false,
    reconnectAttempts: 0,
    reconnectDelay: 3e3,
    messageHandlers: [],
    useSocketIO: typeof io !== "undefined",
    useRawWS: false,
    connect: () => {
      if (WebSocketManager.connected) return;
      if (WebSocketManager.useSocketIO && typeof io !== "undefined") {
        try {
          WebSocketManager.io = io(socketOrigin(), {
            reconnection: true,
            reconnectionDelay: 3e3,
            reconnectionDelayMax: 3e4,
            reconnectionAttempts: 5,
            transports: [ "websocket", "polling" ],
            path: "/socket.io/",
            withCredentials: true
          });
          WebSocketManager.io.on("connect", () => {
            Logger.success("Socket.IO connected");
            WebSocketManager.connected = true;
            WebSocketManager.reconnectAttempts = 0;
            document.body.classList.add("ws-connected");
          });
          WebSocketManager.io.on("message", e => {
            try {
              const t = typeof e === "string" ? JSON.parse(e) : e;
              WebSocketManager.messageHandlers.forEach(e => {
                try {
                  e(t);
                } catch (e) {
                  Logger.error("Handler error:", e.message);
                }
              });
            } catch (e) {
              Logger.error("Message parse error:", e.message);
            }
          });
          WebSocketManager.io.on("disconnect", () => {
            Logger.warn("Socket.IO disconnected, using localStorage fallback");
            WebSocketManager.connected = false;
            document.body.classList.remove("ws-connected");
          });
          WebSocketManager.io.on("connect_error", e => {
            Logger.warn("Socket.IO connection error, using localStorage fallback");
            WebSocketManager.connected = false;
          });
          return;
        } catch (e) {
          Logger.warn("Socket.IO initialization error, falling back to localStorage");
        }
      }
      Logger.log("Using localStorage for notifications (WebSocket/Socket.IO not available)");
      WebSocketManager.connected = false;
      document.body.classList.add("using-storage-fallback");
    },
    attemptReconnect: () => {},
    send: e => {
      if (!WebSocketManager.connected || !WebSocketManager.io) {
        Logger.log("Using localStorage (not connected to realtime)");
        return false;
      }
      try {
        WebSocketManager.io.emit("message", e);
        return true;
      } catch (e) {
        Logger.error("Send error:", e.message);
        return false;
      }
    },
    subscribe: e => {
      if (typeof e === "function") {
        WebSocketManager.messageHandlers.push(e);
      }
    }
  };
})();

if (typeof WebSocketManager !== "undefined" && WebSocketManager && typeof WebSocketManager.subscribe !== "function") {
  WebSocketManager.subscribe = function() {};
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => WebSocketManager.connect());
} else {
  WebSocketManager.connect();
}

const NotificationSystemV2 = {
  state: {
    notifications: [],
    unreadCount: 0,
    initialized: false
  },
  init: () => {
    if (NotificationSystemV2.state.initialized) return;
    Logger.log("Initializing notification system v2...");
    const e = StorageManager.load("notificationSystem_v2");
    if (e) {
      NotificationSystemV2.state.notifications = e.notifications || [];
      NotificationSystemV2.state.unreadCount = e.unreadCount || 0;
      Logger.success(`Restored ${NotificationSystemV2.state.notifications.length} notifications from storage`);
    }
    NotificationSystemV2.setupNotificationHandlers();
    WebSocketManager.connect();
    WebSocketManager.subscribe(NotificationSystemV2.handleWebSocketMessage);
    NotificationSystemV2.updateDisplay();
    NotificationSystemV2.state.initialized = true;
    NotificationSystemV2.scheduleCleanup();
    NotificationSystemV2.waitForElement(".profile-dropdown-name", () => {
      Logger.log("profile-dropdown-name found, loading badges...");
      NotificationSystemV2.loadUserBadges();
    });
    Logger.success("Notification system v2 fully initialized");
  },
  waitForElement: (e, t) => {
    const n = document.querySelector(e);
    if (n) {
      t(n);
      return;
    }
    const i = new MutationObserver(() => {
      const n = document.querySelector(e);
      if (n) {
        i.disconnect();
        t(n);
      }
    });
    i.observe(document.body, {
      childList: true,
      subtree: true
    });
  },
  loadUserBadges: async () => {
    if (NotificationSystemV2._badgesLoaded) return;
    NotificationSystemV2._badgesLoaded = true;
    try {
      const e = {
        "Content-Type": "application/json"
      };
      if (typeof getAuthHeaders === "function") Object.assign(e, getAuthHeaders());
      const t = await fetch("/api/badges/current", {
        method: "POST",
        credentials: "include",
        headers: e
      });
      const n = await t.json();
      if (n.success && n.badges) {
        const e = n.badges;
        if (e.badges && e.badges.length > 0) {
          Logger.success(`Loaded ${e.badges.length} badge(s) from database`);
          const t = document.querySelector(".profile-dropdown-name");
          if (!t) {
            Logger.warn("profile-dropdown-name disappeared after fetch, re-waiting...");
            NotificationSystemV2.waitForElement(".profile-dropdown-name", () => {
              NotificationSystemV2.displayUserBadge(e);
            });
            return;
          }
          NotificationSystemV2.displayUserBadge(e);
        } else {
          Logger.log("No badges awarded yet");
        }
      } else {
        Logger.log("No badge data from API");
      }
    } catch (e) {
      NotificationSystemV2._badgesLoaded = false;
      Logger.error("Failed to load badges:", e.message);
    }
  },
  createBadgeSvg: (e, t) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    n.setAttribute("width", "28");
    n.setAttribute("height", "28");
    n.setAttribute("viewBox", "0 0 24 24");
    n.style.display = "block";
    n.style.width = "100%";
    n.style.height = "100%";
    switch (e) {
     case "official":
      n.innerHTML = `<defs>\n                    <linearGradient id="bgGrad-official" x1="0%" y1="0%" x2="100%" y2="100%">\n                        <stop offset="0%" stop-color="#FF8A5C" />\n                        <stop offset="100%" stop-color="#FF5722" />\n                    </linearGradient>\n                    <radialGradient id="outerGlow-official" cx="50%" cy="50%" r="50%">\n                        <stop offset="60%" stop-color="#FF7A42" stop-opacity="0.2" />\n                        <stop offset="100%" stop-color="#FF7A42" stop-opacity="0" />\n                    </radialGradient>\n                    <linearGradient id="edgeHighlight-official" x1="50%" y1="0%" x2="50%" y2="100%">\n                        <stop offset="0%" stop-color="white" stop-opacity="0.8" />\n                        <stop offset="50%" stop-color="white" stop-opacity="0" />\n                        <stop offset="100%" stop-color="white" stop-opacity="0.3" />\n                    </linearGradient>\n                    <radialGradient id="lensShine-official" cx="50%" cy="30%" r="50%" fx="50%" fy="20%">\n                        <stop offset="0%" stop-color="white" stop-opacity="0.5" />\n                        <stop offset="100%" stop-color="white" stop-opacity="0" />\n                    </radialGradient>\n                </defs>\n                <g class="badge-content">\n                    <circle cx="12" cy="12" r="9" fill="url(#outerGlow-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="7" fill="url(#bgGrad-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="7" fill="url(#lensShine-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="6.75" stroke="url(#edgeHighlight-official)" stroke-width="0.8" stroke-opacity="0.6" fill="none"/>\n                    <path d="M8 12L10 14L15 9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                </g>`;
      break;

     case "support_team":
      n.innerHTML = `\n                    <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" fill="${t}"/>\n                    <path d="M12 2L20 5V11C20 13 19 15 17 17L12 2V2Z" fill="white" fill-opacity="0.1"/>\n                    <path d="M9 11L11 13L15 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                `;
      break;

     case "platinum_elite":
      n.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.03"/>\n                    <path d="M6 4L12 9V21L18 4H6Z" fill="black" fill-opacity="0.05"/>\n                    <path d="M12 4V21" stroke="black" stroke-width="0.6" stroke-opacity="0.1"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21M9 9L12 21L15 9" stroke="black" stroke-width="0.5" stroke-linejoin="round"/>\n                `;
      break;

     case "diamond_partner":
      n.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.05"/>\n                    <path d="M12 21L9 9L12 4L15 9L12 21Z" fill="white" fill-opacity="0.2"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#003538" stroke-width="0.6" stroke-opacity="0.8"/>\n                `;
      break;

     case "bronze_partner":
      n.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M12 21L9 9L12 4V21Z" fill="black" fill-opacity="0.15"/>\n                    <path d="M12 21L15 9L12 4V21Z" fill="white" fill-opacity="0.1"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#2a1604" stroke-width="0.6" stroke-opacity="0.6"/>\n                `;
      break;

     case "verified":
      n.innerHTML = `\n                    <circle cx="12" cy="12" r="11" fill="${t}"/>\n                    <path d="M9 12.5L11.5 15L17 8.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                `;
      break;

     case "solis_core":
      n.innerHTML = `<defs>\n                    <linearGradient id="g-7" x1="0%" y1="0%" x2="100%" y2="100%">\n                        <stop offset="0%" stop-color="#ef4444" />\n                        <stop offset="100%" stop-color="#f87171" />\n                    </linearGradient>\n                </defs>\n                <path d="M12 1L14.47 3.94L18.27 3.23L19.33 6.94L23.08 7.73L21.84 11.44L24 14.5L20.92 16.71L20.67 20.52L16.89 21.05L14.93 24L12 22.67L9.07 24L7.11 21.05L3.33 20.52L3.08 16.71L0 14.5L2.16 11.44L0.92 7.73L4.67 6.94L5.73 3.23L9.53 3.94L12 1Z" fill="url(#g-7)" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>\n                <path d="M8.5 12.5L11 15L16.5 9.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      break;

     default:
      n.innerHTML = `<circle cx="12" cy="12" r="4" fill="${t}"/>`;
    }
    return n;
  },
  displayUserBadge: e => {
    if (!e || !e.badges || e.badges.length === 0) return;
    const t = document.querySelector(".profile-dropdown-name");
    if (!t) return;
    if (!document.getElementById("badge-tooltip-styles")) {
      const e = document.createElement("style");
      e.id = "badge-tooltip-styles";
      e.textContent = `\n                #badge-global-tooltip {\n                    position: fixed;\n                    background: #6b7280;\n                    color: #fff;\n                    padding: 3px 7px;\n                    border-radius: 4px;\n                    font-size: 10px;\n                    font-weight: 500;\n                    white-space: nowrap;\n                    z-index: 99999999;\n                    pointer-events: none;\n                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);\n                    opacity: 0;\n                    transition: opacity 0.15s ease;\n                    font-family: 'Plus Jakarta Sans', sans-serif;\n                }\n            `;
      document.head.appendChild(e);
      const t = document.createElement("div");
      t.id = "badge-global-tooltip";
      document.body.appendChild(t);
    }
    const n = t.querySelectorAll(".user-badge");
    n.forEach(e => e.remove());
    t.style.display = "flex";
    t.style.alignItems = "center";
    t.style.gap = "8px";
    const i = document.createElement("div");
    i.className = "badge-container";
    i.style.cssText = `\n            display: flex;\n            align-items: center;\n            gap: 4px;\n            flex-shrink: 0;\n        `;
    e.badges.slice(0, 2).forEach(e => {
      const t = e.badge_info;
      if (!t || !t.name) return;
      const n = document.createElement("div");
      n.className = "user-badge";
      n.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));cursor:pointer;flex-shrink:0;`;
      const o = NotificationSystemV2.createBadgeSvg(e.badge_type, t.color);
      n.appendChild(o);
      const a = e.badge_tier || t.tier || "Special";
      const s = `${t.name} • ${a}`;
      n.addEventListener("mouseenter", e => {
        const t = document.getElementById("badge-global-tooltip");
        if (!t) return;
        t.textContent = s;
        const i = n.getBoundingClientRect();
        t.style.opacity = "0";
        t.style.display = "block";
        const o = t.offsetWidth;
        t.style.left = i.left + i.width / 2 - o / 2 + "px";
        t.style.top = i.top - t.offsetHeight - 6 + "px";
        t.style.opacity = "1";
      });
      n.addEventListener("mouseleave", () => {
        const e = document.getElementById("badge-global-tooltip");
        if (e) e.style.opacity = "0";
      });
      i.appendChild(n);
    });
    t.appendChild(i);
  },
  setupNotificationHandlers: () => {
    const e = document.getElementById("bellBtn") || document.querySelector(".bell-btn");
    const t = document.getElementById("notificationsDropdown");
    const n = document.getElementById("markAsRead");
    const i = document.getElementById("dropdownNotifications");
    if (e && t) {
      e.addEventListener("click", e => {
        e.stopPropagation();
        const n = t.classList.contains("open");
        NotificationSystemV2.closeAllDropdowns();
        if (!n) {
          t.classList.add("open");
          NotificationSystemV2.clearUnreadStatus();
          if (typeof syncNotifBellVisibility === "function") {
            syncNotifBellVisibility(false);
          }
        }
      });
    }
    if (i && !i.dataset.v2Bound) {
      i.dataset.v2Bound = "1";
      i.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openNotificationsFromProfile === "function") {
          openNotificationsFromProfile();
        } else if (t) {
          NotificationSystemV2.closeAllDropdowns();
          document.getElementById("notifWrapper")?.classList.add("is-visible");
          t.classList.add("open");
        }
      });
    }
    document.addEventListener("click", () => NotificationSystemV2.closeAllDropdowns());
    if (n) {
      n.addEventListener("click", e => {
        e.preventDefault();
        NotificationSystemV2.clearUnreadStatus();
      });
    }
  },
  handleWebSocketMessage: e => {
    switch (e.type) {
     case "notification":
      NotificationSystemV2.addNotification(e.data);
      break;

     case "notification:read":
      NotificationSystemV2.clearUnreadStatus();
      break;

     default:
      break;
    }
  },
  addNotification: e => {
    if (!e || typeof e !== "object") {
      Logger.error("Invalid notification object");
      return null;
    }
    const t = {
      id: e.id || Date.now(),
      title: escapeHtml(String(e.title || "Notification").substring(0, 100)),
      message: escapeHtml(String(e.message || "New notification").substring(0, 500)),
      icon: e.icon || "info",
      timestamp: e.timestamp || (new Date).toISOString(),
      read: e.read === true,
      priority: e.priority || "normal"
    };
    const n = [ "check", "info", "warning", "error", "default" ];
    if (!n.includes(t.icon)) t.icon = "default";
    NotificationSystemV2.state.notifications.unshift(t);
    NotificationSystemV2.state.unreadCount++;
    if (NotificationSystemV2.state.notifications.length > 50) {
      NotificationSystemV2.state.notifications = NotificationSystemV2.state.notifications.slice(0, 50);
    }
    NotificationSystemV2.save();
    NotificationSystemV2.updateDisplay();
    Logger.success(`Notification added: ${t.title}`);
    return t;
  },
  updateDisplay: () => {
    const e = document.getElementById("bellBtn");
    const t = NotificationSystemV2.state.unreadCount > 0;
    if (e) {
      if (t) {
        e.classList.add("has-unread");
      } else {
        e.classList.remove("has-unread");
      }
    }
    if (typeof syncNotifBellVisibility === "function") {
      syncNotifBellVisibility(t);
    } else {
      const e = document.getElementById("notifWrapper");
      if (e) {
        e.classList.toggle("is-visible", t);
        e.setAttribute("aria-hidden", t ? "false" : "true");
      }
      const n = document.getElementById("dropdownNotifBadge");
      if (n) {
        if (t) {
          n.hidden = false;
          const e = NotificationSystemV2.state.unreadCount;
          n.textContent = e > 9 ? "9+" : String(e);
        } else {
          n.hidden = true;
        }
      }
    }
    NotificationSystemV2.renderList();
  },
  renderList: () => {
    const e = document.getElementById("notificationsList");
    if (!e) {
      console.warn("notificationsList container not found in DOM!");
      return;
    }
    while (e.firstChild) e.removeChild(e.firstChild);
    if (NotificationSystemV2.state.notifications.length === 0) {
      const t = document.createElement("div");
      t.style.cssText = "padding: 20px; text-align: center; color: #718096;";
      safeSetText(t, "No notifications");
      e.appendChild(t);
      return;
    }
    NotificationSystemV2.state.notifications.forEach((t, n) => {
      const i = document.createElement("div");
      i.className = "notif-item";
      const o = document.createElement("div");
      o.className = "notif-icon";
      const a = document.createElement("svg");
      a.setAttribute("width", "18");
      a.setAttribute("height", "18");
      a.setAttribute("viewBox", "0 0 24 24");
      a.setAttribute("fill", "none");
      a.setAttribute("stroke", "currentColor");
      a.setAttribute("stroke-linecap", "round");
      a.setAttribute("stroke-linejoin", "round");
      a.innerHTML = NotificationSystemV2.getIcon(t.icon);
      o.appendChild(a);
      const s = document.createElement("div");
      s.className = "notif-content";
      const r = document.createElement("div");
      r.className = "notif-sender";
      safeSetText(r, t.title);
      const c = document.createElement("div");
      c.className = "notif-message";
      safeSetText(c, t.message);
      const l = document.createElement("div");
      l.className = "notif-time";
      safeSetText(l, NotificationSystemV2.formatTime(t.timestamp));
      s.appendChild(r);
      s.appendChild(c);
      s.appendChild(l);
      i.appendChild(o);
      i.appendChild(s);
      e.appendChild(i);
    });
  },
  getIcon: e => {
    const t = {
      check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
      default: '<circle cx="12" cy="12" r="10"></circle>'
    };
    return t[e] || t["default"];
  },
  formatTime: e => {
    const t = typeof e === "string" ? new Date(e) : e;
    const n = new Date;
    const i = n - t;
    const o = Math.floor(i / 1e3);
    const a = Math.floor(o / 60);
    const s = Math.floor(a / 60);
    const r = Math.floor(s / 24);
    if (o < 60) return "just now";
    if (a < 60) return `${a}m ago`;
    if (s < 24) return `${s}h ago`;
    if (r < 7) return `${r}d ago`;
    return t.toLocaleDateString();
  },
  clearUnreadStatus: () => {
    NotificationSystemV2.state.unreadCount = 0;
    NotificationSystemV2.state.notifications.forEach(e => e.read = true);
    NotificationSystemV2.save();
    NotificationSystemV2.updateDisplay();
    Logger.log("Unread status cleared");
  },
  closeAllDropdowns: () => {
    const e = document.getElementById("notificationsDropdown");
    if (e) e.classList.remove("open");
    const t = document.getElementById("profileDropdown");
    if (t) t.classList.remove("open");
    const n = NotificationSystemV2.state.unreadCount > 0;
    if (typeof syncNotifBellVisibility === "function") {
      syncNotifBellVisibility(n);
    }
  },
  save: () => {
    StorageManager.save("notificationSystem_v2", {
      notifications: NotificationSystemV2.state.notifications,
      unreadCount: NotificationSystemV2.state.unreadCount
    });
  },
  scheduleCleanup: () => {
    setInterval(() => {
      const e = Date.now() - 7 * 24 * 60 * 60 * 1e3;
      const t = NotificationSystemV2.state.notifications.length;
      NotificationSystemV2.state.notifications = NotificationSystemV2.state.notifications.filter(t => {
        const n = new Date(t.timestamp).getTime();
        return n > e;
      });
      if (NotificationSystemV2.state.notifications.length < t) {
        Logger.log(`Cleaned up ${t - NotificationSystemV2.state.notifications.length} old notifications`);
        NotificationSystemV2.save();
      }
    }, 864e5);
  }
};

function initWhenReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      NotificationSystemV2.init();
    });
  } else {
    NotificationSystemV2.init();
  }
}

initWhenReady();

window.notificationSystem = {
  add: e => NotificationSystemV2.addNotification(e),
  clearUnread: () => NotificationSystemV2.clearUnreadStatus(),
  closeDropdowns: () => NotificationSystemV2.closeAllDropdowns(),
  getState: () => ({
    ...NotificationSystemV2.state
  }),
  getStorageSize: () => StorageManager.getSize("notificationSystem_v2"),
  isWebSocketConnected: () => WebSocketManager.connected,
  testNotification: () => NotificationSystemV2.addNotification({
    title: "Test Notification",
    message: "This is a test notification",
    icon: "info"
  }),
  fetchUserBadges: async e => {
    if (!window.currentUser || String(window.currentUser.id) !== String(e)) {
      return null;
    }
    return notificationSystem.fetchCurrentUserBadges();
  },
  fetchCurrentUserBadges: async () => {
    try {
      const e = {
        "Content-Type": "application/json"
      };
      if (typeof getAuthHeaders === "function") Object.assign(e, getAuthHeaders());
      const t = await fetch("/api/badges/current", {
        method: "POST",
        credentials: "include",
        headers: e
      });
      const n = await t.json();
      if (n.success) {
        return n.badges;
      }
      return null;
    } catch (e) {
      console.error("Failed to fetch current user badges:", e);
      return null;
    }
  },
  sendFirstLoginNotification: async () => {
    try {
      const e = await fetch("/api/badges/first-login-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const t = await e.json();
      if (t.success && t.notification) {
        notificationSystem.add(t.notification);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to send first login notification:", e);
      return false;
    }
  },
  displayUserBadge: e => NotificationSystemV2.displayUserBadge(e),
  loadUserBadges: async () => NotificationSystemV2.loadUserBadges()
};

function addVideoBadge() {
  const e = document.querySelector('[data-tab="library"]');
  if (e && !e.querySelector(".video-new-badge")) {
    const t = document.createElement("span");
    t.className = "video-new-badge";
    t.style.cssText = `\n            position: absolute;\n            top: -4px;\n            right: -4px;\n            width: 10px;\n            height: 10px;\n            background: #ef4444;\n            border-radius: 50%;\n            border: 2px solid white;\n        `;
    e.style.position = "relative";
    e.appendChild(t);
  }
  const t = document.querySelector('[data-target="clips"]');
  if (t && !t.querySelector(".video-new-badge")) {
    const e = document.createElement("span");
    e.className = "video-new-badge";
    e.style.cssText = `\n            position: absolute;\n            top: -8px;\n            right: -8px;\n            width: 12px;\n            height: 12px;\n            background: #ef4444;\n            border-radius: 50%;\n            border: 2px solid white;\n        `;
    t.style.position = "relative";
    t.appendChild(e);
  }
}

function removeBadges() {
  const e = document.querySelectorAll(".video-new-badge");
  e.forEach(e => {
    e.remove();
  });
}

function attachBadgeClickHandlers() {
  const e = document.querySelector('[data-tab="library"]');
  const t = document.querySelector('[data-target="clips"]');
  if (e) {
    e.addEventListener("click", removeBadges);
  }
  if (t) {
    t.addEventListener("click", removeBadges);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachBadgeClickHandlers);
} else {
  attachBadgeClickHandlers();
}

if (typeof window !== "undefined") {
  if (window.videoGenerationSocket) {
    window.videoGenerationSocket.off("video_generated");
    window.videoGenerationSocket.on("video_generated", e => {
      addVideoBadge();
      if (typeof updateStorageBadgeDisplay === "function") {
        setTimeout(() => updateStorageBadgeDisplay(), 1e3);
      }
      if (window.clipsStudio && typeof window.clipsStudio.loadLibraryItems === "function") {
        setTimeout(() => window.clipsStudio.loadLibraryItems(), 1e3);
      }
    });
  }
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (window.solisWSClient) {
        window.solisWSClient.on("video_generated", e => {
          addVideoBadge();
          if (typeof updateStorageBadgeDisplay === "function") {
            setTimeout(() => updateStorageBadgeDisplay(), 1e3);
          }
        });
        window.solisWSClient.on("storage_update", e => {
          if (typeof updateStorageBadgeDisplay === "function") {
            updateStorageBadgeDisplay();
          }
        });
        window.solisWSClient.on("follower_notification", e => {
          if (typeof window.notificationSystem?.add === "function") {
            window.notificationSystem.add({
              title: e.title || "New Follower",
              message: e.message || "Someone is now following you",
              icon: "check"
            });
          }
        });
      }
    }, 500);
  });
}

function hexToRgb(e) {
  const t = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e);
  return t ? `${parseInt(t[1], 16)}, ${parseInt(t[2], 16)}, ${parseInt(t[3], 16)}` : "255, 255, 255";
}

Logger.success("Professional Notification System v2 loaded");
