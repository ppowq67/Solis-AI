/**
 * Solis Memory — remember template + subtitle styles per user.
 * Visual suggestion UI stays client-side; the JSON blob syncs lightly to the server
 * so prefs survive refresh / device hops without shipping suggestion logic in the payload.
 */
(function () {
    const STORAGE_KEY_BASE = 'solis_template_memory';
    const CAPTION_BY_TEMPLATE_KEY_BASE = 'solis_caption_by_template';
    const SESSION_DRAFT_KEY_BASE = 'solis_session_style_draft';
    const MEMORY_OWNER_KEY = 'solis_memory_owner_id';
    /** @deprecated global keys — cleared on account switch */
    const LEGACY_STORAGE_KEY = 'solis_template_memory';
    const LEGACY_CAPTION_KEY = 'solis_caption_by_template';
    const VERSION = 5;
    const SUGGEST_DELAY_MS = 900;
    const BURST_REOPEN_THRESHOLD = 999; // reject is sticky — don't reopen from edit bursts
    const USAGE_LOG_MAX = 40;
    const SERVER_SYNC_MS = 1200;
    /** After dismiss/reject — stay quiet briefly (was 12h; felt like “suggestions died”) */
    const REJECT_COOLDOWN_MS = 45 * 1000;
    /** After an offer was shown+ignored — short quiet, then allow again on reopen */
    const OFFER_COOLDOWN_MS = 18 * 1000;
    const RANKING_OFFER_COOLDOWN_MS = 20 * 1000;
    /** Session-only: templateIds the user dismissed this page load */
    const sessionRejected = new Set();

    function isRankingTemplate(templateId) {
        const id = String(templateId || '').toLowerCase();
        return id === 'ranked_compilation' || id === 'ranking' || id.includes('rank');
    }

    function isSplitscreenTemplate(templateId) {
        const id = String(templateId || '').toLowerCase();
        return id === 'splitscreen' || id.includes('split');
    }

    /** What this template is allowed to remember */
    function templateMemoryProfile(templateId) {
        if (isRankingTemplate(templateId)) {
            return {
                styles: true,
                layout: false,
                captions: false,
                rankingOverlay: true,
            };
        }
        return {
            styles: isRankingTemplate(templateId),
            layout: isSplitscreenTemplate(templateId),
            captions: !isRankingTemplate(templateId),
            rankingOverlay: false,
        };
    }

    function sanitizeRankingOverlay(captions) {
        if (!captions || typeof captions !== 'object') return null;
        const y = Number(captions.y_pct);
        if (!Number.isFinite(y)) return null;
        return {
            y_pct: Math.max(0.02, Math.min(0.98, y)),
            enabled: captions.enabled !== false,
        };
    }

    function rankingOverlayForSuggest(mem) {
        if (!mem || typeof mem !== 'object') return null;
        const raw = mem.lastGeneratedOverlay || mem.overlayPosition;
        return sanitizeRankingOverlay(raw);
    }

    function rankingOverlayDiffers(mem, templateId) {
        const want = rankingOverlayForSuggest(mem);
        if (!want) return false;
        const live = sanitizeRankingOverlay(collectLiveCaptions(templateId));
        if (!live) return true;
        return Math.abs(Number(want.y_pct) - Number(live.y_pct)) > 0.015;
    }

    /** Drop fields that belong to another template type (stops ranking↔splitscreen bleed) */
    function sanitizeForTemplate(templateId, { styles = null, captions = null, layout = null } = {}) {
        const profile = templateMemoryProfile(templateId);
        let capOut = null;
        if (profile.rankingOverlay) {
            capOut = sanitizeRankingOverlay(captions);
        } else if (profile.captions && captions && typeof captions === 'object' && Object.keys(captions).length) {
            capOut = captions;
        }
        return {
            styles: profile.styles && styles && typeof styles === 'object' && Object.keys(styles).length
                ? styles
                : null,
            captions: capOut,
            layout: profile.layout && layoutUseful(layout) ? normalizeLayout(layout) : null,
        };
    }

    /** Layout is useful with secondary type and/or a remembered divider ratio */
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
        // Soft adaptive clamp — keep extremes the user actually dragged (no 18–82 hardcap)
        if (Number.isFinite(r)) {
            out.splitscreen_content_ratio = Math.max(0.02, Math.min(0.98, r));
        }
        if (out.splitscreen_secondary_type) {
            out.splitscreen_secondary_type = String(out.splitscreen_secondary_type).toLowerCase();
        }
        return out;
    }

    /** After this many consecutive accepts of the same look → silent auto-apply next open.
     * Generate already turns auto-apply on; this re-earns it after a dismiss. */
    const AUTO_APPLY_STREAK = 1;

    /** Human labels for caption anim keys — used in suggestion hooks */
    const MEM_ANIM_LABEL = {
        karaoke: 'word-by-word',
        word: 'word-by-word',
        words: 'word-by-word',
        sentence: 'sentence',
        line: 'line-by-line',
        fade: 'fade',
        pop: 'pop',
        bounce: 'bounce',
        typewriter: 'typewriter',
        highlight: 'highlight',
        none: 'static',
        static: 'static',
        center: 'centered',
    };

    function memColorName(hex) {
        const h = String(hex || '').trim().replace(/^#/, '');
        if (!h || h === 'transparent') return null;
        const m = h.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!m) return null;
        const r = parseInt(m[1], 16);
        const g = parseInt(m[2], 16);
        const b = parseInt(m[3], 16);
        if (r > 200 && g < 150 && b < 90) return 'orange';
        if (r > 210 && g > 170 && b < 90) return 'gold';
        if (g > r + 30 && g > b + 20) return 'green';
        if (b > r + 30 && b > g + 10) return 'blue';
        if (r > 180 && b > 140 && g < 140) return 'pink';
        if (r > 200 && g < 100 && b < 100) return 'red';
        if (r > 220 && g > 220 && b > 220) return 'white';
        if (r < 45 && g < 45 && b < 45) return 'black';
        return null;
    }

    function memFontShort(font) {
        const f = String(font || '').replace(/['"]/g, '').split(',')[0].trim();
        if (!f) return null;
        const base = f.replace(/\s+(Bold|Black|ExtraBold|SemiBold|Medium|Regular|Light)$/i, '').trim();
        return base.length > 18 ? `${base.slice(0, 16)}…` : base;
    }

    function memHashSeed(seed) {
        const s = String(seed || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function memPick(lines, seed) {
        if (!lines || !lines.length) return '';
        return lines[memHashSeed(seed) % lines.length];
    }

    /**
     * Hooking one-liners for Memory suggestions (fonts, colors, caption style).
     * mode: captions | tip | ranking | layout
     */
    function suggestHookLine({ captions = null, styles = null, layout = null, mode = 'captions', seed = '' } = {}) {
        const caps = captions && typeof captions === 'object' ? captions : null;
        const animKey = String(caps?.anim || '').toLowerCase();
        const anim = MEM_ANIM_LABEL[animKey] || (animKey && animKey !== 'none' ? animKey : null);
        const color = memColorName(caps?.color || caps?.highlight || caps?.fill);
        const font = memFontShort(caps?.font);
        const lookBits = [color, anim, font].filter(Boolean);
        const look = lookBits.length ? lookBits.slice(0, 2).join(' ') : 'your look';
        const lookFull = lookBits.length ? lookBits.join(' · ') : 'your look';
        const s = `${mode}|${seed}|${lookFull}|${String(caps?.__tip || '')}`;

        if (mode === 'tip' || caps?.__tip === 'animations' || caps?.__tip === 'captions') {
            return memPick([
                'Captions on — keep them?',
                'Add captions to this clip?',
                'Keep captions?',
                'Captions ready — apply?',
            ], s);
        }

        if (mode === 'ranking') {
            let rankLook = 'your ranking look';
            try {
                const bag = styles && typeof styles === 'object' ? styles : null;
                if (bag) {
                    const first = Object.values(bag).find((n) => n && typeof n === 'object' && (n.font || n.color));
                    if (first) {
                        const bits = [memColorName(first.color), memFontShort(first.font)].filter(Boolean);
                        if (bits.length) rankLook = bits.join(' ');
                    }
                }
            } catch (_) { /* ignore */ }
            return memPick([
                `Keep ${rankLook}?`,
                'Your ranking style — apply?',
                'Same ranking look as last time',
                'One click. Your ranking again.',
                'Still you on the board?',
                `Back to ${rankLook}?`,
            ], s + rankLook);
        }

        if (mode === 'layout') {
            const sec = String(layout?.splitscreen_secondary_type || '').replace(/_/g, ' ');
            const withSec = sec ? `your ${sec} split` : 'your split';
            return memPick([
                `${withSec} — keep it?`,
                'Same split as last time',
                'Pick up your layout?',
                'Don’t rebuild the split',
                'Your composition. Apply?',
            ], s + sec);
        }

        return memPick([
            `Your ${look} — keep it?`,
            `Still rocking ${look}?`,
            `This is yours. Apply?`,
            `Back to ${look}?`,
            'Your signature. One click.',
            'Don’t start from zero',
            'Pick up where you left off',
            `${lookFull} — still you?`,
            `Solis remembered ${look}`,
            font ? `Keep ${font}?` : `Keep ${look}?`,
        ], s);
    }

    function trustFields(prev, fp, { resetOnFpChange = true } = {}) {
        const sameFp = !!(prev && prev.fingerprint && fp && prev.fingerprint === fp);
        if (sameFp || !resetOnFpChange) {
            return {
                acceptStreak: Number(prev.acceptStreak) || 0,
                acceptFingerprint: prev.acceptFingerprint || null,
                // undefined = default on; only explicit false sticks
                autoApply: prev.autoApply === false ? false : (prev.autoApply !== false),
                lastAcceptedAt: prev.lastAcceptedAt || null,
            };
        }
        return {
            acceptStreak: 0,
            acceptFingerprint: null,
            autoApply: true,
            lastAcceptedAt: null,
        };
    }

    /** User kept accepting this look — earn silent auto-apply */
    function recordSuggestionAccepted(templateId, opts = {}) {
        const tid = templateId || currentTemplateId;
        if (!tid || opts.tip) return;
        const s = readState();
        const mem = s.templates[tid];
        if (!mem) return;
        const fp = mem.fingerprint
            || fingerprint(mem.styles, mem.captions, mem.layout)
            || mem.acceptFingerprint
            || 'ok';
        if (mem.acceptFingerprint === fp) {
            mem.acceptStreak = (Number(mem.acceptStreak) || 0) + 1;
        } else {
            mem.acceptFingerprint = fp;
            mem.acceptStreak = 1;
        }
        mem.lastAcceptedAt = new Date().toISOString();
        mem.lastRejectedFingerprint = null;
        mem.lastRejectedAt = null;
        if (mem.acceptStreak >= AUTO_APPLY_STREAK) {
            mem.autoApply = true;
        }
        writeState(s);
    }

    function clearAcceptTrust(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid) return;
        const s = readState();
        const mem = s.templates[tid];
        if (!mem) return;
        mem.acceptStreak = 0;
        mem.acceptFingerprint = null;
        mem.autoApply = false;
        writeState(s);
    }

    function shouldAutoApply(templateId, mem) {
        if (!isEnabled() || !isSuggestEnabled()) return false;
        // Ranking: always ask (Accept/Reject). Never silent-paint remembered fonts/colors.
        if (isRankingTemplate(templateId)) return false;
        mem = mem || getTemplateMemory(templateId);
        if (!mem) return false;
        // Explicit dismiss turns auto-apply off; otherwise default on when Memory has a look
        if (mem.autoApply === false) return false;
        if (isLibraryPreviewOpen()) return false;
        const fp = mem.fingerprint
            || fingerprint(mem.styles, mem.captions, mem.layout);
        if (mem.acceptFingerprint && fp && mem.acceptFingerprint !== fp) return false;
        const hasSomething = !!(
            captionsForSuggest(mem, templateId)
            || stylesForSuggest(mem, templateId)
            || layoutUseful(mem.layout)
        );
        return hasSomething;
    }

    /** Apply remembered look with no chip — user already earned trust */
    function silentlyApplyMemory(templateId) {
        const mem = getTemplateMemory(templateId);
        if (!mem) return false;
        let applied = false;
        try {
            if (window.SolisMemory) window.SolisMemory._applying = true;

            if (isSplitscreenTemplate(templateId) && layoutUseful(mem.layout)) {
                const live = collectLiveLayout(templateId);
                if (layoutDiffers(mem.layout, live)
                    && typeof window.applySplitscreenMemoryLayout === 'function') {
                    window.applySplitscreenMemoryLayout(mem.layout, { commit: true });
                    applied = true;
                }
            }

            if (!isRankingTemplate(templateId)) {
                const wantCaps = captionsForSuggest(mem, templateId);
                if (wantCaps) {
                    const smart = smarterCaptions(wantCaps, templateId);
                    const liveCaps = collectLiveCaptions(templateId);
                    if (!liveCaps || captionsDiffer(smart, liveCaps)) {
                        if (applyCaptions(smart, templateId)) applied = true;
                    }
                }
            }

            if (isRankingTemplate(templateId)) {
                const want = stylesForSuggest(mem, templateId);
                if (want && Object.keys(want).length) {
                    window.__solisRankingDeferCustoms = false;
                    applyStyles(templateId, want);
                    applied = true;
                }
            }
        } catch (_) { /* ignore */ }
        finally {
            if (window.SolisMemory) window.SolisMemory._applying = false;
        }
        return applied;
    }

    /** Merge remembered layout pieces so a captions-only save never wipes the divider */
    function mergeLayouts(prev, next) {
        if (!layoutUseful(next) && !layoutUseful(prev)) return null;
        if (!layoutUseful(next)) return normalizeLayout(prev);
        if (!layoutUseful(prev)) return normalizeLayout(next);
        return normalizeLayout({
            ...prev,
            ...next,
            // Prefer explicit next fields; keep prev secondary if next omitted it
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
            const key = _storageKey(CAPTION_BY_TEMPLATE_KEY_BASE);
            const uid = _resolveUserId();
            const raw = localStorage.getItem(key)
                || sessionStorage.getItem(key)
                || (!uid ? localStorage.getItem(LEGACY_CAPTION_KEY) : null)
                || (!uid ? sessionStorage.getItem(LEGACY_CAPTION_KEY) : null);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeCaptionMap(map) {
        try {
            const key = _storageKey(CAPTION_BY_TEMPLATE_KEY_BASE);
            const raw = JSON.stringify(map || {});
            localStorage.setItem(key, raw);
            sessionStorage.setItem(key, raw);
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

    /** Session-only draft (clears on full page refresh) — close → reopen suggest */
    function _sessionDraftKey() {
        return _storageKey(SESSION_DRAFT_KEY_BASE);
    }

    function readSessionDraftMap() {
        try {
            const raw = sessionStorage.getItem(_sessionDraftKey());
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeSessionDraftMap(map) {
        try {
            sessionStorage.setItem(_sessionDraftKey(), JSON.stringify(map || {}));
        } catch (_) { /* ignore */ }
    }

    function readSessionDraft(templateId) {
        if (!templateId) return null;
        const d = readSessionDraftMap()[templateId];
        return d && typeof d === 'object' ? d : null;
    }

    function writeSessionDraft(templateId, draft) {
        if (!templateId || !draft || typeof draft !== 'object') return;
        const map = readSessionDraftMap();
        map[templateId] = {
            ...(map[templateId] || {}),
            ...draft,
            updatedAt: new Date().toISOString(),
        };
        writeSessionDraftMap(map);
    }

    function clearSessionDraft(templateId) {
        if (!templateId) return;
        const map = readSessionDraftMap();
        if (!map[templateId]) return;
        delete map[templateId];
        writeSessionDraftMap(map);
    }

    /**
     * Snapshot live phone look BEFORE close tears down the DOM.
     * Survives until page refresh; used to re-offer Accept/Reject on reopen.
     */
    function snapshotSessionDraft(templateId) {
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid || !isEnabled()) return null;
        const profile = templateMemoryProfile(tid);
        const draft = {};
        try {
            if (profile.captions) {
                const caps = collectLiveCaptions(tid, { allowSnap: true });
                if (caps && Object.keys(caps).length) {
                    draft.captions = { ...caps };
                    rememberCaptionSnap(tid, caps);
                }
            }
        } catch (_) { /* ignore */ }
        try {
            if (profile.styles) {
                const styles = collectLiveStyles(tid);
                if (styles && Object.keys(styles).length) draft.styles = JSON.parse(JSON.stringify(styles));
            }
        } catch (_) { /* ignore */ }
        try {
            if (profile.layout) {
                const layout = collectLiveLayout(tid);
                if (layoutUseful(layout)) draft.layout = JSON.parse(JSON.stringify(layout));
            }
        } catch (_) { /* ignore */ }
        if (!Object.keys(draft).length) return null;
        writeSessionDraft(tid, draft);
        // Persist into template memory without wiping lastGenerated*
        try {
            upsertTemplateMemory(tid, {
                captions: draft.captions || undefined,
                styles: draft.styles || undefined,
                layout: draft.layout || undefined,
                source: 'close',
            });
        } catch (_) { /* ignore */ }
        try {
            if (draft.captions) {
                window.__solisCaptionsOptedIn = true;
                window.__solisCaptionsClearedForGenerate = false;
            }
        } catch (_) { /* ignore */ }
        return draft;
    }

    /** Merge session prefs (font/color/Y) onto a generate-time caption look */
    function blendSessionPrefs(base, draftCaps) {
        if (!base || typeof base !== 'object') return base;
        if (!draftCaps || typeof draftCaps !== 'object') return { ...base };
        const out = { ...base };
        ['font', 'color', 'highlight', 'shadow', 'fill', 'anim'].forEach((k) => {
            if (draftCaps[k] != null && draftCaps[k] !== '') out[k] = draftCaps[k];
        });
        if (Number.isFinite(Number(draftCaps.font_size)) && Number(draftCaps.font_size) >= 28) {
            out.font_size = Number(draftCaps.font_size);
        }
        if (Number.isFinite(Number(draftCaps.font_size_ratio)) && Number(draftCaps.font_size_ratio) > 0) {
            out.font_size_ratio = Number(draftCaps.font_size_ratio);
        }
        if (Number.isFinite(Number(draftCaps.y_pct))) {
            out.y_pct = Math.max(0.02, Math.min(0.98, Number(draftCaps.y_pct)));
        }
        return out;
    }

    let suggestTimer = null;
    let sessionBurst = 0;
    let suggestShownForOpen = false;
    let currentTemplateId = null;
    let serverSyncTimer = null;
    let serverHydrated = false;
    let pullInFlight = null;
    let activeUserId = null;
    let preferRemoteOnce = false;

    function _resolveUserId(explicit) {
        if (explicit != null && String(explicit).trim()) return String(explicit).trim();
        if (activeUserId) return activeUserId;
        try {
            const uid = window.currentUser?.id ?? window.currentUser?.user_id;
            if (uid != null && String(uid).trim()) return String(uid).trim();
        } catch (_) { /* ignore */ }
        try {
            const saved = localStorage.getItem(MEMORY_OWNER_KEY);
            if (saved) return saved;
        } catch (_) { /* ignore */ }
        return null;
    }

    function _storageKey(base) {
        const uid = _resolveUserId();
        return uid ? `${base}:u${uid}` : base;
    }

    function _purgeLegacyGlobalKeys() {
        try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            localStorage.removeItem(LEGACY_CAPTION_KEY);
            sessionStorage.removeItem(LEGACY_CAPTION_KEY);
        } catch (_) { /* ignore */ }
    }

    /** Bind memory namespace to the signed-in user (call after auth/check). */
    function setUserId(userId, { clearLocal = false } = {}) {
        const next = _resolveUserId(userId);
        const switched = !!(activeUserId && next && activeUserId !== next);
        activeUserId = next;
        serverHydrated = false;
        if (next) {
            try { localStorage.setItem(MEMORY_OWNER_KEY, next); } catch (_) { /* ignore */ }
        } else {
            try { localStorage.removeItem(MEMORY_OWNER_KEY); } catch (_) { /* ignore */ }
        }
        _purgeLegacyGlobalKeys();
        if (clearLocal || switched) {
            try { writeState(defaultState(), { sync: false }); } catch (_) { /* ignore */ }
            preferRemoteOnce = true;
        }
        return { switched, userId: next };
    }

    /** Font → preferred anim pairings (opaque table lives in solis-sg.js) */
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
            const key = _storageKey(STORAGE_KEY_BASE);
            const uid = _resolveUserId();
            const raw = localStorage.getItem(key)
                || (!uid ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
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
            // One-time soft migrate: strip ranking styles off splitscreen, layout off ranking, etc.
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
                try { localStorage.setItem(_storageKey(STORAGE_KEY_BASE), JSON.stringify(state)); } catch (_) { /* ignore */ }
            }
            return state;
        } catch (_) {
            return defaultState();
        }
    }

    function writeState(state, { sync = false } = {}) {
        try {
            localStorage.setItem(_storageKey(STORAGE_KEY_BASE), JSON.stringify(state));
        } catch (_) { /* quota / private mode */ }
        // Server sync only on explicit learn moments (generation) — never spam on edits
        if (sync) scheduleServerSync();
    }

    function fingerprint(styles, captions, layout, overlayPosition) {
        try {
            const ov = sanitizeRankingOverlay(overlayPosition);
            return JSON.stringify({
                s: styles || null,
                c: captions || null,
                o: ov ? { y_pct: Number(ov.y_pct).toFixed(3) } : null,
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
            if (layout.splitscreen_secondary_collapsed) bits.push('Focus');
            else if (t === 'face_track') bits.push('AI Reframe');
            else if (t === 'blank') bits.push('Blank');
            else if (t === 'blank_blur') bits.push('Blur');
            else if (t === 'gameplay') bits.push('Focus');
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
        if (layout.splitscreen_secondary_collapsed) return 'Focus';
        const t = String(layout.splitscreen_secondary_type || '');
        if (t === 'face_track') return 'AI Reframe';
        if (t === 'blank') return 'Blank';
        if (t === 'blank_blur') return 'Blur';
        if (t === 'gameplay') return 'Focus';
        const r = Number(layout.splitscreen_content_ratio);
        if (Number.isFinite(r)) return `split ${Math.round(r * 100)}%`;
        return 'saved layout';
    }

    /** Soft anti-copy on suggestion chrome — looks the same, messier to select/copy */
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

    /** Split label into letter spans + ZWSP so select/copy is messy without looking different */
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
        // Soft rethink: if anim missing/legacy, prefer a font-matched combo
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
        // Prefer a readable default size when memory is incomplete — never invent a ceiling
        if (!out.font_size || out.font_size < 28) out.font_size = out.font_size || 70;
        // Keep saved Y. Ranking stays lower (not center); splitscreen lower-third.
        if (out.y_pct == null || !Number.isFinite(Number(out.y_pct))) {
            out.y_pct = isRankingTemplate(templateId) ? 0.82 : 0.78;
        } else {
            let y = Math.max(0.02, Math.min(0.98, Number(out.y_pct)));
            // Ranking: never suggest dead-center (covers the countdown)
            if (isRankingTemplate(templateId) && y > 0.42 && y < 0.62) {
                y = 0.82;
            }
            out.y_pct = y;
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
        // Snap fallback only when learning (generate) — not for "is preview empty?" checks
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
                // Layout-only memory must never wipe a font-rich live bag
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
                    // Deep-merge so partial memory snaps don't erase sibling props
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
                    playAnim: false,
                    applyFill: true,
                    markSuggest: true,
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

        // Enforce per-template ownership (ranking styles ≠ splitscreen layout, etc.)
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
        const trust = trustFields(prev, fp);
        s.templates[templateId] = {
            updatedAt: new Date().toISOString(),
            styles: nextStyles ? JSON.parse(JSON.stringify(nextStyles)) : null,
            captions: nextCaptions ? JSON.parse(JSON.stringify(nextCaptions)) : null,
            lastGeneratedCaptions: prev.lastGeneratedCaptions
                ? JSON.parse(JSON.stringify(prev.lastGeneratedCaptions))
                : null,
            // Never wipe generate lock on close/edit — suggestions prefer this
            lastGeneratedStyles: prev.lastGeneratedStyles
                ? JSON.parse(JSON.stringify(prev.lastGeneratedStyles))
                : null,
            layout: nextLayout ? JSON.parse(JSON.stringify(nextLayout)) : null,
            fingerprint: fp,
            rejectCount: prev.fingerprint === fp ? (prev.rejectCount || 0) : 0,
            lastRejectedFingerprint: prev.fingerprint === fp ? (prev.lastRejectedFingerprint || null) : null,
            lastSuggestedAt: prev.fingerprint === fp ? prev.lastSuggestedAt : null,
            acceptStreak: trust.acceptStreak,
            acceptFingerprint: trust.acceptFingerprint,
            autoApply: trust.autoApply,
            lastAcceptedAt: trust.lastAcceptedAt,
            source: source || prev.source || 'edit',
        };
        if (nextCaptions) rememberCaptionSnap(templateId, nextCaptions);
        writeState(s, { sync: false });
        syncSettingsUI();
    }

    /** Called after a successful generation start — learns only what THIS template owns */
    function recordFromGeneration(templateId, stylesOverride, captionsOverride, layoutOverride) {
        if (!templateId || !isEnabled()) return;
        const profile = templateMemoryProfile(templateId);
        const s = readState();
        const prev = s.templates[templateId] || {};

        let styles = profile.styles ? (stylesOverride || collectLiveStyles(templateId)) : null;
        let captions = profile.captions
            ? (captionsOverride || collectLiveCaptions(templateId, { allowSnap: true }))
            : null;
        let overlayPosition = profile.rankingOverlay
            ? sanitizeRankingOverlay(captionsOverride || collectLiveCaptions(templateId, { allowSnap: true }))
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
        if (profile.rankingOverlay && overlayPosition) {
            captions = null;
        }
        // Preserve previous layout if this gen somehow missed it
        if (profile.layout && !layout && layoutUseful(prev.layout)) {
            layout = normalizeLayout(prev.layout);
        }

        if (
            !(styles && Object.keys(styles).length) &&
            !(captions && Object.keys(captions).length) &&
            !overlayPosition &&
            !layoutUseful(layout)
        ) {
            return;
        }

        const fp = fingerprint(styles, captions, layout, overlayPosition);
        const sameFp = prev.fingerprint === fp;
        const trust = trustFields(prev, fp);
        s.templates[templateId] = {
            updatedAt: new Date().toISOString(),
            styles: styles ? JSON.parse(JSON.stringify(styles)) : null,
            captions: captions ? JSON.parse(JSON.stringify(captions)) : null,
            // What they actually generated with — preferred for suggestions
            lastGeneratedCaptions: captions
                ? JSON.parse(JSON.stringify(captions))
                : (prev.lastGeneratedCaptions || null),
            lastGeneratedStyles: styles
                ? JSON.parse(JSON.stringify(styles))
                : (prev.lastGeneratedStyles || null),
            lastGeneratedOverlay: overlayPosition
                ? JSON.parse(JSON.stringify(overlayPosition))
                : (prev.lastGeneratedOverlay || null),
            overlayPosition: overlayPosition
                ? JSON.parse(JSON.stringify(overlayPosition))
                : (prev.overlayPosition || null),
            layout: layout ? JSON.parse(JSON.stringify(layout)) : null,
            fingerprint: fp,
            rejectCount: sameFp ? (prev.rejectCount || 0) : 0,
            lastRejectedFingerprint: sameFp ? (prev.lastRejectedFingerprint || null) : null,
            lastRejectedAt: sameFp ? (prev.lastRejectedAt || null) : null,
            lastSuggestedAt: sameFp ? prev.lastSuggestedAt : null,
            acceptStreak: trust.acceptStreak,
            acceptFingerprint: trust.acceptFingerprint,
            // After a real generate, auto-apply is on by default (dismiss turns it off)
            autoApply: sameFp ? trust.autoApply : true,
            lastAcceptedAt: trust.lastAcceptedAt,
            source: 'generate',
        };
        s.usageLog.unshift({
            templateId,
            at: new Date().toISOString(),
            fingerprint: fp,
        });
        s.usageLog = s.usageLog.slice(0, USAGE_LOG_MAX);
        if (captions) rememberCaptionSnap(templateId, captions);
        // Keep session draft in sync so reopen still suggests (smart-mixed) until refresh
        try {
            writeSessionDraft(templateId, {
                captions: captions || undefined,
                styles: styles || undefined,
                layout: layoutUseful(layout) ? layout : undefined,
            });
        } catch (_) { /* ignore */ }
        writeState(s, { sync: true });
        sessionBurst = 0;
        sessionRejected.delete(templateId);
        syncSettingsUI();
    }

    /** Learn divider / fill from live edits (drag end, secondary pick) — local only */
    function recordLayout(templateId, layoutOverride) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid || !isSplitscreenTemplate(tid)) return;
        const layout = layoutOverride || collectLiveLayout(tid);
        if (!layoutUseful(layout)) return;
        upsertTemplateMemory(tid, { layout, source: 'layout' });
    }

    /** Local-only caption snapshot (no server). Server learn happens on generate. */
    function recordCaptions(templateId, captionsOverride) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid) return;
        const captions = captionsOverride || collectLiveCaptions(tid);
        if (!captions || !Object.keys(captions).length) return;
        upsertTemplateMemory(tid, { captions, source: 'caption' });
    }

    /** Track live edits so we can reopen suggestions after a reject + heavy editing */
    function noteEdit(templateId) {
        if (!isEnabled()) return;
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid) return;
        sessionBurst += 1;
        currentTemplateId = tid;
        // Rejected looks stay quiet — only a fingerprint change (new memory) can reopen
    }

    function scheduleSuggest(templateId) {
        if (suggestTimer) {
            clearTimeout(suggestTimer);
            suggestTimer = null;
        }
        if (!templateId
            || (!shouldSuggest(templateId) && !canOfferFirstAnimTip(templateId) && !shouldAutoApply(templateId))) {
            flushDeferredRankingCustoms();
            return;
        }
        // First-time anim tip: show almost immediately. Remembered looks keep a short settle delay.
        const firstTip = canOfferFirstAnimTip(templateId);
        const delay = firstTip ? 160 : SUGGEST_DELAY_MS;
        const jitter = firstTip ? 20 : (40 + Math.floor(Math.random() * 80));
        suggestTimer = setTimeout(() => {
            suggestTimer = null;
            const modal = document.getElementById('templatePreviewModal');
            if (!modal || !modal.classList.contains('active')) return;
            if (!shouldSuggest(templateId) && !canOfferFirstAnimTip(templateId) && !shouldAutoApply(templateId)) {
                flushDeferredRankingCustoms();
                return;
            }
            showSuggestion(templateId);
        }, delay + jitter);
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
        const suggestStyles = stylesForSuggest(mem, templateId);
        const hasStyles = !!(suggestStyles && Object.keys(suggestStyles).length);
        const suggestCaps = captionsForSuggest(mem, templateId);
        const hasCaps = !!(suggestCaps && Object.keys(suggestCaps).length);
        const hasOverlay = isRankingTemplate(templateId) && rankingOverlayDiffers(mem, templateId);
        const hasLayout = layoutUseful(mem.layout);
        if (!hasStyles && !hasCaps && !hasLayout && !hasOverlay) return false;

        // Soft reject lock — longer for ranking so reopen doesn't nag
        if (mem.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) {
            const rejectedAt = Date.parse(mem.lastRejectedAt || 0);
            if (Number.isFinite(rejectedAt) && Date.now() - rejectedAt < REJECT_COOLDOWN_MS) return false;
            // Expired lock — clear so we can offer again
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

        // Library already shows the project's look — skip caption nagging
        if (isLibraryPreviewOpen() && !hasLayout) return false;

        const liveStyles = collectLiveStyles(templateId);
        const liveCaps = collectLiveCaptions(templateId);
        const liveLayout = collectLiveLayout(templateId);
        const hasLiveCaps = !!(liveCaps && Object.keys(liveCaps).length);
        const hasLiveStyles = !!(liveStyles && Object.keys(liveStyles).length);
        const profile = templateMemoryProfile(templateId);
        const usefulCaps = hasCaps && profile.captions && !isLibraryPreviewOpen();
        const usefulStyles = hasStyles && profile.styles;
        const usefulOverlay = hasOverlay && profile.rankingOverlay;
        const usefulLayout = hasLayout && profile.layout;
        if (!usefulCaps && !usefulStyles && !usefulLayout && !usefulOverlay) return false;

        // Same fingerprint already offered recently (closed without accept/reject)
        const offeredAt = Date.parse(mem.lastSuggestedAt || 0);
        if (Number.isFinite(offeredAt)) {
            const offerCd = isRankingTemplate(templateId) ? RANKING_OFFER_COOLDOWN_MS : OFFER_COOLDOWN_MS;
            if (Date.now() - offeredAt < offerCd) {
                // Still allow divider/fill suggest when the phone doesn't match memory
                const layoutStillDiffers = usefulLayout && layoutDiffers(mem.layout, liveLayout);
                if (!layoutStillDiffers) return false;
            }
        }

        // Layout (divider / fill) first for splitscreen
        if (usefulLayout && layoutDiffers(mem.layout, liveLayout)) return true;
        // Ranking: always offer remembered styles once per open.
        // Do NOT compare customizer bag ↔ memory (bag is loaded from the same
        // generate, so fingerprints match and the chip never appears).
        if (usefulStyles && isRankingTemplate(templateId)) return true;
        // Fresh preview with nothing applied yet — offer last generated look
        if (usefulCaps && !hasLiveCaps) return true;
        if (usefulStyles && !hasLiveStyles && !hasLiveCaps) return true;

        const smartCaps = smarterCaptions(suggestCaps, templateId);
        const sameLive = fingerprint(liveStyles, liveCaps, liveLayout) === mem.fingerprint;
        const sameSmart = !smartCaps || fingerprint(null, liveCaps) === fingerprint(null, smartCaps);
        if (sameLive && sameSmart) return false;

        return true;
    }

    /** Apply deferred ranking customs when memory suggest won't show.
     * Never silently paint remembered Memory styles — that must go through Accept. */
    function flushDeferredRankingCustoms() {
        if (!window.__solisRankingDeferCustoms) return;
        try {
            const chip = document.getElementById('solisMemorySuggest');
            if (
                chip
                && !chip.hidden
                && chip.classList.contains('open')
                && chip.dataset.mode === 'styles-only'
            ) {
                // Chip is offering — keep the classic template look until Accept/Reject
                return;
            }
        } catch (_) { /* ignore */ }
        window.__solisRankingDeferCustoms = false;
        try {
            // Seed sizes only — do not apply stylesForSuggest / lastGenerated here
            if (typeof window.RankingTextPill?.seedDefaultSizes === 'function') {
                window.RankingTextPill.seedDefaultSizes();
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
        // Force layout for real width
        const aw = el.offsetWidth || 64;
        const ah = el.offsetHeight || 34;
        if (!host) {
            el.style.left = `${Math.max(12, window.innerWidth - aw - 16)}px`;
            el.style.top = '16px';
            el.style.transform = 'none';
            return;
        }
        const rect = host.getBoundingClientRect();
        // Top-RIGHT of the preview — same as subtitle memory actions
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
            el.classList.remove('open', 'solis-memory-suggest--recipe');
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
            // Fully clear caption suggest state (not just DOM ghosts)
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

    /** Caption look to suggest — generate (smart-mixed) → session draft → none */
    function captionsForSuggest(mem, templateId) {
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id || null;
        const draft = tid ? readSessionDraft(tid) : null;
        const gen = mem && typeof mem === 'object' ? mem.lastGeneratedCaptions : null;
        if (gen && typeof gen === 'object' && Object.keys(gen).length) {
            return smarterCaptions(blendSessionPrefs(gen, draft?.captions), tid);
        }
        // Session-only close draft (gone after refresh)
        if (draft?.captions && typeof draft.captions === 'object' && Object.keys(draft.captions).length) {
            return smarterCaptions({ ...draft.captions }, tid);
        }
        return null;
    }

    /** Ranking styles to suggest — only looks that were actually generated with.
     * Preview-only tweaks (session draft / close bag) must not force a new look. */
    function stylesForSuggest(mem, templateId) {
        const tid = templateId || currentTemplateId || window.clipsStudio?.currentTemplateForPreview?.id || null;
        if (!mem || typeof mem !== 'object') return null;
        const gen = mem.lastGeneratedStyles;
        if (!(gen && typeof gen === 'object' && Object.keys(gen).length)) return null;

        // Soft-merge session tweaks only on top of a real generate lock
        const draft = tid ? readSessionDraft(tid) : null;
        if (draft?.styles && typeof draft.styles === 'object') {
            try {
                const merged = JSON.parse(JSON.stringify(gen));
                Object.entries(draft.styles).forEach(([k, v]) => {
                    if (k === '__ranking_layout') {
                        merged[k] = v;
                        return;
                    }
                    if (v && typeof v === 'object') merged[k] = { ...(merged[k] || {}), ...v };
                    else if (v != null) merged[k] = v;
                });
                return merged;
            } catch (_) {
                return gen;
            }
        }
        return gen;
    }

    function rankingStylesReady(templateId) {
        const tid = templateId || 'ranked_compilation';
        const mem = getTemplateMemory(tid);
        const want = stylesForSuggest(mem, tid);
        const styleReady = !!(want && Object.keys(want).some((k) => {
            if (k === '__ranking_layout') return false;
            const n = want[k];
            return n && typeof n === 'object' && (n.font || n.font_size || n.color);
        }));
        const overlayReady = !!rankingOverlayForSuggest(mem);
        return styleReady || overlayReady;
    }

    function isLibraryPreviewOpen() {
        try {
            return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
        } catch (_) {
            return false;
        }
    }

    function paintCaptionMemoryChip(style, templateId) {
        if (!style || typeof window.offerSubtitleMemorySuggest !== 'function') return false;
        if (templateId && sessionRejected.has(templateId)) return false;
        window.offerSubtitleMemorySuggest(style, templateId);
        const pending = !!(window.__solisPendingSubMem
            || document.getElementById('subMemActions')?.classList.contains('open')
            || document.querySelector('.sub-mem-ghost,.sub-text-block.sub-suggest'));
        if (!pending) return false;

        // Ranking-style ✕/✓ only — no text tip chip for captions
        try {
            const chip = document.getElementById('solisMemorySuggest');
            if (chip) {
                chip.hidden = true;
                chip.setAttribute('hidden', '');
                chip.classList.remove('open', 'solis-memory-suggest--recipe');
                chip.style.visibility = 'hidden';
                chip.style.opacity = '0';
                chip.style.pointerEvents = 'none';
            }
        } catch (_) { /* ignore */ }
        try {
            const live = document.getElementById('templateVideoPreview')
                ?.querySelector('.sub-text-block.sub-suggest, .sub-text-block.sub-mem-pick, .sub-text-block:not(.overlay-text-block)');
            if (typeof window.placeSubtitleMemoryActionsNear === 'function') {
                window.placeSubtitleMemoryActionsNear(live);
            }
            const actions = document.getElementById('subMemActions')
                || (typeof window.ensureSubMemActions === 'function' ? window.ensureSubMemActions() : null);
            if (actions) {
                actions.classList.add('open');
                actions.style.opacity = '1';
                actions.style.visibility = 'visible';
                actions.style.pointerEvents = 'auto';
                actions.style.display = 'flex';
            }
        } catch (_) { /* ignore */ }
        return true;
    }

    function offerCaptionSuggest(templateId, mem) {
        // Library video already has its burned look — don't offer a different remembered style
        if (isLibraryPreviewOpen()) return false;
        if (sessionRejected.has(templateId)) return false;
        mem = mem || getTemplateMemory(templateId);
        const baseCaps = captionsForSuggest(mem, templateId);
        // No prior generate → captions-on default + AI suggest chip
        if (!baseCaps) {
            const liveCaps = collectLiveCaptions(templateId);
            const hasLive = !!(liveCaps && Object.keys(liveCaps).length);
            const liveAnim = String(liveCaps?.anim || '').toLowerCase();
            let softSuggest = false;
            try {
                softSuggest = !!(
                    document.querySelector('#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block)')
                    || document.querySelector('#templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)')
                    || window.__solisPendingSubMem
                );
            } catch (_) { /* ignore */ }
            // Still suggest when we just seeded default captions (soft ring) — don't treat that as opted-in
            const needsCaptionSuggest = softSuggest
                || !hasLive
                || !liveAnim
                || liveAnim === 'none'
                || liveAnim === 'static';
            if (!needsCaptionSuggest) return false;
            const tip = smarterCaptions({
                anim: 'karaoke',
                font: String(liveCaps?.font || 'Montserrat'),
                color: liveCaps?.color || '#ffffff',
                highlight: liveCaps?.highlight || '#FFFFFF',
                shadow: liveCaps?.shadow || 'outline',
                font_size: liveCaps?.font_size || 70,
                font_size_ratio: liveCaps?.font_size_ratio || 0.036,
                y_pct: liveCaps?.y_pct != null ? liveCaps.y_pct : 0.55,
                enabled: true,
                __tip: 'captions',
            }, templateId);
            return paintCaptionMemoryChip(tip, templateId);
        }
        // Ranking remembered caption styles — only when they differ from live
        if (isRankingTemplate(templateId)) {
            let smartCaps = smarterCaptions(baseCaps, templateId);
            if (!smartCaps) return false;
            const liveCaps = collectLiveCaptions(templateId);
            const hasLiveCaps = !!(liveCaps && Object.keys(liveCaps).length);
            if (hasLiveCaps && !captionsDiffer(smartCaps, liveCaps)) return false;
            return paintCaptionMemoryChip(smartCaps, templateId);
        }
        let smartCaps = smarterCaptions(baseCaps, templateId);
        // After a generate: nudge toward a better animation when they used a static/legacy look
        if (smartCaps) {
            const anim = String(smartCaps.anim || '').toLowerCase();
            if (!anim || anim === 'center' || anim === 'fade' || anim === 'none') {
                smartCaps = { ...smartCaps, anim: 'karaoke', __tip: 'animations' };
            }
        }
        if (!smartCaps) return false;
        const liveCaps = collectLiveCaptions(templateId);
        const hasLiveCaps = !!(liveCaps && Object.keys(liveCaps).length);
        if (hasLiveCaps && !captionsDiffer(smartCaps, liveCaps)) return false;
        return paintCaptionMemoryChip(smartCaps, templateId);
    }

    function showSuggestion(templateId) {
        if (!shouldSuggest(templateId) && !canOfferFirstAnimTip(templateId) && !shouldAutoApply(templateId)) return;
        const mem = getTemplateMemory(templateId);

        // Earned trust: apply their look silently — no chip, no click
        if (shouldAutoApply(templateId, mem)) {
            silentlyApplyMemory(templateId);
            suggestShownForOpen = true;
            flushDeferredRankingCustoms();
            return;
        }

        if (!shouldSuggest(templateId) && !canOfferFirstAnimTip(templateId)) return;

        let offered = false;

        // Splitscreen: Instant Recipe owns the first layout chip when a paste is in flight
        if (isSplitscreenTemplate(templateId)) {
            try {
                if (window.SolisInstantRecipe?.willOffer?.(templateId)
                    || window.SolisInstantRecipe?.didOffer?.()) {
                    return;
                }
            } catch (_) { /* ignore */ }
            if (mem && wantsLayoutSuggest(templateId, mem)) {
                offered = offerLayoutSuggest(templateId, mem);
            }
            if (!offered) {
                offered = offerCaptionSuggest(templateId, mem);
            }
        } else if (isRankingTemplate(templateId)) {
            // Ranking: prefer last-generated styles / text placement; otherwise first-open caption tip
            if (mem) {
                const want = stylesForSuggest(mem, templateId);
                const hasStyleMem = !!(want && Object.keys(want).length);
                const hasOverlayMem = !!rankingOverlayForSuggest(mem);
                if (hasStyleMem || hasOverlayMem) {
                    offered = !!offerRankingStylesSuggest(templateId, mem);
                }
            }
            if (!offered) {
                offered = offerCaptionSuggest(templateId, mem);
            }
            if (!offered && !mem) {
                flushDeferredRankingCustoms();
            }
        } else {
            offered = offerCaptionSuggest(templateId, mem);
        }

        // Only lock this open once something actually appeared
        if (!offered) {
            flushDeferredRankingCustoms();
            return;
        }
        // Confirm chrome is actually on screen (avoid locking cooldown on a failed paint)
        const solisEl = document.getElementById('solisMemorySuggest');
        const solisVisible = !!(solisEl && !solisEl.hidden && solisEl.classList.contains('open'));
        const subVisible = !!document.getElementById('subMemActions')?.classList.contains('open')
            || !!document.querySelector('.sub-mem-ghost');
        if (!solisVisible && !subVisible && isRankingTemplate(templateId)) {
            flushDeferredRankingCustoms();
            return;
        }
        suggestShownForOpen = true;

        if (mem) {
            const s = readState();
            if (s.templates[templateId]) {
                s.templates[templateId].lastSuggestedAt = new Date().toISOString();
                writeState(s);
            }
        }
    }

    /** Allow a one-shot caption tip before the user has any generate memory */
    function canOfferFirstAnimTip(templateId) {
        if (!isSuggestEnabled() || !templateId) return false;
        if (suggestShownForOpen) return false;
        if (sessionRejected.has(templateId)) return false;
        if (isLibraryPreviewOpen()) return false;
        const mem = getTemplateMemory(templateId);
        if (captionsForSuggest(mem, templateId)) return false;
        return true;
    }

    /**
     * Force the first-open "add captions" tip as soon as the phone is ready.
     * Retries briefly so we don't lose the race to modal/layout paint.
     */
    function offerFirstCaptionTip(templateId, opts) {
        const tid = templateId || currentTemplateId;
        if (!tid || !isSuggestEnabled()) return false;
        if (isLibraryPreviewOpen()) return false;
        if (sessionRejected.has(tid)) return false;
        const force = !!(opts && opts.force);
        const actionsOpen = () => !!document.getElementById('subMemActions')?.classList.contains('open');
        const softCap = () => !!document.querySelector(
            '#templateVideoPreview .sub-text-block.sub-suggest, #templateVideoPreview .sub-text-block.sub-mem-pick, .sub-mem-ghost'
        );
        if (suggestShownForOpen && !force) {
            // Already showing a caption tip / soft-preview WITH Accept/Reject
            if ((softCap() && actionsOpen())
                || document.getElementById('solisMemorySuggest')?.classList.contains('open')) {
                return true;
            }
            // Soft ring without buttons (wiped by splitscreen init) — fall through and re-offer
        }
        // Ranking with remembered board styles — leave that to showSuggestion
        try {
            if (isRankingTemplate(tid)) {
                const want = stylesForSuggest(getTemplateMemory(tid));
                if (want && Object.keys(want).length) return false;
            }
        } catch (_) { /* ignore */ }
        // Don't steal an open layout / recipe chip
        try {
            const el = document.getElementById('solisMemorySuggest');
            const mode = el?.dataset?.mode || '';
            if (el && el.classList.contains('open')
                && mode && mode !== 'captions-pending' && mode !== 'captions') {
                return false;
            }
        } catch (_) { /* ignore */ }

        const attempt = () => {
            if (sessionRejected.has(tid)) return false;
            const modal = document.getElementById('templatePreviewModal');
            if (!modal || !modal.classList.contains('active')) return false;
            const phone = document.getElementById('templateVideoPreview');
            if (!phone || phone.querySelector('.preview-skel')) return false;
            // Skip only if they already opted into live captions (no soft suggest)
            try {
                const soft = !!document.querySelector(
                    '#templateVideoPreview .sub-text-block.sub-suggest:not(.overlay-text-block), #templateVideoPreview .sub-text-block.sub-mem-pick:not(.overlay-text-block)'
                );
                const live = collectLiveCaptions(tid);
                const anim = String(live?.anim || '').toLowerCase();
                if (!soft && live && Object.keys(live).length && anim && anim !== 'none' && anim !== 'static') {
                    if (document.querySelector('.sub-text-block:not(.overlay-text-block)')) {
                        return false;
                    }
                }
            } catch (_) { /* ignore */ }
            const ok = offerCaptionSuggest(tid, getTemplateMemory(tid));
            if (ok) suggestShownForOpen = true;
            return !!ok;
        };

        if (attempt()) return true;
        const retries = Math.max(0, Number(opts?.retries) || 4);
        const gap = Math.max(40, Number(opts?.gapMs) || 180);
        for (let i = 1; i <= retries; i++) {
            setTimeout(() => {
                if (sessionRejected.has(tid)) return;
                // Never re-force after an explicit dismiss this open
                if (suggestShownForOpen && !force && actionsOpen()) return;
                if (suggestShownForOpen && !force && !softCap() && !window.__solisPendingSubMem) return;
                // force retries still respect reject lock
                if (force && suggestShownForOpen && !softCap() && !window.__solisPendingSubMem && !actionsOpen()) return;
                try { attempt(); } catch (_) { /* ignore */ }
            }, gap * i);
        }
        return false;
    }

    /** Allow seed path to re-show Accept/Reject after a mid-open wipe */
    function _forceCaptionTipReshow() {
        suggestShownForOpen = false;
    }

    /** Video-aware recipe from paste — same chip, specific why line */
    function offerInstantRecipe(recipe, templateId) {
        if (window.solisAutoModesEnabled === false) return false;
        if (!recipe || !recipe.ok || !isSplitscreenTemplate(templateId)) return false;
        const layout = recipe.splitscreen;
        if (!layout || typeof layout !== 'object') return false;
        if (typeof window.offerSplitscreenMemorySuggest !== 'function') return false;
        const opened = window.offerSplitscreenMemorySuggest(layout, templateId);
        if (!opened) return false;

        const el = ensureSuggestEl();
        const title = el.querySelector('#solisMemorySuggestTitle');
        const label = String(recipe.why_short || recipe.why || '').trim();
        if (title) {
            title.hidden = !label;
            title.textContent = label;
            if (label) {
                title.removeAttribute('hidden');
                title.style.display = '';
            }
        }
        const sub = el.querySelector('#solisMemorySuggestSub');
        if (sub) sub.textContent = '';
        el.dataset.templateId = templateId;
        el.dataset.mode = 'instant-recipe';
        el.classList.add('solis-memory-suggest--recipe');
        el.classList.remove('solis-memory-suggest--ranking');
        try {
            el._solisInstantRecipe = JSON.parse(JSON.stringify(recipe));
        } catch (_) {
            el._solisInstantRecipe = recipe;
        }
        suggestShownForOpen = true;
        placeSuggestNearPreview();
        revealSuggestEl(el);
        return true;
    }

    function retrySuggest(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid || suggestShownForOpen) return;
        const modal = document.getElementById('templatePreviewModal');
        if (!modal || !modal.classList.contains('active')) return;
        showSuggestion(tid);
    }

    /** Soft-preview divider + Accept/Dismiss — never open the gameplay pill */
    function offerLayoutSuggest(templateId, mem) {
        mem = mem || getTemplateMemory(templateId);
        if (!wantsLayoutSuggest(templateId, mem)) return false;
        if (typeof window.offerSplitscreenMemorySuggest !== 'function') return false;
        const opened = window.offerSplitscreenMemorySuggest(mem.layout, templateId);
        if (!opened) return false;

        const el = ensureSuggestEl();
        const title = el.querySelector('#solisMemorySuggestTitle');
        // Icon-only chrome for layout — soft-preview on the phone is the cue
        if (title) {
            title.hidden = true;
            title.textContent = '';
        }
        const sub = el.querySelector('#solisMemorySuggestSub');
        if (sub) sub.textContent = '';
        el.dataset.templateId = templateId;
        el.dataset.mode = 'layout-only';
        el.classList.remove('solis-memory-suggest--recipe', 'solis-memory-suggest--ranking');
        placeSuggestNearPreview();
        revealSuggestEl(el);
        return true;
    }

    /** Compact ranking styles prompt — only for ranking templates */
    function offerRankingStylesSuggest(templateId, mem) {
        if (!isRankingTemplate(templateId)) return false;
        mem = mem || getTemplateMemory(templateId);
        const want = stylesForSuggest(mem, templateId);
        const overlay = rankingOverlayForSuggest(mem);
        const styleKeys = want ? Object.keys(want).filter((k) => k !== '__ranking_layout') : [];
        const hasVisibleStyle = styleKeys.some((k) => {
            const n = want[k];
            return n && typeof n === 'object' && (n.font || n.font_size || n.color);
        });
        if (!hasVisibleStyle && !overlay) return false;
        if (!rankingOverlayDiffers(mem, templateId) && !hasVisibleStyle) return false;

        // Already showing this chip
        const existing = document.getElementById('solisMemorySuggest');
        if (
            existing
            && !existing.hidden
            && existing.classList.contains('open')
            && existing.dataset.mode === 'styles-only'
            && existing.dataset.templateId === String(templateId)
        ) {
            return true;
        }

        try {
            if (window.RankingTextPill) {
                if (typeof window.RankingTextPill.hide === 'function') window.RankingTextPill.hide();
                if (typeof window.RankingTextPill.clearSuggest === 'function') window.RankingTextPill.clearSuggest();
            }
            document.getElementById('subPillMenu')?.classList.remove('active');
        } catch (_) { /* ignore */ }

        // Keep classic template on the phone — only paint styles when they Accept
        window.__solisRankingDeferCustoms = true;

        const el = ensureSuggestEl();
        const title = el.querySelector('#solisMemorySuggestTitle');
        if (title) {
            title.hidden = false;
            title.removeAttribute('hidden');
            const hook = hasVisibleStyle
                ? suggestHookLine({ styles: want, mode: 'ranking', seed: templateId })
                : 'Use your last text placement?';
            title.textContent = overlay && hasVisibleStyle
                ? `${hook} · same text spot`
                : hook;
            title.style.display = '';
        }
        const sub = el.querySelector('#solisMemorySuggestSub');
        if (sub) sub.textContent = '';
        el.dataset.templateId = templateId;
        el.dataset.mode = 'styles-only';
        el.classList.add('solis-memory-suggest--ranking');
        try {
            el._solisMemStyles = want && Object.keys(want).length
                ? JSON.parse(JSON.stringify(want))
                : null;
        } catch (_) {
            el._solisMemStyles = want;
        }
        try {
            el._solisMemOverlay = overlay ? JSON.parse(JSON.stringify(overlay)) : null;
        } catch (_) {
            el._solisMemOverlay = overlay;
        }
        el._solisMemStylesPreviewed = false;
        try { delete el._solisMemStylesBackup; } catch (_) { /* ignore */ }
        placeSuggestNearPreview();
        revealSuggestEl(el);
        return true;
    }

    /** After captions are accepted, keep guiding with layout then ranking styles */
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
            // Layout already offered first on splitscreen — only fall through for ranking
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
            // After divider/fill accept → offer remembered subtitles (never on ranking)
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

        // Caption soft-preview lives in pendingSubMem — accept before hideSuggest clears it
        if (mode === 'captions-pending') {
            if (templateId) sessionRejected.delete(templateId);
            try {
                if (typeof window.acceptSubtitleMemorySuggest === 'function') {
                    window.acceptSubtitleMemorySuggest();
                }
            } catch (_) { /* ignore */ }
            hideSuggest();
            el.classList.remove('solis-memory-suggest--recipe');
            sessionBurst = 0;
            return;
        }

        hideSuggest();
        if (templateId) sessionRejected.delete(templateId);
        const mem = getTemplateMemory(templateId);
        if (!mem && mode !== 'instant-recipe') return;

        if (mode === 'instant-recipe') {
            const rec = el._solisInstantRecipe || window.SolisInstantRecipe?.get?.();
            const layout = rec?.splitscreen;
            try {
                if (window.SolisMemory) window.SolisMemory._applying = true;
                if (layout && typeof window.applySplitscreenMemoryLayout === 'function') {
                    window.applySplitscreenMemoryLayout(layout, { commit: true });
                }
            } catch (_) { /* ignore */ }
            finally {
                if (window.SolisMemory) window.SolisMemory._applying = false;
            }
            try { window.SolisInstantRecipe?.sendFeedback?.(true); } catch (_) {}
            try { delete el._solisInstantRecipe; } catch (_) {}
            el.classList.remove('solis-memory-suggest--recipe');
            sessionBurst = 0;
            suggestShownForOpen = false;
            if (window.__solisRecipeSkipCaptions) {
                suggestShownForOpen = true;
                return;
            }
            continueSuggestAfterLayout(templateId);
            return;
        }

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
            recordSuggestionAccepted(templateId);
            sessionBurst = 0;
            // Allow caption suggest next in this same open
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
            // Apply only on Accept — phone stayed on classic until now
            const stylePayload = el._solisMemStyles || stylesForSuggest(mem, templateId);
            if (stylePayload && Object.keys(stylePayload).length) {
                window.__solisRankingDeferCustoms = false;
                applyStyles(templateId, stylePayload);
            }
            const overlayPayload = el._solisMemOverlay || rankingOverlayForSuggest(mem);
            if (overlayPayload && isRankingTemplate(templateId)) {
                applyCaptions({
                    ...overlayPayload,
                    anim: 'none',
                    enabled: true,
                }, templateId);
            }
        } else {
            if (mem.captions) applyCaptions(mem.captions, templateId);
            if (mem.layout && typeof window.applySplitscreenMemoryLayout === 'function') {
                try { window.applySplitscreenMemoryLayout(mem.layout, { commit: true }); } catch (_) { /* ignore */ }
            }
            const stylePayload = stylesForSuggest(mem, templateId);
            if (stylePayload && Object.keys(stylePayload).length) {
                window.__solisRankingDeferCustoms = false;
                applyStyles(templateId, stylePayload);
            }
        }
        try {
            delete el._solisMemStyles;
            delete el._solisMemStylesBackup;
            delete el._solisMemStylesPreviewed;
            delete el._solisMemOverlay;
            el.classList.remove('solis-memory-suggest--ranking');
        } catch (_) { /* ignore */ }
        const s = readState();
        if (s.templates[templateId]) {
            s.templates[templateId].lastAcceptedAt = new Date().toISOString();
            s.templates[templateId].lastRejectedFingerprint = null;
            writeState(s);
        }
        recordSuggestionAccepted(templateId);
        sessionBurst = 0;
        if (typeof window.clearSubtitleMemorySuggest === 'function') {
            window.clearSubtitleMemorySuggest();
        }
        // Never leave a floating edit pill stuck on the phone after Tab/accept
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
        if (mode === 'instant-recipe') {
            try {
                if (typeof window.revertSplitscreenMemorySuggestPreview === 'function') {
                    window.revertSplitscreenMemorySuggestPreview();
                }
            } catch (_) { /* ignore */ }
            try { window.SolisInstantRecipe?.sendFeedback?.(false); } catch (_) {}
            try { delete el._solisInstantRecipe; } catch (_) {}
            el.classList.remove('solis-memory-suggest--recipe');
            hideSuggest();
            suggestShownForOpen = false;
            sessionBurst = 0;
            if (!window.__solisRecipeSkipCaptions) {
                setTimeout(() => {
                    if (!templateId || sessionRejected.has(templateId)) return;
                    const mem = getTemplateMemory(templateId);
                    if (mem && offerCaptionSuggest(templateId, mem)) {
                        suggestShownForOpen = true;
                    }
                }, 280);
            }
            return;
        }
        if (mode === 'captions-pending') {
            hideSuggest();
            el.classList.remove('solis-memory-suggest--recipe');
            markSuggestionRejected(templateId);
            try {
                if (typeof window.clearSubtitleMemorySuggest === 'function') {
                    window.clearSubtitleMemorySuggest({
                        cooldown: true,
                        revert: true,
                        persistReject: true,
                        templateId,
                    });
                }
            } catch (_) { /* ignore */ }
            return;
        }
        // Undo soft-previewed divider if they dismiss layout suggest
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
            // Dismissing the split should NOT lock out caption suggestions
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
        // Phone never soft-previewed styles — leave classic look as-is
        try {
            delete el._solisMemStyles;
            delete el._solisMemStylesBackup;
            delete el._solisMemStylesPreviewed;
            el.classList.remove('solis-memory-suggest--ranking');
        } catch (_) { /* ignore */ }
        // Drop defer without painting remembered styles
        window.__solisRankingDeferCustoms = false;
        try {
            if (typeof window.RankingTextPill?.seedDefaultSizes === 'function') {
                window.RankingTextPill.seedDefaultSizes();
            }
        } catch (_) { /* ignore */ }
        if (typeof window.clearSubtitleMemorySuggest === 'function') {
            window.clearSubtitleMemorySuggest({ cooldown: true, persistReject: true });
        }
    }

    /** Persist + session-lock a dismiss so sub-mem / ranking suggest stay quiet */
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
        let mem = s.templates[tid];
        if (!mem) {
            // First-open tip may have no prior generate memory — still lock the dismiss
            mem = s.templates[tid] = {
                fingerprint: 'first-caption-tip',
                rejectCount: 0,
                styles: null,
                captions: null,
                layout: null,
            };
        }
        mem.rejectCount = (mem.rejectCount || 0) + 1;
        mem.lastRejectedFingerprint = mem.fingerprint
            || fingerprint(mem.styles, mem.captions, mem.layout)
            || 'first-caption-tip';
        mem.lastRejectedAt = new Date().toISOString();
        mem.acceptStreak = 0;
        mem.acceptFingerprint = null;
        mem.autoApply = false;
        writeState(s);
    }

    function wasSuggestionRejected(templateId) {
        const tid = templateId || currentTemplateId;
        if (!tid) return false;
        if (sessionRejected.has(tid)) return true;
        try {
            const mem = getTemplateMemory(tid);
            if (mem?.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) {
                const rejectedAt = Date.parse(mem.lastRejectedAt || 0);
                if (Number.isFinite(rejectedAt) && Date.now() - rejectedAt < REJECT_COOLDOWN_MS) return true;
            }
        } catch (_) { /* ignore */ }
        return false;
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
        const base = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        return { 'Content-Type': 'application/json', ...base };
    }

    async function pushServerMemory() {
        if (!_resolveUserId()) return;
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

    function mergeMemoryStates(local, remote, { preferRemote = false } = {}) {
        if (preferRemote) {
            const out = {
                ...defaultState(),
                enabled: remote.enabled !== undefined ? remote.enabled : true,
                suggestEnabled: remote.suggestEnabled !== undefined ? remote.suggestEnabled : true,
                templates: {},
                usageLog: Array.isArray(remote.usageLog) ? remote.usageLog : [],
            };
            Object.entries(remote.templates || {}).forEach(([id, mem]) => {
                const clean = _sanitizeRemoteTemplate(id, mem);
                if (clean) out.templates[id] = clean;
            });
            return out;
        }
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
                // Prefer whichever has captions/layout if the other lacks them
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
        // Final pass — strip ranking captions / non-splitscreen layout forever
        Object.keys(out.templates).forEach((id) => {
            out.templates[id] = _sanitizeRemoteTemplate(id, out.templates[id]) || out.templates[id];
        });
        return out;
    }

    async function pullServerMemory() {
        if (!_resolveUserId()) return null;
        if (pullInFlight) return pullInFlight;
        pullInFlight = (async () => {
            try {
                const res = await fetch(apiUrl('/api/clips/memory'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: authHeaders(),
                    body: JSON.stringify({ action: 'get' }),
                });
                if (!res.ok) {
                    if (typeof window.solisLog === 'function') {
                        window.solisLog('Memory API', `pull failed HTTP ${res.status}`);
                    } else {
                        console.warn('[SolisMemory] server pull failed:', res.status);
                    }
                    return null;
                }
                const data = await res.json();
                const remote = data?.memory;
                if (!remote || typeof remote !== 'object') {
                    if (typeof window.solisLog === 'function') {
                        window.solisLog('Memory API', 'empty remote memory');
                    }
                    return null;
                }
                const preferRemote = preferRemoteOnce;
                preferRemoteOnce = false;
                const merged = mergeMemoryStates(readState(), remote, { preferRemote });
                writeState(merged, { sync: false });
                serverHydrated = true;
                syncSettingsUI();
                if (typeof window.solisLog === 'function') {
                    const n = Object.keys(merged.templates || {}).length;
                    window.solisLog('Memory API', `loaded ${n} template profile(s)`);
                }
                return merged;
            } catch (err) {
                console.warn('[SolisMemory] pull error:', err?.message || err);
                return null;
            }
            finally {
                pullInFlight = null;
            }
        })();
        return pullInFlight;
    }

    /** Schedule a delayed, one-shot suggestion when template preview opens */
    async function onTemplatePreviewOpen(templateId) {
        currentTemplateId = templateId || null;
        suggestShownForOpen = false;
        sessionBurst = 0;
        hideSuggest();
        // Reopen should be allowed unless they explicitly dismissed recently
        try {
            sessionRejected.delete(templateId);
            const mem = getTemplateMemory(templateId);
            if (mem?.lastRejectedAt && mem?.lastRejectedFingerprint && mem.lastRejectedFingerprint === mem.fingerprint) {
                const rejectedAt = Date.parse(mem.lastRejectedAt);
                if (Number.isFinite(rejectedAt) && Date.now() - rejectedAt < REJECT_COOLDOWN_MS) {
                    sessionRejected.add(templateId);
                } else {
                    // Expired reject lock — clear so we can offer again
                    const s = readState();
                    if (s.templates[templateId]) {
                        s.templates[templateId].lastRejectedFingerprint = null;
                        s.templates[templateId].lastRejectedAt = null;
                        writeState(s);
                    }
                }
            }
        } catch (_) { /* ignore */ }
        // Don't block UI on server hydrate — suggest from local memory immediately
        scheduleSuggest(templateId);
        // First-open caption tip — don't wait on cooldowns / ranking style-only path
        try {
            setTimeout(() => {
                try { offerFirstCaptionTip(templateId, { retries: 4, gapMs: 200 }); } catch (_) { /* ignore */ }
            }, 60);
        } catch (_) { /* ignore */ }
        if (!serverHydrated) {
            pullServerMemory().then(() => {
                if (!suggestShownForOpen) scheduleSuggest(templateId);
                if (!suggestShownForOpen) {
                    try { offerFirstCaptionTip(templateId, { retries: 2, gapMs: 180 }); } catch (_) { /* ignore */ }
                }
            }).catch(() => {});
        }
        // If ranking customs were deferred but no suggest fired, paint them after the window
        setTimeout(() => flushDeferredRankingCustoms(), SUGGEST_DELAY_MS + 400);
    }

    function onTemplatePreviewClose() {
        if (suggestTimer) {
            clearTimeout(suggestTimer);
            suggestTimer = null;
        }
        // Closing the modal must NOT permanently mute suggests for the session —
        // only explicit dismiss/reject should session-lock.
        hideSuggest();
        suggestShownForOpen = false;
        // Prefer snapshot taken before DOM wipe; fall back to live collect if still present
        try {
            if (currentTemplateId) {
                const existing = readSessionDraft(currentTemplateId);
                if (!existing || !Object.keys(existing).length) {
                    snapshotSessionDraft(currentTemplateId);
                } else {
                    // Still upsert layout/captions from draft into long-lived memory bag
                    upsertTemplateMemory(currentTemplateId, {
                        captions: existing.captions || undefined,
                        styles: existing.styles || undefined,
                        layout: existing.layout || undefined,
                        source: 'close',
                    });
                }
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
        // Never seed suggestable memory from draft rankingCustomizations —
        // that leaked one user's fonts/colors to every account on the machine.
        // Suggestions only come from recordFromGeneration (lastGenerated*).
        return 0;
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
        stylesForSuggest,
        rankingStylesReady,
        rankingOverlayForSuggest,
        rankingOverlayDiffers,
        applyCaptions,
        smarterCaptions,
        continueSuggestAfterCaption,
        continueSuggestAfterLayout,
        pullServerMemory,
        setUserId,
        markSuggestionRejected,
        wasSuggestionRejected,
        rejectSuggestion,
        acceptSuggestion,
        offerInstantRecipe,
        retrySuggest,
        offerFirstCaptionTip,
        _forceCaptionTipReshow,
        snapshotSessionDraft,
        rememberCaptionSnap,
        recallCaptionSnap,
        suggestHookLine,
        recordSuggestionAccepted,
        lockSuggestForOpen: () => {
            suggestShownForOpen = true;
            sessionBurst = 0;
            if (suggestTimer) {
                clearTimeout(suggestTimer);
                suggestTimer = null;
            }
        },
        getCurrentTemplateId: () => currentTemplateId,
        isRankingTemplate,
        isSplitscreenTemplate,
        _applying: false,
    };

    // Same Tab / Esc shortcuts as subtitle memory accept
    document.addEventListener('keydown', (e) => {
        const el = document.getElementById('solisMemorySuggest');
        // Subtitle memory guide owns Tab/Esc while active
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
