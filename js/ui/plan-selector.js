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
  const o = "solis_effort_mode";
  const n = "solis_effort_selection";
  const r = "solis_effort_ui_mode";
  const i = "solis_quota_rail_dismiss";
  const a = 6e4;
  const s = [ "low", "normal", "max" ];
  let l = null;
  let f = 0;
  let c = null;
  let d = "low";
  let u = "auto";
  let m = "free";
  let p = false;
  let g = "slider";
  let y = null;
  let h = false;
  function isAutoMode() {
    return u !== "advanced";
  }
  function readEffortSelection() {
    try {
      const e = localStorage.getItem(n);
      if (e === "advanced" || e === "auto") return e;
    } catch (e) {}
    return "auto";
  }
  function persistEffortSelection(e) {
    try {
      localStorage.setItem(n, e === "advanced" ? "advanced" : "auto");
    } catch (e) {}
  }
  let E = 0;
  const w = 380;
  function setEffortSelection(e, {persist: t = true, animate: o = true} = {}) {
    u = e === "advanced" ? "advanced" : "auto";
    if (t) persistEffortSelection(u);
    syncAdvancedModeUI({
      animate: o
    });
    syncEffortUI();
    if (l) syncQuotaRail(l, y);
  }
  function setAdvancedBodyVisible(e, {animate: t = true} = {}) {
    const o = document.getElementById("planEffortAdvancedBody");
    if (!o) return;
    window.clearTimeout(E);
    const n = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = t && !n;
    if (e) {
      o.hidden = false;
      o.setAttribute("aria-hidden", "false");
      if (r) {
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
      if (r && !o.hidden) {
        E = window.setTimeout(() => {
          o.hidden = true;
        }, w);
      } else {
        o.hidden = true;
      }
    }
  }
  function syncAdvancedModeUI(e = {}) {
    const t = e.animate !== false;
    const o = isAutoMode();
    const n = document.getElementById("planEffortAdvancedToggle");
    const r = document.getElementById("planEffortModeTitle");
    const i = document.getElementById("planEffortModeHint");
    const a = document.getElementById("planEffortModeRow");
    if (n) {
      n.setAttribute("aria-checked", o ? "true" : "false");
      n.classList.toggle("is-on", o);
      n.setAttribute("aria-label", "Auto Mode");
    }
    setAdvancedBodyVisible(!o, {
      animate: t
    });
    if (r) r.textContent = "Auto";
    if (i) {
      if (o) {
        i.textContent = m === "free" ? "Free plan always uses Low effort" : "Balanced quality and speed, recommended for most tasks";
        requestAnimationFrame(() => i.classList.remove("is-collapsed"));
      } else {
        i.classList.add("is-collapsed");
      }
    }
    if (a) a.dataset.mode = o ? "auto" : "manual";
    applyEffortUiMode(g, {
      persist: false,
      animate: t
    });
    if (o) closeEffortFlyout();
  }
  function isCacheFresh() {
    return l && Date.now() - f < a;
  }
  function invalidateTierCache() {
    l = null;
    f = 0;
    c = null;
  }
  function formatResetLabel(e) {
    if (!e) return "";
    const t = e.max_per_period ?? e.max_per_day ?? 0;
    const o = e.reset_hours ?? 24;
    if (o > 24) {
      const e = Math.round(o / 24);
      return e === 1 ? "Resets every day" : `Resets every ${e} days`;
    }
    return t === 1 ? "1 generation per day" : `${t} generations per day`;
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
      const e = localStorage.getItem(o);
      if (e && t[e]) return e;
    } catch (e) {}
    return null;
  }
  function persistEffort(e) {
    try {
      localStorage.setItem(o, e);
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
      const o = e.max_effort_remaining;
      if (t > 0 && typeof o === "number" && o <= 0) return false;
    }
    return true;
  }
  function pulseEffortProBadge(e) {
    const t = effortIndex(e);
    const o = document.querySelector(`.plan-effort-slider-pro[data-step="${t}"]`);
    const n = document.querySelector(`.plan-effort-option[data-effort="${e}"] .plan-effort-pro-badge`);
    const r = o && !o.hasAttribute("hidden") ? o : n && !n.hasAttribute("hidden") ? n : null;
    if (!r) return;
    r.classList.remove("is-pulse");
    void r.offsetWidth;
    r.classList.add("is-pulse");
    window.setTimeout(() => r.classList.remove("is-pulse"), 560);
  }
  function notifyEffortLocked(e) {
    if (e === "max") {
      const t = l?.generations || {};
      const o = t.max_effort_per_day ?? 0;
      const n = t.max_effort_remaining;
      if (o > 0 && typeof n === "number" && n <= 0) {
        if (typeof showNotification === "function") {
          showNotification(`Max daily limit reached (${o}/day). Use Normal effort.`, "info");
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
  function applyEffortUiMode(e, {persist: t = true, animate: o = true} = {}) {
    const n = e === "slider" ? "slider" : "flyout";
    const r = g !== n || document.documentElement.dataset.effortUi !== n;
    const i = !isAutoMode();
    if (r && n === "slider") closeEffortFlyout();
    g = n;
    document.documentElement.dataset.effortUi = n;
    if (t) persistEffortUiMode(n);
    const a = getEffortTrigger();
    const s = getSliderPanel();
    if (a) {
      a.hidden = !i || n === "slider";
      a.setAttribute("aria-controls", "planEffortFlyout");
      if (!i || n === "slider") a.setAttribute("aria-expanded", "false");
    }
    if (s) {
      if (i && n === "slider") {
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
  function resolveEffortForTier(e) {
    const t = allowedEffortsForTier(e);
    const o = readStoredEffort();
    if (o && t.includes(o)) return o;
    return defaultEffortForTier(e);
  }
  function setEffort(e, {persist: t = true, closeFlyout: o = true, animate: n = false} = {}) {
    if (!isEffortSelectable(e)) return false;
    d = e;
    if (t) persistEffort(e);
    syncEffortUI({
      animate: n
    });
    if (o && g === "flyout") closeEffortFlyout();
    return true;
  }
  function setSliderT(e, {animate: t = false, magnet: o = false} = {}) {
    const n = document.getElementById("planEffortSlider");
    if (!n) return;
    const r = Math.max(0, Math.min(1, e));
    n.style.setProperty("--effort-t", String(r));
    n.classList.toggle("is-max", r >= .98);
    window.clearTimeout(setSliderT._snapTimer);
    n.classList.toggle("is-snapping", t);
    n.classList.toggle("is-magnet", o && !t);
    if (t || o) {
      setSliderT._snapTimer = window.setTimeout(() => {
        n.classList.remove("is-snapping", "is-magnet");
      }, t ? 280 : 200);
    } else {
      n.classList.remove("is-snapping", "is-magnet");
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
    const o = t.getBoundingClientRect();
    const n = 18;
    const r = Math.max(1, o.width - n);
    return Math.max(0, Math.min(1, (e - o.left - n / 2) / r));
  }
  function magnetizeT(e) {
    const t = s.length - 1;
    const o = .16;
    let n = e;
    let r = o;
    let i = false;
    for (let o = 0; o <= t; o += 1) {
      if (!isEffortSelectable(effortFromIndex(o))) continue;
      const a = o / t;
      const s = Math.abs(e - a);
      if (s <= r) {
        r = s;
        n = a;
        i = true;
      }
    }
    return {
      t: n,
      snapped: i,
      index: Math.round(n * t)
    };
  }
  function nearestAllowedIndex(e) {
    const t = s.length - 1;
    let o = null;
    let n = Infinity;
    for (let r = 0; r <= t; r += 1) {
      if (!isEffortSelectable(effortFromIndex(r))) continue;
      const t = Math.abs(r - e);
      if (t < n) {
        n = t;
        o = r;
      }
    }
    return o == null ? 0 : o;
  }
  function syncEffortSliderUI({animate: e = false} = {}) {
    const o = effortIndex(d);
    const n = t[d] || "Low";
    const r = o / (s.length - 1);
    const i = allowedEffortsForTier(m);
    const a = document.getElementById("planEffortSlider");
    const l = document.getElementById("planEffortSliderValue");
    const f = document.getElementById("planEffortSliderPanel");
    if (!h) setSliderT(r, {
      animate: e
    });
    if (l) l.textContent = n;
    if (a) {
      a.setAttribute("aria-valuenow", String(o));
      a.setAttribute("aria-valuetext", n);
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
    if (f) {
      f.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        const t = Number(e.dataset.step || 0);
        const n = effortFromIndex(t);
        const l = h ? Math.round((Number(a?.style.getPropertyValue("--effort-t")) || r) * (s.length - 1)) : o;
        e.classList.toggle("is-passed", t <= l);
        e.classList.toggle("is-locked", !i.includes(n));
      });
      f.querySelectorAll(".plan-effort-slider-pro").forEach(e => {
        const t = Number(e.dataset.step || 0);
        const o = effortFromIndex(t);
        if (!i.includes(o)) e.removeAttribute("hidden"); else e.setAttribute("hidden", "");
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
    const o = isAutoMode() ? "auto" : d;
    const n = t[o] || "Auto";
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
      i.dataset.effort = o;
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
    const f = document.getElementById("planSelectorBtn");
    if (f) {
      const e = r?.textContent?.trim() || "Plan";
      const t = isCompactPlanUi();
      f.setAttribute("aria-label", t ? `${n}. ${e} usage` : `${e}, ${n}`);
    }
    const c = document.getElementById("planEffortTriggerValue");
    if (c) c.textContent = t[d] || "Low";
    if (!isAutoMode()) {
      syncEffortSliderUI(e);
    }
    const u = document.getElementById("planEffortFlyout");
    if (!u) return;
    const p = allowedEffortsForTier(m);
    u.querySelectorAll(".plan-effort-option").forEach(e => {
      const t = e.dataset.effort;
      const o = p.includes(t);
      const n = t === d;
      const r = e.querySelector(".plan-effort-pro-badge");
      const i = e.querySelector(".plan-effort-option-hint");
      e.classList.toggle("is-locked", !o);
      e.classList.toggle("is-active", n);
      e.setAttribute("aria-checked", n ? "true" : "false");
      if (r) {
        if (!o) r.removeAttribute("hidden"); else r.setAttribute("hidden", "");
      }
      if (i) {
        i.hidden = !o;
      }
      if (o && t === "max") {
        const t = l?.generations || {};
        const o = t.max_effort_per_day ?? 0;
        const n = t.max_effort_remaining;
        if (o > 0 && typeof n === "number") {
          e.title = `Max — ${n}/${o} left today`;
          if (n <= 0) {
            e.classList.add("is-locked");
            e.title = `Max daily limit reached (${o}/day)`;
          }
        } else {
          e.title = "Max — best interesting moments + cleaner cuts";
        }
      } else {
        e.title = o ? t === "normal" ? "Normal — balanced speed and quality" : "Low — fast, smart picks, low compute" : t === "max" ? "Max effort requires Prime or Elite" : t === "normal" ? "Normal effort requires Basic or higher" : "Locked on your plan";
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
    const o = 176;
    const n = window.innerWidth - t.right;
    const r = n < o + 16 && t.left > o + 16;
    e.classList.toggle("effort-open-left", r);
  }
  function openEffortFlyout() {
    if (g === "slider") return;
    const e = getPopover();
    const t = getFlyout();
    const o = getEffortTrigger();
    if (!e || !t || !o) return;
    p = true;
    t.hidden = false;
    positionEffortFlyoutSide();
    requestAnimationFrame(() => {
      e.classList.add("effort-open");
      t.classList.add("is-open");
    });
    o.setAttribute("aria-expanded", "true");
    syncEffortUI();
  }
  function closeEffortFlyout() {
    const e = getPopover();
    const t = getFlyout();
    const o = getEffortTrigger();
    if (!e || !t) return;
    p = false;
    e.classList.remove("effort-open", "effort-open-left");
    t.classList.remove("is-open");
    if (o) o.setAttribute("aria-expanded", "false");
    const finish = () => {
      if (!p) t.hidden = true;
      t.removeEventListener("transitionend", finish);
    };
    t.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function toggleEffortControl() {
    if (g === "slider") return;
    if (p) closeEffortFlyout(); else openEffortFlyout();
  }
  function trySelectEffortFromSlider(e, {animate: t = true} = {}) {
    const o = effortFromIndex(e);
    const n = nearestAllowedIndex(e);
    const r = effortFromIndex(n);
    if (o !== r) notifyEffortLocked(o);
    return setEffort(r, {
      closeFlyout: false,
      animate: t
    });
  }
  function bindEffortSliderInteractions() {
    const e = document.getElementById("planEffortSlider");
    if (!e || e.dataset.bound === "true") return;
    e.dataset.bound = "true";
    const o = document.getElementById("planEffortSliderValue");
    let n = null;
    let r = null;
    const previewFromT = n => {
      const i = magnetizeT(n);
      const a = i.snapped;
      const l = i.t;
      const f = i.index;
      clearMaxBits();
      if (a && r !== f) {
        setSliderT(l, {
          magnet: true
        });
      } else if (a) {
        setSliderT(l, {
          animate: false
        });
      } else {
        r = null;
        setSliderT(n, {
          animate: false
        });
      }
      if (a) r = f;
      const c = t[effortFromIndex(f)] || "Low";
      if (o) o.textContent = c;
      e.classList.toggle("is-max", f === s.length - 1 && isEffortSelectable("max"));
      const d = document.getElementById("planEffortSliderPanel");
      d?.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        const t = Number(e.dataset.step || 0);
        e.classList.toggle("is-passed", t <= f);
        e.classList.toggle("is-magnet-hot", a && t === f);
      });
    };
    const finishDrag = t => {
      const o = magnetizeT(clientXToSliderT(t));
      h = false;
      r = null;
      e.classList.remove("is-dragging");
      e.querySelectorAll(".plan-effort-slider-dot").forEach(e => {
        e.classList.remove("is-magnet-hot");
      });
      trySelectEffortFromSlider(o.index, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, y);
    };
    e.addEventListener("pointerdown", t => {
      if (t.button != null && t.button !== 0) return;
      t.preventDefault();
      t.stopPropagation();
      n = t.pointerId;
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
      if (!h || e.pointerId !== n) return;
      e.preventDefault();
      previewFromT(clientXToSliderT(e.clientX));
    });
    const endPointer = t => {
      if (!h || n != null && t.pointerId !== n) return;
      t.preventDefault();
      t.stopPropagation();
      const o = t.clientX;
      n = null;
      try {
        e.releasePointerCapture(t.pointerId);
      } catch (e) {}
      finishDrag(o);
    };
    e.addEventListener("pointerup", endPointer);
    e.addEventListener("pointercancel", endPointer);
    e.addEventListener("keydown", e => {
      const t = effortIndex(d);
      let o = t;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") o = t + 1; else if (e.key === "ArrowLeft" || e.key === "ArrowDown") o = t - 1; else if (e.key === "Home") o = 0; else if (e.key === "End") o = s.length - 1; else return;
      e.preventDefault();
      trySelectEffortFromSlider(o, {
        animate: true
      });
      syncMaxBits();
      if (l) syncQuotaRail(l, y);
    });
  }
  async function fetchTierInfo(e = false) {
    if (!e && isCacheFresh()) return l;
    if (!e && c) return c;
    c = (async () => {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/tier/info") : `${window.API_BASE_URL || "https://api.solisai.video/api"}/tier/info`;
      const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const o = await fetch(e, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (!o.ok) throw new Error(`tier/info ${o.status}`);
      const n = await o.json();
      if (!n?.data) throw new Error("Invalid tier response");
      l = n.data;
      f = Date.now();
      const r = l.library || l.saved_videos;
      if (r && typeof window.applyStorageBadgeUI === "function") {
        window.applyStorageBadgeUI({
          used: r.used ?? 0,
          limit: r.limit ?? r.max_videos ?? 2,
          plan: l.tier || "free"
        });
      }
      return l;
    })().finally(() => {
      c = null;
    });
    return c;
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
  function formatQuotaUnlockWhen(e) {
    if (!e) return "";
    const t = String(e).trim();
    const o = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : t.replace(" ", "T");
    const n = new Date(o);
    if (Number.isNaN(n.getTime())) return "";
    const r = new Date;
    const i = n.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const a = n.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    const s = new Date(r.getFullYear(), r.getMonth(), r.getDate());
    const l = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const f = Math.round((l - s) / 864e5);
    if (f === 0) return `today at ${i}`;
    if (f === 1) return `tomorrow at ${i}`;
    return `${a} at ${i}`;
  }
  function syncQuotaRail(e, t) {
    const o = document.getElementById("urlQuotaRail");
    const n = document.getElementById("urlQuotaBanner");
    const r = document.getElementById("urlQuotaTitle");
    const i = document.getElementById("urlQuotaSub");
    const a = document.getElementById("urlInputStack");
    if (!o || !n || !r || !i) return;
    const s = e?.generations || {};
    const l = Math.max(0, Number(t?.daily?.remaining ?? s.remaining ?? 0));
    const f = Math.max(0, Number(t?.daily?.limit ?? s.max_per_period ?? s.max_per_day ?? 0));
    const c = Math.max(0, Number(t?.monthly?.remaining ?? s.remaining_month ?? 0));
    const u = Math.max(0, Number(t?.monthly?.limit ?? s.max_per_month ?? 0));
    const p = Math.max(0, Number(t?.max_effort?.limit ?? s.max_effort_per_day ?? 0));
    const g = t?.max_effort?.remaining ?? s.max_effort_remaining;
    const y = Math.max(0, Number(g ?? 0));
    const h = t?.max_effort?.can_use ?? s.can_use_max_effort;
    const E = p > 0 && (y <= 0 || h === false);
    const w = f > 0 && l <= 0 || t?.daily_limit_reached === true || t?.block_reason === "daily_limit";
    const v = u > 0 && c <= 0;
    const S = f >= 3 && l > 0 && (l <= 1 || l / f <= .2);
    const x = p >= 3 && !E && y === 1;
    let I = "";
    let L = "";
    let M = "";
    if (w) {
      I = "daily";
      const e = Math.max(1, f || 1);
      L = m === "free" ? `Free plan · 0 of ${e} clip${e === 1 ? "" : "s"} left today` : `Daily quota reached · 0 of ${f || e} clips left`;
      const o = formatQuotaUnlockWhen(t?.daily?.resets_at || s.daily_resets_at || s.resets_at);
      M = m === "free" ? o ? `You’ve used your free generation for today (1 clip). Your next clip unlocks ${o}. Upgrade anytime for more daily clips and deeper effort modes.` : "You’ve used your free generation for today (1 clip). Upgrade for more daily clips, or wait 24h after you started generating." : o ? `You’re out of daily generations. Your next clips unlock ${o}. Upgrade if you need a higher daily quota.` : "You’re out of daily generations. Upgrade for a higher daily quota, or wait 24h after you started generating.";
    } else if (v) {
      I = "monthly";
      L = `Monthly quota reached · 0 of ${u} clips left`;
      const e = formatQuotaUnlockWhen(t?.monthly?.resets_at || s.monthly_resets_at);
      M = e ? `You’ve used this period’s monthly quota. New clips unlock ${e}.` : "You’ve used this period’s monthly quota. New clips unlock when your plan renews.";
    } else if (S) {
      I = "daily-low";
      L = `Running low · ${l} of ${f} clips left today`;
      M = l === 1 ? "This is your last clip for today. After you use it, generation pauses until reset — or upgrade for more headroom so you don’t hit the wall mid-session." : `Only ${l} generations remain today. When you hit zero, Solis pauses new clips until your quota resets. Upgrade anytime if you need more room.`;
    } else if (E) {
      I = "max-empty";
      L = `Max effort used up · 0 of ${p} left today`;
      const e = t?.max_effort?.resets_at || s.max_effort_resets_at;
      const o = formatQuotaUnlockWhen(e);
      M = o ? `You’ve used all Max effort slots for today. Max unlocks again ${o}. You can still generate with Normal or Low — Solis won’t block the rest of your plan.` : "You’ve used all Max effort slots for today. You can still generate with Normal or Low — Solis won’t block the rest of your plan.";
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
    } else if (x) {
      I = "max-low";
      L = `Max effort running low · 1 of ${p} left today`;
      M = "You have one Max generation left. After that, Solis automatically falls back to Normal so you can keep creating without interruption.";
    } else {
      o.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    if (readDismissedKind() === I) {
      o.hidden = true;
      if (a) a.classList.remove("has-quota");
      return;
    }
    n.dataset.kind = I;
    r.textContent = L;
    i.textContent = M;
    o.hidden = false;
    if (a) a.classList.add("has-quota");
  }
  async function enrichQuotaFromStatus() {
    try {
      const e = typeof window.apiUrl === "function" ? window.apiUrl("/api/clips/status") : `${window.API_BASE_URL || "/api"}/clips/status`;
      const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const o = await fetch(e, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (!o.ok) return null;
      y = await o.json();
      return y;
    } catch (e) {
      return null;
    }
  }
  function applyTierToUI(e) {
    const t = document.getElementById("planSelectorWrap");
    const o = document.getElementById("planSelectorLabel");
    const n = document.getElementById("planPopoverTier");
    const r = document.getElementById("planPopoverCount");
    const i = document.getElementById("planPopoverProgress");
    const a = document.getElementById("planPopoverReset");
    const s = document.getElementById("planPopoverUpgrade");
    if (!t || !o) return;
    const l = (e?.tier || "free").toLowerCase();
    const f = e?.tier_name || l.charAt(0).toUpperCase() + l.slice(1);
    const c = `${f} Plan`;
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
    o.textContent = c;
    if (n) n.textContent = c;
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(e, y);
    const g = e?.generations;
    if (g && r) {
      const e = Math.max(0, g.remaining ?? 0);
      const t = Math.max(1, g.max_per_period ?? g.max_per_day ?? 1);
      r.innerHTML = `<span class="plan-count-remaining">${e}</span>` + `<span class="plan-count-sep"> / ${t}</span>`;
      if (i) {
        const o = Math.max(0, g.used_today ?? t - e);
        i.style.width = `${Math.min(100, o / t * 100)}%`;
      }
    } else if (r) {
      r.textContent = "—";
      if (i) i.style.width = "0%";
    }
    if (a) a.textContent = formatResetLabel(g);
    if (s) {
      const e = Math.max(0, Number(g?.used_lifetime ?? g?.used_today ?? 0));
      const t = [ "basic", "prime", "elite" ].includes(l);
      const o = l === "free" && e < 1;
      s.classList.toggle("hidden", t || o);
    }
    clearLoadingState();
  }
  function setLoadingState(e = true) {
    const t = document.getElementById("planSelectorWrap");
    const o = document.getElementById("planSelectorBtn");
    const n = getPopover();
    if (t) t.classList.toggle("is-loading", !!e);
    if (n) n.classList.toggle("is-loading", !!e);
    if (o) o.setAttribute("aria-busy", e ? "true" : "false");
  }
  function clearLoadingState() {
    setLoadingState(false);
  }
  function getInputContainer() {
    return document.querySelector(".url-input-container");
  }
  let v = null;
  let S = null;
  function getPopover() {
    return document.getElementById("planSelectorPopover");
  }
  function mountPopover() {
    const e = document.getElementById("planSelectorWrap");
    const t = getPopover();
    if (!e || !t || t.parentElement === document.body) return;
    S = e;
    document.body.appendChild(t);
  }
  function unmountPopover() {
    const e = getPopover();
    if (!e || !S || e.parentElement !== document.body) return;
    S.appendChild(e);
    S = null;
  }
  function positionPopover() {
    const e = document.getElementById("planSelectorBtn");
    const t = getPopover();
    if (!e || !t || t.hidden) return;
    const o = e.getBoundingClientRect();
    const n = isCompactPlanUi();
    const r = n ? 10 : 12;
    const i = n ? Math.min(360, window.innerWidth - r * 2) : Math.min(268, window.innerWidth - 48);
    const a = i;
    let s;
    if (n) {
      s = Math.max(r, Math.round((window.innerWidth - a) / 2));
    } else {
      s = Math.max(r, o.right - a);
      s = Math.min(s, window.innerWidth - a - r);
    }
    let l = o.bottom + (n ? 12 : 10);
    const f = t.offsetHeight || (n ? 320 : 260);
    if (l + f > window.innerHeight - r) {
      l = Math.max(r, o.top - f - 10);
    }
    t.style.top = `${l}px`;
    t.style.left = `${s}px`;
    t.style.width = `${a}px`;
    t.style.right = "auto";
    if (p && !n) positionEffortFlyoutSide();
  }
  function bindReposition() {
    if (v) return;
    let e = isCompactPlanUi();
    v = () => {
      positionPopover();
      const t = isCompactPlanUi();
      if (t !== e) {
        e = t;
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
    const e = document.getElementById("planSelectorWrap");
    const t = document.getElementById("planSelectorBtn");
    const o = getPopover();
    const n = getInputContainer();
    if (!e || !t || !o) return;
    mountPopover();
    o.hidden = false;
    t.setAttribute("aria-expanded", "true");
    positionPopover();
    requestAnimationFrame(() => {
      e.classList.add("is-open");
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
        const e = document.getElementById("planPopoverReset");
        const t = document.getElementById("planPopoverCount");
        if (t) t.textContent = "—";
        if (e) e.textContent = "Could not load usage";
      });
    }
  }
  function closePopover(e = {}) {
    const t = Boolean(e.immediate);
    const o = document.getElementById("planSelectorWrap");
    const n = document.getElementById("planSelectorBtn");
    const r = getPopover();
    const i = getInputContainer();
    if (!o || !n || !r) return;
    if (r.hidden && !o.classList.contains("is-open") && !r.classList.contains("is-open")) {
      return;
    }
    closeEffortFlyout();
    o.classList.remove("is-open");
    r.classList.remove("is-open");
    if (i) i.classList.remove("is-open");
    n.setAttribute("aria-expanded", "false");
    unbindReposition();
    const finish = () => {
      if (!o.classList.contains("is-open")) {
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
    const o = e.target.closest("#planEffortTrigger");
    if (o) {
      e.preventDefault();
      e.stopPropagation();
      if (isAutoMode()) setEffortSelection("advanced");
      toggleEffortControl();
      return;
    }
    const n = e.target.closest(".plan-effort-option");
    if (!n) return;
    e.preventDefault();
    e.stopPropagation();
    const r = n.dataset.effort;
    if (!isEffortSelectable(r)) {
      notifyEffortLocked(r);
      return;
    }
    setEffort(r, {
      animate: false
    });
    if (l) syncQuotaRail(l, y);
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
    syncQuotaRail(l, y);
    bindEffortSliderInteractions();
    try {
      const e = window.matchMedia("(max-width: 768px)");
      const onMq = () => syncEffortUI({
        animate: false
      });
      if (e.addEventListener) e.addEventListener("change", onMq); else if (e.addListener) e.addListener(onMq);
    } catch (e) {}
    const o = document.getElementById("urlQuotaClose");
    if (o && !o.dataset.bound) {
      o.dataset.bound = "true";
      o.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        const t = document.getElementById("urlQuotaBanner");
        const o = t?.dataset?.kind || "";
        dismissQuotaKind(o);
        const n = document.getElementById("urlQuotaRail");
        const r = document.getElementById("urlInputStack");
        if (n) n.hidden = true;
        if (r) r.classList.remove("has-quota");
      });
    }
    t.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      togglePopover();
    });
    const n = getPopover();
    if (n) {
      n.addEventListener("click", onPopoverClick);
    }
    document.addEventListener("click", t => {
      const o = getPopover();
      if (e.contains(t.target) || o?.contains(t.target)) return;
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
    if (e) y = e;
    if (l) syncQuotaRail(l, y);
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
    if (l) syncQuotaRail(l, y);
    return t;
  };
  window.getEffortUiMode = function getEffortUiMode() {
    return g;
  };
  window.setEffortUiMode = function setEffortUiMode(e) {
    applyEffortUiMode(e);
    return g;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPlanSelector();
      enrichQuotaFromStatus().then(() => {
        if (l) syncQuotaRail(l, y);
      });
    });
  } else {
    initPlanSelector();
    enrichQuotaFromStatus().then(() => {
      if (l) syncQuotaRail(l, y);
    });
  }
})();
