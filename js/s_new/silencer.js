/**
 * Solis Silencer — one-tap dead-air cleanup after generation.
 * Preview-only skip (no GPU). Undo restores instantly.
 */
(function initSolisSilencer() {
    const MIN_SILENCE_SEC = 0.5;
    const BREATH_SEC = 0.14;
    const MIN_CUT_SEC = 0.22;
    const AUDIO_FRAME_SEC = 0.05;
    const AUDIO_SILENCE_RATIO = 0.11;

    let applied = false;
    let removedSec = 0;
    let captionBackup = null;
    let busy = false;

    function $(id) {
        return document.getElementById(id);
    }

    function isLibraryPreview() {
        return Boolean(document.querySelector('.template-preview-content.is-library-preview'));
    }

    function getPreviewVideo() {
        const cont = $('templateVideoPreview');
        if (!cont) return null;
        return cont.querySelector('#splitscreenContentVideo')
            || cont.querySelector('.library-preview-video')
            || cont.querySelector('video');
    }

    function getDuration() {
        const trim = window.PreviewTimeline?.getTrim?.();
        if (trim?.duration > 0) return trim.duration;
        const v = getPreviewVideo();
        return (v && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    }

    function getTimedWords() {
        if (typeof window.resolveLiveCaptionTimed === 'function') {
            const w = window.resolveLiveCaptionTimed();
            if (Array.isArray(w) && w.length) return w;
        }
        try {
            const w = window.__solisLiveCaptionTimed;
            if (Array.isArray(w) && w.length) return w;
        } catch (_) { /* ignore */ }
        return null;
    }

    function mergeRegions(regions) {
        if (!regions.length) return [];
        const sorted = regions
            .map((r) => ({ start: Number(r.start), end: Number(r.end) }))
            .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end - r.start >= MIN_CUT_SEC)
            .sort((a, b) => a.start - b.start);
        const out = [];
        for (const r of sorted) {
            const last = out[out.length - 1];
            if (last && r.start <= last.end + 0.05) {
                last.end = Math.max(last.end, r.end);
            } else {
                out.push({ start: r.start, end: r.end });
            }
        }
        return out;
    }

    /** Cut interior of long pauses; keep a tiny breath so it doesn't feel choppy. */
    function cutFromGap(gapStart, gapEnd) {
        const len = gapEnd - gapStart;
        if (len < MIN_SILENCE_SEC) return null;
        const keep = Math.min(BREATH_SEC, Math.max(0.08, len * 0.22));
        const start = gapStart + keep;
        const end = gapEnd;
        if (end - start < MIN_CUT_SEC) return null;
        return { start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 };
    }

    function detectFromWords(words, duration) {
        const speech = (words || [])
            .filter((w) => w && w.kind !== 'reaction')
            .map((w) => ({
                start: Number(w.start),
                end: Number(w.end),
            }))
            .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start)
            .sort((a, b) => a.start - b.start);

        if (!speech.length) return [];

        const regions = [];
        const first = speech[0].start;
        if (first >= MIN_SILENCE_SEC) {
            const cut = cutFromGap(0, first);
            if (cut) regions.push(cut);
        }
        for (let i = 0; i < speech.length - 1; i++) {
            const gapStart = speech[i].end;
            const gapEnd = speech[i + 1].start;
            const cut = cutFromGap(gapStart, gapEnd);
            if (cut) regions.push(cut);
        }
        const lastEnd = speech[speech.length - 1].end;
        if (duration > 0 && duration - lastEnd >= MIN_SILENCE_SEC) {
            const cut = cutFromGap(lastEnd, duration);
            if (cut) regions.push(cut);
        }
        return mergeRegions(regions);
    }

    async function detectFromAudio(video, duration) {
        if (!video || duration < 1) return [];
        let src = video.currentSrc || video.src;
        if (!src) return [];

        let arrayBuf;
        try {
            if (typeof fetchSecureVideoObjectUrl === 'function' && src.startsWith('http')) {
                try {
                    src = await fetchSecureVideoObjectUrl(src);
                } catch (_) { /* fall through to direct fetch */ }
            }
            const res = await fetch(src, { credentials: 'include', cache: 'force-cache' });
            if (!res.ok) return [];
            arrayBuf = await res.arrayBuffer();
        } catch (_) {
            return [];
        }
        if (!arrayBuf || arrayBuf.byteLength < 1000) return [];

        const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return [];

        let audioCtx;
        try {
            audioCtx = new AudioCtx();
            const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
            await audioCtx.close().catch(() => {});
            audioCtx = null;

            const channel = decoded.getChannelData(0);
            const sr = decoded.sampleRate || 44100;
            const frame = Math.max(1, Math.floor(sr * AUDIO_FRAME_SEC));
            const energies = [];
            for (let i = 0; i < channel.length; i += frame) {
                let sum = 0;
                const end = Math.min(channel.length, i + frame);
                for (let j = i; j < end; j++) sum += channel[j] * channel[j];
                energies.push(Math.sqrt(sum / Math.max(1, end - i)));
            }
            if (!energies.length) return [];

            const sorted = energies.slice().sort((a, b) => a - b);
            const p85 = sorted[Math.floor(sorted.length * 0.85)] || 0.01;
            const threshold = Math.max(0.004, p85 * AUDIO_SILENCE_RATIO);

            const regions = [];
            let silentStart = -1;
            for (let i = 0; i < energies.length; i++) {
                const t = i * AUDIO_FRAME_SEC;
                const silent = energies[i] < threshold;
                if (silent && silentStart < 0) silentStart = t;
                if ((!silent || i === energies.length - 1) && silentStart >= 0) {
                    const endT = silent ? Math.min(duration, t + AUDIO_FRAME_SEC) : t;
                    const cut = cutFromGap(silentStart, endT);
                    if (cut) regions.push(cut);
                    silentStart = -1;
                }
            }
            return mergeRegions(regions);
        } catch (_) {
            try { await audioCtx?.close?.(); } catch (_) { /* ignore */ }
            return [];
        } finally {
            void AC;
        }
    }

    function totalRemoved(regions) {
        return regions.reduce((s, r) => s + Math.max(0, r.end - r.start), 0);
    }

    function formatRemoved(sec) {
        const n = Math.round(sec * 10) / 10;
        return Number.isInteger(n) ? String(n) : n.toFixed(1);
    }

    function showNote(text, { sticky = false } = {}) {
        const note = $('silencerNote');
        if (!note) return;
        note.hidden = false;
        note.textContent = text;
        note.classList.add('is-visible');
        if (note._hideTimer) clearTimeout(note._hideTimer);
        if (!sticky) {
            note._hideTimer = setTimeout(() => {
                note.classList.remove('is-visible');
                note.hidden = true;
            }, 3200);
        }
    }

    function hideNote() {
        const note = $('silencerNote');
        if (!note) return;
        if (note._hideTimer) clearTimeout(note._hideTimer);
        note.classList.remove('is-visible');
        note.hidden = true;
        note.textContent = '';
    }

    function setButtonState() {
        const btn = $('previewSilencerBtn');
        if (!btn) return;
        btn.classList.toggle('is-silenced', applied);
        btn.classList.toggle('active', applied);
        btn.setAttribute('aria-pressed', applied ? 'true' : 'false');
        btn.removeAttribute('title');
        btn.setAttribute('aria-label', applied ? 'Undo silence cleanup' : 'Remove silences');
        const label = btn.querySelector('.silencer-btn-label');
        if (label) label.textContent = applied ? 'Undo' : '';
    }

    function markDirty() {
        try {
            const studio = window.clipsStudio;
            if (!studio?.currentTemplateForPreview?.isLibraryPreview) return;
            // Real silence toggle — arm gate only blocks seed/layout false-dirties
            studio._librarySilenceDirty = !!applied;
            studio._librarySilenceCuts = applied
                ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice()
                : [];
            if (typeof window.syncLibraryConfirmLabel === 'function') {
                window.syncLibraryConfirmLabel();
            } else {
                const confirmBtn = $('confirmUseTemplateBtn');
                if (confirmBtn) {
                    confirmBtn.textContent = applied ? 'Apply & Download' : 'Download';
                    confirmBtn.classList.add('library-download-mode');
                }
                if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
            }
        } catch (_) { /* ignore */ }
    }

    function remapCaptionsForCuts(words, regions) {
        if (!Array.isArray(words) || !words.length || !regions.length) return words;
        return words.map((w) => {
            const start = Number(w.start);
            const end = Number(w.end);
            if (!Number.isFinite(start)) return w;
            // Drop words that live entirely inside a cut
            for (const r of regions) {
                if (start >= r.start - 0.01 && end <= r.end + 0.01) return null;
            }
            // Words keep source times — playback seeks over cuts, so alignment stays true.
            return { ...w, start, end };
        }).filter(Boolean);
    }

    async function detectCutsFromServer() {
        try {
            const projectId = window.clipsStudio?.currentTemplateForPreview?.projectId;
            if (!projectId) return [];
            const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '';
            const headers = (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {};
            const res = await fetch(
                `${apiBase}/clips/projects/${encodeURIComponent(projectId)}/silence-preview`,
                { credentials: 'include', headers },
            );
            if (!res.ok) return [];
            const body = await res.json().catch(() => ({}));
            const words = body.caption_preview_words;
            if (Array.isArray(words) && words.length
                && typeof window.setLiveCaptionTimedWords === 'function') {
                try { window.setLiveCaptionTimedWords(words); } catch (_) { /* ignore */ }
            }
            const cuts = Array.isArray(body.cuts) ? body.cuts : [];
            return mergeRegions(
                cuts.map((r) => ({ start: Number(r.start), end: Number(r.end) })),
            );
        } catch (_) {
            return [];
        }
    }

    async function detectCuts() {
        const duration = getDuration();
        const words = getTimedWords();
        let regions = detectFromWords(words, duration);
        if (!regions.length) {
            regions = await detectFromAudio(getPreviewVideo(), duration);
        }
        if (!regions.length) {
            regions = await detectCutsFromServer();
        }
        regions = mergeRegions(regions);

        // Scope to selected timeline block when user focused a split segment
        try {
            const range = window.PreviewTimeline?.getActiveEditRange?.();
            if (range && range.segIndex != null
                && Number.isFinite(range.start) && Number.isFinite(range.end)
                && range.end - range.start > 0.4) {
                regions = regions
                    .map((r) => ({
                        start: Math.max(r.start, range.start),
                        end: Math.min(r.end, range.end),
                    }))
                    .filter((r) => r.end - r.start >= 0.22);
                regions = mergeRegions(regions);
            }
        } catch (_) { /* ignore */ }

        return regions;
    }

    async function commitSilencer(regions) {
        if (!regions.length) return;

        const words = getTimedWords();
        removedSec = totalRemoved(regions);
        captionBackup = words ? words.map((w) => ({ ...w })) : null;

        window.PreviewTimeline.setSkipRegions(regions);

        if (words && typeof window.setLiveCaptionTimedWords === 'function') {
            const next = remapCaptionsForCuts(words, regions);
            window.setLiveCaptionTimedWords(next);
        }

        applied = true;
        setButtonState();
        markDirty();
        const range = window.PreviewTimeline?.getActiveEditRange?.();
        const scoped = range && range.segIndex != null;
        showNote(
            scoped
                ? `Removed ${formatRemoved(removedSec)}s silence in block ${range.segIndex + 1}`
                : `Removed ${formatRemoved(removedSec)}s of silence`,
        );

        const video = getPreviewVideo();
        if (video) {
            try {
                const t = video.currentTime || 0;
                const exit = window.PreviewTimeline.resolveSkipTime?.(t);
                if (exit != null && Math.abs(exit - t) > 0.05) {
                    video.currentTime = exit;
                }
                video.play().catch(() => {});
            } catch (_) { /* ignore */ }
        }
    }

    async function applySilencer() {
        if (busy || applied) return;
        if (!isLibraryPreview()) return;
        if (!window.PreviewTimeline?.setSkipRegions) {
            showNote('Preview not ready yet');
            return;
        }
        if (window.SolisSilenceCutSuggest?.isOpen?.()) return;

        busy = true;
        const btn = $('previewSilencerBtn');
        if (btn) btn.classList.add('is-working');

        try {
            showNote('Scanning for pauses…');
            const regions = await detectCuts();

            if (!regions.length) {
                showNote('No long pauses found');
                return;
            }

            const range = window.PreviewTimeline?.getActiveEditRange?.();
            const scoped = range && range.segIndex != null;
            const removed = formatRemoved(totalRemoved(regions));

            window.SolisSilenceCutSuggest?.show({
                source: 'silencer',
                regions,
                label: scoped
                    ? `Red = ${removed}s silence in block ${range.segIndex + 1} · Accept?`
                    : `Red = ${removed}s silence · Accept?`,
                onAccept: (regs) => { commitSilencer(regs); },
                onReject: () => { showNote('Silence cleanup dismissed'); },
            });
        } finally {
            busy = false;
            if (btn) btn.classList.remove('is-working');
        }
    }

    function undoSilencer() {
        if (!applied) return;
        try { window.SolisSilenceCutSuggest?.clear?.(); } catch (_) { /* ignore */ }
        if (window.PreviewTimeline?.clearSkipRegions) {
            window.PreviewTimeline.clearSkipRegions();
        }
        if (captionBackup && typeof window.setLiveCaptionTimedWords === 'function') {
            window.setLiveCaptionTimedWords(captionBackup);
        }
        captionBackup = null;
        removedSec = 0;
        applied = false;
        setButtonState();
        markDirty();
        hideNote();
        showNote('Silence restored');
    }

    function resetSilencer() {
        try { window.SolisSilenceCutSuggest?.clear?.(); } catch (_) { /* ignore */ }
        if (window.PreviewTimeline?.clearSkipRegions) {
            window.PreviewTimeline.clearSkipRegions();
        }
        captionBackup = null;
        removedSec = 0;
        applied = false;
        busy = false;
        setButtonState();
        hideNote();
        try {
            if (window.clipsStudio) {
                window.clipsStudio._librarySilenceDirty = false;
                window.clipsStudio._librarySilenceCuts = [];
            }
        } catch (_) { /* ignore */ }
    }

    function toggleSilencer(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!isLibraryPreview()) return;
        if (applied) undoSilencer();
        else applySilencer();
    }

    function syncVisibility() {
        const btn = $('previewSilencerBtn');
        const improve = $('previewImproveBtn');
        const mod = $('previewModifiersBtn');
        const menu = $('previewModifiersMenu');
        const pill = $('previewEditorPill');
        const lib = isLibraryPreview();
        if (btn) {
            btn.style.display = lib ? '' : 'none';
            if (!lib) resetSilencer();
            else setButtonState();
        }
        if (improve) {
            improve.style.display = lib ? '' : 'none';
            if (!lib) {
                try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
            } else {
                try { window.SolisImproveClip?.syncVisibility?.(); } catch (_) { /* ignore */ }
            }
        }
        if (mod) mod.style.display = lib ? 'none' : '';
        if (menu && lib) {
            menu.hidden = true;
            if (mod) mod.setAttribute('aria-expanded', 'false');
        }
        if (pill) {
            const silencerOn = lib && btn && btn.style.display !== 'none';
            const improveOn = lib && improve && improve.style.display !== 'none';
            const modifiersOn = !lib && mod && mod.style.display !== 'none';
            pill.classList.toggle('has-feature-tools', Boolean(silencerOn || improveOn || modifiersOn));
        }
    }

    window.SolisSilencer = {
        toggle: toggleSilencer,
        apply: applySilencer,
        undo: undoSilencer,
        reset: resetSilencer,
        syncVisibility,
        detectCuts,
        isApplied: () => applied,
        getCuts: () => (applied ? (window.PreviewTimeline?.getSkipRegions?.() || []).slice() : []),
        getRemovedSec: () => removedSec,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btn = $('previewSilencerBtn');
        if (btn && !btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', toggleSilencer);
        }
        syncVisibility();
    });
})();
