const RANKING_VIDEO_WIDTH = 1080;

const RANKING_OUTLINE_OFFSETS = [ [ 2, 0 ], [ -2, 0 ], [ 0, 2 ], [ 0, -2 ], [ 1, 1 ], [ -1, -1 ], [ 1, -1 ], [ -1, 1 ] ];

const RANKING_THIN_OUTLINE_OFFSETS = RANKING_OUTLINE_OFFSETS;

const RANKING_THICK_OUTLINE_OFFSETS = [ [ 3, 0 ], [ -3, 0 ], [ 0, 3 ], [ 0, -3 ], [ 2, 2 ], [ -2, -2 ], [ 2, -2 ], [ -2, 2 ] ];

const RANKING_STROKE_CSS = "2px 0 0 #000,-2px 0 0 #000,0 2px 0 #000,0 -2px 0 #000," + "1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000";

const RANKING_SHADOW_CSS = {
  none: "none",
  stroke: RANKING_STROKE_CSS,
  outline: RANKING_STROKE_CSS,
  "thick-outline": "3px 0 0 #000,-3px 0 0 #000,0 3px 0 #000,0 -3px 0 #000," + "2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000"
};

const RANKING_OFFSETS_BY_STYLE = {
  stroke: RANKING_OUTLINE_OFFSETS,
  outline: RANKING_THIN_OUTLINE_OFFSETS,
  "thick-outline": RANKING_THICK_OUTLINE_OFFSETS,
  none: []
};

const RANKING_FONT_TO_FILE = {
  "Luckiest Guy": "LuckiestGuy-Regular.ttf",
  "Bebas Neue": "BebasNeue-Regular.ttf",
  Anton: "Anton-Regular.ttf",
  Montserrat: "Montserrat-Bold.ttf",
  Poppins: "Poppins-SemiBold.ttf",
  Roboto: "Roboto-Bold.ttf",
  Fredoka: "Fredoka-Bold.ttf"
};

const RANKING_FONT_WEIGHT = {
  "Luckiest Guy": "400",
  "Bebas Neue": "400",
  Anton: "400",
  Montserrat: "700",
  Poppins: "600",
  Roboto: "700",
  Fredoka: "700"
};

const RANKING_FILE_TO_FONT = Object.fromEntries(Object.entries(RANKING_FONT_TO_FILE).map(([t, e]) => [ e, t ]));

