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
  const s = 6e4;
  const a = [ "low", "normal", "max" ];
  let l = null;
  let c = 0;
  let f = null;
  let d = "low";
  let u = "auto";
  let m = "free";
  let y = false;
  let p = "slider";
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
    const o = document.getElementById("i1y9");
    if (!o) return;
    window.clearTimeout(E);
    const n = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const i = e && !n;
    if (t) {
      o.hidden = false;
      o.setAttribute("aria-hidden", "false");
      if (i) {
        o.classList.remove("ci8");
        void o.offsetHeight;
        requestAnimationFrame(() => {
          o.classList.add("ci8");
        });
      } else {
        o.classList.add("ci8");
      }
    } else {
      o.setAttribute("aria-hidden", "true");
      o.classList.remove("ci8");
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
    const n = document.getElementById("i1ya");
    const i = document.getElementById("i1ye");
    const r = document.getElementById("i1yc");
    const s = document.getElementById("i1yd");
    if (n) {
      n.setAttribute("aria-checked", o ? "true" : "false");
      n.classList.toggle("cic", o);
      n.setAttribute("aria-label", "Auto Mode");
    }
    setAdvancedBodyVisible(!o, {
      animate: e
    });
    if (i) i.textContent = "Auto";
    if (r) {
      if (o) {
        r.textContent = m === "free" ? "Free plan always uses Low effort" : "Balanced quality and speed, recommended for most tasks";
        requestAnimationFrame(() => r.classList.remove("is-collapsed"));
      } else {
        r.classList.add("is-collapsed");
      }
    }
    if (s) s.dataset.mode = o ? "auto" : "manual";
    applyEffortUiMode(p, {
      persist: false,
      animate: e
    });
    if (o) closeEffortFlyout();
  }
  function isCacheFresh() {
    return l && Date.now() - c < s;
  }
  function invalidateTierCache() {
    l = null;
    c = 0;
    f = null;
  }
  function formatResetLabel(t) {
    if (!t) return "";
    const e = t.max_per_period ?? t.max_per_day ?? 0;
    const o = t.reset_hours ?? 24;
    if (o > 24) {
      const t = Math.round(o / 24);
      return t === 1 ? "Resets every day" : `Resets every ${t} days`;
    }
    return e === 1 ? "1 generation per day" : `${e} generations per day`;
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
    const e = a.indexOf(t);
    return e >= 0 ? e : 0;
  }
  function effortFromIndex(t) {
    return a[Math.max(0, Math.min(a.length - 1, t))] || "low";
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
    const i = p !== n || document.documentElement.dataset.effortUi !== n;
    const r = !isAutoMode();
    if (i && n === "slider") closeEffortFlyout();
    p = n;
    document.documentElement.dataset.effortUi = n;
    if (e) persistEffortUiMode(n);
    const s = getEffortTrigger();
    const a = getSliderPanel();
    if (s) {
      s.hidden = !r || n === "slider";
      s.setAttribute("aria-controls", "planEffortFlyout");
      if (!r || n === "slider") s.setAttribute("aria-expanded", "false");
    }
    if (a) {
      if (r && n === "slider") {
        a.hidden = false;
        a.classList.remove("is-ready");
        const reveal = () => {
          a.classList.add("is-ready");
          syncEffortSliderUI();
        };
        if (o && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.setTimeout(reveal, 60);
        } else {
          reveal();
        }
      } else {
        a.classList.remove("is-ready");
        a.hidden = true;
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
    if (o && p === "flyout") closeEffortFlyout();
    return true;
  }
  function setSliderT(t, {animate: e = false, magnet: o = false} = {}) {
    const n = document.getElementById("i1yf");
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
    const t = document.getElementById("i1yf");
    if (!t) return;
    t.classList.remove("is-bits-live");
  }
  function playMaxBitsBurst() {
    const t = document.getElementById("i1yf");
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
    const e = document.getElementById("i1yj");
    if (!e) return 0;
    const o = e.getBoundingClientRect();
    const n = 18;
    const i = Math.max(1, o.width - n);
    return Math.max(0, Math.min(1, (t - o.left - n / 2) / i));
  }
  function magnetizeT(t) {
    const e = a.length - 1;
    const o = .16;
    let n = t;
    let i = o;
    let r = false;
    for (let o = 0; o <= e; o += 1) {
      if (!isEffortSelectable(effortFromIndex(o))) continue;
      const s = o / e;
      const a = Math.abs(t - s);
      if (a <= i) {
        i = a;
        n = s;
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
    const e = a.length - 1;
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
    const i = o / (a.length - 1);
    const r = allowedEffortsForTier(m);
    const s = document.getElementById("i1yf");
    const l = document.getElementById("i1yk");
    const c = document.getElementById("i1yh");
    if (!h) setSliderT(i, {
      animate: t
    });
    if (l) l.textContent = n;
    if (s) {
      s.setAttribute("aria-valuenow", String(o));
      s.setAttribute("aria-valuetext", n);
      s.classList.toggle("is-single", r.length <= 1);
      s.classList.toggle("is-max", d === "max");
    }
    if (!h) {
      if (d === "max") {
        if (!s?.classList.contains("is-bits-live")) playMaxBitsBurst();
      } else {
        clearMaxBits();
      }
    } else {
      clearMaxBits();
    }
    if (c) {
      c.querySelectorAll(".crl").forEach(t => {
        const e = Number(t.dataset.step || 0);
        const n = effortFromIndex(e);
        const l = h ? Math.round((Number(s?.style.getPropertyValue("--effort-t")) || i) * (a.length - 1)) : o;
        t.classList.toggle("is-passed", e <= l);
        t.classList.toggle("cib", !r.includes(n));
      });
      c.querySelectorAll(".cro").forEach(t => {
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
    const i = document.getElementById("i1yv");
    if (i) {
      i.removeAttribute("hidden");
      if (!i.textContent.trim()) {
        const t = (m || "free").charAt(0).toUpperCase() + (m || "free").slice(1);
        i.textContent = `${t} Plan`;
      }
    }
    const r = document.getElementById("i1yx");
    if (r) {
      r.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      r.dataset.effort = o;
    }
    const s = getPopover();
    if (s) {
      s.dataset.effortSelection = isAutoMode() ? "auto" : "advanced";
      s.dataset.effort = o;
    }
    const a = document.getElementById("i1yu");
    if (a) {
      a.textContent = n;
      a.dataset.effort = o;
    }
    const c = document.getElementById("i1yt");
    if (c) {
      const t = i?.textContent?.trim() || "Plan";
      const e = isCompactPlanUi();
      c.setAttribute("aria-label", e ? `${n}. ${t} usage` : `${t}, ${n}`);
    }
    const f = document.getElementById("i1yn");
    if (f) f.textContent = e[d] || "Low";
    if (!isAutoMode()) {
      syncEffortSliderUI(t);
    }
    const u = document.getElementById("i1yb");
    if (!u) return;
    const y = allowedEffortsForTier(m);
    u.querySelectorAll(".cre").forEach(t => {
      const e = t.dataset.effort;
      const o = y.includes(e);
      const n = e === d;
      const i = t.querySelector(".crh");
      const r = t.querySelector(".crf");
      t.classList.toggle("cib", !o);
      t.classList.toggle("ci6", n);
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
            t.classList.add("cib");
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
    return document.getElementById("i1yb");
  }
  function getSliderPanel() {
    return document.getElementById("i1yh");
  }
  function getEffortTrigger() {
    return document.getElementById("i1ym");
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
    if (p === "slider") return;
    const t = getPopover();
    const e = getFlyout();
    const o = getEffortTrigger();
    if (!t || !e || !o) return;
    y = true;
    e.hidden = false;
    positionEffortFlyoutSide();
    requestAnimationFrame(() => {
      t.classList.add("effort-open");
      e.classList.add("cid");
    });
    o.setAttribute("aria-expanded", "true");
    syncEffortUI();
  }
  function closeEffortFlyout() {
    const t = getPopover();
    const e = getFlyout();
    const o = getEffortTrigger();
    if (!t || !e) return;
    y = false;
    t.classList.remove("effort-open", "effort-open-left");
    e.classList.remove("cid");
    if (o) o.setAttribute("aria-expanded", "false");
    const finish = () => {
      if (!y) e.hidden = true;
      e.removeEventListener("transitionend", finish);
    };
    e.addEventListener("transitionend", finish);
    setTimeout(finish, 280);
  }
  function toggleEffortControl() {
    if (p === "slider") return;
    if (y) closeEffortFlyout(); else openEffortFlyout();
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
    const t = document.getElementById("i1yf");
    if (!t || t.dataset.bound === "true") return;
    t.dataset.bound = "true";
    const o = document.getElementById("i1yk");
    let n = null;
    let i = null;
    const previewFromT = n => {
      const r = magnetizeT(n);
      const s = r.snapped;
      const l = r.t;
      const c = r.index;
      clearMaxBits();
      if (s && i !== c) {
        setSliderT(l, {
          magnet: true
        });
      } else if (s) {
        setSliderT(l, {
          animate: false
        });
      } else {
        i = null;
        setSliderT(n, {
          animate: false
        });
      }
      if (s) i = c;
      const f = e[effortFromIndex(c)] || "Low";
      if (o) o.textContent = f;
      t.classList.toggle("is-max", c === a.length - 1 && isEffortSelectable("max"));
      const d = document.getElementById("i1yh");
      d?.querySelectorAll(".crl").forEach(t => {
        const e = Number(t.dataset.step || 0);
        t.classList.toggle("is-passed", e <= c);
        t.classList.toggle("is-magnet-hot", s && e === c);
      });
    };
    const finishDrag = e => {
      const o = magnetizeT(clientXToSliderT(e));
      h = false;
      i = null;
      t.classList.remove("is-dragging");
      t.querySelectorAll(".crl").forEach(t => {
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
      if (t.key === "ArrowRight" || t.key === "ArrowUp") o = e + 1; else if (t.key === "ArrowLeft" || t.key === "ArrowDown") o = e - 1; else if (t.key === "Home") o = 0; else if (t.key === "End") o = a.length - 1; else return;
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
      const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/tier/info") : `${window.API_BASE_URL || "/api"}/tier/info`;
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
        window.applyStorageBadgeUI({
          used: i.used ?? 0,
          limit: i.limit ?? i.max_videos ?? 2,
          plan: l.tier || "free"
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
  function formatQuotaUnlockWhen(t) {
    if (!t) return "";
    const e = String(t).trim();
    const o = /[zZ]|[+-]\d{2}:?\d{2}$/.test(e) ? e : e.replace(" ", "T");
    const n = new Date(o);
    if (Number.isNaN(n.getTime())) return "";
    const i = new Date;
    const r = n.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const s = n.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    const a = new Date(i.getFullYear(), i.getMonth(), i.getDate());
    const l = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const c = Math.round((l - a) / 864e5);
    if (c === 0) return `today at ${r}`;
    if (c === 1) return `tomorrow at ${r}`;
    return `${s} at ${r}`;
  }
  function syncQuotaRail(t, e) {
    const o = document.getElementById("i253");
    const n = document.getElementById("i251");
    const i = document.getElementById("i255");
    const r = document.getElementById("i254");
    const s = document.getElementById("i250");
    if (!o || !n || !i || !r) return;
    const a = t?.generations || {};
    const l = Math.max(0, Number(e?.daily?.remaining ?? a.remaining ?? 0));
    const c = Math.max(0, Number(e?.daily?.limit ?? a.max_per_period ?? a.max_per_day ?? 0));
    const f = Math.max(0, Number(e?.monthly?.remaining ?? a.remaining_month ?? 0));
    const u = Math.max(0, Number(e?.monthly?.limit ?? a.max_per_month ?? 0));
    const y = Math.max(0, Number(e?.max_effort?.limit ?? a.max_effort_per_day ?? 0));
    const p = e?.max_effort?.remaining ?? a.max_effort_remaining;
    const g = Math.max(0, Number(p ?? 0));
    const h = e?.max_effort?.can_use ?? a.can_use_max_effort;
    const E = y > 0 && (g <= 0 || h === false);
    const w = c > 0 && l <= 0 || e?.daily_limit_reached === true || e?.block_reason === "daily_limit";
    const v = u > 0 && f <= 0;
    const x = c >= 3 && l > 0 && (l <= 1 || l / c <= .2);
    const I = y >= 3 && !E && g === 1;
    let L = "";
    let S = "";
    let M = "";
    if (w) {
      L = "daily";
      const t = Math.max(1, c || 1);
      S = m === "free" ? `Free plan · 0 of ${t} clip${t === 1 ? "" : "s"} left today` : `Daily quota reached · 0 of ${c || t} clips left`;
      const o = formatQuotaUnlockWhen(e?.daily?.resets_at || a.daily_resets_at || a.resets_at);
      M = m === "free" ? o ? `You’ve used your free generation for today (1 clip). Your next clip unlocks ${o}. Upgrade anytime for more daily clips and deeper effort modes.` : "You’ve used your free generation for today (1 clip). Upgrade for more daily clips, or wait 24h after you started generating." : o ? `You’re out of daily generations. Your next clips unlock ${o}. Upgrade if you need a higher daily quota.` : "You’re out of daily generations. Upgrade for a higher daily quota, or wait 24h after you started generating.";
    } else if (v) {
      L = "monthly";
      S = `Monthly quota reached · 0 of ${u} clips left`;
      const t = formatQuotaUnlockWhen(e?.monthly?.resets_at || a.monthly_resets_at);
      M = t ? `You’ve used this period’s monthly quota. New clips unlock ${t}.` : "You’ve used this period’s monthly quota. New clips unlock when your plan renews.";
    } else if (x) {
      L = "daily-low";
      S = `Running low · ${l} of ${c} clips left today`;
      M = l === 1 ? "This is your last clip for today. After you use it, generation pauses until reset — or upgrade for more headroom so you don’t hit the wall mid-session." : `Only ${l} generations remain today. When you hit zero, Solis pauses new clips until your quota resets. Upgrade anytime if you need more room.`;
    } else if (E) {
      L = "max-empty";
      S = `Max effort used up · 0 of ${y} left today`;
      const t = e?.max_effort?.resets_at || a.max_effort_resets_at;
      const o = formatQuotaUnlockWhen(t);
      M = o ? `You’ve used all Max effort slots for today. Max unlocks again ${o}. You can still generate with Normal or Low — Solis won’t block the rest of your plan.` : "You’ve used all Max effort slots for today. You can still generate with Normal or Low — Solis won’t block the rest of your plan.";
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
    } else if (I) {
      L = "max-low";
      S = `Max effort running low · 1 of ${y} left today`;
      M = "You have one Max generation left. After that, Solis automatically falls back to Normal so you can keep creating without interruption.";
    } else {
      o.hidden = true;
      if (s) s.classList.remove("chd");
      return;
    }
    if (readDismissedKind() === L) {
      o.hidden = true;
      if (s) s.classList.remove("chd");
      return;
    }
    n.dataset.kind = L;
    i.textContent = S;
    r.textContent = M;
    o.hidden = false;
    if (s) s.classList.add("chd");
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
    const e = document.getElementById("i1yx");
    const o = document.getElementById("i1yv");
    const n = document.getElementById("i1yr");
    const i = document.getElementById("i1yo");
    const r = document.getElementById("i1yp");
    const s = document.getElementById("i1yq");
    const a = document.getElementById("i1ys");
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
    const y = getPopover();
    if (y) {
      y.dataset.tier = l;
      y.dataset.effort = isAutoMode() ? "auto" : d;
      y.dataset.effortSelection = u;
    }
    o.textContent = f;
    if (n) n.textContent = f;
    syncAdvancedModeUI({
      animate: false
    });
    syncEffortUI();
    syncQuotaRail(t, g);
    const p = t?.generations;
    if (p && i) {
      const t = Math.max(0, p.remaining ?? 0);
      const e = Math.max(1, p.max_per_period ?? p.max_per_day ?? 1);
      i.innerHTML = `<span class="plan-count-remaining">${t}</span>` + `<span class="plan-count-sep"> / ${e}</span>`;
      if (r) {
        const o = Math.max(0, p.used_today ?? e - t);
        r.style.width = `${Math.min(100, o / e * 100)}%`;
      }
    } else if (i) {
      i.textContent = "—";
      if (r) r.style.width = "0%";
    }
    if (s) s.textContent = formatResetLabel(p);
    if (a) {
      const t = Math.max(0, Number(p?.used_lifetime ?? p?.used_today ?? 0));
      const e = [ "basic", "prime", "elite" ].includes(l);
      const o = l === "free" && t < 1;
      a.classList.toggle("hidden", e || o);
    }
    clearLoadingState();
  }
  function setLoadingState(t = true) {
    const e = document.getElementById("i1yx");
    const o = document.getElementById("i1yt");
    const n = getPopover();
    if (e) e.classList.toggle("cia", !!t);
    if (n) n.classList.toggle("cia", !!t);
    if (o) o.setAttribute("aria-busy", t ? "true" : "false");
  }
  function clearLoadingState() {
    setLoadingState(false);
  }
  function getInputContainer() {
    return document.querySelector(".c1ix");
  }
  let v = null;
  let x = null;
  function getPopover() {
    return document.getElementById("i1yw");
  }
  function mountPopover() {
    const t = document.getElementById("i1yx");
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
    const t = document.getElementById("i1yt");
    const e = getPopover();
    if (!t || !e || e.hidden) return;
    const o = t.getBoundingClientRect();
    const n = isCompactPlanUi();
    const i = n ? 10 : 12;
    const r = n ? Math.min(360, window.innerWidth - i * 2) : Math.min(268, window.innerWidth - 48);
    const s = r;
    let a;
    if (n) {
      a = Math.max(i, Math.round((window.innerWidth - s) / 2));
    } else {
      a = Math.max(i, o.right - s);
      a = Math.min(a, window.innerWidth - s - i);
    }
    let l = o.bottom + (n ? 12 : 10);
    const c = e.offsetHeight || (n ? 320 : 260);
    if (l + c > window.innerHeight - i) {
      l = Math.max(i, o.top - c - 10);
    }
    e.style.top = `${l}px`;
    e.style.left = `${a}px`;
    e.style.width = `${s}px`;
    e.style.right = "auto";
    if (y && !n) positionEffortFlyoutSide();
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
    const t = document.getElementById("i1yx");
    const e = document.getElementById("i1yt");
    const o = getPopover();
    const n = getInputContainer();
    if (!t || !e || !o) return;
    mountPopover();
    o.hidden = false;
    e.setAttribute("aria-expanded", "true");
    positionPopover();
    requestAnimationFrame(() => {
      t.classList.add("cid");
      o.classList.add("cid");
      if (n) n.classList.add("cid");
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
        const t = document.getElementById("i1yq");
        const e = document.getElementById("i1yo");
        if (e) e.textContent = "—";
        if (t) t.textContent = "Could not load usage";
      });
    }
  }
  function closePopover(t = {}) {
    const e = Boolean(t.immediate);
    const o = document.getElementById("i1yx");
    const n = document.getElementById("i1yt");
    const i = getPopover();
    const r = getInputContainer();
    if (!o || !n || !i) return;
    if (i.hidden && !o.classList.contains("cid") && !i.classList.contains("cid")) {
      return;
    }
    closeEffortFlyout();
    o.classList.remove("cid");
    i.classList.remove("cid");
    if (r) r.classList.remove("cid");
    n.setAttribute("aria-expanded", "false");
    unbindReposition();
    const finish = () => {
      if (!o.classList.contains("cid")) {
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
    const t = document.getElementById("i1yx");
    if (!t) return;
    if (t.classList.contains("cid")) closePopover(); else openPopover();
  }
  function onPopoverClick(t) {
    const e = t.target.closest("#i1ya");
    if (e) {
      t.preventDefault();
      t.stopPropagation();
      setEffortSelection(isAutoMode() ? "advanced" : "auto");
      return;
    }
    if (t.target.closest("#i1yf") || t.target.closest("#i1yh")) {
      t.stopPropagation();
      return;
    }
    const o = t.target.closest("#i1ym");
    if (o) {
      t.preventDefault();
      t.stopPropagation();
      if (isAutoMode()) setEffortSelection("advanced");
      toggleEffortControl();
      return;
    }
    const n = t.target.closest(".cre");
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
    const t = document.getElementById("i1yx");
    const e = document.getElementById("i1yt");
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
    const o = document.getElementById("i252");
    if (o && !o.dataset.bound) {
      o.dataset.bound = "true";
      o.addEventListener("click", t => {
        t.preventDefault();
        t.stopPropagation();
        const e = document.getElementById("i251");
        const o = e?.dataset?.kind || "";
        dismissQuotaKind(o);
        const n = document.getElementById("i253");
        const i = document.getElementById("i250");
        if (n) n.hidden = true;
        if (i) i.classList.remove("chd");
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
      if (y) {
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
      const e = document.getElementById("i1yv");
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
    return p;
  };
  window.setEffortUiMode = function setEffortUiMode(t) {
    applyEffortUiMode(t);
    return p;
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
