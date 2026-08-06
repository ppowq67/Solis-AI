class RankingTemplateEditor {
  constructor(e) {
    this.container = e;
    this._abort = new AbortController;
    this.init();
  }
  destroy() {
    try {
      this._abort?.abort();
    } catch (e) {}
    this._abort = null;
  }
  init() {
    window.RankingTextPill?.init();
    window.RankingTextPill?.resetSession?.();
    this.ensureZones();
    this.setupTextElements();
    this.attachEventListeners();
  }
  ensureZones() {
    const e = this.container.querySelector("h1.title, h1");
    const t = this.container.querySelector('[data-template-element-id="title_channel"]');
    let n = this.container.querySelector(".cyp");
    if (!n && e) {
      n = document.createElement("div");
      n.className = "ranking-editor-zone ranking-editor-zone-header";
      e.parentNode.insertBefore(n, e);
    }
    if (n) {
      if (e && e.parentNode !== n) n.insertBefore(e, n.firstChild);
      if (t && t.parentNode !== n) n.appendChild(t);
      if (e && t && t.previousElementSibling !== e) {
        n.appendChild(t);
      }
    }
    const i = this.container.querySelector(".cyq");
    if (i) i.classList.add("cyo", "ranking-editor-zone-ranks");
  }
  isRankNumberElement(e) {
    const t = e?.getAttribute?.("data-template-element-id") || "";
    return t.startsWith("rank_") && t.endsWith("_number");
  }
  setupTextElements() {
    this.container.querySelectorAll("[data-template-element-id]").forEach(e => {
      e.classList.add("ranking-editor-text");
      if (this.isRankNumberElement(e)) {
        e.contentEditable = "false";
        e.setAttribute("contenteditable", "false");
        e.setAttribute("spellcheck", "false");
        e.classList.add("rk-number-locked");
        const t = (e.getAttribute("data-template-element-id") || "").match(/^rank_(\d+)_number$/);
        if (t) e.textContent = `${t[1]}.`;
      } else if (this.isRankTitleElement(e) || this.isHeaderElement(e)) {
        e.contentEditable = "false";
        e.setAttribute("contenteditable", "false");
        e.setAttribute("spellcheck", "true");
        e.style.cursor = "text";
        e.title = e.title || "Double-click to edit";
      }
    });
  }
  isHeaderElement(e) {
    const t = e.getAttribute("data-template-element-id") || "";
    return t.startsWith("title_");
  }
  isRankTitleElement(e) {
    const t = e.getAttribute("data-template-element-id") || "";
    return t.startsWith("rank_") && t.endsWith("_title");
  }
  getZoneMode(e) {
    return this.isHeaderElement(e) ? "group-header" : "group-ranks";
  }
  getGroupElements(e) {
    const t = window.RankingTextPill;
    if (this.isHeaderElement(e)) return t.getHeaderElements();
    if (t.getAllRankSideElements) return t.getAllRankSideElements();
    if (this.isRankTitleElement(e) && t.getAllRankTitles) {
      return [ ...t.getAllRankNumbers?.() || [], ...t.getAllRankTitles() ];
    }
    return t.getAllRankNumbers();
  }
  sameZone(e, t) {
    if (!e || !t) return false;
    return this.isHeaderElement(e) === this.isHeaderElement(t);
  }
  handleTextClick(e, t, n) {
    const i = window.RankingTextPill;
    if (!i) return;
    const r = n ? {
      x: n.clientX,
      y: n.clientY
    } : null;
    if (t) {
      i.toggleElement(e, true, r);
      return;
    }
    const s = i.getSelectionMode();
    const l = i.getSelectionAnchor();
    const a = this.getZoneMode(e);
    const o = this.getGroupElements(e);
    if (!i.hasSelection() || s === "multi") {
      if (s === "multi" && this.sameZone(e, l)) {
        i.selectElements([ e ], "single", e, r);
        return;
      }
      if (!i.hasSelection()) {
        i.selectElements(o, a, e, r);
        return;
      }
    }
    if ((s === "group-header" || s === "group-ranks") && this.sameZone(e, l)) {
      i.selectElements([ e ], "single", e, r);
      return;
    }
    if ((s === "group-header" || s === "group-ranks") && !this.sameZone(e, l)) {
      i.selectElements(o, a, e, r);
      return;
    }
    if (s === "single" && e === l) {
      i.selectElements(o, a, e, r);
      return;
    }
    if (s === "single" && this.sameZone(e, l)) {
      i.selectElements([ e ], "single", e, r);
      return;
    }
    i.selectElements(o, a, e, r);
  }
  attachEventListeners() {
    const e = this.container.querySelector(".cyp");
    const t = this.container.querySelector(".ranking-editor-zone-ranks");
    const n = this._abort.signal;
    const onTextActivate = (e, t) => {
      if (!e) return;
      if (t.target.closest("#rkPillMenu, .c1d0, #i20d, .c1do")) return;
      if (window.RankingTextPill?.consumeRankPointerClick?.()) return;
      t.preventDefault?.();
      t.stopPropagation();
      this.handleTextClick(e, !!(t.ctrlKey || t.metaKey), t);
    };
    this.container.querySelectorAll("[data-template-element-id]").forEach(e => {
      e.addEventListener("pointerup", t => {
        if (t.button != null && t.button !== 0) return;
        onTextActivate(e, t);
      }, {
        signal: n
      });
      e.addEventListener("dblclick", t => {
        t.stopPropagation();
        t.preventDefault();
        if (this.isRankNumberElement(e)) {
          window.RankingTextPill?.selectElements([ e ], "single", e, {
            x: t.clientX,
            y: t.clientY
          });
          return;
        }
        window.RankingTextPill?.selectElements?.([ e ], "single", e, {
          x: t.clientX,
          y: t.clientY
        });
        requestAnimationFrame(() => this.enableInlineEdit(e));
      }, {
        signal: n
      });
      if (this.isRankNumberElement(e)) {
        const blockEdit = e => {
          e.preventDefault();
          e.stopPropagation();
        };
        e.addEventListener("beforeinput", blockEdit, {
          signal: n
        });
        e.addEventListener("input", t => {
          const n = (e.getAttribute("data-template-element-id") || "").match(/^rank_(\d+)_number$/);
          if (n) e.textContent = `${n[1]}.`;
          blockEdit(t);
        }, {
          signal: n
        });
        e.addEventListener("paste", blockEdit, {
          signal: n
        });
        e.addEventListener("keydown", e => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
            blockEdit(e);
          }
        }, {
          signal: n
        });
      }
    });
    e?.addEventListener("pointerup", e => {
      if (e.target.closest("[data-template-element-id]")) return;
      if (e.button != null && e.button !== 0) return;
      const t = this.container.querySelector('[data-template-element-id^="title_"]');
      onTextActivate(t, e);
    }, {
      signal: n
    });
    t?.addEventListener("pointerup", e => {
      if (e.target.closest("[data-template-element-id]")) return;
      if (e.button != null && e.button !== 0) return;
      const t = window.RankingTextPill;
      if (t?.hasSelection?.() && t.getSelectionMode() === "group-ranks") return;
      if (!t?.hasSelection?.()) {
        const t = this.container.querySelector('[data-template-element-id$="_number"]');
        onTextActivate(t, e);
      }
    }, {
      signal: n
    });
    this.container.addEventListener("pointerup", e => {
      if (e.button != null && e.button !== 0) return;
      const t = e.target.hasAttribute?.("data-template-element-id") || e.target.closest?.("[data-template-element-id]");
      const n = e.target.closest?.(".ranking-editor-zone-header, .ranking-editor-zone-ranks");
      const i = e.target.closest?.("#rkSuggestActions") || e.target.closest?.(".rk-ghost-stack") || e.target.closest?.(".rk-ghost-suggest") || e.target.closest?.("#rkPillMenu") || e.target.closest?.(".sub-dropdown");
      if (!t && !n && !i) {
        window.RankingTextPill?.deselectAll();
      }
    }, {
      capture: true,
      signal: n
    });
  }
  enableInlineEdit(e) {
    if (this.isRankNumberElement(e)) return;
    if (e.classList.contains("czi")) return;
    const t = e.textContent;
    const n = e.getAttribute("data-placeholder") || "";
    if (e.classList.contains("rk-title-empty") || !t.trim() && n) {
      e.textContent = "";
      e.classList.remove("rk-title-empty");
      e.removeAttribute("data-placeholder");
    }
    e.contentEditable = "true";
    e.setAttribute("contenteditable", "true");
    e.setAttribute("spellcheck", "true");
    e.classList.add("czi");
    e.style.outline = "none";
    e.style.setProperty("user-select", "text", "important");
    e.style.setProperty("-webkit-user-select", "text", "important");
    e.style.cursor = "text";
    const i = e.closest(".cvb, #i24g");
    if (i) i.classList.add("rk-phone-editing");
    e.focus();
    try {
      const t = document.createRange();
      t.selectNodeContents(e);
      const n = window.getSelection();
      n.removeAllRanges();
      n.addRange(t);
    } catch (e) {}
    const finish = n => {
      e.removeEventListener("blur", onBlur);
      e.removeEventListener("keydown", onKey);
      e.removeEventListener("pointerdown", onPointerDownStop);
      e.contentEditable = "false";
      e.setAttribute("contenteditable", "false");
      e.classList.remove("czi");
      e.style.outline = "";
      e.style.removeProperty("user-select");
      e.style.removeProperty("-webkit-user-select");
      e.style.cursor = "";
      i?.classList.remove("rk-phone-editing");
      let r = e.textContent.replace(/\u00a0/g, " ").trim();
      if (!n) {
        r = (t || "").trim();
        e.textContent = t || "";
      }
      const s = e.getAttribute("data-template-element-id") || "";
      if (!r) {
        e.textContent = "";
        if (/rank_.*_title/.test(s)) {
          e.classList.add("rk-title-empty");
          e.setAttribute("data-placeholder", "Add title…");
          e.removeAttribute("data-rk-full-title");
        } else if (t) {
          e.textContent = t;
        }
      } else {
        e.classList.remove("rk-title-empty");
        e.removeAttribute("data-placeholder");
        e.setAttribute("data-rk-full-title", r);
        e.textContent = r;
      }
      if (s && window.rankingCustomizer) {
        if (!window.rankingCustomizer.customizations) {
          window.rankingCustomizer.customizations = {};
        }
        window.rankingCustomizer.customizations[s] = {
          ...window.rankingCustomizer.customizations[s] || {},
          content: r || ""
        };
      }
      try {
        const e = s.match(/^rank_(\d+)_title$/);
        if (e && window.clipsStudio) {
          if (!window.clipsStudio._libraryRankingTitleByRank) {
            window.clipsStudio._libraryRankingTitleByRank = {};
          }
          window.clipsStudio._libraryRankingTitleByRank[Number(e[1])] = r || "";
        }
      } catch (e) {}
      window.rankingCustomizer?.syncFromDOM?.();
      try {
        if (typeof markLibraryRankingDirty === "function") markLibraryRankingDirty(); else if (window.clipsStudio) window.clipsStudio._libraryRankingDirty = true;
      } catch (e) {}
    };
    const onBlur = () => finish(true);
    const onKey = t => {
      if (t.key === "Escape") {
        t.preventDefault();
        t.stopPropagation();
        finish(false);
        e.blur();
        return;
      }
      if (t.key === "Enter") {
        t.preventDefault();
        t.stopPropagation();
        e.blur();
      }
    };
    const onPointerDownStop = e => {
      e.stopPropagation();
    };
    e.addEventListener("blur", onBlur);
    e.addEventListener("keydown", onKey);
    e.addEventListener("pointerdown", onPointerDownStop);
  }
}

function initializeRankingTemplateEditor() {
  const e = document.getElementById("i24g");
  const t = e?.querySelector(".cyr");
  if (!t) return;
  try {
    window.rankingTemplateEditor?.destroy?.();
  } catch (e) {}
  window.RankingTextPill?.deselectAll();
  window.rankingTemplateEditor = new RankingTemplateEditor(t);
  try {
    requestAnimationFrame(() => {
      window.RankingTextPill?.seedDefaultSizes?.();
    });
  } catch (e) {}
  const n = document.getElementById("i1q9");
  if (n) n.style.display = "none";
  const i = document.getElementById("pill");
  if (i) {
    i.style.display = "none";
    i.classList.remove("ci8", "slide-in");
  }
  if (window.customizer && typeof window.customizer.hidePanel === "function") {
    try {
      window.customizer.hidePanel();
    } catch (e) {}
  }
}

window.initializeRankingTemplateEditor = initializeRankingTemplateEditor;
