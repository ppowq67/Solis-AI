/**
 * Silence / improve cut preview — red timeline overlay + Accept/Reject (like subtitle memory).
 */
(function initSilenceCutSuggest() {
    let pending = null;
    let actionsEl = null;

    function $(id) {
        return document.getElementById(id);
    }

    function formatRemoved(sec) {
        const n = Math.round(sec * 10) / 10;
        return Number.isInteger(n) ? String(n) : n.toFixed(1);
    }

    function totalRemoved(regions) {
        return (regions || []).reduce((s, r) => s + Math.max(0, Number(r.end) - Number(r.start)), 0);
    }

    function ensureActions() {
        const wrap = $('previewTimelineWrap');
        if (actionsEl && actionsEl.parentElement === wrap) return actionsEl;
        if (actionsEl) actionsEl.remove();

        actionsEl = document.createElement('div');
        actionsEl.className = 'preview-timeline-cut-actions sub-mem-actions';
        actionsEl.id = 'previewCutActions';
        actionsEl.innerHTML = `
            <button type="button" class="sub-mem-btn sub-mem-decline" id="previewCutReject" title="Dismiss" aria-label="Dismiss">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>
                </svg>
            </button>
            <button type="button" class="sub-mem-btn sub-mem-accept" id="previewCutAccept" title="Apply · Tab" aria-label="Apply">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 10.2l3.4 3.4 7.6-7.8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;

        const bind = (sel, fn) => {
            const btn = actionsEl.querySelector(sel);
            if (!btn) return;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fn();
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        };
        bind('#previewCutAccept', accept);
        bind('#previewCutReject', reject);

        if (wrap) wrap.appendChild(actionsEl);
        else document.body.appendChild(actionsEl);
        return actionsEl;
    }

    function showActions() {
        const actions = ensureActions();
        actions.classList.remove('hidden');
        actions.classList.add('open');
    }

    function hideActions() {
        if (!actionsEl) return;
        actionsEl.classList.add('hidden');
        actionsEl.classList.remove('open');
    }

    function clearPreviewVisual() {
        try { window.PreviewTimeline?.clearSkipRegionsPreview?.(); } catch (_) { /* ignore */ }
    }

    function dismiss({ callReject = true } = {}) {
        const p = pending;
        pending = null;
        clearPreviewVisual();
        hideActions();
        if (callReject && p?.onReject) {
            try { p.onReject(p.regions); } catch (_) { /* ignore */ }
        }
    }

    function accept() {
        const p = pending;
        if (!p) return;
        pending = null;
        clearPreviewVisual();
        hideActions();
        try { p.onAccept?.(p.regions); } catch (_) { /* ignore */ }
    }

    function reject() {
        dismiss({ callReject: true });
    }

    function showNote(text) {
        const note = $('silencerNote');
        if (!note) return;
        note.hidden = false;
        note.textContent = text;
        note.classList.add('is-visible');
        if (note._cutHintTimer) clearTimeout(note._cutHintTimer);
        note._cutHintTimer = setTimeout(() => {
            note.classList.remove('is-visible');
            note._cutHintTimer = setTimeout(() => {
                if (note.textContent === text) note.hidden = true;
            }, 180);
        }, 2800);
    }

    /**
     * @param {{ regions: Array, source?: string, onAccept: Function, onReject?: Function, label?: string }} opts
     */
    async function show(opts) {
        const regions = Array.isArray(opts?.regions) ? opts.regions : [];
        if (!regions.length && opts?.source === 'silencer') return false;

        dismiss({ callReject: false });

        pending = {
            regions: regions.map((r) => ({ start: r.start, end: r.end })),
            source: opts?.source || 'silencer',
            onAccept: opts?.onAccept,
            onReject: opts?.onReject,
        };

        const deadline = Date.now() + 4500;
        while (Date.now() < deadline) {
            const trim = window.PreviewTimeline?.getTrim?.();
            if (window.PreviewTimeline?.isBound?.() && trim?.duration > 0) break;
            await new Promise((r) => setTimeout(r, 60));
        }

        try {
            window.PreviewTimeline?.setSkipRegionsPreview?.(pending.regions);
        } catch (_) { /* ignore */ }

        ensureActions();
        showActions();

        const removed = totalRemoved(pending.regions);
        const label = opts?.label
            || (removed > 0
                ? `Red = ${formatRemoved(removed)}s to remove · Accept?`
                : (opts?.source === 'improve'
                    ? 'Improve clip · Accept?'
                    : 'Review cuts · Accept?'));
        showNote(label);

        return true;
    }

    function isOpen() {
        return Boolean(pending);
    }

    function getPending() {
        return pending ? { ...pending, regions: pending.regions.slice() } : null;
    }

    document.addEventListener('keydown', (e) => {
        if (!pending) return;
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            accept();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            reject();
        }
    });

    window.addEventListener('resize', () => {
        if (pending) showActions();
    }, { passive: true });

    window.SolisSilenceCutSuggest = {
        show,
        accept,
        reject,
        dismiss,
        clear: () => dismiss({ callReject: false }),
        isOpen,
        getPending,
        reposition: showActions,
    };
})();
