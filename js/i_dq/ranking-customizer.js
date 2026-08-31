/**
 * 🎬 RANKING CUSTOMIZER - Template Element Editor
 * Syncs live preview DOM → backend drawtext overrides (font, color, size, stroke).
 */

const RANKING_VIDEO_WIDTH = 1080;
/* Caption Outline / Thick — same as sub-color-line SH */
const RANKING_OUTLINE_OFFSETS = [
    [2, 0], [-2, 0], [0, 2], [0, -2],
    [1, 1], [-1, -1], [1, -1], [-1, 1],
];

const RANKING_THIN_OUTLINE_OFFSETS = RANKING_OUTLINE_OFFSETS;

const RANKING_THICK_OUTLINE_OFFSETS = [
    [3, 0], [-3, 0], [0, 3], [0, -3],
    [2, 2], [-2, -2], [2, -2], [-2, 2],
];

const RANKING_STROKE_CSS =
    '2px 0 0 #000,-2px 0 0 #000,0 2px 0 #000,0 -2px 0 #000,' +
    '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000';

const RANKING_SHADOW_CSS = {
    none: 'none',
    stroke: RANKING_STROKE_CSS,
    outline: RANKING_STROKE_CSS,
    'thick-outline':
        '3px 0 0 #000,-3px 0 0 #000,0 3px 0 #000,0 -3px 0 #000,' +
        '2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000',
};

const RANKING_OFFSETS_BY_STYLE = {
    stroke: RANKING_OUTLINE_OFFSETS,
    outline: RANKING_THIN_OUTLINE_OFFSETS,
    'thick-outline': RANKING_THICK_OUTLINE_OFFSETS,
    none: [],
};

const RANKING_FONT_TO_FILE = {
    'Luckiest Guy': 'LuckiestGuy-Regular.ttf',
    'Bebas Neue': 'BebasNeue-Regular.ttf',
    'Anton': 'Anton-Regular.ttf',
    'Montserrat': 'Montserrat-Bold.ttf',
    'Poppins': 'Poppins-SemiBold.ttf',
    'Roboto': 'Roboto-Bold.ttf',
    'Fredoka': 'Fredoka-Bold.ttf',
};

const RANKING_FONT_WEIGHT = {
    'Luckiest Guy': '400',
    'Bebas Neue': '400',
    'Anton': '400',
    'Montserrat': '700',
    'Poppins': '600',
    'Roboto': '700',
    'Fredoka': '700',
};

const RANKING_FILE_TO_FONT = Object.fromEntries(
    Object.entries(RANKING_FONT_TO_FILE).map(([name, file]) => [file, name])
);

class RankingCustomizer {
    constructor() {
        this.customizations = {};
        this.selectedElement = null;
        this.elementElements = new Map(); // Map element IDs to DOM elements
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.loadDefaultElements();
    }

    createUI() {
        // Check if UI already exists
        if (document.getElementById('ranking-customizer-panel')) return;

        const container = document.createElement('div');
        container.id = 'ranking-customizer-panel';
        container.className = 'ranking-customizer';
        container.innerHTML = `
            <div class="ranking-customizer-header">
                <h3>✏️ Ranking Template Editor</h3>
                <button class="ranking-customizer-close" onclick="rankingCustomizer.toggle()">×</button>
            </div>
            
            <div class="ranking-customizer-content">
                <!-- Main Titles Section -->
                <div class="ranking-section">
                    <h4>📌 Main Titles</h4>
                    <div class="ranking-edit-group">
                        <label>Title 1 (e.g., "RANKING")</label>
                        <input type="text" data-element="title_ranking" placeholder="RANKING" maxlength="30">
                    </div>
                    <div class="ranking-edit-group">
                        <label>Title 2 (e.g., "BEST")</label>
                        <input type="text" data-element="title_funniest" placeholder="BEST" maxlength="30">
                    </div>
                    <div class="ranking-edit-group">
                        <label>Subtitle</label>
                        <input type="text" data-element="title_channel" placeholder="CHANNEL MOMENTS" maxlength="40">
                    </div>
                </div>

                <!-- Rank Elements Section -->
                <div class="ranking-section">
                    <h4>🏆 Rank Titles (1-5)</h4>
                    <div id="ranking-ranks-container">
                        <!-- Populated by JavaScript -->
                    </div>
                </div>

                <!-- Color customization -->
                <div class="ranking-section" style="display:none;" id="ranking-colors-section">
                    <h4>🎨 Colors</h4>
                    <div id="ranking-color-controls">
                        <!-- Populated when element selected -->
                    </div>
                </div>

                <!-- Preview -->
                <div class="ranking-section">
                    <h4>👁️ Preview</h4>
                    <p style="font-size: 12px; color: #888; margin-top: 8px;">Double-click template elements to customize them</p>
                </div>
            </div>
        `;

        document.body?.appendChild(container);
        this.panel = container;
    }

    loadDefaultElements() {
        // Load rank input fields
        const ranksContainer = document.getElementById('ranking-ranks-container');
        if (!ranksContainer) return;

        for (let i = 1; i <= 5; i++) {
            const group = document.createElement('div');
            group.className = 'ranking-edit-group';
            group.innerHTML = `
                <label>Rank ${i} Title</label>
                <input type="text" data-element="rank_${i}_title" placeholder="Rank ${i} Moment Title" maxlength="50">
                <label style="margin-top: 8px; font-size: 12px; display: block;">Color</label>
                <div class="ranking-color-picker" data-element="rank_${i}_title" style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${this.createColorPalette(`rank_${i}_title`)}
                </div>
            `;
            ranksContainer.appendChild(group);
        }
    }

