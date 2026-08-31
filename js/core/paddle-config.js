/**
 * Paddle Configuration Manager
 * Fetches sandbox/production config from backend and initializes Paddle
 */

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

  _normalizeHost(hostname) {
    return String(hostname || '').toLowerCase().replace(/^www\./, '');
  }

  _originsCompatible(a, b) {
    if (!a || !b) return !a && !b;
    if (a === b) return true;
    try {
      const ua = new URL(a);
      const ub = new URL(b);
      return (
        ua.protocol === ub.protocol &&
        this._normalizeHost(ua.hostname) === this._normalizeHost(ub.hostname)
      );
    } catch (_) {
      return false;
    }
  }

  _expectedCheckoutOrigin() {
    const configured = (this.config?.defaultPaymentUrl || '').trim();
    if (!configured) return window.location.origin;
    try {
      return new URL(configured).origin;
    } catch (_) {
      return configured.replace(/\/$/, '');
    }
  }

  _allowedCheckoutOrigins() {
    const list = [];
    const push = (v) => {
      if (!v) return;
      try {
        const o = new URL(v).origin;
        if (!list.includes(o)) list.push(o);
      } catch (_) { /* ignore */ }
    };
    push(this.config?.defaultPaymentUrl);
    (this.config?.allowedOrigins || []).forEach(push);
    push(window.location.origin);
    list.slice().forEach((o) => {
      try {
        const u = new URL(o);
        if (u.hostname.startsWith('www.')) {
          u.hostname = u.hostname.slice(4);
        } else if (u.hostname.includes('.')) {
          u.hostname = `www.${u.hostname}`;
        }
        push(u.origin);
      } catch (_) { /* ignore */ }
    });
    return list;
  }

  _originMismatchHint() {
    const expected = this._expectedCheckoutOrigin();
    const actual = window.location.origin;
    if (!expected || this._originsCompatible(expected, actual)) return '';
    return (
      `\n\nOrigin mismatch:\n` +
      `  You are on: ${actual}\n` +
      `  Paddle default payment link should be: ${expected}\n` +
      `Open that exact origin (including host + port), or update Checkout settings.`
    );
  }

  /** Drop stale Paddle customer / checkout keys that can force a dead ctm_ id. */
  _clearStalePaddleClientState() {
    try {
      const kill = (store) => {
        if (!store) return;
        const keys = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && /paddle|pdl_|ctm_/i.test(k)) keys.push(k);
        }
        keys.forEach((k) => store.removeItem(k));
      };
      kill(window.localStorage);
      kill(window.sessionStorage);
    } catch (_) { /* private mode */ }
  }

  _isMissingCustomerError(err) {
    const detail = String(err?.detail || err?.message || '');
    return /customer\s+ctm_[a-z0-9]+\s+not found/i.test(detail);
  }

  _showCheckoutSetupHelp(err) {
    const code = err?.code || '';
    const detail = err?.detail || err?.message || '';
    const isSandbox = this.isSandbox();
    const settingsUrl = isSandbox
      ? 'https://sandbox-vendors.paddle.com/checkout-settings'
      : 'https://vendors.paddle.com/checkout-settings';

    if (this._isMissingCustomerError(err)) {
      alert(
        `Checkout hit a stale Paddle customer record.\n\n` +
          `${detail}\n\n` +
          `We cleared local Paddle cache — click your plan again to retry without that customer id.`,
      );
      return;
    }

    if (/price_ids? could not be found|provided price_ids/i.test(String(detail))) {
      alert(
        `Paddle does not recognize this plan's price ID.\n\n` +
          `${detail}\n\n` +
          `In https://vendors.paddle.com → Catalog → each product (Basic/Prime/Elite) → Prices,\n` +
          `copy the real price id (starts with pri_) and set on Railway:\n` +
          `  PADDLE_PRICE_BASIC / PADDLE_PRICE_PRIME / PADDLE_PRICE_ELITE\n\n` +
          `Do not reuse product ids (pro_…) as price ids.`,
      );
      return;
    }

    const needsDefaultLink =
      code === 'transaction_default_checkout_url_not_set' ||
      /default (payment|checkout) (link|url)/i.test(String(detail)) ||
      /frame-ancestors/i.test(String(detail));

    if (!needsDefaultLink && code && code !== 'checkout_error' && code !== 'front-end_error') {
      alert(
        `Checkout failed (${code}).\n\n${detail || 'See console for details.'}` +
          this._originMismatchHint(),
      );
      return;
    }

    if (needsDefaultLink || !detail) {
      alert(
        `Paddle checkout cannot open until Default payment link is set (LIVE).\n\n` +
          `1. Open ${settingsUrl}\n` +
          `2. Set Default payment link to exactly:\n   https://www.solisai.video/\n` +
          `3. Save, hard-refresh, try again.\n\n` +
          `This is a Paddle dashboard setting, not a card issue.` +
          this._originMismatchHint(),
      );
      return;
    }

    alert(`Checkout failed.\n\n${detail}`);
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
      const err = event?.data?.error || event?.data || event || {};
      const empty =
        !err ||
        (typeof err === 'object' &&
          !err.code &&
          !err.detail &&
          !err.message &&
          !Object.keys(err).length);

      try {
        console.error('Paddle checkout.error:', JSON.stringify(err, null, 2));
        console.error('Paddle checkout.error event:', event);
      } catch (_) {
        console.error('Paddle checkout.error:', err, event);
      }

      // Stale ctm_ id from a prior session — retry once with no customer prefills
      if (
        this._isMissingCustomerError(err) &&
        !this._customerRetryUsed &&
        this._lastCheckoutArgs
      ) {
        this._customerRetryUsed = true;
        this._clearStalePaddleClientState();
        const { priceId, planName, session } = this._lastCheckoutArgs;
        const retrySession = { ...(session || {}) };
        delete retrySession.email;
        delete retrySession.customerId;
        this._checkoutInProgress = false;
        console.warn('[Paddle] Retrying checkout without customer (stale ctm_ cleared)');
        this.openCheckout(priceId, planName, retrySession).catch((e) => {
          console.error('[Paddle] Retry failed:', e);
        });
        return;
      }

      window.dispatchEvent(
        new CustomEvent('paddle:checkoutError', { detail: err }),
      );

      if (empty) {
        this._showCheckoutSetupHelp({
          code: 'transaction_default_checkout_url_not_set',
          detail:
            'Live Paddle has no Default payment link. Set it before checkout can open (this is not a card problem).',
        });
      } else {
        this._showCheckoutSetupHelp(err);
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

    const expected = this._expectedCheckoutOrigin();
    const allowed = this._allowedCheckoutOrigins();
    const pageOrigin = window.location.origin;
    const ok = allowed.some((o) => this._originsCompatible(o, pageOrigin));
    if (!ok && expected && !this._originsCompatible(expected, pageOrigin)) {
      console.error(
        `Paddle checkout origin mismatch: page=${pageOrigin} expected=${expected}`,
      );
      this._showCheckoutSetupHelp({
        code: 'transaction_default_checkout_url_not_set',
        detail: `Browse via ${expected} or update Paddle Default payment link.`,
      });
      throw new Error('Paddle default payment link origin mismatch');
    }

    this._lastCheckoutArgs = { priceId, planName, session: { ...session } };
    this._checkoutInProgress = true;
    window.paymentSucceeded = false;
    window.pendingPlanUpgrade = planName;

    // Never send a stored ctm_ id — only optional email, and only when not retrying
    const checkoutOptions = {
      items: [{ priceId, quantity: 1 }],
      customData: {
        user_id: String(session.userId || ''),
        plan: planName,
      },
      settings: {
        displayMode: 'overlay',
        theme: 'light',
        successUrl: `${window.location.origin}/premium?payment=success&plan=${encodeURIComponent(planName)}`,
      },
    };

    // Paddle does NOT auto-apply catalog discounts — must pass discountId/code at open.
    // Basic/Prime launch offer only (Elite stays full price).
    const planKey = String(planName || '').toLowerCase();
    if (planKey === 'basic' || planKey === 'prime') {
      const discountId = session.discountId
        || this.config?.plans?.[planKey]?.discountId
        || this.config?.launchDiscountId
        || null;
      const discountCode = session.discountCode
        || this.config?.plans?.[planKey]?.discountCode
        || this.config?.launchDiscountCode
        || null;
      if (discountId) {
        checkoutOptions.discountId = String(discountId);
      } else if (discountCode) {
        checkoutOptions.discountCode = String(discountCode);
      } else {
        console.warn(
          '[Paddle] No launch discount configured — checkout will charge full price. '
          + 'Set PADDLE_DISCOUNT_LAUNCH=dsc_… on the API host.',
        );
      }
    }

    if (session.email && !this._customerRetryUsed) {
      checkoutOptions.customer = { email: String(session.email) };
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
