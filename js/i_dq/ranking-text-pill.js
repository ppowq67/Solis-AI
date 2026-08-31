/**
 * Ranking preview text pill editor — font + color + stroke + size.
 * After styling header OR 1–5: offer the same change on the other group.
 * Ghost (green) = proposed look · live target (red) = current that would change.
 * Ghost samples keep the original fill/stroke unless the suggest is a color change.
 */
(function () {
    const FONTS = [
        ['Fredoka', '700'],
        ['Montserrat', '700'],
        ['Bebas Neue', '400'],
        ['Anton', '400'],
        ['Luckiest Guy', '400'],
        ['Poppins', '600'],
        ['Roboto', '700'],
    ];
    const FW = { Fredoka: '700', Montserrat: '700', 'Bebas Neue': '400', Anton: '400', 'Luckiest Guy': '400', Poppins: '600', Roboto: '700' };
    const FONT_STACK = {
        Fredoka: "'Fredoka', sans-serif",
        Montserrat: "'Montserrat', sans-serif",
        'Bebas Neue': "'Bebas Neue', sans-serif",
        Anton: "'Anton', sans-serif",
        'Luckiest Guy': "'Luckiest Guy', cursive",
        Poppins: "'Poppins', sans-serif",
        Roboto: "'Roboto', sans-serif",
    };
    const TCOLS = ['#ffffff', '#FF6A3D', '#facc15', '#60a5fa', '#80DE4A'];
    const BCOLS = ['#ffffff', '#FF6A3D', '#111827', '#0f172a', '#000000'];
    const OUTLINE_COLS = ['#ffffff', '#000000', '#FF6A3D', '#facc15', '#60a5fa'];
    const CUSTOM_COLS_KEY = 'solis_sub_custom_cols';
    const RANKING_LAYOUT_KEY = '__ranking_layout';
    /** Default blank/blur band — covers the top ~25% (titles sit on it) */
    const TOP_PANEL_RATIO = 0.25;
    const TOP_PANEL_MIN = 0.10;
    /** Blank/blur band hard cap — never past ~45% */
    const TOP_PANEL_MAX = 0.45;

    /** Build text-shadow outline/thick with a chosen edge color (default black). */
    function shadowCss(type, color) {
        const col = normalizeHex(color) || color || '#000';
        if (!type || type === 'none') return 'none';
        if (type === 'thick-outline') {
            return (
                `3px 0 0 ${col},-3px 0 0 ${col},0 3px 0 ${col},0 -3px 0 ${col},` +
                `2px 2px 0 ${col},-2px -2px 0 ${col},2px -2px 0 ${col},-2px 2px 0 ${col}`
            );
        }
        // outline / stroke
        return (
            `2px 0 0 ${col},-2px 0 0 ${col},0 2px 0 ${col},0 -2px 0 ${col},` +
            `1px 1px 0 ${col},-1px -1px 0 ${col},1px -1px 0 ${col},-1px 1px 0 ${col}`
        );
    }

    let pill, ddFont, ddColor, suggestActions;
    let activeEls = new Set();
    let curFont = 'Luckiest Guy';
    let curTextCol = '#ffffff';
    let curFillCol = null; // null = no background plate
    let curShadow = 'outline';
    let curOutlineCol = '#000000';
    let shadowPreviewSaved = undefined;
    let colorTarget = 'text'; // text | fill | blank
    let fillTouched = false;
    let curSize = null;
    let sizeTouched = false;
    let fontTouched = false;
    let colorTouched = false;
    let shadowTouched = false;
    let previewTextCol = null;
    let colorPreviewActive = false;
    let colorPreviewSnapshot = new Map();
    let colorPreviewCur = null;
    let colorPreviewSelSpan = null;
    let spectrumHue = 18;
    let spectrumSat = 92;
    let spectrumLight = 56;
    let fontPreviewActive = false;
    let applyingFont = false;
    let built = false;
    /** Committed top background while hovering a None/Blank/Blur option */
    let topHoverPreviewMode = null;
    let selectionMode = 'single';
    let selectionAnchor = null;
    let lastClickPoint = null;
    const snapshots = new Map();
    let fontPreviewTargets = [];
    let posRaf = 0;
    let ghostNodes = [];
    /** @type {{ props: {font?:string,color?:string,size?:number,shadow?:string}, targets: Element[] } | null} */
    let pendingSuggest = null;
    let suggestCooldownUntil = 0;
    let sizeSuggestTimer = 0;
    let sizeSuggestToken = 0;
    const SUGGEST_COOLDOWN_MS = 6000;
    /** After Accept — brief pause then keep offering the next sibling/counterpart chip */
    const ACCEPT_COOLDOWN_MS = 2200;
    /** Soft-clear (tap another element) — don't instantly re-offer */
    const SOFT_CLEAR_COOLDOWN_MS = 3500;
    /** Pause after resize so the chip doesn’t flash mid-settle */
    const SIZE_SUGGEST_DELAY_MS = 420;
    /** Header group resize: channel line stays slightly smaller than RANKING/BEST */
    const CHANNEL_SIZE_RATIO = 0.82;
    /** Hard caps — resize allowed, but never past these (preview px @ ~280 phone) */
    const TITLE_SIZE_MAX_PX = 40;   // ~154px on 1080p — was 58 (~224) and felt unbounded
    const RANK_SIZE_MAX_PX = 38;    // ~146px on 1080p
    const TITLE_SIZE_MIN_PX = 18;
    const RANK_SIZE_MIN_PX = 16;
    /** Channel can grow — only hard-capped when it would leave the phone */
    const CHANNEL_SIZE_MAX_PX = 34;
    // Template defaults (ranking1) — numbers are larger than titles; preview was undersized
    const DEFAULT_TITLE_BURN_PX = 120;
    const DEFAULT_RANK_NUM_BURN_PX = 110;
    const DEFAULT_RANK_TITLE_BURN_PX = 95;
    const DEFAULT_RANK_BURN_PX = DEFAULT_RANK_NUM_BURN_PX; // legacy alias
    const DEFAULT_CHANNEL_BURN_PX = 72;
    const RANKING_VIDEO_W = 1080;

    function getRankingRoot() {
        // Prefer the live phone preview — never a stray/hidden clone elsewhere in the DOM
        const phone = document.getElementById('templateVideoPreview');
        return phone?.querySelector('.ranking-preview-container.library-ranking-layer')
            || phone?.querySelector('.ranking-preview-container')
            || document.querySelector('.ranking-preview-container.library-ranking-layer')
            || document.querySelector('.ranking-preview-container');
    }

    /** Subtitle half-line / snap guides are caption-only — never show over ranking. */
    function hideSubtitleGuidesOverRanking() {
        const cont = document.getElementById('templateVideoPreview');
        if (!cont) return;
        cont.querySelectorAll('.sub-guide, .sub-half-line, .rk-half-line, .rk-guide').forEach((el) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
        });
    }

    function getAllTextElements() {
        const root = getRankingRoot();
        return root ? Array.from(root.querySelectorAll('[data-template-element-id]')) : [];
    }

    function getAllRankNumbers() {
        const root = getRankingRoot();
        return root ? Array.from(root.querySelectorAll('[data-template-element-id$="_number"]')) : [];
    }

    function getAllRankTitles() {
        const root = getRankingRoot();
        return root
            ? Array.from(root.querySelectorAll('[data-template-element-id^="rank_"][data-template-element-id$="_title"]'))
            : [];
    }

    function getAllRankSideElements() {
        return [...getAllRankNumbers(), ...getAllRankTitles()];
    }

    function getHeaderElements() {
        const root = getRankingRoot();
        return root ? Array.from(root.querySelectorAll('[data-template-element-id^="title_"]')) : [];
    }

    function getHeaderZone() {
        return getRankingRoot()?.querySelector('.ranking-editor-zone-header') || null;
    }

    function getRanksZone() {
        return getRankingRoot()?.querySelector('.ranking-editor-zone-ranks') || null;
    }

    function isHeaderEl(el) {
        const id = el?.getAttribute?.('data-template-element-id') || '';
        return id.startsWith('title_');
    }

    function isRankEl(el) {
        const id = el?.getAttribute?.('data-template-element-id') || '';
        return id.endsWith('_number');
    }

    function isRankTitleEl(el) {
        const id = el?.getAttribute?.('data-template-element-id') || '';
        return id.startsWith('rank_') && id.endsWith('_title');
    }

    /** Numbers + per-rank title lines (not RANKING / BEST / channel) */
    function isRankSideEl(el) {
        return isRankEl(el) || isRankTitleEl(el);
    }

    function isChannelEl(el) {
        return el?.getAttribute?.('data-template-element-id') === 'title_channel';
    }

    function normalizeSelectionElements(els, mode) {
        if (mode === 'group-header') return getHeaderElements();
        // Numbers + titles share one style group (font/size must stay in sync)
        if (mode === 'group-ranks') return getAllRankSideElements();
        return els;
    }

    function getPrimaryHeaderEl() {
        return getHeaderElements().find((el) => !isChannelEl(el)) || getHeaderElements()[0] || null;
    }

    function resolveFontSizeForEl(el, basePx, opts) {
        opts = opts || {};
        // Solo channel resize: use the size the user asked for (no forced 0.78× shrink)
        if (isChannelEl(el) && !opts.headerGroup) {
            const cap = getHardSizeCap(el);
            let px = Math.max(12, Math.min(cap, Math.round(basePx)));
            const root = getRankingRoot();
            let guard = 36;
            while (guard-- > 0 && px > 12 && !channelFitsAtSize(el, px, root)) px -= 1;
            return px;
        }
        if (isChannelEl(el)) {
            const ratioed = Math.round(basePx * CHANNEL_SIZE_RATIO);
            const cap = getHardSizeCap(el);
            let px = Math.max(12, Math.min(cap, ratioed));
            const root = getRankingRoot();
            let guard = 36;
            while (guard-- > 0 && px > 12 && !channelFitsAtSize(el, px, root)) px -= 1;
            return px;
        }
        return basePx;
    }

    function normalizeFontName(value) {
        if (!value) return '';
        return String(value).replace(/['"]/g, '').split(',')[0].trim().toLowerCase();
    }

    function getElFontName(el) {
        const tagged = el?.getAttribute?.('data-rk-font');
        if (tagged) return normalizeFontName(tagged);
        const inline = el.style.fontFamily;
        if (inline) return normalizeFontName(inline);
        return normalizeFontName(getComputedStyle(el).fontFamily);
    }

    function clearSelectionVisuals() {
        // Scope to ranking preview — full-document QSA on dashboard was hitching clicks
        const root = getRankingRoot() || document;
        root.querySelectorAll('.ranking-editor-selected').forEach((el) => {
            el.classList.remove('ranking-editor-selected');
            el.style.zIndex = '';
        });
        root.querySelectorAll('.ranking-editor-zone-selected').forEach((el) => {
            el.classList.remove('ranking-editor-zone-selected');
        });
        root.querySelectorAll('.ranking-editor-zone-member').forEach((el) => {
            el.classList.remove('ranking-editor-zone-member');
        });
        root.querySelectorAll('.ranking-editor-resize-anchor').forEach((el) => {
            el.classList.remove('ranking-editor-resize-anchor');
        });
    }

    function applySelectionVisuals() {
        clearSelectionVisuals();
        // Group mode: one zone ring + subtle member markers (all items are selected)
        if (selectionMode === 'group-header') {
            getHeaderZone()?.classList.add('ranking-editor-zone-selected');
            getHeaderElements().forEach((el) => el.classList.add('ranking-editor-zone-member'));
            return;
        }
        if (selectionMode === 'group-ranks') {
            getRanksZone()?.classList.add('ranking-editor-zone-selected');
            getAllRankSideElements().forEach((el) => el.classList.add('ranking-editor-zone-member'));
            return;
        }
        // single + multi: ring every selected element
        activeEls.forEach((el) => el.classList.add('ranking-editor-selected'));
    }

    function resolveApplyTargets() {
        if (selectionMode === 'group-header') return getHeaderElements();
        if (selectionMode === 'group-ranks') return getAllRankSideElements();
        if (selectionMode === 'group-all') return getAllTextElements();
        // Solo number → also style its title (and vice versa) so fonts stay matched
        const els = [...activeEls];
        if (els.length === 1 && isRankSideEl(els[0])) {
            return expandRankPair(els[0]);
        }
        return els;
    }

    /** Pair `rank_N_number` with `rank_N_title` so styling never leaves titles stuck on defaults. */
    function syncFontDdHighlight(name) {
        if (!ddFont) return;
        const want = String(name || curFont || 'Luckiest Guy').trim();
        ddFont.querySelectorAll('.sub-font-item').forEach((el) => {
            const n = el.querySelector('.sub-fname')?.textContent?.trim();
            const on = n === want;
            el.classList.toggle('on', on);
            el.setAttribute('aria-selected', on ? 'true' : 'false');
            el.title = n || '';
        });
    }

    function buildFontList() {
        const list = ddFont?.querySelector('#rkFontList') || document.getElementById('rkFontList') || ddFont;
        if (!list) return;
        list.innerHTML = '';
        FONTS.forEach(([f, w]) => {
            const d = document.createElement('div');
            d.className = 'sub-font-item' + (f === curFont ? ' on' : '');
            const stack = FONT_STACK[f] || `'${f}', sans-serif`;
            d.innerHTML = `<span class="sub-fname" style="font-family:${stack};font-weight:${w};">${f}</span>`;
            d.setAttribute('aria-selected', f === curFont ? 'true' : 'false');
            d.title = f;
            d.onmouseenter = () => previewFont(f);
            d.onmouseleave = (e) => {
                if (applyingFont) return;
                if (ddFont.contains(e.relatedTarget)) return;
                resetFontPreview();
            };
            d.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                applyingFont = true;
                try {
                    applyFont(f);
                } finally {
                    setTimeout(() => { applyingFont = false; }, 450);
                }
            };
            list.appendChild(d);
        });
        syncFontDdHighlight(curFont);
    }

    function expandRankPair(el) {
        const id = el?.getAttribute?.('data-template-element-id') || '';
        const m = id.match(/^rank_(\d+)_(number|title)$/);
        if (!m) return el ? [el] : [];
        const root = getRankingRoot();
        if (!root) return [el];
        const num = root.querySelector(`[data-template-element-id="rank_${m[1]}_number"]`);
        const title = root.querySelector(`[data-template-element-id="rank_${m[1]}_title"]`);
        return [num, title].filter(Boolean);
    }

    function buildUI() {
        if (built) return;
        built = true;
        hideSubtitleGuidesOverRanking();

        pill = document.createElement('div');
        pill.className = 'sub-pill-menu';
        pill.id = 'rkPillMenu';
        // Same icon-only glass pill as subtitle editor (Font + Color)
        pill.innerHTML = `
            <button type="button" class="sub-pill-btn" id="rkBtnFont" title="Font">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            </button>
            <button type="button" class="sub-pill-btn" id="rkBtnColor" title="Color">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </button>
        `;
        document.body.appendChild(pill);

        ddFont = document.createElement('div');
        ddFont.className = 'sub-dropdown sub-font-dd';
        ddFont.id = 'rkDdFont';
        // Same clean list as subtitle fonts — no search bar, no checkmarks
        buildFontList();
        ddFont.addEventListener('mouseleave', (e) => {
            if (ddFont.contains(e.relatedTarget) || pill?.contains(e.relatedTarget)) return;
            resetFontPreview();
        });
        document.body.appendChild(ddFont);

        ddColor = document.createElement('div');
        ddColor.className = 'sub-dropdown sub-color-dd';
        ddColor.id = 'rkDdColor';
        // Text + Outline color + Background (None / Blank / Blur) with live phone hover preview
        ddColor.innerHTML = `
            <div class="sub-color-line"><span class="sub-clabel">Text</span><div class="sub-cgrid" id="rkTCG"></div></div>
            <div class="sub-color-line"><span class="sub-clabel">Outline</span><div class="sub-edge" id="rkSHG"></div></div>
            <div class="sub-color-line"><span class="sub-clabel">Edge</span><div class="sub-cgrid" id="rkOCG"></div></div>
            <div class="sub-color-line rk-top-line"><span class="sub-clabel">Background</span>
                <div class="rk-top-modes" id="rkTopModes" role="group" aria-label="Ranking background">
                    <button type="button" class="rk-top-mode" data-top="none" title="No background">None</button>
                    <button type="button" class="rk-top-mode" data-top="blank" title="Solid color behind titles">Blank</button>
                    <button type="button" class="rk-top-mode" data-top="blank_blur" title="Blurred video behind titles">Blur</button>
                </div>
            </div>
            <div class="sub-color-line rk-blank-line is-hidden" id="rkBlankLine">
                <span class="sub-clabel">Blank</span><div class="sub-cgrid" id="rkBlankCG"></div>
            </div>
            <div class="sub-cplus-pop" id="rkCPlusPop" aria-hidden="true">
                <div class="sub-cplus-head">
                    <span class="sub-cplus-title" id="rkCPlusTitle">Custom text</span>
                    <button type="button" class="sub-cplus-close" id="rkCPlusClose" aria-label="Close">
                        <svg viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3L3 9"/></svg>
                    </button>
                </div>
                <div class="rk-cplus-lab">Hue</div>
                <div class="sub-spectrum" id="rkSpectrum" title="Drag to pick hue">
                    <div class="sub-spectrum-thumb" id="rkSpectrumThumb"></div>
                </div>
                <div class="rk-cplus-lab">Saturation · Tone</div>
                <div class="rk-sv-panel" id="rkSvPanel" title="Saturation (X) · Tone / lightness (Y)">
                    <div class="rk-sv-thumb" id="rkSvThumb"></div>
                </div>
                <div class="sub-cplus-recents" id="rkCPlusRecents"></div>
            </div>
        `;
        // Keep caret in contentEditable when picking colors
        ddColor.addEventListener('mousedown', (e) => {
            if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
            if (document.querySelector('.rk-inline-editing')) e.preventDefault();
        });
        document.body.appendChild(ddColor);

        suggestActions = document.createElement('div');
        suggestActions.className = 'rk-suggest-actions solis-nocopy';
        suggestActions.id = 'rkSuggestActions';
        suggestActions.innerHTML = `
            <button type="button" class="rk-sa-btn rk-sa-decline solis-nocopy" id="rkSuggestDismiss" title="Dismiss" aria-label="Dismiss">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>
                </svg>
            </button>
            <button type="button" class="rk-sa-btn rk-sa-accept solis-nocopy" id="rkSuggestAccept" title="Apply · Tab" aria-label="Apply">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        document.body.appendChild(suggestActions);

        buildColorGrid();
        buildShadowGrid();
        wireButtons();
        injectStyles();
    }

    function injectStyles() {
        const css = `
            .ranking-preview-container{
                position:relative !important;
                /* Visible so orange ring + resize handle aren't clipped */
                overflow:visible !important;
                /* Title sits higher — less top pad */
                padding:14px 12px 16px !important;
                container-type:inline-size;
                container-name:rk-phone;
            }
            .ranking-preview-container .ranking-list{
                display:flex !important;
                flex-direction:column !important;
                gap:10px !important;
                margin:6px 0 0 0 !important;
                flex:0 0 auto !important;
                flex-shrink:0 !important;
                overflow:visible !important;
            }
            .ranking-preview-container .ranked-item{
                flex:0 0 auto !important;
                flex-shrink:0 !important;
                line-height:1.2 !important;
                min-height:1.2em !important;
                margin:0 !important;
                gap:6px !important;
                overflow:visible !important;
                /* ~78px @1080 → ~20px on 280 phone — was capped at ~16px rem */
                font-size:clamp(22px, 9.2cqi, 38px);
                font-family:'Luckiest Guy', cursive;
            }
            .ranking-preview-container .title,
            .ranking-preview-container h1.title{
                /* ~120px @1080 → ~31px on 280 phone */
                font-size:clamp(28px, 11cqi, 40px) !important;
                line-height:1.12 !important;
                padding-top:0 !important;
                margin-top:0 !important;
                overflow:visible !important;
                max-width:calc(100% - 8px) !important;
            }
            .ranking-preview-container .rank-title,
            .ranking-preview-container .rank-number{
                font-size:inherit;
                font-family:inherit;
            }
            .ranking-preview-container .rank-title.rk-sized,
            .ranking-preview-container .rank-number.rk-sized{
                /* Customizer / pill size wins over list clamp */
            }
            .ranking-preview-container .ranking-editor-zone-header{
                flex:0 0 auto !important;
                flex-shrink:0 !important;
                padding:0 4px 4px !important;
            }
            .ranking-preview-container [data-template-element-id]:not([data-template-element-id$="_number"]){
                position:relative;display:inline-block;
                cursor:var(--solis-preview-cursor-text)!important;
                transition:none!important;
                overflow:visible !important;
            }
            .ranking-preview-container h1.title,
            .ranking-preview-container h1{
                white-space:nowrap!important;
                max-width:100%;
            }
            .ranking-preview-container [data-template-element-id="title_ranking"],
            .ranking-preview-container [data-template-element-id="title_funniest"]{
                white-space:nowrap!important;
            }
            .ranking-preview-container .ranking-editor-zone-header,
            .ranking-preview-container .ranking-editor-zone-ranks{
                width:fit-content;max-width:100%;
                overflow:visible !important;
            }
            .ranking-preview-container .ranking-editor-zone-header{
                display:flex !important;
                flex-direction:column !important;
                align-items:center !important;
                justify-content:flex-start !important;
                gap:0;
                margin:0 auto !important;
                padding:2px 4px 0;
                text-align:center;
                position:relative;
                z-index:6;
                flex-shrink:0;
                width:100% !important;
                max-width:100% !important;
                box-sizing:border-box;
            }
            .ranking-preview-container .ranking-editor-zone-header > h1.title,
            .ranking-preview-container .ranking-editor-zone-header > h1{
                display:block !important;
                width:fit-content !important;
                max-width:100% !important;
                margin:0 auto 2px !important;
                padding:0 !important;
                text-align:center;
                position:relative;
                z-index:7;
            }
            .ranking-preview-container [data-template-element-id="title_channel"]{
                display:block !important;
                position:relative !important;
                z-index:7;
                width:fit-content !important;
                max-width:calc(100% - 24px) !important;
                margin:2px auto 8px auto !important;
                font-size:clamp(20px, 8.5cqi, 34px) !important;
                padding:0 !important;
                text-align:center !important;
                box-sizing:border-box;
                white-space:nowrap !important;
                overflow:visible !important;
                overflow-wrap:normal !important;
                word-break:normal !important;
                float:none !important;
                inset:auto !important;
                top:auto !important;
                left:auto !important;
                right:auto !important;
                bottom:auto !important;
                transform:none !important;
            }
            .ranking-preview-container .ranking-editor-zone-member{
                position:relative;z-index:1;
            }
            .ranking-preview-container .sub-resize-handle{
                position:absolute;width:18px;height:18px;
                background:rgba(249,115,22,.98);border:2.5px solid #fff;border-radius:50%;
                cursor:var(--solis-preview-cursor-hand)!important;
                box-shadow:0 2px 10px rgba(194,65,12,.4);
                bottom:0;right:0;
                /* Sit on the corner — not buried under the glyphs */
                transform:translate(35%,35%);
                z-index:120;
                pointer-events:none;display:none;
                opacity:0;visibility:hidden;
                touch-action:none;
            }
            .ranking-preview-container .sub-resize-handle::after{
                content:'';position:absolute;inset:-10px -12px -12px -10px;border-radius:50%;
                cursor:var(--solis-preview-cursor-hand)!important;
            }
            .ranking-preview-container .ranking-editor-selected > .sub-resize-handle,
            .ranking-preview-container .ranking-editor-resize-anchor > .sub-resize-handle,
            .ranking-preview-container .ranking-editor-zone-selected > .sub-resize-handle{
                display:block;pointer-events:all;
                opacity:1;visibility:visible;
            }
            .ranking-preview-container .ranking-editor-selected > .sub-resize-handle:hover,
            .ranking-preview-container .ranking-editor-resize-anchor > .sub-resize-handle:hover,
            .ranking-preview-container .ranking-editor-zone-selected > .sub-resize-handle:hover{
                transform:translate(40%,40%) scale(1.15);
            }
            .ranking-editor-text{cursor:var(--solis-preview-cursor-text)!important;}
            .ranking-preview-container .rk-number-locked,
            .ranking-preview-container [data-template-element-id$="_number"]{
                -webkit-user-modify:read-only;
                user-select:none;
                caret-color:transparent;
                touch-action:none;
            }
            .ranking-preview-container .ranking-editor-zone-ranks{
                touch-action:none;
            }
            .ranking-editor-text,.ranking-editor-zone{
                transition:none!important;
                box-shadow:none!important;
            }
            .ranking-editor-zone{
                position:relative;
                border-radius:10px;
            }
            /* Selection chrome — same orange as subtitle .sub-text-block.selected */
            .ranking-preview-container [data-template-element-id].ranking-editor-selected{
                position:relative;
                z-index:6;
                isolation:isolate;
                box-shadow:none!important;
            }
            .ranking-preview-container [data-template-element-id].ranking-editor-selected::before{
                content:'';
                position:absolute;
                inset:-5px -4px;
                border-radius:8px;
                border:1.5px solid #f97316;
                background:transparent;
                box-shadow:
                    0 0 0 3px rgba(249,115,22,.32),
                    0 0 14px rgba(249,115,22,.28);
                pointer-events:none;
                z-index:0;
                animation:none;
            }
            .ranking-preview-container [data-template-element-id].ranking-editor-selected::after{
                content:none;
                display:none;
            }
            /* Numbers: tight ring — no fat empty pad to the right of "1." */
            .ranking-preview-container .rank-number.ranking-editor-selected::before{
                inset:-3px -2px !important;
                border-radius:5px;
            }
            .ranking-preview-container .rank-number.ranking-editor-selected::after{
                display:none !important;
            }
            .ranking-preview-container .rank-number{
                display:inline-block !important;
                width:max-content !important;
                max-width:none !important;
                margin-right:0.15em !important;
                padding:0 !important;
                letter-spacing:0 !important;
                line-height:1.05 !important;
                box-sizing:content-box !important;
            }
            .ranking-preview-container .text-stroke{
                /* Caption Outline — same as sub-color-line */
                text-shadow:
                    2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000,
                    1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000 !important;
            }
            /* Zone selection — orange like subtitles */
            .ranking-editor-zone-selected{
                position:relative;
                z-index:5;
                isolation:isolate;
                box-shadow:none!important;
            }
            .ranking-editor-zone-selected::before{
                content:'';
                position:absolute;
                inset:-6px -8px;
                border-radius:12px;
                border:1.5px solid #f97316;
                background:transparent;
                box-shadow:
                    0 0 0 3px rgba(249,115,22,.28),
                    0 0 14px rgba(249,115,22,.22);
                pointer-events:none;
                z-index:0;
                animation:none;
            }
            .ranking-editor-zone-selected::after{
                content:none;
                display:none;
            }
            .ranking-editor-zone-selected > *:not(.sub-resize-handle){
                position:relative;
                z-index:1;
            }
            /* Kill any leftover subtitle guide lines if they land in the ranking layer */
            .ranking-preview-container .sub-guide,
            .ranking-preview-container .sub-half-line,
            .ranking-preview-container .rk-half-line,
            .ranking-preview-container .rk-guide{
                display:none !important;
                visibility:hidden !important;
                opacity:0 !important;
            }
            @keyframes rkSelInnerFade{
                0%,100%{opacity:1;}
                50%{opacity:.92;}
            }
            @keyframes rkSelWhitePulse{
                0%,100%{opacity:.45;transform:scale(.97);}
                50%{opacity:.95;transform:scale(1);}
            }
            #rkPillMenu{
                transition:opacity .1s ease,transform .1s ease,visibility .1s!important;
            }
            /* NEW look sample — green plate only (never on the live old text) */
            .rk-ghost-stack{
                position:fixed;z-index:99850;pointer-events:none;
                display:flex;flex-direction:column;justify-content:center;align-items:flex-end;
                gap:6px;
                padding:6px 12px;border-radius:8px;
                background:rgba(34,197,94,.16);
                box-shadow:inset 0 0 0 1.5px rgba(34,197,94,.45);
                width:max-content;height:auto;max-width:min(220px,40vw);
                overflow:visible;
                -webkit-user-select:none!important;user-select:none!important;
                -webkit-user-drag:none;
            }
            .rk-ghost-stack .rk-ghost-line{
                display:block;white-space:nowrap;line-height:1.05;opacity:1!important;
                background:none!important;padding:0;margin:0;
                position:static!important;right:auto!important;top:auto!important;
                transform:none!important;
                font-weight:700;
                letter-spacing:-.015em;
                -webkit-user-select:none!important;user-select:none!important;
            }
            .rk-ghost-stack .rk-ghost-title-row{
                display:flex;flex-direction:row;align-items:baseline;justify-content:flex-end;
                gap:6px;flex-wrap:nowrap;
            }
            .rk-ghost-stack .rk-ghost-title-row .rk-ghost-line{
                display:inline-block;
            }
            .rk-ghost-stack .rk-ghost-channel{
                text-align:right;
            }
            /* OLD live text — red rim = “this will be replaced” */
            .rk-suggest-remove{
                position:relative;
                z-index:6;
            }
            .rk-suggest-remove::before{
                content:'';
                position:absolute;
                inset:-6px -8px;
                border-radius:10px;
                border:2px solid rgba(239,68,68,.7);
                background:rgba(239,68,68,.12);
                box-shadow:0 0 0 1px rgba(239,68,68,.22);
                pointer-events:none;
                z-index:0;
            }
            .rk-suggest-remove > *{
                position:relative;
                z-index:1;
            }
            /* Legacy class kept for clearSuggest — same as remove */
            .rk-suggest-receive{
                position:relative;
                z-index:6;
            }
            .rk-suggest-receive::before{
                content:'';
                position:absolute;
                inset:-6px -8px;
                border-radius:10px;
                border:2px solid rgba(239,68,68,.7);
                background:rgba(239,68,68,.12);
                box-shadow:0 0 0 1px rgba(239,68,68,.22);
                pointer-events:none;
                z-index:0;
            }
            .rk-suggest-receive > *{
                position:relative;
                z-index:1;
            }
            .rk-suggest-actions{
                position:fixed;z-index:99870;display:flex;gap:2px;align-items:center;
                padding:3px 4px;border-radius:999px;
                font-family:'Plus Jakarta Sans',sans-serif;
                isolation:isolate;
                background:linear-gradient(
                    145deg,
                    rgba(255,255,255,.96) 0%,
                    rgba(255,255,255,.9) 45%,
                    rgba(255,252,248,.88) 100%
                );
                border:1px solid rgba(255,255,255,.95);
                border-bottom-color:rgba(200,185,170,.28);
                border-right-color:rgba(200,185,170,.2);
                box-shadow:
                    0 6px 18px rgba(120,90,60,.12),
                    0 1px 4px rgba(120,90,60,.06),
                    inset 0 1px 0 rgba(255,255,255,1);
                backdrop-filter:blur(16px) saturate(140%);
                -webkit-backdrop-filter:blur(16px) saturate(140%);
                opacity:0;visibility:hidden;pointer-events:none;
                transform:none !important;
                left:0;top:0;
            }
            .rk-suggest-actions.open{
                opacity:1;visibility:visible;pointer-events:auto;
            }
            .rk-sa-btn{
                appearance:none;-webkit-appearance:none;
                width:28px;height:28px;min-width:28px;border:none;border-radius:999px;
                display:inline-flex;align-items:center;justify-content:center;
                cursor:var(--solis-preview-cursor-hand);
                padding:0;box-sizing:border-box;margin:0;
                font:inherit;
                transition:background .12s ease,color .12s ease,border-color .12s ease,
                    box-shadow .12s ease,transform .1s ease;
            }
            .rk-sa-btn:active{transform:scale(.95);}
            .rk-sa-btn svg{display:block;flex-shrink:0;width:20px;height:20px;}
            .rk-sa-accept{
                background:linear-gradient(145deg,#34d399 0%,#16a34a 100%);
                color:#ffffff !important;
                border:1px solid rgba(21,128,61,.35);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,.35),
                    0 1px 3px rgba(22,163,74,.25);
            }
            .rk-sa-accept:hover{
                background:linear-gradient(145deg,#22c55e 0%,#15803d 100%);
                color:#ffffff !important;
                border-color:rgba(21,128,61,.5);
            }
            .rk-sa-decline{
                background:linear-gradient(145deg,rgba(255,255,255,.75),rgba(255,255,255,.4));
                border:1px solid rgba(200,185,170,.35);
                color:rgba(50,38,28,.72);
                box-shadow:inset 0 1px 0 rgba(255,255,255,.9);
            }
            .rk-sa-decline:hover{
                background:linear-gradient(145deg,rgba(254,226,226,.9),rgba(254,202,202,.55));
                border-color:rgba(254,202,202,.7);
                color:#ef4444;
            }
            .rk-top-line{align-items:flex-start;flex-direction:column;gap:8px;}
            .rk-top-line .sub-clabel{flex:none;}
            .rk-top-modes{
                display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%;
            }
            .rk-top-mode{
                appearance:none;cursor:var(--solis-preview-cursor-hand);margin:0;
                border:1.5px solid rgba(200,185,170,.4);
                background:linear-gradient(145deg,rgba(255,255,255,.85),rgba(255,255,255,.45));
                border-radius:10px;
                padding:9px 6px;
                font-family:'Plus Jakarta Sans',sans-serif;
                font-size:11.5px;font-weight:700;letter-spacing:-.01em;
                color:rgba(50,38,28,.78);
                transition:border-color .12s ease,background .12s ease,color .12s ease,box-shadow .12s ease;
            }
            .rk-top-mode:hover{
                border-color:rgba(249,115,22,.45);
                color:#9a3412;
                box-shadow:0 0 0 1px rgba(249,115,22,.12);
            }
            .rk-top-mode.on{
                border-color:rgba(249,115,22,.55);
                background:linear-gradient(145deg,rgba(255,237,213,.95),rgba(254,215,170,.55));
                color:#9a3412;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 0 0 1px rgba(249,115,22,.15);
            }
            .ranking-preview-container{
                position:relative !important;
            }
            .ranking-preview-container .rk-top-panel{
                position:absolute;left:0;right:0;top:0;z-index:1;
                height:25%;pointer-events:none;overflow:hidden;
                background:#fff;
                margin:0;width:100%;border-radius:0;
                box-sizing:border-box;
            }
            .ranking-preview-container .rk-top-handle{
                position:absolute;left:0;right:0;bottom:0;height:14px;
                cursor:var(--solis-preview-cursor-hand);pointer-events:auto;z-index:3;
                background:linear-gradient(180deg,transparent,rgba(0,0,0,.08));
            }
            .ranking-preview-container .rk-top-handle::after{
                content:'';position:absolute;left:50%;bottom:4px;
                width:36px;height:3px;border-radius:999px;
                transform:translateX(-50%);
                background:rgba(0,0,0,.28);
            }
            .ranking-preview-container .rk-top-panel[hidden]{display:none!important;}
            .ranking-preview-container .rk-top-panel.mode-blank{background:#fff;}
            .ranking-preview-container .rk-top-panel.mode-blur{
                background:rgba(255,255,255,.72);
                backdrop-filter:none;
                -webkit-backdrop-filter:none;
            }
            .ranking-preview-container .rk-top-panel .rk-top-blur-vid{
                position:absolute;inset:0;width:100%;height:100%;
                object-fit:cover;object-position:center top;
                filter:blur(64px) saturate(1.22) brightness(1.26) contrast(0.95);
                -webkit-filter:blur(64px) saturate(1.22) brightness(1.26) contrast(0.95);
                transform:scale(1.7);transform-origin:center top;
                pointer-events:none;opacity:0;z-index:0;
                transition:opacity .18s ease;
            }
            .ranking-preview-container .rk-top-panel.mode-blur .rk-top-blur-vid{opacity:1;}
            .ranking-preview-container .rk-top-panel.mode-blur.has-blur-src{
                background:rgba(255,255,255,.35);
            }
            .ranking-preview-container .rk-top-panel.mode-blur::after{
                content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
                background:
                    linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08));
            }
            .rk-top-line.is-hidden{display:none!important;}
            .ranking-preview-container.has-rk-top > .ranking-editor-zone-header,
            .ranking-preview-container.has-rk-top > .ranking-editor-zone-ranks,
            .ranking-preview-container.has-rk-top > .ranking-list{
                position:relative;z-index:6;
            }
            /* Titles + channel always above blank/blur — never buried mid-band */
            .ranking-preview-container.has-rk-top [data-template-element-id^="title_"],
            .ranking-preview-container.has-rk-top h1.title,
            .ranking-preview-container.has-rk-top .ranking-editor-zone-header{
                position:relative;z-index:7;
            }
            /* Ranks zone can be nudged on Y — grab numbers/titles to drag */
            .ranking-preview-container .ranking-editor-zone-ranks{
                cursor:var(--solis-preview-cursor-hand);
                will-change:transform;
                touch-action:none;
            }
            .ranking-preview-container .ranking-editor-zone-ranks [data-template-element-id],
            .ranking-preview-container .ranking-editor-zone-ranks .ranking-editor-text{
                cursor:var(--solis-preview-cursor-hand);
                touch-action:none;
                pointer-events:auto;
            }
            .ranking-preview-container.rk-stack-dragging,
            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks,
            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks [data-template-element-id],
            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks .ranking-editor-text,
            .ranking-preview-container.rk-stack-dragging .ranking-editor-zone-ranks *{
                cursor:var(--solis-preview-cursor-grabbing) !important;
                transition:none !important;
            }
            .ranking-preview-container .ranking-editor-zone-ranks:active,
            .ranking-preview-container .ranking-editor-zone-ranks:active [data-template-element-id],
            .ranking-preview-container .ranking-editor-zone-ranks:active .ranking-editor-text{
                cursor:var(--solis-preview-cursor-grabbing) !important;
            }
            .ranking-preview-container [data-template-element-id].is-resizing,
            .ranking-preview-container [data-template-element-id].is-resizing *,
            .ranking-preview-container .sub-resize-handle:active{
                cursor:var(--solis-preview-cursor-grabbing) !important;
            }
            .ranking-preview-container.rk-stack-settle .ranking-editor-zone-ranks{
                transition:transform .18s ease !important;
            }
            .ranking-preview-container .ranking-editor-zone-ranks{
                transform:translateY(var(--rk-oy, 0px));
            }
            /* Let resized title sizes stick (template used inherit/clamp !important) */
            .ranking-preview-container [data-template-element-id="title_ranking"],
            .ranking-preview-container [data-template-element-id="title_funniest"]{
                font-size:inherit;
                display:inline-block !important;
                vertical-align:baseline;
                max-width:100%;
            }
            .ranking-preview-container [data-template-element-id="title_channel"]{
                max-width:calc(100% - 16px)!important;
            }
            .ranking-preview-container h1.title,
            .ranking-preview-container h1{
                max-width:100% !important;
                box-sizing:border-box !important;
                overflow:visible !important;
            }
            .ranking-preview-container .ranking-editor-zone-header{
                max-width:100% !important;
                box-sizing:border-box !important;
                overflow:visible !important;
            }
            .ranking-preview-container [data-template-element-id].rk-sized{
                line-height:1.1;
            }
            // Phone keeps the stack in frame; selected chrome may paint slightly outside
            #templateVideoPreview.preview-placeholder .ranking-preview-container{
                max-width:100% !important;
                max-height:100% !important;
                overflow:hidden !important;
            }
            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-header,
            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-ranks,
            #templateVideoPreview.preview-placeholder .ranking-preview-container [data-template-element-id].ranking-editor-selected,
            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-zone-selected,
            #templateVideoPreview.preview-placeholder .ranking-preview-container .ranking-editor-resize-anchor{
                overflow:visible !important;
            }
            /* Prevent title glyphs from being clipped by the phone edge */
            #templateVideoPreview.preview-placeholder .ranking-preview-container h1.title,
            #templateVideoPreview.preview-placeholder .ranking-preview-container [data-template-element-id^="title_"]{
                overflow:visible !important;
                text-overflow:clip !important;
            }
            /* Ranking font menu — match subtitle dropdown (simple list) */
            #rkDdFont.sub-font-dd{
                padding:8px;
                min-width:200px;
                max-width:min(240px,calc(100vw - 24px));
                max-height:min(320px,calc(100vh - 24px));
                overflow:auto;
                gap:3px;
            }
            #rkDdFont .rk-font-search,
            #rkDdFont .sub-fcheck{
                display:none !important;
            }
            /* Custom color: hue + SV panel */
            .rk-cplus-lab{
                font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                color:rgba(50,38,28,.42);margin:8px 0 4px;
            }
            .rk-cplus-lab:first-of-type{margin-top:0;}
            .rk-sv-panel{
                position:relative;height:110px;border-radius:12px;cursor:crosshair;
                border:1px solid rgba(255,255,255,.85);
                box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 1px 3px rgba(120,90,60,.1);
                touch-action:none;overflow:hidden;
            }
            .rk-sv-thumb{
                position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;
                border-radius:999px;pointer-events:none;
                border:2px solid #fff;box-shadow:0 1px 4px rgba(40,28,18,.35);
                left:92%;top:44%;
            }
            .rk-sv-panel.is-dragging .rk-sv-thumb{transition:none;}
            .rk-blank-line.is-hidden{display:none!important;}
        `;
        let s = document.getElementById('rk-pill-styles');
        if (!s) {
            s = document.createElement('style');
            s.id = 'rk-pill-styles';
            document.head.appendChild(s);
        }
        s.textContent = css;
    }

    function normalizeHex(c) {
        if (!c) return '';
        const s = String(c).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
        }
        const hex = rgbToHex(s);
        return hex && hex.startsWith('#') ? hex.toLowerCase() : '';
    }

    function loadCustomCols() {
        try {
            const raw = JSON.parse(localStorage.getItem(CUSTOM_COLS_KEY) || '[]');
            if (!Array.isArray(raw)) return [];
            return raw.map((c) => normalizeHex(c)).filter(Boolean).slice(0, 6);
        } catch (_) {
            return [];
        }
    }

    function saveCustomCol(hex) {
        hex = normalizeHex(hex);
        if (!hex) return;
        const next = [hex, ...loadCustomCols().filter((c) => c !== hex)].slice(0, 6);
        try { localStorage.setItem(CUSTOM_COLS_KEY, JSON.stringify(next)); } catch (_) {}
        return next;
    }

    function hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => {
            const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    function isPlusPopOpen() {
        return !!document.getElementById('rkCPlusPop')?.classList.contains('open');
    }

    function closePlusPop() {
        const pop = document.getElementById('rkCPlusPop');
        if (!pop) return;
        pop.classList.remove('open');
        pop.setAttribute('aria-hidden', 'true');
        ddColor?.querySelectorAll('.sub-sw-add').forEach((b) => b.classList.remove('on'));
    }

    function openPlusPop() {
        const pop = document.getElementById('rkCPlusPop');
        if (!pop) return;
        pop.classList.add('open');
        pop.setAttribute('aria-hidden', 'false');
        const title = document.getElementById('rkCPlusTitle');
        if (title) {
            title.textContent = colorTarget === 'blank'
                ? 'Custom blank'
                : (colorTarget === 'fill' ? 'Custom fill' : 'Custom text');
        }
        ddColor?.querySelectorAll('.sub-sw-add').forEach((b) => {
            b.classList.toggle('on', (b.dataset.target || 'text') === colorTarget);
        });
        syncSpectrumUI();
        renderPlusRecents();
        wireSpectrum();
        wireSvPanel();
    }

    function spectrumHex() {
        return hslToHex(spectrumHue, spectrumSat, spectrumLight);
    }

    function syncSpectrumUI() {
        const hex = spectrumHex();
        const thumb = document.getElementById('rkSpectrumThumb');
        if (thumb) {
            thumb.style.left = `${Math.max(0, Math.min(100, spectrumHue / 3.6))}%`;
            thumb.style.background = hex;
        }
        const sv = document.getElementById('rkSvPanel');
        if (sv) {
            const hue = `hsl(${spectrumHue},100%,50%)`;
            sv.style.background =
                `linear-gradient(to bottom, rgba(0,0,0,0), #000),` +
                `linear-gradient(to right, #fff, ${hue})`;
        }
        const svThumb = document.getElementById('rkSvThumb');
        if (svThumb) {
            svThumb.style.left = `${Math.max(0, Math.min(100, spectrumSat))}%`;
            svThumb.style.top = `${Math.max(0, Math.min(100, 100 - spectrumLight))}%`;
            svThumb.style.background = hex;
        }
    }

    function commitSpectrumColor(hex, preview) {
        if (preview) {
            if (colorTarget === 'blank') previewBlankColor(hex);
            else if (colorTarget === 'fill') previewTextColor(hex);
            else previewTextColor(hex);
            return;
        }
        if (colorTarget === 'blank') {
            applyBlankColor(hex, true);
            saveCustomCol(hex);
            renderPlusRecents();
        } else if (colorTarget === 'fill') {
            applyFillColor(hex, true);
            saveCustomCol(hex);
            renderPlusRecents();
        } else {
            applyTextColor(hex, true);
            saveCustomCol(hex);
            renderPlusRecents();
        }
    }

    function renderPlusRecents() {
        const box = document.getElementById('rkCPlusRecents');
        if (!box) return;
        const cols = loadCustomCols();
        box.innerHTML = '';
        cols.forEach((c) => {
            const s = document.createElement('button');
            s.type = 'button';
            s.className = 'sub-cplus-sw';
            s.style.background = c;
            s.title = c;
            if (c === '#ffffff') {
                s.style.boxShadow = '0 1px 2px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)';
            }
            s.onmousedown = (e) => {
                if (document.querySelector('.rk-inline-editing')) e.preventDefault();
            };
            s.onclick = () => {
                if (colorTarget === 'blank') applyBlankColor(c, true);
                else if (colorTarget === 'fill') applyFillColor(c, true);
                else applyTextColor(c, true);
                closePlusPop();
            };
            box.appendChild(s);
        });
    }

    function wireSpectrum() {
        const bar = document.getElementById('rkSpectrum');
        if (!bar || bar._wired) return;
        bar._wired = true;
        const pick = (clientX, preview) => {
            const r = bar.getBoundingClientRect();
            const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
            spectrumHue = Math.round(t * 360);
            const hex = spectrumHex();
            syncSpectrumUI();
            commitSpectrumColor(hex, preview);
        };
        bar.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            bar.classList.add('is-dragging');
            bar.setPointerCapture?.(e.pointerId);
            pick(e.clientX, true);
            const onMove = (ev) => pick(ev.clientX, true);
            const onUp = (ev) => {
                bar.classList.remove('is-dragging');
                bar.releasePointerCapture?.(ev.pointerId);
                bar.removeEventListener('pointermove', onMove);
                bar.removeEventListener('pointerup', onUp);
                bar.removeEventListener('pointercancel', onUp);
                pick(ev.clientX, false);
            };
            bar.addEventListener('pointermove', onMove);
            bar.addEventListener('pointerup', onUp);
            bar.addEventListener('pointercancel', onUp);
        });
        document.getElementById('rkCPlusClose')?.addEventListener('click', (e) => {
            e.stopPropagation();
            closePlusPop();
        });
    }

    function wireSvPanel() {
        const panel = document.getElementById('rkSvPanel');
        if (!panel || panel._wired) return;
        panel._wired = true;
        const pick = (clientX, clientY, preview) => {
            const r = panel.getBoundingClientRect();
            const sx = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
            const sy = Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height)));
            spectrumSat = Math.round(sx * 100);
            spectrumLight = Math.round((1 - sy) * 100);
            const hex = spectrumHex();
            syncSpectrumUI();
            commitSpectrumColor(hex, preview);
        };
        panel.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            panel.classList.add('is-dragging');
            panel.setPointerCapture?.(e.pointerId);
            pick(e.clientX, e.clientY, true);
            const onMove = (ev) => pick(ev.clientX, ev.clientY, true);
            const onUp = (ev) => {
                panel.classList.remove('is-dragging');
                panel.releasePointerCapture?.(ev.pointerId);
                panel.removeEventListener('pointermove', onMove);
                panel.removeEventListener('pointerup', onUp);
                panel.removeEventListener('pointercancel', onUp);
                pick(ev.clientX, ev.clientY, false);
            };
            panel.addEventListener('pointermove', onMove);
            panel.addEventListener('pointerup', onUp);
            panel.addEventListener('pointercancel', onUp);
        });
    }

    function makeAddSwatch(target) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sub-sw sub-sw-add';
        btn.dataset.target = target === 'fill' ? 'fill' : (target === 'blank' ? 'blank' : 'text');
        btn.title = target === 'blank' ? 'Custom blank' : (target === 'fill' ? 'Custom fill' : 'Custom text');
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.25v9.5M3.25 8h9.5"/></svg>';
        btn.onmousedown = (e) => {
            if (document.querySelector('.rk-inline-editing')) e.preventDefault();
        };
        btn.onclick = (e) => {
            e.stopPropagation();
            colorTarget = btn.dataset.target || 'text';
            const title = document.getElementById('rkCPlusTitle');
            if (title) {
                title.textContent = colorTarget === 'blank'
                    ? 'Custom blank'
                    : (colorTarget === 'fill' ? 'Custom fill' : 'Custom text');
            }
            ddColor?.querySelectorAll('.sub-sw-add').forEach((b) => {
                b.classList.toggle('on', b.dataset.target === colorTarget && isPlusPopOpen());
            });
            if (isPlusPopOpen() && btn.classList.contains('on')) {
                closePlusPop();
                return;
            }
            openPlusPop();
            btn.classList.add('on');
        };
        return btn;
    }

    /** Non-collapsed selection inside an actively editing ranking element. */
    function getInlineEditSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
        const range = sel.getRangeAt(0);
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentElement;
        const editing = node?.closest?.('.rk-inline-editing');
        if (!editing || !editing.hasAttribute('data-template-element-id')) return null;
        if (!editing.contains(range.startContainer) || !editing.contains(range.endContainer)) return null;
        return { range, editing, sel };
    }

    function colorSelectionRange(range, c) {
        const hex = normalizeHex(c) || c;
        // Entire selection already a single color span → just recolor it
        try {
            const start = range.startContainer;
            const end = range.endContainer;
            const a = start.nodeType === 3 ? start.parentElement : start;
            const b = end.nodeType === 3 ? end.parentElement : end;
            if (
                a && a === b && a.tagName === 'SPAN' && a.style.color
                && range.toString() === a.textContent
            ) {
                a.style.color = hex;
                return a;
            }
        } catch (_) { /* fall through */ }

        const span = document.createElement('span');
        span.style.color = hex;
        try {
            range.surroundContents(span);
        } catch (_) {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        try {
            const sel = window.getSelection();
            const r = document.createRange();
            r.selectNodeContents(span);
            sel.removeAllRanges();
            sel.addRange(r);
        } catch (_) { /* ignore */ }
        return span;
    }

    function beginColorPreview() {
        if (colorPreviewActive) return;
        colorPreviewActive = true;
        colorPreviewCur = colorTarget === 'fill' ? curFillCol : curTextCol;
        colorPreviewSnapshot.clear();
        colorPreviewSelSpan = null;
        const selInfo = colorTarget === 'text' ? getInlineEditSelection() : null;
        if (selInfo) {
            colorPreviewSnapshot.set(selInfo.editing, { html: selInfo.editing.innerHTML });
            return;
        }
        resolveApplyTargets().forEach((el) => {
            if (colorTarget === 'fill') {
                colorPreviewSnapshot.set(el, {
                    bg: el.style.backgroundColor || '',
                    pad: el.style.padding || '',
                    radius: el.style.borderRadius || '',
                    fill: el.classList.contains('rk-has-fill'),
                });
            } else {
                colorPreviewSnapshot.set(el, el.style.color || getComputedStyle(el).color || '');
            }
        });
    }

    function previewTextColor(c) {
        if (!activeEls.size && colorTarget !== 'blank') return;
        if (colorTarget === 'blank') {
            previewBlankColor(c);
            return;
        }
        beginColorPreview();
        if (colorTarget === 'fill') {
            resolveApplyTargets().forEach((el) => applyFillToEl(el, c));
            syncFillSwatches(c);
            return;
        }
        const selInfo = getInlineEditSelection();
        if (selInfo || colorPreviewSelSpan) {
            if (colorPreviewSelSpan?.isConnected) {
                colorPreviewSelSpan.style.color = c;
            } else if (selInfo) {
                colorPreviewSelSpan = colorSelectionRange(selInfo.range, c);
            }
            document.querySelectorAll('#rkTCG .sub-sw').forEach((sw) => {
                if (sw.classList.contains('sub-sw-add') || sw.classList.contains('nocolor')) return;
                sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === normalizeHex(c));
            });
            return;
        }
        resolveApplyTargets().forEach((el) => { el.style.color = c; });
        document.querySelectorAll('#rkTCG .sub-sw').forEach((sw) => {
            if (sw.classList.contains('sub-sw-add') || sw.classList.contains('nocolor')) return;
            sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === normalizeHex(c));
        });
    }

    function endColorPreview() {
        if (!colorPreviewActive) return;
        colorPreviewActive = false;
        colorPreviewSnapshot.forEach((snap, el) => {
            if (!el?.isConnected) return;
            if (snap && typeof snap === 'object' && 'html' in snap) {
                el.innerHTML = snap.html;
            } else if (snap && typeof snap === 'object' && 'bg' in snap) {
                el.style.backgroundColor = snap.bg;
                el.style.padding = snap.pad;
                el.style.borderRadius = snap.radius;
                el.classList.toggle('rk-has-fill', !!snap.fill);
            } else {
                el.style.color = snap;
            }
        });
        colorPreviewSnapshot.clear();
        colorPreviewSelSpan = null;
        if (colorTarget === 'fill') {
            if (colorPreviewCur !== undefined) curFillCol = colorPreviewCur;
        } else if (colorPreviewCur != null) {
            curTextCol = colorPreviewCur;
        }
        colorPreviewCur = null;
        previewTextCol = null;
        syncColorSwatches();
        syncFillSwatches();
    }

    function discardColorPreview() {
        // Commit path: drop snapshot without restoring old color
        colorPreviewActive = false;
        colorPreviewSnapshot.clear();
        colorPreviewCur = null;
        previewTextCol = null;
        colorPreviewSelSpan = null;
    }

    function applyFillToEl(el, hex) {
        if (!el) return;
        if (!hex) {
            el.style.backgroundColor = 'transparent';
            el.style.background = 'transparent';
            el.style.removeProperty('padding');
            el.style.removeProperty('border-radius');
            el.classList.remove('rk-has-fill');
            return;
        }
        const n = normalizeHex(hex) || hex;
        el.style.backgroundColor = n;
        el.style.background = n;
        el.style.padding = '4px 12px';
        el.style.borderRadius = '12px';
        el.classList.add('rk-has-fill');
    }

    function applyFillColor(c, persist) {
        if (colorPreviewActive) discardColorPreview();
        curFillCol = c ? (normalizeHex(c) || c) : null;
        if (persist !== false) fillTouched = true;
        resolveApplyTargets().forEach((el) => applyFillToEl(el, curFillCol));
        syncFillSwatches();
        if (persist !== false && window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        if (persist !== false) markLibraryRankingDirty();
    }

    function readFillFromEl(el) {
        if (!el) return null;
        const bg = el.style.backgroundColor || '';
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return null;
        return normalizeHex(bg) || rgbToHex(bg) || null;
    }

    function buildColorGrid() {
        const tg = document.getElementById('rkTCG');
        if (tg) {
            tg.innerHTML = '';
            TCOLS.forEach((c) => {
                const sw = document.createElement('div');
                sw.className = 'sub-sw';
                sw.dataset.color = c;
                sw.style.background = c;
                if (String(c).toLowerCase() === '#ffffff') {
                    sw.style.boxShadow = '0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)';
                }
                sw.onmousedown = (e) => {
                    if (document.querySelector('.rk-inline-editing')) e.preventDefault();
                };
                sw.onpointerenter = () => {
                    colorTarget = 'text';
                    previewTextColor(c);
                };
                sw.onpointerleave = () => {
                    endColorPreview();
                };
                sw.onclick = () => {
                    colorTarget = 'text';
                    applyTextColor(c, true);
                    closePlusPop();
                };
                tg.appendChild(sw);
            });
            tg.appendChild(makeAddSwatch('text'));
        }

        buildOutlineColorGrid();
        buildBlankColorGrid();

        // Strip leftover text-plate fills — backgrounds are top-section only now
        try {
            document.querySelectorAll('.ranking-preview-container .rk-has-fill').forEach((el) => {
                el.classList.remove('rk-has-fill');
                el.style.background = 'transparent';
                el.style.backgroundColor = 'transparent';
                el.style.removeProperty('padding');
                el.style.removeProperty('border-radius');
            });
        } catch (_) { /* ignore */ }

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
        const og = document.getElementById('rkOCG');
        if (!og) return;
        og.innerHTML = '';
        OUTLINE_COLS.forEach((c) => {
            const sw = document.createElement('div');
            sw.className = 'sub-sw';
            sw.dataset.color = c;
            sw.style.background = c;
            if (String(c).toLowerCase() === '#ffffff') {
                sw.style.boxShadow = '0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)';
            }
            sw.title = `Outline ${c}`;
            sw.onmousedown = (e) => {
                if (document.querySelector('.rk-inline-editing')) e.preventDefault();
            };
            sw.onpointerenter = () => previewOutlineColor(c);
            sw.onpointerleave = () => endOutlineColorPreview();
            sw.onclick = () => applyOutlineColor(c);
            og.appendChild(sw);
        });
        syncOutlineColSwatches();
    }

    let outlinePreviewSaved = undefined;
    function previewOutlineColor(c) {
        if (!activeEls.size) return;
        if (outlinePreviewSaved === undefined) outlinePreviewSaved = curOutlineCol;
        const hex = normalizeHex(c) || c || '#000000';
        resolveApplyTargets().forEach((el) => {
            const type = getElShadowType(el) === 'none' ? (curShadow || 'outline') : getElShadowType(el);
            if (type === 'none') return;
            el.style.setProperty('text-shadow', shadowCss(type === 'stroke' ? 'outline' : type, hex), 'important');
        });
        document.querySelectorAll('#rkOCG .sub-sw').forEach((sw) => {
            sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === (normalizeHex(hex) || '').toLowerCase());
        });
    }

    function endOutlineColorPreview() {
        if (outlinePreviewSaved === undefined) return;
        const restore = outlinePreviewSaved;
        outlinePreviewSaved = undefined;
        curOutlineCol = restore;
        resolveApplyTargets().forEach((el) => setElementShadow(el, getElShadowType(el) === 'none' ? curShadow : getElShadowType(el)));
        syncOutlineColSwatches();
    }

    function syncOutlineColSwatches() {
        const cur = (normalizeHex(curOutlineCol) || '#000000').toLowerCase();
        document.querySelectorAll('#rkOCG .sub-sw').forEach((sw) => {
            sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === cur);
        });
    }

    function isDarkHex(hex) {
        const n = normalizeHex(hex);
        if (!n) return true;
        const r = parseInt(n.slice(1, 3), 16);
        const g = parseInt(n.slice(3, 5), 16);
        const b = parseInt(n.slice(5, 7), 16);
        return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 140;
    }

    function applyOutlineColor(c) {
        outlinePreviewSaved = undefined;
        curOutlineCol = normalizeHex(c) || c || '#000000';
        if (curShadow === 'none') curShadow = 'outline';
        shadowTouched = true;
        const targets = resolveApplyTargets();
        targets.forEach((el) => {
            setElementShadow(el, curShadow);
            // Persist outline color into customs when possible
            const eid = el.getAttribute('data-template-element-id');
            if (eid && window.rankingCustomizer?.customizations) {
                const node = window.rankingCustomizer.customizations[eid]
                    || (window.rankingCustomizer.customizations[eid] = {});
                const rgba = window.rankingCustomizer._colorToRgba?.(curOutlineCol);
                if (rgba) node.outline_color = rgba;
            }
            snapshotEl(el);
        });
        syncOutlineColSwatches();
        syncShadowSeg();
        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        markLibraryRankingDirty();
        maybeOfferStyleSuggest(targets, { shadow: curShadow });
    }

    function buildBlankColorGrid() {
        const bg = document.getElementById('rkBlankCG');
        if (!bg) return;
        bg.innerHTML = '';
        BCOLS.forEach((c) => {
            const sw = document.createElement('div');
            sw.className = 'sub-sw';
            sw.dataset.color = c;
            sw.style.background = c;
            if (String(c).toLowerCase() === '#ffffff') {
                sw.style.boxShadow = '0 1px 3px rgba(120,90,60,.12), inset 0 0 0 1px rgba(0,0,0,.12)';
            }
            sw.onmousedown = (e) => {
                if (document.querySelector('.rk-inline-editing')) e.preventDefault();
            };
            sw.onclick = () => {
                colorTarget = 'blank';
                applyBlankColor(c, true);
                closePlusPop();
            };
            bg.appendChild(sw);
        });
        bg.appendChild(makeAddSwatch('blank'));
        syncBlankColSwatches();
    }

    function syncBlankColSwatches() {
        const layout = getRankingLayout();
        const cur = (normalizeHex(layout.top_panel_color) || '#000000').toLowerCase();
        document.querySelectorAll('#rkBlankCG .sub-sw').forEach((sw) => {
            if (sw.classList.contains('sub-sw-add')) return;
            sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === cur);
        });
    }

    function syncBlankBgVisibility() {
        const line = document.getElementById('rkBlankLine');
        if (!line) return;
        const mode = (topHoverPreviewMode != null)
            ? topHoverPreviewMode
            : (getRankingLayout().top_panel || 'none');
        const show = mode === 'blank' && selectionAllowsTopBg();
        line.classList.toggle('is-hidden', !show);
        line.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function previewBlankColor(hex) {
        const root = getRankingRoot();
        const panel = root?.querySelector(':scope > .rk-top-panel');
        if (!panel || panel.hidden) return;
        panel.style.background = normalizeHex(hex) || hex || '#000';
    }

    function applyBlankColor(hex, persist) {
        const n = normalizeHex(hex) || hex || '#000000';
        const patch = { top_panel: 'blank', top_panel_color: n };
        setRankingLayout(patch);
        // Dark blank → prefer a light outline so titles stay readable
        if (persist !== false && isDarkHex(n) && isDarkHex(curOutlineCol)) {
            applyOutlineColor('#ffffff');
        } else if (persist !== false && !isDarkHex(n) && !isDarkHex(curOutlineCol)) {
            applyOutlineColor('#000000');
        }
        syncBlankColSwatches();
        syncBlankBgVisibility();
    }

    function syncShadowSeg(id) {
        const g = document.getElementById('rkSHG');
        if (!g) return;
        const target = id || curShadow;
        g.querySelectorAll('.sub-edge-opt').forEach((c) => {
            c.classList.toggle('on', c.dataset.sh === target);
        });
    }

    function buildShadowGrid() {
        const g = document.getElementById('rkSHG');
        if (!g) return;
        g.innerHTML = '';
        g.className = 'sub-edge';
        const shadows = [
            ['none', 'Off'],
            ['outline', 'Outline'],
            ['thick-outline', 'Thick'],
        ];
        shadows.forEach(([id, label]) => {
            const c = document.createElement('button');
            c.type = 'button';
            c.className = 'sub-edge-opt' + (id === curShadow ? ' on' : '');
            c.dataset.sh = id;
            c.title = label === 'Off' ? 'No outline' : (label === 'Thick' ? 'Thick outline' : 'Outline');
            c.innerHTML =
                `<span class="sub-edge-sample" aria-hidden="true"><span class="sub-edge-aa">Aa</span></span>` +
                `<span class="sub-edge-label">${label}</span>`;
            c.addEventListener('pointerenter', () => {
                if (!activeEls.size && selectionMode === 'single') return;
                if (shadowPreviewSaved === undefined) shadowPreviewSaved = curShadow;
                applyOutlinePreview(id);
                syncShadowSeg(id);
            });
            c.addEventListener('pointerleave', () => {
                if (shadowPreviewSaved === undefined) return;
                const restore = shadowPreviewSaved;
                shadowPreviewSaved = undefined;
                applyOutlinePreview(restore);
                syncShadowSeg();
            });
            c.addEventListener('click', () => {
                shadowPreviewSaved = undefined;
                applyShadow(id);
            });
            g.appendChild(c);
        });
        requestAnimationFrame(() => syncShadowSeg());
    }

    function applyOutlinePreview(type) {
        resolveApplyTargets().forEach((el) => setElementShadow(el, type));
    }

    function selectionAllowsTopBg() {
        if (selectionMode === 'group-ranks') return false;
        if (selectionMode === 'group-header') return true;
        const els = [...activeEls];
        if (!els.length) return true;
        if (els.some(isRankEl) && !els.some(isHeaderEl)) return false;
        return els.every(isHeaderEl);
    }

    function syncTopBgVisibility() {
        const line = ddColor?.querySelector('.rk-top-line');
        if (!line) return;
        const show = selectionAllowsTopBg();
        line.classList.toggle('is-hidden', !show);
        line.setAttribute('aria-hidden', show ? 'false' : 'true');
        syncBlankBgVisibility();
    }

    function syncColorSwatches() {
        const cur = (normalizeHex(curTextCol) || '').toLowerCase();
        document.querySelectorAll('#rkTCG .sub-sw').forEach((sw) => {
            if (sw.classList.contains('sub-sw-add') || sw.classList.contains('nocolor')) return;
            sw.classList.toggle('on', (normalizeHex(sw.dataset.color) || '') === cur);
        });
    }

    function syncFillSwatches(_override) {
        // Text fills removed — backgrounds are None / Blank / Blur on the top section
    }

    function getRankingLayout() {
        const customs = window.rankingCustomizer?.customizations || {};
        const layout = customs[RANKING_LAYOUT_KEY]
            || window.__solisRankingLayout
            || {};
        let ratio = Number(layout.top_ratio);
        // v2: old builds forced ≥32% (felt like half the phone) — soft-reset once
        if (layout.v !== 2) {
            if (!Number.isFinite(ratio) || ratio >= 0.32) {
                ratio = TOP_PANEL_RATIO;
            }
        } else if (!Number.isFinite(ratio)) {
            ratio = TOP_PANEL_RATIO;
        }
        return {
            top_panel: layout.top_panel === 'blank' || layout.top_panel === 'blank_blur'
                ? layout.top_panel
                : 'none',
            top_panel_color: normalizeHex(layout.top_panel_color) || '#000000',
            top_ratio: Math.max(TOP_PANEL_MIN, Math.min(TOP_PANEL_MAX, ratio)),
            offset_x_pct: 0,
            offset_y_pct: (() => {
                const raw = Number(layout.offset_y_pct);
                if (!Number.isFinite(raw)) return 0;
                const root = getRankingRoot();
                if (!root) return Math.max(-0.35, Math.min(0.45, raw));
                const b = computeStackOffsetBounds(root);
                return Math.max(b.minPct, Math.min(b.maxPct, raw));
            })(),
            v: 2,
        };
    }

    /** Keep rank numbers below titles and inside the phone — no sliding under/over the header band */
    function computeStackOffsetBounds(root) {
        root = root || getRankingRoot();
        if (!root) return { minPct: 0, maxPct: 0 };
        const rootH = Math.max(1, root.getBoundingClientRect().height || 1);
        const headerZone = getHeaderZone();
        const ranksZone = getRanksZone();
        if (!ranksZone) return { minPct: 0, maxPct: 0 };

        // Measure WITHOUT resetting --rk-oy (that flash was bouncing the stack on every drag frame).
        const currentOyPx = parseFloat(String(root.style.getPropertyValue('--rk-oy') || '0')) || 0;
        const rootTop = root.getBoundingClientRect().top;
        let headerBottom = 0;
        if (headerZone) {
            headerBottom = headerZone.getBoundingClientRect().bottom - rootTop;
        }
        getHeaderElements().forEach((el) => {
            if (!el?.isConnected) return;
            const r = el.getBoundingClientRect();
            if (r.height > 0) headerBottom = Math.max(headerBottom, r.bottom - rootTop);
        });

        const ranksRect = ranksZone.getBoundingClientRect();
        // Undo live translate so bounds stay in un-offset space
        const ranksTop = (ranksRect.top - rootTop) - currentOyPx;
        const ranksBottom = (ranksRect.bottom - rootTop) - currentOyPx;

        const gap = Math.max(6, rootH * 0.012);
        const pad = Math.max(4, rootH * 0.01);

        let minPct = (headerBottom + gap - ranksTop) / rootH;
        let maxPct = (rootH - pad - ranksBottom) / rootH;
        // Absolute burn-compatible clamp, then guarantee usable downward travel
        // (tall rank lists used to leave maxPct≈0 → drag felt like a bounce wall)
        minPct = Math.max(-0.35, Math.min(0.45, minPct));
        maxPct = Math.max(-0.35, Math.min(0.45, maxPct));
        if (maxPct < minPct) {
            const mid = (minPct + maxPct) / 2;
            minPct = mid;
            maxPct = mid;
        }
        if (maxPct < minPct + 0.1) {
            maxPct = Math.min(0.45, minPct + 0.1);
        }
        if (maxPct < 0.12) maxPct = 0.12;

        return {
            minPct,
            maxPct,
        };
    }

    function applyStackOffset(layout) {
        const root = getRankingRoot();
        if (!root) return;
        layout = layout || getRankingLayout();
        const rootH = Math.max(1, root.getBoundingClientRect().height || 1);
        const bounds = computeStackOffsetBounds(root);
        const oyPct = Math.max(bounds.minPct, Math.min(bounds.maxPct, Number(layout.offset_y_pct) || 0));
        const oyPx = Math.round(oyPct * rootH);
        root.style.setProperty('--rk-oy', `${oyPx}px`);
        root.style.removeProperty('--rk-ox');
    }

    let suppressRankPointerClickUntil = 0;

    function markRankPointerClickSuppress(ms = 480) {
        suppressRankPointerClickUntil = Date.now() + ms;
    }

    function consumeRankPointerClick() {
        if (Date.now() < suppressRankPointerClickUntil) {
            suppressRankPointerClickUntil = 0;
            return true;
        }
        return false;
    }

    /** Drag the rank stack on the Y axis (numbers + titles move together). */
    let _stackDragSession = null; // { pointerId, cleanup }

    function endStackDragSession(reason) {
        const s = _stackDragSession;
        _stackDragSession = null;
        if (!s) return;
        try { s.cleanup(reason); } catch (_) { /* ignore */ }
    }

    function wireStackDrag(root) {
        root = root || getRankingRoot();
        if (!root) return;
        let zone = root.querySelector('.ranking-editor-zone-ranks');
        if (!zone) return;
        if (zone.dataset.rkYDrag === '2') return;

        // Drop any legacy drag listener without touching selection / editor state.
        // (Older builds set rkYDrag=1 and captured every click — only Ctrl worked.)
        if (zone.dataset.rkYDrag) {
            const clean = zone.cloneNode(true);
            delete clean.dataset.rkYDrag;
            zone.parentNode?.replaceChild(clean, zone);
            zone = clean;
            // Rebind template-editor clicks on the new node (do NOT deselect / reset pill)
            try {
                const ed = window.rankingTemplateEditor;
                if (ed && ed.container) {
                    ed.destroy();
                    ed._abort = new AbortController();
                    ed.ensureZones();
                    ed.setupTextElements();
                    ed.attachEventListeners();
                }
            } catch (_) { /* ignore */ }
            zone = root.querySelector('.ranking-editor-zone-ranks') || zone;
        }
        if (!zone || zone.dataset.rkYDrag === '2') return;
        zone.dataset.rkYDrag = '2';
        // Prevent browser scroll/zoom stealing the hold on rank numbers
        try { zone.style.touchAction = 'none'; } catch (_) { /* ignore */ }

        const DRAG_THRESHOLD_PX = 4;
        const COMMIT_MIN_PCT = 0.004; // ~ignore hold/release jitter

        zone.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            // Touch+mouse dual events: only the primary pointer may start a drag
            if (e.isPrimary === false) return;
            if (e.target.closest?.('.sub-resize-handle')) return;
            if (e.target.closest?.('#rkPillMenu') || e.target.closest?.('.sub-dropdown')) return;
            // Only skip while actively typing a title (focused contenteditable)
            const editing = e.target.closest?.('[contenteditable="true"], .rk-inline-editing');
            if (editing) return;
            // Titles / header lines: allow double-click text edit — drag from numbers or empty pad
            const textEl = e.target.closest?.('[data-template-element-id]');
            if (textEl) {
                const tid = textEl.getAttribute('data-template-element-id') || '';
                const isNumber = /^rank_\d+_number$/.test(tid);
                if (!isNumber) return;
            }
            if (e.ctrlKey || e.metaKey) return;

            // Kill any stuck prior hold (the "release then click again" bug)
            if (_stackDragSession) {
                endStackDragSession('superseded');
            }

            // Drag from empty zone OR from ranking numbers / titles.
            // Click (no move) still selects via pointerup — move past threshold = Y drag.
            const pointerId = e.pointerId;
            const layout = getRankingLayout();
            const startY = e.clientY;
            const startX = e.clientX;
            const startPct = Number(layout.offset_y_pct) || 0;
            const rootH = Math.max(1, root.getBoundingClientRect().height || 1);
            const bounds = computeStackOffsetBounds(root);
            let moved = false;
            let captured = false;
            let finished = false;

            const cleanup = () => {
                finished = true;
                window.removeEventListener('pointermove', onMove, true);
                window.removeEventListener('pointerup', onUp, true);
                window.removeEventListener('pointercancel', onUp, true);
                window.removeEventListener('lostpointercapture', onLostCapture, true);
                if (captured || zone.hasPointerCapture?.(pointerId)) {
                    try { zone.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
                }
                captured = false;
                root.classList.remove('rk-stack-dragging');
                if (_stackDragSession && _stackDragSession.pointerId === pointerId) {
                    _stackDragSession = null;
                }
            };

            const onMove = (ev) => {
                if (finished) return;
                if (ev.pointerId != null && ev.pointerId !== pointerId) return;
                const dy = ev.clientY - startY;
                const dx = ev.clientX - startX;
                if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
                if (!moved) {
                    moved = true;
                    try {
                        zone.setPointerCapture(pointerId);
                        captured = true;
                    } catch (_) { /* ignore */ }
                }
                if (ev.cancelable) ev.preventDefault();
                root.classList.add('rk-stack-dragging');
                root.classList.remove('rk-stack-settle');
                if (activeEls.size && pill?.classList) {
                    pill.classList.add('active');
                    schedulePosMenu();
                }
                const rawPct = startPct + dy / rootH;
                const nextPct = Math.max(bounds.minPct, Math.min(bounds.maxPct, rawPct));
                root.style.setProperty('--rk-oy', `${Math.round(nextPct * rootH)}px`);
                zone._rkPendingOy = nextPct;
            };

            const onUp = (ev) => {
                if (finished) return;
                // Ignore other pointers — do NOT clear finished (that left hold stuck)
                if (ev && ev.pointerId != null && ev.pointerId !== pointerId) return;
                cleanup();
                if (!moved) return;

                const nextPct = Number.isFinite(zone._rkPendingOy) ? zone._rkPendingOy : startPct;
                delete zone._rkPendingOy;

                // Hold + tiny jitter: snap back, don't commit a ghost move
                if (Math.abs(nextPct - startPct) < COMMIT_MIN_PCT) {
                    root.style.setProperty('--rk-oy', `${Math.round(startPct * rootH)}px`);
                    return;
                }

                markRankPointerClickSuppress();
                // Keep the exact live pixel — avoid settle/reclamp jump on release
                const finalPx = Math.round(nextPct * rootH);
                root.style.setProperty('--rk-oy', `${finalPx}px`);
                const prev = getRankingLayout();
                storeRankingLayout({ ...prev, offset_y_pct: nextPct });
                markLibraryRankingDirty();
                if (activeEls.size) {
                    showMenu();
                    schedulePosMenu();
                }
            };

            const onLostCapture = (ev) => {
                if (finished) return;
                if (ev.pointerId != null && ev.pointerId !== pointerId) return;
                // Capture lost (browser interrupt) — force end so UI isn't stuck "holding"
                onUp(ev);
            };

            _stackDragSession = { pointerId, cleanup };
            // Capture-phase on window so release always reaches us even if another
            // handler stopPropagation's the bubble (was leaving a stuck hold).
            window.addEventListener('pointermove', onMove, { capture: true, passive: false });
            window.addEventListener('pointerup', onUp, { capture: true });
            window.addEventListener('pointercancel', onUp, { capture: true });
            window.addEventListener('lostpointercapture', onLostCapture, { capture: true });
        });
    }

    function storeRankingLayout(next) {
        const payload = { ...next, v: 2 };
        window.__solisRankingLayout = payload;
        if (window.rankingCustomizer) {
            if (!window.rankingCustomizer.customizations) {
                window.rankingCustomizer.customizations = {};
            }
            window.rankingCustomizer.customizations[RANKING_LAYOUT_KEY] = payload;
            if (typeof window.rankingCustomizer.saveCustomizations === 'function') {
                window.rankingCustomizer.saveCustomizations();
            }
        }
    }

    function setRankingLayout(partial) {
        const prev = getRankingLayout();
        const next = { ...prev, ...partial };
        topHoverPreviewMode = null;
        storeRankingLayout(next);
        applyRankingTopPanel(next);
        applyStackOffset(next);
        markLibraryRankingDirty();
        syncTopModeButtons();
    }

    function ensureRankingTopPanel(root) {
        if (!root) return null;
        let panel = root.querySelector(':scope > .rk-top-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'rk-top-panel';
            panel.setAttribute('aria-hidden', 'true');
            panel.hidden = true;
            panel.innerHTML = '<video class="rk-top-blur-vid" muted loop playsinline preload="auto"></video>';
            root.insertBefore(panel, root.firstChild);
        }
        // Legacy drag handle from older builds — remove if present
        panel.querySelectorAll('.rk-top-resize').forEach((n) => n.remove());
        // Fresh bottom-edge handle so users can resize the band (capped at TOP_PANEL_MAX)
        if (!panel.querySelector('.rk-top-handle')) {
            const handle = document.createElement('div');
            handle.className = 'rk-top-handle';
            handle.title = 'Drag to resize background';
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const root = getRankingRoot();
                if (!root) return;
                const rootH = Math.max(1, root.getBoundingClientRect().height || 1);
                const layout = getRankingLayout();
                const startY = e.clientY;
                const startRatio = Number(layout.top_ratio) || TOP_PANEL_RATIO;
                const pointerId = e.pointerId;
                try { handle.setPointerCapture(pointerId); } catch (_) {}
                const onMove = (ev) => {
                    const dy = ev.clientY - startY;
                    const next = Math.max(
                        TOP_PANEL_MIN,
                        Math.min(TOP_PANEL_MAX, startRatio + dy / rootH),
                    );
                    panel.style.height = `${Math.round(next * 1000) / 10}%`;
                    panel._rkPendingRatio = next;
                };
                const onUp = () => {
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    document.removeEventListener('pointercancel', onUp);
                    try { handle.releasePointerCapture(pointerId); } catch (_) {}
                    const next = Number.isFinite(panel._rkPendingRatio)
                        ? panel._rkPendingRatio
                        : startRatio;
                    delete panel._rkPendingRatio;
                    setRankingLayout({ top_ratio: next });
                };
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
                document.addEventListener('pointercancel', onUp);
            });
            panel.appendChild(handle);
        }
        return panel;
    }

    /** Soft minimum band so titles still sit inside blank/blur when oversized */
    function measureHeaderBandRatio(root) {
        root = root || getRankingRoot();
        if (!root) return TOP_PANEL_RATIO;
        const rootRect = root.getBoundingClientRect();
        const rootH = Math.max(1, rootRect.height || 1);
        let bottom = 0;
        const zone = getHeaderZone();
        if (zone) {
            const zr = zone.getBoundingClientRect();
            if (zr.height > 0) bottom = Math.max(bottom, zr.bottom - rootRect.top);
        }
        getHeaderElements().forEach((el) => {
            if (!el?.isConnected) return;
            const r = el.getBoundingClientRect();
            if (r.height > 0) bottom = Math.max(bottom, r.bottom - rootRect.top);
        });
        if (bottom <= 4) return TOP_PANEL_RATIO;
        const pad = Math.max(6, Math.round(rootH * 0.01));
        return Math.max(TOP_PANEL_MIN, Math.min(TOP_PANEL_MAX, (bottom + pad) / rootH));
    }

    /** Keep band tall enough for titles, but respect user-set ratio (default 25%, max 45%). */
    function syncTopPanelToHeader(opts) {
        opts = opts || {};
        const root = getRankingRoot();
        if (!root) return null;
        const layout = getRankingLayout();
        if (layout.top_panel === 'none') return null;
        const panel = ensureRankingTopPanel(root);
        if (!panel || panel.hidden) return null;
        const needed = measureHeaderBandRatio(root);
        const preferred = Number(layout.top_ratio);
        const base = Number.isFinite(preferred) ? preferred : TOP_PANEL_RATIO;
        const ratio = Math.max(TOP_PANEL_MIN, Math.min(TOP_PANEL_MAX, Math.max(base, needed)));
        panel.style.height = `${Math.round(ratio * 1000) / 10}%`;
        if (!opts.liveOnly && Math.abs(base - ratio) > 0.004) {
            storeRankingLayout({ ...layout, top_ratio: ratio, v: 2 });
            markLibraryRankingDirty();
        }
        return ratio;
    }

    function findRankingSourceVideo() {
        const cont = document.getElementById('templateVideoPreview');
        if (!cont) return null;
        return cont.querySelector('video.library-preview-video')
            || cont.querySelector('#splitscreenContentVideo')
            || Array.from(cont.querySelectorAll('video')).find((v) =>
                !v.classList.contains('rk-top-blur-vid')
                && !v.classList.contains('gp-blank-blur-vid')
            )
            || null;
    }

    function applyRankingTopPanel(layout) {
        const root = getRankingRoot();
        if (!root) return;
        layout = layout || getRankingLayout();
        const mode = layout.top_panel || 'none';
        // Ranking overlay must be a positioning context for the top band
        if (getComputedStyle(root).position === 'static') {
            root.style.position = 'relative';
        }
        const panel = ensureRankingTopPanel(root);
        if (!panel) return;
        root.classList.toggle('has-rk-top', mode !== 'none');
        if (mode === 'none') {
            panel.hidden = true;
            panel.classList.remove('mode-blur', 'mode-blank');
            const vid = panel.querySelector('.rk-top-blur-vid');
            if (vid) {
                try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (_) { /* ignore */ }
            }
            wireStackDrag(root);
            applyStackOffset(layout);
            return;
        }
        panel.hidden = false;
        panel.classList.toggle('mode-blur', mode === 'blank_blur');
        panel.classList.toggle('mode-blank', mode === 'blank');
        // Prefer stored ratio (default 25%); expand only if titles need more room (max 45%)
        const needed = measureHeaderBandRatio(root);
        const preferred = Number(layout.top_ratio);
        const ratio = Math.max(
            TOP_PANEL_MIN,
            Math.min(
                TOP_PANEL_MAX,
                Math.max(Number.isFinite(preferred) ? preferred : TOP_PANEL_RATIO, needed),
            ),
        );
        panel.style.height = `${Math.round(ratio * 1000) / 10}%`;
        const prevR = Number(layout.top_ratio);
        if (!Number.isFinite(prevR) || Math.abs(prevR - ratio) > 0.004) {
            storeRankingLayout({ ...layout, top_panel: mode, top_ratio: ratio, v: 2 });
        }
        const vid = panel.querySelector('.rk-top-blur-vid');
        if (mode === 'blank') {
            panel.classList.remove('has-blur-src');
            panel.style.background = layout.top_panel_color || '#000';
            if (vid) {
                try { vid.pause(); vid.removeAttribute('src'); } catch (_) { /* ignore */ }
            }
        } else if (mode === 'blank_blur') {
            panel.style.background = '';
            const srcVid = findRankingSourceVideo();
            if (vid && srcVid && (srcVid.currentSrc || srcVid.src)) {
                const src = srcVid.currentSrc || srcVid.src;
                if (vid.getAttribute('src') !== src && vid.src !== src) {
                    vid.src = src;
                    try { vid.load(); } catch (_) { /* ignore */ }
                }
                panel.classList.add('has-blur-src');
                const sync = () => {
                    try { vid.currentTime = srcVid.currentTime || 0; } catch (_) { /* ignore */ }
                    vid.muted = true;
                    vid.playsInline = true;
                    const p = vid.play();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                };
                if (!vid._rkBlurBound) {
                    vid._rkBlurBound = true;
                    srcVid.addEventListener('play', sync);
                    srcVid.addEventListener('seeked', sync);
                    srcVid.addEventListener('timeupdate', () => {
                        if (Math.abs((vid.currentTime || 0) - (srcVid.currentTime || 0)) > 0.45) {
                            try { vid.currentTime = srcVid.currentTime || 0; } catch (_) { /* ignore */ }
                        }
                    });
                    vid.addEventListener('loadeddata', sync);
                }
                if (vid.readyState >= 2) sync();
                else {
                    // Still show the band; frame arrives when decoded
                    vid.addEventListener('loadeddata', sync, { once: true });
                    sync();
                }
            } else if (vid) {
                // No duplicate video — backdrop-filter still blurs whatever sits under the overlay
                try { vid.pause(); vid.removeAttribute('src'); } catch (_) { /* ignore */ }
                panel.classList.remove('has-blur-src');
                panel.style.background = '';
            }
        } else if (vid) {
            try { vid.pause(); } catch (_) { /* ignore */ }
            panel.classList.remove('has-blur-src');
            panel.style.background = '';
        } else {
            panel.classList.remove('has-blur-src');
            panel.style.background = '';
        }
        wireStackDrag(root);
        applyStackOffset(layout);
    }

    function syncTopModeButtons() {
        const mode = (topHoverPreviewMode != null)
            ? topHoverPreviewMode
            : (getRankingLayout().top_panel || 'none');
        document.querySelectorAll('#rkTopModes .rk-top-mode').forEach((btn) => {
            btn.classList.toggle('on', (btn.dataset.top || 'none') === mode);
        });
        syncBlankBgVisibility();
        syncBlankColSwatches();
    }

    function previewTopMode(mode) {
        const next = mode === 'blank' || mode === 'blank_blur' ? mode : 'none';
        topHoverPreviewMode = next;
        applyRankingTopPanel({ ...getRankingLayout(), top_panel: next });
        syncTopModeButtons();
    }

    function resetTopModePreview() {
        if (topHoverPreviewMode == null) return;
        topHoverPreviewMode = null;
        applyRankingTopPanel(getRankingLayout());
        syncTopModeButtons();
    }

    function wireTopModes() {
        const row = document.getElementById('rkTopModes');
        if (!row || row._wired) return;
        row._wired = true;
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.rk-top-mode');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            topHoverPreviewMode = null;
            const nextMode = btn.dataset.top || 'none';
            const patch = { top_panel: nextMode };
            // Fresh blank/blur → start at ~25% top cover (user can drag to resize, max 45%)
            if (nextMode === 'blank' || nextMode === 'blank_blur') {
                const cur = getRankingLayout();
                const r = Number(cur.top_ratio);
                if (!Number.isFinite(r) || r < 0.20 || cur.top_panel === 'none') {
                    patch.top_ratio = TOP_PANEL_RATIO;
                }
            }
            setRankingLayout(patch);
            syncTopModeButtons();
            syncBlankBgVisibility();
        });
        // pointerover bubbles — pointerenter on the row alone misses button-targeted hovers
        row.addEventListener('pointerover', (e) => {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            const btn = e.target.closest?.('.rk-top-mode');
            if (!btn || !row.contains(btn)) return;
            previewTopMode(btn.dataset.top || 'none');
        });
        row.addEventListener('pointerout', (e) => {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            const to = e.relatedTarget;
            if (to && row.contains(to)) {
                const btn = to.closest?.('.rk-top-mode');
                if (btn) {
                    previewTopMode(btn.dataset.top || 'none');
                    return;
                }
            }
            resetTopModePreview();
        });
        syncTopModeButtons();
        // Paint any saved layout onto the phone as soon as the palette is used
        applyRankingTopPanel(getRankingLayout());
    }

    function markLibraryRankingDirty() {
        try {
            const studio = window.clipsStudio;
            // Only library ranking edits — never flip generate-flow "Use Template"
            if (!studio?.currentTemplateForPreview?.isLibraryPreview) return;
            if (!studio._libraryRankingEditable) return;
            if (studio._libraryDirtyArmed === false) return;
            studio._libraryRankingDirty = true;
            if (typeof window.syncLibraryConfirmLabel === 'function') {
                window.syncLibraryConfirmLabel();
            } else {
                const b = document.getElementById('confirmUseTemplateBtn');
                if (b) {
                    b.textContent = 'Apply & Download';
                    b.classList.add('library-download-mode');
                }
                if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
            }
        } catch (_) { /* ignore */ }
    }

    function ensureResizeHandle(el) {
        if (!el || Array.from(el.children).some((c) => c.classList.contains('sub-resize-handle'))) return;
        const h = document.createElement('div');
        h.className = 'sub-resize-handle';
        h.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const targets = resolveApplyTargets();
            if (!targets.length) return;
            sizeTouched = true;
            let resizing = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const pointerId = e.pointerId;
            const ref = (selectionMode === 'group-header')
                ? (getPrimaryHeaderEl() || targets[0])
                : ((selectionAnchor && document.contains(selectionAnchor))
                    ? selectionAnchor
                    : targets[0]);
            const startSize = curSize != null ? curSize : getEffectiveFontSize(ref);
            const isHeaderGroupResize = selectionMode === 'group-header';
            const isRankGroupResize = selectionMode === 'group-ranks';
            const isHeaderResize = isHeaderGroupResize
                || (selectionMode !== 'single' && targets.every((el) => isHeaderEl(el)));
            const hardCap = getHardSizeCap(
                (isRankGroupResize || targets.every((el) => isRankEl(el))) ? 'ranks' : 'header',
            );
            const dragCap = hardCap;
            let resizeMoved = false;

            const onMove = (ev) => {
                if (!resizing) return;
                if (ev.cancelable) ev.preventDefault();
                // BR corner: out = grow, in = shrink (same as caption handle)
                const d = ((ev.clientX - startX) + (ev.clientY - startY)) * 0.55;
                const minPx = (isRankGroupResize || targets.every((el) => isRankEl(el)))
                    ? RANK_SIZE_MIN_PX
                    : TITLE_SIZE_MIN_PX;
                const raw = Math.max(minPx, Math.min(dragCap, Math.round(startSize + d)));
                // Ignore tiny jitter so a click doesn't rewrite sizes
                if (Math.abs(raw - startSize) < 1 && Math.abs(d) < 2) return;
                resizeMoved = true;

                if (isHeaderGroupResize || isHeaderResize) {
                    // Whole title block together
                    curSize = applyHeaderBlockSize(raw, { resizing: true });
                    syncTopPanelToHeader({ liveOnly: true });
                } else if (isRankGroupResize) {
                    // Explicit full 1–5 group selection only
                    curSize = applyRankBlockSize(raw, { resizing: true });
                } else {
                    // Single / multi: only the selected element(s)
                    let applied = raw;
                    const root = getRankingRoot();
                    targets.forEach((target) => {
                        applied = setElementFontSize(target, raw);
                        // Keep that row's title matched — never other ranks
                        const id = target.getAttribute('data-template-element-id') || '';
                        const m = id.match(/^rank_(\d+)_number$/);
                        if (m && root) {
                            const title = root.querySelector(
                                `[data-template-element-id="rank_${m[1]}_title"]`,
                            );
                            if (title) setElementFontSize(title, raw);
                        }
                    });
                    curSize = applied;
                    if (targets.every((el) => isHeaderEl(el))) {
                        syncTopPanelToHeader({ liveOnly: true });
                    }
                }
                if (pill?.classList.contains('active')) schedulePosMenu();
            };
            const onUp = () => {
                resizing = false;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onUp);
                try { if (pointerId != null) h.releasePointerCapture?.(pointerId); } catch (_) {}
                // Soft fit only on real overflow (width/wrap) — never yank to tiny
                if (isHeaderGroupResize || isHeaderResize || targets.every((el) => isHeaderEl(el))) {
                    syncTopPanelToHeader();
                    const root = getRankingRoot();
                    if (root && !headerLineFits(root)) {
                        // Shrink from the size the user just chose — not a hard reset
                        const keep = Math.max(
                            TITLE_SIZE_MIN_PX,
                            curSize != null ? curSize : startSize,
                        );
                        applyHeaderBlockSize(keep, { resizing: false });
                    }
                }
                if (isRankGroupResize) {
                    const root = getRankingRoot();
                    if (root && !ranksListFits(root)) {
                        applyRankBlockSize(curSize != null ? curSize : startSize, { resizing: false });
                    }
                } else if (targets.some((el) => isRankEl(el))) {
                    // Solo rank resize: only shrink the edited targets if the list overflows
                    const root = getRankingRoot();
                    if (root && !ranksListFits(root) && curSize != null) {
                        let size = curSize;
                        let guard = 40;
                        while (guard-- > 0 && size > RANK_SIZE_MIN_PX && !ranksListFits(root)) {
                            size -= 1;
                            targets.forEach((target) => {
                                setElementFontSize(target, size);
                                const id = target.getAttribute('data-template-element-id') || '';
                                const m = id.match(/^rank_(\d+)_number$/);
                                if (m) {
                                    const title = root.querySelector(
                                        `[data-template-element-id="rank_${m[1]}_title"]`,
                                    );
                                    if (title) setElementFontSize(title, size);
                                }
                            });
                        }
                        curSize = size;
                    }
                }
                if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
                markLibraryRankingDirty();
                if (resizeMoved) markRankPointerClickSuppress();
                if (curSize != null && Math.abs(curSize - startSize) >= 1) {
                    scheduleResizeSuggest(targets, startSize, curSize);
                }
                if (activeEls.size) {
                    showMenu();
                    schedulePosMenu();
                }
            };
            try { if (pointerId != null) h.setPointerCapture(pointerId); } catch (_) {}
            document.addEventListener('pointermove', onMove, { passive: false });
            document.addEventListener('pointerup', onUp);
            document.addEventListener('pointercancel', onUp);
        });
        el.appendChild(h);
    }

    function syncResizeHandles() {
        // Clear handles from text els and zones
        getAllTextElements().forEach((el) => {
            Array.from(el.children)
                .filter((c) => c.classList.contains('sub-resize-handle'))
                .forEach((h) => h.remove());
        });
        [getHeaderZone(), getRanksZone()].forEach((zone) => {
            if (!zone) return;
            Array.from(zone.children)
                .filter((c) => c.classList.contains('sub-resize-handle'))
                .forEach((h) => h.remove());
            zone.classList.remove('ranking-editor-resize-anchor');
        });
        if (!activeEls.size) return;

        // Group mode → handle on the zone outline corner (not centered text)
        if (selectionMode === 'group-header' || selectionMode === 'group-ranks') {
            const zone = selectionMode === 'group-header' ? getHeaderZone() : getRanksZone();
            if (!zone) return;
            zone.classList.add('ranking-editor-resize-anchor');
            ensureResizeHandle(zone);
            return;
        }

        // Single / multi → handle on the selected item outline
        const host = (selectionAnchor && document.contains(selectionAnchor))
            ? selectionAnchor
            : activeEls.values().next().value;
        if (!host) return;
        host.classList.add('ranking-editor-selected');
        ensureResizeHandle(host);
        // Keep handle above stroke / siblings
        host.style.zIndex = '8';
    }

    function snapshotEl(el) {
        snapshots.set(el, {
            fontFamily: el.style.fontFamily,
            fontWeight: el.style.fontWeight,
            fontSize: el.style.fontSize,
            color: el.style.color,
            textShadow: el.style.textShadow,
            hadTextStroke: el.classList.contains('text-stroke'),
        });
    }

    function restoreSnapshot(el) {
        const snap = snapshots.get(el);
        if (!snap) return;
        el.style.fontFamily = snap.fontFamily;
        el.style.fontWeight = snap.fontWeight;
        el.style.fontSize = snap.fontSize;
        el.style.color = snap.color;
        el.style.textShadow = snap.textShadow;
        el.classList.toggle('text-stroke', snap.hadTextStroke);
    }

    function readStateFromEl(el) {
        const cs = getComputedStyle(el);
        const inlineFont = el.style.fontFamily;
        if (inlineFont) {
            curFont = inlineFont.replace(/['"]/g, '').split(',')[0].trim();
        } else if (cs.fontFamily) {
            curFont = cs.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
        }
        curTextCol = el.style.color || rgbToHex(cs.color) || '#ffffff';
        curFillCol = readFillFromEl(el);

        const inlineShadow = el.style.textShadow;
        if (inlineShadow && inlineShadow !== 'none') {
            if (inlineShadow.includes('3px 0') || inlineShadow.includes('3px 0px')) curShadow = 'thick-outline';
            else curShadow = 'outline';
        } else if (el.classList.contains('text-stroke')) {
            curShadow = 'outline';
        } else {
            curShadow = 'none';
        }

        const inlineFs = el.style.fontSize;
        const computedPx = getEffectiveFontSize(el);
        if (inlineFs && inlineFs !== 'inherit' && !inlineFs.includes('clamp')) {
            const parsed = Math.round(parseFloat(inlineFs));
            curSize = Number.isFinite(parsed) ? parsed : computedPx;
            sizeTouched = true;
        } else {
            curSize = computedPx;
            sizeTouched = false;
        }
    }

    function rgbToHex(rgb) {
        const m = rgb && rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return rgb;
        const h = (n) => parseInt(n, 10).toString(16).padStart(2, '0');
        return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
    }

    function previewPxFromBurn(burnPx) {
        const root = getRankingRoot();
        const phone = document.getElementById('templateVideoPreview');
        const w = phone?.clientWidth || root?.clientWidth || 280;
        return Math.max(14, Math.round(Number(burnPx || 0) * (w / RANKING_VIDEO_W)));
    }

    /**
     * Fresh ranking preview often sat on tiny rem clamps (~16–22px).
     * Seed WYSIWYG sizes from the template burn defaults when nothing is sized yet.
     */
    function seedDefaultPreviewSizes() {
        const root = getRankingRoot();
        if (!root) return false;
        injectStyles();
        // Re-seed when ranks are still on the old undersized defaults
        const sampleRank = root.querySelector('[data-template-element-id$="_number"].rk-sized')
            || root.querySelector('[data-template-element-id$="_title"].rk-sized');
        if (sampleRank) {
            const px = parseFloat(getComputedStyle(sampleRank).fontSize) || 0;
            // Old seed landed ~18–22px on a 280 phone — bump those up
            if (px >= 24) return false;
            root.querySelectorAll('.rk-sized').forEach((el) => el.classList.remove('rk-sized'));
        } else if (root.querySelector('.rk-sized')) {
            return false;
        }
        const titlePx = previewPxFromBurn(DEFAULT_TITLE_BURN_PX);
        const rankNumPx = previewPxFromBurn(DEFAULT_RANK_NUM_BURN_PX);
        const rankTitlePx = previewPxFromBurn(DEFAULT_RANK_TITLE_BURN_PX);
        applyHeaderBlockSize(titlePx);
        applyRankBlockSize(rankNumPx, { titlePx: rankTitlePx });
        const channel = root.querySelector('[data-template-element-id="title_channel"]');
        if (channel && !channel.classList.contains('rk-sized')) {
            const cPx = Math.min(
                CHANNEL_SIZE_MAX_PX,
                previewPxFromBurn(DEFAULT_CHANNEL_BURN_PX),
            );
            channel.style.setProperty('font-size', `${cPx}px`, 'important');
            channel.classList.add('rk-sized');
        }
        try { window.rankingCustomizer?.persistAllPreviewStyles?.(); } catch (_) { /* ignore */ }
        return true;
    }

    function getEffectiveFontSize(el) {
        return Math.round(parseFloat(getComputedStyle(el).fontSize) || 20);
    }

    function getHardSizeCap(elOrKind) {
        if (elOrKind && isChannelEl(elOrKind)) {
            return CHANNEL_SIZE_MAX_PX;
        }
        const kind = (elOrKind === 'ranks' || elOrKind === 'header')
            ? elOrKind
            : (isHeaderEl(elOrKind) ? 'header' : (isRankEl(elOrKind) ? 'ranks' : 'header'));
        if (kind === 'ranks') return RANK_SIZE_MAX_PX;
        return TITLE_SIZE_MAX_PX;
    }

    /** Probe how wide CHANNEL MOMENTS would be at a given font size */
    function measureChannelWidthAt(el, px) {
        if (!el) return 0;
        const probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        const cs = getComputedStyle(el);
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;';
        probe.style.fontFamily = el.style.fontFamily || cs.fontFamily;
        probe.style.fontWeight = el.style.fontWeight || cs.fontWeight || '400';
        probe.style.fontSize = `${px}px`;
        probe.style.letterSpacing = el.style.letterSpacing || cs.letterSpacing || 'normal';
        probe.textContent = (el.textContent || 'CHANNEL MOMENTS').replace(/\s+/g, ' ').trim() || 'CHANNEL MOMENTS';
        document.body.appendChild(probe);
        const w = probe.offsetWidth || 0;
        probe.remove();
        return w;
    }

    function channelFitsAtSize(el, px, root) {
        root = root || getRankingRoot();
        if (!el || !root) return true;
        const frame = root.getBoundingClientRect();
        const maxW = Math.max(40, frame.width - 36);
        if (measureChannelWidthAt(el, px) > maxW) return false;
        // Don't grow into the 1–5 list (estimate height from font size)
        const list = root.querySelector('.ranking-list');
        if (list) {
            const er = el.getBoundingClientRect();
            const lr = list.getBoundingClientRect();
            const curFs = Math.max(1, getEffectiveFontSize(el));
            const nextH = Math.max(8, er.height * (px / curFs));
            if (er.top + nextH > lr.top - 6) return false;
        }
        return true;
    }

    /** Glyph/content bounds — ignores full-width layout boxes that always fill the frame */
    function getContentRect(el) {
        if (!el) return null;
        const marked = Array.from(el.querySelectorAll('[data-template-element-id]'))
            .filter((c) => !c.classList.contains('sub-resize-handle'));
        if (marked.length) {
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            marked.forEach((child) => {
                const r = child.getBoundingClientRect();
                left = Math.min(left, r.left);
                right = Math.max(right, r.right);
                top = Math.min(top, r.top);
                bottom = Math.max(bottom, r.bottom);
            });
            if (!Number.isFinite(left)) return null;
            return { left, right, top, bottom, width: right - left, height: bottom - top };
        }
        // Leaf text node — measure glyphs, not a width:100% box
        try {
            const range = document.createRange();
            range.selectNodeContents(el);
            const r = range.getBoundingClientRect();
            if (r.width > 0 || r.height > 0) {
                return {
                    left: r.left,
                    right: r.right,
                    top: r.top,
                    bottom: r.bottom,
                    width: r.width,
                    height: r.height,
                };
            }
        } catch (_) { /* empty */ }
        const r = el.getBoundingClientRect();
        return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: Math.min(r.width, el.scrollWidth || r.width),
            height: r.height,
        };
    }

    function contentFitsFrame(el, root) {
        if (!el || !root) return true;
        // Prefer the phone frame so titles can't spill past .preview-placeholder
        const phone = document.getElementById('templateVideoPreview');
        const frameEl = (phone && phone.contains(root)) ? phone : root;
        const frame = frameEl.getBoundingClientRect();
        const isChannel = isChannelEl(el);
        const isTitle = isHeaderEl(el);
        // Titles live at the top of the phone — never treat "near top" as overflow
        // (that was crushing resize down to ~10px after every drag)
        const insetX = isChannel ? 12 : 10;
        const insetY = isTitle ? 2 : 8;
        const bleed = isChannel ? 6 : 4;
        const c = getContentRect(el);
        if (!c || c.width <= 0) return true;

        const maxW = frame.width - insetX * 2;
        if (c.width + bleed * 2 > maxW + 1) return false;
        if (c.left - bleed < frame.left + insetX - 1) return false;
        if (c.right + bleed > frame.right - insetX + 1) return false;
        if (c.bottom + bleed > frame.bottom - insetY + 1) return false;
        // Only rank rows care about top edge; header titles are allowed at the top pad
        if (!isTitle && c.top - bleed < frame.top + insetY - 1) return false;
        return true;
    }

    function headerLineFits(root) {
        if (!root) return true;
        const h1 = root.querySelector('h1.title, h1');
        const channel = root.querySelector('[data-template-element-id="title_channel"]');
        if (h1 && !contentFitsFrame(h1, root)) return false;
        if (channel && !contentFitsFrame(channel, root)) return false;
        // Reject wrapped "CHANNEL" / "MOMENTS" or split "RANKING BEST"
        const singleLine = (el) => {
            if (!el) return true;
            const cs = getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight);
            const fs = parseFloat(cs.fontSize) || 16;
            const line = Number.isFinite(lh) && lh > 0 ? lh : fs * 1.2;
            return el.scrollHeight <= line * 1.65 + 2;
        };
        if (!singleLine(h1)) return false;
        if (!singleLine(channel)) return false;
        return true;
    }

    function ranksListFits(root) {
        const list = root.querySelector('.ranking-list');
        if (!list) return true;
        const frame = root.getBoundingClientRect();
        const last = list.querySelector('.ranked-item:last-child') || list;
        const bottom = last.getBoundingClientRect().bottom;
        // Soft edge — selection rings / stroke bleed shouldn't trigger a shrink storm
        return bottom <= frame.bottom - 4;
    }

    function setElementFontSize(el, px) {
        const scaled = resolveFontSizeForEl(el, px, {
            headerGroup: selectionMode === 'group-header',
        });
        const clamped = clampFontSizeToBounds(el, scaled);
        el.style.setProperty('font-size', `${clamped}px`, 'important');
        el.classList.add('rk-sized');
        const eid = el.getAttribute('data-template-element-id');
        if (eid && window.rankingCustomizer?.setElementFontSizeScaled) {
            window.rankingCustomizer.setElementFontSizeScaled(eid, clamped);
        }
        // Size-only — do NOT persistElementStyles here (CSS default Luckiest Guy
        // would overwrite Fredoka/etc. via getComputedStyle during resize).
        return clamped;
    }

    /** Title block: RANKING + BEST + channel scale together, then shrink ranks if needed */
    function applyHeaderBlockSize(desiredBasePx, opts) {
        opts = opts || {};
        const root = getRankingRoot();
        const headers = getHeaderElements();
        const hardCap = getHardSizeCap('header');
        let base = Math.max(TITLE_SIZE_MIN_PX, Math.min(hardCap, Math.round(desiredBasePx)));
        if (!root || !headers.length) return base;

        const applyHeaders = (b) => {
            headers.forEach((el) => {
                const px = resolveFontSizeForEl(el, b, { headerGroup: true });
                el.style.setProperty('font-size', `${px}px`, 'important');
                el.classList.add('rk-sized');
            });
            // Drive the h1 clamp so the title row shares one size
            const h1 = root.querySelector('h1.title, h1');
            if (h1) {
                h1.style.setProperty('font-size', `${b}px`, 'important');
                h1.classList.add('rk-sized');
            }
        };

        applyHeaders(base);
        // Mid-drag: follow the pointer, but never grow past the phone frame
        if (opts.resizing) {
            let guard = 40;
            while (guard-- > 0 && base > TITLE_SIZE_MIN_PX && !headerLineFits(root)) {
                base -= 1;
                applyHeaders(base);
            }
            return base;
        }
        {
            let guard = 50;
            while (guard-- > 0 && base > TITLE_SIZE_MIN_PX && !headerLineFits(root)) {
                base -= 1;
                applyHeaders(base);
            }
            // Extra pass: font-aware CHANNEL MOMENTS width (don't crush header just for channel)
            const channel = root.querySelector('[data-template-element-id="title_channel"]');
            if (channel) {
                let cGuard = 36;
                let cPx = getEffectiveFontSize(channel);
                while (cGuard-- > 0 && cPx > 12 && !channelFitsAtSize(channel, cPx, root)) {
                    cPx -= 1;
                    channel.style.setProperty('font-size', `${cPx}px`, 'important');
                    channel.classList.add('rk-sized');
                }
            }
            if (!opts.skipStackFit) ensureRankingStackFits();
            // Commit final sizes so generate doesn't only see CSS clamps
            if (!opts.skipPersist) {
                headers.forEach((el) => {
                    try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
                });
                if (channel) {
                    try { window.rankingCustomizer?.persistElementStyles?.(channel); } catch (_) { /* ignore */ }
                }
            }
        }
        return base;
    }

    /** Numbers: one shared size, hard-capped, list must stay in the phone */
    function applyRankBlockSize(desiredBasePx, opts) {
        opts = opts || {};
        const root = getRankingRoot();
        const ranks = getAllRankNumbers();
        const titles = getAllRankTitles();
        const hardCap = getHardSizeCap('ranks');
        let base = Math.max(RANK_SIZE_MIN_PX, Math.min(hardCap, Math.round(desiredBasePx)));
        let titleBase = opts.titlePx != null
            ? Math.max(RANK_SIZE_MIN_PX, Math.min(hardCap, Math.round(opts.titlePx)))
            : Math.max(RANK_SIZE_MIN_PX, Math.round(base * 0.88));
        if (!root || !ranks.length) return base;

        const applyRanks = (numPx, titlePx) => {
            ranks.forEach((el) => {
                el.style.setProperty('font-size', `${numPx}px`, 'important');
                el.classList.add('rk-sized');
            });
            // Titles track numbers but stay slightly smaller (template: 100 vs 70)
            (titles.length ? titles : root.querySelectorAll('[data-template-element-id$="_title"]'))
                .forEach((el) => {
                    el.style.setProperty('font-size', `${titlePx}px`, 'important');
                    el.classList.add('rk-sized');
                });
        };

        applyRanks(base, titleBase);
        // Mid-drag: follow pointer but keep the 1–5 list inside the phone
        if (opts.resizing) {
            let guard = 40;
            while (guard-- > 0 && base > RANK_SIZE_MIN_PX && !ranksListFits(root)) {
                base -= 1;
                titleBase = Math.max(RANK_SIZE_MIN_PX, Math.round(base * 0.88));
                applyRanks(base, titleBase);
            }
            return base;
        }
        {
            let guard = 50;
            while (guard-- > 0 && base > RANK_SIZE_MIN_PX && !ranksListFits(root)) {
                base -= 1;
                titleBase = Math.max(RANK_SIZE_MIN_PX, Math.round(base * 0.88));
                applyRanks(base, titleBase);
            }
            if (!opts.skipStackFit) ensureRankingStackFits();
            if (!opts.skipPersist) {
                ranks.forEach((el) => {
                    try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
                });
                titles.forEach((el) => {
                    try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
                });
            }
        }
        return base;
    }

    /** After any resize, shrink overflowing ranks (then title) so the stack stays in frame */
    function ensureRankingStackFits() {
        const root = getRankingRoot();
        if (!root) return;
        let guard = 40;
        while (guard-- > 0 && !ranksListFits(root)) {
            const ranks = getAllRankNumbers();
            if (!ranks.length) break;
            const cur = getEffectiveFontSize(ranks[0]);
            if (cur <= RANK_SIZE_MIN_PX) break;
            applyRankBlockSize(cur - 1, { skipStackFit: true });
        }
        guard = 30;
        while (guard-- > 0 && (!headerLineFits(root) || !ranksListFits(root))) {
            const headers = getHeaderElements();
            const primary = getPrimaryHeaderEl() || headers[0];
            if (!primary) break;
            const cur = getEffectiveFontSize(primary);
            if (cur <= TITLE_SIZE_MIN_PX) break;
            applyHeaderBlockSize(cur - 1, { skipStackFit: true });
        }
    }

    /**
     * Apply a shared base size to many els, then shrink only while content
     * actually overflows the frame (not full-width layout boxes).
     */
    function applyBoundedGroupSize(targets, desiredBasePx) {
        if (targets.every((el) => isHeaderEl(el))) return applyHeaderBlockSize(desiredBasePx);
        if (targets.every((el) => isRankEl(el))) return applyRankBlockSize(desiredBasePx);
        const root = getRankingRoot();
        const hardCap = getHardSizeCap(targets[0]);
        let base = Math.max(10, Math.min(hardCap, Math.round(desiredBasePx)));
        if (!root || !targets.length) return base;

        const apply = (b) => {
            targets.forEach((el) => {
                const px = resolveFontSizeForEl(el, b, {
                    headerGroup: targets.every((t) => isHeaderEl(t)),
                });
                el.style.setProperty('font-size', `${px}px`, 'important');
                el.classList.add('rk-sized');
            });
        };

        apply(base);

        const groupOk = () => {
            for (const el of targets) {
                if (!contentFitsFrame(el, root)) return false;
            }
            if (targets.some((el) => isHeaderEl(el)) && !headerLineFits(root)) return false;
            if (targets.some((el) => isRankEl(el)) && !ranksListFits(root)) return false;
            return true;
        };

        let guard = 60;
        while (guard-- > 0 && base > 10 && !groupOk()) {
            base -= 1;
            apply(base);
        }
        ensureRankingStackFits();
        return base;
    }

    function clampFontSizeToBounds(el, desiredPx) {
        const root = getRankingRoot();
        const hardCap = getHardSizeCap(el);
        const minSize = isChannelEl(el) ? 12 : (isHeaderEl(el) ? TITLE_SIZE_MIN_PX : RANK_SIZE_MIN_PX);
        let size = Math.max(minSize, Math.min(hardCap, Math.round(desiredPx)));
        if (!root || !el) return size;

        el.style.setProperty('font-size', `${size}px`, 'important');
        el.classList.add('rk-sized');

        let guard = 60;
        while (guard-- > 0 && size > minSize) {
            let ok = contentFitsFrame(el, root);
            if (ok && isChannelEl(el) && !channelFitsAtSize(el, size, root)) ok = false;
            if (ok && isHeaderEl(el) && !isChannelEl(el) && !headerLineFits(root)) ok = false;
            // Solo number: don't shrink because the full list is tall — only if THIS glyph spills
            if (ok && isRankEl(el) && selectionMode !== 'group-ranks' && activeEls.size <= 1) {
                // keep ok from contentFitsFrame only
            } else if (ok && isRankEl(el) && !ranksListFits(root)) {
                ok = false;
            }
            if (ok) break;
            size -= 1;
            el.style.setProperty('font-size', `${size}px`, 'important');
        }
        return size;
    }

    function paintFontDom(el, fontName) {
        if (!el) return;
        const stack = FONT_STACK[fontName] || `'${fontName}', sans-serif`;
        el.style.setProperty('font-family', stack, 'important');
        el.style.setProperty('font-weight', FW[fontName] || '400', 'important');
        el.setAttribute('data-rk-font', fontName);
    }

    function setElementFont(el, fontName) {
        paintFontDom(el, fontName);
        const eid = el.getAttribute('data-template-element-id');
        if (eid && window.rankingCustomizer?.setElementFontFile) {
            window.rankingCustomizer.setElementFontFile(eid, fontName);
        } else if (eid && window.rankingCustomizer) {
            if (!window.rankingCustomizer.customizations) {
                window.rankingCustomizer.customizations = {};
            }
            if (!window.rankingCustomizer.customizations[eid]) {
                window.rankingCustomizer.customizations[eid] = {};
            }
            const fileMap = {
                'Luckiest Guy': 'LuckiestGuy-Regular.ttf',
                'Bebas Neue': 'BebasNeue-Regular.ttf',
                Anton: 'Anton-Regular.ttf',
                Montserrat: 'Montserrat-Bold.ttf',
                Poppins: 'Poppins-SemiBold.ttf',
                Roboto: 'Roboto-Bold.ttf',
                Fredoka: 'Fredoka-Bold.ttf',
            };
            window.rankingCustomizer.customizations[eid].font =
                fileMap[fontName] || fontName;
        }
        try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
    }

    /** Apply a new font but keep the same px size, then clamp so wide fonts stay in frame */
    function applyFontChange(fontName, targets) {
        if (!targets.length) return;

        const allHeaders = targets.every((el) => isHeaderEl(el));
        const allRanks = targets.every((el) => isRankEl(el) || isRankTitleEl(el));
        const isGroup = targets.length > 1 && (allHeaders || allRanks);

        if (isGroup) {
            const ref = allHeaders
                ? (getPrimaryHeaderEl() || targets.find((el) => !isChannelEl(el)) || targets[0])
                : targets[0];
            const baseSize = (sizeTouched && curSize != null)
                ? curSize
                : getEffectiveFontSize(ref);

            targets.forEach((el) => setElementFont(el, fontName));
            curSize = applyBoundedGroupSize(targets, baseSize);
            sizeTouched = true;
            return;
        }

        targets.forEach((el) => {
            const baseSize = getEffectiveFontSize(el);
            setElementFont(el, fontName);
            setElementFontSize(el, baseSize);
        });
        const first = targets[0];
        if (first) {
            curSize = getEffectiveFontSize(first);
            sizeTouched = true;
        }
    }

    function setElementShadow(el, type) {
        if (type === 'none') {
            el.classList.remove('text-stroke');
            el.style.setProperty('text-shadow', 'none', 'important');
        } else {
            const key = type === 'stroke' ? 'outline' : type;
            el.classList.add('text-stroke');
            el.style.setProperty('text-shadow', shadowCss(key, curOutlineCol), 'important');
        }
        const eid = el.getAttribute('data-template-element-id');
        if (eid && window.rankingCustomizer?.setElementStrokeStyle) {
            const style = type === 'stroke' ? 'outline' : (type || 'outline');
            window.rankingCustomizer.setElementStrokeStyle(eid, style);
            // Override hardcoded black with the chosen outline color
            try {
                const node = window.rankingCustomizer.customizations?.[eid];
                const rgba = window.rankingCustomizer._colorToRgba?.(curOutlineCol);
                if (node && rgba && style !== 'none') node.outline_color = rgba;
            } catch (_) { /* ignore */ }
        }
        try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
    }

    function applyAllStyles(persist) {
        const targets = resolveApplyTargets();
        targets.forEach((el) => {
            if (fontTouched) setElementFont(el, curFont);
            if (sizeTouched && curSize) setElementFontSize(el, curSize);
            if (colorTouched) el.style.color = curTextCol;
            if (shadowTouched) setElementShadow(el, curShadow);
        });
        syncColorSwatches();
        if (persist !== false && window.rankingCustomizer) {
            window.rankingCustomizer.syncFromDOM();
        }
    }

    function applyTextColor(c, persist) {
        // Selection preview already wrapped a span — keep it and skip restore
        if (colorPreviewActive && colorPreviewSelSpan?.isConnected) {
            colorPreviewSelSpan.style.color = normalizeHex(c) || c;
            discardColorPreview();
            colorTarget = 'text';
            curTextCol = c;
            if (persist !== false) colorTouched = true;
            syncColorSwatches();
            if (persist !== false) markLibraryRankingDirty();
            return;
        }
        if (colorPreviewActive) discardColorPreview();
        colorTarget = 'text';
        curTextCol = c;
        if (persist !== false) colorTouched = true;

        const selInfo = getInlineEditSelection();
        if (selInfo) {
            colorSelectionRange(selInfo.range, c);
            syncColorSwatches();
            if (persist !== false) markLibraryRankingDirty();
            return;
        }

        resolveApplyTargets().forEach((el) => {
            el.style.color = c;
            const eid = el.getAttribute('data-template-element-id');
            if (persist !== false && eid && window.rankingCustomizer?.setElementColor) {
                window.rankingCustomizer.setElementColor(eid, c);
            }
            if (persist !== false) {
                try { window.rankingCustomizer?.persistElementStyles?.(el); } catch (_) { /* ignore */ }
            }
        });
        syncColorSwatches();
        if (persist !== false && window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        if (persist !== false) markLibraryRankingDirty();
        if (persist !== false) maybeOfferStyleSuggest(resolveApplyTargets(), { color: c });
    }

    function beginFontPreviewSession(targets) {
        if (!fontPreviewActive) {
            fontPreviewTargets = targets;
            targets.forEach((el) => snapshotEl(el));
            fontPreviewActive = true;
        }
    }

    function previewFont(f) {
        if (applyingFont || !activeEls.size) return;
        const targets = resolveApplyTargets();
        beginFontPreviewSession(targets);
        // Preview only — never persist into rankingCustomizations on hover
        targets.forEach((el) => paintFontDom(el, f));
    }

    function resetFontPreview() {
        if (applyingFont || !fontPreviewActive) return;
        fontPreviewActive = false;
        fontPreviewTargets.forEach((el) => restoreSnapshot(el));
        fontPreviewTargets = [];
    }

    function applyFont(f) {
        curFont = f;
        fontTouched = true;

        const targets = resolveApplyTargets();
        // Commit hover preview — don't restore the pre-hover snapshot
        fontPreviewActive = false;
        fontPreviewTargets = [];
        applyFontChange(f, targets);
        targets.forEach((el) => snapshotEl(el));
        syncFontDdHighlight(f);

        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        markLibraryRankingDirty();
        closeDD();
        showMenu();
        // Defer chip past dropdown close / mouseleave so it isn't cleared in the same tick
        const suggestTargets = targets.slice();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                maybeOfferStyleSuggest(suggestTargets, { font: f });
            });
        });
        if (targets.some(isHeaderEl)) syncTopPanelToHeader();
    }

    function applyShadow(type) {
        curShadow = type || 'outline';
        shadowTouched = true;
        const targets = resolveApplyTargets();
        targets.forEach((el) => {
            setElementShadow(el, curShadow);
            snapshotEl(el);
        });
        syncShadowSeg();
        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        maybeOfferStyleSuggest(targets, { shadow: curShadow });
        markLibraryRankingDirty();
    }

    /* ── Style suggest: red = live old · green ghost = new sample ── */
    function clearSuggest(opts) {
        ghostNodes.forEach((n) => n.remove());
        ghostNodes = [];
        pendingSuggest = null;
        if (sizeSuggestTimer) {
            clearTimeout(sizeSuggestTimer);
            sizeSuggestTimer = 0;
        }
        sizeSuggestToken += 1;
        if (suggestActions) {
            suggestActions.classList.remove('open');
            suggestActions.style.visibility = '';
            suggestActions.style.opacity = '';
            suggestActions.style.pointerEvents = '';
        }
        document.querySelectorAll('.rk-suggest-receive,.rk-suggest-remove').forEach((el) => {
            el.classList.remove('rk-suggest-receive', 'rk-suggest-remove');
        });
        // Stray ghosts / actions can survive outside the preview tree
        document.querySelectorAll('.rk-ghost-stack').forEach((n) => n.remove());
        if (opts?.persistReject) {
            // Brief quiet for font/color chips only — do NOT mute Solis Memory
            // ("Apply last ranking style?") via markSuggestionRejected.
            startSuggestCooldown(Math.max(SUGGEST_COOLDOWN_MS, 12000));
        }
    }

    /** Prefer each target’s real fill/stroke so the ghost matches the original look */
    function sampleStyleFromLive(liveEl, props) {
        const cs = liveEl ? getComputedStyle(liveEl) : null;
        const liveColor = liveEl
            ? (normalizeColorValue(liveEl.style.color) || normalizeColorValue(cs?.color) || '#ffffff')
            : '#ffffff';
        const liveShadow = liveEl
            ? (liveEl.style.textShadow && liveEl.style.textShadow !== 'none'
                ? liveEl.style.textShadow
                : getShadowCssForType(getElShadowType(liveEl)))
            : getShadowCssForType('stroke');
        return {
            // Only override color when the suggestion itself is a color change
            color: props.color || liveColor || '#ffffff',
            textShadow: props.shadow
                ? getShadowCssForType(props.shadow)
                : (liveShadow === 'none'
                    ? '-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000'
                    : liveShadow),
        };
    }

    function startSuggestCooldown(ms = SUGGEST_COOLDOWN_MS) {
        suggestCooldownUntil = Date.now() + ms;
    }

    function canOfferSuggest() {
        if (Date.now() < suggestCooldownUntil) return false;
        // Live font/color/size chips are edit UX — never gate them on Solis Memory toggles.
        // (Memory only controls "Apply last ranking style?" on preview open.)
        return true;
    }

    function fontsDiffer(liveName, wantName) {
        if (!wantName) return false;
        if (!liveName) return true;
        const strip = (s) => String(s || '')
            .replace(/['"]/g, '')
            .split(',')[0]
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/(regular|bold|semibold|medium|light|black|ttf|otf|woff2?)$/g, '');
        const a = strip(liveName);
        const b = strip(wantName);
        if (!a || !b) return a !== b;
        if (a === b) return false;
        if (a.includes(b) || b.includes(a)) return false;
        return true;
    }

    function getShadowCssForType(type) {
        if (type === 'none') return 'none';
        return shadowCss(type === 'stroke' ? 'outline' : type, curOutlineCol);
    }

    function getElShadowType(el) {
        const inline = el.style.textShadow;
        if (inline && inline !== 'none') {
            if (inline.includes('3px 0') || inline.includes('3px 0px')) return 'thick-outline';
            return 'outline';
        }
        if (el.classList.contains('text-stroke') || el.closest('.text-stroke')) return 'outline';
        return 'none';
    }

    function normalizeColorValue(value) {
        if (!value) return '';
        const hex = rgbToHex(value);
        return String(hex || value).trim().toLowerCase();
    }

    function getElColor(el) {
        return normalizeColorValue(el.style.color || getComputedStyle(el).color);
    }

    /** Prefer each target’s live copy so the ghost shows real text, not “Aa” */
    function isPlaceholderLabel(raw) {
        const t = String(raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return !t || t === 'text' || t === 'aa' || t === '#' || t === '…' || t === '...';
    }

    function sampleLabelForEl(el) {
        const raw = String(el?.textContent || '').replace(/\s+/g, ' ').trim();
        if (raw && !isPlaceholderLabel(raw)) {
            return raw.length > 36 ? `${raw.slice(0, 35)}…` : raw;
        }
        if (isRankEl(el)) {
            const m = String(el?.getAttribute?.('data-template-element-id') || '')
                .match(/^rank_(\d+)_number$/);
            return m ? `${m[1]}.` : '#';
        }
        // Empty rank titles — never invent "Text" in the green ghost
        if (isRankTitleEl(el)) return '';
        return raw && !isPlaceholderLabel(raw) ? raw : '';
    }

    /** Ghost face for rank-side: numbers only (empty titles used to spam "TEXT"). */
    function ghostSourcesForRankSide(live) {
        const numbers = live.filter(isRankEl);
        if (numbers.length) return numbers;
        // Title-only edit: show real titles, skip empty placeholders
        return live.filter((el) => {
            if (!isRankTitleEl(el)) return true;
            return !isPlaceholderLabel(el?.textContent);
        });
    }

    function counterpartFor(editedTargets) {
        if (!editedTargets.length) return null;
        if (editedTargets.every((el) => isHeaderEl(el))) {
            return getAllRankSideElements();
        }
        if (editedTargets.every((el) => isRankSideEl(el))) {
            return getHeaderElements();
        }
        if (editedTargets.some(isRankSideEl) && !editedTargets.some(isHeaderEl)) {
            return getHeaderElements();
        }
        if (editedTargets.some(isHeaderEl) && !editedTargets.some(isRankSideEl)) {
            return getAllRankSideElements();
        }
        return null;
    }

    /** Sibling ranks/titles first; header ↔ numbers as counterpart. */
    function resizeSuggestTargets(editedTargets, phase) {
        const edited = new Set(editedTargets.filter(Boolean));
        if (!edited.size) return [];
        const out = [];
        const pushIfNeeded = (el) => {
            if (!el?.isConnected || edited.has(el)) return;
            if (!out.includes(el)) out.push(el);
        };

        const allRanks = getAllRankNumbers();
        const allRankTitles = getAllRankTitles();
        const allHeaders = getHeaderElements();
        const touchedRankNum = [...edited].some(isRankEl);
        const touchedRankTitle = [...edited].some(isRankTitleEl);
        const touchedHeader = [...edited].some(isHeaderEl);

        if (phase === 'counterpart') {
            // Header ↔ full rank stack (numbers + titles)
            if ((touchedRankNum || touchedRankTitle) && !touchedHeader) return getHeaderElements();
            if (touchedHeader && !touchedRankNum && !touchedRankTitle) {
                return getAllRankSideElements();
            }
            return [];
        }

        if (touchedRankNum) allRanks.forEach(pushIfNeeded);
        if (touchedRankTitle) allRankTitles.forEach(pushIfNeeded);
        if (touchedHeader) allHeaders.forEach(pushIfNeeded);
        return out;
    }

    function editedSizeGroup(editedTargets) {
        if (editedTargets.every((el) => isRankEl(el))) return 'ranks';
        if (editedTargets.every((el) => isRankTitleEl(el))) return 'rankTitles';
        if (editedTargets.every((el) => isHeaderEl(el))) return 'header';
        if (editedTargets.some(isRankSideEl)) return 'ranks';
        return 'header';
    }

    /** Map the resized size onto another element so the stack feels balanced */
    function comfortableSizeForTarget(el, baseSize, fromGroup) {
        const kind = isRankEl(el) ? 'ranks' : 'header';
        const cap = getHardSizeCap(el || kind);
        const clamp = (n) => Math.max(
            isChannelEl(el) ? 12 : (kind === 'ranks' ? RANK_SIZE_MIN_PX : TITLE_SIZE_MIN_PX),
            Math.min(cap, Math.round(n)),
        );
        if (!el) return clamp(baseSize);
        if (fromGroup === 'header') {
            if (isRankEl(el)) return clamp(baseSize * 0.92);
            if (isChannelEl(el)) {
                let px = clamp(baseSize * CHANNEL_SIZE_RATIO);
                const root = getRankingRoot();
                let guard = 24;
                while (guard-- > 0 && px > 12 && !channelFitsAtSize(el, px, root)) px -= 1;
                return px;
            }
            return clamp(baseSize);
        }
        // from ranks
        if (isRankEl(el)) return clamp(baseSize);
        if (isChannelEl(el)) {
            let px = clamp(baseSize * CHANNEL_SIZE_RATIO);
            const root = getRankingRoot();
            let guard = 24;
            while (guard-- > 0 && px > 12 && !channelFitsAtSize(el, px, root)) px -= 1;
            return px;
        }
        if (isHeaderEl(el)) return clamp(baseSize);
        return clamp(baseSize);
    }

    function sizeNeedsApply(targets, baseSize, fromGroup) {
        return targets.some((el) => {
            if (!el?.isConnected) return false;
            const want = comfortableSizeForTarget(el, baseSize, fromGroup);
            return Math.abs(getEffectiveFontSize(el) - want) > 1.5;
        });
    }

    function propsNeedApply(targets, props) {
        return targets.some((el) => {
            if (!el?.isConnected) return false;
            if (props.font && fontsDiffer(getElFontName(el), props.font)) return true;
            if (props.color && getElColor(el) !== normalizeColorValue(props.color)) return true;
            if (props.size != null) {
                const fromGroup = props.fromGroup || 'header';
                const want = props.comfortable
                    ? comfortableSizeForTarget(el, props.size, fromGroup)
                    : props.size;
                if (Math.abs(getEffectiveFontSize(el) - want) > 1.5) return true;
            }
            if (props.shadow && getElShadowType(el) !== props.shadow) return true;
            return false;
        });
    }

    /** After resize settles, offer a balanced size for siblings + the other group */
    function scheduleResizeSuggest(editedTargets, startSize, endSize) {
        if (!editedTargets?.length || endSize == null) return;
        if (Math.abs(endSize - startSize) < 1) return;
        if (!canOfferSuggest()) return;

        if (sizeSuggestTimer) clearTimeout(sizeSuggestTimer);
        const token = ++sizeSuggestToken;
        const snapshot = editedTargets.filter((el) => el?.isConnected);
        const size = endSize;

        sizeSuggestTimer = setTimeout(() => {
            sizeSuggestTimer = 0;
            if (token !== sizeSuggestToken) return;
            if (!canOfferSuggest()) return;
            const liveEdited = snapshot.filter((el) => el?.isConnected);
            if (!liveEdited.length) return;

            const siblings = resizeSuggestTargets(liveEdited, 'siblings');
            const fromGroup = editedSizeGroup(liveEdited);
            if (siblings.length && sizeNeedsApply(siblings, size, fromGroup)) {
                const chainTargets = resizeSuggestTargets(liveEdited, 'counterpart');
                const chain = (chainTargets.length && sizeNeedsApply(chainTargets, size, fromGroup))
                    ? { size, comfortable: true, fromGroup, targets: chainTargets }
                    : null;
                offerStyleSuggest(
                    { size, comfortable: true, fromGroup, chain },
                    siblings,
                );
                return;
            }

            const counterparts = resizeSuggestTargets(liveEdited, 'counterpart');
            if (!counterparts.length) return;
            if (!sizeNeedsApply(counterparts, size, fromGroup)) return;

            offerStyleSuggest(
                { size, comfortable: true, fromGroup },
                counterparts,
            );
        }, SIZE_SUGGEST_DELAY_MS);
    }

    function layoutGhosts() {
        if (!pendingSuggest) return;
        const { props, targets } = pendingSuggest;
        ghostNodes.forEach((n) => n.remove());
        ghostNodes = [];

        const live = targets.filter((el) => el.isConnected);
        if (!live.length) return;

        document.querySelectorAll('.rk-suggest-receive,.rk-suggest-remove').forEach((el) => {
            el.classList.remove('rk-suggest-receive', 'rk-suggest-remove');
        });

        // Live old text → RED (will change). Ghost stack stays GREEN (proposed).
        const allRankSide = live.every((el) => isRankSideEl(el));
        const allHeaders = live.every((el) => isHeaderEl(el));
        const mixed = live.some(isRankSideEl) && live.some(isHeaderEl);
        if (mixed) {
            getRanksZone()?.classList.add('rk-suggest-remove');
            getHeaderZone()?.classList.add('rk-suggest-remove');
        } else if (allRankSide) {
            getRanksZone()?.classList.add('rk-suggest-remove');
        } else if (allHeaders) {
            getHeaderZone()?.classList.add('rk-suggest-remove');
        } else {
            live.forEach((el) => el.classList.add('rk-suggest-remove'));
        }

        const rects = live.map((el) => el.getBoundingClientRect());
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        const leftEdge = Math.min(...rects.map((r) => r.left));
        const zoneMidY = (top + bottom) / 2;
        const gap = 12;

        const stackEl = document.createElement('div');
        stackEl.className = 'rk-ghost-stack';
        stackEl.setAttribute('aria-hidden', 'true');
        stackEl.style.top = '-9999px';
        stackEl.style.left = '-9999px';

        const fontName = props.font || getElFontName(live[0]) || curFont || 'Montserrat';
        const fromGroup = props.fromGroup || editedSizeGroup(live);

        function styleGhostLine(line, source) {
            const look = sampleStyleFromLive(source, props);
            const lineFont = props.font || getElFontName(source) || fontName;
            line.style.fontFamily = FONT_STACK[lineFont] || `'${lineFont}', sans-serif`;
            line.style.fontWeight = FW[lineFont] || FW[fontName] || '700';
            const lineSize = props.size != null
                ? (props.comfortable
                    ? comfortableSizeForTarget(source, props.size, fromGroup)
                    : props.size)
                : Math.round(parseFloat(getComputedStyle(source).fontSize) || 22);
            line.style.fontSize = `${Math.max(11, Math.min(lineSize, TITLE_SIZE_MAX_PX))}px`;
            line.style.color = look.color;
            line.style.background = 'transparent';
            line.style.textShadow = look.textShadow;
        }

        // Header ghosts: mirror phone layout — "RANKING BEST" on one row, channel under
        if (allHeaders) {
            const ranking = live.find((el) => el.getAttribute('data-template-element-id') === 'title_ranking');
            const accent = live.find((el) => el.getAttribute('data-template-element-id') === 'title_funniest');
            const channel = live.find((el) => isChannelEl(el));
            const row = document.createElement('div');
            row.className = 'rk-ghost-title-row';
            [ranking, accent].filter(Boolean).forEach((source) => {
                const line = document.createElement('span');
                line.className = 'rk-ghost-line';
                const label = sampleLabelForEl(source);
                if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(line, label);
                else line.textContent = label;
                styleGhostLine(line, source);
                row.appendChild(line);
            });
            if (row.childNodes.length) stackEl.appendChild(row);
            if (channel) {
                const line = document.createElement('span');
                line.className = 'rk-ghost-line rk-ghost-channel';
                const label = sampleLabelForEl(channel);
                if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(line, label);
                else line.textContent = label;
                styleGhostLine(line, channel);
                stackEl.appendChild(line);
            }
            // Fallback if ids missing
            if (!stackEl.childNodes.length) {
                live.forEach((source) => {
                    const line = document.createElement('span');
                    line.className = 'rk-ghost-line';
                    const label = sampleLabelForEl(source);
                    if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(line, label);
                    else line.textContent = label;
                    styleGhostLine(line, source);
                    stackEl.appendChild(line);
                });
            }
        } else {
            // Rank side: prefer numbers only — empty title spans were rendering as "TEXT"
            const ghostSources = allRankSide ? ghostSourcesForRankSide(live) : live;
            ghostSources.forEach((source) => {
                const label = sampleLabelForEl(source);
                if (!label) return;
                const line = document.createElement('span');
                line.className = 'rk-ghost-line';
                if (window.__SolisSG?.shieldLabel) window.__SolisSG.shieldLabel(line, label);
                else line.textContent = label;
                styleGhostLine(line, source);
                stackEl.appendChild(line);
            });
            if (!stackEl.childNodes.length) return;
        }

        document.body.appendChild(stackEl);
        ghostNodes.push(stackEl);
        try {
            if (window.__SolisSG?.harden) window.__SolisSG.harden(stackEl);
            if (suggestActions && window.__SolisSG?.harden) window.__SolisSG.harden(suggestActions);
        } catch (_) { /* ignore */ }

        const sH = stackEl.offsetHeight || 40;
        const sW = stackEl.offsetWidth || 80;
        let left = Math.round(leftEdge - sW - gap);
        let stackTop = Math.round(zoneMidY - sH / 2);
        stackTop = Math.max(8, Math.min(stackTop, window.innerHeight - sH - 8));
        if (left < 8) left = 8;
        stackEl.style.left = `${left}px`;
        stackEl.style.top = `${stackTop}px`;

        // Measure after paint so ghost rect + action size are real
        requestAnimationFrame(() => {
            if (!pendingSuggest || !stackEl.isConnected) return;
            posSuggestActions(stackEl);
        });
    }

    function posSuggestActions(stackEl) {
        if (!suggestActions) return;
        // Keep on body so position:fixed isn't trapped by modal transforms
        if (suggestActions.parentElement !== document.body) {
            document.body.appendChild(suggestActions);
        }
        suggestActions.classList.add('open');
        suggestActions.style.visibility = 'visible';
        suggestActions.style.opacity = '1';
        suggestActions.style.pointerEvents = 'auto';

        // Anchor to the RED live zone (what will change) — not the green ghost
        const redZones = Array.from(document.querySelectorAll('.rk-suggest-remove'))
            .filter((el) => el.isConnected);
        let r = null;
        if (redZones.length) {
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            redZones.forEach((el) => {
                const box = el.getBoundingClientRect();
                left = Math.min(left, box.left);
                top = Math.min(top, box.top);
                right = Math.max(right, box.right);
                bottom = Math.max(bottom, box.bottom);
            });
            if (Number.isFinite(left)) {
                r = { left, top, right, bottom, width: right - left, height: bottom - top };
            }
        }
        if (!r && stackEl?.isConnected) {
            const box = stackEl.getBoundingClientRect();
            r = {
                left: box.left, top: box.top, right: box.right, bottom: box.bottom,
                width: box.width, height: box.height,
            };
        }
        if (!r) return;

        const aw = Math.max(suggestActions.offsetWidth || 0, 64);
        const ah = Math.max(suggestActions.offsetHeight || 0, 34);
        const gap = 8;
        const pad = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const preview = document.getElementById('templateVideoPreview')?.getBoundingClientRect?.() || null;

        // Comfortable spots: near red, not covering it — prefer upper-right of the change
        const candidates = [
            // nestle just above the top-right corner (most natural for LTR eyes)
            { left: r.right - aw, top: r.top - ah - gap, pref: 100 },
            // slightly inset so it sits on the corner, not floating far
            { left: r.right - aw + 4, top: r.top - ah - gap, pref: 96 },
            // above, centered on the red block
            { left: r.left + (r.width - aw) / 2, top: r.top - ah - gap, pref: 88 },
            // mid-right — beside the change
            { left: r.right + gap, top: r.top + (r.height - ah) / 2, pref: 82 },
            // below top-right
            { left: r.right - aw, top: r.bottom + gap, pref: 74 },
            // mid-left fallback
            { left: r.left - aw - gap, top: r.top + (r.height - ah) / 2, pref: 62 },
            // below centered
            { left: r.left + (r.width - aw) / 2, top: r.bottom + gap, pref: 55 },
        ];

        const overlapsRed = (left, top) => {
            const a = { left, top, right: left + aw, bottom: top + ah };
            const ix = Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left));
            const iy = Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
            return (ix * iy) / Math.max(1, aw * ah);
        };

        let best = null;
        let bestScore = -Infinity;
        candidates.forEach((c) => {
            let left = Math.round(c.left);
            let top = Math.round(c.top);
            left = Math.max(pad, Math.min(left, vw - aw - pad));
            top = Math.max(pad, Math.min(top, vh - ah - pad));

            let score = c.pref;
            // Stay on-screen without being clamped hard
            if (c.left < pad || c.left + aw > vw - pad) score -= 25;
            if (c.top < pad || c.top + ah > vh - pad) score -= 25;
            // Prefer hugging the phone preview
            if (preview) {
                const cx = left + aw / 2;
                const cy = top + ah / 2;
                const inPreview = cx >= preview.left - 12 && cx <= preview.right + 12
                    && cy >= preview.top - 20 && cy <= preview.bottom + 20;
                score += inPreview ? 18 : -12;
            }
            // Don't cover the red content
            const cover = overlapsRed(left, top);
            score -= cover * 80;
            // Prefer sitting close to the red zone center
            const dx = (left + aw / 2) - (r.left + r.width / 2);
            const dy = (top + ah / 2) - (r.top + r.height / 2);
            score -= Math.min(40, Math.hypot(dx, dy) / 12);

            if (score > bestScore) {
                bestScore = score;
                best = { left, top };
            }
        });

        if (!best) {
            best = {
                left: Math.max(pad, Math.min(Math.round(r.right - aw), vw - aw - pad)),
                top: Math.max(pad, Math.min(Math.round(r.top - ah - gap), vh - ah - pad)),
            };
        }

        suggestActions.style.left = `${best.left}px`;
        suggestActions.style.top = `${best.top}px`;
        suggestActions.style.transform = 'none';
        suggestActions.style.zIndex = '99870';
    }

    function offerStyleSuggest(props, targets) {
        clearSuggest();
        if (!targets.length || !props || !Object.keys(props).length) return;
        // Keep the edit pill available so users can keep tweaking while a suggest is up
        try { closeDD(); } catch (_) { /* ignore */ }
        pendingSuggest = { props: { ...props }, targets: [...targets] };
        layoutGhosts();
        if (activeEls.size) {
            try { showMenu(); schedulePosMenu(); } catch (_) { /* ignore */ }
        }
    }

    function acceptSuggest() {
        if (!pendingSuggest) return;
        const { props, targets } = pendingSuggest;
        const chain = props.chain || null;
        const live = targets.filter((el) => el?.isConnected);
        if (props.font) {
            applyFontChange(props.font, live);
            fontTouched = true;
            curFont = props.font;
        }
        if (props.color) {
            live.forEach((el) => { el.style.color = props.color; });
            colorTouched = true;
            curTextCol = props.color;
        }
        if (props.shadow) {
            live.forEach((el) => setElementShadow(el, props.shadow));
            shadowTouched = true;
            curShadow = props.shadow;
        }
        if (props.size != null) {
            sizeTouched = true;
            const fromGroup = props.fromGroup || editedSizeGroup(live);
            if (props.comfortable) {
                // Per-element comfort so titles / ranks / channel stay balanced
                live.forEach((el) => {
                    const px = comfortableSizeForTarget(el, props.size, fromGroup);
                    setElementFontSize(el, px);
                });
                const primary = live.find((el) => isHeaderEl(el) && !isChannelEl(el))
                    || live.find(isRankEl)
                    || live[0];
                curSize = primary ? getEffectiveFontSize(primary) : props.size;
            } else if (live.every((el) => isRankEl(el)) || live.every((el) => isHeaderEl(el))) {
                curSize = applyBoundedGroupSize(live, props.size);
            } else {
                live.forEach((el) => setElementFontSize(el, props.size));
                curSize = props.size;
            }
        }
        // Never rewrite live copy (no FUNNIEST → BEST steal)
        clearSuggest();
        if (chain?.targets?.length) {
            const nextTargets = chain.targets.filter((el) => el?.isConnected);
            const chainProps = { ...chain };
            delete chainProps.targets;
            delete chainProps.chain;
            if (nextTargets.length && propsNeedApply(nextTargets, chainProps)) {
                // Brief beat then keep offering — more suggestions per edit
                setTimeout(() => {
                    offerStyleSuggest(chainProps, nextTargets);
                }, 280);
                if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
                if (live.some(isHeaderEl)) syncTopPanelToHeader();
                return;
            }
        }
        // Pause so Accept doesn't instantly re-open the next chip
        startSuggestCooldown(ACCEPT_COOLDOWN_MS);
        if (activeEls.size) {
            try { showMenu(); schedulePosMenu(); } catch (_) { /* ignore */ }
        }
        if (window.rankingCustomizer) window.rankingCustomizer.syncFromDOM();
        if (live.some(isHeaderEl)) syncTopPanelToHeader();
    }

    function maybeOfferStyleSuggest(editedTargets, changedProps) {
        if (!editedTargets?.length || !changedProps || !Object.keys(changedProps).length) return;
        if (!canOfferSuggest()) return;
        // Ensure Accept/Dismiss + green ghost chrome exists (pill may not be built yet)
        try { buildUI(); } catch (_) { /* ignore */ }

        const siblings = resizeSuggestTargets(editedTargets, 'siblings');
        const counterparts = resizeSuggestTargets(editedTargets, 'counterpart');
        const sibNeed = siblings.length > 0 && propsNeedApply(siblings, changedProps);
        const cpNeed = counterparts.length > 0 && propsNeedApply(counterparts, changedProps);

        // Font / color / outline: always prefer the OTHER group (header ↔ ranks)
        const crossFirst = !!(changedProps.font || changedProps.color || changedProps.shadow);

        let phase = null;
        if (crossFirst && cpNeed) {
            phase = 'counterpart';
        } else if (sibNeed) {
            phase = 'siblings';
        } else if (cpNeed) {
            phase = 'counterpart';
        }

        // Lenient fallback — display name vs .ttf file naming used to kill offers
        if (!phase && crossFirst && counterparts.length && changedProps.font) {
            if (counterparts.some((el) => fontsDiffer(getElFontName(el), changedProps.font))) {
                phase = 'counterpart';
            }
        } else if (!phase && siblings.length && changedProps.font) {
            if (siblings.some((el) => fontsDiffer(getElFontName(el), changedProps.font))) {
                phase = 'siblings';
            }
        }

        if (!phase) return;
        const targets = phase === 'counterpart' ? counterparts : siblings;
        if (!targets.length) return;

        // Chain the other group so Accept can keep suggesting (more offers per edit)
        const props = { ...changedProps };
        if (phase === 'siblings' && cpNeed && counterparts.length) {
            props.chain = {
                ...changedProps,
                targets: counterparts,
                fromGroup: changedProps.fromGroup || editedSizeGroup(editedTargets),
            };
        } else if (phase === 'counterpart' && sibNeed && siblings.length) {
            props.chain = {
                ...changedProps,
                targets: siblings,
                fromGroup: changedProps.fromGroup || editedSizeGroup(editedTargets),
            };
        }
        offerStyleSuggest(props, targets);
    }

    function rectsOverlap(a, b, pad = 6) {
        return !(
            a.right + pad <= b.left ||
            a.left - pad >= b.right ||
            a.bottom + pad <= b.top ||
            a.top - pad >= b.bottom
        );
    }

    /** Pill anchors to the clicked element — never the whole zone center. */
    function getAnchorBounds() {
        const el = (selectionAnchor && selectionAnchor.isConnected)
            ? selectionAnchor
            : activeEls.values().next().value;
        if (el?.isConnected) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 || r.height > 0) {
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
            }
        }
        // Empty titles / collapsed nodes — fall back to the zone so the pill still appears
        const zone = (selectionMode === 'group-header' || (selectionAnchor && isHeaderEl(selectionAnchor)))
            ? getHeaderZone()
            : getRanksZone();
        if (zone?.isConnected) {
            const r = zone.getBoundingClientRect();
            if (r.width > 0 || r.height > 0) {
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
            }
        }
        return null;
    }

    function posMenu() {
        if (!activeEls.size || !pill) return;
        const mW = pill.offsetWidth || 100;
        const mH = pill.offsetHeight || 44;
        const gap = 8;
        const pad = 10;
        const vp = { w: window.innerWidth, h: window.innerHeight };
        const sel = getAnchorBounds();
        if (!sel) {
            // Keep pill visible even if measure failed — park near the phone
            const root = getRankingRoot();
            const rr = root?.getBoundingClientRect?.();
            if (rr) {
                pill.style.left = `${Math.round(Math.max(pad, Math.min(rr.right + gap, vp.w - mW - pad)))}px`;
                pill.style.top = `${Math.round(Math.max(pad, rr.top + 24))}px`;
            }
            return;
        }

        let left;
        let top;
        if (vp.w <= 768) {
            left = sel.left + (sel.width - mW) / 2;
            top = sel.top - mH - gap;
            if (top < pad) top = sel.bottom + gap;
            if (top + mH > vp.h - pad) top = Math.max(pad, vp.h - mH - pad);
        } else {
            left = sel.right + gap;
            top = sel.top - mH - gap;
            if (left + mW > vp.w - pad) left = Math.max(pad, sel.left - mW - gap);
            if (top < pad) top = pad;
            if (top + mH > vp.h - pad) top = Math.max(pad, vp.h - mH - pad);
        }
        left = Math.max(pad, Math.min(left, vp.w - mW - pad));
        top = Math.max(pad, Math.min(top, vp.h - mH - pad));

        const pillR = { left, top, right: left + mW, bottom: top + mH };
        const overlaps = !(
            pillR.right <= sel.left - 4 ||
            pillR.left >= sel.right + 4 ||
            pillR.bottom <= sel.top - 4 ||
            pillR.top >= sel.bottom + 4
        );
        if (overlaps) {
            top = sel.top - mH - gap;
            if (top < pad) top = sel.bottom + gap;
            top = Math.max(pad, Math.min(top, vp.h - mH - pad));
        }

        pill.style.left = `${Math.round(left)}px`;
        pill.style.top = `${Math.round(top)}px`;
        placeOpenDd();
    }

    function placeOpenDd() {
        if (!pill) return;
        let dd = null;
        let btn = null;
        if (ddFont?.classList.contains('open')) {
            dd = ddFont;
            btn = document.getElementById('rkBtnFont');
        } else if (ddColor?.classList.contains('open')) {
            dd = ddColor;
            btn = document.getElementById('rkBtnColor');
        }
        if (!dd || !btn) return;
        const mR = pill.getBoundingClientRect();
        const dW = dd.offsetWidth || 220;
        const dH = dd.offsetHeight || 200;
        const vp = { w: window.innerWidth, h: window.innerHeight };
        const gap = 10;
        const preview = document.getElementById('templateVideoPreview');
        const pR = preview?.getBoundingClientRect();

        // Match gp-clips-dd: sit beside the phone so text stays resizable
        let left;
        if (pR) {
            left = pR.right + gap;
            if (left + dW > vp.w - 12) {
                left = Math.max(12, Math.min(pR.left - dW - gap, vp.w - dW - 12));
            }
        } else {
            left = btn.getBoundingClientRect().left;
            if (left + dW > vp.w - 10) left = vp.w - dW - 10;
            if (left < 10) left = 10;
        }

        let top = mR.bottom + gap;
        if (pR) top = Math.max(12, Math.min(top, pR.top + 8));
        if (top + dH > vp.h - 12) top = Math.max(12, vp.h - dH - 12);

        dd.style.top = `${Math.round(top)}px`;
        dd.style.left = `${Math.round(left)}px`;
    }

    function schedulePosMenu() {
        if (posRaf) return;
        posRaf = requestAnimationFrame(() => {
            posRaf = 0;
            if (pill?.classList.contains('active')) posMenu();
            // Keep blank/blur tucked under titles after layout shifts
            try { syncTopPanelToHeader({ liveOnly: true }); } catch (_) { /* ignore */ }
            // Reposition existing suggestion only — don't rebuild (avoids flicker)
            if (pendingSuggest && ghostNodes[0]) {
                layoutGhosts();
            }
        });
    }

    function hideMenu() {
        pill?.classList.remove('active');
        if (pill) {
            // Clear forced inline show styles from showMenu()
            pill.style.opacity = '';
            pill.style.visibility = '';
            pill.style.pointerEvents = '';
        }
        closeDD();
    }
    try { window.hideRankingTextPill = hideMenu; } catch (_) {}

    function openDD(dd, btn) {
        closeDD(dd);
        dd.classList.add('open');
        const mR = pill.getBoundingClientRect();
        const dW = dd.offsetWidth || 220;
        const dH = dd.offsetHeight || 200;
        const vp = { w: window.innerWidth, h: window.innerHeight };
        let top = mR.bottom + 8;
        if (top + dH > vp.h - 20) top = mR.top - dH - 8;
        top = Math.max(8, Math.min(top, vp.h - dH - 8));
        let left = btn.getBoundingClientRect().left;
        if (left + dW > vp.w - 10) left = vp.w - dW - 10;
        if (left < 10) left = 10;
        dd.style.top = `${top}px`;
        dd.style.left = `${left}px`;
    }

    function closeDD(except) {
        if (!except || except !== ddFont) resetFontPreview();
        if (!except || except !== ddColor) {
            endColorPreview();
            closePlusPop();
        }
        [ddFont, ddColor].forEach((d) => {
            if (!d || d === except) return;
            d.classList.remove('open');
        });
        pill?.querySelectorAll('.sub-pill-btn').forEach((b) => b.classList.remove('sub-active'));
    }

    function showMenu() {
        if (!activeEls.size) return;
        buildUI();
        if (!pill) return;
        try { window.solisClosePeerPreviewChrome?.('rk'); } catch (_) {}
        pill.classList.add('active');
        // Force visible — some peers leave opacity/visibility stuck from prior hide
        pill.style.opacity = '1';
        pill.style.visibility = 'visible';
        pill.style.pointerEvents = 'auto';
        pill.style.zIndex = '99900';
        posMenu();
        // Second paint after layout/fonts settle
        requestAnimationFrame(() => {
            if (activeEls.size && pill?.classList.contains('active')) posMenu();
        });
    }

    function wireButtons() {
        document.getElementById('rkBtnFont')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = ddFont.classList.contains('open');
            closeDD();
            if (!open) {
                fontPreviewActive = false;
                activeEls.forEach((el) => snapshotEl(el));
                buildFontList();
                openDD(ddFont, e.currentTarget);
                syncFontDdHighlight(curFont);
                e.currentTarget.classList.add('sub-active');
            } else {
                resetFontPreview();
            }
        });
        document.getElementById('rkBtnColor')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = ddColor.classList.contains('open');
            closeDD();
            if (!open) {
                openDD(ddColor, e.currentTarget);
                e.currentTarget.classList.add('sub-active');
                syncFillSwatches();
                syncTopBgVisibility();
                syncBlankBgVisibility();
                syncTopModeButtons();
                syncOutlineColSwatches();
                applyRankingTopPanel();
            }
        });

        document.getElementById('rkSuggestAccept')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            acceptSuggest();
        });
        document.getElementById('rkSuggestDismiss')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSuggest({ persistReject: true });
        });

        document.addEventListener('keydown', (e) => {
            if (!pendingSuggest) return;
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                acceptSuggest();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clearSuggest({ persistReject: true });
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('#rkSuggestActions')) return;
            if (!pill?.classList.contains('active')) return;
            if (e.target.closest('.sub-resize-handle')) return;
            if (pill.contains(e.target) || ddFont.contains(e.target) || ddColor.contains(e.target)) return;
            if (e.target.closest('[data-template-element-id]')) return;
            if (e.target.closest('.ranking-editor-zone-header, .ranking-editor-zone-ranks')) return;
            if (e.target.closest('.ranking-preview-container')) {
                deselectAll();
                return;
            }
            deselectAll();
        }, true);

        window.addEventListener('resize', schedulePosMenu);
        window.addEventListener('scroll', schedulePosMenu, true);
    }

    function deselectAll() {
        activeEls.forEach((el) => {
            el.contentEditable = 'false';
        });
        activeEls.clear();
        snapshots.clear();
        selectionMode = 'single';
        selectionAnchor = null;
        lastClickPoint = null;
        clearSelectionVisuals();
        syncResizeHandles();
        hideMenu();
        if (window.customizer?.closeCustomizer) window.customizer.closeCustomizer();
    }

    function resetSession() {
        clearSuggest();
        deselectAll();
    }

    function selectElements(els, mode = 'single', anchor = null, clickPoint = null) {
        buildUI();

        const resolvedEls = normalizeSelectionElements(els, mode);

        // Soft-clear any open suggest when picking a new element to edit.
        // Do NOT persistReject or cooldown — that blocked the next font/color chip.
        if (pendingSuggest) {
            clearSuggest();
        }

        activeEls.forEach((el) => { el.contentEditable = 'false'; });
        activeEls.clear();
        snapshots.clear();
        selectionMode = mode;
        selectionAnchor = anchor || (resolvedEls.length === 1 ? resolvedEls[0] : null);
        if (clickPoint) lastClickPoint = clickPoint;

        resolvedEls.forEach((el) => {
            if (!el?.isConnected) return;
            activeEls.add(el);
            snapshotEl(el);
        });

        // Paint selection + pill first so the click feels instant
        applySelectionVisuals();
        showMenu();
        fontTouched = false;
        colorTouched = false;
        fillTouched = false;
        shadowTouched = false;
        // Never rewrite font sizes on click — that was collapsing numbers / channel
        sizeTouched = false;

        const finishSelectChrome = () => {
            syncResizeHandles();
            hideSubtitleGuidesOverRanking();
            const stateEl = (mode === 'group-header')
                ? (getPrimaryHeaderEl() || selectionAnchor || resolvedEls[0])
                : (selectionAnchor || resolvedEls[0]);
            if (stateEl) readStateFromEl(stateEl);
            syncColorSwatches();
            syncFillSwatches();
            syncTopBgVisibility();
            syncTopModeButtons();
            // Do NOT call applyRankingTopPanel() here — it rewires stack-drag and
            // previously re-inited the editor (deselectAll), which killed the pill.
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(finishSelectChrome);
        } else {
            finishSelectChrome();
        }
    }

    function finishMultiSelection(anchor) {
        selectionMode = activeEls.size > 1 ? 'multi' : 'single';
        selectionAnchor = anchor || activeEls.values().next().value || null;
        applySelectionVisuals();
        syncResizeHandles();
        hideSubtitleGuidesOverRanking();
        syncTopBgVisibility();
        showMenu();
        return selectionAnchor;
    }

    function toggleElement(el, multi, clickPoint) {
        buildUI();
        if (pendingSuggest) {
            clearSuggest();
        }
        if (clickPoint) lastClickPoint = clickPoint;
        if (!multi) {
            if (activeEls.has(el) && activeEls.size === 1 && selectionMode === 'single') return el;
            selectElements([el], 'single', el, clickPoint);
            return el;
        }

        // Ctrl/Cmd from a zone group → start a multi-set with the clicked item.
        // Further Ctrl/Cmd+clicks add/remove (do not collapse the group to "only 1").
        if (selectionMode === 'group-ranks' || selectionMode === 'group-header') {
            activeEls.clear();
            snapshots.clear();
            activeEls.add(el);
            snapshotEl(el);
            return finishMultiSelection(el);
        }

        if (activeEls.has(el)) {
            activeEls.delete(el);
            if (!activeEls.size) {
                deselectAll();
                return null;
            }
            return finishMultiSelection(activeEls.values().next().value || null);
        }
        activeEls.add(el);
        snapshotEl(el);
        return finishMultiSelection(el);
    }

    window.RankingTextPill = {
        init: buildUI,
        selectElements,
        toggleElement,
        deselectAll,
        resetSession,
        hide: hideMenu,
        reposition: posMenu,
        clearSuggest,
        acceptSuggest,
        applyTopPanel: applyRankingTopPanel,
        getLayout: getRankingLayout,
        seedDefaultSizes: seedDefaultPreviewSizes,
        isActive: (el) => activeEls.has(el),
        hasSelection: () => activeEls.size > 0,
        getSelectionMode: () => selectionMode,
        getSelectionAnchor: () => selectionAnchor,
        getGroupAnchor: () => selectionAnchor,
        consumeRankPointerClick,
        getAllRankNumbers,
        getAllRankTitles,
        getAllRankSideElements,
        getHeaderElements,
        getAllTextElements,
    };
})();
