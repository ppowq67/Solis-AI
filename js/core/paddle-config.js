class PaddleManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    this._checkoutInProgress = false;
    this._lastCheckoutArgs = null;
    this._customerRetryUsed = false;
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
    if (!e || this._originsCompatible(e, t)) return "";
    return `\n\nOrigin mismatch:\n` + `  You are on: ${t}\n` + `  Paddle default payment link should be: ${e}\n` + `Open that exact origin (including host + port), or update Checkout settings.`;
  }
  _clearStalePaddleClientState() {
    try {
      const kill = e => {
        if (!e) return;
        const t = [];
        for (let n = 0; n < e.length; n++) {
          const o = e.key(n);
          if (o && /paddle|pdl_|ctm_/i.test(o)) t.push(o);
        }
        t.forEach(t => e.removeItem(t));
      };
      kill(window.localStorage);
      kill(window.sessionStorage);
    } catch (e) {}
  }
  _isMissingCustomerError(e) {
    const t = String(e?.detail || e?.message || "");
    return /customer\s+ctm_[a-z0-9]+\s+not found/i.test(t);
  }
  _showCheckoutSetupHelp(e) {
    const t = e?.code || "";
    const n = e?.detail || e?.message || "";
    const o = this.isSandbox();
    const i = o ? "https://sandbox-vendors.paddle.com/checkout-settings" : "https://vendors.paddle.com/checkout-settings";
    if (this._isMissingCustomerError(e)) {
      alert(`Checkout hit a stale Paddle customer record.\n\n` + `${n}\n\n` + `We cleared local Paddle cache — click your plan again to retry without that customer id.`);
      return;
    }
    if (/price_ids? could not be found|provided price_ids/i.test(String(n))) {
      alert(`Paddle does not recognize this plan's price ID.\n\n` + `${n}\n\n` + `In https://vendors.paddle.com → Catalog → each product (Basic/Prime/Elite) → Prices,\n` + `copy the real price id (starts with pri_) and set on Railway:\n` + `  PADDLE_PRICE_BASIC / PADDLE_PRICE_PRIME / PADDLE_PRICE_ELITE\n\n` + `Do not reuse product ids (pro_…) as price ids.`);
      return;
    }
    const r = t === "transaction_default_checkout_url_not_set" || /default (payment|checkout) (link|url)/i.test(String(n)) || /frame-ancestors/i.test(String(n));
    if (!r && t && t !== "checkout_error" && t !== "front-end_error") {
      alert(`Checkout failed (${t}).\n\n${n || "See console for details."}` + this._originMismatchHint());
      return;
    }
    if (r || !n) {
      alert(`Paddle checkout cannot open until Default payment link is set (LIVE).\n\n` + `1. Open ${i}\n` + `2. Set Default payment link to exactly:\n   https://www.solisai.video/\n` + `3. Save, hard-refresh, try again.\n\n` + `This is a Paddle dashboard setting, not a card issue.` + this._originMismatchHint());
      return;
    }
    alert(`Checkout failed.\n\n${n}`);
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
      const t = e?.data?.error || e?.data || e || {};
      const n = !t || typeof t === "object" && !t.code && !t.detail && !t.message && !Object.keys(t).length;
      try {
        console.error("Paddle checkout.error:", JSON.stringify(t, null, 2));
        console.error("Paddle checkout.error event:", e);
      } catch (n) {
        console.error("Paddle checkout.error:", t, e);
      }
      if (this._isMissingCustomerError(t) && !this._customerRetryUsed && this._lastCheckoutArgs) {
        this._customerRetryUsed = true;
        this._clearStalePaddleClientState();
        const {priceId: e, planName: t, session: n} = this._lastCheckoutArgs;
        const o = {
          ...n || {}
        };
        delete o.email;
        delete o.customerId;
        this._checkoutInProgress = false;
        console.warn("[Paddle] Retrying checkout without customer (stale ctm_ cleared)");
        this.openCheckout(e, t, o).catch(e => {
          console.error("[Paddle] Retry failed:", e);
        });
        return;
      }
      window.dispatchEvent(new CustomEvent("paddle:checkoutError", {
        detail: t
      }));
      if (n) {
        this._showCheckoutSetupHelp({
          code: "transaction_default_checkout_url_not_set",
          detail: "Live Paddle has no Default payment link. Set it before checkout can open (this is not a card problem)."
        });
      } else {
        this._showCheckoutSetupHelp(t);
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
    const s = i.some(e => this._originsCompatible(e, r));
    if (!s && o && !this._originsCompatible(o, r)) {
      console.error(`Paddle checkout origin mismatch: page=${r} expected=${o}`);
      this._showCheckoutSetupHelp({
        code: "transaction_default_checkout_url_not_set",
        detail: `Browse via ${o} or update Paddle Default payment link.`
      });
      throw new Error("Paddle default payment link origin mismatch");
    }
    this._lastCheckoutArgs = {
      priceId: e,
      planName: t,
      session: {
        ...n
      }
    };
    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = t;
    const a = {
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
    const c = String(t || "").toLowerCase();
    if (c === "basic" || c === "prime") {
      const e = n.discountId || this.config?.plans?.[c]?.discountId || this.config?.launchDiscountId || null;
      const t = n.discountCode || this.config?.plans?.[c]?.discountCode || this.config?.launchDiscountCode || null;
      if (e) {
        a.discountId = String(e);
      } else if (t) {
        a.discountCode = String(t);
      } else {
        console.warn("[Paddle] No launch discount configured — checkout will charge full price. " + "Set PADDLE_DISCOUNT_LAUNCH=dsc_… on the API host.");
      }
    }
    if (n.email && !this._customerRetryUsed) {
      a.customer = {
        email: String(n.email)
      };
    }
    try {
      await window.Paddle.Checkout.open(a);
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