class RankingCustomizer {
  constructor() {
    this.customizations = {};
    this.selectedElement = null;
    this.elementElements = new Map;
    this.init();
  }
  init() {
    this.createUI();
    this.setupEventListeners();
    this.loadDefaultElements();
  }
  createUI() {
    if (document.getElementById("ranking-customizer-panel")) return;
    const t = document.createElement("div");
    t.id = "ranking-customizer-panel";
    t.className = "ranking-customizer";
    t.innerHTML = `\n            <div class="ranking-customizer-header">\n                <h3>✏️ Ranking Template Editor</h3>\n                <button class="ranking-customizer-close" onclick="rankingCustomizer.toggle()">×</button>\n            </div>\n\n            <div class="ranking-customizer-content">\n                \x3c!-- Main Titles Section --\x3e\n                <div class="ranking-section">\n                    <h4>📌 Main Titles</h4>\n                    <div class="ranking-edit-group">\n                        <label>Title 1 (e.g., "RANKING")</label>\n                        <input type="text" data-element="title_ranking" placeholder="RANKING" maxlength="30">\n                    </div>\n                    <div class="ranking-edit-group">\n                        <label>Title 2 (e.g., "BEST")</label>\n                        <input type="text" data-element="title_funniest" placeholder="BEST" maxlength="30">\n                    </div>\n                    <div class="ranking-edit-group">\n                        <label>Subtitle</label>\n                        <input type="text" data-element="title_channel" placeholder="CHANNEL MOMENTS" maxlength="40">\n                    </div>\n                </div>\n\n                \x3c!-- Rank Elements Section --\x3e\n                <div class="ranking-section">\n                    <h4>🏆 Rank Titles (1-5)</h4>\n                    <div id="ranking-ranks-container">\n                        \x3c!-- Populated by JavaScript --\x3e\n                    </div>\n                </div>\n\n                \x3c!-- Color customization --\x3e\n                <div class="ranking-section" style="display:none;" id="ranking-colors-section">\n                    <h4>🎨 Colors</h4>\n                    <div id="ranking-color-controls">\n                        \x3c!-- Populated when element selected --\x3e\n                    </div>\n                </div>\n\n                \x3c!-- Preview --\x3e\n                <div class="ranking-section">\n                    <h4>👁️ Preview</h4>\n                    <p style="font-size: 12px; color: #888; margin-top: 8px;">Double-click template elements to customize them</p>\n                </div>\n            </div>\n        `;
    document.body?.appendChild(t);
    this.panel = t;
  }
  loadDefaultElements() {
    const t = document.getElementById("ranking-ranks-container");
    if (!t) return;
    for (let e = 1; e <= 5; e++) {
      const n = document.createElement("div");
      n.className = "ranking-edit-group";
      n.innerHTML = `\n                <label>Rank ${e} Title</label>\n                <input type="text" data-element="rank_${e}_title" placeholder="Rank ${e} Moment Title" maxlength="50">\n                <label style="margin-top: 8px; font-size: 12px; display: block;">Color</label>\n                <div class="ranking-color-picker" data-element="rank_${e}_title" style="display: flex; gap: 6px; flex-wrap: wrap;">\n                    ${this.createColorPalette(`rank_${e}_title`)}\n                </div>\n            `;
      t.appendChild(n);
    }
  }
  createColorPalette(t) {
    const e = [ {
      name: "Gold",
      rgb: "rgb(255, 215, 0)"
    }, {
      name: "Silver",
      rgb: "rgb(192, 192, 192)"
    }, {
      name: "Bronze",
      rgb: "rgb(205, 127, 50)"
    }, {
      name: "White",
      rgb: "rgb(255, 255, 255)"
    }, {
      name: "Red",
      rgb: "rgb(255, 0, 0)"
    }, {
      name: "Cyan",
      rgb: "rgb(0, 255, 255)"
    }, {
      name: "Lime",
      rgb: "rgb(0, 255, 0)"
    }, {
      name: "Yellow",
      rgb: "rgb(255, 255, 0)"
    } ];
    return e.map(e => `\n            <button class="ranking-color-btn" style="background-color: ${e.rgb}; width: 32px; height: 32px; border-radius: 4px; border: 2px solid #333; cursor: pointer;"\n                    onclick="rankingCustomizer.setElementColor('${t}', '${e.rgb}')"\n                    title="${e.name}"></button>\n        `).join("");
  }
  setupEventListeners() {
    document.addEventListener("input", t => {
      if (t.target.matches("[data-element]")) {
        const e = t.target.getAttribute("data-element");
        const n = t.target.value;
        this.setElementContent(e, n);
      }
    });
    const t = localStorage.getItem("rankingCustomizations");
    if (t) {
      try {
        this.customizations = this._sanitizeCustoms(JSON.parse(t));
        this.applyCustomizations();
      } catch (t) {
        console.warn("Failed to load saved customizations:", t);
      }
    }
  }
  _sanitizeCustoms(t) {
    const e = t && typeof t === "object" ? t : {};
    for (const [t, n] of Object.entries(e)) {
      if (!n || typeof n !== "object") continue;
      const e = t.startsWith("title_") || t.startsWith("rank_");
      if (!e) continue;
      if (n.stroke_style === "none" && (!n.outline_offsets || !n.outline_offsets.length)) {
        delete n.stroke_style;
        delete n.outline_offsets;
      }
      if (typeof n.font_size === "number" && n.font_size > 0 && n.font_size < 20) {
        delete n.font_size;
      }
      if (t.startsWith("title_") && typeof n.font_size === "number" && n.font_size > 160) {
        n.font_size = 160;
      }
      if (t.startsWith("rank_") && typeof n.font_size === "number" && n.font_size > 150) {
        n.font_size = 150;
      }
      if (typeof n.content === "string") {
        n.content = n.content.replace(/\s+/g, " ").trim().slice(0, t.startsWith("title_") ? 28 : 42);
        if (t === "title_funniest" && /^funniest$/i.test(n.content)) {
          n.content = "BEST";
        }
      }
    }
    return e;
  }
  setElementContent(t, e) {
    if (!this.customizations[t]) {
      this.customizations[t] = {};
    }
    this.customizations[t].content = e;
    this.saveCustomizations();
  }
  setElementColor(t, e) {
    if (!t) return;
    if (!this.customizations[t]) {
      this.customizations[t] = {};
    }
    const n = this._colorToRgba(e);
    if (n) {
      this.customizations[t].color = n;
      this.saveCustomizations();
    }
  }
  setElementFontSizeScaled(t, e) {
    if (!t || !(e > 0)) return;
    if (!this.customizations[t]) {
      this.customizations[t] = {};
    }
    this.customizations[t].font_size = this._scaleFontSize(e);
    this.saveCustomizations();
  }
  setElementStrokeStyle(t, e) {
    if (!t) return;
    if (!this.customizations[t]) {
      this.customizations[t] = {};
    }
    const n = String(e || "outline").trim().toLowerCase() || "outline";
    this.customizations[t].stroke_style = n;
    if (n === "none") {
      this.customizations[t].outline_offsets = [];
      this.customizations[t].outline_color = null;
    } else {
      const e = RANKING_OFFSETS_BY_STYLE[n] || RANKING_OUTLINE_OFFSETS;
      this.customizations[t].outline_offsets = e.map(t => [ ...t ]);
      this.customizations[t].outline_color = [ 0, 0, 0, 255 ];
    }
    this.saveCustomizations();
  }
  persistElementStyles(t) {
    if (!t?.getAttribute) return;
    const e = t.getAttribute("data-template-element-id");
    if (!e) return;
    if (!this.customizations[e]) this.customizations[e] = {};
    const n = this.customizations[e];
    const o = (t.textContent || "").trim() || String(t.getAttribute("data-rk-full-title") || "").trim();
    if (e.endsWith("_number") && e.startsWith("rank_")) {
      delete n.content;
    } else if (o) {
      n.content = o;
    }
    n.font = this._resolvePersistFont(t, e, n);
    try {
      this._writeFontLock({
        [e]: n.font
      });
    } catch (t) {}
    const i = t.style.color || t.style.getPropertyValue("color") || "";
    const s = this._colorToRgba(i) || this._colorToRgba(getComputedStyle(t).color);
    if (s) n.color = s;
    const r = t.style.fontSize || t.style.getPropertyValue("font-size");
    const a = r && r !== "inherit" ? parseFloat(r) : parseFloat(getComputedStyle(t).fontSize);
    if (a > 0) {
      n.font_size = this._scaleFontSize(a);
    }
    const l = this._readStrokeState(t);
    n.stroke_style = l.style;
    if (l.enabled) {
      n.outline_color = [ 0, 0, 0, 255 ];
      const t = RANKING_OFFSETS_BY_STYLE[l.style] || RANKING_OUTLINE_OFFSETS;
      n.outline_offsets = t.map(t => [ ...t ]);
    } else {
      n.outline_offsets = [];
      n.outline_color = null;
    }
    this.saveCustomizations();
  }
  persistAllPreviewStyles() {
    const t = this._getActiveRankingContainer();
    if (!t) return;
    t.querySelectorAll("[data-template-element-id]").forEach(t => {
      try {
        this.persistElementStyles(t);
      } catch (t) {}
    });
    this._propagateRankNumberStyles();
    try {
      if (window.__solisRankingLayout) {
        this.customizations.__ranking_layout = {
          ...this.customizations.__ranking_layout || {},
          ...window.__solisRankingLayout
        };
      }
    } catch (t) {}
    this.saveCustomizations();
  }
  saveCustomizations() {
    localStorage.setItem("rankingCustomizations", JSON.stringify(this.customizations));
    try {
      sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(this.customizations || {}));
    } catch (t) {}
    try {
      this._patchStyleLock(this.customizations);
    } catch (t) {}
    try {
      if (window.SolisMemory && !window.SolisMemory._applying && typeof window.SolisMemory.noteEdit === "function") {
        const t = window.clipsStudio?.currentTemplateForPreview?.id || "ranked_compilation";
        window.SolisMemory.noteEdit(t);
      }
    } catch (t) {}
  }
  countFonts(t) {
    if (!t || typeof t !== "object") return 0;
    return Object.entries(t).filter(([t, e]) => t !== "__ranking_layout" && e && typeof e === "object" && e.font).length;
  }
  _patchStyleLock(t) {
    if (!t || typeof t !== "object") return;
    let e = null;
    try {
      e = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
    } catch (t) {
      e = null;
    }
    const n = {};
    const o = [ e, t ].filter(t => t && typeof t === "object");
    o.forEach(t => {
      Object.entries(t).forEach(([t, e]) => {
        if (!e || typeof e !== "object") {
          if (e != null) n[t] = e;
          return;
        }
        const o = {
          ...n[t] && typeof n[t] === "object" ? n[t] : {}
        };
        Object.entries(e).forEach(([t, e]) => {
          if (e !== undefined && e !== null && e !== "") o[t] = e;
        });
        n[t] = o;
      });
    });
    if (this.countFonts(n) === 0 && this.countFonts(e) > 0) {
      sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(e));
      window.__solisRankingStyleLock = e;
      return;
    }
    sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(n));
    window.__solisRankingStyleLock = n;
  }
  _getActiveRankingContainer() {
    return document.querySelector("#i24g .cyr") || document.querySelector(".cyr");
  }
  _scaleFontSize(t) {
    const e = this._getActiveRankingContainer();
    const n = e?.clientWidth || 280;
    return Math.max(12, Math.round(t * (RANKING_VIDEO_WIDTH / n)));
  }
  _normalizeFont(t) {
    if (!t) return RANKING_FONT_TO_FILE["Luckiest Guy"];
    const e = t.replace(/['"]/g, "").split(",")[0].trim();
    if (/^bebas(\s*neue)?$/i.test(e) || /^bebasneue/i.test(e)) {
      return RANKING_FONT_TO_FILE.Anton;
    }
    if (e.endsWith(".ttf") || e.endsWith(".otf")) {
      if (/bebas/i.test(e)) return RANKING_FONT_TO_FILE.Anton;
      const t = RANKING_FILE_TO_FONT[e] || Object.keys(RANKING_FILE_TO_FONT).find(t => t.toLowerCase() === e.toLowerCase());
      if (t) {
        const n = RANKING_FILE_TO_FONT[t] || RANKING_FILE_TO_FONT[e];
        return RANKING_FONT_TO_FILE[n] || e;
      }
      return e;
    }
    if (RANKING_FONT_TO_FILE[e]) return RANKING_FONT_TO_FILE[e];
    const n = Object.keys(RANKING_FONT_TO_FILE).find(t => t.toLowerCase() === e.toLowerCase());
    if (n) return RANKING_FONT_TO_FILE[n];
    return RANKING_FONT_TO_FILE["Luckiest Guy"];
  }
  _isDefaultLuckiest(t) {
    if (!t) return true;
    const e = this._displayFont(t);
    return e === "Luckiest Guy";
  }
  _resolvePersistFont(t, e, n) {
    const o = t?.getAttribute?.("data-rk-font");
    if (o) return this._normalizeFont(o);
    const i = this._readFontLock()?.[e];
    if (i) return this._normalizeFont(i);
    if (n?.font) return this._normalizeFont(n.font);
    const s = (t?.style?.getPropertyValue?.("font-family") || t?.style?.fontFamily || "").trim();
    if (s) return this._normalizeFont(s);
    let r = "";
    try {
      r = getComputedStyle(t).fontFamily || "";
    } catch (t) {}
    return this._normalizeFont(r || "Luckiest Guy");
  }
  _readFontLock() {
    try {
      return JSON.parse(sessionStorage.getItem("solisRankingFontLock") || "{}") || {};
    } catch (t) {
      return {};
    }
  }
  _writeFontLock(t) {
    if (!t || typeof t !== "object") return;
    const e = this._readFontLock();
    const n = {
      ...e
    };
    Object.entries(t).forEach(([t, e]) => {
      if (t && e) n[t] = e;
    });
    try {
      sessionStorage.setItem("solisRankingFontLock", JSON.stringify(n));
      window.__solisRankingFontLock = n;
    } catch (t) {}
  }
  setElementFontFile(t, e) {
    if (!t) return;
    if (!this.customizations[t]) this.customizations[t] = {};
    const n = this._normalizeFont(e);
    this.customizations[t].font = n;
    this.saveCustomizations();
    try {
      this._writeFontLock({
        [t]: n
      });
      this._patchStyleLock({
        [t]: {
          font: n
        }
      });
    } catch (t) {}
  }
  _displayFont(t) {
    if (!t) return "Luckiest Guy";
    const e = String(t).replace(/['"]/g, "").split(",")[0].trim();
    if (RANKING_FONT_TO_FILE[e]) return e;
    if (RANKING_FILE_TO_FONT[e]) return RANKING_FILE_TO_FONT[e];
    const n = e.toLowerCase();
    const o = Object.keys(RANKING_FONT_TO_FILE).find(t => t.toLowerCase() === n);
    if (o) return o;
    const i = Object.keys(RANKING_FILE_TO_FONT).find(t => t.toLowerCase() === n);
    if (i) return RANKING_FILE_TO_FONT[i];
    return "Luckiest Guy";
  }
  _readStrokeState(t) {
    const e = getComputedStyle(t);
    const n = (t.style.textShadow || e.textShadow || "").replace(/\s+/g, " ");
    if (!n || n === "none") {
      if (t.classList.contains("text-stroke")) {
        return {
          enabled: true,
          style: "outline"
        };
      }
      return {
        enabled: false,
        style: "none"
      };
    }
    if (n.includes("3px 0") || n.includes("3px 0px")) {
      return {
        enabled: true,
        style: "thick-outline"
      };
    }
    return {
      enabled: true,
      style: "outline"
    };
  }
  _applyStrokeStyleToElement(t, e) {
    if (!t) return;
    if (e === "none") {
      t.classList.remove("text-stroke");
      t.style.textShadow = "none";
      return;
    }
    if (e === "stroke") {
      t.classList.add("text-stroke");
      t.style.textShadow = "";
      return;
    }
    t.classList.remove("text-stroke");
    t.style.textShadow = RANKING_SHADOW_CSS[e] || RANKING_SHADOW_CSS.outline;
  }
  _propagateRankNumberStyles() {
    for (let t = 1; t <= 5; t++) {
      const e = `rank_${t}_number`;
      const n = `rank_${t}_title`;
      const o = this.customizations[e];
      if (!o) continue;
      if (!this.customizations[n]) this.customizations[n] = {};
      const i = this.customizations[n];
      for (const t of [ "font", "font_size", "outline_color", "outline_offsets", "stroke_style" ]) {
        if (o[t] !== undefined) {
          i[t] = Array.isArray(o[t]) ? o[t].map(t => [ ...t ]) : o[t];
        }
      }
      if (o.color && i.color === undefined) {
        i.color = [ ...o.color ];
      }
    }
  }
  syncFromDOM() {
    const t = this._getActiveRankingContainer();
    if (!t) return;
    t.querySelectorAll("[data-template-element-id]").forEach(t => {
      const e = t.getAttribute("data-template-element-id");
      if (!e) return;
      if (!this.customizations[e]) this.customizations[e] = {};
      const n = t.textContent.trim() || String(t.getAttribute("data-rk-full-title") || "").trim();
      if (e.endsWith("_number") && e.startsWith("rank_")) {
        const n = e.match(/^rank_(\d+)_number$/);
        if (n) {
          t.textContent = `${n[1]}.`;
          delete this.customizations[e].content;
        }
      } else if (n) {
        this.customizations[e].content = n;
      }
      const o = this._colorToRgba(t.style.color || getComputedStyle(t).color);
      if (o) this.customizations[e].color = o;
      const i = t.style.backgroundColor || "";
      if (i && i !== "transparent" && i !== "rgba(0, 0, 0, 0)" && t.classList.contains("rk-has-fill")) {
        const t = this._colorToRgba(i);
        if (t) {
          this.customizations[e].box = true;
          this.customizations[e].box_color = t;
          this.customizations[e].box_border_width = 12;
        }
      } else {
        this.customizations[e].box = false;
        this.customizations[e].box_color = null;
      }
      const s = getComputedStyle(t);
      const r = t.style.fontSize;
      const a = r && r !== "inherit" ? parseFloat(r) : parseFloat(s.fontSize);
      if (a) {
        this.customizations[e].font_size = this._scaleFontSize(a);
      }
      const l = t.getAttribute("data-rk-font") || t.style.getPropertyValue("font-family") || t.style.fontFamily || s.fontFamily;
      this.customizations[e].font = this._normalizeFont(l);
      const c = this._readStrokeState(t);
      this.customizations[e].stroke_style = c.style;
      if (c.enabled) {
        this.customizations[e].outline_color = [ 0, 0, 0, 255 ];
        const t = RANKING_OFFSETS_BY_STYLE[c.style] || RANKING_OUTLINE_OFFSETS;
        this.customizations[e].outline_offsets = t.map(t => [ ...t ]);
        if (c.style === "stroke" || c.style === "outline") {
          this.customizations[e].shadow_color = null;
          this.customizations[e].shadow_offset = null;
        } else {
          this.customizations[e].shadow_color = null;
          this.customizations[e].shadow_offset = null;
        }
      } else {
        this.customizations[e].outline_offsets = [];
        this.customizations[e].shadow_color = null;
        this.customizations[e].shadow_offset = null;
      }
    });
    this._propagateRankNumberStyles();
    this.saveCustomizations();
  }
  _colorToRgba(t) {
    if (!t) return null;
    const e = t.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (e) {
      return [ parseInt(e[1], 16), parseInt(e[2], 16), parseInt(e[3], 16), 255 ];
    }
    const n = t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (n) {
      return [ parseInt(n[1], 10), parseInt(n[2], 10), parseInt(n[3], 10), 255 ];
    }
    return null;
  }
  applyCustomizations() {
    this._propagateRankNumberStyles();
    const t = this._getActiveRankingContainer();
    if (t) {
      Object.entries(this.customizations).forEach(([e, n]) => {
        const o = t.querySelector(`[data-template-element-id="${e}"]`);
        if (!o) return;
        if (e.endsWith("_number") && e.startsWith("rank_")) {
          const t = e.match(/^rank_(\d+)_number$/);
          if (t) o.textContent = `${t[1]}.`;
          o.contentEditable = "false";
        } else if (n.content) {
          o.textContent = n.content;
        }
        if (n.color) {
          const [t, e, i] = n.color;
          o.style.color = `rgb(${t}, ${e}, ${i})`;
        }
        if (n.box && n.box_color) {
          o.style.backgroundColor = "transparent";
          o.style.background = "transparent";
          o.style.removeProperty("padding");
          o.style.removeProperty("border-radius");
          o.classList.remove("rk-has-fill");
        } else if (n.box === false) {
          o.style.backgroundColor = "transparent";
          o.style.background = "transparent";
          o.style.removeProperty("padding");
          o.style.removeProperty("border-radius");
          o.classList.remove("rk-has-fill");
        }
        if (n.font) {
          const t = this._displayFont(n.font);
          const e = t === "Luckiest Guy" ? `'Luckiest Guy', cursive` : `'${t}', sans-serif`;
          o.style.setProperty("font-family", e, "important");
          o.style.setProperty("font-weight", RANKING_FONT_WEIGHT[t] || "400", "important");
          o.setAttribute("data-rk-font", t);
        }
        const i = e === "title_ranking" || e === "title_funniest" || e === "title_channel";
        if (n.font_size) {
          const e = n.font_size * ((t.clientWidth || 280) / RANKING_VIDEO_WIDTH);
          const s = i ? 18 : 16;
          const r = i ? 40 : 38;
          o.style.setProperty("font-size", `${Math.max(s, Math.min(r, Math.round(e)))}px`, "important");
          o.classList.add("rk-sized");
        }
        if (n.stroke_style && n.stroke_style !== "none") {
          this._applyStrokeStyleToElement(o, n.stroke_style);
        } else if (n.outline_offsets?.length) {
          this._applyStrokeStyleToElement(o, "stroke");
        } else if (n.stroke_style !== "none") {
          o.classList.add("text-stroke");
          if (o.style.textShadow === "none") o.style.textShadow = "";
          o.style.removeProperty("text-shadow");
        }
        if (e === "title_funniest") o.classList.add("funniest");
      });
      try {
        if (window.RankingTextPill?.applyTopPanel) {
          window.RankingTextPill.applyTopPanel();
        }
      } catch (t) {}
      return;
    }
    Object.entries(this.customizations).forEach(([t, e]) => {
      const n = this.panel?.querySelector(`[data-element="${t}"]`);
      if (n && e.content) {
        n.value = e.content;
      }
    });
  }
  getCustomizations() {
    return this.customizations;
  }
  toggle() {
    if (this.panel) {
      this.panel.style.display = this.panel.style.display === "none" ? "block" : "none";
    }
  }
  show() {
    if (this.panel) {
      this.panel.style.display = "block";
    }
  }
  hide() {
    if (this.panel) {
      this.panel.style.display = "none";
    }
  }
  captureGenerateLock() {
    const t = this._getActiveRankingContainer();
    const e = {};
    try {
      Object.entries(this.customizations || {}).forEach(([t, n]) => {
        if (n && typeof n === "object") e[t] = {
          ...n
        }; else if (n != null) e[t] = n;
      });
    } catch (t) {}
    try {
      const t = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
      if (t && typeof t === "object") {
        Object.entries(t).forEach(([n, o]) => {
          if (!o || typeof o !== "object") {
            if (o != null && e[n] == null) e[n] = o;
            return;
          }
          e[n] = {
            ...e[n] || {},
            ...o,
            ...e[n] || {}
          };
          if (t[n]?.font && !e[n].font) e[n].font = t[n].font;
          if (this.customizations?.[n]?.font) e[n].font = this.customizations[n].font;
        });
      }
    } catch (t) {}
    if (t) {
      t.querySelectorAll("[data-template-element-id]").forEach(t => {
        const n = t.getAttribute("data-template-element-id");
        if (!n) return;
        if (!e[n]) e[n] = {};
        const o = e[n];
        const i = (t.textContent || "").trim() || String(t.getAttribute("data-rk-full-title") || "").trim();
        if (n.endsWith("_number") && n.startsWith("rank_")) {
          delete o.content;
        } else if (i && !/^add title/i.test(i)) {
          o.content = i;
        }
        o.font = this._resolvePersistFont(t, n, o);
        const s = t.style.color || t.style.getPropertyValue("color") || getComputedStyle(t).color;
        const r = this._colorToRgba(s);
        if (r) o.color = r;
        const a = t.style.fontSize || t.style.getPropertyValue("font-size");
        let l = a && a !== "inherit" ? parseFloat(a) : NaN;
        if (!(l > 0)) l = parseFloat(getComputedStyle(t).fontSize);
        if (l > 0) o.font_size = this._scaleFontSize(l);
        const c = this._readStrokeState(t);
        o.stroke_style = c.style;
        if (c.enabled) {
          o.outline_color = [ 0, 0, 0, 255 ];
          const t = RANKING_OFFSETS_BY_STYLE[c.style] || RANKING_OUTLINE_OFFSETS;
          o.outline_offsets = t.map(t => [ ...t ]);
        } else {
          o.outline_offsets = [];
          o.outline_color = null;
        }
      });
    }
    try {
      if (window.__solisRankingLayout) {
        e.__ranking_layout = {
          ...e.__ranking_layout || {},
          ...window.__solisRankingLayout
        };
      } else if (this.customizations?.__ranking_layout) {
        e.__ranking_layout = {
          ...this.customizations.__ranking_layout
        };
      }
    } catch (t) {}
    for (let t = 1; t <= 5; t++) {
      const n = e[`rank_${t}_number`];
      const o = e[`rank_${t}_title`] || (e[`rank_${t}_title`] = {});
      if (!n || typeof n !== "object") continue;
      for (const t of [ "font", "font_size", "outline_color", "outline_offsets", "stroke_style" ]) {
        if (n[t] !== undefined) {
          o[t] = Array.isArray(n[t]) ? n[t].map(t => [ ...t ]) : n[t];
        }
      }
      if (n.color && o.color === undefined) o.color = [ ...n.color ];
    }
    const n = this.countFonts(e);
    let o = 0;
    let i = null;
    try {
      i = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
      o = this.countFonts(i);
    } catch (t) {}
    if (n === 0 && o > 0) {
      const t = JSON.parse(JSON.stringify(i));
      Object.entries(e).forEach(([e, n]) => {
        if (e === "__ranking_layout") {
          t[e] = n;
          return;
        }
        if (!n || typeof n !== "object") return;
        if (!t[e]) t[e] = {};
        if (n.content !== undefined) t[e].content = n.content;
        if (n.font) t[e].font = n.font;
        if (n.font_size) t[e].font_size = n.font_size;
        if (n.color) t[e].color = n.color;
      });
      this.customizations = {
        ...this.customizations
      };
      Object.entries(t).forEach(([t, e]) => {
        if (e && typeof e === "object" && !Array.isArray(e)) {
          this.customizations[t] = {
            ...this.customizations[t] || {},
            ...e
          };
        } else if (e != null) {
          this.customizations[t] = e;
        }
      });
      try {
        localStorage.setItem("rankingCustomizations", JSON.stringify(this.customizations));
        sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(t));
        sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(t));
      } catch (t) {}
      return JSON.parse(JSON.stringify(t));
    }
    this.customizations = {
      ...this.customizations
    };
    Object.entries(e).forEach(([t, e]) => {
      if (e && typeof e === "object" && !Array.isArray(e)) {
        this.customizations[t] = {
          ...this.customizations[t] || {},
          ...e
        };
      } else if (e != null) {
        this.customizations[t] = e;
      }
    });
    try {
      localStorage.setItem("rankingCustomizations", JSON.stringify(this.customizations));
      sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(e));
      if (this.countFonts(e) > 0) {
        sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(e));
      }
    } catch (t) {}
    return JSON.parse(JSON.stringify(e));
  }
  flushRankingStylesForGenerate() {
    try {
      document.querySelectorAll("#i24g .czi").forEach(t => {
        try {
          t.blur();
        } catch (t) {}
      });
    } catch (t) {}
    try {
      this.persistAllPreviewStyles();
    } catch (t) {}
    let t = null;
    try {
      t = this.captureGenerateLock();
    } catch (e) {
      t = null;
    }
    if (!t || typeof t !== "object") t = {};
    if (this.countFonts(t) === 0) {
      try {
        const e = JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
        if (this.countFonts(e) > 0) {
          const n = {};
          [ e, t ].forEach(t => {
            if (!t || typeof t !== "object") return;
            Object.entries(t).forEach(([t, o]) => {
              if (!o || typeof o !== "object") {
                if (o != null) n[t] = o;
                return;
              }
              n[t] = {
                ...n[t] || {},
                ...o
              };
              if (e[t]?.font && !n[t].font) n[t].font = e[t].font;
            });
          });
          t = n;
        }
      } catch (t) {}
    }
    try {
      sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(t));
      if (this.countFonts(t) > 0) {
        sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(t));
      }
      window.__solisPendingGenerateRankingCustoms = t;
      window.__solisRankingStyleLock = t;
    } catch (t) {}
    return this.ensureGeneratePayload(t);
  }
  ensureGeneratePayload(t) {
    const e = [ "title_ranking", "title_funniest", "title_channel", "rank_1_number", "rank_1_title", "rank_2_number", "rank_2_title", "rank_3_number", "rank_3_title", "rank_4_number", "rank_4_title", "rank_5_number", "rank_5_title" ];
    const n = "LuckiestGuy-Regular.ttf";
    const o = {
      title_ranking: 120,
      title_funniest: 120,
      title_channel: 72,
      rank_1_number: 110,
      rank_1_title: 95,
      rank_2_number: 110,
      rank_2_title: 95,
      rank_3_number: 110,
      rank_3_title: 95,
      rank_4_number: 110,
      rank_4_title: 95,
      rank_5_number: 110,
      rank_5_title: 95
    };
    const i = {
      title_ranking: [ 255, 255, 255, 255 ],
      title_funniest: [ 255, 0, 0, 255 ],
      title_channel: [ 255, 255, 255, 255 ],
      rank_1_number: [ 255, 215, 0, 255 ],
      rank_1_title: [ 255, 215, 0, 255 ],
      rank_2_number: [ 192, 192, 192, 255 ],
      rank_2_title: [ 192, 192, 192, 255 ],
      rank_3_number: [ 205, 127, 50, 255 ],
      rank_3_title: [ 205, 127, 50, 255 ],
      rank_4_number: [ 255, 255, 255, 255 ],
      rank_4_title: [ 255, 255, 255, 255 ],
      rank_5_number: [ 255, 255, 255, 255 ],
      rank_5_title: [ 255, 255, 255, 255 ]
    };
    const s = {};
    const r = [ t, this.customizations, (() => {
      try {
        return JSON.parse(localStorage.getItem("rankingCustomizations") || "null");
      } catch (t) {
        return null;
      }
    })(), (() => {
      try {
        return JSON.parse(sessionStorage.getItem("solisRankingStyleLock") || "null");
      } catch (t) {
        return null;
      }
    })(), (() => {
      try {
        return JSON.parse(sessionStorage.getItem("solisPendingRankingCustoms") || "null");
      } catch (t) {
        return null;
      }
    })(), window.__solisRankingStyleLock ];
    r.forEach(t => {
      if (!t || typeof t !== "object") return;
      Object.entries(t).forEach(([t, e]) => {
        if (!e || typeof e !== "object") {
          if (e != null) s[t] = e;
          return;
        }
        s[t] = {
          ...s[t] || {},
          ...e
        };
      });
    });
    const a = this._readFontLock();
    Object.entries(a).forEach(([t, e]) => {
      if (!e) return;
      if (!s[t] || typeof s[t] !== "object") s[t] = {};
      s[t].font = e;
    });
    try {
      const t = this._getActiveRankingContainer();
      if (t) {
        t.querySelectorAll("[data-template-element-id]").forEach(t => {
          const e = t.getAttribute("data-template-element-id");
          if (!e) return;
          if (!s[e]) s[e] = {};
          s[e].font = this._resolvePersistFont(t, e, s[e]);
          try {
            this._writeFontLock({
              [e]: s[e].font
            });
          } catch (t) {}
          const n = this._colorToRgba(t.style.color || getComputedStyle(t).color);
          if (n) s[e].color = n;
          const o = t.style.fontSize;
          const i = o && o !== "inherit" ? parseFloat(o) : parseFloat(getComputedStyle(t).fontSize);
          if (i > 0) s[e].font_size = this._scaleFontSize(i);
        });
      }
    } catch (t) {}
    if (window.__solisRankingLayout && typeof window.__solisRankingLayout === "object") {
      s.__ranking_layout = {
        ...s.__ranking_layout || {},
        ...window.__solisRankingLayout
      };
    }
    e.forEach(t => {
      if (!s[t] || typeof s[t] !== "object") s[t] = {};
      const e = s[t];
      if (!e.font) {
        e.font = a[t] || this.customizations?.[t]?.font || n;
      } else {
        e.font = this._normalizeFont(e.font);
      }
      if (!(e.font_size > 0) || e.font_size < 70) {
        e.font_size = o[t] || 95;
      }
      if (!Array.isArray(e.color) || e.color.length < 3) {
        e.color = i[t] || [ 255, 255, 255, 255 ];
      }
    });
    try {
      localStorage.setItem("rankingCustomizations", JSON.stringify({
        ...this.customizations || {},
        ...s
      }));
      sessionStorage.setItem("solisPendingRankingCustoms", JSON.stringify(s));
      if (this.countFonts(s) > 0) {
        sessionStorage.setItem("solisRankingStyleLock", JSON.stringify(s));
      }
      window.__solisRankingStyleLock = s;
      Object.entries(s).forEach(([t, e]) => {
        if (e && typeof e === "object" && !Array.isArray(e)) {
          this.customizations[t] = {
            ...this.customizations[t] || {},
            ...e
          };
        }
      });
    } catch (t) {}
    return JSON.parse(JSON.stringify(s));
  }
  collectCustomizations() {
    try {
      if (this._getActiveRankingContainer()) {
        return this.ensureGeneratePayload(this.captureGenerateLock());
      }
    } catch (t) {}
    try {
      this.syncFromDOM();
    } catch (t) {}
    try {
      return this.ensureGeneratePayload(this.customizations || {});
    } catch (t) {
      return this.ensureGeneratePayload({
        ...this.customizations || {}
      });
    }
  }
}

