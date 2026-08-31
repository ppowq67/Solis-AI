const NOTIF_CONFIG = {
    VERSION: 2,
    STORAGE_KEY: 'notificationSystem_v2',
    MAX_NOTIFICATIONS: 50,
    STORAGE_CLEANUP_INTERVAL: 86400000, // 24 hours
    WS_RECONNECT_DELAY: 3000,
    WS_MAX_RECONNECT_DELAY: 30000,
    WS_PING_INTERVAL: 30000,
};

// ===== SECURITY UTILITIES =====
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return text.replace(/[&<>"'\/]/g, char => map[char] || char);
}

function isValidImageUrl(url) {
    if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
    try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) return false;
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:') || lowerUrl.includes('vbscript:')) return false;
        return true;
    } catch {
        return false;
    }
}

// Safe DOM text manipulation
function safeSetText(element, text) {
    if (element && typeof text === 'string') {
        element.textContent = text;
    }
}

// Safe DOM image manipulation
function safeSetImage(element, srcUrl, altText = '') {
    if (!element) return;
    if (!isValidImageUrl(srcUrl)) {
        console.warn('Invalid image URL');
        return;
    }
    
    // Create img tag safely
    const img = document.createElement('img');
    img.setAttribute('src', srcUrl);
    img.setAttribute('alt', escapeHtml(altText));
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
    
    // Clear old content
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    
    element.appendChild(img);
}

// Validate user object structure
function validateUserObject(userObj) {
    if (!userObj || typeof userObj !== 'object') return { valid: false };
    
    const hasId = userObj.id || userObj.user_id || userObj.sub;
    const hasIdentifier = userObj.email || userObj.name || userObj.displayName;
    
    if (hasId || hasIdentifier) {
        return { valid: true, user: userObj };
    }
    
    return { valid: false };
}

// Notification system state
let notificationSystem = {
    unreadCount: 0,
    notifications: [],
    bellElement: null,
    profileElement: null,
    notificationsDropdown: null,
    profileDropdown: null,
    initialized: false
};

// Initialize the notification system
function initializeNotificationSystem() {
    if (notificationSystem.initialized) return;


    notificationSystem.bellElement = document.getElementById('bellBtn');
    notificationSystem.profileElement = document.getElementById('profileAvatarBtn');
    notificationSystem.notificationsDropdown = document.getElementById('notificationsDropdown');

    if (!notificationSystem.bellElement || !notificationSystem.profileElement) {
        console.warn('Required notification elements not found');
        return;
    }


    attachNotificationEventListeners();
    loadNotificationsFromStorage();
    syncProfileButton();
    notificationSystem.initialized = true;

    syncProfileButton();
}

// Sync profile button to show Gmail icon for Google users
function syncProfileButton() {
    const profileAvatarBtn = document.getElementById('profileAvatarBtn');
    if (!profileAvatarBtn) return;

    let userObj = null;
    try {
        if (typeof window !== 'undefined' && window.currentUser) {
            userObj = window.currentUser;
        }
    } catch (err) {
        console.error('Error syncing profile:', err);
        userObj = null;
    }

    const validation = validateUserObject(userObj);
    if (!validation || !validation.valid) {
        console.warn('Invalid user object');
        return;
    }

    const user = validation.user;
    const userAvatar = typeof resolveAvatarUrl === 'function'
        ? resolveAvatarUrl(user)
        : (user.picture || user.avatar || null);

    while (profileAvatarBtn.firstChild) {
        profileAvatarBtn.removeChild(profileAvatarBtn.firstChild);
    }

    if (userAvatar && typeof userAvatar === 'string' && isValidImageUrl(userAvatar)) {
        safeSetImage(profileAvatarBtn, userAvatar, 'User Avatar');
    }
}

// Attach event listeners to notification UI
function attachNotificationEventListeners() {
    const bellBtn = notificationSystem.bellElement;
    const notifDropdown = notificationSystem.notificationsDropdown;

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
            notifDropdown.classList.add('open');
            clearUnreadStatus();
        }
    });

    const dropdownNotif = document.getElementById('dropdownNotifications');
    if (dropdownNotif && !dropdownNotif.dataset.bound) {
        dropdownNotif.dataset.bound = '1';
        dropdownNotif.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openNotificationsFromProfile();
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target?.closest?.('#notificationsDropdown, #profileDropdown, #bellBtn, #profileAvatarBtn, #notifWrapper, #profileDropdownWr')) {
            return;
        }
        closeAllDropdowns();
    });

    const markAsReadLink = document.getElementById('markAsRead');
    if (markAsReadLink) {
        markAsReadLink.addEventListener('click', (e) => {
            e.preventDefault();
            clearUnreadStatus();
        });
    }
}

// Close all open dropdowns
function closeAllDropdowns() {
    const notifDropdown = notificationSystem.notificationsDropdown;
    if (notifDropdown) notifDropdown.classList.remove('open');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileDropdown) profileDropdown.classList.remove('open');
    // Collapse live bell when nothing unread
    const unread = notificationSystem.unreadCount > 0
        || (typeof NotificationSystemV2 !== 'undefined' && NotificationSystemV2.state?.unreadCount > 0);
    if (typeof syncNotifBellVisibility === 'function') {
        syncNotifBellVisibility(!!unread);
    }
}

