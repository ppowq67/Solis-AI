/**
 * Polar Configuration Manager
 * Fetches sandbox/production config from backend and initializes Polar checkout
 */

class PolarManager {
  constructor() {
    this.config = null;
  }

  async fetchConfig() {
    try {
      const res = await fetch('/api/payment/polar-config', { credentials: 'include' });
      if (!res.ok) return null;
      this.config = await res.json();
      return this.config;
    } catch (e) {
      console.error('Error fetching Polar config:', e);
      return null;
    }
  }

  async init() {
    if (!this.config) await this.fetchConfig();
    return !!this.config;
  }

  /**
   * Redirect to Polar hosted checkout for a given plan.
   * @param {string} planName  - 'basic' | 'prime' | 'elite'
   * @param {string} [email]   - pre-fill customer email
   */
  async openCheckout(planName, email) {
    if (!this.config) await this.fetchConfig();
    if (!this.config) {
      console.error('Polar config not loaded');
      throw new Error('Polar not configured');
    }

    const productId = this.config.products[planName];
    if (!productId) throw new Error(`Unknown plan: ${planName}`);

    const base = this.config.baseUrl || 'https://sandbox.polar.sh';
    const successUrl = encodeURIComponent(window.location.origin + '/dashboard.html?payment=success&plan=' + planName);

    let url = `${base}/checkout?product_id=${productId}&success_url=${successUrl}`;
    if (email) url += `&customer_email=${encodeURIComponent(email)}`;

    window.pendingPlanUpgrade = planName;
    window.location.href = url;
  }

  isSandbox() {
    return this.config && this.config.environment !== 'production';
  }
}

window.polarManager = new PolarManager();
