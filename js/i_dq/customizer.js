class FloatingCustomizeBar {
  constructor() {
    this.currentElement = null;
    this.selectedElements = [];
    this.panel = null;
    this.undoStack = [];
    this.redoStack = [];
    this.changeTracker = new Map;
    this.currentTemplate = "ranking_moments";
    this.init();
    this.loadCustomizations(this.currentTemplate).catch(e => {
      console.warn("[Customizer] Could not load saved customizations:", e);
    });
  }
  init() {
    this.createPanel();
    this.attachClickListeners();
    this.isClosing = false;
    const e = document.getElementById("templateVideoPreview");
    if (e) {
      this.ensureCustomizationBaselines(e);
      const t = new MutationObserver(() => {
        this.ensureCustomizationBaselines(e);
        this.attachClickListeners();
      });
      t.observe(e, {
        childList: true,
        subtree: true
      });
    }
    document.addEventListener("click", e => {
      if (this.isClosing) return;
      if (!this.panel || this.panel.style.display === "none") return;
      const t = document.getElementById("pill");
      if (!t) return;
      if (t.contains(e.target)) return;
      const n = document.getElementById("templateVideoPreview");
      if (n && n.contains(e.target)) return;
      this.isClosing = true;
      this.hidePanel();
      if (window.closePill) window.closePill();
      setTimeout(() => {
        this.isClosing = false;
      }, 300);
    });
  }
  createPanel() {
    if (document.getElementById("pill")) return;
    const e = this;
    const t = document.createElement("div");
    t.id = "pill";
    t.className = "pill-container";
    t.innerHTML = `\n            <div class="pill-actions">\n                <div class="menu-item" id="textTrigger">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>\n                    <span>Text</span>\n                </div>\n\n                <div class="divider"></div>\n\n                <div class="menu-item" id="fontTrigger">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>\n                    <span id="labelFont">Jakarta</span>\n                </div>\n\n                <div class="divider"></div>\n\n                <div class="menu-item" id="colorTrigger">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>\n                    <span>Color</span>\n                    <div class="status-dot" id="colorIndicator"></div>\n                </div>\n\n                <div class="divider"></div>\n\n                <div class="menu-item" id="undoTrigger" title="Undo">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1)"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>\n                </div>\n\n                <div class="menu-item" id="redoTrigger" title="Redo">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>\n                </div>\n\n                <div class="divider"></div>\n\n                <div class="menu-item" id="saveCustomizationsTrigger" title="Save Customizations">\n                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>\n                </div>\n            </div>\n\n            <div class="pill-content">\n                <div class="content-inner">\n                    <div id="textView" class="view">\n                        <div class="section-label">Edit Text</div>\n                        <input type="text" id="textInput" placeholder="Edit text..." style="width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.95rem; margin-bottom: 18px; background: white; color: #0f172a; font-family: 'Plus Jakarta Sans', sans-serif;">\n\n                        <div class="section-label">Typography</div>\n                        <div id="fontPreviewContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">\n                            <div class="option-item selected" data-val="Plus Jakarta Sans">\n                                <span>Jakarta Sans</span>\n                                <span id="preview-jakarta" style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>\n                            </div>\n                            <div class="option-item" data-val="Playfair Display">\n                                <span>Playfair Display</span>\n                                <span id="preview-playfair" style="font-family: 'Playfair Display', serif; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>\n                            </div>\n                            <div class="option-item" data-val="JetBrains Mono">\n                                <span>JetBrains Mono</span>\n                                <span id="preview-jetbrains" style="font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>\n                            </div>\n                            <div class="option-item" data-val="Luckiest Guy">\n                                <span>Luckiest Guy</span>\n                                <span id="preview-lucky" style="font-family: 'Luckiest Guy', cursive; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>\n                            </div>\n                        </div>\n\n                        <div class="section-label">Accent Color</div>\n                        <div class="color-grid" id="colorGrid" style="margin-bottom: 12px;"></div>\n                        <div class="custom-row">\n                            <div class="color-preview">\n                                <input type="color" id="hexPicker" value="#0f172a">\n                            </div>\n                            <div class="hex-info">\n                                <span class="hex-label">Custom HEX</span>\n                                <span class="hex-value" id="hexVal">#0F172A</span>\n                            </div>\n                        </div>\n                    </div>\n                </div>\n            </div>\n        `;
    t.style.cssText = `\n            position: fixed;\n            bottom: 24px;\n            right: 24px;\n            top: auto;\n            left: auto;\n            display: none;\n            z-index: 10000;\n        `;
    document.body.appendChild(t);
    this.panel = t;
    const n = {
      text: document.getElementById("textTrigger"),
      font: document.getElementById("fontTrigger"),
      color: document.getElementById("colorTrigger"),
      undo: document.getElementById("undoTrigger"),
      redo: document.getElementById("redoTrigger")
    };
    const i = {
      text: document.getElementById("textView")
    };
    const s = document.getElementById("colorIndicator");
    const o = document.getElementById("labelFont");
    const a = document.getElementById("hexVal");
    const l = document.getElementById("hexPicker");
    const r = [ "#0f172a", "#ff6b00", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b", "#6366f1" ];
    let c = null;
    const d = document.getElementById("colorGrid");
    r.forEach(t => {
      const n = document.createElement("div");
      n.className = "swatch";
      n.style.background = t;
      n.addEventListener("click", n => {
        n.stopPropagation();
        e.selectedElements.forEach(n => {
          n.style.setProperty("color", t, "important");
          e.trackChange("color", {
            value: t
          });
        });
        a.textContent = t.toUpperCase();
        s.style.background = t;
        l.value = t;
      });
      d.appendChild(n);
    });
    const switchTab = e => {
      if (c === e) {
        closePill();
        return;
      }
      Object.keys(n).forEach(e => n[e].classList.remove("active"));
      Object.keys(i).forEach(e => {
        i[e].classList.remove("visible");
        i[e].style.display = "none";
      });
      c = e;
      n[e].classList.add("active");
      i[e].classList.add("visible");
      i[e].style.display = "flex";
      t.style.display = "flex";
      t.classList.add("is-expanded");
      t.classList.remove("slide-in");
      t.classList.remove("gameplay-mode");
      if (e === "text" && this.currentElement) {
        const e = window.getComputedStyle(this.currentElement);
        const t = e.fontFamily;
        const n = this.currentElement.textContent || "Sample Text";
        const i = {
          fontWeight: e.fontWeight,
          fontSize: e.fontSize,
          textShadow: e.textShadow,
          letterSpacing: e.letterSpacing,
          lineHeight: e.lineHeight,
          textTransform: e.textTransform,
          color: e.color
        };
        [ {
          id: "preview-jakarta",
          dataVal: "'Plus Jakarta Sans'"
        }, {
          id: "preview-playfair",
          dataVal: "'Playfair Display'"
        }, {
          id: "preview-jetbrains",
          dataVal: "'JetBrains Mono'"
        }, {
          id: "preview-lucky",
          dataVal: "'Luckiest Guy'"
        } ].forEach(e => {
          const t = document.getElementById(e.id);
          if (t) {
            t.textContent = n;
            Object.keys(i).forEach(e => {
              t.style[e] = i[e];
            });
          }
        });
        document.querySelectorAll("#fontPreviewContainer .option-item").forEach(e => {
          const n = e.dataset.val.replace(/['"]/g, "");
          const i = t.replace(/['"]/g, "").split(",")[0].trim();
          if (i.includes(n) || t.includes(n)) {
            e.classList.add("selected");
          } else {
            e.classList.remove("selected");
          }
        });
      }
    };
    const closePill = () => {
      c = null;
      t.classList.remove("is-expanded", "slide-in", "gameplay-mode");
      t.style.position = "fixed";
      t.style.bottom = "24px";
      t.style.right = "24px";
      t.style.top = "auto";
      t.style.left = "auto";
      t.style.transform = "";
      t.style.display = "none";
      Object.keys(n).forEach(e => n[e].classList.remove("active"));
      Object.keys(i).forEach(e => {
        i[e].classList.remove("visible");
        i[e].style.display = "none";
      });
    };
    window.closePill = closePill;
    n.text.onclick = e => {
      e.stopPropagation();
      switchTab("text");
    };
    n.font.onclick = e => {
      e.stopPropagation();
      switchTab("text");
      setTimeout(() => {
        const e = document.getElementById("fontPreviewContainer");
        if (e) e.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 150);
    };
    n.color.onclick = e => {
      e.stopPropagation();
      switchTab("text");
      setTimeout(() => {
        const e = document.getElementById("colorGrid");
        if (e) e.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 150);
    };
    n.undo.onclick = e => {
      e.stopPropagation();
      this.undo();
    };
    n.redo.onclick = e => {
      e.stopPropagation();
      this.redo();
    };
    const m = document.getElementById("saveCustomizationsTrigger");
    if (m) {
      m.onclick = async t => {
        t.stopPropagation();
        const n = m.querySelector("span");
        const i = n ? n.textContent : "";
        try {
          if (n) n.textContent = "Saving...";
          m.disabled = true;
          await e.saveCustomizations("ranking_moments");
          if (n) n.textContent = "✓ Saved";
          setTimeout(() => {
            if (n) n.textContent = i;
            m.disabled = false;
          }, 2e3);
        } catch (e) {
          if (n) n.textContent = "✗ Failed";
          console.error("[Customizer] Save failed:", e);
          setTimeout(() => {
            if (n) n.textContent = i;
            m.disabled = false;
          }, 2e3);
        }
      };
    }
    const u = document.getElementById("fontPreviewContainer");
    const p = {
      "Plus Jakarta Sans": "'Plus Jakarta Sans', sans-serif",
      "Playfair Display": "'Playfair Display', serif",
      "JetBrains Mono": "'JetBrains Mono', monospace",
      "Luckiest Guy": "'Luckiest Guy', cursive"
    };
    if (u) {
      u.addEventListener("click", t => {
        const n = t.target.closest(".option-item");
        if (!n) return;
        t.stopPropagation();
        t.preventDefault();
        const i = n.dataset.val;
        if (!e.selectedElements || e.selectedElements.length === 0) {
          console.warn("[Font] No selected elements!");
          return;
        }
        const s = p[i] || `'${i}', sans-serif`;
        e.selectedElements.forEach(t => {
          e.trackChange("font", {
            oldValue: t.style.fontFamily
          });
          t.style.setProperty("font-family", s, "important");
        });
        document.getElementById("labelFont").textContent = i;
        e.updateLivePreview();
        u.querySelectorAll(".option-item").forEach(e => e.classList.remove("selected"));
        n.classList.add("selected");
      }, false);
    }
    const f = document.getElementById("textInput");
    if (f) {
      f.addEventListener("input", t => {
        e.selectedElements.forEach(e => {
          e.textContent = t.target.value;
        });
        e.updateLivePreview();
      });
      f.addEventListener("change", () => {
        e.selectedElements.forEach(() => {
          e.trackChange("text");
        });
      });
    }
    l.addEventListener("input", t => {
      t.stopPropagation();
      const n = t.target.value;
      e.selectedElements.forEach(e => {
        e.style.setProperty("color", n, "important");
      });
      s.style.background = n;
      a.textContent = n.toUpperCase();
    });
    l.addEventListener("change", t => {
      t.stopPropagation();
      e.selectedElements.forEach(n => {
        n.style.setProperty("color", t.target.value, "important");
        e.trackChange("color", {
          value: t.target.value
        });
      });
    });
    const y = document.getElementById("colorGrid");
    if (y) {
      y.addEventListener("click", t => {
        if (t.target.classList.contains("swatch")) {
          t.stopPropagation();
          t.preventDefault();
          const n = window.getComputedStyle(t.target).backgroundColor;
          e.selectedElements.forEach(t => {
            e.trackChange("color", {
              value: n
            });
            t.style.setProperty("color", n, "important");
          });
          a.textContent = n.toUpperCase();
          s.style.background = n;
          l.value = n;
        }
      });
    }
  }
  showPanel(e) {
    const t = document.getElementById("templateVideoPreview");
    if (t?.querySelector(".ranking-preview-container") || e?.closest?.(".ranking-preview-container")) {
      return;
    }
    this.clearSelection();
    if (this.currentElement && this.currentElement !== e) {
      this.currentElement.style.boxShadow = "";
      this.currentElement.style.borderRadius = "";
      this.currentElement.style.zIndex = "";
      this.currentElement.style.position = "";
    }
    this.currentElement = e;
    this.selectedElements = [ e ];
    const n = document.getElementById("textInput");
    const i = document.getElementById("textView");
    if (i) i.style.display = "flex";
    if (n) {
      n.value = e.textContent || "";
      const t = window.getComputedStyle(e);
      n.style.fontFamily = t.fontFamily;
      n.style.fontWeight = t.fontWeight;
      n.style.fontSize = t.fontSize;
      n.style.textShadow = t.textShadow;
      n.style.letterSpacing = t.letterSpacing;
      n.style.lineHeight = t.lineHeight;
      n.style.textTransform = t.textTransform;
      n.style.color = t.color;
    }
    this.panel.style.position = "fixed";
    this.panel.style.bottom = "24px";
    this.panel.style.right = "24px";
    this.panel.style.top = "auto";
    this.panel.style.left = "auto";
    this.panel.style.display = "flex";
    this.panel.classList.add("is-expanded");
    this.updateLivePreview();
    e.style.borderRadius = "12px";
    e.style.boxShadow = "0 0 0 2px #ff6b3d";
    e.style.position = "relative";
    e.style.zIndex = "9999";
  }
  hidePanel() {
    if (this.panel) {
      this.panel.style.display = "none";
      this.panel.classList.remove("is-expanded");
    }
    if (this.currentElement) {
      this.currentElement.style.boxShadow = "";
      this.currentElement.style.borderRadius = "";
      this.currentElement.style.zIndex = "";
      this.currentElement.style.position = "";
    }
    this.clearSelection();
    this.currentElement = null;
  }
  updateLivePreview() {
    if (!this.currentElement) return;
    const e = window.getComputedStyle(this.currentElement);
    const t = e.fontFamily;
    const n = this.currentElement.textContent || "Sample Text";
    const i = {
      fontWeight: e.fontWeight,
      fontSize: e.fontSize,
      textShadow: e.textShadow,
      letterSpacing: e.letterSpacing,
      lineHeight: e.lineHeight,
      textTransform: e.textTransform,
      color: e.color
    };
    [ {
      id: "preview-jakarta",
      font: "'Plus Jakarta Sans', sans-serif"
    }, {
      id: "preview-playfair",
      font: "'Playfair Display', serif"
    }, {
      id: "preview-jetbrains",
      font: "'JetBrains Mono', monospace"
    }, {
      id: "preview-lucky",
      font: "'Luckiest Guy', cursive"
    } ].forEach(e => {
      const t = document.getElementById(e.id);
      if (t) {
        t.textContent = n;
        t.style.fontFamily = e.font;
        Object.keys(i).forEach(e => {
          t.style[e] = i[e];
        });
      }
    });
    const s = document.getElementById("fontPreviewContainer");
    if (s) {
      const e = {
        "Plus Jakarta Sans": "Plus Jakarta Sans",
        "Playfair Display": "Playfair Display",
        "JetBrains Mono": "JetBrains Mono",
        "Luckiest Guy": "Luckiest Guy"
      };
      let n = false;
      s.querySelectorAll(".option-item").forEach(i => {
        const s = i.dataset.val;
        const o = t.replace(/['"]/g, "").split(",")[0].trim();
        if (s === o || t.includes(s)) {
          i.classList.add("selected");
          document.getElementById("labelFont").textContent = e[s] || s;
          n = true;
        } else {
          i.classList.remove("selected");
        }
      });
      if (!n) {
        document.getElementById("labelFont").textContent = "Custom";
        s.querySelectorAll(".option-item").forEach(e => e.classList.remove("selected"));
      }
    }
    const o = document.getElementById("textInput");
    if (o) {
      o.style.fontFamily = e.fontFamily;
      o.style.fontWeight = i.fontWeight;
      o.style.fontSize = i.fontSize;
      o.style.textShadow = i.textShadow;
      o.style.letterSpacing = i.letterSpacing;
      o.style.lineHeight = i.lineHeight;
      o.style.textTransform = i.textTransform;
      o.style.color = i.color;
    }
  }
  isNumberedItem(e) {
    if (!e || !e.textContent) return false;
    return /^\d+\./.test(e.textContent.trim());
  }
  addToSelection(e) {
    if (!this.selectedElements.includes(e)) {
      this.selectedElements.push(e);
      e.style.outline = "2px dashed #ff6b3d";
      e.style.outlineOffset = "2px";
    }
    this.updateMultiSelectUI();
  }
  clearSelection() {
    this.selectedElements.forEach(e => {
      e.style.outline = "";
      e.style.outlineOffset = "";
    });
    this.selectedElements = [];
  }
  updateMultiSelectUI() {
    const e = document.getElementById("pill");
    if (!e) return;
    if (this.selectedElements.length > 1) {
      e.classList.add("multi-select-mode");
    } else {
      e.classList.remove("multi-select-mode");
    }
  }
  trackChange(e, t = {}) {
    if (!this.currentElement) return;
    const n = {
      type: e,
      element: this.currentElement,
      elementId: this.currentElement.id || this.currentElement.className,
      timestamp: Date.now()
    };
    if (e === "text") n.oldText = this.currentElement.textContent;
    if (e === "font") {
      n.oldFont = t.oldValue || this.currentElement.style.fontFamily;
      n.newFont = this.currentElement.style.fontFamily;
    }
    if (e === "color") {
      n.oldColor = this.getElementColor();
      n.newColor = t.value || this.currentElement.style.color;
    }
    if (e === "delete") {
      n.deletedHTML = this.currentElement.outerHTML;
      n.deletedParent = this.currentElement.parentElement;
    }
    this.undoStack.push(n);
    this.redoStack = [];
  }
  getElementColor() {
    if (!this.currentElement) return "#0f172a";
    return window.getComputedStyle(this.currentElement).color || this.currentElement.style.color || "#0f172a";
  }
  undo() {
    if (this.undoStack.length === 0) return;
    const e = this.undoStack.pop();
    const t = {
      ...e
    };
    if (e.type === "text") t.newText = e.element.textContent;
    if (e.type === "font") t.currentFont = e.element.style.fontFamily;
    if (e.type === "color") t.currentColor = e.element.style.color;
    this.redoStack.push(t);
    switch (e.type) {
     case "text":
      e.element.textContent = e.oldText;
      break;

     case "font":
      e.element.style.setProperty("font-family", e.oldFont, "important");
      break;

     case "color":
      e.element.style.setProperty("color", e.oldColor, "important");
      break;

     case "delete":
      if (e.deletedParent) e.deletedParent.innerHTML += e.deletedHTML;
      break;
    }
    this.updatePanel();
  }
  redo() {
    if (this.redoStack.length === 0) return;
    const e = this.redoStack.pop();
    this.undoStack.push({
      ...e
    });
    switch (e.type) {
     case "text":
      e.element.textContent = e.newText;
      break;

     case "font":
      e.element.style.setProperty("font-family", e.newFont, "important");
      break;

     case "color":
      e.element.style.setProperty("color", e.newColor, "important");
      break;

     case "delete":
      if (e.deletedParent) e.deletedParent.innerHTML += e.deletedHTML;
      break;
    }
    this.updatePanel();
  }
  updatePanel() {
    if (this.currentElement && this.panel && this.panel.style.display !== "none") {
      const e = document.getElementById("textInput");
      if (e) e.value = this.currentElement.textContent || "";
      const t = document.getElementById("colorIndicator");
      const n = document.getElementById("hexVal");
      const i = window.getComputedStyle(this.currentElement).color || "#0f172a";
      if (t) t.style.background = i;
      if (n) n.textContent = this.rgbToHex(i).toUpperCase();
    }
  }
  rgbToHex(e) {
    if (e.startsWith("#")) return e;
    const t = e.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!t) return "#0f172a";
    return `#${parseInt(t[1]).toString(16).padStart(2, "0")}${parseInt(t[2]).toString(16).padStart(2, "0")}${parseInt(t[3]).toString(16).padStart(2, "0")}`;
  }
  attachClickListeners() {
    const e = document.getElementById("templateVideoPreview");
    if (!e) {
      setTimeout(() => this.attachClickListeners(), 1e3);
      return;
    }
    e.style.userSelect = "text";
    e.style.WebkitUserSelect = "text";
    const wrapTextNodes = e => {
      const t = [ ".title", ".ranking-list", ".ranked-item", ".funniest", ".text-stroke", '[class*="rank-"]' ];
      if (t.some(t => e.querySelector(t))) return;
      const n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null, false);
      const i = [];
      let s;
      while (s = n.nextNode()) {
        if (s.textContent.trim().length > 0 && s.parentElement !== e) {
          if (s.parentElement.className && (s.parentElement.className.includes("funniest") || s.parentElement.className.includes("text-stroke") || s.parentElement.className && !s.parentElement.className.includes("text-node-wrapper"))) continue;
          i.push(s);
        }
      }
      i.reverse().forEach(e => {
        if (e.parentElement.tagName === "SPAN" && e.parentElement.className) return;
        const t = document.createElement("span");
        t.className = "text-node-wrapper";
        e.parentElement.insertBefore(t, e);
        t.appendChild(e);
      });
    };
    wrapTextNodes(e);
    e.addEventListener("mouseup", t => {
      if (t.target.closest(".solis-watermark")) return;
      if (t.target.closest('[data-no-text-select="true"]')) return;
      if (e.querySelector(".ranking-preview-container") || t.target.closest(".ranking-preview-container")) {
        return;
      }
      const n = t.shiftKey;
      let i = t.target;
      if (i && i !== e && !i.closest(".solis-watermark")) {
        if (i.textContent?.trim() && i.textContent.trim().length < 200) {
          t.stopPropagation();
          if (n && this.currentElement) {
            this.addToSelection(i);
          } else {
            this.showPanel(i);
          }
          return;
        }
      }
      const s = window.getSelection();
      const o = s.toString().trim();
      if (o && o.length > 0) {
        let i = s.getRangeAt(0);
        let o = i.commonAncestorContainer;
        if (o.nodeType === Node.TEXT_NODE) o = o.parentElement;
        while (o && !o.textContent?.trim() && o !== e) {
          o = o.parentElement;
        }
        if (o && o !== e && !o.closest(".solis-watermark")) {
          t.stopPropagation();
          if (n && this.currentElement) {
            this.addToSelection(o);
          } else {
            this.showPanel(o);
          }
        }
      }
    }, true);
    e.addEventListener("mouseover", t => {
      const n = t.target;
      if (n && n !== e && !n.closest(".solis-watermark")) {
        if (n.textContent?.trim() && n.textContent.trim().length < 200) {
          n.style.cursor = "pointer";
          if (!n.style.background || n.style.background === "") {
            n.style.transition = "background 0.15s ease";
          }
        }
      }
    });
    e.addEventListener("mouseout", e => {
      const t = e.target;
      if (t && t._originalBg === undefined && t.style.background === "rgba(255, 107, 0, 0.08)") {
        t.style.background = "";
      }
    });
  }
  getElementCustomizationId(e) {
    if (!e) return "";
    let t = e.getAttribute("data-template-element-id") || e.getAttribute("data-element-id") || e.id;
    if (!t && e.parentElement) {
      t = e.parentElement.getAttribute("data-template-element-id") || e.parentElement.getAttribute("data-element-id") || "";
    }
    return t || "";
  }
  ensureCustomizationBaselines(e = document.getElementById("templateVideoPreview")) {
    if (!e) return;
    e.querySelectorAll("[data-template-element-id], .text-node-wrapper, [data-element-id]").forEach(e => {
      if (!this.getElementCustomizationId(e)) return;
      if (e.dataset.customizerBaseText === undefined) {
        e.dataset.customizerBaseText = (e.textContent || "").trim();
      }
      const t = window.getComputedStyle(e);
      if (e.dataset.customizerBaseColor === undefined) {
        e.dataset.customizerBaseColor = t.color || "";
      }
      if (e.dataset.customizerBaseFont === undefined) {
        e.dataset.customizerBaseFont = (t.fontFamily || "").replace(/['"]/g, "").split(",")[0].trim();
      }
    });
  }
  colorToRgbaArray(e) {
    if (!e) return null;
    const t = e.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (t) {
      return [ parseInt(t[1], 10), parseInt(t[2], 10), parseInt(t[3], 10), 255 ];
    }
    const n = e.match(/^#([0-9a-f]{6})$/i);
    if (n) {
      const e = n[1];
      return [ parseInt(e.slice(0, 2), 16), parseInt(e.slice(2, 4), 16), parseInt(e.slice(4, 6), 16), 255 ];
    }
    return null;
  }
  collectCustomizations() {
    const e = JSON.parse(JSON.stringify(window.currentCustomizations?.customizations || {}));
    const t = document.getElementById("templateVideoPreview");
    if (!t) return e;
    this.ensureCustomizationBaselines(t);
    t.querySelectorAll("[data-template-element-id], .text-node-wrapper, [data-element-id]").forEach(t => {
      const n = this.getElementCustomizationId(t);
      if (!n) return;
      const i = window.getComputedStyle(t);
      const s = e[n] ? {
        ...e[n]
      } : {};
      const o = t.textContent?.trim();
      const a = t.dataset.customizerBaseText || "";
      if (o && o.length > 0 && o.length < 500 && !o.includes("[") && !o.includes("]") && o !== a) {
        s.content = o;
      } else {
        delete s.content;
      }
      const l = t.dataset.customizerBaseColor || "";
      if (i.color && i.color !== l) {
        const e = this.colorToRgbaArray(i.color);
        if (e) s.color = e;
      } else {
        delete s.color;
      }
      const r = (i.fontFamily || "").replace(/['"]/g, "").split(",")[0].trim();
      const c = t.dataset.customizerBaseFont || "";
      if (r && r !== c) {
        s.font = r;
      } else {
        delete s.font;
      }
      if (Object.keys(s).length > 0) {
        e[n] = s;
      } else {
        delete e[n];
      }
    });
    return e;
  }
  async saveCustomizations(e = "ranking_moments") {
    try {
      const t = this.collectCustomizations();
      if (Object.keys(t).length === 0) return {
        message: "No customizations to save"
      };
      const n = window.API_BASE_URL || "https://api.solisai.video/api";
      const i = getAuthHeaders();
      const s = await fetch(`${n}/clips/apply-customizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...i
        },
        credentials: "include",
        body: JSON.stringify({
          template_id: e,
          customizations: t
        })
      });
      if (!s.ok) {
        const e = await s.json();
        throw new Error(e.error || `HTTP ${s.status}: Failed to save customizations`);
      }
      const o = await s.json();
      window.currentCustomizations = {
        template_id: e,
        customizations: t,
        timestamp: Date.now(),
        saved_at: o.applied_at
      };
      if (window.showNotification) window.showNotification("Customizations saved successfully!", "success");
      return o;
    } catch (e) {
      if (window.showNotification) window.showNotification(`Failed to save: ${e.message}`, "error");
      throw e;
    }
  }
  async loadCustomizations(e = "ranking_moments") {
    try {
      const t = window.API_BASE_URL || "https://api.solisai.video/api";
      const n = getAuthHeaders();
      const i = await fetch(`${t}/clips/get-customizations/${e}`, {
        method: "GET",
        headers: n,
        credentials: "include"
      });
      if (!i.ok) return null;
      const s = await i.json();
      if (!s.has_customizations) return null;
      window.currentCustomizations = {
        template_id: e,
        customizations: s.customizations,
        timestamp: Date.now(),
        saved_at: s.saved_at
      };
      return s.customizations;
    } catch (e) {
      console.error("[Customizer] Error loading customizations:", e);
      return null;
    }
  }
  getCustomizationsForGeneration() {
    if (!window.currentCustomizations) return null;
    const e = Date.now() - window.currentCustomizations.timestamp;
    if (e > 5 * 60 * 1e3) {
      window.currentCustomizations = null;
      return null;
    }
    return window.currentCustomizations.customizations;
  }
}

const customizer = (() => {
  let e = null;
  const createCustomizer = () => {
    if (e) return e;
    e = new FloatingCustomizeBar;
    window.customizer = e;
    return e;
  };
  window.showGameplayPanel = (e, t) => {
    const n = document.getElementById("pill");
    if (!n) {
      console.error("[Gameplay Panel] Pill container not found");
      return;
    }
    if (n.classList.contains("is-expanded")) {
      return;
    }
    const i = 20;
    const s = 450;
    const o = 150;
    let a = e + i;
    let l = t - o / 2;
    if (a + s > window.innerWidth) a = e - s - i;
    l = Math.max(20, Math.min(l, window.innerHeight - o - 20));
    n.classList.remove("gameplay-mode");
    n.style.position = "fixed";
    n.style.bottom = "auto";
    n.style.right = "auto";
    n.style.top = l + "px";
    n.style.left = a + "px";
    n.style.transform = "none";
    const r = n.querySelector(".pill-actions");
    if (r) r.style.display = "none";
    n.style.display = "flex";
    let c = document.getElementById("gameplayView");
    const d = !c || !c.parentElement;
    if (c && !d) {
      c.style.display = "flex";
      c.classList.add("visible");
    } else {
      if (c) c.remove();
      c = document.createElement("div");
      c.id = "gameplayView";
      c.className = "view";
      c.style.cssText = "display: flex; flex-direction: column; width: 100%; gap: 0;";
      const e = n.querySelector(".content-inner");
      if (e) e.appendChild(c);
      c.innerHTML = `\n                <style>\n                    @keyframes loadingSpinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\n                    .gameplay-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity 0.2s; }\n                    .gameplay-loading.active { opacity: 1; }\n                    .gameplay-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,107,0,0.3); border-top-color: #ff6b00; border-radius: 50%; animation: loadingSpinner 0.6s linear infinite; }\n                </style>\n                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%;">\n                    ${availableGameplayClips.slice(0, 4).map(e => `\n                        <div data-clip-id="${e.id}" class="gameplay-card-option"\n                             style="position: relative; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid #e2e8f0; transition: all 0.3s; ${selectedGameplayClip === e.id ? "border-color: #ff6b00; box-shadow: 0 4px 12px rgba(255,107,0,0.2);" : ""}">\n                            <video style="width: 100%; height: 100%; object-fit: cover; display: block;" muted loop playsinline autoplay>\n                                <source src="/assets/${e.filename}" type="video/mp4">\n                            </video>\n                            <div class="gameplay-loading"><div class="gameplay-spinner"></div></div>\n                        </div>\n                    `).join("")}\n                </div>\n            `;
      c.querySelectorAll(".gameplay-card-option").forEach(e => {
        e.addEventListener("click", t => {
          t.stopPropagation();
          const n = e.dataset.clipId;
          const i = availableGameplayClips.find(e => e.id === n);
          selectGameplayClip(n);
          c.querySelectorAll(".gameplay-card-option").forEach(e => {
            e.style.borderColor = "#e2e8f0";
            e.style.boxShadow = "none";
          });
          e.style.borderColor = "#ff6b00";
          e.style.boxShadow = "0 4px 12px rgba(255,107,0,0.2)";
          const s = e.querySelector(".gameplay-loading");
          if (s) s.classList.add("active");
          setTimeout(() => {
            const e = document.getElementById("splitscreenGameplayVideo");
            if (e && i) {
              const t = e.querySelector("source");
              if (t) t.src = `/assets/${i.filename}`; else e.src = `/assets/${i.filename}`;
              e.load();
              e.play().catch(() => {});
            }
            if (s) s.classList.remove("active");
          }, 300);
        });
      });
    }
    const m = n.querySelectorAll(".view");
    m.forEach(e => {
      e.classList.remove("visible");
      e.style.display = "none";
    });
    c.classList.add("visible");
    c.style.display = "flex";
    n.classList.add("is-expanded", "slide-in", "gameplay-mode");
    if (window.gameplayClickOutsideHandler) {
      document.removeEventListener("click", window.gameplayClickOutsideHandler);
      window.gameplayClickOutsideHandler = null;
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        createCustomizer();
        window.customizer = e;
      }, 500);
    });
  } else {
    setTimeout(() => {
      createCustomizer();
      window.customizer = e;
    }, 500);
  }
  window.initializeFloatingCustomizer = (t = false) => {
    if (t && e) {
      const t = document.getElementById("pill");
      if (t) t.remove();
      e = null;
    }
    const n = createCustomizer();
    const i = document.getElementById("pill");
    if (i) {
      i.style.position = "fixed";
      i.style.bottom = "24px";
      i.style.right = "24px";
      i.style.top = "auto";
      i.style.left = "auto";
    }
    return n;
  };
})();
