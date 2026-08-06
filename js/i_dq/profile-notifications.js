const NOTIF_CONFIG = {
    VERSION: 2,
    STORAGE_KEY: 'notificationSystem_v2',
    MAX_NOTIFICATIONS: 50,
    STORAGE_CLEANUP_INTERVAL: 86400000, // 24 hours
    WS_RECONNECT_DELAY: 3000,
    WS_MAX_RECONNECT_DELAY: 30000,
    WS_PING_INTERVAL: 30000,
};

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

function safeSetText(element, text) {
    if (element && typeof text === 'string') {
        element.textContent = text;
    }
}

function safeSetImage(element, srcUrl, altText = '') {
    if (!element) return;
    if (!isValidImageUrl(srcUrl)) {
        console.warn('Invalid image URL');
        return;
    }

    const img = document.createElement('img');
    img.setAttribute('src', srcUrl);
    img.setAttribute('alt', escapeHtml(altText));
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';

    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }

    element.appendChild(img);
}

function validateUserObject(userObj) {
    if (!userObj || typeof userObj !== 'object') return { valid: false };

    const hasId = userObj.id || userObj.user_id || userObj.sub;
    const hasIdentifier = userObj.email || userObj.name || userObj.displayName;

    if (hasId || hasIdentifier) {
        return { valid: true, user: userObj };
    }

    return { valid: false };
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

function syncProfileButton() {
    const profileAvatarBtn = document.getElementById('profileAvatarBtn');
    if (!profileAvatarBtn) return;

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
        console.error('Error syncing profile:', err);
        userObj = null;
    }

    const validation = validateUserObject(userObj);
    if (!validation || !validation.valid) {
        console.warn('Invalid user object');
        return;
    }

    const user = validation.user;
    const authProvider = (user.auth_provider || '').toString().toLowerCase();
    const userAvatar = user.picture || user.avatar || null;

    const gmailIcon = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;"><rect width="24" height="24" fill="none"/><path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/></svg>';

    while (profileAvatarBtn.firstChild) {
        profileAvatarBtn.removeChild(profileAvatarBtn.firstChild);
    }

    if (authProvider.includes('google')) {
        profileAvatarBtn.innerHTML = gmailIcon;
    } else if (userAvatar && typeof userAvatar === 'string') {
        if (isValidImageUrl(userAvatar)) {
            safeSetImage(profileAvatarBtn, userAvatar, 'User Avatar');
        } else {
            console.warn('Invalid avatar URL');
        }
    }
}

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

    document.addEventListener('click', closeAllDropdowns);

    const markAsReadLink = document.getElementById('markAsRead');
    if (markAsReadLink) {
        markAsReadLink.addEventListener('click', (e) => {
            e.preventDefault();
            clearUnreadStatus();
        });
    }
}

function closeAllDropdowns() {
    const notifDropdown = notificationSystem.notificationsDropdown;
    if (notifDropdown) notifDropdown.classList.remove('open');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileDropdown) profileDropdown.classList.remove('open');
    const unread = notificationSystem.unreadCount > 0
        || (typeof NotificationSystemV2 !== 'undefined' && NotificationSystemV2.state?.unreadCount > 0);
    if (typeof syncNotifBellVisibility === 'function') {
        syncNotifBellVisibility(!!unread);
    }
}

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