// Load notifications from localStorage
function loadNotificationsFromStorage() {
    try {
        const stored = localStorage.getItem('notificationSystem');
        if (stored) {
            const data = JSON.parse(stored);
            notificationSystem.notifications = data.notifications || [];
            notificationSystem.unreadCount = data.unreadCount || 0;
            updateNotificationDisplay();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Save notifications to localStorage
function saveNotificationsToStorage() {
    try {
        localStorage.setItem('notificationSystem', JSON.stringify({
            notifications: notificationSystem.notifications,
            unreadCount: notificationSystem.unreadCount
        }));
    } catch (error) {
        console.error('Error saving notifications:', error);
    }
}

// Add a new notification with input validation
function addNotification(notification) {
    if (!notification || typeof notification !== 'object') {
        console.error('Invalid notification object');
        return null;
    }

    const sanitizeString = (str, maxLen = 500) => {
        if (typeof str !== 'string') return '';
        return String(str).substring(0, maxLen);
    };

    const defaultNotification = {
        id: Date.now(),
        title: sanitizeString(notification.title || 'Notification', 100),
        message: sanitizeString(notification.message || 'New notification', 500),
        icon: notification.icon || 'info',
        timestamp: notification.timestamp || new Date(),
        read: notification.read === true,
    };

    const validIcons = ['check', 'info', 'warning', 'error', 'default'];
    if (!validIcons.includes(defaultNotification.icon)) {
        defaultNotification.icon = 'default';
    }

    notificationSystem.notifications.unshift(defaultNotification);
    notificationSystem.unreadCount++;

    if (notificationSystem.notifications.length > 50) {
        notificationSystem.notifications = notificationSystem.notifications.slice(0, 50);
    }

    saveNotificationsToStorage();
    updateNotificationDisplay();

    return defaultNotification;
}

// Show video generated notification
function showVideoGeneratedNotification(videoData = {}) {
    const {
        videoTitle = 'Video Generated',
        videoUrl = '#',
        thumbnailUrl = null,
        projectId = null,
        message = null,
    } = videoData || {};

    const title = String(videoTitle || 'Video Generated').trim() || 'Video Generated';
    const body = String(message || `${title} is ready.`).trim();
    const pid = projectId != null ? String(projectId).trim() : '';

    // Bell / dropdown (V2 is source of truth) — Solis AI branded + media
    try {
        const media = {
            title: 'Solis AI',
            message: body,
            icon: 'solis',
            priority: 'high',
            sender: 'Solis AI',
            official: true,
            kind: 'video_ready',
            videoTitle: title,
            thumbnailUrl: thumbnailUrl || null,
            videoUrl: (videoUrl && videoUrl !== '#') ? videoUrl : null,
            projectId: pid || null,
        };
        if (typeof NotificationSystemV2?.addNotification === 'function') {
            NotificationSystemV2.addNotification(media);
        } else if (typeof addNotification === 'function') {
            addNotification(media);
        }
    } catch (err) {
        console.warn('[NotifSys] bell add failed:', err);
    }

    // Soft toast only — no View/Close modal popup
    try {
        const toast = window.__solisShowNotification || window.showNotification;
        if (typeof toast === 'function') {
            toast(body, 'success');
        }
    } catch (_) { /* ignore */ }

    // Do NOT show videoGeneratedOverlay (user hated View Clip / Close popup)
    // Do NOT stamp red dots on nav-item.active — bell unread is enough
    return true;
}

// Alias for compatibility with video-generation-hook.js (which calls showVideoGenerated)
function showVideoGenerated(videoData = {}) {
    return showVideoGeneratedNotification(videoData);
}

// Show video generated overlay — disabled (use bell dropdown instead)
function showVideoGeneratedOverlay() {
    return;
}

// Hide video generated overlay
function hideVideoGeneratedOverlay() {
    const backdrop = document.getElementById('videoGeneratedBackdrop');
    const overlay = document.getElementById('videoGeneratedOverlay');

    if (backdrop) backdrop.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

// Update notification display
function updateNotificationDisplay() {
    const bellBtn = notificationSystem.bellElement;
    if (!bellBtn) return;

    const hasUnread = notificationSystem.unreadCount > 0;
    syncNotifBellVisibility(hasUnread);

    if (hasUnread) {
        bellBtn.classList.add('has-unread');
    } else {
        bellBtn.classList.remove('has-unread');
    }

    renderNotificationsList();
}

function isMobileNotifChrome() {
    return typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 768px)').matches
        : window.innerWidth <= 768;
}

function syncNotifBellVisibility(hasUnread) {
    const wrap = document.getElementById('notifWrapper')
        || document.querySelector('.notif-wrapper');
    const badge = document.getElementById('dropdownNotifBadge');
    const count = notificationSystem.unreadCount
        || (typeof NotificationSystemV2 !== 'undefined' ? (NotificationSystemV2.state?.unreadCount || 0) : 0);
    const unread = typeof hasUnread === 'boolean' ? hasUnread : count > 0;
    const dropdownOpen = !!document.getElementById('notificationsDropdown')?.classList.contains('open');
    // PC: bell always visible. Mobile: only when unread / dropdown open.
    const show = isMobileNotifChrome() ? (unread || dropdownOpen) : true;

    if (wrap) {
        wrap.classList.toggle('is-visible', show);
        wrap.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (badge) {
        if (unread && count > 0) {
            badge.hidden = false;
            badge.textContent = count > 9 ? '9+' : String(count);
        } else {
            badge.hidden = true;
            badge.textContent = '';
        }
    }
}

if (typeof window !== 'undefined' && !window.__solisNotifChromeResizeBound) {
    window.__solisNotifChromeResizeBound = true;
    let _notifChromeResizeT = null;
    window.addEventListener('resize', () => {
        clearTimeout(_notifChromeResizeT);
        _notifChromeResizeT = setTimeout(() => {
            if (typeof syncNotifBellVisibility === 'function') syncNotifBellVisibility();
        }, 120);
    });
}

function openNotificationsFromProfile() {
    const notifDropdown = document.getElementById('notificationsDropdown');
    const wrap = document.getElementById('notifWrapper')
        || document.querySelector('.notif-wrapper');
    closeAllDropdowns();
    if (wrap) {
        wrap.classList.add('is-visible');
        wrap.setAttribute('aria-hidden', 'false');
    }
    if (notifDropdown) {
        notifDropdown.classList.add('open');
    }
}

// Render notifications in dropdown with XSS prevention
function renderNotificationsList() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (notificationSystem.notifications.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'padding: 20px; text-align: center; color: #718096;';
        safeSetText(emptyDiv, 'No notifications');
        container.appendChild(emptyDiv);
        return;
    }

    notificationSystem.notifications.forEach(notif => {
        if (!notif || typeof notif !== 'object') return;

        const item = document.createElement('div');
        item.className = 'notif-item';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'notif-icon';
        const svg = document.createElement('svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = getNotificationIcon(notif.icon);
        iconDiv.appendChild(svg);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'notif-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'notif-sender';
        safeSetText(titleDiv, notif.title);

        const messageDiv = document.createElement('div');
        messageDiv.className = 'notif-message';
        safeSetText(messageDiv, notif.message);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'notif-time';
        safeSetText(timeDiv, formatTime(notif.timestamp));

        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(messageDiv);
        contentDiv.appendChild(timeDiv);

        item.appendChild(iconDiv);
        item.appendChild(contentDiv);
        container.appendChild(item);
    });
}

// Get notification icon SVG
function getNotificationIcon(iconType) {
    const icons = {
        'check': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
        'info': '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
        'warning': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        'error': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        'default': '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>'
    };
    return icons[iconType] || icons['default'];
}

// Clear unread status
function clearUnreadStatus() {
    notificationSystem.unreadCount = 0;
    notificationSystem.notifications.forEach(notif => notif.read = true);
    saveNotificationsToStorage();
    updateNotificationDisplay();
}

// Format timestamp
function formatTime(timestamp) {
    if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return timestamp.toLocaleDateString();
}

// Update profile information in dropdown with input validation
function updateProfileInfo() {
    const profileNameEl = document.getElementById('profileNameDisplay');
    const profilePlanEl = document.getElementById('profilePlanDisplay');
    const profileAvatarEl = document.getElementById('profileAvatarDisplay');

    let userObj = null;
    try {
        if (typeof window !== 'undefined' && window.currentUser) {
            userObj = window.currentUser;
        } else {
            const saved = localStorage.getItem('currentUser');
            if (saved) {
                const trimmed = saved.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    userObj = JSON.parse(saved);
                }
            }
        }
    } catch (err) {
        console.error('Error reading user data:', err);
        userObj = null;
    }

    const validation = validateUserObject(userObj);
    if (!validation || !validation.valid) {
        console.warn('Invalid user object');
        return;
    }

    const user = validation.user;

    const userName = escapeHtml((user.name || user.displayName || user.email || 'User').toString().substring(0, 100));
    const userPlan = escapeHtml((user.tier || user.plan || 'Free Plan').toString().toUpperCase().substring(0, 50));
    const userAvatar = user.picture || user.avatar || null;

    if (profileNameEl) {
        safeSetText(profileNameEl, userName);
    }

    if (profilePlanEl) {
        safeSetText(profilePlanEl, userPlan);
    }

    if (profileAvatarEl && userAvatar && typeof userAvatar === 'string') {
        if (isValidImageUrl(userAvatar)) {
            safeSetImage(profileAvatarEl, userAvatar, userName);
        }
    }
}

// ===== LOGGER =====
const Logger = {
    log: () => {},
    success: () => {},
    warn: (msg, data) => console.warn(`[NotifSys] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[NotifSys] ${msg}`, data || ''),
};

// ===== STORAGE MANAGER WITH VALIDATION =====
const StorageManager = {
    save: (key, data) => {
        try {
            const payload = {
                version: 2,
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(key, JSON.stringify(payload));
            Logger.success(`Storage saved: ${key}`);
            return true;
        } catch (error) {
            Logger.error('Storage save failed:', error.message);
            return false;
        }
    },

    load: (key) => {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return null;
            const payload = JSON.parse(stored);
            
            if (!payload || typeof payload !== 'object') {
                Logger.warn('Invalid payload structure');
                return null;
            }

            // Check timestamp (data older than 30 days is stale)
            const age = Date.now() - payload.timestamp;
            if (age > 30 * 24 * 60 * 60 * 1000) {
                Logger.warn('Data is stale, clearing');
                localStorage.removeItem(key);
                return null;
            }

            Logger.success(`Storage loaded: ${key}`);
            return payload.data;
        } catch (error) {
            Logger.error('Storage load failed:', error.message);
            return null;
        }
    },

    clear: (key) => {
        try {
            localStorage.removeItem(key);
            Logger.success(`Storage cleared: ${key}`);
            return true;
        } catch (error) {
            Logger.error('Storage clear failed:', error.message);
            return false;
        }
    },

    getSize: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? new Blob([item]).size : 0;
        } catch {
            return 0;
        }
    }
};

// ===== WEBSOCKET MANAGER =====
// Prefer existing class from websocket-manager.js; only define object fallback if missing.
(function ensureWebSocketManagerConnect() {
    const socketOrigin = () =>
        (typeof window.getSolisSocketOrigin === 'function'
            ? window.getSolisSocketOrigin()
            : (window.API_BASE_URL || 'https://api.solisai.video/api').toString().replace(/\/api\/?$/, '')
        ) || 'https://api.solisai.video';

    if (typeof WebSocketManager === 'function') {
        // Class already loaded — bridge static .connect() to singleton (fixes "connect is not a function")
        if (typeof WebSocketManager.connect !== 'function') {
            WebSocketManager.connect = function () {
                if (!window.wsManager) {
                    window.wsManager = new WebSocketManager();
                }
                return window.wsManager;
            };
        }
        WebSocketManager.connected = WebSocketManager.connected || false;
        return;
    }

    if (typeof WebSocketManager !== 'undefined') return;

    window.WebSocketManager = {
        ws: null,
        io: null,
        connected: false,
        reconnectAttempts: 0,
        reconnectDelay: 3000,
        messageHandlers: [],
        useSocketIO: typeof io !== 'undefined',
        useRawWS: false,

        connect: () => {
            if (WebSocketManager.connected) return;

            if (WebSocketManager.useSocketIO && typeof io !== 'undefined') {
                try {
                    WebSocketManager.io = io(socketOrigin(), {
                        reconnection: true,
                        reconnectionDelay: 3000,
                        reconnectionDelayMax: 30000,
                        reconnectionAttempts: 5,
                        transports: ['websocket', 'polling'],
                        path: '/socket.io/',
                        withCredentials: true
                    });

                    WebSocketManager.io.on('connect', () => {
                        Logger.success('Socket.IO connected');
                        WebSocketManager.connected = true;
                        WebSocketManager.reconnectAttempts = 0;
                        document.body.classList.add('ws-connected');
                    });

                    WebSocketManager.io.on('message', (message) => {
                        try {
                            const data = typeof message === 'string' ? JSON.parse(message) : message;
                            WebSocketManager.messageHandlers.forEach(handler => {
                                try { handler(data); } catch (error) {
                                    Logger.error('Handler error:', error.message);
                                }
                            });
                        } catch (error) {
                            Logger.error('Message parse error:', error.message);
                        }
                    });

                    WebSocketManager.io.on('disconnect', () => {
                        Logger.warn('Socket.IO disconnected, using localStorage fallback');
                        WebSocketManager.connected = false;
                        document.body.classList.remove('ws-connected');
                    });

                    WebSocketManager.io.on('connect_error', (error) => {
                        Logger.warn('Socket.IO connection error, using localStorage fallback');
                        WebSocketManager.connected = false;
                    });

                    return;
                } catch (error) {
                    Logger.warn('Socket.IO initialization error, falling back to localStorage');
                }
            }

            Logger.log('Using localStorage for notifications (WebSocket/Socket.IO not available)');
            WebSocketManager.connected = false;
            document.body.classList.add('using-storage-fallback');
        },

        attemptReconnect: () => {
            // Socket.IO handles reconnection automatically
        },

        send: (message) => {
            if (!WebSocketManager.connected || !WebSocketManager.io) {
                Logger.log('Using localStorage (not connected to realtime)');
                return false;
            }

            try {
                WebSocketManager.io.emit('message', message);
                return true;
            } catch (error) {
                Logger.error('Send error:', error.message);
                return false;
            }
        },

        subscribe: (handler) => {
            if (typeof handler === 'function') {
                WebSocketManager.messageHandlers.push(handler);
            }
        }
    };
})();

// End WebSocketManager ensure — keep legacy subscribe helpers if object fallback defined
if (typeof WebSocketManager !== 'undefined' && WebSocketManager && typeof WebSocketManager.subscribe !== 'function') {
    // class path: no-op subscribe for NotificationSystem wiring
    WebSocketManager.subscribe = function () { /* notifications use other channels */ };
}

// Initialize WebSocket/Storage on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WebSocketManager.connect());
} else {
    WebSocketManager.connect();
}

