/**
 * Ranking template editor — zone-first selection (plain click, no Ctrl required):
 * • First click on ranks → select ALL 1–5 + show customize pill
 * • Second click on a number (e.g. 3.) → solo that item + pill
 * • Same for header (RANKING / BEST / CHANNEL)
 * • Ctrl/Cmd+click → optional multi-select
 * • Double-click title → inline edit
 */

class RankingTemplateEditor {
    constructor(previewContainer) {
        this.container = previewContainer;
        this._abort = new AbortController();
        this.init();
    }

    destroy() {
        try { this._abort?.abort(); } catch (_) { /* ignore */ }
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
        const h1 = this.container.querySelector('h1.title, h1');
        const h2 = this.container.querySelector('[data-template-element-id="title_channel"]');
        let zone = this.container.querySelector('.ranking-editor-zone-header');
        if (!zone && h1) {
            zone = document.createElement('div');
            zone.className = 'ranking-editor-zone ranking-editor-zone-header';
            h1.parentNode.insertBefore(zone, h1);
        }
        // Always keep RANKING/BEST + CHANNEL as one stacked header (never float channel alone)
        if (zone) {
            if (h1 && h1.parentNode !== zone) zone.insertBefore(h1, zone.firstChild);
            if (h2 && h2.parentNode !== zone) zone.appendChild(h2);
            // Channel must be the last header child — directly under the title row
            if (h1 && h2 && h2.previousElementSibling !== h1) {
                zone.appendChild(h2);
            }
        }
        const list = this.container.querySelector('.ranking-list');
        if (list) list.classList.add('ranking-editor-zone', 'ranking-editor-zone-ranks');
    }

    isRankNumberElement(el) {
        const id = el?.getAttribute?.('data-template-element-id') || '';
        return id.startsWith('rank_') && id.endsWith('_number');
    }

    setupTextElements() {
        this.container.querySelectorAll('[data-template-element-id]').forEach((el) => {
            el.classList.add('ranking-editor-text');
            // Ranking digits are fixed (1. … 5.) — style only, never rewrite the label
            if (this.isRankNumberElement(el)) {
                el.contentEditable = 'false';
                el.setAttribute('contenteditable', 'false');
                el.setAttribute('spellcheck', 'false');
                el.classList.add('rk-number-locked');
                const m = (el.getAttribute('data-template-element-id') || '').match(/^rank_(\d+)_number$/);
                if (m) el.textContent = `${m[1]}.`;
            } else if (this.isRankTitleElement(el) || this.isHeaderElement(el)) {
                // Explicitly editable via double-click (not always-on contenteditable)
                el.contentEditable = 'false';
                el.setAttribute('contenteditable', 'false');
                el.setAttribute('spellcheck', 'true');
                el.style.cursor = 'text';
                el.title = el.title || 'Double-click to edit';
            }
        });
    }

    isHeaderElement(el) {
        const id = el.getAttribute('data-template-element-id') || '';
        return id.startsWith('title_');
    }

    isRankTitleElement(el) {
        const id = el.getAttribute('data-template-element-id') || '';
        return id.startsWith('rank_') && id.endsWith('_title');
    }

    getZoneMode(el) {
        return this.isHeaderElement(el) ? 'group-header' : 'group-ranks';
    }

    getGroupElements(el) {
        const pill = window.RankingTextPill;
        if (this.isHeaderElement(el)) return pill.getHeaderElements();
        // Numbers + titles together — font/size apply to the labels next to 1–5
        if (pill.getAllRankSideElements) return pill.getAllRankSideElements();
        if (this.isRankTitleElement(el) && pill.getAllRankTitles) {
            return [...(pill.getAllRankNumbers?.() || []), ...pill.getAllRankTitles()];
        }
        return pill.getAllRankNumbers();
    }

    sameZone(a, b) {
        if (!a || !b) return false;
        return this.isHeaderElement(a) === this.isHeaderElement(b);
    }

