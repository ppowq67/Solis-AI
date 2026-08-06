(function () {
    const STORAGE_KEY = 'solis_template_memory';
    const CAPTION_BY_TEMPLATE_KEY = 'solis_caption_by_template';
    const VERSION = 5;
    const SUGGEST_DELAY_MS = 900;
    const BURST_REOPEN_THRESHOLD = 999; // reject is sticky — don't reopen from edit bursts
    const USAGE_LOG_MAX = 40;
    const SERVER_SYNC_MS = 1200;
    const REJECT_COOLDOWN_MS = 45 * 1000;
    const OFFER_COOLDOWN_MS = 18 * 1000;
    const RANKING_OFFER_COOLDOWN_MS = 20 * 1000;
    const sessionRejected = new Set();

    function isRankingTemplate(templateId) {
        const id = String(templateId || '').toLowerCase();
        return id === 'ranked_compilation' || id === 'ranking' || id.includes('rank');
    }

    function isSplitscreenTemplate(templateId) {
        const id = String(templateId || '').toLowerCase();
        return id === 'splitscreen' || id.includes('split');
    }

    function templateMemoryProfile(templateId) {
        return {
            styles: isRankingTemplate(templateId),
            layout: isSplitscreenTemplate(templateId),
            captions: !isRankingTemplate(templateId),
        };
    }

    function sanitizeForTemplate(templateId, { styles = null, captions = null, layout = null } = {}) {
        const profile = templateMemoryProfile(templateId);
        return {
            styles: profile.styles && styles && typeof styles === 'object' && Object.keys(styles).length
                ? styles
                : null,
            captions: profile.captions && captions && typeof captions === 'object' && Object.keys(captions).length
                ? captions
                : null,
            layout: profile.layout && layoutUseful(layout) ? normalizeLayout(layout) : null,
        };
    }

    function layoutUseful(layout) {
        if (!layout || typeof layout !== 'object') return false;
        if (layout.splitscreen_secondary_type) return true;
        const r = Number(layout.splitscreen_content_ratio);
        return Number.isFinite(r);
    }

    function normalizeLayout(layout) {
        if (!layout || typeof layout !== 'object') return null;
        const out = { ...layout };
        const r = Number(out.splitscreen_content_ratio);
        if (Number.isFinite(r)) {
            out.splitscreen_content_ratio = Math.max(0.02, Math.min(0.98, r));
        }
        if (out.splitscreen_secondary_type) {
            out.splitscreen_secondary_type = String(out.splitscreen_secondary_type).toLowerCase();
        }
        return out;
    }

    function mergeLayouts(prev, next) {
        if (!layoutUseful(next) && !layoutUseful(prev)) return null;
        if (!layoutUseful(next)) return normalizeLayout(prev);
        if (!layoutUseful(prev)) return normalizeLayout(next);
        return normalizeLayout({
            ...prev,
            ...next,
            splitscreen_secondary_type: next.splitscreen_secondary_type || prev.splitscreen_secondary_type,
            splitscreen_content_ratio: Number.isFinite(Number(next.splitscreen_content_ratio))
                ? Number(next.splitscreen_content_ratio)
                : prev.splitscreen_content_ratio,
            splitscreen_inverted: next.splitscreen_inverted != null
                ? !!next.splitscreen_inverted
                : !!prev.splitscreen_inverted,
            splitscreen_secondary_collapsed: next.splitscreen_secondary_collapsed != null
                ? !!next.splitscreen_secondary_collapsed
                : !!prev.splitscreen_secondary_collapsed,
            gameplay_clip_id: next.gameplay_clip_id != null ? next.gameplay_clip_id : prev.gameplay_clip_id,
        });
    }

    function readCaptionMap() {
        try {
            const raw = localStorage.getItem(CAPTION_BY_TEMPLATE_KEY)
                || sessionStorage.getItem(CAPTION_BY_TEMPLATE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeCaptionMap(map) {
        try {
            const raw = JSON.stringify(map || {});
            localStorage.setItem(CAPTION_BY_TEMPLATE_KEY, raw);
            sessionStorage.setItem(CAPTION_BY_TEMPLATE_KEY, raw);
        } catch (_) { /* ignore */ }
    }

    function rememberCaptionSnap(templateId, captions) {
        if (!templateId || !captions || typeof captions !== 'object') return;
        const map = readCaptionMap();
        map[templateId] = { ...captions };
        writeCaptionMap(map);
        try {
            window.__solisLastCaptionStyle = { ...captions };
            window.__solisLastCaptionStyleTemplateId = templateId;
        } catch (_) { /* ignore */ }
    }

    function recallCaptionSnap(templateId) {
        if (!templateId) return null;
        try {
            if (
                window.__solisLastCaptionStyleTemplateId === templateId
                && window.__solisLastCaptionStyle
                && typeof window.__solisLastCaptionStyle === 'object'
            ) {
                return { ...window.__solisLastCaptionStyle };
            }
        } catch (_) { /* ignore */ }
        const map = readCaptionMap();
        const snap = map[templateId];
        return snap && typeof snap === 'object' ? { ...snap } : null;
    }

    let suggestTimer = null;
    let sessionBurst = 0;
    let suggestShownForOpen = false;
    let currentTemplateId = null;
    let serverSyncTimer = null;
    let serverHydrated = false;
    let pullInFlight = null;

    function fontAnimHint(font) {
        try {
            if (window.__SolisSG?.animFor) return window.__SolisSG.animFor(font);
        } catch (_) { /* ignore */ }
        return null;
    }

    const ANIM_COLOR_HINT = {
        karaoke: { color: '#FFFFFF', fill: null },
        popcolor: { color: '#FFFFFF', fill: null },
        sticker: { color: '#FFFFFF', fill: null },
        blur: { color: '#FFFFFF', fill: null },
        static: { color: '#FFFFFF', fill: null },
        fade: { color: '#FFFFFF', fill: null },
    };

    function defaultState() {
        return {
            version: VERSION,
            enabled: true,
            suggestEnabled: true,
            templates: {},
            usageLog: [],
        };
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return defaultState();
            const state = {
                ...defaultState(),
                ...parsed,
                version: VERSION,
                templates: parsed.templates && typeof parsed.templates === 'object' ? parsed.templates : {},
                usageLog: Array.isArray(parsed.usageLog) ? parsed.usageLog : [],
            };
            let dirty = parsed.version !== VERSION;
            Object.keys(state.templates).forEach((id) => {
                const mem = state.templates[id];
                if (!mem || typeof mem !== 'object') return;
                const clean = sanitizeForTemplate(id, {
                    styles: mem.styles,
                    captions: mem.captions,
                    layout: mem.layout,
                });
                const stylesChanged = JSON.stringify(mem.styles || null) !== JSON.stringify(clean.styles || null);
                const layoutChanged = JSON.stringify(mem.layout || null) !== JSON.stringify(clean.layout || null);
                const captionsChanged = JSON.stringify(mem.captions || null) !== JSON.stringify(clean.captions || null);
                if (stylesChanged || layoutChanged || captionsChanged) {
                    mem.styles = clean.styles;
                    mem.layout = clean.layout;
                    mem.captions = clean.captions;
                    mem.fingerprint = fingerprint(clean.styles, clean.captions, clean.layout);
                    dirty = true;
                }
            });
            if (dirty) {
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
            }
            return state;
        } catch (_) {
            return defaultState();
        }
    }

    function writeState(state, { sync = false } = {}) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_) { /* quota / private mode */ }
        if (sync) scheduleServerSync();
    }

    function fingerprint(styles, captions, layout) {
        try {
            return JSON.stringify({
                s: styles || null,
                c: captions || null,
                l: layout ? {
                    secondary_type: layout.splitscreen_secondary_type || null,
                    inverted: !!layout.splitscreen_inverted,
                    collapsed: !!layout.splitscreen_secondary_collapsed,
                    ratio: layout.splitscreen_content_ratio != null
                        ? Number(Number(layout.splitscreen_content_ratio).toFixed(3))
                        : null,
                    gameplay_clip_id: layout.gameplay_clip_id || null,
                } : null,
            });
        } catch (_) {
            return '';
        }
    }

    function summarizeStyles(styles, captions, layout) {
        const bits = [];
        if (layout && typeof layout === 'object') {
            const t = String(layout.splitscreen_secondary_type || '');
            if (t === 'face_track') bits.push('Reframe');
            else if (t === 'blank') bits.push('Black');
            else if (t === 'blank_blur') bits.push('Blur');
            else if (t === 'gameplay') bits.push('Gameplay');
            if (layout.splitscreen_inverted) bits.push('flip');
            const r = Number(layout.splitscreen_content_ratio);
            if (Number.isFinite(r)) bits.push(`split ${Math.round(r * 100)}%`);
        }
        if (captions && typeof captions === 'object') {
            if (captions.font) bits.push(String(captions.font).split(',')[0].replace(/['"]/g, ''));
            if (captions.anim) bits.push(String(captions.anim));
            if (captions.color) bits.push(String(captions.color));
            if (captions.y_pct != null) bits.push(`y${Math.round(Number(captions.y_pct) * 100)}`);
        }
        if (!bits.length && styles && typeof styles === 'object') {
            const keys = Object.keys(styles);
            if (keys.length) {
                const sample = styles[keys[0]] || {};
                if (sample.font) bits.push(String(sample.font).split(',')[0].replace(/['"]/g, ''));
                if (sample.font_size) bits.push(`${sample.font_size}px`);
                if (Array.isArray(sample.color) && sample.color.length >= 3) {
                    bits.push(`rgb(${sample.color.slice(0, 3).join(',')})`);
                }
            }
        }
        if (bits.length) return bits.slice(0, 4).join(' · ');
        if (styles && Object.keys(styles).length) {
            return `${Object.keys(styles).length} saved style${Object.keys(styles).length === 1 ? '' : 's'}`;
        }
        return 'Previous styles';
    }

    function collectLiveLayout(templateId) {
        const tid = String(templateId || currentTemplateId || '').toLowerCase();
        if (tid && tid !== 'splitscreen' && !tid.includes('split')) return null;
        try {
            if (typeof window.getSplitscreenConfig === 'function') {
                const cfg = window.getSplitscreenConfig();
                if (cfg && typeof cfg === 'object') return { ...cfg };
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    function layoutDiffers(a, b) {
        return fingerprint(null, null, a) !== fingerprint(null, null, b);
    }

    function layoutLabel(layout) {
        if (!layout) return 'saved layout';
        const t = String(layout.splitscreen_secondary_type || '');
        if (t === 'face_track') return 'Reframe';
        if (t === 'blank') return 'Black canvas';
        if (t === 'blank_blur') return 'Blur canvas';
        if (t === 'gameplay') return 'Gameplay fill';
        const r = Number(layout.splitscreen_content_ratio);
        if (Number.isFinite(r)) return `split ${Math.round(r * 100)}%`;
        return 'saved layout';
    }

    function hardenAgainstCopy(root) {
        try {
            if (window.__SolisSG?.harden) {
                window.__SolisSG.harden(root);
                return;
            }
        } catch (_) { /* fall through */ }
        if (!root || root.dataset.copyHardened === '1') return;
        root.dataset.copyHardened = '1';
        root.setAttribute('draggable', 'false');
        const block = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        root.addEventListener('copy', block, true);
        root.addEventListener('cut', block, true);
        root.addEventListener('contextmenu', block, true);
        root.addEventListener('dragstart', block, true);
        root.addEventListener('selectstart', block, true);
    }

    function setProtectedLabel(el, text) {
        try {
            if (window.__SolisSG?.shieldLabel) {
                window.__SolisSG.shieldLabel(el, text);
                return;
            }
        } catch (_) { /* fall through */ }
        if (!el) return;
        const label = String(text || '');
        el.textContent = '';
        el.setAttribute('aria-label', label);
        el.classList.add('solis-nocopy');
        for (let i = 0; i < label.length; i++) {
            const span = document.createElement('span');
            span.textContent = label[i];
            span.setAttribute('aria-hidden', 'true');
            el.appendChild(span);
            if (i < label.length - 1) {
                el.appendChild(document.createTextNode('\u200B'));
            }
        }
    }

    function smarterCaptions(captions, templateId) {
        if (!captions || typeof captions !== 'object') return captions;
        const out = { ...captions };
        const font = String(out.font || '').replace(/['"]/g, '').split(',')[0].trim();
        const hint = fontAnimHint(font);
        if (hint && (!out.anim || out.anim === 'center' || out.anim === 'skew' || out.anim === 'slide')) {
            out.anim = hint;
        }
        if (out.anim === 'center') out.anim = 'fade';
        const animKey = String(out.anim || '').toLowerCase();
        const colorHint = ANIM_COLOR_HINT[animKey];
        if (colorHint) {
            if (!out.color) out.color = colorHint.color;
            if (!('fill' in out) && colorHint.fill) out.fill = colorHint.fill;
        }
        if (!out.font_size || out.font_size < 28) out.font_size = out.font_size || 68;
        if (out.y_pct == null || !Number.isFinite(Number(out.y_pct))) {
            out.y_pct = 0.55;
        } else {
            out.y_pct = Math.max(0.02, Math.min(0.98, Number(out.y_pct)));
        }
        if (!out.shadow) out.shadow = 'outline';
        return out;
    }

    function isEnabled() {
        return !!readState().enabled;
    }

    function setEnabled(on) {
        const s = readState();
        s.enabled = !!on;
        writeState(s);
        syncSettingsUI();
    }

    function isSuggestEnabled() {
        const s = readState();
        return !!s.enabled && !!s.suggestEnabled;
    }

    function setSuggestEnabled(on) {
        const s = readState();
        s.suggestEnabled = !!on;
        writeState(s);
        syncSettingsUI();
    }

    function getTemplateMemory(templateId) {
        if (!templateId) return null;
        const s = readState();
        const raw = s.templates[templateId] || null;
        if (!raw) return null;
        const clean = sanitizeForTemplate(templateId, {
            styles: raw.styles,
            captions: raw.captions,
            layout: raw.layout,
        });
        return {
            ...raw,
            styles: clean.styles,
            captions: clean.captions,
            layout: clean.layout,
            fingerprint: fingerprint(clean.styles, clean.captions, clean.layout) || raw.fingerprint,
        };
    }

    function listMemories() {
        const s = readState();
        return Object.entries(s.templates).map(([id, mem]) => ({
            templateId: id,
            updatedAt: mem.updatedAt,
            summary: summarizeStyles(mem.styles, mem.captions, mem.layout),
            fingerprint: mem.fingerprint,
            hasCaptions: !!(mem.captions && Object.keys(mem.captions).length),
            hasLayout: layoutUseful(mem.layout),
        })).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    }

    function collectLiveStyles(templateId) {
        if (!isRankingTemplate(templateId)) return null;
        try {
            if (window.rankingCustomizer && typeof window.rankingCustomizer.collectCustomizations === 'function') {
                if (typeof window.rankingCustomizer.syncFromDOM === 'function') {
                    window.rankingCustomizer.syncFromDOM();
                }
                const c = window.rankingCustomizer.collectCustomizations();
                if (c && Object.keys(c).length) return c;
            }
        } catch (_) { /* ignore */ }
        try {
            if (window.customizer && typeof window.customizer.collectCustomizations === 'function') {
                const c = window.customizer.collectCustomizations();
                if (c && Object.keys(c).length) return c;
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    function collectLiveCaptions(templateId, { allowSnap = false } = {}) {
        try {
            if (typeof window.collectSubtitleStyle === 'function') {
                const live = window.collectSubtitleStyle();
                if (live && typeof live === 'object') {
                    if (templateId) rememberCaptionSnap(templateId, live);
                    return live;
                }
            }
        } catch (_) { /* ignore */ }
        if (allowSnap) return recallCaptionSnap(templateId || currentTemplateId);
        return null;
    }

    function applyStyles(templateId, styles) {
        if (!styles || typeof styles !== 'object') return false;
        if (!isRankingTemplate(templateId)) return false;
        try {
            if (window.rankingCustomizer) {
                window.SolisMemory._applying = true;
                const incoming = JSON.parse(JSON.stringify(styles));
                const prev = window.rankingCustomizer.customizations || {};
                const prevFonts = typeof window.rankingCustomizer.countFonts === 'function'
                    ? window.rankingCustomizer.countFonts(prev)
                    : 0;
                const nextFonts = typeof window.rankingCustomizer.countFonts === 'function'
                    ? window.rankingCustomizer.countFonts(incoming)
                    : 0;
                if (nextFonts === 0 && prevFonts > 0) {
                    const merged = { ...prev };
                    Object.entries(incoming).forEach(([k, v]) => {
                        if (k === '__ranking_layout') {
                            merged[k] = v;
                            return;
                        }
                        if (!v || typeof v !== 'object') {
                            if (v != null) merged[k] = v;
                            return;
                        }
                        merged[k] = { ...(merged[k] || {}), ...v };
                        if (prev[k]?.font && !merged[k].font) merged[k].font = prev[k].font;
                    });
                    window.rankingCustomizer.customizations = merged;
                } else {
                    const merged = { ...prev };
                    Object.entries(incoming).forEach(([k, v]) => {
                        if (v && typeof v === 'object' && !Array.isArray(v)) {
                            merged[k] = { ...(merged[k] || {}), ...v };
                        } else if (v != null) {
                            merged[k] = v;
                        }
                    });
                    window.rankingCustomizer.customizations = merged;
                }
                if (typeof window.rankingCustomizer.saveCustomizations === 'function') {
                    window.rankingCustomizer.saveCustomizations();
                }
                if (typeof window.rankingCustomizer.applyCustomizations === 'function') {
                    window.rankingCustomizer.applyCustomizations();
                }
                window.SolisMemory._applying = false;
                return true;
            }
        } catch (_) {
            if (window.SolisMemory) window.SolisMemory._applying = false;
        }
        return false;
    }

    function applyCaptions(captions, templateId) {
        if (!captions || typeof captions !== 'object') return false;
        try {
            window.SolisMemory._applying = true;
            const smart = smarterCaptions(captions, templateId);
            if (typeof window.applySubtitleStyle === 'function') {
                window.applySubtitleStyle(smart, {
                    fromMemory: true,
                    selectAfter: false,
                    playAnim: true,
                    applyFill: true,
                });
                try {
                    if (typeof window.collectSubtitleStyle === 'function') {
                        const live = window.collectSubtitleStyle();
                        if (live && templateId) rememberCaptionSnap(templateId, live);
                        else if (templateId) rememberCaptionSnap(templateId, smart);
                    } else if (templateId) {
                        rememberCaptionSnap(templateId, smart);
                    }
                } catch (_) { /* ignore */ }
                window.SolisMemory._applying = false;
                return true;
            }
            window.SolisMemory._applying = false;
        } catch (_) {
            if (window.SolisMemory) window.SolisMemory._applying = false;
        }
        return false;
    }

    function upsertTemplateMemory(templateId, { styles, captions, layout, source } = {}) {
        if (!templateId || !isEnabled()) return;
        const s = readState();
        const prev = s.templates[templateId] || {};
        const profile = templateMemoryProfile(templateId);

        let nextStyles = styles !== undefined ? styles : (prev.styles || null);
        let nextCaptions = captions !== undefined ? captions : (prev.captions || null);
        let nextLayout = layout !== undefined
            ? mergeLayouts(prev.layout, layout)
            : (prev.layout || null);

        if (!profile.styles) nextStyles = null;
        if (!profile.layout) nextLayout = null;
        if (!profile.captions) nextCaptions = null;
        if (nextStyles && !(typeof nextStyles === 'object' && Object.keys(nextStyles).length)) nextStyles = null;
        if (nextCaptions && !(typeof nextCaptions === 'object' && Object.keys(nextCaptions).length)) nextCaptions = null;
        if (nextLayout && !layoutUseful(nextLayout)) nextLayout = null;

        if (
            !(nextStyles && Object.keys(nextStyles).length) &&
            !(nextCaptions && Object.keys(nextCaptions).length) &&
            !layoutUseful(nextLayout)
        ) {
            return;
        }
        const fp = fingerprint(nextStyles, nextCaptions, nextLayout);
        s.templates[templateId] = {
            updatedAt: new Date().toISOString(),
            styles: nextStyles ? JSON.parse(JSON.stringify(nextStyles)) : null,
            captions: nextCaptions ? JSON.parse(JSON.stringify(nextCaptions)) : null,
            lastGeneratedCaptions: prev.lastGeneratedCaptions
                ? JSON.parse(JSON.stringify(prev.lastGeneratedCaptions))
                : null,
            lastGeneratedStyles: prev.lastGeneratedStyles
                ? JSON.parse(JSON.stringify(prev.lastGeneratedStyles))
                : null,
            layout: nextLayout ? JSON.parse(JSON.stringify(nextLayout)) : null,
            fingerprint: fp,
            rejectCount: prev.rejectCount || 0,
            lastRejectedFingerprint: prev.fingerprint === fp ? (prev.lastRejectedFingerprint || null) : null,
            lastSuggestedAt: prev.fingerprint === fp ? prev.lastSuggestedAt : null,
            source: source || prev.source || 'edit',
        };
        if (nextCaptions) rememberCaptionSnap(templateId, nextCaptions);
        writeState(s, { sync: false });
        syncSettingsUI();
    }

    function recordFromGeneration(templateId, stylesOverride, captionsOverride, layoutOverride) {
        if (!templateId || !isEnabled()) return;
        const profile = templateMemoryProfile(templateId);
        const s = readState();
        const prev = s.templates[templateId] || {};

        let styles = profile.styles ? (stylesOverride || collectLiveStyles(templateId)) : null;
        let captions = profile.captions
            ? (captionsOverride || collectLiveCaptions(templateId, { allowSnap: true }))
            : null;
        let layout = profile.layout
            ? mergeLayouts(prev.layout, layoutOverride || collectLiveLayout(templateId))
            : null;

        if (profile.captions && (!captions || !Object.keys(captions).length)) {
            captions = recallCaptionSnap(templateId);
        }

        const clean = sanitizeForTemplate(templateId, { styles, captions, layout });
        styles = clean.styles;
        captions = clean.captions;
        layout = clean.layout;
        if (profile.layout && !layout && layoutUseful(prev.layout)) {
            layout = normalizeLayout(prev.layout);
        }

        if (
            !(styles && Object.keys(styles).length) &&
            !(captions && Object.keys(captions).length) &&
            !layoutUseful(layout)
        ) {
            return;
        }

        const fp = fingerprint(styles, captions, layout);
        const sameFp = prev.fingerprint === fp;
        s.templates[templateId] = {
            updatedAt: new Date().toISOString(),
            styles: styles ? JSON.parse(JSON.stringify(styles)) : null,
            captions: captions ? JSON.parse(JSON.stringify(captions)) : null,
            lastGeneratedCaptions: captions
                ? JSON.parse(JSON.stringify(captions))
                : (prev.lastGeneratedCaptions || null),
            lastGeneratedStyles: styles
                ? JSON.parse(JSON.stringify(styles))
                : (prev.lastGeneratedStyles || null),
            layout: layout ? JSON.parse(JSON.stringify(layout)) : null,
            fingerprint: fp,
            rejectCount: sameFp ? (prev.rejectCount || 0) : 0,
            lastRejectedFingerprint: sameFp ? (prev.lastRejectedFingerprint || null) : null,
            lastRejectedAt: sameFp ? (prev.lastRejectedAt || null) : null,
            lastSuggestedAt: sameFp ? prev.lastSuggestedAt : null,
            source: 'generate',
        };
        s.usageLog.unshift({
            templateId,
            at: new Date().toISOString(),
            fingerprint: fp,
        });
        s.usageLog = s.usageLog.slice(0, USAGE_LOG_MAX);
        if (captions) rememberCaptionSnap(templateId, captions);
        writeState(s, { sync: true });
        sessionBurst = 0;
        sessionRejected.delete(templateId);
        syncSettingsUI();
    }

    function recordLayout(templateId, layoutOverride) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid || !isSplitscreenTemplate(tid)) return;
        const layout = layoutOverride || collectLiveLayout(tid);
        if (!layoutUseful(layout)) return;
        upsertTemplateMemory(tid, { layout, source: 'layout' });
    }

    function recordCaptions(templateId, captionsOverride) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid) return;
        const captions = captionsOverride || collectLiveCaptions(tid);
        if (!captions || !Object.keys(captions).length) return;
        upsertTemplateMemory(tid, { captions, source: 'caption' });
    }

    function noteEdit(templateId) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid) return;
        sessionBurst += 1;
        currentTemplateId = tid;
    }

    function scheduleSuggest(templateId) {
        if (suggestTimer) {
            clearTimeout(suggestTimer);
            suggestTimer = null;
        }
        if (!templateId || !shouldSuggest(templateId)) {
            flushDeferredRankingCustoms();
            return;
        }
        const jitter = 40 + Math.floor(Math.random() * 80);
        suggestTimer = setTimeout(() => {
            suggestTimer = null;
            const modal = document.getElementById('templatePreviewModal');
            if (!modal || !modal.classList.contains('active')) return;
            if (!shouldSuggest(templateId)) {
                flushDeferredRankingCustoms();
                return;
            }
            showSuggestion(templateId);
        }, SUGGEST_DELAY_MS + jitter);
    }

    function captionsDiffer(a, b) {
        return fingerprint(null, a) !== fingerprint(null, b);
    }

    function shouldSuggest(templateId) {
        if (!isSuggestEnabled() || !templateId) return false;
        if (suggestShownForOpen) return false;
        if (sessionRejected.has(templateId)) return false;
        const mem = getTemplateMemory(templateId);
        if (!mem) return false;
        const suggestStyles = stylesForSuggest(mem);
        const hasStyles = !!(suggestStyles && Object.keys(suggestStyles).length);
        const suggestCaps = captionsForSuggest(mem);
        const hasCaps = !!(suggestCaps && Object.keys(suggestCaps).length);
        const hasLayout = layoutUseful(mem.layout);
        if (!hasStyles && !hasCaps && !hasLayout) return false;

        if (mem.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) {
            const rejectedAt = Date.parse(mem.lastRejectedAt || 0);
            if (Number.isFinite(rejectedAt) && Date.now() - rejectedAt < REJECT_COOLDOWN_MS) return false;
            if (!Number.isFinite(rejectedAt) || Date.now() - rejectedAt >= REJECT_COOLDOWN_MS) {
                try {
                    const s = readState();
                    if (s.templates[templateId]) {
                        s.templates[templateId].lastRejectedFingerprint = null;
                        s.templates[templateId].lastRejectedAt = null;
                        writeState(s);
                    }
                } catch (_) { /* ignore */ }
            }
        }

        if (isLibraryPreviewOpen() && !hasLayout) return false;

        const liveStyles = collectLiveStyles(templateId);
        const liveCaps = collectLiveCaptions(templateId);
        const liveLayout = collectLiveLayout(templateId);
        const hasLiveCaps = !!(liveCaps && Object.keys(liveCaps).length);
        const hasLiveStyles = !!(liveStyles && Object.keys(liveStyles).length);
        const profile = templateMemoryProfile(templateId);
        const usefulCaps = hasCaps && profile.captions && !isLibraryPreviewOpen();
        const usefulStyles = hasStyles && profile.styles;
        const usefulLayout = hasLayout && profile.layout;
        if (!usefulCaps && !usefulStyles && !usefulLayout) return false;

        const offeredAt = Date.parse(mem.lastSuggestedAt || 0);
        if (Number.isFinite(offeredAt)) {
            const offerCd = isRankingTemplate(templateId) ? RANKING_OFFER_COOLDOWN_MS : OFFER_COOLDOWN_MS;
            if (Date.now() - offeredAt < offerCd) {
                const layoutStillDiffers = usefulLayout && layoutDiffers(mem.layout, liveLayout);
                if (!layoutStillDiffers) return false;
            }
        }

        if (usefulLayout && layoutDiffers(mem.layout, liveLayout)) return true;
        if (usefulStyles && isRankingTemplate(templateId)) {
            if (window.__solisRankingDeferCustoms) return true;
            const want = stylesForSuggest(mem);
            if (fingerprint(liveStyles, null) !== fingerprint(want, null)) return true;
        }
        if (usefulCaps && !hasLiveCaps) return true;
        if (usefulStyles && !hasLiveStyles && !hasLiveCaps) return true;

        const smartCaps = smarterCaptions(suggestCaps, templateId);
        const sameLive = fingerprint(liveStyles, liveCaps, liveLayout) === mem.fingerprint;
        const sameSmart = !smartCaps || fingerprint(null, liveCaps) === fingerprint(null, smartCaps);
        if (sameLive && sameSmart) return false;

        return true;
    }

    function flushDeferredRankingCustoms() {
        if (!window.__solisRankingDeferCustoms) return;
        window.__solisRankingDeferCustoms = false;
        try {
            const tid = currentTemplateId || 'ranked_compilation';
            const mem = getTemplateMemory(tid);
            const want = stylesForSuggest(mem);
            if (want && Object.keys(want).length && isRankingTemplate(tid)) {
                applyStyles(tid, want);
                return;
            }
            if (window.rankingCustomizer && typeof window.rankingCustomizer.applyCustomizations === 'function') {
                window.rankingCustomizer.applyCustomizations();
            }
        } catch (_) { /* ignore */ }
    }

    function ensureSuggestEl() {
        let el = document.getElementById('solisMemorySuggest');
        const needsRebuild = !el
            || !el.querySelector('[data-mem-act="accept"]')
            || !el.querySelector('[data-mem-act="reject"]');
        if (el && !needsRebuild) {
            hardenAgainstCopy(el);
            return el;
        }
        if (el && needsRebuild) {
            try { el.remove(); } catch (_) { /* ignore */ }
            el = null;
        }
        el = document.createElement('div');
        el.id = 'solisMemorySuggest';
        el.className = 'solis-memory-suggest solis-nocopy';
        el.hidden = true;
        el.innerHTML = `
            <button type="button" class="solis-memory-suggest-btn solis-memory-suggest-btn--ghost solis-nocopy" data-mem-act="reject" title="Dismiss" aria-label="Dismiss">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>
                </svg>
            </button>
            <span id="solisMemorySuggestTitle" class="solis-memory-suggest-label solis-nocopy"></span>
            <button type="button" class="solis-memory-suggest-btn solis-memory-suggest-btn--primary solis-nocopy" data-mem-act="accept" title="Apply · Tab" aria-label="Apply">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <span id="solisMemorySuggestSub" hidden></span>
        `;
        el.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('[data-mem-act]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const act = btn.getAttribute('data-mem-act');
            if (act === 'accept') acceptSuggestion();
            else if (act === 'reject') rejectSuggestion();
        });
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-mem-act]')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        document.body.appendChild(el);
        hardenAgainstCopy(el);
        return el;
    }

    function revealSuggestEl(el) {
        if (!el) return;
        el.hidden = false;
        el.removeAttribute('hidden');
        el.classList.add('open');
        el.style.display = 'flex';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = '99999';
    }

    function placeSuggestNearPreview() {
        const el = ensureSuggestEl();
        const preview = document.getElementById('templateVideoPreview');
        const host = preview || null;
        revealSuggestEl(el);
        const aw = el.offsetWidth || 64;
        const ah = el.offsetHeight || 34;
        if (!host) {
            el.style.left = `${Math.max(12, window.innerWidth - aw - 16)}px`;
            el.style.top = '16px';
            el.style.transform = 'none';
            return;
        }
        const rect = host.getBoundingClientRect();
        let left = Math.round(rect.right - aw - 6);
        let top = Math.round(rect.top + 8);
        left = Math.min(window.innerWidth - aw - 8, Math.max(8, left));
        top = Math.min(window.innerHeight - ah - 8, Math.max(8, top));
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.transform = 'none';
    }

    function hideSuggest() {
        const el = document.getElementById('solisMemorySuggest');
        if (el) {
            el.hidden = true;
            el.setAttribute('hidden', '');
            el.classList.remove('open');
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.style.display = '';
        }
        try {
            if (typeof window.clearSplitscreenMemorySuggestChrome === 'function') {
                window.clearSplitscreenMemorySuggestChrome();
            }
        } catch (_) { /* ignore */ }
        try {
            if (window.RankingTextPill && typeof window.RankingTextPill.clearSuggest === 'function') {
                window.RankingTextPill.clearSuggest();
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof window.clearSubtitleMemorySuggest === 'function') {
                window.clearSubtitleMemorySuggest();
            } else {
                document.querySelectorAll('.rk-ghost-stack,.sub-mem-ghost').forEach((n) => n.remove());
                const subActs = document.getElementById('subMemActions');
                if (subActs) {
                    subActs.classList.remove('open');
                    subActs.style.visibility = 'hidden';
                    subActs.style.opacity = '0';
                    subActs.style.pointerEvents = 'none';
                }
            }
            const rkActs = document.getElementById('rkSuggestActions');
            if (rkActs) {
                rkActs.classList.remove('open');
                rkActs.style.visibility = 'hidden';
                rkActs.style.opacity = '0';
                rkActs.style.pointerEvents = 'none';
            }
        } catch (_) { /* ignore */ }
    }

    function wantsLayoutSuggest(templateId, mem) {
        mem = mem || getTemplateMemory(templateId);
        if (!layoutUseful(mem?.layout)) return false;
        if (!isSplitscreenTemplate(templateId)) return false;
        const live = collectLiveLayout(templateId);
        return layoutDiffers(mem.layout, live);
    }

    function captionsForSuggest(mem) {
        if (!mem || typeof mem !== 'object') return null;
        const gen = mem.lastGeneratedCaptions;
        if (gen && typeof gen === 'object' && Object.keys(gen).length) return gen;
        const caps = mem.captions;
        if (caps && typeof caps === 'object' && Object.keys(caps).length) return caps;
        return null;
    }

    function stylesForSuggest(mem) {
        if (!mem || typeof mem !== 'object') return null;
        const gen = mem.lastGeneratedStyles;
        if (gen && typeof gen === 'object' && Object.keys(gen).length) return gen;
        if (mem.source === 'generate' && mem.styles && Object.keys(mem.styles).length) {
            return mem.styles;
        }
        const styles = mem.styles;
        if (styles && typeof styles === 'object' && Object.keys(styles).length) return styles;
        return null;
    }

    function isLibraryPreviewOpen() {
        try {
            return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
        } catch (_) {
            return false;
        }
    }

    function offerCaptionSuggest(templateId, mem) {
        if (isRankingTemplate(templateId)) return false;
        if (isLibraryPreviewOpen()) return false;
        mem = mem || getTemplateMemory(templateId);
        const baseCaps = captionsForSuggest(mem);
        let smartCaps = smarterCaptions(baseCaps, templateId);
        if (!smartCaps) {
            smartCaps = smarterCaptions({
                anim: 'karaoke',
                font: 'Montserrat',
                color: '#ffffff',
                highlight: '#FFFFFF',
                shadow: 'outline',
                font_size: 96,
                font_size_ratio: 0.058,
                y_pct: 0.55,
                enabled: true,
            }, templateId);
        }
        if (!smartCaps || typeof window.offerSubtitleMemorySuggest !== 'function') return false;
        const liveCaps = collectLiveCaptions(templateId);
        const hasLiveCaps = !!(liveCaps && Object.keys(liveCaps).length);
        if (hasLiveCaps && !captionsDiffer(smartCaps, liveCaps)) return false;
        window.offerSubtitleMemorySuggest(smartCaps, templateId);
        return !!document.getElementById('subMemActions')?.classList.contains('open')
            || !!document.querySelector('.sub-mem-ghost');
    }

    function showSuggestion(templateId) {
        if (!shouldSuggest(templateId)) return;
        const mem = getTemplateMemory(templateId);
        if (!mem) return;

        let offered = false;

        if (isSplitscreenTemplate(templateId)) {
            if (wantsLayoutSuggest(templateId, mem)) {
                offered = offerLayoutSuggest(templateId, mem);
            }
            if (!offered) {
                offered = offerCaptionSuggest(templateId, mem);
            }
        } else if (isRankingTemplate(templateId)) {
            const want = stylesForSuggest(mem);
            if (want && Object.keys(want).length) {
                offered = !!offerRankingStylesSuggest(templateId, mem);
            }
        } else {
            offered = offerCaptionSuggest(templateId, mem);
        }

        if (!offered) {
            flushDeferredRankingCustoms();
            return;
        }
        const solisEl = document.getElementById('solisMemorySuggest');
        const solisVisible = !!(solisEl && !solisEl.hidden && solisEl.classList.contains('open'));
        const subVisible = !!document.getElementById('subMemActions')?.classList.contains('open')
            || !!document.querySelector('.sub-mem-ghost');
        if (!solisVisible && !subVisible && isRankingTemplate(templateId)) {
            flushDeferredRankingCustoms();
            return;
        }
        suggestShownForOpen = true;

        const s = readState();
        if (s.templates[templateId]) {
            s.templates[templateId].lastSuggestedAt = new Date().toISOString();
            writeState(s);
        }
    }

    function offerLayoutSuggest(templateId, mem) {
        mem = mem || getTemplateMemory(templateId);
        if (!wantsLayoutSuggest(templateId, mem)) return false;
        if (typeof window.offerSplitscreenMemorySuggest !== 'function') return false;
        const opened = window.offerSplitscreenMemorySuggest(mem.layout, templateId);
        if (!opened) return false;

        const el = ensureSuggestEl();
        const title = el.querySelector('#solisMemorySuggestTitle');
        if (title) {
            title.hidden = true;
            title.textContent = '';
        }
        const sub = el.querySelector('#solisMemorySuggestSub');
        if (sub) sub.textContent = '';
        el.dataset.templateId = templateId;
        el.dataset.mode = 'layout-only';
        placeSuggestNearPreview();
        revealSuggestEl(el);
        return true;
    }

    function offerRankingStylesSuggest(templateId, mem) {
        if (!isRankingTemplate(templateId)) return false;
        mem = mem || getTemplateMemory(templateId);
        const want = stylesForSuggest(mem);
        if (!want || !Object.keys(want).length) return false;
        const styleKeys = Object.keys(want).filter((k) => k !== '__ranking_layout');
        const hasVisibleStyle = styleKeys.some((k) => {
            const n = want[k];
            return n && typeof n === 'object' && (n.font || n.font_size || n.color);
        });
        if (!hasVisibleStyle) return false;
        const liveStyles = collectLiveStyles(templateId);
        const deferred = !!window.__solisRankingDeferCustoms;
        if (!deferred && fingerprint(liveStyles, null) === fingerprint(want, null)) return false;

        try {
            if (window.RankingTextPill) {
                if (typeof window.RankingTextPill.hide === 'function') window.RankingTextPill.hide();
                if (typeof window.RankingTextPill.clearSuggest === 'function') window.RankingTextPill.clearSuggest();
            }
            document.getElementById('subPillMenu')?.classList.remove('active');
        } catch (_) { /* ignore */ }

        window.__solisRankingDeferCustoms = false;

        const el = ensureSuggestEl();
        const title = el.querySelector('#solisMemorySuggestTitle');
        if (title) {
            title.hidden = false;
            title.removeAttribute('hidden');
            title.textContent = 'Apply last ranking style?';
            title.style.display = '';
        }
        const sub = el.querySelector('#solisMemorySuggestSub');
        if (sub) sub.textContent = '';
        el.dataset.templateId = templateId;
        el.dataset.mode = 'styles-only';
        el.classList.add('solis-memory-suggest--ranking');
        try {
            el._solisMemStyles = JSON.parse(JSON.stringify(want));
        } catch (_) {
            el._solisMemStyles = want;
        }
        try {
            el._solisMemStylesBackup = liveStyles
                ? JSON.parse(JSON.stringify(liveStyles))
                : JSON.parse(JSON.stringify(window.rankingCustomizer?.customizations || {}));
            applyStyles(templateId, want);
            el._solisMemStylesPreviewed = true;
        } catch (_) {
            el._solisMemStylesPreviewed = false;
        }
        placeSuggestNearPreview();
        revealSuggestEl(el);
        return true;
    }

    function continueSuggestAfterCaption(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid || !isSuggestEnabled()) return;
        if (sessionRejected.has(tid)) return;
        const mem = getTemplateMemory(tid);
        if (!mem) return;
        if (mem.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) return;
        setTimeout(() => {
            const modal = document.getElementById('templatePreviewModal');
            if (!modal || !modal.classList.contains('active')) return;
            if (sessionRejected.has(tid)) return;
            if (!isSplitscreenTemplate(tid) && wantsLayoutSuggest(tid, mem) && offerLayoutSuggest(tid, mem)) return;
            offerRankingStylesSuggest(tid, mem);
        }, 180);
    }

    function continueSuggestAfterLayout(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid || !isSuggestEnabled()) return;
        if (sessionRejected.has(tid)) return;
        const mem = getTemplateMemory(tid);
        if (!mem) return;
        setTimeout(() => {
            const modal = document.getElementById('templatePreviewModal');
            if (!modal || !modal.classList.contains('active')) return;
            if (sessionRejected.has(tid)) return;
            if (!isRankingTemplate(tid) && offerCaptionSuggest(tid, mem)) {
                suggestShownForOpen = true;
                return;
            }
            offerRankingStylesSuggest(tid, mem);
            if (document.getElementById('solisMemorySuggest')
                && !document.getElementById('solisMemorySuggest').hidden) {
                suggestShownForOpen = true;
            }
        }, 160);
    }

    function acceptSuggestion() {
        const el = ensureSuggestEl();
        const templateId = el.dataset.templateId || currentTemplateId;
        const mode = el.dataset.mode || 'all';
        hideSuggest();
        if (templateId) sessionRejected.delete(templateId);
        const mem = getTemplateMemory(templateId);
        if (!mem) return;

        if (mode === 'layout-only') {
            try {
                if (window.SolisMemory) window.SolisMemory._applying = true;
                if (typeof window.applySplitscreenMemoryLayout === 'function' && mem.layout) {
                    window.applySplitscreenMemoryLayout(mem.layout, { commit: true });
                }
            } catch (_) { /* ignore */ }
            finally {
                if (window.SolisMemory) window.SolisMemory._applying = false;
            }
            const s = readState();
            if (s.templates[templateId]) {
                s.templates[templateId].lastAcceptedAt = new Date().toISOString();
                s.templates[templateId].lastRejectedFingerprint = null;
                writeState(s);
            }
            sessionBurst = 0;
            suggestShownForOpen = false;
            try {
                document.querySelectorAll('.gp-mem-pick').forEach((el) => el.classList.remove('gp-mem-pick'));
                document.getElementById('subPillMenu')?.classList.remove('active');
                if (typeof window.hideGameplayPillMenu === 'function') window.hideGameplayPillMenu();
                else if (typeof hideGameplayPillMenu === 'function') hideGameplayPillMenu();
            } catch (_) { /* ignore */ }
            continueSuggestAfterLayout(templateId);
            return;
        }

        if (mode === 'styles-only') {
            const stylePayload = el._solisMemStyles || stylesForSuggest(mem);
            if (stylePayload && Object.keys(stylePayload).length) {
                window.__solisRankingDeferCustoms = false;
                applyStyles(templateId, stylePayload);
            }
        } else {
            if (mem.captions) applyCaptions(mem.captions, templateId);
            if (mem.layout && typeof window.applySplitscreenMemoryLayout === 'function') {
                try { window.applySplitscreenMemoryLayout(mem.layout, { commit: true }); } catch (_) { /* ignore */ }
            }
            const stylePayload = stylesForSuggest(mem);
            if (stylePayload && Object.keys(stylePayload).length) {
                window.__solisRankingDeferCustoms = false;
                applyStyles(templateId, stylePayload);
            }
        }
        try {
            delete el._solisMemStyles;
            delete el._solisMemStylesBackup;
            delete el._solisMemStylesPreviewed;
            el.classList.remove('solis-memory-suggest--ranking');
        } catch (_) { /* ignore */ }
        const s = readState();
        if (s.templates[templateId]) {
            s.templates[templateId].lastAcceptedAt = new Date().toISOString();
            s.templates[templateId].lastRejectedFingerprint = null;
            writeState(s);
        }
        sessionBurst = 0;
        if (typeof window.clearSubtitleMemorySuggest === 'function') {
            window.clearSubtitleMemorySuggest();
        }
        try {
            document.getElementById('subPillMenu')?.classList.remove('active');
            document.querySelectorAll('#templateVideoPreview .sub-text-block.selected')
                .forEach((el) => el.classList.remove('selected'));
            if (window.RankingTextPill) {
                if (typeof window.RankingTextPill.clearSuggest === 'function') window.RankingTextPill.clearSuggest();
                if (typeof window.RankingTextPill.hide === 'function') window.RankingTextPill.hide();
                if (typeof window.RankingTextPill.deselectAll === 'function') window.RankingTextPill.deselectAll();
            }
        } catch (_) { /* ignore */ }
    }

    function rejectSuggestion() {
        const el = ensureSuggestEl();
        const templateId = el.dataset.templateId || currentTemplateId;
        const mode = el.dataset.mode || 'all';
        if (mode === 'layout-only') {
            try {
                if (typeof window.revertSplitscreenMemorySuggestPreview === 'function') {
                    window.revertSplitscreenMemorySuggestPreview();
                }
            } catch (_) { /* ignore */ }
            try {
                if (typeof window.hideGameplayPillMenu === 'function') window.hideGameplayPillMenu();
            } catch (_) { /* ignore */ }
            hideSuggest();
            suggestShownForOpen = false;
            sessionBurst = 0;
            setTimeout(() => {
                if (!templateId || sessionRejected.has(templateId)) return;
                if (isRankingTemplate(templateId)) return;
                const mem = getTemplateMemory(templateId);
                if (!mem) return;
                if (offerCaptionSuggest(templateId, mem)) {
                    suggestShownForOpen = true;
                }
            }, 280);
            return;
        }
        hideSuggest();
        markSuggestionRejected(templateId);
        if (mode === 'styles-only' && el._solisMemStylesPreviewed && el._solisMemStylesBackup) {
            try {
                applyStyles(templateId, el._solisMemStylesBackup);
            } catch (_) { /* ignore */ }
        }
        try {
            delete el._solisMemStyles;
            delete el._solisMemStylesBackup;
            delete el._solisMemStylesPreviewed;
            el.classList.remove('solis-memory-suggest--ranking');
        } catch (_) { /* ignore */ }
        window.__solisRankingDeferCustoms = false;
        if (typeof window.clearSubtitleMemorySuggest === 'function') {
            window.clearSubtitleMemorySuggest({ cooldown: true, persistReject: true });
        }
    }

    function markSuggestionRejected(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid) return;
        sessionRejected.add(tid);
        suggestShownForOpen = true; // block further suggests this open
        sessionBurst = 0;
        if (suggestTimer) {
            clearTimeout(suggestTimer);
            suggestTimer = null;
        }
        const s = readState();
        const mem = s.templates[tid];
        if (mem) {
            mem.rejectCount = (mem.rejectCount || 0) + 1;
            mem.lastRejectedFingerprint = mem.fingerprint
                || fingerprint(mem.styles, mem.captions, mem.layout);
            mem.lastRejectedAt = new Date().toISOString();
            writeState(s);
        }
    }

    function scheduleServerSync() {
        if (serverSyncTimer) clearTimeout(serverSyncTimer);
        serverSyncTimer = setTimeout(() => {
            serverSyncTimer = null;
            pushServerMemory();
        }, SERVER_SYNC_MS);
    }

    function apiUrl(path) {
        if (typeof window.apiUrl === 'function') return window.apiUrl(path);
        return path;
    }

    function authHeaders() {
        if (typeof getAuthHeaders === 'function') return getAuthHeaders();
        return { 'Content-Type': 'application/json' };
    }

    async function pushServerMemory() {
        try {
            const memory = readState();
            const res = await fetch(apiUrl('/api/clips/memory'), {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
                body: JSON.stringify({ action: 'save', memory }),
            });
            if (!res.ok) {
                console.warn('[SolisMemory] server save failed:', res.status);
            }
        } catch (_) { /* offline / guest — local cache still works */ }
    }

    function _sanitizeRemoteTemplate(id, mem) {
        if (!mem || typeof mem !== 'object') return null;
        const clean = sanitizeForTemplate(id, {
            styles: mem.styles,
            captions: mem.captions,
            layout: mem.layout,
        });
        return {
            ...mem,
            styles: clean.styles,
            captions: clean.captions,
            layout: clean.layout,
            fingerprint: fingerprint(clean.styles, clean.captions, clean.layout),
        };
    }

    function mergeMemoryStates(local, remote) {
        const out = {
            ...defaultState(),
            ...local,
            enabled: local.enabled !== undefined ? local.enabled : remote.enabled,
            suggestEnabled: local.suggestEnabled !== undefined ? local.suggestEnabled : remote.suggestEnabled,
            templates: { ...(remote.templates || {}), ...(local.templates || {}) },
            usageLog: Array.isArray(local.usageLog) && local.usageLog.length
                ? local.usageLog
                : (Array.isArray(remote.usageLog) ? remote.usageLog : []),
        };
        const remoteT = remote.templates || {};
        Object.keys(remoteT).forEach((id) => {
            const L = out.templates[id];
            const R = _sanitizeRemoteTemplate(id, remoteT[id]);
            if (!L) {
                if (R) out.templates[id] = R;
                return;
            }
            if (!R) return;
            const lt = Date.parse(L.updatedAt || 0) || 0;
            const rt = Date.parse(R.updatedAt || 0) || 0;
            if (rt > lt) out.templates[id] = R;
            else if (rt === lt) {
                const merged = {
                    ...L,
                    captions: L.captions || R.captions || null,
                    styles: L.styles || R.styles || null,
                    layout: L.layout || R.layout || null,
                };
                out.templates[id] = _sanitizeRemoteTemplate(id, merged) || merged;
            } else {
                out.templates[id] = _sanitizeRemoteTemplate(id, L) || L;
            }
        });
        Object.keys(out.templates).forEach((id) => {
            out.templates[id] = _sanitizeRemoteTemplate(id, out.templates[id]) || out.templates[id];
        });
        return out;
    }

    async function pullServerMemory() {
        if (pullInFlight) return pullInFlight;
        pullInFlight = (async () => {
            try {
                const res = await fetch(apiUrl('/api/clips/memory'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: authHeaders(),
                    body: JSON.stringify({ action: 'get' }),
                });
                if (!res.ok) return;
                const data = await res.json();
                const remote = data?.memory;
                if (!remote || typeof remote !== 'object') return;
                const merged = mergeMemoryStates(readState(), remote);
                writeState(merged, { sync: false });
                serverHydrated = true;
                syncSettingsUI();
            } catch (_) { /* ignore */ }
            finally {
                pullInFlight = null;
            }
        })();
        return pullInFlight;
    }

    async function onTemplatePreviewOpen(templateId) {
        currentTemplateId = templateId || null;
        suggestShownForOpen = false;
        sessionBurst = 0;
        hideSuggest();
        try {
            sessionRejected.delete(templateId);
            const mem = getTemplateMemory(templateId);
            if (mem?.lastRejectedAt && mem?.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) {
                const rejectedAt = Date.parse(mem.lastRejectedAt);
                if (Number.isFinite(rejectedAt) && Date.now() - rejectedAt < REJECT_COOLDOWN_MS) {
                    sessionRejected.add(templateId);
                } else {
                    const s = readState();
                    if (s.templates[templateId]) {
                        s.templates[templateId].lastRejectedFingerprint = null;
                        s.templates[templateId].lastRejectedAt = null;
                        writeState(s);
                    }
                }
            }
        } catch (_) { /* ignore */ }
        scheduleSuggest(templateId);
        if (!serverHydrated) {
            pullServerMemory().then(() => {
                if (!suggestShownForOpen) scheduleSuggest(templateId);
            }).catch(() => {});
        }
        setTimeout(() => flushDeferredRankingCustoms(), SUGGEST_DELAY_MS + 400);
    }

    function onTemplatePreviewClose() {
        if (suggestTimer) {
            clearTimeout(suggestTimer);
            suggestTimer = null;
        }
        hideSuggest();
        suggestShownForOpen = false;
        try {
            if (currentTemplateId) {
                const profile = templateMemoryProfile(currentTemplateId);
                const caps = profile.captions ? collectLiveCaptions(currentTemplateId) : null;
                const styles = (profile.styles && !isRankingTemplate(currentTemplateId))
                    ? collectLiveStyles(currentTemplateId)
                    : undefined;
                upsertTemplateMemory(currentTemplateId, {
                    styles: styles || undefined,
                    captions: caps || undefined,
                    source: 'close',
                });
            }
        } catch (_) { /* ignore */ }
        if (typeof window.clearSubtitleMemorySuggest === 'function') {
            window.clearSubtitleMemorySuggest();
        }
        try {
            if (typeof window.revertSplitscreenMemorySuggestPreview === 'function') {
                window.revertSplitscreenMemorySuggestPreview();
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof window.clearSplitscreenMemorySuggestChrome === 'function') {
                window.clearSplitscreenMemorySuggestChrome();
            }
        } catch (_) { /* ignore */ }
        try {
            if (window.RankingTextPill && typeof window.RankingTextPill.clearSuggest === 'function') {
                window.RankingTextPill.clearSuggest();
            }
            if (window.RankingTextPill && typeof window.RankingTextPill.hide === 'function') {
                window.RankingTextPill.hide();
            }
            if (window.RankingTextPill && typeof window.RankingTextPill.deselectAll === 'function') {
                window.RankingTextPill.deselectAll();
            }
        } catch (_) { /* ignore */ }
        currentTemplateId = null;
    }

    function generateFromUsage() {
        const s = readState();
        let added = 0;
        try {
            const raw = localStorage.getItem('rankingCustomizations');
            if (raw) {
                const styles = JSON.parse(raw);
                if (styles && Object.keys(styles).length) {
                    const fp = fingerprint(styles, null, null);
                    s.templates.ranked_compilation = {
                        ...(s.templates.ranked_compilation || {}),
                        updatedAt: new Date().toISOString(),
                        styles,
                        captions: null,
                        layout: null,
                        fingerprint: fp,
                        rejectCount: 0,
                        lastRejectedFingerprint: null,
                        source: 'usage',
                    };
                    added += 1;
                }
            }
        } catch (_) { /* ignore */ }
        writeState(s);
        syncSettingsUI();
        return added;
    }

    function clearTemplate(templateId) {
        const s = readState();
        if (templateId) delete s.templates[templateId];
        writeState(s);
        syncSettingsUI();
    }

    async function clearAll() {
        const s = readState();
        s.templates = {};
        s.usageLog = [];
        writeState(s, { sync: false });
        syncSettingsUI();
        hideSuggest();
        try {
            await fetch(apiUrl('/api/clips/memory'), {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
                body: JSON.stringify({ action: 'clear' }),
            });
        } catch (_) { /* ignore */ }
    }

    function syncSettingsUI() {
        const s = readState();
        const en = document.getElementById('stgMemoryEnabledToggle');
        const sug = document.getElementById('stgMemorySuggestToggle');
        const enLabel = document.getElementById('stgMemoryEnabledLabel');
        const sugLabel = document.getElementById('stgMemorySuggestLabel');
        if (en) {
            en.classList.toggle('is-on', !!s.enabled);
            en.setAttribute('aria-checked', s.enabled ? 'true' : 'false');
        }
        if (enLabel) enLabel.textContent = s.enabled ? 'On' : 'Off';
        if (sug) {
            sug.classList.toggle('is-on', !!s.suggestEnabled);
            sug.setAttribute('aria-checked', s.suggestEnabled ? 'true' : 'false');
            sug.disabled = !s.enabled;
            sug.classList.toggle('is-disabled', !s.enabled);
        }
        if (sugLabel) sugLabel.textContent = s.suggestEnabled ? 'On' : 'Off';

        const privacyMem = document.getElementById('stgPrivacyMemoryToggle');
        if (privacyMem) {
            privacyMem.classList.toggle('is-on', !!s.enabled);
            privacyMem.setAttribute('aria-checked', s.enabled ? 'true' : 'false');
        }

        const list = document.getElementById('stgMemoryList');
        if (!list) return;
        const items = listMemories();
        if (!items.length) {
            list.innerHTML = `<p class="stgMemoryEmpty">No saved styles yet. Customize a preview and generate a clip. Memory will learn from that.</p>`;
            return;
        }
        list.innerHTML = items.map((m) => `
            <div class="stgMemoryItem" data-mem-id="${m.templateId}">
                <div class="stgMemoryItemBody">
                    <div class="stgMemoryItemTitle">${escapeHtml(prettyTemplateName(m.templateId))}${m.hasCaptions ? ' · Captions' : ''}${m.hasLayout ? ' · Layout' : ''}</div>
                    <div class="stgMemoryItemMeta">${escapeHtml(m.summary)}${m.updatedAt ? ` · ${formatRelative(m.updatedAt)}` : ''}</div>
                </div>
                <button type="button" class="stgMemoryClearOne" data-clear-mem="${m.templateId}" title="Clear">Clear</button>
            </div>
        `).join('');
    }

    function prettyTemplateName(id) {
        return String(id || 'template').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function formatRelative(iso) {
        try {
            const t = new Date(iso).getTime();
            const d = Date.now() - t;
            if (d < 60e3) return 'just now';
            if (d < 3600e3) return `${Math.floor(d / 60e3)}m ago`;
            if (d < 86400e3) return `${Math.floor(d / 3600e3)}h ago`;
            return `${Math.floor(d / 86400e3)}d ago`;
        } catch (_) {
            return '';
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function bindSettingsPanel() {
        const en = document.getElementById('stgMemoryEnabledToggle');
        const sug = document.getElementById('stgMemorySuggestToggle');
        const clearBtn = document.getElementById('stgMemoryClearAllBtn');
        const list = document.getElementById('stgMemoryList');

        en?.addEventListener('click', () => setEnabled(!isEnabled()));
        sug?.addEventListener('click', () => {
            if (!isEnabled()) return;
            setSuggestEnabled(!readState().suggestEnabled);
        });
        clearBtn?.addEventListener('click', () => {
            clearAll();
        });
        list?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-clear-mem]');
            if (!btn) return;
            clearTemplate(btn.getAttribute('data-clear-mem'));
        });
        syncSettingsUI();
        pullServerMemory();
    }

    window.SolisMemory = {
        recordFromGeneration,
        recordCaptions,
        recordLayout,
        noteEdit,
        onTemplatePreviewOpen,
        onTemplatePreviewClose,
        generateFromUsage,
        clearAll,
        clearTemplate,
        listMemories,
        isEnabled,
        setEnabled,
        isSuggestEnabled,
        syncSettingsUI,
        readState,
        getTemplateMemory,
        applyCaptions,
        smarterCaptions,
        continueSuggestAfterCaption,
        continueSuggestAfterLayout,
        pullServerMemory,
        markSuggestionRejected,
        rejectSuggestion,
        acceptSuggestion,
        rememberCaptionSnap,
        recallCaptionSnap,
        getCurrentTemplateId: () => currentTemplateId,
        isRankingTemplate,
        isSplitscreenTemplate,
        _applying: false,
    };

    document.addEventListener('keydown', (e) => {
        const el = document.getElementById('solisMemorySuggest');
        if (window.__solisPendingSubMem
            || document.querySelector('.sub-mem-ghost')
            || document.getElementById('subMemActions')?.classList.contains('open')) {
            return;
        }
        if (!el || el.hidden) return;
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            acceptSuggestion();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            rejectSuggestion();
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindSettingsPanel, { once: true });
    } else {
        bindSettingsPanel();
    }
})();