// ===== PROFESSIONAL NOTIFICATION SYSTEM =====
const NotificationSystemV2 = {
    state: {
        notifications: [],
        unreadCount: 0,
        initialized: false
    },

    init: () => {
        if (NotificationSystemV2.state.initialized) return;

        Logger.log('Initializing notification system v2...');

        // Load from persistent storage
        const stored = StorageManager.load('notificationSystem_v2');
        if (stored) {
            NotificationSystemV2.state.notifications = stored.notifications || [];
            NotificationSystemV2.state.unreadCount = stored.unreadCount || 0;
            Logger.success(`Restored ${NotificationSystemV2.state.notifications.length} notifications from storage`);
        }

        // Setup DOM listeners
        NotificationSystemV2.setupNotificationHandlers();

        // Connect WebSocket for real-time updates
        WebSocketManager.connect();
        WebSocketManager.subscribe(NotificationSystemV2.handleWebSocketMessage);

        NotificationSystemV2.updateDisplay();
        NotificationSystemV2.state.initialized = true;
        NotificationSystemV2.scheduleCleanup();

        // Clear leftover nav red-dots + kill any stale View Clip overlay
        try { removeBadges?.(); } catch (_) {}
        try { hideVideoGeneratedOverlay?.(); } catch (_) {}

        // ── FIX: wait for .profile-dropdown-name to exist before loading badges ──
        // Replaces the unreliable setTimeout(500ms) with a MutationObserver that
        // fires the moment the element is actually in the DOM.
        NotificationSystemV2.waitForElement('.profile-dropdown-name', () => {
            Logger.log('profile-dropdown-name found, loading badges...');
            NotificationSystemV2.loadUserBadges();
        });

        Logger.success('Notification system v2 fully initialized');
    },

    /**
     * Waits for a CSS selector to appear in the DOM.
     * If the element is already present it calls the callback immediately.
     * Otherwise it observes document.body and fires as soon as the element appears,
     * then disconnects — no polling, no arbitrary timeouts.
     *
     * @param {string}   selector  - CSS selector to wait for
     * @param {Function} callback  - called with the found element
     */
    waitForElement: (selector, callback) => {
        const existing = document.querySelector(selector);
        if (existing) {
            callback(existing);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                callback(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    // Load user badges from database and display them
    loadUserBadges: async (force = false) => {
        if (!force && NotificationSystemV2._badgesLoaded) return;
        NotificationSystemV2._badgesLoaded = true;
        try {
            const apiBase = (window.API_BASE_URL || 'https://api.solisai.video/api').replace(/\/$/, '');
            const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
            if (typeof getAuthHeaders === 'function') Object.assign(headers, getAuthHeaders());
            const response = await fetch(`${apiBase}/badges/current`, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: '{}',
            });
            const data = await response.json().catch(() => ({}));
            if (data.success && data.badges) {
                const badgesWrapper = data.badges;
                const list = badgesWrapper.badges || [];

                if (list.length > 0) {
                    Logger.success(`Loaded ${list.length} badge(s) from database`);

                    const profileDropdownName = document.querySelector('.profile-dropdown-name');
                    if (!profileDropdownName) {
                        Logger.warn('profile-dropdown-name disappeared after fetch, re-waiting...');
                        NotificationSystemV2._badgesLoaded = false;
                        NotificationSystemV2.waitForElement('.profile-dropdown-name', () => {
                            NotificationSystemV2.loadUserBadges(true);
                        });
                        return;
                    }

                    NotificationSystemV2.displayUserBadge(badgesWrapper);
                } else {
                    Logger.log('No badges awarded yet');
                }
            } else {
                Logger.log('No badge data from API');
                NotificationSystemV2._badgesLoaded = false;
            }
        } catch (error) {
            NotificationSystemV2._badgesLoaded = false;
            Logger.error('Failed to load badges:', error.message);
        }
    },

    createBadgeSvg: (badgeType, color) => {
        if (window.SolisBadges?.createSvg) {
            return window.SolisBadges.createSvg(badgeType, color, 28);
        }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '28');
        svg.setAttribute('height', '28');
        svg.setAttribute('viewBox', '0 0 24 24');
        return svg;
    },

    displayUserBadge: (badgesData) => {
        if (!badgesData || !badgesData.badges || badgesData.badges.length === 0) return;

        const profileDropdownName = document.getElementById('dropdownUserName')
            || document.querySelector('.profile-dropdown-profile .profile-dropdown-name')
            || document.querySelector('.profile-dropdown-info .profile-dropdown-name');
        if (!profileDropdownName) return;

        profileDropdownName.style.display = 'flex';
        profileDropdownName.style.alignItems = 'center';
        profileDropdownName.style.gap = '6px';
        profileDropdownName.style.flexWrap = 'nowrap';

        let badgeHost = document.getElementById('dropdown-badges')
            || profileDropdownName.querySelector('.badge-container');
        if (!badgeHost) {
            badgeHost = document.createElement('span');
            badgeHost.className = 'badge-container';
            badgeHost.id = 'dropdown-badges';
            badgeHost.style.cssText = 'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;';
            const nameSpan = profileDropdownName.querySelector('.username-text');
            if (nameSpan) {
                nameSpan.insertAdjacentElement('afterend', badgeHost);
            } else {
                profileDropdownName.appendChild(badgeHost);
            }
        }

        if (window.SolisBadges?.renderList) {
            window.SolisBadges.renderList(badgeHost, badgesData.badges, 22);
            return;
        }

        badgeHost.innerHTML = '';
        const ordered = [...badgesData.badges].sort((a, b) => {
            const rank = (t) => {
                const type = String(t || '').toLowerCase();
                if (type === 'business' || type === 'official') return 0;
                if (type === 'verified') return 1;
                if (type === 'team' || type === 'solis_core' || type === 'support_team') return 50;
                return 20;
            };
            return rank(a?.badge_type) - rank(b?.badge_type);
        }).slice(0, 2);
        ordered.forEach((badge) => {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'user-badge solis-user-badge';
            badgeEl.style.cssText = 'display:inline-flex;width:22px;height:22px;';
            const svg = NotificationSystemV2.createBadgeSvg(badge.badge_type, null);
            badgeEl.appendChild(svg);
            badgeHost.appendChild(badgeEl);
        });
    },

    setupNotificationHandlers: () => {
        const bellBtn = document.getElementById('bellBtn') || document.querySelector('.bell-btn');
        const notifDropdown = document.getElementById('notificationsDropdown');
        const markAsReadLink = document.getElementById('markAsRead');
        const dropdownNotif = document.getElementById('dropdownNotifications');

        if (bellBtn && notifDropdown && !bellBtn.dataset.v2BellBound) {
            bellBtn.dataset.v2BellBound = '1';
            bellBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isOpen = notifDropdown.classList.contains('open');
                NotificationSystemV2.closeAllDropdowns();
                if (!isOpen) {
                    notifDropdown.classList.add('open');
                    // Keep unread until they hit Mark as read — just show the list
                    if (typeof syncNotifBellVisibility === 'function') {
                        syncNotifBellVisibility(true);
                    }
                }
            });
        }

        if (dropdownNotif && !dropdownNotif.dataset.v2Bound) {
            dropdownNotif.dataset.v2Bound = '1';
            dropdownNotif.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof openNotificationsFromProfile === 'function') {
                    openNotificationsFromProfile();
                } else if (notifDropdown) {
                    NotificationSystemV2.closeAllDropdowns();
                    document.getElementById('notifWrapper')?.classList.add('is-visible');
                    notifDropdown.classList.add('open');
                }
            });
        }

        if (!document.documentElement.dataset.v2NotifDocBound) {
            document.documentElement.dataset.v2NotifDocBound = '1';
            document.addEventListener('click', (e) => {
                const t = e.target;
                if (t?.closest?.('#notificationsDropdown, #profileDropdown, #bellBtn, #profileAvatarBtn, #notifWrapper, #profileDropdownWr')) {
                    return;
                }
                NotificationSystemV2.closeAllDropdowns();
            });
        }

        if (markAsReadLink && !markAsReadLink.dataset.v2Bound) {
            markAsReadLink.dataset.v2Bound = '1';
            markAsReadLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                NotificationSystemV2.clearUnreadStatus();
            });
        }
    },

    handleWebSocketMessage: (message) => {
        switch (message.type) {
            case 'notification':
                NotificationSystemV2.addNotification(message.data);
                break;
            case 'notification:read':
                NotificationSystemV2.clearUnreadStatus();
                break;
            default:
                break;
        }
    },

    addNotification: (notification) => {
        if (!notification || typeof notification !== 'object') {
            Logger.error('Invalid notification object');
            return null;
        }

        const sanitizeUrl = (u) => {
            const s = String(u || '').trim();
            if (!s || s === '#') return null;
            if (/^(https?:|blob:|\/)/i.test(s)) return s.substring(0, 800);
            return null;
        };

        const notif = {
            id: notification.id || Date.now(),
            // Store plain text — renderers use textContent (escapeHtml would show &amp;)
            title: String(notification.title || notification.sender || 'Solis AI').substring(0, 100),
            message: String(notification.message || 'New notification').substring(0, 500),
            icon: notification.icon || 'solis',
            timestamp: notification.timestamp || new Date().toISOString(),
            read: notification.read === true,
            priority: notification.priority || 'normal',
            sender: String(notification.sender || 'Solis AI').substring(0, 60),
            official: notification.official === true
                || notification.icon === 'solis'
                || notification.kind === 'video_ready',
            kind: String(notification.kind || '').substring(0, 40),
            videoTitle: notification.videoTitle
                ? String(notification.videoTitle).substring(0, 120)
                : null,
            thumbnailUrl: sanitizeUrl(notification.thumbnailUrl),
            videoUrl: sanitizeUrl(notification.videoUrl),
            projectId: notification.projectId
                ? String(notification.projectId).substring(0, 120)
                : null,
        };

        const validIcons = ['check', 'info', 'warning', 'error', 'default', 'solis'];
        if (!validIcons.includes(notif.icon)) notif.icon = 'solis';

        NotificationSystemV2.state.notifications.unshift(notif);
        NotificationSystemV2.state.unreadCount++;

        if (NotificationSystemV2.state.notifications.length > 50) {
            NotificationSystemV2.state.notifications = NotificationSystemV2.state.notifications.slice(0, 50);
        }

        NotificationSystemV2.save();
        NotificationSystemV2.updateDisplay();

        Logger.success(`Notification added: ${notif.title}`);
        return notif;
    },

    updateDisplay: () => {
        const bellBtn = document.getElementById('bellBtn');
        const unread = NotificationSystemV2.state.unreadCount > 0;
        if (bellBtn) {
            if (unread) {
                bellBtn.classList.add('has-unread');
            } else {
                bellBtn.classList.remove('has-unread');
            }
        }
        if (typeof syncNotifBellVisibility === 'function') {
            syncNotifBellVisibility(unread);
        } else {
            const wrap = document.getElementById('notifWrapper');
            if (wrap) {
                wrap.classList.toggle('is-visible', unread);
                wrap.setAttribute('aria-hidden', unread ? 'false' : 'true');
            }
            const badge = document.getElementById('dropdownNotifBadge');
            if (badge) {
                if (unread) {
                    badge.hidden = false;
                    const n = NotificationSystemV2.state.unreadCount;
                    badge.textContent = n > 9 ? '9+' : String(n);
                } else {
                    badge.hidden = true;
                }
            }
        }

        NotificationSystemV2.renderList();
    },

    renderList: () => {
        const container = document.getElementById('notificationsList');
        if (!container) {
            console.warn('notificationsList container not found in DOM!');
            return;
        }

        // Pause any playing notif videos before wipe
        try {
            container.querySelectorAll('video').forEach((v) => {
                try { v.pause(); } catch (_) {}
            });
        } catch (_) {}

        while (container.firstChild) container.removeChild(container.firstChild);

        if (NotificationSystemV2.state.notifications.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'padding: 28px 20px; text-align: center; color: #718096;';
            safeSetText(emptyDiv, 'No notifications');
            container.appendChild(emptyDiv);
            return;
        }

        const apiBase = (
            (window.API_BASE_URL || '').toString().replace(/\/$/, '')
            || ((window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1')
                ? `http://${window.location.hostname}:5500/api`
                : 'https://api.solisai.video/api')
        );

        NotificationSystemV2.state.notifications.forEach((notif) => {
            const item = document.createElement('div');
            item.className = 'notif-item'
                + (notif.kind === 'video_ready' || notif.projectId || notif.thumbnailUrl || notif.videoUrl
                    ? ' notif-item--media'
                    : '');
            if (notif.projectId) item.dataset.projectId = String(notif.projectId);

            // Avatar — Solis logo for official / solis icons
            const iconDiv = document.createElement('div');
            iconDiv.className = 'notif-icon'
                + ((notif.icon === 'solis' || notif.official) ? ' notif-icon--solis' : '');

            if (notif.icon === 'solis' || notif.official) {
                const img = document.createElement('img');
                img.className = 'notif-solis-logo';
                img.src = '/assets/favicon.png';
                img.alt = 'Solis AI';
                img.draggable = false;
                img.onerror = () => {
                    img.onerror = null;
                    img.src = '/assets/solisailogo.png';
                };
                iconDiv.appendChild(img);
            } else {
                const svg = document.createElement('svg');
                svg.setAttribute('width', '18');
                svg.setAttribute('height', '18');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-linecap', 'round');
                svg.setAttribute('stroke-linejoin', 'round');
                svg.innerHTML = NotificationSystemV2.getIcon(notif.icon);
                iconDiv.appendChild(svg);
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'notif-content';

            const headRow = document.createElement('div');
            headRow.className = 'notif-head';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'notif-sender';
            safeSetText(titleDiv, notif.sender || notif.title || 'Solis AI');
            headRow.appendChild(titleDiv);

            if (notif.official) {
                const badgeWrap = document.createElement('span');
                badgeWrap.className = 'notif-official-badge';
                badgeWrap.setAttribute('aria-label', 'Official');
                badgeWrap.title = 'Official';
                try {
                    if (window.SolisBadges?.createSvg) {
                        badgeWrap.appendChild(window.SolisBadges.createSvg('official', null, 14));
                    } else {
                        badgeWrap.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    }
                } catch (_) {
                    badgeWrap.textContent = '✓';
                }
                headRow.appendChild(badgeWrap);
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'notif-message';
            safeSetText(messageDiv, notif.message);

            const timeDiv = document.createElement('div');
            timeDiv.className = 'notif-time';
            safeSetText(timeDiv, NotificationSystemV2.formatTime(notif.timestamp));

            contentDiv.appendChild(headRow);
            contentDiv.appendChild(messageDiv);
            contentDiv.appendChild(timeDiv);

            // Media preview (video preferred, then thumb/poster)
            const pid = notif.projectId ? String(notif.projectId).trim() : '';
            const thumb = notif.thumbnailUrl
                || (pid ? `${apiBase}/clips/poster/${encodeURIComponent(pid)}` : null);
            let streamUrl = null;
            try {
                const cached = pid && window.LibraryPreviewMediaCache?.get?.(pid, false);
                if (cached?.objectUrl) streamUrl = cached.objectUrl;
            } catch (_) {}
            if (!streamUrl && pid && window.clipsStudio?.getLibraryPreviewVideoUrl) {
                try {
                    streamUrl = window.clipsStudio.getLibraryPreviewVideoUrl(pid, { bust: false });
                } catch (_) {}
            }
            if (!streamUrl && pid) {
                streamUrl = `${apiBase}/clips/preview/${encodeURIComponent(pid)}/1`;
            }
            if (!streamUrl && notif.videoUrl) streamUrl = notif.videoUrl;

            if (thumb || streamUrl) {
                const media = document.createElement('div');
                media.className = 'notif-media';

                if (streamUrl) {
                    const video = document.createElement('video');
                    video.className = 'notif-media-video';
                    video.muted = true;
                    video.playsInline = true;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    video.preload = 'metadata';
                    video.loop = true;
                    video.controls = false;
                    if (thumb) video.poster = thumb;
                    video.src = streamUrl;
                    video.addEventListener('loadeddata', () => {
                        media.classList.add('is-ready');
                        video.play?.().catch(() => {});
                    });
                    video.addEventListener('error', () => {
                        // Fall back to poster image if stream fails
                        video.remove();
                        if (thumb) {
                            const img = document.createElement('img');
                            img.className = 'notif-media-thumb';
                            img.src = thumb;
                            img.alt = '';
                            img.loading = 'lazy';
                            media.appendChild(img);
                            media.classList.add('is-ready');
                        }
                    });
                    media.appendChild(video);
                } else if (thumb) {
                    const img = document.createElement('img');
                    img.className = 'notif-media-thumb';
                    img.src = thumb;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.onload = () => media.classList.add('is-ready');
                    media.appendChild(img);
                }

                contentDiv.appendChild(media);
            }

            item.appendChild(iconDiv);
            item.appendChild(contentDiv);

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (pid && window.clipsStudio?.openLibraryPreviewWhenReady) {
                    try {
                        window.clipsStudio.openLibraryPreviewWhenReady(pid, pid);
                    } catch (_) { /* ignore */ }
                    NotificationSystemV2.closeAllDropdowns?.();
                } else if (pid && window.clipsStudio?.openLibraryPreview) {
                    try {
                        window.clipsStudio.openLibraryPreview(pid, pid, null, { fast: true });
                    } catch (_) { /* ignore */ }
                    NotificationSystemV2.closeAllDropdowns?.();
                }
            });

            container.appendChild(item);
        });
    },

    getIcon: (type) => {
        const icons = {
            'check': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            'info': '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
            'warning': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            'error': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
            'default': '<circle cx="12" cy="12" r="10"></circle>',
            'solis': '',
        };
        return icons[type] || icons['default'];
    },

    formatTime: (timestamp) => {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    },

    clearUnreadStatus: () => {
        NotificationSystemV2.state.unreadCount = 0;
        NotificationSystemV2.state.notifications.forEach(notif => notif.read = true);
        NotificationSystemV2.save();
        NotificationSystemV2.updateDisplay();
        Logger.log('Unread status cleared');
    },

    closeAllDropdowns: () => {
        const notifDropdown = document.getElementById('notificationsDropdown');
        try {
            notifDropdown?.querySelectorAll?.('video')?.forEach((v) => {
                try { v.pause(); } catch (_) {}
            });
        } catch (_) {}
        if (notifDropdown) notifDropdown.classList.remove('open');
        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown) profileDropdown.classList.remove('open');
        const unread = NotificationSystemV2.state.unreadCount > 0;
        if (typeof syncNotifBellVisibility === 'function') {
            syncNotifBellVisibility(unread);
        }
    },

    save: () => {
        StorageManager.save('notificationSystem_v2', {
            notifications: NotificationSystemV2.state.notifications,
            unreadCount: NotificationSystemV2.state.unreadCount
        });
    },

    scheduleCleanup: () => {
        setInterval(() => {
            const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const original = NotificationSystemV2.state.notifications.length;
            
            NotificationSystemV2.state.notifications = NotificationSystemV2.state.notifications.filter(notif => {
                const notifTime = new Date(notif.timestamp).getTime();
                return notifTime > cutoff;
            });

            if (NotificationSystemV2.state.notifications.length < original) {
                Logger.log(`Cleaned up ${original - NotificationSystemV2.state.notifications.length} old notifications`);
                NotificationSystemV2.save();
            }
        }, 86400000); // 24 hours
    }
};

