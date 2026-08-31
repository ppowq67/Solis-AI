/**
 * Solis Improve Clip — one-tap polish that bakes silence cleanup.
 * Not premium: consumes 1 daily upload (same pool as Apply / generate).
 */
(function initSolisImproveClip() {
    let applied = false;
    let busy = false;
    let noteTimer = null;

    function $(id) {
        return document.getElementById(id);
    }

    function isLibraryPreview() {
        return Boolean(document.querySelector('.template-preview-content.is-library-preview'));
    }

    function getProjectId() {
        try {
            return window.clipsStudio?.currentTemplateForPreview?.projectId || null;
        } catch (_) {
            return null;
        }
    }

    function apiBase() {
        return (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
    }

    function authHeaders() {
        try {
            return (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {};
        } catch (_) {
            return {};
        }
    }

    function showNote(text) {
        const note = $('silencerNote');
        if (!note) return;
        if (noteTimer) clearTimeout(noteTimer);
        note.hidden = false;
        note.textContent = text;
        requestAnimationFrame(() => note.classList.add('is-visible'));
        noteTimer = setTimeout(() => {
            note.classList.remove('is-visible');
            noteTimer = setTimeout(() => {
                note.hidden = true;
                note.textContent = '';
                noteTimer = null;
            }, 200);
        }, 2800);
    }

    function setButtonState() {
        const btn = $('previewImproveBtn');
        if (!btn) return;
        btn.classList.toggle('is-improved', applied);
        btn.classList.toggle('active', applied);
        btn.setAttribute('aria-pressed', applied ? 'true' : 'false');
        btn.removeAttribute('title');
        btn.setAttribute(
            'aria-label',
            applied ? 'Clip improved' : 'Improve clip (uses 1 upload)',
        );
    }

    function syncVisibility() {
        const btn = $('previewImproveBtn');
        const pill = $('previewEditorPill');
        const lib = isLibraryPreview();
        if (btn) {
            btn.style.display = lib ? '' : 'none';
            if (!lib) {
                applied = false;
                setButtonState();
            } else {
                setButtonState();
            }
        }
        if (pill) {
            const silencer = $('previewSilencerBtn');
            const silencerOn = lib && silencer && silencer.style.display !== 'none';
            const improveOn = lib && btn && btn.style.display !== 'none';
            const mod = $('previewModifiersBtn');
            const modifiersOn = !lib && mod && mod.style.display !== 'none';
            pill.classList.toggle('has-feature-tools', Boolean(silencerOn || improveOn || modifiersOn));
        }
    }

    async function reloadImprovedPreview(projectId) {
        const studio = window.clipsStudio;
        if (!studio || !projectId) return;
        try { window.LibraryPreviewMediaCache?.invalidateProject?.(projectId); } catch (_) { /* ignore */ }
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try {
            studio._librarySilenceDirty = false;
            studio._librarySilenceCuts = [];
        } catch (_) { /* ignore */ }

        const cardId = studio.currentTemplateForPreview?.libraryCardId
            || studio.currentTemplateForPreview?.id
            || null;
        if (typeof studio.openLibraryPreview === 'function' && cardId) {
            try {
                await studio.openLibraryPreview(cardId, projectId, null, { fast: true, force: true });
                return;
            } catch (_) { /* fall through */ }
        }
        // Soft fallback: bump video src cache-buster
        const cont = $('templateVideoPreview');
        const video = cont?.querySelector('video');
        if (video?.src) {
            try {
                const u = new URL(video.src, window.location.origin);
                u.searchParams.set('_imp', String(Date.now()));
                video.src = u.toString();
                video.load();
            } catch (_) { /* ignore */ }
        }
    }

    function showOutOfUploadsUpgrade() {
        showNote('Need extra uploads');
        try {
            if (typeof window.showUpgradeModal === 'function') {
                window.showUpgradeModal(
                    'Need extra uploads',
                    'Improve clip uses 1 upload. You’re out for today — upgrade anytime for a higher daily limit.',
                );
            }
        } catch (_) { /* ignore */ }
    }

    async function hasUploadQuota() {
        try {
            const studio = window.clipsStudio;
            let data = null;
            if (typeof studio?._getCachedLimitCheck === 'function') {
                data = await studio._getCachedLimitCheck();
            } else {
                const r = await fetch(`${apiBase()}/clips/status`, {
                    method: 'GET',
                    headers: authHeaders(),
                    credentials: 'include',
                });
                data = r.ok ? await r.json() : null;
            }
            const clips = data?.clips || data || {};
            if (clips.daily_limit_reached === true) return false;
            const daily = clips.daily || {};
            const remaining = daily.remaining;
            if (remaining != null && Number(remaining) <= 0) return false;
            if (clips.monthly_limit_reached === true) return false;
            const monthly = clips.monthly || {};
            if (monthly.remaining != null && Number(monthly.remaining) <= 0 && Number(monthly.limit) > 0) {
                return false;
            }
            return true;
        } catch (_) {
            // If quota check fails, let the API decide
            return true;
        }
    }

    async function runImproveApi(cuts) {
        const projectId = getProjectId();
        if (!projectId) {
            showNote('Open a library clip first');
            return;
        }

        busy = true;
        const btn = $('previewImproveBtn');
        if (btn) btn.classList.add('is-working');

        try {
            showNote('Improving…');
            if (!Array.isArray(cuts)) cuts = [];

            let rangePayload = null;
            try {
                const range = window.PreviewTimeline?.getActiveEditRange?.();
                if (range && range.segIndex != null
                    && Number.isFinite(range.start) && Number.isFinite(range.end)) {
                    rangePayload = {
                        start: Number(range.start.toFixed(3)),
                        end: Number(range.end.toFixed(3)),
                    };
                }
            } catch (_) { /* ignore */ }

            const response = await fetch(
                `${apiBase()}/clips/projects/${encodeURIComponent(projectId)}/improve`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({
                        silence_cuts: cuts.map((r) => ({
                            start: Number(Number(r.start).toFixed(3)),
                            end: Number(Number(r.end).toFixed(3)),
                        })),
                        ...(rangePayload ? { edit_range: rangePayload } : {}),
                    }),
                },
            );

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                const code = body?.error_code || '';
                if (code === 'NOTHING_TO_IMPROVE') {
                    showNote(body?.error || 'Already tight — nothing to improve');
                    return;
                }
                if (code === 'DAILY_LIMIT_REACHED' || code === 'MONTHLY_LIMIT_REACHED' || response.status === 429) {
                    showOutOfUploadsUpgrade();
                    return;
                }
                showNote(body?.error || 'Couldn’t improve yet');
                return;
            }

            applied = true;
            setButtonState();
            await reloadImprovedPreview(projectId);

            try {
                if (window.clipsStudio?.refreshQuotaAfterApply) {
                    await window.clipsStudio.refreshQuotaAfterApply(body);
                }
            } catch (_) { /* ignore */ }

            const removed = Number(body?.removed_sec);
            const fixed = Boolean(body?.boundaries_fixed || body?.edge_trimmed);
            const caps = Boolean(body?.captions_fixed);
            if (caps && fixed && Number.isFinite(removed) && removed > 0) {
                showNote(`Cuts + captions retuned · −${removed.toFixed(1)}s (1 upload)`);
            } else if (fixed && Number.isFinite(removed) && removed > 0) {
                showNote(`Cuts sharpened · removed ${removed.toFixed(1)}s (1 upload)`);
            } else if (Number.isFinite(removed) && removed > 0) {
                showNote(`Improved — removed ${removed.toFixed(1)}s (1 upload)`);
            } else if (caps) {
                showNote('Captions retuned (1 upload)');
            } else if (fixed) {
                showNote('Cut boundaries sharpened (1 upload)');
            } else {
                showNote('Clip improved (1 upload)');
            }
        } catch (_) {
            showNote('Couldn’t improve yet');
        } finally {
            busy = false;
            if (btn) btn.classList.remove('is-working');
        }
    }

    async function applyImprove() {
        if (busy || applied) return;
        if (!isLibraryPreview()) return;
        if (window.SolisSilenceCutSuggest?.isOpen?.()) return;

        const projectId = getProjectId();
        if (!projectId) {
            showNote('Open a library clip first');
            return;
        }

        const okQuota = await hasUploadQuota();
        if (!okQuota) {
            showOutOfUploadsUpgrade();
            return;
        }

        busy = true;
        const btn = $('previewImproveBtn');
        if (btn) btn.classList.add('is-working');

        try {
            const silencer = window.SolisSilencer;
            let cuts = [];
            if (typeof silencer?.detectCuts === 'function') {
                cuts = await silencer.detectCuts();
            } else if (typeof silencer?.isApplied === 'function' && silencer.isApplied()) {
                cuts = silencer.getCuts?.() || [];
            }
            if (!Array.isArray(cuts)) cuts = [];

            const removed = cuts.reduce((s, r) => s + Math.max(0, Number(r.end) - Number(r.start)), 0);
            const label = removed > 0
                ? `Red = ~${removed.toFixed(1)}s to trim · Improve uses 1 upload`
                : 'Improve clip boundaries · uses 1 upload';

            window.SolisSilenceCutSuggest?.show({
                source: 'improve',
                regions: cuts,
                label,
                onAccept: (regs) => { runImproveApi(regs); },
                onReject: () => { showNote('Improve dismissed'); },
            });
        } finally {
            busy = false;
            if (btn) btn.classList.remove('is-working');
        }
    }

    function toggleImprove() {
        if (busy) return;
        if (!isLibraryPreview()) return;
        if (applied) {
            showNote('Already improved for this clip');
            return;
        }
        applyImprove();
    }

    function resetImprove() {
        applied = false;
        busy = false;
        try { window.SolisSilenceCutSuggest?.clear?.(); } catch (_) { /* ignore */ }
        const btn = $('previewImproveBtn');
        if (btn) btn.classList.remove('is-working', 'is-improved', 'active');
        setButtonState();
    }

    window.SolisImproveClip = {
        toggle: toggleImprove,
        apply: applyImprove,
        reset: resetImprove,
        syncVisibility,
        isApplied: () => applied,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btn = $('previewImproveBtn');
        if (btn && !btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', toggleImprove);
        }
        syncVisibility();
    });
})();
