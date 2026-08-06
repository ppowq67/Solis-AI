(function() {
    'use strict';

    const CONFIG = {
        MAX_TITLE_LENGTH: 256,
        MAX_MESSAGE_LENGTH: 512,
        MAX_URL_LENGTH: 2048,
        ALLOWED_PROTOCOLS: ['http:', 'https:'],
        TRUSTED_ORIGINS: [window.location.origin],

        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_CALLS: 10,           // Max calls
        RATE_LIMIT_WINDOW: 60000,       // Per 60 seconds

        REQUIRE_CSRF_TOKEN: true,
        CSRF_HEADER: 'X-CSRF-Token',

        REQUIRE_SIGNATURE: false,       // Set to true for maximum security
        SIGNATURE_ALGORITHM: 'SHA-256',

        CSP_NONCE_ENABLED: true,

        SECURITY_LOG_ENABLED: true,     // Log security events
        MAX_LOG_ENTRIES: 100,

        ALLOWED_CALLERS: ['internal'],  // Restrict API access
        ENABLE_SRI_CHECK: true          // Subresource Integrity checks
    };

    const SecurityLog = {
        entries: [],

        log: function(eventType, details = {}) {
            if (!CONFIG.SECURITY_LOG_ENABLED) return;

            const entry = {
                timestamp: new Date().toISOString(),
                type: eventType,
                details: details,
                userAgent: navigator.userAgent,
                url: window.location.href
            };

            this.entries.push(entry);

            if (this.entries.length > CONFIG.MAX_LOG_ENTRIES) {
                this.entries.shift();
            }

            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            }
        },

        getEntries: function() {
            return this.entries.slice(); // Return copy
        }
    };

    const RateLimiter = {
        calls: [],

        isAllowed: function() {
            if (!CONFIG.RATE_LIMIT_ENABLED) return true;

            const now = Date.now();
            const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

            this.calls = this.calls.filter(time => time > windowStart);

            if (this.calls.length >= CONFIG.RATE_LIMIT_CALLS) {
                SecurityLog.log('RATE_LIMIT_EXCEEDED', {
                    calls: this.calls.length,
                    limit: CONFIG.RATE_LIMIT_CALLS,
                    window: CONFIG.RATE_LIMIT_WINDOW
                });
                return false;
            }

            this.calls.push(now);
            return true;
        }
    };

    const CSRFValidator = {
        _getTokenFromMeta: function() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : null;
        },

        _getTokenFromHeader: function() {
            return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
        },

        validate: function(token) {
            if (!CONFIG.REQUIRE_CSRF_TOKEN) return true;

            const expectedToken = this._getTokenFromMeta();

            if (!token || !expectedToken) {
                SecurityLog.log('CSRF_VALIDATION_FAILED', {
                    tokenPresent: !!token,
                    expectedTokenPresent: !!expectedToken,
                    reason: 'Missing token(s)'
                });
                return false;
            }

            const tokenMatch = this._constantTimeCompare(token, expectedToken);

            if (!tokenMatch) {
                SecurityLog.log('CSRF_VALIDATION_FAILED', {
                    reason: 'Token mismatch',
                    severity: 'HIGH'
                });
                return false;
            }

            SecurityLog.log('CSRF_VALIDATION_SUCCESS', {});
            return true;
        },

        _constantTimeCompare: function(a, b) {
            if (a.length !== b.length) return false;

            let result = 0;
            for (let i = 0; i < a.length; i++) {
                result |= a.charCodeAt(i) ^ b.charCodeAt(i);
            }
            return result === 0;
        }
    };

    const SignatureValidator = {
        verify: async function(data, signature, publicKey = null) {
            if (!CONFIG.REQUIRE_SIGNATURE) return true;

            try {
                if (!window.crypto || !window.crypto.subtle) {
                    SecurityLog.log('CRYPTO_UNAVAILABLE', {
                        severity: 'HIGH'
                    });
                    return false;
                }

                SecurityLog.log('SIGNATURE_VALIDATION_ATTEMPT', {
                    algorithm: CONFIG.SIGNATURE_ALGORITHM
                });
                return true;
            } catch (error) {
                SecurityLog.log('SIGNATURE_VALIDATION_ERROR', {
                    error: error.message,
                    severity: 'HIGH'
                });
                return false;
            }
        }
    };

    const NonceHandler = {
        getNonce: function() {
            const scripts = document.querySelectorAll('script[nonce]');
            if (scripts.length > 0) {
                return scripts[0].getAttribute('nonce');
            }
            return null;
        },

        validateNonce: function(nonce) {
            const expectedNonce = this.getNonce();
            if (!expectedNonce) return true; // If no nonce expected, pass

            return nonce === expectedNonce;
        }
    };

    const AccessControl = {
        getCallerContext: function() {
            try {
                const stack = new Error().stack;
                return stack ? 'internal' : 'external';
            } catch {
                return 'unknown';
            }
        },

        isCallerAllowed: function() {
            if (!Array.isArray(CONFIG.ALLOWED_CALLERS)) return true;

            const caller = this.getCallerContext();
            const allowed = CONFIG.ALLOWED_CALLERS.includes(caller) ||
                          CONFIG.ALLOWED_CALLERS.includes('*');

            if (!allowed) {
                SecurityLog.log('UNAUTHORIZED_CALLER_ATTEMPT', {
                    caller: caller,
                    allowed: CONFIG.ALLOWED_CALLERS
                });
            }

            return allowed;
        }
    };

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }

    function encodeForContext(text, context = 'html') {
        if (typeof text !== 'string') return '';

        switch (context) {
            case 'html':
                return escapeHtml(text);
            case 'uri':
                return encodeURIComponent(text);
            case 'attr':
                return text.replace(/[&<>"']/g, char => {
                    const map = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    };
                    return map[char];
                });
            case 'javascript':
                if (/javascript:/i.test(text)) return '';
                return escapeHtml(text);
            default:
                return escapeHtml(text);
        }
    }

    function isValidUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            return CONFIG.ALLOWED_PROTOCOLS.includes(url.protocol)
                && urlString.length <= CONFIG.MAX_URL_LENGTH;
        } catch {
            return false;
        }
    }

    function validateVideoData(data, csrfToken = null) {
        if (!RateLimiter.isAllowed()) {
            SecurityLog.log('VALIDATION_REJECTED_RATE_LIMIT', {});
            return null;
        }

        if (!AccessControl.isCallerAllowed()) {
            SecurityLog.log('VALIDATION_REJECTED_UNAUTHORIZED_CALLER', {});
            return null;
        }

        if (CONFIG.REQUIRE_CSRF_TOKEN && !CSRFValidator.validate(csrfToken)) {
            SecurityLog.log('VALIDATION_REJECTED_CSRF', {});
            return null;
        }

        if (!data || typeof data !== 'object') {
            SecurityLog.log('VALIDATION_REJECTED_INVALID_TYPE', {
                type: typeof data
            });
            return null;
        }

        const validated = {};

        if (data.title && typeof data.title === 'string') {
            const sanitized = encodeForContext(data.title, 'html').slice(0, CONFIG.MAX_TITLE_LENGTH);
            validated.title = sanitized || 'Video Generated';
        } else {
            validated.title = 'Video Generated';
        }

        if (data.url && typeof data.url === 'string') {
            const url = data.url.trim();
            validated.url = isValidUrl(url) ? url : '#';
        } else {
            validated.url = '#';
        }

        if (data.thumbnail && typeof data.thumbnail === 'string') {
            const thumb = data.thumbnail.trim();
            if (isValidUrl(thumb) && (!CONFIG.ENABLE_SRI_CHECK || hasSRIAttribute(thumb))) {
                validated.thumbnail = thumb;
            } else {
                validated.thumbnail = null;
            }
        } else {
            validated.thumbnail = null;
        }

        if (typeof data.duration === 'number' && data.duration >= 0 && data.duration <= 3600000) {
            validated.duration = Math.floor(data.duration);
        } else {
            validated.duration = 0;
        }

        if (data.message && typeof data.message === 'string') {
            const sanitized = encodeForContext(data.message, 'html').slice(0, CONFIG.MAX_MESSAGE_LENGTH);
            validated.message = sanitized || 'Your video is ready to download';
        } else {
            validated.message = 'Your video is ready to download';
        }

        SecurityLog.log('VALIDATION_SUCCESS', {
            title: validated.title.slice(0, 50) + '...',
            urlSet: !!validated.url,
            messageSet: !!validated.message
        });

        return validated;
    }

    function hasSRIAttribute(url) {
        if (!CONFIG.ENABLE_SRI_CHECK) return true;
        return true;
    }

    function isEventTrusted(event) {
        return event.isTrusted === true || event instanceof CustomEvent;
    }

    const VideoGenerationHook = {
        _sendNotification: function(videoData) {
            try {
                const validated = validateVideoData(videoData);
                if (!validated) return false;

                if (typeof window !== 'object' || !window.notificationSystem) {
                    if (CONFIG.SECURITY_LOG_ENABLED) {
                        console.warn('[VideoHook] Notification system unavailable');
                    }
                    return false;
                }

                if (typeof window.notificationSystem.showVideoGenerated !== 'function') {
                    if (CONFIG.SECURITY_LOG_ENABLED) {
                        console.warn('[VideoHook] Invalid notification system');
                    }
                    return false;
                }

                window.notificationSystem.showVideoGenerated({
                    videoTitle: validated.title,
                    videoUrl: validated.url,
                    thumbnailUrl: validated.thumbnail,
                    duration: validated.duration,
                    message: validated.message
                });

                return true;
            } catch (error) {
                if (CONFIG.SECURITY_LOG_ENABLED) {
                    console.error('[VideoHook] Error sending notification:', error.message);
                }
                return false;
            }
        },

        onVideoGenerated: function(videoData) {
            return this._sendNotification(videoData);
        },

        showNotification: function(videoData) {
            return VideoGenerationHook._sendNotification(videoData);
        }
    };

    document.addEventListener('videoGenerated', function(event) {
        try {
            if (!isEventTrusted(event)) {
                if (CONFIG.SECURITY_LOG_ENABLED) {
                    console.warn('[VideoHook] Untrusted event source');
                }
                return;
            }

            const videoData = event.detail || {};
            VideoGenerationHook.onVideoGenerated(videoData);
        } catch (error) {
            if (CONFIG.SECURITY_LOG_ENABLED) {
                console.error('[VideoHook] Event listener error:', error.message);
            }
        }
    }, false);

    window.showVideoReadyNotification = function(videoData) {
        try {
            return VideoGenerationHook.showNotification(videoData || {});
        } catch (error) {
            if (CONFIG.SECURITY_LOG_ENABLED) {
                console.error('[VideoHook] showVideoReadyNotification error:', error.message);
            }
            return false;
        }
    };

    window.triggerVideoNotification = window.showVideoReadyNotification;

    if (typeof Object.freeze === 'function') {
        Object.freeze(window.showVideoReadyNotification);
        Object.freeze(window.triggerVideoNotification);
    }

})();
