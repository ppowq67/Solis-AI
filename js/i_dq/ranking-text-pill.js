(function() {
  const e = [ [ "Fredoka", "700" ], [ "Montserrat", "700" ], [ "Bebas Neue", "400" ], [ "Anton", "400" ], [ "Luckiest Guy", "400" ], [ "Poppins", "600" ], [ "Roboto", "700" ] ];
  const t = {
    Fredoka: "700",
    Montserrat: "700",
    "Bebas Neue": "400",
    Anton: "400",
    "Luckiest Guy": "400",
    Poppins: "600",
    Roboto: "700"
  };
  const n = {
    Fredoka: "'Fredoka', sans-serif",
    Montserrat: "'Montserrat', sans-serif",
    "Bebas Neue": "'Bebas Neue', sans-serif",
    Anton: "'Anton', sans-serif",
    "Luckiest Guy": "'Luckiest Guy', cursive",
    Poppins: "'Poppins', sans-serif",
    Roboto: "'Roboto', sans-serif"
  };
  const i = [ "#ffffff", "#FF6A3D", "#facc15", "#60a5fa", "#80DE4A" ];
  const r = [ "#ffffff", "#FF6A3D", "#111827", "#0f172a", "#000000" ];
  const o = [ "#ffffff", "#000000", "#FF6A3D", "#facc15", "#60a5fa" ];
  const a = "solis_sub_custom_cols";
  const s = "__ranking_layout";
  const l = .25;
  const c = .1;
  const u = .45;
  function shadowCss(e, t) {
    const n = normalizeHex(t) || t || "#000";
    if (!e || e === "none") return "none";
    if (e === "thick-outline") {
      return `3px 0 0 ${n},-3px 0 0 ${n},0 3px 0 ${n},0 -3px 0 ${n},` + `2px 2px 0 ${n},-2px -2px 0 ${n},2px -2px 0 ${n},-2px 2px 0 ${n}`;
    }
    return `2px 0 0 ${n},-2px 0 0 ${n},0 2px 0 ${n},0 -2px 0 ${n},` + `1px 1px 0 ${n},-1px -1px 0 ${n},1px -1px 0 ${n},-1px 1px 0 ${n}`;
  }
  let d, p, g, m;
  let y = new Set;
  let b = "Luckiest Guy";
  let w = "#ffffff";
  let v = null;
  let x = "outline";
  let S = "#000000";
  let E = undefined;
  let z = "text";
  let C = false;
  let R = null;
  let L = false;
  let M = false;
  let F = false;
  let P = false;
  let T = null;
  let A = false;
  let B = new Map;
  let H = null;
  let _ = null;
  let D = 18;
  let N = 92;
  let $ = 56;
  let I = false;
  let q = false;
  let G = false;
  let O = null;
  let V = "single";
  let W = null;
  let j = null;
  const Z = new Map;
  let Y = [];
  let U = 0;
  let X = [];
  let J = null;
  let K = 0;
  let Q = 0;
  let ee = 0;
  const te = 6e3;
  const ne = 2200;
  const ie = 3500;
  const re = 420;
  const oe = .82;
  const ae = 40;
  const se = 38;
  const le = 18;
  const ce = 16;
  const ue = 34;
  const de = 120;
  const pe = 110;
  const fe = 95;
  const ge = pe;
  const me = 72;
  const he = 1080;
  function getRankingRoot() {
    const e = document.getElementById("templateVideoPreview");
    return e?.querySelector(".ranking-preview-container.library-ranking-layer") || e?.querySelector(".ranking-preview-container") || document.querySelector(".ranking-preview-container.library-ranking-layer") || document.querySelector(".ranking-preview-container");
  }
  function hideSubtitleGuidesOverRanking() {
    const e = document.getElementById("templateVideoPreview");
    if (!e) return;
    e.querySelectorAll(".sub-guide, .sub-half-line, .rk-half-line, .rk-guide").forEach(e => {
      e.style.display = "none";
      e.style.visibility = "hidden";
      e.style.opacity = "0";
    });
  }
  function getAllTextElements() {
    const e = getRankingRoot();
    return e ? Array.from(e.querySelectorAll("[data-template-element-id]")) : [];
  }
  function getAllRankNumbers() {
    const e = getRankingRoot();
    return e ? Array.from(e.querySelectorAll('[data-template-element-id$="_number"]')) : [];
  }
  function getAllRankTitles() {
    const e = getRankingRoot();
    return e ? Array.from(e.querySelectorAll('[data-template-element-id^="rank_"][data-template-element-id$="_title"]')) : [];
  }
  function getAllRankSideElements() {
    return [ ...getAllRankNumbers(), ...getAllRankTitles() ];
  }
  function getHeaderElements() {
    const e = getRankingRoot();
    return e ? Array.from(e.querySelectorAll('[data-template-element-id^="title_"]')) : [];
  }
  function getHeaderZone() {
    return getRankingRoot()?.querySelector(".ranking-editor-zone-header") || null;
  }
  function getRanksZone() {
    return getRankingRoot()?.querySelector(".ranking-editor-zone-ranks") || null;
  }
  function isHeaderEl(e) {
    const t = e?.getAttribute?.("data-template-element-id") || "";
    return t.startsWith("title_");
  }
  function isRankEl(e) {
    const t = e?.getAttribute?.("data-template-element-id") || "";
    return t.endsWith("_number");
  }
  function isRankTitleEl(e) {
    const t = e?.getAttribute?.("data-template-element-id") || "";
    return t.startsWith("rank_") && t.endsWith("_title");
  }
  function isRankSideEl(e) {
    return isRankEl(e) || isRankTitleEl(e);
  }
  function isChannelEl(e) {
    return e?.getAttribute?.("data-template-element-id") === "title_channel";
  }
  function normalizeSelectionElements(e, t) {
    if (t === "group-header") return getHeaderElements();
    if (t === "group-ranks") return getAllRankSideElements();
    return e;
  }
  function getPrimaryHeaderEl() {
    return getHeaderElements().find(e => !isChannelEl(e)) || getHeaderElements()[0] || null;
  }
  function resolveFontSizeForEl(e, t, n) {
    n = n || {};
    if (isChannelEl(e) && !n.headerGroup) {
      const n = getHardSizeCap(e);
      let i = Math.max(12, Math.min(n, Math.round(t)));
      const r = getRankingRoot();
      let o = 36;
      while (o-- > 0 && i > 12 && !channelFitsAtSize(e, i, r)) i -= 1;
      return i;
    }
    if (isChannelEl(e)) {
      const n = Math.round(t * oe);
      const i = getHardSizeCap(e);
      let r = Math.max(12, Math.min(i, n));
      const o = getRankingRoot();
      let a = 36;
      while (a-- > 0 && r > 12 && !channelFitsAtSize(e, r, o)) r -= 1;
      return r;
    }
    return t;
  }
  function normalizeFontName(e) {
    if (!e) return "";
    return String(e).replace(/['"]/g, "").split(",")[0].trim().toLowerCase();
  }
  function getElFontName(e) {
    const t = e?.getAttribute?.("data-rk-font");
    if (t) return normalizeFontName(t);
    const n = e.style.fontFamily;
    if (n) return normalizeFontName(n);
    return normalizeFontName(getComputedStyle(e).fontFamily);
  }
  function clearSelectionVisuals() {
    const e = getRankingRoot() || document;
    e.querySelectorAll(".ranking-editor-selected").forEach(e => {
      e.classList.remove("ranking-editor-selected");
      e.style.zIndex = "";
    });
    e.querySelectorAll(".ranking-editor-zone-selected").forEach(e => {
      e.classList.remove("ranking-editor-zone-selected");
    });
    e.querySelectorAll(".ranking-editor-zone-member").forEach(e => {
      e.classList.remove("ranking-editor-zone-member");
    });
    e.querySelectorAll(".ranking-editor-resize-anchor").forEach(e => {
      e.classList.remove("ranking-editor-resize-anchor");
    });
  }
  function applySelectionVisuals() {
    clearSelectionVisuals();
    if (V === "group-header") {
      getHeaderZone()?.classList.add("ranking-editor-zone-selected");
      getHeaderElements().forEach(e => e.classList.add("ranking-editor-zone-member"));
      return;
    }
    if (V === "group-ranks") {
      getRanksZone()?.classList.add("ranking-editor-zone-selected");
      getAllRankSideElements().forEach(e => e.classList.add("ranking-editor-zone-member"));
      return;
    }
    y.forEach(e => e.classList.add("ranking-editor-selected"));
  }
  function resolveApplyTargets() {
    if (V === "group-header") return getHeaderElements();
    if (V === "group-ranks") return getAllRankSideElements();
    if (V === "group-all") return getAllTextElements();
    const e = [ ...y ];
    if (e.length === 1 && isRankSideEl(e[0])) {
      return expandRankPair(e[0]);
    }
    return e;
  }
  function syncFontDdHighlight(e) {
    if (!p) return;
    const t = String(e || b || "Luckiest Guy").trim();
    p.querySelectorAll(".sub-font-item").forEach(e => {
      const n = e.querySelector(".sub-fname")?.textContent?.trim();
      const i = n === t;
      e.classList.toggle("on", i);
      e.setAttribute("aria-selected", i ? "true" : "false");
      e.title = n || "";
    });
  }
  function buildFontList() {
    const t = p?.querySelector("#rkFontList") || document.getElementById("rkFontList") || p;
    if (!t) return;
    t.innerHTML = "";
    e.forEach(([e, i]) => {
      const r = document.createElement("div");
      r.className = "sub-font-item" + (e === b ? " on" : "");
      const o = n[e] || `'${e}', sans-serif`;
      r.innerHTML = `<span class="sub-fname" style="font-family:${o};font-weight:${i};">${e}</span>`;
      r.setAttribute("aria-selected", e === b ? "true" : "false");
      r.title = e;
      r.onmouseenter = () => previewFont(e);
      r.onmouseleave = e => {
        if (q) return;
        if (p.contains(e.relatedTarget)) return;
        resetFontPreview();
      };
      r.onmousedown = t => {
        t.preventDefault();
        t.stopPropagation();
        q = true;
        try {
          applyFont(e);
        } finally {
          setTimeout(() => {
            q = false;
          }, 450);
        }
      };
      t.appendChild(r);
    });
    syncFontDdHighlight(b);
  }
  function expandRankPair(e) {
    const t = e?.getAttribute?.("data-template-element-id") || "";
    const n = t.match(/^rank_(\d+)_(number|title)$/);
    if (!n) return e ? [ e ] : [];
    const i = getRankingRoot();
    if (!i) return [ e ];
    const r = i.querySelector(`[data-template-element-id="rank_${n[1]}_number"]`);
    const o = i.querySelector(`[data-template-element-id="rank_${n[1]}_title"]`);
    return [ r, o ].filter(Boolean);
  }
  function buildUI() {
    if (G) return;
    G = true;
    hideSubtitleGuidesOverRanking();
    d = document.createElement("div");
    d.className = "sub-pill-menu";
    d.id = "rkPillMenu";
    d.innerHTML = `\n            <button type="button" class="sub-pill-btn" id="rkBtnFont" title="Font">\n                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>\n            </button>\n            <button type="button" class="sub-pill-btn" id="rkBtnColor" title="Color">\n                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>\n            </button>\n        `;
    document.body.appendChild(d);
    p = document.createElement("div");
    p.className = "sub-dropdown sub-font-dd";
    p.id = "rkDdFont";
    buildFontList();
    p.addEventListener("mouseleave", e => {
      if (p.contains(e.relatedTarget) || d?.contains(e.relatedTarget)) return;
      resetFontPreview();
    });
    document.body.appendChild(p);
    g = document.createElement("div");
    g.className = "sub-dropdown sub-color-dd";
    g.id = "rkDdColor";
    g.innerHTML = `\n            <div class="sub-color-line"><span class="sub-clabel">Text</span><div class="sub-cgrid" id="rkTCG"></div></div>\n            <div class="sub-color-line"><span class="sub-clabel">Outline</span><div class="sub-edge" id="rkSHG"></div></div>\n            <div class="sub-color-line"><span class="sub-clabel">Edge</span><div class="sub-cgrid" id="rkOCG"></div></div>\n            <div class="sub-color-line rk-top-line"><span class="sub-clabel">Background</span>\n                <div class="rk-top-modes" id="rkTopModes" role="group" aria-label="Ranking background">\n                    <button type="button" class="rk-top-mode" data-top="none" title="No background">None</button>\n                    <button type="button" class="rk-top-mode" data-top="blank" title="Solid color behind titles">Blank</button>\n                    <button type="button" class="rk-top-mode" data-top="blank_blur" title="Blurred video behind titles">Blur</button>\n                </div>\n            </div>\n            <div class="sub-color-line rk-blank-line is-hidden" id="rkBlankLine">\n                <span class="sub-clabel">Blank</span><div class="sub-cgrid" id="rkBlankCG"></div>\n            </div>\n            <div class="sub-cplus-pop" id="rkCPlusPop" aria-hidden="true">\n                <div class="sub-cplus-head">\n                    <span class="sub-cplus-title" id="rkCPlusTitle">Custom text</span>\n                    <button type="button" class="sub-cplus-close" id="rkCPlusClose" aria-label="Close">\n                        <svg viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3L3 9"/></svg>\n                    </button>\n                </div>\n                <div class="rk-cplus-lab">Hue</div>\n                <div class="sub-spectrum" id="rkSpectrum" title="Drag to pick hue">\n                    <div class="sub-spectrum-thumb" id="rkSpectrumThumb"></div>\n                </div>\n                <div class="rk-cplus-lab">Saturation · Tone</div>\n                <div class="rk-sv-panel" id="rkSvPanel" title="Saturation (X) · Tone / lightness (Y)">\n                    <div class="rk-sv-thumb" id="rkSvThumb"></div>\n                </div>\n                <div class="sub-cplus-recents" id="rkCPlusRecents"></div>\n            </div>\n        `;
    g.addEventListener("mousedown", e => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (document.querySelector(".rk-inline-editing")) e.preventDefault();
    });
    document.body.appendChild(g);
    m = document.createElement("div");
    m.className = "rk-suggest-actions solis-nocopy";
    m.id = "rkSuggestActions";
    m.innerHTML = `\n            <button type="button" class="rk-sa-btn rk-sa-decline solis-nocopy" id="rkSuggestDismiss" title="Dismiss" aria-label="Dismiss">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>\n                </svg>\n            </button>\n            <button type="button" class="rk-sa-btn rk-sa-accept solis-nocopy" id="rkSuggestAccept" title="Apply · Tab" aria-label="Apply">\n                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">\n                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>\n                </svg>\n            </button>\n        `;
    document.body.appendChild(m);
    buildColorGrid();
    buildShadowGrid();
    wireButtons();
    injectStyles();
  }
  function injectStyles() {
    const e = `\n            .ranking-preview-container{\n                position:relative !important;\n                overflow:visible !important;\n                padding:14px 12px 16px !important;\n                container-type:inline-size;\n                container-name:rk-phone;\n            }\n            .ranking-preview-container .ranking-list{\n                display:flex !important;\n                flex-direction:column !important;\n                gap:10px !important;\n                margin:6px 0 0 0 !important;\n                flex:0 0 auto !important;\n                flex-shrink:0 !important;\n                overflow:visible !important;\n            }\n            .ranking-preview-container .ranked-item{\n                flex:0 0 auto !important;\n                flex-shrink:0 !important;\n                line-height:1.2 !important;\n                min-height:1.2em !important;\n                margin:0 !important;\n                gap:6px !important;\n                overflow:visible !important;\n                font-size:clamp(22px, 9.2cqi, 38px);\n                font-family:'Luckiest Guy', cursive;\n            }\n            .ranking-preview-container .title,\n            .ranking-preview-container h1.title{\n                font-size:clamp(28px, 11cqi, 40px) !important;\n                line-height:1.12 !important;\n                padding-top:0 !important;\n                margin-top:0 !important;\n                overflow:visible !important;\n                max-width:calc(100% - 8px) !important;\n            }\n            .ranking-preview-container .rank-title,\n            .ranking-preview-container .rank-number{\n                font-size:inherit;\n                font-family:inherit;\n            }\n            .ranking-preview-container .rank-title.rk-sized,\n            .ranking-preview-container .rank-number.rk-sized{\n            }\n            .ranking-preview-container .ranking-editor-zone-header{\n                flex:0 0 auto !important;\n                flex-shrink:0 !important;\n                padding:0 4px 4px !important;\n            }\n            .ranking-preview-container [data-template-element-id]:not([data-template-element-id$="_number"]){\n                position:relative;display:inline-block;\n                cursor:var(--solis-preview-cursor-text)!important;\n                transition:none!important;\n                overflow:visible !important;\n            }\n            .ranking-preview-container h1.title,\n            .ranking-preview-container h1{\n                white-space:nowrap!important;\n                max-width:100%;\n            }\n            .ranking-preview-container [data-template-element-id="title_ranking"],\n            .ranking-preview-container [data-template-element-id="title_funniest"]{\n                white-space:nowrap!important;\n            }\n            .ranking-preview-container .ranking-editor-zone-header,\n            .ranking-preview-container .ranking-editor-zone-ranks{\n                width:fit-content;max-width:100%;\n                overflow:visible !important;\n            }\n            .ranking-preview-container .ranking-editor-zone-header{\n                display:flex !important;\n                flex-direction:column !important;\n                align-items:center !important;\n                justify-content:flex-start !important;\n                gap:0;\n                margin:0 auto !important;\n                padding:2px 4px 0;\n                text-align:center;\n                position:relative;\n                z-index:6;\n                flex-shrink:0;\n                width:100% !important;\n                max-width:100% !important;\n                box-sizing:border-box;\n            }\n            .ranking-preview-container .ranking-editor-zone-header > h1.title,\n            .ranking-preview-container .ranking-editor-zone-header > h1{\n                display:block !important;\n                width:fit-content !important;\n                max-width:100% !important;\n                margin:0 auto 2px !important;\n                padding:0 !important;\n                text-align:center;\n                position:relative;\n                z-index:7;\n            }\n            .ranking-preview-container [data-template-element-id="title_channel"]{\n                display:block !important;\n                position:relative !important;\n                z-index:7;\n                width:fit-content !important;\n                max-width:calc(100% - 24px) !important;\n                margin:2px auto 8px auto !important;\n                font-size:clamp(20px, 8.5cqi, 34px) !important;\n                padding:0 !important;\n                text-align:center !important;\n                box-sizing:border-box;\n                white-space:nowrap !important;\n                overflow:visible !important;\n                overflow-wrap:normal !important;\n                word-break:normal !important;\n                float:none !important;\n                inset:auto !important;\n                top:auto !important;\n                left:auto !important;\n                right:auto !important;\n                bottom:auto !important;\n                transform:none !important;\n            }\n            .ranking-preview-container .ranking-editor-zone-member{\n                position:relative;z-index:1;\n            }\n            .ranking-preview-container .sub-resize-handle{\n                position:absolute;width:18px;height:18px;\n                background:rgba(249,115,22,.98);border:2.5px solid #fff;border-radius:50%;\n                cursor:var(--solis-preview-cursor-hand)!important;\n                box-shadow:0 2px 10px rgba(194,65,12,.4);\n                bottom:0;right:0;\n                transform:translate(35%,35%);\n                z-index:120;\n                pointer-events:none;display:none;\n                opacity:0;visibility:hidden;\n                touch-action:none;\n            }\n            .ranking-preview-container .sub-resize-handle::after{\n                content:'';position:absolute;inset:-10px -12px -12px -10px;border-radius:50%;\n                cursor:var(--solis-preview-cursor-hand)!important;\n            }\n            .ranking-preview-container .ranking-editor-selected > .sub-resize-handle,\n            .ranking-preview-container .ranking-editor-resize-anchor > .sub-resize-handle,\n            .ranking-preview-container .ranking-editor-zone-selected > .sub-resize-handle{\n                display:block;pointer-events:all;\n                opacity:1;visibility:visible;\n            }\n            .ranking-preview-container .ranking-editor-selected > .sub-resize-handle:hover,\n            .ranking-preview-container .ranking-editor-resize-anchor > .sub-resize-handle:hover,\n            .ranking-preview-container .ranking-editor-zone-selected > .sub-resize-handle:hover{\n                transform:translate(40%,40%) scale(1.15);\n            }\n            .ranking-editor-text{cursor:var(--solis-preview-cursor-text)!important;}\n            .ranking-preview-container .rk-number-locked,\n            .ranking-preview-container [data-template-element-id$="_number"]{\n                -webkit-user-modify:read-only;\n                user-select:none;\n                caret-color:transparent;\n                touch-action:none;\n            }\n            .ranking-preview-container .ranking-editor-zone-ranks{\n                touch-action:none;\n            }\n            .ranking-editor-text,.ranking-editor-zone{\n                transition:none!important;\n                box-shadow:none!important;\n            }\n            .ranking-editor-zone{\n                position:relative;\n                border-radius:10px;\n            }\n            .ranking-preview-container [data-template-element-id].ranking-editor-selected{\n                position:relative;\n                z-index:6;\n                isolation:isolate;\n                box-shadow:none!important;\n            }\n            .ranking-preview-container [data-template-element-id].ranking-editor-selected::before{\n                content:'';\n                position:absolute;\n                inset:-5px -4px;\n                border-radius:8px;\n                border:1.5px solid #f97316;\n                background:transparent;\n                box-shadow:\n                    0 0 0 3px rgba(249,115,22,.32),\n                    0 0 14px rgba(249,115,22,.28);\n                pointer-events:none;\n                z-index:0;\n                animation:none;\n            }\n            .ranking-preview-container [data-template-element-id].ranking-editor-selected::after{\n                content:none;\n                display:none;\n            }\n            .ranking-preview-container .rank-number.ranking-editor-selected::before{\n                inset:-3px -2px !important;\n                border-radius:5px;\n            }\n            .ranking-preview-container .rank-number.ranking-editor-selected::after{\n                display:none !important;\n            }\n            .ranking-preview-container .rank-number{\n                display:inline-block !important;\n                width:max-content !important;\n                max-width:none !important;\n                margin-right:0.15em !important;\n                padding:0 !important;\n                letter-spacing:0 !important;\n                line-height:1.05 !important;\n                box-sizing:content-box !important;\n            }\n            .ranking-preview-container .text-stroke{\n                text-shadow:\n                    2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000,\n                    1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000 !important;\n            }\n            .ranking-editor-zone-selected{\n                position:relative;\n                z-index:5;\n                isolation:isolate;\n                box-shadow:none!important;\n            }\n            .ranking-editor-zone-selected::before{\n                content:'';\n                position:absolute;\n                inset:-6px -8px;\n                border-radius:12px;\n                border:1.5px solid #f97316;\n                background:transparent;\n                box-shadow:\n                    0 0 0 3px rgba(249,115,22,.28),\n                    0 0 14px rgba(249,115,22,.22);\n                pointer-events:none;\n                z-index:0;\n                animation:none;\n            }\n            .ranking-editor-zone-selected::after{\n                content:none;\n                display:none;\n            }\n            .ranking-editor-zone-selected > *:not(.sub-resize-handle){\n                position:relative;\n                z-index:1;\n            }\n            .ranking-preview-container .sub-guide,\n            .ranking-preview-container .sub-half-line,\n            .ranking-preview-container .rk-half-line,\n            .ranking-preview-container .rk-guide{\n                display:none !important;\n                visibility:hidden !important;\n                opacity:0 !important;\n            }\n            @keyframes rkSelInnerFade{\n                0%,100%{opacity:1;}\n                50%{opacity:.92;}\n            }\n            @keyframes rkSelWhitePulse{\n                0%,100%{opacity:.45;transform:scale(.97);}\n                50%{opacity:.95;transform:scale(1);}\n            }\n            #rkPillMenu{\n                transition:opacity .1s ease,transform .1s ease,visibility .1s!important;\n            }\n            .rk-ghost-stack{\n                position:fixed;z-index:99850;pointer-events:none;\n                display:flex;flex-direction:column;justify-content:center;align-items:flex-end;\n                gap:6px;\n                padding:6px 12px;border-radius:8px;\n                background:rgba(34,197,94,.16);\n                box-shadow:inset 0 0 0 1.5px rgba(34,197,94,.45);\n                width:max-content;height:auto;max-width:min(220px,40vw);\n                overflow:visible;\n                -webkit-user-select:none!important;user-select:none!important;\n                -webkit-user-drag:none;\n            }\n            .rk-ghost-stack .rk-ghost-line{\n                display:block;white-space:nowrap;line-height:1.05;opacity:1!important;\n                background:none!important;padding:0;margin:0;\n                position:static!important;right:auto!important;top:auto!important;\n                transform:none!important;\n                font-weight:700;\n                letter-spacing:-.015em;\n                -webkit-user-select:none!important;user-select:none!important;\n            }\n            .rk-ghost-stack .rk-ghost-title-row{\n                display:flex;flex-direction:row;align-items:baseline;justify-content:flex-end;\n                gap:6px;flex-wrap:nowrap;\n            }\n            .rk-ghost-stack .rk-ghost-title-row .rk-ghost-line{\n                display:inline-block;\n            }\n            .rk-ghost-stack .rk-ghost-channel{\n                text-align:right;\n            }\n            .rk-suggest-remove{\n                position:relative;\n                z-index:6;\n            }\n            .rk-suggest-remove::before{\n                content:'';\n                position:absolute;\n                inset:-6px -8px;\n                border-radius:10px;\n                border:2px solid rgba(239,68,68,.7);\n                background:rgba(239,68,68,.12);\n                box-shadow:0 0 0 1px rgba(239,68,68,.22);\n                pointer-events:none;\n                z-index:0;\n            }\n            .rk-suggest-remove > *{\n                position:relative;\n                z-index:1;\n            }\n            .rk-suggest-receive{\n                position:relative;\n                z-index:6;\n            }\n            .rk-suggest-receive::before{\n                content:'';\n                position:absolute;\n                inset:-6px -8px;\n                border-radius:10px;\n                border:2px solid rgba(239,68,68,.7);\n                background:rgba(239,68,68,.12);\n                box-shadow:0 0 0 1px rgba(239,68,68,.22);\n                pointer-events:none;\n                z-index:0;\n            }\n            .rk-suggest-receive > *{\n                position:relative;\n                z-index:1;\n            }\n            .rk-suggest-actions{\n                position:fixed;z-index:99870;display:flex;gap:2px;align-items:center;\n                padding:3px 4px;border-radius:999px;\n                font-family:'Plus Jakarta Sans',sans-serif;\n                isolation:isolate;\n                background:linear-gradient(\n                    145deg,\n                    rgba(255,255,255,.96) 0%,\n                    rgba(255,255,255,.9) 45%,\n                    rgba(255,252,248,.88) 100%\n                );\n                border:1px solid rgba(255,255,255,.95);\n                border-bottom-color:rgba(200,185,170,.28);\n                border-right-color:rgba(200,185,170,.2);\n                box-shadow:\n                    0 6px 18px rgba(120,90,60,.12),\n                    0 1px 4px rgba(120,90,60,.06),\n                    inset 0 1px 0 rgba(255,255,255,1);\n                backdrop-filter:blur(16px) saturate(140%);\n                -webkit-backdrop-filter:blur(16px) saturate(140%);\n                opacity:0;visibility:hidden;pointer-events:none;\n                transform:none !important;\n                left:0;top:0;\n            }\n            .rk-suggest-actions.open{\n                opacity:1;visibility:visible;pointer-events:auto;\n            }\n            .rk-sa-btn{\n                appearance:none;-webkit-appearance:none;\n                width:28px;height:28px;min-width:28px;border:none;border-radius:999px;\n                display:inline-flex;align-items:center;justify-content:center;\n                cursor:var(--solis-preview-cursor-hand);\n                padding:0;box-sizing:border-box;margin:0;\n                font:inherit;\n                transition:background .12s ease,color .12s ease,border-color .12s ease,\n                    box-shadow .12s ease,transform .1s ease;\n            }\n            .rk-sa-btn:active{transform:scale(.95);}\n            .rk-sa-btn svg{display:block;flex-shrink:0;width:20px;height:20px;}\n            .rk-sa-accept{\n                background:linear-gradient(145deg,#34d399 0%,#16a34a 100%);\n                color:#ffffff !important;\n                border:1px solid rgba(21,128,61,.35);\n                box-shadow:\n                    inset 0 1px 0 rgba(255,255,255,.35),\n                    0 1px 3px rgba(22,163,74,.25);\n            }\n            .rk-sa-accept:hover{\n                background:linear-gradient(145deg,#22c55e 0%,#15803d 100%);\n                color:#ffffff !important;\n                border-color:rgba(21,128,61,.5);\n            }\n            .rk-sa-decline{\n                background:linear-gradient(145deg,rgba(255,255,255,.75),rgba(255,255,255,.4));\n                border:1px solid rgba(200,185,170,.35);\n                color:rgba(50,38,28,.72);\n                box-shadow:inset 0 1px 0 rgba(255,255,255,.9);\n            }\n            .rk-sa-decline:hover{\n                background:linear-gradient(145deg,rgba(254,226,226,.9),rgba(254,202,202,.55));\n                border-color:rgba(254,202,202,.7);\n                color:#ef4444;\n            }\n            .rk-top-line{align-items:flex-start;flex-direction:column;gap:8px;}\n            .rk-top-line .sub-clabel{flex:none;}\n            .rk-top-modes{\n                display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%;\n            }\n            .rk-top-mode{\n                appearance:none;cursor:var(--solis-preview-cursor-hand);margin:0;\n                border:1.5px solid rgba(200,185,170,.4);\n                background:linear-gradient(145deg,rgba(255,255,255,.85),rgba(255,255,255,.45));\n                border-radius:10px;\n                padding:9px 6px;\n                font-family:'Plus Jakarta Sans',sans-serif;\n                font-size:11.5px;font-weight:700;letter-spacing:-.01em;\n                color:rgba(50,38,28,.78);\n                transition:border-color .12s ease,background .12s ease,color .12s ease,box-shadow .12s ease;\n            }\n            .rk-top-mode:hover{\n                border-color:rgba(249,115,22,.45);\n                color:#9a3412;\n                box-shadow:0 0 0 1px rgba(249,115,22,.12);\n            }\n            .rk-top-mode.on{\n                border-color:rgba(249,115,22,.55);\n                background:linear-gradient(145deg,rgba(255,237,213,.95),rgba(254,215,170,.55));\n                color:#9a3412;\n                box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 0 0 1px rgba(249,115,22,.15);\n            }\n            .ranking-preview-container{\n                position:relative !important;\n            }\n            .ranking-preview-container .rk-top-panel{\n                position:absolute;left:0;right:0;top:0;z-index:1;\n                height:25%;pointer-events:none;overflow:hidden;\n                background:#fff;\n                margin:0;width:100%;border-radius:0;\n                box-sizing:border-box;\n            }\n            .ranking-preview-container .rk-top-handle{\n                position:absolute;left:0;right:0;bottom:0;height:14px;\n                cursor:var(--solis-preview-cursor-hand);pointer-events:auto;z-index:3;\n                background:linear-gradient(180deg,transparent,rgba(0,0,0,.08));\n            }\n            .ranking-preview-container .rk-top-handle::after{\n                content:'';position:absolute;left:50%;bottom:4px;\n                width:36px;height:3px;border-radius:999px;\n                transform:translateX(-50%);\n                background:rgba(0,0,0,.28);\n            }\n            .ranking-preview-container .rk-top-panel[hidden]{display:none!important;}\n            .ranking-preview-container .rk-top-panel.mode-blank{background:#fff;}\n            .ranking-preview-container .rk-top-panel.mode-blur{\n                background:rgba(255,255,255,.72);\n                backdrop-filter:none;\n                -webkit-backdrop-filter:none;\n            }\n            .ranking-preview-container .rk-top-panel .rk-top-blur-vid{\n                position:absolute;inset:0;width:100%;height:100%;\n                object-fit:cover;object-position:center top;\n                filter:blur(64px) saturate(1.22) brightness(1.26) contrast(0.95);\n                -webkit-filter:blur(64px) saturate(1.22) brightness(1.26) contrast(0.95);\n                transform:scale(1.7);transform-origin:center top;\n                pointer-events:none;opacity:0;z-index:0;\n                transition:opacity .18s ease;\n            }\n            .ranking-preview-container .rk-top-panel.mode-blur .rk-top-blur-vid{opacity:1;}\n            .ranking-preview-container .rk-top-panel.mode-blur.has-blur-src{\n                background:rgba(255,255,255,.35);\n            }\n            .ranking-preview-container .rk-top-panel.mode-blur::after{\n                content:'';position:absolute;inset:0;z-index:1;pointer-events:none;\n                background:\n                    linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08));\n            }\n            .rk-top-line.is-hidden{display:none!important;}\n            .ranking-preview-container.has-rk-top > .ranking-editor-zone-header,\n            .ranking-preview-container.has-rk-top > .ranking-editor-zone-ranks,\n            .ranking-preview-container.has-rk-top > .ranking-list{\n                position:relative;z-index:6;\n            }\n            .ranking-preview-container.has-rk-top [data-template-element-id^="title_"],\n            .ranking-preview-container.has-rk-top h1.title,\n            .ranking-preview-container.has-rk-top .ranking-editor-zone-header{\n                position:relative;z-index:7;\n            }\n            .ranking-preview-container .ranking-editor-zone-ranks{\n                cursor:var(--solis-preview-cursor-hand);\n                will-change:transform;\n                touch-action:none;\n            }\n            .ranking-preview-container .ranking-editor-zone-ranks [data-template-element-id],\n            .ranking-preview-container .ranking-editor-zone-ranks .ranking-editor-text{\n                cursor:var(--solis-preview-cursor-hand);\n                touch-action:none;\n                pointer-events:auto;\n            }\n            .ranking-preview-container.rk-stack-dragging,\n            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks,\n            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks [data-template-element-id]{\n                cursor:grabbing !important;\n                transition:none !important;\n            }\n            .ranking-preview-container.rk-stack-settle .ranking-editor-zone-ranks{\n                transition:transform .18s ease !important;\n            }\n            .ranking-preview-container .ranking-editor-zone-ranks{\n                transform:translateY(var(--rk-oy, 0px));\n            }\n            .ranking-preview-container [data-template-element-id="title_ranking"],\n            .ranking-preview-container [data-template-element-id="title_funniest"]{\n                font-size:inherit;\n                display:inline-block !important;\n                vertical-align:baseline;\n                max-width:100%;\n            }\n            .ranking-preview-container [data-template-element-id="title_channel"]{\n                max-width:calc(100% - 16px)!important;\n            }\n            .ranking-preview-container h1.title,\n            .ranking-preview-container h1{\n                max-width:100% !important;\n                box-sizing:border-box !important;\n                overflow:visible !important;\n            }\n            .ranking-preview-container .ranking-editor-zone-header{\n                max-width:100% !important;\n                box-sizing:border-box !important;\n                overflow:visible !important;\n            }\n            .ranking-preview-container [data-template-element-id].rk-sized{\n                line-height:1.1;\n            }\n            #templateVideoPreview.preview-placeholder .ranking-preview-container{\n                max-width:100% !important;\n                max-height:100% !important;\n                overflow:hidden !important;\n            }\n            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-header,\n            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-ranks,\n            #templateVideoPreview.preview-placeholder .ranking-preview-container [data-template-element-id].ranking-editor-selected,\n            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-selected,\n            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-resize-anchor{\n                overflow:visible !important;\n            }\n            #templateVideoPreview.preview-placeholder .ranking-preview-container h1.title,\n            #templateVideoPreview.preview-placeholder .ranking-preview-container [data-template-element-id^="title_"]{\n                overflow:visible !important;\n                text-overflow:clip !important;\n            }\n            #rkDdFont.sub-font-dd{\n                padding:8px;\n                min-width:200px;\n                max-width:min(240px,calc(100vw - 24px));\n                max-height:min(320px,calc(100vh - 24px));\n                overflow:auto;\n                gap:3px;\n            }\n            #rkDdFont .rk-font-search,\n            #rkDdFont .sub-fcheck{\n                display:none !important;\n            }\n            .rk-cplus-lab{\n                font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;\n                color:rgba(50,38,28,.42);margin:8px 0 4px;\n            }\n            .rk-cplus-lab:first-of-type{margin-top:0;}\n            .rk-sv-panel{\n                position:relative;height:110px;border-radius:12px;cursor:crosshair;\n                border:1px solid rgba(255,255,255,.85);\n                box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 1px 3px rgba(120,90,60,.1);\n                touch-action:none;overflow:hidden;\n            }\n            .rk-sv-thumb{\n                position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;\n                border-radius:999px;pointer-events:none;\n                border:2px solid #fff;box-shadow:0 1px 4px rgba(40,28,18,.35);\n                left:92%;top:44%;\n            }\n            .rk-sv-panel.is-dragging .rk-sv-thumb{transition:none;}\n            .rk-blank-line.is-hidden{display:none!important;}\n        `;
    let t = document.getElementById("rk-pill-styles");
    if (!t) {
      t = document.createElement("style");
      t.id = "rk-pill-styles";
      document.head.appendChild(t);
    }
    t.textContent = e;
  }
  function normalizeHex(e) {
    if (!e) return "";
    const t = String(e).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(t)) {
      return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
    }
    const n = rgbToHex(t);
    return n && n.startsWith("#") ? n.toLowerCase() : "";
  }
  function loadCustomCols() {
    try {
      const e = JSON.parse(localStorage.getItem(a) || "[]");
      if (!Array.isArray(e)) return [];
      return e.map(e => normalizeHex(e)).filter(Boolean).slice(0, 6);
    } catch (e) {
      return [];
    }
  }
  function saveCustomCol(e) {
    e = normalizeHex(e);
    if (!e) return;
    const t = [ e, ...loadCustomCols().filter(t => t !== e) ].slice(0, 6);
    try {
      localStorage.setItem(a, JSON.stringify(t));
    } catch (e) {}
    return t;
  }
  function hslToHex(e, t, n) {
    t /= 100;
    n /= 100;
    const k = t => (t + e / 30) % 12;
    const i = t * Math.min(n, 1 - n);
    const f = e => {
      const t = n - i * Math.max(-1, Math.min(k(e) - 3, Math.min(9 - k(e), 1)));
      return Math.round(255 * t).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  function isPlusPopOpen() {
    return !!document.getElementById("rkCPlusPop")?.classList.contains("open");
  }
  function closePlusPop() {
    const e = document.getElementById("rkCPlusPop");
    if (!e) return;
    e.classList.remove("open");
    e.setAttribute("aria-hidden", "true");
    g?.querySelectorAll(".sub-sw-add").forEach(e => e.classList.remove("on"));
  }
  function openPlusPop() {
    const e = document.getElementById("rkCPlusPop");
    if (!e) return;
    e.classList.add("open");
    e.setAttribute("aria-hidden", "false");
    const t = document.getElementById("rkCPlusTitle");
    if (t) {
      t.textContent = z === "blank" ? "Custom blank" : z === "fill" ? "Custom fill" : "Custom text";
    }
    g?.querySelectorAll(".sub-sw-add").forEach(e => {
      e.classList.toggle("on", (e.dataset.target || "text") === z);
    });
    syncSpectrumUI();
    renderPlusRecents();
    wireSpectrum();
    wireSvPanel();
  }
  function spectrumHex() {
    return hslToHex(D, N, $);
  }
  function syncSpectrumUI() {
    const e = spectrumHex();
    const t = document.getElementById("rkSpectrumThumb");
    if (t) {
      t.style.left = `${Math.max(0, Math.min(100, D / 3.6))}%`;
      t.style.background = e;
    }
    const n = document.getElementById("rkSvPanel");
    if (n) {
      const e = `hsl(${D},100%,50%)`;
      n.style.background = `linear-gradient(to bottom, rgba(0,0,0,0), #000),` + `linear-gradient(to right, #fff, ${e})`;
    }
    const i = document.getElementById("rkSvThumb");
    if (i) {
      i.style.left = `${Math.max(0, Math.min(100, N))}%`;
      i.style.top = `${Math.max(0, Math.min(100, 100 - $))}%`;
      i.style.background = e;
    }
  }
  function commitSpectrumColor(e, t) {
    if (t) {
      if (z === "blank") previewBlankColor(e); else if (z === "fill") previewTextColor(e); else previewTextColor(e);
      return;
    }
    if (z === "blank") {
      applyBlankColor(e, true);
      saveCustomCol(e);
      renderPlusRecents();
    } else if (z === "fill") {
      applyFillColor(e, true);
      saveCustomCol(e);
      renderPlusRecents();
    } else {
      applyTextColor(e, true);
      saveCustomCol(e);
      renderPlusRecents();
    }
  }
  function renderPlusRecents() {
    const e = document.getElementById("rkCPlusRecents");
    if (!e) return;
    const t = loadCustomCols();
    e.innerHTML = "";
    t.forEach(t => {
      const n = document.createElement("button");
      n.type = "button";
      n.className = "sub-cplus-sw";
      n.style.background = t;
      n.title = t;
      if (t === "#ffffff") {
        n.style.boxShadow = "0 1px 2px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)";
      }
      n.onmousedown = e => {
        if (document.querySelector(".rk-inline-editing")) e.preventDefault();
      };
      n.onclick = () => {
        if (z === "blank") applyBlankColor(t, true); else if (z === "fill") applyFillColor(t, true); else applyTextColor(t, true);
        closePlusPop();
      };
      e.appendChild(n);
    });
  }
  function wireSpectrum() {
    const e = document.getElementById("rkSpectrum");
    if (!e || e._wired) return;
    e._wired = true;
    const pick = (t, n) => {
      const i = e.getBoundingClientRect();
      const r = Math.max(0, Math.min(1, (t - i.left) / Math.max(1, i.width)));
      D = Math.round(r * 360);
      const o = spectrumHex();
      syncSpectrumUI();
      commitSpectrumColor(o, n);
    };
    e.addEventListener("pointerdown", t => {
      if (t.button != null && t.button !== 0) return;
      t.preventDefault();
      t.stopPropagation();
      e.classList.add("is-dragging");
      e.setPointerCapture?.(t.pointerId);
      pick(t.clientX, true);
      const onMove = e => pick(e.clientX, true);
      const onUp = t => {
        e.classList.remove("is-dragging");
        e.releasePointerCapture?.(t.pointerId);
        e.removeEventListener("pointermove", onMove);
        e.removeEventListener("pointerup", onUp);
        e.removeEventListener("pointercancel", onUp);
        pick(t.clientX, false);
      };
      e.addEventListener("pointermove", onMove);
      e.addEventListener("pointerup", onUp);
      e.addEventListener("pointercancel", onUp);
    });
    document.getElementById("rkCPlusClose")?.addEventListener("click", e => {
      e.stopPropagation();
      closePlusPop();
    });
  }
  function wireSvPanel() {
    const e = document.getElementById("rkSvPanel");
    if (!e || e._wired) return;
    e._wired = true;
    const pick = (t, n, i) => {
      const r = e.getBoundingClientRect();
      const o = Math.max(0, Math.min(1, (t - r.left) / Math.max(1, r.width)));
      const a = Math.max(0, Math.min(1, (n - r.top) / Math.max(1, r.height)));
      N = Math.round(o * 100);
      $ = Math.round((1 - a) * 100);
      const s = spectrumHex();
      syncSpectrumUI();
      commitSpectrumColor(s, i);
    };
    e.addEventListener("pointerdown", t => {
      if (t.button != null && t.button !== 0) return;
      t.preventDefault();
      t.stopPropagation();
      e.classList.add("is-dragging");
      e.setPointerCapture?.(t.pointerId);
      pick(t.clientX, t.clientY, true);
      const onMove = e => pick(e.clientX, e.clientY, true);
      const onUp = t => {
        e.classList.remove("is-dragging");
        e.releasePointerCapture?.(t.pointerId);
        e.removeEventListener("pointermove", onMove);
        e.removeEventListener("pointerup", onUp);
        e.removeEventListener("pointercancel", onUp);
        pick(t.clientX, t.clientY, false);
      };
      e.addEventListener("pointermove", onMove);
      e.addEventListener("pointerup", onUp);
      e.addEventListener("pointercancel", onUp);
    });
  }
  function makeAddSwatch(e) {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "sub-sw sub-sw-add";
    t.dataset.target = e === "fill" ? "fill" : e === "blank" ? "blank" : "text";
    t.title = e === "blank" ? "Custom blank" : e === "fill" ? "Custom fill" : "Custom text";
    t.setAttribute("aria-label", t.title);
    t.innerHTML = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.25v9.5M3.25 8h9.5"/></svg>';
    t.onmousedown = e => {
      if (document.querySelector(".rk-inline-editing")) e.preventDefault();
    };
    t.onclick = e => {
      e.stopPropagation();
      z = t.dataset.target || "text";
      const n = document.getElementById("rkCPlusTitle");
      if (n) {
        n.textContent = z === "blank" ? "Custom blank" : z === "fill" ? "Custom fill" : "Custom text";
      }
      g?.querySelectorAll(".sub-sw-add").forEach(e => {
        e.classList.toggle("on", e.dataset.target === z && isPlusPopOpen());
      });
      if (isPlusPopOpen() && t.classList.contains("on")) {
        closePlusPop();
        return;
      }
      openPlusPop();
      t.classList.add("on");
    };
    return t;
  }
  function getInlineEditSelection() {
    const e = window.getSelection();
    if (!e || e.rangeCount === 0 || e.isCollapsed) return null;
    const t = e.getRangeAt(0);
    let n = t.commonAncestorContainer;
    if (n.nodeType === 3) n = n.parentElement;
    const i = n?.closest?.(".rk-inline-editing");
    if (!i || !i.hasAttribute("data-template-element-id")) return null;
    if (!i.contains(t.startContainer) || !i.contains(t.endContainer)) return null;
    return {
      range: t,
      editing: i,
      sel: e
    };
  }
  function colorSelectionRange(e, t) {
    const n = normalizeHex(t) || t;
    try {
      const t = e.startContainer;
      const i = e.endContainer;
      const r = t.nodeType === 3 ? t.parentElement : t;
      const o = i.nodeType === 3 ? i.parentElement : i;
      if (r && r === o && r.tagName === "SPAN" && r.style.color && e.toString() === r.textContent) {
        r.style.color = n;
        return r;
      }
    } catch (e) {}
    const i = document.createElement("span");
    i.style.color = n;
    try {
      e.surroundContents(i);
    } catch (t) {
      const n = e.extractContents();
      i.appendChild(n);
      e.insertNode(i);
    }
    try {
      const e = window.getSelection();
      const t = document.createRange();
      t.selectNodeContents(i);
      e.removeAllRanges();
      e.addRange(t);
    } catch (e) {}
    return i;
  }
  function beginColorPreview() {
    if (A) return;
    A = true;
    H = z === "fill" ? v : w;
    B.clear();
    _ = null;
    const e = z === "text" ? getInlineEditSelection() : null;
    if (e) {
      B.set(e.editing, {
        html: e.editing.innerHTML
      });
      return;
    }
    resolveApplyTargets().forEach(e => {
      if (z === "fill") {
        B.set(e, {
          bg: e.style.backgroundColor || "",
          pad: e.style.padding || "",
          radius: e.style.borderRadius || "",
          fill: e.classList.contains("rk-has-fill")
        });
      } else {
        B.set(e, e.style.color || getComputedStyle(e).color || "");
      }
    });
  }
  function previewTextColor(e) {
    if (!y.size && z !== "blank") return;
    if (z === "blank") {
      previewBlankColor(e);
      return;
    }
    beginColorPreview();
    if (z === "fill") {
      resolveApplyTargets().forEach(t => applyFillToEl(t, e));
      syncFillSwatches(e);
      return;
    }
    const t = getInlineEditSelection();
    if (t || _) {
      if (_?.isConnected) {
        _.style.color = e;
      } else if (t) {
        _ = colorSelectionRange(t.range, e);
      }
      document.querySelectorAll("#rkTCG .sub-sw").forEach(t => {
        if (t.classList.contains("sub-sw-add") || t.classList.contains("nocolor")) return;
        t.classList.toggle("on", (normalizeHex(t.dataset.color) || "") === normalizeHex(e));
      });
      return;
    }
    resolveApplyTargets().forEach(t => {
      t.style.color = e;
    });
    document.querySelectorAll("#rkTCG .sub-sw").forEach(t => {
      if (t.classList.contains("sub-sw-add") || t.classList.contains("nocolor")) return;
      t.classList.toggle("on", (normalizeHex(t.dataset.color) || "") === normalizeHex(e));
    });
  }
  function endColorPreview() {
    if (!A) return;
    A = false;
    B.forEach((e, t) => {
      if (!t?.isConnected) return;
      if (e && typeof e === "object" && "html" in e) {
        t.innerHTML = e.html;
      } else if (e && typeof e === "object" && "bg" in e) {
        t.style.backgroundColor = e.bg;
        t.style.padding = e.pad;
        t.style.borderRadius = e.radius;
        t.classList.toggle("rk-has-fill", !!e.fill);
      } else {
        t.style.color = e;
      }
    });
    B.clear();
    _ = null;
    if (z === "fill") {
      if (H !== undefined) v = H;
    } else if (H != null) {
      w = H;
    }
    H = null;
    T = null;
    syncColorSwatches();
    syncFillSwatches();
  }
  function discardColorPreview() {
    A = false;
    B.clear();
    H = null;
    T = null;
    _ = null;
  }
  function applyFillToEl(e, t) {
    if (!e) return;
    if (!t) {
      e.style.backgroundColor = "transparent";
      e.style.background = "transparent";
      e.style.removeProperty("padding");
      e.style.removeProperty("border-radius");
      e.classList.remove("rk-has-fill");
      return;
    }
    const n = normalizeHex(t) || t;
    e.style.backgroundColor = n;
    e.style.background = n;
    e.style.padding = "4px 12px";
    e.style.borderRadius = "12px";
    e.classList.add("rk-has-fill");
  }
  function applyFillColor(e, t) {
    if (A) discardColorPreview();
    v = e ? normalizeHex(e) || e : null;
    if (t !== false) C = true;
    resolveApplyTargets().forEach(e => applyFillToEl(e, v));
    syncFillSwatches();
    if (t !== false && window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    if (t !== false) markLibraryRankingDirty();
  }
  function readFillFromEl(e) {
    if (!e) return null;
    const t = e.style.backgroundColor || "";
    if (!t || t === "transparent" || t === "rgba(0, 0, 0, 0)") return null;
    return normalizeHex(t) || rgbToHex(t) || null;
  }
  function buildColorGrid() {
    const e = document.getElementById("rkTCG");
    if (e) {
      e.innerHTML = "";
      i.forEach(t => {
        const n = document.createElement("div");
        n.className = "sub-sw";
        n.dataset.color = t;
        n.style.background = t;
        if (String(t).toLowerCase() === "#ffffff") {
          n.style.boxShadow = "0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)";
        }
        n.onmousedown = e => {
          if (document.querySelector(".rk-inline-editing")) e.preventDefault();
        };
        n.onpointerenter = () => {
          z = "text";
          previewTextColor(t);
        };
        n.onpointerleave = () => {
          endColorPreview();
        };
        n.onclick = () => {
          z = "text";
          applyTextColor(t, true);
          closePlusPop();
        };
        e.appendChild(n);
      });
      e.appendChild(makeAddSwatch("text"));
    }
    buildOutlineColorGrid();
    buildBlankColorGrid();
    try {
      document.querySelectorAll(".ranking-preview-container .rk-has-fill").forEach(e => {
        e.classList.remove("rk-has-fill");
        e.style.background = "transparent";
        e.style.backgroundColor = "transparent";
        e.style.removeProperty("padding");
        e.style.removeProperty("border-radius");
      });
    } catch (e) {}
    syncColorSwatches();
    syncOutlineColSwatches();
    wireTopModes();
    wireSpectrum();
    wireSvPanel();
    syncTopBgVisibility();
    syncBlankBgVisibility();
    applyRankingTopPanel(getRankingLayout());
    wireStackDrag(getRankingRoot());
    applyStackOffset();
  }
  function buildOutlineColorGrid() {
    const e = document.getElementById("rkOCG");
    if (!e) return;
    e.innerHTML = "";
    o.forEach(t => {
      const n = document.createElement("div");
      n.className = "sub-sw";
      n.dataset.color = t;
      n.style.background = t;
      if (String(t).toLowerCase() === "#ffffff") {
        n.style.boxShadow = "0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)";
      }
      n.title = `Outline ${t}`;
      n.onmousedown = e => {
        if (document.querySelector(".rk-inline-editing")) e.preventDefault();
      };
      n.onpointerenter = () => previewOutlineColor(t);
      n.onpointerleave = () => endOutlineColorPreview();
      n.onclick = () => applyOutlineColor(t);
      e.appendChild(n);
    });
    syncOutlineColSwatches();
  }
  let ke = undefined;
  function previewOutlineColor(e) {
    if (!y.size) return;
    if (ke === undefined) ke = S;
    const t = normalizeHex(e) || e || "#000000";
    resolveApplyTargets().forEach(e => {
      const n = getElShadowType(e) === "none" ? x || "outline" : getElShadowType(e);
      if (n === "none") return;
      e.style.setProperty("text-shadow", shadowCss(n === "stroke" ? "outline" : n, t), "important");
    });
    document.querySelectorAll("#rkOCG .sub-sw").forEach(e => {
      e.classList.toggle("on", (normalizeHex(e.dataset.color) || "") === (normalizeHex(t) || "").toLowerCase());
    });
  }
  function endOutlineColorPreview() {
    if (ke === undefined) return;
    const e = ke;
    ke = undefined;
    S = e;
    resolveApplyTargets().forEach(e => setElementShadow(e, getElShadowType(e) === "none" ? x : getElShadowType(e)));
    syncOutlineColSwatches();
  }
  function syncOutlineColSwatches() {
    const e = (normalizeHex(S) || "#000000").toLowerCase();
    document.querySelectorAll("#rkOCG .sub-sw").forEach(t => {
      t.classList.toggle("on", (normalizeHex(t.dataset.color) || "") === e);
    });
  }
  function isDarkHex(e) {
    const t = normalizeHex(e);
    if (!t) return true;
    const n = parseInt(t.slice(1, 3), 16);
    const i = parseInt(t.slice(3, 5), 16);
    const r = parseInt(t.slice(5, 7), 16);
    return (n * 299 + i * 587 + r * 114) / 1e3 < 140;
  }
  function applyOutlineColor(e) {
    ke = undefined;
    S = normalizeHex(e) || e || "#000000";
    if (x === "none") x = "outline";
    P = true;
    const t = resolveApplyTargets();
    t.forEach(e => {
      setElementShadow(e, x);
      const t = e.getAttribute("data-template-element-id");
      if (t && window.rankingCustomizer?.customizations) {
        const e = window.rankingCustomizer.customizations[t] || (window.rankingCustomizer.customizations[t] = {});
        const n = window.rankingCustomizer._colorToRgba?.(S);
        if (n) e.outline_color = n;
      }
      snapshotEl(e);
    });
    syncOutlineColSwatches();
    syncShadowSeg();
    if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    markLibraryRankingDirty();
    maybeOfferStyleSuggest(t, {
      shadow: x
    });
  }
  function buildBlankColorGrid() {
    const e = document.getElementById("rkBlankCG");
    if (!e) return;
    e.innerHTML = "";
    r.forEach(t => {
      const n = document.createElement("div");
      n.className = "sub-sw";
      n.dataset.color = t;
      n.style.background = t;
      if (String(t).toLowerCase() === "#ffffff") {
        n.style.boxShadow = "0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)";
      }
      n.onmousedown = e => {
        if (document.querySelector(".rk-inline-editing")) e.preventDefault();
      };
      n.onclick = () => {
        z = "blank";
        applyBlankColor(t, true);
        closePlusPop();
      };
      e.appendChild(n);
    });
    e.appendChild(makeAddSwatch("blank"));
    syncBlankColSwatches();
  }
  function syncBlankColSwatches() {
    const e = getRankingLayout();
    const t = (normalizeHex(e.top_panel_color) || "#000000").toLowerCase();
    document.querySelectorAll("#rkBlankCG .sub-sw").forEach(e => {
      if (e.classList.contains("sub-sw-add")) return;
      e.classList.toggle("on", (normalizeHex(e.dataset.color) || "") === t);
    });
  }
  function syncBlankBgVisibility() {
    const e = document.getElementById("rkBlankLine");
    if (!e) return;
    const t = O != null ? O : getRankingLayout().top_panel || "none";
    const n = t === "blank" && selectionAllowsTopBg();
    e.classList.toggle("is-hidden", !n);
    e.setAttribute("aria-hidden", n ? "false" : "true");
  }
  function previewBlankColor(e) {
    const t = getRankingRoot();
    const n = t?.querySelector(":scope > .rk-top-panel");
    if (!n || n.hidden) return;
    n.style.background = normalizeHex(e) || e || "#000";
  }
  function applyBlankColor(e, t) {
    const n = normalizeHex(e) || e || "#000000";
    const i = {
      top_panel: "blank",
      top_panel_color: n
    };
    setRankingLayout(i);
    if (t !== false && isDarkHex(n) && isDarkHex(S)) {
      applyOutlineColor("#ffffff");
    } else if (t !== false && !isDarkHex(n) && !isDarkHex(S)) {
      applyOutlineColor("#000000");
    }
    syncBlankColSwatches();
    syncBlankBgVisibility();
  }
  function syncShadowSeg(e) {
    const t = document.getElementById("rkSHG");
    if (!t) return;
    const n = e || x;
    t.querySelectorAll(".sub-edge-opt").forEach(e => {
      e.classList.toggle("on", e.dataset.sh === n);
    });
  }
  function buildShadowGrid() {
    const e = document.getElementById("rkSHG");
    if (!e) return;
    e.innerHTML = "";
    e.className = "sub-edge";
    const t = [ [ "none", "Off" ], [ "outline", "Outline" ], [ "thick-outline", "Thick" ] ];
    t.forEach(([t, n]) => {
      const i = document.createElement("button");
      i.type = "button";
      i.className = "sub-edge-opt" + (t === x ? " on" : "");
      i.dataset.sh = t;
      i.title = n === "Off" ? "No outline" : n === "Thick" ? "Thick outline" : "Outline";
      i.innerHTML = `<span class="sub-edge-sample" aria-hidden="true"><span class="sub-edge-aa">Aa</span></span>` + `<span class="sub-edge-label">${n}</span>`;
      i.addEventListener("pointerenter", () => {
        if (!y.size && V === "single") return;
        if (E === undefined) E = x;
        applyOutlinePreview(t);
        syncShadowSeg(t);
      });
      i.addEventListener("pointerleave", () => {
        if (E === undefined) return;
        const e = E;
        E = undefined;
        applyOutlinePreview(e);
        syncShadowSeg();
      });
      i.addEventListener("click", () => {
        E = undefined;
        applyShadow(t);
      });
      e.appendChild(i);
    });
    requestAnimationFrame(() => syncShadowSeg());
  }
  function applyOutlinePreview(e) {
    resolveApplyTargets().forEach(t => setElementShadow(t, e));
  }
  function selectionAllowsTopBg() {
    if (V === "group-ranks") return false;
    if (V === "group-header") return true;
    const e = [ ...y ];
    if (!e.length) return true;
    if (e.some(isRankEl) && !e.some(isHeaderEl)) return false;
    return e.every(isHeaderEl);
  }
  function syncTopBgVisibility() {
    const e = g?.querySelector(".rk-top-line");
    if (!e) return;
    const t = selectionAllowsTopBg();
    e.classList.toggle("is-hidden", !t);
    e.setAttribute("aria-hidden", t ? "false" : "true");
    syncBlankBgVisibility();
  }
  function syncColorSwatches() {
    const e = (normalizeHex(w) || "").toLowerCase();
    document.querySelectorAll("#rkTCG .sub-sw").forEach(t => {
      if (t.classList.contains("sub-sw-add") || t.classList.contains("nocolor")) return;
      t.classList.toggle("on", (normalizeHex(t.dataset.color) || "") === e);
    });
  }
  function syncFillSwatches(e) {}
  function getRankingLayout() {
    const e = window.rankingCustomizer?.customizations || {};
    const t = e[s] || window.__solisRankingLayout || {};
    let n = Number(t.top_ratio);
    if (t.v !== 2) {
      if (!Number.isFinite(n) || n >= .32) {
        n = l;
      }
    } else if (!Number.isFinite(n)) {
      n = l;
    }
    return {
      top_panel: t.top_panel === "blank" || t.top_panel === "blank_blur" ? t.top_panel : "none",
      top_panel_color: normalizeHex(t.top_panel_color) || "#000000",
      top_ratio: Math.max(c, Math.min(u, n)),
      offset_x_pct: 0,
      offset_y_pct: (() => {
        const e = Number(t.offset_y_pct);
        if (!Number.isFinite(e)) return 0;
        const n = getRankingRoot();
        if (!n) return Math.max(-.35, Math.min(.45, e));
        const i = computeStackOffsetBounds(n);
        return Math.max(i.minPct, Math.min(i.maxPct, e));
      })(),
      v: 2
    };
  }
  function computeStackOffsetBounds(e) {
    e = e || getRankingRoot();
    if (!e) return {
      minPct: 0,
      maxPct: 0
    };
    const t = Math.max(1, e.getBoundingClientRect().height || 1);
    const n = getHeaderZone();
    const i = getRanksZone();
    if (!i) return {
      minPct: 0,
      maxPct: 0
    };
    const r = parseFloat(String(e.style.getPropertyValue("--rk-oy") || "0")) || 0;
    const o = e.getBoundingClientRect().top;
    let a = 0;
    if (n) {
      a = n.getBoundingClientRect().bottom - o;
    }
    getHeaderElements().forEach(e => {
      if (!e?.isConnected) return;
      const t = e.getBoundingClientRect();
      if (t.height > 0) a = Math.max(a, t.bottom - o);
    });
    const s = i.getBoundingClientRect();
    const l = s.top - o - r;
    const c = s.bottom - o - r;
    const u = Math.max(6, t * .012);
    const d = Math.max(4, t * .01);
    let p = (a + u - l) / t;
    let g = (t - d - c) / t;
    p = Math.max(-.35, Math.min(.45, p));
    g = Math.max(-.35, Math.min(.45, g));
    if (g < p) {
      const e = (p + g) / 2;
      p = e;
      g = e;
    }
    if (g < p + .1) {
      g = Math.min(.45, p + .1);
    }
    if (g < .12) g = .12;
    return {
      minPct: p,
      maxPct: g
    };
  }
  function applyStackOffset(e) {
    const t = getRankingRoot();
    if (!t) return;
    e = e || getRankingLayout();
    const n = Math.max(1, t.getBoundingClientRect().height || 1);
    const i = computeStackOffsetBounds(t);
    const r = Math.max(i.minPct, Math.min(i.maxPct, Number(e.offset_y_pct) || 0));
    const o = Math.round(r * n);
    t.style.setProperty("--rk-oy", `${o}px`);
    t.style.removeProperty("--rk-ox");
  }
  let ye = 0;
  function markRankPointerClickSuppress(e = 480) {
    ye = Date.now() + e;
  }
  function consumeRankPointerClick() {
    if (Date.now() < ye) {
      ye = 0;
      return true;
    }
    return false;
  }
  let be = null;
  function endStackDragSession(e) {
    const t = be;
    be = null;
    if (!t) return;
    try {
      t.cleanup(e);
    } catch (e) {}
  }
  function wireStackDrag(e) {
    e = e || getRankingRoot();
    if (!e) return;
    let t = e.querySelector(".ranking-editor-zone-ranks");
    if (!t) return;
    if (t.dataset.rkYDrag === "2") return;
    if (t.dataset.rkYDrag) {
      const n = t.cloneNode(true);
      delete n.dataset.rkYDrag;
      t.parentNode?.replaceChild(n, t);
      t = n;
      try {
        const e = window.rankingTemplateEditor;
        if (e && e.container) {
          e.destroy();
          e._abort = new AbortController;
          e.ensureZones();
          e.setupTextElements();
          e.attachEventListeners();
        }
      } catch (e) {}
      t = e.querySelector(".ranking-editor-zone-ranks") || t;
    }
    if (!t || t.dataset.rkYDrag === "2") return;
    t.dataset.rkYDrag = "2";
    try {
      t.style.touchAction = "none";
    } catch (e) {}
    const n = 4;
    const i = .004;
    t.addEventListener("pointerdown", r => {
      if (r.button != null && r.button !== 0) return;
      if (r.isPrimary === false) return;
      if (r.target.closest?.(".sub-resize-handle")) return;
      if (r.target.closest?.("#rkPillMenu") || r.target.closest?.(".sub-dropdown")) return;
      const o = r.target.closest?.('[contenteditable="true"], .rk-inline-editing');
      if (o) return;
      const a = r.target.closest?.("[data-template-element-id]");
      if (a) {
        const e = a.getAttribute("data-template-element-id") || "";
        const t = /^rank_\d+_number$/.test(e);
        if (!t) return;
      }
      if (r.ctrlKey || r.metaKey) return;
      if (be) {
        endStackDragSession("superseded");
      }
      const s = r.pointerId;
      const l = getRankingLayout();
      const c = r.clientY;
      const u = r.clientX;
      const p = Number(l.offset_y_pct) || 0;
      const g = Math.max(1, e.getBoundingClientRect().height || 1);
      const m = computeStackOffsetBounds(e);
      let b = false;
      let w = false;
      let v = false;
      const cleanup = () => {
        v = true;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
        window.removeEventListener("lostpointercapture", onLostCapture, true);
        if (w || t.hasPointerCapture?.(s)) {
          try {
            t.releasePointerCapture(s);
          } catch (e) {}
        }
        w = false;
        e.classList.remove("rk-stack-dragging");
        if (be && be.pointerId === s) {
          be = null;
        }
      };
      const onMove = i => {
        if (v) return;
        if (i.pointerId != null && i.pointerId !== s) return;
        const r = i.clientY - c;
        const o = i.clientX - u;
        if (!b && Math.hypot(o, r) < n) return;
        if (!b) {
          b = true;
          try {
            t.setPointerCapture(s);
            w = true;
          } catch (e) {}
        }
        if (i.cancelable) i.preventDefault();
        e.classList.add("rk-stack-dragging");
        e.classList.remove("rk-stack-settle");
        if (y.size && d?.classList) {
          d.classList.add("active");
          schedulePosMenu();
        }
        const a = p + r / g;
        const l = Math.max(m.minPct, Math.min(m.maxPct, a));
        e.style.setProperty("--rk-oy", `${Math.round(l * g)}px`);
        t._rkPendingOy = l;
      };
      const onUp = n => {
        if (v) return;
        if (n && n.pointerId != null && n.pointerId !== s) return;
        cleanup();
        if (!b) return;
        const r = Number.isFinite(t._rkPendingOy) ? t._rkPendingOy : p;
        delete t._rkPendingOy;
        if (Math.abs(r - p) < i) {
          e.style.setProperty("--rk-oy", `${Math.round(p * g)}px`);
          return;
        }
        markRankPointerClickSuppress();
        const o = Math.round(r * g);
        e.style.setProperty("--rk-oy", `${o}px`);
        const a = getRankingLayout();
        storeRankingLayout({
          ...a,
          offset_y_pct: r
        });
        markLibraryRankingDirty();
        if (y.size) {
          showMenu();
          schedulePosMenu();
        }
      };
      const onLostCapture = e => {
        if (v) return;
        if (e.pointerId != null && e.pointerId !== s) return;
        onUp(e);
      };
      be = {
        pointerId: s,
        cleanup: cleanup
      };
      window.addEventListener("pointermove", onMove, {
        capture: true,
        passive: false
      });
      window.addEventListener("pointerup", onUp, {
        capture: true
      });
      window.addEventListener("pointercancel", onUp, {
        capture: true
      });
      window.addEventListener("lostpointercapture", onLostCapture, {
        capture: true
      });
    });
  }
  function storeRankingLayout(e) {
    const t = {
      ...e,
      v: 2
    };
    window.__solisRankingLayout = t;
    if (window.rankingCustomizer) {
      if (!window.rankingCustomizer.customizations) {
        window.rankingCustomizer.customizations = {};
      }
      window.rankingCustomizer.customizations[s] = t;
      if (typeof window.rankingCustomizer.saveCustomizations === "function") {
        window.rankingCustomizer.saveCustomizations();
      }
    }
  }
  function setRankingLayout(e) {
    const t = getRankingLayout();
    const n = {
      ...t,
      ...e
    };
    O = null;
    storeRankingLayout(n);
    applyRankingTopPanel(n);
    applyStackOffset(n);
    markLibraryRankingDirty();
    syncTopModeButtons();
  }
  function ensureRankingTopPanel(e) {
    if (!e) return null;
    let t = e.querySelector(":scope > .rk-top-panel");
    if (!t) {
      t = document.createElement("div");
      t.className = "rk-top-panel";
      t.setAttribute("aria-hidden", "true");
      t.hidden = true;
      t.innerHTML = '<video class="rk-top-blur-vid" muted loop playsinline preload="auto"></video>';
      e.insertBefore(t, e.firstChild);
    }
    t.querySelectorAll(".rk-top-resize").forEach(e => e.remove());
    if (!t.querySelector(".rk-top-handle")) {
      const e = document.createElement("div");
      e.className = "rk-top-handle";
      e.title = "Drag to resize background";
      e.addEventListener("pointerdown", n => {
        n.preventDefault();
        n.stopPropagation();
        const i = getRankingRoot();
        if (!i) return;
        const r = Math.max(1, i.getBoundingClientRect().height || 1);
        const o = getRankingLayout();
        const a = n.clientY;
        const s = Number(o.top_ratio) || l;
        const d = n.pointerId;
        try {
          e.setPointerCapture(d);
        } catch (e) {}
        const onMove = e => {
          const n = e.clientY - a;
          const i = Math.max(c, Math.min(u, s + n / r));
          t.style.height = `${Math.round(i * 1e3) / 10}%`;
          t._rkPendingRatio = i;
        };
        const onUp = () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);
          try {
            e.releasePointerCapture(d);
          } catch (e) {}
          const n = Number.isFinite(t._rkPendingRatio) ? t._rkPendingRatio : s;
          delete t._rkPendingRatio;
          setRankingLayout({
            top_ratio: n
          });
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
      });
      t.appendChild(e);
    }
    return t;
  }
  function measureHeaderBandRatio(e) {
    e = e || getRankingRoot();
    if (!e) return l;
    const t = e.getBoundingClientRect();
    const n = Math.max(1, t.height || 1);
    let i = 0;
    const r = getHeaderZone();
    if (r) {
      const e = r.getBoundingClientRect();
      if (e.height > 0) i = Math.max(i, e.bottom - t.top);
    }
    getHeaderElements().forEach(e => {
      if (!e?.isConnected) return;
      const n = e.getBoundingClientRect();
      if (n.height > 0) i = Math.max(i, n.bottom - t.top);
    });
    if (i <= 4) return l;
    const o = Math.max(6, Math.round(n * .01));
    return Math.max(c, Math.min(u, (i + o) / n));
  }
  function syncTopPanelToHeader(e) {
    e = e || {};
    const t = getRankingRoot();
    if (!t) return null;
    const n = getRankingLayout();
    if (n.top_panel === "none") return null;
    const i = ensureRankingTopPanel(t);
    if (!i || i.hidden) return null;
    const r = measureHeaderBandRatio(t);
    const o = Number(n.top_ratio);
    const a = Number.isFinite(o) ? o : l;
    const s = Math.max(c, Math.min(u, Math.max(a, r)));
    i.style.height = `${Math.round(s * 1e3) / 10}%`;
    if (!e.liveOnly && Math.abs(a - s) > .004) {
      storeRankingLayout({
        ...n,
        top_ratio: s,
        v: 2
      });
      markLibraryRankingDirty();
    }
    return s;
  }
  function findRankingSourceVideo() {
    const e = document.getElementById("templateVideoPreview");
    if (!e) return null;
    return e.querySelector("video.library-preview-video") || e.querySelector("#splitscreenContentVideo") || Array.from(e.querySelectorAll("video")).find(e => !e.classList.contains("rk-top-blur-vid") && !e.classList.contains("gp-blank-blur-vid")) || null;
  }
  function applyRankingTopPanel(e) {
    const t = getRankingRoot();
    if (!t) return;
    e = e || getRankingLayout();
    const n = e.top_panel || "none";
    if (getComputedStyle(t).position === "static") {
      t.style.position = "relative";
    }
    const i = ensureRankingTopPanel(t);
    if (!i) return;
    t.classList.toggle("has-rk-top", n !== "none");
    if (n === "none") {
      i.hidden = true;
      i.classList.remove("mode-blur", "mode-blank");
      const n = i.querySelector(".rk-top-blur-vid");
      if (n) {
        try {
          n.pause();
          n.removeAttribute("src");
          n.load();
        } catch (e) {}
      }
      wireStackDrag(t);
      applyStackOffset(e);
      return;
    }
    i.hidden = false;
    i.classList.toggle("mode-blur", n === "blank_blur");
    i.classList.toggle("mode-blank", n === "blank");
    const r = measureHeaderBandRatio(t);
    const o = Number(e.top_ratio);
    const a = Math.max(c, Math.min(u, Math.max(Number.isFinite(o) ? o : l, r)));
    i.style.height = `${Math.round(a * 1e3) / 10}%`;
    const s = Number(e.top_ratio);
    if (!Number.isFinite(s) || Math.abs(s - a) > .004) {
      storeRankingLayout({
        ...e,
        top_panel: n,
        top_ratio: a,
        v: 2
      });
    }
    const d = i.querySelector(".rk-top-blur-vid");
    if (n === "blank") {
      i.classList.remove("has-blur-src");
      i.style.background = e.top_panel_color || "#000";
      if (d) {
        try {
          d.pause();
          d.removeAttribute("src");
        } catch (e) {}
      }
    } else if (n === "blank_blur") {
      i.style.background = "";
      const e = findRankingSourceVideo();
      if (d && e && (e.currentSrc || e.src)) {
        const t = e.currentSrc || e.src;
        if (d.getAttribute("src") !== t && d.src !== t) {
          d.src = t;
          try {
            d.load();
          } catch (e) {}
        }
        i.classList.add("has-blur-src");
        const sync = () => {
          try {
            d.currentTime = e.currentTime || 0;
          } catch (e) {}
          d.muted = true;
          d.playsInline = true;
          const t = d.play();
          if (t && typeof t.catch === "function") t.catch(() => {});
        };
        if (!d._rkBlurBound) {
          d._rkBlurBound = true;
          e.addEventListener("play", sync);
          e.addEventListener("seeked", sync);
          e.addEventListener("timeupdate", () => {
            if (Math.abs((d.currentTime || 0) - (e.currentTime || 0)) > .45) {
              try {
                d.currentTime = e.currentTime || 0;
              } catch (e) {}
            }
          });
          d.addEventListener("loadeddata", sync);
        }
        if (d.readyState >= 2) sync(); else {
          d.addEventListener("loadeddata", sync, {
            once: true
          });
          sync();
        }
      } else if (d) {
        try {
          d.pause();
          d.removeAttribute("src");
        } catch (e) {}
        i.classList.remove("has-blur-src");
        i.style.background = "";
      }
    } else if (d) {
      try {
        d.pause();
      } catch (e) {}
      i.classList.remove("has-blur-src");
      i.style.background = "";
    } else {
      i.classList.remove("has-blur-src");
      i.style.background = "";
    }
    wireStackDrag(t);
    applyStackOffset(e);
  }
  function syncTopModeButtons() {
    const e = O != null ? O : getRankingLayout().top_panel || "none";
    document.querySelectorAll("#rkTopModes .rk-top-mode").forEach(t => {
      t.classList.toggle("on", (t.dataset.top || "none") === e);
    });
    syncBlankBgVisibility();
    syncBlankColSwatches();
  }
  function previewTopMode(e) {
    const t = e === "blank" || e === "blank_blur" ? e : "none";
    O = t;
    applyRankingTopPanel({
      ...getRankingLayout(),
      top_panel: t
    });
    syncTopModeButtons();
  }
  function resetTopModePreview() {
    if (O == null) return;
    O = null;
    applyRankingTopPanel(getRankingLayout());
    syncTopModeButtons();
  }
  function wireTopModes() {
    const e = document.getElementById("rkTopModes");
    if (!e || e._wired) return;
    e._wired = true;
    e.addEventListener("click", e => {
      const t = e.target.closest(".rk-top-mode");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      O = null;
      const n = t.dataset.top || "none";
      const i = {
        top_panel: n
      };
      if (n === "blank" || n === "blank_blur") {
        const e = getRankingLayout();
        const t = Number(e.top_ratio);
        if (!Number.isFinite(t) || t < .2 || e.top_panel === "none") {
          i.top_ratio = l;
        }
      }
      setRankingLayout(i);
      syncTopModeButtons();
      syncBlankBgVisibility();
    });
    e.addEventListener("pointerover", t => {
      if (t.pointerType && t.pointerType !== "mouse") return;
      const n = t.target.closest?.(".rk-top-mode");
      if (!n || !e.contains(n)) return;
      previewTopMode(n.dataset.top || "none");
    });
    e.addEventListener("pointerout", t => {
      if (t.pointerType && t.pointerType !== "mouse") return;
      const n = t.relatedTarget;
      if (n && e.contains(n)) {
        const e = n.closest?.(".rk-top-mode");
        if (e) {
          previewTopMode(e.dataset.top || "none");
          return;
        }
      }
      resetTopModePreview();
    });
    syncTopModeButtons();
    applyRankingTopPanel(getRankingLayout());
  }
  function markLibraryRankingDirty() {
    try {
      const e = window.clipsStudio;
      if (!e?.currentTemplateForPreview?.isLibraryPreview) return;
      if (!e._libraryRankingEditable) return;
      e._libraryRankingDirty = true;
      const t = document.getElementById("confirmUseTemplateBtn");
      if (t) {
        t.textContent = "Apply & Download";
        t.classList.add("library-download-mode");
      }
      if (typeof window.syncUseTemplateFab === "function") window.syncUseTemplateFab();
    } catch (e) {}
  }
  function ensureResizeHandle(e) {
    if (!e || Array.from(e.children).some(e => e.classList.contains("sub-resize-handle"))) return;
    const t = document.createElement("div");
    t.className = "sub-resize-handle";
    t.addEventListener("pointerdown", e => {
      e.stopPropagation();
      e.preventDefault();
      const n = resolveApplyTargets();
      if (!n.length) return;
      L = true;
      let i = true;
      const r = e.clientX;
      const o = e.clientY;
      const a = e.pointerId;
      const s = V === "group-header" ? getPrimaryHeaderEl() || n[0] : W && document.contains(W) ? W : n[0];
      const l = R != null ? R : getEffectiveFontSize(s);
      const c = V === "group-header";
      const u = V === "group-ranks";
      const p = c || V !== "single" && n.every(e => isHeaderEl(e));
      const g = getHardSizeCap(u || n.every(e => isRankEl(e)) ? "ranks" : "header");
      const m = g;
      let b = false;
      const onMove = e => {
        if (!i) return;
        if (e.cancelable) e.preventDefault();
        const t = (e.clientX - r + (e.clientY - o)) * .55;
        const a = u || n.every(e => isRankEl(e)) ? ce : le;
        const s = Math.max(a, Math.min(m, Math.round(l + t)));
        if (Math.abs(s - l) < 1 && Math.abs(t) < 2) return;
        b = true;
        if (c || p) {
          R = applyHeaderBlockSize(s, {
            resizing: true
          });
          syncTopPanelToHeader({
            liveOnly: true
          });
        } else if (u) {
          R = applyRankBlockSize(s, {
            resizing: true
          });
        } else {
          let e = s;
          const t = getRankingRoot();
          n.forEach(n => {
            e = setElementFontSize(n, s);
            const i = n.getAttribute("data-template-element-id") || "";
            const r = i.match(/^rank_(\d+)_number$/);
            if (r && t) {
              const e = t.querySelector(`[data-template-element-id="rank_${r[1]}_title"]`);
              if (e) setElementFontSize(e, s);
            }
          });
          R = e;
          if (n.every(e => isHeaderEl(e))) {
            syncTopPanelToHeader({
              liveOnly: true
            });
          }
        }
        if (d?.classList.contains("active")) schedulePosMenu();
      };
      const onUp = () => {
        i = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        try {
          if (a != null) t.releasePointerCapture?.(a);
        } catch (e) {}
        if (c || p || n.every(e => isHeaderEl(e))) {
          syncTopPanelToHeader();
          const e = getRankingRoot();
          if (e && !headerLineFits(e)) {
            const e = Math.max(le, R != null ? R : l);
            applyHeaderBlockSize(e, {
              resizing: false
            });
          }
        }
        if (u) {
          const e = getRankingRoot();
          if (e && !ranksListFits(e)) {
            applyRankBlockSize(R != null ? R : l, {
              resizing: false
            });
          }
        } else if (n.some(e => isRankEl(e))) {
          const e = getRankingRoot();
          if (e && !ranksListFits(e) && R != null) {
            let t = R;
            let i = 40;
            while (i-- > 0 && t > ce && !ranksListFits(e)) {
              t -= 1;
              n.forEach(n => {
                setElementFontSize(n, t);
                const i = n.getAttribute("data-template-element-id") || "";
                const r = i.match(/^rank_(\d+)_number$/);
                if (r) {
                  const n = e.querySelector(`[data-template-element-id="rank_${r[1]}_title"]`);
                  if (n) setElementFontSize(n, t);
                }
              });
            }
            R = t;
          }
        }
        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        markLibraryRankingDirty();
        if (b) markRankPointerClickSuppress();
        if (R != null && Math.abs(R - l) >= 1) {
          scheduleResizeSuggest(n, l, R);
        }
        if (y.size) {
          showMenu();
          schedulePosMenu();
        }
      };
      try {
        if (a != null) t.setPointerCapture(a);
      } catch (e) {}
      document.addEventListener("pointermove", onMove, {
        passive: false
      });
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
    e.appendChild(t);
  }
  function syncResizeHandles() {
    getAllTextElements().forEach(e => {
      Array.from(e.children).filter(e => e.classList.contains("sub-resize-handle")).forEach(e => e.remove());
    });
    [ getHeaderZone(), getRanksZone() ].forEach(e => {
      if (!e) return;
      Array.from(e.children).filter(e => e.classList.contains("sub-resize-handle")).forEach(e => e.remove());
      e.classList.remove("ranking-editor-resize-anchor");
    });
    if (!y.size) return;
    if (V === "group-header" || V === "group-ranks") {
      const e = V === "group-header" ? getHeaderZone() : getRanksZone();
      if (!e) return;
      e.classList.add("ranking-editor-resize-anchor");
      ensureResizeHandle(e);
      return;
    }
    const e = W && document.contains(W) ? W : y.values().next().value;
    if (!e) return;
    e.classList.add("ranking-editor-selected");
    ensureResizeHandle(e);
    e.style.zIndex = "8";
  }
  function snapshotEl(e) {
    Z.set(e, {
      fontFamily: e.style.fontFamily,
      fontWeight: e.style.fontWeight,
      fontSize: e.style.fontSize,
      color: e.style.color,
      textShadow: e.style.textShadow,
      hadTextStroke: e.classList.contains("text-stroke")
    });
  }
  function restoreSnapshot(e) {
    const t = Z.get(e);
    if (!t) return;
    e.style.fontFamily = t.fontFamily;
    e.style.fontWeight = t.fontWeight;
    e.style.fontSize = t.fontSize;
    e.style.color = t.color;
    e.style.textShadow = t.textShadow;
    e.classList.toggle("text-stroke", t.hadTextStroke);
  }
  function readStateFromEl(e) {
    const t = getComputedStyle(e);
    const n = e.style.fontFamily;
    if (n) {
      b = n.replace(/['"]/g, "").split(",")[0].trim();
    } else if (t.fontFamily) {
      b = t.fontFamily.replace(/['"]/g, "").split(",")[0].trim();
    }
    w = e.style.color || rgbToHex(t.color) || "#ffffff";
    v = readFillFromEl(e);
    const i = e.style.textShadow;
    if (i && i !== "none") {
      if (i.includes("3px 0") || i.includes("3px 0px")) x = "thick-outline"; else x = "outline";
    } else if (e.classList.contains("text-stroke")) {
      x = "outline";
    } else {
      x = "none";
    }
    const r = e.style.fontSize;
    const o = getEffectiveFontSize(e);
    if (r && r !== "inherit" && !r.includes("clamp")) {
      const e = Math.round(parseFloat(r));
      R = Number.isFinite(e) ? e : o;
      L = true;
    } else {
      R = o;
      L = false;
    }
  }
  function rgbToHex(e) {
    const t = e && e.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!t) return e;
    const h = e => parseInt(e, 10).toString(16).padStart(2, "0");
    return `#${h(t[1])}${h(t[2])}${h(t[3])}`;
  }
  function previewPxFromBurn(e) {
    const t = getRankingRoot();
    const n = document.getElementById("templateVideoPreview");
    const i = n?.clientWidth || t?.clientWidth || 280;
    return Math.max(14, Math.round(Number(e || 0) * (i / he)));
  }
  function seedDefaultPreviewSizes() {
    const e = getRankingRoot();
    if (!e) return false;
    injectStyles();
    const t = e.querySelector('[data-template-element-id$="_number"].rk-sized') || e.querySelector('[data-template-element-id$="_title"].rk-sized');
    if (t) {
      const n = parseFloat(getComputedStyle(t).fontSize) || 0;
      if (n >= 24) return false;
      e.querySelectorAll(".rk-sized").forEach(e => e.classList.remove("rk-sized"));
    } else if (e.querySelector(".rk-sized")) {
      return false;
    }
    const n = previewPxFromBurn(de);
    const i = previewPxFromBurn(pe);
    const r = previewPxFromBurn(fe);
    applyHeaderBlockSize(n);
    applyRankBlockSize(i, {
      titlePx: r
    });
    const o = e.querySelector('[data-template-element-id="title_channel"]');
    if (o && !o.classList.contains("rk-sized")) {
      const e = Math.min(ue, previewPxFromBurn(me));
      o.style.setProperty("font-size", `${e}px`, "important");
      o.classList.add("rk-sized");
    }
    try {
      window.rankingCustomizer?.persistAllPreviewStyles?.();
    } catch (e) {}
    return true;
  }
  function getEffectiveFontSize(e) {
    return Math.round(parseFloat(getComputedStyle(e).fontSize) || 20);
  }
  function getHardSizeCap(e) {
    if (e && isChannelEl(e)) {
      return ue;
    }
    const t = e === "ranks" || e === "header" ? e : isHeaderEl(e) ? "header" : isRankEl(e) ? "ranks" : "header";
    if (t === "ranks") return se;
    return ae;
  }
  function measureChannelWidthAt(e, t) {
    if (!e) return 0;
    const n = document.createElement("span");
    n.setAttribute("aria-hidden", "true");
    const i = getComputedStyle(e);
    n.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;";
    n.style.fontFamily = e.style.fontFamily || i.fontFamily;
    n.style.fontWeight = e.style.fontWeight || i.fontWeight || "400";
    n.style.fontSize = `${t}px`;
    n.style.letterSpacing = e.style.letterSpacing || i.letterSpacing || "normal";
    n.textContent = (e.textContent || "CHANNEL MOMENTS").replace(/\s+/g, " ").trim() || "CHANNEL MOMENTS";
    document.body.appendChild(n);
    const r = n.offsetWidth || 0;
    n.remove();
    return r;
  }
  function channelFitsAtSize(e, t, n) {
    n = n || getRankingRoot();
    if (!e || !n) return true;
    const i = n.getBoundingClientRect();
    const r = Math.max(40, i.width - 36);
    if (measureChannelWidthAt(e, t) > r) return false;
    const o = n.querySelector(".ranking-list");
    if (o) {
      const n = e.getBoundingClientRect();
      const i = o.getBoundingClientRect();
      const r = Math.max(1, getEffectiveFontSize(e));
      const a = Math.max(8, n.height * (t / r));
      if (n.top + a > i.top - 6) return false;
    }
    return true;
  }
  function getContentRect(e) {
    if (!e) return null;
    const t = Array.from(e.querySelectorAll("[data-template-element-id]")).filter(e => !e.classList.contains("sub-resize-handle"));
    if (t.length) {
      let e = Infinity;
      let n = -Infinity;
      let i = Infinity;
      let r = -Infinity;
      t.forEach(t => {
        const o = t.getBoundingClientRect();
        e = Math.min(e, o.left);
        n = Math.max(n, o.right);
        i = Math.min(i, o.top);
        r = Math.max(r, o.bottom);
      });
      if (!Number.isFinite(e)) return null;
      return {
        left: e,
        right: n,
        top: i,
        bottom: r,
        width: n - e,
        height: r - i
      };
    }
    try {
      const t = document.createRange();
      t.selectNodeContents(e);
      const n = t.getBoundingClientRect();
      if (n.width > 0 || n.height > 0) {
        return {
          left: n.left,
          right: n.right,
          top: n.top,
          bottom: n.bottom,
          width: n.width,
          height: n.height
        };
      }
    } catch (e) {}
    const n = e.getBoundingClientRect();
    return {
      left: n.left,
      right: n.right,
      top: n.top,
      bottom: n.bottom,
      width: Math.min(n.width, e.scrollWidth || n.width),
      height: n.height
    };
  }
  function contentFitsFrame(e, t) {
    if (!e || !t) return true;
    const n = document.getElementById("templateVideoPreview");
    const i = n && n.contains(t) ? n : t;
    const r = i.getBoundingClientRect();
    const o = isChannelEl(e);
    const a = isHeaderEl(e);
    const s = o ? 12 : 10;
    const l = a ? 2 : 8;
    const c = o ? 6 : 4;
    const u = getContentRect(e);
    if (!u || u.width <= 0) return true;
    const d = r.width - s * 2;
    if (u.width + c * 2 > d + 1) return false;
    if (u.left - c < r.left + s - 1) return false;
    if (u.right + c > r.right - s + 1) return false;
    if (u.bottom + c > r.bottom - l + 1) return false;
    if (!a && u.top - c < r.top + l - 1) return false;
    return true;
  }
  function headerLineFits(e) {
    if (!e) return true;
    const t = e.querySelector("h1.title, h1");
    const n = e.querySelector('[data-template-element-id="title_channel"]');
    if (t && !contentFitsFrame(t, e)) return false;
    if (n && !contentFitsFrame(n, e)) return false;
    const singleLine = e => {
      if (!e) return true;
      const t = getComputedStyle(e);
      const n = parseFloat(t.lineHeight);
      const i = parseFloat(t.fontSize) || 16;
      const r = Number.isFinite(n) && n > 0 ? n : i * 1.2;
      return e.scrollHeight <= r * 1.65 + 2;
    };
    if (!singleLine(t)) return false;
    if (!singleLine(n)) return false;
    return true;
  }
  function ranksListFits(e) {
    const t = e.querySelector(".ranking-list");
    if (!t) return true;
    const n = e.getBoundingClientRect();
    const i = t.querySelector(".ranked-item:last-child") || t;
    const r = i.getBoundingClientRect().bottom;
    return r <= n.bottom - 4;
  }
  function setElementFontSize(e, t) {
    const n = resolveFontSizeForEl(e, t, {
      headerGroup: V === "group-header"
    });
    const i = clampFontSizeToBounds(e, n);
    e.style.setProperty("font-size", `${i}px`, "important");
    e.classList.add("rk-sized");
    const r = e.getAttribute("data-template-element-id");
    if (r && window.rankingCustomizer?.setElementFontSizeScaled) {
      window.rankingCustomizer.setElementFontSizeScaled(r, i);
    }
    return i;
  }
  function applyHeaderBlockSize(e, t) {
    t = t || {};
    const n = getRankingRoot();
    const i = getHeaderElements();
    const r = getHardSizeCap("header");
    let o = Math.max(le, Math.min(r, Math.round(e)));
    if (!n || !i.length) return o;
    const applyHeaders = e => {
      i.forEach(t => {
        const n = resolveFontSizeForEl(t, e, {
          headerGroup: true
        });
        t.style.setProperty("font-size", `${n}px`, "important");
        t.classList.add("rk-sized");
      });
      const t = n.querySelector("h1.title, h1");
      if (t) {
        t.style.setProperty("font-size", `${e}px`, "important");
        t.classList.add("rk-sized");
      }
    };
    applyHeaders(o);
    if (t.resizing) {
      let e = 40;
      while (e-- > 0 && o > le && !headerLineFits(n)) {
        o -= 1;
        applyHeaders(o);
      }
      return o;
    }
    {
      let e = 50;
      while (e-- > 0 && o > le && !headerLineFits(n)) {
        o -= 1;
        applyHeaders(o);
      }
      const r = n.querySelector('[data-template-element-id="title_channel"]');
      if (r) {
        let e = 36;
        let t = getEffectiveFontSize(r);
        while (e-- > 0 && t > 12 && !channelFitsAtSize(r, t, n)) {
          t -= 1;
          r.style.setProperty("font-size", `${t}px`, "important");
          r.classList.add("rk-sized");
        }
      }
      if (!t.skipStackFit) ensureRankingStackFits();
      if (!t.skipPersist) {
        i.forEach(e => {
          try {
            window.rankingCustomizer?.persistElementStyles?.(e);
          } catch (e) {}
        });
        if (r) {
          try {
            window.rankingCustomizer?.persistElementStyles?.(r);
          } catch (e) {}
        }
      }
    }
    return o;
  }
  function applyRankBlockSize(e, t) {
    t = t || {};
    const n = getRankingRoot();
    const i = getAllRankNumbers();
    const r = getAllRankTitles();
    const o = getHardSizeCap("ranks");
    let a = Math.max(ce, Math.min(o, Math.round(e)));
    let s = t.titlePx != null ? Math.max(ce, Math.min(o, Math.round(t.titlePx))) : Math.max(ce, Math.round(a * .88));
    if (!n || !i.length) return a;
    const applyRanks = (e, t) => {
      i.forEach(t => {
        t.style.setProperty("font-size", `${e}px`, "important");
        t.classList.add("rk-sized");
      });
      (r.length ? r : n.querySelectorAll('[data-template-element-id$="_title"]')).forEach(e => {
        e.style.setProperty("font-size", `${t}px`, "important");
        e.classList.add("rk-sized");
      });
    };
    applyRanks(a, s);
    if (t.resizing) {
      let e = 40;
      while (e-- > 0 && a > ce && !ranksListFits(n)) {
        a -= 1;
        s = Math.max(ce, Math.round(a * .88));
        applyRanks(a, s);
      }
      return a;
    }
    {
      let e = 50;
      while (e-- > 0 && a > ce && !ranksListFits(n)) {
        a -= 1;
        s = Math.max(ce, Math.round(a * .88));
        applyRanks(a, s);
      }
      if (!t.skipStackFit) ensureRankingStackFits();
      if (!t.skipPersist) {
        i.forEach(e => {
          try {
            window.rankingCustomizer?.persistElementStyles?.(e);
          } catch (e) {}
        });
        r.forEach(e => {
          try {
            window.rankingCustomizer?.persistElementStyles?.(e);
          } catch (e) {}
        });
      }
    }
    return a;
  }
  function ensureRankingStackFits() {
    const e = getRankingRoot();
    if (!e) return;
    let t = 40;
    while (t-- > 0 && !ranksListFits(e)) {
      const e = getAllRankNumbers();
      if (!e.length) break;
      const t = getEffectiveFontSize(e[0]);
      if (t <= ce) break;
      applyRankBlockSize(t - 1, {
        skipStackFit: true
      });
    }
    t = 30;
    while (t-- > 0 && (!headerLineFits(e) || !ranksListFits(e))) {
      const e = getHeaderElements();
      const t = getPrimaryHeaderEl() || e[0];
      if (!t) break;
      const n = getEffectiveFontSize(t);
      if (n <= le) break;
      applyHeaderBlockSize(n - 1, {
        skipStackFit: true
      });
    }
  }
  function applyBoundedGroupSize(e, t) {
    if (e.every(e => isHeaderEl(e))) return applyHeaderBlockSize(t);
    if (e.every(e => isRankEl(e))) return applyRankBlockSize(t);
    const n = getRankingRoot();
    const i = getHardSizeCap(e[0]);
    let r = Math.max(10, Math.min(i, Math.round(t)));
    if (!n || !e.length) return r;
    const apply = t => {
      e.forEach(n => {
        const i = resolveFontSizeForEl(n, t, {
          headerGroup: e.every(e => isHeaderEl(e))
        });
        n.style.setProperty("font-size", `${i}px`, "important");
        n.classList.add("rk-sized");
      });
    };
    apply(r);
    const groupOk = () => {
      for (const t of e) {
        if (!contentFitsFrame(t, n)) return false;
      }
      if (e.some(e => isHeaderEl(e)) && !headerLineFits(n)) return false;
      if (e.some(e => isRankEl(e)) && !ranksListFits(n)) return false;
      return true;
    };
    let o = 60;
    while (o-- > 0 && r > 10 && !groupOk()) {
      r -= 1;
      apply(r);
    }
    ensureRankingStackFits();
    return r;
  }
  function clampFontSizeToBounds(e, t) {
    const n = getRankingRoot();
    const i = getHardSizeCap(e);
    const r = isChannelEl(e) ? 12 : isHeaderEl(e) ? le : ce;
    let o = Math.max(r, Math.min(i, Math.round(t)));
    if (!n || !e) return o;
    e.style.setProperty("font-size", `${o}px`, "important");
    e.classList.add("rk-sized");
    let a = 60;
    while (a-- > 0 && o > r) {
      let t = contentFitsFrame(e, n);
      if (t && isChannelEl(e) && !channelFitsAtSize(e, o, n)) t = false;
      if (t && isHeaderEl(e) && !isChannelEl(e) && !headerLineFits(n)) t = false;
      if (t && isRankEl(e) && V !== "group-ranks" && y.size <= 1) {} else if (t && isRankEl(e) && !ranksListFits(n)) {
        t = false;
      }
      if (t) break;
      o -= 1;
      e.style.setProperty("font-size", `${o}px`, "important");
    }
    return o;
  }
  function paintFontDom(e, i) {
    if (!e) return;
    const r = n[i] || `'${i}', sans-serif`;
    e.style.setProperty("font-family", r, "important");
    e.style.setProperty("font-weight", t[i] || "400", "important");
    e.setAttribute("data-rk-font", i);
  }
  function setElementFont(e, t) {
    paintFontDom(e, t);
    const n = e.getAttribute("data-template-element-id");
    if (n && window.rankingCustomizer?.setElementFontFile) {
      window.rankingCustomizer.setElementFontFile(n, t);
    } else if (n && window.rankingCustomizer) {
      if (!window.rankingCustomizer.customizations) {
        window.rankingCustomizer.customizations = {};
      }
      if (!window.rankingCustomizer.customizations[n]) {
        window.rankingCustomizer.customizations[n] = {};
      }
      const e = {
        "Luckiest Guy": "LuckiestGuy-Regular.ttf",
        "Bebas Neue": "BebasNeue-Regular.ttf",
        Anton: "Anton-Regular.ttf",
        Montserrat: "Montserrat-Bold.ttf",
        Poppins: "Poppins-SemiBold.ttf",
        Roboto: "Roboto-Bold.ttf",
        Fredoka: "Fredoka-Bold.ttf"
      };
      window.rankingCustomizer.customizations[n].font = e[t] || t;
    }
    try {
      window.rankingCustomizer?.persistElementStyles?.(e);
    } catch (e) {}
  }
  function applyFontChange(e, t) {
    if (!t.length) return;
    const n = t.every(e => isHeaderEl(e));
    const i = t.every(e => isRankEl(e) || isRankTitleEl(e));
    const r = t.length > 1 && (n || i);
    if (r) {
      const i = n ? getPrimaryHeaderEl() || t.find(e => !isChannelEl(e)) || t[0] : t[0];
      const r = L && R != null ? R : getEffectiveFontSize(i);
      t.forEach(t => setElementFont(t, e));
      R = applyBoundedGroupSize(t, r);
      L = true;
      return;
    }
    t.forEach(t => {
      const n = getEffectiveFontSize(t);
      setElementFont(t, e);
      setElementFontSize(t, n);
    });
    const o = t[0];
    if (o) {
      R = getEffectiveFontSize(o);
      L = true;
    }
  }
  function setElementShadow(e, t) {
    if (t === "none") {
      e.classList.remove("text-stroke");
      e.style.setProperty("text-shadow", "none", "important");
    } else {
      const n = t === "stroke" ? "outline" : t;
      e.classList.add("text-stroke");
      e.style.setProperty("text-shadow", shadowCss(n, S), "important");
    }
    const n = e.getAttribute("data-template-element-id");
    if (n && window.rankingCustomizer?.setElementStrokeStyle) {
      const e = t === "stroke" ? "outline" : t || "outline";
      window.rankingCustomizer.setElementStrokeStyle(n, e);
      try {
        const t = window.rankingCustomizer.customizations?.[n];
        const i = window.rankingCustomizer._colorToRgba?.(S);
        if (t && i && e !== "none") t.outline_color = i;
      } catch (e) {}
    }
    try {
      window.rankingCustomizer?.persistElementStyles?.(e);
    } catch (e) {}
  }
  function applyAllStyles(e) {
    const t = resolveApplyTargets();
    t.forEach(e => {
      if (M) setElementFont(e, b);
      if (L && R) setElementFontSize(e, R);
      if (F) e.style.color = w;
      if (P) setElementShadow(e, x);
    });
    syncColorSwatches();
    if (e !== false && window.rankingCustomizer) {
      window.rankingCustomizer.syncFromDOM();
    }
  }
  function applyTextColor(e, t) {
    if (A && _?.isConnected) {
      _.style.color = normalizeHex(e) || e;
      discardColorPreview();
      z = "text";
      w = e;
      if (t !== false) F = true;
      syncColorSwatches();
      if (t !== false) markLibraryRankingDirty();
      return;
    }
    if (A) discardColorPreview();
    z = "text";
    w = e;
    if (t !== false) F = true;
    const n = getInlineEditSelection();
    if (n) {
      colorSelectionRange(n.range, e);
      syncColorSwatches();
      if (t !== false) markLibraryRankingDirty();
      return;
    }
    resolveApplyTargets().forEach(n => {
      n.style.color = e;
      const i = n.getAttribute("data-template-element-id");
      if (t !== false && i && window.rankingCustomizer?.setElementColor) {
        window.rankingCustomizer.setElementColor(i, e);
      }
      if (t !== false) {
        try {
          window.rankingCustomizer?.persistElementStyles?.(n);
        } catch (e) {}
      }
    });
    syncColorSwatches();
    if (t !== false && window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    if (t !== false) markLibraryRankingDirty();
    if (t !== false) maybeOfferStyleSuggest(resolveApplyTargets(), {
      color: e
    });
  }
  function beginFontPreviewSession(e) {
    if (!I) {
      Y = e;
      e.forEach(e => snapshotEl(e));
      I = true;
    }
  }
  function previewFont(e) {
    if (q || !y.size) return;
    const t = resolveApplyTargets();
    beginFontPreviewSession(t);
    t.forEach(t => paintFontDom(t, e));
  }
  function resetFontPreview() {
    if (q || !I) return;
    I = false;
    Y.forEach(e => restoreSnapshot(e));
    Y = [];
  }
  function applyFont(e) {
    b = e;
    M = true;
    const t = resolveApplyTargets();
    I = false;
    Y = [];
    applyFontChange(e, t);
    t.forEach(e => snapshotEl(e));
    syncFontDdHighlight(e);
    if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    markLibraryRankingDirty();
    closeDD();
    showMenu();
    const n = t.slice();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        maybeOfferStyleSuggest(n, {
          font: e
        });
      });
    });
    if (t.some(isHeaderEl)) syncTopPanelToHeader();
  }
  function applyShadow(e) {
    x = e || "outline";
    P = true;
    const t = resolveApplyTargets();
    t.forEach(e => {
      setElementShadow(e, x);
      snapshotEl(e);
    });
    syncShadowSeg();
    if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    maybeOfferStyleSuggest(t, {
      shadow: x
    });
    markLibraryRankingDirty();
  }
  function clearSuggest(e) {
    X.forEach(e => e.remove());
    X = [];
    J = null;
    if (Q) {
      clearTimeout(Q);
      Q = 0;
    }
    ee += 1;
    if (m) {
      m.classList.remove("open");
      m.style.visibility = "";
      m.style.opacity = "";
      m.style.pointerEvents = "";
    }
    document.querySelectorAll(".rk-suggest-receive,.rk-suggest-remove").forEach(e => {
      e.classList.remove("rk-suggest-receive", "rk-suggest-remove");
    });
    document.querySelectorAll(".rk-ghost-stack").forEach(e => e.remove());
    if (e?.persistReject) {
      startSuggestCooldown(Math.max(te, 12e3));
    }
  }
  function sampleStyleFromLive(e, t) {
    const n = e ? getComputedStyle(e) : null;
    const i = e ? normalizeColorValue(e.style.color) || normalizeColorValue(n?.color) || "#ffffff" : "#ffffff";
    const r = e ? e.style.textShadow && e.style.textShadow !== "none" ? e.style.textShadow : getShadowCssForType(getElShadowType(e)) : getShadowCssForType("stroke");
    return {
      color: t.color || i || "#ffffff",
      textShadow: t.shadow ? getShadowCssForType(t.shadow) : r === "none" ? "-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000" : r
    };
  }
  function startSuggestCooldown(e = te) {
    K = Date.now() + e;
  }
  function canOfferSuggest() {
    if (Date.now() < K) return false;
    return true;
  }
  function fontsDiffer(e, t) {
    if (!t) return false;
    if (!e) return true;
    const strip = e => String(e || "").replace(/['"]/g, "").split(",")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(regular|bold|semibold|medium|light|black|ttf|otf|woff2?)$/g, "");
    const n = strip(e);
    const i = strip(t);
    if (!n || !i) return n !== i;
    if (n === i) return false;
    if (n.includes(i) || i.includes(n)) return false;
    return true;
  }
  function getShadowCssForType(e) {
    if (e === "none") return "none";
    return shadowCss(e === "stroke" ? "outline" : e, S);
  }
  function getElShadowType(e) {
    const t = e.style.textShadow;
    if (t && t !== "none") {
      if (t.includes("3px 0") || t.includes("3px 0px")) return "thick-outline";
      return "outline";
    }
    if (e.classList.contains("text-stroke") || e.closest(".text-stroke")) return "outline";
    return "none";
  }
  function normalizeColorValue(e) {
    if (!e) return "";
    const t = rgbToHex(e);
    return String(t || e).trim().toLowerCase();
  }
  function getElColor(e) {
    return normalizeColorValue(e.style.color || getComputedStyle(e).color);
  }
  function isPlaceholderLabel(e) {
    const t = String(e || "").replace(/\s+/g, " ").trim().toLowerCase();
    return !t || t === "text" || t === "aa" || t === "#" || t === "…" || t === "...";
  }
  function sampleLabelForEl(e) {
    const t = String(e?.textContent || "").replace(/\s+/g, " ").trim();
    if (t && !isPlaceholderLabel(t)) {
      return t.length > 36 ? `${t.slice(0, 35)}…` : t;
    }
    if (isRankEl(e)) {
      const t = String(e?.getAttribute?.("data-template-element-id") || "").match(/^rank_(\d+)_number$/);
      return t ? `${t[1]}.` : "#";
    }
    if (isRankTitleEl(e)) return "";
    return t && !isPlaceholderLabel(t) ? t : "";
  }
  function ghostSourcesForRankSide(e) {
    const t = e.filter(isRankEl);
    if (t.length) return t;
    return e.filter(e => {
      if (!isRankTitleEl(e)) return true;
      return !isPlaceholderLabel(e?.textContent);
    });
  }
  function counterpartFor(e) {
    if (!e.length) return null;
    if (e.every(e => isHeaderEl(e))) {
      return getAllRankSideElements();
    }
    if (e.every(e => isRankSideEl(e))) {
      return getHeaderElements();
    }
    if (e.some(isRankSideEl) && !e.some(isHeaderEl)) {
      return getHeaderElements();
    }
    if (e.some(isHeaderEl) && !e.some(isRankSideEl)) {
      return getAllRankSideElements();
    }
    return null;
  }
  function resizeSuggestTargets(e, t) {
    const n = new Set(e.filter(Boolean));
    if (!n.size) return [];
    const i = [];
    const pushIfNeeded = e => {
      if (!e?.isConnected || n.has(e)) return;
      if (!i.includes(e)) i.push(e);
    };
    const r = getAllRankNumbers();
    const o = getAllRankTitles();
    const a = getHeaderElements();
    const s = [ ...n ].some(isRankEl);
    const l = [ ...n ].some(isRankTitleEl);
    const c = [ ...n ].some(isHeaderEl);
    if (t === "counterpart") {
      if ((s || l) && !c) return getHeaderElements();
      if (c && !s && !l) {
        return getAllRankSideElements();
      }
      return [];
    }
    if (s) r.forEach(pushIfNeeded);
    if (l) o.forEach(pushIfNeeded);
    if (c) a.forEach(pushIfNeeded);
    return i;
  }
  function editedSizeGroup(e) {
    if (e.every(e => isRankEl(e))) return "ranks";
    if (e.every(e => isRankTitleEl(e))) return "rankTitles";
    if (e.every(e => isHeaderEl(e))) return "header";
    if (e.some(isRankSideEl)) return "ranks";
    return "header";
  }
  function comfortableSizeForTarget(e, t, n) {
    const i = isRankEl(e) ? "ranks" : "header";
    const r = getHardSizeCap(e || i);
    const clamp = t => Math.max(isChannelEl(e) ? 12 : i === "ranks" ? ce : le, Math.min(r, Math.round(t)));
    if (!e) return clamp(t);
    if (n === "header") {
      if (isRankEl(e)) return clamp(t * .92);
      if (isChannelEl(e)) {
        let n = clamp(t * oe);
        const i = getRankingRoot();
        let r = 24;
        while (r-- > 0 && n > 12 && !channelFitsAtSize(e, n, i)) n -= 1;
        return n;
      }
      return clamp(t);
    }
    if (isRankEl(e)) return clamp(t);
    if (isChannelEl(e)) {
      let n = clamp(t * oe);
      const i = getRankingRoot();
      let r = 24;
      while (r-- > 0 && n > 12 && !channelFitsAtSize(e, n, i)) n -= 1;
      return n;
    }
    if (isHeaderEl(e)) return clamp(t);
    return clamp(t);
  }
  function sizeNeedsApply(e, t, n) {
    return e.some(e => {
      if (!e?.isConnected) return false;
      const i = comfortableSizeForTarget(e, t, n);
      return Math.abs(getEffectiveFontSize(e) - i) > 1.5;
    });
  }
  function propsNeedApply(e, t) {
    return e.some(e => {
      if (!e?.isConnected) return false;
      if (t.font && fontsDiffer(getElFontName(e), t.font)) return true;
      if (t.color && getElColor(e) !== normalizeColorValue(t.color)) return true;
      if (t.size != null) {
        const n = t.fromGroup || "header";
        const i = t.comfortable ? comfortableSizeForTarget(e, t.size, n) : t.size;
        if (Math.abs(getEffectiveFontSize(e) - i) > 1.5) return true;
      }
      if (t.shadow && getElShadowType(e) !== t.shadow) return true;
      return false;
    });
  }
  function scheduleResizeSuggest(e, t, n) {
    if (!e?.length || n == null) return;
    if (Math.abs(n - t) < 1) return;
    if (!canOfferSuggest()) return;
    if (Q) clearTimeout(Q);
    const i = ++ee;
    const r = e.filter(e => e?.isConnected);
    const o = n;
    Q = setTimeout(() => {
      Q = 0;
      if (i !== ee) return;
      if (!canOfferSuggest()) return;
      const e = r.filter(e => e?.isConnected);
      if (!e.length) return;
      const t = resizeSuggestTargets(e, "siblings");
      const n = editedSizeGroup(e);
      if (t.length && sizeNeedsApply(t, o, n)) {
        const i = resizeSuggestTargets(e, "counterpart");
        const r = i.length && sizeNeedsApply(i, o, n) ? {
          size: o,
          comfortable: true,
          fromGroup: n,
          targets: i
        } : null;
        offerStyleSuggest({
          size: o,
          comfortable: true,
          fromGroup: n,
          chain: r
        }, t);
        return;
      }
      const a = resizeSuggestTargets(e, "counterpart");
      if (!a.length) return;
      if (!sizeNeedsApply(a, o, n)) return;
      offerStyleSuggest({
        size: o,
        comfortable: true,
        fromGroup: n
      }, a);
    }, re);
  }
  function layoutGhosts() {
    if (!J) return;
    const {props: e, targets: i} = J;
    X.forEach(e => e.remove());
    X = [];
    const r = i.filter(e => e.isConnected);
    if (!r.length) return;
    document.querySelectorAll(".rk-suggest-receive,.rk-suggest-remove").forEach(e => {
      e.classList.remove("rk-suggest-receive", "rk-suggest-remove");
    });
    const o = r.every(e => isRankSideEl(e));
    const a = r.every(e => isHeaderEl(e));
    const s = r.some(isRankSideEl) && r.some(isHeaderEl);
    if (s) {
      getRanksZone()?.classList.add("rk-suggest-remove");
      getHeaderZone()?.classList.add("rk-suggest-remove");
    } else if (o) {
      getRanksZone()?.classList.add("rk-suggest-remove");
    } else if (a) {
      getHeaderZone()?.classList.add("rk-suggest-remove");
    } else {
      r.forEach(e => e.classList.add("rk-suggest-remove"));
    }
    const l = r.map(e => e.getBoundingClientRect());
    const c = Math.min(...l.map(e => e.top));
    const u = Math.max(...l.map(e => e.bottom));
    const d = Math.min(...l.map(e => e.left));
    const p = (c + u) / 2;
    const g = 12;
    const y = document.createElement("div");
    y.className = "rk-ghost-stack";
    y.setAttribute("aria-hidden", "true");
    y.style.top = "-9999px";
    y.style.left = "-9999px";
    const w = e.font || getElFontName(r[0]) || b || "Montserrat";
    const v = e.fromGroup || editedSizeGroup(r);
    function styleGhostLine(i, r) {
      const o = sampleStyleFromLive(r, e);
      const a = e.font || getElFontName(r) || w;
      i.style.fontFamily = n[a] || `'${a}', sans-serif`;
      i.style.fontWeight = t[a] || t[w] || "700";
      const s = e.size != null ? e.comfortable ? comfortableSizeForTarget(r, e.size, v) : e.size : Math.round(parseFloat(getComputedStyle(r).fontSize) || 22);
      i.style.fontSize = `${Math.max(11, Math.min(s, ae))}px`;
      i.style.color = o.color;
      i.style.background = "transparent";
      i.style.textShadow = o.textShadow;
    }
    if (a) {
      const e = r.find(e => e.getAttribute("data-template-element-id") === "title_ranking");
      const t = r.find(e => e.getAttribute("data-template-element-id") === "title_funniest");
      const n = r.find(e => isChannelEl(e));
      const i = document.createElement("div");
      i.className = "rk-ghost-title-row";
      [ e, t ].filter(Boolean).forEach(e => {
        const t = document.createElement("span");
        t.className = "rk-ghost-line";
        const n = sampleLabelForEl(e);
        if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(t, n); else t.textContent = n;
        styleGhostLine(t, e);
        i.appendChild(t);
      });
      if (i.childNodes.length) y.appendChild(i);
      if (n) {
        const e = document.createElement("span");
        e.className = "rk-ghost-line rk-ghost-channel";
        const t = sampleLabelForEl(n);
        if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(e, t); else e.textContent = t;
        styleGhostLine(e, n);
        y.appendChild(e);
      }
      if (!y.childNodes.length) {
        r.forEach(e => {
          const t = document.createElement("span");
          t.className = "rk-ghost-line";
          const n = sampleLabelForEl(e);
          if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(t, n); else t.textContent = n;
          styleGhostLine(t, e);
          y.appendChild(t);
        });
      }
    } else {
      const e = o ? ghostSourcesForRankSide(r) : r;
      e.forEach(e => {
        const t = sampleLabelForEl(e);
        if (!t) return;
        const n = document.createElement("span");
        n.className = "rk-ghost-line";
        if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(n, t); else n.textContent = t;
        styleGhostLine(n, e);
        y.appendChild(n);
      });
      if (!y.childNodes.length) return;
    }
    document.body.appendChild(y);
    X.push(y);
    try {
      if (window.__SolisSG?.harden) window.__SolisSG.harden(y);
      if (m && window.__SolisSG?.harden) window.__SolisSG.harden(m);
    } catch (e) {}
    const x = y.offsetHeight || 40;
    const S = y.offsetWidth || 80;
    let E = Math.round(d - S - g);
    let z = Math.round(p - x / 2);
    z = Math.max(8, Math.min(z, window.innerHeight - x - 8));
    if (E < 8) E = 8;
    y.style.left = `${E}px`;
    y.style.top = `${z}px`;
    requestAnimationFrame(() => {
      if (!J || !y.isConnected) return;
      posSuggestActions(y);
    });
  }
  function posSuggestActions(e) {
    if (!m) return;
    if (m.parentElement !== document.body) {
      document.body.appendChild(m);
    }
    m.classList.add("open");
    m.style.visibility = "visible";
    m.style.opacity = "1";
    m.style.pointerEvents = "auto";
    const t = Array.from(document.querySelectorAll(".rk-suggest-remove")).filter(e => e.isConnected);
    let n = null;
    if (t.length) {
      let e = Infinity;
      let i = Infinity;
      let r = -Infinity;
      let o = -Infinity;
      t.forEach(t => {
        const n = t.getBoundingClientRect();
        e = Math.min(e, n.left);
        i = Math.min(i, n.top);
        r = Math.max(r, n.right);
        o = Math.max(o, n.bottom);
      });
      if (Number.isFinite(e)) {
        n = {
          left: e,
          top: i,
          right: r,
          bottom: o,
          width: r - e,
          height: o - i
        };
      }
    }
    if (!n && e?.isConnected) {
      const t = e.getBoundingClientRect();
      n = {
        left: t.left,
        top: t.top,
        right: t.right,
        bottom: t.bottom,
        width: t.width,
        height: t.height
      };
    }
    if (!n) return;
    const i = Math.max(m.offsetWidth || 0, 64);
    const r = Math.max(m.offsetHeight || 0, 34);
    const o = 8;
    const a = 10;
    const s = window.innerWidth;
    const l = window.innerHeight;
    const c = document.getElementById("templateVideoPreview")?.getBoundingClientRect?.() || null;
    const u = [ {
      left: n.right - i,
      top: n.top - r - o,
      pref: 100
    }, {
      left: n.right - i + 4,
      top: n.top - r - o,
      pref: 96
    }, {
      left: n.left + (n.width - i) / 2,
      top: n.top - r - o,
      pref: 88
    }, {
      left: n.right + o,
      top: n.top + (n.height - r) / 2,
      pref: 82
    }, {
      left: n.right - i,
      top: n.bottom + o,
      pref: 74
    }, {
      left: n.left - i - o,
      top: n.top + (n.height - r) / 2,
      pref: 62
    }, {
      left: n.left + (n.width - i) / 2,
      top: n.bottom + o,
      pref: 55
    } ];
    const overlapsRed = (e, t) => {
      const o = {
        left: e,
        top: t,
        right: e + i,
        bottom: t + r
      };
      const a = Math.max(0, Math.min(o.right, n.right) - Math.max(o.left, n.left));
      const s = Math.max(0, Math.min(o.bottom, n.bottom) - Math.max(o.top, n.top));
      return a * s / Math.max(1, i * r);
    };
    let d = null;
    let p = -Infinity;
    u.forEach(e => {
      let t = Math.round(e.left);
      let o = Math.round(e.top);
      t = Math.max(a, Math.min(t, s - i - a));
      o = Math.max(a, Math.min(o, l - r - a));
      let u = e.pref;
      if (e.left < a || e.left + i > s - a) u -= 25;
      if (e.top < a || e.top + r > l - a) u -= 25;
      if (c) {
        const e = t + i / 2;
        const n = o + r / 2;
        const a = e >= c.left - 12 && e <= c.right + 12 && n >= c.top - 20 && n <= c.bottom + 20;
        u += a ? 18 : -12;
      }
      const g = overlapsRed(t, o);
      u -= g * 80;
      const m = t + i / 2 - (n.left + n.width / 2);
      const y = o + r / 2 - (n.top + n.height / 2);
      u -= Math.min(40, Math.hypot(m, y) / 12);
      if (u > p) {
        p = u;
        d = {
          left: t,
          top: o
        };
      }
    });
    if (!d) {
      d = {
        left: Math.max(a, Math.min(Math.round(n.right - i), s - i - a)),
        top: Math.max(a, Math.min(Math.round(n.top - r - o), l - r - a))
      };
    }
    m.style.left = `${d.left}px`;
    m.style.top = `${d.top}px`;
    m.style.transform = "none";
    m.style.zIndex = "99870";
  }
  function offerStyleSuggest(e, t) {
    clearSuggest();
    if (!t.length || !e || !Object.keys(e).length) return;
    try {
      closeDD();
    } catch (e) {}
    J = {
      props: {
        ...e
      },
      targets: [ ...t ]
    };
    layoutGhosts();
    if (y.size) {
      try {
        showMenu();
        schedulePosMenu();
      } catch (e) {}
    }
  }
  function acceptSuggest() {
    if (!J) return;
    const {props: e, targets: t} = J;
    const n = e.chain || null;
    const i = t.filter(e => e?.isConnected);
    if (e.font) {
      applyFontChange(e.font, i);
      M = true;
      b = e.font;
    }
    if (e.color) {
      i.forEach(t => {
        t.style.color = e.color;
      });
      F = true;
      w = e.color;
    }
    if (e.shadow) {
      i.forEach(t => setElementShadow(t, e.shadow));
      P = true;
      x = e.shadow;
    }
    if (e.size != null) {
      L = true;
      const t = e.fromGroup || editedSizeGroup(i);
      if (e.comfortable) {
        i.forEach(n => {
          const i = comfortableSizeForTarget(n, e.size, t);
          setElementFontSize(n, i);
        });
        const n = i.find(e => isHeaderEl(e) && !isChannelEl(e)) || i.find(isRankEl) || i[0];
        R = n ? getEffectiveFontSize(n) : e.size;
      } else if (i.every(e => isRankEl(e)) || i.every(e => isHeaderEl(e))) {
        R = applyBoundedGroupSize(i, e.size);
      } else {
        i.forEach(t => setElementFontSize(t, e.size));
        R = e.size;
      }
    }
    clearSuggest();
    if (n?.targets?.length) {
      const e = n.targets.filter(e => e?.isConnected);
      const t = {
        ...n
      };
      delete t.targets;
      delete t.chain;
      if (e.length && propsNeedApply(e, t)) {
        setTimeout(() => {
          offerStyleSuggest(t, e);
        }, 280);
        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        if (i.some(isHeaderEl)) syncTopPanelToHeader();
        return;
      }
    }
    startSuggestCooldown(ne);
    if (y.size) {
      try {
        showMenu();
        schedulePosMenu();
      } catch (e) {}
    }
    if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
    if (i.some(isHeaderEl)) syncTopPanelToHeader();
  }
  function maybeOfferStyleSuggest(e, t) {
    if (!e?.length || !t || !Object.keys(t).length) return;
    if (!canOfferSuggest()) return;
    try {
      buildUI();
    } catch (e) {}
    const n = resizeSuggestTargets(e, "siblings");
    const i = resizeSuggestTargets(e, "counterpart");
    const r = n.length > 0 && propsNeedApply(n, t);
    const o = i.length > 0 && propsNeedApply(i, t);
    const a = !!(t.font || t.color || t.shadow);
    let s = null;
    if (a && o) {
      s = "counterpart";
    } else if (r) {
      s = "siblings";
    } else if (o) {
      s = "counterpart";
    }
    if (!s && a && i.length && t.font) {
      if (i.some(e => fontsDiffer(getElFontName(e), t.font))) {
        s = "counterpart";
      }
    } else if (!s && n.length && t.font) {
      if (n.some(e => fontsDiffer(getElFontName(e), t.font))) {
        s = "siblings";
      }
    }
    if (!s) return;
    const l = s === "counterpart" ? i : n;
    if (!l.length) return;
    const c = {
      ...t
    };
    if (s === "siblings" && o && i.length) {
      c.chain = {
        ...t,
        targets: i,
        fromGroup: t.fromGroup || editedSizeGroup(e)
      };
    } else if (s === "counterpart" && r && n.length) {
      c.chain = {
        ...t,
        targets: n,
        fromGroup: t.fromGroup || editedSizeGroup(e)
      };
    }
    offerStyleSuggest(c, l);
  }
  function rectsOverlap(e, t, n = 6) {
    return !(e.right + n <= t.left || e.left - n >= t.right || e.bottom + n <= t.top || e.top - n >= t.bottom);
  }
  function getAnchorBounds() {
    const e = W && W.isConnected ? W : y.values().next().value;
    if (e?.isConnected) {
      const t = e.getBoundingClientRect();
      if (t.width > 0 || t.height > 0) {
        return {
          left: t.left,
          top: t.top,
          right: t.right,
          bottom: t.bottom,
          width: t.width,
          height: t.height
        };
      }
    }
    const t = V === "group-header" || W && isHeaderEl(W) ? getHeaderZone() : getRanksZone();
    if (t?.isConnected) {
      const e = t.getBoundingClientRect();
      if (e.width > 0 || e.height > 0) {
        return {
          left: e.left,
          top: e.top,
          right: e.right,
          bottom: e.bottom,
          width: e.width,
          height: e.height
        };
      }
    }
    return null;
  }
  function posMenu() {
    if (!y.size || !d) return;
    const e = d.offsetWidth || 100;
    const t = d.offsetHeight || 44;
    const n = 8;
    const i = 10;
    const r = {
      w: window.innerWidth,
      h: window.innerHeight
    };
    const o = getAnchorBounds();
    if (!o) {
      const t = getRankingRoot();
      const o = t?.getBoundingClientRect?.();
      if (o) {
        d.style.left = `${Math.round(Math.max(i, Math.min(o.right + n, r.w - e - i)))}px`;
        d.style.top = `${Math.round(Math.max(i, o.top + 24))}px`;
      }
      return;
    }
    let a;
    let s;
    if (r.w <= 768) {
      a = o.left + (o.width - e) / 2;
      s = o.top - t - n;
      if (s < i) s = o.bottom + n;
      if (s + t > r.h - i) s = Math.max(i, r.h - t - i);
    } else {
      a = o.right + n;
      s = o.top - t - n;
      if (a + e > r.w - i) a = Math.max(i, o.left - e - n);
      if (s < i) s = i;
      if (s + t > r.h - i) s = Math.max(i, r.h - t - i);
    }
    a = Math.max(i, Math.min(a, r.w - e - i));
    s = Math.max(i, Math.min(s, r.h - t - i));
    const l = {
      left: a,
      top: s,
      right: a + e,
      bottom: s + t
    };
    const c = !(l.right <= o.left - 4 || l.left >= o.right + 4 || l.bottom <= o.top - 4 || l.top >= o.bottom + 4);
    if (c) {
      s = o.top - t - n;
      if (s < i) s = o.bottom + n;
      s = Math.max(i, Math.min(s, r.h - t - i));
    }
    d.style.left = `${Math.round(a)}px`;
    d.style.top = `${Math.round(s)}px`;
    placeOpenDd();
  }
  function placeOpenDd() {
    if (!d) return;
    let e = null;
    let t = null;
    if (p?.classList.contains("open")) {
      e = p;
      t = document.getElementById("rkBtnFont");
    } else if (g?.classList.contains("open")) {
      e = g;
      t = document.getElementById("rkBtnColor");
    }
    if (!e || !t) return;
    const n = d.getBoundingClientRect();
    const i = e.offsetWidth || 220;
    const r = e.offsetHeight || 200;
    const o = {
      w: window.innerWidth,
      h: window.innerHeight
    };
    const a = 10;
    const s = document.getElementById("templateVideoPreview");
    const l = s?.getBoundingClientRect();
    let c;
    if (l) {
      c = l.right + a;
      if (c + i > o.w - 12) {
        c = Math.max(12, Math.min(l.left - i - a, o.w - i - 12));
      }
    } else {
      c = t.getBoundingClientRect().left;
      if (c + i > o.w - 10) c = o.w - i - 10;
      if (c < 10) c = 10;
    }
    let u = n.bottom + a;
    if (l) u = Math.max(12, Math.min(u, l.top + 8));
    if (u + r > o.h - 12) u = Math.max(12, o.h - r - 12);
    e.style.top = `${Math.round(u)}px`;
    e.style.left = `${Math.round(c)}px`;
  }
  function schedulePosMenu() {
    if (U) return;
    U = requestAnimationFrame(() => {
      U = 0;
      if (d?.classList.contains("active")) posMenu();
      try {
        syncTopPanelToHeader({
          liveOnly: true
        });
      } catch (e) {}
      if (J && X[0]) {
        layoutGhosts();
      }
    });
  }
  function hideMenu() {
    d?.classList.remove("active");
    if (d) {
      d.style.opacity = "";
      d.style.visibility = "";
      d.style.pointerEvents = "";
    }
    closeDD();
  }
  try {
    window.hideRankingTextPill = hideMenu;
  } catch (e) {}
  function openDD(e, t) {
    closeDD(e);
    e.classList.add("open");
    const n = d.getBoundingClientRect();
    const i = e.offsetWidth || 220;
    const r = e.offsetHeight || 200;
    const o = {
      w: window.innerWidth,
      h: window.innerHeight
    };
    let a = n.bottom + 8;
    if (a + r > o.h - 20) a = n.top - r - 8;
    a = Math.max(8, Math.min(a, o.h - r - 8));
    let s = t.getBoundingClientRect().left;
    if (s + i > o.w - 10) s = o.w - i - 10;
    if (s < 10) s = 10;
    e.style.top = `${a}px`;
    e.style.left = `${s}px`;
  }
  function closeDD(e) {
    if (!e || e !== p) resetFontPreview();
    if (!e || e !== g) {
      endColorPreview();
      closePlusPop();
    }
    [ p, g ].forEach(t => {
      if (!t || t === e) return;
      t.classList.remove("open");
    });
    d?.querySelectorAll(".sub-pill-btn").forEach(e => e.classList.remove("sub-active"));
  }
  function showMenu() {
    if (!y.size) return;
    buildUI();
    if (!d) return;
    try {
      window.solisClosePeerPreviewChrome?.("rk");
    } catch (e) {}
    d.classList.add("active");
    d.style.opacity = "1";
    d.style.visibility = "visible";
    d.style.pointerEvents = "auto";
    d.style.zIndex = "99900";
    posMenu();
    requestAnimationFrame(() => {
      if (y.size && d?.classList.contains("active")) posMenu();
    });
  }
  function wireButtons() {
    document.getElementById("rkBtnFont")?.addEventListener("click", e => {
      e.stopPropagation();
      const t = p.classList.contains("open");
      closeDD();
      if (!t) {
        I = false;
        y.forEach(e => snapshotEl(e));
        buildFontList();
        openDD(p, e.currentTarget);
        syncFontDdHighlight(b);
        e.currentTarget.classList.add("sub-active");
      } else {
        resetFontPreview();
      }
    });
    document.getElementById("rkBtnColor")?.addEventListener("click", e => {
      e.stopPropagation();
      const t = g.classList.contains("open");
      closeDD();
      if (!t) {
        openDD(g, e.currentTarget);
        e.currentTarget.classList.add("sub-active");
        syncFillSwatches();
        syncTopBgVisibility();
        syncBlankBgVisibility();
        syncTopModeButtons();
        syncOutlineColSwatches();
        applyRankingTopPanel();
      }
    });
    document.getElementById("rkSuggestAccept")?.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      acceptSuggest();
    });
    document.getElementById("rkSuggestDismiss")?.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      clearSuggest({
        persistReject: true
      });
    });
    document.addEventListener("keydown", e => {
      if (!J) return;
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        acceptSuggest();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearSuggest({
          persistReject: true
        });
      }
    });
    document.addEventListener("mousedown", e => {
      if (e.target.closest("#rkSuggestActions")) return;
      if (!d?.classList.contains("active")) return;
      if (e.target.closest(".sub-resize-handle")) return;
      if (d.contains(e.target) || p.contains(e.target) || g.contains(e.target)) return;
      if (e.target.closest("[data-template-element-id]")) return;
      if (e.target.closest(".ranking-editor-zone-header, .ranking-editor-zone-ranks")) return;
      if (e.target.closest(".ranking-preview-container")) {
        deselectAll();
        return;
      }
      deselectAll();
    }, true);
    window.addEventListener("resize", schedulePosMenu);
    window.addEventListener("scroll", schedulePosMenu, true);
  }
  function deselectAll() {
    y.forEach(e => {
      e.contentEditable = "false";
    });
    y.clear();
    Z.clear();
    V = "single";
    W = null;
    j = null;
    clearSelectionVisuals();
    syncResizeHandles();
    hideMenu();
    if (window.customizer?.closeCustomizer) window.customizer.closeCustomizer();
  }
  function resetSession() {
    clearSuggest();
    deselectAll();
  }
  function selectElements(e, t = "single", n = null, i = null) {
    buildUI();
    const r = normalizeSelectionElements(e, t);
    if (J) {
      clearSuggest();
    }
    y.forEach(e => {
      e.contentEditable = "false";
    });
    y.clear();
    Z.clear();
    V = t;
    W = n || (r.length === 1 ? r[0] : null);
    if (i) j = i;
    r.forEach(e => {
      if (!e?.isConnected) return;
      y.add(e);
      snapshotEl(e);
    });
    applySelectionVisuals();
    showMenu();
    M = false;
    F = false;
    C = false;
    P = false;
    L = false;
    const finishSelectChrome = () => {
      syncResizeHandles();
      hideSubtitleGuidesOverRanking();
      const e = t === "group-header" ? getPrimaryHeaderEl() || W || r[0] : W || r[0];
      if (e) readStateFromEl(e);
      syncColorSwatches();
      syncFillSwatches();
      syncTopBgVisibility();
      syncTopModeButtons();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(finishSelectChrome);
    } else {
      finishSelectChrome();
    }
  }
  function finishMultiSelection(e) {
    V = y.size > 1 ? "multi" : "single";
    W = e || y.values().next().value || null;
    applySelectionVisuals();
    syncResizeHandles();
    hideSubtitleGuidesOverRanking();
    syncTopBgVisibility();
    showMenu();
    return W;
  }
  function toggleElement(e, t, n) {
    buildUI();
    if (J) {
      clearSuggest();
    }
    if (n) j = n;
    if (!t) {
      if (y.has(e) && y.size === 1 && V === "single") return e;
      selectElements([ e ], "single", e, n);
      return e;
    }
    if (V === "group-ranks" || V === "group-header") {
      y.clear();
      Z.clear();
      y.add(e);
      snapshotEl(e);
      return finishMultiSelection(e);
    }
    if (y.has(e)) {
      y.delete(e);
      if (!y.size) {
        deselectAll();
        return null;
      }
      return finishMultiSelection(y.values().next().value || null);
    }
    y.add(e);
    snapshotEl(e);
    return finishMultiSelection(e);
  }
  window.RankingTextPill = {
    init: buildUI,
    selectElements: selectElements,
    toggleElement: toggleElement,
    deselectAll: deselectAll,
    resetSession: resetSession,
    hide: hideMenu,
    reposition: posMenu,
    clearSuggest: clearSuggest,
    acceptSuggest: acceptSuggest,
    applyTopPanel: applyRankingTopPanel,
    getLayout: getRankingLayout,
    seedDefaultSizes: seedDefaultPreviewSizes,
    isActive: e => y.has(e),
    hasSelection: () => y.size > 0,
    getSelectionMode: () => V,
    getSelectionAnchor: () => W,
    getGroupAnchor: () => W,
    consumeRankPointerClick: consumeRankPointerClick,
    getAllRankNumbers: getAllRankNumbers,
    getAllRankTitles: getAllRankTitles,
    getAllRankSideElements: getAllRankSideElements,
    getHeaderElements: getHeaderElements,
    getAllTextElements: getAllTextElements
  };
})();
