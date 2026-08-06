class FloatingCustomizeBar {
    constructor() {
        this.currentElement = null;
        this.selectedElements = [];
        this.panel = null;
        this.undoStack = [];
        this.redoStack = [];
        this.changeTracker = new Map();
        this.currentTemplate = 'ranking_moments';
        this.init();

        this.loadCustomizations(this.currentTemplate).catch(err => {
            console.warn('[Customizer] Could not load saved customizations:', err);
        });
    }

    init() {
        this.createPanel();
        this.attachClickListeners();
        this.isClosing = false;

        const preview = document.getElementById('templateVideoPreview');
        if (preview) {
            this.ensureCustomizationBaselines(preview);
            const observer = new MutationObserver(() => {
                this.ensureCustomizationBaselines(preview);
                this.attachClickListeners();
            });
            observer.observe(preview, { childList: true, subtree: true });
        }

        document.addEventListener('click', (e) => {
            if (this.isClosing) return;
            if (!this.panel || this.panel.style.display === 'none') return;

            const pill = document.getElementById('pill');
            if (!pill) return;

            if (pill.contains(e.target)) return;

            const preview = document.getElementById('templateVideoPreview');
            if (preview && preview.contains(e.target)) return;

            this.isClosing = true;
            this.hidePanel();
            if (window.closePill) window.closePill();
            setTimeout(() => { this.isClosing = false; }, 300);
        });
    }

    createPanel() {
        if (document.getElementById('pill')) return;

        const customizer = this;

        const pill = document.createElement('div');
        pill.id = 'pill';
        pill.className = 'pill-container';
        pill.innerHTML = `
            <div class="pill-actions">
                <div class="menu-item" id="textTrigger">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                    <span>Text</span>
                </div>

                <div class="divider"></div>

                <div class="menu-item" id="fontTrigger">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                    <span id="labelFont">Jakarta</span>
                </div>

                <div class="divider"></div>

                <div class="menu-item" id="colorTrigger">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>
                    <span>Color</span>
                    <div class="status-dot" id="colorIndicator"></div>
                </div>

                <div class="divider"></div>

                <div class="menu-item" id="undoTrigger" title="Undo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1)"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </div>

                <div class="menu-item" id="redoTrigger" title="Redo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </div>

                <div class="divider"></div>

                <div class="menu-item" id="saveCustomizationsTrigger" title="Save Customizations">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                </div>
            </div>

            <div class="pill-content">
                <div class="content-inner">
                    <div id="textView" class="view">
                        <div class="section-label">Edit Text</div>
                        <input type="text" id="textInput" placeholder="Edit text..." style="width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.95rem; margin-bottom: 18px; background: white; color: #0f172a; font-family: 'Plus Jakarta Sans', sans-serif;">

                        <div class="section-label">Typography</div>
                        <div id="fontPreviewContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                            <div class="option-item selected" data-val="Plus Jakarta Sans">
                                <span>Jakarta Sans</span>
                                <span id="preview-jakarta" style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>
                            </div>
                            <div class="option-item" data-val="Playfair Display">
                                <span>Playfair Display</span>
                                <span id="preview-playfair" style="font-family: 'Playfair Display', serif; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>
                            </div>
                            <div class="option-item" data-val="JetBrains Mono">
                                <span>JetBrains Mono</span>
                                <span id="preview-jetbrains" style="font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>
                            </div>
                            <div class="option-item" data-val="Luckiest Guy">
                                <span>Luckiest Guy</span>
                                <span id="preview-lucky" style="font-family: 'Luckiest Guy', cursive; font-size: 1.2rem; line-height: 1.3;">Sample Text</span>
                            </div>
                        </div>

                        <div class="section-label">Accent Color</div>
                        <div class="color-grid" id="colorGrid" style="margin-bottom: 12px;"></div>
                        <div class="custom-row">
                            <div class="color-preview">
                                <input type="color" id="hexPicker" value="#0f172a">
                            </div>
                            <div class="hex-info">
                                <span class="hex-label">Custom HEX</span>
                                <span class="hex-value" id="hexVal">#0F172A</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        pill.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            top: auto;
            left: auto;
            display: none;
            z-index: 10000;
        `;

        document.body.appendChild(pill);
        this.panel = pill;

        const triggers = {
            text:  document.getElementById('textTrigger'),
            font:  document.getElementById('fontTrigger'),
            color: document.getElementById('colorTrigger'),
            undo:  document.getElementById('undoTrigger'),
            redo:  document.getElementById('redoTrigger')
        };
        const views = { text: document.getElementById('textView') };

        const colorIndicator = document.getElementById('colorIndicator');
        const labelFont      = document.getElementById('labelFont');
        const hexVal         = document.getElementById('hexVal');
        const hexPicker      = document.getElementById('hexPicker');

        const COLORS = ['#0f172a', '#ff6b00', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#6366f1'];
        let activeTab = null;

        const grid = document.getElementById('colorGrid');
        COLORS.forEach(c => {
            const s = document.createElement('div');
            s.className = 'swatch';
            s.style.background = c;
            s.addEventListener('click', (e) => {
                e.stopPropagation();
                customizer.selectedElements.forEach(el => {
                    el.style.setProperty('color', c, 'important');
                    customizer.trackChange('color', { value: c });
                });
                hexVal.textContent = c.toUpperCase();
                colorIndicator.style.background = c;
                hexPicker.value = c;
            });
            grid.appendChild(s);
        });

        const switchTab = (tab) => {
            if (activeTab === tab) {
                closePill();
                return;
            }

            Object.keys(triggers).forEach(key => triggers[key].classList.remove('active'));
            Object.keys(views).forEach(key => {
                views[key].classList.remove('visible');
                views[key].style.display = 'none';
            });

            activeTab = tab;
            triggers[tab].classList.add('active');
            views[tab].classList.add('visible');
            views[tab].style.display = 'flex';
            pill.style.display = 'flex';
            pill.classList.add('is-expanded');
            pill.classList.remove('slide-in');
            pill.classList.remove('gameplay-mode');

            if (tab === 'text' && this.currentElement) {
                const computedStyle = window.getComputedStyle(this.currentElement);
                const currentFont   = computedStyle.fontFamily;
                const previewText   = this.currentElement.textContent || 'Sample Text';
                const styles = {
                    fontWeight:    computedStyle.fontWeight,
                    fontSize:      computedStyle.fontSize,
                    textShadow:    computedStyle.textShadow,
                    letterSpacing: computedStyle.letterSpacing,
                    lineHeight:    computedStyle.lineHeight,
                    textTransform: computedStyle.textTransform,
                    color:         computedStyle.color
                };

                [
                    { id: 'preview-jakarta',   dataVal: "'Plus Jakarta Sans'" },
                    { id: 'preview-playfair',  dataVal: "'Playfair Display'" },
                    { id: 'preview-jetbrains', dataVal: "'JetBrains Mono'" },
                    { id: 'preview-lucky',     dataVal: "'Luckiest Guy'" }
                ].forEach(item => {
                    const preview = document.getElementById(item.id);
                    if (preview) {
                        preview.textContent = previewText;
                        Object.keys(styles).forEach(key => { preview.style[key] = styles[key]; });
                    }
                });

                document.querySelectorAll('#fontPreviewContainer .option-item').forEach(item => {
                    const fontVal         = item.dataset.val.replace(/['"]/g, '');
                    const currentFontClean = currentFont.replace(/['"]/g, '').split(',')[0].trim();
                    if (currentFontClean.includes(fontVal) || currentFont.includes(fontVal)) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }
        };

        const closePill = () => {
            activeTab = null;
            pill.classList.remove('is-expanded', 'slide-in', 'gameplay-mode');

            pill.style.position  = 'fixed';
            pill.style.bottom    = '24px';
            pill.style.right     = '24px';
            pill.style.top       = 'auto';
            pill.style.left      = 'auto';
            pill.style.transform = '';
            pill.style.display   = 'none';

            Object.keys(triggers).forEach(key => triggers[key].classList.remove('active'));
            Object.keys(views).forEach(key => {
                views[key].classList.remove('visible');
                views[key].style.display = 'none';
            });
        };

        window.closePill = closePill;

        triggers.text.onclick  = (e) => { e.stopPropagation(); switchTab('text'); };
        triggers.font.onclick  = (e) => {
            e.stopPropagation();
            switchTab('text');
            setTimeout(() => {
                const fontSection = document.getElementById('fontPreviewContainer');
                if (fontSection) fontSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
        };
        triggers.color.onclick = (e) => {
            e.stopPropagation();
            switchTab('text');
            setTimeout(() => {
                const colorSection = document.getElementById('colorGrid');
                if (colorSection) colorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
        };
        triggers.undo.onclick = (e) => { e.stopPropagation(); this.undo(); };
        triggers.redo.onclick = (e) => { e.stopPropagation(); this.redo(); };

        const saveTrigger = document.getElementById('saveCustomizationsTrigger');
        if (saveTrigger) {
            saveTrigger.onclick = async (e) => {
                e.stopPropagation();
                const btnText    = saveTrigger.querySelector('span');
                const originalText = btnText ? btnText.textContent : '';

                try {
                    if (btnText) btnText.textContent = 'Saving...';
                    saveTrigger.disabled = true;
                    await customizer.saveCustomizations('ranking_moments');
                    if (btnText) btnText.textContent = '✓ Saved';
                    setTimeout(() => {
                        if (btnText) btnText.textContent = originalText;
                        saveTrigger.disabled = false;
                    }, 2000);
                } catch (error) {
                    if (btnText) btnText.textContent = '✗ Failed';
                    console.error('[Customizer] Save failed:', error);
                    setTimeout(() => {
                        if (btnText) btnText.textContent = originalText;
                        saveTrigger.disabled = false;
                    }, 2000);
                }
            };
        }

        const fontPreviewContainer = document.getElementById('fontPreviewContainer');
        const FONT_STACKS = {
            'Plus Jakarta Sans': "'Plus Jakarta Sans', sans-serif",
            'Playfair Display':  "'Playfair Display', serif",
            'JetBrains Mono':    "'JetBrains Mono', monospace",
            'Luckiest Guy':      "'Luckiest Guy', cursive"
        };

        if (fontPreviewContainer) {
            fontPreviewContainer.addEventListener('click', (e) => {
                const optionItem = e.target.closest('.option-item');
                if (!optionItem) return;
                e.stopPropagation();
                e.preventDefault();

                const font = optionItem.dataset.val;
                if (!customizer.selectedElements || customizer.selectedElements.length === 0) {
                    console.warn('[Font] No selected elements!');
                    return;
                }

                const fontStack = FONT_STACKS[font] || `'${font}', sans-serif`;
                customizer.selectedElements.forEach(el => {
                    customizer.trackChange('font', { oldValue: el.style.fontFamily });
                    el.style.setProperty('font-family', fontStack, 'important');
                });

                document.getElementById('labelFont').textContent = font;
                customizer.updateLivePreview();

                fontPreviewContainer.querySelectorAll('.option-item').forEach(i => i.classList.remove('selected'));
                optionItem.classList.add('selected');
            }, false);
        }

        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('input', (e) => {
                customizer.selectedElements.forEach(el => { el.textContent = e.target.value; });
                customizer.updateLivePreview();
            });
            textInput.addEventListener('change', () => {
                customizer.selectedElements.forEach(() => { customizer.trackChange('text'); });
            });
        }

        hexPicker.addEventListener('input', (e) => {
            e.stopPropagation();
            const color = e.target.value;
            customizer.selectedElements.forEach(el => { el.style.setProperty('color', color, 'important'); });
            colorIndicator.style.background = color;
            hexVal.textContent = color.toUpperCase();
        });

        hexPicker.addEventListener('change', (e) => {
            e.stopPropagation();
            customizer.selectedElements.forEach(el => {
                el.style.setProperty('color', e.target.value, 'important');
                customizer.trackChange('color', { value: e.target.value });
            });
        });

        const colorGrid = document.getElementById('colorGrid');
        if (colorGrid) {
            colorGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('swatch')) {
                    e.stopPropagation();
                    e.preventDefault();
                    const color = window.getComputedStyle(e.target).backgroundColor;
                    customizer.selectedElements.forEach(el => {
                        customizer.trackChange('color', { value: color });
                        el.style.setProperty('color', color, 'important');
                    });
                    hexVal.textContent = color.toUpperCase();
                    colorIndicator.style.background = color;
                    hexPicker.value = color;
                }
            });
        }
    }

    showPanel(element) {
        const preview = document.getElementById('templateVideoPreview');
        if (preview?.querySelector('.ranking-preview-container') || element?.closest?.('.ranking-preview-container')) {
            return;
        }

        this.clearSelection();

        if (this.currentElement && this.currentElement !== element) {
            this.currentElement.style.boxShadow  = '';
            this.currentElement.style.borderRadius = '';
            this.currentElement.style.zIndex     = '';
            this.currentElement.style.position   = '';
        }

        this.currentElement    = element;
        this.selectedElements  = [element];

        const textInput = document.getElementById('textInput');
        const textView  = document.getElementById('textView');

        if (textView)  textView.style.display = 'flex';
        if (textInput) {
            textInput.value = element.textContent || '';
            const cs = window.getComputedStyle(element);
            textInput.style.fontFamily    = cs.fontFamily;
            textInput.style.fontWeight    = cs.fontWeight;
            textInput.style.fontSize      = cs.fontSize;
            textInput.style.textShadow    = cs.textShadow;
            textInput.style.letterSpacing = cs.letterSpacing;
            textInput.style.lineHeight    = cs.lineHeight;
            textInput.style.textTransform = cs.textTransform;
            textInput.style.color         = cs.color;
        }

        this.panel.style.position = 'fixed';
        this.panel.style.bottom   = '24px';
        this.panel.style.right    = '24px';
        this.panel.style.top      = 'auto';
        this.panel.style.left     = 'auto';
        this.panel.style.display  = 'flex';
        this.panel.classList.add('is-expanded');

        this.updateLivePreview();

        element.style.borderRadius = '12px';
        element.style.boxShadow    = '0 0 0 2px #ff6b3d';
        element.style.position     = 'relative';
        element.style.zIndex       = '9999';
    }

    hidePanel() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.panel.classList.remove('is-expanded');
        }

        if (this.currentElement) {
            this.currentElement.style.boxShadow   = '';
            this.currentElement.style.borderRadius = '';
            this.currentElement.style.zIndex      = '';
            this.currentElement.style.position    = '';
        }

        this.clearSelection();
        this.currentElement = null;
    }

    updateLivePreview() {
        if (!this.currentElement) return;

        const cs          = window.getComputedStyle(this.currentElement);
        const currentFont = cs.fontFamily;
        const previewText = this.currentElement.textContent || 'Sample Text';
        const styles = {
            fontWeight:    cs.fontWeight,
            fontSize:      cs.fontSize,
            textShadow:    cs.textShadow,
            letterSpacing: cs.letterSpacing,
            lineHeight:    cs.lineHeight,
            textTransform: cs.textTransform,
            color:         cs.color
        };

        [
            { id: 'preview-jakarta',   font: "'Plus Jakarta Sans', sans-serif" },
            { id: 'preview-playfair',  font: "'Playfair Display', serif" },
            { id: 'preview-jetbrains', font: "'JetBrains Mono', monospace" },
            { id: 'preview-lucky',     font: "'Luckiest Guy', cursive" }
        ].forEach(item => {
            const preview = document.getElementById(item.id);
            if (preview) {
                preview.textContent    = previewText;
                preview.style.fontFamily = item.font;
                Object.keys(styles).forEach(key => { preview.style[key] = styles[key]; });
            }
        });

        const fontPreviewContainer = document.getElementById('fontPreviewContainer');
        if (fontPreviewContainer) {
            const fontOptions = {
                'Plus Jakarta Sans': 'Plus Jakarta Sans',
                'Playfair Display':  'Playfair Display',
                'JetBrains Mono':    'JetBrains Mono',
                'Luckiest Guy':      'Luckiest Guy'
            };
            let foundFont = false;
            fontPreviewContainer.querySelectorAll('.option-item').forEach(item => {
                const itemFont         = item.dataset.val;
                const currentFontClean = currentFont.replace(/['"]/g, '').split(',')[0].trim();
                if (itemFont === currentFontClean || currentFont.includes(itemFont)) {
                    item.classList.add('selected');
                    document.getElementById('labelFont').textContent = fontOptions[itemFont] || itemFont;
                    foundFont = true;
                } else {
                    item.classList.remove('selected');
                }
            });
            if (!foundFont) {
                document.getElementById('labelFont').textContent = 'Custom';
                fontPreviewContainer.querySelectorAll('.option-item').forEach(i => i.classList.remove('selected'));
            }
        }

        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.style.fontFamily    = cs.fontFamily;
            textInput.style.fontWeight    = styles.fontWeight;
            textInput.style.fontSize      = styles.fontSize;
            textInput.style.textShadow    = styles.textShadow;
            textInput.style.letterSpacing = styles.letterSpacing;
            textInput.style.lineHeight    = styles.lineHeight;
            textInput.style.textTransform = styles.textTransform;
            textInput.style.color         = styles.color;
        }
    }

    isNumberedItem(element) {
        if (!element || !element.textContent) return false;
        return /^\d+\./.test(element.textContent.trim());
    }

    addToSelection(element) {
        if (!this.selectedElements.includes(element)) {
            this.selectedElements.push(element);
            element.style.outline       = '2px dashed #ff6b3d';
            element.style.outlineOffset = '2px';
        }
        this.updateMultiSelectUI();
    }

    clearSelection() {
        this.selectedElements.forEach(el => {
            el.style.outline       = '';
            el.style.outlineOffset = '';
        });
        this.selectedElements = [];
    }

    updateMultiSelectUI() {
        const pill = document.getElementById('pill');
        if (!pill) return;
        if (this.selectedElements.length > 1) {
            pill.classList.add('multi-select-mode');
        } else {
            pill.classList.remove('multi-select-mode');
        }
    }

    trackChange(type, data = {}) {
        if (!this.currentElement) return;

        const changeState = {
            type,
            element:   this.currentElement,
            elementId: this.currentElement.id || this.currentElement.className,
            timestamp: Date.now()
        };

        if (type === 'text')   changeState.oldText  = this.currentElement.textContent;
        if (type === 'font')   { changeState.oldFont = data.oldValue || this.currentElement.style.fontFamily; changeState.newFont = this.currentElement.style.fontFamily; }
        if (type === 'color')  { changeState.oldColor = this.getElementColor(); changeState.newColor = data.value || this.currentElement.style.color; }
        if (type === 'delete') { changeState.deletedHTML = this.currentElement.outerHTML; changeState.deletedParent = this.currentElement.parentElement; }

        this.undoStack.push(changeState);
        this.redoStack = [];
    }

    getElementColor() {
        if (!this.currentElement) return '#0f172a';
        return window.getComputedStyle(this.currentElement).color || this.currentElement.style.color || '#0f172a';
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const lastChange = this.undoStack.pop();
        const redoState  = { ...lastChange };

        if (lastChange.type === 'text')   redoState.newText     = lastChange.element.textContent;
        if (lastChange.type === 'font')   redoState.currentFont = lastChange.element.style.fontFamily;
        if (lastChange.type === 'color')  redoState.currentColor = lastChange.element.style.color;
        this.redoStack.push(redoState);

        switch (lastChange.type) {
            case 'text':   lastChange.element.textContent = lastChange.oldText; break;
            case 'font':   lastChange.element.style.setProperty('font-family', lastChange.oldFont, 'important'); break;
            case 'color':  lastChange.element.style.setProperty('color', lastChange.oldColor, 'important'); break;
            case 'delete': if (lastChange.deletedParent) lastChange.deletedParent.innerHTML += lastChange.deletedHTML; break;
        }
        this.updatePanel();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const lastUndo = this.redoStack.pop();
        this.undoStack.push({ ...lastUndo });

        switch (lastUndo.type) {
            case 'text':   lastUndo.element.textContent = lastUndo.newText; break;
            case 'font':   lastUndo.element.style.setProperty('font-family', lastUndo.newFont, 'important'); break;
            case 'color':  lastUndo.element.style.setProperty('color', lastUndo.newColor, 'important'); break;
            case 'delete': if (lastUndo.deletedParent) lastUndo.deletedParent.innerHTML += lastUndo.deletedHTML; break;
        }
        this.updatePanel();
    }

    updatePanel() {
        if (this.currentElement && this.panel && this.panel.style.display !== 'none') {
            const textInput = document.getElementById('textInput');
            if (textInput) textInput.value = this.currentElement.textContent || '';

            const colorIndicator = document.getElementById('colorIndicator');
            const hexVal         = document.getElementById('hexVal');
            const color          = window.getComputedStyle(this.currentElement).color || '#0f172a';
            if (colorIndicator) colorIndicator.style.background = color;
            if (hexVal)         hexVal.textContent = this.rgbToHex(color).toUpperCase();
        }
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        const matches = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!matches) return '#0f172a';
        return `#${parseInt(matches[1]).toString(16).padStart(2, '0')}${parseInt(matches[2]).toString(16).padStart(2, '0')}${parseInt(matches[3]).toString(16).padStart(2, '0')}`;
    }

    attachClickListeners() {

        const preview = document.getElementById('templateVideoPreview');
        if (!preview) {
            setTimeout(() => this.attachClickListeners(), 1000);
            return;
        }

        preview.style.userSelect = 'text';
        preview.style.WebkitUserSelect = 'text';

        const wrapTextNodes = (element) => {
            const skipSelectors = ['.title', '.ranking-list', '.ranked-item', '.funniest', '.text-stroke', '[class*="rank-"]'];
            if (skipSelectors.some(sel => element.querySelector(sel))) return;

            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            const nodesToWrap = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim().length > 0 && node.parentElement !== element) {
                    if (node.parentElement.className &&
                        (node.parentElement.className.includes('funniest') ||
                         node.parentElement.className.includes('text-stroke') ||
                         (node.parentElement.className && !node.parentElement.className.includes('text-node-wrapper')))) continue;
                    nodesToWrap.push(node);
                }
            }
            nodesToWrap.reverse().forEach(textNode => {
                if (textNode.parentElement.tagName === 'SPAN' && textNode.parentElement.className) return;
                const span = document.createElement('span');
                span.className = 'text-node-wrapper';
                textNode.parentElement.insertBefore(span, textNode);
                span.appendChild(textNode);
            });
        };

        wrapTextNodes(preview);

        preview.addEventListener('mouseup', (e) => {
            if (e.target.closest('.solis-watermark')) return;
            if (e.target.closest('[data-no-text-select="true"]')) return;
            if (preview.querySelector('.ranking-preview-container') || e.target.closest('.ranking-preview-container')) {
                return;
            }

            const isShiftHeld = e.shiftKey;
            let target = e.target;

            if (target && target !== preview && !target.closest('.solis-watermark')) {
                if (target.textContent?.trim() && target.textContent.trim().length < 200) {
                    e.stopPropagation();
                    if (isShiftHeld && this.currentElement) {
                        this.addToSelection(target);
                    } else {
                        this.showPanel(target);
                    }
                    return;
                }
            }

            const selection   = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText && selectedText.length > 0) {
                let range     = selection.getRangeAt(0);
                let container = range.commonAncestorContainer;

                if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
                while (container && !container.textContent?.trim() && container !== preview) {
                    container = container.parentElement;
                }

                if (container && container !== preview && !container.closest('.solis-watermark')) {
                    e.stopPropagation();
                    if (isShiftHeld && this.currentElement) {
                        this.addToSelection(container);
                    } else {
                        this.showPanel(container);
                    }
                }
            }
        }, true);

        preview.addEventListener('mouseover', (e) => {
            const target = e.target;
            if (target && target !== preview && !target.closest('.solis-watermark')) {
                if (target.textContent?.trim() && target.textContent.trim().length < 200) {
                    target.style.cursor = 'pointer';
                    if (!target.style.background || target.style.background === '') {
                        target.style.transition = 'background 0.15s ease';
                    }
                }
            }
        });

        preview.addEventListener('mouseout', (e) => {
            const target = e.target;
            if (target && target._originalBg === undefined && target.style.background === 'rgba(255, 107, 0, 0.08)') {
                target.style.background = '';
            }
        });
    }

    getElementCustomizationId(element) {
        if (!element) return '';
        let elementId = element.getAttribute('data-template-element-id')
            || element.getAttribute('data-element-id')
            || element.id;
        if (!elementId && element.parentElement) {
            elementId = element.parentElement.getAttribute('data-template-element-id')
                || element.parentElement.getAttribute('data-element-id')
                || '';
        }
        return elementId || '';
    }

    ensureCustomizationBaselines(preview = document.getElementById('templateVideoPreview')) {
        if (!preview) return;
        preview.querySelectorAll('[data-template-element-id], .text-node-wrapper, [data-element-id]').forEach(element => {
            if (!this.getElementCustomizationId(element)) return;
            if (element.dataset.customizerBaseText === undefined) {
                element.dataset.customizerBaseText = (element.textContent || '').trim();
            }
            const cs = window.getComputedStyle(element);
            if (element.dataset.customizerBaseColor === undefined) {
                element.dataset.customizerBaseColor = cs.color || '';
            }
            if (element.dataset.customizerBaseFont === undefined) {
                element.dataset.customizerBaseFont = (cs.fontFamily || '').replace(/['"]/g, '').split(',')[0].trim();
            }
        });
    }

    colorToRgbaArray(color) {
        if (!color) return null;
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10), 255];
        }
        const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
        if (hexMatch) {
            const hex = hexMatch[1];
            return [
                parseInt(hex.slice(0, 2), 16),
                parseInt(hex.slice(2, 4), 16),
                parseInt(hex.slice(4, 6), 16),
                255
            ];
        }
        return null;
    }

    collectCustomizations() {
        const customizations = JSON.parse(JSON.stringify(
            window.currentCustomizations?.customizations || {}
        ));
        const preview = document.getElementById('templateVideoPreview');
        if (!preview) return customizations;
        this.ensureCustomizationBaselines(preview);

        preview.querySelectorAll('[data-template-element-id], .text-node-wrapper, [data-element-id]').forEach(element => {
            const elementId = this.getElementCustomizationId(element);
            if (!elementId) return;

            const cs = window.getComputedStyle(element);
            const updates = customizations[elementId] ? { ...customizations[elementId] } : {};

            const elementText = element.textContent?.trim();
            const baseText = element.dataset.customizerBaseText || '';
            if (
                elementText
                && elementText.length > 0
                && elementText.length < 500
                && !elementText.includes('[')
                && !elementText.includes(']')
                && elementText !== baseText
            ) {
                updates.content = elementText;
            } else {
                delete updates.content;
            }

            const baseColor = element.dataset.customizerBaseColor || '';
            if (cs.color && cs.color !== baseColor) {
                const rgba = this.colorToRgbaArray(cs.color);
                if (rgba) updates.color = rgba;
            } else {
                delete updates.color;
            }

            const currentFont = (cs.fontFamily || '').replace(/['"]/g, '').split(',')[0].trim();
            const baseFont = element.dataset.customizerBaseFont || '';
            if (currentFont && currentFont !== baseFont) {
                updates.font = currentFont;
            } else {
                delete updates.font;
            }

            if (Object.keys(updates).length > 0) {
                customizations[elementId] = updates;
            } else {
                delete customizations[elementId];
            }
        });

        return customizations;
    }

    async saveCustomizations(templateId = 'ranking_moments') {
        try {
            const customizations = this.collectCustomizations();
            if (Object.keys(customizations).length === 0) return { message: 'No customizations to save' };

            const apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
            const headers = getAuthHeaders();

            const response = await fetch(`${apiBase}/clips/apply-customizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                credentials: 'include',
                body: JSON.stringify({ template_id: templateId, customizations })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: Failed to save customizations`);
            }

            const result = await response.json();
            window.currentCustomizations = { template_id: templateId, customizations, timestamp: Date.now(), saved_at: result.applied_at };
            if (window.showNotification) window.showNotification('Customizations saved successfully!', 'success');
            return result;
        } catch (error) {
            if (window.showNotification) window.showNotification(`Failed to save: ${error.message}`, 'error');
            throw error;
        }
    }

    async loadCustomizations(templateId = 'ranking_moments') {
        try {
            const apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
            const headers = getAuthHeaders();

            const response = await fetch(`${apiBase}/clips/get-customizations/${templateId}`, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response.ok) return null;

            const result = await response.json();
            if (!result.has_customizations) return null;

            window.currentCustomizations = { template_id: templateId, customizations: result.customizations, timestamp: Date.now(), saved_at: result.saved_at };
            return result.customizations;
        } catch (error) {
            console.error('[Customizer] Error loading customizations:', error);
            return null;
        }
    }

    getCustomizationsForGeneration() {
        if (!window.currentCustomizations) return null;
        const ageMs = Date.now() - window.currentCustomizations.timestamp;
        if (ageMs > 5 * 60 * 1000) { window.currentCustomizations = null; return null; }
        return window.currentCustomizations.customizations;
    }
}

const customizer = (() => {
    let instance = null;

    const createCustomizer = () => {
        if (instance) return instance;
        instance = new FloatingCustomizeBar();
        window.customizer = instance;
        return instance;
    };

    window.showGameplayPanel = (clickX, clickY) => {
        const pill = document.getElementById('pill');
        if (!pill) { console.error('[Gameplay Panel] Pill container not found'); return; }
        if (pill.classList.contains('is-expanded')) { return; }

        const margin      = 20;
        const panelWidth  = 450;
        const panelHeight = 150;

        let x = clickX + margin;
        let y = clickY - panelHeight / 2;

        if (x + panelWidth > window.innerWidth) x = clickX - panelWidth - margin;
        y = Math.max(20, Math.min(y, window.innerHeight - panelHeight - 20));

        pill.classList.remove('gameplay-mode');
        pill.style.position = 'fixed';
        pill.style.bottom   = 'auto';
        pill.style.right    = 'auto';
        pill.style.top      = y + 'px';
        pill.style.left     = x + 'px';
        pill.style.transform = 'none';

        const pillActions = pill.querySelector('.pill-actions');
        if (pillActions) pillActions.style.display = 'none';

        pill.style.display = 'flex';

        let gameplayView = document.getElementById('gameplayView');
        const needsRecreate = !gameplayView || !gameplayView.parentElement;

        if (gameplayView && !needsRecreate) {
            gameplayView.style.display = 'flex';
            gameplayView.classList.add('visible');
        } else {
            if (gameplayView) gameplayView.remove();

            gameplayView = document.createElement('div');
            gameplayView.id = 'gameplayView';
            gameplayView.className = 'view';
            gameplayView.style.cssText = 'display: flex; flex-direction: column; width: 100%; gap: 0;';

            const contentInner = pill.querySelector('.content-inner');
            if (contentInner) contentInner.appendChild(gameplayView);

            gameplayView.innerHTML = `
                <style>
                    @keyframes loadingSpinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    .gameplay-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
                    .gameplay-loading.active { opacity: 1; }
                    .gameplay-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,107,0,0.3); border-top-color: #ff6b00; border-radius: 50%; animation: loadingSpinner 0.6s linear infinite; }
                </style>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%;">
                    ${availableGameplayClips.slice(0, 4).map(clip => `
                        <div data-clip-id="${clip.id}" class="gameplay-card-option"
                             style="position: relative; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid #e2e8f0; transition: all 0.3s; ${selectedGameplayClip === clip.id ? 'border-color: #ff6b00; box-shadow: 0 4px 12px rgba(255,107,0,0.2);' : ''}">
                            <video style="width: 100%; height: 100%; object-fit: cover; display: block;" muted loop playsinline autoplay>
                                <source src="/assets/${clip.filename}" type="video/mp4">
                            </video>
                            <div class="gameplay-loading"><div class="gameplay-spinner"></div></div>
                        </div>
                    `).join('')}
                </div>
            `;

            gameplayView.querySelectorAll('.gameplay-card-option').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const clipId = card.dataset.clipId;
                    const clip   = availableGameplayClips.find(c => c.id === clipId);

                    selectGameplayClip(clipId);

                    gameplayView.querySelectorAll('.gameplay-card-option').forEach(c => {
                        c.style.borderColor = '#e2e8f0';
                        c.style.boxShadow   = 'none';
                    });
                    card.style.borderColor = '#ff6b00';
                    card.style.boxShadow   = '0 4px 12px rgba(255,107,0,0.2)';

                    const loadingEl = card.querySelector('.gameplay-loading');
                    if (loadingEl) loadingEl.classList.add('active');

                    setTimeout(() => {
                        const mainVideo = document.getElementById('splitscreenGameplayVideo');
                        if (mainVideo && clip) {
                            const sourceEl = mainVideo.querySelector('source');
                            if (sourceEl) sourceEl.src = `/assets/${clip.filename}`;
                            else mainVideo.src = `/assets/${clip.filename}`;
                            mainVideo.load();
                            mainVideo.play().catch(() => {});
                        }
                        if (loadingEl) loadingEl.classList.remove('active');
                    }, 300);
                });
            });
        }

        const allViews = pill.querySelectorAll('.view');
        allViews.forEach(v => { v.classList.remove('visible'); v.style.display = 'none'; });
        gameplayView.classList.add('visible');
        gameplayView.style.display = 'flex';
        pill.classList.add('is-expanded', 'slide-in', 'gameplay-mode');

        if (window.gameplayClickOutsideHandler) {
            document.removeEventListener('click', window.gameplayClickOutsideHandler);
            window.gameplayClickOutsideHandler = null;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => { createCustomizer(); window.customizer = instance; }, 500);
        });
    } else {
        setTimeout(() => { createCustomizer(); window.customizer = instance; }, 500);
    }

    window.initializeFloatingCustomizer = (reinitialize = false) => {
        if (reinitialize && instance) {
            const oldPill = document.getElementById('pill');
            if (oldPill) oldPill.remove();
            instance = null;
        }

        const customizer = createCustomizer();
        const pill = document.getElementById('pill');
        if (pill) {
            pill.style.position = 'fixed';
            pill.style.bottom   = '24px';
            pill.style.right    = '24px';
            pill.style.top      = 'auto';
            pill.style.left     = 'auto';
        }
        return customizer;
    };
})();