    createColorPalette(elementId) {
        const colors = [
            { name: 'Gold', rgb: 'rgb(255, 215, 0)' },
            { name: 'Silver', rgb: 'rgb(192, 192, 192)' },
            { name: 'Bronze', rgb: 'rgb(205, 127, 50)' },
            { name: 'White', rgb: 'rgb(255, 255, 255)' },
            { name: 'Red', rgb: 'rgb(255, 0, 0)' },
            { name: 'Cyan', rgb: 'rgb(0, 255, 255)' },
            { name: 'Lime', rgb: 'rgb(0, 255, 0)' },
            { name: 'Yellow', rgb: 'rgb(255, 255, 0)' }
        ];

        return colors.map(color => `
            <button class="ranking-color-btn" style="background-color: ${color.rgb}; width: 32px; height: 32px; border-radius: 4px; border: 2px solid #333; cursor: pointer;" 
                    onclick="rankingCustomizer.setElementColor('${elementId}', '${color.rgb}')" 
                    title="${color.name}"></button>
        `).join('');
    }

    setupEventListeners() {
        // Text inputs
        document.addEventListener('input', (e) => {
            if (e.target.matches('[data-element]')) {
                const elementId = e.target.getAttribute('data-element');
                const value = e.target.value;
                this.setElementContent(elementId, value);
            }
        });

        // Load saved customizations — per-user key so accounts don't share styles
        this._loadStoredCustomizations();
    }

    _storageKey() {
        try {
            const uid = window.currentUser?.id
                || window.currentUser?.user_id
                || window.SolisMemory?._resolveUserId?.()
                || null;
            if (uid != null && String(uid).trim() !== '') {
                return `rankingCustomizations:u${uid}`;
            }
        } catch (_) { /* ignore */ }
        return 'rankingCustomizations';
    }

    _loadStoredCustomizations() {
        const key = this._storageKey();
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (_) { raw = null; }
        // One-time migrate legacy global key into the current user's bucket
        if (!raw && key !== 'rankingCustomizations') {
            try {
                const legacy = localStorage.getItem('rankingCustomizations');
                if (legacy) {
                    raw = legacy;
                    localStorage.setItem(key, legacy);
                    localStorage.removeItem('rankingCustomizations');
                }
            } catch (_) { /* ignore */ }
        }
        if (!raw) return;
        try {
            this.customizations = this._sanitizeCustoms(JSON.parse(raw));
            this.applyCustomizations();
        } catch (e) {
            console.warn('Failed to load saved customizations:', e);
        }
    }

