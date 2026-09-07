(function() {
  const t = {
    basic: {
      productId: "pdt_0NmaMqsSpnxKvK1Yy8HVY",
      annualProductId: "pdt_0Nn4Hi8ll1qgFpZnfeaoe",
      price: 9.99,
      annualPrice: 99.9,
      priceId: "pdt_0NmaMqsSpnxKvK1Yy8HVY"
    },
    prime: {
      productId: "pdt_0NmaTMHpBMaWvyuPwFUvK",
      annualProductId: "pdt_0Nn4HiC3j1qIMPaHoF23K",
      price: 23.99,
      annualPrice: 239.9,
      priceId: "pdt_0NmaTMHpBMaWvyuPwFUvK"
    },
    elite: {
      productId: "pdt_0NmaUraRNVKbToVHIbJ1k",
      annualProductId: "pdt_0Nn4HiDdw26VQuNwenku2",
      price: 39.99,
      annualPrice: 399.9,
      priceId: "pdt_0NmaUraRNVKbToVHIbJ1k"
    }
  };
  const e = {
    basic: 5.99,
    prime: 14.39
  };
  let n = t;
  let a = "month";
  function apiBase() {
    return window.API_BASE_URL || `${window.location.origin}/api`;
  }
  async function fetchPlanCatalog() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/payment/dodo-config") : `${apiBase().replace(/\/$/, "")}/payment/dodo-config`;
      const n = await fetch(e, {
        method: "GET",
        credentials: "include"
      });
      if (!n.ok) throw new Error(`dodo-config ${n.status}`);
      const a = await n.json();
      if (a.plans && Object.keys(a.plans).length) {
        const e = {
          ...t
        };
        Object.keys(a.plans).forEach(n => {
          e[n] = {
            ...t[n],
            ...a.plans[n]
          };
        });
        return e;
      }
    } catch (t) {
      console.warn("[Premium] Using fallback product IDs:", t.message);
    }
    return t;
  }
  const r = {
    free: 0,
    basic: 1,
    prime: 2,
    elite: 3
  };
  function normalizePlan(t) {
    const e = String(t || "free").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(r, e) ? e : "free";
  }
  function currentPlanLabel(t) {
    const e = String(t || "free");
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  function splitMoney(t) {
    const e = Number(t) || 0;
    const n = e.toFixed(2);
    const [a, r] = n.split(".");
    return {
      intPart: a,
      decPart: `.${r}`
    };
  }
  function productFor(e) {
    const r = n[e] || t[e];
    if (!r) return null;
    if (a === "year") {
      return r.annualProductId || r.productId || r.priceId;
    }
    return r.productId || r.priceId;
  }
  function paintPlanPrices() {
    const r = a === "year";
    document.querySelectorAll(".plan-card[data-plan]").forEach(a => {
      const i = a.getAttribute("data-plan");
      const o = n[i] || t[i];
      if (!o) return;
      const c = a.querySelector(".plan-price-was");
      const l = a.querySelector(".plan-price-save");
      const u = a.querySelector(".plan-price-period");
      const s = a.querySelector(".plan-price-billnote");
      const d = a.querySelector(".plan-price-int");
      const p = a.querySelector(".plan-price-dec");
      if (r) {
        const e = Number(o.annualPrice != null ? o.annualPrice : t[i]?.annualPrice) || 0;
        const {intPart: n, decPart: a} = splitMoney(e);
        if (d) d.textContent = n;
        if (p) p.textContent = a;
        if (u) u.textContent = "/year";
        if (c) {
          c.hidden = true;
          c.textContent = "";
        }
        if (l) {
          l.hidden = true;
          l.textContent = "";
        }
        if (s) {
          const t = e / 12;
          s.textContent = `Billed yearly · ≈$${t.toFixed(2)}/mo`;
        }
      } else {
        const n = Number(o.price != null ? o.price : t[i]?.price) || 0;
        const a = e[i];
        const r = a != null ? a : n;
        const {intPart: f, decPart: m} = splitMoney(r);
        if (d) d.textContent = f;
        if (p) p.textContent = m;
        if (u) u.textContent = "/month";
        if (a != null) {
          if (c) {
            c.hidden = false;
            c.textContent = `$${n.toFixed(2)}`;
          }
          if (l) {
            l.hidden = false;
            l.textContent = "40% OFF";
          }
          if (s) s.textContent = `First 2 months, then $${n.toFixed(2)}/mo`;
        } else {
          if (c) {
            c.hidden = true;
            c.textContent = "";
          }
          if (l) {
            l.hidden = true;
            l.textContent = "";
          }
          if (s) s.innerHTML = "&nbsp;";
        }
      }
    });
    const i = document.querySelector(".hero-offer");
    if (i) {
      i.hidden = r;
    }
    const o = document.getElementById("billingSavings");
    if (o) {
      o.style.opacity = r ? "1" : "0";
      o.setAttribute("aria-hidden", r ? "false" : "true");
    }
    const c = document.getElementById("_ctaPrice");
    if (c && !c.closest("._cta")?.querySelector(".is-current-plan")) {
      const a = n.prime || t.prime;
      if (r) {
        c.textContent = `$${Number(a.annualPrice).toFixed(2)}/year`;
      } else {
        c.textContent = `$${Number(e.prime).toFixed(2)}/mo launch`;
      }
    }
  }
  function setBillingInterval(t) {
    a = t === "year" ? "year" : "month";
    const e = document.getElementById("billingToggle");
    if (e) {
      e.setAttribute("aria-checked", a === "year" ? "true" : "false");
    }
    document.querySelectorAll(".billing-label[data-interval]").forEach(t => {
      t.classList.toggle("is-active", t.getAttribute("data-interval") === a);
    });
    paintPlanPrices();
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
  function wirePlanButtons() {
    document.querySelectorAll(".plan-card[data-plan]").forEach(t => {
      const e = t.getAttribute("data-plan");
      const n = t.querySelector(".plan-btn");
      if (!n || n.dataset.boundCheckout) return;
      n.dataset.boundCheckout = "1";
      n.addEventListener("click", t => {
        t.preventDefault();
        if (n.disabled || n.classList.contains("is-current-plan")) return;
        const a = productFor(e);
        if (!a) return;
        startCheckout(a, e, t);
      });
    });
    const t = document.querySelector("._cta-btn");
    if (t && !t.dataset.boundCheckout) {
      t.dataset.boundCheckout = "1";
      t.addEventListener("click", e => {
        e.preventDefault();
        if (t.disabled || t.classList.contains("is-current-plan")) return;
        const n = productFor("prime");
        if (!n) return;
        startCheckout(n, "prime", e);
      });
    }
  }
  function wireBillingToggle() {
    const t = document.getElementById("billingToggle");
    if (!t || t.dataset.bound) return;
    t.dataset.bound = "1";
    const toggle = () => setBillingInterval(a === "year" ? "month" : "year");
    t.addEventListener("click", toggle);
    t.addEventListener("keydown", t => {
      if (t.key === "Enter" || t.key === " ") {
        t.preventDefault();
        toggle();
      }
    });
    document.querySelectorAll(".billing-label[data-interval]").forEach(t => {
      t.addEventListener("click", () => setBillingInterval(t.getAttribute("data-interval")));
    });
    setBillingInterval("month");
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
    wireBillingToggle();
    n = await fetchPlanCatalog();
    paintPlanPrices();
    wirePlanButtons();
    await resolveCurrentPlan();
  });
})();
