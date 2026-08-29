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
    const i = e.toLowerCase();
    if (i.includes("javascript:") || i.includes("data:") || i.includes("vbscript:")) return false;
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

function safeSetImage(e, t, i = "") {
  if (!e) return;
  if (!isValidImageUrl(t)) {
    console.warn("Invalid image URL");
    return;
  }
  const o = document.createElement("img");
  o.setAttribute("src", t);
  o.setAttribute("alt", escapeHtml(i));
  o.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 50%;";
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
  e.appendChild(o);
}

function validateUserObject(e) {
  if (!e || typeof e !== "object") return {
    valid: false
  };
  const t = e.id || e.user_id || e.sub;
  const i = e.email || e.name || e.displayName;
  if (t || i) {
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
  const i = validateUserObject(t);
  if (!i || !i.valid) {
    console.warn("Invalid user object");
    return;
  }
  const o = i.user;
  const n = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(o) : o.picture || o.avatar || null;
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
  if (n && typeof n === "string" && isValidImageUrl(n)) {
    safeSetImage(e, n, "User Avatar");
  }
}

function attachNotificationEventListeners() {
  const e = notificationSystem.bellElement;
  const t = notificationSystem.notificationsDropdown;
  e.addEventListener("click", e => {
    e.stopPropagation();
    const i = t.classList.contains("open");
    closeAllDropdowns();
    if (!i) {
      t.classList.add("open");
      clearUnreadStatus();
    }
  });
  const i = document.getElementById("dropdownNotifications");
  if (i && !i.dataset.bound) {
    i.dataset.bound = "1";
    i.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openNotificationsFromProfile();
    });
  }
  document.addEventListener("click", e => {
    if (e.target?.closest?.("#notificationsDropdown, #profileDropdown, #bellBtn, #profileAvatarBtn, #notifWrapper, #profileDropdownWr")) {
      return;
    }
    closeAllDropdowns();
  });
  const o = document.getElementById("markAsRead");
  if (o) {
    o.addEventListener("click", e => {
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
  const i = notificationSystem.unreadCount > 0 || typeof NotificationSystemV2 !== "undefined" && NotificationSystemV2.state?.unreadCount > 0;
  if (typeof syncNotifBellVisibility === "function") {
    syncNotifBellVisibility(!!i);
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
    return String(e).substring(0, t);
  };
  const t = {
    id: Date.now(),
    title: sanitizeString(e.title || "Notification", 100),
    message: sanitizeString(e.message || "New notification", 500),
    icon: e.icon || "info",
    timestamp: e.timestamp || new Date,
    read: e.read === true
  };
  const i = [ "check", "info", "warning", "error", "default" ];
  if (!i.includes(t.icon)) {
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
  const {videoTitle: t = "Video Generated", videoUrl: i = "#", thumbnailUrl: o = null, projectId: n = null, message: a = null} = e || {};
  const s = String(t || "Video Generated").trim() || "Video Generated";
  const r = String(a || `${s} is ready.`).trim();
  const c = n != null ? String(n).trim() : "";
  try {
    const e = {
      title: "Solis AI",
      message: r,
      icon: "solis",
      priority: "high",
      sender: "Solis AI",
      official: true,
      kind: "video_ready",
      videoTitle: s,
      thumbnailUrl: o || null,
      videoUrl: i && i !== "#" ? i : null,
      projectId: c || null
    };
    if (typeof NotificationSystemV2?.addNotification === "function") {
      NotificationSystemV2.addNotification(e);
    } else if (typeof addNotification === "function") {
      addNotification(e);
    }
  } catch (e) {
    console.warn("[NotifSys] bell add failed:", e);
  }
  try {
    const e = window.__solisShowNotification || window.showNotification;
    if (typeof e === "function") {
      e(r, "success");
    }
  } catch (e) {}
  return true;
}

function showVideoGenerated(e = {}) {
  return showVideoGeneratedNotification(e);
}

function showVideoGeneratedOverlay() {
  return;
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
  const i = document.getElementById("dropdownNotifBadge");
  const o = notificationSystem.unreadCount || (typeof NotificationSystemV2 !== "undefined" ? NotificationSystemV2.state?.unreadCount || 0 : 0);
  const n = typeof e === "boolean" ? e : o > 0;
  const a = !!document.getElementById("notificationsDropdown")?.classList.contains("open");
  const s = isMobileNotifChrome() ? n || a : true;
  if (t) {
    t.classList.toggle("is-visible", s);
    t.setAttribute("aria-hidden", s ? "false" : "true");
  }
  if (i) {
    if (n && o > 0) {
      i.hidden = false;
      i.textContent = o > 9 ? "9+" : String(o);
    } else {
      i.hidden = true;
      i.textContent = "";
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
    const i = document.createElement("div");
    i.className = "notif-item";
    const o = document.createElement("div");
    o.className = "notif-icon";
    const n = document.createElement("svg");
    n.setAttribute("width", "18");
    n.setAttribute("height", "18");
    n.setAttribute("viewBox", "0 0 24 24");
    n.setAttribute("fill", "none");
    n.setAttribute("stroke", "currentColor");
    n.setAttribute("stroke-linecap", "round");
    n.setAttribute("stroke-linejoin", "round");
    n.innerHTML = getNotificationIcon(t.icon);
    o.appendChild(n);
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
    i.appendChild(o);
    i.appendChild(a);
    e.appendChild(i);
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
  const i = t - e;
  const o = Math.floor(i / 1e3);
  const n = Math.floor(o / 60);
  const a = Math.floor(n / 60);
  const s = Math.floor(a / 24);
  if (o < 60) return "just now";
  if (n < 60) return `${n}m ago`;
  if (a < 24) return `${a}h ago`;
  if (s < 7) return `${s}d ago`;
  return e.toLocaleDateString();
}

function updateProfileInfo() {
  const e = document.getElementById("profileNameDisplay");
  const t = document.getElementById("profilePlanDisplay");
  const i = document.getElementById("profileAvatarDisplay");
  let o = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      o = window.currentUser;
    } else {
      const e = localStorage.getItem("currentUser");
      if (e) {
        const t = e.trim();
        if (t.startsWith("{") && t.endsWith("}")) {
          o = JSON.parse(e);
        }
      }
    }
  } catch (e) {
    console.error("Error reading user data:", e);
    o = null;
  }
  const n = validateUserObject(o);
  if (!n || !n.valid) {
    console.warn("Invalid user object");
    return;
  }
  const a = n.user;
  const s = escapeHtml((a.name || a.displayName || a.email || "User").toString().substring(0, 100));
  const r = escapeHtml((a.tier || a.plan || "Free Plan").toString().toUpperCase().substring(0, 50));
  const c = a.picture || a.avatar || null;
  if (e) {
    safeSetText(e, s);
  }
  if (t) {
    safeSetText(t, r);
  }
  if (i && c && typeof c === "string") {
    if (isValidImageUrl(c)) {
      safeSetImage(i, c, s);
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
      const i = {
        version: 2,
        timestamp: Date.now(),
        data: t
      };
      localStorage.setItem(e, JSON.stringify(i));
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
      const i = JSON.parse(t);
      if (!i || typeof i !== "object") {
        Logger.warn("Invalid payload structure");
        return null;
      }
      const o = Date.now() - i.timestamp;
      if (o > 30 * 24 * 60 * 60 * 1e3) {
        Logger.warn("Data is stale, clearing");
        localStorage.removeItem(e);
        return null;
      }
      Logger.success(`Storage loaded: ${e}`);
      return i.data;
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
    try {
      removeBadges?.();
    } catch (e) {}
    try {
      hideVideoGeneratedOverlay?.();
    } catch (e) {}
    NotificationSystemV2.waitForElement(".profile-dropdown-name", () => {
      Logger.log("profile-dropdown-name found, loading badges...");
      NotificationSystemV2.loadUserBadges();
    });
    Logger.success("Notification system v2 fully initialized");
  },
  waitForElement: (e, t) => {
    const i = document.querySelector(e);
    if (i) {
      t(i);
      return;
    }
    const o = new MutationObserver(() => {
      const i = document.querySelector(e);
      if (i) {
        o.disconnect();
        t(i);
      }
    });
    o.observe(document.body, {
      childList: true,
      subtree: true
    });
  },
  loadUserBadges: async (e = false) => {
    if (!e && NotificationSystemV2._badgesLoaded) return;
    NotificationSystemV2._badgesLoaded = true;
    try {
      const e = (window.API_BASE_URL || "https://api.solisai.video/api").replace(/\/$/, "");
      const t = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      if (typeof getAuthHeaders === "function") Object.assign(t, getAuthHeaders());
      const i = await fetch(`${e}/badges/current`, {
        method: "POST",
        credentials: "include",
        headers: t,
        body: "{}"
      });
      const o = await i.json().catch(() => ({}));
      if (o.success && o.badges) {
        const e = o.badges;
        const t = e.badges || [];
        if (t.length > 0) {
          Logger.success(`Loaded ${t.length} badge(s) from database`);
          const i = document.querySelector(".profile-dropdown-name");
          if (!i) {
            Logger.warn("profile-dropdown-name disappeared after fetch, re-waiting...");
            NotificationSystemV2._badgesLoaded = false;
            NotificationSystemV2.waitForElement(".profile-dropdown-name", () => {
              NotificationSystemV2.loadUserBadges(true);
            });
            return;
          }
          NotificationSystemV2.displayUserBadge(e);
        } else {
          Logger.log("No badges awarded yet");
        }
      } else {
        Logger.log("No badge data from API");
        NotificationSystemV2._badgesLoaded = false;
      }
    } catch (e) {
      NotificationSystemV2._badgesLoaded = false;
      Logger.error("Failed to load badges:", e.message);
    }
  },
  createBadgeSvg: (e, t) => {
    if (window.SolisBadges?.createSvg) {
      return window.SolisBadges.createSvg(e, t, 28);
    }
    const i = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    i.setAttribute("width", "28");
    i.setAttribute("height", "28");
    i.setAttribute("viewBox", "0 0 24 24");
    return i;
  },
  displayUserBadge: e => {
    if (!e || !e.badges || e.badges.length === 0) return;
    const t = document.getElementById("dropdownUserName") || document.querySelector(".profile-dropdown-profile .profile-dropdown-name") || document.querySelector(".profile-dropdown-info .profile-dropdown-name");
    if (!t) return;
    t.style.display = "flex";
    t.style.alignItems = "center";
    t.style.gap = "6px";
    t.style.flexWrap = "nowrap";
    let i = document.getElementById("dropdown-badges") || t.querySelector(".badge-container");
    if (!i) {
      i = document.createElement("span");
      i.className = "badge-container";
      i.id = "dropdown-badges";
      i.style.cssText = "display:inline-flex;align-items:center;gap:4px;flex-shrink:0;";
      const e = t.querySelector(".username-text");
      if (e) {
        e.insertAdjacentElement("afterend", i);
      } else {
        t.appendChild(i);
      }
    }
    if (window.SolisBadges?.renderList) {
      window.SolisBadges.renderList(i, e.badges, 22);
      return;
    }
    i.innerHTML = "";
    const o = [ ...e.badges ].sort((e, t) => {
      const rank = e => {
        const t = String(e || "").toLowerCase();
        if (t === "business" || t === "official") return 0;
        if (t === "verified") return 1;
        if (t === "team" || t === "solis_core" || t === "support_team") return 50;
        return 20;
      };
      return rank(e?.badge_type) - rank(t?.badge_type);
    }).slice(0, 2);
    o.forEach(e => {
      const t = document.createElement("span");
      t.className = "user-badge solis-user-badge";
      t.style.cssText = "display:inline-flex;width:22px;height:22px;";
      const o = NotificationSystemV2.createBadgeSvg(e.badge_type, null);
      t.appendChild(o);
      i.appendChild(t);
    });
  },
  setupNotificationHandlers: () => {
    const e = document.getElementById("bellBtn") || document.querySelector(".bell-btn");
    const t = document.getElementById("notificationsDropdown");
    const i = document.getElementById("markAsRead");
    const o = document.getElementById("dropdownNotifications");
    if (e && t && !e.dataset.v2BellBound) {
      e.dataset.v2BellBound = "1";
      e.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        const i = t.classList.contains("open");
        NotificationSystemV2.closeAllDropdowns();
        if (!i) {
          t.classList.add("open");
          if (typeof syncNotifBellVisibility === "function") {
            syncNotifBellVisibility(true);
          }
        }
      });
    }
    if (o && !o.dataset.v2Bound) {
      o.dataset.v2Bound = "1";
      o.addEventListener("click", e => {
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
    if (!document.documentElement.dataset.v2NotifDocBound) {
      document.documentElement.dataset.v2NotifDocBound = "1";
      document.addEventListener("click", e => {
        const t = e.target;
        if (t?.closest?.("#notificationsDropdown, #profileDropdown, #bellBtn, #profileAvatarBtn, #notifWrapper, #profileDropdownWr")) {
          return;
        }
        NotificationSystemV2.closeAllDropdowns();
      });
    }
    if (i && !i.dataset.v2Bound) {
      i.dataset.v2Bound = "1";
      i.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
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
    const sanitizeUrl = e => {
      const t = String(e || "").trim();
      if (!t || t === "#") return null;
      if (/^(https?:|blob:|\/)/i.test(t)) return t.substring(0, 800);
      return null;
    };
    const t = {
      id: e.id || Date.now(),
      title: String(e.title || e.sender || "Solis AI").substring(0, 100),
      message: String(e.message || "New notification").substring(0, 500),
      icon: e.icon || "solis",
      timestamp: e.timestamp || (new Date).toISOString(),
      read: e.read === true,
      priority: e.priority || "normal",
      sender: String(e.sender || "Solis AI").substring(0, 60),
      official: e.official === true || e.icon === "solis" || e.kind === "video_ready",
      kind: String(e.kind || "").substring(0, 40),
      videoTitle: e.videoTitle ? String(e.videoTitle).substring(0, 120) : null,
      thumbnailUrl: sanitizeUrl(e.thumbnailUrl),
      videoUrl: sanitizeUrl(e.videoUrl),
      projectId: e.projectId ? String(e.projectId).substring(0, 120) : null
    };
    const i = [ "check", "info", "warning", "error", "default", "solis" ];
    if (!i.includes(t.icon)) t.icon = "solis";
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
      const i = document.getElementById("dropdownNotifBadge");
      if (i) {
        if (t) {
          i.hidden = false;
          const e = NotificationSystemV2.state.unreadCount;
          i.textContent = e > 9 ? "9+" : String(e);
        } else {
          i.hidden = true;
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
    try {
      e.querySelectorAll("video").forEach(e => {
        try {
          e.pause();
        } catch (e) {}
      });
    } catch (e) {}
    while (e.firstChild) e.removeChild(e.firstChild);
    if (NotificationSystemV2.state.notifications.length === 0) {
      const t = document.createElement("div");
      t.style.cssText = "padding: 28px 20px; text-align: center; color: #718096;";
      safeSetText(t, "No notifications");
      e.appendChild(t);
      return;
    }
    const t = (window.API_BASE_URL || "").toString().replace(/\/$/, "") || (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1" ? `http://${window.location.hostname}:5500/api` : "https://api.solisai.video/api");
    NotificationSystemV2.state.notifications.forEach(i => {
      const o = document.createElement("div");
      o.className = "notif-item" + (i.kind === "video_ready" || i.projectId || i.thumbnailUrl || i.videoUrl ? " notif-item--media" : "");
      if (i.projectId) o.dataset.projectId = String(i.projectId);
      const n = document.createElement("div");
      n.className = "notif-icon" + (i.icon === "solis" || i.official ? " notif-icon--solis" : "");
      if (i.icon === "solis" || i.official) {
        const e = document.createElement("img");
        e.className = "notif-solis-logo";
        e.src = "/assets/favicon.png";
        e.alt = "Solis AI";
        e.draggable = false;
        e.onerror = () => {
          e.onerror = null;
          e.src = "/assets/solisailogo.png";
        };
        n.appendChild(e);
      } else {
        const e = document.createElement("svg");
        e.setAttribute("width", "18");
        e.setAttribute("height", "18");
        e.setAttribute("viewBox", "0 0 24 24");
        e.setAttribute("fill", "none");
        e.setAttribute("stroke", "currentColor");
        e.setAttribute("stroke-linecap", "round");
        e.setAttribute("stroke-linejoin", "round");
        e.innerHTML = NotificationSystemV2.getIcon(i.icon);
        n.appendChild(e);
      }
      const a = document.createElement("div");
      a.className = "notif-content";
      const s = document.createElement("div");
      s.className = "notif-head";
      const r = document.createElement("div");
      r.className = "notif-sender";
      safeSetText(r, i.sender || i.title || "Solis AI");
      s.appendChild(r);
      if (i.official) {
        const e = document.createElement("span");
        e.className = "notif-official-badge";
        e.setAttribute("aria-label", "Official");
        e.title = "Official";
        try {
          if (window.SolisBadges?.createSvg) {
            e.appendChild(window.SolisBadges.createSvg("official", null, 14));
          } else {
            e.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          }
        } catch (t) {
          e.textContent = "✓";
        }
        s.appendChild(e);
      }
      const c = document.createElement("div");
      c.className = "notif-message";
      safeSetText(c, i.message);
      const d = document.createElement("div");
      d.className = "notif-time";
      safeSetText(d, NotificationSystemV2.formatTime(i.timestamp));
      a.appendChild(s);
      a.appendChild(c);
      a.appendChild(d);
      const l = i.projectId ? String(i.projectId).trim() : "";
      const f = i.thumbnailUrl || (l ? `${t}/clips/poster/${encodeURIComponent(l)}` : null);
      let u = null;
      try {
        const e = l && window.LibraryPreviewMediaCache?.get?.(l, false);
        if (e?.objectUrl) u = e.objectUrl;
      } catch (e) {}
      if (!u && l && window.clipsStudio?.getLibraryPreviewVideoUrl) {
        try {
          u = window.clipsStudio.getLibraryPreviewVideoUrl(l, {
            bust: false
          });
        } catch (e) {}
      }
      if (!u && l) {
        u = `${t}/clips/preview/${encodeURIComponent(l)}/1`;
      }
      if (!u && i.videoUrl) u = i.videoUrl;
      if (f || u) {
        const e = document.createElement("div");
        e.className = "notif-media";
        if (u) {
          const t = document.createElement("video");
          t.className = "notif-media-video";
          t.muted = true;
          t.playsInline = true;
          t.setAttribute("playsinline", "");
          t.setAttribute("webkit-playsinline", "");
          t.preload = "metadata";
          t.loop = true;
          t.controls = false;
          if (f) t.poster = f;
          t.src = u;
          t.addEventListener("loadeddata", () => {
            e.classList.add("is-ready");
            t.play?.().catch(() => {});
          });
          t.addEventListener("error", () => {
            t.remove();
            if (f) {
              const t = document.createElement("img");
              t.className = "notif-media-thumb";
              t.src = f;
              t.alt = "";
              t.loading = "lazy";
              e.appendChild(t);
              e.classList.add("is-ready");
            }
          });
          e.appendChild(t);
        } else if (f) {
          const t = document.createElement("img");
          t.className = "notif-media-thumb";
          t.src = f;
          t.alt = "";
          t.loading = "lazy";
          t.onload = () => e.classList.add("is-ready");
          e.appendChild(t);
        }
        a.appendChild(e);
      }
      o.appendChild(n);
      o.appendChild(a);
      o.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        if (l && window.clipsStudio?.openLibraryPreviewWhenReady) {
          try {
            window.clipsStudio.openLibraryPreviewWhenReady(l, l);
          } catch (e) {}
          NotificationSystemV2.closeAllDropdowns?.();
        } else if (l && window.clipsStudio?.openLibraryPreview) {
          try {
            window.clipsStudio.openLibraryPreview(l, l, null, {
              fast: true
            });
          } catch (e) {}
          NotificationSystemV2.closeAllDropdowns?.();
        }
      });
      e.appendChild(o);
    });
  },
  getIcon: e => {
    const t = {
      check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
      default: '<circle cx="12" cy="12" r="10"></circle>',
      solis: ""
    };
    return t[e] || t["default"];
  },
  formatTime: e => {
    const t = typeof e === "string" ? new Date(e) : e;
    const i = new Date;
    const o = i - t;
    const n = Math.floor(o / 1e3);
    const a = Math.floor(n / 60);
    const s = Math.floor(a / 60);
    const r = Math.floor(s / 24);
    if (n < 60) return "just now";
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
    try {
      e?.querySelectorAll?.("video")?.forEach(e => {
        try {
          e.pause();
        } catch (e) {}
      });
    } catch (e) {}
    if (e) e.classList.remove("open");
    const t = document.getElementById("profileDropdown");
    if (t) t.classList.remove("open");
    const i = NotificationSystemV2.state.unreadCount > 0;
    if (typeof syncNotifBellVisibility === "function") {
      syncNotifBellVisibility(i);
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
        const i = new Date(t.timestamp).getTime();
        return i > e;
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

window.NotificationSystemV2 = NotificationSystemV2;

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
  showVideoGenerated: e => showVideoGeneratedNotification(e),
  showVideoGeneratedNotification: e => showVideoGeneratedNotification(e),
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
      const i = await t.json();
      if (i.success) {
        return i.badges;
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
  loadUserBadges: async e => NotificationSystemV2.loadUserBadges(!!e)
};

window.showVideoGenerated = showVideoGenerated;

window.showVideoGeneratedNotification = showVideoGeneratedNotification;

function addVideoBadge() {
  return;
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