    /** Fix stale localStorage that flattened strokes / saved preview-px as video font sizes */
    _sanitizeCustoms(raw) {
        const customs = (raw && typeof raw === 'object') ? raw : {};
        for (const [id, node] of Object.entries(customs)) {
            if (!node || typeof node !== 'object') continue;
            const isTitle = id.startsWith('title_') || id.startsWith('rank_');
            if (!isTitle) continue;
            // Accidental stroke wipe from older sync — restore template stroke
            if (node.stroke_style === 'none' && (!node.outline_offsets || !node.outline_offsets.length)) {
                delete node.stroke_style;
                delete node.outline_offsets;
            }
            // Preview-px mistakenly stored as video size → tiny unreadable text
            // Keep intentional small 1080p sizes (>= 20). Old bug stored ~12–18 preview px.
            if (typeof node.font_size === 'number' && node.font_size > 0 && node.font_size < 20) {
                delete node.font_size;
            }
            // Soft cap — keep burn sizes in a sane range (matches preview hard caps)
            if (id.startsWith('title_') && typeof node.font_size === 'number' && node.font_size > 160) {
                node.font_size = 160;
            }
            if (id.startsWith('rank_') && typeof node.font_size === 'number' && node.font_size > 150) {
                node.font_size = 150;
            }
            if (typeof node.content === 'string') {
                node.content = node.content
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, id.startsWith('title_') ? 28 : 42);
                // Restore classic accent if an older build forced FUNNIEST
                if (id === 'title_funniest' && /^funniest$/i.test(node.content)) {
                    node.content = 'BEST';
                }
            }
        }
        return customs;
    }

    setElementContent(elementId, content) {
        if (!this.customizations[elementId]) {
            this.customizations[elementId] = {};
        }
        this.customizations[elementId].content = content;
        this.saveCustomizations();
    }

    setElementColor(elementId, rgbColor) {
        if (!elementId) return;
        if (!this.customizations[elementId]) {
            this.customizations[elementId] = {};
        }
        const rgba = this._colorToRgba(rgbColor);
        if (rgba) {
            this.customizations[elementId].color = rgba;
            this.saveCustomizations();
        }
    }

    /** Persist preview px → 1080p font_size into customs immediately. */
    setElementFontSizeScaled(elementId, previewPx) {
        if (!elementId || !(previewPx > 0)) return;
        if (!this.customizations[elementId]) {
            this.customizations[elementId] = {};
        }
        this.customizations[elementId].font_size = this._scaleFontSize(previewPx);
        this.saveCustomizations();
    }

    /** Write stroke style into customs (matches pill Outline / Thick / None). */
    setElementStrokeStyle(elementId, strokeStyle) {
        if (!elementId) return;
        if (!this.customizations[elementId]) {
            this.customizations[elementId] = {};
        }
        const style = String(strokeStyle || 'outline').trim().toLowerCase() || 'outline';
        this.customizations[elementId].stroke_style = style;
        if (style === 'none') {
            this.customizations[elementId].outline_offsets = [];
            this.customizations[elementId].outline_color = null;
        } else {
            const offsets = RANKING_OFFSETS_BY_STYLE[style] || RANKING_OUTLINE_OFFSETS;
            this.customizations[elementId].outline_offsets = offsets.map((p) => [...p]);
            this.customizations[elementId].outline_color = [0, 0, 0, 255];
        }
        this.saveCustomizations();
    }

    /**
     * Flush one preview element’s live styles into customs (font/color/size/stroke).
     * Used by the text pill so export never depends on a late syncFromDOM.
     */
    persistElementStyles(el) {
        if (!el?.getAttribute) return;
        const elementId = el.getAttribute('data-template-element-id');
        if (!elementId) return;
        if (!this.customizations[elementId]) this.customizations[elementId] = {};
        const node = this.customizations[elementId];

        const text = (el.textContent || '').trim()
            || String(el.getAttribute('data-rk-full-title') || '').trim();
        if (elementId.endsWith('_number') && elementId.startsWith('rank_')) {
            delete node.content;
            delete node.contentHtml;
        } else if (text) {
            node.content = text;
            if (el.querySelector('span[style*="color"]')) {
                node.contentHtml = el.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
            } else {
                delete node.contentHtml;
            }
        }

        // Prefer attr / lock / existing customs — CSS default Luckiest Guy must never
        // clobber a real pick just because resize re-read getComputedStyle.
        node.font = this._resolvePersistFont(el, elementId, node);
        try { this._writeFontLock({ [elementId]: node.font }); } catch (_) { /* ignore */ }

        const colorRaw = el.style.color || el.style.getPropertyValue('color') || '';
        const rgba = this._colorToRgba(colorRaw)
            || this._colorToRgba(getComputedStyle(el).color);
        if (rgba) node.color = rgba;

        const inlineFs = el.style.fontSize || el.style.getPropertyValue('font-size');
        const previewPx = inlineFs && inlineFs !== 'inherit'
            ? parseFloat(inlineFs)
            : parseFloat(getComputedStyle(el).fontSize);
        if (previewPx > 0) {
            node.font_size = this._scaleFontSize(previewPx);
        }

        const stroke = this._readStrokeState(el);
        node.stroke_style = stroke.style;
        if (stroke.enabled) {
            node.outline_color = [0, 0, 0, 255];
            const offsets = RANKING_OFFSETS_BY_STYLE[stroke.style] || RANKING_OUTLINE_OFFSETS;
            node.outline_offsets = offsets.map((p) => [...p]);
        } else {
            node.outline_offsets = [];
            node.outline_color = null;
        }
        this.saveCustomizations();
    }

    /** Persist every ranking element currently in the preview phone. */
    persistAllPreviewStyles() {
        const container = this._getActiveRankingContainer();
        if (!container) return;
        container.querySelectorAll('[data-template-element-id]').forEach((el) => {
            try { this.persistElementStyles(el); } catch (_) { /* ignore */ }
        });
        this._propagateRankNumberStyles();
        // Stack / blank-blur layout
        try {
            if (window.__solisRankingLayout) {
                this.customizations.__ranking_layout = {
                    ...(this.customizations.__ranking_layout || {}),
                    ...window.__solisRankingLayout,
                };
            }
        } catch (_) { /* ignore */ }
        this.saveCustomizations();
    }

    saveCustomizations() {
        const key = typeof this._storageKey === 'function' ? this._storageKey() : 'rankingCustomizations';
        try {
            localStorage.setItem(key, JSON.stringify(this.customizations));
            // Never leave a shared global key that bleeds across accounts
            if (key !== 'rankingCustomizations') {
                localStorage.removeItem('rankingCustomizations');
            }
        } catch (_) { /* ignore */ }
        try {
            sessionStorage.setItem(
                'solisPendingRankingCustoms',
                JSON.stringify(this.customizations || {}),
            );
        } catch (_) { /* ignore */ }
        // Keep style lock in sync whenever fonts/colors change — never let a
        // layout-only write erase a previous font-rich lock.
        try {
            this._patchStyleLock(this.customizations);
        } catch (_) { /* ignore */ }
        try {
            if (window.SolisMemory && !window.SolisMemory._applying && typeof window.SolisMemory.noteEdit === 'function') {
                const tid = window.clipsStudio?.currentTemplateForPreview?.id || 'ranked_compilation';
                window.SolisMemory.noteEdit(tid);
            }
        } catch (_) { /* ignore */ }
        // Library post-gen edits → Apply & Download must persist styles/positions
        try {
            const studio = window.clipsStudio;
            if (studio?.currentTemplateForPreview?.isLibraryPreview && studio._libraryRankingEditable) {
                if (studio._libraryDirtyArmed === false) return;
                studio._libraryRankingDirty = true;
                if (typeof window.syncLibraryConfirmLabel === 'function') window.syncLibraryConfirmLabel();
                else {
                    const btn = document.getElementById('confirmUseTemplateBtn');
                    if (btn) {
                        btn.textContent = 'Apply & Download';
                        btn.classList.add('library-download-mode');
                    }
                    if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
                }
            }
        } catch (_) { /* ignore */ }
    }

    /** Count elements that carry an explicit font override. */
    countFonts(map) {
        if (!map || typeof map !== 'object') return 0;
        return Object.entries(map).filter(
            ([k, v]) => k !== '__ranking_layout' && v && typeof v === 'object' && v.font
        ).length;
    }

    /**
     * Merge incoming styles into solisRankingStyleLock without wiping fonts.
     * Font-rich locks always win over layout-only / content-only bags.
     */
    _patchStyleLock(incoming) {
        if (!incoming || typeof incoming !== 'object') return;
        let prev = null;
        try {
            prev = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
        } catch (_) { prev = null; }
        const merged = {};
        const sources = [prev, incoming].filter((m) => m && typeof m === 'object');
        sources.forEach((src) => {
            Object.entries(src).forEach(([k, v]) => {
                if (!v || typeof v !== 'object') {
                    if (v != null) merged[k] = v;
                    return;
                }
                const node = { ...(merged[k] && typeof merged[k] === 'object' ? merged[k] : {}) };
                Object.entries(v).forEach(([pk, pv]) => {
                    if (pv !== undefined && pv !== null && pv !== '') node[pk] = pv;
                });
                merged[k] = node;
            });
        });
        // Prefer the richer font bag if merge somehow dropped them
        if (this.countFonts(merged) === 0 && this.countFonts(prev) > 0) {
            sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(prev));
            window.__solisRankingStyleLock = prev;
            return;
        }
        sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(merged));
        window.__solisRankingStyleLock = merged;
    }

    _getActiveRankingContainer() {
        // Prefer the live preview in the modal; fall back to first ranking container.
        return document.querySelector('#templateVideoPreview .ranking-preview-container')
            || document.querySelector('.ranking-preview-container');
    }

    /** Map preview px → 1080p video font size */
    _scaleFontSize(previewPx) {
        const container = this._getActiveRankingContainer();
        const w = container?.clientWidth || 280;
        return Math.max(12, Math.round(previewPx * (RANKING_VIDEO_WIDTH / w)));
    }

    _normalizeFont(fontFamily) {
        if (!fontFamily) return RANKING_FONT_TO_FILE['Luckiest Guy'];
        const name = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
        // Bebas Neue is offered in the UI but the .ttf is not shipped — map to Anton
        // so burns never silently fall through to Luckiest Guy.
        if (/^bebas(\s*neue)?$/i.test(name) || /^bebasneue/i.test(name)) {
            return RANKING_FONT_TO_FILE.Anton;
        }
        if (name.endsWith('.ttf') || name.endsWith('.otf')) {
            if (/bebas/i.test(name)) return RANKING_FONT_TO_FILE.Anton;
            const byFile = RANKING_FILE_TO_FONT[name]
                || Object.keys(RANKING_FILE_TO_FONT).find((f) => f.toLowerCase() === name.toLowerCase());
            if (byFile) {
                const display = RANKING_FILE_TO_FONT[byFile] || RANKING_FILE_TO_FONT[name];
                return RANKING_FONT_TO_FILE[display] || name;
            }
            return name;
        }
        if (RANKING_FONT_TO_FILE[name]) return RANKING_FONT_TO_FILE[name];
        const byName = Object.keys(RANKING_FONT_TO_FILE).find(
            (k) => k.toLowerCase() === name.toLowerCase()
        );
        if (byName) return RANKING_FONT_TO_FILE[byName];
        return RANKING_FONT_TO_FILE['Luckiest Guy'];
    }

    _isDefaultLuckiest(fontFamilyOrFile) {
        if (!fontFamilyOrFile) return true;
        const display = this._displayFont(fontFamilyOrFile);
        return display === 'Luckiest Guy';
    }

    /**
     * Resolve font for persist/sync without letting template CSS (Luckiest Guy)
     * overwrite an explicit user/AI font after resize.
     */
    _resolvePersistFont(el, elementId, node) {
        const attr = el?.getAttribute?.('data-rk-font');
        if (attr) return this._normalizeFont(attr);

        const lock = this._readFontLock()?.[elementId];
        if (lock) return this._normalizeFont(lock);

        if (node?.font) return this._normalizeFont(node.font);

        const inline = (
            el?.style?.getPropertyValue?.('font-family')
            || el?.style?.fontFamily
            || ''
        ).trim();
        if (inline) return this._normalizeFont(inline);

        let computed = '';
        try { computed = getComputedStyle(el).fontFamily || ''; } catch (_) { /* ignore */ }
        return this._normalizeFont(computed || 'Luckiest Guy');
    }

    /** Dedicated font bag — layout-only saves must never erase these. */
    _readFontLock() {
        try {
            return JSON.parse(sessionStorage.getItem('solisRankingFontLock') || '{}') || {};
        } catch (_) {
            return {};
        }
    }

    _writeFontLock(partial) {
        if (!partial || typeof partial !== 'object') return;
        const prev = this._readFontLock();
        const next = { ...prev };
        Object.entries(partial).forEach(([eid, font]) => {
            if (eid && font) next[eid] = font;
        });
        try {
            sessionStorage.setItem('solisRankingFontLock', JSON.stringify(next));
            window.__solisRankingFontLock = next;
        } catch (_) { /* ignore */ }
    }

    /** Write font into customs immediately (export path must not depend on DOM re-read). */
    setElementFontFile(elementId, fontFileOrFamily) {
        if (!elementId) return;
        if (!this.customizations[elementId]) this.customizations[elementId] = {};
        const file = this._normalizeFont(fontFileOrFamily);
        this.customizations[elementId].font = file;
        this.saveCustomizations();
        try {
            this._writeFontLock({ [elementId]: file });
            this._patchStyleLock({
                [elementId]: { font: file },
            });
        } catch (_) { /* ignore */ }
    }

    /** Resolve stored font (.ttf or display name) → CSS family name */
    _displayFont(stored) {
        if (!stored) return 'Luckiest Guy';
        const raw = String(stored).replace(/['"]/g, '').split(',')[0].trim();
        if (RANKING_FONT_TO_FILE[raw]) return raw;
        if (RANKING_FILE_TO_FONT[raw]) return RANKING_FILE_TO_FONT[raw];
        const lower = raw.toLowerCase();
        const byName = Object.keys(RANKING_FONT_TO_FILE).find((k) => k.toLowerCase() === lower);
        if (byName) return byName;
        const byFile = Object.keys(RANKING_FILE_TO_FONT).find((f) => f.toLowerCase() === lower);
        if (byFile) return RANKING_FILE_TO_FONT[byFile];
        return 'Luckiest Guy';
    }

    _readStrokeState(el) {
        const cs = getComputedStyle(el);
        const shadow = (el.style.textShadow || cs.textShadow || '').replace(/\s+/g, ' ');
        if (!shadow || shadow === 'none') {
            if (el.classList.contains('text-stroke')) {
                return { enabled: true, style: 'outline' };
            }
            return { enabled: false, style: 'none' };
        }
        if (shadow.includes('3px 0') || shadow.includes('3px 0px')) {
            return { enabled: true, style: 'thick-outline' };
        }
        // Caption Outline (default) — including legacy "stroke" class
        return { enabled: true, style: 'outline' };
    }

    _applyStrokeStyleToElement(el, strokeStyle) {
        if (!el) return;
        if (strokeStyle === 'none') {
            el.classList.remove('text-stroke');
            el.style.textShadow = 'none';
            return;
        }
        if (strokeStyle === 'stroke') {
            el.classList.add('text-stroke');
            el.style.textShadow = '';
            return;
        }
        el.classList.remove('text-stroke');
        el.style.textShadow = RANKING_SHADOW_CSS[strokeStyle] || RANKING_SHADOW_CSS.outline;
    }

    _propagateRankNumberStyles() {
        for (let i = 1; i <= 5; i++) {
            const numId = `rank_${i}_number`;
            const titleId = `rank_${i}_title`;
            const numCustom = this.customizations[numId];
            if (!numCustom) continue;
            if (!this.customizations[titleId]) this.customizations[titleId] = {};
            const titleCustom = this.customizations[titleId];
            // Keep title font/size/stroke matched to its number (titles used to stay on defaults)
            // outline_color is flat [r,g,b,a]; outline_offsets is [[dx,dy], ...] — only nest-clone pairs
            for (const prop of ['font', 'font_size', 'outline_color', 'outline_offsets', 'stroke_style']) {
                if (numCustom[prop] !== undefined) {
                    const val = numCustom[prop];
                    titleCustom[prop] = Array.isArray(val)
                        ? val.map((p) => (Array.isArray(p) ? [...p] : p))
                        : val;
                }
            }
            if (numCustom.color && titleCustom.color === undefined) {
                titleCustom.color = [...numCustom.color];
            }
        }
    }

    /** Read live preview DOM into customizations (called by ranking text pill). */
    syncFromDOM() {
        const container = this._getActiveRankingContainer();
        if (!container) return;
        container.querySelectorAll('[data-template-element-id]').forEach((el) => {
            const elementId = el.getAttribute('data-template-element-id');
            if (!elementId) return;
            if (!this.customizations[elementId]) this.customizations[elementId] = {};

            const text = el.textContent.trim()
                || String(el.getAttribute('data-rk-full-title') || '').trim();
            // Rank numbers are fixed labels (1. … 5.) — never persist edited digit text
            if (elementId.endsWith('_number') && elementId.startsWith('rank_')) {
                const m = elementId.match(/^rank_(\d+)_number$/);
                if (m) {
                    el.textContent = `${m[1]}.`;
                    delete this.customizations[elementId].content;
                }
            } else if (text) {
                this.customizations[elementId].content = text;
                if (el.querySelector('span[style*="color"]')) {
                    this.customizations[elementId].contentHtml = el.innerHTML
                        .replace(/<script[\s\S]*?<\/script>/gi, '');
                } else {
                    delete this.customizations[elementId].contentHtml;
                }
            }

            const rgba = this._colorToRgba(el.style.color || getComputedStyle(el).color);
            if (rgba) this.customizations[elementId].color = rgba;

            // Text fill / background plate (palette Fill row)
            const bgRaw = el.style.backgroundColor || '';
            if (bgRaw && bgRaw !== 'transparent' && bgRaw !== 'rgba(0, 0, 0, 0)'
                && el.classList.contains('rk-has-fill')) {
                const bgRgba = this._colorToRgba(bgRaw);
                if (bgRgba) {
                    this.customizations[elementId].box = true;
                    this.customizations[elementId].box_color = bgRgba;
                    this.customizations[elementId].box_border_width = 12;
                }
            } else {
                this.customizations[elementId].box = false;
                this.customizations[elementId].box_color = null;
            }

            const cs = getComputedStyle(el);
            const inlineFs = el.style.fontSize;
            const previewPx = inlineFs && inlineFs !== 'inherit'
                ? parseFloat(inlineFs)
                : parseFloat(cs.fontSize);
            if (previewPx) {
                this.customizations[elementId].font_size = this._scaleFontSize(previewPx);
            }

            // Prefer explicit data attr / inline over computed (computed casing varies by browser)
            const ff = el.getAttribute('data-rk-font')
                || el.style.getPropertyValue('font-family')
                || el.style.fontFamily
                || cs.fontFamily;
            this.customizations[elementId].font = this._normalizeFont(ff);

            const stroke = this._readStrokeState(el);
            this.customizations[elementId].stroke_style = stroke.style;
            if (stroke.enabled) {
                this.customizations[elementId].outline_color = [0, 0, 0, 255];
                const offsets = RANKING_OFFSETS_BY_STYLE[stroke.style] || RANKING_OUTLINE_OFFSETS;
                this.customizations[elementId].outline_offsets = offsets.map((p) => [...p]);
                if (stroke.style === 'stroke' || stroke.style === 'outline') {
                    this.customizations[elementId].shadow_color = null;
                    this.customizations[elementId].shadow_offset = null;
                } else {
                    this.customizations[elementId].shadow_color = null;
                    this.customizations[elementId].shadow_offset = null;
                }
            } else {
                this.customizations[elementId].outline_offsets = [];
                this.customizations[elementId].shadow_color = null;
                this.customizations[elementId].shadow_offset = null;
            }
        });
        this._propagateRankNumberStyles();
        this.saveCustomizations();
    }

    _colorToRgba(color) {
        if (!color) return null;
        const hex = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (hex) {
            return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16), 255];
        }
        const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgb) {
            return [parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10), 255];
        }
        return null;
    }

    applyCustomizations() {
        this._propagateRankNumberStyles();
        const container = this._getActiveRankingContainer();
        if (container) {
            Object.entries(this.customizations).forEach(([elementId, customization]) => {
                const el = container.querySelector(`[data-template-element-id="${elementId}"]`);
                if (!el) return;
                // Rank numbers are locked labels — ignore saved/edited content
                if (elementId.endsWith('_number') && elementId.startsWith('rank_')) {
                    const m = elementId.match(/^rank_(\d+)_number$/);
                    if (m) el.textContent = `${m[1]}.`;
                    el.contentEditable = 'false';
                } else if (customization.contentHtml) {
                    // Preserve multi-color word spans from the ranking text editor
                    el.innerHTML = String(customization.contentHtml)
                        .replace(/<script[\s\S]*?<\/script>/gi, '');
                } else if (customization.content) {
                    el.textContent = customization.content;
                }
                if (customization.color) {
                    const [r, g, b] = customization.color;
                    el.style.color = `rgb(${r}, ${g}, ${b})`;
                }
                if (customization.box && customization.box_color) {
                    // Text plate fills removed — use Background (None / Blank / Blur) instead
                    el.style.backgroundColor = 'transparent';
                    el.style.background = 'transparent';
                    el.style.removeProperty('padding');
                    el.style.removeProperty('border-radius');
                    el.classList.remove('rk-has-fill');
                } else if (customization.box === false) {
                    el.style.backgroundColor = 'transparent';
                    el.style.background = 'transparent';
                    el.style.removeProperty('padding');
                    el.style.removeProperty('border-radius');
                    el.classList.remove('rk-has-fill');
                }
                if (customization.font) {
                    const displayFont = this._displayFont(customization.font);
                    const stack = displayFont === 'Luckiest Guy'
                        ? `'Luckiest Guy', cursive`
                        : `'${displayFont}', sans-serif`;
                    el.style.setProperty('font-family', stack, 'important');
                    el.style.setProperty(
                        'font-weight',
                        RANKING_FONT_WEIGHT[displayFont] || '400',
                        'important',
                    );
                    el.setAttribute('data-rk-font', displayFont);
                }
                const isHeader = elementId === 'title_ranking'
                    || elementId === 'title_funniest'
                    || elementId === 'title_channel';
                // Headers + ranks both honor font_size from the editor
                if (customization.font_size) {
                    const scaled = customization.font_size * ((container.clientWidth || 280) / RANKING_VIDEO_WIDTH);
                    const min = isHeader ? 18 : 16;
                    const max = isHeader ? 40 : 38;
                    el.style.setProperty('font-size', `${Math.max(min, Math.min(max, Math.round(scaled)))}px`, 'important');
                    el.classList.add('rk-sized');
                }
                if (customization.stroke_style && customization.stroke_style !== 'none') {
                    this._applyStrokeStyleToElement(el, customization.stroke_style);
                } else if (customization.outline_offsets?.length) {
                    this._applyStrokeStyleToElement(el, 'stroke');
                } else if (customization.stroke_style !== 'none') {
                    // Keep template-authored .text-stroke (never flatten RANKING / FUNNIEST)
                    el.classList.add('text-stroke');
                    if (el.style.textShadow === 'none') el.style.textShadow = '';
                    el.style.removeProperty('text-shadow');
                }
                if (elementId === 'title_funniest') el.classList.add('funniest');
            });
            // Restore blank/blur top panel from remembered layout
            try {
                if (window.RankingTextPill?.applyTopPanel) {
                    window.RankingTextPill.applyTopPanel();
                }
            } catch (_) { /* ignore */ }
            return;
        }
        // Apply text customizations to input fields
        Object.entries(this.customizations).forEach(([elementId, customization]) => {
            const input = this.panel?.querySelector(`[data-element="${elementId}"]`);
            if (input && customization.content) {
                input.value = customization.content;
            }
        });
    }

    getCustomizations() {
        // Return formatted customizations for backend
        return this.customizations;
    }

    toggle() {
        if (this.panel) {
            this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
        }
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    /**
     * Hard capture from the live phone preview — source of truth for generate.
     * Does not trust in-memory customs alone (those often only had AI titles).
     */
    captureGenerateLock() {
        const container = this._getActiveRankingContainer();
        const lock = {};

        // Start from whatever we already persisted (fonts written by the pill)
        try {
            Object.entries(this.customizations || {}).forEach(([k, v]) => {
                if (v && typeof v === 'object') lock[k] = { ...v };
                else if (v != null) lock[k] = v;
            });
        } catch (_) { /* ignore */ }

        // Also fold in any prior style lock so a layout-only memory bag can't erase fonts
        try {
            const prior = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
            if (prior && typeof prior === 'object') {
                Object.entries(prior).forEach(([k, v]) => {
                    if (!v || typeof v !== 'object') {
                        if (v != null && lock[k] == null) lock[k] = v;
                        return;
                    }
                    lock[k] = { ...(lock[k] || {}), ...v, ...(lock[k] || {}) };
                    // Prefer explicit fonts already on lock/customs
                    if (prior[k]?.font && !lock[k].font) lock[k].font = prior[k].font;
                    if (this.customizations?.[k]?.font) lock[k].font = this.customizations[k].font;
                });
            }
        } catch (_) { /* ignore */ }

        if (container) {
            container.querySelectorAll('[data-template-element-id]').forEach((el) => {
                const eid = el.getAttribute('data-template-element-id');
                if (!eid) return;
                if (!lock[eid]) lock[eid] = {};
                const node = lock[eid];

                const text = (el.textContent || '').trim()
                    || String(el.getAttribute('data-rk-full-title') || '').trim();
                if (eid.endsWith('_number') && eid.startsWith('rank_')) {
                    delete node.content;
                    delete node.contentHtml;
                } else if (text && !/^add title/i.test(text)) {
                    node.content = text;
                    if (el.querySelector('span[style*="color"]')) {
                        node.contentHtml = el.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
                    } else {
                        delete node.contentHtml;
                    }
                }

                node.font = this._resolvePersistFont(el, eid, node);

                const colorRaw = el.style.color
                    || el.style.getPropertyValue('color')
                    || getComputedStyle(el).color;
                const rgba = this._colorToRgba(colorRaw);
                if (rgba) node.color = rgba;

                const inlineFs = el.style.fontSize || el.style.getPropertyValue('font-size');
                let previewPx = inlineFs && inlineFs !== 'inherit' ? parseFloat(inlineFs) : NaN;
                if (!(previewPx > 0)) previewPx = parseFloat(getComputedStyle(el).fontSize);
                if (previewPx > 0) node.font_size = this._scaleFontSize(previewPx);

                const stroke = this._readStrokeState(el);
                node.stroke_style = stroke.style;
                if (stroke.enabled) {
                    node.outline_color = [0, 0, 0, 255];
                    const offsets = RANKING_OFFSETS_BY_STYLE[stroke.style] || RANKING_OUTLINE_OFFSETS;
                    node.outline_offsets = offsets.map((p) => [...p]);
                } else {
                    node.outline_offsets = [];
                    node.outline_color = null;
                }
            });
        }

        try {
            if (window.__solisRankingLayout) {
                lock.__ranking_layout = {
                    ...(lock.__ranking_layout || {}),
                    ...window.__solisRankingLayout,
                };
            } else if (this.customizations?.__ranking_layout) {
                lock.__ranking_layout = { ...this.customizations.__ranking_layout };
            }
        } catch (_) { /* ignore */ }

        // Force number → title style match (titles used to keep HTML Luckiest while numbers changed)
        for (let i = 1; i <= 5; i++) {
            const num = lock[`rank_${i}_number`];
            const title = lock[`rank_${i}_title`] || (lock[`rank_${i}_title`] = {});
            if (!num || typeof num !== 'object') continue;
            for (const prop of ['font', 'font_size', 'outline_color', 'outline_offsets', 'stroke_style']) {
                if (num[prop] !== undefined) {
                    const val = num[prop];
                    // outline_color is flat [r,g,b,a]; outline_offsets is [[dx,dy], ...]
                    title[prop] = Array.isArray(val)
                        ? val.map((p) => (Array.isArray(p) ? [...p] : p))
                        : val;
                }
            }
            if (num.color && title.color === undefined) title.color = [...num.color];
        }

        // Refuse to publish a fontless lock over a font-rich one
        const nextFonts = this.countFonts(lock);
        let prevFonts = 0;
        let prevLock = null;
        try {
            prevLock = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
            prevFonts = this.countFonts(prevLock);
        } catch (_) { /* ignore */ }
        if (nextFonts === 0 && prevFonts > 0) {
            // Keep prior fonts, refresh layout/content only
            const kept = JSON.parse(JSON.stringify(prevLock));
            Object.entries(lock).forEach(([k, v]) => {
                if (k === '__ranking_layout') {
                    kept[k] = v;
                    return;
                }
                if (!v || typeof v !== 'object') return;
                if (!kept[k]) kept[k] = {};
                if (v.content !== undefined) kept[k].content = v.content;
                if (v.font) kept[k].font = v.font;
                if (v.font_size) kept[k].font_size = v.font_size;
                if (v.color) kept[k].color = v.color;
            });
            this.customizations = { ...this.customizations };
            Object.entries(kept).forEach(([k, v]) => {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    this.customizations[k] = { ...(this.customizations[k] || {}), ...v };
                } else if (v != null) {
                    this.customizations[k] = v;
                }
            });
            try {
                this.saveCustomizations();
                sessionStorage.setItem('solisPendingRankingCustoms', JSON.stringify(kept));
                sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(kept));
            } catch (_) { /* ignore */ }
            return JSON.parse(JSON.stringify(kept));
        }

        this.customizations = { ...this.customizations };
        Object.entries(lock).forEach(([k, v]) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                this.customizations[k] = { ...(this.customizations[k] || {}), ...v };
            } else if (v != null) {
                this.customizations[k] = v;
            }
        });
        try {
            this.saveCustomizations();
            sessionStorage.setItem('solisPendingRankingCustoms', JSON.stringify(lock));
            // Never poison the style lock with a fontless snapshot
            if (this.countFonts(lock) > 0) {
                sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(lock));
            }
        } catch (_) { /* ignore */ }

        return JSON.parse(JSON.stringify(lock));
    }

    /**
     * Hard flush for Use Template / close / generate — DOM → customs → style lock.
     * Never returns a fontless bag when a richer prior lock exists.
     */
    flushRankingStylesForGenerate() {
        try {
            document.querySelectorAll('#templateVideoPreview .rk-inline-editing').forEach((el) => {
                try { el.blur(); } catch (_) { /* ignore */ }
            });
        } catch (_) { /* ignore */ }
        try { this.persistAllPreviewStyles(); } catch (_) { /* ignore */ }
        let snap = null;
        try {
            snap = this.captureGenerateLock();
        } catch (_) {
            snap = null;
        }
        if (!snap || typeof snap !== 'object') snap = {};
        if (this.countFonts(snap) === 0) {
            try {
                const prior = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
                if (this.countFonts(prior) > 0) {
                    const merged = {};
                    [prior, snap].forEach((src) => {
                        if (!src || typeof src !== 'object') return;
                        Object.entries(src).forEach(([k, v]) => {
                            if (!v || typeof v !== 'object') {
                                if (v != null) merged[k] = v;
                                return;
                            }
                            merged[k] = { ...(merged[k] || {}), ...v };
                            if (prior[k]?.font && !merged[k].font) merged[k].font = prior[k].font;
                        });
                    });
                    snap = merged;
                }
            } catch (_) { /* ignore */ }
        }
        try {
            sessionStorage.setItem('solisPendingRankingCustoms', JSON.stringify(snap));
            if (this.countFonts(snap) > 0) {
                sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(snap));
            }
            window.__solisPendingGenerateRankingCustoms = snap;
            window.__solisRankingStyleLock = snap;
        } catch (_) { /* ignore */ }
        return this.ensureGeneratePayload(snap);
    }

    /**
     * Last-mile guarantee before /clips/start: every ranking element gets an explicit
     * font (and default size/color when missing). Layout-only bags can no longer
     * produce a fontless burn.
     */
    ensureGeneratePayload(raw) {
        const RANKING_IDS = [
            'title_ranking', 'title_funniest', 'title_channel',
            'rank_1_number', 'rank_1_title',
            'rank_2_number', 'rank_2_title',
            'rank_3_number', 'rank_3_title',
            'rank_4_number', 'rank_4_title',
            'rank_5_number', 'rank_5_title',
        ];
        const DEFAULT_FONT = 'LuckiestGuy-Regular.ttf';
        const DEFAULT_SIZE = {
            title_ranking: 120,
            title_funniest: 120,
            title_channel: 72,
            rank_1_number: 110, rank_1_title: 95,
            rank_2_number: 110, rank_2_title: 95,
            rank_3_number: 110, rank_3_title: 95,
            rank_4_number: 110, rank_4_title: 95,
            rank_5_number: 110, rank_5_title: 95,
        };
        const DEFAULT_COLOR = {
            title_ranking: [255, 255, 255, 255],
            title_funniest: [255, 0, 0, 255],
            title_channel: [255, 255, 255, 255],
            rank_1_number: [255, 215, 0, 255], rank_1_title: [255, 215, 0, 255],
            rank_2_number: [192, 192, 192, 255], rank_2_title: [192, 192, 192, 255],
            rank_3_number: [205, 127, 50, 255], rank_3_title: [205, 127, 50, 255],
            rank_4_number: [255, 255, 255, 255], rank_4_title: [255, 255, 255, 255],
            rank_5_number: [255, 255, 255, 255], rank_5_title: [255, 255, 255, 255],
        };

        const out = {};
        const sources = [
            raw,
            this.customizations,
            (() => {
                try {
                    const key = typeof this._storageKey === 'function' ? this._storageKey() : 'rankingCustomizations';
                    return JSON.parse(localStorage.getItem(key) || 'null');
                } catch (_) { return null; }
            })(),
            (() => { try { return JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null'); } catch (_) { return null; } })(),
            (() => { try { return JSON.parse(sessionStorage.getItem('solisPendingRankingCustoms') || 'null'); } catch (_) { return null; } })(),
            window.__solisRankingStyleLock,
        ];
        sources.forEach((src) => {
            if (!src || typeof src !== 'object') return;
            Object.entries(src).forEach(([k, v]) => {
                if (!v || typeof v !== 'object') {
                    if (v != null) out[k] = v;
                    return;
                }
                out[k] = { ...(out[k] || {}), ...v };
            });
        });

        // Dedicated font lock always wins for .font
        const fontLock = this._readFontLock();
        Object.entries(fontLock).forEach(([eid, font]) => {
            if (!font) return;
            if (!out[eid] || typeof out[eid] !== 'object') out[eid] = {};
            out[eid].font = font;
        });

        // Live DOM if phone still mounted
        try {
            const container = this._getActiveRankingContainer();
            if (container) {
                container.querySelectorAll('[data-template-element-id]').forEach((el) => {
                    const eid = el.getAttribute('data-template-element-id');
                    if (!eid) return;
                    if (!out[eid]) out[eid] = {};
                    out[eid].font = this._resolvePersistFont(el, eid, out[eid]);
                    try { this._writeFontLock({ [eid]: out[eid].font }); } catch (_) { /* ignore */ }
                    const rgba = this._colorToRgba(el.style.color || getComputedStyle(el).color);
                    if (rgba) out[eid].color = rgba;
                    const inlineFs = el.style.fontSize;
                    const previewPx = inlineFs && inlineFs !== 'inherit'
                        ? parseFloat(inlineFs)
                        : parseFloat(getComputedStyle(el).fontSize);
                    if (previewPx > 0) out[eid].font_size = this._scaleFontSize(previewPx);
                });
            }
        } catch (_) { /* ignore */ }

        if (window.__solisRankingLayout && typeof window.__solisRankingLayout === 'object') {
            out.__ranking_layout = {
                ...(out.__ranking_layout || {}),
                ...window.__solisRankingLayout,
            };
        }

        RANKING_IDS.forEach((eid) => {
            if (!out[eid] || typeof out[eid] !== 'object') out[eid] = {};
            const node = out[eid];
            if (!node.font) {
                node.font = fontLock[eid] || this.customizations?.[eid]?.font || DEFAULT_FONT;
            } else {
                node.font = this._normalizeFont(node.font);
            }
            if (!(node.font_size > 0) || node.font_size < 70) {
                node.font_size = DEFAULT_SIZE[eid] || 95;
            }
            if (!Array.isArray(node.color) || node.color.length < 3) {
                node.color = DEFAULT_COLOR[eid] || [255, 255, 255, 255];
            }
        });

        try {
            Object.entries(out).forEach(([k, v]) => {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    this.customizations[k] = { ...(this.customizations[k] || {}), ...v };
                }
            });
            this.saveCustomizations();
            sessionStorage.setItem('solisPendingRankingCustoms', JSON.stringify(out));
            if (this.countFonts(out) > 0) {
                sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(out));
            }
            window.__solisRankingStyleLock = out;
        } catch (_) { /* ignore */ }

        return JSON.parse(JSON.stringify(out));
    }

    collectCustomizations() {
        // Prefer hard DOM lock when the phone still exists
        try {
            if (this._getActiveRankingContainer()) {
                return this.ensureGeneratePayload(this.captureGenerateLock());
            }
        } catch (_) { /* fall through */ }
        try {
            this.syncFromDOM();
        } catch (_) { /* ignore */ }
        try {
            return this.ensureGeneratePayload(this.customizations || {});
        } catch (_) {
            return this.ensureGeneratePayload({ ...(this.customizations || {}) });
        }
    }
}

