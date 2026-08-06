document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("stgBackdrop");
  const t = document.getElementById("stgModal");
  const n = document.getElementById("stgClose");
  const o = document.getElementById("stgUpgradeBtn");
  const i = document.getElementById("dropdownSettings");
  const s = document.getElementById("stgLogoutBtn");
  const a = document.getElementById("stgMainTitle");
  const r = {
    profile: "Profile",
    account: "Account",
    privacy: "Privacy",
    memory: "Memory",
    themes: "Themes",
    billing: "Billing/Usage",
    subscription: "Billing/Usage",
    support: "Support"
  };
  const l = "solis_effort_ui_mode";
  const c = "solis_plugin_auto_captions";
  const d = "solis_plugin_auto_sfx";
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
      auto_captions: readPluginFlag(c, false),
      auto_sfx: false
    };
  };
  function readEffortUiMode() {
    try {
      const e = localStorage.getItem(l);
      if (e === "slider" || e === "flyout") return e;
    } catch (e) {}
    return "slider";
  }
  function persistEffortUiMode(e) {
    try {
      localStorage.setItem(l, e);
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
  function syncThemeCards() {
    document.querySelectorAll(".stgThemeCard[data-theme-choice]").forEach(e => {
      const t = e.getAttribute("data-theme-choice") === "white";
      e.classList.toggle("is-selected", t);
      e.setAttribute("aria-checked", t ? "true" : "false");
    });
  }
  function switchSettingsPanel(e) {
    let t = e;
    if (t === "connections" || t === "connectors" || t === "plugins") return;
    t = r[t] ? t : "profile";
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
    if (a) a.textContent = r[t] || "Settings";
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
      if (a) a.textContent = "Settings";
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
  const u = document.getElementById("stgEffortSliderToggle");
  if (u) {
    syncEffortUiToggle();
    applyEffortUiMode(readEffortUiMode());
    u.addEventListener("click", () => {
      const e = readEffortUiMode() === "slider" ? "flyout" : "slider";
      applyEffortUiMode(e);
    });
  }
  const f = document.getElementById("stgAdvancedToggle");
  const g = f?.closest(".stgAdvanced");
  const p = document.getElementById("stgAdvancedBody");
  if (f && g && p) {
    f.addEventListener("click", () => {
      const e = !g.classList.contains("is-open");
      g.classList.toggle("is-open", e);
      f.setAttribute("aria-expanded", e ? "true" : "false");
      if (e) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
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
  const m = "solis_privacy_improve_product";
  function readImproveSolis() {
    try {
      const e = localStorage.getItem(m);
      if (e === null || e === undefined) return true;
      return e === "1" || e === "true";
    } catch (e) {
      return true;
    }
  }
  function setImproveSolis(e) {
    try {
      localStorage.setItem(m, e ? "1" : "0");
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
      if (n && r[n]) {
        document.querySelectorAll(".stgNavBtn[data-stg-panel]").forEach(e => {
          const t = e.getAttribute("data-stg-panel") === n;
          e.classList.toggle("is-active", t);
          e.setAttribute("aria-selected", t ? "true" : "false");
        });
        document.querySelectorAll(".stgPanel").forEach(e => {
          e.classList.toggle("is-active", e.getAttribute("data-stg-panel") === n);
        });
        if (a) a.textContent = r[n] || "Settings";
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
        if (a) a.textContent = "Settings";
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
    let a = null;
    if (o && o.ok) {
      a = await o.json();
    }
    let r = null;
    if (i && i.ok) {
      try {
        r = await i.json();
      } catch (e) {
        r = null;
      }
    }
    if (!s || typeof s !== "object" || typeof s.plan !== "string") {
      throw new Error("Invalid profile response");
    }
    if (r && typeof r === "object") {
      if (r.paddleSubscriptionId && !s.paddle_subscription_id) {
        s.paddle_subscription_id = r.paddleSubscriptionId;
      }
      if (r.status && !s.plan_status) {
        s.plan_status = r.status;
        s.subscription_status = r.status;
      }
      if (r.nextBillingDate && !s.plan_expires_at) {
        s.plan_expires_at = r.nextBillingDate;
        s.subscription_end_date = r.nextBillingDate;
      }
    }
    return {
      profile: s,
      subscription: r,
      clipsStatus: a,
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
    const a = t === "cancelled" ? "Access until" : "Renews on";
    if (s < 0) return "Expired on " + i;
    if (s === 0) return a + " " + i + " (today)";
    return a + " " + i;
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
    const a = i !== "free";
    const r = s === "cancelled" || s === "canceled";
    const l = e.canCancel === true || a && !r && e.hasPaddle !== false && s !== "inactive";
    t.hidden = !a;
    if (!a) return;
    if (r) {
      n.disabled = true;
      n.textContent = "Cancelled";
      if (o) {
        const t = formatRenewalLabel(e.nextBillingDate, "cancelled");
        o.textContent = t ? `Cancellation scheduled. ${t}.` : "Cancellation scheduled. You keep access until the end of the billing period.";
      }
      return;
    }
    n.disabled = !l;
    n.textContent = "Cancel subscription";
    if (o) {
      o.textContent = l ? "Stops future renewals through Paddle. You keep access until the end of the current billing period." : "Subscription is not linked to Paddle yet. Contact support if you need to cancel.";
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
    const n = Date.parse(e);
    if (Number.isNaN(n)) {
      return String(t || "").replace(/\s*Resets \{when\}\.?/i, "").trim() || "Usage details unavailable.";
    }
    const o = new Date(n);
    const i = o.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    return t.replace("{when}", i);
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
    if (!e) return;
    setText("stgName", e.name || e.username || "Guest User");
    setText("stgUserEmail", e.email || "unknown@email.com");
    setText("stgEmailAddress", e.email || "unknown@email.com");
    const t = document.getElementById("stgBio");
    const n = document.getElementById("stgProfileHero");
    if (t && !n?.classList.contains("is-editing")) {
      t.textContent = e.bio || "";
    }
    const i = document.getElementById("stgAvatar");
    if (i) {
      const t = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(e) : e.picture || e.avatar || null;
      const n = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      const o = t && (typeof window.isValidImageUrl !== "function" || window.isValidImageUrl(t));
      if (o) {
        const e = document.createElement("img");
        e.src = t;
        e.alt = "Profile";
        e.decoding = "async";
        e.referrerPolicy = "no-referrer";
        e.onerror = () => {
          i.innerHTML = n;
        };
        i.innerHTML = "";
        i.appendChild(e);
      } else {
        i.innerHTML = n;
      }
    }
    setSubscriptionLoading(true);
    const s = String(e.plan || "free").toLowerCase();
    const a = document.getElementById("stgPlanBanner");
    const r = document.getElementById("stgPlanMeta");
    const l = document.getElementById("stgPlanCompare");
    const c = document.getElementById("stgQuotaGrid");
    const applyPlanBanner = e => {
      if (a) a.setAttribute("data-plan", e);
      const t = e === "free";
      if (r) r.hidden = t;
      if (l) l.hidden = !t;
      if (c) c.hidden = t;
    };
    if ([ "free", "basic", "prime", "elite" ].includes(s)) {
      setText("stgCurrentPlan", s.charAt(0).toUpperCase() + s.slice(1));
      applyPlanBanner(s);
    }
    try {
      const {profile: t, subscription: n, clipsStatus: i, storageInfo: s} = await fetchSecureSettingsData();
      const a = document.getElementById("stgProfileHero")?.classList.contains("is-editing");
      if (t.name) {
        setText("stgName", t.name);
        if (!a && window.currentUser) {
          window.currentUser.name = t.name;
          window.currentUser.displayName = t.name;
        }
      }
      if (typeof t.bio === "string" && !a) {
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
      const r = String(t.plan || "free").toLowerCase();
      const l = [ "free", "basic", "prime", "elite" ];
      const c = l.includes(r) ? r : "free";
      const d = c.charAt(0).toUpperCase() + c.slice(1);
      const u = c === "free";
      setText("stgCurrentPlan", d);
      applyPlanBanner(c);
      if (o) {
        o.classList.toggle("hidden", c === "elite" || u);
      }
      const f = i && typeof i === "object" ? i : {};
      const g = f.storage?.videos || {};
      const p = f.storage?.space_mb || {};
      const m = f.daily || {};
      const w = f.monthly || {};
      const y = f.max_effort || {};
      const h = Math.max(1, Number(g.limit ?? f.plan?.videos_space ?? 2) || 2);
      const b = Math.max(0, Number(g.used ?? 0) || 0);
      setText("stgVideosUsed", b + " / " + h);
      setQuotaFill(document.getElementById("stgVideosFill"), b, h);
      let E = Math.max(0, Number(p.used) || 0) * 1024 * 1024;
      let v = Math.max(1, Number(p.total) || 512) * 1024 * 1024;
      if (Number(f.plan?.storage_gb) > 0 && (!p.total || p.total <= 0)) {
        v = Number(f.plan.storage_gb) * 1024 * 1024 * 1024;
      }
      setText("stgStorage", formatStoragePair(E, v));
      setQuotaFill(document.getElementById("stgStorageFill"), E, v);
      const S = Math.max(0, Number(m.limit ?? f.plan?.videos_per_day ?? 0) || 0);
      const C = Math.max(0, Number(m.used ?? 0) || 0);
      if (S > 0) {
        setText("stgDailyGens", C + " / " + S);
        setQuotaFill(document.getElementById("stgDailyFill"), C, S);
        const e = document.getElementById("stgDailyHint");
        if (e) {
          if (m.resets_at) {
            e.textContent = formatQuotaResetHint(m.resets_at, C >= S ? "Daily quota reached. Resets {when}." : "Resets {when}.");
          }
        }
      } else {
        setText("stgDailyGens", "—");
        setQuotaFill(document.getElementById("stgDailyFill"), 0, 1);
      }
      const I = Math.max(0, Number(w.limit ?? f.plan?.videos_per_month ?? 0) || 0);
      const B = Math.max(0, Number(w.used ?? 0) || 0);
      if (I > 0) {
        setText("stgMonthlyGens", B + " / " + I);
        setQuotaFill(document.getElementById("stgMonthlyFill"), B, I);
        const e = document.getElementById("stgMonthlyHint");
        if (e) {
          e.textContent = formatQuotaResetHint(w.resets_at, B >= I ? "Monthly quota reached. Resets {when}." : "Resets {when}.");
        }
      } else {
        setText("stgMonthlyGens", "—");
        setQuotaFill(document.getElementById("stgMonthlyFill"), 0, 1);
      }
      const x = Number(y.limit ?? 0);
      const M = Number(y.used ?? 0);
      const L = y.remaining;
      if (x > 0) {
        setText("stgMaxEffort", M + " / " + x + " used");
        setQuotaFill(document.getElementById("stgMaxFill"), M, x);
        const e = document.getElementById("stgMaxHint");
        if (e) {
          const t = Math.max(0, Number(L ?? x - M));
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
        plan: c,
        planStatus: t.plan_status || t.subscription_status,
        hasPaddle: !!(t.paddle_subscription_id || n?.paddleSubscriptionId),
        canCancel: n?.canCancel,
        status: n?.status || t.plan_status,
        nextBillingDate: n?.nextBillingDate || t.subscription_end_date || t.plan_expires_at
      });
      window.currentUser = Object.assign({}, window.currentUser || {}, t, {
        active_videos: b,
        video_limit: h
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
    updateYouTubeConnectorUI(!!e.youtube_connected);
  }
  function updateYouTubeConnectorUI(e) {
    const t = document.getElementById("stgYouTubeStatus");
    const n = document.getElementById("stgYouTubeConnectBtn");
    const o = document.getElementById("stgYouTubeConnector");
    if (t) {
      t.textContent = e ? "Connected" : "Not connected";
      t.classList.toggle("is-on", e);
    }
    if (n) {
      n.textContent = e ? "Disconnect" : "Connect";
      n.classList.toggle("is-connected", e);
      n.disabled = false;
    }
    if (o) o.classList.toggle("is-connected", e);
  }
  const w = document.getElementById("stgYouTubeConnectBtn");
  if (w) {
    w.addEventListener("click", () => {
      const e = !!(window.currentUser && window.currentUser.youtube_connected);
      if (e) {
        if (typeof window.disconnectYouTube === "function") window.disconnectYouTube();
      } else if (typeof window.connectYouTube === "function") {
        window.connectYouTube();
      }
    });
  }
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.updateSettingsModal = updateSettingsModal;
  window.switchSettingsPanel = switchSettingsPanel;
  const y = document.getElementById("stgEditHeaderBtn");
  let h = false;
  function setProfileEditing(e) {
    const t = document.getElementById("stgProfileHero");
    const n = document.getElementById("stgName");
    const o = document.getElementById("stgBio");
    const i = document.getElementById("stgNameInput");
    const s = document.getElementById("stgBioInput");
    if (!t || !i || !s || !y) return;
    h = !!e;
    t.classList.toggle("is-editing", h);
    i.hidden = !h;
    s.hidden = !h;
    if (h) {
      i.value = (n?.textContent || "").trim();
      s.value = o?.textContent || "";
      y.classList.add("editing");
      y.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Done</span>';
      requestAnimationFrame(() => {
        i.focus();
        i.select();
      });
    } else {
      y.classList.remove("editing");
      y.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit</span>';
    }
  }
  function toggleProfileEditMode() {
    if (!h) {
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
      const a = s.name || n;
      const r = typeof s.bio === "string" ? s.bio : o;
      setText("stgName", a);
      setText("stgBio", r);
      setProfileEditing(false);
      if (window.currentUser && typeof window.currentUser === "object") {
        window.currentUser.name = a;
        window.currentUser.displayName = a;
        window.currentUser.bio = r;
      }
      try {
        const e = localStorage.getItem("currentUser");
        if (e) {
          const t = JSON.parse(e);
          t.name = a;
          t.bio = r;
          localStorage.setItem("currentUser", JSON.stringify(t));
        }
      } catch (e) {}
      document.querySelectorAll(".user-name, #dropdownUserName, #menuUserName").forEach(e => {
        if (e) e.textContent = a;
      });
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
  const b = document.getElementById("pfpFileInput");
  const E = document.getElementById("stgAvatarContainer");
  const v = document.getElementById("stgCropBackdrop");
  const S = document.getElementById("stgCropModal");
  const C = document.getElementById("stgCropImg");
  const I = document.getElementById("stgCropViewport");
  const B = document.getElementById("stgCropStage");
  const x = document.getElementById("stgCropZoom");
  const M = document.getElementById("stgCropSave");
  let L = false;
  let U = 0;
  const P = 4e3;
  const T = 5 * 1024 * 1024;
  const A = 512;
  const _ = {
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
    if (!I) return 280;
    return Math.max(120, Math.round(I.getBoundingClientRect().width || 280));
  }
  function clampCropOffsets() {
    const e = cropViewportSize();
    const t = _.baseScale * _.zoom;
    const n = _.naturalW * t;
    const o = _.naturalH * t;
    const i = Math.max(0, (n - e) / 2);
    const s = Math.max(0, (o - e) / 2);
    _.offsetX = Math.max(-i, Math.min(i, _.offsetX));
    _.offsetY = Math.max(-s, Math.min(s, _.offsetY));
  }
  function applyCropTransform() {
    if (!C) return;
    clampCropOffsets();
    const e = _.baseScale * _.zoom;
    C.style.width = `${_.naturalW}px`;
    C.style.height = `${_.naturalH}px`;
    C.style.transform = `translate(-50%, -50%) translate(${_.offsetX}px, ${_.offsetY}px) scale(${e})`;
  }
  function closeCropModal() {
    _.open = false;
    _.dragging = false;
    v?.classList.remove("is-open");
    S?.classList.remove("is-open");
    if (v) v.hidden = true;
    if (S) S.hidden = true;
    if (_.objectUrl) {
      URL.revokeObjectURL(_.objectUrl);
      _.objectUrl = null;
    }
    if (C) C.removeAttribute("src");
    if (b) b.value = "";
    if (M) {
      M.disabled = false;
      M.classList.remove("is-busy");
    }
  }
  function openCropModal(e) {
    if (!S || !C || !I) {
      uploadProfilePicture(e);
      return;
    }
    if (_.objectUrl) URL.revokeObjectURL(_.objectUrl);
    const t = URL.createObjectURL(e);
    _.objectUrl = t;
    _.zoom = 1;
    _.offsetX = 0;
    _.offsetY = 0;
    if (x) x.value = "1";
    const onLoad = () => {
      C.removeEventListener("load", onLoad);
      _.naturalW = C.naturalWidth || 0;
      _.naturalH = C.naturalHeight || 0;
      if (_.naturalW < 64 || _.naturalH < 64) {
        closeCropModal();
        if (typeof window.showNotification === "function") {
          window.showNotification("Image too small. Minimum 64x64 pixels.", "error");
        }
        return;
      }
      if (_.naturalW > 5e3 || _.naturalH > 5e3) {
        closeCropModal();
        if (typeof window.showNotification === "function") {
          window.showNotification("Image too large. Maximum 5000x5000 pixels.", "error");
        }
        return;
      }
      const e = cropViewportSize();
      _.baseScale = Math.max(e / _.naturalW, e / _.naturalH);
      _.zoom = 1;
      _.offsetX = 0;
      _.offsetY = 0;
      applyCropTransform();
      _.open = true;
      if (v) {
        v.hidden = false;
        v.classList.add("is-open");
      }
      S.hidden = false;
      S.classList.add("is-open");
      requestAnimationFrame(() => applyCropTransform());
    };
    C.addEventListener("load", onLoad);
    C.src = t;
  }
  async function exportCroppedAvatarFile() {
    const e = cropViewportSize();
    const t = _.baseScale * _.zoom;
    const n = A;
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
    const a = _.naturalW / 2 - _.offsetX / t;
    const r = _.naturalH / 2 - _.offsetY / t;
    const l = a - s / 2;
    const c = r - s / 2;
    i.drawImage(C, l, c, s, s, 0, 0, n, n);
    const d = await new Promise(e => {
      o.toBlob(t => {
        if (t && t.size > 0) e(t); else o.toBlob(t => e(t), "image/jpeg", .9);
      }, "image/webp", .9);
    });
    if (!d || d.size <= 0) throw new Error("Failed to process image");
    if (d.size > T) throw new Error("Image too large. Maximum size is 5MB.");
    const u = d.type === "image/webp" ? "image/webp" : "image/jpeg";
    const f = u === "image/webp" ? "webp" : "jpg";
    return new File([ d ], `avatar.${f}`, {
      type: u,
      lastModified: Date.now()
    });
  }
  function applyAvatarEverywhere(e) {
    if (!e) return;
    const t = e + (e.includes("?") ? "&" : "?") + "t=" + Date.now();
    const setImg = e => {
      if (!e) return;
      let n = e.tagName === "IMG" ? e : e.querySelector("img");
      if (!n) {
        n = document.createElement("img");
        n.alt = "Profile";
        n.decoding = "async";
        n.referrerPolicy = "no-referrer";
        if (e.tagName !== "IMG") {
          e.innerHTML = "";
          e.appendChild(n);
        }
      }
      n.src = t;
    };
    setImg(document.getElementById("stgAvatar"));
    setImg(document.querySelector(".user-avatar"));
    setImg(document.getElementById("profileAvatarBtn"));
    setImg(document.getElementById("dropdownUserAvatar"));
    setImg(document.getElementById("menuUserAvatar"));
  }
  async function uploadProfilePicture(e) {
    if (L || !e) return;
    L = true;
    const t = document.getElementById("stgAvatar");
    try {
      if (t) t.style.opacity = "0.55";
      if (M) {
        M.disabled = true;
        M.classList.add("is-busy");
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
      const a = s.avatar_url || s.pfp_url || "";
      if (!a.startsWith("/api/avatar/")) {
        throw new Error("Server returned an invalid avatar URL");
      }
      applyAvatarEverywhere(a);
      if (window.currentUser && typeof window.currentUser === "object") {
        window.currentUser.picture = a;
        window.currentUser.avatar = a;
      }
      try {
        const e = localStorage.getItem("currentUser");
        if (e) {
          const t = JSON.parse(e);
          t.picture = a;
          t.avatar = a;
          localStorage.setItem("currentUser", JSON.stringify(t));
        }
      } catch (e) {}
      if (window.apiCache) {
        window.apiCache.userProfile = null;
        window.apiCache.userProfileTime = 0;
      }
      U = Date.now();
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
      if (M) {
        M.disabled = false;
        M.classList.remove("is-busy");
      }
    } finally {
      if (t) t.style.opacity = "1";
      L = false;
      if (b) b.value = "";
    }
  }
  async function saveCroppedAvatar() {
    if (!_.open || L) return;
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
    if (!_.open || e.button != null && e.button !== 0) return;
    e.preventDefault();
    _.dragging = true;
    _.lastX = e.clientX;
    _.lastY = e.clientY;
    _.pointerId = e.pointerId;
    B?.setPointerCapture?.(e.pointerId);
  }
  function onCropPointerMove(e) {
    if (!_.dragging) return;
    e.preventDefault();
    const t = e.clientX - _.lastX;
    const n = e.clientY - _.lastY;
    _.lastX = e.clientX;
    _.lastY = e.clientY;
    _.offsetX += t;
    _.offsetY += n;
    applyCropTransform();
  }
  function onCropPointerUp(e) {
    if (!_.dragging) return;
    _.dragging = false;
    try {
      B?.releasePointerCapture?.(e.pointerId);
    } catch (e) {}
  }
  if (B) {
    B.addEventListener("pointerdown", onCropPointerDown);
    B.addEventListener("pointermove", onCropPointerMove);
    B.addEventListener("pointerup", onCropPointerUp);
    B.addEventListener("pointercancel", onCropPointerUp);
    B.addEventListener("wheel", e => {
      if (!_.open) return;
      e.preventDefault();
      const t = e.deltaY > 0 ? -.08 : .08;
      _.zoom = Math.max(1, Math.min(3, _.zoom + t));
      if (x) x.value = String(_.zoom);
      applyCropTransform();
    }, {
      passive: false
    });
  }
  x?.addEventListener("input", () => {
    _.zoom = Math.max(1, Math.min(3, Number(x.value) || 1));
    applyCropTransform();
  });
  document.getElementById("stgCropZoomIn")?.addEventListener("click", () => {
    _.zoom = Math.min(3, _.zoom + .12);
    if (x) x.value = String(_.zoom);
    applyCropTransform();
  });
  document.getElementById("stgCropZoomOut")?.addEventListener("click", () => {
    _.zoom = Math.max(1, _.zoom - .12);
    if (x) x.value = String(_.zoom);
    applyCropTransform();
  });
  document.getElementById("stgCropCancel")?.addEventListener("click", () => closeCropModal());
  document.getElementById("stgCropClose")?.addEventListener("click", () => closeCropModal());
  v?.addEventListener("click", () => closeCropModal());
  S?.addEventListener("click", e => {
    if (e.target === S) closeCropModal();
  });
  M?.addEventListener("click", () => {
    saveCroppedAvatar();
  });
  S?.querySelector(".stgCropCard")?.addEventListener("click", e => e.stopPropagation());
  if (E && b) {
    E.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (L || _.open) return;
      b.click();
    });
  }
  if (b) {
    b.addEventListener("change", async () => {
      const e = b.files && b.files[0];
      if (!e) return;
      const t = Date.now();
      if (t - U < P) {
        if (typeof window.showNotification === "function") {
          window.showNotification("Please wait before uploading another picture", "warning");
        }
        b.value = "";
        return;
      }
      try {
        const t = new Uint8Array(await e.slice(0, 16).arrayBuffer());
        const n = detectImageMime(t);
        if (!n) throw new Error("File is not a valid JPG, PNG, or WebP image");
        if (e.size <= 0 || e.size > T) {
          throw new Error("Image too large. Maximum size is 5MB.");
        }
        openCropModal(e);
      } catch (e) {
        b.value = "";
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
    const a = document.getElementById("stgSessionCreated");
    if (a && (!a.textContent || a.textContent === "—")) {
      a.textContent = fmt(s);
    }
    setText("stgSessionLocation", "…");
    const r = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
      "Content-Type": "application/json"
    };
    const l = typeof window.apiUrl === "function" ? window.apiUrl("/api/user/account/sessions") : "/api/user/account/sessions";
    fetch(l, {
      credentials: "include",
      headers: r
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
    if (!h) return;
    setProfileEditing(false);
  }
  if (y) {
    y.addEventListener("click", e => {
      e.stopPropagation();
      toggleProfileEditMode();
    });
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _.open) {
      e.preventDefault();
      closeCropModal();
      return;
    }
    if (e.key === "Escape" && h) {
      cancelProfileEdit();
      return;
    }
    if (e.key === "Escape" && t?.classList.contains("open")) {
      closeSettingsModal();
    }
  });
});
