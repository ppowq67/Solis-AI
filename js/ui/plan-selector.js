(function() {
  const e = {
    free: "Free Plan",
    basic: "Basic Plan",
    prime: "Prime Plan",
    elite: "Elite Plan"
  };
  const t = {
    auto: "Auto",
    low: "Low",
    normal: "Normal",
    max: "Max"
  };
  const n = "solis_effort_mode";
  const o = "solis_effort_selection";
  const r = "solis_effort_ui_mode";
  const i = "solis_quota_rail_dismiss";
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
      const e = localStorage.getItem(o);
      if (e === "advanced" || e === "auto") return e;
    } catch (e) {}
    return "auto";
  }
  function persistEffortSelection(e) {
    try {
      localStorage.setItem(o, e === "advanced" ? "advanced" : "auto");
    } catch (e) {}
  }
  let E = 0;
  const w = 380;
  function setEffortSelection(e, {persist: t = true, animate: n = true} = {}) {
    u = e === "advanced" ? "advanced" : "auto";
    if (t) persistEffortSelection(u);
    syncAdvancedModeUI({
      animate: n
    });
    syncEffortUI();
    if (l) syncQuotaRail(l, g);
  }
  function setAdvancedBodyVisible(e, {animate: t = true} = {}) {
    const n = document.getElementById("planEffortAdvancedBody");
    if (!n) return;
    window.clearTimeout(E);
    const o = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = t && !o;
    if (e) {
      n.hidden = false;
      n.setAttribute("aria-hidden", "false");
      if (r) {
        n.classList.remove("is-expanded");
        void n.offsetHeight;
        requestAnimationFrame(() => {
          n.classList.add("is-expanded");
        });
      } else {
        n.classList.add("is-expanded");
      }
    } else {
      n.setAttribute("aria-hidden", "true");
      n.classList.remove("is-expanded");
      if (r && !n.hidden) {
        E = window.setTimeout(() => {
          n.hidden = true;
        }, w);
      } else {
        n.hidden = true;
      }
    }
  }
  function syncAdvancedModeUI(e = {}) {
    const t = e.animate !== false;
    const n = isAutoMode();
    const o = document.getElementById("planEffortAdvancedToggle");
    const r = document.getElementById("planEffortModeTitle");
    const i = document.getElementById("planEffortModeHint");
    const a = document.getElementById("planEffortModeRow");
    if (o) {
      o.setAttribute("aria-checked", n ? "true" : "false");
      o.classList.toggle("is-on", n);
      o.setAttribute("aria-label", "Auto Mode");
    }
    setAdvancedBodyVisible(!n, {
      animate: t
    });
    if (r) r.textContent = "Auto";
    if (i) {
      if (n) {
        i.textContent = m === "free" ? "Solis picks the best effort for your video" : "Balanced quality and speed, recommended for most tasks";
        requestAnimationFrame(() => i.classList.remove("is-collapsed"));
      } else {
        i.classList.add("is-collapsed");
      }
    }
    if (a) a.dataset.mode = n ? "auto" : "manual";
    applyEffortUiMode(y, {
      persist: false,
      animate: t
    });
    if (n) closeEffortFlyout();
  }
  function isCacheFresh() {
    return l && Date.now() - c < a;
  }
  function invalidateTierCache() {
    l = null;
    c = 0;
    f = null;
  }
  function formatResetLabel(e) {
    if (!e) return "";
    const t = e.reset_hours ?? 24;
    if (t <= 24) return "";
    const n = Math.round(t / 24);
    return n === 1 ? "Resets every day" : `Resets every ${n} days`;
  }
  function allowedEffortsForTier(e) {
    const t = String(e || "free").toLowerCase();
    if (t === "free") return [ "low" ];
    if (t === "basic") return [ "low", "normal" ];
    if (t === "prime" || t === "elite") return [ "low", "normal", "max" ];
    return [ "low" ];
  }
  function defaultEffortForTier(e) {
    const t = allowedEffortsForTier(e);
    return t.includes("normal") ? "normal" : t[0];
  }
  function readStoredEffort() {
    try {
      const e = localStorage.getItem(n);
      if (e && t[e]) return e;
    } catch (e) {}
    return null;
  }
  function persistEffort(e) {
    try {
      localStorage.setItem(n, e);
    } catch (e) {}
  }
  function readEffortUiMode() {
    try {
      const e = localStorage.getItem(r);
      if (e === "slider" || e === "flyout") return e;
    } catch (e) {}
    return "slider";
  }
  function persistEffortUiMode(e) {
    try {
      localStorage.setItem(r, e === "slider" ? "slider" : "flyout");
    } catch (e) {}
  }
  function effortIndex(e) {
    const t = s.indexOf(e);
    return t >= 0 ? t : 0;
  }
  function effortFromIndex(e) {
    return s[Math.max(0, Math.min(s.length - 1, e))] || "low";
  }
  function isEffortSelectable(e) {
    const t = allowedEffortsForTier(m);
    if (!t.includes(e)) return false;
    if (e === "max") {
      const e = l?.generations || {};
      const t = e.max_effort_per_day ?? 0;
      const n = e.max_effort_remaining;
      if (t > 0 && typeof n === "number" && n <= 0) return false;
    }
    return true;
  }
  function pulseEffortProBadge(e) {
    const t = effortIndex(e);
    const n = document.querySelector(`.plan-effort-slider-pro[data-step="${t}"]`);
    const o = document.querySelector(`.plan-effort-option[data-effort="${e}"] .plan-effort-pro-badge`);
    const r = n && !n.hasAttribute("hidden") ? n : o && !o.hasAttribute("hidden") ? o : null;
    if (!r) return;
    r.classList.remove("is-pulse");
    void r.offsetWidth;
    r.classList.add("is-pulse");
    window.setTimeout(() => r.classList.remove("is-pulse"), 560);
  }
  function notifyEffortLocked(e) {
    if (e === "max") {
      const t = l?.generations || {};
      const n = t.max_effort_per_day ?? 0;
      const o = t.max_effort_remaining;
      if (n > 0 && typeof o === "number" && o <= 0) {
        if (typeof showNotification === "function") {
          showNotification(`Max daily limit reached (${n}/day). Use Normal effort.`, "info");
        }
        return;
      }
      pulseEffortProBadge(e);
      return;
    }
    if (e === "normal") {
      pulseEffortProBadge(e);
    }
  }
  function applyEffortUiMode(e, {persist: t = true, animate: n = true} = {}) {
    const o = e === "slider" ? "slider" : "flyout";
    const r = y !== o || document.documentElement.dataset.effortUi !== o;
    const i = !isAutoMode();
    if (r && o === "slider") closeEffortFlyout();
    y = o;
    document.documentElement.dataset.effortUi = o;
    if (t) persistEffortUiMode(o);
    const a = getEffortTrigger();
    const s = getSliderPanel();
    if (a) {
      a.hidden = !i || o === "slider";
      a.setAttribute("aria-controls", "planEffortFlyout");
      if (!i || o === "slider") a.setAttribute("aria-expanded", "false");
    }
    if (s) {
      if (i && o === "slider") {
        s.hidden = false;
        s.classList.remove("is-ready");
        const reveal = () => {
          s.classList.add("is-ready");
          syncEffortSliderUI();
        };
        if (n && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
  function resolveEffortForTier(e) {
    const t = allowedEffortsForTier(e);
    const n = readStoredEffort();
    if (n && t.includes(n)) return n;
    return defaultEffortForTier(e);
  }
  function setEffort(e, {persist: t = true, closeFlyout: n = true, animate: o = false} = {}) {
    if (!isEffortSelectable(e)) return false;
    d = e;
    if (t) persistEffort(e);
    syncEffortUI({
      animate: o
    });
    if (n && y === "flyout") closeEffortFlyout();
    return true;
  }
  function setSliderT(e, {animate: t = false, magnet: n = false} = {}) {
    const o = document.getElementById("planEffortSlider");
    if (!o) return;
    const r = Math.max(0, Math.min(1, e));
    o.style.setProperty("--effort-t", String(r));
    o.classList.toggle("is-max", r >= .98);
    window.clearTimeout(setSliderT._snapTimer);
    o.classList.toggle("is-snapping", t);
    o.classList.toggle("is-magnet", n && !t);
    if (t || n) {
      setSliderT._snapTimer = window.setTimeout(() => {
        o.classList.remove("is-snapping", "is-magnet");
      }, t ? 280 : 200);
    } else {
      o.classList.remove("is-snapping", "is-magnet");
    }
  }
  function clearMaxBits() {
    const e = document.getElementById("planEffortSlider");
    if (!e) return;
    e.classList.remove("is-bits-live");
  }
  function playMaxBitsBurst() {
    const e = document.getElementById("planEffortSlider");
    if (!e) return;
    e.classList.remove("is-bits-live");
    void e.offsetWidth;
    requestAnimationFrame(() => {
      if (d === "max" && !h) {
        e.classList.add("is-bits-live", "is-max");
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
  function clientXToSliderT(e) {
    const t = document.getElementById("planEffortSliderTrack");
    if (!t) return 0;
    const n = t.getBoundingClientRect();
    const o = 18;
    const r = Math.max(1, n.width - o);
    return Math.max(0, Math.min(1, (e - n.left - o / 2) / r));
  }
  function magnetizeT(e) {
    const t = s.length - 1;
    const n = .16;
    let o = e;
    let r = n;
    let i = false;
    for (let n = 0; n <= t; n += 1) {
      if (!isEffortSelectable(effortFromIndex(n))) continue;
      const a = n / t;
      const s = Math.abs(e - a);
      if (s <= r) {
        r = s;
        o = a;
        i = true;
      }
    }
    return {
      t: o,
      snapped: i,
      index: Math.round(o * t)
    };
  }
  function nearestAllowedIndex(e) {
    const t = s.length - 1;
    let n = null;
    let o = Infinity;
    for (let r = 0; r <= t; r += 1) {
      if (!isEffortSelectable(effortFromIndex(r))) continue;
      const t = Math.abs(r - e);
      if (t < o) {
        o = t;
        n = r;
      }
    }
    return n == null ? 0 : n;
  }
  function syncEffortSliderUI({animate: e = false} = {}) {
    const n = effortIndex(d);
    const o = t[d] || "Low";
    const r = n / (s.length - 1);
    const i = allowedEffortsForTier(m);
    const a = document.getElementById("planEffortSlider");
    const l = document.getElementById("planEffortSliderValue");
    const c = document.getElementById("planEffortSliderPanel");
    if (!h) setSliderT(r, {
      animate: e
    });
    if (l) l.textContent = o;
    if (a) {
      a.setAttribute("aria-valuenow", String(n));
      a.setAttribute("aria-valuetext", o);
      a.classList.toggle("is-single", i.length <= 1);
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
      c.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        const t = Number(e.dataset.step || 0);
        const o = effortFromIndex(t);
        const l = h ? Math.round((Number(a?.style.getPropertyValue("--effort-t")) || r) * (s.length - 1)) : n;
        e.classList.toggle("is-passed", t <= l);
        e.classList.toggle("is-locked", !i.includes(o));
      });
      c.querySelectorAll(".plan-effort-slider-pro").forEach(e => {
        const t = Number(e.dataset.step || 0);
        const n = effortFromIndex(t);
        if (!i.includes(n)) e.removeAttribute("hidden"); else e.setAttribute("hidden", "");
      });
    }
  }
  function isCompactPlanUi() {
    try {
      return window.matchMedia("(max-width: 768px)").matches;
    } catch (e) {
      return window.innerWidth <= 768;
    }
  }
  function syncEffortUI(e) {
    const n = isAutoMode() ? "auto" : d;
    const o = t[n] || "Auto";
    const r = document.getElementById("planSelectorLabel");
    if (r) {
      r.removeAttribute("hidden");
      if (!r.textContent.trim()) {
        const e = (m || "free").charAt(0).toUpperCase() + (m || "free").slice(1);
        r.textContent = `${e} Plan`;
      }
    }
    const i = document.getElementById("planSelectorWrap");
    if (i) {
      i.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      i.dataset.effort = n;
    }
    const a = getPopover();
    if (a) {
      a.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      a.dataset.effort = n;
    }
    const s = document.getElementById("planSelectorEffort");
    if (s) {
      s.textContent = o;
      s.dataset.effort = n;
    }
    const c = document.getElementById("planSelectorBtn");
    if (c) {
      const e = r?.textContent?.trim() || "Plan";
      const t = isCompactPlanUi();
      c.setAttribute("aria-label", t ? `${o}. ${e} usage` : `${e}, ${o}`);
    }
    const f = document.getElementById("planEffortTriggerValue");
    if (f) f.textContent = t[d] || "Low";
    if (!isAutoMode()) {
      syncEffortSliderUI(e);
    }
    const u = document.getElementById("planEffortFlyout");
    if (!u) return;
    const p = allowedEffortsForTier(m);
    u.querySelectorAll(".plan-effort-option").forEach(e => {
      const t = e.dataset.effort;
      const n = p.includes(t);
      const o = t === d;
      const r = e.querySelector(".plan-effort-pro-badge");
      const i = e.querySelector(".plan-effort-option-hint");
      e.classList.toggle("is-locked", !n);
      e.classList.toggle("is-active", o);
      e.setAttribute("aria-checked", o ? "true" : "false");
      if (r) {
        if (!n) r.removeAttribute("hidden"); else r.setAttribute("hidden", "");
      }
      if (i) {
        i.hidden = !n;
      }
      if (n && t === "max") {
        const t = l?.generations || {};
        const n = t.max_effort_per_day ?? 0;
        const o = t.max_effort_remaining;
        if (n > 0 && typeof o === "number") {
          e.title = `Max — ${o}/${n} left today`;
          if (o <= 0) {
            e.classList.add("is-locked");
            e.title = `Max daily limit reached (${n}/day)`;
          }
        } else {
          e.title = "Max — best interesting moments + cleaner cuts";
        }
      } else {
        e.title = n ? t === "normal" ? "Normal — balanced speed and quality" : "Low — fast, smart picks, low compute" : t === "max" ? "Max effort requires Prime or Elite" : t === "normal" ? "Normal effort requires Basic or higher" : "Locked on your plan";
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
    const e = getPopover();
    if (!e) return;
    const t = e.getBoundingClientRect();
    const n = 176;
    const o = window.innerWidth - t.right;
    const r = o < n + 16 && t.left > n + 16;
    e.classList.toggle("effort-open-left", r);
  }
  function openEffortFlyout() {
    if (y === "slider") return;
    const e = getPopover();
    const t = getFlyout();
    const n = getEffortTrigger();
    if (!e || !t || !n) return;
    p = true;
    t.hidden = false;
    positionEffortFlyoutSide();
    requestAnimationFrame(() => {
      e.classList.add("effort-open");
      t.classList.add("is-open");
    });
    n.setAttribute("aria-expanded", "true");
    syncEffortUI();
  }
  function closeEffortFlyout() {
    const e = getPopover();
    const t = getFlyout();
    const n = getEffortTrigger();
    if (!e || !t) return;
    p = false;
    e.classList.remove("effort-open", "effort-open-left");
    t.classList.remove("is-open");
    if (n) n.setAttribute("aria-expanded", "false");
    const finish = () => {
      if (!p) t.hidden = true;
      t.removeEventListener("transitionend", finish);
    };
    t.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function toggleEffortControl() {
    if (y === "slider") return;
    if (p) closeEffortFlyout(); else openEffortFlyout();
  }
  function trySelectEffortFromSlider(e, {animate: t = true} = {}) {
    const n = effortFromIndex(e);
    const o = nearestAllowedIndex(e);
    const r = effortFromIndex(o);
    if (n !== r) notifyEffortLocked(n);
    return setEffort(r, {
      closeFlyout: false,
      animate: t
    });
  }
  function bindEffortSliderInteractions() {
    const e = document.getElementById("planEffortSlider");
    if (!e || e.dataset.bound === "true") return;
    e.dataset.bound = "true";
    const n = document.getElementById("planEffortSliderValue");
    let o = null;
    let r = null;
    const previewFromT = o => {
      const i = magnetizeT(o);
      const a = i.snapped;
      const l = i.t;
      const c = i.index;
      clearMaxBits();
      if (a && r !== c) {
        setSliderT(l, {
          magnet: true
        });
      } else if (a) {
        setSliderT(l, {
          animate: false
        });
      } else {
        r = null;
        setSliderT(o, {
          animate: false
        });
      }
      if (a) r = c;
      const f = t[effortFromIndex(c)] || "Low";
      if (n) n.textContent = f;
      e.classList.toggle("is-max", c === s.length - 1 && isEffortSelectable("max"));
      const d = document.getElementById("planEffortSliderPanel");
      d?.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        const t = Number(e.dataset.step || 0);
        e.classList.toggle("is-passed", t <= c);
        e.classList.toggle("is-magnet-hot", a && t === c);
      });
    };
    const finishDrag = t => {
      const n = magnetizeT(clientXToSliderT(t));
      h = false;
      r = null;
      e.classList.remove("is-dragging");
      e.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        e.classList.remove("is-magnet-hot");
      });
      trySelectEffortFromSlider(n.index, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, g);
    };
    e.addEventListener("pointerdown", t => {
      if (t.button != null && t.button !== 0) return;
      t.preventDefault();
      t.stopPropagation();
      o = t.pointerId;
      h = true;
      r = null;
      clearMaxBits();
      e.classList.add("is-dragging");
      e.classList.remove("is-snapping", "is-magnet");
      try {
        e.setPointerCapture(t.pointerId);
      } catch (e) {}
      previewFromT(clientXToSliderT(t.clientX));
      e.focus({
        preventScroll: true
      });
    });
    e.addEventListener("pointermove", e => {
      if (!h || e.pointerId !== o) return;
      e.preventDefault();
      previewFromT(clientXToSliderT(e.clientX));
    });
    const endPointer = t => {
      if (!h || o != null && t.pointerId !== o) return;
      t.preventDefault();
      t.stopPropagation();
      const n = t.clientX;
      o = null;
      try {
        e.releasePointerCapture(t.pointerId);
      } catch (e) {}
      finishDrag(n);
    };
    e.addEventListener("pointerup", endPointer);
    e.addEventListener("pointercancel", endPointer);
    e.addEventListener("keydown", e => {
      const t = effortIndex(d);
      let n = t;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") n = t + 1; else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = t - 1; else if (e.key === "Home") n = 0; else if (e.key === "End") n = s.length - 1; else return;
      e.preventDefault();
      trySelectEffortFromSlider(n, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, g);
    });
  }
  async function fetchTierInfo(e = false) {
    if (!e && isCacheFresh()) return l;
    if (!e && f) return f;
    f = (async () => {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/tier/info") : `${window.API_BASE_URL || "https://api.solisai.video/api"}/tier/info`;
      const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const n = await fetch(e, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (!n.ok) throw new Error(`tier/info ${n.status}`);
      const o = await n.json();
      if (!o?.data) throw new Error("Invalid tier response");
      l = o.data;
      c = Date.now();
      const r = l.library || l.saved_videos;
      if (r && typeof window.applyStorageBadgeUI === "function") {
        const e = (l.tier || "free").toLowerCase();
        const t = r.unlimited === true || typeof window.isUnlimitedLibrary === "function" && window.isUnlimitedLibrary(null, e);
        window.applyStorageBadgeUI({
          used: r.used ?? 0,
          limit: t ? null : r.limit ?? r.max_videos ?? 5,
          plan: e,
          unlimited: t
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
      return sessionStorage.getItem(i) || "";
    } catch (e) {
      return "";
    }
  }
  function dismissQuotaKind(e) {
    try {
      sessionStorage.setItem(i, e || "");
    } catch (e) {}
  }
  function clearQuotaDismiss() {
    try {
      sessionStorage.removeItem(i);
    } catch (e) {}
  }
  function parseQuotaResetWhen(e) {
    if (e == null || e === "") return null;
    if (e instanceof Date) {
      return Number.isNaN(e.getTime()) ? null : e;
    }
    const t = String(e).trim();
    if (!t) return null;
    const n = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t);
    const o = n ? t : `${t.replace(" ", "T")}Z`;
    const r = new Date(o);
    return Number.isNaN(r.getTime()) ? null : r;
  }
  function formatQuotaUnlockWhen(e) {
    const t = parseQuotaResetWhen(e);
    if (!t) return "";
    const n = new Date;
    const o = t.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const r = t.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    const i = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const s = Math.round((a - i) / 864e5);
    if (s === 0) return `today at ${o}`;
    if (s === 1) return `tomorrow at ${o}`;
    return `${r} at ${o}`;
  }
  function nextLocalMidnightLabel() {
    const e = new Date;
    const t = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0, 0, 0, 0);
    return formatQuotaUnlockWhen(t);
  }
  function resolveDailyUnlockLabel(e) {
    const t = parseQuotaResetWhen(e);
    if (!t) return nextLocalMidnightLabel();
    const n = t.getHours();
    const o = t.getMinutes();
    if (o === 0 && n > 0 && n <= 6) {
      const e = t.getUTCHours();
      const n = t.getUTCMinutes();
      if (e === 0 && n === 0) {
        return nextLocalMidnightLabel();
      }
    }
    return formatQuotaUnlockWhen(e) || nextLocalMidnightLabel();
  }
  function parseQuotaState(e, t) {
    const n = Math.max(0, Number(e?.daily?.remaining ?? t?.remaining ?? 0));
    const o = Math.max(0, Number(e?.daily?.limit ?? t?.max_per_period ?? t?.max_per_day ?? 0));
    const r = Math.max(0, Number(e?.monthly?.remaining ?? t?.remaining_month ?? 0));
    const i = Math.max(0, Number(e?.monthly?.limit ?? t?.max_per_month ?? 0));
    const a = i > 0 && r <= 0;
    const s = o > 0 && n <= 0 || e?.daily_limit_reached === true || e?.block_reason === "daily_limit";
    let l = n;
    if (a) {
      l = 0;
    } else if (s) {
      l = 0;
    } else if (i > 0) {
      l = Math.min(n, r);
    }
    const c = i > 0 && r <= n ? "monthly" : "daily";
    return {
      dailyRem: n,
      dailyMax: o,
      monthlyRem: r,
      monthlyMax: i,
      monthlyEmpty: a,
      dailyEmpty: s,
      headlineRem: l,
      binding: c,
      canRunNow: !a && !s
    };
  }
  function formatQuotaChipDisplay(e, t, n, o) {
    const r = e.monthlyMax > 0 ? e.monthlyMax : Math.max(1, Number(n?.max_per_month ?? n?.max_per_day ?? 1));
    const i = Math.max(0, Number(e.monthlyRem));
    const a = `<span class="plan-count-remaining">${i}</span>` + `<span class="plan-count-sep"> / ${r}</span>`;
    const s = r > 0 ? Math.min(100, (r - i) / r * 100) : 0;
    if (e.monthlyEmpty) {
      return {
        countHtml: '<span class="plan-count-remaining">0</span>' + `<span class="plan-count-sep"> / ${r}</span>`,
        kicker: "uploads left",
        progressPct: 100,
        resetLine: "Resets with your plan renewal"
      };
    }
    let l = "";
    if (e.dailyEmpty && i > 0) {
      const e = t?.daily?.resets_at || n?.daily_resets_at || n?.resets_at;
      const o = resolveDailyUnlockLabel(e);
      l = o ? `Next upload unlocks ${o}` : "Next upload unlocks tomorrow";
    }
    return {
      countHtml: a,
      kicker: i === 1 ? "upload left" : "uploads left",
      progressPct: s,
      resetLine: l
    };
  }
  const v = "solisEverGenerated";
  const S = "solisCreateFirstSeenAt";
  const x = 7;
  function markSolisEverGenerated() {
    try {
      localStorage.setItem(v, "1");
    } catch (e) {}
  }
  function readSolisEverGenerated() {
    try {
      return localStorage.getItem(v) === "1";
    } catch (e) {
      return false;
    }
  }
  function freeTenureDays() {
    try {
      let e = localStorage.getItem(S);
      if (!e) {
        e = String(Date.now());
        localStorage.setItem(S, e);
        return 0;
      }
      const t = parseInt(e, 10);
      if (!Number.isFinite(t) || t <= 0) return 0;
      return Math.max(0, (Date.now() - t) / 864e5);
    } catch (e) {
      return 0;
    }
  }
  function syncUpgradeCardVisibility(e) {
    const t = document.getElementById("upgradeCardCreate");
    if (!t) return;
    const n = String(e?.tier || e?.plan || window.currentUser?.plan || "free").toLowerCase();
    const o = e?.generations || {};
    const r = e?.library || e?.saved_videos || {};
    const i = Math.max(0, Number(o.used_today ?? 0));
    const a = Math.max(0, Number(o.used_this_month ?? 0));
    const s = Math.max(0, Number(o.used_lifetime ?? 0));
    const l = Math.max(0, Number(r.used ?? 0));
    const c = i > 0 || a > 0 || s > 0 || l > 0 || readSolisEverGenerated();
    if (c) markSolisEverGenerated();
    const f = freeTenureDays() >= x;
    const d = [ "basic", "prime", "elite", "pro" ].includes(n);
    const u = !d && (c || f);
    t.hidden = !u;
    t.setAttribute("aria-hidden", u ? "false" : "true");
    t.style.display = u ? "flex" : "none";
    try {
      window.syncCreateFirstUrlNudge?.(e);
    } catch (e) {}
  }
  window.solisQuotaDisplay = {
    parseState: parseQuotaState,
    formatChip: formatQuotaChipDisplay,
    formatUnlockWhen: formatQuotaUnlockWhen,
    resolveDailyUnlockLabel: resolveDailyUnlockLabel,
    nextLocalMidnightLabel: nextLocalMidnightLabel,
    syncUpgradeCard: syncUpgradeCardVisibility,
    markEverGenerated: markSolisEverGenerated
  };
  function syncQuotaRail(e, t) {
    const n = document.getElementById("urlQuotaRail");
    const o = document.getElementById("urlQuotaBanner");
    const r = document.getElementById("urlQuotaTitle");
    const i = document.getElementById("urlQuotaSub");
    const a = document.getElementById("urlInputStack");
    if (!n || !o || !r || !i) return;
    const s = e?.generations || {};
    const l = parseQuotaState(t, s);
    const {dailyRem: c, dailyMax: f, monthlyRem: u, monthlyMax: p, monthlyEmpty: y, dailyEmpty: g, binding: h} = l;
    const E = Math.max(0, Number(t?.max_effort?.limit ?? s.max_effort_per_day ?? 0));
    const w = t?.max_effort?.remaining ?? s.max_effort_remaining;
    const v = Math.max(0, Number(w ?? 0));
    const S = t?.max_effort?.can_use ?? s.can_use_max_effort;
    const x = E > 0 && (v <= 0 || S === false);
    const L = !g && !y && f >= 3 && c > 0 && h === "daily" && (c <= 1 || c / f <= .2);
    const I = !y && !g && p > 0 && h === "monthly" && (u <= 2 || u / p <= .15);
    const M = E >= 3 && !x && v === 1;
    let b = "";
    let B = "";
    let P = "";
    if (y) {
      b = "monthly";
      B = "Monthly limit reached";
      const e = formatQuotaUnlockWhen(t?.monthly?.resets_at || s.monthly_resets_at);
      P = e ? `New uploads unlock ${e}.` : "New uploads unlock when your plan renews.";
    } else if (g) {
      b = "daily";
      const e = t?.daily?.resets_at || s.daily_resets_at || s.resets_at;
      const n = resolveDailyUnlockLabel(e);
      if (u > 0) {
        B = m === "free" ? "Used your free upload" : "Used today's uploads";
        P = n ? `Next upload unlocks ${n}.` : "Next upload unlocks tomorrow.";
      } else {
        B = m === "free" ? "Free upload used" : "Daily limit reached";
        P = n ? `Next upload unlocks ${n}.` : "Upgrade for more daily uploads.";
      }
    } else if (I) {
      b = "monthly-low";
      B = u === 1 ? "One upload left" : `${u} uploads left`;
      P = "Upgrade if you need more room this month.";
    } else if (L) {
      b = "daily-low";
      B = c === 1 ? "One upload left today" : `${c} uploads left today`;
      P = "Upgrade if you need more room today.";
    } else if (x) {
      b = "max-empty";
      B = "Max effort used up for today";
      const e = t?.max_effort?.resets_at || s.max_effort_resets_at;
      const n = formatQuotaUnlockWhen(e);
      P = n ? `Max effort unlocks again ${n}. You can still generate with Normal or Low.` : "You can still generate with Normal or Low.";
      if (readDismissedKind() === "max" || readDismissedKind() === "max-low") {
        clearQuotaDismiss();
      }
      if (d === "max") {
        const e = allowedEffortsForTier(m).includes("normal") ? "normal" : "low";
        setEffort(e, {
          persist: true,
          closeFlyout: false
        });
      }
    } else if (M) {
      b = "max-low";
      B = "One Max effort left today";
      P = "After this, Solis falls back to Normal so you can keep creating.";
    } else {
      n.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    if (readDismissedKind() === b) {
      n.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    o.dataset.kind = b;
    r.textContent = B;
    i.textContent = P;
    n.hidden = false;
    if (a) a.classList.add("has-quota");
  }
  async function enrichQuotaFromStatus() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/clips/status") : `${window.API_BASE_URL || "/api"}/clips/status`;
      const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const n = await fetch(e, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (!n.ok) return null;
      g = await n.json();
      return g;
    } catch (e) {
      return null;
    }
  }
  function applyTierToUI(e) {
    const t = document.getElementById("planSelectorWrap");
    const n = document.getElementById("planSelectorLabel");
    const o = document.getElementById("planPopoverTier");
    const r = document.getElementById("planPopoverCount");
    const i = document.getElementById("planPopoverProgress");
    const a = document.getElementById("planPopoverReset");
    const s = document.getElementById("planPopoverUpgrade");
    if (!t || !n) return;
    const l = (e?.tier || "free").toLowerCase();
    const c = e?.tier_name || l.charAt(0).toUpperCase() + l.slice(1);
    const f = `${c} Plan`;
    m = l;
    d = resolveEffortForTier(l);
    if (!u) u = readEffortSelection();
    t.dataset.tier = l;
    t.dataset.effort = isAutoMode() ? "auto" : d;
    t.dataset.effortSelection = u;
    const p = getPopover();
    if (p) {
      p.dataset.tier = l;
      p.dataset.effort = isAutoMode() ? "auto" : d;
      p.dataset.effortSelection = u;
    }
    n.textContent = f;
    if (o) o.textContent = f;
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(e, g);
    const y = e?.generations;
    const h = document.getElementById("planPopoverKicker");
    if (y && r) {
      const e = formatQuotaChipDisplay(parseQuotaState(g, y), g, y, l);
      r.innerHTML = e.countHtml;
      if (h) h.textContent = e.kicker || "uploads left";
      if (i) {
        i.style.width = `${Math.min(100, e.progressPct || 0)}%`;
      }
      if (a) {
        const t = e.resetLine || formatResetLabel(y);
        a.textContent = t;
        a.hidden = !t;
      }
    } else if (r) {
      r.textContent = "—";
      if (h) h.textContent = "uploads left";
      if (i) i.style.width = "0%";
      if (a) {
        a.textContent = "";
        a.hidden = true;
      }
    }
    if (s) {
      const e = [ "basic", "prime", "elite", "pro" ].includes(l);
      const t = typeof readSolisEverGenerated === "function" && readSolisEverGenerated() || Math.max(0, Number(y?.used_lifetime ?? y?.used_today ?? y?.used_this_month ?? 0)) > 0 || freeTenureDays() >= x;
      s.classList.toggle("hidden", e || !t);
    }
    syncUpgradeCardVisibility(e);
    clearLoadingState();
  }
  function setLoadingState(e = true) {
    const t = document.getElementById("planSelectorWrap");
    const n = document.getElementById("planSelectorBtn");
    const o = getPopover();
    if (t) t.classList.toggle("is-loading", !!e);
    if (o) o.classList.toggle("is-loading", !!e);
    if (n) n.setAttribute("aria-busy", e ? "true" : "false");
  }
  function clearLoadingState() {
    setLoadingState(false);
  }
  function getInputContainer() {
    return document.querySelector(".url-input-container");
  }
  let L = null;
  let I = null;
  function getPopover() {
    return document.getElementById("planSelectorPopover");
  }
  function mountPopover() {
    const e = document.getElementById("planSelectorWrap");
    const t = getPopover();
    if (!e || !t || t.parentElement === document.body) return;
    I = e;
    document.body.appendChild(t);
  }
  function unmountPopover() {
    const e = getPopover();
    if (!e || !I || e.parentElement !== document.body) return;
    I.appendChild(e);
    I = null;
  }
  function positionPopover() {
    const e = document.getElementById("planSelectorBtn");
    const t = getPopover();
    if (!e || !t || t.hidden) return;
    const n = e.getBoundingClientRect();
    const o = isCompactPlanUi();
    const r = o ? 10 : 12;
    const i = o ? Math.min(360, window.innerWidth - r * 2) : Math.min(268, window.innerWidth - 48);
    const a = i;
    let s;
    if (o) {
      s = Math.max(r, Math.round((window.innerWidth - a) / 2));
    } else {
      s = Math.max(r, n.right - a);
      s = Math.min(s, window.innerWidth - a - r);
    }
    let l = n.bottom + (o ? 12 : 10);
    const c = t.offsetHeight || (o ? 320 : 260);
    if (l + c > window.innerHeight - r) {
      l = Math.max(r, n.top - c - 10);
    }
    t.style.top = `${l}px`;
    t.style.left = `${s}px`;
    t.style.width = `${a}px`;
    t.style.right = "auto";
    if (p && !o) positionEffortFlyoutSide();
  }
  function bindReposition() {
    if (L) return;
    let e = isCompactPlanUi();
    L = () => {
      positionPopover();
      const t = isCompactPlanUi();
      if (t !== e) {
        e = t;
        syncEffortUI({
          animate: false
        });
      }
    };
    window.addEventListener("resize", L);
    window.addEventListener("scroll", L, true);
  }
  function unbindReposition() {
    if (!L) return;
    window.removeEventListener("resize", L);
    window.removeEventListener("scroll", L, true);
    L = null;
  }
  function openPopover() {
    const e = document.getElementById("planSelectorWrap");
    const t = document.getElementById("planSelectorBtn");
    const n = getPopover();
    const o = getInputContainer();
    if (!e || !t || !n) return;
    mountPopover();
    n.hidden = false;
    t.setAttribute("aria-expanded", "true");
    positionPopover();
    requestAnimationFrame(() => {
      e.classList.add("is-open");
      n.classList.add("is-open");
      if (o) o.classList.add("is-open");
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
        const e = document.getElementById("planPopoverReset");
        const t = document.getElementById("planPopoverCount");
        if (t) t.textContent = "—";
        if (e) e.textContent = "Could not load usage";
      });
    }
  }
  function closePopover(e = {}) {
    const t = Boolean(e.immediate);
    const n = document.getElementById("planSelectorWrap");
    const o = document.getElementById("planSelectorBtn");
    const r = getPopover();
    const i = getInputContainer();
    if (!n || !o || !r) return;
    if (r.hidden && !n.classList.contains("is-open") && !r.classList.contains("is-open")) {
      return;
    }
    closeEffortFlyout();
    n.classList.remove("is-open");
    r.classList.remove("is-open");
    if (i) i.classList.remove("is-open");
    o.setAttribute("aria-expanded", "false");
    unbindReposition();
    const finish = () => {
      if (!n.classList.contains("is-open")) {
        r.hidden = true;
        r.style.top = "";
        r.style.left = "";
        r.style.width = "";
        unmountPopover();
      }
      r.removeEventListener("transitionend", finish);
    };
    if (t) {
      finish();
      return;
    }
    r.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function togglePopover() {
    const e = document.getElementById("planSelectorWrap");
    if (!e) return;
    if (e.classList.contains("is-open")) closePopover(); else openPopover();
  }
  function onPopoverClick(e) {
    const t = e.target.closest("#planEffortAdvancedToggle");
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      setEffortSelection(isAutoMode() ? "advanced" : "auto");
      return;
    }
    if (e.target.closest("#planEffortSlider") || e.target.closest("#planEffortSliderPanel")) {
      e.stopPropagation();
      return;
    }
    const n = e.target.closest("#planEffortTrigger");
    if (n) {
      e.preventDefault();
      e.stopPropagation();
      if (isAutoMode()) setEffortSelection("advanced");
      toggleEffortControl();
      return;
    }
    const o = e.target.closest(".plan-effort-option");
    if (!o) return;
    e.preventDefault();
    e.stopPropagation();
    const r = o.dataset.effort;
    if (!isEffortSelectable(r)) {
      notifyEffortLocked(r);
      return;
    }
    setEffort(r, {
      animate: false
    });
    if (l) syncQuotaRail(l, g);
  }
  function initPlanSelector() {
    const e = document.getElementById("planSelectorWrap");
    const t = document.getElementById("planSelectorBtn");
    if (!e || !t) return;
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
      const e = window.matchMedia("(max-width: 768px)");
      const onMq = () => syncEffortUI({
        animate: false
      });
      if (e.addEventListener) e.addEventListener("change", onMq); else if (e.addListener) e.addListener(onMq);
    } catch (e) {}
    const n = document.getElementById("urlQuotaClose");
    if (n && !n.dataset.bound) {
      n.dataset.bound = "true";
      n.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        const t = document.getElementById("urlQuotaBanner");
        const n = t?.dataset?.kind || "";
        dismissQuotaKind(n);
        const o = document.getElementById("urlQuotaRail");
        const r = document.getElementById("urlInputStack");
        if (o) o.hidden = true;
        if (r) r.classList.remove("has-quota");
      });
    }
    t.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      togglePopover();
    });
    const o = getPopover();
    if (o) {
      o.addEventListener("click", onPopoverClick);
    }
    document.addEventListener("click", t => {
      const n = getPopover();
      if (e.contains(t.target) || n?.contains(t.target)) return;
      closePopover();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (p) {
        closeEffortFlyout();
        return;
      }
      closePopover();
    });
    fetchTierInfo().then(async e => {
      await enrichQuotaFromStatus();
      applyTierToUI(e);
    }).catch(() => {
      e.dataset.tier = "free";
      m = "free";
      d = "low";
      const t = document.getElementById("planSelectorLabel");
      if (t) t.textContent = "Free Plan";
      syncEffortUI();
      clearLoadingState();
    });
  }
  window.refreshPlanSelector = function refreshPlanSelector() {
    invalidateTierCache();
    setLoadingState(true);
    return Promise.all([ fetchTierInfo(true), enrichQuotaFromStatus() ]).then(([e]) => {
      applyTierToUI(e);
      return e;
    }).catch(() => {
      clearLoadingState();
    });
  };
  window.updateUrlQuotaRail = function updateUrlQuotaRail(e) {
    if (e) g = e;
    if (l) syncQuotaRail(l, g);
  };
  window.closePlanSelectorPopover = function closePlanSelectorPopover(e = true) {
    closePopover({
      immediate: Boolean(e)
    });
  };
  window.getSelectedEffortMode = function getSelectedEffortMode() {
    return isAutoMode() ? "auto" : d;
  };
  window.isEffortAutoMode = function isEffortAutoMode() {
    return isAutoMode();
  };
  window.setEffortAutoMode = function setEffortAutoMode(e) {
    setEffortSelection(e ? "auto" : "advanced");
    return isAutoMode();
  };
  window.setSelectedEffortMode = function setSelectedEffortMode(e) {
    if (e === "auto") {
      setEffortSelection("auto");
      return true;
    }
    if (isAutoMode()) setEffortSelection("advanced");
    const t = setEffort(e);
    if (l) syncQuotaRail(l, g);
    return t;
  };
  window.getEffortUiMode = function getEffortUiMode() {
    return y;
  };
  window.setEffortUiMode = function setEffortUiMode(e) {
    applyEffortUiMode(e);
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
