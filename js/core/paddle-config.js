class PaddleManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    this._checkoutInProgress = false;
  }
  async fetchConfig() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/paddle-config") : `${(window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, "")}/payment/paddle-config`;
      const n = await fetch(e, {
        method: "GET",
        credentials: "include"
      });
      if (!n.ok) {
        console.error("Failed to fetch Paddle config:", n.status);
        return null;
      }
      this.config = await n.json();
      return this.config;
    } catch (e) {
      console.error("Error fetching Paddle config:", e);
      return null;
    }
  }
  _handlePaddleEvent(e) {
    const n = e?.name || "";
    if (n === "checkout.completed") {
      window.paymentSucceeded = true;
      window.dispatchEvent(new CustomEvent("paddle:checkoutComplete", {
        detail: e.data || {}
      }));
    } else if (n === "checkout.closed" && !window.paymentSucceeded) {
      window.dispatchEvent(new CustomEvent("paddle:checkoutClosed"));
    } else if (n === "checkout.error") {
      const n = e.data?.error || e.data || {};
      const t = n.code || "";
      console.error("Paddle checkout.error:", n);
      window.dispatchEvent(new CustomEvent("paddle:checkoutError", {
        detail: n
      }));
      if (t === "transaction_default_checkout_url_not_set") {
        const e = window.location.origin;
        const n = this.config?.defaultPaymentUrl || e;
        alert(`Paddle sandbox is not configured yet.\n\n` + `1. Open https://sandbox-vendors.paddle.com/checkout-settings\n` + `2. Set Default payment link to exactly:\n   ${n}\n` + `(must include the port, e.g. :5500)\n` + `3. Save and try again.`);
      }
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
  async openCheckout(e, n, t = {}) {
    if (!this.initialized) {
      throw new Error("Paddle not initialized");
    }
    if (this._checkoutInProgress) {
      throw new Error("Checkout already in progress");
    }
    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = n;
    const o = {
      items: [ {
        priceId: e,
        quantity: 1
      } ],
      customData: {
        user_id: String(t.userId || ""),
        plan: n
      },
      settings: {
        displayMode: "overlay",
        theme: "light",
        successUrl: `${window.location.origin}/dashboard.html?payment=success&plan=${encodeURIComponent(n)}`
      }
    };
    const i = this.config?.defaultPaymentUrl || window.location.origin;
    if (this.isSandbox() && i) {}
    if (t.email) {
      o.customer = {
        email: t.email
      };
    }
    try {
      await window.Paddle.Checkout.open(o);
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