function addNotification(notification) {
    if (!notification || typeof notification !== 'object') {
        console.error('Invalid notification object');
        return null;
    }

    const sanitizeString = (str, maxLen = 500) => {
        if (typeof str !== 'string') return '';
        return escapeHtml(str.substring(0, maxLen));
    };

    const defaultNotification = {
        id: Date.now(),
        title: sanitizeString(notification.title || 'Notification', 100),
        message: sanitizeString(notification.message || 'New notification', 500),
        icon: notification.icon || 'info',
        timestamp: notification.timestamp || new Date(),
        read: notification.read === true,
        ...notification
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

function showVideoGeneratedNotification(videoData = {}) {

    const {
        videoTitle = 'Video Generated',
        videoUrl = '#',
        thumbnailUrl = null,
        duration = 0
    } = videoData;

    showVideoGeneratedOverlay(videoTitle, videoUrl);

    addNotification({
        title: 'Video Generated',
        message: `Your video "${videoTitle}" has been successfully created and is ready to download.`,
        icon: 'check',
        action: {
            label: 'View Video',
            url: videoUrl
        }
    });
}

function showVideoGenerated(videoData = {}) {
    return showVideoGeneratedNotification(videoData);
}

function showVideoGenerated(videoData = {}) {
    return showVideoGeneratedNotification(videoData);
}

function showVideoGeneratedOverlay(title = 'Video Ready!', actionUrl = '#') {
    const backdrop = document.getElementById('videoGeneratedBackdrop');
    const overlay = document.getElementById('videoGeneratedOverlay');

    if (!backdrop || !overlay) {
        console.warn('Video generated overlay elements not found');
        return;
    }

    const titleEl = overlay.querySelector('.video-generated-title');
    const messageEl = overlay.querySelector('.video-generated-message');
    const viewBtn = overlay.querySelector('[data-action="view"]');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = 'Your video has been successfully generated and is ready to download or share.';
    if (viewBtn) {
        viewBtn.onclick = () => {
            if (actionUrl !== '#') {
                window.open(actionUrl, '_blank');
            }
            hideVideoGeneratedOverlay();
        };
    }

    backdrop.classList.add('show');
    overlay.classList.add('show');

    setTimeout(hideVideoGeneratedOverlay, 8000);
}

function hideVideoGeneratedOverlay() {
    const backdrop = document.getElementById('videoGeneratedBackdrop');
    const overlay = document.getElementById('videoGeneratedOverlay');

    if (backdrop) backdrop.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

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

function clearUnreadStatus() {
    notificationSystem.unreadCount = 0;
    notificationSystem.notifications.forEach(notif => notif.read = true);
    saveNotificationsToStorage();
    updateNotificationDisplay();
}

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

const Logger = {
    log: () => {},
    success: () => {},
    warn: (msg, data) => console.warn(`[NotifSys] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[NotifSys] ${msg}`, data || ''),
};

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

if (typeof WebSocketManager === 'undefined' || typeof WebSocketManager === 'function') {
    const WebSocketManager = {
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
                    WebSocketManager.io = io(window.location.origin, {
                        reconnection: true,
                        reconnectionDelay: 3000,
                        reconnectionDelayMax: 30000,
                        reconnectionAttempts: 5,
                        transports: ['websocket', 'polling']
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
} // End conditional WebSocketManager definition

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WebSocketManager.connect());
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

        Logger.log('Initializing notification system v2...');

        const stored = StorageManager.load('notificationSystem_v2');
        if (stored) {
            NotificationSystemV2.state.notifications = stored.notifications || [];
            NotificationSystemV2.state.unreadCount = stored.unreadCount || 0;
            Logger.success(`Restored ${NotificationSystemV2.state.notifications.length} notifications from storage`);
        }

        NotificationSystemV2.setupNotificationHandlers();

        WebSocketManager.connect();
        WebSocketManager.subscribe(NotificationSystemV2.handleWebSocketMessage);

        NotificationSystemV2.updateDisplay();
        NotificationSystemV2.state.initialized = true;
        NotificationSystemV2.scheduleCleanup();

        NotificationSystemV2.waitForElement('.profile-dropdown-name', () => {
            Logger.log('profile-dropdown-name found, loading badges...');
            NotificationSystemV2.loadUserBadges();
        });

        Logger.success('Notification system v2 fully initialized');
    },

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

    loadUserBadges: async () => {
        if (NotificationSystemV2._badgesLoaded) return;
        NotificationSystemV2._badgesLoaded = true;
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (typeof getAuthHeaders === 'function') Object.assign(headers, getAuthHeaders());
            const response = await fetch('/api/badges/current', {
                method: 'POST',
                credentials: 'include',
                headers
            });
            const data = await response.json();
            if (data.success && data.badges) {
                const badgesWrapper = data.badges;

                if (badgesWrapper.badges && badgesWrapper.badges.length > 0) {
                    Logger.success(`Loaded ${badgesWrapper.badges.length} badge(s) from database`);

                    const profileDropdownName = document.querySelector('.profile-dropdown-name');
                    if (!profileDropdownName) {
                        Logger.warn('profile-dropdown-name disappeared after fetch, re-waiting...');
                        NotificationSystemV2.waitForElement('.profile-dropdown-name', () => {
                            NotificationSystemV2.displayUserBadge(badgesWrapper);
                        });
                        return;
                    }

                    NotificationSystemV2.displayUserBadge(badgesWrapper);
                } else {
                    Logger.log('No badges awarded yet');
                }
            } else {
                Logger.log('No badge data from API');
            }
        } catch (error) {
            NotificationSystemV2._badgesLoaded = false; // allow retry on error
            Logger.error('Failed to load badges:', error.message);
        }
    },

    createBadgeSvg: (badgeType, color) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '28');
        svg.setAttribute('height', '28');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.display = 'block';
        svg.style.width = '100%';
        svg.style.height = '100%';

        switch(badgeType) {
            case 'official':
                svg.innerHTML = `<defs>
                    <linearGradient id="bgGrad-official" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#FF8A5C" />
                        <stop offset="100%" stop-color="#FF5722" />
                    </linearGradient>
                    <radialGradient id="outerGlow-official" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stop-color="#FF7A42" stop-opacity="0.2" />
                        <stop offset="100%" stop-color="#FF7A42" stop-opacity="0" />
                    </radialGradient>
                    <linearGradient id="edgeHighlight-official" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stop-color="white" stop-opacity="0.8" />
                        <stop offset="50%" stop-color="white" stop-opacity="0" />
                        <stop offset="100%" stop-color="white" stop-opacity="0.3" />
                    </linearGradient>
                    <radialGradient id="lensShine-official" cx="50%" cy="30%" r="50%" fx="50%" fy="20%">
                        <stop offset="0%" stop-color="white" stop-opacity="0.5" />
                        <stop offset="100%" stop-color="white" stop-opacity="0" />
                    </radialGradient>
                </defs>
                <g class="badge-content">
                    <circle cx="12" cy="12" r="9" fill="url(#outerGlow-official)" stroke="none"/>
                    <circle cx="12" cy="12" r="7" fill="url(#bgGrad-official)" stroke="none"/>
                    <circle cx="12" cy="12" r="7" fill="url(#lensShine-official)" stroke="none"/>
                    <circle cx="12" cy="12" r="6.75" stroke="url(#edgeHighlight-official)" stroke-width="0.8" stroke-opacity="0.6" fill="none"/>
                    <path d="M8 12L10 14L15 9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>`;
                break;
            case 'support_team':
                svg.innerHTML = `
                    <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" fill="${color}"/>
                    <path d="M12 2L20 5V11C20 13 19 15 17 17L12 2V2Z" fill="white" fill-opacity="0.1"/>
                    <path d="M9 11L11 13L15 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                `;
                break;
            case 'platinum_elite':
                svg.innerHTML = `
                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${color}"/>
                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.03"/>
                    <path d="M6 4L12 9V21L18 4H6Z" fill="black" fill-opacity="0.05"/>
                    <path d="M12 4V21" stroke="black" stroke-width="0.6" stroke-opacity="0.1"/>
                    <path d="M3 9H21M6 4L12 21M18 4L12 21M9 9L12 21L15 9" stroke="black" stroke-width="0.5" stroke-linejoin="round"/>
                `;
                break;
            case 'diamond_partner':
                svg.innerHTML = `
                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${color}"/>
                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.05"/>
                    <path d="M12 21L9 9L12 4L15 9L12 21Z" fill="white" fill-opacity="0.2"/>
                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#003538" stroke-width="0.6" stroke-opacity="0.8"/>
                `;
                break;
            case 'bronze_partner':
                svg.innerHTML = `
                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${color}"/>
                    <path d="M12 21L9 9L12 4V21Z" fill="black" fill-opacity="0.15"/>
                    <path d="M12 21L15 9L12 4V21Z" fill="white" fill-opacity="0.1"/>
                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#2a1604" stroke-width="0.6" stroke-opacity="0.6"/>
                `;
                break;
            case 'verified':
                svg.innerHTML = `
                    <circle cx="12" cy="12" r="11" fill="${color}"/>
                    <path d="M9 12.5L11.5 15L17 8.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                `;
                break;
            case 'solis_core':
                svg.innerHTML = `<defs>
                    <linearGradient id="g-7" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ef4444" />
                        <stop offset="100%" stop-color="#f87171" />
                    </linearGradient>
                </defs>
                <path d="M12 1L14.47 3.94L18.27 3.23L19.33 6.94L23.08 7.73L21.84 11.44L24 14.5L20.92 16.71L20.67 20.52L16.89 21.05L14.93 24L12 22.67L9.07 24L7.11 21.05L3.33 20.52L3.08 16.71L0 14.5L2.16 11.44L0.92 7.73L4.67 6.94L5.73 3.23L9.53 3.94L12 1Z" fill="url(#g-7)" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M8.5 12.5L11 15L16.5 9.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
                break;
            default:
                svg.innerHTML = `<circle cx="12" cy="12" r="4" fill="${color}"/>`;
        }

        return svg;
    },

    displayUserBadge: (badgesData) => {
        if (!badgesData || !badgesData.badges || badgesData.badges.length === 0) return;

        const profileDropdownName = document.querySelector('.profile-dropdown-name');
        if (!profileDropdownName) return;

        if (!document.getElementById('badge-tooltip-styles')) {
            const style = document.createElement('style');
            style.id = 'badge-tooltip-styles';
            style.textContent = `
                #badge-global-tooltip {
                    position: fixed;
                    background: #6b7280;
                    color: #fff;
                    padding: 3px 7px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                    white-space: nowrap;
                    z-index: 99999999;
                    pointer-events: none;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.15s ease;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
            `;
            document.head.appendChild(style);

            const tip = document.createElement('div');
            tip.id = 'badge-global-tooltip';
            document.body.appendChild(tip);
        }

        const existingBadges = profileDropdownName.querySelectorAll('.user-badge');
        existingBadges.forEach(b => b.remove());

        profileDropdownName.style.display = 'flex';
        profileDropdownName.style.alignItems = 'center';
        profileDropdownName.style.gap = '8px';

        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'badge-container';
        badgeContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        `;

        badgesData.badges.slice(0, 2).forEach((badge) => {
            const badgeInfo = badge.badge_info;
            if (!badgeInfo || !badgeInfo.name) return;

            const badgeEl = document.createElement('div');
            badgeEl.className = 'user-badge';
            badgeEl.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));cursor:pointer;flex-shrink:0;`;

            const svg = NotificationSystemV2.createBadgeSvg(badge.badge_type, badgeInfo.color);
            badgeEl.appendChild(svg);

            const tier = badge.badge_tier || badgeInfo.tier || 'Special';
            const tipText = `${badgeInfo.name} • ${tier}`;

            badgeEl.addEventListener('mouseenter', (e) => {
                const tip = document.getElementById('badge-global-tooltip');
                if (!tip) return;
                tip.textContent = tipText;
                const r = badgeEl.getBoundingClientRect();
                tip.style.opacity = '0';
                tip.style.display = 'block';
                const tw = tip.offsetWidth;
                tip.style.left = (r.left + r.width / 2 - tw / 2) + 'px';
                tip.style.top = (r.top - tip.offsetHeight - 6) + 'px';
                tip.style.opacity = '1';
            });
            badgeEl.addEventListener('mouseleave', () => {
                const tip = document.getElementById('badge-global-tooltip');
                if (tip) tip.style.opacity = '0';
            });

            badgeContainer.appendChild(badgeEl);
        });

        profileDropdownName.appendChild(badgeContainer);
    },

    setupNotificationHandlers: () => {
        const bellBtn = document.getElementById('bellBtn') || document.querySelector('.bell-btn');
        const notifDropdown = document.getElementById('notificationsDropdown');
        const markAsReadLink = document.getElementById('markAsRead');
        const dropdownNotif = document.getElementById('dropdownNotifications');

        if (bellBtn && notifDropdown) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = notifDropdown.classList.contains('open');
                NotificationSystemV2.closeAllDropdowns();
                if (!isOpen) {
                    notifDropdown.classList.add('open');
                    NotificationSystemV2.clearUnreadStatus();
                    if (typeof syncNotifBellVisibility === 'function') {
                        syncNotifBellVisibility(false);
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

        document.addEventListener('click', () => NotificationSystemV2.closeAllDropdowns());

        if (markAsReadLink) {
            markAsReadLink.addEventListener('click', (e) => {
                e.preventDefault();
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

        const notif = {
            id: notification.id || Date.now(),
            title: escapeHtml(String(notification.title || 'Notification').substring(0, 100)),
            message: escapeHtml(String(notification.message || 'New notification').substring(0, 500)),
            icon: notification.icon || 'info',
            timestamp: notification.timestamp || new Date().toISOString(),
            read: notification.read === true,
            priority: notification.priority || 'normal'
        };

        const validIcons = ['check', 'info', 'warning', 'error', 'default'];
        if (!validIcons.includes(notif.icon)) notif.icon = 'default';

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

        while (container.firstChild) container.removeChild(container.firstChild);

        if (NotificationSystemV2.state.notifications.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'padding: 20px; text-align: center; color: #718096;';
            safeSetText(emptyDiv, 'No notifications');
            container.appendChild(emptyDiv);
            return;
        }

        NotificationSystemV2.state.notifications.forEach((notif, index) => {
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
            svg.innerHTML = NotificationSystemV2.getIcon(notif.icon);
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
            safeSetText(timeDiv, NotificationSystemV2.formatTime(notif.timestamp));

            contentDiv.appendChild(titleDiv);
            contentDiv.appendChild(messageDiv);
            contentDiv.appendChild(timeDiv);

            item.appendChild(iconDiv);
            item.appendChild(contentDiv);
            container.appendChild(item);
        });
    },

    getIcon: (type) => {
        const icons = {
            'check': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            'info': '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
            'warning': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            'error': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
            'default': '<circle cx="12" cy="12" r="10"></circle>'
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

function initWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NotificationSystemV2.init();
        });
    } else {
        NotificationSystemV2.init();
    }
}

initWhenReady();

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

    loadUserBadges: async () => NotificationSystemV2.loadUserBadges()
};

function addVideoBadge() {
    const libraryTab = document.querySelector('[data-tab="library"]');
    if (libraryTab && !libraryTab.querySelector('.video-new-badge')) {
        const badge = document.createElement('span');
        badge.className = 'video-new-badge';
        badge.style.cssText = `
            position: absolute;
            top: -4px;
            right: -4px;
            width: 10px;
            height: 10px;
            background: #ef4444;
            border-radius: 50%;
            border: 2px solid white;
        `;
        libraryTab.style.position = 'relative';
        libraryTab.appendChild(badge);
    }

    const clipsNav = document.querySelector('[data-target="clips"]');
    if (clipsNav && !clipsNav.querySelector('.video-new-badge')) {
        const badge = document.createElement('span');
        badge.className = 'video-new-badge';
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 12px;
            height: 12px;
            background: #ef4444;
            border-radius: 50%;
            border: 2px solid white;
        `;
        clipsNav.style.position = 'relative';
        clipsNav.appendChild(badge);
    }
}

function removeBadges() {
    const badges = document.querySelectorAll('.video-new-badge');
    badges.forEach(badge => {
        badge.remove();
    });
}

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachBadgeClickHandlers);
} else {
    attachBadgeClickHandlers();
}

if (typeof window !== 'undefined') {
    if (window.videoGenerationSocket) {
        window.videoGenerationSocket.off('video_generated');
        window.videoGenerationSocket.on('video_generated', (data) => {
            addVideoBadge();
            if (typeof updateStorageBadgeDisplay === 'function') {
                setTimeout(() => updateStorageBadgeDisplay(), 1000);
            }
            if (window.clipsStudio && typeof window.clipsStudio.loadLibraryItems === 'function') {
                setTimeout(() => window.clipsStudio.loadLibraryItems(), 1000);
            }
        });
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.solisWSClient) {
                window.solisWSClient.on('video_generated', (data) => {
                    addVideoBadge();
                    if (typeof updateStorageBadgeDisplay === 'function') {
                        setTimeout(() => updateStorageBadgeDisplay(), 1000);
                    }
                });

                window.solisWSClient.on('storage_update', (data) => {
                    if (typeof updateStorageBadgeDisplay === 'function') {
                        updateStorageBadgeDisplay();
                    }
                });

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

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

Logger.success('Professional Notification System v2 loaded');