// ===== INITIALIZATION =====
function initWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NotificationSystemV2.init();
        });
    } else {
        NotificationSystemV2.init();
    }
}

// Start initialization
initWhenReady();

window.NotificationSystemV2 = NotificationSystemV2;

// ===== PUBLIC API - Override with v2 =====
window.notificationSystem = {
    add: (notification) => NotificationSystemV2.addNotification(notification),
    clearUnread: () => NotificationSystemV2.clearUnreadStatus(),
    closeDropdowns: () => NotificationSystemV2.closeAllDropdowns(),
    getState: () => ({ ...NotificationSystemV2.state }),
    getStorageSize: () => StorageManager.getSize('notificationSystem_v2'),
    isWebSocketConnected: () => WebSocketManager.connected,
    testNotification: () => NotificationSystemV2.addNotification({
        title: 'Test Notification',
        message: 'This is a test notification',
        icon: 'info'
    }),
    showVideoGenerated: (videoData) => showVideoGeneratedNotification(videoData),
    showVideoGeneratedNotification: (videoData) => showVideoGeneratedNotification(videoData),
    
    // ===== BADGE SYSTEM INTEGRATION =====
    fetchUserBadges: async (userId) => {
        if (!window.currentUser || String(window.currentUser.id) !== String(userId)) {
            return null;
        }
        return notificationSystem.fetchCurrentUserBadges();
    },
    
    fetchCurrentUserBadges: async () => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (typeof getAuthHeaders === 'function') Object.assign(headers, getAuthHeaders());
            const response = await fetch('/api/badges/current', {
                method: 'POST',
                credentials: 'include',
                headers
            });
            const data = await response.json();
            if (data.success) {
                return data.badges;
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch current user badges:', error);
            return null;
        }
    },
    
    sendFirstLoginNotification: async () => {
        try {
            const response = await fetch('/api/badges/first-login-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success && data.notification) {
                notificationSystem.add(data.notification);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to send first login notification:', error);
            return false;
        }
    },
    
    displayUserBadge: (badges) => NotificationSystemV2.displayUserBadge(badges),
    
    loadUserBadges: async (force) => NotificationSystemV2.loadUserBadges(!!force)
};

