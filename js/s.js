if (!window.API_BASE_URL) {
  const e = window.location.hostname;
  const t = e === "localhost" || e === "127.0.0.1";
  window.API_BASE_URL = t ? `https://api.solisai.video/api` : "https://api.solisai.video/api";
}

const originalFetch = window.fetch;

window.fetch = async function(...e) {
  const t = String(e[0]);
  const n = e[1] || {};
  let i = await originalFetch.apply(this, e);
  if (i.status !== 401) return i;
  if (t.includes("/auth/logout") || t.includes("/auth/check") || t.includes("/auth/refresh")) {
    return i;
  }
  if (n._authRetried) return i;
  const r = {
    ...n,
    _authRetried: true
  };
  try {
    const e = await originalFetch(`${window.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (e.ok) {
      i = await originalFetch(t, r);
      if (i.status !== 401) return i;
    }
    const n = await originalFetch(`${window.API_BASE_URL}/auth/check`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (n.ok) {
      const e = await n.json();
      if (e.authenticated && e.user) {
        i = await originalFetch(t, r);
        if (i.status !== 401) return i;
      }
    }
  } catch (e) {}
  if (i.status === 401 && !window.location.pathname.includes("login")) {
    console.error("[GLOBAL 401 HANDLER] Session unrecoverable — redirecting to login");
    window.currentUser = null;
    localStorage.removeItem("currentUser");
    localStorage.removeItem("auth_token");
    if (typeof stopTokenRefreshInterval === "function") stopTokenRefreshInterval();
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 100);
  }
  return i;
};

let cooldownTimer = null;

function startCooldownTimer(e) {
  const t = document.getElementById("processUrlBtn");
  if (!t) return;
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
  }
  let n = Math.max(0, e);
  const i = '<i class="fas fa-arrow-right"></i>';
  t.disabled = true;
  t.classList.add("is-generating");
  t.style.opacity = "0.5";
  t.style.cursor = "not-allowed";
  t.innerHTML = `${n}s`;
  t.style.fontSize = "0.85em";
  cooldownTimer = setInterval(() => {
    n--;
    if (n > 0) {
      t.innerHTML = `${n}s`;
    } else {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      t.disabled = false;
      t.classList.remove("is-generating");
      t.style.opacity = "1";
      t.style.cursor = "pointer";
      t.innerHTML = i;
      t.style.fontSize = "1em";
    }
  }, 1e3);
}

const workspacePanel = document.getElementById("solisWorkspacePanel");

const closeWorkspaceBtn = workspacePanel?.querySelector(".solis-close-btn");

const appContainer = document.getElementById("appContainer");

const sidebar = document.querySelector(".sidebar");

const userProfile = document.getElementById("userProfile");

const userMenu = document.getElementById("userMenu");

const settingsBtn = document.getElementById("settingsBtn");

const settingsPanel = document.getElementById("settingsPanel");

const closeSettings = document.getElementById("closeSettings");

const darkModeSettingsToggle = document.getElementById("darkModeSettingsToggle");

const upgradeModal = document.getElementById("upgradeModal");

const closeUpgrade = document.getElementById("closeUpgrade");

const upgradeSettingsBtn = document.getElementById("upgradeSettingsBtn");

const tokenCount = document.querySelector(".token-count");

const navItems = document.querySelectorAll(".nav-item");

const signInBtn = document.getElementById("signInBtn");

const signInDisplay = document.querySelector(".nav-item.sign-in");

let isRecording = false;

let mediaRecorder = null;

let audioChunks = [];

let isGenerating = false;

let currentTheme = "light";

let tokens = 1500;

let currentChatId = null;

let currentAbortController = null;

let uploadedFiles = [];

let currentUser = null;

let promptCount = 0;

let solisWSClient = null;

let selectedGameplayClip = "minecraft_1";

let availableGameplayClips = [];

let splitscreenInverted = true;

let splitscreenSecondaryType = "face_track";

let splitscreenCanvasMode = "blank";

let splitscreenContentRatio = .5;

let splitscreenSavedRatio = .5;

let splitscreenSecondaryCollapsed = false;

const SPLITSCREEN_CONTENT_MIN = 0;

const SPLITSCREEN_COLLAPSE_SNAP = 14;

const SPLITSCREEN_IMMERSIVE_ENTER = .92;

const SPLITSCREEN_PEEK_EXIT = .28;

const SPLITSCREEN_COLLAPSE_ANIM_MS = 180;

let _splitscreenDragRaf = 0;

let _splitscreenDragPending = null;

let gameplayPillInitialized = false;

let gpPill = null;

let gpDdLayout = null;

let gpDdClips = null;

let gpPillAnchor = null;

let gpPillFocusMode = null;

let splitscreenVideoCanPlayHandler = null;

let _gpCommittedSecondary = null;

let _gpCommittedLayout = null;

let _splitscreenScopeEl = null;

function setSplitscreenScope(e) {
  _splitscreenScopeEl = e && e.querySelector ? e : null;
}

function _splitscreenQuery(e) {
  if (_splitscreenScopeEl) {
    const t = _splitscreenScopeEl.querySelector(`#${e}`);
    if (t) return t;
  }
  return document.getElementById(e);
}

function buildSplitscreenPreviewShell() {
  return `\n        <div id="splitscreenRoot" style="display:flex;flex-direction:column;height:100%;width:100%;background:#111;overflow:hidden;border-radius:inherit;user-select:none;">\n            <div id="splitscreenTop" style="flex:0 0 50%;width:100%;min-height:0;background:#000;position:relative;overflow:hidden;">\n                <div class="ss-panel-crop-viewport" id="splitscreenContentViewport">\n                    <video id="splitscreenContentVideo" autoplay muted loop playsinline preload="auto"></video>\n                </div>\n            </div>\n                <div id="splitscreenDivider" style="flex:0 0 1px;width:100%;height:1px;min-height:1px;max-height:1px;cursor:row-resize;display:flex;align-items:center;justify-content:center;position:relative;z-index:50;background:transparent;flex-shrink:0;overflow:visible;padding:0;margin:0;">\n                <div id="dividerLine" class="ss-divider-grip" style="position:absolute;left:0;right:0;top:50%;width:100%;height:1px;background:rgba(148,163,184,0.85);border-radius:0;box-shadow:none;pointer-events:none;transform:translateY(-50%);"></div>\n            </div>\n            <div id="splitscreenBottom" style="flex:1 1 0;width:100%;min-height:0;background:#000;position:relative;overflow:hidden;" data-no-text-select="true">\n                <div class="ss-panel-crop-viewport" id="splitscreenSecondaryViewport">\n                    <video id="splitscreenGameplayVideo" autoplay muted loop playsinline preload="auto"></video>\n                    <video id="splitscreenReframeVideo" autoplay muted loop playsinline preload="auto" style="display:none;"></video>\n                </div>\n            </div>\n        </div>\n    `;
}

let _librarySplitscreenCropState = null;

let _librarySplitscreenCropObserver = null;

let _librarySplitscreenObjectUrls = [];

let _blankBlurObjectUrl = null;

let _libraryPlaybackSyncCleanup = null;

let _libraryCropSyncRaf = null;

let _previewAudioEnabled = false;

let _ignorePreviewModalBackdropCloseUntil = 0;

function armPreviewModalDragGuard(e = 500) {
  _ignorePreviewModalBackdropCloseUntil = Date.now() + e;
}

function shouldIgnorePreviewModalBackdropClose() {
  return Date.now() < _ignorePreviewModalBackdropCloseUntil;
}

window.armPreviewModalDragGuard = armPreviewModalDragGuard;

window.shouldIgnorePreviewModalBackdropClose = shouldIgnorePreviewModalBackdropClose;

const PREVIEW_AUDIO_ICON_MUTED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9.5v5h3.2L12 19.2V4.8L6.7 9.5H3.5z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16.2 9.2l4.6 5.6M20.8 9.2l-4.6 5.6"/></svg>`;

const PREVIEW_AUDIO_ICON_ON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9.5v5h3.2L12 19.2V4.8L6.7 9.5H3.5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.6 9.4a3.2 3.2 0 0 1 0 5.2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18.2 7.2a6.2 6.2 0 0 1 0 9.6"/></svg>`;

function getPreviewAudioVideos(e) {
  const t = e || document.getElementById("templateVideoPreview");
  if (!t) return [];
  const n = t.querySelector("#splitscreenContentVideo");
  const i = t.querySelector("video.library-preview-video");
  if (n?.src || n?.currentSrc) return [ n ];
  if (i?.src || i?.currentSrc) return [ i ];
  return Array.from(t.querySelectorAll("video")).filter(e => {
    if (!e.src && !e.currentSrc) return false;
    if (e.id === "splitscreenReframeVideo" || e.id === "splitscreenGameplayVideo") return false;
    if (e.classList.contains("gp-blank-blur-vid")) return false;
    return true;
  });
}

function applyPreviewAudioState(e) {
  const t = e || document.getElementById("templateVideoPreview");
  if (!t) return;
  const n = new Set(getPreviewAudioVideos(t));
  t.querySelectorAll("video").forEach(e => {
    if (n.has(e)) {
      e.muted = !_previewAudioEnabled;
      if (_previewAudioEnabled) e.volume = 1;
      e.loop = true;
      if (_previewAudioEnabled && e.paused && !e.ended) {
        e.play().catch(() => {});
      }
    } else {
      e.muted = true;
    }
  });
  const i = document.getElementById("previewAudioToggle") || t.querySelector(".preview-audio-toggle");
  if (i) {
    i.hidden = false;
    i.classList.toggle("is-unmuted", _previewAudioEnabled);
    i.setAttribute("aria-pressed", _previewAudioEnabled ? "true" : "false");
    i.title = _previewAudioEnabled ? "Mute preview" : "Unmute preview";
    i.setAttribute("aria-label", _previewAudioEnabled ? "Mute preview" : "Unmute preview");
    i.innerHTML = _previewAudioEnabled ? PREVIEW_AUDIO_ICON_ON : PREVIEW_AUDIO_ICON_MUTED;
  }
}

function ensurePreviewAudioToggle(e) {
  const t = e || document.getElementById("templateVideoPreview");
  if (!t) return null;
  let n = document.getElementById("previewAudioToggle");
  if (!n) {
    n = document.createElement("button");
    n.type = "button";
    n.id = "previewAudioToggle";
    n.className = "preview-audio-toggle";
    t.appendChild(n);
  } else if (n.parentElement !== t) {
    t.appendChild(n);
  }
  if (!n.dataset.bound) {
    n.dataset.bound = "1";
    n.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      _previewAudioEnabled = !_previewAudioEnabled;
      applyPreviewAudioState(document.getElementById("templateVideoPreview") || t);
    });
  }
  _previewAudioEnabled = false;
  applyPreviewAudioState(t);
  return n;
}

const PreviewTimeline = (() => {
  const e = .25;
  const t = 14;
  const n = 56;
  const i = 100;
  const r = 100;
  const o = 24;
  const s = new Map;
  let a = null;
  let l = false;
  let c = null;
  let d = 0;
  let p = 1;
  let u = 0;
  let m = 0;
  let f = false;
  let y = 0;
  let g = null;
  let h = null;
  let w = 0;
  let v = 0;
  let b = null;
  let S = null;
  let k = false;
  let _ = 0;
  let L = 0;
  let C = 0;
  let P = 0;
  let I = 1;
  let x = [];
  let E = -1;
  let T = 0;
  let M = 1;
  let B = null;
  let A = false;
  let R = null;
  let U = 0;
  let D = null;
  let F = false;
  let N = false;
  const O = 180;
  const G = 8;
  let $ = [ 5, 4, 3, 2, 1 ];
  const z = [];
  let j;
  let H;
  let V;
  let q;
  let W;
  let Y;
  let Q;
  let J;
  let X;
  let K;
  let Z;
  let ee;
  let te;
  function refreshEls() {
    j = document.getElementById("previewTimelineShell");
    H = document.getElementById("previewTimelineWrap");
    V = document.getElementById("previewTimelineCurrent");
    q = document.getElementById("previewTimelineDuration");
    W = H;
    Y = document.getElementById("previewTimelineFilmstrip");
    Q = document.getElementById("previewTimelineSegments");
    J = document.getElementById("previewTimelineDimLeft");
    X = document.getElementById("previewTimelineDimRight");
    K = document.getElementById("previewTimelineSelection");
    Z = document.getElementById("previewTimelineHandleL");
    ee = document.getElementById("previewTimelineHandleR");
    te = document.getElementById("previewTimelinePlayhead");
  }
  function setHandlesUnlocked(e) {
    A = !!e;
    if (j) j.classList.toggle("handles-on", A);
  }
  function setRankingEditMode(e) {
    refreshEls();
    if (j) j.classList.toggle("is-ranking-edit", !!e);
    if (e) setHandlesUnlocked(true);
    if (!e) $ = [ 5, 4, 3, 2, 1 ];
  }
  function isRankingEdit() {
    return !!j?.classList.contains("is-ranking-edit");
  }
  function getClipOrder() {
    const e = Math.max(1, getSegmentBounds().length - 1);
    while ($.length < e) {
      const e = Math.max(1, 5 - $.length);
      if (!$.includes(e)) $.push(e); else $.push($.length + 1);
    }
    return $.slice(0, e);
  }
  function setClipOrder(e) {
    if (!Array.isArray(e) || !e.length) {
      $ = [ 5, 4, 3, 2, 1 ];
      return;
    }
    const t = e.map(e => Math.max(1, Math.min(5, Number(e) || 0))).filter(Boolean);
    $ = t.length ? t : [ 5, 4, 3, 2, 1 ];
  }
  function markRankingTimelineDirty() {
    try {
      PreviewTimeline._rankingTouched = true;
    } catch (e) {}
    try {
      const e = window.clipsStudio;
      if (e?.currentTemplateForPreview?.isLibraryPreview && e._libraryRankingEditable) {
        e._libraryRankingDirty = true;
        const t = document.getElementById("confirmUseTemplateBtn");
        if (t) {
          t.textContent = "Apply & Download";
          t.classList.add("library-download-mode");
        }
        if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
      }
    } catch (e) {}
    try {
      markLibrarySplitscreenDirty();
    } catch (e) {}
  }
  function segmentIndexAtClientX(e) {
    const t = getSegmentBounds();
    if (t.length < 2) return -1;
    const n = timeFromClientX(e);
    for (let e = 0; e < t.length - 1; e++) {
      if (n >= t[e] - .001 && n <= t[e + 1] + .001) return e;
    }
    if (n < t[0]) return 0;
    return t.length - 2;
  }
  function rebuildSplitsFromLengths(t) {
    if (!t.length) return;
    let n = d;
    x = [];
    for (let i = 0; i < t.length - 1; i++) {
      n += Math.max(e, Number(t[i]) || e);
      if (n < p - .04) x.push(n);
    }
    const i = t.reduce((t, n) => t + Math.max(e, Number(n) || e), 0);
    const r = d + i;
    if (r > d + e) {
      p = Math.min(u, r);
    }
  }
  function applySegmentReorder(t, n) {
    const i = getSegmentBounds();
    const r = i.length - 1;
    if (t < 0 || n < 0 || t >= r || n >= r || t === n) return false;
    const o = getClipOrder();
    const [s] = o.splice(t, 1);
    o.splice(n, 0, s);
    $ = o;
    const a = [];
    for (let t = 0; t < r; t++) a.push(Math.max(e, i[t + 1] - i[t]));
    const [l] = a.splice(t, 1);
    a.splice(n, 0, l);
    rebuildSplitsFromLengths(a);
    try {
      window.clipsStudio?.onRankingClipReorder?.($.slice());
    } catch (e) {}
    return true;
  }
  function paintSegmentReorderGhost(e) {
    if (!D || !isRankingEdit()) return;
    const t = segmentIndexAtClientX(e);
    D.hoverIndex = t;
    const n = Array.from(Q?.children || []);
    n.forEach((e, n) => {
      e.classList.toggle("is-drop-target", n === t && n !== D.index);
      e.classList.toggle("is-dragging", n === D.index);
    });
    const i = e - D.startX;
    const r = n[D.index];
    if (r) {
      const e = (() => {
        const e = getSegmentBounds();
        return e[D.index] / u * I;
      })();
      r.style.transform = `translate3d(${e + i}px,0,0)`;
      r.style.zIndex = "5";
    }
  }
  function fmt(e) {
    if (!Number.isFinite(e) || e < 0) e = 0;
    const t = Math.floor(e / 60);
    const n = Math.floor(e % 60);
    return `${t}:${String(n).padStart(2, "0")}`;
  }
  function cacheKey(e, n) {
    return `${e}|${Math.round(n * 10) / 10}|${t}`;
  }
  function rememberCache(e, t) {
    if (s.has(e)) s.delete(e);
    s.set(e, t);
    while (s.size > o) {
      const e = s.keys().next().value;
      s.delete(e);
    }
  }
  function cacheTrackMetrics() {
    if (!W) return;
    const e = W.getBoundingClientRect();
    P = e.left;
    I = Math.max(1, e.width);
  }
  function timeFromClientX(e) {
    if (!u) return 0;
    const t = (e - P) / I;
    return Math.max(0, Math.min(u, t * u));
  }
  function paintChrome({rebuildSegments: e = false} = {}) {
    const t = c === "start" || c === "end" || c === "bound" || c === "segment";
    if (!t) {
      if (V) V.textContent = fmt(m);
      if (q) q.textContent = fmt(u || 0);
    }
    if (!u || I <= 0) return;
    const n = d / u * I;
    const i = p / u * I;
    const r = Math.max(2, i - n);
    if (K) {
      K.style.width = `${r}px`;
      K.style.transform = `translate3d(${n}px,0,0)`;
    }
    if (J) J.style.width = `${n}px`;
    if (X) X.style.width = `${Math.max(0, I - i)}px`;
    if (te && !t) {
      const e = Math.max(d, Math.min(p, m));
      const t = e / u * I;
      te.style.transform = `translate3d(${t}px,0,0) translateX(-50%)`;
    }
    if (!t && W) {
      W.setAttribute("aria-valuenow", String(Math.round(m / u * 100)));
      W.setAttribute("aria-valuetext", fmt(m));
    }
    if (t) paintSegmentsFast(); else if (e) paintSegments();
  }
  function schedulePaintChrome(e) {
    if (v) return;
    v = requestAnimationFrame(() => {
      v = 0;
      paintChrome(e);
    });
  }
  function cloneFilmInto(e) {
    if (!Y) return;
    const n = Y.querySelectorAll(".preview-timeline-frame");
    if (!n.length) {
      for (let n = 0; n < t; n++) {
        const t = document.createElement("div");
        t.className = "preview-timeline-frame";
        e.appendChild(t);
      }
      return;
    }
    n.forEach(t => {
      const n = document.createElement("div");
      n.className = "preview-timeline-frame";
      const i = t.querySelector("canvas");
      if (i) {
        const e = document.createElement("canvas");
        e.width = i.width;
        e.height = i.height;
        e.getContext("2d")?.drawImage(i, 0, 0);
        n.appendChild(e);
      }
      e.appendChild(n);
    });
  }
  const ne = 6;
  function getSegmentBounds() {
    const e = x.filter(e => e > d + .04 && e < p - .04);
    return [ d, ...e, p ];
  }
  function makeSegHandle(e, t) {
    const n = document.createElement("button");
    n.type = "button";
    n.className = `preview-timeline-handle ${e}`;
    n.setAttribute("aria-label", e === "left" ? "Drag clip start" : "Drag clip end");
    n.title = e === "left" ? "Drag to adjust start" : "Drag to adjust end";
    n.dataset.boundIndex = String(t);
    n.addEventListener("pointerdown", e => startBoundDrag(t, e));
    return n;
  }
  function clearSegHold() {
    if (U) {
      clearTimeout(U);
      U = 0;
    }
    N = false;
  }
  function customizeSegment(e) {
    const t = Math.max(1, 5 - e);
    const n = document.querySelector("#templateVideoPreview .ranking-preview-container, .ranking-preview-container");
    const i = n?.querySelector(`[data-template-element-id="rank_${t}_number"]`);
    const r = n?.querySelector(`[data-template-element-id="rank_${t}_title"]`);
    const o = i || r;
    if (!o) return;
    const s = getSegmentBounds();
    if (s[e] != null) {
      m = s[e];
      scheduleSeek(m, true);
      paintChrome();
    }
    try {
      const e = window.rankingTemplateEditor;
      if (e?.handleTextClick) {
        e.handleTextClick(o, false, null);
      } else if (window.RankingTextPill?.selectElements) {
        window.RankingTextPill.selectElements([ o ], "single", o);
      }
    } catch (e) {}
    Q?.querySelectorAll(".preview-timeline-segment.is-selected").forEach(e => e.classList.remove("is-selected"));
    Q?.children?.[e]?.classList.add("is-selected");
  }
  function applySegmentTimes(t, n, i) {
    const r = getSegmentBounds();
    if (t < 0 || t >= r.length - 1) return;
    const o = t === 0 ? 0 : r[t - 1] + e;
    const s = t >= r.length - 2 ? u : r[t + 2] - e;
    const a = Math.max(e, i - n);
    let l = Math.max(o, Math.min(n, s - a));
    let c = l + a;
    if (c > s) {
      c = s;
      l = Math.max(o, c - a);
    }
    if (t === 0) d = l; else {
      const e = r[t];
      const n = x.findIndex(t => Math.abs(t - e) < .05);
      if (n >= 0) x[n] = l; else x.push(l);
    }
    if (t === r.length - 2) p = c; else {
      const e = r[t + 1];
      const n = x.findIndex(t => Math.abs(t - e) < .05);
      if (n >= 0) x[n] = c; else x.push(c);
    }
    x = x.filter(e => e > d + .04 && e < p - .04).sort((e, t) => e - t);
  }
  function paintSegmentMove(e) {
    if (!D || !u || I <= 0) return;
    if (isRankingEdit()) {
      paintSegmentReorderGhost(e);
      return;
    }
    const {index: t, startX: n, startA: i, startB: r} = D;
    const o = (e - n) / I * u;
    applySegmentTimes(t, i + o, r + o);
    m = Math.max(d, Math.min(p, i + o));
    const s = d / u * I;
    const a = p / u * I;
    if (K) {
      K.style.width = `${Math.max(2, a - s)}px`;
      K.style.transform = `translate3d(${s}px,0,0)`;
    }
    if (J) J.style.width = `${s}px`;
    if (X) X.style.width = `${Math.max(0, I - a)}px`;
    paintSegmentsFast();
  }
  function beginSegmentDrag() {
    if (!D || c === "segment") return;
    clearTimeout(U);
    U = 0;
    if (isRankingEdit() && !N) return;
    c = "segment";
    f = a ? !a.paused : false;
    if (a && !a.paused) a.pause();
    W?.classList.add("is-dragging", "is-trimming");
    if (isRankingEdit()) W?.classList.add("is-reordering");
    D.target?.classList.add("is-dragging");
    Q?.children?.[D.index]?.classList.add("is-dragging");
    if (D.target?.setPointerCapture && D.pointerId != null) {
      try {
        D.target.setPointerCapture(D.pointerId);
      } catch (e) {}
    }
  }
  function onSegmentPointerDown(e, t) {
    if (t.target?.closest?.(".preview-timeline-handle")) return;
    if (t.pointerType === "mouse" && t.button !== 0) return;
    t.preventDefault();
    t.stopPropagation();
    if (!A && !j?.classList.contains("is-ranking-edit")) {
      setHandlesUnlocked(true);
    }
    cacheTrackMetrics();
    clearSegHold();
    const n = getSegmentBounds();
    if (e < 0 || e >= n.length - 1) return;
    F = false;
    N = false;
    D = {
      index: e,
      pointerId: t.pointerId,
      startX: t.clientX,
      startA: n[e],
      startB: n[e + 1],
      target: t.currentTarget
    };
    U = setTimeout(() => {
      U = 0;
      N = true;
      D?.target?.classList.add("is-hold-ready");
    }, O);
  }
  function onSegmentPointerMove(e) {
    if (!D) return;
    const t = Math.abs(e.clientX - D.startX);
    if (c === "segment") {
      e.preventDefault();
      if (t >= G) F = true;
      if (!F) return;
      paintSegmentMove(e.clientX);
      return;
    }
    if (isRankingEdit()) {
      if (N && t >= G) {
        beginSegmentDrag();
        if (c === "segment") {
          F = true;
          paintSegmentMove(e.clientX);
        }
      }
      return;
    }
    if (t >= G) {
      beginSegmentDrag();
      F = true;
      paintSegmentMove(e.clientX);
    }
  }
  function onSegmentPointerUp(e) {
    if (!D) return;
    const t = D;
    const n = F;
    const i = t.hoverIndex;
    clearSegHold();
    t.target?.classList.remove("is-dragging", "is-hold-ready");
    Q?.children?.[t.index]?.classList.remove("is-dragging");
    Q?.querySelectorAll(".is-drop-target").forEach(e => e.classList.remove("is-drop-target"));
    W?.classList.remove("is-reordering");
    if (c === "segment" && !n) {
      c = null;
      D = null;
      W?.classList.remove("is-dragging", "is-trimming");
      if (f) a?.play().catch(() => {});
      f = false;
      customizeSegment(t.index);
      return;
    }
    if (n) {
      const e = isRankingEdit() && i != null && i !== t.index && applySegmentReorder(t.index, i);
      c = null;
      D = null;
      markRankingTimelineDirty();
      scheduleSeek(m, true);
      if (f) a?.play().catch(() => {});
      f = false;
      paintChrome({
        rebuildSegments: true
      });
      if (e) {
        try {
          showNotification?.("Clip order updated — Apply & Download to burn.", "info");
        } catch (e) {}
      }
      return;
    }
    D = null;
    c = null;
    customizeSegment(t.index);
  }
  function paintSegments(e) {
    if (!Q || !u || I <= 0) return;
    const t = getSegmentBounds();
    Q.innerHTML = "";
    for (let n = 0; n < t.length - 1; n++) {
      const i = t[n];
      const r = t[n + 1];
      let o = i / u * I;
      let s = r / u * I;
      if (n > 0) o += ne / 2;
      if (n < t.length - 2) s -= ne / 2;
      const a = Math.max(8, s - o);
      const l = document.createElement("div");
      l.className = "preview-timeline-segment";
      l.dataset.segIndex = String(n);
      if (e != null && (Math.abs(i - e) < .03 || Math.abs(r - e) < .03)) {
        l.classList.add("is-new");
      }
      l.style.width = `${a}px`;
      l.style.transform = `translate3d(${o}px,0,0)`;
      const c = document.createElement("div");
      c.className = "preview-timeline-segment-clip";
      const d = getClipOrder()[n] || 5 - n;
      c.title = isRankingEdit() ? `Hold & drag to reorder · #${d}` : "Click to customize · Drag to move";
      c.setAttribute("role", "button");
      c.tabIndex = 0;
      c.dataset.physicalRank = String(d);
      if (isRankingEdit()) {
        const e = document.createElement("span");
        e.className = "preview-timeline-seg-rank";
        e.textContent = `#${5 - n}`;
        c.appendChild(e);
      }
      const p = document.createElement("div");
      p.className = "preview-timeline-segment-film";
      p.style.width = `${I}px`;
      p.style.transform = `translate3d(${-o}px,0,0)`;
      cloneFilmInto(p);
      c.appendChild(p);
      c.addEventListener("pointerdown", e => onSegmentPointerDown(n, e));
      c.addEventListener("pointermove", onSegmentPointerMove);
      c.addEventListener("pointerup", onSegmentPointerUp);
      c.addEventListener("pointercancel", onSegmentPointerUp);
      l.appendChild(c);
      if (n === 0) l.appendChild(makeSegHandle("left", n));
      l.appendChild(makeSegHandle("right", n + 1));
      Q.appendChild(l);
    }
  }
  function paintSegmentsFast() {
    if (!Q || !u || I <= 0) return;
    const e = Array.from(Q.children);
    const t = getSegmentBounds();
    if (e.length !== t.length - 1) {
      paintSegments();
      return;
    }
    for (let n = 0; n < t.length - 1; n++) {
      const i = t[n];
      const r = t[n + 1];
      let o = i / u * I;
      let s = r / u * I;
      if (n > 0) o += ne / 2;
      if (n < t.length - 2) s -= ne / 2;
      const a = Math.max(6, s - o);
      const l = e[n];
      l.style.width = `${a}px`;
      l.style.transform = `translate3d(${o}px,0,0)`;
      const c = l.querySelector(".preview-timeline-segment-film");
      if (c) {
        c.style.width = `${I}px`;
        c.style.transform = `translate3d(${-o}px,0,0)`;
      }
      const d = l.querySelector(".preview-timeline-handle.left");
      const p = l.querySelector(".preview-timeline-handle.right");
      if (d) d.dataset.boundIndex = String(n);
      if (p) p.dataset.boundIndex = String(n + 1);
    }
  }
  function applyBoundTime(e) {
    if (E === 0) {
      d = e;
      return;
    }
    const t = getSegmentBounds();
    if (E >= t.length - 1) {
      p = e;
      return;
    }
    if (B != null) {
      const t = x.findIndex(e => Math.abs(e - B) < .05);
      if (t >= 0) x[t] = e; else x.push(e);
      B = e;
    } else {
      x.push(e);
    }
    x.sort((e, t) => e - t);
  }
  function paintBoundFast(e) {
    if (!u || I <= 0 || E < 0) return;
    const t = timeFromClientX(e);
    const n = Math.max(T, Math.min(M, t));
    applyBoundTime(n);
    m = n;
    const i = d / u * I;
    const r = p / u * I;
    if (K) {
      K.style.width = `${Math.max(2, r - i)}px`;
      K.style.transform = `translate3d(${i}px,0,0)`;
    }
    if (J) J.style.width = `${i}px`;
    if (X) X.style.width = `${Math.max(0, I - r)}px`;
    paintSegmentsFast();
  }
  function startBoundDrag(t, n) {
    if (!A && !j?.classList.contains("is-ranking-edit")) return;
    if (!A) setHandlesUnlocked(true);
    if (n.pointerType === "mouse" && n.button !== 0) return;
    n.preventDefault();
    n.stopPropagation();
    cacheTrackMetrics();
    const i = getSegmentBounds();
    if (t < 0 || t >= i.length) return;
    c = "bound";
    E = t;
    T = t === 0 ? 0 : i[t - 1] + e;
    M = t === i.length - 1 ? u : i[t + 1] - e;
    B = t > 0 && t < i.length - 1 ? i[t] : null;
    f = a ? !a.paused : false;
    if (a && !a.paused) a.pause();
    W?.classList.add("is-dragging", "is-trimming");
    n.currentTarget?.classList.add("is-dragging");
    if (n.currentTarget?.setPointerCapture && n.pointerId != null) {
      try {
        n.currentTarget.setPointerCapture(n.pointerId);
      } catch (e) {}
    }
    paintBoundFast(n.clientX);
  }
  function paintTrimFast(t) {
    if (!u || I <= 0) return;
    if (c === "bound") {
      paintBoundFast(t);
      return;
    }
    const n = timeFromClientX(t);
    if (c === "start") {
      d = Math.max(0, Math.min(n, p - e));
    } else if (c === "end") {
      p = Math.min(u, Math.max(n, d + e));
    } else {
      return;
    }
    const i = d / u * I;
    const r = p / u * I;
    const o = Math.max(2, r - i);
    if (K) {
      K.style.width = `${o}px`;
      K.style.transform = `translate3d(${i}px,0,0)`;
    }
    if (J) J.style.width = `${i}px`;
    if (X) X.style.width = `${Math.max(0, I - r)}px`;
    paintSegmentsFast();
  }
  function scheduleSeek(e, t = false) {
    if (!a || !Number.isFinite(e)) return;
    S = Math.max(0, Math.min(u || e, e));
    const n = performance.now();
    const i = t ? 0 : Math.max(0, r - (n - _));
    if (L) {
      clearTimeout(L);
      L = 0;
    }
    if (i === 0) {
      flushSeek();
    } else {
      L = setTimeout(() => {
        L = 0;
        flushSeek();
      }, i);
    }
  }
  function flushSeek() {
    if (!a || S == null || k) return;
    const e = S;
    S = null;
    if (Math.abs((a.currentTime || 0) - e) < .012) {
      if (!c) {
        m = a.currentTime || e;
        paintChrome();
      }
      return;
    }
    k = true;
    _ = performance.now();
    const onSeeked = () => {
      k = false;
      a.removeEventListener("seeked", onSeeked);
      if (!c) {
        m = a.currentTime || m;
        paintChrome();
      }
      if (S != null) flushSeek();
    };
    a.addEventListener("seeked", onSeeked);
    try {
      a.currentTime = e;
    } catch (e) {
      k = false;
    }
  }
  function waitEvent(e, t, n = 2e3) {
    return new Promise(i => {
      let r = false;
      const finish = () => {
        if (r) return;
        r = true;
        e.removeEventListener(t, finish);
        i();
      };
      e.addEventListener(t, finish);
      setTimeout(finish, n);
    });
  }
  async function seekCapture(e, t) {
    if (!e) return;
    try {
      if (Math.abs((e.currentTime || 0) - t) > .01) {
        e.currentTime = t;
        await waitEvent(e, "seeked", 2e3);
      }
    } catch (e) {}
    await new Promise(t => {
      let n = false;
      const done = () => {
        if (n) return;
        n = true;
        t();
      };
      if (typeof e.requestVideoFrameCallback === "function") {
        try {
          e.requestVideoFrameCallback(() => done());
          setTimeout(done, 280);
          return;
        } catch (e) {}
      }
      setTimeout(done, 60);
    });
  }
  function destroyCaptureVideo() {
    if (g) {
      try {
        g.pause();
        g.removeAttribute("src");
        g.load();
      } catch (e) {}
      g = null;
    }
    if (h) {
      try {
        URL.revokeObjectURL(h);
      } catch (e) {}
      h = null;
    }
  }
  async function resolveCaptureSrc(e) {
    if (!e) return "";
    const t = e.startsWith("blob:") || /\/clips\/preview\//i.test(e) || /\/clips\/projects\/[^/]+\/preview/i.test(e) || /library[-_/]?preview/i.test(e);
    if (!t) return e;
    if (!e.startsWith("blob:")) return e;
    try {
      const t = await fetch(e, {
        credentials: "include",
        cache: "force-cache"
      });
      if (!t.ok) return e;
      const n = await t.blob();
      if (!n.size) return e;
      if (h) {
        try {
          URL.revokeObjectURL(h);
        } catch (e) {}
      }
      h = URL.createObjectURL(n.type ? n : new Blob([ n ], {
        type: "video/mp4"
      }));
      return h;
    } catch (t) {
      return e;
    }
  }
  function mountFilmstripCanvases(e) {
    if (!Y) return;
    Y.innerHTML = "";
    const n = document.createDocumentFragment();
    for (let i = 0; i < t; i++) {
      const t = document.createElement("div");
      t.className = "preview-timeline-frame";
      const r = e?.[i];
      if (r) {
        const e = document.createElement("canvas");
        e.width = r.width;
        e.height = r.height;
        const n = e.getContext("2d");
        n?.drawImage(r, 0, 0);
        t.appendChild(e);
      }
      n.appendChild(t);
    }
    Y.appendChild(n);
    paintSegments();
  }
  function buildPlaceholderFilmstrip() {
    mountFilmstripCanvases(null);
  }
  async function buildFilmstripFromVideo() {
    if (!Y || !a) return;
    const e = a.currentSrc || a.src;
    if (!e || !u || u <= 0) {
      buildPlaceholderFilmstrip();
      return;
    }
    const r = cacheKey(e, u);
    const o = s.get(r);
    if (o?.length) {
      mountFilmstripCanvases(o);
      return;
    }
    const l = ++y;
    buildPlaceholderFilmstrip();
    destroyCaptureVideo();
    const c = document.createElement("video");
    c.muted = true;
    c.playsInline = true;
    c.preload = "auto";
    c.setAttribute("playsinline", "");
    c.src = await resolveCaptureSrc(e);
    if (l !== y) {
      destroyCaptureVideo();
      return;
    }
    g = c;
    try {
      await Promise.race([ waitEvent(c, "loadeddata", 8e3), waitEvent(c, "loadedmetadata", 8e3) ]);
      for (let e = 0; e < 20 && !(c.videoWidth > 2); e++) {
        await new Promise(e => setTimeout(e, 50));
      }
      if (l !== y) return;
      const e = Math.max(.01, u - .04);
      const o = [];
      for (let r = 0; r < t; r++) {
        if (l !== y) return;
        const s = r / Math.max(1, t - 1) * e;
        await seekCapture(c, s);
        if (l !== y) return;
        const a = document.createElement("canvas");
        a.width = n;
        a.height = i;
        const d = a.getContext("2d", {
          alpha: false
        });
        if (!d) {
          o.push(a);
          continue;
        }
        d.fillStyle = "#334155";
        d.fillRect(0, 0, n, i);
        const p = c.videoWidth || 0;
        const u = c.videoHeight || 0;
        if (p > 2 && u > 2) {
          const e = Math.max(n / p, i / u);
          const t = p * e;
          const r = u * e;
          try {
            d.drawImage(c, (n - t) / 2, (i - r) / 2, t, r);
          } catch (e) {}
        }
        o.push(a);
      }
      if (l === y && o.length) {
        rememberCache(r, o);
        mountFilmstripCanvases(o);
      }
    } catch (e) {} finally {
      if (g === c) destroyCaptureVideo();
      if (l === y && !Y?.querySelector("canvas")) {
        paintSegments();
      }
    }
  }
  function clampPlayback() {
    if (!a || !u || c || k) return;
    const e = a.currentTime || 0;
    if (e < d - .02) {
      const e = !a.paused;
      try {
        a.currentTime = d;
      } catch (e) {
        scheduleSeek(d, true);
      }
      m = d;
      if (e) a.play().catch(() => {});
      return;
    }
    if (e > p - .05) {
      const e = !a.paused;
      try {
        a.currentTime = d;
      } catch (e) {
        scheduleSeek(d, true);
      }
      m = d;
      if (e) {
        a.loop = true;
        a.play().catch(() => {});
      }
      paintChrome();
    }
  }
  function applyPointer(e, {seek: t = true} = {}) {
    if (!c || !u) return;
    if (c === "start" || c === "end" || c === "bound") {
      paintTrimFast(e);
      return;
    }
    if (c === "scrub") {
      const n = timeFromClientX(e);
      m = Math.max(d, Math.min(p, n));
      paintChrome();
      if (t) scheduleSeek(m);
    }
  }
  function onPointerMove(e) {
    if (D && c !== "segment") {
      onSegmentPointerMove(e);
      if (c === "segment") return;
    }
    if (!c) return;
    e.preventDefault();
    if (c === "start" || c === "end" || c === "bound") {
      paintTrimFast(e.clientX);
      return;
    }
    if (c === "segment") {
      paintSegmentMove(e.clientX);
      return;
    }
    b = e.clientX;
    if (w) return;
    w = requestAnimationFrame(() => {
      w = 0;
      const e = b;
      b = null;
      if (e == null) return;
      applyPointer(e, {
        seek: true
      });
    });
  }
  function endDrag() {
    if (D) {
      onSegmentPointerUp();
      return;
    }
    if (!c) return;
    const e = c;
    W?.classList.remove("is-scrubbing", "is-trimming", "is-dragging");
    Q?.querySelectorAll(".preview-timeline-handle.is-dragging").forEach(e => e.classList.remove("is-dragging"));
    Z?.classList.remove("is-dragging");
    ee?.classList.remove("is-dragging");
    if (b != null) {
      applyPointer(b, {
        seek: false
      });
      b = null;
    }
    if (w) {
      cancelAnimationFrame(w);
      w = 0;
    }
    c = null;
    E = -1;
    B = null;
    if (e === "start" || e === "end" || e === "bound") {
      m = Math.max(d, Math.min(p, m));
      if (d > .05 || p < u - .05) {
        try {
          markLibrarySplitscreenDirty();
        } catch (e) {}
      }
      if (e === "bound") {
        try {
          PreviewTimeline._rankingTouched = true;
        } catch (e) {}
      }
    }
    const t = e === "scrub" ? m : m;
    scheduleSeek(t, true);
    if (f) a?.play().catch(() => {});
    f = false;
    paintChrome({
      rebuildSegments: e === "start" || e === "end" || e === "bound"
    });
  }
  function startDrag(e, t) {
    if ((e === "start" || e === "end" || e === "bound") && !A && !j?.classList.contains("is-ranking-edit")) return;
    if ((e === "start" || e === "end" || e === "bound") && !A) {
      setHandlesUnlocked(true);
    }
    if (t.pointerType === "mouse" && t.button !== 0) return;
    t.preventDefault();
    t.stopPropagation();
    cacheTrackMetrics();
    if (X) {
      X.style.left = "auto";
      X.style.right = "0";
    }
    c = e;
    f = a ? !a.paused : false;
    if (a && !a.paused) a.pause();
    W?.classList.add("is-dragging");
    if (e === "scrub") W?.classList.add("is-scrubbing"); else W?.classList.add("is-trimming");
    if (e === "start") Z?.classList.add("is-dragging");
    if (e === "end") ee?.classList.add("is-dragging");
    if (t.currentTarget?.setPointerCapture && t.pointerId != null) {
      try {
        t.currentTarget.setPointerCapture(t.pointerId);
      } catch (e) {}
    }
    applyPointer(t.clientX, {
      seek: e === "scrub"
    });
  }
  function bindEvents() {
    if (!j || !H || !a) return;
    const onTime = () => {
      if (c) return;
      clampPlayback();
      m = a.currentTime || m;
      schedulePaintChrome();
    };
    const onMeta = () => {
      const e = Number.isFinite(a.duration) ? a.duration : 0;
      const t = Math.abs(e - u) > .05;
      u = e;
      if (t || p <= d) {
        d = 0;
        p = u || 1;
      }
      cacheTrackMetrics();
      paintChrome({
        rebuildSegments: true
      });
      if (t) scheduleFilmstripBuild();
    };
    const onResize = () => {
      cacheTrackMetrics();
      paintChrome({
        rebuildSegments: true
      });
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    window.addEventListener("resize", onResize, {
      passive: true
    });
    z.push(() => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      window.removeEventListener("resize", onResize);
    });
    const onTrackDown = e => {
      if (e.target?.closest?.(".preview-timeline-handle")) return;
      if (e.target?.closest?.(".preview-timeline-segment-clip")) return;
      startDrag("scrub", e);
    };
    const onStartDown = e => startDrag("start", e);
    const onEndDown = e => startDrag("end", e);
    W?.addEventListener("pointerdown", onTrackDown);
    Z?.addEventListener("pointerdown", onStartDown);
    ee?.addEventListener("pointerdown", onEndDown);
    window.addEventListener("pointermove", onPointerMove, {
      passive: false
    });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    z.push(() => {
      W?.removeEventListener("pointerdown", onTrackDown);
      Z?.removeEventListener("pointerdown", onStartDown);
      ee?.removeEventListener("pointerdown", onEndDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    });
    const onTimeChipDown = e => {
      e.preventDefault();
      e.stopPropagation();
      setHandlesUnlocked(true);
      H?.focus?.({
        preventScroll: true
      });
    };
    V?.addEventListener("pointerdown", onTimeChipDown);
    q?.addEventListener("pointerdown", onTimeChipDown);
    z.push(() => {
      V?.removeEventListener("pointerdown", onTimeChipDown);
      q?.removeEventListener("pointerdown", onTimeChipDown);
    });
    const onKey = e => {
      if (!a || !u) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const t = e.key === "ArrowLeft" ? -.5 : .5;
        m = Math.max(d, Math.min(p, (a.currentTime || 0) + t));
        paintChrome();
        scheduleSeek(m, true);
      }
    };
    W?.addEventListener("keydown", onKey);
    z.push(() => W?.removeEventListener("keydown", onKey));
    const e = document.getElementById("previewTimelineSplitBtn");
    const onSplitClick = t => {
      t.preventDefault();
      t.stopPropagation();
      const n = Number.isFinite(a?.currentTime) ? a.currentTime : m;
      const i = splitAt(n);
      if (!i && x.length >= 4) {
        e?.classList.remove("is-flash");
        void e?.offsetWidth;
        e?.classList.add("is-flash");
      }
    };
    e?.addEventListener("click", onSplitClick);
    z.push(() => e?.removeEventListener("click", onSplitClick));
  }
  function show() {
    const e = document.getElementById("previewTimelineRow");
    if (e) e.hidden = false;
    if (j) j.hidden = false;
    const t = document.getElementById("previewAudioToggle");
    if (t) t.hidden = false;
    try {
      if (typeof window.syncPreviewTimelineHookLane === "function") {
        window.syncPreviewTimelineHookLane();
      }
    } catch (e) {}
  }
  function hide() {
    const e = document.getElementById("previewTimelineRow");
    if (e) e.hidden = true;
    if (j) j.hidden = true;
    const t = document.getElementById("previewAudioToggle");
    if (t) t.hidden = true;
    const n = document.getElementById("previewTimelineHookLane");
    if (n) n.hidden = true;
    if (typeof PreviewCtxMenu !== "undefined") PreviewCtxMenu.close();
  }
  function detach() {
    y += 1;
    destroyCaptureVideo();
    if (L) {
      clearTimeout(L);
      L = 0;
    }
    if (C) {
      clearTimeout(C);
      C = 0;
    }
    if (w) {
      cancelAnimationFrame(w);
      w = 0;
    }
    if (v) {
      cancelAnimationFrame(v);
      v = 0;
    }
    while (z.length) {
      try {
        z.pop()();
      } catch (e) {}
    }
    b = null;
    S = null;
    k = false;
    c = null;
    clearSegHold();
    D = null;
    F = false;
    f = false;
    x = [];
    R = null;
    A = false;
    if (j) {
      j.classList.remove("handles-on");
      j.classList.remove("is-ranking-edit");
    }
    if (Q) Q.innerHTML = "";
    a = null;
    l = false;
    u = 0;
    m = 0;
    d = 0;
    p = 1;
    hide();
  }
  function scheduleFilmstripBuild(e = 450) {
    if (C) {
      clearTimeout(C);
      C = 0;
    }
    const run = () => {
      C = 0;
      buildFilmstripFromVideo();
    };
    if (typeof requestIdleCallback === "function") {
      C = setTimeout(() => {
        requestIdleCallback(() => run(), {
          timeout: 1200
        });
      }, e);
    } else {
      C = setTimeout(run, e);
    }
  }
  function attach(e) {
    detach();
    if (!e) return;
    refreshEls();
    a = e;
    a.controls = false;
    a.removeAttribute("controls");
    a.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback noplaybackrate");
    a.disablePictureInPicture = true;
    u = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
    d = 0;
    p = u || 1;
    m = Number.isFinite(a.currentTime) ? a.currentTime : 0;
    setHandlesUnlocked(false);
    if (K) {
      K.style.left = "0";
      K.style.right = "auto";
    }
    if (te) te.style.left = "0";
    if (X) {
      X.style.left = "auto";
      X.style.right = "0";
    }
    buildPlaceholderFilmstrip();
    bindEvents();
    l = true;
    show();
    cacheTrackMetrics();
    paintChrome({
      rebuildSegments: true
    });
    const kickFilmstrip = () => {
      if (!a || a !== e) return;
      u = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : u;
      p = Math.max(p, u || 1);
      if (d >= p) {
        d = 0;
        p = u || 1;
      }
      cacheTrackMetrics();
      paintChrome({
        rebuildSegments: true
      });
      if (R && R.length) {
        const e = R.slice();
        R = null;
        setSplits(e);
      }
      scheduleFilmstripBuild();
    };
    if (u > 0 && a.readyState >= 2) {
      kickFilmstrip();
    } else {
      a.addEventListener("loadedmetadata", kickFilmstrip, {
        once: true
      });
      a.addEventListener("loadeddata", kickFilmstrip, {
        once: true
      });
      setTimeout(() => {
        if (!l || a !== e) return;
        if (Number.isFinite(a.duration) && a.duration > 0) kickFilmstrip();
      }, 350);
    }
  }
  function getTrim() {
    return {
      start: d,
      end: p,
      duration: u
    };
  }
  function getSegmentBoundsPublic() {
    if (!u) return [];
    return getSegmentBounds().slice();
  }
  function setSplits(e) {
    const t = Array.isArray(e) ? e : [];
    if (!u || u <= 0) {
      R = t.slice();
      return false;
    }
    const n = [];
    for (const e of t) {
      const t = Number(e);
      if (!Number.isFinite(t)) continue;
      const i = Math.max(d + .05, Math.min(p - .05, t));
      if (n.some(e => Math.abs(e - i) < .08)) continue;
      n.push(i);
    }
    n.sort((e, t) => e - t);
    x = n.slice(0, 4);
    R = null;
    cacheTrackMetrics();
    paintChrome({
      rebuildSegments: true
    });
    return true;
  }
  function clearSplits() {
    x = [];
    if (l) {
      cacheTrackMetrics();
      paintChrome({
        rebuildSegments: true
      });
    }
  }
  function focusTrim(t) {
    if (!l || !u) {
      const e = document.getElementById("previewTimelineHandleL");
      const t = document.getElementById("previewTimelineHandleR");
      [ e, t ].forEach(e => {
        if (!e) return;
        e.classList.remove("is-pulse");
        void e.offsetWidth;
        e.classList.add("is-pulse");
      });
      return;
    }
    cacheTrackMetrics();
    const n = Number.isFinite(t) ? t : m;
    const i = Math.min(2.5, Math.max(.8, u * .12));
    const r = p - d;
    if (r >= u * .95) {
      d = Math.max(0, n - i * .35);
      p = Math.min(u, Math.max(d + e, n + i * .65));
    }
    m = Math.max(d, Math.min(p, n));
    paintChrome({
      rebuildSegments: true
    });
    scheduleSeek(m, true);
    [ Z, ee ].forEach(e => {
      if (!e) return;
      e.classList.remove("is-pulse");
      void e.offsetWidth;
      e.classList.add("is-pulse");
      const done = () => {
        e.classList.remove("is-pulse");
        e.removeEventListener("animationend", done);
      };
      e.addEventListener("animationend", done);
    });
    H?.focus?.({
      preventScroll: true
    });
  }
  function splitAt(e) {
    if (!u || u <= 0) return false;
    cacheTrackMetrics();
    let t = Number.isFinite(e) ? e : m;
    t = Math.max(d + .05, Math.min(p - .05, t));
    if (x.some(e => Math.abs(e - t) < .08)) {
      paintSegments(t);
      return false;
    }
    if (x.length >= 4) {
      paintSegments(t);
      return false;
    }
    x.push(t);
    x.sort((e, t) => e - t);
    m = t;
    paintChrome();
    paintSegments(t);
    scheduleSeek(t, true);
    return true;
  }
  function getSplits() {
    return x.slice();
  }
  return {
    attach: attach,
    detach: detach,
    show: show,
    hide: hide,
    getTrim: getTrim,
    focusTrim: focusTrim,
    splitAt: splitAt,
    getSplits: getSplits,
    setSplits: setSplits,
    clearSplits: clearSplits,
    getSegmentBounds: getSegmentBoundsPublic,
    getClipOrder: getClipOrder,
    setClipOrder: setClipOrder,
    scheduleFilmstripBuild: scheduleFilmstripBuild,
    setHandlesUnlocked: setHandlesUnlocked,
    setRankingEditMode: setRankingEditMode,
    isBound: () => l
  };
})();

window.PreviewTimeline = PreviewTimeline;

const PreviewCtxMenu = (() => {
  let e = null;
  let t = 0;
  let n = 0;
  let i = false;
  function ensure() {
    e = document.getElementById("previewCtxMenu");
    if (e && e.parentElement !== document.body) {
      document.body.appendChild(e);
    }
    return e;
  }
  function close() {
    const e = ensure();
    if (!e) return;
    e.hidden = true;
  }
  function isLibraryPreview() {
    return Boolean(document.querySelector(".template-preview-content.is-library-preview"));
  }
  function placeAt(e, t) {
    const i = ensure();
    if (!i) return;
    i.hidden = false;
    i.style.left = "0px";
    i.style.top = "0px";
    const r = 8;
    const o = 8;
    const s = i.getBoundingClientRect();
    let a = e + 10;
    let l = t - s.height - o;
    if (a + s.width > window.innerWidth - r) {
      a = Math.max(r, window.innerWidth - s.width - r);
    }
    if (l < r) {
      l = Math.max(r, t - s.height - 4);
    }
    i.style.left = `${Math.round(Math.max(r, a))}px`;
    i.style.top = `${Math.round(l)}px`;
    n = performance.now();
    if (typeof lucide !== "undefined") {
      lucide.createIcons({
        attrs: {
          "stroke-width": 2.2
        },
        nameAttr: "data-lucide"
      });
    }
  }
  function timeAtEvent(e, t) {
    const n = typeof PreviewTimeline !== "undefined" ? PreviewTimeline.getTrim?.() : null;
    const i = n?.duration || 0;
    if (!t || !i) return n ? document.querySelector("#templateVideoPreview video")?.currentTime || 0 : 0;
    const r = t.getBoundingClientRect();
    const o = r.width ? (e.clientX - r.left) / r.width : 0;
    return Math.max(0, Math.min(i, o * i));
  }
  function openFromEvent(e) {
    if (!isLibraryPreview()) return false;
    const n = e.target;
    if (!(n instanceof Element)) return false;
    const i = n.closest("#previewTimelineWrap, #previewTimelineShell");
    const r = n.closest("#templateVideoPreview");
    if (!i && !r) return false;
    e.preventDefault();
    e.stopPropagation();
    const o = document.getElementById("previewTimelineWrap");
    t = i ? timeAtEvent(e, o) : document.querySelector("#templateVideoPreview video")?.currentTime || 0;
    placeAt(e.clientX, e.clientY);
    return true;
  }
  function onSplit() {
    close();
    if (typeof PreviewTimeline !== "undefined" && PreviewTimeline.splitAt) {
      PreviewTimeline.splitAt(t);
    }
  }
  function onAddText() {
    close();
    const e = document.getElementById("previewEditorPill");
    const t = e?.querySelector('[data-tool="text"]');
    if (t) t.style.display = "";
    if (t && typeof window.activatePreviewToolbar === "function") {
      window.activatePreviewToolbar(t);
    }
    if (typeof window.addSimpleTextBlock === "function") {
      window.addSimpleTextBlock();
    }
  }
  function onMenuPointerDown(e) {
    const t = e.target?.closest?.("[data-ctx-action]");
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    const n = t.getAttribute("data-ctx-action");
    if (n === "split" || n === "trim") onSplit(); else if (n === "text") onAddText();
  }
  function onDocPointerDown(e) {
    const t = ensure();
    if (!t || t.hidden) return;
    if (e.button === 2) return;
    if (performance.now() - n < 180) return;
    if (t.contains(e.target)) return;
    close();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function bindTargets() {
    if (i) return;
    i = true;
    ensure();
    document.addEventListener("contextmenu", e => {
      openFromEvent(e);
    }, true);
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey);
    const e = ensure();
    e?.addEventListener("pointerdown", onMenuPointerDown);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTargets, {
      once: true
    });
  } else {
    bindTargets();
  }
  setTimeout(bindTargets, 0);
  return {
    open: openFromEvent,
    close: close,
    bindTargets: bindTargets
  };
})();

window.PreviewCtxMenu = PreviewCtxMenu;

function scheduleLibrarySplitscreenCropSync() {
  if (_libraryCropSyncRaf) return;
  _libraryCropSyncRaf = requestAnimationFrame(() => {
    _libraryCropSyncRaf = null;
    syncLibrarySplitscreenCropPreview();
  });
}

function revokeLibrarySplitscreenObjectUrls() {
  _librarySplitscreenObjectUrls.forEach(e => {
    try {
      URL.revokeObjectURL(e);
    } catch (e) {}
  });
  _librarySplitscreenObjectUrls = [];
  _blankBlurObjectUrl = null;
}

async function cloneBlobUrlForSecondVideo(e) {
  if (!e || !String(e).startsWith("blob:")) return e;
  const t = await fetch(e);
  if (!t.ok) throw new Error(`Blur blob clone failed (${t.status})`);
  const n = await t.blob();
  if (!n.size) throw new Error("Empty blur blob clone");
  const i = n.type ? n : new Blob([ n ], {
    type: "video/mp4"
  });
  const r = URL.createObjectURL(i);
  _librarySplitscreenObjectUrls.push(r);
  return r;
}

function revokeBlankBlurObjectUrl() {
  if (!_blankBlurObjectUrl) return;
  const e = _blankBlurObjectUrl;
  _blankBlurObjectUrl = null;
  _librarySplitscreenObjectUrls = _librarySplitscreenObjectUrls.filter(t => t !== e);
  try {
    URL.revokeObjectURL(e);
  } catch (e) {}
}

async function fetchSecureVideoObjectUrl(e) {
  const t = await fetch(e, {
    credentials: "include",
    headers: typeof getAuthHeaders === "function" ? getAuthHeaders() : {}
  });
  if (!t.ok) {
    throw new Error(`Media fetch failed (${t.status})`);
  }
  const n = t.headers.get("content-type") || "";
  if (n.includes("application/json")) {
    throw new Error("Media endpoint returned JSON instead of video");
  }
  const i = await t.blob();
  if (!i.size) throw new Error("Empty media response");
  const r = URL.createObjectURL(i.type ? i : new Blob([ i ], {
    type: "video/mp4"
  }));
  _librarySplitscreenObjectUrls.push(r);
  return r;
}

async function fetchSecureVideoObjectUrlPair(e) {
  const t = await fetch(e, {
    credentials: "include",
    headers: typeof getAuthHeaders === "function" ? getAuthHeaders() : {}
  });
  if (!t.ok) {
    throw new Error(`Media fetch failed (${t.status})`);
  }
  const n = t.headers.get("content-type") || "";
  if (n.includes("application/json")) {
    throw new Error("Media endpoint returned JSON instead of video");
  }
  const i = await t.blob();
  if (!i.size) throw new Error("Empty media response");
  const r = i.type ? i : new Blob([ i ], {
    type: "video/mp4"
  });
  const o = URL.createObjectURL(r);
  const s = URL.createObjectURL(r);
  _librarySplitscreenObjectUrls.push(o, s);
  return [ o, s ];
}

function bindLibrarySplitscreenPlaybackSync(e, t) {
  if (_libraryPlaybackSyncCleanup) {
    _libraryPlaybackSyncCleanup();
    _libraryPlaybackSyncCleanup = null;
  }
  if (!e || !t || e === t) return;
  e.loop = true;
  t.loop = true;
  if (!_previewAudioEnabled) {
    e.muted = true;
    t.muted = true;
  } else {
    e.muted = false;
    t.muted = true;
  }
  let n = 0;
  let i = null;
  let r = false;
  const playBoth = () => {
    if (e.paused) e.play().catch(() => {});
    if (t.paused) t.play().catch(() => {});
  };
  const syncSlaveTime = (i = false) => {
    if (r || e.seeking || t.seeking) return;
    if (!Number.isFinite(e.currentTime)) return;
    const o = Math.abs((t.currentTime || 0) - (e.currentTime || 0));
    const s = performance.now();
    if (!i && o < .45) return;
    if (!i && s - n < 1800) return;
    n = s;
    r = true;
    try {
      t.currentTime = e.currentTime;
    } catch (e) {} finally {
      setTimeout(() => {
        r = false;
      }, 120);
    }
    playBoth();
  };
  const onMasterPlay = () => {
    playBoth();
    syncSlaveTime(true);
  };
  const onSlavePause = () => {
    if (!e.paused) {
      setTimeout(() => {
        if (!e.paused && t.paused) t.play().catch(() => {});
      }, 100);
    }
  };
  const onTimeUpdate = () => syncSlaveTime(false);
  e.addEventListener("play", onMasterPlay);
  e.addEventListener("playing", onMasterPlay);
  e.addEventListener("timeupdate", onTimeUpdate);
  t.addEventListener("pause", onSlavePause);
  playBoth();
  setTimeout(() => syncSlaveTime(true), 200);
  i = window.setInterval(() => {
    if (!e.isConnected || !t.isConnected) return;
    playBoth();
    syncSlaveTime(false);
  }, 2500);
  _libraryPlaybackSyncCleanup = () => {
    if (i) {
      clearInterval(i);
      i = null;
    }
    e.removeEventListener("play", onMasterPlay);
    e.removeEventListener("playing", onMasterPlay);
    e.removeEventListener("timeupdate", onTimeUpdate);
    t.removeEventListener("pause", onSlavePause);
  };
}

function playBothLibraryPanels(e) {
  const t = e || _splitscreenScopeEl || document;
  const n = new Set(getPreviewAudioVideos(t));
  [ "splitscreenContentVideo", "splitscreenReframeVideo" ].forEach(e => {
    const i = t.querySelector && t.querySelector(`#${e}`) || document.getElementById(e);
    if (!i?.src) return;
    if (n.has(i)) {
      i.muted = !_previewAudioEnabled;
    } else {
      i.muted = true;
    }
    i.loop = true;
    i.play().catch(() => {});
  });
}

function setLibrarySplitscreenCropState(e) {
  if (!e || typeof e !== "object") {
    _librarySplitscreenCropState = null;
    return;
  }
  const t = Number.isFinite(Number(e.cropX)) ? Number(e.cropX) : null;
  let n = null;
  const i = e.faceCrop;
  if (Array.isArray(i) && i.length >= 4 && i.every(e => Number.isFinite(Number(e)))) {
    n = i.slice(0, 4).map(e => Number(e));
  } else if (i && typeof i === "object" && Number.isFinite(Number(i.w))) {
    n = [ Number(i.x) || 0, Number(i.y) || 0, Number(i.w) || 0, Number(i.h) || 0 ];
  }
  _librarySplitscreenCropState = {
    cropX: t,
    faceCrop: n,
    srcW: Number.isFinite(Number(e.srcW)) ? Number(e.srcW) : 0,
    srcH: Number.isFinite(Number(e.srcH)) ? Number(e.srcH) : 0,
    faceSrcW: Number.isFinite(Number(e.faceSrcW)) ? Number(e.faceSrcW) : 0,
    faceSrcH: Number.isFinite(Number(e.faceSrcH)) ? Number(e.faceSrcH) : 0,
    useLayers: Boolean(e.useLayers),
    secondaryFromLayer: Boolean(e.useLayers) && !e.liveFaceEdit,
    liveFaceEdit: Boolean(e.liveFaceEdit),
    faceDisplayMode: e.faceDisplayMode === "live" ? "live" : e.faceDisplayMode === "baked" ? "baked" : null
  };
}

function forceLibraryPanelVideoFill(e) {
  if (!e) return;
  e.classList.remove("ss-live-face-crop");
  e.style.setProperty("display", "block", "important");
  e.style.setProperty("visibility", "visible", "important");
  e.style.setProperty("opacity", "1", "important");
  e.style.setProperty("position", "absolute", "important");
  e.style.setProperty("left", "0", "important");
  e.style.setProperty("top", "0", "important");
  e.style.setProperty("right", "0", "important");
  e.style.setProperty("bottom", "0", "important");
  e.style.setProperty("width", "100%", "important");
  e.style.setProperty("height", "100%", "important");
  e.style.setProperty("min-height", "0", "important");
  e.style.setProperty("max-height", "none", "important");
  e.style.setProperty("max-width", "none", "important");
  e.style.setProperty("object-fit", "cover", "important");
  e.style.setProperty("z-index", "2", "important");
  e.style.setProperty("transform", "none", "important");
  e.style.setProperty("pointer-events", e.id === "splitscreenReframeVideo" ? "auto" : "none", "important");
}

function applyPanelCropPreviewBox(e, t, n, i, r) {
  if (!e || !t || !n || !i || !r) return;
  const o = Number(n[0]) || 0;
  const s = Number(n[1]) || 0;
  const a = Math.max(1, Number(n[2]) || i);
  const l = Math.max(1, Number(n[3]) || r);
  const c = e.closest(".ss-panel-crop-viewport") || t;
  const d = c.clientWidth || t.clientWidth || 1;
  const p = c.clientHeight || t.clientHeight || 1;
  if (d < 2 || p < 2) {
    forceLibraryPanelVideoFill(e);
    return;
  }
  const u = Math.max(d / a, p / l);
  e.classList.add("ss-live-face-crop");
  e.style.setProperty("position", "absolute", "important");
  e.style.setProperty("left", `${-o * u}px`, "important");
  e.style.setProperty("top", `${-s * u}px`, "important");
  e.style.setProperty("right", "auto", "important");
  e.style.setProperty("bottom", "auto", "important");
  e.style.setProperty("width", `${i * u}px`, "important");
  e.style.setProperty("height", `${r * u}px`, "important");
  e.style.setProperty("max-width", "none", "important");
  e.style.setProperty("object-fit", "fill", "important");
  e.style.setProperty("transform", "none", "important");
  e.style.setProperty("display", "block", "important");
  e.style.setProperty("visibility", "visible", "important");
  e.style.setProperty("opacity", "1", "important");
}

function applyContentCropPreview(e, t, n, i, r) {
  if (!e || !t || !i || !r) return;
  const o = e.closest(".ss-panel-crop-viewport") || t;
  const s = o.clientWidth || t.clientWidth || 1;
  const a = o.clientHeight || t.clientHeight || 1;
  if (s < 2 || a < 2) {
    forceLibraryPanelVideoFill(e);
    return;
  }
  const l = s / a;
  let c = r;
  let d = c * l;
  if (d > i) {
    d = i;
    c = d / l;
  }
  const p = n != null && Number(n) >= 0 ? Number(n) : Math.max(0, (i - d) / 2);
  const u = Math.max(0, (r - c) / 2);
  applyPanelCropPreviewBox(e, t, [ p, u, d, c ], i, r);
}

function syncLibrarySplitscreenCropPreview() {
  if (!_librarySplitscreenCropState || !window.clipsStudio?._librarySplitscreenCustomize) return;
  const e = _librarySplitscreenCropState;
  const t = _splitscreenQuery("splitscreenContentVideo");
  const n = _splitscreenQuery("splitscreenTop");
  const i = _splitscreenQuery("splitscreenReframeVideo");
  const r = _splitscreenQuery("splitscreenBottom");
  const o = _splitscreenQuery("splitscreenGameplayVideo");
  if (e.useLayers && t) {
    forceLibraryPanelVideoFill(t);
  } else if (t && n && e.srcW && e.srcH) {
    applyContentCropPreview(t, n, e.cropX, e.srcW, e.srcH);
  } else if (t) {
    forceLibraryPanelVideoFill(t);
  }
  if (splitscreenSecondaryType === "face_track" && i) {
    if (o) {
      o.style.setProperty("display", "none", "important");
    }
    if (e.faceDisplayMode === "baked" || !e.liveFaceEdit && e.secondaryFromLayer) {
      forceLibraryPanelVideoFill(i);
      return;
    }
    const t = e.faceSrcW || e.srcW;
    const n = e.faceSrcH || e.srcH;
    if (t && n && r && e.faceCrop && e.faceCrop.length === 4) {
      applyPanelCropPreviewBox(i, r, e.faceCrop, t, n);
      if (e.liveFaceEdit) {
        i.style.setProperty("pointer-events", "auto", "important");
        i.style.cursor = "grab";
      }
    } else {
      forceLibraryPanelVideoFill(i);
    }
    return;
  }
  if (e.secondaryFromLayer && o) {
    forceLibraryPanelVideoFill(o);
  }
}

function bindFaceReframePanHandlers() {
  const e = _splitscreenQuery("splitscreenReframeVideo");
  const t = _splitscreenQuery("splitscreenBottom") || _splitscreenQuery("splitscreenSecondaryViewport");
  if (!e || !t) return;
  if (e.dataset.facePanBound === "true") return;
  e.dataset.facePanBound = "true";
  let n = 0;
  let i = 0;
  let r = null;
  let o = false;
  let s = false;
  let a = false;
  let l = null;
  let c = false;
  const d = 6;
  const onMove = (l, c) => {
    if (!o || !_librarySplitscreenCropState?.liveFaceEdit) return;
    const p = _librarySplitscreenCropState;
    const u = p.faceSrcW || p.srcW;
    const m = p.faceSrcH || p.srcH;
    if (!p?.faceCrop || !u || !m || !r) return;
    const f = Math.hypot(l - n, c - i);
    if (!s) {
      if (f < d) return;
      s = true;
      a = true;
      armPreviewModalDragGuard(800);
      e.style.cursor = "grabbing";
    }
    const y = _splitscreenQuery("splitscreenBottom") || t;
    const g = e.closest(".ss-panel-crop-viewport") || y;
    const h = g.clientWidth || y.clientWidth || 1;
    const w = g.clientHeight || y.clientHeight || 1;
    const v = r[2];
    const b = r[3];
    const S = Math.max(h / Math.max(1, v), w / Math.max(1, b));
    const k = (l - n) / S;
    const _ = (c - i) / S;
    let L = r[0] - k;
    let C = r[1] - _;
    L = Math.max(0, Math.min(u - v, L));
    C = Math.max(0, Math.min(m - b, C));
    p.faceCrop = [ L, C, v, b ];
    syncLibrarySplitscreenCropPreview();
  };
  const endPan = (t = null) => {
    if (!o) return;
    const n = s;
    o = false;
    s = false;
    e.style.cursor = "grab";
    if (t != null && e.hasPointerCapture?.(t)) {
      try {
        e.releasePointerCapture(t);
      } catch (e) {}
    }
    l = null;
    if (n) {
      markLibrarySplitscreenDirty();
      armPreviewModalDragGuard(800);
      a = true;
      setTimeout(() => {
        a = false;
      }, 50);
    }
  };
  const beginTrack = (e, a, c = null) => {
    const d = _librarySplitscreenCropState;
    if (!d?.liveFaceEdit || splitscreenSecondaryType !== "face_track") return;
    const p = d.faceSrcW || d.srcW;
    const u = d.faceSrcH || d.srcH;
    if (!p || !u) return;
    if (!d.faceCrop || d.faceCrop.length < 4) {
      const e = _splitscreenQuery("splitscreenBottom") || t;
      const n = (e.clientWidth || 9) / Math.max(1, e.clientHeight || 16);
      let i = u * .55;
      let r = i * n;
      if (r > p) {
        r = p * .7;
        i = r / n;
      }
      d.faceCrop = [ Math.max(0, (p - r) / 2), Math.max(0, (u - i) / 2), r, i ];
    }
    if (d.faceDisplayMode !== "live") {
      d.faceDisplayMode = "live";
      syncLibrarySplitscreenCropPreview();
    }
    o = true;
    s = false;
    n = e;
    i = a;
    r = d.faceCrop.slice();
    l = c;
    armPreviewModalDragGuard(800);
  };
  e.addEventListener("pointerdown", async t => {
    if (t.button !== 0 && t.pointerType === "mouse") return;
    t.preventDefault();
    t.stopPropagation();
    if (!c && _librarySplitscreenCropState && (_librarySplitscreenCropState.faceDisplayMode === "baked" || _librarySplitscreenCropState.secondaryFromLayer)) {
      c = true;
      try {
        await promoteReframeToLiveEdit();
      } finally {
        c = false;
      }
    }
    try {
      e.setPointerCapture(t.pointerId);
    } catch (e) {}
    beginTrack(t.clientX, t.clientY, t.pointerId);
  });
  e.addEventListener("pointermove", e => {
    if (!o) return;
    if (l != null && e.pointerId !== l) return;
    e.preventDefault();
    onMove(e.clientX, e.clientY);
  });
  const onPointerEnd = e => {
    if (!o) return;
    if (l != null && e.pointerId !== l) return;
    e.preventDefault();
    e.stopPropagation();
    endPan(e.pointerId);
  };
  e.addEventListener("pointerup", onPointerEnd);
  e.addEventListener("pointercancel", onPointerEnd);
  e.addEventListener("lostpointercapture", () => {
    if (o) endPan(l);
  });
  e.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    if (a || s) {
      a = false;
      return;
    }
    if (typeof showSplitscreenCustomizer === "function") {
      showSplitscreenCustomizer(e, "fill");
    }
  });
}

async function promoteReframeToLiveEdit() {
  const e = _librarySplitscreenCropState;
  const t = getLibraryPreviewProjectId();
  const n = _splitscreenQuery("splitscreenReframeVideo");
  const i = _splitscreenQuery("splitscreenContentVideo");
  if (!e || !t || !n) return;
  if (e.faceDisplayMode === "live" && !e.secondaryFromLayer) return;
  const r = `${API_BASE_URL}/clips/projects/${encodeURIComponent(t)}/splitscreen-segment`;
  const o = i?.currentTime || 0;
  try {
    const t = await fetchSecureVideoObjectUrl(r);
    await new Promise(e => {
      let i = false;
      const finish = () => {
        if (i) return;
        i = true;
        e();
      };
      n.addEventListener("loadeddata", finish, {
        once: true
      });
      n.addEventListener("error", finish, {
        once: true
      });
      n.src = t;
      n.load();
      setTimeout(finish, 6e3);
    });
    if (n.videoWidth) {
      e.faceSrcW = n.videoWidth;
      e.faceSrcH = n.videoHeight;
    }
    e.secondaryFromLayer = false;
    e.faceDisplayMode = "live";
    e.liveFaceEdit = true;
    try {
      if (Number.isFinite(o)) n.currentTime = o;
    } catch (e) {}
    n.play().catch(() => {});
    syncLibrarySplitscreenCropPreview();
    if (i) bindLibrarySplitscreenPlaybackSync(i, n);
  } catch (e) {
    safeLog("promoteReframeToLiveEdit failed:", e);
  }
}

function bindLibrarySplitscreenCropObserver(e) {
  if (_librarySplitscreenCropObserver) {
    _librarySplitscreenCropObserver.disconnect();
    _librarySplitscreenCropObserver = null;
  }
  if (!e || typeof ResizeObserver === "undefined") return;
  _librarySplitscreenCropObserver = new ResizeObserver(() => {
    syncLibrarySplitscreenCropPreview();
  });
  _librarySplitscreenCropObserver.observe(e);
  const t = e.querySelector("#splitscreenTop");
  const n = e.querySelector("#splitscreenBottom");
  if (t) _librarySplitscreenCropObserver.observe(t);
  if (n) _librarySplitscreenCropObserver.observe(n);
}

function teardownLibrarySplitscreenCropObserver() {
  if (_librarySplitscreenCropObserver) {
    _librarySplitscreenCropObserver.disconnect();
    _librarySplitscreenCropObserver = null;
  }
  if (_libraryPlaybackSyncCleanup) {
    _libraryPlaybackSyncCleanup();
    _libraryPlaybackSyncCleanup = null;
  }
  if (_libraryCropSyncRaf) {
    cancelAnimationFrame(_libraryCropSyncRaf);
    _libraryCropSyncRaf = null;
  }
  revokeLibrarySplitscreenObjectUrls();
  setLibrarySplitscreenCropState(null);
}

function applySplitscreenConfigFromServer(e = {}) {
  const t = Number(e.splitscreen_content_ratio);
  splitscreenContentRatio = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : .5;
  splitscreenSavedRatio = splitscreenContentRatio;
  splitscreenInverted = e.splitscreen_inverted != null ? Boolean(e.splitscreen_inverted) : true;
  splitscreenSecondaryCollapsed = Boolean(e.splitscreen_secondary_collapsed);
  const n = e.splitscreen_secondary_type || "face_track";
  if (n === "face_track" || n === "blank" || n === "blank_blur") {
    splitscreenSecondaryType = n;
    if (n === "blank" || n === "blank_blur") {
      splitscreenCanvasMode = n;
    }
  } else {
    splitscreenSecondaryType = "gameplay";
  }
  if (e.gameplay_clip_id && ![ "face_track", "blank", "blank_blur" ].includes(String(e.gameplay_clip_id))) {
    selectedGameplayClip = e.gameplay_clip_id;
  }
}

function markLibrarySplitscreenDirty() {
  const e = window.clipsStudio;
  if (e?.currentTemplateForPreview?.isLibraryPreview && e._librarySplitscreenCustomize) {
    e._librarySplitscreenDirty = true;
    const t = document.getElementById("confirmUseTemplateBtn");
    if (t) {
      t.textContent = "Apply & Download";
      t.classList.add("library-download-mode");
    }
    if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
  }
}

function notifySubtitleLayoutEdit() {
  try {
    if (typeof window.settleSubtitlesForLayoutEdit === "function") {
      window.settleSubtitlesForLayoutEdit();
    }
  } catch (e) {}
}

function notifySubtitleLayoutIdle() {
  try {
    if (typeof window.resumeSubtitlesAfterLayoutEdit === "function") {
      window.resumeSubtitlesAfterLayoutEdit();
    }
  } catch (e) {}
}

window.notifySubtitleLayoutIdle = notifySubtitleLayoutIdle;

function markLibraryOverlayDirty() {
  const e = window.clipsStudio;
  if (!e?.currentTemplateForPreview?.isLibraryPreview) return;
  e._libraryOverlayDirty = true;
  const t = document.getElementById("confirmUseTemplateBtn");
  if (t) {
    t.textContent = "Apply & Download";
    t.classList.add("library-download-mode");
  }
  if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
}

window.markLibraryOverlayDirty = markLibraryOverlayDirty;

function syncUseTemplateFab() {
  const e = document.getElementById("confirmUseTemplateBtn");
  const t = document.getElementById("confirmUseTemplateFab");
  if (!e || !t) return;
  t.disabled = !!e.disabled;
  t.classList.toggle("library-download-mode", e.classList.contains("library-download-mode"));
  const n = t.querySelector(".template-use-fab-label");
  const i = (e.textContent || "").trim() || "Use Template";
  if (n) n.textContent = i;
  t.setAttribute("aria-label", i);
  t.title = i;
}

window.syncUseTemplateFab = syncUseTemplateFab;

function bindUseTemplateFabIdleHint() {
  const e = document.getElementById("confirmUseTemplateFab");
  const t = document.getElementById("templatePreviewModal");
  if (!e || e.dataset.idleHintBound === "1") return;
  e.dataset.idleHintBound = "1";
  const n = 2600;
  const i = 3200;
  let r = null;
  let o = null;
  const clearTimers = () => {
    if (r) {
      clearTimeout(r);
      r = null;
    }
    if (o) {
      clearTimeout(o);
      o = null;
    }
  };
  const collapse = () => {
    e.classList.remove("is-hinting");
    if (o) {
      clearTimeout(o);
      o = null;
    }
  };
  const showHint = () => {
    if (e.disabled) return;
    if (window.innerWidth > 768) return;
    if (t && (t.style.display === "none" || t.style.visibility === "hidden")) return;
    e.classList.add("is-hinting");
    o = setTimeout(collapse, i);
  };
  const bump = () => {
    collapse();
    clearTimers();
    if (window.innerWidth > 768) return;
    r = setTimeout(showHint, n);
  };
  [ "pointerdown", "touchstart", "keydown" ].forEach(e => {
    document.addEventListener(e, bump, {
      passive: true,
      capture: true
    });
  });
  e.addEventListener("mouseenter", collapse);
  bump();
  window._bumpUseTemplateFabIdle = bump;
}

window.bindUseTemplateFabIdleHint = bindUseTemplateFabIdleHint;

function collectLibraryOverlayTexts() {
  const e = document.getElementById("templateVideoPreview");
  if (!e) return [];
  const t = e.getBoundingClientRect();
  const n = Math.max(1, t.width);
  const i = Math.max(1, t.height);
  const r = [];
  e.querySelectorAll(".overlay-text-block").forEach(e => {
    if (e.dataset.placeholder === "1") return;
    if (e.dataset.aiHook === "1") return;
    const o = e.querySelector(".sub-text-inner");
    let s = (o?.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!s || s.toLowerCase() === "text") return;
    const a = e.getBoundingClientRect();
    const l = (a.left + a.width / 2 - t.left) / n;
    const c = (a.top + a.height / 2 - t.top) / i;
    const d = getComputedStyle(e);
    const p = parseFloat(e.style.fontSize) || parseFloat(d.fontSize) || 28;
    const u = (e.style.fontFamily || d.fontFamily || "Luckiest Guy").split(",")[0].replace(/['"]/g, "").trim();
    const m = e.style.color || d.color || "#ffffff";
    const f = (e.style.textShadow || d.textShadow || "").trim();
    let y = "outline";
    if (!f || f === "none") y = "none"; else if (f.includes("3px")) y = "thick-outline";
    r.push({
      text: s.slice(0, 200),
      x: Math.max(0, Math.min(1, l)),
      y: Math.max(0, Math.min(1, c)),
      font_size_ratio: p / i,
      font: u || "Luckiest Guy",
      color: m,
      shadow: y
    });
  });
  return r;
}

window.collectLibraryOverlayTexts = collectLibraryOverlayTexts;

const GP_ICON_FORMAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/></svg>';

const GP_ICON_SECONDARY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></svg>';

const GP_ICON_GAMEPLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="10.5" r="1"/><circle cx="17.5" cy="13.5" r="1"/></svg>';

const GP_ICON_REFRAME = '<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="16" height="16" rx="0.9" stroke="currentColor" stroke-width="1.75"/><path d="M2 9V2H9M19 2H26V9M9 26H2V19M26 19V26H19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const GP_ICON_BLANK = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" opacity=".35"/><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.75"/></svg>';

const GP_ICON_BLANK_BLUR = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.75"/><circle cx="9" cy="10" r="1.4" fill="currentColor" opacity=".55"/><circle cx="14" cy="11" r="2.1" fill="currentColor" opacity=".35"/><circle cx="11.5" cy="15" r="1.7" fill="currentColor" opacity=".45"/><path d="M5 17.5c2-2.4 4.2-3.6 7-3.6s5 1.2 7 3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></svg>';

const SPLITSCREEN_FORMATS = [ {
  id: "inverted",
  label: "Reframe on Top",
  desc: "Face panel above your clip"
}, {
  id: "normal",
  label: "Content on Top",
  desc: "Your clip above the secondary panel"
} ];

function toggleNavWrapperCollapse(e) {
  if (typeof window.toggleMobileNavMenu === "function") {
    return window.toggleMobileNavMenu(e);
  }
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const t = document.getElementById("mobileMenuPanel");
  const n = document.getElementById("mobileMenuBackdrop");
  const i = document.getElementById("mobileMenuFab");
  if (!t) return;
  const r = !!t.hidden;
  t.hidden = !r;
  if (n) n.hidden = !r;
  if (i) i.setAttribute("aria-expanded", r ? "true" : "false");
}

function toggleClipsExpansion(e) {
  e.preventDefault();
  e.stopPropagation();
  const t = document.getElementById("clipsExpansionActions");
  if (t) {
    t.classList.toggle("expanded");
  }
}

function closeClipsExpansion() {
  const e = document.getElementById("clipsExpansionActions");
  if (e) {
    e.classList.remove("expanded");
  }
}

function navigateToClipsTemplates() {
  closeClipsExpansion();
  const e = document.querySelector('[data-tab="templates"]');
  if (e) {
    e.click();
  } else {}
}

function navigateToClipsCreate() {
  closeClipsExpansion();
  const e = document.querySelector(".chips-nav-item");
  if (e) {
    handleNav(e, 3);
  }
}

function navigateToClipsLibrary() {
  closeClipsExpansion();
  const e = document.querySelector('[data-tab="library"]');
  if (e) {
    e.click();
  }
}

function dockInputInstantly() {
  const e = document.querySelector(".input-section");
  const t = e ? e.querySelector(".input-container") : null;
  const n = parseInt(localStorage.getItem("sidebarActiveIndex") || "0");
  if (t) {
    t.classList.remove("first-prompt", "animate-down", "animate-up");
  }
  if (e) {
    e.classList.remove("is-first-prompt");
    if (n === 0) {
      e.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: all !important; z-index: 1000 !important;";
    } else {
      e.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;";
    }
  }
}

window.dockInputInstantly = dockInputInstantly;

function initAuth() {
  safeLog("[Auth] Initializing authentication...");
  verifyToken().then(e => {
    if (currentUser) {
      safeLog("[Auth] User authenticated:", currentUser.email);
      startTokenRefreshInterval();
      if (typeof updateProfileButton === "function") {
        updateProfileButton();
      }
    } else {
      safeLog("[Auth] User not authenticated, showing guest UI");
      updateUIForGuest();
    }
  }).catch(e => {
    safeLog("[Auth] Unexpected error during initialization:", e);
    updateUIForGuest();
  });
  safeLog("[Auth] Initialization started");
}

function sanitizeErrorMessage(e) {
  if (!e) return "Unknown error";
  const t = String(e.message || e).trim();
  const n = [ "timeout", "network", "failed", "unauthorized", "not found", "invalid", "error" ];
  const i = t.toLowerCase();
  if (n.some(e => i.includes(e))) {
    return t.substring(0, 100);
  }
  return "An error occurred";
}

function validateInputLength(e, t = 1e3, n = "input") {
  if (typeof e !== "string") {
    return {
      valid: false,
      error: `${n} must be a string`
    };
  }
  if (e.length > t) {
    return {
      valid: false,
      error: `${n} exceeds ${t} character limit`
    };
  }
  if (e.length === 0) {
    return {
      valid: false,
      error: `${n} cannot be empty`
    };
  }
  return {
    valid: true,
    value: e.trim()
  };
}

function validateURLInput(e, t = 512) {
  const n = validateInputLength(e, t, "URL");
  if (!n.valid) {
    return n;
  }
  try {
    const e = n.value.startsWith("http") ? n.value : "https://" + n.value;
    const t = new URL(e);
    return {
      valid: true,
      value: n.value
    };
  } catch (e) {
    return {
      valid: false,
      error: "Invalid URL format"
    };
  }
}

function getCSRFToken() {
  return null;
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

async function initializeCSRFToken() {
  return true;
}

async function verifyToken() {
  try {
    let e = await fetch(`${API_BASE_URL}/auth/check`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    });
    if (!e.ok) {
      const t = await refreshAuthToken();
      if (t) {
        e = await fetch(`${API_BASE_URL}/auth/check`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include"
        });
      }
    }
    if (!e.ok) {
      safeLog("Auth verification error:", e.status);
      throw new Error("Authentication verification failed");
    }
    const t = await e.json();
    currentUser = t.user;
    window.currentUser = currentUser;
    try {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } catch (e) {}
    updateUIForLoggedInUser();
    if (currentUser && currentUser.plan && typeof applyPortalTierUI === "function") {
      applyPortalTierUI(currentUser.plan);
    }
    if (typeof updateProfileButton === "function") {
      setTimeout(() => updateProfileButton(), 0);
    }
    if (typeof updateMenuUserInfo === "function") {
      updateMenuUserInfo();
    }
    if (typeof updateProfileDropdown === "function") {
      updateProfileDropdown(currentUser).catch(e => console.warn("Profile dropdown update error:", e));
    }
    checkYouTubeConnection();
    const n = currentUser?.id ?? currentUser?.user_id;
    if (window.SolisMemory?.setUserId) {
      window.SolisMemory.setUserId(n);
    }
    if (window.SolisMemory?.pullServerMemory) {
      await window.SolisMemory.pullServerMemory();
    }
    await loadTierInfo();
  } catch (e) {
    safeLog("[Auth] Verification error:", e.message);
    if (e.message && (e.message.includes("Token invalid") || e.message.includes("401") || e.message.includes("403"))) {
      safeLog("[Auth] Token is invalid, redirecting to login in 2 seconds");
      currentUser = null;
      window.currentUser = null;
      try {
        localStorage.removeItem("currentUser");
      } catch (e) {}
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2e3);
    } else {
      safeLog("[Auth] Network error, allowing guest access:", e.message);
      updateUIForGuest();
      if (typeof showNotification === "function") {
        showNotification("Could not verify session.", "warning");
      }
    }
    throw e;
  }
}

let tokenRefreshIntervalId = null;

async function refreshAuthToken() {
  try {
    const e = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    });
    if (e.ok) {
      safeLog("[Auth] Token refreshed successfully");
      return true;
    }
    safeLog("[Auth] Token refresh failed:", e.status);
    return false;
  } catch (e) {
    safeLog("[Auth] Token refresh error:", e.message);
    return false;
  }
}

function startTokenRefreshInterval() {
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
  }
  refreshAuthToken();
  const e = 50 * 60 * 1e3;
  tokenRefreshIntervalId = setInterval(() => {
    if (currentUser) {
      safeLog("[Auth] Refreshing auth token...");
      refreshAuthToken();
    }
  }, e);
  if (!window._authVisibilityRefreshBound) {
    window._authVisibilityRefreshBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && currentUser) {
        refreshAuthToken();
      }
    });
  }
  safeLog("[Auth] Token refresh interval started (every 50 minutes)");
}

function stopTokenRefreshInterval() {
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
    tokenRefreshIntervalId = null;
    safeLog("[Auth] Token refresh interval stopped");
  }
}

function updateUIForLoggedInUser() {
  const e = document.querySelector(".user-name");
  const t = document.querySelector(".user-email");
  const n = document.querySelector(".user-avatar");
  if (e) e.textContent = currentUser.name;
  if (t) t.textContent = currentUser.email;
  if (n) {
    const e = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(currentUser) : currentUser.picture;
    if (e) {
      const t = document.createElement("img");
      t.src = e;
      t.alt = currentUser.name;
      t.style.cssText = "width: 100%; height: 100%; border-radius: 50%; object-fit: cover;";
      n.innerHTML = "";
      n.appendChild(t);
    } else {
      n.innerHTML = `\n                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                    <path d="M2 21a8 8 0 0 1 11.873-7"/>\n                    <circle cx="10" cy="8" r="5"/>\n                    <path d="m17 17 5 5"/>\n                    <path d="m22 17-5 5"/>\n                </svg>\n            `;
    }
  }
  if (signInDisplay) signInDisplay.style.display = "none";
  if (signInBtn) {
    signInBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Sign out</span>';
    signInBtn.onclick = logout;
  }
  updateSettingsForLoggedInUser();
}

function updateUIForGuest() {
  const e = document.querySelector(".user-name");
  const t = document.querySelector(".user-email");
  const n = document.querySelector(".user-avatar");
  if (e) e.textContent = "Guest User";
  if (t) t.textContent = "Sign in to continue";
  if (n) {
    n.innerHTML = `\n            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                <path d="M2 21a8 8 0 0 1 11.873-7"/>\n                <circle cx="10" cy="8" r="5"/>\n                <path d="m17 17 5 5"/>\n                <path d="m22 17-5 5"/>\n            </svg>\n        `;
  }
  if (signInDisplay) signInDisplay.style.display = "flex";
  if (signInBtn) {
    signInBtn.innerHTML = '<i class="fas fa-sign-in"></i><span>Sign in</span>';
    signInBtn.onclick = redirectToLogin;
  }
  updateSettingsForGuest();
}

function updateSettingsForLoggedInUser() {
  const e = document.querySelector(".settings-option .option-name");
  const t = document.querySelector(".settings-option .option-description");
  if (e) e.textContent = "Account Settings";
  if (t) t.textContent = `Signed in as ${currentUser.email}`;
  fetchAndUpdateSubscriptionStatus();
}

async function fetchAndUpdateSubscriptionStatus(e = false) {
  try {
    const t = await window._subCache.get(e);
    if (!t) throw new Error("No subscription data");
    window.tier = t.plan;
    document.querySelectorAll(".settings-option").forEach(e => {
      const n = e.querySelector(".option-name");
      if (!n) return;
      if (n.textContent === "Subscription Status") {
        const n = e.querySelector(".option-description");
        if (n) {
          n.textContent = `${t.plan_name} Plan - ${t.videos_per_day_limit} videos/day, ${t.storage_limit_gb}GB storage`;
        }
      }
      if (n.textContent === "Current Plan") {
        const n = e.querySelector(".option-description");
        if (n) n.textContent = t.plan_name;
      }
    });
  } catch (e) {
    document.querySelectorAll(".settings-option").forEach(e => {
      const t = e.querySelector(".option-name");
      if (t && t.textContent === "Subscription Status") {
        const t = e.querySelector(".option-description");
        if (t) t.textContent = "Free Plan - Limited access";
      }
    });
  }
}

function updateSettingsForGuest() {
  const e = document.querySelector(".settings-option .option-name");
  const t = document.querySelector(".settings-option .option-description");
  if (e) e.textContent = "Sign in?";
  if (t) t.textContent = "Want to unlock full feature access? Sign in today";
}

function redirectToLogin() {
  window.location.href = "/login.html";
}

function logout() {
  if (typeof window._comprehensiveLogout === "function") {
    window._comprehensiveLogout();
  }
}

function getHeaders() {
  console.warn("DEPRECATED: getHeaders() called - use getAuthHeaders() instead for CSRF protection");
  return getAuthHeaders(true);
}

async function loadAvailableGameplayClips() {
  try {
    const e = await fetch("/api/gameplay/available", {
      method: "GET",
      credentials: "include",
      headers: typeof getAuthHeaders === "function" ? getAuthHeaders(true) : {}
    });
    if (e.ok) {
      const t = await e.json();
      availableGameplayClips = t.clips || [];
      return availableGameplayClips;
    } else {
      safeLog("Failed to load gameplay clips from backend");
      availableGameplayClips = [];
      return availableGameplayClips;
    }
  } catch (e) {
    safeLog("âŒ Error loading gameplay clips:", e);
    availableGameplayClips = [];
    return availableGameplayClips;
  }
}

window._subCache = (() => {
  let e = null;
  let t = 0;
  let n = null;
  const i = 6e4;
  async function _doFetch() {
    const i = await fetch(`${API_BASE_URL}/auth/subscription`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    });
    if (!i.ok) throw new Error(`subscription fetch failed: ${i.status}`);
    const r = await i.json();
    e = r.subscription || null;
    t = Date.now();
    n = null;
    return e;
  }
  return {
    async get(r = false) {
      const o = Date.now();
      if (!r && e && o - t < i) return e;
      if (n) return n;
      n = _doFetch().catch(e => {
        n = null;
        throw e;
      });
      return n;
    },
    peek() {
      return e;
    },
    set(n) {
      e = n;
      t = Date.now();
    },
    invalidate() {
      e = null;
      t = 0;
    }
  };
})();

function applyPortalTierUI(e) {
  const t = String(e || "free").toLowerCase().trim();
  const n = t.charAt(0).toUpperCase() + t.slice(1);
  const i = document.getElementById("currentTier");
  const r = document.getElementById("tierInfoCard");
  if (i) i.textContent = n;
  if (r) {
    r.classList.remove("tier-free", "tier-basic", "tier-prime", "tier-elite");
    const e = [ "free", "basic", "prime", "elite" ].includes(t) ? t : "free";
    r.classList.add(`tier-${e}`);
    r.setAttribute("data-plan", e);
  }
  try {
    if (window.currentUser) window.currentUser.plan = t;
    if (typeof currentUser !== "undefined" && currentUser) currentUser.plan = t;
  } catch (e) {}
}

window.applyPortalTierUI = applyPortalTierUI;

async function loadTierInfo() {
  try {
    const e = window.currentUser && window.currentUser.plan || typeof currentUser !== "undefined" && currentUser && currentUser.plan;
    if (e) applyPortalTierUI(e);
    const t = await window._subCache.get();
    if (!t) {
      safeLog("⚠ï¸ Could not load tier info");
      return;
    }
    const n = String(t.plan || e || "free").toLowerCase();
    applyPortalTierUI(t.plan_name || n);
    const i = document.getElementById("currentTierExpiry");
    if (i) {
      if (n === "free") {
        i.textContent = "";
      } else if (t.plan_expires_at) {
        const e = Math.ceil((new Date(t.plan_expires_at) - new Date) / (1e3 * 60 * 60 * 24));
        if (e < 0) i.textContent = "Expired"; else if (e === 0) i.textContent = "Expires today"; else if (e === 1) i.textContent = "Expires tomorrow"; else i.textContent = `Expires in ${e} days`;
      } else {
        i.textContent = "";
      }
    }
    if (typeof updateStorageDisplayOnDashboard === "function") {
      updateStorageDisplayOnDashboard(t);
    }
    return t;
  } catch (e) {
    safeLog("âŒ Error loading tier info:", e);
  }
}

function initGameplayPillUI() {
  if (gameplayPillInitialized) return;
  gameplayPillInitialized = true;
  gpPill = document.createElement("div");
  gpPill.className = "gp-pill-menu";
  gpPill.id = "gpPillMenu";
  gpPill.innerHTML = `\n        <button type="button" class="gp-pill-btn" id="gpBtnLayout" title="Layout" aria-label="Layout">\n            <span class="gp-pill-ico">${GP_ICON_FORMAT}</span>\n        </button>\n        <div class="gp-pill-divider" aria-hidden="true"></div>\n        <button type="button" class="gp-pill-btn" id="gpBtnClips" title="Reframe & gameplay" aria-label="Reframe and gameplay">\n            <span class="gp-pill-ico">${GP_ICON_SECONDARY}</span>\n        </button>\n        <button type="button" class="gp-pill-btn" id="gpBtnGameplay" title="Gameplay" aria-label="Gameplay">\n            <span class="gp-pill-ico">${GP_ICON_GAMEPLAY}</span>\n        </button>\n    `;
  document.body.appendChild(gpPill);
  gpDdLayout = document.createElement("div");
  gpDdLayout.className = "gp-dropdown gp-layout-dd";
  gpDdLayout.id = "gpDdLayout";
  document.body.appendChild(gpDdLayout);
  gpDdClips = document.createElement("div");
  gpDdClips.className = "gp-dropdown gp-clips-dd";
  gpDdClips.id = "gpDdClips";
  document.body.appendChild(gpDdClips);
  buildSplitscreenFormatDropdown();
  rebuildGameplayClipsDropdown();
  gpPill.addEventListener("click", e => e.stopPropagation());
  document.getElementById("gpBtnLayout").addEventListener("click", e => {
    e.stopPropagation();
    const t = gpDdLayout.classList.contains("open");
    closeGameplayDropdowns();
    if (!t) {
      openGameplayDropdown(gpDdLayout, e.currentTarget);
      e.currentTarget.classList.add("gp-active");
    }
  });
  const openClipsPanel = (e, t) => {
    const n = gpDdClips.classList.contains("open") && gpDdClips.dataset.panelMode === t && e.classList.contains("gp-active");
    closeGameplayDropdowns();
    if (n) return;
    if (t === "play" && availableGameplayClips.length === 0) {
      loadAvailableGameplayClips().then(() => rebuildGameplayClipsDropdown());
    }
    gpDdClips.dataset.panelMode = t;
    rebuildGameplayClipsDropdown();
    openGameplayDropdown(gpDdClips, e);
    e.classList.add("gp-active");
  };
  document.getElementById("gpBtnClips").addEventListener("click", e => {
    e.stopPropagation();
    openClipsPanel(e.currentTarget, "fill");
  });
  document.getElementById("gpBtnGameplay").addEventListener("click", e => {
    e.stopPropagation();
    openClipsPanel(e.currentTarget, "play");
  });
  document.addEventListener("click", e => {
    if (!gpPill?.classList.contains("active")) return;
    if (gpPill.contains(e.target) || gpDdLayout.contains(e.target) || gpDdClips.contains(e.target)) return;
    if (e.target.closest("#splitscreenRoot")) return;
    if (e.target.closest("#previewEditorPill")) return;
    if (e.target.closest("#templatePreviewLoading")) return;
    hideGameplayPillMenu();
  });
  window.addEventListener("resize", () => {
    if (gpPill?.classList.contains("active")) positionGameplayPill();
  });
  window.addEventListener("scroll", () => {
    if (gpPill?.classList.contains("active")) positionGameplayPill();
  }, true);
}

function formatIconSvg(e) {
  if (e === "inverted") {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 7h4M7 17h10"/></svg>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 7h10M7 17h4"/></svg>';
}

function buildSplitscreenFormatDropdown() {
  if (!gpDdLayout) return;
  gpDdLayout.innerHTML = '<div class="gp-dd-title">Stack order</div>';
  SPLITSCREEN_FORMATS.forEach(e => {
    const t = e.id === "inverted" === splitscreenInverted;
    const n = document.createElement("button");
    n.type = "button";
    n.className = "gp-layout-item" + (t ? " on" : "");
    const i = e.id === "inverted" ? "gp-lp--reframe-top" : "gp-lp--content-top";
    const r = e.id === "inverted" ? "Reframe" : "Content";
    const o = e.id === "inverted" ? "Content" : "Reframe";
    n.innerHTML = `\n            <div class="gp-layout-preview ${i}" aria-hidden="true">\n                <span class="gp-lp-a">${r}</span>\n                <span class="gp-lp-b">${o}</span>\n            </div>\n            <div class="gp-layout-text">\n                <span class="gp-layout-label">${e.label}</span>\n                <span class="gp-layout-desc">${e.desc}</span>\n            </div>\n            <span class="gp-layout-check" aria-hidden="true">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>\n            </span>\n        `;
    n.addEventListener("pointerenter", () => previewGpLayoutOption(e.id === "inverted"));
    n.addEventListener("pointerleave", () => endGpLayoutPreview());
    n.addEventListener("click", t => {
      t.stopPropagation();
      if (_gpCommittedLayout != null) _gpCommittedLayout = null;
      splitscreenInverted = e.id === "inverted";
      document.getElementById("templateVideoPreview")?.classList.remove("gp-hover-preview");
      notifySubtitleLayoutEdit();
      applySplitscreenPreview();
      markLibrarySplitscreenDirty();
      buildSplitscreenFormatDropdown();
      closeGameplayDropdowns();
      document.getElementById("gpBtnLayout")?.classList.remove("gp-active");
    });
    gpDdLayout.appendChild(n);
  });
}

function getGameplayClipsForUI() {
  if (availableGameplayClips.length) return availableGameplayClips;
  return [ {
    id: "minecraft_1",
    title: "Minecraft 1",
    filename: "Minecraft_1.mp4",
    group: "minecraft",
    group_label: "Minecraft",
    preview_url: "/api/gameplay/preview/minecraft_1"
  } ];
}

function gameplayGroupMeta(e) {
  const t = String(e?.group || String(e?.id || "").split("_")[0] || "gameplay").toLowerCase();
  const n = e?.group_label || {
    minecraft: "Minecraft",
    roblox: "Roblox",
    subway: "Subway Surfers",
    gta: "GTA",
    fortnite: "Fortnite"
  }[t] || t.charAt(0).toUpperCase() + t.slice(1);
  return {
    id: t,
    label: n
  };
}

function gameplayClipPreviewSrc(e) {
  if (e?.preview_url) return e.preview_url;
  if (e?.thumbnail) return e.thumbnail;
  if (e?.id) return `/api/gameplay/preview/${e.id}`;
  return "";
}

function buildGameplayClipCard(e) {
  const t = document.createElement("button");
  t.type = "button";
  t.className = "gp-clip-card" + (isGameplayOptionSelected(e.id) ? " on" : "");
  t.dataset.clipId = e.id;
  t.dataset.group = gameplayGroupMeta(e).id;
  const n = e.title || e.id;
  const i = gameplayClipPreviewSrc(e);
  const r = e.filename ? `/assets/${encodeURIComponent(e.filename)}` : "";
  t.innerHTML = `\n        <span class="gp-clip-media">\n            <span class="gp-clip-skel" aria-hidden="true">\n                <span class="gp-clip-skel-shine"></span>\n                <span class="gp-clip-skel-grid">\n                    <i></i><i></i><i></i><i></i><i></i><i></i>\n                    <i></i><i></i><i></i><i></i><i></i><i></i>\n                </span>\n            </span>\n            <img class="gp-clip-thumb" alt="" decoding="async" draggable="false" />\n        </span>\n        <span class="gp-clip-label">${n}</span>\n        <span class="gp-clip-check" aria-hidden="true">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 13l4 4L19 7"/></svg>\n        </span>\n    `;
  const o = t.querySelector("img.gp-clip-thumb");
  const s = t.querySelector(".gp-clip-media");
  const reveal = () => t.classList.add("is-ready");
  if (o && i) {
    o.addEventListener("load", reveal, {
      once: true
    });
    o.addEventListener("error", () => {
      if (!r || !s) {
        t.classList.add("is-failed");
        return;
      }
      o.remove();
      const e = document.createElement("video");
      e.className = "gp-clip-thumb";
      e.muted = true;
      e.loop = true;
      e.playsInline = true;
      e.preload = "metadata";
      e.disablePictureInPicture = true;
      e.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback noplaybackrate");
      e.addEventListener("loadeddata", () => {
        reveal();
        e.play().catch(() => {});
      }, {
        once: true
      });
      e.src = r;
      s.appendChild(e);
    }, {
      once: true
    });
    o.src = i;
  } else if (o && r) {
    o.remove();
    const e = document.createElement("video");
    e.className = "gp-clip-thumb";
    e.muted = true;
    e.loop = true;
    e.playsInline = true;
    e.preload = "metadata";
    e.addEventListener("loadeddata", () => {
      reveal();
      e.play().catch(() => {});
    }, {
      once: true
    });
    e.src = r;
    s.appendChild(e);
  }
  t.addEventListener("pointerenter", () => previewGpSecondaryOption(e.id));
  t.addEventListener("pointerleave", () => endGpHoverPreview());
  t.addEventListener("click", t => {
    t.stopPropagation();
    _gpCommittedSecondary = null;
    selectSecondaryGameplay(e.id);
    rebuildGameplayClipsDropdown();
  });
  return t;
}

function buildModeTile({id: e, title: t, hint: n, previewClass: i, previewHtml: r}) {
  const o = document.createElement("button");
  o.type = "button";
  o.className = "gp-mode-tile" + (isGameplayOptionSelected(e) ? " on" : "");
  o.setAttribute("data-mode", e);
  o.innerHTML = `\n        <span class="gp-mode-preview ${i}" aria-hidden="true">${r || ""}</span>\n        <span class="gp-mode-meta">\n            <span class="gp-mode-label">${t}</span>\n            ${n ? `<span class="gp-mode-hint">${n}</span>` : ""}\n        </span>\n        <span class="gp-mode-check" aria-hidden="true">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M5 13l4 4L19 7"/></svg>\n        </span>\n    `;
  o.addEventListener("pointerenter", () => previewGpSecondaryOption(e));
  o.addEventListener("pointerleave", () => endGpHoverPreview());
  o.addEventListener("click", t => {
    t.stopPropagation();
    _gpCommittedSecondary = null;
    if (e === "blank" || e === "blank_blur") {
      splitscreenCanvasMode = e;
    }
    selectSecondaryGameplay(e);
    rebuildGameplayClipsDropdown();
  });
  return o;
}

function buildModesRow() {
  const e = document.createElement("div");
  e.className = "gp-mode-row";
  e.appendChild(buildModeTile({
    id: "face_track",
    title: "Reframe",
    hint: "Face crop",
    previewClass: "gp-prev-reframe",
    previewHtml: `\n            <span class="gp-prev-phone">\n                <span class="gp-prev-face"></span>\n            </span>\n        `
  }));
  e.appendChild(buildModeTile({
    id: "blank",
    title: "Black",
    hint: "Solid fill",
    previewClass: "gp-prev-black",
    previewHtml: ""
  }));
  e.appendChild(buildModeTile({
    id: "blank_blur",
    title: "Blur",
    hint: "Soft backdrop",
    previewClass: "gp-prev-blur",
    previewHtml: `\n            <span class="gp-prev-blur-shapes" aria-hidden="true">\n                <i></i><i></i><i></i>\n            </span>\n        `
  }));
  return e;
}

function isCanvasSelected() {
  return splitscreenSecondaryType === "blank" || splitscreenSecondaryType === "blank_blur";
}

function isGameplayOptionSelected(e) {
  if (e === "face_track") return splitscreenSecondaryType === "face_track";
  if (e === "blank") return splitscreenSecondaryType === "blank";
  if (e === "blank_blur") return splitscreenSecondaryType === "blank_blur";
  return splitscreenSecondaryType === "gameplay" && selectedGameplayClip === e;
}

function fillSelectionLabel() {
  if (splitscreenSecondaryType === "face_track") return "Reframe";
  if (splitscreenSecondaryType === "gameplay") return gameplaySelectionLabel();
  if (splitscreenSecondaryType === "blank") return "Black";
  if (splitscreenSecondaryType === "blank_blur") return "Blur";
  return "Pick a style";
}

function gameplaySelectionLabel() {
  if (splitscreenSecondaryType !== "gameplay") return "Pick a clip";
  const e = getGameplayClipsForUI();
  const t = e.find(e => e.id === selectedGameplayClip);
  return t?.title || "Gameplay";
}

function snapshotGpSecondaryState() {
  return {
    splitscreenSecondaryType: splitscreenSecondaryType,
    selectedGameplayClip: selectedGameplayClip,
    splitscreenCanvasMode: splitscreenCanvasMode
  };
}

function applyGpSecondaryState(e) {
  splitscreenSecondaryType = e.splitscreenSecondaryType;
  selectedGameplayClip = e.selectedGameplayClip;
  splitscreenCanvasMode = e.splitscreenCanvasMode;
}

function setSecondaryTypeVisual(e) {
  if (e === "face_track") {
    splitscreenSecondaryType = "face_track";
  } else if (e === "blank" || e === "blank_blur") {
    splitscreenSecondaryType = e;
    splitscreenCanvasMode = e;
  } else {
    splitscreenSecondaryType = "gameplay";
    selectedGameplayClip = e;
    if (_librarySplitscreenCropState) {
      _librarySplitscreenCropState.secondaryFromLayer = false;
    }
  }
}

function previewGpSecondaryOption(e) {
  endGpLayoutPreview();
  if (!_gpCommittedSecondary) {
    _gpCommittedSecondary = snapshotGpSecondaryState();
  }
  setSecondaryTypeVisual(e);
  const t = document.getElementById("templateVideoPreview");
  t?.classList.add("gp-hover-preview");
  if (splitscreenSecondaryCollapsed) {
    expandSplitscreenSecondary();
  } else {
    applySplitscreenPreview();
  }
}

function endGpHoverPreview() {
  if (!_gpCommittedSecondary) return;
  const e = _gpCommittedSecondary;
  _gpCommittedSecondary = null;
  applyGpSecondaryState(e);
  document.getElementById("templateVideoPreview")?.classList.remove("gp-hover-preview");
  applySplitscreenPreview();
}

function previewGpLayoutOption(e) {
  endGpHoverPreview();
  if (_gpCommittedLayout == null) {
    _gpCommittedLayout = !!splitscreenInverted;
  }
  splitscreenInverted = !!e;
  document.getElementById("templateVideoPreview")?.classList.add("gp-hover-preview");
  applySplitscreenPreview();
}

function endGpLayoutPreview() {
  if (_gpCommittedLayout == null) return;
  splitscreenInverted = _gpCommittedLayout;
  _gpCommittedLayout = null;
  document.getElementById("templateVideoPreview")?.classList.remove("gp-hover-preview");
  applySplitscreenPreview();
}

function pauseGpClipPreviews() {
  gpDdClips?.querySelectorAll("video.gp-clip-thumb").forEach(e => {
    try {
      e.pause();
    } catch (e) {}
  });
}

function rebuildGameplayClipsDropdown() {
  if (!gpDdClips) return;
  const e = gpDdClips.dataset.panelMode || "fill";
  const t = getGameplayClipsForUI();
  const n = gpDdClips.dataset.activeGroup || "all";
  const i = [];
  const r = new Set;
  t.forEach(e => {
    const t = gameplayGroupMeta(e);
    if (r.has(t.id)) return;
    r.add(t.id);
    i.push(t);
  });
  gpDdClips.innerHTML = "";
  gpDdClips.classList.add("gp-clips-dd--v2");
  gpDdClips.dataset.panelMode = e;
  gpDdClips.classList.toggle("gp-clips-dd--fill", e === "fill");
  gpDdClips.classList.toggle("gp-clips-dd--play", e === "play");
  const o = document.createElement("div");
  o.className = "gp-clips-head";
  if (e === "fill") {
    o.innerHTML = `\n            <div class="gp-clips-head-text">\n                <span class="gp-clips-kicker">Secondary panel</span>\n                <span class="gp-clips-current">${fillSelectionLabel()}</span>\n            </div>\n        `;
  } else {
    o.innerHTML = `\n            <div class="gp-clips-head-text">\n                <span class="gp-clips-kicker">Gameplay</span>\n                <span class="gp-clips-current">${gameplaySelectionLabel()}</span>\n            </div>\n        `;
  }
  gpDdClips.appendChild(o);
  if (e === "fill") {
    const e = document.createElement("div");
    e.className = "gp-dd-section gp-clips-face";
    e.appendChild(buildModesRow());
    gpDdClips.appendChild(e);
    return;
  }
  const s = document.createElement("div");
  s.className = "gp-dd-section gp-clips-play";
  if (i.length > 1) {
    const e = document.createElement("div");
    e.className = "gp-clips-play-head";
    const t = document.createElement("div");
    t.className = "gp-clips-chips";
    t.setAttribute("role", "tablist");
    const r = document.createElement("button");
    r.type = "button";
    r.className = "gp-clips-chip" + (n === "all" ? " on" : "");
    r.textContent = "All";
    r.addEventListener("click", e => {
      e.stopPropagation();
      gpDdClips.dataset.activeGroup = "all";
      rebuildGameplayClipsDropdown();
    });
    t.appendChild(r);
    i.forEach(e => {
      const i = document.createElement("button");
      i.type = "button";
      i.className = "gp-clips-chip" + (n === e.id ? " on" : "");
      i.textContent = e.label;
      i.addEventListener("click", t => {
        t.stopPropagation();
        gpDdClips.dataset.activeGroup = e.id;
        rebuildGameplayClipsDropdown();
      });
      t.appendChild(i);
    });
    e.appendChild(t);
    s.appendChild(e);
  }
  const a = document.createElement("div");
  a.className = "gp-clips-grid";
  a.id = "gpClipsGrid";
  const l = n === "all" ? t : t.filter(e => gameplayGroupMeta(e).id === n);
  if (!l.length) {
    const e = document.createElement("div");
    e.className = "gp-clips-empty";
    e.textContent = "No clips in this pack yet";
    s.appendChild(e);
  } else {
    l.forEach(e => a.appendChild(buildGameplayClipCard(e)));
    s.appendChild(a);
  }
  gpDdClips.appendChild(s);
}

function selectSecondaryGameplay(e) {
  _gpCommittedSecondary = null;
  document.getElementById("templateVideoPreview")?.classList.remove("gp-hover-preview");
  if (_reframeImmersive) {
    exitReframeImmersive();
  }
  if (e === "face_track") {
    splitscreenSecondaryType = "face_track";
  } else if (e === "blank" || e === "blank_blur") {
    splitscreenSecondaryType = e;
    splitscreenCanvasMode = e;
  } else {
    splitscreenSecondaryType = "gameplay";
    selectedGameplayClip = e;
    if (_librarySplitscreenCropState) {
      _librarySplitscreenCropState.secondaryFromLayer = false;
    }
  }
  if (splitscreenSecondaryCollapsed) {
    expandSplitscreenSecondary();
  } else {
    notifySubtitleLayoutEdit();
    applySplitscreenPreview();
  }
  markLibrarySplitscreenDirty();
  try {
    if (window.SolisMemory && !window.SolisMemory._applying && typeof window.SolisMemory.recordLayout === "function") {
      window.SolisMemory.recordLayout("splitscreen");
    }
  } catch (e) {}
}

function openGameplayDropdown(e, t) {
  closeGameplayDropdowns(e);
  positionGameplayPill();
  e.classList.add("open");
  const place = () => {
    const t = gpPill.getBoundingClientRect();
    const n = e.classList.contains("gp-clips-dd");
    const i = e.offsetWidth || (n ? 360 : 280);
    const r = e.offsetHeight || (n ? 360 : 220);
    const o = {
      w: window.innerWidth,
      h: window.innerHeight
    };
    const s = 10;
    const a = document.getElementById("templateVideoPreview");
    const l = a?.getBoundingClientRect();
    const c = o.h - (t.bottom + s) - 12;
    const d = t.top - s - 12;
    let p;
    if (c >= Math.min(r, 220) || c >= d) {
      p = t.bottom + s;
      if (p + r > o.h - 12) p = Math.max(12, o.h - r - 12);
      if (p + 20 < t.bottom && c > 120) p = t.bottom + s;
    } else {
      p = Math.max(12, t.top - r - s);
    }
    let u;
    if (l) {
      u = l.right + s;
      if (u + i > o.w - 12) {
        u = Math.max(l.right + 6, o.w - i - 12);
      }
      if (u < l.right) u = Math.min(l.right + s, Math.max(12, o.w - i - 12));
    } else {
      u = t.right + s;
      if (u + i > o.w - 12) u = Math.max(12, o.w - i - 12);
    }
    e.style.top = Math.round(p) + "px";
    e.style.left = Math.round(u) + "px";
  };
  place();
  requestAnimationFrame(place);
}

function closeGameplayDropdowns(e) {
  endGpHoverPreview();
  endGpLayoutPreview();
  [ gpDdLayout, gpDdClips ].forEach(t => {
    if (!t || t === e) return;
    if (t === gpDdClips && t.classList.contains("open")) pauseGpClipPreviews();
    t.classList.remove("open");
  });
  gpPill?.querySelectorAll(".gp-pill-btn").forEach(e => e.classList.remove("gp-active"));
}

function positionGameplayPill() {
  if (!gpPill) return;
  const e = 22;
  const t = 28;
  const n = gpPill.offsetWidth || 88;
  const i = gpPill.offsetHeight || 46;
  const r = {
    w: window.innerWidth,
    h: window.innerHeight
  };
  let o;
  let s;
  if (gpPillAnchor) {
    o = gpPillAnchor.x + e + t;
    s = gpPillAnchor.y - i / 2;
    if (o + n > r.w - 8) {
      o = gpPillAnchor.x - n - e;
    }
  } else {
    const e = document.getElementById("splitscreenRoot") || document.getElementById("templateVideoPreview");
    const t = document.getElementById("splitscreenBottom");
    const i = (t || e)?.getBoundingClientRect();
    if (!i) return;
    o = i.left + i.width * .62 - n / 2;
    s = i.top + Math.min(56, i.height * .12);
  }
  o = Math.max(8, Math.min(o, r.w - n - 8));
  s = Math.max(8, Math.min(s, r.h - i - 8));
  gpPill.style.left = o + "px";
  gpPill.style.top = s + "px";
}

function showGameplayPillMenu(e, t) {
  if (!_splitscreenQuery("splitscreenRoot")) return;
  try {
    window.solisClosePeerPreviewChrome?.("gp");
  } catch (e) {}
  if (e) {
    e.stopPropagation();
    if (e.clientX != null && e.clientY != null) {
      gpPillAnchor = {
        x: e.clientX,
        y: e.clientY
      };
    }
  }
  initGameplayPillUI();
  if (availableGameplayClips.length === 0) {
    loadAvailableGameplayClips().then(() => rebuildGameplayClipsDropdown());
  }
  positionGameplayPill();
  gpPill.classList.add("active");
  const n = t || gpPillFocusMode || "fill";
  gpPillFocusMode = null;
  requestAnimationFrame(() => {
    closeGameplayDropdowns();
    if (n === "format") {
      const e = document.getElementById("gpBtnLayout");
      if (e) e.click();
    } else if (n === "gameplay" || n === "play") {
      const e = document.getElementById("gpBtnGameplay");
      if (e) e.click();
    } else {
      const e = document.getElementById("gpBtnClips");
      if (e) e.click();
    }
  });
}

function showSplitscreenCustomizer(e, t) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  gpPillFocusMode = t || null;
  showGameplayPillMenu(e, t);
}

window.showSplitscreenCustomizer = showSplitscreenCustomizer;

window.hideGameplayPillMenu = hideGameplayPillMenu;

function hideGameplayPillMenu() {
  if (!gpPill) return;
  endGpHoverPreview();
  gpPill.classList.remove("active");
  closeGameplayDropdowns();
}

window.solisClosePeerPreviewChrome = function solisClosePeerPreviewChrome(e) {
  e = String(e || "");
  if (e !== "gp") {
    try {
      hideGameplayPillMenu();
    } catch (e) {}
  }
  if (e !== "sub") {
    try {
      const e = document.getElementById("subPillMenu");
      if (e?.classList.contains("active")) {
        if (typeof window.hideSubtitlePillMenu === "function") {
          window.hideSubtitlePillMenu();
        } else {
          e.classList.remove("active");
          [ "subDdFont", "subDdColor", "subDdAnim" ].forEach(e => {
            document.getElementById(e)?.classList.remove("open", "is-dragging", "is-swap-out", "is-swap-in");
          });
          e.querySelectorAll(".sub-pill-btn").forEach(e => e.classList.remove("sub-active"));
        }
      }
    } catch (e) {}
  }
  if (e !== "rk") {
    try {
      if (typeof window.hideRankingTextPill === "function") {
        window.hideRankingTextPill();
      } else {
        const e = document.getElementById("rkPillMenu");
        e?.classList.remove("active");
        document.querySelectorAll("#rkDdFont,#rkDdColor,#rkDdStyle").forEach(e => {
          e?.classList.remove("open");
        });
      }
    } catch (e) {}
  }
};

function ensureSplitscreenSecondaryPanels() {
  const e = _splitscreenQuery("splitscreenBottom");
  if (!e) return;
  if (!e.querySelector("#splitscreenFacePanel")) {
    const t = document.createElement("div");
    t.id = "splitscreenFacePanel";
    t.className = "gp-secondary-panel";
    t.innerHTML = `\n            <div class="gp-face-panel-content">\n                <div class="gp-reframe-icon">${GP_ICON_REFRAME}</div>\n                <span class="gp-panel-label">Reframe</span>\n            </div>\n        `;
    e.appendChild(t);
  }
  if (!e.querySelector("#splitscreenBlankPanel")) {
    const t = document.createElement("div");
    t.id = "splitscreenBlankPanel";
    t.innerHTML = `<video class="gp-blank-blur-vid" muted loop playsinline preload="auto"></video>`;
    e.appendChild(t);
  }
}

function _resolveBlankBlurSourceVideo() {
  const e = (typeof getSplitscreenPreviewContainer === "function" ? getSplitscreenPreviewContainer() : null) || document.getElementById("templateVideoPreview");
  const t = [ _splitscreenQuery("splitscreenContentVideo"), e?.querySelector?.("video.library-preview-video"), _splitscreenQuery("splitscreenReframeVideo"), _splitscreenQuery("splitscreenGameplayVideo") ].filter(Boolean);
  for (const e of t) {
    if (e.currentSrc || e.src) return e;
  }
  return null;
}

function syncBlankBlurVideo() {
  const e = _splitscreenQuery("splitscreenBlankPanel");
  const t = e?.querySelector(".gp-blank-blur-vid");
  if (!e || !t) return;
  const n = _resolveBlankBlurSourceVideo();
  const i = n ? n.currentSrc || n.src || "" : "";
  if (!i) {
    if (!t._blankSrcRetry) {
      t._blankSrcRetry = () => {
        t._blankSrcRetry = null;
        syncBlankBlurVideo();
      };
      const e = _splitscreenQuery("splitscreenContentVideo");
      e?.addEventListener("loadeddata", t._blankSrcRetry, {
        once: true
      });
      e?.addEventListener("loadedmetadata", t._blankSrcRetry, {
        once: true
      });
      setTimeout(() => {
        if (t._blankSrcRetry) {
          const e = t._blankSrcRetry;
          t._blankSrcRetry = null;
          e();
        }
      }, 600);
    }
    return;
  }
  t.muted = true;
  t.loop = true;
  t.playsInline = true;
  t.setAttribute("playsinline", "");
  t.setAttribute("muted", "");
  const wireSyncAndPlay = () => {
    const sync = () => {
      if (!n) return;
      try {
        if (Math.abs((t.currentTime || 0) - (n.currentTime || 0)) > .35) {
          t.currentTime = n.currentTime || 0;
        }
      } catch (e) {}
    };
    if (t._blankSync && t._blankSyncTarget) {
      try {
        t._blankSyncTarget.removeEventListener("timeupdate", t._blankSync);
      } catch (e) {}
    }
    t._blankSync = sync;
    t._blankSyncTarget = n;
    n.addEventListener("timeupdate", sync);
    const kick = () => {
      t.play().catch(() => {});
    };
    if (t.readyState >= 2) kick(); else t.addEventListener("canplay", kick, {
      once: true
    });
    kick();
  };
  if (t.dataset.currentSrc === i && t.src) {
    wireSyncAndPlay();
    return;
  }
  t.dataset.currentSrc = i;
  const r = `${i}|${Date.now()}`;
  t._blurLoadToken = r;
  const assignSrc = e => {
    if (t._blurLoadToken !== r) return;
    if (t.dataset.currentSrc !== i) return;
    t.src = e;
    t.load();
    wireSyncAndPlay();
  };
  if (String(i).startsWith("blob:")) {
    cloneBlobUrlForSecondVideo(i).then(e => {
      if (t._blurLoadToken !== r) {
        if (e && e !== _blankBlurObjectUrl) {
          _librarySplitscreenObjectUrls = _librarySplitscreenObjectUrls.filter(t => t !== e);
          try {
            URL.revokeObjectURL(e);
          } catch (e) {}
        }
        return;
      }
      revokeBlankBlurObjectUrl();
      _blankBlurObjectUrl = e;
      assignSrc(e);
    }).catch(() => {
      if (t._blurLoadToken === r) assignSrc(i);
    });
    return;
  }
  revokeBlankBlurObjectUrl();
  assignSrc(i);
}

function reorderSplitscreenPanels() {
  const e = _splitscreenQuery("splitscreenRoot");
  const t = _splitscreenQuery("splitscreenTop");
  const n = _splitscreenQuery("splitscreenDivider");
  const i = _splitscreenQuery("splitscreenBottom");
  if (!e || !t || !n || !i) return;
  if (splitscreenInverted) {
    e.appendChild(i);
    e.appendChild(n);
    e.appendChild(t);
  } else {
    e.appendChild(t);
    e.appendChild(n);
    e.appendChild(i);
  }
}

function getSplitscreenLayout() {
  const e = _splitscreenQuery("splitscreenRoot");
  const t = _splitscreenQuery("splitscreenTop");
  const n = _splitscreenQuery("splitscreenBottom");
  return {
    root: e,
    divider: _splitscreenQuery("splitscreenDivider"),
    dividerLine: _splitscreenQuery("dividerLine"),
    top: t,
    bottom: n,
    content: t,
    secondary: n
  };
}

function calcSplitscreenHeights(e, t, n) {
  const i = Math.max(0, Math.min(2, Number(n) || 1));
  const r = Math.max(1, t.height - i);
  const o = e - t.top;
  const s = Math.max(0, Math.min(r, o - i / 2));
  let a;
  let l;
  if (splitscreenInverted) {
    l = s;
    a = r - l;
  } else {
    a = s;
    l = r - a;
  }
  return {
    contentH: a,
    secondaryH: l,
    avail: r
  };
}

function setSplitscreenPanelHeights(e, t, n) {
  const {root: i, divider: r, content: o, secondary: s} = getSplitscreenLayout();
  if (!i || !r || !o || !s || splitscreenSecondaryCollapsed) return;
  if (_reframeImmersive) return;
  const a = 1;
  const l = i.clientHeight || i.getBoundingClientRect().height || i.offsetHeight;
  const c = Math.max(1, Number(n) > 0 ? Number(n) : l - a);
  e = Math.max(0, Math.min(c, Number(e) || 0));
  t = Math.max(0, c - e);
  r.style.display = "";
  r.style.flex = "0 0 1px";
  r.style.minHeight = "1px";
  r.style.maxHeight = "1px";
  r.style.height = "1px";
  r.style.overflow = "visible";
  r.style.padding = "0";
  r.style.margin = "0";
  r.style.opacity = "1";
  r.style.pointerEvents = "";
  s.style.display = "";
  s.style.opacity = "1";
  o.style.display = "";
  o.style.opacity = "1";
  o.style.flex = "";
  s.style.flex = "";
  if (splitscreenInverted) {
    s.style.flex = `0 0 ${t}px`;
    o.style.flex = `0 0 ${e}px`;
  } else {
    o.style.flex = `0 0 ${e}px`;
    s.style.flex = `0 0 ${t}px`;
  }
}

let _reframeImmersive = false;

let _reframeImmersiveMode = null;

let _reframeFaceProbeCache = new Map;

let _reframePeekBound = false;

let _reframePeekOffsetY = 0;

function getLibraryPreviewProjectId() {
  return window.clipsStudio?.currentTemplateForPreview?.projectId || null;
}

function isReframeImmersive() {
  return Boolean(_reframeImmersive);
}

async function probeProjectFaces(e, t, n) {
  if (!e) return {
    has_face: false,
    face_crop: null
  };
  if (_reframeFaceProbeCache.has(e)) {
    return _reframeFaceProbeCache.get(e);
  }
  const i = _librarySplitscreenCropState?.faceCrop;
  if (Array.isArray(i) && i.length === 4 && i[2] > 1) {
    const t = {
      has_face: true,
      face_crop: i.slice(0, 4)
    };
    _reframeFaceProbeCache.set(e, t);
    return t;
  }
  try {
    const i = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/splitscreen-face-probe`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...typeof getAuthHeaders === "function" ? getAuthHeaders() : {},
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        panel_w: t || 1080,
        panel_h: n || 1920
      })
    });
    if (!i.ok) throw new Error(`face-probe ${i.status}`);
    const r = await i.json();
    const o = {
      has_face: Boolean(r.has_face && r.face_crop),
      face_crop: Array.isArray(r.face_crop) ? r.face_crop.slice(0, 4).map(Number) : null
    };
    _reframeFaceProbeCache.set(e, o);
    return o;
  } catch (t) {
    safeLog("Face probe failed:", t);
    const n = {
      has_face: false,
      face_crop: null
    };
    _reframeFaceProbeCache.set(e, n);
    return n;
  }
}

function applyImmersiveOverlayLayout(e = 0) {
  const t = _splitscreenQuery("splitscreenRoot");
  const n = _splitscreenQuery("splitscreenTop");
  const i = _splitscreenQuery("splitscreenBottom");
  const r = _splitscreenQuery("splitscreenDivider");
  if (!t || !n || !i) return;
  t.classList.add("reframe-immersive");
  t.classList.toggle("reframe-immersive-peek", _reframeImmersiveMode === "peek");
  t.classList.toggle("reframe-immersive-face", _reframeImmersiveMode === "face");
  if (r) {
    r.style.display = "none";
    r.style.opacity = "0";
    r.style.pointerEvents = "none";
  }
  n.style.display = "";
  n.style.opacity = "1";
  n.style.position = "absolute";
  n.style.inset = "0";
  n.style.flex = "none";
  n.style.width = "100%";
  n.style.height = "100%";
  n.style.zIndex = "1";
  i.style.display = "";
  i.style.opacity = "1";
  i.style.position = "absolute";
  i.style.left = "0";
  i.style.right = "0";
  i.style.top = "0";
  i.style.bottom = "0";
  i.style.flex = "none";
  i.style.width = "100%";
  i.style.height = "100%";
  i.style.zIndex = "3";
  i.style.transition = e ? "none" : "transform 0.22s cubic-bezier(.2,.9,.4,1)";
  i.style.transform = e ? `translateY(${Math.max(0, e)}px)` : "";
  i.style.pointerEvents = "auto";
}

function clearImmersiveOverlayLayout() {
  const e = _splitscreenQuery("splitscreenRoot");
  const t = _splitscreenQuery("splitscreenTop");
  const n = _splitscreenQuery("splitscreenBottom");
  if (e) {
    e.classList.remove("reframe-immersive", "reframe-immersive-peek", "reframe-immersive-face");
  }
  [ t, n ].forEach(e => {
    if (!e) return;
    e.style.position = "";
    e.style.inset = "";
    e.style.left = "";
    e.style.right = "";
    e.style.top = "";
    e.style.bottom = "";
    e.style.width = "";
    e.style.height = "";
    e.style.zIndex = "";
    e.style.transform = "";
    e.style.transition = "";
    e.style.flex = "";
  });
}

async function enterReframeImmersive() {
  if (splitscreenSecondaryType !== "face_track") return;
  if (_reframeImmersive) return;
  const e = _splitscreenQuery("splitscreenRoot");
  const t = _splitscreenQuery("splitscreenBottom");
  if (!e || !t) return;
  _reframeImmersive = true;
  _reframePeekOffsetY = 0;
  splitscreenSecondaryCollapsed = false;
  removeSplitscreenCollapseHandle();
  _reframeImmersiveMode = "peek";
  if (_librarySplitscreenCropState) {
    _librarySplitscreenCropState.liveFaceEdit = false;
    _librarySplitscreenCropState.faceDisplayMode = "baked";
  }
  applyImmersiveOverlayLayout(0);
  armPreviewModalDragGuard(600);
  const n = _splitscreenQuery("splitscreenReframeVideo");
  forceLibraryPanelVideoFill(n);
  if (n) {
    n.style.setProperty("pointer-events", "none", "important");
    n.style.cursor = "grab";
  }
  syncLibrarySplitscreenCropPreview();
  bindReframePeekHandlers();
  ensureImmersiveExitGrip();
  e.classList.toggle("reframe-immersive-peek", true);
  e.classList.toggle("reframe-immersive-face", false);
  markLibrarySplitscreenDirty();
}

function exitReframeImmersive(e) {
  if (!_reframeImmersive) return;
  _reframeImmersive = false;
  _reframeImmersiveMode = null;
  _reframePeekOffsetY = 0;
  unbindReframePeekHandlers();
  removeImmersiveExitGrip();
  clearImmersiveOverlayLayout();
  const t = Number.isFinite(splitscreenSavedRatio) ? splitscreenSavedRatio : .5;
  splitscreenContentRatio = Math.max(.02, Math.min(.98, e ?? t));
  splitscreenSecondaryCollapsed = false;
  applySplitscreenRatio();
  if (_librarySplitscreenCropState && splitscreenSecondaryType === "face_track") {
    _librarySplitscreenCropState.liveFaceEdit = true;
    _librarySplitscreenCropState.faceDisplayMode = "live";
    syncLibrarySplitscreenCropPreview();
    bindFaceReframePanHandlers();
  }
  markLibrarySplitscreenDirty();
}

function removeImmersiveExitGrip() {
  _splitscreenQuery("splitscreenImmersiveExitGrip")?.remove();
}

function ensureImmersiveExitGrip() {
  const e = _splitscreenQuery("splitscreenRoot");
  if (!e || !_reframeImmersive) return;
  let t = _splitscreenQuery("splitscreenImmersiveExitGrip");
  if (!t) {
    t = document.createElement("div");
    t.id = "splitscreenImmersiveExitGrip";
    t.className = "ss-immersive-exit-grip";
    t.innerHTML = `<div class="ss-immersive-exit-bar" title="Drag down to exit"></div>`;
    e.appendChild(t);
  }
  if (t.dataset.bound === "true") return;
  t.dataset.bound = "true";
  let n = 0;
  let i = false;
  let r = null;
  const onMove = e => {
    if (!i || !_reframeImmersive) return;
    const t = Math.max(0, e - n);
    _reframePeekOffsetY = t;
    applyImmersiveOverlayLayout(t);
    armPreviewModalDragGuard(600);
  };
  const onUp = () => {
    if (!i) return;
    i = false;
    const e = _splitscreenQuery("splitscreenRoot");
    const n = e?.clientHeight || 1;
    const o = _reframePeekOffsetY / n;
    if (r != null && t.hasPointerCapture?.(r)) {
      try {
        t.releasePointerCapture(r);
      } catch (e) {}
    }
    r = null;
    if (o >= SPLITSCREEN_PEEK_EXIT) {
      exitReframeImmersive();
      return;
    }
    _reframePeekOffsetY = 0;
    applyImmersiveOverlayLayout(0);
  };
  t.addEventListener("pointerdown", e => {
    if (!_reframeImmersive) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    i = true;
    n = e.clientY;
    r = e.pointerId;
    try {
      t.setPointerCapture(e.pointerId);
    } catch (e) {}
    armPreviewModalDragGuard(600);
  });
  t.addEventListener("pointermove", e => {
    if (!i) return;
    e.preventDefault();
    onMove(e.clientY);
  });
  t.addEventListener("pointerup", e => {
    if (!i) return;
    e.preventDefault();
    e.stopPropagation();
    onUp();
  });
  t.addEventListener("pointercancel", () => onUp());
}

function bindReframePeekHandlers() {
  const e = _splitscreenQuery("splitscreenBottom");
  if (!e || _reframePeekBound) return;
  _reframePeekBound = true;
  let t = 0;
  let n = false;
  let i = null;
  const onMove = e => {
    if (!n || !_reframeImmersive || _reframeImmersiveMode !== "peek") return;
    const i = Math.max(0, e - t);
    _reframePeekOffsetY = i;
    applyImmersiveOverlayLayout(i);
    armPreviewModalDragGuard(600);
  };
  const onUp = () => {
    if (!n) return;
    n = false;
    const t = _splitscreenQuery("splitscreenRoot");
    const r = t?.clientHeight || 1;
    const o = _reframePeekOffsetY / r;
    if (i != null && e.hasPointerCapture?.(i)) {
      try {
        e.releasePointerCapture(i);
      } catch (e) {}
    }
    i = null;
    if (o >= SPLITSCREEN_PEEK_EXIT) {
      exitReframeImmersive();
      return;
    }
    _reframePeekOffsetY = 0;
    applyImmersiveOverlayLayout(0);
  };
  e._peekPointerDown = r => {
    if (!_reframeImmersive || _reframeImmersiveMode !== "peek") return;
    if (r.button != null && r.button !== 0) return;
    r.preventDefault();
    r.stopPropagation();
    n = true;
    t = r.clientY;
    i = r.pointerId;
    try {
      e.setPointerCapture(r.pointerId);
    } catch (e) {}
    armPreviewModalDragGuard(600);
  };
  e._peekPointerMove = e => {
    if (!n) return;
    e.preventDefault();
    onMove(e.clientY);
  };
  e._peekPointerUp = e => {
    if (!n) return;
    e.preventDefault();
    e.stopPropagation();
    onUp();
  };
  e.addEventListener("pointerdown", e._peekPointerDown);
  e.addEventListener("pointermove", e._peekPointerMove);
  e.addEventListener("pointerup", e._peekPointerUp);
  e.addEventListener("pointercancel", e._peekPointerUp);
}

function unbindReframePeekHandlers() {
  const e = _splitscreenQuery("splitscreenBottom");
  _reframePeekBound = false;
  if (!e) return;
  if (e._peekPointerDown) {
    e.removeEventListener("pointerdown", e._peekPointerDown);
    e.removeEventListener("pointermove", e._peekPointerMove);
    e.removeEventListener("pointerup", e._peekPointerUp);
    e.removeEventListener("pointercancel", e._peekPointerUp);
    delete e._peekPointerDown;
    delete e._peekPointerMove;
    delete e._peekPointerUp;
  }
}

function maybeEnterReframeImmersiveFromDrag(e, t, n) {
  if (splitscreenSecondaryType !== "face_track") return false;
  if (!window.clipsStudio?._librarySplitscreenCustomize) return false;
  if (_reframeImmersive) return true;
  const i = t / Math.max(1, n);
  if (i < SPLITSCREEN_IMMERSIVE_ENTER) return false;
  if (!splitscreenSecondaryCollapsed && splitscreenContentRatio < .98) {
    splitscreenSavedRatio = Math.max(.02, Math.min(.98, splitscreenContentRatio));
  }
  enterReframeImmersive();
  return true;
}

function collapseSplitscreenSecondary() {
  if (_reframeImmersive) {
    resetReframeImmersiveState();
  }
  if (!splitscreenSecondaryCollapsed && splitscreenContentRatio < .98) {
    splitscreenSavedRatio = Math.max(.02, Math.min(.98, splitscreenContentRatio));
  }
  splitscreenSecondaryCollapsed = true;
  splitscreenContentRatio = 1;
  applySplitscreenRatio();
  markLibrarySplitscreenDirty();
}

function resetReframeImmersiveState() {
  _reframeImmersive = false;
  _reframeImmersiveMode = null;
  _reframePeekOffsetY = 0;
  unbindReframePeekHandlers();
  removeImmersiveExitGrip();
  clearImmersiveOverlayLayout();
}

function smoothCollapseSplitscreenSecondary() {
  const {root: e, divider: t, content: n, secondary: i} = getSplitscreenLayout();
  if (!e || !t || !n || !i) return;
  notifySubtitleLayoutEdit();
  const r = 1;
  const o = e.getBoundingClientRect().height || e.offsetHeight;
  const s = Math.max(1, o - r);
  const a = s;
  e.classList.remove("is-dragging");
  setSplitscreenPanelHeights(a, 0);
  let l = false;
  const finish = () => {
    if (l) return;
    l = true;
    i.removeEventListener("transitionend", onTransitionEnd);
    collapseSplitscreenSecondary();
  };
  const onTransitionEnd = e => {
    if (e.target !== i || e.propertyName !== "flex-basis") return;
    finish();
  };
  i.addEventListener("transitionend", onTransitionEnd);
  window.setTimeout(finish, SPLITSCREEN_COLLAPSE_ANIM_MS + 40);
}

function expandSplitscreenSecondary(e) {
  const {root: t} = getSplitscreenLayout();
  const n = Number.isFinite(splitscreenSavedRatio) ? splitscreenSavedRatio : .5;
  const i = e ?? (Number.isFinite(n) ? n : .5);
  notifySubtitleLayoutEdit();
  splitscreenSecondaryCollapsed = false;
  splitscreenContentRatio = i;
  removeSplitscreenCollapseHandle();
  applySplitscreenRatio();
  markLibrarySplitscreenDirty();
  ensureKeptReframePanelLoaded();
  if (!t) return;
  const {contentH: r, secondaryH: o} = (() => {
    const e = 1;
    const n = t.getBoundingClientRect().height || t.offsetHeight;
    const r = Math.max(1, n - e);
    const o = Math.round(r * i);
    return {
      contentH: o,
      secondaryH: r - o
    };
  })();
  setSplitscreenPanelHeights(r, 0);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setSplitscreenPanelHeights(r, o);
      playBothLibraryPanels(t);
    });
  });
}

function ensureKeptReframePanelLoaded() {
  try {
    const e = window.clipsStudio?.currentTemplateForPreview?.projectId || window.clipsStudio?._libraryPreviewProjectId;
    if (!e || typeof API_BASE_URL === "undefined") return;
    const t = _splitscreenQuery("splitscreenReframeVideo");
    const n = _splitscreenQuery("splitscreenGameplayVideo");
    const i = `${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/splitscreen-layer/secondary`;
    if (splitscreenSecondaryType === "face_track" && t) {
      const e = Boolean(t.currentSrc || t.src);
      if (!e || t.error) {
        t.style.setProperty("display", "block", "important");
        t.src = i;
        t.load();
        t.play().catch(() => {});
      }
      const n = _splitscreenQuery("splitscreenContentVideo");
      if (n) bindLibrarySplitscreenPlaybackSync(n, t);
      syncLibrarySplitscreenCropPreview();
      return;
    }
    if (splitscreenSecondaryType === "gameplay" && n) {
      const e = Boolean(n.currentSrc || n.src);
      if (!e || n.error) {
        n.style.setProperty("display", "block", "important");
        n.src = i;
        n.load();
        n.play().catch(() => {});
      }
    }
  } catch (e) {}
}

function removeSplitscreenCollapseHandle() {
  _splitscreenQuery("splitscreenCollapseHandle")?.remove();
}

function ensureSplitscreenCollapseHandle() {
  const {root: e} = getSplitscreenLayout();
  if (!e || !splitscreenSecondaryCollapsed) return;
  let t = _splitscreenQuery("splitscreenCollapseHandle");
  if (!t) {
    t = document.createElement("div");
    t.id = "splitscreenCollapseHandle";
    t.className = "ss-collapse-handle";
    t.innerHTML = `<div class="ss-collapse-grip" title="Drag to restore reframe"></div>`;
    e.appendChild(t);
    initSplitscreenCollapseHandle(t);
  }
}

function initSplitscreenCollapseHandle(e) {
  if (e.dataset.collapseInit === "true") return;
  e.dataset.collapseInit = "true";
  const startExpandDrag = e => {
    const {root: t} = getSplitscreenLayout();
    if (!t) return;
    t.classList.add("is-dragging");
    notifySubtitleLayoutEdit();
    const n = t.getBoundingClientRect();
    const i = 1;
    const r = n.height - i;
    let o = false;
    const onMove = e => {
      const t = e.clientY - n.top;
      let i;
      let s;
      if (splitscreenInverted) {
        s = Math.max(0, Math.min(r, t));
        if (s <= 1) return;
        i = r - s;
      } else {
        i = Math.max(0, Math.min(r, t));
        s = r - i;
        if (s <= 1) return;
      }
      o = true;
      splitscreenSecondaryCollapsed = false;
      removeSplitscreenCollapseHandle();
      splitscreenContentRatio = i / r;
      setSplitscreenPanelHeights(i, s, r);
    };
    const onUp = () => {
      t.classList.remove("is-dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onUp);
      if (!o) {
        expandSplitscreenSecondary();
      } else {
        syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        syncLibrarySplitscreenCropPreview();
        markLibrarySplitscreenDirty();
      }
      notifySubtitleLayoutIdle();
    };
    const onTouchMove = e => {
      if (e.touches[0]) onMove(e.touches[0]);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouchMove, {
      passive: false
    });
    document.addEventListener("touchend", onUp);
  };
  e.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();
    startExpandDrag(e.clientY);
  });
  e.addEventListener("touchstart", e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches[0]) startExpandDrag(e.touches[0].clientY);
  }, {
    passive: false
  });
  e.addEventListener("click", e => {
    e.stopPropagation();
    expandSplitscreenSecondary();
  });
}

function applySplitscreenDrag(e, t, n) {
  const {root: i} = getSplitscreenLayout();
  if (!i) return null;
  _splitscreenDragPending = {
    clientY: e,
    rootRect: t,
    dividerH: n
  };
  if (_splitscreenDragRaf) return null;
  _splitscreenDragRaf = requestAnimationFrame(() => {
    _splitscreenDragRaf = 0;
    const e = _splitscreenDragPending;
    _splitscreenDragPending = null;
    if (!e) return;
    const {contentH: t, secondaryH: n, avail: i} = calcSplitscreenHeights(e.clientY, e.rootRect, e.dividerH);
    splitscreenSecondaryCollapsed = false;
    setSplitscreenPanelHeights(t, n, i);
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer(), getDividerCenterYFromHeights(t, n));
  });
  return null;
}

function finishSplitscreenDrag(e, t, n) {
  const {root: i} = getSplitscreenLayout();
  if (_splitscreenDragRaf) {
    cancelAnimationFrame(_splitscreenDragRaf);
    _splitscreenDragRaf = 0;
  }
  _splitscreenDragPending = null;
  const {contentH: r, secondaryH: o, avail: s} = calcSplitscreenHeights(e, t, n);
  if (o <= SPLITSCREEN_COLLAPSE_SNAP) {
    i?.classList.remove("is-dragging");
    collapseSplitscreenSecondary();
    notifySubtitleLayoutIdle();
    return;
  }
  const a = r / Math.max(1, s);
  if (splitscreenSecondaryType !== "face_track" && a >= SPLITSCREEN_IMMERSIVE_ENTER) {
    i?.classList.remove("is-dragging");
    collapseSplitscreenSecondary();
    notifySubtitleLayoutIdle();
    return;
  }
  if (maybeEnterReframeImmersiveFromDrag(r, o, s)) {
    i?.classList.remove("is-dragging");
    notifySubtitleLayoutIdle();
    return;
  }
  const l = Math.max(0, Math.min(s, r));
  const c = s - l;
  splitscreenContentRatio = s > 0 ? l / s : .5;
  if (splitscreenContentRatio > .01 && splitscreenContentRatio < .99) {
    splitscreenSavedRatio = splitscreenContentRatio;
  }
  setSplitscreenPanelHeights(l, c, s);
  requestAnimationFrame(() => {
    i?.classList.remove("is-dragging");
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    syncLibrarySplitscreenCropPreview();
    markLibrarySplitscreenDirty();
    notifySubtitleLayoutIdle();
    try {
      if (window.SolisMemory && !window.SolisMemory._applying && typeof window.SolisMemory.recordLayout === "function") {
        window.SolisMemory.recordLayout("splitscreen");
      }
    } catch (e) {}
  });
}

function applySplitscreenRatio() {
  const {root: e, divider: t, content: n, secondary: i} = getSplitscreenLayout();
  if (!e || !t || !n || !i) return;
  if (_reframeImmersive) {
    applyImmersiveOverlayLayout(_reframePeekOffsetY);
    return;
  }
  e.classList.toggle("secondary-at-top", splitscreenInverted);
  e.classList.toggle("secondary-collapsed", splitscreenSecondaryCollapsed);
  if (splitscreenSecondaryCollapsed) {
    t.style.display = "none";
    i.style.display = "none";
    i.style.flex = "0 0 0px";
    i.style.opacity = "0";
    n.style.flex = "1 1 100%";
    n.style.minHeight = "0";
    ensureSplitscreenCollapseHandle();
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    syncLibrarySplitscreenCropPreview();
    return;
  }
  removeSplitscreenCollapseHandle();
  t.style.display = "";
  t.style.opacity = "1";
  t.style.pointerEvents = "";
  i.style.display = "";
  i.style.opacity = "1";
  n.style.display = "";
  n.style.opacity = "1";
  n.style.flex = "";
  n.style.minHeight = "";
  i.style.flex = "";
  const r = e.clientHeight || e.getBoundingClientRect().height || e.offsetHeight;
  t.style.flex = "0 0 1px";
  t.style.minHeight = "1px";
  t.style.maxHeight = "1px";
  t.style.height = "1px";
  t.style.overflow = "visible";
  t.style.padding = "0";
  t.style.margin = "0";
  const o = 1;
  const s = Math.max(1, r - o);
  let a = Number(splitscreenContentRatio);
  if (!Number.isFinite(a) || a <= 0 || a >= 1) a = .5;
  a = Math.max(.02, Math.min(.98, a));
  splitscreenContentRatio = a;
  const l = Math.round(s * a);
  const c = Math.max(0, s - l);
  setSplitscreenPanelHeights(l, c, s);
  syncLibrarySplitscreenCropPreview();
}

function applySecondaryVisual() {
  ensureSplitscreenSecondaryPanels();
  const e = _splitscreenQuery("splitscreenGameplayVideo");
  const t = _splitscreenQuery("splitscreenReframeVideo");
  const n = _splitscreenQuery("splitscreenFacePanel");
  const i = _splitscreenQuery("splitscreenBlankPanel");
  const r = Boolean(window.clipsStudio?._librarySplitscreenCustomize);
  const hideGameplay = () => {
    if (e) e.style.setProperty("display", "none", "important");
  };
  const hideReframe = () => {
    if (t) {
      t.style.setProperty("display", "none", "important");
      t.style.visibility = "hidden";
      t.style.opacity = "0";
    }
  };
  const hideFace = () => {
    if (n) n.classList.remove("visible");
  };
  const hideBlank = () => {
    if (!i) return;
    i.classList.remove("visible");
    const e = _splitscreenQuery("splitscreenBottom");
    if (e) e.classList.remove("ss-blank-fill", "ss-reframe-fill");
    const t = _splitscreenQuery("splitscreenSecondaryViewport");
    if (t) {
      t.style.removeProperty("opacity");
      t.style.removeProperty("visibility");
      t.style.removeProperty("pointer-events");
    }
    clearTimeout(i._modeClearT);
    i._modeClearT = setTimeout(() => {
      if (!i.classList.contains("visible")) {
        i.classList.remove("mode-black", "mode-blur");
        const e = i.querySelector(".gp-blank-blur-vid");
        if (e) {
          try {
            e.pause();
          } catch (e) {}
        }
      }
    }, 420);
  };
  if (splitscreenSecondaryType === "blank" || splitscreenSecondaryType === "blank_blur") {
    hideGameplay();
    hideReframe();
    hideFace();
    if (e) {
      e.style.setProperty("display", "none", "important");
      e.style.setProperty("visibility", "hidden", "important");
      e.style.setProperty("opacity", "0", "important");
    }
    if (t) {
      t.style.setProperty("display", "none", "important");
      t.style.setProperty("visibility", "hidden", "important");
      t.style.setProperty("opacity", "0", "important");
    }
    const n = _splitscreenQuery("splitscreenBottom");
    if (n) {
      n.classList.remove("ss-reframe-fill");
      n.classList.add("ss-blank-fill");
    }
    if (i) {
      clearTimeout(i._modeClearT);
      i.classList.add("visible");
      i.classList.toggle("mode-black", splitscreenSecondaryType === "blank");
      i.classList.toggle("mode-blur", splitscreenSecondaryType === "blank_blur");
      syncBlankBlurVideo();
      const e = _splitscreenQuery("splitscreenSecondaryViewport");
      if (e) {
        e.style.setProperty("opacity", "0", "important");
        e.style.setProperty("visibility", "hidden", "important");
        e.style.setProperty("pointer-events", "none", "important");
      }
      if (splitscreenSecondaryType === "blank") {
        const e = i.querySelector(".gp-blank-blur-vid");
        if (e) {
          try {
            e.pause();
          } catch (e) {}
        }
      }
    }
  } else if (splitscreenSecondaryType === "face_track") {
    const i = _splitscreenQuery("splitscreenBottom");
    if (i) {
      i.classList.remove("ss-blank-fill");
      i.classList.add("ss-reframe-fill");
    }
    hideBlank();
    hideFace();
    if (e) {
      e.style.setProperty("display", "none", "important");
      e.style.setProperty("visibility", "hidden", "important");
      e.style.setProperty("opacity", "0", "important");
      try {
        e.pause();
      } catch (e) {}
    }
    if (t) {
      t.style.removeProperty("display");
      t.style.setProperty("display", "block", "important");
      t.style.setProperty("visibility", "visible", "important");
      t.style.setProperty("opacity", "1", "important");
    }
    if (r && t) {
      forceLibraryPanelVideoFill(t);
      syncLibrarySplitscreenCropPreview();
    } else if (n) {
      hideReframe();
      n.classList.add("visible");
    } else if (t) {
      t.style.visibility = "visible";
      t.style.opacity = "1";
    }
  } else {
    const t = _splitscreenQuery("splitscreenBottom");
    if (t) {
      t.classList.remove("ss-blank-fill");
      t.classList.remove("ss-reframe-fill");
    }
    hideBlank();
    hideFace();
    if (e) {
      e.style.display = "block";
      e.style.removeProperty("visibility");
      e.style.removeProperty("opacity");
    }
    hideReframe();
    const n = r && _librarySplitscreenCropState?.secondaryFromLayer && e?.src && String(e.src).includes("/splitscreen-layer/");
    if (n) {
      syncLibrarySplitscreenCropPreview();
    } else {
      applyGameplayClip(selectedGameplayClip);
    }
  }
  if (splitscreenSecondaryCollapsed) {
    ensureSplitscreenCollapseHandle();
  }
}

function applySplitscreenPreview() {
  reorderSplitscreenPanels();
  applySplitscreenRatio();
  applySecondaryVisual();
  syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
}

function applyGameplayClip(e) {
  selectedGameplayClip = e;
  const t = getGameplayClipsForUI().find(t => t.id === e);
  const n = _splitscreenQuery("splitscreenGameplayVideo");
  if (!n || !t) return;
  n.style.position = "";
  n.style.left = "";
  n.style.top = "";
  n.style.width = "100%";
  n.style.height = "100%";
  n.style.objectFit = "cover";
  n.style.maxWidth = "";
  n.style.transform = "";
  n.style.transition = "opacity .28s cubic-bezier(.22,.8,.28,1)";
  const i = `/assets/${t.filename}`;
  if (n.dataset.currentSrc === i && !n.paused && n.readyState >= 2) {
    n.style.opacity = "1";
    return;
  }
  n.dataset.currentSrc = i;
  n.muted = true;
  n.loop = true;
  n.playsInline = true;
  n.preload = "auto";
  n.setAttribute("playsinline", "");
  n.style.opacity = "0";
  const r = n.querySelector("source");
  if (r) r.remove();
  if (splitscreenVideoCanPlayHandler) {
    n.removeEventListener("canplay", splitscreenVideoCanPlayHandler);
  }
  splitscreenVideoCanPlayHandler = () => {
    n.play().catch(() => {});
    requestAnimationFrame(() => {
      n.style.opacity = "1";
    });
    n.removeEventListener("canplay", splitscreenVideoCanPlayHandler);
    splitscreenVideoCanPlayHandler = null;
  };
  n.addEventListener("canplay", splitscreenVideoCanPlayHandler);
  n.src = i;
  n.load();
}

window.getSplitscreenConfig = function() {
  return {
    gameplay_clip_id: splitscreenSecondaryType === "gameplay" ? selectedGameplayClip : splitscreenSecondaryType,
    splitscreen_inverted: splitscreenInverted,
    splitscreen_secondary_type: splitscreenSecondaryType,
    splitscreen_secondary_collapsed: splitscreenSecondaryCollapsed,
    splitscreen_content_ratio: splitscreenContentRatio
  };
};

window.applySplitscreenMemoryLayout = function(e, t) {
  if (!e || typeof e !== "object") return false;
  const n = !t || t.commit !== false;
  try {
    if (e.splitscreen_inverted != null) {
      splitscreenInverted = !!e.splitscreen_inverted;
    }
    if (Number.isFinite(Number(e.splitscreen_content_ratio))) {
      splitscreenContentRatio = Math.max(.02, Math.min(.98, Number(e.splitscreen_content_ratio)));
      splitscreenSavedRatio = splitscreenContentRatio;
    }
    const t = String(e.splitscreen_secondary_type || "").toLowerCase();
    const i = e.gameplay_clip_id;
    if (t === "face_track" || t === "blank" || t === "blank_blur") {
      selectSecondaryGameplay(t);
    } else if (t === "gameplay" || i && ![ "face_track", "blank", "blank_blur" ].includes(String(i))) {
      const e = i && ![ "face_track", "blank", "blank_blur" ].includes(String(i)) ? i : selectedGameplayClip || "minecraft_1";
      selectSecondaryGameplay(e);
    }
    if (e.splitscreen_secondary_collapsed) {
      collapseSplitscreenSecondary();
    } else {
      splitscreenSecondaryCollapsed = false;
      removeSplitscreenCollapseHandle();
      applySplitscreenRatio();
      applySplitscreenPreview();
      syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    }
    if (n) {
      markLibrarySplitscreenDirty();
      try {
        buildSplitscreenFormatDropdown();
        buildGameplayClipsDropdown();
      } catch (e) {}
      try {
        if (typeof closeGameplayDropdowns === "function") closeGameplayDropdowns();
      } catch (e) {}
      window.__solisSsMemPreview = null;
    }
    return true;
  } catch (e) {
    safeLog("applySplitscreenMemoryLayout failed:", e);
    return false;
  }
};

window.offerSplitscreenMemorySuggest = function(e, t) {
  if (!e || typeof e !== "object") return false;
  const n = document.getElementById("templatePreviewModal");
  if (!n || !n.classList.contains("active")) return false;
  const i = typeof window.getSplitscreenConfig === "function" ? window.getSplitscreenConfig() : {};
  window.__solisSsMemPreview = {
    ratio: Number(i.splitscreen_content_ratio),
    inverted: !!i.splitscreen_inverted,
    collapsed: !!i.splitscreen_secondary_collapsed,
    secondary_type: i.splitscreen_secondary_type,
    gameplay_clip_id: i.gameplay_clip_id
  };
  const r = String(e.splitscreen_secondary_type || "").toLowerCase();
  const o = r && (String(i.splitscreen_secondary_type || "") !== r || r === "gameplay" && i.gameplay_clip_id !== e.gameplay_clip_id);
  const s = Number(e.splitscreen_content_ratio);
  const a = Number(i.splitscreen_content_ratio);
  const l = Number.isFinite(s) && (!Number.isFinite(a) || Math.abs(s - a) > .015);
  const c = e.splitscreen_inverted != null && !!e.splitscreen_inverted !== !!i.splitscreen_inverted;
  try {
    hideGameplayPillMenu();
  } catch (e) {}
  document.querySelectorAll(".gp-mem-pick").forEach(e => e.classList.remove("gp-mem-pick"));
  try {
    document.getElementById("subPillMenu")?.classList.remove("active");
    document.getElementById("previewEditorPill")?.querySelectorAll(".tool-btn.active").forEach(e => e.classList.remove("active"));
  } catch (e) {}
  if (!o && !l && !c) return true;
  try {
    window.SolisMemory && (window.SolisMemory._applying = true);
    if (c) {
      splitscreenInverted = !!e.splitscreen_inverted;
    }
    if (l) {
      splitscreenContentRatio = Math.max(.02, Math.min(.98, s));
      splitscreenSavedRatio = splitscreenContentRatio;
    }
    if (o && r) {
      if (r === "face_track" || r === "blank" || r === "blank_blur") {
        selectSecondaryGameplay(r);
      } else if (r === "gameplay" || e.gameplay_clip_id) {
        const t = e.gameplay_clip_id && ![ "face_track", "blank", "blank_blur" ].includes(String(e.gameplay_clip_id)) ? e.gameplay_clip_id : selectedGameplayClip || "minecraft_1";
        selectSecondaryGameplay(t);
      }
    } else {
      applySplitscreenRatio();
      applySplitscreenPreview();
    }
    applySecondaryVisual();
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    if (window.SolisMemory) window.SolisMemory._applying = false;
  } catch (e) {
    if (window.SolisMemory) window.SolisMemory._applying = false;
  }
  return true;
};

window.revertSplitscreenMemorySuggestPreview = function() {
  const e = window.__solisSsMemPreview;
  window.__solisSsMemPreview = null;
  if (!e || typeof e !== "object") return false;
  try {
    window.SolisMemory && (window.SolisMemory._applying = true);
    if (Number.isFinite(Number(e.ratio))) {
      splitscreenContentRatio = Math.max(.02, Math.min(.98, Number(e.ratio)));
      splitscreenSavedRatio = splitscreenContentRatio;
    }
    splitscreenInverted = !!e.inverted;
    const t = String(e.secondary_type || "").toLowerCase();
    if (t === "face_track" || t === "blank" || t === "blank_blur") {
      selectSecondaryGameplay(t);
    } else if (t === "gameplay" || e.gameplay_clip_id) {
      selectSecondaryGameplay(e.gameplay_clip_id || selectedGameplayClip || "minecraft_1");
    }
    if (e.collapsed) {
      collapseSplitscreenSecondary();
    } else {
      splitscreenSecondaryCollapsed = false;
      removeSplitscreenCollapseHandle();
      applySplitscreenRatio();
      applySplitscreenPreview();
    }
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    if (window.SolisMemory) window.SolisMemory._applying = false;
    return true;
  } catch (e) {
    if (window.SolisMemory) window.SolisMemory._applying = false;
    return false;
  }
};

window.clearSplitscreenMemorySuggestChrome = function() {
  document.querySelectorAll(".gp-mem-pick").forEach(e => e.classList.remove("gp-mem-pick"));
};

function showGameplayClipSelector(e) {
  showSplitscreenCustomizer(e, "fill");
}

function selectGameplayClip(e) {
  selectSecondaryGameplay(e);
}

window.selectGameplayClip = selectGameplayClip;

function getSplitscreenPreviewContainer() {
  if (_splitscreenScopeEl) return _splitscreenScopeEl;
  return document.getElementById("templateVideoPreview");
}

function getDividerCenterY(e) {
  const t = e?.querySelector("#splitscreenDivider");
  if (!t || !e) return null;
  const n = e.getBoundingClientRect();
  const i = t.getBoundingClientRect();
  return i.top + i.height / 2 - n.top;
}

function getDividerCenterYFromHeights(e, t) {
  const n = 1;
  if (typeof splitscreenInverted !== "undefined" && splitscreenInverted) {
    return (Number(t) || 0) + n / 2;
  }
  return (Number(e) || 0) + n / 2;
}

function storeSubtitleDividerOffset(e, t) {
  if (!e || !t) return;
  if (e.dataset.dividerPinned !== "1") return;
  const n = getDividerCenterY(t);
  if (n === null) return;
  const i = t.getBoundingClientRect();
  const r = e.getBoundingClientRect();
  const o = r.top + r.height / 2 - i.top;
  if (!Number.isFinite(o)) return;
  e.dataset.dividerOffsetY = String(o - n);
}

function syncSplitscreenSubtitles(e, t) {
  e = e || getSplitscreenPreviewContainer();
  if (!e || !e.querySelector("#splitscreenDivider")) return;
  const n = Number.isFinite(t) ? t : getDividerCenterY(e);
  if (n === null || !Number.isFinite(n)) return;
  const i = e.getBoundingClientRect().height;
  const r = !!e.querySelector("#splitscreenRoot.is-dragging");
  e.querySelectorAll(".sub-text-block").forEach(t => {
    if (r) {
      t.style.setProperty("z-index", "90", "important");
    } else {
      const e = t.classList.contains("selected") || t.classList.contains("is-resizing") || t.classList.contains("is-dragging") ? "220" : "120";
      t.style.setProperty("z-index", e, "important");
    }
    if (t.dataset.aiHook === "1") {
      if (typeof window.placeAiHookInLayout === "function") {
        try {
          window.placeAiHookInLayout(t, e);
        } catch (e) {}
      }
      return;
    }
    if (t.classList.contains("overlay-text-block")) return;
    let o = t.dataset.dividerPinned === "1";
    const s = t.offsetHeight || 0;
    const a = parseFloat(t.style.top);
    const l = Number.isFinite(a) ? a + s / 2 : NaN;
    if (!o && Number.isFinite(l) && Math.abs(l - n) < 90) {
      t.dataset.dividerPinned = "1";
      t.dataset.dividerOffsetY = String(l - n);
      delete t.dataset.yPct;
      o = true;
    }
    const c = Number(t.dataset.yPct);
    if (!o) {
      if (Number.isFinite(c)) {
        if (typeof window.placeCaptionAtYPct === "function") {
          try {
            window.placeCaptionAtYPct(t, e, c);
          } catch (e) {}
        } else {
          const e = Math.round(c * i - s / 2);
          t.style.top = `${Math.max(0, Math.min(Math.max(0, i - s), e))}px`;
        }
      } else if (Number.isFinite(a) && i > 0) {
        const e = (a + s / 2) / i;
        t.dataset.yPct = String(Math.max(.02, Math.min(.98, e)).toFixed(3));
      }
      return;
    }
    if (t.dataset.dividerOffsetY == null || t.dataset.dividerOffsetY === "") {
      storeSubtitleDividerOffset(t, e);
      if (t.dataset.dividerOffsetY == null || t.dataset.dividerOffsetY === "") {
        t.dataset.dividerOffsetY = String(-(s / 2 + 6));
      }
    }
    const d = parseFloat(t.dataset.dividerOffsetY || "0");
    if (!Number.isFinite(d)) return;
    const p = Math.max(0, Math.min(Math.max(0, i - s), Math.round(n + d - s / 2)));
    t.style.top = `${p}px`;
    if (typeof window.lockSubtitleCenterX === "function") {
      window.lockSubtitleCenterX(t);
    }
  });
  if (typeof window._repositionSubtitleMenu === "function") {
    window._repositionSubtitleMenu();
  }
}

window.storeSubtitleDividerOffset = storeSubtitleDividerOffset;

window.syncSplitscreenSubtitles = syncSplitscreenSubtitles;

function initializeSplitscreenDivider() {
  const {divider: e, dividerLine: t, root: n, top: i} = getSplitscreenLayout();
  if (!e || !t || !n || !i) {
    safeLog("⚠ï¸ Missing splitscreen elements");
    return;
  }
  if (e.dataset.splitscreenInit === "true") return;
  e.dataset.splitscreenInit = "true";
  e.addEventListener("mousedown", e => e.stopPropagation());
  e.addEventListener("click", e => e.stopPropagation());
  n.addEventListener("click", e => {
    if (e.target.closest("#splitscreenDivider")) return;
    if (e.target.closest("#splitscreenCollapseHandle")) {
      if (splitscreenSecondaryCollapsed) expandSplitscreenSecondary();
      return;
    }
    if (e.target.closest(".sub-text-block")) return;
    if (e.target.closest(".gp-pill-menu") || e.target.closest(".gp-dropdown")) return;
    if (e.target.closest("#splitscreenReframeVideo")) return;
    if (e.target.closest(".preview-audio-toggle")) return;
    const t = e.target.closest("#splitscreenTop");
    const n = e.target.closest("#splitscreenBottom");
    if (t || e.target.closest(".ss-content-placeholder")) {
      showSplitscreenCustomizer(e, "gameplay");
    } else if (n) {
      showSplitscreenCustomizer(e, "fill");
    }
  });
  const setDividerHover = n => {
    e.classList.toggle("is-divider-hot", !!n);
    if (!t) return;
    t.style.width = "100%";
    t.style.maxWidth = "none";
    t.style.borderRadius = "0";
    t.style.height = "";
    t.style.background = "";
    t.style.boxShadow = "";
    t.style.transform = "none";
  };
  e.addEventListener("mouseenter", () => setDividerHover(true));
  e.addEventListener("mouseleave", () => setDividerHover(false));
  const startDividerDrag = e => {
    setDividerHover(true);
    n.classList.add("is-dragging");
    armPreviewModalDragGuard(1200);
    notifySubtitleLayoutEdit();
    const t = getSplitscreenPreviewContainer();
    if (t) {
      const e = getDividerCenterY(t);
      if (e != null) {
        t.querySelectorAll(".sub-text-block:not(.overlay-text-block)").forEach(t => {
          if (t.dataset.aiHook === "1") return;
          const n = t.offsetHeight || 0;
          const i = parseFloat(t.style.top);
          if (!Number.isFinite(i)) return;
          const r = i + n / 2;
          if (t.dataset.dividerPinned === "1" || Math.abs(r - e) < 100) {
            t.dataset.dividerPinned = "1";
            t.dataset.dividerOffsetY = String(r - e);
            delete t.dataset.yPct;
          }
        });
      }
    }
    const i = n.getBoundingClientRect();
    const r = 1;
    let o = e;
    applySplitscreenDrag(o, i, r);
    if (_splitscreenDragRaf) {
      cancelAnimationFrame(_splitscreenDragRaf);
      _splitscreenDragRaf = 0;
    }
    if (_splitscreenDragPending) {
      const e = _splitscreenDragPending;
      _splitscreenDragPending = null;
      const {contentH: t, secondaryH: n, avail: i} = calcSplitscreenHeights(e.clientY, e.rootRect, e.dividerH);
      splitscreenSecondaryCollapsed = false;
      setSplitscreenPanelHeights(t, n, i);
      syncSplitscreenSubtitles(getSplitscreenPreviewContainer(), getDividerCenterYFromHeights(t, n));
    }
    const onMove = e => {
      o = e.clientY;
      applySplitscreenDrag(o, i, r);
      armPreviewModalDragGuard(1200);
    };
    const onUp = () => {
      setDividerHover(false);
      finishSplitscreenDrag(o, i, r);
      armPreviewModalDragGuard(800);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onUp);
    };
    const onTouchMove = e => {
      e.preventDefault();
      if (e.touches[0]) onMove(e.touches[0]);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouchMove, {
      passive: false
    });
    document.addEventListener("touchend", onUp);
  };
  window.startSplitscreenDividerDrag = e => {
    if (splitscreenSecondaryCollapsed) {
      expandSplitscreenSecondary();
      return;
    }
    startDividerDrag(e);
  };
  e.addEventListener("mousedown", e => {
    e.preventDefault();
    if (splitscreenSecondaryCollapsed) {
      expandSplitscreenSecondary();
      return;
    }
    startDividerDrag(e.clientY);
  });
  e.addEventListener("touchstart", e => {
    e.preventDefault();
    if (splitscreenSecondaryCollapsed) {
      expandSplitscreenSecondary();
      return;
    }
    if (e.touches[0]) startDividerDrag(e.touches[0].clientY);
  }, {
    passive: false
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    initializeSplitscreenDivider();
  }, 500);
});

const dividerInitCheck = setInterval(() => {
  const e = _splitscreenQuery("splitscreenDivider");
  if (e && e.dataset.splitscreenInit !== "true") {
    initializeSplitscreenDivider();
  }
}, 100);

function closeGameplayClipSelector() {}

function confirmGameplayClip() {
  closeGameplayClipSelector();
  showNotification(`Selected: ${availableGameplayClips.find(e => e.id === selectedGameplayClip)?.title}`, "success");
}

function showNotification(e, t = "info") {
  const n = typeof CONFIG !== "undefined" && CONFIG.UI?.NOTIFICATION_DURATION_MS || 4e3;
  const i = 320;
  let r = document.getElementById("notificationContainer");
  if (!r) {
    r = document.createElement("div");
    r.id = "notificationContainer";
    r.setAttribute("aria-live", "polite");
    r.setAttribute("aria-atomic", "true");
    document.body.appendChild(r);
  }
  r.querySelectorAll(".notification").forEach(e => {
    if (e._hideTimer) clearTimeout(e._hideTimer);
    if (e._removeTimer) clearTimeout(e._removeTimer);
    e.remove();
  });
  const o = document.createElement("div");
  const s = [ "success", "error", "warning", "info" ].includes(t) ? t : "info";
  o.className = `notification notification-${s} ${s}`;
  o.setAttribute("role", "status");
  const a = s === "success" ? "check" : s === "error" ? "exclamation" : s === "warning" ? "exclamation-triangle" : "info";
  o.innerHTML = `\n        <div class="notification-content">\n            <i class="fas fa-${a}-circle notification-icon" aria-hidden="true"></i>\n            <span class="notification-message"></span>\n        </div>\n    `;
  o.querySelector(".notification-message").textContent = String(e || "");
  r.appendChild(o);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      o.classList.add("show");
    });
  });
  const dismiss = () => {
    if (o._leaving) return;
    o._leaving = true;
    o.classList.remove("show");
    o.classList.add("is-leaving");
    o._removeTimer = setTimeout(() => {
      o.remove();
    }, i);
  };
  o._hideTimer = setTimeout(dismiss, n);
  o.addEventListener("click", dismiss);
}

window.showNotification = showNotification;

window.__solisShowNotification = showNotification;

function handleGoogleCallback() {
  const e = new URLSearchParams(window.location.search);
  const t = e.get("error");
  if (t) {
    safeLog("OAuth error:", t);
    showNotification("Authentication failed: " + t, "error");
    setTimeout(() => window.location.href = "/login.html", 2e3);
    return;
  }
  const n = e.get("token");
  if (n) {
    try {
      sessionStorage.setItem("auth_token", n);
      safeLog("✅ Auth token saved for WebSocket connection");
    } catch (e) {
      safeLog("⚠ï¸ Failed to save auth token to sessionStorage:", e.message);
    }
  }
  verifyToken().then(() => {
    window.dispatchEvent(new CustomEvent("userConnected", {
      detail: {
        user: currentUser
      }
    }));
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.href = "/dashboard.html";
  }).catch(() => {
    safeLog("âŒ Authentication verification failed");
    showNotification("Authentication failed. Please try again.", "error");
    setTimeout(() => window.location.href = "/login.html", 2e3);
  });
}

function parseMarkdown(e) {
  const t = sanitizeHTML(e);
  return t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function init() {
  const e = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", e);
  currentTheme = e;
  const t = new URLSearchParams(window.location.search);
  const n = t.get("token");
  if (n) {
    handleGoogleCallback();
    return;
  }
  initAuth();
  setTimeout(() => {
    if (typeof updateProfileButton === "function") {
      updateProfileButton();
    }
  }, 100);
  chatHistory = [];
  setupEventListeners();
  updateTokenDisplay();
  const i = localStorage.getItem("sidebarExpanded");
  if (i === "true") {
    sidebar.classList.add("expanded");
  }
  const r = document.querySelector(".input-section");
  const o = r ? r.querySelector(".input-container") : null;
  if (o) {
    o.classList.add("first-prompt");
  }
  if (r) {
    r.classList.add("is-first-prompt");
  }
  initClipsStudio();
  const s = document.getElementById("plusFeaturesBtn");
  if (s) {
    s.addEventListener("click", function(e) {
      e.stopPropagation();
      const t = document.getElementById("featuresTabContainer");
      if (t) {
        t.classList.toggle("active");
        this.classList.toggle("active");
      }
    });
  }
  document.addEventListener("click", function(e) {
    const t = document.getElementById("featuresTabContainer");
    const n = document.getElementById("plusFeaturesBtn");
    if (t && !e.target.closest("#featuresTabContainer") && !e.target.closest("#plusFeaturesBtn")) {
      t.classList.remove("active");
      if (n) n.classList.remove("active");
    }
  });
  const a = document.createElement("link");
  a.href = "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap";
  a.rel = "stylesheet";
  document.head.appendChild(a);
}

const CONFIG = {
  PROCESSING: {
    MAX_TIME_MS: 6 * 60 * 60 * 1e3,
    POLL_INTERVAL_MS: 3e3,
    COMPLETED_REMOVE_DELAY_MS: 5e3,
    CLEANUP_INTERVAL_MS: 6e4
  },
  UI: {
    NOTIFICATION_DURATION_MS: 4e3,
    ANIMATION_DELAY_MS: 100,
    MODAL_TRANSITION_MS: 250,
    TYPING_INDICATOR_DELAY_MS: 1500
  },
  RATE_LIMITING: {
    YOUTUBE_PROCESS_MIN_MS: 2e3,
    POLLING_INTERVAL_MS: 5e3
  },
  SECURITY: {
    MAX_CONSOLE_LOGS: 0
  }
};

function sanitizeHTML(e) {
  if (typeof e !== "string") return "";
  const t = document.createElement("div");
  t.textContent = e;
  return t.innerHTML;
}

function isValidImageUrl(e) {
  if (!e || typeof e !== "string") return false;
  try {
    if (e.startsWith("javascript:") || e.startsWith("data:")) {
      safeLog("🔒 Blocked invalid URL scheme:", e.substring(0, 20));
      return false;
    }
    const t = new URL(e, window.location.href);
    return t.protocol === "https:" || t.protocol === "http:";
  } catch (t) {
    safeLog("Invalid URL format:", e);
    return false;
  }
}

function debounce(e, t) {
  let n;
  let i = 0;
  return function debounced(...r) {
    const o = Date.now();
    const s = o - i;
    clearTimeout(n);
    if (s >= t) {
      i = o;
      e.apply(this, r);
    } else {
      n = setTimeout(() => {
        i = Date.now();
        e.apply(this, r);
      }, t - s);
    }
  };
}

function safeLog() {}

async function fetchWithTimeout(e, t = {}, n = 1e4) {
  const i = new AbortController;
  const r = setTimeout(() => i.abort(), n);
  try {
    const n = await fetch(e, {
      ...t,
      signal: i.signal
    });
    clearTimeout(r);
    return n;
  } catch (e) {
    clearTimeout(r);
    if (e.name === "AbortError") {
      throw new Error(`Request timeout after ${n}ms`);
    }
    throw e;
  }
}

class ClipSlotSystem {
  constructor() {
    this.slots = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null
    };
    this.totalClips = 0;
  }
  addClip(e) {
    const t = Object.values(this.slots).filter(e => e !== null).length;
    if (t < 5) {
      const n = 5 - t;
      this.slots[n] = {
        ...e,
        slotNumber: n,
        addedAt: (new Date).toISOString()
      };
    } else {
      for (let e = 1; e < 5; e++) {
        this.slots[e] = this.slots[e + 1];
        if (this.slots[e]) {
          this.slots[e].slotNumber = e;
        }
      }
      this.slots[5] = {
        ...e,
        slotNumber: 5,
        addedAt: (new Date).toISOString()
      };
    }
    this.totalClips++;
    return this.slots;
  }
  getSlots() {
    return this.slots;
  }
  getSlot(e) {
    return this.slots[e];
  }
  clearSlot(e) {
    this.slots[e] = null;
    return this.slots;
  }
  getFilledSlots() {
    return Object.entries(this.slots).filter(([e, t]) => t !== null).map(([e, t]) => ({
      slotNum: parseInt(e),
      data: t
    }));
  }
}

class ClipsStudio {
  constructor() {
    this.currentTab = "templates";
    this.processingItems = [];
    this.libraryItems = [];
    this.librarySortMode = this._readLibrarySortMode();
    this.initialized = false;
    this.currentProjectId = null;
    this.selectedTemplate = null;
    this._awaitingUrlForTemplate = false;
    this.templates = {};
    this.isMonitoring = false;
    this.monitoringIntervals = new Map;
    this.currentEditingProject = null;
    this.slotSystem = new ClipSlotSystem;
    this.currentSlotState = null;
    this.useSlotSystem = true;
    this.subscriptionCache = null;
    this.libraryPollingInterval = null;
    this.lastYouTubeProcessTime = 0;
    this.libraryPreviewModalOpen = false;
    this._libraryPreviewObjectUrl = null;
    this._libraryPreviewFetchController = null;
    this._libraryPreviewLoadGen = 0;
    this._libraryEditingEnabled = false;
    this._librarySplitscreenCustomize = false;
    this._librarySplitscreenDirty = false;
    this._libraryOverlayDirty = false;
    this._libraryEditHintShown = false;
    this._webSocketHandlersSetup = false;
    this._webSocketRetryScheduled = false;
    this._generationStartInFlight = false;
  }
  async init() {
    if (this.initialized) return;
    try {
      this.bindEvents();
      this.loadTemplates();
      await this.loadLibraryItems();
      await this.loadProcessingItems();
      this.initialized = true;
      this.enforceUrlButtonRateLimitOnLoad();
      this.clearUrlIfProcessingDone();
      this.initializeWebSocket();
      if (this.processingItems.length > 0) {
        this.startLibraryPolling();
      } else {
        safeLog("ðŸ“ No processing items from previous session - polling idle");
      }
      const e = localStorage.getItem("clipsStudioCurrentTab");
      if (e && [ "templates", "create", "processing", "library", "editor" ].includes(e)) {
        this.switchTab(e);
      } else {
        this.switchTab("templates");
      }
      this.moveSlider();
      window.addEventListener("resize", () => this.moveSlider());
    } catch (e) {
      safeLog("Failed to initialize Clips Studio:", e);
    }
  }
  initializeWebSocket() {
    try {
      if (!window.SolisAIWebSocketClient) {
        safeLog("⚠ï¸ WebSocket client class not available");
        return;
      }
      if (!currentUser) {
        safeLog("⚠ï¸ User not authenticated - WebSocket skipped");
        return;
      }
      solisWSClient = new SolisAIWebSocketClient;
      solisWSClient.connect(currentUser.id);
      safeLog("✅ WebSocket client initialized with userId:", currentUser.id);
      setTimeout(() => {
        this.setupWebSocketHandlers();
      }, 500);
    } catch (e) {
      safeLog("âŒ Failed to initialize WebSocket:", e);
    }
  }
  updateRecentActivity() {
    const e = document.getElementById("activityList");
    if (!e) return;
    const t = e.querySelector(".activity-item");
    const n = this.libraryItems.sort((e, t) => t.timestamp - e.timestamp).slice(0, 3);
    n.forEach(t => {
      const n = this.getTimeAgo(t.timestamp);
      const i = `\n                <div class="activity-item">\n                    <div class="activity-icon">\n                        <i class="fas fa-video"></i>\n                    </div>\n                    <div class="activity-content">\n                        <div class="activity-title">Created a clip</div>\n                        <div class="activity-description">${t.name || "Untitled Clip"}</div>\n                    </div>\n                    <div class="activity-time">${n}</div>\n                </div>\n            `;
      e.insertAdjacentHTML("beforeend", i);
    });
  }
  getTimeAgo(e) {
    const t = new Date;
    const n = t - new Date(e);
    const i = Math.floor(n / 6e4);
    const r = Math.floor(n / 36e5);
    const o = Math.floor(n / 864e5);
    if (i < 1) return "0 minutes ago";
    if (i < 60) return `${i} minute${i > 1 ? "s" : ""} ago`;
    if (r < 24) return `${r} hour${r > 1 ? "s" : ""} ago`;
    if (o < 7) return `${o} day${o > 1 ? "s" : ""} ago`;
    return e.toLocaleDateString();
  }
  async loadTemplates() {
    try {
      const e = getAuthHeaders();
      const t = await fetch(`${API_BASE_URL}/clips/templates`, {
        method: "POST",
        headers: e,
        credentials: "include",
        body: JSON.stringify({})
      });
      if (t.ok) {
        const e = await t.json();
        const n = Array.isArray(e.ids) ? e.ids : Object.keys(e.templates || e || {});
        const i = this.getTemplateCatalog();
        this.templates = {};
        n.forEach(e => {
          if (i[e]) this.templates[e] = {
            ...i[e]
          };
        });
        safeLog("✅ Templates loaded:", Object.keys(this.templates));
      } else if (t.status === 401) {
        safeLog("Not authenticated for templates, using defaults");
        this.setDefaultTemplates();
      } else {
        safeLog("Failed to load templates, status:", t.status);
        this.setDefaultTemplates();
      }
    } catch (e) {
      safeLog("Failed to load templates:", e);
      this.setDefaultTemplates();
    }
  }
  getTemplateCatalog() {
    return {
      ranked_compilation: {
        name: "Ranking Compilation",
        description: "Top 5 moments ranked compilation",
        duration: "15-60s",
        type: "ranking",
        supportsSlotSystem: true
      },
      splitscreen: {
        name: "Split Screen",
        description: "Side-by-side video comparison",
        duration: "15-30s",
        type: "splitscreen",
        supportsSlotSystem: true
      }
    };
  }
  setDefaultTemplates() {
    this.templates = this.getTemplateCatalog();
  }
  bindEvents() {
    this.safeAddEventListener(".clips-tab", "click", e => {
      this.switchTab(e.currentTarget.dataset.tab);
    });
    this.safeAddEventListener(".template-card", "click", e => {
      const t = e.currentTarget;
      const n = t.dataset.template;
      if (n === "splitscreen") {
        e.preventDefault();
        e.stopPropagation();
        this.checkTemplateAccess(n);
      } else {
        this.openTemplatePreviewModal(n, t);
      }
    });
    this.safeAddEventListenerById("closeProFeatureModal", "click", () => {
      this.closeProFeatureModal();
    });
    this.safeAddEventListenerById("closeTemplatePreviewBtn", "click", () => {
      this.closeTemplatePreviewModal();
    });
    this._bindTemplateSheetDrag();
    this.safeAddEventListenerById("confirmUseTemplateBtn", "mousedown", e => {
      e.preventDefault();
    });
    this.safeAddEventListenerById("confirmUseTemplateBtn", "click", e => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.currentTarget;
      if (t?.disabled) return;
      this.confirmTemplateUse();
    });
    this.safeAddEventListenerById("confirmUseTemplateFab", "click", e => {
      e.preventDefault();
      e.stopPropagation();
      const t = document.getElementById("confirmUseTemplateBtn");
      if (!t || t.disabled) return;
      t.click();
    });
    this._bindUseTemplateFabSync();
    if (typeof window.bindUseTemplateFabIdleHint === "function") {
      window.bindUseTemplateFabIdleHint();
    }
    this.safeAddEventListenerById("processUrlBtn", "click", e => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.currentTarget || document.getElementById("processUrlBtn");
      if (t?.classList.contains("is-cancelling")) return;
      if (t?.classList.contains("is-cancel-locked")) return;
      if (t?.classList.contains("is-upgrade-cta")) {
        this.openUrlSubmitUpgrade();
        return;
      }
      if (t?.classList.contains("is-generating")) {
        this.cancelActiveGeneration();
        return;
      }
      this.processYouTubeUrl();
    });
    const e = document.getElementById("youtubeUrlInput");
    if (e) {
      e.addEventListener("keypress", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          const t = document.getElementById("processUrlBtn");
          if (t?.classList.contains("is-upgrade-cta")) {
            this.openUrlSubmitUpgrade();
            return;
          }
          this.processYouTubeUrl();
        }
      });
      let t;
      const _eagerWarm = e => {
        if (e && this.isValidMediaUrl(e)) {
          this._getCachedDurationCheck(e);
          this._getCachedLimitCheck();
        }
      };
      e.addEventListener("paste", () => {
        setTimeout(() => {
          _eagerWarm(e.value.trim());
          this.syncTemplateConfirmButton();
        }, 50);
      });
      e.addEventListener("input", () => {
        this.clearUrlSubmitUpgradeCta();
        clearTimeout(t);
        const n = e.value.trim();
        this.syncTemplateConfirmButton();
        if (n && this.isValidMediaUrl(n)) {
          t = setTimeout(() => _eagerWarm(n), 300);
        }
      });
    }
    this.safeAddEventListenerById("confirmTemplateBtn", "click", () => {
      this.confirmTemplateSelection();
    });
    this.safeAddEventListenerById("cancelTemplateBtn", "click", () => {
      this.cancelTemplateSelection();
    });
    this.safeAddEventListenerById("generateClipBtn", "click", () => {
      this.generateClipWithSlotSystem();
    });
    this.safeAddEventListenerById("refreshProcessingBtn", "click", () => {
      this.manualRefresh();
    });
    this.safeAddEventListenerById("libraryFilter", "change", e => {
      this.filterLibrary(e.target.value);
    });
    this._initLibrarySortControls();
    const goCreate = () => this.goToCreateUrlSubmit();
    document.querySelectorAll(".quick-action-create, #newClipBtn, #headerNewClipBtn").forEach(e => {
      if (e.dataset.createBound === "1") return;
      e.dataset.createBound = "1";
      e.addEventListener("click", e => {
        e.preventDefault();
        goCreate();
      });
      e.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goCreate();
        }
      });
    });
    this.safeAddEventListenerById("createFirstClipBtn", "click", () => {
      this.goToCreateUrlSubmit();
    });
    this.safeAddEventListenerById("renderFinalBtn", "click", () => {
      this.renderFinalVideo();
    });
    this.safeAddEventListenerById("viewAllActivityBtn", "click", () => {
      this.switchTab("library");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopAllMonitoring();
      }
    });
  }
  goToCreateUrlSubmit() {
    try {
      this._awaitingUrlForTemplate = false;
      const e = document.getElementById("portalContainer");
      const t = document.getElementById("clipsContainer");
      const n = document.getElementById("dashboardContainer");
      const i = document.getElementById("customEditorContainer");
      [ e, n, i ].forEach(e => {
        if (!e) return;
        e.style.display = "none";
        e.classList.remove("active");
      });
      if (t) {
        t.style.display = "block";
        t.classList.add("active");
      }
      document.querySelectorAll(".nav-item[data-target]").forEach(e => {
        const t = e.getAttribute("data-target") || "";
        e.classList.toggle("active", t === "clips" || t.toLowerCase() === "clips");
      });
      try {
        localStorage.setItem("currentNavigationTarget", "clips");
      } catch (e) {}
      const r = document.getElementById("clips-submenu");
      if (r) r.classList.add("open");
      const o = document.querySelector("#clips-toggle .chevron-icon");
      if (o) o.classList.add("rotated");
      if (!this.initialized) {
        try {
          this.init();
        } catch (e) {}
      }
      this.switchTab("create");
      const focusUrl = () => {
        const e = document.getElementById("urlInputStack") || document.querySelector("#createSection .url-input-container") || document.getElementById("processUrlBtn") || document.getElementById("createSection");
        if (e?.scrollIntoView) {
          e.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
        const t = document.getElementById("youtubeUrlInput");
        if (t) {
          try {
            t.focus({
              preventScroll: true
            });
          } catch (e) {
            try {
              t.focus();
            } catch (e) {}
          }
        }
        const n = document.getElementById("processUrlBtn");
        if (n) {
          n.classList.add("needs-url-pulse");
          clearTimeout(n._pulseT);
          n._pulseT = setTimeout(() => n.classList.remove("needs-url-pulse"), 1800);
        }
      };
      requestAnimationFrame(() => setTimeout(focusUrl, 60));
    } catch (e) {
      safeLog("goToCreateUrlSubmit failed:", e);
      try {
        this.switchTab("create");
      } catch (e) {}
    }
  }
  switchTab(e) {
    if (e !== "create" && typeof window.closePlanSelectorPopover === "function") {
      window.closePlanSelectorPopover(true);
    }
    if (this.currentTab === "processing" && e !== "processing") {
      this.stopAllMonitoring();
    }
    document.querySelectorAll(".clips-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === e);
    });
    document.querySelectorAll(".clips-sub-item").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === e);
    });
    document.querySelectorAll(".clips-section").forEach(t => {
      const n = t.id === `${e}Section`;
      t.classList.toggle("active", n);
      t.style.display = n ? "block" : "none";
    });
    this.currentTab = e;
    this.moveSlider();
    try {
      localStorage.setItem("clipsStudioCurrentTab", e);
      localStorage.setItem("clipsActiveTab", e);
    } catch (e) {}
    const t = document.querySelector(`.clips-sub-item[data-tab="${e}"]`);
    const n = document.getElementById("clipsSubPane");
    const i = document.querySelector(".clips-sub-pill");
    if (typeof window.updateMobileClipsPillIndicator === "function" && window.innerWidth <= 768) {
      window.updateMobileClipsPillIndicator(e);
    } else if (t && n && i) {
      const e = window.getComputedStyle(i);
      if (e.display !== "contents") {
        const e = i.getBoundingClientRect();
        const r = t.getBoundingClientRect();
        n.style.left = `${r.left - e.left}px`;
        n.style.transform = "";
      }
    }
    if (e === "processing") {
      document.getElementById("libraryLoadMoreFab")?.remove();
      this.updateProcessingView();
      this.startSmartMonitoring();
    } else if (e === "library") {
      const e = 5 * 60 * 1e3;
      if ((!this.libraryItems || this.libraryItems.length === 0) && typeof this._hydrateLibraryFromSessionCache === "function") {
        this._hydrateLibraryFromSessionCache();
      }
      this.updateLibraryView();
      const t = this._libraryLastLoaded && Date.now() - this._libraryLastLoaded < e;
      const n = !this.libraryItems || this.libraryItems.length === 0;
      if ((!t || n) && typeof this.loadLibraryItems === "function") {
        this.loadLibraryItems({
          soft: !n
        }).catch(() => {});
      }
    } else if (e === "templates") {
      document.getElementById("libraryLoadMoreFab")?.remove();
    } else if (e === "create") {
      document.getElementById("libraryLoadMoreFab")?.remove();
    } else if (e === "editor") {
      document.getElementById("libraryLoadMoreFab")?.remove();
      this.loadEditorData();
    } else {
      document.getElementById("libraryLoadMoreFab")?.remove();
    }
  }
  moveSlider() {
    const e = document.querySelector(".clips-tab-slider");
    const t = document.querySelector(".clips-tab.active");
    if (e && t) {
      e.style.left = t.offsetLeft + "px";
      e.style.width = t.offsetWidth + "px";
    }
  }
  selectTemplate(e, t) {
    document.querySelectorAll(".template-card").forEach(e => {
      e.classList.remove("selected");
    });
    t.classList.add("selected");
    this.selectedTemplate = e;
    this.showConfirmationButtons(true);
    const n = this.templates[e];
    if (n && n.supportsSlotSystem) {
      this.showSlotSystemInfo();
    }
  }
  async checkTemplateAccess(e) {
    try {
      await window._subCache.get();
    } catch (e) {}
    const t = document.querySelector(`[data-template="${e}"]`);
    this.openTemplatePreviewModal(e, t);
  }
  showProFeatureModal(e, t) {
    const n = document.querySelector(".pro-modal-overlay");
    if (n) n.remove();
    if (!document.getElementById("pro-modal-styles")) {
      const e = document.createElement("style");
      e.id = "pro-modal-styles";
      e.textContent = `\n@keyframes fadeInOverlay {\n    from { opacity: 0; }\n    to { opacity: 1; }\n}\n\n@keyframes slideUp {\n    from { opacity: 0; transform: translateY(16px) scale(0.98); }\n    to { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@keyframes fadeUp {\n    from { opacity: 0; transform: translateY(10px); }\n    to { opacity: 1; transform: translateY(0); }\n}\n\n@keyframes popIn {\n    0%   { transform: scale(0.7); opacity: 0; }\n    70%  { transform: scale(1.05); opacity: 1; }\n    100% { transform: scale(1); opacity: 1; }\n}\n\n.pro-modal-overlay {\n    position: fixed !important;\n    inset: 0 !important;\n    background: rgba(0, 0, 0, 0.4) !important;\n    display: flex !important;\n    align-items: center !important;\n    justify-content: center !important;\n    z-index: 9999 !important;\n    padding: 20px !important;\n    opacity: 0;\n    animation: fadeInOverlay 0.25s ease forwards;\n}\n\n.pro-modal {\n    background: #fff;\n    border-radius: 24px;\n    width: 100%;\n    max-width: 800px;\n    display: flex;\n    box-shadow:\n        0 24px 64px rgba(0, 0, 0, 0.1),\n        0 0 0 1px rgba(0, 0, 0, 0.06);\n    opacity: 0;\n    transform: translateY(16px) scale(0.98);\n    animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.08s forwards;\n    overflow: hidden;\n    min-height: 420px;\n}\n\n.pro-panel-left {\n    width: 52%;\n    background: #fdf8f6;\n    padding: 40px 36px;\n    display: flex;\n    flex-direction: column;\n    justify-content: space-between;\n    position: relative;\n    border-right: 1px solid #efefef;\n    overflow: hidden;\n}\n\n.pro-panel-left::before {\n    content: '';\n    position: absolute;\n    bottom: -80px;\n    left: -80px;\n    width: 220px;\n    height: 220px;\n    border-radius: 50%;\n    background: radial-gradient(circle, rgba(255, 107, 53, 0.12), transparent 70%);\n    pointer-events: none;\n}\n\n.pro-panel-left::after {\n    content: '';\n    position: absolute;\n    top: -60px;\n    right: -60px;\n    width: 180px;\n    height: 180px;\n    border-radius: 50%;\n    background: radial-gradient(circle, rgba(255, 107, 53, 0.08), transparent 70%);\n    pointer-events: none;\n}\n\n.pro-left-top {\n    position: relative;\n    z-index: 1;\n}\n\n.pro-lock-wrap {\n    width: 52px;\n    height: 52px;\n    background: #fff;\n    border-radius: 14px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    margin-bottom: 20px;\n    border: 1px solid rgba(0, 0, 0, 0.07);\n    box-shadow: 0 2px 10px rgba(255, 107, 53, 0.1);\n    opacity: 0;\n    animation: popIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;\n}\n\n.pro-title {\n    font-family: 'Plus Jakarta Sans', sans-serif;\n    font-size: 26px;\n    font-weight: 800;\n    color: #111;\n    line-height: 1.2;\n    letter-spacing: -0.5px;\n    margin-bottom: 8px;\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.42s forwards;\n}\n\n.pro-subtitle {\n    font-size: 13px;\n    color: #666;\n    line-height: 1.6;\n    max-width: 260px;\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.5s forwards;\n}\n\n.pro-template-preview {\n    position: relative;\n    z-index: 1;\n    background: #fff;\n    border: 1px solid #efefef;\n    border-radius: 14px;\n    overflow: hidden;\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.58s forwards;\n}\n\n.pro-tpb-preview {\n    background: #f5f4f2;\n    height: 80px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    position: relative;\n}\n\n.pro-tpb-pro {\n    position: absolute;\n    top: 8px;\n    right: 8px;\n    background: #ff6b35;\n    color: #fff;\n    font-size: 9px;\n    font-weight: 800;\n    letter-spacing: 0.6px;\n    padding: 3px 8px;\n    border-radius: 6px;\n    text-transform: uppercase;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n}\n\n.pro-tpb-info {\n    padding: 10px 12px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n}\n\n.pro-tpb-info strong {\n    font-size: 12px;\n    font-weight: 700;\n    color: #111;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n}\n\n.pro-tpb-info span {\n    font-size: 11px;\n    color: #bbb;\n}\n\n.pro-locked-overlay {\n    position: absolute;\n    inset: 0;\n    background: rgba(253, 248, 246, 0.6);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n}\n\n.pro-panel-right {\n    width: 48%;\n    padding: 40px 32px;\n    display: flex;\n    flex-direction: column;\n    justify-content: space-between;\n    position: relative;\n    background: #fff;\n}\n\n.pro-close-btn {\n    position: absolute;\n    top: 16px;\n    right: 16px;\n    width: 30px;\n    height: 30px;\n    border-radius: 8px;\n    border: 1px solid #efefef;\n    background: transparent;\n    cursor: pointer;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    color: #bbb;\n    transition: background 0.15s ease, color 0.15s ease;\n    padding: 0;\n}\n\n.pro-close-btn:hover {\n    background: #f5f5f5;\n    color: #111;\n}\n\n.pro-plans-label {\n    font-size: 10px;\n    font-weight: 700;\n    letter-spacing: 0.9px;\n    text-transform: uppercase;\n    color: #bbb;\n    margin-bottom: 10px;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.55s forwards;\n}\n\n.pro-plan-options {\n    display: flex;\n    flex-direction: column;\n    gap: 7px;\n    flex: 1;\n    margin-bottom: 20px;\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.63s forwards;\n}\n\n.pro-plan-card {\n    border: 1.5px solid #efefef;\n    border-radius: 12px;\n    padding: 12px 14px;\n    display: flex;\n    align-items: center;\n    gap: 11px;\n    cursor: pointer;\n    transition: border-color 0.18s ease, background 0.18s ease;\n    background: #fff;\n    position: relative;\n}\n\n.pro-plan-card:hover {\n    border-color: rgba(255, 107, 53, 0.3);\n    background: #fff9f7;\n}\n\n.pro-plan-card.highlighted {\n    border-color: #ff6b35;\n    background: #fff9f7;\n}\n\n.pro-plan-card-icon {\n    width: 34px;\n    height: 34px;\n    border-radius: 9px;\n    background: #fff3ef;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-shrink: 0;\n    border: 1px solid rgba(255, 107, 53, 0.15);\n    transition: background 0.18s ease;\n}\n\n.pro-plan-card.highlighted .pro-plan-card-icon {\n    background: #ff6b35;\n    border-color: #ff6b35;\n}\n\n.pro-plan-card-body {\n    flex: 1;\n}\n\n.pro-plan-card-body strong {\n    display: block;\n    font-size: 13px;\n    font-weight: 700;\n    color: #111;\n    margin-bottom: 1px;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n}\n\n.pro-plan-card-body span {\n    font-size: 11px;\n    color: #aaa;\n}\n\n.pro-plan-card-price {\n    font-size: 13px;\n    font-weight: 700;\n    color: #666;\n    white-space: nowrap;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n}\n\n.pro-plan-card.highlighted .pro-plan-card-price {\n    color: #ff6b35;\n}\n\n.pro-popular-tag {\n    position: absolute;\n    top: -1px;\n    right: 12px;\n    background: #ff6b35;\n    color: #fff;\n    font-size: 9px;\n    font-weight: 700;\n    letter-spacing: 0.4px;\n    text-transform: uppercase;\n    padding: 3px 8px;\n    border-radius: 0 0 6px 6px;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n}\n\n.pro-right-footer {\n    opacity: 0;\n    animation: fadeUp 0.3s ease 0.72s forwards;\n}\n\n.pro-cta-btn {\n    width: 100%;\n    padding: 13px;\n    background: linear-gradient(135deg, #ff7a50, #ff6b35);\n    color: #fff;\n    border: none;\n    border-radius: 12px;\n    font-family: 'Plus Jakarta Sans', sans-serif;\n    font-size: 14px;\n    font-weight: 700;\n    cursor: pointer;\n    transition: box-shadow 0.2s ease, background 0.2s ease;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    margin-bottom: 10px;\n    box-shadow: 0 3px 12px rgba(255, 107, 53, 0.35);\n}\n\n.pro-cta-btn:hover {\n    background: linear-gradient(135deg, #ff6b35, #ff5722);\n    box-shadow: 0 5px 18px rgba(255, 107, 53, 0.45);\n}\n\n.pro-cta-btn:active {\n    transform: scale(0.98);\n}\n\n.pro-fine-print {\n    text-align: center;\n    font-size: 11px;\n    color: #bbb;\n}\n\n.pro-fine-print a {\n    color: #bbb;\n    text-decoration: underline;\n    text-underline-offset: 2px;\n    cursor: pointer;\n    transition: color 0.15s ease;\n}\n\n.pro-fine-print a:hover {\n    color: #666;\n}\n\n@media (max-width: 768px) {\n    .pro-modal {\n        flex-direction: column;\n        border-radius: 20px;\n    }\n\n    .pro-panel-left {\n        width: 100%;\n        border-right: none;\n        border-bottom: 1px solid #efefef;\n        padding: 32px 28px;\n    }\n\n    .pro-panel-right {\n        width: 100%;\n        padding: 32px 28px;\n    }\n}\n            `;
      document.head.appendChild(e);
    }
    const i = document.createElement("div");
    i.className = "pro-modal-overlay";
    const r = {
      splitscreen: {
        title: "This is a Pro template",
        subtitle: "Split Screen is only available on paid plans. Upgrade to unlock it",
        templateName: "Split Screen",
        templateDesc: "Video + Gameplay stacked"
      }
    };
    const o = r[e] || r["splitscreen"];
    i.innerHTML = `\n            <div class="pro-modal">\n                <div class="pro-panel-left">\n                    <div class="pro-left-top">\n                        <div class="pro-lock-wrap">\n                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\n                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>\n                            </svg>\n                        </div>\n                        <h1 class="pro-title">${o.title}</h1>\n                        <p class="pro-subtitle">${o.subtitle}</p>\n                    </div>\n\n                    <div class="pro-template-preview">\n                        <div class="pro-tpb-preview">\n                            <div class="pro-tpb-pro">PRO</div>\n                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4BE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n                                <rect x="3" y="3" width="7" height="18" rx="1"/>\n                                <rect x="14" y="3" width="7" height="18" rx="1"/>\n                            </svg>\n                            <div class="pro-locked-overlay">\n                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>\n                                </svg>\n                            </div>\n                        </div>\n                        <div class="pro-tpb-info">\n                            <div>\n                                <strong>${o.templateName}</strong>\n                                <span style="display:block;margin-top:2px;font-size:11px;color:#AAA">${o.templateDesc}</span>\n                            </div>\n                            <span style="font-size:11px;color:#FF6A3D;font-weight:600;background:#FFF3EF;padding:3px 9px;border-radius:100px;border:1px solid #FFD0C2">PRO</span>\n                        </div>\n                    </div>\n                </div>\n\n                <div class="pro-panel-right">\n                    <button class="pro-close-btn">\n                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\n                            <line x1="18" y1="6" x2="6" y2="18"/>\n                            <line x1="6" y1="6" x2="18" y2="18"/>\n                        </svg>\n                    </button>\n\n                    <div>\n                        <div class="pro-plans-label">Unlock with a plan</div>\n                        <div class="pro-plan-options">\n                            <div class="pro-plan-card">\n                                <div class="pro-plan-card-icon">\n                                   <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">\n                                    <defs>\n                                        <linearGradient id="basicGrad" x1="0%" y1="0%" x2="100%" y2="100%">\n                                            <stop offset="0%" style="stop-color:#f1f5f9;stop-opacity:1"></stop>\n                                            <stop offset="50%" style="stop-color:#cbd5e1;stop-opacity:1"></stop>\n                                            <stop offset="100%" style="stop-color:#94a3b8;stop-opacity:1"></stop>\n                                        </linearGradient>\n                                    </defs>\n                                    <circle cx="50" cy="50" r="16" fill="url(#basicGrad)"></circle>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#basicGrad)" stroke-width="10" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#basicGrad)" stroke-width="10" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>\n                                </svg>\n                                </div>\n                                <div class="pro-plan-card-body">\n                                    <strong>Basic</strong>\n                                    <span>PRO templates · No watermark</span>\n                                </div>\n                                <div class="pro-plan-card-price">$9.99/mo</div>\n                            </div>\n\n                            <div class="pro-plan-card highlighted">\n                                <div class="pro-popular-tag">Popular</div>\n                                <div class="pro-plan-card-icon">\n                                   <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">\n                                    <defs>\n                                        <linearGradient id="primeGrad" x1="0%" y1="0%" x2="100%" y2="100%">\n                                            <stop offset="0%" style="stop-color:#fff176;stop-opacity:1"></stop>\n                                            <stop offset="50%" style="stop-color:#ffd600;stop-opacity:1"></stop>\n                                            <stop offset="100%" style="stop-color:#ff9100;stop-opacity:1"></stop>\n                                        </linearGradient>\n                                    </defs>\n                                    <circle cx="50" cy="50" r="16" fill="url(#primeGrad)"></circle>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#primeGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#primeGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>\n                                </svg>\n                                </div>\n                                <div class="pro-plan-card-body">\n                                    <strong>Prime</strong>\n                                    <span>PRO templates + Overpurpose, coming very soon</span>\n                                </div>\n                                <div class="pro-plan-card-price">$23.99/mo</div>\n                            </div>\n\n                            <div class="pro-plan-card">\n                                <div class="pro-plan-card-icon">\n                                <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">\n                                    <defs>\n                                        <linearGradient id="eliteGrad" x1="0%" y1="0%" x2="100%" y2="100%">\n                                            <stop offset="0%" style="stop-color:#ff6b3d;stop-opacity:1" />\n                                            <stop offset="50%" style="stop-color:#ff3d00;stop-opacity:1" />\n                                            <stop offset="100%" style="stop-color:#c70000;stop-opacity:1" />\n                                        </linearGradient>\n                                    </defs>\n                                    <circle cx="50" cy="50" r="16" fill="url(#eliteGrad)"></circle>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#eliteGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>\n                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#eliteGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>\n                                </svg>\n                                </div>\n                                <div class="pro-plan-card-body">\n                                    <strong>Elite</strong>\n                                    <span>Everything + Priority queue</span>\n                                </div>\n                                <div class="pro-plan-card-price">$39.99/mo</div>\n                            </div>\n                        </div>\n                    </div>\n\n                    <div class="pro-right-footer">\n                        <button class="pro-cta-btn">\n                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>\n                            </svg>\n                            Unlock Split Screen\n                        </button>\n                        <p class="pro-fine-print"><a>Maybe later</a></p>\n                    </div>\n                </div>\n            </div>\n        `;
    i.querySelector(".pro-close-btn").addEventListener("click", () => {
      i.style.opacity = "0";
      i.style.transition = "opacity 0.25s ease";
      setTimeout(() => i.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
    });
    i.querySelectorAll(".pro-plan-card").forEach(e => {
      e.addEventListener("click", () => {
        i.querySelectorAll(".pro-plan-card").forEach(e => e.classList.remove("highlighted"));
        e.classList.add("highlighted");
      });
    });
    i.querySelector(".pro-cta-btn").addEventListener("click", () => {});
    i.querySelector(".pro-fine-print a").addEventListener("click", () => {
      i.style.opacity = "0";
      i.style.transition = "opacity 0.25s ease";
      setTimeout(() => i.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
    });
    i.addEventListener("click", e => {
      if (e.target === i) {
        i.style.opacity = "0";
        i.style.transition = "opacity 0.25s ease";
        setTimeout(() => i.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
      }
    });
    document.body.appendChild(i);
    safeLog("✅ Pro feature modal shown for:", e);
  }
  closeProFeatureModal() {
    const e = document.getElementById("proFeatureModal");
    if (e) {
      e.style.display = "none";
    }
  }
  openTemplatePreviewModal(e, t) {
    const n = document.getElementById("templatePreviewModal");
    const i = document.getElementById("templatePreviewLoading");
    if (!n) {
      return;
    }
    safeLog(`📋 Opening template preview for: ${e}`);
    this.toggleLibraryPreviewLayout(false);
    this._libraryRankingEditable = false;
    this._libraryRankingDirty = false;
    this._librarySplitscreenDirty = false;
    this._libraryOverlayDirty = false;
    this._librarySplitscreenCustomize = false;
    this._libraryEditingEnabled = false;
    const r = document.getElementById("confirmUseTemplateBtn");
    if (r) {
      r.textContent = "Use Template";
      r.classList.remove("library-download-mode");
      r.disabled = false;
      r.style.pointerEvents = "";
      r.style.opacity = "";
      delete r.dataset.applying;
    }
    if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
    if (typeof window.syncPreviewModifiersForTemplate === "function") {
      window.syncPreviewModifiersForTemplate(e);
    }
    if (t) {
      const e = t.querySelector(".status-pill");
      if (e) {
        e.style.opacity = "0";
        e.style.transition = "opacity 0.3s ease";
        setTimeout(() => {
          e.style.display = "none";
        }, 300);
        safeLog("✅ Status-pill hidden when opening template preview");
      }
    }
    const o = document.getElementById("templateVideoPreview");
    if (o) {
      o.querySelectorAll("video").forEach(e => {
        try {
          e.pause();
          e.removeAttribute("src");
          e.load();
        } catch (e) {}
      });
      try {
        if (typeof window.clearPreviewCaptionOverlays === "function") {
          window.clearPreviewCaptionOverlays({
            hooks: true,
            overlays: true,
            container: o
          });
        }
      } catch (e) {}
      o.innerHTML = "";
      o.classList.remove("has-video", "library-splitscreen-preview", "library-ranking-edit");
    }
    if (i) {
      i.classList.remove("hidden");
      i.style.display = "flex";
      i.style.visibility = "visible";
      i.style.opacity = "1";
      i.style.pointerEvents = "auto";
    }
    const s = document.getElementById("previewTemplateName");
    const a = document.getElementById("previewTemplateDescription");
    const l = document.getElementById("previewVideoDuration");
    const c = document.getElementById("previewVideoFormat");
    safeLog("Elements found:", {
      nameEl: !!s,
      descEl: !!a,
      durationEl: !!l,
      formatEl: !!c
    });
    if (s) {
      const t = e.replace(/_/g, " ").replace(/\b\w/g, e => e.toUpperCase());
      s.textContent = t || "Template";
      safeLog("✅ Template name set to:", t);
    } else {
      safeLog("⚠ï¸ nameEl not found");
    }
    const d = document.getElementById("youtubeUrlInput")?.value.trim();
    if (d) {
      if (a) a.textContent = "Loading video info...";
      if (l) l.textContent = "~60s";
      if (c) c.textContent = "TikTok / Shorts";
    } else {
      if (a) a.textContent = "Paste a YouTube URL to see video details";
      if (l) l.textContent = "~60s";
      if (c) c.textContent = "TikTok / Shorts";
    }
    n.classList.add("active");
    n.style.display = "flex";
    n.style.visibility = "visible";
    n.style.opacity = "1";
    document.body.classList.add("modal-open");
    safeLog("✅ Modal displayed");
    this.syncTemplateConfirmButton();
    if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
    if (typeof window.bindUseTemplateFabIdleHint === "function") window.bindUseTemplateFabIdleHint();
    if (typeof window._bumpUseTemplateFabIdle === "function") window._bumpUseTemplateFabIdle();
    const p = document.querySelector(".template-preview-sidebar");
    if (p) p.classList.remove("expanded");
    const updateTemplatePreviewButtons = async () => {
      const t = document.getElementById("confirmUseTemplateBtn");
      const n = document.getElementById("templatePreviewProFooter");
      try {
        const i = await window._subCache.get();
        const r = i?.plan || "free";
        const o = [ "splitscreen" ].includes(e);
        const s = r === "free";
        if (o && s) {
          if (t) t.style.display = "none";
          if (n) n.style.display = "flex";
        } else {
          if (t) t.style.display = "block";
          if (n) n.style.display = "none";
        }
      } catch (e) {
        safeLog("⚠ï¸ Could not check plan:", e);
        if (t) t.style.display = "block";
        if (n) n.style.display = "none";
      }
      this.syncTemplateConfirmButton();
    };
    updateTemplatePreviewButtons();
    setTimeout(() => {
      safeLog("📋 Setting up watermark toggle...");
      this.setupWatermarkToggle();
    }, 100);
    const u = document.getElementById("navWrapper");
    const m = document.querySelector(".profile-notif-wrapper");
    if (u) {
      u.classList.add("disabled");
    }
    if (m) {
      m.classList.add("disabled");
    }
    const f = document.querySelector(".template-preview-sheet");
    if (f) {
      f.classList.remove("expanded");
    }
    requestAnimationFrame(() => {
      const hideLoadingSpinner = () => {
        if (!i) return;
        i.classList.add("hidden");
        i.style.visibility = "hidden";
        i.style.pointerEvents = "none";
        setTimeout(() => {
          if (i.classList.contains("hidden")) {
            i.style.display = "none";
          }
        }, 180);
      };
      const n = this.templates[e] || {};
      const r = document.getElementById("watermarkToggle");
      const o = r ? r.checked : false;
      this.currentTemplateForPreview = {
        id: e,
        card: t,
        data: n,
        addWatermark: o,
        videoQuality: "auto",
        videoUrl: d,
        isLibraryPreview: false
      };
      const s = document.getElementById("aiPromptInput");
      if (s) {
        s.value = "";
        document.getElementById("charCountDisplay").textContent = "0";
      }
      const a = document.getElementById("aiResponseArea");
      if (a) {
        a.style.display = "none";
      }
      Promise.resolve(this.loadVideoPreviewWithTemplate()).finally(() => {
        hideLoadingSpinner();
        if (window.SolisMemory && typeof window.SolisMemory.onTemplatePreviewOpen === "function") {
          window.SolisMemory.onTemplatePreviewOpen(e);
        }
      });
      if (d) {
        const e = document.getElementById("previewTemplateDescription");
        const t = document.getElementById("previewVideoDuration");
        const n = document.getElementById("previewVideoFormat");
        this.fetchVideoMetadata(d, t, n, e);
      }
    });
  }
  buildSolisWatermarkHTML() {
    return `\n            <div class="solis-watermark" aria-hidden="true">\n                <div class="solis-watermark-icon">\n                    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">\n                        <circle cx="50" cy="50" r="9" fill="currentColor"></circle>\n                        <ellipse rx="44" ry="18" cx="50" cy="50" stroke-width="6" transform="rotate(45 50 50)"></ellipse>\n                        <ellipse rx="44" ry="18" cx="50" cy="50" stroke-width="6" transform="rotate(-45 50 50)"></ellipse>\n                    </svg>\n                </div>\n                <div class="solis-watermark-label">SOLIS <span class="ai">AI</span></div>\n            </div>\n        `;
  }
  shouldShowSolisWatermark() {
    const e = document.getElementById("watermarkToggle");
    if (!e) return true;
    return Boolean(e.checked);
  }
  ensureSolisWatermark(e) {
    if (!e) return null;
    let t = e.querySelector(".solis-watermark");
    if (!t) {
      e.insertAdjacentHTML("beforeend", this.buildSolisWatermarkHTML());
      t = e.querySelector(".solis-watermark");
    } else {
      const e = t.querySelector(".solis-watermark-label");
      if (e && !/SOLIS/i.test(e.textContent || "")) {
        e.innerHTML = 'SOLIS <span class="ai">AI</span>';
      }
    }
    if (getComputedStyle(e).position === "static") {
      e.style.position = "relative";
    }
    this.updateWatermarkDisplay();
    return t;
  }
  updateWatermarkDisplay() {
    const e = document.getElementById("watermarkToggle");
    if (!e) {
      safeLog("⚠ï¸ Watermark toggle not found");
      return;
    }
    const t = document.querySelectorAll(".solis-watermark");
    if (t.length === 0) {
      safeLog("⚠ï¸ No watermark elements found on page");
      return;
    }
    const n = this.shouldShowSolisWatermark();
    t.forEach(e => {
      e.classList.toggle("is-hidden", !n);
      e.style.display = n ? "flex" : "none";
    });
    safeLog(`✅ Updated ${t.length} watermark(s): ${n ? "VISIBLE" : "HIDDEN"} (toggle: ${n ? "ON" : "OFF"})`);
  }
  setupWatermarkToggle() {
    const e = document.getElementById("watermarkToggleLabel");
    const t = document.getElementById("watermarkUpgradeBtn");
    const n = document.getElementById("watermarkNotice");
    const i = document.getElementById("watermarkToggle");
    if (!i) {
      safeLog("⚠ï¸ watermarkToggle element not found");
      return;
    }
    if (!window.currentUser) {
      safeLog("â³ currentUser not loaded yet, retrying watermark setup in 500ms...");
      setTimeout(() => this.setupWatermarkToggle(), 500);
      return;
    }
    this.resolveWatermarkPolicy().then(e => {
      this.applyWatermarkControls(e);
    }).catch(() => {
      const e = window.currentUser.plan && window.currentUser.plan !== "free";
      this.applyWatermarkControls({
        showUpgrade: !e,
        isPremium: !!e,
        usedLifetime: e ? 0 : 1
      });
    });
  }
  async resolveWatermarkPolicy(e = false) {
    const t = String(window.currentUser?.plan || "free").toLowerCase();
    const n = t === "basic" || t === "prime" || t === "elite";
    if (n) {
      return {
        showUpgrade: false,
        isPremium: true,
        usedLifetime: 0
      };
    }
    try {
      if (e) this._watermarkCheckCache = null;
      if (!this._watermarkCheckCache) {
        const e = await fetch(`${window.API_BASE_URL}/auth/watermark-check`, {
          headers: getAuthHeaders(),
          credentials: "include"
        });
        if (e.ok) {
          this._watermarkCheckCache = await e.json();
        }
      }
      const t = this._watermarkCheckCache || {};
      const n = Number(t.used_lifetime || 0);
      const i = t.show_upgrade != null ? !!t.show_upgrade : n >= 1;
      return {
        showUpgrade: i,
        isPremium: false,
        usedLifetime: n,
        data: t
      };
    } catch (e) {
      safeLog("🚨 watermark policy resolve failed:", e);
      return {
        showUpgrade: true,
        isPremium: false,
        usedLifetime: 1
      };
    }
  }
  applyWatermarkControls(e) {
    const t = document.getElementById("watermarkToggleLabel");
    const n = document.getElementById("watermarkUpgradeBtn");
    const i = document.getElementById("watermarkNotice");
    const r = document.getElementById("watermarkToggle");
    if (!r) return;
    const o = !!e?.isPremium;
    const s = Number(e?.usedLifetime ?? e?.data?.used_lifetime ?? 0);
    const a = !o && s === 0;
    const l = !o && s >= 1;
    safeLog(`ðŸ” Watermark UI — premium=${o} usedLifetime=${s} ` + `firstFree=${a} returningFree=${l}`);
    if (o) {
      const e = localStorage.getItem("watermarkEnabled");
      r.checked = e === "true";
      r.disabled = false;
    } else if (a) {
      r.checked = false;
      r.disabled = true;
      try {
        localStorage.setItem("watermarkEnabled", "false");
      } catch (e) {}
    } else {
      r.checked = true;
      r.disabled = true;
      try {
        localStorage.setItem("watermarkEnabled", "true");
      } catch (e) {}
    }
    r.style.opacity = "";
    r.style.cursor = "";
    const c = o;
    const d = l;
    if (t) {
      t.style.visibility = c ? "visible" : "hidden";
      t.style.display = c ? "inline-flex" : "none";
      t.setAttribute("data-premium-only", !c);
      t.classList.toggle("is-on", Boolean(r.checked));
      t.setAttribute("aria-checked", r.checked ? "true" : "false");
    }
    if (n) {
      n.style.visibility = d ? "visible" : "hidden";
      n.style.display = d ? "flex" : "none";
    }
    if (i) {
      i.style.display = d ? "block" : "none";
    }
    if (this._watermarkChangeHandler) {
      r.removeEventListener("change", this._watermarkChangeHandler);
      this._watermarkChangeHandler = null;
    }
    if (o) {
      this._watermarkChangeHandler = () => {
        const e = r.checked;
        localStorage.setItem("watermarkEnabled", e ? "true" : "false");
        t?.classList.toggle("is-on", e);
        t?.setAttribute("aria-checked", e ? "true" : "false");
        this.updateWatermarkDisplay();
      };
      r.addEventListener("change", this._watermarkChangeHandler);
    }
    this.updateWatermarkDisplay();
  }
  loadVideoPreviewWithTemplate() {
    const e = document.getElementById("templateVideoPreview");
    if (!e) return;
    const t = this.currentTemplateForPreview?.id;
    safeLog(`📺 loadVideoPreviewWithTemplate - Loading templateId: ${t}`);
    if (!t) {
      safeLog("⚠ï¸ No template ID available");
      e.innerHTML = `\n                <div class="preview-video-placeholder">\n                    <i class="fas fa-exclamation-circle"></i>\n                    <p>No template selected</p>\n                </div>\n            `;
      return;
    }
    this.fetchTemplatePreview(e, t);
  }
  async fetchTemplatePreview(e, t) {
    try {
      safeLog(`ðŸ” fetchTemplatePreview - templateId: ${t}`);
      const n = this.templates[t];
      if (!n) {
        safeLog(`⚠ï¸ Template "${t}" not found in this.templates`, Object.keys(this.templates));
        const n = {
          id: t,
          name: t?.replace(/_/g, " ").replace(/\b\w/g, e => e.toUpperCase()) || "Template",
          description: "Video template preview",
          type: t || "default"
        };
        return await this.renderTemplatePreview(e, n);
      }
      safeLog(`✅ Found template in this.templates:`, {
        id: t,
        type: n.type
      });
      n.id = t;
      return await this.renderTemplatePreview(e, n);
    } catch (t) {
      safeLog("Error in fetchTemplatePreview:", t);
      e.innerHTML = `\n                <div class="preview-video-placeholder">\n                    <i class="fas fa-exclamation-circle"></i>\n                    <p>Error loading preview</p>\n                </div>\n            `;
    }
  }
  async renderTemplatePreview(e, t) {
    if (t?.id && (t.id.includes("..") || t.id.includes("/") || t.id.includes("\\") || t.id.includes(":"))) {
      console.error("SECURITY: Attempted path traversal in template.id:", t.id);
      showNotification("Invalid template", "error");
      return;
    }
    const n = t?.id ? String(t.id).replace(/[<>"']/g, "") : "unknown";
    safeLog("🎨 renderTemplatePreview called with container:", !!e, "template:", n);
    const i = this.generateTemplatePreviewHTML(t);
    let r = "";
    const paintPreview = () => {
      window.RankingTextPill?.resetSession?.();
      window._deselectSubtitleEditor?.();
      try {
        if (typeof window.clearPreviewCaptionOverlays === "function") {
          window.clearPreviewCaptionOverlays({
            hooks: true,
            overlays: true,
            container: e
          });
        }
      } catch (e) {}
      const t = `\n            <div class="solis-preview-frame" style="position: relative; width: 100%; height: 100%; background: #3a3a3a;">\n                ${i}\n                ${this.buildSolisWatermarkHTML()}\n                ${r}\n            </div>\n        `;
      e.innerHTML = t;
      this.updateWatermarkDisplay();
    };
    paintPreview();
    (async () => {
      try {
        const e = await this.resolveWatermarkPolicy();
        this.applyWatermarkControls(e);
      } catch (e) {
        safeLog("🚨 Error checking watermark eligibility:", e);
      }
    })();
    safeLog("✅ Watermarked HTML set", "Has watermark element:", !!e.querySelector(".solis-watermark"));
    setTimeout(() => {
      if (window.clipsStudio) {
        window.clipsStudio.updateWatermarkDisplay();
      }
    }, 0);
    safeLog("[Template Preview] Content loaded, triggering customizer...");
    if (t?.id !== "ranked_compilation" && window.FloatingCustomizeBar && window.customizer) {
      setTimeout(() => {
        if (window.initializeFloatingCustomizer) {
          window.initializeFloatingCustomizer(true);
        }
      }, 100);
    } else {
      const e = document.getElementById("pill");
      if (e) e.style.display = "none";
    }
    const o = document.getElementById("previewEditorPill");
    if (o) {
      o.style.display = "";
      const e = o.querySelector('[data-tool="text"]');
      const n = o.querySelector('[data-tool="captions"]');
      const i = o.querySelector('[data-tool="animations"]');
      const r = t?.id === "ranked_compilation";
      if (e) e.style.display = "none";
      if (n) n.style.display = "";
      if (i) i.style.display = "";
      if (typeof window.activatePreviewToolbar === "function") {
        const e = n;
        if (e) {
          const t = Array.from(o.querySelectorAll(".tool-btn")).filter(e => e.style.display !== "none");
          window.activatePreviewToolbar(e, Math.max(0, t.indexOf(e)));
        }
      }
    }
    if (t?.id === "ranked_compilation" && window.initializeRankingTemplateEditor) {
      setTimeout(() => {
        window.initializeRankingTemplateEditor();
        const e = !!this.currentTemplateForPreview?.isLibraryPreview;
        const t = window.SolisMemory?.getTemplateMemory?.("ranked_compilation");
        const n = window.SolisMemory?.isSuggestEnabled?.() !== false;
        const i = !e && n && t?.styles && Object.keys(t.styles).length;
        if (i) {
          window.__solisRankingDeferCustoms = true;
        } else if (window.rankingCustomizer) {
          window.__solisRankingDeferCustoms = false;
          window.rankingCustomizer.applyCustomizations();
        }
        try {
          window.RankingTextPill?.seedDefaultSizes?.();
        } catch (e) {}
      }, 50);
    }
    if (t?.id === "splitscreen") {
      setTimeout(() => {
        try {
          if (typeof selectSecondaryGameplay === "function") {
            selectSecondaryGameplay("face_track");
          } else {
            splitscreenSecondaryType = "face_track";
          }
        } catch (e) {
          splitscreenSecondaryType = "face_track";
        }
        initializeSplitscreenDivider();
        applySplitscreenPreview();
        if (typeof window.clearPreviewCaptionOverlays === "function") {
          window.clearPreviewCaptionOverlays({
            hooks: true
          });
        } else if (typeof window.seedSplitscreenPreviewOverlays === "function") {
          window.seedSplitscreenPreviewOverlays({
            captions: false,
            clearCaptions: true
          });
        }
        syncSplitscreenSubtitles(e);
      }, 80);
    }
  }
  generateTemplatePreviewHTML(e) {
    safeLog(`🎨 generateTemplatePreviewHTML - template.id: ${e?.id}, template.type: ${e?.type}`);
    const t = {
      ranked_compilation: () => `\n                <style>\n                    .ranking-preview-container * {\n                        box-sizing: border-box;\n                    }\n                    .ranking-preview-container {\n                        position: absolute;\n                        inset: 0;\n                        width: 100%;\n                        height: 100%;\n                        padding: 14px 12px 16px;\n                        border-radius: inherit;\n                        display: flex;\n                        flex-direction: column;\n                        align-items: center;\n                        pointer-events: auto;\n                        overflow: hidden;\n                        background: transparent;\n                    }\n\n                    .ranking-preview-container::-webkit-scrollbar {\n                        width: 4px;\n                    }\n                    .ranking-preview-container::-webkit-scrollbar-track {\n                        background: transparent;\n                    }\n                    .ranking-preview-container::-webkit-scrollbar-thumb {\n                        background: rgba(255,255,255,0.3);\n                        border-radius: 2px;\n                    }\n                    .ranking-preview-container .text-stroke {\n                        font-weight: 400;\n                        text-shadow:\n                            2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000,\n                            1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;\n                        pointer-events: auto;\n                    }\n                    .ranking-preview-container .title {\n                        font-size: clamp(0.95rem, 5.2vw, 1.35rem);\n                        text-align: center;\n                        line-height: 1.12;\n                        text-transform: uppercase;\n                        margin-bottom: 4px;\n                        margin-top: 0;\n                        padding-top: 0;\n                        color: white;\n                        font-family: 'Luckiest Guy', cursive;\n                        font-weight: 400;\n                        pointer-events: auto;\n                        width: fit-content;\n                        max-width: calc(100% - 8px);\n                        margin-left: auto;\n                        margin-right: auto;\n                        overflow: visible;\n                    }\n                    .ranking-preview-container .funniest {\n                        color: #ff0000;\n                        pointer-events: auto;\n                    }\n                    .ranking-preview-container .ranking-list {\n                        list-style: none;\n                        padding: 0;\n                        margin: 6px 0 0 0;\n                        text-align: left;\n                        width: fit-content;\n                        max-width: 100%;\n                        align-self: flex-start;\n                        pointer-events: auto;\n                        flex: 0 0 auto;\n                        flex-shrink: 0;\n                        overflow: visible;\n                        display: flex;\n                        flex-direction: column;\n                        gap: 12px;\n                    }\n                    .ranking-preview-container .ranked-item {\n                        font-size: clamp(0.72rem, 3.8vw, 0.98rem);\n                        margin-bottom: 0;\n                        font-family: 'Luckiest Guy', cursive;\n                        line-height: 1.2;\n                        display: flex;\n                        align-items: baseline;\n                        justify-content: flex-start;\n                        font-weight: 400;\n                        pointer-events: auto;\n                        flex: 0 0 auto;\n                        flex-shrink: 0;\n                        overflow: visible;\n                        gap: 6px;\n                        width: fit-content;\n                        min-height: 1.2em;\n                    }\n                    .ranking-preview-container .ranked-item .rank-number {\n                        display: inline-block;\n                        pointer-events: auto;\n                        flex-shrink: 0;\n                        margin-right: 0.15em;\n                        padding: 0;\n                        width: max-content;\n                        letter-spacing: 0;\n                        line-height: 1.05;\n                    }\n                    .ranking-preview-container .rank-1 { color: #ffd700; pointer-events: auto; }\n                    .ranking-preview-container .rank-2 { color: #c0c0c0; pointer-events: auto; }\n                    .ranking-preview-container .rank-3 { color: #cd7f32; pointer-events: auto; }\n                    .ranking-preview-container .rank-4 { color: #ffffff; pointer-events: auto; }\n                    .ranking-preview-container .rank-5 { color: #ffffff; pointer-events: auto; }\n                    .ranking-editor-zone-header {\n                        display: flex;\n                        flex-direction: column;\n                        align-items: center;\n                        justify-content: flex-start;\n                        width: 100%;\n                        max-width: 100%;\n                        margin: 0 auto;\n                        text-align: center;\n                        overflow: visible;\n                        padding: 0 4px 4px;\n                        flex: 0 0 auto;\n                        flex-shrink: 0;\n                        position: relative;\n                        z-index: 6;\n                        box-sizing: border-box;\n                    }\n                    .ranking-preview-container .title .text-stroke,\n                    .ranking-preview-container h2.text-stroke {\n                        -webkit-text-stroke: 0;\n                        paint-order: stroke fill;\n                    }\n                    .ranking-editor-zone-ranks {\n                        width: fit-content;\n                        max-width: 100%;\n                        align-self: flex-start;\n                    }\n                    .ranking-preview-container [data-template-element-id] {\n                        transition: none;\n                    }\n                    .ranking-preview-container [data-template-element-id="title_channel"] {\n                        font-size: clamp(0.88rem, 4.8vw, 1.15rem);\n                        line-height: 1.1;\n                        margin: 2px auto 8px auto !important;\n                        max-width: calc(100% - 24px);\n                        display: block !important;\n                        width: fit-content;\n                        text-align: center;\n                        white-space: nowrap;\n                        overflow-wrap: normal;\n                        word-break: normal;\n                        box-sizing: border-box;\n                        position: relative;\n                        z-index: 7;\n                        float: none;\n                        transform: none;\n                    }\n                    .ranking-preview-container h1.title {\n                        display: block;\n                        white-space: nowrap;\n                        max-width: 100%;\n                        width: fit-content;\n                        margin: 0 auto 2px auto;\n                        text-align: center;\n                        position: relative;\n                        z-index: 7;\n                    }\n                    .ranking-preview-container [data-template-element-id="title_ranking"],\n                    .ranking-preview-container [data-template-element-id="title_funniest"] {\n                        display: inline-block;\n                        line-height: inherit;\n                        vertical-align: baseline;\n                        white-space: nowrap;\n                    }\n                    .ranking-preview-container .rank-title:empty::before {\n                        content: attr(data-placeholder);\n                        opacity: 0.42;\n                        font-style: italic;\n                    }\n                    .ranking-preview-container .rank-title {\n                        min-width: 2.5rem;\n                        cursor: text;\n                        text-transform: uppercase;\n                    }\n                </style>\n                <div class="ranking-preview-container">\n                    <div class="ranking-editor-zone ranking-editor-zone-header">\n                    <h1 class="title">\n                        <span data-template-element-id="title_ranking" class="text-stroke" style="color: white; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">RANKING</span> <span data-template-element-id="title_funniest" class="funniest text-stroke" style="color: #ff0000; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">BEST</span>\n                    </h1>\n                    <h2 data-template-element-id="title_channel" style="text-align: center; margin: 2px auto 12px auto; color: white !important; background: transparent !important; font-family: 'Luckiest Guy', cursive; font-weight: 400; max-width: calc(100% - 24px); pointer-events: auto; display: block; position: relative;" class="text-stroke">CHANNEL MOMENTS</h2>\n                    </div>\n                    <ul class="ranking-list ranking-editor-zone ranking-editor-zone-ranks">\n                        <li class="ranked-item rank-1">\n                            <span data-template-element-id="rank_1_number" class="rank-number text-stroke" style="color: #ffd700; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">1.</span>\n                            <span data-template-element-id="rank_1_title" class="rank-title text-stroke" style="color: #ffd700; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>\n                        </li>\n                        <li class="ranked-item rank-2">\n                            <span data-template-element-id="rank_2_number" class="rank-number text-stroke" style="color: #c0c0c0; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">2.</span>\n                            <span data-template-element-id="rank_2_title" class="rank-title text-stroke" style="color: #c0c0c0; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>\n                        </li>\n                        <li class="ranked-item rank-3">\n                            <span data-template-element-id="rank_3_number" class="rank-number text-stroke" style="color: #cd7f32; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">3.</span>\n                            <span data-template-element-id="rank_3_title" class="rank-title text-stroke" style="color: #cd7f32; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>\n                        </li>\n                        <li class="ranked-item rank-4">\n                            <span data-template-element-id="rank_4_number" class="rank-number text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">4.</span>\n                            <span data-template-element-id="rank_4_title" class="rank-title text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>\n                        </li>\n                        <li class="ranked-item rank-5">\n                            <span data-template-element-id="rank_5_number" class="rank-number text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">5.</span>\n                            <span data-template-element-id="rank_5_title" class="rank-title text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>\n                        </li>\n                    </ul>\n                </div>\n            `,
      splitscreen: () => `\n                <div id="splitscreenRoot" style="display:flex;flex-direction:column;height:100%;width:100%;background:transparent;overflow:hidden;border-radius:inherit;user-select:none;">\n                    \x3c!-- TOP: Content slot — transparent so shared preview grey shows (same as ranking) --\x3e\n                    <div id="splitscreenTop" style="flex:0 0 50%;width:100%;min-height:0;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">\n                        <div class="ss-content-placeholder" style="text-align:center;position:relative;z-index:2;">\n                            <div style="font-size:11px;color:#ff6a3d;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:5px;">\n                                <span style="width:5px;height:5px;background:#ff6a3d;border-radius:50%;animation:splitscreen-pulse 2s infinite;display:inline-block;"></span>\n                                Your Content\n                            </div>\n                            <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.5px;">Video Preview</div>\n                        </div>\n                    </div>\n\n                    \x3c!-- DIVIDER — 1px seam; hit target expands via CSS ::before (no fat gap) --\x3e\n                    <div id="splitscreenDivider" style="flex:0 0 1px;width:100%;height:1px;min-height:1px;max-height:1px;cursor:row-resize;display:flex;align-items:center;justify-content:center;position:relative;z-index:50;background:transparent;flex-shrink:0;overflow:visible;padding:0;margin:0;">\n                        <div id="dividerLine" class="ss-divider-grip" style="position:absolute;left:0;right:0;top:50%;width:100%;height:1px;background:rgba(148,163,184,0.85);border-radius:0;box-shadow:none;pointer-events:none;transform:translateY(-50%);"></div>\n                    </div>\n\n                    \x3c!-- BOTTOM: Secondary panel (gameplay / face) — default type is face_track via JS --\x3e\n                    <div id="splitscreenBottom" style="flex:1 1 0;width:100%;min-height:0;background:transparent;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;"\n                         data-no-text-select="true">\n                        <video style="width:100%;height:100%;object-fit:cover;display:none;pointer-events:none;" autoplay muted loop playsinline preload="auto" disablePictureInPicture controlslist="nodownload nofullscreen noremoteplayback" id="splitscreenGameplayVideo">\n                            <source src="/assets/Minecraft_1.mp4" type="video/mp4">\n                        </video>\n                    </div>\n                </div>\n            `
    };
    let n = t[e.id];
    if (!n) {
      n = t[e.type];
      safeLog(`⚠ï¸ Template.id '${e.id}' not found, using template.type '${e.type}'`);
    }
    if (!n) {
      safeLog(`âŒ CRITICAL: Neither template.id '${e.id}' nor template.type '${e.type}' found in previewTemplates`);
      safeLog("Available template keys:", Object.keys(t));
      n = () => `\n                <div class="preview-video-placeholder">\n                    <i class="fas fa-exclamation-circle"></i>\n                    <p>Template preview not available: ${e.id || e.type}</p>\n                </div>\n            `;
    }
    return `<style>@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }</style>${n()}`;
  }
  async loadYouTubeSubtitles(e) {
    try {
      const t = document.getElementById("youtubeSubtitleStatus");
      if (t) {
        t.textContent = "Loading...";
      }
      const n = await fetch("/api/youtube/subtitles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          video_id: e
        })
      });
      let i = [];
      if (n.ok) {
        const e = await n.json();
        i = e.subtitles || [];
      }
      if (t) {
        t.textContent = i.length > 0 ? "Ready" : "No subs";
      }
      if (typeof captionSystem !== "undefined") {
        captionSystem.initializeCaptions(i);
        captionSystem.playAnimation();
      }
    } catch (e) {
      safeLog("Error loading YouTube subtitles:", e);
      const t = document.getElementById("youtubeSubtitleStatus");
      if (t) {
        t.textContent = "Error";
      }
    }
  }
  extractYouTubeVideoId(e) {
    const t = [ /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/, /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/, /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/, /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?&]+)/ ];
    for (const n of t) {
      const t = e.match(n);
      if (t && t[1]) {
        const e = t[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(e)) {
          return e;
        }
      }
    }
    return null;
  }
  isYouTubeShort(e) {
    return /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\//.test(e);
  }
  isShortFormUrl(e) {
    return /youtube\.com\/shorts\//i.test(e) || /(?:vm|vt)\.tiktok\.com/i.test(e) || /tiktok\.com/i.test(e) || /instagram\.com\/reels?\//i.test(e) || /instagram\.com\/p\//i.test(e);
  }
  detectMediaPlatform(e) {
    const t = (e || "").toLowerCase();
    if (/(?:vm|vt)\.tiktok\.com|tiktok\.com/.test(t)) return "tiktok";
    if (/youtube\.com\/shorts\//.test(t)) return "youtube_shorts";
    if (/instagram\.com\/reels?\//.test(t) || /instagram\.com\/p\//.test(t)) return "instagram";
    if (/youtube\.com|youtu\.be/.test(t)) return "youtube";
    return "unknown";
  }
  isValidMediaUrl(e) {
    try {
      const t = new URL(e.startsWith("http") ? e : "https://" + e);
      const n = t.hostname.toLowerCase();
      const i = t.pathname.toLowerCase();
      const r = new Set([ "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com", "instagram.com", "www.instagram.com" ]);
      if (!r.has(n)) {
        return false;
      }
      if (i.includes("..") || i.includes("//")) {
        return false;
      }
      const o = this.detectMediaPlatform(e);
      if (o === "youtube") {
        const t = this.extractYouTubeVideoId(e);
        return !!(t && /^[a-zA-Z0-9_-]{11}$/.test(t));
      }
      if (o === "youtube_shorts") {
        return /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i.test(e);
      }
      if (o === "tiktok") {
        return /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(e);
      }
      if (o === "instagram") {
        return /instagram\.com\/(reels?|p)\//i.test(e);
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  async canUseShortFormUpload() {
    try {
      const e = await window._subCache.get();
      const t = (e?.plan || "free").toLowerCase();
      return t === "prime" || t === "elite";
    } catch {
      return false;
    }
  }
  showShortFormUploadModal() {
    const e = document.querySelector(".shortform-modal-overlay");
    if (e) e.remove();
    const t = document.createElement("div");
    t.className = "pro-modal-overlay shortform-modal-overlay";
    t.innerHTML = `\n            <div class="pro-modal">\n                <div class="pro-panel-left">\n                    <div class="pro-left-top">\n                        <div class="pro-lock-wrap">\n                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\n                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>\n                            </svg>\n                        </div>\n                        <h1 class="pro-title">Short-form upload is Prime+</h1>\n                        <p class="pro-subtitle">YouTube Shorts, TikToks, and Reels are only available on Prime and Elite. Upgrade to unlock short-form content.</p>\n                    </div>\n                    <div class="pro-template-preview">\n                        <div class="pro-tpb-preview">\n                            <div class="pro-tpb-pro">PRIME+</div>\n                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4BE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n                                <polygon points="23 7 16 12 23 17 23 7"/>\n                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>\n                            </svg>\n                            <div class="pro-locked-overlay">\n                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>\n                                </svg>\n                            </div>\n                        </div>\n                        <div class="pro-tpb-info">\n                            <div>\n                                <strong>Short-form Upload</strong>\n                                <span style="display:block;margin-top:2px;font-size:11px;color:#AAA">YT Shorts · TikTok · Reels</span>\n                            </div>\n                            <span style="font-size:11px;color:#FF6A3D;font-weight:600;background:#FFF3EF;padding:3px 9px;border-radius:100px;border:1px solid #FFD0C2">PRIME+</span>\n                        </div>\n                    </div>\n                </div>\n                <div class="pro-panel-right">\n                    <button class="pro-close-btn">\n                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\n                            <line x1="18" y1="6" x2="6" y2="18"/>\n                            <line x1="6" y1="6" x2="18" y2="18"/>\n                        </svg>\n                    </button>\n                    <div>\n                        <div class="pro-plans-label">Unlock with a plan</div>\n                        <div class="pro-plan-options">\n                            <div class="pro-plan-card" style="opacity:0.45;pointer-events:none;">\n                                <div class="pro-plan-card-icon">\n                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfBasicGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f1f5f9"/><stop offset="100%" style="stop-color:#94a3b8"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfBasicGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfBasicGrad)" stroke-width="10" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfBasicGrad)" stroke-width="10" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>\n                                </div>\n                                <div class="pro-plan-card-body"><strong>Basic</strong><span>Long-form YouTube only</span></div>\n                                <div class="pro-plan-card-price">$9.99/mo</div>\n                            </div>\n                            <div class="pro-plan-card highlighted">\n                                <div class="pro-popular-tag">Unlock Short-form</div>\n                                <div class="pro-plan-card-icon">\n                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfPrimeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fff176"/><stop offset="50%" style="stop-color:#ffd600"/><stop offset="100%" style="stop-color:#ff9100"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfPrimeGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfPrimeGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfPrimeGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>\n                                </div>\n                                <div class="pro-plan-card-body"><strong>Prime</strong><span>YT Shorts · TikTok · Reels</span></div>\n                                <div class="pro-plan-card-price">$23.99/mo</div>\n                            </div>\n                            <div class="pro-plan-card">\n                                <div class="pro-plan-card-icon">\n                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfEliteGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ff6b3d"/><stop offset="50%" style="stop-color:#ff3d00"/><stop offset="100%" style="stop-color:#c70000"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfEliteGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfEliteGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfEliteGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>\n                                </div>\n                                <div class="pro-plan-card-body"><strong>Elite</strong><span>Everything + Priority queue</span></div>\n                                <div class="pro-plan-card-price">$39.99/mo</div>\n                            </div>\n                        </div>\n                    </div>\n                    <div class="pro-right-footer">\n                        <button class="pro-cta-btn shortform-upgrade-btn">\n                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>\n                                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>\n                            </svg>\n                            Unlock Short-form Upload\n                        </button>\n                        <p class="pro-fine-print"><a class="shortform-maybe-later">Maybe later</a></p>\n                    </div>\n                </div>\n            </div>\n        `;
    const close = () => {
      t.style.opacity = "0";
      t.style.transition = "opacity 0.25s ease";
      setTimeout(() => t.remove(), 250);
    };
    t.querySelector(".pro-close-btn").addEventListener("click", close);
    t.querySelector(".shortform-maybe-later").addEventListener("click", close);
    t.querySelector(".shortform-upgrade-btn").addEventListener("click", () => {
      window.location.href = "/premium.html?plan=prime";
    });
    t.addEventListener("click", e => {
      if (e.target === t) close();
    });
    document.body.appendChild(t);
  }
  async fetchVideoMetadata(e, t, n, i) {
    try {
      const r = this.extractYouTubeVideoId(e);
      if (!r) {
        if (i) i.textContent = "Invalid YouTube URL";
        return;
      }
      const o = window.API_BASE_URL || "https://api.solisai.video/api";
      try {
        const s = await fetch(`${o}/youtube/get-metadata/${r}`, {
          signal: AbortSignal.timeout(3e3)
        });
        if (s.ok) {
          const r = await s.json();
          if (i && r.title) {
            i.textContent = r.title;
          }
          if (t && r.duration) {
            let e = r.duration;
            if (typeof r.duration === "number") {
              e = `~${Math.floor(r.duration / 60)}m ${r.duration % 60}s`;
            }
            t.textContent = e;
          }
          if (n) {
            const t = this.isYouTubeShort(e) ? "YouTube Shorts" : "TikTok / Shorts";
            n.textContent = t;
          }
          return;
        }
      } catch (e) {
        safeLog("Backend metadata fetch failed, using fallback:", e.message);
      }
      if (i) i.textContent = `YouTube Video (ID: ${r.substring(0, 8)}...)`;
      if (n) n.textContent = this.isYouTubeShort(e) ? "YouTube Shorts" : "TikTok / Shorts";
      if (t) t.textContent = "~60s";
    } catch (e) {
      safeLog("Error in fetchVideoMetadata:", e);
      if (i) i.textContent = "Unable to fetch video info";
    }
  }
  closeTemplatePreviewModal() {
    try {
      const e = this.currentTemplateForPreview?.id === "ranked_compilation" || this.selectedTemplate === "ranked_compilation" || !!document.querySelector("#templateVideoPreview .ranking-preview-container");
      if (e && window.rankingCustomizer) {
        try {
          if (typeof window.rankingCustomizer.flushRankingStylesForGenerate === "function") {
            window.rankingCustomizer.flushRankingStylesForGenerate();
          } else {
            document.querySelectorAll("#templateVideoPreview .rk-inline-editing").forEach(e => {
              try {
                e.blur();
              } catch (e) {}
            });
            window.rankingCustomizer.persistAllPreviewStyles?.();
            const e = window.rankingCustomizer.captureGenerateLock?.();
            if (e && Object.keys(e).length) {
              window.__solisPendingGenerateRankingCustoms = e;
              window.__solisRankingStyleLock = e;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    if (typeof resetReframeImmersiveState === "function") {
      resetReframeImmersiveState();
    }
    const e = document.getElementById("templatePreviewModal");
    if (e) {
      e.classList.remove("active");
      e.style.display = "none";
      e.style.visibility = "hidden";
      e.style.opacity = "0";
      document.body.classList.remove("modal-open");
    }
    const t = document.getElementById("templateVideoPreview");
    if (t) {
      t.querySelectorAll("video").forEach(e => {
        try {
          e.pause();
          e.removeAttribute("src");
          e.load();
        } catch (e) {}
      });
      try {
        if (typeof window.clearPreviewCaptionOverlays === "function") {
          window.clearPreviewCaptionOverlays({
            hooks: true,
            overlays: true,
            container: t
          });
        }
      } catch (e) {}
      t.innerHTML = "";
    }
    if (this._libraryPreviewObjectUrl) {
      URL.revokeObjectURL(this._libraryPreviewObjectUrl);
      this._libraryPreviewObjectUrl = null;
    }
    if (this._libraryPreviewFetchController) {
      this._libraryPreviewFetchController.abort();
      this._libraryPreviewFetchController = null;
    }
    this._hideLibraryPreviewLoading();
    const n = document.querySelector(".template-preview-content");
    if (n) n.classList.remove("is-library-preview");
    if (typeof PreviewTimeline !== "undefined") {
      PreviewTimeline.detach();
    }
    teardownLibrarySplitscreenCropObserver();
    setSplitscreenScope(null);
    const i = document.querySelector(".template-preview-sidebar");
    if (i) {
      i.classList.remove("expanded");
    }
    const r = document.getElementById("navWrapper");
    const o = document.querySelector(".profile-notif-wrapper");
    if (r) {
      r.classList.remove("disabled");
    }
    if (o) {
      o.classList.remove("disabled");
    }
    const s = document.getElementById("confirmUseTemplateBtn");
    if (s) {
      s.textContent = "Use Template";
      s.classList.remove("library-download-mode");
      s.disabled = false;
      s.style.pointerEvents = "";
      s.style.opacity = "";
    }
    this.toggleLibraryPreviewLayout(false);
    this.libraryPreviewModalOpen = false;
    this._libraryRankingOverlayPending = null;
    this._libraryRankingUseCleanVideo = false;
    if (this._customizeExpiryTimer) {
      clearInterval(this._customizeExpiryTimer);
      this._customizeExpiryTimer = null;
    }
    const a = document.getElementById("libraryCustomizeExpiryPill");
    if (a) {
      a.hidden = true;
      a.textContent = "";
    }
    if (this._libraryRefreshPending) {
      this._libraryRefreshPending = false;
      this._libraryLastLoaded = 0;
      this.loadLibraryItems({
        soft: true,
        force: true
      }).catch(() => {
        this.updateLibraryView();
      });
    }
    this.currentTemplateForPreview = null;
    if (window.SolisMemory && typeof window.SolisMemory.onTemplatePreviewClose === "function") {
      window.SolisMemory.onTemplatePreviewClose();
    }
    try {
      if (typeof window.clearSubtitleMemorySuggest === "function") {
        window.clearSubtitleMemorySuggest();
      }
      if (window.RankingTextPill?.clearSuggest) window.RankingTextPill.clearSuggest();
      if (window.RankingTextPill?.hide) window.RankingTextPill.hide();
      if (window.RankingTextPill?.deselectAll) window.RankingTextPill.deselectAll();
      document.querySelectorAll(".rk-ghost-stack,.sub-mem-ghost,.solis-memory-suggest").forEach(e => {
        if (e.id === "solisMemorySuggest") {
          e.hidden = true;
          e.style.visibility = "hidden";
          e.style.opacity = "0";
          e.style.pointerEvents = "none";
        } else {
          e.remove();
        }
      });
      const e = document.getElementById("rkSuggestActions");
      if (e) {
        e.classList.remove("open");
        e.style.visibility = "hidden";
        e.style.opacity = "0";
        e.style.pointerEvents = "none";
      }
      const t = document.getElementById("subMemActions");
      if (t) {
        t.classList.remove("open");
        t.style.visibility = "hidden";
        t.style.opacity = "0";
        t.style.pointerEvents = "none";
      }
    } catch (e) {}
  }
  getLibraryPreviewVideoUrl(e, {bust: t = false, clean: n = false} = {}) {
    if (!e) return "";
    const i = `${API_BASE_URL}/clips/preview/${encodeURIComponent(e)}/1`;
    const r = [];
    if (n) r.push("clean=1");
    if (t) r.push(`_=${Date.now()}`);
    return r.length ? `${i}?${r.join("&")}` : i;
  }
  _showLibraryPreviewLoading() {
    const e = document.getElementById("templatePreviewLoading");
    const t = document.querySelector(".template-preview-content");
    if (t) t.classList.add("is-library-preview");
    if (!e) return;
    e.classList.remove("hidden");
    e.style.display = "flex";
    e.style.visibility = "visible";
    e.style.opacity = "1";
    e.style.pointerEvents = "auto";
  }
  _hideLibraryPreviewLoading() {
    const e = document.getElementById("templatePreviewLoading");
    if (!e) return;
    e.classList.add("hidden");
    e.style.opacity = "0";
    e.style.visibility = "hidden";
    e.style.pointerEvents = "none";
    e.style.display = "none";
  }
  _setLibraryPreviewPlaceholder(e, t = "Loading preview...") {
    if (!e) return;
    e.classList.remove("has-video");
    e.innerHTML = `\n            <div class="preview-video-placeholder library-preview-loading">\n                <div class="solis-arc-spinner" aria-hidden="true">\n                    <svg viewBox="0 0 48 48">\n                        <circle class="solis-arc-track" cx="24" cy="24" r="18" fill="none"/>\n                        <circle class="solis-arc-head" cx="24" cy="24" r="18" fill="none"/>\n                    </svg>\n                </div>\n                <p>${t}</p>\n            </div>\n        `;
  }
  _showLibraryPreviewError(e, t = "Could not load video preview", n = null) {
    if (!e) return;
    e.classList.remove("has-video");
    const i = n || this._libraryPreviewProjectId || this.currentTemplateForPreview?.projectId || "";
    const r = String(i).replace(/"/g, "");
    e.innerHTML = `\n            <div class="preview-video-placeholder">\n                <i class="fas fa-exclamation-circle"></i>\n                <p>${t}</p>\n                ${r ? `<button type="button" class="library-preview-retry-btn" data-project-id="${r}">Retry</button>` : ""}\n            </div>\n        `;
    const o = e.querySelector(".library-preview-retry-btn");
    if (o && r) {
      o.addEventListener("click", t => {
        t.preventDefault();
        t.stopPropagation();
        this._setLibraryPreviewPlaceholder(e, "Loading preview...");
        this._showLibraryPreviewLoading();
        this.mountLibraryPreviewVideo(e, r);
      }, {
        once: true
      });
    }
    this._hideLibraryPreviewLoading();
  }
  openLibraryPreviewWhenReady(e, t, n = 0) {
    const i = t != null ? String(t) : "";
    const r = e != null ? e : t;
    let o = this.libraryItems.find(e => String(e.id) === String(r) || String(e.projectId) === i || String(e.id) === i);
    if (!o && i && n === 0) {
      const e = (this.processingItems || []).find(e => String(e.projectId) === i || String(e.id) === String(r));
      o = {
        id: r || i,
        projectId: i,
        name: e?.name || "Clip Preview",
        template: e?.template || "Clip",
        templateName: e?.templateName || e?.template || "Clip",
        status: "completed",
        timestamp: (new Date).toISOString(),
        _optimistic: true
      };
      this.libraryItems.unshift(o);
    }
    const s = i ? document.querySelector(`.library-card[data-project-id="${CSS.escape(i)}"]`) : null;
    if (o && (s || n >= 2)) {
      this.openLibraryPreview(o.id, o.projectId || i, s, {
        fast: true
      });
      return;
    }
    if (n < 40) {
      setTimeout(() => this.openLibraryPreviewWhenReady(r, i, n + 1), 120);
      return;
    }
    if (o || i) {
      this.openLibraryPreview(o && o.id || r || i, o && o.projectId || i, s, {
        fast: true
      });
    }
  }
  openLibraryPreview(e, t, n, i = {}) {
    const r = document.getElementById("templatePreviewModal");
    if (!r) {
      return;
    }
    safeLog(`🎬 Opening library preview for: ${e} (project: ${t})`);
    if (n) {
      const e = n.querySelector(".status-pill");
      if (e) {
        e.style.opacity = "0";
        e.style.transition = "opacity 0.3s ease";
        setTimeout(() => {
          e.style.display = "none";
          safeLog("✅ Status-pill hidden for library preview");
        }, 300);
      }
    }
    this.libraryPreviewModalOpen = true;
    this._showLibraryPreviewLoading();
    const o = document.getElementById("templateVideoPreview");
    if (o) {
      this._setLibraryPreviewPlaceholder(o);
    }
    const s = this.libraryItems.find(n => n.id == e || n.projectId == t || n.id == t || n.projectId == e);
    if (!s) {
      safeLog(`âŒ Library item not found: ${e}`);
      this.libraryPreviewModalOpen = false;
      this._hideLibraryPreviewLoading();
      return;
    }
    t = s.projectId || s.id || t;
    const a = document.getElementById("previewTemplateName");
    const l = document.getElementById("previewTemplateDescription");
    const c = document.getElementById("previewVideoDuration");
    const d = document.getElementById("previewVideoFormat");
    if (a) {
      a.textContent = s.name || "Clip Preview";
    }
    if (l) {
      l.textContent = `Template: ${s.templateName || s.template || "Custom"}`;
    }
    if (c && s.duration) {
      c.textContent = s.duration;
    }
    if (d) {
      d.textContent = "Generated Clip";
    }
    const p = document.getElementById("confirmUseTemplateBtn");
    if (p) {
      p.textContent = "Download";
      p.classList.add("library-download-mode");
    }
    r.classList.add("active");
    r.style.display = "flex";
    r.style.visibility = "visible";
    r.style.opacity = "1";
    document.body.classList.add("modal-open");
    const u = document.getElementById("navWrapper");
    const m = document.querySelector(".profile-notif-wrapper");
    if (u) {
      u.classList.add("disabled");
    }
    if (m) {
      m.classList.add("disabled");
    }
    const f = document.querySelector(".template-preview-sheet");
    if (f) {
      f.classList.remove("expanded");
    }
    const y = document.getElementById("watermarkToggle");
    const g = y ? y.checked : false;
    const h = s.template || s.templateName || "";
    this.currentTemplateForPreview = {
      id: e,
      projectId: t,
      type: h,
      templateId: h,
      isLibraryPreview: true,
      card: n,
      data: {
        name: s.name,
        template: s.template,
        templateName: s.templateName
      },
      addWatermark: g,
      videoQuality: "auto"
    };
    this.toggleLibraryPreviewLayout(true);
    if (typeof window.syncPreviewModifiersForTemplate === "function") {
      window.syncPreviewModifiersForTemplate("");
    }
    this._watermarkCheckCache = null;
    this.setupWatermarkToggle();
    this.loadLibraryVideoPreview().then(() => this._configureLibraryEditingUI());
  }
  loadLibraryVideoPreview() {
    const e = document.getElementById("templateVideoPreview");
    if (!e) return Promise.resolve();
    const t = this.currentTemplateForPreview?.projectId;
    if (!t) {
      this._showLibraryPreviewError(e, "No project selected");
      return Promise.resolve();
    }
    if (this._isCurrentLibraryRanking()) {
      return this.mountLibraryRankingPreview(e, t);
    }
    if (this._isCurrentLibrarySplitScreen()) {
      return this.mountLibrarySplitscreenPreview(e, t);
    }
    return this.mountLibrarySplitscreenPreview(e, t);
  }
  async mountLibrarySplitscreenPreview(e, t) {
    this._librarySplitscreenCustomize = false;
    this._librarySplitscreenDirty = false;
    this._libraryOverlayDirty = false;
    this._libraryPreviewProjectId = t;
    revokeLibrarySplitscreenObjectUrls();
    try {
      if (!this.validateProjectId(t)) {
        throw new Error("Invalid project id");
      }
      if (this._isCurrentLibraryRanking()) {
        this.mountLibraryPreviewVideo(e, t);
        return;
      }
      const n = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(t)}/splitscreen-state`, {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!n.ok) {
        this.mountLibraryPreviewVideo(e, t);
        return;
      }
      const i = await n.json();
      this._libraryCustomizeMeta = {
        can_customize: Boolean(i.can_customize),
        customize_expired: Boolean(i.customize_expired),
        customize_expires_at: i.customize_expires_at || null,
        customize_ttl_hours: i.customize_ttl_hours,
        customize_remaining_hours: i.customize_remaining_hours,
        apply_consumes_quota: i.apply_consumes_quota !== false
      };
      this._updateLibraryCustomizeExpiryPill();
      if (i.customize_expired) {
        try {
          showNotification("Customization window expired for this project. You can still download the last render.", "info");
        } catch (e) {}
        this.mountLibraryPreviewVideo(e, t);
        return;
      }
      const r = i.layers || {};
      const o = Boolean(i.has_segment || r.segment || r.content || r.secondary);
      if (!o) {
        this.mountLibraryPreviewVideo(e, t);
        return;
      }
      if (!i.can_customize && !i.has_segment) {
        this.mountLibraryPreviewVideo(e, t);
        return;
      }
      const s = Boolean(i.captions_burned || i.subtitles_enabled || i.caption_style && (i.caption_style.anim || i.caption_style.enabled));
      this._libraryCaptionsOn = s;
      if (s && !(i.can_customize || i.has_segment)) {
        safeLog("ðŸ“ Captioned master → flat library preview (no editable layers)");
        this._librarySplitscreenCustomize = false;
        this._libraryPreviewProjectId = t;
        applySplitscreenConfigFromServer(i);
        this.mountLibraryPreviewVideo(e, t);
        await this._configureLibraryEditingUI();
        return;
      }
      applySplitscreenConfigFromServer(i);
      const a = i.state || {};
      const l = splitscreenSecondaryType === "face_track";
      const c = Boolean(r.secondary);
      const d = Boolean(r.content);
      const p = Boolean(i.has_segment || r.segment);
      if (l && !c && !p) {
        splitscreenSecondaryCollapsed = true;
        splitscreenContentRatio = 1;
      }
      const u = l && c && d;
      const m = !l && d || u;
      setLibrarySplitscreenCropState({
        cropX: a.crop_x ?? null,
        faceCrop: a.face_crop || null,
        srcW: 0,
        srcH: 0,
        useLayers: m,
        liveFaceEdit: l && (u || p),
        faceDisplayMode: l ? u ? "baked" : p ? "live" : "baked" : null,
        secondaryFromLayer: u
      });
      this._librarySplitscreenCustomize = true;
      this._librarySplitscreenDirty = false;
      this._libraryOverlayDirty = false;
      setSplitscreenScope(e);
      e.classList.remove("has-video");
      e.innerHTML = buildSplitscreenPreviewShell();
      const f = `${API_BASE_URL}/clips/projects/${encodeURIComponent(t)}/splitscreen-layer`;
      const y = `${API_BASE_URL}/clips/projects/${encodeURIComponent(t)}/splitscreen-segment`;
      const g = e.querySelector("#splitscreenContentVideo");
      const h = e.querySelector("#splitscreenReframeVideo");
      const w = e.querySelector("#splitscreenGameplayVideo");
      e.classList.add("library-splitscreen-preview");
      const wireVideo = async (e, t, {secure: n = true} = {}) => {
        if (!e || !t) return false;
        forceLibraryPanelVideoFill(e);
        e.muted = true;
        e.loop = true;
        e.playsInline = true;
        e.preload = "auto";
        e.setAttribute("playsinline", "");
        e.removeAttribute("crossorigin");
        let i = t;
        if (n && typeof t === "string" && t.startsWith("http")) {
          try {
            i = await fetchSecureVideoObjectUrl(t);
          } catch (e) {
            safeLog("Layer blob fetch failed, trying direct src:", e);
            i = t;
          }
        }
        return new Promise(t => {
          let n = false;
          const finish = i => {
            if (n) return;
            n = true;
            if (i && e.videoWidth && _librarySplitscreenCropState) {
              _librarySplitscreenCropState.srcW = e.videoWidth;
              _librarySplitscreenCropState.srcH = e.videoHeight;
              if (e === h) {
                _librarySplitscreenCropState.faceSrcW = e.videoWidth;
                _librarySplitscreenCropState.faceSrcH = e.videoHeight;
              }
            }
            forceLibraryPanelVideoFill(e);
            syncLibrarySplitscreenCropPreview();
            try {
              if (typeof splitscreenSecondaryType !== "undefined" && (splitscreenSecondaryType === "blank" || splitscreenSecondaryType === "blank_blur")) {
                syncBlankBlurVideo();
              }
            } catch (e) {}
            t(i);
          };
          e.addEventListener("loadeddata", () => finish(true), {
            once: true
          });
          e.addEventListener("loadedmetadata", () => {
            forceLibraryPanelVideoFill(e);
            e.play().catch(() => {});
            if (e.videoWidth > 0) finish(true);
          }, {
            once: true
          });
          e.addEventListener("canplay", () => {
            if (e.videoWidth > 0) finish(true);
          }, {
            once: true
          });
          e.addEventListener("error", () => finish(false), {
            once: true
          });
          e.src = i;
          e.load();
          e.play().catch(() => {});
          setTimeout(() => finish(e.videoWidth > 0 && e.readyState >= 1), 1e4);
        });
      };
      if (l && u) {
        if (w) {
          w.style.setProperty("display", "none", "important");
          w.removeAttribute("src");
        }
        const e = await wireVideo(g, `${f}/content`);
        if (!e) throw new Error("Failed to load content layer");
        if (h) {
          h.style.setProperty("display", "block", "important");
          h.style.touchAction = "none";
          h.style.cursor = "grab";
          const e = await wireVideo(h, `${f}/secondary`);
          if (!e) {
            if (!p) throw new Error("Failed to load reframe layer");
            safeLog("Reframe layer failed — falling back to live segment crop");
            if (_librarySplitscreenCropState) {
              _librarySplitscreenCropState.faceDisplayMode = "live";
              _librarySplitscreenCropState.liveFaceEdit = true;
              _librarySplitscreenCropState.secondaryFromLayer = false;
            }
            const e = await fetchSecureVideoObjectUrlPair(y);
            const t = await wireVideo(h, e[1], {
              secure: false
            });
            if (!t) throw new Error("Failed to load reframe layer");
          }
          forceLibraryPanelVideoFill(h);
          h.style.setProperty("pointer-events", "auto", "important");
        }
        bindLibrarySplitscreenPlaybackSync(g, h);
        syncLibrarySplitscreenCropPreview();
      } else if (l && p) {
        if (w) {
          w.style.setProperty("display", "none", "important");
          w.removeAttribute("src");
        }
        let e = y;
        let t = y;
        try {
          [e, t] = await fetchSecureVideoObjectUrlPair(y);
        } catch (e) {
          safeLog("Shared segment blob pair failed, streaming URLs:", e);
        }
        const n = await wireVideo(g, e, {
          secure: false
        });
        if (!n) throw new Error("Failed to load splitscreen segment");
        if (h) {
          h.style.setProperty("display", "block", "important");
          h.style.touchAction = "none";
          h.style.cursor = "grab";
          const e = await wireVideo(h, t, {
            secure: false
          });
          if (!e) throw new Error("Failed to load reframe panel");
          forceLibraryPanelVideoFill(h);
          h.style.setProperty("pointer-events", "auto", "important");
        }
        bindLibrarySplitscreenPlaybackSync(g, h);
        syncLibrarySplitscreenCropPreview();
      } else if (l && !c && !p) {
        safeLog("Face track without secondary/segment yet — flat preview");
        throw new Error("Reframe layers not ready");
      } else {
        const e = m ? `${f}/content` : y;
        const t = await wireVideo(g, e);
        if (!t && m && p) {
          if (_librarySplitscreenCropState) _librarySplitscreenCropState.useLayers = false;
          await wireVideo(g, y);
        }
        if (l) {
          if (w) {
            w.style.setProperty("display", "none", "important");
            w.removeAttribute("src");
          }
          if (h && c) {
            if (_librarySplitscreenCropState) {
              _librarySplitscreenCropState.faceDisplayMode = "baked";
              _librarySplitscreenCropState.liveFaceEdit = false;
            }
            h.style.setProperty("display", "block", "important");
            await wireVideo(h, `${f}/secondary`);
            forceLibraryPanelVideoFill(h);
            if (g) bindLibrarySplitscreenPlaybackSync(g, h);
          }
        } else if (c) {
          if (h) {
            h.style.setProperty("display", "none", "important");
            h.removeAttribute("src");
          }
          if (w) {
            w.style.setProperty("display", "block", "important");
            await wireVideo(w, `${f}/secondary`);
            if (g) bindLibrarySplitscreenPlaybackSync(g, w);
          }
        } else if (w) {
          if (h) h.style.setProperty("display", "none", "important");
          w.style.setProperty("display", "block", "important");
        }
      }
      if (availableGameplayClips.length === 0) {
        await loadAvailableGameplayClips();
      }
      applySplitscreenPreview();
      const v = e.querySelector("#splitscreenFacePanel");
      if (v) v.classList.remove("visible");
      if (l && h) {
        syncLibrarySplitscreenCropPreview();
      }
      if (g && !l) forceLibraryPanelVideoFill(g);
      initializeSplitscreenDivider();
      requestAnimationFrame(() => {
        applySplitscreenRatio();
        syncLibrarySplitscreenCropPreview();
        const t = e.querySelector("#splitscreenDivider");
        if (t) {
          delete t.dataset.splitscreenInit;
          initializeSplitscreenDivider();
          t.style.setProperty("display", "flex", "important");
          t.style.setProperty("opacity", "1", "important");
          t.style.setProperty("pointer-events", "auto", "important");
          t.style.setProperty("z-index", "60", "important");
        }
        playBothLibraryPanels(e);
      });
      bindLibrarySplitscreenCropObserver(e.querySelector("#splitscreenRoot"));
      if (_librarySplitscreenCropState?.liveFaceEdit) {
        bindFaceReframePanHandlers();
      }
      e.classList.add("has-video", "library-splitscreen-preview");
      this._hideLibraryPreviewLoading();
      playBothLibraryPanels(e);
      ensurePreviewAudioToggle(e);
      if (typeof PreviewTimeline !== "undefined" && g) {
        PreviewTimeline.attach(g);
      }
      try {
        this._libraryHookCleared = false;
        this._libraryCaptionsCleared = false;
        try {
          if (typeof clearSubtitleMemorySuggest === "function") clearSubtitleMemorySuggest();
          document.querySelectorAll(".sub-mem-ghost,.sub-mem-actions").forEach(e => e.remove());
        } catch (e) {}
        if (s) {
          const e = i.caption_style || {
            anim: "karaoke",
            font: "Montserrat",
            color: "#ffffff",
            shadow: "outline",
            font_size: 68,
            font_size_ratio: 68 / 1920,
            y_pct: .78,
            enabled: true
          };
          if (typeof window.setLiveCaptionTimedWords === "function") {
            window.setLiveCaptionTimedWords(i.caption_preview_words || []);
          }
          let t = String(i.caption_preview_text || (typeof i.caption_style?.preview_text === "string" ? i.caption_style.preview_text : "") || "").trim();
          if (!t && Array.isArray(i.caption_preview_words) && i.caption_preview_words.length) {
            t = i.caption_preview_words.map(e => e && e.text != null ? String(e.text) : String(e || "")).filter(Boolean).join(" ").trim();
          }
          if (typeof window.applySubtitleStyle === "function") {
            window.applySubtitleStyle(e, {
              selectAfter: false,
              applyFill: true,
              playAnim: true,
              softClamp: true,
              previewText: t || null
            });
          }
        }
        const t = String(a && a.subtitle_text || i.ai_hook_text || "").trim();
        if (t && typeof window.ensureLibraryAiHookOverlay === "function") {
          const e = {
            ...i.ai_hook_style || {},
            secondary_type: i.splitscreen_secondary_type || (typeof splitscreenSecondaryType !== "undefined" ? splitscreenSecondaryType : "gameplay"),
            inverted: i.splitscreen_inverted != null ? Boolean(i.splitscreen_inverted) : typeof splitscreenInverted !== "undefined" ? splitscreenInverted : false,
            content_ratio: i.splitscreen_content_ratio ?? (typeof splitscreenContentRatio !== "undefined" ? splitscreenContentRatio : .5),
            secondary_collapsed: i.splitscreen_secondary_collapsed != null ? Boolean(i.splitscreen_secondary_collapsed) : typeof splitscreenSecondaryCollapsed !== "undefined" ? splitscreenSecondaryCollapsed : false
          };
          window.ensureLibraryAiHookOverlay(t, e);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                window.ensureLibraryAiHookOverlay(t, e);
              } catch (e) {}
            });
          });
        }
        if (typeof syncSplitscreenSubtitles === "function") {
          syncSplitscreenSubtitles(e);
        }
      } catch (e) {
        safeLog("Library caption/hook seed skipped:", e);
      }
      await this._configureLibraryEditingUI();
      try {
        if (s && typeof window.ensureSubtitleAnimPreview === "function") {
          requestAnimationFrame(() => window.ensureSubtitleAnimPreview());
        }
        requestAnimationFrame(() => {
          const e = document.getElementById("templateVideoPreview");
          if (!e || typeof window.markSubtitleSuggest !== "function") return;
          const t = e.querySelector(".sub-text-block:not(.overlay-text-block)");
          const n = e.querySelector('.overlay-text-block[data-ai-hook="1"]');
          if (t) window.markSubtitleSuggest(t);
          if (n) window.markSubtitleSuggest(n);
        });
      } catch (e) {}
    } catch (n) {
      safeLog("Library splitscreen preview failed, using flat video:", n);
      this._librarySplitscreenCustomize = false;
      teardownLibrarySplitscreenCropObserver();
      setSplitscreenScope(null);
      this.mountLibraryPreviewVideo(e, t);
    }
  }
  async runLibraryApplyWithSpinner(e, {needsRecompose: t, needsOverlayRender: n, needsRankingRecompose: i = false, overlays: r = null}) {
    const o = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
    const s = t || n || i ? async () => {
      if (i) {
        await this.saveLibraryRankingCustomizations(e);
      }
      if (t) {
        await this.saveLibrarySplitscreenLayout(e);
      }
      if (n) {
        await this.saveLibraryOverlayTexts(e, r);
      }
    } : null;
    const downloadFn = async () => {
      await this.downloadClip(e, {
        skipModalClose: true,
        quiet: true
      });
    };
    if (o?.runLibraryApplyFlow) {
      await o.runLibraryApplyFlow(e, {
        applyFn: s,
        downloadFn: downloadFn
      });
      return;
    }
    if (s) await s();
    await downloadFn();
    showNotification("Download started!", "success");
  }
  async saveLibraryOverlayTexts(e, t = null) {
    const n = Array.isArray(t) && t.length ? t : typeof window.collectLibraryOverlayTexts === "function" ? window.collectLibraryOverlayTexts() : [];
    if (!n.length) {
      throw new Error("Type some text on the preview first (not just “Text”)");
    }
    const i = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/overlay-text`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        overlays: n
      })
    });
    if (!i.ok) {
      const e = await i.json().catch(() => ({}));
      throw this._libraryApplyError(e, i.status, "Overlay apply failed");
    }
    const r = await i.json().catch(() => ({}));
    this._libraryOverlayDirty = false;
    try {
      await this.refreshQuotaAfterApply(r);
    } catch (e) {}
  }
  async saveLibrarySplitscreenLayout(e) {
    const t = typeof window.getSplitscreenConfig === "function" ? window.getSplitscreenConfig() : {};
    const n = _librarySplitscreenCropState || {};
    const i = {
      splitscreen_content_ratio: t.splitscreen_content_ratio,
      splitscreen_inverted: t.splitscreen_inverted,
      splitscreen_secondary_collapsed: t.splitscreen_secondary_collapsed,
      splitscreen_secondary_type: t.splitscreen_secondary_type,
      gameplay_clip_id: t.gameplay_clip_id
    };
    if (Array.isArray(n.faceCrop) && n.faceCrop.length === 4) {
      i.face_crop = n.faceCrop.map(e => Number(e));
    }
    if (n.cropX != null && Number.isFinite(Number(n.cropX))) {
      i.crop_x = Number(n.cropX);
    }
    try {
      const e = window.PreviewTimeline?.getTrim?.();
      if (e && e.duration > 0) {
        const t = Number(e.start) || 0;
        const n = Number(e.end) || e.duration;
        if (t > .05 || n < e.duration - .05) {
          i.trim_start = Number(t.toFixed(3));
          i.trim_end = Number(n.toFixed(3));
        }
      }
    } catch (e) {}
    try {
      const e = document.getElementById("templateVideoPreview")?.querySelector(".sub-text-block:not(.overlay-text-block)");
      if (e && typeof window.collectSubtitleStyle === "function") {
        const e = window.collectSubtitleStyle();
        if (e && typeof e === "object") {
          i.caption_style = e;
          i.subtitles_enabled = true;
          i.clear_captions = false;
        }
      } else if (this._libraryCaptionsCleared || this._libraryCaptionsOn) {
        if (!e) {
          i.clear_captions = true;
          i.subtitles_enabled = false;
        }
      }
    } catch (e) {}
    try {
      const e = typeof window.collectAiHookFromPreview === "function" ? window.collectAiHookFromPreview() : null;
      if (e?.present && e.text) {
        i.ai_hook_text = e.text;
        i.subtitle_text = e.text;
        i.clear_ai_hook = false;
        if (e.style) i.ai_hook_style = e.style;
      } else {
        const e = document.querySelector('#templateVideoPreview .overlay-text-block[data-ai-hook="1"]');
        if (!e) {
          i.ai_hook_text = "";
          i.subtitle_text = "";
          i.clear_ai_hook = true;
        }
      }
    } catch (e) {}
    const r = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/splitscreen/recompose`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify(i)
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw this._libraryApplyError(e, r.status, "Recompose failed");
    }
    const o = await r.json().catch(() => ({}));
    this._librarySplitscreenDirty = false;
    try {
      await this.refreshQuotaAfterApply(o);
    } catch (e) {}
  }
  async mountLibraryRankingPreview(e, t) {
    await this._preflightRankingLibraryState(t);
    this.mountLibraryPreviewVideo(e, t, {
      clean: !!this._libraryRankingUseCleanVideo
    });
  }
  async _preflightRankingLibraryState(e) {
    this._libraryRankingUseCleanVideo = false;
    this._libraryRankingOverlayPending = null;
    this._libraryRankingTimelineState = null;
    try {
      const t = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/ranking-edit-state`, {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!t.ok) return;
      const n = await t.json();
      this._libraryCustomizeMeta = {
        can_customize: n.can_customize !== false && n.can_edit !== false,
        customize_expired: Boolean(n.customize_expired),
        customize_expires_at: n.customize_expires_at || null,
        customize_ttl_hours: n.customize_ttl_hours,
        customize_remaining_hours: n.customize_remaining_hours,
        apply_consumes_quota: n.apply_consumes_quota !== false
      };
      const i = Boolean(n.overlay_burned) && !Boolean(n.burn_deferred);
      const r = typeof n.has_clean_master === "boolean" ? n.has_clean_master : Boolean(n.timeline_mode) || !i;
      const o = Boolean(n.can_edit) && !n.customize_expired;
      this._libraryRankingTimelineState = n;
      if (o && (r || !i)) {
        this._libraryRankingUseCleanVideo = r || !i;
        this._libraryRankingOverlayPending = n;
      } else {
        this._libraryRankingEditable = Boolean(n.can_edit) && !n.customize_expired;
        this._libraryRankingNeedsBurn = false;
      }
      this._updateLibraryCustomizeExpiryPill();
    } catch (e) {
      safeLog("Ranking library preflight failed:", e);
    }
  }
  _formatCustomizeExpiryLabel(e) {
    if (!e || e.customize_ttl_hours == null) return "";
    if (e.customize_expired) return "Customization expired — download only";
    const t = e.customize_expires_at ? Date.parse(e.customize_expires_at) : NaN;
    if (!Number.isFinite(t)) {
      const t = Number(e.customize_remaining_hours);
      if (Number.isFinite(t) && t > 0) {
        if (t >= 24) return `Customize expires in ${Math.ceil(t / 24)}d`;
        return `Customize expires in ${Math.ceil(t)}h`;
      }
      return "";
    }
    const n = t - Date.now();
    if (n <= 0) return "Customization expired — download only";
    const i = Math.ceil(n / 6e4);
    if (i >= 24 * 60) return `Customize expires in ${Math.ceil(i / (24 * 60))}d`;
    if (i >= 60) return `Customize expires in ${Math.ceil(i / 60)}h`;
    return `Customize expires in ${i}m`;
  }
  _updateLibraryCustomizeExpiryPill() {
    const e = document.getElementById("libraryCustomizeExpiryPill");
    if (!e) return;
    if (this._customizeExpiryTimer) {
      clearInterval(this._customizeExpiryTimer);
      this._customizeExpiryTimer = null;
    }
    const t = Boolean(this.currentTemplateForPreview?.isLibraryPreview);
    const n = this._libraryCustomizeMeta;
    if (!t || !n || n.customize_ttl_hours == null) {
      e.hidden = true;
      e.textContent = "";
      return;
    }
    const i = this._formatCustomizeExpiryLabel(n);
    if (!i) {
      e.hidden = true;
      return;
    }
    e.hidden = false;
    e.textContent = i;
    e.classList.toggle("is-expired", Boolean(n.customize_expired));
    if (!n.customize_expired && n.customize_expires_at) {
      this._customizeExpiryTimer = setInterval(() => {
        if (!this.libraryPreviewModalOpen) {
          clearInterval(this._customizeExpiryTimer);
          this._customizeExpiryTimer = null;
          return;
        }
        const t = this._formatCustomizeExpiryLabel(this._libraryCustomizeMeta);
        if (!t || t.includes("expired")) {
          e.textContent = t || "Customization expired — download only";
          e.classList.add("is-expired");
          clearInterval(this._customizeExpiryTimer);
          this._customizeExpiryTimer = null;
          return;
        }
        e.textContent = t;
      }, 3e4);
    }
  }
  mountLibraryPreviewVideo(e, t, n = {}) {
    if (this._libraryPreviewFetchController) {
      this._libraryPreviewFetchController.abort();
      this._libraryPreviewFetchController = null;
    }
    if (this._libraryPreviewObjectUrl) {
      URL.revokeObjectURL(this._libraryPreviewObjectUrl);
      this._libraryPreviewObjectUrl = null;
    }
    const i = ++this._libraryPreviewLoadGen;
    this._libraryPreviewProjectId = t;
    this.fetchSecureLibraryPreviewBlob(e, t, null, {
      loadGen: i,
      attempt: 0,
      clean: !!n.clean
    });
  }
  async maybeMountLibraryRankingOverlay(e, t) {
    if (!e || !t) return;
    if (this._librarySplitscreenCustomize) return;
    if (this._libraryRankingOverlayPending) {
      const t = this._libraryRankingOverlayPending;
      this._libraryRankingOverlayPending = null;
      if (t.customize_expired) {
        this._updateLibraryCustomizeExpiryPill();
        return;
      }
      if (t.can_edit) {
        this.mountLibraryRankingOverlay(e, t);
      }
      return;
    }
    try {
      const n = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(t)}/ranking-edit-state`, {
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!n.ok) return;
      const i = await n.json();
      this._libraryCustomizeMeta = {
        can_customize: i.can_customize !== false && i.can_edit !== false,
        customize_expired: Boolean(i.customize_expired),
        customize_expires_at: i.customize_expires_at || null,
        customize_ttl_hours: i.customize_ttl_hours,
        customize_remaining_hours: i.customize_remaining_hours,
        apply_consumes_quota: i.apply_consumes_quota !== false
      };
      const r = Boolean(i.overlay_burned) && !Boolean(i.burn_deferred);
      const o = typeof i.has_clean_master === "boolean" ? i.has_clean_master : Boolean(i.timeline_mode) || !r;
      const s = Boolean(i.can_edit) && !i.customize_expired;
      if (!s || r && !o) {
        this._libraryRankingEditable = Boolean(i.can_edit) && !i.customize_expired;
        this._libraryRankingNeedsBurn = false;
        this._updateLibraryCustomizeExpiryPill();
        return;
      }
      this._libraryRankingUseCleanVideo = o || !r;
      this._libraryRankingTimelineState = i;
      this.mountLibraryRankingOverlay(e, i);
      this._updateLibraryCustomizeExpiryPill();
    } catch (e) {
      safeLog("Ranking edit state failed:", e);
    }
  }
  mountLibraryRankingOverlay(e, t) {
    if (!e) return;
    if (e.querySelector(".ranking-preview-container.library-ranking-layer")) return;
    const n = this.generateTemplatePreviewHTML({
      id: "ranked_compilation",
      type: "ranked_compilation"
    });
    const i = document.createElement("div");
    i.innerHTML = n;
    const r = i.querySelector(".ranking-preview-container");
    if (!r) return;
    r.classList.add("library-ranking-layer");
    e.appendChild(r);
    const o = i.querySelector("style");
    if (o) {
      o.setAttribute("data-ranking-library", "1");
      const t = e.querySelector("style[data-ranking-library]");
      if (t) t.replaceWith(o); else e.appendChild(o);
    }
    e.classList.add("library-ranking-edit");
    const s = e.querySelector("video.library-preview-video");
    if (s) {
      s.controls = false;
      s.style.pointerEvents = "none";
    }
    this._libraryRankingEditable = true;
    this._libraryRankingDirty = false;
    this._libraryRankingNeedsBurn = Boolean(t.burn_deferred || !t.overlay_burned || t.captions_deferred && t.subtitles_enabled);
    this._libraryRankingChannel = t.channel_name || t.overlay_subject || "CHANNEL";
    this._libraryRankingBaseDurations = t.base_durations || {};
    this._libraryRankingMoments = Array.isArray(t.moments) ? t.moments : [];
    this._libraryRankingCaptionStyle = t.caption_style || null;
    this._libraryRankingSubtitlesOn = Boolean(t.subtitles_enabled);
    const a = Array.isArray(t.clip_order) && t.clip_order.length >= 3 ? t.clip_order.map(e => Math.max(1, Math.min(5, Number(e) || 0))).filter(Boolean) : [ 5, 4, 3, 2, 1 ];
    this._libraryRankingClipOrder = a.slice();
    this._libraryRankingClipOrderPrev = a.slice();
    this._libraryRankingTitleByPhysical = {};
    (this._libraryRankingMoments || []).forEach(e => {
      const t = Number(e?.rank);
      if (t >= 1 && t <= 5 && e?.title) {
        this._libraryRankingTitleByPhysical[t] = String(e.title).trim();
      }
    });
    try {
      PreviewTimeline.setClipOrder?.(a);
    } catch (e) {}
    const l = document.getElementById("previewEditorPill")?.querySelector('[data-tool="text"]');
    if (l) l.style.display = "none";
    if (typeof window.activatePreviewToolbar === "function") {
      const e = document.getElementById("previewEditorPill")?.querySelector('[data-tool="captions"]');
      if (e) window.activatePreviewToolbar(e);
    }
    const c = t.ranking_customizations || {};
    const d = t.ai_text_pack && typeof t.ai_text_pack === "object" ? t.ai_text_pack : {};
    const mergePackContent = (e, t) => {
      const n = String(t || "").trim();
      if (!n) return;
      const i = c[e] && typeof c[e] === "object" ? {
        ...c[e]
      } : {};
      const r = String(i.content || "").trim();
      const o = !r || /^(ranking|best|funniest|channel moments)$/i.test(r);
      if (o) {
        i.content = n;
        c[e] = i;
      }
    };
    mergePackContent("title_ranking", d.header_line1);
    mergePackContent("title_funniest", d.header_line2);
    mergePackContent("title_channel", d.header_line3);
    if (Array.isArray(d.moments)) {
      d.moments.forEach(e => {
        const t = Number(e?.rank);
        if (t >= 1 && t <= 5) {
          mergePackContent(`rank_${t}_title`, e.title || e.text);
        }
      });
    }
    if (window.rankingCustomizer) {
      window.rankingCustomizer.customizations = JSON.parse(JSON.stringify(c));
      setTimeout(() => {
        try {
          if (typeof window.initializeRankingTemplateEditor === "function") {
            window.initializeRankingTemplateEditor();
          }
          window.rankingCustomizer.applyCustomizations();
          this.seedLibraryRankingAiTexts(e, t, c);
          window.rankingCustomizer.applyCustomizations();
        } catch (e) {
          safeLog("Library ranking customizer init failed:", e);
        }
      }, 40);
    } else {
      setTimeout(() => {
        try {
          this.seedLibraryRankingAiTexts(e, t, c);
        } catch (e) {}
      }, 40);
    }
    this.seedLibraryRankingTimelineSplits(t);
    try {
      const e = document.getElementById("previewTimelineShell");
      if (e) {
        e.classList.add("is-ranking-edit", "handles-on");
      }
      if (typeof PreviewTimeline !== "undefined") {
        if (typeof PreviewTimeline.setRankingEditMode === "function") {
          PreviewTimeline.setRankingEditMode(true);
        }
        if (typeof PreviewTimeline.setHandlesUnlocked === "function") {
          PreviewTimeline.setHandlesUnlocked(true);
        }
        if (typeof PreviewTimeline.scheduleFilmstripBuild === "function") {
          PreviewTimeline.scheduleFilmstripBuild(120);
          PreviewTimeline.scheduleFilmstripBuild(700);
          PreviewTimeline.scheduleFilmstripBuild(1600);
        } else if (typeof PreviewTimeline.rebuild === "function") {
          PreviewTimeline.rebuild();
        }
      }
    } catch (e) {}
    const p = document.querySelector('#previewEditorPill [data-tool="captions"]');
    if (p) p.style.display = "";
    try {
      if (this._libraryRankingSubtitlesOn && this._libraryRankingNeedsBurn) {
        const e = this._libraryRankingCaptionStyle || {
          anim: "karaoke",
          font: "Montserrat",
          color: "#ffffff",
          shadow: "outline",
          font_size: 68,
          font_size_ratio: 68 / 1920,
          y_pct: .78,
          enabled: true
        };
        const n = String(t.caption_preview_text || (typeof e.preview_text === "string" ? e.preview_text : "") || "").trim();
        if (typeof window.setLiveCaptionTimedWords === "function") {
          window.setLiveCaptionTimedWords(t.caption_preview_words || []);
        }
        if (typeof window.applySubtitleStyle === "function") {
          window.applySubtitleStyle(e, {
            selectAfter: false,
            applyFill: true,
            playAnim: true,
            softClamp: true,
            previewText: n || null
          });
        }
        requestAnimationFrame(() => {
          if (typeof window.ensureSubtitleAnimPreview === "function") {
            window.ensureSubtitleAnimPreview();
          }
          const e = document.getElementById("templateVideoPreview");
          const t = e?.querySelector(".sub-text-block:not(.overlay-text-block)");
          if (t && typeof window.markSubtitleSuggest === "function") {
            window.markSubtitleSuggest(t);
          }
        });
      }
    } catch (e) {
      safeLog("Library ranking caption seed skipped:", e);
    }
    const markDirty = () => {
      if (!this.currentTemplateForPreview?.isLibraryPreview) return;
      if (!this._libraryRankingEditable) return;
      this._libraryRankingDirty = true;
      const e = document.getElementById("confirmUseTemplateBtn");
      if (e) {
        e.textContent = "Apply & Download";
        e.classList.add("library-download-mode");
      }
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
    };
    e.addEventListener("input", markDirty, true);
    e.addEventListener("mouseup", () => {
      if (!this._libraryRankingEditable) return;
      if (window.rankingCustomizer && typeof window.rankingCustomizer.syncFromDOM === "function") {
        try {
          const e = JSON.stringify(window.rankingCustomizer.customizations || {});
          window.rankingCustomizer.syncFromDOM();
          const t = JSON.stringify(window.rankingCustomizer.customizations || {});
          if (e !== t) markDirty();
        } catch (e) {}
      }
    }, true);
    const u = document.getElementById("previewTimelineShell");
    if (u && !u.dataset.rankingBound) {
      u.dataset.rankingBound = "1";
      u.addEventListener("pointerup", () => {
        if (!this._libraryRankingEditable) return;
        if (typeof PreviewTimeline !== "undefined" && PreviewTimeline._rankingTouched) {
          markDirty();
          PreviewTimeline._rankingTouched = false;
        }
      });
    }
  }
  seedLibraryRankingAiTexts(e, t, n) {
    if (!e) return;
    const i = e.querySelector?.(".ranking-preview-container") || e;
    const r = t && t.ai_text_pack && typeof t.ai_text_pack === "object" ? t.ai_text_pack : {};
    const o = n && typeof n === "object" ? n : {};
    const s = Array.isArray(t?.moments) ? t.moments : this._libraryRankingMoments || [];
    const a = Array.isArray(r.moments) ? r.moments : [];
    const byRank = (e = []) => {
      const t = new Map;
      e.forEach(e => {
        const n = Number(e?.rank);
        if (n >= 1 && n <= 5 && !t.has(n)) t.set(n, e);
      });
      return t;
    };
    const l = byRank(a);
    const c = byRank(s);
    const normalizeOverlayText = (e, t = 80) => String(e || "").replace(/\s+/g, " ").trim().slice(0, t);
    const isClassicPlaceholder = e => {
      const t = String(e || "").replace(/\s+/g, " ").trim();
      if (!t) return true;
      if (/^add title/i.test(t)) return true;
      if (t === "…" || t === "...") return true;
      if (/^(ranking|best|funniest)$/i.test(t)) return true;
      if (/^channel(\s+moments?)?$/i.test(t)) return true;
      if (/^.+\s+moments$/i.test(t) && t.length <= 24) {
        return false;
      }
      return false;
    };
    const setHeaderText = (e, t, {force: n = false} = {}) => {
      const r = i.querySelector(`[data-template-element-id="${e}"]`);
      if (!r) return;
      const s = o[e]?.content;
      const a = s != null ? String(s).trim() : "";
      const l = normalizeOverlayText(t, e.startsWith("title_") ? 32 : 48);
      const c = a && !isClassicPlaceholder(a) && !n;
      const d = c ? normalizeOverlayText(a, e.startsWith("title_") ? 32 : 48) : l;
      if (!d) return;
      r.textContent = d;
      r.classList.remove("rk-title-empty");
      r.removeAttribute("data-placeholder");
      if (window.rankingCustomizer?.customizations) {
        window.rankingCustomizer.customizations[e] = {
          ...window.rankingCustomizer.customizations[e] || {},
          content: d
        };
      }
    };
    const d = String(r.header_line1 || "").trim();
    const p = String(r.header_line2 || "").trim();
    const u = String(r.header_line3 || "").trim();
    if (d) setHeaderText("title_ranking", d); else setHeaderText("title_ranking", "RANKING");
    if (p) setHeaderText("title_funniest", p); else setHeaderText("title_funniest", "BEST");
    const m = String(u || this._libraryRankingChannel || t?.channel_name || t?.overlay_subject || "CHANNEL").toUpperCase();
    const f = m.includes("MOMENT") ? m : `${m.replace(/\s+MOMENTS?$/i, "")} MOMENTS`.replace(/\s+/g, " ").trim();
    setHeaderText("title_channel", u ? f : f, {
      force: !!u
    });
    const y = {};
    for (let e = 1; e <= 5; e++) {
      const t = l.get(e);
      const n = c.get(e);
      const r = String(window.rankingCustomizer?.customizations?.[`rank_${e}_title`]?.content || "").trim();
      const s = r || String(o[`rank_${e}_title`]?.content || "").trim();
      const a = s && !isClassicPlaceholder(s) ? s : "";
      const d = normalizeOverlayText(a || t?.title || t?.text || n?.title || n?.text || "", 48);
      y[e] = d;
      if (d && window.rankingCustomizer?.customizations) {
        const t = {
          ...window.rankingCustomizer.customizations[`rank_${e}_title`] || {},
          content: d
        };
        window.rankingCustomizer.customizations[`rank_${e}_title`] = t;
      }
      const p = i.querySelector(`[data-template-element-id="rank_${e}_title"]`);
      if (p) {
        p.setAttribute("data-rk-full-title", d || "");
        if (d) {
          p.textContent = d;
          p.classList.remove("rk-title-empty");
          p.removeAttribute("data-placeholder");
        } else {
          p.textContent = "";
          p.classList.add("rk-title-empty");
          p.setAttribute("data-placeholder", "Add title…");
        }
      }
    }
    this._libraryRankingTitleByRank = y;
    this._libraryRankingRevealState = t;
    try {
      this.unifyLibraryRankingFonts(i);
    } catch (e) {}
    this.wireLibraryRankingCountdownReveal(e, t);
  }
  unifyLibraryRankingFonts(e) {
    if (!e) return;
    const t = window.rankingCustomizer?.customizations || {};
    const n = (() => {
      try {
        return window.rankingCustomizer?._readFontLock?.() || JSON.parse(sessionStorage.getItem("solisRankingFontLock") || "{}") || {};
      } catch (e) {
        return {};
      }
    })();
    let i = null;
    for (let r = 1; r <= 5; r++) {
      const o = e.querySelector(`[data-template-element-id="rank_${r}_title"]`)?.getAttribute("data-rk-font");
      const s = n[`rank_${r}_title`] || n[`rank_${r}_number`];
      const a = t[`rank_${r}_title`]?.font || t[`rank_${r}_number`]?.font || s;
      if (o) {
        i = o;
        break;
      }
      if (a && window.rankingCustomizer?._displayFont) {
        i = window.rankingCustomizer._displayFont(a);
        break;
      }
      if (typeof a === "string" && a && !/\.ttf|\.otf|\.woff/i.test(a)) {
        i = a;
        break;
      }
    }
    if (!i) {
      return;
    }
    const r = i === "Luckiest Guy" ? `'Luckiest Guy', cursive` : `'${i}', sans-serif`;
    const o = {
      Fredoka: "700",
      Montserrat: "700",
      "Bebas Neue": "400",
      Anton: "400",
      "Luckiest Guy": "400",
      Poppins: "600",
      Roboto: "700"
    };
    const s = o[i] || "400";
    for (let t = 1; t <= 5; t++) {
      for (const n of [ "title", "number" ]) {
        const o = `rank_${t}_${n}`;
        const a = e.querySelector(`[data-template-element-id="${o}"]`);
        if (!a) continue;
        a.style.setProperty("font-family", r, "important");
        a.style.setProperty("font-weight", s, "important");
        a.setAttribute("data-rk-font", i);
        if (window.rankingCustomizer?.setElementFontFile) {
          window.rankingCustomizer.setElementFontFile(o, i);
        }
      }
    }
  }
  wireLibraryRankingCountdownReveal(e, t) {
    if (!e) return;
    const n = e.querySelector?.(".ranking-preview-container") || e;
    const i = e.querySelector("video.library-preview-video") || e.querySelector("video");
    if (!i || !n) return;
    const r = (() => {
      const e = t?.ranking_timeline?.segments;
      if (Array.isArray(e) && e.length) {
        return e.slice().sort((e, t) => Number(e?.output_start || 0) - Number(t?.output_start || 0)).map(e => ({
          rank: Number(e.rank),
          start: Number(e.output_start) || 0,
          end: Number(e.output_end) || 0
        })).filter(e => e.rank >= 1 && e.rank <= 5 && e.end > e.start);
      }
      const n = [];
      const i = t?.clip_windows;
      const r = t?.base_durations || this._libraryRankingBaseDurations || {};
      for (let e = 5; e >= 1; e--) {
        let t = 0;
        const o = i?.[String(e)] || i?.[e];
        if (o) {
          t = Number(o.duration);
          if (!(t > 0) && o.start != null && o.end != null) {
            t = Number(o.end) - Number(o.start);
          }
        }
        if (!(t > 0)) t = Number(r[String(e)] || r[e] || 0);
        if (t > 0) n.push({
          rank: e,
          duration: t
        });
      }
      let o = 0;
      return n.map(({rank: e, duration: t}) => {
        const n = o;
        o += t;
        return {
          rank: e,
          start: n,
          end: o
        };
      });
    })();
    if (!r.length) return;
    const o = this._libraryRankingTitleByRank || {};
    let s = null;
    const paintTitle = (e, t) => {
      if (e.classList.contains("rk-inline-editing") || e.isContentEditable) return;
      const n = String(e.textContent || "").trim();
      if (n && !/^add title/i.test(n)) {
        e.setAttribute("data-rk-full-title", n);
        if (this._libraryRankingTitleByRank) {
          this._libraryRankingTitleByRank[t] = n;
        }
        if (window.rankingCustomizer?.customizations) {
          window.rankingCustomizer.customizations[`rank_${t}_title`] = {
            ...window.rankingCustomizer.customizations[`rank_${t}_title`] || {},
            content: n
          };
        }
      }
      const i = e.getAttribute("data-rk-full-title") || o[t] || n || "";
      if (i && !/^add title/i.test(i)) {
        if (e.textContent !== i) e.textContent = i;
        e.classList.remove("rk-title-empty");
        e.removeAttribute("data-placeholder");
      } else {
        e.textContent = "";
        e.classList.add("rk-title-empty");
        e.setAttribute("data-placeholder", "Add title…");
      }
    };
    const applyReveal = (e = false) => {
      const t = Number(i.currentTime) || 0;
      let o = r[0]?.rank ?? 5;
      for (const e of r) {
        if (t >= e.start - .02 && t < e.end - .02) {
          o = e.rank;
          break;
        }
        if (t >= e.end - .02) o = e.rank;
      }
      if (!e && o === s) return;
      s = o;
      for (let e = 1; e <= 5; e++) {
        const t = n.querySelector(`[data-template-element-id="rank_${e}_title"]`);
        if (!t) continue;
        paintTitle(t, e);
        t.classList.toggle("rk-title-active", e === o);
      }
    };
    if (i._rkRevealCleanup) {
      try {
        i._rkRevealCleanup();
      } catch (e) {}
    }
    const onTick = () => applyReveal(false);
    i.addEventListener("timeupdate", onTick);
    i.addEventListener("seeked", onTick);
    i.addEventListener("play", onTick);
    i._rkRevealCleanup = () => {
      i.removeEventListener("timeupdate", onTick);
      i.removeEventListener("seeked", onTick);
      i.removeEventListener("play", onTick);
      delete i._rkRevealCleanup;
    };
    applyReveal(true);
  }
  seedLibraryRankingTimelineSplits(e) {
    if (typeof PreviewTimeline === "undefined" || !PreviewTimeline.setSplits) return;
    const splitsFromTimeline = () => {
      const t = e?.ranking_timeline?.segments;
      if (!Array.isArray(t) || t.length < 2) return [];
      const n = t.slice().sort((e, t) => Number(e?.output_start || 0) - Number(t?.output_start || 0));
      const i = [];
      for (let e = 0; e < n.length - 1 && i.length < 4; e++) {
        const t = Number(n[e]?.output_end);
        if (Number.isFinite(t) && t > .05) i.push(t);
      }
      return i;
    };
    const t = [];
    const n = Array.isArray(e?.clip_order) && e.clip_order.length >= 3 ? e.clip_order.map(e => Math.max(1, Math.min(5, Number(e) || 0))).filter(Boolean) : [ 5, 4, 3, 2, 1 ];
    const i = e?.clip_windows;
    if (i && typeof i === "object" && !Array.isArray(i)) {
      for (const e of n) {
        const n = i[String(e)] || i[e];
        if (!n) continue;
        let r = Number(n.duration);
        if (!(r > 0) && n.start != null && n.end != null) {
          r = Number(n.end) - Number(n.start);
        }
        if (r > 0) t.push(r);
      }
    }
    if (t.length < 2) {
      const i = e?.base_durations || this._libraryRankingBaseDurations || {};
      const r = (e?.moments || this._libraryRankingMoments || []).slice().sort((e, t) => Number(e.rank || 0) - Number(t.rank || 0));
      for (const e of n) {
        let n = Number(i[String(e)] || i[e] || 0);
        if (!(n > 0)) {
          const t = r.find(t => Number(t.rank) === e);
          if (t) {
            n = Number(t.duration);
            if (!(n > 0) && t.start != null && t.end != null) {
              n = Number(t.end) - Number(t.start);
            }
          }
        }
        if (n > 0) t.push(n);
      }
    }
    const applySeed = () => {
      try {
        if (typeof PreviewTimeline.show === "function") PreviewTimeline.show();
        if (typeof PreviewTimeline.attach === "function") {
          const e = document.querySelector("#templateVideoPreview video") || document.getElementById("previewVideo");
          if (e) PreviewTimeline.attach(e);
        }
        PreviewTimeline.setClipOrder?.(n);
      } catch (e) {}
      const e = splitsFromTimeline();
      if (e.length) {
        PreviewTimeline.setSplits(e);
        return;
      }
      const i = PreviewTimeline.getTrim?.();
      const r = Number(i?.duration) || 0;
      if (!(r > 0) || t.length < 2) {
        if (r > 0) {
          PreviewTimeline.setSplits([ r * .2, r * .4, r * .6, r * .8 ]);
        }
        return;
      }
      const o = t.reduce((e, t) => e + t, 0) || 1;
      const s = r / o;
      const a = [];
      let l = 0;
      for (let e = 0; e < t.length - 1 && a.length < 4; e++) {
        l += t[e] * s;
        if (l > .05 && l < r - .05) a.push(l);
      }
      if (a.length) PreviewTimeline.setSplits(a);
    };
    applySeed();
    setTimeout(applySeed, 250);
    setTimeout(applySeed, 800);
    setTimeout(applySeed, 1600);
    setTimeout(applySeed, 3e3);
  }
  collectLibraryRankingClipWindows() {
    const e = this._libraryRankingBaseDurations || {};
    const t = typeof PreviewTimeline !== "undefined" && PreviewTimeline.getSegmentBounds ? PreviewTimeline.getSegmentBounds() : [];
    if (!t || t.length < 2) return {};
    const n = typeof PreviewTimeline !== "undefined" && PreviewTimeline.getClipOrder ? PreviewTimeline.getClipOrder() : [ 5, 4, 3, 2, 1 ];
    const i = {};
    const r = Math.min(5, t.length - 1);
    for (let o = 0; o < r; o++) {
      const r = n[o] || 5 - o;
      const s = Number(e[String(r)] || e[r] || 0);
      const a = Math.max(1.5, Number(t[o + 1]) - Number(t[o]));
      if (!(s > 0)) {
        i[String(r)] = {
          start: 0,
          end: a
        };
        continue;
      }
      if (a >= s - .08) {
        i[String(r)] = {
          start: 0,
          end: s
        };
      } else {
        const e = Math.max(0, (s - a) / 2);
        i[String(r)] = {
          start: e,
          end: e + a
        };
      }
    }
    return i;
  }
  onRankingClipReorder(e) {
    if (!Array.isArray(e) || !e.length) return;
    this._libraryRankingClipOrder = e.slice();
    const t = document.querySelector("#templateVideoPreview .ranking-preview-container, .ranking-preview-container");
    if (!t) return;
    const n = this._libraryRankingClipOrderPrev || [ 5, 4, 3, 2, 1 ];
    const i = {};
    for (let e = 0; e < 5; e++) {
      const r = 5 - e;
      const o = n[e] || r;
      const s = t.querySelector(`[data-template-element-id="rank_${r}_title"]`);
      const a = (s?.getAttribute("data-rk-full-title") || s?.textContent || this._libraryRankingTitleByRank?.[r] || "").trim();
      i[o] = a;
      if (this._libraryRankingTitleByPhysical == null) this._libraryRankingTitleByPhysical = {};
      if (a) this._libraryRankingTitleByPhysical[o] = a;
    }
    const r = {
      ...this._libraryRankingTitleByPhysical || {},
      ...i
    };
    for (let n = 0; n < e.length; n++) {
      const i = 5 - n;
      const o = e[n];
      const s = r[o] || "";
      const a = t.querySelector(`[data-template-element-id="rank_${i}_title"]`);
      if (a) {
        if (s && !/^add title/i.test(s)) {
          a.textContent = s;
          a.setAttribute("data-rk-full-title", s);
          a.classList.remove("rk-title-empty");
          a.removeAttribute("data-placeholder");
        }
      }
      if (this._libraryRankingTitleByRank) {
        this._libraryRankingTitleByRank[i] = s;
      }
      if (window.rankingCustomizer?.customizations) {
        const e = `rank_${i}_title`;
        window.rankingCustomizer.customizations[e] = {
          ...window.rankingCustomizer.customizations[e] || {},
          content: s
        };
      }
    }
    this._libraryRankingClipOrderPrev = e.slice();
    this._libraryRankingDirty = true;
  }
  async saveLibraryRankingCustomizations(e) {
    try {
      const e = document.querySelector("#templateVideoPreview .ranking-preview-container");
      if (e && window.rankingCustomizer) {
        if (!window.rankingCustomizer.customizations) {
          window.rankingCustomizer.customizations = {};
        }
        for (let t = 1; t <= 5; t++) {
          const n = e.querySelector(`[data-template-element-id="rank_${t}_title"]`);
          const i = n?.getAttribute("data-rk-full-title") || this._libraryRankingTitleByRank?.[t] || "";
          if (i) {
            window.rankingCustomizer.customizations[`rank_${t}_title`] = {
              ...window.rankingCustomizer.customizations[`rank_${t}_title`] || {},
              content: String(i).trim()
            };
          }
        }
        if (window.__solisRankingLayout) {
          window.rankingCustomizer.customizations.__ranking_layout = {
            ...window.rankingCustomizer.customizations.__ranking_layout || {},
            ...window.__solisRankingLayout
          };
        }
      }
    } catch (e) {}
    if (window.rankingCustomizer?.syncFromDOM) {
      try {
        window.rankingCustomizer.syncFromDOM();
      } catch (e) {}
    }
    const t = window.rankingCustomizer?.collectCustomizations?.() || {};
    const n = this.collectLibraryRankingClipWindows();
    const i = typeof PreviewTimeline !== "undefined" && PreviewTimeline.getClipOrder ? PreviewTimeline.getClipOrder() : this._libraryRankingClipOrder || null;
    let r = null;
    try {
      if (typeof window.collectSubtitleStyle === "function") {
        r = window.collectSubtitleStyle();
      }
    } catch (e) {}
    if (!r) {
      r = this._libraryRankingCaptionStyle || window.__solisLastCaptionStyle || null;
    }
    const o = Boolean(this._libraryRankingSubtitlesOn);
    const s = await fetch(`${API_BASE_URL}/clips/projects/${encodeURIComponent(e)}/ranking/recompose`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        ranking_customizations: t,
        channel_name: this._libraryRankingChannel || undefined,
        clip_windows: n,
        clip_order: i || undefined,
        caption_style: r || undefined,
        subtitles_enabled: o
      })
    });
    if (!s.ok) {
      const e = await s.json().catch(() => ({}));
      throw this._libraryApplyError(e, s.status, "Ranking recompose failed");
    }
    const a = await s.json().catch(() => ({}));
    this._libraryRankingDirty = false;
    this._libraryRankingNeedsBurn = false;
    try {
      await this.refreshQuotaAfterApply(a);
    } catch (e) {}
  }
  async refreshQuotaAfterApply(e) {
    try {
      window._subCache?.invalidate?.();
    } catch (e) {}
    try {
      if (typeof loadTierInfo === "function") await loadTierInfo();
    } catch (e) {}
    try {
      if (typeof this.loadAndDisplayStorageInfo === "function") {
        await this.loadAndDisplayStorageInfo();
      }
    } catch (e) {}
    const t = e?.daily;
    if (t && t.used != null && t.limit != null) {
      try {
        showNotification(`Apply counted as 1 generation (${t.used}/${t.limit} today).`, "info");
      } catch (e) {}
    }
  }
  _libraryApplyError(e, t, n) {
    const i = e?.error_code || "";
    if (i === "CUSTOMIZE_EXPIRED") {
      return new Error(e.error || "Customization window expired for this project.");
    }
    if (i === "DAILY_LIMIT_REACHED" || i === "MONTHLY_LIMIT_REACHED" || t === 429) {
      return new Error(e.error || "Applying changes uses 1 daily generation — quota reached. Try again after reset, or upgrade.");
    }
    return new Error(e?.error || `${n} (${t})`);
  }
  async fetchSecureLibraryPreviewBlob(e, t, n = null, i = {}) {
    const r = i.loadGen != null ? i.loadGen : ++this._libraryPreviewLoadGen;
    const o = Math.max(0, Number(i.attempt) || 0);
    const s = 8;
    const a = !!i.clean;
    if (this._libraryPreviewFetchController) {
      this._libraryPreviewFetchController.abort();
      this._libraryPreviewFetchController = null;
    }
    const l = new AbortController;
    this._libraryPreviewFetchController = l;
    const isStale = () => r !== this._libraryPreviewLoadGen || !this.libraryPreviewModalOpen || this._libraryPreviewProjectId && String(this._libraryPreviewProjectId) !== String(t);
    const retrySoon = n => {
      if (isStale()) return;
      if (o + 1 >= s) {
        if (!a && !i.cleanFallbackTried) {
          safeLog("Preview burned path failed — trying clean master");
          this.fetchSecureLibraryPreviewBlob(e, t, null, {
            loadGen: r,
            attempt: 0,
            clean: true,
            cleanFallbackTried: true
          });
          return;
        }
        safeLog("Preview load gave up:", n);
        this._showLibraryPreviewError(e, "Could not load video preview", t);
        return;
      }
      const l = Math.min(2800, 400 + o * 450);
      safeLog(`Preview not ready (${n}) — retry ${o + 1}/${s} in ${l}ms`);
      if (o === 0) {
        this._setLibraryPreviewPlaceholder(e, "Preparing preview...");
      }
      setTimeout(() => {
        if (isStale()) return;
        this.fetchSecureLibraryPreviewBlob(e, t, null, {
          loadGen: r,
          attempt: o + 1,
          clean: a,
          cleanFallbackTried: !!i.cleanFallbackTried
        });
      }, l);
    };
    try {
      const n = this.getLibraryPreviewVideoUrl(t, {
        bust: true,
        clean: a
      });
      if (isStale()) return;
      e.classList.remove("library-ranking-edit", "library-splitscreen-preview");
      this._libraryRankingDirty = false;
      if (!this._libraryRankingOverlayPending) {
        this._libraryRankingEditable = false;
        this._libraryRankingNeedsBurn = false;
      }
      const i = document.createElement("video");
      i.className = "library-preview-video";
      i.controls = false;
      i.removeAttribute("controls");
      i.playsInline = true;
      i.muted = true;
      i.autoplay = true;
      i.preload = "auto";
      i.setAttribute("playsinline", "");
      i.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback noplaybackrate");
      i.disablePictureInPicture = true;
      i.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:2;display:block;visibility:visible;opacity:1;";
      i.removeAttribute("crossorigin");
      e.innerHTML = "";
      e.appendChild(i);
      e.classList.add("has-video");
      let r = false;
      const reveal = () => {
        if (r || isStale()) return;
        const n = i.videoWidth > 0 && i.videoHeight > 0;
        if (!n && i.readyState < 2) return;
        if (!n) return;
        r = true;
        e.classList.add("has-video");
        i.style.setProperty("display", "block", "important");
        i.style.setProperty("visibility", "visible", "important");
        i.style.setProperty("opacity", "1", "important");
        this._hideLibraryPreviewLoading();
        ensurePreviewAudioToggle(e);
        if (typeof PreviewTimeline !== "undefined") {
          PreviewTimeline.attach(i);
        }
        i.play().catch(() => {});
        this.maybeMountLibraryRankingOverlay(e, t).catch(() => {});
        if (this._isCurrentLibraryRanking?.() && this._libraryRankingTimelineState) {
          try {
            this.seedLibraryRankingTimelineSplits(this._libraryRankingTimelineState);
          } catch (e) {}
        }
      };
      i.addEventListener("loadedmetadata", reveal);
      i.addEventListener("loadeddata", reveal);
      i.addEventListener("canplay", reveal);
      i.addEventListener("playing", reveal);
      i.addEventListener("error", () => {
        if (r || isStale()) return;
        retrySoon("video decode error");
      }, {
        once: true
      });
      let o = 0;
      const s = setInterval(() => {
        if (r || isStale()) {
          clearInterval(s);
          return;
        }
        o += 1;
        if (i.videoWidth > 0 && i.readyState >= 1) {
          clearInterval(s);
          reveal();
          return;
        }
        if (o >= 40) clearInterval(s);
      }, 250);
      setTimeout(() => {
        if (!r && !isStale() && i.videoWidth > 0) {
          reveal();
        }
      }, 800);
      setTimeout(() => {
        if (r || isStale()) return;
        retrySoon("video stall");
      }, 7e3);
      i.src = n;
      i.load();
      i.play().catch(() => {});
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (isStale()) return;
      safeLog("Error loading secure preview:", e);
      retrySoon(e?.message || "fetch error");
    } finally {
      if (this._libraryPreviewFetchController === l) {
        this._libraryPreviewFetchController = null;
      }
    }
  }
  async fetchSecureLibraryPreview(e, t) {
    this.mountLibraryPreviewVideo(e, t);
  }
  toggleLibraryPreviewLayout(e) {
    const t = document.getElementById("templateInfoPanel");
    const n = document.getElementById("libraryInfoPanel");
    const i = document.getElementById("previewDurationRow");
    const r = document.getElementById("multiGenCard");
    const o = document.getElementById("previewEditorPill");
    const s = o?.querySelector('[data-tool="text"]');
    const a = this._isCurrentLibraryRanking();
    const visibleToolbarBtns = () => o ? Array.from(o.querySelectorAll(".tool-btn")).filter(e => e.style.display !== "none" && getComputedStyle(e).display !== "none") : [];
    if (i) {
      i.hidden = !e;
      i.style.display = e ? "" : "none";
    }
    if (r) {
      r.hidden = !!e;
      r.style.display = e ? "none" : "";
    }
    if (e) {
      if (t) t.style.display = "";
      if (n) n.style.display = "block";
      if (o) o.style.display = "";
      if (s) s.style.display = a ? "none" : "";
      const e = o?.querySelector('[data-tool="captions"]');
      const i = o?.querySelector('[data-tool="animations"]');
      if (e) e.style.display = "";
      if (i) i.style.display = "";
      if (typeof lucide !== "undefined") {
        lucide.createIcons({
          attrs: {
            "stroke-width": 2
          },
          nameAttr: "data-lucide"
        });
      }
      const r = visibleToolbarBtns();
      if (o) {
        o.querySelectorAll(".tool-btn").forEach(e => e.classList.remove("active"));
      }
      this.attachSocialButtonListeners();
      this._configureLibraryEditingUI();
    } else {
      if (t) t.style.display = "";
      if (n) n.style.display = "none";
      if (o) o.style.display = "";
      if (s) s.style.display = a ? "none" : "";
      const e = visibleToolbarBtns();
      if (o) {
        o.querySelectorAll(".tool-btn").forEach(e => e.classList.remove("active"));
      }
      this._libraryEditingEnabled = false;
      if (typeof PreviewTimeline !== "undefined") {
        PreviewTimeline.detach();
      }
    }
  }
  async _isPrimeOrElitePlan() {
    try {
      const e = await window._subCache.get();
      const t = String(e?.plan_name || e?.plan || "free").toLowerCase();
      return t === "prime" || t === "elite";
    } catch (e) {
      return false;
    }
  }
  _isCurrentLibrarySplitScreen() {
    const e = this.currentTemplateForPreview?.data || {};
    const t = `${e.template || ""} ${e.templateName || ""}`.toLowerCase();
    return t.includes("splitscreen") || t.includes("split screen");
  }
  _isCurrentLibraryRanking() {
    const e = this.currentTemplateForPreview;
    if (!e) return false;
    if (e.id === "ranked_compilation" || e.type === "ranked_compilation" || e.type === "ranking" || e.templateId === "ranked_compilation") {
      return true;
    }
    const t = e.data || {};
    const n = `${e.id || ""} ${e.type || ""} ${e.templateId || ""} ${t.template || ""} ${t.templateName || ""}`.toLowerCase();
    return n.includes("ranked") || n.includes("ranking");
  }
  async _configureLibraryEditingUI() {
    const e = document.getElementById("previewEditorPill");
    const t = document.getElementById("confirmUseTemplateBtn");
    if (!e || !t) return;
    this._libraryEditingEnabled = true;
    if (!this._librarySplitscreenCustomize) {
      this._librarySplitscreenCustomize = this._isCurrentLibrarySplitScreen();
    }
    e.style.display = "";
    const n = e.querySelector('[data-tool="text"]');
    const i = e.querySelector('[data-tool="captions"]');
    const r = e.querySelector('[data-tool="animations"]');
    const o = this._isCurrentLibraryRanking();
    if (n) n.style.display = o ? "none" : "";
    if (i) i.style.display = "";
    if (r) r.style.display = "";
    if (typeof lucide !== "undefined") {
      lucide.createIcons({
        attrs: {
          "stroke-width": 2
        },
        nameAttr: "data-lucide"
      });
    }
    const s = Array.from(e.querySelectorAll(".tool-btn")).filter(e => e.style.display !== "none");
    e.querySelectorAll(".tool-btn").forEach(e => e.classList.remove("active"));
    void s;
    t.textContent = this._librarySplitscreenDirty || this._libraryOverlayDirty || this._libraryRankingDirty ? "Apply & Download" : "Download";
    t.classList.toggle("library-download-mode", true);
  }
  async downloadRenderedLibraryClip(e) {
    const t = `${API_BASE_URL}/clips/render/${encodeURIComponent(e)}`;
    try {
      const n = await fetch(t, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders()
      });
      if (!n.ok) {
        throw new Error(`Render failed (${n.status})`);
      }
      const i = await n.blob();
      if (!i.size) throw new Error("Rendered file is empty");
      const r = URL.createObjectURL(i);
      const o = document.createElement("a");
      o.href = r;
      o.download = `clip_${e}.mp4`;
      o.style.display = "none";
      document.body.appendChild(o);
      o.click();
      document.body.removeChild(o);
      URL.revokeObjectURL(r);
      showNotification("Edited clip download started!", "success");
    } catch (e) {
      showNotification(`Render failed: ${e.message}`, "error");
    }
  }
  attachSocialButtonListeners() {
    const e = document.querySelectorAll(".social-btn");
    e.forEach(e => {
      e.removeEventListener("click", this.handleSocialButtonClick);
      e.addEventListener("click", e => this.handleSocialButtonClick(e));
    });
  }
  handleSocialButtonClick(e) {
    const t = e.currentTarget.getAttribute("data-platform");
    const n = this.currentTemplateForPreview?.projectId;
    if (!n) {
      alert("No project selected");
      return;
    }
    safeLog(`📤 Share to ${t}: ${n}`);
    const i = `Share to ${t.toUpperCase()} coming soon!`;
    alert(i);
  }
  async updateWatermarkToggleState() {
    const e = document.getElementById("watermarkFreeNotice");
    const t = document.getElementById("watermarkPaidSection");
    const n = document.getElementById("watermarkToggle");
    if (!n) return;
    try {
      const i = await window._subCache.get();
      const r = (i?.plan_name || i?.plan || "free").toLowerCase();
      const o = [ "basic", "prime", "elite" ].includes(r);
      if (o) {
        if (t) t.style.display = "block";
        if (e) e.style.display = "none";
        n.disabled = false;
        n.checked = false;
        this.currentTemplateForPreview.addWatermark = false;
      } else {
        if (e) e.style.display = "block";
        if (t) t.style.display = "none";
        this.currentTemplateForPreview.addWatermark = true;
      }
    } catch (n) {
      safeLog("Error checking watermark eligibility:", n);
      if (t) t.style.display = "block";
      if (e) e.style.display = "none";
    }
  }
  handleWatermarkToggle(e) {
    if (!this.currentTemplateForPreview) return;
    const t = document.getElementById("watermarkToggle");
    const n = t.checked;
    this.currentTemplateForPreview.addWatermark = n;
  }
  async confirmTemplateUse() {
    const e = document.getElementById("confirmUseTemplateBtn");
    if (e?.dataset.applying === "1") return;
    if (!this.currentTemplateForPreview) {
      console.warn("No template selected");
      showNotification("Please select a template", "error");
      return;
    }
    try {
      const e = document.querySelector("#templateVideoPreview .overlay-text-block.overlay-editing .sub-text-inner");
      if (e) e.blur();
    } catch (e) {}
    const t = this.currentTemplateForPreview.id;
    const n = this.currentTemplateForPreview.isLibraryPreview || false;
    const i = this.currentTemplateForPreview.projectId;
    const r = this.templates[t];
    safeLog("ðŸ” confirmTemplateUse:", {
      templateId: t,
      isLibraryPreview: n,
      projectId: i,
      availableTemplates: Object.keys(this.templates),
      foundTemplate: !!r,
      cachedData: this.currentTemplateForPreview.data
    });
    if (n && i) {
      safeLog(`📥 Library mode: Downloading clip ${i}`);
      const t = Boolean(this._libraryHookCleared);
      const n = Boolean(this._libraryCaptionsCleared);
      const r = Boolean(this._librarySplitscreenCustomize && (this._librarySplitscreenDirty || t || n));
      const o = typeof window.collectLibraryOverlayTexts === "function" ? window.collectLibraryOverlayTexts() : [];
      const s = Boolean(this._libraryOverlayDirty);
      const a = Boolean(this._libraryRankingEditable && (this._libraryRankingDirty || this._libraryRankingNeedsBurn));
      if (e) {
        e.dataset.applying = "1";
        e.disabled = true;
        e.dataset.prevLabel = e.textContent || "";
        e.textContent = r || s || a ? "Applying…" : "Downloading…";
      }
      try {
        if (r || s || a) {
          if (s && !o.length && !a && !r) {
            throw new Error("Type some text on the preview first (not just “Text”)");
          }
          const e = this._libraryCustomizeMeta || {};
          if (e.customize_expired) {
            throw new Error("Customization window expired for this project. Download the last render, or generate a new clip.");
          }
          if (e.apply_consumes_quota !== false) {
            try {
              showNotification("Applying changes uses 1 daily generation.", "info");
            } catch (e) {}
          }
          await this.runLibraryApplyWithSpinner(i, {
            needsRecompose: r,
            needsOverlayRender: s,
            needsRankingRecompose: a,
            overlays: o
          });
          this.closeTemplatePreviewModal();
        } else {
          this.closeTemplatePreviewModal();
          await this.downloadClip(i);
        }
      } catch (t) {
        showNotification(`Save failed: ${t.message}`, "error");
        if (e) {
          e.disabled = false;
          e.dataset.applying = "0";
          e.textContent = e.dataset.prevLabel || "Apply & Download";
        }
      }
      return;
    }
    if (!r && !this.currentTemplateForPreview.data) {
      safeLog("âŒ Template not found:", t, "Available:", Object.keys(this.templates));
      showNotification(`Template "${t}" not found. Available: ${Object.keys(this.templates).join(", ")}`, "error");
      return;
    }
    const o = document.getElementById("aiPromptInput")?.value.trim() || "";
    this.currentAIPrompt = o;
    try {
      const e = localStorage.getItem("watermarkEnabled") === "true";
      fetch(`${window.API_BASE_URL}/user/settings/watermark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          watermarkEnabled: e
        })
      }).catch(() => {});
    } catch (e) {}
    const s = document.getElementById("youtubeUrlInput")?.value.trim();
    try {
      window.__solisPendingGenerateCaptions = typeof window.flushCaptionsForGenerate === "function" ? window.flushCaptionsForGenerate(t) : typeof window.collectSubtitleStyle === "function" ? window.collectSubtitleStyle() : null;
      if (window.__solisPendingGenerateCaptions) {
        window.__solisCaptionsOptedIn = true;
        window.__solisCaptionsClearedForGenerate = false;
      }
    } catch (e) {
      window.__solisPendingGenerateCaptions = null;
    }
    try {
      window.__solisPendingGenerateHook = typeof window.collectAiHookFromPreview === "function" ? window.collectAiHookFromPreview() : null;
    } catch (e) {
      window.__solisPendingGenerateHook = null;
    }
    try {
      if (t === "ranked_compilation" && window.rankingCustomizer) {
        let e = null;
        try {
          if (typeof window.rankingCustomizer.flushRankingStylesForGenerate === "function") {
            e = window.rankingCustomizer.flushRankingStylesForGenerate();
          } else if (typeof window.rankingCustomizer.captureGenerateLock === "function") {
            try {
              document.querySelectorAll("#templateVideoPreview .rk-inline-editing").forEach(e => {
                try {
                  e.blur();
                } catch (e) {}
              });
            } catch (e) {}
            e = window.rankingCustomizer.captureGenerateLock();
          } else if (typeof window.rankingCustomizer.collectCustomizations === "function") {
            e = window.rankingCustomizer.collectCustomizations();
          }
        } catch (t) {
          safeLog("[RankingStyles] capture failed:", t?.message || t);
          e = null;
        }
        const t = window.rankingCustomizer.countFonts?.(e) || 0;
        if (!e || !Object.keys(e).length || t === 0) {
          try {
            const t = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
            const n = window.rankingCustomizer.countFonts?.(t) || 0;
            if (n > 0) {
              e = {
                ...t || {},
                ...e || {}
              };
              Object.entries(t).forEach(([t, n]) => {
                if (!n || typeof n !== "object") return;
                if (!e[t]) e[t] = {
                  ...n
                }; else if (n.font && !e[t].font) e[t].font = n.font;
              });
              safeLog("[RankingStyles] Recovered fonts from prior style lock:", n);
            }
          } catch (e) {}
        }
        e = e || {};
        window.__solisPendingGenerateRankingCustoms = e;
        window.__solisRankingStyleLock = e;
        try {
          sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(e));
          if ((window.rankingCustomizer.countFonts?.(e) || 0) > 0) {
            sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(e));
          }
        } catch (e) {}
        try {
          const t = Object.entries(e).filter(([e, t]) => e !== "__ranking_layout" && t && t.font).map(([e, t]) => `${e}:${t.font}`);
          const n = Object.entries(e).filter(([e, t]) => e !== "__ranking_layout" && t && t.font_size).map(([e, t]) => `${e}:${t.font_size}`);
          safeLog("[RankingStyles] LOCK fonts:", t.slice(0, 14));
          safeLog("[RankingStyles] LOCK sizes:", n.slice(0, 14));
          if (!t.length) {
            safeLog("[RankingStyles] WARNING: style lock has no fonts — burn may look default");
          }
        } catch (e) {}
      } else {
        window.__solisPendingGenerateRankingCustoms = null;
        window.__solisRankingStyleLock = null;
      }
    } catch (e) {
      window.__solisPendingGenerateRankingCustoms = null;
      window.__solisRankingStyleLock = null;
    }
    if (!s) {
      this.closeTemplatePreviewModal();
      this._armTemplateThenUrlFlow(t);
      return;
    }
    if (!this.isValidMediaUrl(s)) {
      showNotification("Enter a valid YouTube, YouTube Shorts, TikTok, or Instagram Reels URL", "error");
      this.closeTemplatePreviewModal();
      this._armTemplateThenUrlFlow(t);
      return;
    }
    this.closeTemplatePreviewModal();
    this.selectedTemplate = t;
    this.startClipProcessingWithSlots(s, t);
  }
  _armTemplateThenUrlFlow(e) {
    this.selectedTemplate = e;
    this._awaitingUrlForTemplate = true;
    document.querySelectorAll(".template-card").forEach(t => {
      t.classList.toggle("selected", t.dataset.template === e);
    });
    this.switchTab("create");
    const t = document.getElementById("youtubeUrlInput");
    const n = document.getElementById("processUrlBtn");
    const i = document.getElementById("urlInputStack") || document.querySelector(".url-input-container");
    if (i) {
      i.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
    if (t) {
      t.focus({
        preventScroll: true
      });
      try {
        t.select();
      } catch (e) {}
    }
    if (n) {
      n.classList.add("needs-url-pulse");
      clearTimeout(this._urlPulseTimer);
      this._urlPulseTimer = setTimeout(() => {
        n.classList.remove("needs-url-pulse");
      }, 4200);
    }
  }
  showSlotSystemInfo() {
    let e = document.getElementById("slotSystemInfo");
    if (!e) {
      e = document.createElement("div");
      e.id = "slotSystemInfo";
      e.className = "slot-system-info";
      const t = document.getElementById("templatesSection");
      if (t) {
        t.appendChild(e);
      }
    }
    e.innerHTML = `\n            <div class="slot-system-card">\n                <div class="slot-system-icon">\n                    <i class="fas fa-layer-group"></i>\n                </div>\n                <div class="slot-system-content">\n                    <h4>Slot System Active</h4>\n                    <p>This template uses the dynamic 1-5 slot system. New clips will fill from slot 5 upward.</p>\n                    <div class="slot-visualization">\n                        <div class="slot-row">\n                            <div class="slot-visual" data-slot="1">1</div>\n                            <div class="slot-visual" data-slot="2">2</div>\n                            <div class="slot-visual" data-slot="3">3</div>\n                            <div class="slot-visual" data-slot="4">4</div>\n                            <div class="slot-visual" data-slot="5">5</div>\n                        </div>\n                        <div class="slot-labels">\n                            <span>New clips start here →</span>\n                        </div>\n                    </div>\n                </div>\n            </div>\n        `;
  }
  showConfirmationButtons(e) {
    const t = document.getElementById("confirmTemplateBtn");
    const n = document.getElementById("cancelTemplateBtn");
    if (t && n) {
      if (e) {
        t.style.display = "flex";
        n.style.display = "flex";
      } else {
        t.style.display = "none";
        n.style.display = "none";
      }
    }
  }
  async confirmTemplateSelection() {
    if (!this.selectedTemplate) {
      showNotification("Please select a template first", "error");
      return;
    }
    const e = document.getElementById("youtubeUrlInput")?.value.trim();
    if (!e) {
      showNotification("Please enter a YouTube URL first", "error");
      return;
    }
    if (this._pendingDurationCheck) {
      showNotification("Finishing video length check…", "info");
      const e = await this._pendingDurationCheck;
      this._pendingDurationCheck = null;
      if (!e.allowed) {
        return;
      }
      this._rememberVideoDuration(e);
    }
    this.showTemplateConfirmation(this.selectedTemplate, e);
  }
  showTemplateConfirmation(e, t) {
    const n = this.templates[e];
    if (!n) {
      showNotification("Template not found", "error");
      return;
    }
    const i = n.supportsSlotSystem ? "\n\n🎯 Using Slot System: New clips will fill from slot 5 upward" : "";
    if (confirm(`Create "${n.name}" from this YouTube URL?\n\nURL: ${t}\n\n${n.description}\n${n.duration}${i}\n\nThis may take a few minutes to process.`)) {
      this.startClipProcessingWithSlots(t, e);
    }
  }
  cancelTemplateSelection() {
    this.selectedTemplate = null;
    this._awaitingUrlForTemplate = false;
    this._pendingDurationCheck = null;
    document.querySelectorAll(".template-card").forEach(e => {
      e.classList.remove("selected");
    });
    document.getElementById("processUrlBtn")?.classList.remove("needs-url-pulse");
    clearTimeout(this._urlPulseTimer);
    this.showConfirmationButtons(false);
    const e = document.getElementById("slotSystemInfo");
    if (e) {
      e.remove();
    }
  }
  _lockGenerationButtons() {
    const e = document.getElementById("processUrlBtn");
    if (e) {
      e.disabled = false;
      e.classList.add("is-generating");
      e.classList.remove("is-cancelling");
      e.setAttribute("aria-label", "Stop generation");
      e.title = "Stop generation";
    }
    const t = document.getElementById("confirmUseTemplateBtn");
    if (t) t.disabled = true;
  }
  _unlockGenerationButtons() {
    this._generationStartInFlight = false;
    this._cancelGenerationInFlight = false;
    const e = document.getElementById("processUrlBtn");
    if (e) {
      e.disabled = false;
      e.style.opacity = "1";
      e.style.cursor = "pointer";
      e.classList.remove("is-generating", "is-cancelling", "is-cancel-locked", "is-upgrade-cta", "loading");
      e.setAttribute("aria-label", "Continue");
      e.removeAttribute("title");
    }
    sessionStorage.removeItem("urlButtonLocked");
    sessionStorage.removeItem("urlButtonLockeduntil");
    this.syncTemplateConfirmButton();
  }
  async cancelActiveGeneration() {
    if (this._cancelGenerationInFlight) return;
    this._cancelGenerationInFlight = true;
    const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
    const t = document.getElementById("processUrlBtn");
    t?.classList.add("is-cancelling");
    try {
      let n = null;
      if (e?.activeGenerations?.size) {
        n = [ ...e.activeGenerations.keys() ][0];
      }
      if (!n && this.processingItems?.length) {
        const e = this.processingItems.find(e => {
          const t = String(e.status || "").toLowerCase();
          return e.projectId && [ "queued", "downloading", "processing" ].includes(t);
        });
        n = e?.projectId || null;
      }
      if (!n && e?._lastKnownProjectId) {
        n = e._lastKnownProjectId;
      }
      if (!n) {
        try {
          const e = JSON.parse(localStorage.getItem("solisAI_activeGenerations") || "[]");
          if (Array.isArray(e) && e.length) n = e[0];
        } catch (e) {}
      }
      if (e?.optimisticPending && !n) {
        e.cancelOptimisticGeneration?.();
        this._unlockGenerationButtons();
        return;
      }
      if (e?.optimisticPending && n) {
        e.optimisticPending = false;
      }
      if (!n) {
        e?.cancelOptimisticGeneration?.();
        this._unlockGenerationButtons();
        return;
      }
      e?._markUserCancelled?.(n);
      const i = window.API_BASE_URL || window.API_BASE || "/api";
      const r = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const o = await fetch(`${i}/clips/${encodeURIComponent(n)}/cancel`, {
        method: "POST",
        headers: r,
        credentials: "include"
      });
      const s = await o.json().catch(() => ({}));
      if (s?.cancel_locked || o.status === 409) {
        t?.classList.add("is-cancel-locked");
        t?.classList.remove("is-cancelling");
        t?.setAttribute("aria-label", "Finishing…");
        t && (t.title = s.message || "Almost done — can’t stop now");
        return;
      }
      if (e?.stopGeneration) {
        e.stopGeneration(n, "Stopped");
      } else if (e?.failGeneration) {
        e.failGeneration(n, "Stopped");
      } else {
        this._unlockGenerationButtons();
      }
      const a = this.processingItems?.find(e => e.projectId === n);
      if (a) {
        a.status = "cancelled";
        a.message = "Stopped";
        this.saveProcessingItems?.();
        this.updateProcessingView?.();
      }
      if (!o.ok) {
        console.warn("[Cancel] Server returned", o.status);
      }
    } catch (e) {
      console.warn("[Cancel] Request failed:", e);
      this._unlockGenerationButtons();
    } finally {
      this._cancelGenerationInFlight = false;
      t?.classList.remove("is-cancelling");
    }
  }
  syncTemplateConfirmButton() {
    const e = document.getElementById("confirmUseTemplateBtn");
    if (!e) return;
    if (this.currentTemplateForPreview?.isLibraryPreview) {
      return;
    }
    e.classList.remove("library-download-mode");
    if (e.dataset.applying === "1") return;
    if (document.getElementById("processUrlBtn")?.classList.contains("is-generating")) {
      e.disabled = true;
      e.textContent = "Use Template";
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
      return;
    }
    e.disabled = false;
    e.textContent = "Use Template";
    e.removeAttribute("aria-disabled");
    e.style.pointerEvents = "";
    e.style.opacity = "";
    if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
  }
  _rollbackOptimisticStart(e) {
    const t = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
    if (t) {
      t.cancelOptimisticGeneration();
      if (t.activeGenerations.size === 0) {
        t._unlockUrlSubmitButton();
      }
    }
    this._unlockGenerationButtons();
    if (e == null) return;
    const n = this.processingItems.findIndex(t => t.id === e);
    if (n === -1) return;
    this.processingItems.splice(n, 1);
    this.saveProcessingItems();
    if (this.processingItems.length === 0) {
      this.stopLibraryPolling();
    }
    if (this.currentTab === "library") {
      this.updateLibraryView();
    }
  }
  _notifyGenerationBlock(e, t = null) {
    const n = e?.daily || t?.daily || {};
    const i = e?.monthly || t?.monthly || {};
    const r = t?.daily_count ?? n.used;
    const o = t?.daily_limit ?? n.limit;
    const s = n.remaining ?? (o != null && r != null ? Math.max(0, o - r) : null);
    const a = t?.monthly_count ?? i.used;
    const l = t?.monthly_limit ?? i.limit;
    const c = i.remaining ?? (l != null && a != null ? Math.max(0, l - a) : null);
    const d = e?.storage?.videos?.used ?? t?.current_count ?? (typeof window.clipsStudio?.libraryItems?.length === "number" ? window.clipsStudio.libraryItems.length : null);
    const p = e?.storage?.videos?.limit ?? t?.limit ?? null;
    const showStorageFullModal = (e, t) => {
      if (typeof window.showUpgradeModal === "function") {
        window.showUpgradeModal(e, t);
      } else {
        showNotification(t, "warning");
      }
    };
    if (e?.daily_limit_reached || t?.error_code === "DAILY_LIMIT_REACHED" || s === 0) {
      const e = n.resets_at || t?.daily?.resets_at;
      let i = "";
      if (e) {
        try {
          const t = String(e).trim();
          const n = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : t.replace(" ", "T");
          const r = new Date(n);
          if (!Number.isNaN(r.getTime())) {
            i = r.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            });
          }
        } catch (e) {}
      }
      showNotification(i ? `Daily quota reached (${r ?? "?"}/${o ?? "?"}). Resets around ${i}.` : `Daily quota reached (${r ?? "?"}/${o ?? "?"}). Resets 24h after you started generating.`, "warning");
      return;
    }
    if (e?.monthly_limit_reached || t?.error_code === "MONTHLY_LIMIT_REACHED" || l > 0 && c === 0) {
      showNotification(`Monthly quota reached (${a ?? "?"}/${l ?? "?"}). Resets with your plan renewal.`, "warning");
      return;
    }
    const u = e?.generation?.cooldown_remaining_seconds || t?.cooldown_remaining_seconds || 0;
    if (u > 0) {
      const e = Math.floor(u / 60);
      const t = u % 60;
      const n = e > 0 ? `${e}m ${t}s` : `${t}s`;
      showNotification(`Please wait ${n} before your next generation.`, "warning");
      return;
    }
    if (e?.library_limit_reached || e?.block_reason === "library_full" || t?.error_code === "VIDEO_LIMIT_REACHED") {
      showStorageFullModal("Library Storage Full", `You have ${d ?? "?"}/${p ?? "?"} saved videos. Delete clips from your library to create new ones, or upgrade your plan for more storage.`);
      return;
    }
    if (e?.storage_limit_reached || e?.block_reason === "storage_full" || t?.error_code === "INSUFFICIENT_STORAGE") {
      const t = e?.storage?.space_mb?.used;
      const n = e?.storage?.space_mb?.total;
      const i = t != null && n != null ? ` (${t} MB / ${n} MB used)` : "";
      showStorageFullModal("Disk Storage Full", `Your plan storage is almost full${i}. Delete old projects or upgrade your plan to continue.`);
      return;
    }
    if (e?.block_reason === "in_progress" || e?.is_generating) {
      showNotification("A video is already generating. Please wait for it to finish.", "warning");
      return;
    }
    showNotification("Cannot start a new generation right now. Try again shortly.", "warning");
  }
  async startClipProcessingWithSlots(e, t) {
    if (this._generationStartInFlight) return;
    let n = null;
    try {
      const i = this.templates[t];
      const r = i?.name || t;
      n = Date.now();
      this._generationStartInFlight = true;
      this._lockGenerationButtons();
      this.switchTab("library");
      if (typeof window.refreshPlanSelector === "function") {
        window.refreshPlanSelector().catch(() => {});
      }
      const o = typeof initGenerationProgressSpinner === "function" ? initGenerationProgressSpinner() : typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      if (o) {
        const e = t === "splitscreen" && typeof window.getSplitscreenConfig === "function" ? {
          secondaryType: window.getSplitscreenConfig().splitscreen_secondary_type
        } : {};
        o.beginOptimisticGeneration("Starting...", t, e);
      }
      const s = {
        id: n,
        projectId: null,
        optimistic: true,
        name: `${r} from YouTube`,
        template: t,
        templateName: r,
        status: "processing",
        progress: 0,
        message: "Starting...",
        timestamp: new Date,
        lastChecked: Date.now(),
        slotNumber: null,
        useSlotSystem: true,
        isSlotSystem: true
      };
      this.addProcessingItem(s);
      const a = document.getElementById("watermarkToggle");
      const l = a ? a.checked : false;
      const c = getAuthHeaders();
      let d = null;
      let p = null;
      if (window.customizer && typeof window.customizer.collectCustomizations === "function") {
        d = window.customizer.collectCustomizations();
      }
      if (t === "ranked_compilation") {
        const mergeStyleMaps = (...e) => {
          const t = {};
          e.forEach(e => {
            if (!e || typeof e !== "object") return;
            Object.entries(e).forEach(([e, n]) => {
              if (!n || typeof n !== "object") {
                if (n != null) t[e] = n;
                return;
              }
              const i = t[e] && typeof t[e] === "object" ? t[e] : {};
              const r = {
                ...i
              };
              Object.entries(n).forEach(([e, t]) => {
                if (t !== undefined && t !== null && t !== "") r[e] = t;
              });
              t[e] = r;
            });
          });
          return t;
        };
        let e = null;
        let t = null;
        try {
          e = JSON.parse(sessionStorage.getItem("solisPendingRankingCustoms") || "null");
        } catch (t) {
          e = null;
        }
        try {
          t = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
        } catch (e) {
          t = null;
        }
        let n = null;
        try {
          n = JSON.parse(localStorage.getItem("rankingCustomizations") || "null");
        } catch (e) {
          n = null;
        }
        let i = null;
        try {
          if (window.rankingCustomizer?.captureGenerateLock && document.querySelector("#templateVideoPreview .ranking-preview-container")) {
            i = window.rankingCustomizer.captureGenerateLock();
          } else if (window.rankingCustomizer?.customizations) {
            i = JSON.parse(JSON.stringify(window.rankingCustomizer.customizations));
          }
        } catch (e) {
          i = null;
        }
        p = mergeStyleMaps(n, e, i, window.__solisPendingGenerateRankingCustoms, window.__solisRankingStyleLock, t);
        const countFonts = e => {
          if (!e || typeof e !== "object") return 0;
          return Object.entries(e).filter(([e, t]) => e !== "__ranking_layout" && t && typeof t === "object" && t.font).length;
        };
        if (countFonts(p) === 0) {
          const i = mergeStyleMaps(p, n, e, t, window.__solisRankingStyleLock, window.rankingCustomizer?.customizations);
          if (countFonts(i) > 0) {
            p = i;
            safeLog("[RankingStyles] Rescued fonts after empty merge:", countFonts(i));
          }
        }
        window.__solisPendingGenerateRankingCustoms = null;
        try {
          sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(p || {}));
          const e = countFonts(p);
          const n = countFonts(t);
          if (e > 0) {
            sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(p || {}));
            window.__solisRankingStyleLock = p;
          } else if (n > 0) {
            p = mergeStyleMaps(p, t);
            safeLog("[RankingStyles] Kept prior style lock fonts:", n);
          } else {
            sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(p || {}));
            window.__solisRankingStyleLock = p;
          }
        } catch (e) {}
        if (!p || !Object.keys(p).length) {
          p = {
            __ranking_layout: window.__solisRankingLayout || {}
          };
        }
        if (typeof window.rankingCustomizer.ensureGeneratePayload === "function") {
          p = window.rankingCustomizer.ensureGeneratePayload(p);
        }
      } else if (window.rankingCustomizer && typeof window.rankingCustomizer.collectCustomizations === "function") {
        p = window.rankingCustomizer.collectCustomizations();
      }
      if (t === "ranked_compilation" && p) {
        try {
          if (typeof window.rankingCustomizer?.ensureGeneratePayload === "function") {
            p = window.rankingCustomizer.ensureGeneratePayload(p);
          }
          const e = Object.entries(p).filter(([e, t]) => e !== "__ranking_layout" && t && t.font).map(([e, t]) => `${e}:${t.font}`);
          const t = Object.entries(p).filter(([e, t]) => e !== "__ranking_layout" && t && t.color).map(([e, t]) => `${e}:rgb(${(t.color || []).slice(0, 3).join(",")})`);
          safeLog("[RankingStyles] Sending fonts:", e.slice(0, 14));
          safeLog("[RankingStyles] Sending colors:", t.slice(0, 8));
          if (!e.length) {
            console.warn("[RankingStyles] NO FONTS in generate payload — overlay will look default");
          }
        } catch (e) {}
      }
      const u = {
        url: e,
        template_id: t,
        use_slot_system: true,
        watermark_enabled: l,
        effort: (typeof window.getSelectedEffortMode === "function" ? window.getSelectedEffortMode() : null) || "auto",
        ai_text_generation: window.solisAiTitleGenerationEnabled !== false,
        sfx_enabled: false
      };
      try {
        const e = window.__solisPendingGenerateHook || null;
        window.__solisPendingGenerateHook = null;
        const t = e || (typeof window.collectAiHookFromPreview === "function" ? window.collectAiHookFromPreview() : null);
        if (t?.present && t.style) {
          u.ai_hook_style = t.style;
        } else if (window.solisAiTitleGenerationEnabled === false) {
          u.ai_text_generation = false;
        }
      } catch (e) {}
      if (Number.isFinite(this._lastVideoDurationSeconds) && this._lastVideoDurationSeconds > 0) {
        u.video_duration_seconds = this._lastVideoDurationSeconds;
      } else if (Number.isFinite(this._lastVideoDurationMinutes) && this._lastVideoDurationMinutes > 0) {
        u.video_duration_minutes = this._lastVideoDurationMinutes;
      }
      const m = typeof window.getSolisPluginPrefs === "function" ? window.getSolisPluginPrefs() : null;
      if (m) {
        u.subtitles_enabled = !!m.auto_captions;
      }
      try {
        let e = window.__solisPendingGenerateCaptions || null;
        window.__solisPendingGenerateCaptions = null;
        if (!e && typeof window.flushCaptionsForGenerate === "function") {
          e = window.flushCaptionsForGenerate(t);
        }
        if (!e && typeof window.collectSubtitleStyle === "function") {
          const t = window.collectSubtitleStyle();
          const n = !!document.getElementById("templateVideoPreview")?.querySelector(".sub-text-block:not(.overlay-text-block)");
          if (t && n) e = t;
        }
        const n = !!document.getElementById("templateVideoPreview")?.querySelector(".sub-text-block:not(.overlay-text-block)");
        const i = !!(e && typeof e === "object");
        const r = !!window.__solisCaptionsClearedForGenerate && !i;
        const o = !!window.__solisCaptionsOptedIn || n || i;
        window.__solisCaptionsClearedForGenerate = false;
        if (r && !n && !i) {
          u.subtitles_enabled = false;
          delete u.caption_style;
          safeLog("Captions removed in preview — skipping burn");
        } else if (e && typeof e === "object" && o && e.enabled !== false) {
          const t = window.solisSmartCaptionsEnabled !== false;
          u.caption_style = {
            ...e,
            enabled: true,
            smart_captions: e.smart_captions !== undefined ? !!e.smart_captions : t,
            crisper_mode: (e.smart_captions !== undefined ? !!e.smart_captions : t) ? "verbatim" : "intended"
          };
          u.subtitles_enabled = true;
          safeLog("Sending caption style:", u.caption_style);
        } else if (n && o) {
          u.caption_style = {
            anim: "karaoke",
            enabled: true,
            smart_captions: window.solisSmartCaptionsEnabled !== false,
            crisper_mode: window.solisSmartCaptionsEnabled !== false ? "verbatim" : "intended"
          };
          u.subtitles_enabled = true;
          safeLog("Subtitle block present — sending default caption style");
        } else if (m?.auto_captions && !r) {
          u.caption_style = {
            anim: "karaoke",
            enabled: true,
            smart_captions: window.solisSmartCaptionsEnabled !== false,
            crisper_mode: window.solisSmartCaptionsEnabled !== false ? "verbatim" : "intended"
          };
          u.subtitles_enabled = true;
          safeLog("Plugin auto_captions on — default karaoke burn");
        } else {
          u.subtitles_enabled = false;
          delete u.caption_style;
          safeLog("No caption opt-in — skipping ASR/burn");
        }
      } catch (e) {
        safeLog("Caption style collect failed:", e?.message || e);
      }
      if (d && Object.keys(d).length > 0) {
        u.customizations = d;
        safeLog("ðŸ“ Sending customizations with video generation:", d);
      }
      if (p && Object.keys(p).length > 0) {
        u.ranking_customizations = p;
        u.ranking_style_lock = p;
        safeLog("Sending ranking customizations:", Object.keys(p));
      }
      if (t === "splitscreen" && typeof window.getSplitscreenConfig === "function") {
        Object.assign(u, window.getSplitscreenConfig());
      }
      let f = await fetch(`${API_BASE_URL}/clips/start`, {
        method: "POST",
        headers: c,
        credentials: "include",
        body: JSON.stringify(u)
      });
      if (f.status === 403) {
        const e = await f.clone().json().catch(() => ({}));
        if (e.code === "CSRF_INVALID" && typeof initializeCSRFToken === "function") {
          await initializeCSRFToken();
          f = await fetch(`${API_BASE_URL}/clips/start`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify(u)
          });
        }
      }
      if (f.status === 401) {
        this._rollbackOptimisticStart(n);
        showNotification("Session expired. Please try again.", "error");
        return;
      }
      if (!f.ok) {
        const e = await f.json().catch(() => ({}));
        if (f.status === 429) {
          if (e.error_code === "CONCURRENT_GENERATION_BLOCKED") {
            this._rollbackOptimisticStart(n);
            showNotification(e.error, "error");
            return;
          }
          if (e.error_code === "GENERATION_COOLDOWN") {
            this._rollbackOptimisticStart(n);
            const t = e.remaining_seconds || e.cooldown_seconds || 30;
            startCooldownTimer(t);
            showNotification(e.error, "error");
            return;
          }
          if (e.error_code === "MAX_EFFORT_LIMIT_REACHED") {
            this._rollbackOptimisticStart(n);
            showNotification(e.error || "Max effort daily limit reached. Switch to Normal effort.", "error");
            try {
              if (typeof window.setSelectedEffortMode === "function") {
                window.setSelectedEffortMode("normal");
              }
              if (typeof window.refreshPlanSelector === "function") {
                window.refreshPlanSelector();
              }
            } catch (e) {}
            return;
          }
          if (e.error_code === "DAILY_LIMIT_REACHED" || e.error_code === "MONTHLY_LIMIT_REACHED") {
            this._rollbackOptimisticStart(n);
            this._notifyGenerationBlock(null, e);
            try {
              if (typeof window.refreshPlanSelector === "function") {
                window.refreshPlanSelector();
              }
            } catch (e) {}
            return;
          }
          if (e.error_code === "VIDEO_LIMIT_REACHED") {
            this._rollbackOptimisticStart(n);
            this._notifyGenerationBlock({
              storage_limit_reached: true,
              plan_type: e.plan_type
            }, e);
            return;
          }
          this._rollbackOptimisticStart(n);
          showNotification(e.error || "Rate limit reached. Please try again later.", "error");
          return;
        } else if (e.error_code === "VIDEO_TOO_LONG") {
          this._rollbackOptimisticStart(n);
          const t = e.video_minutes || 0;
          const i = e.max_duration_minutes || 0;
          showNotification(e.error || `Source exceeds the ${i}m safety limit (${t}m).`, "error");
          return;
        } else {
          const t = e.error || "Failed to start processing";
          this._rollbackOptimisticStart(n);
          showNotification(t, "error");
          throw new Error(t);
        }
      }
      const y = await f.json();
      this.currentProjectId = y.project_id;
      try {
        this._watermarkCheckCache = null;
        const e = await this.resolveWatermarkPolicy(true);
        this.applyWatermarkControls(e);
      } catch (e) {}
      const g = this.processingItems.find(e => e.id === n);
      if (g) {
        g.projectId = this.currentProjectId;
        g.optimistic = false;
        g.templateName = y.template.name;
        g.name = `${y.template.name} from YouTube`;
        g.message = "Starting download...";
        this.saveProcessingItems();
      } else {
        const e = {
          id: n,
          projectId: this.currentProjectId,
          name: `${y.template.name} from YouTube`,
          template: t,
          templateName: y.template.name,
          status: "processing",
          progress: 0,
          message: "Starting download...",
          timestamp: new Date,
          lastChecked: Date.now(),
          slotNumber: null,
          useSlotSystem: true,
          isSlotSystem: true
        };
        this.addProcessingItem(e);
      }
      if (o) {
        const e = t === "splitscreen" && typeof window.getSplitscreenConfig === "function" ? {
          secondaryType: window.getSplitscreenConfig().splitscreen_secondary_type
        } : {};
        const n = y?.message || (y?.queue?.queue_status === "waiting" ? "Queued — waiting for an open slot..." : "Queued — starting shortly...");
        o.startGeneration(y.project_id, n, t, e);
        if (y?.queue) {
          o.updateProgress(y.project_id, 1, n, true, y.queue);
        }
      } else {
        console.warn("[GENERATION] Spinner not initialized! Trying fallback wrapper...");
        const e = document.getElementById("generationProgressWrapper");
        if (e) {
          e.style.display = "flex";
        }
      }
      if (typeof window.refreshPlanSelector === "function") {
        window.refreshPlanSelector();
      }
      try {
        const e = window.clipsStudio?.libraryItems?.length ?? Number(document.getElementById("storageUsedBadge")?.textContent || 0);
        const t = Number(document.getElementById("storageTotalBadge")?.textContent || 0) || 1;
        const n = (document.getElementById("storagePlanBadge")?.textContent || "free").toLowerCase();
        if (typeof window.applyStorageBadgeUI === "function") {
          window.applyStorageBadgeUI({
            used: e,
            limit: t,
            plan: n
          });
        }
        const i = window.getStoragePhase?.(e, t, n)?.phase;
        if ((i === "high" || i === "full") && typeof window.pulseStorageBadgeWarning === "function") {
          window.pulseStorageBadgeWarning();
        }
      } catch (e) {}
      if (solisWSClient && y.project_id) {
        solisWSClient.registerTask(y.project_id, "processing");
      }
      this.startMonitoring(n);
      this._generationStartInFlight = false;
      try {
        if (window.SolisMemory && typeof window.SolisMemory.recordFromGeneration === "function") {
          const e = t === "ranked_compilation" || String(t || "").toLowerCase().includes("rank");
          const n = e ? p || d || null : null;
          const i = e ? null : u && u.caption_style || null;
          const r = t === "splitscreen" && typeof window.getSplitscreenConfig === "function" ? window.getSplitscreenConfig() : null;
          window.SolisMemory.recordFromGeneration(t, n, i, r);
        }
      } catch (e) {}
      this.cancelTemplateSelection();
    } catch (e) {
      this._rollbackOptimisticStart(n);
      safeLog("startClipProcessingWithSlots error:", e);
      showNotification("Failed to start processing: " + e.message, "error");
    }
  }
  startMonitoring(e) {
    this.stopMonitoring(e);
    const t = setInterval(async () => {
      const t = this.processingItems.find(t => t.id === e);
      if (!t) {
        this.stopMonitoring(e);
        return;
      }
      try {
        const n = window.generationProgressSpinner;
        if (n?.activeGenerations?.has?.(t.projectId)) {
          if (t.status === "processing") return;
          this.stopMonitoring(e);
          return;
        }
      } catch (e) {}
      if (t.status === "processing") {
        await this.checkItemStatus(e);
      } else {
        this.stopMonitoring(e);
      }
    }, 1e4);
    this.monitoringIntervals.set(e, t);
  }
  stopMonitoring(e) {
    if (this.monitoringIntervals.has(e)) {
      clearInterval(this.monitoringIntervals.get(e));
      this.monitoringIntervals.delete(e);
    }
  }
  stopAllMonitoring() {
    this.monitoringIntervals.forEach((e, t) => {
      clearInterval(e);
    });
    this.monitoringIntervals.clear();
  }
  async checkItemStatus(e) {
    try {
      const t = this.processingItems.find(t => t.id === e);
      if (!t || !t.projectId || t.optimistic) return;
      const n = getAuthHeaders();
      const i = await fetch(`${API_BASE_URL}/clips/status/${t.projectId}`, {
        headers: n,
        credentials: "include"
      });
      if (!i.ok) return;
      const r = await i.json();
      const o = t.status !== r.status || t.progress !== r.progress;
      if (o) {
        t.status = r.status;
        t.progress = r.progress;
        t.message = r.message;
        t.lastChecked = Date.now();
        if (r.slot_number && t.isSlotSystem) {
          t.slotNumber = r.slot_number;
          t.name = `${t.templateName} (Slot ${r.slot_number})`;
        }
        const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
        if (e) {
          const n = r.message || {
            downloading: "Downloading video...",
            processing: "Processing moments...",
            rendering: "Rendering video...",
            completed: "Complete!"
          }[r.status] || `${r.status}...`;
          e.updateProgress(t.projectId, r.progress, n, true);
        }
        this.updateProcessingView();
        if (this.currentTab === "library") {
          this.updateLibraryView();
        }
        this.saveProcessingItems();
      }
      if (r.status === "completed") {
        t.status = "completed";
        const n = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
        if (n) {
          n.completeGeneration(t.projectId);
        }
        this._unlockGenerationButtons();
        this.moveToLibrary(t);
        this.stopMonitoring(e);
        showNotification("Clip created successfully!", "success");
        try {
          this._watermarkCheckCache = null;
          const e = await this.resolveWatermarkPolicy(true);
          this.applyWatermarkControls(e);
        } catch (e) {}
        try {
          this.invalidateLimitCheckCache?.();
        } catch (e) {}
        try {
          sessionStorage.removeItem("solis_quota_rail_dismiss");
        } catch (e) {}
        if (typeof window.refreshPlanSelector === "function") {
          window.refreshPlanSelector();
        }
        this._unlockGenerationButtons();
        if (t.isSlotSystem && t.slotNumber) {
          showNotification(`Clip added to Slot ${t.slotNumber}`, "info");
        }
        this.switchTab("library");
        this.updateProcessingView();
        this.saveProcessingItems();
      } else if (r.status === "cancelled" || r.status === "canceled") {
        t.status = "cancelled";
        t.message = r.message || "Stopped";
        const n = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
        if (n?.stopGeneration) {
          n.stopGeneration(t.projectId, t.message);
        } else {
          this._unlockGenerationButtons();
        }
        this.stopMonitoring(e);
        this.saveProcessingItems();
        this.updateProcessingView();
      } else if (r.status === "error" || r.status === "failed" || r.status === "timeout") {
        t.status = "failed";
        t.message = r.message;
        const n = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
        if (n?.failGeneration) {
          n.failGeneration(t.projectId, r.message || "There was an error — try again");
        }
        this._unlockGenerationButtons();
        this.stopMonitoring(e);
        const i = document.getElementById("processUrlBtn");
        if (i) {
          i.disabled = false;
          i.classList.remove("is-generating", "is-cancelling");
        }
        setTimeout(() => {
          this.processingItems = this.processingItems.filter(t => t.id !== e);
          this.updateLibraryView();
          this.saveProcessingItems();
          if (this.processingItems.length === 0) {
            this.stopLibraryPolling();
          }
        }, 5e3);
        const o = r.message || "";
        safeLog("Processing error detected:", o);
        const s = /Video is too long\. Maximum allowed:\s*(\d+)\s*minutes\. Your video:\s*(\d+)\s*minutes/i;
        const a = /Maximum allowed:\s*(\d+)\s*minutes.*Your video:\s*(\d+)\s*minutes/i;
        const l = /too long|duration limit/i;
        let c = o.match(s);
        safeLog("Pattern 1 match:", c);
        if (c && c.length >= 3) {
          const e = parseInt(c[1]);
          const t = parseInt(c[2]);
          safeLog("✓ Video too long detected (pattern 1):", t, "max:", e);
          setTimeout(() => {
            if (window && typeof window.openVideoTooLongModal === "function") {
              window.openVideoTooLongModal(t, e);
            }
          }, 100);
        } else {
          c = o.match(a);
          safeLog("Pattern 2 match:", c);
          if (c && c.length >= 3) {
            const e = parseInt(c[1]);
            const t = parseInt(c[2]);
            safeLog("✓ Video too long detected (pattern 2):", t, "max:", e);
            setTimeout(() => {
              if (window && typeof window.openVideoTooLongModal === "function") {
                window.openVideoTooLongModal(t, e);
              }
            }, 100);
          } else if (l.test(o)) {
            safeLog("Pattern 3 match (keywords found), trying number extraction...");
            const e = o.match(/\d+/g);
            if (e && e.length >= 2) {
              const t = parseInt(e[e.length - 2]);
              const n = parseInt(e[e.length - 1]);
              if (t > 0 && n > 0 && t > n) {
                safeLog("✓ Video too long detected (fallback):", t, "max:", n);
                setTimeout(() => {
                  if (window && typeof window.openVideoTooLongModal === "function") {
                    window.openVideoTooLongModal(t, n);
                  }
                }, 100);
              }
            }
          }
        }
        showNotification("Clip creation failed: " + r.message, "error");
      }
    } catch (t) {
      safeLog("Error checking status for item", e, t);
    }
  }
  startSmartMonitoring() {
    this.processingItems.forEach(e => {
      if (e.status === "processing") {
        this.startMonitoring(e.id);
      }
    });
  }
  isValidYouTubeUrl(e) {
    return this.isValidMediaUrl(e) && !this.isShortFormUrl(e) && this.detectMediaPlatform(e) === "youtube";
  }
  validateProjectId(e) {
    if (!e || typeof e !== "string") return false;
    if (e.match(/\.\.|\/|\\|:|\||<|>|"|'|\x00/g)) return false;
    if (/^prj_[A-Za-z0-9]{12,}$/.test(e)) return true;
    return /^[0-9]+_[a-zA-Z0-9-]+$/.test(e);
  }
  validateItemId(e) {
    if (!e || typeof e !== "string") return false;
    if (e.match(/\.\.|\/|\\|:|\||<|>|"|'|\x00/g)) return false;
    return /^[a-zA-Z0-9_.-]+$/.test(e);
  }
  clearUrlIfProcessingDone() {
    try {
      const e = document.getElementById("youtubeUrlInput");
      if (!e) return;
      if (this.processingItems.length > 0) {
        e.value = "";
        safeLog("🧹 Auto-cleared YouTube URL (processing already done)");
      } else {
        safeLog("✅ Keeping YouTube URL (no processing done yet)");
      }
    } catch (e) {
      safeLog("Error managing URL on page load:", e);
    }
  }
  toggleUrlButtonLoading(e) {
    const t = document.getElementById("processUrlBtn");
    if (!t) return;
    if (e) {
      this.clearUrlSubmitUpgradeCta({
        keepLoading: true
      });
      t.classList.add("loading");
      t.disabled = true;
      sessionStorage.setItem("urlButtonLockeduntil", Date.now().toString());
      sessionStorage.setItem("urlButtonLocked", "true");
    } else {
      t.classList.remove("loading");
      if (!t.classList.contains("is-upgrade-cta")) {
        t.disabled = false;
      }
      sessionStorage.removeItem("urlButtonLocked");
      sessionStorage.removeItem("urlButtonLockeduntil");
    }
  }
  showUrlSubmitUpgradeCta({holdDotsMs: e = 480} = {}) {
    const t = document.getElementById("processUrlBtn");
    if (!t) return;
    clearTimeout(this._urlUpgradeCtaTimer);
    this._urlUpgradeCtaPending = true;
    t.classList.add("loading");
    t.classList.remove("is-upgrade-cta");
    t.disabled = true;
    const morph = () => {
      this._urlUpgradeCtaPending = false;
      t.classList.remove("loading");
      t.classList.add("is-upgrade-cta");
      t.disabled = false;
      t.setAttribute("aria-label", "Upgrade");
      t.title = "Upgrade for more daily generations";
      sessionStorage.removeItem("urlButtonLocked");
      sessionStorage.removeItem("urlButtonLockeduntil");
    };
    if (e <= 0) {
      morph();
      return;
    }
    this._urlUpgradeCtaTimer = setTimeout(morph, e);
  }
  clearUrlSubmitUpgradeCta({keepLoading: e = false} = {}) {
    clearTimeout(this._urlUpgradeCtaTimer);
    this._urlUpgradeCtaTimer = null;
    this._urlUpgradeCtaPending = false;
    const t = document.getElementById("processUrlBtn");
    if (!t) return;
    t.classList.remove("is-upgrade-cta");
    if (!e) t.classList.remove("loading");
    if (!t.classList.contains("is-generating")) {
      t.disabled = false;
      t.setAttribute("aria-label", "Continue");
      t.removeAttribute("title");
    }
  }
  openUrlSubmitUpgrade() {
    const e = "Daily free generation used";
    const t = "You’ve used today’s free clip. Upgrade for more daily generations, deeper effort modes, and faster GPU processing — or wait until your quota resets.";
    if (typeof window.showUpgradeModal === "function") {
      window.showUpgradeModal(e, t);
    } else if (typeof openUpgradeModal === "function") {
      openUpgradeModal();
    } else {
      showNotification(t, "warning");
    }
  }
  enforceUrlButtonRateLimitOnLoad() {
    const e = document.getElementById("processUrlBtn");
    if (!e) return;
    const t = sessionStorage.getItem("urlButtonLocked") === "true";
    const n = sessionStorage.getItem("urlButtonLockeduntil");
    if (t && n) {
      const t = parseInt(n, 10);
      const i = Date.now();
      const r = t - i;
      if (r > 0) {
        const t = CONFIG.RATE_LIMITING.YOUTUBE_PROCESS_MIN_MS || 3e3;
        if (r < t + 5e3) {
          e.disabled = true;
          e.style.cursor = "not-allowed";
          e.style.opacity = "0.5";
          e.classList.add("loading");
          const t = setTimeout(() => {
            e.disabled = false;
            e.style.cursor = "pointer";
            e.style.opacity = "1";
            e.classList.remove("loading");
            sessionStorage.removeItem("urlButtonLocked");
            sessionStorage.removeItem("urlButtonLockeduntil");
          }, r);
          e._unlockTimer = t;
        }
      } else {
        sessionStorage.removeItem("urlButtonLocked");
        sessionStorage.removeItem("urlButtonLockeduntil");
      }
    }
  }
  async processYouTubeUrl() {
    if (this._urlAnalyzeInFlight || this._generationStartInFlight) {
      return;
    }
    if (document.getElementById("processUrlBtn")?.classList.contains("is-generating")) {
      showNotification("A video is already generating. Please wait for it to finish.", "warning");
      return;
    }
    if (typeof window.closePlanSelectorPopover === "function") {
      window.closePlanSelectorPopover(true);
    }
    const e = Date.now();
    if (e - this.lastYouTubeProcessTime < CONFIG.RATE_LIMITING.YOUTUBE_PROCESS_MIN_MS) {
      showNotification("Please wait a moment before trying again", "warning");
      return;
    }
    this.lastYouTubeProcessTime = e;
    this._urlAnalyzeInFlight = true;
    try {
      const e = document.getElementById("youtubeUrlInput");
      if (!e) return;
      const t = e.value.trim();
      if (t) {
        sessionStorage.setItem("lastProcessedYouTubeUrl", t);
      }
      if (!t) {
        showNotification("Please enter a video URL", "error");
        return;
      }
      if (!this.isValidMediaUrl(t)) {
        showNotification("Enter a valid YouTube, YouTube Shorts, TikTok, or Instagram Reels URL", "error");
        return;
      }
      if (this.isShortFormUrl(t)) {
        const e = await this.canUseShortFormUpload();
        if (!e) {
          this.showShortFormUploadModal();
          return;
        }
      }
      this.toggleUrlButtonLoading(true);
      const n = this._getCachedDurationCheck(t);
      const i = await this._getCachedLimitCheck(true);
      if (i) {
        try {
          if (typeof window.updateUrlQuotaRail === "function") {
            window.updateUrlQuotaRail(i);
          }
        } catch (e) {}
        const e = i.daily?.remaining;
        const t = i.monthly?.remaining;
        if (i.daily_limit_reached || e === 0) {
          this.showUrlSubmitUpgradeCta();
          try {
            if (typeof window.updateUrlQuotaRail === "function") {
              window.updateUrlQuotaRail(i);
            }
          } catch (e) {}
          try {
            sessionStorage.removeItem("solis_quota_rail_dismiss");
          } catch (e) {}
          try {
            if (typeof window.refreshPlanSelector === "function") {
              window.refreshPlanSelector();
            }
          } catch (e) {}
          return;
        }
        if (i.monthly_limit_reached || i.monthly?.limit > 0 && t === 0) {
          this.showUrlSubmitUpgradeCta();
          try {
            if (typeof window.refreshPlanSelector === "function") {
              window.refreshPlanSelector();
            }
          } catch (e) {}
          return;
        }
        const n = i.max_effort;
        if (n && n.limit > 0 && n.remaining <= 0 && typeof window.getSelectedEffortMode === "function" && window.getSelectedEffortMode() === "max") {
          if (typeof window.setSelectedEffortMode === "function") {
            window.setSelectedEffortMode("normal");
          }
        }
        if (!i.can_generate) {
          if (i.block_reason === "library_full" || i.block_reason === "storage_full") {
            this._notifyGenerationBlock(i);
            if (typeof window.syncStorageLimitsFromStatus === "function") {
              window.syncStorageLimitsFromStatus(i);
            }
          } else if (i.is_generating || i.block_reason === "in_progress") {
            showNotification("A generation may still be finishing. You can pick a template — we'll retry when you confirm.", "warning");
          } else if ((i.generation?.cooldown_remaining_seconds || 0) > 0) {
            this._notifyGenerationBlock(i);
          }
        }
      }
      const r = await Promise.race([ n, new Promise(e => setTimeout(() => e({
        allowed: true,
        pending: true
      }), 500)) ]);
      const o = !!(this._awaitingUrlForTemplate && this.selectedTemplate && this.templates[this.selectedTemplate]);
      if (r.pending) {
        if (o) {
          showNotification("Checking video length…", "info");
          this._pendingDurationCheck = n;
          n.then(e => {
            if (this._pendingDurationCheck !== n) return;
            this._pendingDurationCheck = null;
            if (!e.allowed) return;
            this._rememberVideoDuration(e);
            const i = document.getElementById("processUrlBtn");
            i?.classList.remove("needs-url-pulse");
            this._awaitingUrlForTemplate = false;
            this.startClipProcessingWithSlots(t, this.selectedTemplate);
          });
          return;
        }
        this.switchTab("templates");
        showNotification("Checking video length…", "info");
        this._pendingDurationCheck = n;
        n.then(e => {
          if (this._pendingDurationCheck !== n) return;
          this._pendingDurationCheck = null;
          if (!e.allowed) {
            this.switchTab("create");
          } else {
            this._rememberVideoDuration(e);
          }
        });
        const e = document.getElementById("clipPreviewContainer");
        if (e) e.style.display = "block";
        return;
      }
      if (!r.allowed) {
        return;
      }
      this._rememberVideoDuration(r);
      const s = typeof window.syncStorageLimitsFromStatus === "function" ? window.syncStorageLimitsFromStatus(i) : null;
      if (s?.phase === "high" || s?.phase === "full") {
        if (typeof window.pulseStorageBadgeWarning === "function") {
          window.pulseStorageBadgeWarning();
        }
      }
      if (o) {
        const e = document.getElementById("processUrlBtn");
        e?.classList.remove("needs-url-pulse");
        this._awaitingUrlForTemplate = false;
        this.startClipProcessingWithSlots(t, this.selectedTemplate);
        return;
      }
      this.switchTab("templates");
      const a = document.getElementById("clipPreviewContainer");
      if (a) a.style.display = "block";
    } finally {
      this._urlAnalyzeInFlight = false;
      if (!this._urlUpgradeCtaPending && !document.getElementById("processUrlBtn")?.classList.contains("is-upgrade-cta")) {
        this.toggleUrlButtonLoading(false);
      }
    }
  }
  _rememberVideoDuration(e) {
    if (!e || typeof e !== "object") return;
    const t = Number(e.duration_seconds);
    const n = Number(e.duration);
    if (Number.isFinite(t) && t > 0) {
      this._lastVideoDurationSeconds = t;
      this._lastVideoDurationMinutes = t / 60;
    } else if (Number.isFinite(n) && n > 0) {
      this._lastVideoDurationMinutes = n;
      this._lastVideoDurationSeconds = n * 60;
    }
  }
  _getCachedDurationCheck(e) {
    if (!this._durationCheckCache) this._durationCheckCache = {};
    if (!this._durationInflight) this._durationInflight = {};
    const t = this._durationCheckCache[e];
    if (t && Date.now() - t.at < 5 * 6e4) {
      return Promise.resolve(t.result);
    }
    if (this._durationInflight[e]) {
      return this._durationInflight[e];
    }
    const n = this.checkVideoDurationBeforeTemplates(e).then(t => {
      this._durationCheckCache[e] = {
        result: t,
        at: Date.now()
      };
      delete this._durationInflight[e];
      return t;
    }).catch(t => {
      delete this._durationInflight[e];
      throw t;
    });
    this._durationInflight[e] = n;
    return n;
  }
  _getCachedLimitCheck(e = false) {
    const t = this._limitCheckCache;
    if (!e && t && Date.now() - t.at < 3e4) {
      return Promise.resolve(t.data);
    }
    return fetch(`${API_BASE_URL}/clips/status`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include"
    }).then(e => e.ok ? e.json() : null).then(e => {
      if (e) this._limitCheckCache = {
        data: e,
        at: Date.now()
      };
      return e;
    }).catch(() => null);
  }
  invalidateLimitCheckCache() {
    this._limitCheckCache = null;
  }
  async checkVideoDurationBeforeTemplates(e) {
    try {
      const t = getAuthHeaders();
      const n = await fetch(`${API_BASE_URL}/clips/duration`, {
        method: "POST",
        headers: t,
        credentials: "include",
        body: JSON.stringify({
          url: e
        })
      });
      const i = await n.json();
      if (!n.ok) {
        if (i.error_code === "VIDEO_TOO_LONG") {
          const e = i.video_minutes || 0;
          const t = i.max_duration_minutes || 0;
          showNotification(i.error || `This source exceeds the ${t}-minute safety limit (${e}m).`, "error");
          return {
            allowed: false
          };
        }
        showNotification("Error checking video: " + (i.error || "Unknown error"), "error");
        return {
          allowed: false
        };
      }
      const r = i.duration_minutes || 0;
      const o = i.ai_budget_minutes || i.max_duration_minutes || 0;
      const s = Boolean(i.ai_budget_capped);
      return {
        allowed: true,
        duration: r,
        duration_seconds: i.duration_seconds ?? (Number.isFinite(i.duration_minutes) ? i.duration_minutes * 60 : null),
        maxAllowed: o,
        aiBudgetMinutes: o,
        aiBudgetCapped: s
      };
    } catch (e) {
      safeLog("Error checking video duration:", e);
      return {
        allowed: true
      };
    }
  }
  async generateClipWithSlotSystem() {
    const e = document.getElementById("youtubeUrlInput");
    if (!e) return;
    const t = e.value.trim();
    if (!t) {
      showNotification("Please process a YouTube URL first", "error");
      return;
    }
    if (!this.selectedTemplate) {
      showNotification("Please select a template first", "error");
      return;
    }
    this.startClipProcessingWithSlots(t, this.selectedTemplate);
  }
  addProcessingItem(e) {
    const t = this.processingItems.length === 0;
    this.processingItems.unshift(e);
    this.saveProcessingItems();
    if (t) {
      safeLog("🚀 First processing item added - starting smart polling");
      this.startLibraryPolling();
    }
  }
  updateProcessingView() {}
  oldUpdateProcessingView_old() {
    const e = document.getElementById("processingList");
    const t = document.getElementById("processingSection");
    const n = document.getElementById("emptyProcessingState");
    if (!e || !n || !t) return;
    if (this.processingItems.length === 0) {
      n.style.display = "block";
      e.innerHTML = "";
      t.style.display = "none";
      return;
    }
    n.style.display = "none";
    t.style.display = "block";
    e.innerHTML = this.processingItems.map(e => {
      const t = e.progress || 0;
      return `\n                <div class="processing-item" data-id="${e.id}">\n                    <div>\n                        \x3c!-- Thumbnail with video icon --\x3e\n                        <div class="processing-thumbnail">\n                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                                <polygon points="23 7 16 12 23 17 23 7"></polygon>\n                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>\n                            </svg>\n\n                            \x3c!-- Progressive circular loader (only show if processing) --\x3e\n                            ${e.status === "processing" ? `\n                                <div class="processing-loader">\n                                    <div class="loader">\n                                        ${this.renderLoaderParts(t)}\n                                    </div>\n                                </div>\n                            ` : ""}\n                        </div>\n\n                        \x3c!-- Info section --\x3e\n                        <div class="processing-info">\n                            <div>\n                                <div class="processing-name">${e.name}</div>\n                                <div class="processing-status ${e.status}">\n                                    <i class="fas fa-${this.getStatusIcon(e.status)}"></i>\n                                    ${this.formatStatus(e.status)}\n                                </div>\n                                ${e.message && e.status === "processing" ? `\n                                    <div class="processing-message">${e.message}</div>\n                                ` : ""}\n                            </div>\n                            ${e.status === "processing" ? `\n                                <div class="processing-percentage">${t}%</div>\n                            ` : ""}\n                        </div>\n                    </div>\n                </div>\n            `;
    }).join("");
  }
  getStatusIcon(e) {
    const t = {
      processing: "spinner",
      completed: "check",
      failed: "exclamation"
    };
    return t[e] || "question";
  }
  formatStatus(e) {
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  renderLoaderParts(e) {
    const t = 100 - e;
    const n = [ {
      opacity: t >= 25 ? 1 : 0
    }, {
      opacity: t >= 50 ? 1 : 0
    }, {
      opacity: t >= 75 ? 1 : 0
    }, {
      opacity: t >= 100 ? 1 : 0
    } ];
    return n.map((e, t) => `<div class="loader-part loader-part-${t + 1}" style="opacity: ${e.opacity}; transition: opacity 0.4s ease;"></div>`).join("");
  }
  async downloadClip(e, t = {}) {
    const {skipModalClose: n = false, quiet: i = false, light: r = false} = t;
    window.__solisDownloadBusy = true;
    try {
      if (!r) {
        try {
          const t = await fetch(`${API_BASE_URL}/clips/link/${encodeURIComponent(e)}`, {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json"
            }
          });
          if (t.ok) {
            const r = await t.json();
            const o = r.full_download_url;
            if (o) {
              let t = false;
              try {
                const e = await fetch(o, {
                  method: "HEAD",
                  credentials: "omit",
                  cache: "no-store"
                });
                t = e.ok;
                if (!t && (e.status === 405 || e.status === 501)) {
                  const e = await fetch(o, {
                    method: "GET",
                    credentials: "omit",
                    cache: "no-store",
                    headers: {
                      Range: "bytes=0-0"
                    }
                  });
                  t = e.ok || e.status === 206;
                  try {
                    e.body?.cancel?.();
                  } catch (e) {}
                }
              } catch (e) {
                console.warn("Signed download probe failed, using cookie fetch", e);
                t = false;
              }
              if (t) {
                const t = document.createElement("a");
                t.href = o;
                t.rel = "noopener";
                t.download = `clip_${e}.mp4`;
                t.style.display = "none";
                document.body.appendChild(t);
                t.click();
                document.body.removeChild(t);
                if (!i) showNotification("Download started!", "success");
                if (!n) this.closeTemplatePreviewModal();
                document.querySelectorAll("[data-project-id]").forEach(t => {
                  if (t.getAttribute("data-project-id") === e) {
                    const e = t.querySelector(".status-pill");
                    if (e) {
                      e.style.opacity = "0";
                      e.style.transition = "opacity 0.3s ease";
                      setTimeout(() => e.remove(), 300);
                    }
                  }
                });
                return;
              }
              console.warn("Signed download invalid/expired — falling back to authenticated fetch");
            }
          }
        } catch (e) {
          console.warn("Signed download link failed, falling back to blob fetch", e);
        }
      }
      const t = r ? "?light=1" : "";
      const o = `${API_BASE_URL}/clips/download/${encodeURIComponent(e)}${t}`;
      const s = await fetch(o, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "video/mp4,*/*"
        }
      });
      if (!s.ok) {
        const e = await s.json().catch(() => ({}));
        throw new Error(e.error || `Download failed (${s.status})`);
      }
      const a = await s.blob();
      if (!a || a.size < 1e3) {
        throw new Error("Downloaded file is empty");
      }
      const l = URL.createObjectURL(a);
      const c = document.createElement("a");
      c.href = l;
      c.rel = "noopener";
      c.download = r ? "clip-preview.mp4" : `clip_${e}.mp4`;
      c.style.display = "none";
      document.body.appendChild(c);
      c.click();
      document.body.removeChild(c);
      setTimeout(() => URL.revokeObjectURL(l), 3e4);
      if (!i) {
        showNotification("Download started!", "success");
      }
      if (!n) {
        this.closeTemplatePreviewModal();
      }
      const d = document.querySelectorAll("[data-project-id]");
      d.forEach(t => {
        if (t.getAttribute("data-project-id") === e) {
          const e = t.querySelector(".status-pill");
          if (e) {
            e.style.opacity = "0";
            e.style.transition = "opacity 0.3s ease";
            setTimeout(() => e.remove(), 300);
          }
        }
      });
    } catch (e) {
      console.error("Download error:", e);
      showNotification("Download failed: " + e.message, "error");
      throw e;
    } finally {
      window.__solisDownloadBusy = false;
    }
  }
  cancelProcessing(e) {
    const t = this.processingItems.find(t => t.id === e);
    if (t) {
      t.status = "cancelled";
      this.stopMonitoring(e);
      this.updateProcessingView();
      this.saveProcessingItems();
      showNotification("Processing cancelled", "info");
    }
  }
  deleteProcessingItem(e) {
    const t = this.processingItems.findIndex(t => t.id === e);
    if (t !== -1) {
      const n = this.processingItems[t];
      if (n.status === "processing") {
        showNotification("Cannot delete items while processing. Wait for completion or cancel first.", "warning");
        return;
      }
      this.deleteProjectFromServer(n.projectId);
      this.processingItems.splice(t, 1);
      this.stopMonitoring(e);
      this.updateProcessingView();
      this.saveProcessingItems();
      if (this.processingItems.length === 0) {
        this.stopLibraryPolling();
      }
      showNotification(`${n.name} deleted successfully`, "success");
    }
  }
  retryProcessing(e) {
    const t = this.processingItems.find(t => t.id === e);
    if (t) {
      t.status = "processing";
      t.progress = 0;
      this.updateProcessingView();
      this.saveProcessingItems();
      this.startMonitoring(e);
      showNotification("Retrying processing...", "info");
    }
  }
  moveToLibrary(e) {
    if (!this.validateProjectId(e.projectId)) {
      safeLog(`âŒ SECURITY: Invalid projectId format rejected: ${e.projectId}`);
      return;
    }
    const t = {
      id: e.projectId || e.id,
      projectId: e.projectId || e.id,
      name: e.name,
      template: e.template,
      templateName: e.templateName,
      timestamp: e.timestamp || (new Date).toISOString(),
      status: "completed",
      slotNumber: e.slotNumber,
      isSlotSystem: e.isSlotSystem,
      _optimistic: true
    };
    const n = document.querySelector(`[data-processing-id="${e.id}"]`);
    if (n) {
      n.style.transition = "all 0.5s ease";
      n.style.opacity = "0.5";
      setTimeout(() => {
        n.innerHTML = "";
        const e = sanitizeHTML(t.name);
        const i = isValidImageUrl(t.thumbnailUrl) ? t.thumbnailUrl : "/assets/no-image-placeholder.svg";
        const r = document.createElement("div");
        r.className = "card-preview";
        r.innerHTML = `\n                    <div class="status-pill">\n                        <div class="status-dot"></div>\n                        <span class="status-text">Ready</span>\n                    </div>\n                    <img src="${i}" alt="Asset Preview" onerror="this.src='/assets/no-image-placeholder.svg'">\n                    <div class="card-actions">\n                        <button class="card-action-btn library-delete-btn" title="Delete clip" tabindex="0">\n                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                                <path d="M3 6h18"/>\n                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>\n                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>\n                                <line x1="10" y1="11" x2="10" y2="17"/>\n                                <line x1="14" y1="11" x2="14" y2="17"/>\n                            </svg>\n                        </button>\n                    </div>\n                `;
        const o = document.createElement("div");
        o.className = "card-content";
        const s = document.createElement("h2");
        s.className = "card-title";
        s.textContent = e;
        const a = document.createElement("div");
        a.className = "card-footer";
        a.innerHTML = `\n                    <div class="badge">\n                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>\n                        <span class="duration-text">${sanitizeHTML(t.duration || "—")}</span>\n                    </div>\n                `;
        const l = document.createElement("button");
        l.className = "export-btn library-download-btn";
        l.type = "button";
        l.title = "Download";
        l.setAttribute("data-project-id", t.projectId);
        l.innerHTML = `\n                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>\n                        <polyline points="7 10 12 15 17 10"/>\n                        <line x1="12" y1="15" x2="12" y2="3"/>\n                    </svg>\n                    <span>Download</span>\n                `;
        a.appendChild(l);
        o.appendChild(s);
        o.appendChild(a);
        n.appendChild(r);
        n.appendChild(o);
        n.removeAttribute("data-processing-id");
        n.classList.add("library-card");
        n.setAttribute("data-id", t.id);
        n.setAttribute("data-project-id", t.projectId);
        n.style.opacity = "0";
        n.style.transition = "opacity 0.3s ease";
        setTimeout(() => {
          n.style.opacity = "1";
        }, 10);
        this.attachLibraryCardListeners(n, t.id, t.projectId);
        this.fetchAndUpdateDuration(n, t.projectId);
      }, 300);
    }
    this.processingItems = this.processingItems.filter(t => t.id !== e.id);
    this.libraryItems.unshift(t);
    this.saveProcessingItems();
    this.saveLibraryItems();
    if (this.processingItems.length === 0) {
      this.stopLibraryPolling();
    }
    this.loadAndDisplayStorageInfo();
    this.updateRecentActivity();
    safeLog(`✅ Card transformed: ${e.name}`);
    if (!n) {
      this.updateLibraryView();
    }
    this.loadLibraryItems({
      soft: true,
      force: true
    }).catch(() => {});
    this.openLibraryPreview(t.id, t.projectId, null, {
      fast: true
    });
  }
  fetchAndUpdateDuration(e, t) {
    if (!this.validateProjectId(t)) {
      safeLog(`âŒ SECURITY: Invalid projectId in fetchAndUpdateDuration`);
      return;
    }
    if (window.__solisDownloadBusy) return;
    fetch(`/api/clips/duration/${encodeURIComponent(t)}`, {
      method: "GET",
      credentials: "include"
    }).then(e => {
      if (!e.ok) throw new Error(`HTTP ${e.status}`);
      return e.json();
    }).then(t => {
      if (t.duration_formatted && e) {
        const n = e.querySelector(".duration-text");
        if (n) {
          n.textContent = t.duration_formatted;
        }
      }
    }).catch(e => safeLog("Could not fetch duration:", e));
  }
  attachLibraryCardListeners(e, t, n) {
    const i = e.querySelector(".library-download-btn");
    const r = e.querySelector(".library-delete-btn");
    if (i) {
      i.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        if (n && this.validateProjectId(n) && clipsStudio) {
          clipsStudio.downloadClip(n);
        } else {
          safeLog(`âŒ SECURITY: Invalid projectId for download: ${n}`);
        }
      });
    }
    if (r) {
      r.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        if (t && this.validateItemId(t) && clipsStudio) {
          clipsStudio.deleteClip(t);
        } else {
          safeLog(`âŒ SECURITY: Invalid itemId for delete: ${t}`);
        }
      });
    }
    if (!e.dataset.previewBound) {
      e.dataset.previewBound = "1";
      e.addEventListener("click", i => {
        if (i.target.closest(".library-download-btn, .library-delete-btn")) return;
        i.preventDefault();
        i.stopPropagation();
        this.openLibraryPreview(t, n, e);
      });
    }
  }
  showLibrarySkeleton(e = 4) {
    const t = document.getElementById("libraryGrid");
    if (!t) return;
    const n = document.getElementById("emptyLibraryState");
    if (n) n.style.display = "none";
    Array.from(t.children).forEach(e => {
      if (!e.classList.contains("empty-state")) e.remove();
    });
    const i = document.createDocumentFragment();
    for (let t = 0; t < e; t++) {
      const e = document.createElement("div");
      e.className = "library-card-skeleton";
      e.innerHTML = `\n                <div class="skeleton-block skeleton-preview"></div>\n                <div class="skeleton-block skeleton-title"></div>\n                <div class="skeleton-block skeleton-meta"></div>\n                <div class="skeleton-block skeleton-btn"></div>`;
      i.appendChild(e);
    }
    t.appendChild(i);
  }
  hideLibrarySkeleton() {
    const e = document.getElementById("libraryGrid");
    if (!e) return;
    e.querySelectorAll(".library-card-skeleton").forEach(e => e.remove());
  }
  async loadLibraryItems(e = {}) {
    const t = e.force === true;
    const n = 5 * 60 * 1e3;
    const i = Array.isArray(this.libraryItems) && this.libraryItems.length > 0;
    const r = this._libraryLastLoaded && Date.now() - this._libraryLastLoaded < n;
    if (!t && i && r) {
      if (this.libraryPreviewModalOpen) this._libraryRefreshPending = true; else this.updateLibraryView();
      return;
    }
    const o = e.soft === true || i || Array.isArray(this.processingItems) && this.processingItems.length > 0;
    if (!o) {
      this.showLibrarySkeleton(4);
    }
    try {
      const e = getAuthHeaders();
      const t = await fetch(`${API_BASE_URL}/clips/projects`, {
        headers: e,
        credentials: "include"
      });
      if (t.ok) {
        const e = await t.json();
        const n = e.projects.map(e => ({
          id: e.id,
          projectId: e.id,
          name: e.video_title || e.template_name || "Clip",
          template: e.template,
          templateName: e.template_name,
          timestamp: new Date(e.created_at),
          status: "completed",
          thumbnailUrl: e.thumbnail_url,
          slotNumber: e.slot_number,
          isSlotSystem: e.slots ? true : false,
          slots: e.slots
        }));
        const i = new Set(n.map(e => String(e.id)));
        const r = (this.libraryItems || []).filter(e => {
          const t = String(e.projectId || e.id || "");
          return e._optimistic && t && !i.has(t);
        });
        this.libraryItems = [ ...r, ...n ];
        this._libraryLastLoaded = Date.now();
        this.hideLibrarySkeleton();
        if (this.libraryPreviewModalOpen) {
          this._libraryRefreshPending = true;
        } else {
          this.updateLibraryView();
        }
        this.updateRecentActivity();
        this.saveLibraryItems();
        this._writeLibrarySessionCache();
        if (window.portalManager && typeof window.portalManager.refresh === "function") {
          window.portalManager.refresh();
        }
      }
    } catch (e) {
      safeLog("Failed to load library items:", e);
      this.hideLibrarySkeleton();
      this.loadLibraryItemsFromStorage();
    }
  }
  _librarySessionCacheKey() {
    const e = String(currentUser?.id || window.currentUser?.id || "");
    return e ? `solis_lib_v1_${e}` : null;
  }
  _writeLibrarySessionCache() {
    try {
      const e = this._librarySessionCacheKey();
      const t = String(currentUser?.id || window.currentUser?.id || "");
      if (!e || !t || !Array.isArray(this.libraryItems)) return;
      sessionStorage.setItem(e, JSON.stringify({
        uid: t,
        at: Date.now(),
        items: this.libraryItems
      }));
    } catch (e) {}
  }
  _clearLibrarySessionCache() {
    try {
      const e = this._librarySessionCacheKey();
      if (e) sessionStorage.removeItem(e);
    } catch (e) {}
  }
  _hydrateLibraryFromSessionCache() {
    try {
      const e = this._librarySessionCacheKey();
      const t = String(currentUser?.id || window.currentUser?.id || "");
      if (!e || !t) return false;
      const n = sessionStorage.getItem(e);
      if (!n) return false;
      const i = JSON.parse(n);
      if (!i || String(i.uid) !== t || !Array.isArray(i.items)) return false;
      if (Date.now() - Number(i.at || 0) > 15 * 60 * 1e3) {
        sessionStorage.removeItem(e);
        return false;
      }
      this.libraryItems = i.items.map(e => ({
        ...e,
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date
      }));
      this._libraryLastLoaded = Number(i.at) || Date.now();
      return this.libraryItems.length > 0;
    } catch (e) {
      return false;
    }
  }
  invalidateLibraryCache() {
    this._libraryLastLoaded = 0;
    this._clearLibrarySessionCache();
  }
  startLibraryPolling() {
    if (this.libraryPollingInterval) {
      clearInterval(this.libraryPollingInterval);
    }
    if (this.processingItems.length === 0) {
      safeLog("ðŸ“ No processing items - polling not started (will start when items appear)");
      return;
    }
    safeLog(`🔄 Starting smart polling for ${this.processingItems.length} processing item(s)`);
    this.libraryPollingInterval = setInterval(async () => {
      try {
        if (this.processingItems.length === 0) {
          safeLog("ðŸ“ All items processed - stopping polling");
          this.stopLibraryPolling();
          return;
        }
        const e = [];
        for (const t of this.processingItems) {
          try {
            try {
              const n = window.generationProgressSpinner;
              if (n?.activeGenerations?.has?.(t.projectId)) {
                e.push(t);
                continue;
              }
            } catch (e) {}
            const n = getAuthHeaders();
            const i = await fetch(`${API_BASE_URL}/clips/status/${t.projectId}`, {
              headers: n,
              credentials: "include",
              timeout: 3e3
            });
            if (i.ok) {
              const n = await i.json();
              if (n.status && [ "processing", "waiting", "pending", "queued", "downloading" ].includes(n.status)) {
                e.push(t);
              } else if (n.status === "cancelled" || n.status === "canceled") {
                const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
                if (e?.stopGeneration) {
                  e.stopGeneration(t.projectId, n.message || "Stopped");
                }
                this.stopMonitoring?.(t.id);
              } else if (n.status === "error" || n.status === "failed" || n.status === "timeout") {
                const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
                if (e?.failGeneration) {
                  e.failGeneration(t.projectId, n.message || "There was an error — try again");
                }
                this.stopMonitoring?.(t.id);
              } else if (n.status === "completed") {
                const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
                if (e?.completeGeneration) {
                  e.completeGeneration(t.projectId);
                }
                t.status = "completed";
                this.moveToLibrary(t);
                this.stopMonitoring?.(t.id);
              } else {
                safeLog(`🧹 Removing stale card during polling: ${t.name} (status: ${n.status})`);
              }
            } else {
              safeLog(`🧹 Backend check failed for ${t.name}, removing from processing`);
            }
          } catch (e) {
            safeLog(`⚠ï¸ Error validating ${t.name} during polling - removing: ${e.message}`);
          }
        }
        if (e.length !== this.processingItems.length) {
          this.processingItems = e;
          this.saveProcessingItems();
          this.updateLibraryView();
          safeLog(`🧹 Polling cleanup: ${this.processingItems.length} active items remaining`);
          if (e.length === 0) {
            this.stopLibraryPolling();
          }
        }
      } catch (e) {
        safeLog("Auto-polling error:", e);
      }
    }, 8e3);
  }
  stopLibraryPolling() {
    if (this.libraryPollingInterval) {
      clearInterval(this.libraryPollingInterval);
      this.libraryPollingInterval = null;
      safeLog("� Library polling stopped");
    }
  }
  async loadAndDisplayStorageInfo() {
    try {
      if (!currentUser?.id) return;
      const e = await window._subCache.get();
      if (e) {
        this.updateStorageDisplay(e);
        return e;
      }
    } catch (e) {
      safeLog("Error loading storage info:", e);
    }
  }
  updateStorageDisplay(e) {
    const t = this.libraryItems.length;
    const n = e.video_limit || e.videos_space_limit || 2;
    const i = (e.plan || "free").toLowerCase();
    if (typeof window.applyStorageBadgeUI === "function") {
      window.applyStorageBadgeUI({
        used: t,
        limit: n,
        plan: i
      });
    }
    safeLog(`📊 Library storage: ${t} / ${n} (${i})`);
  }
  handleSubscriptionExpiration() {
    if (!this.loadAndDisplayStorageInfo) return;
    this.loadAndDisplayStorageInfo().then(e => {
      if (!e || !e.subscription_end_date) {
        return;
      }
      const t = new Date(e.subscription_end_date);
      const n = new Date;
      if (n > t && e.plan !== "free") {
        showNotification("Your subscription has expired. You are now on the Free plan.", "warning");
        if (this.libraryItems && this.libraryItems.length > 2) {
          showNotification("Your storage has been limited to 2 videos per the Free plan.", "warning");
        }
      }
    }).catch(e => {
      safeLog("Error checking subscription expiration:", e);
    });
  }
  updateLibraryView() {
    if (this.libraryPreviewModalOpen) {
      this._libraryRefreshPending = true;
      safeLog("â¸ï¸ Library update deferred: preview modal open");
      return;
    }
    this.hideLibrarySkeleton();
    this.loadAndDisplayStorageInfo();
    this.handleSubscriptionExpiration();
    const e = document.getElementById("libraryGrid");
    const t = document.getElementById("emptyLibraryState");
    if (!e || !t) return;
    if (!Array.isArray(this.libraryItems)) {
      this.libraryItems = [];
    }
    if (!Array.isArray(this.processingItems)) {
      this.processingItems = [];
    }
    if (this.libraryItems.length === 0) {
      t.style.display = "block";
      e.classList.add("is-empty");
      e.innerHTML = "";
      e.appendChild(t);
      document.getElementById("libraryLoadMoreFab")?.remove();
      if (this._librarySentinelObserver) {
        this._librarySentinelObserver.disconnect();
        this._librarySentinelObserver = null;
      }
      return;
    }
    t.style.display = "none";
    e.classList.remove("is-empty");
    if (this._libraryRenderFrame) {
      cancelAnimationFrame(this._libraryRenderFrame);
    }
    this._libraryRenderFrame = requestAnimationFrame(() => {
      this._libraryRenderFrame = null;
      const n = 8;
      if (this._librarySentinelObserver) {
        this._librarySentinelObserver.disconnect();
        this._librarySentinelObserver = null;
      }
      if (!this._durationCache) this._durationCache = {};
      if (this._durationObservers) {
        this._durationObservers.forEach(e => e.disconnect());
      }
      this._durationObservers = [];
      const i = this.getSortedLibraryItems(this.libraryItems);
      let r = 0;
      const buildCard = e => {
        const t = sanitizeHTML(e.name);
        const n = isValidImageUrl(e.thumbnailUrl) ? e.thumbnailUrl : "/assets/no-image-placeholder.svg";
        const i = document.createElement("div");
        i.className = "library-card";
        i.setAttribute("data-id", e.id);
        i.setAttribute("data-project-id", e.projectId);
        i.innerHTML = `\n                <div class="card-preview">\n                    <div class="status-pill">\n                        <div class="status-dot"></div>\n                        <span class="status-text">Ready</span>\n                    </div>\n                    <img src="${n}" alt="Asset Preview" loading="lazy"\n                         onerror="this.src='/assets/no-image-placeholder.svg'">\n                    <div class="card-actions">\n                        <button class="card-action-btn library-delete-btn" data-item-id="${e.id}" title="Delete clip" type="button">\n                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                                <path d="M3 6h18"/>\n                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>\n                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>\n                                <line x1="10" y1="11" x2="10" y2="17"/>\n                                <line x1="14" y1="11" x2="14" y2="17"/>\n                            </svg>\n                        </button>\n                    </div>\n                </div>\n                <div class="card-content">\n                    <h2 class="card-title" title="${t}">${t}</h2>\n                    <div class="card-footer">\n                        <div class="badge">\n                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>\n                            </svg>\n                            <span class="duration-text">${e.duration || "—"}</span>\n                        </div>\n                        <button class="export-btn library-download-btn" data-project-id="${e.projectId}" title="Download clip" type="button">\n                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>\n                                <polyline points="7 10 12 15 17 10"/>\n                                <line x1="12" y1="15" x2="12" y2="3"/>\n                            </svg>\n                            <span>Download</span>\n                        </button>\n                    </div>\n                </div>`;
        if (typeof storeLibraryCard === "function") {
          storeLibraryCard(e.id, {
            id: e.id,
            html: i.innerHTML,
            classList: i.className,
            dataAttributes: {
              "data-id": e.id
            }
          });
        }
        const r = String(e.projectId);
        if (r && this._durationCache[r]) {
          const e = i.querySelector(".duration-text");
          if (e) e.textContent = this._durationCache[r];
        } else if (r) {
          let e = null;
          const t = new IntersectionObserver(n => {
            if (n[0].isIntersecting) {
              e = setTimeout(() => {
                t.disconnect();
                if (window.__solisDownloadBusy) return;
                fetch(`/api/clips/duration/${r}`, {
                  method: "GET",
                  credentials: "include"
                }).then(async e => {
                  if (!e.ok) return null;
                  try {
                    return await e.json();
                  } catch (e) {
                    return null;
                  }
                }).then(e => {
                  if (e?.duration_formatted) {
                    this._durationCache[r] = e.duration_formatted;
                    const t = i.querySelector(".duration-text");
                    if (t) t.textContent = e.duration_formatted;
                  }
                }).catch(() => {});
              }, 400);
            } else {
              if (e) {
                clearTimeout(e);
                e = null;
              }
            }
          }, {
            rootMargin: "0px",
            threshold: .1
          });
          t.observe(i);
          this._durationObservers.push(t);
        }
        return i;
      };
      const appendBatch = () => {
        const t = Math.min(r + n, i.length);
        if (r >= i.length) return;
        const o = document.createDocumentFragment();
        for (let e = r; e < t; e++) {
          o.appendChild(buildCard(i[e]));
        }
        r = t;
        e.querySelector(".library-scroll-sentinel")?.remove();
        document.getElementById("libraryLoadMoreFab")?.remove();
        if (this._librarySentinelObserver) {
          this._librarySentinelObserver.disconnect();
          this._librarySentinelObserver = null;
        }
        e.appendChild(o);
        if (r < i.length) {
          const t = i.length - r;
          const n = document.createElement("div");
          n.className = "library-scroll-sentinel";
          n.setAttribute("aria-hidden", "true");
          e.appendChild(n);
          const o = document.getElementById("clipsContainer");
          this._librarySentinelObserver = new IntersectionObserver(e => {
            if (!e.some(e => e.isIntersecting)) return;
            if (r >= i.length) return;
            if (this._libraryAppending) return;
            this._libraryAppending = true;
            try {
              appendBatch();
            } finally {
              this._libraryAppending = false;
            }
          }, {
            root: o || null,
            rootMargin: "280px 0px",
            threshold: 0
          });
          this._librarySentinelObserver.observe(n);
          const s = document.createElement("button");
          s.type = "button";
          s.id = "libraryLoadMoreFab";
          s.className = "library-load-sentinel";
          s.setAttribute("aria-label", `Load more — ${t} clip${t !== 1 ? "s" : ""} left`);
          s.title = "Load more";
          s.innerHTML = `\n                    <span class="library-load-hint" aria-hidden="true">\n                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>\n                    </span>`;
          (o || e).appendChild(s);
          s.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            if (this._libraryAppending) return;
            this._libraryAppending = true;
            try {
              appendBatch();
            } finally {
              this._libraryAppending = false;
            }
            if (o) {
              requestAnimationFrame(() => {
                const e = Math.round(Math.min(o.clientHeight * .55, 420));
                o.scrollBy({
                  top: e,
                  behavior: "smooth"
                });
              });
            }
          }, {
            once: true
          });
        }
      };
      Array.from(e.children).forEach(e => {
        if (!e.classList.contains("empty-state")) e.remove();
      });
      document.getElementById("libraryLoadMoreFab")?.remove();
      if (!i.length) {
        t.style.display = "block";
        e.classList.add("is-empty");
        if (!t.isConnected) e.appendChild(t);
        const n = t.querySelector("h3");
        const i = t.querySelector("p");
        if (n) n.textContent = "No clips for this sort";
        if (i) i.textContent = "Try Newest, or another filter.";
        return;
      }
      const o = t.querySelector("h3");
      const s = t.querySelector("p");
      if (o) o.textContent = "No clips yet";
      if (s) s.textContent = "Start creating clips to build your library";
      appendBatch();
      this.setupWebSocketHandlers();
      if (e && !e._hasClickListener) {
        e._hasClickListener = true;
        e.addEventListener("click", e => {
          const t = e.target.closest(".library-download-btn");
          if (t) {
            e.preventDefault();
            e.stopPropagation();
            const n = t.getAttribute("data-project-id");
            if (n && clipsStudio) clipsStudio.downloadClip(n);
            return;
          }
          const n = e.target.closest(".library-delete-btn");
          if (n) {
            e.preventDefault();
            e.stopPropagation();
            const t = n.getAttribute("data-item-id");
            if (t && clipsStudio) clipsStudio.deleteClip(t);
            return;
          }
          const i = e.target.closest(".library-card");
          if (i && !e.target.closest(".library-download-btn, .library-delete-btn")) {
            e.preventDefault();
            e.stopPropagation();
            const t = i.getAttribute("data-id");
            const n = i.getAttribute("data-project-id");
            if (t && clipsStudio) clipsStudio.openLibraryPreview(t, n, i);
          }
        });
      }
    });
  }
  deleteClip(e) {
    safeLog(`ðŸ—‘ï¸ Delete initiated for item: ${e}`);
    const t = this.libraryItems.find(t => t.id == e) || this.processingItems.find(t => t.id == e);
    if (!t) {
      safeLog(`âŒ Item not found: ${e}`);
      showNotification("Clip not found", "error");
      return;
    }
    safeLog(`ðŸ“ Item found:`, t);
    if (t.status === "processing") {
      safeLog(`⚠ï¸ Cannot delete processing item: ${e}`);
      showNotification("Cannot delete items while processing. Wait for completion or cancel first.", "warning");
      return;
    }
    const n = document.getElementById("deleteConfirmationModal");
    const i = document.getElementById("deleteModalTitle");
    const r = document.getElementById("deleteConfirmationText");
    const o = n?.querySelector(".delete-modal-warning");
    let s = document.getElementById("confirmDeleteBtn");
    if (!n || !r || !s) {
      showNotification("Error: Delete modal not available", "error");
      return;
    }
    safeLog("Modal elements found, showing confirmation");
    if (i) i.textContent = "Delete clip";
    if (o) o.textContent = "Associated files are deleted and cannot be recovered.";
    s.textContent = "Delete clip";
    const a = t.name || "this clip";
    r.textContent = `You're about to permanently remove "${a}" from your library.`;
    if (s._eventControllers) {
      Object.values(s._eventControllers).forEach(e => {
        try {
          e.abort();
        } catch (e) {}
      });
      s._eventControllers = {};
    }
    const l = new AbortController;
    if (!s._eventControllers) s._eventControllers = {};
    s._eventControllers["click"] = l;
    s.addEventListener("click", async () => {
      safeLog(`🔄 Confirm button clicked for item: ${e}`);
      l.abort();
      try {
        n.classList.remove("show");
        showNotification("Deleting clip...", "info");
        if (t.projectId) {
          safeLog(`📤 Deleting project from server: ${t.projectId}`);
          await this.deleteProjectFromServer(t.projectId);
        }
        safeLog(`ðŸ—„ï¸ Removing from local arrays`);
        this.libraryItems = this.libraryItems.filter(t => t.id != e);
        this.processingItems = this.processingItems.filter(t => t.id != e);
        if (t.projectId) {
          this.processingItems = this.processingItems.filter(e => e.projectId != t.projectId);
        }
        safeLog(`Updating views and saving`);
        this.updateLibraryView();
        this.updateProcessingView();
        this.updateRecentActivity();
        this.saveLibraryItems();
        this.saveProcessingItems();
        this.invalidateLibraryCache();
        this._writeLibrarySessionCache();
        safeLog(`Updating storage badge from backend`);
        if (typeof updateStorageBadgeDisplay === "function") {
          await updateStorageBadgeDisplay();
        }
        safeLog(`✅ Clip deleted successfully`);
        showNotification("Clip deleted successfully", "success");
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (e) {
        showNotification("Failed to delete clip: " + e.message, "error");
      } finally {
        n.classList.remove("show");
      }
    }, {
      once: true
    });
    n.classList.add("show");
    safeLog("📋 Modal displayed");
    const closeOnBackdropClick = e => {
      if (e.target === n) {
        safeLog("🚫 Modal closed by backdrop click");
        n.classList.remove("show");
        document.removeEventListener("click", closeOnBackdropClick);
      }
    };
    document.addEventListener("click", closeOnBackdropClick);
  }
  async deleteProjectFromServer(e) {
    try {
      if (!e || typeof e !== "string") {
        throw new Error("Invalid project ID format");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(e) || e.length < 10) {
        throw new Error("Invalid project ID format");
      }
      const t = getAuthHeaders();
      const n = await fetch(`${API_BASE_URL}/clips/project/${e}`, {
        method: "DELETE",
        headers: t,
        credentials: "include"
      });
      if (!n.ok) {
        const e = await n.json().catch(() => ({}));
        throw new Error(e.error || `Server error: ${n.status}`);
      }
      const i = await n.json();
      return true;
    } catch (e) {
      const t = sanitizeErrorMessage(e);
      showNotification(`Warning: Failed to delete files on server`, "warning");
      safeLog("Delete error (sanitized for user):", t);
      return false;
    }
  }
  filterLibrary(e) {
    const t = this.libraryItems.filter(t => {
      if (e === "all") return true;
      if (e === "recent") {
        const e = new Date;
        e.setDate(e.getDate() - 7);
        return new Date(t.timestamp) > e;
      }
      if (e === "favorites") {
        return true;
      }
      return true;
    });
    showNotification(`Filtered by: ${e}`, "info");
  }
  _readLibrarySortMode() {
    try {
      const e = localStorage.getItem("solisLibrarySort");
      if ([ "newest", "oldest", "ranking", "split" ].includes(e)) return e;
      if (e === "name_asc" || e === "name_desc") return "newest";
    } catch (e) {}
    return "newest";
  }
  _librarySortLabel(e = this.librarySortMode) {
    return {
      newest: "Newest",
      oldest: "Oldest",
      ranking: "Ranking",
      split: "Split"
    }[e] || "Sort";
  }
  _libraryItemTemplateKey(e) {
    return `${e?.template || ""} ${e?.templateName || ""}`.toLowerCase();
  }
  _isRankingLibraryItem(e) {
    const t = this._libraryItemTemplateKey(e);
    return t.includes("rank") || t.includes("compilation");
  }
  _isSplitLibraryItem(e) {
    const t = this._libraryItemTemplateKey(e);
    return t.includes("split");
  }
  getSortedLibraryItems(e) {
    const t = Array.isArray(e) ? [ ...e ] : [];
    const ts = e => {
      const t = e?.timestamp;
      if (t instanceof Date) return t.getTime();
      const n = Date.parse(t);
      return Number.isFinite(n) ? n : 0;
    };
    let n = t;
    if (this.librarySortMode === "ranking") {
      n = t.filter(e => this._isRankingLibraryItem(e));
    } else if (this.librarySortMode === "split") {
      n = t.filter(e => this._isSplitLibraryItem(e));
    }
    if (this.librarySortMode === "oldest") {
      return n.sort((e, t) => ts(e) - ts(t));
    }
    return n.sort((e, t) => ts(t) - ts(e));
  }
  setLibrarySortMode(e) {
    if (![ "newest", "oldest", "ranking", "split" ].includes(e)) return;
    this.librarySortMode = e;
    try {
      localStorage.setItem("solisLibrarySort", e);
    } catch (e) {}
    this._syncLibrarySortUI();
    this.closeLibrarySortMenu();
    this.updateLibraryView();
  }
  _syncLibrarySortUI() {
    const e = document.getElementById("sortLibraryLabel");
    if (e) e.textContent = this._librarySortLabel();
    document.querySelectorAll(".library-sort-option").forEach(e => {
      const t = e.dataset.sort === this.librarySortMode;
      e.classList.toggle("is-active", t);
      e.setAttribute("aria-selected", t ? "true" : "false");
    });
  }
  openLibrarySortMenu() {
    const e = document.getElementById("librarySortWrap");
    const t = document.getElementById("sortLibraryBtn");
    if (!e || !t) return;
    e.classList.add("is-open");
    t.setAttribute("aria-expanded", "true");
    this._syncLibrarySortUI();
  }
  closeLibrarySortMenu() {
    const e = document.getElementById("librarySortWrap");
    const t = document.getElementById("sortLibraryBtn");
    if (e) e.classList.remove("is-open");
    if (t) t.setAttribute("aria-expanded", "false");
  }
  toggleLibrarySortMenu() {
    const e = document.getElementById("librarySortWrap");
    if (!e) return;
    if (e.classList.contains("is-open")) this.closeLibrarySortMenu(); else this.openLibrarySortMenu();
  }
  _initLibrarySortControls() {
    window.toggleLibrarySortMenu = () => {
      try {
        this.toggleLibrarySortMenu();
      } catch (e) {
        safeLog("toggleLibrarySortMenu", e);
      }
    };
    window.setLibrarySortMode = e => {
      try {
        this.setLibrarySortMode(e);
      } catch (e) {
        safeLog("setLibrarySortMode", e);
      }
    };
    window.closeLibrarySortMenu = () => {
      try {
        this.closeLibrarySortMenu();
      } catch (e) {}
    };
    this._syncLibrarySortUI();
    this.closeLibrarySortMenu();
    if (!this._librarySortOutsideBound) {
      this._librarySortOutsideBound = true;
      document.addEventListener("click", e => {
        const t = document.getElementById("librarySortWrap");
        if (!t || !t.classList.contains("is-open")) return;
        if (t.contains(e.target)) return;
        this.closeLibrarySortMenu();
      });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") this.closeLibrarySortMenu();
      });
    }
  }
  manualRefresh() {
    this.loadLibraryItems();
    this.loadProcessingItems();
    showNotification("Library refreshed", "info");
  }
  saveProcessingItems() {
    try {
      if (!this.processingItems || this.processingItems.length === 0) {
        localStorage.removeItem("clipsProcessing");
        return;
      }
      const e = JSON.stringify(this.processingItems);
      localStorage.setItem("clipsProcessing", e);
      safeLog(`✓ Saved ${this.processingItems.length} processing item(s)`);
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        safeLog("Storage quota exceeded - clearing old data");
        this.clearOldProcessingData();
        try {
          localStorage.setItem("clipsProcessing", JSON.stringify(this.processingItems));
        } catch (e) {
          safeLog("Failed to save even after cleanup:", e);
        }
      } else {
        safeLog("Failed to save processing items:", e);
      }
    }
  }
  async loadProcessingItems() {
    try {
      const e = localStorage.getItem("clipsProcessing");
      if (e) {
        this.processingItems = JSON.parse(e);
        const t = Date.now();
        const n = 24 * 60 * 60 * 1e3;
        this.processingItems = this.processingItems.filter(e => {
          if (e.status === "completed" || e.status === "failed") {
            safeLog(`🧹 Cleaning up ${e.status} item: ${e.name}`);
            return false;
          }
          const i = t - (e.timestamp ? new Date(e.timestamp).getTime() : t);
          if (i > n) {
            safeLog(`🧹 Removing stale processing item (${Math.round(i / 1e3 / 60)} min old): ${e.name}`);
            return false;
          }
          return true;
        });
        this.saveProcessingItems();
        this.updateProcessingView();
        this.updateLibraryView();
        safeLog(`✓ Loaded ${this.processingItems.length} processing item(s)`);
        if (this.processingItems.length > 0) {
          const e = typeof initGenerationProgressSpinner === "function" ? initGenerationProgressSpinner() : window.generationProgressSpinner;
          if (e) {
            for (const t of this.processingItems) {
              if (!t.projectId || !this.validateProjectId(t.projectId)) continue;
              if (t.status === "processing" || t.status === "waiting" || t.status === "pending") {
                e.restoreGeneration(t.projectId, t.progress || 0, t.message || "Resuming...", "processing");
              }
            }
          }
        }
      }
    } catch (e) {
      safeLog("Failed to load processing items:", e);
      this.processingItems = [];
      this.saveProcessingItems();
      this.updateLibraryView();
    }
  }
  saveLibraryItems() {
    try {
      if (!this.libraryItems || this.libraryItems.length === 0) {
        localStorage.removeItem("clipsLibrary");
        this._clearLibrarySessionCache();
        return;
      }
      const e = JSON.stringify(this.libraryItems);
      localStorage.setItem("clipsLibrary", e);
      this._writeLibrarySessionCache();
      safeLog(`✓ Saved ${this.libraryItems.length} library item(s)`);
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        safeLog("Storage quota exceeded - clearing old data");
        this.clearOldLibraryData();
        try {
          localStorage.setItem("clipsLibrary", JSON.stringify(this.libraryItems));
          this._writeLibrarySessionCache();
        } catch (e) {
          safeLog("Failed to save even after cleanup:", e);
        }
      } else {
        safeLog("Failed to save library items:", e);
      }
    }
  }
  clearProcessingItems() {
    safeLog(`🧹 Clearing ${this.processingItems.length} processing items`);
    this.processingItems = [];
    this.stopAllMonitoring();
    this.saveProcessingItems();
    this.updateLibraryView();
    showNotification("Cleared all processing items", "info");
  }
  loadLibraryItemsFromStorage() {
    try {
      const e = localStorage.getItem("clipsLibrary");
      if (e) {
        this.libraryItems = JSON.parse(e);
        this.updateLibraryView();
        this.updateRecentActivity();
        safeLog(`✓ Loaded ${this.libraryItems.length} library item(s)`);
      }
    } catch (e) {
      safeLog("Failed to load library items:", e);
      this.libraryItems = [];
    }
  }
  clearOldLibraryData() {
    if (this.libraryItems.length > 50) {
      this.libraryItems = this.libraryItems.sort((e, t) => new Date(t.timestamp) - new Date(e.timestamp)).slice(0, 50);
      safeLog("Cleaned up old library items, keeping 50 most recent");
    }
  }
  clearOldProcessingData() {
    const e = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    this.processingItems = this.processingItems.filter(t => {
      if (t.status === "completed" && t.timestamp < e) {
        return false;
      }
      return true;
    });
    safeLog("Cleaned up old processing items");
  }
  setupWebSocketHandlers() {
    if (this._webSocketHandlersSetup) {
      return;
    }
    if (!solisWSClient) {
      safeLog("WebSocket client not available yet, retrying in 1 second...");
      if (!this._webSocketRetryScheduled) {
        this._webSocketRetryScheduled = true;
        setTimeout(() => {
          this._webSocketRetryScheduled = false;
          this.setupWebSocketHandlers();
        }, 1e3);
      }
      return;
    }
    this._webSocketHandlersSetup = true;
    solisWSClient.on("progress", e => {
      const {taskId: t, progress: n, step: i, status: r, project_id: o} = e;
      const s = o || t;
      if (typeof n !== "number" || isNaN(n) || n < 0 || n > 100) {
        safeLog(`⚠ï¸ Invalid progress value received: ${n}`);
        return;
      }
      const a = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      if (a?.updateProgress && s) {
        const e = a._resolveActiveProjectId?.(s) || s;
        if (a.activeGenerations?.has?.(e) || a.activeGenerations?.has?.(s)) {
          a.updateProgress(e, n, i || r || "Processing...", true);
        }
      }
    });
    solisWSClient.on("complete", e => {
      const {taskId: t, result: n} = e;
      safeLog(`✅ Video ${t} completed, moving to library...`);
      const i = this.processingItems.findIndex(e => e.id === t);
      if (i === -1) {
        safeLog(`âŒ Processing item not found: ${t}`);
        return;
      }
      const r = this.processingItems[i];
      const o = document.querySelector(`[data-processing-id="${t}"]`);
      const s = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      const a = n?.project_id || r?.projectId;
      if (s?.completeGeneration && a) {
        s.completeGeneration(a);
      }
      const finishToLibrary = () => {
        const e = this.processingItems.findIndex(e => e.id === t);
        if (e !== -1) this.processingItems.splice(e, 1);
        this.saveProcessingItems();
        const i = {
          id: n?.project_id || t,
          projectId: n?.project_id || t,
          name: r.name,
          template: r.template || r.templateName || "Clip",
          templateName: r.templateName || r.template || "Clip",
          thumbnailUrl: n?.thumbnail_url || r.thumbnailUrl || "",
          duration: n?.duration || r.duration || "0s",
          timestamp: (new Date).toISOString(),
          status: "completed",
          _optimistic: true
        };
        this.libraryItems = this.libraryItems.filter(e => String(e.projectId || e.id) !== String(i.projectId));
        this.libraryItems.unshift(i);
        this.saveLibraryItems();
        this.updateLibraryView();
        this.openLibraryPreviewWhenReady(i.id, i.projectId);
        this.loadStorageInfo();
        safeLog(`✅ Moved ${r.name} to library`);
      };
      if (o) {
        o.classList.add("unblurring");
        setTimeout(finishToLibrary, 600);
      } else {
        finishToLibrary();
      }
    });
    solisWSClient.on("error", e => {
      const {taskId: t, error: n} = e;
      safeLog(`âŒ Video ${t} failed: ${n}`);
      const i = document.querySelector(`[data-processing-id="${t}"]`);
      if (i) {
        i.style.opacity = "0.5";
        const e = i.querySelector(".card-title");
        if (e) {
          e.textContent = "Failed - " + e.textContent;
        }
      }
      const r = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      if (r?.failGeneration && t) {
        r.failGeneration(t, n || "There was an error — try again");
      }
      const o = this.processingItems.findIndex(e => e.id === t);
      if (o !== -1) {
        this.processingItems.splice(o, 1);
        this.saveProcessingItems();
      }
    });
    solisWSClient.on("processing_error", e => {
      const {taskId: t, error: n, message: i} = e;
      const r = i || n || "Unknown processing error";
      safeLog(`âŒ Processing failed: ${r}`);
      const o = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      if (o?.failGeneration && t) {
        o.failGeneration(t, r);
      }
      const s = document.querySelector(`[data-processing-id="${t}"]`);
      if (s) {
        s.style.opacity = "0.5";
        s.style.borderColor = "#ef4444";
        s.style.borderWidth = "2px";
        const e = s.querySelector(".card-title");
        if (e) {
          e.textContent = "âŒ Failed";
        }
        const t = s.querySelector(".card-subtitle") || s.querySelector(".card-status");
        if (t) {
          let e = r;
          if (r.includes("Video is too long")) {
            const t = r.match(/(\d+)\s*minute/g);
            e = r;
          }
          t.textContent = e.substring(0, 100);
          t.title = e;
        }
      }
      const a = this.processingItems.findIndex(e => e.id === t);
      if (a !== -1) {
        this.processingItems.splice(a, 1);
        this.saveProcessingItems();
      }
    });
    safeLog("✅ WebSocket handlers initialized");
  }
  safeAddEventListener(e, t, n) {
    const i = document.querySelectorAll(e);
    i.forEach(i => {
      if (!i._eventControllers) i._eventControllers = {};
      const r = `${t}_${e}`;
      if (i._eventControllers[r]) {
        i._eventControllers[r].abort();
      }
      const o = new AbortController;
      i._eventControllers[r] = o;
      i.addEventListener(t, n, {
        signal: o.signal
      });
    });
  }
  safeAddEventListenerById(e, t, n) {
    const i = document.getElementById(e);
    if (i) {
      safeLog(`✅ Found element with id: ${e}`);
      if (!i._eventControllers) {
        i._eventControllers = {};
      }
      const r = `${t}_${e}`;
      if (i._eventControllers[r]) {
        i._eventControllers[r].abort();
      }
      const o = new AbortController;
      i._eventControllers[r] = o;
      i.addEventListener(t, n, {
        signal: o.signal
      });
    } else {
      safeLog(`⚠️ Element not found with id: ${e}`);
    }
  }
  _bindUseTemplateFabSync() {
    const e = document.getElementById("confirmUseTemplateBtn");
    if (!e || e.dataset.fabSyncBound === "1") {
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
      return;
    }
    e.dataset.fabSyncBound = "1";
    const sync = () => {
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
    };
    sync();
    try {
      const t = new MutationObserver(sync);
      t.observe(e, {
        attributes: true,
        attributeFilter: [ "disabled", "class", "aria-disabled" ],
        childList: true,
        characterData: true,
        subtree: true
      });
      this._useTemplateFabObserver = t;
    } catch (e) {}
  }
  _bindTemplateSheetDrag() {
    const e = document.getElementById("templateSheetHandle");
    const t = document.querySelector(".template-preview-sidebar");
    if (!e || !t || e.dataset.dragBound === "1") return;
    e.dataset.dragBound = "1";
    let n = false;
    let i = 0;
    let r = 0;
    let o = 0;
    let s = 0;
    let a = 0;
    const peekY = () => Math.max(0, (t.offsetHeight || 280) - 36);
    const readY = () => {
      const e = /translateY\(([-\d.]+)px\)/.exec(t.style.transform || "");
      if (e) return parseFloat(e[1]);
      return t.classList.contains("expanded") ? 0 : peekY();
    };
    const onDown = l => {
      if (window.innerWidth > 768) return;
      if (l.pointerType === "mouse" && l.button !== 0) return;
      n = true;
      i = l.clientY;
      o = l.clientY;
      s = performance.now();
      a = 0;
      r = readY();
      t.classList.add("is-dragging");
      t.style.transition = "none";
      try {
        e.setPointerCapture(l.pointerId);
      } catch (e) {}
      l.preventDefault();
    };
    const onMove = e => {
      if (!n) return;
      const l = performance.now();
      const c = e.clientY - i;
      const d = peekY();
      let p = Math.min(d, Math.max(0, r + c));
      t.style.transform = `translateY(${p}px)`;
      const u = Math.max(1, l - s);
      a = (e.clientY - o) / u;
      o = e.clientY;
      s = l;
    };
    const onUp = () => {
      if (!n) return;
      n = false;
      t.classList.remove("is-dragging");
      t.style.transition = "";
      const e = peekY();
      const i = readY();
      const r = a < -.45;
      const o = a > .45;
      const s = r || !o && i < e * .55;
      t.style.transform = "";
      t.classList.toggle("expanded", s);
    };
    e.addEventListener("pointerdown", onDown, {
      passive: false
    });
    e.addEventListener("pointermove", onMove, {
      passive: true
    });
    e.addEventListener("pointerup", onUp, {
      passive: true
    });
    e.addEventListener("pointercancel", onUp, {
      passive: true
    });
    e.addEventListener("click", e => {
      if (window.innerWidth > 768) return;
      if (Math.abs(o - i) > 10) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      t.classList.toggle("expanded");
    });
  }
}

function initClipsStudio() {
  if (!window.clipsStudio) {
    clipsStudio = new ClipsStudio;
    clipsStudio.init();
    window.clipsStudio = clipsStudio;
    setTimeout(() => {}, 500);
  }
  if (window.clipsStudio && typeof window.clipsStudio._initLibrarySortControls === "function") {
    window.clipsStudio._initLibrarySortControls();
  }
}

if (typeof window.toggleLibrarySortMenu !== "function") {
  window.toggleLibrarySortMenu = function() {
    if (window.clipsStudio?.toggleLibrarySortMenu) window.clipsStudio.toggleLibrarySortMenu();
  };
}

if (typeof window.setLibrarySortMode !== "function") {
  window.setLibrarySortMode = function(e) {
    if (window.clipsStudio?.setLibrarySortMode) window.clipsStudio.setLibrarySortMode(e);
  };
}

window._comprehensiveLogout = function logout() {
  if (window._logoutInProgress) return;
  window._logoutInProgress = true;
  stopTokenRefreshInterval();
  window.currentUser = null;
  currentUser = null;
  tokens = 1500;
  isRecording = false;
  mediaRecorder = null;
  audioChunks = [];
  isGenerating = false;
  currentChatId = null;
  currentAbortController = null;
  uploadedFiles = [];
  promptCount = 0;
  selectedGameplayClip = "minecraft_1";
  splitscreenInverted = true;
  splitscreenSecondaryType = "face_track";
  splitscreenContentRatio = .5;
  splitscreenSavedRatio = .5;
  splitscreenSecondaryCollapsed = false;
  gpPillAnchor = null;
  availableGameplayClips = [];
  updateUIForGuest();
  if (window.AbortController) {
    if (window.libraryPollingAbort) {
      window.libraryPollingAbort.abort();
    }
  }
  if (typeof apiCache !== "undefined" && apiCache) {
    apiCache.userProfile = null;
    apiCache.userProfileTime = 0;
    apiCache.userProfileETag = null;
    apiCache.clearPendingRequest();
  }
  window.dispatchEvent(new CustomEvent("userDisconnected", {
    detail: {}
  }));
  showNotification("Signed out successfully", "success");
  const e = localStorage.getItem("theme");
  localStorage.clear();
  sessionStorage.clear();
  if (e) localStorage.setItem("theme", e);
  const t = window.apiUrl ? window.apiUrl("/api/auth/logout") : (window.API_BASE_URL || window.location.origin + "/api") + "/auth/logout";
  sessionStorage.setItem("solis_just_logged_out", "1");
  sessionStorage.setItem("solis_skip_auth_redirect", "1");
  fetch(t, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  }).catch(() => {}).finally(() => {
    window.location.replace("/login.html?logout=1");
  });
};

function setupEventListeners() {
  const e = document.getElementById("userSettingsBtn");
  if (e) {
    e.addEventListener("click", e => {
      e.stopPropagation();
      toggleUserMenu(e);
    });
  }
  const t = document.getElementById("dropdownLogout");
  if (t) {
    t.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      (window._comprehensiveLogout || logout)();
    });
  }
  const n = document.getElementById("menuSettings");
  if (n) {
    n.addEventListener("click", e => {
      e.stopPropagation();
      openSettings();
    });
  }
  if (settingsBtn) {
    settingsBtn.addEventListener("click", openSettings);
  }
  if (closeSettings) {
    closeSettings.addEventListener("click", closeSettingsPanel);
  }
  const i = document.getElementById("clearChatHistoryBtn");
  if (i) {
    i.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete all chat history? This action cannot be undone.")) {
        clearChat();
        clipsStudio.showNotification("Chat history cleared", "success");
      }
    });
  }
  const r = document.querySelector(".settings-backdrop");
  if (r) {
    r.addEventListener("click", closeSettingsPanel);
  }
  const o = localStorage.getItem("theme");
  if (o) {
    setTheme(o);
    if (darkModeSettingsToggle) {
      darkModeSettingsToggle.checked = o === "dark";
    }
  }
  if (darkModeSettingsToggle) {
    safeLog("setupEventListeners(): darkModeSettingsToggle element found.");
    if (darkModeSettingsToggle.tagName !== "INPUT" || darkModeSettingsToggle.type !== "checkbox") {
      safeLog("setupEventListeners(): darkModeSettingsToggle is not an input checkbox. Dark mode functionality may be impaired.");
    }
    darkModeSettingsToggle.addEventListener("change", () => {
      const e = darkModeSettingsToggle.checked ? "dark" : "light";
      safeLog("darkModeSettingsToggle change event fired. New theme:", e);
      setTheme(e);
    });
  }
  const s = document.getElementById("shuffleIdeasBtn");
  if (s) {
    s.addEventListener("click", generateVideoIdeas);
  }
  const a = document.getElementById("watermarkToggle");
  if (a) {
    const e = localStorage.getItem("watermarkEnabled");
    a.checked = e === "true";
  }
  checkYouTubeConnection();
}

if (upgradeSettingsBtn) {
  upgradeSettingsBtn.addEventListener("click", openUpgradeModal);
}

if (closeUpgrade) {
  closeUpgrade.addEventListener("click", closeUpgradeModal);
}

const clipsToggle = document.getElementById("clips-toggle");

if (clipsToggle) {
  clipsToggle.addEventListener("click", function(e) {
    e.stopPropagation();
    const t = document.getElementById("clips-submenu");
    const n = this.querySelector(".chevron-icon");
    if (t) t.classList.toggle("open");
    if (n) n.classList.toggle("rotated");
  });
}

navItems.forEach(e => {
  e.addEventListener("click", () => {
    if (!e.closest(".clips-submenu")) {
      navItems.forEach(e => {
        if (e.id !== "clips-toggle" && !e.closest(".clips-submenu")) {
          e.classList.remove("active");
        }
      });
      if (e.id !== "clips-toggle") {
        e.classList.add("active");
      }
    }
    const t = e.dataset.target;
    if (t) {
      navigateTo(t);
      if (window.innerWidth <= 768 && sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
      }
    }
  });
});

document.addEventListener("click", e => {
  if (userMenu && !userMenu.contains(e.target) && userProfile && !userProfile.contains(e.target)) {
    userMenu.classList.remove("active");
    userProfile.classList.remove("menu-open");
  }
  if (upgradeModal && !upgradeModal.contains(e.target) && e.target !== upgradeSettingsBtn) {
    closeUpgradeModal();
  }
  if (e.target.classList.contains("feature-modal")) {
    e.target.style.display = "none";
  }
});

document.addEventListener("visibilitychange", () => {
  try {
    if (document.hidden) {
      dockInputInstantly();
    }
  } catch (e) {
    safeLog("visibilitychange handler error", e);
  }
});

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    toggleSidebar();
  }
});

function toggleSidebar() {
  sidebar.classList.toggle("expanded");
  const e = sidebar.classList.contains("expanded");
  localStorage.setItem("sidebarExpanded", e);
}

function toggleUserMenu(e) {
  safeLog("toggleUserMenu called but deprecated - use menu.js instead");
  if (!userMenu || !userProfile) return;
  e.stopPropagation();
}

function openSettings() {
  if (!settingsPanel) return;
  settingsPanel.classList.add("open");
  const e = document.getElementById("settingsBackdrop");
  if (e) {
    e.style.opacity = "1";
    e.style.visibility = "visible";
  }
  if (userMenu) userMenu.classList.remove("active");
  if (currentUser) {
    fetchAndUpdateSubscriptionStatus();
  }
}

function closeSettingsPanel() {
  if (!settingsPanel) return;
  settingsPanel.classList.remove("open");
  const e = document.getElementById("settingsBackdrop");
  if (e) {
    e.style.opacity = "0";
    e.style.visibility = "hidden";
  }
}

async function checkYouTubeConnection() {
  const e = document.getElementById("analyticsLockOverlay");
  const t = document.getElementById("dashboardGrid");
  const n = document.querySelector(".dashboard-charts");
  if (!e) return;
  e.style.display = "flex";
  if (t) t.classList.add("analytics-locked");
  if (n) n.classList.add("analytics-locked");
  if (!currentUser) currentUser = {};
  currentUser.youtube_connected = false;
}

function initiateYouTubeConnection() {
  if (window.__ytOAuthInFlight) {
    safeLog("YouTube OAuth already in progress, ignoring duplicate trigger");
    return;
  }
  if (!currentUser) {
    alert("Please log in first to connect YouTube");
    return;
  }
  window.__ytOAuthInFlight = true;
  fetch(`${window.API_BASE_URL}/auth/youtube/authorize`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include"
  }).then(e => {
    if (!e.ok) {
      throw new Error(`HTTP ${e.status}: ${e.statusText}`);
    }
    return e.json();
  }).then(e => {
    if (!e.auth_url) {
      throw new Error("No authorization URL received from server");
    }
    safeLog("✓ Got OAuth URL from backend");
    const t = 500;
    const n = 600;
    const i = (window.innerWidth - t) / 2;
    const r = (window.innerHeight - n) / 2;
    const o = window.open(e.auth_url, "YouTubeOAuth", `width=${t},height=${n},left=${i},top=${r},noopener,noreferrer`);
    if (!o) {
      safeLog("⚠ï¸ Popup blocked, falling back to redirect");
      window.location.href = e.auth_url;
    } else {
      safeLog("✓ OAuth window opened");
      const e = function handleOAuthMessage(e) {
        const n = [ window.location.origin ];
        if (!n.includes(e.origin)) {
          safeLog("🔒 Blocked postMessage from untrusted origin:", e.origin);
          return;
        }
        if (e.data.type === "YOUTUBE_AUTH_SUCCESS") {
          safeLog("✅ YouTube authentication successful!");
          window.removeEventListener("message", handleOAuthMessage);
          clearInterval(t);
          window.__ytOAuthInFlight = false;
          setTimeout(() => {
            checkYouTubeConnection();
            if (typeof analyticsManager !== "undefined" && analyticsManager) {
              analyticsManager.loadAnalyticsData();
            }
            showNotification("✅ YouTube connected successfully!", "success");
          }, 1e3);
        } else if (e.data.type === "YOUTUBE_AUTH_ERROR") {
          safeLog("âœ— Authentication error:", e.data.error);
          window.removeEventListener("message", handleOAuthMessage);
          clearInterval(t);
          window.__ytOAuthInFlight = false;
          showNotification(`âœ— YouTube connection failed: ${e.data.error}`, "error");
        }
      };
      window.addEventListener("message", e);
      let t = setInterval(() => {
        try {
          if (o.closed) {
            clearInterval(t);
            safeLog("🔄 OAuth window closed, verifying connection...");
            window.__ytOAuthInFlight = false;
            window.removeEventListener("message", e);
            setTimeout(() => {
              verifyToken();
              checkYouTubeConnection();
            }, 2e3);
          }
        } catch (e) {}
      }, 500);
    }
  }).catch(e => {
    window.__ytOAuthInFlight = false;
    safeLog("âŒ YouTube connection error:", e);
    showNotification(`âœ— Failed to initiate YouTube connection: ${e.message}`, "error");
  });
}

function setTheme(e) {
  currentTheme = e;
  safeLog("setTheme(): Applying theme:", e);
  document.documentElement.setAttribute("data-theme", e);
  localStorage.setItem("theme", e);
  safeLog("setTheme(): Theme saved to localStorage. Current stored theme:", localStorage.getItem("theme"));
}

async function handleClipCompilationRequest(e, t) {
  try {
    if (!currentUser) {
      addMessageToChat("ai", "âŒ Please log in to create clip compilations. Click the login button in the top right.");
      return;
    }
    showClipConfirmationDialog(e, t);
  } catch (e) {
    safeLog("Clip compilation error:", e);
    addMessageToChat("ai", `âŒ Error: ${e.message}`);
  }
}

function showClipConfirmationDialog(e, t) {
  const n = document.createElement("div");
  n.className = "clip-confirm-modal";
  n.innerHTML = `\n        <style>\n            .clip-confirm-modal {\n                position: fixed;\n                top: 0;\n                left: 0;\n                right: 0;\n                bottom: 0;\n                background: rgba(0, 0, 0, 0.6);\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                z-index: 10000;\n                animation: fadeIn 0.2s ease;\n            }\n\n            @keyframes fadeIn {\n                from { opacity: 0; }\n                to { opacity: 1; }\n            }\n\n            .clip-confirm-dialog {\n                background: var(--surface);\n                border: 1px solid var(--border);\n                border-radius: 12px;\n                padding: 32px;\n                max-width: 420px;\n                animation: slideUp 0.3s ease;\n                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n            }\n\n            @keyframes slideUp {\n                from { transform: translateY(20px); opacity: 0; }\n                to { transform: translateY(0); opacity: 1; }\n            }\n\n            .clip-confirm-header {\n                display: flex;\n                align-items: center;\n                gap: 12px;\n                margin-bottom: 16px;\n            }\n\n            .clip-confirm-header h2 {\n                margin: 0;\n                font-size: 18px;\n                color: var(--text);\n                font-weight: 600;\n            }\n\n            .clip-confirm-content {\n                margin-bottom: 24px;\n            }\n\n            .clip-confirm-content p {\n                margin: 0 0 12px 0;\n                color: var(--muted);\n                font-size: 14px;\n                line-height: 1.6;\n            }\n\n            .clip-confirm-url {\n                padding: 12px;\n                background: rgba(255, 107, 53, 0.1);\n                border: 1px solid rgba(255, 107, 53, 0.2);\n                border-radius: 6px;\n                font-size: 12px;\n                color: var(--muted);\n                word-break: break-all;\n                font-family: monospace;\n            }\n\n            .clip-confirm-actions {\n                display: flex;\n                gap: 12px;\n                justify-content: flex-end;\n            }\n\n            .clip-btn {\n                padding: 10px 20px;\n                border: none;\n                border-radius: 8px;\n                cursor: pointer;\n                font-weight: 600;\n                font-size: 14px;\n                transition: all 0.2s ease;\n            }\n\n            .clip-btn-reject {\n                background: rgba(255, 107, 53, 0.1);\n                color: var(--muted);\n            }\n\n            .clip-btn-reject:hover {\n                background: rgba(255, 107, 53, 0.2);\n            }\n\n            .clip-btn-accept {\n                background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n                color: white;\n            }\n\n            .clip-btn-accept:hover {\n                transform: translateY(-2px);\n                box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);\n            }\n        </style>\n\n        <div class="clip-confirm-dialog">\n            <div class="clip-confirm-header">\n                <span style="font-size: 20px;">🎬</span>\n                <h2>Create Clip Compilation</h2>\n            </div>\n\n            <div class="clip-confirm-content">\n                <p>Ready to create a clip compilation from your YouTube video?</p>\n                <div class="clip-confirm-url" id="urlDisplay"></div>\n                <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">This may take a few minutes. You can monitor progress in the Processing tab.</p>\n            </div>\n\n            <div class="clip-confirm-actions">\n                <button class="clip-btn clip-btn-reject" id="clipConfirmCancel">\n                    ✕ Cancel\n                </button>\n                <button class="clip-btn clip-btn-accept" id="clipConfirmAccept">\n                    ✓ Create Compilation\n                </button>\n            </div>\n        </div>\n    `;
  document.body.appendChild(n);
  const i = document.getElementById("urlDisplay");
  if (i) {
    i.textContent = t;
  }
  document.getElementById("clipConfirmCancel").addEventListener("click", () => {
    n.remove();
  });
  document.getElementById("clipConfirmAccept").addEventListener("click", async () => {
    n.remove();
    window.location.hash = "#/clips";
    setTimeout(() => {
      startClipCompilation(t);
    }, 500);
  });
  n.addEventListener("click", e => {
    if (e.target === n) {
      n.remove();
    }
  });
}

async function startClipCompilation(e) {
  try {
    const t = getAuthHeaders();
    const n = clipsStudio ? clipsStudio.extractYouTubeVideoId(e) : null;
    sessionStorage.setItem("clipProcessing", JSON.stringify({
      videoId: n,
      startTime: Date.now()
    }));
    const i = document.createElement("div");
    i.id = "clip-processing-modal";
    i.innerHTML = `\n            <style>\n                #clip-processing-modal {\n                    position: fixed;\n                    top: 0;\n                    left: 0;\n                    right: 0;\n                    bottom: 0;\n                    background: linear-gradient(135deg, #fff5eb 0%, #ffe4d1 100%);\n                    display: flex;\n                    flex-direction: column;\n                    align-items: center;\n                    justify-content: center;\n                    z-index: 99999;\n                    overflow: hidden;\n                }\n\n                .clip-processing-container {\n                    text-align: center;\n                    position: relative;\n                    z-index: 10;\n                }\n\n                .clip-atom {\n                    width: 140px;\n                    height: 140px;\n                    margin: 0 auto 32px;\n                }\n\n                .clip-atom svg {\n                    width: 100%;\n                    height: 100%;\n                    filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.3));\n                }\n\n                .clip-nucleus {\n                    animation: nucleusPulse 1.5s ease-in-out infinite;\n                    transform-origin: center;\n                }\n\n                @keyframes nucleusPulse {\n                    0% { transform: scale(0.8); opacity: 0.6; }\n                    50% { transform: scale(1); opacity: 1; }\n                    100% { transform: scale(0.8); opacity: 0.6; }\n                }\n\n                .clip-orbit {\n                    transform-origin: 50px 50px;\n                    stroke-dasharray: 300;\n                    stroke-dashoffset: 300;\n                }\n\n                .clip-orbit-1 {\n                    transform: rotate(75deg);\n                    animation: drawOrbit 1.5s ease-in-out infinite;\n                }\n\n                .clip-orbit-2 {\n                    transform: rotate(-20deg);\n                    animation: drawOrbit 1.5s ease-in-out 0.3s infinite;\n                }\n\n                @keyframes drawOrbit {\n                    0% { stroke-dashoffset: 300; opacity: 0.3; }\n                    50% { stroke-dashoffset: 0; opacity: 0.7; }\n                    100% { stroke-dashoffset: 300; opacity: 0.3; }\n                }\n\n                .clip-title {\n                    font-size: 28px;\n                    font-weight: 700;\n                    color: #1a1a1a;\n                    margin-bottom: 8px;\n                }\n\n                .clip-subtitle {\n                    font-size: 14px;\n                    color: #666;\n                    margin-bottom: 32px;\n                }\n\n                .clip-progress-container {\n                    width: 280px;\n                    margin: 0 auto 24px;\n                }\n\n                .clip-progress-bar {\n                    width: 100%;\n                    height: 4px;\n                    background: rgba(255, 107, 53, 0.15);\n                    border-radius: 2px;\n                    overflow: hidden;\n                    margin-bottom: 12px;\n                }\n\n                .clip-progress-fill {\n                    height: 100%;\n                    background: linear-gradient(90deg, #ff6b35 0%, #ff8856 100%);\n                    width: 0%;\n                    transition: width 0.4s ease;\n                    border-radius: 2px;\n                }\n\n                .clip-stats {\n                    display: flex;\n                    justify-content: space-between;\n                    gap: 20px;\n                    margin-top: 24px;\n                    padding: 16px;\n                    background: rgba(255, 107, 53, 0.08);\n                    border-radius: 8px;\n                }\n\n                .clip-stat {\n                    text-align: center;\n                }\n\n                .clip-stat-value {\n                    font-size: 20px;\n                    font-weight: 700;\n                    color: #ff6b35;\n                }\n\n                .clip-stat-label {\n                    font-size: 11px;\n                    color: #999;\n                    margin-top: 4px;\n                    text-transform: uppercase;\n                    letter-spacing: 0.05em;\n                }\n            </style>\n\n            <div class="clip-processing-container">\n                <div class="clip-atom">\n                    <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">\n                        <g class="clip-nucleus">\n                            <circle cx="50" cy="50" r="8" fill="#ff6b35"/>\n                            <circle cx="50" cy="50" r="12" fill="#ff6b35" opacity="0.3"/>\n                        </g>\n                        <ellipse class="clip-orbit clip-orbit-1" rx="45" ry="25" cx="50" cy="50" stroke="#ff6b35" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>\n                        <ellipse class="clip-orbit clip-orbit-2" rx="45" ry="25" cx="50" cy="50" stroke="#ff6b35" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>\n                    </svg>\n                </div>\n\n                <h1 class="clip-title">Cooking!</h1>\n                <p class="clip-subtitle" id="clipStatus">HAHAHAHA</p>\n\n                <div class="clip-progress-container">\n                    <div class="clip-progress-bar">\n                        <div class="clip-progress-fill" id="clipProgressFill"></div>\n                    </div>\n                    <div style="display: flex; justify-content: space-between; gap: 12px;">\n                        <span id="clipProgress" style="font-size: 12px; color: #999;">0%</span>\n                        <span id="clipTimeLeft" style="font-size: 12px; color: #999;">--:--</span>\n                    </div>\n                </div>\n\n                <div class="clip-stats">\n                    <div class="clip-stat">\n                        <div class="clip-stat-value" id="clipStatDownload">0%</div>\n                        <div class="clip-stat-label">Downloading</div>\n                    </div>\n                    <div class="clip-stat">\n                        <div class="clip-stat-value" id="clipStatProcessing">0%</div>\n                        <div class="clip-stat-label">Processing</div>\n                    </div>\n                    <div class="clip-stat">\n                        <div class="clip-stat-value" id="clipStatRendering">0%</div>\n                        <div class="clip-stat-label">Rendering</div>\n                    </div>\n                </div>\n            </div>\n        `;
    document.body.appendChild(i);
    const r = await fetch(`${API_BASE_URL}/clips/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...t
      },
      credentials: "include",
      body: JSON.stringify({
        url: e,
        template_id: "splitscreen",
        gameplay_clip_id: splitscreenSecondaryType === "gameplay" ? selectedGameplayClip : splitscreenSecondaryType,
        splitscreen_inverted: splitscreenInverted,
        splitscreen_secondary_type: splitscreenSecondaryType,
        splitscreen_content_ratio: splitscreenContentRatio,
        splitscreen_secondary_collapsed: splitscreenSecondaryCollapsed
      })
    });
    if (!r.ok) {
      let e = "Failed to start processing";
      let t = "";
      try {
        const n = await r.json();
        e = n.error || e;
        t = n.error_code || "";
      } catch (t) {
        e = `Server error: ${r.status}`;
      }
      if (t === "GENERATION_COOLDOWN") {
        const t = await r.json();
        const n = t.remaining_seconds || t.cooldown_seconds || 30;
        const i = Math.floor(n / 60);
        const o = n % 60;
        startCooldownTimer(n);
        let s = "";
        if (i > 0) {
          s = `in ${i}m ${o}s`;
        } else {
          s = `in ${n}s`;
        }
        e = `You can generate another video ${s}.`;
      }
      i.innerHTML = `\n                <div style="text-align: center;">\n                    <div style="font-size: 48px; margin-bottom: 16px;">âŒ</div>\n                    <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Error</h1>\n                    <p style="color: var(--muted); margin-bottom: 24px;">${e}</p>\n                    <button onclick="this.closest('#clip-processing-modal').remove()" style="\n                        padding: 10px 20px;\n                        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n                        color: white;\n                        border: none;\n                        border-radius: 8px;\n                        cursor: pointer;\n                        font-weight: 600;\n                    ">Close</button>\n                </div>\n            `;
      return;
    }
    const o = await r.json();
    const s = o.project_id;
    const a = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
    if (a) {
      a.startGeneration(s, "Starting generation...", "splitscreen", {
        secondaryType: splitscreenSecondaryType
      });
    }
    let l = false;
    let c = 0;
    const d = 300;
    let p = Date.now();
    let u = null;
    while (!l && c < d) {
      c++;
      try {
        const e = await fetch(`${API_BASE_URL}/clips/status/${s}`, {
          headers: t,
          credentials: "include"
        });
        if (e.ok) {
          let t;
          try {
            t = await e.json();
          } catch (e) {
            safeLog("Status JSON parse error:", e);
            await new Promise(e => setTimeout(e, 2e3));
            continue;
          }
          const n = t.status || "processing";
          const r = t.progress || 0;
          const o = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
          if (o) {
            const e = {
              downloading: "Downloading video...",
              processing: "Processing moments...",
              rendering: "Rendering video...",
              completed: "Complete!"
            };
            const t = e[n] || `${n}...`;
            o.updateProgress(s, r, t);
          }
          const a = Date.now() - p;
          const c = a / 1e3;
          if (r > 0 && !u) {
            u = c / r * 100;
          }
          const d = u ? u * (100 - r) / 100 * 1e3 : 0;
          const m = Math.floor(d / 6e4);
          const f = Math.floor(d % 6e4 / 1e3);
          const y = document.getElementById("clipStatus");
          if (n === "downloading") {
            document.getElementById("clipStatDownload").textContent = `${Math.min(r, 99)}%`;
          } else if (n === "processing") {
            document.getElementById("clipStatProcessing").textContent = `${Math.min(r, 99)}%`;
          } else if (n === "rendering") {
            document.getElementById("clipStatRendering").textContent = `${Math.min(r, 99)}%`;
          }
          if (n === "completed") {
            l = true;
            sessionStorage.removeItem("clipProcessing");
            const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
            if (e) {
              e.completeGeneration(s);
            }
            i.innerHTML = `\n                            <div style="text-align: center; animation: slideUp 0.3s ease;">\n                                <div style="font-size: 80px; margin-bottom: 16px; animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">✅</div>\n                                <h1 style="font-size: 32px; color: var(--text); margin-bottom: 8px; font-weight: 700;">Compilation Ready!</h1>\n                                <p style="color: var(--muted); margin-bottom: 32px;">Your video is ready to edit and publish</p>\n                                <button onclick="\n                                    document.getElementById('clip-processing-modal').remove();\n                                    window.location.hash = '#/clips';\n                                " style="\n                                    padding: 12px 24px;\n                                    background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n                                    color: white;\n                                    border: none;\n                                    border-radius: 8px;\n                                    cursor: pointer;\n                                    font-weight: 600;\n                                    font-size: 14px;\n                                    transition: all 0.2s;\n                                " onmouseover="this.style.transform='translateY(-2px); this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'>\n                                    📎 Open Project\n                                </button>\n                            </div>\n                            <style>\n                                @keyframes popIn {\n                                    0% { transform: scale(0.3); opacity: 0; }\n                                    70% { transform: scale(1.1); }\n                                    100% { transform: scale(1); opacity: 1; }\n                                }\n                                @keyframes slideUp {\n                                    from { transform: translateY(20px); opacity: 0; }\n                                    to { transform: translateY(0); opacity: 1; }\n                                }\n                            </style>\n                        `;
          } else if (n === "failed") {
            l = true;
            sessionStorage.removeItem("clipProcessing");
            i.innerHTML = `\n                            <div style="text-align: center;">\n                                <div style="font-size: 48px; margin-bottom: 16px;">âŒ</div>\n                                <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Processing Failed</h1>\n                                <p style="color: var(--muted); margin-bottom: 24px;">${t.message || "Unknown error"}</p>\n                                <button onclick="this.closest('#clip-processing-modal').remove()" style="\n                                    padding: 10px 20px;\n                                    background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n                                    color: white;\n                                    border: none;\n                                    border-radius: 8px;\n                                    cursor: pointer;\n                                    font-weight: 600;\n                                ">Close</button>\n                            </div>\n                        `;
          }
        }
      } catch (e) {
        safeLog("Status poll error:", e);
      }
      if (!l) {
        await new Promise(e => setTimeout(e, 2e3));
      }
    }
    if (!l) {
      sessionStorage.removeItem("clipProcessing");
      i.innerHTML = `\n                <div style="text-align: center;">\n                    <div style="font-size: 48px; margin-bottom: 16px;">â±ï¸</div>\n                    <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Processing Timeout</h1>\n                    <p style="color: var(--muted); margin-bottom: 24px;">Your compilation is still being processed. Check back in a moment.</p>\n                    <button onclick="this.closest('#clip-processing-modal').remove(); window.location.hash = '#/clips'" style="\n                        padding: 10px 20px;\n                        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n                        color: white;\n                        border: none;\n                        border-radius: 8px;\n                        cursor: pointer;\n                        font-weight: 600;\n                    ">View in Clips</button>\n                </div>\n            `;
    }
  } catch (e) {
    safeLog("Clip compilation error:", e);
    document.getElementById("clip-processing-modal")?.remove();
    addMessageToChat("ai", `âŒ Error: ${e.message}`);
  }
}

async function generateVideoIdeas() {
  const e = [ "Create a fast-paced gaming montage with epic plays and reactions", "Make a 30-second motivational workout compilation with trending music", "Put together viral dance clips from your latest YouTube video", "Compile your best commentary moments into shareable shorts", "Create a highlight reel of epic fails and funny moments", "Make a trending audio mashup with video clips synced to the beat", "Compile before and after transformation clips", "Create a speed painting or creation process video", 'Make a "Day in my life" quick clips compilation', "Create a tutorial snippet series from your longer videos", "Compile your best one-liners and funny quotes", "Make a seasonal/holiday themed clip collection", "Create a reaction compilation video", "Compile jaw-dropping moments and plot twists", 'Make a "Top 10 moments" video from your content' ];
  const t = e[Math.floor(Math.random() * e.length)];
  if (userInput) {
    userInput.value = t;
    userInput.focus();
    userInput.dispatchEvent(new Event("input"));
  }
  const n = document.getElementById("shuffleIdeasBtn");
  if (n) {
    n.style.animation = "none";
    setTimeout(() => {
      n.style.animation = "spin 0.6s ease-in-out";
    }, 10);
  }
}

function addMessageToChat(e, t) {
  if (!chatContainer) return;
  const n = document.createElement("div");
  n.className = `message-row ${e}-message-row`;
  const i = document.createElement("div");
  i.className = `message ${e}-message`;
  i.innerHTML = `\n        <div class="message-content">\n            ${formatMessageContent(t)}\n        </div>\n        <div class="message-actions">\n            <button class="message-action copy-btn" title="Copy">\n                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>\n            </button>\n        </div>\n    `;
  const r = i.querySelector(".copy-btn");
  r.addEventListener("click", () => {
    navigator.clipboard.writeText(t).then(() => {
      r.classList.add("copied");
      r.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        r.classList.remove("copied");
        r.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2e3);
    }).catch(e => {
      safeLog("Failed to copy:", e);
    });
  });
  n.appendChild(i);
  chatContainer.appendChild(n);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  window.dispatchEvent(new CustomEvent("messageAdded"));
  if (e === "user" || !isGenerating) {
    chatHistory.push({
      sender: e,
      content: t,
      timestamp: (new Date).toISOString()
    });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  }
}

function startNewChat() {
  if (chatContainer && chatContainer.children.length > 1 || welcomeCard && !welcomeCard.classList.contains("hidden")) {
    if (confirm("Start a new chat? Current chat will be cleared.")) {
      clearChat();
    }
  }
}

function clearChat() {
  if (!chatContainer) return;
  while (chatContainer.firstChild) {
    chatContainer.removeChild(chatContainer.firstChild);
  }
  if (welcomeCard) {
    chatContainer.appendChild(welcomeCard);
    welcomeCard.classList.remove("hidden");
  }
  uploadedFiles = [];
  const e = document.getElementById("filePreviewContainer");
  if (e) {
    e.innerHTML = "";
    e.classList.remove("active");
  }
  promptCount = 0;
  const t = document.querySelector(".input-section");
  const n = t ? t.querySelector(".input-container") : null;
  if (n) {
    n.classList.add("first-prompt");
  }
  if (t) {
    t.classList.add("is-first-prompt");
  }
  chatHistory = [];
  localStorage.removeItem("chatHistory");
}

function openUpgradeModal() {
  if (!upgradeModal) return;
  upgradeModal.classList.add("active");
}

function closeUpgradeModal() {
  if (!upgradeModal) return;
  upgradeModal.classList.remove("active");
}

function navigateTo(e) {
  navItems.forEach(t => {
    t.classList.remove("active");
    if (t.dataset.target === e) {
      t.classList.add("active");
    }
  });
  switch (e) {
   case "chat":
    if (promptCount === 0) {
      const e = document.querySelector(".input-section");
      const t = e ? e.querySelector(".input-container") : null;
      if (t) {
        t.classList.add("first-prompt");
      }
      if (e) {
        e.classList.add("is-first-prompt");
      }
    }
    break;

   case "history":
    openHistory();
    break;

   case "saved":
    openSaved();
    break;

   default:
    break;
  }
}

function updateTokenDisplay() {
  if (tokenCount) {
    tokenCount.textContent = tokens.toLocaleString();
  }
}

function showUpgradePrompt() {
  const e = `💡 You have ${tokens} tokens remaining. Running low? <a href="/premium.html" style="color: #ff6b35; font-weight: 700; text-decoration: underline;">Upgrade now</a> for unlimited access!`;
  addMessageToChat("ai", e);
}

function checkPremiumAccess() {
  if (!currentUser) {
    showNotification("Please sign in to access premium features", "error");
    return false;
  }
  if (currentUser.plan === "free") {
    showNotification("This is a premium feature. Please upgrade your plan.", "error");
    return false;
  }
  return true;
}

function loadSaved() {
  const e = document.getElementById("savedList");
  if (!e) return;
  const t = JSON.parse(localStorage.getItem("savedResults") || "[]");
  if (t.length === 0) {
    e.innerHTML = "<p>No saved items.</p>";
    return;
  }
  e.innerHTML = t.map((e, t) => `\n        <div class="saved-item">\n            <div class="saved-type">${e.type}</div>\n            <div class="saved-preview">${e.content.substring(0, 100)}...</div>\n            <div class="saved-date">${new Date(e.timestamp).toLocaleDateString()}</div>\n            <button onclick="viewSavedItem(${t})">View</button>\n        </div>\n    `).join("");
}

function viewSavedItem(e) {
  const t = JSON.parse(localStorage.getItem("savedResults") || "[]");
  const n = t[e];
  if (n) {
    alert(`Saved ${n.type}:\n\n${n.content}`);
  }
}

function showError(e, t) {
  const n = document.getElementById(e);
  if (!n) return;
  n.style.display = "block";
  n.innerHTML = "";
  const i = document.createElement("div");
  i.className = "error-message";
  i.textContent = t;
  n.appendChild(i);
}

function copyToClipboard(e) {
  navigator.clipboard.writeText(e).then(() => {
    showNotification("Copied to clipboard!", "success");
  });
}

function saveResult(e, t) {
  const n = JSON.parse(localStorage.getItem("savedResults") || "[]");
  n.push({
    type: e,
    content: t,
    timestamp: (new Date).toISOString()
  });
  localStorage.setItem("savedResults", JSON.stringify(n));
  showNotification("Saved successfully!", "success");
}

(function() {
  const e = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", e);
})();

window.testTemplatePreview = function() {
  const e = document.getElementById("previewTemplateName");
  const t = document.getElementById("previewTemplateDescription");
  const n = document.getElementById("previewVideoDuration");
  const i = document.getElementById("previewVideoFormat");
  safeLog("🧪 TEMPLATE PREVIEW TEST:");
  safeLog("  previewTemplateName:", e ? "✅ FOUND" : "âŒ NOT FOUND");
  safeLog("  previewTemplateDescription:", t ? "✅ FOUND" : "âŒ NOT FOUND");
  safeLog("  previewVideoDuration:", n ? "✅ FOUND" : "âŒ NOT FOUND");
  safeLog("  previewVideoFormat:", i ? "✅ FOUND" : "âŒ NOT FOUND");
  if (e) {
    e.textContent = "TEST: Ranking Moments";
    safeLog("  ✅ Updated template name");
  }
  if (t) {
    t.textContent = "TEST: This is a test video title";
    safeLog("  ✅ Updated template description");
  }
  if (n) {
    n.textContent = "~3m 20s";
    safeLog("  ✅ Updated duration");
  }
  if (i) {
    i.textContent = "YouTube Shorts";
    safeLog("  ✅ Updated format");
  }
  safeLog("If you see the TEST values in the template preview, the elements work!");
};

safeLog("✅ testTemplatePreview() is ready - run it in console");

async function restoreGenerationStateFromServer() {
  try {
    const e = getAuthHeaders();
    const t = await fetch(`${API_BASE_URL}/clips/status`, {
      method: "GET",
      headers: e,
      credentials: "include"
    });
    if (t.ok) {
      const e = await t.json();
      const n = document.getElementById("processUrlBtn");
      if (!n) return;
      if (e.is_generating) {
        n.disabled = true;
        n.style.opacity = "0.5";
        n.style.cursor = "not-allowed";
        n.classList.add("is-generating");
        showNotification("A video is already being generated. Please wait for it to complete.", "warning");
      } else {
        n.disabled = false;
        n.style.opacity = "1";
        n.style.cursor = "pointer";
        n.classList.remove("is-generating");
        sessionStorage.removeItem("urlButtonLocked");
        sessionStorage.removeItem("urlButtonLockeduntil");
      }
    } else {
      console.warn("[STATE RESTORE] Failed to check generation state:", t.status);
    }
  } catch (e) {
    console.warn("[STATE RESTORE] Could not restore generation state:", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restoreGenerationStateFromServer();
  const e = sessionStorage.getItem("clipProcessing");
  if (e) {
    try {
      const t = JSON.parse(e);
      setTimeout(() => {
        startClipCompilation(t.url);
      }, 500);
    } catch (e) {
      safeLog("Failed to restore clip processing:", e);
      sessionStorage.removeItem("clipProcessing");
    }
  }
  loadAvailableGameplayClips();
  if (typeof clipsStudio !== "undefined" && clipsStudio && typeof clipsStudio.init === "function") {
    clipsStudio.init();
    if (typeof clipsStudio.setupWatermarkToggle === "function") {
      clipsStudio.setupWatermarkToggle();
    }
  } else {
    init();
  }
});

window.getWatermarkState = function() {
  const e = document.getElementById("watermarkToggle");
  if (e) return Boolean(e.checked);
  const t = localStorage.getItem("watermarkEnabled");
  if (t != null) return t === "true";
  const n = String(window.currentUser?.plan || "free").toLowerCase();
  const i = n === "basic" || n === "prime" || n === "elite";
  return !i;
};

window.goToCreateUrlSubmit = function() {
  if (window.clipsStudio && typeof window.clipsStudio.goToCreateUrlSubmit === "function") {
    return window.clipsStudio.goToCreateUrlSubmit();
  }
  const e = document.getElementById("portalContainer");
  const t = document.getElementById("clipsContainer");
  if (e) {
    e.style.display = "none";
    e.classList.remove("active");
  }
  if (t) {
    t.style.display = "block";
    t.classList.add("active");
  }
  try {
    localStorage.setItem("currentNavigationTarget", "clips");
  } catch (e) {}
  if (typeof window.switchClipsTab === "function") {
    const e = document.querySelector('.clips-sub-item[data-tab="create"]');
    window.switchClipsTab("create", e);
  }
  setTimeout(() => {
    document.getElementById("urlInputStack")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    document.getElementById("youtubeUrlInput")?.focus();
    document.getElementById("processUrlBtn")?.classList.add("needs-url-pulse");
  }, 80);
};

window.getWatermarkParams = function() {
  return {
    add_watermark: window.getWatermarkState()
  };
};
