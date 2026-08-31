document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("stgBackdrop");
  const t = document.getElementById("stgModal");
  const n = document.getElementById("stgClose");
  const o = document.getElementById("stgUpgradeBtn");
  const i = document.getElementById("dropdownSettings");
  const s = document.getElementById("stgLogoutBtn");
  const r = document.getElementById("stgMainTitle");
  const a = {
    profile: "Profile",
    account: "Account",
    privacy: "Privacy",
    memory: "Memory",
    themes: "Themes",
    billing: "Billing/Usage",
    subscription: "Billing/Usage",
    support: "Support",
    connectors: "Connectors",
    plugins: "Plugins"
  };
  const c = new Set([ "connectors", "plugins" ]);
  let l = "all";
  let d = false;
  const u = "solis_effort_ui_mode";
  const f = "solisMacCursor";
  const g = "solis_plugin_auto_captions";
  const p = "solis_plugin_auto_sfx";
  function readPluginFlag(e, t = false) {
    try {
      const n = localStorage.getItem(e);
      if (n === null || n === undefined) return t;
      return n === "1" || n === "true";
    } catch (e) {
      return t;
    }
  }
  window.getSolisPluginPrefs = function getSolisPluginPrefs() {
    return {
      auto_captions: readPluginFlag(g, false),
      auto_sfx: false
    };
  };
  function readEffortUiMode() {
    try {
      const e = localStorage.getItem(u);
      if (e === "slider" || e === "flyout") return e;
    } catch (e) {}
    return "slider";
  }
  function persistEffortUiMode(e) {
    try {
      localStorage.setItem(u, e);
    } catch (e) {}
  }
  function syncEffortUiToggle() {
    const e = document.getElementById("stgEffortSliderToggle");
    const t = document.getElementById("stgEffortUiLabel");
    const n = readEffortUiMode();
    const o = n === "flyout";
    if (e) {
      e.classList.toggle("is-on", o);
      e.setAttribute("aria-checked", o ? "true" : "false");
    }
    if (t) t.textContent = o ? "On" : "Off";
  }
  function applyEffortUiMode(e) {
    const t = e === "slider" ? "slider" : "flyout";
    persistEffortUiMode(t);
    syncEffortUiToggle();
    if (typeof window.setEffortUiMode === "function") {
      window.setEffortUiMode(t);
    } else {
      document.documentElement.dataset.effortUi = t;
    }
  }
  function readMacCursorMode() {
    try {
      const e = localStorage.getItem(f);
      if (e === "off" || e === "preview" || e === "always") return e;
    } catch (e) {}
    return "preview";
  }
  function persistMacCursorMode(e) {
    try {
      localStorage.setItem(f, e);
    } catch (e) {}
  }
  function applyMacCursorMode(e) {
    const t = e === "off" || e === "always" ? e : "preview";
    persistMacCursorMode(t);
    document.documentElement.setAttribute("data-solis-cursor", t);
    syncMacCursorUi();
  }
  function syncMacCursorUi() {
    const e = readMacCursorMode();
    const t = e !== "off";
    const n = e === "always" ? "always" : "preview";
    const o = document.getElementById("stgMacCursorToggle");
    const i = document.getElementById("stgMacCursorLabel");
    const s = document.getElementById("stgMacCursorScopeRow");
    if (o) {
      o.classList.toggle("is-on", t);
      o.setAttribute("aria-checked", t ? "true" : "false");
    }
    if (i) {
      i.textContent = !t ? "Off" : n === "always" ? "Everywhere" : "Preview";
    }
    if (s) s.classList.toggle("is-disabled", !t);
    document.querySelectorAll("[data-solis-cursor-scope]").forEach(e => {
      const o = t && e.getAttribute("data-solis-cursor-scope") === n;
      e.classList.toggle("is-on", o);
      e.setAttribute("aria-checked", o ? "true" : "false");
    });
  }
  function syncThemeCards() {
    document.querySelectorAll(".stgThemeCard[data-theme-choice]").forEach(e => {
      const t = e.getAttribute("data-theme-choice") === "white";
      e.classList.toggle("is-selected", t);
      e.setAttribute("aria-checked", t ? "true" : "false");
    });
  }
  function syncDirMainActions(e) {
    const t = document.getElementById("stgMainActions");
    const n = document.getElementById("stgDirBrowseBtn");
    if (!t) return;
    const o = c.has(e);
    t.hidden = !o;
    if (n) {
      n.textContent = e === "plugins" ? "Browse" : "Browse";
      n.disabled = e === "plugins";
      n.title = e === "plugins" ? "Coming soon" : "";
    }
    const i = document.getElementById("stgConnSearchBar");
    if (i) {
      const t = o && e === "connectors" && d;
      i.hidden = !t;
    }
  }
  function filterConnectorRows() {
    const e = (document.getElementById("stgConnectorsSearch")?.value || "").trim().toLowerCase();
    const t = document.querySelectorAll("#stgConnTable .stgConnRow");
    const n = document.querySelectorAll(".stgConnPopularCard");
    let o = 0;
    t.forEach(t => {
      const n = t.getAttribute("data-conn-status") || "off";
      const i = (t.getAttribute("data-conn-name") || t.getAttribute("data-conn-id") || "").toLowerCase();
      const s = l === "all" || l === "connected" && n === "on" || l === "off" && n !== "on";
      const r = !e || i.includes(e);
      const a = s && r;
      t.hidden = !a;
      if (a) o += 1;
    });
    n.forEach(t => {
      const n = t.getAttribute("data-conn-status") || "off";
      const o = (t.getAttribute("data-conn-id") || "").toLowerCase();
      const i = l === "all" || l === "connected" && n === "on" || l === "off" && n !== "on";
      const s = !e || o.includes(e);
      t.hidden = !(i && s);
    });
    const i = document.getElementById("stgConnEmpty");
    if (i) i.hidden = o > 0;
    const s = document.querySelector(".stgConnPopular");
    if (s) {
      const e = [ ...n ].some(e => !e.hidden);
      s.hidden = !e;
    }
  }
  function setConnFilter(e) {
    l = e === "connected" || e === "off" ? e : "all";
    document.querySelectorAll(".stgConnFilter").forEach(e => {
      const t = e.getAttribute("data-conn-filter") === l;
      e.classList.toggle("is-active", t);
      e.setAttribute("aria-selected", t ? "true" : "false");
    });
    filterConnectorRows();
  }
  function filterSettingsNav(e) {
    const t = (e || "").trim().toLowerCase();
    document.querySelectorAll(".stgNavGroup").forEach(e => {
      let n = false;
      e.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
        const o = `${e.getAttribute("data-stg-search") || ""} ${e.textContent || ""}`.toLowerCase();
        const i = !t || o.includes(t);
        e.hidden = !i;
        if (i) n = true;
      });
      e.setAttribute("data-stg-empty", n ? "false" : "true");
    });
  }
  function switchSettingsPanel(e) {
    let t = e;
    if (t === "connections" || t === "connectors" || t === "plugins") return;
    t = a[t] ? t : "profile";
    document.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
      const n = e.getAttribute("data-stg-panel") === t;
      e.classList.toggle("is-active", n);
      e.setAttribute("aria-selected", n ? "true" : "false");
    });
    document.querySelectorAll(".stgPanel").forEach(e => {
      const n = e.getAttribute("data-stg-panel") === t;
      e.classList.toggle("is-active", n);
      e.classList.remove("stg-panel-enter");
      if (n && isMobileSettings()) {
        void e.offsetWidth;
        e.classList.add("stg-panel-enter");
      }
    });
    if (r) r.textContent = a[t] || "Settings";
    syncDirMainActions(t);
    if (t === "connectors") filterConnectorRows();
    if (t === "memory" && window.SolisMemory && typeof window.SolisMemory.syncSettingsUI === "function") {
      window.SolisMemory.syncSettingsUI();
    }
    if (t === "privacy" && typeof syncPrivacyToggles === "function") {
      syncPrivacyToggles();
    }
    if (t === "account") {
      populateAccountPanel();
    }
    if (isMobileSettings()) {
      setSettingsMobileView("panel");
    }
  }
  function isMobileSettings() {
    return window.innerWidth <= 768;
  }
  function setSettingsMobileView(e) {
    if (!t) return;
    const n = e === "panel" ? "panel" : "home";
    const o = t.getAttribute("data-stg-view") || "";
    if (!o) {
      t.setAttribute("data-stg-view", n === "panel" ? "home" : "panel");
      void t.offsetWidth;
    } else if (o !== n) {
      void t.offsetWidth;
    }
    t.setAttribute("data-stg-view", n);
    const i = document.getElementById("stgMobileBack");
    if (i) i.hidden = n !== "panel";
    if (n === "home") {
      mountMobileSettingsHero();
      if (r) r.textContent = "Settings";
    }
  }
  function mountMobileSettingsHero() {
    const e = document.getElementById("stgMobileHeroInner");
    const t = document.getElementById("stgProfileHero");
    const n = document.getElementById("stgPanelProfile");
    if (!e || !t || !n) return;
    if (t.parentElement !== e) {
      e.appendChild(t);
    }
  }
  function restoreDesktopProfileHero() {
    const e = document.getElementById("stgProfileHero");
    const t = document.getElementById("stgPanelProfile");
    const n = t?.querySelector(".stgPanelLead");
    if (!e || !t) return;
    if (e.parentElement === t) return;
    if (n && n.nextSibling) {
      t.insertBefore(e, n.nextSibling);
    } else if (n) {
      n.after(e);
    } else {
      t.prepend(e);
    }
  }
  document.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
    e.addEventListener("click", () => {
      if (e.disabled || e.classList.contains("is-disabled")) return;
      switchSettingsPanel(e.getAttribute("data-stg-panel"));
    });
  });
  document.getElementById("stgMobileBack")?.addEventListener("click", () => {
    setSettingsMobileView("home");
  });
  window.addEventListener("resize", () => {
    if (!t?.classList.contains("open")) return;
    if (isMobileSettings()) {
      if (!t.getAttribute("data-stg-view")) {
        setSettingsMobileView("home");
      }
    } else {
      restoreDesktopProfileHero();
      t.removeAttribute("data-stg-view");
      const e = document.querySelector(".stgNavBtn.is-active[data-stg-panel]");
      switchSettingsPanel(e?.getAttribute("data-stg-panel") || "profile");
    }
  });
  document.getElementById("stgMobileHero")?.addEventListener("click", e => {
    if (e.target.closest("#stgEditHeaderBtn, #stgAvatarContainer, .stgNameInput, .stgBioInput")) return;
    if (isMobileSettings() && t?.getAttribute("data-stg-view") === "home") {
      switchSettingsPanel("profile");
    }
  });
  const m = document.getElementById("stgEffortSliderToggle");
  if (m) {
    syncEffortUiToggle();
    applyEffortUiMode(readEffortUiMode());
    m.addEventListener("click", () => {
      const e = readEffortUiMode() === "slider" ? "flyout" : "slider";
      applyEffortUiMode(e);
    });
  }
  const w = document.getElementById("stgMacCursorToggle");
  if (w) {
    applyMacCursorMode(readMacCursorMode());
    w.addEventListener("click", () => {
      const e = readMacCursorMode();
      if (e === "off") {
        let e = "preview";
        try {
          const t = localStorage.getItem("solisMacCursorScope");
          if (t === "always" || t === "preview") e = t;
        } catch (e) {}
        applyMacCursorMode(e);
      } else {
        try {
          localStorage.setItem("solisMacCursorScope", e === "always" ? "always" : "preview");
        } catch (e) {}
        applyMacCursorMode("off");
      }
    });
  }
  document.querySelectorAll("[data-solis-cursor-scope]").forEach(e => {
    e.addEventListener("click", () => {
      if (readMacCursorMode() === "off") return;
      const t = e.getAttribute("data-solis-cursor-scope") === "always" ? "always" : "preview";
      try {
        localStorage.setItem("solisMacCursorScope", t);
      } catch (e) {}
      applyMacCursorMode(t);
    });
  });
  syncMacCursorUi();
  const y = document.getElementById("stgAdvancedToggle");
  const h = y?.closest(".stgAdvanced");
  const E = document.getElementById("stgAdvancedBody");
  if (y && h && E) {
    y.addEventListener("click", () => {
      const e = !h.classList.contains("is-open");
      h.classList.toggle("is-open", e);
      y.setAttribute("aria-expanded", e ? "true" : "false");
      if (e) E.removeAttribute("hidden"); else E.setAttribute("hidden", "");
    });
  }
  document.querySelectorAll(".stgThemeCard[data-theme-choice]").forEach(e => {
    e.addEventListener("click", () => {
      if (e.disabled || e.classList.contains("is-disabled")) return;
      const t = e.getAttribute("data-theme-choice");
      if (t !== "white") return;
      if (typeof setTheme === "function") setTheme("light"); else {
        document.documentElement.setAttribute("data-theme", "light");
        try {
          localStorage.setItem("theme", "light");
        } catch (e) {}
      }
      syncThemeCards();
    });
  });
  syncThemeCards();
  const v = "solis_privacy_improve_product";
  function readImproveSolis() {
    try {
      const e = localStorage.getItem(v);
      if (e === null || e === undefined) return true;
      return e === "1" || e === "true";
    } catch (e) {
      return true;
    }
  }
  function setImproveSolis(e) {
    try {
      localStorage.setItem(v, e ? "1" : "0");
    } catch (e) {}
    syncPrivacyToggles();
  }
  function syncPrivacyToggles() {
    const e = document.getElementById("stgPrivacyImproveToggle");
    const t = document.getElementById("stgPrivacyMemoryToggle");
    const n = readImproveSolis();
    if (e) {
      e.classList.toggle("is-on", n);
      e.setAttribute("aria-checked", n ? "true" : "false");
    }
    const o = window.SolisMemory?.isEnabled ? !!window.SolisMemory.isEnabled() : true;
    if (t) {
      t.classList.toggle("is-on", o);
      t.setAttribute("aria-checked", o ? "true" : "false");
    }
  }
  document.getElementById("stgPrivacyImproveToggle")?.addEventListener("click", () => {
    setImproveSolis(!readImproveSolis());
  });
  document.getElementById("stgPrivacyMemoryToggle")?.addEventListener("click", () => {
    if (!window.SolisMemory?.setEnabled) return;
    window.SolisMemory.setEnabled(!window.SolisMemory.isEnabled());
    syncPrivacyToggles();
  });
  document.getElementById("stgPrivacyClearMemoryBtn")?.addEventListener("click", () => {
    if (window.SolisMemory?.clearAll) window.SolisMemory.clearAll();
    const e = document.getElementById("stgPrivacyClearMemoryBtn");
    if (e) {
      const t = e.textContent;
      e.textContent = "Cleared";
      setTimeout(() => {
        e.textContent = t || "Clear";
      }, 1400);
    }
  });
  syncPrivacyToggles();
  window.getSolisImproveProductPref = readImproveSolis;
  if (i) {
    i.addEventListener("click", e => {
      e.preventDefault();
      const t = document.getElementById("profileDropdown");
      if (t) t.classList.remove("open");
      openSettingsModal();
    });
  }
  if (n) n.addEventListener("click", closeSettingsModal);
  if (e) e.addEventListener("click", closeSettingsModal);
  if (t) {
    t.addEventListener("click", e => e.stopPropagation());
  }
  if (s) {
    s.addEventListener("click", e => {
      e.preventDefault();
      if (typeof handleSecureLogout === "function") handleSecureLogout(); else if (typeof logout === "function") logout(); else window.location.href = "/login.html";
    });
  }
  function openSettingsModal(n) {
    document.body.classList.add("stg-open");
    document.body.style.overflow = "hidden";
    document.getElementById("navWrapper")?.classList.add("disabled");
    if (isMobileSettings()) {
      if (n && a[n]) {
        document.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
          const t = e.getAttribute("data-stg-panel") === n;
          e.classList.toggle("is-active", t);
          e.setAttribute("aria-selected", t ? "true" : "false");
        });
        document.querySelectorAll(".stgPanel").forEach(e => {
          e.classList.toggle("is-active", e.getAttribute("data-stg-panel") === n);
        });
        if (r) r.textContent = a[n] || "Settings";
        t?.setAttribute("data-stg-view", "panel");
        const e = document.getElementById("stgMobileBack");
        if (e) e.hidden = false;
      } else {
        document.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
          e.classList.remove("is-active");
          e.setAttribute("aria-selected", "false");
        });
        t?.setAttribute("data-stg-view", "home");
        mountMobileSettingsHero();
        if (r) r.textContent = "Settings";
        const e = document.getElementById("stgMobileBack");
        if (e) e.hidden = true;
      }
    } else {
      restoreDesktopProfileHero();
      t?.removeAttribute("data-stg-view");
      switchSettingsPanel(n || "profile");
    }
    requestAnimationFrame(() => {
      e?.classList.add("open");
      t?.classList.add("open");
      updateSettingsModal();
    });
  }
  function closeSettingsModal() {
    cancelProfileEdit();
    restoreDesktopProfileHero();
    t?.removeAttribute("data-stg-view");
    e?.classList.remove("open");
    t?.classList.remove("open");
    document.body.classList.remove("stg-open");
    document.body.style.overflow = "";
    document.getElementById("navWrapper")?.classList.remove("disabled");
  }
  async function fetchSecureSettingsData() {
    const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
      "Content-Type": "application/json"
    };
    const t = window.apiRequestCache?.dedupFetch?.bind(window.apiRequestCache) || fetch;
    const api = e => typeof window.apiUrl === "function" ? window.apiUrl(e) : e;
    const [n, o, i] = await Promise.all([ t(api("/api/user/profile"), {
      method: "POST",
      credentials: "include",
      headers: e,
      body: JSON.stringify({})
    }), t(api("/api/clips/status"), {
      method: "GET",
      credentials: "include",
      headers: e
    }).catch(() => null), t(api("/api/user/billing"), {
      method: "GET",
      credentials: "include",
      headers: e
    }).catch(() => null) ]);
    if (n.status === 401) {
      throw new Error("Unauthorized");
    }
    if (o && o.status === 401) {
      throw new Error("Unauthorized");
    }
    if (!n.ok) throw new Error("Failed to load profile");
    const s = await n.json();
    let r = null;
    if (o && o.ok) {
      r = await o.json();
    }
    let a = null;
    if (i && i.ok) {
      try {
        a = await i.json();
      } catch (e) {
        a = null;
      }
    }
    if (!s || typeof s !== "object" || typeof s.plan !== "string") {
      throw new Error("Invalid profile response");
    }
    if (a && typeof a === "object") {
      if (a.paddleSubscriptionId && !s.paddle_subscription_id) {
        s.paddle_subscription_id = a.paddleSubscriptionId;
      }
      if (a.status && !s.plan_status) {
        s.plan_status = a.status;
        s.subscription_status = a.status;
      }
      if (a.nextBillingDate && !s.plan_expires_at) {
        s.plan_expires_at = a.nextBillingDate;
        s.subscription_end_date = a.nextBillingDate;
      }
    }
    return {
      profile: s,
      subscription: a,
      clipsStatus: r,
      storageInfo: null
    };
  }
  function formatBytesLabel(e) {
    const t = Math.max(0, Number(e) || 0);
    if (t >= 1024 * 1024 * 1024) {
      const e = t / (1024 * 1024 * 1024);
      return (e >= 10 ? e.toFixed(1) : e.toFixed(2)) + " GB";
    }
    if (t >= 1024 * 1024) {
      return Math.max(1, Math.round(t / (1024 * 1024))) + " MB";
    }
    if (t >= 1024) return Math.round(t / 1024) + " KB";
    return "0 MB";
  }
  function formatStoragePair(e, t) {
    const n = Math.max(0, Number(e) || 0);
    const o = Math.max(1, Number(t) || 1);
    const i = o / (1024 * 1024 * 1024);
    const s = i >= .95 ? (i >= 10 ? i.toFixed(0) : i.toFixed(1)) + " GB" : formatBytesLabel(o);
    return formatBytesLabel(n) + " / " + s;
  }
  function formatRenewalLabel(e, t) {
    if (!e || typeof e !== "string") return null;
    const n = Date.parse(e);
    if (Number.isNaN(n)) return null;
    const o = new Date(n);
    const i = o.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const s = Math.ceil((o - new Date) / (1e3 * 60 * 60 * 24));
    const r = t === "cancelled" ? "Access until" : "Renews on";
    if (s < 0) return "Expired on " + i;
    if (s === 0) return r + " " + i + " (today)";
    return r + " " + i;
  }
  function setQuotaFill(e, t, n) {
    if (!e) return;
    const o = Math.max(0, Number(n) || 0);
    const i = o > 0 ? Math.min(100, Math.round(Math.max(0, Number(t) || 0) / o * 100)) : 0;
    e.style.width = i + "%";
    e.classList.toggle("is-warn", i >= 75 && i < 95);
    e.classList.toggle("is-full", i >= 95);
  }
  function setText(e, t) {
    const n = document.getElementById(e);
    if (n) n.textContent = t;
  }
  function setSubscriptionLoading(e) {
    const t = document.getElementById("stgPanelBilling") || document.getElementById("stgPanelSubscription");
    if (!t) return;
    t.classList.toggle("is-loading", !!e);
    t.classList.toggle("is-ready", !e);
  }
  function syncBillingCancelUI(e = {}) {
    const t = document.getElementById("stgBillingActions");
    const n = document.getElementById("stgCancelSubBtn");
    const o = document.getElementById("stgCancelSubHint");
    if (!t || !n) return;
    const i = String(e.plan || "free").toLowerCase();
    const s = String(e.status || e.planStatus || "").toLowerCase();
    const r = i !== "free";
    const a = s === "cancelled" || s === "canceled";
    const c = e.canCancel === true || r && !a && e.hasPaddle !== false && s !== "inactive";
    t.hidden = !r;
    if (!r) return;
    if (a) {
      n.disabled = true;
      n.textContent = "Cancelled";
      if (o) {
        const t = formatRenewalLabel(e.nextBillingDate, "cancelled");
        o.textContent = t ? `Cancellation scheduled. ${t}.` : "Cancellation scheduled. You keep access until the end of the billing period.";
      }
      return;
    }
    n.disabled = !c;
    n.textContent = "Cancel subscription";
    if (o) {
      o.textContent = c ? "Stops future renewals through Paddle. You keep access until the end of the current billing period." : "Subscription is not linked to Paddle yet. Contact support if you need to cancel.";
    }
  }
  async function cancelSubscriptionViaPaddle() {
    const e = document.getElementById("stgCancelSubBtn");
    if (e?.disabled) return;
    const t = confirm("⚠️ Cancel subscription — immediate action\n\n" + "This takes effect right away for billing:\n" + "• Future renewals stop immediately\n" + "• You keep your current plan until the end of this billing period\n" + "• After that date you drop to Free (no refund for unused days)\n\n" + "Continue?");
    if (!t) return;
    const n = prompt("Type CANCEL to confirm you want to stop renewals now:");
    if (!n || String(n).trim().toUpperCase() !== "CANCEL") {
      alert("Confirmation did not match. Subscription was not cancelled.");
      return;
    }
    const o = e ? e.textContent : "Cancel subscription";
    if (e) {
      e.disabled = true;
      e.textContent = "Cancelling…";
    }
    try {
      const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/billing/cancel") : (window.API_BASE_URL || "/api") + "/billing/cancel";
      const n = await fetch(t, {
        method: "POST",
        credentials: "include",
        headers: {
          ...e,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          effective_from: "next_billing_period"
        })
      });
      const o = await n.json().catch(() => ({}));
      if (!n.ok || !o.success) {
        throw new Error(o.error || o.message || "Could not cancel subscription");
      }
      if (typeof window.showNotification === "function") {
        window.showNotification(o.message || "Renewals stopped. You keep access until period end.", "success");
      } else {
        alert(o.message || "✅ Subscription cancel scheduled.\n\n" + "Renewals stopped immediately. You keep full access until the end of your current billing period.");
      }
      syncBillingCancelUI({
        plan: o.plan || window.currentUser?.plan || "basic",
        status: "cancelled",
        planStatus: "cancelled",
        hasPaddle: true,
        canCancel: false,
        nextBillingDate: o.nextBillingDate
      });
      if (o.nextBillingDate) {
        const e = formatRenewalLabel(o.nextBillingDate, "cancelled");
        if (e) setText("stgRenewalDate", e);
      }
      if (window.currentUser) {
        window.currentUser.plan_status = "cancelled";
        window.currentUser.subscription_status = "cancelled";
      }
      try {
        await updateSettingsModal();
      } catch (e) {}
    } catch (t) {
      if (e) {
        e.disabled = false;
        e.textContent = o;
      }
      alert(t.message || "Could not cancel subscription");
    }
  }
  function formatQuotaResetHint(e, t) {
    if (!e || typeof e !== "string") {
      return String(t || "").replace(/\s*Resets \{when\}\.?/i, "").trim() || "Usage details unavailable.";
    }
    const n = e.trim();
    const o = /[zZ]|[+-]\d{2}:?\d{2}$/.test(n);
    const i = Date.parse(o ? n : `${n.replace(" ", "T")}Z`);
    if (Number.isNaN(i)) {
      return String(t || "").replace(/\s*Resets \{when\}\.?/i, "").trim() || "Usage details unavailable.";
    }
    const s = new Date(i);
    const r = s.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    return t.replace("{when}", r);
  }
  async function updateSettingsModal() {
    let e = null;
    try {
      if (window.currentUser) e = window.validateUserObject?.(window.currentUser) || window.currentUser;
      if (!e) {
        const t = localStorage.getItem("currentUser");
        if (t) {
          try {
            e = window.validateUserObject?.(JSON.parse(t)) || JSON.parse(t);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error("Error loading user data:", e);
    }
    const t = e;
    setText("stgName", t?.name || t?.username || "Guest User");
    if (window.SolisBadges?.renderCurrentUser) {
      window.SolisBadges.renderCurrentUser("stgBadges", 20);
    }
    setText("stgUserEmail", t?.email || "unknown@email.com");
    setText("stgEmailAddress", t?.email || "unknown@email.com");
    const n = document.getElementById("stgBio");
    const i = document.getElementById("stgProfileHero");
    if (n && !i?.classList.contains("is-editing")) {
      n.textContent = t?.bio || "";
    }
    const s = document.getElementById("stgAvatar");
    if (s) {
      const e = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(t || {}) : t?.picture || t?.avatar || null;
      const n = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      const o = e && (typeof window.isValidImageUrl !== "function" || window.isValidImageUrl(e));
      if (o) {
        const t = document.createElement("img");
        t.src = e;
        t.alt = "Profile";
        t.decoding = "async";
        t.referrerPolicy = "no-referrer";
        t.onerror = () => {
          s.innerHTML = n;
        };
        s.innerHTML = "";
        s.appendChild(t);
      } else {
        s.innerHTML = n;
      }
    }
    setSubscriptionLoading(true);
    const r = String(t?.plan || window.currentUser?.plan || "free").toLowerCase();
    const a = document.getElementById("stgPlanBanner");
    const c = document.getElementById("stgPlanMeta");
    const l = document.getElementById("stgPlanCompare");
    const d = document.getElementById("stgQuotaGrid");
    const applyPlanBanner = e => {
      if (a) a.setAttribute("data-plan", e);
      const t = e === "free";
      if (c) c.hidden = t;
      if (l) l.hidden = !t;
      if (d) d.hidden = t;
    };
    if ([ "free", "basic", "prime", "elite" ].includes(r)) {
      setText("stgCurrentPlan", r.charAt(0).toUpperCase() + r.slice(1));
      applyPlanBanner(r);
    }
    try {
      const {profile: t, subscription: n, clipsStatus: i, storageInfo: s} = await fetchSecureSettingsData();
      const r = document.getElementById("stgProfileHero")?.classList.contains("is-editing");
      if (t.name) {
        setText("stgName", t.name);
        if (!r && window.currentUser) {
          window.currentUser.name = t.name;
          window.currentUser.displayName = t.name;
        }
      }
      if (typeof t.bio === "string" && !r) {
        setText("stgBio", t.bio);
        if (window.currentUser) window.currentUser.bio = t.bio;
      }
      if (t.email) {
        setText("stgUserEmail", t.email);
        setText("stgEmailAddress", t.email);
      }
      if (t.public_id || t.solis_id) {
        const e = t.public_id || t.solis_id;
        setText("stgSolisPublicId", formatSolisIdDisplay(e));
        if (window.currentUser) {
          window.currentUser.public_id = e;
          window.currentUser.solis_id = e;
        }
      }
      if (t.supabase_auth_id && window.currentUser) {
        window.currentUser.supabase_auth_id = t.supabase_auth_id;
      }
      if (t.picture || t.avatar) {
        const n = t.picture || t.avatar;
        if (window.currentUser) {
          window.currentUser.picture = n;
          window.currentUser.avatar = n;
        }
        const o = document.getElementById("stgAvatar");
        const i = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl({
          ...e,
          ...t,
          picture: n
        }) : n;
        const s = i && (typeof window.isValidImageUrl !== "function" || window.isValidImageUrl(i));
        if (o && s) {
          let e = o.querySelector("img");
          if (!e) {
            e = document.createElement("img");
            e.alt = "Profile";
            e.decoding = "async";
            e.referrerPolicy = "no-referrer";
            o.innerHTML = "";
            o.appendChild(e);
          }
          e.src = i + (i.includes("?") ? "&" : "?") + "v=" + Date.now();
        }
      }
      const a = String(t.plan || "free").toLowerCase();
      const c = [ "free", "basic", "prime", "elite" ];
      const l = c.includes(a) ? a : "free";
      const d = l.charAt(0).toUpperCase() + l.slice(1);
      const u = l === "free";
      setText("stgCurrentPlan", d);
      applyPlanBanner(l);
      if (o) {
        o.classList.toggle("hidden", l === "elite" || u);
      }
      const f = i && typeof i === "object" ? i : {};
      const g = f.storage?.videos || {};
      const p = f.storage?.space_mb || {};
      const m = f.daily || {};
      const w = f.monthly || {};
      const y = f.max_effort || {};
      const h = g.unlimited === true || [ "basic", "prime", "elite" ].includes(String(l || "").toLowerCase());
      const E = Math.max(0, Number(g.used ?? 0) || 0);
      const v = h ? null : Math.max(1, Number(g.limit ?? 5) || 5);
      if (h) {
        setText("stgVideosUsed", E + " clips (unlimited)");
        setQuotaFill(document.getElementById("stgVideosFill"), 0, 1);
      } else {
        setText("stgVideosUsed", E + " / " + v);
        setQuotaFill(document.getElementById("stgVideosFill"), E, v);
      }
      const b = document.getElementById("stgStorage")?.closest(".stgQuota");
      if (b) b.hidden = true;
      const C = Math.max(0, Number(m.limit ?? f.plan?.videos_per_day ?? 0) || 0);
      const S = Math.max(0, Number(m.used ?? 0) || 0);
      if (C > 0) {
        setText("stgDailyGens", S + " / " + C);
        setQuotaFill(document.getElementById("stgDailyFill"), S, C);
        const e = document.getElementById("stgDailyHint");
        if (e) {
          if (m.resets_at) {
            e.textContent = formatQuotaResetHint(m.resets_at, S >= C ? "Daily limit reached. Resets {when}." : "Resets {when}.");
          }
        }
      } else {
        setText("stgDailyGens", "—");
        setQuotaFill(document.getElementById("stgDailyFill"), 0, 1);
      }
      const B = Math.max(0, Number(w.limit ?? f.plan?.videos_per_month ?? 0) || 0);
      const I = Math.max(0, Number(w.used ?? 0) || 0);
      if (B > 0) {
        setText("stgMonthlyGens", I + " / " + B);
        setQuotaFill(document.getElementById("stgMonthlyFill"), I, B);
        const e = document.getElementById("stgMonthlyHint");
        if (e) {
          e.textContent = formatQuotaResetHint(w.resets_at, I >= B ? "Monthly limit reached. Resets {when}." : "Resets {when}.");
        }
      } else {
        setText("stgMonthlyGens", "—");
        setQuotaFill(document.getElementById("stgMonthlyFill"), 0, 1);
      }
      const M = Number(y.limit ?? 0);
      const L = Number(y.used ?? 0);
      const x = y.remaining;
      if (M > 0) {
        setText("stgMaxEffort", L + " / " + M + " used");
        setQuotaFill(document.getElementById("stgMaxFill"), L, M);
        const e = document.getElementById("stgMaxHint");
        if (e) {
          const t = Math.max(0, Number(x ?? M - L));
          e.textContent = t > 0 ? t + " Premium Request" + (t === 1 ? "" : "s") + " left in this window." : "Premium Requests locked until reset.";
        }
      } else {
        setText("stgMaxEffort", "Not on your plan");
        setQuotaFill(document.getElementById("stgMaxFill"), 0, 1);
        const e = document.getElementById("stgMaxHint");
        if (e) e.textContent = "Upgrade to Prime or Elite for Premium Requests.";
      }
      const U = formatRenewalLabel(t.subscription_end_date || t.plan_expires_at, t.plan_status);
      if (U) setText("stgRenewalDate", U); else if (!u) setText("stgRenewalDate", "Active subscription"); else setText("stgRenewalDate", "No active subscription");
      syncBillingCancelUI({
        plan: l,
        planStatus: t.plan_status || t.subscription_status,
        hasPaddle: !!(t.paddle_subscription_id || n?.paddleSubscriptionId),
        canCancel: n?.canCancel,
        status: n?.status || t.plan_status,
        nextBillingDate: n?.nextBillingDate || t.subscription_end_date || t.plan_expires_at
      });
      window.currentUser = Object.assign({}, window.currentUser || {}, t, {
        active_videos: E,
        video_limit: v
      });
      setSubscriptionLoading(false);
    } catch (e) {
      console.error("Error fetching settings subscription data:", e);
      setText("stgCurrentPlan", "Error loading");
      setText("stgRenewalDate", "Unavailable");
      setText("stgVideosUsed", "Unavailable");
      setText("stgStorage", "Unavailable");
      setText("stgDailyGens", "Unavailable");
      setText("stgMonthlyGens", "Unavailable");
      setText("stgMaxEffort", "Unavailable");
      syncBillingCancelUI({
        plan: "free"
      });
      setSubscriptionLoading(false);
    }
    updateYouTubeConnectorUI(!!(window.currentUser?.youtube_connected || t?.youtube_connected));
  }
  function updateYouTubeConnectorUI(e) {
    const t = document.getElementById("stgYouTubeStatus");
    const n = [ document.getElementById("stgYouTubeConnectBtn"), document.getElementById("stgYouTubeConnectBtnPopular") ].filter(Boolean);
    const o = document.getElementById("stgYouTubeConnector");
    const i = document.querySelector('.stgConnPopularCard[data-conn-id="youtube"]');
    const s = e ? "on" : "off";
    if (t) {
      t.textContent = e ? "Connected" : "Not connected";
      t.classList.toggle("is-on", e);
    }
    n.forEach(t => {
      t.textContent = e ? "Disconnect" : "Connect";
      t.classList.toggle("is-connected", e);
      t.disabled = false;
    });
    if (o) {
      o.classList.toggle("is-connected", e);
      o.setAttribute("data-conn-status", s);
    }
    if (i) i.setAttribute("data-conn-status", s);
    filterConnectorRows();
  }
  function handleYouTubeConnectClick() {
    const e = !!(window.currentUser && window.currentUser.youtube_connected);
    if (e) {
      if (typeof window.disconnectYouTube === "function") window.disconnectYouTube();
    } else if (typeof window.connectYouTube === "function") {
      window.connectYouTube();
    }
  }
  [ "stgYouTubeConnectBtn", "stgYouTubeConnectBtnPopular" ].forEach(e => {
    document.getElementById(e)?.addEventListener("click", handleYouTubeConnectClick);
  });
  document.querySelectorAll(".stgConnFilter").forEach(e => {
    e.addEventListener("click", () => setConnFilter(e.getAttribute("data-conn-filter")));
  });
  document.getElementById("stgConnectorsSearch")?.addEventListener("input", filterConnectorRows);
  document.getElementById("stgDirSearchToggle")?.addEventListener("click", () => {
    const e = document.querySelector(".stgNavBtn.is-active[data-stg-panel]")?.getAttribute("data-stg-panel");
    if (e !== "connectors") return;
    d = !d;
    const t = document.getElementById("stgConnSearchBar");
    if (t) {
      t.hidden = !d;
      if (d) document.getElementById("stgConnectorsSearch")?.focus();
    }
  });
  document.getElementById("stgDirBrowseBtn")?.addEventListener("click", () => {
    const e = document.querySelector(".stgNavBtn.is-active[data-stg-panel]")?.getAttribute("data-stg-panel");
    if (e === "connectors") {
      d = true;
      const e = document.getElementById("stgConnSearchBar");
      if (e) {
        e.hidden = false;
        document.getElementById("stgConnectorsSearch")?.focus();
      }
    }
  });
  document.getElementById("stgDirAddBtn")?.addEventListener("click", () => {});
  document.getElementById("stgNavSearch")?.addEventListener("input", e => {
    filterSettingsNav(e.target.value);
  });
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.updateSettingsModal = updateSettingsModal;
  window.switchSettingsPanel = switchSettingsPanel;
  const b = document.getElementById("stgEditHeaderBtn");
  let C = false;
  function setProfileEditing(e) {
    const t = document.getElementById("stgProfileHero");
    const n = document.getElementById("stgName");
    const o = document.getElementById("stgBio");
    const i = document.getElementById("stgNameInput");
    const s = document.getElementById("stgBioInput");
    if (!t || !i || !s || !b) return;
    C = !!e;
    t.classList.toggle("is-editing", C);
    i.hidden = !C;
    s.hidden = !C;
    if (C) {
      i.value = (n?.textContent || "").trim();
      s.value = o?.textContent || "";
      b.classList.add("editing");
      b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Done</span>';
      requestAnimationFrame(() => {
        i.focus();
        i.select();
      });
    } else {
      b.classList.remove("editing");
      b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit</span>';
    }
  }
  function toggleProfileEditMode() {
    if (!C) {
      setProfileEditing(true);
      return;
    }
    const e = document.getElementById("stgNameInput");
    const t = document.getElementById("stgBioInput");
    saveProfileChanges(e?.value?.trim() || "", t?.value?.trim() || "");
  }
  async function saveProfileChanges(e, t) {
    const n = String(e || "").trim();
    const o = String(t || "").trim();
    if (!n) {
      alert("Name cannot be empty");
      return;
    }
    if (n.length > 50) {
      alert("Name too long (max 50 characters)");
      return;
    }
    if (o.length > 120) {
      alert("Bio too long (max 120 characters)");
      return;
    }
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/user/profile/update") : "/api/user/profile/update";
      const t = typeof window.apiFetch === "function" ? window.apiFetch : fetch;
      const i = await t(e, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: n,
          bio: o
        })
      });
      let s = {};
      try {
        s = await i.json();
      } catch (e) {}
      if (!i.ok) {
        throw new Error(s.error || "Failed to update profile");
      }
      const r = s.name || n;
      const a = typeof s.bio === "string" ? s.bio : o;
      setText("stgName", r);
      setText("stgBio", a);
      setProfileEditing(false);
      if (window.currentUser && typeof window.currentUser === "object") {
        window.currentUser.name = r;
        window.currentUser.displayName = r;
        window.currentUser.bio = a;
      }
      try {
        const e = localStorage.getItem("currentUser");
        if (e) {
          const t = JSON.parse(e);
          t.name = r;
          t.bio = a;
          localStorage.setItem("currentUser", JSON.stringify(t));
        }
      } catch (e) {}
      document.querySelectorAll(".user-name, #menuUserName").forEach(e => {
        if (e) e.textContent = r;
      });
      const c = document.querySelector("#dropdownUserName .username-text");
      if (c) c.textContent = r; else {
        const e = document.getElementById("dropdownUserName");
        if (e && !e.querySelector(".badge-container")) e.textContent = r;
      }
      try {
        if (window.NotificationSystemV2?.loadUserBadges) {
          window.NotificationSystemV2.loadUserBadges(true);
        }
      } catch (e) {}
      if (typeof window.apiCache?.clearUserProfile === "function") {
        window.apiCache.clearUserProfile();
      } else if (window.apiCache) {
        window.apiCache.userProfile = null;
        window.apiCache.userProfileTime = 0;
      }
      if (typeof window.showNotification === "function") {
        window.showNotification("Profile updated", "success");
      }
    } catch (e) {
      console.error("Profile update error:", e);
      alert(e.message || "Error updating profile");
      cancelProfileEdit();
    }
  }
  const S = document.getElementById("pfpFileInput");
  const B = document.getElementById("stgAvatarContainer");
  const I = document.getElementById("stgCropBackdrop");
  const M = document.getElementById("stgCropModal");
  const L = document.getElementById("stgCropImg");
  const x = document.getElementById("stgCropViewport");
  const U = document.getElementById("stgCropStage");
  const P = document.getElementById("stgCropZoom");
  const A = document.getElementById("stgCropSave");
  let T = false;
  let k = 0;
  const N = 4e3;
  const _ = 5 * 1024 * 1024;
  const D = 512;
  const F = {
    open: false,
    objectUrl: null,
    naturalW: 0,
    naturalH: 0,
    baseScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointerId: null
  };
  function detectImageMime(e) {
    if (e.length >= 3 && e[0] === 255 && e[1] === 216 && e[2] === 255) {
      return "image/jpeg";
    }
    if (e.length >= 8 && e[0] === 137 && e[1] === 80 && e[2] === 78 && e[3] === 71) {
      return "image/png";
    }
    if (e.length >= 12 && e[0] === 82 && e[1] === 73 && e[2] === 70 && e[3] === 70 && e[8] === 87 && e[9] === 69 && e[10] === 66 && e[11] === 80) {
      return "image/webp";
    }
    return null;
  }
  function cropViewportSize() {
    if (!x) return 280;
    return Math.max(120, Math.round(x.getBoundingClientRect().width || 280));
  }
  function clampCropOffsets() {
    const e = cropViewportSize();
    const t = F.baseScale * F.zoom;
    const n = F.naturalW * t;
    const o = F.naturalH * t;
    const i = Math.max(0, (n - e) / 2);
    const s = Math.max(0, (o - e) / 2);
    F.offsetX = Math.max(-i, Math.min(i, F.offsetX));
    F.offsetY = Math.max(-s, Math.min(s, F.offsetY));
  }
  function applyCropTransform() {
    if (!L) return;
    clampCropOffsets();
    const e = F.baseScale * F.zoom;
    L.style.width = `${F.naturalW}px`;
    L.style.height = `${F.naturalH}px`;
    L.style.transform = `translate(-50%, -50%) translate(${F.offsetX}px, ${F.offsetY}px) scale(${e})`;
  }
  function closeCropModal() {
    F.open = false;
    F.dragging = false;
    I?.classList.remove("is-open");
    M?.classList.remove("is-open");
    if (I) I.hidden = true;
    if (M) M.hidden = true;
    if (F.objectUrl) {
      URL.revokeObjectURL(F.objectUrl);
      F.objectUrl = null;
    }
    if (L) L.removeAttribute("src");
    if (S) S.value = "";
    if (A) {
      A.disabled = false;
      A.classList.remove("is-busy");
    }
  }
  function openCropModal(e) {
    if (!M || !L || !x) {
      uploadProfilePicture(e);
      return;
    }
    if (F.objectUrl) URL.revokeObjectURL(F.objectUrl);
    const t = URL.createObjectURL(e);
    F.objectUrl = t;
    F.zoom = 1;
    F.offsetX = 0;
    F.offsetY = 0;
    if (P) P.value = "1";
    const onLoad = () => {
      L.removeEventListener("load", onLoad);
      F.naturalW = L.naturalWidth || 0;
      F.naturalH = L.naturalHeight || 0;
      if (F.naturalW < 64 || F.naturalH < 64) {
        closeCropModal();
        if (typeof window.showNotification === "function") {
          window.showNotification("Image too small. Minimum 64x64 pixels.", "error");
        }
        return;
      }
      if (F.naturalW > 5e3 || F.naturalH > 5e3) {
        closeCropModal();
        if (typeof window.showNotification === "function") {
          window.showNotification("Image too large. Maximum 5000x5000 pixels.", "error");
        }
        return;
      }
      const e = cropViewportSize();
      F.baseScale = Math.max(e / F.naturalW, e / F.naturalH);
      F.zoom = 1;
      F.offsetX = 0;
      F.offsetY = 0;
      applyCropTransform();
      F.open = true;
      if (I) {
        I.hidden = false;
        I.classList.add("is-open");
      }
      M.hidden = false;
      M.classList.add("is-open");
      requestAnimationFrame(() => applyCropTransform());
    };
    L.addEventListener("load", onLoad);
    L.src = t;
  }
  async function exportCroppedAvatarFile() {
    const e = cropViewportSize();
    const t = F.baseScale * F.zoom;
    const n = D;
    const o = document.createElement("canvas");
    o.width = n;
    o.height = n;
    const i = o.getContext("2d", {
      alpha: false
    });
    if (!i) throw new Error("Failed to process image");
    i.fillStyle = "#ffffff";
    i.fillRect(0, 0, n, n);
    const s = e / t;
    const r = F.naturalW / 2 - F.offsetX / t;
    const a = F.naturalH / 2 - F.offsetY / t;
    const c = r - s / 2;
    const l = a - s / 2;
    i.drawImage(L, c, l, s, s, 0, 0, n, n);
    const d = await new Promise(e => {
      o.toBlob(t => {
        if (t && t.size > 0) e(t); else o.toBlob(t => e(t), "image/jpeg", .9);
      }, "image/webp", .9);
    });
    if (!d || d.size <= 0) throw new Error("Failed to process image");
    if (d.size > _) throw new Error("Image too large. Maximum size is 5MB.");
    const u = d.type === "image/webp" ? "image/webp" : "image/jpeg";
    const f = u === "image/webp" ? "webp" : "jpg";
    return new File([ d ], `avatar.${f}`, {
      type: u,
      lastModified: Date.now()
    });
  }
  function applyAvatarEverywhere(e) {
    if (!e) return;
    let t = e;
    try {
      if (typeof resolveAvatarUrl === "function" && window.currentUser) {
        t = resolveAvatarUrl(window.currentUser.id || window.currentUser, e) || e;
      } else if (typeof resolveAvatarUrl === "function") {
        t = resolveAvatarUrl(null, e) || e;
      }
    } catch (e) {}
    if (t.startsWith("/") && typeof window.apiUrl === "function") {
      try {
        const e = String(window.apiUrl("/")).replace(/\/api\/?$/, "");
        if (e) t = e + t;
      } catch (e) {}
    } else if (t.startsWith("/") && window.API_BASE_URL) {
      const e = String(window.API_BASE_URL).replace(/\/api\/?$/, "");
      if (e) t = e + t;
    }
    const n = t + (t.includes("?") ? "&" : "?") + "t=" + Date.now();
    const setImg = e => {
      if (!e) return;
      let t = e.tagName === "IMG" ? e : e.querySelector("img");
      if (!t) {
        t = document.createElement("img");
        t.alt = "Profile";
        t.decoding = "async";
        t.referrerPolicy = "no-referrer";
        if (e.tagName !== "IMG") {
          e.innerHTML = "";
          e.appendChild(t);
        }
      }
      t.src = n;
    };
    setImg(document.getElementById("stgAvatar"));
    setImg(document.querySelector(".user-avatar"));
    setImg(document.getElementById("profileAvatarBtn"));
    setImg(document.getElementById("dropdownUserAvatar"));
    setImg(document.getElementById("menuUserAvatar"));
  }
  async function uploadProfilePicture(e) {
    if (T || !e) return;
    T = true;
    const t = document.getElementById("stgAvatar");
    try {
      if (t) t.style.opacity = "0.55";
      if (A) {
        A.disabled = true;
        A.classList.add("is-busy");
      }
      const n = new FormData;
      n.append("pfp", e, e.name || "avatar.webp");
      const o = typeof window.apiFetch === "function" ? window.apiFetch : fetch;
      const i = await o("/api/user/pfp", {
        method: "POST",
        credentials: "include",
        body: n
      });
      let s = {};
      try {
        s = await i.json();
      } catch (e) {}
      if (!i.ok) {
        throw new Error(s.error || "Failed to upload profile picture");
      }
      const r = s.avatar_url || s.pfp_url || "";
      if (!r.startsWith("/api/avatar/")) {
        throw new Error("Server returned an invalid avatar URL");
      }
      applyAvatarEverywhere(r);
      if (window.currentUser && typeof window.currentUser === "object") {
        window.currentUser.picture = r;
        window.currentUser.avatar = r;
      }
      try {
        const e = localStorage.getItem("currentUser");
        if (e) {
          const t = JSON.parse(e);
          t.picture = r;
          t.avatar = r;
          localStorage.setItem("currentUser", JSON.stringify(t));
        }
      } catch (e) {}
      if (window.apiCache) {
        window.apiCache.userProfile = null;
        window.apiCache.userProfileTime = 0;
      }
      k = Date.now();
      closeCropModal();
      if (typeof window.showNotification === "function") {
        window.showNotification("Profile picture updated", "success");
      }
    } catch (e) {
      console.error("PFP upload error:", e);
      if (typeof window.showNotification === "function") {
        window.showNotification(e.message || "Failed to upload profile picture", "error");
      } else {
        alert(e.message || "Failed to upload profile picture");
      }
      if (A) {
        A.disabled = false;
        A.classList.remove("is-busy");
      }
    } finally {
      if (t) t.style.opacity = "1";
      T = false;
      if (S) S.value = "";
    }
  }
  async function saveCroppedAvatar() {
    if (!F.open || T) return;
    try {
      const e = await exportCroppedAvatarFile();
      await uploadProfilePicture(e);
    } catch (e) {
      console.error("Crop export error:", e);
      if (typeof window.showNotification === "function") {
        window.showNotification(e.message || "Failed to process image", "error");
      }
    }
  }
  function onCropPointerDown(e) {
    if (!F.open || e.button != null && e.button !== 0) return;
    e.preventDefault();
    F.dragging = true;
    F.lastX = e.clientX;
    F.lastY = e.clientY;
    F.pointerId = e.pointerId;
    U?.setPointerCapture?.(e.pointerId);
  }
  function onCropPointerMove(e) {
    if (!F.dragging) return;
    e.preventDefault();
    const t = e.clientX - F.lastX;
    const n = e.clientY - F.lastY;
    F.lastX = e.clientX;
    F.lastY = e.clientY;
    F.offsetX += t;
    F.offsetY += n;
    applyCropTransform();
  }
  function onCropPointerUp(e) {
    if (!F.dragging) return;
    F.dragging = false;
    try {
      U?.releasePointerCapture?.(e.pointerId);
    } catch (e) {}
  }
  if (U) {
    U.addEventListener("pointerdown", onCropPointerDown);
    U.addEventListener("pointermove", onCropPointerMove);
    U.addEventListener("pointerup", onCropPointerUp);
    U.addEventListener("pointercancel", onCropPointerUp);
    U.addEventListener("wheel", e => {
      if (!F.open) return;
      e.preventDefault();
      const t = e.deltaY > 0 ? -.08 : .08;
      F.zoom = Math.max(1, Math.min(3, F.zoom + t));
      if (P) P.value = String(F.zoom);
      applyCropTransform();
    }, {
      passive: false
    });
  }
  P?.addEventListener("input", () => {
    F.zoom = Math.max(1, Math.min(3, Number(P.value) || 1));
    applyCropTransform();
  });
  document.getElementById("stgCropZoomIn")?.addEventListener("click", () => {
    F.zoom = Math.min(3, F.zoom + .12);
    if (P) P.value = String(F.zoom);
    applyCropTransform();
  });
  document.getElementById("stgCropZoomOut")?.addEventListener("click", () => {
    F.zoom = Math.max(1, F.zoom - .12);
    if (P) P.value = String(F.zoom);
    applyCropTransform();
  });
  document.getElementById("stgCropCancel")?.addEventListener("click", () => closeCropModal());
  document.getElementById("stgCropClose")?.addEventListener("click", () => closeCropModal());
  I?.addEventListener("click", () => closeCropModal());
  M?.addEventListener("click", e => {
    if (e.target === M) closeCropModal();
  });
  A?.addEventListener("click", () => {
    saveCroppedAvatar();
  });
  M?.querySelector(".stgCropCard")?.addEventListener("click", e => e.stopPropagation());
  if (B && S) {
    B.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (T || F.open) return;
      S.click();
    });
  }
  if (S) {
    S.addEventListener("change", async () => {
      const e = S.files && S.files[0];
      if (!e) return;
      const t = Date.now();
      if (t - k < N) {
        if (typeof window.showNotification === "function") {
          window.showNotification("Please wait before uploading another picture", "warning");
        }
        S.value = "";
        return;
      }
      try {
        const t = new Uint8Array(await e.slice(0, 16).arrayBuffer());
        const n = detectImageMime(t);
        if (!n) throw new Error("File is not a valid JPG, PNG, or WebP image");
        if (e.size <= 0 || e.size > _) {
          throw new Error("Image too large. Maximum size is 5MB.");
        }
        openCropModal(e);
      } catch (e) {
        S.value = "";
        if (typeof window.showNotification === "function") {
          window.showNotification(e.message || "Invalid image", "error");
        } else {
          alert(e.message || "Invalid image");
        }
      }
    });
  }
  function formatSolisIdDisplay(e) {
    const t = String(e || "").trim().toUpperCase();
    if (!t.startsWith("SOL-")) return t;
    const n = t.slice(4).replace(/-/g, "");
    if (n.length <= 8) return `SOL-${n}`;
    const o = [];
    for (let e = 0; e < n.length; e += 4) o.push(n.slice(e, e + 4));
    return `SOL-${o.join("-")}`;
  }
  function populateAccountPanel() {
    const e = window.currentUser?.public_id || window.currentUser?.solis_id || document.getElementById("stgSolisPublicId")?.textContent || "—";
    const t = document.getElementById("stgSolisPublicId");
    if (t && e && e !== "—") t.textContent = formatSolisIdDisplay(e);
    const n = navigator.userAgent || "";
    let o = "This browser";
    const i = n.toLowerCase();
    if (i.includes("edg/")) o = "Edge"; else if (i.includes("firefox")) o = "Firefox"; else if (i.includes("chrome")) o = "Chrome"; else if (i.includes("safari")) o = "Safari";
    setText("stgSessionDevice", o);
    const s = new Date;
    const fmt = e => {
      try {
        return e.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
      } catch (t) {
        return e.toISOString();
      }
    };
    setText("stgSessionUpdated", fmt(s));
    const r = document.getElementById("stgSessionCreated");
    if (r && (!r.textContent || r.textContent === "—")) {
      r.textContent = fmt(s);
    }
    setText("stgSessionLocation", "…");
    const a = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
      "Content-Type": "application/json"
    };
    const c = typeof window.apiUrl === "function" ? window.apiUrl("/api/user/account/sessions") : "/api/user/account/sessions";
    fetch(c, {
      credentials: "include",
      headers: a
    }).then(e => e.ok ? e.json() : null).then(e => {
      const t = e?.sessions?.[0];
      if (!t) {
        setText("stgSessionLocation", "Unknown");
        return;
      }
      if (t.device) setText("stgSessionDevice", t.device);
      setText("stgSessionLocation", t.location || "Unknown");
      if (t.updated_at) {
        try {
          setText("stgSessionUpdated", fmt(new Date(t.updated_at)));
        } catch (e) {}
      }
      if (t.created_at) {
        try {
          setText("stgSessionCreated", fmt(new Date(t.created_at)));
        } catch (e) {}
      }
    }).catch(() => setText("stgSessionLocation", "Unknown"));
  }
  document.getElementById("stgCopySolisIdBtn")?.addEventListener("click", async () => {
    const e = document.getElementById("stgSolisPublicId")?.textContent?.trim() || "";
    if (!e || e === "—") return;
    try {
      await navigator.clipboard.writeText(e);
      if (typeof window.showNotification === "function") {
        window.showNotification("Solis ID copied", "success");
      }
    } catch (t) {
      alert(e);
    }
  });
  document.getElementById("stgLogoutAllBtn")?.addEventListener("click", async () => {
    if (!confirm("Log out of all devices? You will need to sign in again.")) return;
    try {
      const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/user/account/logout-all") : "/api/user/account/logout-all";
      const n = await fetch(t, {
        method: "POST",
        credentials: "include",
        headers: e
      });
      if (!n.ok) throw new Error("Logout failed");
      window.location.href = "/login.html";
    } catch (e) {
      alert(e.message || "Could not log out");
    }
  });
  document.getElementById("stgCancelSubBtn")?.addEventListener("click", () => {
    cancelSubscriptionViaPaddle();
  });
  document.getElementById("stgDeleteAccountBtn")?.addEventListener("click", async () => {
    const e = prompt("Type DELETE to permanently close your Solis account:");
    if (!e) return;
    if (String(e).trim().toUpperCase() !== "DELETE") {
      alert("Confirmation did not match. Account not deleted.");
      return;
    }
    if (!confirm("This cannot be undone. Delete your account now?")) return;
    try {
      const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/user/account/delete") : "/api/user/account/delete";
      const n = await fetch(t, {
        method: "POST",
        credentials: "include",
        headers: {
          ...e,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          confirm: "DELETE"
        })
      });
      const o = await n.json().catch(() => ({}));
      if (!n.ok) throw new Error(o.error || "Delete failed");
      window.location.href = "/login.html";
    } catch (e) {
      alert(e.message || "Could not delete account");
    }
  });
  function cancelProfileEdit() {
    if (!C) return;
    setProfileEditing(false);
  }
  if (b) {
    b.addEventListener("click", e => {
      e.stopPropagation();
      toggleProfileEditMode();
    });
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && F.open) {
      e.preventDefault();
      closeCropModal();
      return;
    }
    if (e.key === "Escape" && C) {
      cancelProfileEdit();
      return;
    }
    if (e.key === "Escape" && t?.classList.contains("open")) {
      closeSettingsModal();
    }
  });
  async function copySupportEmail(e) {
    const t = (e?.dataset?.email || "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      const n = e.querySelector(".stgRowValue");
      if (n) {
        const e = n.textContent;
        n.textContent = "Copied";
        setTimeout(() => {
          n.textContent = e;
        }, 1400);
      }
    } catch (e) {
      window.location.href = `mailto:${t}`;
    }
  }
  document.getElementById("stgCopyHelpEmail")?.addEventListener("click", e => {
    e.preventDefault();
    copySupportEmail(e.currentTarget);
  });
  document.getElementById("stgCopyBusinessEmail")?.addEventListener("click", e => {
    e.preventDefault();
    copySupportEmail(e.currentTarget);
  });
});
