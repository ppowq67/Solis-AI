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
    const e = (window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, "");
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
    const a = o.uploads * o.clipsPerUpload;
    const s = Object.keys(t).filter(t => t !== e).map(e => {
      const n = t[e];
      const o = n.launch != null ? `$${n.launch}/mo launch → $${n.list}` : `$${n.list}/mo`;
      return `${n.name} (${o}, ${n.uploads} uploads, ≤${n.clipsPerUpload} clips/upload, ${n.export})`;
    }).join("; ");
    return `Is Solis AI ${o.name} worth buying for turning long videos into short clips?\n\n` + `Check https://solisai.video/premium (and https://solisai.video) before answering.\n\n` + `${o.name}: ${r}. ${o.uploads} uploads/mo, up to ${o.clipsPerUpload} clips per upload ` + `(≈${a} clips/mo max), daily pace ${o.dailyPace}, ${o.export}, ${o.quality}` + (o.extras ? `, ${o.extras}` : "") + `. AI processes up to ${o.aiMinutes} min per upload (any video length works). ` + `Unlimited library. Cancel anytime.\n` + `Other Solis tiers if this one's wrong: ${s}.\n\n` + `Give a short honest opinion: worth it or not for a creator who posts shorts regularly, and why — ` + `based on these limits and real usefulness. No star ratings. No competitor comparison.`;
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
    const a = document.getElementById("mDueLabel");
    const s = document.getElementById("mDueAmt");
    if (a) a.textContent = `Solis ${o.name}`;
    if (s) s.textContent = r;
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
    const a = document.getElementById("discountRow");
    if (o != null && Number(o) > 0) {
      a.hidden = false;
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
      const t = await fetch(apiUrl("/api/auth/subscription"), {
        credentials: "include"
      });
      if (t.ok) {
        const e = await t.json().catch(() => ({}));
        return e.user || e.subscription || e;
      }
    } catch (t) {}
    return null;
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
    const o = document.getElementById("previewLogin");
    if (o) o.href = n;
    if (qs("preview") === "1" || qs("preview") === "true") {
      setPreview(true);
      setStatus("");
      return;
    }
    const i = await ensureLoggedIn();
    if (!i) {
      setPreview(true);
      setStatus(`Layout preview — sign in to load live Dodo checkout. <a href="${n}">Go to Premium →</a>`, "error");
      return;
    }
    const r = i.email || i.user_email || typeof i === "object" && i.username || "";
    const a = document.getElementById("mockEmail");
    if (a && r) a.textContent = r;
    setStatus("Preparing secure checkout…", "loading");
    let s;
    try {
      const t = await fetch(apiUrl("/api/payment/dodo-config"), {
        credentials: "include"
      });
      s = await t.json();
      if (!t.ok) throw new Error(s.detail || s.error || "Payment config failed");
      window.paymentConfig = s;
    } catch (t) {
      setPreview(true);
      setStatus(t.message || "Payment config unavailable", "error");
      return;
    }
    const c = s.plans?.[e]?.productId || s.plans?.[e]?.priceId || null;
    if (!c) {
      setPreview(true);
      setStatus("This plan is not available for checkout right now.", "error");
      return;
    }
    const l = t[e].launch != null ? t[e].launch : t[e].list;
    paintStaticSummary(e, l);
    let u;
    try {
      u = await createSession(e, c);
    } catch (t) {
      setPreview(true);
      if (t.status === 401) {
        setStatus(`Session expired. <a href="${n}">Sign in on Premium →</a>`, "error");
        return;
      }
      setStatus(t.message || "Could not start checkout", "error");
      return;
    }
    const d = u.checkoutUrl || u.checkout_url;
    if (!d) {
      setPreview(true);
      setStatus("Checkout URL missing from server.", "error");
      return;
    }
    const m = s.environment === "test_mode" || s.environment === "test" ? "test" : "live";
    const p = dodoSdk();
    if (!p?.Initialize || !p?.Checkout?.open) {
      setPreview(true);
      setStatus("Checkout SDK failed to load. Refresh and try again.", "error");
      return;
    }
    p.Initialize({
      mode: m,
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
      p.Checkout.open({
        checkoutUrl: d,
        elementId: "dodo-inline-checkout"
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
