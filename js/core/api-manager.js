class APIManager {
  constructor() {
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrent = 6;
    this.rateLimits = {};
    this.debounceTimers = {};
    this.debounceQueues = {};
    this.inflightRequests = {};
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 500,
      maxDelay: 1e4,
      backoffMultiplier: 2
    };
    this.errorCounts = {};
    this.circuitBreaker = {};
  }
  async request(e, t = {}) {
    try {
      const r = new URL(e, window.location.origin).pathname;
      const i = this.checkRateLimit(r);
      if (i.limited) {
        console.warn(`[APIManager] Rate limited on ${r}. Retry after ${i.resetIn}ms`);
        return {
          error: "rate_limited",
          retryAfter: i.resetIn,
          status: 429
        };
      }
      if (this.isCircuitBreakerOpen(r)) {
        console.warn(`[APIManager] Circuit breaker OPEN for ${r} - too many failures`);
        return {
          error: "circuit_breaker_open",
          status: 503,
          retryAfter: 3e4
        };
      }
      const s = this.generateDedupKey(e, t);
      if (this.hasInflightRequest(s)) {
        return this.waitForInflightRequest(s);
      }
      return new Promise(r => {
        const i = {
          url: e,
          options: t,
          dedupKey: s,
          resolve: r,
          timestamp: Date.now()
        };
        this.requestQueue.push(i);
        this.processQueue();
      });
    } catch (e) {
      console.error("[APIManager] Error in request:", e);
      return {
        error: e.message,
        status: 500
      };
    }
  }
  processQueue() {
    if (this.activeRequests >= this.maxConcurrent || this.requestQueue.length === 0) {
      return;
    }
    const e = this.requestQueue.shift();
    this.activeRequests++;
    this.inflightRequests = this.inflightRequests || {};
    this.inflightRequests[e.dedupKey] = {
      promise: null,
      waiters: []
    };
    this.executeWithRetry(e.url, e.options, 0).then(t => {
      this.updateRateLimitFromHeaders(e.url, t);
      const r = new URL(e.url, window.location.origin).pathname;
      delete this.errorCounts[r];
      const i = this.inflightRequests[e.dedupKey];
      if (i && i.waiters.length > 0) {
        i.waiters.forEach(e => e(t));
      }
      delete this.inflightRequests[e.dedupKey];
      e.resolve(t);
    }).catch(t => {
      const r = new URL(e.url, window.location.origin).pathname;
      this.errorCounts[r] = (this.errorCounts[r] || 0) + 1;
      if (this.errorCounts[r] >= 5) {
        this.circuitBreaker[r] = {
          openedAt: Date.now(),
          duration: 3e4
        };
        console.warn(`[APIManager] Circuit breaker OPENED for ${r}`);
      }
      delete this.inflightRequests[e.dedupKey];
      e.resolve({
        error: t.message,
        status: t.status || 500
      });
    }).finally(() => {
      this.activeRequests--;
      this.processQueue();
    });
  }
  async executeWithRetry(e, t, r) {
    try {
      const i = await fetch(e, {
        ...t,
        signal: this.createAbortSignal(e)
      });
      if (i.status === 429) {
        const e = parseInt(i.headers.get("Retry-After") || "60");
        throw {
          message: "rate_limited",
          status: 429,
          retryAfter: e * 1e3
        };
      }
      if (i.status >= 500 && r < this.retryConfig.maxRetries) {
        const i = this.calculateBackoffDelay(r);
        await this.sleep(i);
        return this.executeWithRetry(e, t, r + 1);
      }
      return i;
    } catch (i) {
      if (r < this.retryConfig.maxRetries && i.status !== 429) {
        const i = this.calculateBackoffDelay(r);
        await this.sleep(i);
        return this.executeWithRetry(e, t, r + 1);
      }
      throw i;
    }
  }
  checkRateLimit(e) {
    const t = this.rateLimits[e];
    if (!t) return {
      limited: false
    };
    const r = Date.now();
    if (r < t.resetTime) {
      return {
        limited: true,
        resetIn: t.resetTime - r,
        remaining: t.remaining
      };
    }
    delete this.rateLimits[e];
    return {
      limited: false
    };
  }
  updateRateLimitFromHeaders(e, t) {
    const r = new URL(e, window.location.origin).pathname;
    const i = t.headers.get("X-RateLimit-Remaining");
    const s = t.headers.get("X-RateLimit-Reset");
    if (i !== null && s !== null) {
      this.rateLimits[r] = {
        remaining: parseInt(i),
        resetTime: parseInt(s)
      };
      if (i <= 10) {
        console.warn(`[APIManager] Rate limit warning: ${i} requests remaining for ${r}`);
      }
    }
  }
  isCircuitBreakerOpen(e) {
    const t = this.circuitBreaker[e];
    if (!t) return false;
    const r = Date.now();
    if (r - t.openedAt > t.duration) {
      delete this.circuitBreaker[e];
      return false;
    }
    return true;
  }
  generateDedupKey(e, t) {
    const r = t.method || "GET";
    const i = t.body ? t.body.substring(0, 100) : "";
    return `${r}:${e}:${i}`;
  }
  hasInflightRequest(e) {
    return this.inflightRequests && this.inflightRequests[e];
  }
  waitForInflightRequest(e) {
    return new Promise(t => {
      this.inflightRequests[e].waiters.push(t);
    });
  }
  createAbortSignal(e) {
    if (!AbortController) return undefined;
    const t = new AbortController;
    const r = setTimeout(() => t.abort(), 3e4);
    return t.signal;
  }
  calculateBackoffDelay(e) {
    const t = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, e);
    return Math.min(t, this.retryConfig.maxDelay);
  }
  sleep(e) {
    return new Promise(t => setTimeout(t, e));
  }
  async get(e, t = {}) {
    return this.request(e, {
      ...t,
      method: "GET"
    });
  }
  async post(e, t, r = {}) {
    return this.request(e, {
      ...r,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...r.headers
      },
      body: JSON.stringify(t)
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

window.apiManager = new APIManager;
