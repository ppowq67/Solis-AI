class PaddleManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    this._checkoutInProgress = false;
  }
  async fetchConfig() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/paddle-config") : `${(window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, "")}/payment/paddle-config`;
      const t = await fetch(e, {
        method: "GET",
        credentials: "include"
      });
      if (!t.ok) {
        console.error("Failed to fetch Paddle config:", t.status);
        return null;
      }
      this.config = await t.json();
      return this.config;
    } catch (e) {
      console.error("Error fetching Paddle config:", e);
      return null;
    }
  }
  _normalizeHost(e) {
    return String(e || "").toLowerCase().replace(/^www\./, "");
  }
  _originsCompatible(e, t) {
    if (!e || !t) return !e && !t;
    if (e === t) return true;
    try {
      const n = new URL(e);
      const o = new URL(t);
      return n.protocol === o.protocol && this._normalizeHost(n.hostname) === this._normalizeHost(o.hostname);
    } catch (e) {
      return false;
    }
  }
  _expectedCheckoutOrigin() {
    const e = (this.config?.defaultPaymentUrl || "").trim();
    if (!e) return window.location.origin;
    try {
      return new URL(e).origin;
    } catch (t) {
      return e.replace(/\/$/, "");
    }
  }
  _allowedCheckoutOrigins() {
    const e = [];
    const push = t => {
      if (!t) return;
      try {
        const n = new URL(t).origin;
        if (!e.includes(n)) e.push(n);
      } catch (e) {}
    };
    push(this.config?.defaultPaymentUrl);
    (this.config?.allowedOrigins || []).forEach(push);
    push(window.location.origin);
    e.slice().forEach(e => {
      try {
        const t = new URL(e);
        if (t.hostname.startsWith("www.")) {
          t.hostname = t.hostname.slice(4);
        } else if (t.hostname.includes(".")) {
          t.hostname = `www.${t.hostname}`;
        }
        push(t.origin);
      } catch (e) {}
    });
    return e;
  }
  _originMismatchHint() {
    const e = this._expectedCheckoutOrigin();
    const t = window.location.origin;
    if (!e || e === t) return "";
    return `\n\nOrigin mismatch:\n` + `  You are on: ${t}\n` + `  Paddle default payment link should be: ${e}\n` + `Open that exact origin (including host + port), or update Checkout settings.`;
  }
  _showCheckoutSetupHelp(e) {
    const t = e?.code || "";
    const n = e?.detail || e?.message || "";
    const o = this._expectedCheckoutOrigin();
    const i = this.isSandbox();
    const r = i ? "https://sandbox-vendors.paddle.com/checkout-settings" : "https://vendors.paddle.com/checkout-settings";
    const a = t === "transaction_default_checkout_url_not_set" || /default (payment|checkout) (link|url)/i.test(String(n)) || /frame-ancestors/i.test(String(n));
    if (!a && t && t !== "checkout_error") {
      alert(`Checkout failed (${t}).\n\n${n || "See console for details."}` + this._originMismatchHint());
      return;
    }
    alert(`Paddle checkout is blocked until Default payment link matches this site.\n\n` + `1. Open ${r}\n` + `2. Set Default payment link to exactly:\n   ${o}/\n` + `   (host + port must match the address bar — localhost ≠ 127.0.0.1)\n` + `3. Save, hard-refresh, try again.` + this._originMismatchHint());
  }
  _handlePaddleEvent(e) {
    const t = e?.name || "";
    if (t === "checkout.completed") {
      window.paymentSucceeded = true;
      window.dispatchEvent(new CustomEvent("paddle:checkoutComplete", {
        detail: e.data || {}
      }));
    } else if (t === "checkout.closed" && !window.paymentSucceeded) {
      window.dispatchEvent(new CustomEvent("paddle:checkoutClosed"));
    } else if (t === "checkout.error") {
      const t = e.data?.error || e.data || {};
      try {
        console.error("Paddle checkout.error:", JSON.stringify(t, null, 2));
      } catch (e) {
        console.error("Paddle checkout.error:", t);
      }
      window.dispatchEvent(new CustomEvent("paddle:checkoutError", {
        detail: t
      }));
      this._showCheckoutSetupHelp(t);
    }
  }
  async init() {
    if (this.initialized) {
      return true;
    }
    if (typeof window.Paddle === "undefined") {
      console.error("Paddle script not loaded");
      return false;
    }
    const e = await this.fetchConfig();
    if (!e?.clientToken) {
      console.error("No Paddle client token available");
      return false;
    }
    if (e.environment === "sandbox" && window.Paddle.Environment?.set) {
      window.Paddle.Environment.set("sandbox");
    }
    try {
      window.Paddle.Initialize({
        token: e.clientToken,
        eventCallback: e => this._handlePaddleEvent(e)
      });
      this.initialized = true;
      return true;
    } catch (e) {
      console.error("Error initializing Paddle:", e);
      return false;
    }
  }
  async openCheckout(e, t, n = {}) {
    if (!this.initialized) {
      throw new Error("Paddle not initialized");
    }
    if (this._checkoutInProgress) {
      throw new Error("Checkout already in progress");
    }
    const o = this._expectedCheckoutOrigin();
    const i = this._allowedCheckoutOrigins();
    const r = window.location.origin;
    const a = i.some(e => this._originsCompatible(e, r));
    if (!a && o && !this._originsCompatible(o, r)) {
      console.error(`Paddle checkout origin mismatch: page=${r} expected=${o}`);
      this._showCheckoutSetupHelp({
        code: "transaction_default_checkout_url_not_set",
        detail: `Browse via ${o} or update Paddle Default payment link.`
      });
      throw new Error("Paddle default payment link origin mismatch");
    }
    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = t;
    const s = {
      items: [ {
        priceId: e,
        quantity: 1
      } ],
      customData: {
        user_id: String(n.userId || ""),
        plan: t
      },
      settings: {
        displayMode: "overlay",
        theme: "light",
        successUrl: `${window.location.origin}/dashboard.html?payment=success&plan=${encodeURIComponent(t)}`
      }
    };
    if (n.email) {
      s.customer = {
        email: n.email
      };
    }
    try {
      await window.Paddle.Checkout.open(s);
      return true;
    } finally {
      setTimeout(() => {
        this._checkoutInProgress = false;
      }, 1500);
    }
  }
  getConfig() {
    return this.config;
  }
  isSandbox() {
    return this.config?.environment === "sandbox";
  }
}

window.paddleManager = new PaddleManager;