window.rankingCustomizer = null;

(function bootRankingCustomizer() {
  const start = () => {
    if (window.rankingCustomizer) return;
    try {
      window.rankingCustomizer = new RankingCustomizer;
    } catch (t) {
      console.warn("[RankingCustomizer] init failed:", t);
    }
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, {
    once: true
  });
})();

const style = document.createElement("style");

style.textContent = `\n    .ranking-customizer {\n        position: fixed;\n        right: 20px;\n        top: 100px;\n        width: 350px;\n        background: rgba(30, 30, 30, 0.95);\n        border: 1px solid #ff6b35;\n        border-radius: 12px;\n        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);\n        z-index: 9998;\n        max-height: 80vh;\n        overflow-y: auto;\n        display: none;\n        color: #fff;\n        font-family: 'Plus Jakarta Sans', sans-serif;\n    }\n\n    .ranking-customizer-header {\n        padding: 16px;\n        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);\n        border-radius: 12px 12px 0 0;\n        display: flex;\n        justify-content: space-between;\n        align-items: center;\n        color: white;\n    }\n\n    .ranking-customizer-header h3 {\n        margin: 0;\n        font-size: 14px;\n        font-weight: 700;\n    }\n\n    .ranking-customizer-close {\n        background: rgba(255, 255, 255, 0.2);\n        border: none;\n        color: white;\n        font-size: 24px;\n        width: 32px;\n        height: 32px;\n        border-radius: 6px;\n        cursor: pointer;\n        transition: all 0.2s;\n    }\n\n    .ranking-customizer-close:hover {\n        background: rgba(255, 255, 255, 0.3);\n    }\n\n    .ranking-customizer-content {\n        padding: 16px;\n    }\n\n    .ranking-section {\n        margin-bottom: 24px;\n    }\n\n    .ranking-section h4 {\n        margin: 0 0 12px 0;\n        font-size: 13px;\n        font-weight: 700;\n        text-transform: uppercase;\n        color: #ff6b35;\n        letter-spacing: 0.5px;\n    }\n\n    .ranking-edit-group {\n        margin-bottom: 12px;\n    }\n\n    .ranking-edit-group label {\n        display: block;\n        font-size: 12px;\n        color: #aaa;\n        margin-bottom: 6px;\n        font-weight: 500;\n    }\n\n    .ranking-edit-group input {\n        width: 100%;\n        padding: 8px 12px;\n        background: rgba(255, 255, 255, 0.05);\n        border: 1px solid rgba(255, 255, 255, 0.1);\n        border-radius: 6px;\n        color: #fff;\n        font-family: 'Plus Jakarta Sans', sans-serif;\n        font-size: 13px;\n        transition: all 0.2s;\n        box-sizing: border-box;\n    }\n\n    .ranking-edit-group input:focus {\n        outline: none;\n        background: rgba(255, 255, 255, 0.1);\n        border-color: #ff6b35;\n        box-shadow: 0 0 8px rgba(255, 107, 53, 0.2);\n    }\n\n    .ranking-color-picker {\n        display: flex;\n        gap: 8px;\n        flex-wrap: wrap;\n    }\n\n    .ranking-color-btn {\n        width: 32px;\n        height: 32px;\n        border-radius: 4px;\n        border: 2px solid #555;\n        cursor: pointer;\n        transition: all 0.2s;\n    }\n\n    .ranking-color-btn:hover {\n        transform: scale(1.1);\n        border-color: #ff6b35;\n        box-shadow: 0 0 8px rgba(255, 107, 53, 0.4);\n    }\n\n    .ranking-color-btn.active {\n        border-color: #ff6b35;\n        box-shadow: 0 0 12px rgba(255, 107, 53, 0.6);\n    }\n\n    @media (max-width: 768px) {\n        .ranking-customizer {\n            width: calc(100% - 40px);\n            right: 20px;\n            left: 20px;\n            max-height: 60vh;\n        }\n    }\n`;

document.head.appendChild(style);
