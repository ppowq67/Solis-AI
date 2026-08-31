/**
 * Solis Instant Recipe — paste-time layout/template suggestion.
 * Prefetches on URL paste, soft-applies into the existing memory chip.
 */
(function () {
    /** Kill switch — set true to turn the paste-time recipe back on. */
    const ENABLED = false;
    if (!ENABLED) {
        window.SolisInstantRecipe = {
            enabled: false,
            prefetch: async () => null,
            willOffer: () => false,
            didOffer: () => false,
            markUserEdited: () => {},
            sendFeedback: () => {},
            get: () => null,
        };
        return;
    }

    const MIN_CONFIDENCE = 0.32;
    const FETCH_MS = 5200;

    let inflight = null;
    let inflightKey = '';
    let recipe = null;
    let recipeUrl = '';
    let userEdited = false;
    let offered = false;
    let previewWait = null;

    function apiUrl(path) {
        if (typeof window.apiUrl === 'function') return window.apiUrl(path);
        return path;
    }

    function authHeaders() {
        const base = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        return { 'Content-Type': 'application/json', ...base };
    }

    function videoKeyFromUrl(url) {
        const s = String(url || '');
        const m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/i);
        if (m) return 'yt:' + m[1];
        return 'u:' + s.split('?')[0].slice(-24);
    }

    function currentUrl() {
        return (document.getElementById('youtubeUrlInput')?.value || '').trim();
    }

    function isValidUrl(url) {
        try {
            if (window.clipsStudio && typeof window.clipsStudio.isValidMediaUrl === 'function') {
                return window.clipsStudio.isValidMediaUrl(url);
            }
        } catch (_) { /* ignore */ }
        return /youtu\.?be|tiktok\.com|instagram\.com\/(reels?|p)\//i.test(String(url || ''));
    }

    function allowedTemplates() {
        const paid = new Set(['basic', 'prime', 'elite', 'pro', 'nextgen']);
        let plan = 'free';
        try {
            plan = String(
                window.currentUser?.plan
                || window.currentUser?.plan_type
                || 'free'
            ).toLowerCase();
        } catch (_) { /* ignore */ }
        const out = ['ranked_compilation'];
        if (paid.has(plan)) out.push('splitscreen');
        return out;
    }

    function userLayout() {
        try {
            if (typeof window.getSplitscreenConfig === 'function') {
                return window.getSplitscreenConfig();
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    function isLibrary() {
        try {
            return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
        } catch (_) {
            return false;
        }
    }

    function willOffer(templateId) {
        if (userEdited || offered || isLibrary()) return false;
        const url = currentUrl();
        if (!url || !isValidUrl(url)) return false;
        const tid = String(templateId || window.clipsStudio?.currentTemplateForPreview?.id || '');
        if (!isSplitscreen(tid)) return false;
        if (inflight && inflightKey === videoKeyFromUrl(url)) return true;
        if (recipe && recipe.ok && recipeUrl === url && Number(recipe.confidence) >= MIN_CONFIDENCE) return true;
        return false;
    }

    function isSplitscreen(tid) {
        const id = String(tid || '').toLowerCase();
        return id === 'splitscreen' || id.includes('split');
    }

    function didOffer() {
        return offered;
    }

    function markUserEdited() {
        userEdited = true;
        if (previewWait) {
            clearTimeout(previewWait);
            previewWait = null;
        }
    }

    function resetForUrl(url) {
        const key = videoKeyFromUrl(url);
        if (inflightKey && inflightKey !== key && inflight?.abort) {
            try { inflight.abort(); } catch (_) { /* ignore */ }
        }
        if (recipeUrl && recipeUrl !== url) {
            recipe = null;
            offered = false;
            userEdited = false;
        }
    }

    async function prefetch(url, extra) {
        url = String(url || '').trim();
        if (!url || !isValidUrl(url)) return null;
        resetForUrl(url);
        const key = videoKeyFromUrl(url);
        if (recipe && recipe.ok && recipeUrl === url && !extra?.force) {
            return recipe;
        }
        if (inflight && inflightKey === key && !extra?.force) return inflight.promise;

        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), FETCH_MS);
        const opened = extra?.templateId
            || window.clipsStudio?.currentTemplateForPreview?.id
            || '';
        const body = {
            url,
            allowed_templates: allowedTemplates(),
            template_id: opened || undefined,
            user_layout: isSplitscreen(opened) ? userLayout() : undefined,
            force: !!extra?.force,
        };
        const promise = (async () => {
            try {
                const res = await fetch(apiUrl('/api/clips/instant-recipe'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: authHeaders(),
                    body: JSON.stringify(body),
                    signal: ac.signal,
                });
                if (!res.ok) return null;
                const data = await res.json();
                if (!data || !data.ok) return null;
                recipe = data;
                recipeUrl = url;
                if (typeof window.solisLog === 'function') {
                    window.solisLog(
                        'InstantRecipe',
                        `${data.why_short || data.template} · ${Math.round((data.confidence || 0) * 100)}% · ${data.source || ''} · ${(data.skills || []).join('+') || 'rules'} · ${data.elapsed_ms || 0}ms`
                    );
                }
                return data;
            } catch (err) {
                if (err?.name === 'AbortError') return null;
                console.warn('[InstantRecipe] fetch failed:', err?.message || err);
                return null;
            } finally {
                clearTimeout(timer);
                if (inflight && inflightKey === key) inflight = null;
            }
        })();
        inflight = { promise, abort: () => ac.abort() };
        inflightKey = key;
        return promise;
    }

    function sendFeedback(accepted) {
        if (!recipe || !recipe.video_key) return;
        try {
            fetch(apiUrl('/api/clips/instant-recipe/feedback'), {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders(),
                body: JSON.stringify({
                    video_key: recipe.video_key,
                    channel_key: recipe.channel_key || '',
                    accepted: !!accepted,
                    recipe,
                }),
            }).catch(() => {});
        } catch (_) { /* ignore */ }
    }

    function applyToPreview(templateId) {
        if (!recipe || !recipe.ok || userEdited || isLibrary()) return false;
        if (Number(recipe.confidence) < MIN_CONFIDENCE) return false;
        const sm = window.SolisMemory;
        if (!sm || typeof sm.offerInstantRecipe !== 'function') return false;
        const tid = templateId || window.clipsStudio?.currentTemplateForPreview?.id;
        if (!tid || !isSplitscreen(tid)) return false;
        const ok = sm.offerInstantRecipe(recipe, tid);
        if (ok) {
            offered = true;
            if (recipe.captions && recipe.captions.on === false) {
                window.__solisRecipeSkipCaptions = true;
            } else if (recipe.captions && recipe.captions.on) {
                window.__solisCaptionsOptedIn = true;
            }
            if (recipe.hook && recipe.hook.on === false) {
                window.__solisRecipeSkipHook = true;
            }
        }
        return ok;
    }

    function onPreviewOpen(templateId) {
        offered = false;
        userEdited = false;
        window.__solisRecipeSkipCaptions = false;
        if (previewWait) {
            clearTimeout(previewWait);
            previewWait = null;
        }
        if (isLibrary()) return;

        const url = currentUrl();
        const run = async () => {
            if (userEdited) return;
            const data = recipe && recipeUrl === url
                ? recipe
                : await prefetch(url, { templateId });
            if (userEdited || !data) {
                try { window.SolisMemory?.retrySuggest?.(templateId); } catch (_) {}
                return;
            }
            if (!applyToPreview(templateId)) {
                try { window.SolisMemory?.retrySuggest?.(templateId); } catch (_) {}
            }
        };

        if (recipe && recipeUrl === url) {
            previewWait = setTimeout(run, 80);
        } else {
            prefetch(url, { templateId });
            previewWait = setTimeout(run, 220);
        }
    }

    function onPreviewClose() {
        if (previewWait) {
            clearTimeout(previewWait);
            previewWait = null;
        }
        offered = false;
        userEdited = false;
    }

    function wrapMemory() {
        const sm = window.SolisMemory;
        if (!sm || sm._irWrapped) return;
        const origLayout = sm.recordLayout;
        if (typeof origLayout === 'function') {
            sm.recordLayout = function () {
                try {
                    if (!sm._applying) markUserEdited();
                } catch (_) { /* ignore */ }
                return origLayout.apply(this, arguments);
            };
        }
        const origOpen = sm.onTemplatePreviewOpen;
        if (typeof origOpen === 'function') {
            sm.onTemplatePreviewOpen = function (templateId) {
                try { onPreviewOpen(templateId); } catch (_) { /* ignore */ }
                return origOpen.apply(this, arguments);
            };
        }
        const origClose = sm.onTemplatePreviewClose;
        if (typeof origClose === 'function') {
            sm.onTemplatePreviewClose = function () {
                try { onPreviewClose(); } catch (_) { /* ignore */ }
                return origClose.apply(this, arguments);
            };
        }
        sm._irWrapped = true;
    }

    function boot() {
        wrapMemory();
        if (!window.SolisMemory) {
            setTimeout(boot, 200);
        }
    }

    window.SolisInstantRecipe = {
        prefetch,
        willOffer,
        didOffer,
        markUserEdited,
        sendFeedback,
        get: () => recipe,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
