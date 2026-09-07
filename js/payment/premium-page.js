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
  let r = "month";
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
      const r = await n.json();
      if (r.plans && Object.keys(r.plans).length) {
        const e = {
          ...t
        };
        Object.keys(r.plans).forEach(n => {
          e[n] = {
            ...t[n],
            ...r.plans[n]
          };
        });
        return e;
      }
    } catch (t) {
      console.warn("[Premium] Using fallback product IDs:", t.message);
    }
    return t;
  }
  const a = {
    free: 0,
    basic: 1,
    prime: 2,
    elite: 3
  };
  function normalizePlan(t) {
    const e = String(t || "free").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(a, e) ? e : "free";
  }
  function currentPlanLabel(t) {
    const e = String(t || "free");
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  function splitMoney(t) {
    const e = Number(t) || 0;
    const n = e.toFixed(2);
    const [r, a] = n.split(".");
    return {
      intPart: r,
      decPart: `.${a}`
    };
  }
  function productFor(e) {
    const a = n[e] || t[e];
    if (!a) return null;
    if (r === "year") {
      return a.annualProductId || a.productId || a.priceId;
    }
    return a.productId || a.priceId;
  }
  function paintPlanPrices() {
    const a = r === "year";
    document.querySelectorAll(".plan-card[data-plan]").forEach(r => {
      const o = r.getAttribute("data-plan");
      const i = n[o] || t[o];
      if (!i) return;
      const c = r.querySelector(".plan-price-was");
      const l = r.querySelector(".plan-price-save");
      const u = r.querySelector(".plan-price-period");
      const s = r.querySelector(".plan-price-billnote");
      const d = r.querySelector(".plan-price-int");
      const p = r.querySelector(".plan-price-dec");
      if (a) {
        const e = Number(i.annualPrice != null ? i.annualPrice : t[o]?.annualPrice) || 0;
        const n = e / 12;
        const {intPart: r, decPart: a} = splitMoney(n);
        if (d) d.textContent = r;
        if (p) p.textContent = a;
        if (u) u.textContent = "/mo";
        if (c) {
          c.hidden = true;
          c.textContent = "";
        }
        if (l) {
          l.hidden = true;
          l.textContent = "";
        }
        if (s) {
          s.textContent = `$${e.toFixed(2)} billed yearly`;
        }
      } else {
        const n = Number(i.price != null ? i.price : t[o]?.price) || 0;
        const r = e[o];
        const a = r != null ? r : n;
        const {intPart: f, decPart: m} = splitMoney(a);
        if (d) d.textContent = f;
        if (p) p.textContent = m;
        if (u) u.textContent = "/month";
        if (r != null) {
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
    const o = document.querySelector(".hero-offer");
    if (o) {
      o.hidden = a;
    }
    const i = document.getElementById("_ctaPrice");
    if (i && !i.closest("._cta")?.querySelector(".is-current-plan")) {
      const r = n.prime || t.prime;
      if (a) {
        const t = Number(r.annualPrice) / 12;
        i.textContent = `$${t.toFixed(2)}/mo · billed yearly`;
      } else {
        i.textContent = `$${Number(e.prime).toFixed(2)}/mo launch`;
      }
    }
  }
  function setBillingInterval(t) {
    r = t === "year" ? "year" : "month";
    const e = document.getElementById("billingSlider");
    if (e) {
      e.dataset.interval = r;
      e.querySelectorAll(".billing-slider-btn").forEach(t => {
        const e = t.getAttribute("data-interval") === r;
        t.classList.toggle("is-active", e);
        t.setAttribute("aria-pressed", e ? "true" : "false");
      });
    }
    paintPlanPrices();
  }
  function applyCurrentPlan(t) {
    const e = normalizePlan(t);
    document.querySelectorAll(".plan-card[data-plan]").forEach(t => {
      const n = t.getAttribute("data-plan");
      const r = t.querySelector(".plan-btn");
      const a = n === e && e !== "free";
      t.classList.toggle("is-current", a);
      if (!r) return;
      if (!r.dataset.defaultHtml) r.dataset.defaultHtml = r.innerHTML.trim();
      if (a) {
        r.classList.add("is-current-plan");
        r.disabled = true;
        r.setAttribute("aria-current", "true");
        r.textContent = "Current plan";
      } else {
        r.classList.remove("is-current-plan");
        r.disabled = false;
        r.removeAttribute("aria-current");
        if (r.dataset.defaultHtml) r.innerHTML = r.dataset.defaultHtml;
      }
    });
    const n = document.querySelector("._cta-btn");
    const r = document.getElementById("_ctaPrice");
    if (e !== "free" && n) {
      n.textContent = e === "elite" ? "You are on Elite" : `You are on ${currentPlanLabel(e)}`;
      n.classList.add("is-current-plan");
      n.disabled = true;
    }
    if (e !== "free" && r) {
      r.textContent = "Manage billing from your dashboard";
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
      const r = n?.subscription?.plan || n?.plan;
      if (r) applyCurrentPlan(r);
    } catch (t) {}
  }
  function startCheckout(t, e, n) {
    if (typeof window.openCheckout !== "function" && typeof window.PaymentFlow?.openCheckout !== "function") {
      console.error("[Premium] Checkout handler not loaded");
      alert("Payment system is still loading. Please try again in a moment.");
      return;
    }
    const r = window.openCheckout || window.PaymentFlow.openCheckout.bind(window.PaymentFlow);
    r(t, e, n);
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
        const r = productFor(e);
        if (!r) return;
        startCheckout(r, e, t);
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
    const t = document.getElementById("billingSlider");
    if (!t || t.dataset.bound) return;
    t.dataset.bound = "1";
    t.querySelectorAll(".billing-slider-btn").forEach(t => {
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
