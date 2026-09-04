(function() {
  const e = "solis_template_memory";
  const t = "solis_caption_by_template";
  const n = "solis_session_style_draft";
  const i = "solis_memory_owner_id";
  const s = "solis_template_memory";
  const r = "solis_caption_by_template";
  const o = 5;
  const l = 900;
  const a = 999;
  const c = 40;
  const u = 1200;
  const p = 45 * 1e3;
  const f = 18 * 1e3;
  const y = 20 * 1e3;
  const g = new Set;
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
    const i = sanitizeRankingOverlay(collectLiveCaptions(t));
    if (!i) return true;
    return Math.abs(Number(n.y_pct) - Number(i.y_pct)) > .015;
  }
  function sanitizeForTemplate(e, {styles: t = null, captions: n = null, layout: i = null} = {}) {
    const s = templateMemoryProfile(e);
    let r = null;
    if (s.rankingOverlay) {
      r = sanitizeRankingOverlay(n);
    } else if (s.captions && n && typeof n === "object" && Object.keys(n).length) {
      r = n;
    }
    return {
      styles: s.styles && t && typeof t === "object" && Object.keys(t).length ? t : null,
      captions: r,
      layout: s.layout && layoutUseful(i) ? normalizeLayout(i) : null
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
    const i = parseInt(n[1], 16);
    const s = parseInt(n[2], 16);
    const r = parseInt(n[3], 16);
    if (i > 200 && s < 150 && r < 90) return "orange";
    if (i > 210 && s > 170 && r < 90) return "gold";
    if (s > i + 30 && s > r + 20) return "green";
    if (r > i + 30 && r > s + 10) return "blue";
    if (i > 180 && r > 140 && s < 140) return "pink";
    if (i > 200 && s < 100 && r < 100) return "red";
    if (i > 220 && s > 220 && r > 220) return "white";
    if (i < 45 && s < 45 && r < 45) return "black";
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
  function suggestHookLine({captions: e = null, styles: t = null, layout: n = null, mode: i = "captions", seed: s = ""} = {}) {
    const r = e && typeof e === "object" ? e : null;
    const o = String(r?.anim || "").toLowerCase();
    const l = m[o] || (o && o !== "none" ? o : null);
    const a = memColorName(r?.color || r?.highlight || r?.fill);
    const c = memFontShort(r?.font);
    const u = [ a, l, c ].filter(Boolean);
    const p = u.length ? u.slice(0, 2).join(" ") : "your look";
    const f = u.length ? u.join(" · ") : "your look";
    const y = `${i}|${s}|${f}|${String(r?.__tip || "")}`;
    if (i === "tip" || r?.__tip === "animations" || r?.__tip === "captions") {
      return memPick([ "Captions on — keep them?", "Add captions to this clip?", "Keep captions?", "Captions ready — apply?" ], y);
    }
    if (i === "ranking") {
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
      return memPick([ `Keep ${e}?`, "Your ranking style — apply?", "Same ranking look as last time", "One click. Your ranking again.", "Still you on the board?", `Back to ${e}?` ], y + e);
    }
    if (i === "layout") {
      const e = String(n?.splitscreen_secondary_type || "").replace(/_/g, " ");
      const t = e ? `your ${e} split` : "your split";
      return memPick([ `${t} — keep it?`, "Same split as last time", "Pick up your layout?", "Don’t rebuild the split", "Your composition. Apply?" ], y + e);
    }
    return memPick([ `Your ${p} — keep it?`, `Still rocking ${p}?`, `This is yours. Apply?`, `Back to ${p}?`, "Your signature. One click.", "Don’t start from zero", "Pick up where you left off", `${f} — still you?`, `Solis remembered ${p}`, c ? `Keep ${c}?` : `Keep ${p}?` ], y);
  }
  function trustFields(e, t, {resetOnFpChange: n = true} = {}) {
    const i = !!(e && e.fingerprint && t && e.fingerprint === t);
    if (i || !n) {
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
    const i = readState();
    const s = i.templates[n];
    if (!s) return;
    const r = s.fingerprint || fingerprint(s.styles, s.captions, s.layout) || s.acceptFingerprint || "ok";
    if (s.acceptFingerprint === r) {
      s.acceptStreak = (Number(s.acceptStreak) || 0) + 1;
    } else {
      s.acceptFingerprint = r;
      s.acceptStreak = 1;
    }
    s.lastAcceptedAt = (new Date).toISOString();
    s.lastRejectedFingerprint = null;
    s.lastRejectedAt = null;
    if (s.acceptStreak >= d) {
      s.autoApply = true;
    }
    writeState(i);
  }
  function clearAcceptTrust(e) {
    const t = e || b;
    if (!t) return;
    const n = readState();
    const i = n.templates[t];
    if (!i) return;
    i.acceptStreak = 0;
    i.acceptFingerprint = null;
    i.autoApply = false;
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
    const i = !!(captionsForSuggest(t, e) || stylesForSuggest(t, e) || layoutUseful(t.layout));
    return i;
  }
  function silentlyApplyMemory(e) {
    const t = getTemplateMemory(e);
    if (!t) return false;
    let n = false;
    try {
      if (window.SolisMemory) window.SolisMemory._applying = true;
      if (isSplitscreenTemplate(e) && layoutUseful(t.layout)) {
        const i = collectLiveLayout(e);
        if (layoutDiffers(t.layout, i) && typeof window.applySplitscreenMemoryLayout === "function") {
          window.applySplitscreenMemoryLayout(t.layout, {
            commit: true
          });
          n = true;
        }
      }
      if (!isRankingTemplate(e)) {
        const i = captionsForSuggest(t, e);
        if (i) {
          const t = smarterCaptions(i, e);
          const s = collectLiveCaptions(e);
          if (!s || captionsDiffer(t, s)) {
            if (applyCaptions(t, e)) n = true;
          }
        }
      }
      if (isRankingTemplate(e)) {
        const i = stylesForSuggest(t, e);
        if (i && Object.keys(i).length) {
          window.__solisRankingDeferCustoms = false;
          applyStyles(e, i);
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
      const i = localStorage.getItem(e) || sessionStorage.getItem(e) || (!n ? localStorage.getItem(r) : null) || (!n ? sessionStorage.getItem(r) : null);
      if (!i) return {};
      const s = JSON.parse(i);
      return s && typeof s === "object" ? s : {};
    } catch (e) {
      return {};
    }
  }
  function writeCaptionMap(e) {
    try {
      const n = _storageKey(t);
      const i = JSON.stringify(e || {});
      localStorage.setItem(n, i);
      sessionStorage.setItem(n, i);
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
    const i = {};
    try {
      if (n.captions) {
        const e = collectLiveCaptions(t, {
          allowSnap: true
        });
        if (e && Object.keys(e).length) {
          i.captions = {
            ...e
          };
          rememberCaptionSnap(t, e);
        }
      }
    } catch (e) {}
    try {
      if (n.styles) {
        const e = collectLiveStyles(t);
        if (e && Object.keys(e).length) i.styles = JSON.parse(JSON.stringify(e));
      }
    } catch (e) {}
    try {
      if (n.layout) {
        const e = collectLiveLayout(t);
        if (layoutUseful(e)) i.layout = JSON.parse(JSON.stringify(e));
      }
    } catch (e) {}
    if (!Object.keys(i).length) return null;
    writeSessionDraft(t, i);
    try {
      upsertTemplateMemory(t, {
        captions: i.captions || undefined,
        styles: i.styles || undefined,
        layout: i.layout || undefined,
        source: "close"
      });
    } catch (e) {}
    try {
      if (i.captions) {
        window.__solisCaptionsOptedIn = true;
        window.__solisCaptionsClearedForGenerate = false;
      }
    } catch (e) {}
    return i;
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
  let _ = null;
  let k = false;
  let v = null;
  let M = null;
  let C = false;
  function _resolveUserId(e) {
    if (e != null && String(e).trim()) return String(e).trim();
    if (M) return M;
    try {
      const e = window.currentUser?.id ?? window.currentUser?.user_id;
      if (e != null && String(e).trim()) return String(e).trim();
    } catch (e) {}
    try {
      const e = localStorage.getItem(i);
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
      localStorage.removeItem(s);
      localStorage.removeItem(r);
      sessionStorage.removeItem(r);
    } catch (e) {}
  }
  function setUserId(e, {clearLocal: t = false} = {}) {
    const n = _resolveUserId(e);
    const s = !!(M && n && M !== n);
    M = n;
    k = false;
    if (n) {
      try {
        localStorage.setItem(i, n);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem(i);
      } catch (e) {}
    }
    _purgeLegacyGlobalKeys();
    if (t || s) {
      try {
        writeState(defaultState(), {
          sync: false
        });
      } catch (e) {}
      C = true;
    }
    return {
      switched: s,
      userId: n
    };
  }
  function fontAnimHint(e) {
    try {
      if (window.__SolisSG?.animFor) return window.__SolisSG.animFor(e);
    } catch (e) {}
    return null;
  }
  const A = {
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
      version: o,
      enabled: true,
      suggestEnabled: true,
      templates: {},
      usageLog: [],
      editorial: {
        events: [],
        liked_reasons: [],
        improve_prompts: [],
        prefs: {},
        updatedAt: null
      }
    };
  }
  function readState() {
    try {
      const t = _storageKey(e);
      const n = _resolveUserId();
      const i = localStorage.getItem(t) || (!n ? localStorage.getItem(s) : null);
      if (!i) return defaultState();
      const r = JSON.parse(i);
      if (!r || typeof r !== "object") return defaultState();
      const l = {
        ...defaultState(),
        ...r,
        version: o,
        templates: r.templates && typeof r.templates === "object" ? r.templates : {},
        usageLog: Array.isArray(r.usageLog) ? r.usageLog : [],
        editorial: r.editorial && typeof r.editorial === "object" ? {
          ...defaultState().editorial,
          ...r.editorial,
          events: Array.isArray(r.editorial.events) ? r.editorial.events : [],
          liked_reasons: Array.isArray(r.editorial.liked_reasons) ? r.editorial.liked_reasons : [],
          improve_prompts: Array.isArray(r.editorial.improve_prompts) ? r.editorial.improve_prompts : [],
          prefs: r.editorial.prefs && typeof r.editorial.prefs === "object" ? r.editorial.prefs : {}
        } : defaultState().editorial
      };
      let a = r.version !== o;
      Object.keys(l.templates).forEach(e => {
        const t = l.templates[e];
        if (!t || typeof t !== "object") return;
        const n = sanitizeForTemplate(e, {
          styles: t.styles,
          captions: t.captions,
          layout: t.layout
        });
        const i = JSON.stringify(t.styles || null) !== JSON.stringify(n.styles || null);
        const s = JSON.stringify(t.layout || null) !== JSON.stringify(n.layout || null);
        const r = JSON.stringify(t.captions || null) !== JSON.stringify(n.captions || null);
        if (i || s || r) {
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
  function fingerprint(e, t, n, i) {
    try {
      const s = sanitizeRankingOverlay(i);
      return JSON.stringify({
        s: e || null,
        c: t || null,
        o: s ? {
          y_pct: Number(s.y_pct).toFixed(3)
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
    const i = [];
    if (n && typeof n === "object") {
      const e = String(n.splitscreen_secondary_type || "");
      if (n.splitscreen_secondary_collapsed) i.push("Focus"); else if (e === "face_track") i.push("AI Reframe"); else if (e === "blank") i.push("Blank"); else if (e === "blank_blur") i.push("Blur"); else if (e === "gameplay") i.push("Focus");
      if (n.splitscreen_inverted) i.push("flip");
      const t = Number(n.splitscreen_content_ratio);
      if (Number.isFinite(t)) i.push(`split ${Math.round(t * 100)}%`);
    }
    if (t && typeof t === "object") {
      if (t.font) i.push(String(t.font).split(",")[0].replace(/['"]/g, ""));
      if (t.anim) i.push(String(t.anim));
      if (t.color) i.push(String(t.color));
      if (t.y_pct != null) i.push(`y${Math.round(Number(t.y_pct) * 100)}`);
    }
    if (!i.length && e && typeof e === "object") {
      const t = Object.keys(e);
      if (t.length) {
        const n = e[t[0]] || {};
        if (n.font) i.push(String(n.font).split(",")[0].replace(/['"]/g, ""));
        if (n.font_size) i.push(`${n.font_size}px`);
        if (Array.isArray(n.color) && n.color.length >= 3) {
          i.push(`rgb(${n.color.slice(0, 3).join(",")})`);
        }
      }
    }
    if (i.length) return i.slice(0, 4).join(" · ");
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
      const i = document.createElement("span");
      i.textContent = n[t];
      i.setAttribute("aria-hidden", "true");
      e.appendChild(i);
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
    const i = String(n.font || "").replace(/['"]/g, "").split(",")[0].trim();
    const s = fontAnimHint(i);
    if (s && (!n.anim || n.anim === "center" || n.anim === "skew" || n.anim === "slide")) {
      n.anim = s;
    }
    if (n.anim === "center") n.anim = "fade";
    const r = String(n.anim || "").toLowerCase();
    const o = A[r];
    if (o) {
      if (!n.color) n.color = o.color;
      if (!("fill" in n) && o.fill) n.fill = o.fill;
    }
    if (!n.font_size || n.font_size < 28) n.font_size = n.font_size || 70;
    if (n.y_pct == null || !Number.isFinite(Number(n.y_pct))) {
      n.y_pct = isRankingTemplate(t) ? .82 : .78;
    } else {
      let e = Math.max(.02, Math.min(.98, Number(n.y_pct)));
      if (isRankingTemplate(t) && e > .42 && e < .62) {
        e = .82;
      }
      n.y_pct = e;
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
    const i = sanitizeForTemplate(e, {
      styles: n.styles,
      captions: n.captions,
      layout: n.layout
    });
    return {
      ...n,
      styles: i.styles,
      captions: i.captions,
      layout: i.layout,
      fingerprint: fingerprint(i.styles, i.captions, i.layout) || n.fingerprint
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
        const i = typeof window.rankingCustomizer.countFonts === "function" ? window.rankingCustomizer.countFonts(n) : 0;
        const s = typeof window.rankingCustomizer.countFonts === "function" ? window.rankingCustomizer.countFonts(e) : 0;
        if (s === 0 && i > 0) {
          const t = {
            ...n
          };
          Object.entries(e).forEach(([e, i]) => {
            if (e === "__ranking_layout") {
              t[e] = i;
              return;
            }
            if (!i || typeof i !== "object") {
              if (i != null) t[e] = i;
              return;
            }
            t[e] = {
              ...t[e] || {},
              ...i
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
  function upsertTemplateMemory(e, {styles: t, captions: n, layout: i, source: s} = {}) {
    if (!e || !isEnabled()) return;
    const r = readState();
    const o = r.templates[e] || {};
    const l = templateMemoryProfile(e);
    let a = t !== undefined ? t : o.styles || null;
    let c = n !== undefined ? n : o.captions || null;
    let u = i !== undefined ? mergeLayouts(o.layout, i) : o.layout || null;
    if (!l.styles) a = null;
    if (!l.layout) u = null;
    if (!l.captions) c = null;
    if (a && !(typeof a === "object" && Object.keys(a).length)) a = null;
    if (c && !(typeof c === "object" && Object.keys(c).length)) c = null;
    if (u && !layoutUseful(u)) u = null;
    if (!(a && Object.keys(a).length) && !(c && Object.keys(c).length) && !layoutUseful(u)) {
      return;
    }
    const p = fingerprint(a, c, u);
    const f = trustFields(o, p);
    r.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: a ? JSON.parse(JSON.stringify(a)) : null,
      captions: c ? JSON.parse(JSON.stringify(c)) : null,
      lastGeneratedCaptions: o.lastGeneratedCaptions ? JSON.parse(JSON.stringify(o.lastGeneratedCaptions)) : null,
      lastGeneratedStyles: o.lastGeneratedStyles ? JSON.parse(JSON.stringify(o.lastGeneratedStyles)) : null,
      layout: u ? JSON.parse(JSON.stringify(u)) : null,
      fingerprint: p,
      rejectCount: o.fingerprint === p ? o.rejectCount || 0 : 0,
      lastRejectedFingerprint: o.fingerprint === p ? o.lastRejectedFingerprint || null : null,
      lastSuggestedAt: o.fingerprint === p ? o.lastSuggestedAt : null,
      acceptStreak: f.acceptStreak,
      acceptFingerprint: f.acceptFingerprint,
      autoApply: f.autoApply,
      lastAcceptedAt: f.lastAcceptedAt,
      source: s || o.source || "edit"
    };
    if (c) rememberCaptionSnap(e, c);
    writeState(r, {
      sync: false
    });
    syncSettingsUI();
  }
  function recordFromGeneration(e, t, n, i) {
    if (!e || !isEnabled()) return;
    const s = templateMemoryProfile(e);
    const r = readState();
    const o = r.templates[e] || {};
    let l = s.styles ? t || collectLiveStyles(e) : null;
    let a = s.captions ? n || collectLiveCaptions(e, {
      allowSnap: true
    }) : null;
    let u = s.rankingOverlay ? sanitizeRankingOverlay(n || collectLiveCaptions(e, {
      allowSnap: true
    })) : null;
    let p = s.layout ? mergeLayouts(o.layout, i || collectLiveLayout(e)) : null;
    if (s.captions && (!a || !Object.keys(a).length)) {
      a = recallCaptionSnap(e);
    }
    const f = sanitizeForTemplate(e, {
      styles: l,
      captions: a,
      layout: p
    });
    l = f.styles;
    a = f.captions;
    p = f.layout;
    if (s.rankingOverlay && u) {
      a = null;
    }
    if (s.layout && !p && layoutUseful(o.layout)) {
      p = normalizeLayout(o.layout);
    }
    if (!(l && Object.keys(l).length) && !(a && Object.keys(a).length) && !u && !layoutUseful(p)) {
      return;
    }
    const y = fingerprint(l, a, p, u);
    const d = o.fingerprint === y;
    const m = trustFields(o, y);
    r.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: l ? JSON.parse(JSON.stringify(l)) : null,
      captions: a ? JSON.parse(JSON.stringify(a)) : null,
      lastGeneratedCaptions: a ? JSON.parse(JSON.stringify(a)) : o.lastGeneratedCaptions || null,
      lastGeneratedStyles: l ? JSON.parse(JSON.stringify(l)) : o.lastGeneratedStyles || null,
      lastGeneratedOverlay: u ? JSON.parse(JSON.stringify(u)) : o.lastGeneratedOverlay || null,
      overlayPosition: u ? JSON.parse(JSON.stringify(u)) : o.overlayPosition || null,
      layout: p ? JSON.parse(JSON.stringify(p)) : null,
      fingerprint: y,
      rejectCount: d ? o.rejectCount || 0 : 0,
      lastRejectedFingerprint: d ? o.lastRejectedFingerprint || null : null,
      lastRejectedAt: d ? o.lastRejectedAt || null : null,
      lastSuggestedAt: d ? o.lastSuggestedAt : null,
      acceptStreak: m.acceptStreak,
      acceptFingerprint: m.acceptFingerprint,
      autoApply: d ? m.autoApply : true,
      lastAcceptedAt: m.lastAcceptedAt,
      source: "generate"
    };
    r.usageLog.unshift({
      templateId: e,
      at: (new Date).toISOString(),
      fingerprint: y
    });
    r.usageLog = r.usageLog.slice(0, c);
    if (a) rememberCaptionSnap(e, a);
    try {
      writeSessionDraft(e, {
        captions: a || undefined,
        styles: l || undefined,
        layout: layoutUseful(p) ? p : undefined
      });
    } catch (e) {}
    writeState(r, {
      sync: true
    });
    w = 0;
    g.delete(e);
    syncSettingsUI();
  }
  function recordLayout(e, t) {
    if (!isEnabled()) return;
    const n = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!n || !isSplitscreenTemplate(n)) return;
    const i = t || collectLiveLayout(n);
    if (!layoutUseful(i)) return;
    upsertTemplateMemory(n, {
      layout: i,
      source: "layout"
    });
  }
  function recordCaptions(e, t) {
    if (!isEnabled()) return;
    const n = e || b || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!n) return;
    const i = t || collectLiveCaptions(n);
    if (!i || !Object.keys(i).length) return;
    upsertTemplateMemory(n, {
      captions: i,
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
    const i = t ? 20 : 40 + Math.floor(Math.random() * 80);
    S = setTimeout(() => {
      S = null;
      const t = document.getElementById("templatePreviewModal");
      if (!t || !t.classList.contains("active")) return;
      if (!shouldSuggest(e) && !canOfferFirstAnimTip(e) && !shouldAutoApply(e)) {
        flushDeferredRankingCustoms();
        return;
      }
      showSuggestion(e);
    }, n + i);
  }
  function captionsDiffer(e, t) {
    return fingerprint(null, e) !== fingerprint(null, t);
  }
  function shouldSuggest(e) {
    if (!isSuggestEnabled() || !e) return false;
    if (h) return false;
    if (g.has(e)) return false;
    const t = getTemplateMemory(e);
    if (!t) return false;
    const n = stylesForSuggest(t, e);
    const i = !!(n && Object.keys(n).length);
    const s = captionsForSuggest(t, e);
    const r = !!(s && Object.keys(s).length);
    const o = isRankingTemplate(e) && rankingOverlayDiffers(t, e);
    const l = layoutUseful(t.layout);
    if (!i && !r && !l && !o) return false;
    if (t.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
      const n = Date.parse(t.lastRejectedAt || 0);
      if (Number.isFinite(n) && Date.now() - n < p) return false;
      if (!Number.isFinite(n) || Date.now() - n >= p) {
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
    const w = r && S.captions && !isLibraryPreviewOpen();
    const b = i && S.styles;
    const _ = o && S.rankingOverlay;
    const k = l && S.layout;
    if (!w && !b && !k && !_) return false;
    const v = Date.parse(t.lastSuggestedAt || 0);
    if (Number.isFinite(v)) {
      const n = isRankingTemplate(e) ? y : f;
      if (Date.now() - v < n) {
        const e = k && layoutDiffers(t.layout, u);
        if (!e) return false;
      }
    }
    if (k && layoutDiffers(t.layout, u)) return true;
    if (b && isRankingTemplate(e)) return true;
    if (w && !d) return true;
    if (b && !m && !d) return true;
    const M = smarterCaptions(s, e);
    const C = fingerprint(a, c, u) === t.fingerprint;
    const A = !M || fingerprint(null, c) === fingerprint(null, M);
    if (C && A) return false;
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
    const i = e.offsetWidth || 64;
    const s = e.offsetHeight || 34;
    if (!n) {
      e.style.left = `${Math.max(12, window.innerWidth - i - 16)}px`;
      e.style.top = "16px";
      e.style.transform = "none";
      return;
    }
    const r = n.getBoundingClientRect();
    let o = Math.round(r.right - i - 6);
    let l = Math.round(r.top + 8);
    o = Math.min(window.innerWidth - i - 8, Math.max(8, o));
    l = Math.min(window.innerHeight - s - 8, Math.max(8, l));
    e.style.left = `${o}px`;
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
    const i = n ? readSessionDraft(n) : null;
    const s = e && typeof e === "object" ? e.lastGeneratedCaptions : null;
    if (s && typeof s === "object" && Object.keys(s).length) {
      return smarterCaptions(blendSessionPrefs(s, i?.captions), n);
    }
    if (i?.captions && typeof i.captions === "object" && Object.keys(i.captions).length) {
      return smarterCaptions({
        ...i.captions
      }, n);
    }
    return null;
  }
  function stylesForSuggest(e, t) {
    const n = t || b || window.clipsStudio?.currentTemplateForPreview?.id || null;
    if (!e || typeof e !== "object") return null;
    const i = e.lastGeneratedStyles;
    if (!(i && typeof i === "object" && Object.keys(i).length)) return null;
    const s = n ? readSessionDraft(n) : null;
    if (s?.styles && typeof s.styles === "object") {
      try {
        const e = JSON.parse(JSON.stringify(i));
        Object.entries(s.styles).forEach(([t, n]) => {
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
        return i;
      }
    }
    return i;
  }
  function rankingStylesReady(e) {
    const t = e || "ranked_compilation";
    const n = getTemplateMemory(t);
    const i = stylesForSuggest(n, t);
    const s = !!(i && Object.keys(i).some(e => {
      if (e === "__ranking_layout") return false;
      const t = i[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    }));
    const r = !!rankingOverlayForSuggest(n);
    return s || r;
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
    if (t && g.has(t)) return false;
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
    if (g.has(e)) return false;
    t = t || getTemplateMemory(e);
    const n = captionsForSuggest(t, e);
    if (!n) {
      const t = collectLiveCaptions(e);
      const n = !!(t && Object.keys(t).length);
      const i = String(t?.anim || "").toLowerCase();
      let s = false;
      try {
        s = !!(document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block)") || document.querySelector("#templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)") || window.__solisPendingSubMem);
      } catch (e) {}
      const r = s || !n || !i || i === "none" || i === "static";
      if (!r) return false;
      const o = smarterCaptions({
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
      return paintCaptionMemoryChip(o, e);
    }
    if (isRankingTemplate(e)) {
      let t = smarterCaptions(n, e);
      if (!t) return false;
      const i = collectLiveCaptions(e);
      const s = !!(i && Object.keys(i).length);
      if (s && !captionsDiffer(t, i)) return false;
      return paintCaptionMemoryChip(t, e);
    }
    let i = smarterCaptions(n, e);
    if (i) {
      const e = String(i.anim || "").toLowerCase();
      if (!e || e === "center" || e === "fade" || e === "none") {
        i = {
          ...i,
          anim: "karaoke",
          __tip: "animations"
        };
      }
    }
    if (!i) return false;
    const s = collectLiveCaptions(e);
    const r = !!(s && Object.keys(s).length);
    if (r && !captionsDiffer(i, s)) return false;
    return paintCaptionMemoryChip(i, e);
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
        const i = stylesForSuggest(t, e);
        const s = !!(i && Object.keys(i).length);
        const r = !!rankingOverlayForSuggest(t);
        if (s || r) {
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
    const i = document.getElementById("solisMemorySuggest");
    const s = !!(i && !i.hidden && i.classList.contains("open"));
    const r = !!document.getElementById("subMemActions")?.classList.contains("open") || !!document.querySelector(".sub-mem-ghost");
    if (!s && !r && isRankingTemplate(e)) {
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
    if (g.has(e)) return false;
    if (isLibraryPreviewOpen()) return false;
    const t = getTemplateMemory(e);
    if (captionsForSuggest(t, e)) return false;
    return true;
  }
  function offerFirstCaptionTip(e, t) {
    const n = e || b;
    if (!n || !isSuggestEnabled()) return false;
    if (isLibraryPreviewOpen()) return false;
    if (g.has(n)) return false;
    const i = !!(t && t.force);
    const actionsOpen = () => !!document.getElementById("subMemActions")?.classList.contains("open");
    const softCap = () => !!document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest, #templateVideoPreview .sub-text-block.sub-mem-pick, .sub-mem-ghost");
    if (h && !i) {
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
      if (g.has(n)) return false;
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return false;
      const t = document.getElementById("templateVideoPreview");
      if (!t || t.querySelector(".preview-skel")) return false;
      try {
        const e = !!document.querySelector("#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block), #templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)");
        const t = collectLiveCaptions(n);
        const i = String(t?.anim || "").toLowerCase();
        if (!e && t && Object.keys(t).length && i && i !== "none" && i !== "static") {
          if (document.querySelector(".sub-text-block:not(.overlay-text-block)")) {
            return false;
          }
        }
      } catch (e) {}
      const i = offerCaptionSuggest(n, getTemplateMemory(n));
      if (i) h = true;
      return !!i;
    };
    if (attempt()) return true;
    const s = Math.max(0, Number(t?.retries) || 4);
    const r = Math.max(40, Number(t?.gapMs) || 180);
    for (let e = 1; e <= s; e++) {
      setTimeout(() => {
        if (g.has(n)) return;
        if (h && !i && actionsOpen()) return;
        if (h && !i && !softCap() && !window.__solisPendingSubMem) return;
        if (i && h && !softCap() && !window.__solisPendingSubMem && !actionsOpen()) return;
        try {
          attempt();
        } catch (e) {}
      }, r * e);
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
    const i = window.offerSplitscreenMemorySuggest(n, t);
    if (!i) return false;
    const s = ensureSuggestEl();
    const r = s.querySelector("#solisMemorySuggestTitle");
    const o = String(e.why_short || e.why || "").trim();
    if (r) {
      r.hidden = !o;
      r.textContent = o;
      if (o) {
        r.removeAttribute("hidden");
        r.style.display = "";
      }
    }
    const l = s.querySelector("#solisMemorySuggestSub");
    if (l) l.textContent = "";
    s.dataset.templateId = t;
    s.dataset.mode = "instant-recipe";
    s.classList.add("solis-memory-suggest--recipe");
    s.classList.remove("solis-memory-suggest--ranking");
    try {
      s._solisInstantRecipe = JSON.parse(JSON.stringify(e));
    } catch (t) {
      s._solisInstantRecipe = e;
    }
    h = true;
    placeSuggestNearPreview();
    revealSuggestEl(s);
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
    const i = ensureSuggestEl();
    const s = i.querySelector("#solisMemorySuggestTitle");
    if (s) {
      s.hidden = true;
      s.textContent = "";
    }
    const r = i.querySelector("#solisMemorySuggestSub");
    if (r) r.textContent = "";
    i.dataset.templateId = e;
    i.dataset.mode = "layout-only";
    i.classList.remove("solis-memory-suggest--recipe", "solis-memory-suggest--ranking");
    placeSuggestNearPreview();
    revealSuggestEl(i);
    return true;
  }
  function offerRankingStylesSuggest(e, t) {
    if (!isRankingTemplate(e)) return false;
    t = t || getTemplateMemory(e);
    const n = stylesForSuggest(t, e);
    const i = rankingOverlayForSuggest(t);
    const s = n ? Object.keys(n).filter(e => e !== "__ranking_layout") : [];
    const r = s.some(e => {
      const t = n[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    });
    if (!r && !i) return false;
    if (!rankingOverlayDiffers(t, e) && !r) return false;
    const o = document.getElementById("solisMemorySuggest");
    if (o && !o.hidden && o.classList.contains("open") && o.dataset.mode === "styles-only" && o.dataset.templateId === String(e)) {
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
      const t = r ? suggestHookLine({
        styles: n,
        mode: "ranking",
        seed: e
      }) : "Use your last text placement?";
      a.textContent = i && r ? `${t} · same text spot` : t;
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
      l._solisMemOverlay = i ? JSON.parse(JSON.stringify(i)) : null;
    } catch (e) {
      l._solisMemOverlay = i;
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
    if (g.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    if (n.lastRejectedFingerprint && n.lastRejectedFingerprint === n.fingerprint) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (g.has(t)) return;
      if (!isSplitscreenTemplate(t) && wantsLayoutSuggest(t, n) && offerLayoutSuggest(t, n)) return;
      offerRankingStylesSuggest(t, n);
    }, 180);
  }
  function continueSuggestAfterLayout(e) {
    const t = e || b;
    if (!t || !isSuggestEnabled()) return;
    if (g.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (g.has(t)) return;
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
      if (t) g.delete(t);
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
    if (t) g.delete(t);
    const i = getTemplateMemory(t);
    if (!i && n !== "instant-recipe") return;
    if (n === "instant-recipe") {
      const n = e._solisInstantRecipe || window.SolisInstantRecipe?.get?.();
      const i = n?.splitscreen;
      try {
        if (window.SolisMemory) window.SolisMemory._applying = true;
        if (i && typeof window.applySplitscreenMemoryLayout === "function") {
          window.applySplitscreenMemoryLayout(i, {
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
        if (typeof window.applySplitscreenMemoryLayout === "function" && i.layout) {
          window.applySplitscreenMemoryLayout(i.layout, {
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
      const n = e._solisMemStyles || stylesForSuggest(i, t);
      if (n && Object.keys(n).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, n);
      }
      const s = e._solisMemOverlay || rankingOverlayForSuggest(i);
      if (s && isRankingTemplate(t)) {
        applyCaptions({
          ...s,
          anim: "none",
          enabled: true
        }, t);
      }
    } else {
      if (i.captions) applyCaptions(i.captions, t);
      if (i.layout && typeof window.applySplitscreenMemoryLayout === "function") {
        try {
          window.applySplitscreenMemoryLayout(i.layout, {
            commit: true
          });
        } catch (e) {}
      }
      const e = stylesForSuggest(i, t);
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
    const s = readState();
    if (s.templates[t]) {
      s.templates[t].lastAcceptedAt = (new Date).toISOString();
      s.templates[t].lastRejectedFingerprint = null;
      writeState(s);
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
          if (!t || g.has(t)) return;
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
        if (!t || g.has(t)) return;
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
    g.add(t);
    h = true;
    w = 0;
    if (S) {
      clearTimeout(S);
      S = null;
    }
    const n = readState();
    let i = n.templates[t];
    if (!i) {
      i = n.templates[t] = {
        fingerprint: "first-caption-tip",
        rejectCount: 0,
        styles: null,
        captions: null,
        layout: null
      };
    }
    i.rejectCount = (i.rejectCount || 0) + 1;
    i.lastRejectedFingerprint = i.fingerprint || fingerprint(i.styles, i.captions, i.layout) || "first-caption-tip";
    i.lastRejectedAt = (new Date).toISOString();
    i.acceptStreak = 0;
    i.acceptFingerprint = null;
    i.autoApply = false;
    writeState(n);
  }
  function wasSuggestionRejected(e) {
    const t = e || b;
    if (!t) return false;
    if (g.has(t)) return true;
    try {
      const e = getTemplateMemory(t);
      if (e?.lastRejectedFingerprint && e.lastRejectedFingerprint === e.fingerprint) {
        const t = Date.parse(e.lastRejectedAt || 0);
        if (Number.isFinite(t) && Date.now() - t < p) return true;
      }
    } catch (e) {}
    return false;
  }
  function scheduleServerSync() {
    if (_) clearTimeout(_);
    _ = setTimeout(() => {
      _ = null;
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
        usageLog: Array.isArray(t.usageLog) ? t.usageLog : [],
        editorial: t.editorial && typeof t.editorial === "object" ? {
          ...defaultState().editorial,
          ...t.editorial
        } : defaultState().editorial
      };
      Object.entries(t.templates || {}).forEach(([t, n]) => {
        const i = _sanitizeRemoteTemplate(t, n);
        if (i) e.templates[t] = i;
      });
      return e;
    }
    const i = {
      ...defaultState(),
      ...e,
      enabled: e.enabled !== undefined ? e.enabled : t.enabled,
      suggestEnabled: e.suggestEnabled !== undefined ? e.suggestEnabled : t.suggestEnabled,
      templates: {
        ...t.templates || {},
        ...e.templates || {}
      },
      usageLog: Array.isArray(e.usageLog) && e.usageLog.length ? e.usageLog : Array.isArray(t.usageLog) ? t.usageLog : [],
      editorial: _mergeEditorial(e.editorial, t.editorial)
    };
    const s = t.templates || {};
    Object.keys(s).forEach(e => {
      const t = i.templates[e];
      const n = _sanitizeRemoteTemplate(e, s[e]);
      if (!t) {
        if (n) i.templates[e] = n;
        return;
      }
      if (!n) return;
      const r = Date.parse(t.updatedAt || 0) || 0;
      const o = Date.parse(n.updatedAt || 0) || 0;
      if (o > r) i.templates[e] = n; else if (o === r) {
        const s = {
          ...t,
          captions: t.captions || n.captions || null,
          styles: t.styles || n.styles || null,
          layout: t.layout || n.layout || null
        };
        i.templates[e] = _sanitizeRemoteTemplate(e, s) || s;
      } else {
        i.templates[e] = _sanitizeRemoteTemplate(e, t) || t;
      }
    });
    Object.keys(i.templates).forEach(e => {
      i.templates[e] = _sanitizeRemoteTemplate(e, i.templates[e]) || i.templates[e];
    });
    return i;
  }
  async function pullServerMemory() {
    if (!_resolveUserId()) return null;
    if (v) return v;
    v = (async () => {
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
        const i = C;
        C = false;
        const s = mergeMemoryStates(readState(), n, {
          preferRemote: i
        });
        writeState(s, {
          sync: false
        });
        k = true;
        syncSettingsUI();
        if (typeof window.solisLog === "function") {
          const e = Object.keys(s.templates || {}).length;
          window.solisLog("Memory API", `loaded ${e} template profile(s)`);
        }
        return s;
      } catch (e) {
        console.warn("[SolisMemory] pull error:", e?.message || e);
        return null;
      } finally {
        v = null;
      }
    })();
    return v;
  }
  async function onTemplatePreviewOpen(e) {
    b = e || null;
    h = false;
    w = 0;
    hideSuggest();
    try {
      g.delete(e);
      const t = getTemplateMemory(e);
      if (t?.lastRejectedAt && t?.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
        const n = Date.parse(t.lastRejectedAt);
        if (Number.isFinite(n) && Date.now() - n < p) {
          g.add(e);
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
    if (!k) {
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
    const i = document.getElementById("stgMemoryEnabledLabel");
    const s = document.getElementById("stgMemorySuggestLabel");
    if (t) {
      t.classList.toggle("is-on", !!e.enabled);
      t.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    if (i) i.textContent = e.enabled ? "On" : "Off";
    if (n) {
      n.classList.toggle("is-on", !!e.suggestEnabled);
      n.setAttribute("aria-checked", e.suggestEnabled ? "true" : "false");
      n.disabled = !e.enabled;
      n.classList.toggle("is-disabled", !e.enabled);
    }
    if (s) s.textContent = e.suggestEnabled ? "On" : "Off";
    const r = document.getElementById("stgPrivacyMemoryToggle");
    if (r) {
      r.classList.toggle("is-on", !!e.enabled);
      r.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    const o = document.getElementById("stgMemoryList");
    if (!o) return;
    const l = listMemories();
    if (!l.length) {
      o.innerHTML = `<p class="stgMemoryEmpty">No saved styles yet. Customize a preview and generate a clip. Memory will learn from that.</p>`;
      return;
    }
    o.innerHTML = l.map(e => `\n            <div class="stgMemoryItem" data-mem-id="${e.templateId}">\n                <div class="stgMemoryItemBody">\n                    <div class="stgMemoryItemTitle">${escapeHtml(prettyTemplateName(e.templateId))}${e.hasCaptions ? " · Captions" : ""}${e.hasLayout ? " · Layout" : ""}</div>\n                    <div class="stgMemoryItemMeta">${escapeHtml(e.summary)}${e.updatedAt ? ` · ${formatRelative(e.updatedAt)}` : ""}</div>\n                </div>\n                <button type="button" class="stgMemoryClearOne" data-clear-mem="${e.templateId}" title="Clear">Clear</button>\n            </div>\n        `).join("");
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
    const i = document.getElementById("stgMemoryList");
    e?.addEventListener("click", () => setEnabled(!isEnabled()));
    t?.addEventListener("click", () => {
      if (!isEnabled()) return;
      setSuggestEnabled(!readState().suggestEnabled);
    });
    n?.addEventListener("click", () => {
      clearAll();
    });
    i?.addEventListener("click", e => {
      const t = e.target.closest("[data-clear-mem]");
      if (!t) return;
      clearTemplate(t.getAttribute("data-clear-mem"));
    });
    syncSettingsUI();
  }
  function _mergeEditorial(e, t) {
    const n = e && typeof e === "object" ? e : {};
    const i = t && typeof t === "object" ? t : {};
    const s = Date.parse(n.updatedAt || 0) || 0;
    const r = Date.parse(i.updatedAt || 0) || 0;
    const o = r > s ? i : n;
    const l = r > s ? n : i;
    const a = [];
    const c = new Set;
    [ ...Array.isArray(o.events) ? o.events : [], ...Array.isArray(l.events) ? l.events : [] ].forEach(e => {
      if (!e || typeof e !== "object") return;
      const t = `${e.at}|${e.action}|${e.reason || ""}`;
      if (c.has(t)) return;
      c.add(t);
      a.push(e);
    });
    return {
      ...defaultState().editorial,
      ...l,
      ...o,
      events: a.slice(-40),
      liked_reasons: [ ...Array.isArray(o.liked_reasons) ? o.liked_reasons : [], ...Array.isArray(l.liked_reasons) ? l.liked_reasons : [] ].filter((e, t, n) => typeof e === "string" && n.indexOf(e) === t).slice(-20),
      improve_prompts: [ ...Array.isArray(o.improve_prompts) ? o.improve_prompts : [], ...Array.isArray(l.improve_prompts) ? l.improve_prompts : [] ].filter((e, t, n) => typeof e === "string" && n.indexOf(e) === t).slice(-20),
      prefs: {
        ...l.prefs || {},
        ...o.prefs || {}
      },
      updatedAt: o.updatedAt || l.updatedAt || null
    };
  }
  async function recordEditorialTaste(e) {
    const t = {
      at: (new Date).toISOString(),
      action: String(e?.action || "").trim(),
      category: String(e?.category || ""),
      reason: String(e?.reason || "").slice(0, 160),
      keep: Array.isArray(e?.keep) ? e.keep.slice(0, 8) : [],
      prefer: e?.prefer || null,
      prompt: e?.prompt ? String(e.prompt).slice(0, 200) : undefined,
      source: String(e?.source || "companion")
    };
    if (!t.action) return {
      ok: false,
      error: "missing_action"
    };
    try {
      const e = readState();
      const n = _mergeEditorial(e.editorial, {
        updatedAt: t.at,
        events: [ t ],
        liked_reasons: [ "taste_more", "prioritize_style", "discovery_yes" ].includes(t.action) && t.reason ? [ t.reason ] : [],
        improve_prompts: t.prompt ? [ t.prompt ] : [],
        prefs: {}
      });
      const i = {
        ...n.prefs || {}
      };
      if (t.action === "taste_more" || t.action === "discovery_yes") i.want_more_like_this = true;
      if (t.action === "taste_pass") i.want_more_like_this = false;
      if (t.action === "prioritize_style") {
        i.prioritize_style = true;
        i.keep_variety = false;
      }
      if (t.action === "keep_variety") {
        i.keep_variety = true;
        i.prioritize_style = false;
      }
      if (t.action === "prefer_a" || t.action === "prefer_b") i.favor_clip_style = t.action;
      n.prefs = i;
      n.updatedAt = t.at;
      writeState({
        ...e,
        editorial: n
      }, {
        sync: false
      });
    } catch (e) {}
    try {
      const e = await fetch(apiUrl("/api/clips/companion-taste"), {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify(t)
      });
      if (!e.ok) return {
        ok: false,
        error: `http_${e.status}`
      };
      const n = await e.json().catch(() => ({}));
      if (n?.editorial && typeof n.editorial === "object") {
        try {
          const e = readState();
          writeState({
            ...e,
            editorial: _mergeEditorial(e.editorial, n.editorial)
          }, {
            sync: false
          });
        } catch (e) {}
      }
      return {
        ok: true,
        editorial: n?.editorial || null
      };
    } catch (e) {
      return {
        ok: false,
        error: String(e?.message || e || "network")
      };
    }
  }
  function getEditorialTaste() {
    try {
      return readState().editorial || defaultState().editorial;
    } catch (e) {
      return defaultState().editorial;
    }
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
    wasSuggestionRejected: wasSuggestionRejected,
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
    recordEditorialTaste: recordEditorialTaste,
    getEditorialTaste: getEditorialTaste,
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
