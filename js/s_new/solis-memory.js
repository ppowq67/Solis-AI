(function() {
  const e = "solis_template_memory";
  const t = "solis_caption_by_template";
  const n = "solis_session_style_draft";
  const s = "solis_memory_owner_id";
  const i = "solis_template_memory";
  const o = "solis_caption_by_template";
  const r = 5;
  const l = 900;
  const a = 999;
  const c = 40;
  const u = 1200;
  const f = 45 * 1e3;
  const p = 18 * 1e3;
  const g = 20 * 1e3;
  const y = new Set;
  function isRankingTemplate(e) {
    const t = String(e || "").toLowerCase();
    return t === "ranked_compilation" || t === "ranking" || t.includes("rank");
  }
  function isSplitscreenTemplate(e) {
    const t = String(e || "").toLowerCase();
    return t === "splitscreen" || t.includes("split");
  }
  function templateMemoryProfile(e) {
    if (isRankingTemplate(e)) {
      return {
        styles: true,
        layout: false,
        captions: false,
        rankingOverlay: true
      };
    }
    return {
      styles: isRankingTemplate(e),
      layout: isSplitscreenTemplate(e),
      captions: !isRankingTemplate(e),
      rankingOverlay: false
    };
  }
  function sanitizeRankingOverlay(e) {
    if (!e || typeof e !== "object") return null;
    const t = Number(e.y_pct);
    if (!Number.isFinite(t)) return null;
    return {
      y_pct: Math.max(.02, Math.min(.98, t)),
      enabled: e.enabled !== false
    };
  }
  function rankingOverlayForSuggest(e) {
    if (!e || typeof e !== "object") return null;
    const t = e.lastGeneratedOverlay || e.overlayPosition;
    return sanitizeRankingOverlay(t);
  }
  function rankingOverlayDiffers(e, t) {
    const n = rankingOverlayForSuggest(e);
    if (!n) return false;
    const s = sanitizeRankingOverlay(collectLiveCaptions(t));
    if (!s) return true;
    return Math.abs(Number(n.y_pct) - Number(s.y_pct)) > .015;
  }
  function sanitizeForTemplate(e, {styles: t = null, captions: n = null, layout: s = null} = {}) {
    const i = templateMemoryProfile(e);
    let o = null;
    if (i.rankingOverlay) {
      o = sanitizeRankingOverlay(n);
    } else if (i.captions && n && typeof n === "object" && Object.keys(n).length) {
      o = n;
    }
    return {
      styles: i.styles && t && typeof t === "object" && Object.keys(t).length ? t : null,
      captions: o,
      layout: i.layout && layoutUseful(s) ? normalizeLayout(s) : null
    };
  }
  function layoutUseful(e) {
    if (!e || typeof e !== "object") return false;
    if (e.splitscreen_secondary_type) return true;
    const t = Number(e.splitscreen_content_ratio);
    return Number.isFinite(t);
  }
  function normalizeLayout(e) {
    if (!e || typeof e !== "object") return null;
    const t = {
      ...e
    };
    const n = Number(t.splitscreen_content_ratio);
    if (Number.isFinite(n)) {
      t.splitscreen_content_ratio = Math.max(.02, Math.min(.98, n));
    }
    if (t.splitscreen_secondary_type) {
      t.splitscreen_secondary_type = String(t.splitscreen_secondary_type).toLowerCase();
    }
    return t;
  }
  const d = 1;
  const m = {
    karaoke: "word-by-word",
    word: "word-by-word",
    words: "word-by-word",
    sentence: "sentence",
    line: "line-by-line",
    fade: "fade",
    pop: "pop",
    bounce: "bounce",
    typewriter: "typewriter",
    highlight: "highlight",
    none: "static",
    static: "static",
    center: "centered"
  };
  function memColorName(e) {
    const t = String(e || "").trim().replace(/^#/, "");
    if (!t || t === "transparent") return null;
    const n = t.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!n) return null;
    const s = parseInt(n[1], 16);
    const i = parseInt(n[2], 16);
    const o = parseInt(n[3], 16);
    if (s > 200 && i < 150 && o < 90) return "orange";
    if (s > 210 && i > 170 && o < 90) return "gold";
    if (i > s + 30 && i > o + 20) return "green";
    if (o > s + 30 && o > i + 10) return "blue";
    if (s > 180 && o > 140 && i < 140) return "pink";
    if (s > 200 && i < 100 && o < 100) return "red";
    if (s > 220 && i > 220 && o > 220) return "white";
    if (s < 45 && i < 45 && o < 45) return "black";
    return null;
  }
  function memFontShort(e) {
    const t = String(e || "").replace(/['"]/g, "").split(",")[0].trim();
    if (!t) return null;
    const n = t.replace(/\s+(Bold|Black|ExtraBold|SemiBold|Medium|Regular|Light)$/i, "").trim();
    return n.length > 18 ? `${n.slice(0, 16)}…` : n;
  }
  function memHashSeed(e) {
    const t = String(e || "");
    let n = 0;
    for (let e = 0; e < t.length; e++) n = (n << 5) - n + t.charCodeAt(e) | 0;
    return Math.abs(n);
  }
  function memPick(e, t) {
    if (!e || !e.length) return "";
    return e[memHashSeed(t) % e.length];
  }
  function suggestHookLine({captions: e = null, styles: t = null, layout: n = null, mode: s = "captions", seed: i = ""} = {}) {
    const o = e && typeof e === "object" ? e : null;
    const r = String(o?.anim || "").toLowerCase();
    const l = m[r] || (r && r !== "none" ? r : null);
    const a = memColorName(o?.color || o?.highlight || o?.fill);
    const c = memFontShort(o?.font);
    const u = [ a, l, c ].filter(Boolean);
    const f = u.length ? u.slice(0, 2).join(" ") : "your look";
    const p = u.length ? u.join(" · ") : "your look";
    const g = `${s}|${i}|${p}|${String(o?.__tip || "")}`;
    if (s === "tip" || o?.__tip === "animations" || o?.__tip === "captions") {
      return memPick([ "Captions on — keep them?", "Add captions to this clip?", "Keep captions?", "Captions ready — apply?" ], g);
    }
    if (s === "ranking") {
      let e = "your ranking look";
      try {
        const n = t && typeof t === "object" ? t : null;
        if (n) {
          const t = Object.values(n).find(e => e && typeof e === "object" && (e.font || e.color));
          if (t) {
            const n = [ memColorName(t.color), memFontShort(t.font) ].filter(Boolean);
            if (n.length) e = n.join(" ");
          }
        }
      } catch (e) {}
      return memPick([ `Keep ${e}?`, "Your ranking style — apply?", "Same ranking look as last time", "One click. Your ranking again.", "Still you on the board?", `Back to ${e}?` ], g + e);
    }
    if (s === "layout") {
      const e = String(n?.splitscreen_secondary_type || "").replace(/_/g, " ");
      const t = e ? `your ${e} split` : "your split";
      return memPick([ `${t} — keep it?`, "Same split as last time", "Pick up your layout?", "Don’t rebuild the split", "Your composition. Apply?" ], g + e);
    }
    return memPick([ `Your ${f} — keep it?`, `Still rocking ${f}?`, `This is yours. Apply?`, `Back to ${f}?`, "Your signature. One click.", "Don’t start from zero", "Pick up where you left off", `${p} — still you?`, `Solis remembered ${f}`, c ? `Keep ${c}?` : `Keep ${f}?` ], g);
  }
  function trustFields(e, t, {resetOnFpChange: n = true} = {}) {
    const s = !!(e && e.fingerprint && t && e.fingerprint === t);
    if (s || !n) {
      return {
        acceptStreak: Number(e.acceptStreak) || 0,
        acceptFingerprint: e.acceptFingerprint || null,
        autoApply: e.autoApply === false ? false : e.autoApply !== false,
        lastAcceptedAt: e.lastAcceptedAt || null
      };
    }
    return {
      acceptStreak: 0,
      acceptFingerprint: null,
      autoApply: true,
      lastAcceptedAt: null
    };
  }
  function recordSuggestionAccepted(e, t = {}) {
    const n = e || b;
    if (!n || t.tip) return;
    const s = readState();
    const i = s.templates[n];
    if (!i) return;
    const o = i.fingerprint || fingerprint(i.styles, i.captions, i.layout) || i.acceptFingerprint || "ok";
    if (i.acceptFingerprint === o) {
      i.acceptStreak = (Number(i.acceptStreak) || 0) + 1;
    } else {
      i.acceptFingerprint = o;
      i.acceptStreak = 1;
    }
    i.lastAcceptedAt = (new Date).toISOString();
    i.lastRejectedFingerprint = null;
    i.lastRejectedAt = null;
    if (i.acceptStreak >= d) {
      i.autoApply = true;
    }
    writeState(s);
  }
  function clearAcceptTrust(e) {
    const t = e || b;
    if (!t) return;
    const n = readState();
    const s = n.templates[t];
    if (!s) return;
    s.acceptStreak = 0;
    s.acceptFingerprint = null;
    s.autoApply = false;
    writeState(n);
  }
  function shouldAutoApply(e, t) {
    if (!isEnabled() || !isSuggestEnabled()) return false;
    if (isRankingTemplate(e)) return false;
    t = t || getTemplateMemory(e);
    if (!t) return false;
    if (t.autoApply === false) return false;
    if (isLibraryPreviewOpen()) return false;
    const n = t.fingerprint || fingerprint(t.styles, t.captions, t.layout);
    if (t.acceptFingerprint && n && t.acceptFingerprint !== n) return false;
    const s = !!(captionsForSuggest(t, e) || stylesForSuggest(t, e) || layoutUseful(t.layout));
    return s;
  }
  function silentlyApplyMemory(e) {
    const t = getTemplateMemory(e);
    if (!t) return false;
    let n = false;
    try {
      if (window.SolisMemory) window.SolisMemory._applying = true;
      if (isSplitscreenTemplate(e) && layoutUseful(t.layout)) {
        const s = collectLiveLayout(e);
        if (layoutDiffers(t.layout, s) && typeof window.applySplitscreenMemoryLayout === "function") {
          window.applySplitscreenMemoryLayout(t.layout, {
            commit: true
          });
          n = true;
        }
      }
      if (!isRankingTemplate(e)) {
        const s = captionsForSuggest(t, e);
        if (s) {
          const t = smarterCaptions(s, e);
          const i = collectLiveCaptions(e);
          if (!i || captionsDiffer(t, i)) {
            if (applyCaptions(t, e)) n = true;
          }
        }
      }
      if (isRankingTemplate(e)) {
        const s = stylesForSuggest(t, e);
        if (s && Object.keys(s).length) {
          window.__solisRankingDeferCustoms = false;
          applyStyles(e, s);
          n = true;
        }
      }
    } catch (e) {} finally {
      if (window.SolisMemory) window.SolisMemory._applying = false;
    }
    return n;
  }
  function mergeLayouts(e, t) {
    if (!layoutUseful(t) && !layoutUseful(e)) return null;
    if (!layoutUseful(t)) return normalizeLayout(e);
    if (!layoutUseful(e)) return normalizeLayout(t);
    return normalizeLayout({
      ...e,
      ...t,
      splitscreen_secondary_type: t.splitscreen_secondary_type || e.splitscreen_secondary_type,
      splitscreen_content_ratio: Number.isFinite(Number(t.splitscreen_content_ratio)) ? Number(t.splitscreen_content_ratio) : e.splitscreen_content_ratio,
      splitscreen_inverted: t.splitscreen_inverted != null ? !!t.splitscreen_inverted : !!e.splitscreen_inverted,
      splitscreen_secondary_collapsed: t.splitscreen_secondary_collapsed != null ? !!t.splitscreen_secondary_collapsed : !!e.splitscreen_secondary_collapsed,
      gameplay_clip_id: t.gameplay_clip_id != null ? t.gameplay_clip_id : e.gameplay_clip_id
    });
  }
  function readCaptionMap() {
    try {
      const e = _storageKey(t);
      const n = _resolveUserId();
      const s = localStorage.getItem(e) || sessionStorage.getItem(e) || (!n ? localStorage.getItem(o) : null) || (!n ? sessionStorage.getItem(o) : null);
      if (!s) return {};
      const i = JSON.parse(s);
      return i && typeof i === "object" ? i : {};
    } catch (e) {
      return {};
    }
  }
  function writeCaptionMap(e) {
    try {
      const n = _storageKey(t);
      const s = JSON.stringify(e || {});
      localStorage.setItem(n, s);
      sessionStorage.setItem(n, s);
    } catch (e) {}
  }
  function rememberCaptionSnap(e, t) {
    if (!e || !t || typeof t !== "object") return;
    const n = readCaptionMap();
    n[e] = {
      ...t
    };
    writeCaptionMap(n);
    try {
      window.__solisLastCaptionStyle = {
        ...t
      };
      window.__solisLastCaptionStyleTemplateId = e;
    } catch (e) {}
  }
  function recallCaptionSnap(e) {
    if (!e) return null;
    try {
      if (window.__solisLastCaptionStyleTemplateId === e && window.__solisLastCaptionStyle && typeof window.__solisLastCaptionStyle === "object") {
        return {
          ...window.__solisLastCaptionStyle
        };
      }
    } catch (e) {}
    const t = readCaptionMap();
    const n = t[e];
    return n && typeof n === "object" ? {
      ...n
    } : null;
  }
  function _sessionDraftKey() {
    return _storageKey(n);
  }
  function readSessionDraftMap() {
    try {
      const e = sessionStorage.getItem(_sessionDraftKey());
      if (!e) return {};
      const t = JSON.parse(e);
      return t && typeof t === "object" ? t : {};
    } catch (e) {
      return {};
    }
  }
  function writeSessionDraftMap(e) {
    try {
      sessionStorage.setItem(_sessionDraftKey(), JSON.stringify(e || {}));
    } catch (e) {}
  }
  function readSessionDraft(e) {
    if (!e) return null;
    const t = readSessionDraftMap()[e];
    return t && typeof t === "object" ? t : null;
  }
  function writeSessionDraft(e, t) {
    if (!e || !t || typeof t !== "object") return;
    const n = readSessionDraftMap();
    n[e] = {
      ...n[e] || {},
      ...t,
      updatedAt: (new Date).toISOString()
    };
    writeSessionDraftMap(n);
  }
  function clearSessionDraft(e) {
    if (!e) return;
    const t = readSessionDraftMap();
    if (!t[e]) return;
    delete t[e];
    writeSessionDraftMap(t);
  }
  function snapshotSessionDraft(e) {
    const t = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!t || !isEnabled()) return null;
    const n = templateMemoryProfile(t);
    const s = {};
    try {
      if (n.captions) {
        const e = collectLiveCaptions(t, {
          allowSnap: true
        });
        if (e && Object.keys(e).length) {
          s.captions = {
            ...e
          };
          rememberCaptionSnap(t, e);
        }
      }
    } catch (e) {}
    try {
      if (n.styles) {
        const e = collectLiveStyles(t);
        if (e && Object.keys(e).length) s.styles = JSON.parse(JSON.stringify(e));
      }
    } catch (e) {}
    try {
      if (n.layout) {
        const e = collectLiveLayout(t);
        if (layoutUseful(e)) s.layout = JSON.parse(JSON.stringify(e));
      }
    } catch (e) {}
    if (!Object.keys(s).length) return null;
    writeSessionDraft(t, s);
    try {
      upsertTemplateMemory(t, {
        captions: s.captions || undefined,
        styles: s.styles || undefined,
        layout: s.layout || undefined,
        source: "close"
      });
    } catch (e) {}
    try {
      if (s.captions) {
        window.__solisCaptionsOptedIn = true;
        window.__solisCaptionsClearedForGenerate = false;
      }
    } catch (e) {}
    return s;
  }
  function blendSessionPrefs(e, t) {
    if (!e || typeof e !== "object") return e;
    if (!t || typeof t !== "object") return {
      ...e
    };
    const n = {
      ...e
    };
    [ "font", "color", "highlight", "shadow", "fill", "anim" ].forEach(e => {
      if (t[e] != null && t[e] !== "") n[e] = t[e];
    });
    if (Number.isFinite(Number(t.font_size)) && Number(t.font_size) >= 28) {
      n.font_size = Number(t.font_size);
    }
    if (Number.isFinite(Number(t.font_size_ratio)) && Number(t.font_size_ratio) > 0) {
      n.font_size_ratio = Number(t.font_size_ratio);
    }
    if (Number.isFinite(Number(t.y_pct))) {
      n.y_pct = Math.max(.02, Math.min(.98, Number(t.y_pct)));
    }
    return n;
  }
  let S = null;
  let w = 0;
  let h = false;
  let b = null;
  let k = null;
  let _ = false;
  let M = null;
  let v = null;
  let C = false;
  function _resolveUserId(e) {
    if (e != null && String(e).trim()) return String(e).trim();
    if (v) return v;
    try {
      const e = window.currentUser?.id ?? window.currentUser?.user_id;
      if (e != null && String(e).trim()) return String(e).trim();
    } catch (e) {}
    try {
      const e = localStorage.getItem(s);
      if (e) return e;
    } catch (e) {}
    return null;
  }
  function _storageKey(e) {
    const t = _resolveUserId();
    return t ? `${e}:u${t}` : e;
  }
  function _purgeLegacyGlobalKeys() {
    try {
      localStorage.removeItem(i);
      localStorage.removeItem(o);
      sessionStorage.removeItem(o);
    } catch (e) {}
  }
  function setUserId(e, {clearLocal: t = false} = {}) {
    const n = _resolveUserId(e);
    const i = !!(v && n && v !== n);
    v = n;
    _ = false;
    if (n) {
      try {
        localStorage.setItem(s, n);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem(s);
      } catch (e) {}
    }
    _purgeLegacyGlobalKeys();
    if (t || i) {
      try {
        writeState(defaultState(), {
          sync: false
        });
      } catch (e) {}
      C = true;
    }
    return {
      switched: i,
      userId: n
    };
  }
  function fontAnimHint(e) {
    try {
      if (window.__SolisSG?.animFor) return window.__SolisSG.animFor(e);
    } catch (e) {}
    return null;
  }
  const L = {
    karaoke: {
      color: "#FFFFFF",
      fill: null
    },
    popcolor: {
      color: "#FFFFFF",
      fill: null
    },
    sticker: {
      color: "#FFFFFF",
      fill: null
    },
    blur: {
      color: "#FFFFFF",
      fill: null
    },
    static: {
      color: "#FFFFFF",
      fill: null
    },
    fade: {
      color: "#FFFFFF",
      fill: null
    }
  };
  function defaultState() {
    return {
      version: r,
      enabled: true,
      suggestEnabled: true,
      templates: {},
      usageLog: []
    };
  }
  function readState() {
    try {
      const t = _storageKey(e);
      const n = _resolveUserId();
      const s = localStorage.getItem(t) || (!n ? localStorage.getItem(i) : null);
      if (!s) return defaultState();
      const o = JSON.parse(s);
      if (!o || typeof o !== "object") return defaultState();
      const l = {
        ...defaultState(),
        ...o,
        version: r,
        templates: o.templates && typeof o.templates === "object" ? o.templates : {},
        usageLog: Array.isArray(o.usageLog) ? o.usageLog : []
      };
      let a = o.version !== r;
      Object.keys(l.templates).forEach(e => {
        const t = l.templates[e];
        if (!t || typeof t !== "object") return;
        const n = sanitizeForTemplate(e, {
          styles: t.styles,
          captions: t.captions,
          layout: t.layout
        });
        const s = JSON.stringify(t.styles || null) !== JSON.stringify(n.styles || null);
        const i = JSON.stringify(t.layout || null) !== JSON.stringify(n.layout || null);
        const o = JSON.stringify(t.captions || null) !== JSON.stringify(n.captions || null);
        if (s || i || o) {
          t.styles = n.styles;
          t.layout = n.layout;
          t.captions = n.captions;
          t.fingerprint = fingerprint(n.styles, n.captions, n.layout);
          a = true;
        }
      });
      if (a) {
        try {
          localStorage.setItem(_storageKey(e), JSON.stringify(l));
        } catch (e) {}
      }
      return l;
    } catch (e) {
      return defaultState();
    }
  }
  function writeState(t, {sync: n = false} = {}) {
    try {
      localStorage.setItem(_storageKey(e), JSON.stringify(t));
    } catch (e) {}
    if (n) scheduleServerSync();
  }
  function fingerprint(e, t, n, s) {
    try {
      const i = sanitizeRankingOverlay(s);
      return JSON.stringify({
        s: e || null,
        c: t || null,
        o: i ? {
          y_pct: Number(i.y_pct).toFixed(3)
        } : null,
        l: n ? {
          secondary_type: n.splitscreen_secondary_type || null,
          inverted: !!n.splitscreen_inverted,
          collapsed: !!n.splitscreen_secondary_collapsed,
          ratio: n.splitscreen_content_ratio != null ? Number(Number(n.splitscreen_content_ratio).toFixed(3)) : null,
          gameplay_clip_id: n.gameplay_clip_id || null
        } : null
      });
    } catch (e) {
      return "";
    }
  }
  function summarizeStyles(e, t, n) {
    const s = [];
    if (n && typeof n === "object") {
      const e = String(n.splitscreen_secondary_type || "");
      if (n.splitscreen_secondary_collapsed) s.push("Focus"); else if (e === "face_track") s.push("AI Reframe"); else if (e === "blank") s.push("Blank"); else if (e === "blank_blur") s.push("Blur"); else if (e === "gameplay") s.push("Focus");
      if (n.splitscreen_inverted) s.push("flip");
      const t = Number(n.splitscreen_content_ratio);
      if (Number.isFinite(t)) s.push(`split ${Math.round(t * 100)}%`);
    }
    if (t && typeof t === "object") {
      if (t.font) s.push(String(t.font).split(",")[0].replace(/['"]/g, ""));
      if (t.anim) s.push(String(t.anim));
      if (t.color) s.push(String(t.color));
      if (t.y_pct != null) s.push(`y${Math.round(Number(t.y_pct) * 100)}`);
    }
    if (!s.length && e && typeof e === "object") {
      const t = Object.keys(e);
      if (t.length) {
        const n = e[t[0]] || {};
        if (n.font) s.push(String(n.font).split(",")[0].replace(/['"]/g, ""));
        if (n.font_size) s.push(`${n.font_size}px`);
        if (Array.isArray(n.color) && n.color.length >= 3) {
          s.push(`rgb(${n.color.slice(0, 3).join(",")})`);
        }
      }
    }
    if (s.length) return s.slice(0, 4).join(" · ");
    if (e && Object.keys(e).length) {
      return `${Object.keys(e).length} saved style${Object.keys(e).length === 1 ? "" : "s"}`;
    }
    return "Previous styles";
  }
  function collectLiveLayout(e) {
    const t = String(e || b || "").toLowerCase();
    if (t && t !== "splitscreen" && !t.includes("split")) return null;
    try {
      if (typeof window.getSplitscreenConfig === "function") {
        const e = window.getSplitscreenConfig();
        if (e && typeof e === "object") return {
          ...e
        };
      }
    } catch (e) {}
    return null;
  }
  function layoutDiffers(e, t) {
    return fingerprint(null, null, e) !== fingerprint(null, null, t);
  }
  function layoutLabel(e) {
    if (!e) return "saved layout";
    if (e.splitscreen_secondary_collapsed) return "Focus";
    const t = String(e.splitscreen_secondary_type || "");
    if (t === "face_track") return "AI Reframe";
    if (t === "blank") return "Blank";
    if (t === "blank_blur") return "Blur";
    if (t === "gameplay") return "Focus";
    const n = Number(e.splitscreen_content_ratio);
    if (Number.isFinite(n)) return `split ${Math.round(n * 100)}%`;
    return "saved layout";
  }
  function hardenAgainstCopy(e) {
    try {
      if (window.__SolisSG?.harden) {
        window.__SolisSG.harden(e);
        return;
      }
    } catch (e) {}
    if (!e || e.dataset.copyHardened === "1") return;
    e.dataset.copyHardened = "1";
    e.setAttribute("draggable", "false");
    const block = e => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    e.addEventListener("copy", block, true);
    e.addEventListener("cut", block, true);
    e.addEventListener("contextmenu", block, true);
    e.addEventListener("dragstart", block, true);
    e.addEventListener("selectstart", block, true);
  }
  function setProtectedLabel(e, t) {
    try {
      if (window.__SolisSG?.shieldLabel) {
        window.__SolisSG.shieldLabel(e, t);
        return;
      }
    } catch (e) {}
    if (!e) return;
    const n = String(t || "");
    e.textContent = "";
    e.setAttribute("aria-label", n);
    e.classList.add("solis-nocopy");
    for (let t = 0; t < n.length; t++) {
      const s = document.createElement("span");
      s.textContent = n[t];
      s.setAttribute("aria-hidden", "true");
      e.appendChild(s);
      if (t < n.length - 1) {
        e.appendChild(document.createTextNode("​"));
      }
    }
  }
  function smarterCaptions(e, t) {
    if (!e || typeof e !== "object") return e;
    const n = {
      ...e
    };
    const s = String(n.font || "").replace(/['"]/g, "").split(",")[0].trim();
    const i = fontAnimHint(s);
    if (i && (!n.anim || n.anim === "center" || n.anim === "skew" || n.anim === "slide")) {
      n.anim = i;
    }
    if (n.anim === "center") n.anim = "fade";
    const o = String(n.anim || "").toLowerCase();
    const r = L[o];
    if (r) {
      if (!n.color) n.color = r.color;
      if (!("fill" in n) && r.fill) n.fill = r.fill;
    }
    if (!n.font_size || n.font_size < 28) n.font_size = n.font_size || 70;
    if (n.y_pct == null || !Number.isFinite(Number(n.y_pct))) {
      n.y_pct = .55;
    } else {
      n.y_pct = Math.max(.02, Math.min(.98, Number(n.y_pct)));
    }
    if (!n.shadow) n.shadow = "outline";
    return n;
  }
  function isEnabled() {
    return !!readState().enabled;
  }
  function setEnabled(e) {
    const t = readState();
    t.enabled = !!e;
    writeState(t);
    syncSettingsUI();
  }
  function isSuggestEnabled() {
    const e = readState();
    return !!e.enabled && !!e.suggestEnabled;
  }
  function setSuggestEnabled(e) {
    const t = readState();
    t.suggestEnabled = !!e;
    writeState(t);
    syncSettingsUI();
  }
  function getTemplateMemory(e) {
    if (!e) return null;
    const t = readState();
    const n = t.templates[e] || null;
    if (!n) return null;
    const s = sanitizeForTemplate(e, {
      styles: n.styles,
      captions: n.captions,
      layout: n.layout
    });
    return {
      ...n,
      styles: s.styles,
      captions: s.captions,
      layout: s.layout,
      fingerprint: fingerprint(s.styles, s.captions, s.layout) || n.fingerprint
    };
  }
  function listMemories() {
    const e = readState();
    return Object.entries(e.templates).map(([e, t]) => ({
      templateId: e,
      updatedAt: t.updatedAt,
      summary: summarizeStyles(t.styles, t.captions, t.layout),
      fingerprint: t.fingerprint,
      hasCaptions: !!(t.captions && Object.keys(t.captions).length),
      hasLayout: layoutUseful(t.layout)
    })).sort((e, t) => String(t.updatedAt || "").localeCompare(String(e.updatedAt || "")));
  }
  function collectLiveStyles(e) {
    if (!isRankingTemplate(e)) return null;
    try {
      if (window.rankingCustomizer && typeof window.rankingCustomizer.collectCustomizations === "function") {
        if (typeof window.rankingCustomizer.syncFromDOM === "function") {
          window.rankingCustomizer.syncFromDOM();
        }
        const e = window.rankingCustomizer.collectCustomizations();
        if (e && Object.keys(e).length) return e;
      }
    } catch (e) {}
    try {
      if (window.customizer && typeof window.customizer.collectCustomizations === "function") {
        const e = window.customizer.collectCustomizations();
        if (e && Object.keys(e).length) return e;
      }
    } catch (e) {}
    return null;
  }
  function collectLiveCaptions(e, {allowSnap: t = false} = {}) {
    try {
      if (typeof window.collectSubtitleStyle === "function") {
        const t = window.collectSubtitleStyle();
        if (t && typeof t === "object") {
          if (e) rememberCaptionSnap(e, t);
          return t;
        }
      }
    } catch (e) {}
    if (t) return recallCaptionSnap(e || b);
    return null;
  }
  function applyStyles(e, t) {
    if (!t || typeof t !== "object") return false;
    if (!isRankingTemplate(e)) return false;
    try {
      if (window.rankingCustomizer) {
        window.SolisMemory._applying = true;
        const e = JSON.parse(JSON.stringify(t));
        const n = window.rankingCustomizer.customizations || {};
        const s = typeof window.rankingCustomizer.countFonts === "function" ? window.rankingCustomizer.countFonts(n) : 0;
        const i = typeof window.rankingCustomizer.countFonts === "function" ? window.rankingCustomizer.countFonts(e) : 0;
        if (i === 0 && s > 0) {
          const t = {
            ...n
          };
          Object.entries(e).forEach(([e, s]) => {
            if (e === "__ranking_layout") {
              t[e] = s;
              return;
            }
            if (!s || typeof s !== "object") {
              if (s != null) t[e] = s;
              return;
            }
            t[e] = {
              ...t[e] || {},
              ...s
            };
            if (n[e]?.font && !t[e].font) t[e].font = n[e].font;
          });
          window.rankingCustomizer.customizations = t;
        } else {
          const t = {
            ...n
          };
          Object.entries(e).forEach(([e, n]) => {
            if (n && typeof n === "object" && !Array.isArray(n)) {
              t[e] = {
                ...t[e] || {},
                ...n
              };
            } else if (n != null) {
              t[e] = n;
            }
          });
          window.rankingCustomizer.customizations = t;
        }
        if (typeof window.rankingCustomizer.saveCustomizations === "function") {
          window.rankingCustomizer.saveCustomizations();
        }
        if (typeof window.rankingCustomizer.applyCustomizations === "function") {
          window.rankingCustomizer.applyCustomizations();
        }
        window.SolisMemory._applying = false;
        return true;
      }
    } catch (e) {
      if (window.SolisMemory) window.SolisMemory._applying = false;
    }
    return false;
  }
  function applyCaptions(e, t) {
    if (!e || typeof e !== "object") return false;
    try {
      window.SolisMemory._applying = true;
      const n = smarterCaptions(e, t);
      if (typeof window.applySubtitleStyle === "function") {
        window.applySubtitleStyle(n, {
          fromMemory: true,
          selectAfter: false,
          playAnim: false,
          applyFill: true,
          markSuggest: true
        });
        try {
          if (typeof window.collectSubtitleStyle === "function") {
            const e = window.collectSubtitleStyle();
            if (e && t) rememberCaptionSnap(t, e); else if (t) rememberCaptionSnap(t, n);
          } else if (t) {
            rememberCaptionSnap(t, n);
          }
        } catch (e) {}
        window.SolisMemory._applying = false;
        return true;
      }
      window.SolisMemory._applying = false;
    } catch (e) {
      if (window.SolisMemory) window.SolisMemory._applying = false;
    }
    return false;
  }
  function upsertTemplateMemory(e, {styles: t, captions: n, layout: s, source: i} = {}) {
    if (!e || !isEnabled()) return;
    const o = readState();
    const r = o.templates[e] || {};
    const l = templateMemoryProfile(e);
    let a = t !== undefined ? t : r.styles || null;
    let c = n !== undefined ? n : r.captions || null;
    let u = s !== undefined ? mergeLayouts(r.layout, s) : r.layout || null;
    if (!l.styles) a = null;
    if (!l.layout) u = null;
    if (!l.captions) c = null;
    if (a && !(typeof a === "object" && Object.keys(a).length)) a = null;
    if (c && !(typeof c === "object" && Object.keys(c).length)) c = null;
    if (u && !layoutUseful(u)) u = null;
    if (!(a && Object.keys(a).length) && !(c && Object.keys(c).length) && !layoutUseful(u)) {
      return;
    }
    const f = fingerprint(a, c, u);
    const p = trustFields(r, f);
    o.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: a ? JSON.parse(JSON.stringify(a)) : null,
      captions: c ? JSON.parse(JSON.stringify(c)) : null,
      lastGeneratedCaptions: r.lastGeneratedCaptions ? JSON.parse(JSON.stringify(r.lastGeneratedCaptions)) : null,
      lastGeneratedStyles: r.lastGeneratedStyles ? JSON.parse(JSON.stringify(r.lastGeneratedStyles)) : null,
      layout: u ? JSON.parse(JSON.stringify(u)) : null,
      fingerprint: f,
      rejectCount: r.fingerprint === f ? r.rejectCount || 0 : 0,
      lastRejectedFingerprint: r.fingerprint === f ? r.lastRejectedFingerprint || null : null,
      lastSuggestedAt: r.fingerprint === f ? r.lastSuggestedAt : null,
      acceptStreak: p.acceptStreak,
      acceptFingerprint: p.acceptFingerprint,
      autoApply: p.autoApply,
      lastAcceptedAt: p.lastAcceptedAt,
      source: i || r.source || "edit"
    };
    if (c) rememberCaptionSnap(e, c);
    writeState(o, {
      sync: false
    });
    syncSettingsUI();
  }
  function recordFromGeneration(e, t, n, s) {
    if (!e || !isEnabled()) return;
    const i = templateMemoryProfile(e);
    const o = readState();
    const r = o.templates[e] || {};
    let l = i.styles ? t || collectLiveStyles(e) : null;
    let a = i.captions ? n || collectLiveCaptions(e, {
      allowSnap: true
    }) : null;
    let u = i.rankingOverlay ? sanitizeRankingOverlay(n || collectLiveCaptions(e, {
      allowSnap: true
    })) : null;
    let f = i.layout ? mergeLayouts(r.layout, s || collectLiveLayout(e)) : null;
    if (i.captions && (!a || !Object.keys(a).length)) {
      a = recallCaptionSnap(e);
    }
    const p = sanitizeForTemplate(e, {
      styles: l,
      captions: a,
      layout: f
    });
    l = p.styles;
    a = p.captions;
    f = p.layout;
    if (i.rankingOverlay && u) {
      a = null;
    }
    if (i.layout && !f && layoutUseful(r.layout)) {
      f = normalizeLayout(r.layout);
    }
    if (!(l && Object.keys(l).length) && !(a && Object.keys(a).length) && !u && !layoutUseful(f)) {
      return;
    }
    const g = fingerprint(l, a, f, u);
    const d = r.fingerprint === g;
    const m = trustFields(r, g);
    o.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: l ? JSON.parse(JSON.stringify(l)) : null,
      captions: a ? JSON.parse(JSON.stringify(a)) : null,
      lastGeneratedCaptions: a ? JSON.parse(JSON.stringify(a)) : r.lastGeneratedCaptions || null,
      lastGeneratedStyles: l ? JSON.parse(JSON.stringify(l)) : r.lastGeneratedStyles || null,
      lastGeneratedOverlay: u ? JSON.parse(JSON.stringify(u)) : r.lastGeneratedOverlay || null,
      overlayPosition: u ? JSON.parse(JSON.stringify(u)) : r.overlayPosition || null,
      layout: f ? JSON.parse(JSON.stringify(f)) : null,
      fingerprint: g,
      rejectCount: d ? r.rejectCount || 0 : 0,
      lastRejectedFingerprint: d ? r.lastRejectedFingerprint || null : null,
      lastRejectedAt: d ? r.lastRejectedAt || null : null,
      lastSuggestedAt: d ? r.lastSuggestedAt : null,
      acceptStreak: m.acceptStreak,
      acceptFingerprint: m.acceptFingerprint,
      autoApply: d ? m.autoApply : true,
      lastAcceptedAt: m.lastAcceptedAt,
      source: "generate"
    };
    o.usageLog.unshift({
      templateId: e,
      at: (new Date).toISOString(),
      fingerprint: g
    });
    o.usageLog = o.usageLog.slice(0, c);
    if (a) rememberCaptionSnap(e, a);
    try {
      writeSessionDraft(e, {
        captions: a || undefined,
        styles: l || undefined,
        layout: layoutUseful(f) ? f : undefined
      });
    } catch (e) {}
    writeState(o, {
      sync: true
    });
    w = 0;
    y.delete(e);
    syncSettingsUI();
  }
  function recordLayout(e, t) {
    if (!isEnabled()) return;
    const n = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!n || !isSplitscreenTemplate(n)) return;
    const s = t || collectLiveLayout(n);
    if (!layoutUseful(s)) return;
    upsertTemplateMemory(n, {
      layout: s,
      source: "layout"
    });
  }
  function recordCaptions(e, t) {
    if (!isEnabled()) return;
    const n = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!n) return;
    const s = t || collectLiveCaptions(n);
    if (!s || !Object.keys(s).length) return;
    upsertTemplateMemory(n, {
      captions: s,
      source: "caption"
    });
  }
  function noteEdit(e) {
    if (!isEnabled()) return;
    const t = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!t) return;
    w += 1;
    b = t;
  }
  function scheduleSuggest(e) {
    if (S) {
      clearTimeout(S);
      S = null;
    }
    if (!e || !shouldSuggest(e) && !canOfferFirstAnimTip(e) && !shouldAutoApply(e)) {
      flushDeferredRankingCustoms();
      return;
    }
    const t = canOfferFirstAnimTip(e);
    const n = t ? 160 : l;
    const s = t ? 20 : 40 + Math.floor(Math.random() * 80);
    S = setTimeout(() => {
      S = null;
      const t = document.getElementById("templatePreviewModal");
      if (!t || !t.classList.contains("active")) return;
      if (!shouldSuggest(e) && !canOfferFirstAnimTip(e) && !shouldAutoApply(e)) {
        flushDeferredRankingCustoms();
        return;
      }
      showSuggestion(e);
    }, n + s);
  }
  function captionsDiffer(e, t) {
    return fingerprint(null, e) !== fingerprint(null, t);
  }
  function shouldSuggest(e) {
    if (!isSuggestEnabled() || !e) return false;
    if (h) return false;
    if (y.has(e)) return false;
    const t = getTemplateMemory(e);
    if (!t) return false;
    const n = stylesForSuggest(t, e);
    const s = !!(n && Object.keys(n).length);
    const i = captionsForSuggest(t, e);
    const o = !!(i && Object.keys(i).length);
    const r = isRankingTemplate(e) && rankingOverlayDiffers(t, e);
    const l = layoutUseful(t.layout);
    if (!s && !o && !l && !r) return false;
    if (t.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
      const n = Date.parse(t.lastRejectedAt || 0);
      if (Number.isFinite(n) && Date.now() - n < f) return false;
      if (!Number.isFinite(n) || Date.now() - n >= f) {
        try {
          const t = readState();
          if (t.templates[e]) {
            t.templates[e].lastRejectedFingerprint = null;
            t.templates[e].lastRejectedAt = null;
            writeState(t);
          }
        } catch (e) {}
      }
    }
    if (isLibraryPreviewOpen() && !l) return false;
    const a = collectLiveStyles(e);
    const c = collectLiveCaptions(e);
    const u = collectLiveLayout(e);
    const d = !!(c && Object.keys(c).length);
    const m = !!(a && Object.keys(a).length);
    const S = templateMemoryProfile(e);
    const w = o && S.captions && !isLibraryPreviewOpen();
    const b = s && S.styles;
    const k = r && S.rankingOverlay;
    const _ = l && S.layout;
    if (!w && !b && !_ && !k) return false;
    const M = Date.parse(t.lastSuggestedAt || 0);
    if (Number.isFinite(M)) {
      const n = isRankingTemplate(e) ? g : p;
      if (Date.now() - M < n) {
        const e = _ && layoutDiffers(t.layout, u);
        if (!e) return false;
      }
    }
    if (_ && layoutDiffers(t.layout, u)) return true;
    if (b && isRankingTemplate(e)) return true;
    if (w && !d) return true;
    if (b && !m && !d) return true;
    const v = smarterCaptions(i, e);
    const C = fingerprint(a, c, u) === t.fingerprint;
    const L = !v || fingerprint(null, c) === fingerprint(null, v);
    if (C && L) return false;
    return true;
  }
  function flushDeferredRankingCustoms() {
    if (!window.__solisRankingDeferCustoms) return;
    try {
      const e = document.getElementById("solisMemorySuggest");
      if (e && !e.hidden && e.classList.contains("open") && e.dataset.mode === "styles-only") {
        return;
      }
    } catch (e) {}
    window.__solisRankingDeferCustoms = false;
    try {
      if (typeof window.RankingTextPill?.seedDefaultSizes === "function") {
        window.RankingTextPill.seedDefaultSizes();
      }
    } catch (e) {}
  }
  function ensureSuggestEl() {
    let e = document.getElementById("solisMemorySuggest");
    const t = !e || !e.querySelector('[data-mem-act="accept"]') || !e.querySelector('[data-mem-act="reject"]');
    if (e && !t) {
      hardenAgainstCopy(e);
      return e;
    }
    if (e && t) {
      try {
        e.remove();
      } catch (e) {}
      e = null;
    }
    e = document.createElement("div");
    e.id = "solisMemorySuggest";
    e.className = "solis-memory-suggest solis-nocopy";
    e.hidden = true;
    e.innerHTML = `\n            <button type="button" class="solis-memory-suggest-btn solis-memory-suggest-btn--ghost solis-nocopy" data-mem-act="reject" title="Dismiss" aria-label="Dismiss">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>\n                </svg>\n            </button>\n            <span id="solisMemorySuggestTitle" class="solis-memory-suggest-label solis-nocopy"></span>\n            <button type="button" class="solis-memory-suggest-btn solis-memory-suggest-btn--primary solis-nocopy" data-mem-act="accept" title="Apply · Tab" aria-label="Apply">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>\n                </svg>\n            </button>\n            <span id="solisMemorySuggestSub" hidden></span>\n        `;
    e.addEventListener("pointerdown", e => {
      const t = e.target.closest("[data-mem-act]");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const n = t.getAttribute("data-mem-act");
      if (n === "accept") acceptSuggestion(); else if (n === "reject") rejectSuggestion();
    });
    e.addEventListener("click", e => {
      if (e.target.closest("[data-mem-act]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    document.body.appendChild(e);
    hardenAgainstCopy(e);
    return e;
  }
  function revealSuggestEl(e) {
    if (!e) return;
    e.hidden = false;
    e.removeAttribute("hidden");
    e.classList.add("open");
    e.style.display = "flex";
    e.style.visibility = "visible";
    e.style.opacity = "1";
    e.style.pointerEvents = "auto";
    e.style.zIndex = "99999";
  }
  function placeSuggestNearPreview() {
    const e = ensureSuggestEl();
    const t = document.getElementById("templateVideoPreview");
    const n = t || null;
    revealSuggestEl(e);
    const s = e.offsetWidth || 64;
    const i = e.offsetHeight || 34;
    if (!n) {
      e.style.left = `${Math.max(12, window.innerWidth - s - 16)}px`;
      e.style.top = "16px";
      e.style.transform = "none";
      return;
    }
    const o = n.getBoundingClientRect();
    let r = Math.round(o.right - s - 6);
    let l = Math.round(o.top + 8);
    r = Math.min(window.innerWidth - s - 8, Math.max(8, r));
    l = Math.min(window.innerHeight - i - 8, Math.max(8, l));
    e.style.left = `${r}px`;
    e.style.top = `${l}px`;
    e.style.transform = "none";
  }
  function hideSuggest() {
    const e = document.getElementById("solisMemorySuggest");
    if (e) {
      e.hidden = true;
      e.setAttribute("hidden", "");
      e.classList.remove("open", "solis-memory-suggest--recipe");
      e.style.visibility = "hidden";
      e.style.opacity = "0";
      e.style.pointerEvents = "none";
      e.style.display = "";
    }
    try {
      if (typeof window.clearSplitscreenMemorySuggestChrome === "function") {
        window.clearSplitscreenMemorySuggestChrome();
      }
    } catch (e) {}
    try {
      if (window.RankingTextPill && typeof window.RankingTextPill.clearSuggest === "function") {
        window.RankingTextPill.clearSuggest();
      }
    } catch (e) {}
    try {
      if (typeof window.clearSubtitleMemorySuggest === "function") {
        window.clearSubtitleMemorySuggest();
      } else {
        document.querySelectorAll(".rk-ghost-stack,.sub-mem-ghost").forEach(e => e.remove());
        const e = document.getElementById("subMemActions");
        if (e) {
          e.classList.remove("open");
          e.style.visibility = "hidden";
          e.style.opacity = "0";
          e.style.pointerEvents = "none";
        }
      }
      const e = document.getElementById("rkSuggestActions");
      if (e) {
        e.classList.remove("open");
        e.style.visibility = "hidden";
        e.style.opacity = "0";
        e.style.pointerEvents = "none";
      }
    } catch (e) {}
  }
  function wantsLayoutSuggest(e, t) {
    t = t || getTemplateMemory(e);
    if (!layoutUseful(t?.layout)) return false;
    if (!isSplitscreenTemplate(e)) return false;
    const n = collectLiveLayout(e);
    return layoutDiffers(t.layout, n);
  }
  function captionsForSuggest(e, t) {
    const n = t || b || window.clipsStudio?.currentTemplateForPreview?.id || null;
    const s = n ? readSessionDraft(n) : null;
    const i = e && typeof e === "object" ? e.lastGeneratedCaptions : null;
    if (i && typeof i === "object" && Object.keys(i).length) {
      return smarterCaptions(blendSessionPrefs(i, s?.captions), n);
    }
    if (s?.captions && typeof s.captions === "object" && Object.keys(s.captions).length) {
      return smarterCaptions({
        ...s.captions
      }, n);
    }
    return null;
  }
  function stylesForSuggest(e, t) {
    const n = t || b || window.clipsStudio?.currentTemplateForPreview?.id || null;
    if (!e || typeof e !== "object") return null;
    const s = e.lastGeneratedStyles;
    if (!(s && typeof s === "object" && Object.keys(s).length)) return null;
    const i = n ? readSessionDraft(n) : null;
    if (i?.styles && typeof i.styles === "object") {
      try {
        const e = JSON.parse(JSON.stringify(s));
        Object.entries(i.styles).forEach(([t, n]) => {
          if (t === "__ranking_layout") {
            e[t] = n;
            return;
          }
          if (n && typeof n === "object") e[t] = {
            ...e[t] || {},
            ...n
          }; else if (n != null) e[t] = n;
        });
        return e;
      } catch (e) {
        return s;
      }
    }
    return s;
  }
  function rankingStylesReady(e) {
    const t = e || "ranked_compilation";
    const n = getTemplateMemory(t);
    const s = stylesForSuggest(n, t);
    const i = !!(s && Object.keys(s).some(e => {
      if (e === "__ranking_layout") return false;
      const t = s[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    }));
    const o = !!rankingOverlayForSuggest(n);
    return i || o;
  }
  function isLibraryPreviewOpen() {
    try {
      return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
    } catch (e) {
      return false;
    }
  }
  function paintCaptionMemoryChip(e, t) {
    if (!e || typeof window.offerSubtitleMemorySuggest !== "function") return false;
    window.offerSubtitleMemorySuggest(e, t);
    const n = !!(window.__solisPendingSubMem || document.getElementById("subMemActions")?.classList.contains("open") || document.querySelector(".sub-mem-ghost,.sub-text-block.sub-suggest"));
    if (!n) return false;
    try {
      const e = document.getElementById("solisMemorySuggest");
      if (e) {
        e.hidden = true;
        e.setAttribute("hidden", "");
        e.classList.remove("open", "solis-memory-suggest--recipe");
        e.style.visibility = "hidden";
        e.style.opacity = "0";
        e.style.pointerEvents = "none";
      }
    } catch (e) {}
    try {
      const e = document.getElementById("templateVideoPreview")?.querySelector(".sub-text-block.sub-suggest, .sub-text-block.sub-mem-pick, .sub-text-block:not(.overlay-text-block)");
      if (typeof window.placeSubtitleMemoryActionsNear === "function") {
        window.placeSubtitleMemoryActionsNear(e);
      }
      const t = document.getElementById("subMemActions") || (typeof window.ensureSubMemActions === "function" ? window.ensureSubMemActions() : null);
      if (t) {
        t.classList.add("open");
        t.style.opacity = "1";
        t.style.visibility = "visible";
        t.style.pointerEvents = "auto";
        t.style.display = "flex";
      }
    } catch (e) {}
    return true;
  }
  function offerCaptionSuggest(e, t) {
    if (isLibraryPreviewOpen()) return false;
    t = t || getTemplateMemory(e);
    const n = captionsForSuggest(t, e);
    if (!n) {
      const t = collectLiveCaptions(e);
      const n = !!(t && Object.keys(t).length);
      const s = String(t?.anim || "").toLowerCase();
      let i = false;
      try {
        i = !!(document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block)") || document.querySelector("#templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)") || window.__solisPendingSubMem);
      } catch (e) {}
      const o = i || !n || !s || s === "none" || s === "static";
      if (!o) return false;
      const r = smarterCaptions({
        anim: "karaoke",
        font: String(t?.font || "Montserrat"),
        color: t?.color || "#ffffff",
        highlight: t?.highlight || "#FFFFFF",
        shadow: t?.shadow || "outline",
        font_size: t?.font_size || 70,
        font_size_ratio: t?.font_size_ratio || .036,
        y_pct: t?.y_pct != null ? t.y_pct : .55,
        enabled: true,
        __tip: "captions"
      }, e);
      return paintCaptionMemoryChip(r, e);
    }
    if (isRankingTemplate(e)) {
      let t = smarterCaptions(n, e);
      if (!t) return false;
      const s = collectLiveCaptions(e);
      const i = !!(s && Object.keys(s).length);
      if (i && !captionsDiffer(t, s)) return false;
      return paintCaptionMemoryChip(t, e);
    }
    let s = smarterCaptions(n, e);
    if (s) {
      const e = String(s.anim || "").toLowerCase();
      if (!e || e === "center" || e === "fade" || e === "none") {
        s = {
          ...s,
          anim: "karaoke",
          __tip: "animations"
        };
      }
    }
    if (!s) return false;
    const i = collectLiveCaptions(e);
    const o = !!(i && Object.keys(i).length);
    if (o && !captionsDiffer(s, i)) return false;
    return paintCaptionMemoryChip(s, e);
  }
  function showSuggestion(e) {
    if (!shouldSuggest(e) && !canOfferFirstAnimTip(e) && !shouldAutoApply(e)) return;
    const t = getTemplateMemory(e);
    if (shouldAutoApply(e, t)) {
      silentlyApplyMemory(e);
      h = true;
      flushDeferredRankingCustoms();
      return;
    }
    if (!shouldSuggest(e) && !canOfferFirstAnimTip(e)) return;
    let n = false;
    if (isSplitscreenTemplate(e)) {
      try {
        if (window.SolisInstantRecipe?.willOffer?.(e) || window.SolisInstantRecipe?.didOffer?.()) {
          return;
        }
      } catch (e) {}
      if (t && wantsLayoutSuggest(e, t)) {
        n = offerLayoutSuggest(e, t);
      }
      if (!n) {
        n = offerCaptionSuggest(e, t);
      }
    } else if (isRankingTemplate(e)) {
      if (t) {
        const s = stylesForSuggest(t, e);
        const i = !!(s && Object.keys(s).length);
        const o = !!rankingOverlayForSuggest(t);
        if (i || o) {
          n = !!offerRankingStylesSuggest(e, t);
        }
      }
      if (!n) {
        n = offerCaptionSuggest(e, t);
      }
      if (!n && !t) {
        flushDeferredRankingCustoms();
      }
    } else {
      n = offerCaptionSuggest(e, t);
    }
    if (!n) {
      flushDeferredRankingCustoms();
      return;
    }
    const s = document.getElementById("solisMemorySuggest");
    const i = !!(s && !s.hidden && s.classList.contains("open"));
    const o = !!document.getElementById("subMemActions")?.classList.contains("open") || !!document.querySelector(".sub-mem-ghost");
    if (!i && !o && isRankingTemplate(e)) {
      flushDeferredRankingCustoms();
      return;
    }
    h = true;
    if (t) {
      const t = readState();
      if (t.templates[e]) {
        t.templates[e].lastSuggestedAt = (new Date).toISOString();
        writeState(t);
      }
    }
  }
  function canOfferFirstAnimTip(e) {
    if (!isSuggestEnabled() || !e) return false;
    if (h) return false;
    if (y.has(e)) return false;
    if (isLibraryPreviewOpen()) return false;
    const t = getTemplateMemory(e);
    if (captionsForSuggest(t, e)) return false;
    return true;
  }
  function offerFirstCaptionTip(e, t) {
    const n = e || b;
    if (!n || !isSuggestEnabled()) return false;
    if (isLibraryPreviewOpen()) return false;
    if (y.has(n)) return false;
    const s = !!(t && t.force);
    const actionsOpen = () => !!document.getElementById("subMemActions")?.classList.contains("open");
    const softCap = () => !!document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest, #templateVideoPreview .sub-text-block.sub-mem-pick, .sub-mem-ghost");
    if (h && !s) {
      if (softCap() && actionsOpen() || document.getElementById("solisMemorySuggest")?.classList.contains("open")) {
        return true;
      }
    }
    try {
      if (isRankingTemplate(n)) {
        const e = stylesForSuggest(getTemplateMemory(n));
        if (e && Object.keys(e).length) return false;
      }
    } catch (e) {}
    try {
      const e = document.getElementById("solisMemorySuggest");
      const t = e?.dataset?.mode || "";
      if (e && e.classList.contains("open") && t && t !== "captions-pending" && t !== "captions") {
        return false;
      }
    } catch (e) {}
    const attempt = () => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return false;
      const t = document.getElementById("templateVideoPreview");
      if (!t || t.querySelector(".preview-skel")) return false;
      try {
        const e = !!document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block), #templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)");
        const t = collectLiveCaptions(n);
        const s = String(t?.anim || "").toLowerCase();
        if (!e && t && Object.keys(t).length && s && s !== "none" && s !== "static") {
          if (document.querySelector(".sub-text-block:not(.overlay-text-block)")) {
            return false;
          }
        }
      } catch (e) {}
      const s = offerCaptionSuggest(n, getTemplateMemory(n));
      if (s) h = true;
      return !!s;
    };
    if (attempt()) return true;
    const i = Math.max(0, Number(t?.retries) || 4);
    const o = Math.max(40, Number(t?.gapMs) || 180);
    for (let e = 1; e <= i; e++) {
      setTimeout(() => {
        if (h && !s && actionsOpen()) return;
        if (h && !s && !softCap() && !window.__solisPendingSubMem) return;
        try {
          attempt();
        } catch (e) {}
      }, o * e);
    }
    return false;
  }
  function _forceCaptionTipReshow() {
    h = false;
  }
  function offerInstantRecipe(e, t) {
    if (window.solisAutoModesEnabled === false) return false;
    if (!e || !e.ok || !isSplitscreenTemplate(t)) return false;
    const n = e.splitscreen;
    if (!n || typeof n !== "object") return false;
    if (typeof window.offerSplitscreenMemorySuggest !== "function") return false;
    const s = window.offerSplitscreenMemorySuggest(n, t);
    if (!s) return false;
    const i = ensureSuggestEl();
    const o = i.querySelector("#solisMemorySuggestTitle");
    const r = String(e.why_short || e.why || "").trim();
    if (o) {
      o.hidden = !r;
      o.textContent = r;
      if (r) {
        o.removeAttribute("hidden");
        o.style.display = "";
      }
    }
    const l = i.querySelector("#solisMemorySuggestSub");
    if (l) l.textContent = "";
    i.dataset.templateId = t;
    i.dataset.mode = "instant-recipe";
    i.classList.add("solis-memory-suggest--recipe");
    i.classList.remove("solis-memory-suggest--ranking");
    try {
      i._solisInstantRecipe = JSON.parse(JSON.stringify(e));
    } catch (t) {
      i._solisInstantRecipe = e;
    }
    h = true;
    placeSuggestNearPreview();
    revealSuggestEl(i);
    return true;
  }
  function retrySuggest(e) {
    const t = e || b;
    if (!t || h) return;
    const n = document.getElementById("templatePreviewModal");
    if (!n || !n.classList.contains("active")) return;
    showSuggestion(t);
  }
  function offerLayoutSuggest(e, t) {
    t = t || getTemplateMemory(e);
    if (!wantsLayoutSuggest(e, t)) return false;
    if (typeof window.offerSplitscreenMemorySuggest !== "function") return false;
    const n = window.offerSplitscreenMemorySuggest(t.layout, e);
    if (!n) return false;
    const s = ensureSuggestEl();
    const i = s.querySelector("#solisMemorySuggestTitle");
    if (i) {
      i.hidden = true;
      i.textContent = "";
    }
    const o = s.querySelector("#solisMemorySuggestSub");
    if (o) o.textContent = "";
    s.dataset.templateId = e;
    s.dataset.mode = "layout-only";
    s.classList.remove("solis-memory-suggest--recipe", "solis-memory-suggest--ranking");
    placeSuggestNearPreview();
    revealSuggestEl(s);
    return true;
  }
  function offerRankingStylesSuggest(e, t) {
    if (!isRankingTemplate(e)) return false;
    t = t || getTemplateMemory(e);
    const n = stylesForSuggest(t, e);
    const s = rankingOverlayForSuggest(t);
    const i = n ? Object.keys(n).filter(e => e !== "__ranking_layout") : [];
    const o = i.some(e => {
      const t = n[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    });
    if (!o && !s) return false;
    if (!rankingOverlayDiffers(t, e) && !o) return false;
    const r = document.getElementById("solisMemorySuggest");
    if (r && !r.hidden && r.classList.contains("open") && r.dataset.mode === "styles-only" && r.dataset.templateId === String(e)) {
      return true;
    }
    try {
      if (window.RankingTextPill) {
        if (typeof window.RankingTextPill.hide === "function") window.RankingTextPill.hide();
        if (typeof window.RankingTextPill.clearSuggest === "function") window.RankingTextPill.clearSuggest();
      }
      document.getElementById("subPillMenu")?.classList.remove("active");
    } catch (e) {}
    window.__solisRankingDeferCustoms = true;
    const l = ensureSuggestEl();
    const a = l.querySelector("#solisMemorySuggestTitle");
    if (a) {
      a.hidden = false;
      a.removeAttribute("hidden");
      const t = o ? suggestHookLine({
        styles: n,
        mode: "ranking",
        seed: e
      }) : "Use your last text placement?";
      a.textContent = s && o ? `${t} · same text spot` : t;
      a.style.display = "";
    }
    const c = l.querySelector("#solisMemorySuggestSub");
    if (c) c.textContent = "";
    l.dataset.templateId = e;
    l.dataset.mode = "styles-only";
    l.classList.add("solis-memory-suggest--ranking");
    try {
      l._solisMemStyles = n && Object.keys(n).length ? JSON.parse(JSON.stringify(n)) : null;
    } catch (e) {
      l._solisMemStyles = n;
    }
    try {
      l._solisMemOverlay = s ? JSON.parse(JSON.stringify(s)) : null;
    } catch (e) {
      l._solisMemOverlay = s;
    }
    l._solisMemStylesPreviewed = false;
    try {
      delete l._solisMemStylesBackup;
    } catch (e) {}
    placeSuggestNearPreview();
    revealSuggestEl(l);
    return true;
  }
  function continueSuggestAfterCaption(e) {
    const t = e || b;
    if (!t || !isSuggestEnabled()) return;
    if (y.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    if (n.lastRejectedFingerprint && n.lastRejectedFingerprint === n.fingerprint) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (y.has(t)) return;
      if (!isSplitscreenTemplate(t) && wantsLayoutSuggest(t, n) && offerLayoutSuggest(t, n)) return;
      offerRankingStylesSuggest(t, n);
    }, 180);
  }
  function continueSuggestAfterLayout(e) {
    const t = e || b;
    if (!t || !isSuggestEnabled()) return;
    if (y.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (y.has(t)) return;
      if (!isRankingTemplate(t) && offerCaptionSuggest(t, n)) {
        h = true;
        return;
      }
      offerRankingStylesSuggest(t, n);
      if (document.getElementById("solisMemorySuggest") && !document.getElementById("solisMemorySuggest").hidden) {
        h = true;
      }
    }, 160);
  }
  function acceptSuggestion() {
    const e = ensureSuggestEl();
    const t = e.dataset.templateId || b;
    const n = e.dataset.mode || "all";
    if (n === "captions-pending") {
      if (t) y.delete(t);
      try {
        if (typeof window.acceptSubtitleMemorySuggest === "function") {
          window.acceptSubtitleMemorySuggest();
        }
      } catch (e) {}
      hideSuggest();
      e.classList.remove("solis-memory-suggest--recipe");
      w = 0;
      return;
    }
    hideSuggest();
    if (t) y.delete(t);
    const s = getTemplateMemory(t);
    if (!s && n !== "instant-recipe") return;
    if (n === "instant-recipe") {
      const n = e._solisInstantRecipe || window.SolisInstantRecipe?.get?.();
      const s = n?.splitscreen;
      try {
        if (window.SolisMemory) window.SolisMemory._applying = true;
        if (s && typeof window.applySplitscreenMemoryLayout === "function") {
          window.applySplitscreenMemoryLayout(s, {
            commit: true
          });
        }
      } catch (e) {} finally {
        if (window.SolisMemory) window.SolisMemory._applying = false;
      }
      try {
        window.SolisInstantRecipe?.sendFeedback?.(true);
      } catch (e) {}
      try {
        delete e._solisInstantRecipe;
      } catch (e) {}
      e.classList.remove("solis-memory-suggest--recipe");
      w = 0;
      h = false;
      if (window.__solisRecipeSkipCaptions) {
        h = true;
        return;
      }
      continueSuggestAfterLayout(t);
      return;
    }
    if (n === "layout-only") {
      try {
        if (window.SolisMemory) window.SolisMemory._applying = true;
        if (typeof window.applySplitscreenMemoryLayout === "function" && s.layout) {
          window.applySplitscreenMemoryLayout(s.layout, {
            commit: true
          });
        }
      } catch (e) {} finally {
        if (window.SolisMemory) window.SolisMemory._applying = false;
      }
      const e = readState();
      if (e.templates[t]) {
        e.templates[t].lastAcceptedAt = (new Date).toISOString();
        e.templates[t].lastRejectedFingerprint = null;
        writeState(e);
      }
      recordSuggestionAccepted(t);
      w = 0;
      h = false;
      try {
        document.querySelectorAll(".gp-mem-pick").forEach(e => e.classList.remove("gp-mem-pick"));
        document.getElementById("subPillMenu")?.classList.remove("active");
        if (typeof window.hideGameplayPillMenu === "function") window.hideGameplayPillMenu(); else if (typeof hideGameplayPillMenu === "function") hideGameplayPillMenu();
      } catch (e) {}
      continueSuggestAfterLayout(t);
      return;
    }
    if (n === "styles-only") {
      const n = e._solisMemStyles || stylesForSuggest(s, t);
      if (n && Object.keys(n).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, n);
      }
      const i = e._solisMemOverlay || rankingOverlayForSuggest(s);
      if (i && isRankingTemplate(t)) {
        applyCaptions({
          ...i,
          anim: "none",
          enabled: true
        }, t);
      }
    } else {
      if (s.captions) applyCaptions(s.captions, t);
      if (s.layout && typeof window.applySplitscreenMemoryLayout === "function") {
        try {
          window.applySplitscreenMemoryLayout(s.layout, {
            commit: true
          });
        } catch (e) {}
      }
      const e = stylesForSuggest(s, t);
      if (e && Object.keys(e).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, e);
      }
    }
    try {
      delete e._solisMemStyles;
      delete e._solisMemStylesBackup;
      delete e._solisMemStylesPreviewed;
      delete e._solisMemOverlay;
      e.classList.remove("solis-memory-suggest--ranking");
    } catch (e) {}
    const i = readState();
    if (i.templates[t]) {
      i.templates[t].lastAcceptedAt = (new Date).toISOString();
      i.templates[t].lastRejectedFingerprint = null;
      writeState(i);
    }
    recordSuggestionAccepted(t);
    w = 0;
    if (typeof window.clearSubtitleMemorySuggest === "function") {
      window.clearSubtitleMemorySuggest();
    }
    try {
      document.getElementById("subPillMenu")?.classList.remove("active");
      document.querySelectorAll("#templateVideoPreview .sub-text-block.selected").forEach(e => e.classList.remove("selected"));
      if (window.RankingTextPill) {
        if (typeof window.RankingTextPill.clearSuggest === "function") window.RankingTextPill.clearSuggest();
        if (typeof window.RankingTextPill.hide === "function") window.RankingTextPill.hide();
        if (typeof window.RankingTextPill.deselectAll === "function") window.RankingTextPill.deselectAll();
      }
    } catch (e) {}
  }
  function rejectSuggestion() {
    const e = ensureSuggestEl();
    const t = e.dataset.templateId || b;
    const n = e.dataset.mode || "all";
    if (n === "instant-recipe") {
      try {
        if (typeof window.revertSplitscreenMemorySuggestPreview === "function") {
          window.revertSplitscreenMemorySuggestPreview();
        }
      } catch (e) {}
      try {
        window.SolisInstantRecipe?.sendFeedback?.(false);
      } catch (e) {}
      try {
        delete e._solisInstantRecipe;
      } catch (e) {}
      e.classList.remove("solis-memory-suggest--recipe");
      hideSuggest();
      h = false;
      w = 0;
      if (!window.__solisRecipeSkipCaptions) {
        setTimeout(() => {
          if (!t || y.has(t)) return;
          const e = getTemplateMemory(t);
          if (e && offerCaptionSuggest(t, e)) {
            h = true;
          }
        }, 280);
      }
      return;
    }
    if (n === "captions-pending") {
      hideSuggest();
      e.classList.remove("solis-memory-suggest--recipe");
      markSuggestionRejected(t);
      try {
        if (typeof window.clearSubtitleMemorySuggest === "function") {
          window.clearSubtitleMemorySuggest({
            cooldown: true,
            revert: true,
            persistReject: true,
            templateId: t
          });
        }
      } catch (e) {}
      return;
    }
    if (n === "layout-only") {
      try {
        if (typeof window.revertSplitscreenMemorySuggestPreview === "function") {
          window.revertSplitscreenMemorySuggestPreview();
        }
      } catch (e) {}
      try {
        if (typeof window.hideGameplayPillMenu === "function") window.hideGameplayPillMenu();
      } catch (e) {}
      hideSuggest();
      h = false;
      w = 0;
      setTimeout(() => {
        if (!t || y.has(t)) return;
        if (isRankingTemplate(t)) return;
        const e = getTemplateMemory(t);
        if (!e) return;
        if (offerCaptionSuggest(t, e)) {
          h = true;
        }
      }, 280);
      return;
    }
    hideSuggest();
    markSuggestionRejected(t);
    try {
      delete e._solisMemStyles;
      delete e._solisMemStylesBackup;
      delete e._solisMemStylesPreviewed;
      e.classList.remove("solis-memory-suggest--ranking");
    } catch (e) {}
    window.__solisRankingDeferCustoms = false;
    try {
      if (typeof window.RankingTextPill?.seedDefaultSizes === "function") {
        window.RankingTextPill.seedDefaultSizes();
      }
    } catch (e) {}
    if (typeof window.clearSubtitleMemorySuggest === "function") {
      window.clearSubtitleMemorySuggest({
        cooldown: true,
        persistReject: true
      });
    }
  }
  function markSuggestionRejected(e) {
    const t = e || b;
    if (!t) return;
    y.add(t);
    h = true;
    w = 0;
    if (S) {
      clearTimeout(S);
      S = null;
    }
    const n = readState();
    const s = n.templates[t];
    if (s) {
      s.rejectCount = (s.rejectCount || 0) + 1;
      s.lastRejectedFingerprint = s.fingerprint || fingerprint(s.styles, s.captions, s.layout);
      s.lastRejectedAt = (new Date).toISOString();
      s.acceptStreak = 0;
      s.acceptFingerprint = null;
      s.autoApply = false;
      writeState(n);
    }
  }
  function scheduleServerSync() {
    if (k) clearTimeout(k);
    k = setTimeout(() => {
      k = null;
      pushServerMemory();
    }, u);
  }
  function apiUrl(e) {
    if (typeof window.apiUrl === "function") return window.apiUrl(e);
    return e;
  }
  function authHeaders() {
    const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    return {
      "Content-Type": "application/json",
      ...e
    };
  }
  async function pushServerMemory() {
    if (!_resolveUserId()) return;
    try {
      const e = readState();
      const t = await fetch(apiUrl("/api/clips/memory"), {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "save",
          memory: e
        })
      });
      if (!t.ok) {
        console.warn("[SolisMemory] server save failed:", t.status);
      }
    } catch (e) {}
  }
  function _sanitizeRemoteTemplate(e, t) {
    if (!t || typeof t !== "object") return null;
    const n = sanitizeForTemplate(e, {
      styles: t.styles,
      captions: t.captions,
      layout: t.layout
    });
    return {
      ...t,
      styles: n.styles,
      captions: n.captions,
      layout: n.layout,
      fingerprint: fingerprint(n.styles, n.captions, n.layout)
    };
  }
  function mergeMemoryStates(e, t, {preferRemote: n = false} = {}) {
    if (n) {
      const e = {
        ...defaultState(),
        enabled: t.enabled !== undefined ? t.enabled : true,
        suggestEnabled: t.suggestEnabled !== undefined ? t.suggestEnabled : true,
        templates: {},
        usageLog: Array.isArray(t.usageLog) ? t.usageLog : []
      };
      Object.entries(t.templates || {}).forEach(([t, n]) => {
        const s = _sanitizeRemoteTemplate(t, n);
        if (s) e.templates[t] = s;
      });
      return e;
    }
    const s = {
      ...defaultState(),
      ...e,
      enabled: e.enabled !== undefined ? e.enabled : t.enabled,
      suggestEnabled: e.suggestEnabled !== undefined ? e.suggestEnabled : t.suggestEnabled,
      templates: {
        ...t.templates || {},
        ...e.templates || {}
      },
      usageLog: Array.isArray(e.usageLog) && e.usageLog.length ? e.usageLog : Array.isArray(t.usageLog) ? t.usageLog : []
    };
    const i = t.templates || {};
    Object.keys(i).forEach(e => {
      const t = s.templates[e];
      const n = _sanitizeRemoteTemplate(e, i[e]);
      if (!t) {
        if (n) s.templates[e] = n;
        return;
      }
      if (!n) return;
      const o = Date.parse(t.updatedAt || 0) || 0;
      const r = Date.parse(n.updatedAt || 0) || 0;
      if (r > o) s.templates[e] = n; else if (r === o) {
        const i = {
          ...t,
          captions: t.captions || n.captions || null,
          styles: t.styles || n.styles || null,
          layout: t.layout || n.layout || null
        };
        s.templates[e] = _sanitizeRemoteTemplate(e, i) || i;
      } else {
        s.templates[e] = _sanitizeRemoteTemplate(e, t) || t;
      }
    });
    Object.keys(s.templates).forEach(e => {
      s.templates[e] = _sanitizeRemoteTemplate(e, s.templates[e]) || s.templates[e];
    });
    return s;
  }
  async function pullServerMemory() {
    if (!_resolveUserId()) return null;
    if (M) return M;
    M = (async () => {
      try {
        const e = await fetch(apiUrl("/api/clips/memory"), {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            action: "get"
          })
        });
        if (!e.ok) {
          if (typeof window.solisLog === "function") {
            window.solisLog("Memory API", `pull failed HTTP ${e.status}`);
          } else {
            console.warn("[SolisMemory] server pull failed:", e.status);
          }
          return null;
        }
        const t = await e.json();
        const n = t?.memory;
        if (!n || typeof n !== "object") {
          if (typeof window.solisLog === "function") {
            window.solisLog("Memory API", "empty remote memory");
          }
          return null;
        }
        const s = C;
        C = false;
        const i = mergeMemoryStates(readState(), n, {
          preferRemote: s
        });
        writeState(i, {
          sync: false
        });
        _ = true;
        syncSettingsUI();
        if (typeof window.solisLog === "function") {
          const e = Object.keys(i.templates || {}).length;
          window.solisLog("Memory API", `loaded ${e} template profile(s)`);
        }
        return i;
      } catch (e) {
        console.warn("[SolisMemory] pull error:", e?.message || e);
        return null;
      } finally {
        M = null;
      }
    })();
    return M;
  }
  async function onTemplatePreviewOpen(e) {
    b = e || null;
    h = false;
    w = 0;
    hideSuggest();
    try {
      y.delete(e);
      const t = getTemplateMemory(e);
      if (t?.lastRejectedAt && t?.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
        const n = Date.parse(t.lastRejectedAt);
        if (Number.isFinite(n) && Date.now() - n < f) {
          y.add(e);
        } else {
          const t = readState();
          if (t.templates[e]) {
            t.templates[e].lastRejectedFingerprint = null;
            t.templates[e].lastRejectedAt = null;
            writeState(t);
          }
        }
      }
    } catch (e) {}
    scheduleSuggest(e);
    try {
      setTimeout(() => {
        try {
          offerFirstCaptionTip(e, {
            retries: 4,
            gapMs: 200
          });
        } catch (e) {}
      }, 60);
    } catch (e) {}
    if (!_) {
      pullServerMemory().then(() => {
        if (!h) scheduleSuggest(e);
        if (!h) {
          try {
            offerFirstCaptionTip(e, {
              retries: 2,
              gapMs: 180
            });
          } catch (e) {}
        }
      }).catch(() => {});
    }
    setTimeout(() => flushDeferredRankingCustoms(), l + 400);
  }
  function onTemplatePreviewClose() {
    if (S) {
      clearTimeout(S);
      S = null;
    }
    hideSuggest();
    h = false;
    try {
      if (b) {
        const e = readSessionDraft(b);
        if (!e || !Object.keys(e).length) {
          snapshotSessionDraft(b);
        } else {
          upsertTemplateMemory(b, {
            captions: e.captions || undefined,
            styles: e.styles || undefined,
            layout: e.layout || undefined,
            source: "close"
          });
        }
      }
    } catch (e) {}
    if (typeof window.clearSubtitleMemorySuggest === "function") {
      window.clearSubtitleMemorySuggest();
    }
    try {
      if (typeof window.revertSplitscreenMemorySuggestPreview === "function") {
        window.revertSplitscreenMemorySuggestPreview();
      }
    } catch (e) {}
    try {
      if (typeof window.clearSplitscreenMemorySuggestChrome === "function") {
        window.clearSplitscreenMemorySuggestChrome();
      }
    } catch (e) {}
    try {
      if (window.RankingTextPill && typeof window.RankingTextPill.clearSuggest === "function") {
        window.RankingTextPill.clearSuggest();
      }
      if (window.RankingTextPill && typeof window.RankingTextPill.hide === "function") {
        window.RankingTextPill.hide();
      }
      if (window.RankingTextPill && typeof window.RankingTextPill.deselectAll === "function") {
        window.RankingTextPill.deselectAll();
      }
    } catch (e) {}
    b = null;
  }
  function generateFromUsage() {
    return 0;
  }
  function clearTemplate(e) {
    const t = readState();
    if (e) delete t.templates[e];
    writeState(t);
    syncSettingsUI();
  }
  async function clearAll() {
    const e = readState();
    e.templates = {};
    e.usageLog = [];
    writeState(e, {
      sync: false
    });
    syncSettingsUI();
    hideSuggest();
    try {
      await fetch(apiUrl("/api/clips/memory"), {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "clear"
        })
      });
    } catch (e) {}
  }
  function syncSettingsUI() {
    const e = readState();
    const t = document.getElementById("stgMemoryEnabledToggle");
    const n = document.getElementById("stgMemorySuggestToggle");
    const s = document.getElementById("stgMemoryEnabledLabel");
    const i = document.getElementById("stgMemorySuggestLabel");
    if (t) {
      t.classList.toggle("is-on", !!e.enabled);
      t.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    if (s) s.textContent = e.enabled ? "On" : "Off";
    if (n) {
      n.classList.toggle("is-on", !!e.suggestEnabled);
      n.setAttribute("aria-checked", e.suggestEnabled ? "true" : "false");
      n.disabled = !e.enabled;
      n.classList.toggle("is-disabled", !e.enabled);
    }
    if (i) i.textContent = e.suggestEnabled ? "On" : "Off";
    const o = document.getElementById("stgPrivacyMemoryToggle");
    if (o) {
      o.classList.toggle("is-on", !!e.enabled);
      o.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    const r = document.getElementById("stgMemoryList");
    if (!r) return;
    const l = listMemories();
    if (!l.length) {
      r.innerHTML = `<p class="stgMemoryEmpty">No saved styles yet. Customize a preview and generate a clip. Memory will learn from that.</p>`;
      return;
    }
    r.innerHTML = l.map(e => `\n            <div class="stgMemoryItem" data-mem-id="${e.templateId}">\n                <div class="stgMemoryItemBody">\n                    <div class="stgMemoryItemTitle">${escapeHtml(prettyTemplateName(e.templateId))}${e.hasCaptions ? " · Captions" : ""}${e.hasLayout ? " · Layout" : ""}</div>\n                    <div class="stgMemoryItemMeta">${escapeHtml(e.summary)}${e.updatedAt ? ` · ${formatRelative(e.updatedAt)}` : ""}</div>\n                </div>\n                <button type="button" class="stgMemoryClearOne" data-clear-mem="${e.templateId}" title="Clear">Clear</button>\n            </div>\n        `).join("");
  }
  function prettyTemplateName(e) {
    return String(e || "template").replace(/_/g, " ").replace(/\b\w/g, e => e.toUpperCase());
  }
  function formatRelative(e) {
    try {
      const t = new Date(e).getTime();
      const n = Date.now() - t;
      if (n < 6e4) return "just now";
      if (n < 36e5) return `${Math.floor(n / 6e4)}m ago`;
      if (n < 864e5) return `${Math.floor(n / 36e5)}h ago`;
      return `${Math.floor(n / 864e5)}d ago`;
    } catch (e) {
      return "";
    }
  }
  function escapeHtml(e) {
    return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function bindSettingsPanel() {
    const e = document.getElementById("stgMemoryEnabledToggle");
    const t = document.getElementById("stgMemorySuggestToggle");
    const n = document.getElementById("stgMemoryClearAllBtn");
    const s = document.getElementById("stgMemoryList");
    e?.addEventListener("click", () => setEnabled(!isEnabled()));
    t?.addEventListener("click", () => {
      if (!isEnabled()) return;
      setSuggestEnabled(!readState().suggestEnabled);
    });
    n?.addEventListener("click", () => {
      clearAll();
    });
    s?.addEventListener("click", e => {
      const t = e.target.closest("[data-clear-mem]");
      if (!t) return;
      clearTemplate(t.getAttribute("data-clear-mem"));
    });
    syncSettingsUI();
  }
  window.SolisMemory = {
    recordFromGeneration: recordFromGeneration,
    recordCaptions: recordCaptions,
    recordLayout: recordLayout,
    noteEdit: noteEdit,
    onTemplatePreviewOpen: onTemplatePreviewOpen,
    onTemplatePreviewClose: onTemplatePreviewClose,
    generateFromUsage: generateFromUsage,
    clearAll: clearAll,
    clearTemplate: clearTemplate,
    listMemories: listMemories,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    isSuggestEnabled: isSuggestEnabled,
    syncSettingsUI: syncSettingsUI,
    readState: readState,
    getTemplateMemory: getTemplateMemory,
    stylesForSuggest: stylesForSuggest,
    rankingStylesReady: rankingStylesReady,
    rankingOverlayForSuggest: rankingOverlayForSuggest,
    rankingOverlayDiffers: rankingOverlayDiffers,
    applyCaptions: applyCaptions,
    smarterCaptions: smarterCaptions,
    continueSuggestAfterCaption: continueSuggestAfterCaption,
    continueSuggestAfterLayout: continueSuggestAfterLayout,
    pullServerMemory: pullServerMemory,
    setUserId: setUserId,
    markSuggestionRejected: markSuggestionRejected,
    rejectSuggestion: rejectSuggestion,
    acceptSuggestion: acceptSuggestion,
    offerInstantRecipe: offerInstantRecipe,
    retrySuggest: retrySuggest,
    offerFirstCaptionTip: offerFirstCaptionTip,
    _forceCaptionTipReshow: _forceCaptionTipReshow,
    snapshotSessionDraft: snapshotSessionDraft,
    rememberCaptionSnap: rememberCaptionSnap,
    recallCaptionSnap: recallCaptionSnap,
    suggestHookLine: suggestHookLine,
    recordSuggestionAccepted: recordSuggestionAccepted,
    lockSuggestForOpen: () => {
      h = true;
      w = 0;
      if (S) {
        clearTimeout(S);
        S = null;
      }
    },
    getCurrentTemplateId: () => b,
    isRankingTemplate: isRankingTemplate,
    isSplitscreenTemplate: isSplitscreenTemplate,
    _applying: false
  };
  document.addEventListener("keydown", e => {
    const t = document.getElementById("solisMemorySuggest");
    if (window.__solisPendingSubMem || document.querySelector(".sub-mem-ghost") || document.getElementById("subMemActions")?.classList.contains("open")) {
      return;
    }
    if (!t || t.hidden) return;
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestion();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      rejectSuggestion();
    }
  }, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSettingsPanel, {
      once: true
    });
  } else {
    bindSettingsPanel();
  }
})();
