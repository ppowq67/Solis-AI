class WebSocketSecurityManager {
    constructor(config = {}) {
        this.authToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        this.userId = null;

        this.sessionId = this._generateSecureId();
        this.nonceCache = new Set(); // Track used nonces to prevent replay attacks
        this.maxCachedNonces = 1000;

        this.rateLimitMap = new Map();
        this.rateLimits = config.rateLimits || {
            'delete_clip': 10,        // 10 per second
            'processing_update': 100, // 100 per second
            'default': 50             // 50 per second
        };

        this.validateIncomingMessages = config.validateIncomingMessages !== false;
        this.messageValidationQueue = [];
        this.maxValidationQueueSize = 100;

        this.securityLogs = [];
        this.maxSecurityLogs = 500; // Configurable, in-memory only
        this.suspiciousActivityThreshold = config.suspiciousActivityThreshold || 10;
        this.suspiciousActivityCount = 0;

        this.MAX_MESSAGE_SIZE = config.maxMessageSize || 256 * 1024; // 256KB
        this.TIMESTAMP_VALIDITY_WINDOW = config.timestampWindow || 300000; // 5 minutes
        this.TOKEN_REFRESH_THRESHOLD = config.tokenRefreshThreshold || 300000;
        this.NONCE_VALIDITY_DURATION = config.nonceValidity || 3600000; // 1 hour
        this.CLEANUP_INTERVAL = config.cleanupInterval || 600000; // 10 minutes
        this.expectedOrigin = config.expectedOrigin || window.location.origin;

        this.nonceTimestamps = new Map();
        this.cleanupTask = null;

    }

    init(authToken, userId, refreshToken = null) {
        if (!authToken || !userId) {
            console.error('Invalid credentials for security init');
            return false;
        }

        this.authToken = authToken;
        this.userId = userId;
        this.refreshToken = refreshToken;

        if (!this._validateToken()) {
            console.error('Token validation failed');
            return false;
        }

        this._logSecurityEvent('security_init', { userId });
        return true;
    }

    _validateToken() {
        if (!this.authToken) {
            console.warn('No authentication token');
            return false;
        }

        try {
            const parts = this.authToken.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT structure');
            }

            const payload = JSON.parse(atob(parts[1]));

            if (payload.exp) {
                const expiresAt = payload.exp * 1000;
                this.tokenExpiresAt = expiresAt;

                if (expiresAt < Date.now()) {
                    console.warn('Token expired');
                    return false;
                }

                if (this.refreshToken) {
                    this._scheduleTokenRefresh();
                }
            }

            return true;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    _scheduleTokenRefresh() {
        if (!this.tokenExpiresAt) return;

        const timeUntilRefresh = this.tokenExpiresAt - Date.now() - this.tokenRefreshThreshold;
        if (timeUntilRefresh > 0) {
            setTimeout(() => this._refreshToken(), timeUntilRefresh);
        }
    }

    async _refreshToken() {
        if (!this.userId) return;

        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include', // Send httpOnly cookies automatically
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this._getCsrfToken(),
                },
                body: JSON.stringify({
                    userId: this.userId,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                this.authToken = data.authToken;
                this._validateToken();
                this._logSecurityEvent('token_refresh_success', {});
            } else {
                this._logSecurityEvent('token_refresh_failed', { status: response.status });
                console.error('Token refresh failed');
            }
        } catch (error) {
            this._logSecurityEvent('token_refresh_error', { error: error.message });
            console.error('Token refresh error:', error);
        }
    }

    _getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    _generateSecureId() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    _generateNonce() {
        const nonce = this._generateSecureId();
        const timestamp = Date.now();

        this.nonceCache.add(nonce);
        this.nonceTimestamps.set(nonce, timestamp);

        if (this.nonceCache.size > this.maxCachedNonces) {
            const entries = Array.from(this.nonceTimestamps.entries())
                .sort((a, b) => a[1] - b[1])
                .slice(0, this.nonceCache.size - this.maxCachedNonces);

            entries.forEach(([n, _]) => {
                this.nonceCache.delete(n);
                this.nonceTimestamps.delete(n);
            });
        }

        return nonce;
    }

    _validateNonce(nonce) {
        if (!nonce || !this.nonceCache.has(nonce)) {
            return false;
        }

        const timestamp = this.nonceTimestamps.get(nonce);
        if (!timestamp || Date.now() - timestamp > this.NONCE_VALIDITY_DURATION) {
            this.nonceCache.delete(nonce);
            this.nonceTimestamps.delete(nonce);
            return false;
        }

        return true;
    }

    _cleanupExpiredNonces() {
        const now = Date.now();
        const expired = [];

        for (const [nonce, timestamp] of this.nonceTimestamps) {
            if (now - timestamp > this.NONCE_VALIDITY_DURATION) {
                expired.push(nonce);
            }
        }

        expired.forEach(nonce => {
            this.nonceCache.delete(nonce);
            this.nonceTimestamps.delete(nonce);
        });
    }

    checkRateLimit(eventType, customLimit = null) {
        const limit = customLimit || this.rateLimits[eventType] || this.rateLimits.default;

        if (!this.rateLimitMap.has(eventType)) {
            this.rateLimitMap.set(eventType, []);
        }

        const timestamps = this.rateLimitMap.get(eventType);
        const now = Date.now();
        const oneSecondAgo = now - 1000;

        const recentTimestamps = timestamps.filter(t => t > oneSecondAgo);
        recentTimestamps.push(now);

        if (recentTimestamps.length > limit) {
            this._logSecurityEvent('rate_limit_exceeded', { eventType, limit });
            this.suspiciousActivityCount++;
            return false;
        }

        this.rateLimitMap.set(eventType, recentTimestamps);
        return true;
    }

    sanitizeData(data, maxDepth = 10) {
        if (maxDepth <= 0) {
            console.warn('Max sanitization depth exceeded');
            return null;
        }

        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            if (data.length > 50000) {
                console.warn('String too long, truncating');
                return data.substring(0, 50000);
            }
            return this._escapeHtml(data);
        }

        if (typeof data === 'number' || typeof data === 'boolean') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item, idx) => {
                if (idx > 1000) {
                    console.warn('Array too large, truncating');
                    return null;
                }
                return this.sanitizeData(item, maxDepth - 1);
            });
        }

        if (typeof data === 'object') {
            const sanitized = {};
            const keys = Object.keys(data);

            if (keys.length > 100) {
                console.warn('Object has too many keys');
                return null;
            }

            for (const key of keys) {
                if (!/^[a-zA-Z_$][a-zA-Z0-9_$\-\.]*$/.test(key)) {
                    console.warn(`⚠️ Invalid key name: ${key}`);
                    continue;
                }
                sanitized[key] = this.sanitizeData(data[key], maxDepth - 1);
            }
            return sanitized;
        }

        return null;
    }

    async _encryptPayload(data) {
        if (!this.serverPublicKey) {
            console.warn('No server public key configured for encryption');
            return null;
        }

        try {
            const encoder = new TextEncoder();
            const encoded = encoder.encode(JSON.stringify(data));

            const encrypted = await crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256",
                },
                this.serverPublicKey,
                encoded
            );

            return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        } catch (error) {
            console.error('Encryption failed:', error);
            this._logSecurityEvent('encryption_error', { error: error.message });
            return null;
        }
    }

    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    _containsSuspiciousContent(data) {
        const str = JSON.stringify(data).toLowerCase();

        if (/(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b|\bexec\b|\bexecute\b)/i.test(str)) {
            return true;
        }

        if (/(<script|javascript:|onerror=|onclick=|onload=|eval\(|function\()/i.test(str)) {
            return true;
        }

        if (/(setTimeout|setInterval|constructorFunction|__proto__|constructor)\s*(\(|=)/i.test(str)) {
            return true;
        }

        return false;
    }

    validateMessage(eventType, data) {
        if (!this.checkRateLimit(eventType)) {
            return false;
        }

        const serialized = JSON.stringify(data);
        if (serialized.length > this.MAX_MESSAGE_SIZE) {
            console.warn(`⚠️ Message too large: ${serialized.length} bytes (max: ${this.MAX_MESSAGE_SIZE})`);
            this.suspiciousActivityCount++;
            return false;
        }

        if (this._containsSuspiciousContent(data)) {
            console.warn('Suspicious content detected');
            this.suspiciousActivityCount++;
            return false;
        }

        return true;
    }

    validateIncomingMessage(message) {
        if (!this.validateIncomingMessages) {
            return true;
        }

        if (!message || typeof message !== 'object') {
            return false;
        }

        const { type, timestamp, nonce, userId, sessionId } = message;

        if (!type || !timestamp || !nonce) {
            console.warn('Incomplete message structure');
            return false;
        }

        const timeDiff = Math.abs(Date.now() - timestamp);
        if (timeDiff > this.TIMESTAMP_VALIDITY_WINDOW) {
            console.warn('Message timestamp too old');
            this._logSecurityEvent('old_timestamp', { timeDiff });
            return false;
        }

        if (!this._validateNonce(nonce)) {
            console.warn('Invalid or replayed nonce');
            this._logSecurityEvent('nonce_validation_failed', { nonce });
            return false;
        }

        if (userId && userId !== this.userId) {
            console.warn('Message from unauthorized user');
            this._logSecurityEvent('unauthorized_user', { messageUserId: userId });
            return false;
        }

        if (sessionId && sessionId !== this.sessionId) {
            console.warn('Message from different session');
            return false;
        }

        return true;
    }

    createSecureEnvelope(eventType, data) {
        const envelope = {
            type: eventType,
            payload: this.sanitizeData(data),
            timestamp: Date.now(),
            nonce: this._generateNonce(),
            userId: this.userId,
            sessionId: this.sessionId,
            version: '2.0',
            priority: data.priority || 'normal',
        };

        return envelope;
    }

    _securityNote() {
    }

    isSuspiciousActivityDetected() {
        return this.suspiciousActivityCount >= this.suspiciousActivityThreshold;
    }

    resetSuspiciousActivityCounter() {
        this.suspiciousActivityCount = 0;
    }

    _logSecurityEvent(eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            userId: this.userId,
            sessionId: this.sessionId,
            details,
        };

        this.securityLogs.push(logEntry);

        if (this.securityLogs.length > this.maxSecurityLogs) {
            this.securityLogs.shift();
        }

    }

    getSecurityLogs(limit = 50) {
        return this.securityLogs.slice(-limit);
    }

    async flushLogsToServer() {
        if (this.securityLogs.length === 0) return;

        try {
            const logsToSend = this.securityLogs.slice();

            await fetch('/api/audit/logs', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this._getCsrfToken(),
                },
                body: JSON.stringify({
                    logs: logsToSend,
                    sessionId: this.sessionId,
                }),
            });

            this.securityLogs = [];
        } catch (error) {
            console.error('Failed to flush logs to server:', error);
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
            suspiciousActivityCount: this.suspiciousActivityCount,
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketSecurityManager;
}

if (typeof window !== 'undefined') {
    window.WebSocketSecurityManager = WebSocketSecurityManager;
}
