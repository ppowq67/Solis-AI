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
        if (zone) {
            if (h1 && h1.parentNode !== zone) zone.insertBefore(h1, zone.firstChild);
            if (h2 && h2.parentNode !== zone) zone.appendChild(h2);
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
            if (this.isRankNumberElement(el)) {
                el.contentEditable = 'false';
                el.setAttribute('contenteditable', 'false');
                el.setAttribute('spellcheck', 'false');
                el.classList.add('rk-number-locked');
                const m = (el.getAttribute('data-template-element-id') || '').match(/^rank_(\d+)_number$/);
                if (m) el.textContent = `${m[1]}.`;
            } else if (this.isRankTitleElement(el) || this.isHeaderElement(el)) {
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

        if (multi) {
            pill.toggleElement(el, true, clickPoint);
            return;
        }

        const mode = pill.getSelectionMode();
        const anchor = pill.getSelectionAnchor();
        const zoneMode = this.getZoneMode(el);
        const groupEls = this.getGroupElements(el);

        if (!pill.hasSelection() || mode === 'multi') {
            if (mode === 'multi' && this.sameZone(el, anchor)) {
                pill.selectElements([el], 'single', el, clickPoint);
                return;
            }
            if (!pill.hasSelection()) {
                pill.selectElements(groupEls, zoneMode, el, clickPoint);
                return;
            }
        }

        if ((mode === 'group-header' || mode === 'group-ranks') && this.sameZone(el, anchor)) {
            pill.selectElements([el], 'single', el, clickPoint);
            return;
        }

        if ((mode === 'group-header' || mode === 'group-ranks') && !this.sameZone(el, anchor)) {
            pill.selectElements(groupEls, zoneMode, el, clickPoint);
            return;
        }

        if (mode === 'single' && el === anchor) {
            pill.selectElements(groupEls, zoneMode, el, clickPoint);
            return;
        }

        if (mode === 'single' && this.sameZone(el, anchor)) {
            pill.selectElements([el], 'single', el, clickPoint);
            return;
        }

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
            this.handleTextClick(el, !!(e.ctrlKey || e.metaKey), e);
        };

        this.container.querySelectorAll('[data-template-element-id]').forEach((el) => {
            el.addEventListener('pointerup', (e) => {
                if (e.button != null && e.button !== 0) return;
                onTextActivate(el, e);
            }, { signal });

            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.isRankNumberElement(el)) {
                    window.RankingTextPill?.selectElements(
                        [el], 'single', el, { x: e.clientX, y: e.clientY }
                    );
                    return;
                }
                window.RankingTextPill?.selectElements?.(
                    [el], 'single', el, { x: e.clientX, y: e.clientY }
                );
                requestAnimationFrame(() => this.enableInlineEdit(el));
            }, { signal });

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
                    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
                    if (ev.key.length === 1 || ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === 'Enter') {
                        blockEdit(ev);
                    }
                }, { signal });
            }
        });

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
        const placeholder = el.getAttribute('data-placeholder') || '';
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
                el.textContent = originalText || '';
            }
            const eid = el.getAttribute('data-template-element-id') || '';
            if (!text) {
                el.textContent = '';
                if (/rank_.*_title/.test(eid)) {
                    el.classList.add('rk-title-empty');
                    el.setAttribute('data-placeholder', 'Add title…');
                    el.removeAttribute('data-rk-full-title');
                } else if (originalText) {
                    el.textContent = originalText;
                }
            } else {
                el.classList.remove('rk-title-empty');
                el.removeAttribute('data-placeholder');
                el.setAttribute('data-rk-full-title', text);
                el.textContent = text;
            }

            if (eid && window.rankingCustomizer) {
                if (!window.rankingCustomizer.customizations) {
                    window.rankingCustomizer.customizations = {};
                }
                window.rankingCustomizer.customizations[eid] = {
                    ...(window.rankingCustomizer.customizations[eid] || {}),
                    content: text || '',
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

    try { window.rankingTemplateEditor?.destroy?.(); } catch (_) { /* ignore */ }

    window.RankingTextPill?.deselectAll();
    window.rankingTemplateEditor = new RankingTemplateEditor(rankingRoot);

    try {
        requestAnimationFrame(() => {
            window.RankingTextPill?.seedDefaultSizes?.();
        });
    } catch (_) { /* ignore */ }

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
