(function initSolisSilencer() {
  const e = .5;
  const t = .14;
  const i = .22;
  const n = .05;
  const r = .11;
  let o = false;
  let s = 0;
  let c = null;
  let l = false;
  function $(e) {
    return document.getElementById(e);
  }
  function isLibraryPreview() {
    return Boolean(document.querySelector(".template-preview-content.is-library-preview"));
  }
  function getPreviewVideo() {
    const e = $("templateVideoPreview");
    if (!e) return null;
    return e.querySelector("#splitscreenContentVideo") || e.querySelector(".library-preview-video") || e.querySelector("video");
  }
  function getDuration() {
    const e = window.PreviewTimeline?.getTrim?.();
    if (e?.duration > 0) return e.duration;
    const t = getPreviewVideo();
    return t && Number.isFinite(t.duration) && t.duration > 0 ? t.duration : 0;
  }
  function getTimedWords() {
    if (typeof window.resolveLiveCaptionTimed === "function") {
      const e = window.resolveLiveCaptionTimed();
      if (Array.isArray(e) && e.length) return e;
    }
    try {
      const e = window.__solisLiveCaptionTimed;
      if (Array.isArray(e) && e.length) return e;
    } catch (e) {}
    return null;
  }
  function mergeRegions(e) {
    if (!e.length) return [];
    const t = e.map(e => ({
      start: Number(e.start),
      end: Number(e.end)
    })).filter(e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end - e.start >= i).sort((e, t) => e.start - t.start);
    const n = [];
    for (const e of t) {
      const t = n[n.length - 1];
      if (t && e.start <= t.end + .05) {
        t.end = Math.max(t.end, e.end);
      } else {
        n.push({
          start: e.start,
          end: e.end
        });
      }
    }
    return n;
  }
  function cutFromGap(n, r) {
    const o = r - n;
    if (o < e) return null;
    const s = Math.min(t, Math.max(.08, o * .22));
    const c = n + s;
    const l = r;
    if (l - c < i) return null;
    return {
      start: Math.round(c * 1e3) / 1e3,
      end: Math.round(l * 1e3) / 1e3
    };
  }
  function detectFromWords(t, i) {
    const n = (t || []).filter(e => e && e.kind !== "reaction").map(e => ({
      start: Number(e.start),
      end: Number(e.end)
    })).filter(e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start).sort((e, t) => e.start - t.start);
    if (!n.length) return [];
    const r = [];
    const o = n[0].start;
    if (o >= e) {
      const e = cutFromGap(0, o);
      if (e) r.push(e);
    }
    for (let e = 0; e < n.length - 1; e++) {
      const t = n[e].end;
      const i = n[e + 1].start;
      const o = cutFromGap(t, i);
      if (o) r.push(o);
    }
    const s = n[n.length - 1].end;
    if (i > 0 && i - s >= e) {
      const e = cutFromGap(s, i);
      if (e) r.push(e);
    }
    return mergeRegions(r);
  }
  async function detectFromAudio(e, t) {
    if (!e || t < 1) return [];
    const i = e.currentSrc || e.src;
    if (!i) return [];
    let o;
    try {
      const e = await fetch(i, {
        credentials: "include",
        cache: "force-cache"
      });
      if (!e.ok) return [];
      o = await e.arrayBuffer();
    } catch (e) {
      return [];
    }
    if (!o || o.byteLength < 1e3) return [];
    const s = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = window.AudioContext || window.webkitAudioContext;
    if (!c) return [];
    let l;
    try {
      l = new c;
      const e = await l.decodeAudioData(o.slice(0));
      await l.close().catch(() => {});
      l = null;
      const i = e.getChannelData(0);
      const s = e.sampleRate || 44100;
      const a = Math.max(1, Math.floor(s * n));
      const d = [];
      for (let e = 0; e < i.length; e += a) {
        let t = 0;
        const n = Math.min(i.length, e + a);
        for (let r = e; r < n; r++) t += i[r] * i[r];
        d.push(Math.sqrt(t / Math.max(1, n - e)));
      }
      if (!d.length) return [];
      const u = d.slice().sort((e, t) => e - t);
      const f = u[Math.floor(u.length * .85)] || .01;
      const w = Math.max(.004, f * r);
      const m = [];
      let p = -1;
      for (let e = 0; e < d.length; e++) {
        const i = e * n;
        const r = d[e] < w;
        if (r && p < 0) p = i;
        if ((!r || e === d.length - 1) && p >= 0) {
          const e = r ? Math.min(t, i + n) : i;
          const o = cutFromGap(p, e);
          if (o) m.push(o);
          p = -1;
        }
      }
      return mergeRegions(m);
    } catch (e) {
      try {
        await (l?.close?.());
      } catch (e) {}
      return [];
    } finally {
      void s;
    }
  }
  function totalRemoved(e) {
    return e.reduce((e, t) => e + Math.max(0, t.end - t.start), 0);
  }
  function formatRemoved(e) {
    const t = Math.round(e * 10) / 10;
    return Number.isInteger(t) ? String(t) : t.toFixed(1);
  }
  function showNote(e, {sticky: t = false} = {}) {
    const i = $("silencerNote");
    if (!i) return;
    i.hidden = false;
    i.textContent = e;
    i.classList.add("is-visible");
    if (i._hideTimer) clearTimeout(i._hideTimer);
    if (!t) {
      i._hideTimer = setTimeout(() => {
        i.classList.remove("is-visible");
        i.hidden = true;
      }, 3200);
    }
  }
  function hideNote() {
    const e = $("silencerNote");
    if (!e) return;
    if (e._hideTimer) clearTimeout(e._hideTimer);
    e.classList.remove("is-visible");
    e.hidden = true;
    e.textContent = "";
  }
  function setButtonState() {
    const e = $("previewSilencerBtn");
    if (!e) return;
    e.classList.toggle("is-silenced", o);
    e.classList.toggle("active", o);
    e.setAttribute("aria-pressed", o ? "true" : "false");
    e.removeAttribute("title");
    e.setAttribute("aria-label", o ? "Undo silence cleanup" : "Remove silences");
    const t = e.querySelector(".silencer-btn-label");
    if (t) t.textContent = o ? "Undo" : "";
  }
  function markDirty() {
    try {
      const e = window.clipsStudio;
      if (!e?.currentTemplateForPreview?.isLibraryPreview) return;
      e._librarySilenceDirty = o;
      e._librarySilenceCuts = o ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice() : [];
      if (o) {
        if (e._librarySplitscreenCustomize) e._librarySplitscreenDirty = true;
        if (e._libraryRankingEditable) e._libraryRankingDirty = true;
      } else {}
      const t = $("confirmUseTemplateBtn");
      if (t && o) {
        t.textContent = "Apply & Download";
        t.classList.add("library-download-mode");
      }
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
      if (typeof e._configureLibraryEditingUI === "function") {
        e._configureLibraryEditingUI();
      }
    } catch (e) {}
  }
  function remapCaptionsForCuts(e, t) {
    if (!Array.isArray(e) || !e.length || !t.length) return e;
    return e.map(e => {
      const i = Number(e.start);
      const n = Number(e.end);
      if (!Number.isFinite(i)) return e;
      for (const e of t) {
        if (i >= e.start - .01 && n <= e.end + .01) return null;
      }
      return {
        ...e,
        start: i,
        end: n
      };
    }).filter(Boolean);
  }
  async function detectCuts() {
    const e = getDuration();
    const t = getTimedWords();
    let i = detectFromWords(t, e);
    if (!i.length) {
      i = await detectFromAudio(getPreviewVideo(), e);
    }
    i = mergeRegions(i);
    try {
      const e = window.PreviewTimeline?.getActiveEditRange?.();
      if (e && e.segIndex != null && Number.isFinite(e.start) && Number.isFinite(e.end) && e.end - e.start > .4) {
        i = i.map(t => ({
          start: Math.max(t.start, e.start),
          end: Math.min(t.end, e.end)
        })).filter(e => e.end - e.start >= .22);
        i = mergeRegions(i);
      }
    } catch (e) {}
    return i;
  }
  async function applySilencer() {
    if (l || o) return;
    if (!isLibraryPreview()) return;
    if (!window.PreviewTimeline?.setSkipRegions) {
      showNote("Preview not ready yet");
      return;
    }
    l = true;
    const e = $("previewSilencerBtn");
    if (e) e.classList.add("is-working");
    try {
      const e = await detectCuts();
      if (!e.length) {
        showNote("No long pauses found");
        return;
      }
      const t = getTimedWords();
      s = totalRemoved(e);
      c = t ? t.map(e => ({
        ...e
      })) : null;
      window.PreviewTimeline.setSkipRegions(e);
      if (t && typeof window.setLiveCaptionTimedWords === "function") {
        const i = remapCaptionsForCuts(t, e);
        window.setLiveCaptionTimedWords(i);
      }
      o = true;
      setButtonState();
      markDirty();
      const i = window.PreviewTimeline?.getActiveEditRange?.();
      const n = i && i.segIndex != null;
      showNote(n ? `Removed ${formatRemoved(s)}s silence in block ${i.segIndex + 1}` : `Removed ${formatRemoved(s)}s of silence`);
      const r = getPreviewVideo();
      if (r) {
        try {
          const e = r.currentTime || 0;
          const t = window.PreviewTimeline.resolveSkipTime?.(e);
          if (t != null && Math.abs(t - e) > .05) {
            r.currentTime = t;
          }
          r.play().catch(() => {});
        } catch (e) {}
      }
    } finally {
      l = false;
      if (e) e.classList.remove("is-working");
    }
  }
  function undoSilencer() {
    if (!o) return;
    if (window.PreviewTimeline?.clearSkipRegions) {
      window.PreviewTimeline.clearSkipRegions();
    }
    if (c && typeof window.setLiveCaptionTimedWords === "function") {
      window.setLiveCaptionTimedWords(c);
    }
    c = null;
    s = 0;
    o = false;
    setButtonState();
    markDirty();
    hideNote();
    showNote("Silence restored");
  }
  function resetSilencer() {
    if (window.PreviewTimeline?.clearSkipRegions) {
      window.PreviewTimeline.clearSkipRegions();
    }
    c = null;
    s = 0;
    o = false;
    l = false;
    setButtonState();
    hideNote();
    try {
      if (window.clipsStudio) {
        window.clipsStudio._librarySilenceDirty = false;
        window.clipsStudio._librarySilenceCuts = [];
      }
    } catch (e) {}
  }
  function toggleSilencer(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isLibraryPreview()) return;
    if (o) undoSilencer(); else applySilencer();
  }
  function syncVisibility() {
    const e = $("previewSilencerBtn");
    const t = $("previewImproveBtn");
    const i = $("previewModifiersBtn");
    const n = $("previewModifiersMenu");
    const r = $("previewEditorPill");
    const o = isLibraryPreview();
    if (e) {
      e.style.display = o ? "" : "none";
      if (!o) resetSilencer(); else setButtonState();
    }
    if (t) {
      t.style.display = o ? "" : "none";
      if (!o) {
        try {
          window.SolisImproveClip?.reset?.();
        } catch (e) {}
      } else {
        try {
          window.SolisImproveClip?.syncVisibility?.();
        } catch (e) {}
      }
    }
    if (i) i.style.display = o ? "none" : "";
    if (n && o) {
      n.hidden = true;
      if (i) i.setAttribute("aria-expanded", "false");
    }
    if (r) {
      const n = o && e && e.style.display !== "none";
      const s = o && t && t.style.display !== "none";
      const c = !o && i && i.style.display !== "none";
      r.classList.toggle("has-feature-tools", Boolean(n || s || c));
    }
  }
  window.SolisSilencer = {
    toggle: toggleSilencer,
    apply: applySilencer,
    undo: undoSilencer,
    reset: resetSilencer,
    syncVisibility: syncVisibility,
    detectCuts: detectCuts,
    isApplied: () => o,
    getCuts: () => o ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice() : [],
    getRemovedSec: () => s
  };
  document.addEventListener("DOMContentLoaded", () => {
    const e = $("previewSilencerBtn");
    if (e && !e.dataset.bound) {
      e.dataset.bound = "1";
      e.addEventListener("click", toggleSilencer);
    }
    syncVisibility();
  });
})();
