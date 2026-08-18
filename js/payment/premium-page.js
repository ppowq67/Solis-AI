(function() {
  const t = {
    basic: {
      priceId: "pri_01kbavyh2vxwy5z8pdzrwb5eqq"
    },
    prime: {
      priceId: "pri_01kbds6nnbv1hj5vef6nxgpha4"
    },
    elite: {
      priceId: "pri_01kbjphsvy40kypjk2nxh0qdzk"
    }
  };
  function apiBase() {
    return window.API_BASE_URL || `${window.location.origin}/api`;
  }
  async function fetchPlanCatalog() {
    try {
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/paddle-config") : `${apiBase().replace(/\/$/, "")}/payment/paddle-config`;
      const e = await fetch(t, {
        method: "GET",
        credentials: "include"
      });
      if (!e.ok) throw new Error(`paddle-config ${e.status}`);
      const n = await e.json();
      if (n.plans && Object.keys(n.plans).length) return n.plans;
    } catch (t) {
      console.warn("[Premium] Using fallback price IDs:", t.message);
    }
    return t;
  }
  const e = {
    free: 0,
    basic: 1,
    prime: 2,
    elite: 3
  };
  function normalizePlan(t) {
    const n = String(t || "free").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(e, n) ? n : "free";
  }
  function currentPlanLabel(t) {
    const e = String(t || "free");
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  function applyCurrentPlan(t) {
    const e = normalizePlan(t);
    document.querySelectorAll(".plan-card[data-plan]").forEach(t => {
      const n = t.getAttribute("data-plan");
      const a = t.querySelector(".plan-btn");
      const r = n === e && e !== "free";
      t.classList.toggle("is-current", r);
      if (!a) return;
      if (!a.dataset.defaultHtml) a.dataset.defaultHtml = a.innerHTML.trim();
      if (r) {
        a.classList.add("is-current-plan");
        a.disabled = true;
        a.setAttribute("aria-current", "true");
        a.textContent = "Current plan";
      } else {
        a.classList.remove("is-current-plan");
        a.disabled = false;
        a.removeAttribute("aria-current");
        if (a.dataset.defaultHtml) a.innerHTML = a.dataset.defaultHtml;
      }
    });
    const n = document.querySelector("._cta-btn");
    const a = document.getElementById("_ctaPrice");
    if (e !== "free" && n) {
      n.textContent = e === "elite" ? "You are on Elite" : `You are on ${currentPlanLabel(e)}`;
      n.classList.add("is-current-plan");
      n.disabled = true;
    }
    if (e !== "free" && a) {
      a.textContent = "Manage billing from your dashboard";
    }
  }
  window.applyPremiumCurrentPlan = applyCurrentPlan;
  async function resolveCurrentPlan() {
    const t = window.currentAuthenticatedUser || window.currentUser;
    if (t?.plan) applyCurrentPlan(t.plan);
    try {
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/auth/subscription") : `${apiBase().replace(/\/$/, "")}/auth/subscription`;
      const e = await fetch(t, {
        method: "GET",
        credentials: "include"
      });
      if (!e.ok) return;
      const n = await e.json();
      const a = n?.subscription?.plan || n?.plan;
      if (a) applyCurrentPlan(a);
    } catch (t) {}
  }
  function startCheckout(t, e, n) {
    if (typeof window.openPaddleCheckout !== "function") {
      console.error("[Premium] Checkout handler not loaded");
      alert("Payment system is still loading. Please try again in a moment.");
      return;
    }
    window.openPaddleCheckout(t, e, n);
  }
  function wirePlanButtons(t) {
    document.querySelectorAll(".plan-card[data-plan]").forEach(e => {
      const n = e.getAttribute("data-plan");
      const a = t[n];
      const r = e.querySelector(".plan-btn");
      if (!r || !a?.priceId) return;
      r.addEventListener("click", t => {
        t.preventDefault();
        if (r.disabled || r.classList.contains("is-current-plan")) return;
        startCheckout(a.priceId, n, t);
      });
    });
    const e = document.querySelector("._cta-btn");
    const n = t.prime;
    if (e && n?.priceId) {
      e.addEventListener("click", t => {
        t.preventDefault();
        if (e.disabled || e.classList.contains("is-current-plan")) return;
        startCheckout(n.priceId, "prime", t);
      });
    }
  }
  function wireAuthLinks() {
    document.querySelectorAll(".nav-login, .nav-mobile-signin").forEach(t => {
      t.setAttribute("href", "/login.html");
    });
    document.querySelectorAll(".nav-cta, .nav-mobile-cta").forEach(t => {
      if (!t.dataset.boundDashboard) {
        t.dataset.boundDashboard = "1";
        t.addEventListener("click", t => {
          const e = window.currentAuthenticatedUser || window.currentUser;
          if (e) {
            t.preventDefault();
            window.location.href = "/dashboard.html";
          }
        });
      }
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    wireAuthLinks();
    const t = await fetchPlanCatalog();
    wirePlanButtons(t);
    await resolveCurrentPlan();
  });
})();
