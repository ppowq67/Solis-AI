(function initSolisSilencer() {
  const e = .5;
  const t = .14;
  const i = .22;
  const n = .05;
  const o = .11;
  let r = false;
  let s = 0;
  let a = null;
  let c = false;
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
  function cutFromGap(n, o) {
    const r = o - n;
    if (r < e) return null;
    const s = Math.min(t, Math.max(.08, r * .22));
    const a = n + s;
    const c = o;
    if (c - a < i) return null;
    return {
      start: Math.round(a * 1e3) / 1e3,
      end: Math.round(c * 1e3) / 1e3
    };
  }
  function detectFromWords(t, i) {
    const n = (t || []).filter(e => e && e.kind !== "reaction").map(e => ({
      start: Number(e.start),
      end: Number(e.end)
    })).filter(e => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start).sort((e, t) => e.start - t.start);
    if (!n.length) return [];
    const o = [];
    const r = n[0].start;
    if (r >= e) {
      const e = cutFromGap(0, r);
      if (e) o.push(e);
    }
    for (let e = 0; e < n.length - 1; e++) {
      const t = n[e].end;
      const i = n[e + 1].start;
      const r = cutFromGap(t, i);
      if (r) o.push(r);
    }
    const s = n[n.length - 1].end;
    if (i > 0 && i - s >= e) {
      const e = cutFromGap(s, i);
      if (e) o.push(e);
    }
    return mergeRegions(o);
  }
  async function detectFromAudio(e, t) {
    if (!e || t < 1) return [];
    let i = e.currentSrc || e.src;
    if (!i) return [];
    let r;
    try {
      if (typeof fetchSecureVideoObjectUrl === "function" && i.startsWith("http")) {
        try {
          i = await fetchSecureVideoObjectUrl(i);
        } catch (e) {}
      }
      const e = await fetch(i, {
        credentials: "include",
        cache: "force-cache"
      });
      if (!e.ok) return [];
      r = await e.arrayBuffer();
    } catch (e) {
      return [];
    }
    if (!r || r.byteLength < 1e3) return [];
    const s = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const a = window.AudioContext || window.webkitAudioContext;
    if (!a) return [];
    let c;
    try {
      c = new a;
      const e = await c.decodeAudioData(r.slice(0));
      await c.close().catch(() => {});
      c = null;
      const i = e.getChannelData(0);
      const s = e.sampleRate || 44100;
      const l = Math.max(1, Math.floor(s * n));
      const d = [];
      for (let e = 0; e < i.length; e += l) {
        let t = 0;
        const n = Math.min(i.length, e + l);
        for (let o = e; o < n; o++) t += i[o] * i[o];
        d.push(Math.sqrt(t / Math.max(1, n - e)));
      }
      if (!d.length) return [];
      const u = d.slice().sort((e, t) => e - t);
      const f = u[Math.floor(u.length * .85)] || .01;
      const m = Math.max(.004, f * o);
      const w = [];
      let p = -1;
      for (let e = 0; e < d.length; e++) {
        const i = e * n;
        const o = d[e] < m;
        if (o && p < 0) p = i;
        if ((!o || e === d.length - 1) && p >= 0) {
          const e = o ? Math.min(t, i + n) : i;
          const r = cutFromGap(p, e);
          if (r) w.push(r);
          p = -1;
        }
      }
      return mergeRegions(w);
    } catch (e) {
      try {
        await (c?.close?.());
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
  function companionBegin(e) {
    try {
      const t = window.clipsStudio;
      if (t?._beginCompanionTask && isLibraryPreview()) {
        hideNote();
        return t._beginCompanionTask({
          reasoning: e
        });
      }
    } catch (e) {}
    return Promise.resolve();
  }
  function companionFinish(e) {
    try {
      const t = window.clipsStudio;
      if (t?._finishCompanionTask && isLibraryPreview()) {
        hideNote();
        return t._finishCompanionTask(String(e || ""));
      }
    } catch (e) {}
    showNote(e);
    return Promise.resolve();
  }
  function companionSpeak(e, t) {
    try {
      const i = window.clipsStudio;
      if (i?._speakCompanionTask && isLibraryPreview()) {
        hideNote();
        return i._speakCompanionTask(String(e || ""), {
          reasoning: t
        });
      }
    } catch (e) {}
    showNote(e);
    return Promise.resolve();
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
    e.classList.toggle("is-silenced", r);
    e.classList.toggle("active", r);
    e.setAttribute("aria-pressed", r ? "true" : "false");
    e.removeAttribute("title");
    e.setAttribute("aria-label", r ? "Undo silence cleanup" : "Remove silences");
    const t = e.querySelector(".silencer-btn-label");
    if (t) t.textContent = r ? "Undo" : "";
  }
  function markDirty() {
    try {
      const e = window.clipsStudio;
      if (!e?.currentTemplateForPreview?.isLibraryPreview) return;
      e._librarySilenceDirty = !!r;
      e._librarySilenceCuts = r ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice() : [];
      if (typeof window.syncLibraryConfirmLabel === "function") {
        window.syncLibraryConfirmLabel();
      } else {
        const e = $("confirmUseTemplateBtn");
        if (e) {
          const t = r ? "Apply & Download" : "Download";
          if (typeof window.setConfirmUseTemplateLabel === "function") {
            window.setConfirmUseTemplateLabel(t);
          } else {
            const i = e.querySelector(".template-use-confirm-label");
            if (i) i.textContent = t; else e.textContent = t;
          }
          e.classList.add("library-download-mode");
        }
        if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
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
  async function detectCutsFromServer() {
    try {
      const e = window.clipsStudio?.currentTemplateForPreview?.projectId;
      if (!e) return [];
      const t = typeof API_BASE_URL !== "undefined" && API_BASE_URL ? API_BASE_URL : "";
      const i = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
      const n = await fetch(`${t}/clips/projects/${encodeURIComponent(e)}/silence-preview`, {
        credentials: "include",
        headers: i
      });
      if (!n.ok) return [];
      const o = await n.json().catch(() => ({}));
      const r = o.caption_preview_words;
      if (Array.isArray(r) && r.length && typeof window.setLiveCaptionTimedWords === "function") {
        try {
          window.setLiveCaptionTimedWords(r);
        } catch (e) {}
      }
      const s = Array.isArray(o.cuts) ? o.cuts : [];
      return mergeRegions(s.map(e => ({
        start: Number(e.start),
        end: Number(e.end)
      })));
    } catch (e) {
      return [];
    }
  }
  async function detectCuts() {
    const e = getDuration();
    const t = getTimedWords();
    let i = detectFromWords(t, e);
    if (!i.length) {
      i = await detectFromAudio(getPreviewVideo(), e);
    }
    if (!i.length) {
      i = await detectCutsFromServer();
    }
    i = mergeRegions(i);
    try {
      const e = window.PreviewTimeline?.getActiveEditRange?.();
      if (e && (e.manual || e.segIndex != null) && Number.isFinite(e.start) && Number.isFinite(e.end) && e.end - e.start > .4) {
        i = i.map(t => ({
          start: Math.max(t.start, e.start),
          end: Math.min(t.end, e.end)
        })).filter(e => e.end - e.start >= .22);
        i = mergeRegions(i);
      }
    } catch (e) {}
    return i;
  }
  async function commitSilencer(e, t = {}) {
    if (!e.length) return;
    const i = getTimedWords();
    s = totalRemoved(e);
    a = i ? i.map(e => ({
      ...e
    })) : null;
    window.PreviewTimeline.setSkipRegions(e);
    if (i && typeof window.setLiveCaptionTimedWords === "function") {
      const t = remapCaptionsForCuts(i, e);
      window.setLiveCaptionTimedWords(t);
    }
    r = true;
    setButtonState();
    markDirty();
    const n = window.PreviewTimeline?.getActiveEditRange?.();
    const o = n && n.segIndex != null;
    const c = t.message || (o ? `Removed ${formatRemoved(s)}s of silence in block ${n.segIndex + 1}.` : `Removed ${formatRemoved(s)}s of silence.`);
    companionSpeak(c, t.reasoning || [ "Cutting dead air from the timeline.", "Updating playback skips." ]);
    const l = getPreviewVideo();
    if (l) {
      try {
        const e = l.currentTime || 0;
        const t = window.PreviewTimeline.resolveSkipTime?.(e);
        if (t != null && Math.abs(t - e) > .05) {
          l.currentTime = t;
        }
        l.play().catch(() => {});
      } catch (e) {}
    }
  }
  async function applySilencer() {
    if (c || r) return;
    if (!isLibraryPreview()) return;
    if (!window.PreviewTimeline?.setSkipRegions) {
      companionSpeak("Preview isn’t ready yet.", [ "Waiting on the timeline." ]);
      return;
    }
    if (window.SolisSilenceCutSuggest?.isOpen?.()) return;
    c = true;
    const e = $("previewSilencerBtn");
    if (e) e.classList.add("is-working");
    try {
      await companionBegin([ "Scanning for pauses…", "Listening for dead air.", "Checking what you want cut." ]);
      const e = await detectCuts();
      if (!e.length) {
        await companionFinish("No long pauses found.");
        return;
      }
      const t = window.PreviewTimeline?.getActiveEditRange?.();
      const i = t && t.segIndex != null;
      const n = formatRemoved(totalRemoved(e));
      await companionFinish(i ? `Found ${n}s of silence in block ${t.segIndex + 1} — accept the red cuts?` : `Found ${n}s of silence — accept the red cuts?`);
      window.SolisSilenceCutSuggest?.show({
        source: "silencer",
        regions: e.map(e => ({
          ...e,
          kind: "remove"
        })),
        label: i ? `Red = ${n}s silence in block ${t.segIndex + 1} · Accept?` : `Red = ${n}s silence · Accept?`,
        onAccept: e => {
          commitSilencer(e);
          try {
            window.SolisMemory?.recordEditorialHabit?.("silence", true, {
              source: "silencer"
            });
          } catch (e) {}
        },
        onReject: () => {
          companionSpeak("Okay — left the pauses in.", [ "Keeping the original pacing." ]);
          try {
            window.SolisMemory?.recordEditorialHabit?.("silence", false, {
              source: "silencer"
            });
          } catch (e) {}
        }
      });
    } finally {
      c = false;
      if (e) e.classList.remove("is-working");
    }
  }
  async function maybeOfferHabit() {
    return false;
  }
  function undoSilencer() {
    if (!r) return;
    try {
      window.SolisSilenceCutSuggest?.clear?.();
    } catch (e) {}
    if (window.PreviewTimeline?.clearSkipRegions) {
      window.PreviewTimeline.clearSkipRegions();
    }
    if (a && typeof window.setLiveCaptionTimedWords === "function") {
      window.setLiveCaptionTimedWords(a);
    }
    a = null;
    s = 0;
    r = false;
    setButtonState();
    markDirty();
    hideNote();
    companionSpeak("Silence restored.", [ "Putting the pauses back." ]);
  }
  function resetSilencer() {
    try {
      window.SolisSilenceCutSuggest?.clear?.();
    } catch (e) {}
    if (window.PreviewTimeline?.clearSkipRegions) {
      window.PreviewTimeline.clearSkipRegions();
    }
    a = null;
    s = 0;
    r = false;
    c = false;
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
    if (r) undoSilencer(); else applySilencer();
  }
  function syncVisibility() {
    const e = $("previewSilencerBtn");
    const t = $("previewImproveBtn");
    const i = $("previewModifiersBtn");
    const n = $("previewModifiersMenu");
    const o = $("previewEditorPill");
    const r = isLibraryPreview();
    if (e) {
      e.style.display = r ? "" : "none";
      if (!r) resetSilencer(); else setButtonState();
    }
    if (t) {
      t.style.display = r ? "" : "none";
      if (!r) {
        try {
          window.SolisImproveClip?.reset?.();
        } catch (e) {}
      } else {
        try {
          window.SolisImproveClip?.syncVisibility?.();
        } catch (e) {}
      }
    }
    if (i) i.style.display = r ? "none" : "";
    if (n && r) {
      n.hidden = true;
      if (i) i.setAttribute("aria-expanded", "false");
    }
    if (o) {
      const n = r && e && e.style.display !== "none";
      const s = r && t && t.style.display !== "none";
      const a = !r && i && i.style.display !== "none";
      o.classList.toggle("has-feature-tools", Boolean(n || s || a));
    }
  }
  window.SolisSilencer = {
    toggle: toggleSilencer,
    apply: applySilencer,
    undo: undoSilencer,
    reset: resetSilencer,
    syncVisibility: syncVisibility,
    detectCuts: detectCuts,
    maybeOfferHabit: maybeOfferHabit,
    isApplied: () => r,
    getCuts: () => r ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice() : [],
    getRemovedSec: () => s,
    applyManualCut: (e, t) => {
      const i = Number(e);
      const n = Number(t);
      if (!Number.isFinite(i) || !Number.isFinite(n) || n - i < .2) return false;
      if (!window.PreviewTimeline?.setSkipRegions) return false;
      const o = {
        start: Math.min(i, n),
        end: Math.max(i, n),
        kind: "remove"
      };
      if (window.SolisSilenceCutSuggest?.show) {
        window.SolisSilenceCutSuggest.show({
          source: "cut",
          regions: [ o ],
          onAccept: e => {
            const t = r ? window.PreviewTimeline.getSkipRegions?.() || [] : [];
            const o = mergeRegions([ ...t, ...e.map(e => ({
              start: e.start,
              end: e.end
            })) ]);
            commitSilencer(o, {
              message: `Cut ${formatRemoved(n - i)}s.`,
              reasoning: [ "Cutting that selection out.", "Updating playback skips." ]
            });
            const s = Math.min(i, n) <= .45;
            try {
              window.SolisMemory?.recordEditorialHabit?.(s ? "tight_open" : "silence", true, {
                source: "manual_cut",
                weight: s ? 1 : .4
              });
            } catch (e) {}
          },
          onReject: () => {
            companionSpeak("Okay — kept that part.", [ "Leaving the selection in." ]);
            try {
              window.SolisMemory?.recordEditorialHabit?.("tight_open", false, {
                source: "manual_cut"
              });
            } catch (e) {}
          }
        });
        return true;
      }
      const s = r ? window.PreviewTimeline.getSkipRegions?.() || [] : [];
      const a = mergeRegions([ ...s, {
        start: o.start,
        end: o.end
      } ]);
      if (!a.length) return false;
      commitSilencer(a, {
        message: `Cut ${formatRemoved(n - i)}s.`,
        reasoning: [ "Cutting that selection out.", "Updating playback skips." ]
      });
      return true;
    }
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