window.rankingCustomizer = null;
(function bootRankingCustomizer() {
    const start = () => {
        if (window.rankingCustomizer) return;
        try {
            window.rankingCustomizer = new RankingCustomizer();
        } catch (err) {
            console.warn('[RankingCustomizer] init failed:', err);
        }
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();

// Add CSS for ranking customizer
const style = document.createElement('style');
style.textContent = `
    .ranking-customizer {
        position: fixed;
        right: 20px;
        top: 100px;
        width: 350px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #ff6b35;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 9998;
        max-height: 80vh;
        overflow-y: auto;
        display: none;
        color: #fff;
        font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .ranking-customizer-header {
        padding: 16px;
        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
    }

    .ranking-customizer-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
    }

    .ranking-customizer-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 24px;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .ranking-customizer-close:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .ranking-customizer-content {
        padding: 16px;
    }

    .ranking-section {
        margin-bottom: 24px;
    }

    .ranking-section h4 {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        color: #ff6b35;
        letter-spacing: 0.5px;
    }

    .ranking-edit-group {
        margin-bottom: 12px;
    }

    .ranking-edit-group label {
        display: block;
        font-size: 12px;
        color: #aaa;
        margin-bottom: 6px;
        font-weight: 500;
    }

    .ranking-edit-group input {
        width: 100%;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #fff;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 13px;
        transition: all 0.2s;
        box-sizing: border-box;
    }

    .ranking-edit-group input:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.1);
        border-color: #ff6b35;
        box-shadow: 0 0 8px rgba(255, 107, 53, 0.2);
    }

    .ranking-color-picker {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .ranking-color-btn {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        border: 2px solid #555;
        cursor: pointer;
        transition: all 0.2s;
    }

    .ranking-color-btn:hover {
        transform: scale(1.1);
        border-color: #ff6b35;
        box-shadow: 0 0 8px rgba(255, 107, 53, 0.4);
    }

    .ranking-color-btn.active {
        border-color: #ff6b35;
        box-shadow: 0 0 12px rgba(255, 107, 53, 0.6);
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
        .ranking-customizer {
            width: calc(100% - 40px);
            right: 20px;
            left: 20px;
            max-height: 60vh;
        }
    }
`;
document.head.appendChild(style);
