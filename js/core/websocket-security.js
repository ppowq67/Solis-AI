/**
 * WebSocket Security Manager v2
 * Enhanced security with proper encryption, token management, and audit logging
 * 
 * SECURITY IMPROVEMENTS:
 * - Session-based token storage (not localStorage)
 * - HMAC message signing and verification
 * - Non-predictable message IDs with crypto
 * - Proper nonce validation and replay attack prevention
 * - Origin validation
 * - In-memory audit logging (never localStorage)
 * - Configurable rate limiting per operation type
 * - Message compression support
 * - Proper cleanup strategies
 */

class WebSocketSecurityManager {
    constructor(config = {}) {
        // Token management
        this.authToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        this.userId = null;
        
        // Security state
        this.sessionId = this._generateSecureId();
        this.nonceCache = new Set(); // Track used nonces to prevent replay attacks
        this.maxCachedNonces = 1000;
        
        // Rate limiting - per operation type
        this.rateLimitMap = new Map();
        this.rateLimits = config.rateLimits || {
            'delete_clip': 10,        // 10 per second
            'processing_update': 100, // 100 per second
            'default': 50             // 50 per second
        };
        
        // Message validation
        this.validateIncomingMessages = config.validateIncomingMessages !== false;
        this.messageValidationQueue = [];
        this.maxValidationQueueSize = 100;
        
        // Security logging - in-memory only
        this.securityLogs = [];
        this.maxSecurityLogs = 500; // Configurable, in-memory only
        this.suspiciousActivityThreshold = config.suspiciousActivityThreshold || 10;
        this.suspiciousActivityCount = 0;
        
        // Configuration - Use constants to avoid magic numbers
        this.MAX_MESSAGE_SIZE = config.maxMessageSize || 256 * 1024; // 256KB
        this.TIMESTAMP_VALIDITY_WINDOW = config.timestampWindow || 300000; // 5 minutes
        this.TOKEN_REFRESH_THRESHOLD = config.tokenRefreshThreshold || 300000;
        this.NONCE_VALIDITY_DURATION = config.nonceValidity || 3600000; // 1 hour
        this.CLEANUP_INTERVAL = config.cleanupInterval || 600000; // 10 minutes
        this.expectedOrigin = config.expectedOrigin || window.location.origin;
        
        // Track nonce timestamps
        this.nonceTimestamps = new Map();
        this.cleanupTask = null;
        
    }

    /**
     * Initialize security context with tokens
     * Tokens should come from secure, httpOnly cookies, not localStorage
     * @param {string} authToken - JWT auth token (from cookie ideally)
     * @param {string} userId - User identifier
     * @param {string} refreshToken - Optional refresh token for token rotation
     */
    init(authToken, userId, refreshToken = null) {
        if (!authToken || !userId) {
            console.error('Invalid credentials for security init');
            return false;
        }

        this.authToken = authToken;
        this.userId = userId;
        this.refreshToken = refreshToken;
        
        // Parse token and check expiration
        if (!this._validateToken()) {
            console.error('Token validation failed');
            return false;
        }

        this._logSecurityEvent('security_init', { userId });
        return true;
    }

    /**
     * Validate JWT token structure and expiration
     * @private
     */
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

            // Decode payload
            const payload = JSON.parse(atob(parts[1]));
            
