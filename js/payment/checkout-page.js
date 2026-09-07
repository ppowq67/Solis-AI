(function() {
  "use strict";
  const e = {
    basic: {
      name: "Basic",
      list: 9.99,
      launch: 5.99,
      annual: 99.9,
      blurb: "USD 5.99 / month for first 2 months, then USD 9.99",
      annualBlurb: "USD 99.90 / year · ≈ USD 8.33 / month",
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
      annual: 239.9,
      blurb: "USD 14.39 / month for first 2 months, then USD 23.99",
      annualBlurb: "USD 239.90 / year · ≈ USD 19.99 / month",
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
      annual: 399.9,
      blurb: "Billed monthly · Cancel anytime",
      annualBlurb: "USD 399.90 / year · ≈ USD 33.33 / month",
      uploads: 400,
      clipsPerUpload: 5,
      dailyPace: 20,
      aiMinutes: 240,
      export: "1440p",
      quality: "Max quality mode, no watermark",
      extras: "priority render queue, dedicated support"
    }
  };
  function apiUrl(e) {
    if (typeof window.apiUrl === "function") return window.apiUrl(e);
    if (!window.API_BASE_URL) {
      const e = window.location.hostname;
      const t = e === "localhost" || e === "127.0.0.1";
      window.API_BASE_URL = t ? `http://${e}:5500/api` : "https://api.solisai.video/api";
    }
    const t = String(window.API_BASE_URL).replace(/\/$/, "");
    let n = String(e || "");
    if (n.startsWith("/api/")) n = n.slice(4); else if (n.startsWith("/api")) n = n.slice(4);
    if (!n.startsWith("/")) n = `/${n}`;
    return t + n;
  }
  function qs(e) {
    return new URLSearchParams(window.location.search).get(e);
  }
  function money(e, t) {
    const n = String(t || "USD").toUpperCase();
    const o = (Number(e) || 0) / 100;
    return `${n} ${o.toFixed(2)}`;
  }
  function moneyUsd(e) {
    return money(Math.round(Number(e) * 100), "USD");
  }
  function setPreview(e) {
    document.body.classList.toggle("is-preview", !!e);
  }
  let t = null;
  function setStatus(e, n) {
    const o = document.getElementById("checkoutToast");
    if (!o) return;
    if (t) {
      clearTimeout(t);
      t = null;
    }
    if (!e) {
      o.classList.remove("is-visible", "is-error", "is-loading");
      o.hidden = true;
      o.innerHTML = "";
      return;
    }
    if (n === "loading" && /preparing secure checkout/i.test(String(e))) {
      return;
    }
    o.hidden = false;
    o.className = `checkout-toast is-visible${n === "error" ? " is-error" : ""}${n === "loading" ? " is-loading" : ""}`;
    if (n === "loading") {
      o.innerHTML = `<span class="spin" aria-hidden="true"></span><span>${e}</span>`;
    } else {
      o.innerHTML = e;
    }
    const r = n === "error" ? 6500 : n === "loading" ? 2800 : 4200;
    t = setTimeout(() => {
      o.classList.remove("is-visible");
      t = setTimeout(() => {
        o.hidden = true;
        o.innerHTML = "";
        t = null;
      }, 220);
    }, r);
  }
  function premiumHref(e) {
    const t = /(?:localhost|127\.0\.0\.1)/i.test(window.location.hostname) ? "/premium.html" : "/premium";
    if (!e) return t;
    const n = e instanceof URLSearchParams ? e.toString() : String(e).replace(/^\?/, "");
    return n ? `${t}?${n}` : t;
  }
  function askPrompt(t, n) {
    const o = e[t] || e.basic;
    const r = n || moneyUsd(o.launch != null ? o.launch : o.list);
    const a = o.launch != null ? `${r}/mo for first 2 months, then $${o.list}/mo` : `${r}/mo`;
    const i = o.uploads * o.clipsPerUpload;
    const s = Object.keys(e).filter(e => e !== t).map(t => {
      const n = e[t];
      const o = n.launch != null ? `$${n.launch}/mo launch → $${n.list}` : `$${n.list}/mo`;
      return `${n.name} (${o}, ${n.uploads} uploads, ≤${n.clipsPerUpload} clips/upload, ${n.export})`;
    }).join("; ");
    return `Is Solis AI ${o.name} worth buying for turning long videos into short clips?\n\n` + `Check https://solisai.video/premium (and https://solisai.video) before answering.\n\n` + `${o.name}: ${a}. ${o.uploads} uploads/mo, up to ${o.clipsPerUpload} clips per upload ` + `(≈${i} clips/mo max), daily pace ${o.dailyPace}, ${o.export}, ${o.quality}` + (o.extras ? `, ${o.extras}` : "") + `. AI processes up to ${o.aiMinutes} min per upload (any video length works). ` + `Unlimited library. Cancel anytime.\n` + `Other Solis tiers if this one's wrong: ${s}.\n\n` + `Give a short honest opinion: worth it or not for a creator who posts shorts regularly, and why — ` + `based on these limits and real usefulness. No star ratings. No competitor comparison.`;
  }
  function wireAskAiLinks(t, n) {
    const o = encodeURIComponent(askPrompt(t, n));
    const r = {
      chatgpt: `https://chatgpt.com/?q=${o}`,
      grok: `https://grok.com/?q=${o}`,
      claude: `https://claude.ai/new?q=${o}`
    };
    document.querySelectorAll(".ask-ai[data-ai]").forEach(e => {
      const t = e.getAttribute("data-ai");
      if (r[t]) e.href = r[t];
    });
    const a = document.getElementById("askConfidenceLabel");
    if (a) {
      const n = e[t] || e.basic;
      a.textContent = `Unsure about ${n.name}? Ask an AI if it's worth it`;
    }
  }
  function paintStaticSummary(t, n, o = {}) {
    const r = e[t] || e.basic;
    const a = !!o.annual;
    const i = n != null ? n : a ? r.annual : r.launch != null ? r.launch : r.list;
    const s = moneyUsd(i);
    const c = a ? r.annual : r.list;
    document.getElementById("subscribeLabel").textContent = `Subscribe to Solis ${r.name}`;
    document.getElementById("heroAmount").textContent = s;
    document.getElementById("heroSub").textContent = a ? r.annualBlurb || `USD ${Number(r.annual).toFixed(2)} / year` : r.blurb;
    document.getElementById("itemName").textContent = `Solis ${r.name}`;
    document.getElementById("itemCadence").textContent = a ? "Billed yearly" : "Billed monthly";
    document.getElementById("itemPrice").textContent = moneyUsd(c);
    document.getElementById("subtotalPrice").textContent = moneyUsd(c);
    document.getElementById("taxPrice").textContent = moneyUsd(0);
    document.getElementById("totalPrice").textContent = s;
    const l = document.getElementById("mDueLabel");
    const u = document.getElementById("mDueAmt");
    if (l) l.textContent = `Solis ${r.name}`;
    if (u) u.textContent = s;
    const d = document.getElementById("discountRow");
    if (!a && r.launch != null && r.launch < r.list) {
      d.hidden = false;
      document.getElementById("discountPrice").textContent = `−${moneyUsd(r.list - r.launch)}`;
    } else {
      d.hidden = true;
    }
    const m = /(?:localhost|127\.0\.0\.1)/i.test(window.location.hostname);
    const h = m ? "/premium.html" : "/premium";
    [ "mBack", "deskBack", "menuBack" ].forEach(e => {
      const t = document.getElementById(e);
      if (t) t.href = h;
    });
    wireAskAiLinks(t, s);
  }
  function applyBreakdown(e) {
    if (!e || typeof e !== "object") return;
    const t = e.currency || e.finalTotalCurrency || "USD";
    const n = e.subTotal;
    const o = e.discount;
    const r = e.tax;
    const a = e.finalTotal != null ? e.finalTotal : e.total;
    if (n != null) {
      document.getElementById("itemPrice").textContent = money(n, t);
      document.getElementById("subtotalPrice").textContent = money(n, t);
    }
    const i = document.getElementById("discountRow");
    if (o != null && Number(o) > 0) {
      i.hidden = false;
      document.getElementById("discountPrice").textContent = `−${money(o, t)}`;
    }
    if (r != null) {
      document.getElementById("taxPrice").textContent = money(r, t);
    }
    if (a != null) {
      const n = e.finalTotalCurrency || t;
      const o = money(a, n);
      document.getElementById("totalPrice").textContent = o;
      document.getElementById("heroAmount").textContent = o;
      const r = document.getElementById("mDueAmt");
      if (r) r.textContent = o;
    }
  }
  function dodoSdk() {
    return window.DodoPaymentsCheckout?.DodoPayments || window.DodoPayments || null;
  }
  async function waitForDodoSdk(e = 8e3) {
    const t = Date.now();
    while (Date.now() - t < e) {
      const e = dodoSdk();
      if (e?.Initialize && e?.Checkout?.open) return e;
      await new Promise(e => setTimeout(e, 120));
    }
    return dodoSdk();
  }
  const n = {
    phase: "booting",
    planKey: "prime",
    loginUrl: "",
    checkoutUrl: "",
    loggedIn: null,
    lastError: ""
  };
  async function ensureLoggedIn() {
    try {
      const e = await fetch(apiUrl("/api/auth/check"), {
        credentials: "include"
      });
      if (!e.ok) return null;
      const t = await e.json().catch(() => ({}));
      if (t.authenticated === false || t.logged_in === false) return null;
      return t.user || t.subscription || (t.authenticated || t.success ? t : null);
    } catch (e) {}
    return null;
  }
  function findCheckoutIframe() {
    return document.querySelector("#dodo-inline-checkout iframe");
  }
  function wireSubscribe(e, t) {
    const o = document.getElementById("subscribeBtn");
    if (!o || o.dataset.wired === "1") return;
    o.dataset.wired = "1";
    o.addEventListener("click", () => {
      const e = findCheckoutIframe();
      const o = document.body.classList.contains("is-preview");
      if (e && !o) {
        e.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        try {
          e.focus();
        } catch (e) {}
        return;
      }
      if (n.checkoutUrl) {
        setStatus("Opening secure checkout…", "loading");
        window.location.href = n.checkoutUrl;
        return;
      }
      if (n.phase === "booting") {
        setStatus("Checkout is still preparing — hang on a second…", "loading");
        return;
      }
      if (n.phase === "auth" || n.loggedIn === false) {
        setStatus(`Sign in to continue. <a href="${t || n.loginUrl}">Sign in →</a>`, "error");
        return;
      }
      const r = n.lastError ? ` ${n.lastError}` : "";
      setStatus(`Checkout isn’t ready yet.${r} <a href="${t || n.loginUrl}">Back to plans</a> or refresh.`, "error");
    });
  }
  async function createSession(e, t) {
    const n = await fetch(apiUrl("/api/payment/create-checkout"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        planName: e,
        productId: t,
        priceId: t
      })
    });
    const o = await n.json().catch(() => ({}));
    if (!n.ok) {
      const e = new Error(o.detail || o.error || "Could not start checkout");
      e.status = n.status;
      e.payload = o;
      throw e;
    }
    return o;
  }
  async function boot() {
    const t = String(qs("plan") || "prime").trim().toLowerCase();
    n.planKey = t;
    if (!e[t]) {
      n.phase = "error";
      n.lastError = "Unknown plan.";
      setPreview(true);
      setStatus("Pick a plan on the pricing page to continue.", "error");
      return;
    }
    paintStaticSummary(t);
    window.pendingPlanUpgrade = t;
    const o = premiumHref(`checkout=${encodeURIComponent(t)}`);
    n.loginUrl = o;
    wireSubscribe(t, o);
    if (qs("preview") === "1" || qs("preview") === "true") {
      n.phase = "ready";
      setPreview(true);
      setStatus("");
      return;
    }
    ensureLoggedIn().then(e => {
      n.loggedIn = !!e;
      if (!e) return;
      const t = e.email || e.user_email || typeof e === "object" && e.username || "";
      const o = document.getElementById("mockEmail");
      if (o && t) o.textContent = t;
    }).catch(() => {
      n.loggedIn = false;
    });
    setStatus("Preparing secure checkout…", "loading");
    let r;
    try {
      const e = await fetch(apiUrl("/api/payment/dodo-config"), {
        credentials: "include"
      });
      r = await e.json().catch(() => ({}));
      if (!e.ok) throw new Error(r.detail || r.error || "Payment config failed");
      window.paymentConfig = r;
    } catch (e) {
      n.phase = "error";
      n.lastError = e.message || "Payment config unavailable";
      setPreview(true);
      setStatus(n.lastError, "error");
      return;
    }
    const a = (qs("product") || "").trim();
    const i = r.plans?.[t]?.annualProductId || null;
    const s = r.plans?.[t]?.productId || r.plans?.[t]?.priceId || null;
    const c = a || s;
    if (!c) {
      n.phase = "error";
      n.lastError = "This plan is not available for checkout right now.";
      setPreview(true);
      setStatus(n.lastError, "error");
      return;
    }
    const l = !!(i && c === i || String(qs("interval") || "").toLowerCase() === "year");
    const u = e[t] || e.basic;
    const d = l ? u.annual : u.launch != null ? u.launch : u.list;
    paintStaticSummary(t, d, {
      annual: l
    });
    let m;
    try {
      m = await createSession(t, c);
    } catch (e) {
      setPreview(true);
      if (e.status === 401) {
        n.phase = "auth";
        n.loggedIn = false;
        n.lastError = "Session expired.";
        setStatus(`Session expired. <a href="${o}">Sign in →</a>`, "error");
        return;
      }
      n.phase = "error";
      n.lastError = e.message || "Could not start checkout";
      setStatus(n.lastError, "error");
      return;
    }
    const h = m.checkoutUrl || m.checkout_url;
    if (!h) {
      n.phase = "error";
      n.lastError = "Checkout URL missing from server.";
      setPreview(true);
      setStatus(n.lastError, "error");
      return;
    }
    n.checkoutUrl = h;
    n.loggedIn = true;
    const p = r.environment === "test_mode" || r.environment === "test" ? "test" : "live";
    const f = await waitForDodoSdk(8e3);
    if (!f?.Initialize || !f?.Checkout?.open) {
      n.phase = "ready";
      setPreview(true);
      setStatus('Inline form unavailable. <a href="#" id="hostedCheckoutLink">Continue to secure checkout →</a>', "error");
      const e = document.getElementById("hostedCheckoutLink");
      if (e) {
        e.addEventListener("click", e => {
          e.preventDefault();
          window.location.href = h;
        });
      }
      return;
    }
    f.Initialize({
      mode: p,
      displayType: "inline",
      onEvent: e => {
        const t = e?.event_type || e?.type || "";
        if (t === "checkout.breakdown") {
          const t = e?.data?.message || e?.data || e?.message;
          if (t && typeof t === "object") applyBreakdown(t);
        }
        if (t === "checkout.error") {
          n.lastError = "Checkout error — try again or refresh.";
          setStatus(n.lastError, "error");
        }
        if (t === "checkout.redirect") {
          setStatus("Redirecting to complete payment…", "loading");
        }
      }
    });
    try {
      f.Checkout.open({
        checkoutUrl: h,
        elementId: "dodo-inline-checkout",
        options: {
          payButtonText: "Subscribe",
          theme: "light"
        }
      });
      setPreview(false);
      const e = Date.now() + 4e3;
      while (Date.now() < e && !findCheckoutIframe()) {
        await new Promise(e => setTimeout(e, 100));
      }
      const fitIframe = () => {
        const e = findCheckoutIframe();
        if (!e) return;
        try {
          const t = e.getBoundingClientRect().height;
          if (t > 720) e.style.minHeight = "240px";
        } catch (e) {}
      };
      fitIframe();
      setTimeout(fitIframe, 600);
      setTimeout(fitIframe, 1600);
      n.phase = "ready";
      setStatus("");
      if (!findCheckoutIframe()) {
        setStatus("Payment form loading… Use Subscribe if it doesn’t appear.", "loading");
        setTimeout(() => {
          if (!findCheckoutIframe() && n.checkoutUrl) {
            setStatus("");
          }
        }, 2500);
      }
    } catch (e) {
      console.error("[Checkout] open failed", e);
      n.phase = "ready";
      n.lastError = e.message || "Could not open inline checkout";
      setPreview(true);
      setStatus(`${n.lastError} <a href="#" id="hostedCheckoutLink">Continue to secure checkout →</a>`, "error");
      const t = document.getElementById("hostedCheckoutLink");
      if (t) {
        t.addEventListener("click", e => {
          e.preventDefault();
          window.location.href = h;
        });
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot().catch(e => {
        console.error(e);
        setPreview(true);
        setStatus(e.message || "Checkout failed", "error");
      });
    });
  } else {
    boot().catch(e => {
      console.error(e);
      setPreview(true);
      setStatus(e.message || "Checkout failed", "error");
    });
  }
})();