    handleTextClick(el, multi, e) {
        const pill = window.RankingTextPill;
        if (!pill) return;

        const clickPoint = e ? { x: e.clientX, y: e.clientY } : null;

        // Ctrl/Cmd only — optional multi-select. Never required for the pill.
        if (multi) {
            pill.toggleElement(el, true, clickPoint);
            return;
        }

        const mode = pill.getSelectionMode();
        const anchor = pill.getSelectionAnchor();
        const zoneMode = this.getZoneMode(el);
        const groupEls = this.getGroupElements(el);

        // First click → whole zone (all ranks OR all header lines)
        if (!pill.hasSelection() || mode === 'multi') {
            if (mode === 'multi' && this.sameZone(el, anchor)) {
                // Leave multi → solo the clicked item
                pill.selectElements([el], 'single', el, clickPoint);
                return;
            }
            if (!pill.hasSelection()) {
                pill.selectElements(groupEls, zoneMode, el, clickPoint);
                return;
            }
        }

        // Same zone while grouped → drill into that specific item (e.g. "3.")
        if ((mode === 'group-header' || mode === 'group-ranks') && this.sameZone(el, anchor)) {
            pill.selectElements([el], 'single', el, clickPoint);
            return;
        }

        // Other zone while grouped → select that whole zone
        if ((mode === 'group-header' || mode === 'group-ranks') && !this.sameZone(el, anchor)) {
            pill.selectElements(groupEls, zoneMode, el, clickPoint);
            return;
        }

        // Solo + same element again → back to full zone
        if (mode === 'single' && el === anchor) {
            pill.selectElements(groupEls, zoneMode, el, clickPoint);
            return;
        }

        // Solo + different item in same zone → solo that item
        if (mode === 'single' && this.sameZone(el, anchor)) {
            pill.selectElements([el], 'single', el, clickPoint);
            return;
        }

        // Solo → other zone → group that zone
        pill.selectElements(groupEls, zoneMode, el, clickPoint);
    }

