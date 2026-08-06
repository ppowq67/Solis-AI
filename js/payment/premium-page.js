(function() {
  const e = {
    basic: {
      priceId: "pri_01kbavpdvztyny35d5jzbxdb3j"
    },
    prime: {
      priceId: "pri_01kbds38r5h1ranax74yv92sps"
    },
    elite: {
      priceId: "pri_01kbjpgwz7v6pdn2jggt0zhq6k"
    }
  };
  function apiBase() {
    return window.API_BASE_URL || `${window.location.origin}/api`;
  }
  async function fetchPlanCatalog() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/paddle-config") : `${apiBase().replace(/\/$/, "")}/payment/paddle-config`;
      const t = await fetch(e, {
        method: "GET",
        credentials: "include"
      });
      if (!t.ok) throw new Error(`paddle-config ${t.status}`);
      const n = await t.json();
      if (n.plans && Object.keys(n.plans).length) return n.plans;
    } catch (e) {
      console.warn("[Premium] Using fallback price IDs:", e.message);
    }
    return e;
  }
  function startCheckout(e, t, n) {
    if (typeof window.openPaddleCheckout !== "function") {
      console.error("[Premium] Checkout handler not loaded");
      alert("Payment system is still loading. Please try again in a moment.");
      return;
    }
    window.openPaddleCheckout(e, t, n);
  }
  function wirePlanButtons(e) {
    document.querySelectorAll(".cqx[data-plan]").forEach(t => {
      const n = t.getAttribute("data-plan");
      const a = e[n];
      const o = t.querySelector(".cqt");
      if (!o || !a?.priceId) return;
      o.addEventListener("click", e => {
        e.preventDefault();
        startCheckout(a.priceId, n, e);
      });
    });
    const t = document.querySelector(".c3");
    const n = e.prime;
    if (t && n?.priceId) {
      t.addEventListener("click", e => {
        e.preventDefault();
        startCheckout(n.priceId, "prime", e);
      });
    }
  }
  function wireAuthLinks() {
    document.querySelectorAll(".cmq, .cmu").forEach(e => {
      e.setAttribute("href", "/login.html");
    });
    document.querySelectorAll(".cmn, .cms").forEach(e => {
      if (!e.dataset.boundDashboard) {
        e.dataset.boundDashboard = "1";
        e.addEventListener("click", e => {
          const t = window.currentAuthenticatedUser || window.currentUser;
          if (t) {
            e.preventDefault();
            window.location.href = "/dashboard.html";
          }
        });
      }
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    wireAuthLinks();
    const e = await fetchPlanCatalog();
    wirePlanButtons(e);
  });
})();
