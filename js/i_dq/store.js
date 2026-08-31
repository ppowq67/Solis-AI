
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
        const modal = document.getElementById('deleteConfirmationModal');
        const deleteTitle = document.getElementById('deleteModalTitle');
        const deleteText = document.getElementById('deleteConfirmationText');
        const deleteWarning = modal?.querySelector('.delete-modal-warning');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (!modal || !deleteText || !confirmBtn) return;
        
        const items = (window.clipsStudio && window.clipsStudio.libraryItems) ? window.clipsStudio.libraryItems : [];
        const count = items.length;

        if (deleteTitle) deleteTitle.textContent = 'Clear library?';
        deleteText.textContent = count > 0
            ? `Remove all ${count} clips from your library.`
            : 'There are no clips in your library to remove.';
        if (deleteWarning) deleteWarning.textContent = 'This can’t be undone.';
        confirmBtn.textContent = 'Clear all';
        confirmBtn.disabled = count === 0;
        
        modal.classList.add('show');
        
        // Replace button to drop any previous single-delete listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.onclick = async function() {
            if (!window.clipsStudio || !window.clipsStudio.libraryItems || window.clipsStudio.libraryItems.length === 0) {
                window.clipsStudio?.showNotification('No clips to delete', 'info');
                modal.classList.remove('show');
                return;
            }

            newConfirmBtn.disabled = true;
            newConfirmBtn.textContent = 'Clearing…';

            try {
                const clips = [...window.clipsStudio.libraryItems];
                const totalClips = clips.length;
                let deletedCount = 0;
                const headers = (typeof getAuthHeaders === 'function')
                    ? getAuthHeaders()
                    : { 'Content-Type': 'application/json' };
                const apiBase = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
                    ? API_BASE_URL
                    : '/api';

                for (const clip of clips) {
                    const projectId = clip.projectId || clip.project_id;
                    if (!projectId) continue;
                    try {
                        const response = await fetch(`${apiBase}/clips/project/${encodeURIComponent(projectId)}`, {
                            method: 'DELETE',
                            headers,
                            credentials: 'include',
                        });
                        if (response.ok) deletedCount++;
                    } catch (error) {
                        console.error(`Failed to delete clip ${projectId}:`, error);
                    }
                }

                window.clipsStudio.libraryItems = [];
                window.clipsStudio.processingItems = [];
                window.clipsStudio.saveLibraryItems();
                if (typeof window.clipsStudio.saveProcessingItems === 'function') {
                    window.clipsStudio.saveProcessingItems();
                }
                window.clipsStudio.updateLibraryView();
                if (typeof window.clipsStudio.updateProcessingView === 'function') {
                    window.clipsStudio.updateProcessingView();
                }
                if (typeof updateStorageBadgeDisplay === 'function') {
                    await updateStorageBadgeDisplay();
                }

                window.clipsStudio.showNotification(
                    deletedCount > 0
                        ? `Cleared ${deletedCount}/${totalClips} clips from your library`
                        : 'Library cleared',
                    'success'
                );
                modal.classList.remove('show');
            } catch (error) {
                console.error('Error clearing library:', error);
                window.clipsStudio?.showNotification('Error clearing library. Please try again.', 'error');
                modal.classList.remove('show');
            } finally {
                newConfirmBtn.disabled = false;
                newConfirmBtn.textContent = 'Clear all';
            }
        };
    };

    // ===== WEBSOCKET LISTENERS FOR STORAGE BADGE UPDATES =====
    // NOTE: updateStorageBadgeDisplay() is defined in /js/s_new/qwe.js with robust validation & API deduplication
    // This file was loading AFTER qwe.js and overwriting it with a weaker version, causing "bad handling"
    // The qwe.js version is kept and used exclusively
    window.addEventListener('load', () => {
        setTimeout(() => {
            // Listen for video generation completion
            if (window.videoGenerationSocket) {
                window.videoGenerationSocket.off('video_generated');
                window.videoGenerationSocket.on('video_generated', () => {
                    updateStorageBadgeDisplay();
                });
            }
            
            // Listen to main WebSocket for storage updates
            if (window.solisWSClient) {
                window.solisWSClient.on('storage_update', () => {
                    updateStorageBadgeDisplay();
                });
                
                window.solisWSClient.on('video_generated', () => {
                    updateStorageBadgeDisplay();
                });
            }
            
            // Also listen for clips library updates
            if (window.clipsStudio) {
                const originalLoadLibrary = window.clipsStudio.loadLibraryItems;
                window.clipsStudio.loadLibraryItems = async function() {
                    const result = await originalLoadLibrary.call(this);
                    // NOTE: Debounced updateStorageBadgeDisplay() NOT called here
                    // to prevent duplicate API calls - it's handled via WebSocket listeners
                    return result;
                };
            }
        }, 1000);
    });


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
            if (titleEl) titleEl.textContent = title;
            if (subtitleEl) subtitleEl.textContent = subtitle;
            modal.style.display = 'flex';
        }
    };
    document.addEventListener('DOMContentLoaded', function() {
        const paymentSuccess = sessionStorage.getItem('paymentSuccess');
        if (paymentSuccess) {
            try {
                const paymentData = JSON.parse(paymentSuccess);
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (currentUser) {
                    currentUser.plan = paymentData.plan;
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
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const tierData = data.data;
                    const currentTierEl = document.getElementById('currentTier');
                    const tierInfoEl = document.getElementById('tierInfo');
                    const tierInfoCard = document.getElementById('tierInfoCard');
                    
                    if (currentTierEl) {
                        currentTierEl.textContent = tierData.tier_name;
                        
                        // ✨ Update tier color blob
                        if (tierInfoCard) {
                            tierInfoCard.classList.remove('tier-free', 'tier-basic', 'tier-prime', 'tier-elite');
                            const planKey = String(tierData.tier_name || 'free').toLowerCase();
                            tierInfoCard.classList.add(`tier-${planKey}`);
                            tierInfoCard.setAttribute('data-plan', planKey);
                        }
                    }
                    
                    if (tierInfoEl) {
                        const remaining = tierData.generations.remaining;
                        tierInfoEl.textContent = `${remaining} gens left today`;
                    }
                }
            } catch (error) {
            }
        }

        loadUserTierInfo();
        async function refreshSubscriptionOnDashboard() {
            try {
                // Reuse the global subscription cache from s.js to avoid duplicate network calls.
                // _subCache is defined before store.js initialises on every dashboard load.
                const subscription = window._subCache
                    ? await window._subCache.get()
                    : await fetch('/api/auth/subscription', { credentials: 'include' })
                        .then(r => r.ok ? r.json().then(d => d.subscription) : null);

                if (subscription) {
                    updateStorageBadgesFromSubscription(subscription);
                }
            } catch (error) {
                console.error('Dashboard failed to get subscription:', error);
            }
        }
        
        function updateStorageBadgesFromSubscription(subscription) {
            if (!subscription || typeof subscription !== 'object') return;
            const planRaw = subscription.plan || 'free';
            const plan = String(planRaw).toLowerCase().replace(/\s+plan\s*$/, '').trim();
            const unlimited = subscription.library_unlimited === true
                || (typeof window.isUnlimitedLibrary === 'function' && window.isUnlimitedLibrary(null, plan));
            const videosInLibrary = window.clipsStudio?.libraryItems?.length != null
                ? window.clipsStudio.libraryItems.length
                : Math.max(0, Number(subscription.active_videos) || 0);
            const limit = unlimited
                ? null
                : Math.max(1, Number(subscription.video_limit || subscription.videos_space_limit) || 5);
            if (typeof window.applyStorageBadgeUI === 'function') {
                window.applyStorageBadgeUI({ used: videosInLibrary, limit, plan, unlimited });
            }
            const planDisplayName = plan.charAt(0).toUpperCase() + plan.slice(1);
            const storagePlanBadge = document.getElementById('storagePlanBadge');
            const currentPlanDesc = document.getElementById('currentPlanDesc');
            if (storagePlanBadge) storagePlanBadge.textContent = planDisplayName;
            if (currentPlanDesc) currentPlanDesc.textContent = planDisplayName + ' Plan';
        }
        refreshSubscriptionOnDashboard();
        updateStorageBadgeDisplay();
        const disclaimerBtn = document.getElementById('disclaimerBtn');
        const disclaimerOverlay = document.querySelector('.url-input-overlay');
        const urlInput = document.querySelector('.url-input');
        const urlSubmitBtn = document.querySelector('.url-submit-btn');
        const checkmarkIcon = document.querySelector('.checkmark-icon');
        
        const DISCLAIMER_KEY = 'disclaimerAcceptedTime';
        const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; 
        
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
        const buttons = document.querySelectorAll('.clips-sub-item');
        buttons.forEach(btn => btn.classList.remove('active'));
        buttonElement.classList.add('active');
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

        // When opening the library tab, show skeletons and refresh if stale
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

        const indicator = document.getElementById('clipsSubPane');
        if (indicator) {
            const buttonIndex = Array.from(buttons).indexOf(buttonElement);
            const pill = document.querySelector('.clips-sub-pill');
            const pillRect = pill.getBoundingClientRect();
            const buttonRect = buttonElement.getBoundingClientRect();
            const relativeLeft = buttonRect.left - pillRect.left;
            
            indicator.style.left = relativeLeft + 'px';
        }

    }