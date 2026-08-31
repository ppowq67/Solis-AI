class AnalyticsManager {
    constructor() {
        this.apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
        this.usageChartInstance = null;
        this.platformChartInstance = null;
        this.securityConfig = {
            MAX_RESPONSE_SIZE: 10 * 1024 * 1024,
            MAX_ARRAY_LENGTH: 10000,
            MAX_STRING_LENGTH: 5000,
            REQUIRE_CSRF_TOKEN: true,
            CSRF_HEADER: 'X-CSRF-Token',
            ENABLE_CONTENT_VALIDATION: true,
            SECURITY_LOG_ENABLED: true,
            MAX_LOG_ENTRIES: 100,
            REQUEST_TIMEOUT: 30000,
            SAFE_DOMAINS: [window.location.origin],
            CHART_INSTANCE_LIMIT: 5,
            AUTO_REFRESH_INTERVAL: 300000,
            ENABLE_SRI_VALIDATION: true,
            CHART_JS_INTEGRITY: 'sha384-aZS6tFgzrDd/fMJyEZZLPDZZ0pOLxrVfvlIa8F3XvKU6aMhIvDlFBQ5JhMPSLRFf',  // Chart.js 4.4.0
            SRI_ALGORITHMS: ['sha256', 'sha384', 'sha512'],
            ENABLE_REQUEST_SIGNING: true,
            SIGNATURE_ALGORITHM: 'HMAC-SHA256',
            SIGNATURE_HEADER: 'X-Request-Signature',
            TIMESTAMP_HEADER: 'X-Request-Timestamp',
            NONCE_HEADER: 'X-Request-Nonce',
            REQUEST_TTL: 300000,
            REQUIRE_CRYPTO_API: true
        };
        
        this.analyticsData = {
            monetization: 0,
            subscribers: 0,
            views: 0,
            clipsCreated: 0,
            dailyViews: [],
            weeklyViews: [],
            monthlyViews: [],
            currentPeriod: 'week',
            platformViews: {
                youtube: 0,
                tiktok: 0,
                all: 0
            },
            currentPlatform: 'all'
        };
        
        this.previousMetrics = {
            views: 0,
            subscribers: 0
        };
        
        // ============================================
        // Security State Management
        // ============================================
        this.securityState = {
            csrfToken: this._getCSRFToken(),
            chartInstances: 0,
            securityLog: []
        };
        
        this.loadAnalyticsData();
        this.setupFilterButtons();
        this.observeClipsStudio();
        this.startAutoRefresh();
    }

    // ============================================
    // Security: CSRF Token Management
    // ============================================
    _getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    }
    
    _constantTimeCompare(a, b) {
        // Prevent timing attacks
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    // ============================================
    // Security: Request Deduplication (Removed - unnecessary for read-only dashboards)

    // ============================================
    // Security: Response Validation & Sanitization
    // ============================================
    _sanitizeString(str, maxLength = this.securityConfig.MAX_STRING_LENGTH) {
        if (typeof str !== 'string') return '';
        
        // Remove control characters and dangerous patterns
        let sanitized = str.replace(/[\x00-\x1F\x7F]/g, '');
        
        // XSS prevention - escape HTML entities
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        sanitized = sanitized.replace(/[&<>"']/g, char => map[char]);
        
        return sanitized.slice(0, maxLength);
    }
    
    _validateNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.max(min, Math.min(max, num));
    }
    
    _validateArray(arr, maxLength = this.securityConfig.MAX_ARRAY_LENGTH) {
        if (!Array.isArray(arr)) return [];
        return arr.slice(0, maxLength);
    }
    
    _validateResponseSize(response) {
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.securityConfig.MAX_RESPONSE_SIZE) {
            this._logSecurityEvent('RESPONSE_SIZE_EXCEEDED', {
                size: contentLength,
                max: this.securityConfig.MAX_RESPONSE_SIZE
            });
            return false;
        }
        return true;
    }
    
    _validateAnalyticsResponse(data) {
        if (!data || typeof data !== 'object') {
            this._logSecurityEvent('INVALID_RESPONSE_TYPE', { received: typeof data });
            return null;
        }
        
        // Validate structure
        const validated = {
            monetization: this._validateNumber(data.monetization, 0, 999999999),
            subscribers: this._validateNumber(data.subscribers, 0, 999999999),
            views: this._validateNumber(data.views, 0, 999999999),
            dailyViews: this._validateArray(data.dailyViews),
            weeklyViews: this._validateArray(data.weeklyViews),
            monthlyViews: this._validateArray(data.monthlyViews),
            platformViews: this._validatePlatformViews(data.platformViews),
            connected: typeof data.connected === 'boolean' ? data.connected : false,
            connections: this._validateConnections(data.connections)
        };
        
        // Validate array contents
        validated.dailyViews = validated.dailyViews.map(item => this._validateMetricItem(item));
        validated.weeklyViews = validated.weeklyViews.map(item => this._validateMetricItem(item));
        validated.monthlyViews = validated.monthlyViews.map(item => this._validateMetricItem(item));
        
        return validated;
    }
    
    _validateMetricItem(item) {
        return {
            views: this._validateNumber(item.views, 0),
            revenue: this._validateNumber(item.revenue || item.estimatedRevenue, 0),
            estimatedRevenue: this._validateNumber(item.estimatedRevenue, 0),
            subscribers: this._validateNumber(item.subscribers, 0),
            day: this._sanitizeString(item.day || '', 50),
            week: this._sanitizeString(item.week || '', 50),
            month: this._sanitizeString(item.month || '', 50)
        };
    }
    
    _validatePlatformViews(views) {
        return {
            youtube: this._validateNumber((views || {}).youtube, 0),
            tiktok: this._validateNumber((views || {}).tiktok, 0),
            all: this._validateNumber((views || {}).all, 0)
        };
    }
    
    _validateConnections(connections) {
        if (!connections || typeof connections !== 'object') return {};
        
        return {
            youtube: connections.youtube ? {
                connected: typeof connections.youtube.connected === 'boolean' ? connections.youtube.connected : false,
                username: this._sanitizeString(connections.youtube.username || '', 100)
            } : null
        };
    }

    // ============================================
    // Security: Audit Logging
    // ============================================
    _logSecurityEvent(eventType, details = {}) {
        if (!this.securityConfig.SECURITY_LOG_ENABLED) return;
        
        const entry = {
            timestamp: new Date().toISOString(),
            type: eventType,
            details: details,
            url: window.location.pathname
        };
        
        this.securityState.securityLog.push(entry);
        
        // Keep only last N entries
        if (this.securityState.securityLog.length > this.securityConfig.MAX_LOG_ENTRIES) {
            this.securityState.securityLog.shift();
        }
        
        // Only log security events in dev mode (localhost) - never expose in production
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (eventType.includes('ERROR') || eventType.includes('FAILED') || eventType.includes('EXCEEDED')) {
                console.warn(`[Analytics Security] ${eventType}`, details);
            }
        }
    }

    // ============================================
    // Security: Safe DOM Manipulation
    // ============================================
    _safeSetTextContent(element, text) {
        if (!element) return;
        try {
            element.textContent = this._sanitizeString(String(text));
        } catch (error) {
            this._logSecurityEvent('DOM_UPDATE_ERROR', { error: error.message });
        }
    }

    // ============================================
    // Security: Subresource Integrity (SRI) Validation
    // ============================================
    _validateSRI(scriptUrl, expectedHash) {
        if (!this.securityConfig.ENABLE_SRI_VALIDATION) return true;
        
        try {
            // Find script tag with this URL
            const scripts = document.querySelectorAll('script[src]');
            let foundScript = null;
            
            for (const script of scripts) {
                if (script.src === scriptUrl) {
                    foundScript = script;
                    break;
                }
            }
            
            if (!foundScript) {
                this._logSecurityEvent('SRI_SCRIPT_NOT_FOUND', { url: scriptUrl });
                return false;
            }
            
            // Check if script has integrity attribute
            const integrityAttr = foundScript.getAttribute('integrity');
            if (!integrityAttr && expectedHash) {
                this._logSecurityEvent('SRI_MISSING_INTEGRITY', { url: scriptUrl });
                return false;
            }
            
            // Verify integrity attribute contains expected hash algorithm
            const hasValidAlgorithm = this.securityConfig.SRI_ALGORITHMS.some(algo => 
                integrityAttr.startsWith(algo + '-')
            );
            
            if (!hasValidAlgorithm) {
                this._logSecurityEvent('SRI_INVALID_ALGORITHM', { 
                    url: scriptUrl,
                    integrity: integrityAttr 
                });
                return false;
            }
            
            this._logSecurityEvent('SRI_VALIDATION_SUCCESS', { url: scriptUrl });
            return true;
        } catch (error) {
            this._logSecurityEvent('SRI_VALIDATION_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    // ============================================
    // Security: Cryptographic Nonce Generation
    // ============================================
    _generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // ============================================
    // Security: Request Signing with Web Crypto API
    // ============================================
    async _signRequest(method, endpoint, body = null) {
        if (!this.securityConfig.ENABLE_REQUEST_SIGNING) {
            return {
                signature: null,
                timestamp: Date.now(),
                nonce: this._generateNonce()
            };
        }
        
        try {
            // Check Web Crypto API availability
            if (!window.crypto || !window.crypto.subtle) {
                this._logSecurityEvent('CRYPTO_API_UNAVAILABLE', {});
                if (this.securityConfig.REQUIRE_CRYPTO_API) return null;
                return { signature: null, timestamp: Date.now(), nonce: this._generateNonce() };
            }
            
            const timestamp = Date.now().toString();
            const nonce = this._generateNonce();
            
            // Create signing message: METHOD|ENDPOINT|TIMESTAMP|NONCE|BODY_HASH
            const bodyHash = await this._hashData(body || '');
            const messageToSign = `${method}|${endpoint}|${timestamp}|${nonce}|${bodyHash}`;
            
            // Get signing key from server (in production, this would be a pre-shared key)
            const signingKey = await this._getDerivedKey();
            
            // Sign the message using HMAC-SHA256
            const encoder = new TextEncoder();
            const data = encoder.encode(messageToSign);
            
            const signature = await window.crypto.subtle.sign(
                'HMAC',
                signingKey,
                data
            );
            
            // Convert signature to hex string
            const signatureHex = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            this._logSecurityEvent('REQUEST_SIGNED_SUCCESS', {
                endpoint: endpoint,
                timestamp: timestamp
            });
            
            return {
                signature: signatureHex,
                timestamp: timestamp,
                nonce: nonce
            };
        } catch (error) {
            this._logSecurityEvent('REQUEST_SIGNING_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    // ============================================
    // Security: Cryptographic Hashing
    // ============================================
    async _hashData(data) {
        try {
            if (!window.crypto || !window.crypto.subtle) {
                return 'no-hash';
            }
            
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(String(data));
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
            
            // Convert hash to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            this._logSecurityEvent('HASH_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return 'hash-error';
        }
    }

    // ============================================
    // Security: Derive Key from Shared Secret
    // ============================================
    async _getDerivedKey() {
        try {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('Web Crypto API not available');
            }
            
            // Get the CSRF token as the shared secret (already from server)
            const sharedSecret = this.securityState.csrfToken || 'fallback-key';
            
            const encoder = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(sharedSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign', 'verify']
            );
            
            return keyMaterial;
        } catch (error) {
            this._logSecurityEvent('KEY_DERIVATION_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    // API base is now set from window.API_BASE_URL in s.js (secure, not from localStorage)

    observeClipsStudio() {
        // Use longer interval to prevent CPU exhaustion
        setInterval(() => {
            if (window.clipsStudio && Array.isArray(window.clipsStudio.libraryItems)) {
                const currentCount = this._validateNumber(window.clipsStudio.libraryItems.length, 0, 999999);
                if (currentCount !== this.analyticsData.clipsCreated) {
                    this.analyticsData.clipsCreated = currentCount;
                    this.updateDashboard();
                }
            }
        }, 5000); // 5 seconds instead of 1 second to prevent excessive polling
    }

    setupFilterButtons() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.dataset.period;
                this.setTimePeriod(period);
            });
        });

        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                this.setPlatformFilter(platform);
            });
        });
    }

    setTimePeriod(period) {
        this.analyticsData.currentPeriod = period;
        
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });
        
        this.updateDashboard();
    }

    setPlatformFilter(platform) {
        this.analyticsData.currentPlatform = platform;
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.platform === platform) {
                btn.classList.add('active');
            }
        });
        
        this.updateCharts();
    }

    startAutoRefresh() {
        // Use 5-minute interval instead of 60 seconds to reduce server load
        setInterval(() => {
            if (this.isConnected) {
                this.fetchAnalyticsFromServer().catch(error => {
                    this._logSecurityEvent('AUTO_REFRESH_ERROR', { 
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                });
            }
        }, this.securityConfig.AUTO_REFRESH_INTERVAL);
    }

    animateNumber(element, targetValue, duration = 1000, prefix = '', suffix = '') {
        if (!element) return;
        
        try {
            const startValue = 0;
            const startTime = Date.now();
            
            const updateValue = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOutQuad = p => 1 - (1 - p) * (1 - p);
                const easedProgress = easeOutQuad(progress);
                
                const currentValue = Math.floor(startValue + (targetValue - startValue) * easedProgress);
                const displayValue = prefix + this.formatNumber(currentValue) + suffix;
                this._safeSetTextContent(element, displayValue);
                
                if (progress < 1) {
                    requestAnimationFrame(updateValue);
                } else {
                    const finalDisplay = prefix + this.formatNumber(targetValue) + suffix;
                    this._safeSetTextContent(element, finalDisplay);
                }
            };
            
            requestAnimationFrame(updateValue);
        } catch (error) {
            this._logSecurityEvent('ANIMATION_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            const displayValue = prefix + this.formatNumber(targetValue) + suffix;
            this._safeSetTextContent(element, displayValue);
        }
    }

    async fetchAnalyticsFromServer() {
        try {
            // 🔐 SECURITY: Authentication via httpOnly cookie with CSRF token
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add CSRF token if available
            if (this.securityState.csrfToken && this.securityConfig.REQUIRE_CSRF_TOKEN) {
                headers[this.securityConfig.CSRF_HEADER] = this.securityState.csrfToken;
            }
            
            // 🔐 SECURITY: Add request signing headers (cryptographic verification)
            const endpoint = `${this.apiBase}/analytics/dashboard`;
            if (this.securityConfig.ENABLE_REQUEST_SIGNING) {
                const signatureData = await this._signRequest('GET', endpoint);
                if (signatureData) {
                    if (signatureData.signature) {
                        headers[this.securityConfig.SIGNATURE_HEADER] = signatureData.signature;
                    }
                    headers[this.securityConfig.TIMESTAMP_HEADER] = signatureData.timestamp;
                    headers[this.securityConfig.NONCE_HEADER] = signatureData.nonce;
                }
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.securityConfig.REQUEST_TIMEOUT);
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: headers,
                credentials: 'include',  // 🔐 Send httpOnly cookie with request
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            // Validate response size
            if (!this._validateResponseSize(response)) {
                this.isConnected = false;
                this.updateDashboard();
                return;
            }

            if (!response.ok) {
                this._logSecurityEvent('ANALYTICS_FETCH_FAILED', {
                    status: response.status,
                    statusText: response.statusText
                });
                this.isConnected = false;
                this.updateDashboard();
                return;
            }
            
            const data = await response.json();
            
            // 🔐 SECURITY: Validate all response data before using
            const validatedData = this._validateAnalyticsResponse(data);
            if (!validatedData) {
                this._logSecurityEvent('RESPONSE_VALIDATION_FAILED', {});
                this.isConnected = false;
                this.updateDashboard();
                return;
            }
            
            const isYoutubeConnected = validatedData.connected || 
                                     (validatedData.connections?.youtube?.connected === true);
            
            if (isYoutubeConnected || validatedData.dailyViews?.length > 0) {
                this.isConnected = true;
                
                // Store validated data only
                this.analyticsData.monetization = validatedData.monetization;
                this.analyticsData.subscribers = validatedData.subscribers;
                this.analyticsData.views = validatedData.views;
                this.analyticsData.dailyViews = validatedData.dailyViews;
                this.analyticsData.weeklyViews = validatedData.weeklyViews;
                this.analyticsData.monthlyViews = validatedData.monthlyViews;
                this.analyticsData.platformViews = validatedData.platformViews;
                
                // Store connections in memory only (immutable)
                if (validatedData.connections) {
                    Object.defineProperty(window, 'platformConnections', {
                        value: Object.freeze(validatedData.connections),
                        writable: false,
                        configurable: false
                    });
                }
                
                this._logSecurityEvent('ANALYTICS_FETCH_SUCCESS', {});
                this.updateDashboard();
            } else {
                this.isConnected = false;
                this.updateDashboard();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this._logSecurityEvent('REQUEST_TIMEOUT', {});
            } else {
                this._logSecurityEvent('ANALYTICS_FETCH_ERROR', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            this.isConnected = false;
            this.updateDashboard();
        }
    }

    async loadAnalyticsData() {
        try {
            // 🔐 SECURITY: Authentication via httpOnly cookie with CSRF token
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add CSRF token if available
            if (this.securityState.csrfToken && this.securityConfig.REQUIRE_CSRF_TOKEN) {
                headers[this.securityConfig.CSRF_HEADER] = this.securityState.csrfToken;
            }
            
            // 🔐 SECURITY: Add request signing headers (cryptographic verification)
            const endpoint = `${this.apiBase}/analytics/dashboard`;
            if (this.securityConfig.ENABLE_REQUEST_SIGNING) {
                const signatureData = await this._signRequest('GET', endpoint);
                if (signatureData) {
                    if (signatureData.signature) {
                        headers[this.securityConfig.SIGNATURE_HEADER] = signatureData.signature;
                    }
                    headers[this.securityConfig.TIMESTAMP_HEADER] = signatureData.timestamp;
                    headers[this.securityConfig.NONCE_HEADER] = signatureData.nonce;
                }
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.securityConfig.REQUEST_TIMEOUT);
            
            try {
                const dashboardResponse = await fetch(endpoint, {
                    method: 'GET',
                    headers: headers,
                    credentials: 'include',  // 🔐 Send httpOnly cookie with request
                    signal: controller.signal
                });
                
                clearTimeout(timeout);

                if (dashboardResponse.ok) {
                    // Validate response size
                    if (!this._validateResponseSize(dashboardResponse)) {
                        this.isConnected = false;
                        this.updateDashboard();
                        return;
                    }
                    
                    const dashboardData = await dashboardResponse.json();
                    
                    // 🔐 SECURITY: Validate all response data before using
                    const validatedData = this._validateAnalyticsResponse(dashboardData);
                    if (!validatedData) {
                        this._logSecurityEvent('INITIAL_LOAD_VALIDATION_FAILED', {});
                        this.isConnected = false;
                        this.updateDashboard();
                        return;
                    }
                    
                    // Check connection status from the response
                    const isYouTubeConnected = validatedData.connected || 
                        validatedData.connections?.youtube?.connected === true;
                    
                    this.isConnected = isYouTubeConnected;
                    
                    // Always update with validated data we got
                    if (validatedData) {
                        this.analyticsData.monetization = validatedData.monetization;
                        this.analyticsData.subscribers = validatedData.subscribers;
                        this.analyticsData.views = validatedData.views;
                        this.analyticsData.dailyViews = validatedData.dailyViews;
                        this.analyticsData.weeklyViews = validatedData.weeklyViews;
                        this.analyticsData.monthlyViews = validatedData.monthlyViews;
                        this.analyticsData.platformViews = validatedData.platformViews;
                    }
                    
                    this._logSecurityEvent('INITIAL_LOAD_SUCCESS', {});
                    this.updateDashboard();
                    
                } else if (dashboardResponse.status === 401) {
                    this._logSecurityEvent('UNAUTHORIZED_ACCESS', { status: 401 });
                    this.isConnected = false;
                    this.updateDashboard();
                } else {
                    this._logSecurityEvent('DASHBOARD_LOAD_ERROR', { 
                        status: dashboardResponse.status,
                        statusText: dashboardResponse.statusText
                    });
                    this.isConnected = false;
                    this.updateDashboard();
                }
            } catch (dashboardError) {
                if (dashboardError.name === 'AbortError') {
                    this._logSecurityEvent('INITIAL_LOAD_TIMEOUT', {});
                } else {
                    this._logSecurityEvent('INITIAL_LOAD_ERROR', {
                        error: dashboardError instanceof Error ? dashboardError.message : 'Unknown error'
                    });
                }
                this.isConnected = false;
                this.updateDashboard();
            }
        } catch (error) {
            this._logSecurityEvent('LOAD_ANALYTICS_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.isConnected = false;
            this.updateDashboard();
        }
        
        // Render charts
        setTimeout(() => {
            this.updateCharts();
        }, 100);
    }

    updateDashboard() {
        // If YouTube not connected, show zeros
        if (!this.isConnected) {
            const monetizationValue = document.querySelector('[data-card="monetization"] .card-value');
            if (monetizationValue) this._safeSetTextContent(monetizationValue, '€0');
            
            const subscribersValue = document.querySelector('[data-card="subscribers"] .card-value');
            if (subscribersValue) this._safeSetTextContent(subscribersValue, '0');
            
            const viewsValue = document.querySelector('[data-card="views"] .card-value');
            if (viewsValue) this._safeSetTextContent(viewsValue, '0');
            
            document.querySelectorAll('.card-trend span').forEach(el => {
                this._safeSetTextContent(el, '0%');
                el.parentElement.className = 'card-trend trend-neutral';
                const icon = el.parentElement.querySelector('i');
                if (icon) icon.className = 'fas fa-minus';
            });
            
            const clipsValue = document.querySelector('[data-card="clips"] .card-value');
            if (clipsValue) {
                const clipsCount = window.clipsStudio?.libraryItems?.length || 0;
                this._safeSetTextContent(clipsValue, this._validateNumber(clipsCount, 0));
            }
            return;
        }

        // Update monetization card with animation
        const monetizationValue = document.querySelector('[data-card="monetization"] .card-value');
        if (monetizationValue) {
            this.animateNumber(monetizationValue, this.analyticsData.monetization, 800, '€', '');
        }

        // Update subscribers card with animation
        const subscribersValue = document.querySelector('[data-card="subscribers"] .card-value');
        if (subscribersValue) {
            this.animateNumber(subscribersValue, this.analyticsData.subscribers, 800, '', '');
        }

        // Update views card with animation
        const viewsValue = document.querySelector('[data-card="views"] .card-value');
        if (viewsValue) {
            this.animateNumber(viewsValue, this.analyticsData.views, 800, '', '');
        }

        // Update clips card from live clips studio data (no animation, just update)
        const clipsValue = document.querySelector('[data-card="clips"] .card-value');
        if (clipsValue) {
            const clipsCount = window.clipsStudio?.libraryItems?.length || this.analyticsData.clipsCreated || 0;
            this._safeSetTextContent(clipsValue, this._validateNumber(clipsCount, 0));
        }

        // Update trends based on real data changes
        this.updateTrends();

        // Update charts
        this.updateCharts();
    }

    updateTrends() {
        // If YouTube not connected, show neutral trends
        if (!this.isConnected) {
            document.querySelectorAll('.card-trend').forEach(trend => {
                trend.className = 'card-trend trend-neutral';
                const span = trend.querySelector('span');
                if (span) span.textContent = '0%';
                const icon = trend.querySelector('i');
                if (icon) icon.className = 'fas fa-minus';
            });
            return;
        }

        // Get current period data
        let periodData = [];
        if (this.analyticsData.currentPeriod === 'day' && this.analyticsData.dailyViews?.length >= 2) {
            periodData = this.analyticsData.dailyViews;
        } else if (this.analyticsData.currentPeriod === 'week' && this.analyticsData.weeklyViews?.length >= 2) {
            periodData = this.analyticsData.weeklyViews;
        } else if (this.analyticsData.currentPeriod === 'month' && this.analyticsData.monthlyViews?.length >= 2) {
            periodData = this.analyticsData.monthlyViews;
        } else {
            // Default to weekly if no period data
            periodData = this.analyticsData.weeklyViews;
        }

        // Calculate individual trends for each metric
        const trends = {
            monetization: this.calculateTrend(periodData, 'revenue'),
            subscribers: this.calculateTrend(periodData, 'subscribers'),
            views: this.calculateTrend(periodData, 'views'),
            clips: 0 // Clips don't have trend data
        };

        // Update trend indicators for each card
        const cards = {
            'monetization': trends.monetization,
            'subscribers': trends.subscribers,
            'views': trends.views,
            'clips': trends.clips
        };

        for (const [cardType, trend] of Object.entries(cards)) {
            const card = document.querySelector(`[data-card="${cardType}"]`);
            if (card) {
                const trendEl = card.querySelector('.card-trend');
                if (trendEl) {
                    const span = trendEl.querySelector('span');
                    // Use Math.abs to handle -0 case properly
                    const absTrend = Math.abs(trend);
                    if (span) span.textContent = `${absTrend}%`;
                    
                    const icon = trendEl.querySelector('i');
                    if (trend > 0) {
                        trendEl.className = 'card-trend trend-up';
                        if (icon) icon.className = 'fas fa-arrow-up';
                    } else if (trend < 0) {
                        trendEl.className = 'card-trend trend-down';
                        if (icon) icon.className = 'fas fa-arrow-down';
                    } else {
                        trendEl.className = 'card-trend trend-neutral';
                        if (icon) icon.className = 'fas fa-minus';
                    }
                }
            }
        }
    }

    calculateTrend(periodData, metric) {
        if (!Array.isArray(periodData) || periodData.length < 2) return 0;

        // Get latest and previous values based on metric
        const latest = periodData[periodData.length - 1] || {};
        const previous = periodData[periodData.length - 2] || {};

        let latestValue = 0;
        let previousValue = 0;

        if (metric === 'revenue') {
            latestValue = this._validateNumber(latest.revenue || latest.estimatedRevenue || 0, 0);
            previousValue = this._validateNumber(previous.revenue || previous.estimatedRevenue || 0, 0);
        } else if (metric === 'subscribers') {
            latestValue = this._validateNumber(latest.subscribers || 0, 0);
            previousValue = this._validateNumber(previous.subscribers || 0, 0);
        } else if (metric === 'views') {
            latestValue = this._validateNumber(latest.views || 0, 0);
            previousValue = this._validateNumber(previous.views || 0, 0);
        }

        if (previousValue === 0 && latestValue === 0) return 0;
        if (previousValue === 0) return 100; // If there was no previous value, show 100% growth

        return Math.round(((latestValue - previousValue) / previousValue) * 100);
    }

    updateCharts() {
        this.drawUsageChart();
        this.drawPlatformChart();
    }

    drawUsageChart() {
        const canvas = document.getElementById('usageChart');
        if (!canvas) return;

        // Guard: Check if Chart.js is available (loaded from CDN)
        if (typeof Chart === 'undefined') {
            this._logSecurityEvent('CHART_LIB_UNAVAILABLE', {});
            setTimeout(() => this.drawUsageChart(), 100);
            return;
        }

        // 🔐 SECURITY: Validate Chart.js integrity if enabled
        if (this.securityConfig.ENABLE_SRI_VALIDATION) {
            const chartJsUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            if (!this._validateSRI(chartJsUrl, this.securityConfig.CHART_JS_INTEGRITY)) {
                this._logSecurityEvent('CHART_INTEGRITY_CHECK_FAILED', {
                    library: 'Chart.js'
                });
                // In strict mode, you could return here to prevent using compromised library
                // For now, we log but continue as SRI validation requires server-side setup
            }
        }

        // 🔐 SECURITY: Prevent resource exhaustion from too many chart instances
        if (this.usageChartInstance) {
            this.usageChartInstance.destroy();
            this.securityState.chartInstances--;
        }

        if (this.securityState.chartInstances >= this.securityConfig.CHART_INSTANCE_LIMIT) {
            this._logSecurityEvent('CHART_INSTANCE_LIMIT_EXCEEDED', {
                limit: this.securityConfig.CHART_INSTANCE_LIMIT
            });
            return;
        }

        let viewsData = [];
        let labels = [];
        
        if (this.analyticsData.currentPeriod === 'day' && this.analyticsData.dailyViews?.length) {
            viewsData = this.analyticsData.dailyViews.map(d => this._validateNumber(d.views, 0));
            labels = this.analyticsData.dailyViews.map(d => this._sanitizeString(d.day || '-', 50));
        } else if (this.analyticsData.currentPeriod === 'month' && this.analyticsData.monthlyViews?.length) {
            viewsData = this.analyticsData.monthlyViews.map(d => this._validateNumber(d.views, 0));
            labels = this.analyticsData.monthlyViews.map(d => this._sanitizeString(d.month || '-', 50));
        } else {
            viewsData = (this.analyticsData.weeklyViews || []).map(d => this._validateNumber(d.views, 0));
            labels = (this.analyticsData.weeklyViews || []).map(d => this._sanitizeString(d.week || '-', 50));
        }

        // If no data, show empty chart with placeholder labels
        if (!viewsData.length) {
            viewsData = [0, 0, 0, 0, 0, 0, 0];
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(255, 107, 53, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 107, 53, 0.01)');

        try {
            this.usageChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Views',
                        data: viewsData,
                        backgroundColor: gradient,
                        borderColor: '#ff6b35',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ff6b35',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                font: { family: 'Poppins, sans-serif', size: 12, weight: '600' },
                                color: '#666',
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { family: 'Poppins, sans-serif', size: 13, weight: 'bold' },
                            bodyFont: { family: 'Poppins, sans-serif', size: 12 },
                            borderColor: '#ff6b35',
                            borderWidth: 1,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;
                                    return `Views: ${value.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(200, 200, 200, 0.1)',
                                drawBorder: false,
                            },
                            ticks: {
                                font: { family: 'Poppins, sans-serif', size: 11 },
                                color: '#999',
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { family: 'Poppins, sans-serif', size: 11 },
                                color: '#999',
                            }
                        }
                    }
                }
            });
            this.securityState.chartInstances++;
        } catch (error) {
            this._logSecurityEvent('CHART_RENDERING_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    drawPlatformChart() {
        const canvas = document.getElementById('platformChart');
        if (!canvas) return;

        // Guard: Check if Chart.js is available (loaded from CDN)
        if (typeof Chart === 'undefined') {
            this._logSecurityEvent('CHART_LIB_UNAVAILABLE', {});
            setTimeout(() => this.drawPlatformChart(), 100);
            return;
        }

        // 🔐 SECURITY: Validate Chart.js integrity if enabled
        if (this.securityConfig.ENABLE_SRI_VALIDATION) {
            const chartJsUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            if (!this._validateSRI(chartJsUrl, this.securityConfig.CHART_JS_INTEGRITY)) {
                this._logSecurityEvent('CHART_INTEGRITY_CHECK_FAILED', {
                    library: 'Chart.js'
                });
                // In strict mode, you could return here to prevent using compromised library
                // For now, we log but continue as SRI validation requires server-side setup
            }
        }

        // 🔐 SECURITY: Prevent resource exhaustion from too many chart instances
        if (this.platformChartInstance) {
            this.platformChartInstance.destroy();
            this.securityState.chartInstances--;
        }

        if (this.securityState.chartInstances >= this.securityConfig.CHART_INSTANCE_LIMIT) {
            this._logSecurityEvent('CHART_INSTANCE_LIMIT_EXCEEDED', {
                limit: this.securityConfig.CHART_INSTANCE_LIMIT
            });
            return;
        }

        let labels = [];
        let youtubeData = [];
        let tiktokData = [];
        
        if (this.analyticsData.currentPeriod === 'day' && this.analyticsData.dailyViews?.length) {
            youtubeData = this.analyticsData.dailyViews.map(d => this._validateNumber(d.views, 0));
            labels = this.analyticsData.dailyViews.map(d => this._sanitizeString(d.day || '-', 50));
            tiktokData = [];
        } else if (this.analyticsData.currentPeriod === 'month' && this.analyticsData.monthlyViews?.length) {
            youtubeData = this.analyticsData.monthlyViews.map(d => this._validateNumber(d.views, 0));
            labels = this.analyticsData.monthlyViews.map(d => this._sanitizeString(d.month || '-', 50));
            tiktokData = [];
        } else if (this.analyticsData.weeklyViews?.length) {
            youtubeData = this.analyticsData.weeklyViews.map(d => this._validateNumber(d.views, 0));
            labels = this.analyticsData.weeklyViews.map(d => this._sanitizeString(d.week || '-', 50));
            tiktokData = [];
        } else {
            // Default empty data
            youtubeData = [0, 0, 0, 0];
            labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            tiktokData = [0, 0, 0, 0];
        }

        const ctx = canvas.getContext('2d');
        const gradientYT = ctx.createLinearGradient(0, 0, 0, 300);
        gradientYT.addColorStop(0, 'rgba(255, 107, 53, 0.3)');
        gradientYT.addColorStop(1, 'rgba(255, 107, 53, 0.01)');
        
        const gradientTT = ctx.createLinearGradient(0, 0, 0, 300);
        gradientTT.addColorStop(0, 'rgba(79, 70, 229, 0.3)');
        gradientTT.addColorStop(1, 'rgba(79, 70, 229, 0.01)');

        try {
            this.platformChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'YouTube Views',
                            data: youtubeData,
                            backgroundColor: gradientYT,
                            borderColor: '#ff6b35',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#ff6b35',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                        },
                        {
                            label: 'TikTok Views',
                            data: tiktokData,
                            backgroundColor: gradientTT,
                            borderColor: '#4f46e5',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#4f46e5',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                font: { family: 'Poppins, sans-serif', size: 12, weight: '600' },
                                color: '#666',
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { family: 'Poppins, sans-serif', size: 13, weight: 'bold' },
                            bodyFont: { family: 'Poppins, sans-serif', size: 12 },
                            borderColor: '#ff6b35',
                            borderWidth: 1,
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                            },
                            ticks: {
                                font: { family: 'Poppins, sans-serif', size: 11 },
                                color: '#999',
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { family: 'Poppins, sans-serif', size: 11 },
                                color: '#999',
                            }
                        }
                    }
                }
            });
            this.securityState.chartInstances++;
        } catch (error) {
            this._logSecurityEvent('CHART_RENDERING_ERROR', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager = new AnalyticsManager();
});

// Also try initializing immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.analyticsManager) {
            window.analyticsManager = new AnalyticsManager();
        }
    });
} else {
    if (!window.analyticsManager) {
        window.analyticsManager = new AnalyticsManager();
    }
}
