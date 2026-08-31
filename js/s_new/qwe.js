       // Initialize input section on page load
        // ===== SECURITY UTILITY =====
        // Helper to get CSRF token from meta tag or cookie
        window.getCSRFToken = function() {
            // Try meta tag first
            const metaToken = document.querySelector('meta[name="csrf-token"]');
            if (metaToken) return metaToken.getAttribute('content');
            
            // Fallback: extract from cookie (if your backend sets it there)
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

        // Use credentials: 'include' for EVERY fetch (uses httpOnly cookies)
        // Never use localStorage for auth tokens
        window.secureHeaders = function() {
            return {
                'Content-Type': 'application/json',
                ...(window.getCSRFToken() && { 'X-CSRF-Token': window.getCSRFToken() })
            };
        };

        // ===== DEBOUNCE UTILITY =====
        // Prevent excessive API calls
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
                // Only show input section if on chat tab (index 0)
                if (currentIndex === 0) {
                    inputSection.classList.add('active');
                    inputContainer.classList.remove('hidden');
                    inputSection.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: all !important; z-index: 1000 !important;';
                } else {
                    // Hide for all other tabs
                    inputSection.classList.remove('active');
                    inputContainer.classList.add('hidden');
                    inputSection.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;';
                }
            }
        });



        // Handle delete all clips - SECURE VERSION
        // NOTE: Server MUST validate that user owns clips and has permission to delete
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


                // ===== OPTION 1: Bulk delete endpoint (preferred) =====
                // Better performance and atomic transaction on backend
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
                        // Server returned error - may be permission/plan limit issue
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
                    
                    // ===== OPTION 2: Individual deletes with rate limiting (fallback) =====
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

                            // Rate limiting: 100ms delay between requests to avoid DoS-ing own backend
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`Exception deleting clip:`, error);
                        }
                    }
                }

                // Clear local storage only after successful server deletion
                window.clipsStudio.libraryItems = [];
                window.clipsStudio.saveLibraryItems();
                window.clipsStudio.updateLibraryView();

                // Update UI
                updateStorageBadgeDisplay();
                window.clipsStudio?.showNotification(`Deleted ${deletedCount}/${totalClips} clips`, 'success');
            } catch (error) {
                console.error('Error deleting all clips:', error);
                window.clipsStudio?.showNotification('Error: Failed to delete clips. Please try again.', 'error');
            }
        };
    
    /** Storage fill phases — free users get earlier warnings (small limits). */
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

    /** Paid = no cap row in the badge. Free only shows used/limit. */
    window.isUnlimitedLibrary = function(limit, plan) {
        const raw = (plan || document.getElementById('storagePlanBadge')?.textContent || 'free').toString().toLowerCase();
        const p = raw.replace(/\s+plan\s*$/, '').trim();
        return p === 'basic' || p === 'prime' || p === 'elite'
            || p.includes('basic') || p.includes('prime') || p.includes('elite');
    };

    window.formatStorageSpaceTooltip = function(usedMb, totalMb) {
        const used = Math.max(0, Number(usedMb) || 0);
        const total = Math.max(0, Number(totalMb) || 0);
        const fmtGb = (mb) => {
            if (mb >= 1024) {
                const gb = mb / 1024;
                return gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
            }
            if (mb > 0) return (mb / 1024).toFixed(2);
            return '0';
        };
        if (total > 0) return `${fmtGb(used)} / ${fmtGb(total)} GB`;
        if (used > 0) {
            if (used >= 1024) return `${fmtGb(used)} GB`;
            return `${Math.max(1, Math.round(used))} MB`;
        }
        return '0 GB';
    };

    window.buildStorageBadgeTitle = function({
        used,
        limit,
        plan,
        unlimited,
        phase,
        effectiveLimit,
        spaceUsedMb,
        spaceTotalMb,
    }) {
        const spaceLine = window.formatStorageSpaceTooltip(spaceUsedMb, spaceTotalMb);
        if (unlimited) {
            return `${used} clip${used === 1 ? '' : 's'} stored · ${spaceLine}`;
        }
        if (phase === 'full') {
            return `Storage full (${used}/${effectiveLimit} clips) · ${spaceLine}`;
        }
        if (phase === 'high') {
            return `Almost full (${used}/${effectiveLimit} clips) · ${spaceLine}`;
        }
        return `${used}/${effectiveLimit} clips · ${spaceLine}`;
    };

    window.applyStorageBadgeUI = function({ used, limit, plan, unlimited, spaceUsedMb, spaceTotalMb }) {
        const planNorm = (typeof plan === 'string' && plan.length)
            ? plan.toLowerCase().replace(/\s+plan\s*$/, '').trim()
            : 'free';
        const isUnlimited = unlimited === true || window.isUnlimitedLibrary(limit, planNorm);
        const showCap = !isUnlimited;
        const effectiveLimit = showCap ? Math.max(1, Number(limit) || 10) : null;
        const safeUsed = Math.max(0, Number(used) || 0);
        const { phase, showDeleteAll, showUpgrade } = showCap
            ? window.getStoragePhase(safeUsed, effectiveLimit, planNorm)
            : { phase: 'ok', showDeleteAll: false, showUpgrade: false };
        const planLabel = planNorm.charAt(0).toUpperCase() + planNorm.slice(1);
        const isWarn = showCap && (phase === 'high' || phase === 'full');

        const storageBadge = document.getElementById('storageBadge');
        const usedEl = document.getElementById('storageUsedBadge');
        const totalEl = document.getElementById('storageTotalBadge');
        const limitGroup = document.getElementById('storageLimitGroup');
        const planEl = document.getElementById('storagePlanBadge');
        const warnIcon = document.getElementById('storageWarnIcon');
        const deleteAllBtn = document.getElementById('deleteAllClipsBtn');
        const needMoreUpgradeText = document.getElementById('needMoreUpgradeText');

        if (usedEl) {
            usedEl.textContent = String(safeUsed);
            usedEl.style.color = '';
            usedEl.classList.toggle('storage-count-warn', isWarn);
        }

        // Paid: hide the whole " / 50" chunk — never write null/empty into the total span while visible
        if (limitGroup) {
            limitGroup.style.display = showCap ? '' : 'none';
            limitGroup.hidden = !showCap;
        } else if (totalEl) {
            // Legacy markup without #storageLimitGroup wrapper
            totalEl.style.display = showCap ? '' : 'none';
            const slash = totalEl.previousSibling;
            if (slash && slash.nodeType === 3) slash.textContent = showCap ? ' / ' : '';
        }
        if (totalEl && showCap) {
            totalEl.textContent = String(effectiveLimit);
            totalEl.style.display = '';
            totalEl.classList.toggle('storage-count-warn', phase === 'full');
        }

        if (storageBadge) storageBadge.classList.toggle('is-unlimited', isUnlimited);
        if (planEl) planEl.textContent = planLabel;

        if (storageBadge) {
            storageBadge.classList.toggle('is-warn', isWarn);
            storageBadge.classList.toggle('is-full', showCap && phase === 'full');
            storageBadge.title = isUnlimited
                ? `${safeUsed} clip${safeUsed === 1 ? '' : 's'} stored`
                : phase === 'full'
                    ? 'Storage full — delete clips or upgrade your plan'
                    : phase === 'high'
                        ? `Storage almost full (${safeUsed}/${effectiveLimit}) — remove old videos to keep generating`
                        : 'Library storage';
        }
        if (warnIcon) {
            warnIcon.hidden = !isWarn;
            warnIcon.setAttribute('aria-hidden', isWarn ? 'false' : 'true');
        }

        if (deleteAllBtn) deleteAllBtn.style.display = showDeleteAll ? 'inline-flex' : 'none';
        if (needMoreUpgradeText) {
            needMoreUpgradeText.hidden = !showUpgrade;
            needMoreUpgradeText.style.display = showUpgrade ? '' : 'none';
        }
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
        const plan = (limitData.plan?.name || limitData.plan || 'free').toString().toLowerCase();
        const unlimited = limitData.storage.videos.unlimited === true
            || ['basic', 'prime', 'elite'].includes(plan);
        const limit = unlimited ? null : (limitData.storage.videos.limit ?? 5);
        const space = limitData.storage?.space_mb || {};
        window.applyStorageBadgeUI({
            used,
            limit,
            plan,
            unlimited,
            spaceUsedMb: space.used,
            spaceTotalMb: space.total,
        });
        return unlimited ? { phase: 'ok' } : window.getStoragePhase(used, limit, plan);
    };

    // Debounced storage badge update to prevent excessive API calls
    window.updateStorageBadgeDisplay = (function() {
        let originalFunc = async function() {
            try {
                const fetchOpts = {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                };
                const [subResponse, statusResponse] = await Promise.all([
                    window.apiRequestCache.dedupFetch('/api/auth/subscription', fetchOpts),
                    window.apiRequestCache.dedupFetch('/api/clips/status', fetchOpts).catch(() => null),
                ]);
                if (!subResponse.ok) throw new Error(`Failed to fetch subscription: ${subResponse.status}`);

                const data = await subResponse.json();
                const subscription = data?.subscription;
                if (!subscription || typeof subscription !== 'object') throw new Error('Missing subscription');

                let spaceUsedMb = null;
                let spaceTotalMb = null;
                if (statusResponse?.ok) {
                    try {
                        const statusData = await statusResponse.json();
                        const space = statusData?.storage?.space_mb || {};
                        spaceUsedMb = space.used;
                        spaceTotalMb = space.total;
                    } catch (_) {}
                }
                if (spaceTotalMb == null && subscription.storage_limit_gb != null) {
                    spaceTotalMb = Number(subscription.storage_limit_gb) * 1024;
                }

                let videosInLibrary = window.validateNumber(subscription.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
                if (window.clipsStudio?.libraryItems?.length != null) {
                    videosInLibrary = window.clipsStudio.libraryItems.length;
                }
                const planRaw = subscription.plan || 'free';
                const plan = (typeof planRaw === 'string' && VALIDATION.ALLOWED_PLANS.includes(planRaw.toLowerCase()))
                    ? planRaw.toLowerCase() : 'free';
                const unlimited = subscription.library_unlimited === true
                    || window.isUnlimitedLibrary?.(null, plan);

                window.applyStorageBadgeUI({
                    used: videosInLibrary,
                    limit: unlimited ? null : window.validateNumber(subscription.video_limit || subscription.videos_space_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 5),
                    plan,
                    unlimited,
                    spaceUsedMb,
                    spaceTotalMb,
                });
            } catch (error) {
                console.error('Failed to fetch storage info from backend:', error);
            }
        };
        return window.createDebounce(originalFunc, 3000);
    })();

    // Belt-and-suspenders: paid plans never show " / cap" even if a stale script runs first
    window.addEventListener('DOMContentLoaded', () => {
        const planEl = document.getElementById('storagePlanBadge');
        const plan = (planEl?.textContent || 'free').toLowerCase().replace(/\s+plan\s*$/, '').trim();
        if (typeof window.isUnlimitedLibrary === 'function' && window.isUnlimitedLibrary(null, plan)) {
            const used = Number(document.getElementById('storageUsedBadge')?.textContent || 0);
            window.applyStorageBadgeUI?.({ used, limit: null, plan, unlimited: true });
        }
    });



    // Upgrade Modal Functions
    window.closeUpgradeModal = function() {
        const modal = document.getElementById('upgradeModalOverlay');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    window.showUpgradeModal = function(title = 'Unlock more uploads', subtitle = 'Upgrade for more uploads per day, unlimited clips in your library, and more clips per run.') {
        const modal = document.getElementById('upgradeModalOverlay');
        const titleEl = document.getElementById('upgradeModalTitle');
        const subtitleEl = document.getElementById('upgradeModalSubtitle');
        
        if (modal) {
            // Sanitize inputs to prevent XSS
            if (titleEl) titleEl.textContent = window.sanitizeString(title);
            if (subtitleEl) subtitleEl.textContent = window.sanitizeString(subtitle);
            modal.style.display = 'flex';
        }
    };
    // Subscription modal functions removed
    
    // Setup subscription modal event listeners on page load
    document.addEventListener('DOMContentLoaded', function() {
        // ═══════════════════════════════════════
        // Restore Clips Tab State from localStorage
        // ═══════════════════════════════════════
        try {
            // Default Create tab on load only — don't re-force if landing already applied
            // (user may already have switched sections during early init).
            if (window.SolisFirstLanding && typeof window.SolisFirstLanding.needsLanding === 'function'
                && !window.SolisFirstLanding.needsLanding()) {
                // Landing already done; leave current tab alone.
            } else {
                const clipsSubItems = document.querySelectorAll('.clips-sub-item');
                clipsSubItems.forEach(item => {
                    item.classList.toggle('active', item.getAttribute('data-tab') === 'create');
                });
                const createBtn = document.querySelector('.clips-sub-item[data-tab="create"]') || clipsSubItems[0];
                if (createBtn && typeof switchClipsTab === 'function') {
                    switchClipsTab('create', createBtn);
                }
                try {
                    localStorage.setItem('clipsActiveTab', 'create');
                    localStorage.setItem('clipsStudioCurrentTab', 'create');
                    localStorage.setItem('currentNavigationTarget', 'clips');
                } catch (_) {}
            }
        } catch (err) {
            console.warn('Failed to restore clips tab state:', err);
        }
        
        // Check if we just returned from a successful payment
        const paymentSuccess = sessionStorage.getItem('paymentSuccess');
        if (paymentSuccess) {
            try {
                const paymentData = JSON.parse(paymentSuccess);
                
                // ===== PLAN VALIDATION =====
                // Only accept known plan values; reject anything else
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
                
                // Update currentUser plan in localStorage (cache only)
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (currentUser) {
                    currentUser.plan = paymentData.plan.toLowerCase();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            } catch (e) {
                console.error('Failed to parse payment success data:', e);
            }
            // Clear the flag
            sessionStorage.removeItem('paymentSuccess');
        }
        
        // Load user tier information
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
                    
                    // Update tier info card
                    const currentTierEl = document.getElementById('currentTier');
                    const tierInfoEl = document.getElementById('tierInfo');
                    const tierInfoCard = document.getElementById('tierInfoCard');
                    
                    if (currentTierEl && tierData.tier_name && typeof tierData.tier_name === 'string') {
                        currentTierEl.textContent = window.sanitizeString(tierData.tier_name);
                        
                        // ✨ Update tier color blob
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
        
        // ✅ Fetch fresh subscription info from server - NOT localStorage!
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
                    
                    
                    // Now update all the badges with REAL data
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

            const planRaw = subscription.plan || 'free';
            const plan = (typeof planRaw === 'string' && VALIDATION.ALLOWED_PLANS.includes(planRaw.toLowerCase()))
                ? planRaw.toLowerCase() : 'free';
            const unlimited = subscription.library_unlimited === true
                || window.isUnlimitedLibrary?.(null, plan);
            const videosInLibrary = window.clipsStudio?.libraryItems?.length != null
                ? window.clipsStudio.libraryItems.length
                : window.validateNumber(subscription.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
            const limit = unlimited
                ? null
                : window.validateNumber(subscription.video_limit || subscription.videos_space_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 5);
            const planDisplayName = plan.charAt(0).toUpperCase() + plan.slice(1);

            if (typeof window.applyStorageBadgeUI === 'function') {
                window.applyStorageBadgeUI({ used: videosInLibrary, limit, plan, unlimited });
            }

            const storagePlanBadge = document.getElementById('storagePlanBadge');
            const currentPlanDesc = document.getElementById('currentPlanDesc');
            if (storagePlanBadge) storagePlanBadge.textContent = planDisplayName;
            if (currentPlanDesc) currentPlanDesc.textContent = planDisplayName + ' Plan';
        }
        
        // Call refresh immediately
        refreshSubscriptionOnDashboard();
        
        // Update storage badge on page load
        updateStorageBadgeDisplay();

        // Disclaimer Overlay Handler - Shows once a week
        const disclaimerBtn = document.getElementById('disclaimerBtn');
        const disclaimerOverlay = document.querySelector('.url-input-overlay');
        const urlInput = document.querySelector('.url-input');
        const urlSubmitBtn = document.querySelector('.url-submit-btn');
        const checkmarkIcon = document.querySelector('.checkmark-icon');
        
        const DISCLAIMER_KEY = 'disclaimerAcceptedTime';
        const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (disclaimerBtn && disclaimerOverlay) {
            // Check if disclaimer needs to be shown
            const lastAcceptedTime = localStorage.getItem(DISCLAIMER_KEY);
            const now = Date.now();
            let shouldShowDisclaimer = false;
            
            if (!lastAcceptedTime) {
                // New user - show disclaimer
                shouldShowDisclaimer = true;
            } else {
                const timeSinceAccepted = now - parseInt(lastAcceptedTime);
                if (timeSinceAccepted > WEEK_IN_MS) {
                    // More than a week has passed - show again
                    shouldShowDisclaimer = true;
                }
            }
            
            // Show or hide overlay based on timing
            if (!shouldShowDisclaimer) {
                disclaimerOverlay.classList.add('hidden');
                disclaimerBtn.classList.add('active');
                if (checkmarkIcon) checkmarkIcon.style.display = 'block';
                if (urlInput) urlInput.style.filter = 'none';
                if (urlSubmitBtn) urlSubmitBtn.style.filter = 'none';
                if (urlInput) urlInput.style.pointerEvents = 'auto';
                if (urlSubmitBtn) urlSubmitBtn.style.pointerEvents = 'auto';
            }
            
            // Handle button click
            disclaimerBtn.addEventListener('click', function() {
                if (!this.classList.contains('active')) {
                    this.classList.add('active');
                    if (checkmarkIcon) checkmarkIcon.style.display = 'block';
                    
                    // Debounce the hide to let the animation play
                    setTimeout(() => {
                        disclaimerOverlay.classList.add('hidden');
                        // Remove blur from input and button
                        if (urlInput) urlInput.style.filter = 'none';
                        if (urlSubmitBtn) urlSubmitBtn.style.filter = 'none';
                        // Enable interactions
                        if (urlInput) urlInput.style.pointerEvents = 'auto';
                        if (urlSubmitBtn) urlSubmitBtn.style.pointerEvents = 'auto';
                        // Save current timestamp to localStorage
                        localStorage.setItem(DISCLAIMER_KEY, Date.now().toString());
                    }, 300);
                }
            });
        }
    });

    // Clips Top Navigation - Simple Tab Switching
    function switchClipsTab(tabName, buttonElement) {
        // Prefer ClipsStudio.switchTab so both nav UIs + sections stay in sync
        if (window.clipsStudio && typeof window.clipsStudio.switchTab === 'function') {
            window.clipsStudio.switchTab(tabName);
            return;
        }

        // Fallback if studio isn't ready yet
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
            // Mobile bar uses display:contents — skip sliding indicator
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