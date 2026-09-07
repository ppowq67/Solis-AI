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
  const i = "solis_multi_task";
  const a = "solis_quota_rail_dismiss";
  const s = 6e4;
  const l = [ "low", "normal", "max" ];
  let c = null;
  let d = 0;
  let f = null;
  let u = "low";
  let m = "auto";
  let p = false;
  let g = "free";
  let y = false;
  let h = "slider";
  let E = null;
  let w = false;
  function isAutoMode() {
    return m !== "advanced";
  }
  function multiTaskAllowedForTier(e) {
    const t = String(e || "free").toLowerCase();
    return t === "prime" || t === "elite";
  }
  function readMultiTaskEnabled() {
    try {
      return localStorage.getItem(i) === "1";
    } catch (e) {
      return false;
    }
  }
  function persistMultiTaskEnabled(e) {
    try {
      localStorage.setItem(i, e ? "1" : "0");
    } catch (e) {}
  }
  function syncMultiTaskUI() {
    const e = multiTaskAllowedForTier(g);
    if (!e) p = false;
    const t = document.getElementById("planMultiTaskRow");
    const n = document.getElementById("planMultiTaskToggle");
    if (t) {
      t.dataset.on = p ? "1" : "0";
      t.dataset.locked = e ? "0" : "1";
    }
    if (n) {
      n.classList.toggle("is-on", p);
      n.setAttribute("aria-checked", p ? "true" : "false");
      n.disabled = !e;
      n.setAttribute("aria-label", e ? "Multi Task" : "Multi Task (Prime or Elite)");
    }
  }
  function setMultiTaskEnabled(e, {persist: t = true} = {}) {
    const n = multiTaskAllowedForTier(g);
    p = n && !!e;
    if (t) persistMultiTaskEnabled(p);
    syncMultiTaskUI();
    try {
      if (typeof window.clipsStudio?.onMultiTaskToggled === "function") {
        window.clipsStudio.onMultiTaskToggled(p);
      }
    } catch (e) {}
    return p;
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
  let v = 0;
  const S = 380;
  function setEffortSelection(e, {persist: t = true, animate: n = true} = {}) {
    m = e === "advanced" ? "advanced" : "auto";
    if (t) persistEffortSelection(m);
    syncAdvancedModeUI({
      animate: n
    });
    syncEffortUI();
    if (c) syncQuotaRail(c, E);
  }
  function setAdvancedBodyVisible(e, {animate: t = true} = {}) {
    const n = document.getElementById("planEffortAdvancedBody");
    if (!n) return;
    window.clearTimeout(v);
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
        v = window.setTimeout(() => {
          n.hidden = true;
        }, S);
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
        i.textContent = g === "free" ? "Solis picks the best effort for your video" : "Balanced quality and speed, recommended for most tasks";
        requestAnimationFrame(() => i.classList.remove("is-collapsed"));
      } else {
        i.classList.add("is-collapsed");
      }
    }
    if (a) a.dataset.mode = n ? "auto" : "manual";
    syncMultiTaskUI();
    applyEffortUiMode(h, {
      persist: false,
      animate: t
    });
    if (n) closeEffortFlyout();
  }
  function isCacheFresh() {
    return c && Date.now() - d < s;
  }
  function invalidateTierCache() {
    c = null;
    d = 0;
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
    const t = l.indexOf(e);
    return t >= 0 ? t : 0;
  }
  function effortFromIndex(e) {
    return l[Math.max(0, Math.min(l.length - 1, e))] || "low";
  }
  function isEffortSelectable(e) {
    const t = allowedEffortsForTier(g);
    if (!t.includes(e)) return false;
    if (e === "max") {
      const e = c?.generations || {};
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
      const t = c?.generations || {};
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
    const r = h !== o || document.documentElement.dataset.effortUi !== o;
    const i = !isAutoMode();
    if (r && o === "slider") closeEffortFlyout();
    h = o;
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
    u = e;
    if (t) persistEffort(e);
    syncEffortUI({
      animate: o
    });
    if (n && h === "flyout") closeEffortFlyout();
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
      if (u === "max" && !w) {
        e.classList.add("is-bits-live", "is-max");
      }
    });
  }
  function syncMaxBits() {
    if (w) {
      clearMaxBits();
      return;
    }
    if (u === "max") playMaxBitsBurst(); else clearMaxBits();
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
    const t = l.length - 1;
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
    const t = l.length - 1;
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
    const n = effortIndex(u);
    const o = t[u] || "Low";
    const r = n / (l.length - 1);
    const i = allowedEffortsForTier(g);
    const a = document.getElementById("planEffortSlider");
    const s = document.getElementById("planEffortSliderValue");
    const c = document.getElementById("planEffortSliderPanel");
    if (!w) setSliderT(r, {
      animate: e
    });
    if (s) s.textContent = o;
    if (a) {
      a.setAttribute("aria-valuenow", String(n));
      a.setAttribute("aria-valuetext", o);
      a.classList.toggle("is-single", i.length <= 1);
      a.classList.toggle("is-max", u === "max");
    }
    if (!w) {
      if (u === "max") {
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
        const s = w ? Math.round((Number(a?.style.getPropertyValue("--effort-t")) || r) * (l.length - 1)) : n;
        e.classList.toggle("is-passed", t <= s);
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
    const n = isAutoMode() ? "auto" : u;
    const o = t[n] || "Auto";
    const r = document.getElementById("planSelectorLabel");
    if (r) {
      r.removeAttribute("hidden");
      if (!r.textContent.trim()) {
        const e = (g || "free").charAt(0).toUpperCase() + (g || "free").slice(1);
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
    const l = document.getElementById("planSelectorBtn");
    if (l) {
      const e = r?.textContent?.trim() || "Plan";
      const t = isCompactPlanUi();
      l.setAttribute("aria-label", t ? `${o}. ${e} usage` : `${e}, ${o}`);
    }
    const d = document.getElementById("planEffortTriggerValue");
    if (d) d.textContent = t[u] || "Low";
    if (!isAutoMode()) {
      syncEffortSliderUI(e);
    }
    const f = document.getElementById("planEffortFlyout");
    if (!f) return;
    const m = allowedEffortsForTier(g);
    f.querySelectorAll(".plan-effort-option").forEach(e => {
      const t = e.dataset.effort;
      const n = m.includes(t);
      const o = t === u;
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
        const t = c?.generations || {};
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
    if (h === "slider") return;
    const e = getPopover();
    const t = getFlyout();
    const n = getEffortTrigger();
    if (!e || !t || !n) return;
    y = true;
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
    y = false;
    e.classList.remove("effort-open", "effort-open-left");
    t.classList.remove("is-open");
    if (n) n.setAttribute("aria-expanded", "false");
    const finish = () => {
      if (!y) t.hidden = true;
      t.removeEventListener("transitionend", finish);
    };
    t.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function toggleEffortControl() {
    if (h === "slider") return;
    if (y) closeEffortFlyout(); else openEffortFlyout();
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
      const s = i.t;
      const c = i.index;
      clearMaxBits();
      if (a && r !== c) {
        setSliderT(s, {
          magnet: true
        });
      } else if (a) {
        setSliderT(s, {
          animate: false
        });
      } else {
        r = null;
        setSliderT(o, {
          animate: false
        });
      }
      if (a) r = c;
      const d = t[effortFromIndex(c)] || "Low";
      if (n) n.textContent = d;
      e.classList.toggle("is-max", c === l.length - 1 && isEffortSelectable("max"));
      const f = document.getElementById("planEffortSliderPanel");
      f?.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        const t = Number(e.dataset.step || 0);
        e.classList.toggle("is-passed", t <= c);
        e.classList.toggle("is-magnet-hot", a && t === c);
      });
    };
    const finishDrag = t => {
      const n = magnetizeT(clientXToSliderT(t));
      w = false;
      r = null;
      e.classList.remove("is-dragging");
      e.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        e.classList.remove("is-magnet-hot");
      });
      trySelectEffortFromSlider(n.index, {
        animate: true
      });
      syncMaxBits();
      if (c) syncQuotaRail(c, E);
    };
    e.addEventListener("pointerdown", t => {
      if (t.button != null && t.button !== 0) return;
      t.preventDefault();
      t.stopPropagation();
      o = t.pointerId;
      w = true;
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
      if (!w || e.pointerId !== o) return;
      e.preventDefault();
      previewFromT(clientXToSliderT(e.clientX));
    });
    const endPointer = t => {
      if (!w || o != null && t.pointerId !== o) return;
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
      const t = effortIndex(u);
      let n = t;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") n = t + 1; else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = t - 1; else if (e.key === "Home") n = 0; else if (e.key === "End") n = l.length - 1; else return;
      e.preventDefault();
      trySelectEffortFromSlider(n, {
        animate: true
      });
      syncMaxBits();
      if (c) syncQuotaRail(c, E);
    });
  }
  async function fetchTierInfo(e = false) {
    if (!e && isCacheFresh()) return c;
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
      c = o.data;
      d = Date.now();
      const r = c.library || c.saved_videos;
      if (r && typeof window.applyStorageBadgeUI === "function") {
        const e = (c.tier || "free").toLowerCase();
        const t = r.unlimited === true || typeof window.isUnlimitedLibrary === "function" && window.isUnlimitedLibrary(null, e);
        window.applyStorageBadgeUI({
          used: r.used ?? 0,
          limit: t ? null : r.limit ?? r.max_videos ?? 5,
          plan: e,
          unlimited: t
        });
      }
      return c;
    })().finally(() => {
      f = null;
    });
    return f;
  }
  function readDismissedKind() {
    try {
      return sessionStorage.getItem(a) || "";
    } catch (e) {
      return "";
    }
  }
  function dismissQuotaKind(e) {
    try {
      sessionStorage.setItem(a, e || "");
    } catch (e) {}
  }
  function clearQuotaDismiss() {
    try {
      sessionStorage.removeItem(a);
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
    return formatQuotaUnlockWhen(e) || "";
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
  const x = "solisEverGenerated";
  const M = "solisCreateFirstSeenAt";
  const I = 7;
  function markSolisEverGenerated() {
    try {
      localStorage.setItem(x, "1");
    } catch (e) {}
  }
  function readSolisEverGenerated() {
    try {
      return localStorage.getItem(x) === "1";
    } catch (e) {
      return false;
    }
  }
  function freeTenureDays() {
    try {
      let e = localStorage.getItem(M);
      if (!e) {
        e = String(Date.now());
        localStorage.setItem(M, e);
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
    const d = freeTenureDays() >= I;
    const f = [ "basic", "prime", "elite", "pro" ].includes(n);
    const u = !f && (c || d);
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
    const {dailyRem: c, dailyMax: d, monthlyRem: f, monthlyMax: m, monthlyEmpty: p, dailyEmpty: y, binding: h} = l;
    const E = Math.max(0, Number(t?.max_effort?.limit ?? s.max_effort_per_day ?? 0));
    const w = t?.max_effort?.remaining ?? s.max_effort_remaining;
    const v = Math.max(0, Number(w ?? 0));
    const S = t?.max_effort?.can_use ?? s.can_use_max_effort;
    const x = E > 0 && (v <= 0 || S === false);
    const M = !y && !p && d >= 3 && c > 0 && h === "daily" && (c <= 1 || c / d <= .2);
    const I = !p && !y && m > 0 && h === "monthly" && (f <= 2 || f / m <= .15);
    const L = E >= 3 && !x && v === 1;
    let b = "";
    let T = "";
    let k = "";
    if (p) {
      b = "monthly";
      T = "Monthly limit reached";
      const e = formatQuotaUnlockWhen(t?.monthly?.resets_at || s.monthly_resets_at);
      k = e ? `New uploads unlock ${e}.` : "New uploads unlock when your plan renews.";
    } else if (y) {
      b = "daily";
      const e = t?.daily?.resets_at || s.daily_resets_at || s.resets_at;
      const n = resolveDailyUnlockLabel(e);
      if (f > 0) {
        T = g === "free" ? "Used your free upload" : "Used today's uploads";
        k = n ? `Next upload unlocks ${n}.` : "Next upload unlocks tomorrow.";
      } else {
        T = g === "free" ? "Free upload used" : "Daily limit reached";
        k = n ? `Next upload unlocks ${n}.` : "Upgrade for more daily uploads.";
      }
    } else if (I) {
      b = "monthly-low";
      T = f === 1 ? "One upload left" : `${f} uploads left`;
      k = "Upgrade if you need more room this month.";
    } else if (M) {
      b = "daily-low";
      T = c === 1 ? "One upload left today" : `${c} uploads left today`;
      k = "Upgrade if you need more room today.";
    } else if (x) {
      b = "max-empty";
      T = "Max effort used up for today";
      const e = t?.max_effort?.resets_at || s.max_effort_resets_at;
      const n = formatQuotaUnlockWhen(e);
      k = n ? `Max effort unlocks again ${n}. You can still generate with Normal or Low.` : "You can still generate with Normal or Low.";
      if (readDismissedKind() === "max" || readDismissedKind() === "max-low") {
        clearQuotaDismiss();
      }
      if (u === "max") {
        const e = allowedEffortsForTier(g).includes("normal") ? "normal" : "low";
        setEffort(e, {
          persist: true,
          closeFlyout: false
        });
      }
    } else if (L) {
      b = "max-low";
      T = "One Max effort left today";
      k = "After this, Solis falls back to Normal so you can keep creating.";
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
    r.textContent = T;
    i.textContent = k;
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
      E = await n.json();
      return E;
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
    const d = `${c} Plan`;
    g = l;
    u = resolveEffortForTier(l);
    if (!m) m = readEffortSelection();
    t.dataset.tier = l;
    t.dataset.effort = isAutoMode() ? "auto" : u;
    t.dataset.effortSelection = m;
    const f = getPopover();
    if (f) {
      f.dataset.tier = l;
      f.dataset.effort = isAutoMode() ? "auto" : u;
      f.dataset.effortSelection = m;
    }
    n.textContent = d;
    if (o) o.textContent = d;
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(e, E);
    const p = e?.generations;
    const y = document.getElementById("planPopoverKicker");
    if (p && r) {
      const e = formatQuotaChipDisplay(parseQuotaState(E, p), E, p, l);
      r.innerHTML = e.countHtml;
      if (y) y.textContent = e.kicker || "uploads left";
      if (i) {
        i.style.width = `${Math.min(100, e.progressPct || 0)}%`;
      }
      if (a) {
        const t = e.resetLine || formatResetLabel(p);
        a.textContent = t;
        a.hidden = !t;
      }
    } else if (r) {
      r.textContent = "—";
      if (y) y.textContent = "uploads left";
      if (i) i.style.width = "0%";
      if (a) {
        a.textContent = "";
        a.hidden = true;
      }
    }
    if (s) {
      const e = [ "basic", "prime", "elite", "pro" ].includes(l);
      const t = typeof readSolisEverGenerated === "function" && readSolisEverGenerated() || Math.max(0, Number(p?.used_lifetime ?? p?.used_today ?? p?.used_this_month ?? 0)) > 0 || freeTenureDays() >= I;
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
  let b = null;
  function getPopover() {
    return document.getElementById("planSelectorPopover");
  }
  function mountPopover() {
    const e = document.getElementById("planSelectorWrap");
    const t = getPopover();
    if (!e || !t || t.parentElement === document.body) return;
    b = e;
    document.body.appendChild(t);
  }
  function unmountPopover() {
    const e = getPopover();
    if (!e || !b || e.parentElement !== document.body) return;
    b.appendChild(e);
    b = null;
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
    if (y && !o) positionEffortFlyoutSide();
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
    if (c) {
      applyTierToUI(c);
    } else {
      setLoadingState(true);
    }
    if (!isCacheFresh()) {
      fetchTierInfo(false).then(applyTierToUI).catch(() => {
        if (c) return;
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
  function openMultiTaskUpgrade() {
    try {
      if (typeof window.closePlanSelectorPopover === "function") {
        window.closePlanSelectorPopover(true);
      }
    } catch (e) {}
    try {
      if (typeof window.clipsStudio?.openWatermarkPlanPopover === "function") {
        window.clipsStudio.openWatermarkPlanPopover({
          reason: "multitask"
        });
        return;
      }
    } catch (e) {}
    window.location.href = "/premium.html?plan=prime";
  }
  function onPopoverClick(e) {
    const t = e.target.closest("#planMultiTaskToggle");
    const n = e.target.closest("#planMultiTaskRow");
    if (t || n) {
      e.preventDefault();
      e.stopPropagation();
      if (!multiTaskAllowedForTier(g)) {
        openMultiTaskUpgrade();
        return;
      }
      setMultiTaskEnabled(!p);
      return;
    }
    const o = e.target.closest("#planEffortAdvancedToggle");
    if (o) {
      e.preventDefault();
      e.stopPropagation();
      setEffortSelection(isAutoMode() ? "advanced" : "auto");
      return;
    }
    if (e.target.closest("#planEffortSlider") || e.target.closest("#planEffortSliderPanel")) {
      e.stopPropagation();
      return;
    }
    const r = e.target.closest("#planEffortTrigger");
    if (r) {
      e.preventDefault();
      e.stopPropagation();
      if (isAutoMode()) setEffortSelection("advanced");
      toggleEffortControl();
      return;
    }
    const i = e.target.closest(".plan-effort-option");
    if (!i) return;
    e.preventDefault();
    e.stopPropagation();
    const a = i.dataset.effort;
    if (!isEffortSelectable(a)) {
      notifyEffortLocked(a);
      return;
    }
    setEffort(a, {
      animate: false
    });
    if (c) syncQuotaRail(c, E);
  }
  function initPlanSelector() {
    const e = document.getElementById("planSelectorWrap");
    const t = document.getElementById("planSelectorBtn");
    if (!e || !t) return;
    m = readEffortSelection();
    p = readMultiTaskEnabled();
    u = resolveEffortForTier(g);
    applyEffortUiMode(readEffortUiMode(), {
      persist: false,
      animate: false
    });
    syncAdvancedModeUI({
      animate: false
    });
    syncMultiTaskUI();
    syncEffortUI();
    syncQuotaRail(c, E);
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
      if (y) {
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
      g = "free";
      u = "low";
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
    if (e) E = e;
    if (c) syncQuotaRail(c, E);
  };
  window.closePlanSelectorPopover = function closePlanSelectorPopover(e = true) {
    closePopover({
      immediate: Boolean(e)
    });
  };
  window.getSelectedEffortMode = function getSelectedEffortMode() {
    return isAutoMode() ? "auto" : u;
  };
  window.isMultiTaskEnabled = function isMultiTaskEnabled() {
    return multiTaskAllowedForTier(g) && !!p;
  };
  window.getMultiTaskBatchMax = function getMultiTaskBatchMax() {
    if (!multiTaskAllowedForTier(g)) return 1;
    return g === "elite" ? 5 : 3;
  };
  window.getCurrentPlanTier = function getCurrentPlanTier() {
    return g || "free";
  };
  window.setMultiTaskEnabled = function setMultiTaskEnabledPublic(e) {
    return setMultiTaskEnabled(!!e);
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
    if (c) syncQuotaRail(c, E);
    return t;
  };
  window.getEffortUiMode = function getEffortUiMode() {
    return h;
  };
  window.setEffortUiMode = function setEffortUiMode(e) {
    applyEffortUiMode(e);
    return h;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPlanSelector();
      enrichQuotaFromStatus().then(() => {
        if (c) syncQuotaRail(c, E);
      });
    });
  } else {
    initPlanSelector();
    enrichQuotaFromStatus().then(() => {
      if (c) syncQuotaRail(c, E);
    });
  }
})();
