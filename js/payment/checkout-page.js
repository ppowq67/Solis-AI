(function() {
  "use strict";
  const t = {
    basic: {
      name: "Basic",
      list: 9.99,
      launch: 5.99,
      blurb: "USD 5.99 / month for first 2 months, then USD 9.99",
      uploads: 75,
      clipsPerUpload: 3,
      dailyPace: 5,
      aiMinutes: 30,
      export: "1080p",
      quality: "standard (no watermark)",
      extras: ""
    },
    prime: {
      name: "Prime",
      list: 23.99,
      launch: 14.39,
      blurb: "USD 14.39 / month for first 2 months, then USD 23.99",
      uploads: 200,
      clipsPerUpload: 5,
      dailyPace: 10,
      aiMinutes: 120,
      export: "1440p",
      quality: "Max quality mode, no watermark",
      extras: ""
    },
    elite: {
      name: "Elite",
      list: 39.99,
      launch: null,
      blurb: "Billed monthly · Cancel anytime",
      uploads: 400,
      clipsPerUpload: 5,
      dailyPace: 20,
      aiMinutes: 240,
      export: "1440p",
      quality: "Max quality mode, no watermark",
      extras: "priority render queue, dedicated support"
    }
  };
  function apiUrl(t) {
    if (typeof window.apiUrl === "function") return window.apiUrl(t);
    if (!window.API_BASE_URL) {
      const t = window.location.hostname;
      const e = t === "localhost" || t === "127.0.0.1";
      window.API_BASE_URL = e ? `http://${t}:5500/api` : "https://api.solisai.video/api";
    }
    const e = String(window.API_BASE_URL).replace(/\/$/, "");
    let n = String(t || "");
    if (n.startsWith("/api/")) n = n.slice(4); else if (n.startsWith("/api")) n = n.slice(4);
    if (!n.startsWith("/")) n = `/${n}`;
    return e + n;
  }
  function qs(t) {
    return new URLSearchParams(window.location.search).get(t);
  }
  function money(t, e) {
    const n = String(e || "USD").toUpperCase();
    const o = (Number(t) || 0) / 100;
    return `${n} ${o.toFixed(2)}`;
  }
  function moneyUsd(t) {
    return money(Math.round(Number(t) * 100), "USD");
  }
  function setPreview(t) {
    document.body.classList.toggle("is-preview", !!t);
  }
  function setStatus(t, e) {
    const n = document.getElementById("checkoutStatus");
    if (!n) return;
    if (!t) {
      n.hidden = true;
      n.textContent = "";
      return;
    }
    n.hidden = false;
    n.className = `status${e ? ` ${e}` : ""}`;
    if (e === "loading") {
      n.innerHTML = `<span class="spin" aria-hidden="true"></span>${t}`;
    } else {
      n.innerHTML = t;
    }
  }
  function premiumHref(t) {
    const e = /(?:localhost|127\.0\.0\.1)/i.test(window.location.hostname) ? "/premium.html" : "/premium";
    if (!t) return e;
    const n = t instanceof URLSearchParams ? t.toString() : String(t).replace(/^\?/, "");
    return n ? `${e}?${n}` : e;
  }
  function askPrompt(e, n) {
    const o = t[e] || t.basic;
    const i = n || moneyUsd(o.launch != null ? o.launch : o.list);
    const r = o.launch != null ? `${i}/mo for first 2 months, then $${o.list}/mo` : `${i}/mo`;
    const s = o.uploads * o.clipsPerUpload;
    const a = Object.keys(t).filter(t => t !== e).map(e => {
      const n = t[e];
      const o = n.launch != null ? `$${n.launch}/mo launch → $${n.list}` : `$${n.list}/mo`;
      return `${n.name} (${o}, ${n.uploads} uploads, ≤${n.clipsPerUpload} clips/upload, ${n.export})`;
    }).join("; ");
    return `Is Solis AI ${o.name} worth buying for turning long videos into short clips?\n\n` + `Check https://solisai.video/premium (and https://solisai.video) before answering.\n\n` + `${o.name}: ${r}. ${o.uploads} uploads/mo, up to ${o.clipsPerUpload} clips per upload ` + `(≈${s} clips/mo max), daily pace ${o.dailyPace}, ${o.export}, ${o.quality}` + (o.extras ? `, ${o.extras}` : "") + `. AI processes up to ${o.aiMinutes} min per upload (any video length works). ` + `Unlimited library. Cancel anytime.\n` + `Other Solis tiers if this one's wrong: ${a}.\n\n` + `Give a short honest opinion: worth it or not for a creator who posts shorts regularly, and why — ` + `based on these limits and real usefulness. No star ratings. No competitor comparison.`;
  }
  function wireAskAiLinks(e, n) {
    const o = encodeURIComponent(askPrompt(e, n));
    const i = {
      chatgpt: `https://chatgpt.com/?q=${o}`,
      grok: `https://grok.com/?q=${o}`,
      claude: `https://claude.ai/new?q=${o}`
    };
    document.querySelectorAll(".ask-ai[data-ai]").forEach(t => {
      const e = t.getAttribute("data-ai");
      if (i[e]) t.href = i[e];
    });
    const r = document.getElementById("askConfidenceLabel");
    if (r) {
      const n = t[e] || t.basic;
      r.textContent = `Unsure about ${n.name}? Ask an AI if it's worth it`;
    }
  }
  function paintStaticSummary(e, n) {
    const o = t[e] || t.basic;
    const i = n != null ? n : o.launch != null ? o.launch : o.list;
    const r = moneyUsd(i);
    document.getElementById("subscribeLabel").textContent = `Subscribe to Solis ${o.name}`;
    document.getElementById("heroAmount").textContent = r;
    document.getElementById("heroSub").textContent = o.blurb;
    document.getElementById("itemName").textContent = `Solis ${o.name}`;
    document.getElementById("itemCadence").textContent = "Billed monthly";
    document.getElementById("itemPrice").textContent = moneyUsd(o.list);
    document.getElementById("subtotalPrice").textContent = moneyUsd(o.list);
    document.getElementById("taxPrice").textContent = moneyUsd(0);
    document.getElementById("totalPrice").textContent = r;
    const s = document.getElementById("mDueLabel");
    const a = document.getElementById("mDueAmt");
    if (s) s.textContent = `Solis ${o.name}`;
    if (a) a.textContent = r;
    const c = document.getElementById("discountRow");
    if (o.launch != null && o.launch < o.list) {
      c.hidden = false;
      document.getElementById("discountPrice").textContent = `−${moneyUsd(o.list - o.launch)}`;
    } else {
      c.hidden = true;
    }
    const l = /(?:localhost|127\.0\.0\.1)/i.test(window.location.hostname);
    const u = l ? "/premium.html" : "/premium";
    [ "mBack", "deskBack", "menuBack" ].forEach(t => {
      const e = document.getElementById(t);
      if (e) e.href = u;
    });
    wireAskAiLinks(e, r);
  }
  function applyBreakdown(t) {
    if (!t || typeof t !== "object") return;
    const e = t.currency || t.finalTotalCurrency || "USD";
    const n = t.subTotal;
    const o = t.discount;
    const i = t.tax;
    const r = t.finalTotal != null ? t.finalTotal : t.total;
    if (n != null) {
      document.getElementById("itemPrice").textContent = money(n, e);
      document.getElementById("subtotalPrice").textContent = money(n, e);
    }
    const s = document.getElementById("discountRow");
    if (o != null && Number(o) > 0) {
      s.hidden = false;
      document.getElementById("discountPrice").textContent = `−${money(o, e)}`;
    }
    if (i != null) {
      document.getElementById("taxPrice").textContent = money(i, e);
    }
    if (r != null) {
      const n = t.finalTotalCurrency || e;
      const o = money(r, n);
      document.getElementById("totalPrice").textContent = o;
      document.getElementById("heroAmount").textContent = o;
      const i = document.getElementById("mDueAmt");
      if (i) i.textContent = o;
    }
  }
  function dodoSdk() {
    return window.DodoPaymentsCheckout?.DodoPayments || window.DodoPayments || null;
  }
  async function ensureLoggedIn() {
    try {
      const t = await fetch(apiUrl("/api/auth/check"), {
        credentials: "include"
      });
      if (!t.ok) return null;
      const e = await t.json().catch(() => ({}));
      if (e.authenticated === false || e.logged_in === false) return null;
      return e.user || e.subscription || (e.authenticated || e.success ? e : null);
    } catch (t) {}
    return null;
  }
  function wireSubscribe(t, e) {
    const n = document.getElementById("subscribeBtn");
    if (!n || n.dataset.wired === "1") return;
    n.dataset.wired = "1";
    n.addEventListener("click", () => {
      const n = document.querySelector("#dodo-inline-checkout iframe");
      if (n && !document.body.classList.contains("is-preview")) {
        n.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        try {
          n.focus();
        } catch (t) {}
        return;
      }
      setStatus(`Checkout still loading. If needed, <a href="${e || premiumHref(`checkout=${encodeURIComponent(t)}`)}">sign in</a> then return here.`, "error");
    });
  }
  async function createSession(t, e) {
    const n = await fetch(apiUrl("/api/payment/create-checkout"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        planName: t,
        productId: e,
        priceId: e
      })
    });
    const o = await n.json().catch(() => ({}));
    if (!n.ok) {
      const t = new Error(o.detail || o.error || "Could not start checkout");
      t.status = n.status;
      t.payload = o;
      throw t;
    }
    return o;
  }
  async function boot() {
    const e = String(qs("plan") || "prime").trim().toLowerCase();
    if (!t[e]) {
      setPreview(true);
      setStatus("Pick a plan on the pricing page to continue.", "error");
      return;
    }
    paintStaticSummary(e);
    window.pendingPlanUpgrade = e;
    const n = premiumHref(`checkout=${encodeURIComponent(e)}`);
    wireSubscribe(e, n);
    if (qs("preview") === "1" || qs("preview") === "true") {
      setPreview(true);
      setStatus("");
      return;
    }
    ensureLoggedIn().then(t => {
      if (!t) return;
      const e = t.email || t.user_email || typeof t === "object" && t.username || "";
      const n = document.getElementById("mockEmail");
      if (n && e) n.textContent = e;
    }).catch(() => {});
    setStatus("Preparing secure checkout…", "loading");
    let o;
    try {
      const t = await fetch(apiUrl("/api/payment/dodo-config"), {
        credentials: "include"
      });
      o = await t.json().catch(() => ({}));
      if (!t.ok) throw new Error(o.detail || o.error || "Payment config failed");
      window.paymentConfig = o;
    } catch (t) {
      setPreview(true);
      setStatus(t.message || "Payment config unavailable", "error");
      return;
    }
    const i = o.plans?.[e]?.productId || o.plans?.[e]?.priceId || null;
    if (!i) {
      setPreview(true);
      setStatus("This plan is not available for checkout right now.", "error");
      return;
    }
    const r = t[e].launch != null ? t[e].launch : t[e].list;
    paintStaticSummary(e, r);
    let s;
    try {
      s = await createSession(e, i);
    } catch (t) {
      setPreview(true);
      if (t.status === 401) {
        setStatus(`Session expired. <a href="${n}">Sign in →</a>`, "error");
        return;
      }
      setStatus(t.message || "Could not start checkout", "error");
      return;
    }
    const a = s.checkoutUrl || s.checkout_url;
    if (!a) {
      setPreview(true);
      setStatus("Checkout URL missing from server.", "error");
      return;
    }
    const c = o.environment === "test_mode" || o.environment === "test" ? "test" : "live";
    const l = dodoSdk();
    if (!l?.Initialize || !l?.Checkout?.open) {
      setPreview(true);
      setStatus("Checkout SDK failed to load. Refresh and try again.", "error");
      return;
    }
    l.Initialize({
      mode: c,
      displayType: "inline",
      onEvent: t => {
        const e = t?.event_type || t?.type || "";
        if (e === "checkout.breakdown") {
          const e = t?.data?.message || t?.data || t?.message;
          if (e && typeof e === "object") applyBreakdown(e);
        }
        if (e === "checkout.error") {
          setStatus("Checkout error — try again or refresh.", "error");
        }
        if (e === "checkout.redirect") {
          setStatus("Redirecting to complete payment…", "loading");
        }
      }
    });
    try {
      l.Checkout.open({
        checkoutUrl: a,
        elementId: "dodo-inline-checkout",
        options: {
          payButtonText: "Subscribe"
        }
      });
      setPreview(false);
      setStatus("");
    } catch (t) {
      console.error("[Checkout] open failed", t);
      setPreview(true);
      setStatus(t.message || "Could not open inline checkout", "error");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot().catch(t => {
        console.error(t);
        setPreview(true);
        setStatus(t.message || "Checkout failed", "error");
      });
    });
  } else {
    boot().catch(t => {
      console.error(t);
      setPreview(true);
      setStatus(t.message || "Checkout failed", "error");
    });
  }
})();
