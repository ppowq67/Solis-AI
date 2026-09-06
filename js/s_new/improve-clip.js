(function initSolisImproveClip() {
  let e = false;
  let t = false;
  let i = null;
  let n = false;
  let r = false;
  let o = 0;
  let a = 0;
  let s = false;
  let l = null;
  let c = false;
  let d = 0;
  const u = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 19V5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function $(e) {
    return document.getElementById(e);
  }
  function isLibraryPreview() {
    return Boolean(document.querySelector(".template-preview-content.is-library-preview"));
  }
  function getProjectId() {
    try {
      return window.clipsStudio?.currentTemplateForPreview?.projectId || null;
    } catch (e) {
      return null;
    }
  }
  function apiBase() {
    return typeof API_BASE_URL !== "undefined" && API_BASE_URL ? API_BASE_URL : "";
  }
  function authHeaders() {
    try {
      return typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    } catch (e) {
      return {};
    }
  }
  function cancelPlace() {
    if (o) {
      cancelAnimationFrame(o);
      o = 0;
    }
    if (a) {
      cancelAnimationFrame(a);
      a = 0;
    }
  }
  function hideAllImproveBars() {
    const e = Array.from(document.querySelectorAll(".improve-edit-bar"));
    let t = e.find(e => e.id === "improveEditBar") || e[0] || null;
    e.forEach(e => {
      e.classList.remove("is-open", "is-range-mode", "has-rainbow", "is-receiving-rainbow");
      e.hidden = true;
      e.setAttribute("hidden", "");
      e.style.left = "";
      e.style.top = "";
      e.style.transform = "";
      e.style.width = "";
      e.style.right = "";
      e.style.bottom = "";
      if (t && e !== t) {
        try {
          e.remove();
        } catch (e) {}
      }
    });
    if (t) {
      t.id = "improveEditBar";
      if (t.parentElement !== document.body) {
        document.body.appendChild(t);
      }
    }
    try {
      const e = $("timelineRangeGlass");
      if (e) {
        e.hidden = true;
        e.setAttribute("hidden", "");
      }
    } catch (e) {}
    return t;
  }
  function clearRainbowFly() {
    if (d) {
      clearTimeout(d);
      d = 0;
    }
    if (l) {
      try {
        l.remove();
      } catch (e) {}
      l = null;
    }
    document.querySelectorAll(".range-rainbow-fly").forEach(e => {
      try {
        e.remove();
      } catch (e) {}
    });
  }
  function clearRainbowState() {
    clearRainbowFly();
    s = false;
    document.querySelectorAll(".improve-edit-bar").forEach(e => {
      e.classList.remove("has-rainbow", "is-receiving-rainbow");
    });
    const e = $("previewTimelineRangePick");
    e?.classList.remove("is-dimmed", "is-collecting");
  }
  function transferRainbowToInput() {
    if (s || !r || !n) return;
    const e = ensureBar();
    const t = $("previewTimelineRangePick");
    if (!e) return;
    clearRainbowFly();
    s = true;
    if (t) {
      t.classList.remove("is-collecting");
      t.classList.add("is-dimmed");
    }
    e.classList.add("is-receiving-rainbow");
    e.classList.remove("is-rainbow-from-glow");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!n || !s) return;
        e.classList.add("has-rainbow");
      });
    });
  }
  function ensureBar() {
    const e = Array.from(document.querySelectorAll(".improve-edit-bar"));
    let t = e.find(e => e.id === "improveEditBar") || e[0] || null;
    e.forEach(e => {
      if (t && e !== t) {
        try {
          e.remove();
        } catch (e) {}
      }
    });
    if (!t) {
      t = document.createElement("div");
      t.className = "improve-edit-bar";
      t.id = "improveEditBar";
      t.hidden = true;
      t.innerHTML = `\n                <button type="button" class="improve-edit-silence" id="improveEditSilence" hidden\n                    title="Remove silence in selection" aria-label="Remove silence">\n                    <svg class="silencer-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n                        <path class="silencer-bar silencer-bar--a" d="M6 6v11"/>\n                        <path class="silencer-bar silencer-bar--b" d="M10 10v11"/>\n                        <path class="silencer-bar silencer-bar--c" d="M10 3v1.35"/>\n                        <path class="silencer-bar silencer-bar--d" d="M14 14v1"/>\n                        <path class="silencer-bar silencer-bar--e" d="M14 8v.35"/>\n                        <path class="silencer-bar silencer-bar--f" d="M18 5v7.35"/>\n                        <path class="silencer-bar silencer-bar--g" d="M2 10v3"/>\n                        <path class="silencer-bar silencer-bar--h" d="M22 10v3"/>\n                        <path class="silencer-slash" d="m2 2 20 20"/>\n                    </svg>\n                </button>\n                <textarea class="improve-edit-input" id="improveEditInput"\n                    placeholder="Describe your edit"\n                    rows="1" aria-label="Describe your edit"></textarea>\n                <button type="button" class="improve-edit-send" id="improveEditSend" aria-label="Improve clip">\n                    ${u}\n                </button>\n            `;
      document.body.appendChild(t);
      bindBarControls(t);
    } else {
      t.id = "improveEditBar";
      if (t.parentElement !== document.body) {
        document.body.appendChild(t);
      }
      const e = $("improveEditSend") || t.querySelector("#improveEditSend");
      if (e) {
        e.innerHTML = u;
        e.style.color = "#ffffff";
      }
      if (!t.dataset.controlsBound) bindBarControls(t);
    }
    return t;
  }
  function showNote(e) {
    const t = $("silencerNote");
    if (!t) return;
    if (i) clearTimeout(i);
    t.hidden = false;
    t.textContent = e;
    requestAnimationFrame(() => t.classList.add("is-visible"));
    i = setTimeout(() => {
      t.classList.remove("is-visible");
      i = setTimeout(() => {
        t.hidden = true;
        t.textContent = "";
        i = null;
      }, 200);
    }, 3200);
  }
  function setButtonState() {
    const t = $("previewImproveBtn");
    if (!t) return;
    t.classList.toggle("is-improved", e);
    t.classList.toggle("active", e || n);
    t.setAttribute("aria-pressed", e || n ? "true" : "false");
    t.removeAttribute("title");
    t.setAttribute("aria-label", e ? "Clip improved" : "Improve clip");
  }
  function setRangeChrome(e) {
    r = !!e;
    const t = ensureBar();
    const i = $("improveEditSilence");
    const n = $("improveEditInput");
    if (t) t.classList.toggle("is-range-mode", r);
    if (i) {
      i.hidden = !r;
      if (!r) i.setAttribute("hidden", ""); else i.removeAttribute("hidden");
    }
    if (n) {
      n.placeholder = "Describe your edit";
    }
  }
  function clearBarPosition() {
    const e = $("improveEditBar");
    if (!e) return;
    e.style.left = "";
    e.style.top = "";
    e.style.transform = "";
    e.style.width = "";
    e.style.right = "";
    e.style.bottom = "";
  }
  function placeBarAboveSelection(e, t) {
    if (!n) return;
    const i = ensureBar();
    if (!i || !n) return;
    if (i.parentElement !== document.body) {
      document.body.appendChild(i);
    }
    const r = $("previewTimelineWrap");
    const o = $("previewTimelineRangePick");
    const a = $("previewTimelineShell") || $("previewTimelineRow");
    const s = 8;
    let l = null;
    if (o && !o.hidden && o.getBoundingClientRect().width > 4) {
      l = o.getBoundingClientRect();
    } else if (r && Number.isFinite(e) && Number.isFinite(t)) {
      const i = r.getBoundingClientRect();
      const n = window.PreviewTimeline?.getTrim?.();
      const o = Math.max(.01, Number(n?.duration) || Math.max(t, 1));
      const a = Math.max(0, Math.min(e, o)) / o;
      const s = Math.max(0, Math.min(t, o)) / o;
      const c = i.left + Math.min(a, s) * i.width;
      const d = Math.max(24, Math.abs(s - a) * i.width);
      l = {
        left: c,
        width: d,
        top: i.top,
        bottom: i.bottom,
        height: i.height
      };
    } else if (r) {
      l = r.getBoundingClientRect();
    } else if (a) {
      l = a.getBoundingClientRect();
    }
    if (!l) return;
    i.style.position = "fixed";
    i.style.right = "auto";
    i.style.bottom = "auto";
    i.style.transform = "none";
    const c = Math.min(320, Math.max(240, Math.min(l.width + 48, window.innerWidth - 24)));
    i.style.width = `${c}px`;
    const d = i.getBoundingClientRect();
    const u = d.height || 46;
    let p = l.left + (l.width - c) / 2;
    let m = l.top - u - 12;
    if (m < s) m = s;
    p = Math.max(s, Math.min(p, window.innerWidth - c - s));
    i.style.left = `${Math.round(p)}px`;
    i.style.top = `${Math.round(m)}px`;
  }
  function schedulePlace(e, t) {
    cancelPlace();
    o = requestAnimationFrame(() => {
      o = 0;
      if (!n) return;
      placeBarAboveSelection(e, t);
      a = requestAnimationFrame(() => {
        a = 0;
        if (!n) return;
        placeBarAboveSelection(e, t);
      });
    });
  }
  function dismissSelection() {
    cancelPlace();
    clearRainbowState();
    n = false;
    hideAllImproveBars();
    setRangeChrome(false);
    setButtonState();
    try {
      window.TimelineRangeGlass?.hide?.();
    } catch (e) {}
    try {
      window.clipsStudio?._setCompanionWatchTyping?.(false);
    } catch (e) {}
  }
  function setBarOpen(e, t = {}) {
    n = !!e;
    const i = ensureBar();
    const r = $("templateVideoPreview");
    if (i) {
      if (n) {
        document.querySelectorAll(".improve-edit-bar").forEach(e => {
          if (e !== i) {
            e.classList.remove("is-open");
            e.hidden = true;
            e.setAttribute("hidden", "");
            try {
              e.remove();
            } catch (e) {}
          }
        });
        i.hidden = false;
        i.removeAttribute("hidden");
        i.classList.add("is-open");
        const e = $("improveEditSend") || i.querySelector("#improveEditSend");
        if (e) {
          e.innerHTML = u;
          e.style.color = "#ffffff";
        }
        if (t.range) setRangeChrome(true); else if (!t.keepRange) setRangeChrome(false);
        if (!t.keepRainbow) clearRainbowState();
        schedulePlace(t.start, t.end);
      } else {
        hideAllImproveBars();
        setRangeChrome(false);
        clearBarPosition();
        if (!t.fromDismiss) clearRainbowState(); else clearRainbowFly();
      }
    }
    if (r) r.classList.remove("improve-bar-open");
    setButtonState();
    if (n) {
      const e = $("improveEditInput") || i?.querySelector?.("#improveEditInput");
      if (e && t.prefill != null) e.value = String(t.prefill);
      if (e && (t.focus === true || t.focus !== false && !t.range)) {
        requestAnimationFrame(() => {
          try {
            e.focus();
          } catch (e) {}
        });
      }
    }
    try {
      window.TimelineRangeGlass?.hide?.();
    } catch (e) {}
  }
  function syncVisibility() {
    const t = $("previewImproveBtn");
    const i = $("previewEditorPill");
    const n = isLibraryPreview();
    ensureBar();
    if (t) {
      t.style.display = n ? "" : "none";
      if (!n) {
        e = false;
        setBarOpen(false);
        setButtonState();
      } else {
        setButtonState();
      }
    }
    if (!n) setBarOpen(false);
    if (i) {
      const e = $("previewSilencerBtn");
      const r = n && e && e.style.display !== "none";
      const o = n && t && t.style.display !== "none";
      const a = $("previewModifiersBtn");
      const s = !n && a && a.style.display !== "none";
      i.classList.toggle("has-feature-tools", Boolean(r || o || s));
    }
  }
  async function reloadImprovedPreview(e) {
    const t = window.clipsStudio;
    if (!t || !e) return;
    try {
      window.LibraryPreviewMediaCache?.invalidateProject?.(e);
    } catch (e) {}
    try {
      window.SolisSilencer?.reset?.();
    } catch (e) {}
    try {
      t._librarySilenceDirty = false;
      t._librarySilenceCuts = [];
    } catch (e) {}
    const i = t.currentTemplateForPreview?.libraryCardId || t.currentTemplateForPreview?.id || null;
    if (typeof t.openLibraryPreview === "function" && i) {
      try {
        await t.openLibraryPreview(i, e, null, {
          fast: true,
          force: true
        });
        return;
      } catch (e) {}
    }
    const n = $("templateVideoPreview");
    const r = n?.querySelector("video");
    if (r?.src) {
      try {
        const e = new URL(r.src, window.location.origin);
        e.searchParams.set("_imp", String(Date.now()));
        r.src = e.toString();
        r.load();
      } catch (e) {}
    }
  }
  function showOutOfUploadsUpgrade() {
    showNote("Need extra uploads");
    try {
      const e = window.clipsStudio;
      if (e && typeof e.openWatermarkPlanPopover === "function") {
        e.openWatermarkPlanPopover({
          reason: "quota"
        });
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.showUpgradeModal === "function") {
        window.showUpgradeModal("Need extra uploads", "Improve clip uses 1 upload. You’re out for today — upgrade anytime for a higher daily limit.");
      }
    } catch (e) {}
  }
  async function gateImproveQuota() {
    const e = await hasUploadQuota();
    if (!e) {
      showOutOfUploadsUpgrade();
      return false;
    }
    return true;
  }
  async function hasUploadQuota() {
    try {
      const e = window.clipsStudio;
      let t = null;
      if (typeof e?._getCachedLimitCheck === "function") {
        t = await e._getCachedLimitCheck();
      } else {
        const e = await fetch(`${apiBase()}/clips/status`, {
          method: "GET",
          headers: authHeaders(),
          credentials: "include"
        });
        t = e.ok ? await e.json() : null;
      }
      const i = t?.clips || t || {};
      if (i.daily_limit_reached === true) return false;
      const n = i.daily || {};
      const r = n.remaining;
      if (r != null && Number(r) <= 0) return false;
      if (i.monthly_limit_reached === true) return false;
      const o = i.monthly || {};
      if (o.remaining != null && Number(o.remaining) <= 0 && Number(o.limit) > 0) {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }
  async function runImproveApi(i) {
    const n = getProjectId();
    if (!n) {
      showNote("Open a library clip first");
      return;
    }
    t = true;
    const r = $("previewImproveBtn");
    const o = $("improveEditSend");
    if (r) r.classList.add("is-working");
    if (o) o.disabled = true;
    try {
      const t = String(i || "").trim();
      showNote(t ? "Watching with Google…" : "Improving…");
      let r = null;
      try {
        const e = window.PreviewTimeline?.getActiveEditRange?.();
        if (e && (e.manual || e.segIndex != null) && Number.isFinite(e.start) && Number.isFinite(e.end) && e.end - e.start > .35) {
          r = {
            start: Number(e.start.toFixed(3)),
            end: Number(e.end.toFixed(3))
          };
        }
      } catch (e) {}
      const o = await fetch(`${apiBase()}/clips/projects/${encodeURIComponent(n)}/improve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          prompt: t || undefined,
          silence_cuts: [],
          ...r ? {
            edit_range: r
          } : {}
        })
      });
      const a = await o.json().catch(() => ({}));
      if (!o.ok) {
        const e = a?.error_code || "";
        if (e === "NOTHING_TO_IMPROVE") {
          showNote(a?.error || "Already tight — nothing to improve");
          return;
        }
        if (e === "DAILY_LIMIT_REACHED" || e === "MONTHLY_LIMIT_REACHED" || o.status === 429) {
          showOutOfUploadsUpgrade();
          return;
        }
        showNote(a?.error || "Couldn’t improve yet");
        return;
      }
      e = true;
      setBarOpen(false);
      setButtonState();
      try {
        window.PreviewTimeline?.clearManualRange?.();
      } catch (e) {}
      await reloadImprovedPreview(n);
      try {
        if (window.clipsStudio?.refreshQuotaAfterApply) {
          await window.clipsStudio.refreshQuotaAfterApply(a);
        }
      } catch (e) {}
      const s = String(a?.prompt_summary || "").trim();
      const l = Number(a?.removed_sec);
      if (s) {
        showNote(`${s} · 1 upload`);
      } else if (Number.isFinite(l) && l > 0) {
        showNote(`Improved — removed ${l.toFixed(1)}s (1 upload)`);
      } else {
        showNote("Clip improved (1 upload)");
      }
      if (t) {
        try {
          window.SolisMemory?.recordEditorialTaste?.({
            action: "improve_prompt",
            category: "improve",
            reason: s || "Directed clip rework",
            prompt: t,
            source: "improve"
          });
        } catch (e) {}
      } else {
        try {
          window.SolisMemory?.recordEditorialHabit?.("silence", null, {
            source: "improve_bare",
            weight: .7,
            reason: s || "Bare improve"
          });
        } catch (e) {}
      }
      if (a?.hook_cleared) {
        try {
          window.SolisMemory?.recordEditorialHabit?.("no_hook", true, {
            source: "improve",
            prompt: t || undefined
          });
        } catch (e) {}
      }
      if (a?.cut_selection) {
        try {
          window.SolisMemory?.recordEditorialHabit?.("tight_open", true, {
            source: "improve",
            prompt: t || undefined
          });
        } catch (e) {}
      }
    } catch (e) {
      showNote("Couldn’t improve yet");
    } finally {
      t = false;
      if (r) r.classList.remove("is-working");
      if (o) o.disabled = false;
    }
  }
  async function submitImprove() {
    if (t || e) return;
    if (!isLibraryPreview()) return;
    const i = getProjectId();
    if (!i) {
      showNote("Open a library clip first");
      return;
    }
    if (!await gateImproveQuota()) return;
    const n = $("improveEditInput");
    const r = String(n?.value || "").trim();
    await runImproveApi(r);
  }
  async function runImprove(i) {
    if (t || e) return;
    if (!isLibraryPreview()) return;
    const n = getProjectId();
    if (!n) {
      showNote("Open a library clip first");
      return;
    }
    if (!await gateImproveQuota()) return;
    const r = $("improveEditInput");
    const o = String(i != null ? i : r?.value || "").trim();
    if (r && i != null) r.value = o;
    await runImproveApi(o);
  }
  function selectFullClipRange() {
    try {
      const e = window.PreviewTimeline?.getTrim?.();
      const t = Number.isFinite(e?.start) ? e.start : 0;
      let i = Number.isFinite(e?.end) ? e.end : 0;
      const n = Number.isFinite(e?.duration) ? e.duration : 0;
      if (!(i - t > .35) && n > .35) {
        i = n;
      }
      if (i - t > .35) {
        window.PreviewTimeline.setManualRange(t, i);
        return {
          start: t,
          end: i
        };
      }
    } catch (e) {}
    return null;
  }
  async function toggleImprove() {
    if (t) return;
    if (!isLibraryPreview()) return;
    if (e) {
      showNote("Already improved for this clip");
      return;
    }
    if (n) {
      try {
        window.PreviewTimeline?.clearManualRange?.();
      } catch (e) {}
      dismissSelection();
      return;
    }
    let i = window.PreviewTimeline?.getActiveEditRange?.();
    let r = i && (i.manual || i.segIndex != null) && Number.isFinite(i.start) && i.end - i.start > .35;
    if (!r) {
      const e = selectFullClipRange();
      if (e) {
        i = e;
        r = true;
      }
    }
    setBarOpen(true, {
      range: !!r,
      start: r ? i.start : undefined,
      end: r ? i.end : undefined
    });
  }
  async function openImproveBar(t) {
    if (!isLibraryPreview() || e) return;
    let i = window.PreviewTimeline?.getActiveEditRange?.();
    let n = i && (i.manual || i.segIndex != null) && Number.isFinite(i.start) && i.end - i.start > .35;
    if (!n) {
      const e = selectFullClipRange();
      if (e) {
        i = e;
        n = true;
      }
    }
    setBarOpen(true, {
      prefill: t != null ? t : undefined,
      range: !!n,
      start: n ? i.start : undefined,
      end: n ? i.end : undefined
    });
  }
  function openForRange(t, i, n) {
    if (!isLibraryPreview() || e) return;
    if (Number.isFinite(t) && Number.isFinite(i) && i - t >= .35) {
      try {
        window.PreviewTimeline?.setManualRange?.(t, i);
      } catch (e) {}
    }
    setBarOpen(true, {
      range: true,
      start: t,
      end: i,
      prefill: n != null ? n : "",
      focus: true,
      keepRainbow: true
    });
  }
  function resetImprove() {
    e = false;
    t = false;
    dismissSelection();
    const i = $("improveEditInput");
    if (i) i.value = "";
    const n = $("previewImproveBtn");
    if (n) n.classList.remove("is-working", "is-improved", "active");
    setButtonState();
  }
  async function onSilenceClick(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      if (window.SolisSilencer?.apply) await window.SolisSilencer.apply(); else if (window.SolisSilencer?.toggle) window.SolisSilencer.toggle();
    } catch (e) {}
  }
  function bindBarControls(e) {
    if (!e || e.dataset.controlsBound === "1") return;
    e.dataset.controlsBound = "1";
    const t = e.querySelector("#improveEditSend") || $("improveEditSend");
    if (t && !t.dataset.bound) {
      t.dataset.bound = "1";
      t.addEventListener("click", () => {
        submitImprove();
      });
    }
    const i = e.querySelector("#improveEditInput") || $("improveEditInput");
    if (i && !i.dataset.bound) {
      i.dataset.bound = "1";
      i.addEventListener("focus", () => {
        transferRainbowToInput();
        try {
          window.clipsStudio?._setCompanionWatchTyping?.(true);
        } catch (e) {}
      });
      i.addEventListener("pointerdown", () => {
        requestAnimationFrame(() => transferRainbowToInput());
      });
      i.addEventListener("input", () => {
        try {
          window.clipsStudio?._setCompanionWatchTyping?.(true);
        } catch (e) {}
      });
      i.addEventListener("blur", () => {
        try {
          window.clipsStudio?._setCompanionWatchTyping?.(false);
        } catch (e) {}
      });
      i.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitImprove();
        }
        if (e.key === "Escape") {
          try {
            window.PreviewTimeline?.clearManualRange?.();
          } catch (e) {}
          dismissSelection();
        }
      });
    }
    const n = e.querySelector("#improveEditSilence") || $("improveEditSilence");
    if (n && !n.dataset.bound) {
      n.dataset.bound = "1";
      n.addEventListener("click", onSilenceClick);
    }
  }
  function onGlobalDismiss(e) {
    if (!n && !window.PreviewTimeline?.getManualRange?.()) return;
    if (window.PreviewTimeline?.isRangeDragging?.()) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("#improveEditBar") || t.closest(".improve-edit-bar")) return;
    if (t.closest("#previewCtxMenu")) return;
    if (t.closest("#timelineRangeGlass")) return;
    if (t.closest(".range-rainbow-fly")) return;
    try {
      window.PreviewTimeline?.clearManualRange?.();
    } catch (e) {}
    dismissSelection();
    try {
      window.PreviewCtxMenu?.close?.();
    } catch (e) {}
  }
  function bindDismiss() {
    if (c) return;
    c = true;
    window.addEventListener("pointerdown", onGlobalDismiss, true);
    window.addEventListener("mousedown", onGlobalDismiss, true);
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!n && !window.PreviewTimeline?.getManualRange?.()) return;
      try {
        window.PreviewTimeline?.clearManualRange?.();
      } catch (e) {}
      dismissSelection();
    });
  }
  function bindAll() {
    ensureBar();
    bindDismiss();
    const e = $("previewImproveBtn");
    if (e && !e.dataset.bound) {
      e.dataset.bound = "1";
      e.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const e = document.getElementById("improveHoverCard");
          if (e) {
            e.classList.remove("is-on", "is-rich");
            e.hidden = true;
          }
        } catch (e) {}
        toggleImprove();
      });
    }
    const t = $("improveEditBar");
    if (t) bindBarControls(t);
    window.addEventListener("resize", () => {
      if (!n) return;
      const e = window.PreviewTimeline?.getManualRange?.();
      schedulePlace(e?.start, e?.end);
    });
    syncVisibility();
  }
  function clearHookLocally(e) {
    try {
      if (window.clipsStudio) {
        window.clipsStudio._libraryHookCleared = true;
        window.clipsStudio._libraryOverlayDirty = true;
      }
    } catch (e) {}
    try {
      const e = $("templateVideoPreview") || document.querySelector(".template-preview-content");
      if (typeof window.clearPreviewCaptionOverlays === "function") {
        window.clearPreviewCaptionOverlays({
          hooks: true,
          overlays: false,
          container: e
        });
      } else {
        document.querySelectorAll('.overlay-text-block[data-ai-hook="1"]').forEach(e => {
          try {
            e.remove();
          } catch (e) {}
        });
      }
    } catch (e) {}
    try {
      if (typeof window.syncLibraryConfirmLabel === "function") window.syncLibraryConfirmLabel(); else if (typeof window.setConfirmUseTemplateLabel === "function") {
        window.setConfirmUseTemplateLabel("Apply & Download");
      }
    } catch (e) {}
    showNote(e || "Hook cleared — Apply & Download to keep it.");
    try {
      window.SolisCompanion?.speak?.(e || "Skipped the hook — like you prefer.", {
        reasoning: [ "Remembered your no-hook habit." ]
      });
    } catch (t) {
      try {
        window.clipsStudio?._speakCompanionTask?.(e || "Skipped the hook — like you prefer.");
      } catch (e) {}
    }
  }
  async function maybeOfferHabit() {
    return false;
  }
  window.SolisImproveClip = {
    toggle: toggleImprove,
    apply: submitImprove,
    run: runImprove,
    open: openImproveBar,
    openForRange: openForRange,
    close: () => setBarOpen(false),
    dismissSelection: dismissSelection,
    reset: resetImprove,
    syncVisibility: syncVisibility,
    ensureBar: ensureBar,
    maybeOfferHabit: maybeOfferHabit,
    isApplied: () => e,
    isOpen: () => n
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll, {
      once: true
    });
  } else {
    bindAll();
  }
  setTimeout(bindAll, 0);
  setTimeout(bindAll, 400);
})();
