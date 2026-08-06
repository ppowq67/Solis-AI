(function() {
  const e = "solis_template_memory";
  const t = "solis_caption_by_template";
  const n = 5;
  const i = 900;
  const s = 999;
  const o = 40;
  const l = 1200;
  const r = 45 * 1e3;
  const a = 18 * 1e3;
  const c = 20 * 1e3;
  const u = new Set;
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
  function sanitizeForTemplate(e, {styles: t = null, captions: n = null, layout: i = null} = {}) {
    const s = templateMemoryProfile(e);
    return {
      styles: s.styles && t && typeof t === "object" && Object.keys(t).length ? t : null,
      captions: s.captions && n && typeof n === "object" && Object.keys(n).length ? n : null,
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
      const e = localStorage.getItem(t) || sessionStorage.getItem(t);
      if (!e) return {};
      const n = JSON.parse(e);
      return n && typeof n === "object" ? n : {};
    } catch (e) {
      return {};
    }
  }
  function writeCaptionMap(e) {
    try {
      const n = JSON.stringify(e || {});
      localStorage.setItem(t, n);
      sessionStorage.setItem(t, n);
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
  let f = null;
  let p = 0;
  let y = false;
  let g = null;
  let d = null;
  let m = false;
  let S = null;
  function fontAnimHint(e) {
    try {
      if (window.__SolisSG?.animFor) return window.__SolisSG.animFor(e);
    } catch (e) {}
    return null;
  }
  const w = {
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
      version: n,
      enabled: true,
      suggestEnabled: true,
      templates: {},
      usageLog: []
    };
  }
  function readState() {
    try {
      const t = localStorage.getItem(e);
      if (!t) return defaultState();
      const i = JSON.parse(t);
      if (!i || typeof i !== "object") return defaultState();
      const s = {
        ...defaultState(),
        ...i,
        version: n,
        templates: i.templates && typeof i.templates === "object" ? i.templates : {},
        usageLog: Array.isArray(i.usageLog) ? i.usageLog : []
      };
      let o = i.version !== n;
      Object.keys(s.templates).forEach(e => {
        const t = s.templates[e];
        if (!t || typeof t !== "object") return;
        const n = sanitizeForTemplate(e, {
          styles: t.styles,
          captions: t.captions,
          layout: t.layout
        });
        const i = JSON.stringify(t.styles || null) !== JSON.stringify(n.styles || null);
        const l = JSON.stringify(t.layout || null) !== JSON.stringify(n.layout || null);
        const r = JSON.stringify(t.captions || null) !== JSON.stringify(n.captions || null);
        if (i || l || r) {
          t.styles = n.styles;
          t.layout = n.layout;
          t.captions = n.captions;
          t.fingerprint = fingerprint(n.styles, n.captions, n.layout);
          o = true;
        }
      });
      if (o) {
        try {
          localStorage.setItem(e, JSON.stringify(s));
        } catch (e) {}
      }
      return s;
    } catch (e) {
      return defaultState();
    }
  }
  function writeState(t, {sync: n = false} = {}) {
    try {
      localStorage.setItem(e, JSON.stringify(t));
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
    const i = [];
    if (n && typeof n === "object") {
      const e = String(n.splitscreen_secondary_type || "");
      if (e === "face_track") i.push("Reframe"); else if (e === "blank") i.push("Black"); else if (e === "blank_blur") i.push("Blur"); else if (e === "gameplay") i.push("Gameplay");
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
    const t = String(e || g || "").toLowerCase();
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
    e.classList.add("c13q");
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
    const o = String(n.anim || "").toLowerCase();
    const l = w[o];
    if (l) {
      if (!n.color) n.color = l.color;
      if (!("fill" in n) && l.fill) n.fill = l.fill;
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
    if (t) return recallCaptionSnap(e || g);
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
          playAnim: true,
          applyFill: true
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
    const o = readState();
    const l = o.templates[e] || {};
    const r = templateMemoryProfile(e);
    let a = t !== undefined ? t : l.styles || null;
    let c = n !== undefined ? n : l.captions || null;
    let u = i !== undefined ? mergeLayouts(l.layout, i) : l.layout || null;
    if (!r.styles) a = null;
    if (!r.layout) u = null;
    if (!r.captions) c = null;
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
      lastGeneratedCaptions: l.lastGeneratedCaptions ? JSON.parse(JSON.stringify(l.lastGeneratedCaptions)) : null,
      lastGeneratedStyles: l.lastGeneratedStyles ? JSON.parse(JSON.stringify(l.lastGeneratedStyles)) : null,
      layout: u ? JSON.parse(JSON.stringify(u)) : null,
      fingerprint: f,
      rejectCount: l.rejectCount || 0,
      lastRejectedFingerprint: l.fingerprint === f ? l.lastRejectedFingerprint || null : null,
      lastSuggestedAt: l.fingerprint === f ? l.lastSuggestedAt : null,
      source: s || l.source || "edit"
    };
    if (c) rememberCaptionSnap(e, c);
    writeState(o, {
      sync: false
    });
    syncSettingsUI();
  }
  function recordFromGeneration(e, t, n, i) {
    if (!e || !isEnabled()) return;
    const s = templateMemoryProfile(e);
    const l = readState();
    const r = l.templates[e] || {};
    let a = s.styles ? t || collectLiveStyles(e) : null;
    let c = s.captions ? n || collectLiveCaptions(e, {
      allowSnap: true
    }) : null;
    let f = s.layout ? mergeLayouts(r.layout, i || collectLiveLayout(e)) : null;
    if (s.captions && (!c || !Object.keys(c).length)) {
      c = recallCaptionSnap(e);
    }
    const y = sanitizeForTemplate(e, {
      styles: a,
      captions: c,
      layout: f
    });
    a = y.styles;
    c = y.captions;
    f = y.layout;
    if (s.layout && !f && layoutUseful(r.layout)) {
      f = normalizeLayout(r.layout);
    }
    if (!(a && Object.keys(a).length) && !(c && Object.keys(c).length) && !layoutUseful(f)) {
      return;
    }
    const g = fingerprint(a, c, f);
    const d = r.fingerprint === g;
    l.templates[e] = {
      updatedAt: (new Date).toISOString(),
      styles: a ? JSON.parse(JSON.stringify(a)) : null,
      captions: c ? JSON.parse(JSON.stringify(c)) : null,
      lastGeneratedCaptions: c ? JSON.parse(JSON.stringify(c)) : r.lastGeneratedCaptions || null,
      lastGeneratedStyles: a ? JSON.parse(JSON.stringify(a)) : r.lastGeneratedStyles || null,
      layout: f ? JSON.parse(JSON.stringify(f)) : null,
      fingerprint: g,
      rejectCount: d ? r.rejectCount || 0 : 0,
      lastRejectedFingerprint: d ? r.lastRejectedFingerprint || null : null,
      lastRejectedAt: d ? r.lastRejectedAt || null : null,
      lastSuggestedAt: d ? r.lastSuggestedAt : null,
      source: "generate"
    };
    l.usageLog.unshift({
      templateId: e,
      at: (new Date).toISOString(),
      fingerprint: g
    });
    l.usageLog = l.usageLog.slice(0, o);
    if (c) rememberCaptionSnap(e, c);
    writeState(l, {
      sync: true
    });
    p = 0;
    u.delete(e);
    syncSettingsUI();
  }
  function recordLayout(e, t) {
    if (!isEnabled()) return;
    const n = e || g || window.clipsStudio?.currentTemplateForPreview?.id;
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
    const n = e || g || window.clipsStudio?.currentTemplateForPreview?.id;
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
    const t = e || g || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!t) return;
    p += 1;
    g = t;
  }
  function scheduleSuggest(e) {
    if (f) {
      clearTimeout(f);
      f = null;
    }
    if (!e || !shouldSuggest(e)) {
      flushDeferredRankingCustoms();
      return;
    }
    const t = 40 + Math.floor(Math.random() * 80);
    f = setTimeout(() => {
      f = null;
      const t = document.getElementById("i24d");
      if (!t || !t.classList.contains("active")) return;
      if (!shouldSuggest(e)) {
        flushDeferredRankingCustoms();
        return;
      }
      showSuggestion(e);
    }, i + t);
  }
  function captionsDiffer(e, t) {
    return fingerprint(null, e) !== fingerprint(null, t);
  }
  function shouldSuggest(e) {
    if (!isSuggestEnabled() || !e) return false;
    if (y) return false;
    if (u.has(e)) return false;
    const t = getTemplateMemory(e);
    if (!t) return false;
    const n = stylesForSuggest(t);
    const i = !!(n && Object.keys(n).length);
    const s = captionsForSuggest(t);
    const o = !!(s && Object.keys(s).length);
    const l = layoutUseful(t.layout);
    if (!i && !o && !l) return false;
    if (t.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
      const n = Date.parse(t.lastRejectedAt || 0);
      if (Number.isFinite(n) && Date.now() - n < r) return false;
      if (!Number.isFinite(n) || Date.now() - n >= r) {
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
    const f = collectLiveStyles(e);
    const p = collectLiveCaptions(e);
    const g = collectLiveLayout(e);
    const d = !!(p && Object.keys(p).length);
    const m = !!(f && Object.keys(f).length);
    const S = templateMemoryProfile(e);
    const w = o && S.captions && !isLibraryPreviewOpen();
    const h = i && S.styles;
    const b = l && S.layout;
    if (!w && !h && !b) return false;
    const _ = Date.parse(t.lastSuggestedAt || 0);
    if (Number.isFinite(_)) {
      const n = isRankingTemplate(e) ? c : a;
      if (Date.now() - _ < n) {
        const e = b && layoutDiffers(t.layout, g);
        if (!e) return false;
      }
    }
    if (b && layoutDiffers(t.layout, g)) return true;
    if (h && isRankingTemplate(e)) {
      if (window.__solisRankingDeferCustoms) return true;
      const e = stylesForSuggest(t);
      if (fingerprint(f, null) !== fingerprint(e, null)) return true;
    }
    if (w && !d) return true;
    if (h && !m && !d) return true;
    const k = smarterCaptions(s, e);
    const C = fingerprint(f, p, g) === t.fingerprint;
    const M = !k || fingerprint(null, p) === fingerprint(null, k);
    if (C && M) return false;
    return true;
  }
  function flushDeferredRankingCustoms() {
    if (!window.__solisRankingDeferCustoms) return;
    window.__solisRankingDeferCustoms = false;
    try {
      const e = g || "ranked_compilation";
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
    const t = document.getElementById("i24g");
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
    const o = n.getBoundingClientRect();
    let l = Math.round(o.right - i - 6);
    let r = Math.round(o.top + 8);
    l = Math.min(window.innerWidth - i - 8, Math.max(8, l));
    r = Math.min(window.innerHeight - s - 8, Math.max(8, r));
    e.style.left = `${l}px`;
    e.style.top = `${r}px`;
    e.style.transform = "none";
  }
  function hideSuggest() {
    const e = document.getElementById("solisMemorySuggest");
    if (e) {
      e.hidden = true;
      e.setAttribute("hidden", "");
      e.classList.remove("open");
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
        document.querySelectorAll(".czh,.c1dh").forEach(e => e.remove());
        const e = document.getElementById("i23z");
        if (e) {
          e.classList.remove("open");
          e.style.visibility = "hidden";
          e.style.opacity = "0";
          e.style.pointerEvents = "none";
        }
      }
      const e = document.getElementById("i20d");
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
    const n = e.captions;
    if (n && typeof n === "object" && Object.keys(n).length) return n;
    return null;
  }
  function stylesForSuggest(e) {
    if (!e || typeof e !== "object") return null;
    const t = e.lastGeneratedStyles;
    if (t && typeof t === "object" && Object.keys(t).length) return t;
    if (e.source === "generate" && e.styles && Object.keys(e.styles).length) {
      return e.styles;
    }
    const n = e.styles;
    if (n && typeof n === "object" && Object.keys(n).length) return n;
    return null;
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
    let i = smarterCaptions(n, e);
    if (!i) {
      i = smarterCaptions({
        anim: "karaoke",
        font: "Montserrat",
        color: "#ffffff",
        highlight: "#FFFFFF",
        shadow: "outline",
        font_size: 96,
        font_size_ratio: .058,
        y_pct: .55,
        enabled: true
      }, e);
    }
    if (!i || typeof window.offerSubtitleMemorySuggest !== "function") return false;
    const s = collectLiveCaptions(e);
    const o = !!(s && Object.keys(s).length);
    if (o && !captionsDiffer(i, s)) return false;
    window.offerSubtitleMemorySuggest(i, e);
    return !!document.getElementById("i23z")?.classList.contains("open") || !!document.querySelector(".c1dh");
  }
  function showSuggestion(e) {
    if (!shouldSuggest(e)) return;
    const t = getTemplateMemory(e);
    if (!t) return;
    let n = false;
    if (isSplitscreenTemplate(e)) {
      if (wantsLayoutSuggest(e, t)) {
        n = offerLayoutSuggest(e, t);
      }
      if (!n) {
        n = offerCaptionSuggest(e, t);
      }
    } else if (isRankingTemplate(e)) {
      const i = stylesForSuggest(t);
      if (i && Object.keys(i).length) {
        n = !!offerRankingStylesSuggest(e, t);
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
    const o = !!document.getElementById("i23z")?.classList.contains("open") || !!document.querySelector(".c1dh");
    if (!s && !o && isRankingTemplate(e)) {
      flushDeferredRankingCustoms();
      return;
    }
    y = true;
    const l = readState();
    if (l.templates[e]) {
      l.templates[e].lastSuggestedAt = (new Date).toISOString();
      writeState(l);
    }
  }
  function offerLayoutSuggest(e, t) {
    t = t || getTemplateMemory(e);
    if (!wantsLayoutSuggest(e, t)) return false;
    if (typeof window.offerSplitscreenMemorySuggest !== "function") return false;
    const n = window.offerSplitscreenMemorySuggest(t.layout, e);
    if (!n) return false;
    const i = ensureSuggestEl();
    const s = i.querySelector("#i20n");
    if (s) {
      s.hidden = true;
      s.textContent = "";
    }
    const o = i.querySelector("#solisMemorySuggestSub");
    if (o) o.textContent = "";
    i.dataset.templateId = e;
    i.dataset.mode = "layout-only";
    placeSuggestNearPreview();
    revealSuggestEl(i);
    return true;
  }
  function offerRankingStylesSuggest(e, t) {
    if (!isRankingTemplate(e)) return false;
    t = t || getTemplateMemory(e);
    const n = stylesForSuggest(t);
    if (!n || !Object.keys(n).length) return false;
    const i = Object.keys(n).filter(e => e !== "__ranking_layout");
    const s = i.some(e => {
      const t = n[e];
      return t && typeof t === "object" && (t.font || t.font_size || t.color);
    });
    if (!s) return false;
    const o = collectLiveStyles(e);
    const l = !!window.__solisRankingDeferCustoms;
    if (!l && fingerprint(o, null) === fingerprint(n, null)) return false;
    try {
      if (window.RankingTextPill) {
        if (typeof window.RankingTextPill.hide === "function") window.RankingTextPill.hide();
        if (typeof window.RankingTextPill.clearSuggest === "function") window.RankingTextPill.clearSuggest();
      }
      document.getElementById("i241")?.classList.remove("active");
    } catch (e) {}
    window.__solisRankingDeferCustoms = false;
    const r = ensureSuggestEl();
    const a = r.querySelector("#i20n");
    if (a) {
      a.hidden = false;
      a.removeAttribute("hidden");
      a.textContent = "Apply last ranking style?";
      a.style.display = "";
    }
    const c = r.querySelector("#solisMemorySuggestSub");
    if (c) c.textContent = "";
    r.dataset.templateId = e;
    r.dataset.mode = "styles-only";
    r.classList.add("solis-memory-suggest--ranking");
    try {
      r._solisMemStyles = JSON.parse(JSON.stringify(n));
    } catch (e) {
      r._solisMemStyles = n;
    }
    try {
      r._solisMemStylesBackup = o ? JSON.parse(JSON.stringify(o)) : JSON.parse(JSON.stringify(window.rankingCustomizer?.customizations || {}));
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
    const t = e || g;
    if (!t || !isSuggestEnabled()) return;
    if (u.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    if (n.lastRejectedFingerprint && n.lastRejectedFingerprint === n.fingerprint) return;
    setTimeout(() => {
      const e = document.getElementById("i24d");
      if (!e || !e.classList.contains("active")) return;
      if (u.has(t)) return;
      if (!isSplitscreenTemplate(t) && wantsLayoutSuggest(t, n) && offerLayoutSuggest(t, n)) return;
      offerRankingStylesSuggest(t, n);
    }, 180);
  }
  function continueSuggestAfterLayout(e) {
    const t = e || g;
    if (!t || !isSuggestEnabled()) return;
    if (u.has(t)) return;
    const n = getTemplateMemory(t);
    if (!n) return;
    setTimeout(() => {
      const e = document.getElementById("i24d");
      if (!e || !e.classList.contains("active")) return;
      if (u.has(t)) return;
      if (!isRankingTemplate(t) && offerCaptionSuggest(t, n)) {
        y = true;
        return;
      }
      offerRankingStylesSuggest(t, n);
      if (document.getElementById("solisMemorySuggest") && !document.getElementById("solisMemorySuggest").hidden) {
        y = true;
      }
    }, 160);
  }
  function acceptSuggestion() {
    const e = ensureSuggestEl();
    const t = e.dataset.templateId || g;
    const n = e.dataset.mode || "all";
    hideSuggest();
    if (t) u.delete(t);
    const i = getTemplateMemory(t);
    if (!i) return;
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
      p = 0;
      y = false;
      try {
        document.querySelectorAll(".cgk").forEach(e => e.classList.remove("cgk"));
        document.getElementById("i241")?.classList.remove("active");
        if (typeof window.hideGameplayPillMenu === "function") window.hideGameplayPillMenu(); else if (typeof hideGameplayPillMenu === "function") hideGameplayPillMenu();
      } catch (e) {}
      continueSuggestAfterLayout(t);
      return;
    }
    if (n === "styles-only") {
      const n = e._solisMemStyles || stylesForSuggest(i);
      if (n && Object.keys(n).length) {
        window.__solisRankingDeferCustoms = false;
        applyStyles(t, n);
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
      const e = stylesForSuggest(i);
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
    const s = readState();
    if (s.templates[t]) {
      s.templates[t].lastAcceptedAt = (new Date).toISOString();
      s.templates[t].lastRejectedFingerprint = null;
      writeState(s);
    }
    p = 0;
    if (typeof window.clearSubtitleMemorySuggest === "function") {
      window.clearSubtitleMemorySuggest();
    }
    try {
      document.getElementById("i241")?.classList.remove("active");
      document.querySelectorAll("#i24g .c1dv.selected").forEach(e => e.classList.remove("selected"));
      if (window.RankingTextPill) {
        if (typeof window.RankingTextPill.clearSuggest === "function") window.RankingTextPill.clearSuggest();
        if (typeof window.RankingTextPill.hide === "function") window.RankingTextPill.hide();
        if (typeof window.RankingTextPill.deselectAll === "function") window.RankingTextPill.deselectAll();
      }
    } catch (e) {}
  }
  function rejectSuggestion() {
    const e = ensureSuggestEl();
    const t = e.dataset.templateId || g;
    const n = e.dataset.mode || "all";
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
      y = false;
      p = 0;
      setTimeout(() => {
        if (!t || u.has(t)) return;
        if (isRankingTemplate(t)) return;
        const e = getTemplateMemory(t);
        if (!e) return;
        if (offerCaptionSuggest(t, e)) {
          y = true;
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
    const t = e || g;
    if (!t) return;
    u.add(t);
    y = true;
    p = 0;
    if (f) {
      clearTimeout(f);
      f = null;
    }
    const n = readState();
    const i = n.templates[t];
    if (i) {
      i.rejectCount = (i.rejectCount || 0) + 1;
      i.lastRejectedFingerprint = i.fingerprint || fingerprint(i.styles, i.captions, i.layout);
      i.lastRejectedAt = (new Date).toISOString();
      writeState(n);
    }
  }
  function scheduleServerSync() {
    if (d) clearTimeout(d);
    d = setTimeout(() => {
      d = null;
      pushServerMemory();
    }, l);
  }
  function apiUrl(e) {
    if (typeof window.apiUrl === "function") return window.apiUrl(e);
    return e;
  }
  function authHeaders() {
    if (typeof getAuthHeaders === "function") return getAuthHeaders();
    return {
      "Content-Type": "application/json"
    };
  }
  async function pushServerMemory() {
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
  function mergeMemoryStates(e, t) {
    const n = {
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
      const t = n.templates[e];
      const s = _sanitizeRemoteTemplate(e, i[e]);
      if (!t) {
        if (s) n.templates[e] = s;
        return;
      }
      if (!s) return;
      const o = Date.parse(t.updatedAt || 0) || 0;
      const l = Date.parse(s.updatedAt || 0) || 0;
      if (l > o) n.templates[e] = s; else if (l === o) {
        const i = {
          ...t,
          captions: t.captions || s.captions || null,
          styles: t.styles || s.styles || null,
          layout: t.layout || s.layout || null
        };
        n.templates[e] = _sanitizeRemoteTemplate(e, i) || i;
      } else {
        n.templates[e] = _sanitizeRemoteTemplate(e, t) || t;
      }
    });
    Object.keys(n.templates).forEach(e => {
      n.templates[e] = _sanitizeRemoteTemplate(e, n.templates[e]) || n.templates[e];
    });
    return n;
  }
  async function pullServerMemory() {
    if (S) return S;
    S = (async () => {
      try {
        const e = await fetch(apiUrl("/api/clips/memory"), {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            action: "get"
          })
        });
        if (!e.ok) return;
        const t = await e.json();
        const n = t?.memory;
        if (!n || typeof n !== "object") return;
        const i = mergeMemoryStates(readState(), n);
        writeState(i, {
          sync: false
        });
        m = true;
        syncSettingsUI();
      } catch (e) {} finally {
        S = null;
      }
    })();
    return S;
  }
  async function onTemplatePreviewOpen(e) {
    g = e || null;
    y = false;
    p = 0;
    hideSuggest();
    try {
      u.delete(e);
      const t = getTemplateMemory(e);
      if (t?.lastRejectedAt && t?.lastRejectedFingerprint && t.lastRejectedFingerprint === t.fingerprint) {
        const n = Date.parse(t.lastRejectedAt);
        if (Number.isFinite(n) && Date.now() - n < r) {
          u.add(e);
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
    if (!m) {
      pullServerMemory().then(() => {
        if (!y) scheduleSuggest(e);
      }).catch(() => {});
    }
    setTimeout(() => flushDeferredRankingCustoms(), i + 400);
  }
  function onTemplatePreviewClose() {
    if (f) {
      clearTimeout(f);
      f = null;
    }
    hideSuggest();
    y = false;
    try {
      if (g) {
        const e = templateMemoryProfile(g);
        const t = e.captions ? collectLiveCaptions(g) : null;
        const n = e.styles && !isRankingTemplate(g) ? collectLiveStyles(g) : undefined;
        upsertTemplateMemory(g, {
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
    g = null;
  }
  function generateFromUsage() {
    const e = readState();
    let t = 0;
    try {
      const n = localStorage.getItem("rankingCustomizations");
      if (n) {
        const i = JSON.parse(n);
        if (i && Object.keys(i).length) {
          const n = fingerprint(i, null, null);
          e.templates.ranked_compilation = {
            ...e.templates.ranked_compilation || {},
            updatedAt: (new Date).toISOString(),
            styles: i,
            captions: null,
            layout: null,
            fingerprint: n,
            rejectCount: 0,
            lastRejectedFingerprint: null,
            source: "usage"
          };
          t += 1;
        }
      }
    } catch (e) {}
    writeState(e);
    syncSettingsUI();
    return t;
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
    const t = document.getElementById("i228");
    const n = document.getElementById("i22b");
    const i = document.getElementById("i227");
    const s = document.getElementById("i22a");
    if (t) {
      t.classList.toggle("cic", !!e.enabled);
      t.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    if (i) i.textContent = e.enabled ? "On" : "Off";
    if (n) {
      n.classList.toggle("cic", !!e.suggestEnabled);
      n.setAttribute("aria-checked", e.suggestEnabled ? "true" : "false");
      n.disabled = !e.enabled;
      n.classList.toggle("ci7", !e.enabled);
    }
    if (s) s.textContent = e.suggestEnabled ? "On" : "Off";
    const o = document.getElementById("i232");
    if (o) {
      o.classList.toggle("cic", !!e.enabled);
      o.setAttribute("aria-checked", e.enabled ? "true" : "false");
    }
    const l = document.getElementById("i229");
    if (!l) return;
    const r = listMemories();
    if (!r.length) {
      l.innerHTML = `<p class="stgMemoryEmpty">No saved styles yet. Customize a preview and generate a clip. Memory will learn from that.</p>`;
      return;
    }
    l.innerHTML = r.map(e => `\n            <div class="stgMemoryItem" data-mem-id="${e.templateId}">\n                <div class="stgMemoryItemBody">\n                    <div class="stgMemoryItemTitle">${escapeHtml(prettyTemplateName(e.templateId))}${e.hasCaptions ? " · Captions" : ""}${e.hasLayout ? " · Layout" : ""}</div>\n                    <div class="stgMemoryItemMeta">${escapeHtml(e.summary)}${e.updatedAt ? ` · ${formatRelative(e.updatedAt)}` : ""}</div>\n                </div>\n                <button type="button" class="stgMemoryClearOne" data-clear-mem="${e.templateId}" title="Clear">Clear</button>\n            </div>\n        `).join("");
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
    const e = document.getElementById("i228");
    const t = document.getElementById("i22b");
    const n = document.getElementById("i226");
    const i = document.getElementById("i229");
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
    pullServerMemory();
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
    applyCaptions: applyCaptions,
    smarterCaptions: smarterCaptions,
    continueSuggestAfterCaption: continueSuggestAfterCaption,
    continueSuggestAfterLayout: continueSuggestAfterLayout,
    pullServerMemory: pullServerMemory,
    markSuggestionRejected: markSuggestionRejected,
    rejectSuggestion: rejectSuggestion,
    acceptSuggestion: acceptSuggestion,
    rememberCaptionSnap: rememberCaptionSnap,
    recallCaptionSnap: recallCaptionSnap,
    getCurrentTemplateId: () => g,
    isRankingTemplate: isRankingTemplate,
    isSplitscreenTemplate: isSplitscreenTemplate,
    _applying: false
  };
  document.addEventListener("keydown", e => {
    const t = document.getElementById("solisMemorySuggest");
    if (window.__solisPendingSubMem || document.querySelector(".c1dh") || document.getElementById("i23z")?.classList.contains("open")) {
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
