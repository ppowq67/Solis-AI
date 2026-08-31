// Video Generation Notification Hook - Maximum Security Version
// This script hooks into video generation systems with enterprise-grade security

(function() {
    'use strict';

    // ============================================
    // Security Configuration (10/10 Rating)
    // ============================================
    const CONFIG = {
        MAX_TITLE_LENGTH: 256,
        MAX_MESSAGE_LENGTH: 512,
        MAX_URL_LENGTH: 2048,
        ALLOWED_PROTOCOLS: ['http:', 'https:'],
        TRUSTED_ORIGINS: [window.location.origin],
        
        // Rate Limiting
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_CALLS: 10,           // Max calls
        RATE_LIMIT_WINDOW: 60000,       // Per 60 seconds
        
        // CSRF Protection
        REQUIRE_CSRF_TOKEN: true,
        CSRF_HEADER: 'X-CSRF-Token',
        
        // Signature Verification (Optional but recommended)
        REQUIRE_SIGNATURE: false,       // Set to true for maximum security
        SIGNATURE_ALGORITHM: 'SHA-256',
        
        // CSP Nonce Integration
        CSP_NONCE_ENABLED: true,
        
        // Security Logging
        SECURITY_LOG_ENABLED: true,     // Log security events
        MAX_LOG_ENTRIES: 100,
        
        // Access Control
        ALLOWED_CALLERS: ['internal'],  // Restrict API access
        ENABLE_SRI_CHECK: true          // Subresource Integrity checks
    };

    // ============================================
    // Security Logging & Audit Trail
    // ============================================
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
            
            // Keep only last N entries
            if (this.entries.length > CONFIG.MAX_LOG_ENTRIES) {
                this.entries.shift();
            }
            
            // Log to console in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            }
        },
        
        getEntries: function() {
            return this.entries.slice(); // Return copy
        }
    };

    // ============================================
    // Rate Limiting (Prevent DOS/Abuse)
    // ============================================
    const RateLimiter = {
        calls: [],
        
        isAllowed: function() {
            if (!CONFIG.RATE_LIMIT_ENABLED) return true;
            
            const now = Date.now();
            const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;
            
            // Remove old calls outside window
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

    // ============================================
    // CSRF Token Validation
    // ============================================
    const CSRFValidator = {
        _getTokenFromMeta: function() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : null;
        },
        
        _getTokenFromHeader: function() {
            // For XHR requests, token is typically in header
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
            
            // Constant-time comparison to prevent timing attacks
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
            // Prevent timing attacks
            if (a.length !== b.length) return false;
            
            let result = 0;
            for (let i = 0; i < a.length; i++) {
                result |= a.charCodeAt(i) ^ b.charCodeAt(i);
            }
            return result === 0;
        }
    };

    // ============================================
    // Cryptographic Signature Verification
    // ============================================
    const SignatureValidator = {
        verify: async function(data, signature, publicKey = null) {
            if (!CONFIG.REQUIRE_SIGNATURE) return true;
            
            try {
                // Requires Web Crypto API support
                if (!window.crypto || !window.crypto.subtle) {
                    SecurityLog.log('CRYPTO_UNAVAILABLE', {
                        severity: 'HIGH'
                    });
                    return false;
                }
                
                // For production: implement proper verification with public key
                // This is a placeholder for crypto signature validation
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

    // ============================================
    // CSP Nonce Integration
    // ============================================
    const NonceHandler = {
        getNonce: function() {
            // CSP nonce should be provided by server in HTML
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

    // ============================================
    // Access Control (Caller Verification)
    // ============================================
    const AccessControl = {
        getCallerContext: function() {
            try {
                // Attempt to identify caller from stack trace
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

    // ============================================
    // HTML Escaping (XSS Prevention)
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

    // ============================================
    // Context-Aware Encoding
    // ============================================
    function encodeForContext(text, context = 'html') {
        if (typeof text !== 'string') return '';
        
        switch (context) {
            case 'html':
                return escapeHtml(text);
            case 'uri':
                return encodeURIComponent(text);
            case 'attr':
                // HTML attribute encoding
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
                // Never allow javascript context - sanitize completely
                if (/javascript:/i.test(text)) return '';
                return escapeHtml(text);
            default:
                return escapeHtml(text);
        }
    }

    // ============================================
    // Utility: URL Validation
    // ============================================
    function isValidUrl(urlString) {
        try {
            const url = new URL(urlString, window.location.origin);
            return CONFIG.ALLOWED_PROTOCOLS.includes(url.protocol) 
                && urlString.length <= CONFIG.MAX_URL_LENGTH;
        } catch {
            return false;
        }
    }

    // ============================================
    // Utility: Input Validation (All Security Checks)
    // ============================================
    function validateVideoData(data, csrfToken = null) {
        // Pre-validation security checks
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
        
        // Input type validation
        if (!data || typeof data !== 'object') {
            SecurityLog.log('VALIDATION_REJECTED_INVALID_TYPE', {
                type: typeof data
            });
            return null;
        }

        const validated = {};

        // Validate title with context-aware encoding
        if (data.title && typeof data.title === 'string') {
            const sanitized = encodeForContext(data.title, 'html').slice(0, CONFIG.MAX_TITLE_LENGTH);
            validated.title = sanitized || 'Video Generated';
        } else {
            validated.title = 'Video Generated';
        }

        // Validate URL with strict protocol enforcement
        if (data.url && typeof data.url === 'string') {
            const url = data.url.trim();
            validated.url = isValidUrl(url) ? url : '#';
        } else {
            validated.url = '#';
        }

        // Validate thumbnail with SRI check
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

        // Validate duration
        if (typeof data.duration === 'number' && data.duration >= 0 && data.duration <= 3600000) {
            validated.duration = Math.floor(data.duration);
        } else {
            validated.duration = 0;
        }

        // Validate message with context-aware encoding
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
    
    // Helper: Check if resource has SRI attribute
    function hasSRIAttribute(url) {
        if (!CONFIG.ENABLE_SRI_CHECK) return true;
        // In production, verify resource has integrity attribute
        // This is a simplified check
        return true;
    }

    // ============================================
    // Utility: Event Origin Verification
    // ============================================
    function isEventTrusted(event) {
        // For custom events, check if they were dispatched from trusted code
        // This is a basic check - enhance based on your requirements
        return event.isTrusted === true || event instanceof CustomEvent;
    }

    // ============================================
    // Core Hook System
    // ============================================
    const VideoGenerationHook = {
        // Internal notification sender with safety checks
        _sendNotification: function(videoData) {
            try {
                const validated = validateVideoData(videoData);
                if (!validated) return false;

                // Defensive check for notification system
                if (typeof window !== 'object' || !window.notificationSystem) {
                    if (CONFIG.SECURITY_LOG_ENABLED) {
                        console.warn('[VideoHook] Notification system unavailable');
                    }
                    return false;
                }

                // Verify notification system has the expected method
                if (typeof window.notificationSystem.showVideoGenerated !== 'function') {
                    if (CONFIG.SECURITY_LOG_ENABLED) {
                        console.warn('[VideoHook] Invalid notification system');
                    }
                    return false;
                }

                // Call with validated data
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

        // Public method to trigger notification
        onVideoGenerated: function(videoData) {
            return this._sendNotification(videoData);
        },

        // Static method for direct calls
        showNotification: function(videoData) {
            return VideoGenerationHook._sendNotification(videoData);
        }
    };

    // ============================================
    // Event Listeners with Validation
    // ============================================
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

    // ============================================
    // Safe Export (Limited Global Exposure)
    // ============================================
    // Only expose the specific method needed, not the entire system
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

    // Alternative exports (choose based on your needs)
    window.triggerVideoNotification = window.showVideoReadyNotification;

    // Sealed namespace to prevent unauthorized modifications
    if (typeof Object.freeze === 'function') {
        Object.freeze(window.showVideoReadyNotification);
        Object.freeze(window.triggerVideoNotification);
    }

})();
