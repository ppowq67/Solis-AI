(function initSolisImproveClip() {
  let e = false;
  let t = false;
  let i = null;
  let r = false;
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
    }, 3200);
  }
  function setButtonState() {
    const t = $("previewImproveBtn");
    if (!t) return;
    t.classList.toggle("is-improved", e);
    t.classList.toggle("active", e || r);
    t.setAttribute("aria-pressed", e || r ? "true" : "false");
    t.removeAttribute("title");
    t.setAttribute("aria-label", e ? "Clip improved" : "Improve clip (uses 1 upload)");
  }
  function setBarOpen(e) {
    r = !!e;
    const t = $("improveEditBar");
    const i = $("templateVideoPreview");
    if (t) {
      if (r) {
        t.hidden = false;
        t.classList.add("is-open");
      } else {
        t.classList.remove("is-open");
        t.hidden = true;
      }
    }
    if (i) i.classList.toggle("improve-bar-open", r);
    setButtonState();
    if (r) {
      const e = $("improveEditInput");
      if (e) {
        requestAnimationFrame(() => {
          try {
            e.focus();
          } catch (e) {}
        });
      }
    }
  }
  function syncVisibility() {
    const t = $("previewImproveBtn");
    const i = $("previewEditorPill");
    const r = isLibraryPreview();
    if (t) {
      t.style.display = r ? "" : "none";
      if (!r) {
        e = false;
        setBarOpen(false);
        setButtonState();
      } else {
        setButtonState();
      }
    }
    if (!r) setBarOpen(false);
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
    const n = $("improveEditSend");
    if (o) o.classList.add("is-working");
    if (n) n.disabled = true;
    try {
      const t = String(i || "").trim();
      showNote(t ? "Watching with Google…" : "Improving…");
      let o = null;
      try {
        const e = window.PreviewTimeline?.getActiveEditRange?.();
        if (e && e.segIndex != null && Number.isFinite(e.start) && Number.isFinite(e.end)) {
          o = {
            start: Number(e.start.toFixed(3)),
            end: Number(e.end.toFixed(3))
          };
        }
      } catch (e) {}
      const n = await fetch(`${apiBase()}/clips/projects/${encodeURIComponent(r)}/improve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify({
          prompt: t || undefined,
          silence_cuts: [],
          ...o ? {
            edit_range: o
          } : {}
        })
      });
      const s = await n.json().catch(() => ({}));
      if (!n.ok) {
        const e = s?.error_code || "";
        if (e === "NOTHING_TO_IMPROVE") {
          showNote(s?.error || "Already tight — nothing to improve");
          return;
        }
        if (e === "DAILY_LIMIT_REACHED" || e === "MONTHLY_LIMIT_REACHED" || n.status === 429) {
          showOutOfUploadsUpgrade();
          return;
        }
        showNote(s?.error || "Couldn’t improve yet");
        return;
      }
      e = true;
      setBarOpen(false);
      setButtonState();
      await reloadImprovedPreview(r);
      try {
        if (window.clipsStudio?.refreshQuotaAfterApply) {
          await window.clipsStudio.refreshQuotaAfterApply(s);
        }
      } catch (e) {}
      const a = String(s?.prompt_summary || "").trim();
      const l = Number(s?.removed_sec);
      if (s?.idea_found && a) {
        showNote(`${a} · 1 upload`);
      } else if (a) {
        showNote(`${a} · 1 upload`);
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
            reason: a || "Directed clip rework",
            prompt: t,
            source: "improve"
          });
        } catch (e) {}
      }
    } catch (e) {
      showNote("Couldn’t improve yet");
    } finally {
      t = false;
      if (o) o.classList.remove("is-working");
      if (n) n.disabled = false;
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
    const r = await hasUploadQuota();
    if (!r) {
      showOutOfUploadsUpgrade();
      return;
    }
    const o = $("improveEditInput");
    const n = String(o?.value || "").trim();
    await runImproveApi(n);
  }
  function toggleImprove() {
    if (t) return;
    if (!isLibraryPreview()) return;
    if (e) {
      showNote("Already improved for this clip");
      return;
    }
    setBarOpen(!r);
  }
  function openImproveBar(t) {
    if (!isLibraryPreview() || e) return;
    setBarOpen(true);
    const i = $("improveEditInput");
    if (i && t != null) {
      i.value = String(t);
    }
  }
  function resetImprove() {
    e = false;
    t = false;
    setBarOpen(false);
    const i = $("improveEditInput");
    if (i) i.value = "";
    const r = $("previewImproveBtn");
    if (r) r.classList.remove("is-working", "is-improved", "active");
    setButtonState();
  }
  window.SolisImproveClip = {
    toggle: toggleImprove,
    apply: submitImprove,
    open: openImproveBar,
    close: () => setBarOpen(false),
    reset: resetImprove,
    syncVisibility: syncVisibility,
    isApplied: () => e,
    isOpen: () => r
  };
  document.addEventListener("DOMContentLoaded", () => {
    const e = $("previewImproveBtn");
    if (e && !e.dataset.bound) {
      e.dataset.bound = "1";
      e.addEventListener("click", toggleImprove);
    }
    const t = $("improveEditSend");
    if (t && !t.dataset.bound) {
      t.dataset.bound = "1";
      t.addEventListener("click", () => {
        submitImprove();
      });
    }
    const i = $("improveEditInput");
    if (i && !i.dataset.bound) {
      i.dataset.bound = "1";
      i.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submitImprove();
        }
        if (e.key === "Escape") {
          setBarOpen(false);
        }
      });
    }
    syncVisibility();
  });
})();
