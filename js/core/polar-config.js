class PolarManager {
  constructor() {
    this.config = null;
  }
  async fetchConfig() {
    try {
      const n = await fetch("/api/payment/polar-config", {
        credentials: "include"
      });
      if (!n.ok) return null;
      this.config = await n.json();
      return this.config;
    } catch (n) {
      console.error("Error fetching Polar config:", n);
      return null;
    }
  }
  async init() {
    if (!this.config) await this.fetchConfig();
    return !!this.config;
  }
  async openCheckout(n, o) {
    if (!this.config) await this.fetchConfig();
    if (!this.config) {
      console.error("Polar config not loaded");
      throw new Error("Polar not configured");
    }
    const i = this.config.products[n];
    if (!i) throw new Error(`Unknown plan: ${n}`);
    const t = this.config.baseUrl || "https://sandbox.polar.sh";
    const r = encodeURIComponent(window.location.origin + "/dashboard.html?payment=success&plan=" + n);
    let c = `${t}/checkout?product_id=${i}&success_url=${r}`;
    if (o) c += `&customer_email=${encodeURIComponent(o)}`;
    window.pendingPlanUpgrade = n;
    window.location.href = c;
  }
  isSandbox() {
    return this.config && this.config.environment !== "production";
  }
}

window.polarManager = new PolarManager;
