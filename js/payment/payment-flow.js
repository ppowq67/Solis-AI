(function() {
  const e = 2e3;
  const n = 20;
  function sleep(e) {
    return new Promise(n => setTimeout(n, e));
  }
  function apiBase() {
    if (typeof window.apiUrl === "function") {
      return e => window.apiUrl(e);
    }
    const e = (window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, "");
    return n => {
      let t = String(n);
      if (t.startsWith("/api/")) t = t.slice(4); else if (t.startsWith("/api")) t = t.slice(4);
      if (!t.startsWith("/")) t = "/" + t;
      return e + t;
    };
  }
  const t = apiBase();
  function showProcessingOverlay(e) {
    removeProcessingOverlay();
    const n = document.createElement("div");
    n.id = "payment-processing-overlay";
    n.style.cssText = `\n      position: fixed; inset: 0; z-index: 1000000;\n      background: rgba(15, 23, 42, 0.72);\n      display: flex; align-items: center; justify-content: center;\n      backdrop-filter: blur(6px);\n    `;
    n.innerHTML = `\n      <div style="\n        background: white; border-radius: 20px; padding: 32px 40px;\n        text-align: center; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);\n        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;\n      ">\n        <div style="\n          width: 44px; height: 44px; border: 3px solid #fed7aa;\n          border-top-color: #f97316; border-radius: 50%;\n          margin: 0 auto 20px; animation: paymentSpin 0.8s linear infinite;\n        "></div>\n        <p style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a;">${e}</p>\n        <p style="margin: 10px 0 0; font-size: 0.9rem; color: #64748b;">This usually takes a few seconds.</p>\n      </div>\n    `;
    if (!document.getElementById("payment-flow-styles")) {
      const e = document.createElement("style");
      e.id = "payment-flow-styles";
      e.textContent = "@keyframes paymentSpin { to { transform: rotate(360deg); } }";
      document.head.appendChild(e);
    }
    document.body.appendChild(n);
  }
  function removeProcessingOverlay() {
    document.getElementById("payment-processing-overlay")?.remove();
  }
  async function verifyProduct(e, n) {
    const a = await fetch(t("/api/payment/verify-price"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId: e,
        priceId: e,
        planName: n
      })
    });
    if (!a.ok) {
      const e = await a.json().catch(() => ({}));
      throw new Error(e.error || "Invalid plan selection");
    }
    return true;
  }
  async function pollPaymentStatus(a) {
    for (let o = 1; o <= n; o++) {
      const i = await fetch(t("/api/payment/verify-payment-status"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transaction_id: a || null
        })
      });
      if (i.ok) {
        const e = await i.json();
        if (e.success && e.registered) {
          return e;
        }
      }
      if (o < n) {
        await sleep(e);
      }
    }
    return null;
  }
  async function tryLocalFallback(e) {
    const n = window.paymentConfig;
    if (!n?.useLocalFallback) {
      return null;
    }
    const a = await fetch(t("/api/payment/process-local-payment"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan: e
      })
    });
    if (!a.ok) {
      return null;
    }
    return a.json();
  }
  async function fetchPaymentConfig() {
    if (window.paymentConfig) return window.paymentConfig;
    const e = t("/api/payment/dodo-config");
    const n = await fetch(e, {
      method: "GET",
      credentials: "include"
    });
    if (!n.ok) {
      const e = await n.json().catch(() => ({}));
      throw new Error(e.detail || e.error || `Payment config ${n.status}`);
    }
    window.paymentConfig = await n.json();
    return window.paymentConfig;
  }
  async function completeCheckout(e) {
    const n = window.pendingPlanUpgrade;
    if (!n) {
      console.error("[Payment] No pending plan");
      return {
        ok: false,
        error: "Missing plan"
      };
    }
    const t = e?.transaction_id || e?.payment_id || e?.id || e?.sessionId || null;
    showProcessingOverlay("Activating your plan…");
    try {
      let e = await pollPaymentStatus(t);
      if (!e) {
        e = await tryLocalFallback(n);
      }
      removeProcessingOverlay();
      if (!e || !e.success) {
        return {
          ok: false,
          error: "Payment received but activation is still pending. Check your dashboard in a minute."
        };
      }
      window.pendingPlanUpgrade = null;
      return {
        ok: true,
        plan: e.plan || n
      };
    } catch (e) {
      removeProcessingOverlay();
      console.error("[Payment] Activation error:", e);
      return {
        ok: false,
        error: e.message || "Activation failed"
      };
    }
  }
  async function openCheckout(e, n, a) {
    if (a?.preventDefault) a.preventDefault();
    if (a?.stopPropagation) a.stopPropagation();
    await fetchPaymentConfig();
    await verifyProduct(e, n);
    const o = await fetch(t("/api/payment/create-checkout"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId: e,
        priceId: e,
        planName: n
      })
    });
    if (!o.ok) {
      const e = await o.json().catch(() => ({}));
      throw new Error(e.detail || e.error || "Could not start checkout");
    }
    const i = await o.json();
    window.pendingPlanUpgrade = n;
    const r = i.checkoutUrl || i.checkout_url;
    if (!r) {
      throw new Error("Checkout URL missing from server");
    }
    window.location.href = r;
    return true;
  }
  async function handleDashboardReturn() {
    const e = new URLSearchParams(window.location.search);
    const n = e.get("payment") === "success" || e.get("status") === "success";
    if (!n) return;
    if (e.get("demo") === "1" || e.get("demo") === "true") return;
    const t = e.get("plan");
    const a = /\/premium(?:\.html)?$/i.test(window.location.pathname);
    if (!a) {
      const e = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, e);
      showProcessingOverlay("Confirming your upgrade…");
    }
    if (t) window.pendingPlanUpgrade = t;
    let o = await pollPaymentStatus(e.get("payment_id") || e.get("subscription_id"));
    if (!o && t) {
      o = await tryLocalFallback(t);
    }
    if (!a) removeProcessingOverlay();
    const i = o?.plan || t;
    if (i && typeof window.handlePaymentSuccessOnDashboard === "function") {
      window.handlePaymentSuccessOnDashboard(i);
    }
    return {
      ok: true,
      plan: i || null
    };
  }
  window.PaymentFlow = {
    openCheckout: openCheckout,
    completeCheckout: completeCheckout,
    showProcessingOverlay: showProcessingOverlay,
    removeProcessingOverlay: removeProcessingOverlay,
    handleDashboardReturn: handleDashboardReturn,
    pollPaymentStatus: pollPaymentStatus,
    tryLocalFallback: tryLocalFallback,
    fetchPaymentConfig: fetchPaymentConfig
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      handleDashboardReturn().catch(() => {});
    });
  } else {
    handleDashboardReturn().catch(() => {});
  }
})();