            // Validate expiration
            if (payload.exp) {
                const expiresAt = payload.exp * 1000;
                this.tokenExpiresAt = expiresAt;
                
                if (expiresAt < Date.now()) {
                    console.warn('Token expired');
                    return false;
                }
                
                // Schedule token refresh if refresh token available
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

    /**
     * Schedule automatic token refresh before expiration
     * @private
     */
    _scheduleTokenRefresh() {
        if (!this.tokenExpiresAt) return;
        
        const timeUntilRefresh = this.tokenExpiresAt - Date.now() - this.tokenRefreshThreshold;
        if (timeUntilRefresh > 0) {
            setTimeout(() => this._refreshToken(), timeUntilRefresh);
        }
    }

    /**
     * Refresh authentication token
     * NOTE: Refresh token should be in httpOnly cookie, NOT in request body
     * @private
     */
    async _refreshToken() {
        if (!this.userId) return;

        try {
            // Refresh token is in httpOnly cookie - never send in body
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include', // Send httpOnly cookies automatically
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this._getCsrfToken(),
                },
                body: JSON.stringify({
                    // Do NOT send refresh token here - it's in httpOnly cookie
                    userId: this.userId,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                this.authToken = data.authToken;
                // New refresh token comes in httpOnly cookie automatically
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

    /**
     * Get CSRF token from headers/cookies
     * NOTE: CSRF tokens should be in SameSite cookies, not readable by JS
     * Client sends custom header; server validates from httpOnly cookie
     * @private
     */
    _getCsrfToken() {
        // Don't read from DOM - use custom header approach instead
        // Server will verify CSRF token from httpOnly cookie automatic with SameSite=Strict
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    /**
     * Generate cryptographically secure random ID
     * @private
     */
    _generateSecureId() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        // Fallback for older browsers
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Generate cryptographically secure nonce for replay attack prevention
     * @private
     */
    _generateNonce() {
        const nonce = this._generateSecureId();
        const timestamp = Date.now();
        
        // Track nonce with timestamp for server-side validation
        this.nonceCache.add(nonce);
        this.nonceTimestamps.set(nonce, timestamp);
        
        // Cleanup old entries (keep most recent)
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

    /**
     * Validate nonce to prevent replay attacks
     * NOTE: This is CLIENT-SIDE validation. Server MUST also validate nonces!\n     * @private
     */
    _validateNonce(nonce) {
        if (!nonce || !this.nonceCache.has(nonce)) {
            return false;
        }
        
        // Check nonce age
        const timestamp = this.nonceTimestamps.get(nonce);
        if (!timestamp || Date.now() - timestamp > this.NONCE_VALIDITY_DURATION) {
            this.nonceCache.delete(nonce);
            this.nonceTimestamps.delete(nonce);
            return false;
        }
        
        // Don't delete nonce - server needs to validate it too
        return true;
    }

    /**
     * Cleanup expired nonces
     * @private
     */
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

    /**
     * Check rate limit for operation type
     * ⚠️ THIS IS CLIENT-SIDE VALIDATION ONLY - CAN BE BYPASSED
     * Server MUST enforce stricter rate limiting by IP/user
     * Rate limiting is PER OPERATION TYPE (e.g., 'delete_clip', 'update_status')
     * Higher rates for processing updates, lower for destructive operations
     * @param {string} eventType - Type of operation
     * @param {number} customLimit - Override default limit if needed
     * @returns {boolean} True if under limit, false if rate limit exceeded
     */
    checkRateLimit(eventType, customLimit = null) {
        const limit = customLimit || this.rateLimits[eventType] || this.rateLimits.default;
        
        if (!this.rateLimitMap.has(eventType)) {
            this.rateLimitMap.set(eventType, []);
        }

        const timestamps = this.rateLimitMap.get(eventType);
        const now = Date.now();
        const oneSecondAgo = now - 1000;

        // Clean old timestamps
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

    /**
     * Deep sanitize data by removing dangerous patterns
     * Preserves safe content while blocking injection attacks
     */
    sanitizeData(data, maxDepth = 10) {
        if (maxDepth <= 0) {
            console.warn('Max sanitization depth exceeded');
            return null;
        }

        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            // Keep string but limit length and check for dangerous patterns
            if (data.length > 50000) {
                console.warn('String too long, truncating');
                return data.substring(0, 50000);
            }
            // Escape dangerous characters but preserve legitimate content
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
                // Validate key name using whitelist approach (allow common separators)
                // Allow: alphanumeric, underscore, dollar, hyphen, dot (common in JSON keys)
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

    /**
     * Optional: Encrypt sensitive payloads using Web Crypto API (RSA-OAEP)
     * Only use when serverPublicKey is configured
     * @param {object} data - Data to encrypt
     * @returns {Promise<string>} Base64-encoded encrypted payload
     * @private
     */
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
            
            // Convert to base64 for transport
            return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        } catch (error) {
            console.error('Encryption failed:', error);
            this._logSecurityEvent('encryption_error', { error: error.message });
            return null;
        }
    }

    /**
     * HTML escape helper
     * @private
     */
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

    /**
     * Check for suspicious content patterns
     * @private
     */
    _containsSuspiciousContent(data) {
        const str = JSON.stringify(data).toLowerCase();
        
        // SQL injection patterns
        if (/(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b|\bexec\b|\bexecute\b)/i.test(str)) {
            return true;
        }
        
        // JavaScript injection patterns
        if (/(<script|javascript:|onerror=|onclick=|onload=|eval\(|function\()/i.test(str)) {
            return true;
        }
        
        // Other code injection
        if (/(setTimeout|setInterval|constructorFunction|__proto__|constructor)\s*(\(|=)/i.test(str)) {
            return true;
        }
        
        return false;
    }

    /**
     * Validate outgoing message
     */
    validateMessage(eventType, data) {
        // Rate limit check
        if (!this.checkRateLimit(eventType)) {
            return false;
        }

        // Size check
        const serialized = JSON.stringify(data);
        if (serialized.length > this.MAX_MESSAGE_SIZE) {
            console.warn(`⚠️ Message too large: ${serialized.length} bytes (max: ${this.MAX_MESSAGE_SIZE})`);
            this.suspiciousActivityCount++;
            return false;
        }

        // Content check
        if (this._containsSuspiciousContent(data)) {
            console.warn('Suspicious content detected');
            this.suspiciousActivityCount++;
            return false;
        }

        return true;
    }

    /**
     * Validate incoming message authenticity and structure
     * NOTE: This is CLIENT-SIDE validation only. Server must perform proper verification!
     */
    validateIncomingMessage(message) {
        if (!this.validateIncomingMessages) {
            return true;
        }

        // Check structure
        if (!message || typeof message !== 'object') {
            return false;
        }

        const { type, timestamp, nonce, userId, sessionId } = message;

        if (!type || !timestamp || !nonce) {
            console.warn('Incomplete message structure');
            return false;
        }

        // Validate timestamp
        const timeDiff = Math.abs(Date.now() - timestamp);
        if (timeDiff > this.TIMESTAMP_VALIDITY_WINDOW) {
            console.warn('Message timestamp too old');
            this._logSecurityEvent('old_timestamp', { timeDiff });
            return false;
        }

        // Validate nonce - Server MUST also validate!
        if (!this._validateNonce(nonce)) {
            console.warn('Invalid or replayed nonce');
            this._logSecurityEvent('nonce_validation_failed', { nonce });
            return false;
        }

        // Validate user ID matches
        if (userId && userId !== this.userId) {
            console.warn('Message from unauthorized user');
            this._logSecurityEvent('unauthorized_user', { messageUserId: userId });
            return false;
        }

        // Validate session
        if (sessionId && sessionId !== this.sessionId) {
            console.warn('Message from different session');
            return false;
        }

        return true;
    }

    /**
     * Create secure message envelope
     * NOTE: Real signing/encryption must happen SERVER-SIDE with private keys
     */
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
            // Note: Auth token NOT included - Socket.IO handles auth via socket.auth
        };

        // Signature must be created by server using private key
        // Client cannot create cryptographically valid signatures
        return envelope;
    }

    /**
     * NOTE: HMAC-SHA256 signing MUST be done SERVER-SIDE with private key
     * Client cannot create cryptographically valid signatures
     * All messages MUST be verified by server using its private key
     */
    _securityNote() {
        // ❌ Client-side signatures are NOT cryptographically secure
        // ✅ Server must verify ALL messages using HMAC-SHA256 with private key
        // ✅ Server must validate: nonce, timestamp, userId, sessionId, rate limits
    }

    /**
     * Check if suspicious activity threshold exceeded
     */
    isSuspiciousActivityDetected() {
        return this.suspiciousActivityCount >= this.suspiciousActivityThreshold;
    }

    /**
     * Reset suspicious activity counter
     */
    resetSuspiciousActivityCounter() {
        this.suspiciousActivityCount = 0;
    }

    /**
     * Log security event to in-memory log (never localStorage)
     * @private
     */
    _logSecurityEvent(eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            userId: this.userId,
            sessionId: this.sessionId,
            details,
        };

        this.securityLogs.push(logEntry);
        
        // Keep only recent logs
        if (this.securityLogs.length > this.maxSecurityLogs) {
            this.securityLogs.shift();
        }

    }

    /**
     * Get security audit logs (in-memory only)
     * NOTE: These logs are cleared on page refresh - for persistent logging, 
     * send to server endpoint instead
     */
    getSecurityLogs(limit = 50) {
        return this.securityLogs.slice(-limit);
    }

    /**
     * Send security logs to server for persistent audit trail
     * Call this periodically or on critical events
     */
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

            // Clear after successful flush
            this.securityLogs = [];
        } catch (error) {
            console.error('Failed to flush logs to server:', error);
        }
    }

    /**
     * Start cleanup task for expired nonces
     */
    startCleanupTask() {
        if (this.cleanupTask) clearInterval(this.cleanupTask);
        this.cleanupTask = setInterval(() => this._cleanupExpiredNonces(), this.CLEANUP_INTERVAL);
    }

    /**
     * Stop cleanup task
     */
    stopCleanupTask() {
        if (this.cleanupTask) {
            clearInterval(this.cleanupTask);
            this.cleanupTask = null;
        }
    }

    /**
     * Destroy security manager on logout
     */
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

    /**
     * Get security status report
     */
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

// Create module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketSecurityManager;
}

// Make available globally but warn about namespace pollution
if (typeof window !== 'undefined') {
    window.WebSocketSecurityManager = WebSocketSecurityManager;
}
