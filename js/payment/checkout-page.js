(function() {
  "use strict";
  const e = {
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
  function setStatus(e, t) {
    const n = document.getElementById("checkoutStatus");
    if (!n) return;
    if (!e) {
      n.hidden = true;
      n.textContent = "";
      return;
    }
    n.hidden = false;
    n.className = `status${t ? ` ${t}` : ""}`;
    if (t === "loading") {
      n.innerHTML = `<span class="spin" aria-hidden="true"></span>${e}`;
    } else {
      n.innerHTML = e;
    }
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
    const i = o.launch != null ? `${r}/mo for first 2 months, then $${o.list}/mo` : `${r}/mo`;
    const a = o.uploads * o.clipsPerUpload;
    const s = Object.keys(e).filter(e => e !== t).map(t => {
      const n = e[t];
      const o = n.launch != null ? `$${n.launch}/mo launch → $${n.list}` : `$${n.list}/mo`;
      return `${n.name} (${o}, ${n.uploads} uploads, ≤${n.clipsPerUpload} clips/upload, ${n.export})`;
    }).join("; ");
    return `Is Solis AI ${o.name} worth buying for turning long videos into short clips?\n\n` + `Check https://solisai.video/premium (and https://solisai.video) before answering.\n\n` + `${o.name}: ${i}. ${o.uploads} uploads/mo, up to ${o.clipsPerUpload} clips per upload ` + `(≈${a} clips/mo max), daily pace ${o.dailyPace}, ${o.export}, ${o.quality}` + (o.extras ? `, ${o.extras}` : "") + `. AI processes up to ${o.aiMinutes} min per upload (any video length works). ` + `Unlimited library. Cancel anytime.\n` + `Other Solis tiers if this one's wrong: ${s}.\n\n` + `Give a short honest opinion: worth it or not for a creator who posts shorts regularly, and why — ` + `based on these limits and real usefulness. No star ratings. No competitor comparison.`;
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
    const i = document.getElementById("askConfidenceLabel");
    if (i) {
      const n = e[t] || e.basic;
      i.textContent = `Unsure about ${n.name}? Ask an AI if it's worth it`;
    }
  }
  function paintStaticSummary(t, n) {
    const o = e[t] || e.basic;
    const r = n != null ? n : o.launch != null ? o.launch : o.list;
    const i = moneyUsd(r);
    document.getElementById("subscribeLabel").textContent = `Subscribe to Solis ${o.name}`;
    document.getElementById("heroAmount").textContent = i;
    document.getElementById("heroSub").textContent = o.blurb;
    document.getElementById("itemName").textContent = `Solis ${o.name}`;
    document.getElementById("itemCadence").textContent = "Billed monthly";
    document.getElementById("itemPrice").textContent = moneyUsd(o.list);
    document.getElementById("subtotalPrice").textContent = moneyUsd(o.list);
    document.getElementById("taxPrice").textContent = moneyUsd(0);
    document.getElementById("totalPrice").textContent = i;
    const a = document.getElementById("mDueLabel");
    const s = document.getElementById("mDueAmt");
    if (a) a.textContent = `Solis ${o.name}`;
    if (s) s.textContent = i;
    const c = document.getElementById("discountRow");
    if (o.launch != null && o.launch < o.list) {
      c.hidden = false;
      document.getElementById("discountPrice").textContent = `−${moneyUsd(o.list - o.launch)}`;
    } else {
      c.hidden = true;
    }
    const l = /(?:localhost|127\.0\.0\.1)/i.test(window.location.hostname);
    const u = l ? "/premium.html" : "/premium";
    [ "mBack", "deskBack", "menuBack" ].forEach(e => {
      const t = document.getElementById(e);
      if (t) t.href = u;
    });
    wireAskAiLinks(t, i);
  }
  function applyBreakdown(e) {
    if (!e || typeof e !== "object") return;
    const t = e.currency || e.finalTotalCurrency || "USD";
    const n = e.subTotal;
    const o = e.discount;
    const r = e.tax;
    const i = e.finalTotal != null ? e.finalTotal : e.total;
    if (n != null) {
      document.getElementById("itemPrice").textContent = money(n, t);
      document.getElementById("subtotalPrice").textContent = money(n, t);
    }
    const a = document.getElementById("discountRow");
    if (o != null && Number(o) > 0) {
      a.hidden = false;
      document.getElementById("discountPrice").textContent = `−${money(o, t)}`;
    }
    if (r != null) {
      document.getElementById("taxPrice").textContent = money(r, t);
    }
    if (i != null) {
      const n = e.finalTotalCurrency || t;
      const o = money(i, n);
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
  const t = {
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
  function wireSubscribe(e, n) {
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
      if (t.checkoutUrl) {
        setStatus("Opening secure checkout…", "loading");
        window.location.href = t.checkoutUrl;
        return;
      }
      if (t.phase === "booting") {
        setStatus("Checkout is still preparing — hang on a second…", "loading");
        return;
      }
      if (t.phase === "auth" || t.loggedIn === false) {
        setStatus(`Sign in to continue. <a href="${n || t.loginUrl}">Sign in →</a>`, "error");
        return;
      }
      const r = t.lastError ? ` ${t.lastError}` : "";
      setStatus(`Checkout isn’t ready yet.${r} <a href="${n || t.loginUrl}">Back to plans</a> or refresh.`, "error");
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
    const n = String(qs("plan") || "prime").trim().toLowerCase();
    t.planKey = n;
    if (!e[n]) {
      t.phase = "error";
      t.lastError = "Unknown plan.";
      setPreview(true);
      setStatus("Pick a plan on the pricing page to continue.", "error");
      return;
    }
    paintStaticSummary(n);
    window.pendingPlanUpgrade = n;
    const o = premiumHref(`checkout=${encodeURIComponent(n)}`);
    t.loginUrl = o;
    wireSubscribe(n, o);
    if (qs("preview") === "1" || qs("preview") === "true") {
      t.phase = "ready";
      setPreview(true);
      setStatus("");
      return;
    }
    ensureLoggedIn().then(e => {
      t.loggedIn = !!e;
      if (!e) return;
      const n = e.email || e.user_email || typeof e === "object" && e.username || "";
      const o = document.getElementById("mockEmail");
      if (o && n) o.textContent = n;
    }).catch(() => {
      t.loggedIn = false;
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
      t.phase = "error";
      t.lastError = e.message || "Payment config unavailable";
      setPreview(true);
      setStatus(t.lastError, "error");
      return;
    }
    const i = r.plans?.[n]?.productId || r.plans?.[n]?.priceId || null;
    if (!i) {
      t.phase = "error";
      t.lastError = "This plan is not available for checkout right now.";
      setPreview(true);
      setStatus(t.lastError, "error");
      return;
    }
    const a = e[n].launch != null ? e[n].launch : e[n].list;
    paintStaticSummary(n, a);
    let s;
    try {
      s = await createSession(n, i);
    } catch (e) {
      setPreview(true);
      if (e.status === 401) {
        t.phase = "auth";
        t.loggedIn = false;
        t.lastError = "Session expired.";
        setStatus(`Session expired. <a href="${o}">Sign in →</a>`, "error");
        return;
      }
      t.phase = "error";
      t.lastError = e.message || "Could not start checkout";
      setStatus(t.lastError, "error");
      return;
    }
    const c = s.checkoutUrl || s.checkout_url;
    if (!c) {
      t.phase = "error";
      t.lastError = "Checkout URL missing from server.";
      setPreview(true);
      setStatus(t.lastError, "error");
      return;
    }
    t.checkoutUrl = c;
    t.loggedIn = true;
    const l = r.environment === "test_mode" || r.environment === "test" ? "test" : "live";
    const u = await waitForDodoSdk(8e3);
    if (!u?.Initialize || !u?.Checkout?.open) {
      t.phase = "ready";
      setPreview(true);
      setStatus('Inline form unavailable. <a href="#" id="hostedCheckoutLink">Continue to secure checkout →</a>', "error");
      const e = document.getElementById("hostedCheckoutLink");
      if (e) {
        e.addEventListener("click", e => {
          e.preventDefault();
          window.location.href = c;
        });
      }
      return;
    }
    u.Initialize({
      mode: l,
      displayType: "inline",
      onEvent: e => {
        const n = e?.event_type || e?.type || "";
        if (n === "checkout.breakdown") {
          const t = e?.data?.message || e?.data || e?.message;
          if (t && typeof t === "object") applyBreakdown(t);
        }
        if (n === "checkout.error") {
          t.lastError = "Checkout error — try again or refresh.";
          setStatus(t.lastError, "error");
        }
        if (n === "checkout.redirect") {
          setStatus("Redirecting to complete payment…", "loading");
        }
      }
    });
    try {
      u.Checkout.open({
        checkoutUrl: c,
        elementId: "dodo-inline-checkout",
        options: {
          payButtonText: "Subscribe"
        }
      });
      setPreview(false);
      const e = Date.now() + 4e3;
      while (Date.now() < e && !findCheckoutIframe()) {
        await new Promise(e => setTimeout(e, 100));
      }
      t.phase = "ready";
      setStatus("");
      if (!findCheckoutIframe()) {
        setStatus("Payment form loading… Use Subscribe if it doesn’t appear.", "loading");
        setTimeout(() => {
          if (!findCheckoutIframe() && t.checkoutUrl) {
            setStatus("");
          }
        }, 2500);
      }
    } catch (e) {
      console.error("[Checkout] open failed", e);
      t.phase = "ready";
      t.lastError = e.message || "Could not open inline checkout";
      setPreview(true);
      setStatus(`${t.lastError} <a href="#" id="hostedCheckoutLink">Continue to secure checkout →</a>`, "error");
      const n = document.getElementById("hostedCheckoutLink");
      if (n) {
        n.addEventListener("click", e => {
          e.preventDefault();
          window.location.href = c;
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
