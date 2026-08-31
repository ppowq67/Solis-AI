(function() {
  const t = {
    basic: {
      productId: "pdt_0NmaMqsSpnxKvK1Yy8HVY",
      priceId: "pdt_0NmaMqsSpnxKvK1Yy8HVY"
    },
    prime: {
      productId: "pdt_0NmaTMHpBMaWvyuPwFUvK",
      priceId: "pdt_0NmaTMHpBMaWvyuPwFUvK"
    },
    elite: {
      productId: "pdt_0NmaUraRNVKbToVHIbJ1k",
      priceId: "pdt_0NmaUraRNVKbToVHIbJ1k"
    }
  };
  function apiBase() {
    return window.API_BASE_URL || `${window.location.origin}/api`;
  }
  async function fetchPlanCatalog() {
    try {
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/dodo-config") : `${apiBase().replace(/\/$/, "")}/payment/dodo-config`;
      const e = await fetch(t, {
        method: "GET",
        credentials: "include"
      });
      if (!e.ok) throw new Error(`dodo-config ${e.status}`);
      const n = await e.json();
      if (n.plans && Object.keys(n.plans).length) return n.plans;
    } catch (t) {
      console.warn("[Premium] Using fallback product IDs:", t.message);
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
    if (typeof window.openCheckout !== "function" && typeof window.PaymentFlow?.openCheckout !== "function") {
      console.error("[Premium] Checkout handler not loaded");
      alert("Payment system is still loading. Please try again in a moment.");
      return;
    }
    const a = window.openCheckout || window.PaymentFlow.openCheckout.bind(window.PaymentFlow);
    a(t, e, n);
  }
  function wirePlanButtons(t) {
    document.querySelectorAll(".plan-card[data-plan]").forEach(e => {
      const n = e.getAttribute("data-plan");
      const a = t[n];
      const r = a?.productId || a?.priceId;
      const o = e.querySelector(".plan-btn");
      if (!o || !r) return;
      o.addEventListener("click", t => {
        t.preventDefault();
        if (o.disabled || o.classList.contains("is-current-plan")) return;
        startCheckout(r, n, t);
      });
    });
    const e = document.querySelector("._cta-btn");
    const n = t.prime;
    const a = n?.productId || n?.priceId;
    if (e && a) {
      e.addEventListener("click", t => {
        t.preventDefault();
        if (e.disabled || e.classList.contains("is-current-plan")) return;
        startCheckout(a, "prime", t);
      });
    }
  }
  function wireAuthLinks() {
    document.querySelectorAll(".nav-login, .nav-mobile-signin, .nav-cta[data-open-auth], .nav-mobile-cta[data-open-auth]").forEach(t => {
      t.setAttribute("href", "/?login=1");
      if (!t.hasAttribute("data-open-auth")) t.setAttribute("data-open-auth", "");
    });
    document.querySelectorAll(".nav-cta, .nav-mobile-cta").forEach(t => {
      if (!t.dataset.boundDashboard) {
        t.dataset.boundDashboard = "1";
        t.addEventListener("click", t => {
          const e = window.currentAuthenticatedUser || window.currentUser;
          if (e) {
            t.preventDefault();
            window.location.href = "/dashboard.html";
            return;
          }
          if (typeof window.openAuthModal === "function") {
            t.preventDefault();
            window.openAuthModal();
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