window.showVideoGenerated = showVideoGenerated;
window.showVideoGeneratedNotification = showVideoGeneratedNotification;

// ===== VIDEO GENERATION BADGE SYSTEM =====
// Red dots on nav / library tabs removed — bell unread indicator is enough
function addVideoBadge() {
    return;
}

// Remove badge when user clicks on library or clips
function removeBadges() {
    const badges = document.querySelectorAll('.video-new-badge');
    badges.forEach(badge => {
        badge.remove();
    });
}

// Attach click handlers to remove badge
function attachBadgeClickHandlers() {
    const libraryTab = document.querySelector('[data-tab="library"]');
    const clipsNav = document.querySelector('[data-target="clips"]');

    if (libraryTab) {
        libraryTab.addEventListener('click', removeBadges);
    }

    if (clipsNav) {
        clipsNav.addEventListener('click', removeBadges);
    }
}

// Initialize badge system after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachBadgeClickHandlers);
} else {
    attachBadgeClickHandlers();
}

// ===== WEBSOCKET EVENT LISTENERS FOR VIDEO GENERATION =====
// Listen for video generation completion
if (typeof window !== 'undefined') {
    // Handle WebSocket video_generated events
    if (window.videoGenerationSocket) {
        window.videoGenerationSocket.off('video_generated');
        window.videoGenerationSocket.on('video_generated', (data) => {
            addVideoBadge();
            // Trigger storage badge update
            if (typeof updateStorageBadgeDisplay === 'function') {
                setTimeout(() => updateStorageBadgeDisplay(), 1000);
            }
            // Refresh clips library if available
            if (window.clipsStudio && typeof window.clipsStudio.loadLibraryItems === 'function') {
                setTimeout(() => window.clipsStudio.loadLibraryItems(), 1000);
            }
        });
    }
    
    // Handle main WebSocket client events
    window.addEventListener('load', () => {
        setTimeout(() => {
            // Listen for WebSocket client video events
            if (window.solisWSClient) {
                window.solisWSClient.on('video_generated', (data) => {
                    addVideoBadge();
                    if (typeof updateStorageBadgeDisplay === 'function') {
                        setTimeout(() => updateStorageBadgeDisplay(), 1000);
                    }
                });
                
                // Listen for storage updates
                window.solisWSClient.on('storage_update', (data) => {
                    if (typeof updateStorageBadgeDisplay === 'function') {
                        updateStorageBadgeDisplay();
                    }
                });
                
                // Listen for follower notifications
                window.solisWSClient.on('follower_notification', (data) => {
                    if (typeof window.notificationSystem?.add === 'function') {
                        window.notificationSystem.add({
                            title: data.title || 'New Follower',
                            message: data.message || 'Someone is now following you',
                            icon: 'check'
                        });
                    }
                });
            }
        }, 500);
    });
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

Logger.success('Professional Notification System v2 loaded');