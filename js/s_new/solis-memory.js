(function() {
  const e = "solis_template_memory";
  const t = "solis_caption_by_template";
  const n = "solis_memory_owner_id";
  const s = "solis_template_memory";
  const i = "solis_caption_by_template";
  const o = 5;
  const r = 900;
  const l = 999;
  const a = 40;
  const c = 1200;
  const u = 45 * 1e3;
  const f = 18 * 1e3;
  const g = 20 * 1e3;
  const p = new Set;
  function isRankingTemplate(e) {
    const t = String(e || "").toLowerCase();
    return t === "ranked_compilation" || t === "ranking" || t.includes("rank");
  }
  function isSplitscreenTemplate(e) {
    const t = String(e || "").toLowerCase();
    return t === "splitscreen" || t.includes("split");
  }
  function templateMemoryProfile(e) {
    return {
      styles: isRankingTemplate(e),
      layout: isSplitscreenTemplate(e),
      captions: !isRankingTemplate(e)
    };
  }
  function sanitizeForTemplate(e, {styles: t = null, captions: n = null, layout: s = null} = {}) {
    const i = templateMemoryProfile(e);
    return {
      styles: i.styles && t && typeof t === "object" && Object.keys(t).length ? t : null,
      captions: i.captions && n && typeof n === "object" && Object.keys(n).length ? n : null,
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
      const s = localStorage.getItem(e) || sessionStorage.getItem(e) || (!n ? localStorage.getItem(i) : null) || (!n ? sessionStorage.getItem(i) : null);
      if (!s) return {};
      const o = JSON.parse(s);
      return o && typeof o === "object" ? o : {};
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
  let y = null;
  let d = 0;
  let m = false;
  let S = null;
  let w = null;
  let h = false;
  let b = null;
  let _ = null;
  let M = false;
  function _resolveUserId(e) {
    if (e != null && String(e).trim()) return String(e).trim();
    if (_) return _;
    try {
      const e = window.currentUser?.id ?? window.currentUser?.user_id;
      if (e != null && String(e).trim()) return String(e).trim();
    } catch (e) {}
    try {
      const e = localStorage.getItem(n);
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
      localStorage.removeItem(i);
      sessionStorage.removeItem(i);
    } catch (e) {}
  }
  function setUserId(e, {clearLocal: t = false} = {}) {
    const s = _resolveUserId(e);
    const i = !!(_ && s && _ !== s);
    _ = s;
    h = false;
    if (s) {
      try {
        localStorage.setItem(n, s);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem(n);
      } catch (e) {}
    }
    _purgeLegacyGlobalKeys();
    if (t || i) {
      try {
        writeState(defaultState(), {
          sync: false
        });
      } catch (e) {}
      M = true;
    }
    return {
      switched: i,
      userId: s
    };
  }
  function fontAnimHint(e) {
    try {
      if (window.__SolisSG?.animFor) return window.__SolisSG.animFor(e);
    } catch (e) {}
    return null;
  }
  const k = {
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
      usageLog: []
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
        usageLog: Array.isArray(r.usageLog) ? r.usageLog : []
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
  function fingerprint(e, t, n) {
    try {
      return JSON.stringify({
        s: e || null,
        c: t || null,
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
      if (e === "face_track") s.push("Reframe"); else if (e === "blank") s.push("Black"); else if (e === "blank_blur") s.push("Blur"); else if (e === "gameplay") s.push("Gameplay");
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
    const t = String(e || S || "").toLowerCase();
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
    const t = String(e.splitscreen_secondary_type || "");
    if (t === "face_track") return "Reframe";
    if (t === "blank") return "Black canvas";
    if (t === "blank_blur") return "Blur canvas";
    if (t === "gameplay") return "Gameplay fill";
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
    const r = k[o];
    if (r) {
      if (!n.color) n.color = r.color;
      if (!("fill" in n) && r.fill) n.fill = r.fill;
    }
    if (!n.font_size || n.font_size < 28) n.font_size = n.font_size || 68;
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
    if (t) return recallCaptionSnap(e || S);
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
    o.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: a ? JSON.parse(JSON.stringify(a)) : null,
      captions: c ? JSON.parse(JSON.stringify(c)) : null,
      lastGeneratedCaptions: r.lastGeneratedCaptions ? JSON.parse(JSON.stringify(r.lastGeneratedCaptions)) : null,
      lastGeneratedStyles: r.lastGeneratedStyles ? JSON.parse(JSON.stringify(r.lastGeneratedStyles)) : null,
      layout: u ? JSON.parse(JSON.stringify(u)) : null,
      fingerprint: f,
      rejectCount: r.rejectCount || 0,
      lastRejectedFingerprint: r.fingerprint === f ? r.lastRejectedFingerprint || null : null,
      lastSuggestedAt: r.fingerprint === f ? r.lastSuggestedAt : null,
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
    let c = i.captions ? n || collectLiveCaptions(e, {
      allowSnap: true
    }) : null;
    let u = i.layout ? mergeLayouts(r.layout, s || collectLiveLayout(e)) : null;
    if (i.captions && (!c || !Object.keys(c).length)) {
      c = recallCaptionSnap(e);
    }
    const f = sanitizeForTemplate(e, {
      styles: l,
      captions: c,
      layout: u
    });
    l = f.styles;
    c = f.captions;
    u = f.layout;
    if (i.layout && !u && layoutUseful(r.layout)) {
      u = normalizeLayout(r.layout);
    }
    if (!(l && Object.keys(l).length) && !(c && Object.keys(c).length) && !layoutUseful(u)) {
      return;
    }
    const g = fingerprint(l, c, u);
    const y = r.fingerprint === g;
    o.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: l ? JSON.parse(JSON.stringify(l)) : null,
      captions: c ? JSON.parse(JSON.stringify(c)) : null,
      lastGeneratedCaptions: c ? JSON.parse(JSON.stringify(c)) : r.lastGeneratedCaptions || null,
      lastGeneratedStyles: l ? JSON.parse(JSON.stringify(l)) : r.lastGeneratedStyles || null,
      layout: u ? JSON.parse(JSON.stringify(u)) : null,
      fingerprint: g,
      rejectCount: y ? r.rejectCount || 0 : 0,
      lastRejectedFingerprint: y ? r.lastRejectedFingerprint || null : null,
      lastRejectedAt: y ? r.lastRejectedAt || null : null,
      lastSuggestedAt: y ? r.lastSuggestedAt : null,
      source: "generate"
    };
    o.usageLog.unshift({
      templateId: e,
      at: (new Date).toISOString(),
      fingerprint: g
    });
    o.usageLog = o.usageLog.slice(0, a);
    if (c) rememberCaptionSnap(e, c);
    writeState(o, {
      sync: true
    });
    d = 0;
    p.delete(e);
    syncSettingsUI();
  }
  function recordLayout(e, t) {
    if (!isEnabled()) return;
    const n = e || S || window.clipsStudio?.currentTemplateForPreview?.id;
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
    const n = e || S || window.clipsStudio?.currentTemplateForPreview?.id;
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
    const t = e || S || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!t) return;
    d += 1;
    S = t;
  }
  function scheduleSuggest(e) {
    if (y) {
      clearTimeout(y);
      y = null;
    }
    if (!e || !shouldSuggest(e) && !canOfferFirstAnimTip(e)) {
      flushDeferredRankingCustoms();
      return;
    }
    const t = 40 + Math.floor(Math.random() * 80);
    y = setTimeout(() => {
      y = null;
      const t = document.getElementById("templatePreviewModal");
      if (!t || !t.classList.contains("active")) return;
      if (!shouldSuggest(e) && !canOfferFirstAnimTip(e)) {
        flushDeferredRankingCustoms();
        return;
      }
      showSuggestion(e);
    }, r + t);
  }
  function captionsDiffer(e, t) {
    return fingerprint(null, e) !== fingerprint(null, t);
  }
  function shouldSuggest(e) {
    if (!isSuggestEnabled() || !e) return false;
    if (m) return false;
    if (p.has(e)) return false;
    const t = getTemplateMemory(e);
    if (!t) return false;
    const n = stylesForSuggest(t);
    const s = !!(n && Object.keys(n).length);
    const i = captionsForSuggest(t);
    const o = !!(i && Object.keys(i).length);
    const r = layoutUseful(t.layout);
    if (!s && !o && !r) return false;
    if (t.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
      const n = Date.parse(t.lastRejectedAt || 0);
      if (Number.isFinite(n) && Date.now() - n < u) return false;
      if (!Number.isFinite(n) || Date.now() - n >= u) {
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
    if (isLibraryPreviewOpen() && !r) return false;
    const l = collectLiveStyles(e);
    const a = collectLiveCaptions(e);
    const c = collectLiveLayout(e);
    const y = !!(a && Object.keys(a).length);
    const d = !!(l && Object.keys(l).length);
    const S = templateMemoryProfile(e);
    const w = o && S.captions && !isLibraryPreviewOpen();
    const h = s && S.styles;
    const b = r && S.layout;
    if (!w && !h && !b) return false;
    const _ = Date.parse(t.lastSuggestedAt || 0);
    if (Number.isFinite(_)) {
      const n = isRankingTemplate(e) ? g : f;
      if (Date.now() - _ < n) {
        const e = b && layoutDiffers(t.layout, c);
        if (!e) return false;
      }
    }
    if (b && layoutDiffers(t.layout, c)) return true;
    if (h && isRankingTemplate(e)) return true;
    if (w && !y) return true;
    if (h && !d && !y) return true;
    const M = smarterCaptions(i, e);
    const k = fingerprint(l, a, c) === t.fingerprint;
    const v = !M || fingerprint(null, a) === fingerprint(null, M);
    if (k && v) return false;
    return true;
  }
  function flushDeferredRankingCustoms() {
    if (!window.__solisRankingDeferCustoms) return;
    window.__solisRankingDeferCustoms = false;
    try {
      const e = S || "ranked_compilation";
      const t = getTemplateMemory(e);
      const n = stylesForSuggest(t);
      if (n && Object.keys(n).length && isRankingTemplate(e)) {
        applyStyles(e, n);
        return;
      }
      if (window.rankingCustomizer && typeof window.rankingCustomizer.applyCustomizations === "function") {
        window.rankingCustomizer.applyCustomizations();
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
  function captionsForSuggest(e) {
    if (!e || typeof e !== "object") return null;
    const t = e.lastGeneratedCaptions;
    if (t && typeof t === "object" && Object.keys(t).length) return t;
    return null;
  }
  function stylesForSuggest(e) {
    if (!e || typeof e !== "object") return null;
    const t = e.lastGeneratedStyles;
    if (t && typeof t === "object" && Object.keys(t).length) return t;
    const n = e.styles;
    if (n && typeof n === "object" && Object.keys(n).length) return n;
    return null;
  }
  function rankingStylesReady(e) {
    const t = getTemplateMemory(e || "ranked_compilation");
    const n = stylesForSuggest(t);
    if (!n || !Object.keys(n).length) return false;
    return Object.keys(n).some(e => {
      if (e === "__ranking_layout") return false;
      const t = n[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    });
  }
  function isLibraryPreviewOpen() {
    try {
      return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
    } catch (e) {
      return false;
    }
  }
  function offerCaptionSuggest(e, t) {
    if (isRankingTemplate(e)) return false;
    if (isLibraryPreviewOpen()) return false;
    t = t || getTemplateMemory(e);
    const n = captionsForSuggest(t);
    if (!n) {
      const t = collectLiveCaptions(e);
      const n = !!(t && Object.keys(t).length);
      const s = String(t?.anim || "").toLowerCase();
      const i = !n || !s || s === "none" || s === "static";
      if (!i || typeof window.offerSubtitleMemorySuggest !== "function") return false;
      const o = smarterCaptions({
        anim: "karaoke",
        font: String(t?.font || "Montserrat"),
        color: t?.color || "#ffffff",
        highlight: t?.highlight || "#FFFFFF",
        shadow: t?.shadow || "outline",
        font_size: t?.font_size || 96,
        font_size_ratio: t?.font_size_ratio || .058,
        y_pct: t?.y_pct != null ? t.y_pct : .55,
        enabled: true,
        __tip: "animations"
      }, e);
      window.offerSubtitleMemorySuggest(o, e);
      return !!document.getElementById("subMemActions")?.classList.contains("open") || !!document.querySelector(".sub-mem-ghost");
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
    if (!s || typeof window.offerSubtitleMemorySuggest !== "function") return false;
    const i = collectLiveCaptions(e);
    const o = !!(i && Object.keys(i).length);
    if (o && !captionsDiffer(s, i)) return false;
    window.offerSubtitleMemorySuggest(s, e);
    return !!document.getElementById("subMemActions")?.classList.contains("open") || !!document.querySelector(".sub-mem-ghost");
  }
  function showSuggestion(e) {
    if (!shouldSuggest(e) && !canOfferFirstAnimTip(e)) return;
    const t = getTemplateMemory(e);
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
      if (!t) {
        flushDeferredRankingCustoms();
        return;
      }
      const s = stylesForSuggest(t);
      if (s && Object.keys(s).length) {
        n = !!offerRankingStylesSuggest(e, t);
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
    m = true;
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
    if (m) return false;
    if (p.has(e)) return false;
    if (isRankingTemplate(e)) return false;
    if (isLibraryPreviewOpen()) return false;
    const t = getTemplateMemory(e);
    if (captionsForSuggest(t)) return false;
    return true;
  }
  function offerInstantRecipe(e, t) {
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
    m = true;
    placeSuggestNearPreview();
    revealSuggestEl(i);
    return true;
  }
  function retrySuggest(e) {
    const t = e || S;
    if (!t || m) return;
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
    placeSuggestNearPreview();
    revealSuggestEl(s);
    return true;
  }
  function offerRankingStylesSuggest(e, t) {
    if (!isRankingTemplate(e)) return false;
    t = t || getTemplateMemory(e);
    const n = stylesForSuggest(t);
    if (!n || !Object.keys(n).length) return false;
    const s = Object.keys(n).filter(e => e !== "__ranking_layout");
    const i = s.some(e => {
      const t = n[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    });
    if (!i) return false;
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
    window.__solisRankingDeferCustoms = false;
    const r = ensureSuggestEl();
    const l = r.querySelector("#solisMemorySuggestTitle");
    if (l) {
      l.hidden = false;
      l.removeAttribute("hidden");
      l.textContent = "Apply last ranking style?";
      l.style.display = "";
    }
    const a = r.querySelector("#solisMemorySuggestSub");
    if (a) a.textContent = "";
    r.dataset.templateId = e;
    r.dataset.mode = "styles-only";
    r.classList.add("solis-memory-suggest--ranking");
    try {
      r._solisMemStyles = JSON.parse(JSON.stringify(n));
    } catch (e) {
      r._solisMemStyles = n;
    }
    try {
      const t = collectLiveStyles(e);
      r._solisMemStylesBackup = t ? JSON.parse(JSON.stringify(t)) : JSON.parse(JSON.stringify(window.rankingCustomizer?.customizations || {}));
      applyStyles(e, n);
      r._solisMemStylesPreviewed = true;
    } catch (e) {
      r._solisMemStylesPreviewed = false;
    }
    placeSuggestNearPreview();
    revealSuggestEl(r);
    return true;
  }
  function continueSuggestAfterCaption(e) {
    const t = e || S;
    if (!t || !isSuggestEnabled()) return;
    if (p.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    if (n.lastRejectedFingerprint && n.lastRejectedFingerprint === n.fingerprint) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (p.has(t)) return;
      if (!isSplitscreenTemplate(t) && wantsLayoutSuggest(t, n) && offerLayoutSuggest(t, n)) return;
      offerRankingStylesSuggest(t, n);
    }, 180);
  }
  function continueSuggestAfterLayout(e) {
    const t = e || S;
    if (!t || !isSuggestEnabled()) return;
    if (p.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    setTimeout(() => {
      const e = document.getElementById("templatePreviewModal");
      if (!e || !e.classList.contains("active")) return;
      if (p.has(t)) return;
      if (!isRankingTemplate(t) && offerCaptionSuggest(t, n)) {
        m = true;
        return;
      }
      offerRankingStylesSuggest(t, n);
      if (document.getElementById("solisMemorySuggest") && !document.getElementById("solisMemorySuggest").hidden) {
        m = true;
      }
    }, 160);
  }
  function acceptSuggestion() {
    const e = ensureSuggestEl();
    const t = e.dataset.templateId || S;
    const n = e.dataset.mode || "all";
    hideSuggest();
    if (t) p.delete(t);
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
      d = 0;
      m = false;
      if (window.__solisRecipeSkipCaptions) {
        m = true;
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
      d = 0;
      m = false;
      try {
        document.querySelectorAll(".gp-mem-pick").forEach(e => e.classList.remove("gp-mem-pick"));
        document.getElementById("subPillMenu")?.classList.remove("active");
        if (typeof window.hideGameplayPillMenu === "function") window.hideGameplayPillMenu(); else if (typeof hideGameplayPillMenu === "function") hideGameplayPillMenu();
      } catch (e) {}
      continueSuggestAfterLayout(t);
      return;
    }
    if (n === "styles-only") {
      const n = e._solisMemStyles || stylesForSuggest(s);
      if (n && Object.keys(n).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, n);
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
      const e = stylesForSuggest(s);
      if (e && Object.keys(e).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, e);
      }
    }
    try {
      delete e._solisMemStyles;
      delete e._solisMemStylesBackup;
      delete e._solisMemStylesPreviewed;
      e.classList.remove("solis-memory-suggest--ranking");
    } catch (e) {}
    const i = readState();
    if (i.templates[t]) {
      i.templates[t].lastAcceptedAt = (new Date).toISOString();
      i.templates[t].lastRejectedFingerprint = null;
      writeState(i);
    }
    d = 0;
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
    const t = e.dataset.templateId || S;
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
      m = false;
      d = 0;
      if (!window.__solisRecipeSkipCaptions) {
        setTimeout(() => {
          if (!t || p.has(t)) return;
          const e = getTemplateMemory(t);
          if (e && offerCaptionSuggest(t, e)) {
            m = true;
          }
        }, 280);
      }
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
      m = false;
      d = 0;
      setTimeout(() => {
        if (!t || p.has(t)) return;
        if (isRankingTemplate(t)) return;
        const e = getTemplateMemory(t);
        if (!e) return;
        if (offerCaptionSuggest(t, e)) {
          m = true;
        }
      }, 280);
      return;
    }
    hideSuggest();
    markSuggestionRejected(t);
    if (n === "styles-only" && e._solisMemStylesPreviewed && e._solisMemStylesBackup) {
      try {
        applyStyles(t, e._solisMemStylesBackup);
      } catch (e) {}
    }
    try {
      delete e._solisMemStyles;
      delete e._solisMemStylesBackup;
      delete e._solisMemStylesPreviewed;
      e.classList.remove("solis-memory-suggest--ranking");
    } catch (e) {}
    window.__solisRankingDeferCustoms = false;
    if (typeof window.clearSubtitleMemorySuggest === "function") {
      window.clearSubtitleMemorySuggest({
        cooldown: true,
        persistReject: true
      });
    }
  }
  function markSuggestionRejected(e) {
    const t = e || S;
    if (!t) return;
    p.add(t);
    m = true;
    d = 0;
    if (y) {
      clearTimeout(y);
      y = null;
    }
    const n = readState();
    const s = n.templates[t];
    if (s) {
      s.rejectCount = (s.rejectCount || 0) + 1;
      s.lastRejectedFingerprint = s.fingerprint || fingerprint(s.styles, s.captions, s.layout);
      s.lastRejectedAt = (new Date).toISOString();
      writeState(n);
    }
  }
  function scheduleServerSync() {
    if (w) clearTimeout(w);
    w = setTimeout(() => {
      w = null;
      pushServerMemory();
    }, c);
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
    if (b) return b;
    b = (async () => {
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
        const s = M;
        M = false;
        const i = mergeMemoryStates(readState(), n, {
          preferRemote: s
        });
        writeState(i, {
          sync: false
        });
        h = true;
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
        b = null;
      }
    })();
    return b;
  }
  async function onTemplatePreviewOpen(e) {
    S = e || null;
    m = false;
    d = 0;
    hideSuggest();
    try {
      p.delete(e);
      const t = getTemplateMemory(e);
      if (t?.lastRejectedAt && t?.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
        const n = Date.parse(t.lastRejectedAt);
        if (Number.isFinite(n) && Date.now() - n < u) {
          p.add(e);
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
    if (!h) {
      pullServerMemory().then(() => {
        if (!m) scheduleSuggest(e);
      }).catch(() => {});
    }
    setTimeout(() => flushDeferredRankingCustoms(), r + 400);
  }
  function onTemplatePreviewClose() {
    if (y) {
      clearTimeout(y);
      y = null;
    }
    hideSuggest();
    m = false;
    try {
      if (S) {
        const e = templateMemoryProfile(S);
        const t = e.captions ? collectLiveCaptions(S) : null;
        const n = e.styles && !isRankingTemplate(S) ? collectLiveStyles(S) : undefined;
        upsertTemplateMemory(S, {
          styles: n || undefined,
          captions: t || undefined,
          source: "close"
        });
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
    S = null;
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
    rememberCaptionSnap: rememberCaptionSnap,
    recallCaptionSnap: recallCaptionSnap,
    getCurrentTemplateId: () => S,
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