    attachEventListeners() {
        const headerZone = this.container.querySelector('.ranking-editor-zone-header');
        const ranksZone = this.container.querySelector('.ranking-editor-zone-ranks');
        const signal = this._abort.signal;

        const onTextActivate = (el, e) => {
            if (!el) return;
            if (e.target.closest('#rkPillMenu, .sub-dropdown, #rkSuggestActions, .sub-resize-handle')) return;
            if (window.RankingTextPill?.consumeRankPointerClick?.()) return;
            e.preventDefault?.();
            e.stopPropagation();
            // Plain click only — Ctrl/Cmd still multi-selects, but is never required
            this.handleTextClick(el, !!(e.ctrlKey || e.metaKey), e);
        };

        // Primary path: bind each ranking/title node directly (zone bubbling was unreliable)
        this.container.querySelectorAll('[data-template-element-id]').forEach((el) => {
            el.addEventListener('pointerup', (e) => {
                if (e.button != null && e.button !== 0) return;
                onTextActivate(el, e);
            }, { signal });

            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Numbers stay fixed — only titles / header lines are inline-editable
                if (this.isRankNumberElement(el)) {
                    window.RankingTextPill?.selectElements(
                        [el], 'single', el, { x: e.clientX, y: e.clientY }
                    );
                    return;
                }
                // Select this title alone, then enter edit — don't open pill focus fights
                window.RankingTextPill?.selectElements?.(
                    [el], 'single', el, { x: e.clientX, y: e.clientY }
                );
                // Defer one frame so selection/pill settle before focusing the caret
                requestAnimationFrame(() => this.enableInlineEdit(el));
            }, { signal });

            // Block typing / paste into locked rank numbers even if something toggles contentEditable
            if (this.isRankNumberElement(el)) {
                const blockEdit = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                };
                el.addEventListener('beforeinput', blockEdit, { signal });
                el.addEventListener('input', (ev) => {
                    const m = (el.getAttribute('data-template-element-id') || '').match(/^rank_(\d+)_number$/);
                    if (m) el.textContent = `${m[1]}.`;
                    blockEdit(ev);
                }, { signal });
                el.addEventListener('paste', blockEdit, { signal });
                el.addEventListener('keydown', (ev) => {
                    // Allow selection shortcuts; block character keys
                    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
                    if (ev.key.length === 1 || ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === 'Enter') {
                        blockEdit(ev);
                    }
                }, { signal });
            }
        });

        // Fallback: empty padding in a zone still selects the whole group
        headerZone?.addEventListener('pointerup', (e) => {
            if (e.target.closest('[data-template-element-id]')) return;
            if (e.button != null && e.button !== 0) return;
            const el = this.container.querySelector('[data-template-element-id^="title_"]');
            onTextActivate(el, e);
        }, { signal });

        ranksZone?.addEventListener('pointerup', (e) => {
            if (e.target.closest('[data-template-element-id]')) return;
            if (e.button != null && e.button !== 0) return;
            const pill = window.RankingTextPill;
            if (pill?.hasSelection?.() && pill.getSelectionMode() === 'group-ranks') return;
            // Padding click with no selection → select all ranks
            if (!pill?.hasSelection?.()) {
                const el = this.container.querySelector('[data-template-element-id$="_number"]');
                onTextActivate(el, e);
            }
        }, { signal });

        this.container.addEventListener('pointerup', (e) => {
            if (e.button != null && e.button !== 0) return;
            const isText = e.target.hasAttribute?.('data-template-element-id')
                || e.target.closest?.('[data-template-element-id]');
            const isZone = e.target.closest?.('.ranking-editor-zone-header, .ranking-editor-zone-ranks');
            const isSuggestUi = e.target.closest?.('#rkSuggestActions')
                || e.target.closest?.('.rk-ghost-stack')
                || e.target.closest?.('.rk-ghost-suggest')
                || e.target.closest?.('#rkPillMenu')
                || e.target.closest?.('.sub-dropdown');
            if (!isText && !isZone && !isSuggestUi) {
                window.RankingTextPill?.deselectAll();
            }
        }, { capture: true, signal });
    }

    enableInlineEdit(el) {
        if (this.isRankNumberElement(el)) return;
        if (el.classList.contains('rk-inline-editing')) return;

        const originalText = el.textContent;
        const originalHTML = el.innerHTML;
        const placeholder = el.getAttribute('data-placeholder') || '';
        // Empty placeholder titles: clear so the user types into a blank field
        if (el.classList.contains('rk-title-empty') || (!originalText.trim() && placeholder)) {
            el.textContent = '';
            el.classList.remove('rk-title-empty');
            el.removeAttribute('data-placeholder');
        }

        el.contentEditable = 'true';
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
        el.classList.add('rk-inline-editing');
        el.style.outline = 'none';
        el.style.setProperty('user-select', 'text', 'important');
        el.style.setProperty('-webkit-user-select', 'text', 'important');
        el.style.cursor = 'text';
        // Stop parent .preview-placeholder user-select:none from blocking caret
        const phone = el.closest('.preview-placeholder, #templateVideoPreview');
        if (phone) phone.classList.add('rk-phone-editing');

        el.focus();

        try {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (_) { /* ignore */ }

        const stripScripts = (html) => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
        const hasColoredSpans = (node) => !!node?.querySelector?.('span[style*="color"]');

        const finish = (commit) => {
            el.removeEventListener('blur', onBlur);
            el.removeEventListener('keydown', onKey);
            el.removeEventListener('pointerdown', onPointerDownStop);
            el.contentEditable = 'false';
            el.setAttribute('contenteditable', 'false');
            el.classList.remove('rk-inline-editing');
            el.style.outline = '';
            el.style.removeProperty('user-select');
            el.style.removeProperty('-webkit-user-select');
            el.style.cursor = '';
            phone?.classList.remove('rk-phone-editing');

            let text = el.textContent.replace(/\u00a0/g, ' ').trim();
            if (!commit) {
                text = (originalText || '').trim();
                el.innerHTML = originalHTML || '';
            }
            const eid = el.getAttribute('data-template-element-id') || '';
            if (!text) {
                el.textContent = '';
                if (/rank_.*_title/.test(eid)) {
                    el.classList.add('rk-title-empty');
                    el.setAttribute('data-placeholder', 'Add title…');
                    el.removeAttribute('data-rk-full-title');
                } else if (originalText) {
                    el.innerHTML = originalHTML || originalText;
                }
            } else {
                el.classList.remove('rk-title-empty');
                el.removeAttribute('data-placeholder');
                el.setAttribute('data-rk-full-title', text);
                // Keep multi-color spans — do not flatten with textContent
                if (hasColoredSpans(el)) {
                    el.innerHTML = stripScripts(el.innerHTML);
                } else {
                    el.textContent = text;
                }
            }

            // Persist into customizer so Apply / generate keep the edit
            if (eid && window.rankingCustomizer) {
                if (!window.rankingCustomizer.customizations) {
                    window.rankingCustomizer.customizations = {};
                }
                const patch = { content: text || '' };
                if (hasColoredSpans(el)) {
                    patch.contentHtml = stripScripts(el.innerHTML);
                }
                window.rankingCustomizer.customizations[eid] = {
                    ...(window.rankingCustomizer.customizations[eid] || {}),
                    ...patch,
                };
            }
            try {
                const m = eid.match(/^rank_(\d+)_title$/);
                if (m && window.clipsStudio) {
                    if (!window.clipsStudio._libraryRankingTitleByRank) {
                        window.clipsStudio._libraryRankingTitleByRank = {};
                    }
                    window.clipsStudio._libraryRankingTitleByRank[Number(m[1])] = text || '';
                }
            } catch (_) { /* ignore */ }

            window.rankingCustomizer?.syncFromDOM?.();
            try {
                if (typeof markLibraryRankingDirty === 'function') markLibraryRankingDirty();
                else if (window.clipsStudio) window.clipsStudio._libraryRankingDirty = true;
            } catch (_) { /* ignore */ }
        };

        const onBlur = () => finish(true);
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
                el.blur();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                el.blur();
            }
        };
        // Keep clicks inside the field from bubbling into zone select / stack drag
        const onPointerDownStop = (e) => {
            e.stopPropagation();
        };

        el.addEventListener('blur', onBlur);
        el.addEventListener('keydown', onKey);
        el.addEventListener('pointerdown', onPointerDownStop);
    }
}

