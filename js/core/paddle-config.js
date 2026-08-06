class PaddleManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    this._checkoutInProgress = false;
  }

  async fetchConfig() {
    try {
      const url = typeof window.apiUrl === 'function'
        ? window.apiUrl('/api/payment/paddle-config')
        : `${(window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, '')}/payment/paddle-config`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to fetch Paddle config:', response.status);
        return null;
      }

      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.error('Error fetching Paddle config:', error);
      return null;
    }
  }

  _handlePaddleEvent(event) {
    const name = event?.name || '';

    if (name === 'checkout.completed') {
      window.paymentSucceeded = true;
      window.dispatchEvent(
        new CustomEvent('paddle:checkoutComplete', { detail: event.data || {} }),
      );
    } else if (name === 'checkout.closed' && !window.paymentSucceeded) {
      window.dispatchEvent(new CustomEvent('paddle:checkoutClosed'));
    } else if (name === 'checkout.error') {
      const err = event.data?.error || event.data || {};
      const code = err.code || '';
      console.error('Paddle checkout.error:', err);
      window.dispatchEvent(
        new CustomEvent('paddle:checkoutError', { detail: err }),
      );
      if (code === 'transaction_default_checkout_url_not_set') {
        const origin = window.location.origin;
        const hint = this.config?.defaultPaymentUrl || origin;
        alert(
          `Paddle sandbox is not configured yet.\n\n` +
          `1. Open https://sandbox-vendors.paddle.com/checkout-settings\n` +
          `2. Set Default payment link to exactly:\n   ${hint}\n` +
          `(must include the port, e.g. :5500)\n` +
          `3. Save and try again.`
        );
      }
    }
  }

  async init() {
    if (this.initialized) {
      return true;
    }

    if (typeof window.Paddle === 'undefined') {
      console.error('Paddle script not loaded');
      return false;
    }

    const config = await this.fetchConfig();
    if (!config?.clientToken) {
      console.error('No Paddle client token available');
      return false;
    }

    if (config.environment === 'sandbox' && window.Paddle.Environment?.set) {
      window.Paddle.Environment.set('sandbox');
    }

    try {
      window.Paddle.Initialize({
        token: config.clientToken,
        eventCallback: (event) => this._handlePaddleEvent(event),
      });
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing Paddle:', error);
      return false;
    }
  }

  async openCheckout(priceId, planName, session = {}) {
    if (!this.initialized) {
      throw new Error('Paddle not initialized');
    }
    if (this._checkoutInProgress) {
      throw new Error('Checkout already in progress');
    }

    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = planName;

    const checkoutOptions = {
      items: [{ priceId, quantity: 1 }],
      customData: {
        user_id: String(session.userId || ''),
        plan: planName,
      },
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        successUrl: `${window.location.origin}/dashboard.html?payment=success&plan=${encodeURIComponent(planName)}`,
      },
    };

    const defaultUrl = this.config?.defaultPaymentUrl || window.location.origin;
    if (this.isSandbox() && defaultUrl) {
    }

    if (session.email) {
      checkoutOptions.customer = { email: session.email };
    }

    try {
      await window.Paddle.Checkout.open(checkoutOptions);
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
    return this.config?.environment === 'sandbox';
  }
}

window.paddleManager = new PaddleManager();
