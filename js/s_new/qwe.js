window.getCSRFToken = function() {
            const metaToken = document.querySelector('meta[name="csrf-token"]');
            if (metaToken) return metaToken.getAttribute('content');

            const name = 'csrf_token=';
            const decodedCookie = decodeURIComponent(document.cookie);
            const cookieArray = decodedCookie.split(';');
            for (let cookie of cookieArray) {
                cookie = cookie.trim();
                if (cookie.indexOf(name) === 0) {
                    return cookie.substring(name.length);
                }
            }
            return null;
        };

        window.secureHeaders = function() {
            return {
                'Content-Type': 'application/json',
                ...(window.getCSRFToken() && { 'X-CSRF-Token': window.getCSRFToken() })
            };
        };

        window.createDebounce = function(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func(...args), delay);
            };
        };

        window.addEventListener('load', () => {
            const inputSection = document.querySelector('.input-section');
            const inputContainer = document.querySelector('.input-container');
            const currentIndex = parseInt(localStorage.getItem('sidebarActiveIndex') || '0');

            if (inputSection && inputContainer) {
                if (currentIndex === 0) {
                    inputSection.classList.add('active');
                    inputContainer.classList.remove('hidden');
                    inputSection.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: all !important; z-index: 1000 !important;';
                } else {
                    inputSection.classList.remove('active');
                    inputContainer.classList.add('hidden');
                    inputSection.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;';
                }
            }
        });

        window.handleDeleteAllClips = async function() {
            const confirmed = confirm('This will permanently delete every clip in your library. This cannot be undone.');
            if (!confirmed) return;

            const doubleConfirmed = confirm('Final confirmation: delete all stored clips?');
            if (!doubleConfirmed) return;

            try {
                if (!window.clipsStudio || !window.clipsStudio.libraryItems || window.clipsStudio.libraryItems.length === 0) {
                    window.clipsStudio?.showNotification('No clips to delete', 'info');
                    return;
                }

                const totalClips = window.clipsStudio.libraryItems.length;
                const clipIds = window.clipsStudio.libraryItems.map(clip => clip.id);
                let deletedCount = 0;

                try {
                    const response = await fetch('/api/clips/bulk-delete', {
                        method: 'DELETE',
                        credentials: 'include', // ✅ Uses httpOnly cookie
                        headers: {
                            'Content-Type': 'application/json',
                            ...(window.getCSRFToken && { 'X-CSRF-Token': window.getCSRFToken() })
                        },
                        body: JSON.stringify({ clip_ids: clipIds })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        const safeMsg = window.getSafeErrorMessage(errorData);
                        console.error('Bulk delete failed:', response.status, errorData);
                        window.clipsStudio?.showNotification('Failed to delete clips: ' + safeMsg, 'error');
                        return;
                    }

                    const result = await response.json();
                    deletedCount = result.deleted_count || totalClips;
                } catch (bulkError) {
                    console.warn('Bulk delete endpoint failed, falling back to individual deletes:', bulkError);

                    for (const clip of window.clipsStudio.libraryItems) {
                        try {
                            const projectId = clip.projectId || clip.project_id;
                            if (!projectId) continue;
                            const response = await fetch(`/api/clips/project/${encodeURIComponent(projectId)}`, {
                                method: 'DELETE',
                                credentials: 'include', // ✅ Use httpOnly cookie, not localStorage token
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(window.getCSRFToken && { 'X-CSRF-Token': window.getCSRFToken() })
                                }
                            });

                            if (response.ok) {
                                deletedCount++;
                            } else {
                                console.error(`Failed to delete clip ${projectId}: ${response.status}`);
                            }

                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`Exception deleting clip:`, error);
                        }
                    }
                }

                window.clipsStudio.libraryItems = [];
                window.clipsStudio.saveLibraryItems();
                window.clipsStudio.updateLibraryView();

                updateStorageBadgeDisplay();
                window.clipsStudio?.showNotification(`Deleted ${deletedCount}/${totalClips} clips`, 'success');

                setTimeout(() => {
                    window.location.reload();
                }, 800);
            } catch (error) {
                console.error('Error deleting all clips:', error);
                window.clipsStudio?.showNotification('Error: Failed to delete clips. Please try again.', 'error');
            }
        };

    window.getStoragePhase = function(used, limit, plan) {
        const safeUsed = Math.max(0, used);
        const safeLimit = Math.max(1, limit);
        const ratio = safeUsed / safeLimit;
        const isFree = !plan || plan === 'free';
        const orangeAt = isFree ? 0.5 : 0.5;
        const redAt = isFree ? 0.75 : 0.8;
        const deleteAt = isFree ? 0.5 : 0.8;
        const upgradeAt = isFree ? 0.5 : 0.9;

        let phase = 'ok';
        if (ratio >= 1) phase = 'full';
        else if (ratio >= redAt) phase = 'high';
        else if (ratio >= orangeAt) phase = 'half';

        return {
            phase,
            ratio,
            showDeleteAll: ratio >= deleteAt && safeUsed > 0,
            showUpgrade: isFree && ratio >= upgradeAt
        };
    };

    window.applyStorageBadgeUI = function({ used, limit, plan }) {
        const planNorm = (typeof plan === 'string' && plan.length) ? plan.toLowerCase() : 'free';
        const { phase, showDeleteAll, showUpgrade } = window.getStoragePhase(used, limit, planNorm);
        const planLabel = planNorm.charAt(0).toUpperCase() + planNorm.slice(1);
        const isWarn = phase === 'high' || phase === 'full';

        const storageBadge = document.getElementById('storageBadge');
        const usedEl = document.getElementById('storageUsedBadge');
        const totalEl = document.getElementById('storageTotalBadge');
        const planEl = document.getElementById('storagePlanBadge');
        const warnIcon = document.getElementById('storageWarnIcon');
        const deleteAllBtn = document.getElementById('deleteAllClipsBtn');
        const needMoreUpgradeText = document.getElementById('needMoreUpgradeText');

        if (usedEl) {
            usedEl.textContent = String(used);
            usedEl.style.color = '';
            usedEl.classList.toggle('storage-count-warn', isWarn);
        }
        if (totalEl) {
            totalEl.textContent = String(limit);
            totalEl.style.color = '';
            totalEl.classList.toggle('storage-count-warn', phase === 'full');
        }
        if (planEl) planEl.textContent = planLabel;

        if (storageBadge) {
            storageBadge.classList.toggle('is-warn', isWarn);
            storageBadge.classList.toggle('is-full', phase === 'full');
            storageBadge.title = phase === 'full'
                ? 'Storage full — delete clips or upgrade your plan'
                : phase === 'high'
                    ? `Storage almost full (${used}/${limit}) — remove old videos to keep generating`
                    : 'Library storage';
        }
        if (warnIcon) {
            warnIcon.hidden = !isWarn;
            warnIcon.setAttribute('aria-hidden', isWarn ? 'false' : 'true');
        }

        if (deleteAllBtn) deleteAllBtn.style.display = showDeleteAll ? 'inline-flex' : 'none';
        if (needMoreUpgradeText) needMoreUpgradeText.style.display = showUpgrade ? 'inline' : 'none';
    };

    window.pulseStorageBadgeWarning = function() {
        const storageBadge = document.getElementById('storageBadge');
        if (!storageBadge) return;
        storageBadge.classList.add('is-warn', 'storage-badge-attention');
        const warnIcon = document.getElementById('storageWarnIcon');
        if (warnIcon) {
            warnIcon.hidden = false;
            warnIcon.setAttribute('aria-hidden', 'false');
        }
        window.clearTimeout(window._storageBadgeAttentionTimer);
        window._storageBadgeAttentionTimer = window.setTimeout(() => {
            storageBadge.classList.remove('storage-badge-attention');
        }, 2200);
    };

    window.updateLibraryStorageWarning = function() {};

    window.syncStorageLimitsFromStatus = function(limitData) {
        if (!limitData?.storage?.videos) return null;
        const used = limitData.storage.videos.used ?? 0;
        const limit = limitData.storage.videos.limit ?? 2;
        const plan = (limitData.plan?.name || limitData.plan || 'free').toString().toLowerCase();
        window.applyStorageBadgeUI({ used, limit, plan });
        return window.getStoragePhase(used, limit, plan);
    };

    window.updateStorageBadgeDisplay = (function() {
        let originalFunc = async function() {
            try {
                const response = await window.apiRequestCache.dedupFetch('/api/auth/subscription', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error(`Failed to fetch subscription: ${response.status}`);

                const data = await response.json();
                const subscription = data?.subscription;
                if (!subscription || typeof subscription !== 'object') throw new Error('Missing subscription');

                let videosInLibrary = window.validateNumber(subscription.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
                if (window.clipsStudio?.libraryItems?.length != null) {
                    videosInLibrary = window.clipsStudio.libraryItems.length;
                }
                const limit = window.validateNumber(subscription.video_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 2);
                const planRaw = subscription.plan || 'free';
                const plan = (typeof planRaw === 'string' && VALIDATION.ALLOWED_PLANS.includes(planRaw.toLowerCase()))
                    ? planRaw.toLowerCase() : 'free';

                window.applyStorageBadgeUI({ used: videosInLibrary, limit, plan });
            } catch (error) {
                console.error('Failed to fetch storage info from backend:', error);
            }
        };
        return window.createDebounce(originalFunc, 3000);
    })();

    window.closeUpgradeModal = function() {
        const modal = document.getElementById('upgradeModalOverlay');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    window.showUpgradeModal = function(title = 'Video Too Long', subtitle = 'Your video exceeds your plan limit. Upgrade to process longer videos and unlock premium features.') {
        const modal = document.getElementById('upgradeModalOverlay');
        const titleEl = document.getElementById('upgradeModalTitle');
        const subtitleEl = document.getElementById('upgradeModalSubtitle');

        if (modal) {
            if (titleEl) titleEl.textContent = window.sanitizeString(title);
            if (subtitleEl) subtitleEl.textContent = window.sanitizeString(subtitle);
            modal.style.display = 'flex';
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            const savedClipsTab = localStorage.getItem('clipsActiveTab') || 'templates';
            const clipsTabButtons = document.querySelectorAll('.clips-sub-item');
            const clipsSubItems = document.querySelectorAll('.clips-sub-item');

            let tabFound = false;
            clipsSubItems.forEach(item => {
                if (item.getAttribute('data-tab') === savedClipsTab) {
                    item.classList.add('active');
                    switchClipsTab(savedClipsTab, item);
                    tabFound = true;
                } else {
                    item.classList.remove('active');
                }
            });

            if (!tabFound && clipsSubItems[0]) {
                clipsSubItems[0].classList.add('active');
                switchClipsTab('templates', clipsSubItems[0]);
            }
        } catch (err) {
            console.warn('Failed to restore clips tab state:', err);
        }

        const paymentSuccess = sessionStorage.getItem('paymentSuccess');
        if (paymentSuccess) {
            try {
                const paymentData = JSON.parse(paymentSuccess);

                if (!paymentData.plan || typeof paymentData.plan !== 'string') {
                    console.error('Invalid payment data: plan is missing or not a string');
                    sessionStorage.removeItem('paymentSuccess');
                    return;
                }

                if (!VALIDATION.ALLOWED_PLANS.includes(paymentData.plan.toLowerCase())) {
                    console.error('Invalid payment data: plan not in allowed list');
                    sessionStorage.removeItem('paymentSuccess');
                    return;
                }

                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (currentUser) {
                    currentUser.plan = paymentData.plan.toLowerCase();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            } catch (e) {
                console.error('Failed to parse payment success data:', e);
            }
            sessionStorage.removeItem('paymentSuccess');
        }

        async function loadUserTierInfo() {
            try {
                const response = await fetch('/api/tier/info', {
                    method: 'GET',
                    credentials: 'include'  // ✅ Send httpOnly cookie
                });

                if (response.ok) {
                    const data = await response.json();
                    if (!data || typeof data !== 'object') {
                        throw new Error('Invalid response structure');
                    }
                    const tierData = data.data;
                    if (!tierData || typeof tierData !== 'object') {
                        throw new Error('Missing tier data in response');
                    }

                    const currentTierEl = document.getElementById('currentTier');
                    const tierInfoEl = document.getElementById('tierInfo');
                    const tierInfoCard = document.getElementById('tierInfoCard');

                    if (currentTierEl && tierData.tier_name && typeof tierData.tier_name === 'string') {
                        currentTierEl.textContent = window.sanitizeString(tierData.tier_name);

                        if (tierInfoCard) {
                            tierInfoCard.classList.remove('tier-free', 'tier-basic', 'tier-prime', 'tier-elite');
                            const planKey = String(tierData.tier_name || 'free').toLowerCase();
                            tierInfoCard.classList.add(`tier-${planKey}`);
                            tierInfoCard.setAttribute('data-plan', planKey);
                        }
                    }

                    if (tierInfoEl && tierData.generations && typeof tierData.generations.remaining === 'number') {
                        const remaining = window.validateNumber(tierData.generations.remaining, 0, 999999, 0);
                        tierInfoEl.textContent = remaining + ' gens left today';
                    }
                }
            } catch (error) {
            }
        }

        loadUserTierInfo();

        async function refreshSubscriptionOnDashboard() {
            try {
                const response = await fetch('/api/auth/subscription', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (!data || typeof data !== 'object') {
                        throw new Error('Invalid response structure');
                    }
                    const subscription = data.subscription;
                    if (!subscription || typeof subscription !== 'object') {
                        throw new Error('Missing subscription in response');
                    }

                    updateStorageBadgesFromSubscription(subscription);
                } else {
                    console.warn('Could not fetch subscription from backend:', response.status);
                }
            } catch (error) {
                console.error('Dashboard failed to fetch subscription:', error);
            }
        }

        function updateStorageBadgesFromSubscription(subscription) {
            if (!subscription || typeof subscription !== 'object') return;

            const storageTotalBadge = document.getElementById('storageTotalBadge');
            const storagePlanBadge = document.getElementById('storagePlanBadge');
            const currentPlanDesc = document.getElementById('currentPlanDesc');

            const videoLimit = window.validateNumber(subscription.video_limit || subscription.videos_space_limit || 2, 1, VALIDATION.MAX_VIDEOS_LIMIT, 2);
            const planRaw = subscription.plan || 'free';
            const plan = (typeof planRaw === 'string' && VALIDATION.ALLOWED_PLANS.includes(planRaw.toLowerCase())) ? planRaw.toLowerCase() : 'free';
            const planDisplayName = plan.charAt(0).toUpperCase() + plan.slice(1);

            if (storageTotalBadge) {
                storageTotalBadge.textContent = videoLimit.toString();
            }
            if (storagePlanBadge) {
                storagePlanBadge.textContent = planDisplayName;
            }
            if (currentPlanDesc) {
                currentPlanDesc.textContent = planDisplayName + ' Plan';
            }
        }

        refreshSubscriptionOnDashboard();

        updateStorageBadgeDisplay();

        const disclaimerBtn = document.getElementById('disclaimerBtn');
        const disclaimerOverlay = document.querySelector('.url-input-overlay');
        const urlInput = document.querySelector('.url-input');
        const urlSubmitBtn = document.querySelector('.url-submit-btn');
        const checkmarkIcon = document.querySelector('.checkmark-icon');

        const DISCLAIMER_KEY = 'disclaimerAcceptedTime';
        const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (disclaimerBtn && disclaimerOverlay) {
            const lastAcceptedTime = localStorage.getItem(DISCLAIMER_KEY);
            const now = Date.now();
            let shouldShowDisclaimer = false;

            if (!lastAcceptedTime) {
                shouldShowDisclaimer = true;
            } else {
                const timeSinceAccepted = now - parseInt(lastAcceptedTime);
                if (timeSinceAccepted > WEEK_IN_MS) {
                    shouldShowDisclaimer = true;
                }
            }

            if (!shouldShowDisclaimer) {
                disclaimerOverlay.classList.add('hidden');
                disclaimerBtn.classList.add('active');
                if (checkmarkIcon) checkmarkIcon.style.display = 'block';
                if (urlInput) urlInput.style.filter = 'none';
                if (urlSubmitBtn) urlSubmitBtn.style.filter = 'none';
                if (urlInput) urlInput.style.pointerEvents = 'auto';
                if (urlSubmitBtn) urlSubmitBtn.style.pointerEvents = 'auto';
            }

            disclaimerBtn.addEventListener('click', function() {
                if (!this.classList.contains('active')) {
                    this.classList.add('active');
                    if (checkmarkIcon) checkmarkIcon.style.display = 'block';

                    setTimeout(() => {
                        disclaimerOverlay.classList.add('hidden');
                        if (urlInput) urlInput.style.filter = 'none';
                        if (urlSubmitBtn) urlSubmitBtn.style.filter = 'none';
                        if (urlInput) urlInput.style.pointerEvents = 'auto';
                        if (urlSubmitBtn) urlSubmitBtn.style.pointerEvents = 'auto';
                        localStorage.setItem(DISCLAIMER_KEY, Date.now().toString());
                    }, 300);
                }
            });
        }
    });

    function switchClipsTab(tabName, buttonElement) {
        if (window.clipsStudio && typeof window.clipsStudio.switchTab === 'function') {
            window.clipsStudio.switchTab(tabName);
            return;
        }

        const buttons = document.querySelectorAll('.clips-sub-item');
        buttons.forEach(btn => btn.classList.remove('active'));
        if (buttonElement) buttonElement.classList.add('active');

        const sections = document.querySelectorAll('.clips-section');
        sections.forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        const tabToSection = {
            'templates': 'templatesSection',
            'create': 'createSection',
            'library': 'librarySection'
        };

        const targetSection = document.getElementById(tabToSection[tabName]);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        if (tabName === 'library') {
            const studio = window.clipsStudio;
            if (studio) {
                const STALE_MS = 30_000;
                const isStale = !studio._libraryLastLoaded || (Date.now() - studio._libraryLastLoaded) > STALE_MS;
                const isEmpty = !studio.libraryItems || studio.libraryItems.length === 0;
                if (isStale || isEmpty) {
                    studio.showLibrarySkeleton(4);
                    studio.loadLibraryItems().then(() => {
                        studio._libraryLastLoaded = Date.now();
                    });
                }
            }
        }

        try {
            localStorage.setItem('clipsActiveTab', tabName);
            localStorage.setItem('clipsStudioCurrentTab', tabName);
        } catch (err) {
            console.warn('Failed to save clips tab state:', err);
        }

        const indicator = document.getElementById('clipsSubPane');
        if (indicator && buttonElement) {
            const pill = document.querySelector('.clips-sub-pill');
            if (!pill) return;
            const pillStyle = window.getComputedStyle(pill);
            if (pillStyle.display === 'contents') return;
            const pillRect = pill.getBoundingClientRect();
            const buttonRect = buttonElement.getBoundingClientRect();
            indicator.style.left = (buttonRect.left - pillRect.left) + 'px';
        }
    }

    window.switchClipsTab = switchClipsTab;
    window.goMobileClipsTab = window.goMobileClipsTab || function(tabName, buttonElement) {
        if (typeof window.switchSection === 'function') window.switchSection('clips');
        switchClipsTab(tabName, buttonElement || document.querySelector(`.clips-sub-item[data-tab="${tabName}"]`));
    };
