class APIManager {
    constructor() {
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrent = 6;  // Browser limit is ~6-8 per domain

        this.rateLimits = {};

        this.debounceTimers = {};
        this.debounceQueues = {};

        this.inflightRequests = {};

        this.retryConfig = {
            maxRetries: 3,
            initialDelay: 500,     // ms
            maxDelay: 10000,       // ms
            backoffMultiplier: 2
        };

        this.errorCounts = {};
        this.circuitBreaker = {};

    }

    async request(url, options = {}) {
        try {
            const endpoint = new URL(url, window.location.origin).pathname;

            const rateLimitCheck = this.checkRateLimit(endpoint);
            if (rateLimitCheck.limited) {
                console.warn(`[APIManager] Rate limited on ${endpoint}. Retry after ${rateLimitCheck.resetIn}ms`);
                return {
                    error: 'rate_limited',
                    retryAfter: rateLimitCheck.resetIn,
                    status: 429
                };
            }

            if (this.isCircuitBreakerOpen(endpoint)) {
                console.warn(`[APIManager] Circuit breaker OPEN for ${endpoint} - too many failures`);
                return {
                    error: 'circuit_breaker_open',
                    status: 503,
                    retryAfter: 30000
                };
            }

            const dedupKey = this.generateDedupKey(url, options);
            if (this.hasInflightRequest(dedupKey)) {
                return this.waitForInflightRequest(dedupKey);
            }

            return new Promise((resolve) => {
                const queuedRequest = {
                    url,
                    options,
                    dedupKey,
                    resolve,
                    timestamp: Date.now()
                };

                this.requestQueue.push(queuedRequest);
                this.processQueue();
            });
        } catch (error) {
            console.error('[APIManager] Error in request:', error);
            return {
                error: error.message,
                status: 500
            };
        }
    }

    processQueue() {
        if (this.activeRequests >= this.maxConcurrent || this.requestQueue.length === 0) {
            return;
        }

        const queuedRequest = this.requestQueue.shift();
        this.activeRequests++;

        this.inflightRequests = this.inflightRequests || {};
        this.inflightRequests[queuedRequest.dedupKey] = {
            promise: null,
            waiters: []
        };

        this.executeWithRetry(
            queuedRequest.url,
            queuedRequest.options,
            0
        )
        .then(response => {
            this.updateRateLimitFromHeaders(queuedRequest.url, response);

            const endpoint = new URL(queuedRequest.url, window.location.origin).pathname;
            delete this.errorCounts[endpoint];

            const inflight = this.inflightRequests[queuedRequest.dedupKey];
            if (inflight && inflight.waiters.length > 0) {
                inflight.waiters.forEach(waiter => waiter(response));
            }
            delete this.inflightRequests[queuedRequest.dedupKey];

            queuedRequest.resolve(response);
        })
        .catch(error => {
            const endpoint = new URL(queuedRequest.url, window.location.origin).pathname;
            this.errorCounts[endpoint] = (this.errorCounts[endpoint] || 0) + 1;

            if (this.errorCounts[endpoint] >= 5) {
                this.circuitBreaker[endpoint] = {
                    openedAt: Date.now(),
                    duration: 30000  // 30 seconds
                };
                console.warn(`[APIManager] Circuit breaker OPENED for ${endpoint}`);
            }

            delete this.inflightRequests[queuedRequest.dedupKey];
            queuedRequest.resolve({
                error: error.message,
                status: error.status || 500
            });
        })
        .finally(() => {
            this.activeRequests--;
            this.processQueue();
        });
    }

    async executeWithRetry(url, options, retryCount) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: this.createAbortSignal(url)
            });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                throw {
                    message: 'rate_limited',
                    status: 429,
                    retryAfter: retryAfter * 1000
                };
            }

            if (response.status >= 500 && retryCount < this.retryConfig.maxRetries) {
                const delay = this.calculateBackoffDelay(retryCount);
                await this.sleep(delay);
                return this.executeWithRetry(url, options, retryCount + 1);
            }

            return response;

        } catch (error) {
            if (retryCount < this.retryConfig.maxRetries && error.status !== 429) {
                const delay = this.calculateBackoffDelay(retryCount);
                await this.sleep(delay);
                return this.executeWithRetry(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    checkRateLimit(endpoint) {
        const limit = this.rateLimits[endpoint];
        if (!limit) return { limited: false };

        const now = Date.now();
        if (now < limit.resetTime) {
            return {
                limited: true,
                resetIn: limit.resetTime - now,
                remaining: limit.remaining
            };
        }

        delete this.rateLimits[endpoint];
        return { limited: false };
    }

    updateRateLimitFromHeaders(url, response) {
        const endpoint = new URL(url, window.location.origin).pathname;

        const remaining = response.headers.get('X-RateLimit-Remaining');
        const resetTime = response.headers.get('X-RateLimit-Reset');

        if (remaining !== null && resetTime !== null) {
            this.rateLimits[endpoint] = {
                remaining: parseInt(remaining),
                resetTime: parseInt(resetTime)
            };

            if (remaining <= 10) {
                console.warn(`[APIManager] Rate limit warning: ${remaining} requests remaining for ${endpoint}`);
            }
        }
    }

    isCircuitBreakerOpen(endpoint) {
        const breaker = this.circuitBreaker[endpoint];
        if (!breaker) return false;

        const now = Date.now();
        if (now - breaker.openedAt > breaker.duration) {
            delete this.circuitBreaker[endpoint];
            return false;
        }

        return true;
    }

    generateDedupKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body ? options.body.substring(0, 100) : '';
        return `${method}:${url}:${body}`;
    }

    hasInflightRequest(dedupKey) {
        return this.inflightRequests && this.inflightRequests[dedupKey];
    }

    waitForInflightRequest(dedupKey) {
        return new Promise((resolve) => {
            this.inflightRequests[dedupKey].waiters.push(resolve);
        });
    }

    createAbortSignal(url) {
        if (!AbortController) return undefined;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        return controller.signal;
    }

    calculateBackoffDelay(retryCount) {
        const delay = this.retryConfig.initialDelay * Math.pow(
            this.retryConfig.backoffMultiplier,
            retryCount
        );
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data)
        });
    }

    getStats() {
        return {
            queuedRequests: this.requestQueue.length,
            activeRequests: this.activeRequests,
            rateLimitedEndpoints: Object.keys(this.rateLimits).length,
            circuitBreakerEndpoints: Object.keys(this.circuitBreaker).length,
            errorCounts: this.errorCounts
        };
    }
}

window.apiManager = new APIManager();
