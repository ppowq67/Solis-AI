(function() {
  const t = {
    free: "Free Plan",
    basic: "Basic Plan",
    prime: "Prime Plan",
    elite: "Elite Plan"
  };
  const e = {
    auto: "Auto",
    low: "Low",
    normal: "Normal",
    max: "Max"
  };
  const o = "solis_effort_mode";
  const n = "solis_effort_selection";
  const i = "solis_effort_ui_mode";
  const r = "solis_quota_rail_dismiss";
  const a = 6e4;
  const s = [ "low", "normal", "max" ];
  let l = null;
  let c = 0;
  let f = null;
  let d = "low";
  let u = "auto";
  let m = "free";
  let p = false;
  let y = "slider";
  let g = null;
  let h = false;
  function isAutoMode() {
    return u !== "advanced";
  }
  function readEffortSelection() {
    try {
      const t = localStorage.getItem(n);
      if (t === "advanced" || t === "auto") return t;
    } catch (t) {}
    return "auto";
  }
  function persistEffortSelection(t) {
    try {
      localStorage.setItem(n, t === "advanced" ? "advanced" : "auto");
    } catch (t) {}
  }
  let E = 0;
  const w = 380;
  function setEffortSelection(t, {persist: e = true, animate: o = true} = {}) {
    u = t === "advanced" ? "advanced" : "auto";
    if (e) persistEffortSelection(u);
    syncAdvancedModeUI({
      animate: o
    });
    syncEffortUI();
    if (l) syncQuotaRail(l, g);
  }
  function setAdvancedBodyVisible(t, {animate: e = true} = {}) {
    const o = document.getElementById("planEffortAdvancedBody");
    if (!o) return;
    window.clearTimeout(E);
    const n = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const i = e && !n;
    if (t) {
      o.hidden = false;
      o.setAttribute("aria-hidden", "false");
      if (i) {
        o.classList.remove("is-expanded");
        void o.offsetHeight;
        requestAnimationFrame(() => {
          o.classList.add("is-expanded");
        });
      } else {
        o.classList.add("is-expanded");
      }
    } else {
      o.setAttribute("aria-hidden", "true");
      o.classList.remove("is-expanded");
      if (i && !o.hidden) {
        E = window.setTimeout(() => {
          o.hidden = true;
        }, w);
      } else {
        o.hidden = true;
      }
    }
  }
  function syncAdvancedModeUI(t = {}) {
    const e = t.animate !== false;
    const o = isAutoMode();
    const n = document.getElementById("planEffortAdvancedToggle");
    const i = document.getElementById("planEffortModeTitle");
    const r = document.getElementById("planEffortModeHint");
    const a = document.getElementById("planEffortModeRow");
    if (n) {
      n.setAttribute("aria-checked", o ? "true" : "false");
      n.classList.toggle("is-on", o);
      n.setAttribute("aria-label", "Auto Mode");
    }
    setAdvancedBodyVisible(!o, {
      animate: e
    });
    if (i) i.textContent = "Auto";
    if (r) {
      if (o) {
        r.textContent = m === "free" ? "Solis picks the best effort for your video" : "Balanced quality and speed, recommended for most tasks";
        requestAnimationFrame(() => r.classList.remove("is-collapsed"));
      } else {
        r.classList.add("is-collapsed");
      }
    }
    if (a) a.dataset.mode = o ? "auto" : "manual";
    applyEffortUiMode(y, {
      persist: false,
      animate: e
    });
    if (o) closeEffortFlyout();
  }
  function isCacheFresh() {
    return l && Date.now() - c < a;
  }
  function invalidateTierCache() {
    l = null;
    c = 0;
    f = null;
  }
  function formatResetLabel(t) {
    if (!t) return "";
    const e = t.reset_hours ?? 24;
    if (e <= 24) return "";
    const o = Math.round(e / 24);
    return o === 1 ? "Resets every day" : `Resets every ${o} days`;
  }
  function allowedEffortsForTier(t) {
    const e = String(t || "free").toLowerCase();
    if (e === "free") return [ "low" ];
    if (e === "basic") return [ "low", "normal" ];
    if (e === "prime" || e === "elite") return [ "low", "normal", "max" ];
    return [ "low" ];
  }
  function defaultEffortForTier(t) {
    const e = allowedEffortsForTier(t);
    return e.includes("normal") ? "normal" : e[0];
  }
  function readStoredEffort() {
    try {
      const t = localStorage.getItem(o);
      if (t && e[t]) return t;
    } catch (t) {}
    return null;
  }
  function persistEffort(t) {
    try {
      localStorage.setItem(o, t);
    } catch (t) {}
  }
  function readEffortUiMode() {
    try {
      const t = localStorage.getItem(i);
      if (t === "slider" || t === "flyout") return t;
    } catch (t) {}
    return "slider";
  }
  function persistEffortUiMode(t) {
    try {
      localStorage.setItem(i, t === "slider" ? "slider" : "flyout");
    } catch (t) {}
  }
  function effortIndex(t) {
    const e = s.indexOf(t);
    return e >= 0 ? e : 0;
  }
  function effortFromIndex(t) {
    return s[Math.max(0, Math.min(s.length - 1, t))] || "low";
  }
  function isEffortSelectable(t) {
    const e = allowedEffortsForTier(m);
    if (!e.includes(t)) return false;
    if (t === "max") {
      const t = l?.generations || {};
      const e = t.max_effort_per_day ?? 0;
      const o = t.max_effort_remaining;
      if (e > 0 && typeof o === "number" && o <= 0) return false;
    }
    return true;
  }
  function pulseEffortProBadge(t) {
    const e = effortIndex(t);
    const o = document.querySelector(`.plan-effort-slider-pro[data-step="${e}"]`);
    const n = document.querySelector(`.plan-effort-option[data-effort="${t}"] .plan-effort-pro-badge`);
    const i = o && !o.hasAttribute("hidden") ? o : n && !n.hasAttribute("hidden") ? n : null;
    if (!i) return;
    i.classList.remove("is-pulse");
    void i.offsetWidth;
    i.classList.add("is-pulse");
    window.setTimeout(() => i.classList.remove("is-pulse"), 560);
  }
  function notifyEffortLocked(t) {
    if (t === "max") {
      const e = l?.generations || {};
      const o = e.max_effort_per_day ?? 0;
      const n = e.max_effort_remaining;
      if (o > 0 && typeof n === "number" && n <= 0) {
        if (typeof showNotification === "function") {
          showNotification(`Max daily limit reached (${o}/day). Use Normal effort.`, "info");
        }
        return;
      }
      pulseEffortProBadge(t);
      return;
    }
    if (t === "normal") {
      pulseEffortProBadge(t);
    }
  }
  function applyEffortUiMode(t, {persist: e = true, animate: o = true} = {}) {
    const n = t === "slider" ? "slider" : "flyout";
    const i = y !== n || document.documentElement.dataset.effortUi !== n;
    const r = !isAutoMode();
    if (i && n === "slider") closeEffortFlyout();
    y = n;
    document.documentElement.dataset.effortUi = n;
    if (e) persistEffortUiMode(n);
    const a = getEffortTrigger();
    const s = getSliderPanel();
    if (a) {
      a.hidden = !r || n === "slider";
      a.setAttribute("aria-controls", "planEffortFlyout");
      if (!r || n === "slider") a.setAttribute("aria-expanded", "false");
    }
    if (s) {
      if (r && n === "slider") {
        s.hidden = false;
        s.classList.remove("is-ready");
        const reveal = () => {
          s.classList.add("is-ready");
          syncEffortSliderUI();
        };
        if (o && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.setTimeout(reveal, 60);
        } else {
          reveal();
        }
      } else {
        s.classList.remove("is-ready");
        s.hidden = true;
      }
    }
    syncEffortUI();
  }
  function resolveEffortForTier(t) {
    const e = allowedEffortsForTier(t);
    const o = readStoredEffort();
    if (o && e.includes(o)) return o;
    return defaultEffortForTier(t);
  }
  function setEffort(t, {persist: e = true, closeFlyout: o = true, animate: n = false} = {}) {
    if (!isEffortSelectable(t)) return false;
    d = t;
    if (e) persistEffort(t);
    syncEffortUI({
      animate: n
    });
    if (o && y === "flyout") closeEffortFlyout();
    return true;
  }
  function setSliderT(t, {animate: e = false, magnet: o = false} = {}) {
    const n = document.getElementById("planEffortSlider");
    if (!n) return;
    const i = Math.max(0, Math.min(1, t));
    n.style.setProperty("--effort-t", String(i));
    n.classList.toggle("is-max", i >= .98);
    window.clearTimeout(setSliderT._snapTimer);
    n.classList.toggle("is-snapping", e);
    n.classList.toggle("is-magnet", o && !e);
    if (e || o) {
      setSliderT._snapTimer = window.setTimeout(() => {
        n.classList.remove("is-snapping", "is-magnet");
      }, e ? 280 : 200);
    } else {
      n.classList.remove("is-snapping", "is-magnet");
    }
  }
  function clearMaxBits() {
    const t = document.getElementById("planEffortSlider");
    if (!t) return;
    t.classList.remove("is-bits-live");
  }
  function playMaxBitsBurst() {
    const t = document.getElementById("planEffortSlider");
    if (!t) return;
    t.classList.remove("is-bits-live");
    void t.offsetWidth;
    requestAnimationFrame(() => {
      if (d === "max" && !h) {
        t.classList.add("is-bits-live", "is-max");
      }
    });
  }
  function syncMaxBits() {
    if (h) {
      clearMaxBits();
      return;
    }
    if (d === "max") playMaxBitsBurst(); else clearMaxBits();
  }
  function clientXToSliderT(t) {
    const e = document.getElementById("planEffortSliderTrack");
    if (!e) return 0;
    const o = e.getBoundingClientRect();
    const n = 18;
    const i = Math.max(1, o.width - n);
    return Math.max(0, Math.min(1, (t - o.left - n / 2) / i));
  }
  function magnetizeT(t) {
    const e = s.length - 1;
    const o = .16;
    let n = t;
    let i = o;
    let r = false;
    for (let o = 0; o <= e; o += 1) {
      if (!isEffortSelectable(effortFromIndex(o))) continue;
      const a = o / e;
      const s = Math.abs(t - a);
      if (s <= i) {
        i = s;
        n = a;
        r = true;
      }
    }
    return {
      t: n,
      snapped: r,
      index: Math.round(n * e)
    };
  }
  function nearestAllowedIndex(t) {
    const e = s.length - 1;
    let o = null;
    let n = Infinity;
    for (let i = 0; i <= e; i += 1) {
      if (!isEffortSelectable(effortFromIndex(i))) continue;
      const e = Math.abs(i - t);
      if (e < n) {
        n = e;
        o = i;
      }
    }
    return o == null ? 0 : o;
  }
  function syncEffortSliderUI({animate: t = false} = {}) {
    const o = effortIndex(d);
    const n = e[d] || "Low";
    const i = o / (s.length - 1);
    const r = allowedEffortsForTier(m);
    const a = document.getElementById("planEffortSlider");
    const l = document.getElementById("planEffortSliderValue");
    const c = document.getElementById("planEffortSliderPanel");
    if (!h) setSliderT(i, {
      animate: t
    });
    if (l) l.textContent = n;
    if (a) {
      a.setAttribute("aria-valuenow", String(o));
      a.setAttribute("aria-valuetext", n);
      a.classList.toggle("is-single", r.length <= 1);
      a.classList.toggle("is-max", d === "max");
    }
    if (!h) {
      if (d === "max") {
        if (!a?.classList.contains("is-bits-live")) playMaxBitsBurst();
      } else {
        clearMaxBits();
      }
    } else {
      clearMaxBits();
    }
    if (c) {
      c.querySelectorAll(".plan-effort-slider-dot").forEach(t => {
        const e = Number(t.dataset.step || 0);
        const n = effortFromIndex(e);
        const l = h ? Math.round((Number(a?.style.getPropertyValue("--effort-t")) || i) * (s.length - 1)) : o;
        t.classList.toggle("is-passed", e <= l);
        t.classList.toggle("is-locked", !r.includes(n));
      });
      c.querySelectorAll(".plan-effort-slider-pro").forEach(t => {
        const e = Number(t.dataset.step || 0);
        const o = effortFromIndex(e);
        if (!r.includes(o)) t.removeAttribute("hidden"); else t.setAttribute("hidden", "");
      });
    }
  }
  function isCompactPlanUi() {
    try {
      return window.matchMedia("(max-width: 768px)").matches;
    } catch (t) {
      return window.innerWidth <= 768;
    }
  }
  function syncEffortUI(t) {
    const o = isAutoMode() ? "auto" : d;
    const n = e[o] || "Auto";
    const i = document.getElementById("planSelectorLabel");
    if (i) {
      i.removeAttribute("hidden");
      if (!i.textContent.trim()) {
        const t = (m || "free").charAt(0).toUpperCase() + (m || "free").slice(1);
        i.textContent = `${t} Plan`;
      }
    }
    const r = document.getElementById("planSelectorWrap");
    if (r) {
      r.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      r.dataset.effort = o;
    }
    const a = getPopover();
    if (a) {
      a.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      a.dataset.effort = o;
    }
    const s = document.getElementById("planSelectorEffort");
    if (s) {
      s.textContent = n;
      s.dataset.effort = o;
    }
    const c = document.getElementById("planSelectorBtn");
    if (c) {
      const t = i?.textContent?.trim() || "Plan";
      const e = isCompactPlanUi();
      c.setAttribute("aria-label", e ? `${n}. ${t} usage` : `${t}, ${n}`);
    }
    const f = document.getElementById("planEffortTriggerValue");
    if (f) f.textContent = e[d] || "Low";
    if (!isAutoMode()) {
      syncEffortSliderUI(t);
    }
    const u = document.getElementById("planEffortFlyout");
    if (!u) return;
    const p = allowedEffortsForTier(m);
    u.querySelectorAll(".plan-effort-option").forEach(t => {
      const e = t.dataset.effort;
      const o = p.includes(e);
      const n = e === d;
      const i = t.querySelector(".plan-effort-pro-badge");
      const r = t.querySelector(".plan-effort-option-hint");
      t.classList.toggle("is-locked", !o);
      t.classList.toggle("is-active", n);
      t.setAttribute("aria-checked", n ? "true" : "false");
      if (i) {
        if (!o) i.removeAttribute("hidden"); else i.setAttribute("hidden", "");
      }
      if (r) {
        r.hidden = !o;
      }
      if (o && e === "max") {
        const e = l?.generations || {};
        const o = e.max_effort_per_day ?? 0;
        const n = e.max_effort_remaining;
        if (o > 0 && typeof n === "number") {
          t.title = `Max — ${n}/${o} left today`;
          if (n <= 0) {
            t.classList.add("is-locked");
            t.title = `Max daily limit reached (${o}/day)`;
          }
        } else {
          t.title = "Max — best interesting moments + cleaner cuts";
        }
      } else {
        t.title = o ? e === "normal" ? "Normal — balanced speed and quality" : "Low — fast, smart picks, low compute" : e === "max" ? "Max effort requires Prime or Elite" : e === "normal" ? "Normal effort requires Basic or higher" : "Locked on your plan";
      }
    });
  }
  function getFlyout() {
    return document.getElementById("planEffortFlyout");
  }
  function getSliderPanel() {
    return document.getElementById("planEffortSliderPanel");
  }
  function getEffortTrigger() {
    return document.getElementById("planEffortTrigger");
  }
  function positionEffortFlyoutSide() {
    const t = getPopover();
    if (!t) return;
    const e = t.getBoundingClientRect();
    const o = 176;
    const n = window.innerWidth - e.right;
    const i = n < o + 16 && e.left > o + 16;
    t.classList.toggle("effort-open-left", i);
  }
  function openEffortFlyout() {
    if (y === "slider") return;
    const t = getPopover();
    const e = getFlyout();
    const o = getEffortTrigger();
    if (!t || !e || !o) return;
    p = true;
    e.hidden = false;
    positionEffortFlyoutSide();
    requestAnimationFrame(() => {
      t.classList.add("effort-open");
      e.classList.add("is-open");
    });
    o.setAttribute("aria-expanded", "true");
    syncEffortUI();
  }
  function closeEffortFlyout() {
    const t = getPopover();
    const e = getFlyout();
    const o = getEffortTrigger();
    if (!t || !e) return;
    p = false;
    t.classList.remove("effort-open", "effort-open-left");
    e.classList.remove("is-open");
    if (o) o.setAttribute("aria-expanded", "false");
    const finish = () => {
      if (!p) e.hidden = true;
      e.removeEventListener("transitionend", finish);
    };
    e.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function toggleEffortControl() {
    if (y === "slider") return;
    if (p) closeEffortFlyout(); else openEffortFlyout();
  }
  function trySelectEffortFromSlider(t, {animate: e = true} = {}) {
    const o = effortFromIndex(t);
    const n = nearestAllowedIndex(t);
    const i = effortFromIndex(n);
    if (o !== i) notifyEffortLocked(o);
    return setEffort(i, {
      closeFlyout: false,
      animate: e
    });
  }
  function bindEffortSliderInteractions() {
    const t = document.getElementById("planEffortSlider");
    if (!t || t.dataset.bound === "true") return;
    t.dataset.bound = "true";
    const o = document.getElementById("planEffortSliderValue");
    let n = null;
    let i = null;
    const previewFromT = n => {
      const r = magnetizeT(n);
      const a = r.snapped;
      const l = r.t;
      const c = r.index;
      clearMaxBits();
      if (a && i !== c) {
        setSliderT(l, {
          magnet: true
        });
      } else if (a) {
        setSliderT(l, {
          animate: false
        });
      } else {
        i = null;
        setSliderT(n, {
          animate: false
        });
      }
      if (a) i = c;
      const f = e[effortFromIndex(c)] || "Low";
      if (o) o.textContent = f;
      t.classList.toggle("is-max", c === s.length - 1 && isEffortSelectable("max"));
      const d = document.getElementById("planEffortSliderPanel");
      d?.querySelectorAll(".plan-effort-slider-dot").forEach(t => {
        const e = Number(t.dataset.step || 0);
        t.classList.toggle("is-passed", e <= c);
        t.classList.toggle("is-magnet-hot", a && e === c);
      });
    };
    const finishDrag = e => {
      const o = magnetizeT(clientXToSliderT(e));
      h = false;
      i = null;
      t.classList.remove("is-dragging");
      t.querySelectorAll(".plan-effort-slider-dot").forEach(t => {
        t.classList.remove("is-magnet-hot");
      });
      trySelectEffortFromSlider(o.index, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, g);
    };
    t.addEventListener("pointerdown", e => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      n = e.pointerId;
      h = true;
      i = null;
      clearMaxBits();
      t.classList.add("is-dragging");
      t.classList.remove("is-snapping", "is-magnet");
      try {
        t.setPointerCapture(e.pointerId);
      } catch (t) {}
      previewFromT(clientXToSliderT(e.clientX));
      t.focus({
        preventScroll: true
      });
    });
    t.addEventListener("pointermove", t => {
      if (!h || t.pointerId !== n) return;
      t.preventDefault();
      previewFromT(clientXToSliderT(t.clientX));
    });
    const endPointer = e => {
      if (!h || n != null && e.pointerId !== n) return;
      e.preventDefault();
      e.stopPropagation();
      const o = e.clientX;
      n = null;
      try {
        t.releasePointerCapture(e.pointerId);
      } catch (t) {}
      finishDrag(o);
    };
    t.addEventListener("pointerup", endPointer);
    t.addEventListener("pointercancel", endPointer);
    t.addEventListener("keydown", t => {
      const e = effortIndex(d);
      let o = e;
      if (t.key === "ArrowRight" || t.key === "ArrowUp") o = e + 1; else if (t.key === "ArrowLeft" || t.key === "ArrowDown") o = e - 1; else if (t.key === "Home") o = 0; else if (t.key === "End") o = s.length - 1; else return;
      t.preventDefault();
      trySelectEffortFromSlider(o, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, g);
    });
  }
  async function fetchTierInfo(t = false) {
    if (!t && isCacheFresh()) return l;
    if (!t && f) return f;
    f = (async () => {
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/tier/info") : `${window.API_BASE_URL || "https://api.solisai.video/api"}/tier/info`;
      const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const o = await fetch(t, {
        method: "GET",
        credentials: "include",
        headers: e
      });
      if (!o.ok) throw new Error(`tier/info ${o.status}`);
      const n = await o.json();
      if (!n?.data) throw new Error("Invalid tier response");
      l = n.data;
      c = Date.now();
      const i = l.library || l.saved_videos;
      if (i && typeof window.applyStorageBadgeUI === "function") {
        const t = (l.tier || "free").toLowerCase();
        const e = i.unlimited === true || typeof window.isUnlimitedLibrary === "function" && window.isUnlimitedLibrary(null, t);
        window.applyStorageBadgeUI({
          used: i.used ?? 0,
          limit: e ? null : i.limit ?? i.max_videos ?? 5,
          plan: t,
          unlimited: e
        });
      }
      return l;
    })().finally(() => {
      f = null;
    });
    return f;
  }
  function readDismissedKind() {
    try {
      return sessionStorage.getItem(r) || "";
    } catch (t) {
      return "";
    }
  }
  function dismissQuotaKind(t) {
    try {
      sessionStorage.setItem(r, t || "");
    } catch (t) {}
  }
  function clearQuotaDismiss() {
    try {
      sessionStorage.removeItem(r);
    } catch (t) {}
  }
  function parseQuotaResetWhen(t) {
    if (t == null || t === "") return null;
    if (t instanceof Date) {
      return Number.isNaN(t.getTime()) ? null : t;
    }
    const e = String(t).trim();
    if (!e) return null;
    const o = /[zZ]|[+-]\d{2}:?\d{2}$/.test(e);
    const n = o ? e : `${e.replace(" ", "T")}Z`;
    const i = new Date(n);
    return Number.isNaN(i.getTime()) ? null : i;
  }
  function formatQuotaUnlockWhen(t) {
    const e = parseQuotaResetWhen(t);
    if (!e) return "";
    const o = new Date;
    const n = e.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const i = e.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    const r = new Date(o.getFullYear(), o.getMonth(), o.getDate());
    const a = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const s = Math.round((a - r) / 864e5);
    if (s === 0) return `today at ${n}`;
    if (s === 1) return `tomorrow at ${n}`;
    return `${i} at ${n}`;
  }
  function nextLocalMidnightLabel() {
    const t = new Date;
    const e = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0, 0);
    return formatQuotaUnlockWhen(e);
  }
  function parseQuotaState(t, e) {
    const o = Math.max(0, Number(t?.daily?.remaining ?? e?.remaining ?? 0));
    const n = Math.max(0, Number(t?.daily?.limit ?? e?.max_per_period ?? e?.max_per_day ?? 0));
    const i = Math.max(0, Number(t?.monthly?.remaining ?? e?.remaining_month ?? 0));
    const r = Math.max(0, Number(t?.monthly?.limit ?? e?.max_per_month ?? 0));
    const a = r > 0 && i <= 0;
    const s = n > 0 && o <= 0 || t?.daily_limit_reached === true || t?.block_reason === "daily_limit";
    let l = o;
    if (a) {
      l = 0;
    } else if (s) {
      l = i;
    } else if (r > 0) {
      l = Math.min(o, i);
    }
    const c = r > 0 && i <= o ? "monthly" : "daily";
    return {
      dailyRem: o,
      dailyMax: n,
      monthlyRem: i,
      monthlyMax: r,
      monthlyEmpty: a,
      dailyEmpty: s,
      headlineRem: l,
      binding: c,
      canRunNow: !a && !s
    };
  }
  function formatQuotaChipDisplay(t, e, o, n) {
    const i = String(n || "free").toLowerCase();
    const r = t.monthlyMax > 0 ? t.monthlyMax : Math.max(1, Number(o?.max_per_month ?? o?.max_per_day ?? 1));
    const a = Math.max(0, Number(t.monthlyRem));
    const s = i === "free";
    const l = `<span class="plan-count-remaining">${a}</span>` + `<span class="plan-count-sep"> / ${r}</span>`;
    const c = r > 0 ? Math.min(100, (r - a) / r * 100) : 0;
    if (t.monthlyEmpty) {
      return {
        countHtml: '<span class="plan-count-remaining">0</span>' + `<span class="plan-count-sep"> / ${r}</span>`,
        kicker: "uploads left",
        progressPct: 100,
        resetLine: "Resets with your plan renewal"
      };
    }
    let f = "";
    if (t.dailyEmpty && a > 0) {
      const t = e?.daily?.resets_at || o?.daily_resets_at || o?.resets_at;
      const n = formatQuotaUnlockWhen(t) || nextLocalMidnightLabel();
      f = n ? `Next upload unlocks ${n}` : "Next upload unlocks tomorrow";
    }
    if (s && !t.dailyEmpty) {
      const e = Math.min(t.dailyRem, a);
      return {
        countHtml: l,
        kicker: e === 1 ? "1 available today" : `${e} available today`,
        progressPct: c,
        resetLine: f
      };
    }
    return {
      countHtml: l,
      kicker: "uploads left",
      progressPct: c,
      resetLine: f
    };
  }
  function syncUpgradeCardVisibility(t) {
    const e = document.getElementById("upgradeCardCreate");
    if (!e) return;
    const o = String(t?.tier || t?.plan || window.currentUser?.plan || "free").toLowerCase();
    const n = t?.generations || {};
    const i = Math.max(0, Number(n.used_lifetime ?? n.used_today ?? 0));
    const r = [ "basic", "prime", "elite" ].includes(o);
    const a = i < 1;
    const s = !r && !a;
    e.hidden = !s;
    e.setAttribute("aria-hidden", s ? "false" : "true");
    e.style.display = s ? "" : "none";
  }
  window.solisQuotaDisplay = {
    parseState: parseQuotaState,
    formatChip: formatQuotaChipDisplay,
    formatUnlockWhen: formatQuotaUnlockWhen,
    syncUpgradeCard: syncUpgradeCardVisibility
  };
  function syncQuotaRail(t, e) {
    const o = document.getElementById("urlQuotaRail");
    const n = document.getElementById("urlQuotaBanner");
    const i = document.getElementById("urlQuotaTitle");
    const r = document.getElementById("urlQuotaSub");
    const a = document.getElementById("urlInputStack");
    if (!o || !n || !i || !r) return;
    const s = t?.generations || {};
    const l = parseQuotaState(e, s);
    const {dailyRem: c, dailyMax: f, monthlyRem: u, monthlyMax: p, monthlyEmpty: y, dailyEmpty: g, binding: h} = l;
    const E = Math.max(0, Number(e?.max_effort?.limit ?? s.max_effort_per_day ?? 0));
    const w = e?.max_effort?.remaining ?? s.max_effort_remaining;
    const v = Math.max(0, Number(w ?? 0));
    const x = e?.max_effort?.can_use ?? s.can_use_max_effort;
    const S = E > 0 && (v <= 0 || x === false);
    const L = !g && !y && f >= 3 && c > 0 && h === "daily" && (c <= 1 || c / f <= .2);
    const I = !y && !g && p > 0 && h === "monthly" && (u <= 2 || u / p <= .15);
    const M = E >= 3 && !S && v === 1;
    let b = "";
    let B = "";
    let P = "";
    if (y) {
      b = "monthly";
      B = "Monthly limit reached";
      const t = formatQuotaUnlockWhen(e?.monthly?.resets_at || s.monthly_resets_at);
      P = t ? `New uploads unlock ${t}.` : "New uploads unlock when your plan renews.";
    } else if (g) {
      b = "daily";
      const t = e?.daily?.resets_at || s.daily_resets_at || s.resets_at;
      const o = formatQuotaUnlockWhen(t) || nextLocalMidnightLabel();
      if (u > 0) {
        B = m === "free" ? "Used your free upload" : "Used today's uploads";
        P = o ? `Next upload unlocks ${o}.` : "Next upload unlocks tomorrow.";
      } else {
        B = m === "free" ? "Free upload used" : "Daily limit reached";
        P = o ? `Next upload unlocks ${o}.` : "Upgrade for more daily uploads.";
      }
    } else if (I) {
      b = "monthly-low";
      B = u === 1 ? "One upload left" : `${u} uploads left`;
      P = "Upgrade if you need more room this month.";
    } else if (L) {
      b = "daily-low";
      B = c === 1 ? "One upload left today" : `${c} uploads left today`;
      P = "Upgrade if you need more room today.";
    } else if (S) {
      b = "max-empty";
      B = "Max effort used up for today";
      const t = e?.max_effort?.resets_at || s.max_effort_resets_at;
      const o = formatQuotaUnlockWhen(t);
      P = o ? `Max effort unlocks again ${o}. You can still generate with Normal or Low.` : "You can still generate with Normal or Low.";
      if (readDismissedKind() === "max" || readDismissedKind() === "max-low") {
        clearQuotaDismiss();
      }
      if (d === "max") {
        const t = allowedEffortsForTier(m).includes("normal") ? "normal" : "low";
        setEffort(t, {
          persist: true,
          closeFlyout: false
        });
      }
    } else if (M) {
      b = "max-low";
      B = "One Max effort left today";
      P = "After this, Solis falls back to Normal so you can keep creating.";
    } else {
      o.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    if (readDismissedKind() === b) {
      o.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    n.dataset.kind = b;
    i.textContent = B;
    r.textContent = P;
    o.hidden = false;
    if (a) a.classList.add("has-quota");
  }
  async function enrichQuotaFromStatus() {
    try {
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/clips/status") : `${window.API_BASE_URL || "/api"}/clips/status`;
      const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const o = await fetch(t, {
        method: "GET",
        credentials: "include",
        headers: e
      });
      if (!o.ok) return null;
      g = await o.json();
      return g;
    } catch (t) {
      return null;
    }
  }
  function applyTierToUI(t) {
    const e = document.getElementById("planSelectorWrap");
    const o = document.getElementById("planSelectorLabel");
    const n = document.getElementById("planPopoverTier");
    const i = document.getElementById("planPopoverCount");
    const r = document.getElementById("planPopoverProgress");
    const a = document.getElementById("planPopoverReset");
    const s = document.getElementById("planPopoverUpgrade");
    if (!e || !o) return;
    const l = (t?.tier || "free").toLowerCase();
    const c = t?.tier_name || l.charAt(0).toUpperCase() + l.slice(1);
    const f = `${c} Plan`;
    m = l;
    d = resolveEffortForTier(l);
    if (!u) u = readEffortSelection();
    e.dataset.tier = l;
    e.dataset.effort = isAutoMode() ? "auto" : d;
    e.dataset.effortSelection = u;
    const p = getPopover();
    if (p) {
      p.dataset.tier = l;
      p.dataset.effort = isAutoMode() ? "auto" : d;
      p.dataset.effortSelection = u;
    }
    o.textContent = f;
    if (n) n.textContent = f;
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(t, g);
    const y = t?.generations;
    const h = document.getElementById("planPopoverKicker");
    if (y && i) {
      const t = formatQuotaChipDisplay(parseQuotaState(g, y), g, y, l);
      i.innerHTML = t.countHtml;
      if (h) h.textContent = t.kicker || "uploads left";
      if (r) {
        r.style.width = `${Math.min(100, t.progressPct || 0)}%`;
      }
      if (a) {
        const e = t.resetLine || formatResetLabel(y);
        a.textContent = e;
        a.hidden = !e;
      }
    } else if (i) {
      i.textContent = "—";
      if (h) h.textContent = "uploads left";
      if (r) r.style.width = "0%";
      if (a) {
        a.textContent = "";
        a.hidden = true;
      }
    }
    if (s) {
      const t = Math.max(0, Number(y?.used_lifetime ?? y?.used_today ?? 0));
      const e = [ "basic", "prime", "elite" ].includes(l);
      const o = l === "free" && t < 1;
      s.classList.toggle("hidden", e || o);
    }
    syncUpgradeCardVisibility(t);
    clearLoadingState();
  }
  function setLoadingState(t = true) {
    const e = document.getElementById("planSelectorWrap");
    const o = document.getElementById("planSelectorBtn");
    const n = getPopover();
    if (e) e.classList.toggle("is-loading", !!t);
    if (n) n.classList.toggle("is-loading", !!t);
    if (o) o.setAttribute("aria-busy", t ? "true" : "false");
  }
  function clearLoadingState() {
    setLoadingState(false);
  }
  function getInputContainer() {
    return document.querySelector(".url-input-container");
  }
  let v = null;
  let x = null;
  function getPopover() {
    return document.getElementById("planSelectorPopover");
  }
  function mountPopover() {
    const t = document.getElementById("planSelectorWrap");
    const e = getPopover();
    if (!t || !e || e.parentElement === document.body) return;
    x = t;
    document.body.appendChild(e);
  }
  function unmountPopover() {
    const t = getPopover();
    if (!t || !x || t.parentElement !== document.body) return;
    x.appendChild(t);
    x = null;
  }
  function positionPopover() {
    const t = document.getElementById("planSelectorBtn");
    const e = getPopover();
    if (!t || !e || e.hidden) return;
    const o = t.getBoundingClientRect();
    const n = isCompactPlanUi();
    const i = n ? 10 : 12;
    const r = n ? Math.min(360, window.innerWidth - i * 2) : Math.min(268, window.innerWidth - 48);
    const a = r;
    let s;
    if (n) {
      s = Math.max(i, Math.round((window.innerWidth - a) / 2));
    } else {
      s = Math.max(i, o.right - a);
      s = Math.min(s, window.innerWidth - a - i);
    }
    let l = o.bottom + (n ? 12 : 10);
    const c = e.offsetHeight || (n ? 320 : 260);
    if (l + c > window.innerHeight - i) {
      l = Math.max(i, o.top - c - 10);
    }
    e.style.top = `${l}px`;
    e.style.left = `${s}px`;
    e.style.width = `${a}px`;
    e.style.right = "auto";
    if (p && !n) positionEffortFlyoutSide();
  }
  function bindReposition() {
    if (v) return;
    let t = isCompactPlanUi();
    v = () => {
      positionPopover();
      const e = isCompactPlanUi();
      if (e !== t) {
        t = e;
        syncEffortUI({
          animate: false
        });
      }
    };
    window.addEventListener("resize", v);
    window.addEventListener("scroll", v, true);
  }
  function unbindReposition() {
    if (!v) return;
    window.removeEventListener("resize", v);
    window.removeEventListener("scroll", v, true);
    v = null;
  }
  function openPopover() {
    const t = document.getElementById("planSelectorWrap");
    const e = document.getElementById("planSelectorBtn");
    const o = getPopover();
    const n = getInputContainer();
    if (!t || !e || !o) return;
    mountPopover();
    o.hidden = false;
    e.setAttribute("aria-expanded", "true");
    positionPopover();
    requestAnimationFrame(() => {
      t.classList.add("is-open");
      o.classList.add("is-open");
      if (n) n.classList.add("is-open");
      positionPopover();
    });
    bindReposition();
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    if (l) {
      applyTierToUI(l);
    } else {
      setLoadingState(true);
    }
    if (!isCacheFresh()) {
      fetchTierInfo(false).then(applyTierToUI).catch(() => {
        if (l) return;
        const t = document.getElementById("planPopoverReset");
        const e = document.getElementById("planPopoverCount");
        if (e) e.textContent = "—";
        if (t) t.textContent = "Could not load usage";
      });
    }
  }
  function closePopover(t = {}) {
    const e = Boolean(t.immediate);
    const o = document.getElementById("planSelectorWrap");
    const n = document.getElementById("planSelectorBtn");
    const i = getPopover();
    const r = getInputContainer();
    if (!o || !n || !i) return;
    if (i.hidden && !o.classList.contains("is-open") && !i.classList.contains("is-open")) {
      return;
    }
    closeEffortFlyout();
    o.classList.remove("is-open");
    i.classList.remove("is-open");
    if (r) r.classList.remove("is-open");
    n.setAttribute("aria-expanded", "false");
    unbindReposition();
    const finish = () => {
      if (!o.classList.contains("is-open")) {
        i.hidden = true;
        i.style.top = "";
        i.style.left = "";
        i.style.width = "";
        unmountPopover();
      }
      i.removeEventListener("transitionend", finish);
    };
    if (e) {
      finish();
      return;
    }
    i.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function togglePopover() {
    const t = document.getElementById("planSelectorWrap");
    if (!t) return;
    if (t.classList.contains("is-open")) closePopover(); else openPopover();
  }
  function onPopoverClick(t) {
    const e = t.target.closest("#planEffortAdvancedToggle");
    if (e) {
      t.preventDefault();
      t.stopPropagation();
      setEffortSelection(isAutoMode() ? "advanced" : "auto");
      return;
    }
    if (t.target.closest("#planEffortSlider") || t.target.closest("#planEffortSliderPanel")) {
      t.stopPropagation();
      return;
    }
    const o = t.target.closest("#planEffortTrigger");
    if (o) {
      t.preventDefault();
      t.stopPropagation();
      if (isAutoMode()) setEffortSelection("advanced");
      toggleEffortControl();
      return;
    }
    const n = t.target.closest(".plan-effort-option");
    if (!n) return;
    t.preventDefault();
    t.stopPropagation();
    const i = n.dataset.effort;
    if (!isEffortSelectable(i)) {
      notifyEffortLocked(i);
      return;
    }
    setEffort(i, {
      animate: false
    });
    if (l) syncQuotaRail(l, g);
  }
  function initPlanSelector() {
    const t = document.getElementById("planSelectorWrap");
    const e = document.getElementById("planSelectorBtn");
    if (!t || !e) return;
    u = readEffortSelection();
    d = resolveEffortForTier(m);
    applyEffortUiMode(readEffortUiMode(), {
      persist: false,
      animate: false
    });
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(l, g);
    bindEffortSliderInteractions();
    try {
      const t = window.matchMedia("(max-width: 768px)");
      const onMq = () => syncEffortUI({
        animate: false
      });
      if (t.addEventListener) t.addEventListener("change", onMq); else if (t.addListener) t.addListener(onMq);
    } catch (t) {}
    const o = document.getElementById("urlQuotaClose");
    if (o && !o.dataset.bound) {
      o.dataset.bound = "true";
      o.addEventListener("click", t => {
        t.preventDefault();
        t.stopPropagation();
        const e = document.getElementById("urlQuotaBanner");
        const o = e?.dataset?.kind || "";
        dismissQuotaKind(o);
        const n = document.getElementById("urlQuotaRail");
        const i = document.getElementById("urlInputStack");
        if (n) n.hidden = true;
        if (i) i.classList.remove("has-quota");
      });
    }
    e.addEventListener("click", t => {
      t.preventDefault();
      t.stopPropagation();
      togglePopover();
    });
    const n = getPopover();
    if (n) {
      n.addEventListener("click", onPopoverClick);
    }
    document.addEventListener("click", e => {
      const o = getPopover();
      if (t.contains(e.target) || o?.contains(e.target)) return;
      closePopover();
    });
    document.addEventListener("keydown", t => {
      if (t.key !== "Escape") return;
      if (p) {
        closeEffortFlyout();
        return;
      }
      closePopover();
    });
    fetchTierInfo().then(async t => {
      await enrichQuotaFromStatus();
      applyTierToUI(t);
    }).catch(() => {
      t.dataset.tier = "free";
      m = "free";
      d = "low";
      const e = document.getElementById("planSelectorLabel");
      if (e) e.textContent = "Free Plan";
      syncEffortUI();
      clearLoadingState();
    });
  }
  window.refreshPlanSelector = function refreshPlanSelector() {
    invalidateTierCache();
    setLoadingState(true);
    return Promise.all([ fetchTierInfo(true), enrichQuotaFromStatus() ]).then(([t]) => {
      applyTierToUI(t);
      return t;
    }).catch(() => {
      clearLoadingState();
    });
  };
  window.updateUrlQuotaRail = function updateUrlQuotaRail(t) {
    if (t) g = t;
    if (l) syncQuotaRail(l, g);
  };
  window.closePlanSelectorPopover = function closePlanSelectorPopover(t = true) {
    closePopover({
      immediate: Boolean(t)
    });
  };
  window.getSelectedEffortMode = function getSelectedEffortMode() {
    return isAutoMode() ? "auto" : d;
  };
  window.isEffortAutoMode = function isEffortAutoMode() {
    return isAutoMode();
  };
  window.setEffortAutoMode = function setEffortAutoMode(t) {
    setEffortSelection(t ? "auto" : "advanced");
    return isAutoMode();
  };
  window.setSelectedEffortMode = function setSelectedEffortMode(t) {
    if (t === "auto") {
      setEffortSelection("auto");
      return true;
    }
    if (isAutoMode()) setEffortSelection("advanced");
    const e = setEffort(t);
    if (l) syncQuotaRail(l, g);
    return e;
  };
  window.getEffortUiMode = function getEffortUiMode() {
    return y;
  };
  window.setEffortUiMode = function setEffortUiMode(t) {
    applyEffortUiMode(t);
    return y;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPlanSelector();
      enrichQuotaFromStatus().then(() => {
        if (l) syncQuotaRail(l, g);
      });
    });
  } else {
    initPlanSelector();
    enrichQuotaFromStatus().then(() => {
      if (l) syncQuotaRail(l, g);
    });
  }
})();
