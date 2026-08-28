(function initSolisImproveClip() {
  let e = false;
  let t = false;
  let i = null;
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
    }, 2800);
  }
  function setButtonState() {
    const t = $("previewImproveBtn");
    if (!t) return;
    t.classList.toggle("is-improved", e);
    t.classList.toggle("active", e);
    t.setAttribute("aria-pressed", e ? "true" : "false");
    t.removeAttribute("title");
    t.setAttribute("aria-label", e ? "Clip improved" : "Improve clip (uses 1 upload)");
  }
  function syncVisibility() {
    const t = $("previewImproveBtn");
    const i = $("previewEditorPill");
    const r = isLibraryPreview();
    if (t) {
      t.style.display = r ? "" : "none";
      if (!r) {
        e = false;
        setButtonState();
      } else {
        setButtonState();
      }
    }
    if (i) {
      const e = $("previewSilencerBtn");
      const o = r && e && e.style.display !== "none";
      const n = r && t && t.style.display !== "none";
      const s = $("previewModifiersBtn");
      const a = !r && s && s.style.display !== "none";
      i.classList.toggle("has-feature-tools", Boolean(o || n || a));
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
    const r = $("templateVideoPreview");
    const o = r?.querySelector("video");
    if (o?.src) {
      try {
        const e = new URL(o.src, window.location.origin);
        e.searchParams.set("_imp", String(Date.now()));
        o.src = e.toString();
        o.load();
      } catch (e) {}
    }
  }
  function showOutOfUploadsUpgrade() {
    showNote("Need extra uploads");
    try {
      if (typeof window.showUpgradeModal === "function") {
        window.showUpgradeModal("Need extra uploads", "Improve clip uses 1 upload. You’re out for today — upgrade anytime for a higher daily limit.");
      }
    } catch (e) {}
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
      const r = i.daily || {};
      const o = r.remaining;
      if (o != null && Number(o) <= 0) return false;
      if (i.monthly_limit_reached === true) return false;
      const n = i.monthly || {};
      if (n.remaining != null && Number(n.remaining) <= 0 && Number(n.limit) > 0) {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }
  async function runImproveApi(i) {
    const r = getProjectId();
    if (!r) {
      showNote("Open a library clip first");
      return;
    }
    t = true;
    const o = $("previewImproveBtn");
    if (o) o.classList.add("is-working");
    try {
      showNote("Improving…");
      if (!Array.isArray(i)) i = [];
      let t = null;
      try {
        const e = window.PreviewTimeline?.getActiveEditRange?.();
        if (e && e.segIndex != null && Number.isFinite(e.start) && Number.isFinite(e.end)) {
          t = {
            start: Number(e.start.toFixed(3)),
            end: Number(e.end.toFixed(3))
          };
        }
      } catch (e) {}
      const o = await fetch(`${apiBase()}/clips/projects/${encodeURIComponent(r)}/improve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          silence_cuts: i.map(e => ({
            start: Number(Number(e.start).toFixed(3)),
            end: Number(Number(e.end).toFixed(3))
          })),
          ...t ? {
            edit_range: t
          } : {}
        })
      });
      const n = await o.json().catch(() => ({}));
      if (!o.ok) {
        const e = n?.error_code || "";
        if (e === "NOTHING_TO_IMPROVE") {
          showNote(n?.error || "Already tight — nothing to improve");
          return;
        }
        if (e === "DAILY_LIMIT_REACHED" || e === "MONTHLY_LIMIT_REACHED" || o.status === 429) {
          showOutOfUploadsUpgrade();
          return;
        }
        showNote(n?.error || "Couldn’t improve yet");
        return;
      }
      e = true;
      setButtonState();
      await reloadImprovedPreview(r);
      try {
        if (window.clipsStudio?.refreshQuotaAfterApply) {
          await window.clipsStudio.refreshQuotaAfterApply(n);
        }
      } catch (e) {}
      const s = Number(n?.removed_sec);
      const a = Boolean(n?.boundaries_fixed || n?.edge_trimmed);
      const l = Boolean(n?.captions_fixed);
      if (l && a && Number.isFinite(s) && s > 0) {
        showNote(`Cuts + captions retuned · −${s.toFixed(1)}s (1 upload)`);
      } else if (a && Number.isFinite(s) && s > 0) {
        showNote(`Cuts sharpened · removed ${s.toFixed(1)}s (1 upload)`);
      } else if (Number.isFinite(s) && s > 0) {
        showNote(`Improved — removed ${s.toFixed(1)}s (1 upload)`);
      } else if (l) {
        showNote("Captions retuned (1 upload)");
      } else if (a) {
        showNote("Cut boundaries sharpened (1 upload)");
      } else {
        showNote("Clip improved (1 upload)");
      }
    } catch (e) {
      showNote("Couldn’t improve yet");
    } finally {
      t = false;
      if (o) o.classList.remove("is-working");
    }
  }
  async function applyImprove() {
    if (t || e) return;
    if (!isLibraryPreview()) return;
    if (window.SolisSilenceCutSuggest?.isOpen?.()) return;
    const i = getProjectId();
    if (!i) {
      showNote("Open a library clip first");
      return;
    }
    const r = await hasUploadQuota();
    if (!r) {
      showOutOfUploadsUpgrade();
      return;
    }
    t = true;
    const o = $("previewImproveBtn");
    if (o) o.classList.add("is-working");
    try {
      const e = window.SolisSilencer;
      let t = [];
      if (typeof e?.detectCuts === "function") {
        t = await e.detectCuts();
      } else if (typeof e?.isApplied === "function" && e.isApplied()) {
        t = e.getCuts?.() || [];
      }
      if (!Array.isArray(t)) t = [];
      const i = t.reduce((e, t) => e + Math.max(0, Number(t.end) - Number(t.start)), 0);
      const r = i > 0 ? `Red = ~${i.toFixed(1)}s to trim · Improve uses 1 upload` : "Improve clip boundaries · uses 1 upload";
      window.SolisSilenceCutSuggest?.show({
        source: "improve",
        regions: t,
        label: r,
        onAccept: e => {
          runImproveApi(e);
        },
        onReject: () => {
          showNote("Improve dismissed");
        }
      });
    } finally {
      t = false;
      if (o) o.classList.remove("is-working");
    }
  }
  function toggleImprove() {
    if (t) return;
    if (!isLibraryPreview()) return;
    if (e) {
      showNote("Already improved for this clip");
      return;
    }
    applyImprove();
  }
  function resetImprove() {
    e = false;
    t = false;
    try {
      window.SolisSilenceCutSuggest?.clear?.();
    } catch (e) {}
    const i = $("previewImproveBtn");
    if (i) i.classList.remove("is-working", "is-improved", "active");
    setButtonState();
  }
  window.SolisImproveClip = {
    toggle: toggleImprove,
    apply: applyImprove,
    reset: resetImprove,
    syncVisibility: syncVisibility,
    isApplied: () => e
  };
  document.addEventListener("DOMContentLoaded", () => {
    const e = $("previewImproveBtn");
    if (e && !e.dataset.bound) {
      e.dataset.bound = "1";
      e.addEventListener("click", toggleImprove);
    }
    syncVisibility();
  });
})();