function initializeRankingTemplateEditor() {
    const previewContainer = document.getElementById('templateVideoPreview');
    const rankingRoot = previewContainer?.querySelector('.ranking-preview-container');
    if (!rankingRoot) return;

    // Re-init stacks click handlers — drop the previous editor first or
    // Ctrl+click toggles twice (add then remove) and leaves only one selected.
    try { window.rankingTemplateEditor?.destroy?.(); } catch (_) { /* ignore */ }

    window.RankingTextPill?.deselectAll();
    window.rankingTemplateEditor = new RankingTemplateEditor(rankingRoot);

    // Bold default type — CSS rem clamps were leaving titles/ranks tiny
    try {
        requestAnimationFrame(() => {
            window.RankingTextPill?.seedDefaultSizes?.();
        });
    } catch (_) { /* ignore */ }

    // Hide legacy customizer UIs — ranking uses the subtitle-style rkPillMenu only
    const legacyUi = document.getElementById('customizer-ui-system');
    if (legacyUi) legacyUi.style.display = 'none';
    const legacyPill = document.getElementById('pill');
    if (legacyPill) {
        legacyPill.style.display = 'none';
        legacyPill.classList.remove('is-expanded', 'slide-in');
    }
    if (window.customizer && typeof window.customizer.hidePanel === 'function') {
        try { window.customizer.hidePanel(); } catch (_) {}
    }
}

window.initializeRankingTemplateEditor = initializeRankingTemplateEditor;
