document.addEventListener('DOMContentLoaded', () => {
    const stgBackdrop = document.getElementById('stgBackdrop');
    const stgModal = document.getElementById('stgModal');
    const stgClose = document.getElementById('stgClose');
    const stgUpgradeBtn = document.getElementById('stgUpgradeBtn');
    const dropdownSettingsLink = document.getElementById('dropdownSettings');
    const stgLogoutBtn = document.getElementById('stgLogoutBtn');
    const stgMainTitle = document.getElementById('stgMainTitle');

    const PANEL_TITLES = {
        profile: 'Profile',
        account: 'Account',
        privacy: 'Privacy',
        memory: 'Memory',
        themes: 'Themes',
        billing: 'Billing/Usage',
        subscription: 'Billing/Usage',
        support: 'Support',
    };

    const EFFORT_UI_STORAGE_KEY = 'solis_effort_ui_mode';
    const PLUGIN_CAPTIONS_KEY = 'solis_plugin_auto_captions';
    const PLUGIN_SFX_KEY = 'solis_plugin_auto_sfx';

    function readPluginFlag(key, defaultOn = false) {
        try {
            const v = localStorage.getItem(key);
            if (v === null || v === undefined) return defaultOn;
            return v === '1' || v === 'true';
        } catch (_) {
            return defaultOn;
        }
    }

    window.getSolisPluginPrefs = function getSolisPluginPrefs() {
        return {
            auto_captions: readPluginFlag(PLUGIN_CAPTIONS_KEY, false),
            auto_sfx: false, // temporarily forced off for launch
        };
    };

    function readEffortUiMode() {
        try {
            const v = localStorage.getItem(EFFORT_UI_STORAGE_KEY);
            if (v === 'slider' || v === 'flyout') return v;
        } catch (_) {}
        return 'slider';
    }

    function persistEffortUiMode(mode) {
        try {
            localStorage.setItem(EFFORT_UI_STORAGE_KEY, mode);
        } catch (_) {}
    }

    function syncEffortUiToggle() {
        const toggle = document.getElementById('stgEffortSliderToggle');
        const label = document.getElementById('stgEffortUiLabel');
        const mode = readEffortUiMode();
        const useClassic = mode === 'flyout';
        if (toggle) {
            toggle.classList.toggle('is-on', useClassic);
            toggle.setAttribute('aria-checked', useClassic ? 'true' : 'false');
        }
        if (label) label.textContent = useClassic ? 'On' : 'Off';
    }

    function applyEffortUiMode(mode) {
        const next = mode === 'slider' ? 'slider' : 'flyout';
        persistEffortUiMode(next);
        syncEffortUiToggle();
        if (typeof window.setEffortUiMode === 'function') {
            window.setEffortUiMode(next);
        } else {
            document.documentElement.dataset.effortUi = next;
        }
    }

    function syncThemeCards() {
        document.querySelectorAll('.stgThemeCard[data-theme-choice]').forEach((card) => {
            const on = card.getAttribute('data-theme-choice') === 'white';
            card.classList.toggle('is-selected', on);
            card.setAttribute('aria-checked', on ? 'true' : 'false');
        });
    }

    function switchSettingsPanel(panelId) {
        let id = panelId;
        if (id === 'connections' || id === 'connectors' || id === 'plugins') return;
        id = PANEL_TITLES[id] ? id : 'profile';
        document.querySelectorAll('.stgNavBtn[data-stg-panel]').forEach((btn) => {
            const on = btn.getAttribute('data-stg-panel') === id;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.stgPanel').forEach((panel) => {
            const on = panel.getAttribute('data-stg-panel') === id;
            panel.classList.toggle('is-active', on);
            panel.classList.remove('stg-panel-enter');
            if (on && isMobileSettings()) {
                void panel.offsetWidth;
                panel.classList.add('stg-panel-enter');
            }
        });
        if (stgMainTitle) stgMainTitle.textContent = PANEL_TITLES[id] || 'Settings';
        if (id === 'memory' && window.SolisMemory && typeof window.SolisMemory.syncSettingsUI === 'function') {
            window.SolisMemory.syncSettingsUI();
        }
        if (id === 'privacy' && typeof syncPrivacyToggles === 'function') {
            syncPrivacyToggles();
        }
        if (id === 'account') {
            populateAccountPanel();
        }
        if (isMobileSettings()) {
            setSettingsMobileView('panel');
        }
    }

    function isMobileSettings() {
        return window.innerWidth <= 768;
    }

    function setSettingsMobileView(view) {
        if (!stgModal) return;
        const next = view === 'panel' ? 'panel' : 'home';
        const prev = stgModal.getAttribute('data-stg-view') || '';
        if (!prev) {
            stgModal.setAttribute('data-stg-view', next === 'panel' ? 'home' : 'panel');
            void stgModal.offsetWidth;
        } else if (prev !== next) {
            void stgModal.offsetWidth;
        }
        stgModal.setAttribute('data-stg-view', next);
        const back = document.getElementById('stgMobileBack');
        if (back) back.hidden = next !== 'panel';
        if (next === 'home') {
            mountMobileSettingsHero();
            if (stgMainTitle) stgMainTitle.textContent = 'Settings';
        }
    }

    function mountMobileSettingsHero() {
        const host = document.getElementById('stgMobileHeroInner');
        const hero = document.getElementById('stgProfileHero');
        const panel = document.getElementById('stgPanelProfile');
        if (!host || !hero || !panel) return;
        if (hero.parentElement !== host) {
            host.appendChild(hero);
        }
    }

    function restoreDesktopProfileHero() {
        const hero = document.getElementById('stgProfileHero');
        const panel = document.getElementById('stgPanelProfile');
        const lead = panel?.querySelector('.stgPanelLead');
        if (!hero || !panel) return;
        if (hero.parentElement === panel) return;
        if (lead && lead.nextSibling) {
            panel.insertBefore(hero, lead.nextSibling);
        } else if (lead) {
            lead.after(hero);
        } else {
            panel.prepend(hero);
        }
    }

    document.querySelectorAll('.stgNavBtn[data-stg-panel]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.disabled || btn.classList.contains('is-disabled')) return;
            switchSettingsPanel(btn.getAttribute('data-stg-panel'));
        });
    });

    document.getElementById('stgMobileBack')?.addEventListener('click', () => {
        setSettingsMobileView('home');
    });

    window.addEventListener('resize', () => {
        if (!stgModal?.classList.contains('open')) return;
        if (isMobileSettings()) {
            if (!stgModal.getAttribute('data-stg-view')) {
                setSettingsMobileView('home');
            }
        } else {
            restoreDesktopProfileHero();
            stgModal.removeAttribute('data-stg-view');
            const active = document.querySelector('.stgNavBtn.is-active[data-stg-panel]');
            switchSettingsPanel(active?.getAttribute('data-stg-panel') || 'profile');
        }
    });

    document.getElementById('stgMobileHero')?.addEventListener('click', (e) => {
        if (e.target.closest('#stgEditHeaderBtn, #stgAvatarContainer, .stgNameInput, .stgBioInput')) return;
        if (isMobileSettings() && stgModal?.getAttribute('data-stg-view') === 'home') {
            switchSettingsPanel('profile');
        }
    });

    const effortSliderToggle = document.getElementById('stgEffortSliderToggle');
    if (effortSliderToggle) {
        syncEffortUiToggle();
        applyEffortUiMode(readEffortUiMode());
        effortSliderToggle.addEventListener('click', () => {
            const next = readEffortUiMode() === 'slider' ? 'flyout' : 'slider';
            applyEffortUiMode(next);
        });
    }

    const advancedToggle = document.getElementById('stgAdvancedToggle');
    const advancedRoot = advancedToggle?.closest('.stgAdvanced');
    const advancedBody = document.getElementById('stgAdvancedBody');
    if (advancedToggle && advancedRoot && advancedBody) {
        advancedToggle.addEventListener('click', () => {
            const open = !advancedRoot.classList.contains('is-open');
            advancedRoot.classList.toggle('is-open', open);
            advancedToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) advancedBody.removeAttribute('hidden');
            else advancedBody.setAttribute('hidden', '');
        });
    }

    document.querySelectorAll('.stgThemeCard[data-theme-choice]').forEach((card) => {
        card.addEventListener('click', () => {
            if (card.disabled || card.classList.contains('is-disabled')) return;
            const choice = card.getAttribute('data-theme-choice');
            if (choice !== 'white') return;
            if (typeof setTheme === 'function') setTheme('light');
            else {
                document.documentElement.setAttribute('data-theme', 'light');
                try { localStorage.setItem('theme', 'light'); } catch (_) {}
            }
            syncThemeCards();
        });
    });
    syncThemeCards();

    const IMPROVE_SOLIS_KEY = 'solis_privacy_improve_product';

    function readImproveSolis() {
        try {
            const v = localStorage.getItem(IMPROVE_SOLIS_KEY);
            if (v === null || v === undefined) return true;
            return v === '1' || v === 'true';
        } catch (_) {
            return true;
        }
    }

    function setImproveSolis(on) {
        try {
            localStorage.setItem(IMPROVE_SOLIS_KEY, on ? '1' : '0');
        } catch (_) { /* ignore */ }
        syncPrivacyToggles();
    }

    function syncPrivacyToggles() {
        const improve = document.getElementById('stgPrivacyImproveToggle');
        const mem = document.getElementById('stgPrivacyMemoryToggle');
        const improveOn = readImproveSolis();
        if (improve) {
            improve.classList.toggle('is-on', improveOn);
            improve.setAttribute('aria-checked', improveOn ? 'true' : 'false');
        }
        const memOn = window.SolisMemory?.isEnabled ? !!window.SolisMemory.isEnabled() : true;
        if (mem) {
            mem.classList.toggle('is-on', memOn);
            mem.setAttribute('aria-checked', memOn ? 'true' : 'false');
        }
    }

    document.getElementById('stgPrivacyImproveToggle')?.addEventListener('click', () => {
        setImproveSolis(!readImproveSolis());
    });

    document.getElementById('stgPrivacyMemoryToggle')?.addEventListener('click', () => {
        if (!window.SolisMemory?.setEnabled) return;
        window.SolisMemory.setEnabled(!window.SolisMemory.isEnabled());
        syncPrivacyToggles();
    });

    document.getElementById('stgPrivacyClearMemoryBtn')?.addEventListener('click', () => {
        if (window.SolisMemory?.clearAll) window.SolisMemory.clearAll();
        const btn = document.getElementById('stgPrivacyClearMemoryBtn');
        if (btn) {
            const prev = btn.textContent;
            btn.textContent = 'Cleared';
            setTimeout(() => { btn.textContent = prev || 'Clear'; }, 1400);
        }
    });

    syncPrivacyToggles();
    window.getSolisImproveProductPref = readImproveSolis;

    if (dropdownSettingsLink) {
        dropdownSettingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            const profileDropdown = document.getElementById('profileDropdown');
            if (profileDropdown) profileDropdown.classList.remove('open');
            openSettingsModal();
        });
    }

    if (stgClose) stgClose.addEventListener('click', closeSettingsModal);
    if (stgBackdrop) stgBackdrop.addEventListener('click', closeSettingsModal);

    if (stgModal) {
        stgModal.addEventListener('click', (e) => e.stopPropagation());
    }

    if (stgLogoutBtn) {
        stgLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleSecureLogout === 'function') handleSecureLogout();
            else if (typeof logout === 'function') logout();
            else window.location.href = '/login.html';
        });
    }

    function openSettingsModal(panel) {
        document.body.classList.add('stg-open');
        document.body.style.overflow = 'hidden';
        document.getElementById('navWrapper')?.classList.add('disabled');

        if (isMobileSettings()) {
            if (panel && PANEL_TITLES[panel]) {
                document.querySelectorAll('.stgNavBtn[data-stg-panel]').forEach((btn) => {
                    const on = btn.getAttribute('data-stg-panel') === panel;
                    btn.classList.toggle('is-active', on);
                    btn.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                document.querySelectorAll('.stgPanel').forEach((p) => {
                    p.classList.toggle('is-active', p.getAttribute('data-stg-panel') === panel);
                });
                if (stgMainTitle) stgMainTitle.textContent = PANEL_TITLES[panel] || 'Settings';
                stgModal?.setAttribute('data-stg-view', 'panel');
                const back = document.getElementById('stgMobileBack');
                if (back) back.hidden = false;
            } else {
                document.querySelectorAll('.stgNavBtn[data-stg-panel]').forEach((btn) => {
                    btn.classList.remove('is-active');
                    btn.setAttribute('aria-selected', 'false');
                });
                stgModal?.setAttribute('data-stg-view', 'home');
                mountMobileSettingsHero();
                if (stgMainTitle) stgMainTitle.textContent = 'Settings';
                const back = document.getElementById('stgMobileBack');
                if (back) back.hidden = true;
            }
        } else {
            restoreDesktopProfileHero();
            stgModal?.removeAttribute('data-stg-view');
            switchSettingsPanel(panel || 'profile');
        }

        requestAnimationFrame(() => {
            stgBackdrop?.classList.add('open');
            stgModal?.classList.add('open');
            updateSettingsModal();
        });
    }

    function closeSettingsModal() {
        cancelProfileEdit();
        restoreDesktopProfileHero();
        stgModal?.removeAttribute('data-stg-view');
        stgBackdrop?.classList.remove('open');
        stgModal?.classList.remove('open');
        document.body.classList.remove('stg-open');
        document.body.style.overflow = '';
        document.getElementById('navWrapper')?.classList.remove('disabled');
    }

    async function fetchSecureSettingsData() {
        const headers = typeof getAuthHeaders === 'function'
            ? getAuthHeaders()
            : { 'Content-Type': 'application/json' };
        const dedupFetch = window.apiRequestCache?.dedupFetch?.bind(window.apiRequestCache) || fetch;
        const api = (path) => (typeof window.apiUrl === 'function' ? window.apiUrl(path) : path);

        const [profileRes, statusRes, billingRes] = await Promise.all([
            dedupFetch(api('/api/user/profile'), {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({}),
            }),
            dedupFetch(api('/api/clips/status'), {
                method: 'GET',
                credentials: 'include',
                headers,
            }).catch(() => null),
            dedupFetch(api('/api/user/billing'), {
                method: 'GET',
                credentials: 'include',
                headers,
            }).catch(() => null),
        ]);

        if (profileRes.status === 401) {
            throw new Error('Unauthorized');
        }
        if (statusRes && statusRes.status === 401) {
            throw new Error('Unauthorized');
        }
        if (!profileRes.ok) throw new Error('Failed to load profile');

        const profile = await profileRes.json();
        let clipsStatus = null;
        if (statusRes && statusRes.ok) {
            clipsStatus = await statusRes.json();
        }
        let subscription = null;
        if (billingRes && billingRes.ok) {
            try { subscription = await billingRes.json(); } catch (_) { subscription = null; }
        }

        if (!profile || typeof profile !== 'object' || typeof profile.plan !== 'string') {
            throw new Error('Invalid profile response');
        }

        if (subscription && typeof subscription === 'object') {
            if (subscription.paddleSubscriptionId && !profile.paddle_subscription_id) {
                profile.paddle_subscription_id = subscription.paddleSubscriptionId;
            }
            if (subscription.status && !profile.plan_status) {
                profile.plan_status = subscription.status;
                profile.subscription_status = subscription.status;
            }
            if (subscription.nextBillingDate && !profile.plan_expires_at) {
                profile.plan_expires_at = subscription.nextBillingDate;
                profile.subscription_end_date = subscription.nextBillingDate;
            }
        }

        return { profile, subscription, clipsStatus, storageInfo: null };
    }

    function formatBytesLabel(bytes) {
        const b = Math.max(0, Number(bytes) || 0);
        if (b >= 1024 * 1024 * 1024) {
            const gb = b / (1024 * 1024 * 1024);
            return (gb >= 10 ? gb.toFixed(1) : gb.toFixed(2)) + ' GB';
        }
        if (b >= 1024 * 1024) {
            return Math.max(1, Math.round(b / (1024 * 1024))) + ' MB';
        }
        if (b >= 1024) return Math.round(b / 1024) + ' KB';
        return '0 MB';
    }

    function formatStoragePair(usedBytes, limitBytes) {
        const used = Math.max(0, Number(usedBytes) || 0);
        const limit = Math.max(1, Number(limitBytes) || 1);
        const limitGb = limit / (1024 * 1024 * 1024);
        const limitLabel = limitGb >= 0.95
            ? (limitGb >= 10 ? limitGb.toFixed(0) : limitGb.toFixed(1)) + ' GB'
            : formatBytesLabel(limit);
        return formatBytesLabel(used) + ' / ' + limitLabel;
    }

    function formatRenewalLabel(dateStr, planStatus) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const ts = Date.parse(dateStr);
        if (Number.isNaN(ts)) return null;
        const expiryDate = new Date(ts);
        const formatted = expiryDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        const prefix = planStatus === 'cancelled' ? 'Access until' : 'Renews on';
        if (daysUntilExpiry < 0) return 'Expired on ' + formatted;
        if (daysUntilExpiry === 0) return prefix + ' ' + formatted + ' (today)';
        return prefix + ' ' + formatted;
    }

    function setQuotaFill(el, used, limit) {
        if (!el) return;
        const lim = Math.max(0, Number(limit) || 0);
        const pct = lim > 0 ? Math.min(100, Math.round((Math.max(0, Number(used) || 0) / lim) * 100)) : 0;
        el.style.width = pct + '%';
        el.classList.toggle('is-warn', pct >= 75 && pct < 95);
        el.classList.toggle('is-full', pct >= 95);
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setSubscriptionLoading(on) {
        const panel = document.getElementById('stgPanelBilling')
            || document.getElementById('stgPanelSubscription');
        if (!panel) return;
        panel.classList.toggle('is-loading', !!on);
        panel.classList.toggle('is-ready', !on);
    }

    function syncBillingCancelUI(info = {}) {
        const actions = document.getElementById('stgBillingActions');
        const btn = document.getElementById('stgCancelSubBtn');
        const hint = document.getElementById('stgCancelSubHint');
        if (!actions || !btn) return;

        const plan = String(info.plan || 'free').toLowerCase();
        const status = String(info.status || info.planStatus || '').toLowerCase();
        const isPaid = plan !== 'free';
        const alreadyCancelled = status === 'cancelled' || status === 'canceled';
        const canCancel = info.canCancel === true
            || (isPaid && !alreadyCancelled && info.hasPaddle !== false && status !== 'inactive');

        actions.hidden = !isPaid;
        if (!isPaid) return;

        if (alreadyCancelled) {
            btn.disabled = true;
            btn.textContent = 'Cancelled';
            if (hint) {
                const until = formatRenewalLabel(info.nextBillingDate, 'cancelled');
                hint.textContent = until
                    ? `Cancellation scheduled. ${until}.`
                    : 'Cancellation scheduled. You keep access until the end of the billing period.';
            }
            return;
        }

        btn.disabled = !canCancel;
        btn.textContent = 'Cancel subscription';
        if (hint) {
            hint.textContent = canCancel
                ? 'Stops future renewals through Paddle. You keep access until the end of the current billing period.'
                : 'Subscription is not linked to Paddle yet. Contact support if you need to cancel.';
        }
    }

    async function cancelSubscriptionViaPaddle() {
        const btn = document.getElementById('stgCancelSubBtn');
        if (btn?.disabled) return;

        const warned = confirm(
            '⚠️ Cancel subscription — immediate action\n\n'
            + 'This takes effect right away for billing:\n'
            + '• Future renewals stop immediately\n'
            + '• You keep your current plan until the end of this billing period\n'
            + '• After that date you drop to Free (no refund for unused days)\n\n'
            + 'Continue?'
        );
        if (!warned) return;

        const typed = prompt(
            'Type CANCEL to confirm you want to stop renewals now:'
        );
        if (!typed || String(typed).trim().toUpperCase() !== 'CANCEL') {
            alert('Confirmation did not match. Subscription was not cancelled.');
            return;
        }

        const prevLabel = btn ? btn.textContent : 'Cancel subscription';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Cancelling…';
        }

        try {
            const headers = typeof getAuthHeaders === 'function'
                ? getAuthHeaders()
                : { 'Content-Type': 'application/json' };
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/billing/cancel')
                : ((window.API_BASE_URL || '/api') + '/billing/cancel');
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ effective_from: 'next_billing_period' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || data.message || 'Could not cancel subscription');
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification(
                    data.message || 'Renewals stopped. You keep access until period end.',
                    'success'
                );
            } else {
                alert(
                    data.message
                    || '✅ Subscription cancel scheduled.\n\n'
                    + 'Renewals stopped immediately. You keep full access until the end of your current billing period.'
                );
            }

            syncBillingCancelUI({
                plan: data.plan || window.currentUser?.plan || 'basic',
                status: 'cancelled',
                planStatus: 'cancelled',
                hasPaddle: true,
                canCancel: false,
                nextBillingDate: data.nextBillingDate,
            });
            if (data.nextBillingDate) {
                const label = formatRenewalLabel(data.nextBillingDate, 'cancelled');
                if (label) setText('stgRenewalDate', label);
            }
            if (window.currentUser) {
                window.currentUser.plan_status = 'cancelled';
                window.currentUser.subscription_status = 'cancelled';
            }
            try { await updateSettingsModal(); } catch (_) { /* ignore */ }
        } catch (err) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = prevLabel;
            }
            alert(err.message || 'Could not cancel subscription');
        }
    }

    function formatQuotaResetHint(iso, fallback) {
        if (!iso || typeof iso !== 'string') {
            return String(fallback || '').replace(/\s*Resets \{when\}\.?/i, '').trim()
                || 'Usage details unavailable.';
        }
        const ts = Date.parse(iso);
        if (Number.isNaN(ts)) {
            return String(fallback || '').replace(/\s*Resets \{when\}\.?/i, '').trim()
                || 'Usage details unavailable.';
        }
        const d = new Date(ts);
        const label = d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
        return fallback.replace('{when}', label);
    }

    async function updateSettingsModal() {
        let currentUser = null;
        try {
            if (window.currentUser) currentUser = window.validateUserObject?.(window.currentUser) || window.currentUser;
            if (!currentUser) {
                const saved = localStorage.getItem('currentUser');
                if (saved) {
                    try {
                        currentUser = window.validateUserObject?.(JSON.parse(saved)) || JSON.parse(saved);
                    } catch (_) { /* ignore */ }
                }
            }
        } catch (err) {
            console.error('Error loading user data:', err);
        }

        if (!currentUser) return;

        setText('stgName', currentUser.name || currentUser.username || 'Guest User');
        setText('stgUserEmail', currentUser.email || 'unknown@email.com');
        setText('stgEmailAddress', currentUser.email || 'unknown@email.com');
        const stgBio = document.getElementById('stgBio');
        const hero = document.getElementById('stgProfileHero');
        if (stgBio && !hero?.classList.contains('is-editing')) {
            stgBio.textContent = currentUser.bio || '';
        }

        const stgAvatar = document.getElementById('stgAvatar');
        if (stgAvatar) {
            const pictureUrl = typeof resolveAvatarUrl === 'function'
                ? resolveAvatarUrl(currentUser)
                : (currentUser.picture || currentUser.avatar || null);
            const placeholder = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
            const okUrl = pictureUrl && (
                typeof window.isValidImageUrl !== 'function' || window.isValidImageUrl(pictureUrl)
            );
            if (okUrl) {
                const img = document.createElement('img');
                img.src = pictureUrl;
                img.alt = 'Profile';
                img.decoding = 'async';
                img.referrerPolicy = 'no-referrer';
                img.onerror = () => { stgAvatar.innerHTML = placeholder; };
                stgAvatar.innerHTML = '';
                stgAvatar.appendChild(img);
            } else {
                stgAvatar.innerHTML = placeholder;
            }
        }

        setSubscriptionLoading(true);

        const cachedPlan = String(currentUser.plan || 'free').toLowerCase();
        const stgPlanBanner = document.getElementById('stgPlanBanner');
        const stgPlanMeta = document.getElementById('stgPlanMeta');
        const stgPlanCompare = document.getElementById('stgPlanCompare');
        const stgQuotaGrid = document.getElementById('stgQuotaGrid');
        const applyPlanBanner = (plan) => {
            if (stgPlanBanner) stgPlanBanner.setAttribute('data-plan', plan);
            const free = plan === 'free';
            if (stgPlanMeta) stgPlanMeta.hidden = free;
            if (stgPlanCompare) stgPlanCompare.hidden = !free;
            if (stgQuotaGrid) stgQuotaGrid.hidden = free;
        };
        if (['free', 'basic', 'prime', 'elite'].includes(cachedPlan)) {
            setText('stgCurrentPlan', cachedPlan.charAt(0).toUpperCase() + cachedPlan.slice(1));
            applyPlanBanner(cachedPlan);
        }

        try {
            const { profile, subscription, clipsStatus, storageInfo } = await fetchSecureSettingsData();

            const editing = document.getElementById('stgProfileHero')?.classList.contains('is-editing');
            if (profile.name) {
                setText('stgName', profile.name);
                if (!editing && window.currentUser) {
                    window.currentUser.name = profile.name;
                    window.currentUser.displayName = profile.name;
                }
            }
            if (typeof profile.bio === 'string' && !editing) {
                setText('stgBio', profile.bio);
                if (window.currentUser) window.currentUser.bio = profile.bio;
            }
            if (profile.email) {
                setText('stgUserEmail', profile.email);
                setText('stgEmailAddress', profile.email);
            }
            if (profile.public_id || profile.solis_id) {
                const sid = profile.public_id || profile.solis_id;
                setText('stgSolisPublicId', formatSolisIdDisplay(sid));
                if (window.currentUser) {
                    window.currentUser.public_id = sid;
                    window.currentUser.solis_id = sid;
                }
            }
            if (profile.supabase_auth_id && window.currentUser) {
                window.currentUser.supabase_auth_id = profile.supabase_auth_id;
            }
            if (profile.picture || profile.avatar) {
                const pic = profile.picture || profile.avatar;
                if (window.currentUser) {
                    window.currentUser.picture = pic;
                    window.currentUser.avatar = pic;
                }
                const stgAvatarEl = document.getElementById('stgAvatar');
                const pictureUrl = typeof resolveAvatarUrl === 'function'
                    ? resolveAvatarUrl({ ...currentUser, ...profile, picture: pic })
                    : pic;
                const okUrl = pictureUrl && (
                    typeof window.isValidImageUrl !== 'function' || window.isValidImageUrl(pictureUrl)
                );
                if (stgAvatarEl && okUrl) {
                    let img = stgAvatarEl.querySelector('img');
                    if (!img) {
                        img = document.createElement('img');
                        img.alt = 'Profile';
                        img.decoding = 'async';
                        img.referrerPolicy = 'no-referrer';
                        stgAvatarEl.innerHTML = '';
                        stgAvatarEl.appendChild(img);
                    }
                    img.src = pictureUrl + (pictureUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
                }
            }

            const planRaw = String(profile.plan || 'free').toLowerCase();
            const validPlans = ['free', 'basic', 'prime', 'elite'];
            const actualPlan = validPlans.includes(planRaw) ? planRaw : 'free';
            const planName = actualPlan.charAt(0).toUpperCase() + actualPlan.slice(1);
            const isFreePlan = actualPlan === 'free';

            setText('stgCurrentPlan', planName);
            applyPlanBanner(actualPlan);
            if (stgUpgradeBtn) {
                stgUpgradeBtn.classList.toggle('hidden', actualPlan === 'elite' || isFreePlan);
            }

            const status = clipsStatus && typeof clipsStatus === 'object' ? clipsStatus : {};
            const statusVideos = status.storage?.videos || {};
            const statusSpace = status.storage?.space_mb || {};
            const statusDaily = status.daily || {};
            const statusMonthly = status.monthly || {};
            const statusMax = status.max_effort || {};

            const videoLimit = Math.max(
                1,
                Number(
                    statusVideos.limit ??
                    status.plan?.videos_space ??
                    2
                ) || 2
            );
            const videosInLibrary = Math.max(
                0,
                Number(statusVideos.used ?? 0) || 0
            );
            setText('stgVideosUsed', videosInLibrary + ' / ' + videoLimit);
            setQuotaFill(document.getElementById('stgVideosFill'), videosInLibrary, videoLimit);

            let storageUsedBytes = Math.max(0, Number(statusSpace.used) || 0) * 1024 * 1024;
            let storageLimitBytes = Math.max(1, Number(statusSpace.total) || 512) * 1024 * 1024;
            if (Number(status.plan?.storage_gb) > 0 && (!statusSpace.total || statusSpace.total <= 0)) {
                storageLimitBytes = Number(status.plan.storage_gb) * 1024 * 1024 * 1024;
            }
            setText('stgStorage', formatStoragePair(storageUsedBytes, storageLimitBytes));
            setQuotaFill(document.getElementById('stgStorageFill'), storageUsedBytes, storageLimitBytes);

            const dailyLimit = Math.max(
                0,
                Number(statusDaily.limit ?? status.plan?.videos_per_day ?? 0) || 0
            );
            const dailyUsed = Math.max(0, Number(statusDaily.used ?? 0) || 0);
            if (dailyLimit > 0) {
                setText('stgDailyGens', dailyUsed + ' / ' + dailyLimit);
                setQuotaFill(document.getElementById('stgDailyFill'), dailyUsed, dailyLimit);
                const dailyHint = document.getElementById('stgDailyHint');
                if (dailyHint) {
                    if (statusDaily.resets_at) {
                        dailyHint.textContent = formatQuotaResetHint(
                            statusDaily.resets_at,
                            dailyUsed >= dailyLimit
                                ? 'Daily quota reached. Resets {when}.'
                                : 'Resets {when}.'
                        );
                    }
                }
            } else {
                setText('stgDailyGens', '—');
                setQuotaFill(document.getElementById('stgDailyFill'), 0, 1);
            }

            const monthlyLimit = Math.max(
                0,
                Number(statusMonthly.limit ?? status.plan?.videos_per_month ?? 0) || 0
            );
            const monthlyUsed = Math.max(0, Number(statusMonthly.used ?? 0) || 0);
            if (monthlyLimit > 0) {
                setText('stgMonthlyGens', monthlyUsed + ' / ' + monthlyLimit);
                setQuotaFill(document.getElementById('stgMonthlyFill'), monthlyUsed, monthlyLimit);
                const monthlyHint = document.getElementById('stgMonthlyHint');
                if (monthlyHint) {
                    monthlyHint.textContent = formatQuotaResetHint(
                        statusMonthly.resets_at,
                        monthlyUsed >= monthlyLimit
                            ? 'Monthly quota reached. Resets {when}.'
                            : 'Resets {when}.'
                    );
                }
            } else {
                setText('stgMonthlyGens', '—');
                setQuotaFill(document.getElementById('stgMonthlyFill'), 0, 1);
            }

            const maxLimit = Number(statusMax.limit ?? 0);
            const maxUsed = Number(statusMax.used ?? 0);
            const maxRem = statusMax.remaining;
            if (maxLimit > 0) {
                setText('stgMaxEffort', maxUsed + ' / ' + maxLimit + ' used');
                setQuotaFill(document.getElementById('stgMaxFill'), maxUsed, maxLimit);
                const hint = document.getElementById('stgMaxHint');
                if (hint) {
                    const rem = Math.max(0, Number(maxRem ?? (maxLimit - maxUsed)));
                    hint.textContent = rem > 0
                        ? rem + ' Premium Request' + (rem === 1 ? '' : 's') + ' left in this window.'
                        : 'Premium Requests locked until reset.';
                }
            } else {
                setText('stgMaxEffort', 'Not on your plan');
                setQuotaFill(document.getElementById('stgMaxFill'), 0, 1);
                const hint = document.getElementById('stgMaxHint');
                if (hint) hint.textContent = 'Upgrade to Prime or Elite for Premium Requests.';
            }

            const renewalLabel = formatRenewalLabel(
                profile.subscription_end_date || profile.plan_expires_at,
                profile.plan_status
            );
            if (renewalLabel) setText('stgRenewalDate', renewalLabel);
            else if (!isFreePlan) setText('stgRenewalDate', 'Active subscription');
            else setText('stgRenewalDate', 'No active subscription');

            syncBillingCancelUI({
                plan: actualPlan,
                planStatus: profile.plan_status || profile.subscription_status,
                hasPaddle: !!(profile.paddle_subscription_id || subscription?.paddleSubscriptionId),
                canCancel: subscription?.canCancel,
                status: subscription?.status || profile.plan_status,
                nextBillingDate: subscription?.nextBillingDate
                    || profile.subscription_end_date
                    || profile.plan_expires_at,
            });

            window.currentUser = Object.assign({}, window.currentUser || {}, profile, {
                active_videos: videosInLibrary,
                video_limit: videoLimit,
            });

            setSubscriptionLoading(false);
        } catch (err) {
            console.error('Error fetching settings subscription data:', err);
            setText('stgCurrentPlan', 'Error loading');
            setText('stgRenewalDate', 'Unavailable');
            setText('stgVideosUsed', 'Unavailable');
            setText('stgStorage', 'Unavailable');
            setText('stgDailyGens', 'Unavailable');
            setText('stgMonthlyGens', 'Unavailable');
            setText('stgMaxEffort', 'Unavailable');
            syncBillingCancelUI({ plan: 'free' });
            setSubscriptionLoading(false);
        }

        updateYouTubeConnectorUI(!!currentUser.youtube_connected);
    }

    function updateYouTubeConnectorUI(connected) {
        const statusEl = document.getElementById('stgYouTubeStatus');
        const btn = document.getElementById('stgYouTubeConnectBtn');
        const row = document.getElementById('stgYouTubeConnector');

        if (statusEl) {
            statusEl.textContent = connected ? 'Connected' : 'Not connected';
            statusEl.classList.toggle('is-on', connected);
        }
        if (btn) {
            btn.textContent = connected ? 'Disconnect' : 'Connect';
            btn.classList.toggle('is-connected', connected);
            btn.disabled = false;
        }
        if (row) row.classList.toggle('is-connected', connected);
    }

    const stgYouTubeConnectBtn = document.getElementById('stgYouTubeConnectBtn');
    if (stgYouTubeConnectBtn) {
        stgYouTubeConnectBtn.addEventListener('click', () => {
            const connected = !!(window.currentUser && window.currentUser.youtube_connected);
            if (connected) {
                if (typeof window.disconnectYouTube === 'function') window.disconnectYouTube();
            } else if (typeof window.connectYouTube === 'function') {
                window.connectYouTube();
            }
        });
    }

    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    window.updateSettingsModal = updateSettingsModal;
    window.switchSettingsPanel = switchSettingsPanel;

    const stgEditHeaderBtn = document.getElementById('stgEditHeaderBtn');
    let isEditingProfile = false;

    function setProfileEditing(on) {
        const hero = document.getElementById('stgProfileHero');
        const nameEl = document.getElementById('stgName');
        const bioEl = document.getElementById('stgBio');
        const nameInput = document.getElementById('stgNameInput');
        const bioInput = document.getElementById('stgBioInput');
        if (!hero || !nameInput || !bioInput || !stgEditHeaderBtn) return;

        isEditingProfile = !!on;
        hero.classList.toggle('is-editing', isEditingProfile);
        nameInput.hidden = !isEditingProfile;
        bioInput.hidden = !isEditingProfile;

        if (isEditingProfile) {
            nameInput.value = (nameEl?.textContent || '').trim();
            bioInput.value = bioEl?.textContent || '';
            stgEditHeaderBtn.classList.add('editing');
            stgEditHeaderBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Done</span>';
            requestAnimationFrame(() => {
                nameInput.focus();
                nameInput.select();
            });
        } else {
            stgEditHeaderBtn.classList.remove('editing');
            stgEditHeaderBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit</span>';
        }
    }

    function toggleProfileEditMode() {
        if (!isEditingProfile) {
            setProfileEditing(true);
            return;
        }
        const nameInput = document.getElementById('stgNameInput');
        const bioInput = document.getElementById('stgBioInput');
        saveProfileChanges(
            nameInput?.value?.trim() || '',
            bioInput?.value?.trim() || ''
        );
    }

    async function saveProfileChanges(newName, newBio) {
        const name = String(newName || '').trim();
        const bio = String(newBio || '').trim();
        if (!name) {
            alert('Name cannot be empty');
            return;
        }
        if (name.length > 50) {
            alert('Name too long (max 50 characters)');
            return;
        }
        if (bio.length > 120) {
            alert('Bio too long (max 120 characters)');
            return;
        }

        try {
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/user/profile/update')
                : '/api/user/profile/update';
            const fetchFn = typeof window.apiFetch === 'function'
                ? window.apiFetch
                : fetch;

            const response = await fetchFn(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, bio }),
            });

            let result = {};
            try {
                result = await response.json();
            } catch (_) { /* ignore */ }

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update profile');
            }

            const savedName = result.name || name;
            const savedBio = typeof result.bio === 'string' ? result.bio : bio;

            setText('stgName', savedName);
            setText('stgBio', savedBio);
            setProfileEditing(false);

            if (window.currentUser && typeof window.currentUser === 'object') {
                window.currentUser.name = savedName;
                window.currentUser.displayName = savedName;
                window.currentUser.bio = savedBio;
            }
            try {
                const saved = localStorage.getItem('currentUser');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    parsed.name = savedName;
                    parsed.bio = savedBio;
                    localStorage.setItem('currentUser', JSON.stringify(parsed));
                }
            } catch (_) { /* ignore */ }

            document.querySelectorAll('.user-name, #dropdownUserName, #menuUserName').forEach((el) => {
                if (el) el.textContent = savedName;
            });

            if (typeof window.apiCache?.clearUserProfile === 'function') {
                window.apiCache.clearUserProfile();
            } else if (window.apiCache) {
                window.apiCache.userProfile = null;
                window.apiCache.userProfileTime = 0;
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification('Profile updated', 'success');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            alert(error.message || 'Error updating profile');
            cancelProfileEdit();
        }
    }

    const pfpFileInput = document.getElementById('pfpFileInput');
    const stgAvatarContainer = document.getElementById('stgAvatarContainer');
    const cropBackdrop = document.getElementById('stgCropBackdrop');
    const cropModal = document.getElementById('stgCropModal');
    const cropImg = document.getElementById('stgCropImg');
    const cropViewport = document.getElementById('stgCropViewport');
    const cropStage = document.getElementById('stgCropStage');
    const cropZoom = document.getElementById('stgCropZoom');
    const cropSaveBtn = document.getElementById('stgCropSave');
    let pfpUploadInProgress = false;
    let pfpLastUploadTime = 0;
    const PFP_COOLDOWN_MS = 4000;
    const PFP_MAX_BYTES = 5 * 1024 * 1024;
    const PFP_SAFE_EDGE = 512;

    const cropState = {
        open: false,
        objectUrl: null,
        naturalW: 0,
        naturalH: 0,
        baseScale: 1,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        lastX: 0,
        lastY: 0,
        pointerId: null,
    };

    function detectImageMime(bytes) {
        if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
            return 'image/jpeg';
        }
        if (
            bytes.length >= 8 &&
            bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        ) {
            return 'image/png';
        }
        if (
            bytes.length >= 12 &&
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        ) {
            return 'image/webp';
        }
        return null;
    }

    function cropViewportSize() {
        if (!cropViewport) return 280;
        return Math.max(120, Math.round(cropViewport.getBoundingClientRect().width || 280));
    }

    function clampCropOffsets() {
        const view = cropViewportSize();
        const scale = cropState.baseScale * cropState.zoom;
        const dispW = cropState.naturalW * scale;
        const dispH = cropState.naturalH * scale;
        const maxX = Math.max(0, (dispW - view) / 2);
        const maxY = Math.max(0, (dispH - view) / 2);
        cropState.offsetX = Math.max(-maxX, Math.min(maxX, cropState.offsetX));
        cropState.offsetY = Math.max(-maxY, Math.min(maxY, cropState.offsetY));
    }

    function applyCropTransform() {
        if (!cropImg) return;
        clampCropOffsets();
        const scale = cropState.baseScale * cropState.zoom;
        cropImg.style.width = `${cropState.naturalW}px`;
        cropImg.style.height = `${cropState.naturalH}px`;
        cropImg.style.transform =
            `translate(-50%, -50%) translate(${cropState.offsetX}px, ${cropState.offsetY}px) scale(${scale})`;
    }

    function closeCropModal() {
        cropState.open = false;
        cropState.dragging = false;
        cropBackdrop?.classList.remove('is-open');
        cropModal?.classList.remove('is-open');
        if (cropBackdrop) cropBackdrop.hidden = true;
        if (cropModal) cropModal.hidden = true;
        if (cropState.objectUrl) {
            URL.revokeObjectURL(cropState.objectUrl);
            cropState.objectUrl = null;
        }
        if (cropImg) cropImg.removeAttribute('src');
        if (pfpFileInput) pfpFileInput.value = '';
        if (cropSaveBtn) {
            cropSaveBtn.disabled = false;
            cropSaveBtn.classList.remove('is-busy');
        }
    }

    function openCropModal(file) {
        if (!cropModal || !cropImg || !cropViewport) {
            uploadProfilePicture(file);
            return;
        }
        if (cropState.objectUrl) URL.revokeObjectURL(cropState.objectUrl);
        const url = URL.createObjectURL(file);
        cropState.objectUrl = url;
        cropState.zoom = 1;
        cropState.offsetX = 0;
        cropState.offsetY = 0;
        if (cropZoom) cropZoom.value = '1';

        const onLoad = () => {
            cropImg.removeEventListener('load', onLoad);
            cropState.naturalW = cropImg.naturalWidth || 0;
            cropState.naturalH = cropImg.naturalHeight || 0;
            if (cropState.naturalW < 64 || cropState.naturalH < 64) {
                closeCropModal();
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Image too small. Minimum 64x64 pixels.', 'error');
                }
                return;
            }
            if (cropState.naturalW > 5000 || cropState.naturalH > 5000) {
                closeCropModal();
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Image too large. Maximum 5000x5000 pixels.', 'error');
                }
                return;
            }
            const view = cropViewportSize();
            cropState.baseScale = Math.max(view / cropState.naturalW, view / cropState.naturalH);
            cropState.zoom = 1;
            cropState.offsetX = 0;
            cropState.offsetY = 0;
            applyCropTransform();
            cropState.open = true;
            if (cropBackdrop) {
                cropBackdrop.hidden = false;
                cropBackdrop.classList.add('is-open');
            }
            cropModal.hidden = false;
            cropModal.classList.add('is-open');
            requestAnimationFrame(() => applyCropTransform());
        };
        cropImg.addEventListener('load', onLoad);
        cropImg.src = url;
    }

    async function exportCroppedAvatarFile() {
        const view = cropViewportSize();
        const scale = cropState.baseScale * cropState.zoom;
        const out = PFP_SAFE_EDGE;
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to process image');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out, out);

        const srcSize = view / scale;
        const srcCx = cropState.naturalW / 2 - cropState.offsetX / scale;
        const srcCy = cropState.naturalH / 2 - cropState.offsetY / scale;
        const sx = srcCx - srcSize / 2;
        const sy = srcCy - srcSize / 2;

        ctx.drawImage(
            cropImg,
            sx, sy, srcSize, srcSize,
            0, 0, out, out
        );

        const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => {
                if (b && b.size > 0) resolve(b);
                else canvas.toBlob((j) => resolve(j), 'image/jpeg', 0.9);
            }, 'image/webp', 0.9);
        });
        if (!blob || blob.size <= 0) throw new Error('Failed to process image');
        if (blob.size > PFP_MAX_BYTES) throw new Error('Image too large. Maximum size is 5MB.');
        const mime = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const ext = mime === 'image/webp' ? 'webp' : 'jpg';
        return new File([blob], `avatar.${ext}`, { type: mime, lastModified: Date.now() });
    }

    function applyAvatarEverywhere(url) {
        if (!url) return;
        const bust = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        const setImg = (root) => {
            if (!root) return;
            let img = root.tagName === 'IMG' ? root : root.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.alt = 'Profile';
                img.decoding = 'async';
                img.referrerPolicy = 'no-referrer';
                if (root.tagName !== 'IMG') {
                    root.innerHTML = '';
                    root.appendChild(img);
                }
            }
            img.src = bust;
        };
        setImg(document.getElementById('stgAvatar'));
        setImg(document.querySelector('.user-avatar'));
        setImg(document.getElementById('profileAvatarBtn'));
        setImg(document.getElementById('dropdownUserAvatar'));
        setImg(document.getElementById('menuUserAvatar'));
    }

    async function uploadProfilePicture(file) {
        if (pfpUploadInProgress || !file) return;
        pfpUploadInProgress = true;
        const stgAvatar = document.getElementById('stgAvatar');
        try {
            if (stgAvatar) stgAvatar.style.opacity = '0.55';
            if (cropSaveBtn) {
                cropSaveBtn.disabled = true;
                cropSaveBtn.classList.add('is-busy');
            }

            const formData = new FormData();
            formData.append('pfp', file, file.name || 'avatar.webp');

            const fetchFn = typeof window.apiFetch === 'function' ? window.apiFetch : fetch;
            const response = await fetchFn('/api/user/pfp', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            let result = {};
            try {
                result = await response.json();
            } catch (_) { /* ignore */ }

            if (!response.ok) {
                throw new Error(result.error || 'Failed to upload profile picture');
            }

            const avatarUrl = (result.avatar_url || result.pfp_url || '');
            if (!avatarUrl.startsWith('/api/avatar/')) {
                throw new Error('Server returned an invalid avatar URL');
            }

            applyAvatarEverywhere(avatarUrl);

            if (window.currentUser && typeof window.currentUser === 'object') {
                window.currentUser.picture = avatarUrl;
                window.currentUser.avatar = avatarUrl;
            }
            try {
                const saved = localStorage.getItem('currentUser');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    parsed.picture = avatarUrl;
                    parsed.avatar = avatarUrl;
                    localStorage.setItem('currentUser', JSON.stringify(parsed));
                }
            } catch (_) { /* ignore */ }

            if (window.apiCache) {
                window.apiCache.userProfile = null;
                window.apiCache.userProfileTime = 0;
            }

            pfpLastUploadTime = Date.now();
            closeCropModal();
            if (typeof window.showNotification === 'function') {
                window.showNotification('Profile picture updated', 'success');
            }
        } catch (err) {
            console.error('PFP upload error:', err);
            if (typeof window.showNotification === 'function') {
                window.showNotification(err.message || 'Failed to upload profile picture', 'error');
            } else {
                alert(err.message || 'Failed to upload profile picture');
            }
            if (cropSaveBtn) {
                cropSaveBtn.disabled = false;
                cropSaveBtn.classList.remove('is-busy');
            }
        } finally {
            if (stgAvatar) stgAvatar.style.opacity = '1';
            pfpUploadInProgress = false;
            if (pfpFileInput) pfpFileInput.value = '';
        }
    }

    async function saveCroppedAvatar() {
        if (!cropState.open || pfpUploadInProgress) return;
        try {
            const file = await exportCroppedAvatarFile();
            await uploadProfilePicture(file);
        } catch (err) {
            console.error('Crop export error:', err);
            if (typeof window.showNotification === 'function') {
                window.showNotification(err.message || 'Failed to process image', 'error');
            }
        }
    }

    function onCropPointerDown(e) {
        if (!cropState.open || e.button != null && e.button !== 0) return;
        e.preventDefault();
        cropState.dragging = true;
        cropState.lastX = e.clientX;
        cropState.lastY = e.clientY;
        cropState.pointerId = e.pointerId;
        cropStage?.setPointerCapture?.(e.pointerId);
    }
    function onCropPointerMove(e) {
        if (!cropState.dragging) return;
        e.preventDefault();
        const dx = e.clientX - cropState.lastX;
        const dy = e.clientY - cropState.lastY;
        cropState.lastX = e.clientX;
        cropState.lastY = e.clientY;
        cropState.offsetX += dx;
        cropState.offsetY += dy;
        applyCropTransform();
    }
    function onCropPointerUp(e) {
        if (!cropState.dragging) return;
        cropState.dragging = false;
        try { cropStage?.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    }

    if (cropStage) {
        cropStage.addEventListener('pointerdown', onCropPointerDown);
        cropStage.addEventListener('pointermove', onCropPointerMove);
        cropStage.addEventListener('pointerup', onCropPointerUp);
        cropStage.addEventListener('pointercancel', onCropPointerUp);
        cropStage.addEventListener('wheel', (e) => {
            if (!cropState.open) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            cropState.zoom = Math.max(1, Math.min(3, cropState.zoom + delta));
            if (cropZoom) cropZoom.value = String(cropState.zoom);
            applyCropTransform();
        }, { passive: false });
    }
    cropZoom?.addEventListener('input', () => {
        cropState.zoom = Math.max(1, Math.min(3, Number(cropZoom.value) || 1));
        applyCropTransform();
    });
    document.getElementById('stgCropZoomIn')?.addEventListener('click', () => {
        cropState.zoom = Math.min(3, cropState.zoom + 0.12);
        if (cropZoom) cropZoom.value = String(cropState.zoom);
        applyCropTransform();
    });
    document.getElementById('stgCropZoomOut')?.addEventListener('click', () => {
        cropState.zoom = Math.max(1, cropState.zoom - 0.12);
        if (cropZoom) cropZoom.value = String(cropState.zoom);
        applyCropTransform();
    });
    document.getElementById('stgCropCancel')?.addEventListener('click', () => closeCropModal());
    document.getElementById('stgCropClose')?.addEventListener('click', () => closeCropModal());
    cropBackdrop?.addEventListener('click', () => closeCropModal());
    cropModal?.addEventListener('click', (e) => {
        if (e.target === cropModal) closeCropModal();
    });
    cropSaveBtn?.addEventListener('click', () => { saveCroppedAvatar(); });
    cropModal?.querySelector('.stgCropCard')?.addEventListener('click', (e) => e.stopPropagation());

    if (stgAvatarContainer && pfpFileInput) {
        stgAvatarContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pfpUploadInProgress || cropState.open) return;
            pfpFileInput.click();
        });
    }

    if (pfpFileInput) {
        pfpFileInput.addEventListener('change', async () => {
            const file = pfpFileInput.files && pfpFileInput.files[0];
            if (!file) return;
            const now = Date.now();
            if (now - pfpLastUploadTime < PFP_COOLDOWN_MS) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Please wait before uploading another picture', 'warning');
                }
                pfpFileInput.value = '';
                return;
            }
            try {
                const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
                const mime = detectImageMime(header);
                if (!mime) throw new Error('File is not a valid JPG, PNG, or WebP image');
                if (file.size <= 0 || file.size > PFP_MAX_BYTES) {
                    throw new Error('Image too large. Maximum size is 5MB.');
                }
                openCropModal(file);
            } catch (err) {
                pfpFileInput.value = '';
                if (typeof window.showNotification === 'function') {
                    window.showNotification(err.message || 'Invalid image', 'error');
                } else {
                    alert(err.message || 'Invalid image');
                }
            }
        });
    }

    function formatSolisIdDisplay(raw) {
        const s = String(raw || '').trim().toUpperCase();
        if (!s.startsWith('SOL-')) return s;
        const body = s.slice(4).replace(/-/g, '');
        if (body.length <= 8) return `SOL-${body}`;
        const parts = [];
        for (let i = 0; i < body.length; i += 4) parts.push(body.slice(i, i + 4));
        return `SOL-${parts.join('-')}`;
    }

    function populateAccountPanel() {
        const sid =
            window.currentUser?.public_id
            || window.currentUser?.solis_id
            || document.getElementById('stgSolisPublicId')?.textContent
            || '—';
        const idEl = document.getElementById('stgSolisPublicId');
        if (idEl && sid && sid !== '—') idEl.textContent = formatSolisIdDisplay(sid);

        const ua = navigator.userAgent || '';
        let device = 'This browser';
        const low = ua.toLowerCase();
        if (low.includes('edg/')) device = 'Edge';
        else if (low.includes('firefox')) device = 'Firefox';
        else if (low.includes('chrome')) device = 'Chrome';
        else if (low.includes('safari')) device = 'Safari';
        setText('stgSessionDevice', device);

        const now = new Date();
        const fmt = (d) => {
            try {
                return d.toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                });
            } catch (_) {
                return d.toISOString();
            }
        };
        setText('stgSessionUpdated', fmt(now));
        const createdEl = document.getElementById('stgSessionCreated');
        if (createdEl && (!createdEl.textContent || createdEl.textContent === '—')) {
            createdEl.textContent = fmt(now);
        }
        setText('stgSessionLocation', '…');

        const headers = typeof getAuthHeaders === 'function'
            ? getAuthHeaders()
            : { 'Content-Type': 'application/json' };
        const sessionsUrl = typeof window.apiUrl === 'function'
            ? window.apiUrl('/api/user/account/sessions')
            : '/api/user/account/sessions';
        fetch(sessionsUrl, { credentials: 'include', headers })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const s = data?.sessions?.[0];
                if (!s) {
                    setText('stgSessionLocation', 'Unknown');
                    return;
                }
                if (s.device) setText('stgSessionDevice', s.device);
                setText('stgSessionLocation', s.location || 'Unknown');
                if (s.updated_at) {
                    try { setText('stgSessionUpdated', fmt(new Date(s.updated_at))); } catch (_) {}
                }
                if (s.created_at) {
                    try { setText('stgSessionCreated', fmt(new Date(s.created_at))); } catch (_) {}
                }
            })
            .catch(() => setText('stgSessionLocation', 'Unknown'));
    }

    document.getElementById('stgCopySolisIdBtn')?.addEventListener('click', async () => {
        const text = document.getElementById('stgSolisPublicId')?.textContent?.trim() || '';
        if (!text || text === '—') return;
        try {
            await navigator.clipboard.writeText(text);
            if (typeof window.showNotification === 'function') {
                window.showNotification('Solis ID copied', 'success');
            }
        } catch (_) {
            alert(text);
        }
    });

    document.getElementById('stgLogoutAllBtn')?.addEventListener('click', async () => {
        if (!confirm('Log out of all devices? You will need to sign in again.')) return;
        try {
            const headers = typeof getAuthHeaders === 'function'
                ? getAuthHeaders()
                : { 'Content-Type': 'application/json' };
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/user/account/logout-all')
                : '/api/user/account/logout-all';
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers,
            });
            if (!res.ok) throw new Error('Logout failed');
            window.location.href = '/login.html';
        } catch (err) {
            alert(err.message || 'Could not log out');
        }
    });

    document.getElementById('stgCancelSubBtn')?.addEventListener('click', () => {
        cancelSubscriptionViaPaddle();
    });

    document.getElementById('stgDeleteAccountBtn')?.addEventListener('click', async () => {
        const typed = prompt('Type DELETE to permanently close your Solis account:');
        if (!typed) return;
        if (String(typed).trim().toUpperCase() !== 'DELETE') {
            alert('Confirmation did not match. Account not deleted.');
            return;
        }
        if (!confirm('This cannot be undone. Delete your account now?')) return;
        try {
            const headers = typeof getAuthHeaders === 'function'
                ? getAuthHeaders()
                : { 'Content-Type': 'application/json' };
            const url = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/user/account/delete')
                : '/api/user/account/delete';
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'DELETE' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            window.location.href = '/login.html';
        } catch (err) {
            alert(err.message || 'Could not delete account');
        }
    });

    function cancelProfileEdit() {
        if (!isEditingProfile) return;
        setProfileEditing(false);
    }

    if (stgEditHeaderBtn) {
        stgEditHeaderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfileEditMode();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && cropState.open) {
            e.preventDefault();
            closeCropModal();
            return;
        }
        if (e.key === 'Escape' && isEditingProfile) {
            cancelProfileEdit();
            return;
        }
        if (e.key === 'Escape' && stgModal?.classList.contains('open')) {
            closeSettingsModal();
        }
    });
});
