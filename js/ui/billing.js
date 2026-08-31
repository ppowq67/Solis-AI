class BillingPanel {
  constructor() {
    this.billingPanel = document.getElementById("billingPanel");
    this.billingBackdrop = document.getElementById("billingBackdrop");
    this.closeBillingBtn = document.getElementById("closeBilling");
    this.upgradePlanBtn = document.getElementById("upgradePlanBtn");
    this.cancelSubscriptionBtn = document.getElementById("cancelSubscriptionBtn");
    this.init();
  }
  init() {
    if (this.closeBillingBtn) {
      this.closeBillingBtn.addEventListener("click", () => this.closeBilling());
    } else {
      console.warn("Close button not found");
    }
    if (this.billingBackdrop) {
      this.billingBackdrop.addEventListener("click", () => this.closeBilling());
    } else {
      console.warn("Backdrop not found");
    }
    if (this.upgradePlanBtn) {
      this.upgradePlanBtn.addEventListener("click", () => this.upgradePlan());
    } else {
      console.warn("Upgrade button not found");
    }
    if (this.cancelSubscriptionBtn) {
      this.cancelSubscriptionBtn.addEventListener("click", () => this.showCancelConfirmation());
    } else {
      console.warn("Cancel button not found");
    }
    const e = document.getElementById("dropdownBilling");
    if (e) {
      e.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        this.openBilling();
      });
    } else {
      console.error("CRITICAL: dropdownBilling element not found!");
      console.error("Check that #dropdownBilling exists in dashboard.html");
    }
  }
  async openBilling() {
    if (!this.billingPanel || !this.billingBackdrop) {
      console.error("Billing panel elements not found in DOM");
      alert("❌ Error: Billing panel not initialized. Please refresh the page.");
      return;
    }
    const e = document.getElementById("profileDropdown");
    if (e && e.classList.contains("open")) {
      e.classList.remove("open");
    }
    this.billingPanel.classList.add("open");
    this.billingBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    await this.fetchBillingData();
  }
  closeBilling() {
    if (this.billingPanel) {
      this.billingPanel.classList.remove("open");
    }
    if (this.billingBackdrop) {
      this.billingBackdrop.classList.remove("open");
    }
    document.body.style.overflow = "";
  }
  async fetchBillingData() {
    try {
      const e = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      const t = await (window.apiFetch || fetch)("/api/user/billing", {
        method: "GET",
        credentials: "include",
        headers: e
      });
      if (!t.ok) {
        const e = await t.text();
        console.error("API Error:", t.status, e);
        if (t.status === 401) {
          console.error("Unauthorized - Token may be invalid");
          alert("⚠️ Session expired. Please refresh the page.");
          return;
        } else if (t.status === 403) {
          console.error("Forbidden - Access denied");
        }
        this.showDefaultBillingData();
        return;
      }
      const n = await t.json();
      if (!n || typeof n !== "object") {
        console.error("Invalid response structure:", n);
        this.showDefaultBillingData();
        return;
      }
      if (!n.planName || !n.status) {
        console.error("Missing critical billing fields:", n);
        this.showDefaultBillingData();
        return;
      }
      this.populateBillingData(n);
    } catch (e) {
      console.error("Network/Fetch Error:", e.message);
      console.error("Stack:", e.stack);
      this.showDefaultBillingData();
    }
  }
  populateBillingData(e) {
    const sanitize = e => {
      if (typeof e !== "string" && e !== null) return "";
      if (!e) return "";
      const t = document.createElement("div");
      t.textContent = e;
      return t.innerHTML;
    };
    const t = document.getElementById("billingCurrentPlan");
    if (t && e.planName) {
      const n = sanitize(e.planName);
      t.textContent = n;
    }
    const n = document.getElementById("billingNextDate");
    if (n) {
      if (e.nextBillingDate) {
        try {
          const t = new Date(e.nextBillingDate);
          if (isNaN(t.getTime())) {
            console.warn("Invalid date format:", e.nextBillingDate);
            n.textContent = "Date unavailable";
          } else {
            n.textContent = t.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            });
          }
        } catch (e) {
          console.error("Date formatting error:", e);
          n.textContent = "No active subscription";
        }
      } else {
        n.textContent = "No active subscription";
      }
    }
    const i = document.getElementById("billingStatus");
    if (i && e.status) {
      const t = [ "active", "inactive", "cancelled" ];
      const n = sanitize(e.status).toLowerCase();
      if (!t.includes(n)) {
        console.warn("Unknown status value:", e.status);
      }
      i.textContent = n.charAt(0).toUpperCase() + n.slice(1);
      i.classList.remove("active", "inactive", "cancelled");
      i.classList.add(n);
    }
    const o = document.getElementById("billingPrice");
    if (o && e.price) {
      try {
        const t = parseFloat(e.price);
        if (!isNaN(t)) {
          o.textContent = `$${t.toFixed(2)}/month`;
        }
      } catch (e) {
        console.warn("Price parsing error:", e);
      }
    }
    const l = document.getElementById("paymentMethod");
    if (l && e.paymentMethod) {
      const t = sanitize(e.paymentMethod);
      l.textContent = t;
    }
    const s = !e.currentPlan || e.currentPlan === "free";
    const a = e.status === "active";
    if (this.upgradePlanBtn) {
      this.upgradePlanBtn.style.display = s ? "flex" : "none";
    }
    if (this.cancelSubscriptionBtn) {
      this.cancelSubscriptionBtn.style.display = a && !s ? "flex" : "none";
    }
  }
  showDefaultBillingData() {
    const e = document.getElementById("billingCurrentPlan");
    const t = document.getElementById("billingNextDate");
    const n = document.getElementById("billingStatus");
    if (e) e.textContent = "Free";
    if (t) t.textContent = "No active subscription";
    if (n) {
      n.textContent = "Inactive";
      n.classList.add("inactive");
    }
    if (this.upgradePlanBtn) this.upgradePlanBtn.style.display = "flex";
    if (this.cancelSubscriptionBtn) this.cancelSubscriptionBtn.style.display = "none";
  }
  upgradePlan() {
    window.location.href = "/premium.html";
  }
  showCancelConfirmation() {
    const e = confirm("⚠️ Cancel subscription — immediate action\n\n" + "This takes effect right away for billing:\n" + "• Future renewals stop immediately\n" + "• You keep your current plan until the end of this billing period\n" + "• After that date you drop to Free (no refund for unused days)\n\n" + "Continue?");
    if (!e) return;
    const t = prompt("Type CANCEL to confirm you want to stop renewals now:");
    if (!t || String(t).trim().toUpperCase() !== "CANCEL") {
      alert("Confirmation did not match. Subscription was not cancelled.");
      return;
    }
    this.cancelSubscription();
  }
  async cancelSubscription() {
    try {
      const e = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      const t = await (window.apiFetch || fetch)("/api/billing/cancel", {
        method: "POST",
        credentials: "include",
        headers: e,
        body: JSON.stringify({
          effective_from: "next_billing_period"
        })
      });
      if (!t.ok) {
        const e = await t.text();
        console.error("Cancel failed:", t.status, e);
        if (t.status === 401) {
          alert("⚠️ Session expired. Please refresh and try again.");
        } else if (t.status === 400) {
          alert("⚠️ No active subscription to cancel.");
        } else {
          alert("❌ Failed to cancel subscription. Please try again.");
        }
        return;
      }
      const n = await t.json();
      if (!n.success) {
        console.error("Server indicated failure:", n);
        alert("❌ Cancellation failed: " + (n.message || "Unknown error"));
        return;
      }
      alert("✅ Subscription cancel scheduled.\n\n" + "Renewals stopped immediately. You keep access to premium features until the end of your current billing period.");
      await this.fetchBillingData();
    } catch (e) {
      console.error("Error cancelling subscription:", e.message);
      console.error("Stack:", e.stack);
      alert("❌ Error cancelling subscription. Please try again.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("billingPanel");
  const t = document.getElementById("billingBackdrop");
  const n = document.getElementById("dropdownBilling");
  if (!e || !t) {
    console.error("CRITICAL: Billing panel HTML elements not found!");
    console.error("- Make sure billing panel HTML is in dashboard.html");
    console.error("- Check browser DevTools (F12) > Elements tab");
    return;
  }
  if (!n) {
    console.error("WARNING: dropdownBilling element not found!");
    console.error("- Billing menu link may not be clickable");
  }
  try {
    window.billingPanel = new BillingPanel;
    if (e) {
      e.classList.remove("open");
    }
    if (t) {
      t.classList.remove("open");
    }
    document.body.style.overflow = "";
  } catch (e) {
    console.error("Error initializing BillingPanel:", e);
    console.error("Stack:", e.stack);
  }
});
