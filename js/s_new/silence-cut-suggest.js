(function initSilenceCutSuggest() {
  let e = null;
  let t = null;
  function $(e) {
    return document.getElementById(e);
  }
  function formatRemoved(e) {
    const t = Math.round(e * 10) / 10;
    return Number.isInteger(t) ? String(t) : t.toFixed(1);
  }
  function totalRemoved(e) {
    return (e || []).reduce((e, t) => {
      if (t?.kind === "add") return e;
      return e + Math.max(0, Number(t.end) - Number(t.start));
    }, 0);
  }
  function ensureActions() {
    const e = $("previewTimelineTrackCol") || $("previewTimelineWrap") || $("previewTimelineShell");
    if (t && e && t.parentElement === e) return t;
    if (t) t.remove();
    t = document.createElement("div");
    t.className = "preview-timeline-cut-actions sub-mem-actions";
    t.id = "previewCutActions";
    t.innerHTML = `\n            <button type="button" class="sub-mem-btn sub-mem-decline" id="previewCutReject" title="Reject" aria-label="Reject">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>\n                </svg>\n            </button>\n            <button type="button" class="sub-mem-btn sub-mem-accept" id="previewCutAccept" title="Accept · Tab" aria-label="Accept">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>\n                </svg>\n            </button>`;
    const bind = (e, n) => {
      const i = t.querySelector(e);
      if (!i) return;
      i.addEventListener("pointerdown", e => {
        e.preventDefault();
        e.stopPropagation();
        n();
      });
      i.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
      });
    };
    bind("#previewCutAccept", accept);
    bind("#previewCutReject", reject);
    if (e) e.appendChild(t); else document.body.appendChild(t);
    return t;
  }
  function showActions() {
    const e = ensureActions();
    e.classList.remove("hidden");
    e.classList.add("open");
    e.hidden = false;
  }
  function hideActions() {
    if (!t) return;
    t.classList.add("hidden");
    t.classList.remove("open");
    t.hidden = true;
  }
  function clearPreviewVisual() {
    try {
      window.PreviewTimeline?.clearSkipRegionsPreview?.();
    } catch (e) {}
  }
  function dismiss({callReject: t = true} = {}) {
    const n = e;
    e = null;
    clearPreviewVisual();
    hideActions();
    if (t && n?.onReject) {
      try {
        n.onReject(n.regions);
      } catch (e) {}
    }
  }
  function accept() {
    const t = e;
    if (!t) return;
    e = null;
    clearPreviewVisual();
    hideActions();
    try {
      t.onAccept?.(t.regions);
    } catch (e) {}
  }
  function reject() {
    dismiss({
      callReject: true
    });
  }
  async function show(t) {
    const n = Array.isArray(t?.regions) ? t.regions : [];
    if (!n.length && (t?.source === "silencer" || t?.source === "habit_silence")) return false;
    dismiss({
      callReject: false
    });
    e = {
      regions: n.map(e => ({
        start: e.start,
        end: e.end,
        kind: e.kind === "add" ? "add" : "remove"
      })),
      source: t?.source || "silencer",
      onAccept: t?.onAccept,
      onReject: t?.onReject
    };
    const i = Date.now() + 4500;
    while (Date.now() < i) {
      const e = window.PreviewTimeline?.getTrim?.();
      if (window.PreviewTimeline?.isBound?.() && e?.duration > 0) break;
      await new Promise(e => setTimeout(e, 60));
    }
    try {
      if (e.regions.length) {
        window.PreviewTimeline?.setSkipRegionsPreview?.(e.regions);
      }
    } catch (e) {}
    ensureActions();
    showActions();
    return true;
  }
  function isOpen() {
    return Boolean(e);
  }
  function getPending() {
    return e ? {
      ...e,
      regions: e.regions.slice()
    } : null;
  }
  document.addEventListener("keydown", t => {
    if (!e) return;
    if (t.key === "Tab" && !t.shiftKey) {
      t.preventDefault();
      accept();
    } else if (t.key === "Escape") {
      t.preventDefault();
      reject();
    }
  });
  window.addEventListener("resize", () => {
    if (e) showActions();
  }, {
    passive: true
  });
  window.SolisSilenceCutSuggest = {
    show: show,
    accept: accept,
    reject: reject,
    dismiss: dismiss,
    clear: () => dismiss({
      callReject: false
    }),
    isOpen: isOpen,
    getPending: getPending,
    reposition: showActions
  };
})();
