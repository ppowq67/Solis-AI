/**
 * Plan selector pill — Gemini-style dropdown near the URL submit button.
 * Shows current plan + generations remaining from /api/tier/info.
 *
 * Effort:
 *   Auto (default) — Solis picks Low/Normal/Max from the video + plan
 *   Advanced — manual Low / Normal / Max (slider or classic flyout)
 *
 * Plan gates: Low (all) · Normal (basic+) · Max (prime/elite).
 */
(function () {
    const PLAN_LABELS = {
        free: 'Free Plan',
        basic: 'Basic Plan',
        prime: 'Prime Plan',
        elite: 'Elite Plan',
    };

    const EFFORT_LABELS = {
        auto: 'Auto',
        low: 'Low',
        normal: 'Normal',
        max: 'Max',
    };

    const EFFORT_STORAGE_KEY = 'solis_effort_mode';
    const EFFORT_SELECTION_KEY = 'solis_effort_selection'; // auto | advanced
    const EFFORT_UI_STORAGE_KEY = 'solis_effort_ui_mode';
    const QUOTA_DISMISS_KEY = 'solis_quota_rail_dismiss';
    const CACHE_TTL_MS = 60_000;
    const EFFORT_ORDER = ['low', 'normal', 'max'];

    let tierData = null;
    let tierFetchedAt = 0;
    let fetchPromise = null;
    let selectedEffort = 'low';       // manual Low/Normal/Max when Advanced
    let effortSelection = 'auto';     // auto | advanced — Auto is default
    let currentTier = 'free';
    let effortFlyoutOpen = false;
    let effortUiMode = 'slider';
    let quotaStatus = null;
    let sliderDragging = false;

    function isAutoMode() {
        return effortSelection !== 'advanced';
    }

    function readEffortSelection() {
        try {
            const v = localStorage.getItem(EFFORT_SELECTION_KEY);
            if (v === 'advanced' || v === 'auto') return v;
        } catch (_) {}
        return 'auto';
    }

    function persistEffortSelection(mode) {
        try {
            localStorage.setItem(EFFORT_SELECTION_KEY, mode === 'advanced' ? 'advanced' : 'auto');
        } catch (_) {}
    }

    let advancedBodyAnimTimer = 0;
    const ADVANCED_BODY_MS = 380;

    function setEffortSelection(mode, { persist = true, animate = true } = {}) {
        effortSelection = mode === 'advanced' ? 'advanced' : 'auto';
        if (persist) persistEffortSelection(effortSelection);
        syncAdvancedModeUI({ animate });
        syncEffortUI();
        if (tierData) syncQuotaRail(tierData, quotaStatus);
    }

    function setAdvancedBodyVisible(expanded, { animate = true } = {}) {
        const body = document.getElementById('planEffortAdvancedBody');
        if (!body) return;

        window.clearTimeout(advancedBodyAnimTimer);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const useAnim = animate && !reduceMotion;

        if (expanded) {
            body.hidden = false;
            body.setAttribute('aria-hidden', 'false');
            if (useAnim) {
                body.classList.remove('is-expanded');
                void body.offsetHeight;
                requestAnimationFrame(() => {
                    body.classList.add('is-expanded');
                });
            } else {
                body.classList.add('is-expanded');
            }
        } else {
            body.setAttribute('aria-hidden', 'true');
            body.classList.remove('is-expanded');
            if (useAnim && !body.hidden) {
                advancedBodyAnimTimer = window.setTimeout(() => {
                    body.hidden = true;
                }, ADVANCED_BODY_MS);
            } else {
                body.hidden = true;
            }
        }
    }

    function syncAdvancedModeUI(options = {}) {
        const animate = options.animate !== false;
        const autoOn = isAutoMode();
        const toggle = document.getElementById('planEffortAdvancedToggle');
        const title = document.getElementById('planEffortModeTitle');
        const hint = document.getElementById('planEffortModeHint');
        const row = document.getElementById('planEffortModeRow');

        if (toggle) {
            // Toggle represents Auto Mode: ON = Auto, OFF = manual effort slider
            toggle.setAttribute('aria-checked', autoOn ? 'true' : 'false');
            toggle.classList.toggle('is-on', autoOn);
            toggle.setAttribute('aria-label', 'Auto Mode');
        }

        setAdvancedBodyVisible(!autoOn, { animate });

        if (title) title.textContent = 'Auto';
        if (hint) {
            if (autoOn) {
                hint.textContent = currentTier === 'free'
                    ? 'Solis picks the best effort for your video'
                    : 'Balanced quality and speed, recommended for most tasks';
                // Expand bio after text is set
                requestAnimationFrame(() => hint.classList.remove('is-collapsed'));
            } else {
                hint.classList.add('is-collapsed');
            }
        }
        if (row) row.dataset.mode = autoOn ? 'auto' : 'manual';

        // Manual effort controls only when Auto Mode is off
        applyEffortUiMode(effortUiMode, { persist: false, animate });
        if (autoOn) closeEffortFlyout();
    }

    function isCacheFresh() {
        return tierData && Date.now() - tierFetchedAt < CACHE_TTL_MS;
    }

    function invalidateTierCache() {
        tierData = null;
        tierFetchedAt = 0;
        fetchPromise = null;
    }

    function formatResetLabel(gen) {
        if (!gen) return '';
        const hours = gen.reset_hours ?? 24;
        // Daily allotment is already shown as "N / M left today" — don't repeat it
        if (hours <= 24) return '';
        const days = Math.round(hours / 24);
        return days === 1 ? 'Resets every day' : `Resets every ${days} days`;
    }

    function allowedEffortsForTier(tier) {
        const t = String(tier || 'free').toLowerCase();
        if (t === 'free') return ['low'];
        if (t === 'basic') return ['low', 'normal'];
        if (t === 'prime' || t === 'elite') return ['low', 'normal', 'max'];
        return ['low'];
    }

    function defaultEffortForTier(tier) {
        const allowed = allowedEffortsForTier(tier);
        return allowed.includes('normal') ? 'normal' : allowed[0];
    }

    function readStoredEffort() {
        try {
            const v = localStorage.getItem(EFFORT_STORAGE_KEY);
            if (v && EFFORT_LABELS[v]) return v;
        } catch (_) {}
        return null;
    }

    function persistEffort(effort) {
        try {
            localStorage.setItem(EFFORT_STORAGE_KEY, effort);
        } catch (_) {}
    }

    function readEffortUiMode() {
        try {
            const v = localStorage.getItem(EFFORT_UI_STORAGE_KEY);
            if (v === 'slider' || v === 'flyout') return v;
        } catch (_) {}
        return 'slider';
    }

    function persistEffortUiMode(mode) {
        try {
            localStorage.setItem(EFFORT_UI_STORAGE_KEY, mode === 'slider' ? 'slider' : 'flyout');
        } catch (_) {}
    }

    function effortIndex(effort) {
        const i = EFFORT_ORDER.indexOf(effort);
        return i >= 0 ? i : 0;
    }

    function effortFromIndex(index) {
        return EFFORT_ORDER[Math.max(0, Math.min(EFFORT_ORDER.length - 1, index))] || 'low';
    }

    function isEffortSelectable(mode) {
        const allowed = allowedEffortsForTier(currentTier);
        if (!allowed.includes(mode)) return false;
        if (mode === 'max') {
            const maxInfo = tierData?.generations || {};
            const maxLimit = maxInfo.max_effort_per_day ?? 0;
            const maxRem = maxInfo.max_effort_remaining;
            if (maxLimit > 0 && typeof maxRem === 'number' && maxRem <= 0) return false;
        }
        return true;
    }

    function pulseEffortProBadge(mode) {
        const step = effortIndex(mode);
        const sliderBadge = document.querySelector(`.plan-effort-slider-pro[data-step="${step}"]`);
        const flyoutBadge = document.querySelector(`.plan-effort-option[data-effort="${mode}"] .plan-effort-pro-badge`);
        const badge = (sliderBadge && !sliderBadge.hasAttribute('hidden'))
            ? sliderBadge
            : (flyoutBadge && !flyoutBadge.hasAttribute('hidden') ? flyoutBadge : null);
        if (!badge) return;
        badge.classList.remove('is-pulse');
        void badge.offsetWidth;
        badge.classList.add('is-pulse');
        window.setTimeout(() => badge.classList.remove('is-pulse'), 560);
    }

    function notifyEffortLocked(mode) {
        if (mode === 'max') {
            const maxInfo = tierData?.generations || {};
            const maxLimit = maxInfo.max_effort_per_day ?? 0;
            const maxRem = maxInfo.max_effort_remaining;
            if (maxLimit > 0 && typeof maxRem === 'number' && maxRem <= 0) {
                if (typeof showNotification === 'function') {
                    showNotification(`Max daily limit reached (${maxLimit}/day). Use Normal effort.`, 'info');
                }
                return;
            }
            pulseEffortProBadge(mode);
            return;
        }
        if (mode === 'normal') {
            pulseEffortProBadge(mode);
        }
    }

    function applyEffortUiMode(mode, { persist = true, animate = true } = {}) {
        const next = mode === 'slider' ? 'slider' : 'flyout';
        const changed = effortUiMode !== next || document.documentElement.dataset.effortUi !== next;
        const advanced = !isAutoMode();

        if (changed && next === 'slider') closeEffortFlyout();

        effortUiMode = next;
        document.documentElement.dataset.effortUi = next;
        if (persist) persistEffortUiMode(next);

        const trigger = getEffortTrigger();
        const card = getSliderPanel();
        if (trigger) {
            // Classic flyout trigger only in Advanced + flyout UI
            trigger.hidden = !advanced || next === 'slider';
            trigger.setAttribute('aria-controls', 'planEffortFlyout');
            if (!advanced || next === 'slider') trigger.setAttribute('aria-expanded', 'false');
        }
        if (card) {
            if (advanced && next === 'slider') {
                card.hidden = false;
                card.classList.remove('is-ready');
                const reveal = () => {
                    card.classList.add('is-ready');
                    syncEffortSliderUI();
                };
                if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    window.setTimeout(reveal, 60);
                } else {
                    reveal();
                }
            } else {
                card.classList.remove('is-ready');
                card.hidden = true;
            }
        }
        syncEffortUI();
    }

    function resolveEffortForTier(tier) {
        const allowed = allowedEffortsForTier(tier);
        const stored = readStoredEffort();
        if (stored && allowed.includes(stored)) return stored;
        return defaultEffortForTier(tier);
    }

    function setEffort(effort, { persist = true, closeFlyout = true, animate = false } = {}) {
        if (!isEffortSelectable(effort)) return false;
        selectedEffort = effort;
        if (persist) persistEffort(effort);
        syncEffortUI({ animate });
        if (closeFlyout && effortUiMode === 'flyout') closeEffortFlyout();
        return true;
    }

    function setSliderT(t, { animate = false, magnet = false } = {}) {
        const slider = document.getElementById('planEffortSlider');
        if (!slider) return;
        const clamped = Math.max(0, Math.min(1, t));
        slider.style.setProperty('--effort-t', String(clamped));
        slider.classList.toggle('is-max', clamped >= 0.98);

        window.clearTimeout(setSliderT._snapTimer);
        slider.classList.toggle('is-snapping', animate);
        slider.classList.toggle('is-magnet', magnet && !animate);

        if (animate || magnet) {
            setSliderT._snapTimer = window.setTimeout(() => {
                slider.classList.remove('is-snapping', 'is-magnet');
            }, animate ? 280 : 200);
        } else {
            slider.classList.remove('is-snapping', 'is-magnet');
        }
    }

    function clearMaxBits() {
        const slider = document.getElementById('planEffortSlider');
        if (!slider) return;
        slider.classList.remove('is-bits-live');
    }

    function playMaxBitsBurst() {
        const slider = document.getElementById('planEffortSlider');
        if (!slider) return;
        slider.classList.remove('is-bits-live');
        // Force restart so burst plays every time we land on Max
        void slider.offsetWidth;
        requestAnimationFrame(() => {
            if (selectedEffort === 'max' && !sliderDragging) {
                slider.classList.add('is-bits-live', 'is-max');
            }
        });
    }

    function syncMaxBits() {
        if (sliderDragging) {
            clearMaxBits();
            return;
        }
        if (selectedEffort === 'max') playMaxBitsBurst();
        else clearMaxBits();
    }

    function clientXToSliderT(clientX) {
        const track = document.getElementById('planEffortSliderTrack');
        if (!track) return 0;
        const rect = track.getBoundingClientRect();
        const thumb = 18;
        const usable = Math.max(1, rect.width - thumb);
        return Math.max(0, Math.min(1, (clientX - rect.left - thumb / 2) / usable));
    }

    function magnetizeT(t) {
        const max = EFFORT_ORDER.length - 1;
        const radius = 0.16;
        let bestT = t;
        let bestDist = radius;
        let snapped = false;

        for (let i = 0; i <= max; i += 1) {
            if (!isEffortSelectable(effortFromIndex(i))) continue;
            const stepT = i / max;
            const dist = Math.abs(t - stepT);
            if (dist <= bestDist) {
                bestDist = dist;
                bestT = stepT;
                snapped = true;
            }
        }
        return { t: bestT, snapped, index: Math.round(bestT * max) };
    }

    function nearestAllowedIndex(rawIndex) {
        const max = EFFORT_ORDER.length - 1;
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i <= max; i += 1) {
            if (!isEffortSelectable(effortFromIndex(i))) continue;
            const dist = Math.abs(i - rawIndex);
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }
        return best == null ? 0 : best;
    }

    function syncEffortSliderUI({ animate = false } = {}) {
        const index = effortIndex(selectedEffort);
        const label = EFFORT_LABELS[selectedEffort] || 'Low';
        const t = index / (EFFORT_ORDER.length - 1);
        const allowed = allowedEffortsForTier(currentTier);

        const slider = document.getElementById('planEffortSlider');
        const valueEl = document.getElementById('planEffortSliderValue');
        const panel = document.getElementById('planEffortSliderPanel');

        if (!sliderDragging) setSliderT(t, { animate });
        if (valueEl) valueEl.textContent = label;
        if (slider) {
            slider.setAttribute('aria-valuenow', String(index));
            slider.setAttribute('aria-valuetext', label);
            slider.classList.toggle('is-single', allowed.length <= 1);
            slider.classList.toggle('is-max', selectedEffort === 'max');
        }
        if (!sliderDragging) {
            if (selectedEffort === 'max') {
                if (!slider?.classList.contains('is-bits-live')) playMaxBitsBurst();
            } else {
                clearMaxBits();
            }
        } else {
            clearMaxBits();
        }
        if (panel) {
            panel.querySelectorAll('.plan-effort-slider-dot').forEach((dot) => {
                const step = Number(dot.dataset.step || 0);
                const mode = effortFromIndex(step);
                const liveIndex = sliderDragging
                    ? Math.round((Number(slider?.style.getPropertyValue('--effort-t')) || t) * (EFFORT_ORDER.length - 1))
                    : index;
                dot.classList.toggle('is-passed', step <= liveIndex);
                dot.classList.toggle('is-locked', !allowed.includes(mode));
            });
            panel.querySelectorAll('.plan-effort-slider-pro').forEach((badge) => {
                const step = Number(badge.dataset.step || 0);
                const mode = effortFromIndex(step);
                if (!allowed.includes(mode)) badge.removeAttribute('hidden');
                else badge.setAttribute('hidden', '');
            });
        }
    }

    function isCompactPlanUi() {
        try {
            return window.matchMedia('(max-width: 768px)').matches;
        } catch (_) {
            return window.innerWidth <= 768;
        }
    }

    function syncEffortUI(options) {
        const displayKey = isAutoMode() ? 'auto' : selectedEffort;
        const label = EFFORT_LABELS[displayKey] || 'Auto';

        const planLabel = document.getElementById('planSelectorLabel');
        if (planLabel) {
            planLabel.removeAttribute('hidden');
            if (!planLabel.textContent.trim()) {
                const tierName = (currentTier || 'free').charAt(0).toUpperCase() + (currentTier || 'free').slice(1);
                planLabel.textContent = `${tierName} Plan`;
            }
        }

        const wrap = document.getElementById('planSelectorWrap');
        if (wrap) {
            wrap.dataset.effortSelection = isAutoMode() ? 'auto' : 'advanced';
            wrap.dataset.effort = displayKey;
        }
        const popover = getPopover();
        if (popover) {
            popover.dataset.effortSelection = isAutoMode() ? 'auto' : 'advanced';
            popover.dataset.effort = displayKey;
        }

        const effortEl = document.getElementById('planSelectorEffort');
        if (effortEl) {
            effortEl.textContent = label;
            effortEl.dataset.effort = displayKey;
        }

        const btn = document.getElementById('planSelectorBtn');
        if (btn) {
            const planName = planLabel?.textContent?.trim() || 'Plan';
            const compact = isCompactPlanUi();
            btn.setAttribute(
                'aria-label',
                compact
                    ? `${label}. ${planName} usage`
                    : `${planName}, ${label}`,
            );
        }

        const triggerValue = document.getElementById('planEffortTriggerValue');
        if (triggerValue) triggerValue.textContent = EFFORT_LABELS[selectedEffort] || 'Low';

        if (!isAutoMode()) {
            syncEffortSliderUI(options);
        }

        const flyout = document.getElementById('planEffortFlyout');
        if (!flyout) return;

        const allowed = allowedEffortsForTier(currentTier);
        flyout.querySelectorAll('.plan-effort-option').forEach((btn) => {
            const mode = btn.dataset.effort;
            const isAllowed = allowed.includes(mode);
            const isActive = mode === selectedEffort;
            const proBadge = btn.querySelector('.plan-effort-pro-badge');
            const hint = btn.querySelector('.plan-effort-option-hint');

            btn.classList.toggle('is-locked', !isAllowed);
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');

            if (proBadge) {
                if (!isAllowed) proBadge.removeAttribute('hidden');
                else proBadge.setAttribute('hidden', '');
            }
            if (hint) {
                hint.hidden = !isAllowed;
            }

            if (isAllowed && mode === 'max') {
                const maxInfo = tierData?.generations || {};
                const maxLimit = maxInfo.max_effort_per_day ?? 0;
                const maxRem = maxInfo.max_effort_remaining;
                if (maxLimit > 0 && typeof maxRem === 'number') {
                    btn.title = `Max — ${maxRem}/${maxLimit} left today`;
                    if (maxRem <= 0) {
                        btn.classList.add('is-locked');
                        btn.title = `Max daily limit reached (${maxLimit}/day)`;
                    }
                } else {
                    btn.title = 'Max — best interesting moments + cleaner cuts';
                }
            } else {
                btn.title = isAllowed
                    ? (mode === 'normal'
                        ? 'Normal — balanced speed and quality'
                        : 'Low — fast, smart picks, low compute')
                    : mode === 'max'
                        ? 'Max effort requires Prime or Elite'
                        : mode === 'normal'
                            ? 'Normal effort requires Basic or higher'
                            : 'Locked on your plan';
            }
        });
    }

    function getFlyout() {
        return document.getElementById('planEffortFlyout');
    }

    function getSliderPanel() {
        return document.getElementById('planEffortSliderPanel');
    }

    function getEffortTrigger() {
        return document.getElementById('planEffortTrigger');
    }

    function positionEffortFlyoutSide() {
        const popover = getPopover();
        if (!popover) return;
        const rect = popover.getBoundingClientRect();
        const flyoutWidth = 176;
        const spaceRight = window.innerWidth - rect.right;
        const openLeft = spaceRight < flyoutWidth + 16 && rect.left > flyoutWidth + 16;
        popover.classList.toggle('effort-open-left', openLeft);
    }

    function openEffortFlyout() {
        if (effortUiMode === 'slider') return;
        const popover = getPopover();
        const flyout = getFlyout();
        const trigger = getEffortTrigger();
        if (!popover || !flyout || !trigger) return;

        effortFlyoutOpen = true;
        flyout.hidden = false;
        positionEffortFlyoutSide();
        requestAnimationFrame(() => {
            popover.classList.add('effort-open');
            flyout.classList.add('is-open');
        });
        trigger.setAttribute('aria-expanded', 'true');
        syncEffortUI();
    }

    function closeEffortFlyout() {
        const popover = getPopover();
        const flyout = getFlyout();
        const trigger = getEffortTrigger();
        if (!popover || !flyout) return;

        effortFlyoutOpen = false;
        popover.classList.remove('effort-open', 'effort-open-left');
        flyout.classList.remove('is-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');

        const finish = () => {
            if (!effortFlyoutOpen) flyout.hidden = true;
            flyout.removeEventListener('transitionend', finish);
        };
        flyout.addEventListener('transitionend', finish);
        setTimeout(finish, 280);
    }

    function toggleEffortControl() {
        if (effortUiMode === 'slider') return;
        if (effortFlyoutOpen) closeEffortFlyout();
        else openEffortFlyout();
    }

    function trySelectEffortFromSlider(index, { animate = true } = {}) {
        const wanted = effortFromIndex(index);
        const allowedIndex = nearestAllowedIndex(index);
        const mode = effortFromIndex(allowedIndex);

        if (wanted !== mode) notifyEffortLocked(wanted);

        return setEffort(mode, { closeFlyout: false, animate });
    }

    function bindEffortSliderInteractions() {
        const slider = document.getElementById('planEffortSlider');
        if (!slider || slider.dataset.bound === 'true') return;
        slider.dataset.bound = 'true';

        const valueEl = document.getElementById('planEffortSliderValue');
        let activePointerId = null;
        let lastMagnetIndex = null;

        const previewFromT = (rawT) => {
            const magnet = magnetizeT(rawT);
            const pulled = magnet.snapped;
            const t = magnet.t;
            const index = magnet.index;

            clearMaxBits();

            if (pulled && lastMagnetIndex !== index) {
                setSliderT(t, { magnet: true });
            } else if (pulled) {
                setSliderT(t, { animate: false });
            } else {
                lastMagnetIndex = null;
                setSliderT(rawT, { animate: false });
            }
            if (pulled) lastMagnetIndex = index;

            const label = EFFORT_LABELS[effortFromIndex(index)] || 'Low';
            if (valueEl) valueEl.textContent = label;
            slider.classList.toggle('is-max', index === EFFORT_ORDER.length - 1 && isEffortSelectable('max'));

            const panel = document.getElementById('planEffortSliderPanel');
            panel?.querySelectorAll('.plan-effort-slider-dot').forEach((dot) => {
                const step = Number(dot.dataset.step || 0);
                dot.classList.toggle('is-passed', step <= index);
                dot.classList.toggle('is-magnet-hot', pulled && step === index);
            });
        };

        const finishDrag = (clientX) => {
            const magnet = magnetizeT(clientXToSliderT(clientX));
            sliderDragging = false;
            lastMagnetIndex = null;
            slider.classList.remove('is-dragging');
            slider.querySelectorAll('.plan-effort-slider-dot').forEach((dot) => {
                dot.classList.remove('is-magnet-hot');
            });
            trySelectEffortFromSlider(magnet.index, { animate: true });
            syncMaxBits();
            if (tierData) syncQuotaRail(tierData, quotaStatus);
        };

        slider.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            activePointerId = e.pointerId;
            sliderDragging = true;
            lastMagnetIndex = null;
            clearMaxBits();
            slider.classList.add('is-dragging');
            slider.classList.remove('is-snapping', 'is-magnet');
            try {
                slider.setPointerCapture(e.pointerId);
            } catch (_) {}
            previewFromT(clientXToSliderT(e.clientX));
            slider.focus({ preventScroll: true });
        });

        slider.addEventListener('pointermove', (e) => {
            if (!sliderDragging || e.pointerId !== activePointerId) return;
            e.preventDefault();
            previewFromT(clientXToSliderT(e.clientX));
        });

        const endPointer = (e) => {
            if (!sliderDragging || (activePointerId != null && e.pointerId !== activePointerId)) return;
            e.preventDefault();
            e.stopPropagation();
            const x = e.clientX;
            activePointerId = null;
            try {
                slider.releasePointerCapture(e.pointerId);
            } catch (_) {}
            finishDrag(x);
        };

        slider.addEventListener('pointerup', endPointer);
        slider.addEventListener('pointercancel', endPointer);

        slider.addEventListener('keydown', (e) => {
            const current = effortIndex(selectedEffort);
            let next = current;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + 1;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - 1;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = EFFORT_ORDER.length - 1;
            else return;

            e.preventDefault();
            trySelectEffortFromSlider(next, { animate: true });
            syncMaxBits();
            if (tierData) syncQuotaRail(tierData, quotaStatus);
        });
    }

    async function fetchTierInfo(forceRefresh = false) {
        if (!forceRefresh && isCacheFresh()) return tierData;
        if (!forceRefresh && fetchPromise) return fetchPromise;

        fetchPromise = (async () => {
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/tier/info')
                : `${window.API_BASE_URL || 'https://api.solisai.video/api'}/tier/info`;
            const headers = typeof getAuthHeaders === 'function'
                ? getAuthHeaders()
                : { 'Content-Type': 'application/json' };

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers,
            });

            if (!response.ok) throw new Error(`tier/info ${response.status}`);

            const json = await response.json();
            if (!json?.data) throw new Error('Invalid tier response');
            tierData = json.data;
            tierFetchedAt = Date.now();

            const lib = tierData.library || tierData.saved_videos;
            if (lib && typeof window.applyStorageBadgeUI === 'function') {
                const plan = (tierData.tier || 'free').toLowerCase();
                const unlimited = lib.unlimited === true
                    || (typeof window.isUnlimitedLibrary === 'function' && window.isUnlimitedLibrary(null, plan));
                window.applyStorageBadgeUI({
                    used: lib.used ?? 0,
                    limit: unlimited ? null : (lib.limit ?? lib.max_videos ?? 5),
                    plan,
                    unlimited,
                });
            }

            return tierData;
        })().finally(() => {
            fetchPromise = null;
        });

        return fetchPromise;
    }

    function readDismissedKind() {
        try {
            return sessionStorage.getItem(QUOTA_DISMISS_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function dismissQuotaKind(kind) {
        try {
            sessionStorage.setItem(QUOTA_DISMISS_KEY, kind || '');
        } catch (_) {}
    }

    function clearQuotaDismiss() {
        try {
            sessionStorage.removeItem(QUOTA_DISMISS_KEY);
        } catch (_) {}
    }

    function parseQuotaResetWhen(iso) {
        if (iso == null || iso === '') return null;
        if (iso instanceof Date) {
            return Number.isNaN(iso.getTime()) ? null : iso;
        }
        const raw = String(iso).trim();
        if (!raw) return null;
        const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
        const normalized = (hasTz ? raw : `${raw.replace(' ', 'T')}Z`);
        const when = new Date(normalized);
        return Number.isNaN(when.getTime()) ? null : when;
    }

    function formatQuotaUnlockWhen(iso) {
        const when = parseQuotaResetWhen(iso);
        if (!when) return '';

        const now = new Date();
        const timeStr = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const dayStr = when.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWhen = new Date(when.getFullYear(), when.getMonth(), when.getDate());
        const dayDiff = Math.round((startOfWhen - startOfToday) / 86400000);

        if (dayDiff === 0) return `today at ${timeStr}`;
        if (dayDiff === 1) return `tomorrow at ${timeStr}`;
        return `${dayStr} at ${timeStr}`;
    }

    /** Fallback when API omits resets_at — next local midnight. */
    function nextLocalMidnightLabel() {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        return formatQuotaUnlockWhen(next);
    }

    /**
     * Prefer API resets_at, but if it's clearly UTC-midnight mislabeled for this
     * browser (shows as 1–6 AM local), fall back to true local midnight.
     */
    function resolveDailyUnlockLabel(iso) {
        const when = parseQuotaResetWhen(iso);
        if (!when) return nextLocalMidnightLabel();
        const localHours = when.getHours();
        const localMins = when.getMinutes();
        // Classic bug: UTC 00:00 → 4:00 AM in Gulf, 1–3 AM in EU, etc.
        if (localMins === 0 && localHours > 0 && localHours <= 6) {
            const utcHours = when.getUTCHours();
            const utcMins = when.getUTCMinutes();
            if (utcHours === 0 && utcMins === 0) {
                return nextLocalMidnightLabel();
            }
        }
        return formatQuotaUnlockWhen(iso) || nextLocalMidnightLabel();
    }

    /**
     * Month = entitlement, day = burst limit.
     * Headline = what you can run right now (binding constraint).
     */
    function parseQuotaState(statusExtra, gen) {
        const dailyRem = Math.max(0, Number(
            statusExtra?.daily?.remaining ?? gen?.remaining ?? 0
        ));
        const dailyMax = Math.max(0, Number(
            statusExtra?.daily?.limit
            ?? gen?.max_per_period
            ?? gen?.max_per_day
            ?? 0
        ));
        const monthlyRem = Math.max(0, Number(
            statusExtra?.monthly?.remaining ?? gen?.remaining_month ?? 0
        ));
        const monthlyMax = Math.max(0, Number(
            statusExtra?.monthly?.limit ?? gen?.max_per_month ?? 0
        ));

        const monthlyEmpty = monthlyMax > 0 && monthlyRem <= 0;
        const dailyEmpty = (dailyMax > 0 && dailyRem <= 0)
            || statusExtra?.daily_limit_reached === true
            || statusExtra?.block_reason === 'daily_limit';

        let headlineRem = dailyRem;
        if (monthlyEmpty) {
            headlineRem = 0;
        } else if (dailyEmpty) {
            headlineRem = 0;
        } else if (monthlyMax > 0) {
            headlineRem = Math.min(dailyRem, monthlyRem);
        }

        const binding = (monthlyMax > 0 && monthlyRem <= dailyRem) ? 'monthly' : 'daily';

        return {
            dailyRem,
            dailyMax,
            monthlyRem,
            monthlyMax,
            monthlyEmpty,
            dailyEmpty,
            headlineRem,
            binding,
            canRunNow: !monthlyEmpty && !dailyEmpty,
        };
    }

    function formatQuotaChipDisplay(q, statusExtra, gen, tier) {
        const monthlyMax = q.monthlyMax > 0
            ? q.monthlyMax
            : Math.max(1, Number(gen?.max_per_month ?? gen?.max_per_day ?? 1));
        const monthlyRem = Math.max(0, Number(q.monthlyRem));

        const countHtml =
            `<span class="plan-count-remaining">${monthlyRem}</span>`
            + `<span class="plan-count-sep"> / ${monthlyMax}</span>`;
        const progressPct = monthlyMax > 0
            ? Math.min(100, ((monthlyMax - monthlyRem) / monthlyMax) * 100)
            : 0;

        if (q.monthlyEmpty) {
            return {
                countHtml:
                    '<span class="plan-count-remaining">0</span>'
                    + `<span class="plan-count-sep"> / ${monthlyMax}</span>`,
                kicker: 'uploads left',
                progressPct: 100,
                resetLine: 'Resets with your plan renewal',
            };
        }

        let resetLine = '';
        if (q.dailyEmpty && monthlyRem > 0) {
            const dailyResetIso = statusExtra?.daily?.resets_at
                || gen?.daily_resets_at
                || gen?.resets_at;
            const when = resolveDailyUnlockLabel(dailyResetIso);
            resetLine = when ? `Next upload unlocks ${when}` : 'Next upload unlocks tomorrow';
        }

        return {
            countHtml,
            kicker: monthlyRem === 1 ? 'upload left' : 'uploads left',
            progressPct,
            resetLine,
        };
    }

    /** Create-page upsell — free only; after they've used Solis or stayed free a while. */
    const UC_EVER_KEY = 'solisEverGenerated';
    const UC_SEEN_KEY = 'solisCreateFirstSeenAt';
    const UC_TENURE_DAYS = 7;

    function markSolisEverGenerated() {
        try { localStorage.setItem(UC_EVER_KEY, '1'); } catch (_) {}
    }

    function readSolisEverGenerated() {
        try { return localStorage.getItem(UC_EVER_KEY) === '1'; } catch (_) { return false; }
    }

    function freeTenureDays() {
        try {
            let raw = localStorage.getItem(UC_SEEN_KEY);
            if (!raw) {
                raw = String(Date.now());
                localStorage.setItem(UC_SEEN_KEY, raw);
                return 0;
            }
            const t = parseInt(raw, 10);
            if (!Number.isFinite(t) || t <= 0) return 0;
            return Math.max(0, (Date.now() - t) / 86400000);
        } catch (_) {
            return 0;
        }
    }

    function syncUpgradeCardVisibility(data) {
        const card = document.getElementById('upgradeCardCreate');
        if (!card) return;
        const tier = String(data?.tier || data?.plan || window.currentUser?.plan || 'free').toLowerCase();
        const gen = data?.generations || {};
        const lib = data?.library || data?.saved_videos || {};
        const usedToday = Math.max(0, Number(gen.used_today ?? 0));
        const usedMonth = Math.max(0, Number(gen.used_this_month ?? 0));
        const usedLife = Math.max(0, Number(gen.used_lifetime ?? 0));
        const libUsed = Math.max(0, Number(lib.used ?? 0));
        const hasUsed = usedToday > 0
            || usedMonth > 0
            || usedLife > 0
            || libUsed > 0
            || readSolisEverGenerated();
        if (hasUsed) markSolisEverGenerated();

        const tenureOk = freeTenureDays() >= UC_TENURE_DAYS;
        const isPaid = ['basic', 'prime', 'elite', 'pro'].includes(tier);
        // Hide for brand-new free (no gens yet, <7 days). Show once they've shipped
        // a clip or hung around on free — classic soft upsell timing.
        const show = !isPaid && (hasUsed || tenureOk);
        card.hidden = !show;
        card.setAttribute('aria-hidden', show ? 'false' : 'true');
        card.style.display = show ? 'flex' : 'none';
        try {
            window.syncCreateFirstUrlNudge?.(data);
        } catch (_) { /* ignore */ }
    }

    window.solisQuotaDisplay = {
        parseState: parseQuotaState,
        formatChip: formatQuotaChipDisplay,
        formatUnlockWhen: formatQuotaUnlockWhen,
        resolveDailyUnlockLabel,
        nextLocalMidnightLabel,
        syncUpgradeCard: syncUpgradeCardVisibility,
        markEverGenerated: markSolisEverGenerated,
    };

    function syncQuotaRail(data, statusExtra) {
        const rail = document.getElementById('urlQuotaRail');
        const banner = document.getElementById('urlQuotaBanner');
        const titleEl = document.getElementById('urlQuotaTitle');
        const subEl = document.getElementById('urlQuotaSub');
        const stack = document.getElementById('urlInputStack');
        if (!rail || !banner || !titleEl || !subEl) return;

        const gen = data?.generations || {};
        const q = parseQuotaState(statusExtra, gen);
        const {
            dailyRem, dailyMax, monthlyRem, monthlyMax,
            monthlyEmpty, dailyEmpty, binding,
        } = q;

        const maxLimit = Math.max(0, Number(
            statusExtra?.max_effort?.limit
            ?? gen.max_effort_per_day
            ?? 0
        ));
        const maxRemRaw = statusExtra?.max_effort?.remaining ?? gen.max_effort_remaining;
        const maxRem = Math.max(0, Number(maxRemRaw ?? 0));
        const maxCanUse = statusExtra?.max_effort?.can_use ?? gen.can_use_max_effort;
        const maxEmpty = maxLimit > 0 && (maxRem <= 0 || maxCanUse === false);

        const dailyLow = !dailyEmpty && !monthlyEmpty && dailyMax >= 3
            && dailyRem > 0
            && binding === 'daily'
            && (dailyRem <= 1 || dailyRem / dailyMax <= 0.2);
        const monthlyLow = !monthlyEmpty && !dailyEmpty && monthlyMax > 0
            && binding === 'monthly'
            && (monthlyRem <= 2 || monthlyRem / monthlyMax <= 0.15);
        const maxLow = maxLimit >= 3 && !maxEmpty && maxRem === 1;

        let kind = '';
        let title = '';
        let sub = '';

        if (monthlyEmpty) {
            kind = 'monthly';
            title = 'Monthly limit reached';
            const monthlyReset = formatQuotaUnlockWhen(
                statusExtra?.monthly?.resets_at || gen.monthly_resets_at
            );
            sub = monthlyReset
                ? `New uploads unlock ${monthlyReset}.`
                : 'New uploads unlock when your plan renews.';
        } else if (dailyEmpty) {
            kind = 'daily';
            const dailyResetIso = statusExtra?.daily?.resets_at || gen.daily_resets_at || gen.resets_at;
            const dailyReset = resolveDailyUnlockLabel(dailyResetIso);
            if (monthlyRem > 0) {
                title = currentTier === 'free' ? 'Used your free upload' : 'Used today\'s uploads';
                sub = dailyReset
                    ? `Next upload unlocks ${dailyReset}.`
                    : 'Next upload unlocks tomorrow.';
            } else {
                title = currentTier === 'free' ? 'Free upload used' : 'Daily limit reached';
                sub = dailyReset
                    ? `Next upload unlocks ${dailyReset}.`
                    : 'Upgrade for more daily uploads.';
            }
        } else if (monthlyLow) {
            kind = 'monthly-low';
            title = monthlyRem === 1 ? 'One upload left' : `${monthlyRem} uploads left`;
            sub = 'Upgrade if you need more room this month.';
        } else if (dailyLow) {
            kind = 'daily-low';
            title = dailyRem === 1 ? 'One upload left today' : `${dailyRem} uploads left today`;
            sub = 'Upgrade if you need more room today.';
        } else if (maxEmpty) {
            kind = 'max-empty';
            title = 'Max effort used up for today';
            const resetsAt = statusExtra?.max_effort?.resets_at || gen.max_effort_resets_at;
            const when = formatQuotaUnlockWhen(resetsAt);
            sub = when
                ? `Max effort unlocks again ${when}. You can still generate with Normal or Low.`
                : 'You can still generate with Normal or Low.';
            // Don't keep a prior "max" dismiss hiding the empty unlock message
            if (readDismissedKind() === 'max' || readDismissedKind() === 'max-low') {
                clearQuotaDismiss();
            }
            if (selectedEffort === 'max') {
                const fallback = allowedEffortsForTier(currentTier).includes('normal') ? 'normal' : 'low';
                setEffort(fallback, { persist: true, closeFlyout: false });
            }
        } else if (maxLow) {
            kind = 'max-low';
            title = 'One Max effort left today';
            sub = 'After this, Solis falls back to Normal so you can keep creating.';
        } else {
            rail.hidden = true;
            if (stack) stack.classList.remove('has-quota');
            return;
        }

        if (readDismissedKind() === kind) {
            rail.hidden = true;
            if (stack) stack.classList.remove('has-quota');
            return;
        }

        banner.dataset.kind = kind;
        titleEl.textContent = title;
        subEl.textContent = sub;
        rail.hidden = false;
        if (stack) stack.classList.add('has-quota');
    }

    async function enrichQuotaFromStatus() {
        try {
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/clips/status')
                : `${window.API_BASE_URL || '/api'}/clips/status`;
            const headers = typeof getAuthHeaders === 'function'
                ? getAuthHeaders()
                : { 'Content-Type': 'application/json' };
            const response = await fetch(url, { method: 'GET', credentials: 'include', headers });
            if (!response.ok) return null;
            quotaStatus = await response.json();
            return quotaStatus;
        } catch (_) {
            return null;
        }
    }

    function applyTierToUI(data) {
        const wrap = document.getElementById('planSelectorWrap');
        const label = document.getElementById('planSelectorLabel');
        const popoverTier = document.getElementById('planPopoverTier');
        const countEl = document.getElementById('planPopoverCount');
        const progressEl = document.getElementById('planPopoverProgress');
        const resetEl = document.getElementById('planPopoverReset');
        const upgradeEl = document.getElementById('planPopoverUpgrade');

        if (!wrap || !label) return;

        const tier = (data?.tier || 'free').toLowerCase();
        const tierName = data?.tier_name || tier.charAt(0).toUpperCase() + tier.slice(1);
        const fullLabel = `${tierName} Plan`;

        currentTier = tier;
        selectedEffort = resolveEffortForTier(tier);
        // Keep Auto as default selection unless user already chose Advanced
        if (!effortSelection) effortSelection = readEffortSelection();

        wrap.dataset.tier = tier;
        wrap.dataset.effort = isAutoMode() ? 'auto' : selectedEffort;
        wrap.dataset.effortSelection = effortSelection;
        const popover = getPopover();
        if (popover) {
            popover.dataset.tier = tier;
            popover.dataset.effort = isAutoMode() ? 'auto' : selectedEffort;
            popover.dataset.effortSelection = effortSelection;
        }
        label.textContent = fullLabel;
        if (popoverTier) popoverTier.textContent = fullLabel;
        syncAdvancedModeUI({ animate: false });
        syncEffortUI();
        syncQuotaRail(data, quotaStatus);

        const gen = data?.generations;
        const kickerEl = document.getElementById('planPopoverKicker');
        if (gen && countEl) {
            const chip = formatQuotaChipDisplay(parseQuotaState(quotaStatus, gen), quotaStatus, gen, tier);
            countEl.innerHTML = chip.countHtml;
            if (kickerEl) kickerEl.textContent = chip.kicker || 'uploads left';
            if (progressEl) {
                progressEl.style.width = `${Math.min(100, chip.progressPct || 0)}%`;
            }
            if (resetEl) {
                const resetText = chip.resetLine || formatResetLabel(gen);
                resetEl.textContent = resetText;
                resetEl.hidden = !resetText;
            }
        } else if (countEl) {
            countEl.textContent = '—';
            if (kickerEl) kickerEl.textContent = 'uploads left';
            if (progressEl) progressEl.style.width = '0%';
            if (resetEl) {
                resetEl.textContent = '';
                resetEl.hidden = true;
            }
        }

        if (upgradeEl) {
            const isPaid = ['basic', 'prime', 'elite', 'pro'].includes(tier);
            const ever = (typeof readSolisEverGenerated === 'function' && readSolisEverGenerated())
                || Math.max(0, Number(gen?.used_lifetime ?? gen?.used_today ?? gen?.used_this_month ?? 0)) > 0
                || freeTenureDays() >= UC_TENURE_DAYS;
            upgradeEl.classList.toggle('hidden', isPaid || !ever);
        }

        syncUpgradeCardVisibility(data);

        clearLoadingState();
    }

    function setLoadingState(on = true) {
        const wrap = document.getElementById('planSelectorWrap');
        const btn = document.getElementById('planSelectorBtn');
        const popover = getPopover();
        if (wrap) wrap.classList.toggle('is-loading', !!on);
        if (popover) popover.classList.toggle('is-loading', !!on);
        if (btn) btn.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    function clearLoadingState() {
        setLoadingState(false);
    }

    function getInputContainer() {
        return document.querySelector('.url-input-container');
    }

    let repositionHandler = null;
    let popoverAnchor = null;

    function getPopover() {
        return document.getElementById('planSelectorPopover');
    }

    function mountPopover() {
        const wrap = document.getElementById('planSelectorWrap');
        const popover = getPopover();
        if (!wrap || !popover || popover.parentElement === document.body) return;
        popoverAnchor = wrap;
        document.body.appendChild(popover);
    }

    function unmountPopover() {
        const popover = getPopover();
        if (!popover || !popoverAnchor || popover.parentElement !== document.body) return;
        popoverAnchor.appendChild(popover);
        popoverAnchor = null;
    }

    function positionPopover() {
        const btn = document.getElementById('planSelectorBtn');
        const popover = getPopover();
        if (!btn || !popover || popover.hidden) return;

        const rect = btn.getBoundingClientRect();
        const compact = isCompactPlanUi();
        const edge = compact ? 10 : 12;
        const maxW = compact
            ? Math.min(360, window.innerWidth - edge * 2)
            : Math.min(268, window.innerWidth - 48);
        const width = maxW;

        let left;
        if (compact) {
            // Center under the URL bar / screen — comfortable thumb reach
            left = Math.max(edge, Math.round((window.innerWidth - width) / 2));
        } else {
            left = Math.max(edge, rect.right - width);
            left = Math.min(left, window.innerWidth - width - edge);
        }

        let top = rect.bottom + (compact ? 12 : 10);
        // Keep panel on-screen if near the bottom
        const approxH = popover.offsetHeight || (compact ? 320 : 260);
        if (top + approxH > window.innerHeight - edge) {
            top = Math.max(edge, rect.top - approxH - 10);
        }

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
        popover.style.width = `${width}px`;
        popover.style.right = 'auto';

        if (effortFlyoutOpen && !compact) positionEffortFlyoutSide();
    }

    function bindReposition() {
        if (repositionHandler) return;
        let lastCompact = isCompactPlanUi();
        repositionHandler = () => {
            positionPopover();
            const compact = isCompactPlanUi();
            if (compact !== lastCompact) {
                lastCompact = compact;
                syncEffortUI({ animate: false });
            }
        };
        window.addEventListener('resize', repositionHandler);
        window.addEventListener('scroll', repositionHandler, true);
    }

    function unbindReposition() {
        if (!repositionHandler) return;
        window.removeEventListener('resize', repositionHandler);
        window.removeEventListener('scroll', repositionHandler, true);
        repositionHandler = null;
    }

    function openPopover() {
        const wrap = document.getElementById('planSelectorWrap');
        const btn = document.getElementById('planSelectorBtn');
        const popover = getPopover();
        const container = getInputContainer();
        if (!wrap || !btn || !popover) return;

        mountPopover();
        popover.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        positionPopover();
        requestAnimationFrame(() => {
            wrap.classList.add('is-open');
            popover.classList.add('is-open');
            if (container) container.classList.add('is-open');
            positionPopover();
        });
        bindReposition();
        syncAdvancedModeUI({ animate: false });
        syncEffortUI();

        if (tierData) {
            applyTierToUI(tierData);
        } else {
            setLoadingState(true);
        }

        if (!isCacheFresh()) {
            fetchTierInfo(false)
                .then(applyTierToUI)
                .catch(() => {
                    if (tierData) return;
                    const resetEl = document.getElementById('planPopoverReset');
                    const countEl = document.getElementById('planPopoverCount');
                    if (countEl) countEl.textContent = '—';
                    if (resetEl) resetEl.textContent = 'Could not load usage';
                });
        }
    }

    function closePopover(options = {}) {
        const immediate = Boolean(options.immediate);
        const wrap = document.getElementById('planSelectorWrap');
        const btn = document.getElementById('planSelectorBtn');
        const popover = getPopover();
        const container = getInputContainer();
        if (!wrap || !btn || !popover) return;
        if (popover.hidden && !wrap.classList.contains('is-open') && !popover.classList.contains('is-open')) {
            return;
        }

        closeEffortFlyout();
        wrap.classList.remove('is-open');
        popover.classList.remove('is-open');
        if (container) container.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        unbindReposition();

        const finish = () => {
            if (!wrap.classList.contains('is-open')) {
                popover.hidden = true;
                popover.style.top = '';
                popover.style.left = '';
                popover.style.width = '';
                unmountPopover();
            }
            popover.removeEventListener('transitionend', finish);
        };

        if (immediate) {
            finish();
            return;
        }
        popover.addEventListener('transitionend', finish);
        setTimeout(finish, 280);
    }

    function togglePopover() {
        const wrap = document.getElementById('planSelectorWrap');
        if (!wrap) return;
        if (wrap.classList.contains('is-open')) closePopover();
        else openPopover();
    }

    function onPopoverClick(e) {
        const advancedToggle = e.target.closest('#planEffortAdvancedToggle');
        if (advancedToggle) {
            e.preventDefault();
            e.stopPropagation();
            setEffortSelection(isAutoMode() ? 'advanced' : 'auto');
            return;
        }

        if (e.target.closest('#planEffortSlider') || e.target.closest('#planEffortSliderPanel')) {
            e.stopPropagation();
            return;
        }

        const trigger = e.target.closest('#planEffortTrigger');
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            if (isAutoMode()) setEffortSelection('advanced');
            toggleEffortControl();
            return;
        }

        const option = e.target.closest('.plan-effort-option');
        if (!option) return;
        e.preventDefault();
        e.stopPropagation();

        const mode = option.dataset.effort;
        if (!isEffortSelectable(mode)) {
            notifyEffortLocked(mode);
            return;
        }

        setEffort(mode, { animate: false });
        if (tierData) syncQuotaRail(tierData, quotaStatus);
    }

    function initPlanSelector() {
        const wrap = document.getElementById('planSelectorWrap');
        const btn = document.getElementById('planSelectorBtn');
        if (!wrap || !btn) return;

        effortSelection = readEffortSelection();
        selectedEffort = resolveEffortForTier(currentTier);
        applyEffortUiMode(readEffortUiMode(), { persist: false, animate: false });
        syncAdvancedModeUI({ animate: false });
        syncEffortUI();
        syncQuotaRail(tierData, quotaStatus);
        bindEffortSliderInteractions();

        try {
            const mq = window.matchMedia('(max-width: 768px)');
            const onMq = () => syncEffortUI({ animate: false });
            if (mq.addEventListener) mq.addEventListener('change', onMq);
            else if (mq.addListener) mq.addListener(onMq);
        } catch (_) { /* ignore */ }

        const closeBtn = document.getElementById('urlQuotaClose');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.dataset.bound = 'true';
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const banner = document.getElementById('urlQuotaBanner');
                const kind = banner?.dataset?.kind || '';
                dismissQuotaKind(kind);
                const rail = document.getElementById('urlQuotaRail');
                const stack = document.getElementById('urlInputStack');
                if (rail) rail.hidden = true;
                if (stack) stack.classList.remove('has-quota');
            });
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePopover();
        });

        const popover = getPopover();
        if (popover) {
            popover.addEventListener('click', onPopoverClick);
        }

        document.addEventListener('click', (e) => {
            const pop = getPopover();
            if (wrap.contains(e.target) || pop?.contains(e.target)) return;
            closePopover();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (effortFlyoutOpen) {
                closeEffortFlyout();
                return;
            }
            closePopover();
        });

        fetchTierInfo()
            .then(async (data) => {
                await enrichQuotaFromStatus();
                applyTierToUI(data);
            })
            .catch(() => {
                wrap.dataset.tier = 'free';
                currentTier = 'free';
                selectedEffort = 'low';
                const label = document.getElementById('planSelectorLabel');
                if (label) label.textContent = 'Free Plan';
                syncEffortUI();
                clearLoadingState();
            });
    }

    window.refreshPlanSelector = function refreshPlanSelector() {
        invalidateTierCache();
        setLoadingState(true);
        return Promise.all([
            fetchTierInfo(true),
            enrichQuotaFromStatus(),
        ]).then(([data]) => {
            applyTierToUI(data);
            return data;
        }).catch(() => {
            clearLoadingState();
        });
    };

    window.updateUrlQuotaRail = function updateUrlQuotaRail(statusData) {
        if (statusData) quotaStatus = statusData;
        if (tierData) syncQuotaRail(tierData, quotaStatus);
    };

    window.closePlanSelectorPopover = function closePlanSelectorPopover(immediate = true) {
        closePopover({ immediate: Boolean(immediate) });
    };

    window.getSelectedEffortMode = function getSelectedEffortMode() {
        return isAutoMode() ? 'auto' : selectedEffort;
    };

    window.isEffortAutoMode = function isEffortAutoMode() {
        return isAutoMode();
    };

    window.setEffortAutoMode = function setEffortAutoMode(enabled) {
        setEffortSelection(enabled ? 'auto' : 'advanced');
        return isAutoMode();
    };

    window.setSelectedEffortMode = function setSelectedEffortMode(mode) {
        if (mode === 'auto') {
            setEffortSelection('auto');
            return true;
        }
        // Manual pick implies Advanced
        if (isAutoMode()) setEffortSelection('advanced');
        const ok = setEffort(mode);
        if (tierData) syncQuotaRail(tierData, quotaStatus);
        return ok;
    };

    window.getEffortUiMode = function getEffortUiMode() {
        return effortUiMode;
    };

    window.setEffortUiMode = function setEffortUiMode(mode) {
        applyEffortUiMode(mode);
        return effortUiMode;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initPlanSelector();
            enrichQuotaFromStatus().then(() => {
                if (tierData) syncQuotaRail(tierData, quotaStatus);
            });
        });
    } else {
        initPlanSelector();
        enrichQuotaFromStatus().then(() => {
            if (tierData) syncQuotaRail(tierData, quotaStatus);
        });
    }
})();
