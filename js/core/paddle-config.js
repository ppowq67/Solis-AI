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
  _expectedCheckoutOrigin() {
    const e = (this.config?.defaultPaymentUrl || "").trim();
    if (!e) return window.location.origin;
    try {
      return new URL(e).origin;
    } catch (t) {
      return e.replace(/\/$/, "");
    }
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
    const i = this._expectedCheckoutOrigin();
    const o = this.isSandbox();
    const r = o ? "https://sandbox-vendors.paddle.com/checkout-settings" : "https://vendors.paddle.com/checkout-settings";
    const a = t === "transaction_default_checkout_url_not_set" || /default (payment|checkout) (link|url)/i.test(String(n)) || /frame-ancestors/i.test(String(n));
    if (!a && t && t !== "checkout_error") {
      alert(`Checkout failed (${t}).\n\n${n || "See console for details."}` + this._originMismatchHint());
      return;
    }
    alert(`Paddle checkout is blocked until Default payment link matches this site.\n\n` + `1. Open ${r}\n` + `2. Set Default payment link to exactly:\n   ${i}/\n` + `   (host + port must match the address bar — localhost ≠ 127.0.0.1)\n` + `3. Save, hard-refresh, try again.` + this._originMismatchHint());
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
    const i = this._expectedCheckoutOrigin();
    if (i && i !== window.location.origin) {
      console.error(`Paddle checkout origin mismatch: page=${window.location.origin} expected=${i}`);
      this._showCheckoutSetupHelp({
        code: "transaction_default_checkout_url_not_set",
        detail: `Browse via ${i} or update Paddle Default payment link.`
      });
      throw new Error("Paddle default payment link origin mismatch");
    }
    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = t;
    const o = {
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
      o.customer = {
        email: n.email
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
